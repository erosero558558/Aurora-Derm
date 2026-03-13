import { apiRequest } from '../../../core/api-client.js';
import { getState } from '../../../core/store.js';
import { appendActivity } from '../state.js';
import { applyQueueStateResponse } from '../sync.js';
import { normalizeQueueAction } from '../helpers.js';
import { setTicketStatusLocal } from './shared.js';
import {
    notifyAdminQueuePilotBlocked,
    shouldBlockAdminQueueAction,
} from '../pilot-guard.js';

function applyPracticeTicketAction(targetId, targetAction, consultorio) {
    if (targetAction === 'reasignar' || targetAction === 're-llamar') {
        setTicketStatusLocal(
            targetId,
            'called',
            Number(consultorio || 1) === 2 ? 2 : 1
        );
        return;
    }

    if (targetAction === 'liberar') {
        setTicketStatusLocal(targetId, 'waiting', null);
        return;
    }

    if (targetAction === 'completar') {
        setTicketStatusLocal(targetId, 'completed');
        return;
    }

    if (targetAction === 'no_show') {
        setTicketStatusLocal(targetId, 'no_show');
        return;
    }

    if (targetAction === 'cancelar') {
        setTicketStatusLocal(targetId, 'cancelled');
    }
}

export async function executeTicketAction({ ticketId, action, consultorio }) {
    const targetId = Number(ticketId || 0);
    const targetAction = normalizeQueueAction(action);
    if (!targetId || !targetAction) return;
    if (shouldBlockAdminQueueAction('queue-ticket-action')) {
        notifyAdminQueuePilotBlocked('queue-ticket-action');
        return;
    }

    if (getState().queue.practiceMode) {
        applyPracticeTicketAction(targetId, targetAction, consultorio);
        appendActivity(
            `Practica: accion ${targetAction} en ticket ${targetId}`
        );
        return;
    }

    const payload = await apiRequest('queue-ticket', {
        method: 'PATCH',
        body: {
            id: targetId,
            action: targetAction,
            consultorio: Number(consultorio || 0),
        },
    });

    applyQueueStateResponse(payload, {
        syncMode: 'live',
        bumpRuntimeRevision: true,
    });
    appendActivity(`Accion ${targetAction} ticket ${targetId}`);
}
