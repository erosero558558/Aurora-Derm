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
    getEmptyFunnelMetrics,
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

function getQueueStateArray(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return [];
    }
    for (const key of keys) {
        if (!key) continue;
        if (Array.isArray(source[key])) {
            return source[key];
        }
    }
    return [];
}

function getQueueStateObject(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return null;
    }
    for (const key of keys) {
        if (!key) continue;
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
    }
    return null;
}

function getQueueStateNumber(source, keys, fallback = 0) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return Number(fallback || 0);
    }
    for (const key of keys) {
        if (!key) continue;
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return Number(fallback || 0);
}

function normalizeQueueMetaPayload(rawState) {
    if (!rawState || typeof rawState !== 'object') {
        return null;
    }
    const state = rawState;
    const counts = getQueueStateObject(state, ['counts']) || {};
    let callingNow = getQueueStateArray(state, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (callingNow.length === 0) {
        const byConsultorio = getQueueStateObject(state, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        if (byConsultorio) {
            callingNow = Object.values(byConsultorio).filter(Boolean);
        }
    }
    const nextTickets = getQueueStateArray(state, [
        'nextTickets',
        'next_tickets',
        'waitingTickets',
        'waiting_tickets',
    ]);
    const waitingCountRaw = getQueueStateNumber(
        state,
        ['waitingCount', 'waiting_count'],
        Number.NaN
    );
    const calledCountRaw = getQueueStateNumber(
        state,
        ['calledCount', 'called_count'],
        Number.NaN
    );
    const waitingCount = Number.isFinite(waitingCountRaw)
        ? waitingCountRaw
        : getQueueStateNumber(
              counts,
              ['waiting', 'waiting_count'],
              nextTickets.length
          );
    const calledCount = Number.isFinite(calledCountRaw)
        ? calledCountRaw
        : getQueueStateNumber(
              counts,
              ['called', 'called_count'],
              callingNow.length
          );

    const callingNowByConsultorio = {
        1: null,
        2: null,
    };
    for (const ticket of callingNow) {
        const consultorio = Number(
            ticket?.assignedConsultorio ?? ticket?.assigned_consultorio ?? 0
        );
        if (consultorio === 1 || consultorio === 2) {
            callingNowByConsultorio[String(consultorio)] = {
                ...ticket,
                id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                ticketCode: String(
                    ticket?.ticketCode || ticket?.ticket_code || '--'
                ),
                patientInitials: String(
                    ticket?.patientInitials || ticket?.patient_initials || '--'
                ),
                assignedConsultorio: consultorio,
                calledAt: String(ticket?.calledAt || ticket?.called_at || ''),
            };
        }
    }

    return {
        updatedAt:
            String(state.updatedAt || state.updated_at || '').trim() ||
            new Date().toISOString(),
        waitingCount: Math.max(0, Number(waitingCount || 0)),
        calledCount: Math.max(0, Number(calledCount || 0)),
        counts,
        callingNowByConsultorio,
        nextTickets: Array.isArray(nextTickets)
            ? nextTickets.map((ticket, index) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: String(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: String(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  queueType: String(
                      ticket?.queueType || ticket?.queue_type || 'walk_in'
                  ),
                  priorityClass: String(
                      ticket?.priorityClass ||
                          ticket?.priority_class ||
                          'walk_in'
                  ),
                  position:
                      Number(ticket?.position || 0) > 0
                          ? Number(ticket.position)
                          : index + 1,
              }))
            : [],
    };
}

function buildQueueTicketsFromState(rawState) {
    if (!rawState || typeof rawState !== 'object') {
        return [];
    }
    const state = rawState;
    const fallbackTs =
        String(state.updatedAt || state.updated_at || '').trim() ||
        new Date().toISOString();
    let callingNow = getQueueStateArray(state, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (callingNow.length === 0) {
        const byConsultorio = getQueueStateObject(state, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        if (byConsultorio) {
            callingNow = Object.values(byConsultorio).filter(Boolean);
        }
    }

    const queueTickets = getQueueStateArray(state, [
        'queue_tickets',
        'queueTickets',
        'tickets',
    ]);
    const waitingTickets = getQueueStateArray(state, [
        'waitingTickets',
        'waiting_tickets',
        'nextTickets',
        'next_tickets',
    ]);
    const nextByKey = new Map();
    let fallbackSeq = 1;
    const upsert = (ticket, status) => {
        if (!ticket || typeof ticket !== 'object') return;
        const ticketId = Number(ticket.id || ticket.ticket_id || 0);
        const ticketCode = String(
            ticket.ticketCode || ticket.ticket_code || ''
        ).trim();
        const key = ticketId
            ? `id:${ticketId}`
            : ticketCode
              ? `code:${ticketCode}`
              : `tmp:${fallbackSeq++}`;
        const previous = nextByKey.get(key) || {};
        const normalizedStatus = String(
            status || ticket.status || previous.status || 'waiting'
        ).toLowerCase();
        const assignedConsultorio = Number(
            ticket.assignedConsultorio ??
                ticket.assigned_consultorio ??
                previous.assignedConsultorio ??
                0
        );
        nextByKey.set(key, {
            id: ticketId || Number(previous.id || 0) || fallbackSeq++,
            ticketCode: ticketCode || previous.ticketCode || '--',
            queueType: String(
                ticket.queueType ||
                    ticket.queue_type ||
                    previous.queueType ||
                    'walk_in'
            ),
            priorityClass: String(
                ticket.priorityClass ||
                    ticket.priority_class ||
                    previous.priorityClass ||
                    'walk_in'
            ),
            status: normalizedStatus,
            assignedConsultorio:
                assignedConsultorio === 1 || assignedConsultorio === 2
                    ? assignedConsultorio
                    : null,
            patientInitials: String(
                ticket.patientInitials ||
                    ticket.patient_initials ||
                    previous.patientInitials ||
                    '--'
            ),
            phoneLast4: String(
                ticket.phoneLast4 ||
                    ticket.phone_last4 ||
                    previous.phoneLast4 ||
                    ''
            ),
            createdAt: String(
                ticket.createdAt ||
                    ticket.created_at ||
                    previous.createdAt ||
                    fallbackTs
            ),
            calledAt:
                normalizedStatus === 'called'
                    ? String(
                          ticket.calledAt ||
                              ticket.called_at ||
                              previous.calledAt ||
                              fallbackTs
                      )
                    : '',
            completedAt: String(
                ticket.completedAt ||
                    ticket.completed_at ||
                    previous.completedAt ||
                    ''
            ),
        });
    };

    for (const ticket of queueTickets) {
        upsert(ticket, String(ticket?.status || 'waiting'));
    }
    for (const ticket of waitingTickets) {
        upsert(ticket, 'waiting');
    }
    for (const ticket of callingNow) {
        upsert(ticket, 'called');
    }

    return Array.from(nextByKey.values());
}

function loadFallbackState() {
    setAppointments(getLocalData('appointments', []));
    setCallbacks(
        getLocalData('callbacks', []).map((c) => ({
            ...c,
            status: normalizeCallbackStatus(c.status),
        }))
    );
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
            apiRequest('health').catch(() => null),
        ]);

        const data = payload.data || {};

        const appointments = Array.isArray(data.appointments)
            ? data.appointments
            : [];
        setAppointments(appointments);
        saveLocalData('appointments', appointments);

        const callbacks = Array.isArray(data.callbacks)
            ? data.callbacks.map((c) => ({
                  ...c,
                  status: normalizeCallbackStatus(c.status),
              }))
            : [];
        setCallbacks(callbacks);
        saveLocalData('callbacks', callbacks);

        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        setReviews(reviews);
        saveLocalData('reviews', reviews);

        const availability =
            data.availability && typeof data.availability === 'object'
                ? data.availability
                : {};
        setAvailability(availability);
        saveLocalData('availability', availability);
        const availabilityMeta =
            data.availabilityMeta && typeof data.availabilityMeta === 'object'
                ? data.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        setAvailabilityMeta(availabilityMeta);
        saveLocalData('availability-meta', availabilityMeta);

        const queueStatePayload =
            data.queueState && typeof data.queueState === 'object'
                ? data.queueState
                : data.queue_state && typeof data.queue_state === 'object'
                  ? data.queue_state
                  : null;
        const queueMetaPayload =
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : data.queue_meta && typeof data.queue_meta === 'object'
                  ? data.queue_meta
                  : queueStatePayload;
        const queueTickets = Array.isArray(data.queue_tickets)
            ? data.queue_tickets
            : Array.isArray(data.queueTickets)
              ? data.queueTickets
              : buildQueueTicketsFromState(
                    queueStatePayload || queueMetaPayload
                );
        setQueueTickets(queueTickets);
        saveLocalData('queue-tickets', queueTickets);

        const queueMeta = normalizeQueueMetaPayload(queueMetaPayload);
        setQueueMeta(queueMeta);
        saveLocalData('queue-meta', queueMeta);

        if (data.funnelMetrics && typeof data.funnelMetrics === 'object') {
            setFunnelMetrics(data.funnelMetrics);
        } else {
            const funnelPayload = await apiRequest('funnel-metrics').catch(
                () => null
            );
            if (
                funnelPayload &&
                funnelPayload.data &&
                typeof funnelPayload.data === 'object'
            ) {
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
        showToast(
            'No se pudo conectar al backend. Usando datos locales.',
            'warning'
        );
    }
}
