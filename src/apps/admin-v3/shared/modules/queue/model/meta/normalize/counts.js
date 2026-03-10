import { toFiniteNumber } from '../../../helpers.js';

export function resolveQueueMetaCounts(
    meta,
    counts,
    nextTickets,
    ticketFallbacks,
    callingSlots
) {
    const calledCountFallback = Math.max(
        Number(Boolean(callingSlots.c1)) + Number(Boolean(callingSlots.c2)),
        ticketFallbacks.calledFromTickets
    );

    const waitingCount = toFiniteNumber(
        meta.waitingCount ??
            meta.waiting_count ??
            counts.waiting ??
            nextTickets.length ??
            ticketFallbacks.waitingFromTickets,
        0
    );
    const calledCount = toFiniteNumber(
        meta.calledCount ??
            meta.called_count ??
            counts.called ??
            calledCountFallback,
        0
    );
    const completedCount = toFiniteNumber(
        counts.completed ??
            meta.completedCount ??
            meta.completed_count ??
            ticketFallbacks.completedFromTickets,
        0
    );
    const noShowCount = toFiniteNumber(
        counts.no_show ??
            counts.noShow ??
            meta.noShowCount ??
            meta.no_show_count ??
            ticketFallbacks.noShowFromTickets,
        0
    );
    const cancelledCount = toFiniteNumber(
        counts.cancelled ??
            counts.canceled ??
            meta.cancelledCount ??
            meta.cancelled_count ??
            ticketFallbacks.cancelledFromTickets,
        0
    );

    return {
        waitingCount,
        calledCount,
        completedCount,
        noShowCount,
        cancelledCount,
    };
}
