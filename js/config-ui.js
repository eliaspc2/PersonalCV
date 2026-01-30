/**
 * config-ui.js
 * Admin UI for CV management.
 */

import * as auth from './auth-gate.js';
import * as gh from './github-api.js';
import { setSecureItem, getSecureItem, removeSecureItem } from './crypto-utils.js';

const uiNodes = {
    editor: document.getElementById('editor-ui'),
    editorForm: document.getElementById('section-editor'),
    previewPane: document.getElementById('preview-pane'),
    saveBtn: document.getElementById('save-btn'),
    backBtn: document.getElementById('back-btn'),
    msgBox: document.getElementById('message-box'),
    loading: document.getElementById('loading-overlay'),
    langButtons: document.getElementById('lang-buttons'),
    sectionButtons: document.getElementById('section-buttons'),
    translateBtn: document.getElementById('translate-btn'),
    loadBtn: document.getElementById('load-btn'),
    restoreBtn: document.getElementById('restore-btn'),
    restoreFile: document.getElementById('restore-file'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importJsonFile: document.getElementById('import-json-file'),
    ghToken: document.getElementById('gh-token'),
    repoOwner: document.getElementById('repo-owner'),
    repoName: document.getElementById('repo-name'),
    openaiKey: document.getElementById('openai-key'),
    adminLock: null,
    adminPassCurrent: null,
    adminPassNew: null,
    adminPassConfirm: null,
    adminPassUpdate: null
};

const SECTION_LABELS = {
    overview: { pt: 'Identidade', es: 'Identidad', en: 'Identity' },
    development: { pt: 'Engenharia', es: 'Ingeniería', en: 'Engineering' },
    foundation: { pt: 'Fundação', es: 'Fundación', en: 'Foundation' },
    mindset: { pt: 'Mentalidade', es: 'Mentalidad', en: 'Mindset' },
    now: { pt: 'Agora', es: 'Ahora', en: 'Now' },
    contact: { pt: 'Contacto', es: 'Contacto', en: 'Contact' }
};

const LANGS = ['pt', 'es', 'en'];
const OPENAI_KEY_STORAGE = 'openai_api_key';
const REPO_OWNER_STORAGE = 'repo_owner';
const REPO_NAME_STORAGE = 'repo_name';
const PREVIEW_STORAGE = 'preview_cv';
const PREVIEW_SECTION_MAP = {};

let currentCV = null;
let currentSHA = null;
let currentLang = 'pt';
let currentSection = 'overview';
let repoInfo = { owner: '', repo: '', path: 'data/cv.json' };
let currentSource = 'local';
let currentStoryIndex = 0;
let currentDownloadGroupIndex = 0;
let cropperState = null;
const pendingDownloadDeletes = new Set();
let emojiPickerState = null;

const BASE_SECTIONS = ['overview', 'development', 'foundation', 'mindset', 'now', 'contact'];
const NAV_SECTIONS = new Set(BASE_SECTIONS);
const DEFAULT_PATHS = {
    photos: 'assets/photos/',
    downloads: 'assets/downloads/',
    icons: 'assets/icons/'
};
const EMOJI_CHOICES = [
    '🏠', '🧭', '🧠', '🧩', '🧱', '⚙️', '🛠️', '🧪', '🧰', '📚',
    '📌', '📍', '📎', '📝', '📄', '📂', '📁', '🗂️', '🧾', '🔖',
    '🌐', '💡', '🚀', '✨', '⭐', '🔥', '💬', '☎️', '✉️', '🔗',
    '🏆', '🎓', '🧑‍🍳', '🍞', '🍕', '🗳️', '🛡️', '🧘', '📷', '👤'
];

const NAV_DEFAULT_ICONS = {
    overview: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/></svg>`,
    development: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/></svg>`,
    foundation: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"8\" rx=\"2\" ry=\"2\"/><rect x=\"2\" y=\"14\" width=\"20\" height=\"8\" rx=\"2\" ry=\"2\"/><line x1=\"6\" y1=\"6\" x2=\"6.01\" y2=\"6\"/><line x1=\"6\" y1=\"18\" x2=\"6.01\" y2=\"18\"/></svg>`,
    mindset: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/></svg>`,
    now: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><path d=\"M3 12h7l2 3h9\"/><path d=\"M3 12l2-3h6\"/><circle cx=\"19\" cy=\"12\" r=\"2\"/></svg>`,
    contact: `<svg class=\"nav-icon\" viewBox=\"0 0 24 24\"><path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"/><polyline points=\"22,6 12,13 2,6\"/></svg>`
};

const SECTION_FIELD_ORDER = {
    overview: [
        'headline',
        'location',
        'intro_text',
        'bio',
        'marketing_note',
        'languages_label',
        'languages',
        'education_label',
        'education',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    development: [
        'title',
        'description',
        'image',
        'image_alt',
        'image_position',
        'image_zoom',
        'skills',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    foundation: [
        'title',
        'description',
        'image',
        'image_alt',
        'image_position',
        'image_zoom',
        'experience',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    mindset: [
        'title',
        'subtitle',
        'philosophy',
        'adoption',
        'blocks',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    now: [
        'title',
        'summary',
        'details',
        'image',
        'image_alt',
        'image_position',
        'image_zoom',
        'cta_label',
        'cta_link'
    ],
    contact: [
        'email_label',
        'title',
        'description',
        'cta_label',
        'cta_link',
        'download_groups',
        'downloads_title',
        'certifications_title',
        'linkedin_label',
        'github_label'
    ]
};

const STORY_FIELD_ORDER = {
    skills: [
        'title',
        'focus_area',
        'progress_status',
        'duration_hours',
        'context_text',
        'background',
        'resource',
        'competencies',
        'technologies'
    ],
    experience: [
        'company_name',
        'role_title',
        'timeframe',
        'summary_text',
        'intro_quote',
        'details_text',
        'challenge_text',
        'key_learning_text',
        'present_link',
        'technologies'
    ],
    mindset: [
        'id',
        'icon',
        'title',
        'image',
        'image_position',
        'image_zoom',
        'principle_title',
        'story_text',
        'engineering_note'
    ]
};

const SECTION_TEMPLATES = [
    { type: 'overview', name: { pt: 'Hero & Identidade', es: 'Hero & Identidad', en: 'Hero & Identity' } },
    { type: 'development', name: { pt: 'Grelha de Competências', es: 'Malla de Competencias', en: 'Skill Grid' } },
    { type: 'foundation', name: { pt: 'Timeline Técnica', es: 'Timeline Técnica', en: 'Technical Timeline' } },
    { type: 'mindset', name: { pt: 'Cards & Filosofia', es: 'Cards & Filosofía', en: 'Cards & Philosophy' } },
    { type: 'now', name: { pt: 'Imagem + Call-to-Action', es: 'Imagen + CTA', en: 'Image + Call-to-Action' } },
    { type: 'contact', name: { pt: 'Contacto Central', es: 'Contacto Central', en: 'Centered Contact' } }
];

function normalizeFileName(name) {
    return name ? name.replace(/\s+/g, '-').toLowerCase() : 'image';
}

function slugifyLabel(label) {
    return String(label || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'secao';
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function getSectionsMeta() {
    if (!currentCV?.meta) return [];
    if (!Array.isArray(currentCV.meta.sections)) {
        const legacyCustom = Array.isArray(currentCV.meta.custom_sections)
            ? currentCV.meta.custom_sections
            : [];
        if (Array.isArray(currentCV.meta.section_order) && currentCV.meta.section_order.length) {
            const types = currentCV.meta.section_types || {};
            currentCV.meta.sections = currentCV.meta.section_order.map((id) => ({
                id,
                type: types[id] || id
            }));
        } else if (currentCV.meta.section_types && typeof currentCV.meta.section_types === 'object') {
            currentCV.meta.sections = Object.entries(currentCV.meta.section_types).map(([id, type]) => ({ id, type }));
        } else {
            currentCV.meta.sections = [
                ...BASE_SECTIONS.map((id) => ({ id, type: id })),
                ...legacyCustom.map((section) => ({ id: section.id, type: section.type }))
            ];
        }
    }
    return currentCV.meta.sections;
}

function getCustomSections() {
    const sections = getSectionsMeta();
    return sections.filter((section) => !BASE_SECTIONS.includes(section.id));
}

function getSectionType(sectionKey) {
    const sections = getSectionsMeta();
    const match = sections.find((section) => section.id === sectionKey);
    return match?.type || null;
}

function normalizeBasePath(value, fallback) {
    const base = value || fallback;
    if (!base) return '';
    return base.endsWith('/') ? base : `${base}/`;
}

function getPaths() {
    if (!currentCV) return { ...DEFAULT_PATHS };
    if (!currentCV.paths) currentCV.paths = { ...DEFAULT_PATHS };
    currentCV.paths.photos = normalizeBasePath(currentCV.paths.photos, DEFAULT_PATHS.photos);
    currentCV.paths.downloads = normalizeBasePath(currentCV.paths.downloads, DEFAULT_PATHS.downloads);
    currentCV.paths.icons = normalizeBasePath(currentCV.paths.icons, DEFAULT_PATHS.icons);
    return currentCV.paths;
}

function resolveAssetPath(type, value) {
    if (!value) return '';
    const text = String(value);
    if (/^(https?:|data:|mailto:|tel:)/.test(text)) return text;
    if (text.includes('/')) return text;
    const paths = getPaths();
    return `${paths[type] || ''}${text}`;
}

function stripAssetBase(type, value) {
    if (!value) return value;
    const text = String(value);
    const base = getPaths()[type] || '';
    return text.startsWith(base) ? text.slice(base.length) : text;
}

function normalizeAssetPaths() {
    if (!currentCV) return;
    const paths = getPaths();
    if (currentCV.meta) {
        if (currentCV.meta.favicon) currentCV.meta.favicon = stripAssetBase('icons', currentCV.meta.favicon);
        if (currentCV.meta.apple_icon) currentCV.meta.apple_icon = stripAssetBase('icons', currentCV.meta.apple_icon);
    }
    if (currentCV.profile) {
        if (currentCV.profile.photo_position === undefined) currentCV.profile.photo_position = 'center 20%';
        if (currentCV.profile.photo_zoom === undefined) currentCV.profile.photo_zoom = 1;
        if (currentCV.profile.contact_photo_position === undefined) currentCV.profile.contact_photo_position = 'center 20%';
        if (currentCV.profile.contact_photo_zoom === undefined) currentCV.profile.contact_photo_zoom = 1;
        Object.keys(currentCV.profile).forEach((key) => {
            if (typeof currentCV.profile[key] !== 'string') return;
            if (key.endsWith('photo') || key.endsWith('_photo') || key === 'photo' || key === 'work_photo') {
                currentCV.profile[key] = stripAssetBase('photos', currentCV.profile[key]);
            }
        });
        if (Array.isArray(currentCV.profile.downloads)) {
            currentCV.profile.downloads.forEach((item) => {
                if (item?.href) item.href = stripAssetBase('downloads', item.href);
            });
        }
    }
    if (currentCV.localized) {
        Object.values(currentCV.localized).forEach((locale) => {
            if (!locale || typeof locale !== 'object') return;
            if (Array.isArray(locale.certifications)) {
                locale.certifications.forEach((cert) => {
                    if (cert?.href) cert.href = stripAssetBase('downloads', cert.href);
                });
            }
            Object.values(locale).forEach((section) => {
                if (!section || typeof section !== 'object') return;
                Object.entries(section).forEach(([key, val]) => {
                    if (typeof val === 'string') {
                        if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                            section[key] = stripAssetBase('photos', val);
                        }
                        if ((key === 'favicon' || key === 'apple_icon') && val) {
                            section[key] = stripAssetBase('icons', val);
                        }
                    }
                });
                if (section.image_position === undefined) section.image_position = 'center 20%';
                if (section.image_zoom === undefined) section.image_zoom = 1;
                if (Array.isArray(section.skills)) {
                    section.skills.forEach((item) => {
                        if (item?.resource?.href) item.resource.href = stripAssetBase('downloads', item.resource.href);
                    });
                }
                if (Array.isArray(section.experience)) {
                    section.experience.forEach((item) => {
                        if (item?.resource?.href) item.resource.href = stripAssetBase('downloads', item.resource.href);
                    });
                }
                if (Array.isArray(section.blocks)) {
                    section.blocks.forEach((item) => {
                        if (item?.image) item.image = stripAssetBase('photos', item.image);
                    });
                }
                if (section.adoption?.image) {
                    section.adoption.image = stripAssetBase('photos', section.adoption.image);
                }
            });
        });
    }
}

function ensureSectionDefinitions() {
    if (!currentCV?.localized) return;
    const sections = getSectionsMeta();
    currentCV.meta.custom_sections = sections.filter((section) => !BASE_SECTIONS.includes(section.id));
    currentCV.meta.section_types = sections.reduce((acc, section) => {
        acc[section.id] = section.type;
        return acc;
    }, {});
    LANGS.forEach((lang) => {
        if (!currentCV.localized[lang]) currentCV.localized[lang] = {};
        const locale = currentCV.localized[lang];
        const { nav, icons } = ensureNavigationConfig(locale);
        sections.forEach((section) => {
            if (!Object.prototype.hasOwnProperty.call(nav, section.id)) {
                nav[section.id] = SECTION_LABELS[section.type]?.[lang] || section.id;
            }
            if (!Object.prototype.hasOwnProperty.call(icons, section.id)) {
                icons[section.id] = '';
            }
            if (!locale[section.id]) {
                locale[section.id] = createEmptySection(section.type);
            }
        });
    });
}

function removeSection(sectionId) {
    if (!sectionId || !currentCV?.meta) return;
    const sections = getSectionsMeta();
    if (sections.length <= 1) return;
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) return;
    sections.splice(index, 1);
    if (Array.isArray(currentCV.meta.custom_sections)) {
        currentCV.meta.custom_sections = currentCV.meta.custom_sections.filter((section) => section.id !== sectionId);
    }
    if (currentCV.meta.section_types && currentCV.meta.section_types[sectionId]) {
        delete currentCV.meta.section_types[sectionId];
    }

    if (currentCV.localized) {
        Object.values(currentCV.localized).forEach((locale) => {
            if (!locale) return;
            if (locale.navigation && locale.navigation[sectionId]) {
                delete locale.navigation[sectionId];
            }
            if (locale.navigation_icons && locale.navigation_icons[sectionId]) {
                delete locale.navigation_icons[sectionId];
            }
            if (locale[sectionId]) {
                delete locale[sectionId];
            }
        });
    }

    if (currentSection === sectionId) {
        const nextList = getSectionList();
        currentSection = nextList.length ? nextList[0].id : sections[0]?.id;
    }

    renderSidebar();
    renderSectionEditor();
    renderPreview();
}

function moveSection(sectionId, direction) {
    if (!currentCV?.meta) return;
    const sections = getSectionsMeta();
    const index = sections.findIndex((section) => section.id === sectionId);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    currentCV.meta.sections = updated;
    renderSidebar();
    renderPreview();
}

function getOrderedEntries(sectionKey, content) {
    if (!content || typeof content !== 'object') return [];
    const sectionType = getSectionType(sectionKey);
    const order = SECTION_FIELD_ORDER[sectionType] || [];
    const seen = new Set();
    const entries = [];
    order.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(content, key)) {
            entries.push([key, content[key]]);
            seen.add(key);
        }
    });
    Object.keys(content).forEach((key) => {
        if (!seen.has(key)) {
            entries.push([key, content[key]]);
        }
    });
    return entries;
}

function getStoryOrderedKeys(type, item) {
    if (!item || typeof item !== 'object') return [];
    const order = STORY_FIELD_ORDER[type] || [];
    const seen = new Set();
    const keys = [];
    order.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
            keys.push(key);
            seen.add(key);
        }
    });
    Object.keys(item).forEach((key) => {
        if (!seen.has(key)) keys.push(key);
    });
    return keys;
}

