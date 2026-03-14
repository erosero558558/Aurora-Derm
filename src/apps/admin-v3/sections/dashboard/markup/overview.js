import { CALLBACK_URGENT_THRESHOLD_MINUTES } from '../constants.js';
import { attentionItem } from './attention.js';

function normalizeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function buildAttentionItems(state) {
    const {
        availabilityDays,
        internalConsoleMeta,
        pendingTransfers,
        patientFlowMeta,
        telemedicineMeta,
        todayAppointments,
        urgentCallbacks,
    } = state;
    const clinicalReady = internalConsoleMeta?.clinicalData?.ready !== false;
    const telemedicineReviewQueueCount = normalizeNumber(
        telemedicineMeta?.summary?.reviewQueueCount
    );
    const patientCasesTotal = normalizeNumber(patientFlowMeta?.casesTotal);
    const patientCasesOpen = normalizeNumber(patientFlowMeta?.casesOpen);
    const patientPendingApprovals = normalizeNumber(
        patientFlowMeta?.pendingApprovals
    );
    const patientActiveHelpRequests = normalizeNumber(
        patientFlowMeta?.activeHelpRequests
    );

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
        attentionItem(
            'Telemedicina',
            telemedicineReviewQueueCount,
            !clinicalReady
                ? 'Pausada por gate clinico hasta storage cifrado.'
                : telemedicineReviewQueueCount > 0
                  ? 'Intakes pendientes de decision clinica.'
                  : 'Sin intakes pendientes de revision.',
            !clinicalReady || telemedicineReviewQueueCount > 0
                ? 'warning'
                : 'success'
        ),
        attentionItem(
            'Casos activos',
            patientCasesOpen,
            patientPendingApprovals > 0
                ? `${patientCasesTotal} caso(s) totales • ${patientPendingApprovals} aprobacion(es) pendiente(s).`
                : patientActiveHelpRequests > 0
                  ? `${patientCasesTotal} caso(s) totales • ${patientActiveHelpRequests} apoyo(s) activo(s) en sala.`
                  : patientCasesTotal > 0
                    ? `${patientCasesTotal} caso(s) trazados del booking al consultorio.`
                    : 'Sin flujo clinico activo en este momento.',
            patientPendingApprovals > 0 || patientActiveHelpRequests > 0
                ? 'warning'
                : patientCasesOpen > 0
                  ? 'neutral'
                  : 'success'
        ),
    ].join('');
}
