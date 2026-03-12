export function buildQueuePlaybookModel(manifest, detectedPlatform, deps) {
    const {
        buildQueueFocusMode,
        buildPlaybookDefinitions,
        ensureOpsPlaybookState,
    } = deps;
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    const definitions = buildPlaybookDefinitions(manifest, detectedPlatform);
    const mode = focus.effectiveMode;
    const steps = definitions[mode] || [];
    const state = ensureOpsPlaybookState();
    const modeState =
        state.modes && typeof state.modes[mode] === 'object'
            ? state.modes[mode]
            : {};
    const completedCount = steps.filter((step) =>
        Boolean(modeState[step.id])
    ).length;
    const nextStep = steps.find((step) => !modeState[step.id]) || null;
    const summary = nextStep
        ? `Paso actual: ${nextStep.title}. ${nextStep.detail}`
        : 'La secuencia de este modo ya quedó completa. Puedes reiniciarla o pasar al siguiente momento del turno.';

    return {
        mode,
        title: `Playbook activo: ${focus.title.replace('Modo foco: ', '')}`,
        summary,
        steps,
        completedCount,
        totalSteps: steps.length,
        nextStep,
        modeState,
    };
}

export function buildQueuePlaybookAssistModel(
    manifest,
    detectedPlatform,
    deps
) {
    const {
        buildQueuePlaybook,
        ensureOpeningChecklistState,
        ensureShiftHandoffState,
        buildOpeningChecklistAssist,
        buildShiftHandoffAssist,
        getQueueSyncHealth,
        getSurfaceTelemetryState,
        ensureOpsLogState,
    } = deps;
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const opening = ensureOpeningChecklistState();
    const shift = ensureShiftHandoffState();
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const log = ensureOpsLogState();
    const logHasIncident = log.items.some((item) => item.source === 'incident');
    const logHasStatus = log.items.some((item) => item.source === 'status');
    const openingMap = {
        opening_operator: {
            suggested:
                Boolean(opening.steps.operator_ready) ||
                Boolean(openingAssist.suggestions.operator_ready?.suggested),
            reason:
                openingAssist.suggestions.operator_ready?.reason ||
                'Operador todavía necesita validación explícita.',
        },
        opening_kiosk: {
            suggested:
                Boolean(opening.steps.kiosk_ready) ||
                Boolean(openingAssist.suggestions.kiosk_ready?.suggested),
            reason:
                openingAssist.suggestions.kiosk_ready?.reason ||
                'Kiosco todavía necesita validación explícita.',
        },
        opening_sala: {
            suggested:
                Boolean(opening.steps.sala_ready) ||
                Boolean(openingAssist.suggestions.sala_ready?.suggested),
            reason:
                openingAssist.suggestions.sala_ready?.reason ||
                'Sala TV todavía necesita validación explícita.',
        },
    };
    const surfacesHealthy =
        operator.status === 'ready' &&
        kiosk.status !== 'unknown' &&
        display.status === 'ready';
    const incidentOpen =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some((item) =>
            ['alert', 'warning', 'unknown'].includes(
                String(item.status || '').toLowerCase()
            )
        );
    const incidentMap = {
        incidents_refresh: {
            suggested: syncHealth.state !== 'alert',
            reason: syncHealth.summary,
        },
        incidents_surface: {
            suggested:
                operator.status !== 'unknown' ||
                kiosk.status !== 'unknown' ||
                display.status !== 'unknown',
            reason: 'Al menos una superficie ya está reportando señal para investigar desde el equipo correcto.',
        },
        incidents_log: {
            suggested: logHasIncident,
            reason: logHasIncident
                ? 'La bitácora ya tiene al menos una incidencia registrada.'
                : 'Todavía no hay incidencia registrada en la bitácora.',
        },
    };
    const closingSurfacesSuggested =
        (Boolean(shift.steps.operator_handoff) ||
            Boolean(handoffAssist.suggestions.operator_handoff?.suggested)) &&
        (Boolean(shift.steps.kiosk_handoff) ||
            Boolean(handoffAssist.suggestions.kiosk_handoff?.suggested)) &&
        (Boolean(shift.steps.sala_handoff) ||
            Boolean(handoffAssist.suggestions.sala_handoff?.suggested));
    const closingMap = {
        closing_queue: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                Boolean(handoffAssist.suggestions.queue_clear?.suggested),
            reason:
                handoffAssist.suggestions.queue_clear?.reason ||
                'La cola todavía necesita una validación final.',
        },
        closing_surfaces: {
            suggested: closingSurfacesSuggested,
            reason: closingSurfacesSuggested
                ? 'Operador, Kiosco y Sala TV ya aparecen listos para el siguiente turno.'
                : 'Todavía falta dejar una o más superficies listas para mañana.',
        },
        closing_copy: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                (Boolean(handoffAssist.suggestions.queue_clear?.suggested) &&
                    closingSurfacesSuggested),
            reason: 'Cuando cola y superficies quedan listas, conviene copiar el resumen final del relevo.',
        },
    };
    const operationsMap = {
        operations_monitor: {
            suggested: surfacesHealthy,
            reason: surfacesHealthy
                ? 'Las superficies ya reportan señal suficiente para operar con seguimiento.'
                : 'Falta señal estable en alguna superficie antes de dar por monitoreo resuelto.',
        },
        operations_call: {
            suggested:
                syncHealth.state !== 'alert' &&
                operator.status === 'ready' &&
                !operator.stale,
            reason: 'Llamar siguiente conviene cuando Operador está listo y la cola no está en fallback.',
        },
        operations_log: {
            suggested: logHasStatus,
            reason: logHasStatus
                ? 'La bitácora ya tiene estado operativo o cambios recientes.'
                : 'No hay estado operativo reciente en la bitácora.',
        },
    };

    const suggestionsByMode = {
        opening: openingMap,
        operations: operationsMap,
        incidents: incidentMap,
        closing: closingMap,
    };
    const modeSuggestions = suggestionsByMode[playbook.mode] || {};
    const suggestedIds = playbook.steps
        .filter(
            (step) =>
                !playbook.modeState[step.id] &&
                Boolean(modeSuggestions[step.id]?.suggested)
        )
        .map((step) => step.id);

    return {
        suggestions: modeSuggestions,
        suggestedIds,
        suggestedCount: suggestedIds.length,
        incidentOpen,
    };
}
