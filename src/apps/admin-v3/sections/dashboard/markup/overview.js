import { CALLBACK_URGENT_THRESHOLD_MINUTES } from '../constants.js';
import { attentionItem } from './attention.js';

export function buildAttentionItems(state) {
    const {
        availabilityDays,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    return [
        attentionItem(
            'Transferencias',
            pendingTransfers,
            pendingTransfers > 0
                ? 'Pago detenido antes de confirmar.'
                : 'Sin comprobantes pendientes.',
            pendingTransfers > 0 ? 'warning' : 'success'
        ),
        attentionItem(
            'Callbacks urgentes',
            urgentCallbacks,
            urgentCallbacks > 0
                ? `Mas de ${CALLBACK_URGENT_THRESHOLD_MINUTES} min en espera.`
                : 'SLA dentro de rango.',
            urgentCallbacks > 0 ? 'danger' : 'success'
        ),
        attentionItem(
            'Agenda de hoy',
            todayAppointments,
            todayAppointments > 0
                ? `${todayAppointments} ingreso(s) en la jornada.`
                : 'No hay citas hoy.',
            todayAppointments > 6 ? 'warning' : 'neutral'
        ),
        attentionItem(
            'Disponibilidad',
            availabilityDays,
            availabilityDays > 0
                ? 'Dias con slots listos para publicar.'
                : 'Sin slots cargados en el calendario.',
            availabilityDays > 0 ? 'success' : 'warning'
        ),
    ].join('');
}
