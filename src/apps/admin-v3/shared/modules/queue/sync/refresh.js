import { apiRequest } from '../../../core/api-client.js';
import { getState } from '../../../core/store.js';
import { normalize } from '../helpers.js';
import { getQueueCommandAdapter } from '../command-adapter.js';
import { appendActivity } from '../state.js';
import { applyQueueStateResponse } from './apply.js';
import { applyQueueSnapshotFallback, getQueueSnapshot } from './fallbacks.js';

let refreshQueueStateInFlight = null;

export async function refreshQueueState() {
    if (refreshQueueStateInFlight) {
        return refreshQueueStateInFlight;
    }

    refreshQueueStateInFlight = (async () => {
        const commandAdapter = getQueueCommandAdapter();
        if (typeof commandAdapter?.refreshQueueState === 'function') {
            return commandAdapter.refreshQueueState();
        }

        try {
            const payload = await apiRequest('queue-state');
            applyQueueStateResponse(payload, { syncMode: 'live' });
            appendActivity('Queue refresh realizado');
            return payload;
        } catch (_error) {
            appendActivity('Queue refresh con error');
            applyQueueSnapshotFallback(getQueueSnapshot());
            return null;
        }
    })();

    try {
        return await refreshQueueStateInFlight;
    } finally {
        refreshQueueStateInFlight = null;
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
