import { getState } from '../../../../core/store.js';
import { normalizeTicket } from '../../model.js';

export function buildCurrentQueueTickets() {
    return (getState().data.queueTickets || []).map((item, index) =>
        normalizeTicket(item, index)
    );
}
