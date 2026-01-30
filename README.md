# Static Personal Narrative with Admin UI

A 100% static narrative profile site with a built-in configuration interface, designed for hosting on GitHub Pages. This project follows a "No-Backend" architecture, leveraging the GitHub REST API for data persistence.

## 🎯 Architecture Overview

The project is built on the concept of **Static Frontend as Admin**. 
- **Persistence**: Content in `data/cv.json`, behavior in `data/config.json`, i18n in `data/i18n/*.json`.
- **Single Source of Truth**: CV content lives in `data/cv.json` (structure + values). Config/i18n are separate.
- **Admin Flow**: A hidden configuration page (`config.html`) allows the user to edit the JSON data and commit changes back to GitHub using a Personal Access Token (PAT).
- **Security**: Access to the config page is obscured (3-click trigger). Write operations require a valid GitHub PAT (stored encrypted in localStorage).

## 📁 Project Structure

```text
/
├── index.html              # Public CV (Main view)
├── config.html             # Admin/Config Interface (Private)
├── SPEC.md                 # Project Specification (Source of Truth)
├── RULES.json              # Machine-readable invariants
├── _sources/               # Optional archive (can be empty)
│   └── INDEX.md            # Mapping of source documents to data (if used)
├── data/
│   ├── cv.json             # Content (structure + values)
│   ├── config.json         # Behavior/config (paths, theme, meta)
│   └── i18n/               # Optional translations (key/value)
│       ├── pt.json
│       ├── es.json
│       └── en.json
├── schema/
│   └── cv.schema.json      # JSON Schema (validation)
├── validators/
│   ├── schema-validate.js  # Schema validation (no backend)
│   ├── cv-consistency.js   # Cross-field/lang checks
│   └── error-messages.js   # Friendly error messages
├── constants/
│   └── ...                 # Shared constants (paths, themes, icons)
├── js/
│   ├── cv-render.js        # Logic: Renders JSON data to HTML (Read-only)
│   ├── config-ui.js        # Logic: Handles Form UI and Save triggers
│   ├── github-api.js       # Logic: Communication with GitHub REST API
│   ├── auth-gate.js        # Logic: Secret code verification & Token management
│   ├── crypto-utils.js     # Logic: Encrypted storage helpers
│   └── self-check.js       # Logic: Invariant validation for development
├── css/
│   └── styles.css          # Shared aesthetics
├── assets/                 # Static assets
│   ├── photos/             # Section images
│   ├── icons/              # Favicons/app icons
│   └── downloads/          # Downloadable files
└── README.md               # Main documentation
```

## 🧠 Core Principles

### 1. Static Nature
The site works entirely in the browser. There is no server-side code (PHP, Node, etc.). GitHub Pages simply serves the files.

### 2. Module Contracts (Strict)
To ensure maintainability, modules follow strict rules defined in `SPEC.md`:
- `cv-render.js` **cannot** call the GitHub API.
- `github-api.js` **cannot** manipulate the DOM.
- `config-ui.js` **must** use `github-api.js` for persistence.

### 3. Data Integrity
Provenance mapping lives in `_sources/INDEX.md`. The renderer does not enforce visibility rules, so keep sensitive data out of `data/cv.json` unless you intend it to be public.
Runtime validation is enforced via `schema/cv.schema.json` + `validators/*` (critical errors show a fallback UI).

## 🛑 Limitations & Accepted Risks
- **Security by Obscurity**: The entry to `config.html` is hidden (3-click trigger), not fully protected.
- **Public Logic**: All JavaScript logic is visible in the browser. Never hardcode sensitive tokens or passwords in the source.
- **Browser-Only**: Persistence depends on the user providing a valid GitHub PAT stored encrypted in localStorage.
- **GitHub Delay**: Changes saved via the Admin UI take 1-3 minutes to reflect on the public site due to GitHub Pages' build process.

## 🚀 Usage
See [WALKTHROUGH.md](./WALKTHROUGH.md) for detailed instructions on how to set up and use the CV.
See [FORK_SETUP.md](./FORK_SETUP.md) for a step‑by‑step guide to forking, GitHub Pages, PAT, OpenAI key, and admin UI access.

## ✨ Admin UI Highlights
- Per‑section navigation (nome + ícone) with SVG icon picker (theme color).
- Image crop/zoom tooling for photo framing.
- Downloads managed inside Contacto with groups and links (viewer inside the site).
- Add new sections using existing templates (visual picker).
- Export/Import bundle (cv + config + i18n) via the Admin UI.
