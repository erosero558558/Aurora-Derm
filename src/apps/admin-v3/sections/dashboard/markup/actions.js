import { escapeHtml } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function actionItem(action, label, meta) {
    return `
        <button type="button" class="operations-action-item" data-action="${escapeHtml(action)}">
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

export function buildOperations(state) {
    const {
        appointments,
        availabilityDays,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        waitingTickets,
    } = state;

    return [
        actionItem(
            'context-open-appointments-overview',
            'Abrir agenda',
            nextAppointment?.item
                ? `Siguiente cita ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                : `${appointments.length} cita(s) cargadas`
        ),
        actionItem(
            'context-open-callbacks-pending',
            'Revisar pendientes',
            pendingTransfers > 0
                ? `${pendingTransfers} pago(s) y ${pendingCallbacks} llamada(s) por resolver`
                : `${pendingCallbacks} llamada(s) pendientes`
        ),
        actionItem(
            'context-open-availability',
            'Abrir horarios',
            availabilityDays > 0
                ? `${availabilityDays} dia(s) con horarios publicados`
                : waitingTickets > 0
                  ? 'Revisa horarios para sostener la cola de hoy'
                  : 'Publica nuevos horarios cuando haga falta'
        ),
    ].join('');
}
