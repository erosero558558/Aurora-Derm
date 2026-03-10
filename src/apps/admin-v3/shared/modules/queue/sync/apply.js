import {
    buildCurrentQueueTickets,
    mergePartialMetaTickets,
    resolveQueueStatePayload,
} from './apply/index.js';
import {
    buildTicketsFromMeta,
    getQueueStateSignalFlags,
    hasExplicitQueueSignals,
    normalizeQueueMeta,
    reconcilePartialMetaSignals,
    ticketIdentity,
} from '../model.js';
import { normalize } from '../helpers.js';
import { setQueueStateWithTickets } from '../state.js';

export function applyQueueStateResponse(payload, options = {}) {
    const { queueState, payloadTicket } = resolveQueueStatePayload(payload);
    if (!queueState || typeof queueState !== 'object') return;

    const currentTickets = buildCurrentQueueTickets();
    const fullTickets = queueState.__fullTickets || [];
    if (!hasExplicitQueueSignals(queueState, fullTickets, payloadTicket)) {
        return;
    }

    const syncMode =
        normalize(options.syncMode) === 'fallback' ? 'fallback' : 'live';
    const normalizedMeta = normalizeQueueMeta(queueState, currentTickets);
    const signalFlags = getQueueStateSignalFlags(queueState);
    const partialMetaTickets = buildTicketsFromMeta(normalizedMeta);
    const hasPayloadTicket = Boolean(
        payloadTicket && typeof payloadTicket === 'object'
    );

    if (
        !fullTickets.length &&
        !partialMetaTickets.length &&
        !hasPayloadTicket &&
        !signalFlags.waiting &&
        !signalFlags.called
    ) {
        return;
    }

    const fallbackPartial =
        Number(normalizedMeta.waitingCount || 0) >
        partialMetaTickets.filter((item) => item.status === 'waiting').length;

    if (fullTickets.length) {
        setQueueStateWithTickets(fullTickets, normalizedMeta, {
            fallbackPartial: false,
            syncMode,
        });
        return;
    }

    const byIdentity = new Map(
        currentTickets.map((ticket) => [ticketIdentity(ticket), ticket])
    );
    reconcilePartialMetaSignals(byIdentity, normalizedMeta, signalFlags);

    setQueueStateWithTickets(
        mergePartialMetaTickets(byIdentity, partialMetaTickets, payloadTicket),
        normalizedMeta,
        {
            fallbackPartial,
            syncMode,
        }
    );
}
