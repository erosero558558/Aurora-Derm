let currentAppointments = [];
let currentCallbacks = [];
let currentReviews = [];
let currentAvailability = {};
let currentAvailabilityMeta = {};
let currentFunnelMetrics = null;
let currentHealthStatus = null;
let csrfToken = '';

function setAppointments(data) { currentAppointments = data || []; }
function setCallbacks(data) { currentCallbacks = data || []; }
function setReviews(data) { currentReviews = data || []; }
function setAvailability(data) { currentAvailability = data || {}; }
function setAvailabilityMeta(data) { currentAvailabilityMeta = data || {}; }
function setFunnelMetrics(data) { currentFunnelMetrics = data; }
function setHealthStatus(data) { currentHealthStatus = data || null; }
function setCsrfToken(token) { csrfToken = token; }

function getEmptyFunnelMetrics() {
    return {
        summary: {
            viewBooking: 0,
            startCheckout: 0,
            bookingConfirmed: 0,
            checkoutAbandon: 0,
            startRatePct: 0,
            confirmedRatePct: 0,
            abandonRatePct: 0
        },
        checkoutAbandonByStep: [],
        checkoutAbandonByReason: [],
        checkoutEntryBreakdown: [],
        eventSourceBreakdown: [],
        paymentMethodBreakdown: [],
        bookingStepBreakdown: [],
        errorCodeBreakdown: [],
        retention: {
            appointmentsTotal: 0,
            appointmentsNonCancelled: 0,
            statusCounts: {
                confirmed: 0,
                completed: 0,
                noShow: 0,
                cancelled: 0
            },
            noShowRatePct: 0,
            completionRatePct: 0,
            uniquePatients: 0,
            recurrentPatients: 0,
            recurrenceRatePct: 0
        }
    };
}

const API_ENDPOINT = '/api.php';
const AUTH_ENDPOINT = '/admin-auth.php';

function buildQuery(resource) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    return `${API_ENDPOINT}?${params.toString()}`;
}

