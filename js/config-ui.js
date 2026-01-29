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
    contact: { pt: 'Contacto', es: 'Contacto', en: 'Contact' },
    downloads: { pt: 'Downloads', es: 'Descargas', en: 'Downloads' }
};

const LANGS = ['pt', 'es', 'en'];
const OPENAI_KEY_STORAGE = 'openai_api_key';
const REPO_OWNER_STORAGE = 'repo_owner';
const REPO_NAME_STORAGE = 'repo_name';
const PREVIEW_STORAGE = 'preview_cv';
const PREVIEW_SECTION_MAP = {
    downloads: 'contact'
};

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

const NAV_SECTIONS = new Set(['overview', 'development', 'foundation', 'mindset', 'now', 'contact']);
const EMOJI_CHOICES = [
    '🏠', '🧭', '🧠', '🧩', '🧱', '⚙️', '🛠️', '🧪', '🧰', '📚',
    '📌', '📍', '📎', '📝', '📄', '📂', '📁', '🗂️', '🧾', '🔖',
    '🌐', '💡', '🚀', '✨', '⭐', '🔥', '💬', '☎️', '✉️', '🔗',
    '🏆', '🎓', '🧑‍🍳', '🍞', '🍕', '🗳️', '🛡️', '🧘', '📷', '👤'
];

function normalizeFileName(name) {
    return name ? name.replace(/\s+/g, '-').toLowerCase() : 'image';
}

function getImageBaseFolder(sectionKey, key) {
    if (sectionKey === 'meta') return 'assets/icons';
    if (sectionKey === 'overview') return 'assets/photos/identity';
    if (sectionKey === 'development') return 'assets/photos/engineering';
    if (sectionKey === 'foundation') return 'assets/photos/foundation';
    if (sectionKey === 'mindset') return 'assets/photos/mindset';
    if (sectionKey === 'now') return 'assets/photos/now';
    if (sectionKey === 'contact') return 'assets/photos/contact';
    return 'assets/photos';
}

function getImagePositionKey(key) {
    if (key === 'image') return 'image_position';
    if (key.endsWith('_image')) return `${key}_position`;
    if (key.endsWith('photo')) return `${key}_position`;
    return null;
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

function makeEmojiField(wrapper, targetObj, key, placeholder = 'ex: 🧭') {
    const row = document.createElement('div');
    row.className = 'inline-input';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = targetObj[key] || '';
    input.oninput = (event) => {
        targetObj[key] = event.target.value;
        renderPreview();
    };
    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'toggle-visibility';
    pickBtn.textContent = 'Escolher';
    pickBtn.onclick = () => {
        openEmojiPicker((emoji) => {
            input.value = emoji;
            targetObj[key] = emoji;
            renderPreview();
        });
    };
    row.appendChild(input);
    row.appendChild(pickBtn);
    wrapper.appendChild(row);
    return input;
}

function appendNavigationFields(sectionKey) {
    if (!currentCV?.localized?.[currentLang]) return;
    if (!NAV_SECTIONS.has(sectionKey)) return;
    const { nav, icons } = ensureNavigationConfig(currentCV.localized[currentLang]);
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
    labelInput.placeholder = SECTION_LABELS[sectionKey]?.[currentLang] || sectionKey;
    labelInput.value = nav[sectionKey] || '';
    labelInput.oninput = (event) => {
        nav[sectionKey] = event.target.value;
        renderPreview();
    };
    labelWrapper.appendChild(labelLabel);
    labelWrapper.appendChild(labelInput);
    fieldset.appendChild(labelWrapper);

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'form-group';
    const iconLabel = document.createElement('label');
    iconLabel.textContent = 'Ícone do menu';
    iconWrapper.appendChild(iconLabel);
    makeEmojiField(iconWrapper, icons, sectionKey, 'ex: 🧭');
    fieldset.appendChild(iconWrapper);

    uiNodes.editorForm.appendChild(fieldset);
}

function makeImageField(wrapper, targetObj, key, sectionKey) {
    const row = document.createElement('div');
    row.className = 'photo-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = targetObj[key] || '';
    input.oninput = (event) => {
        targetObj[key] = event.target.value;
        renderPreview();
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const base = getImageBaseFolder(sectionKey, key);
        const safeName = normalizeFileName(file.name);
        const suggested = `${base}/${safeName}`;
        input.value = suggested;
        targetObj[key] = suggested;
        renderPreview();
    };
    row.appendChild(input);
    row.appendChild(fileInput);
    wrapper.appendChild(row);

    const adjustRow = document.createElement('div');
    adjustRow.className = 'inline-input';
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
            imagePath: input.value,
            targetObj,
            positionKey: getImagePositionKey(key),
            zoomKey: getImageZoomKey(key),
            frameType: getCropperFrameType(sectionKey, key)
        });
    };
    adjustRow.appendChild(adjustBtn);
    wrapper.appendChild(adjustRow);
}

