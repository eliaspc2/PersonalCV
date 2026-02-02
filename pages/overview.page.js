import { renderOverview } from '../js/cv-render.js';

export const pageMeta = {
    id: 'overview',
    title: 'Identidade'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderOverview(data, container, sectionId || pageMeta.id);
}
