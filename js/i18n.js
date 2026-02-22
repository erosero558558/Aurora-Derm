import { withDeployAssetVersion, showToast, debugLog } from '../src/apps/shared/utils.js';
import { loadDeferredModule, withDeferredModule } from './loader.js';
import { state } from './state.js';
import { renderPublicReviews } from './engagement.js';

const DATA_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260221-api-fix'
);

function getI18nEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        setCurrentLang: (lang) => {
            state.currentLang = (lang === 'en' ? 'en' : 'es');
        },
        showToast,
        getReviewsCache: () => state.reviewsCache,
        renderPublicReviews,
        debugLog,
    };
}

export function loadI18nEngine() {
    return loadDeferredModule({
        cacheKey: 'i18n-engine',
        src: DATA_BUNDLE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getI18nEngineDeps()),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine.js',
        logLabel: 'I18n engine',
    });
}

export function initEnglishBundleWarmup() {
    const warmup = () => {
        withDeferredModule(loadI18nEngine, (engine) =>
            engine.ensureEnglishTranslations()
        ).catch(() => undefined);
    };

    const enBtn = document.querySelector('.lang-btn[data-lang="en"]');
    if (enBtn) {
        enBtn.addEventListener('mouseenter', warmup, {
            once: true,
            passive: true,
        });
        enBtn.addEventListener('touchstart', warmup, {
            once: true,
            passive: true,
        });
        enBtn.addEventListener('focus', warmup, { once: true });
    }
}

export async function changeLanguage(lang) {
    return withDeferredModule(loadI18nEngine, (engine) =>
        engine.changeLanguage(lang)
    );
}
