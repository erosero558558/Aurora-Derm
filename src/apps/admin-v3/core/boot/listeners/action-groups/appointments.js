import { createToast } from '../../../../shared/ui/render.js';
import {
    approveTransfer,
    cancelAppointment,
    clearAppointmentReviewContext,
    clearAppointmentFilters,
    exportAppointmentsCsv,
    markNoShow,
    rejectTransfer,
    setAppointmentDensity,
    setAppointmentFilter,
    updateAppointmentReviewContext,
} from '../../../../sections/appointments.js';
import { selectAvailabilityDate } from '../../../../sections/availability.js';
import {
    clearQueueSearch,
    setQueueFilter,
    updateQueueHelpRequestStatus,
} from '../../../../shared/modules/queue.js';
import { navigateToSection } from '../../navigation.js';

function readReviewDatasetValue(element, ...keys) {
    const source = element?.dataset || {};
    for (const key of keys) {
        const value = source[key];
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

function buildReviewContextPatch(element, nextStatus = '') {
    const patch = {
        reviewSource: 'appointments',
        reviewAssessmentKind: readReviewDatasetValue(
            element,
            'reviewAssessmentKind'
        ),
        reviewAssessmentLabel: readReviewDatasetValue(
            element,
            'reviewAssessmentLabel'
        ),
        reviewAssessmentDetail: readReviewDatasetValue(
            element,
            'reviewAssessmentDetail'
        ),
    };

    if (
        String(nextStatus || '')
            .trim()
            .toLowerCase() === 'resolved'
    ) {
        patch.resolutionSource = 'appointments';
        patch.resolutionOutcome = readReviewDatasetValue(
            element,
            'reviewResolutionOutcome'
        );
        patch.resolutionOutcomeLabel = readReviewDatasetValue(
            element,
            'reviewResolutionLabel'
        );
        patch.resolutionNote = readReviewDatasetValue(
            element,
            'reviewResolutionNote'
        );
    }

    return Object.fromEntries(
        Object.entries(patch).filter(([, value]) => String(value || '').trim())
    );
}

function focusQueueTicketRow(ticketId, ticketCode = '') {
    const targetId = Number(ticketId || 0) || 0;
    const targetCode = String(ticketCode || '').trim();
    const selector =
        targetId > 0
            ? `#queueTableBody tr[data-queue-id="${targetId}"]`
            : '#queueTableBody tr';
    const rows = Array.from(document.querySelectorAll(selector));
    const row =
        rows.find((candidate) => {
            if (!(candidate instanceof HTMLElement)) {
                return false;
            }
            if (targetId > 0) {
                return true;
            }
            return (
                targetCode !== '' &&
                String(candidate.textContent || '').includes(targetCode)
            );
        }) || null;

    if (!(row instanceof HTMLElement)) {
        return;
    }

    row.classList.add('queue-row-focus');
    row.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
    });
    window.setTimeout(() => {
        row.classList.remove('queue-row-focus');
    }, 1800);
}

function focusAvailabilityContext(requestedDate = '', requestedTime = '') {
    const dateKey = String(requestedDate || '').trim();
    const time = String(requestedTime || '').trim();
    let attempts = 0;

    const applyFocus = () => {
        attempts += 1;

        const day = document.querySelector(
            `#availabilityCalendar [data-action="select-availability-day"][data-date="${dateKey}"]`
        );
        if (day instanceof HTMLElement) {
            day.classList.add('availability-day-focus');
            day.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            });
            window.setTimeout(() => {
                day.classList.remove('availability-day-focus');
            }, 1800);
        }

        const slotMatch = Array.from(
            document.querySelectorAll('#timeSlotsList .time-slot-item')
        ).find((item) => {
            const label = item.querySelector('strong');
            return String(label?.textContent || '').trim() === time;
        });

        if (slotMatch instanceof HTMLElement) {
            slotMatch.classList.add('availability-slot-focus');
            slotMatch.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            });
            window.setTimeout(() => {
                slotMatch.classList.remove('availability-slot-focus');
            }, 1800);
            return;
        }

        if (attempts < 8) {
            window.requestAnimationFrame(applyFocus);
            return;
        }

        const selectedDate = document.getElementById('selectedDate');
        if (selectedDate instanceof HTMLElement) {
            selectedDate.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            });
        }
    };

    window.requestAnimationFrame(applyFocus);
}

