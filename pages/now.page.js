import { renderNow } from '../js/cv-render.js';

// Config dependencies (not read here):
// - meta.sections[].hidden (visibility)
// - meta.section_order / meta.sections (order)
// - localized.*.navigation / navigation_icons (menu label + icon)
// - localized.*.now.cta_label / cta_link (CTA)
// - localized.*.ui labels used in Now section (if any)
// - theme/layout in config.json (global visual rules)

export const pageMeta = {
    id: 'now',
    title: 'Agora'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderNow(data, container, sectionId || pageMeta.id);
}
