import { withDeployAssetVersion, debugLog, showToast } from '../shared/utils.js';
import {
    loadDeferredModule,
    runDeferredModule,
    withDeferredModule,
    createWarmupRunner,
    bindWarmupTarget,
    scheduleDeferredTask,
} from '../../../js/loader.js';
import {
    state,
    getCurrentLang,
    getCurrentAppointment,
    getChatHistory,
    setChatHistory,
    getConversationContext,
    setConversationContext,
    getChatbotOpen,
    setChatbotOpen,
    setCurrentAppointment,
} from '../../../js/state.js';
import {
    CLINIC_ADDRESS,
    CLINIC_MAP_URL,
    DOCTOR_CAROLINA_PHONE,
    DOCTOR_CAROLINA_EMAIL,
} from '../../../js/config.js';
import { trackEvent } from '../../../js/analytics.js';
import {
    loadAvailabilityData,
    getBookedSlots,
    createAppointmentRecord,
} from '../../../js/data.js';
import {
    startCheckoutSession,
    setCheckoutStep,
    completeCheckoutSession,
    openPaymentModal,
} from '../../../js/booking.js';

const CHAT_UI_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/chat-ui-engine.js?v=figo-chat-ui-20260219-phase1-sync1'
);
const CHAT_WIDGET_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/chat-widget-engine.js?v=figo-chat-widget-20260219-phase2-notification2-funnel1-sync1'
);
const CHAT_BOOKING_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/chat-booking-engine.js?v=figo-chat-booking-20260219-mbfix1'
);
const FIGO_CHAT_ENGINE_URL = withDeployAssetVersion(
    '/js/engines/chat-engine.js?v=figo-chat-20260219-phase3-runtimeconfig1-contextcap1-sync1'
);

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
const CHAT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_MAX_ITEMS = 50;
const CHAT_CONTEXT_MAX_ITEMS = 24;

export function escapeHtml(text) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        typeof window.Piel.ChatUiEngine.escapeHtml === 'function'
    ) {
        return window.Piel.ChatUiEngine.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function scrollToBottom() {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        typeof window.Piel.ChatUiEngine.scrollToBottom === 'function'
    ) {
        window.Piel.ChatUiEngine.scrollToBottom();
        return;
    }
    const container = document.getElementById('chatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

export function addUserMessage(text) {
    return withDeferredModule(loadChatUiEngine, (engine) =>
        engine.addUserMessage(text)
    );
}

export function addBotMessage(html, showOfflineLabel = false) {
    return runDeferredModule(loadChatUiEngine, (engine) =>
        engine.addBotMessage(html, showOfflineLabel)
    );
}

export function showTypingIndicator() {
    runDeferredModule(loadChatUiEngine, (engine) =>
        engine.showTypingIndicator()
    );
}

export function removeTypingIndicator() {
    runDeferredModule(loadChatUiEngine, (engine) =>
        engine.removeTypingIndicator()
    );
}

function getChatUiEngineDeps() {
    return {
        getChatHistory: () => state.chatHistory,
        setChatHistory: (h) => { state.chatHistory = h; },
        getConversationContext: () => state.conversationContext,
        setConversationContext: (c) => { state.conversationContext = c; },
        historyStorageKey: CHAT_HISTORY_STORAGE_KEY,
        historyTtlMs: CHAT_HISTORY_TTL_MS,
        historyMaxItems: CHAT_HISTORY_MAX_ITEMS,
        contextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
        debugLog,
    };
}

export function loadChatUiEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-ui-engine',
        src: CHAT_UI_ENGINE_URL,
        scriptDataAttribute: 'data-chat-ui-engine',
        resolveModule: () => window.Piel && window.Piel.ChatUiEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatUiEngineDeps()),
        missingApiError: 'chat-ui-engine loaded without API',
        loadError: 'No se pudo cargar chat-ui-engine.js',
        logLabel: 'Chat UI engine',
    });
}

export function initChatUiEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatUiEngine(), {
        markWarmOnSuccess: true,
    });
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);
    scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1300 });
}

function getChatWidgetEngineDeps() {
    return {
        getChatbotOpen: () => state.chatbotOpen,
        setChatbotOpen: (val) => { state.chatbotOpen = val; },
        getChatHistoryLength: () => state.chatHistory.length,
        warmChatUi: () => runDeferredModule(loadChatUiEngine, () => undefined),
        scrollToBottom,
        trackEvent,
        debugLog,
        addBotMessage,
        addUserMessage,
        processWithKimi,
        startChatBooking,
    };
}

