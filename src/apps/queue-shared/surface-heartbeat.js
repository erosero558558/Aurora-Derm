const HEARTBEAT_RESOURCE = 'queue-surface-heartbeat';
const DEFAULT_INTERVAL_MS = 15000;
const DEVICE_ID_STORAGE_PREFIX = 'queueSurfaceDeviceIdV1:';
const NOTIFY_THROTTLE_MS = 4000;

function normalizeSurface(surface) {
    const value = String(surface || '').trim().toLowerCase();
    if (value === 'sala_tv') return 'display';
    return value || 'operator';
}

function createDeviceId(surface) {
    if (typeof crypto === 'object' && crypto && typeof crypto.randomUUID === 'function') {
        return `${surface}-${crypto.randomUUID()}`;
    }

    const random = Math.random().toString(36).slice(2, 10);
    return `${surface}-${Date.now().toString(36)}-${random}`;
}

function getDeviceId(surface) {
    const key = `${DEVICE_ID_STORAGE_PREFIX}${surface}`;
    try {
        const existing = localStorage.getItem(key);
        if (existing) {
            return existing;
        }
        const nextId = createDeviceId(surface);
        localStorage.setItem(key, nextId);
        return nextId;
    } catch (_error) {
        return createDeviceId(surface);
    }
}

function buildRequestBody(surface, deviceId, getPayload, reason) {
    const payload =
        typeof getPayload === 'function' && getPayload()
            ? getPayload()
            : {};
    const details =
        payload.details && typeof payload.details === 'object' ? payload.details : {};

    return {
        surface,
        deviceId,
        instance: String(payload.instance || 'main'),
        deviceLabel: String(payload.deviceLabel || ''),
        appMode: String(payload.appMode || 'web'),
        route:
            String(payload.route || '').trim() ||
            `${window.location.pathname}${window.location.search}`,
        status: String(payload.status || 'warning'),
        summary: String(payload.summary || ''),
        networkOnline:
            typeof payload.networkOnline === 'boolean'
                ? payload.networkOnline
                : navigator.onLine !== false,
        lastEvent: String(payload.lastEvent || reason || 'heartbeat'),
        lastEventAt: String(payload.lastEventAt || new Date().toISOString()),
        details,
    };
}

export function createSurfaceHeartbeatClient({
    surface,
    intervalMs = DEFAULT_INTERVAL_MS,
    getPayload,
} = {}) {
    const normalizedSurface = normalizeSurface(surface);
    const deviceId = getDeviceId(normalizedSurface);
    const safeIntervalMs = Math.max(5000, Number(intervalMs || DEFAULT_INTERVAL_MS));

    let timerId = 0;
    let inFlight = false;
    let lastSentAt = 0;
    let listenersAttached = false;

    async function send(reason = 'interval', { keepalive = false } = {}) {
        if (inFlight) {
            return false;
        }

        inFlight = true;
        try {
            const response = await fetch(`/api.php?resource=${encodeURIComponent(HEARTBEAT_RESOURCE)}`, {
                method: 'POST',
                credentials: 'same-origin',
                keepalive,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(
                    buildRequestBody(normalizedSurface, deviceId, getPayload, reason)
                ),
            });
            if (!response.ok) {
                return false;
            }
            lastSentAt = Date.now();
            return true;
        } catch (_error) {
            return false;
        } finally {
            inFlight = false;
        }
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            void send('visible');
        }
    }

    function handleOnline() {
        void send('online');
    }

    function handleBeforeUnload() {
        void send('unload', { keepalive: true });
    }

    function attachListeners() {
        if (listenersAttached) {
            return;
        }
        listenersAttached = true;
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    function detachListeners() {
        if (!listenersAttached) {
            return;
        }
        listenersAttached = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    function start({ immediate = true } = {}) {
        stop();
        attachListeners();
        if (immediate) {
            void send('boot');
        }
        timerId = window.setInterval(() => {
            if (document.visibilityState === 'hidden') {
                return;
            }
            void send('interval');
        }, safeIntervalMs);
    }

    function stop() {
        if (timerId) {
            window.clearInterval(timerId);
            timerId = 0;
        }
        detachListeners();
    }

    function notify(reason = 'state_change') {
        if ((Date.now() - lastSentAt) < NOTIFY_THROTTLE_MS) {
            return;
        }
        void send(reason);
    }

    return {
        start,
        stop,
        notify,
        beatNow(reason = 'manual') {
            return send(reason);
        },
        getDeviceId() {
            return deviceId;
        },
    };
}
