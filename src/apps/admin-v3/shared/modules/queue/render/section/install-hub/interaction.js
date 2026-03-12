export function createQueueOpsInteractionController({
    getRoot,
    getChip,
    rerender,
    holdMs = 900,
}) {
    const state = {
        lastAt: 0,
        timerId: 0,
        settleTimerId: 0,
        pendingManifest: null,
        pendingPlatform: '',
    };

    function resolveMeta() {
        if (state.pendingManifest) {
            return {
                state: 'deferred',
                label: 'Refresh en espera',
                detail: 'Se mantiene el hub estable hasta que termine la interacción actual.',
            };
        }
        if (hasActive()) {
            return {
                state: 'active',
                label: 'Protegiendo interacción',
                detail: 'El hub aplaza repaints breves mientras estás usando sus controles.',
            };
        }
        return {
            state: 'idle',
            label: 'Refresh sin bloqueo',
            detail: 'El hub puede repintarse cuando llegue información nueva.',
        };
    }

    function syncIndicator() {
        const meta = resolveMeta();
        const root = getRoot();
        const chip = getChip();
        if (root) {
            root.dataset.queueInteractionState = meta.state;
        }
        if (chip) {
            chip.dataset.state = meta.state;
            chip.textContent = meta.label;
            chip.title = meta.detail;
            chip.setAttribute('aria-label', meta.detail);
        }
    }

    function clearSettleTimer() {
        if (state.settleTimerId) {
            window.clearTimeout(state.settleTimerId);
            state.settleTimerId = 0;
        }
    }

    function getAgeMs() {
        if (!state.lastAt) {
            return Number.POSITIVE_INFINITY;
        }
        return Math.max(0, Date.now() - state.lastAt);
    }

    function hasActive() {
        return getAgeMs() < holdMs;
    }

    function scheduleSettle() {
        clearSettleTimer();
        if (state.pendingManifest) {
            syncIndicator();
            return;
        }
        if (!hasActive()) {
            syncIndicator();
            return;
        }
        const waitMs = Math.max(80, holdMs - getAgeMs());
        state.settleTimerId = window.setTimeout(() => {
            state.settleTimerId = 0;
            if (state.pendingManifest) {
                syncIndicator();
                return;
            }
            if (hasActive()) {
                scheduleSettle();
                return;
            }
            syncIndicator();
        }, waitMs);
    }

    function markInteraction() {
        state.lastAt = Date.now();
        syncIndicator();
        scheduleSettle();
    }

    function bind(root) {
        if (
            !(root instanceof HTMLElement) ||
            root.dataset.queueInteractionBound === 'true'
        ) {
            return;
        }

        const signalInteraction = () => {
            markInteraction();
        };

        root.addEventListener('pointerdown', signalInteraction, true);
        root.addEventListener('keydown', signalInteraction, true);
        root.addEventListener('focusin', signalInteraction, true);
        root.addEventListener('input', signalInteraction, true);
        root.addEventListener('change', signalInteraction, true);
        root.dataset.queueInteractionBound = 'true';
    }

    function clearDeferred() {
        if (state.timerId) {
            window.clearTimeout(state.timerId);
            state.timerId = 0;
        }
        state.pendingManifest = null;
        state.pendingPlatform = '';
        syncIndicator();
        scheduleSettle();
    }

    function flushDeferred() {
        const manifest = state.pendingManifest;
        const platform = state.pendingPlatform;
        state.timerId = 0;
        if (!manifest) {
            clearDeferred();
            return;
        }
        if (hasActive()) {
            scheduleDeferred(manifest, platform);
            return;
        }
        rerender({
            allowDuringInteraction: true,
            manifestOverride: manifest,
            platformOverride: platform,
        });
    }

    function scheduleDeferred(manifest, detectedPlatform) {
        state.pendingManifest = manifest;
        state.pendingPlatform = detectedPlatform;
        if (state.timerId) {
            window.clearTimeout(state.timerId);
        }
        clearSettleTimer();
        syncIndicator();
        const waitMs = Math.max(80, holdMs - getAgeMs());
        state.timerId = window.setTimeout(() => {
            flushDeferred();
        }, waitMs);
    }

    return {
        bind,
        clearDeferred,
        hasActive,
        scheduleDeferred,
        scheduleSettle,
        syncIndicator,
    };
}