async function requestJson(url, options = {}) {
    const init = {
        method: options.method || 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json'
        }
    };

    if (csrfToken && options.method && options.method !== 'GET') {
        init.headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const responseText = await response.text();

    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new Error('Respuesta no valida del servidor');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

async function apiRequest(resource, options = {}) {
    return requestJson(buildQuery(resource), options);
}

async function authRequest(action, options = {}) {
    return requestJson(`${AUTH_ENDPOINT}?action=${encodeURIComponent(action)}`, options);
}

/**
 * Shared utilities for Piel en Armonía
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * Avoids creating DOM nodes repeatedly to reduce memory churn.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const titles = {
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(titles[type])}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button type="button" class="toast-close" data-action="close-toast">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0%';
    return `${num.toFixed(1)}%`;
}

function formatCount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '0';
    return Math.round(num).toLocaleString('es-EC');
}

function toPositiveNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return num;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitizePublicHref(url) {
    const value = String(url || '').trim();
    if (value === '') return '';
    if (value.startsWith('/')) return value;
    if (/^https?:\/\//i.test(value)) return value;
    return '';
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatológica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Láser',
        rejuvenecimiento: 'Rejuvenecimiento',
        acne: 'Tratamiento de Acne',
        cancer: 'Deteccion de Cancer de Piel'
    };
    return names[service] || service;
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Rosero',
        narvaez: 'Dra. Narváez',
        indiferente: 'Cualquiera disponible'
    };
    return names[doctor] || doctor;
}

function getStatusText(status) {
    const texts = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        cancelled: 'Cancelada',
        completed: 'Completada',
        no_show: 'No asistio',
        noshow: 'No asistio'
    };
    return texts[status] || status;
}

function getPaymentMethodText(method) {
    const normalized = String(method || '').toLowerCase().trim();
    const texts = {
        card: 'Tarjeta',
        transfer: 'Transferencia',
        cash: 'Efectivo',
        unpaid: 'Sin definir'
    };
    return texts[normalized] || (method || 'Sin definir');
}

function getPaymentStatusText(status) {
    const normalized = String(status || '').toLowerCase().trim();
    const texts = {
        paid: 'Pagado',
        pending_cash: 'Pago en consultorio',
        pending_transfer: 'Transferencia pendiente',
        pending_transfer_review: 'Comprobante por validar',
        pending_gateway: 'Pago en proceso',
        pending: 'Pendiente',
        failed: 'Pago fallido'
    };
    return texts[normalized] || (status || 'Pendiente');
}

function getPreferenceText(pref) {
    const texts = {
        ahora: 'Lo antes posible',
        '15min': 'En 15 minutos',
        '30min': 'En 30 minutos',
        '1hora': 'En 1 hora'
    };
    return texts[pref] || pref;
}

function normalizeCallbackStatus(status) {
    const normalized = String(status || '').toLowerCase().trim();
    if (normalized === 'pending') return 'pendiente';
    if (normalized === 'contacted') return 'contactado';
    return normalized === 'contactado' ? 'contactado' : 'pendiente';
}

async function checkAuth() {
    try {
        const payload = await authRequest('status');
        if (payload.authenticated) {
            if (payload.csrfToken) setCsrfToken(payload.csrfToken);
            return true;
        } else {
            return false;
        }
    } catch (error) {
        showToast('No se pudo verificar la sesion', 'warning');
        return false;
    }
}

async function logout() {
    try {
        await authRequest('logout', { method: 'POST' });
    } catch (error) {
        // Continue
    }
    showToast('Sesion cerrada correctamente', 'info');
    setTimeout(() => window.location.reload(), 800);
}

async function login(password) {
    return authRequest('login', {
        method: 'POST',
        body: { password }
    });
}

async function login2FA(code) {
    return authRequest('login-2fa', {
        method: 'POST',
        body: { code }
    });
}

function getLocalData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function saveLocalData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        // storage quota full or disabled
    }
}

function loadFallbackState() {
    setAppointments(getLocalData('appointments', []));
    setCallbacks(getLocalData('callbacks', []).map(c => ({
        ...c,
        status: normalizeCallbackStatus(c.status)
    })));
    setReviews(getLocalData('reviews', []));
    setAvailability(getLocalData('availability', {}));
    setAvailabilityMeta(getLocalData('availability-meta', {}));
    setFunnelMetrics(getEmptyFunnelMetrics());
    setHealthStatus(getLocalData('health-status', null));
}

async function refreshData() {
    try {
        const [payload, funnelPayload, healthPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('funnel-metrics').catch(() => null),
            apiRequest('health').catch(() => null)
        ]);

        const data = payload.data || {};

        const appointments = Array.isArray(data.appointments) ? data.appointments : [];
        setAppointments(appointments);
        saveLocalData('appointments', appointments);

        const callbacks = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        setCallbacks(callbacks);
        saveLocalData('callbacks', callbacks);

        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        setReviews(reviews);
        saveLocalData('reviews', reviews);

        const availability = data.availability && typeof data.availability === 'object' ? data.availability : {};
        setAvailability(availability);
        saveLocalData('availability', availability);
        const availabilityMeta = data.availabilityMeta && typeof data.availabilityMeta === 'object'
            ? data.availabilityMeta
            : { source: 'store', mode: 'live', generatedAt: new Date().toISOString() };
        setAvailabilityMeta(availabilityMeta);
        saveLocalData('availability-meta', availabilityMeta);

        if (funnelPayload && funnelPayload.data && typeof funnelPayload.data === 'object') {
            setFunnelMetrics(funnelPayload.data);
        } else {
            setFunnelMetrics(getEmptyFunnelMetrics());
        }

        if (healthPayload && healthPayload.ok) {
            setHealthStatus(healthPayload);
            saveLocalData('health-status', healthPayload);
        } else {
            setHealthStatus(null);
        }
    } catch (error) {
        loadFallbackState();
        showToast('No se pudo conectar al backend. Usando datos locales.', 'warning');
    }
}

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

function loadDashboardData() {
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

function renderCallbacks(callbacks) {
    const grid = document.getElementById('callbacksGrid');
    if (!grid) return;

    if (callbacks.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay callbacks registrados</p>';
        return;
    }

    grid.innerHTML = callbacks.map(c => {
        const status = normalizeCallbackStatus(c.status);
        const callbackId = Number(c.id) || 0;
        const callbackDateKey = encodeURIComponent(String(c.fecha || ''));
        return `
            <div class="callback-card ${status}">
                <div class="callback-header">
                    <span class="callback-phone">${escapeHtml(c.telefono)}</span>
                    <span class="status-badge status-${status}">
                        ${status === 'pendiente' ? 'Pendiente' : 'Contactado'}
                    </span>
                </div>
                <span class="callback-preference">
                    <i class="fas fa-clock"></i>
                    ${escapeHtml(getPreferenceText(c.preferencia))}
                </span>
                <p class="callback-time">
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(new Date(c.fecha).toLocaleString('es-EC'))}
                </p>
                <div class="callback-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn btn-phone btn-sm">
                        <i class="fas fa-phone"></i>
                        Llamar
                    </a>
                    ${status === 'pendiente' ? `
                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${callbackId}" data-callback-date="${callbackDateKey}">
                            <i class="fas fa-check"></i>
                            Marcar contactado
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function loadCallbacks() {
    renderCallbacks(currentCallbacks);
}

function filterCallbacks() {
    const filter = document.getElementById('callbackFilter').value;
    let callbacks = [...currentCallbacks];

    if (filter === 'pending') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'pendiente');
    } else if (filter === 'contacted') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'contactado');
    }

    renderCallbacks(callbacks);
}

async function markContacted(callbackId, callbackDate = '') {
    let callback = null;
    const normalizedId = Number(callbackId);
    if (normalizedId > 0) {
        callback = currentCallbacks.find(c => Number(c.id) === normalizedId);
    }

    const decodedDate = callbackDate ? decodeURIComponent(callbackDate) : '';
    if (!callback && decodedDate) {
        callback = currentCallbacks.find(c => c.fecha === decodedDate);
    }

    if (!callback) {
        showToast('Callback no encontrado', 'error');
        return;
    }

    try {
        const callbackId = callback.id || Date.now();
        if (!callback.id) {
            callback.id = callbackId;
        }
        await apiRequest('callbacks', {
            method: 'PATCH',
            body: { id: Number(callbackId), status: 'contactado' }
        });
        await refreshData();
        loadCallbacks();
        loadDashboardData();
        showToast('Marcado como contactado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar callback: ${error.message}`, 'error');
    }
}

function loadReviews() {
    const avgRating = currentReviews.length > 0
        ? (currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / currentReviews.length).toFixed(1)
        : '0.0';

    document.getElementById('adminAvgRating').textContent = avgRating;
    document.getElementById('totalReviewsCount').textContent = `${currentReviews.length} reseñas`;

    const starsContainer = document.getElementById('adminRatingStars');
    const fullStars = Math.floor(Number(avgRating));
    starsContainer.innerHTML = '';
    for (let i = 1; i <= 5; i += 1) {
        const star = document.createElement('i');
        star.className = i <= fullStars ? 'fas fa-star' : 'far fa-star';
        starsContainer.appendChild(star);
    }

    const grid = document.getElementById('reviewsGrid');
    if (currentReviews.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay reseñas registradas</p>';
        return;
    }

    grid.innerHTML = currentReviews
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .map(r => `
            <div class="review-card-admin">
                <div class="review-header-admin">
                    <strong>${escapeHtml(r.name || 'Paciente')}</strong>
                    ${r.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}
                </div>
                <div class="review-rating">${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}</div>
                <p>${escapeHtml(r.text || '')}</p>
                <small>${escapeHtml(new Date(r.date).toLocaleDateString('es-EC'))}</small>
            </div>
        `).join('');
}

let initialized = false;

function setPushStatus(label, tone = 'muted') {
    const indicator = document.getElementById('pushStatusIndicator');
    if (!indicator) return;

    indicator.classList.remove(
        'status-pill-muted',
        'status-pill-ok',
        'status-pill-warn',
        'status-pill-error'
    );
    indicator.classList.add(`status-pill-${tone}`);
    indicator.textContent = `Push: ${label}`;
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const raw = window.atob(normalized);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

function getButtons() {
    const subscribeBtn = document.getElementById('subscribePushBtn');
    const testBtn = document.getElementById('testPushBtn');
    return { subscribeBtn, testBtn };
}

function setButtonsVisibility(visible) {
    const { subscribeBtn, testBtn } = getButtons();
    if (subscribeBtn) {
        subscribeBtn.classList.toggle('is-hidden', !visible);
        subscribeBtn.disabled = !visible;
    }
    if (testBtn) {
        testBtn.classList.toggle('is-hidden', !visible);
        testBtn.disabled = !visible;
    }
}

function updateSubscribeButton(isSubscribed) {
    const { subscribeBtn } = getButtons();
    if (!subscribeBtn) return;

    if (isSubscribed) {
        subscribeBtn.dataset.action = 'unsubscribe';
        subscribeBtn.classList.remove('btn-primary');
        subscribeBtn.classList.add('btn-secondary');
        subscribeBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Desactivar Notificaciones';
        return;
    }

    subscribeBtn.dataset.action = 'subscribe';
    subscribeBtn.classList.remove('btn-secondary');
    subscribeBtn.classList.add('btn-primary');
    subscribeBtn.innerHTML = '<i class="fas fa-bell"></i> Activar Notificaciones';
}

async function getPushConfig() {
    const payload = await apiRequest('push-config');
    const publicKey = String(payload.publicKey || '');
    if (!publicKey) {
        throw new Error('VAPID public key no disponible');
    }
    return publicKey;
}

async function checkSubscriptionState() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    updateSubscribeButton(Boolean(subscription));
    setPushStatus(subscription ? 'activo' : 'disponible', subscription ? 'ok' : 'muted');
    return subscription;
}

async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Permiso de notificaciones denegado');
    }

    const publicKey = await getPushConfig();
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
        return existing;
    }

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await apiRequest('push-subscribe', {
        method: 'POST',
        body: { subscription }
    });

    return subscription;
}

async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        return;
    }

    await apiRequest('push-unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint }
    });

    await subscription.unsubscribe();
}

async function onToggleSubscription() {
    const { subscribeBtn } = getButtons();
    if (!subscribeBtn) return;
    const action = String(subscribeBtn.dataset.action || 'subscribe');

    const previous = subscribeBtn.innerHTML;
    subscribeBtn.disabled = true;
    subscribeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        if (action === 'unsubscribe') {
            await unsubscribe();
            setPushStatus('disponible', 'muted');
            showToast('Notificaciones desactivadas', 'info');
        } else {
            await subscribe();
            setPushStatus('activo', 'ok');
            showToast('Notificaciones activadas', 'success');
        }
    } catch (error) {
        setPushStatus('error', 'error');
        showToast(`Push: ${error.message || 'error desconocido'}`, 'error');
    } finally {
        subscribeBtn.disabled = false;
        await checkSubscriptionState().catch(() => {
            updateSubscribeButton(false);
        });
        if (subscribeBtn.dataset.action !== 'subscribe' && subscribeBtn.dataset.action !== 'unsubscribe') {
            subscribeBtn.innerHTML = previous;
        }
    }
}

async function onTestNotification() {
    const { testBtn } = getButtons();
    if (!testBtn) return;
    const icon = testBtn.querySelector('i');
    const previousClass = icon ? icon.className : '';
    testBtn.disabled = true;
    if (icon) {
        icon.className = 'fas fa-spinner fa-spin';
    }

    try {
        const payload = await apiRequest('push-test', { method: 'POST', body: {} });
        const result = payload.result || {};
        const success = Number(result.success || 0);
        const failed = Number(result.failed || 0);
        if (failed > 0) {
            showToast(`Push test: ${success} ok, ${failed} fallidos`, 'warning');
        } else {
            showToast(`Push test enviado (${success})`, 'success');
        }
    } catch (error) {
        showToast(`Push test: ${error.message || 'error'}`, 'error');
    } finally {
        if (icon) {
            icon.className = previousClass;
        }
        testBtn.disabled = false;
    }
}

async function initPushNotifications() {
    if (initialized) {
        return;
    }
    initialized = true;

    const { subscribeBtn, testBtn } = getButtons();
    if (!subscribeBtn || !testBtn) {
        return;
    }

    const supported = (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined'
    );

    if (!supported) {
        setButtonsVisibility(false);
        setPushStatus('no soportado', 'warn');
        return;
    }

    try {
        await navigator.serviceWorker.register('/sw.js');
        await getPushConfig();
        setButtonsVisibility(true);
        setPushStatus('disponible', 'muted');
        subscribeBtn.addEventListener('click', onToggleSubscription);
        testBtn.addEventListener('click', onTestNotification);
        await checkSubscriptionState();
    } catch (error) {
        setButtonsVisibility(false);
        setPushStatus('sin configurar', 'warn');
        // Keep admin UX clean when push is not enabled in this environment.
        // The controls stay hidden and the dashboard remains fully functional.
        console.info('Push no configurado en servidor:', error?.message || error);
    }
}

function getWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

function renderAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No hay citas registradas</td></tr>';
        return;
    }

    const sorted = [...appointments].sort((a, b) => {
        const dateA = (a.date || '') + ' ' + (a.time || '');
        const dateB = (b.date || '') + ' ' + (b.time || '');
        return dateB.localeCompare(dateA);
    });

    tbody.innerHTML = sorted.map(a => `
        <tr>
            <td>
                <strong>${escapeHtml(a.name)}</strong><br>
                <small>${escapeHtml(a.email)}</small>
            </td>
            <td>${escapeHtml(getServiceName(a.service))}</td>
            <td>${escapeHtml(getDoctorName(a.doctor))}${a.doctorAssigned ? '<br><small>Asignado: ' + escapeHtml(getDoctorName(a.doctorAssigned)) + '</small>' : ''}</td>
            <td>${escapeHtml(formatDate(a.date))}</td>
            <td>${escapeHtml(a.time)}</td>
            <td>
                <strong>${escapeHtml(a.price || '$0.00')}</strong><br>
                <small>${escapeHtml(getPaymentMethodText(a.paymentMethod))} - ${escapeHtml(getPaymentStatusText(a.paymentStatus))}</small>
                ${(a.transferReference ? `<br><small>Ref: ${escapeHtml(a.transferReference)}</small>` : '')}
                ${(sanitizePublicHref(a.transferProofUrl) ? `<br><a href="${escapeHtml(sanitizePublicHref(a.transferProofUrl))}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>` : '')}
            </td>
            <td>
                <span class="status-badge status-${escapeHtml(a.status || 'confirmed')}">
                    ${escapeHtml(getStatusText(a.status || 'confirmed'))}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    ${(a.paymentStatus === 'pending_transfer_review' ? `
                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(a.id) || 0}" title="Aprobar transferencia">
                        <i class="fas fa-check"></i>
                    </button>
                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(a.id) || 0}" title="Rechazar transferencia">
                        <i class="fas fa-ban"></i>
                    </button>
                    ` : '')}
                    <a href="tel:${escapeHtml(a.phone)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(String(a.phone || '').replace(/\\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(a.id) || 0}" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                    ${((a.status || 'confirmed') !== 'cancelled' && (a.status || 'confirmed') !== 'completed' && (a.status || 'confirmed') !== 'no_show' ? `
                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(a.id) || 0}" title="Marcar no asistio">
                        <i class="fas fa-user-slash"></i>
                    </button>
                    ` : '')}
                </div>
            </td>
        </tr>
    `).join('');
}

function loadAppointments() {
    renderAppointments(currentAppointments);
}

function filterAppointments() {
    const filter = document.getElementById('appointmentFilter').value;
    let filtered = [...currentAppointments];

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange();
    const currentMonthNumber = new Date().getMonth();

    switch (filter) {
        case 'today':
            filtered = filtered.filter(a => a.date === today);
            break;
        case 'week':
            filtered = filtered.filter(a => a.date >= currentWeek.start && a.date <= currentWeek.end);
            break;
        case 'month':
            filtered = filtered.filter(a => new Date(a.date).getMonth() === currentMonthNumber);
            break;
        case 'confirmed':
        case 'cancelled':
        case 'no_show':
            filtered = filtered.filter(a => (a.status || 'confirmed') === filter);
            break;
        case 'pending_transfer':
            filtered = filtered.filter(a => a.paymentStatus === 'pending_transfer_review');
            break;
    }

    renderAppointments(filtered);
}

function searchAppointments() {
    const search = document.getElementById('searchAppointments').value.toLowerCase();
    const filtered = currentAppointments.filter(a =>
        String(a.name || '').toLowerCase().includes(search) ||
        String(a.email || '').toLowerCase().includes(search) ||
        String(a.phone || '').includes(search)
    );
    renderAppointments(filtered);
}

async function cancelAppointment(id) {
    if (!confirm('¿Estas seguro de cancelar esta cita?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'cancelled' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita cancelada correctamente', 'success');
    } catch (error) {
        showToast(`No se pudo cancelar la cita: ${error.message}`, 'error');
    }
}

async function markNoShow(id) {
    if (!confirm('Marcar esta cita como "No asistio"?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'no_show' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita marcada como no asistio', 'success');
    } catch (error) {
        showToast(`No se pudo marcar no-show: ${error.message}`, 'error');
    }
}

async function approveTransfer(id) {
    if (!confirm('¿Aprobar el comprobante de transferencia de esta cita?')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'paid', paymentPaidAt: new Date().toISOString() }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia aprobada', 'success');
    } catch (error) {
        showToast(`No se pudo aprobar: ${error.message}`, 'error');
    }
}

async function rejectTransfer(id) {
    if (!confirm('¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'failed' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia rechazada', 'warning');
    } catch (error) {
        showToast(`No se pudo rechazar: ${error.message}`, 'error');
    }
}

function csvSafe(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) {
        text = "'" + text;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

function exportAppointmentsCSV() {
    if (!Array.isArray(currentAppointments) || currentAppointments.length === 0) {
        showToast('No hay citas para exportar', 'warning');
        return;
    }

    const headers = [
        'ID',
        'Fecha',
        'Hora',
        'Paciente',
        'Email',
        'Telefono',
        'Servicio',
        'Doctor',
        'Precio',
        'Estado',
        'Estado pago',
        'Metodo pago'
    ];

    const rows = currentAppointments.map((a) => [
        Number(a.id) || 0,
        a.date || '',
        a.time || '',
        csvSafe(a.name || ''),
        csvSafe(a.email || ''),
        csvSafe(a.phone || ''),
        csvSafe(getServiceName(a.service)),
        csvSafe(getDoctorName(a.doctor)),
        a.price || '',
        csvSafe(getStatusText(a.status || 'confirmed')),
        csvSafe(getPaymentStatusText(a.paymentStatus)),
        csvSafe(getPaymentMethodText(a.paymentMethod))
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('CSV exportado correctamente', 'success');
}

let selectedDate = null;
let currentMonth = new Date();
let availabilityReadOnly = false;

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function ensureStatusElements() {
    const panel = document.querySelector('#availability .time-slots-config');
    if (!panel)
        return { statusEl: null, detailsEl: null, linksEl: null };

    let statusEl = document.getElementById('availabilitySyncStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'availabilitySyncStatus';
        statusEl.className = 'selected-date';
        if (panel.firstChild) {
            panel.insertBefore(statusEl, panel.firstChild.nextSibling);
        } else {
            panel.appendChild(statusEl);
        }
    }

    let detailsEl = document.getElementById('availabilitySyncDetails');
    if (!detailsEl) {
        detailsEl = document.createElement('div');
        detailsEl.id = 'availabilitySyncDetails';
        detailsEl.className = 'selected-date';
        statusEl.insertAdjacentElement('afterend', detailsEl);
    }

    let linksEl = document.getElementById('availabilitySyncLinks');
    if (!linksEl) {
        linksEl = document.createElement('div');
        linksEl.id = 'availabilitySyncLinks';
        linksEl.className = 'selected-date';
        detailsEl.insertAdjacentElement('afterend', linksEl);
    }

    return { statusEl, detailsEl, linksEl };
}

function formatStatusTime(isoValue) {
    const value = String(isoValue || '').trim();
    if (!value) return 'n/d';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'n/d';
    return parsed.toLocaleString('es-EC');
}

function renderStatus() {
    const { statusEl, detailsEl, linksEl } = ensureStatusElements();
    if (!statusEl) return;

    const source = String(currentAvailabilityMeta.source || 'store');
    const mode = String(currentAvailabilityMeta.mode || 'live');
    const timezone = String(currentAvailabilityMeta.timezone || 'America/Guayaquil');
    const calendarAuth = String(currentAvailabilityMeta.calendarAuth || 'n/d');
    const tokenHealthy = currentAvailabilityMeta.calendarTokenHealthy === false ? 'no' : 'si';
    const configured = currentAvailabilityMeta.calendarConfigured === false ? 'no' : 'si';
    const reachable = currentAvailabilityMeta.calendarReachable === false ? 'no' : 'si';
    const generatedLabel = formatStatusTime(currentAvailabilityMeta.generatedAt);
    const lastSuccessLabel = formatStatusTime(
        currentAvailabilityMeta.calendarLastSuccessAt
    );
    const lastErrorLabel = formatStatusTime(currentAvailabilityMeta.calendarLastErrorAt);
    const lastErrorReason = String(currentAvailabilityMeta.calendarLastErrorReason || '').trim();

    if (source === 'google') {
        const modeLabel = mode === 'blocked' ? 'bloqueado' : 'live';
        statusEl.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${escapeHtml(modeLabel)}</strong> | TZ: <strong>${escapeHtml(timezone)}</strong>`;
        if (detailsEl) {
            let details = `Auth: <strong>${escapeHtml(calendarAuth)}</strong> | Token OK: <strong>${escapeHtml(tokenHealthy)}</strong> | Configurado: <strong>${escapeHtml(configured)}</strong> | Reachable: <strong>${escapeHtml(reachable)}</strong> | Ultimo exito: <strong>${escapeHtml(lastSuccessLabel)}</strong> | Snapshot: <strong>${escapeHtml(generatedLabel)}</strong>`;
            if (mode === 'blocked' && lastErrorReason) {
                details += ` | Ultimo error: <strong>${escapeHtml(lastErrorLabel)}</strong> (${escapeHtml(lastErrorReason)})`;
            }
            detailsEl.innerHTML = details;
        }
    } else {
        statusEl.innerHTML = `Fuente: <strong>Configuracion local</strong>`;
        if (detailsEl) {
            detailsEl.innerHTML = `Snapshot: <strong>${escapeHtml(generatedLabel)}</strong>`;
        }
    }
    updateSectionHeadings(source);

    if (!linksEl) return;

    const doctorCalendars = currentAvailabilityMeta.doctorCalendars;
    if (!doctorCalendars || typeof doctorCalendars !== 'object') {
        linksEl.innerHTML = '';
        return;
    }

    const renderDoctor = (doctorKey, doctorLabel) => {
        const record = doctorCalendars[doctorKey];
        if (!record || typeof record !== 'object') {
            return `${doctorLabel}: n/d`;
        }
        const masked = escapeHtml(String(record.idMasked || 'n/d'));
        const openUrl = String(record.openUrl || '');
        if (!/^https:\/\/calendar\.google\.com\//.test(openUrl)) {
            return `${doctorLabel}: ${masked}`;
        }
        return `${doctorLabel}: ${masked} <a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">Abrir</a>`;
    };

    linksEl.innerHTML = [
        renderDoctor('rosero', 'Dr. Rosero'),
        renderDoctor('narvaez', 'Dra. Narvaez'),
    ].join(' | ');
}

function updateSectionHeadings(source) {
    const calendarTitle = document.querySelector(
        '#availability .availability-calendar h3'
    );
    if (calendarTitle) {
        calendarTitle.textContent =
            source === 'google'
                ? 'Disponibilidad (Google Calendar - Solo lectura)'
                : 'Configurar Horarios Disponibles';
    }

    const dayTitle = document.querySelector('#availability .time-slots-config h3');
    if (dayTitle) {
        dayTitle.textContent =
            source === 'google'
                ? 'Horarios del Dia (solo lectura)'
                : 'Horarios del Dia';
    }
}

function clearSelectedDateState() {
    const selectedLabel = document.getElementById('selectedDate');
    if (selectedLabel) {
        selectedLabel.textContent = 'Selecciona una fecha';
    }
    const list = document.getElementById('timeSlotsList');
    if (list) {
        list.innerHTML = '<p class="empty-message">Selecciona una fecha para ver los horarios</p>';
    }
}

function toggleReadOnlyUi() {
    const addSlotForm = document.getElementById('addSlotForm');
    if (addSlotForm) {
        addSlotForm.classList.toggle('is-hidden', availabilityReadOnly);
    }
}

async function refreshAvailabilitySnapshot() {
    try {
        const payload = await apiRequest('availability', {
            query: {
                doctor: 'indiferente',
                service: 'consulta',
                days: 45,
            },
        });

        const data =
            payload && payload.data && typeof payload.data === 'object'
                ? payload.data
                : {};
        const snapshotMeta =
            payload && payload.meta && typeof payload.meta === 'object'
                ? payload.meta
                : {};
        const baseMeta =
            currentAvailabilityMeta &&
            typeof currentAvailabilityMeta === 'object'
                ? currentAvailabilityMeta
                : {};
        const mergedMeta = {
            ...baseMeta,
            ...snapshotMeta,
            source: String(snapshotMeta.source || baseMeta.source || 'store'),
            mode: String(snapshotMeta.mode || baseMeta.mode || 'live'),
            timezone: String(
                snapshotMeta.timezone || baseMeta.timezone || 'America/Guayaquil'
            ),
            generatedAt: String(
                snapshotMeta.generatedAt ||
                    baseMeta.generatedAt ||
                    new Date().toISOString()
            ),
        };

        setAvailability(data);
        setAvailabilityMeta(mergedMeta);
        availabilityReadOnly = String(mergedMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
        if (selectedDate && !currentAvailability[selectedDate]) {
            selectedDate = null;
            clearSelectedDateState();
        }
    } catch (error) {
        console.error('Error refreshing availability:', error);
        showToast(
            `Error al actualizar disponibilidad: ${error?.message || 'error desconocido'}`,
            'error'
        );
        availabilityReadOnly = String(currentAvailabilityMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
    }
}

function renderAvailabilityCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    document.getElementById('calendarMonth').textContent = new Date(
        year,
        month
    ).toLocaleDateString('es-EC', {
        month: 'long',
        year: 'numeric',
    });

    const calendar = document.getElementById('availabilityCalendar');
    calendar.innerHTML = '';

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    weekDays.forEach((day) => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day-header';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    });

    for (let i = firstDay - 1; i >= 0; i -= 1) {
        const day = daysInPrevMonth - i;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const dateStr = toLocalDateKey(date);
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (selectedDate === dateStr) dayEl.classList.add('selected');
        if (
            currentAvailability[dateStr] &&
            currentAvailability[dateStr].length > 0
        )
            dayEl.classList.add('has-slots');

        dayEl.addEventListener('click', () => selectDate(dateStr));
        calendar.appendChild(dayEl);
    }

    const rendered = firstDay + daysInMonth;
    const remaining = 42 - rendered;
    for (let day = 1; day <= remaining; day += 1) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }
}

async function initAvailabilityCalendar() {
    await refreshAvailabilitySnapshot();
    renderAvailabilityCalendar();
    if (!selectedDate) {
        clearSelectedDateState();
    }
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderAvailabilityCalendar();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderAvailabilityCalendar();
    const date = new Date(dateStr);
    document.getElementById('selectedDate').textContent = date.toLocaleDateString(
        'es-EC',
        {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }
    );
    document.getElementById('addSlotForm').classList.toggle('is-hidden', availabilityReadOnly);
    loadTimeSlots(dateStr);
}

function loadTimeSlots(dateStr) {
    const slots = currentAvailability[dateStr] || [];
    const list = document.getElementById('timeSlotsList');
    if (slots.length === 0) {
        list.innerHTML = '<p class="empty-message">No hay horarios configurados</p>';
        return;
    }

    const encodedDate = encodeURIComponent(String(dateStr || ''));

    list.innerHTML = slots
        .slice()
        .sort()
        .map(
            (time) => `
        <div class="time-slot-item">
            <span class="time">${escapeHtml(time)}</span>
            <div class="slot-actions">
                ${
                    availabilityReadOnly
                        ? '<span class="selected-date">Solo lectura</span>'
                        : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${encodedDate}" data-time="${encodeURIComponent(String(time || ''))}">
                    <i class="fas fa-trash"></i>
                </button>`
                }
            </div>
        </div>
    `
        )
        .join('');
}

async function saveAvailability() {
    if (availabilityReadOnly) {
        throw new Error('Disponibilidad en solo lectura (Google Calendar).');
    }
    await apiRequest('availability', {
        method: 'POST',
        body: { availability: currentAvailability },
    });
}

async function addTimeSlot() {
    if (availabilityReadOnly) {
        showToast('Disponibilidad en solo lectura: gestionala desde Google Calendar.', 'warning');
        return;
    }
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return;
    }
    const time = document.getElementById('newSlotTime').value;
    if (!time) {
        showToast('Ingresa un horario', 'warning');
        return;
    }

    if (!currentAvailability[selectedDate]) {
        currentAvailability[selectedDate] = [];
    }

    if (currentAvailability[selectedDate].includes(time)) {
        showToast('Este horario ya existe', 'warning');
        return;
    }

    try {
        currentAvailability[selectedDate].push(time);
        await saveAvailability();
        loadTimeSlots(selectedDate);
        renderAvailabilityCalendar();
        document.getElementById('newSlotTime').value = '';
        showToast('Horario agregado', 'success');
    } catch (error) {
        showToast(`No se pudo guardar el horario: ${error.message}`, 'error');
    }
}

async function removeTimeSlot(dateStr, time) {
    if (availabilityReadOnly) {
        showToast('Disponibilidad en solo lectura: gestionala desde Google Calendar.', 'warning');
        return;
    }
    try {
        currentAvailability[dateStr] = (currentAvailability[dateStr] || []).filter((t) => t !== time);
        await saveAvailability();
        loadTimeSlots(dateStr);
        renderAvailabilityCalendar();
        showToast('Horario eliminado', 'success');
    } catch (error) {
        showToast(`No se pudo eliminar el horario: ${error.message}`, 'error');
    }
}

/**
 * Renders the specified section of the admin dashboard.
 * Loads the necessary data and updates the UI.
 *
 * @param {string} section - The section ID to render (e.g., 'dashboard', 'appointments').
 */
async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';

    document
        .querySelectorAll('.admin-section')
        .forEach((s) => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments': {
            loadAppointments();
            break;
        }
        case 'callbacks':
            loadCallbacks();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'availability': {
            await initAvailabilityCalendar();
            break;
        }
        default:
            loadDashboardData();
            break;
    }
}

