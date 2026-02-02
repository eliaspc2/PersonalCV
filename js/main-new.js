import { DEFAULT_PATHS, DEFAULT_THEME } from './constants.js';
import { renderIcon, normalizeIconValue, isIconId } from './icon-set.js';
import { buildPageContext } from '../core/page-context.js';
import { renderFullPage } from '../core/page-orchestrator.js';
import { pagesRegistry } from '../pages/pages-registry.js';
import { setRenderState } from './cv-render.js';

const CV_PATH = 'data/cv.json';
const SITE_CONFIG_PATH = 'data/site-config.json';

const dom = {
    sidebar: document.querySelector('.sidebar'),
    nav: document.querySelector('.sidebar-nav'),
    content: document.getElementById('dynamic-content'),
    breadcrumb: document.getElementById('active-breadcrumb'),
    langSwitcher: document.getElementById('lang-switcher'),
    langSwitcherMobile: document.getElementById('lang-switcher-mobile'),
    sidebarPhoto: document.getElementById('sidebar-photo')
};

let cvData = null;
let siteConfig = null;
let currentLang = 'pt';
let sectionObserver = null;

function normalizeBasePath(value, fallback) {
    const base = value || fallback;
    if (!base) return '';
    return base.endsWith('/') ? base : `${base}/`;
}

function resolveAssetPath(kind, filename, paths) {
    if (!filename) return '';
    const base = normalizeBasePath(paths?.[kind], DEFAULT_PATHS[kind]);
    return `${base}${filename}`;
}

function applyTheme(theme) {
    const merged = { ...DEFAULT_THEME, ...(theme || {}) };
    const root = document.documentElement;
    Object.entries(merged).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            root.style.setProperty(`--${key.replace(/_/g, '-')}`, value);
        }
    });
}

function applyLayout(layout) {
    const root = document.documentElement;
    if (!layout) return;
    if (layout.section_padding_top !== undefined) {
        root.style.setProperty('--section-pad-top', `${layout.section_padding_top}px`);
    }
    if (layout.section_padding_bottom !== undefined) {
        root.style.setProperty('--section-pad-bottom', `${layout.section_padding_bottom}px`);
    }
    if (layout.snap) {
        root.style.setProperty('--snap-type', layout.snap);
    }
}

function getConfigPages() {
    return siteConfig?.pages?.items || [];
}

function getOrderedPages() {
    const items = getConfigPages();
    const order = Array.isArray(siteConfig?.pages?.order) && siteConfig.pages.order.length
        ? siteConfig.pages.order
        : items.map((item) => item.id);
    const map = new Map(items.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)).filter(Boolean);
}

function updateBreadcrumb(sectionId) {
    if (!dom.breadcrumb) return;
    const item = getConfigPages().find((entry) => entry.id === sectionId);
    const label = item?.labels?.[currentLang] || sectionId;
    dom.breadcrumb.textContent = label;
}

function setActiveSection(sectionId) {
    const navItems = dom.nav ? dom.nav.querySelectorAll('.nav-item') : [];
    navItems.forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
    });
    updateBreadcrumb(sectionId);
}

function setupNav() {
    if (!dom.nav || !dom.content) return;
    const pages = getOrderedPages().filter((item) => !item.hidden);
    const pageIds = new Set(pages.map((item) => item.id));

    dom.nav.querySelectorAll('.nav-item').forEach((item) => {
        const id = item.getAttribute('data-section');
        if (!pageIds.has(id)) item.remove();
    });

    pages.forEach((page) => {
        const navItem = dom.nav.querySelector(`.nav-item[data-section="${page.id}"]`);
        if (!navItem) return;
        const label = navItem.querySelector('.nav-label');
        if (label) {
            label.textContent = page.labels?.[currentLang] || label.textContent || page.id;
        }
        const iconValue = normalizeIconValue(page.icons?.[currentLang]);
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
    });
}

function ensureSections() {
    if (!dom.content) return;
    const pages = getOrderedPages().filter((item) => !item.hidden);
    const ids = new Set(pages.map((item) => item.id));

    dom.content.querySelectorAll('.view-section').forEach((section) => {
        const id = section.dataset.section;
        if (id && !ids.has(id)) section.remove();
    });

    pages.forEach((page) => {
        const existing = document.getElementById(`section-${page.id}`);
        if (!existing) {
            const sectionEl = document.createElement('section');
            sectionEl.id = `section-${page.id}`;
            sectionEl.className = 'view-section';
            sectionEl.dataset.section = page.id;
            dom.content.appendChild(sectionEl);
        }
    });
}

