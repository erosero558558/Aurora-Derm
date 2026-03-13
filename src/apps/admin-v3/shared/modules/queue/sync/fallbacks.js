import { getState } from '../../../core/store.js';
import {
    buildTicketsFromMeta,
    normalizeQueueMeta,
    normalizeTicket,
} from '../model.js';
import { getQueueSnapshot as getScopedQueueSnapshot } from '../persistence.js';
import { appendActivity, setQueueStateWithTickets } from '../state.js';

export function getQueueSnapshot() {
    return getScopedQueueSnapshot();
}

export function getNormalizedStateTickets() {
    return Array.isArray(getState().data.queueTickets)
        ? getState().data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
}

export function getMetaFromStateData(tickets) {
    return getState().data.queueMeta &&
        typeof getState().data.queueMeta === 'object'
        ? normalizeQueueMeta(getState().data.queueMeta, tickets)
        : null;
}

export function applyQueueSnapshotFallback(snapshot, activityMessage = '') {
    if (!snapshot?.queueTickets?.length) {
        return false;
    }
    setQueueStateWithTickets(
        snapshot.queueTickets,
        snapshot.queueMeta || null,
        {
            fallbackPartial: true,
            syncMode: 'fallback',
        }
    );
    if (activityMessage) {
        appendActivity(activityMessage);
    }
    return true;
}

export function applyQueueMetaFallback(metaFromData) {
    const derivedFromMeta = metaFromData
        ? buildTicketsFromMeta(metaFromData)
        : [];
    if (!derivedFromMeta.length) {
        return false;
    }
    setQueueStateWithTickets(derivedFromMeta, metaFromData, {
        fallbackPartial: true,
        syncMode: 'fallback',
    });
    appendActivity('Queue fallback parcial desde metadata');
    return true;
}
