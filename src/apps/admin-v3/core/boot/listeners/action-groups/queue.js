import { handleQueueBulkActionGroup } from './queue/bulk.js';
import { handleQueueInstallAction } from './queue/install.js';
import { handleQueueSensitiveActionGroup } from './queue/sensitive.js';
import { handleQueueStationActionGroup } from './queue/station.js';
import { handleQueueTicketActionGroup } from './queue/tickets.js';

export async function handleQueueAction(action, element) {
    const handlers = [
        handleQueueStationActionGroup,
        handleQueueTicketActionGroup,
        handleQueueBulkActionGroup,
        handleQueueSensitiveActionGroup,
        handleQueueInstallAction,
    ];

    for (const handler of handlers) {
        if (await handler(action, element)) {
            return true;
        }
    }

    return false;
}

export { dismissQueueSensitiveDialog } from './queue/sensitive.js';
