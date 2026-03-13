function normalizeClinicId(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function matchesClinic(entryClinicId, activeClinicId) {
    const normalizedActiveClinicId = normalizeClinicId(activeClinicId);
    if (!normalizedActiveClinicId) {
        return false;
    }

    return normalizeClinicId(entryClinicId) === normalizedActiveClinicId;
}

export function hasRecentQueueSmokeSignalForState(
    state,
    activeClinicId,
    maxAgeSec = 21600
) {
    const safeState = state && typeof state === 'object' ? state : {};
    const queueMeta = safeState?.data?.queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) {
        return true;
    }

    const queueTickets = Array.isArray(safeState?.data?.queueTickets)
        ? safeState.data.queueTickets
        : [];
    if (
        queueTickets.some((ticket) => String(ticket.status || '') === 'called')
    ) {
        return true;
    }

    return (Array.isArray(safeState?.queue?.activity)
        ? safeState.queue.activity
        : []
    ).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) {
            return false;
        }

        if (!matchesClinic(entry?.clinicId, activeClinicId)) {
            return false;
        }

        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) {
            return true;
        }
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}
