function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (isDomElement(target)) {
        return target;
    }

    if (typeof target !== 'string') {
        return null;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById(target) ||
        document.querySelector(target) ||
        null
    );
}

function normalizePathToken(value) {
    const raw = toString(value);
    if (!raw) {
        return '';
    }

    try {
        const url = new URL(raw, 'https://turnero.local');
        const pathname = String(url.pathname || '').toLowerCase();
        return pathname
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/\.html?$/i, '')
            .replace(/\.(json|js|mjs)$/i, '');
    } catch (_error) {
        return raw
            .toLowerCase()
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/\?.*$/, '')
            .replace(/#.*$/, '')
            .replace(/\.html?$/i, '')
            .replace(/\.(json|js|mjs)$/i, '');
    }
}

function formatTimestamp(value) {
    const raw = toString(value);
    if (!raw) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat('es-EC', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(raw));
    } catch (_error) {
        return raw;
    }
}

async function copyTextToClipboard(text) {
    const value = toString(text);
    if (!value) {
        return false;
    }

    if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
    ) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (_error) {
            return false;
        }
    }

    return false;
}

async function copyToClipboardSafe(text) {
    return copyTextToClipboard(text);
}

function downloadJsonSnapshot(filename, payload) {
    if (
        typeof document === 'undefined' ||
        typeof Blob === 'undefined' ||
        typeof URL === 'undefined' ||
        typeof URL.createObjectURL !== 'function'
    ) {
        return false;
    }

    const safeName = toString(filename, 'turnero-surface-snapshot.json');
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = safeName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';

    document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (typeof setTimeout === 'function') {
        setTimeout(() => URL.revokeObjectURL(href), 0);
    } else {
        URL.revokeObjectURL(href);
    }

    return true;
}

export {
    asObject,
    copyToClipboardSafe,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    isDomElement,
    normalizePathToken,
    resolveTarget,
    toArray,
    toString,
};
