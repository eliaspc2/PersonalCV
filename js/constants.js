export const CV_PATH = 'data/cv.json';
export const CONFIG_PATH = 'data/config.json';

export const LANGS = ['pt', 'es', 'en'];

export const BASE_SECTIONS = [
    'overview',
    'development',
    'foundation',
    'highlights',
    'mindset',
    'now',
    'contact'
];

export const DEFAULT_PATHS = {
    photos: 'assets/photos/',
    downloads: 'assets/downloads/',
    icons: 'assets/icons/'
};

export const DEFAULT_THEME = {
    bg_app: '#fcfcfd',
    bg_sidebar: '#ffffff',
    primary: '#020617',
    accent: '#3b82f6',
    accent_soft: 'rgba(59, 130, 246, 0.08)',
    text_main: '#0f172a',
    text_muted: '#64748b',
    text_dim: '#94a3b8',
    border: '#f1f5f9'
};

export const THEME_PRESETS = [
    {
        name: 'Azul clássico',
        theme: {
            bg_app: '#fcfcfd',
            bg_sidebar: '#ffffff',
            primary: '#020617',
            accent: '#3b82f6',
            text_main: '#0f172a',
            text_muted: '#64748b',
            text_dim: '#94a3b8',
            border: '#f1f5f9'
        }
    },
    {
        name: 'Verde atlântico',
        theme: {
            bg_app: '#f7faf9',
            bg_sidebar: '#ffffff',
            primary: '#064e3b',
            accent: '#10b981',
            text_main: '#0f172a',
            text_muted: '#475569',
            text_dim: '#94a3b8',
            border: '#e2e8f0'
        }
    },
    {
        name: 'Âmbar quente',
        theme: {
            bg_app: '#fffbf5',
            bg_sidebar: '#ffffff',
            primary: '#7c2d12',
            accent: '#f59e0b',
            text_main: '#1f2937',
            text_muted: '#6b7280',
            text_dim: '#9ca3af',
            border: '#f5e7d0'
        }
    },
    {
        name: 'Índigo moderno',
        theme: {
            bg_app: '#f8f9ff',
            bg_sidebar: '#ffffff',
            primary: '#1e1b4b',
            accent: '#6366f1',
            text_main: '#111827',
            text_muted: '#4b5563',
            text_dim: '#9ca3af',
            border: '#e5e7eb'
        }
    }
];

export const NAV_TYPE_ICON_IDS = {
    overview: 'home',
    development: 'code',
    foundation: 'layers',
    highlights: 'star',
    mindset: 'book',
    now: 'compass',
    contact: 'mail'
};
