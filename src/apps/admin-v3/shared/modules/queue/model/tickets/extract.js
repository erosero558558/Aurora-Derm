export function extractTicketsFromPayload(queueState) {
    if (!queueState || typeof queueState !== 'object') return [];
    if (Array.isArray(queueState.queue_tickets)) {
        return queueState.queue_tickets;
    }
    if (Array.isArray(queueState.queueTickets)) {
        return queueState.queueTickets;
    }
    if (Array.isArray(queueState.tickets)) {
        return queueState.tickets;
    }
    return [];
}
