import { renderDevelopment } from '../js/cv-render.js';

export const pageMeta = {
    id: 'development',
    title: 'Engenharia'
};

export function renderPage(context) {
    const { data, container, sectionId } = context || {};
    if (!data || !container) return;
    renderDevelopment(data, container, sectionId || pageMeta.id);
}
