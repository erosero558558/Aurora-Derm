import { getState } from '../../../core/store.js';
import { normalize, toMillis } from '../helpers.js';
import { getQueueSource } from './source.js';

export function queueFilter(items, filter) {
    const normalized = normalize(filter);
    if (normalized === 'waiting') {
        return items.filter((item) => item.status === 'waiting');
    }
    if (normalized === 'called') {
        return items.filter((item) => item.status === 'called');
    }
    if (normalized === 'no_show') {
        return items.filter((item) => item.status === 'no_show');
    }
    if (normalized === 'sla_risk') {
        return items.filter((item) => {
            if (item.status !== 'waiting') return false;
            const ageMinutes = Math.max(
                0,
                Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
            );
            return (
                ageMinutes >= 20 ||
                normalize(item.priorityClass) === 'appt_overdue'
            );
        });
    }
    return items;
}

export function queueSearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;
    return items.filter((item) => {
        const fields = [
            item.ticketCode,
            item.patientInitials,
            item.status,
            item.queueType,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

export function getVisibleTickets() {
    const state = getState();
    const { queueTickets } = getQueueSource();
    return queueSearch(
        queueFilter(queueTickets, state.queue.filter),
        state.queue.search
    );
}
