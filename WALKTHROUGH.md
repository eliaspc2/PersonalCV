# WALKTHROUGH.md - User Guide

This guide explains how to run, access, and manage your Static CV project.

## 1. Running Locally
Because this project uses ES Modules, you cannot open the HTML files directly (file protocol). You must serve them via a local web server.

### Option A: Python (Built-in on most systems)
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.

### Option B: Node.js
```bash
npx serve .
```

## 2. Accessing the Admin UI
The configuration page is hidden to prevent accidental access.
1. Open your CV (e.g., `index.html` on your server).
2. In the **sidebar header**, click the **profile photo**.
3. **Click 3 times within 3 seconds**.
4. You will be redirected to `config.html`.

## 3. Authentication Flow

### Step 1: Secret Code
Enter the access code to unlock the Admin UI.
- **Default Code**: `admin123` (defined in `js/auth-gate.js`).

### Step 2: GitHub Personal Access Token (PAT)
To save changes, the app needs permission to read/write `data/cv.json` in your repo.
1. Go to **GitHub → Settings → Developer settings → Personal access tokens**.
2. Click **Fine-grained tokens** → **Generate new token** (recommended).
3. Repository access: select **Only select repositories** and pick `PersonalCV` (or **All repositories**).
4. Permissions → Repository permissions:
   - **Contents: Read and write** (required)
   - **Metadata: Read-only** (required by GitHub)
5. Generate the token, copy it, and paste it into **GitHub PAT** in the Admin UI.
6. Enter your **Repository Owner** (username) and **Repository Name** if they are not auto-detected.

Alternative (classic token):
1. Go to **GitHub → Settings → Developer settings → Personal access tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Select **repo** scope (required for read/write).
4. Generate and paste into **GitHub PAT** in the Admin UI.

## 4. Editing the CV
1. Once authenticated, the UI will load your current `data/cv.json`.
2. Edit the fields in the form.
3. If a field includes a `visibility` property, a Public/Private toggle appears.
4. Click **Save Changes (Commit)**.

## 5. Verifying Changes
- After clicking "Save", the app makes a commit to your repo.
- **Local**: If you are running locally and have synced your repo, you will see `data/cv.json` update.
- **Production (GitHub Pages)**: Wait approximately 1-3 minutes for GitHub to rebuild the site. Refresh your browser to see the updates.

---

## 🛠 Troubleshooting
- **Token Error**: Ensure your PAT has **Contents: Read and write** (fine‑grained) or **repo** scope (classic).
- **Changes not showing**: Check the "Actions" tab in your GitHub repository to see if the Pages build failed.
- **Browser Console**: Press `F12` to see the "Self-Check" log. If any rules are broken, it will be highlighted there.
