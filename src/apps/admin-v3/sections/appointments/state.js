import { updateState } from '../../shared/core/store.js';
import {
    DEFAULT_APPOINTMENT_DENSITY,
    DEFAULT_APPOINTMENT_SORT,
} from './constants.js';
import { renderAppointmentsSection } from './render.js';
import { normalize } from './utils.js';

function updateAppointmentState(patch) {
    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            ...patch,
        },
    }));
    renderAppointmentsSection();
}

function normalizeReviewStatus(status) {
    const normalized = normalize(status);
    if (normalized === 'attending') {
        return 'attending';
    }
    if (normalized === 'resolved') {
        return 'resolved';
    }
    return 'pending';
}

function normalizeReviewContext(context) {
    if (!context || typeof context !== 'object') {
        return null;
    }

    const helpRequestId = Number(context.helpRequestId || 0) || 0;
    const ticketId = Number(context.ticketId || 0) || 0;
    const appointmentId = Number(context.appointmentId || 0) || 0;
    const ticketCode = String(context.ticketCode || '').trim();
    const reason = normalize(context.reason) || 'general';

    if (
        helpRequestId <= 0 &&
        ticketId <= 0 &&
        appointmentId <= 0 &&
        ticketCode === ''
    ) {
        return null;
    }

    return {
        mode: normalize(context.mode) || 'queue_help_request',
        helpRequestId,
        helpRequestStatus: normalizeReviewStatus(context.helpRequestStatus),
        ticketId,
        ticketCode,
        patientInitials: String(context.patientInitials || '--').trim() || '--',
        reason,
        reasonLabel: String(context.reasonLabel || '').trim(),
        appointmentId,
        phoneLast4: String(context.phoneLast4 || '').trim(),
        requestedDate: String(context.requestedDate || '').trim(),
        requestedTime: String(context.requestedTime || '').trim(),
        specialPriority: Boolean(context.specialPriority),
        lateArrival: Boolean(context.lateArrival),
        reviewAssessmentKind: String(context.reviewAssessmentKind || '').trim(),
        reviewAssessmentLabel: String(
            context.reviewAssessmentLabel || ''
        ).trim(),
        reviewAssessmentDetail: String(
            context.reviewAssessmentDetail || ''
        ).trim(),
        resolutionOutcome: String(context.resolutionOutcome || '').trim(),
        resolutionOutcomeLabel: String(
            context.resolutionOutcomeLabel || ''
        ).trim(),
        resolutionSource: String(context.resolutionSource || '').trim(),
        resolutionNote: String(context.resolutionNote || '').trim(),
    };
}

export function setAppointmentFilter(filter) {
    updateAppointmentState({ filter: normalize(filter) || 'all' });
}

export function setAppointmentSearch(search) {
    updateAppointmentState({ search: String(search || '') });
}

export function clearAppointmentFilters() {
    updateAppointmentState({
        filter: 'all',
        search: '',
    });
}

export function setAppointmentSort(sort) {
    updateAppointmentState({
        sort: normalize(sort) || DEFAULT_APPOINTMENT_SORT,
    });
}

export function setAppointmentDensity(density) {
    updateAppointmentState({
        density:
            normalize(density) === 'compact'
                ? 'compact'
                : DEFAULT_APPOINTMENT_DENSITY,
    });
}

export function setAppointmentReviewContext(context) {
    updateAppointmentState({
        reviewContext: normalizeReviewContext(context),
    });
}

export function updateAppointmentReviewContext(patch) {
    updateState((state) => {
        const current = normalizeReviewContext(
            state?.appointments?.reviewContext
        );
        if (!current) {
            return state;
        }

        return {
            ...state,
            appointments: {
                ...state.appointments,
                reviewContext: normalizeReviewContext({
                    ...current,
                    ...patch,
                }),
            },
        };
    });
    renderAppointmentsSection();
}

export function clearAppointmentReviewContext() {
    updateAppointmentState({
        reviewContext: null,
    });
}

export function mutateAppointmentInState(id, patch) {
    const targetId = Number(id || 0);

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            appointments: (state.data.appointments || []).map((item) =>
                Number(item.id || 0) === targetId
                    ? {
                          ...item,
                          ...patch,
                      }
                    : item
            ),
        },
    }));

    renderAppointmentsSection();
}
