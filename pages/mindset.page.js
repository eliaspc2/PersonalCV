import { renderMindset } from '../js/cv-render.js';

// Config dependencies (not read here):
// - meta.sections[].hidden (visibility)
// - meta.section_order / meta.sections (order)
// - localized.*.navigation / navigation_icons (menu label + icon)
// - localized.*.mindset.cta_label / cta_link (CTA)
// - localized.*.ui.explore_mindset_label (card CTA label)
// - theme/layout in config.json (global visual rules)

export const pageMeta = {
    id: 'mindset',
    title: 'Mentalidade'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderMindset(data, container, sectionId || pageMeta.id);
}