function makePositionField(wrapper, targetObj, key, labelText) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'ex: center 20%';
    input.value = targetObj[key] || '';
    input.oninput = (event) => {
        targetObj[key] = event.target.value;
        renderPreview();
    };
    const presetRow = document.createElement('div');
    presetRow.className = 'inline-input';
    const presetSelect = document.createElement('select');
    [
        { label: 'Topo', value: 'center 10%' },
        { label: 'Alto', value: 'center 20%' },
        { label: 'Centro', value: 'center 50%' },
        { label: 'Baixo', value: 'center 80%' }
    ].forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.value;
        option.textContent = preset.label;
        presetSelect.appendChild(option);
    });
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'toggle-visibility';
    applyBtn.textContent = 'Aplicar';
    applyBtn.onclick = () => {
        input.value = presetSelect.value;
        targetObj[key] = presetSelect.value;
        renderPreview();
    };
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'toggle-visibility';
    resetBtn.textContent = 'Centro';
    resetBtn.onclick = () => {
        input.value = 'center 50%';
        targetObj[key] = 'center 50%';
        renderPreview();
    };
    presetRow.appendChild(presetSelect);
    presetRow.appendChild(applyBtn);
    presetRow.appendChild(resetBtn);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(presetRow);
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
    hrefInput.value = resource.href || '';

    const sync = () => {
        targetObj[key] = {
            ...(resource || {}),
            label: labelInput.value,
            href: hrefInput.value
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
    input.value = targetObj[key] || '';
    input.oninput = (event) => {
        targetObj[key] = event.target.value;
        renderPreview();
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*/*';
    fileInput.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const safeName = normalizeFileName(file.name);
        const suggested = `${baseFolder}/${safeName}`;
        input.value = suggested;
        targetObj[key] = suggested;
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
    if (!href.startsWith('assets/downloads/')) return;
    pendingDownloadDeletes.add(href);
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
    if (positionKey) {
        makePositionField(wrapper, currentCV.profile, positionKey, positionLabel);
    }
    uiNodes.editorForm.appendChild(wrapper);
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
        label.textContent = key;
        wrapper.appendChild(label);
        makeImageField(wrapper, content, key, sectionKey);
        const positionKey = getImagePositionKey(key);
        if (positionKey) {
            makePositionField(wrapper, content, positionKey, 'Recorte (object-position)');
            handledKeys.add(positionKey);
        }
        uiNodes.editorForm.appendChild(wrapper);
        handledKeys.add(key);
    });
    if (Object.prototype.hasOwnProperty.call(content, 'image_alt')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const label = document.createElement('label');
        label.textContent = 'image_alt';
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
        currentLang = currentCV.meta?.defaultLanguage || 'pt';
        currentSection = 'overview';
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
    Object.keys(SECTION_LABELS).forEach(sectionKey => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const label = SECTION_LABELS[sectionKey][currentLang] || sectionKey;
        btn.textContent = label;
        btn.className = sectionKey === currentSection ? 'active' : '';
        btn.onclick = () => {
            currentSection = sectionKey;
            currentStoryIndex = 0;
            if (sectionKey === 'downloads') currentDownloadGroupIndex = 0;
            renderSidebar();
            renderSectionEditor();
            renderPreview();
        };
        uiNodes.sectionButtons.appendChild(btn);
    });

    const activeSectionName = document.getElementById('active-section-name');
    const activeLangName = document.getElementById('active-lang-name');
    if (activeSectionName) {
        activeSectionName.textContent = SECTION_LABELS[currentSection]?.[currentLang] || currentSection;
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

function renderSectionEditor() {
    if (!currentCV || !uiNodes.editorForm) return;
    if (currentSection === 'downloads') {
        uiNodes.editorForm.innerHTML = '';
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
                    <div class="story-meta">${group.id}</div>
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
                labelLabel.textContent = 'Nome do link';
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
                iconLabel.textContent = 'Ícone (emoji ou texto)';
                iconGroup.appendChild(iconLabel);
                makeEmojiField(iconGroup, entry, 'icon', 'ex: 📁');
                fieldset.appendChild(iconGroup);

                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'form-group';
                const groupLabel = document.createElement('label');
                groupLabel.textContent = 'Grupo';
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
                makeFileField(fileWrapper, entry, 'href', 'Ficheiro (assets/downloads)', 'assets/downloads');
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
        return;
    }

    uiNodes.editorForm.innerHTML = '';
    appendNavigationFields(currentSection);

    if (currentSection === 'overview') {
        appendProfilePhotoField({
            key: 'photo',
            label: 'Foto principal (sidebar / identidade)',
            sectionKey: 'overview',
            positionKey: 'photo_position',
            positionLabel: 'Recorte (object-position) foto principal'
        });
    }

    if (currentSection === 'contact') {
        appendProfilePhotoField({
            key: 'contact_photo',
            label: 'Foto contacto',
            sectionKey: 'contact',
            positionKey: 'contact_photo_position',
            positionLabel: 'Recorte (object-position) foto contacto'
        });

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
        const metaFieldset = document.createElement('fieldset');
        const metaLegend = document.createElement('legend');
        metaLegend.textContent = 'Site (Meta)';
        metaFieldset.appendChild(metaLegend);
        const metaFields = [
            { key: 'site_title', label: 'Título do site' },
            { key: 'site_description', label: 'Descrição do site', multiline: true },
            { key: 'favicon', label: 'Favicon (path)', isImage: true },
            { key: 'apple_icon', label: 'Apple touch icon (path)', isImage: true }
        ];
        metaFields.forEach((field) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';
            const label = document.createElement('label');
            label.textContent = field.label;
            wrapper.appendChild(label);
            if (field.isImage) {
                makeImageField(wrapper, currentCV.meta, field.key, 'meta');
            } else {
                const input = field.multiline ? document.createElement('textarea') : document.createElement('input');
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

        addUiFieldset('Textos de Identidade', [
            { key: 'marketing_label', label: 'Etiqueta de marketing' }
        ]);
    }

    if (currentSection === 'development') {
        addUiFieldset('Textos de Engenharia', [
            { key: 'explore_skill_label', label: 'Texto “Explorar” dos cartões' },
            { key: 'drawer_skill_context_label', label: 'Título do bloco “Contexto”' },
            { key: 'drawer_skill_competencies_label', label: 'Título do bloco “Competências”' },
            { key: 'drawer_skill_default_history', label: 'Texto padrão de histórico', multiline: true },
            { key: 'technologies_label', label: 'Etiqueta de tecnologias' },
            { key: 'skill_tags', label: 'Tags de competências', type: 'array' }
        ]);
    }

    if (currentSection === 'foundation') {
        addUiFieldset('Textos de Fundação', [
            { key: 'explore_experience_label', label: 'Texto “Explorar” dos cartões' },
            { key: 'exp_trace_label', label: 'Etiqueta de trace' },
            { key: 'exp_trace_status', label: 'Estado do trace' },
            { key: 'exp_trace_mode_label', label: 'Etiqueta de modo' }
        ]);
    }

    if (currentSection === 'mindset') {
        addUiFieldset('Textos de Mentalidade', [
            { key: 'explore_mindset_label', label: 'Texto “Explorar” dos cartões' },
            { key: 'drawer_mindset_label', label: 'Título do drawer' },
            { key: 'drawer_mindset_story_label', label: 'Etiqueta da experiência pessoal' },
            { key: 'mindset_trace_label', label: 'Etiqueta do bloco final' },
            { key: 'mindset_trace_text', label: 'Texto do bloco final', multiline: true }
        ]);
    }

    if (currentSection === 'contact') {
        addUiFieldset('Chamada para ação', [
            { key: 'cta_contact_label', label: 'Texto do botão CTA' }
        ]);
    }

    const storyConfig = getStoryConfig(currentSection);
    if (storyConfig) {
        appendSectionImageFields(currentSection);
        renderStoryEditor(storyConfig, { append: true });
        return;
    }

    const content = currentCV.localized?.[currentLang]?.[currentSection];
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

    const handledImageKeys = appendSectionImageFields(currentSection);

    Object.entries(content).forEach(([key, value]) => {
        if (currentSection === 'contact' && key === 'download_groups') return;
        if (handledImageKeys.has(key)) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = key;
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
}

function getStoryConfig(sectionKey) {
    const content = currentCV?.localized?.[currentLang]?.[sectionKey];
    if (!content) return null;
    if (sectionKey === 'development') {
        return { label: 'Sub-histórias', items: content.skills || [], type: 'skills', sourceRef: content.skills || [] };
    }
    if (sectionKey === 'foundation') {
        return { label: 'Sub-histórias', items: content.experience || [], type: 'experience', sourceRef: content.experience || [] };
    }
    if (sectionKey === 'mindset') {
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

    Object.entries(targetItem).forEach(([key, value]) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = key;
        wrapper.appendChild(label);

        if (Array.isArray(value)) {
            makeArrayField(wrapper, targetItem, key, [...value]);
        } else if (typeof value === 'string') {
            if (key === 'image' || key.endsWith('_image') || key.endsWith('photo')) {
                makeImageField(wrapper, targetItem, key, currentSection);
                const positionKey = getImagePositionKey(key);
                if (positionKey) {
                    makePositionField(wrapper, targetItem, positionKey, 'Recorte (object-position)');
                }
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

        uiNodes.editorForm.appendChild(wrapper);
    });

    uiNodes.editorForm.appendChild(removeBtn);
}

function renderPreview() {
    if (!currentCV || !uiNodes.previewPane) return;
    syncPreviewStorage();
    if (currentSection === 'downloads') {
        const downloads = getDownloadsList(currentCV.profile || {}, currentCV.localized?.[currentLang]);
        const contact = currentCV.localized?.[currentLang]?.contact;
        const groups = getDownloadGroups(contact, downloads);
        const groupLabelMap = new Map(groups.map((group) => [group.id, group.label]));
        uiNodes.previewPane.innerHTML = `
            <div class="preview-title">Downloads</div>
            ${downloads.map((item) => `
                <div class="preview-block"><strong>${groupLabelMap.get(item.group || 'downloads') || (item.group || 'downloads')}:</strong> ${item.label || '(sem nome)'} — ${item.href || ''}</div>
            `).join('')}
        `;
        return;
    }

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
    const title = content.title || content.name || SECTION_LABELS[currentSection]?.[currentLang] || currentSection;

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
            const activeHrefs = new Set(downloads.map((item) => item?.href).filter(Boolean));
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
