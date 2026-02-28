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
const KIOSK_OFFLINE_OUTBOX_STORAGE_KEY = 'queueKioskOfflineOutbox';
const KIOSK_OFFLINE_OUTBOX_MAX_ITEMS = 25;
const KIOSK_OFFLINE_OUTBOX_FLUSH_BATCH = 4;
const KIOSK_OFFLINE_OUTBOX_RENDER_LIMIT = 6;
const KIOSK_OFFLINE_OUTBOX_DEDUPE_MS = 90 * 1000;
const KIOSK_PRINTER_STATE_STORAGE_KEY = 'queueKioskPrinterState';
const KIOSK_STAR_STYLE_ID = 'kioskStarInlineStyles';
const KIOSK_WELCOME_HIDE_MS = 1800;
const KIOSK_WELCOME_REMOVE_MS = 2600;

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
    offlineOutbox: [],
    offlineOutboxFlushBusy: false,
    lastConnectionState: '',
    lastConnectionMessage: '',
    printerState: null,
    quickHelpOpen: false,
    selectedFlow: 'checkin',
    welcomeDismissed: false,
};

function emitQueueOpsEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'kiosk',
                    event: String(eventName || 'unknown'),
                    at: new Date().toISOString(),
                    ...detail,
                },
            })
        );
    } catch (_error) {
        // no-op
    }
}

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

