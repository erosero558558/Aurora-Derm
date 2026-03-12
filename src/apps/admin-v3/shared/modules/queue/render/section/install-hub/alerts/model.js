export function buildQueueSyncAlert(deps) {
    const { getQueueSyncHealth, getQueueSource, formatHeartbeatAge } = deps;
    const syncHealth = getQueueSyncHealth();
    if (syncHealth.state === 'ready') {
        return null;
    }

    const { queueMeta } = getQueueSource();
    const updatedAtMs = Date.parse(String(queueMeta?.updatedAt || ''));
    const ageLabel = Number.isFinite(updatedAtMs)
        ? `Ultima cola actualizada hace ${formatHeartbeatAge(
              Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
          )}`
        : 'Sin marca reciente de cola';

    return {
        id: `queue_sync_${syncHealth.state}`,
        scope: 'Cola admin',
        tone: syncHealth.state === 'alert' ? 'alert' : 'warning',
        title:
            syncHealth.state === 'alert'
                ? 'Realtime degradado o en fallback'
                : 'Realtime lento o en reconexión',
        summary: syncHealth.summary,
        meta: ageLabel,
        href: '/admin.html#queue',
        actionLabel: 'Abrir cola admin',
    };
}

function buildOperatorAlert(manifest, detectedPlatform, deps) {
    const {
        ensureInstallPreset,
        getDefaultAppDownloads,
        buildPreparedSurfaceUrl,
        getLatestSurfaceDetails,
        buildSignalAgeLabel,
    } = deps;
    const preset = ensureInstallPreset(detectedPlatform);
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const appConfig = manifest.operator || getDefaultAppDownloads().operator;
    const route = buildPreparedSurfaceUrl('operator', appConfig, {
        ...preset,
        surface: 'operator',
    });
    const { group, latest, details } = getLatestSurfaceDetails('operator');
    const station = String(details.station || '')
        .trim()
        .toLowerCase();
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'operator_signal',
            scope: 'Operador',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Operador sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'Todavía no hay heartbeat suficiente del equipo operador para confiar en el llamado diario.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir operador',
        };
    }

    if (preset.lock && station && station !== expectedStation) {
        return {
            id: 'operator_station_mismatch',
            scope: 'Operador',
            tone: 'alert',
            title: `Operador en ${station.toUpperCase()} y perfil activo en ${expectedStation.toUpperCase()}`,
            summary:
                'La estación reportada no coincide con el preset bloqueado. Corrige el perfil o reabre el operador antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir operador',
        };
    }

    if (!details.numpadSeen) {
        return {
            id: 'operator_numpad_pending',
            scope: 'Operador',
            tone: 'warning',
            title: 'Genius Numpad 1000 sin pulsación reciente',
            summary:
                'Falta una tecla real del numpad para cerrar la validación operativa. Si usas 1 tecla, este chequeo conviene resolverlo primero.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Validar numpad',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'operator_connection',
            scope: 'Operador',
            tone: 'warning',
            title: 'Operador fuera de cola viva',
            summary:
                'El operador sigue arriba, pero no está reportando conexión viva con la cola. Mantén el fallback preparado antes de seguir atendiendo.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar operador',
        };
    }

    return null;
}

