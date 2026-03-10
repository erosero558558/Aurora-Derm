import { coalesceNonEmptyString, normalizeStatus } from '../helpers.js';

export function normalizeTicket(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || raw?.ticket_id || fallbackIndex + 1);
    return {
        id,
        ticketCode: String(raw?.ticketCode || raw?.ticket_code || `A-${id}`),
        queueType: String(raw?.queueType || raw?.queue_type || 'walk_in'),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        priorityClass: String(
            raw?.priorityClass || raw?.priority_class || 'walk_in'
        ),
        status: normalizeStatus(raw?.status || 'waiting'),
        assignedConsultorio:
            Number(
                raw?.assignedConsultorio || raw?.assigned_consultorio || 0
            ) === 2
                ? 2
                : Number(
                        raw?.assignedConsultorio ||
                            raw?.assigned_consultorio ||
                            0
                    ) === 1
                  ? 1
                  : null,
        createdAt: String(
            raw?.createdAt || raw?.created_at || new Date().toISOString()
        ),
        calledAt: String(raw?.calledAt || raw?.called_at || ''),
        completedAt: String(raw?.completedAt || raw?.completed_at || ''),
        needsAssistance: Boolean(raw?.needsAssistance ?? raw?.needs_assistance),
        assistanceRequestStatus: String(
            raw?.assistanceRequestStatus || raw?.assistance_request_status || ''
        ),
        activeHelpRequestId:
            Number(
                raw?.activeHelpRequestId ?? raw?.active_help_request_id ?? 0
            ) || null,
        specialPriority: Boolean(raw?.specialPriority ?? raw?.special_priority),
        lateArrival: Boolean(raw?.lateArrival ?? raw?.late_arrival),
        reprintRequestedAt: String(
            raw?.reprintRequestedAt || raw?.reprint_requested_at || ''
        ),
        estimatedWaitMin: Math.max(
            0,
            Number(raw?.estimatedWaitMin ?? raw?.estimated_wait_min ?? 0) || 0
        ),
    };
}

export function normalizeMetaTicket(raw, fallbackIndex = 0, overrides = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = normalizeTicket(
        {
            ...source,
            ...overrides,
        },
        fallbackIndex
    );

    if (!coalesceNonEmptyString(source.createdAt, source.created_at)) {
        normalized.createdAt = '';
    }
    if (!coalesceNonEmptyString(source.priorityClass, source.priority_class)) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(source.queueType, source.queue_type)) {
        normalized.queueType = '';
    }
    if (
        !coalesceNonEmptyString(source.patientInitials, source.patient_initials)
    ) {
        normalized.patientInitials = '';
    }

    return normalized;
}
