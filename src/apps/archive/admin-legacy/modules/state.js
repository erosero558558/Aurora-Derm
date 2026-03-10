export let currentAppointments = [];
export let currentCallbacks = [];
export let currentReviews = [];
export let currentAvailability = {};
export let currentAvailabilityMeta = {};
export let currentFunnelMetrics = null;
export let currentHealthStatus = null;
export let currentQueueTickets = [];
export let currentQueueMeta = null;
export let csrfToken = '';

export function setAppointments(data) {
    currentAppointments = data || [];
}
export function setCallbacks(data) {
    currentCallbacks = data || [];
}
export function setReviews(data) {
    currentReviews = data || [];
}
export function setAvailability(data) {
    currentAvailability = data || {};
}
export function setAvailabilityMeta(data) {
    currentAvailabilityMeta = data || {};
}
export function setFunnelMetrics(data) {
    currentFunnelMetrics = data;
}
export function setHealthStatus(data) {
    currentHealthStatus = data || null;
}
export function setQueueTickets(data) {
    currentQueueTickets = Array.isArray(data) ? data : [];
}
export function setQueueMeta(data) {
    currentQueueMeta = data && typeof data === 'object' ? data : null;
}
export function setCsrfToken(token) {
    csrfToken = token;
}

export function getEmptyFunnelMetrics() {
    return {
        summary: {
            viewBooking: 0,
            startCheckout: 0,
            bookingConfirmed: 0,
            checkoutAbandon: 0,
            startRatePct: 0,
            confirmedRatePct: 0,
            abandonRatePct: 0,
        },
        checkoutAbandonByStep: [],
        checkoutAbandonByReason: [],
        checkoutEntryBreakdown: [],
        eventSourceBreakdown: [],
        paymentMethodBreakdown: [],
        bookingStepBreakdown: [],
        errorCodeBreakdown: [],
        retention: {
            appointmentsTotal: 0,
            appointmentsNonCancelled: 0,
            statusCounts: {
                confirmed: 0,
                completed: 0,
                noShow: 0,
                cancelled: 0,
            },
            noShowRatePct: 0,
            completionRatePct: 0,
            uniquePatients: 0,
            recurrentPatients: 0,
            recurrenceRatePct: 0,
        },
    };
}
