import { asArray } from '../../helpers.js';
import {
    getCallingNowByConsultorio,
    getQueueSignalCounts,
    hasOwnField,
} from './shared.js';

function hasTopLevelSignalCounts(queueState) {
    return (
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        hasOwnField(queueState, 'completedCount') ||
        hasOwnField(queueState, 'completed_count') ||
        hasOwnField(queueState, 'noShowCount') ||
        hasOwnField(queueState, 'no_show_count') ||
        hasOwnField(queueState, 'cancelledCount') ||
        hasOwnField(queueState, 'cancelled_count')
    );
}

function hasNestedSignalCounts(queueState) {
    const counts = getQueueSignalCounts(queueState);
    return Boolean(
        counts &&
        (hasOwnField(counts, 'waiting') ||
            hasOwnField(counts, 'called') ||
            hasOwnField(counts, 'completed') ||
            hasOwnField(counts, 'no_show') ||
            hasOwnField(counts, 'noShow') ||
            hasOwnField(counts, 'cancelled') ||
            hasOwnField(counts, 'canceled'))
    );
}

function hasCallingSignals(queueState) {
    const callingByConsultorio = getCallingNowByConsultorio(queueState);
    if (
        callingByConsultorio &&
        (Boolean(callingByConsultorio[1]) ||
            Boolean(callingByConsultorio[2]) ||
            Boolean(callingByConsultorio['1']) ||
            Boolean(callingByConsultorio['2']))
    ) {
        return true;
    }

    const callingNow = asArray(queueState?.callingNow).concat(
        asArray(queueState?.calling_now)
    );
    return callingNow.some(Boolean);
}

export function hasExplicitQueueSignals(
    queueState,
    fullTickets,
    payloadTicket
) {
    if (fullTickets.length > 0) return true;
    if (
        hasOwnField(queueState, 'queue_tickets') ||
        hasOwnField(queueState, 'queueTickets') ||
        hasOwnField(queueState, 'tickets')
    ) {
        return true;
    }
    if (payloadTicket && typeof payloadTicket === 'object') return true;
    if (hasTopLevelSignalCounts(queueState)) return true;
    if (hasNestedSignalCounts(queueState)) return true;
    if (
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets')
    ) {
        return true;
    }
    return hasCallingSignals(queueState);
}
