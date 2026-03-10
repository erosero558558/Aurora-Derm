import { asArray } from '../../helpers.js';
import { normalizeTicket } from '../normalizers.js';
import { ticketIdentity } from '../tickets.js';

function buildCalledIdentities(nowByConsultorio) {
    const calledIdentities = new Set();
    const c1 = nowByConsultorio['1'] || nowByConsultorio[1] || null;
    const c2 = nowByConsultorio['2'] || nowByConsultorio[2] || null;
    if (c1) calledIdentities.add(ticketIdentity(c1));
    if (c2) calledIdentities.add(ticketIdentity(c2));
    return calledIdentities;
}

export function reconcilePartialMetaSignals(
    byIdentity,
    normalizedMeta,
    signalFlags
) {
    const nowByConsultorio = normalizedMeta.callingNowByConsultorio || {};
    const calledCount = Number(
        normalizedMeta.calledCount || normalizedMeta.counts?.called || 0
    );
    const waitingCount = Number(
        normalizedMeta.waitingCount || normalizedMeta.counts?.waiting || 0
    );
    const nextTickets = asArray(normalizedMeta.nextTickets);

    const calledIdentities = buildCalledIdentities(nowByConsultorio);
    const waitingIdentities = new Set(
        nextTickets.map((ticket) => ticketIdentity(ticket))
    );

    const canReconcileCalled = calledIdentities.size > 0 || calledCount === 0;
    const canReconcileWaiting =
        waitingIdentities.size > 0 || waitingCount === 0;
    const hasPartialWaitingList =
        waitingIdentities.size > 0 && waitingCount > waitingIdentities.size;

    for (const [identity, existingTicket] of byIdentity.entries()) {
        const normalized = normalizeTicket(existingTicket, 0);
        if (
            signalFlags.called &&
            canReconcileCalled &&
            normalized.status === 'called' &&
            !calledIdentities.has(identity)
        ) {
            byIdentity.set(
                identity,
                normalizeTicket(
                    {
                        ...normalized,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt:
                            normalized.completedAt || new Date().toISOString(),
                    },
                    0
                )
            );
            continue;
        }

        if (
            !signalFlags.waiting ||
            !canReconcileWaiting ||
            normalized.status !== 'waiting'
        ) {
            continue;
        }
        if (waitingCount <= 0) {
            byIdentity.delete(identity);
            continue;
        }
        if (!hasPartialWaitingList && !waitingIdentities.has(identity)) {
            byIdentity.delete(identity);
        }
    }
}
