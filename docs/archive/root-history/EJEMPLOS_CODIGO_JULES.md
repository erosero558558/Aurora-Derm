# 💻 EJEMPLOS DE CÓDIGO PARA JULES

**Copy-paste ready snippets**

---

## TAREA 1.1: Remover Debug

### bootstrap-inline-engine.js (Línea ~303)

```javascript
// ELIMINAR estas líneas:
// const DEBUG = false;
// window.debugLog = debugLog;

// REEMPLAZAR la función debugLog con:
function debugLog(...args) {
    // Solo log en desarrollo
    if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    ) {
        console.log('[DEBUG]', ...args);
    }
}
```

### chat-engine.js (Líneas ~428-430)

```javascript
// ELIMINAR:
// window.DEBUG_CHAT = true;
// window.getChatLogs = () => console.log('Chat logs disabled in production');

// REEMPLAZAR con:
Object.defineProperty(window, 'DEBUG_CHAT', {
    get() {
        return window.location.hostname === 'localhost';
    },
    enumerable: false,
    configurable: false,
});
```

### script.js (Líneas ~68-70)

```javascript
// ELIMINAR:
// export { debugLog }; // Si existe export
// window.PielDebug = { getState: () => state }; // Si expone estado

// Mantener solo función interna:
function debugLog(...args) {
    if (location.hostname === 'localhost') console.log(...args);
}
```

### utils.js (Líneas ~16-25)

```javascript
// ELIMINAR exposición global:
// window.Utils = Utils;
// window.debugUtils = () => { ... };

// Mantener solo export ES6:
export const Utils = { ... };
export function debounce(fn, delay) { ... }
```

---

## TAREA 2.1: Migración ES6

### src/modules/chat/index.js

```javascript
/**
 * Chat Module - ES6 Entry Point
 * @module chat
 */

export { ChatEngine } from './ChatEngine.js';
export { ChatWidget } from './ChatWidget.js';
export { ChatService } from './ChatService.js';
export { ChatState } from './ChatState.js';
export { ChatUI } from './ChatUI.js';
```

### src/modules/chat/ChatEngine.js

```javascript
import { ChatState } from './ChatState.js';
import { ChatUI } from './ChatUI.js';
import { ChatService } from './ChatService.js';

/**
 * Main Chat Engine
 * @class
 */
export class ChatEngine {
    constructor(config = {}) {
        this.config = {
            endpoint: config.endpoint || '/figo-chat.php',
            timeout: config.timeout || 20000,
            welcomeMessage:
                config.welcomeMessage || '¡Hola! ¿En qué puedo ayudarte?',
            ...config,
        };

        this.state = new ChatState();
        this.ui = new ChatUI(this.state, this.config);
        this.service = new ChatService(this.config);

        this.initialized = false;
    }

    /**
     * Initialize the chat engine
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        await this.ui.render();
        this.attachEventListeners();

        // Load history
        const history = this.getChatHistory();
        if (history.length > 0) {
            this.ui.renderHistory(history);
        } else {
            this.ui.addMessage('bot', this.config.welcomeMessage);
        }

        this.initialized = true;
    }

    /**
     * Send a message
     * @param {string} message
     * @returns {Promise<void>}
     */
    async sendMessage(message) {
        if (!message.trim()) return;

        // Add user message to UI
        this.ui.addMessage('user', message);
        this.saveToHistory('user', message);

        // Show typing indicator
        this.ui.showTyping();

        try {
            const response = await this.service.sendMessage(
                message,
                this.state.getContext()
            );
            this.ui.hideTyping();
            this.ui.addMessage('bot', response.message);
            this.saveToHistory('bot', response.message);
            this.state.updateContext(response.context);
        } catch (error) {
            this.ui.hideTyping();
            this.ui.addMessage(
                'bot',
                'Lo siento, hubo un error. Por favor intenta de nuevo.'
            );
            console.error('Chat error:', error);
        }
    }

    attachEventListeners() {
        const input = this.ui.getInput();
        const sendBtn = this.ui.getSendButton();

        sendBtn.addEventListener('click', () => {
            const message = input.value;
            input.value = '';
            this.sendMessage(message);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = input.value;
                input.value = '';
                this.sendMessage(message);
            }
        });
    }

    getChatHistory() {
        try {
            const raw = localStorage.getItem('chatHistory');
            const history = raw ? JSON.parse(raw) : [];
            // Filter last 24 hours
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            return history.filter((m) => m.time > cutoff);
        } catch {
            return [];
        }
    }

    saveToHistory(role, content) {
        try {
            const history = this.getChatHistory();
            history.push({ role, content, time: Date.now() });
            localStorage.setItem('chatHistory', JSON.stringify(history));
        } catch {
            // Ignore storage errors
        }
    }

    /**
     * Toggle chat visibility
     */
    toggle() {
        this.ui.toggle();
        if (this.ui.isOpen() && !this.initialized) {
            this.init();
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.ui.destroy();
        this.initialized = false;
    }
}
```

