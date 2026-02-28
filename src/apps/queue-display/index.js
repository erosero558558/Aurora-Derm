const API_ENDPOINT = '/api.php';
const POLL_MS = 2500;
const POLL_MAX_MS = 15000;
const POLL_STALE_THRESHOLD_MS = 30000;
const DISPLAY_BELL_MUTED_STORAGE_KEY = 'queueDisplayBellMuted';
const DISPLAY_LAST_SNAPSHOT_STORAGE_KEY = 'queueDisplayLastSnapshot';
const DISPLAY_LAST_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DISPLAY_ANNOUNCEMENT_STYLE_ID = 'displayAnnouncementInlineStyles';
const DISPLAY_STAR_STYLE_ID = 'displayStarInlineStyles';
const DISPLAY_BELL_FLASH_CLASS = 'display-bell-flash';
const DISPLAY_BELL_FLASH_DURATION_MS = 1300;
const DISPLAY_BELL_COOLDOWN_MS = 1200;
const DISPLAY_BELL_BLOCKED_HINT_COOLDOWN_MS = 20000;

const state = {
    lastCalledSignature: '',
    callBaselineReady: false,
    audioContext: null,
    pollingId: 0,
    clockId: 0,
    pollingEnabled: false,
    failureStreak: 0,
    refreshBusy: false,
    manualRefreshBusy: false,
    lastHealthySyncAt: 0,
    bellMuted: false,
    lastSnapshot: null,
    connectionState: 'paused',
    lastConnectionMessage: '',
    lastRenderedSignature: '',
    bellFlashId: 0,
    lastBellAt: 0,
    lastBellBlockedHintAt: 0,
    bellPrimed: false,
};

function emitQueueOpsEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'display',
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

function getById(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeTicketCodeForDisplay(value) {
    const raw = String(value || '')
        .trim()
        .toUpperCase();
    if (!raw) {
        return '--';
    }
    const sanitized = raw.replace(/[^A-Z0-9-]/g, '');
    return sanitized || '--';
}

function normalizePatientInitialsForDisplay(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '--';
    }

    const folded = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!folded) {
        return '--';
    }

    const words = folded.split(/[\s-]+/).filter(Boolean);
    let initials = '';
    if (words.length >= 2) {
        const first = String(words[0] || '').charAt(0);
        const last = String(words[words.length - 1] || '').charAt(0);
        initials = `${first}${last}`;
    } else if (words.length === 1) {
        const compact = String(words[0] || '').replace(/[^A-Za-z0-9]/g, '');
        if (!compact) return '--';
        initials =
            compact.length <= 3 && compact === compact.toUpperCase()
                ? compact
                : compact.slice(0, 2);
    }

    const normalized = initials.toUpperCase().trim();
    if (!normalized) {
        return '--';
    }
    return normalized.slice(0, 3);
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
                  ticketCode: normalizeTicketCodeForDisplay(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: normalizePatientInitialsForDisplay(
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
                  ticketCode: normalizeTicketCodeForDisplay(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: normalizePatientInitialsForDisplay(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  position:
                      Number(ticket?.position || 0) > 0
                          ? Number(ticket.position)
                          : index + 1,
              }))
            : [],
    };
}

