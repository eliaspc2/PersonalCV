import { getSecureItem } from './crypto-utils.js';

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

const DEFAULT_PATHS = {
    photos: 'assets/photos/',
    downloads: 'assets/downloads/',
    icons: 'assets/icons/'
};

const NAV_TYPE_ICONS = {
    overview: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    development: `<svg class="nav-icon" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    foundation: `<svg class="nav-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    mindset: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    now: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 12h7l2 3h9"/><path d="M3 12l2-3h6"/><circle cx="19" cy="12" r="2"/></svg>`,
    contact: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`
};

function normalizeBasePath(value, fallback) {
    const base = value || fallback;
    if (!base) return '';
    return base.endsWith('/') ? base : `${base}/`;
}

function getPaths() {
    if (!cvData?.paths) return { ...DEFAULT_PATHS };
    return {
        photos: normalizeBasePath(cvData.paths.photos, DEFAULT_PATHS.photos),
        downloads: normalizeBasePath(cvData.paths.downloads, DEFAULT_PATHS.downloads),
        icons: normalizeBasePath(cvData.paths.icons, DEFAULT_PATHS.icons)
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

function getContactHref(profile) {
    const email = profile?.social?.email || 'eliaspc2@gmail.com';
    return email ? `mailto:${email}` : '#contact';
}

function getImageTransform(zoom) {
    const scale = Number(zoom);
    if (!Number.isFinite(scale) || scale === 1) return '';
    return `transform: scale(${scale}); transform-origin: center;`;
}

function normalizeDownloads(profile, locale) {
    if (!profile) return [];
    const downloads = profile.downloads;
    if (Array.isArray(downloads)) {
        return downloads.map((item) => ({
            label: item?.label || '',
            icon: item?.icon || '',
            href: item?.href || '',
            group: item?.group || 'downloads'
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
            group: groupMap[key] || 'downloads'
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
        }

        if (!cvData) {
            const response = await fetch('data/cv.json', { cache: 'no-store' });
            cvData = await response.json();
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
    const onLangChange = (value) => {
        currentLang = value;
        if (dom.langSwitcher) dom.langSwitcher.value = value;
        if (dom.langSwitcherMobile) dom.langSwitcherMobile.value = value;
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
    const ui = locale?.ui || {};
    const title = ui.page_title || meta.site_title;
    const description = ui.page_description || meta.site_description;
    const favicon = resolveAssetPath('icons', meta.favicon);
    const appleIcon = resolveAssetPath('icons', meta.apple_icon);

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
    if (menuBtn && ui.menu_label) {
        menuBtn.textContent = ui.menu_label;
    }
    const langSelect = document.getElementById('lang-switcher');
    const langMobile = document.getElementById('lang-switcher-mobile');
    if (ui.language_label) {
        if (langSelect) langSelect.setAttribute('aria-label', ui.language_label);
        if (langMobile) langMobile.setAttribute('aria-label', ui.language_label);
    }
}

function updateNavigationLabels(locale) {
    document.querySelectorAll('[data-nav]').forEach(label => {
        const key = label.getAttribute('data-nav');
        if (locale.navigation && locale.navigation[key]) {
            label.textContent = locale.navigation[key];
        }
        const navItem = label.closest('.nav-item');
        const iconValue = locale.navigation_icons && locale.navigation_icons[key];
        if (navItem) {
            let emoji = navItem.querySelector('.nav-emoji');
            const svgIcon = navItem.querySelector('.nav-icon');
            if (iconValue) {
                if (!emoji) {
                    emoji = document.createElement('span');
                    emoji.className = 'nav-emoji';
                    navItem.insertBefore(emoji, navItem.firstChild);
                }
                emoji.textContent = iconValue;
                if (svgIcon) svgIcon.style.display = 'none';
            } else {
                if (emoji) emoji.remove();
                if (svgIcon) svgIcon.style.display = '';
            }
        }
    });
    updateBreadcrumb(currentSection, locale);
}

function updateBreadcrumb(sectionId, locale) {
    if (!dom.breadcrumb || !sectionId) return;
    const label = (locale && locale.navigation && locale.navigation[sectionId]) || sectionId;
    dom.breadcrumb.textContent = label;
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
    const ctaLabel = data.cta_label || ui.cta_contact_label;
    const ctaHref = data.cta_link || getContactHref(profile);
    container.innerHTML = `
        <div class="hero-section">
            <div class="hero-header-flex" style="display:flex; align-items:center; gap:2.5rem; margin-bottom:4rem; flex-wrap:wrap;">
                <div class="profile-group" style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                    <div class="profile-circle large" style="width:140px; height:140px; border-width:3px; box-shadow: var(--shadow-md);">
                        <img src="${resolveAssetPath('photos', profile.photo)}" alt="André Câmara" loading="lazy" decoding="async" style="object-position:${profile.photo_position || 'center 20%'}; ${getImageTransform(profile.photo_zoom)}">
                    </div>
                </div>
                <div style="flex:1; min-width:300px;">
                    <h1 class="hero-tagline" style="margin:0; font-size: 3rem;">${data.headline}</h1>
                    <p style="color:var(--text-muted); font-weight:600; margin-top:0.75rem; display:flex; align-items:center; gap:8px;">
                        <svg style="width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${data.location}
                    </p>
                    ${certifications.length ? `
                        <div class="cert-badges">
                            ${certifications.map(cert => `
                                <a class="cert-chip" href="${resolveAssetPath('downloads', cert.href)}" target="_blank" rel="noopener">
                                    ${cert.label}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <p class="hero-intro" style="font-weight: 500; color: var(--text-main);">${data.intro_text}</p>
            
            <div class="story-text" style="max-width:850px; background: white; padding: 2.5rem; border-radius: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
                <p style="margin-bottom: 2rem;">${data.bio}</p>
                <div style="padding:1.5rem; background:var(--accent-soft); border-radius:12px; border-left:4px solid var(--accent);">
                    <p style="font-size:0.95rem; color:var(--text-main); margin:0;">
                        ${ui.marketing_label ? `<strong style="color:var(--accent)">${ui.marketing_label}:</strong>` : ''} ${data.marketing_note}
                    </p>
                </div>
            </div>
            ${(data.languages && data.languages.length) || (data.education && data.education.length) ? `
                <div class="overview-meta">
                    ${data.languages && data.languages.length ? `
                        <div class="overview-meta-block">
                            <span class="dim-label">${data.languages_label || ''}</span>
                            <p>${data.languages.join(' · ')}</p>
                        </div>
                    ` : ''}
                    ${data.education && data.education.length ? `
                        <div class="overview-meta-block">
                            <span class="dim-label">${data.education_label || ''}</span>
                            <p>${data.education.join(' · ')}</p>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            ${data.next_text ? `
                <div class="section-transition">
                    ${data.next_label ? `<span>${data.next_label}</span>` : ''}
                    ${data.next_text}
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
    const ctaLabel = data.cta_label || ui.cta_contact_label;
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const skillsHtml = data.skills.map((skill, index) => `
        <div class="rich-card" onclick="app.showDetail('skill', ${index}, '${sectionId}')">
            <div class="card-tags">
                <span class="focus-tag">${skill.focus_area}</span>
                ${skill.progress_status ? `<span class="status-tag">${skill.progress_status}</span>` : ''}
            </div>
            <h3>${skill.title}</h3>
            ${skill.duration_hours ? `<div class="dim-label">${skill.duration_hours}</div>` : ''}
            <p style="color:var(--text-muted); margin-bottom:1.5rem; line-height:1.5;">${skill.context_text}</p>
            <div class="explore-hint">${ui.explore_skill_label || ''}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${data.title}</h2>
            <p class="section-desc">${data.description}</p>
            ${data.image ? `
                <div class="development-layout">
                    <div class="development-image">
                        <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                    </div>
                    <div class="development-cards">
                        ${skillsHtml}
                    </div>
                </div>
            ${data.next_text ? `
                <div class="section-transition">
                        ${data.next_label ? `<span>${data.next_label}</span>` : ''}
                        ${data.next_text}
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
    const ctaLabel = data.cta_label || ui.cta_contact_label;
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    container.innerHTML = `
        <div class="section-container">
            <div class="section-header foundation-header">
                ${data.image ? `
                    <div class="foundation-circle">
                        <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                    </div>
                ` : ''}
                <div class="foundation-text">
                    <h2 class="section-title">${data.title}</h2>
                    <p class="section-desc foundation-desc">${data.description}</p>
                </div>
            </div>
            <div class="timeline-rich">
                ${data.experience.map((exp, index) => `
                    <div class="rich-card" style="margin-bottom: 2rem;" onclick="app.showDetail('exp', ${index}, '${sectionId}')">
                        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
                           <span class="focus-tag">${exp.company_name}</span>
                           <span style="font-size:0.8rem; font-weight:700; color:var(--text-dim);">${exp.timeframe}</span>
                        </div>
                        <h3>${exp.role_title}</h3>
                        <p style="color:var(--text-muted); line-height:1.5;">${exp.summary_text}</p>
                        <div class="explore-hint">${ui.explore_experience_label || ''}</div>
                    </div>
                `).join('')}
            </div>
            ${data.next_text ? `
                <div class="section-transition">
                    ${data.next_label ? `<span>${data.next_label}</span>` : ''}
                    ${data.next_text}
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
    const ctaLabel = data.cta_label || ui.cta_contact_label;
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    const adoptionBlock = data.adoption ? [data.adoption] : [];
    const allBlocks = [...adoptionBlock, ...data.blocks];
    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${data.title}</h2>
            <p class="section-desc">${data.subtitle}</p>

            <div class="philosophy-box" style="margin-bottom: 4rem;">
                <p>${data.philosophy}</p>
            </div>

            <div class="mindset-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2.5rem;">
                ${allBlocks.map((block, index) => `
                    <div class="rich-card mindset-card ${block.id === 'adocao' || block.id === 'adopcion' || block.id === 'adoption' ? 'adoption-card' : ''}" onclick="app.showDetail('mindset', ${index}, '${sectionId}')" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <div style="height: 200px; background: var(--border); overflow: hidden; position: relative;">
                            ${block.image ? `<img src="${resolveAssetPath('photos', block.image)}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover; object-position: ${block.image_position || 'center 20%'}; ${getImageTransform(block.image_zoom)} opacity: 0.8; transition: var(--transition);">` : `
                                <div style="display:flex; align-items:center; justify-content:center; height:100%; font-size: 5rem;">${block.icon}</div>
                            `}
                            <div style="position: absolute; bottom: 1rem; left: 1rem; background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em;">
                                ${block.principle_title}
                            </div>
                        </div>
                        <div style="padding: 2rem;">
                            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 1rem;">
                                <span style="font-size: 1.5rem;">${block.icon}</span>
                                <h3 style="margin:0;">${block.title}</h3>
                            </div>
                            <p style="color:var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
                                ${block.story_text.substring(0, 120)}...
                            </p>
                            <div class="explore-hint" style="margin-top: auto;">${ui.explore_mindset_label || ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${data.next_text ? `
                <div class="section-transition">
                    ${data.next_label ? `<span>${data.next_label}</span>` : ''}
                    ${data.next_text}
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
    const ctaLabel = data.cta_label || ui.cta_contact_label;
    const downloads = normalizeDownloads(profile, locale);
    const ctaHref = data.cta_link || `mailto:${profile.social.email}`;
    const downloadIcon = `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const certIcon = `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    const renderDownloadIcon = (item, fallbackIcon) => {
        return item.icon ? `<span class="nav-emoji">${item.icon}</span>` : fallbackIcon;
    };
    const renderDownloadItem = (item, fallbackIcon, { openInNewTab = false } = {}) => {
        if (!item.href) return '';
        const attrs = openInNewTab ? 'target="_blank" rel="noopener"' : 'download';
        const href = resolveAssetPath('downloads', item.href);
        return `
            <a href="${href}" ${attrs} class="download-item nav-item">
                ${renderDownloadIcon(item, fallbackIcon)}
                <span>${item.label || item.href}</span>
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
                label: group.label || group.id,
                openInNewTab: Boolean(group.open_in_new_tab),
                icon: group.icon || ''
            });
        });
    } else {
        groupMap.set('downloads', {
            label: data.downloads_title,
            openInNewTab: false,
            icon: ''
        });
        groupMap.set('certs', {
            label: data.certifications_title,
            openInNewTab: true,
            icon: ''
        });
    }

    const groupIds = new Set([...groupMap.keys(), ...downloads.map((item) => item.group || 'downloads')]);
    groupIds.forEach((groupId) => {
        const groupItems = downloads.filter(item => (item.group || 'downloads') === groupId);
        if (!groupItems.length) return;
        const groupDef = groupMap.get(groupId) || { label: groupId, openInNewTab: false, icon: '' };
        const fallbackIcon = groupDef.icon
            ? `<span class="nav-emoji">${groupDef.icon}</span>`
            : (groupId === 'certs' ? certIcon : downloadIcon);
        downloadGroups.push({
            label: groupDef.label || groupId,
            items: groupItems,
            icon: fallbackIcon,
            openInNewTab: groupDef.openInNewTab
        });
    });

    container.innerHTML = `
        <div class="contact-hero">
            <div style="margin-bottom:3rem; display:flex; flex-direction:column; align-items:center;">
                <div class="profile-circle" style="width:120px; height:120px; border-width:2px; margin-bottom:1.5rem; box-shadow: var(--shadow-md);">
                    <img src="${resolveAssetPath('photos', profile.contact_photo || profile.photo)}" alt="André Câmara" loading="lazy" decoding="async" style="object-position:${profile.contact_photo_position || profile.photo_position || 'center 20%'}; ${getImageTransform(profile.contact_photo_zoom || profile.photo_zoom)}">
                </div>
                <p class="dim-label" style="letter-spacing:0.1em; margin-bottom:1rem;">${data.email_label}</p>
                <h2 style="margin-bottom:1rem;">${data.title}</h2>
                <p style="color:var(--text-muted); font-size:1.1rem; max-width:600px; margin-left:auto; margin-right:auto;">${data.description}</p>
                ${ctaLabel ? `
                    <div style="margin-top:2rem;">
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
                                ${group.items.map(item => renderDownloadItem(item, group.icon, { openInNewTab: group.openInNewTab })).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="margin-top:6rem; display:flex; justify-content:center; gap:3rem;">
                <a href="${profile.social.linkedin}" target="_blank" class="social-icon-link" style="color:var(--primary); font-weight:700; font-size: 1.1rem; display:flex; align-items:center; gap:8px;">
                    <svg style="width:24px; height:24px;" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    ${data.linkedin_label || 'LinkedIn'}
                </a>
                <a href="${profile.social.github}" target="_blank" class="social-icon-link" style="color:var(--primary); font-weight:700; font-size: 1.1rem; display:flex; align-items:center; gap:8px;">
                    <svg style="width:24px; height:24px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.362.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12"/></svg>
                    ${data.github_label || 'GitHub'}
                </a>
            </div>
        </div>
    `;
}

function renderNow(data, container, sectionId = 'now') {
    if (!data || !container) return;
    const ctaHref = data.cta_link || getContactHref(cvData.profile);
    container.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">${data.title}</h2>
            <p class="section-desc">${data.summary}</p>
            <div class="now-layout">
                ${data.image ? `
                    <div class="now-media">
                        <img src="${resolveAssetPath('photos', data.image)}" alt="${data.image_alt || data.title}" loading="lazy" decoding="async" style="object-position:${data.image_position || 'center 20%'}; ${getImageTransform(data.image_zoom)}">
                    </div>
                ` : ''}
                <div class="now-card">
                    <p>${data.details}</p>
                    <div style="margin-top:2rem;">
                        <a class="cta-btn" href="${ctaHref}">${data.cta_label}</a>
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
            <span class="dim-label">${item.focus_area}</span>
            <h2 style="margin-top:0.5rem;">${item.title}</h2>
            ${item.progress_status ? `<div class="status-line">${item.progress_status}${item.duration_hours ? ` · ${item.duration_hours}` : ''}</div>` : ''}
            <div class="story-text" style="color:var(--text-main); margin-top:1.5rem;">
                ${item.context_text}
            </div>
            
            <div style="margin-top:2.5rem;">
                <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--accent); margin-bottom:1rem;">${ui.drawer_skill_context_label || ''}</h4>
                <div style="font-size:1rem; line-height:1.7; color:var(--text-muted); font-style:italic; padding-left:1.5rem; border-left:2px solid var(--border);">
                    ${item.background || ui.drawer_skill_default_history || ""}
                </div>
            </div>
            ${item.resource ? `
                <div style="margin-top:2.5rem;">
                    <a href="${resolveAssetPath('downloads', item.resource.href)}" class="resource-btn" target="_blank" rel="noopener" download>${item.resource.label}</a>
                </div>
            ` : ''}

            ${item.technologies && item.technologies.length ? `
                <div style="margin-top:2.5rem;">
                    <h4 style="font-size:0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${ui.technologies_label || ''}</h4>
                    <div class="tech-chips">
                        ${item.technologies.map(tech => `<span class="tech-chip">${tech}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            ${(item.competencies && item.competencies.length) || (ui.skill_tags && ui.skill_tags.length) ? `
                <div style="margin-top:2rem; padding:2rem; background:var(--bg-app); border-radius:12px;">
                    <h4 style="margin-bottom:1rem; font-size:0.9rem;">${ui.drawer_skill_competencies_label || ''}</h4>
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
            <span class="dim-label">${item.company_name} | ${item.timeframe}</span>
            <h2 style="margin-top:0.5rem; margin-bottom: 2rem;">${item.role_title}</h2>
            
            <div class="narrative-section" style="margin-bottom: 2.5rem;">
                <p style="font-size: 1.25rem; color: var(--primary); font-style: italic; margin-bottom: 1.5rem; line-height: 1.4; font-weight: 500;">
                    "${item.intro_quote || ""}"
                </p>
                <div style="font-size:1.05rem; line-height:1.7; color:var(--text-main);">
                    ${item.details_text}
                </div>
            </div>

            <div class="narrative-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 2rem;">
                <div class="info-block">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${sectionData.challenge_label || ""}</h4>
                    <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">${item.challenge_text || ""}</p>
                </div>
                <div class="info-block">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${sectionData.learning_label || ""}</h4>
                    <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-muted);">${item.key_learning_text || ""}</p>
                </div>
            </div>

            <div style="margin-top: 2.5rem; padding: 1.5rem; background: var(--accent-soft); border-radius: 12px; border-left: 4px solid var(--accent);">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-main); margin-bottom: 0.5rem; letter-spacing: 0.05em;">${sectionData.impact_label || ""}</h4>
                <p style="font-size: 1rem; line-height: 1.6; color: var(--text-main); margin: 0;">${item.present_link || ""}</p>
            </div>
            
            ${item.technologies && item.technologies.length ? `
                <div style="margin-top:2.5rem;">
                    <h4 style="font-size:0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${ui.technologies_label || ''}</h4>
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
                <span style="font-size: 2.5rem;">${item.icon}</span>
                <span class="dim-label" style="margin:0;">${ui.drawer_mindset_label || ''}</span>
            </div>
            <h2 style="margin-top:0.5rem; margin-bottom: 2rem;">${item.title}</h2>
            ${item.image ? `
                <div style="margin-bottom:2.5rem;">
                    <img src="${resolveAssetPath('photos', item.image)}" alt="${item.title}" loading="lazy" decoding="async" style="width:100%; max-width:520px; border-radius:16px; border:1px solid var(--border); box-shadow: var(--shadow-sm); object-position:${item.image_position || 'center 20%'}; ${getImageTransform(item.image_zoom)}">
                </div>
            ` : ''}
            
            <div style="margin-bottom: 3rem;">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">${ui.drawer_mindset_story_label || ''}</h4>
                <div style="font-size:1.15rem; line-height:1.7; color:var(--text-main); font-style: italic; background: var(--bg-app); padding: 2rem; border-radius: 16px;">
                    "${item.story_text}"
                </div>
            </div>

            <div style="margin-top: 3rem;">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; letter-spacing: 0.05em;">O Princípio: ${item.principle_title}</h4>
                <div style="font-size:1.1rem; line-height:1.7; color:var(--text-main);">
                    ${item.engineering_note}
                </div>
            </div>

            <div style="margin-top:4rem; padding:2rem; background:var(--primary); color:white; border-radius:16px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 6rem; opacity: 0.1;">${item.icon}</div>
                <p style="font-size: 0.95rem; opacity: 0.9; max-width: 85%;">${ui.mindset_trace_text || ''}</p>
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
