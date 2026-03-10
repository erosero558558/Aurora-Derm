import {
    appointmentTimestamp,
    isTriageAttention,
    isUpcoming48h,
    normalize,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
} from '../utils.js';

export function applyFilter(items, filter) {
    const normalized = normalize(filter);

    if (normalized === 'pending_transfer') {
        return items.filter((item) => {
            const paymentStatus = normalizePaymentStatus(item);
            return (
                paymentStatus === 'pending_transfer_review' ||
                paymentStatus === 'pending_transfer'
            );
        });
    }

    if (normalized === 'upcoming_48h') {
        return items.filter(isUpcoming48h);
    }

    if (normalized === 'no_show') {
        return items.filter(
            (item) => normalizeAppointmentStatus(item.status) === 'no_show'
        );
    }

    if (normalized === 'triage_attention') {
        return items.filter(isTriageAttention);
    }

    return items;
}

export function applySearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;

    return items.filter((item) => {
        const fields = [
            item.name,
            item.email,
            item.phone,
            item.service,
            item.doctor,
            item.paymentStatus,
            item.payment_status,
            item.status,
        ];

        return fields.some((field) => normalize(field).includes(term));
    });
}

export function sortItems(items, sort) {
    const normalized = normalize(sort);
    const list = [...items];

    if (normalized === 'patient_az') {
        list.sort((a, b) =>
            normalize(a.name).localeCompare(normalize(b.name), 'es')
        );
        return list;
    }

    if (normalized === 'datetime_asc') {
        list.sort((a, b) => appointmentTimestamp(a) - appointmentTimestamp(b));
        return list;
    }

    list.sort((a, b) => appointmentTimestamp(b) - appointmentTimestamp(a));
    return list;
}
