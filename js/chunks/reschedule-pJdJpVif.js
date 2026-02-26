/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */
import { r as runDeferredModule, s as showToast, u as getCurrentLang, l as loadDeferredModule, e as withDeployAssetVersion, L as escapeHtml, P as invalidateBookedSlotsCache, E as getBookedSlots, F as loadAvailabilityData, N as apiRequest } from '../../script.js';

const BOOKING_UTILS_URL = withDeployAssetVersion(
    '/js/engines/booking-utils.js?v=figo-booking-utils-20260220-unified'
);

function getRescheduleEngineDeps() {
    return {
        apiRequest,
        loadAvailabilityData,
        getBookedSlots,
        invalidateBookedSlotsCache,
        showToast,
        escapeHtml,
        getCurrentLang: getCurrentLang,
    };
}

function loadRescheduleEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.PielRescheduleEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getRescheduleEngineDeps()),
        missingApiError: 'reschedule-engine loaded without API',
        loadError: 'No se pudo cargar booking-utils.js (reschedule)',
        logLabel: 'Reschedule engine',
    });
}

function initRescheduleEngineWarmup() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.checkRescheduleParam(),
        () => {
            showToast(
                getCurrentLang() === 'es'
                    ? 'No se pudo cargar la reprogramacion.'
                    : 'Unable to load reschedule flow.',
                'error'
            );
        }
    );
}

function closeRescheduleModal() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.closeRescheduleModal(),
        () => {
            const modal = document.getElementById('rescheduleModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }
    );
}

function submitReschedule() {
    runDeferredModule(
        loadRescheduleEngine,
        (engine) => engine.submitReschedule(),
        () => {
            showToast(
                getCurrentLang() === 'es'
                    ? 'No se pudo reprogramar en este momento.'
                    : 'Unable to reschedule right now.',
                'error'
            );
        }
    );
}

export { closeRescheduleModal, initRescheduleEngineWarmup, loadRescheduleEngine, submitReschedule };
