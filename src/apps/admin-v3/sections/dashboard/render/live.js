import { setText } from '../../../shared/ui/render.js';
import { buildLiveMeta } from '../markup.js';

export function setLiveStatus(state) {
    const {
        calledTickets,
        internalConsoleMeta,
        nextAppointment,
        pendingTransfers,
        pendingTasks,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    } = state;
    const readinessBlocked = Boolean(
        internalConsoleMeta?.overall?.ready === false
    );

    const liveStatus = readinessBlocked
        ? 'Bloqueado'
        : pendingTransfers > 0 || urgentCallbacks > 0
          ? 'Atencion'
          : waitingTickets > 0 || calledTickets > 0 || todayAppointments > 0
            ? 'Activo'
            : 'Estable';
    const liveTone = readinessBlocked
        ? 'danger'
        : pendingTransfers > 0 || urgentCallbacks > 0
          ? 'warning'
          : waitingTickets > 0 || calledTickets > 0 || todayAppointments > 0
            ? 'neutral'
            : 'success';

    setText('#dashboardLiveStatus', liveStatus);
    document
        .getElementById('dashboardLiveStatus')
        ?.setAttribute('data-state', liveTone);
    setText(
        '#dashboardLiveMeta',
        readinessBlocked
            ? String(internalConsoleMeta?.overall?.summary || '').trim() ||
                  'El piloto interno sigue bloqueado por readiness.'
            : buildLiveMeta({
                  calledTickets,
                  pendingTransfers,
                  urgentCallbacks,
                  nextAppointment,
                  waitingTickets,
              })
    );
    setText(
        '#operationRefreshSignal',
        readinessBlocked
            ? 'Resuelve auth OpenClaw y cifrado clinico antes de uso real'
            : pendingTasks > 0
              ? 'Tareas claras para recepcion/admin'
              : 'Operacion simple y sin frentes urgentes'
    );
}