export function loadChatWidgetEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-widget-engine',
        src: CHAT_WIDGET_ENGINE_URL,
        scriptDataAttribute: 'data-chat-widget-engine',
        resolveModule: () => window.Piel && window.Piel.ChatWidgetEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatWidgetEngineDeps()),
        missingApiError: 'chat-widget-engine loaded without API',
        loadError: 'No se pudo cargar chat-widget-engine.js',
        logLabel: 'Chat widget engine',
    });
}

export function initChatWidgetEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatWidgetEngine(), {
        markWarmOnSuccess: true,
    });
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup, false);
    scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1300 });
}

export function toggleChatbot() {
    runDeferredModule(
        loadChatWidgetEngine,
        (engine) => engine.toggleChatbot(),
        () => {
            const container = document.getElementById('chatbotContainer');
            if (!container) return;
            const isOpen = !getChatbotOpen();
            setChatbotOpen(isOpen);
            container.classList.toggle('active', isOpen);
        }
    );
}

export function minimizeChatbot() {
    runDeferredModule(
        loadChatWidgetEngine,
        (engine) => engine.minimizeChatbot(),
        () => {
            const container = document.getElementById('chatbotContainer');
            if (container) container.classList.remove('active');
            setChatbotOpen(false);
        }
    );
}

export function handleChatKeypress(event) {
    runDeferredModule(
        loadChatWidgetEngine,
        (engine) => engine.handleChatKeypress(event),
        () => {
            if (event && event.key === 'Enter') {
                sendChatMessage();
            }
        }
    );
}

export async function sendChatMessage() {
    return runDeferredModule(
        loadChatWidgetEngine,
        (engine) => engine.sendChatMessage(),
        async () => {
            const input = document.getElementById('chatInput');
            if (!input) return;
            const message = String(input.value || '').trim();
            if (!message) return;
            await Promise.resolve(addUserMessage(message)).catch(
                () => undefined
            );
            input.value = '';
            await processWithKimi(message);
        }
    );
}

export function sendQuickMessage(type) {
    runDeferredModule(
        loadChatWidgetEngine,
        (engine) => engine.sendQuickMessage(type),
        () => {
            if (type === 'appointment') {
                Promise.resolve(
                    addUserMessage('Quiero agendar una cita')
                ).catch(() => undefined);
                startChatBooking();
                return;
            }
            const quickMessages = {
                services: 'Que servicios ofrecen?',
                prices: 'Cuales son los precios?',
                telemedicine: 'Como funciona la consulta online?',
                human: 'Quiero hablar con un doctor real',
                acne: 'Tengo problemas de acne',
                laser: 'Informacion sobre tratamientos laser',
                location: 'Donde estan ubicados?',
            };
            const message = quickMessages[type] || type;
            Promise.resolve(addUserMessage(message)).catch(() => undefined);
            processWithKimi(message);
        }
    );
}

export function scheduleChatNotification() {
    runDeferredModule(loadChatWidgetEngine, (engine) =>
        engine.scheduleInitialNotification(30000)
    );
}

function getChatBookingEngineDeps() {
    return {
        addBotMessage,
        addUserMessage,
        showTypingIndicator,
        removeTypingIndicator,
        loadAvailabilityData,
        getBookedSlots,
        startCheckoutSession,
        setCheckoutStep,
        completeCheckoutSession,
        createAppointmentRecord,
        showToast,
        trackEvent,
        escapeHtml,
        minimizeChatbot,
        openPaymentModal,
        getCurrentLang,
        setCurrentAppointment,
    };
}

export function loadChatBookingEngine() {
    return loadDeferredModule({
        cacheKey: 'chat-booking-engine',
        src: CHAT_BOOKING_ENGINE_URL,
        scriptDataAttribute: 'data-chat-booking-engine',
        resolveModule: () => window.Piel && window.Piel.ChatBookingEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getChatBookingEngineDeps()),
        missingApiError: 'chat-booking-engine loaded without API',
        loadError: 'No se pudo cargar chat-booking-engine.js',
        logLabel: 'Chat booking engine',
    });
}

