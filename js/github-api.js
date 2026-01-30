/**
 * github-api.js
 * Handles interactions with GitHub REST API.
 * 
 * Responsibilities:
 * - Fetch CV data (GET)
 * - Update CV data (PUT)
 * - Validate Token (implicitly via API call)
 * 
 * Restrictions:
 * - No DOM access
 * - No UI logic
 */

const GITHUB_API_BASE = "https://api.github.com";

// Helper to handle API response
async function handleResponse(response) {
    if (!response.ok) {
        let errorPayload = null;
        try {
            errorPayload = await response.json();
        } catch (err) {
            // ignore
        }
        const err = new Error((errorPayload && errorPayload.message) || response.statusText);
        err.details = errorPayload;
        err.status = response.status;
        throw err;
    }
    return response.json();
}

/**
 * Fetches the raw content of a file from the repository.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} [token] - Optional PAT (for private repos or rate limits)
 * @returns {Promise<Object>} - The JSON content
 */
export async function fetchCVData(owner, repo, path, token = null) {
    const headers = {
        "Accept": "application/vnd.github.v3+json"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }

    // We use the raw content URL or the API contents endpoint?
    // API contents endpoint returns base64 encoded content.
    // Raw URL is easier for reading, but API is better for consistency.
    // Let's use API contents endpoint to also get the SHA (needed for updates).

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, { headers });
    const data = await handleResponse(response);

    // Decode Base64 content safely for UTF-8
    const base64 = data.content.replace(/\n/g, "");
    const binString = atob(base64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    const content = new TextDecoder().decode(bytes);
    const json = JSON.parse(content);

    return {
        data: json,
        sha: data.sha // Return SHA for usage in updates
    };
}

/**
 * Updates the CV file in the repository.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} token - valid GitHub PAT
 * @param {Object} content - The new JSON content
 * @param {string} sha - The SHA of the file being updated
 * @param {string} message - Commit message
 * @returns {Promise<Object>} - The full response from GitHub
 */
export async function updateCVData(owner, repo, path, token, content, sha, message) {
    if (!token) throw new Error("Token is required for writing.");

    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    };

    // Encode content to Base64
    const contentString = JSON.stringify(content, null, 2);
    // btoa handles ASCII only. For utf-8 we need to be careful.
    // Using TextEncoder/Uint8Array/String.fromCharCode trick for UTF-8 support
    const utf8Bytes = new TextEncoder().encode(contentString);
    const base64Content = btoa(String.fromCharCode(...utf8Bytes));

    const body = {
        message: message || "Update CV data via Config UI",
        content: base64Content
    };
    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
    });

    return handleResponse(response);
}

/**
 * Deletes a file from the repository.
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {string} token
 * @param {string} message
 * @returns {Promise<Object>}
 */
export async function deleteFile(owner, repo, path, token, message) {
    if (!token) throw new Error("Token is required for deleting.");
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    };

    const existing = await fetch(url, { headers });
    const data = await handleResponse(existing);
    const body = {
        message: message || `Delete ${path}`,
        sha: data.sha
    };

    const response = await fetch(url, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body)
    });

    return handleResponse(response);
}

function encodeBase64(bytes) {
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function getFileSha(owner, repo, path, token) {
    const headers = {
        "Accept": "application/vnd.github.v3+json"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const data = await response.json();
    return data.sha || null;
}

/**
 * Uploads a file to the repository (creates or overwrites).
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {File} file
 * @param {string} token
 * @param {string} message
 * @returns {Promise<Object>}
 */
export async function uploadFile(owner, repo, path, file, token, message) {
    if (!token) throw new Error("Token is required for uploading.");
    if (!file) throw new Error("File is required.");
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = encodeBase64(new Uint8Array(arrayBuffer));
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    };
    const body = {
        message: message || `Upload ${path}`,
        content: base64Content
    };
    const sha = await getFileSha(owner, repo, path, token);
    if (sha) body.sha = sha;
    const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
    });
    return handleResponse(response);
}

/**
 * Simple check if token is valid (by getting user info)
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
export async function validateToken(token) {
    if (!token) return false;
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: { "Authorization": `token ${token}` }
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Lists files inside a repository path.
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {string} token
 * @returns {Promise<Array<{name: string, path: string, type: string}>>}
 */
export async function listRepoFiles(owner, repo, path, token = null) {
    if (!owner || !repo || !path) return [];
    const headers = {
        "Accept": "application/vnd.github.v3+json"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }
    const cleanPath = String(path).replace(/^\/+/, '').replace(/\/+$/, '');
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`;
    const response = await fetch(url, { headers });
    const data = await handleResponse(response);
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type
    }));
}
