import {
    getCallingByConsultorio,
    getCallingNowList,
    getQueueMetaCounts,
} from './shared.js';
import {
    buildTicketFallbacks,
    normalizeNextTickets,
    resolveCallingSlots,
    resolveQueueMetaCounts,
} from './normalize/index.js';
import { asArray, toFiniteNumber } from '../../helpers.js';

export function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts = getQueueMetaCounts(meta);
    const callingByConsultorio = getCallingByConsultorio(meta);
    const callingNowList = getCallingNowList(meta);
    const ticketFallbacks = buildTicketFallbacks(tickets);
    const { c1, c2 } = resolveCallingSlots(
        callingByConsultorio,
        callingNowList
    );
    const nextTickets = normalizeNextTickets(meta);
    const normalizedCounts = resolveQueueMetaCounts(
        meta,
        counts,
        nextTickets,
        ticketFallbacks,
        { c1, c2 }
    );

    return {
        updatedAt: String(
            meta.updatedAt || meta.updated_at || new Date().toISOString()
        ),
        waitingCount: normalizedCounts.waitingCount,
        calledCount: normalizedCounts.calledCount,
        estimatedWaitMin: toFiniteNumber(
            meta.estimatedWaitMin ??
                meta.estimated_wait_min ??
                Math.max(0, nextTickets.length * 8),
            0
        ),
        delayReason: String(meta.delayReason || meta.delay_reason || ''),
        assistancePendingCount: toFiniteNumber(
            meta.assistancePendingCount ??
                meta.assistance_pending_count ??
                asArray(meta.activeHelpRequests).filter(
                    (request) =>
                        String(request?.status || '').toLowerCase() ===
                        'pending'
                ).length ??
                asArray(meta.active_help_requests).filter(
                    (request) =>
                        String(request?.status || '').toLowerCase() ===
                        'pending'
                ).length,
            0
        ),
        activeHelpRequests: asArray(meta.activeHelpRequests).length
            ? asArray(meta.activeHelpRequests)
            : asArray(meta.active_help_requests),
        counts: {
            waiting: normalizedCounts.waitingCount,
            called: normalizedCounts.calledCount,
            completed: normalizedCounts.completedCount,
            no_show: normalizedCounts.noShowCount,
            cancelled: normalizedCounts.cancelledCount,
        },
        callingNowByConsultorio: {
            1: c1,
            2: c2,
        },
        nextTickets,
    };
}
