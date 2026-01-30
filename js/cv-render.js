import { getSecureItem } from './crypto-utils.js';
import { renderIcon, normalizeIconValue, isIconId } from './icon-set.js';
import { CONFIG_PATH, CV_PATH, DEFAULT_PATHS, DEFAULT_THEME, NAV_TYPE_ICON_IDS } from './constants.js';
import { validateCVSchema } from '../validators/schema-validate.js';
import { validateConsistency } from '../validators/cv-consistency.js';
import { formatErrorMessages } from '../validators/error-messages.js';

const dom = {
    sidebar: document.querySelector('.sidebar'),
    content: document.querySelector('.app-content'),
    langSwitcher: document.getElementById('lang-switcher'),
    langSwitcherMobile: document.getElementById('lang-switcher-mobile'),
    viewSections: document.querySelectorAll('.view-section'),
    drawer: document.getElementById('discovery-drawer') || document.getElementById('drawer'),
    drawerBody: document.getElementById('drawer-body'),
    drawerTitle: document.getElementById('drawer-title'),
    breadcrumb: document.getElementById('active-breadcrumb')
};

let cvData = null;
let configData = null;
let currentLang = 'pt';
let currentSection = null;
let sectionObserver = null;
let scrollTicking = false;
const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === '1';
let previewSection = null;

const BASE_SECTIONS = [
    { id: 'overview', type: 'overview' },
    { id: 'development', type: 'development' },
    { id: 'foundation', type: 'foundation' },
    { id: 'mindset', type: 'mindset' },
    { id: 'now', type: 'now' },
    { id: 'contact', type: 'contact' }
];

const NAV_TYPE_ICONS = Object.fromEntries(
    Object.entries(NAV_TYPE_ICON_IDS).map(([key, iconId]) => [key, renderIcon(iconId, 'nav-icon')])
);
function t(_key, fallback = '') {
    return fallback;
}

function getText(_sectionId, _field, fallback = '') {
    return fallback;
}

function getItemText(_sectionId, _collectionKey, _item, _field, fallback = '') {
    return fallback;
}

function normalizeBasePath(value, fallback) {
    const base = value || fallback;
    if (!base) return '';
    return base.endsWith('/') ? base : `${base}/`;
}

function getPaths() {
    const sources = [configData?.paths, cvData?.paths];
    const base = sources.find((value) => value && typeof value === 'object') || {};
    return {
        photos: normalizeBasePath(base.photos, DEFAULT_PATHS.photos),
        downloads: normalizeBasePath(base.downloads, DEFAULT_PATHS.downloads),
        icons: normalizeBasePath(base.icons, DEFAULT_PATHS.icons)
    };
}