function renderPages() {
    const pages = getOrderedPages().filter((item) => !item.hidden);
    const locale = cvData?.localized?.[currentLang] || {};

    pages.forEach((page) => {
        const module = pagesRegistry[page.id];
        if (!module) return;
        const container = document.getElementById(`section-${page.id}`);
        if (!container) return;
        const data = locale[page.id] || locale[page.type];
        if (!data) return;
        container.innerHTML = '';
        const context = buildPageContext({
            pageId: page.id,
            data,
            container,
            lang: currentLang,
            ui: locale.ui,
            meta: cvData.meta
        });
        renderFullPage(module, context);
    });
}

function setupScrollSpy() {
    if (sectionObserver) sectionObserver.disconnect();
    const sections = Array.from(document.querySelectorAll('.view-section'));
    if (!sections.length) return;
    sectionObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const sectionId = visible[0].target.dataset.section;
        if (sectionId) setActiveSection(sectionId);
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.2, 0.6] });

    sections.forEach((section) => sectionObserver.observe(section));
}

function setupNavClicks() {
    if (!dom.nav) return;
    dom.nav.addEventListener('click', (event) => {
        const target = event.target.closest('.nav-item');
        if (!target) return;
        const sectionId = target.getAttribute('data-section');
        if (!sectionId) return;
        event.preventDefault();
        const section = document.getElementById(`section-${sectionId}`);
        if (!section) return;
        const headerOffset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
        const targetTop = section.getBoundingClientRect().top + window.pageYOffset - headerOffset - 10;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
}

function setupLangSwitchers() {
    const onLangChange = (value) => {
        currentLang = value;
        if (dom.langSwitcher) dom.langSwitcher.value = value;
        if (dom.langSwitcherMobile) dom.langSwitcherMobile.value = value;
        setupNav();
        renderPages();
        setupScrollSpy();
    };

    if (dom.langSwitcher) {
        dom.langSwitcher.addEventListener('change', (event) => onLangChange(event.target.value));
    }
    if (dom.langSwitcherMobile) {
        dom.langSwitcherMobile.addEventListener('change', (event) => onLangChange(event.target.value));
    }
}

function updateMeta() {
    const meta = cvData?.meta || {};
    const site = siteConfig?.site || {};
    const title = site.title || meta.site_title;
    const description = site.description || meta.site_description;
    const favicon = resolveAssetPath('icons', site.favicon || meta.favicon || 'favicon.ico', siteConfig?.paths || cvData?.paths);
    const appleIcon = resolveAssetPath('icons', site.apple_icon || meta.apple_icon || 'apple-touch-icon.png', siteConfig?.paths || cvData?.paths);

    if (title) document.title = title;
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

function updateSidebarProfile() {
    const overview = cvData?.localized?.[currentLang]?.overview || cvData?.localized?.[currentLang]?.[cvData?.meta?.section_types?.overview || 'overview'] || {};
    const name = cvData?.profile?.name || overview?.name;
    const role = cvData?.profile?.role || overview?.headline;

    const brandName = document.getElementById('brand-trigger');
    const statusEl = document.querySelector('.brand-status');
    if (brandName && name) brandName.textContent = name;
    if (statusEl && role) statusEl.textContent = role;

    if (dom.sidebarPhoto && cvData?.profile?.photo) {
        dom.sidebarPhoto.src = resolveAssetPath('photos', cvData.profile.photo, siteConfig?.paths || cvData?.paths);
        dom.sidebarPhoto.style.objectPosition = cvData.profile.photo_position || 'center 20%';
        const zoom = Number(cvData.profile.photo_zoom || 1);
        dom.sidebarPhoto.style.transform = zoom !== 1 ? `scale(${zoom})` : '';
        dom.sidebarPhoto.style.transformOrigin = 'center';
    }
}

async function bootstrap() {
    const [cvResp, configResp] = await Promise.all([
        fetch(CV_PATH, { cache: 'no-store' }),
        fetch(SITE_CONFIG_PATH, { cache: 'no-store' })
    ]);

    cvData = await cvResp.json();
    siteConfig = await configResp.json();
    currentLang = cvData?.meta?.defaultLanguage || 'pt';

    setRenderState({ cv: cvData, config: { ...siteConfig?.globals, layout: siteConfig?.globals?.layout, theme: siteConfig?.globals?.theme }, lang: currentLang });
    applyTheme(siteConfig?.globals?.theme || cvData?.meta?.theme || {});
    applyLayout(siteConfig?.globals?.layout || cvData?.meta?.layout || {});

    ensureSections();
    setupNav();
    updateMeta();
    updateSidebarProfile();
    setupNavClicks();
    setupLangSwitchers();
    renderPages();
    setupScrollSpy();

    const firstPage = getOrderedPages().find((page) => !page.hidden);
    if (firstPage) setActiveSection(firstPage.id);
}

bootstrap().catch((err) => {
    console.error('Failed to bootstrap new site pipeline.', err);
});
