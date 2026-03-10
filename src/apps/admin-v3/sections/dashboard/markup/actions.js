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
    const { pendingTransfers, urgentCallbacks, pendingCallbacks } = state;
    const { appointments, nextAppointment } = state;

    return [
        actionItem(
            'context-open-appointments-transfer',
            pendingTransfers > 0
                ? 'Validar transferencias'
                : 'Abrir agenda clinica',
            pendingTransfers > 0
                ? `${pendingTransfers} comprobante(s) por revisar`
                : `${appointments.length} cita(s) en el corte`
        ),
        actionItem(
            'context-open-callbacks-pending',
            urgentCallbacks > 0
                ? 'Resolver callbacks urgentes'
                : 'Abrir callbacks',
            urgentCallbacks > 0
                ? `${urgentCallbacks} caso(s) fuera de SLA`
                : `${pendingCallbacks} callback(s) pendientes`
        ),
        actionItem(
            'refresh-admin-data',
            'Actualizar tablero',
            nextAppointment?.item
                ? `Proxima cita ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                : 'Sincronizar agenda y funnel'
        ),
    ].join('');
}
