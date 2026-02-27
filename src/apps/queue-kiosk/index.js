const API_ENDPOINT = '/api.php';
const CHAT_ENDPOINT = '/figo-chat.php';
const QUEUE_POLL_MS = 2500;
const QUEUE_POLL_MAX_MS = 15000;
const QUEUE_STALE_THRESHOLD_MS = 30000;
const THEME_STORAGE_KEY = 'kioskThemeMode';
const KIOSK_IDLE_RESET_DEFAULT_MS = 90000;
const KIOSK_IDLE_RESET_MIN_MS = 5000;
const KIOSK_IDLE_RESET_MAX_MS = 15 * 60 * 1000;
const KIOSK_IDLE_WARNING_MS = 20000;
const KIOSK_IDLE_POSTPONE_MS = 15000;
const KIOSK_IDLE_TICK_MS = 1000;
const ASSISTANT_WELCOME_TEXT =
    'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.';

const state = {
    queueState: null,
    chatHistory: [],
    assistantBusy: false,
    queueTimerId: 0,
    queuePollingEnabled: false,
    queueFailureStreak: 0,
    queueRefreshBusy: false,
    queueManualRefreshBusy: false,
    queueLastHealthySyncAt: 0,
    themeMode: 'system',
    mediaQuery: null,
    idleTimerId: 0,
    idleTickId: 0,
    idleDeadlineTs: 0,
    idleResetMs: KIOSK_IDLE_RESET_DEFAULT_MS,
};

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getById(id) {
    return document.getElementById(id);
}

async function apiRequest(resource, { method = 'GET', body } = {}) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    params.set('t', String(Date.now()));
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let payload;
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (_error) {
        throw new Error('Respuesta invalida del servidor');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function deriveInitials(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return '';

    const words = name
        .toUpperCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Z]/g, ''))
        .filter(Boolean);

    if (words.length === 0) return '';

    let initials = '';
    for (const word of words) {
        initials += word.slice(0, 1);
        if (initials.length >= 3) break;
    }
    return initials.slice(0, 4);
}

function setKioskStatus(message, type = 'info') {
    const el = getById('kioskStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.status = type;
}

function setQueueConnectionStatus(stateLabel, message) {
    const el = getById('queueConnectionState');
    if (!el) return;

    const normalized = String(stateLabel || 'live').toLowerCase();
    const fallbackByState = {
        live: 'Cola conectada',
        reconnecting: 'Reintentando conexion',
        offline: 'Sin conexion al backend',
        paused: 'Cola en pausa',
    };

    el.dataset.state = normalized;
    el.textContent =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;
}

function resolveIdleResetMs() {
    const overrideMs = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS);
    const rawMs = Number.isFinite(overrideMs)
        ? overrideMs
        : KIOSK_IDLE_RESET_DEFAULT_MS;
    return Math.min(
        KIOSK_IDLE_RESET_MAX_MS,
        Math.max(KIOSK_IDLE_RESET_MIN_MS, Math.round(rawMs))
    );
}

function formatCountdownMs(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
}

function ensureSessionGuard() {
    let guard = getById('kioskSessionGuard');
    if (guard instanceof HTMLElement) {
        return guard;
    }

    const statusEl = getById('kioskStatus');
    if (!(statusEl instanceof HTMLElement)) return null;

    guard = document.createElement('div');
    guard.id = 'kioskSessionGuard';
    guard.style.display = 'flex';
    guard.style.flexWrap = 'wrap';
    guard.style.alignItems = 'center';
    guard.style.gap = '0.55rem';
    guard.style.marginBottom = '0.85rem';

    const countdown = document.createElement('span');
    countdown.id = 'kioskSessionCountdown';
    countdown.textContent = 'Privacidad auto: --:--';
    countdown.style.display = 'inline-flex';
    countdown.style.alignItems = 'center';
    countdown.style.padding = '0.2rem 0.55rem';
    countdown.style.border = '1px solid var(--border)';
    countdown.style.borderRadius = '999px';
    countdown.style.background = 'var(--surface-soft)';
    countdown.style.color = 'var(--muted)';
    countdown.style.fontSize = '0.82rem';

    const resetButton = document.createElement('button');
    resetButton.id = 'kioskSessionResetBtn';
    resetButton.type = 'button';
    resetButton.textContent = 'Nueva persona / limpiar pantalla';
    resetButton.style.border = '1px solid var(--border)';
    resetButton.style.borderRadius = '0.65rem';
    resetButton.style.padding = '0.38rem 0.62rem';
    resetButton.style.background = 'var(--surface-soft)';
    resetButton.style.color = 'var(--text)';
    resetButton.style.cursor = 'pointer';

    guard.appendChild(countdown);
    guard.appendChild(resetButton);
    statusEl.insertAdjacentElement('afterend', guard);
    return guard;
}

