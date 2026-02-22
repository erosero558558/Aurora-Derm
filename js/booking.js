import { withDeployAssetVersion, showToast, debugLog } from '../src/apps/shared/utils.js';
import {
    loadDeferredModule,
    runDeferredModule,
    createWarmupRunner,
    bindWarmupTarget,
    observeOnceWhenVisible,
    scheduleDeferredTask,
} from './loader.js';
import {
    state,
    setCurrentAppointment,
} from './state.js';
import {
    loadPaymentConfig,
    loadStripeSdk,
    createPaymentIntent,
    verifyPaymentIntent,
} from './payment.js';
import {
    trackEvent,
    normalizeAnalyticsLabel,
    loadAnalyticsEngine,
    markBookingViewed,
} from './analytics.js';
import { showSuccessModal } from './success-modal.js';
import {
    createAppointmentRecord,
    uploadTransferProof,
    loadAvailabilityData,
    getBookedSlots,
} from './data.js';

export { markBookingViewed };

const BOOKING_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'
);
const BOOKING_UI_URL = withDeployAssetVersion(
    '/js/engines/booking-ui.js?v=figo-booking-ui-20260222-slotservicefix1'
);
const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');
const CASE_PHOTO_UPLOAD_CONCURRENCY = 2;

function stripTransientAppointmentFields(appointment) {
    const payload = { ...appointment };
    delete payload.casePhotoFiles;
    delete payload.casePhotoUploads;
    return payload;
}

async function ensureCasePhotosUploaded(appointment) {
    const files = Array.isArray(appointment?.casePhotoFiles)
        ? appointment.casePhotoFiles
        : [];
    if (files.length === 0) {
        return { names: [], urls: [], paths: [] };
    }

    if (
        Array.isArray(appointment.casePhotoUploads) &&
        appointment.casePhotoUploads.length > 0
    ) {
        return {
            names: appointment.casePhotoUploads
                .map((item) => String(item.name || ''))
                .filter(Boolean),
            urls: appointment.casePhotoUploads
                .map((item) => String(item.url || ''))
                .filter(Boolean),
            paths: appointment.casePhotoUploads
                .map((item) => String(item.path || ''))
                .filter(Boolean),
        };
    }

    const uploads = new Array(files.length);
    const workerCount = Math.max(
        1,
        Math.min(CASE_PHOTO_UPLOAD_CONCURRENCY, files.length)
    );
    let cursor = 0;

    const uploadWorker = async () => {
        while (cursor < files.length) {
            const index = cursor;
            cursor += 1;
            const file = files[index];
            const uploaded = await uploadTransferProof(file, { retries: 2 });
            uploads[index] = {
                name: uploaded.transferProofName || file.name || '',
                url: uploaded.transferProofUrl || '',
                path: uploaded.transferProofPath || '',
            };
        }
    };

    await Promise.all(
        Array.from({ length: workerCount }, () => uploadWorker())
    );
    appointment.casePhotoUploads = uploads;

    return {
        names: uploads.map((item) => String(item.name || '')).filter(Boolean),
        urls: uploads.map((item) => String(item.url || '')).filter(Boolean),
        paths: uploads.map((item) => String(item.path || '')).filter(Boolean),
    };
}

async function buildAppointmentPayload(appointment) {
    const payload = stripTransientAppointmentFields(appointment || {});
    const uploadedPhotos = await ensureCasePhotosUploaded(appointment || {});
    payload.casePhotoCount = uploadedPhotos.urls.length;
    payload.casePhotoNames = uploadedPhotos.names;
    payload.casePhotoUrls = uploadedPhotos.urls;
    payload.casePhotoPaths = uploadedPhotos.paths;
    return payload;
}

function getBookingEngineDeps() {
    return {
        getCurrentLang: () => state.currentLang,
        getCurrentAppointment: () => state.currentAppointment,
        setCurrentAppointment: (appt) => { state.currentAppointment = appt; },
        getCheckoutSession: () => state.checkoutSession,
        setCheckoutSessionActive: (active) => { state.checkoutSession.active = (active === true); },
        startCheckoutSession,
        setCheckoutStep,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent,
        buildAppointmentPayload,
        stripTransientAppointmentFields,
        createAppointmentRecord,
        uploadTransferProof,
        showSuccessModal,
        showToast,
        trackEvent,
        normalizeAnalyticsLabel,
    };
}

export function loadBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-engine',
        src: BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.Piel && window.Piel.BookingEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getBookingEngineDeps()),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine',
    });
}

export function initBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadBookingEngine(), {
        markWarmOnSuccess: true,
    });

    const selectors = [
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]',
    ];

    selectors.forEach((selector) => {
        bindWarmupTarget(selector, 'mouseenter', warmup);
        bindWarmupTarget(selector, 'focus', warmup, false);
        bindWarmupTarget(selector, 'touchstart', warmup);
    });

    scheduleDeferredTask(warmup, {
        idleTimeout: 2500,
        fallbackDelay: 1100,
    });
}

// CHECKOUT SESSION WRAPPERS
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

