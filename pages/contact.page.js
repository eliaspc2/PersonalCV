import { renderContact } from '../js/cv-render.js';

export const pageMeta = {
    id: 'contact',
    title: 'Contacto'
};

export function renderPage(context) {
    const { data, container, sectionId, locale } = context || {};
    if (!data || !container) return;
    renderContact(data, locale, container, sectionId || pageMeta.id);
}
