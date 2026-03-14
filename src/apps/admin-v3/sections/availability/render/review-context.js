import { getState } from '../../../shared/core/store.js';
import { escapeHtml, setHtml } from '../../../shared/ui/render.js';

function normalizeReviewStatus(status) {
    const normalized = String(status || 'pending')
        .trim()
        .toLowerCase();
    if (normalized === 'attending') {
        return 'attending';
    }
    if (normalized === 'resolved') {
        return 'resolved';
    }
    return 'pending';
}

function reviewStatusLabel(status) {
    const normalized = normalizeReviewStatus(status);
    if (normalized === 'attending') {
        return 'En atencion';
    }
    if (normalized === 'resolved') {
        return 'Resuelto';
    }
    return 'Pendiente';
}

function reviewAssessmentTone(kind) {
    switch (
        String(kind || '')
            .trim()
            .toLowerCase()
    ) {
        case 'appointment_match':
            return 'success';
        case 'slot_published':
        case 'day_open':
            return 'info';
        case 'slot_taken':
        case 'slot_missing':
            return 'warning';
        case 'day_closed':
            return 'danger';
        default:
            return 'info';
    }
}

function queueActionLabel(reviewContext) {
    const assessmentKind = String(reviewContext?.reviewAssessmentKind || '')
        .trim()
        .toLowerCase();

    if (['slot_taken', 'slot_missing', 'day_closed'].includes(assessmentKind)) {
        return 'Volver a cola con conflicto horario';
    }
    if (assessmentKind === 'appointment_match') {
        return 'Volver a cola con cita vigente';
    }
    if (reviewContext?.specialPriority) {
        return 'Volver a cola prioritaria';
    }
    if (reviewContext?.lateArrival) {
        return 'Volver a cola por llegada tarde';
    }
    return 'Volver a cola';
}

function buildContextLine(reviewContext) {
    const parts = [];
    const ticketCode = String(reviewContext?.ticketCode || '').trim();
    const reasonLabel = String(reviewContext?.reasonLabel || '').trim();
    const phoneLast4 = String(reviewContext?.phoneLast4 || '').trim();
    const requestedDate = String(reviewContext?.requestedDate || '').trim();
    const requestedTime = String(reviewContext?.requestedTime || '').trim();

    if (ticketCode) {
        parts.push(ticketCode);
    }
    if (reasonLabel) {
        parts.push(reasonLabel);
    }
    if (phoneLast4) {
        parts.push(`tel. *${phoneLast4.slice(-4)}`);
    }
    if (requestedDate) {
        parts.push(requestedDate);
    }
    if (requestedTime) {
        parts.push(requestedTime);
    }

    return parts.join(' · ');
}

function buildActions(reviewContext) {
    const ticketId = Number(reviewContext?.ticketId || 0) || 0;
    const ticketCode = String(reviewContext?.ticketCode || '').trim();
    if (ticketId <= 0 && !ticketCode) {
        return '';
    }

    return `
        <div class="appointments-review-context__actions">
            <button type="button" data-action="availability-open-appointments-review">Volver a agenda</button>
            <button type="button" data-action="appointment-review-clear-context">Cerrar contexto</button>
        </div>
    `;
}

export function renderAvailabilityReviewContext() {
    const container = document.getElementById('availabilityReviewContext');
    if (!(container instanceof HTMLElement)) {
        return;
    }

    const reviewContext = getState()?.appointments?.reviewContext;
    if (!reviewContext || typeof reviewContext !== 'object') {
        container.classList.add('is-hidden');
        setHtml('#availabilityReviewContext', '');
        return;
    }

    const status = normalizeReviewStatus(reviewContext.helpRequestStatus);
    const contextLine = buildContextLine(reviewContext);
    const assessmentLabel = String(
        reviewContext.reviewAssessmentLabel || 'Revision operativa en curso'
    ).trim();
    const assessmentDetail = String(
        reviewContext.reviewAssessmentDetail ||
            'Disponibilidad abierta desde sala para validar el siguiente paso del paciente.'
    ).trim();

    container.classList.remove('is-hidden');
    setHtml(
        '#availabilityReviewContext',
        `
            <section class="appointments-review-context__card availability-review-context__card" data-state="${escapeHtml(
                status
            )}">
                <div class="appointments-review-context__head">
                    <div>
                        <p class="sony-kicker">Disponibilidad abierta desde sala</p>
                        <strong>${escapeHtml(
                            String(
                                reviewContext.reasonLabel || 'Apoyo operativo'
                            )
                        )}</strong>
                        <small>${escapeHtml(
                            contextLine ||
                                'Revisa disponibilidad y vuelve a cola con una salida operativa clara.'
                        )}</small>
                    </div>
                    <span class="appointments-review-context__pill" data-state="${escapeHtml(
                        status
                    )}">${escapeHtml(reviewStatusLabel(status))}</span>
                </div>
                <div class="appointments-review-context__assessment" data-tone="${escapeHtml(
                    reviewAssessmentTone(reviewContext.reviewAssessmentKind)
                )}">
                    <strong>${escapeHtml(assessmentLabel)}</strong>
                    <small>${escapeHtml(assessmentDetail)}</small>
                </div>
                <p class="appointments-review-context__hint">Usa esta vista para comprobar el dia real publicado y regresar a cola sin perder el contexto de recepcion.</p>
                ${buildActions(reviewContext)}
            </section>
        `
    );
}