function resolveAssetPath(type, value) {
    if (!value) return '';
    const text = String(value);
    if (/^(https?:|data:|mailto:|tel:)/.test(text)) return text;
    if (text.includes('/')) return text;
    const paths = getPaths();
    return `${paths[type] || ''}${text}`;
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

function applyTheme(theme) {
    const root = document.documentElement;
    const payload = { ...DEFAULT_THEME, ...(theme || {}) };
    if (!payload.accent_soft && payload.accent) {
        payload.accent_soft = hexToRgba(payload.accent, 0.08);
    }
    root.style.setProperty('--bg-app', payload.bg_app);
    root.style.setProperty('--bg-sidebar', payload.bg_sidebar);
    root.style.setProperty('--primary', payload.primary);
    root.style.setProperty('--accent', payload.accent);
    root.style.setProperty('--accent-soft', payload.accent_soft);
    root.style.setProperty('--text-main', payload.text_main);
    root.style.setProperty('--text-muted', payload.text_muted);
    root.style.setProperty('--text-dim', payload.text_dim);
    root.style.setProperty('--border', payload.border);
}

function showValidationBanner(messages = [], type = 'warning') {
    if (!messages.length) return;
    const container = document.querySelector('.app-content');
    if (!container) return;
    const existing = document.getElementById('validation-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'validation-banner';
    banner.className = `validation-banner ${type}`;
    banner.innerHTML = `<strong>${type === 'error' ? 'Dados inválidos' : 'Aviso'}</strong>
        <span>${messages[0]}</span>`;
    container.prepend(banner);
}

function showValidationFailure(messages = []) {
    const container = document.querySelector('.app-content');
    if (!container) return;
    container.innerHTML = `
        <div class="validation-fallback">
            <h2>Dados inválidos</h2>
            <p>O conteúdo não pôde ser carregado. Corrige o cv.json.</p>
            <ul>
                ${messages.slice(0, 5).map((msg) => `<li>${msg}</li>`).join('')}
            </ul>
        </div>
    `;
}

function getContactHref(profile) {
    const email = profile?.social?.email || 'eliaspc2@gmail.com';
    return email ? `mailto:${email}` : '#contact';
}

function getImageTransform(zoom) {
    const scale = Number(zoom);
    if (!Number.isFinite(scale) || scale === 1) return '';
    return `transform: scale(${scale}); transform-origin: center;`;
}

function escapeAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildViewerAttrs({ href, label, viewer = true }) {
    const text = String(href || '');
    const isExternal = /^(https?:|mailto:|tel:)/.test(text);
    if (isExternal) {
        if (text.startsWith('mailto:') || text.startsWith('tel:')) {
            return `href="${href}"`;
        }
        return `href="${href}" target="_blank" rel="noopener"`;
    }
    if (!viewer) {
        return `href="${href}" download`;
    }
    return `href="${href}" data-viewer-file="${href}" data-viewer-label="${escapeAttr(label || '')}"`;
}

function normalizeDownloads(profile, locale) {
    if (!profile) return [];
    const downloads = profile.downloads;
    if (Array.isArray(downloads)) {
        return downloads.map((item) => ({
            label: item?.label || '',
            icon: item?.icon || '',
            href: item?.href || '',
            group: item?.group || 'downloads',
            viewer: item?.viewer !== false
        }));
    }
    if (downloads && typeof downloads === 'object') {
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
        return Object.entries(downloads).map(([key, href]) => ({
            label: labelMap[key] || key,
            icon: '',
            href: href || '',
            group: groupMap[key] || 'downloads',
            viewer: true
        }));
    }
    return [];
}

function getSectionsMeta() {
    if (Array.isArray(cvData?.meta?.sections)) {
        return cvData.meta.sections;
    }
    const legacyCustom = Array.isArray(cvData?.meta?.custom_sections) ? cvData.meta.custom_sections : [];
    if (Array.isArray(cvData?.meta?.section_order) && cvData.meta.section_order.length) {
        const types = cvData.meta.section_types || {};
        return cvData.meta.section_order.map((id) => ({ id, type: types[id] || id }));
    }
    if (cvData?.meta?.section_types) {
        return Object.entries(cvData.meta.section_types).map(([id, type]) => ({ id, type }));
    }
    return [
        ...BASE_SECTIONS.map((section) => ({ id: section.id, type: section.type })),
        ...legacyCustom.map((section) => ({ id: section.id, type: section.type }))
    ];
}

function getSectionMetaList() {
    return getSectionsMeta();
}

function ensureDynamicSections(locale) {
    const nav = document.querySelector('.sidebar-nav');
    const content = document.getElementById('dynamic-content');
    if (!nav || !content) return;

    const sectionList = getSectionMetaList();
    const sectionIds = new Set(sectionList.map((section) => section.id));

    nav.querySelectorAll('.nav-item').forEach((item) => {
        const id = item.getAttribute('data-section');
        if (id && !sectionIds.has(id)) {
            item.remove();
        }
    });
    content.querySelectorAll('.view-section').forEach((section) => {
        const id = section.dataset.section;
        if (id && !sectionIds.has(id)) {
            section.remove();
        }
    });

    sectionList.forEach((section) => {
        const existingSection = document.getElementById(`section-${section.id}`);
        if (!existingSection) {
            const sectionEl = document.createElement('section');
            sectionEl.id = `section-${section.id}`;
            sectionEl.className = 'view-section';
            sectionEl.dataset.section = section.id;
            content.appendChild(sectionEl);
        }

        const existingNav = nav.querySelector(`.nav-item[data-section="${section.id}"]`);
        if (!existingNav) {
            const link = document.createElement('a');
            link.href = `#${section.id}`;
            link.className = 'nav-item';
            link.dataset.section = section.id;
            const icon = NAV_TYPE_ICONS[section.type] || NAV_TYPE_ICONS.overview;
            link.innerHTML = `${icon}<span class="nav-label" data-nav="${section.id}">${section.id}</span>`;
            nav.appendChild(link);
        }
    });

    const navItems = Array.from(nav.querySelectorAll('.nav-item'));
    sectionList.forEach((section) => {
        const item = navItems.find((el) => el.getAttribute('data-section') === section.id);
        if (item) nav.appendChild(item);
    });
    const sectionEls = Array.from(content.querySelectorAll('.view-section'));
    sectionList.forEach((section) => {
        const el = sectionEls.find((item) => item.dataset.section === section.id);
        if (el) content.appendChild(el);
    });
}

function getSectionType(sectionId) {
    const match = getSectionsMeta().find((section) => section.id === sectionId);
    return match?.type || sectionId;
}

function buildFallbackConfig() {
    const meta = cvData?.meta || {};
    const theme = { ...DEFAULT_THEME, ...(meta.theme || {}) };
    if (!theme.accent_soft && theme.accent) {
        theme.accent_soft = hexToRgba(theme.accent, 0.08);
    }
    const paths = cvData?.paths || {};
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
        theme
    };
}

async function bootstrap() {
    try {
        if (isPreviewMode) {
            document.body.classList.add('preview-mode');
        }
        const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
        if (isPreview) {
            const previewRaw = await getSecureItem(sessionStorage, 'preview_cv');
            if (previewRaw) {
                try {
                    cvData = JSON.parse(previewRaw);
                } catch (err) {
                    cvData = null;
                }
            }
            const previewConfigRaw = await getSecureItem(sessionStorage, 'preview_config');
            if (previewConfigRaw) {
                try {
                    configData = JSON.parse(previewConfigRaw);
                } catch (err) {
                    configData = null;
                }
            }
        }

        if (!cvData) {
            const response = await fetch(CV_PATH, { cache: 'no-store' });
            cvData = await response.json();
        }
        if (!configData) {
            try {
                const configResponse = await fetch(CONFIG_PATH, { cache: 'no-store' });
                if (configResponse.ok) {
                    configData = await configResponse.json();
                } else {
                    configData = buildFallbackConfig();
                }
            } catch (err) {
                configData = buildFallbackConfig();
            }
        }
        const schemaResult = await validateCVSchema(cvData);
        const consistency = validateConsistency(cvData);
        const langForErrors = cvData?.meta?.defaultLanguage || 'pt';
        const schemaMessages = formatErrorMessages(schemaResult.errors, langForErrors);
        if (!schemaResult.valid || consistency.critical.length) {
            const consistencyMessages = formatErrorMessages(consistency.critical, langForErrors);
            showValidationFailure([...schemaMessages, ...consistencyMessages]);
            return;
        }
        if (consistency.warnings.length) {
            const warningMessages = formatErrorMessages(consistency.warnings, langForErrors);
            showValidationBanner(warningMessages, 'warning');
        }
        currentLang = cvData.meta.defaultLanguage || 'pt';

        // sync language switchers to current lang
        if (dom.langSwitcher) dom.langSwitcher.value = currentLang;
        if (dom.langSwitcherMobile) dom.langSwitcherMobile.value = currentLang;

        // Set sidebar photo
        const sidebarPhoto = document.getElementById('sidebar-photo');
        if (sidebarPhoto && cvData.profile.photo) {
            sidebarPhoto.src = resolveAssetPath('photos', cvData.profile.photo);
            sidebarPhoto.style.objectPosition = cvData.profile.photo_position || 'center 20%';
            const zoom = Number(cvData.profile.photo_zoom || 1);
            sidebarPhoto.style.transform = zoom !== 1 ? `scale(${zoom})` : '';
            sidebarPhoto.style.transformOrigin = 'center';
        }

        setupGlobalEvents();
        render();
        setupScrollNarrative();
    } catch (err) {
        console.error("Critical error loading CV data:", err);
    }
}

function setupGlobalEvents() {
    const overlay = document.getElementById('sidebar-overlay');
    const mobileBtn = document.getElementById('sidebar-mobile-toggle');
    const setSidebarOpen = (open) => {
        if (!dom.sidebar) return;
        dom.sidebar.classList.toggle('mobile-open', open);
        if (overlay) overlay.classList.toggle('active', open);
        if (mobileBtn) {
            mobileBtn.textContent = open ? 'Fechar' : 'Menu';
        }
    };

    // 1. Navigation (delegate for dynamic items)
    const nav = document.querySelector('.sidebar-nav');
    if (nav) {
        nav.addEventListener('click', (e) => {
            const target = e.target.closest('.nav-item');
            if (!target) return;
            const sectionId = target.getAttribute('data-section');
            if (!sectionId) return;
            e.preventDefault();
            if (isPreviewMode) return;
            navigateTo(sectionId);
            if (window.innerWidth <= 768) {
                setSidebarOpen(false);
            }
        });
    }

    // 2. Language
    const onLangChange = async (value) => {
        currentLang = value;
        if (dom.langSwitcher) dom.langSwitcher.value = value;
        if (dom.langSwitcherMobile) dom.langSwitcherMobile.value = value;
        await loadI18n(currentLang);
        render();
    };

    if (dom.langSwitcher) {
        dom.langSwitcher.onchange = (e) => onLangChange(e.target.value);
    }

    if (dom.langSwitcherMobile) {
        dom.langSwitcherMobile.onchange = (e) => onLangChange(e.target.value);
    }

    // 3. Drawer Close
    document.getElementById('drawer-close').onclick = closeDrawer;
    document.getElementById('drawer-x').onclick = closeDrawer;

    // 4. Secret Maintenance Access (3 clicks on profile photo)
    let clickCount = 0;
    const trigger = document.querySelector('[data-admin-trigger="true"]');
    if (trigger) {
        trigger.onclick = () => {
            clickCount++;
            if (clickCount === 3) {
                window.location.href = 'config.html';
                clickCount = 0;
            }
            // Reset counter after 3 seconds of inactivity
            clearTimeout(window.maintenanceTimeout);
            window.maintenanceTimeout = setTimeout(() => { clickCount = 0; }, 3000);
        };
    }

    // 5. Mobile Toggle
    if (mobileBtn) {
        mobileBtn.onclick = () => {
            const isOpen = dom.sidebar.classList.contains('mobile-open');
            setSidebarOpen(!isOpen);
        };
        setSidebarOpen(false);
    }

    if (overlay) {
        overlay.onclick = () => setSidebarOpen(false);
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            setSidebarOpen(false);
        }
    });

    initFileViewer();

    if (isPreviewMode) {
        window.addEventListener('message', async (event) => {
            if (!event.data || event.data.type !== 'previewUpdate') return;
            if (event.data.section) previewSection = event.data.section;
            if (event.data.lang) currentLang = event.data.lang;
            const previewRaw = await getSecureItem(sessionStorage, 'preview_cv');
            if (!previewRaw) return;
            try {
                cvData = JSON.parse(previewRaw);
                currentLang = event.data.lang || currentLang || cvData.meta.defaultLanguage;
                render();
                applyPreviewSection(previewSection);
            } catch (err) {
                console.warn('Preview update failed', err);
            }
        });
    }
}

