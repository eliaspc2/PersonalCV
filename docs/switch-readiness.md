# Switch Readiness Checklist (index ↔ index2)

Date: 2026-02-02

## 1) Asset paths
- [x] Photos: resolved via `paths.photos` or default `assets/photos/`.
- [x] Downloads: resolved via `paths.downloads` or default `assets/downloads/`.
- [x] Icons: resolved via `paths.icons` or default `assets/icons/`.
- [x] index2 uses same base assets as index.

## 2) Service worker
- [x] `sw.js` precaches `index2.html` and `js/main-new.js`.
- [x] `sw.js` keeps legacy precache (index.html) intact.
- [x] JSON is fetched network-first, avoiding stale config.

## 3) SEO / meta
- [x] index2 uses same meta tags as index.
- [x] title/description/favicon are updated at runtime from site-config.json.

## 4) Fallback de idioma
- [x] main-new.js defaults to `cv.meta.defaultLanguage`.
- [x] If missing, falls back to `pt`.

## 5) Isolation
- [x] index2 uses only new pipeline (js/main-new.js).
- [x] No legacy import in main-new.js.
- [x] index.html remains legacy.

## 6) Rollback plan
- [x] Switch = rename `index2.html` → `index.html`.
- [x] Rollback = rename back.

## Result
Ready to switch by file rename only.