export function initChatBookingEngineWarmup() {
    const warmup = createWarmupRunner(() => loadChatBookingEngine());
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget(
        '#quickOptions [data-action="quick-message"][data-value="appointment"]',
        'mouseenter',
        warmup
    );
    bindWarmupTarget(
        '#quickOptions [data-action="quick-message"][data-value="appointment"]',
        'touchstart',
        warmup
    );
    bindWarmupTarget('#chatInput', 'focus', warmup, false);
    scheduleDeferredTask(warmup, { idleTimeout: 2600, fallbackDelay: 1700 });
}

export function startChatBooking() {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.startChatBooking(),
        () => {
            addBotMessage(
                'No pude iniciar la reserva por chat. Puedes continuar desde <a href="#citas" data-action="minimize-chat">el formulario</a>.'
            );
        }
    );
}

export function handleChatBookingSelection(value) {
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatBookingSelection(value),
        () => {
            addBotMessage('No pude procesar esa opcion. Intenta nuevamente.');
        }
    );
}

export function handleChatDateSelect(value) {
    if (!value) return;
    runDeferredModule(
        loadChatBookingEngine,
        (engine) => engine.handleChatDateSelect(value),
        () => {
            addBotMessage('No pude procesar esa fecha. Intenta nuevamente.');
        }
    );
}

export function processChatBookingStep(userInput) {
    return withDeferredModule(loadChatBookingEngine, (engine) =>
        engine.processChatBookingStep(userInput)
    );
}

export function finalizeChatBooking() {
    return withDeferredModule(loadChatBookingEngine, (engine) =>
        engine.finalizeChatBooking()
    );
}

export function isChatBookingActive() {
    if (
        window.Piel &&
        window.Piel.ChatBookingEngine &&
        typeof window.Piel.ChatBookingEngine.isActive === 'function'
    ) {
        return window.Piel.ChatBookingEngine.isActive();
    }
    return false;
}

export function loadFigoChatEngine() {
    return loadDeferredModule({
        cacheKey: 'figo-chat-engine',
        src: FIGO_CHAT_ENGINE_URL,
        scriptDataAttribute: 'data-figo-chat-engine',
        resolveModule: () => window.Piel && window.Piel.FigoChatEngine,
        isModuleReady: (module) => !!(module && typeof module.processWithKimi === 'function'),
        onModuleReady: (module) => {
            if (module && typeof module.init === 'function') {
                module.init({
                    debugLog,
                    showTypingIndicator,
                    removeTypingIndicator,
                    addBotMessage,
                    startChatBooking,
                    processChatBookingStep,
                    isChatBookingActive,
                    showToast,
                    getConversationContext,
                    setConversationContext,
                    getCurrentAppointment,
                    getChatHistory,
                    setChatHistory,
                    chatContextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
                    clinicAddress: CLINIC_ADDRESS,
                    clinicMapUrl: CLINIC_MAP_URL,
                    doctorCarolinaPhone: DOCTOR_CAROLINA_PHONE,
                    doctorCarolinaEmail: DOCTOR_CAROLINA_EMAIL
                });
            }
        },
        missingApiError: 'Figo chat engine loaded without API',
        loadError: 'No se pudo cargar chat-engine.js',
    });
}

export function initChatEngineWarmup() {
    const warmup = createWarmupRunner(() => loadFigoChatEngine(), {
        markWarmOnSuccess: true,
    });
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'mouseenter', warmup);
    bindWarmupTarget('#chatbotWidget .chatbot-toggle', 'touchstart', warmup);
    bindWarmupTarget('#chatInput', 'focus', warmup);
    scheduleDeferredTask(warmup, { idleTimeout: 7000, fallbackDelay: 7000 });
}

export async function processWithKimi(message) {
    return runDeferredModule(
        loadFigoChatEngine,
        (engine) => engine.processWithKimi(message),
        (error) => {
            console.error('Error cargando motor de chat:', error);
            removeTypingIndicator();
            addBotMessage(
                'No se pudo iniciar el asistente en este momento. Intenta de nuevo o escribenos por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">+593 98 245 3672</a>.',
                false
            );
        }
    );
}

export function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast(
                'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                'warning',
                'Servidor requerido'
            );
        }, 2000);
        return false;
    }
    return true;
}