function initFileViewer() {
    const viewer = document.getElementById('file-viewer');
    const titleEl = document.getElementById('file-viewer-title');
    const bodyEl = document.getElementById('file-viewer-body');
    const closeBtn = document.getElementById('file-viewer-close');
    const downloadBtn = document.getElementById('file-viewer-download');
    if (!viewer || !titleEl || !bodyEl || !closeBtn || !downloadBtn) return;

    const close = () => {
        viewer.classList.add('hidden');
        viewer.setAttribute('aria-hidden', 'true');
        bodyEl.innerHTML = '';
    };

    const open = (href, label) => {
        titleEl.textContent = label || 'Ficheiro';
        downloadBtn.href = href;
        downloadBtn.setAttribute('download', '');
        bodyEl.innerHTML = '';

        const url = href.split('?')[0].toLowerCase();
        if (url.endsWith('.pdf')) {
            const iframe = document.createElement('iframe');
            iframe.src = href;
            iframe.title = label || 'Documento';
            iframe.className = 'file-viewer-frame';
            bodyEl.appendChild(iframe);
        } else if (url.match(/\.(png|jpg|jpeg|webp|gif)$/)) {
            const img = document.createElement('img');
            img.src = href;
            img.alt = label || 'Imagem';
            img.className = 'file-viewer-image';
            bodyEl.appendChild(img);
        } else {
            const info = document.createElement('div');
            info.className = 'file-viewer-fallback';
            info.innerHTML = `
                <p>Pré-visualização não disponível.</p>
                <a href="${href}" download>Descarregar ficheiro</a>
            `;
            bodyEl.appendChild(info);
        }

        viewer.classList.remove('hidden');
        viewer.setAttribute('aria-hidden', 'false');
    };

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-viewer-file]');
        if (!trigger) return;
        event.preventDefault();
        const href = trigger.getAttribute('data-viewer-file');
        if (!href) return;
        const label = trigger.getAttribute('data-viewer-label') || trigger.textContent?.trim();
        open(href, label);
    });

    closeBtn.onclick = close;
    viewer.addEventListener('click', (event) => {
        if (event.target === viewer) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !viewer.classList.contains('hidden')) close();
    });
}

function navigateTo(sectionId) {
    const target = document.getElementById(`section-${sectionId}`);
    if (!target) return;
    setActiveSection(sectionId);
    const headerOffset = -20 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0);
    const targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
}

function render() {
    if (!cvData) return;
    applyTheme(configData?.theme || cvData.meta?.theme || cvData.theme || {});
    const locale = cvData.localized[currentLang];
    ensureDynamicSections(locale);
    updateNavigationLabels(locale);
    updatePageMeta(locale);
    updateBrandName(locale);
    updateUiLabels(locale);

    const sectionList = getSectionMetaList();
    sectionList.forEach((section) => {
        const container = document.getElementById(`section-${section.id}`);
        const data = locale[section.id] || locale[section.type];
        if (!container || !data) return;
        if (section.type === 'overview') {
            renderOverview(data, container, section.id);
        } else if (section.type === 'development') {
            renderDevelopment(data, container, section.id);
        } else if (section.type === 'foundation') {
            renderFoundation(data, container, section.id);
        } else if (section.type === 'mindset') {
            renderMindset(data, container, section.id);
        } else if (section.type === 'now') {
            renderNow(data, container, section.id);
        } else if (section.type === 'contact') {
            renderContact(data, locale, container, section.id);
        }
    });

    if (isPreviewMode) {
        applyPreviewSection(previewSection);
    }
}

function updatePageMeta(locale) {
    if (!cvData) return;
    const meta = cvData.meta || {};
    const siteConfig = configData?.site || {};
    const ui = locale?.ui || {};
    const title = ui.page_title || siteConfig.title || meta.site_title;
    const description = ui.page_description || siteConfig.description || meta.site_description;
    const favicon = resolveAssetPath('icons', siteConfig.favicon || meta.favicon);
    const appleIcon = resolveAssetPath('icons', siteConfig.apple_icon || meta.apple_icon);

    if (title) {
        document.title = title;
    }
    if (description) {
        const descTag = document.getElementById('meta-description');
        if (descTag) descTag.setAttribute('content', description);
    }
    if (favicon) {
        const iconTag = document.getElementById('site-favicon');
        if (iconTag) iconTag.setAttribute('href', favicon);
    }
    if (appleIcon) {
        const appleTag = document.getElementById('apple-touch-icon');
        if (appleTag) appleTag.setAttribute('href', appleIcon);
    }
}

