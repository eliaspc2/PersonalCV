import { renderFoundation } from '../js/cv-render.js';

export const pageMeta = {
    id: 'foundation',
    title: 'Fundação'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderFoundation(data, container, sectionId || pageMeta.id);
}
