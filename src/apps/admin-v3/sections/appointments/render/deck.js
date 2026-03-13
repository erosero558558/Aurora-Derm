import {
    escapeHtml,
    formatDate,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import {
    appointmentTimestamp,
    humanizeToken,
    paymentLabel,
    relativeWindow,
    statusLabel,
} from '../utils.js';

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
    if (status === 'attending') {
        return 'En atencion';
    }
    if (status === 'resolved') {
        return 'Resuelto';
    }
    return 'Pendiente';
}

function reviewStatusActionLabel(status, reason) {
    if (status === 'pending') {
        return reason === 'clinical_redirect'
            ? 'Derivar a doctor'
            : 'Marcar apoyo en atencion';
    }
    if (status === 'attending') {
        return reason === 'clinical_redirect'
            ? 'Cerrar derivacion'
            : 'Resolver apoyo';
    }
    return '';
}

function normalizeAvailabilitySlots(availabilityMap, dateKey) {
    if (!availabilityMap || typeof availabilityMap !== 'object') {
        return [];
    }
    const raw = availabilityMap[dateKey];
    return Array.isArray(raw)
        ? raw.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
}

function readReviewContextValue(reviewContext, ...keys) {
    if (!reviewContext || typeof reviewContext !== 'object') {
        return '';
    }

    for (const key of keys) {
        const value = reviewContext[key];
        if (value === undefined || value === null) {
            continue;
        }
        const normalized = String(value).trim();
        if (normalized !== '') {
            return normalized;
        }
    }

    return '';
}

function buildAvailabilityAssessment(
    availabilityMap,
    sourceItems,
    reviewContext,
    appointment
) {
    const requestedDate = String(reviewContext?.requestedDate || '').trim();
    const requestedTime = String(reviewContext?.requestedTime || '').trim();
    const daySlots = normalizeAvailabilitySlots(availabilityMap, requestedDate);
    const comparisonAppointmentId =
        Number(appointment?.id || reviewContext?.appointmentId || 0) || 0;
    const occupiedBy =
        requestedDate && requestedTime
            ? (Array.isArray(sourceItems) ? sourceItems : []).find((item) => {
                  const itemId = Number(item?.id || 0) || 0;
                  if (
                      comparisonAppointmentId > 0 &&
                      itemId === comparisonAppointmentId
                  ) {
                      return false;
                  }
                  return (
                      String(item?.date || '').trim() === requestedDate &&
                      String(item?.time || '').trim() === requestedTime
                  );
              }) || null
            : null;

    if (appointment) {
        return {
            kind: 'appointment_match',
            label: 'Cita vigente',
            tone: 'success',
            detail: 'La cita exacta ya existe en agenda y puede confirmarse desde recepcion.',
        };
    }

    if (!requestedDate) {
        return {
            kind: 'unknown',
            label: 'Sin fecha',
            tone: 'neutral',
            detail: 'No hay fecha operativa suficiente para validar la agenda.',
        };
    }

    if (occupiedBy) {
        return {
            kind: 'slot_taken',
            label: 'Horario ocupado',
            tone: 'warning',
            detail: `${requestedTime} ya aparece ocupado en agenda por ${
                String(occupiedBy.name || 'otro paciente').trim() ||
                'otro paciente'
            }.`,
        };
    }

    if (!daySlots.length) {
        return {
            kind: 'day_closed',
            label: 'Dia sin slots',
            tone: 'danger',
            detail: `${requestedDate} no tiene slots publicados en disponibilidad.`,
        };
    }

    if (!requestedTime) {
        return {
            kind: 'day_open',
            label: 'Dia con slots',
            tone: 'info',
            detail: `${requestedDate} tiene ${daySlots.length} slot(s) publicados para validar manualmente.`,
        };
    }

    if (daySlots.includes(requestedTime)) {
        return {
            kind: 'slot_published',
            label: 'Slot publicado',
            tone: 'info',
            detail: `${requestedTime} sigue publicado en disponibilidad, aunque no aparece una cita ligada.`,
        };
    }

    return {
        kind: 'slot_missing',
        label: 'Slot no publicado',
        tone: 'warning',
        detail: `${requestedTime} no aparece entre los ${daySlots.length} slot(s) publicados del dia.`,
    };
}

