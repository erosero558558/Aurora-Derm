import { SECTION_CONTEXT } from '../config.js';

function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = String(
            item.paymentStatus || item.payment_status || ''
        ).toLowerCase();
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => {
        const status = String(item.status || '')
            .toLowerCase()
            .trim();
        return status === 'pending' || status === 'pendiente';
    }).length;
}

function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

function countWaitingTickets(queueTickets, queueMeta) {
    if (queueMeta && Number.isFinite(Number(queueMeta.waitingCount))) {
        return Math.max(0, Number(queueMeta.waitingCount));
    }

    return (Array.isArray(queueTickets) ? queueTickets : []).filter(
        (ticket) => String(ticket.status || '').toLowerCase() === 'waiting'
    ).length;
}

function countClinicalHistoryQueue(clinicalHistoryMeta) {
    const queue =
        clinicalHistoryMeta &&
        Array.isArray(clinicalHistoryMeta.reviewQueue)
            ? clinicalHistoryMeta.reviewQueue
            : [];
    if (queue.length > 0) {
        return queue.length;
    }

    const summary =
        clinicalHistoryMeta &&
        clinicalHistoryMeta.summary &&
        typeof clinicalHistoryMeta.summary === 'object'
            ? clinicalHistoryMeta.summary
            : {};
    return Number(summary.reviewQueueCount || summary?.drafts?.reviewQueueCount || 0);
}

export function getChromeMetrics(state) {
    const section = state?.ui?.activeSection || 'dashboard';
    const config = SECTION_CONTEXT[section] || SECTION_CONTEXT.dashboard;
    const auth =
        state?.auth && typeof state.auth === 'object' ? state.auth : {};
    const appointments = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const callbacks = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const availability =
        state?.data?.availability && typeof state.data.availability === 'object'
            ? state.data.availability
            : {};
    const queueTickets = Array.isArray(state?.data?.queueTickets)
        ? state.data.queueTickets
        : [];
    const queueMeta =
        state?.data?.queueMeta && typeof state.data.queueMeta === 'object'
            ? state.data.queueMeta
            : null;
    const clinicalHistoryMeta =
        state?.data?.clinicalHistoryMeta &&
        typeof state.data.clinicalHistoryMeta === 'object'
            ? state.data.clinicalHistoryMeta
            : null;

    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const availabilityDays = countAvailabilityDays(availability);
    const waitingTickets = countWaitingTickets(queueTickets, queueMeta);

    return {
        auth,
        config,
        appointments,
        reviews,
        pendingTransfers,
        pendingCallbacks,
        availabilityDays,
        waitingTickets,
        clinicalHistoryQueue: countClinicalHistoryQueue(clinicalHistoryMeta),
        dashboardAlerts: pendingTransfers + pendingCallbacks,
    };
}