function ensureKioskStarStyles() {
    if (document.getElementById(KIOSK_STAR_STYLE_ID)) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = KIOSK_STAR_STYLE_ID;
    styleEl.textContent = `
        body[data-kiosk-mode='star'] .kiosk-header {
            border-bottom-color: color-mix(in srgb, var(--primary) 18%, var(--border));
            box-shadow: 0 10px 28px rgb(15 31 54 / 10%);
        }
        .kiosk-header-tools {
            display: grid;
            gap: 0.35rem;
            justify-items: end;
        }
        .kiosk-header-help-btn {
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.34rem 0.72rem;
            background: var(--surface-soft);
            color: var(--text);
            font-size: 0.86rem;
            font-weight: 600;
            cursor: pointer;
            min-height: 44px;
        }
        .kiosk-header-help-btn[data-open='true'] {
            border-color: color-mix(in srgb, var(--primary) 38%, #fff 62%);
            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);
            color: var(--primary-strong);
        }
        .kiosk-quick-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.65rem;
            margin: 0.45rem 0 0.6rem;
        }
        .kiosk-quick-action {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 0.8rem 0.92rem;
            background: var(--surface-soft);
            color: var(--text);
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 0.01em;
            cursor: pointer;
            min-height: 64px;
            text-align: left;
        }
        .kiosk-quick-action[data-active='true'] {
            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);
            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);
            color: var(--primary-strong);
            box-shadow: 0 12px 26px rgb(15 107 220 / 14%);
        }
        .kiosk-progress-hint {
            margin: 0 0 0.72rem;
            color: var(--muted);
            font-size: 0.95rem;
            font-weight: 600;
        }
        .kiosk-progress-hint[data-tone='success'] {
            color: var(--success);
        }
        .kiosk-progress-hint[data-tone='warn'] {
            color: #9a6700;
        }
        .kiosk-quick-help-panel {
            margin: 0 0 0.9rem;
            border: 1px solid color-mix(in srgb, var(--primary) 24%, #fff 76%);
            border-radius: 16px;
            padding: 0.88rem 0.95rem;
            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);
        }
        .kiosk-quick-help-panel h2 {
            margin: 0 0 0.46rem;
            font-size: 1.08rem;
        }
        .kiosk-quick-help-panel ol {
            margin: 0 0 0.56rem;
            padding-left: 1.12rem;
            color: var(--text);
            line-height: 1.45;
        }
        .kiosk-quick-help-panel p {
            margin: 0 0 0.6rem;
            color: var(--muted);
            font-size: 0.9rem;
        }
        .kiosk-quick-help-panel button {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.46rem 0.74rem;
            background: #fff;
            color: var(--text);
            font-weight: 600;
            cursor: pointer;
            min-height: 44px;
        }
        .kiosk-form.is-flow-active {
            border-color: color-mix(in srgb, var(--primary) 32%, var(--border) 68%);
            box-shadow: 0 14px 28px rgb(15 107 220 / 11%);
        }
        .kiosk-quick-action:focus-visible,
        .kiosk-header-help-btn:focus-visible,
        .kiosk-quick-help-panel button:focus-visible {
            outline: 3px solid color-mix(in srgb, var(--primary) 62%, #fff 38%);
            outline-offset: 2px;
        }
        @media (max-width: 760px) {
            .kiosk-header-tools {
                justify-items: start;
            }
            .kiosk-quick-actions {
                grid-template-columns: 1fr;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .kiosk-quick-action,
            .kiosk-header-help-btn,
            .kiosk-form {
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function setKioskProgressHint(message, tone = 'info') {
    const hintEl = getById('kioskProgressHint');
    if (!(hintEl instanceof HTMLElement)) return;
    const normalizedTone = ['info', 'warn', 'success'].includes(
        String(tone || '').toLowerCase()
    )
        ? String(tone || '').toLowerCase()
        : 'info';
    const nextText =
        String(message || '').trim() ||
        'Paso 1 de 2: selecciona una opcion para comenzar.';
    hintEl.dataset.tone = normalizedTone;
    hintEl.textContent = nextText;
}

function setKioskHelpPanelOpen(nextOpen, { source = 'ui' } = {}) {
    const panel = getById('kioskQuickHelpPanel');
    const toggle = getById('kioskHelpToggle');
    if (
        !(panel instanceof HTMLElement) ||
        !(toggle instanceof HTMLButtonElement)
    ) {
        return;
    }

    const open = Boolean(nextOpen);
    state.quickHelpOpen = open;
    panel.hidden = !open;
    toggle.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', String(open));
    emitQueueOpsEvent('quick_help_toggled', {
        open,
        source,
    });
    if (open) {
        setKioskProgressHint(
            'Guia abierta: elige opcion, completa datos y confirma ticket.',
            'info'
        );
    } else {
        setKioskProgressHint(
            'Paso 1 de 2: selecciona una opcion para comenzar.',
            'info'
        );
    }
}

function focusFlowTarget(target, { announce = true } = {}) {
    const normalized =
        String(target || '').toLowerCase() === 'walkin' ? 'walkin' : 'checkin';
    state.selectedFlow = normalized;

    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    if (checkinForm instanceof HTMLElement) {
        checkinForm.classList.toggle(
            'is-flow-active',
            normalized === 'checkin'
        );
    }
    if (walkinForm instanceof HTMLElement) {
        walkinForm.classList.toggle('is-flow-active', normalized === 'walkin');
    }

    const quickCheckin = getById('kioskQuickCheckin');
    const quickWalkin = getById('kioskQuickWalkin');
    if (quickCheckin instanceof HTMLButtonElement) {
        const active = normalized === 'checkin';
        quickCheckin.dataset.active = active ? 'true' : 'false';
        quickCheckin.setAttribute('aria-pressed', String(active));
    }
    if (quickWalkin instanceof HTMLButtonElement) {
        const active = normalized === 'walkin';
        quickWalkin.dataset.active = active ? 'true' : 'false';
        quickWalkin.setAttribute('aria-pressed', String(active));
    }

    const targetInputId =
        normalized === 'walkin' ? 'walkinInitials' : 'checkinPhone';
    const targetInput = getById(targetInputId);
    if (targetInput instanceof HTMLInputElement) {
        targetInput.focus({ preventScroll: false });
    }

    if (announce) {
        setKioskProgressHint(
            normalized === 'walkin'
                ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                : 'Paso 2: escribe telefono, fecha y hora para check-in.',
            'info'
        );
    }
    emitQueueOpsEvent('flow_focus', {
        target: normalized,
    });
}

function getQueueStateArray(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return [];
    }
    for (const key of keys) {
        if (!key) continue;
        if (Array.isArray(source[key])) {
            return source[key];
        }
    }
    return [];
}

function getQueueStateObject(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return null;
    }
    for (const key of keys) {
        if (!key) continue;
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
    }
    return null;
}

function getQueueStateNumber(source, keys, fallback = 0) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return Number(fallback || 0);
    }
    for (const key of keys) {
        if (!key) continue;
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return Number(fallback || 0);
}

function normalizeQueueStatePayload(rawState) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const counts = getQueueStateObject(state, ['counts']) || {};
    const waitingCountRaw = getQueueStateNumber(
        state,
        ['waitingCount', 'waiting_count'],
        Number.NaN
    );
    const calledCountRaw = getQueueStateNumber(
        state,
        ['calledCount', 'called_count'],
        Number.NaN
    );

    let callingNow = getQueueStateArray(state, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (callingNow.length === 0) {
        const byConsultorio = getQueueStateObject(state, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        if (byConsultorio) {
            callingNow = Object.values(byConsultorio).filter(Boolean);
        }
    }

    const nextTickets = getQueueStateArray(state, [
        'nextTickets',
        'next_tickets',
        'waitingTickets',
        'waiting_tickets',
    ]);

    const waitingCount = Number.isFinite(waitingCountRaw)
        ? waitingCountRaw
        : getQueueStateNumber(
              counts,
              ['waiting', 'waiting_count'],
              nextTickets.length
          );
    const calledCount = Number.isFinite(calledCountRaw)
        ? calledCountRaw
        : getQueueStateNumber(
              counts,
              ['called', 'called_count'],
              callingNow.length
          );

    return {
        updatedAt:
            String(state.updatedAt || state.updated_at || '').trim() ||
            new Date().toISOString(),
        waitingCount: Math.max(0, Number(waitingCount || 0)),
        calledCount: Math.max(0, Number(calledCount || 0)),
        callingNow: Array.isArray(callingNow)
            ? callingNow.map((ticket) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: String(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: String(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  assignedConsultorio:
                      Number(
                          ticket?.assignedConsultorio ??
                              ticket?.assigned_consultorio ??
                              0
                      ) || null,
                  calledAt: String(ticket?.calledAt || ticket?.called_at || ''),
              }))
            : [],
        nextTickets: Array.isArray(nextTickets)
            ? nextTickets.map((ticket, index) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: String(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: String(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  queueType: String(
                      ticket?.queueType || ticket?.queue_type || 'walk_in'
                  ),
                  priorityClass: String(
                      ticket?.priorityClass ||
                          ticket?.priority_class ||
                          'walk_in'
                  ),
                  position:
                      Number(ticket?.position || 0) > 0
                          ? Number(ticket.position)
                          : index + 1,
              }))
            : [],
    };
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
    const nextMessage = String(message || '').trim() || 'Estado operativo';
    const nextType = String(type || 'info').toLowerCase();
    const changed =
        nextMessage !== String(el.textContent || '').trim() ||
        nextType !== String(el.dataset.status || '').toLowerCase();
    el.textContent = nextMessage;
    el.dataset.status = nextType;
    if (changed) {
        emitQueueOpsEvent('kiosk_status', {
            status: nextType,
            message: nextMessage,
        });
    }
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

    const normalizedMessage =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;

    const changed =
        normalized !== state.lastConnectionState ||
        normalizedMessage !== state.lastConnectionMessage;

    state.lastConnectionState = normalized;
    state.lastConnectionMessage = normalizedMessage;

    el.dataset.state = normalized;
    el.textContent = normalizedMessage;

    if (changed) {
        emitQueueOpsEvent('connection_state', {
            state: normalized,
            message: normalizedMessage,
        });
    }
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
    guard.className = 'kiosk-session-guard';

    const countdown = document.createElement('span');
    countdown.id = 'kioskSessionCountdown';
    countdown.className = 'kiosk-session-countdown';
    countdown.textContent = 'Privacidad auto: --:--';

    const resetButton = document.createElement('button');
    resetButton.id = 'kioskSessionResetBtn';
    resetButton.type = 'button';
    resetButton.className = 'kiosk-session-reset';
    resetButton.textContent = 'Nueva persona / limpiar pantalla';

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
        return;
    }

    const remainingMs = Math.max(0, state.idleDeadlineTs - Date.now());
    countdown.textContent = `Privacidad auto: ${formatCountdownMs(remainingMs)}`;
    const warning = remainingMs <= KIOSK_IDLE_WARNING_MS;
    countdown.dataset.state = warning ? 'warning' : 'normal';
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
    dismissWelcomeScreen({ reason: 'activity' });
    beginIdleSessionGuard();
}

function resetKioskSession({ reason = 'manual' } = {}) {
    resetKioskForms();
    resetAssistantConversation();
    renderTicketEmptyState();
    setKioskHelpPanelOpen(false, { source: 'session_reset' });
    focusFlowTarget('checkin', { announce: false });

    const reasonText =
        reason === 'idle_timeout'
            ? 'Sesion reiniciada por inactividad para proteger privacidad.'
            : 'Pantalla limpiada. Lista para el siguiente paciente.';
    setKioskStatus(reasonText, 'info');
    setKioskProgressHint(
        'Paso 1 de 2: selecciona una opcion para comenzar.',
        'info'
    );
    renderOfflineOutboxHint();
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

function ensureQueueOutboxHintEl() {
    let el = getById('queueOutboxHint');
    if (el) return el;

    const queueOpsHint = ensureQueueOpsHintEl();
    if (!queueOpsHint?.parentElement) return null;

    el = document.createElement('p');
    el.id = 'queueOutboxHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Pendientes offline: 0';
    queueOpsHint.insertAdjacentElement('afterend', el);
    return el;
}

function setQueueOutboxHint(message) {
    const el = ensureQueueOutboxHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Pendientes offline: 0';
}

function ensureQueuePrinterHintEl() {
    let el = getById('queuePrinterHint');
    if (el) return el;

    const outboxHint = ensureQueueOutboxHintEl();
    if (!outboxHint?.parentElement) return null;

    el = document.createElement('p');
    el.id = 'queuePrinterHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Impresora: estado pendiente.';
    outboxHint.insertAdjacentElement('afterend', el);
    return el;
}

function savePrinterState() {
    try {
        localStorage.setItem(
            KIOSK_PRINTER_STATE_STORAGE_KEY,
            JSON.stringify(state.printerState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
}

function loadPrinterState() {
    try {
        const raw = localStorage.getItem(KIOSK_PRINTER_STATE_STORAGE_KEY);
        if (!raw) {
            state.printerState = null;
            return;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            state.printerState = null;
            return;
        }
        state.printerState = {
            ok: Boolean(parsed.ok),
            printed: Boolean(parsed.printed),
            errorCode: String(parsed.errorCode || ''),
            message: String(parsed.message || ''),
            at: String(parsed.at || new Date().toISOString()),
        };
    } catch (_error) {
        state.printerState = null;
    }
}

function renderPrinterHint() {
    const el = ensureQueuePrinterHintEl();
    if (!el) return;

    const current = state.printerState;
    if (!current) {
        el.textContent = 'Impresora: estado pendiente.';
        return;
    }

    const statusLabel = current.printed
        ? 'impresion OK'
        : current.errorCode || 'sin impresion';
    const message = current.message ? ` (${current.message})` : '';
    const atLabel = formatIsoDateTime(current.at);
    el.textContent = `Impresora: ${statusLabel}${message} · ${atLabel}`;
}

function updatePrinterStateFromPayload(payload, { origin = 'ticket' } = {}) {
    const print = payload?.print || {};
    state.printerState = {
        ok: Boolean(print.ok),
        printed: Boolean(payload?.printed),
        errorCode: String(print.errorCode || ''),
        message: String(print.message || ''),
        at: new Date().toISOString(),
    };
    savePrinterState();
    renderPrinterHint();
    emitQueueOpsEvent('printer_result', {
        origin,
        ok: state.printerState.ok,
        printed: state.printerState.printed,
        errorCode: state.printerState.errorCode,
    });
}

function ensureQueueOutboxConsoleEl() {
    let panel = getById('queueOutboxConsole');
    if (panel instanceof HTMLElement) {
        return panel;
    }

    const outboxHint = ensureQueueOutboxHintEl();
    if (!outboxHint?.parentElement) return null;

    panel = document.createElement('section');
    panel.id = 'queueOutboxConsole';
    panel.className = 'queue-outbox-console';
    panel.innerHTML = `
        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>
        <div class="queue-outbox-actions">
            <button id="queueOutboxRetryBtn" type="button" class="queue-outbox-btn">Sincronizar pendientes</button>
            <button id="queueOutboxDropOldestBtn" type="button" class="queue-outbox-btn">Descartar mas antiguo</button>
            <button id="queueOutboxClearBtn" type="button" class="queue-outbox-btn">Limpiar pendientes</button>
        </div>
        <ol id="queueOutboxList" class="queue-outbox-list">
            <li class="queue-empty">Sin pendientes offline.</li>
        </ol>
        <p class="queue-updated-at queue-outbox-shortcuts">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>
    `;
    outboxHint.insertAdjacentElement('afterend', panel);
    return panel;
}

function setQueueOutboxActionLoading(isLoading) {
    const retryBtn = getById('queueOutboxRetryBtn');
    const clearBtn = getById('queueOutboxClearBtn');
    const dropOldestBtn = getById('queueOutboxDropOldestBtn');

    if (retryBtn instanceof HTMLButtonElement) {
        retryBtn.disabled = Boolean(isLoading) || !state.offlineOutbox.length;
        retryBtn.textContent = isLoading
            ? 'Sincronizando...'
            : 'Sincronizar pendientes';
    }
    if (clearBtn instanceof HTMLButtonElement) {
        clearBtn.disabled = Boolean(isLoading) || !state.offlineOutbox.length;
    }
    if (dropOldestBtn instanceof HTMLButtonElement) {
        dropOldestBtn.disabled =
            Boolean(isLoading) || state.offlineOutbox.length <= 0;
    }
}

function renderOutboxConsole() {
    ensureQueueOutboxConsoleEl();
    const summary = getById('queueOutboxSummary');
    const list = getById('queueOutboxList');
    const pendingCount = state.offlineOutbox.length;

    if (summary instanceof HTMLElement) {
        summary.textContent =
            pendingCount <= 0
                ? 'Outbox: 0 pendientes'
                : `Outbox: ${pendingCount} pendiente(s)`;
    }

    if (list instanceof HTMLElement) {
        if (pendingCount <= 0) {
            list.innerHTML =
                '<li class="queue-empty">Sin pendientes offline.</li>';
        } else {
            list.innerHTML = state.offlineOutbox
                .slice(0, KIOSK_OFFLINE_OUTBOX_RENDER_LIMIT)
                .map((item, index) => {
                    const queuedAt = formatIsoDateTime(item.queuedAt);
                    const attempts = Number(item.attempts || 0);
                    return `<li><strong>${escapeHtml(item.originLabel)}</strong> · ${escapeHtml(item.patientInitials || '--')} · ${escapeHtml(item.queueType || '--')} · ${escapeHtml(queuedAt)} · intento ${index + 1}/${Math.max(1, attempts + 1)}</li>`;
                })
                .join('');
        }
    }

    setQueueOutboxActionLoading(false);
}

function clearOfflineOutbox({ reason = 'manual' } = {}) {
    state.offlineOutbox = [];
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    renderOutboxConsole();
    if (reason === 'manual') {
        setKioskStatus('Pendientes offline limpiados manualmente.', 'info');
    }
}

function discardOldestOutboxItem() {
    if (!state.offlineOutbox.length) return;
    const oldest = state.offlineOutbox[state.offlineOutbox.length - 1];
    state.offlineOutbox.pop();
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    renderOutboxConsole();
    setKioskStatus(
        `Descartado pendiente antiguo (${oldest?.originLabel || 'sin detalle'}).`,
        'info'
    );
}

function saveOfflineOutbox() {
    try {
        localStorage.setItem(
            KIOSK_OFFLINE_OUTBOX_STORAGE_KEY,
            JSON.stringify(state.offlineOutbox)
        );
    } catch (_error) {
        // Ignore localStorage write failures.
    }
}

function loadOfflineOutbox() {
    try {
        const raw = localStorage.getItem(KIOSK_OFFLINE_OUTBOX_STORAGE_KEY);
        if (!raw) {
            state.offlineOutbox = [];
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            state.offlineOutbox = [];
            return;
        }
        state.offlineOutbox = parsed
            .map((item) => ({
                id: String(item?.id || ''),
                resource: String(item?.resource || ''),
                body:
                    item && typeof item.body === 'object' && item.body
                        ? item.body
                        : {},
                originLabel: String(item?.originLabel || 'Solicitud offline'),
                patientInitials: String(item?.patientInitials || '--'),
                queueType: String(item?.queueType || '--'),
                queuedAt: String(item?.queuedAt || new Date().toISOString()),
                attempts: Number(item?.attempts || 0),
                lastError: String(item?.lastError || ''),
                fingerprint: String(item?.fingerprint || ''),
            }))
            .filter(
                (item) =>
                    item.id &&
                    (item.resource === 'queue-ticket' ||
                        item.resource === 'queue-checkin')
            )
            .map((item) => ({
                ...item,
                fingerprint:
                    item.fingerprint ||
                    buildOutboxFingerprint(item.resource, item.body),
            }))
            .slice(0, KIOSK_OFFLINE_OUTBOX_MAX_ITEMS);
    } catch (_error) {
        state.offlineOutbox = [];
    }
}

function renderOfflineOutboxHint() {
    const pendingCount = state.offlineOutbox.length;
    if (pendingCount <= 0) {
        setQueueOutboxHint('Pendientes offline: 0 (sin pendientes).');
        renderOutboxConsole();
        return;
    }

    const firstQueuedAt = Date.parse(
        String(state.offlineOutbox[0]?.queuedAt || '')
    );
    const ageLabel = Number.isFinite(firstQueuedAt)
        ? ` - mas antiguo ${formatElapsedAge(Date.now() - firstQueuedAt)}`
        : '';
    setQueueOutboxHint(
        `Pendientes offline: ${pendingCount} - sincronizacion automatica al reconectar${ageLabel}`
    );
    renderOutboxConsole();
}

function buildPendingLocalCode() {
    return `PEND-${String(state.offlineOutbox.length).padStart(2, '0')}`;
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
    button.className = 'queue-manual-refresh-btn';
    button.textContent = 'Reintentar sincronizacion';
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
    const normalizedState = normalizeQueueStatePayload(queueState);
    const updatedAtTs = Date.parse(String(normalizedState.updatedAt || ''));
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
    const normalizedState = normalizeQueueStatePayload({ updatedAt });
    const ts = Date.parse(String(normalizedState.updatedAt || ''));
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
    const normalizedState = normalizeQueueStatePayload(queueState);
    const waitingCountEl = getById('queueWaitingCount');
    const calledCountEl = getById('queueCalledCount');
    const callingNowEl = getById('queueCallingNow');
    const nextListEl = getById('queueNextList');

    if (waitingCountEl) {
        waitingCountEl.textContent = String(normalizedState.waitingCount || 0);
    }
    if (calledCountEl) {
        calledCountEl.textContent = String(normalizedState.calledCount || 0);
    }

    if (callingNowEl) {
        const callingNow = Array.isArray(normalizedState.callingNow)
            ? normalizedState.callingNow
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
        const nextTickets = Array.isArray(normalizedState.nextTickets)
            ? normalizedState.nextTickets
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
        state.queueState = normalizeQueueStatePayload(payload.data || {});
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

    const rawTicket = payload?.data || {};
    const ticket = {
        ...rawTicket,
        id: Number(rawTicket?.id || rawTicket?.ticket_id || 0) || 0,
        ticketCode: String(
            rawTicket?.ticketCode || rawTicket?.ticket_code || '--'
        ),
        patientInitials: String(
            rawTicket?.patientInitials || rawTicket?.patient_initials || '--'
        ),
        queueType: String(
            rawTicket?.queueType || rawTicket?.queue_type || 'walk_in'
        ),
        createdAt: String(
            rawTicket?.createdAt ||
                rawTicket?.created_at ||
                new Date().toISOString()
        ),
    };
    const print = payload?.print || {};
    updatePrinterStateFromPayload(payload, { origin: originLabel });
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

function renderPendingTicketResult({
    originLabel,
    patientInitials,
    queueType,
    queuedAt,
}) {
    const container = getById('ticketResult');
    if (!container) return;

    container.innerHTML = `
        <article class="ticket-result-card">
            <h3>Solicitud guardada offline</h3>
            <p class="ticket-result-origin">${escapeHtml(originLabel)}</p>
            <div class="ticket-result-main">
                <strong>${escapeHtml(buildPendingLocalCode())}</strong>
                <span>${escapeHtml(patientInitials || '--')}</span>
            </div>
            <dl>
                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>
                <div><dt>Tipo</dt><dd>${escapeHtml(queueType || '--')}</dd></div>
                <div><dt>Guardado</dt><dd>${escapeHtml(formatIsoDateTime(queuedAt))}</dd></div>
            </dl>
            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>
        </article>
    `;
}

function isRecoverableTransportError(error) {
    if (navigator.onLine === false) {
        return true;
    }
    const message = String(error?.message || '').toLowerCase();
    if (!message) return false;
    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network request failed') ||
        message.includes('load failed') ||
        message.includes('network')
    );
}

function normalizeOutboxBody(body) {
    const source = body && typeof body === 'object' ? body : {};
    return Object.keys(source)
        .sort()
        .reduce((acc, key) => {
            acc[key] = source[key];
            return acc;
        }, {});
}

function buildOutboxFingerprint(resource, body) {
    const normalizedResource = String(resource || '').toLowerCase();
    const normalizedBody = normalizeOutboxBody(body);
    return `${normalizedResource}:${JSON.stringify(normalizedBody)}`;
}

function queueOfflineRequest({
    resource,
    body,
    originLabel,
    patientInitials,
    queueType,
}) {
    const safeResource = String(resource || '');
    if (safeResource !== 'queue-ticket' && safeResource !== 'queue-checkin') {
        return null;
    }

    const fingerprint = buildOutboxFingerprint(safeResource, body);
    const nowTs = Date.now();
    const duplicate = state.offlineOutbox.find((item) => {
        const sameFingerprint = String(item?.fingerprint || '') === fingerprint;
        if (!sameFingerprint) return false;
        const queuedAtTs = Date.parse(String(item?.queuedAt || ''));
        if (!Number.isFinite(queuedAtTs)) return false;
        return nowTs - queuedAtTs <= KIOSK_OFFLINE_OUTBOX_DEDUPE_MS;
    });
    if (duplicate) {
        emitQueueOpsEvent('offline_queued_duplicate', {
            resource: safeResource,
            fingerprint,
        });
        return { ...duplicate, deduped: true };
    }

    const item = {
        id: `offline_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        resource: safeResource,
        body: body && typeof body === 'object' ? body : {},
        originLabel: String(originLabel || 'Solicitud offline'),
        patientInitials: String(patientInitials || '--'),
        queueType: String(queueType || '--'),
        queuedAt: new Date().toISOString(),
        attempts: 0,
        lastError: '',
        fingerprint,
    };

    state.offlineOutbox = [item, ...state.offlineOutbox].slice(
        0,
        KIOSK_OFFLINE_OUTBOX_MAX_ITEMS
    );
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    emitQueueOpsEvent('offline_queued', {
        resource: safeResource,
        queueSize: state.offlineOutbox.length,
    });
    return item;
}

