import { withDeployAssetVersion, debugLog } from '../src/apps/shared/utils.js';
import {
    loadDeferredModule,
    runDeferredModule,
    withDeferredModule,
} from './loader.js';
import { observeOnceWhenVisible } from './loader.js';
import { loadAvailabilityData } from './data.js';
import { loadPublicReviews } from './engagement.js';

const ANALYTICS_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
);
const FUNNEL_EVENT_ENDPOINT = '/api.php?resource=funnel-event';
const FUNNEL_SERVER_EVENTS = new Set([
    'view_booking',
    'start_checkout',
    'payment_method_selected',
    'payment_success',
    'booking_confirmed',
    'checkout_abandon',
    'booking_step_completed',
    'booking_error',
    'checkout_error',
    'chat_started',
    'chat_handoff_whatsapp',
    'whatsapp_click',
]);
const FUNNEL_SERVER_ALLOWED_PARAMS = new Set([
    'source',
    'step',
    'payment_method',
    'checkout_entry',
    'checkout_step',
    'reason',
    'error_code',
]);
const FUNNEL_EVENT_DEDUP_MS = 1200;
const funnelEventLastSentAt = new Map();

function normalizeFunnelLabelClient(value, fallback = 'unknown') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return normalized || fallback;
}

function buildFunnelServerParams(params = {}) {
    const sourceRaw =
        params && typeof params === 'object' ? params.source : undefined;
    const normalized = {
        source: normalizeFunnelLabelClient(sourceRaw, 'unknown'),
    };

    if (!params || typeof params !== 'object') {
        return normalized;
    }

    FUNNEL_SERVER_ALLOWED_PARAMS.forEach((key) => {
        if (key === 'source') {
            return;
        }
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            normalized[key] = normalizeFunnelLabelClient(
                params[key],
                'unknown'
            );
        }
    });

    return normalized;
}

function sendFunnelEventToServer(eventName, params = {}) {
    const normalizedEvent = normalizeFunnelLabelClient(eventName, '');
    if (!FUNNEL_SERVER_EVENTS.has(normalizedEvent)) {
        return;
    }
    if (window.location.protocol === 'file:') {
        return;
    }

    const serverParams = buildFunnelServerParams(params);
    const dedupKey = [
        normalizedEvent,
        serverParams.step || '',
        serverParams.payment_method || '',
        serverParams.checkout_step || serverParams.step || '',
        serverParams.reason || '',
        serverParams.source || '',
    ].join('|');

    const now = Date.now();
    const previousAt = funnelEventLastSentAt.get(dedupKey) || 0;
    if (now - previousAt < FUNNEL_EVENT_DEDUP_MS) {
        return;
    }
    funnelEventLastSentAt.set(dedupKey, now);

    const payload = JSON.stringify({
        event: normalizedEvent,
        params: serverParams,
    });

    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const sent = navigator.sendBeacon(FUNNEL_EVENT_ENDPOINT, blob);
            if (sent) {
                return;
            }
        }
    } catch (_error) {}

    fetch(FUNNEL_EVENT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
    }).catch(() => undefined);
}

function getAnalyticsEngineDeps() {
    return {
        observeOnceWhenVisible,
        loadAvailabilityData,
        loadPublicReviews,
        trackEventToServer: sendFunnelEventToServer,
    };
}

export function loadAnalyticsEngine() {
    return loadDeferredModule({
        cacheKey: 'analytics-engine',
        src: ANALYTICS_ENGINE_URL,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getAnalyticsEngineDeps()),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}

export function trackEvent(eventName, params = {}) {
    sendFunnelEventToServer(eventName, params);
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.trackEvent(eventName, params)
    );
}

export function normalizeAnalyticsLabel(value, fallback = 'unknown') {
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
    return normalized || fallback;
}

export function markBookingViewed(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.markBookingViewed(source)
    );
}

export function prefetchAvailabilityData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.prefetchAvailabilityData(source)
    );
}

export function prefetchReviewsData(source = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.prefetchReviewsData(source)
    );
}

export function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initBookingFunnelObserver()
    );
}

export function initDeferredSectionPrefetch() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initDeferredSectionPrefetch()
    );
}

export function startCheckoutSession(appointment, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.startCheckoutSession(appointment, metadata)
    );
}

export function setCheckoutStep(step, metadata = {}) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.setCheckoutStep(step, metadata)
    );
}

export function setCheckoutSessionActive(active) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.setCheckoutSessionActive(active)
    );
}

export function completeCheckoutSession(method) {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.completeCheckoutSession(method)
    );
}

export function maybeTrackCheckoutAbandon(reason = 'unknown') {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.maybeTrackCheckoutAbandon(reason)
    );
}
