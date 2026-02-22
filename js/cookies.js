import { withDeployAssetVersion, showToast } from '../src/apps/shared/utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { state } from './state.js';
import { trackEvent } from './analytics.js';
import { COOKIE_CONSENT_KEY } from './config.js';

const UI_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/ui-bundle.js?v=20260220-consolidated1'
);

function getConsentEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        showToast,
        trackEvent,
        cookieConsentKey: COOKIE_CONSENT_KEY,
        gaMeasurementId: 'G-GYY8PE5M8W',
    };
}

export function loadConsentEngine() {
    return loadDeferredModule({
        cacheKey: 'consent-engine',
        src: UI_BUNDLE_URL,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ConsentEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getConsentEngineDeps()),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine',
    });
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
    } catch {
        return '';
    }
}

export function setCookieConsent(status) {
    return runDeferredModule(
        loadConsentEngine,
        (engine) => engine.setCookieConsent(status),
        () => {
            const normalized = status === 'accepted' ? 'accepted' : 'rejected';
            try {
                localStorage.setItem(
                    COOKIE_CONSENT_KEY,
                    JSON.stringify({
                        status: normalized,
                        at: new Date().toISOString(),
                    })
                );
            } catch {
                // noop
            }
        }
    );
}

export function initGA4() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initGA4());
}

export function bootstrapConsent() {
    loadConsentEngine(); // Loads bundle and binds delegated listeners via init()
}

export function showConsentBanner() {
    runDeferredModule(loadConsentEngine, (engine) => engine.initCookieBanner()); // Only shows banner
}

export function initCookieBanner() {
    // Deprecated alias kept for compatibility if needed, but main.js should use bootstrap/show
    bootstrapConsent();
    showConsentBanner();
}
