import { getState } from '../../../core/store.js';
import {
    buildQueueMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from '../model.js';

export function getQueueSource() {
    const state = getState();
    const queueTickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
    const queueMeta =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, queueTickets)
            : buildQueueMeta(queueTickets);
    return { queueTickets, queueMeta };
}