function renderIdleCountdown() {
    const countdown = getById('kioskSessionCountdown');
    if (!(countdown instanceof HTMLElement)) return;

    if (!state.idleDeadlineTs) {
        countdown.textContent = 'Privacidad auto: --:--';
        countdown.dataset.state = 'normal';
        countdown.style.color = 'var(--muted)';
        countdown.style.borderColor = 'var(--border)';
        return;
    }

    const remainingMs = Math.max(0, state.idleDeadlineTs - Date.now());
    countdown.textContent = `Privacidad auto: ${formatCountdownMs(remainingMs)}`;
    const warning = remainingMs <= KIOSK_IDLE_WARNING_MS;
    countdown.dataset.state = warning ? 'warning' : 'normal';
    countdown.style.color = warning ? 'var(--danger)' : 'var(--muted)';
    countdown.style.borderColor = warning ? 'var(--danger)' : 'var(--border)';
}

function clearIdleTimers() {
    if (state.idleTimerId) {
        window.clearTimeout(state.idleTimerId);
        state.idleTimerId = 0;
    }
    if (state.idleTickId) {
        window.clearInterval(state.idleTickId);
        state.idleTickId = 0;
    }
}

function renderTicketEmptyState() {
    const container = getById('ticketResult');
    if (!container) return;
    container.innerHTML =
        '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>';
}

function resetAssistantConversation() {
    const assistantMessages = getById('assistantMessages');
    if (assistantMessages) {
        assistantMessages.innerHTML = '';
    }
    state.chatHistory = [];
    appendAssistantMessage('bot', ASSISTANT_WELCOME_TEXT);

    const assistantInput = getById('assistantInput');
    if (assistantInput instanceof HTMLInputElement) {
        assistantInput.value = '';
    }
}

function resetKioskForms() {
    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    if (checkinForm instanceof HTMLFormElement) {
        checkinForm.reset();
    }
    if (walkinForm instanceof HTMLFormElement) {
        walkinForm.reset();
    }
    initDefaultDate();
}

function beginIdleSessionGuard({ durationMs = null } = {}) {
    const resolvedDuration = Math.min(
        KIOSK_IDLE_RESET_MAX_MS,
        Math.max(
            KIOSK_IDLE_RESET_MIN_MS,
            Math.round(
                Number.isFinite(Number(durationMs))
                    ? Number(durationMs)
                    : state.idleResetMs
            )
        )
    );

    clearIdleTimers();
    state.idleDeadlineTs = Date.now() + resolvedDuration;
    renderIdleCountdown();

    state.idleTickId = window.setInterval(() => {
        renderIdleCountdown();
    }, KIOSK_IDLE_TICK_MS);

    state.idleTimerId = window.setTimeout(() => {
        const busyNow = state.assistantBusy || state.queueManualRefreshBusy;
        if (busyNow) {
            setKioskStatus(
                'Sesion activa. Reprogramando limpieza automatica.',
                'info'
            );
            beginIdleSessionGuard({ durationMs: KIOSK_IDLE_POSTPONE_MS });
            return;
        }
        resetKioskSession({ reason: 'idle_timeout' });
    }, resolvedDuration);
}

function registerKioskActivity() {
    beginIdleSessionGuard();
}

function resetKioskSession({ reason = 'manual' } = {}) {
    resetKioskForms();
    resetAssistantConversation();
    renderTicketEmptyState();

    const reasonText =
        reason === 'idle_timeout'
            ? 'Sesion reiniciada por inactividad para proteger privacidad.'
            : 'Pantalla limpiada. Lista para el siguiente paciente.';
    setKioskStatus(reasonText, 'info');
    beginIdleSessionGuard();
}

