import {
    cancelQueueSensitiveAction,
    confirmQueueSensitiveAction,
    dismissQueueSensitiveDialog,
} from '../../../../../shared/modules/queue.js';

export async function handleQueueSensitiveActionGroup(action) {
    switch (action) {
        case 'queue-sensitive-confirm':
            await confirmQueueSensitiveAction();
            return true;
        case 'queue-sensitive-cancel':
            cancelQueueSensitiveAction();
            return true;
        default:
            return false;
    }
}

export { dismissQueueSensitiveDialog };
