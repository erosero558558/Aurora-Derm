import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import { attentionItem } from './attention.js';
import { relativeWindow } from '../time.js';

export function actionItem(action, label, meta) {
    return `
        <button type="button" class="operations-action-item" data-action="${escapeHtml(action)}">
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

export function buildOperations(state) {
    const {
        appointments,
        availabilityDays,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        waitingTickets,
    } = state;

    return [
        actionItem(
            'context-open-appointments-overview',
            'Abrir agenda',
            nextAppointment?.item
                ? `Siguiente cita ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                : `${appointments.length} cita(s) cargadas`
        ),
        actionItem(
            'context-open-callbacks-pending',
            'Revisar pendientes',
            pendingTransfers > 0
                ? `${pendingTransfers} pago(s) y ${pendingCallbacks} llamada(s) por resolver`
                : `${pendingCallbacks} llamada(s) pendientes`
        ),
        actionItem(
            'context-open-availability',
            'Abrir horarios',
            availabilityDays > 0
                ? `${availabilityDays} dia(s) con horarios publicados`
                : waitingTickets > 0
                  ? 'Revisa horarios para sostener la cola de hoy'
                  : 'Publica nuevos horarios cuando haga falta'
        ),
    ].join('');
}

function truncateSnippet(value, limit = 72) {
    const text = String(value || '').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function buildOpsAttrs(attributes = {}) {
    return Object.entries(attributes)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(
            ([key, value]) =>
                ` data-whatsapp-ops-${escapeHtml(key)}="${escapeHtml(String(value))}"`
        )
        .join('');
}

function opsActionItem(action, label, meta, attributes = {}) {
    return `
        <button
            type="button"
            class="operations-action-item"
            data-whatsapp-ops-action="${escapeHtml(action)}"${buildOpsAttrs(attributes)}
        >
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

function describeFailedOutbox(item) {
    const phone = String(item?.phone || '').trim() || 'Sin telefono';
    const error = String(item?.error || '').trim();
    const text = String(item?.text || '').trim();
    return `${phone} • ${truncateSnippet(error || text || 'Reintenta la entrega')}`;
}

function describeCheckout(item) {
    const patient = String(item?.name || '').trim() || 'Paciente';
    const date = String(item?.date || '').trim();
    const time = String(item?.time || '').trim();
    const paymentStatus = String(item?.paymentStatus || '').trim();
    const slot = [date, time].filter(Boolean).join(' ');
    return truncateSnippet(
        [patient, slot || 'Sin horario', paymentStatus || 'checkout pendiente']
            .filter(Boolean)
            .join(' • ')
    );
}

function describeHold(item) {
    const phone = String(item?.phone || '').trim() || 'Sin telefono';
    const slot = [item?.date, item?.time].filter(Boolean).join(' ');
    return truncateSnippet(
        [phone, slot || 'Sin horario', String(item?.service || '').trim()]
            .filter(Boolean)
            .join(' • ')
    );
}

export function buildWhatsappOpsActions(snapshot) {
    if (!snapshot?.available || snapshot.bridgeMode === 'disabled') {
        return '';
    }

    const actions = [];
    const failed = Array.isArray(snapshot.failedOutboxItems)
        ? snapshot.failedOutboxItems[0]
        : null;
    const checkout = Array.isArray(snapshot.pendingCheckouts)
        ? snapshot.pendingCheckouts[0]
        : null;
    const hold = Array.isArray(snapshot.activeHolds)
        ? snapshot.activeHolds[0]
        : null;

    if (failed?.id) {
        actions.push(
            opsActionItem(
                'requeue_outbox',
                'Reencolar fallo',
                describeFailedOutbox(failed),
                { id: failed.id }
            )
        );
    }

    if (checkout) {
        actions.push(
            opsActionItem(
                'expire_checkout',
                'Expirar checkout',
                describeCheckout(checkout),
                {
                    'payment-session-id': checkout.paymentSessionId,
                    'hold-id': checkout.holdId,
                    'conversation-id': checkout.conversationId,
                }
            )
        );
    } else if (hold?.id) {
        actions.push(
            opsActionItem(
                'release_hold',
                'Liberar hold',
                describeHold(hold),
                {
                    'hold-id': hold.id,
                    reason: 'admin_dashboard',
                    notify: '0',
                }
            )
        );
    }

    actions.push(
        opsActionItem(
            'sweep_stale',
            'Barrer stale',
            snapshot.deliveryFailures > 0 || snapshot.pendingCheckouts.length > 0
                ? `${snapshot.deliveryFailures} fallo(s), ${snapshot.pendingCheckouts.length} checkout(s)`
                : 'Revisa vencidos y limpia residuos del bridge',
            { limit: '25' }
        )
    );

    return actions.slice(0, 3).join('');
}

export function buildWhatsappOpsItems(snapshot) {
    if (!snapshot?.available) {
        return attentionItem(
            'Bridge',
            snapshot?.statusCode || 'offline',
            snapshot?.error || 'Sin lectura del bridge operativo.',
            'warning'
        );
    }

    return [
        attentionItem(
            'Bridge',
            String(snapshot.bridgeMode || 'pending').toUpperCase(),
            snapshot.lastInboundAt || snapshot.lastOutboundAt
                ? `Inbound ${snapshot.lastInboundAt ? formatDateTime(snapshot.lastInboundAt) : '--'} | Outbound ${snapshot.lastOutboundAt ? formatDateTime(snapshot.lastOutboundAt) : '--'}`
                : 'Aun no hay eventos recientes del bridge.',
            snapshot.bridgeMode === 'online'
                ? 'success'
                : snapshot.bridgeMode === 'degraded'
                  ? 'warning'
                  : snapshot.bridgeMode === 'offline'
                    ? 'danger'
                    : 'neutral'
        ),
        attentionItem(
            'Outbox',
            snapshot.pendingOutbox,
            snapshot.deliveryFailures > 0
                ? `${snapshot.deliveryFailures} entrega(s) fallida(s) esperando retry`
                : 'Sin entregas fallidas en este momento.',
            snapshot.deliveryFailures > 0 ? 'warning' : 'success'
        ),
        attentionItem(
            'Slots retenidos',
            snapshot.aliveHolds,
            snapshot.pendingCheckouts.length > 0
                ? `${snapshot.pendingCheckouts.length} checkout(s) aun sostienen horario`
                : 'Sin checkouts reteniendo cupos.',
            snapshot.pendingCheckouts.length > 0 || snapshot.aliveHolds > 0
                ? 'warning'
                : 'success'
        ),
    ].join('');
}

function normalizeStringList(value) {
    return (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function formatClinicalReviewStatus(status) {
    switch (String(status || '').trim().toLowerCase()) {
        case 'review_required':
            return 'Revision requerida';
        case 'pending_review':
            return 'Pendiente';
        case 'ready_for_review':
            return 'Lista para revisar';
        case 'approved':
            return 'Aprobada';
        case 'draft_ready':
            return 'Borrador listo';
        default:
            return 'En curso';
    }
}

function formatClinicalPendingAiStatus(status) {
    switch (String(status || '').trim().toLowerCase()) {
        case 'queued':
            return 'IA en cola';
        case 'processing':
            return 'IA procesando';
        case 'completed':
            return 'IA conciliada';
        case 'failed':
            return 'IA fallo';
        default:
            return 'IA pendiente';
    }
}

function formatClinicalSeverity(severity) {
    switch (String(severity || '').trim().toLowerCase()) {
        case 'critical':
            return 'Critico';
        case 'warning':
            return 'Alerta';
        case 'info':
            return 'Info';
        default:
            return 'Evento';
    }
}

function resolveClinicalTone(reviewStatus, pendingAiStatus, severity) {
    if (String(severity || '').trim().toLowerCase() === 'critical') {
        return 'danger';
    }
    if (String(severity || '').trim().toLowerCase() === 'warning') {
        return 'warning';
    }
    if (String(pendingAiStatus || '').trim() !== '') {
        return 'warning';
    }
    if (String(reviewStatus || '').trim().toLowerCase() === 'ready_for_review') {
        return 'success';
    }
    if (
        ['review_required', 'pending_review'].includes(
            String(reviewStatus || '').trim().toLowerCase()
        )
    ) {
        return 'warning';
    }

    return 'neutral';
}

function formatClinicalConfidence(value) {
    const confidence = Number(value || 0);
    if (!Number.isFinite(confidence) || confidence <= 0) {
        return '';
    }

    return `${Math.round(confidence * 100)}% conf.`;
}

function clinicalActionAttrs(attributes = {}) {
    return Object.entries(attributes)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(
            ([key, value]) =>
                ` data-clinical-history-${escapeHtml(key)}="${escapeHtml(String(value))}"`
        )
        .join('');
}

function clinicalActionItem(action, label, meta, attributes = {}) {
    return `
        <button
            type="button"
            class="operations-action-item"
            data-clinical-history-action="${escapeHtml(action)}"${clinicalActionAttrs(attributes)}
        >
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(meta)}</small>
        </button>
    `;
}

function describeClinicalQueueItem(item) {
    const reasons = normalizeStringList(item?.reviewReasons);
    const missingFields = normalizeStringList(item?.missingFields);
    const redFlags = normalizeStringList(item?.redFlags);

    return truncateSnippet(
        [
            String(item?.summary || '').trim(),
            missingFields.length > 0
                ? `${missingFields.length} dato(s) faltante(s)`
                : '',
            reasons.length > 0 ? `${reasons.length} motivo(s) de revision` : '',
            redFlags.length > 0 ? `${redFlags.length} red flag(s)` : '',
            formatClinicalConfidence(item?.confidence),
        ]
            .filter(Boolean)
            .join(' • '),
        110
    );
}

function describeClinicalEventItem(item) {
    return truncateSnippet(
        [
            String(item?.patientName || item?.caseId || 'Caso clinico').trim(),
            item?.occurredAt ? formatDateTime(item.occurredAt) : '',
            formatClinicalReviewStatus(item?.reviewStatus || item?.status),
        ]
            .filter(Boolean)
            .join(' • '),
        110
    );
}

function clinicalActionLabel(item, fallback) {
    const patientName = String(item?.patientName || '').trim();
    if (!patientName) {
        return fallback;
    }

    return truncateSnippet(`Abrir ${patientName}`, 28);
}

export function buildClinicalHistoryActions(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue)
        ? snapshot.reviewQueue
        : [];
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const summary =
        snapshot?.summary && typeof snapshot.summary === 'object'
            ? snapshot.summary
            : {};
    const actions = [];

    reviewQueue.slice(0, 2).forEach((item, index) => {
        if (!item?.sessionId) {
            return;
        }

        actions.push(
            clinicalActionItem(
                'open-review',
                clinicalActionLabel(
                    item,
                    index === 0 ? 'Abrir borrador' : 'Abrir siguiente'
                ),
                describeClinicalQueueItem(item) || 'Abrir revision clinica',
                { 'session-id': item.sessionId }
            )
        );
    });

    if (actions.length === 0) {
        const firstEventWithSession = events.find(
            (item) => String(item?.sessionId || '').trim() !== ''
        );
        if (firstEventWithSession?.sessionId) {
            actions.push(
                clinicalActionItem(
                    'open-review',
                    'Abrir ultimo evento',
                    describeClinicalEventItem(firstEventWithSession),
                    { 'session-id': firstEventWithSession.sessionId }
                )
            );
        }
    }

    const pendingAiCount = Number(summary?.drafts?.pendingAiCount || 0);
    const unreadEvents = Number(summary?.events?.unreadCount || 0);
    if (pendingAiCount > 0 || unreadEvents > 0) {
        actions.push(
            actionItem(
                'refresh-admin-data',
                'Actualizar snapshot',
                pendingAiCount > 0
                    ? `${pendingAiCount} borrador(es) siguen en reconciliacion`
                    : `${unreadEvents} evento(s) clinicos sin leer`
            )
        );
    }

    return actions.slice(0, 3).join('');
}

export function buildClinicalHistoryQueueItems(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue)
        ? snapshot.reviewQueue
        : [];

    if (reviewQueue.length === 0) {
        return attentionItem(
            'Cola clinica',
            0,
            'No hay historias clinicas pendientes de revision en este momento.',
            'success'
        );
    }

    return reviewQueue
        .slice(0, 3)
        .map((item) => {
            const label = String(item?.patientName || item?.caseId || 'Caso clinico').trim();
            const reviewStatus = String(item?.reviewStatus || item?.sessionStatus || '').trim();
            const pendingAiStatus = String(item?.pendingAiStatus || '').trim();
            return attentionItem(
                label || 'Caso clinico',
                pendingAiStatus
                    ? formatClinicalPendingAiStatus(pendingAiStatus)
                    : formatClinicalReviewStatus(reviewStatus),
                describeClinicalQueueItem(item) || 'Sin detalles clinicos adicionales.',
                resolveClinicalTone(reviewStatus, pendingAiStatus, '')
            );
        })
        .join('');
}

export function buildClinicalHistoryEventItems(snapshot) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];

    if (events.length === 0) {
        return attentionItem(
            'Eventos',
            0,
            'Sin actividad clinica reciente en la cola operativa.',
            'success'
        );
    }

    return events
        .slice(0, 3)
        .map((item) =>
            attentionItem(
                String(item?.title || item?.patientName || 'Evento clinico').trim() ||
                    'Evento clinico',
                formatClinicalSeverity(item?.severity),
                describeClinicalEventItem(item) || 'Sin detalle operativo adicional.',
                resolveClinicalTone(item?.reviewStatus, '', item?.severity)
            )
        )
        .join('');
}
