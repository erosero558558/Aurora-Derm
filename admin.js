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
        errorCodeBreakdown: []
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
        timeout: 'Tiempo de espera agotado',
        payment_failed: 'Pago fallido',
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
    if (raw === '') {
        return 'No identificado';
    }
    return raw.replace(/_/g, ' ');
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
            showToast('Notificaciones desactivadas', 'info');
        } else {
            await subscribe();
            showToast('Notificaciones activadas', 'success');
        }
    } catch (error) {
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
        return;
    }

    try {
        await navigator.serviceWorker.register('/sw.js');
        await getPushConfig();
        setButtonsVisibility(true);
        subscribeBtn.addEventListener('click', onToggleSubscription);
        testBtn.addEventListener('click', onTestNotification);
        await checkSubscriptionState();
    } catch (error) {
        setButtonsVisibility(false);
        showToast('Push no configurado en servidor', 'info');
    }
}

// Modulos cargados bajo demanda (code splitting)
function loadAppointmentsModule() {
    return import('./js/admin-chunks/appointments-ScVXm-lJ.js');
}
function loadAvailabilityModule() {
    return import('./js/admin-chunks/availability-AXgzYhjZ.js');
}

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
            const { loadAppointments } = await loadAppointmentsModule();
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
            const { initAvailabilityCalendar } = await loadAvailabilityModule();
            await initAvailabilityCalendar();
            break;
        }
        default:
            loadDashboardData();
            break;
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    await updateDate();
    await initPushNotifications();
}

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

    await refreshData();
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    await renderSection(section);
}

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
                const { exportAppointmentsCSV } = await loadAppointmentsModule();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'change-month') {
                event.preventDefault();
                const { changeMonth } = await loadAvailabilityModule();
                changeMonth(Number(actionEl.dataset.delta || 0));
                return;
            }
            if (action === 'add-time-slot') {
                event.preventDefault();
                const { addTimeSlot } = await loadAvailabilityModule();
                await addTimeSlot();
                return;
            }
            if (action === 'remove-time-slot') {
                event.preventDefault();
                const { removeTimeSlot } = await loadAvailabilityModule();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                return;
            }
            if (action === 'approve-transfer') {
                event.preventDefault();
                const { approveTransfer } = await loadAppointmentsModule();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'reject-transfer') {
                event.preventDefault();
                const { rejectTransfer } = await loadAppointmentsModule();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'cancel-appointment') {
                event.preventDefault();
                const { cancelAppointment } = await loadAppointmentsModule();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-no-show') {
                event.preventDefault();
                const { markNoShow } = await loadAppointmentsModule();
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
        appointmentFilter.addEventListener('change', async () => {
            const { filterAppointments } = await loadAppointmentsModule();
            filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            const { searchAppointments } = await loadAppointmentsModule();
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
            await refreshData();
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

export { apiRequest as a, getDoctorName as b, currentAppointments as c, getStatusText as d, getPaymentStatusText as e, getPaymentMethodText as f, getServiceName as g, escapeHtml as h, formatDate as i, sanitizePublicHref as j, currentAvailability as k, loadDashboardData as l, currentAvailabilityMeta as m, setAvailability as n, setAvailabilityMeta as o, refreshData as r, showToast as s };