function ensureQueueOpsHintEl() {
    let el = getById('queueOpsHint');
    if (el) return el;

    const queueCard = document.querySelector('.kiosk-side .kiosk-card');
    const queueUpdatedAt = getById('queueUpdatedAt');
    if (!queueCard || !queueUpdatedAt) return null;

    el = document.createElement('p');
    el.id = 'queueOpsHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Estado operativo: inicializando...';
    queueUpdatedAt.insertAdjacentElement('afterend', el);
    return el;
}

function setQueueOpsHint(message) {
    const el = ensureQueueOpsHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Estado operativo';
}

function ensureQueueManualRefreshButton() {
    let button = getById('queueManualRefreshBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const queueUpdatedAt = getById('queueUpdatedAt');
    if (!queueUpdatedAt?.parentElement) return null;

    button = document.createElement('button');
    button.id = 'queueManualRefreshBtn';
    button.type = 'button';
    button.textContent = 'Reintentar sincronizacion';
    button.style.margin = '0.25rem 0 0.55rem';
    button.style.border = '1px solid var(--border)';
    button.style.borderRadius = '0.6rem';
    button.style.padding = '0.42rem 0.62rem';
    button.style.background = 'var(--surface-soft)';
    button.style.color = 'var(--text)';
    button.style.cursor = 'pointer';
    queueUpdatedAt.insertAdjacentElement('afterend', button);
    return button;
}

function setQueueManualRefreshLoading(isLoading) {
    const button = ensureQueueManualRefreshButton();
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading
        ? 'Actualizando cola...'
        : 'Reintentar sincronizacion';
}

function formatElapsedAge(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const seconds = Math.round(safeMs / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (remSeconds <= 0) {
        return `${minutes}m`;
    }
    return `${minutes}m ${remSeconds}s`;
}

function formatLastHealthySyncAge() {
    if (!state.queueLastHealthySyncAt) {
        return 'sin sincronizacion confirmada';
    }
    return `hace ${formatElapsedAge(Date.now() - state.queueLastHealthySyncAt)}`;
}

function evaluateQueueFreshness(queueState) {
    const updatedAtTs = Date.parse(String(queueState?.updatedAt || ''));
    if (!Number.isFinite(updatedAtTs)) {
        return {
            stale: false,
            missingTimestamp: true,
            ageMs: null,
        };
    }

    const ageMs = Math.max(0, Date.now() - updatedAtTs);
    return {
        stale: ageMs >= QUEUE_STALE_THRESHOLD_MS,
        missingTimestamp: false,
        ageMs,
    };
}

function renderQueueUpdatedAt(updatedAt) {
    const el = getById('queueUpdatedAt');
    if (!el) return;
    const ts = Date.parse(String(updatedAt || ''));
    if (!Number.isFinite(ts)) {
        el.textContent = 'Actualizacion pendiente';
        return;
    }
    el.textContent = `Actualizado ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })}`;
}

function getQueuePollDelayMs() {
    const attempts = Math.max(0, Number(state.queueFailureStreak || 0));
    const delay = QUEUE_POLL_MS * Math.pow(2, Math.min(attempts, 3));
    return Math.min(QUEUE_POLL_MAX_MS, delay);
}

function clearQueuePollTimer() {
    if (!state.queueTimerId) return;
    window.clearTimeout(state.queueTimerId);
    state.queueTimerId = 0;
}

function formatIsoDateTime(iso) {
    const ts = Date.parse(String(iso || ''));
    if (!Number.isFinite(ts)) {
        return '--';
    }
    return new Date(ts).toLocaleString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });
}

