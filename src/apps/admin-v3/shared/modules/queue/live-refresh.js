import { getState, updateState } from '../../core/store.js';
import { setText } from '../../ui/render.js';
import { refreshAdminData, refreshStatusLabel } from '../data.js';
import { renderQueueSection } from './render.js';
import { hydrateQueueFromData } from './sync.js';

const DEFAULT_QUEUE_AUTO_REFRESH_INTERVAL_MS = 45000;
const MIN_QUEUE_AUTO_REFRESH_INTERVAL_MS = 50;

let initialized = false;
let timerId = 0;
let refreshInFlight = false;

function resolveQueueAutoRefreshIntervalMs() {
    if (typeof window !== 'undefined') {
        const override = Number(window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__);
        if (Number.isFinite(override) && override > 0) {
            return Math.max(
                MIN_QUEUE_AUTO_REFRESH_INTERVAL_MS,
                Math.round(override)
            );
        }
    }
    return DEFAULT_QUEUE_AUTO_REFRESH_INTERVAL_MS;
}

function getDefaultQueueAutoRefreshState() {
    return {
        state: 'idle',
        reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
        intervalMs: resolveQueueAutoRefreshIntervalMs(),
        lastAttemptAt: 0,
        lastSuccessAt: 0,
        lastError: '',
        inFlight: false,
    };
}

function getQueueAutoRefreshState() {
    return {
        ...getDefaultQueueAutoRefreshState(),
        ...(getState().ui?.queueAutoRefresh || {}),
    };
}

function patchQueueAutoRefresh(patch) {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            queueAutoRefresh: {
                ...getDefaultQueueAutoRefreshState(),
                ...(state.ui?.queueAutoRefresh || {}),
                ...patch,
            },
        },
    }));
}

function syncHeaderStatusLabel() {
    const label = refreshStatusLabel();
    setText('#adminRefreshStatus', label);
    setText(
        '#adminSyncState',
        label === 'Datos: sin sincronizar'
            ? 'Listo para primera sincronizacion'
            : label.replace('Datos: ', 'Estado: ')
    );
}

function resolveQueueAutoRefreshGuard() {
    const state = getState();
    if (!state.auth?.authenticated) {
        return {
            active: false,
            state: 'idle',
            reason: 'Inicia sesión para monitorear los equipos.',
        };
    }
    if (state.ui?.activeSection !== 'queue') {
        return {
            active: false,
            state: 'paused',
            reason: 'Abre Turnero Sala para reanudar el monitoreo.',
        };
    }
    if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
    ) {
        return {
            active: false,
            state: 'paused',
            reason: 'Pestaña oculta. El monitoreo se reanuda al volver al admin.',
        };
    }
    return {
        active: true,
        state: 'active',
        reason: 'Auto-refresh activo en esta sección.',
    };
}

export async function runQueueAutoRefreshCycle(reason = 'timer') {
    const guard = resolveQueueAutoRefreshGuard();
    const intervalMs = resolveQueueAutoRefreshIntervalMs();
    if (!guard.active) {
        patchQueueAutoRefresh({
            state: guard.state,
            reason: guard.reason,
            intervalMs,
            inFlight: false,
        });
        return false;
    }

    if (refreshInFlight) {
        return false;
    }

    refreshInFlight = true;
    patchQueueAutoRefresh({
        state: 'refreshing',
        reason:
            reason === 'visibility' || reason === 'focus' || reason === 'online'
                ? 'Actualizando al volver a primer plano.'
                : 'Actualizando Equipos en vivo.',
        intervalMs,
        lastAttemptAt: Date.now(),
        inFlight: true,
        lastError: '',
    });

    try {
        const ok = await refreshAdminData();
        await hydrateQueueFromData();
        patchQueueAutoRefresh({
            state: ok ? 'active' : 'warning',
            reason: ok
                ? 'Auto-refresh activo en esta sección.'
                : 'Sincronización degradada: usando cache local.',
            intervalMs,
            lastSuccessAt: Date.now(),
            inFlight: false,
            lastError: ok ? '' : 'cache_local',
        });
        renderQueueSection();
        syncHeaderStatusLabel();
        return ok;
    } catch (error) {
        patchQueueAutoRefresh({
            state: 'warning',
            reason:
                'No se pudo refrescar Equipos en vivo. Revisa red local o fuerza una actualización manual.',
            intervalMs,
            inFlight: false,
            lastError: error?.message || 'refresh_failed',
        });
        if (getState().ui?.activeSection === 'queue') {
            renderQueueSection();
        }
        return false;
    } finally {
        refreshInFlight = false;
    }
}

export function syncQueueAutoRefresh(options = {}) {
    const { immediate = false, reason = 'sync' } = options;
    const guard = resolveQueueAutoRefreshGuard();
    const intervalMs = resolveQueueAutoRefreshIntervalMs();

    patchQueueAutoRefresh({
        state: guard.state,
        reason: guard.reason,
        intervalMs,
        inFlight: refreshInFlight,
    });

    if (getState().ui?.activeSection === 'queue') {
        renderQueueSection();
    }

    if (immediate && guard.active) {
        void runQueueAutoRefreshCycle(reason);
        return true;
    }

    return guard.active;
}

function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        void runQueueAutoRefreshCycle('visibility');
        return;
    }
    syncQueueAutoRefresh();
}

function handleWindowFocus() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
    }
    if (getState().ui?.activeSection === 'queue') {
        void runQueueAutoRefreshCycle('focus');
    }
}

function handleWindowOnline() {
    if (getState().ui?.activeSection === 'queue') {
        void runQueueAutoRefreshCycle('online');
    }
}

export function initQueueAutoRefresh() {
    if (initialized || typeof window === 'undefined') {
        return;
    }
    initialized = true;

    timerId = window.setInterval(() => {
        void runQueueAutoRefreshCycle('timer');
    }, resolveQueueAutoRefreshIntervalMs());

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowOnline);

    syncQueueAutoRefresh({
        immediate: getState().auth?.authenticated && getState().ui?.activeSection === 'queue',
        reason: 'init',
    });
}

export function stopQueueAutoRefresh() {
    if (!initialized || typeof window === 'undefined') {
        return;
    }
    initialized = false;
    if (timerId) {
        window.clearInterval(timerId);
        timerId = 0;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('online', handleWindowOnline);
    refreshInFlight = false;
    patchQueueAutoRefresh({
        state: 'idle',
        reason: 'Monitoreo detenido.',
        inFlight: false,
    });
}

export function getQueueAutoRefreshMeta() {
    return getQueueAutoRefreshState();
}
