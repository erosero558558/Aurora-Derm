const API_ENDPOINT = '/api.php';
const POLL_MS = 2500;
const POLL_MAX_MS = 15000;
const POLL_STALE_THRESHOLD_MS = 30000;
const DISPLAY_BELL_MUTED_STORAGE_KEY = 'queueDisplayBellMuted';
const DISPLAY_LAST_SNAPSHOT_STORAGE_KEY = 'queueDisplayLastSnapshot';
const DISPLAY_LAST_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const state = {
    lastCalledSignature: '',
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
};

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

    state.connectionState = normalized;
    el.dataset.state = normalized;
    el.textContent =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;
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

function setDisplayOpsHint(message) {
    const el = ensureDisplayOpsHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Estado operativo';
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
    button.textContent = 'Refrescar panel';
    button.style.justifySelf = 'end';
    button.style.border = '1px solid var(--border)';
    button.style.borderRadius = '0.6rem';
    button.style.padding = '0.34rem 0.55rem';
    button.style.background = 'rgb(24 39 67 / 64%)';
    button.style.color = 'var(--text)';
    button.style.cursor = 'pointer';
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
    button.style.justifySelf = 'end';
    button.style.border = '1px solid var(--border)';
    button.style.borderRadius = '0.6rem';
    button.style.padding = '0.34rem 0.55rem';
    button.style.background = 'rgb(24 39 67 / 64%)';
    button.style.color = 'var(--text)';
    button.style.cursor = 'pointer';
    button.style.fontSize = '0.8rem';
    button.style.fontWeight = '600';
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
    const safeState =
        queueState && typeof queueState === 'object' ? queueState : {};
    return {
        updatedAt: String(safeState.updatedAt || new Date().toISOString()),
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
    button.style.justifySelf = 'end';
    button.style.border = '1px solid var(--border)';
    button.style.borderRadius = '0.6rem';
    button.style.padding = '0.34rem 0.55rem';
    button.style.background = 'rgb(24 39 67 / 64%)';
    button.style.color = 'var(--text)';
    button.style.cursor = 'pointer';
    button.style.fontSize = '0.8rem';
    button.style.fontWeight = '600';
    button.textContent = 'Limpiar respaldo';
    clockWrap.appendChild(button);
    return button;
}

function renderNoDataFallback(message = 'No hay turnos pendientes.') {
    renderCalledTicket('displayConsultorio1', null, 'Consultorio 1');
    renderCalledTicket('displayConsultorio2', null, 'Consultorio 2');
    const list = getById('displayNextList');
    if (list) {
        list.innerHTML = `<li class="display-empty">${escapeHtml(message)}</li>`;
    }
}

function clearLastSnapshot({ announce = false } = {}) {
    state.lastSnapshot = null;
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

    container.innerHTML = `
        <article class="display-called-card">
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
            const code = String(ticket.ticketCode || '');
            const calledAt = String(ticket.calledAt || '');
            return `${consultorio}:${code}:${calledAt}`;
        })
        .sort()
        .join('|');
}

function playBell() {
    if (state.bellMuted) {
        return;
    }
    try {
        if (!state.audioContext) {
            state.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
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
    } catch (_error) {
        // Silent fail for browsers that block autoplay audio.
    }
}

function renderUpdatedAt(queueState) {
    const badge = getById('displayUpdatedAt');
    if (!badge) return;
    const ts = Date.parse(String(queueState?.updatedAt || ''));
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

function renderState(queueState) {
    const callingNow = Array.isArray(queueState?.callingNow)
        ? queueState.callingNow
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
    renderNextTickets(queueState?.nextTickets || []);
    renderUpdatedAt(queueState);

    const signature = computeCalledSignature(callingNow);
    if (signature && signature !== state.lastCalledSignature) {
        playBell();
    }
    state.lastCalledSignature = signature;
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
        const queueState = payload.data || {};
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
    loadBellPreference();
    loadLastSnapshot();
    updateClock();
    state.clockId = window.setInterval(updateClock, 1000);

    ensureDisplayOpsHintEl();
    ensureDisplaySnapshotHintEl();
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
        if (keyCode === 'keyx') {
            event.preventDefault();
            clearLastSnapshot({ announce: true });
        }
    });
}

document.addEventListener('DOMContentLoaded', initDisplay);
