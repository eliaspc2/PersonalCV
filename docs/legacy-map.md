# Legacy Map (index2 isolation)

Date: 2026-02-02

## Scope
- New pipeline: `js/main-new.js` + `pages/*` + `core/*` + `data/site-config.json`
- Legacy pipeline: `js/cv-render.js` + `data/config.json`

## Legacy code not used by index2

### Legacy entrypoint
- `js/cv-render.js`
  - Entire file is legacy renderer and event wiring.
  - Used by `index.html` only.
  - Not imported by `js/main-new.js`.

### Legacy config
- `data/config.json`
  - Used by legacy renderer (`js/cv-render.js`).
  - New pipeline uses `data/site-config.json` only.

### Legacy admin UI
- `config.html`
- `js/config-ui.js`
  - Admin/config tool for legacy flow.
  - Not used by index2 runtime.

### Legacy auth/tools
- `js/auth-gate.js`
- `js/crypto-utils.js`
  - Used by admin/config UI.
  - Not used by index2 runtime.

### Legacy schema validators (runtime)
- `validators/schema-validate.js`
- `validators/cv-consistency.js`
- `validators/error-messages.js`
  - Used by legacy runtime and admin UI.
  - Not used by index2 runtime.

### Legacy preview tooling
- `core/preview-gesture.js`
- `core/shadow-render.js`
  - Preview tooling for legacy flow.
  - Not used by index2 runtime.

### Legacy service worker config
- `sw.js` still precaches legacy assets for `index.html`.
  - New pipeline uses same SW but ignores legacy at runtime.

## Notes
- No files removed.
- No behavioral changes applied.
- Legacy site remains intact via `index.html`.
