/**
 * auth-gate.js
 * Handles access control and token storage.
 * 
 * Responsibilities:
 * - Verify Secret Code (Hash verification)
 * - Manage Token in SessionStorage
 * - Provide Access Verification
 * 
 * Restrictions:
 * - No direct DOM manipulation (except maybe implicit if needed for alerts?) -> pure logic preferred.
 * - does not modify CV.
 */

import { setSecureItem, getSecureItem, removeSecureItem } from './crypto-utils.js';

const SESSION_KEY = "gh_pat";
const ACCESS_KEY = "admin_access";
const ADMIN_HASH_KEY = "admin_hash";
// SHA-256 hash of the default secret code ("admin123")
const DEFAULT_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

export async function saveToken(token) {
    await setSecureItem(localStorage, SESSION_KEY, token);
}

export async function getToken() {
    return await getSecureItem(localStorage, SESSION_KEY);
}

export function clearToken() {
    removeSecureItem(localStorage, SESSION_KEY);
}

export async function hasToken() {
    const token = await getToken();
    return !!token;
}

export async function unlockAccess() {
    await setSecureItem(localStorage, ACCESS_KEY, "true");
}

export function lockAccess() {
    removeSecureItem(localStorage, ACCESS_KEY);
}

export async function isAccessUnlocked() {
    const value = await getSecureItem(localStorage, ACCESS_KEY);
    return value === "true";
}

/**
 * Hashes a string using SHA-256
 * @param {string} str 
 * @returns {Promise<string>} hex string
 */
async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getStoredHash() {
    const stored = await getSecureItem(localStorage, ADMIN_HASH_KEY);
    return stored || DEFAULT_HASH;
}

/**
 * Verifies if the provided code matches the secret hash.
 * @param {string} code 
 * @returns {Promise<boolean>}
 */
export async function verifyAccessCode(code) {
    const hash = await sha256(code);
    const targetHash = await getStoredHash();
    return hash === targetHash;
}

export async function updateAccessCode(currentCode, newCode) {
    const currentHash = await sha256(currentCode);
    const targetHash = await getStoredHash();
    if (currentHash !== targetHash) {
        return false;
    }
    const newHash = await sha256(newCode);
    await setSecureItem(localStorage, ADMIN_HASH_KEY, newHash);
    return true;
}

export function clearAccessCode() {
    removeSecureItem(localStorage, ADMIN_HASH_KEY);
}
