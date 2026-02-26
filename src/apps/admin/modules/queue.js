import { apiRequest } from './api.js';
import { currentQueueMeta, currentQueueTickets, setQueueMeta, setQueueTickets } from './state.js';
import { escapeHtml, showToast } from './ui.js';

const QUEUE_STATUS_LABELS = {
    waiting: 'En espera',
    called: 'Llamado',
    completed: 'Completado',
    no_show: 'No asistio',
    cancelled: 'Cancelado',
};

const QUEUE_PRIORITY_LABELS = {
    appt_overdue: 'Cita vencida',
    appt_current: 'Cita vigente',
    walk_in: 'Walk-in',
};

function formatDateTime(value) {
    const ts = Date.parse(String(value || ''));
    if (!Number.isFinite(ts)) {
        return '--';
    }
    return new Date(ts).toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function normalizeQueueMetaFromState(queueState) {
    const callingNowByConsultorio = {
        '1': null,
        '2': null,
    };

    const callingNow = Array.isArray(queueState?.callingNow)
        ? queueState.callingNow
        : [];
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            callingNowByConsultorio[String(consultorio)] = ticket;
        }
    }

    return {
        updatedAt: queueState?.updatedAt || new Date().toISOString(),
        waitingCount: Number(queueState?.waitingCount || 0),
        calledCount: Number(queueState?.calledCount || 0),
        counts: queueState?.counts || {},
        callingNowByConsultorio,
        nextTickets: Array.isArray(queueState?.nextTickets)
            ? queueState.nextTickets
            : [],
    };
}

function getSortedTickets() {
    const statusRank = {
        waiting: 0,
        called: 1,
        completed: 2,
        no_show: 3,
        cancelled: 4,
    };

    return [...(Array.isArray(currentQueueTickets) ? currentQueueTickets : [])].sort(
        (a, b) => {
            const rankDiff =
                (statusRank[a?.status] ?? 9) - (statusRank[b?.status] ?? 9);
            if (rankDiff !== 0) return rankDiff;
            const aTs = Date.parse(String(a?.createdAt || ''));
            const bTs = Date.parse(String(b?.createdAt || ''));
            if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
                return aTs - bTs;
            }
            return Number(a?.id || 0) - Number(b?.id || 0);
        }
    );
}

function updateTicketInState(nextTicket) {
    if (!nextTicket || typeof nextTicket !== 'object') return;
    const ticketId = Number(nextTicket.id || 0);
    if (!ticketId) return;

    const tickets = Array.isArray(currentQueueTickets) ? [...currentQueueTickets] : [];
    const index = tickets.findIndex((ticket) => Number(ticket?.id || 0) === ticketId);
    if (index >= 0) {
        tickets[index] = { ...tickets[index], ...nextTicket };
    } else {
        tickets.push(nextTicket);
    }
    setQueueTickets(tickets);
}

function renderQueueOverview() {
    const queueMeta = currentQueueMeta && typeof currentQueueMeta === 'object'
        ? currentQueueMeta
        : {
              waitingCount: 0,
              calledCount: 0,
              nextTickets: [],
              callingNowByConsultorio: { '1': null, '2': null },
              updatedAt: '',
          };

    const waitingCountEl = document.getElementById('queueWaitingCountAdmin');
    const calledCountEl = document.getElementById('queueCalledCountAdmin');
    const sidebarBadgeEl = document.getElementById('queueBadge');
    const consultorio1El = document.getElementById('queueC1Now');
    const consultorio2El = document.getElementById('queueC2Now');
    const nextListEl = document.getElementById('queueNextAdminList');
    const updatedAtEl = document.getElementById('queueLastUpdate');

    if (waitingCountEl) waitingCountEl.textContent = String(queueMeta.waitingCount || 0);
    if (calledCountEl) calledCountEl.textContent = String(queueMeta.calledCount || 0);
    if (sidebarBadgeEl) sidebarBadgeEl.textContent = String(queueMeta.waitingCount || 0);
    if (updatedAtEl) updatedAtEl.textContent = formatDateTime(queueMeta.updatedAt);

    const consultorio1 = queueMeta?.callingNowByConsultorio?.['1'];
    const consultorio2 = queueMeta?.callingNowByConsultorio?.['2'];

    if (consultorio1El) {
        consultorio1El.textContent = consultorio1
            ? `${consultorio1.ticketCode || '--'} · ${consultorio1.patientInitials || '--'}`
            : 'Sin llamado';
    }
    if (consultorio2El) {
        consultorio2El.textContent = consultorio2
            ? `${consultorio2.ticketCode || '--'} · ${consultorio2.patientInitials || '--'}`
            : 'Sin llamado';
    }

    if (nextListEl) {
        const nextTickets = Array.isArray(queueMeta.nextTickets)
            ? queueMeta.nextTickets
            : [];
        if (nextTickets.length === 0) {
            nextListEl.innerHTML = '<li class="empty-message">No hay turnos en espera.</li>';
        } else {
            nextListEl.innerHTML = nextTickets
                .map(
                    (ticket) => `
                        <li>
                            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
                            <span>#${escapeHtml(ticket.position || '-')}</span>
                        </li>
                    `
                )
                .join('');
        }
    }
}

