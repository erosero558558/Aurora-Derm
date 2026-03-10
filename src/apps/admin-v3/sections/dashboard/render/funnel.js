import { formatNumber, setHtml, setText } from '../../../shared/ui/render.js';
import { breakdownList } from '../markup.js';

export function setFunnelMetrics(funnel) {
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

    setHtml(
        '#funnelEntryList',
        breakdownList(funnel.checkoutEntryBreakdown, 'entry', 'count')
    );
    setHtml(
        '#funnelSourceList',
        breakdownList(funnel.sourceBreakdown, 'source', 'count')
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
        breakdownList(funnel.abandonReasonBreakdown, 'reason', 'count')
    );
    setHtml(
        '#funnelStepList',
        breakdownList(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        breakdownList(funnel.errorCodeBreakdown, 'code', 'count')
    );
}
