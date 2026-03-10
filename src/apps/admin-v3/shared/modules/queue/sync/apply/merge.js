import { coalesceNonEmptyString } from '../../helpers.js';
import { normalizeTicket, ticketIdentity } from '../../model.js';

function mergePartialTicket(existing, ticket) {
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

    return {
        ...(existing || {}),
        ...ticket,
        status: ticket.status,
        assignedConsultorio: ticket.assignedConsultorio,
        createdAt: mergedCreatedAt || new Date().toISOString(),
        priorityClass: mergedPriorityClass,
        queueType: mergedQueueType,
        patientInitials: mergedInitials,
    };
}

function mergePayloadTicket(existing, payloadTicket) {
    return {
        ...(existing || {}),
        ...normalizeTicket(payloadTicket, 0),
    };
}

export function mergePartialMetaTickets(
    byIdentity,
    partialMetaTickets,
    payloadTicket
) {
    for (const ticket of partialMetaTickets) {
        const identity = ticketIdentity(ticket);
        const existing = byIdentity.get(identity) || null;
        byIdentity.set(
            identity,
            normalizeTicket(
                mergePartialTicket(existing, ticket),
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
                mergePayloadTicket(existing, payloadTicket),
                byIdentity.size
            )
        );
    }

    return Array.from(byIdentity.values());
}
