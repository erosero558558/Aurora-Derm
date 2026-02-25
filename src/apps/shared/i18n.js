'use strict';
// build-sync: 20260219-sync1

let deps = null;
const I18N_HTML_ALLOWED_KEYS = new Set(['clinic_hours']);

const translations = {
    es: null,
    en: null
};

let enTranslationsPromise = null;

function init(inputDeps) {
    deps = inputDeps || {};

    if (window.PIEL_CONTENT && typeof window.PIEL_CONTENT === 'object') {
        translations.es = window.PIEL_CONTENT;
    }

    return window.PielI18nEngine;
}

function debugLogSafe() {
    if (deps && typeof deps.debugLog === 'function') {
        deps.debugLog.apply(null, arguments);
    }
}

function setCurrentLang(lang) {
    if (deps && typeof deps.setCurrentLang === 'function') {
        deps.setCurrentLang(lang);
    }
}

function showToastSafe(message, type) {
    if (deps && typeof deps.showToast === 'function') {
        deps.showToast(message, type || 'info');
    }
}

function getReviewsCacheSafe() {
    if (deps && typeof deps.getReviewsCache === 'function') {
        return deps.getReviewsCache();
    }
    return [];
}

function renderPublicReviewsSafe(reviews) {
    if (deps && typeof deps.renderPublicReviews === 'function') {
        deps.renderPublicReviews(reviews);
    }
}

function ensureEnglishTranslations() {
    if (translations.en && typeof translations.en === 'object') {
        return Promise.resolve(translations.en);
    }

    if (enTranslationsPromise) {
        return enTranslationsPromise;
    }

    enTranslationsPromise = fetch('/api.php?resource=content&lang=en')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load EN content');
            return response.json();
        })
        .then(data => {
            translations.en = data;
            return translations.en;
        })
        .catch((error) => {
            enTranslationsPromise = null;
            debugLogSafe('English translations load failed:', error);
            throw error;
        });

    return enTranslationsPromise;
}

async function changeLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'es';
    setCurrentLang(nextLang);

    localStorage.setItem('language', nextLang);
    document.documentElement.lang = nextLang;

    if (!translations.es || typeof translations.es !== 'object') {
        // Fallback: try to load ES from API if not injected
        try {
            const res = await fetch('/api.php?resource=content&lang=es');
            if (res.ok) {
                translations.es = await res.json();
            }
        } catch (e) {
            debugLogSafe('Failed to load ES content fallback', e);
        }
    }

    if (nextLang === 'en' && !translations.en) {
        try {
            await ensureEnglishTranslations();
        } catch (_e) {
            showToastSafe('No se pudo cargar el paquete de idioma EN. Se mantiene Espanol.', 'warning');
        }
    }

    const langPack = translations[nextLang] || translations.es || {};

    document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === nextLang);
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = String(el.dataset.i18n || '').trim();
        if (!Object.prototype.hasOwnProperty.call(langPack, key)) {
            return;
        }
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = langPack[key];
            return;
        }
        if (I18N_HTML_ALLOWED_KEYS.has(key)) {
            el.innerHTML = langPack[key];
            return;
        }
        el.textContent = langPack[key];
    });

    const cachedReviews = getReviewsCacheSafe();
    if (Array.isArray(cachedReviews) && cachedReviews.length > 0) {
        renderPublicReviewsSafe(cachedReviews);
    }

    document.dispatchEvent(new CustomEvent('piel:language-changed', {
        detail: { lang: nextLang }
    }));

    return nextLang;
}

window.PielI18nEngine = {
    init,
    ensureEnglishTranslations,
    changeLanguage
};
