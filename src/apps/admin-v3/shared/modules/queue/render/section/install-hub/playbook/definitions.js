export function buildPlaybookDefinitions(manifest, detectedPlatform, deps) {
    const {
        ensureInstallPreset,
        defaultAppDownloads,
        buildPreparedSurfaceUrl,
    } = deps;
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || defaultAppDownloads.operator;
    const kioskConfig = manifest.kiosk || defaultAppDownloads.kiosk;
    const salaConfig = manifest.sala_tv || defaultAppDownloads.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        opening: [
            {
                id: 'opening_operator',
                title: 'Abrir Operador',
                detail: 'Verifica estación, lock y flujo base del equipo principal.',
                href: operatorUrl,
                actionLabel: 'Abrir Operador',
            },
            {
                id: 'opening_kiosk',
                title: 'Validar Kiosco + térmica',
                detail: 'Confirma ticket térmico, cola viva y contingencia offline limpia.',
                href: kioskUrl,
                actionLabel: 'Abrir Kiosco',
            },
            {
                id: 'opening_sala',
                title: 'Validar Sala TV',
                detail: 'Deja audio, campanilla y visualización listos en la TCL C655.',
                href: salaUrl,
                actionLabel: 'Abrir Sala TV',
            },
        ],
        operations: [
            {
                id: 'operations_monitor',
                title: 'Monitorear equipos vivos',
                detail: 'Revisa heartbeat, cola viva y estado general antes de seguir atendiendo.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'operations_call',
                title: 'Lanzar siguiente llamada',
                detail: 'Usa C1/C2 o el operador actual para mover la cola con el menor roce posible.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'operations_log',
                title: 'Registrar cambio importante',
                detail: 'Si cambias perfil o detectas desvío, deja rastro en la bitácora operativa.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        incidents: [
            {
                id: 'incidents_refresh',
                title: 'Refrescar y confirmar sync',
                detail: 'Atiende primero fallback, retrasos y watchdog antes de tocar hardware.',
                href: '#queueContingencyDeck',
                actionLabel: 'Ir a contingencias',
            },
            {
                id: 'incidents_surface',
                title: 'Abrir el equipo afectado',
                detail: 'Ve directo a Operador, Kiosco o Sala TV según la superficie que cayó.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'incidents_log',
                title: 'Registrar incidencia',
                detail: 'Deja en la bitácora qué falló, qué se hizo y qué queda pendiente.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        closing: [
            {
                id: 'closing_queue',
                title: 'Confirmar cola limpia',
                detail: 'No cierres si todavía hay tickets waiting o called.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a relevo',
            },
            {
                id: 'closing_surfaces',
                title: 'Dejar superficies listas',
                detail: 'Operador, Kiosco y Sala TV deben quedar claros para el siguiente turno.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'closing_copy',
                title: 'Copiar y cerrar relevo',
                detail: 'Entrega un resumen textual corto del estado del turno.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a resumen',
            },
        ],
    };
}