function updateBrandName(locale) {
    const brandEl = document.getElementById('brand-trigger');
    const statusEl = document.querySelector('.brand-status');
    if (!brandEl) return;
    const overview = locale?.overview || locale?.[getSectionType('overview')] || {};
    const name = cvData?.profile?.name || overview?.name;
    if (name) {
        brandEl.textContent = name;
    }
    const sidebarPhoto = document.getElementById('sidebar-photo');
    if (sidebarPhoto && name) {
        sidebarPhoto.alt = name;
    }
    if (statusEl) {
        const role = cvData?.profile?.role || overview?.headline;
        if (role) statusEl.textContent = role;
    }
}

function updateUiLabels(locale) {
    const ui = locale?.ui || {};
    const menuBtn = document.getElementById('sidebar-mobile-toggle');
    if (menuBtn) {
        const label = t('ui.menu_label', ui.menu_label || menuBtn.textContent);
        if (label) menuBtn.textContent = label;
    }
    const langSelect = document.getElementById('lang-switcher');
    const langMobile = document.getElementById('lang-switcher-mobile');
    const labelText = t('ui.language_label', ui.language_label || '');
    if (labelText) {
        if (langSelect) langSelect.setAttribute('aria-label', labelText);
        if (langMobile) langMobile.setAttribute('aria-label', labelText);
    }
}

function updateNavigationLabels(locale) {
    document.querySelectorAll('[data-nav]').forEach(label => {
        const key = label.getAttribute('data-nav');
        const labelText = t(`navigation.${key}`, (locale.navigation && locale.navigation[key]) || label.textContent || key);
        if (labelText) {
            label.textContent = labelText;
        }
        const navItem = label.closest('.nav-item');
        const iconValue = normalizeIconValue(locale.navigation_icons && locale.navigation_icons[key]);
        if (navItem) {
            const svgIcon = navItem.querySelector('.nav-icon');
            let customIcon = navItem.querySelector('.nav-custom-icon');
            if (iconValue && isIconId(iconValue)) {
                if (!customIcon) {
                    customIcon = document.createElement('span');
                    customIcon.className = 'nav-custom-icon';
                    navItem.insertBefore(customIcon, navItem.firstChild);
                }
                customIcon.innerHTML = renderIcon(iconValue, 'nav-icon');
                if (svgIcon) svgIcon.style.display = 'none';
            } else {
                if (customIcon) customIcon.remove();
                if (svgIcon) svgIcon.style.display = '';
            }
        }
    });
    updateBreadcrumb(currentSection, locale);
}

function updateBreadcrumb(sectionId, locale) {
    if (!dom.breadcrumb || !sectionId) return;
    const label = (locale && locale.navigation && locale.navigation[sectionId]) || sectionId;
    dom.breadcrumb.textContent = t(`navigation.${sectionId}`, label);
}

function setActiveSection(sectionId) {
    if (!sectionId || sectionId === currentSection) return;
    currentSection = sectionId;
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('data-section') === sectionId);
    });
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.toggle('active', section.dataset.section === sectionId);
    });
    const locale = cvData.localized[currentLang];
    updateBreadcrumb(sectionId, locale);
    updateNavProgress();
}

function applyPreviewSection(sectionId) {
    if (!isPreviewMode) return;
    const sections = Array.from(document.querySelectorAll('.view-section'));
    if (!sections.length) return;
    const targetSection = sectionId || previewSection || sections[0].dataset.section;
    previewSection = targetSection;
    const showNavOnly = targetSection === 'navigation';
    document.body.classList.toggle('preview-nav-only', showNavOnly);
    if (dom.sidebar) {
        dom.sidebar.style.display = showNavOnly ? '' : 'none';
    }
    if (document.body) {
        document.body.classList.toggle('preview-hide-sidebar', !showNavOnly);
    }
    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
        mainWrapper.style.display = showNavOnly ? 'none' : '';
    }
    sections.forEach(section => {
        const isActive = !showNavOnly && section.dataset.section === targetSection;
        section.style.display = isActive ? '' : 'none';
    });
    if (!showNavOnly) {
        setActiveSection(targetSection);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
}


function updateNavProgress() {
    const doc = document.documentElement;
    const scrollTop = window.pageYOffset || doc.scrollTop || 0;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    document.documentElement.style.setProperty('--nav-progress', `${progress}%`);
}

function updateActiveSectionByViewport() {
    const sections = Array.from(document.querySelectorAll('.view-section'));
    const mid = window.innerHeight * 0.5;
    let candidate = null;
    let minDistance = Infinity;

    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - mid);
        if (distance < minDistance) {
            minDistance = distance;
            candidate = section.dataset.section;
        }
    });

    if (candidate) setActiveSection(candidate);
}

function setupScrollNarrative() {
    if (isPreviewMode) return;
    const sections = Array.from(document.querySelectorAll('.view-section'));
    sections.forEach(section => {
        if (!section.dataset.section) {
            section.dataset.section = section.id.replace('section-', '');
        }
    });

    if (sectionObserver) sectionObserver.disconnect();

    sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                setActiveSection(entry.target.dataset.section);
            }
        });
    }, { threshold: [0.6] });

    sections.forEach(section => sectionObserver.observe(section));
    if (sections.length) setActiveSection(sections[0].dataset.section);
    updateNavProgress();
    window.addEventListener('scroll', () => {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(() => {
            updateNavProgress();
            updateActiveSectionByViewport();
            scrollTicking = false;
        });
    }, { passive: true });
}

/* --- Specific Section Renderers --- */

