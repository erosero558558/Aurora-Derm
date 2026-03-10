import { formatDate } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function heroSummary({
    pendingTransfers,
    urgentCallbacks,
    noShows,
    nextAppointment,
}) {
    if (pendingTransfers > 0) {
        return `Primero valida ${pendingTransfers} transferencia(s) antes de liberar mas agenda.`;
    }
    if (urgentCallbacks > 0) {
        return `Hay ${urgentCallbacks} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`;
    }
    if (noShows > 0) {
        return `Revisa ${noShows} no show del corte actual para cerrar seguimiento.`;
    }
    if (nextAppointment?.item) {
        return `La siguiente cita es ${nextAppointment.item.name || 'sin nombre'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}.`;
    }
    return 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
}

export function buildLiveMeta({
    pendingTransfers,
    urgentCallbacks,
    nextAppointment,
}) {
    if (pendingTransfers > 0) {
        return 'Transferencias detenidas hasta validar comprobante.';
    }
    if (urgentCallbacks > 0) {
        return 'Callbacks fuera de SLA requieren llamada inmediata.';
    }
    if (nextAppointment?.item) {
        return `Siguiente ingreso: ${nextAppointment.item.name || 'Paciente'} el ${formatDate(nextAppointment.item.date)} a las ${nextAppointment.item.time || '--:--'}.`;
    }
    return 'Sin alertas criticas en la operacion actual.';
}
