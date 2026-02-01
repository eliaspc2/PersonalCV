/**
 * config-ui.js
 * Admin UI for CV management.
 */

import * as auth from './auth-gate.js';
import * as gh from './github-api.js';
import { setSecureItem, getSecureItem, removeSecureItem } from './crypto-utils.js';
import { ICON_CHOICES, renderIcon, normalizeIconValue, isIconId } from './icon-set.js';
import { BASE_SECTIONS, CONFIG_PATH, CV_PATH, DEFAULT_PATHS, DEFAULT_THEME, LANGS, THEME_PRESETS, NAV_TYPE_ICON_IDS } from './constants.js';
import { validateCVSchema } from '../validators/schema-validate.js';
import { validateConsistency } from '../validators/cv-consistency.js';
import { formatErrorMessages } from '../validators/error-messages.js';

const uiNodes = {
    editor: document.getElementById('editor-ui'),
    editorForm: document.getElementById('section-editor'),
    previewPane: document.getElementById('preview-pane'),
    saveBtn: document.getElementById('save-btn'),
    backBtn: document.getElementById('back-btn'),
    themeBtn: document.getElementById('theme-btn'),
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
    highlights: { pt: 'Destaques', es: 'Destacados', en: 'Highlights' },
    mindset: { pt: 'Mentalidade', es: 'Mentalidad', en: 'Mindset' },
    now: { pt: 'Agora', es: 'Ahora', en: 'Now' },
    contact: { pt: 'Contacto', es: 'Contacto', en: 'Contact' }
};

const OPENAI_KEY_STORAGE = 'openai_api_key';
const REPO_OWNER_STORAGE = 'repo_owner';
const REPO_NAME_STORAGE = 'repo_name';
const PREVIEW_STORAGE = 'preview_cv';
const PREVIEW_CONFIG_STORAGE = 'preview_config';
const PREVIEW_SECTION_MAP = {};

let currentCV = null;
let currentConfig = null;
let currentSHA = null;
let configSHA = null;
let currentLang = 'pt';
let currentSection = 'overview';
let repoInfo = { owner: '', repo: '', path: CV_PATH };
let currentSource = 'local';
let currentStoryIndex = 0;
let currentHighlightIndex = 0;
let currentDownloadGroupIndex = 0;
let cropperState = null;
const pendingDownloadDeletes = new Set();
let iconPickerState = null;
let validationStatus = { critical: [], warnings: [] };
const availableFilesCache = { downloads: null, photos: null, icons: null };
let uploadQueue = Promise.resolve();

const NAV_SECTIONS = new Set(BASE_SECTIONS);

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
        'experience',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    highlights: [
        'title',
        'items',
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
        'opportunity_card',
        'resources',
        'details',
        'image',
        'image_alt',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link'
    ],
    contact: [
        'email_label',
        'title',
        'description',
        'next_label',
        'next_text',
        'cta_label',
        'cta_link',
        'downloads_title',
        'certifications_title',
        'cv_label',
        'extended_cv_label',
        'efa_label',
        'python_1_label',
        'python_2_label',
        'marketing_label',
        'linkedin_label',
        'github_label',
        'download_groups'
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
        'rh_value',
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
        'principle_title',
        'story_text',
        'engineering_note'
    ]
};

const SECTION_TEMPLATES = [
    { type: 'overview', name: { pt: 'Hero & Identidade', es: 'Hero & Identidad', en: 'Hero & Identity' } },
    { type: 'development', name: { pt: 'Grelha de Competências', es: 'Malla de Competencias', en: 'Skill Grid' } },
    { type: 'foundation', name: { pt: 'Timeline Técnica', es: 'Timeline Técnica', en: 'Technical Timeline' } },
    { type: 'highlights', name: { pt: 'Destaques Profissionais', es: 'Destacados Profesionales', en: 'Professional Highlights' } },
    { type: 'mindset', name: { pt: 'Cards & Filosofia', es: 'Cards & Filosofía', en: 'Cards & Philosophy' } },
    { type: 'now', name: { pt: 'Imagem + Call-to-Action', es: 'Imagen + CTA', en: 'Image + Call-to-Action' } },
    { type: 'contact', name: { pt: 'Contacto Central', es: 'Contacto Central', en: 'Centered Contact' } }
];

function normalizeFileName(name) {
    return name ? name.replace(/\s+/g, '-').toLowerCase() : 'image';
}

