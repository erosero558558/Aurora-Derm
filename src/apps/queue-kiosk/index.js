const API_ENDPOINT = '/api.php';
const CHAT_ENDPOINT = '/figo-chat.php';
const QUEUE_POLL_MS = 2500;
const THEME_STORAGE_KEY = 'kioskThemeMode';

const state = {
    queueState: null,
    chatHistory: [],
    assistantBusy: false,
    queueTimerId: 0,
    themeMode: 'system',
    mediaQuery: null,
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
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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
            callingNowEl.innerHTML = '<p class="queue-empty">Sin llamados activos.</p>';
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
    try {
        const payload = await apiRequest('queue-state');
        state.queueState = payload.data || {};
        renderQueuePanel(state.queueState);
    } catch (error) {
        setKioskStatus(
            `No se pudo actualizar la cola en vivo: ${error.message}`,
            'warning'
        );
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
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const phoneInput = getById('checkinPhone');
    const timeInput = getById('checkinTime');
    const dateInput = getById('checkinDate');
    const initialsInput = getById('checkinInitials');
    const submitBtn = getById('checkinSubmit');

    const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
    const time = timeInput instanceof HTMLInputElement ? timeInput.value.trim() : '';
    const date = dateInput instanceof HTMLInputElement ? dateInput.value.trim() : '';
    const patientInitials =
        initialsInput instanceof HTMLInputElement ? initialsInput.value.trim() : '';

    if (!phone || !time || !date) {
        setKioskStatus('Telefono, fecha y hora son obligatorios para check-in', 'error');
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
        renderTicketResult(payload, payload.replay ? 'Check-in ya existente' : 'Check-in de cita');
        await refreshQueueState();
    } catch (error) {
        setKioskStatus(`No se pudo registrar el check-in: ${error.message}`, 'error');
    } finally {
        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
        }
    }
}

async function submitWalkIn(event) {
    event.preventDefault();
    const nameInput = getById('walkinName');
    const initialsInput = getById('walkinInitials');
    const phoneInput = getById('walkinPhone');
    const submitBtn = getById('walkinSubmit');

    const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
    const initialsRaw =
        initialsInput instanceof HTMLInputElement ? initialsInput.value.trim() : '';
    const patientInitials = initialsRaw || deriveInitials(name);
    const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';

    if (!patientInitials) {
        setKioskStatus('Ingresa iniciales o nombre para generar el turno', 'error');
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
        await refreshQueueState();
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

    if (/(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(normalized)) {
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
        const aiText = String(payload?.choices?.[0]?.message?.content || '').trim();
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

function applyTheme(mode) {
    state.themeMode = mode;
    const root = document.documentElement;
    const prefersDark =
        state.mediaQuery instanceof MediaQueryList
            ? state.mediaQuery.matches
            : false;
    const activeMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
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

function initKiosk() {
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

    appendAssistantMessage(
        'bot',
        'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
    );

    void refreshQueueState();
    state.queueTimerId = window.setInterval(() => {
        void refreshQueueState();
    }, QUEUE_POLL_MS);
}

document.addEventListener('DOMContentLoaded', initKiosk);