function renderQueuePanel(queueState) {
    const waitingCountEl = getById('queueWaitingCount');
    const calledCountEl = getById('queueCalledCount');
    const callingNowEl = getById('queueCallingNow');
    const nextListEl = getById('queueNextList');

    if (waitingCountEl) {
        waitingCountEl.textContent = String(queueState?.waitingCount || 0);
    }
    if (calledCountEl) {
        calledCountEl.textContent = String(queueState?.calledCount || 0);
    }

    if (callingNowEl) {
        const callingNow = Array.isArray(queueState?.callingNow)
            ? queueState.callingNow
            : [];
        if (callingNow.length === 0) {
            callingNowEl.innerHTML =
                '<p class="queue-empty">Sin llamados activos.</p>';
        } else {
            callingNowEl.innerHTML = callingNow
                .map(
                    (ticket) => `
                        <article class="queue-called-card">
                            <header>Consultorio ${escapeHtml(ticket.assignedConsultorio)}</header>
                            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
                        </article>
                    `
                )
                .join('');
        }
    }

    if (nextListEl) {
        const nextTickets = Array.isArray(queueState?.nextTickets)
            ? queueState.nextTickets
            : [];
        if (nextTickets.length === 0) {
            nextListEl.innerHTML =
                '<li class="queue-empty">No hay turnos en espera.</li>';
        } else {
            nextListEl.innerHTML = nextTickets
                .map(
                    (ticket) => `
                        <li>
                            <span class="ticket-code">${escapeHtml(ticket.ticketCode || '--')}</span>
                            <span class="ticket-meta">${escapeHtml(ticket.patientInitials || '--')}</span>
                            <span class="ticket-position">#${escapeHtml(ticket.position || '-')}</span>
                        </li>
                    `
                )
                .join('');
        }
    }
}

async function refreshQueueState() {
    if (state.queueRefreshBusy) {
        return { ok: false, stale: false, reason: 'busy' };
    }
    state.queueRefreshBusy = true;
    try {
        const payload = await apiRequest('queue-state');
        state.queueState = payload.data || {};
        renderQueuePanel(state.queueState);
        renderQueueUpdatedAt(state.queueState?.updatedAt);
        const freshness = evaluateQueueFreshness(state.queueState);
        return {
            ok: true,
            stale: Boolean(freshness.stale),
            missingTimestamp: Boolean(freshness.missingTimestamp),
            ageMs: freshness.ageMs,
        };
    } catch (error) {
        return {
            ok: false,
            stale: false,
            reason: 'fetch_error',
            errorMessage: error.message,
        };
    } finally {
        state.queueRefreshBusy = false;
    }
}

function renderTicketResult(payload, originLabel) {
    const container = getById('ticketResult');
    if (!container) return;

    const ticket = payload?.data || {};
    const print = payload?.print || {};
    const nextTickets = Array.isArray(state.queueState?.nextTickets)
        ? state.queueState.nextTickets
        : [];
    const currentPosition =
        nextTickets.find((item) => Number(item.id) === Number(ticket.id))
            ?.position || '-';

    const printState = payload?.printed
        ? 'Impresion enviada a termica'
        : `Ticket generado sin impresion (${escapeHtml(print.message || 'sin detalle')})`;

    container.innerHTML = `
        <article class="ticket-result-card">
            <h3>Turno generado</h3>
            <p class="ticket-result-origin">${escapeHtml(originLabel)}</p>
            <div class="ticket-result-main">
                <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                <span>${escapeHtml(ticket.patientInitials || '--')}</span>
            </div>
            <dl>
                <div><dt>Posicion</dt><dd>#${escapeHtml(currentPosition)}</dd></div>
                <div><dt>Tipo</dt><dd>${escapeHtml(ticket.queueType || '--')}</dd></div>
                <div><dt>Creado</dt><dd>${escapeHtml(formatIsoDateTime(ticket.createdAt))}</dd></div>
            </dl>
            <p class="ticket-result-print">${printState}</p>
        </article>
    `;
}

async function submitCheckin(event) {
    event.preventDefault();
    registerKioskActivity();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const phoneInput = getById('checkinPhone');
    const timeInput = getById('checkinTime');
    const dateInput = getById('checkinDate');
    const initialsInput = getById('checkinInitials');
    const submitBtn = getById('checkinSubmit');

    const phone =
        phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
    const time =
        timeInput instanceof HTMLInputElement ? timeInput.value.trim() : '';
    const date =
        dateInput instanceof HTMLInputElement ? dateInput.value.trim() : '';
    const patientInitials =
        initialsInput instanceof HTMLInputElement
            ? initialsInput.value.trim()
            : '';

    if (!phone || !time || !date) {
        setKioskStatus(
            'Telefono, fecha y hora son obligatorios para check-in',
            'error'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const payload = await apiRequest('queue-checkin', {
            method: 'POST',
            body: {
                telefono: phone,
                hora: time,
                fecha: date,
                patientInitials,
            },
        });
        setKioskStatus('Check-in registrado correctamente', 'success');
        renderTicketResult(
            payload,
            payload.replay ? 'Check-in ya existente' : 'Check-in de cita'
        );
        state.queueFailureStreak = 0;
        const refreshResult = await refreshQueueState();
        if (!refreshResult.ok) {
            setQueueConnectionStatus(
                'reconnecting',
                'Check-in registrado; pendiente sincronizar cola'
            );
        }
    } catch (error) {
        setKioskStatus(
            `No se pudo registrar el check-in: ${error.message}`,
            'error'
        );
    } finally {
        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
        }
    }
}

