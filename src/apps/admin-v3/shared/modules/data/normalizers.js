function normalizeCallbacks(list) {
    return (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        status: String(item.status || '')
            .toLowerCase()
            .includes('contact')
            ? 'contacted'
            : 'pending',
        leadOps:
            item.leadOps && typeof item.leadOps === 'object' ? item.leadOps : {},
    }));
}

function normalizeQueueTickets(data) {
    if (Array.isArray(data.queue_tickets)) return data.queue_tickets;
    if (Array.isArray(data.queueTickets)) return data.queueTickets;
    return [];
}

export function normalizeAdminDataPayload(data, healthPayload, fallbackState) {
    return {
        appointments: Array.isArray(data.appointments) ? data.appointments : [],
        callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        availability:
            data.availability && typeof data.availability === 'object'
                ? data.availability
                : {},
        availabilityMeta:
            data.availabilityMeta && typeof data.availabilityMeta === 'object'
                ? data.availabilityMeta
                : {},
        queueTickets: normalizeQueueTickets(data),
        queueMeta:
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : data.queue_state && typeof data.queue_state === 'object'
                  ? data.queue_state
                  : null,
        leadOpsMeta:
            data.leadOpsMeta && typeof data.leadOpsMeta === 'object'
                ? data.leadOpsMeta
                : fallbackState?.leadOpsMeta || null,
        queueSurfaceStatus:
            data.queueSurfaceStatus && typeof data.queueSurfaceStatus === 'object'
                ? data.queueSurfaceStatus
                : data.queue_surface_status &&
                    typeof data.queue_surface_status === 'object'
                  ? data.queue_surface_status
                  : fallbackState?.queueSurfaceStatus || null,
        appDownloads:
            data.appDownloads && typeof data.appDownloads === 'object'
                ? data.appDownloads
                : fallbackState?.appDownloads || null,
        turneroClinicProfile:
            data.turneroClinicProfile &&
            typeof data.turneroClinicProfile === 'object'
                ? data.turneroClinicProfile
                : fallbackState?.turneroClinicProfile || null,
        clinicalHistoryMeta:
            data.clinicalHistoryMeta &&
            typeof data.clinicalHistoryMeta === 'object'
                ? data.clinicalHistoryMeta
                : fallbackState?.clinicalHistoryMeta || null,
        mediaFlowMeta:
            data.mediaFlowMeta && typeof data.mediaFlowMeta === 'object'
                ? data.mediaFlowMeta
                : fallbackState?.mediaFlowMeta || null,
        funnelMetrics: data.funnelMetrics || fallbackState?.funnelMetrics || null,
        health: healthPayload && healthPayload.ok ? healthPayload : null,
    };
}

export function normalizeAdminStorePayload(payload, currentFunnelMetrics) {
    return {
        appointments: payload.appointments || [],
        callbacks: normalizeCallbacks(payload.callbacks || []),
        reviews: payload.reviews || [],
        availability: payload.availability || {},
        availabilityMeta: payload.availabilityMeta || {},
        queueTickets: payload.queueTickets || [],
        queueMeta: payload.queueMeta || null,
        leadOpsMeta: payload.leadOpsMeta || null,
        queueSurfaceStatus: payload.queueSurfaceStatus || null,
        appDownloads: payload.appDownloads || null,
        turneroClinicProfile: payload.turneroClinicProfile || null,
        clinicalHistoryMeta: payload.clinicalHistoryMeta || null,
        mediaFlowMeta: payload.mediaFlowMeta || null,
        funnelMetrics: payload.funnelMetrics || currentFunnelMetrics,
        health: payload.health || null,
    };
}