async function flushOfflineOutbox({
    source = 'auto',
    force = false,
    maxItems = KIOSK_OFFLINE_OUTBOX_FLUSH_BATCH,
} = {}) {
    if (state.offlineOutboxFlushBusy) return;
    if (!state.offlineOutbox.length) return;
    if (!force && navigator.onLine === false) return;

    state.offlineOutboxFlushBusy = true;
    setQueueOutboxActionLoading(true);
    let processed = 0;
    try {
        while (
            state.offlineOutbox.length &&
            processed < Math.max(1, Number(maxItems || 1))
        ) {
            const item = state.offlineOutbox[0];
            try {
                const payload = await apiRequest(item.resource, {
                    method: 'POST',
                    body: item.body,
                });

                state.offlineOutbox.shift();
                saveOfflineOutbox();
                renderOfflineOutboxHint();

                renderTicketResult(
                    payload,
                    `${item.originLabel} (sincronizado)`
                );
                setKioskStatus(
                    `Pendiente sincronizado (${item.originLabel})`,
                    'success'
                );
                emitQueueOpsEvent('offline_synced_item', {
                    resource: item.resource,
                    originLabel: item.originLabel,
                    pendingAfter: state.offlineOutbox.length,
                });
                processed += 1;
            } catch (error) {
                item.attempts = Number(item.attempts || 0) + 1;
                item.lastError = String(error?.message || '').slice(0, 180);
                item.lastAttemptAt = new Date().toISOString();
                saveOfflineOutbox();
                renderOfflineOutboxHint();

                const retryingOffline = isRecoverableTransportError(error);
                setKioskStatus(
                    retryingOffline
                        ? 'Sincronizacion offline pendiente: esperando reconexion.'
                        : `Pendiente con error: ${error.message}`,
                    retryingOffline ? 'info' : 'error'
                );
                emitQueueOpsEvent('offline_sync_error', {
                    resource: item.resource,
                    retryingOffline,
                    error: String(error?.message || ''),
                });
                break;
            }
        }

        if (processed > 0) {
            state.queueFailureStreak = 0;
            const refreshResult = await refreshQueueState();
            if (refreshResult.ok) {
                state.queueLastHealthySyncAt = Date.now();
                setQueueConnectionStatus('live', 'Cola conectada');
                setQueueOpsHint(
                    `Outbox sincronizado desde ${source}. (${formatLastHealthySyncAge()})`
                );
                emitQueueOpsEvent('offline_synced_batch', {
                    source,
                    processed,
                    pendingAfter: state.offlineOutbox.length,
                });
            }
        }
    } finally {
        state.offlineOutboxFlushBusy = false;
        renderOutboxConsole();
    }
}