async function submitWalkIn(event) {
    event.preventDefault();
    registerKioskActivity();
    const nameInput = getById('walkinName');
    const initialsInput = getById('walkinInitials');
    const phoneInput = getById('walkinPhone');
    const submitBtn = getById('walkinSubmit');

    const name =
        nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
    const initialsRaw =
        initialsInput instanceof HTMLInputElement
            ? initialsInput.value.trim()
            : '';
    const patientInitials = initialsRaw || deriveInitials(name);
    const phone =
        phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';

    if (!patientInitials) {
        setKioskStatus(
            'Ingresa iniciales o nombre para generar el turno',
            'error'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const payload = await apiRequest('queue-ticket', {
            method: 'POST',
            body: {
                patientInitials,
                name,
                phone,
            },
        });
        setKioskStatus('Turno walk-in registrado correctamente', 'success');
        renderTicketResult(payload, 'Turno sin cita');
        state.queueFailureStreak = 0;
        const refreshResult = await refreshQueueState();
        if (!refreshResult.ok) {
            setQueueConnectionStatus(
                'reconnecting',
                'Turno creado; pendiente sincronizar cola'
            );
        }
    } catch (error) {
        setKioskStatus(`No se pudo crear el turno: ${error.message}`, 'error');
    } finally {
        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
        }
    }
}

