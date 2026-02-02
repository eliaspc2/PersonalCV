import { renderHighlights } from '../js/cv-render.js';

export const pageMeta = {
    id: 'highlights',
    title: 'Destaques'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderHighlights(data, container, sectionId || pageMeta.id);
}
