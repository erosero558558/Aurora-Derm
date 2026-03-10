import { asArray, coalesceNonEmptyString } from '../../helpers.js';
import { normalizeQueueMeta } from '../meta.js';
import { normalizeTicket } from '../normalizers.js';
import { ticketIdentity } from './identity.js';

function mergeMetaTicket(byIdentity, ticket) {
    if (!ticket) return;

    const normalized = normalizeTicket(ticket, byIdentity.size);
    if (!coalesceNonEmptyString(ticket?.createdAt, ticket?.created_at)) {
        normalized.createdAt = '';
    }
    if (
        !coalesceNonEmptyString(ticket?.priorityClass, ticket?.priority_class)
    ) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(ticket?.queueType, ticket?.queue_type)) {
        normalized.queueType = '';
    }

    byIdentity.set(ticketIdentity(normalized), normalized);
}

export function buildTicketsFromMeta(queueMeta) {
    const meta = normalizeQueueMeta(queueMeta);
    const byIdentity = new Map();

    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;

    if (c1) {
        mergeMetaTicket(byIdentity, {
            ...c1,
            status: 'called',
            assignedConsultorio: 1,
        });
    }
    if (c2) {
        mergeMetaTicket(byIdentity, {
            ...c2,
            status: 'called',
            assignedConsultorio: 2,
        });
    }

    for (const nextTicket of asArray(meta.nextTickets)) {
        mergeMetaTicket(byIdentity, {
            ...nextTicket,
            status: 'waiting',
            assignedConsultorio: null,
        });
    }

    return Array.from(byIdentity.values());
}
