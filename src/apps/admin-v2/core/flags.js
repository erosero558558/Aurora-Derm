import {
    getQueryParam,
    getStorageItem,
    setStorageItem,
} from './persistence.js';

const VARIANT_STORAGE_KEY = 'adminUiVariant';
const THEME_STORAGE_KEY = 'themeMode';
const THEMES = new Set(['light', 'dark', 'system']);

export function readRuntimeVariant() {
    const queryVariant = String(getQueryParam('admin_ui') || '')
        .trim()
        .toLowerCase();
    if (queryVariant === 'legacy' || queryVariant === 'sony_v2') {
        setStorageItem(VARIANT_STORAGE_KEY, queryVariant);
        return queryVariant;
    }

    const stored = String(getStorageItem(VARIANT_STORAGE_KEY, 'sony_v2') || '')
        .trim()
        .toLowerCase();
    return stored === 'legacy' ? 'legacy' : 'sony_v2';
}

export function readThemeMode() {
    const stored = String(
        getStorageItem(THEME_STORAGE_KEY, 'system') || 'system'
    )
        .trim()
        .toLowerCase();
    return THEMES.has(stored) ? stored : 'system';
}

export function persistThemeMode(mode) {
    const value = THEMES.has(mode) ? mode : 'system';
    setStorageItem(THEME_STORAGE_KEY, value);
}

export function resolveTheme(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function applyTheme(mode) {
    const resolved = resolveTheme(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme', resolved);
    return resolved;
}
