import {
    clearQueueSearch,
    clearQueueSelection,
    reprintQueueTicket,
    runQueueTicketAction,
    selectVisibleQueueTickets,
    setQueueFilter,
    toggleQueueTicketSelection,
    updateQueueHelpRequestStatus,
} from '../../../../../shared/modules/queue.js';
import { getState } from '../../../../../shared/core/store.js';
import {
    setAppointmentFilter,
    setAppointmentReviewContext,
    setAppointmentSearch,
} from '../../../../../sections/appointments.js';
import { navigateToSection } from '../../../navigation.js';
import { queueActionName, queueConsultorio, queueId } from './shared.js';

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

function readHelpContextValue(context, ...keys) {
    if (!context || typeof context !== 'object') {
        return '';
    }

    for (const key of keys) {
        const value = context[key];
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        const normalized = String(value).trim();
        if (normalized !== '') {
            return normalized;
        }
    }

    return '';
}

function readQueueDatasetValue(element, ...keys) {
    const dataset = element?.dataset || {};
    for (const key of keys) {
        const value = dataset[key];
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

function buildQueueHelpRequestContextPatch(element, nextStatus = '') {
    const patch = {
        reviewAssessmentKind: readQueueDatasetValue(
            element,
            'queueReviewAssessmentKind'
        ),
        reviewAssessmentLabel: readQueueDatasetValue(
            element,
            'queueReviewAssessmentLabel'
        ),
        reviewAssessmentDetail: readQueueDatasetValue(
            element,
            'queueReviewAssessmentDetail'
        ),
    };

    if (
        String(nextStatus || '')
            .trim()
            .toLowerCase() === 'resolved'
    ) {
        patch.resolutionOutcome = readQueueDatasetValue(
            element,
            'queueResolutionOutcome'
        );
        patch.resolutionOutcomeLabel = readQueueDatasetValue(
            element,
            'queueResolutionOutcomeLabel'
        );
        patch.resolutionSource =
            readQueueDatasetValue(element, 'queueResolutionSource') || 'queue';
        patch.resolutionNote = readQueueDatasetValue(
            element,
            'queueResolutionNote'
        );
    }

    return Object.fromEntries(
        Object.entries(patch).filter(([, value]) => String(value || '').trim())
    );
}

function resolveQueueHelpRequestContext(element) {
    const state = getState();
    const helpRequestId =
        Number(element?.dataset?.queueHelpRequestId || 0) || 0;
    const ticketId = queueId(element);
    const queueMeta = state?.data?.queueMeta || {};
    const queueTickets = Array.isArray(state?.data?.queueTickets)
        ? state.data.queueTickets
        : [];
    const activeHelpRequests = Array.isArray(queueMeta?.activeHelpRequests)
        ? queueMeta.activeHelpRequests
        : [];
    const request =
        activeHelpRequests.find(
            (item) => Number(item?.id || 0) === helpRequestId
        ) ||
        activeHelpRequests.find(
            (item) => Number(item?.ticketId || 0) === ticketId
        ) ||
        null;
    const ticket =
        queueTickets.find((item) => Number(item?.id || 0) === ticketId) ||
        queueTickets.find(
            (item) => Number(item?.activeHelpRequestId || 0) === helpRequestId
        ) ||
        null;
    const context =
        request?.context && typeof request.context === 'object'
            ? request.context
            : {};
    const appointmentId =
        Number(
            readHelpContextValue(context, 'appointmentId', 'appointment_id') ||
                ticket?.appointmentId ||
                0
        ) || 0;
    const phoneLast4 = String(
        readHelpContextValue(context, 'phoneLast4', 'phone_last4') ||
            ticket?.phoneLast4 ||
            ''
    ).trim();
    const requestedDate = String(
        readHelpContextValue(context, 'requestedDate', 'requested_date') || ''
    ).trim();
    const requestedTime = String(
        readHelpContextValue(context, 'requestedTime', 'requested_time') || ''
    ).trim();
    const reason = String(
        request?.reason || ticket?.assistanceReason || 'general'
    )
        .trim()
        .toLowerCase();
    const reasonLabel = String(
        request?.reasonLabel || ticket?.assistanceReasonLabel || ''
    ).trim();
    const reviewAssessmentKind = String(
        readHelpContextValue(
            context,
            'reviewAssessmentKind',
            'review_assessment_kind'
        ) || ''
    ).trim();
    const reviewAssessmentLabel = String(
        readHelpContextValue(
            context,
            'reviewAssessmentLabel',
            'review_assessment_label'
        ) || ''
    ).trim();
    const reviewAssessmentDetail = String(
        readHelpContextValue(
            context,
            'reviewAssessmentDetail',
            'review_assessment_detail'
        ) || ''
    ).trim();
    const resolutionOutcome = String(
        readHelpContextValue(
            context,
            'resolutionOutcome',
            'resolution_outcome',
            'reviewOutcome',
            'review_outcome'
        ) || ''
    ).trim();
    const resolutionOutcomeLabel = String(
        readHelpContextValue(
            context,
            'resolutionOutcomeLabel',
            'resolution_outcome_label',
            'reviewOutcomeLabel',
            'review_outcome_label'
        ) || ''
    ).trim();
    const resolutionSource = String(
        readHelpContextValue(
            context,
            'resolutionSource',
            'resolution_source',
            'reviewSource',
            'review_source'
        ) || ''
    ).trim();
    const resolutionNote = String(
        readHelpContextValue(context, 'resolutionNote', 'resolution_note') || ''
    ).trim();

    return {
        mode: 'queue_help_request',
        helpRequestId: Number(request?.id || helpRequestId || 0) || 0,
        helpRequestStatus: String(
            request?.status || ticket?.assistanceRequestStatus || 'pending'
        )
            .trim()
            .toLowerCase(),
        ticketId: Number(ticket?.id || ticketId || 0) || 0,
        ticketCode: String(
            request?.ticketCode || ticket?.ticketCode || ''
        ).trim(),
        patientInitials: String(
            request?.patientInitials || ticket?.patientInitials || '--'
        ).trim(),
        reason,
        reasonLabel,
        appointmentId,
        phoneLast4,
        requestedDate,
        requestedTime,
        specialPriority:
            Boolean(ticket?.specialPriority) || reason === 'special_priority',
        lateArrival: Boolean(ticket?.lateArrival) || reason === 'late_arrival',
        reviewAssessmentKind,
        reviewAssessmentLabel,
        reviewAssessmentDetail,
        resolutionOutcome,
        resolutionOutcomeLabel,
        resolutionSource,
        resolutionNote,
    };
}

function focusAppointmentSearchInput() {
    const input = document.getElementById('searchAppointments');
    if (!(input instanceof HTMLInputElement)) {
        return false;
    }

    input.focus();
    if (input.value) {
        input.select();
    }
    return true;
}

function focusAppointmentRow(appointmentId) {
    const targetId = Number(appointmentId || 0) || 0;
    if (targetId <= 0) {
        return false;
    }

    const row = document.querySelector(
        `#appointmentsTableBody tr[data-appointment-id="${targetId}"]`
    );
    if (!(row instanceof HTMLElement)) {
        return false;
    }

    row.classList.add('appointment-row-focus');
    row.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
    });
    window.setTimeout(() => {
        row.classList.remove('appointment-row-focus');
    }, 1800);
    return true;
}

