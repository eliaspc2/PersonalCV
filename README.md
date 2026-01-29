# Static Personal Narrative with Admin UI

A 100% static narrative profile site with a built-in configuration interface, designed for hosting on GitHub Pages. This project follows a "No-Backend" architecture, leveraging the GitHub REST API for data persistence.

## 🎯 Architecture Overview

The project is built on the concept of **Static Frontend as Admin**. 
- **Persistence**: All data is stored in a `cv.json` file within the repository.
- **Single Source of Truth**: The `data/cv.json` file is the ONLY place where CV content lives.
- **Admin Flow**: A hidden configuration page (`config.html`) allows the user to edit the JSON data and commit changes back to GitHub using a Personal Access Token (PAT).
- **Security**: Access to the config page is obscured, and write operations require a valid GitHub PAT (never stored permanently).

## 📁 Project Structure

```text
/
├── index.html              # Public CV (Main view)
├── config.html             # Admin/Config Interface (Private)
├── SPEC.md                 # Project Specification (Source of Truth)
├── RULES.json              # Machine-readable invariants
├── _sources/               # Immutable raw source documents (PDF/PNG)
│   └── INDEX.md            # Mapping of source documents to data
├── data/
│   └── cv.json             # Content Source of Truth
├── js/
│   ├── cv-render.js        # Logic: Renders JSON data to HTML (Read-only)
│   ├── config-ui.js        # Logic: Handles Form UI and Save triggers
│   ├── github-api.js       # Logic: Communication with GitHub REST API
│   ├── auth-gate.js        # Logic: Secret code verification & Token management
│   └── self-check.js       # Logic: Invariant validation for development
├── css/
│   └── styles.css          # Shared aesthetics
├── assets/                 # Static assets (images, icons)
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

## 🛑 Limitations & Accepted Risks
- **Security by Obscurity**: The "Secret Code" gate is a logic barrier, not cryptographic protection.
- **Public Logic**: All JavaScript logic is visible in the browser. Never hardcode sensitive tokens or passwords in the source.
- **Browser-Only**: Persistence depends on the user providing a valid GitHub PAT in the session.
- **GitHub Delay**: Changes saved via the Admin UI take 1-3 minutes to reflect on the public site due to GitHub Pages' build process.

## 🚀 Usage
See [WALKTHROUGH.md](./WALKTHROUGH.md) for detailed instructions on how to set up and use the CV.
