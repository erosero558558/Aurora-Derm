import { formatNumber, setHtml, setText } from '../../../shared/ui/render.js';
import { breakdownList } from '../markup.js';

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function firstValue(source, keys, fallback = 0) {
    const data = asObject(source);
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }
    }
    return fallback;
}

function readCount(source, keys) {
    const value = Number(firstValue(source, keys, 0));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function readLabel(source, keys) {
    return String(firstValue(source, keys, '') || '').trim();
}

function normalizeBreakdown(list) {
    return asArray(list)
        .map((entry) => ({
            label: String(entry?.label || entry?.reason || entry?.intent || '')
                .trim()
                .toLowerCase(),
            count: readCount(entry, ['count']),
        }))
        .filter((entry) => entry.label && entry.count > 0)
        .sort((left, right) => right.count - left.count);
}

function normalizeAssistantWindow(raw) {
    const source = asObject(raw);
    return {
        actioned: readCount(source, ['actioned']),
        resolvedWithoutHuman: readCount(source, [
            'resolvedWithoutHuman',
            'resolved_without_human',
        ]),
        assistedResolutions: readCount(source, [
            'assistedResolutions',
            'assisted_resolutions',
        ]),
        escalated: readCount(source, ['escalated']),
        clinicalBlocked: readCount(source, [
            'clinicalBlocked',
            'clinical_blocked',
        ]),
        fallback: readCount(source, ['fallback']),
        errors: readCount(source, ['errors']),
        latencyTotalMs: readCount(source, [
            'latencyTotalMs',
            'latency_total_ms',
        ]),
        latencySamples: readCount(source, [
            'latencySamples',
            'latency_samples',
        ]),
        sessions: readCount(source, ['sessions']),
        usefulSessions: readCount(source, [
            'usefulSessions',
            'useful_sessions',
        ]),
        avgLatencyMs: readCount(source, ['avgLatencyMs', 'avg_latency_ms']),
    };
}

function normalizeTopRow(raw, breakdown) {
    const source = asObject(raw);
    const label = readLabel(source, ['label']);
    const count = readCount(source, ['count']);
    if (label) {
        return { label, count };
    }
    return breakdown[0] || { label: '', count: 0 };
}

function normalizeQueueAssistant(raw) {
    const source = asObject(raw);
    const today = normalizeAssistantWindow(
        firstValue(source, ['today', 'today_metrics', 'todayMetrics'], {})
    );
    const last7d = normalizeAssistantWindow(
        firstValue(source, ['last7d', 'last_7d', 'week', 'week_metrics'], {})
    );
    const intentBreakdown = normalizeBreakdown(
        firstValue(source, ['intentBreakdown', 'intent_breakdown'], [])
    );
    const helpReasonBreakdown = normalizeBreakdown(
        firstValue(source, ['helpReasonBreakdown', 'help_reason_breakdown'], [])
    );
    const reviewOutcomeBreakdown = normalizeBreakdown(
        firstValue(
            source,
            ['reviewOutcomeBreakdown', 'review_outcome_breakdown'],
            []
        )
    );

    return {
        today,
        last7d,
        intentBreakdown,
        helpReasonBreakdown,
        reviewOutcomeBreakdown,
        topIntent: normalizeTopRow(
            firstValue(source, ['topIntent', 'top_intent'], {}),
            intentBreakdown
        ),
        topHelpReason: normalizeTopRow(
            firstValue(source, ['topHelpReason', 'top_help_reason'], {}),
            helpReasonBreakdown
        ),
        topReviewOutcome: normalizeTopRow(
            firstValue(source, ['topReviewOutcome', 'top_review_outcome'], {}),
            reviewOutcomeBreakdown
        ),
    };
}

function formatAssistantLabel(value, fallback = 'sin datos') {
    const label = String(value || '')
        .trim()
        .replace(/[_-]+/g, ' ');
    return label || fallback;
}

function resolveAssistantStatus(metrics) {
    const { today, last7d } = metrics;
    if (today.errors > 0) {
        return { label: 'Incidencias', tone: 'danger' };
    }
    if (today.clinicalBlocked > 0 || today.escalated > 0) {
        return { label: 'Con derivaciones', tone: 'warning' };
    }
    if (today.assistedResolutions > 0) {
        return { label: 'Recepcion cerrando', tone: 'success' };
    }
    if (today.resolvedWithoutHuman > 0) {
        return { label: 'Resolviendo', tone: 'success' };
    }
    if (today.actioned > 0) {
        return { label: 'Activo', tone: 'neutral' };
    }
    if (last7d.actioned > 0) {
        return { label: 'Sin uso hoy', tone: 'neutral' };
    }
    return { label: 'Sin uso', tone: 'neutral' };
}

function buildAssistantSummary(metrics) {
    const { today, last7d } = metrics;
    if (today.actioned <= 0) {
        return last7d.usefulSessions > 0
            ? `Sin actividad hoy. En 7 dias cerro ${formatNumber(last7d.usefulSessions)} sesiones utiles.`
            : 'Sin actividad del asistente todavia.';
    }

    const fragments = [`Hoy acciono ${formatNumber(today.actioned)} caso(s)`];
    if (today.resolvedWithoutHuman > 0) {
        fragments.push(
            `resolvio ${formatNumber(today.resolvedWithoutHuman)} sin humano`
        );
    }
    if (today.assistedResolutions > 0) {
        fragments.push(
            `recepcion cerro ${formatNumber(today.assistedResolutions)} con guia`
        );
    }
    if (today.escalated > 0) {
        fragments.push(`escalo ${formatNumber(today.escalated)} a recepcion`);
    }
    if (today.clinicalBlocked > 0) {
        fragments.push(
            `bloqueo ${formatNumber(today.clinicalBlocked)} consulta(s) clinica(s)`
        );
    }
    if (today.errors > 0) {
        fragments.push(`registro ${formatNumber(today.errors)} error(es)`);
    }
    return `${fragments.join(' | ')}.`;
}

function setAssistantUtilityMetrics(raw) {
    const metrics = normalizeQueueAssistant(raw);
    const { today, last7d, topIntent, topHelpReason, topReviewOutcome } =
        metrics;
    const status = resolveAssistantStatus(metrics);
    const statusEl = document.getElementById('dashboardAssistantStatus');
    if (statusEl) {
        statusEl.textContent = status.label;
        statusEl.setAttribute('data-state', status.tone);
    }

    setText('#dashboardAssistantMeta', 'Recepcionista ejecutora en sala');
    setText('#dashboardAssistantActioned', formatNumber(today.actioned));
    setText(
        '#dashboardAssistantResolved',
        formatNumber(today.resolvedWithoutHuman)
    );
    setText('#dashboardAssistantEscalated', formatNumber(today.escalated));
    setText('#dashboardAssistantBlocked', formatNumber(today.clinicalBlocked));
    setText('#dashboardAssistantSummary', buildAssistantSummary(metrics));
    setText(
        '#dashboardAssistantWindowMeta',
        `7d: ${formatNumber(last7d.usefulSessions)} sesiones utiles | ${formatNumber(last7d.avgLatencyMs)} ms promedio | ${formatNumber(last7d.assistedResolutions)} cierre(s) asistidos`
    );
    setText(
        '#dashboardAssistantTopIntent',
        topIntent.count > 0
            ? `Intent principal: ${formatAssistantLabel(topIntent.label)} (${formatNumber(topIntent.count)})`
            : 'Intent principal: sin datos'
    );
    setText(
        '#dashboardAssistantTopReason',
        topHelpReason.count > 0
            ? `Motivo de apoyo: ${formatAssistantLabel(topHelpReason.label)} (${formatNumber(topHelpReason.count)})`
            : 'Motivo de apoyo: sin datos'
    );
    setText(
        '#dashboardAssistantTopOutcome',
        topReviewOutcome.count > 0
            ? `Cierre asistido: ${formatAssistantLabel(topReviewOutcome.label)} (${formatNumber(topReviewOutcome.count)})`
            : 'Cierre asistido: sin datos'
    );
}

export function setFunnelMetrics(funnel) {
    const summary = asObject(funnel.summary);
    setText('#funnelViewBooking', formatNumber(summary.viewBooking || 0));
    setText('#funnelStartCheckout', formatNumber(summary.startCheckout || 0));
    setText(
        '#funnelBookingConfirmed',
        formatNumber(summary.bookingConfirmed || 0)
    );
    setText(
        '#funnelAbandonRate',
        `${Number(summary.abandonRatePct || 0).toFixed(1)}%`
    );

    setHtml(
        '#funnelEntryList',
        breakdownList(funnel.checkoutEntryBreakdown, 'entry', 'count')
    );
    setHtml(
        '#funnelSourceList',
        breakdownList(
            funnel.sourceBreakdown || funnel.eventSourceBreakdown,
            'source',
            'count'
        )
    );
    setHtml(
        '#funnelPaymentMethodList',
        breakdownList(funnel.paymentMethodBreakdown, 'method', 'count')
    );
    setHtml(
        '#funnelAbandonList',
        breakdownList(funnel.checkoutAbandonByStep, 'step', 'count')
    );
    setHtml(
        '#funnelAbandonReasonList',
        breakdownList(
            funnel.abandonReasonBreakdown || funnel.checkoutAbandonByReason,
            'reason',
            'count'
        )
    );
    setHtml(
        '#funnelStepList',
        breakdownList(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        breakdownList(funnel.errorCodeBreakdown, 'code', 'count')
    );
    setAssistantUtilityMetrics(
        funnel.queueAssistant || funnel.queue_assistant || {}
    );
}
