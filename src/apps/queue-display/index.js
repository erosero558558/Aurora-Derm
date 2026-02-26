const API_ENDPOINT = '/api.php';
const POLL_MS = 2500;
const POLL_MAX_MS = 15000;
const POLL_STALE_THRESHOLD_MS = 30000;

const state = {
    lastCalledSignature: '',
    audioContext: null,
    pollingId: 0,
    clockId: 0,
    pollingEnabled: false,
    failureStreak: 0,
    refreshBusy: false,
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

    el.dataset.state = normalized;
    el.textContent =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;
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
        const freshness = evaluateQueueFreshness(queueState);
        return {
            ok: true,
            stale: Boolean(freshness.stale),
            missingTimestamp: Boolean(freshness.missingTimestamp),
            ageMs: freshness.ageMs,
        };
    } catch (error) {
        const list = getById('displayNextList');
        if (list) {
            list.innerHTML = `<li class="display-empty">Sin conexion: ${escapeHtml(error.message)}</li>`;
        }
        return {
            ok: false,
            stale: false,
            reason: 'fetch_error',
            errorMessage: error.message,
        };
    } finally {
        state.refreshBusy = false;
    }
}

async function runDisplayPollTick() {
    if (!state.pollingEnabled) return;

    if (document.hidden) {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        scheduleNextPoll();
        return;
    }

    if (navigator.onLine === false) {
        state.failureStreak += 1;
        setConnectionStatus('offline', 'Sin conexion');
        scheduleNextPoll();
        return;
    }

    const refreshResult = await refreshDisplayState();
    if (refreshResult.ok && !refreshResult.stale) {
        state.failureStreak = 0;
        setConnectionStatus('live', 'Conectado');
    } else if (refreshResult.ok && refreshResult.stale) {
        state.failureStreak += 1;
        const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
        setConnectionStatus(
            'reconnecting',
            `Watchdog: datos estancados ${staleAge}`
        );
    } else {
        state.failureStreak += 1;
        const retrySeconds = Math.max(1, Math.ceil(getPollDelayMs() / 1000));
        setConnectionStatus('reconnecting', `Reconectando en ${retrySeconds}s`);
    }
    scheduleNextPoll();
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
        return;
    }
    if (normalizedReason === 'hidden') {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        return;
    }
    setConnectionStatus('paused', 'En pausa');
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
    updateClock();
    state.clockId = window.setInterval(updateClock, 1000);

    setConnectionStatus('paused', 'Sincronizacion lista');
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
}

document.addEventListener('DOMContentLoaded', initDisplay);