### src/modules/chat/ChatState.js

```javascript
/**
 * Manages chat state
 * @class
 */
export class ChatState {
    constructor() {
        this.context = [];
        this.isOpen = false;
        this.unreadCount = 0;
    }

    getContext() {
        return [...this.context];
    }

    updateContext(newContext) {
        this.context = newContext || this.context;
    }

    addToContext(message) {
        this.context.push(message);
        // Keep last 10 messages
        if (this.context.length > 10) {
            this.context = this.context.slice(-10);
        }
    }

    setOpen(isOpen) {
        this.isOpen = isOpen;
        if (isOpen) {
            this.unreadCount = 0;
        }
    }

    incrementUnread() {
        if (!this.isOpen) {
            this.unreadCount++;
        }
        return this.unreadCount;
    }

    getUnreadCount() {
        return this.unreadCount;
    }

    reset() {
        this.context = [];
        this.unreadCount = 0;
    }
}
```

### src/modules/chat/ChatService.js

```javascript
/**
 * Handles API communication for chat
 * @class
 */
export class ChatService {
    constructor(config) {
        this.config = config;
        this.abortController = null;
    }

    /**
     * Send message to backend
     * @param {string} message
     * @param {Array} context
     * @returns {Promise<{message: string, context: Array}>}
     */
    async sendMessage(message, context = []) {
        // Cancel previous request if exists
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                context,
                timestamp: Date.now(),
            }),
            signal: this.abortController.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Check service health
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            const response = await fetch(this.config.endpoint, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
```

### src/modules/chat/ChatUI.js