function normalizePathBase(value) {
    if (!value) return '';
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function uploadDownloadFile(file, targetName) {
    const token = await auth.getToken();
    if (!token || !repoInfo?.owner || !repoInfo?.repo) {
        showMessage('Token GitHub em falta: ficheiro não foi carregado.', 'error');
        return;
    }
    const base = normalizePathBase(getPaths().downloads);
    const repoPath = base ? `${base}/${targetName}` : targetName;
    try {
        await gh.uploadFile(repoInfo.owner, repoInfo.repo, repoPath, file, token, `Upload ${targetName} via Admin UI`);
        showMessage(`Ficheiro carregado: ${targetName}`, 'success');
        availableFilesCache.downloads = null;
    } catch (err) {
        showMessage(`Erro ao carregar ficheiro: ${err.message || err}`, 'error');
    }
}

function collectKnownDownloadFiles() {
    const files = new Set();
    if (currentCV?.profile?.downloads) {
        currentCV.profile.downloads.forEach((item) => {
            if (item?.href) files.add(stripAssetBase('downloads', item.href));
        });
    }
    if (currentCV?.localized) {
        Object.values(currentCV.localized).forEach((locale) => {
            if (!locale || typeof locale !== 'object') return;
            if (Array.isArray(locale.certifications)) {
                locale.certifications.forEach((cert) => {
                    if (cert?.href) files.add(stripAssetBase('downloads', cert.href));
                });
            }
            Object.values(locale).forEach((section) => {
                if (!section || typeof section !== 'object') return;
                if (Array.isArray(section.resources)) {
                    section.resources.forEach((res) => {
                        if (res?.href) files.add(stripAssetBase('downloads', res.href));
                    });
                }
                if (Array.isArray(section.skills)) {
                    section.skills.forEach((item) => {
                        if (item?.resource?.href) files.add(stripAssetBase('downloads', item.resource.href));
                    });
                }
            });
        });
    }
    return Array.from(files).filter(Boolean).sort();
}

async function loadAvailableFiles(kind) {
    if (availableFilesCache[kind]) return availableFilesCache[kind];
    let list = [];
    if (kind === 'downloads') {
        list = collectKnownDownloadFiles();
    }
    try {
        const token = await auth.getToken();
        if (token && repoInfo?.owner && repoInfo?.repo) {
            const basePath = getPaths()[kind] || '';
            const repoPath = normalizePathBase(basePath);
            if (repoPath) {
                const files = await gh.listRepoFiles(repoInfo.owner, repoInfo.repo, repoPath, token);
                const repoList = files
                    .filter((item) => item.type === 'file')
                    .map((item) => item.name);
                list = Array.from(new Set([...list, ...repoList]));
            }
        }
    } catch (err) {
        // ignore and keep fallback list
    }
    availableFilesCache[kind] = list;
    return list;
}

function buildFilePicker(kind, onSelect) {
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-input';
    const label = document.createElement('label');
    label.textContent = 'Ficheiros existentes';
    const select = document.createElement('select');
    select.innerHTML = '<option value="">Escolher ficheiro…</option>';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'toggle-visibility';
    reload.textContent = 'Atualizar';

    const populate = async () => {
        select.innerHTML = '<option value="">Escolher ficheiro…</option>';
        const list = await loadAvailableFiles(kind);
        list.forEach((file) => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            select.appendChild(option);
        });
    };

    select.onchange = () => {
        const value = select.value;
        if (value) onSelect(value);
    };
    reload.onclick = populate;

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    wrapper.appendChild(reload);
    populate();
    return wrapper;
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
            currentCV.meta.sections = currentCV.meta.section_order
                .filter((id) => typeof id === 'string' && id.trim())
                .map((id) => ({
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
    currentCV.meta.sections = currentCV.meta.sections.filter((section) => section && section.id);
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

function buildDefaultConfigFromCV() {
    const meta = currentCV?.meta || {};
    const theme = { ...DEFAULT_THEME, ...(meta.theme || {}) };
    if (!theme.accent_soft && theme.accent) {
        theme.accent_soft = hexToRgba(theme.accent, 0.08);
    }
    const paths = currentCV?.paths || {};
    return {
        paths: {
            photos: normalizeBasePath(paths.photos, DEFAULT_PATHS.photos),
            downloads: normalizeBasePath(paths.downloads, DEFAULT_PATHS.downloads),
            icons: normalizeBasePath(paths.icons, DEFAULT_PATHS.icons)
        },
        site: {
            title: meta.site_title || document.title || '',
            description: meta.site_description || '',
            favicon: meta.favicon || 'favicon.ico',
            apple_icon: meta.apple_icon || 'apple-touch-icon.png'
        },
        theme,
        layout: {
            section_padding_top: 8,
            section_padding_bottom: 0,
            snap: 'proximity'
        }
    };
}

function ensureConfig() {
    if (!currentConfig) {
        currentConfig = buildDefaultConfigFromCV();
    }
    if (!currentConfig.paths) currentConfig.paths = { ...DEFAULT_PATHS };
    currentConfig.paths.photos = normalizeBasePath(currentConfig.paths.photos, DEFAULT_PATHS.photos);
    currentConfig.paths.downloads = normalizeBasePath(currentConfig.paths.downloads, DEFAULT_PATHS.downloads);
    currentConfig.paths.icons = normalizeBasePath(currentConfig.paths.icons, DEFAULT_PATHS.icons);
    if (!currentConfig.site) currentConfig.site = {};
    if (!currentConfig.theme) currentConfig.theme = { ...DEFAULT_THEME };
    if (!currentConfig.theme.accent_soft && currentConfig.theme.accent) {
        currentConfig.theme.accent_soft = hexToRgba(currentConfig.theme.accent, 0.08);
    }
    if (!currentConfig.layout) {
        currentConfig.layout = {
            section_padding_top: 8,
            section_padding_bottom: 0,
            snap: 'proximity'
        };
    }
    return currentConfig;
}

function getPaths() {
    if (!currentCV && !currentConfig) return { ...DEFAULT_PATHS };
    const config = ensureConfig();
    return config.paths;
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
    ensureConfig();
    normalizeIconData();
    if (currentConfig?.site) {
        if (currentConfig.site.favicon) currentConfig.site.favicon = stripAssetBase('icons', currentConfig.site.favicon);
        if (currentConfig.site.apple_icon) currentConfig.site.apple_icon = stripAssetBase('icons', currentConfig.site.apple_icon);
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
            Object.entries(locale).forEach(([sectionKey, section]) => {
                if (sectionKey === 'navigation' && section && typeof section === 'object') {
                    Object.entries(section).forEach(([navKey, navVal]) => {
                        if (typeof navVal !== 'string') {
                            delete section[navKey];
                        }
                    });
                    delete section.image_position;
                    delete section.image_zoom;
                }
                if (!BASE_SECTIONS.includes(sectionKey)) {
                    return;
                }
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

function normalizeIconData() {
    if (!currentCV?.localized) return;
    Object.values(currentCV.localized).forEach((locale) => {
        if (!locale || typeof locale !== 'object') return;
        if (locale.navigation_icons) {
            Object.keys(locale.navigation_icons).forEach((key) => {
                const value = normalizeIconValue(locale.navigation_icons[key]);
                locale.navigation_icons[key] = isIconId(value) ? value : '';
            });
        }
        Object.entries(locale).forEach(([sectionKey, section]) => {
            if (!BASE_SECTIONS.includes(sectionKey)) return;
            if (!section || typeof section !== 'object') return;
            Object.entries(section).forEach(([key, val]) => {
                if (key === 'icon' && typeof val === 'string') {
                    const normalized = normalizeIconValue(val);
                    section[key] = isIconId(normalized) ? normalized : '';
                }
            });
            if (Array.isArray(section.skills)) {
                section.skills.forEach((item) => {
                    if (item?.icon) {
                        const normalized = normalizeIconValue(item.icon);
                        item.icon = isIconId(normalized) ? normalized : '';
                    }
                });
            }
            if (Array.isArray(section.experience)) {
                section.experience.forEach((item) => {
                    if (item?.icon) {
                        const normalized = normalizeIconValue(item.icon);
                        item.icon = isIconId(normalized) ? normalized : '';
                    }
                });
            }
            if (Array.isArray(section.blocks)) {
                section.blocks.forEach((item) => {
                    if (item?.icon) {
                        const normalized = normalizeIconValue(item.icon);
                        item.icon = isIconId(normalized) ? normalized : '';
                    }
                });
            }
        });
    });

    if (currentCV.profile && Array.isArray(currentCV.profile.downloads)) {
        currentCV.profile.downloads.forEach((item) => {
            if (item?.icon) {
                const normalized = normalizeIconValue(item.icon);
                item.icon = isIconId(normalized) ? normalized : '';
            }
        });
    }
}

function hexToRgba(hex, alpha = 0.08) {
    const clean = String(hex || '').replace('#', '').trim();
    if (![3, 6].includes(clean.length)) return `rgba(59, 130, 246, ${alpha})`;
    const value = clean.length === 3
        ? clean.split('').map((ch) => ch + ch).join('')
        : clean;
    const int = parseInt(value, 16);
    if (Number.isNaN(int)) return `rgba(59, 130, 246, ${alpha})`;
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureThemeConfig() {
    if (!currentCV && !currentConfig) return DEFAULT_THEME;
    const config = ensureConfig();
    if (!config.theme) config.theme = { ...DEFAULT_THEME };
    const theme = config.theme;
    Object.entries(DEFAULT_THEME).forEach(([key, value]) => {
        if (!theme[key]) theme[key] = value;
    });
    if (!theme.accent_soft && theme.accent) {
        theme.accent_soft = hexToRgba(theme.accent, 0.08);
    }
    return theme;
}

function applyAdminTheme() {
    if (!currentCV && !currentConfig) return;
    const theme = ensureThemeConfig();
    const root = document.documentElement;
    root.style.setProperty('--bg-app', theme.bg_app);
    root.style.setProperty('--bg-sidebar', theme.bg_sidebar);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-soft', theme.accent_soft || hexToRgba(theme.accent, 0.08));
    root.style.setProperty('--text-main', theme.text_main);
    root.style.setProperty('--text-muted', theme.text_muted);
    root.style.setProperty('--text-dim', theme.text_dim);
    root.style.setProperty('--border', theme.border);
    document.body.classList.add('config-themed');
}

function renderThemeEditor(container) {
    if (!container || (!currentCV && !currentConfig)) return;
    const theme = ensureThemeConfig();
    container.innerHTML = '';

    const presetRow = document.createElement('div');
    presetRow.className = 'form-group';
    const presetLabel = document.createElement('label');
    presetLabel.textContent = 'Sugestões';
    presetRow.appendChild(presetLabel);
    const presetList = document.createElement('div');
    presetList.className = 'preset-row';
    THEME_PRESETS.forEach((preset) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toggle-visibility';
        btn.textContent = preset.name;
        btn.onclick = () => {
            const next = { ...theme, ...preset.theme };
            next.accent_soft = hexToRgba(next.accent, 0.08);
            const config = ensureConfig();
            config.theme = next;
            renderThemeEditor(container);
            renderPreview();
            applyAdminTheme();
        };
        presetList.appendChild(btn);
    });
    presetRow.appendChild(presetList);
    container.appendChild(presetRow);

    const colorFields = [
        { key: 'accent', label: 'Cor principal (accent)' },
        { key: 'primary', label: 'Cor de destaque (primary)' },
        { key: 'bg_app', label: 'Fundo da app' },
        { key: 'bg_sidebar', label: 'Fundo do menu' },
        { key: 'text_main', label: 'Texto principal' },
        { key: 'text_muted', label: 'Texto secundário' },
        { key: 'text_dim', label: 'Texto suave' },
        { key: 'border', label: 'Bordas' }
    ];

    let softInput = null;
    colorFields.forEach((field) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = field.label;
        const input = document.createElement('input');
        input.type = 'color';
        input.value = theme[field.key] || DEFAULT_THEME[field.key];
        input.oninput = (event) => {
            theme[field.key] = event.target.value;
            if (field.key === 'accent') {
                theme.accent_soft = hexToRgba(theme.accent, 0.08);
                if (softInput) softInput.value = theme.accent_soft;
            }
            renderPreview();
            applyAdminTheme();
        };
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });

    const softWrapper = document.createElement('div');
    softWrapper.className = 'form-group';
    const softLabel = document.createElement('label');
    softLabel.textContent = 'Accent suave (auto)';
    softInput = document.createElement('input');
    softInput.type = 'text';
    softInput.value = theme.accent_soft || hexToRgba(theme.accent, 0.08);
    softInput.oninput = (event) => {
        theme.accent_soft = event.target.value;
        renderPreview();
        applyAdminTheme();
    };
    softWrapper.appendChild(softLabel);
    softWrapper.appendChild(softInput);
    container.appendChild(softWrapper);
}

function openThemeModal() {
    const overlay = document.getElementById('theme-overlay');
    const body = document.getElementById('theme-editor-body');
    if (!overlay || !body) return;
    renderThemeEditor(body);
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeThemeModal() {
    const overlay = document.getElementById('theme-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
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
    return entries.filter(([key]) => !isHiddenFieldKey(key));
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
    return keys.filter((key) => !isHiddenFieldKey(key));
}

function getStoryFieldLabel(type, key) {
    const skillMap = {
        title: 'Título do cartão',
        focus_area: 'Área de foco',
        progress_status: 'Estado',
        duration_hours: 'Duração',
        context_text: 'Contexto',
        background: 'Histórico',
        rh_value: 'Valor para RH',
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
        name: 'Nome',
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
        cv_label: 'Etiqueta do CV',
        extended_cv_label: 'Etiqueta do CV extendido',
        efa_label: 'Etiqueta do conteúdo programático',
        python_1_label: 'Etiqueta do certificado Python I',
        python_2_label: 'Etiqueta do certificado Python II',
        marketing_label: 'Etiqueta do certificado Marketing',
        cta_label: 'Texto do CTA',
        cta_link: 'Link do CTA',
        challenge_label: 'Etiqueta “Desafio”',
        learning_label: 'Etiqueta “Aprendizagem”',
        impact_label: 'Etiqueta “Impacto”',
        image: 'Imagem',
        image_alt: 'Legenda da imagem',
        photo: 'Foto',
        contact_photo: 'Foto',
        work_photo: 'Foto'
    };
    return map[key] || key;
}

function isHiddenFieldKey(key) {
    return typeof key === 'string' && (key === 'availability_badge' || key.endsWith('_position') || key.endsWith('_zoom'));
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

function openIconPicker(onSelect) {
    const overlay = document.getElementById('icon-overlay');
    if (!overlay) return;
    iconPickerState = { onSelect };
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeIconPicker() {
    const overlay = document.getElementById('icon-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    iconPickerState = null;
}

function makeIconField(wrapper, targetObj, key, placeholder = 'ex: home', options = {}) {
    const config = typeof options === 'object' && options ? options : {};
    const row = document.createElement('div');
    row.className = 'icon-input';
    let preview = null;
    preview = document.createElement('span');
    preview.className = 'icon-input-preview';
    row.appendChild(preview);
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.defaultIconId || placeholder;
    const initialValue = normalizeIconValue(targetObj[key] || '');
    targetObj[key] = isIconId(initialValue) ? initialValue : '';
    input.value = targetObj[key] || '';

    const updatePreview = () => {
        const value = String(input.value || '').trim();
        const iconId = value || config.defaultIconId || '';
        if (value) {
            preview.innerHTML = renderIcon(value, 'nav-icon');
        } else if (config.defaultIcon) {
            preview.innerHTML = config.defaultIcon;
        } else {
            preview.textContent = '';
        }
    };

    input.oninput = (event) => {
        const normalized = normalizeIconValue(event.target.value);
        targetObj[key] = isIconId(normalized) ? normalized : '';
        input.value = targetObj[key];
        renderPreview();
        updatePreview();
    };
    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'toggle-visibility';
    pickBtn.textContent = 'Escolher';
    pickBtn.onclick = () => {
        openIconPicker((iconId) => {
            const normalized = normalizeIconValue(iconId);
            input.value = isIconId(normalized) ? normalized : '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };
    updatePreview();
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
    } else if (type === 'highlights') {
        sketch.style.gridTemplateColumns = '1fr';
        for (let i = 0; i < 3; i += 1) {
            const row = document.createElement('div');
            row.className = 'sketch-card';
            row.style.height = '18px';
            sketch.appendChild(row);
        }
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
    if (type === 'highlights') {
        return {
            title: '',
            items: [],
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
            opportunity_card: {
                enabled: true,
                icon: 'check',
                title: '',
                subtitle: '',
                tags: []
            },
            next_label: '',
            next_text: '',
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
            next_label: '',
            next_text: '',
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
    const defaultIconId = NAV_TYPE_ICON_IDS[sectionType] || NAV_TYPE_ICON_IDS.overview;
    const defaultIcon = renderIcon(defaultIconId, 'nav-icon');
    makeIconField(iconWrapper, icons, sectionKey, 'ex: home', { showPreview: true, defaultIcon, defaultIconId });
    fieldset.appendChild(iconWrapper);

    const sectionsMeta = getSectionsMeta();
    const sectionMeta = sectionsMeta.find((section) => section.id === sectionKey);
    if (sectionMeta) {
        if (sectionMeta.hidden === undefined) sectionMeta.hidden = false;
        const hiddenWrap = document.createElement('div');
        hiddenWrap.className = 'inline-input';
        const hiddenLabel = document.createElement('label');
        hiddenLabel.textContent = 'Ocultar página';
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'checkbox';
        hiddenInput.checked = Boolean(sectionMeta.hidden);
        hiddenInput.onchange = (event) => {
            sectionMeta.hidden = event.target.checked;
            renderSidebar();
            renderPreview();
        };
        hiddenWrap.appendChild(hiddenLabel);
        hiddenWrap.appendChild(hiddenInput);
        fieldset.appendChild(hiddenWrap);
    }

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
        if (baseFolder && baseFolder.includes('downloads')) {
            uploadQueue = uploadQueue.then(() => uploadDownloadFile(file, safeName));
        }
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

function makeTagListField(wrapper, targetObj, key, values = []) {
    const list = document.createElement('div');
    list.className = 'story-list';

    const renderItems = () => {
        list.innerHTML = '';
        values.forEach((tag, index) => {
            const row = document.createElement('div');
            row.className = 'array-card tag-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = tag.label || '';
            input.oninput = (event) => {
                values[index] = { ...tag, label: event.target.value };
                targetObj[key] = values;
                renderPreview();
            };
            const iconWrap = document.createElement('div');
            iconWrap.className = 'form-group';
            makeIconField(iconWrap, values[index], 'icon', 'ex: globe');

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
            const removeRow = document.createElement('div');
            removeRow.className = 'tag-remove';
            removeRow.appendChild(removeBtn);
            row.appendChild(input);
            row.appendChild(iconWrap);
            row.appendChild(removeRow);
            list.appendChild(row);
        });
    };

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'toggle-visibility';
    addBtn.textContent = '+ Adicionar';
    addBtn.onclick = () => {
        values.push({ label: '', icon: 'globe' });
        targetObj[key] = values;
        renderItems();
        renderPreview();
    };

    renderItems();
    wrapper.appendChild(list);
    wrapper.appendChild(addBtn);
    targetObj[key] = values;
}

function makeResourceListField(wrapper, targetObj, key, values = [], options = {}) {
    const list = document.createElement('div');
    list.className = 'story-list';
    const downloadsBase = getPaths().downloads;
    const withViewer = Boolean(options.withViewer);

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
            hrefInput.placeholder = 'Link ou ficheiro';
            hrefInput.value = stripAssetBase('downloads', entry.href || '');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.png,.jpg,.jpeg,.webp';
            const typeSelect = document.createElement('select');
            const fileOption = document.createElement('option');
            fileOption.value = 'file';
            fileOption.textContent = 'Ficheiro (leitor)';
            const linkOption = document.createElement('option');
            linkOption.value = 'link';
            linkOption.textContent = 'Link externo';
            typeSelect.appendChild(fileOption);
            typeSelect.appendChild(linkOption);
            const isExternal = /^(https?:|mailto:|tel:)/.test(entry.href || '');
            typeSelect.value = isExternal ? 'link' : 'file';
            fileInput.onchange = (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const safeName = normalizeFileName(file.name);
                hrefInput.value = safeName;
                hrefInput.dispatchEvent(new Event('input', { bubbles: true }));
                uploadQueue = uploadQueue.then(() => uploadDownloadFile(file, safeName));
            };

            const sync = () => {
                const rawHref = hrefInput.value.trim();
                const isLink = /^(https?:|mailto:|tel:)/.test(rawHref);
                const normalizedHref = isLink ? rawHref : stripAssetBase('downloads', rawHref);
                if (hrefInput.value !== normalizedHref) hrefInput.value = normalizedHref;
                const viewer = withViewer ? (entry.viewer !== false) : undefined;
                values[index] = withViewer
                    ? { ...entry, label: labelInput.value, href: normalizedHref, viewer }
                    : { ...entry, label: labelInput.value, href: normalizedHref };
                targetObj[key] = values;
                renderPreview();
            };

            labelInput.oninput = sync;
            hrefInput.oninput = sync;

            inputs.appendChild(labelInput);
            inputs.appendChild(hrefInput);
            inputs.appendChild(typeSelect);
            inputs.appendChild(fileInput);

            const picker = buildFilePicker('downloads', (value) => {
                hrefInput.value = value;
                hrefInput.dispatchEvent(new Event('input', { bubbles: true }));
            });
            inputs.appendChild(picker);

            if (withViewer) {
                const viewerWrap = document.createElement('div');
                viewerWrap.className = 'inline-input';
                const viewerLabel = document.createElement('label');
                viewerLabel.textContent = 'Abrir no leitor do site';
                const viewerInput = document.createElement('input');
                viewerInput.type = 'checkbox';
                viewerInput.checked = entry.viewer !== false;
                viewerInput.onchange = (event) => {
                    entry.viewer = event.target.checked;
                    sync();
                };
                viewerWrap.appendChild(viewerLabel);
                viewerWrap.appendChild(viewerInput);
                inputs.appendChild(viewerWrap);
            }

            typeSelect.onchange = () => {
                const isLink = typeSelect.value === 'link';
                if (isLink) {
                    if (!/^(https?:|mailto:|tel:)/.test(hrefInput.value)) {
                        hrefInput.value = '';
                    }
                    if (withViewer) {
                        entry.viewer = false;
                    }
                } else {
                    if (/^(https?:|mailto:|tel:)/.test(hrefInput.value)) {
                        hrefInput.value = '';
                    }
                    if (withViewer) {
                        entry.viewer = true;
                    }
                }
                sync();
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
    hrefInput.placeholder = 'Link ou ficheiro';
    hrefInput.value = stripAssetBase('downloads', resource.href || '');
    const typeSelect = document.createElement('select');
    const fileOption = document.createElement('option');
    fileOption.value = 'file';
    fileOption.textContent = 'Ficheiro (leitor)';
    const linkOption = document.createElement('option');
    linkOption.value = 'link';
    linkOption.textContent = 'Link externo';
    typeSelect.appendChild(fileOption);
    typeSelect.appendChild(linkOption);
    const isExternal = /^(https?:|mailto:|tel:)/.test(resource.href || '');
    typeSelect.value = isExternal ? 'link' : 'file';
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
        const rawHref = hrefInput.value.trim();
        const isLink = /^(https?:|mailto:|tel:)/.test(rawHref);
        const normalizedHref = isLink ? rawHref : stripAssetBase('downloads', rawHref);
        if (hrefInput.value !== normalizedHref) hrefInput.value = normalizedHref;
        targetObj[key] = {
            ...(resource || {}),
            label: labelInput.value,
            href: normalizedHref,
            viewer: resource.viewer !== false
        };
        renderPreview();
    };

    labelInput.oninput = sync;
    hrefInput.oninput = sync;

    labelRow.appendChild(labelInput);
    hrefRow.appendChild(hrefInput);
    hrefRow.appendChild(typeSelect);
    hrefRow.appendChild(fileInput);
    wrapper.appendChild(labelRow);
    wrapper.appendChild(hrefRow);

    const viewerRow = document.createElement('div');
    viewerRow.className = 'form-group';
    const viewerLabel = document.createElement('label');
    viewerLabel.textContent = 'Abrir no leitor do site';
    const viewerInput = document.createElement('input');
    viewerInput.type = 'checkbox';
    viewerInput.checked = resource.viewer !== false;
    viewerInput.onchange = (event) => {
        resource.viewer = event.target.checked;
        sync();
    };
    viewerRow.appendChild(viewerLabel);
    viewerRow.appendChild(viewerInput);
    wrapper.appendChild(viewerRow);

    typeSelect.onchange = () => {
        const isLink = typeSelect.value === 'link';
        if (isLink) {
            if (!/^(https?:|mailto:|tel:)/.test(hrefInput.value)) {
                hrefInput.value = '';
            }
            resource.viewer = false;
        } else {
            if (/^(https?:|mailto:|tel:)/.test(hrefInput.value)) {
                hrefInput.value = '';
            }
            resource.viewer = true;
        }
        viewerInput.checked = resource.viewer !== false;
        sync();
    };
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
    if (baseFolder && baseFolder.includes('downloads')) {
        const picker = buildFilePicker('downloads', (value) => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        row.appendChild(picker);
    }
    wrapper.appendChild(label);
    wrapper.appendChild(row);
}

function createDownloadItem(input) {
    const data = input && typeof input === 'object' ? input : {};
    const {
        label = '',
        icon = '',
        href = '',
        group = 'downloads',
        viewer
    } = data;
    const entry = {
        label,
        icon,
        href,
        group: group || 'downloads'
    };
    if (viewer !== undefined) entry.viewer = viewer;
    return entry;
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
                label: contact.downloads_title || 'Downloads'
            });
        }
        if (contact.certifications_title || hasCerts) {
            groups.push({
                id: 'certs',
                label: contact.certifications_title || 'Certificações'
            });
        }
        if (!groups.length) {
            groups.push({
                id: 'downloads',
                label: contact.downloads_title || 'Downloads'
            });
        }
        contact.download_groups = groups;
    }
    contact.download_groups = contact.download_groups.map((group, index) => ({
        id: group?.id || `grupo-${index + 1}`,
        label: group?.label || group?.id || `Grupo ${index + 1}`
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

async function runValidation() {
    if (!currentCV) return { critical: [], warnings: [] };
    const schemaResult = await validateCVSchema(currentCV);
    const consistency = validateConsistency(currentCV);
    const lang = currentLang || currentCV.meta?.defaultLanguage || 'pt';
    const criticalMessages = formatErrorMessages(schemaResult.errors, lang)
        .concat(formatErrorMessages(consistency.critical, lang));
    const warningMessages = formatErrorMessages(consistency.warnings, lang);
    validationStatus = {
        critical: criticalMessages,
        warnings: warningMessages
    };
    if (criticalMessages.length) {
        showMessage(criticalMessages[0], 'error');
    } else if (warningMessages.length) {
        showMessage(warningMessages[0], 'info');
    }
    return validationStatus;
}

async function syncPreviewStorage() {
    if (!currentCV) return;
    await setSecureItem(sessionStorage, PREVIEW_STORAGE, JSON.stringify(currentCV));
    if (currentConfig) {
        await setSecureItem(sessionStorage, PREVIEW_CONFIG_STORAGE, JSON.stringify(currentConfig));
    }
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
        return `Repositório ou caminho não encontrado. Confirma owner/repo e o caminho ${CV_PATH}.`;
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
    const direct = new URL(CV_PATH, base).toString();
    const relative = `./${CV_PATH}`;
    const root = `${window.location.origin}${window.location.pathname.replace(/config\\.html.*$/i, '')}${CV_PATH}`;
    const data = await fetchJsonWithFallback([direct, relative, root]);
    return { data, sha: null };
}

async function loadGitHubCV(token) {
    if (!repoInfo.owner || !repoInfo.repo) {
        throw new Error('Indica owner e repo para carregar via GitHub.');
    }
    return gh.fetchCVData(repoInfo.owner, repoInfo.repo, repoInfo.path, token);
}

async function loadLocalConfig() {
    const base = window.location.href;
    const direct = new URL(CONFIG_PATH, base).toString();
    const relative = `./${CONFIG_PATH}`;
    const root = `${window.location.origin}${window.location.pathname.replace(/config\\.html.*$/i, '')}${CONFIG_PATH}`;
    try {
        const data = await fetchJsonWithFallback([direct, relative, root]);
        return { data, sha: null };
    } catch (err) {
        return { data: buildDefaultConfigFromCV(), sha: null };
    }
}

async function loadGitHubConfig(token) {
    if (!repoInfo.owner || !repoInfo.repo) {
        throw new Error('Indica owner e repo para carregar via GitHub.');
    }
    try {
        return await gh.fetchCVData(repoInfo.owner, repoInfo.repo, CONFIG_PATH, token);
    } catch (err) {
        return { data: buildDefaultConfigFromCV(), sha: null };
    }
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
            const configResult = await loadGitHubConfig(token);
            currentSource = 'github';
            currentCV = result.data;
            currentSHA = result.sha;
            currentConfig = configResult.data;
            configSHA = configResult.sha;
            showMessage('cv.json carregado via GitHub.', 'success');
        } else {
            const result = await loadLocalCV();
            const configResult = await loadLocalConfig();
            currentSource = 'local';
            currentCV = result.data;
            currentSHA = null;
            currentConfig = configResult.data;
            configSHA = null;
            showMessage('cv.json carregado localmente.', 'info');
        }
        normalizeAssetPaths();
        applyAdminTheme();
        ensureSectionDefinitions();
        await runValidation();
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
    const longKeys = ['description', 'intro_text', 'bio', 'details', 'summary', 'philosophy', 'subtitle', 'marketing_note', 'next_text', 'context_text', 'background', 'summary_text', 'details_text', 'intro_quote', 'challenge_text', 'key_learning_text', 'present_link', 'story_text', 'engineering_note', 'transition'];
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
            iconLabel.textContent = 'Ícone';
            iconGroup.appendChild(iconLabel);
            makeIconField(iconGroup, entry, 'icon', 'ex: folder');
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

            const typeWrapper = document.createElement('div');
            typeWrapper.className = 'form-group';
            const typeLabel = document.createElement('label');
            typeLabel.textContent = 'Tipo de link';
            const typeSelect = document.createElement('select');
            const fileOption = document.createElement('option');
            fileOption.value = 'file';
            fileOption.textContent = 'Ficheiro (leitor)';
            const linkOption = document.createElement('option');
            linkOption.value = 'link';
            linkOption.textContent = 'Link externo';
            typeSelect.appendChild(fileOption);
            typeSelect.appendChild(linkOption);
            const isExternal = /^(https?:|mailto:|tel:)/.test(entry.href || '');
            typeSelect.value = isExternal ? 'link' : 'file';
            typeWrapper.appendChild(typeLabel);
            typeWrapper.appendChild(typeSelect);
            fieldset.appendChild(typeWrapper);

            const viewerGroup = document.createElement('div');
            viewerGroup.className = 'form-group';
            const viewerLabel = document.createElement('label');
            viewerLabel.textContent = 'Abrir no leitor do site';
            const viewerInput = document.createElement('input');
            viewerInput.type = 'checkbox';
            viewerInput.checked = entry.viewer !== false;
            viewerInput.onchange = (event) => {
                entry.viewer = event.target.checked;
                renderPreview();
            };
            viewerGroup.appendChild(viewerLabel);
            viewerGroup.appendChild(viewerInput);
            fieldset.appendChild(viewerGroup);

            typeSelect.onchange = () => {
                const isLink = typeSelect.value === 'link';
                if (isLink) {
                    if (!/^(https?:|mailto:|tel:)/.test(entry.href || '')) {
                        entry.href = '';
                    }
                    entry.viewer = false;
                    viewerInput.checked = false;
                    viewerInput.disabled = true;
                } else {
                    if (/^(https?:|mailto:|tel:)/.test(entry.href || '')) {
                        entry.href = '';
                    }
                    entry.viewer = true;
                    viewerInput.checked = true;
                    viewerInput.disabled = false;
                }
                renderAll();
                renderPreview();
            };
            if (isExternal) {
                viewerInput.disabled = true;
            }

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
            label: `Grupo ${nextIndex}`
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
        if (sectionContent) {
            const fieldset = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = 'Disponibilidade';
            fieldset.appendChild(legend);

            if (!sectionContent.availability_badge) {
                sectionContent.availability_badge = { enabled: true, status: '', label: '' };
            }
            if (sectionContent.availability_badge.enabled === undefined) {
                sectionContent.availability_badge.enabled = true;
            }

            const enabledWrap = document.createElement('div');
            enabledWrap.className = 'inline-input';
            const enabledLabel = document.createElement('label');
            enabledLabel.textContent = 'Mostrar badge';
            const enabledInput = document.createElement('input');
            enabledInput.type = 'checkbox';
            enabledInput.checked = Boolean(sectionContent.availability_badge.enabled);
            enabledInput.onchange = (event) => {
                sectionContent.availability_badge.enabled = event.target.checked;
                renderPreview();
            };
            enabledWrap.appendChild(enabledLabel);
            enabledWrap.appendChild(enabledInput);
            fieldset.appendChild(enabledWrap);

            const statusWrap = document.createElement('div');
            statusWrap.className = 'form-group';
            const statusLabel = document.createElement('label');
            statusLabel.textContent = 'Texto superior';
            const statusInput = document.createElement('input');
            statusInput.type = 'text';
            statusInput.value = sectionContent.availability_badge.status || '';
            statusInput.oninput = (event) => {
                sectionContent.availability_badge.status = event.target.value;
                renderPreview();
            };
            statusWrap.appendChild(statusLabel);
            statusWrap.appendChild(statusInput);
            fieldset.appendChild(statusWrap);

            const labelWrap = document.createElement('div');
            labelWrap.className = 'form-group';
            const labelLabel = document.createElement('label');
            labelLabel.textContent = 'Texto principal';
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.value = sectionContent.availability_badge.label || '';
            labelInput.oninput = (event) => {
                sectionContent.availability_badge.label = event.target.value;
                renderPreview();
            };
            labelWrap.appendChild(labelLabel);
            labelWrap.appendChild(labelInput);
            fieldset.appendChild(labelWrap);

            uiNodes.editorForm.appendChild(fieldset);
        }
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
        ensureConfig();
        pendingFieldsets.push(() => {
            const iconsBase = getPaths().icons;
            const metaFieldset = document.createElement('fieldset');
            const metaLegend = document.createElement('legend');
            metaLegend.textContent = 'Site (Meta)';
            metaFieldset.appendChild(metaLegend);
            const siteConfig = currentConfig.site || {};
            const metaFields = [
                { key: 'title', label: 'Título do site', defaultValue: siteConfig.title || document.title || '' },
                { key: 'description', label: 'Descrição do site', multiline: true, defaultValue: siteConfig.description || (document.querySelector('meta[name="description"]')?.getAttribute('content') || '') },
                { key: 'favicon', label: 'Favicon (path)', isImage: true, defaultValue: stripAssetBase('icons', siteConfig.favicon || (document.getElementById('site-favicon')?.getAttribute('href') || `${iconsBase}favicon.ico`)) },
                { key: 'apple_icon', label: 'Apple touch icon (path)', isImage: true, defaultValue: stripAssetBase('icons', siteConfig.apple_icon || (document.getElementById('apple-touch-icon')?.getAttribute('href') || `${iconsBase}apple-touch-icon.png`)) }
            ];
            metaFields.forEach((field) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'form-group';
                const label = document.createElement('label');
                label.textContent = field.label;
                wrapper.appendChild(label);
                if (field.isImage) {
                    if (!siteConfig[field.key]) siteConfig[field.key] = field.defaultValue || '';
                    makeImageField(wrapper, siteConfig, field.key, 'meta');
                } else {
                    const input = field.multiline ? document.createElement('textarea') : document.createElement('input');
                    if (!siteConfig[field.key]) siteConfig[field.key] = field.defaultValue || '';
                    input.value = siteConfig[field.key] || '';
                    input.oninput = (event) => {
                        siteConfig[field.key] = event.target.value;
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

        pendingFieldsets.push(() => {
            const config = ensureConfig();
            if (!config.layout) {
                config.layout = { section_padding_top: 8, section_padding_bottom: 0, snap: 'proximity' };
            }
            const fieldset = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = 'Layout (scroll)';
            fieldset.appendChild(legend);

            const topWrap = document.createElement('div');
            topWrap.className = 'form-group';
            const topLabel = document.createElement('label');
            topLabel.textContent = 'Padding topo (px)';
            const topInput = document.createElement('input');
            topInput.type = 'number';
            topInput.min = '0';
            topInput.value = config.layout.section_padding_top ?? 8;
            topInput.oninput = (event) => {
                config.layout.section_padding_top = Number(event.target.value || 0);
                renderPreview();
            };
            topWrap.appendChild(topLabel);
            topWrap.appendChild(topInput);
            fieldset.appendChild(topWrap);

            const bottomWrap = document.createElement('div');
            bottomWrap.className = 'form-group';
            const bottomLabel = document.createElement('label');
            bottomLabel.textContent = 'Padding base (px)';
            const bottomInput = document.createElement('input');
            bottomInput.type = 'number';
            bottomInput.min = '0';
            bottomInput.value = config.layout.section_padding_bottom ?? 0;
            bottomInput.oninput = (event) => {
                config.layout.section_padding_bottom = Number(event.target.value || 0);
                renderPreview();
            };
            bottomWrap.appendChild(bottomLabel);
            bottomWrap.appendChild(bottomInput);
            fieldset.appendChild(bottomWrap);

            const snapWrap = document.createElement('div');
            snapWrap.className = 'form-group';
            const snapLabel = document.createElement('label');
            snapLabel.textContent = 'Scroll snap';
            const snapSelect = document.createElement('select');
            [
                { value: 'proximity', label: 'Suave (proximity)' },
                { value: 'mandatory', label: 'Forte (mandatory)' },
                { value: 'none', label: 'Desligado' }
            ].forEach((optionDef) => {
                const option = document.createElement('option');
                option.value = optionDef.value;
                option.textContent = optionDef.label;
                if ((config.layout.snap || 'proximity') === optionDef.value) option.selected = true;
                snapSelect.appendChild(option);
            });
            snapSelect.onchange = (event) => {
                config.layout.snap = event.target.value;
                renderPreview();
            };
            snapWrap.appendChild(snapLabel);
            snapWrap.appendChild(snapSelect);
            fieldset.appendChild(snapWrap);

            uiNodes.editorForm.appendChild(fieldset);
        });
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

    if (sectionType === 'development') {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = 'Agregados';
        fieldset.appendChild(legend);

        if (content.show_aggregated_technologies === undefined) {
            content.show_aggregated_technologies = true;
        }
        if (content.show_aggregated_competencies === undefined) {
            content.show_aggregated_competencies = true;
        }

        const techWrap = document.createElement('div');
        techWrap.className = 'inline-input';
        const techLabel = document.createElement('label');
        techLabel.textContent = 'Mostrar tecnologias agregadas';
        const techInput = document.createElement('input');
        techInput.type = 'checkbox';
        techInput.checked = Boolean(content.show_aggregated_technologies);
        techInput.onchange = (event) => {
            content.show_aggregated_technologies = event.target.checked;
            renderPreview();
        };
        techWrap.appendChild(techLabel);
        techWrap.appendChild(techInput);
        fieldset.appendChild(techWrap);

        const compWrap = document.createElement('div');
        compWrap.className = 'inline-input';
        const compLabel = document.createElement('label');
        compLabel.textContent = 'Mostrar competências agregadas';
        const compInput = document.createElement('input');
        compInput.type = 'checkbox';
        compInput.checked = Boolean(content.show_aggregated_competencies);
        compInput.onchange = (event) => {
            content.show_aggregated_competencies = event.target.checked;
            renderPreview();
        };
        compWrap.appendChild(compLabel);
        compWrap.appendChild(compInput);
        fieldset.appendChild(compWrap);

        uiNodes.editorForm.appendChild(fieldset);
    }

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
        makeResourceListField(wrapper, locale, 'certifications', [...locale.certifications], { withViewer: true });
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
        if (isHiddenFieldKey(key)) return;
        if (currentSection === 'overview' && key === 'intro_text' && !certsRendered) {
            renderCertificationsFieldset();
        }
        if (currentSection === 'contact' && key === 'download_groups') {
            renderDownloadsEditor();
            return;
        }
        if (currentSection === 'now' && key === 'resources') {
            const fieldset = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = 'Recursos';
            fieldset.appendChild(legend);
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';
            if (!Array.isArray(content.resources)) content.resources = [];
            makeResourceListField(wrapper, content, 'resources', [...content.resources], { withViewer: true });
            fieldset.appendChild(wrapper);
            uiNodes.editorForm.appendChild(fieldset);
            return;
        }
        if (currentSection === 'now' && key === 'opportunity_card') {
            return;
        }
        if (sectionType === 'highlights' && key === 'items') {
            renderHighlightsEditor(content);
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
        if (key === 'availability_badge') {
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
        } else if (typeof value === 'boolean') {
            const inline = document.createElement('div');
            inline.className = 'inline-input';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = Boolean(value);
            checkbox.onchange = (event) => {
                content[key] = event.target.checked;
                renderPreview();
            };
            inline.appendChild(label);
            inline.appendChild(checkbox);
            wrapper.appendChild(inline);
            wrapper.classList.add('form-group-inline');
            uiNodes.editorForm.appendChild(wrapper);
            return;
        } else if (typeof value === 'string') {
            if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                makeImageField(wrapper, content, key, currentSection);
            } else if (key === 'icon') {
                makeIconField(wrapper, content, key, 'ex: star');
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

    if (sectionType === 'now') {
        const card = content.opportunity_card || (content.opportunity_card = { enabled: true, icon: 'check', title: '', subtitle: '', tags: [] });
        if (!Array.isArray(card.tags)) card.tags = [];
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = 'Cartão de disponibilidade';
        fieldset.appendChild(legend);

        const enabledWrap = document.createElement('div');
        enabledWrap.className = 'inline-input';
        const enabledLabel = document.createElement('label');
        enabledLabel.textContent = 'Mostrar cartão';
        const enabledInput = document.createElement('input');
        enabledInput.type = 'checkbox';
        enabledInput.checked = card.enabled !== false;
        enabledInput.onchange = (event) => {
            card.enabled = event.target.checked;
            renderPreview();
        };
        enabledWrap.appendChild(enabledLabel);
        enabledWrap.appendChild(enabledInput);
        fieldset.appendChild(enabledWrap);

        const iconWrap = document.createElement('div');
        iconWrap.className = 'form-group';
        const iconLabel = document.createElement('label');
        iconLabel.textContent = 'Ícone';
        iconWrap.appendChild(iconLabel);
        makeIconField(iconWrap, card, 'icon', 'ex: check');
        fieldset.appendChild(iconWrap);

        const titleWrap = document.createElement('div');
        titleWrap.className = 'form-group';
        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'Título';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = card.title || '';
        titleInput.oninput = (event) => {
            card.title = event.target.value;
            renderPreview();
        };
        titleWrap.appendChild(titleLabel);
        titleWrap.appendChild(titleInput);
        fieldset.appendChild(titleWrap);

        const subtitleWrap = document.createElement('div');
        subtitleWrap.className = 'form-group';
        const subtitleLabel = document.createElement('label');
        subtitleLabel.textContent = 'Subtítulo';
        const subtitleInput = document.createElement('input');
        subtitleInput.type = 'text';
        subtitleInput.value = card.subtitle || '';
        subtitleInput.oninput = (event) => {
            card.subtitle = event.target.value;
            renderPreview();
        };
        subtitleWrap.appendChild(subtitleLabel);
        subtitleWrap.appendChild(subtitleInput);
        fieldset.appendChild(subtitleWrap);

        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'form-group';
        const tagsLabel = document.createElement('label');
        tagsLabel.textContent = 'Tags';
        tagsWrap.appendChild(tagsLabel);
        makeTagListField(tagsWrap, card, 'tags', [...card.tags]);
        fieldset.appendChild(tagsWrap);

        uiNodes.editorForm.appendChild(fieldset);
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

    controls.appendChild(addBtn);
    controls.appendChild(removeBtn);
    uiNodes.editorForm.appendChild(controls);

    const targetEntry = items[currentStoryIndex];
    if (!targetEntry) return;
    const targetItem = config.type === 'mindset' ? targetEntry.item : targetEntry;
    if (config.type === 'skills' && !Array.isArray(targetItem.competencies)) {
        targetItem.competencies = [];
    }
    if (config.type === 'skills') {
        const defaults = {
            title: '',
            focus_area: '',
            progress_status: '',
            duration_hours: '',
            context_text: '',
            background: '',
            rh_value: '',
            resource: null,
            competencies: [],
            technologies: []
        };
        Object.entries(defaults).forEach(([key, value]) => {
            if (targetItem[key] === undefined) {
                targetItem[key] = Array.isArray(value) ? [...value] : value;
            }
        });
    }
    const skillsFallback = config.type === 'skills'
        ? (currentCV?.localized?.[currentLang]?.ui?.skill_tags || [])
        : [];


    const cardFieldset = document.createElement('fieldset');
    const cardLegend = document.createElement('legend');
    cardLegend.textContent = 'Cartão (resumo)';
    cardFieldset.appendChild(cardLegend);

    const popupFieldset = document.createElement('fieldset');
    const popupLegend = document.createElement('legend');
    popupLegend.textContent = 'Pop-up (detalhes)';
    popupFieldset.appendChild(popupLegend);

    const popupKeys = {
        skills: new Set(['context_text', 'background', 'resource', 'competencies', 'technologies']),
        experience: new Set(['summary_text', 'intro_quote', 'details_text', 'challenge_text', 'key_learning_text', 'present_link', 'technologies']),
        mindset: new Set(['story_text', 'engineering_note'])
    };

    getStoryOrderedKeys(config.type, targetItem).forEach((key) => {
        if (isHiddenFieldKey(key)) return;
        const value = targetItem[key];
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = getStoryFieldLabel(config.type, key);
        wrapper.appendChild(label);

        if (Array.isArray(value)) {
            if (config.type === 'skills' && key === 'competencies' && value.length === 0 && Array.isArray(skillsFallback) && skillsFallback.length) {
                makeArrayField(wrapper, targetItem, key, [...skillsFallback]);
            } else {
                makeArrayField(wrapper, targetItem, key, [...value]);
            }
        } else if (typeof value === 'string') {
            if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                makeImageField(wrapper, targetItem, key, currentSection);
            } else if (key === 'icon') {
                makeIconField(wrapper, targetItem, key, 'ex: star');
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
    // remove button now lives next to add button
}

function renderHighlightsEditor(content) {
    if (!content) return;
    if (!Array.isArray(content.items)) content.items = [];
    if (currentHighlightIndex >= content.items.length) currentHighlightIndex = 0;

    const list = document.createElement('div');
    list.className = 'story-list';

    content.items.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `story-item ${index === currentHighlightIndex ? 'active' : ''}`;
        btn.innerHTML = `
            <div class="story-item-title">${item.title || 'Sem título'}</div>
            <div class="story-item-subtitle">${item.subtitle || ''}</div>
        `;
        btn.onclick = () => {
            currentHighlightIndex = index;
            renderSectionEditor();
        };
        list.appendChild(btn);
    });

    const actions = document.createElement('div');
    actions.className = 'story-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'panel-action';
    addBtn.textContent = '+ Adicionar destaque';
    addBtn.onclick = () => {
        content.items.push({
            icon: 'star',
            title: '',
            subtitle: '',
            details: ''
        });
        currentHighlightIndex = content.items.length - 1;
        renderSectionEditor();
    };
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'panel-action';
    removeBtn.textContent = 'Remover destaque';
    removeBtn.onclick = () => {
        if (!content.items.length) return;
        content.items.splice(currentHighlightIndex, 1);
        currentHighlightIndex = Math.max(0, currentHighlightIndex - 1);
        renderSectionEditor();
        renderPreview();
    };
    actions.appendChild(addBtn);
    actions.appendChild(removeBtn);

    uiNodes.editorForm.appendChild(list);
    uiNodes.editorForm.appendChild(actions);

    const currentItem = content.items[currentHighlightIndex];
    if (!currentItem) return;

    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Destaque';
    fieldset.appendChild(legend);

    const iconWrap = document.createElement('div');
    iconWrap.className = 'form-group';
    const iconLabel = document.createElement('label');
    iconLabel.textContent = 'Ícone';
    iconWrap.appendChild(iconLabel);
    makeIconField(iconWrap, currentItem, 'icon', 'ex: star');
    fieldset.appendChild(iconWrap);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'form-group';
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Título';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = currentItem.title || '';
    titleInput.oninput = (event) => {
        currentItem.title = event.target.value;
        renderPreview();
    };
    titleWrap.appendChild(titleLabel);
    titleWrap.appendChild(titleInput);
    fieldset.appendChild(titleWrap);

    const subtitleWrap = document.createElement('div');
    subtitleWrap.className = 'form-group';
    const subtitleLabel = document.createElement('label');
    subtitleLabel.textContent = 'Subtítulo';
    const subtitleInput = document.createElement('input');
    subtitleInput.type = 'text';
    subtitleInput.value = currentItem.subtitle || '';
    subtitleInput.oninput = (event) => {
        currentItem.subtitle = event.target.value;
        renderPreview();
    };
    subtitleWrap.appendChild(subtitleLabel);
    subtitleWrap.appendChild(subtitleInput);
    fieldset.appendChild(subtitleWrap);

    const detailsWrap = document.createElement('div');
    detailsWrap.className = 'form-group';
    const detailsLabel = document.createElement('label');
    detailsLabel.textContent = 'Detalhes';
    const detailsInput = document.createElement('textarea');
    detailsInput.value = currentItem.details || '';
    detailsInput.oninput = (event) => {
        currentItem.details = event.target.value;
        renderPreview();
    };
    detailsWrap.appendChild(detailsLabel);
    detailsWrap.appendChild(detailsInput);
    fieldset.appendChild(detailsWrap);

    uiNodes.editorForm.appendChild(fieldset);
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
    ensureConfig();
    await persistSessionFields();

    await runValidation();
    if (validationStatus.critical.length) {
        showMessage('Dados inválidos. Corrige os erros antes de guardar.', 'error');
        return;
    }

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
        if (currentConfig) {
            if (!configSHA) {
                try {
                    const configResult = await gh.fetchCVData(
                        repoInfo.owner,
                        repoInfo.repo,
                        CONFIG_PATH,
                        token
                    );
                    configSHA = configResult.sha;
                } catch (error) {
                    configSHA = null;
                }
            }
            const configResult = await gh.updateCVData(
                repoInfo.owner,
                repoInfo.repo,
                CONFIG_PATH,
                token,
                currentConfig,
                configSHA,
                'Update site config via Admin UI'
            );
            configSHA = configResult.content.sha;
        }
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
    if (uiNodes.themeBtn) {
        uiNodes.themeBtn.addEventListener('click', openThemeModal);
    }
    const themeClose = document.getElementById('theme-close');
    if (themeClose) {
        themeClose.addEventListener('click', closeThemeModal);
    }
    const themeOverlay = document.getElementById('theme-overlay');
    if (themeOverlay) {
        themeOverlay.addEventListener('click', (event) => {
            if (event.target === themeOverlay) closeThemeModal();
        });
    }
}

async function downloadLocalConfigBackup() {
    if (!currentConfig) {
        currentConfig = buildDefaultConfigFromCV();
    }
    const payload = {
        savedAt: new Date().toISOString(),
        config: currentConfig
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'config.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    showMessage('Configurações exportadas.', 'success');
}

function downloadFullCVJson() {
    if (!currentCV) {
        showMessage('Sem dados carregados para exportar.', 'error');
        return;
    }
    const exportAll = async () => {
        const configPayload = currentConfig || buildDefaultConfigFromCV();
        const payload = {
            savedAt: new Date().toISOString(),
            cv: currentCV,
            config: configPayload
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'site-bundle.json';
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
        showMessage('Exportação completa descarregada.', 'success');
    };
    exportAll();
}

async function restoreFullCVJson(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
            showMessage('JSON inválido.', 'error');
            return;
        }
        if (parsed.cv && parsed.config) {
            currentCV = parsed.cv;
            currentConfig = parsed.config;
            currentSource = 'local';
            currentSHA = null;
            configSHA = null;
            pendingDownloadDeletes.clear();
            normalizeAssetPaths();
            ensureSectionDefinitions();
            await runValidation();
            const sections = getSectionsMeta();
            currentSection = sections.length ? sections[0].id : 'overview';
            renderSidebar();
            renderSectionEditor();
            renderPreview();
            showMessage('Bundle importado com sucesso.', 'success');
            return;
        }
        if (!parsed.localized || !parsed.profile) {
            showMessage('JSON inválido: falta estrutura base do CV.', 'error');
            return;
        }
        currentCV = parsed;
        currentSource = 'local';
        currentSHA = null;
        pendingDownloadDeletes.clear();
        normalizeAssetPaths();
        ensureSectionDefinitions();
        await runValidation();
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

function bindIconPickerEvents() {
    const overlay = document.getElementById('icon-overlay');
    const grid = document.getElementById('icon-grid');
    const closeBtn = document.getElementById('icon-close');
    const clearBtn = document.getElementById('icon-clear');
    if (!overlay || !grid || !closeBtn || !clearBtn) return;

    grid.innerHTML = '';
    ICON_CHOICES.forEach((icon) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-btn';
        btn.title = icon.label?.[currentLang] || icon.id;
        btn.innerHTML = renderIcon(icon.id, 'icon');
        btn.onclick = () => {
            if (iconPickerState?.onSelect) iconPickerState.onSelect(icon.id);
            closeIconPicker();
        };
        grid.appendChild(btn);
    });

    closeBtn.addEventListener('click', closeIconPicker);
    clearBtn.addEventListener('click', () => {
        if (iconPickerState?.onSelect) iconPickerState.onSelect('');
        closeIconPicker();
    });
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeIconPicker();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && iconPickerState) closeIconPicker();
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
    if (!payload.config || typeof payload.config !== 'object') {
        showMessage('Config inválida.', 'error');
        return;
    }
    currentConfig = payload.config;
    ensureConfig();
    applyAdminTheme();
    renderSectionEditor();
    renderPreview();
    showMessage('Configurações importadas.', 'success');
}

async function init() {
    await detectRepoInfo();
    bindEvents();
    bindCropperEvents();
    bindIconPickerEvents();
    switchView('editor');
    await hydrateSessionFields();
    await loadCV(false, false);
}

document.addEventListener('DOMContentLoaded', init);
