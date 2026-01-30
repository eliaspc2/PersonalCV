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

### GitHub Personal Access Token (PAT)
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
1. Once authenticated, the UI will load your current `data/cv.json` and `data/config.json`.
2. Edit the fields in the form.
3. The **Navegação** (nome/ícone) aparece no topo de cada secção.
4. Os ícones podem ser escolhidos via **picker** (não é necessário escrever emojis).
5. Os **Downloads** são editados dentro de **Contacto** e abrem no leitor do site.
6. Cada secção tem **CTA label** + **CTA link** (podes apontar para mailto, tel, GitHub, etc.).
7. Podes criar novas secções com **+ Adicionar secção** (usa templates existentes).
8. Click **Guardar alterações** (guarda `cv.json` + `config.json`).

### Traduções (i18n)
- Os ficheiros `data/i18n/*.json` são opcionais.
- Se estiverem vazios, o site usa os textos do `cv.json`.
- Quando começar a preencher, as chaves são do tipo `overview.headline`, `contact.cta_label`, etc.

## 5. Export / Import
- **Exportar JSON** gera um bundle completo (`site-bundle.json`) com `cv`, `config` e `i18n`.
- **Importar JSON** aceita:
  - `site-bundle.json` (restaura tudo)
  - `cv.json` simples (compatibilidade)

## 6. Verifying Changes
- After clicking "Save", the app makes a commit to your repo.
- **Local**: If you are running locally and have synced your repo, you will see `data/cv.json` update.
- **Production (GitHub Pages)**: Pode demorar até ~10 minutos para refletir. Atualiza o browser para ver as mudanças.

---

## 🛠 Troubleshooting
- **Token Error**: Ensure your PAT has **Contents: Read and write** (fine‑grained) or **repo** scope (classic).
- **Changes not showing**: Check the "Actions" tab in your GitHub repository to see if the Pages build failed.
- **Browser Console**: Press `F12` to see the "Self-Check" log. If any rules are broken, it will be highlighted there.