function reviewGuidance(reason, assessment, reviewContext) {
    const requestedDate = String(reviewContext?.requestedDate || '').trim();
    const requestedTime = String(reviewContext?.requestedTime || '').trim();
    const requestedSlot =
        requestedDate && requestedTime
            ? `${requestedDate} ${requestedTime}`
            : requestedDate || requestedTime;

    if (reason === 'appointment_not_found') {
        return {
            summary:
                assessment.kind === 'appointment_match'
                    ? 'La cita ya aparece en agenda; confirma datos y cierra el apoyo si corresponde.'
                    : assessment.kind === 'slot_published'
                      ? 'El slot sigue publicado, pero no hay una cita visible; confirma telefono y referencia antes de cerrar el apoyo.'
                      : assessment.kind === 'slot_taken'
                        ? 'El horario pedido ya está ocupado; evita prometer esa cita desde recepcion.'
                        : assessment.kind === 'slot_missing' ||
                            assessment.kind === 'day_closed'
                          ? 'La disponibilidad ya no respalda ese horario; mantén el apoyo abierto y corrige la expectativa del paciente.'
                          : 'Aun no hay coincidencia exacta; valida telefono, fecha y hora antes de cerrar el apoyo.',
            hint:
                assessment.kind === 'appointment_match'
                    ? 'Confirma datos con el paciente y vuelve a cola solo para cerrar o continuar el flujo.'
                    : assessment.kind === 'slot_published'
                      ? 'Si el paciente insiste, revisa disponibilidad y decide si corresponde check-in o manejo manual.'
                      : assessment.kind === 'slot_taken'
                        ? 'Deriva el ajuste de horario a recepcion; no lo resuelvas dentro del kiosco.'
                        : assessment.kind === 'slot_missing' ||
                            assessment.kind === 'day_closed'
                          ? 'Abre disponibilidad para explicar que el horario ya no está vigente.'
                          : 'Mantén el apoyo abierto hasta confirmar el hueco correcto en agenda.',
        };
    }

    if (reason === 'late_arrival') {
        return {
            summary: requestedSlot
                ? `Revisa si la ventana ${requestedSlot} sigue siendo viable antes de reencaminar al paciente.`
                : 'Confirma si la cita todavia entra en ventana o requiere manejo manual.',
            hint: 'Si mantienes la atencion, vuelve a cola con la llegada tarde visible.',
        };
    }

    if (reason === 'schedule_taken') {
        return {
            summary:
                assessment.kind === 'appointment_match'
                    ? 'Hay una cita exacta en agenda; confirma si ese horario sigue siendo el válido.'
                    : assessment.kind === 'slot_taken'
                      ? 'El horario ya está tomado en agenda; no prometas ese espacio desde recepcion.'
                      : assessment.kind === 'slot_published'
                        ? 'El horario sigue publicado; valida si el paciente debe pasar a agenda o a atención manual.'
                        : 'No confirmes reprogramacion desde kiosco; valida disponibilidad real en recepcion.',
            hint:
                assessment.kind === 'slot_taken' ||
                assessment.kind === 'slot_missing' ||
                assessment.kind === 'day_closed'
                    ? 'Si no hay cupo, vuelve a cola con conflicto horario claro y deriva el ajuste administrativo.'
                    : 'Si no hay cupo, deja el apoyo abierto y deriva el ajuste administrativo.',
        };
    }

    if (reason === 'special_priority') {
        return {
            summary:
                'La cola ya debe reflejar prioridad visible antes del siguiente llamado.',
            hint: 'Vuelve a cola para confirmar que la prioridad quede clara al operador.',
        };
    }

    if (reason === 'clinical_redirect') {
        return {
            summary:
                'No cierres como resuelto hasta dejar derivacion clinica clara y fuera del kiosco.',
            hint: 'La agenda ayuda a ubicar contexto, pero la derivacion sigue siendo clinica y presencial.',
        };
    }

    return {
        summary:
            assessment.kind === 'appointment_match'
                ? 'Usa la cita localizada para cerrar el apoyo o devolver al paciente al flujo correcto.'
                : 'Valida el contexto y decide si el apoyo debe seguir abierto.',
        hint: 'Cierra el apoyo solo cuando el siguiente paso del paciente quede claro.',
    };
}