async function apiRequest(resource) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    params.set('t', String(Date.now()));
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    });

    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (_error) {
        throw new Error('Respuesta JSON invalida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function setConnectionStatus(stateLabel, message) {
    const el = getById('displayConnectionState');
    if (!el) return;

    const normalized = String(stateLabel || 'live').toLowerCase();
    const fallbackByState = {
        live: 'Conectado',
        reconnecting: 'Reconectando',
        offline: 'Sin conexion',
        paused: 'En pausa',
    };

    const normalizedMessage =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;
    const changed =
        normalized !== state.connectionState ||
        normalizedMessage !== state.lastConnectionMessage;

    state.connectionState = normalized;
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

function ensureDisplayOpsHintEl() {
    let el = getById('displayOpsHint');
    if (el) return el;

    const updatedAtEl = getById('displayUpdatedAt');
    if (!updatedAtEl?.parentElement) return null;

    el = document.createElement('span');
    el.id = 'displayOpsHint';
    el.className = 'display-updated-at';
    el.textContent = 'Estado operativo: inicializando...';
    updatedAtEl.insertAdjacentElement('afterend', el);
    return el;
}

function ensureDisplayStarStyles() {
    if (document.getElementById(DISPLAY_STAR_STYLE_ID)) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = DISPLAY_STAR_STYLE_ID;
    styleEl.textContent = `
        body[data-display-mode='star'] .display-header {
            border-bottom-color: color-mix(in srgb, var(--accent) 18%, var(--border));
            box-shadow: 0 10px 32px rgb(16 36 61 / 10%);
        }
        body[data-display-mode='star'] .display-brand strong {
            letter-spacing: -0.02em;
        }
        body[data-display-mode='star'] .display-privacy-pill {
            width: fit-content;
            border: 1px solid color-mix(in srgb, var(--accent) 24%, #fff 76%);
            border-radius: 999px;
            padding: 0.22rem 0.66rem;
            background: color-mix(in srgb, var(--accent-soft) 90%, #fff 10%);
            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);
            font-size: 0.83rem;
            font-weight: 600;
            line-height: 1.3;
        }
        body[data-display-mode='star'] .display-layout {
            gap: 1.1rem;
        }
        body[data-display-mode='star'] .display-panel {
            border-radius: 22px;
            padding: 1.12rem;
        }
        body[data-display-mode='star'] .display-next-list li {
            min-height: 68px;
        }
        #displayMetrics {
            margin: 0.7rem 1.35rem 0;
            display: flex;
            flex-wrap: wrap;
            gap: 0.56rem;
        }
        .display-metric-chip {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.36rem 0.7rem;
            background: var(--surface-soft);
            color: var(--muted);
            font-size: 0.9rem;
            font-weight: 600;
        }
        .display-metric-chip strong {
            color: var(--text);
            font-size: 1.02rem;
            margin-left: 0.28rem;
        }
        .display-metric-chip[data-kind='active'] {
            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);
            background: color-mix(in srgb, var(--accent-soft) 88%, #fff 12%);
            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);
        }
        .display-metric-chip[data-kind='active'] strong {
            color: var(--accent);
        }
        #displayAnnouncement .display-announcement-support {
            margin: 0.24rem 0 0;
            color: var(--muted);
            font-size: clamp(0.98rem, 1.45vw, 1.15rem);
            font-weight: 500;
            line-height: 1.3;
        }
        #displayAnnouncement.is-live .display-announcement-support {
            color: color-mix(in srgb, var(--accent) 60%, var(--muted) 40%);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} .display-header {
            box-shadow:
                0 0 0 2px color-mix(in srgb, var(--accent) 34%, #fff 66%),
                0 14px 34px rgb(16 36 61 / 18%);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} #displayAnnouncement {
            border-color: color-mix(in srgb, var(--accent) 45%, #fff 55%);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, #fff 72%);
            transform: translateY(-1px);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} .display-called-card.is-live {
            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);
            box-shadow: 0 12px 24px rgb(16 36 61 / 14%);
        }
        @media (max-width: 720px) {
            #displayMetrics {
                margin: 0.56rem 0.9rem 0;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function ensureDisplayAnnouncementStyles() {
    if (document.getElementById(DISPLAY_ANNOUNCEMENT_STYLE_ID)) {
        return;
    }
    const styleEl = document.createElement('style');
    styleEl.id = DISPLAY_ANNOUNCEMENT_STYLE_ID;
    styleEl.textContent = `
        #displayAnnouncement {
            margin: 0.75rem 1.35rem 0;
            padding: 1rem 1.2rem;
            border-radius: 18px;
            border: 1px solid color-mix(in srgb, var(--accent) 28%, #fff 72%);
            background: linear-gradient(120deg, color-mix(in srgb, var(--accent-soft) 92%, #fff 8%), #fff);
            box-shadow: 0 12px 24px rgb(16 36 61 / 11%);
        }
        #displayAnnouncement .display-announcement-label {
            margin: 0;
            color: var(--muted);
            font-size: 0.96rem;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        #displayAnnouncement .display-announcement-text {
            margin: 0.24rem 0 0;
            font-size: clamp(1.34rem, 2.5vw, 2.15rem);
            line-height: 1.18;
            font-weight: 700;
            letter-spacing: 0.01em;
            color: var(--text);
        }
        #displayAnnouncement.is-live .display-announcement-text {
            color: var(--accent);
        }
        #displayAnnouncement.is-bell {
            border-color: color-mix(in srgb, var(--accent) 40%, #fff 60%);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, #fff 78%);
        }
        #displayAnnouncement.is-idle {
            border-color: var(--border);
            background: linear-gradient(160deg, var(--surface-soft), #fff);
        }
        @media (max-width: 720px) {
            #displayAnnouncement {
                margin: 0.6rem 0.9rem 0;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            #displayAnnouncement {
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function ensureDisplayAnnouncementEl() {
    let el = getById('displayAnnouncement');
    if (el instanceof HTMLElement) {
        return el;
    }

    const layout = document.querySelector('.display-layout');
    if (!(layout instanceof HTMLElement)) {
        return null;
    }

    ensureDisplayAnnouncementStyles();
    ensureDisplayStarStyles();
    el = document.createElement('section');
    el.id = 'displayAnnouncement';
    el.className = 'display-announcement is-idle';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `
        <p class="display-announcement-label">Llamando ahora</p>
        <p class="display-announcement-text">Esperando siguiente llamado...</p>
        <p class="display-announcement-support">Consulta la pantalla para el consultorio asignado.</p>
    `;
    layout.insertAdjacentElement('beforebegin', el);
    return el;
}

function setDisplayAnnouncement(ticket) {
    const el = ensureDisplayAnnouncementEl();
    if (!(el instanceof HTMLElement)) return;

    const textEl = el.querySelector('.display-announcement-text');
    const supportEl = el.querySelector('.display-announcement-support');
    if (!(textEl instanceof HTMLElement)) return;

    if (!ticket) {
        el.classList.add('is-idle');
        el.classList.remove('is-live');
        delete el.dataset.consultorio;
        const idleText = 'Esperando siguiente llamado...';
        const idleSupport =
            'Consulta la pantalla para el consultorio asignado.';
        if (textEl.textContent !== idleText) {
            textEl.textContent = idleText;
            emitQueueOpsEvent('announcement_update', {
                mode: 'idle',
            });
        }
        if (
            supportEl instanceof HTMLElement &&
            supportEl.textContent !== idleSupport
        ) {
            supportEl.textContent = idleSupport;
        }
        return;
    }

    const consultorio = Number(ticket?.assignedConsultorio || 0);
    const consultorioLabel =
        consultorio === 1 || consultorio === 2
            ? `Consultorio ${consultorio}`
            : 'Recepcion';
    const ticketCode = normalizeTicketCodeForDisplay(
        ticket?.ticketCode || '--'
    );
    const patientInitials = normalizePatientInitialsForDisplay(
        ticket?.patientInitials || '--'
    );
    const nextText = `${consultorioLabel} · Turno ${ticketCode}`;
    const supportText = `Paciente ${patientInitials}: pasa con calma al ${consultorioLabel}.`;
    el.classList.remove('is-idle');
    el.classList.add('is-live');
    el.dataset.consultorio = String(consultorio || '');
    if (textEl.textContent !== nextText) {
        textEl.textContent = nextText;
        emitQueueOpsEvent('announcement_update', {
            mode: 'live',
            consultorio,
            ticketCode,
        });
    }
    if (
        supportEl instanceof HTMLElement &&
        supportEl.textContent !== supportText
    ) {
        supportEl.textContent = supportText;
    }
}

function selectPrimaryCallingTicket(callingNow, byConsultorio) {
    const active = Array.isArray(callingNow) ? callingNow.filter(Boolean) : [];
    if (active.length === 0) {
        return null;
    }

    let bestTicket = active[0];
    let bestTs = Number.NEGATIVE_INFINITY;
    for (const ticket of active) {
        const calledAtTs = Date.parse(String(ticket?.calledAt || ''));
        if (Number.isFinite(calledAtTs) && calledAtTs >= bestTs) {
            bestTs = calledAtTs;
            bestTicket = ticket;
        }
    }

    if (Number.isFinite(bestTs)) {
        return bestTicket;
    }
    return byConsultorio[1] || byConsultorio[2] || bestTicket;
}

function setDisplayOpsHint(message) {
    const el = ensureDisplayOpsHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Estado operativo';
}

function ensureDisplayMetricsEl() {
    let el = getById('displayMetrics');
    if (el instanceof HTMLElement) {
        return el;
    }

    const announcement = ensureDisplayAnnouncementEl();
    if (!(announcement instanceof HTMLElement)) {
        return null;
    }

    ensureDisplayStarStyles();
    el = document.createElement('section');
    el.id = 'displayMetrics';
    el.className = 'display-metrics';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
        <span class="display-metric-chip" data-kind="waiting">
            En cola
            <strong data-metric="waiting">0</strong>
        </span>
        <span class="display-metric-chip" data-kind="active">
            Llamando
            <strong data-metric="active">0</strong>
        </span>
        <span class="display-metric-chip" data-kind="next">
            Siguientes
            <strong data-metric="next">0</strong>
        </span>
    `;
    announcement.insertAdjacentElement('afterend', el);
    return el;
}

function setMetricValue(container, metricName, value) {
    if (!(container instanceof HTMLElement)) return;
    const valueEl = container.querySelector(`[data-metric="${metricName}"]`);
    if (!(valueEl instanceof HTMLElement)) return;
    const nextValue = String(Math.max(0, Number(value || 0)));
    if (valueEl.textContent !== nextValue) {
        valueEl.textContent = nextValue;
    }
}

function renderDisplayMetrics(queueState) {
    const metricsEl = ensureDisplayMetricsEl();
    if (!(metricsEl instanceof HTMLElement)) return;

    const normalizedState = normalizeQueueStatePayload(queueState);
    const waitingCount = Number(normalizedState.waitingCount || 0);
    const callingCount = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow.length
        : 0;
    const nextCount = Array.isArray(normalizedState.nextTickets)
        ? normalizedState.nextTickets.length
        : 0;

    setMetricValue(metricsEl, 'waiting', waitingCount);
    setMetricValue(metricsEl, 'active', callingCount);
    setMetricValue(metricsEl, 'next', nextCount);
}

function ensureDisplayManualRefreshButton() {
    let button = getById('displayManualRefreshBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayManualRefreshBtn';
    button.type = 'button';
    button.className = 'display-control-btn';
    button.textContent = 'Refrescar panel';
    button.setAttribute('aria-label', 'Refrescar estado de turnos en pantalla');
    clockWrap.appendChild(button);
    return button;
}

function setDisplayManualRefreshLoading(isLoading) {
    const button = ensureDisplayManualRefreshButton();
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading ? 'Refrescando...' : 'Refrescar panel';
}

function ensureDisplayBellToggleButton() {
    let button = getById('displayBellToggleBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayBellToggleBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.setAttribute('aria-label', 'Alternar campanilla de llamados');
    clockWrap.appendChild(button);
    return button;
}

function ensureDisplayBellTestButton() {
    let button = getById('displayBellTestBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayBellTestBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.textContent = 'Probar campanilla';
    button.setAttribute('aria-label', 'Probar campanilla de llamados');
    clockWrap.appendChild(button);
    return button;
}

function renderBellToggle() {
    const button = ensureDisplayBellToggleButton();
    if (!(button instanceof HTMLButtonElement)) return;

    button.textContent = state.bellMuted ? 'Campanilla: Off' : 'Campanilla: On';
    button.dataset.state = state.bellMuted ? 'muted' : 'enabled';
    button.setAttribute('aria-pressed', String(state.bellMuted));
    button.title = state.bellMuted
        ? 'Campanilla en silencio'
        : 'Campanilla activa';
}

function persistBellPreference() {
    localStorage.setItem(
        DISPLAY_BELL_MUTED_STORAGE_KEY,
        state.bellMuted ? '1' : '0'
    );
}

function loadBellPreference() {
    const stored = localStorage.getItem(DISPLAY_BELL_MUTED_STORAGE_KEY);
    state.bellMuted = stored === '1';
}

function setBellMuted(nextMuted, { announce = false } = {}) {
    state.bellMuted = Boolean(nextMuted);
    persistBellPreference();
    renderBellToggle();
    emitQueueOpsEvent('bell_muted_changed', {
        muted: state.bellMuted,
        announce,
    });
    if (announce) {
        setDisplayOpsHint(
            state.bellMuted
                ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                : 'Campanilla activa para nuevos llamados.'
        );
    }
}

function toggleBellMuted() {
    setBellMuted(!state.bellMuted, { announce: true });
}

function normalizeQueueStateSnapshot(queueState) {
    const safeState = normalizeQueueStatePayload(queueState);
    return {
        updatedAt: String(safeState.updatedAt || new Date().toISOString()),
        waitingCount: Number(safeState.waitingCount || 0),
        calledCount: Number(safeState.calledCount || 0),
        callingNow: Array.isArray(safeState.callingNow)
            ? safeState.callingNow
            : [],
        nextTickets: Array.isArray(safeState.nextTickets)
            ? safeState.nextTickets
            : [],
    };
}

function persistLastSnapshot(queueState) {
    const data = normalizeQueueStateSnapshot(queueState);
    const snapshot = {
        savedAt: new Date().toISOString(),
        data,
    };
    state.lastSnapshot = snapshot;
    try {
        localStorage.setItem(
            DISPLAY_LAST_SNAPSHOT_STORAGE_KEY,
            JSON.stringify(snapshot)
        );
    } catch (_error) {
        // Ignore storage write failures.
    }
    renderSnapshotHint();
}

function loadLastSnapshot() {
    state.lastSnapshot = null;
    try {
        const raw = localStorage.getItem(DISPLAY_LAST_SNAPSHOT_STORAGE_KEY);
        if (!raw) {
            renderSnapshotHint();
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            renderSnapshotHint();
            return null;
        }

        const savedAtTs = Date.parse(String(parsed.savedAt || ''));
        if (!Number.isFinite(savedAtTs)) {
            renderSnapshotHint();
            return null;
        }
        if (Date.now() - savedAtTs > DISPLAY_LAST_SNAPSHOT_MAX_AGE_MS) {
            renderSnapshotHint();
            return null;
        }

        const data = normalizeQueueStateSnapshot(parsed.data || {});
        const snapshot = {
            savedAt: new Date(savedAtTs).toISOString(),
            data,
        };
        state.lastSnapshot = snapshot;
        renderSnapshotHint();
        return snapshot;
    } catch (_error) {
        renderSnapshotHint();
        return null;
    }
}

function renderFromSnapshot(snapshot, { mode = 'restore' } = {}) {
    if (!snapshot?.data) return false;

    renderState(snapshot.data);
    const ageMs = Math.max(
        0,
        Date.now() - Date.parse(String(snapshot.savedAt || ''))
    );
    const ageLabel = formatElapsedAge(ageMs);
    setConnectionStatus('reconnecting', 'Respaldo local activo');
    setDisplayOpsHint(
        mode === 'startup'
            ? `Mostrando respaldo local (${ageLabel}) mientras conecta.`
            : `Sin backend. Mostrando ultimo estado local (${ageLabel}).`
    );
    emitQueueOpsEvent('snapshot_restored', {
        mode,
        ageMs,
    });
    return true;
}

function ensureDisplaySnapshotHintEl() {
    let hint = getById('displaySnapshotHint');
    if (hint instanceof HTMLElement) {
        return hint;
    }

    const opsHint = ensureDisplayOpsHintEl();
    if (!opsHint?.parentElement) return null;

    hint = document.createElement('span');
    hint.id = 'displaySnapshotHint';
    hint.className = 'display-updated-at';
    hint.textContent = 'Respaldo: sin datos locales';
    opsHint.insertAdjacentElement('afterend', hint);
    return hint;
}

function renderSnapshotHint() {
    const hint = ensureDisplaySnapshotHintEl();
    if (!(hint instanceof HTMLElement)) return;

    if (!state.lastSnapshot?.savedAt) {
        hint.textContent = 'Respaldo: sin datos locales';
        return;
    }

    const savedAtTs = Date.parse(String(state.lastSnapshot.savedAt || ''));
    if (!Number.isFinite(savedAtTs)) {
        hint.textContent = 'Respaldo: sin datos locales';
        return;
    }
    hint.textContent = `Respaldo: ${formatElapsedAge(Date.now() - savedAtTs)} de antiguedad`;
}

function ensureDisplaySnapshotClearButton() {
    let button = getById('displaySnapshotClearBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displaySnapshotClearBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.textContent = 'Limpiar respaldo';
    button.setAttribute('aria-label', 'Limpiar respaldo local del panel');
    clockWrap.appendChild(button);
    return button;
}

function renderNoDataFallback(message = 'No hay turnos pendientes.') {
    state.lastRenderedSignature = '';
    state.lastCalledSignature = '';
    state.callBaselineReady = true;
    renderCalledTicket('displayConsultorio1', null, 'Consultorio 1');
    renderCalledTicket('displayConsultorio2', null, 'Consultorio 2');
    setDisplayAnnouncement(null);
    const list = getById('displayNextList');
    if (list) {
        list.innerHTML = `<li class="display-empty">${escapeHtml(message)}</li>`;
    }
}

function clearLastSnapshot({ announce = false } = {}) {
    state.lastSnapshot = null;
    state.lastRenderedSignature = '';
    try {
        localStorage.removeItem(DISPLAY_LAST_SNAPSHOT_STORAGE_KEY);
    } catch (_error) {
        // Ignore storage remove failures.
    }
    renderSnapshotHint();
    if (state.connectionState !== 'live') {
        renderNoDataFallback('Sin respaldo local disponible.');
        if (navigator.onLine === false) {
            setConnectionStatus('offline', 'Sin conexion');
        } else {
            setConnectionStatus('reconnecting', 'Sin respaldo local');
        }
    }
    if (announce) {
        setDisplayOpsHint(
            'Respaldo local limpiado. Esperando datos en vivo del backend.'
        );
    }
    emitQueueOpsEvent('snapshot_cleared', { announce });
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
    if (!state.lastHealthySyncAt) {
        return 'sin sincronizacion confirmada';
    }
    return `hace ${formatElapsedAge(Date.now() - state.lastHealthySyncAt)}`;
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
        stale: ageMs >= POLL_STALE_THRESHOLD_MS,
        missingTimestamp: false,
        ageMs,
    };
}

function renderCalledTicket(containerId, ticket, consultorioLabel) {
    const container = getById(containerId);
    if (!container) return;

    if (!ticket) {
        container.innerHTML = `
            <article class="display-called-card is-empty">
                <h3>${consultorioLabel}</h3>
                <p>Sin llamado activo</p>
            </article>
        `;
        return;
    }

    const calledAtTs = Date.parse(String(ticket.calledAt || ''));
    const isFreshCall =
        Number.isFinite(calledAtTs) && Date.now() - calledAtTs <= 8000;
    const cardClass = isFreshCall
        ? 'display-called-card is-live is-fresh'
        : 'display-called-card is-live';

    container.innerHTML = `
        <article class="${cardClass}">
            <h3>${consultorioLabel}</h3>
            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
        </article>
    `;
}

function renderNextTickets(nextTickets) {
    const list = getById('displayNextList');
    if (!list) return;

    if (!Array.isArray(nextTickets) || nextTickets.length === 0) {
        list.innerHTML =
            '<li class="display-empty">No hay turnos pendientes.</li>';
        return;
    }

    list.innerHTML = nextTickets
        .slice(0, 8)
        .map(
            (ticket) => `
                <li>
                    <span class="next-code">${escapeHtml(ticket.ticketCode || '--')}</span>
                    <span class="next-initials">${escapeHtml(ticket.patientInitials || '--')}</span>
                    <span class="next-position">#${escapeHtml(ticket.position || '-')}</span>
                </li>
            `
        )
        .join('');
}

function computeCalledSignature(callingNow) {
    if (!Array.isArray(callingNow) || callingNow.length === 0) {
        return '';
    }
    return callingNow
        .map((ticket) => {
            const consultorio = String(ticket.assignedConsultorio || '-');
            const id = Number(ticket.id || 0);
            const code = normalizeTicketCodeForDisplay(
                ticket.ticketCode || '--'
            );
            const key = id > 0 ? `id-${id}` : `code-${code}`;
            return `${consultorio}:${key}`;
        })
        .sort()
        .join('|');
}

function toSignatureSet(signature) {
    if (!signature) {
        return new Set();
    }
    return new Set(
        String(signature)
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean)
    );
}

function clearBellFlashClass() {
    if (state.bellFlashId) {
        window.clearTimeout(state.bellFlashId);
        state.bellFlashId = 0;
    }
    document.body.classList.remove(DISPLAY_BELL_FLASH_CLASS);
    const announcement = getById('displayAnnouncement');
    if (announcement instanceof HTMLElement) {
        announcement.classList.remove('is-bell');
    }
}

function triggerBellFlash() {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
        return;
    }

    clearBellFlashClass();
    // Restart animation deterministically for repeated calls.
    void body.offsetWidth;
    body.classList.add(DISPLAY_BELL_FLASH_CLASS);
    const announcement = getById('displayAnnouncement');
    if (announcement instanceof HTMLElement) {
        announcement.classList.add('is-bell');
    }
    state.bellFlashId = window.setTimeout(() => {
        clearBellFlashClass();
    }, DISPLAY_BELL_FLASH_DURATION_MS);
}

async function primeBellAudio({ source = 'unknown' } = {}) {
    try {
        if (!state.audioContext) {
            state.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }
        const ctx = state.audioContext;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        state.bellPrimed = ctx.state === 'running';
        emitQueueOpsEvent('bell_audio_primed', {
            source,
            running: state.bellPrimed,
        });
        return state.bellPrimed;
    } catch (_error) {
        state.bellPrimed = false;
        emitQueueOpsEvent('bell_audio_primed', {
            source,
            running: false,
        });
        return false;
    }
}

function showBellBlockedHintIfDue() {
    const now = Date.now();
    if (
        state.lastBellBlockedHintAt > 0 &&
        now - state.lastBellBlockedHintAt <
            DISPLAY_BELL_BLOCKED_HINT_COOLDOWN_MS
    ) {
        return;
    }
    state.lastBellBlockedHintAt = now;
    setDisplayOpsHint(
        'Audio bloqueado por navegador. Toca "Probar campanilla" una vez para habilitar sonido.'
    );
}

async function playBell({ source = 'new_call', force = false } = {}) {
    triggerBellFlash();
    if (state.bellMuted && !force) {
        return;
    }

    const now = Date.now();
    if (
        !force &&
        state.lastBellAt > 0 &&
        now - state.lastBellAt < DISPLAY_BELL_COOLDOWN_MS
    ) {
        return;
    }

    try {
        const canPlay = await primeBellAudio({ source });
        if (!canPlay) {
            showBellBlockedHintIfDue();
            return;
        }

        const ctx = state.audioContext;
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(932, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.24);
        state.lastBellAt = Date.now();
        emitQueueOpsEvent('bell_played', {
            source,
            muted: state.bellMuted,
        });
    } catch (_error) {
        showBellBlockedHintIfDue();
    }
}

function renderUpdatedAt(queueState) {
    const badge = getById('displayUpdatedAt');
    if (!badge) return;
    const normalizedState = normalizeQueueStatePayload(queueState);
    const ts = Date.parse(String(normalizedState.updatedAt || ''));
    if (!Number.isFinite(ts)) {
        badge.textContent = 'Actualizacion pendiente';
        return;
    }
    badge.textContent = `Actualizado ${new Date(ts).toLocaleTimeString(
        'es-EC',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
    )}`;
}

function computeDisplayRenderSignature(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const callingNow = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow.map((ticket) => ({
              id: Number(ticket?.id || 0),
              ticketCode: String(ticket?.ticketCode || ''),
              patientInitials: String(ticket?.patientInitials || ''),
              consultorio: Number(ticket?.assignedConsultorio || 0),
              calledAt: String(ticket?.calledAt || ''),
          }))
        : [];
    const nextTickets = Array.isArray(normalizedState.nextTickets)
        ? normalizedState.nextTickets.slice(0, 8).map((ticket) => ({
              id: Number(ticket?.id || 0),
              ticketCode: String(ticket?.ticketCode || ''),
              patientInitials: String(ticket?.patientInitials || ''),
              position: Number(ticket?.position || 0),
          }))
        : [];
    const updatedAt = String(normalizedState.updatedAt || '');
    return JSON.stringify({ updatedAt, callingNow, nextTickets });
}

function renderState(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const renderSignature = computeDisplayRenderSignature(normalizedState);
    const isSameRender = renderSignature === state.lastRenderedSignature;

    const callingNow = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow
        : [];
    const byConsultorio = {
        1: null,
        2: null,
    };
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            byConsultorio[consultorio] = ticket;
        }
    }
    const primaryCallingTicket = selectPrimaryCallingTicket(
        callingNow,
        byConsultorio
    );

    if (!isSameRender) {
        renderCalledTicket(
            'displayConsultorio1',
            byConsultorio[1],
            'Consultorio 1'
        );
        renderCalledTicket(
            'displayConsultorio2',
            byConsultorio[2],
            'Consultorio 2'
        );
        renderNextTickets(normalizedState?.nextTickets || []);
        renderUpdatedAt(normalizedState);
        state.lastRenderedSignature = renderSignature;
        emitQueueOpsEvent('render_update', {
            callingNowCount: callingNow.length,
            nextCount: Array.isArray(normalizedState?.nextTickets)
                ? normalizedState.nextTickets.length
                : 0,
        });
    }
    setDisplayAnnouncement(primaryCallingTicket);
    renderDisplayMetrics(normalizedState);

    const nextSignature = computeCalledSignature(callingNow);
    if (!state.callBaselineReady) {
        state.lastCalledSignature = nextSignature;
        state.callBaselineReady = true;
        return;
    }

    if (nextSignature !== state.lastCalledSignature) {
        const previousSet = toSignatureSet(state.lastCalledSignature);
        const currentSet = toSignatureSet(nextSignature);
        const addedCalls = [];
        for (const item of currentSet) {
            if (!previousSet.has(item)) {
                addedCalls.push(item);
            }
        }
        if (addedCalls.length > 0) {
            void playBell({ source: 'new_call' });
        }
        emitQueueOpsEvent('called_signature_changed', {
            signature: nextSignature,
            added_count: addedCalls.length,
        });
    }
    state.lastCalledSignature = nextSignature;
}

function getPollDelayMs() {
    const attempts = Math.max(0, Number(state.failureStreak || 0));
    const delay = POLL_MS * Math.pow(2, Math.min(attempts, 3));
    return Math.min(POLL_MAX_MS, delay);
}

function clearPollingTimer() {
    if (!state.pollingId) return;
    window.clearTimeout(state.pollingId);
    state.pollingId = 0;
}

function scheduleNextPoll({ immediate = false } = {}) {
    clearPollingTimer();
    if (!state.pollingEnabled) return;
    const delay = immediate ? 0 : getPollDelayMs();
    state.pollingId = window.setTimeout(() => {
        void runDisplayPollTick();
    }, delay);
}

async function refreshDisplayState() {
    if (state.refreshBusy) {
        return { ok: false, stale: false, reason: 'busy' };
    }
    state.refreshBusy = true;
    try {
        const payload = await apiRequest('queue-state');
        const queueState = normalizeQueueStatePayload(payload.data || {});
        renderState(queueState);
        persistLastSnapshot(queueState);
        const freshness = evaluateQueueFreshness(queueState);
        return {
            ok: true,
            stale: Boolean(freshness.stale),
            missingTimestamp: Boolean(freshness.missingTimestamp),
            ageMs: freshness.ageMs,
            usedSnapshot: false,
        };
    } catch (error) {
        const snapshotRestored = renderFromSnapshot(state.lastSnapshot, {
            mode: 'restore',
        });
        if (!snapshotRestored) {
            const list = getById('displayNextList');
            if (list) {
                list.innerHTML = `<li class="display-empty">Sin conexion: ${escapeHtml(error.message)}</li>`;
            }
        }
        return {
            ok: false,
            stale: false,
            reason: 'fetch_error',
            errorMessage: error.message,
            usedSnapshot: snapshotRestored,
        };
    } finally {
        state.refreshBusy = false;
    }
}

async function runDisplayPollTick() {
    if (!state.pollingEnabled) return;

    if (document.hidden) {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        setDisplayOpsHint('Pantalla en pausa por pestana oculta.');
        scheduleNextPoll();
        return;
    }

    if (navigator.onLine === false) {
        state.failureStreak += 1;
        const restored = renderFromSnapshot(state.lastSnapshot, {
            mode: 'restore',
        });
        if (!restored) {
            setConnectionStatus('offline', 'Sin conexion');
            setDisplayOpsHint(
                'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
            );
        }
        scheduleNextPoll();
        return;
    }

    const refreshResult = await refreshDisplayState();
    if (refreshResult.ok && !refreshResult.stale) {
        state.failureStreak = 0;
        state.lastHealthySyncAt = Date.now();
        setConnectionStatus('live', 'Conectado');
        setDisplayOpsHint(`Panel estable (${formatLastHealthySyncAge()}).`);
    } else if (refreshResult.ok && refreshResult.stale) {
        state.failureStreak += 1;
        const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
        setConnectionStatus(
            'reconnecting',
            `Watchdog: datos estancados ${staleAge}`
        );
        setDisplayOpsHint(
            `Datos estancados ${staleAge}. Verifica fuente de cola.`
        );
    } else {
        state.failureStreak += 1;
        if (refreshResult.usedSnapshot) {
            scheduleNextPoll();
            return;
        }
        const retrySeconds = Math.max(1, Math.ceil(getPollDelayMs() / 1000));
        setConnectionStatus('reconnecting', `Reconectando en ${retrySeconds}s`);
        setDisplayOpsHint(
            `Conexion inestable. Reintento automatico en ${retrySeconds}s.`
        );
    }
    scheduleNextPoll();
}

async function runDisplayManualRefresh() {
    if (state.manualRefreshBusy) return;
    state.manualRefreshBusy = true;
    setDisplayManualRefreshLoading(true);
    setConnectionStatus('reconnecting', 'Refrescando panel...');

    try {
        const refreshResult = await refreshDisplayState();
        if (refreshResult.ok && !refreshResult.stale) {
            state.failureStreak = 0;
            state.lastHealthySyncAt = Date.now();
            setConnectionStatus('live', 'Conectado');
            setDisplayOpsHint(
                `Sincronizacion manual exitosa (${formatLastHealthySyncAge()}).`
            );
            return;
        }
        if (refreshResult.ok && refreshResult.stale) {
            const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
            setConnectionStatus(
                'reconnecting',
                `Watchdog: datos estancados ${staleAge}`
            );
            setDisplayOpsHint(`Persisten datos estancados (${staleAge}).`);
            return;
        }
        if (refreshResult.usedSnapshot) {
            return;
        }
        const retrySeconds = Math.max(1, Math.ceil(getPollDelayMs() / 1000));
        setConnectionStatus(
            navigator.onLine === false ? 'offline' : 'reconnecting',
            navigator.onLine === false
                ? 'Sin conexion'
                : `Reconectando en ${retrySeconds}s`
        );
        setDisplayOpsHint(
            navigator.onLine === false
                ? 'Sin internet. Llamado manual temporal.'
                : `Refresh manual sin exito. Reintento automatico en ${retrySeconds}s.`
        );
    } finally {
        state.manualRefreshBusy = false;
        setDisplayManualRefreshLoading(false);
    }
}

function startDisplayPolling({ immediate = true } = {}) {
    state.pollingEnabled = true;
    if (immediate) {
        setConnectionStatus('live', 'Sincronizando...');
        void runDisplayPollTick();
        return;
    }
    scheduleNextPoll();
}

function stopDisplayPolling({ reason = 'paused' } = {}) {
    state.pollingEnabled = false;
    state.failureStreak = 0;
    clearPollingTimer();

    const normalizedReason = String(reason || 'paused').toLowerCase();
    if (normalizedReason === 'offline') {
        setConnectionStatus('offline', 'Sin conexion');
        setDisplayOpsHint(
            'Sin conexion. Mantener protocolo manual de llamados.'
        );
        return;
    }
    if (normalizedReason === 'hidden') {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        setDisplayOpsHint('Pantalla oculta. Reanuda al volver al frente.');
        return;
    }
    setConnectionStatus('paused', 'En pausa');
    setDisplayOpsHint('Sincronizacion pausada.');
}

function updateClock() {
    const el = getById('displayClock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initDisplay() {
    document.body.dataset.displayMode = 'star';
    ensureDisplayStarStyles();
    loadBellPreference();
    loadLastSnapshot();
    updateClock();
    state.clockId = window.setInterval(updateClock, 1000);

    ensureDisplayOpsHintEl();
    ensureDisplaySnapshotHintEl();
    ensureDisplayAnnouncementEl();
    ensureDisplayMetricsEl();
    const manualRefreshButton = ensureDisplayManualRefreshButton();
    if (manualRefreshButton instanceof HTMLButtonElement) {
        manualRefreshButton.addEventListener('click', () => {
            void runDisplayManualRefresh();
        });
    }
    const bellToggleButton = ensureDisplayBellToggleButton();
    if (bellToggleButton instanceof HTMLButtonElement) {
        bellToggleButton.addEventListener('click', () => {
            toggleBellMuted();
        });
    }
    const bellTestButton = ensureDisplayBellTestButton();
    if (bellTestButton instanceof HTMLButtonElement) {
        bellTestButton.addEventListener('click', () => {
            void playBell({ source: 'manual_test', force: true });
            setDisplayOpsHint(
                'Campanilla de prueba ejecutada. Si no escuchas sonido, revisa audio del equipo/TV.'
            );
        });
    }
    const clearSnapshotButton = ensureDisplaySnapshotClearButton();
    if (clearSnapshotButton instanceof HTMLButtonElement) {
        clearSnapshotButton.addEventListener('click', () => {
            clearLastSnapshot({ announce: true });
        });
    }
    renderBellToggle();
    renderSnapshotHint();

    setConnectionStatus('paused', 'Sincronizacion lista');
    if (!renderFromSnapshot(state.lastSnapshot, { mode: 'startup' })) {
        setDisplayOpsHint('Esperando primera sincronizacion...');
    }

    const unlockAudio = () => {
        void primeBellAudio({ source: 'user_gesture' });
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    startDisplayPolling({ immediate: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopDisplayPolling({ reason: 'hidden' });
            return;
        }
        startDisplayPolling({ immediate: true });
    });

    window.addEventListener('online', () => {
        startDisplayPolling({ immediate: true });
    });

    window.addEventListener('offline', () => {
        stopDisplayPolling({ reason: 'offline' });
    });

    window.addEventListener('beforeunload', () => {
        stopDisplayPolling({ reason: 'paused' });
        if (state.clockId) {
            window.clearInterval(state.clockId);
            state.clockId = 0;
        }
    });

    window.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey) return;
        const keyCode = String(event.code || '').toLowerCase();
        if (keyCode === 'keyr') {
            event.preventDefault();
            void runDisplayManualRefresh();
            return;
        }
        if (keyCode === 'keym') {
            event.preventDefault();
            toggleBellMuted();
            return;
        }
        if (keyCode === 'keyb') {
            event.preventDefault();
            void playBell({ source: 'shortcut_test', force: true });
            setDisplayOpsHint('Campanilla de prueba ejecutada con teclado.');
            return;
        }
        if (keyCode === 'keyx') {
            event.preventDefault();
            clearLastSnapshot({ announce: true });
        }
    });
}

document.addEventListener('DOMContentLoaded', initDisplay);
