import {
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentFunnelMetrics,
    currentHealthStatus,
    getEmptyFunnelMetrics
} from './state.js';
import {
    escapeHtml,
    formatCount,
    formatPercent,
    toPositiveNumber,
    getServiceName,
    getPreferenceText,
    normalizeCallbackStatus
} from './ui.js';

function normalizeFunnelRows(rows) {
    if (!Array.isArray(rows)) {
        return [];
    }
    return rows
        .map((row) => ({
            label: String(row && row.label ? row.label : 'unknown'),
            count: toPositiveNumber(row && row.count ? row.count : 0)
        }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count);
}

function formatFunnelStepLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        service_selected: 'Servicio seleccionado',
        doctor_selected: 'Doctor seleccionado',
        date_selected: 'Fecha seleccionada',
        time_selected: 'Hora seleccionada',
        name_added: 'Nombre ingresado',
        email_added: 'Email ingresado',
        phone_added: 'Telefono ingresado',
        contact_info_completed: 'Datos de contacto completados',
        clinical_context_added: 'Contexto clinico agregado',
        privacy_consent_checked: 'Consentimiento de privacidad',
        form_submitted: 'Formulario enviado',
        chat_booking_started: 'Reserva iniciada en chat',
        payment_modal_open: 'Modal de pago abierto',
        payment_modal_closed: 'Modal de pago cerrado',
        payment_processing: 'Pago en proceso',
        payment_error: 'Error de pago',
        patient_data: 'Datos del paciente',
        reason: 'Motivo de consulta',
        photos: 'Fotos clinicas',
        slot: 'Fecha y hora',
        payment: 'Metodo de pago',
        confirmation: 'Confirmacion',
        payment_method_selected: 'Metodo de pago',
        unknown: 'Paso no identificado'
    };

    if (labels[raw]) {
        return labels[raw];
    }

    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatFunnelEntryLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        booking_form: 'Formulario web',
        chatbot: 'Chatbot',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatPaymentMethodLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        card: 'Tarjeta',
        transfer: 'Transferencia',
        cash: 'Efectivo',
        unpaid: 'Sin definir',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatEventSourceLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        web: 'Web',
        booking_form: 'Formulario web',
        chatbot: 'Chatbot',
        admin: 'Panel admin',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatAbandonReasonLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        user_closed: 'Usuario cerro el flujo',
        chat_cancel: 'Usuario cancelo en chat',
        timeout: 'Tiempo de espera agotado',
        payment_failed: 'Pago fallido',
        calendar_unreachable: 'Agenda Google no disponible',
        slot_conflict: 'Horario ya ocupado',
        slot_unavailable: 'Horario ya ocupado',
        availability_error: 'Error consultando horarios',
        appointment_create_failed: 'Error registrando cita',
        validation_error: 'Error de validacion',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatErrorCodeLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        calendar_unreachable: 'Agenda Google no disponible',
        calendar_auth_failed: 'Token Google invalido',
        calendar_token_rejected: 'Token Google rechazado',
        slot_conflict: 'Horario ocupado',
        slot_unavailable: 'Horario ocupado',
        appointment_create_failed: 'Error registrando cita',
        availability_error: 'Error consultando horarios',
        payment_failed: 'Fallo de pago',
        validation_error: 'Error de validacion',
        unknown: 'No identificado'
    };

    if (labels[raw]) {
        return labels[raw];
    }
    if (raw === '') {
        return labels.unknown;
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function renderFunnelList(elementId, rows, formatLabel, emptyMessage) {
    const listEl = document.getElementById(elementId);
    if (!listEl) {
        return;
    }

    const safeRows = normalizeFunnelRows(rows).slice(0, 6);
    if (safeRows.length === 0) {
        listEl.innerHTML = `<p class="empty-message">${escapeHtml(emptyMessage)}</p>`;
        return;
    }

    const total = safeRows.reduce((sum, row) => sum + row.count, 0);
    listEl.innerHTML = safeRows.map((row) => {
        const sharePct = total > 0 ? formatPercent((row.count / total) * 100) : '0%';
        return `
            <div class="funnel-row">
                <span class="funnel-row-label">${escapeHtml(formatLabel(row.label))}</span>
                <span class="funnel-row-count">${escapeHtml(formatCount(row.count))} (${escapeHtml(sharePct)})</span>
            </div>
        `;
    }).join('');
}

function renderFunnelMetrics() {
    const metrics = currentFunnelMetrics && typeof currentFunnelMetrics === 'object'
        ? currentFunnelMetrics
        : getEmptyFunnelMetrics();
    const summary = metrics.summary && typeof metrics.summary === 'object'
        ? metrics.summary
        : {};

    const viewBooking = toPositiveNumber(summary.viewBooking);
    const startCheckout = toPositiveNumber(summary.startCheckout);
    const bookingConfirmed = toPositiveNumber(summary.bookingConfirmed);
    const checkoutAbandon = toPositiveNumber(summary.checkoutAbandon);
    toPositiveNumber(summary.startRatePct) || (viewBooking > 0 ? (startCheckout / viewBooking) * 100 : 0);
    const confirmedRatePct = toPositiveNumber(summary.confirmedRatePct) || (startCheckout > 0 ? (bookingConfirmed / startCheckout) * 100 : 0);
    const abandonRatePct = toPositiveNumber(summary.abandonRatePct) || (startCheckout > 0 ? (checkoutAbandon / startCheckout) * 100 : 0);

    const viewBookingEl = document.getElementById('funnelViewBooking');
    if (viewBookingEl) viewBookingEl.textContent = formatCount(viewBooking);

    const startCheckoutEl = document.getElementById('funnelStartCheckout');
    if (startCheckoutEl) startCheckoutEl.textContent = formatCount(startCheckout);

    const bookingConfirmedEl = document.getElementById('funnelBookingConfirmed');
    if (bookingConfirmedEl) bookingConfirmedEl.textContent = formatCount(bookingConfirmed);

    const funnelAbandonRateEl = document.getElementById('funnelAbandonRate');
    if (funnelAbandonRateEl) funnelAbandonRateEl.textContent = formatPercent(abandonRatePct);

    const checkoutConversionRateEl = document.getElementById('checkoutConversionRate');
    if (checkoutConversionRateEl) checkoutConversionRateEl.textContent = formatPercent(confirmedRatePct);

    const bookingErrorCount = toPositiveNumber(metrics.events && metrics.events.booking_error);
    const checkoutErrorCount = toPositiveNumber(metrics.events && metrics.events.checkout_error);
    const totalErrorCount = bookingErrorCount + checkoutErrorCount;
    const bookingErrorRatePct = startCheckout > 0 ? (totalErrorCount / startCheckout) * 100 : 0;
    const bookingErrorRateEl = document.getElementById('bookingErrorRate');
    if (bookingErrorRateEl) {
        bookingErrorRateEl.textContent = formatPercent(bookingErrorRatePct);
    }

    const calendarHealthStatusEl = document.getElementById('calendarHealthStatus');
    if (calendarHealthStatusEl) {
        const health = currentHealthStatus && typeof currentHealthStatus === 'object'
            ? currentHealthStatus
            : null;
        const source = health && health.calendarSource ? String(health.calendarSource) : 'desconocido';
        const mode = health && health.calendarMode ? String(health.calendarMode) : 'desconocido';
        const reachable = health ? Boolean(health.calendarReachable) : false;
        const tokenHealthy = health ? Boolean(health.calendarTokenHealthy) : false;

        let label = `Agenda ${source}: ${mode}`;
        if (source === 'google') {
            label += reachable && tokenHealthy ? ' (OK)' : ' (revisar)';
        }
        calendarHealthStatusEl.textContent = label;
    }

    const funnelAbandonListEl = document.getElementById('funnelAbandonList');
    if (!funnelAbandonListEl) {
        return;
    }

    renderFunnelList(
        'funnelAbandonList',
        metrics.checkoutAbandonByStep,
        formatFunnelStepLabel,
        'Sin datos de abandono'
    );
    renderFunnelList(
        'funnelEntryList',
        metrics.checkoutEntryBreakdown,
        formatFunnelEntryLabel,
        'Sin datos de entrada'
    );
    renderFunnelList(
        'funnelPaymentMethodList',
        metrics.paymentMethodBreakdown,
        formatPaymentMethodLabel,
        'Sin datos de pago'
    );
    renderFunnelList(
        'funnelSourceList',
        metrics.eventSourceBreakdown,
        formatEventSourceLabel,
        'Sin datos de origen'
    );
    renderFunnelList(
        'funnelAbandonReasonList',
        metrics.checkoutAbandonByReason,
        formatAbandonReasonLabel,
        'Sin datos de motivo'
    );
    renderFunnelList(
        'funnelStepList',
        metrics.bookingStepBreakdown,
        formatFunnelStepLabel,
        'Sin datos de pasos'
    );
    renderFunnelList(
        'funnelErrorCodeList',
        metrics.errorCodeBreakdown,
        formatErrorCodeLabel,
        'Sin datos de error'
    );
}

export function loadDashboardData() {
    document.getElementById('totalAppointments').textContent = currentAppointments.length;

    const today = new Date().toISOString().split('T')[0];

    const todayAppointments = [];
    let pendingTransfers = 0;
    let confirmedCount = 0;
    let totalNoShows = 0;

    for (const a of currentAppointments) {
        if (a.date === today && a.status !== 'cancelled') {
            todayAppointments.push(a);
        }
        if (a.paymentStatus === 'pending_transfer_review') {
            pendingTransfers++;
        }
        const status = a.status || 'confirmed';
        if (status === 'confirmed') {
            confirmedCount++;
        }
        if (status === 'no_show') {
            totalNoShows++;
        }
    }

    document.getElementById('todayAppointments').textContent = todayAppointments.length;
    const noShowEl = document.getElementById('totalNoShows');
    if (noShowEl) {
        noShowEl.textContent = formatCount(totalNoShows);
    }

    const pendingCallbacks = [];
    for (const c of currentCallbacks) {
        if (normalizeCallbackStatus(c.status) === 'pendiente') {
            pendingCallbacks.push(c);
        }
    }
    document.getElementById('pendingCallbacks').textContent = pendingCallbacks.length;

    let avgRating = 0;
    if (currentReviews.length > 0) {
        avgRating = (currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / currentReviews.length).toFixed(1);
    }
    document.getElementById('avgRating').textContent = avgRating;

    document.getElementById('appointmentsBadge').textContent = pendingTransfers > 0
        ? `${confirmedCount} (${pendingTransfers} por validar)`
        : confirmedCount;
    document.getElementById('callbacksBadge').textContent = pendingCallbacks.length;
    document.getElementById('reviewsBadge').textContent = currentReviews.length;

    const todayList = document.getElementById('todayAppointmentsList');
    if (todayAppointments.length === 0) {
        todayList.innerHTML = '<p class="empty-message">No hay citas para hoy</p>';
    } else {
        todayList.innerHTML = todayAppointments.map(a => `
            <div class="upcoming-item">
                <div class="upcoming-time">
                    <span class="time">${escapeHtml(a.time)}</span>
                </div>
                <div class="upcoming-info">
                    <span class="name">${escapeHtml(a.name)}</span>
                    <span class="service">${escapeHtml(getServiceName(a.service))}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${escapeHtml(a.phone)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(String(a.phone || '').replace(/\\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }

    const callbacksList = document.getElementById('recentCallbacksList');
    const recentCallbacks = currentCallbacks.slice(-5).reverse();
    if (recentCallbacks.length === 0) {
        callbacksList.innerHTML = '<p class="empty-message">No hay callbacks pendientes</p>';
    } else {
        callbacksList.innerHTML = recentCallbacks.map(c => `
            <div class="upcoming-item">
                <div class="upcoming-info">
                    <span class="name">${escapeHtml(c.telefono)}</span>
                    <span class="service">${escapeHtml(getPreferenceText(c.preferencia))}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }

    renderFunnelMetrics();
}
