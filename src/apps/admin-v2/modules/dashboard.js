import { escapeHtml, formatNumber, setHtml, setText } from '../ui/render.js';

function normalizeStatus(status) {
    return String(status || '')
        .toLowerCase()
        .trim();
}

function listItem(label, value) {
    return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
}

export function renderDashboard(state) {
    const appointments = Array.isArray(state.data.appointments)
        ? state.data.appointments
        : [];
    const callbacks = Array.isArray(state.data.callbacks)
        ? state.data.callbacks
        : [];
    const reviews = Array.isArray(state.data.reviews) ? state.data.reviews : [];
    const funnel = state.data.funnelMetrics || {};

    const todayKey = new Date().toISOString().split('T')[0];

    const todayAppointments = appointments.filter(
        (item) => String(item.date || '') === todayKey
    ).length;
    const pendingCallbacks = callbacks.filter((item) => {
        const status = normalizeStatus(item.status);
        return status === 'pending' || status === 'pendiente';
    }).length;
    const noShows = appointments.filter(
        (item) => normalizeStatus(item.status) === 'no_show'
    ).length;

    const avgRating = reviews.length
        ? (
              reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0) /
              reviews.length
          ).toFixed(1)
        : '0.0';

    setText('#todayAppointments', todayAppointments);
    setText('#totalAppointments', appointments.length);
    setText('#pendingCallbacks', pendingCallbacks);
    setText('#totalReviewsCount', reviews.length);
    setText('#totalNoShows', noShows);
    setText('#avgRating', avgRating);
    setText('#adminAvgRating', avgRating);

    const summary = funnel.summary || {};
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

    const toItems = (entries, keyLabel, keyValue) =>
        Array.isArray(entries) && entries.length
            ? entries
                  .slice(0, 6)
                  .map((entry) =>
                      listItem(
                          String(entry[keyLabel] || entry.label || '-'),
                          String(entry[keyValue] ?? entry.count ?? 0)
                      )
                  )
                  .join('')
            : '<li><span>Sin datos</span><strong>0</strong></li>';

    setHtml(
        '#funnelEntryList',
        toItems(funnel.checkoutEntryBreakdown, 'entry', 'count')
    );
    setHtml(
        '#funnelSourceList',
        toItems(funnel.sourceBreakdown, 'source', 'count')
    );
    setHtml(
        '#funnelPaymentMethodList',
        toItems(funnel.paymentMethodBreakdown, 'method', 'count')
    );
    setHtml(
        '#funnelAbandonReasonList',
        toItems(funnel.abandonReasonBreakdown, 'reason', 'count')
    );
    setHtml(
        '#funnelStepList',
        toItems(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        toItems(funnel.errorCodeBreakdown, 'code', 'count')
    );
    setHtml(
        '#funnelAbandonList',
        toItems(funnel.checkoutAbandonByStep, 'step', 'count')
    );

    const pendingTransferCount = appointments.filter((item) => {
        const status = normalizeStatus(
            item.paymentStatus || item.payment_status
        );
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;

    const callbacksUrgentCount = callbacks.filter((item) => {
        const status = normalizeStatus(item.status);
        if (!(status === 'pending' || status === 'pendiente')) return false;
        const createdAt = new Date(item.fecha || item.createdAt || '');
        if (Number.isNaN(createdAt.getTime())) return false;
        const ageMinutes = (Date.now() - createdAt.getTime()) / 60000;
        return ageMinutes >= 60;
    }).length;

    setText('#operationPendingReviewCount', pendingTransferCount);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationQueueHealth',
        callbacksUrgentCount > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
    );

    const actions = [
        {
            action: 'context-open-appointments-transfer',
            label: 'Validar transferencias',
            desc: `${pendingTransferCount} por revisar`,
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Triage callbacks',
            desc: `${pendingCallbacks} pendientes`,
        },
        {
            action: 'refresh-admin-data',
            label: 'Actualizar tablero',
            desc: 'Sincronizar datos',
        },
    ];

    setHtml(
        '#operationActionList',
        actions
            .map(
                (item) => `
            <button type="button" class="operations-action-item" data-action="${item.action}">
                <span>${escapeHtml(item.label)}</span>
                <small>${escapeHtml(item.desc)}</small>
            </button>
        `
            )
            .join('')
    );
}
