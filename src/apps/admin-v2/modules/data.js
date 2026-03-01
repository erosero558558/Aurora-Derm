import { apiRequest } from '../core/api-client.js';
import { getStorageJson, setStorageJson } from '../core/persistence.js';
import { getState, updateState } from '../core/store.js';

const LOCAL_DATA_KEYS = {
    appointments: 'appointments',
    callbacks: 'callbacks',
    reviews: 'reviews',
    availability: 'availability',
    availabilityMeta: 'availability-meta',
    queueTickets: 'queue-tickets',
    queueMeta: 'queue-meta',
    health: 'health-status',
};

function normalizeCallbacks(list) {
    return (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        status: String(item.status || '')
            .toLowerCase()
            .includes('contact')
            ? 'contacted'
            : 'pending',
    }));
}

function normalizeQueueTickets(data) {
    if (Array.isArray(data.queue_tickets)) return data.queue_tickets;
    if (Array.isArray(data.queueTickets)) return data.queueTickets;
    return [];
}

function persistLocal(data) {
    setStorageJson(LOCAL_DATA_KEYS.appointments, data.appointments || []);
    setStorageJson(LOCAL_DATA_KEYS.callbacks, data.callbacks || []);
    setStorageJson(LOCAL_DATA_KEYS.reviews, data.reviews || []);
    setStorageJson(LOCAL_DATA_KEYS.availability, data.availability || {});
    setStorageJson(
        LOCAL_DATA_KEYS.availabilityMeta,
        data.availabilityMeta || {}
    );
    setStorageJson(LOCAL_DATA_KEYS.queueTickets, data.queueTickets || []);
    setStorageJson(LOCAL_DATA_KEYS.queueMeta, data.queueMeta || null);
    setStorageJson(LOCAL_DATA_KEYS.health, data.health || null);
}

function loadLocalFallback() {
    return {
        appointments: getStorageJson(LOCAL_DATA_KEYS.appointments, []),
        callbacks: getStorageJson(LOCAL_DATA_KEYS.callbacks, []),
        reviews: getStorageJson(LOCAL_DATA_KEYS.reviews, []),
        availability: getStorageJson(LOCAL_DATA_KEYS.availability, {}),
        availabilityMeta: getStorageJson(LOCAL_DATA_KEYS.availabilityMeta, {}),
        queueTickets: getStorageJson(LOCAL_DATA_KEYS.queueTickets, []),
        queueMeta: getStorageJson(LOCAL_DATA_KEYS.queueMeta, null),
        health: getStorageJson(LOCAL_DATA_KEYS.health, null),
        funnelMetrics: {
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
        },
    };
}

function writeDataInStore(payload) {
    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            appointments: payload.appointments || [],
            callbacks: normalizeCallbacks(payload.callbacks || []),
            reviews: payload.reviews || [],
            availability: payload.availability || {},
            availabilityMeta: payload.availabilityMeta || {},
            queueTickets: payload.queueTickets || [],
            queueMeta: payload.queueMeta || null,
            funnelMetrics: payload.funnelMetrics || state.data.funnelMetrics,
            health: payload.health || null,
        },
        ui: {
            ...state.ui,
            lastRefreshAt: Date.now(),
        },
    }));
}

export async function refreshAdminData() {
    try {
        const [dataPayload, healthPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('health').catch(() => null),
        ]);

        const data = dataPayload.data || {};
        let funnelMetrics = data.funnelMetrics || null;

        if (!funnelMetrics) {
            const funnelPayload = await apiRequest('funnel-metrics').catch(
                () => null
            );
            funnelMetrics = funnelPayload?.data || null;
        }

        const normalized = {
            appointments: Array.isArray(data.appointments)
                ? data.appointments
                : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            availability:
                data.availability && typeof data.availability === 'object'
                    ? data.availability
                    : {},
            availabilityMeta:
                data.availabilityMeta &&
                typeof data.availabilityMeta === 'object'
                    ? data.availabilityMeta
                    : {},
            queueTickets: normalizeQueueTickets(data),
            queueMeta:
                data.queueMeta && typeof data.queueMeta === 'object'
                    ? data.queueMeta
                    : data.queue_state && typeof data.queue_state === 'object'
                      ? data.queue_state
                      : null,
            funnelMetrics,
            health: healthPayload && healthPayload.ok ? healthPayload : null,
        };

        writeDataInStore(normalized);
        persistLocal(normalized);
        return true;
    } catch (_error) {
        const fallback = loadLocalFallback();
        writeDataInStore(fallback);
        return false;
    }
}

export function refreshStatusLabel() {
    const state = getState();
    const ts = Number(state.ui.lastRefreshAt || 0);
    if (!ts) return 'Datos: sin sincronizar';
    const deltaSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    return deltaSec < 60
        ? `Datos: hace ${deltaSec}s`
        : `Datos: hace ${Math.round(deltaSec / 60)}m`;
}