async function submitCheckin(event) {
    event.preventDefault();
    registerKioskActivity();
    dismissWelcomeScreen({ reason: 'form_submit' });
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
        setKioskProgressHint(
            'Completa telefono, fecha y hora para continuar.',
            'warn'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const body = {
            telefono: phone,
            hora: time,
            fecha: date,
            patientInitials,
        };
        const payload = await apiRequest('queue-checkin', {
            method: 'POST',
            body,
        });
        setKioskStatus('Check-in registrado correctamente', 'success');
        setKioskProgressHint(
            'Check-in completado. Conserva tu ticket y espera llamado.',
            'success'
        );
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
        if (isRecoverableTransportError(error)) {
            const queued = queueOfflineRequest({
                resource: 'queue-checkin',
                body: {
                    telefono: phone,
                    hora: time,
                    fecha: date,
                    patientInitials,
                },
                originLabel: 'Check-in de cita',
                patientInitials: patientInitials || phone.slice(-2),
                queueType: 'appointment',
            });
            if (queued) {
                setQueueConnectionStatus('offline', 'Sin conexion al backend');
                setQueueOpsHint(
                    'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                );
                renderPendingTicketResult({
                    originLabel: queued.originLabel,
                    patientInitials: queued.patientInitials,
                    queueType: queued.queueType,
                    queuedAt: queued.queuedAt,
                });
                setKioskStatus(
                    queued.deduped
                        ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                        : 'Check-in guardado offline. Se sincronizara automaticamente.',
                    'info'
                );
                setKioskProgressHint(
                    'Check-in guardado offline. Recepcion confirmara al reconectar.',
                    'warn'
                );
                return;
            }
        }
        setKioskStatus(
            `No se pudo registrar el check-in: ${error.message}`,
            'error'
        );
        setKioskProgressHint(
            'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
            'warn'
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
    dismissWelcomeScreen({ reason: 'form_submit' });
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
        setKioskProgressHint(
            'Escribe iniciales para generar tu turno.',
            'warn'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const body = {
            patientInitials,
            name,
            phone,
        };
        const payload = await apiRequest('queue-ticket', {
            method: 'POST',
            body,
        });
        setKioskStatus('Turno walk-in registrado correctamente', 'success');
        setKioskProgressHint(
            'Turno generado. Conserva tu ticket y espera llamado.',
            'success'
        );
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
        if (isRecoverableTransportError(error)) {
            const queued = queueOfflineRequest({
                resource: 'queue-ticket',
                body: {
                    patientInitials,
                    name,
                    phone,
                },
                originLabel: 'Turno sin cita',
                patientInitials,
                queueType: 'walk_in',
            });
            if (queued) {
                setQueueConnectionStatus('offline', 'Sin conexion al backend');
                setQueueOpsHint(
                    'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                );
                renderPendingTicketResult({
                    originLabel: queued.originLabel,
                    patientInitials: queued.patientInitials,
                    queueType: queued.queueType,
                    queuedAt: queued.queuedAt,
                });
                setKioskStatus(
                    queued.deduped
                        ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                        : 'Turno guardado offline. Se sincronizara automaticamente.',
                    'info'
                );
                setKioskProgressHint(
                    'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                    'warn'
                );
                return;
            }
        }
        setKioskStatus(`No se pudo crear el turno: ${error.message}`, 'error');
        setKioskProgressHint(
            'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
            'warn'
        );
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
    const activeMode = 'light';
    root.dataset.theme = activeMode;

    document.querySelectorAll('[data-theme-mode]').forEach((button) => {
        const buttonMode = button.getAttribute('data-theme-mode');
        button.classList.toggle('is-active', buttonMode === mode);
        button.setAttribute('aria-pressed', String(buttonMode === mode));
    });
}

function setTheme(_mode) {
    const normalized = 'light';
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
    applyTheme(normalized);
}

function initTheme() {
    setTheme('light');
}

function dismissWelcomeScreen({ reason = 'auto' } = {}) {
    if (state.welcomeDismissed) return;
    state.welcomeDismissed = true;
    const welcomeScreen = getById('kioskWelcomeScreen');
    if (!(welcomeScreen instanceof HTMLElement)) return;
    welcomeScreen.classList.add('is-hidden');
    window.setTimeout(() => {
        if (welcomeScreen.parentElement) {
            welcomeScreen.remove();
        }
    }, 700);
    emitQueueOpsEvent('welcome_dismissed', { reason });
}

function runWelcomeSequence() {
    const welcomeScreen = getById('kioskWelcomeScreen');
    if (!(welcomeScreen instanceof HTMLElement)) return;

    welcomeScreen.classList.add('is-visible');
    setKioskProgressHint(
        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
        'info'
    );
    window.setTimeout(() => {
        dismissWelcomeScreen({ reason: 'auto' });
    }, KIOSK_WELCOME_HIDE_MS);
    window.setTimeout(() => {
        dismissWelcomeScreen({ reason: 'safety_timeout' });
    }, KIOSK_WELCOME_REMOVE_MS);
}

function bindKioskStarControls() {
    const quickCheckin = getById('kioskQuickCheckin');
    const quickWalkin = getById('kioskQuickWalkin');
    const helpToggle = getById('kioskHelpToggle');
    const helpClose = getById('kioskHelpClose');

    if (quickCheckin instanceof HTMLButtonElement) {
        quickCheckin.addEventListener('click', () => {
            registerKioskActivity();
            focusFlowTarget('checkin');
        });
    }
    if (quickWalkin instanceof HTMLButtonElement) {
        quickWalkin.addEventListener('click', () => {
            registerKioskActivity();
            focusFlowTarget('walkin');
        });
    }
    if (helpToggle instanceof HTMLButtonElement) {
        helpToggle.addEventListener('click', () => {
            registerKioskActivity();
            setKioskHelpPanelOpen(!state.quickHelpOpen, { source: 'toggle' });
        });
    }
    if (helpClose instanceof HTMLButtonElement) {
        helpClose.addEventListener('click', () => {
            registerKioskActivity();
            setKioskHelpPanelOpen(false, { source: 'close_button' });
        });
    }
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
        renderOfflineOutboxHint();
        scheduleQueuePolling();
        return;
    }

    await flushOfflineOutbox({ source: 'poll' });

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
    renderOfflineOutboxHint();
    scheduleQueuePolling();
}

async function runQueueManualRefresh() {
    if (state.queueManualRefreshBusy) return;
    registerKioskActivity();
    state.queueManualRefreshBusy = true;
    setQueueManualRefreshLoading(true);
    setQueueConnectionStatus('reconnecting', 'Refrescando manualmente...');

    try {
        await flushOfflineOutbox({ source: 'manual' });
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
        renderOfflineOutboxHint();
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
        renderOfflineOutboxHint();
        return;
    }
    if (normalizedReason === 'hidden') {
        setQueueConnectionStatus('paused', 'Cola en pausa (pestana oculta)');
        setQueueOpsHint('Pestana oculta. Reanudando al volver a primer plano.');
        return;
    }
    setQueueConnectionStatus('paused', 'Cola en pausa');
    setQueueOpsHint('Sincronizacion pausada por navegacion.');
    renderOfflineOutboxHint();
}

function initKiosk() {
    document.body.dataset.kioskMode = 'star';
    ensureKioskStarStyles();
    state.idleResetMs = resolveIdleResetMs();
    initTheme();
    runWelcomeSequence();
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
    bindKioskStarControls();
    setKioskHelpPanelOpen(false, { source: 'init' });

    ensureSessionGuard();
    const resetSessionBtn = getById('kioskSessionResetBtn');
    if (resetSessionBtn instanceof HTMLButtonElement) {
        resetSessionBtn.addEventListener('click', () => {
            resetKioskSession({ reason: 'manual' });
        });
    }

    resetAssistantConversation();
    renderTicketEmptyState();
    focusFlowTarget('checkin', { announce: false });
    setKioskProgressHint(
        'Paso 1 de 2: selecciona una opcion para comenzar.',
        'info'
    );
    bindKioskActivitySignals();
    beginIdleSessionGuard();

    ensureQueueOpsHintEl();
    ensureQueueOutboxHintEl();
    ensureQueuePrinterHintEl();
    ensureQueueOutboxConsoleEl();
    loadOfflineOutbox();
    loadPrinterState();
    renderPrinterHint();
    renderOfflineOutboxHint();
    const manualRefreshButton = ensureQueueManualRefreshButton();
    if (manualRefreshButton instanceof HTMLButtonElement) {
        manualRefreshButton.addEventListener('click', () => {
            void runQueueManualRefresh();
        });
    }
    const outboxRetryButton = getById('queueOutboxRetryBtn');
    if (outboxRetryButton instanceof HTMLButtonElement) {
        outboxRetryButton.addEventListener('click', () => {
            void flushOfflineOutbox({
                source: 'operator',
                force: true,
                maxItems: KIOSK_OFFLINE_OUTBOX_MAX_ITEMS,
            });
        });
    }
    const outboxDropOldestButton = getById('queueOutboxDropOldestBtn');
    if (outboxDropOldestButton instanceof HTMLButtonElement) {
        outboxDropOldestButton.addEventListener('click', () => {
            discardOldestOutboxItem();
        });
    }
    const outboxClearButton = getById('queueOutboxClearBtn');
    if (outboxClearButton instanceof HTMLButtonElement) {
        outboxClearButton.addEventListener('click', () => {
            clearOfflineOutbox({ reason: 'manual' });
        });
    }

    setQueueConnectionStatus('paused', 'Sincronizacion lista');
    setQueueOpsHint('Esperando primera sincronizacion de cola...');
    renderQueueUpdatedAt('');
    if (navigator.onLine !== false) {
        void flushOfflineOutbox({ source: 'startup', force: true });
    }
    startQueuePolling({ immediate: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopQueuePolling({ reason: 'hidden' });
            return;
        }
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('online', () => {
        void flushOfflineOutbox({ source: 'online', force: true });
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('offline', () => {
        stopQueuePolling({ reason: 'offline' });
        renderOfflineOutboxHint();
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
        if (keyCode === 'keyh') {
            event.preventDefault();
            setKioskHelpPanelOpen(!state.quickHelpOpen, {
                source: 'shortcut',
            });
            return;
        }
        if (keyCode === 'digit1') {
            event.preventDefault();
            focusFlowTarget('checkin');
            return;
        }
        if (keyCode === 'digit2') {
            event.preventDefault();
            focusFlowTarget('walkin');
            return;
        }
        if (keyCode === 'keyl') {
            event.preventDefault();
            resetKioskSession({ reason: 'manual' });
            return;
        }
        if (keyCode === 'keyy') {
            event.preventDefault();
            void flushOfflineOutbox({
                source: 'shortcut',
                force: true,
                maxItems: KIOSK_OFFLINE_OUTBOX_MAX_ITEMS,
            });
            return;
        }
        if (keyCode === 'keyk') {
            event.preventDefault();
            clearOfflineOutbox({ reason: 'manual' });
        }
    });
}

document.addEventListener('DOMContentLoaded', initKiosk);
