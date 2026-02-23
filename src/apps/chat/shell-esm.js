import { debugLog, showToast } from '../../../js/utils.js';
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
import { getCaptchaToken } from '../../../js/captcha.js';
import {
    startCheckoutSession,
    setCheckoutStep,
    completeCheckoutSession,
    openPaymentModal,
} from '../../../js/booking.js';

const CHAT_HISTORY_STORAGE_KEY = 'chatHistory';
const CHAT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_MAX_ITEMS = 50;
const CHAT_CONTEXT_MAX_ITEMS = 24;

let chatEngine = null;
let chatWidget = null;
let chatUI = null;
let chatBooking = null;
let loadingPromise = null;

async function loadChatSystem() {
    if (chatEngine) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        const { ChatEngine, ChatWidgetEngine, ChatUIEngine, ChatBookingEngine } = await import('../../modules/chat/index.js');

        // Initialize UI Engine
        chatUI = new ChatUIEngine().init({
            getChatHistory: () => state.chatHistory,
            setChatHistory: (h) => { state.chatHistory = h; },
            getConversationContext: () => state.conversationContext,
            setConversationContext: (c) => { state.conversationContext = c; },
            historyStorageKey: CHAT_HISTORY_STORAGE_KEY,
            historyTtlMs: CHAT_HISTORY_TTL_MS,
            historyMaxItems: CHAT_HISTORY_MAX_ITEMS,
            contextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
            debugLog,
            escapeHtml: (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        });

        // Initialize Booking Engine
        chatBooking = new ChatBookingEngine().init({
            addBotMessage: (html, offline) => chatUI.addBotMessage(html, offline),
            addUserMessage: (text) => chatUI.addUserMessage(text),
            showTypingIndicator: () => chatUI.showTypingIndicator(),
            removeTypingIndicator: () => chatUI.removeTypingIndicator(),
            loadAvailabilityData,
            getBookedSlots,
            startCheckoutSession,
            setCheckoutStep,
            completeCheckoutSession,
            createAppointmentRecord,
            getCaptchaToken,
            showToast,
            trackEvent,
            escapeHtml: (text) => chatUI.escapeHtml(text),
            minimizeChatbot: () => chatWidget.minimizeChatbot(),
            openPaymentModal,
            getCurrentLang,
            setCurrentAppointment: (appt) => { state.currentAppointment = appt; },
        });

        // Initialize Logic Engine (Figo)
        chatEngine = new ChatEngine().init({
            debugLog,
            showTypingIndicator: () => chatUI.showTypingIndicator(),
            removeTypingIndicator: () => chatUI.removeTypingIndicator(),
            addBotMessage: (html, offline) => chatUI.addBotMessage(html, offline),
            startChatBooking: () => chatBooking.startChatBooking(),
            processChatBookingStep: (msg) => chatBooking.processChatBookingStep(msg),
            isChatBookingActive: () => chatBooking.isActive(),
            showToast,
            getConversationContext: () => state.conversationContext,
            setConversationContext: (c) => { state.conversationContext = c; },
            getCurrentAppointment: () => state.currentAppointment,
            getChatHistory: () => state.chatHistory,
            setChatHistory: (h) => { state.chatHistory = h; },
            chatContextMaxItems: CHAT_CONTEXT_MAX_ITEMS,
            clinicAddress: CLINIC_ADDRESS,
            clinicMapUrl: CLINIC_MAP_URL,
            doctorCarolinaPhone: DOCTOR_CAROLINA_PHONE,
            doctorCarolinaEmail: DOCTOR_CAROLINA_EMAIL
        });

        // Initialize Widget Engine
        chatWidget = new ChatWidgetEngine().init({
            getChatbotOpen: () => state.chatbotOpen,
            setChatbotOpen: (val) => { state.chatbotOpen = val; },
            getChatHistoryLength: () => state.chatHistory.length,
            warmChatUi: () => {}, // No-op, already loaded
            scrollToBottom: () => chatUI.scrollToBottom(),
            trackEvent,
            debugLog,
            addBotMessage: (html) => chatUI.addBotMessage(html),
            addUserMessage: (text) => chatUI.addUserMessage(text),
            processWithKimi: (msg) => chatEngine.processWithKimi(msg),
            startChatBooking: () => chatBooking.startChatBooking(),
        });

        loadingPromise = null;
    })();

    return loadingPromise;
}

export function initChatUiEngineWarmup() {
    // Warmup is handled by lazy load on interaction, but we can prefetch
    // import('../../modules/chat/index.js');
}

export function initChatWidgetEngineWarmup() {
    // No-op
}

export function initChatEngineWarmup() {
    // No-op
}

export function initChatBookingEngineWarmup() {
    // No-op
}

export function escapeHtml(text) {
    // Fallback if engines not loaded
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function toggleChatbot() {
    loadChatSystem().then(() => {
        chatWidget.toggleChatbot();
    });
}

export function minimizeChatbot() {
    if (chatWidget) {
        chatWidget.minimizeChatbot();
    }
}

export function handleChatKeypress(event) {
    if (chatWidget) {
        chatWidget.handleChatKeypress(event);
    }
}

export function sendChatMessage() {
    if (chatWidget) {
        chatWidget.sendChatMessage();
    }
}

export function sendQuickMessage(type) {
    loadChatSystem().then(() => {
        chatWidget.sendQuickMessage(type);
    });
}

export function startChatBooking() {
    loadChatSystem().then(() => {
        chatBooking.startChatBooking();
    });
}

export function handleChatBookingSelection(value) {
    if (chatBooking) {
        chatBooking.handleChatBookingSelection(value);
    }
}

export function handleChatDateSelect(value) {
    if (chatBooking) {
        chatBooking.handleChatDateSelect(value);
    }
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
