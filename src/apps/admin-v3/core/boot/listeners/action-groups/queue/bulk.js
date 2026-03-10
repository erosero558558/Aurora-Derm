import {
    runQueueBulkAction,
    runQueueBulkReprint,
} from '../../../../../shared/modules/queue.js';

export async function handleQueueBulkActionGroup(action, element) {
    switch (action) {
        case 'queue-bulk-action':
            await runQueueBulkAction(
                String(element.dataset.queueAction || 'no_show')
            );
            return true;
        case 'queue-bulk-reprint':
            await runQueueBulkReprint();
            return true;
        default:
            return false;
    }
}
