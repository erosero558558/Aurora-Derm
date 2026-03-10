export const LOCAL_DATA_KEYS = {
    appointments: 'appointments',
    callbacks: 'callbacks',
    reviews: 'reviews',
    availability: 'availability',
    availabilityMeta: 'availability-meta',
    queueTickets: 'queue-tickets',
    queueMeta: 'queue-meta',
    leadOpsMeta: 'leadops-meta',
    queueSurfaceStatus: 'queue-surface-status',
    appDownloads: 'app-downloads',
    health: 'health-status',
};

export const EMPTY_FUNNEL_METRICS = {
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
    checkoutEntryBreakdown: [],
    paymentMethodBreakdown: [],
    bookingStepBreakdown: [],
    sourceBreakdown: [],
    abandonReasonBreakdown: [],
    errorCodeBreakdown: [],
};
