import { getState } from '../../../core/store.js';
import { createToast } from '../../../ui/render.js';
import { CALL_NEXT_IN_FLIGHT, SENSITIVE_QUEUE_ACTIONS } from '../constants.js';
import {
    getCalledTicketForConsultorio,
    getQueueTicketById,
    getWaitingForConsultorio,
} from '../selectors.js';
import { appendActivity } from '../state.js';
import { showSensitiveConfirm } from '../render.js';
import { executeTicketAction } from './execute.js';
import { requiresSensitiveConfirm, setTicketCalledLocal } from './shared.js';
import { apiRequest } from '../../../core/api-client.js';
import { applyQueueStateResponse } from '../sync.js';
import { normalizeQueueAction } from '../helpers.js';
import {
    notifyAdminQueuePilotBlocked,
    shouldBlockAdminQueueAction,
} from '../pilot-guard.js';

export async function callNextForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const state = getState();
    if (CALL_NEXT_IN_FLIGHT.get(target)) return;
    if (shouldBlockAdminQueueAction('queue-call-next')) {
        notifyAdminQueuePilotBlocked('queue-call-next');
        return;
    }

    if (
        state.queue.stationMode === 'locked' &&
        state.queue.stationConsultorio !== target
    ) {
        appendActivity(
            `Llamado bloqueado para C${target} por lock de estacion`
        );
        createToast('Modo bloqueado: consultorio no permitido', 'warning');
        return;
    }

    if (state.queue.practiceMode) {
        const candidate = getWaitingForConsultorio(target);
        if (!candidate) {
            appendActivity('Practica: sin tickets en espera');
            return;
        }
        setTicketCalledLocal(candidate.id, target);
        appendActivity(
            `Practica: llamado ${candidate.ticketCode} en C${target}`
        );
        return;
    }

    CALL_NEXT_IN_FLIGHT.set(target, true);
    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: { consultorio: target },
        });
        applyQueueStateResponse(payload, {
            syncMode: 'live',
            bumpRuntimeRevision: true,
        });
        appendActivity(`Llamado C${target} ejecutado`);
    } catch (_error) {
        appendActivity(`Error llamando siguiente en C${target}`);
        createToast(`Error llamando siguiente en C${target}`, 'error');
    } finally {
        CALL_NEXT_IN_FLIGHT.set(target, false);
    }
}

export async function runQueueTicketAction(ticketId, action, consultorio = 0) {
    const payload = {
        ticketId: Number(ticketId || 0),
        action: normalizeQueueAction(action),
        consultorio: Number(consultorio || 0),
    };
    if (shouldBlockAdminQueueAction('queue-ticket-action')) {
        notifyAdminQueuePilotBlocked('queue-ticket-action');
        return;
    }
    const state = getState();
    const currentTicket = getQueueTicketById(payload.ticketId);
    if (
        !state.queue.practiceMode &&
        SENSITIVE_QUEUE_ACTIONS.has(payload.action) &&
        requiresSensitiveConfirm(payload.action, currentTicket)
    ) {
        showSensitiveConfirm(payload);
        appendActivity(`Accion ${payload.action} pendiente de confirmacion`);
        return;
    }
    await executeTicketAction(payload);
}

export async function runQueueReleaseStation(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const activeTicket = getCalledTicketForConsultorio(target);
    if (!activeTicket) {
        appendActivity(`Sin ticket activo para liberar en C${target}`);
        return;
    }
    await runQueueTicketAction(activeTicket.id, 'liberar', target);
}
