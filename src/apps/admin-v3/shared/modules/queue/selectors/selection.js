import { getState } from '../../../core/store.js';
import { asArray } from '../helpers.js';
import { getVisibleTickets } from './filters.js';
import { getQueueSource } from './source.js';

export function normalizeSelectedQueueIds(ids, tickets = null) {
    const sourceTickets = Array.isArray(tickets)
        ? tickets
        : getQueueSource().queueTickets;
    const allowedIds = new Set(
        sourceTickets
            .map((ticket) => Number(ticket.id || 0))
            .filter((id) => id > 0)
    );

    return [...new Set(asArray(ids).map((id) => Number(id || 0)))]
        .filter((id) => id > 0 && allowedIds.has(id))
        .sort((a, b) => a - b);
}

export function getSelectedQueueIds() {
    return normalizeSelectedQueueIds(getState().queue.selected || []);
}

export function getSelectedQueueTickets() {
    const selectedIds = new Set(getSelectedQueueIds());
    if (!selectedIds.size) return [];
    return getQueueSource().queueTickets.filter((ticket) =>
        selectedIds.has(Number(ticket.id || 0))
    );
}

export function getBulkTargetTickets() {
    const selectedTickets = getSelectedQueueTickets();
    if (selectedTickets.length) return selectedTickets;
    return getVisibleTickets();
}
