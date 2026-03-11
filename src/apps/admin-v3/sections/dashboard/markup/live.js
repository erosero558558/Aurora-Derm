import { formatDate } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function heroSummary({
    pendingCallbacks,
    pendingTransfers,
    urgentCallbacks,
    noShows,
    nextAppointment,
}) {
    if (pendingTransfers > 0) {
        return `Primero revisa ${pendingTransfers} pago(s) antes de confirmar mas citas.`;
    }
    if (urgentCallbacks > 0) {
        return `Hay ${urgentCallbacks} llamada(s) atrasada(s); conviene atenderlas primero.`;
    }
    if (pendingCallbacks > 0) {
        return `Tienes ${pendingCallbacks} seguimiento(s) pendiente(s) por llamar o confirmar.`;
    }
    if (noShows > 0) {
        return `Revisa ${noShows} no show para cerrar seguimiento del dia.`;
    }
    if (nextAppointment?.item) {
        return `La siguiente atencion es ${nextAppointment.item.name || 'sin nombre'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}.`;
    }
    return 'Empieza por agenda, pendientes y turnero sin mezclar herramientas avanzadas en el primer paso.';
}

export function buildLiveMeta({
    calledTickets,
    pendingTransfers,
    urgentCallbacks,
    nextAppointment,
    waitingTickets,
}) {
    if (pendingTransfers > 0) {
        return 'Hay pagos pendientes antes de cerrar la agenda.';
    }
    if (urgentCallbacks > 0) {
        return 'Hay seguimientos atrasados que requieren llamada inmediata.';
    }
    if (waitingTickets > 0 || calledTickets > 0) {
        return `${waitingTickets} paciente(s) en espera y ${calledTickets} llamado(s) en sala.`;
    }
    if (nextAppointment?.item) {
        return `Siguiente ingreso: ${nextAppointment.item.name || 'Paciente'} el ${formatDate(nextAppointment.item.date)} a las ${nextAppointment.item.time || '--:--'}.`;
    }
    return 'Sin frentes criticos en este momento.';
}
