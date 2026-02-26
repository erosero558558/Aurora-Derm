import { apiRequest } from './api.js';
import {
    setAppointments,
    setCallbacks,
    setReviews,
    setAvailability,
    setAvailabilityMeta,
    setFunnelMetrics,
    setHealthStatus,
    setQueueTickets,
    setQueueMeta,
    getEmptyFunnelMetrics
} from './state.js';
import { normalizeCallbackStatus, showToast } from './ui.js';

export function getLocalData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (_e) {
        return fallback;
    }
}

function saveLocalData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (_e) {
        // storage quota full or disabled
    }
}

function loadFallbackState() {
    setAppointments(getLocalData('appointments', []));
    setCallbacks(getLocalData('callbacks', []).map(c => ({
        ...c,
        status: normalizeCallbackStatus(c.status)
    })));
    setReviews(getLocalData('reviews', []));
    setAvailability(getLocalData('availability', {}));
    setAvailabilityMeta(getLocalData('availability-meta', {}));
    setQueueTickets(getLocalData('queue-tickets', []));
    setQueueMeta(getLocalData('queue-meta', null));
    setFunnelMetrics(getEmptyFunnelMetrics());
    setHealthStatus(getLocalData('health-status', null));
}

export async function refreshData() {
    try {
        const [payload, healthPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('health').catch(() => null)
        ]);

        const data = payload.data || {};

        const appointments = Array.isArray(data.appointments) ? data.appointments : [];
        setAppointments(appointments);
        saveLocalData('appointments', appointments);

        const callbacks = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        setCallbacks(callbacks);
        saveLocalData('callbacks', callbacks);

        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        setReviews(reviews);
        saveLocalData('reviews', reviews);

        const availability = data.availability && typeof data.availability === 'object' ? data.availability : {};
        setAvailability(availability);
        saveLocalData('availability', availability);
        const availabilityMeta = data.availabilityMeta && typeof data.availabilityMeta === 'object'
            ? data.availabilityMeta
            : { source: 'store', mode: 'live', generatedAt: new Date().toISOString() };
        setAvailabilityMeta(availabilityMeta);
        saveLocalData('availability-meta', availabilityMeta);

        const queueTickets = Array.isArray(data.queue_tickets)
            ? data.queue_tickets
            : [];
        setQueueTickets(queueTickets);
        saveLocalData('queue-tickets', queueTickets);

        const queueMeta =
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : null;
        setQueueMeta(queueMeta);
        saveLocalData('queue-meta', queueMeta);

        if (data.funnelMetrics && typeof data.funnelMetrics === 'object') {
            setFunnelMetrics(data.funnelMetrics);
        } else {
            const funnelPayload = await apiRequest('funnel-metrics').catch(() => null);
            if (funnelPayload && funnelPayload.data && typeof funnelPayload.data === 'object') {
                setFunnelMetrics(funnelPayload.data);
            } else {
                setFunnelMetrics(getEmptyFunnelMetrics());
            }
        }

        if (healthPayload && healthPayload.ok) {
            setHealthStatus(healthPayload);
            saveLocalData('health-status', healthPayload);
        } else {
            setHealthStatus(null);
        }
    } catch (_e) {
        loadFallbackState();
        showToast('No se pudo conectar al backend. Usando datos locales.', 'warning');
    }
}