export async function handleAppointmentAction(action, element) {
    switch (action) {
        case 'appointment-quick-filter':
            setAppointmentFilter(String(element.dataset.filterValue || 'all'));
            return true;
        case 'clear-appointment-filters':
            clearAppointmentFilters();
            return true;
        case 'appointment-density':
            setAppointmentDensity(
                String(element.dataset.density || 'comfortable')
            );
            return true;
        case 'approve-transfer':
            await approveTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia aprobada', 'success');
            return true;
        case 'reject-transfer':
            await rejectTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia rechazada', 'warning');
            return true;
        case 'mark-no-show':
            await markNoShow(Number(element.dataset.id || 0));
            createToast('Marcado como no show', 'warning');
            return true;
        case 'cancel-appointment':
            await cancelAppointment(Number(element.dataset.id || 0));
            createToast('Cita cancelada', 'warning');
            return true;
        case 'export-csv':
            exportAppointmentsCsv();
            return true;
        case 'appointment-review-help-request-status': {
            const nextStatus = String(
                element.dataset.reviewHelpRequestStatus || ''
            ).trim();
            const contextPatch = buildReviewContextPatch(element, nextStatus);
            await updateQueueHelpRequestStatus({
                helpRequestId:
                    Number(element.dataset.reviewHelpRequestId || 0) || 0,
                ticketId: Number(element.dataset.reviewTicketId || 0) || 0,
                status: nextStatus,
                context: contextPatch,
            });
            updateAppointmentReviewContext({
                helpRequestStatus: nextStatus,
                reviewAssessmentKind: contextPatch.reviewAssessmentKind || '',
                reviewAssessmentLabel: contextPatch.reviewAssessmentLabel || '',
                reviewAssessmentDetail:
                    contextPatch.reviewAssessmentDetail || '',
                resolutionOutcome:
                    nextStatus === 'resolved'
                        ? contextPatch.resolutionOutcome || ''
                        : '',
                resolutionOutcomeLabel:
                    nextStatus === 'resolved'
                        ? contextPatch.resolutionOutcomeLabel || ''
                        : '',
                resolutionSource:
                    nextStatus === 'resolved'
                        ? contextPatch.resolutionSource || ''
                        : '',
                resolutionNote:
                    nextStatus === 'resolved'
                        ? contextPatch.resolutionNote || ''
                        : '',
            });
            createToast(
                nextStatus === 'resolved'
                    ? 'Apoyo resuelto desde agenda'
                    : 'Apoyo marcado en atencion desde agenda',
                nextStatus === 'resolved' ? 'success' : 'info'
            );
            return true;
        }
        case 'appointment-review-confirm-appointment': {
            const confirmationContext = buildReviewContextPatch(
                element,
                'resolved'
            );
            await updateQueueHelpRequestStatus({
                helpRequestId:
                    Number(element.dataset.reviewHelpRequestId || 0) || 0,
                ticketId: Number(element.dataset.reviewTicketId || 0) || 0,
                status: 'resolved',
                context: confirmationContext,
            });
            updateAppointmentReviewContext({
                helpRequestStatus: 'resolved',
                reviewAssessmentKind:
                    confirmationContext.reviewAssessmentKind || '',
                reviewAssessmentLabel:
                    confirmationContext.reviewAssessmentLabel || '',
                reviewAssessmentDetail:
                    confirmationContext.reviewAssessmentDetail || '',
                resolutionOutcome: confirmationContext.resolutionOutcome || '',
                resolutionOutcomeLabel:
                    confirmationContext.resolutionOutcomeLabel || '',
                resolutionSource: confirmationContext.resolutionSource || '',
                resolutionNote: confirmationContext.resolutionNote || '',
            });
            createToast('Cita vigente confirmada desde agenda', 'success');
            return true;
        }
        case 'appointment-review-open-availability': {
            const navigated = await navigateToSection('availability');
            if (navigated === false) {
                return true;
            }

            const requestedDate = String(
                element.dataset.reviewRequestedDate || ''
            ).trim();
            const requestedTime = String(
                element.dataset.reviewRequestedTime || ''
            ).trim();
            if (requestedDate) {
                selectAvailabilityDate(requestedDate);
            }
            focusAvailabilityContext(requestedDate, requestedTime);
            return true;
        }
        case 'appointment-review-open-queue': {
            const navigated = await navigateToSection('queue');
            if (navigated === false) {
                return true;
            }

            clearQueueSearch();
            setQueueFilter('all');
            const ticketId = Number(element.dataset.reviewTicketId || 0) || 0;
            const ticketCode = String(
                element.dataset.reviewTicketCode || ''
            ).trim();
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    focusQueueTicketRow(ticketId, ticketCode);
                });
            });
            return true;
        }
        case 'appointment-review-clear-context':
            clearAppointmentReviewContext();
            createToast('Contexto de sala cerrado', 'info');
            return true;
        default:
            return false;
    }
}
