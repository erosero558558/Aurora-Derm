import { normalize } from '../../helpers.js';
import { normalizeTicket } from '../normalizers.js';

export function ticketIdentity(ticket) {
    const normalized = normalizeTicket(ticket, 0);
    if (normalized.id > 0) return `id:${normalized.id}`;
    return `code:${normalize(normalized.ticketCode || '')}`;
}
