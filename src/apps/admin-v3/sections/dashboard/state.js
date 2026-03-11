import {
    averageRating,
    countAvailabilityDays,
    countNoShows,
    countPendingCallbacks,
    countPendingTransfers,
    countRecentReviews,
    countTodayAppointments,
    countUrgentCallbacks,
    findNextAppointment,
} from './metrics.js';

export function getDashboardCollections(state) {
    return {
        appointments: Array.isArray(state?.data?.appointments)
            ? state.data.appointments
            : [],
        callbacks: Array.isArray(state?.data?.callbacks)
            ? state.data.callbacks
            : [],
        reviews: Array.isArray(state?.data?.reviews) ? state.data.reviews : [],
        availability:
            state?.data?.availability &&
            typeof state.data.availability === 'object'
                ? state.data.availability
                : {},
        queueTickets: Array.isArray(state?.data?.queueTickets)
            ? state.data.queueTickets
            : [],
        queueMeta:
            state?.data?.queueMeta && typeof state.data.queueMeta === 'object'
                ? state.data.queueMeta
                : null,
        funnel: state?.data?.funnelMetrics || {},
    };
}

export function getDashboardDerivedState(state) {
    const {
        appointments,
        availability,
        callbacks,
        funnel,
        queueMeta,
        queueTickets,
        reviews,
    } = getDashboardCollections(state);

    const todayAppointments = countTodayAppointments(appointments);
    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const urgentCallbacks = countUrgentCallbacks(callbacks);
    const noShows = countNoShows(appointments);
    const avgRating = averageRating(reviews);
    const recentReviews = countRecentReviews(reviews);
    const availabilityDays = countAvailabilityDays(availability);
    const nextAppointment = findNextAppointment(appointments);
    const waitingTickets = Number.isFinite(Number(queueMeta?.waitingCount))
        ? Math.max(0, Number(queueMeta.waitingCount))
        : queueTickets.filter(
              (ticket) => String(ticket.status || '').toLowerCase() === 'waiting'
          ).length;
    const calledTickets = Number.isFinite(Number(queueMeta?.calledCount))
        ? Math.max(0, Number(queueMeta.calledCount))
        : queueTickets.filter(
              (ticket) => String(ticket.status || '').toLowerCase() === 'called'
          ).length;
    const pendingTasks = pendingTransfers + pendingCallbacks;

    return {
        appointments,
        availabilityDays,
        avgRating,
        calledTickets,
        callbacks,
        funnel,
        nextAppointment,
        noShows,
        pendingCallbacks,
        pendingTasks,
        pendingTransfers,
        queueMeta,
        recentReviews,
        reviews,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    };
}