function buildKioskAlert(manifest, detectedPlatform, deps) {
    const {
        ensureInstallPreset,
        getDefaultAppDownloads,
        buildPreparedSurfaceUrl,
        getLatestSurfaceDetails,
        buildSignalAgeLabel,
    } = deps;
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.kiosk || getDefaultAppDownloads().kiosk;
    const route = buildPreparedSurfaceUrl('kiosk', appConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const { group, latest, details } = getLatestSurfaceDetails('kiosk');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const pendingOffline = Math.max(0, Number(details.pendingOffline || 0));
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'kiosk_signal',
            scope: 'Kiosco',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Kiosco sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'No hay heartbeat reciente del kiosco. Conviene abrir la superficie antes de dejar autoservicio abierto.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir kiosco',
        };
    }

    if (!details.printerPrinted) {
        return {
            id: 'kiosk_printer_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Térmica pendiente en kiosco',
            summary:
                'Todavía no hay impresión OK reportada. Genera un ticket real o de prueba antes de depender del kiosco.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar kiosco',
        };
    }

    if (pendingOffline > 0) {
        return {
            id: 'kiosk_offline_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco con pendientes offline',
            summary: `El kiosco mantiene ${pendingOffline} registro(s) sin sincronizar. Resuélvelo antes de dejar el equipo solo por mucho tiempo.`,
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'kiosk_connection',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco sin cola viva',
            summary:
                'El kiosco está arriba, pero la cola no figura como viva. Mantén una ruta web preparada antes de seguir recibiendo pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    return null;
}

function buildDisplayAlert(manifest, detectedPlatform, deps) {
    const {
        ensureInstallPreset,
        getDefaultAppDownloads,
        buildPreparedSurfaceUrl,
        getLatestSurfaceDetails,
        buildSignalAgeLabel,
    } = deps;
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.sala_tv || getDefaultAppDownloads().sala_tv;
    const route = buildPreparedSurfaceUrl('sala_tv', appConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const { group, latest, details } = getLatestSurfaceDetails('display');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'display_signal',
            scope: 'Sala TV',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Sala TV sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'La TV no está enviando heartbeat reciente. Conviene abrir la app o el fallback antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir sala TV',
        };
    }

    if (details.bellMuted) {
        return {
            id: 'display_bell_muted',
            scope: 'Sala TV',
            tone: 'alert',
            title: 'Campanilla o volumen apagados en Sala TV',
            summary:
                'La TV reporta mute o campanilla desactivada. El llamado visual puede salir, pero perderás confirmación sonora para pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir audio',
        };
    }

    if (!details.bellPrimed) {
        return {
            id: 'display_bell_pending',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV sin prueba de campanilla',
            summary:
                'Falta ejecutar la prueba de audio o campanilla en la TCL C655. Hazlo antes del siguiente llamado real.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar sala TV',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'display_connection',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV fuera de cola viva',
            summary:
                'La pantalla sigue abierta, pero no está marcando conexión viva. Conviene revisar la app o la red antes de depender de la TV.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar sala TV',
        };
    }

    return null;
}

export function buildQueueOpsAlertsModel(manifest, detectedPlatform, deps) {
    const { ensureOpsAlertsState } = deps;
    const reviewState = ensureOpsAlertsState();
    const alerts = [
        buildQueueSyncAlert(deps),
        buildOperatorAlert(manifest, detectedPlatform, deps),
        buildKioskAlert(manifest, detectedPlatform, deps),
        buildDisplayAlert(manifest, detectedPlatform, deps),
    ]
        .filter(Boolean)
        .map((alert) => {
            const reviewedMeta = reviewState.reviewed[String(alert.id)] || null;
            return {
                ...alert,
                reviewed: Boolean(reviewedMeta),
                reviewedAt: reviewedMeta?.reviewedAt || '',
            };
        });

    const criticalCount = alerts.filter(
        (alert) => alert.tone === 'alert'
    ).length;
    const reviewedCount = alerts.filter((alert) => alert.reviewed).length;
    const pendingCount = alerts.length - reviewedCount;
    const tone =
        criticalCount > 0 ? 'alert' : alerts.length > 0 ? 'warning' : 'ready';
    const title =
        alerts.length === 0
            ? 'Sin alertas activas'
            : criticalCount > 0
              ? 'Alertas activas del turno'
              : 'Observaciones activas del turno';
    const summary =
        alerts.length === 0
            ? 'La cola, Operador, Kiosco y Sala TV no muestran incidencias abiertas ahora mismo.'
            : criticalCount > 0
              ? `${criticalCount} alerta(s) crítica(s) y ${Math.max(0, alerts.length - criticalCount)} observación(es) activas. Marca una alerta como revisada cuando ya alguien la atendió, pero seguirá visible hasta resolverse.`
              : `${alerts.length} observación(es) activas. Usa este panel para decidir qué equipo abrir primero sin bajar por toda la pantalla.`;

    return {
        tone,
        title,
        summary,
        alerts,
        criticalCount,
        reviewedCount,
        pendingCount,
    };
}
