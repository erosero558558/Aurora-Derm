import {
    withDeployAssetVersion,
    showToast,
    escapeHtml,
    storageGetJSON,
} from '../src/apps/shared/utils.js';
import {
    loadDeferredModule,
    runDeferredModule,
    withDeferredModule,
    createWarmupRunner,
    bindWarmupTarget,
    scheduleDeferredTask,
    observeOnceWhenVisible,
} from './loader.js';
import { getCurrentLang, getReviewsCache, setReviewsCache } from './state.js';
import {
    apiRequest,
    createCallbackRecord,
    createReviewRecord,
} from './data.js';

const ENGAGEMENT_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/engagement-bundle.js?v=20260220-consolidated1'
);

// REVIEWS ENGINE
function getReviewsEngineDeps() {
    return {
        apiRequest,
        storageGetJSON,
        escapeHtml,
        getCurrentLang: getCurrentLang,
    };
}

export function loadReviewsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-bundle',
        src: ENGAGEMENT_BUNDLE_URL,
        scriptDataAttribute: 'data-engagement-bundle',
        resolveModule: () => window.Piel && window.Piel.ReviewsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getReviewsEngineDeps()),
        missingApiError: 'reviews-engine loaded without API',
        loadError: 'No se pudo cargar reviews-engine.js',
        logLabel: 'Reviews engine',
    });
}

export function initReviewsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadReviewsEngine(), {
        markWarmOnSuccess: true,
    });
    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '300px 0px',
        onNoObserver: warmup,
    });
    bindWarmupTarget('#resenas', 'mouseenter', warmup);
    bindWarmupTarget('#resenas', 'touchstart', warmup);
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'focus',
        warmup,
        false
    );
    scheduleDeferredTask(warmup, { idleTimeout: 2200, fallbackDelay: 1300 });
}

export function renderPublicReviews(reviews) {
    runDeferredModule(loadReviewsEngine, (engine) =>
        engine.renderPublicReviews(reviews)
    );
}

export function loadPublicReviews(options = {}) {
    return withDeferredModule(loadReviewsEngine, (engine) =>
        engine.loadPublicReviews(options)
    );
}

// ENGAGEMENT FORMS ENGINE
function getEngagementFormsEngineDeps() {
    return {
        createCallbackRecord,
        createReviewRecord,
        renderPublicReviews,
        showToast,
        getCurrentLang: getCurrentLang,
        getReviewsCache,
        setReviewsCache,
    };
}

export function loadEngagementFormsEngine() {
    return loadReviewsEngine().then(() =>
        loadDeferredModule({
            cacheKey: 'engagement-forms-engine',
            src: ENGAGEMENT_BUNDLE_URL,
            scriptDataAttribute: 'data-engagement-bundle',
            resolveModule: () => window.Piel && window.Piel.EngagementFormsEngine,
            isModuleReady: (module) =>
                !!(module && typeof module.init === 'function'),
            onModuleReady: (module) =>
                module.init(getEngagementFormsEngineDeps()),
            missingApiError: 'engagement-forms-engine loaded without API',
            loadError: 'No se pudo cargar engagement-forms-engine.js',
            logLabel: 'Engagement forms engine',
        })
    );
}

export function initEngagementFormsEngineWarmup() {
    const warmup = createWarmupRunner(() => loadEngagementFormsEngine());
    bindWarmupTarget('#callbackForm', 'focusin', warmup, false);
    bindWarmupTarget('#callbackForm', 'pointerdown', warmup);
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'mouseenter',
        warmup
    );
    bindWarmupTarget(
        '#resenas [data-action="open-review-modal"]',
        'touchstart',
        warmup
    );
    if (document.getElementById('callbackForm')) {
        setTimeout(warmup, 120);
    }
    const reviewSection = document.getElementById('resenas');
    observeOnceWhenVisible(reviewSection, warmup, {
        threshold: 0.05,
        rootMargin: '280px 0px',
        onNoObserver: warmup,
    });
    scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1500 });
}

export function openReviewModal() {
    runDeferredModule(
        loadEngagementFormsEngine,
        (engine) => engine.openReviewModal(),
        () => {
            const modal = document.getElementById('reviewModal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }
    );
}

export function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    runDeferredModule(loadEngagementFormsEngine, (engine) =>
        engine.closeReviewModal()
    );
}
