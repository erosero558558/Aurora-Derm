import { getState } from '../../../core/store.js';
import { coalesceNonEmptyString, normalize } from '../helpers.js';
import {
    buildTicketsFromMeta,
    extractTicketsFromPayload,
    getQueueStateSignalFlags,
    hasExplicitQueueSignals,
    normalizeQueueMeta,
    normalizeTicket,
    reconcilePartialMetaSignals,
    ticketIdentity,
} from '../model.js';
import { setQueueStateWithTickets } from '../state.js';

function buildCurrentTickets() {
    return (getState().data.queueTickets || []).map((item, index) =>
        normalizeTicket(item, index)
    );
}

function mergePartialMetaTickets(
    byIdentity,
    partialMetaTickets,
    payloadTicket
) {
    for (const ticket of partialMetaTickets) {
        const identity = ticketIdentity(ticket);
        const existing = byIdentity.get(identity) || null;
        const mergedCreatedAt = coalesceNonEmptyString(
            ticket.createdAt,
            ticket.created_at,
            existing?.createdAt,
            existing?.created_at
        );
        const mergedPriorityClass = coalesceNonEmptyString(
            ticket.priorityClass,
            ticket.priority_class,
            existing?.priorityClass,
            existing?.priority_class,
            'walk_in'
        );
        const mergedQueueType = coalesceNonEmptyString(
            ticket.queueType,
            ticket.queue_type,
            existing?.queueType,
            existing?.queue_type,
            'walk_in'
        );
        const mergedInitials = coalesceNonEmptyString(
            ticket.patientInitials,
            ticket.patient_initials,
            existing?.patientInitials,
            existing?.patient_initials,
            '--'
        );
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...ticket,
                    status: ticket.status,
                    assignedConsultorio: ticket.assignedConsultorio,
                    createdAt: mergedCreatedAt || new Date().toISOString(),
                    priorityClass: mergedPriorityClass,
                    queueType: mergedQueueType,
                    patientInitials: mergedInitials,
                },
                byIdentity.size
            )
        );
    }

    if (payloadTicket && typeof payloadTicket === 'object') {
        const normalizedPayloadTicket = normalizeTicket(
            payloadTicket,
            byIdentity.size
        );
        const identity = ticketIdentity(normalizedPayloadTicket);
        const existing = byIdentity.get(identity) || null;
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...normalizedPayloadTicket,
                },
                byIdentity.size
            )
        );
    }

    return Array.from(byIdentity.values());
}

export function applyQueueStateResponse(payload, options = {}) {
    const queueState =
        payload?.data?.queueState ||
        payload?.data?.queue_state ||
        payload?.data?.queueMeta ||
        payload?.data ||
        null;
    if (!queueState || typeof queueState !== 'object') return;

    const fullTickets = extractTicketsFromPayload(queueState);
    const payloadTicket = payload?.data?.ticket || null;
    if (!hasExplicitQueueSignals(queueState, fullTickets, payloadTicket)) {
        return;
    }

    const syncMode =
        normalize(options.syncMode) === 'fallback' ? 'fallback' : 'live';
    const currentTickets = buildCurrentTickets();
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