function assistantGuard(text) {
    const normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (
        /(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(
            normalized
        )
    ) {
        return 'En este kiosco solo puedo ayudarte con turnos y orientacion de sala. Para consulta medica, acude a recepcion.';
    }

    const trimmed = String(text || '').trim();
    if (!trimmed) {
        return 'Puedo ayudarte con turnos, check-in y ubicacion de consultorios.';
    }

    return trimmed;
}

function appendAssistantMessage(role, content) {
    const list = getById('assistantMessages');
    if (!list) return;
    const item = document.createElement('article');
    item.className = `assistant-message assistant-message-${role}`;
    item.innerHTML = `<p>${escapeHtml(content)}</p>`;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
}

async function submitAssistant(event) {
    event.preventDefault();
    registerKioskActivity();
    if (state.assistantBusy) return;

    const input = getById('assistantInput');
    const sendBtn = getById('assistantSend');
    if (!(input instanceof HTMLInputElement)) return;

    const text = input.value.trim();
    if (!text) return;

    appendAssistantMessage('user', text);
    input.value = '';
    state.assistantBusy = true;
    if (sendBtn instanceof HTMLButtonElement) {
        sendBtn.disabled = true;
    }

    try {
        const messages = [
            {
                role: 'system',
                content:
                    'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
            },
            ...state.chatHistory.slice(-6),
            { role: 'user', content: text },
        ];

        const response = await fetch(`${CHAT_ENDPOINT}?t=${Date.now()}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                model: 'figo-assistant',
                source: 'kiosk_waiting_room',
                messages,
                max_tokens: 180,
                temperature: 0.2,
            }),
        });

        const payload = await response.json();
        const aiText = String(
            payload?.choices?.[0]?.message?.content || ''
        ).trim();
        const answer = assistantGuard(aiText);
        appendAssistantMessage('bot', answer);

        state.chatHistory = [
            ...state.chatHistory,
            { role: 'user', content: text },
            { role: 'assistant', content: answer },
        ].slice(-8);
    } catch (_error) {
        appendAssistantMessage(
            'bot',
            'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
        );
    } finally {
        state.assistantBusy = false;
        if (sendBtn instanceof HTMLButtonElement) {
            sendBtn.disabled = false;
        }
    }
}

function bindKioskActivitySignals() {
    const activityEvents = ['pointerdown', 'keydown', 'input', 'touchstart'];
    activityEvents.forEach((eventName) => {
        document.addEventListener(
            eventName,
            () => {
                registerKioskActivity();
            },
            true
        );
    });
}

function applyTheme(mode) {
    state.themeMode = mode;
    const root = document.documentElement;
    const prefersDark =
        state.mediaQuery instanceof MediaQueryList
            ? state.mediaQuery.matches
            : false;
    const activeMode =
        mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
    root.dataset.theme = activeMode;

    document.querySelectorAll('[data-theme-mode]').forEach((button) => {
        const buttonMode = button.getAttribute('data-theme-mode');
        button.classList.toggle('is-active', buttonMode === mode);
        button.setAttribute('aria-pressed', String(buttonMode === mode));
    });
}

function setTheme(mode) {
    const normalized = ['light', 'dark', 'system'].includes(mode)
        ? mode
        : 'system';
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
    applyTheme(normalized);
}

function initTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    state.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    state.mediaQuery.addEventListener('change', () => {
        if (state.themeMode === 'system') {
            applyTheme('system');
        }
    });

    document.querySelectorAll('[data-theme-mode]').forEach((button) => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-theme-mode') || 'system';
            setTheme(mode);
        });
    });

    applyTheme(stored);
}

function initDefaultDate() {
    const dateInput = getById('checkinDate');
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
}

function scheduleQueuePolling({ immediate = false } = {}) {
    clearQueuePollTimer();
    if (!state.queuePollingEnabled) return;
    const delay = immediate ? 0 : getQueuePollDelayMs();
    state.queueTimerId = window.setTimeout(() => {
        void runQueuePollingTick();
    }, delay);
}

async function runQueuePollingTick() {
    if (!state.queuePollingEnabled) return;

    if (document.hidden) {
        setQueueConnectionStatus('paused', 'Cola en pausa (pestana oculta)');
        setQueueOpsHint('Pestana oculta. Turnero en pausa temporal.');
        scheduleQueuePolling();
        return;
    }

    if (navigator.onLine === false) {
        state.queueFailureStreak += 1;
        setQueueConnectionStatus('offline', 'Sin conexion al backend');
        setQueueOpsHint(
            'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
        );
        scheduleQueuePolling();
        return;
    }

    const refreshResult = await refreshQueueState();
    if (refreshResult.ok && !refreshResult.stale) {
        state.queueFailureStreak = 0;
        state.queueLastHealthySyncAt = Date.now();
        setQueueConnectionStatus('live', 'Cola conectada');
        setQueueOpsHint(
            `Operacion estable (${formatLastHealthySyncAge()}). Kiosco disponible para turnos.`
        );
    } else if (refreshResult.ok && refreshResult.stale) {
        state.queueFailureStreak += 1;
        const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
        setQueueConnectionStatus(
            'reconnecting',
            `Watchdog: cola estancada ${staleAge}`
        );
        setQueueOpsHint(
            `Cola degradada: sin cambios en ${staleAge}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
        );
    } else {
        state.queueFailureStreak += 1;
        const retrySeconds = Math.max(
            1,
            Math.ceil(getQueuePollDelayMs() / 1000)
        );
        setQueueConnectionStatus(
            'reconnecting',
            `Reintentando en ${retrySeconds}s`
        );
        setQueueOpsHint(
            `Conexion inestable. Reintento automatico en ${retrySeconds}s.`
        );
    }
    scheduleQueuePolling();
}

async function runQueueManualRefresh() {
    if (state.queueManualRefreshBusy) return;
    registerKioskActivity();
    state.queueManualRefreshBusy = true;
    setQueueManualRefreshLoading(true);
    setQueueConnectionStatus('reconnecting', 'Refrescando manualmente...');

    try {
        const refreshResult = await refreshQueueState();
        if (refreshResult.ok && !refreshResult.stale) {
            state.queueFailureStreak = 0;
            state.queueLastHealthySyncAt = Date.now();
            setQueueConnectionStatus('live', 'Cola conectada');
            setQueueOpsHint(
                `Sincronizacion manual exitosa (${formatLastHealthySyncAge()}).`
            );
            return;
        }
        if (refreshResult.ok && refreshResult.stale) {
            const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
            setQueueConnectionStatus(
                'reconnecting',
                `Watchdog: cola estancada ${staleAge}`
            );
            setQueueOpsHint(
                `Persisten datos estancados (${staleAge}). Verifica backend o recepcion.`
            );
            return;
        }
        const retrySeconds = Math.max(
            1,
            Math.ceil(getQueuePollDelayMs() / 1000)
        );
        setQueueConnectionStatus(
            navigator.onLine === false ? 'offline' : 'reconnecting',
            navigator.onLine === false
                ? 'Sin conexion al backend'
                : `Reintentando en ${retrySeconds}s`
        );
        setQueueOpsHint(
            navigator.onLine === false
                ? 'Sin internet. Opera manualmente en recepcion.'
                : `Refresh manual sin exito. Reintento automatico en ${retrySeconds}s.`
        );
    } finally {
        state.queueManualRefreshBusy = false;
        setQueueManualRefreshLoading(false);
    }
}

function startQueuePolling({ immediate = true } = {}) {
    state.queuePollingEnabled = true;
    if (immediate) {
        setQueueConnectionStatus('live', 'Sincronizando cola...');
        void runQueuePollingTick();
        return;
    }
    scheduleQueuePolling();
}

function stopQueuePolling({ reason = 'paused' } = {}) {
    state.queuePollingEnabled = false;
    state.queueFailureStreak = 0;
    clearQueuePollTimer();

    const normalizedReason = String(reason || 'paused').toLowerCase();
    if (normalizedReason === 'offline') {
        setQueueConnectionStatus('offline', 'Sin conexion al backend');
        setQueueOpsHint(
            'Sin conexion. Esperando reconexion para reanudar cola.'
        );
        return;
    }
    if (normalizedReason === 'hidden') {
        setQueueConnectionStatus('paused', 'Cola en pausa (pestana oculta)');
        setQueueOpsHint('Pestana oculta. Reanudando al volver a primer plano.');
        return;
    }
    setQueueConnectionStatus('paused', 'Cola en pausa');
    setQueueOpsHint('Sincronizacion pausada por navegacion.');
}

function initKiosk() {
    state.idleResetMs = resolveIdleResetMs();
    initTheme();
    initDefaultDate();

    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    const assistantForm = getById('assistantForm');

    if (checkinForm instanceof HTMLFormElement) {
        checkinForm.addEventListener('submit', submitCheckin);
    }
    if (walkinForm instanceof HTMLFormElement) {
        walkinForm.addEventListener('submit', submitWalkIn);
    }
    if (assistantForm instanceof HTMLFormElement) {
        assistantForm.addEventListener('submit', submitAssistant);
    }

    ensureSessionGuard();
    const resetSessionBtn = getById('kioskSessionResetBtn');
    if (resetSessionBtn instanceof HTMLButtonElement) {
        resetSessionBtn.addEventListener('click', () => {
            resetKioskSession({ reason: 'manual' });
        });
    }

    resetAssistantConversation();
    renderTicketEmptyState();
    bindKioskActivitySignals();
    beginIdleSessionGuard();

    ensureQueueOpsHintEl();
    const manualRefreshButton = ensureQueueManualRefreshButton();
    if (manualRefreshButton instanceof HTMLButtonElement) {
        manualRefreshButton.addEventListener('click', () => {
            void runQueueManualRefresh();
        });
    }

    setQueueConnectionStatus('paused', 'Sincronizacion lista');
    setQueueOpsHint('Esperando primera sincronizacion de cola...');
    renderQueueUpdatedAt('');
    startQueuePolling({ immediate: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopQueuePolling({ reason: 'hidden' });
            return;
        }
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('online', () => {
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('offline', () => {
        stopQueuePolling({ reason: 'offline' });
    });

    window.addEventListener('beforeunload', () => {
        stopQueuePolling({ reason: 'paused' });
    });

    window.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey) return;
        const keyCode = String(event.code || '').toLowerCase();
        if (keyCode === 'keyr') {
            event.preventDefault();
            void runQueueManualRefresh();
            return;
        }
        if (keyCode === 'keyl') {
            event.preventDefault();
            resetKioskSession({ reason: 'manual' });
        }
    });
}

document.addEventListener('DOMContentLoaded', initKiosk);
