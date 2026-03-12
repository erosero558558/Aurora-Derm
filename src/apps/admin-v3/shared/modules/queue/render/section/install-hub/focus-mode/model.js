export function buildQueueFocusModeModel(manifest, detectedPlatform, deps) {
    const {
        ensureOpsFocusMode,
        getQueueSyncHealth,
        getSortedWaitingTickets,
        getCalledTicketForConsultorio,
        ensureOpeningChecklistState,
        openingStepIds,
        ensureShiftHandoffState,
        shiftStepIds,
        getSurfaceTelemetryState,
        buildShiftHandoffAssist,
    } = deps;
    const selectedMode = ensureOpsFocusMode();
    const manifestReady = Boolean(manifest && typeof manifest === 'object');
    const syncHealth = getQueueSyncHealth();
    const openingPending =
        openingStepIds.length -
        openingStepIds.filter(
            (stepId) => ensureOpeningChecklistState().steps[stepId]
        ).length;
    const closingPending =
        shiftStepIds.length -
        shiftStepIds.filter((stepId) => ensureShiftHandoffState().steps[stepId])
            .length;
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const waitingTickets = Array.isArray(getSortedWaitingTickets?.())
        ? getSortedWaitingTickets()
        : [];
    const activeCalledCount = [1, 2].filter((consultorio) =>
        Boolean(getCalledTicketForConsultorio?.(consultorio))
    ).length;
    const hasOperationsLoad =
        waitingTickets.length > 0 || activeCalledCount > 0;
    const hasAlert =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some(
            (entry) => String(entry.status || '').toLowerCase() === 'alert'
        );
    const queueClear = Boolean(
        buildShiftHandoffAssist(detectedPlatform).suggestions.queue_clear
            ?.suggested
    );
    const suggestedMode = hasAlert
        ? 'incidents'
        : hasOperationsLoad
          ? 'operations'
          : openingPending > 0
            ? 'opening'
            : queueClear && closingPending > 0
              ? 'closing'
              : 'operations';
    const effectiveMode =
        selectedMode === 'auto' ? suggestedMode : selectedMode;

    if (effectiveMode === 'opening') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Apertura',
            summary:
                openingPending > 0
                    ? `Quedan ${openingPending} validaciones de apertura. Mantén visibles Operador, Telemetría y el checklist hasta dejar lista la mañana.`
                    : 'La apertura ya está confirmada, pero puedes revisar el checklist o ajustar la instalación del equipo.',
            primaryHref: '#queueOpeningChecklist',
            primaryLabel: 'Ir a apertura diaria',
        };
    }

    if (effectiveMode === 'incidents') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Incidencias',
            summary:
                syncHealth.state === 'alert'
                    ? 'La cola está degradada o en fallback. En este modo se priorizan contingencias, equipos vivos y señales críticas.'
                    : 'Mantén a la vista contingencias y equipos con señal parcial para resolver la incidencia sin distraerte con instalación o cierre.',
            primaryHref: '#queueContingencyDeck',
            primaryLabel: 'Ir a contingencias',
        };
    }

    if (effectiveMode === 'closing') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Cierre',
            summary:
                closingPending > 0
                    ? `La cola ya permite relevo y faltan ${closingPending} paso(s) para cerrar el turno con evidencia clara.`
                    : 'El relevo ya quedó completo; usa este foco si necesitas revisar la salida del día o copiar el resumen final.',
            primaryHref: '#queueShiftHandoff',
            primaryLabel: 'Ir a cierre y relevo',
        };
    }

    return {
        selectedMode,
        suggestedMode,
        effectiveMode: 'operations',
        title: 'Modo foco: Operación',
        summary: manifestReady
            ? 'Mantén visibles equipos en vivo, bitácora y contingencias para operar durante el día sin mezclar apertura o cierre.'
            : 'Mantén visibles equipos y bitácora mientras el hub termina de cargar el catálogo operativo.',
        primaryHref: '#queueSurfaceTelemetry',
        primaryLabel: 'Ir a equipos en vivo',
    };
}
