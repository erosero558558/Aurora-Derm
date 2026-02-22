import { state } from './state.js';
import { COOKIE_CONSENT_KEY } from './config.js';

export function debugLog() {
    // Debug logging removed
}

export function escapeHtml(text) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        typeof window.Piel.ChatUiEngine.escapeHtml === 'function'
    ) {
        return window.Piel.ChatUiEngine.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

export function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

export function isConstrainedNetworkConnection() {
    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
    return !!(
        connection &&
        (connection.saveData === true ||
            /(^|[^0-9])2g/.test(String(connection.effectiveType || '')))
    );
}

// ASSET VERSIONING
export function resolveDeployAssetVersion() {
    try {
        if (
            document.currentScript &&
            typeof document.currentScript.src === 'string' &&
            document.currentScript.src !== ''
        ) {
            const currentUrl = new URL(
                document.currentScript.src,
                window.location.href
            );
            const fromCurrent = currentUrl.searchParams.get('v');
            if (fromCurrent) {
                return fromCurrent;
            }
        }

        const scriptEl = document.querySelector('script[src*="script.js"]');
        if (scriptEl && typeof scriptEl.getAttribute === 'function') {
            const rawSrc = scriptEl.getAttribute('src') || '';
            if (rawSrc) {
                const parsed = new URL(rawSrc, window.location.href);
                const fromTag = parsed.searchParams.get('v');
                if (fromTag) {
                    return fromTag;
                }
            }
        }
    } catch (_error) {
        return '';
    }

    return '';
}

export function withDeployAssetVersion(url) {
    const cleanUrl = String(url || '').trim();
    if (cleanUrl === '') {
        return cleanUrl;
    }

    const deployVersion = (window.Piel && window.Piel.deployVersion) || '';
    if (!deployVersion) {
        return cleanUrl;
    }

    try {
        const resolved = new URL(cleanUrl, window.location.origin);
        resolved.searchParams.set('cv', deployVersion);
        if (cleanUrl.startsWith('/')) {
            return resolved.pathname + resolved.search;
        }
        return resolved.toString();
    } catch (_error) {
        const separator = cleanUrl.indexOf('?') >= 0 ? '&' : '?';
        return cleanUrl + separator + 'cv=' + encodeURIComponent(deployVersion);
    }
}

// TOAST NOTIFICATIONS SYSTEM
export function showToast(message, type = 'info', title = '') {
    // Create container if doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle',
    };

    const titles = {
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Informacion',
    };

    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button type="button" class="toast-close" data-action="toast-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

export function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (_error) {
        return fallback;
    }
}

export function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // Ignore storage quota errors.
    }
}

export function getInitials(name) {
    const parts = String(name || 'Paciente')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'PA';
    return parts.map((part) => part[0].toUpperCase()).join('');
}

export function getRelativeDateLabel(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
        return state.currentLang === 'es' ? 'Reciente' : 'Recent';
    }
    const now = new Date();
    const days = Math.max(0, Math.floor((now - date) / (1000 * 60 * 60 * 24)));
    if (state.currentLang === 'es') {
        if (days <= 1) return 'Hoy';
        if (days < 7) return `Hace ${days} d${days === 1 ? 'ía' : 'ías'}`;
        if (days < 30) return `Hace ${Math.floor(days / 7)} semana(s)`;
        return date.toLocaleDateString('es-EC');
    }
    if (days <= 1) return 'Today';
    if (days < 7) return `${days} day(s) ago`;
    if (days < 30) return `${Math.floor(days / 7)} week(s) ago`;
    return date.toLocaleDateString('en-US');
}

export function renderStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
        html += `<i class="${i <= value ? 'fas' : 'far'} fa-star"></i>`;
    }
    return html;
}

export function getCookieConsent() {
    if (
        window.Piel &&
        window.Piel.ConsentEngine &&
        typeof window.Piel.ConsentEngine.getCookieConsent === 'function'
    ) {
        return window.Piel.ConsentEngine.getCookieConsent();
    }
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return typeof parsed?.status === 'string' ? parsed.status : '';
    } catch (_error) {
        return '';
    }
}

export function setCookieConsent(status) {
    // This function might be overridden by consent engine usage in other modules, but basic utility here.
    const normalized = status === 'accepted' ? 'accepted' : 'rejected';
    try {
        localStorage.setItem(
            COOKIE_CONSENT_KEY,
            JSON.stringify({
                status: normalized,
                at: new Date().toISOString(),
            })
        );
    } catch (error) {
        // noop
    }
}