/**
 * Shows the login screen and hides the dashboard.
 */
function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

/**
 * Shows the dashboard and hides the login screen.
 * Initializes data loading and push notifications.
 */
async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    await updateDate();
    await initPushNotifications();
}

/**
 * Handles the login form submission.
 * Supports standard password login and 2FA.
 *
 * @param {Event} event - The form submission event.
 */
async function handleLogin(event) {
    event.preventDefault();

    const group2FA = document.getElementById('group2FA');
    const is2FAMode = group2FA && !group2FA.classList.contains('is-hidden');

    if (is2FAMode) {
        const code = document.getElementById('admin2FACode')?.value || '';
        try {
            const result = await login2FA(code);
            if (result.csrfToken) setCsrfToken(result.csrfToken);
            showToast('Bienvenido al panel de administracion', 'success');
            await showDashboard();
        } catch {
            showToast('Codigo incorrecto o sesion expirada', 'error');
        }
        return;
    }

    const password = document.getElementById('adminPassword')?.value || '';
    try {
        const loginResult = await login(password);

        if (loginResult.twoFactorRequired) {
            document.getElementById('passwordGroup')?.classList.add('is-hidden');
            group2FA?.classList.remove('is-hidden');
            document.getElementById('admin2FACode')?.focus();
            const btn = document.getElementById('loginBtn');
            if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
            showToast('Ingresa tu codigo 2FA', 'info');
            return;
        }

        if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
        showToast('Bienvenido al panel de administracion', 'success');
        await showDashboard();
    } catch {
        showToast('Contrasena incorrecta', 'error');
    }
}

