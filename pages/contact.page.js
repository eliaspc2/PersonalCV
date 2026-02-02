import { renderContact } from '../js/cv-render.js';

export const pageMeta = {
    id: 'contact',
    title: 'Contacto'
};

export function renderPage(context) {
    const { data, container, sectionId, lang } = context || {};
    if (!data || !container) return;
    const fallbackLang = data?.meta?.defaultLanguage || 'pt';
    const locale = data?.localized?.[lang || fallbackLang] || data?.localized?.[fallbackLang] || {};
    renderContact(data, locale, container, sectionId || pageMeta.id);
}
