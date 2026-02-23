
export class ChatUIEngine {
    constructor() {
        this.deps = null;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    getChatHistory() {
        if (this.deps && typeof this.deps.getChatHistory === 'function') {
            return this.deps.getChatHistory();
        }
        return [];
    }

    setChatHistory(nextHistory) {
        if (this.deps && typeof this.deps.setChatHistory === 'function') {
            this.deps.setChatHistory(nextHistory);
        }
    }

    getConversationContext() {
        if (this.deps && typeof this.deps.getConversationContext === 'function') {
            const context = this.deps.getConversationContext();
            return Array.isArray(context) ? context : [];
        }
        return [];
    }

    setConversationContext(nextContext) {
        if (this.deps && typeof this.deps.setConversationContext === 'function') {
            this.deps.setConversationContext(nextContext);
        }
    }

    getHistoryStorageKey() {
        if (
            this.deps &&
            typeof this.deps.historyStorageKey === 'string' &&
            this.deps.historyStorageKey
        ) {
            return this.deps.historyStorageKey;
        }
        return 'chatHistory';
    }

    getHistoryTtlMs() {
        const ttl = Number(this.deps && this.deps.historyTtlMs);
        return Number.isFinite(ttl) && ttl > 0 ? ttl : 24 * 60 * 60 * 1000;
    }

    getHistoryMaxItems() {
        const max = Number(this.deps && this.deps.historyMaxItems);
        return Number.isFinite(max) && max > 0 ? Math.floor(max) : 50;
    }

    getContextMaxItems() {
        const max = Number(this.deps && this.deps.contextMaxItems);
        return Number.isFinite(max) && max > 0 ? Math.floor(max) : 24;
    }

    pruneChatHistory(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }

        const cutoff = Date.now() - this.getHistoryTtlMs();
        const filtered = entries.filter((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }
            const ts = entry.time ? new Date(entry.time).getTime() : Number.NaN;
            return Number.isFinite(ts) && ts > cutoff;
        });

        const maxItems = this.getHistoryMaxItems();
        if (filtered.length <= maxItems) {
            return filtered;
        }

        return filtered.slice(-maxItems);
    }

    persistChatHistory() {
        try {
            localStorage.setItem(
                this.getHistoryStorageKey(),
                JSON.stringify(this.getChatHistory())
            );
        } catch {
            // noop
        }
    }

    appendConversationContext(role, content) {
        const normalizedRole = String(role || '').trim();
        const normalizedContent = String(content || '').trim();
        if (!normalizedRole || !normalizedContent) {
            return;
        }

        const context = this.getConversationContext().slice();
        const last = context[context.length - 1];
        if (
            last &&
            last.role === normalizedRole &&
            last.content === normalizedContent
        ) {
            return;
        }

        context.push({
            role: normalizedRole,
            content: normalizedContent,
        });

        const maxItems = this.getContextMaxItems();
        const nextContext =
            context.length > maxItems ? context.slice(-maxItems) : context;
        this.setConversationContext(nextContext);
    }

    debugLogSafe(...args) {
        if (this.deps && typeof this.deps.debugLog === 'function') {
            this.deps.debugLog(...args);
        }
    }

    escapeHtml(text) {
        if (this.deps && typeof this.deps.escapeHtml === 'function') {
            return this.deps.escapeHtml(text);
        }
        if (typeof document !== 'undefined') {
            const div = document.createElement('div');
            div.textContent = String(text || '');
            return div.innerHTML;
        }
        return String(text || '');
    }

    sanitizeBotHtml(html) {
        const allowed = [
            'b',
            'strong',
            'i',
            'em',
            'br',
            'p',
            'ul',
            'ol',
            'li',
            'a',
            'div',
            'button',
            'input',
            'span',
            'small',
        ];
        const allowedAttrs = {
            a: ['href', 'target', 'rel'],
            button: ['class', 'data-action'],
            div: ['class'],
            input: ['type', 'id', 'min', 'value', 'class'],
            i: ['class'],
            span: ['class'],
            small: ['class'],
        };

        const safeHtml = String(html || '')
            .replace(
                /onclick="handleChatBookingSelection\('([^']+)'\)"/g,
                'data-action="chat-booking" data-value="$1"'
            )
            .replace(
                /onclick="sendQuickMessage\('([^']+)'\)"/g,
                'data-action="quick-message" data-value="$1"'
            )
            .replace(
                /onclick="handleChatDateSelect\(this\.value\)"/g,
                'data-action="chat-date-select"'
            )
            .replace(
                /onclick="minimizeChatbot\(\)"/g,
                'data-action="minimize-chat"'
            )
            .replace(
                /onclick="startChatBooking\(\)"/g,
                'data-action="start-booking"'
            );

        if (typeof document === 'undefined') return safeHtml;

        const container = document.createElement('div');
        container.innerHTML = safeHtml;
        container
            .querySelectorAll('script, style, iframe, object, embed')
            .forEach((el) => el.remove());
        container.querySelectorAll('*').forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (!allowed.includes(tag)) {
                el.replaceWith(document.createTextNode(el.textContent || ''));
                return;
            }

            const keep = (allowedAttrs[tag] || []).concat([
                'data-action',
                'data-value',
            ]);
            Array.from(el.attributes).forEach((attr) => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });

            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) {
                    el.removeAttribute('href');
                }
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }

            Array.from(el.attributes).forEach((attr) => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return container.innerHTML;
    }

    scrollToBottom() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatMessages');
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }

    addUserMessage(text) {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user"></i></div>
            <div class="message-content"><p>${this.escapeHtml(text)}</p></div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        const entry = { type: 'user', text, time: new Date().toISOString() };
        const nextHistory = this.pruneChatHistory(this.getChatHistory().concat(entry));
        this.setChatHistory(nextHistory);
        this.persistChatHistory();
        this.appendConversationContext('user', text);
    }

    addBotMessage(html, showOfflineLabel) {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const safeHtml = this.sanitizeBotHtml(html);
        const lastMessage = messagesContainer.querySelector(
            '.chat-message.bot:last-child'
        );
        if (lastMessage) {
            const lastContent = lastMessage.querySelector('.message-content');
            if (lastContent && lastContent.innerHTML === safeHtml) {
                this.debugLogSafe('Mensaje duplicado detectado, no se muestra');
                return;
            }
        }

        const offlineIndicator = showOfflineLabel
            ? '<div class="chatbot-offline-badge"><i class="fas fa-robot"></i> Asistente Virtual</div>'
            : '';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user-md"></i></div>
            <div class="message-content">${offlineIndicator}${safeHtml}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        const entry = {
            type: 'bot',
            text: safeHtml,
            time: new Date().toISOString(),
        };
        const nextHistory = this.pruneChatHistory(this.getChatHistory().concat(entry));
        this.setChatHistory(nextHistory);
        this.persistChatHistory();
    }

    showTypingIndicator() {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer || document.getElementById('typingIndicator')) {
            return;
        }

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user-md"></i></div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        if (typeof document === 'undefined') return;
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }
}
