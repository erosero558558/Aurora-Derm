import { escapeHtml, formatNumber, setHtml, setText } from '../ui/render.js';

function normalizeStatus(status) {
    return String(status || '')
        .toLowerCase()
        .trim();
}

function listItem(label, value) {
    return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
}

function attentionItem(title, value, meta, tone = 'neutral') {
    return `
        <li class="dashboard-attention-item" data-tone="${escapeHtml(tone)}">
            <div>
                <span>${escapeHtml(title)}</span>
                <small>${escapeHtml(meta)}</small>
            </div>
            <strong>${escapeHtml(value)}</strong>
        </li>
    `;
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
    const recentReviews = reviews.filter((item) => {
        const createdAt = new Date(item.date || item.createdAt || '');
        if (Number.isNaN(createdAt.getTime())) return false;
        return Date.now() - createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    setText('#todayAppointments', todayAppointments);
    setText('#totalAppointments', appointments.length);
    setText('#pendingCallbacks', pendingCallbacks);
    setText('#totalReviewsCount', reviews.length);
    setText('#totalNoShows', noShows);
    setText('#avgRating', avgRating);
    setText('#adminAvgRating', avgRating);
    setText('#dashboardHeroRating', avgRating);
    setText('#dashboardHeroRecentReviews', recentReviews);

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
    setText('#dashboardHeroPendingTransfers', pendingTransferCount);
    setText('#dashboardHeroUrgentCallbacks', callbacksUrgentCount);
    setText(
        '#operationQueueHealth',
        callbacksUrgentCount > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
    );
    setText(
        '#dashboardQueueHealth',
        callbacksUrgentCount > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
    );
    setText(
        '#dashboardLiveStatus',
        pendingTransferCount > 0 || callbacksUrgentCount > 0
            ? 'Atencion'
            : 'Estable'
    );
    setText(
        '#dashboardLiveMeta',
        pendingTransferCount > 0
            ? 'Existen transferencias pendientes por validar.'
            : callbacksUrgentCount > 0
              ? 'Hay callbacks fuera de SLA que requieren contacto.'
              : 'Sin alertas criticas en la operacion actual.'
    );
    setText(
        '#dashboardFlowStatus',
        todayAppointments > 6
            ? 'Agenda con demanda alta'
            : noShows > 0
              ? 'Revisar ausencias del dia'
              : 'Flujo operativo bajo control'
    );
    setText(
        '#dashboardHeroSummary',
        pendingTransferCount > 0 || callbacksUrgentCount > 0
            ? `Prioriza ${pendingTransferCount} transferencia(s) y ${callbacksUrgentCount} callback(s) urgentes.`
            : 'Agenda, callbacks y disponibilidad en una sola vista de control.'
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

    const refreshAt = Number(state.ui?.lastRefreshAt || 0);
    setText(
        '#operationRefreshSignal',
        refreshAt
            ? `Sync ${new Date(refreshAt).toLocaleTimeString('es-EC', {
                  hour: '2-digit',
                  minute: '2-digit',
              })}`
            : 'Tiempo real'
    );
    setText(
        '#operationDeckMeta',
        pendingTransferCount > 0 || pendingCallbacks > 0
            ? 'Prioridades activas'
            : 'Operacion estable'
    );

    const attentionItems = [
        attentionItem(
            'Transferencias',
            String(pendingTransferCount),
            pendingTransferCount > 0
                ? 'Comprobantes por revisar'
                : 'Sin pendientes',
            pendingTransferCount > 0 ? 'warning' : 'neutral'
        ),
        attentionItem(
            'Callbacks urgentes',
            String(callbacksUrgentCount),
            callbacksUrgentCount > 0
                ? 'Mayores a 60 minutos'
                : 'SLA dentro de rango',
            callbacksUrgentCount > 0 ? 'danger' : 'neutral'
        ),
        attentionItem(
            'No show',
            String(noShows),
            noShows > 0 ? 'Requiere seguimiento' : 'Sin ausencias recientes',
            noShows > 0 ? 'warning' : 'neutral'
        ),
    ];

    setHtml('#dashboardAttentionList', attentionItems.join(''));
}
