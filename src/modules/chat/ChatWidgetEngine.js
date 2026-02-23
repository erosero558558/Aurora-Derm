
const QUICK_MESSAGES = {
    services: 'Que servicios ofrecen?',
    prices: 'Cuales son los precios?',
    telemedicine: 'Como funciona la consulta online?',
    human: 'Quiero hablar con un doctor real',
    acne: 'Tengo problemas de acne',
    laser: 'Informacion sobre tratamientos laser',
    location: 'Donde estan ubicados?',
};

export class ChatWidgetEngine {
    constructor() {
        this.deps = null;
        this.chatStartedTracked = false;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    getChatbotOpen() {
        if (this.deps && typeof this.deps.getChatbotOpen === 'function') {
            return this.deps.getChatbotOpen() === true;
        }
        return false;
    }

    setChatbotOpen(isOpen) {
        if (this.deps && typeof this.deps.setChatbotOpen === 'function') {
            this.deps.setChatbotOpen(isOpen === true);
        }
    }

    getChatHistoryLength() {
        if (this.deps && typeof this.deps.getChatHistoryLength === 'function') {
            return Number(this.deps.getChatHistoryLength()) || 0;
        }
        return 0;
    }

    warmChatUi() {
        if (this.deps && typeof this.deps.warmChatUi === 'function') {
            this.deps.warmChatUi();
        }
    }

    scrollToBottomSafe() {
        if (this.deps && typeof this.deps.scrollToBottom === 'function') {
            this.deps.scrollToBottom();
        }
    }

    trackEventSafe(eventName, payload) {
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent(eventName, payload || {});
        }
    }

    ensureChatStartedTracked(source) {
        if (this.chatStartedTracked) {
            return;
        }

        this.chatStartedTracked = true;
        this.trackEventSafe('chat_started', {
            source: source || 'widget',
        });
    }

    debugLogSafe(...args) {
        if (this.deps && typeof this.deps.debugLog === 'function') {
            this.deps.debugLog(...args);
        }
    }

    addBotMessageSafe(html) {
        if (this.deps && typeof this.deps.addBotMessage === 'function') {
            this.deps.addBotMessage(html);
        }
    }

    addUserMessageSafe(text) {
        if (this.deps && typeof this.deps.addUserMessage === 'function') {
            return this.deps.addUserMessage(text);
        }
        return undefined;
    }

    processWithKimiSafe(text) {
        if (this.deps && typeof this.deps.processWithKimi === 'function') {
            return this.deps.processWithKimi(text);
        }
        return Promise.resolve();
    }

    startChatBookingSafe() {
        if (this.deps && typeof this.deps.startChatBooking === 'function') {
            this.deps.startChatBooking();
        }
    }

    shouldUseRealAI() {
        if (localStorage.getItem('forceAI') === 'true') {
            return true;
        }
        if (typeof window !== 'undefined') {
            return window.location.protocol !== 'file:';
        }
        return false;
    }

    buildWelcomeMessage(usingRealAI) {
        let message =
            'Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonia</strong>.<br><br>';

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

    renderQuickSuggestions() {
        setTimeout(() => {
            let quickOptions = '<div class="chat-suggestions">';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
            quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
            quickOptions += '</button>';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
            quickOptions +=
                '<i class="fas fa-calendar-check"></i> Agendar cita';
            quickOptions += '</button>';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
            quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
            quickOptions += '</button>';
            quickOptions += '</div>';

            this.addBotMessageSafe(quickOptions);
        }, 500);
    }

    toggleChatbot() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatbotContainer');
        if (!container) {
            return;
        }

        this.warmChatUi();

        const nextOpen = !this.getChatbotOpen();
        this.setChatbotOpen(nextOpen);

        if (!nextOpen) {
            container.classList.remove('active');
            return;
        }

        container.classList.add('active');
        this.hideTeaser();

        const notification = document.getElementById('chatNotification');
        if (notification) {
            notification.style.display = 'none';
        }

        this.scrollToBottomSafe();

        this.ensureChatStartedTracked('widget_open');

        if (this.getChatHistoryLength() > 0) {
            return;
        }

        const usingRealAI = this.shouldUseRealAI();
        this.debugLogSafe(
            'Estado del chatbot:',
            usingRealAI ? 'IA REAL' : 'Respuestas locales'
        );
        this.addBotMessageSafe(this.buildWelcomeMessage(usingRealAI));
        this.renderQuickSuggestions();
    }

    minimizeChatbot() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatbotContainer');
        if (container) {
            container.classList.remove('active');
        }
        this.setChatbotOpen(false);
    }

    handleChatKeypress(event) {
        if (event && event.key === 'Enter') {
            this.sendChatMessage();
        }
    }

    async sendChatMessage() {
        if (typeof document === 'undefined') return;
        const input = document.getElementById('chatInput');
        if (!input) {
            return;
        }

        const message = String(input.value || '').trim();
        if (!message) {
            return;
        }

        this.ensureChatStartedTracked('first_message');

        await Promise.resolve(this.addUserMessageSafe(message)).catch(
            () => undefined
        );
        input.value = '';
        await Promise.resolve(this.processWithKimiSafe(message)).catch(
            () => undefined
        );
    }

    sendQuickMessage(type) {
        this.ensureChatStartedTracked('quick_message');

        if (type === 'appointment') {
            Promise.resolve(
                this.addUserMessageSafe('Quiero agendar una cita')
            ).catch(() => undefined);
            this.startChatBookingSafe();
            return;
        }

        const message = QUICK_MESSAGES[type] || type;
        Promise.resolve(this.addUserMessageSafe(message)).catch(() => undefined);
        Promise.resolve(this.processWithKimiSafe(message)).catch(() => undefined);
    }

    showTeaser() {
        if (typeof document === 'undefined') return;
        const teaser = document.getElementById('chatTeaser');
        if (teaser) {
            teaser.classList.add('show');
        }
    }

    hideTeaser() {
        if (typeof document === 'undefined') return;
        const teaser = document.getElementById('chatTeaser');
        if (teaser) {
            teaser.classList.remove('show');
        }
    }

    scheduleInitialNotification(delayMs) {
        const delay = Number(delayMs);
        const safeDelay = Number.isFinite(delay) && delay >= 0 ? delay : 8000;

        setTimeout(() => {
            const notification = document.getElementById('chatNotification');

            const isOpen = this.getChatbotOpen();
            const historyLength = this.getChatHistoryLength();

            if (!isOpen && historyLength === 0) {
                if (notification) {
                    notification.style.display = 'flex';
                }
                this.showTeaser();
            }
        }, safeDelay);
    }
}
