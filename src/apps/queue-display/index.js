const API_ENDPOINT = '/api.php';
const POLL_MS = 2500;

const state = {
    lastCalledSignature: '',
    audioContext: null,
    pollingId: 0,
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
        list.innerHTML = '<li class="display-empty">No hay turnos pendientes.</li>';
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
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    badge.textContent = `Actualizado ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })}`;
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

    renderCalledTicket('displayConsultorio1', byConsultorio[1], 'Consultorio 1');
    renderCalledTicket('displayConsultorio2', byConsultorio[2], 'Consultorio 2');
    renderNextTickets(queueState?.nextTickets || []);
    renderUpdatedAt(queueState);

    const signature = computeCalledSignature(callingNow);
    if (signature && signature !== state.lastCalledSignature) {
        playBell();
    }
    state.lastCalledSignature = signature;
}

async function refreshDisplayState() {
    try {
        const payload = await apiRequest('queue-state');
        renderState(payload.data || {});
    } catch (error) {
        const list = getById('displayNextList');
        if (list) {
            list.innerHTML = `<li class="display-empty">Sin conexion: ${escapeHtml(error.message)}</li>`;
        }
    }
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
    window.setInterval(updateClock, 1000);

    void refreshDisplayState();
    state.pollingId = window.setInterval(() => {
        void refreshDisplayState();
    }, POLL_MS);
}

document.addEventListener('DOMContentLoaded', initDisplay);
