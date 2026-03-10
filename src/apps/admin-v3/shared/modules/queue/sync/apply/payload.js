import { extractTicketsFromPayload } from '../../model.js';

export function resolveQueueStatePayload(payload) {
    const queueState =
        payload?.data?.queueState ||
        payload?.data?.queue_state ||
        payload?.data?.queueMeta ||
        payload?.data ||
        null;
    const fullTickets =
        queueState && typeof queueState === 'object'
            ? extractTicketsFromPayload(queueState)
            : [];

    return {
        queueState:
            queueState && typeof queueState === 'object'
                ? { ...queueState, __fullTickets: fullTickets }
                : queueState,
        payloadTicket: payload?.data?.ticket || null,
    };
}
