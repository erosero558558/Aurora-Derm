export function buildQueueQuickConsoleModel(manifest, detectedPlatform, deps) {
    const {
        buildQueueFocusMode,
        ensureInstallPreset,
        defaultAppDownloads,
        buildPreparedSurfaceUrl,
        buildOpeningChecklistAssist,
        buildShiftHandoffAssist,
        getQueueSyncHealth,
        getInstallPresetLabel,
        openingStepIds,
        shiftStepIds,
    } = deps;
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
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
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const chips = [
        getInstallPresetLabel(detectedPlatform),
        syncHealth.badge,
        focus.effectiveMode === 'closing'
            ? `Relevo ${handoffAssist.suggestedCount}/${shiftStepIds.length}`
            : `Apertura ${openingAssist.suggestedCount}/${openingStepIds.length}`,
    ];

    if (focus.effectiveMode === 'opening') {
        return {
            tone: 'opening',
            title: 'Consola rápida: Apertura',
            summary:
                openingAssist.suggestedCount > 0
                    ? 'Confirma pasos sugeridos o abre cada superficie sin bajar al resto del panel. Ideal para dejar listo Operador, Kiosco y Sala TV en menos clics.'
                    : 'Abre cada superficie operativa o vuelve al checklist de apertura para completar las validaciones manuales pendientes.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_opening_apply',
                    kind: 'button',
                    label:
                        openingAssist.suggestedCount > 0
                            ? `Confirmar sugeridos (${openingAssist.suggestedCount})`
                            : 'Sin sugeridos ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_kiosk',
                    kind: 'anchor',
                    label: 'Abrir Kiosco',
                    href: kioskUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    if (focus.effectiveMode === 'incidents') {
        return {
            tone: 'incidents',
            title: 'Consola rápida: Incidencias',
            summary:
                'Enfoca refresh, contingencia y registro de incidencia sin perder tiempo buscando la acción correcta en todo el hub.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_refresh',
                    kind: 'button',
                    label: 'Refrescar cola',
                    variant: 'primary',
                    action: 'queue-refresh-state',
                },
                {
                    id: 'queueQuickConsoleAction_incident_log',
                    kind: 'button',
                    label: 'Registrar incidencia',
                },
                {
                    id: 'queueQuickConsoleAction_open_contingency',
                    kind: 'anchor',
                    label: 'Ir a contingencias',
                    href: '#queueContingencyDeck',
                },
                {
                    id: 'queueQuickConsoleAction_open_log',
                    kind: 'anchor',
                    label: 'Ir a bitácora',
                    href: '#queueOpsLog',
                },
            ],
        };
    }

    if (focus.effectiveMode === 'closing') {
        return {
            tone: 'closing',
            title: 'Consola rápida: Cierre',
            summary:
                handoffAssist.suggestedCount > 0
                    ? 'Confirma el relevo sugerido, copia el resumen y deja a la vista las superficies críticas del cierre.'
                    : 'Abre operador o sala y remata el cierre del turno sin desplazarte por todos los bloques.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_closing_apply',
                    kind: 'button',
                    label:
                        handoffAssist.suggestedCount > 0
                            ? `Confirmar relevo (${handoffAssist.suggestedCount})`
                            : 'Sin relevo sugerido ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_copy_handoff',
                    kind: 'button',
                    label: 'Copiar resumen de relevo',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator_close',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala_close',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    return {
        tone: 'operations',
        title: 'Consola rápida: Operación',
        summary:
            'Llama el siguiente turno, refresca la cola o abre la superficie correcta sin saltar entre el header y el resto del hub.',
        chips,
        actions: [
            {
                id: 'queueQuickConsoleAction_call_c1',
                kind: 'button',
                label: 'Llamar C1',
                variant: 'primary',
                action: 'queue-call-next',
                consultorio: 1,
            },
            {
                id: 'queueQuickConsoleAction_call_c2',
                kind: 'button',
                label: 'Llamar C2',
                action: 'queue-call-next',
                consultorio: 2,
            },
            {
                id: 'queueQuickConsoleAction_refresh_ops',
                kind: 'button',
                label: 'Refrescar cola',
                action: 'queue-refresh-state',
            },
            {
                id: 'queueQuickConsoleAction_open_operator_ops',
                kind: 'anchor',
                label: 'Abrir Operador',
                href: operatorUrl,
                external: true,
            },
        ],
    };
}
