import { getState } from '../../../core/store.js';
import { getQueueSource } from './source.js';

export function getQueueTicketById(ticketId) {
    const targetId = Number(ticketId || 0);
    if (!targetId) return null;
    return (
        getQueueSource().queueTickets.find(
            (ticket) => Number(ticket.id || 0) === targetId
        ) || null
    );
}

export function getCalledTicketForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return (
        getQueueSource().queueTickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === target
        ) || null
    );
}

export function getWaitingForConsultorio(consultorio) {
    const tickets = getQueueSource().queueTickets;
    return (
        tickets.find(
            (ticket) =>
                ticket.status === 'waiting' &&
                (!ticket.assignedConsultorio ||
                    ticket.assignedConsultorio === consultorio)
        ) || null
    );
}

export function getActiveCalledTicketForStation() {
    const state = getState();
    const station = Number(state.queue.stationConsultorio || 1);
    const tickets = getQueueSource().queueTickets;
    return (
        tickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === station
        ) || null
    );
}
