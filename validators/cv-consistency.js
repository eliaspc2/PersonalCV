import { isIconId } from '../js/icon-set.js';

function getSectionIds(cv) {
    const sections = Array.isArray(cv?.meta?.sections) ? cv.meta.sections : [];
    return sections.map((section) => section.id).filter(Boolean);
}

function uniqueIds(items = []) {
    const seen = new Set();
    const duplicates = new Set();
    items.forEach((item) => {
        if (!item || !item.id) return;
        if (seen.has(item.id)) duplicates.add(item.id);
        seen.add(item.id);
    });
    return Array.from(duplicates);
}

export function validateConsistency(cv) {
    const critical = [];
    const warnings = [];
    const meta = cv?.meta || {};
    const sectionIds = getSectionIds(cv);
    const sectionOrder = Array.isArray(meta.section_order) ? meta.section_order : [];

    if (sectionIds.length && sectionOrder.length) {
        const missingInOrder = sectionIds.filter((id) => !sectionOrder.includes(id));
        const extraInOrder = sectionOrder.filter((id) => !sectionIds.includes(id));
        if (missingInOrder.length || extraInOrder.length) {
            critical.push({
                path: '$.meta.section_order',
                code: 'section_order_mismatch',
                details: { missingInOrder, extraInOrder }
            });
        }
    }

    const languages = Array.isArray(meta.availableLanguages) ? meta.availableLanguages : [];
    languages.forEach((lang) => {
        const locale = cv?.localized?.[lang];
        if (!locale) {
            critical.push({
                path: `$.localized.${lang}`,
                code: 'missing_language'
            });
            return;
        }
        const nav = locale.navigation || {};
        const missingNav = sectionIds.filter((id) => !Object.prototype.hasOwnProperty.call(nav, id));
        const extraNav = Object.keys(nav).filter((id) => !sectionIds.includes(id));
        if (missingNav.length || extraNav.length) {
            critical.push({
                path: `$.localized.${lang}.navigation`,
                code: 'navigation_mismatch',
                details: { missingNav, extraNav }
            });
        }
        sectionIds.forEach((id) => {
            if (!locale[id]) {
                critical.push({
                    path: `$.localized.${lang}.${id}`,
                    code: 'missing_section'
                });
            }
        });
    });

    const checkCards = (sectionKey, key) => {
        languages.forEach((lang) => {
            const list = cv?.localized?.[lang]?.[sectionKey]?.[key];
            if (Array.isArray(list)) {
                const dupes = uniqueIds(list);
                if (dupes.length) {
                    critical.push({
                        path: `$.localized.${lang}.${sectionKey}.${key}`,
                        code: 'duplicate_ids',
                        details: { ids: dupes }
                    });
                }
                list.forEach((item, index) => {
                    if (item?.icon && !isIconId(item.icon)) {
                        warnings.push({
                            path: `$.localized.${lang}.${sectionKey}.${key}[${index}].icon`,
                            code: 'icon_invalid'
                        });
                    }
                });
            }
        });
    };

    checkCards('development', 'skills');
    checkCards('foundation', 'experience');
    checkCards('mindset', 'blocks');

    return { critical, warnings };
}