function buildReviewResolution(reason, assessment, reviewContext, guidance) {
    const storedOutcome = readReviewContextValue(
        reviewContext,
        'resolutionOutcome'
    ).toLowerCase();
    const storedLabel = readReviewContextValue(
        reviewContext,
        'resolutionOutcomeLabel'
    );
    const storedNote = readReviewContextValue(reviewContext, 'resolutionNote');
    if (storedOutcome || storedLabel) {
        return {
            outcome: storedOutcome || 'general_resolution',
            label: storedLabel || 'Apoyo resuelto',
            note: storedNote || assessment.detail || guidance.summary,
        };
    }

    if (assessment.kind === 'appointment_match') {
        return {
            outcome: 'appointment_confirmed',
            label: 'Cita vigente confirmada',
            note: 'Recepcion confirmo que la cita exacta sigue vigente en agenda.',
        };
    }
    if (assessment.kind === 'slot_taken') {
        return {
            outcome: 'schedule_conflict',
            label: 'Conflicto horario confirmado',
            note: 'El horario solicitado ya estaba ocupado y recepcion lo confirmo en agenda.',
        };
    }
    if (assessment.kind === 'slot_missing') {
        return {
            outcome: 'slot_not_published',
            label: 'Horario ya no publicado',
            note: 'El horario solicitado ya no aparece publicado en disponibilidad.',
        };
    }
    if (assessment.kind === 'day_closed') {
        return {
            outcome: 'day_without_slots',
            label: 'Dia sin slots confirmado',
            note: 'Recepcion confirmo que el dia ya no tiene slots publicados.',
        };
    }
    if (assessment.kind === 'slot_published') {
        return {
            outcome: 'slot_published_without_appointment',
            label: 'Slot publicado sin cita',
            note: 'El horario sigue publicado, pero no hay una cita asociada visible.',
        };
    }

    if (reason === 'clinical_redirect') {
        return {
            outcome: 'clinical_redirect_confirmed',
            label: 'Derivacion clinica confirmada',
            note: 'Recepcion mantuvo la consulta en carril clinico presencial.',
        };
    }
    if (reason === 'special_priority') {
        return {
            outcome: 'priority_confirmed',
            label: 'Prioridad visible confirmada',
            note: 'La prioridad del paciente quedo confirmada desde recepcion.',
        };
    }
    if (reason === 'late_arrival') {
        return {
            outcome: 'late_arrival_reviewed',
            label: 'Llegada tarde revisada',
            note: 'Recepcion reviso el caso de llegada tarde y definio el siguiente paso.',
        };
    }

    return {
        outcome: 'general_resolution',
        label: 'Apoyo resuelto',
        note: guidance.summary,
    };
}

function findReviewAppointment(items, reviewContext) {
    const source = Array.isArray(items) ? items : [];
    const appointmentId = Number(reviewContext?.appointmentId || 0) || 0;
    const phoneLast4 = String(reviewContext?.phoneLast4 || '').trim();
    const requestedDate = String(reviewContext?.requestedDate || '').trim();
    const requestedTime = String(reviewContext?.requestedTime || '').trim();

    if (appointmentId > 0) {
        const exact = source.find(
            (item) => Number(item?.id || 0) === appointmentId
        );
        if (exact) {
            return exact;
        }
    }

    return (
        source.find((item) => {
            const phone = String(item?.phone || '').replace(/\D/g, '');
            const matchesPhone =
                phoneLast4 === '' || phone.endsWith(phoneLast4);
            const matchesDate =
                requestedDate === '' ||
                String(item?.date || '') === requestedDate;
            const matchesTime =
                requestedTime === '' ||
                String(item?.time || '') === requestedTime;
            return matchesPhone && matchesDate && matchesTime;
        }) || null
    );
}

function buildReviewTags(reviewContext, appointment) {
    const tags = [];
    const reasonLabel = String(reviewContext?.reasonLabel || '').trim();
    const ticketCode = String(reviewContext?.ticketCode || '').trim();
    const phoneLast4 = String(reviewContext?.phoneLast4 || '').trim();

    if (reasonLabel) {
        tags.push(reasonLabel);
    }
    if (ticketCode) {
        tags.push(ticketCode);
    }
    if (phoneLast4) {
        tags.push(`tel. *${phoneLast4.slice(-4)}`);
    }
    if (appointment) {
        tags.push('Cita localizada');
    }
    if (reviewContext?.specialPriority) {
        tags.push('Prioridad visible');
    }
    if (reviewContext?.lateArrival) {
        tags.push('Llegada tarde');
    }

    return tags;
}

