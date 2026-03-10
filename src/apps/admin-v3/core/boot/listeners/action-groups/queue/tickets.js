import {
    clearQueueSearch,
    clearQueueSelection,
    reprintQueueTicket,
    runQueueTicketAction,
    selectVisibleQueueTickets,
    toggleQueueTicketSelection,
} from '../../../../../shared/modules/queue.js';
import { queueActionName, queueConsultorio, queueId } from './shared.js';

export async function handleQueueTicketActionGroup(action, element) {
    switch (action) {
        case 'queue-toggle-ticket-select':
            toggleQueueTicketSelection(queueId(element));
            return true;
        case 'queue-select-visible':
            selectVisibleQueueTickets();
            return true;
        case 'queue-clear-selection':
            clearQueueSelection();
            return true;
        case 'queue-ticket-action':
            await runQueueTicketAction(
                queueId(element),
                queueActionName(element),
                queueConsultorio(element)
            );
            return true;
        case 'queue-reprint-ticket':
            await reprintQueueTicket(queueId(element));
            return true;
        case 'queue-clear-search':
            clearQueueSearch();
            return true;
        default:
            return false;
    }
}
