/**
 * Chat widget controller engine (deferred-loaded).
 * Handles open/minimize and quick interactions for the floating chatbot UI.
 */
'use strict';

let deps = null;
let chatStartedTracked = false;
let viewportListenersBound = false;
const MOBILE_CHAT_BREAKPOINT = 900;

const QUICK_MESSAGES = {
    services: 'Que servicios ofrecen?',
    prices: 'Cuales son los precios?',
    telemedicine: 'Como funciona la consulta online?',
    human: 'Quiero hablar con un doctor real',
    acne: 'Tengo problemas de acne',
    laser: 'Informacion sobre tratamientos laser',
    location: 'Donde estan ubicados?',
};

function init(inputDeps) {
    deps = inputDeps || {};
    bindViewportListenersOnce();
    syncChatViewportLayout();
    return window.Piel && window.Piel.ChatWidgetEngine;
}

function getChatbotOpen() {
    if (deps && typeof deps.getChatbotOpen === 'function') {
        return deps.getChatbotOpen() === true;
    }
    return false;
}

function setChatbotOpen(isOpen) {
    if (deps && typeof deps.setChatbotOpen === 'function') {
        deps.setChatbotOpen(isOpen === true);
    }
}

function getChatHistoryLength() {
    if (deps && typeof deps.getChatHistoryLength === 'function') {
        return Number(deps.getChatHistoryLength()) || 0;
    }
    return 0;
}

function warmChatUi() {
    if (deps && typeof deps.warmChatUi === 'function') {
        deps.warmChatUi();
    }
}

function scrollToBottomSafe() {
    if (deps && typeof deps.scrollToBottom === 'function') {
        deps.scrollToBottom();
    }
}

function trackEventSafe(eventName, payload) {
    if (deps && typeof deps.trackEvent === 'function') {
        deps.trackEvent(eventName, payload || {});
    }
}

function ensureChatStartedTracked(source) {
    if (chatStartedTracked) {
        return;
    }

    chatStartedTracked = true;
    trackEventSafe('chat_started', {
        source: source || 'widget',
    });
}

function debugLogSafe(...args) {
    if (deps && typeof deps.debugLog === 'function') {
        deps.debugLog(...args);
    }
}

function addBotMessageSafe(html) {
    if (deps && typeof deps.addBotMessage === 'function') {
        deps.addBotMessage(html);
    }
}

function addUserMessageSafe(text) {
    if (deps && typeof deps.addUserMessage === 'function') {
        return deps.addUserMessage(text);
    }
    return undefined;
}

function processWithKimiSafe(text) {
    if (deps && typeof deps.processWithKimi === 'function') {
        return deps.processWithKimi(text);
    }
    return Promise.resolve();
}

function startChatBookingSafe() {
    if (deps && typeof deps.startChatBooking === 'function') {
        deps.startChatBooking();
    }
}

function isChatBookingActiveSafe() {
    if (deps && typeof deps.isChatBookingActive === 'function') {
        return deps.isChatBookingActive() === true;
    }
    return false;
}

function isMobileViewport() {
    if (typeof window.matchMedia === 'function') {
        return window.matchMedia(`(max-width: ${MOBILE_CHAT_BREAKPOINT}px)`)
            .matches;
    }
    return window.innerWidth <= MOBILE_CHAT_BREAKPOINT;
}

function getVisibleHeaderBottom() {
    let maxBottom = 0;
    const selectors = ['.language-bar', '.nav'];

    selectors.forEach((selector) => {
        const el = document.querySelector(selector);
        if (!el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        if (!Number.isFinite(rect.bottom)) {
            return;
        }
        maxBottom = Math.max(maxBottom, rect.bottom);
    });

    return Math.ceil(Math.max(maxBottom, 96));
}

function getQuickDockHeight() {
    const dock = document.querySelector('.quick-dock');
    if (!dock || typeof dock.getBoundingClientRect !== 'function') {
        return 0;
    }
    const style = window.getComputedStyle
        ? window.getComputedStyle(dock)
        : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return 0;
    }
    const rect = dock.getBoundingClientRect();
    return Number.isFinite(rect.height)
        ? Math.ceil(Math.max(rect.height, 0))
        : 0;
}

function syncChatViewportLayout() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) {
        return;
    }

    const quickDockHeight = getQuickDockHeight();
    const quickDockExtra = Math.max(0, quickDockHeight - 56);
    const compactMobile = window.innerWidth <= 640;
    const widgetBaseBottom = compactMobile ? 76 : 82;
    root.style.setProperty(
        '--chat-widget-mobile-bottom',
        `${widgetBaseBottom + quickDockExtra}px`
    );
    root.style.setProperty(
        '--chat-container-mobile-bottom',
        `${146 + quickDockExtra}px`
    );
    root.style.setProperty('--chat-quick-dock-height', `${quickDockHeight}px`);

    if (isMobileViewport()) {
        root.style.setProperty(
            '--chat-mobile-top-offset',
            `${getVisibleHeaderBottom() + 10}px`
        );
    } else {
        root.style.removeProperty('--chat-mobile-top-offset');
    }

    body.classList.toggle('chatbot-open', getChatbotOpen());
    body.classList.toggle(
        'chatbot-booking-active',
        getChatbotOpen() && isChatBookingActiveSafe()
    );
    body.classList.toggle(
        'chatbot-mobile-open',
        isMobileViewport() && getChatbotOpen()
    );
}

