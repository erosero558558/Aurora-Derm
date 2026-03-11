import { formatHeartbeatAge, formatIntervalAge } from '../format.js';
import { getSurfaceTelemetryAutoRefreshState } from '../state.js';

export function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle')
        .trim()
        .toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt
        ? `ultimo ciclo hace ${formatHeartbeatAge(Math.max(0, Math.round((Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000)))}`
        : 'sin ciclo exitoso todavía';

    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`,
        };
    }
    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(
                runtime.reason || 'Reanuda esta sección para continuar.'
            ),
        };
    }
    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(
                runtime.reason || `Modo degradado · ${lastSuccessLabel}`
            ),
        };
    }
    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`,
        };
    }
    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(
            runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.'
        ),
    };
}