```javascript
/**
 * Handles chat UI rendering
 * @class
 */
export class ChatUI {
    constructor(state, config) {
        this.state = state;
        this.config = config;
        this.elements = {};
    }

    async render() {
        const container =
            document.getElementById('chat-container') || this.createContainer();

        container.innerHTML = `
      <div class="chat-widget" id="chat-widget">
        <button class="chat-toggle" id="chat-toggle" aria-label="Abrir chat">
          <span class="chat-icon">💬</span>
          <span class="chat-badge" id="chat-badge"></span>
        </button>
        <div class="chat-window" id="chat-window" hidden>
          <div class="chat-header">
            <span>Asistente Virtual</span>
            <button class="chat-close" id="chat-close" aria-label="Cerrar">×</button>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-typing" id="chat-typing" hidden>
            <span></span><span></span><span></span>
          </div>
          <div class="chat-input-container">
            <textarea 
              id="chat-input" 
              placeholder="Escribe tu mensaje..."
              rows="1"
              aria-label="Mensaje"
            ></textarea>
            <button id="chat-send" aria-label="Enviar">➤</button>
          </div>
        </div>
      </div>
    `;

        this.cacheElements();
        this.attachEventListeners();
    }

    createContainer() {
        const div = document.createElement('div');
        div.id = 'chat-container';
        document.body.appendChild(div);
        return div;
    }

    cacheElements() {
        this.elements = {
            widget: document.getElementById('chat-widget'),
            toggle: document.getElementById('chat-toggle'),
            window: document.getElementById('chat-window'),
            close: document.getElementById('chat-close'),
            messages: document.getElementById('chat-messages'),
            input: document.getElementById('chat-input'),
            send: document.getElementById('chat-send'),
            typing: document.getElementById('chat-typing'),
            badge: document.getElementById('chat-badge'),
        };
    }

    attachEventListeners() {
        this.elements.toggle.addEventListener('click', () => this.open());
        this.elements.close.addEventListener('click', () => this.close());
    }

    open() {
        this.elements.window.hidden = false;
        this.elements.toggle.hidden = true;
        this.state.setOpen(true);
        this.updateBadge();
        this.elements.input.focus();
    }

    close() {
        this.elements.window.hidden = true;
        this.elements.toggle.hidden = false;
        this.state.setOpen(false);
    }

    toggle() {
        if (this.elements.window.hidden) {
            this.open();
        } else {
            this.close();
        }
    }

    isOpen() {
        return !this.elements.window.hidden;
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message chat-message--${role}`;
        messageDiv.innerHTML = `
      <div class="chat-message__content">${this.escapeHtml(content)}</div>
      <div class="chat-message__time">${this.formatTime()}</div>
    `;
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    renderHistory(history) {
        this.elements.messages.innerHTML = '';
        history.forEach((msg) => {
            this.addMessage(msg.role, msg.content);
        });
    }

    showTyping() {
        this.elements.typing.hidden = false;
        this.scrollToBottom();
    }

    hideTyping() {
        this.elements.typing.hidden = true;
    }

    updateBadge() {
        const count = this.state.getUnreadCount();
        this.elements.badge.textContent = count > 0 ? count : '';
        this.elements.badge.hidden = count === 0;
    }

    getInput() {
        return this.elements.input;
    }

    getSendButton() {
        return this.elements.send;
    }

    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime() {
        return new Date().toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    destroy() {
        if (this.elements.widget) {
            this.elements.widget.remove();
        }
    }
}
```

---

## TAREA 2.2: Optimizar index.html

### data/sections.json

```json
{
    "meta": {
        "title": "Dermatología Especializada en Quito | Piel en Armonía",
        "description": "Clínica dermatológica en Quito con consulta presencial y telemedicina. Especialistas en tratamientos faciales, láser y más.",
        "keywords": "dermatología, quito, tratamientos faciales, láser, acné"
    },
    "hero": {
        "title": "Dermatología Especializada en Quito",
        "subtitle": "Tu piel en las mejores manos. Tratamientos personalizados con tecnología de vanguardia.",
        "cta": {
            "text": "Reserva tu cita",
            "link": "#booking"
        },
        "image": {
            "src": "/hero-woman-800.jpg",
            "srcset": "/hero-woman-400.jpg 400w, /hero-woman-800.jpg 800w, /hero-woman-1200.jpg 1200w",
            "alt": "Dermatóloga atendiendo paciente"
        }
    },
    "services": {
        "title": "Nuestros Servicios",
        "items": [
            {
                "id": "facial",
                "name": "Tratamientos Faciales",
                "description": "Limpiezas, hidrataciones, anti-aging",
                "icon": "✨",
                "link": "/servicios/facial"
            },
            {
                "id": "laser",
                "name": "Láser Dermatológico",
                "description": "Manchas, cicatrices, rejuvenecimiento",
                "icon": "",
                "link": "/servicios/laser"
            },
            {
                "id": "acne",
                "name": "Tratamiento de Acné",
                "description": "Protocolos personalizados",
                "icon": "🌟",
                "link": "/servicios/acne"
            }
        ]
    },
    "doctors": {
        "title": "Nuestros Especialistas",
        "items": [
            {
                "name": "Dr. Javier Rosero",
                "specialty": "Dermatología Clínica",
                "image": "/doctors/javier-rosero.jpg"
            },
            {
                "name": "Dra. Carolina Narváez",
                "specialty": "Dermatología Estética",
                "image": "/doctors/carolina-narvaez.jpg"
            }
        ]
    },
    "testimonials": {
        "title": "Lo que dicen nuestros pacientes",
        "items": [
            {
                "name": "María G.",
                "text": "Excelente atención, mi piel nunca había estado mejor.",
                "rating": 5
            }
        ]
    }
}
```

### src/content-loader.js

```javascript
/**
 * Dynamic content loader for sections
 */

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let sectionsCache = null;
let cacheTime = 0;

/**
 * Load sections data from JSON
 * @returns {Promise<Object>}
 */
export async function loadSections() {
    // Return cached if valid
    if (sectionsCache && Date.now() - cacheTime < CACHE_DURATION) {
        return sectionsCache;
    }

    try {
        const response = await fetch('/data/sections.json', {
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to load sections');

        sectionsCache = await response.json();
        cacheTime = Date.now();
        return sectionsCache;
    } catch (error) {
        console.error('Content load error:', error);
        return getFallbackContent();
    }
}

/**
 * Load a specific section
 * @param {string} sectionName
 * @returns {Promise<Object>}
 */
export async function loadSection(sectionName) {
    const sections = await loadSections();
    return sections[sectionName] || null;
}

/**
 * Render a template with data
 * @param {string} templateId
 * @param {Object} data
 * @returns {string}
 */
export function renderTemplate(templateId, data) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.warn(`Template ${templateId} not found`);
        return '';
    }

    let html = template.innerHTML;

    // Replace {{key}} with data
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? escapeHtml(String(data[key])) : '';
    });

    // Replace {{#array}}...{{/array}} for loops
    html = html.replace(
        /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
        (match, key, inner) => {
            const arr = data[key];
            if (!Array.isArray(arr)) return '';
            return arr
                .map((item) => renderTemplateString(inner, item))
                .join('');
        }
    );

    return html;
}

