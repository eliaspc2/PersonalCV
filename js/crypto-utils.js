const HARD_KEY = 'PersonalCV::secure-cache::v1';
let cachedKeyPromise = null;

function getKey() {
    if (cachedKeyPromise) return cachedKeyPromise;
    cachedKeyPromise = crypto.subtle.digest('SHA-256', new TextEncoder().encode(HARD_KEY))
        .then((hash) => crypto.subtle.importKey(
            'raw',
            hash,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        ));
    return cachedKeyPromise;
}

function base64Encode(bytes) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
}

function base64Decode(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export async function encrypt(plainText) {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const cipherBytes = new Uint8Array(cipherBuffer);

    const payload = {
        iv: base64Encode(iv),
        data: base64Encode(cipherBytes)
    };
    return JSON.stringify(payload);
}

export async function decrypt(cipherText) {
    const payload = JSON.parse(cipherText);
    if (!payload || !payload.iv || !payload.data) {
        throw new Error('Invalid payload');
    }
    const key = await getKey();
    const iv = base64Decode(payload.iv);
    const data = base64Decode(payload.data);
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuffer);
}

export async function setSecureItem(storage, key, value) {
    if (value === undefined || value === null) {
        storage.removeItem(key);
        return;
    }
    const encrypted = await encrypt(String(value));
    storage.setItem(key, encrypted);
}

export async function getSecureItem(storage, key) {
    const raw = storage.getItem(key);
    if (!raw) return null;
    try {
        return await decrypt(raw);
    } catch (err) {
        storage.removeItem(key);
        return null;
    }
}

export function removeSecureItem(storage, key) {
    storage.removeItem(key);
}