function buildQueueReview(sourceItems, reviewContext, availabilityMap = {}) {
    if (!reviewContext || typeof reviewContext !== 'object') {
        return null;
    }

    const status = normalizeReviewStatus(reviewContext.helpRequestStatus);
    const reason = String(reviewContext.reason || 'general')
        .trim()
        .toLowerCase();
    const appointment = findReviewAppointment(sourceItems, reviewContext);
    const availabilityAssessment = buildAvailabilityAssessment(
        availabilityMap,
        sourceItems,
        reviewContext,
        appointment
    );
    const guidance = reviewGuidance(
        reason,
        availabilityAssessment,
        reviewContext
    );
    const resolution = buildReviewResolution(
        reason,
        availabilityAssessment,
        reviewContext,
        guidance
    );
    const statusActionLabel = reviewStatusActionLabel(status, reason);
    const nextStatus =
        status === 'pending'
            ? 'attending'
            : status === 'attending'
              ? 'resolved'
              : '';
    const tags = buildReviewTags(reviewContext, appointment);
    const contextParts = [];

    if (reviewContext.phoneLast4) {
        contextParts.push(
            `tel. *${String(reviewContext.phoneLast4).slice(-4)}`
        );
    }
    if (reviewContext.requestedDate) {
        contextParts.push(String(reviewContext.requestedDate));
    }
    if (reviewContext.requestedTime) {
        contextParts.push(String(reviewContext.requestedTime));
    }
    if (appointment) {
        contextParts.push(
            `cita #${Number(appointment.id || 0)} · ${String(
                appointment.name || 'Sin nombre'
            )}`
        );
    } else if (Number(reviewContext.appointmentId || 0) > 0) {
        contextParts.push(`cita #${Number(reviewContext.appointmentId || 0)}`);
    }

    return {
        title:
            status === 'resolved'
                ? 'Contexto resuelto desde sala'
                : 'Revision desde sala',
        status,
        statusLabel: reviewStatusLabel(status),
        availabilityAssessment,
        summary: `${String(reviewContext.reasonLabel || 'Apoyo operativo').trim()} · ${
            String(reviewContext.ticketCode || '--').trim() || '--'
        }`,
        detail: appointment
            ? `Cita localizada: ${escapeHtml(String(appointment.name || 'Sin nombre'))} · ${escapeHtml(formatDate(appointment.date))} ${escapeHtml(String(appointment.time || '--:--'))}`
            : escapeHtml(guidance.summary),
        note: guidance.summary,
        hint: guidance.hint,
        tags,
        contextLine: contextParts.join(' · '),
        ticketId: Number(reviewContext.ticketId || 0) || 0,
        ticketCode: String(reviewContext.ticketCode || '').trim(),
        helpRequestId: Number(reviewContext.helpRequestId || 0) || 0,
        nextStatus,
        statusActionLabel,
        resolution,
        confirmAppointmentLabel:
            availabilityAssessment.kind === 'appointment_match' &&
            status !== 'resolved'
                ? 'Confirmar cita vigente'
                : '',
        requestedDate: String(reviewContext.requestedDate || '').trim(),
        requestedTime: String(reviewContext.requestedTime || '').trim(),
        focus: appointment
            ? {
                  item: appointment,
                  label:
                      status === 'resolved'
                          ? 'Contexto resuelto'
                          : 'Revision desde sala',
                  hint: guidance.hint,
                  tags,
              }
            : null,
        queueActionLabel:
            availabilityAssessment.kind === 'slot_taken' ||
            availabilityAssessment.kind === 'slot_missing' ||
            availabilityAssessment.kind === 'day_closed'
                ? 'Volver a cola con conflicto horario'
                : availabilityAssessment.kind === 'appointment_match'
                  ? 'Volver a cola con cita vigente'
                  : reviewContext.specialPriority
                    ? 'Volver a cola prioritaria'
                    : reviewContext.lateArrival
                      ? 'Volver a cola por llegada tarde'
                      : 'Volver a cola',
    };
}