export function loadBookingCalendarEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils-calendar',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
        isModuleReady: (module) => !!(module && typeof module.initCalendar === 'function'),
        missingApiError: 'booking-calendar-engine loaded without API',
        loadError: 'No se pudo cargar booking-calendar-engine',
        logLabel: 'Booking Calendar engine'
    });
}

export async function updateAvailableTimes(elements) {
    return runDeferredModule(loadBookingCalendarEngine, (engine) => engine.updateAvailableTimes(getBookingUiDeps(), elements));
}

// BOOKING UI
function getDefaultTimeSlots() {
    return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
}

function getBookingUiDeps() {
    return {
        loadAvailabilityData,
        getBookedSlots,
        updateAvailableTimes,
        getDefaultTimeSlots,
        showToast,
        getCurrentLang: () => state.currentLang,
        getCasePhotoFiles: (form) => {
            const input = form?.querySelector('#casePhotos');
            if (!input || !input.files) return [];
            return Array.from(input.files);
        },
        validateCasePhotoFiles,
        markBookingViewed,
        startCheckoutSession,
        setCheckoutStep,
        trackEvent,
        normalizeAnalyticsLabel,
        openPaymentModal,
        setCurrentAppointment: setCurrentAppointment,
    };
}

function validateCasePhotoFiles(files) {
    const MAX_CASE_PHOTOS = 3;
    const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
    const CASE_PHOTO_ALLOWED_TYPES = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
    ]);

    if (!Array.isArray(files) || files.length === 0) return;

    if (files.length > MAX_CASE_PHOTOS) {
        throw new Error(
            state.currentLang === 'es'
                ? `Puedes subir m\u00E1ximo ${MAX_CASE_PHOTOS} fotos.`
                : `You can upload up to ${MAX_CASE_PHOTOS} photos.`
        );
    }

    for (const file of files) {
        if (!file) continue;

        if (file.size > MAX_CASE_PHOTO_BYTES) {
            throw new Error(
                state.currentLang === 'es'
                    ? `Cada foto debe pesar m\u00E1ximo ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
                    : `Each photo must be at most ${Math.round(MAX_CASE_PHOTO_BYTES / (1024 * 1024))} MB.`
            );
        }

        const mime = String(file.type || '').toLowerCase();
        const validByMime = CASE_PHOTO_ALLOWED_TYPES.has(mime);
        const validByExt = /\.(jpe?g|png|webp)$/i.test(String(file.name || ''));
        if (!validByMime && !validByExt) {
            throw new Error(
                state.currentLang === 'es'
                    ? 'Solo se permiten im\u00e1genes JPG, PNG o WEBP.'
                    : 'Only JPG, PNG or WEBP images are allowed.'
            );
        }
    }
}

export function loadBookingUi() {
    return loadDeferredModule({
        cacheKey: 'booking-ui',
        src: BOOKING_UI_URL,
        scriptDataAttribute: 'data-booking-ui',
        resolveModule: () => window.Piel && window.Piel.BookingUi,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => {
            module.init(getBookingUiDeps());
            window.PielBookingUiReady = true;
            if (window.debugLog) window.debugLog('Booking UI ready');
        },
        missingApiError: 'booking-ui loaded without API',
        loadError: 'No se pudo cargar booking-ui.js',
        logLabel: 'Booking UI',
    });
}

export function initBookingUiWarmup() {
    const warmup = createWarmupRunner(() => loadBookingUi());

    const bookingSection = document.getElementById('citas');
    observeOnceWhenVisible(bookingSection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup,
    });

    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('focusin', warmup, { once: true });
        appointmentForm.addEventListener('pointerdown', warmup, {
            once: true,
            passive: true,
        });
        setTimeout(warmup, 120);
    }

    if (!bookingSection && !appointmentForm) {
        return;
    }

    scheduleDeferredTask(warmup, {
        idleTimeout: 1800,
        fallbackDelay: 1100,
    });
}

export function openPaymentModal(appointmentData) {
    runDeferredModule(
        loadBookingEngine,
        (engine) => engine.openPaymentModal(appointmentData),
        (error) => {
            debugLog('openPaymentModal fallback error:', error);
            showToast('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}

export function closePaymentModal(options = {}) {
    if (
        window.Piel &&
        window.Piel.BookingEngine &&
        typeof window.Piel.BookingEngine.closePaymentModal === 'function'
    ) {
        window.Piel.BookingEngine.closePaymentModal(options);
        return;
    }

    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason =
        options && typeof options.reason === 'string'
            ? options.reason
            : 'modal_close';
    if (!skipAbandonTrack) {
        maybeTrackCheckoutAbandon(abandonReason);
    }

    state.checkoutSession.active = false;
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

export async function processPayment() {
    return runDeferredModule(
        loadBookingEngine,
        (engine) => engine.processPayment(),
        (error) => {
            debugLog('processPayment error:', error);
            showToast('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}

export function initBookingFunnelObserver() {
    runDeferredModule(loadAnalyticsEngine, (engine) =>
        engine.initBookingFunnelObserver()
    );
}
