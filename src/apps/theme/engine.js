'use strict';

let deps = null;
let themeTransitionTimer = null;
let systemThemeListenerBound = false;
let themeStorageListenerBound = false;

function init(inputDeps) {
    deps = inputDeps || {};
    bindSystemThemeListener();
    bindStorageThemeListener();
    return window.PielThemeEngine;
}

function getCurrentThemeMode() {
    if (deps && typeof deps.getCurrentThemeMode === 'function') {
        return deps.getCurrentThemeMode() || 'system';
    }
    return 'system';
}

function setCurrentThemeMode(mode) {
    if (deps && typeof deps.setCurrentThemeMode === 'function') {
        deps.setCurrentThemeMode(mode);
    }
}

function getThemeStorageKey() {
    if (
        deps &&
        typeof deps.themeStorageKey === 'string' &&
        deps.themeStorageKey
    ) {
        return deps.themeStorageKey;
    }
    return 'themeMode';
}

function getSystemThemeQuery() {
    if (deps && typeof deps.getSystemThemeQuery === 'function') {
        return deps.getSystemThemeQuery();
    }
    return window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
}

function isValidThemeMode(mode) {
    const normalized = String(mode || '').trim();
    const validModes = deps ? deps.validThemeModes : null;
    if (Array.isArray(validModes)) {
        return validModes.includes(normalized);
    }
    return (
        normalized === 'light' ||
        normalized === 'dark' ||
        normalized === 'system'
    );
}

function resolveThemeMode(mode) {
    const currentMode = mode || getCurrentThemeMode();
    if (currentMode === 'system') {
        const systemThemeQuery = getSystemThemeQuery();
        if (systemThemeQuery && systemThemeQuery.matches) {
            return 'dark';
        }
        return 'light';
    }
    return currentMode;
}

function applyThemeMode(mode) {
    const currentMode = mode || getCurrentThemeMode();
    const resolvedTheme = resolveThemeMode(currentMode);
    document.documentElement.setAttribute('data-theme-mode', currentMode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
}

function updateThemeButtons() {
    const currentMode = getCurrentThemeMode();
    document.querySelectorAll('.theme-btn').forEach((btn) => {
        const isActive = btn.dataset.themeMode === currentMode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function animateThemeTransition() {
    if (!document.body) {
        return;
    }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        return;
    }

    if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
    }

    document.body.classList.remove('theme-transition');
    void document.body.offsetWidth;
    document.body.classList.add('theme-transition');

    themeTransitionTimer = setTimeout(() => {
        document.body.classList.remove('theme-transition');
    }, 320);
}

function readStoredThemeMode() {
    try {
        return localStorage.getItem(getThemeStorageKey()) || 'system';
    } catch (_error) {
        return 'system';
    }
}

function persistThemeMode(mode) {
    try {
        localStorage.setItem(getThemeStorageKey(), mode);
    } catch (_error) {
        // no-op
    }
}

function setThemeMode(mode) {
    if (!isValidThemeMode(mode)) {
        return;
    }

    setCurrentThemeMode(mode);
    persistThemeMode(mode);
    animateThemeTransition();
    applyThemeMode(mode);
    updateThemeButtons();
}

function initThemeMode() {
    const storedTheme = readStoredThemeMode();
    const nextMode = isValidThemeMode(storedTheme) ? storedTheme : 'system';
    setCurrentThemeMode(nextMode);
    applyThemeMode(nextMode);
    updateThemeButtons();
}

function handleSystemThemeChange() {
    if (getCurrentThemeMode() === 'system') {
        applyThemeMode('system');
        updateThemeButtons();
    }
}

function bindSystemThemeListener() {
    if (systemThemeListenerBound) {
        return;
    }

    const systemThemeQuery = getSystemThemeQuery();
    if (!systemThemeQuery) {
        return;
    }

    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
        systemThemeListenerBound = true;
        return;
    }

    if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(handleSystemThemeChange);
        systemThemeListenerBound = true;
    }
}

function handleThemeStorageSync(event) {
    const storageKey = getThemeStorageKey();
    if (event?.key && event.key !== storageKey) {
        return;
    }

    const rawMode =
        typeof event?.newValue === 'string'
            ? event.newValue
            : readStoredThemeMode();
    const nextMode = isValidThemeMode(rawMode) ? rawMode : 'system';
    setCurrentThemeMode(nextMode);
    applyThemeMode(nextMode);
    updateThemeButtons();
}

function bindStorageThemeListener() {
    if (
        themeStorageListenerBound ||
        typeof window.addEventListener !== 'function'
    ) {
        return;
    }

    window.addEventListener('storage', handleThemeStorageSync);
    themeStorageListenerBound = true;
}

window.PielThemeEngine = {
    init,
    setThemeMode,
    initThemeMode,
    applyThemeMode,
};

window.Piel = window.Piel || {};
window.Piel.ThemeEngine = window.PielThemeEngine;
