import {
    withDeployAssetVersion,
    showToast,
    storageGetJSON,
    storageSetJSON,
} from './utils.js';
import { state } from './state.js';
import {
    loadDeferredModule,
    withDeferredModule,
    createWarmupRunner,
    bindWarmupTarget,
    observeOnceWhenVisible,
    scheduleDeferredTask,
} from './loader.js';
import { getCaptchaToken } from './captcha.js';

const DATA_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260225-data-consolidation1'
);

function getBookingSectionElement() {
    return (
        document.getElementById('v5-booking') ||
        document.getElementById('citas')
    );
}

function getDataEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        getCaptchaToken,
        showToast,
        storageGetJSON,
        storageSetJSON,
    };
}

export function loadDataEngine() {
    return loadDeferredModule({
        cacheKey: 'data-engine',
        src: DATA_ENGINE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.DataEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getDataEngineDeps()),
        missingApiError: 'data-engine loaded without API',
        loadError: 'No se pudo cargar data-bundle.js (data-engine)',
        logLabel: 'Data engine',
    });
}

export function initDataEngineWarmup() {
    const warmup = createWarmupRunner(() => loadDataEngine(), {
        markWarmOnSuccess: true,
    });

    bindWarmupTarget('#v5-booking-form', 'focusin', warmup, false);
    bindWarmupTarget('#v5-booking-form', 'pointerdown', warmup);
    bindWarmupTarget('#appointmentForm', 'focusin', warmup, false);
    bindWarmupTarget('#appointmentForm', 'pointerdown', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'pointerdown', warmup);

    const bookingSection = getBookingSectionElement();
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '260px 0px',
        onNoObserver: warmup,
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 900,
    });
}

export async function apiRequest(resource, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.apiRequest(resource, options)
    );
}

export function invalidateBookedSlotsCache(
    date = '',
    doctor = '',
    service = ''
) {
    if (
        window.Piel &&
        window.Piel.DataEngine &&
        typeof window.Piel.DataEngine.invalidateBookedSlotsCache === 'function'
    ) {
        window.Piel.DataEngine.invalidateBookedSlotsCache(
            date,
            doctor,
            service
        );
        return;
    }
    withDeferredModule(loadDataEngine, (engine) =>
        engine.invalidateBookedSlotsCache(date, doctor, service)
    ).catch(() => undefined);
}

export async function loadAvailabilityData(options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.loadAvailabilityData(options)
    );
}

export async function getBookedSlots(date, doctor = '', service = '') {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.getBookedSlots(date, doctor, service)
    );
}

export async function createAppointmentRecord(appointment, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createAppointmentRecord(appointment, options)
    );
}

export async function createCallbackRecord(callback) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createCallbackRecord(callback)
    );
}

export async function createReviewRecord(review) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.createReviewRecord(review)
    );
}

export async function uploadTransferProof(file, options = {}) {
    return withDeferredModule(loadDataEngine, (engine) =>
        engine.uploadTransferProof(file, options)
    );
}