function getStoryFieldLabel(type, key) {
    const skillMap = {
        title: 'Título do cartão',
        focus_area: 'Área de foco',
        progress_status: 'Estado',
        duration_hours: 'Duração',
        context_text: 'Contexto',
        background: 'Histórico',
        resource: 'Recurso',
        competencies: 'Competências (pop-up)',
        technologies: 'Tecnologias'
    };
    const expMap = {
        company_name: 'Empresa',
        role_title: 'Função',
        timeframe: 'Período',
        summary_text: 'Resumo curto',
        intro_quote: 'Citação',
        details_text: 'Descrição',
        challenge_text: 'Desafio',
        key_learning_text: 'Aprendizagem',
        present_link: 'Link',
        technologies: 'Tecnologias'
    };
    const mindsetMap = {
        id: 'ID',
        icon: 'Ícone',
        title: 'Título',
        image: 'Imagem',
        image_position: 'Recorte (posição)',
        image_zoom: 'Zoom da imagem',
        principle_title: 'Princípio',
        story_text: 'História',
        engineering_note: 'Nota de engenharia'
    };
    if (type === 'skills') return skillMap[key] || key;
    if (type === 'experience') return expMap[key] || key;
    if (type === 'mindset') return mindsetMap[key] || key;
    return key;
}

function getSectionList() {
    const locale = currentCV?.localized?.[currentLang] || {};
    const { nav } = ensureNavigationConfig(locale);
    const sections = getSectionsMeta();
    return sections.map((section) => ({
        id: section.id,
        type: section.type,
        label: nav[section.id] || SECTION_LABELS[section.type]?.[currentLang] || section.id,
        isCustom: !BASE_SECTIONS.includes(section.id)
    }));
}

function getDefaultCtaLink() {
    const email = currentCV?.profile?.social?.email || '';
    return email ? `mailto:${email}` : '#contact';
}

function getImageBaseFolder(sectionKey, key) {
    const paths = getPaths();
    if (sectionKey === 'meta') return paths.icons;
    return paths.photos;
}

function getImagePositionKey(key) {
    if (key === 'image') return 'image_position';
    if (key.endsWith('_image')) return `${key}_position`;
    if (key.endsWith('photo')) return `${key}_position`;
    return null;
}

function getFieldLabel(key) {
    const map = {
        headline: 'Título principal',
        location: 'Localização',
        intro_text: 'Introdução',
        bio: 'Texto principal',
        marketing_note: 'Nota de marketing',
        languages_label: 'Etiqueta de idiomas',
        languages: 'Idiomas',
        education_label: 'Etiqueta de formação',
        education: 'Formação',
        next_label: 'Etiqueta de transição',
        next_text: 'Texto de transição',
        title: 'Título',
        subtitle: 'Subtítulo',
        description: 'Descrição',
        summary: 'Resumo',
        details: 'Detalhes',
        philosophy: 'Filosofia',
        email_label: 'Etiqueta do email',
        linkedin_label: 'Etiqueta do LinkedIn',
        github_label: 'Etiqueta do GitHub',
        downloads_title: 'Título do grupo Downloads',
        certifications_title: 'Título do grupo Certificações',
        download_groups: 'Grupos de downloads',
        cta_label: 'Texto do CTA',
        cta_link: 'Link do CTA',
        image: 'Imagem',
        image_alt: 'Legenda da imagem',
        image_position: 'Recorte (posição)',
        image_zoom: 'Zoom da imagem',
        photo: 'Foto',
        contact_photo: 'Foto',
        work_photo: 'Foto'
    };
    return map[key] || key;
}

function getImageZoomKey(key) {
    if (key === 'image') return 'image_zoom';
    if (key.endsWith('_image')) return `${key}_zoom`;
    if (key.endsWith('photo')) return `${key}_zoom`;
    return null;
}

function getCropperFrameType(sectionKey, key) {
    if (key === 'photo' || key === 'contact_photo') return 'circle';
    if (sectionKey === 'foundation' && key === 'image') return 'circle';
    if (sectionKey === 'mindset' && key === 'image') return 'circle';
    return 'rounded';
}

function ensureNavigationConfig(locale) {
    if (!locale) return { nav: {}, icons: {} };
    if (!locale.navigation) locale.navigation = {};
    if (!locale.navigation_icons) locale.navigation_icons = {};
    return { nav: locale.navigation, icons: locale.navigation_icons };
}