function bindViewportListenersOnce() {
    if (viewportListenersBound) {
        return;
    }
    viewportListenersBound = true;

    const onViewportChange = () => {
        syncChatViewportLayout();
    };

    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, {
        passive: true,
    });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onViewportChange, {
            passive: true,
        });
    }
}

function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }
    return window.location.protocol !== 'file:';
}

function buildWelcomeMessage(usingRealAI) {
    let message =
        'Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Aurora Derm</strong>.<br><br>';

    if (usingRealAI) {
        message +=
            '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
        message += 'Puedo ayudarte con informacion detallada sobre:<br>';
        message += '- Nuestros servicios dermatologicos<br>';
        message += '- Precios de consultas y tratamientos<br>';
        message += '- Agendar citas presenciales o online<br>';
        message += '- Ubicacion y horarios de atencion<br>';
        message += '- Resolver tus dudas sobre cuidado de la piel<br><br>';
    } else {
        message += 'Puedo ayudarte con informacion sobre:<br>';
        message += '- Nuestros servicios dermatologicos<br>';
        message += '- Precios de consultas y tratamientos<br>';
        message += '- Agendar citas presenciales o online<br>';
        message += '- Ubicacion y horarios de atencion<br><br>';
    }

    message += 'En que puedo ayudarte hoy?';
    return message;
}

function renderQuickSuggestions() {
    setTimeout(() => {
        let quickOptions = '<div class="chat-suggestions">';
        quickOptions +=
            '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
        quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
        quickOptions += '</button>';
        quickOptions +=
            '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
        quickOptions += '<i class="fas fa-calendar-check"></i> Agendar cita';
        quickOptions += '</button>';
        quickOptions +=
            '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
        quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
        quickOptions += '</button>';
        quickOptions += '</div>';

        addBotMessageSafe(quickOptions);
    }, 500);
}

function toggleChatbot() {
    const container = document.getElementById('chatbotContainer');
    if (!container) {
        return;
    }

    warmChatUi();

    const nextOpen = !getChatbotOpen();
    setChatbotOpen(nextOpen);

    if (!nextOpen) {
        container.classList.remove('active');
        syncChatViewportLayout();
        return;
    }

    syncChatViewportLayout();
    container.classList.add('active');
    hideTeaser();

    const notification = document.getElementById('chatNotification');
    if (notification) {
        notification.style.display = 'none';
    }

    scrollToBottomSafe();

    ensureChatStartedTracked('widget_open');

    if (getChatHistoryLength() > 0) {
        return;
    }

    const usingRealAI = shouldUseRealAI();
    debugLogSafe(
        'Estado del chatbot:',
        usingRealAI ? 'IA REAL' : 'Respuestas locales'
    );
    addBotMessageSafe(buildWelcomeMessage(usingRealAI));
    renderQuickSuggestions();
}

function minimizeChatbot() {
    const container = document.getElementById('chatbotContainer');
    if (container) {
        container.classList.remove('active');
    }
    setChatbotOpen(false);
    syncChatViewportLayout();
}

function handleChatKeypress(event) {
    if (event && event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) {
        return;
    }

    const message = String(input.value || '').trim();
    if (!message) {
        return;
    }

    ensureChatStartedTracked('first_message');

    await Promise.resolve(addUserMessageSafe(message)).catch(() => undefined);
    input.value = '';
    await Promise.resolve(processWithKimiSafe(message)).catch(() => undefined);
}

function sendQuickMessage(type) {
    ensureChatStartedTracked('quick_message');

    if (type === 'appointment') {
        Promise.resolve(addUserMessageSafe('Quiero agendar una cita')).catch(
            () => undefined
        );
        startChatBookingSafe();
        syncChatViewportLayout();
        return;
    }

    const message = QUICK_MESSAGES[type] || type;
    Promise.resolve(addUserMessageSafe(message)).catch(() => undefined);
    Promise.resolve(processWithKimiSafe(message)).catch(() => undefined);
}

function showTeaser() {
    const teaser = document.getElementById('chatTeaser');
    if (teaser) {
        teaser.classList.add('show');
    }
}

function hideTeaser() {
    const teaser = document.getElementById('chatTeaser');
    if (teaser) {
        teaser.classList.remove('show');
    }
}

function scheduleInitialNotification(delayMs) {
    const delay = Number(delayMs);
    const safeDelay = Number.isFinite(delay) && delay >= 0 ? delay : 8000;

    setTimeout(() => {
        const notification = document.getElementById('chatNotification');

        const isOpen = getChatbotOpen();
        const historyLength = getChatHistoryLength();

        if (!isOpen && historyLength === 0) {
            if (notification) {
                notification.style.display = 'flex';
            }
            showTeaser();
        }
    }, safeDelay);
}

window.Piel = window.Piel || {};
window.Piel.ChatWidgetEngine = {
    init,
    toggleChatbot,
    minimizeChatbot,
    handleChatKeypress,
    sendChatMessage,
    sendQuickMessage,
    scheduleInitialNotification,
    showTeaser,
    hideTeaser,
};
