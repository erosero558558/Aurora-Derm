import { setText } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function setFlowMetrics(state) {
    const {
        availabilityDays,
        calledTickets,
        internalConsoleMeta,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        patientFlowMeta,
        telemedicineMeta,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    } = state;
    const readinessSummary =
        String(internalConsoleMeta?.overall?.summary || '').trim() ||
        'Piloto interno de consultorio en revision.';
    const readinessBlocked = Boolean(
        internalConsoleMeta?.overall?.ready === false
    );
    const blockerTitles = Array.isArray(internalConsoleMeta?.overall?.blockers)
        ? internalConsoleMeta.overall.blockers
              .map((item) => String(item?.title || '').trim())
              .filter(Boolean)
        : [];
    const blockedClinicalSignals = [];
    const telemedicineReviewQueueCount = Number(
        telemedicineMeta?.summary?.reviewQueueCount || 0
    );
    const patientCasesOpen = Number(patientFlowMeta?.casesOpen || 0);
    if (telemedicineReviewQueueCount > 0) {
        blockedClinicalSignals.push(
            `${telemedicineReviewQueueCount} intake(s) telemedicina`
        );
    }
    if (patientCasesOpen > 0) {
        blockedClinicalSignals.push(`${patientCasesOpen} caso(s) activos`);
    }

    setText(
        '#dashboardQueueHealth',
        readinessBlocked
            ? blockerTitles[0] || 'Piloto interno bloqueado'
            : waitingTickets > 0 || calledTickets > 0
              ? 'Turnero activo en una app separada'
              : 'Nucleo interno listo para consultorio'
    );
    setText(
        '#dashboardFlowStatus',
        readinessBlocked
            ? blockedClinicalSignals.length > 0
                ? `${readinessSummary} | ${blockedClinicalSignals.join(' | ')}`
                : readinessSummary
            : nextAppointment?.item
              ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
              : availabilityDays > 0
                ? `${availabilityDays} dia(s) con horarios publicados`
                : readinessSummary
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0 || pendingCallbacks > 0
            ? 'Estas son las acciones utiles del dia'
            : nextAppointment?.item
              ? 'La siguiente accion ya esta clara'
              : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        readinessBlocked
            ? readinessSummary
            : pendingTransfers > 0
              ? `${pendingTransfers} pago(s) requieren revision antes de cerrar el dia`
              : nextAppointment?.item
                ? `Siguiente paciente: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                : 'Sin citas inmediatas en cola'
    );
}
