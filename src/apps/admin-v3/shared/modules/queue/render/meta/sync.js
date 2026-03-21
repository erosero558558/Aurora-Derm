import { normalize, toMillis } from '../../helpers.js';
import { setText } from '../../../../ui/render.js';

let lastWatchdogBucket = '';

function resolveQueueSyncReferenceMs(state, queueMeta) {
    const queueUpdatedAtMs = toMillis(
        queueMeta?.updatedAt || queueMeta?.updated_at
    );
    if (queueUpdatedAtMs > 0) {
        return queueUpdatedAtMs;
    }

    const uiRefreshMs = Number(state.ui?.lastRefreshAt || 0);
    const autoRefreshMs = Number(state.ui?.queueAutoRefresh?.lastSuccessAt || 0);

    return Math.max(uiRefreshMs, autoRefreshMs);
}

export function renderQueueSyncMeta(state, queueMeta, appendActivity) {
    const syncNode = document.getElementById('queueSyncStatus');

    if (normalize(state.queue.syncMode) === 'fallback') {
        setText('#queueSyncStatus', 'fallback');
        if (syncNode) {
            syncNode.setAttribute('data-state', 'fallback');
        }
        return;
    }

    const referenceMs = resolveQueueSyncReferenceMs(state, queueMeta);
    if (!referenceMs) {
        return;
    }

    const ageSec = Math.max(0, Math.round((Date.now() - referenceMs) / 1000));
    const stale = ageSec >= 60;
    const assistancePending = Math.max(
        0,
        Number(queueMeta.assistancePendingCount || 0)
    );
    const baseStatus = stale ? `Watchdog (${ageSec}s)` : 'vivo';
    const statusText = assistancePending
        ? `${baseStatus} · ${assistancePending} apoyo(s)`
        : baseStatus;

    setText('#queueSyncStatus', statusText);
    if (syncNode) {
        syncNode.setAttribute('data-state', stale ? 'reconnecting' : 'live');
    }

    if (stale) {
        const bucket = `stale-${Math.floor(ageSec / 15)}`;
        if (bucket !== lastWatchdogBucket) {
            lastWatchdogBucket = bucket;
            appendActivity('Watchdog de cola: realtime en reconnecting');
        }
        return;
    }

    lastWatchdogBucket = 'live';
}
