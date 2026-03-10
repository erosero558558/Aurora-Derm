import { setText } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function setFlowMetrics(state) {
    const {
        availabilityDays,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    setText(
        '#dashboardQueueHealth',
        urgentCallbacks > 0
            ? 'Cola: SLA comprometido'
            : pendingCallbacks > 0
              ? 'Cola: pendiente por drenar'
              : 'Cola: estable'
    );
    setText(
        '#dashboardFlowStatus',
        nextAppointment?.item
            ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
            : availabilityDays > 0
              ? `${availabilityDays} dia(s) con slots publicados`
              : 'Sin citas inmediatas'
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'La prioridad ya esta definida'
            : nextAppointment?.item
              ? 'Siguiente accion lista'
              : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        nextAppointment?.item
            ? `Siguiente hito: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
            : 'Sin citas inmediatas en cola'
    );
}