function renderQueueReview(review) {
    const container = document.getElementById('appointmentsQueueReview');
    if (!(container instanceof HTMLElement)) {
        return;
    }

    if (!review) {
        container.classList.add('is-hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('is-hidden');
    const actionButtons = [];

    if (review.confirmAppointmentLabel) {
        actionButtons.push(
            `<button type="button" data-action="appointment-review-confirm-appointment" data-review-help-request-id="${escapeHtml(review.helpRequestId)}" data-review-ticket-id="${escapeHtml(review.ticketId)}" data-review-assessment-kind="${escapeHtml(review.availabilityAssessment.kind)}" data-review-assessment-label="${escapeHtml(review.availabilityAssessment.label)}" data-review-assessment-detail="${escapeHtml(review.availabilityAssessment.detail)}" data-review-resolution-outcome="${escapeHtml(review.resolution.outcome)}" data-review-resolution-label="${escapeHtml(review.resolution.label)}" data-review-resolution-note="${escapeHtml(review.resolution.note)}">${escapeHtml(review.confirmAppointmentLabel)}</button>`
        );
    }

    if (review.statusActionLabel && review.nextStatus) {
        actionButtons.push(
            `<button type="button" data-action="appointment-review-help-request-status" data-review-help-request-id="${escapeHtml(review.helpRequestId)}" data-review-ticket-id="${escapeHtml(review.ticketId)}" data-review-help-request-status="${escapeHtml(review.nextStatus)}" data-review-reason="${escapeHtml(review.status)}" data-review-assessment-kind="${escapeHtml(review.availabilityAssessment.kind)}" data-review-assessment-label="${escapeHtml(review.availabilityAssessment.label)}" data-review-assessment-detail="${escapeHtml(review.availabilityAssessment.detail)}"${review.nextStatus === 'resolved' ? ` data-review-resolution-outcome="${escapeHtml(review.resolution.outcome)}" data-review-resolution-label="${escapeHtml(review.resolution.label)}" data-review-resolution-note="${escapeHtml(review.resolution.note)}"` : ''}>${escapeHtml(review.statusActionLabel)}</button>`
        );
    }

    if (review.requestedDate) {
        actionButtons.push(
            `<button type="button" data-action="appointment-review-open-availability" data-review-requested-date="${escapeHtml(review.requestedDate)}" data-review-requested-time="${escapeHtml(review.requestedTime)}">${escapeHtml(
                review.availabilityAssessment.kind === 'appointment_match'
                    ? 'Ver disponibilidad del dia'
                    : 'Revisar disponibilidad'
            )}</button>`
        );
    }

    if (review.ticketId > 0 || review.ticketCode) {
        actionButtons.push(
            `<button type="button" data-action="appointment-review-open-queue" data-review-ticket-id="${escapeHtml(review.ticketId)}" data-review-ticket-code="${escapeHtml(review.ticketCode)}">${escapeHtml(review.queueActionLabel)}</button>`
        );
    }

    actionButtons.push(
        '<button type="button" data-action="appointment-review-clear-context">Cerrar contexto</button>'
    );

    container.innerHTML = `
        <section class="appointments-review-context__card" data-state="${escapeHtml(review.status)}">
            <div class="appointments-review-context__head">
                <div>
                    <p class="sony-kicker">${escapeHtml(review.title)}</p>
                    <strong>${escapeHtml(review.summary)}</strong>
                    <small>${review.detail}</small>
                </div>
                <span class="appointments-review-context__pill" data-state="${escapeHtml(review.status)}">${escapeHtml(review.statusLabel)}</span>
            </div>
            <div class="appointments-review-context__assessment" data-tone="${escapeHtml(review.availabilityAssessment.tone)}">
                <strong>${escapeHtml(review.availabilityAssessment.label)}</strong>
                <small>${escapeHtml(review.availabilityAssessment.detail)}</small>
            </div>
            <p class="appointments-review-context__hint">${escapeHtml(review.hint)}</p>
            ${
                review.status === 'resolved' && review.resolution?.label
                    ? `<p class="appointments-review-context__meta"><strong>Resolucion:</strong> ${escapeHtml(review.resolution.label)}${review.resolution.note ? ` · ${escapeHtml(review.resolution.note)}` : ''}</p>`
                    : ''
            }
            ${
                review.contextLine
                    ? `<p class="appointments-review-context__meta"><strong>Contexto:</strong> ${escapeHtml(review.contextLine)}</p>`
                    : ''
            }
            ${
                review.tags.length
                    ? `<div class="appointments-review-context__tags">${review.tags
                          .map(
                              (tag) =>
                                  `<span class="appointments-focus-tag">${escapeHtml(tag)}</span>`
                          )
                          .join('')}</div>`
                    : ''
            }
            <div class="appointments-review-context__actions">${actionButtons.join('')}</div>
        </section>
    `;
}

export function renderOpsDeck(
    ops,
    visibleCount,
    totalCount,
    sourceItems = [],
    availabilityMap = {},
    reviewContext = null
) {
    const queueReview = buildQueueReview(
        sourceItems,
        reviewContext,
        availabilityMap
    );
    setText('#appointmentsOpsPendingTransfer', ops.pendingTransferCount);
    setText(
        '#appointmentsOpsPendingTransferMeta',
        ops.pendingTransferCount > 0
            ? `${ops.pendingTransferCount} pago(s) detenidos`
            : 'Nada por validar'
    );
    setText('#appointmentsOpsUpcomingCount', ops.upcomingCount);
    setText(
        '#appointmentsOpsUpcomingMeta',
        ops.upcomingCount > 0
            ? `${ops.upcomingCount} cita(s) dentro de 48h`
            : 'Sin presion inmediata'
    );
    setText('#appointmentsOpsNoShowCount', ops.noShowCount);
    setText(
        '#appointmentsOpsNoShowMeta',
        ops.noShowCount > 0
            ? `${ops.noShowCount} caso(s) con seguimiento`
            : 'Sin incidencias'
    );
    setText('#appointmentsOpsTodayCount', ops.todayCount);
    setText(
        '#appointmentsOpsTodayMeta',
        ops.todayCount > 0
            ? `${ops.todayCount} cita(s) en agenda de hoy`
            : 'Carga diaria limpia'
    );

    const summary =
        totalCount > 0
            ? `${ops.pendingTransferCount} transferencia(s), ${ops.triageCount} frente(s) accionables y ${visibleCount} cita(s) visibles.`
            : 'Sin citas cargadas.';
    setText('#appointmentsDeckSummary', summary);
    setText(
        '#appointmentsWorkbenchHint',
        ops.pendingTransferCount > 0
            ? 'Primero valida pagos; luego ordena la mesa por fecha o paciente.'
            : ops.triageCount > 0
              ? 'La agenda tiene incidencias abiertas dentro de esta misma mesa.'
              : 'Filtros, orden y tabla en un workbench unico.'
    );

    const chip = document.getElementById('appointmentsDeckChip');
    if (chip) {
        const state =
            ops.pendingTransferCount > 0 || ops.noShowCount > 0
                ? 'warning'
                : 'success';
        chip.textContent =
            state === 'warning' ? 'Atencion operativa' : 'Agenda estable';
        chip.setAttribute('data-state', state);
    }

    const focus = queueReview?.focus || ops.focus;
    setText('#appointmentsFocusLabel', focus.label);

    if (!focus.item) {
        setText('#appointmentsFocusPatient', 'Sin citas activas');
        setText(
            '#appointmentsFocusMeta',
            'Cuando entren citas accionables apareceran aqui.'
        );
        setText('#appointmentsFocusWindow', '-');
        setText('#appointmentsFocusPayment', '-');
        setText('#appointmentsFocusStatus', '-');
        setText('#appointmentsFocusContact', '-');
        setHtml('#appointmentsFocusTags', '');
        setText('#appointmentsFocusHint', focus.hint);
        renderQueueReview(queueReview);
        return;
    }

    const item = focus.item;
    setText('#appointmentsFocusPatient', item.name || 'Sin nombre');
    setText(
        '#appointmentsFocusMeta',
        `${humanizeToken(item.service, 'Servicio pendiente')} | ${formatDate(item.date)} ${item.time || '--:--'}`
    );
    setText(
        '#appointmentsFocusWindow',
        relativeWindow(appointmentTimestamp(item))
    );
    setText(
        '#appointmentsFocusPayment',
        paymentLabel(item.paymentStatus || item.payment_status)
    );
    setText('#appointmentsFocusStatus', statusLabel(item.status));
    setText('#appointmentsFocusContact', item.phone || 'Sin telefono');
    setHtml(
        '#appointmentsFocusTags',
        focus.tags
            .map(
                (tag) =>
                    `<span class="appointments-focus-tag">${escapeHtml(tag)}</span>`
            )
            .join('')
    );
    setText('#appointmentsFocusHint', focus.hint);
    renderQueueReview(queueReview);
}
