import { renderPageShadow } from './shadow-render.js';

export function initPreviewGesture({ pageId, data, container, lang, ui, assets, helpers, meta } = {}) {
    const header = document.querySelector('.app-header');
    if (!header) return;

    let taps = [];
    const windowMs = 1500;

    const resolveValue = (value) => (typeof value === 'function' ? value() : value);

    const triggerPreview = () => {
        const resolvedPageId = resolveValue(pageId);
        if (!resolvedPageId) return;
        const context = {
            pageId: resolvedPageId,
            data: resolveValue(data),
            container: resolveValue(container),
            lang: resolveValue(lang),
            ui: resolveValue(ui),
            assets: resolveValue(assets),
            helpers: resolveValue(helpers),
            meta: resolveValue(meta)
        };
        if (!context.container || !context.data) return;
        renderPageShadow(context);
    };

    const onClick = () => {
        const now = Date.now();
        taps = taps.filter((ts) => now - ts <= windowMs);
        taps.push(now);
        if (taps.length >= 3) {
            taps = [];
            triggerPreview();
        }
    };

    header.addEventListener('click', onClick);
}
