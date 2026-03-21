import { getState } from '../../../../../../core/store.js';
import { getQueueSource } from '../../../../selectors.js';

function resolveQueueSyncReferenceMs(state, queueMeta) {
    const queueUpdatedAtMs = Date.parse(
        String(queueMeta?.updatedAt || queueMeta?.updated_at || '')
    );
    if (Number.isFinite(queueUpdatedAtMs) && queueUpdatedAtMs > 0) {
        return queueUpdatedAtMs;
    }

    const uiRefreshMs = Number(state.ui?.lastRefreshAt || 0);
    const autoRefreshMs = Number(state.ui?.queueAutoRefresh?.lastSuccessAt || 0);

    return Math.max(uiRefreshMs, autoRefreshMs);
}

export function getQueueSyncHealth() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const syncMode = String(state.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state.queue?.fallbackPartial);
    const referenceMs = resolveQueueSyncReferenceMs(state, queueMeta);
    const ageSec = referenceMs
        ? Math.max(0, Math.round((Date.now() - referenceMs) / 1000))
        : null;
    const referenceAt = referenceMs > 0 ? new Date(referenceMs).toISOString() : '';

    if (syncMode === 'fallback' || fallbackPartial) {
        return {
            state: 'alert',
            badge: 'Atender ahora',
            title: 'Cola en fallback',
            summary:
                'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
            steps: [
                'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
            ],
            ageSec,
            referenceAt,
        };
    }

    if (Number.isFinite(ageSec) && ageSec >= 60) {
        return {
            state: 'warning',
            badge: `Watchdog ${ageSec}s`,
            title: 'Realtime lento o en reconexión',
            summary:
                'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
            steps: [
                'Refresca la cola y confirma que Sync vuelva a "vivo".',
                'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
            ],
            ageSec,
            referenceAt,
        };
    }

    return {
        state: 'ready',
        badge: 'Sin incidentes',
        title: 'Cola sincronizada',
        summary:
            'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
        steps: [
            'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
            'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
            'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
        ],
        ageSec,
        referenceAt,
    };
}
