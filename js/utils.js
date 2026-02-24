import { state } from './state.js';
import { COOKIE_CONSENT_KEY } from './config.js';

/**
 * Logs messages to the console if debugging is enabled.
 * This function is currently a no-op in production.
 * @param {...any} args - The arguments to log.
 */
export function debugLog() {
    // Debug logging removed
}

/**
 * Escapes HTML characters in a string to prevent XSS attacks.
 * Uses the ChatUiEngine if available, otherwise falls back to a DOM-based approach.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
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

/**
 * Returns a promise that resolves after a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
export function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats a date string into a localized date string (es-EC).
 * @param {string} dateStr - The date string to format.
 * @returns {string} The formatted date string, or the original string if invalid.
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Checks if the user is on a constrained network connection (e.g., 2G or Data Saver mode).
 * @returns {boolean} True if the connection is constrained, false otherwise.
 */
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

/**
 * Resolves the deployment asset version from the current script tag or the main script tag.
 * @returns {string} The asset version string, or an empty string if not found.
 */
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

/**
 * Appends the deployment asset version to a URL as a query parameter.
 * @param {string} url - The URL to modify.
 * @returns {string} The URL with the asset version appended.
 */
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

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'warning'|'info'} [type='info'] - The type of notification.
 * @param {string} [title=''] - The title of the notification.
 */
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

/**
 * Retrieves a JSON value from localStorage.
 * @param {string} key - The key to retrieve.
 * @param {any} fallback - The fallback value if the key does not exist or is invalid JSON.
 * @returns {any} The parsed JSON value or the fallback.
 */
export function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (_error) {
        return fallback;
    }
}

/**
 * Stores a JSON value in localStorage.
 * @param {string} key - The key to store.
 * @param {any} value - The value to store.
 */
export function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // Ignore storage quota errors.
    }
}

/**
 * Generates initials from a name string.
 * @param {string} name - The name to generate initials from.
 * @returns {string} The initials (up to 2 characters).
 */
export function getInitials(name) {
    const parts = String(name || 'Paciente')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'PA';
    return parts.map((part) => part[0].toUpperCase()).join('');
}

/**
 * Returns a relative date label (e.g., "Today", "2 days ago").
 * @param {string} dateText - The date string to process.
 * @returns {string} The relative date label localized based on current language.
 */
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

/**
 * Generates HTML for a star rating.
 * @param {number|string} rating - The rating value (1-5).
 * @returns {string} The HTML string for the star rating.
 */
export function renderStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
        html += `<i class="${i <= value ? 'fas' : 'far'} fa-star"></i>`;
    }
    return html;
}

/**
 * Retrieves the current cookie consent status.
 * @returns {string} The consent status ('accepted', 'rejected', or empty string).
 */
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

/**
 * Sets the cookie consent status in localStorage.
 * @param {'accepted'|'rejected'} status - The consent status to set.
 */
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