function openEmojiPicker(onSelect) {
    const overlay = document.getElementById('emoji-overlay');
    if (!overlay) return;
    emojiPickerState = { onSelect };
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeEmojiPicker() {
    const overlay = document.getElementById('emoji-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    emojiPickerState = null;
}

function makeEmojiField(wrapper, targetObj, key, placeholder = 'ex: 🧭', options = {}) {
    const config = typeof options === 'object' && options ? options : {};
    const row = document.createElement('div');
    row.className = config.showPreview ? 'icon-input' : 'inline-input';
    let preview = null;
    if (config.showPreview) {
        preview = document.createElement('span');
        preview.className = 'icon-input-preview';
        row.appendChild(preview);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = targetObj[key] || '';
    input.oninput = (event) => {
        targetObj[key] = event.target.value;
        renderPreview();
        if (preview) {
            const value = String(input.value || '').trim();
            if (value) {
                preview.innerHTML = `<span class="nav-emoji">${value}</span>`;
            } else if (config.defaultIcon) {
                preview.innerHTML = config.defaultIcon;
            } else {
                preview.textContent = '';
            }
        }
    };
    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'toggle-visibility';
    pickBtn.textContent = 'Escolher';
    pickBtn.onclick = () => {
        openEmojiPicker((emoji) => {
            input.value = emoji;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };
    if (preview) {
        const value = String(input.value || '').trim();
        if (value) {
            preview.innerHTML = `<span class="nav-emoji">${value}</span>`;
        } else if (config.defaultIcon) {
            preview.innerHTML = config.defaultIcon;
        }
    }
    row.appendChild(input);
    row.appendChild(pickBtn);
    wrapper.appendChild(row);
    return input;
}

function buildTemplateSketch(type) {
    const sketch = document.createElement('div');
    sketch.className = 'template-sketch';
    if (type === 'overview') {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        const circle = document.createElement('div');
        circle.className = 'sketch-circle';
        const line = document.createElement('div');
        line.className = 'sketch-line';
        line.style.flex = '1';
        row.appendChild(circle);
        row.appendChild(line);
        sketch.appendChild(row);
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
    } else if (type === 'development') {
        sketch.style.gridTemplateColumns = 'repeat(2, 1fr)';
        for (let i = 0; i < 4; i += 1) {
            const card = document.createElement('div');
            card.className = 'sketch-card';
            sketch.appendChild(card);
        }
    } else if (type === 'foundation') {
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-circle' }));
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
    } else if (type === 'mindset') {
        sketch.style.gridTemplateColumns = 'repeat(2, 1fr)';
        for (let i = 0; i < 2; i += 1) {
            const card = document.createElement('div');
            card.className = 'sketch-card';
            card.style.height = '28px';
            sketch.appendChild(card);
        }
        const line = document.createElement('div');
        line.className = 'sketch-line';
        line.style.gridColumn = '1 / -1';
        sketch.appendChild(line);
    } else if (type === 'now') {
        sketch.style.gridTemplateColumns = '1fr 1fr';
        const block = document.createElement('div');
        block.className = 'sketch-card';
        block.style.height = '60px';
        const line = document.createElement('div');
        line.className = 'sketch-line';
        line.style.height = '12px';
        sketch.appendChild(block);
        sketch.appendChild(line);
    } else if (type === 'contact') {
        const circle = document.createElement('div');
        circle.className = 'sketch-circle';
        const line = document.createElement('div');
        line.className = 'sketch-line';
        const btn = document.createElement('div');
        btn.className = 'sketch-card';
        btn.style.height = '16px';
        sketch.appendChild(circle);
        sketch.appendChild(line);
        sketch.appendChild(btn);
    } else {
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
        sketch.appendChild(Object.assign(document.createElement('div'), { className: 'sketch-line' }));
    }
    return sketch;
}

function openSectionTemplatePicker() {
    const overlay = document.getElementById('section-template-overlay');
    const grid = document.getElementById('section-template-grid');
    const nameInput = document.getElementById('section-template-name');
    const createBtn = document.getElementById('section-template-create');
    if (!overlay || !grid || !nameInput || !createBtn) return;
    grid.innerHTML = '';
    let selectedType = null;

    SECTION_TEMPLATES.forEach((template) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'template-card';
        const title = document.createElement('div');
        title.className = 'template-name';
        title.textContent = template.name[currentLang] || template.type;
        const sketch = buildTemplateSketch(template.type);
        card.appendChild(title);
        card.appendChild(sketch);
        card.onclick = () => {
            selectedType = template.type;
            grid.querySelectorAll('.template-card').forEach((el) => el.classList.remove('active'));
            card.classList.add('active');
            createBtn.disabled = !(nameInput.value.trim() && selectedType);
        };
        grid.appendChild(card);
    });

    nameInput.value = '';
    createBtn.disabled = true;
    nameInput.oninput = () => {
        createBtn.disabled = !(nameInput.value.trim() && selectedType);
    };

    createBtn.onclick = () => {
        const label = nameInput.value.trim();
        if (!label || !selectedType) return;
        createCustomSection({ label, type: selectedType });
        closeSectionTemplatePicker();
    };

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeSectionTemplatePicker() {
    const overlay = document.getElementById('section-template-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function createEmptySection(type) {
    if (type === 'overview') {
        return {
            name: '',
            headline: '',
            location: '',
            intro_text: '',
            bio: '',
            marketing_note: '',
            languages_label: '',
            languages: [],
            education_label: '',
            education: [],
            next_label: '',
            next_text: '',
            cta_label: '',
            cta_link: '',
            photo_position: 'center 20%',
            photo_zoom: 1
        };
    }
    if (type === 'development') {
        return {
            title: '',
            description: '',
            image: '',
            image_alt: '',
            image_position: 'center 20%',
            image_zoom: 1,
            skills: [],
            next_label: '',
            next_text: '',
            cta_label: '',
            cta_link: ''
        };
    }
    if (type === 'foundation') {
        return {
            title: '',
            description: '',
            image: '',
            image_alt: '',
            image_position: 'center 20%',
            image_zoom: 1,
            experience: [],
            next_label: '',
            next_text: '',
            cta_label: '',
            cta_link: ''
        };
    }
    if (type === 'mindset') {
        return {
            title: '',
            subtitle: '',
            philosophy: '',
            adoption: null,
            blocks: [],
            next_label: '',
            next_text: '',
            cta_label: '',
            cta_link: ''
        };
    }
    if (type === 'now') {
        return {
            title: '',
            summary: '',
            details: '',
            image: '',
            image_alt: '',
            image_position: 'center 20%',
            image_zoom: 1,
            cta_label: '',
            cta_link: ''
        };
    }
    if (type === 'contact') {
        return {
            email_label: '',
            linkedin_label: '',
            github_label: '',
            title: '',
            description: '',
            downloads_title: '',
            certifications_title: '',
            download_groups: [],
            cta_label: '',
            cta_link: '',
            contact_photo_position: 'center 20%',
            contact_photo_zoom: 1
        };
    }
    return {};
}

function createCustomSection({ label, type }) {
    if (!currentCV) return;
    const baseSlug = slugifyLabel(label);
    const existing = new Set(getSectionsMeta().map((s) => s.id));
    let id = baseSlug;
    let counter = 2;
    while (existing.has(id)) {
        id = `${baseSlug}-${counter}`;
        counter += 1;
    }
    if (!currentCV.meta.sections) currentCV.meta.sections = [];
    currentCV.meta.sections.push({ id, type });
    if (Array.isArray(currentCV.meta.custom_sections)) {
        currentCV.meta.custom_sections.push({ id, type });
    }
    if (!currentCV.meta.section_types) currentCV.meta.section_types = {};
    currentCV.meta.section_types[id] = type;

    LANGS.forEach((lang) => {
        if (!currentCV.localized[lang]) currentCV.localized[lang] = {};
        const locale = currentCV.localized[lang];
        const { nav, icons } = ensureNavigationConfig(locale);
        nav[id] = nav[id] || (lang === currentLang ? label : '');
        icons[id] = icons[id] || '';
        if (!locale[id]) {
            locale[id] = createEmptySection(type);
        }
    });

    currentSection = id;
    renderSidebar();
    renderSectionEditor();
    renderPreview();
}

function appendNavigationFields(sectionKey) {
    if (!currentCV?.localized?.[currentLang]) return;
    const isNavSection = Boolean(getSectionsMeta().find((s) => s.id === sectionKey));
    if (!isNavSection) return;
    const sectionType = getSectionType(sectionKey) || sectionKey;
    const { nav, icons } = ensureNavigationConfig(currentCV.localized[currentLang]);
    if (!nav[sectionKey]) {
        nav[sectionKey] = SECTION_LABELS[sectionType]?.[currentLang] || sectionKey;
    }
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Navegação';
    fieldset.appendChild(legend);

    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'form-group';
    const labelLabel = document.createElement('label');
    labelLabel.textContent = 'Nome no menu';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = SECTION_LABELS[sectionType]?.[currentLang] || sectionKey;
    labelInput.value = nav[sectionKey] || '';
    labelInput.oninput = (event) => {
        nav[sectionKey] = event.target.value;
        renderPreview();
    };
    labelWrapper.appendChild(labelLabel);
    labelWrapper.appendChild(labelInput);
    fieldset.appendChild(labelWrapper);

    const typeWrapper = document.createElement('div');
    typeWrapper.className = 'form-group';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Tipo de página';
    const typeSelect = document.createElement('select');
    SECTION_TEMPLATES.forEach((template) => {
        const option = document.createElement('option');
        option.value = template.type;
        option.textContent = template.name[currentLang] || template.type;
        if (template.type === sectionType) option.selected = true;
        typeSelect.appendChild(option);
    });
    typeSelect.onchange = (event) => {
        const newType = event.target.value;
        const sections = getSectionsMeta();
        const target = sections.find((section) => section.id === sectionKey);
        if (target) {
            target.type = newType;
        }
        if (currentCV.meta.section_types) {
            currentCV.meta.section_types[sectionKey] = newType;
        }
        if (currentCV?.localized?.[currentLang]?.[sectionKey]) {
            // keep existing content; UI switches template by type
        } else {
            currentCV.localized[currentLang][sectionKey] = createEmptySection(newType);
        }
        renderSidebar();
        renderSectionEditor();
        renderPreview();
    };
    typeWrapper.appendChild(typeLabel);
    typeWrapper.appendChild(typeSelect);
    fieldset.appendChild(typeWrapper);

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'form-group';
    const iconLabel = document.createElement('label');
    iconLabel.textContent = 'Ícone do menu';
    iconWrapper.appendChild(iconLabel);
    const defaultIcon = NAV_DEFAULT_ICONS[sectionType] || '';
    makeEmojiField(iconWrapper, icons, sectionKey, 'ex: 🧭', { showPreview: true, defaultIcon });
    fieldset.appendChild(iconWrapper);

    uiNodes.editorForm.appendChild(fieldset);
}

function appendCtaFields(sectionKey, content) {
    if (!content || !uiNodes.editorForm) return;
    const uiConfig = getUiConfig();
    if (!content.cta_label) {
        content.cta_label = uiConfig?.cta_contact_label || '';
    }
    if (!content.cta_link) {
        content.cta_link = getDefaultCtaLink();
    }

    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'CTA';
    fieldset.appendChild(legend);

    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'form-group';
    const labelLabel = document.createElement('label');
    labelLabel.textContent = 'Texto do botão';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = content.cta_label || '';
    labelInput.oninput = (event) => {
        content.cta_label = event.target.value;
        renderPreview();
    };
    labelWrapper.appendChild(labelLabel);
    labelWrapper.appendChild(labelInput);
    fieldset.appendChild(labelWrapper);

    const linkWrapper = document.createElement('div');
    linkWrapper.className = 'form-group';
    const linkLabel = document.createElement('label');
    linkLabel.textContent = 'Link do botão';
    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.placeholder = 'ex: mailto:..., https://github.com/..., tel:+351...';
    linkInput.value = content.cta_link || '';
    linkInput.oninput = (event) => {
        content.cta_link = event.target.value;
        renderPreview();
    };
    linkWrapper.appendChild(linkLabel);
    linkWrapper.appendChild(linkInput);
    fieldset.appendChild(linkWrapper);

    uiNodes.editorForm.appendChild(fieldset);
}

function ensureCtaDefaults(content) {
    if (!content) return;
    const uiConfig = getUiConfig();
    if (!content.cta_label) {
        content.cta_label = uiConfig?.cta_contact_label || '';
    }
    if (!content.cta_link) {
        content.cta_link = getDefaultCtaLink();
    }
}

function makeImageField(wrapper, targetObj, key, sectionKey) {
    const row = document.createElement('div');
    row.className = 'photo-row split';
    const input = document.createElement('input');
    input.type = 'text';
    const assetType = sectionKey === 'meta' ? 'icons' : 'photos';
    input.value = stripAssetBase(assetType, targetObj[key] || '');
    input.oninput = (event) => {
        const normalized = stripAssetBase(assetType, event.target.value);
        targetObj[key] = normalized;
        if (input.value !== normalized) input.value = normalized;
        renderPreview();
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const safeName = normalizeFileName(file.name);
        input.value = safeName;
        targetObj[key] = safeName;
        renderPreview();
    };
    const adjustBtn = document.createElement('button');
    adjustBtn.type = 'button';
    adjustBtn.className = 'toggle-visibility';
    adjustBtn.textContent = 'Ajustar enquadramento';
    adjustBtn.onclick = () => {
        if (!input.value) {
            showMessage('Seleciona uma imagem primeiro.', 'info');
            return;
        }
        openImageCropper({
            imagePath: resolveAssetPath(assetType, input.value),
            targetObj,
            positionKey: getImagePositionKey(key),
            zoomKey: getImageZoomKey(key),
            frameType: getCropperFrameType(sectionKey, key)
        });
    };
    row.appendChild(input);
    row.appendChild(adjustBtn);
    wrapper.appendChild(row);
    wrapper.appendChild(fileInput);
}

function makeArrayField(wrapper, targetObj, key, values = []) {
    const list = document.createElement('div');
    list.className = 'story-list';

    const renderItems = () => {
        list.innerHTML = '';
        values.forEach((val, index) => {
            const row = document.createElement('div');
            row.className = 'array-card';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = val || '';
            input.oninput = (event) => {
                values[index] = event.target.value;
                targetObj[key] = values;
                renderPreview();
            };
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'toggle-visibility';
            removeBtn.textContent = '−';
            removeBtn.onclick = () => {
                values.splice(index, 1);
                targetObj[key] = values;
                renderItems();
                renderPreview();
            };
            row.appendChild(input);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });
    };

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'toggle-visibility';
    addBtn.textContent = '+ Adicionar';
    addBtn.onclick = () => {
        values.push('');
        targetObj[key] = values;
        renderItems();
        renderPreview();
    };

    renderItems();
    wrapper.appendChild(list);
    wrapper.appendChild(addBtn);
}

function makeResourceListField(wrapper, targetObj, key, values = []) {
    const list = document.createElement('div');
    list.className = 'story-list';
    const downloadsBase = getPaths().downloads;

    const renderItems = () => {
        list.innerHTML = '';
        values.forEach((val, index) => {
            const entry = val && typeof val === 'object' ? val : {};
            const row = document.createElement('div');
            row.className = 'array-card';
            const inputs = document.createElement('div');
            inputs.className = 'photo-row';

            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.placeholder = 'Etiqueta';
            labelInput.value = entry.label || '';
            const hrefInput = document.createElement('input');
            hrefInput.type = 'text';
            hrefInput.placeholder = 'Link';
            hrefInput.value = stripAssetBase('downloads', entry.href || '');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.png,.jpg,.jpeg,.webp';
            fileInput.onchange = (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const safeName = normalizeFileName(file.name);
                hrefInput.value = safeName;
                hrefInput.dispatchEvent(new Event('input', { bubbles: true }));
            };

            const sync = () => {
                const normalizedHref = stripAssetBase('downloads', hrefInput.value);
                if (hrefInput.value !== normalizedHref) hrefInput.value = normalizedHref;
                values[index] = { ...entry, label: labelInput.value, href: normalizedHref };
                targetObj[key] = values;
                renderPreview();
            };

            labelInput.oninput = sync;
            hrefInput.oninput = sync;

            inputs.appendChild(labelInput);
            inputs.appendChild(hrefInput);
            inputs.appendChild(fileInput);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'toggle-visibility';
            removeBtn.textContent = '−';
            removeBtn.onclick = () => {
                values.splice(index, 1);
                targetObj[key] = values;
                renderItems();
                renderPreview();
            };

            row.appendChild(inputs);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });
    };

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'toggle-visibility';
    addBtn.textContent = '+ Adicionar';
    addBtn.onclick = () => {
        values.push({ label: '', href: '' });
        targetObj[key] = values;
        renderItems();
        renderPreview();
    };

    renderItems();
    wrapper.appendChild(list);
    wrapper.appendChild(addBtn);
}

function makeResourceField(wrapper, targetObj, key, value = {}) {
    const resource = value && typeof value === 'object' ? value : {};
    const labelRow = document.createElement('div');
    labelRow.className = 'inline-input';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'label';
    labelInput.value = resource.label || '';
    const hrefRow = document.createElement('div');
    hrefRow.className = 'inline-input';
    const hrefInput = document.createElement('input');
    hrefInput.type = 'text';
    hrefInput.placeholder = 'href';
    hrefInput.value = stripAssetBase('downloads', resource.href || '');

    const sync = () => {
        const normalizedHref = stripAssetBase('downloads', hrefInput.value);
        if (hrefInput.value !== normalizedHref) hrefInput.value = normalizedHref;
        targetObj[key] = {
            ...(resource || {}),
            label: labelInput.value,
            href: normalizedHref
        };
        renderPreview();
    };

    labelInput.oninput = sync;
    hrefInput.oninput = sync;

    labelRow.appendChild(labelInput);
    hrefRow.appendChild(hrefInput);
    wrapper.appendChild(labelRow);
    wrapper.appendChild(hrefRow);
}

function makeFileField(wrapper, targetObj, key, labelText, baseFolder) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const row = document.createElement('div');
    row.className = 'photo-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = stripAssetBase('downloads', targetObj[key] || '');
    input.oninput = (event) => {
        const normalized = stripAssetBase('downloads', event.target.value);
        targetObj[key] = normalized;
        if (input.value !== normalized) input.value = normalized;
        renderPreview();
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*/*';
    fileInput.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const safeName = normalizeFileName(file.name);
        input.value = safeName;
        targetObj[key] = safeName;
        renderPreview();
    };
    row.appendChild(input);
    row.appendChild(fileInput);
    wrapper.appendChild(label);
    wrapper.appendChild(row);
}

function createDownloadItem({ label = '', icon = '', href = '', group = 'downloads' } = {}) {
    return {
        label,
        icon,
        href,
        group: group || 'downloads'
    };
}

function queueDownloadDeletion(href) {
    if (!href || typeof href !== 'string') return;
    const resolved = resolveAssetPath('downloads', href);
    if (!resolved.startsWith(getPaths().downloads)) return;
    pendingDownloadDeletes.add(resolved);
}

function getDownloadGroups(contact, downloads = []) {
    if (!contact) return [];
    if (!Array.isArray(contact.download_groups)) {
        const groups = [];
        const hasDownloads = downloads.some((item) => (item.group || 'downloads') === 'downloads');
        const hasCerts = downloads.some((item) => (item.group || 'downloads') === 'certs');
        if (contact.downloads_title || hasDownloads) {
            groups.push({
                id: 'downloads',
                label: contact.downloads_title || 'Downloads',
                open_in_new_tab: false
            });
        }
        if (contact.certifications_title || hasCerts) {
            groups.push({
                id: 'certs',
                label: contact.certifications_title || 'Certificações',
                open_in_new_tab: true
            });
        }
        if (!groups.length) {
            groups.push({
                id: 'downloads',
                label: contact.downloads_title || 'Downloads',
                open_in_new_tab: false
            });
        }
        contact.download_groups = groups;
    }
    contact.download_groups = contact.download_groups.map((group, index) => ({
        id: group?.id || `grupo-${index + 1}`,
        label: group?.label || group?.id || `Grupo ${index + 1}`,
        open_in_new_tab: Boolean(group?.open_in_new_tab)
    }));
    return contact.download_groups;
}

function mapLegacyDownloads(downloads, locale) {
    if (!downloads || typeof downloads !== 'object') return [];
    const contactLabels = locale?.contact || {};
    const labelMap = {
        cv: contactLabels.cv_label || 'CV',
        extended_cv: contactLabels.extended_cv_label || 'Extended CV',
        efa_content: contactLabels.efa_label || 'Conteúdo Programático',
        cert_python_1: contactLabels.python_1_label || 'Python I',
        cert_python_2: contactLabels.python_2_label || 'Python II',
        cert_marketing: contactLabels.marketing_label || 'Marketing'
    };
    const groupMap = {
        cv: 'downloads',
        extended_cv: 'downloads',
        efa_content: 'downloads',
        cert_python_1: 'certs',
        cert_python_2: 'certs',
        cert_marketing: 'certs'
    };
    return Object.entries(downloads).map(([key, href]) => createDownloadItem({
        label: labelMap[key] || key,
        href: href || '',
        group: groupMap[key] || 'downloads'
    }));
}

function getDownloadsList(profile, locale) {
    if (!profile) return [];
    if (Array.isArray(profile.downloads)) return profile.downloads;
    if (profile.downloads && typeof profile.downloads === 'object') {
        const list = mapLegacyDownloads(profile.downloads, locale);
        profile.downloads = list;
        return list;
    }
    profile.downloads = [];
    return profile.downloads;
}

function getUiConfig() {
    if (!currentCV?.localized?.[currentLang]) return null;
    if (!currentCV.localized[currentLang].ui) {
        currentCV.localized[currentLang].ui = {};
    }
    return currentCV.localized[currentLang].ui;
}

function appendProfilePhotoField({ key, label, sectionKey, positionKey, positionLabel }) {
    if (!uiNodes.editorForm) return;
    if (!currentCV.profile) currentCV.profile = {};
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
    makeImageField(wrapper, currentCV.profile, key, sectionKey);
    uiNodes.editorForm.appendChild(wrapper);
}

function appendSidebarIdentityFields() {
    if (!uiNodes.editorForm) return;
    if (!currentCV.profile) currentCV.profile = {};
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Identidade (Sidebar)';
    fieldset.appendChild(legend);

    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nome';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = currentCV.profile.name || '';
    nameInput.oninput = (event) => {
        currentCV.profile.name = event.target.value;
        renderPreview();
    };
    nameWrapper.appendChild(nameLabel);
    nameWrapper.appendChild(nameInput);
    fieldset.appendChild(nameWrapper);

    const roleWrapper = document.createElement('div');
    roleWrapper.className = 'form-group';
    const roleLabel = document.createElement('label');
    roleLabel.textContent = 'Cargo/posição';
    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.value = currentCV.profile.role || '';
    roleInput.oninput = (event) => {
        currentCV.profile.role = event.target.value;
        renderPreview();
    };
    roleWrapper.appendChild(roleLabel);
    roleWrapper.appendChild(roleInput);
    fieldset.appendChild(roleWrapper);

    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'form-group';
    const photoLabel = document.createElement('label');
    photoLabel.textContent = 'Foto principal (sidebar / identidade)';
    photoWrapper.appendChild(photoLabel);
    makeImageField(photoWrapper, currentCV.profile, 'photo', 'overview');
    fieldset.appendChild(photoWrapper);

    uiNodes.editorForm.appendChild(fieldset);
}

function appendSectionImageFields(sectionKey) {
    if (!uiNodes.editorForm) return new Set();
    const content = currentCV.localized?.[currentLang]?.[sectionKey];
    if (!content) return new Set();
    const handledKeys = new Set();
    const imageKeys = Object.keys(content).filter((key) => key === 'image' || key.endsWith('_image') || key.endsWith('photo'));
    imageKeys.forEach((key) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = getFieldLabel(key);
        wrapper.appendChild(label);
        makeImageField(wrapper, content, key, sectionKey);
        uiNodes.editorForm.appendChild(wrapper);
        handledKeys.add(key);
    });
    if (Object.prototype.hasOwnProperty.call(content, 'image_alt')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = 'Legenda da imagem';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = content.image_alt || '';
        input.oninput = (event) => {
            content.image_alt = event.target.value;
            renderPreview();
        };
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        uiNodes.editorForm.appendChild(wrapper);
        handledKeys.add('image_alt');
    }
    return handledKeys;
}

function showMessage(msg, type = 'info') {
    if (!uiNodes.msgBox) return;
    uiNodes.msgBox.textContent = msg;
    uiNodes.msgBox.className = `message ${type}`;
    setTimeout(() => {
        if (uiNodes.msgBox.textContent === msg) {
            uiNodes.msgBox.textContent = '';
            uiNodes.msgBox.className = '';
        }
    }, 6000);
}

async function syncPreviewStorage() {
    if (!currentCV) return;
    await setSecureItem(sessionStorage, PREVIEW_STORAGE, JSON.stringify(currentCV));
    const iframe = document.getElementById('page-preview');
    const previewPane = document.getElementById('preview-pane');
    const previewSection = Object.prototype.hasOwnProperty.call(PREVIEW_SECTION_MAP, currentSection)
        ? PREVIEW_SECTION_MAP[currentSection]
        : currentSection;
    const hasPreview = previewSection !== null;
    if (iframe) {
        iframe.style.display = hasPreview ? '' : 'none';
    }
    if (previewPane) {
        previewPane.style.display = hasPreview ? 'none' : 'block';
        if (!hasPreview) {
            previewPane.innerHTML = '<div class="preview-title">Sem pré-visualização</div><div class="preview-block">Esta secção não tem representação direta na página.</div>';
        }
    }
    if (hasPreview && iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'previewUpdate', section: previewSection, lang: currentLang }, '*');
    }
}

function normalizeGitHubError(message) {
    const text = String(message || '');
    if (text.includes('NetworkError')) {
        return 'Falha de rede ao carregar dados. Verifica a ligação e carrega manualmente o cv.json.';
    }
    if (text.includes('403')) {
        return 'Acesso negado. O token precisa de Contents: Read and write para este repositório.';
    }
    if (text.includes('422')) {
        return 'Pedido inválido (422). Normalmente é SHA em falta ou ficheiro alterado. Tenta recarregar o cv.json.';
    }
    if (text.includes('Resource not accessible by personal access token')) {
        return 'Token sem permissões para este repositório. Gera um PAT com scope repo e confirma owner/repo.';
    }
    if (text.includes('Bad credentials') || text.includes('401')) {
        return 'Token inválido ou expirado. Atualiza o PAT.';
    }
    if (text.includes('Not Found') || text.includes('404')) {
        return 'Repositório ou caminho não encontrado. Confirma owner/repo e o caminho data/cv.json.';
    }
    return message;
}

function showLoading(show) {
    if (uiNodes.loading) uiNodes.loading.style.display = show ? 'flex' : 'none';
}

function switchView(viewName) {
    if (uiNodes.editor) uiNodes.editor.style.display = 'none';
    if (uiNodes[viewName]) {
        uiNodes[viewName].style.display = viewName === 'editor' ? 'flex' : 'block';
    }
}

async function detectRepoInfo() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const host = window.location.hostname;
    const isGHPages = host.includes('github.io');

    if (isGHPages) {
        repoInfo.owner = host.split('.')[0];
        repoInfo.repo = pathParts[0] || `${repoInfo.owner}.github.io`;
    }

    const storedOwner = await getSecureItem(localStorage, REPO_OWNER_STORAGE);
    const storedRepo = await getSecureItem(localStorage, REPO_NAME_STORAGE);
    if (storedOwner) repoInfo.owner = storedOwner;
    if (storedRepo) repoInfo.repo = storedRepo;

    if (uiNodes.repoOwner) uiNodes.repoOwner.value = repoInfo.owner || '';
    if (uiNodes.repoName) uiNodes.repoName.value = repoInfo.repo || '';
}

async function fetchJsonWithFallback(urls) {
    let lastError = null;
    for (const url of urls) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                lastError = new Error(`HTTP ${response.status}`);
                continue;
            }
            const data = await response.json();
            return data;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('Falha ao carregar JSON.');
}

async function loadLocalCV() {
    const base = window.location.href;
    const direct = new URL('data/cv.json', base).toString();
    const relative = './data/cv.json';
    const root = `${window.location.origin}${window.location.pathname.replace(/config\\.html.*$/i, '')}data/cv.json`;
    const data = await fetchJsonWithFallback([direct, relative, root]);
    return { data, sha: null };
}

async function loadGitHubCV(token) {
    if (!repoInfo.owner || !repoInfo.repo) {
        throw new Error('Indica owner e repo para carregar via GitHub.');
    }
    return gh.fetchCVData(repoInfo.owner, repoInfo.repo, repoInfo.path, token);
}

async function loadCV(preferGitHub = false, lockOnFail = true) {
    showLoading(true);
    try {
        const token = await auth.getToken();
        if (preferGitHub && !token) {
            preferGitHub = false;
            showMessage('Sem token GitHub. Carregado cv.json local.', 'info');
        }
        if (preferGitHub && token) {
            const result = await loadGitHubCV(token);
            currentSource = 'github';
            currentCV = result.data;
            currentSHA = result.sha;
            showMessage('cv.json carregado via GitHub.', 'success');
        } else {
            const result = await loadLocalCV();
            currentSource = 'local';
            currentCV = result.data;
            currentSHA = null;
            showMessage('cv.json carregado localmente.', 'info');
        }
        normalizeAssetPaths();
        ensureSectionDefinitions();
        currentLang = currentCV.meta?.defaultLanguage || 'pt';
        const sections = getSectionsMeta();
        currentSection = sections.length ? sections[0].id : 'overview';
        renderSidebar();
        renderSectionEditor();
        renderPreview();
    } catch (error) {
        if (String(error?.message || '').toLowerCase().includes('token')) {
            auth.clearToken();
        }
        if (lockOnFail) {
            removeSecureItem(localStorage, OPENAI_KEY_STORAGE);
            removeSecureItem(localStorage, REPO_OWNER_STORAGE);
            removeSecureItem(localStorage, REPO_NAME_STORAGE);
            auth.lockAccess();
            switchView('gate');
        }
        showMessage(normalizeGitHubError(error.message || 'Erro ao carregar cv.json.'), 'error');
    } finally {
        showLoading(false);
    }
}


function renderSidebar() {
    if (!uiNodes.langButtons || !uiNodes.sectionButtons) return;

    uiNodes.langButtons.innerHTML = '';
    LANGS.forEach(lang => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = lang.toUpperCase();
        btn.className = lang === currentLang ? 'active' : '';
        btn.onclick = () => {
            currentLang = lang;
            renderSidebar();
            renderSectionEditor();
            renderPreview();
        };
        uiNodes.langButtons.appendChild(btn);
    });

    uiNodes.sectionButtons.innerHTML = '';
    const sectionList = getSectionList();
    if (!sectionList.find((section) => section.id === currentSection) && sectionList.length) {
        currentSection = sectionList[0].id;
    }
    sectionList.forEach((section, index) => {
        const row = document.createElement('div');
        row.className = 'section-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        const label = section.label || section.id;
        btn.textContent = label;
        btn.className = section.id === currentSection ? 'active' : '';
        btn.onclick = () => {
            currentSection = section.id;
            currentStoryIndex = 0;
            currentDownloadGroupIndex = 0;
            renderSidebar();
            renderSectionEditor();
            renderPreview();
        };
        row.appendChild(btn);

        const actions = document.createElement('div');
        actions.className = 'section-actions';
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'section-move';
        upBtn.textContent = '↑';
        upBtn.disabled = index === 0;
        upBtn.onclick = (event) => {
            event.stopPropagation();
            moveSection(section.id, -1);
        };
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'section-move';
        downBtn.textContent = '↓';
        downBtn.disabled = index === sectionList.length - 1;
        downBtn.onclick = (event) => {
            event.stopPropagation();
            moveSection(section.id, 1);
        };
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'section-remove';
        removeBtn.setAttribute('aria-label', `Remover ${label}`);
        removeBtn.textContent = '×';
        removeBtn.disabled = sectionList.length <= 1;
        removeBtn.onclick = (event) => {
            event.stopPropagation();
            if (removeBtn.disabled) return;
            if (confirm(`Remover a secção “${label}”?`)) {
                removeSection(section.id);
            }
        };
        actions.appendChild(removeBtn);

        row.appendChild(actions);
        uiNodes.sectionButtons.appendChild(row);
    });

    const activeSectionName = document.getElementById('active-section-name');
    const activeLangName = document.getElementById('active-lang-name');
    if (activeSectionName) {
        const navLabel = currentCV?.localized?.[currentLang]?.navigation?.[currentSection];
        activeSectionName.textContent = navLabel || SECTION_LABELS[currentSection]?.[currentLang] || currentSection;
    }
    if (activeLangName) {
        activeLangName.textContent = currentLang.toUpperCase();
    }
}

function isLongText(key, value) {
    if (!value) return false;
    const longKeys = ['description', 'intro_text', 'bio', 'details', 'summary', 'philosophy', 'subtitle', 'marketing_note', 'next_text', 'context_text', 'background', 'summary_text', 'details_text', 'intro_quote', 'challenge_text', 'key_learning_text', 'present_link', 'story_text', 'engineering_note', 'principle_title', 'focus_area', 'transition'];
    if (longKeys.some(k => key.toLowerCase().includes(k))) return true;
    return value.length > 120;
}

function renderDownloadsEditor() {
    if (!uiNodes.editorForm || !currentCV) return;
    if (!currentCV.profile) currentCV.profile = {};
    if (!currentCV.localized?.[currentLang]?.contact) {
        currentCV.localized[currentLang].contact = {};
    }
    const contact = currentCV.localized[currentLang].contact;
    const downloads = getDownloadsList(currentCV.profile, currentCV.localized?.[currentLang]);
    const downloadGroups = getDownloadGroups(contact, downloads);
    const groupsList = document.createElement('div');
    groupsList.className = 'story-list';
    const groupEditor = document.createElement('div');
    const linkList = document.createElement('div');
    linkList.className = 'story-list';

    const renderGroups = () => {
        groupsList.innerHTML = '';
        downloadGroups.forEach((group, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `story-button ${index === currentDownloadGroupIndex ? 'active' : ''}`;
            button.innerHTML = `
                <span>${group.label}</span>
                <div class=\"story-meta\">${group.id}</div>
            `;
            button.onclick = () => {
                currentDownloadGroupIndex = index;
                renderAll();
            };
            groupsList.appendChild(button);
        });
    };

    const renderGroupEditor = (group) => {
        groupEditor.innerHTML = '';
        if (!group) return;

        const idGroup = document.createElement('div');
        idGroup.className = 'form-group';
        const idLabel = document.createElement('label');
        idLabel.textContent = 'ID do grupo';
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.value = group.id || '';
        idInput.oninput = (event) => {
            const prevId = group.id;
            group.id = event.target.value.trim() || prevId;
            downloads.forEach((item) => {
                if ((item.group || 'downloads') === prevId) item.group = group.id;
            });
            renderAll();
            renderPreview();
        };
        idGroup.appendChild(idLabel);
        idGroup.appendChild(idInput);

        const labelGroup = document.createElement('div');
        labelGroup.className = 'form-group';
        const labelLabel = document.createElement('label');
        labelLabel.textContent = 'Nome do grupo';
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = group.label || '';
        labelInput.oninput = (event) => {
            group.label = event.target.value;
            renderGroups();
            renderPreview();
        };
        labelGroup.appendChild(labelLabel);
        labelGroup.appendChild(labelInput);

        const openGroup = document.createElement('div');
        openGroup.className = 'form-group';
        const openLabel = document.createElement('label');
        openLabel.textContent = 'Abrir links em nova aba';
        const openInput = document.createElement('input');
        openInput.type = 'checkbox';
        openInput.checked = Boolean(group.open_in_new_tab);
        openInput.onchange = (event) => {
            group.open_in_new_tab = event.target.checked;
            renderPreview();
        };
        openGroup.appendChild(openLabel);
        openGroup.appendChild(openInput);

        const removeGroupBtn = document.createElement('button');
        removeGroupBtn.type = 'button';
        removeGroupBtn.className = 'toggle-visibility';
        removeGroupBtn.textContent = 'Remover grupo';
        removeGroupBtn.disabled = downloadGroups.length <= 1;
        removeGroupBtn.onclick = () => {
            const removedId = group.id;
            for (let i = downloads.length - 1; i >= 0; i -= 1) {
                if ((downloads[i].group || 'downloads') === removedId) {
                    queueDownloadDeletion(downloads[i].href);
                    downloads.splice(i, 1);
                }
            }
            downloadGroups.splice(currentDownloadGroupIndex, 1);
            if (currentDownloadGroupIndex > 0) currentDownloadGroupIndex -= 1;
            renderAll();
            renderPreview();
        };

        groupEditor.appendChild(idGroup);
        groupEditor.appendChild(labelGroup);
        groupEditor.appendChild(openGroup);
        groupEditor.appendChild(removeGroupBtn);
    };

    const renderLinks = (group) => {
        linkList.innerHTML = '';
        if (!group) return;
        const groupLinks = downloads.filter((item) => (item.group || 'downloads') === group.id);
        groupLinks.forEach((item, index) => {
            const entry = createDownloadItem(item);
            const downloadIndex = downloads.indexOf(item);
            if (downloadIndex >= 0) downloads[downloadIndex] = entry;
            const fieldset = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = entry.label ? `Link — ${entry.label}` : `Link ${index + 1}`;
            fieldset.appendChild(legend);

            const labelGroup = document.createElement('div');
            labelGroup.className = 'form-group';
            const labelLabel = document.createElement('label');
            labelLabel.textContent = 'Nome do ficheiro';
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.value = entry.label || '';
            labelInput.oninput = (event) => {
                entry.label = event.target.value;
                legend.textContent = entry.label ? `Link — ${entry.label}` : `Link ${index + 1}`;
                renderPreview();
            };
            labelGroup.appendChild(labelLabel);
            labelGroup.appendChild(labelInput);
            fieldset.appendChild(labelGroup);

            const iconGroup = document.createElement('div');
            iconGroup.className = 'form-group';
            const iconLabel = document.createElement('label');
            iconLabel.textContent = 'Ícone (emoji)';
            iconGroup.appendChild(iconLabel);
            makeEmojiField(iconGroup, entry, 'icon', 'ex: 📁');
            fieldset.appendChild(iconGroup);

            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'form-group';
            const groupLabel = document.createElement('label');
            groupLabel.textContent = 'Grupo de downloads';
            const groupSelect = document.createElement('select');
            const groupOptions = downloadGroups.map((opt) => ({
                value: opt.id,
                label: opt.label
            }));
            if (!groupOptions.some((opt) => opt.value === entry.group)) {
                groupOptions.push({ value: entry.group, label: entry.group });
            }
            groupOptions.forEach((opt) => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if ((entry.group || group.id) === opt.value) option.selected = true;
                groupSelect.appendChild(option);
            });
            groupSelect.onchange = (event) => {
                entry.group = event.target.value;
                renderAll();
                renderPreview();
            };
            groupWrapper.appendChild(groupLabel);
            groupWrapper.appendChild(groupSelect);
            fieldset.appendChild(groupWrapper);

            const fileWrapper = document.createElement('div');
            fileWrapper.className = 'form-group';
            const downloadsBase = getPaths().downloads;
            makeFileField(fileWrapper, entry, 'href', `Ficheiro (${downloadsBase})`, downloadsBase);
            fieldset.appendChild(fileWrapper);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'toggle-visibility';
            removeBtn.textContent = 'Remover link';
            removeBtn.onclick = () => {
                queueDownloadDeletion(entry.href);
                if (downloadIndex >= 0) downloads.splice(downloadIndex, 1);
                renderAll();
                renderPreview();
            };
            fieldset.appendChild(removeBtn);

            linkList.appendChild(fieldset);
        });
    };

    const renderAll = () => {
        if (currentDownloadGroupIndex >= downloadGroups.length) currentDownloadGroupIndex = 0;
        const activeGroup = downloadGroups[currentDownloadGroupIndex];
        renderGroups();
        renderGroupEditor(activeGroup);
        renderLinks(activeGroup);
    };

    const addGroupBtn = document.createElement('button');
    addGroupBtn.type = 'button';
    addGroupBtn.className = 'toggle-visibility';
    addGroupBtn.textContent = '+ Adicionar grupo';
    addGroupBtn.onclick = () => {
        const nextIndex = downloadGroups.length + 1;
        downloadGroups.push({
            id: `grupo-${nextIndex}`,
            label: `Grupo ${nextIndex}`,
            open_in_new_tab: false
        });
        currentDownloadGroupIndex = downloadGroups.length - 1;
        renderAll();
        renderPreview();
    };

    const addLinkBtn = document.createElement('button');
    addLinkBtn.type = 'button';
    addLinkBtn.className = 'toggle-visibility';
    addLinkBtn.textContent = '+ Adicionar link';
    addLinkBtn.onclick = () => {
        const group = downloadGroups[currentDownloadGroupIndex];
        downloads.push(createDownloadItem({ group: group?.id || 'downloads' }));
        renderAll();
        renderPreview();
    };

    renderAll();
    uiNodes.editorForm.appendChild(groupsList);
    uiNodes.editorForm.appendChild(addGroupBtn);
    uiNodes.editorForm.appendChild(groupEditor);
    uiNodes.editorForm.appendChild(linkList);
    uiNodes.editorForm.appendChild(addLinkBtn);
}

function renderSectionEditor() {
    if (!currentCV || !uiNodes.editorForm) return;
    uiNodes.editorForm.innerHTML = '';
    appendNavigationFields(currentSection);

    const sectionContent = currentCV.localized?.[currentLang]?.[currentSection];
    const pendingFieldsets = [];

    if (currentSection === 'overview') {
        appendSidebarIdentityFields();
    }

    if (currentSection === 'contact') {
        appendProfilePhotoField({
            key: 'contact_photo',
            label: 'Foto contacto',
            sectionKey: 'contact'
        });
    }

    const uiConfig = getUiConfig();
    const addUiFieldset = (title, fields = []) => {
        if (!uiConfig || !fields.length) return;
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = title;
        fieldset.appendChild(legend);
        fields.forEach((field) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';
            const label = document.createElement('label');
            label.textContent = field.label;
            wrapper.appendChild(label);
            if (field.type === 'array') {
                if (!Array.isArray(uiConfig[field.key])) uiConfig[field.key] = [];
                makeArrayField(wrapper, uiConfig, field.key, [...uiConfig[field.key]]);
            } else {
                const input = field.multiline
                    ? document.createElement('textarea')
                    : (isLongText(field.key, uiConfig[field.key]) ? document.createElement('textarea') : document.createElement('input'));
                input.value = uiConfig[field.key] || '';
                input.oninput = (event) => {
                    uiConfig[field.key] = event.target.value;
                    renderPreview();
                };
                wrapper.appendChild(input);
            }
            fieldset.appendChild(wrapper);
        });
        uiNodes.editorForm.appendChild(fieldset);
    };

    if (currentSection === 'overview') {
        if (!currentCV.meta) currentCV.meta = {};
        pendingFieldsets.push(() => {
            const iconsBase = getPaths().icons;
            const metaFieldset = document.createElement('fieldset');
            const metaLegend = document.createElement('legend');
            metaLegend.textContent = 'Site (Meta)';
            metaFieldset.appendChild(metaLegend);
            const metaFields = [
                { key: 'site_title', label: 'Título do site', defaultValue: currentCV.meta.site_title || document.title || '' },
                { key: 'site_description', label: 'Descrição do site', multiline: true, defaultValue: currentCV.meta.site_description || (document.querySelector('meta[name="description"]')?.getAttribute('content') || '') },
                { key: 'favicon', label: 'Favicon (path)', isImage: true, defaultValue: stripAssetBase('icons', currentCV.meta.favicon || (document.getElementById('site-favicon')?.getAttribute('href') || `${iconsBase}favicon.ico`)) },
                { key: 'apple_icon', label: 'Apple touch icon (path)', isImage: true, defaultValue: stripAssetBase('icons', currentCV.meta.apple_icon || (document.getElementById('apple-touch-icon')?.getAttribute('href') || `${iconsBase}apple-touch-icon.png`)) }
            ];
            metaFields.forEach((field) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'form-group';
                const label = document.createElement('label');
                label.textContent = field.label;
                wrapper.appendChild(label);
                if (field.isImage) {
                    if (!currentCV.meta[field.key]) currentCV.meta[field.key] = field.defaultValue || '';
                    makeImageField(wrapper, currentCV.meta, field.key, 'meta');
                } else {
                    const input = field.multiline ? document.createElement('textarea') : document.createElement('input');
                    if (!currentCV.meta[field.key]) currentCV.meta[field.key] = field.defaultValue || '';
                    input.value = currentCV.meta[field.key] || '';
                    input.oninput = (event) => {
                        currentCV.meta[field.key] = event.target.value;
                        renderPreview();
                    };
                    wrapper.appendChild(input);
                }
                metaFieldset.appendChild(wrapper);
            });
            uiNodes.editorForm.appendChild(metaFieldset);
        });

        pendingFieldsets.push(() => addUiFieldset('Textos de Identidade', [
            { key: 'marketing_label', label: 'Etiqueta de marketing' }
        ]));

        pendingFieldsets.push(() => addUiFieldset('Interface global', [
            { key: 'menu_label', label: 'Texto do botão Menu' },
            { key: 'language_label', label: 'Etiqueta de idioma (ARIA)' }
        ]));
    }

    if (currentSection === 'development') {
        pendingFieldsets.push(() => addUiFieldset('Textos de Engenharia', [
            { key: 'explore_skill_label', label: 'Texto “Explorar” dos cartões' },
            { key: 'drawer_skill_context_label', label: 'Título do bloco “Contexto”' },
            { key: 'drawer_skill_competencies_label', label: 'Título do bloco “Competências”' },
            { key: 'drawer_skill_default_history', label: 'Texto padrão de histórico', multiline: true },
            { key: 'technologies_label', label: 'Etiqueta de tecnologias' }
        ]));
    }

    if (currentSection === 'foundation') {
        pendingFieldsets.push(() => addUiFieldset('Textos de Fundação', [
            { key: 'explore_experience_label', label: 'Texto “Explorar” dos cartões' }
        ]));
    }

    if (currentSection === 'mindset') {
        pendingFieldsets.push(() => addUiFieldset('Textos de Mentalidade', [
            { key: 'explore_mindset_label', label: 'Texto “Explorar” dos cartões' },
            { key: 'drawer_mindset_label', label: 'Título do drawer' },
            { key: 'drawer_mindset_story_label', label: 'Etiqueta da experiência pessoal' },
            { key: 'mindset_trace_label', label: 'Etiqueta do bloco final' },
            { key: 'mindset_trace_text', label: 'Texto do bloco final', multiline: true }
        ]));
    }

    if (currentSection === 'contact') {
        pendingFieldsets.push(() => addUiFieldset('Chamada para ação', [
            { key: 'cta_contact_label', label: 'Texto do botão CTA' }
        ]));
    }

    const content = sectionContent;
    if (!content) {
        if (uiNodes.editorForm.children.length === 0) {
            uiNodes.editorForm.innerHTML = '<p>Sem dados para esta secção.</p>';
        } else {
            const note = document.createElement('p');
            note.textContent = 'Sem dados para esta secção.';
            uiNodes.editorForm.appendChild(note);
        }
        return;
    }

    ensureCtaDefaults(content);
    const orderedEntries = getOrderedEntries(currentSection, content);
    const storyConfig = getStoryConfig(currentSection);
    let storyRendered = false;
    let ctaRendered = false;
    let certsRendered = false;
    const sectionType = getSectionType(currentSection);

    const renderCertificationsFieldset = () => {
        const locale = currentCV.localized?.[currentLang];
        if (!locale) return;
        if (!Array.isArray(locale.certifications)) {
            locale.certifications = [];
        }
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = 'Certificações';
        fieldset.appendChild(legend);
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        makeResourceListField(wrapper, locale, 'certifications', [...locale.certifications]);
        fieldset.appendChild(wrapper);
        uiNodes.editorForm.appendChild(fieldset);
        certsRendered = true;
    };

    const renderContactLinks = () => {
        if (!currentCV.profile) currentCV.profile = {};
        if (!currentCV.profile.social) currentCV.profile.social = {};
        const linksFieldset = document.createElement('fieldset');
        const linksLegend = document.createElement('legend');
        linksLegend.textContent = 'Links';
        linksFieldset.appendChild(linksLegend);
        const fields = [
            { key: 'email', label: 'Email (CTA)' },
            { key: 'linkedin', label: 'LinkedIn' },
            { key: 'github', label: 'GitHub' }
        ];
        fields.forEach((field) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';
            const label = document.createElement('label');
            label.textContent = field.label;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentCV.profile.social[field.key] || '';
            input.oninput = (event) => {
                currentCV.profile.social[field.key] = event.target.value;
                renderPreview();
            };
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            linksFieldset.appendChild(wrapper);
        });
        uiNodes.editorForm.appendChild(linksFieldset);
    };

    orderedEntries.forEach(([key, value]) => {
        if (currentSection === 'overview' && key === 'intro_text' && !certsRendered) {
            renderCertificationsFieldset();
        }
        if (currentSection === 'contact' && key === 'download_groups') {
            renderDownloadsEditor();
            return;
        }
        if ((sectionType === 'development' && key === 'skills')
            || (sectionType === 'foundation' && key === 'experience')
            || (sectionType === 'mindset' && (key === 'blocks' || key === 'adoption'))) {
            if (!storyRendered && storyConfig) {
                renderStoryEditor(storyConfig, { append: true });
                storyRendered = true;
            }
            return;
        }
        if (key === 'cta_label') {
            if (!ctaRendered) {
                appendCtaFields(currentSection, content);
                ctaRendered = true;
            }
            return;
        }
        if (key === 'cta_link') {
            if (!ctaRendered) {
                appendCtaFields(currentSection, content);
                ctaRendered = true;
            }
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = getFieldLabel(key);
        wrapper.appendChild(label);

        if (Array.isArray(value)) {
            makeArrayField(wrapper, content, key, [...value]);
        } else if (typeof value === 'string') {
            if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                makeImageField(wrapper, content, key, currentSection);
            } else if (key === 'icon') {
                makeEmojiField(wrapper, content, key, 'ex: ⭐');
            } else {
                const input = isLongText(key, value) ? document.createElement('textarea') : document.createElement('input');
                input.value = value || '';
                input.oninput = (event) => {
                    content[key] = event.target.value;
                    renderPreview();
                };
                wrapper.appendChild(input);
            }
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(value, null, 2);
            textarea.onchange = (event) => {
                try {
                    content[key] = JSON.parse(event.target.value);
                    renderPreview();
                } catch (error) {
                    showMessage(`JSON inválido em ${key}.`, 'error');
                }
            };
            wrapper.appendChild(textarea);
        }

        uiNodes.editorForm.appendChild(wrapper);
    });

    if (currentSection === 'overview' && !certsRendered) {
        renderCertificationsFieldset();
    }

    if (storyConfig && !storyRendered) {
        renderStoryEditor(storyConfig, { append: true });
    }

    if (currentSection === 'contact') {
        renderContactLinks();
    }

    pendingFieldsets.forEach((fn) => fn());
}

function getStoryConfig(sectionKey) {
    const content = currentCV?.localized?.[currentLang]?.[sectionKey];
    if (!content) return null;
    const sectionType = getSectionType(sectionKey);
    if (sectionType === 'development') {
        return { label: 'Sub-histórias', items: content.skills || [], type: 'skills', sourceRef: content.skills || [] };
    }
    if (sectionType === 'foundation') {
        return { label: 'Sub-histórias', items: content.experience || [], type: 'experience', sourceRef: content.experience || [] };
    }
    if (sectionType === 'mindset') {
        const items = [];
        if (content.adoption) {
            items.push({ source: 'adoption', item: content.adoption });
        }
        (content.blocks || []).forEach((block, index) => {
            items.push({ source: 'blocks', item: block, index });
        });
        return { label: 'Sub-histórias', items, type: 'mindset', sourceRef: content.blocks || [], adoptionRef: content.adoption || null };
    }
    return null;
}

function renderStoryEditor(config, { append = false } = {}) {
    if (!append) {
        uiNodes.editorForm.innerHTML = '';
    }
    const list = document.createElement('div');
    list.className = 'story-list';
    const items = config.items || [];

    if (currentStoryIndex >= items.length) currentStoryIndex = 0;

    items.forEach((entry, index) => {
        const item = config.type === 'mindset' ? entry.item : entry;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `story-button ${index === currentStoryIndex ? 'active' : ''}`;
        const title = item.title || item.name || item.role_title || `História ${index + 1}`;
        const subtitle = item.company_name || item.focus_area || item.principle_title || '';
        button.innerHTML = `<div>${title}</div>${subtitle ? `<div class=\"story-meta\">${subtitle}</div>` : ''}`;
        button.onclick = () => {
            currentStoryIndex = index;
            renderSectionEditor();
        };
        list.appendChild(button);
    });

    uiNodes.editorForm.appendChild(list);
    const controls = document.createElement('div');
    controls.className = 'inline-input';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'toggle-visibility';
    addBtn.textContent = '+ Adicionar cartão';
    addBtn.onclick = () => {
        if (config.type === 'mindset') {
            if (!config.sourceRef) config.sourceRef = [];
            config.sourceRef.push({
                id: '',
                title: '',
                icon: '',
                image: '',
                image_position: 'center 20%',
                image_zoom: 1,
                principle_title: '',
                story_text: '',
                engineering_note: ''
            });
            currentStoryIndex = items.length;
        } else if (config.sourceRef) {
            if (config.type === 'skills') {
                config.sourceRef.push({
                    title: '',
                    focus_area: '',
                    context_text: '',
                    technologies: [],
                    competencies: [],
                    background: '',
                    progress_status: '',
                    duration_hours: ''
                });
            } else if (config.type === 'experience') {
                config.sourceRef.push({
                    company_name: '',
                    role_title: '',
                    timeframe: '',
                    summary_text: '',
                    details_text: '',
                    intro_quote: '',
                    challenge_text: '',
                    key_learning_text: '',
                    present_link: '',
                    technologies: []
                });
            }
            currentStoryIndex = config.sourceRef.length - 1;
        }
        renderSectionEditor();
        renderPreview();
    };
    controls.appendChild(addBtn);
    uiNodes.editorForm.appendChild(controls);

    const targetEntry = items[currentStoryIndex];
    if (!targetEntry) return;
    const targetItem = config.type === 'mindset' ? targetEntry.item : targetEntry;
    if (config.type === 'skills' && !Array.isArray(targetItem.competencies)) {
        const fallback = currentCV?.localized?.[currentLang]?.ui?.skill_tags;
        targetItem.competencies = Array.isArray(fallback) ? [...fallback] : [];
    }

    const fieldsetTitle = document.createElement('div');
    fieldsetTitle.className = 'form-group';
    fieldsetTitle.innerHTML = `<label>Edição do cartão</label>`;
    uiNodes.editorForm.appendChild(fieldsetTitle);

    const cardFieldset = document.createElement('fieldset');
    const cardLegend = document.createElement('legend');
    cardLegend.textContent = 'Cartão (resumo)';
    cardFieldset.appendChild(cardLegend);

    const popupFieldset = document.createElement('fieldset');
    const popupLegend = document.createElement('legend');
    popupLegend.textContent = 'Pop-up (detalhes)';
    popupFieldset.appendChild(popupLegend);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'toggle-visibility';
    removeBtn.textContent = 'Remover cartão';
    removeBtn.onclick = () => {
        if (config.type === 'mindset') {
            if (targetEntry.source === 'adoption') {
                const content = currentCV?.localized?.[currentLang]?.[currentSection];
                if (content) content.adoption = null;
            } else if (targetEntry.source === 'blocks' && Array.isArray(config.sourceRef)) {
                config.sourceRef.splice(targetEntry.index, 1);
            }
        } else if (Array.isArray(config.sourceRef)) {
            config.sourceRef.splice(currentStoryIndex, 1);
        }
        if (currentStoryIndex > 0) currentStoryIndex -= 1;
        renderSectionEditor();
        renderPreview();
    };

    const popupKeys = {
        skills: new Set(['context_text', 'background', 'resource', 'competencies', 'technologies']),
        experience: new Set(['summary_text', 'intro_quote', 'details_text', 'challenge_text', 'key_learning_text', 'present_link', 'technologies']),
        mindset: new Set(['story_text', 'engineering_note'])
    };

    getStoryOrderedKeys(config.type, targetItem).forEach((key) => {
        const value = targetItem[key];
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = getStoryFieldLabel(config.type, key);
        wrapper.appendChild(label);

        if (Array.isArray(value)) {
            makeArrayField(wrapper, targetItem, key, [...value]);
        } else if (typeof value === 'string') {
            if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                makeImageField(wrapper, targetItem, key, currentSection);
            } else if (key === 'icon') {
                makeEmojiField(wrapper, targetItem, key, 'ex: ⭐');
            } else {
                const input = isLongText(key, value) ? document.createElement('textarea') : document.createElement('input');
                input.value = value || '';
                input.oninput = (event) => {
                    targetItem[key] = event.target.value;
                    renderPreview();
                };
                wrapper.appendChild(input);
            }
        } else if (value && typeof value === 'object') {
            const looksLikeResource = key === 'resource' || (Object.prototype.hasOwnProperty.call(value, 'label') && Object.prototype.hasOwnProperty.call(value, 'href'));
            if (looksLikeResource) {
                makeResourceField(wrapper, targetItem, key, value);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = JSON.stringify(value, null, 2);
                textarea.onchange = (event) => {
                    try {
                        targetItem[key] = JSON.parse(event.target.value);
                        renderPreview();
                    } catch (error) {
                        showMessage(`JSON inválido em ${key}.`, 'error');
                    }
                };
                wrapper.appendChild(textarea);
            }
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(value, null, 2);
            textarea.onchange = (event) => {
                try {
                    targetItem[key] = JSON.parse(event.target.value);
                    renderPreview();
                } catch (error) {
                    showMessage(`JSON inválido em ${key}.`, 'error');
                }
            };
            wrapper.appendChild(textarea);
        }

        if (popupKeys[config.type]?.has(key)) {
            popupFieldset.appendChild(wrapper);
        } else {
            cardFieldset.appendChild(wrapper);
        }
    });

    uiNodes.editorForm.appendChild(cardFieldset);
    uiNodes.editorForm.appendChild(popupFieldset);
    uiNodes.editorForm.appendChild(removeBtn);

    uiNodes.editorForm.appendChild(removeBtn);
}

function renderPreview() {
    if (!currentCV || !uiNodes.previewPane) return;
    syncPreviewStorage();
    const content = currentCV.localized?.[currentLang]?.[currentSection];
    if (!content && getStoryConfig(currentSection)) {
        const storyConfig = getStoryConfig(currentSection);
        const items = storyConfig.items || [];
        const entry = items[currentStoryIndex];
        const item = storyConfig.type === 'mindset' ? entry?.item : entry;
        if (item) {
            uiNodes.previewPane.innerHTML = `
                <div class="preview-title">${item.title || item.name || item.role_title || 'História'}</div>
                ${item.summary_text ? `<div class="preview-block">${item.summary_text}</div>` : ''}
                ${item.story_text ? `<div class="preview-block">${item.story_text}</div>` : ''}
                ${item.engineering_note ? `<div class="preview-block">${item.engineering_note}</div>` : ''}
            `;
            return;
        }
    }
    if (!content) {
        uiNodes.previewPane.innerHTML = '<p>Sem preview disponível.</p>';
        return;
    }

    const htmlParts = [];
    const navLabel = currentCV.localized?.[currentLang]?.navigation?.[currentSection];
    const title = content.title || content.name || navLabel || SECTION_LABELS[currentSection]?.[currentLang] || currentSection;

    htmlParts.push(`<div class="preview-title">${title}</div>`);

    if (content.subtitle) {
        htmlParts.push(`<div class="preview-subtitle">${content.subtitle}</div>`);
    }

    if (currentSection === 'overview') {
        if (content.location) htmlParts.push(`<div class="preview-subtitle">${content.location}</div>`);
        if (content.headline) htmlParts.push(`<div class="preview-block">${content.headline}</div>`);
        if (content.intro_text) htmlParts.push(`<div class="preview-block">${content.intro_text}</div>`);
        if (content.bio) htmlParts.push(`<div class="preview-block">${content.bio}</div>`);
    } else if (currentSection === 'now') {
        if (content.summary) htmlParts.push(`<div class="preview-block">${content.summary}</div>`);
        if (content.details) htmlParts.push(`<div class="preview-block">${content.details}</div>`);
    } else {
        if (content.description) htmlParts.push(`<div class="preview-block">${content.description}</div>`);
        if (content.philosophy) htmlParts.push(`<div class="preview-block">${content.philosophy}</div>`);
    }

    const arraysInfo = Object.entries(content)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => `<span class="tag">${key}: ${value.length}</span>`)
        .join(' ');

    if (arraysInfo) {
        htmlParts.push(`<div class="preview-block">${arraysInfo}</div>`);
    }

    uiNodes.previewPane.innerHTML = htmlParts.join('');
}

async function persistSessionFields() {
    if (uiNodes.ghToken?.value) await auth.saveToken(uiNodes.ghToken.value);
    if (uiNodes.repoOwner?.value) {
        repoInfo.owner = uiNodes.repoOwner.value.trim();
        await setSecureItem(localStorage, REPO_OWNER_STORAGE, repoInfo.owner);
    }
    if (uiNodes.repoName?.value) {
        repoInfo.repo = uiNodes.repoName.value.trim();
        await setSecureItem(localStorage, REPO_NAME_STORAGE, repoInfo.repo);
    }
    if (uiNodes.openaiKey?.value) {
        await setSecureItem(localStorage, OPENAI_KEY_STORAGE, uiNodes.openaiKey.value.trim());
    }
}

async function getOpenAIKey() {
    const stored = await getSecureItem(localStorage, OPENAI_KEY_STORAGE);
    if (stored) return stored;
    const fallback = uiNodes.openaiKey?.value?.trim();
    if (fallback) {
        await setSecureItem(localStorage, OPENAI_KEY_STORAGE, fallback);
        return fallback;
    }
    return null;
}

function extractOutputText(data) {
    if (data.output_text) return data.output_text;
    if (Array.isArray(data.output)) {
        return data.output
            .flatMap(item => item.content || [])
            .filter(content => content.type === 'output_text')
            .map(content => content.text)
            .join('');
    }
    if (Array.isArray(data.choices)) {
        return data.choices.map(choice => choice.message?.content || '').join('');
    }
    return '';
}

function safeJSONParse(rawText) {
    if (!rawText) return null;
    const trimmed = rawText.trim();
    try {
        return JSON.parse(trimmed);
    } catch (err) {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(trimmed.slice(start, end + 1));
            } catch (innerErr) {
                return null;
            }
        }
    }
    return null;
}

function preserveKeys(source, target) {
    if (!source || !target) return;
    const preserve = new Set(['id', 'visibility', 'layer', 'image', 'icon', 'url', 'link', 'timeframe', 'company_name']);
    Object.keys(source).forEach((key) => {
        if (preserve.has(key)) {
            target[key] = source[key];
            return;
        }
        const sourceVal = source[key];
        const targetVal = target[key];
        if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
            sourceVal.forEach((item, index) => {
                if (typeof item === 'object' && item && typeof targetVal[index] === 'object') {
                    preserveKeys(item, targetVal[index]);
                }
            });
        } else if (typeof sourceVal === 'object' && sourceVal && typeof targetVal === 'object') {
            preserveKeys(sourceVal, targetVal);
        }
    });
}

async function translateSection() {
    if (!currentCV) return;
    if (currentLang !== 'pt') {
        showMessage('Tradução disponível apenas a partir de PT.', 'info');
        return;
    }

    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        showMessage('Indica uma OpenAI API Key antes de traduzir.', 'error');
        return;
    }

    const ptSection = currentCV.localized?.pt?.[currentSection];
    if (!ptSection) {
        showMessage('Secção PT não encontrada.', 'error');
        return;
    }

    showLoading(true);
    try {
        const systemPrompt = 'You translate structured JSON content from Portuguese to Spanish and English. Keep the same keys, do not alter ids or URLs, and return strict JSON only.';
        const userPrompt = `Translate this JSON section. Return: {"es": <section>, "en": <section>}\n\n${JSON.stringify(ptSection)}`;

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                input: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Erro na chamada à OpenAI API.');
        }

        const data = await response.json();
        const rawText = extractOutputText(data);
        const parsed = safeJSONParse(rawText);

        if (!parsed || !parsed.es || !parsed.en) {
            throw new Error('Resposta inválida da OpenAI.');
        }

        currentCV.localized.es[currentSection] = parsed.es;
        currentCV.localized.en[currentSection] = parsed.en;
        preserveKeys(ptSection, currentCV.localized.es[currentSection]);
        preserveKeys(ptSection, currentCV.localized.en[currentSection]);

        showMessage('Traduções atualizadas (ES/EN).', 'success');
        renderSidebar();
        renderSectionEditor();
        renderPreview();
    } catch (error) {
        showMessage(error.message || 'Erro ao traduzir.', 'error');
    } finally {
        showLoading(false);
    }
}

async function saveChanges() {
    if (!currentCV) return;
    await persistSessionFields();

    const token = await auth.getToken();
    if (!token) {
        showMessage('Token GitHub necessário para guardar.', 'error');
        return;
    }

    if (!repoInfo.owner || !repoInfo.repo) {
        showMessage('Owner/Repo necessários para guardar.', 'error');
        return;
    }

    showLoading(true);
    try {
        if (!currentSHA) {
            const shaResult = await gh.fetchCVData(
                repoInfo.owner,
                repoInfo.repo,
                repoInfo.path,
                token
            );
            currentSHA = shaResult.sha;
        }
        const result = await gh.updateCVData(
            repoInfo.owner,
            repoInfo.repo,
            repoInfo.path,
            token,
            currentCV,
            currentSHA,
            'Update CV data via Admin UI'
        );
        currentSHA = result.content.sha;
        currentSource = 'github';
        if (pendingDownloadDeletes.size) {
            const downloads = Array.isArray(currentCV.profile?.downloads) ? currentCV.profile.downloads : [];
            const activeHrefs = new Set(downloads.map((item) => resolveAssetPath('downloads', item?.href)).filter(Boolean));
            const toDelete = Array.from(pendingDownloadDeletes).filter((href) => !activeHrefs.has(href));
            const failed = [];
            for (const href of toDelete) {
                try {
                    await gh.deleteFile(repoInfo.owner, repoInfo.repo, href, token, `Remove download ${href}`);
                    pendingDownloadDeletes.delete(href);
                } catch (error) {
                    failed.push(href);
                }
            }
            if (failed.length) {
                showMessage(`Alguns ficheiros não foram apagados: ${failed.join(', ')}`, 'error');
            }
        }
        showMessage('Alterações guardadas no GitHub.', 'success');
    } catch (error) {
        showMessage(normalizeGitHubError(error.message || 'Falha ao guardar.'), 'error');
        if (error?.details) {
            console.error('GitHub save error details:', error.details);
        }
    } finally {
        showLoading(false);
    }
}

async function hydrateSessionFields() {
    if (uiNodes.ghToken) uiNodes.ghToken.value = (await auth.getToken()) || '';
    if (uiNodes.openaiKey) uiNodes.openaiKey.value = (await getOpenAIKey()) || '';
}

function bindEvents() {
    // No password gate: access controlled by hidden entry only.

    if (uiNodes.loadBtn) {
        uiNodes.loadBtn.addEventListener('click', async () => {
            await downloadLocalConfigBackup();
        });
    }

    if (uiNodes.restoreBtn && uiNodes.restoreFile) {
        uiNodes.restoreBtn.addEventListener('click', () => {
            uiNodes.restoreFile.click();
        });
        uiNodes.restoreFile.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await restoreLocalConfigBackup(file);
            uiNodes.restoreFile.value = '';
        });
    }

    if (uiNodes.exportJsonBtn) {
        uiNodes.exportJsonBtn.addEventListener('click', () => {
            downloadFullCVJson();
        });
    }

    if (uiNodes.importJsonBtn && uiNodes.importJsonFile) {
        uiNodes.importJsonBtn.addEventListener('click', () => {
            uiNodes.importJsonFile.click();
        });
        uiNodes.importJsonFile.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await restoreFullCVJson(file);
            uiNodes.importJsonFile.value = '';
        });
    }

    if (uiNodes.saveBtn) {
        uiNodes.saveBtn.addEventListener('click', saveChanges);
    }

    if (uiNodes.backBtn) {
        uiNodes.backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (uiNodes.translateBtn) {
        uiNodes.translateBtn.addEventListener('click', translateSection);
    }

    const addSectionBtn = document.getElementById('add-section-btn');
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', openSectionTemplatePicker);
    }
    const templateClose = document.getElementById('section-template-close');
    const templateOverlay = document.getElementById('section-template-overlay');
    if (templateClose) {
        templateClose.addEventListener('click', closeSectionTemplatePicker);
    }
    if (templateOverlay) {
        templateOverlay.addEventListener('click', (event) => {
            if (event.target === templateOverlay) closeSectionTemplatePicker();
        });
    }

    document.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-toggle');
            const input = document.getElementById(targetId);
            if (!input) return;
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.textContent = isHidden ? 'Ocultar' : 'Ver';
        });
    });

    // Admin lock/password removed.

    if (uiNodes.ghToken) {
        uiNodes.ghToken.addEventListener('change', persistSessionFields);
    }
    if (uiNodes.repoOwner) {
        uiNodes.repoOwner.addEventListener('change', persistSessionFields);
    }
    if (uiNodes.repoName) {
        uiNodes.repoName.addEventListener('change', persistSessionFields);
    }
    if (uiNodes.openaiKey) {
        uiNodes.openaiKey.addEventListener('change', persistSessionFields);
        uiNodes.openaiKey.addEventListener('input', persistSessionFields);
    }
}

async function downloadLocalConfigBackup() {
    const token = await auth.getToken();
    const openaiKey = await getOpenAIKey();
    const payload = {
        savedAt: new Date().toISOString(),
        repo: {
            owner: uiNodes.repoOwner?.value?.trim() || repoInfo.owner || '',
            name: uiNodes.repoName?.value?.trim() || repoInfo.repo || '',
            path: repoInfo.path
        },
        github_pat: token || '',
        openai_api_key: openaiKey || ''
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'local-config-backup.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    showMessage('Backup das configurações descarregado.', 'success');
}

function downloadFullCVJson() {
    if (!currentCV) {
        showMessage('Sem dados carregados para exportar.', 'error');
        return;
    }
    const blob = new Blob([JSON.stringify(currentCV, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cv.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    showMessage('cv.json exportado.', 'success');
}

async function restoreFullCVJson(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.localized || !parsed.profile) {
            showMessage('JSON inválido: falta estrutura base do CV.', 'error');
            return;
        }
        currentCV = parsed;
        currentSource = 'local';
        currentSHA = null;
        pendingDownloadDeletes.clear();
        normalizeAssetPaths();
        ensureSectionDefinitions();
        const sections = getSectionsMeta();
        currentSection = sections.length ? sections[0].id : 'overview';
        renderSidebar();
        renderSectionEditor();
        renderPreview();
        showMessage('cv.json importado com sucesso.', 'success');
    } catch (error) {
        showMessage('Erro ao importar cv.json.', 'error');
    }
}

function parsePosition(value) {
    if (!value) return { x: 50, y: 50 };
    const parts = String(value).trim().split(/\s+/);
    const toPercent = (token, fallback) => {
        if (!token) return fallback;
        if (token.endsWith('%')) {
            const num = parseFloat(token);
            return Number.isFinite(num) ? num : fallback;
        }
        const map = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
        return map[token] !== undefined ? map[token] : fallback;
    };
    return {
        x: toPercent(parts[0], 50),
        y: toPercent(parts[1], 50)
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function updateCropperPreview() {
    if (!cropperState) return;
    const { previewEl, x, y, zoom } = cropperState;
    previewEl.style.backgroundPosition = `${x}% ${y}%`;
    previewEl.style.backgroundSize = `${zoom * 100}%`;
    const zoomValue = document.getElementById('cropper-zoom-value');
    if (zoomValue) zoomValue.textContent = `${zoom.toFixed(2)}x`;
}

function openImageCropper({ imagePath, targetObj, positionKey, zoomKey, frameType = 'rounded' }) {
    const overlay = document.getElementById('cropper-overlay');
    const previewEl = document.getElementById('cropper-preview');
    const zoomInput = document.getElementById('cropper-zoom');
    if (!overlay || !previewEl || !zoomInput) return;

    const pos = parsePosition(targetObj[positionKey]);
    const zoom = Number(targetObj[zoomKey] || 1);
    cropperState = {
        targetObj,
        positionKey,
        zoomKey,
        previewEl,
        x: clamp(pos.x, 0, 100),
        y: clamp(pos.y, 0, 100),
        zoom: clamp(Number.isFinite(zoom) ? zoom : 1, 1, 2.5),
        dragging: false,
        startX: 0,
        startY: 0,
        startPosX: 50,
        startPosY: 50
    };

    previewEl.style.backgroundImage = `url(${imagePath})`;
    previewEl.classList.remove('circle', 'rounded');
    previewEl.classList.add(frameType === 'circle' ? 'circle' : 'rounded');
    zoomInput.value = cropperState.zoom;
    updateCropperPreview();
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeImageCropper() {
    const overlay = document.getElementById('cropper-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    cropperState = null;
}

function bindCropperEvents() {
    const overlay = document.getElementById('cropper-overlay');
    const previewEl = document.getElementById('cropper-preview');
    const zoomInput = document.getElementById('cropper-zoom');
    const applyBtn = document.getElementById('cropper-apply');
    const cancelBtn = document.getElementById('cropper-cancel');
    if (!overlay || !previewEl || !zoomInput || !applyBtn || !cancelBtn) return;

    zoomInput.addEventListener('input', () => {
        if (!cropperState) return;
        cropperState.zoom = clamp(parseFloat(zoomInput.value), 1, 2.5);
        updateCropperPreview();
    });

    const startDrag = (clientX, clientY) => {
        if (!cropperState) return;
        cropperState.dragging = true;
        cropperState.startX = clientX;
        cropperState.startY = clientY;
        cropperState.startPosX = cropperState.x;
        cropperState.startPosY = cropperState.y;
        previewEl.classList.add('dragging');
    };

    const onMove = (clientX, clientY) => {
        if (!cropperState || !cropperState.dragging) return;
        const rect = previewEl.getBoundingClientRect();
        const dx = clientX - cropperState.startX;
        const dy = clientY - cropperState.startY;
        const nextX = cropperState.startPosX + (dx / rect.width) * 100;
        const nextY = cropperState.startPosY + (dy / rect.height) * 100;
        cropperState.x = clamp(nextX, 0, 100);
        cropperState.y = clamp(nextY, 0, 100);
        updateCropperPreview();
    };

    const endDrag = () => {
        if (!cropperState) return;
        cropperState.dragging = false;
        previewEl.classList.remove('dragging');
    };

    previewEl.addEventListener('mousedown', (event) => startDrag(event.clientX, event.clientY));
    window.addEventListener('mousemove', (event) => onMove(event.clientX, event.clientY));
    window.addEventListener('mouseup', endDrag);

    previewEl.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        startDrag(touch.clientX, touch.clientY);
    }, { passive: true });
    previewEl.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        onMove(touch.clientX, touch.clientY);
    }, { passive: true });
    previewEl.addEventListener('touchend', endDrag);

    applyBtn.addEventListener('click', () => {
        if (!cropperState) return;
        const { targetObj, positionKey, zoomKey, x, y, zoom } = cropperState;
        if (positionKey) targetObj[positionKey] = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
        if (zoomKey) targetObj[zoomKey] = Number(zoom.toFixed(2));
        renderPreview();
        closeImageCropper();
    });

    cancelBtn.addEventListener('click', closeImageCropper);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeImageCropper();
    });
}

function bindEmojiPickerEvents() {
    const overlay = document.getElementById('emoji-overlay');
    const grid = document.getElementById('emoji-grid');
    const closeBtn = document.getElementById('emoji-close');
    const clearBtn = document.getElementById('emoji-clear');
    if (!overlay || !grid || !closeBtn || !clearBtn) return;

    grid.innerHTML = '';
    EMOJI_CHOICES.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = () => {
            if (emojiPickerState?.onSelect) emojiPickerState.onSelect(emoji);
            closeEmojiPicker();
        };
        grid.appendChild(btn);
    });

    closeBtn.addEventListener('click', closeEmojiPicker);
    clearBtn.addEventListener('click', () => {
        if (emojiPickerState?.onSelect) emojiPickerState.onSelect('');
        closeEmojiPicker();
    });
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeEmojiPicker();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && emojiPickerState) closeEmojiPicker();
    });
}
async function restoreLocalConfigBackup(file) {
    const text = await file.text();
    let payload = null;
    try {
        payload = JSON.parse(text);
    } catch (err) {
        showMessage('Backup inválido.', 'error');
        return;
    }
    const repo = payload.repo || {};
    if (repo.owner) {
        repoInfo.owner = repo.owner;
        if (uiNodes.repoOwner) uiNodes.repoOwner.value = repo.owner;
        await setSecureItem(localStorage, REPO_OWNER_STORAGE, repo.owner);
    }
    if (repo.name) {
        repoInfo.repo = repo.name;
        if (uiNodes.repoName) uiNodes.repoName.value = repo.name;
        await setSecureItem(localStorage, REPO_NAME_STORAGE, repo.name);
    }
    if (payload.github_pat) {
        if (uiNodes.ghToken) uiNodes.ghToken.value = payload.github_pat;
        await auth.saveToken(payload.github_pat);
    }
    if (payload.openai_api_key) {
        if (uiNodes.openaiKey) uiNodes.openaiKey.value = payload.openai_api_key;
        await setSecureItem(localStorage, OPENAI_KEY_STORAGE, payload.openai_api_key);
    }
    showMessage('Backup restaurado.', 'success');
}

async function init() {
    await detectRepoInfo();
    bindEvents();
    bindCropperEvents();
    bindEmojiPickerEvents();
    switchView('editor');
    await hydrateSessionFields();
    await loadCV(false, false);
}

document.addEventListener('DOMContentLoaded', init);
