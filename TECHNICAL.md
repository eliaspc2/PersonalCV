# TECHNICAL.md - Security, Limitations & Architecture

This document details the technical inner workings, security model, and module responsibilities of the Static CV project.

## 🔒 Security Model

### 1. The Access Gate
The project uses a two-tier access model for the Admin UI:
- **Obscurity**: The entry point is hidden (3 clicks on the sidebar profile photo within 3 seconds). This prevents bots and casual visitors from finding the admin page.
- **Secret Code**: A hash-based check (`js/auth-gate.js`) exists, but is not exposed in the current UI.
- **Password Update**: Hash update logic exists in `auth-gate.js`, but no UI flow currently exposes it.

### 2. Personal Access Token (PAT)
The real security layer is the GitHub PAT.
- **Persistent (Encrypted)**: The token is stored in `localStorage` (encrypted).
- **Scope**: Use **Fine‑grained PAT** with **Contents: Read and write** (plus Metadata).  
  If using classic PAT, scope must be **repo**.
- **No Hardcoding**: The token is NEVER written to files or logged.

### 3. Data Privacy
There is no automatic privacy filtering in the renderer today.
- **Sensitive Data**: Keep sensitive fields out of `data/cv.json` or store them in private documents.
- **Visibility**: A `visibility` attribute may exist in data, but `cv-render.js` does not currently filter by it.

## 🛠 Module Responsibility Map (Contracts)

Each module has a strict contract to prevent architectural drift.

| Module | File | Allowed Actions | Strictly Forbidden |
| :--- | :--- | :--- | :--- |
| **CV Render** | `cv-render.js` | Fetch local JSON; DOM manipulation for display. | **NO** `fetch` to GitHub API; **NO** write operations. |
| **GitHub API** | `github-api.js` | `fetch` to `api.github.com`; JSON encoding. | **NO** DOM access; **NO** `window`/`document` references. |
| **Config UI** | `config-ui.js` | Form generation; Event handling; Calling `github-api`. | **NO** direct GitHub `fetch` calls. |
| **Auth Gate** | `auth-gate.js` | Crypto operations for hashing; Session management. | **NO** data modification; **NO** DOM manipulation. |
| **Self Check** | `self-check.js` | Static analysis of other files via Regex. | **NO** runtime side-effects. |

## 📐 Why No Backend?
This project is designed for **maximum portability and zero cost**.
- **Portability**: You can fork this repo and have it running in 1 minute.
- **Zero Cost**: Hosting on GitHub Pages is free.
- **Simplicity**: No database to maintain, no server to patch.

## ⚠️ What NOT to do
- **Do not try to hide the JavaScript**: Ofuscation only makes debugging harder; it doesn't add real security.
- **Token persistence**: Current implementation uses encrypted `localStorage` for PAT persistence. If you prefer session‑only behavior, adjust `auth-gate.js`.
- **Encryption**: Sensitive storage (PAT, admin session flag, admin hash) is encrypted client‑side (AES‑GCM).
- **Do not remove SPEC.md**: This file is the "Law" of the project. Any change in logic must first be reflected there.