/**
 * Checks authentication status on boot.
 * If authenticated, shows the dashboard; otherwise, shows the login screen.
 * Handles offline mode by loading local data.
 */
async function checkAuthAndBoot() {
    if (!navigator.onLine && getLocalData('appointments', null)) {
        showToast('Modo offline: mostrando datos locales', 'info');
        await showDashboard();
        return;
    }

    const authenticated = await checkAuth();
    if (authenticated) {
        await showDashboard();
        return;
    }
    showLogin();
}

/**
 * Updates the current date display and refreshes the data.
 */
async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    try {
        await refreshData();
    } catch (error) {
        showToast(
            `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
            'warning'
        );
    }
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    await renderSection(section);
}

/**
 * Exports the current application data (appointments, callbacks, reviews, availability) to a JSON file.
 */
function exportData() {
    const payload = {
        appointments: currentAppointments,
        callbacks: currentCallbacks,
        reviews: currentReviews,
        availability: currentAvailability,
        exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Datos exportados correctamente', 'success');
}

/**
 * Imports application data from a JSON file.
 * Replaces existing data with the imported data.
 *
 * @param {HTMLInputElement} input - The file input element containing the JSON file.
 */
async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (
        !confirm(
            'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
        )
    ) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos validos');
        }

        const payload = {
            appointments: Array.isArray(data.appointments)
                ? data.appointments
                : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            availability:
                data.availability && typeof data.availability === 'object'
                    ? data.availability
                    : {},
        };

        await apiRequest('import', {
            method: 'POST',
            body: payload,
        });

        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
        showToast(`Datos importados: ${payload.appointments.length} citas`, 'success');
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

function attachGlobalListeners() {
    document.addEventListener('click', async (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;

        if (action === 'close-toast') {
            actionEl.closest('.toast')?.remove();
            return;
        }

        if (action === 'logout') {
            event.preventDefault();
            await logout();
            return;
        }

        if (action === 'export-data') {
            event.preventDefault();
            exportData();
            return;
        }

        if (action === 'open-import-file') {
            event.preventDefault();
            document.getElementById('importFileInput')?.click();
            return;
        }

        try {
            if (action === 'export-csv') {
                event.preventDefault();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'change-month') {
                event.preventDefault();
                changeMonth(Number(actionEl.dataset.delta || 0));
                return;
            }
            if (action === 'add-time-slot') {
                event.preventDefault();
                await addTimeSlot();
                return;
            }
            if (action === 'remove-time-slot') {
                event.preventDefault();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                return;
            }
            if (action === 'approve-transfer') {
                event.preventDefault();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'reject-transfer') {
                event.preventDefault();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'cancel-appointment') {
                event.preventDefault();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-no-show') {
                event.preventDefault();
                await markNoShow(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-contacted') {
                event.preventDefault();
                await markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
            }
        } catch (error) {
            showToast(`Error ejecutando accion: ${error.message}`, 'error');
        }
    });

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', () => {
            filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchAppointments();
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', filterCallbacks);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    attachGlobalListeners();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
        item.addEventListener('click', async function onNavClick(event) {
            event.preventDefault();
            navItems.forEach((nav) => nav.classList.remove('active'));
            this.classList.add('active');
            try {
                await refreshData();
            } catch (error) {
                showToast(
                    `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            await renderSection(this.dataset.section);
        });
    });

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', () => importData(importFileInput));
    }

    window.addEventListener('online', async () => {
        showToast('Conexion restaurada. Actualizando datos...', 'success');
        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
    });

    await checkAuthAndBoot();
});
