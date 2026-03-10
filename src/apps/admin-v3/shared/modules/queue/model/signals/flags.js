import { getQueueSignalCounts, hasOwnField } from './shared.js';

export function getQueueStateSignalFlags(queueState) {
    const counts = getQueueSignalCounts(queueState);
    const hasWaitingCount =
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        Boolean(counts && hasOwnField(counts, 'waiting'));
    const hasCalledCount =
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        Boolean(counts && hasOwnField(counts, 'called'));
    const hasNextTickets =
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets');
    const hasCallingNow =
        hasOwnField(queueState, 'callingNowByConsultorio') ||
        hasOwnField(queueState, 'calling_now_by_consultorio') ||
        hasOwnField(queueState, 'callingNow') ||
        hasOwnField(queueState, 'calling_now');
    return {
        waiting: hasWaitingCount || hasNextTickets,
        called: hasCalledCount || hasCallingNow,
    };
}
