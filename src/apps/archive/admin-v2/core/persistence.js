export function getStorageItem(key, fallback = '') {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (_error) {
        return fallback;
    }
}

export function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch (_error) {
        // no-op
    }
}

export function removeStorageItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (_error) {
        // no-op
    }
}

export function getStorageJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (_error) {
        return fallback;
    }
}

export function setStorageJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // no-op
    }
}

export function getQueryParam(name) {
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get(name) || '';
    } catch (_error) {
        return '';
    }
}

export function setHash(hashValue) {
    const safeHash = String(hashValue || '').replace(/^#/, '');
    const next = safeHash ? `#${safeHash}` : '';
    if (window.location.hash !== next) {
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}${next}`
        );
    }
}