function renderTemplateString(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? escapeHtml(String(data[key])) : '';
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFallbackContent() {
    return {
        hero: {
            title: 'Dermatología Especializada',
            subtitle: 'Tu piel en las mejores manos',
        },
        services: { title: 'Servicios', items: [] },
    };
}

/**
 * Initialize lazy loading for sections
 */
export function initLazySections() {
    const sections = document.querySelectorAll('[data-lazy-section]');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    loadLazySection(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        },
        { rootMargin: '200px' }
    );

    sections.forEach((section) => observer.observe(section));
}

async function loadLazySection(element) {
    const sectionName = element.dataset.lazySection;
    const data = await loadSection(sectionName);

    if (data) {
        const templateId = `template-${sectionName}`;
        element.innerHTML = renderTemplate(templateId, data);
        element.classList.add('loaded');
    }
}
```

---

## TAREA 3.1: Feature Flags Frontend

### src/feature-flags.js

```javascript
/**
 * Feature Flags client-side implementation
 */

class FeatureFlagsManager {
    constructor() {
        this.flags = {};
        this.userId = null;
        this.initialized = false;
    }

    /**
     * Initialize feature flags from API
     * @param {string} userId - Optional user ID for gradual rollout
     * @returns {Promise<void>}
     */
    async init(userId = null) {
        if (this.initialized) return;

        this.userId = userId || this.getAnonymousId();

        try {
            const response = await fetch('/api.php?resource=features');
            const data = await response.json();
            this.flags = data.flags || {};
            this.initialized = true;
        } catch (error) {
            console.error('Failed to load feature flags:', error);
            this.flags = {};
        }
    }

    /**
     * Check if a feature is enabled
     * @param {string} flagName
     * @param {Object} options
     * @returns {boolean}
     */
    isEnabled(flagName, options = {}) {
        if (!this.initialized) {
            console.warn('Feature flags not initialized');
            return false;
        }

        const flag = this.flags[flagName];
        if (!flag) return false;
        if (!flag.enabled) return false;

        // Check user-specific override
        if (options.userId && flag.users) {
            if (flag.users.includes(options.userId)) return true;
            if (flag.excludedUsers?.includes(options.userId)) return false;
        }

        // Gradual rollout based on percentage
        if (flag.percentage !== undefined && flag.percentage < 100) {
            const userHash = this.hashCode(options.userId || this.userId);
            const userPercent = userHash % 100;
            return userPercent < flag.percentage;
        }

        return true;
    }

    /**
     * Get all enabled flags
     * @returns {string[]}
     */
    getEnabledFlags() {
        return Object.entries(this.flags)
            .filter(([name, flag]) => this.isEnabled(name))
            .map(([name]) => name);
    }

    /**
     * Watch for flag changes (polling)
     * @param {Function} callback
     * @param {number} intervalMs
     */
    watch(callback, intervalMs = 60000) {
        const check = async () => {
            const oldFlags = { ...this.flags };
            await this.init(this.userId);

            const changed = Object.keys(this.flags).filter((key) => {
                return (
                    JSON.stringify(oldFlags[key]) !==
                    JSON.stringify(this.flags[key])
                );
            });

            if (changed.length > 0) {
                callback(changed, this.flags);
            }
        };

        setInterval(check, intervalMs);
    }

    getAnonymousId() {
        let id = localStorage.getItem('pa_anonymous_id');
        if (!id) {
            id = 'anon_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('pa_anonymous_id', id);
        }
        return id;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

// Singleton instance
export const FeatureFlags = new FeatureFlagsManager();

// React/Vue hook style helper
export function useFeature(flagName, options = {}) {
    return FeatureFlags.isEnabled(flagName, options);
}
```

### Uso en HTML

```html
<script type="module">
    import { FeatureFlags } from './src/feature-flags.js';

    await FeatureFlags.init();

    // Conditionally render features
    if (FeatureFlags.isEnabled('new_booking_ui')) {
        document.getElementById('legacy-booking').hidden = true;
        document.getElementById('new-booking').hidden = false;
    }

    // Gradual rollout: 20% de usuarios ven el nuevo chatbot
    if (FeatureFlags.isEnabled('gpt_chatbot', { userId: user.id })) {
        initGPTChatbot();
    } else {
        initLegacyChatbot();
    }
</script>
```

---

_Todos los snippets están listos para copiar y adaptar._
_Verificar rutas y nombres de archivos según estructura del proyecto._