function renderQueueTable() {
    const tableBody = document.getElementById('queueTableBody');
    if (!tableBody) return;

    const tickets = getSortedTickets();
    if (tickets.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">Sin tickets en cola.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = tickets
        .map((ticket) => {
            const id = Number(ticket.id || 0);
            const status = String(ticket.status || 'waiting');
            const canCall = status === 'waiting' || status === 'called';

            return `
                <tr>
                    <td>${escapeHtml(ticket.ticketCode || '--')}</td>
                    <td>${escapeHtml(ticket.queueType || '--')}</td>
                    <td>${escapeHtml(QUEUE_PRIORITY_LABELS[ticket.priorityClass] || ticket.priorityClass || '--')}</td>
                    <td>${escapeHtml(QUEUE_STATUS_LABELS[status] || status)}</td>
                    <td>${escapeHtml(ticket.assignedConsultorio || '-')}</td>
                    <td>${escapeHtml(formatDateTime(ticket.createdAt))}</td>
                    <td>${escapeHtml(ticket.patientInitials || '--')}</td>
                    <td>
                        <div class="queue-actions">
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reprint-ticket" data-queue-id="${id}">
                                Reimprimir
                            </button>
                            ${
                                canCall
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${id}">
                                Re-llamar
                            </button>`
                                    : ''
                            }
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${id}">
                                Completar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${id}">
                                No show
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${id}">
                                Cancelar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${id}">
                                C1
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${id}">
                                C2
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderQueueSection() {
    renderQueueOverview();
    renderQueueTable();
}

export function isQueueSectionActive() {
    return document.querySelector('.nav-item.active')?.dataset.section === 'queue';
}

export async function refreshQueueRealtime({ silent = false } = {}) {
    try {
        const payload = await apiRequest('data');
        const data = payload.data || {};
        setQueueTickets(Array.isArray(data.queue_tickets) ? data.queue_tickets : []);
        setQueueMeta(
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : null
        );
        renderQueueSection();
        return true;
    } catch (error) {
        if (!silent) {
            showToast(`No se pudo actualizar turnero: ${error.message}`, 'warning');
        }
        return false;
    }
}

export function loadQueueSection() {
    renderQueueSection();
    void refreshQueueRealtime({ silent: true });
}

export async function callNextForConsultorio(consultorio) {
    const room = Number(consultorio || 0);
    if (![1, 2].includes(room)) {
        showToast('Consultorio invalido', 'error');
        return;
    }

    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: { consultorio: room },
        });
        const ticket = payload?.data?.ticket || null;
        updateTicketInState(ticket);
        setQueueMeta(normalizeQueueMetaFromState(payload?.data?.queueState || {}));
        renderQueueSection();
        if (ticket && ticket.ticketCode) {
            showToast(`Llamando ${ticket.ticketCode} en Consultorio ${room}`, 'success');
        } else {
            showToast(`Consultorio ${room} actualizado`, 'success');
        }
    } catch (error) {
        showToast(`No se pudo llamar siguiente turno: ${error.message}`, 'error');
    }
}

export async function applyQueueTicketAction(ticketId, action, consultorio = null) {
    const id = Number(ticketId || 0);
    if (!id || !action) {
        showToast('Accion de ticket invalida', 'error');
        return;
    }

    const body = { id, action };
    const room = Number(consultorio || 0);
    if ([1, 2].includes(room)) {
        body.consultorio = room;
    }

    try {
        const payload = await apiRequest('queue-ticket', {
            method: 'PATCH',
            body,
        });
        const ticket = payload?.data?.ticket || null;
        updateTicketInState(ticket);
        setQueueMeta(normalizeQueueMetaFromState(payload?.data?.queueState || {}));
        renderQueueSection();
        showToast('Turno actualizado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar ticket: ${error.message}`, 'error');
    }
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) {
        showToast('Ticket invalido para reimpresion', 'error');
        return;
    }

    try {
        const payload = await apiRequest('queue-reprint', {
            method: 'POST',
            body: { id },
        });
        if (payload?.printed) {
            showToast('Ticket reimpreso', 'success');
        } else {
            const detail = payload?.print?.message || 'sin detalle';
            showToast(`Ticket generado sin impresion: ${detail}`, 'warning');
        }
    } catch (error) {
        showToast(`No se pudo reimprimir ticket: ${error.message}`, 'error');
    }
}
