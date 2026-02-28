const ADMIN_THEME_STORAGE_KEY = 'queueThemeAdmin';
const ADMIN_THEME_STORAGE_LEGACY_KEY = 'themeMode';
const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);

let currentThemeMode = 'system';
let systemThemeQuery = null;
let systemThemeListenerBound = false;
let storageThemeListenerBound = false;
let transitionTimer = null;

function getSystemThemeQuery() {
    if (!systemThemeQuery && typeof window.matchMedia === 'function') {
        systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }
    return systemThemeQuery;
}

function isValidThemeMode(mode) {
    return VALID_THEME_MODES.has(String(mode || '').trim());
}

function resolveTheme(mode) {
    if (mode !== 'system') {
        return mode;
    }
    return getSystemThemeQuery()?.matches ? 'dark' : 'light';
}

function readStoredThemeMode() {
    try {
        const stored =
            localStorage.getItem(ADMIN_THEME_STORAGE_KEY) ||
            localStorage.getItem(ADMIN_THEME_STORAGE_LEGACY_KEY) ||
            'system';
        return isValidThemeMode(stored) ? stored : 'system';
    } catch (_error) {
        return 'system';
    }
}

function persistThemeMode(mode) {
    try {
        localStorage.setItem(ADMIN_THEME_STORAGE_KEY, mode);
        localStorage.setItem(ADMIN_THEME_STORAGE_LEGACY_KEY, mode);
    } catch (_error) {
        // no-op
    }
}

function applyThemeAttributes(mode) {
    const root = document.documentElement;
    if (!root) return;

    const resolvedTheme = resolveTheme(mode);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-theme', resolvedTheme);
}

function updateThemeButtons() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((btn) => {
            const isActive = btn.dataset.themeMode === currentThemeMode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
}

function animateThemeTransition() {
    if (!document.body) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
        return;

    if (transitionTimer) {
        clearTimeout(transitionTimer);
    }

    document.body.classList.remove('theme-transition');
    void document.body.offsetWidth;
    document.body.classList.add('theme-transition');

    transitionTimer = setTimeout(() => {
        document.body?.classList.remove('theme-transition');
    }, 220);
}

function applyThemeMode(mode, { persist = false, animate = false } = {}) {
    const nextMode = isValidThemeMode(mode) ? mode : 'system';
    currentThemeMode = nextMode;

    if (persist) {
        persistThemeMode(nextMode);
    }

    if (animate) {
        animateThemeTransition();
    }

    applyThemeAttributes(nextMode);
    updateThemeButtons();
}

function handleSystemThemeChange() {
    if (currentThemeMode !== 'system') {
        return;
    }
    applyThemeAttributes('system');
    updateThemeButtons();
}

function bindSystemThemeListener() {
    if (systemThemeListenerBound) return;
    const query = getSystemThemeQuery();
    if (!query) return;

    if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handleSystemThemeChange);
        systemThemeListenerBound = true;
        return;
    }

    if (typeof query.addListener === 'function') {
        query.addListener(handleSystemThemeChange);
        systemThemeListenerBound = true;
    }
}

function handleThemeStorageSync(event) {
    if (event?.key && event.key !== ADMIN_THEME_STORAGE_KEY) {
        return;
    }

    const nextMode =
        typeof event?.newValue === 'string' && isValidThemeMode(event.newValue)
            ? event.newValue
            : readStoredThemeMode();

    applyThemeMode(nextMode, { persist: false, animate: false });
}

function bindStorageThemeListener() {
    if (
        storageThemeListenerBound ||
        typeof window.addEventListener !== 'function'
    ) {
        return;
    }
    window.addEventListener('storage', handleThemeStorageSync);
    storageThemeListenerBound = true;
}

export function initAdminThemeMode() {
    currentThemeMode = readStoredThemeMode();
    applyThemeMode(currentThemeMode, { persist: false, animate: false });
    bindSystemThemeListener();
    bindStorageThemeListener();
}

export function setAdminThemeMode(mode) {
    applyThemeMode(mode, { persist: true, animate: true });
}

export function getAdminThemeMode() {
    return currentThemeMode;
}
