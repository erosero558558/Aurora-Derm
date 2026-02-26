/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */
import { r as runDeferredModule, c as createWarmupRunner, b as bindWarmupTarget, G as observeOnceWhenVisible, a as scheduleDeferredTask, l as loadDeferredModule, w as withDeferredModule, e as withDeployAssetVersion, H as setReviewsCache, I as getReviewsCache, u as getCurrentLang, s as showToast, J as createReviewRecord, K as createCallbackRecord, L as escapeHtml, M as storageGetJSON, N as apiRequest } from '../../script.js';

const ENGAGEMENT_REVIEWS_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/engagement-bundle.js'
);
const ENGAGEMENT_FORMS_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/engagement-forms-bundle.js'
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

function loadReviewsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-reviews-bundle',
        src: ENGAGEMENT_REVIEWS_BUNDLE_URL,
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

function initReviewsEngineWarmup() {
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

function renderPublicReviews(reviews) {
    runDeferredModule(loadReviewsEngine, (engine) =>
        engine.renderPublicReviews(reviews)
    );
}

function loadPublicReviews(options = {}) {
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

function loadEngagementFormsEngine() {
    return loadDeferredModule({
        cacheKey: 'engagement-forms-engine',
        src: ENGAGEMENT_FORMS_BUNDLE_URL,
        scriptDataAttribute: 'data-engagement-forms-bundle',
        resolveModule: () => window.Piel && window.Piel.EngagementFormsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) =>
            module.init(getEngagementFormsEngineDeps()),
        missingApiError: 'engagement-forms-engine loaded without API',
        loadError: 'No se pudo cargar engagement-forms-engine.js',
        logLabel: 'Engagement forms engine',
    });
}

function initEngagementFormsEngineWarmup() {
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

function openReviewModal() {
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

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    runDeferredModule(loadEngagementFormsEngine, (engine) =>
        engine.closeReviewModal()
    );
}

export { closeReviewModal, initEngagementFormsEngineWarmup, initReviewsEngineWarmup, loadEngagementFormsEngine, loadPublicReviews, loadReviewsEngine, openReviewModal, renderPublicReviews };
