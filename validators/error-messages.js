const ERROR_MESSAGES = {
    pt: {
        '$.meta.defaultLanguage.required': 'Falta o idioma predefinido (meta.defaultLanguage).',
        '$.meta.availableLanguages.required': 'Falta a lista de idiomas disponíveis (meta.availableLanguages).',
        '$.meta.section_order.required': 'Falta a ordem das secções (meta.section_order).',
        '$.meta.sections.required': 'Falta a lista de secções (meta.sections).',
        '$.localized.required': 'Faltam os conteúdos localizados (localized).',
        '$.localized.navigation.required': 'Falta a navegação (navigation) num idioma.',
        '$.localized.overview.headline.required': 'Falta o título principal da Identidade (overview.headline).',
        '$.localized.overview.intro_text.required': 'Falta o texto introdutório da Identidade (overview.intro_text).',
        '$.localized.development.skills.type': 'Competências (development.skills) deve ser uma lista.',
        '$.localized.foundation.experience.type': 'Experiência (foundation.experience) deve ser uma lista.',
        '$.localized.mindset.blocks.type': 'Blocos de Mentalidade (mindset.blocks) deve ser uma lista.',
        '$.localized.now.summary.required': 'Falta o resumo em Agora (now.summary).',
        '$.localized.contact.cta_label.required': 'Falta o texto do botão CTA em Contacto.',
        '$.localized.contact.cta_link.required': 'Falta o link do CTA em Contacto.'
    },
    es: {
        '$.meta.defaultLanguage.required': 'Falta el idioma por defecto (meta.defaultLanguage).',
        '$.meta.availableLanguages.required': 'Falta la lista de idiomas disponibles (meta.availableLanguages).',
        '$.meta.section_order.required': 'Falta el orden de secciones (meta.section_order).',
        '$.meta.sections.required': 'Falta la lista de secciones (meta.sections).',
        '$.localized.required': 'Faltan contenidos localizados (localized).',
        '$.localized.navigation.required': 'Falta la navegación (navigation) en un idioma.',
        '$.localized.overview.headline.required': 'Falta el título principal de Identidad (overview.headline).',
        '$.localized.overview.intro_text.required': 'Falta el texto introductorio de Identidad (overview.intro_text).',
        '$.localized.development.skills.type': 'Competencias (development.skills) debe ser una lista.',
        '$.localized.foundation.experience.type': 'Experiencia (foundation.experience) debe ser una lista.',
        '$.localized.mindset.blocks.type': 'Bloques de Mentalidad (mindset.blocks) debe ser una lista.',
        '$.localized.now.summary.required': 'Falta el resumen en Ahora (now.summary).',
        '$.localized.contact.cta_label.required': 'Falta el texto del botón CTA en Contacto.',
        '$.localized.contact.cta_link.required': 'Falta el enlace del CTA en Contacto.'
    },
    en: {
        '$.meta.defaultLanguage.required': 'Missing default language (meta.defaultLanguage).',
        '$.meta.availableLanguages.required': 'Missing available languages list (meta.availableLanguages).',
        '$.meta.section_order.required': 'Missing section order (meta.section_order).',
        '$.meta.sections.required': 'Missing sections list (meta.sections).',
        '$.localized.required': 'Missing localized content (localized).',
        '$.localized.navigation.required': 'Missing navigation in a language.',
        '$.localized.overview.headline.required': 'Missing Overview headline (overview.headline).',
        '$.localized.overview.intro_text.required': 'Missing Overview intro text (overview.intro_text).',
        '$.localized.development.skills.type': 'Development skills must be a list.',
        '$.localized.foundation.experience.type': 'Foundation experience must be a list.',
        '$.localized.mindset.blocks.type': 'Mindset blocks must be a list.',
        '$.localized.now.summary.required': 'Missing Now summary (now.summary).',
        '$.localized.contact.cta_label.required': 'Missing Contact CTA label.',
        '$.localized.contact.cta_link.required': 'Missing Contact CTA link.'
    }
};

function fallbackMessage(error, lang) {
    const prefix = lang === 'es'
        ? 'Dato inválido'
        : (lang === 'en' ? 'Invalid data' : 'Dados inválidos');
    if (error.code === 'missing_language') {
        return lang === 'es'
            ? 'Falta un idioma completo en localized.'
            : (lang === 'en' ? 'Missing a full language in localized.' : 'Falta um idioma completo em localized.');
    }
    if (error.code === 'navigation_mismatch') {
        return lang === 'es'
            ? 'La navegación no coincide con las secciones.'
            : (lang === 'en' ? 'Navigation does not match sections.' : 'A navegação não coincide com as secções.');
    }
    if (error.code === 'section_order_mismatch') {
        return lang === 'es'
            ? 'La ordem de secciones no coincide con sections.'
            : (lang === 'en' ? 'Section order does not match sections.' : 'A ordem das secções não coincide com sections.');
    }
    if (error.code === 'missing_section') {
        return lang === 'es'
            ? 'Falta una sección en un idioma.'
            : (lang === 'en' ? 'Missing a section in a language.' : 'Falta uma secção num idioma.');
    }
    if (error.code === 'duplicate_ids') {
        return lang === 'es'
            ? 'IDs duplicados numa lista de cartões.'
            : (lang === 'en' ? 'Duplicate IDs in a card list.' : 'IDs duplicados numa lista de cartões.');
    }
    if (error.code === 'icon_invalid') {
        return lang === 'es'
            ? 'Ícone inválido: não existe no conjunto.'
            : (lang === 'en' ? 'Invalid icon: not in icon set.' : 'Ícone inválido: não existe no conjunto.');
    }
    if (error.code === 'required') {
        return `${prefix}: falta ${error.path}.`;
    }
    if (error.code === 'type') {
        if (error.path.includes('.skills')) {
            return lang === 'es'
                ? 'Competencias debe ser una lista.'
                : (lang === 'en' ? 'Skills must be a list.' : 'Competências devem ser uma lista.');
        }
        if (error.path.includes('.experience')) {
            return lang === 'es'
                ? 'Experiencia debe ser una lista.'
                : (lang === 'en' ? 'Experience must be a list.' : 'Experiência deve ser uma lista.');
        }
        if (error.path.includes('.blocks')) {
            return lang === 'es'
                ? 'Bloques deben ser una lista.'
                : (lang === 'en' ? 'Blocks must be a list.' : 'Blocos devem ser uma lista.');
        }
        return `${prefix}: tipo inválido em ${error.path}.`;
    }
    return `${prefix}: ${error.path}.`;
}

export function formatErrorMessages(errors = [], lang = 'pt') {
    const bundle = ERROR_MESSAGES[lang] || ERROR_MESSAGES.pt;
    return errors.map((error) => {
        const key = `${error.path}.${error.code}`;
        return bundle[key] || fallbackMessage(error, lang);
    });
}
