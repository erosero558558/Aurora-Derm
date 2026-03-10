import { DEFAULT_APP_DOWNLOADS } from '../constants.js';
import {
    buildOpeningChecklistAssist,
    buildOpeningChecklistSteps,
} from '../checklist.js';
import { buildPreparedSurfaceUrl } from '../manifest.js';
import { ensureInstallPreset, ensureOpeningChecklistState } from '../state.js';
import { getQueueSyncHealth } from '../telemetry.js';

export function buildQueueOpsPilot(manifest, detectedPlatform) {
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = [
        'operator_ready',
        'kiosk_ready',
        'sala_ready',
    ].filter((key) => Boolean(assist.suggestions[key]?.suggested)).length;
    const issueCount =
        Math.max(0, 3 - readyEquipmentCount) +
        (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;

    let tone;
    let eyebrow;
    let title;
    let summary;
    let primaryAction;
    let secondaryAction;
    let supportCopy;

    if (syncHealth.state === 'alert') {
        tone = 'alert';
        eyebrow = 'Siguiente paso';
        title = 'Resuelve la cola antes de abrir';
        summary =
            'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotRefreshBtn',
            action: 'queue-refresh-state',
            label: 'Refrescar cola ahora',
        };
        secondaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        supportCopy =
            'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.';
    } else if (suggestedCount > 0) {
        tone = 'suggested';
        eyebrow = 'Siguiente paso';
        title = `Confirma ${suggestedCount} paso(s) ya validados`;
        summary =
            pendingAfterSuggestions.length > 0
                ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotApplyBtn',
            label: `Confirmar sugeridos (${suggestedCount})`,
        };
        secondaryAction =
            pendingAfterSuggestions.length > 0
                ? {
                      kind: 'anchor',
                      href: pendingAfterSuggestions[0].href,
                      label: pendingAfterSuggestions[0].actionLabel,
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Volver a la cola',
                  };
        supportCopy =
            'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.';
    } else if (pendingAfterSuggestions.length > 0) {
        tone = syncHealth.state === 'warning' ? 'warning' : 'active';
        eyebrow = 'Siguiente paso';
        title = `Siguiente paso: ${pendingAfterSuggestions[0].title}`;
        summary =
            pendingAfterSuggestions.length > 1
                ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                : 'Solo queda una validación manual para dejar la apertura lista.';
        primaryAction = {
            kind: 'anchor',
            href: pendingAfterSuggestions[0].href,
            label: pendingAfterSuggestions[0].actionLabel,
        };
        secondaryAction =
            syncHealth.state === 'warning'
                ? {
                      kind: 'button',
                      id: 'queueOpsPilotRefreshBtn',
                      action: 'queue-refresh-state',
                      label: 'Refrescar cola',
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  };
        supportCopy = String(
            assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                pendingAfterSuggestions[0].hint ||
                ''
        );
    } else {
        tone = 'ready';
        eyebrow = 'Operación lista';
        title = 'Apertura completada';
        summary =
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.';
        primaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        secondaryAction = {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        };
        supportCopy =
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.';
    }

    return {
        tone,
        eyebrow,
        title,
        summary,
        supportCopy,
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        primaryAction,
        secondaryAction,
    };
}
