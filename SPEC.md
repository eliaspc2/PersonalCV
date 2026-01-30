# SPEC.md - Project Specification & Source of Truth

## 1. Project Objective
Develop a personal CV website hosted on GitHub Pages, consisting of:
- **Public CV**: Static frontend displaying the CV data.
- **Config Interface (Admin UI)**: Controlled access static frontend to edit CV data.
- **Data Source**: `data/cv.json` (content), `data/config.json` (behavior), `data/i18n/*.json` (optional translations).

**Constraints**:
- No backend.
- No database.
- Persistence via GitHub REST API.
- 100% static, browser-executable.

## 2. Architecture & File Structure (Canon)
This structure is mandatory.

```
/
├── index.html              # Public CV
├── config.html             # Config Interface (Private)
├── SPEC.md                 # Project Specification (Source of Truth)
├── RULES.json              # Machine-readable rules
├── _sources/               # Optional archive (may be empty)
│   └── INDEX.md            # Map of source files to CV data (if used)
├── data/
│   ├── cv.json             # Content structure + values
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
│   ├── cv-render.js        # CV Rendering Logic
│   ├── config-ui.js        # Config UI Logic
│   ├── github-api.js       # GitHub REST API Interaction
│   ├── auth-gate.js        # Access Gate (Secret Code + Token)
│   ├── crypto-utils.js     # Encrypted storage helpers
│   └── self-check.js       # Invariant validation script
├── css/
│   └── styles.css
├── assets/
│   ├── photos/             # Section images
│   ├── icons/              # Favicons/app icons
│   └── downloads/          # Downloadable files
└── README.md               # Documentation
```

## 3. Module Contracts
**Strict separation of concerns.**

| Module | Responsibilities | Restrictions |
| :--- | :--- | :--- |
| `cv-render.js` | Reads `cv.json` & renders HTML. | NEVER writes to GitHub. NEVER accesses `config-ui` logic. |
| `config-ui.js` | Manages forms, validation, and save flow. | NEVER calls GitHub API directly (uses `github-api.js`). |
| `github-api.js` | Handles all GitHub REST API calls (GET/PUT). | Does NOT know about DOM or UI specific elements. |
| `auth-gate.js` | Manages access (secret hash) & token storage (encrypted). | Does NOT modify CV data. |
| `self-check.js` | Validates project rules against `RULES.json`. | formatting/linting/runtime checks only. |

## 4. Data Rules (Source of Truth)
- `data/cv.json` holds **content** (structure + values).
- `data/config.json` holds **behavior/config** (paths, theme, meta).
- `data/i18n/*.json` holds **translations** (key/value). If empty, fallback to `cv.json`.
- Public CV reads `cv.json` + `config.json` + `i18n`.
- Config UI edits both `cv.json` and `config.json` and commits changes via API.

**`cv.json` Schema (current)**:
- `meta`: Versioning + language control (`version`, `lastUpdated`, `defaultLanguage`, `availableLanguages`).
- `meta.custom_sections`: Optional array of `{ id, type }` to define extra sections based on existing templates.
- `profile`: Assets and identity links (photos, social, downloads).
- `profile.downloads`: Array of `{ label, icon, href, group }` items.
- `localized`: Object keyed by language code, each with:
  - `navigation`: UI labels for sections.
  - `navigation_icons`: Emoji overrides per section (optional).
  - `overview`, `development`, `foundation`, `mindset`, `now`, `contact`: Section content consumed by `cv-render.js`.
- `contact.download_groups`: Optional array of `{ id, label, open_in_new_tab, icon? }` for grouping downloads.
- Section-level CTA fields: `cta_label`, `cta_link`.
- `ui`: Shared UI copy and labels used across renderers.
- Provenance mapping lives in `_sources/INDEX.md`.

**Validation**:
- `schema/cv.schema.json` + `validators/*` are mandatory.
- Public site blocks render on critical errors with a fallback UI.

## 5. Authentication Model
- **No real backend authentication.**
- **Write Access**: Via GitHub Personal Access Token (PAT).
- **Token Storage**: `localStorage`, **encrypted** (no plain‑text tokens).
- **Access Gate**:
    - Access `config.html` via discrete trigger (3 clicks on the sidebar profile photo within 3 seconds).
    - Secret Code check exists in `auth-gate.js` but is not exposed in the current UI.
    - GitHub PAT is entered inside the Admin UI panel.
- **Flow**:
    - No Token -> Read-only (Public view).
    - Invalid Token -> Block UI / Error.
    - Valid Token -> Allow `PUT` operations via API.

## 6. Config Interface (Admin UI)
- Separate from Public CV view.
- Clear structured forms for JSON editing.
- Includes a lightweight preview panel (text + hierarchy).
- **Save** button triggers explicit commit to GitHub (cv + config).
- No automatic commits.

## 7. Programming Standards
- **Style**: Modern JavaScript (ES2020+).
- **Functions**: Small, pure functions where possible.
- **Conventions**: `camelCase` for JS variables/functions, `kebab-case` for filenames.
- **Forbidden**:
    - Code duplication.
    - Inline logic inside static HTML files (except the minimal Service Worker registration in `index.html`).
    - Direct DOM manipulation without abstraction (in core logic).
    - Global variables (unnecessary ones).

## 8. Limitations (Accepted)
- JS code is public.
- Security relies on Token + Obscurity.
- No backend features (server-side validation, database indexing).
- Client‑side encryption for storage (AES‑GCM) to avoid plain‑text tokens.

## 9. Criteria of Success
- Works on GitHub Pages.
- CV updates automatically after commit from Config UI.
- Config UI edits CV without touching code.
- No mixing of responsibilities (Contracts enforced).