function focusAppointmentsContext({ appointmentId = 0 }) {
    let attempts = 0;

    const applyFocus = () => {
        attempts += 1;
        if (focusAppointmentRow(appointmentId)) {
            return;
        }
        if (attempts < 8) {
            window.requestAnimationFrame(applyFocus);
            return;
        }
        focusAppointmentSearchInput();
    };

    window.requestAnimationFrame(applyFocus);
}

export async function handleQueueTicketActionGroup(action, element) {
    switch (action) {
        case 'queue-toggle-ticket-select':
            toggleQueueTicketSelection(queueId(element));
            return true;
        case 'queue-select-visible':
            selectVisibleQueueTickets();
            return true;
        case 'queue-clear-selection':
            clearQueueSelection();
            return true;
        case 'queue-ticket-action':
            await runQueueTicketAction(
                queueId(element),
                queueActionName(element),
                queueConsultorio(element)
            );
            return true;
        case 'queue-reprint-ticket':
            await reprintQueueTicket(queueId(element));
            return true;
        case 'queue-help-request-status': {
            const nextStatus = String(
                element?.dataset?.queueHelpRequestStatus || ''
            ).trim();
            await updateQueueHelpRequestStatus({
                helpRequestId:
                    Number(element?.dataset?.queueHelpRequestId || 0) || 0,
                ticketId: queueId(element),
                status: nextStatus,
                context: buildQueueHelpRequestContextPatch(element, nextStatus),
            });
            return true;
        }
        case 'queue-open-appointments': {
            const appointmentContext = resolveQueueHelpRequestContext(element);
            const navigated = await navigateToSection('appointments');
            if (!navigated) {
                return true;
            }
            setAppointmentFilter('all');
            setAppointmentSearch(appointmentContext.phoneLast4);
            setAppointmentReviewContext(appointmentContext);
            focusAppointmentsContext(appointmentContext);
            return true;
        }
        case 'queue-clear-search':
            clearQueueSearch();
            return true;
        case 'queue-open-quick-tray':
            clearQueueSearch();
            setQueueFilter(String(element?.dataset?.queueFilterValue || 'all'));
            return true;
        case 'queue-focus-ticket': {
            clearQueueSearch();
            setQueueFilter('all');
            const targetId = queueId(element);
            const targetCode = String(
                element?.dataset?.queueTicketCode || ''
            ).trim();
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    focusQueueTicketRow(targetId, targetCode);
                });
            });
            return true;
        }
        case 'queue-reset-tray-context':
            clearQueueSearch();
            setQueueFilter('all');
            return true;
        default:
            return false;
    }
}
