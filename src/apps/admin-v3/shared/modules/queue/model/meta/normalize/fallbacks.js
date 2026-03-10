import { asArray } from '../../../helpers.js';
import { normalizeTicket } from '../../normalizers.js';

export function buildTicketFallbacks(tickets) {
    const normalizedTickets = asArray(tickets).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );

    return {
        normalizedTickets,
        waitingFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'waiting'
        ).length,
        calledFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'called'
        ).length,
        completedFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'completed'
        ).length,
        noShowFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'no_show'
        ).length,
        cancelledFromTickets: normalizedTickets.filter(
            (ticket) => ticket.status === 'cancelled'
        ).length,
    };
}