function renderOverview(data, container, sectionId = 'overview') {
    const profile = cvData.profile;
    const ui = cvData.localized[currentLang].ui || {};
    const certifications = cvData.localized[currentLang].certifications || profile.certifications || [];
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label || ui.cta_contact_label);
    const ctaHref = data.cta_link || getContactHref(profile);
    const headline = getText(sectionId, 'headline', data.headline);
    const location = getText(sectionId, 'location', data.location);
    const introText = getText(sectionId, 'intro_text', data.intro_text);
    const bioText = getText(sectionId, 'bio', data.bio);
    const marketingNote = getText(sectionId, 'marketing_note', data.marketing_note);
    const languagesLabel = getText(sectionId, 'languages_label', data.languages_label || '');
    const educationLabel = getText(sectionId, 'education_label', data.education_label || '');
    const nextLabel = getText(sectionId, 'next_label', data.next_label || '');
    const nextText = getText(sectionId, 'next_text', data.next_text || '');
    container.innerHTML = `
        <div class="hero-section">
            <div class="hero-header-flex" style="display:flex; align-items:center; gap:2.5rem; margin-bottom:4rem; flex-wrap:wrap;">
                <div class="profile-group" style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                    <div class="profile-circle large" style="width:140px; height:140px; border-width:3px; box-shadow: var(--shadow-md);">
                        <img src="${resolveAssetPath('photos', profile.photo)}" alt="André Câmara" loading="lazy" decoding="async" style="object-position:${profile.photo_position || 'center 20%'}; ${getImageTransform(profile.photo_zoom)}">
                    </div>
                </div>
                <div style="flex:1; min-width:300px;">
                    <h1 class="hero-tagline" style="margin:0; font-size: 3rem;">${headline}</h1>
                    <p style="color:var(--text-muted); font-weight:600; margin-top:0.75rem; display:flex; align-items:center; gap:8px;">
                        <svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${location}
                    </p>
                    ${certifications.length ? `
                        <div class="cert-badges">
                            ${certifications.map(cert => {
                                const href = resolveAssetPath('downloads', cert.href);
                                const viewer = cert.viewer !== false;
                                return `
                                    <a class="cert-chip" ${buildViewerAttrs({ href, label: cert.label, viewer })}>
                                        ${cert.label}
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <p class="hero-intro" style="font-weight: 500; color: var(--text-main);">${introText}</p>
            
            <div class="story-text" style="max-width:850px; background: white; padding: 2.5rem; border-radius: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                <p style="margin-bottom: 2rem;">${bioText}</p>
                <div style="padding:1.5rem; background:var(--accent-soft); border-radius:12px; border-left:4px solid var(--accent);">
                    <p style="font-size:0.95rem; color:var(--text-main); margin:0;">
                        ${ui.marketing_label ? `<strong style="color:var(--accent)">${t('ui.marketing_label', ui.marketing_label)}:</strong>` : ''} ${marketingNote}
                    </p>
                </div>
            </div>
            ${(data.languages && data.languages.length) || (data.education && data.education.length) ? `
                <div class="overview-meta">
                    ${data.languages && data.languages.length ? `
                        <div class="overview-meta-block">
                            <span class="dim-label">${languagesLabel}</span>
                            <p>${data.languages.join(' · ')}</p>
                        </div>
                    ` : ''}
                    ${data.education && data.education.length ? `
                        <div class="overview-meta-block">
                            <span class="dim-label">${educationLabel}</span>
                            <p>${data.education.join(' · ')}</p>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            ${nextText ? `
                <div class="section-transition">
                    ${nextLabel ? `<span>${nextLabel}</span>` : ''}
                    ${nextText}
                </div>
            ` : ''}
            
            ${ctaLabel ? `
                <div style="margin-top:4rem;">
                   <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                </div>
            ` : ''}
        </div>
    `;
}

function renderDevelopment(data, container, sectionId = 'development') {
    const ui = cvData.localized[currentLang].ui || {};
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label || ui.cta_contact_label);
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const title = getText(sectionId, 'title', data.title);
    const description = getText(sectionId, 'description', data.description);
    const nextLabel = getText(sectionId, 'next_label', data.next_label || '');
    const nextText = getText(sectionId, 'next_text', data.next_text || '');
    const aggregateItems = (items, key) => {
        const values = new Set();
        (items || []).forEach((item) => {
            (item?.[key] || []).forEach((value) => {
                if (value) values.add(String(value));
            });
        });
        return Array.from(values);
    };
    const allTechnologies = aggregateItems(data.skills, 'technologies');
    const allCompetencies = aggregateItems(data.skills, 'competencies');
    const aggTechLabel = t('ui.technologies_label', ui.technologies_label || 'Tecnologias');
    const aggCompLabel = t('ui.drawer_skill_competencies_label', ui.drawer_skill_competencies_label || 'Competências');
    const aggregateCards = `
        <div class="aggregate-card">
            <div class="aggregate-title">${aggTechLabel}</div>
            <div class="chip-list">
                ${allTechnologies.map((tech) => `<span class="chip">${tech}</span>`).join('')}
            </div>
        </div>
        ${allCompetencies.length ? `
            <div class="aggregate-card">
                <div class="aggregate-title">${aggCompLabel}</div>
                <div class="chip-list">
                    ${allCompetencies.map((comp) => `<span class="chip">${comp}</span>`).join('')}
                </div>
            </div>
        ` : ''}
    `;
    const skillsHtml = data.skills.map((skill, index) => `
        <div class="rich-card" onclick="app.showDetail('skill', ${index}, '${sectionId}')">
            <div class="card-tags">
                <span class="focus-tag">${getItemText(sectionId, 'skills', skill, 'focus_area', skill.focus_area || '')}</span>
                ${skill.progress_status ? `<span class="status-tag">${getItemText(sectionId, 'skills', skill, 'progress_status', skill.progress_status)}</span>` : ''}
            </div>
            <h3>${getItemText(sectionId, 'skills', skill, 'title', skill.title)}</h3>
            ${skill.duration_hours ? `<div class="dim-label">${getItemText(sectionId, 'skills', skill, 'duration_hours', skill.duration_hours)}</div>` : ''}
            <p style="color:var(--text-muted); margin-bottom:1.5rem; line-height:1.5;">${getItemText(sectionId, 'skills', skill, 'context_text', skill.context_text)}</p>
            <div class="explore-hint">${t('ui.explore_skill_label', ui.explore_skill_label || '')}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${title}</h2>
            <p class="section-desc">${description}</p>
            ${data.image ? `
                <div class="development-layout">
                    <div class="development-cards">
                        ${skillsHtml}
                    </div>
                    <div class="development-aside">
                        <div class="development-image">
                            <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                        </div>
                        ${allTechnologies.length ? aggregateCards : ''}
                    </div>
                </div>
            ${nextText ? `
                <div class="section-transition">
                        ${nextLabel ? `<span>${nextLabel}</span>` : ''}
                        ${nextText}
                </div>
            ` : ''}
            ` : `
                <div class="grid-detailed">
                    ${skillsHtml}
                </div>
            `}
            ${ctaLabel ? `
                <div style="margin-top:3rem;">
                    <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                </div>
            ` : ''}
        </div>
    `;
}

function renderFoundation(data, container, sectionId = 'foundation') {
    const ui = cvData.localized[currentLang].ui || {};
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label || ui.cta_contact_label);
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const title = getText(sectionId, 'title', data.title);
    const description = getText(sectionId, 'description', data.description);
    const nextLabel = getText(sectionId, 'next_label', data.next_label || '');
    const nextText = getText(sectionId, 'next_text', data.next_text || '');
    container.innerHTML = `
        <div class="section-container">
            <div class="section-header foundation-header">
                ${data.image ? `
                    <div class="foundation-circle">
                        <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                    </div>
                ` : ''}
                <div class="foundation-text">
                    <h2 class="section-title">${title}</h2>
                    <p class="section-desc foundation-desc">${description}</p>
                </div>
            </div>
            <div class="timeline-rich">
                ${data.experience.map((exp, index) => `
                    <div class="rich-card" style="margin-bottom: 2rem;" onclick="app.showDetail('exp', ${index}, '${sectionId}')">
                        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
                           <span class="focus-tag">${getItemText(sectionId, 'experience', exp, 'company_name', exp.company_name)}</span>
                           <span style="font-size:0.8rem; font-weight:700; color:var(--text-dim);">${getItemText(sectionId, 'experience', exp, 'timeframe', exp.timeframe)}</span>
                        </div>
                        <h3>${getItemText(sectionId, 'experience', exp, 'role_title', exp.role_title)}</h3>
                        <p style="color:var(--text-muted); line-height:1.5;">${getItemText(sectionId, 'experience', exp, 'summary_text', exp.summary_text)}</p>
                        <div class="explore-hint">${t('ui.explore_experience_label', ui.explore_experience_label || '')}</div>
                    </div>
                `).join('')}
            </div>
            ${nextText ? `
                <div class="section-transition">
                    ${nextLabel ? `<span>${nextLabel}</span>` : ''}
                    ${nextText}
                </div>
            ` : ''}
            ${ctaLabel ? `
                <div style="margin-top:3rem;">
                    <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                </div>
            ` : ''}
        </div>
    `;
}

function renderMindset(data, container, sectionId = 'mindset') {
    const ui = cvData.localized[currentLang].ui || {};
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label || ui.cta_contact_label);
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const title = getText(sectionId, 'title', data.title);
    const subtitle = getText(sectionId, 'subtitle', data.subtitle);
    const philosophy = getText(sectionId, 'philosophy', data.philosophy);
    const nextLabel = getText(sectionId, 'next_label', data.next_label || '');
    const nextText = getText(sectionId, 'next_text', data.next_text || '');
    const adoptionBlock = data.adoption ? [data.adoption] : [];
    const allBlocks = [...adoptionBlock, ...data.blocks];
    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${title}</h2>
            <p class="section-desc">${subtitle}</p>

            <div class="philosophy-box" style="margin-bottom: 4rem;">
                <p>${philosophy}</p>
            </div>

            <div class="mindset-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2.5rem;">
                ${allBlocks.map((block, index) => `
                    <div class="rich-card mindset-card ${block.id === 'adocao' || block.id === 'adopcion' || block.id === 'adoption' ? 'adoption-card' : ''}" onclick="app.showDetail('mindset', ${index}, '${sectionId}')" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <div style="height: 200px; background: var(--border); overflow: hidden; position: relative;">
                            ${block.image ? `<img src="${resolveAssetPath('photos', block.image)}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover; object-position: ${block.image_position || 'center 20%'}; ${getImageTransform(block.image_zoom)} opacity: 0.8; transition: var(--transition);">` : `
                                <div style="display:flex; align-items:center; justify-content:center; height:100%; color: var(--accent);">
                                    ${renderIcon(block.icon, 'icon icon-xxl')}
                                </div>
                            `}
                            <div style="position: absolute; bottom: 1rem; left: 1rem; background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em;">
                                ${getItemText(sectionId, 'blocks', block, 'principle_title', block.principle_title)}
                            </div>
                        </div>
                        <div style="padding: 2rem;">
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 1rem;">
                                <span style="color: var(--accent); display:inline-flex;">${renderIcon(block.icon, 'icon icon-lg')}</span>
                                <h3 style="margin:0;">${getItemText(sectionId, 'blocks', block, 'title', block.title)}</h3>
                            </div>
                            <p style="color:var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
                                ${getItemText(sectionId, 'blocks', block, 'story_text', block.story_text).substring(0, 120)}...
                            </p>
                            <div class="explore-hint" style="margin-top: auto;">${t('ui.explore_mindset_label', ui.explore_mindset_label || '')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${nextText ? `
                <div class="section-transition">
                    ${nextLabel ? `<span>${nextLabel}</span>` : ''}
                    ${nextText}
                </div>
            ` : ''}
            ${ctaLabel ? `
                <div style="margin-top:3rem;">
                    <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                </div>
            ` : ''}
        </div>
    `;
}

function renderContact(data, locale, container, sectionId = 'contact') {
    const profile = cvData.profile;
    const ui = locale.ui || {};
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label || ui.cta_contact_label);
    const downloads = normalizeDownloads(profile, locale);
    const ctaHref = data.cta_link || `mailto:${profile.social.email}`;
    const title = getText(sectionId, 'title', data.title);
    const description = getText(sectionId, 'description', data.description);
    const emailLabel = getText(sectionId, 'email_label', data.email_label || '');
    const linkedinLabel = getText(sectionId, 'linkedin_label', data.linkedin_label || 'LinkedIn');
    const githubLabel = getText(sectionId, 'github_label', data.github_label || 'GitHub');
    const downloadIcon = renderIcon('file', 'nav-icon');
    const certIcon = renderIcon('graduation', 'nav-icon');
    const renderDownloadIcon = (iconId, fallbackIcon) => {
        const normalized = normalizeIconValue(iconId || '');
        return isIconId(normalized) ? renderIcon(normalized, 'nav-icon') : fallbackIcon;
    };
    const getDownloadLabel = (item) => {
        if (!item) return '';
        const contactLabels = locale?.contact || {};
        if (item.type === 'programmatic_content' && item.level === 'CET' && contactLabels.cet_label) {
            return contactLabels.cet_label;
        }
        if (item.type === 'programmatic_content' && item.level === 'EFA' && contactLabels.efa_label) {
            return contactLabels.efa_label;
        }
        return item.label || item.href || '';
    };
    const renderDownloadItem = (item, fallbackIcon) => {
        if (!item.href) return '';
        const href = resolveAssetPath('downloads', item.href);
        const viewer = item.viewer !== false;
        const label = getDownloadLabel(item);
        return `
            <a ${buildViewerAttrs({ href, label, viewer })} class="download-item nav-item">
                ${renderDownloadIcon(item.icon, fallbackIcon)}
                <span>${label}</span>
            </a>
        `;
    };
    const groupDefs = Array.isArray(data.download_groups) ? data.download_groups : null;
    const groupMap = new Map();
    const downloadGroups = [];
    if (groupDefs) {
        groupDefs.forEach((group) => {
            if (!group?.id) return;
            groupMap.set(group.id, {
                label: getItemText(sectionId, 'download_groups', group, 'label', group.label || group.id),
                icon: group.icon || ''
            });
        });
    } else {
        groupMap.set('downloads', {
            label: getText(sectionId, 'downloads_title', data.downloads_title || ''),
            icon: ''
        });
        groupMap.set('certs', {
            label: getText(sectionId, 'certifications_title', data.certifications_title || ''),
            icon: ''
        });
    }

    const groupIds = new Set([...groupMap.keys(), ...downloads.map((item) => item.group || 'downloads')]);
    groupIds.forEach((groupId) => {
        const groupItems = downloads.filter(item => (item.group || 'downloads') === groupId);
        if (!groupItems.length) return;
        const groupDef = groupMap.get(groupId) || { label: groupId, icon: '' };
        const fallbackIcon = renderDownloadIcon(groupDef.icon, (groupId === 'certs' ? certIcon : downloadIcon));
        downloadGroups.push({
            label: groupDef.label || groupId,
            items: groupItems,
            icon: fallbackIcon,
            openInNewTab: false
        });
    });

    container.innerHTML = `
        <div class="contact-hero">
            <div style="margin-bottom:3rem; display:flex; flex-direction:column; align-items:center;">
                <div class="profile-circle" style="width:120px; height:120px; border-width:2px; margin-bottom:1.5rem; box-shadow: var(--shadow-md);">
                    <img src="${resolveAssetPath('photos', profile.contact_photo || profile.photo)}" alt="André Câmara" loading="lazy" decoding="async" style="object-position:${profile.contact_photo_position || profile.photo_position || 'center 20%'}; ${getImageTransform(profile.contact_photo_zoom || profile.photo_zoom)}">
                </div>
                <p class="dim-label" style="letter-spacing:0.1em; margin-bottom:1rem;">${emailLabel}</p>
                <h2 style="margin-bottom:1rem;">${title}</h2>
                <p style="color:var(--text-muted); font-size:1.1rem; max-width:600px; margin-left:auto; margin-right:auto;">${description}</p>
                ${ctaLabel ? `
                    <div style="margin-top:1rem;">
                        <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                    </div>
                ` : ''}
            </div>

            <div class="download-section">
                <div class="download-grid">
                    ${downloadGroups.map(group => `
                        <div class="download-group">
                            <p class="dim-label">${group.label || ''}</p>
                            <div class="download-list">
                                ${group.items.map(item => renderDownloadItem(item, group.icon)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="margin-top:2.5rem; display:flex; justify-content:center; gap:3rem;">
                <a href="${profile.social.linkedin}" target="_blank" class="social-icon-link" style="color:var(--primary); font-weight:700; font-size: 1.1rem; display:flex; align-items:center; gap:8px;">
                    <svg style="width:24px; height:24px;" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    ${linkedinLabel}
                </a>
                <a href="${profile.social.github}" target="_blank" class="social-icon-link" style="color:var(--primary); font-weight:700; font-size: 1.1rem; display:flex; align-items:center; gap:8px;">
                    <svg style="width:24px; height:24px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.362.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12"/></svg>
                    ${githubLabel}
                </a>
            </div>
        </div>
    `;
}

function renderNow(data, container, sectionId = 'now') {
    if (!data || !container) return;
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const title = getText(sectionId, 'title', data.title);
    const summary = getText(sectionId, 'summary', data.summary);
    const details = getText(sectionId, 'details', data.details);
    const ctaLabel = getText(sectionId, 'cta_label', data.cta_label);
    const resources = Array.isArray(data.resources) ? data.resources : [];
    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${title}</h2>
            <p class="section-desc">${summary}</p>
            <div class="now-layout">
                ${data.image ? `
                    <div class="now-media">
                        <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                    </div>
                ` : ''}
                <div class="now-card">
                    ${resources.length ? `
                        <div class="cert-badges" style="margin-top:0; margin-bottom:1.5rem;">
                            ${resources.map((item) => {
                                if (!item?.href) return '';
                                const href = resolveAssetPath('downloads', item.href);
                                const viewer = item.viewer !== false;
                                return `
                                    <a ${buildViewerAttrs({ href, label: item.label || item.href, viewer })} class="cert-chip">
                                        ${renderIcon(item.icon || 'file', 'nav-icon')}
                                        ${item.label || item.href}
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                    <p>${details}</p>
                    <div style="margin-top:2rem;">
                        <a class="cta-btn" href="${ctaHref}">${ctaLabel}</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/* --- Discovery Logic --- */

function showDetail(type, index, contextSection) {
    const locale = cvData.localized[currentLang];
    let contentHtml = "";

    if (type === 'skill') {
        const item = locale[contextSection].skills[index];
        const ui = locale.ui || {};
        contentHtml = `
            <span class="dim-label">${getItemText(contextSection, 'skills', item, 'focus_area', item.focus_area)}</span>
            <h2 style="margin-top:0.5rem;">${getItemText(contextSection, 'skills', item, 'title', item.title)}</h2>
            ${item.progress_status ? `<div class="status-line">${getItemText(contextSection, 'skills', item, 'progress_status', item.progress_status)}${item.duration_hours ? ` · ${getItemText(contextSection, 'skills', item, 'duration_hours', item.duration_hours)}` : ''}</div>` : ''}
            <div class="story-text" style="color:var(--text-main); margin-top:1.5rem;">
                ${getItemText(contextSection, 'skills', item, 'context_text', item.context_text)}
            </div>

            <div style="margin-top:2.5rem;">
                <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--accent); margin-bottom:1rem;">${t('ui.drawer_skill_context_label', ui.drawer_skill_context_label || '')}</h4>
                <div style="font-size:1rem; line-height:1.7; color:var(--text-muted); font-style:italic; padding-left:1.5rem; border-left:2px solid var(--border);">
                    ${getItemText(contextSection, 'skills', item, 'background', item.background || ui.drawer_skill_default_history || "")}
                </div>
            </div>
            ${item.rh_value ? `
                <div style="margin-top:2rem; padding:1rem 1.25rem; border-radius:12px; background:var(--accent-soft); border-left:3px solid var(--accent);">
                    <div style="font-size:0.8rem; text-transform:uppercase; color:var(--accent); letter-spacing:0.08em; margin-bottom:0.5rem;">Valor para equipas</div>
                    <div style="color:var(--text-main); font-size:0.95rem;">${item.rh_value}</div>
                </div>
            ` : ''}
            ${item.resource ? (() => {
                const href = resolveAssetPath('downloads', item.resource.href);
                const viewer = item.resource.viewer !== false;
                return `
                    <div style="margin-top:2.5rem;">
                        <a ${buildViewerAttrs({ href, label: item.resource.label, viewer })} class="resource-btn">${item.resource.label}</a>
                    </div>
                `;
            })() : ''}

            ${item.technologies && item.technologies.length ? `
                <div style="margin-top:2.5rem;">
                    <h4 style="font-size:0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${t('ui.technologies_label', ui.technologies_label || '')}</h4>
                    <div class="tech-chips">
                        ${item.technologies.map(tech => `<span class="tech-chip">${tech}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            ${(item.competencies && item.competencies.length) || (ui.skill_tags && ui.skill_tags.length) ? `
                <div style="margin-top:2rem; padding:2rem; background:var(--bg-app); border-radius:12px;">
                    <h4 style="margin-bottom:1rem; font-size:0.9rem;">${t('ui.drawer_skill_competencies_label', ui.drawer_skill_competencies_label || '')}</h4>
                    <ul style="list-style:none; display:flex; flex-wrap:wrap; gap:8px;">
                        ${(item.competencies && item.competencies.length ? item.competencies : ui.skill_tags || []).map(tag => `
                            <li style="padding:6px 12px; background:white; border:1px solid var(--border); border-radius:20px; font-size:0.75rem; font-weight:600;">${tag}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    } else if (type === 'exp') {
        const item = locale[contextSection].experience[index];
        const sectionData = locale[contextSection];
        const ui = locale.ui || {};
        contentHtml = `
            <span class="dim-label">${getItemText(contextSection, 'experience', item, 'company_name', item.company_name)} | ${getItemText(contextSection, 'experience', item, 'timeframe', item.timeframe)}</span>
            <h2 style="margin-top:0.5rem; margin-bottom: 2rem;">${getItemText(contextSection, 'experience', item, 'role_title', item.role_title)}</h2>
            
            <div class="narrative-section" style="margin-bottom: 2.5rem;">
                <p style="font-size: 1.25rem; color: var(--primary); font-style: italic; margin-bottom: 1.5rem; line-height: 1.4; font-weight: 500;">
                    "${getItemText(contextSection, 'experience', item, 'intro_quote', item.intro_quote || "")}"
                </p>
                <div style="font-size:1.05rem; line-height:1.7; color:var(--text-main);">
                    ${getItemText(contextSection, 'experience', item, 'details_text', item.details_text)}
                </div>
            </div>

            <div class="narrative-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 2rem;">
                <div class="info-block">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${getText(contextSection, 'challenge_label', sectionData.challenge_label || "")}</h4>
                    <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">${getItemText(contextSection, 'experience', item, 'challenge_text', item.challenge_text || "")}</p>
                </div>
                <div class="info-block">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${getText(contextSection, 'learning_label', sectionData.learning_label || "")}</h4>
                    <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">${getItemText(contextSection, 'experience', item, 'key_learning_text', item.key_learning_text || "")}</p>
                </div>
            </div>

            <div style="margin-top: 2.5rem; padding: 1.5rem; background: var(--accent-soft); border-radius: 12px; border-left: 4px solid var(--accent);">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-main); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${getText(contextSection, 'impact_label', sectionData.impact_label || "")}</h4>
                <p style="font-size: 1rem; line-height: 1.6; color: var(--text-main); margin: 0;">${getItemText(contextSection, 'experience', item, 'present_link', item.present_link || "")}</p>
            </div>
            
            ${item.technologies && item.technologies.length ? `
                <div style="margin-top:2.5rem;">
                    <h4 style="font-size:0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${t('ui.technologies_label', ui.technologies_label || '')}</h4>
                    <div class="tech-chips">
                        ${item.technologies.map(tech => `<span class="tech-chip">${tech}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } else if (type === 'mindset') {
        const adoptionBlock = locale[contextSection].adoption ? [locale[contextSection].adoption] : [];
        const combinedBlocks = [...adoptionBlock, ...locale[contextSection].blocks];
        const item = combinedBlocks[index];
        const ui = locale.ui || {};
        contentHtml = `
            <div style="display:flex; align-items:center; gap:1rem; margin-bottom: 1rem;">
                <span style="color: var(--accent); display:inline-flex;">${renderIcon(item.icon, 'icon icon-xl')}</span>
                <span class="dim-label" style="margin:0;">${t('ui.drawer_mindset_label', ui.drawer_mindset_label || '')}</span>
            </div>
            <h2 style="margin-top:0.5rem; margin-bottom: 2rem;">${getItemText(contextSection, 'blocks', item, 'title', item.title)}</h2>
            ${item.image ? `
                <div style="margin-bottom:2.5rem;">
                    <img src="${resolveAssetPath('photos', item.image)}" alt="${getItemText(contextSection, 'blocks', item, 'title', item.title)}" loading="lazy" decoding="async" style="width:100%; max-width:520px; border-radius:16px; border:1px solid var(--border); box-shadow: var(--shadow-sm); object-position:${item.image_position || 'center 20%'}; ${getImageTransform(item.image_zoom)}">
                </div>
            ` : ''}
            
            <div style="margin-bottom: 3rem;">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${t('ui.drawer_mindset_story_label', ui.drawer_mindset_story_label || '')}</h4>
                <div style="font-size:1.15rem; line-height:1.7; color:var(--text-main); font-style: italic; background: var(--bg-app); padding: 2rem; border-radius: 16px;">
                    "${getItemText(contextSection, 'blocks', item, 'story_text', item.story_text)}"
                </div>
            </div>

            <div style="margin-top: 3rem;">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">O Princípio: ${getItemText(contextSection, 'blocks', item, 'principle_title', item.principle_title)}</h4>
                <div style="font-size:1.1rem; line-height:1.7; color:var(--text-main);">
                    ${getItemText(contextSection, 'blocks', item, 'engineering_note', item.engineering_note)}
                </div>
            </div>

            <div style="margin-top:4rem; padding:2rem; background:var(--primary); color:white; border-radius:16px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; opacity: 0.12; color: var(--accent);">
                    ${renderIcon(item.icon, 'icon icon-xxl')}
                </div>
                <p style="font-size: 0.95rem; opacity: 0.9; max-width: 85%;">${t('ui.mindset_trace_text', ui.mindset_trace_text || '')}</p>
            </div>
        `;
    }

    if (dom.drawerBody) dom.drawerBody.innerHTML = contentHtml;
    if (dom.drawer) dom.drawer.classList.add('open');
}

function closeDrawer() {
    if (dom.drawer) dom.drawer.classList.remove('open');
}

// Export for inline handlers
window.app = {
    showDetail,
    navigateTo
};

document.addEventListener('DOMContentLoaded', bootstrap);
