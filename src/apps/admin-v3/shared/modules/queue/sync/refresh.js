import { apiRequest } from '../../../core/api-client.js';
import { getState } from '../../../core/store.js';
import { normalize } from '../helpers.js';
import { appendActivity } from '../state.js';
import { applyQueueStateResponse } from './apply.js';
import { applyQueueSnapshotFallback, getQueueSnapshot } from './fallbacks.js';

export async function refreshQueueState() {
    try {
        const payload = await apiRequest('queue-state');
        applyQueueStateResponse(payload, { syncMode: 'live' });
        appendActivity('Queue refresh realizado');
    } catch (_error) {
        appendActivity('Queue refresh con error');
        applyQueueSnapshotFallback(getQueueSnapshot());
    }
}

export function shouldRefreshQueueOnSectionEnter() {
    const state = getState();
    if (
        normalize(state.queue.syncMode) === 'fallback' ||
        Boolean(state.queue.fallbackPartial)
    ) {
        return false;
    }
    return true;
}
