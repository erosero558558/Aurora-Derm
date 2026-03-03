import { withDeployAssetVersion, debugLog } from './utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { setThemeMode } from './theme.js';
import { changeLanguage } from './i18n.js';
import {
    closePaymentModal,
    processPayment,
    markBookingViewed,
} from './booking.js';
// Chat shell cargado bajo demanda (code splitting)
function loadChatShell() {
    return import('../src/apps/chat/shell.js');
}

let uiRuntimePromise = null;
function loadUiRuntime() {
    if (!uiRuntimePromise) {
        uiRuntimePromise = import('./ui.js');
    }
    return uiRuntimePromise;
}

let engagementRuntimePromise = null;
function loadEngagementRuntime() {
    if (!engagementRuntimePromise) {
        engagementRuntimePromise = import('./engagement.js');
    }
    return engagementRuntimePromise;
}

let successModalRuntimePromise = null;
function loadSuccessModalRuntime() {
    if (!successModalRuntimePromise) {
        successModalRuntimePromise = import('./success-modal.js');
    }
    return successModalRuntimePromise;
}

let rescheduleRuntimePromise = null;
function loadRescheduleRuntime() {
    if (!rescheduleRuntimePromise) {
        rescheduleRuntimePromise = import('./reschedule.js');
    }
    return rescheduleRuntimePromise;
}

function toggleMobileMenu(forceClose) {
    loadUiRuntime()
        .then((mod) => mod.toggleMobileMenu(forceClose))
        .catch(() => undefined);
}

function startWebVideo() {
    loadUiRuntime()
        .then((mod) => mod.startWebVideo())
        .catch(() => undefined);
}

function closeVideoModal() {
    loadUiRuntime()
        .then((mod) => mod.closeVideoModal())
        .catch(() => undefined);
}

function openReviewModal() {
    loadEngagementRuntime()
        .then((mod) => mod.openReviewModal())
        .catch(() => undefined);
}

function closeReviewModal() {
    loadEngagementRuntime()
        .then((mod) => mod.closeReviewModal())
        .catch(() => undefined);
}

function closeSuccessModal() {
    loadSuccessModalRuntime()
        .then((mod) => mod.closeSuccessModal())
        .catch(() => undefined);
}

function closeRescheduleModal() {
    loadRescheduleRuntime()
        .then((mod) => mod.closeRescheduleModal())
        .catch(() => undefined);
}

function submitReschedule() {
    loadRescheduleRuntime()
        .then((mod) => mod.submitReschedule())
        .catch(() => undefined);
}
function chatAction(name) {
    return async (...args) => {
        const shell = await loadChatShell();
        return shell[name](...args);
    };
}

const DATA_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/data-bundle.js?v=20260225-data-consolidation1'
);

function selectService(value) {
    const select =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change'));
        markBookingViewed('service_select');
        const appointmentSection =
            document.getElementById('v5-booking') ||
            document.getElementById('citas');
        if (appointmentSection) {
            const navHeight =
                document.querySelector('.nav')?.offsetHeight || 80;
            const targetPosition =
                appointmentSection.offsetTop - navHeight - 20;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        }
    }
}

function getActionRouterEngineDeps() {
    return {
        setThemeMode,
        changeLanguage,
        toggleMobileMenu,
        startWebVideo,
        openReviewModal,
        closeReviewModal,
        closeVideoModal,
        closePaymentModal,
        processPayment,
        closeSuccessModal,
        closeRescheduleModal,
        submitReschedule,
        toggleChatbot: chatAction('toggleChatbot'),
        sendChatMessage: chatAction('sendChatMessage'),
        handleChatBookingSelection: chatAction('handleChatBookingSelection'),
        sendQuickMessage: chatAction('sendQuickMessage'),
        minimizeChatbot: chatAction('minimizeChatbot'),
        startChatBooking: chatAction('startChatBooking'),
        handleChatDateSelect: chatAction('handleChatDateSelect'),
        selectService,
    };
}

export function loadActionRouterEngine() {
    return loadDeferredModule({
        cacheKey: 'action-router-engine',
        src: DATA_BUNDLE_URL,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.ActionRouterEngine) ||
            window.PielActionRouterEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getActionRouterEngineDeps()),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine',
    });
}

export function initActionRouterEngine() {
    runDeferredModule(
        loadActionRouterEngine,
        () => undefined,
        (error) => {
            debugLog('Action router load failed:', error);
        }
    );
}
