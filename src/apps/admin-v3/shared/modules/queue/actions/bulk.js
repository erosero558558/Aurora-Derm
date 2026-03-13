import { apiRequest } from '../../../core/api-client.js';
import { getState } from '../../../core/store.js';
import { SENSITIVE_QUEUE_ACTIONS } from '../constants.js';
import { normalizeQueueAction } from '../helpers.js';
import { getBulkTargetTickets } from '../selectors.js';
import { appendActivity, clearQueueSelection } from '../state.js';
import { executeTicketAction } from './execute.js';
import {
    notifyAdminQueuePilotBlocked,
    shouldBlockAdminQueueAction,
} from '../pilot-guard.js';

function bulkActionLabel(action) {
    if (action === 'no_show') {
        return 'No show';
    }
    if (action === 'completar' || action === 'completed') {
        return 'Completar';
    }
    return 'Cancelar';
}

export async function runQueueBulkAction(action) {
    if (shouldBlockAdminQueueAction('queue-bulk-action')) {
        notifyAdminQueuePilotBlocked('queue-bulk-action');
        return;
    }
    const targets = getBulkTargetTickets();
    const normalizedAction = normalizeQueueAction(action);
    if (!targets.length) return;

    if (SENSITIVE_QUEUE_ACTIONS.has(normalizedAction)) {
        const confirmed = window.confirm(
            `${bulkActionLabel(normalizedAction)}: confirmar acción masiva`
        );
        if (!confirmed) return;
    }

    for (const ticket of targets) {
        try {
            await executeTicketAction({
                ticketId: ticket.id,
                action: normalizedAction,
                consultorio:
                    ticket.assignedConsultorio ||
                    getState().queue.stationConsultorio,
            });
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk ${normalizedAction} sobre ${targets.length} tickets`);
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) return;
    if (shouldBlockAdminQueueAction('queue-reprint-ticket')) {
        notifyAdminQueuePilotBlocked('queue-reprint-ticket');
        return;
    }

    if (getState().queue.practiceMode) {
        appendActivity(`Practica: reprint ticket ${id}`);
        return;
    }

    await apiRequest('queue-reprint', {
        method: 'POST',
        body: { id },
    });
    appendActivity(`Reimpresion ticket ${id}`);
}

export async function runQueueBulkReprint() {
    if (shouldBlockAdminQueueAction('queue-bulk-reprint')) {
        notifyAdminQueuePilotBlocked('queue-bulk-reprint');
        return;
    }
    const targets = getBulkTargetTickets();
    for (const ticket of targets) {
        try {
            await reprintQueueTicket(ticket.id);
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk reimpresion ${targets.length}`);
}
