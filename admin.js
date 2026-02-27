let e = [],
    t = [],
    n = [],
    a = {},
    i = {},
    o = null,
    r = null,
    s = [],
    c = null,
    l = '';
function u(t) {
    e = t || [];
}
function d(e) {
    t = e || [];
}
function m(e) {
    n = e || [];
}
function f(e) {
    a = e || {};
}
function p(e) {
    i = e || {};
}
function g(e) {
    o = e;
}
function b(e) {
    r = e || null;
}
function h(e) {
    s = Array.isArray(e) ? e : [];
}
function y(e) {
    c = e && 'object' == typeof e ? e : null;
}
function v(e) {
    l = e;
}
async function S(e, t = {}) {
    const n = {
        method: t.method || 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    };
    (l && t.method && 'GET' !== t.method && (n.headers['X-CSRF-Token'] = l),
        void 0 !== t.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(t.body))));
    const a = await fetch(e, n),
        i = await a.text();
    let o;
    try {
        o = i ? JSON.parse(i) : {};
    } catch (e) {
        throw new Error('Respuesta no valida del servidor');
    }
    if (!a.ok || !1 === o.ok) throw new Error(o.error || `HTTP ${a.status}`);
    return o;
}
async function w(e, t = {}) {
    return S(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function k(e, t = {}) {
    return S(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
function C(e) {
    return null == e
        ? ''
        : String(e)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
function E(e, t = 'info', n = '') {
    const a = document.getElementById('toastContainer');
    if (!a) return;
    const i = document.createElement('div');
    i.className = `toast ${t}`;
    const o = 'error' === t;
    (i.setAttribute('role', o ? 'alert' : 'status'),
        i.setAttribute('aria-live', o ? 'assertive' : 'polite'),
        i.setAttribute('aria-atomic', 'true'));
    const r = {
        success: n || 'Éxito',
        error: n || 'Error',
        warning: n || 'Advertencia',
        info: n || 'Información',
    };
    ((i.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${C(r[t])}</div>\n            <div class="toast-message">${C(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificación">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        a.appendChild(i),
        setTimeout(() => {
            i.parentElement &&
                ((i.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => i.remove(), 300));
        }, 5e3));
}
function $(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function L(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function A(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0 ? 0 : t;
}
function B(e) {
    return (
        {
            consulta: 'Consulta Dermatológica',
            telefono: 'Consulta Telefónica',
            video: 'Video Consulta',
            laser: 'Tratamiento Láser',
            rejuvenecimiento: 'Rejuvenecimiento',
            acne: 'Tratamiento de Acné',
            cancer: 'Detección de Cáncer de Piel',
        }[e] || e
    );
}
function I(e) {
    return (
        {
            rosero: 'Dr. Rosero',
            narvaez: 'Dra. Narváez',
            indiferente: 'Cualquiera disponible',
        }[e] || e
    );
}
function T(e) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            cancelled: 'Cancelada',
            completed: 'Completada',
            no_show: 'No asistió',
            noshow: 'No asistió',
        }[e] || e
    );
}
function q(e) {
    return (
        {
            card: 'Tarjeta',
            transfer: 'Transferencia',
            cash: 'Efectivo',
            unpaid: 'Sin definir',
        }[
            String(e || '')
                .toLowerCase()
                .trim()
        ] ||
        e ||
        'Sin definir'
    );
}
function M(e) {
    return (
        {
            paid: 'Pagado',
            pending_cash: 'Pago en consultorio',
            pending_transfer: 'Transferencia pendiente',
            pending_transfer_review: 'Comprobante por validar',
            pending_gateway: 'Pago en proceso',
            pending: 'Pendiente',
            failed: 'Pago fallido',
        }[
            String(e || '')
                .toLowerCase()
                .trim()
        ] ||
        e ||
        'Pendiente'
    );
}
function N(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function D(e) {
    const t = String(e || '')
        .toLowerCase()
        .trim();
    return 'pending' === t
        ? 'pendiente'
        : 'contacted' === t || 'contactado' === t
          ? 'contactado'
          : 'pendiente';
}
function _(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function x(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
async function H() {
    try {
        const [e, t] = await Promise.all([
                w('data'),
                w('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (u(a), x('appointments', a));
        const i = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: D(e.status) }))
            : [];
        (d(i), x('callbacks', i));
        const o = Array.isArray(n.reviews) ? n.reviews : [];
        (m(o), x('reviews', o));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (f(r), x('availability', r));
        const s =
            n.availabilityMeta && 'object' == typeof n.availabilityMeta
                ? n.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        (p(s), x('availability-meta', s));
        const c = Array.isArray(n.queue_tickets) ? n.queue_tickets : [];
        (h(c), x('queue-tickets', c));
        const l =
            n.queueMeta && 'object' == typeof n.queueMeta ? n.queueMeta : null;
        if (
            (y(l),
            x('queue-meta', l),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            g(n.funnelMetrics);
        else {
            const e = await w('funnel-metrics').catch(() => null);
            e && e.data && 'object' == typeof e.data
                ? g(e.data)
                : g({
                      summary: {
                          viewBooking: 0,
                          startCheckout: 0,
                          bookingConfirmed: 0,
                          checkoutAbandon: 0,
                          startRatePct: 0,
                          confirmedRatePct: 0,
                          abandonRatePct: 0,
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
                              cancelled: 0,
                          },
                          noShowRatePct: 0,
                          completionRatePct: 0,
                          uniquePatients: 0,
                          recurrentPatients: 0,
                          recurrenceRatePct: 0,
                      },
                  });
        }
        t && t.ok ? (b(t), x('health-status', t)) : b(null);
    } catch (e) {
        (u(_('appointments', [])),
            d(_('callbacks', []).map((e) => ({ ...e, status: D(e.status) }))),
            m(_('reviews', [])),
            f(_('availability', {})),
            p(_('availability-meta', {})),
            h(_('queue-tickets', [])),
            y(_('queue-meta', null)),
            g({
                summary: {
                    viewBooking: 0,
                    startCheckout: 0,
                    bookingConfirmed: 0,
                    checkoutAbandon: 0,
                    startRatePct: 0,
                    confirmedRatePct: 0,
                    abandonRatePct: 0,
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
                        cancelled: 0,
                    },
                    noShowRatePct: 0,
                    completionRatePct: 0,
                    uniquePatients: 0,
                    recurrentPatients: 0,
                    recurrenceRatePct: 0,
                },
            }),
            b(_('health-status', null)),
            E(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function F(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
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
            unknown: 'Paso no identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function R(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            booking_form: 'Formulario web',
            chatbot: 'Chatbot',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function P(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            card: 'Tarjeta',
            transfer: 'Transferencia',
            cash: 'Efectivo',
            unpaid: 'Sin definir',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function j(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            web: 'Web',
            booking_form: 'Formulario web',
            chatbot: 'Chatbot',
            admin: 'Panel admin',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function O(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
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
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function U(e) {
    const t = String(e || '')
            .trim()
            .toLowerCase(),
        n = {
            calendar_unreachable: 'Agenda Google no disponible',
            calendar_auth_failed: 'Token Google invalido',
            calendar_token_rejected: 'Token Google rechazado',
            slot_conflict: 'Horario ocupado',
            slot_unavailable: 'Horario ocupado',
            appointment_create_failed: 'Error registrando cita',
            availability_error: 'Error consultando horarios',
            payment_failed: 'Fallo de pago',
            validation_error: 'Error de validacion',
            unknown: 'No identificado',
        };
    if (n[t]) return n[t];
    if ('' === t) return n.unknown;
    const a = t.replace(/_/g, ' ').trim();
    return '' === a ? n.unknown : a.charAt(0).toUpperCase() + a.slice(1);
}
function z(e, t, n, a) {
    const i = document.getElementById(e);
    if (!i) return;
    const o = (function (e) {
        return Array.isArray(e)
            ? e
                  .map((e) => ({
                      label: String(e && e.label ? e.label : 'unknown'),
                      count: A(e && e.count ? e.count : 0),
                  }))
                  .filter((e) => e.count > 0)
                  .sort((e, t) => t.count - e.count)
            : [];
    })(t).slice(0, 6);
    if (0 === o.length)
        return void (i.innerHTML = `<p class="empty-message">${C(a)}</p>`);
    const r = o.reduce((e, t) => e + t.count, 0);
    i.innerHTML = o
        .map((e) => {
            const t = r > 0 ? $((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${C(n(e.label))}</span>\n                <span class="funnel-row-count">${C(L(e.count))} (${C(t)})</span>\n            </div>\n        `;
        })
        .join('');
}
function V(e, t, n = 'muted') {
    e &&
        ((e.className = 'toolbar-chip'),
        'accent' === n
            ? e.classList.add('is-accent')
            : 'warning' === n && e.classList.add('is-warning'),
        (e.textContent = t));
}
function W(e) {
    return `\n        <div class="operations-action-item">\n            <span class="operations-action-icon">\n                <i class="fas ${C(e.icon)}" aria-hidden="true"></i>\n            </span>\n            <div class="operations-action-copy">\n                <span class="operations-action-title">${C(e.title)}</span>\n                <span class="operations-action-meta">${C(e.meta)}</span>\n            </div>\n            <button type="button" class="btn btn-secondary btn-sm" data-action="${C(e.action)}">\n                ${C(e.cta)}\n            </button>\n        </div>\n    `;
}
function K() {
    document.getElementById('totalAppointments').textContent = e.length;
    const a = new Date().toISOString().split('T')[0],
        i = [];
    let s = 0,
        c = 0,
        l = 0;
    for (const t of e) {
        (t.date === a && 'cancelled' !== t.status && i.push(t),
            'pending_transfer_review' === t.paymentStatus && s++);
        const e = t.status || 'confirmed';
        ('confirmed' === e && c++, 'no_show' === e && l++);
    }
    document.getElementById('todayAppointments').textContent = i.length;
    const u = document.getElementById('totalNoShows');
    u && (u.textContent = L(l));
    const d = [];
    for (const e of t) 'pendiente' === D(e.status) && d.push(e);
    document.getElementById('pendingCallbacks').textContent = d.length;
    let m = 0;
    (n.length > 0 &&
        (m = (
            n.reduce((e, t) => e + (Number(t.rating) || 0), 0) / n.length
        ).toFixed(1)),
        (document.getElementById('avgRating').textContent = m),
        (document.getElementById('appointmentsBadge').textContent =
            s > 0 ? `${c} (${s} por validar)` : c),
        (document.getElementById('callbacksBadge').textContent = d.length),
        (document.getElementById('reviewsBadge').textContent = n.length));
    const f = document.getElementById('todayAppointmentsList');
    0 === i.length
        ? (f.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (f.innerHTML = i
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${C(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${C(e.name)}</span>\n                    <span class="service">${C(B(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${C(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${C(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join(''));
    const p = document.getElementById('recentCallbacksList'),
        g = t.slice(-5).reverse();
    (0 === g.length
        ? (p.innerHTML =
              '<p class="empty-message">No hay callbacks pendientes</p>')
        : (p.innerHTML = g
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${C(e.telefono)}</span>\n                    <span class="service">${C(N(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${C(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join('')),
        (function ({
            pendingTransfers: e = 0,
            pendingCallbacks: t = 0,
            todayAppointmentsCount: n = 0,
            confirmedCount: a = 0,
            totalNoShows: i = 0,
        }) {
            const o = document.getElementById('operationPendingReviewCount'),
                r = document.getElementById('operationPendingCallbacksCount'),
                s = document.getElementById('operationTodayLoadCount'),
                c = document.getElementById('operationQueueHealth'),
                l = document.getElementById('operationRefreshSignal'),
                u = document.getElementById('operationActionList');
            if (!(o && r && s && c && l && u)) return;
            ((o.textContent = L(e)),
                (r.textContent = L(t)),
                (s.textContent = L(n)));
            const d = 3 * e + 2 * t + Math.max(0, n - 6) + i;
            (d >= 9
                ? V(c, 'Cola: prioridad alta', 'warning')
                : d >= 4
                  ? V(c, 'Cola: atención recomendada', 'accent')
                  : V(c, 'Cola: estable', 'muted'),
                a <= 0
                    ? V(l, 'Agenda: sin citas confirmadas', 'warning')
                    : n >= 6
                      ? V(l, 'Agenda: demanda alta hoy', 'accent')
                      : V(l, 'Agenda: operación normal', 'muted'));
            const m = [];
            (e > 0 &&
                m.push({
                    icon: 'fa-money-check-dollar',
                    title: 'Transferencias pendientes',
                    meta: `${L(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${L(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${L(n)} cita(s) activas para seguimiento inmediato`,
                        action: 'context-open-appointments-today',
                        cta: 'Abrir',
                    }),
                0 === m.length &&
                    m.push({
                        icon: 'fa-rotate-right',
                        title: 'Sin alertas operativas',
                        meta: 'No hay pendientes críticos en este momento',
                        action: 'refresh-admin-data',
                        cta: 'Actualizar',
                    }),
                (u.innerHTML = m.map(W).join('')));
        })({
            pendingTransfers: s,
            pendingCallbacks: d.length,
            todayAppointmentsCount: i.length,
            confirmedCount: c,
            totalNoShows: l,
        }),
        (function () {
            const e =
                    o && 'object' == typeof o
                        ? o
                        : {
                              summary: {
                                  viewBooking: 0,
                                  startCheckout: 0,
                                  bookingConfirmed: 0,
                                  checkoutAbandon: 0,
                                  startRatePct: 0,
                                  confirmedRatePct: 0,
                                  abandonRatePct: 0,
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
                                      cancelled: 0,
                                  },
                                  noShowRatePct: 0,
                                  completionRatePct: 0,
                                  uniquePatients: 0,
                                  recurrentPatients: 0,
                                  recurrenceRatePct: 0,
                              },
                          },
                t = e.summary && 'object' == typeof e.summary ? e.summary : {},
                n = A(t.viewBooking),
                a = A(t.startCheckout),
                i = A(t.bookingConfirmed),
                s = A(t.checkoutAbandon);
            A(t.startRatePct);
            const c = A(t.confirmedRatePct) || (a > 0 ? (i / a) * 100 : 0),
                l = A(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                u = document.getElementById('funnelViewBooking');
            u && (u.textContent = L(n));
            const d = document.getElementById('funnelStartCheckout');
            d && (d.textContent = L(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = L(i));
            const f = document.getElementById('funnelAbandonRate');
            f && (f.textContent = $(l));
            const p = document.getElementById('checkoutConversionRate');
            p && (p.textContent = $(c));
            const g = A(e.events && e.events.booking_error),
                b = A(e.events && e.events.checkout_error),
                h = a > 0 ? ((g + b) / a) * 100 : 0,
                y = document.getElementById('bookingErrorRate');
            y && (y.textContent = $(h));
            const v = document.getElementById('calendarHealthStatus');
            if (v) {
                const e = r && 'object' == typeof r ? r : null,
                    t =
                        e && e.calendarSource
                            ? String(e.calendarSource)
                            : 'desconocido',
                    n =
                        e && e.calendarMode
                            ? String(e.calendarMode)
                            : 'desconocido',
                    a = !!e && Boolean(e.calendarReachable),
                    i = !!e && Boolean(e.calendarTokenHealthy);
                let o = `Agenda ${t}: ${n}`;
                ('google' === t && (o += a && i ? ' (OK)' : ' (revisar)'),
                    (v.textContent = o));
            }
            document.getElementById('funnelAbandonList') &&
                (z(
                    'funnelAbandonList',
                    e.checkoutAbandonByStep,
                    F,
                    'Sin datos de abandono'
                ),
                z(
                    'funnelEntryList',
                    e.checkoutEntryBreakdown,
                    R,
                    'Sin datos de entrada'
                ),
                z(
                    'funnelPaymentMethodList',
                    e.paymentMethodBreakdown,
                    P,
                    'Sin datos de pago'
                ),
                z(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    j,
                    'Sin datos de origen'
                ),
                z(
                    'funnelAbandonReasonList',
                    e.checkoutAbandonByReason,
                    O,
                    'Sin datos de motivo'
                ),
                z(
                    'funnelStepList',
                    e.bookingStepBreakdown,
                    F,
                    'Sin datos de pasos'
                ),
                z(
                    'funnelErrorCodeList',
                    e.errorCodeBreakdown,
                    U,
                    'Sin datos de error'
                ));
        })());
}
const G = 'all',
    J = 'recent_desc',
    Y = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Q = new Set(['recent_desc', 'waiting_desc']),
    X = { filter: G, search: '', sort: J },
    Z = {
        all: 'Todos',
        pending: 'Pendientes',
        contacted: 'Contactados',
        today: 'Hoy',
        sla_urgent: 'Urgentes SLA',
    },
    ee = { recent_desc: 'Más recientes', waiting_desc: 'Mayor espera (SLA)' };
let te = [];
const ne = new Set();
let ae = !1,
    ie = !1;
function oe() {
    return {
        filterSelect: document.getElementById('callbackFilter'),
        sortSelect: document.getElementById('callbackSort'),
        searchInput: document.getElementById('searchCallbacks'),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="callback-quick-filter"][data-filter-value]'
            )
        ),
        toolbarMeta: document.getElementById('callbacksToolbarMeta'),
        toolbarState: document.getElementById('callbacksToolbarState'),
        clearFiltersBtn: document.getElementById('clearCallbacksFiltersBtn'),
        selectVisibleBtn: document.getElementById(
            'callbacksBulkSelectVisibleBtn'
        ),
        clearSelectionBtn: document.getElementById('callbacksBulkClearBtn'),
        markSelectedBtn: document.getElementById('callbacksBulkMarkBtn'),
        selectedCountEl: document.getElementById('callbacksSelectedCount'),
        selectionChipEl: document.getElementById('callbacksSelectionChip'),
    };
}
function re(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return Y.has(t) ? t : G;
}
function se(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return Q.has(t) ? t : J;
}
function ce(e) {
    const t = Number(e?.id || 0);
    return t > 0
        ? `id:${t}`
        : `fallback:${String(e?.fecha || '').trim()}|${String(e?.telefono || '').trim()}|${String(e?.preferencia || '').trim()}`;
}
function le(e) {
    return 'pendiente' === D(e?.status);
}
function ue() {
    return (
        !!ae ||
        ((ae = (function () {
            const e = document.getElementById('callbacks');
            if (!e) return !1;
            const t = e.querySelector('.section-toolbar-callbacks');
            if (!t) return !1;
            const n = document.getElementById('callbackFilter');
            if (
                n instanceof HTMLSelectElement &&
                !n.querySelector('option[value="sla_urgent"]')
            ) {
                const e = document.createElement('option');
                ((e.value = 'sla_urgent'),
                    (e.textContent = 'Urgentes SLA'),
                    n.appendChild(e));
            }
            let a = document.getElementById('callbackSort');
            if (a instanceof HTMLSelectElement)
                0 === a.options.length &&
                    Object.entries(ee).forEach(([e, t]) => {
                        const n = document.createElement('option');
                        ((n.value = e), (n.textContent = t), a.appendChild(n));
                    });
            else {
                const e = document.createElement('div');
                e.className = 'filter-group callbacks-sort-group';
                const n = document.createElement('label');
                ((n.className = 'sr-only'),
                    (n.htmlFor = 'callbackSort'),
                    (n.textContent = 'Orden de callbacks'),
                    (a = document.createElement('select')),
                    (a.id = 'callbackSort'),
                    Object.entries(ee).forEach(([e, t]) => {
                        const n = document.createElement('option');
                        ((n.value = e), (n.textContent = t), a.appendChild(n));
                    }),
                    (a.value = X.sort),
                    e.appendChild(n),
                    e.appendChild(a));
                const i = t.querySelector('.callbacks-quick-filters');
                i ? t.insertBefore(e, i) : t.appendChild(e);
            }
            const i = t.querySelector('.callbacks-quick-filters');
            if (i && !i.querySelector('[data-filter-value="sla_urgent"]')) {
                const e = document.createElement('button');
                ((e.type = 'button'),
                    (e.className = 'callback-quick-filter-btn'),
                    (e.dataset.action = 'callback-quick-filter'),
                    (e.dataset.filterValue = 'sla_urgent'),
                    e.setAttribute('aria-pressed', 'false'),
                    (e.title = 'Pendientes con espera mayor a 2 horas'),
                    (e.textContent = 'Urgentes SLA'),
                    i.appendChild(e));
            }
            const o = e.querySelector('.callbacks-ops-actions');
            if (o) {
                if (!document.getElementById('callbacksBulkSelectVisibleBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkSelectVisibleBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-list-check"></i> Seleccionar visibles'),
                        o.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkClearBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkClearBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-eraser"></i> Limpiar selección'),
                        o.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkMarkBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-primary btn-sm'),
                        (e.id = 'callbacksBulkMarkBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-check-double"></i> Marcar seleccionados'),
                        o.appendChild(e));
                }
            }
            return !0;
        })()),
        ae)
    );
}
function de(e) {
    const t = oe(),
        n = e.filter((e) => le(e)).length,
        a = e.filter((e) => le(e) && ne.has(ce(e))).length,
        i = a > 0;
    (t.selectedCountEl && (t.selectedCountEl.textContent = String(a)),
        t.selectionChipEl &&
            t.selectionChipEl.classList.toggle('is-hidden', !i),
        t.selectVisibleBtn instanceof HTMLButtonElement &&
            (t.selectVisibleBtn.disabled = 0 === n),
        t.clearSelectionBtn instanceof HTMLButtonElement &&
            (t.clearSelectionBtn.disabled = !i),
        t.markSelectedBtn instanceof HTMLButtonElement &&
            (t.markSelectedBtn.disabled = !i));
}
function me(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function fe(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t;
}
function pe(e) {
    const t = fe(e);
    if (!t) return 0;
    const n = Date.now() - t.getTime();
    return Number.isFinite(n) ? Math.max(0, Math.round(n / 6e4)) : 0;
}
function ge(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 'recién';
    if (t < 60) return `${t} min`;
    const n = Math.floor(t / 60),
        a = t % 60;
    return 0 === a ? `${n} h` : `${n} h ${a} min`;
}
function be(e, t = J) {
    const n = [...e];
    return 'waiting_desc' === se(t)
        ? n.sort((e, t) => {
              const n = le(e),
                  a = le(t);
              if (n !== a) return n ? -1 : 1;
              const i = n ? pe(e.fecha) : 0,
                  o = a ? pe(t.fecha) : 0;
              if (o !== i) return o - i;
              const r = fe(e.fecha),
                  s = fe(t.fecha);
              return (r ? r.getTime() : 0) - (s ? s.getTime() : 0);
          })
        : n.sort((e, t) => {
              const n = fe(e.fecha),
                  a = fe(t.fecha),
                  i = n ? n.getTime() : 0;
              return (a ? a.getTime() : 0) - i;
          });
}
function he() {
    if (ie) return;
    const e = document.getElementById('callbacksGrid');
    if (!e) return;
    const n = oe();
    (n.sortSelect instanceof HTMLSelectElement &&
        n.sortSelect.addEventListener('change', () => {
            ve({
                filter: X.filter,
                search: X.search,
                sort: n.sortSelect.value || J,
            });
        }),
        n.selectVisibleBtn instanceof HTMLButtonElement &&
            n.selectVisibleBtn.addEventListener('click', () => {
                !(function () {
                    const e = te.filter((e) => le(e));
                    0 !== e.length
                        ? (e.forEach((e) => {
                              ne.add(ce(e));
                          }),
                          ve({
                              filter: X.filter,
                              search: X.search,
                              sort: X.sort,
                          }))
                        : E(
                              'No hay callbacks pendientes visibles para seleccionar.',
                              'info'
                          );
                })();
            }),
        n.clearSelectionBtn instanceof HTMLButtonElement &&
            n.clearSelectionBtn.addEventListener('click', () => {
                (ne.clear(),
                    de(te),
                    ve({ filter: X.filter, search: X.search, sort: X.sort }));
            }),
        n.markSelectedBtn instanceof HTMLButtonElement &&
            n.markSelectedBtn.addEventListener('click', () => {
                !(async function () {
                    const e =
                        0 === ne.size
                            ? []
                            : t.filter((e) => le(e) && ne.has(ce(e)));
                    if (0 === e.length)
                        return void E(
                            'No hay callbacks seleccionados para actualizar.',
                            'info'
                        );
                    let n = 0,
                        a = 0;
                    for (const t of e)
                        try {
                            let e = Number(t.id || 0);
                            (e <= 0 && ((e = Date.now() + n), (t.id = e)),
                                await w('callbacks', {
                                    method: 'PATCH',
                                    body: {
                                        id: Number(e),
                                        status: 'contactado',
                                    },
                                }),
                                (n += 1));
                        } catch (e) {
                            a += 1;
                        }
                    n <= 0
                        ? E(
                              'No se pudieron actualizar los callbacks seleccionados.',
                              'error'
                          )
                        : (await H(),
                          ne.clear(),
                          ve({
                              filter: X.filter,
                              sort: X.sort,
                              search: X.search,
                          }),
                          K(),
                          a > 0
                              ? E(`Actualizados ${n}; con error ${a}.`, 'info')
                              : E(
                                    `Marcados ${n} callbacks como contactados.`,
                                    'success'
                                ));
                })();
            }),
        e.addEventListener('change', (e) => {
            const t = e.target;
            t instanceof HTMLInputElement &&
                t.matches('input[data-callback-select-key]') &&
                (function (e, t) {
                    const n = (function (e) {
                        if (!e) return '';
                        try {
                            return decodeURIComponent(String(e));
                        } catch (t) {
                            return String(e);
                        }
                    })(e);
                    n && (t ? ne.add(n) : ne.delete(n), de(te));
                })(t.dataset.callbackSelectKey || '', t.checked);
        }),
        (ie = !0));
}
function ye() {
    ve({
        filter: oe().filterSelect?.value || G,
        sort: oe().sortSelect?.value || X.sort,
    });
}
function ve(e, { preserveSearch: n = !0 } = {}) {
    (ue(), he());
    const a = oe(),
        i = a.searchInput?.value ?? X.search,
        o = a.sortSelect?.value ?? X.sort,
        r = n ? (e.search ?? i) : (e.search ?? ''),
        s = (function (e) {
            const n = {
                    filter: re(e.filter),
                    search: String(e.search || '')
                        .trim()
                        .toLowerCase(),
                    sort: se(e.sort),
                },
                a = me(new Date());
            return {
                filtered: be(
                    t.filter((e) => {
                        const t = D(e.status),
                            i = fe(e.fecha),
                            o = i ? me(i) : '';
                        return (
                            ('pending' !== n.filter || 'pendiente' === t) &&
                            ('contacted' !== n.filter || 'contactado' === t) &&
                            ('today' !== n.filter || o === a) &&
                            !(
                                'sla_urgent' === n.filter &&
                                (!le(e) || pe(e.fecha) < 120)
                            ) &&
                            ('' === n.search ||
                                [e.telefono, e.preferencia, e.fecha, t]
                                    .map((e) => String(e || '').toLowerCase())
                                    .join(' ')
                                    .includes(n.search))
                        );
                    }),
                    n.sort
                ),
                criteria: n,
            };
        })({
            filter: e.filter ?? a.filterSelect?.value ?? X.filter,
            sort: e.sort ?? o,
            search: r,
        });
    ((X.filter = s.criteria.filter),
        (X.sort = s.criteria.sort),
        (X.search = s.criteria.search),
        (te = s.filtered),
        (function (e) {
            const t = new Set(e.filter((e) => le(e)).map((e) => ce(e)));
            Array.from(ne).forEach((e) => {
                t.has(e) || ne.delete(e);
            });
        })(s.filtered),
        (function (e) {
            (ue(), he());
            const t = document.getElementById('callbacksGrid');
            t &&
                (0 !== e.length
                    ? (t.innerHTML = e
                          .map((e) => {
                              const t = D(e.status),
                                  n = Number(e.id) || 0,
                                  a = encodeURIComponent(String(e.fecha || '')),
                                  i = String(e.fecha || ''),
                                  o = ce(e),
                                  r = encodeURIComponent(o),
                                  s = fe(i)?.getTime() || 0,
                                  c = pe(i),
                                  l = 'pendiente' === t,
                                  u = l && ne.has(o),
                                  d =
                                      c >= 120
                                          ? 'is-warning'
                                          : c >= 45
                                            ? 'is-accent'
                                            : 'is-muted';
                              return `\n            <div class="callback-card ${t}${u ? ' is-selected' : ''}" data-callback-status="${t}" data-callback-id="${n}" data-callback-key="${C(r)}" data-callback-date="${C(a)}" data-callback-ts="${C(String(s))}">\n                <div class="callback-header">\n                    <span class="callback-phone">${C(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${C(N(e.preferencia))}\n                </span>\n                ${l ? `<label class="toolbar-chip callback-select-chip"><input type="checkbox" data-callback-select-key="${C(r)}" ${u ? 'checked' : ''} /> Seleccionar</label>` : ''}\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${C(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                ${l ? `<span class="toolbar-chip callback-wait-chip ${d}">En cola: ${C(ge(c))}</span>` : ''}\n                <div class="callback-actions">\n                    <a href="tel:${C(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${C(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${l ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                          })
                          .join(''))
                    : (t.innerHTML =
                          '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n                </div>\n        '));
        })(s.filtered),
        (function (e, t, n) {
            const a = oe(),
                {
                    toolbarMeta: i,
                    toolbarState: o,
                    clearFiltersBtn: r,
                    quickFilterButtons: s,
                    filterSelect: c,
                    sortSelect: l,
                    searchInput: u,
                } = a,
                d = e.length,
                m = t.length,
                f = e.filter((e) => 'pendiente' === D(e.status)).length,
                p = e.filter((e) => 'contactado' === D(e.status)).length;
            i &&
                (i.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${C(String(d))}${m !== d ? ` de ${C(String(m))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${C(String(f))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${C(String(p))}</span>`,
                    '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
                ].join(''));
            const g = n.filter !== G,
                b = '' !== n.search,
                h = n.sort !== J;
            if (o)
                if (g || b || h) {
                    const e = [
                        '<span class="toolbar-state-label">Criterios activos:</span>',
                    ];
                    (g &&
                        e.push(
                            `<span class="toolbar-state-value">${C(Z[n.filter] || n.filter)}</span>`
                        ),
                        b &&
                            e.push(
                                `<span class="toolbar-state-value is-search">Busqueda: ${C(n.search)}</span>`
                            ),
                        h &&
                            e.push(
                                `<span class="toolbar-state-value is-sort">Orden: ${C(ee[n.sort] || n.sort)}</span>`
                            ),
                        e.push(
                            `<span class="toolbar-state-value">Resultados: ${C(String(d))}</span>`
                        ),
                        (o.innerHTML = e.join('')));
                } else
                    o.innerHTML =
                        '<span class="toolbar-state-empty">Sin filtros activos</span>';
            var y, v;
            (r && r.classList.toggle('is-hidden', !g && !b && !h),
                c && (c.value = n.filter),
                l && (l.value = n.sort),
                u && (u.value = n.search),
                (y = s),
                (v = n.filter),
                y.forEach((e) => {
                    const t = e.dataset.filterValue === v;
                    (e.classList.toggle('is-active', t),
                        e.setAttribute('aria-pressed', String(t)));
                }));
        })(s.filtered, t, s.criteria),
        de(s.filtered),
        (function (e) {
            const t = document.getElementById('callbacksOpsQueueHealth'),
                n = document.getElementById('callbacksOpsPendingCount'),
                a = document.getElementById('callbacksOpsUrgentCount'),
                i = document.getElementById('callbacksOpsTodayCount'),
                o = document.getElementById('callbacksOpsNext'),
                r = document.getElementById('callbacksOpsNextBtn');
            if (!(t && n && a && i && o)) return;
            const s =
                ((c = e),
                (Array.isArray(c) ? c : [])
                    .filter((e) => 'pendiente' === D(e.status))
                    .map((e) => ({ callback: e, minutesWaiting: pe(e.fecha) }))
                    .sort((e, t) => {
                        if (t.minutesWaiting !== e.minutesWaiting)
                            return t.minutesWaiting - e.minutesWaiting;
                        const n = fe(e.callback.fecha),
                            a = fe(t.callback.fecha);
                        return (n ? n.getTime() : 0) - (a ? a.getTime() : 0);
                    }));
            var c;
            const l = s.length,
                u = s.filter((e) => e.minutesWaiting >= 120).length,
                d = s.filter((e) => e.minutesWaiting >= 45).length,
                m = me(new Date()),
                f = s.filter((e) => {
                    const t = fe(e.callback.fecha);
                    return !!t && me(t) === m;
                }).length;
            ((n.textContent = C(String(l))),
                (a.textContent = C(String(u))),
                (i.textContent = C(String(f))),
                (t.className = 'toolbar-chip'),
                u > 0 || l >= 8
                    ? (t.classList.add('is-warning'),
                      (t.textContent = 'Cola: prioridad alta'))
                    : d >= 2 || l >= 3
                      ? (t.classList.add('is-accent'),
                        (t.textContent = 'Cola: atención requerida'))
                      : (t.classList.add('is-muted'),
                        (t.textContent = 'Cola: estable')));
            const p = s[0] || null;
            if (!p)
                return (
                    (o.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = fe(p.callback.fecha),
                b = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((o.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${C(p.callback.telefono || 'Sin teléfono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${C(ge(p.minutesWaiting))} | Preferencia: ${C(N(p.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${C(b)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function Se(e, { preserveSearch: t = !0 } = {}) {
    ve({ filter: e }, { preserveSearch: t });
}
function we() {
    ve({ search: oe().searchInput?.value || '' });
}
function ke() {
    const e = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    if (0 === e.length)
        return (E('No hay callbacks pendientes para priorizar.', 'info'), !1);
    const t = e.sort((e, t) => {
            const n = Number(e.getAttribute('data-callback-ts') || 0),
                a = Number(t.getAttribute('data-callback-ts') || 0);
            return Number.isFinite(n) && Number.isFinite(a) && n !== a
                ? n - a
                : 0;
        })[0],
        n = t.querySelector('a[href^="tel:"]');
    return n instanceof HTMLElement
        ? (t.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          n.focus({ preventScroll: !0 }),
          !0)
        : (t.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          t.focus?.(),
          !0);
}
let Ce = !1;
function Ee(e, t = 'muted') {
    const n = document.getElementById('pushStatusIndicator');
    n &&
        (n.classList.remove(
            'status-pill-muted',
            'status-pill-ok',
            'status-pill-warn',
            'status-pill-error'
        ),
        n.classList.add(`status-pill-${t}`),
        (n.textContent = `Push: ${e}`));
}
function $e(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function Le() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function Ae(e) {
    const { subscribeBtn: t, testBtn: n } = Le();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Be(e) {
    const { subscribeBtn: t } = Le();
    if (t) {
        if (e)
            return (
                (t.dataset.action = 'unsubscribe'),
                t.classList.remove('btn-primary'),
                t.classList.add('btn-secondary'),
                void (t.innerHTML =
                    '<i class="fas fa-bell-slash"></i> Desactivar Notificaciones')
            );
        ((t.dataset.action = 'subscribe'),
            t.classList.remove('btn-secondary'),
            t.classList.add('btn-primary'),
            (t.innerHTML =
                '<i class="fas fa-bell"></i> Activar Notificaciones'));
    }
}
async function Ie() {
    const e = await w('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Te() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Be(Boolean(t)),
        Ee(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function qe() {
    const { subscribeBtn: e } = Le();
    if (!e) return;
    const t = String(e.dataset.action || 'subscribe'),
        n = e.innerHTML;
    ((e.disabled = !0),
        (e.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...'));
    try {
        'unsubscribe' === t
            ? (await (async function () {
                  const e = await navigator.serviceWorker.ready,
                      t = await e.pushManager.getSubscription();
                  t &&
                      (await w('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              Ee('disponible', 'muted'),
              E('Notificaciones desactivadas', 'info'))
            : (await (async function () {
                  if ('granted' !== (await Notification.requestPermission()))
                      throw new Error('Permiso de notificaciones denegado');
                  const e = await Ie(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: $e(e),
                  });
                  return (
                      await w('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              Ee('activo', 'ok'),
              E('Notificaciones activadas', 'success'));
    } catch (e) {
        (Ee('error', 'error'),
            E(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await Te().catch(() => {
                Be(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function Me() {
    const { testBtn: e } = Le();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await w('push-test', { method: 'POST', body: {} })).result ||
                {},
            t = Number(e.success || 0),
            n = Number(e.failed || 0);
        n > 0
            ? E(`Push test: ${t} ok, ${n} fallidos`, 'warning')
            : E(`Push test enviado (${t})`, 'success');
    } catch (e) {
        E(`Push test: ${e.message || 'error'}`, 'error');
    } finally {
        (t && (t.className = n), (e.disabled = !1));
    }
}
const Ne = 'themeMode',
    De = new Set(['light', 'dark', 'system']);
let _e = 'system',
    xe = null,
    He = !1,
    Fe = !1,
    Re = null;
function Pe() {
    return (
        xe ||
            'function' != typeof window.matchMedia ||
            (xe = window.matchMedia('(prefers-color-scheme: dark)')),
        xe
    );
}
function je(e) {
    return De.has(String(e || '').trim());
}
function Oe() {
    try {
        const e = localStorage.getItem(Ne) || 'system';
        return je(e) ? e : 'system';
    } catch (e) {
        return 'system';
    }
}
function Ue(e) {
    const t = document.documentElement;
    if (!t) return;
    const n = (function (e) {
        return 'system' !== e ? e : Pe()?.matches ? 'dark' : 'light';
    })(e);
    (t.setAttribute('data-theme-mode', e), t.setAttribute('data-theme', n));
}
function ze() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((e) => {
            const t = e.dataset.themeMode === _e;
            (e.classList.toggle('is-active', t),
                e.setAttribute('aria-pressed', String(t)));
        });
}
function Ve(e, { persist: t = !1, animate: n = !1 } = {}) {
    const a = je(e) ? e : 'system';
    ((_e = a),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(Ne, e);
                } catch (e) {}
            })(a),
        n &&
            document.body &&
            (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
                (Re && clearTimeout(Re),
                document.body.classList.remove('theme-transition'),
                document.body.offsetWidth,
                document.body.classList.add('theme-transition'),
                (Re = setTimeout(() => {
                    document.body?.classList.remove('theme-transition');
                }, 220)))),
        Ue(a),
        ze());
}
function We() {
    'system' === _e && (Ue('system'), ze());
}
function Ke(e) {
    (e?.key && e.key !== Ne) ||
        Ve(
            'string' == typeof e?.newValue && je(e.newValue)
                ? e.newValue
                : Oe(),
            { persist: !1, animate: !1 }
        );
}
const Ge = 'admin-appointments-sort',
    Je = 'admin-appointments-density',
    Ye = 'datetime_desc',
    Qe = 'comfortable',
    Xe = 'all',
    Ze = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
    et = new Set(['comfortable', 'compact']),
    tt = new Set([
        'all',
        'today',
        'upcoming_48h',
        'week',
        'month',
        'confirmed',
        'cancelled',
        'no_show',
        'pending_transfer',
        'triage_attention',
    ]);
function nt(e) {
    const t = String(e?.date || '').trim();
    if (!t) return null;
    const n = String(e?.time || '00:00').trim() || '00:00',
        a = new Date(`${t}T${n}:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function at() {
    return {
        filterSelect: document.getElementById('appointmentFilter'),
        sortSelect: document.getElementById('appointmentSort'),
        searchInput: document.getElementById('searchAppointments'),
        stateRow: document.getElementById('appointmentsToolbarState'),
        clearBtn: document.getElementById('clearAppointmentsFiltersBtn'),
        appointmentsSection: document.getElementById('appointments'),
        densityButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
        ),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-quick-filter"][data-filter-value]'
            )
        ),
    };
}
function it(e) {
    const t = String(e || '').trim();
    return tt.has(t) ? t : Xe;
}
function ot(e) {
    const t = String(e || '').trim();
    return Ze.has(t) ? t : Ye;
}
function rt(e) {
    const t = String(e || '').trim();
    return et.has(t) ? t : Qe;
}
function st(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ct(e) {
    const t = rt(e),
        { appointmentsSection: n } = at();
    (n?.classList.toggle('appointments-density-compact', 'compact' === t),
        (function (e) {
            const t = rt(e),
                { densityButtons: n } = at();
            n.forEach((e) => {
                const n = e.dataset.density === t;
                (e.classList.toggle('is-active', n),
                    e.setAttribute('aria-pressed', n ? 'true' : 'false'));
            });
        })(t));
}
function lt(e, t = new Date()) {
    const n = String(e?.paymentStatus || ''),
        a = String(e?.status || 'confirmed'),
        i = 'noshow' === a ? 'no_show' : a,
        o = (function (e, t = new Date()) {
            const n = nt(e);
            return n
                ? (n.getTime() - t.getTime()) / 36e5
                : Number.POSITIVE_INFINITY;
        })(e, t),
        r = 'pending_transfer_review' === n,
        s = 'no_show' === i,
        c = 'completed' === i,
        l = !(c || 'cancelled' === i || s),
        u = l && Number.isFinite(o) && o < -2,
        d = l && Number.isFinite(o) && o >= -2 && o <= 24,
        m = nt(e),
        f =
            s && m
                ? (t.getTime() - m.getTime()) / 864e5
                : Number.POSITIVE_INFINITY,
        p = s && Number.isFinite(f) && f >= 0 && f <= 7;
    let g = 8;
    r
        ? (g = 0)
        : u
          ? (g = 1)
          : d
            ? (g = 2)
            : p
              ? (g = 3)
              : 'confirmed' === i
                ? (g = 4)
                : 'pending' === i
                  ? (g = 5)
                  : s
                    ? (g = 6)
                    : c && (g = 7);
    const b = [];
    return (
        r && b.push({ tone: 'is-warning', label: 'Validar pago' }),
        u
            ? b.push({ tone: 'is-warning', label: 'Atrasada' })
            : d && b.push({ tone: 'is-accent', label: 'Proxima <24h' }),
        p && b.push({ tone: 'is-muted', label: 'Reagendar no-show' }),
        {
            status: i,
            isPendingTransfer: r,
            isOverdue: u,
            isImminent: d,
            requiresNoShowFollowUp: p,
            priorityScore: g,
            hoursUntil: o,
            badges: b,
        }
    );
}
function ut(e) {
    return lt(e).priorityScore;
}
function dt() {
    !(function () {
        const e = document.getElementById('appointmentFilter');
        if (
            e instanceof HTMLSelectElement &&
            !e.querySelector('option[value="triage_attention"]')
        ) {
            const t = document.createElement('option');
            ((t.value = 'triage_attention'),
                (t.textContent = 'Triage accionable'),
                e.appendChild(t));
        }
        const t = document.querySelector('.appointments-quick-filters');
        if (t && !t.querySelector('[data-filter-value="triage_attention"]')) {
            const e = document.createElement('button');
            ((e.type = 'button'),
                (e.className = 'appointment-quick-filter-btn'),
                (e.dataset.action = 'appointment-quick-filter'),
                (e.dataset.filterValue = 'triage_attention'),
                e.setAttribute('aria-pressed', 'false'),
                (e.title = 'Citas con accion prioritaria'),
                (e.textContent = 'Triage'),
                t.appendChild(e));
        }
    })();
    const t = (function () {
        const { filterSelect: e, sortSelect: t, searchInput: n } = at();
        return {
            filter: it(e?.value || Xe),
            sort: ot(t?.value || Ye),
            search: String(n?.value || '').trim(),
        };
    })();
    !(function (e) {
        const t = it(e),
            { quickFilterButtons: n } = at();
        n.forEach((e) => {
            const n = e.dataset.filterValue === t;
            (e.classList.toggle('is-active', n),
                e.setAttribute('aria-pressed', n ? 'true' : 'false'));
        });
    })(t.filter);
    const n = (function (e, t) {
        const n = Array.isArray(e) ? e : [],
            a = String(t || '')
                .trim()
                .toLowerCase();
        return a
            ? n.filter(
                  (e) =>
                      String(e.name || '')
                          .toLowerCase()
                          .includes(a) ||
                      String(e.email || '')
                          .toLowerCase()
                          .includes(a) ||
                      String(e.phone || '').includes(a)
              )
            : [...n];
    })(
        (function (e, t) {
            const n = Array.isArray(e) ? e : [],
                a = it(t);
            let i = [...n];
            const o = new Date(),
                r = (function (e) {
                    const t = e instanceof Date ? e : new Date(e);
                    return Number.isNaN(t.getTime())
                        ? ''
                        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                })(o),
                s = new Date(o);
            s.setHours(s.getHours() + 48);
            const c = (function () {
                    const e = new Date(),
                        t = new Date(e);
                    t.setDate(e.getDate() - e.getDay());
                    const n = new Date(t);
                    return (
                        n.setDate(t.getDate() + 6),
                        {
                            start: t.toISOString().split('T')[0],
                            end: n.toISOString().split('T')[0],
                        }
                    );
                })(),
                l = o.getMonth();
            switch (a) {
                case 'today':
                    i = i.filter((e) => e.date === r);
                    break;
                case 'upcoming_48h':
                    i = i.filter((e) => {
                        const t = nt(e);
                        if (!t) return !1;
                        const n = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== n &&
                            'completed' !== n &&
                            t >= o &&
                            t <= s
                        );
                    });
                    break;
                case 'week':
                    i = i.filter((e) => e.date >= c.start && e.date <= c.end);
                    break;
                case 'month':
                    i = i.filter((e) => new Date(e.date).getMonth() === l);
                    break;
                case 'confirmed':
                case 'cancelled':
                case 'no_show':
                    i = i.filter((e) => (e.status || 'confirmed') === a);
                    break;
                case 'pending_transfer':
                    i = i.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    );
                    break;
                case 'triage_attention':
                    i = i.filter((e) => {
                        const t = lt(e, o);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    });
            }
            return i;
        })(e, t.filter),
        t.search
    );
    (!(function (t, n = {}) {
        const a = document.getElementById('appointmentsTableBody');
        if (!a) return;
        if (
            ((function (t) {
                const n = document.getElementById('appointmentsToolbarMeta');
                if (!n) return;
                const a = Array.isArray(t) ? t : [],
                    i = Array.isArray(e) ? e : [],
                    o = a.length,
                    r = i.length,
                    s = a.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    ).length,
                    c = (function (e) {
                        const t = new Date().toISOString().split('T')[0];
                        return e.filter((e) => e.date === t).length;
                    })(a),
                    l = a.filter((e) => {
                        const t = lt(e);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    }).length,
                    u = a.filter((e) => {
                        const t = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== t &&
                            'completed' !== t &&
                            'no_show' !== t &&
                            'noshow' !== t
                        );
                    }).length,
                    d = [
                        `<span class="toolbar-chip is-accent">Mostrando ${C(String(o))}${r !== o ? ` de ${C(String(r))}` : ''}</span>`,
                        `<span class="toolbar-chip">Hoy: ${C(String(c))}</span>`,
                        `<span class="toolbar-chip">Accionables: ${C(String(u))}</span>`,
                    ];
                (s > 0 &&
                    d.push(
                        `<span class="toolbar-chip is-warning">Por validar: ${C(String(s))}</span>`
                    ),
                    l > 0 &&
                        d.push(
                            `<span class="toolbar-chip is-accent">Triage: ${C(String(l))}</span>`
                        ),
                    (n.innerHTML = d.join('')));
            })(t),
            0 === t.length)
        )
            return void (a.innerHTML =
                '\n            <tr class="table-empty-row">\n                <td colspan="8">\n                    <div class="table-empty-state">\n                        <i class="fas fa-calendar-check" aria-hidden="true"></i>\n                        <strong>No hay citas registradas</strong>\n                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>\n                    </div>\n                </td>\n            </tr>\n        ');
        const i = (function (e, t) {
            const n = ot(t),
                a = Array.isArray(e) ? [...e] : [],
                i = (e, t) => {
                    const n = `${String(e?.date || '')} ${String(e?.time || '')}`,
                        a = `${String(t?.date || '')} ${String(t?.time || '')}`;
                    return n.localeCompare(a);
                };
            return a.sort((e, t) => {
                if ('patient_az' === n) {
                    const n = String(e?.name || '').toLocaleLowerCase('es'),
                        a = String(t?.name || '').toLocaleLowerCase('es'),
                        o = n.localeCompare(a, 'es');
                    return 0 !== o ? o : i(e, t);
                }
                if ('datetime_asc' === n) return i(e, t);
                if ('triage' === n) {
                    const n = ut(e) - ut(t);
                    if (0 !== n) return n;
                    const a = lt(e),
                        o = lt(t);
                    return a.hoursUntil !== o.hoursUntil
                        ? a.hoursUntil - o.hoursUntil
                        : i(e, t);
                }
                return -i(e, t);
            });
        })(t, n?.sort || Ye);
        a.innerHTML = i
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    i = 'cancelled' === t,
                    o = 'no_show' === t || 'noshow' === t,
                    r = lt(e),
                    s = [
                        'appointment-row',
                        a ? 'is-payment-review' : '',
                        i ? 'is-cancelled' : '',
                        o ? 'is-noshow' : '',
                        r.isPendingTransfer ||
                        r.isOverdue ||
                        r.isImminent ||
                        r.requiresNoShowFollowUp
                            ? 'is-triage-attention'
                            : '',
                    ]
                        .filter(Boolean)
                        .join(' '),
                    c = e.doctorAssigned
                        ? `<br><small>Asignado: ${C(I(e.doctorAssigned))}</small>`
                        : '',
                    l = e.transferReference
                        ? `<br><small>Ref: ${C(e.transferReference)}</small>`
                        : '',
                    u = (function (e) {
                        const t = String(e || '').trim();
                        return '' === t
                            ? ''
                            : t.startsWith('/') || /^https?:\/\//i.test(t)
                              ? t
                              : '';
                    })(e.transferProofUrl),
                    d = u
                        ? `<br><a class="appointment-proof-link" href="${C(u)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> Ver comprobante</a>`
                        : '',
                    m = String(e.phone || '').replace(/\D/g, ''),
                    f = r.badges
                        .map(
                            (e) =>
                                `<span class="toolbar-chip ${C(e.tone)}">${C(e.label)}</span>`
                        )
                        .join(''),
                    p = r.isPendingTransfer
                        ? `Hola ${String(e.name || '').trim()}, estamos validando tu comprobante de pago para la cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()}.`
                        : r.isOverdue
                          ? `Hola ${String(e.name || '').trim()}, notamos que tu cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()} quedo pendiente. Te ayudamos a reprogramar.`
                          : r.requiresNoShowFollowUp
                            ? `Hola ${String(e.name || '').trim()}, podemos ayudarte a reagendar tu consulta cuando te convenga.`
                            : '',
                    g = `https://wa.me/${encodeURIComponent(m)}${p ? `?text=${encodeURIComponent(p)}` : ''}`;
                return `\n        <tr class="${s}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${C(e.name)}</strong><br>\n                <small>${C(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${C(String(e.phone || 'Sin telefono'))}</span>\n                    ${f}\n                </div>\n            </td>\n            <td data-label="Servicio">${C(B(e.service))}</td>\n            <td data-label="Doctor">${C(I(e.doctor))}${c}</td>\n            <td data-label="Fecha">${C(
                    (function (e) {
                        const t = new Date(e);
                        return Number.isNaN(t.getTime())
                            ? e
                            : t.toLocaleDateString('es-EC', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                              });
                    })(e.date)
                )}</td>\n            <td data-label="Hora">${C(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${C(e.price || '$0.00')}</strong>\n                <small>${C(q(e.paymentMethod))} - ${C(M(n))}</small>\n                ${l}\n                ${d}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${C(t)}">\n                    ${C(T(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${C(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${C(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${C(g)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="${C(r.isPendingTransfer ? 'WhatsApp para validar pago' : r.isOverdue ? 'WhatsApp para reprogramar cita atrasada' : r.requiresNoShowFollowUp ? 'WhatsApp para seguimiento no-show' : 'WhatsApp')}" aria-label="Abrir WhatsApp de ${C(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = at();
            if (!n) return;
            const i = it(e?.filter || Xe),
                o = ot(e?.sort || Ye),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = at();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = i !== Xe,
                l = r.length > 0,
                u = o !== Ye || s !== Qe;
            if (
                (a &&
                    (a.classList.toggle('is-hidden', !c && !l),
                    (a.disabled = !c && !l)),
                !c && !l && !u)
            )
                return void (n.innerHTML =
                    '<span class="toolbar-state-empty">Sin filtros activos</span>');
            const d = Array.isArray(t) ? t.length : 0,
                m = [
                    `<span class="toolbar-state-label">${c || l ? 'Criterios activos:' : 'Vista activa:'}</span>`,
                ];
            (c &&
                m.push(
                    `<span class="toolbar-state-value is-filter">Filtro: ${C(
                        (function (e) {
                            const t = {
                                all: 'Todas las citas',
                                today: 'Hoy',
                                upcoming_48h: 'Proximas 48h',
                                week: 'Esta semana',
                                month: 'Este mes',
                                confirmed: 'Confirmadas',
                                cancelled: 'Canceladas',
                                no_show: 'No asistio',
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                            };
                            return t[String(e || Xe)] || t.all;
                        })(i)
                    )}</span>`
                ),
                l &&
                    m.push(
                        `<span class="toolbar-state-value is-search">Busqueda: ${C(r)}</span>`
                    ),
                m.push(
                    `<span class="toolbar-state-value">Resultados: ${C(String(d))}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-sort">Orden: ${C(
                        (function (e) {
                            const t = {
                                datetime_desc: 'Mas recientes primero',
                                datetime_asc: 'Proximas primero',
                                triage: 'Triage operativo',
                                patient_az: 'Paciente (A-Z)',
                            };
                            return t[ot(e)] || t.datetime_desc;
                        })(o)
                    )}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-density">Densidad: ${C(
                        (function (e) {
                            const t = {
                                comfortable: 'Comoda',
                                compact: 'Compacta',
                            };
                            return t[rt(e)] || t.comfortable;
                        })(s)
                    )}</span>`
                ),
                (n.innerHTML = m.join('')));
        })(t, n));
}
function mt() {
    dt();
}
function ft(e, t = {}) {
    const { filterSelect: n, searchInput: a } = at(),
        i = it(e),
        o = !1 !== t.preserveSearch;
    (n && (n.value = i), !o && a && (a.value = ''), dt());
}
function pt() {
    ft(Xe, { preserveSearch: !1 });
}
function gt(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
function bt() {
    if (!Array.isArray(e) || 0 === e.length)
        return void E('No hay citas para exportar', 'warning');
    const t = e.map((e) => [
            Number(e.id) || 0,
            e.date || '',
            e.time || '',
            gt(e.name || ''),
            gt(e.email || ''),
            gt(e.phone || ''),
            gt(B(e.service)),
            gt(I(e.doctor)),
            e.price || '',
            gt(T(e.status || 'confirmed')),
            gt(M(e.paymentStatus)),
            gt(q(e.paymentMethod)),
        ]),
        n = [
            [
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
                'Metodo pago',
            ].join(','),
            ...t.map((e) => e.join(',')),
        ].join('\n'),
        a = new Blob([n], { type: 'text/csv;charset=utf-8;' }),
        i = URL.createObjectURL(a),
        o = document.createElement('a');
    ((o.href = i),
        (o.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`),
        document.body.appendChild(o),
        o.click(),
        document.body.removeChild(o),
        URL.revokeObjectURL(i),
        E('CSV exportado correctamente', 'success'));
}
let ht = null,
    yt = new Date(),
    vt = !1,
    St = null,
    wt = {},
    kt = !1;
const Ct = 'admin-availability-day-clipboard',
    Et = 'admin-availability-last-selected-date';
function $t(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = {};
    return (
        Object.keys(t)
            .sort()
            .forEach((e) => {
                if (!qt(e)) return;
                const a = _t(t[e] || []);
                a.length > 0 && (n[e] = a);
            }),
        n
    );
}
function Lt(e) {
    wt = $t(e);
}
function At() {
    const e = $t(a),
        t = $t(wt);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                i = t[n] || [];
            return a.length !== i.length || a.some((e, t) => e !== i[t]);
        });
}
function Bt() {
    return At().length > 0;
}
function It(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Tt(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function qt(e) {
    return Boolean(Tt(e));
}
function Mt(e) {
    try {
        const t = String(e || '').trim();
        if (!qt(t)) return void localStorage.removeItem(Et);
        localStorage.setItem(Et, t);
    } catch (e) {}
}
function Nt() {
    St ||
        (St = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(Ct) || 'null');
                if (!e || 'object' != typeof e) return null;
                const t = String(e.sourceDate || '').trim(),
                    n = Array.isArray(e.slots)
                        ? e.slots
                              .map((e) => String(e || '').trim())
                              .filter(Boolean)
                        : [];
                return t && 0 !== n.length
                    ? { sourceDate: t, slots: Array.from(new Set(n)).sort() }
                    : null;
            } catch (e) {
                return null;
            }
        })());
}
function Dt() {
    try {
        if (
            St &&
            'object' == typeof St &&
            Array.isArray(St.slots) &&
            St.slots.length > 0
        )
            return void localStorage.setItem(Ct, JSON.stringify(St));
        localStorage.removeItem(Ct);
    } catch (e) {}
}
function _t(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function xt(e, t) {
    const n = String(e || '').trim(),
        a = _t(t);
    if (!n || 0 === a.length) return ((St = null), void Dt());
    ((St = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        Dt());
}
function Ht(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = Tt(t);
    return n
        ? n.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          })
        : t;
}
function Ft() {
    return ht ? _t(a[ht] || []) : [];
}
function Rt(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const i = _t(t);
    0 !== i.length ? (a[n] = i) : delete a[n];
}
function Pt(e, t) {
    const n = Tt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const i = Math.max(0, Math.round(a));
    return 0 === i
        ? []
        : Array.from({ length: i }, (e, t) => {
              const a = new Date(n);
              return (a.setDate(n.getDate() + t), It(a));
          });
}
function jt(e) {
    return (Array.isArray(e) ? e : []).reduce(
        (e, t) => e + _t(a[t] || []).length,
        0
    );
}
function Ot(e) {
    const t = Tt(e);
    t && (yt = new Date(t.getFullYear(), t.getMonth(), 1));
}
function Ut(e, t) {
    const n = Tt(e);
    if (!n) return;
    const a = Number(t);
    if (!Number.isFinite(a) || 0 === a) return;
    const i = new Date(n);
    i.setDate(n.getDate() + a);
    const o = It(i);
    (Ot(o), rn(o));
}
function zt(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function Vt(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function Wt(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function Kt() {
    const e = document.getElementById('availabilitySelectionSummary');
    if (!e) return;
    const t =
            'google' === String(i.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = vt ? 'Solo lectura' : 'Editable',
        o = String(ht || '').trim(),
        r = o ? (Array.isArray(a[o]) ? a[o].length : 0) : null;
    if (!o)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${C(t)}</span>`,
            `<span class="availability-summary-chip ${vt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${C(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Tt(o),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : o;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${C(t)}</span>`,
        `<span class="availability-summary-chip ${vt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${C(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${C(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${C(String(r ?? 0))}</span>`,
    ].join('');
}
function Gt() {
    Nt();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(ht || '').trim()),
        i = Ft(),
        o = i.length > 0,
        r = n ? Pt(ht, 7) : [],
        s = jt(r),
        c = r.filter((e) => _t(a[e] || []).length > 0).length,
        l = _t(St?.slots || []),
        u = l.length > 0,
        d = e.querySelector('[data-action="copy-availability-day"]'),
        m = e.querySelector('[data-action="paste-availability-day"]'),
        f = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        p = e.querySelector('[data-action="duplicate-availability-next-week"]'),
        g = e.querySelector('[data-action="clear-availability-day"]'),
        b = e.querySelector('[data-action="clear-availability-week"]');
    if (
        (d instanceof HTMLButtonElement && (d.disabled = !n || !o),
        m instanceof HTMLButtonElement && (m.disabled = !n || !u || vt),
        f instanceof HTMLButtonElement && (f.disabled = !n || !o || vt),
        p instanceof HTMLButtonElement && (p.disabled = !n || !o || vt),
        g instanceof HTMLButtonElement && (g.disabled = !n || !o || vt),
        b instanceof HTMLButtonElement && (b.disabled = !n || 0 === s || vt),
        e.classList.toggle('is-hidden', !n && !u),
        !n && !u)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const h = [];
    (n &&
        (h.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${C(Ht(ht))}</span>`
        ),
        h.push(
            `<span class="toolbar-chip is-muted">Slots: ${C(String(i.length))}</span>`
        ),
        h.push(
            `<span class="toolbar-chip is-muted">Semana: ${C(String(c))} dia(s), ${C(String(s))} slot(s)</span>`
        )),
        u
            ? h.push(
                  `<span class="toolbar-chip">Portapapeles: ${C(String(l.length))} (${C(Ht(St?.sourceDate))})</span>`
              )
            : h.push(
                  '<span class="toolbar-chip is-muted">Portapapeles vacío</span>'
              ),
        vt &&
            h.push(
                '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
            ),
        (t.innerHTML = h.join('')));
}
function Jt() {
    const e = document.getElementById('availabilityDraftPanel'),
        t = document.getElementById('availabilityDraftStatus'),
        n = document.getElementById('availabilitySaveDraftBtn'),
        a = document.getElementById('availabilityDiscardDraftBtn');
    if (!e || !t) return;
    const i = At(),
        o = i.length,
        r = i
            .slice(0, 2)
            .map((e) => Ht(e))
            .join(', ');
    if (vt)
        t.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    else if (0 === o)
        t.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    else {
        const e = `${o} día${1 === o ? '' : 's'} con cambios pendientes`,
            n = r ? ` (${C(r)}${o > 2 ? '…' : ''})` : '';
        t.innerHTML = `<span class="toolbar-chip is-info">${C(e)}${n}</span>`;
    }
    (n instanceof HTMLButtonElement &&
        ((n.disabled = vt || 0 === o || kt),
        n.setAttribute('aria-busy', String(kt))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === o || kt));
}
function Yt() {
    const {
        statusEl: e,
        detailsEl: t,
        linksEl: n,
    } = (function () {
        const e = document.querySelector('#availability .time-slots-config');
        if (!e) return { statusEl: null, detailsEl: null, linksEl: null };
        let t = document.getElementById('availabilitySyncStatus');
        t ||
            ((t = document.createElement('div')),
            (t.id = 'availabilitySyncStatus'),
            (t.className = 'selected-date'),
            e.firstChild
                ? e.insertBefore(t, e.firstChild.nextSibling)
                : e.appendChild(t));
        let n = document.getElementById('availabilitySyncDetails');
        n ||
            ((n = document.createElement('div')),
            (n.id = 'availabilitySyncDetails'),
            (n.className = 'selected-date'),
            t.insertAdjacentElement('afterend', n));
        let a = document.getElementById('availabilitySyncLinks');
        return (
            a ||
                ((a = document.createElement('div')),
                (a.id = 'availabilitySyncLinks'),
                (a.className = 'selected-date'),
                n.insertAdjacentElement('afterend', a)),
            { statusEl: t, detailsEl: n, linksEl: a }
        );
    })();
    if (!e) return;
    const a = String(i.source || 'store'),
        o = String(i.mode || 'live'),
        r = String(i.timezone || 'America/Guayaquil'),
        s = String(i.calendarAuth || 'n/d'),
        c = !1 === i.calendarTokenHealthy ? 'no' : 'si',
        l = !1 === i.calendarConfigured ? 'no' : 'si',
        u = !1 === i.calendarReachable ? 'no' : 'si',
        d = zt(i.generatedAt),
        m = zt(i.calendarLastSuccessAt),
        f = zt(i.calendarLastErrorAt),
        p = String(i.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === o ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${C(n)}</strong> | TZ: <strong>${C(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${C(s)}</strong> | Token OK: <strong>${C(c)}</strong> | Configurado: <strong>${C(l)}</strong> | Reachable: <strong>${C(u)}</strong> | Ultimo exito: <strong>${C(m)}</strong> | Snapshot: <strong>${C(d)}</strong>`;
            ('blocked' === o &&
                p &&
                (e += ` | Ultimo error: <strong>${C(f)}</strong> (${C(p)})`),
                (t.innerHTML = e));
        }
        Vt(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${C(d)}</strong>`),
            Vt(
                'Selecciona un dia para editar horarios. Guarda o descarta el borrador cuando termines.'
            ));
    if (
        ((function (e) {
            const t = document.querySelector(
                '#availability .availability-calendar h3'
            );
            t &&
                (t.textContent =
                    'google' === e
                        ? 'Disponibilidad (Google Calendar - Solo lectura)'
                        : 'Configurar Horarios Disponibles');
            const n = document.querySelector(
                '#availability .time-slots-config h3'
            );
            n &&
                (n.textContent =
                    'google' === e
                        ? 'Horarios del Dia (solo lectura)'
                        : 'Horarios del Dia');
        })(a),
        Kt(),
        Gt(),
        Jt(),
        !n)
    )
        return;
    const g = i.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const b = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = C(String(n.idMasked || 'n/d')),
            i = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(i)
            ? `${t}: ${a} <a href="${C(i)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        b('rosero', 'Dr. Rosero'),
        b('narvaez', 'Dra. Narváez'),
    ].join(' | ');
}
function Qt() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Wt(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        Xt(),
        Kt(),
        Gt(),
        Jt());
}
function Xt() {
    const e = Boolean(String(ht || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', vt || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', vt || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = vt || !e;
        })),
        Gt(),
        Jt());
}
function Zt() {
    const e = yt.getFullYear(),
        t = yt.getMonth(),
        n = new Date(e, t, 1).getDay(),
        i = new Date(e, t + 1, 0).getDate(),
        o = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = It(new Date());
    ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].forEach((e) => {
        const t = document.createElement('div');
        ((t.className = 'calendar-day-header'),
            (t.textContent = e),
            r.appendChild(t));
    });
    for (let e = n - 1; e >= 0; e -= 1) {
        const t = o - e,
            n = document.createElement('div');
        ((n.className = 'calendar-day other-month'),
            (n.textContent = t),
            r.appendChild(n));
    }
    for (let n = 1; n <= i; n += 1) {
        const i = It(new Date(e, t, n)),
            o = document.createElement('div');
        ((o.className = 'calendar-day'),
            (o.textContent = n),
            (o.tabIndex = 0),
            o.setAttribute('role', 'button'),
            o.setAttribute('aria-label', `Seleccionar ${i}`),
            ht === i && o.classList.add('selected'),
            s === i && o.classList.add('today'),
            a[i] && a[i].length > 0 && o.classList.add('has-slots'),
            o.addEventListener('click', () => rn(i)),
            o.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void rn(i))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void Ut(i, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void Ut(i, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void Ut(i, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), Ut(i, 7))
                            )
            ),
            r.appendChild(o));
    }
    const c = 42 - (n + i);
    for (let e = 1; e <= c; e += 1) {
        const t = document.createElement('div');
        ((t.className = 'calendar-day other-month'),
            (t.textContent = e),
            r.appendChild(t));
    }
}
function en(e) {
    (yt.setMonth(yt.getMonth() + e), Zt());
}
function tn() {
    const e = new Date();
    ((yt = new Date(e.getFullYear(), e.getMonth(), 1)), Zt(), rn(It(e)));
}
function nn() {
    const e = (function ({
        referenceDate: e = '',
        includeReference: t = !1,
    } = {}) {
        const n = Object.keys(a || {})
            .filter((e) => {
                if (!qt(e)) return !1;
                const t = a[e];
                return Array.isArray(t) && t.length > 0;
            })
            .sort();
        if (0 === n.length) return '';
        const i = qt(e) ? String(e).trim() : It(new Date()),
            o = t ? (e) => e >= i : (e) => e > i;
        return n.find(o) || n[0];
    })({ referenceDate: ht || It(new Date()), includeReference: !1 });
    e
        ? (Ot(e), rn(e))
        : E('No hay fechas con horarios configurados', 'warning');
}
function an() {
    const e = document.getElementById('newSlotTime');
    e instanceof HTMLInputElement &&
        (vt || e.closest('.is-hidden') || e.focus({ preventScroll: !0 }));
}
function on() {
    return (
        document.getElementById('availability')?.classList.contains('active') ||
        !1
    );
}
function rn(e, { persist: t = !0 } = {}) {
    if (!qt(e)) return;
    ((ht = e), t && Mt(e), Zt());
    const n = Tt(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        n.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        Xt(),
        Kt(),
        sn(e));
}
function sn(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Wt(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            Kt(),
            Gt(),
            void Jt()
        );
    const i = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${vt ? ' is-readonly' : ''}">\n            <span class="time">${C(e)}</span>\n            <div class="slot-actions">\n                ${vt ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${i}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        Kt(),
        Gt(),
        Jt());
}
function cn() {
    (Zt(), ht ? sn(ht) : Qt());
}
function ln(e) {
    ('function' == typeof e && e(), cn());
}
async function un() {
    if (vt)
        return (
            E(
                'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                'warning'
            ),
            !1
        );
    if (!Bt()) return (E('No hay cambios pendientes por guardar', 'info'), !1);
    try {
        return (
            await (async function () {
                if (vt)
                    throw new Error(
                        'Disponibilidad en solo lectura (Google Calendar).'
                    );
                if (kt) return !1;
                ((kt = !0), Jt());
                try {
                    const e = $t(a);
                    return (
                        f(e),
                        await w('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        Lt(a),
                        !0
                    );
                } finally {
                    ((kt = !1), Jt());
                }
            })(),
            E('Cambios de disponibilidad guardados', 'success'),
            !0
        );
    } catch (e) {
        return (E(`No se pudieron guardar cambios: ${e.message}`, 'error'), !1);
    }
}
function dn() {
    Bt()
        ? confirm(
              'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
          ) && (f($t(wt)), cn(), E('Cambios pendientes descartados', 'success'))
        : E('No hay cambios pendientes por descartar', 'info');
}
function mn() {
    return vt
        ? (E(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!ht || (E('Selecciona una fecha primero', 'warning'), !1);
}
function fn() {
    if (!ht) return void E('Selecciona una fecha para copiar', 'warning');
    const e = Ft();
    0 !== e.length
        ? (xt(ht, e),
          Gt(),
          E(
              `Día copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
              'success'
          ))
        : E('No hay horarios para copiar en este dia', 'warning');
}
async function pn() {
    if ((Nt(), !mn())) return;
    const e = _t(St?.slots || []);
    if (0 === e.length) return void E('Portapapeles vacio', 'warning');
    const t = Ft();
    t.length === e.length && t.every((t, n) => t === e[n])
        ? E('La fecha ya tiene esos mismos horarios', 'warning')
        : (t.length > 0 &&
              !confirm(
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${Ht(ht)} con ${e.length}?`
              )) ||
          (ln(() => {
              Rt(ht, e);
          }),
          E('Horarios pegados en cambios pendientes', 'success'));
}
async function gn() {
    if (!mn()) return;
    const e = Ft();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Tt(ht);
    if (!t) return void E('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const i = It(n),
        o = _t(a[i] || []);
    (o.length > 0 &&
        !confirm(
            `${Ht(i)} ya tiene ${o.length} horario${1 === o.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (ln(() => {
            (Rt(i, e), xt(ht, e));
        }),
        Ot(i),
        rn(i),
        E(`Horarios duplicados a ${Ht(i)} (pendiente de guardar)`, 'success'));
}
async function bn() {
    if (!mn()) return;
    const e = Ft();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Pt(ht, 8).slice(1);
    if (0 === t.length)
        return void E('No se pudieron preparar los siguientes dias', 'error');
    const n = t.filter((t) => {
        const n = _t(a[t] || []);
        return (
            n.length > 0 &&
            (n.length !== e.length || n.some((t, n) => t !== e[n]))
        );
    }).length;
    (n > 0 &&
        !confirm(
            `Se reemplazaran horarios en ${n} dia(s). Deseas continuar?`
        )) ||
        (ln(() => {
            (t.forEach((t) => {
                Rt(t, e);
            }),
                xt(ht, e));
        }),
        E(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function hn() {
    if (!mn()) return;
    const e = Ft();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${Ht(ht)}?`
          ) &&
          (ln(() => {
              Rt(ht, []);
          }),
          Ot(ht),
          rn(ht),
          E('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : E('No hay horarios que limpiar en este dia', 'warning');
}
async function yn() {
    if (!mn()) return;
    const e = Pt(ht, 7);
    if (0 === e.length)
        return void E('No se pudo preparar la semana de limpieza', 'error');
    const t = e.filter((e) => _t(a[e] || []).length > 0);
    if (0 === t.length)
        return void E(
            'No hay horarios para limpiar en los proximos 7 dias',
            'warning'
        );
    const n = jt(t);
    confirm(
        `Eliminar ${n} horario(s) en ${t.length} dia(s) desde ${Ht(ht)}?`
    ) &&
        (ln(() => {
            t.forEach((e) => {
                Rt(e, []);
            });
        }),
        Ot(ht),
        rn(ht),
        E(
            `Semana limpiada (${t.length} dia(s)) pendiente de guardar`,
            'success'
        ));
}
const vn = {
        waiting: 'En espera',
        called: 'Llamado',
        completed: 'Completado',
        no_show: 'No asistio',
        cancelled: 'Cancelado',
    },
    Sn = {
        appt_overdue: 'Cita vencida',
        appt_current: 'Cita vigente',
        walk_in: 'Walk-in',
    },
    wn = new Set(['completed', 'no_show', 'cancelled']),
    kn = new Set(['waiting', 'called']),
    Cn = ['completar', 'no_show', 'cancelar'],
    En = { completar: 'Completar', no_show: 'No show', cancelar: 'Cancelar' },
    $n = ['all', 'waiting', 'called', 'sla_risk', 'appointments', 'walk_in'],
    Ln = 'queueAdminLastSnapshot',
    An = {
        pendingCallByConsultorio: new Set(),
        realtimeTimerId: 0,
        realtimeEnabled: !1,
        realtimeFailureStreak: 0,
        realtimeRequestInFlight: !1,
        activeFilter: 'all',
        searchTerm: '',
        triageControlsBound: !1,
        bulkActionInFlight: !1,
        bulkReprintInFlight: !1,
        reprintInFlightIds: new Set(),
        lastViewState: null,
        activityPanelBound: !1,
        activityLog: [],
        activitySeq: 0,
        syncState: 'paused',
        syncMessage: '',
        lastRefreshMode: 'idle',
        fallbackContext: null,
        lastHealthySyncAt: 0,
        snapshotLoaded: !1,
        opsActionsBound: !1,
    };
function Bn() {
    An.fallbackContext = null;
}
function In() {
    if ('state_fallback' !== An.lastRefreshMode) return null;
    const e = An.fallbackContext;
    return e && 'object' == typeof e ? e : null;
}
function Tn(e, t = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'admin',
                    event: String(e || 'unknown'),
                    at: new Date().toISOString(),
                    ...t,
                },
            })
        );
    } catch (e) {}
}
function qn(e) {
    const t = Math.max(0, Number(e || 0)),
        n = Math.round(t / 1e3);
    if (n < 60) return `${n}s`;
    const a = Math.floor(n / 60),
        i = n % 60;
    return i <= 0 ? `${a}m` : `${a}m ${i}s`;
}
function Mn(e) {
    if (!e || 'object' != typeof e) return null;
    const t = Date.parse(String(e.savedAt || ''));
    if (!Number.isFinite(t)) return null;
    if (Date.now() - t > 72e5) return null;
    const n = e.data && 'object' == typeof e.data ? e.data : {};
    return {
        savedAt: new Date(t).toISOString(),
        data: {
            queueTickets: Array.isArray(n.queueTickets) ? n.queueTickets : [],
            queueMeta:
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : null,
        },
    };
}
function Nn() {
    try {
        const e = localStorage.getItem(Ln);
        return e ? Mn(JSON.parse(e)) : null;
    } catch (e) {
        return null;
    }
}
function Dn(e, { source: t = 'fallback' } = {}) {
    const n = Mn(e);
    if (!n) return !1;
    const a = Array.isArray(n.data.queueTickets) ? n.data.queueTickets : [],
        i =
            n.data.queueMeta && 'object' == typeof n.data.queueMeta
                ? n.data.queueMeta
                : null;
    (h(a), y(i), Bn(), pa());
    const o = Math.max(0, Date.now() - Date.parse(String(n.savedAt || '')));
    return (
        Hn('reconnecting', `Respaldo local activo (${qn(o)})`, {
            log: !0,
            level: 'warning',
            reason: 'Respaldo local',
        }),
        Tn('snapshot_restored', { source: t, ageMs: o, queueCount: a.length }),
        !0
    );
}
function _n() {
    const e = (function () {
        const e = document.querySelector('#queue .queue-admin-shell');
        if (!(e instanceof HTMLElement)) return null;
        let t = document.getElementById('queueActivityPanel');
        if (!(t instanceof HTMLElement)) {
            ((t = document.createElement('section')),
                (t.id = 'queueActivityPanel'),
                (t.className = 'queue-admin-next'),
                (t.innerHTML =
                    '\n            <h4>Historial operativo</h4>\n            <p id="queueActivitySyncHint" class="queue-triage-summary" role="status" aria-live="polite">Sincronizacion en espera.</p>\n            <ol id="queueActivityList" role="log" aria-live="polite" aria-relevant="additions text">\n                <li class="empty-message">Sin eventos operativos recientes.</li>\n            </ol>\n            <p class="queue-triage-summary">\n                Atajos estado: Alt+Shift+W (espera), Alt+Shift+C (llamados), Alt+Shift+A (todos), Alt+Shift+I (walk-in), Numpad Enter (llamar estación)\n            </p>\n        '));
            const n = e.querySelector('.queue-admin-grid');
            n?.parentElement === e
                ? n.insertAdjacentElement('afterend', t)
                : e.appendChild(t);
        }
        return t;
    })();
    if (!(e instanceof HTMLElement)) return;
    const t = e.querySelector('#queueActivitySyncHint');
    if (t instanceof HTMLElement) {
        const e = {
                live: 'en vivo',
                reconnecting: 'reconectando',
                offline: 'sin conexion',
                paused: 'en pausa',
            }[An.syncState || 'paused'],
            n = String(An.syncMessage || '').trim();
        t.textContent = `Sync ${e}: ${n || 'sin detalle'}`;
    }
    const n = e.querySelector('#queueActivityList');
    n instanceof HTMLElement &&
        (Array.isArray(An.activityLog) && An.activityLog.length
            ? (n.innerHTML = An.activityLog
                  .map((e) => {
                      const t = {
                          info: 'INFO',
                          warning: 'WARN',
                          error: 'ERROR',
                      }[e.level || 'info'];
                      return `\n                <li>\n                    <strong>${C(((n = e.ts), Number.isFinite(n) ? new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !1 }) : '--:--:--'))}</strong>\n                    <span>[${C(t)}] ${C(e.message || 'Evento sin detalle')}</span>\n                </li>\n            `;
                      var n;
                  })
                  .join(''))
            : (n.innerHTML =
                  '<li class="empty-message">Sin eventos operativos recientes.</li>'));
}
function xn(e, { level: t = 'info' } = {}) {
    const n = String(e || '').trim();
    if (!n) return;
    const a = Date.now(),
        i = ['info', 'warning', 'error'].includes(t) ? t : 'info',
        o = An.activityLog[0] || null;
    (o && o.message === n && o.level === i && a - Number(o.ts || 0) < 2e3) ||
        ((An.activitySeq = Number(An.activitySeq || 0) + 1),
        An.activityLog.unshift({
            id: An.activitySeq,
            ts: a,
            level: i,
            message: n,
        }),
        (An.activityLog = An.activityLog.slice(0, 15)),
        _n());
}
function Hn(e, t, { log: n = !1, level: a = 'info', reason: i = '' } = {}) {
    const o = String(e || 'paused').toLowerCase(),
        r = String(t || '').trim(),
        s =
            o !== String(An.syncState || 'paused') ||
            r !== String(An.syncMessage || '');
    if (
        ((function (e, t) {
            const n = document.getElementById('queueSyncStatus'),
                a = String(e || 'paused').toLowerCase(),
                i = {
                    live: 'Cola en vivo',
                    reconnecting: 'Reintentando sincronizacion',
                    offline: 'Sin conexion al backend',
                    paused: 'Cola en pausa',
                },
                o = String(t || '').trim() || i[a] || i.paused;
            ((An.syncState = a),
                (An.syncMessage = o),
                n ? ((n.dataset.state = a), (n.textContent = o), _n()) : _n());
        })(o, r),
        s && Tn('sync_state', { state: o, message: r }),
        !n || !s)
    )
        return s;
    const c = String(i || '').trim();
    return (xn(c ? `${c}: ${r || o}` : r || o, { level: a }), s);
}
function Fn({ log: e = !1 } = {}) {
    if (!ba()) return { stale: !1, ageMs: 0 };
    if ('offline' === String(An.syncState || '').toLowerCase())
        return { stale: !1, ageMs: 0 };
    const t = Date.parse(String(c?.updatedAt || ''));
    if (!Number.isFinite(t)) return { stale: !1, ageMs: 0 };
    const n = Math.max(0, Date.now() - t);
    if (n < 3e4) return { stale: !1, ageMs: n };
    const a = `Watchdog: datos de cola estancados (${qn(n)})`;
    return (
        Hn('reconnecting', a, {
            log: e,
            level: 'warning',
            reason: 'Watchdog de cola',
        }),
        { stale: !0, ageMs: n, message: a }
    );
}
function Rn() {
    const e = Math.max(0, Number(An.realtimeFailureStreak || 0)),
        t = 2500 * Math.pow(2, Math.min(e, 3));
    return Math.min(15e3, t);
}
function Pn() {
    An.realtimeTimerId &&
        (window.clearTimeout(An.realtimeTimerId), (An.realtimeTimerId = 0));
}
function jn({ immediate: e = !1 } = {}) {
    if ((Pn(), !An.realtimeEnabled)) return;
    const t = e ? 0 : Rn();
    An.realtimeTimerId = window.setTimeout(() => {
        ga();
    }, t);
}
function On(e) {
    const t =
        'number' == typeof e && Number.isFinite(e)
            ? e
            : Date.parse(String(e || ''));
    return Number.isFinite(t)
        ? new Date(t).toLocaleString('es-EC', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '--';
}
function Un(e) {
    const t = Date.parse(String(e || ''));
    return Number.isFinite(t) ? t : null;
}
function zn(e, t = Date.now()) {
    if (!Number.isFinite(e)) return !1;
    const n = new Date(e),
        a = new Date(t);
    return (
        n.getFullYear() === a.getFullYear() &&
        n.getMonth() === a.getMonth() &&
        n.getDate() === a.getDate()
    );
}
function Vn(e) {
    return Number.isFinite(e) ? `${Math.max(0, Math.round(e))}m` : '--';
}
function Wn(e) {
    const t = String(e ?? '');
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function Kn() {
    An.opsActionsBound ||
        ((An.opsActionsBound = !0),
        document.addEventListener('click', (e) => {
            e.target instanceof Element &&
                e.target.closest('[data-action="queue-export-csv"]') instanceof
                    HTMLElement &&
                (function (e) {
                    const t = Array.isArray(e?.tickets) ? e.tickets : [];
                    if (!t.length)
                        return (
                            E('No hay tickets visibles para exportar.', 'info'),
                            !1
                        );
                    const n = t.map((e) => {
                            const t = Xn(e);
                            return [
                                e?.ticketCode || '',
                                e?.queueType || '',
                                e?.priorityClass || '',
                                e?.status || '',
                                e?.assignedConsultorio ?? '',
                                e?.patientInitials || '',
                                e?.phoneLast4 || '',
                                e?.createdAt || '',
                                e?.calledAt || '',
                                e?.completedAt || '',
                                Number.isFinite(t) ? Math.round(t) : '',
                                Zn(e) ? 'yes' : 'no',
                            ];
                        }),
                        a = [
                            [
                                'ticket_code',
                                'queue_type',
                                'priority_class',
                                'status',
                                'assigned_consultorio',
                                'patient_initials',
                                'phone_last4',
                                'created_at',
                                'called_at',
                                'completed_at',
                                'wait_minutes',
                                'sla_risk',
                            ]
                                .map(Wn)
                                .join(','),
                            ...n.map((e) => e.map(Wn).join(',')),
                        ].join('\n'),
                        i = new Blob([`\ufeff${a}`], {
                            type: 'text/csv;charset=utf-8',
                        }),
                        o = `turnero-resumen-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`,
                        r = URL.createObjectURL(i),
                        s = document.createElement('a');
                    ((s.href = r),
                        (s.download = o),
                        (s.rel = 'noopener'),
                        document.body.appendChild(s),
                        s.click(),
                        s.remove(),
                        window.setTimeout(() => URL.revokeObjectURL(r), 500),
                        xn(`CSV exportado: ${n.length} ticket(s) visibles`, {
                            level: 'info',
                        }),
                        E(`CSV exportado (${n.length} tickets).`, 'success'),
                        Tn('queue_export_csv', {
                            rows: n.length,
                            filter: Qn(e?.activeFilter || 'all'),
                        }));
                })(An.lastViewState || ta());
        }));
    const e = (function (e) {
            const t = Array.isArray(e) ? e : [],
                n = Date.now(),
                a = [];
            let i = 0,
                o = 0,
                r = 0,
                s = 0,
                c = null;
            for (const e of t) {
                const t = String(e?.status || '').toLowerCase(),
                    l = Un(e?.createdAt),
                    u = Un(e?.calledAt),
                    d = Un(e?.completedAt),
                    m = d ?? u ?? l ?? Un(e?.updatedAt);
                (Number.isFinite(m) && (c = null === c ? m : Math.max(c, m)),
                    Number.isFinite(l) && zn(l, n) && (i += 1));
                const f = d ?? u ?? l;
                if (
                    ('completed' === t &&
                        Number.isFinite(f) &&
                        zn(f, n) &&
                        (o += 1),
                    'no_show' === t &&
                        Number.isFinite(f) &&
                        zn(f, n) &&
                        (r += 1),
                    'waiting' === t &&
                        Number.isFinite(l) &&
                        Math.max(0, Math.round((n - l) / 6e4)) >= 20 &&
                        (s += 1),
                    !Number.isFinite(l))
                )
                    continue;
                let p = null;
                if (
                    (Number.isFinite(u)
                        ? (p = u)
                        : 'waiting' === t || 'called' === t
                          ? (p = n)
                          : Number.isFinite(d) && (p = d),
                    !Number.isFinite(p))
                )
                    continue;
                const g = Math.max(0, Math.round((p - l) / 6e4));
                a.push(g);
            }
            const l = o + r;
            return {
                ticketsToday: i,
                completedToday: o,
                noShowToday: r,
                noShowRatePct: l > 0 ? (r / l) * 100 : 0,
                avgWaitMinutes:
                    a.length > 0
                        ? a.reduce((e, t) => e + t, 0) / a.length
                        : null,
                p95WaitMinutes: (function (e) {
                    if (!Array.isArray(e) || 0 === e.length) return null;
                    const t = [...e]
                        .map((e) => Number(e))
                        .filter((e) => Number.isFinite(e))
                        .sort((e, t) => e - t);
                    if (!t.length) return null;
                    const n = Math.min(1, Math.max(0, Number(0.95)));
                    return t[Math.max(0, Math.ceil(n * t.length) - 1)];
                })(a),
                slaRiskCount: s,
                latestSignalTs: c,
                waitSampleSize: a.length,
            };
        })(Array.isArray(s) ? s : []),
        t = document.getElementById('queueOpsTicketsToday'),
        n = document.getElementById('queueOpsCompletedToday'),
        a = document.getElementById('queueOpsNoShowRate'),
        i = document.getElementById('queueOpsAvgWait'),
        o = document.getElementById('queueOpsP95Wait'),
        r = document.getElementById('queueOpsSlaRisk'),
        c = document.getElementById('queueOpsUpdatedAt');
    if (
        (t && (t.textContent = String(e.ticketsToday)),
        n && (n.textContent = String(e.completedToday)),
        a &&
            (a.textContent = `${(function (e) {
                if (!Number.isFinite(e)) return '0%';
                const t = Math.round(10 * e) / 10;
                return Number.isInteger(t) ? `${t}%` : `${t.toFixed(1)}%`;
            })(e.noShowRatePct)} (${e.noShowToday})`),
        i && (i.textContent = Vn(e.avgWaitMinutes)),
        o && (o.textContent = Vn(e.p95WaitMinutes)),
        r && (r.textContent = String(e.slaRiskCount)),
        c)
    ) {
        const t =
            Number.isFinite(e.latestSignalTs) && null !== e.latestSignalTs
                ? On(e.latestSignalTs)
                : '--';
        c.textContent = `Muestra: ${e.waitSampleSize} ticket(s) · ultima señal ${t}`;
    }
}
function Gn(e) {
    const t = { 1: null, 2: null },
        n = Array.isArray(e?.callingNow) ? e.callingNow : [];
    for (const e of n) {
        const n = Number(e?.assignedConsultorio || 0);
        (1 !== n && 2 !== n) || (t[String(n)] = e);
    }
    return {
        updatedAt: e?.updatedAt || new Date().toISOString(),
        waitingCount: Number(e?.waitingCount || 0),
        calledCount: Number(e?.calledCount || 0),
        counts: e?.counts || {},
        callingNowByConsultorio: t,
        nextTickets: Array.isArray(e?.nextTickets) ? e.nextTickets : [],
    };
}
function Jn(e) {
    return (
        { waiting: 0, called: 1, completed: 2, no_show: 3, cancelled: 4 }[
            String(e || '').toLowerCase()
        ] ?? 9
    );
}
function Yn(e) {
    return (
        { appt_overdue: 0, appt_current: 1, walk_in: 2 }[
            String(e || '').toLowerCase()
        ] ?? 9
    );
}
function Qn(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return $n.includes(t) ? t : 'all';
}
function Xn(e) {
    const t = Date.parse(String(e?.createdAt || ''));
    if (!Number.isFinite(t)) return null;
    const n = Date.parse(String(e?.calledAt || '')),
        a =
            'called' === String(e?.status || '').toLowerCase() &&
            Number.isFinite(n)
                ? n
                : Date.now(),
        i = Math.round((a - t) / 6e4);
    return i >= 0 ? i : 0;
}
function Zn(e) {
    if ('waiting' !== String(e?.status || '').toLowerCase()) return !1;
    const t = Xn(e);
    return Number.isFinite(t) && t >= 20;
}
function ea(e) {
    return String(e || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
function ta() {
    const e =
        ((t = Array.isArray(s) ? s : []),
        [...t].sort((e, t) => {
            const n = Jn(e?.status) - Jn(t?.status);
            if (0 !== n) return n;
            const a = Yn(e?.priorityClass) - Yn(t?.priorityClass);
            if (0 !== a) return a;
            const i = Xn(e),
                o = Xn(t);
            if (Number.isFinite(i) && Number.isFinite(o) && i !== o)
                return o - i;
            const r = Date.parse(String(e?.createdAt || '')),
                s = Date.parse(String(t?.createdAt || ''));
            return Number.isFinite(r) && Number.isFinite(s) && r !== s
                ? r - s
                : Number(e?.id || 0) - Number(t?.id || 0);
        }));
    var t;
    const n = Qn(An.activeFilter),
        a = String(An.searchTerm || ''),
        i = e.filter(
            (e) =>
                (function (e, t) {
                    const n = Qn(t),
                        a = String(e?.status || '').toLowerCase(),
                        i = String(e?.queueType || '').toLowerCase();
                    return (
                        'all' === n ||
                        ('waiting' === n
                            ? 'waiting' === a
                            : 'called' === n
                              ? 'called' === a
                              : 'sla_risk' === n
                                ? Zn(e)
                                : 'appointments' === n
                                  ? 'appointment' === i
                                  : 'walk_in' !== n || 'walk_in' === i)
                    );
                })(e, n) &&
                (function (e, t) {
                    const n = ea(t);
                    return (
                        !n ||
                        [
                            e?.ticketCode,
                            e?.patientInitials,
                            e?.phoneLast4,
                            e?.queueType,
                            e?.priorityClass,
                            e?.status,
                        ]
                            .map((e) => ea(e))
                            .filter(Boolean)
                            .join(' ')
                            .includes(n)
                    );
                })(e, a)
        ),
        o = e.filter(
            (e) => 'waiting' === String(e?.status || '').toLowerCase()
        ).length,
        r = e.filter(
            (e) => 'called' === String(e?.status || '').toLowerCase()
        ).length,
        c = e.filter((e) => Zn(e)).length;
    return {
        tickets: i,
        totalCount: e.length,
        waitingCount: o,
        calledCount: r,
        riskCount: c,
        activeFilter: n,
        searchTerm: a,
    };
}
function na(e) {
    const t = String(e || '').toLowerCase();
    return En[t] || 'Accion';
}
function aa(e, t) {
    const n = String(e || '').toLowerCase();
    return Cn.includes(n)
        ? (Array.isArray(t?.tickets) ? t.tickets : []).filter((e) =>
              (function (e, t) {
                  const n = String(e || '').toLowerCase(),
                      a = String(t || '').toLowerCase();
                  return !(
                      !kn.has(a) ||
                      ('completar' === n
                          ? 'called' !== a && 'waiting' !== a
                          : ('no_show' !== n && 'cancelar' !== n) ||
                            ('called' !== a && 'waiting' !== a))
                  );
              })(n, e?.status)
          )
        : [];
}
function ia(e) {
    if (!e || 'object' != typeof e) return;
    const t = Number(e.id || 0);
    if (!t) return;
    const n = Array.isArray(s) ? [...s] : [],
        a = n.findIndex((e) => Number(e?.id || 0) === t);
    (a >= 0 ? (n[a] = { ...n[a], ...e }) : n.push(e), h(n));
}
function oa(e) {
    return String(e?.message || 'Error desconocido');
}
async function ra(e) {
    const t = Number(e || 0),
        n = new URLSearchParams();
    (n.set('resource', 'queue-reprint'), n.set('t', String(Date.now())));
    const a = await fetch(`/api.php?${n.toString()}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(l ? { 'X-CSRF-Token': l } : {}),
            },
            body: JSON.stringify({ id: t }),
        }),
        i = await a.text();
    let o;
    try {
        o = i ? JSON.parse(i) : {};
    } catch (e) {
        throw new Error('Respuesta invalida del servidor');
    }
    const r =
        o && 'object' == typeof o
            ? { ...o, statusCode: a.status }
            : { statusCode: a.status };
    return {
        ok: a.ok && !1 !== r.ok && Boolean(r.printed),
        responseOk: a.ok,
        payload: r,
    };
}
function sa(e) {
    const t = oa(e)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return t.includes('consultorio') && t.includes('ocupado');
}
function ca(e, t = '') {
    const n = t ? `${t} ` : '';
    switch (String(e || '').toLowerCase()) {
        case 're-llamar':
        case 'rellamar':
        case 'recall':
        case 'llamar':
            return `${n}re-llamado correctamente`.trim();
        case 'liberar':
        case 'release':
            return `${n}liberado y regresado a espera`.trim();
        case 'completar':
        case 'complete':
        case 'completed':
            return `${n}marcado como completado`.trim();
        case 'no_show':
        case 'noshow':
            return `${n}marcado como no show`.trim();
        case 'cancelar':
        case 'cancel':
        case 'cancelled':
            return `${n}cancelado`.trim();
        case 'reasignar':
        case 'reassign':
            return `${n}reasignado`.trim();
        default:
            return 'Turno actualizado';
    }
}
function la(e) {
    return document.querySelector(
        `[data-action="queue-call-next"][data-queue-consultorio="${e}"]`
    );
}
function ua(e, t) {
    const n = la(e),
        a = (function (e) {
            const t = `queueReleaseC${e}`,
                n = document.getElementById(t);
            if (n instanceof HTMLButtonElement) return n;
            const a = document.querySelector(
                '#queue .queue-admin-header-actions'
            );
            if (!(a instanceof HTMLElement)) return null;
            const i = document.createElement('button');
            ((i.type = 'button'),
                (i.id = t),
                (i.className = 'btn btn-secondary btn-sm'),
                (i.dataset.action = 'queue-ticket-action'),
                (i.dataset.queueAction = 'liberar'),
                (i.dataset.queueConsultorio = String(e)),
                (i.disabled = !0),
                (i.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${e}`));
            const o = la(e);
            return (
                o?.parentElement === a && o.nextSibling
                    ? a.insertBefore(i, o.nextSibling)
                    : a.appendChild(i),
                i
            );
        })(e),
        i = `Consultorio ${e}`,
        o = Boolean(t && t.id),
        r = An.pendingCallByConsultorio.has(String(e));
    if (n instanceof HTMLButtonElement) {
        const e = o || r;
        if (((n.disabled = e), r)) n.title = `Procesando llamado para ${i}`;
        else if (o) {
            const e = String(t?.ticketCode || '--');
            n.title = `${i} ocupado por ${e}`;
        } else n.title = `Llamar siguiente turno en ${i}`;
    }
    if (!(a instanceof HTMLButtonElement)) return;
    if (((a.disabled = !o), !o))
        return (
            delete a.dataset.queueId,
            (a.title = `Sin turno activo en ${i}`),
            void (a.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${e}`)
        );
    const s = String(t?.ticketCode || '--');
    ((a.dataset.queueId = String(t?.id || '')),
        (a.title = `Liberar ${s} de ${i}`),
        (a.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${e} (${C(s)})`));
}
function da(e) {
    const t = {
        all: 'Todos',
        waiting: 'En espera',
        called: 'Llamados',
        sla_risk: 'SLA +20m',
        appointments: 'Cita',
        walk_in: 'Walk-in',
    };
    return t[Qn(e)] || t.all;
}
function ma() {
    const e = document.querySelector('#queue .queue-admin-shell');
    if (!(e instanceof HTMLElement)) return;
    let t = document.getElementById('queueTriageToolbar');
    if (!(t instanceof HTMLElement)) {
        ((t = document.createElement('section')),
            (t.id = 'queueTriageToolbar'),
            (t.className = 'queue-triage-toolbar'),
            (t.innerHTML = `\n            <div class="queue-triage-filters" role="group" aria-label="Filtros de turnero">\n                ${$n.map((e) => `\n                        <button\n                            type="button"\n                            class="btn btn-secondary btn-sm queue-triage-filter"\n                            data-queue-filter="${e}"\n                        >\n                            ${C(da(e))}\n                        </button>\n                    `).join('')}\n            </div>\n            <div class="queue-triage-search-wrap">\n                <input\n                    id="queueSearchInput"\n                    class="queue-triage-search"\n                    type="search"\n                    inputmode="search"\n                    autocomplete="off"\n                    placeholder="Buscar ticket, iniciales o ultimos 4"\n                    aria-label="Buscar en cola"\n                />\n                <button\n                    type="button"\n                    class="btn btn-secondary btn-sm"\n                    data-action="queue-clear-search"\n                >\n                    Limpiar\n                </button>\n            </div>\n            <div class="queue-triage-filters" role="group" aria-label="Acciones masivas sobre tickets visibles">\n                ${Cn.map((e) => `\n                        <button\n                            type="button"\n                            class="btn btn-secondary btn-sm"\n                            data-action="queue-bulk-action"\n                            data-queue-action="${e}"\n                        >\n                            ${C(na(e))}\n                        </button>\n                    `).join('')}\n                <button\n                    type="button"\n                    class="btn btn-secondary btn-sm"\n                    data-action="queue-bulk-reprint"\n                >\n                    Reimprimir visibles\n                </button>\n            </div>\n            <p id="queueTriageSummary" class="queue-triage-summary" role="status" aria-live="polite">Sin datos de cola</p>\n            <p class="queue-triage-summary">\n                Atajos: Alt+Shift+J (C1), Alt+Shift+K (C2), Alt+Shift+F (buscar), Alt+Shift+L (SLA), Alt+Shift+U (refrescar), Alt+Shift+P (reimprimir visibles), Alt+Shift+W/C/A/I (estado), Numpad 1/2 + Enter (estación)\n            </p>\n        `));
        const n = e.querySelector('.queue-admin-kpis');
        n?.parentElement === e ? e.insertBefore(t, n) : e.appendChild(t);
    }
    const n = document.getElementById('queueSearchInput');
    (n instanceof HTMLInputElement &&
        n.value !== String(An.searchTerm || '') &&
        (n.value = String(An.searchTerm || '')),
        An.triageControlsBound ||
            ((An.triageControlsBound = !0),
            t.addEventListener('click', (e) => {
                const t = e.target.closest('[data-queue-filter]');
                if (t instanceof HTMLElement)
                    return (
                        (An.activeFilter = Qn(t.dataset.queueFilter || 'all')),
                        void pa()
                    );
                const n = e.target.closest('[data-action="queue-bulk-action"]');
                n instanceof HTMLElement
                    ? ka(n.dataset.queueAction || '')
                    : e.target.closest(
                            '[data-action="queue-bulk-reprint"]'
                        ) instanceof HTMLElement
                      ? Ca()
                      : e.target.closest(
                            '[data-action="queue-clear-search"]'
                        ) instanceof HTMLElement &&
                        ((An.searchTerm = ''), pa());
            }),
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    ((An.searchTerm = n.value || ''), pa());
                })));
}
function fa() {
    const e =
            c && 'object' == typeof c
                ? c
                : {
                      waitingCount: 0,
                      calledCount: 0,
                      nextTickets: [],
                      callingNowByConsultorio: { 1: null, 2: null },
                      updatedAt: '',
                  },
        t = document.getElementById('queueWaitingCountAdmin'),
        n = document.getElementById('queueCalledCountAdmin'),
        a = document.getElementById('queueBadge'),
        i = document.getElementById('queueC1Now'),
        o = document.getElementById('queueC2Now'),
        r = document.getElementById('queueNextAdminList'),
        s = document.getElementById('queueLastUpdate');
    (t && (t.textContent = String(e.waitingCount || 0)),
        n && (n.textContent = String(e.calledCount || 0)),
        a && (a.textContent = String(e.waitingCount || 0)),
        s && (s.textContent = On(e.updatedAt)));
    const l = e?.callingNowByConsultorio?.[1],
        u = e?.callingNowByConsultorio?.[2];
    if (
        (i &&
            (i.textContent = l
                ? `${l.ticketCode || '--'} · ${l.patientInitials || '--'}`
                : 'Sin llamado'),
        o &&
            (o.textContent = u
                ? `${u.ticketCode || '--'} · ${u.patientInitials || '--'}`
                : 'Sin llamado'),
        ua(1, l),
        ua(2, u),
        r)
    ) {
        const t = Array.isArray(e.nextTickets) ? e.nextTickets : [],
            n = In();
        if (0 === t.length)
            r.innerHTML =
                '<li class="empty-message">No hay turnos en espera.</li>';
        else {
            const e = t
                .map(
                    (e) =>
                        `\n                        <li>\n                            <strong>${C(e.ticketCode || '--')}</strong>\n                            <span>${C(e.patientInitials || '--')}</span>\n                            <span>#${C(e.position || '-')}</span>\n                        </li>\n                    `
                )
                .join('');
            r.innerHTML = n?.partial
                ? `${e}<li class="empty-message">Mostrando primeros ${C(n.nextTicketsCount)} de ${C(n.waitingCount)} en espera (fallback).</li>`
                : e;
        }
    }
}
function pa() {
    (ma(), _n());
    const e = ta();
    ((An.lastViewState = e),
        (function (e) {
            const t = document.getElementById('queueTriageToolbar');
            if (!(t instanceof HTMLElement)) return;
            const n = Qn(e?.activeFilter || 'all');
            t.querySelectorAll('[data-queue-filter]').forEach((e) => {
                if (!(e instanceof HTMLButtonElement)) return;
                const t = Qn(e.dataset.queueFilter || '') === n;
                (e.classList.toggle('is-active', t),
                    e.setAttribute('aria-pressed', String(t)));
            });
            const a = document.getElementById('queueSearchInput');
            (a instanceof HTMLInputElement &&
                a.value !== String(e?.searchTerm || '') &&
                (a.value = String(e?.searchTerm || '')),
                t
                    .querySelectorAll('[data-action="queue-bulk-action"]')
                    .forEach((t) => {
                        if (!(t instanceof HTMLButtonElement)) return;
                        const n = String(
                                t.dataset.queueAction || ''
                            ).toLowerCase(),
                            a = aa(n, e).length,
                            i = na(n);
                        ((t.textContent = `${i} visibles (${a})`),
                            (t.disabled = An.bulkActionInFlight || 0 === a),
                            t.setAttribute(
                                'aria-disabled',
                                String(t.disabled)
                            ));
                    }));
            const i = t.querySelector('[data-action="queue-bulk-reprint"]');
            if (i instanceof HTMLButtonElement) {
                const t = (Array.isArray(e?.tickets) ? e.tickets : []).length;
                ((i.textContent = `Reimprimir visibles (${t})`),
                    (i.disabled =
                        An.bulkReprintInFlight ||
                        An.bulkActionInFlight ||
                        0 === t),
                    i.setAttribute('aria-disabled', String(i.disabled)));
            }
            const o = document.getElementById('queueTriageSummary');
            if (o instanceof HTMLElement) {
                const t = Number(e?.tickets?.length || 0),
                    n = Number(e?.totalCount || 0),
                    a = Number(e?.riskCount || 0),
                    i = Number(e?.waitingCount || 0),
                    r = In();
                let s = '';
                (An.bulkActionInFlight
                    ? (s = ' · ejecutando accion masiva...')
                    : An.bulkReprintInFlight &&
                      (s = ' · reimprimiendo tickets visibles...'),
                    r?.partial &&
                        (s += ` · fallback parcial ${r.sampledCount}/${r.knownCount}`),
                    (o.textContent = `${t}/${n} visibles · ${i} en espera · ${a} en riesgo SLA${s}`));
            }
        })(e),
        fa(),
        Kn(),
        (function (e) {
            const t = document.getElementById('queueTableBody');
            if (!t) return;
            const n = Array.isArray(e?.tickets) ? e.tickets : [];
            if (0 === n.length) {
                const n = Number(e?.totalCount || 0),
                    a = Qn(e?.activeFilter || 'all'),
                    i = String(e?.searchTerm || '').trim(),
                    o = In();
                let r = 'Sin tickets en cola.';
                if (n > 0 && ('all' !== a || '' !== i)) {
                    const e = [];
                    ('all' !== a && e.push(`filtro "${da(a)}"`),
                        '' !== i && e.push(`búsqueda "${i}"`),
                        (r = `No hay tickets para ${e.join(' y ')}.`));
                } else
                    'all' === a &&
                        '' === i &&
                        o &&
                        o.knownCount > 0 &&
                        (r = `Cola en fallback: backend reporta ${o.knownCount} ticket(s) activos. Refresca para vista completa.`);
                return void (t.innerHTML = `\n            <tr>\n                <td colspan="8" class="empty-message">${C(r)}</td>\n            </tr>\n        `);
            }
            t.innerHTML = n
                .map((e) => {
                    const t = Number(e.id || 0),
                        n = String(e.status || 'waiting'),
                        a = 'waiting' === n || 'called' === n,
                        i = 'called' === n,
                        o = wn.has(n),
                        r = !o,
                        s = !o,
                        c = An.reprintInFlightIds.has(String(t)),
                        l = Xn(e),
                        u = Zn(e),
                        d = u ? 'queue-row-risk' : '',
                        m = Number.isFinite(l) ? `${l}m` : '--';
                    return `\n                <tr class="${d}">\n                    <td>${C(e.ticketCode || '--')}</td>\n                    <td>${C(e.queueType || '--')}</td>\n                    <td>${C(Sn[e.priorityClass] || e.priorityClass || '--')}</td>\n                    <td class="queue-status-cell">\n                        <span>${C(vn[n] || n)}</span>\n                        ${u ? '<small class="queue-risk-note">SLA > 20m</small>' : ''}\n                    </td>\n                    <td>${C(e.assignedConsultorio || '-')}</td>\n                    <td>\n                        <span>${C(On(e.createdAt))}</span>\n                        <small class="queue-wait-note">Espera: ${C(m)}</small>\n                    </td>\n                    <td>${C(e.patientInitials || '--')}</td>\n                    <td>\n                        <div class="queue-actions">\n                            <button\n                                type="button"\n                                class="btn btn-secondary btn-sm"\n                                data-action="queue-reprint-ticket"\n                                data-queue-id="${t}"\n                                ${c ? 'disabled aria-disabled="true"' : ''}\n                            >\n                                ${c ? 'Reimprimiendo...' : 'Reimprimir'}\n                            </button>\n                            ${a ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${t}">\n                                Re-llamar\n                            </button>` : ''}\n                            ${i ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${t}">\n                                Liberar\n                            </button>` : ''}\n                            ${r ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${t}">\n                                Completar\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${t}">\n                                No show\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${t}">\n                                Cancelar\n                            </button>` : ''}\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C1\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C2\n                            </button>\n                        </div>\n                    </td>\n                </tr>\n            `;
                })
                .join('');
        })(e));
    const t = document.querySelector('#queue .queue-admin-table-wrap');
    t instanceof HTMLElement &&
        t.setAttribute(
            'aria-busy',
            String(An.bulkActionInFlight || An.bulkReprintInFlight)
        );
}
async function ga() {
    if (!An.realtimeEnabled) return;
    if (!ba()) return (Hn('paused', 'Cola en pausa'), void Pn());
    if (document.hidden)
        return (Hn('paused', 'Cola en pausa (pestana oculta)'), void jn());
    if (!1 === navigator.onLine)
        return (
            (An.realtimeFailureStreak += 1),
            Hn('offline', 'Sin conexion al backend', {
                log: !0,
                level: 'warning',
                reason: 'Realtime',
            }),
            void jn()
        );
    if (An.realtimeRequestInFlight) return void jn();
    An.realtimeRequestInFlight = !0;
    const e = await ya({ silent: !0, fromRealtime: !0 });
    if (((An.realtimeRequestInFlight = !1), e && 'live' === An.lastRefreshMode))
        ((An.realtimeFailureStreak = 0),
            Hn('live', 'Cola en vivo', {
                log: !0,
                level: 'info',
                reason: 'Realtime',
            }),
            Fn({ log: !0 }));
    else if (
        !e ||
        ('snapshot' !== An.lastRefreshMode &&
            'state_fallback' !== An.lastRefreshMode)
    )
        ((An.realtimeFailureStreak += 1),
            Hn(
                'reconnecting',
                `Reintentando en ${Math.max(1, Math.ceil(Rn() / 1e3))}s`,
                { log: !0, level: 'warning', reason: 'Realtime' }
            ));
    else {
        An.realtimeFailureStreak += 1;
        const e = Math.max(1, Math.ceil(Rn() / 1e3));
        Hn(
            'reconnecting',
            'state_fallback' === An.lastRefreshMode
                ? `Cola visible (fallback) · reconectando en ${e}s`
                : `Respaldo local activo · reconectando en ${e}s`,
            { log: !0, level: 'warning', reason: 'Realtime' }
        );
    }
    jn();
}
function ba() {
    return (
        'queue' === document.querySelector('.nav-item.active')?.dataset.section
    );
}
async function ha({
    fromRealtime: e = !1,
    silent: t = !1,
    reason: n = 'data_error',
} = {}) {
    try {
        const a = await w('queue-state'),
            i = a?.data || {};
        return (
            h(
                (function (e, t = []) {
                    const n = new Map();
                    if (Array.isArray(t))
                        for (const e of t) {
                            const t = Number(e?.id || 0);
                            t && n.set(t, e);
                        }
                    const a = new Map(),
                        i =
                            String(e?.updatedAt || '').trim() ||
                            new Date().toISOString(),
                        o = (e, t) => {
                            const o = Number(e?.id || 0);
                            if (!o) return;
                            const r = n.get(o) || {},
                                s = String(t || 'waiting').toLowerCase(),
                                c = Number(
                                    e?.assignedConsultorio ||
                                        r.assignedConsultorio ||
                                        0
                                ),
                                l = String(e?.createdAt || r.createdAt || i),
                                u = String(e?.calledAt || r.calledAt || i);
                            a.set(o, {
                                id: o,
                                ticketCode: String(
                                    e?.ticketCode || r.ticketCode || `#${o}`
                                ),
                                queueType: String(
                                    e?.queueType || r.queueType || 'walk_in'
                                ),
                                priorityClass: String(
                                    e?.priorityClass ||
                                        r.priorityClass ||
                                        'walk_in'
                                ),
                                status: s,
                                assignedConsultorio:
                                    1 === c || 2 === c ? c : null,
                                createdAt: l,
                                calledAt: 'called' === s ? u : '',
                                completedAt: '',
                                patientInitials: String(
                                    e?.patientInitials ||
                                        r.patientInitials ||
                                        '--'
                                ),
                                phoneLast4: String(
                                    e?.phoneLast4 || r.phoneLast4 || ''
                                ),
                            });
                        },
                        r = Array.isArray(e?.nextTickets) ? e.nextTickets : [];
                    for (const e of r) o(e, 'waiting');
                    const s = Array.isArray(e?.callingNow) ? e.callingNow : [];
                    for (const e of s) o(e, 'called');
                    return Array.from(a.values());
                })(i, s)
            ),
            y(Gn(i)),
            (function (e, { reason: t = 'state_fallback' } = {}) {
                const n = Number(e?.waitingCount || 0),
                    a = Number(e?.calledCount || 0),
                    i = Array.isArray(e?.nextTickets)
                        ? e.nextTickets.length
                        : 0,
                    o = Array.isArray(e?.callingNow) ? e.callingNow.length : 0,
                    r = Math.max(0, n + a),
                    s = Math.max(0, i + o);
                An.fallbackContext = {
                    reason: String(t || 'state_fallback'),
                    waitingCount: Math.max(0, n),
                    calledCount: Math.max(0, a),
                    nextTicketsCount: Math.max(0, i),
                    callingNowCount: Math.max(0, o),
                    knownCount: r,
                    sampledCount: s,
                    partial: r > s,
                    updatedAt:
                        String(e?.updatedAt || '').trim() ||
                        new Date().toISOString(),
                };
            })(i, { reason: n }),
            (An.lastRefreshMode = 'state_fallback'),
            Tn('sync_fallback_queue_state', {
                source: e ? 'realtime' : 'manual',
                reason: String(n || 'data_error'),
                queueCount: Number(i?.waitingCount || 0),
            }),
            pa(),
            !t &&
                ba() &&
                Hn(
                    'reconnecting',
                    'Cola visible (fallback). Reintentando sincronización completa...',
                    {
                        log: !0,
                        level: 'warning',
                        reason: 'Fallback queue-state',
                    }
                ),
            !0
        );
    } catch (e) {
        return !1;
    }
}
async function ya({ silent: e = !1, fromRealtime: t = !1 } = {}) {
    try {
        const n = (await w('data')).data || {},
            a = Array.isArray(n.queue_tickets);
        if (
            !a &&
            (await ha({
                silent: e,
                fromRealtime: t,
                reason: 'data_missing_queue_tickets',
            }))
        )
            return !0;
        (h(a ? n.queue_tickets : []),
            y(
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : null
            ),
            Bn(),
            (An.lastRefreshMode = 'live'),
            (An.lastHealthySyncAt = Date.now()),
            (function () {
                try {
                    const e = {
                        savedAt: new Date().toISOString(),
                        data: {
                            queueTickets: Array.isArray(s) ? s : [],
                            queueMeta: c && 'object' == typeof c ? c : null,
                        },
                    };
                    localStorage.setItem(Ln, JSON.stringify(e));
                } catch (e) {}
            })(),
            Tn('sync_success', {
                source: t ? 'realtime' : 'manual',
                queueCount: Array.isArray(n.queue_tickets)
                    ? n.queue_tickets.length
                    : 0,
            }),
            pa());
        const i = Fn({ log: !t && ba() });
        return (
            t ||
                !ba() ||
                i.stale ||
                Hn('live', 'Cola sincronizada', {
                    log: !0,
                    level: 'info',
                    reason: 'Sincronizacion manual',
                }),
            !0
        );
    } catch (n) {
        if (
            await ha({
                silent: e,
                fromRealtime: t,
                reason: 'data_request_error',
            })
        )
            return !0;
        const a = Dn(Nn(), { source: t ? 'realtime_error' : 'manual_error' });
        return (
            a || Bn(),
            (An.lastRefreshMode = a ? 'snapshot' : 'error'),
            a
                ? Tn('sync_fallback_snapshot', {
                      source: t ? 'realtime' : 'manual',
                  })
                : Tn('sync_failed', {
                      source: t ? 'realtime' : 'manual',
                      error: oa(n),
                  }),
            !t &&
                ba() &&
                Hn(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    a
                        ? 'Respaldo local activo'
                        : !1 === navigator.onLine
                          ? 'Sin conexion al backend'
                          : 'No se pudo sincronizar cola',
                    {
                        log: !0,
                        level:
                            a || !1 === navigator.onLine ? 'warning' : 'error',
                        reason: 'Sincronizacion manual',
                    }
                ),
            e ||
                a ||
                E(`No se pudo actualizar turnero: ${n.message}`, 'warning'),
            a
        );
    }
}
function va({ immediate: e = !0 } = {}) {
    return (
        (An.realtimeEnabled = !0),
        (An.realtimeFailureStreak = 0),
        ba()
            ? e
                ? (Hn('live', 'Sincronizando cola...'), Pn(), void ga())
                : (Hn('live', 'Cola en vivo'), void jn())
            : (Hn('paused', 'Cola en pausa'), void Pn())
    );
}
function Sa({ reason: e = 'paused' } = {}) {
    ((An.realtimeEnabled = !1),
        (An.realtimeFailureStreak = 0),
        (An.realtimeRequestInFlight = !1),
        Pn());
    const t = String(e || 'paused').toLowerCase();
    'offline' !== t
        ? Hn(
              'paused',
              'hidden' !== t
                  ? 'Cola en pausa'
                  : 'Cola en pausa (pestana oculta)'
          )
        : Hn('offline', 'Sin conexion al backend');
}
async function wa(e, t, n = null, { silent: a = !1, skipRender: i = !1 } = {}) {
    try {
        const o = await (async function (e, t, n = null) {
            const a = Number(e || 0);
            if (!a || !t) throw new Error('Accion de ticket invalida');
            const i = { id: a, action: t },
                o = Number(n || 0);
            [1, 2].includes(o) && (i.consultorio = o);
            const r = await w('queue-ticket', { method: 'PATCH', body: i }),
                s = r?.data?.ticket || null;
            return (ia(s), y(Gn(r?.data?.queueState || {})), s);
        })(e, t, n);
        return (
            i || pa(),
            a ||
                (xn(ca(t, o?.ticketCode || ''), { level: 'info' }),
                E(ca(t, o?.ticketCode || ''), 'success')),
            Tn('ticket_action_success', {
                action: String(t || ''),
                ticketId: Number(e || 0),
                consultorio: Number(n || 0) || null,
            }),
            !0
        );
    } catch (n) {
        return sa(n)
            ? (await ya({ silent: !0 }),
              a || (xn(oa(n), { level: 'warning' }), E(oa(n), 'warning')),
              Tn('ticket_action_busy', {
                  action: String(t || ''),
                  ticketId: Number(e || 0),
                  error: oa(n),
              }),
              !1)
            : (a ||
                  (xn(`Error al actualizar ticket: ${oa(n)}`, {
                      level: 'error',
                  }),
                  E(`No se pudo actualizar ticket: ${oa(n)}`, 'error')),
              Tn('ticket_action_failed', {
                  action: String(t || ''),
                  ticketId: Number(e || 0),
                  error: oa(n),
              }),
              !1);
    }
}
async function ka(e) {
    const t = String(e || '').toLowerCase();
    if (!Cn.includes(t))
        return (
            E('Accion masiva invalida', 'error'),
            { ok: !1, success: 0, failed: 0 }
        );
    if (An.bulkActionInFlight) return { ok: !1, success: 0, failed: 0 };
    const n = aa(t, An.lastViewState || ta());
    if (0 === n.length)
        return (
            xn(`Bulk ${t}: sin tickets visibles elegibles`, { level: 'info' }),
            E(`No hay tickets visibles para ${na(t).toLowerCase()}.`, 'info'),
            { ok: !1, success: 0, failed: 0 }
        );
    if (
        !window.confirm(
            `Se aplicara "${na(t)}" a ${n.length} ticket(s) visibles. Deseas continuar?`
        )
    )
        return { ok: !1, success: 0, failed: 0 };
    ((An.bulkActionInFlight = !0),
        pa(),
        Tn('bulk_action_started', { action: t, requested: n.length }));
    let a = 0,
        i = 0;
    try {
        for (const e of n)
            (await wa(Number(e?.id || 0), t, null, {
                silent: !0,
                skipRender: !0,
            }))
                ? (a += 1)
                : (i += 1);
        await ya({ silent: !0 });
    } finally {
        ((An.bulkActionInFlight = !1), pa());
    }
    return a > 0 && 0 === i
        ? (xn(`Bulk ${t}: ${a} ticket(s) procesados`, { level: 'info' }),
          E(`${na(t)} aplicado a ${a} ticket(s).`, 'success'),
          Tn('bulk_action_success', { action: t, success: a, failed: i }),
          { ok: !0, success: a, failed: i })
        : a > 0
          ? (xn(`Bulk ${t}: ${a} exitos y ${i} fallos`, { level: 'warning' }),
            E(`${na(t)} parcial: ${a} exitos, ${i} fallos.`, 'warning'),
            Tn('bulk_action_partial', { action: t, success: a, failed: i }),
            { ok: !0, success: a, failed: i })
          : (xn(`Bulk ${t}: fallo total`, { level: 'error' }),
            E(
                `No se pudo aplicar ${na(t).toLowerCase()} en tickets visibles.`,
                'error'
            ),
            Tn('bulk_action_failed', { action: t, success: a, failed: i }),
            { ok: !1, success: a, failed: i });
}
async function Ca() {
    if (An.bulkReprintInFlight) return { ok: !1, success: 0, failed: 0 };
    const e = An.lastViewState || ta(),
        t = Array.isArray(e?.tickets) ? e.tickets : [];
    if (t.length <= 0)
        return (
            E('No hay tickets visibles para reimprimir.', 'info'),
            { ok: !1, success: 0, failed: 0 }
        );
    const n = t.slice(0, 20);
    if (
        !window.confirm(
            `Se reimprimiran ${n.length} ticket(s) visibles. Deseas continuar?`
        )
    )
        return { ok: !1, success: 0, failed: 0 };
    ((An.bulkReprintInFlight = !0),
        pa(),
        Tn('bulk_reprint_started', { requested: n.length }));
    let a = 0,
        i = 0;
    try {
        for (const e of n) {
            const t = Number(e?.id || 0);
            if (t)
                try {
                    const e = await ra(t);
                    e.payload?.printed ? (a += 1) : (i += 1);
                } catch (e) {
                    i += 1;
                }
            else i += 1;
        }
    } finally {
        ((An.bulkReprintInFlight = !1), pa());
    }
    return a > 0 && 0 === i
        ? (xn(`Bulk reimpresion: ${a} ticket(s) reimpresos`, { level: 'info' }),
          E(`Reimpresion completa: ${a} ticket(s).`, 'success'),
          Tn('bulk_reprint_success', { success: a, failed: i }),
          { ok: !0, success: a, failed: i })
        : a > 0
          ? (xn(`Bulk reimpresion parcial: ${a} exitos y ${i} fallos`, {
                level: 'warning',
            }),
            E(`Reimpresion parcial: ${a} exitos, ${i} fallos.`, 'warning'),
            Tn('bulk_reprint_partial', { success: a, failed: i }),
            { ok: !0, success: a, failed: i })
          : (xn('Bulk reimpresion: fallo total', { level: 'error' }),
            E('No se pudo reimprimir tickets visibles.', 'error'),
            Tn('bulk_reprint_failed', { success: a, failed: i }),
            { ok: !1, success: a, failed: i });
}
function Ea(e) {
    ((An.activeFilter = Qn(e)), pa());
}
function $a() {
    ma();
    const e = document.getElementById('queueSearchInput');
    e instanceof HTMLInputElement &&
        (e.focus({ preventScroll: !0 }), e.select());
}
const La = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'reviews'],
        ['digit5', 'availability'],
        ['digit6', 'queue'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'reviews'],
        ['5', 'availability'],
        ['6', 'queue'],
    ]),
    Aa = [
        'a[href]',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','),
    Ba = 'adminLastSection',
    Ia = 'adminSidebarCollapsed',
    Ta = 'queueStationMode',
    qa = 'queueStationConsultorio',
    Ma = 'locked',
    Na = 'free',
    Da = {
        dashboard: {
            title: 'Acciones rápidas: dashboard',
            actions: [
                {
                    action: 'refresh-admin-data',
                    icon: 'fa-rotate-right',
                    label: 'Actualizar datos',
                },
                {
                    action: 'context-open-appointments-today',
                    icon: 'fa-calendar-day',
                    label: 'Citas de hoy',
                },
                {
                    action: 'context-open-callbacks-pending',
                    icon: 'fa-phone',
                    label: 'Callbacks pendientes',
                },
            ],
        },
        appointments: {
            title: 'Acciones rápidas: citas',
            actions: [
                {
                    action: 'appointment-quick-filter',
                    filterValue: 'today',
                    icon: 'fa-calendar-day',
                    label: 'Filtrar hoy',
                },
                {
                    action: 'appointment-quick-filter',
                    filterValue: 'pending_transfer',
                    icon: 'fa-money-check-dollar',
                    label: 'Por validar',
                },
                {
                    action: 'clear-appointment-filters',
                    icon: 'fa-filter-circle-xmark',
                    label: 'Limpiar filtros',
                },
                {
                    action: 'export-csv',
                    icon: 'fa-file-csv',
                    label: 'Exportar CSV',
                },
            ],
        },
        callbacks: {
            title: 'Acciones rápidas: callbacks',
            actions: [
                {
                    action: 'callback-quick-filter',
                    filterValue: 'pending',
                    icon: 'fa-phone',
                    label: 'Pendientes',
                },
                {
                    action: 'callback-quick-filter',
                    filterValue: 'today',
                    icon: 'fa-calendar-day',
                    label: 'Hoy',
                },
                {
                    action: 'clear-callback-filters',
                    icon: 'fa-filter-circle-xmark',
                    label: 'Limpiar filtros',
                },
                {
                    action: 'context-open-appointments-transfer',
                    icon: 'fa-calendar-check',
                    label: 'Ver citas por validar',
                },
                {
                    action: 'context-open-callbacks-next',
                    icon: 'fa-phone-volume',
                    label: 'Siguiente llamada',
                },
            ],
        },
        reviews: {
            title: 'Acciones rápidas: reseñas',
            actions: [
                {
                    action: 'refresh-admin-data',
                    icon: 'fa-rotate-right',
                    label: 'Actualizar datos',
                },
                {
                    action: 'context-open-dashboard',
                    icon: 'fa-chart-line',
                    label: 'Volver a dashboard',
                },
                {
                    action: 'context-open-callbacks-pending',
                    icon: 'fa-headset',
                    label: 'Revisar callbacks',
                },
            ],
        },
        availability: {
            title: 'Acciones rápidas: disponibilidad',
            actions: [
                {
                    action: 'context-availability-today',
                    icon: 'fa-calendar-day',
                    label: 'Ir a hoy',
                },
                {
                    action: 'context-availability-next',
                    icon: 'fa-forward',
                    label: 'Siguiente con horarios',
                },
                {
                    action: 'context-focus-slot-input',
                    icon: 'fa-clock',
                    label: 'Agregar horario',
                },
                {
                    action: 'context-copy-availability-day',
                    icon: 'fa-copy',
                    label: 'Copiar día',
                },
            ],
        },
        queue: {
            title: 'Acciones rápidas: turnero sala',
            actions: [
                {
                    action: 'queue-call-next',
                    queueConsultorio: '1',
                    icon: 'fa-bullhorn',
                    label: 'Llamar C1',
                },
                {
                    action: 'queue-call-next',
                    queueConsultorio: '2',
                    icon: 'fa-bullhorn',
                    label: 'Llamar C2',
                },
                {
                    action: 'queue-refresh-state',
                    icon: 'fa-rotate-right',
                    label: 'Refrescar cola',
                },
                {
                    action: 'context-open-dashboard',
                    icon: 'fa-chart-line',
                    label: 'Volver dashboard',
                },
            ],
        },
    };
let _a = 0,
    xa = 0;
const Ha = { mode: Na, consultorio: 1 };
function Fa(e, t = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'admin',
                    event: String(e || 'unknown'),
                    at: new Date().toISOString(),
                    ...t,
                },
            })
        );
    } catch (e) {}
}
function Ra() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function Pa(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(Ra().map((e) => e.dataset.section)).has(n) ? n : t;
}
function ja() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? Pa(e, 'dashboard')
        : (function () {
              try {
                  return Pa(localStorage.getItem(Ba), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function Oa() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        ja() ||
        'dashboard'
    );
}
function Ua() {
    return window.innerWidth <= 1024;
}
function za() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Va() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function Wa(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function Ka(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!Ua() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        Wa(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(Ia, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function Ga() {
    Ua()
        ? Ka(!1, { persist: !1 })
        : Ka(
              (function () {
                  try {
                      return '1' === localStorage.getItem(Ia);
                  } catch (e) {
                      return !1;
                  }
              })(),
              { persist: !1 }
          );
}
function Ja(e) {
    const t = Pa(e, 'dashboard');
    (Ra().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = Pa(e, 'dashboard');
            try {
                localStorage.setItem(Ba, t);
            } catch (e) {}
        })(t));
}
function Ya(e, t = Na) {
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return n === Ma || n === Na ? n : t;
}
function Qa(e, t = 1) {
    const n = Number(e || 0);
    return 1 === n || 2 === n ? n : t;
}
function Xa(e, t) {
    try {
        (localStorage.setItem(Ta, Ya(e, Na)),
            localStorage.setItem(qa, String(Qa(t, 1))));
    } catch (e) {}
}
function Za() {
    return Ha.mode === Ma;
}
function ei(e) {
    const t = Qa(e, 0);
    return !(![1, 2].includes(t) || (Za() && t !== Ha.consultorio));
}
function ti() {
    const e = document.getElementById('queue');
    if (!(e instanceof HTMLElement)) return;
    const t = Ya(Ha.mode, Na),
        n = Qa(Ha.consultorio, 1);
    ((e.dataset.stationMode = t), (e.dataset.stationConsultorio = String(n)));
    const a = document.getElementById('queueStationBadge');
    a instanceof HTMLElement &&
        ((a.textContent = `Estación C${n}`),
        (a.dataset.consultorio = String(n)));
    const i = document.getElementById('queueStationModeBadge');
    if (i instanceof HTMLElement) {
        const e = t === Ma;
        ((i.dataset.mode = e ? Ma : Na),
            (i.textContent = e ? 'Bloqueado' : 'Libre'));
    }
    const o = document.getElementById('queueStationHint');
    (o instanceof HTMLElement &&
        (o.textContent =
            t === Ma
                ? `Numpad Enter llama siempre en C${n}.`
                : 'Modo libre: Numpad 1/2 selecciona consultorio, Numpad Enter llama.'),
        document
            .querySelectorAll('[data-action="queue-lock-station"]')
            .forEach((e) => {
                if (!(e instanceof HTMLButtonElement)) return;
                const a = Qa(e.dataset.queueConsultorio || 0, 0),
                    i = t === Ma && a === n;
                (e.classList.toggle('is-active', i),
                    (e.disabled = t === Ma),
                    e.setAttribute('aria-pressed', String(i)));
            }));
    const r = document.querySelector(
        '[data-action="queue-set-station-mode"][data-queue-mode="free"]'
    );
    if (r instanceof HTMLButtonElement) {
        const e = t === Na;
        (r.classList.toggle('is-active', e),
            (r.disabled = e),
            r.setAttribute('aria-pressed', String(e)));
    }
    const s = document.querySelector(
        '[data-action="queue-reconfigure-station"]'
    );
    (s instanceof HTMLButtonElement && (s.disabled = t !== Ma),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((e) => {
                if (!(e instanceof HTMLElement)) return;
                e.dataset.stationDefaultTitle ||
                    (e.dataset.stationDefaultTitle = String(
                        e.getAttribute('title') || ''
                    ).trim());
                const a = Qa(e.dataset.queueConsultorio || 0, 0),
                    i = t === Ma && a !== n;
                if (
                    (e.classList.toggle('is-station-blocked', i),
                    e instanceof HTMLButtonElement &&
                        e.setAttribute('aria-disabled', String(e.disabled)),
                    i)
                )
                    e.setAttribute(
                        'title',
                        `Estación bloqueada en C${n}. Click para llamado manual en C${a}.`
                    );
                else {
                    const t = String(
                        e.dataset.stationDefaultTitle || ''
                    ).trim();
                    t ? e.setAttribute('title', t) : e.removeAttribute('title');
                }
            }));
}
function ni(
    { mode: e = Ha.mode, consultorio: t = Ha.consultorio },
    { persist: n = !0, announce: a = !1, source: i = 'manual' } = {}
) {
    const o = Ya(e, Ha.mode),
        r = Qa(t, Ha.consultorio),
        s = o !== Ha.mode,
        c = r !== Ha.consultorio;
    ((Ha.mode = o),
        (Ha.consultorio = r),
        n && Xa(o, r),
        ti(),
        a &&
            (s || c) &&
            (o === Ma
                ? E(`Estación bloqueada en C${r}`, 'success')
                : E(`Estación en modo libre (C${r})`, 'info')),
        (s || c) &&
            Fa('station_config_updated', {
                source: i,
                mode: o,
                consultorio: r,
                changedMode: s,
                changedConsultorio: c,
            }));
}
function ai(e, t) {
    const n = String(t || '');
    if (!n) return !1;
    if (String(e.code || '').toLowerCase() === `numpad${n}`) return !0;
    const a = String(e.key || '');
    return 3 === Number(e.location || 0) && a === n;
}
function ii(e, { source: t = 'manual' } = {}) {
    const n = Qa(e, 0);
    (E(
        `Cambio bloqueado por modo estación (C${Ha.consultorio}). Usa "Reconfigurar estación" para cambiar.`,
        'warning'
    ),
        Fa('station_change_blocked', {
            source: t,
            attemptedConsultorio: n || null,
            stationConsultorio: Ha.consultorio,
            stationMode: Ha.mode,
        }),
        ti());
}
function oi(e, { source: t = 'numpad' } = {}) {
    const n = Qa(e, 0);
    [1, 2].includes(n) &&
        (Za()
            ? ii(n, { source: t })
            : (ni(
                  { mode: Na, consultorio: n },
                  { persist: !0, announce: !1, source: t }
              ),
              E(`Consultorio objetivo C${n}`, 'info')));
}
async function ri(e, { source: t = 'manual' } = {}) {
    const n = Qa(e, 0);
    if (![1, 2].includes(n)) return (E('Consultorio invalido', 'error'), !1);
    const a = String(t || 'manual').toLowerCase(),
        i = 'numpad' === a || 'shortcut' === a || 'command' === a;
    return !ei(n) && i
        ? (ii(n, { source: t }), !1)
        : (!ei(n) &&
              Za() &&
              (E(
                  `Estación bloqueada en C${Ha.consultorio}. Llamando manualmente C${n}.`,
                  'warning'
              ),
              Fa('station_manual_override', {
                  source: t,
                  consultorio: n,
                  stationConsultorio: Ha.consultorio,
              })),
          Za() && Fa('station_locked_call', { source: t, consultorio: n }),
          'numpad' === t && E(`Llamando siguiente en C${n}`, 'info'),
          await (async function (e) {
              const t = Number(e || 0);
              if (![1, 2].includes(t))
                  return void E('Consultorio invalido', 'error');
              const n = String(t);
              if (!An.pendingCallByConsultorio.has(n)) {
                  (An.pendingCallByConsultorio.add(n), fa());
                  try {
                      const e = await w('queue-call-next', {
                              method: 'POST',
                              body: { consultorio: t },
                          }),
                          n = e?.data?.ticket || null;
                      (ia(n),
                          y(Gn(e?.data?.queueState || {})),
                          pa(),
                          n && n.ticketCode
                              ? (xn(
                                    `Llamado en C${t}: ${n.ticketCode} (${n.patientInitials || '--'})`,
                                    { level: 'info' }
                                ),
                                E(
                                    `Llamando ${n.ticketCode} en Consultorio ${t}`,
                                    'success'
                                ),
                                Tn('call_next_success', {
                                    consultorio: t,
                                    ticketId: Number(n.id || 0),
                                    ticketCode: String(n.ticketCode || ''),
                                }))
                              : (xn(`Llamado en C${t} sin ticket asignado`, {
                                    level: 'warning',
                                }),
                                E(`Consultorio ${t} actualizado`, 'success'),
                                Tn('call_next_empty', { consultorio: t })));
                  } catch (e) {
                      if (sa(e))
                          return (
                              await ya({ silent: !0 }),
                              xn(`C${t} ocupado: ${oa(e)}`, {
                                  level: 'warning',
                              }),
                              E(oa(e), 'warning'),
                              void Tn('call_next_busy', {
                                  consultorio: t,
                                  error: oa(e),
                              })
                          );
                      (xn(`Error llamando siguiente en C${t}: ${oa(e)}`, {
                          level: 'error',
                      }),
                          E(
                              `No se pudo llamar siguiente turno: ${oa(e)}`,
                              'error'
                          ),
                          Tn('call_next_failed', {
                              consultorio: t,
                              error: oa(e),
                          }));
                  } finally {
                      (An.pendingCallByConsultorio.delete(n), fa());
                  }
              }
          })(n),
          window.requestAnimationFrame(() => {
              ti();
          }),
          !0);
}
function si(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function ci() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !_a))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - _a),
        a = (function (e) {
            if (!_a) return 'sin actualizar';
            const t = Math.max(0, e - _a),
                n = Math.floor(t / 6e4);
            return n <= 0
                ? 'hace menos de 1 min'
                : 1 === n
                  ? 'hace 1 min'
                  : `hace ${n} min`;
        })(t),
        i = n >= 3e5;
    (e.classList.remove('status-pill-muted'),
        e.classList.add(i ? 'status-pill-stale' : 'status-pill-live'),
        (e.textContent = `Datos: ${a}`));
}
function li() {
    ((_a = Date.now()), ci());
}
function ui({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function di(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = Da[e && Da[e] ? e : 'dashboard'];
    ((t.textContent = a.title),
        (n.innerHTML = ''),
        a.actions.forEach((e) => {
            n.appendChild(
                (function (e) {
                    const t = document.createElement('button');
                    return (
                        (t.type = 'button'),
                        (t.className = 'admin-context-action-btn'),
                        (t.dataset.action = e.action),
                        e.filterValue &&
                            (t.dataset.filterValue = e.filterValue),
                        e.targetSection &&
                            (t.dataset.targetSection = e.targetSection),
                        e.queueConsultorio &&
                            (t.dataset.queueConsultorio = e.queueConsultorio),
                        (t.title = e.hint || e.label),
                        (t.innerHTML = `<i class="fas ${e.icon}" aria-hidden="true"></i><span>${e.label}</span>`),
                        t
                    );
                })(e)
            );
        }),
        ti());
}
function mi() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function fi() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(Aa)).filter((e) => {
              if (!(e instanceof HTMLElement)) return !1;
              if (e.hasAttribute('disabled')) return !1;
              if ('true' === e.getAttribute('aria-hidden')) return !1;
              if (e.closest('.is-hidden')) return !1;
              if (0 === e.getClientRects().length) return !1;
              if (0 === e.offsetWidth && 0 === e.offsetHeight) return !1;
              const t = window.getComputedStyle(e);
              return 'none' !== t.display && 'hidden' !== t.visibility;
          })
        : [];
}
function pi(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = Ua(),
        i = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!i && a)),
        n &&
            (i
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function gi(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = mi();
    if (!t || !n || !a) return;
    const i = Boolean(e && Ua());
    (t.classList.toggle('is-open', i),
        n.classList.toggle('is-hidden', !i),
        n.setAttribute('aria-hidden', String(!i)),
        document.body.classList.toggle('admin-sidebar-open', i),
        a.setAttribute('aria-expanded', String(i)),
        pi(i),
        i &&
            (function () {
                const e = document.getElementById('adminSidebar');
                if (!e) return;
                const t = e.querySelector('.nav-item.active');
                if (t instanceof HTMLElement)
                    return (
                        t.scrollIntoView({ block: 'nearest' }),
                        void t.focus()
                    );
                const n = fi();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function bi({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = mi(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (gi(!1), e && n && t && t.focus());
}
function hi(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function yi(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: i = !0,
            closeMobileNav: o = !0,
        } = t,
        r = Pa(Oa(), 'dashboard'),
        s = Pa(e, 'dashboard');
    if (
        'availability' === r &&
        'availability' !== s &&
        Bt() &&
        !confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        )
    )
        return (Ja(r), a || si(r), i && hi(r), !1);
    if ((Ja(s), o && bi(), n))
        try {
            (await H(), li());
        } catch (e) {
            E(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    return (await Ci(s), a && si(s), i && hi(s), !0);
}
async function vi(e) {
    (await yi('appointments', { focus: !1 }),
        ft(e, { preserveSearch: !1 }),
        hi('appointments'));
}
async function Si(e) {
    (await yi('callbacks', { focus: !1 }),
        Se(e, { preserveSearch: !1 }),
        hi('callbacks'));
}
async function wi({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await H(),
            li(),
            await Ci(Oa()),
            e && E('Datos actualizados', 'success'),
            !0
        );
    } catch (e) {
        return (
            t &&
                E(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                ),
            !1
        );
    }
}
async function ki(e) {
    const t = document.getElementById('adminQuickCommand'),
        n = String(e || '')
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    if (!n)
        return (
            E(
                'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
                'info'
            ),
            ui(),
            !1
        );
    if ('help' === n || 'ayuda' === n)
        return (
            E(
                'Comandos: citas hoy, citas por validar, callbacks pendientes, turnero c1/c2, turnero sla, disponibilidad hoy, exportar csv.',
                'info'
            ),
            !0
        );
    if (n.includes('exportar') && n.includes('csv'))
        return (
            await yi('appointments', { focus: !1 }),
            bt(),
            hi('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await yi('dashboard'), !0);
    if (
        n.includes('turnero') ||
        n.includes('cola') ||
        n.includes('consultorio')
    )
        return (
            await yi('queue', { focus: !1 }),
            n.includes('c1') || n.includes('consultorio 1')
                ? await ri(1, { source: 'command' })
                : n.includes('completar visibles') ||
                    n.includes('bulk completar')
                  ? await ka('completar')
                  : n.includes('no show visibles') || n.includes('bulk no show')
                    ? await ka('no_show')
                    : n.includes('cancelar visibles') ||
                        n.includes('bulk cancelar')
                      ? await ka('cancelar')
                      : n.includes('sla')
                        ? (Ea('sla_risk'), $a())
                        : n.includes('buscar')
                          ? $a()
                          : n.includes('c2') || n.includes('consultorio 2')
                            ? await ri(2, { source: 'command' })
                            : await ya({ silent: !0 }),
            hi('queue'),
            !0
        );
    if (n.includes('resena') || n.includes('review'))
        return (await yi('reviews'), !0);
    if (n.includes('callback'))
        return (
            await Si(
                n.includes('hoy')
                    ? 'today'
                    : n.includes('contactado')
                      ? 'contacted'
                      : 'pending'
            ),
            !0
        );
    if (n.includes('cita') || n.includes('agenda')) {
        const e = n.includes('hoy')
            ? 'today'
            : n.includes('validar') ||
                n.includes('transferencia') ||
                n.includes('por validar')
              ? 'pending_transfer'
              : n.includes('no show') || n.includes('no asistio')
                ? 'no_show'
                : 'all';
        return (await vi(e), n.includes('limpiar') && pt(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await yi('availability', { focus: !1 }),
          n.includes('hoy')
              ? tn()
              : n.includes('siguiente')
                ? nn()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  an(),
          hi('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await wi({ showSuccessToast: !0 }), !0)
          : (E(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function Ci(e) {
    const t = document.getElementById('pageTitle');
    (t &&
        (t.textContent =
            {
                dashboard: 'Dashboard',
                appointments: 'Citas',
                callbacks: 'Callbacks',
                reviews: 'Resenas',
                availability: 'Disponibilidad',
                queue: 'Turnero Sala',
            }[e] || 'Dashboard'),
        di(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const o = document.getElementById(e);
    switch (
        (o && o.classList.add('active'),
        'queue' !== e && Sa({ reason: 'paused' }),
        e)
    ) {
        case 'dashboard':
        default:
            K();
            break;
        case 'appointments':
            mt();
            break;
        case 'callbacks':
            (ue(),
                he(),
                ve({
                    filter: oe().filterSelect?.value || X.filter,
                    sort: oe().sortSelect?.value || X.sort,
                    search: oe().searchInput?.value || X.search,
                }));
            break;
        case 'reviews':
            !(function () {
                const e =
                    n.length > 0
                        ? (
                              n.reduce(
                                  (e, t) => e + (Number(t.rating) || 0),
                                  0
                              ) / n.length
                          ).toFixed(1)
                        : '0.0';
                ((document.getElementById('adminAvgRating').textContent = e),
                    (document.getElementById('totalReviewsCount').textContent =
                        `${n.length} reseñas`));
                const t = document.getElementById('adminRatingStars'),
                    a = Math.floor(Number(e));
                t.innerHTML = '';
                for (let e = 1; e <= 5; e += 1) {
                    const n = document.createElement('i');
                    ((n.className = e <= a ? 'fas fa-star' : 'far fa-star'),
                        t.appendChild(n));
                }
                const i = document.getElementById('reviewsGrid');
                0 !== n.length
                    ? (i.innerHTML = n
                          .slice()
                          .sort((e, t) =>
                              String(t.date || '').localeCompare(
                                  String(e.date || '')
                              )
                          )
                          .map(
                              (e) =>
                                  `\n            <div class="review-card-admin">\n                <div class="review-header-admin">\n                    <strong>${C(e.name || 'Paciente')}</strong>\n                    ${e.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}\n                </div>\n                <div class="review-rating">${'★'.repeat(Number(e.rating) || 0)}${'☆'.repeat(5 - (Number(e.rating) || 0))}</div>\n                <p>${C(e.text || '')}</p>\n                <small>${C(new Date(e.date).toLocaleDateString('es-EC'))}</small>\n            </div>\n        `
                          )
                          .join(''))
                    : (i.innerHTML =
                          '<p class="empty-message">No hay reseñas registradas</p>');
            })();
            break;
        case 'availability':
            await (async function () {
                if (
                    (await (async function () {
                        try {
                            const e = await w('availability', {
                                    query: {
                                        doctor: 'indiferente',
                                        service: 'consulta',
                                        days: 45,
                                    },
                                }),
                                t =
                                    e && e.data && 'object' == typeof e.data
                                        ? e.data
                                        : {},
                                n =
                                    e && e.meta && 'object' == typeof e.meta
                                        ? e.meta
                                        : {},
                                o = i && 'object' == typeof i ? i : {},
                                r = {
                                    ...o,
                                    ...n,
                                    source: String(
                                        n.source || o.source || 'store'
                                    ),
                                    mode: String(n.mode || o.mode || 'live'),
                                    timezone: String(
                                        n.timezone ||
                                            o.timezone ||
                                            'America/Guayaquil'
                                    ),
                                    generatedAt: String(
                                        n.generatedAt ||
                                            o.generatedAt ||
                                            new Date().toISOString()
                                    ),
                                };
                            if (
                                (f($t(t)),
                                p(r),
                                Lt(a),
                                (vt = 'google' === String(r.source || '')),
                                Yt(),
                                Xt(),
                                ht && !qt(ht))
                            )
                                return ((ht = null), Mt(''), void Qt());
                            ht ? sn(ht) : Qt();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                E(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (vt = 'google' === String(i.source || '')),
                                Yt(),
                                Xt());
                        }
                    })(),
                    !ht)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(Et);
                            return qt(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    qt(e) && (ht = e);
                }
                (ht && !qt(ht) && (ht = null),
                    ht && Ot(ht),
                    Zt(),
                    ht ? rn(ht, { persist: !1 }) : Qt());
            })();
            break;
        case 'queue':
            (!(function () {
                if (!An.snapshotLoaded) {
                    An.snapshotLoaded = !0;
                    const e = Nn();
                    !e ||
                        (Array.isArray(s) && 0 !== s.length) ||
                        Dn(e, { source: 'startup' });
                }
                (pa(),
                    Hn('paused', 'Sincronizacion lista'),
                    An.activityLog.length ||
                        xn('Consola de turnero lista para operacion', {
                            level: 'info',
                        }),
                    ya({ silent: !0 }));
            })(),
                va({ immediate: !0 }),
                ti());
    }
}
async function Ei() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = ja();
    (Ja(n),
        si(n),
        Ga(),
        bi(),
        await (async function () {
            const e = document.getElementById('currentDate');
            if (e) {
                const t = {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                };
                e.textContent = new Date().toLocaleDateString('es-EC', t);
            }
            try {
                (await H(), li());
            } catch (e) {
                E(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = Oa();
            await Ci(t);
        })(),
        await (async function () {
            if (Ce) return;
            Ce = !0;
            const { subscribeBtn: e, testBtn: t } = Le();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return (Ae(!1), void Ee('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await Ie(),
                        Ae(!0),
                        Ee('disponible', 'muted'),
                        e.addEventListener('click', qe),
                        t.addEventListener('click', Me),
                        await Te());
                } catch (e) {
                    (Ae(!1), Ee('sin configurar', 'warn'));
                }
            }
        })());
}
async function $i(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return k('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && v(t.csrfToken),
                E('Bienvenido al panel de administración', 'success'),
                await Ei());
        } catch {
            E('Código incorrecto o sesión expirada', 'error');
        }
        return;
    }
    const n = document.getElementById('adminPassword')?.value || '';
    try {
        const e = await (async function (e) {
            return k('login', { method: 'POST', body: { password: e } });
        })(n);
        if (e.twoFactorRequired) {
            (document
                .getElementById('passwordGroup')
                ?.classList.add('is-hidden'),
                t?.classList.remove('is-hidden'),
                document.getElementById('admin2FACode')?.focus());
            const e = document.getElementById('loginBtn');
            return (
                e && (e.innerHTML = '<i class="fas fa-check"></i> Verificar'),
                void E('Ingresa tu código 2FA', 'info')
            );
        }
        (e.csrfToken && v(e.csrfToken),
            E('Bienvenido al panel de administración', 'success'),
            await Ei());
    } catch {
        E('Contraseña incorrecta', 'error');
    }
}
function Li() {
    document.addEventListener('click', async (i) => {
        const o = i.target.closest('[data-action]');
        if (!o) return;
        const r = o.dataset.action;
        if ('close-toast' !== r) {
            if ('logout' === r)
                return (
                    i.preventDefault(),
                    void (await (async function () {
                        try {
                            await k('logout', { method: 'POST' });
                        } catch (e) {}
                        (E('Sesion cerrada correctamente', 'info'),
                            setTimeout(() => window.location.reload(), 800));
                    })())
                );
            if ('export-data' === r)
                return (
                    i.preventDefault(),
                    void (function () {
                        const i = {
                                appointments: e,
                                callbacks: t,
                                reviews: n,
                                queue_tickets: s,
                                availability: a,
                                exportDate: new Date().toISOString(),
                            },
                            o = new Blob([JSON.stringify(i, null, 2)], {
                                type: 'application/json',
                            }),
                            r = URL.createObjectURL(o),
                            c = document.createElement('a');
                        ((c.href = r),
                            (c.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`),
                            document.body.appendChild(c),
                            c.click(),
                            document.body.removeChild(c),
                            URL.revokeObjectURL(r),
                            E('Datos exportados correctamente', 'success'));
                    })()
                );
            if ('open-import-file' === r)
                return (
                    i.preventDefault(),
                    void document.getElementById('importFileInput')?.click()
                );
            if ('set-admin-theme' === r)
                return (
                    i.preventDefault(),
                    void Ve(o.dataset.themeMode || 'system', {
                        persist: !0,
                        animate: !0,
                    })
                );
            if ('toggle-sidebar-collapse' === r)
                return (
                    i.preventDefault(),
                    Ua() ? void gi(!za()) : void Ka(!Va())
                );
            if ('run-admin-command' === r) {
                i.preventDefault();
                const e = document.getElementById('adminQuickCommand');
                return void (await ki(
                    e instanceof HTMLInputElement ? e.value : ''
                ));
            }
            if ('refresh-admin-data' === r)
                return (
                    i.preventDefault(),
                    void (await wi({ showSuccessToast: !0 }))
                );
            if ('context-open-dashboard' === r)
                return (i.preventDefault(), void (await yi('dashboard')));
            if ('context-open-appointments-today' === r)
                return (i.preventDefault(), void (await vi('today')));
            if ('context-open-appointments-transfer' === r)
                return (
                    i.preventDefault(),
                    void (await vi('pending_transfer'))
                );
            if ('context-open-callbacks-pending' === r)
                return (i.preventDefault(), void (await Si('pending')));
            if ('context-open-callbacks-next' === r)
                return (i.preventDefault(), await Si('pending'), void ke());
            if ('queue-refresh-state' === r)
                return (
                    i.preventDefault(),
                    await ya({ silent: !1 }),
                    void ti()
                );
            if ('queue-lock-station' === r) {
                i.preventDefault();
                const e = Qa(o.dataset.queueConsultorio || 0, 0);
                if (![1, 2].includes(e)) return;
                return void ni(
                    { mode: Ma, consultorio: e },
                    { persist: !0, announce: !0, source: 'station_panel' }
                );
            }
            if ('queue-set-station-mode' === r)
                return (
                    i.preventDefault(),
                    void ni(
                        {
                            mode: Ya(o.dataset.queueMode || Na, Na),
                            consultorio: Ha.consultorio,
                        },
                        { persist: !0, announce: !0, source: 'station_panel' }
                    )
                );
            if ('queue-reconfigure-station' === r) {
                if (
                    (i.preventDefault(),
                    !confirm(
                        'Reconfigurar estación desbloqueará el consultorio fijo. ¿Deseas continuar?'
                    ))
                )
                    return;
                if (
                    !confirm(
                        'Confirmación final: la estación pasará a modo libre.'
                    )
                )
                    return;
                return (
                    ni(
                        { mode: Na, consultorio: Ha.consultorio },
                        {
                            persist: !0,
                            announce: !0,
                            source: 'station_reconfigure',
                        }
                    ),
                    void E(
                        'Modo libre activo. Usa Numpad 1/2 y luego bloquea la estación.',
                        'warning'
                    )
                );
            }
            if ('queue-call-next' === r)
                return (
                    i.preventDefault(),
                    void (await ri(Number(o.dataset.queueConsultorio || 0), {
                        source: 'button',
                    }))
                );
            if ('context-focus-slot-input' === r)
                return (
                    i.preventDefault(),
                    await yi('availability', { focus: !1 }),
                    void an()
                );
            if ('context-availability-today' === r)
                return (
                    i.preventDefault(),
                    await yi('availability', { focus: !1 }),
                    void tn()
                );
            if ('context-availability-next' === r)
                return (
                    i.preventDefault(),
                    await yi('availability', { focus: !1 }),
                    void nn()
                );
            if ('context-copy-availability-day' === r)
                return (
                    i.preventDefault(),
                    await yi('availability', { focus: !1 }),
                    void fn()
                );
            try {
                if ('export-csv' === r) return (i.preventDefault(), void bt());
                if ('appointment-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void ft(o.dataset.filterValue || 'all')
                    );
                if ('callback-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void Se(o.dataset.filterValue || 'all')
                    );
                if ('callbacks-triage-next' === r)
                    return (i.preventDefault(), await Si('pending'), void ke());
                if ('clear-appointment-filters' === r)
                    return (i.preventDefault(), void pt());
                if ('clear-callback-filters' === r)
                    return (
                        i.preventDefault(),
                        void ve(
                            { filter: G, sort: J, search: '' },
                            { preserveSearch: !1 }
                        )
                    );
                if ('appointment-density' === r)
                    return (
                        i.preventDefault(),
                        void (function (e) {
                            const t = rt(e);
                            (ct(t),
                                st(Je, t),
                                Boolean(
                                    document.getElementById(
                                        'appointmentsTableBody'
                                    )
                                ) && dt());
                        })(o.dataset.density || 'comfortable')
                    );
                if ('change-month' === r)
                    return (
                        i.preventDefault(),
                        void en(Number(o.dataset.delta || 0))
                    );
                if ('availability-today' === r)
                    return (i.preventDefault(), void tn());
                if ('availability-next-with-slots' === r)
                    return (i.preventDefault(), void nn());
                if ('prefill-time-slot' === r)
                    return (
                        i.preventDefault(),
                        void (function (e) {
                            if (vt)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const t = document.getElementById('newSlotTime');
                            t instanceof HTMLInputElement &&
                                ((t.value = String(e || '').trim()), t.focus());
                        })(o.dataset.time || '')
                    );
                if ('copy-availability-day' === r)
                    return (i.preventDefault(), void fn());
                if ('paste-availability-day' === r)
                    return (i.preventDefault(), void (await pn()));
                if ('duplicate-availability-day-next' === r)
                    return (i.preventDefault(), void (await gn()));
                if ('duplicate-availability-next-week' === r)
                    return (i.preventDefault(), void (await bn()));
                if ('clear-availability-day' === r)
                    return (i.preventDefault(), void (await hn()));
                if ('clear-availability-week' === r)
                    return (i.preventDefault(), void (await yn()));
                if ('save-availability-draft' === r)
                    return (i.preventDefault(), void (await un()));
                if ('discard-availability-draft' === r)
                    return (i.preventDefault(), void dn());
                if ('add-time-slot' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function () {
                            if (vt)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            if (!ht)
                                return void E(
                                    'Selecciona una fecha primero',
                                    'warning'
                                );
                            const e = document.getElementById('newSlotTime');
                            if (!(e instanceof HTMLInputElement)) return;
                            const t = String(e.value || '').trim();
                            if (!t)
                                return void E('Ingresa un horario', 'warning');
                            const n = _t(a[ht] || []);
                            n.includes(t)
                                ? E('Este horario ya existe', 'warning')
                                : (ln(() => {
                                      Rt(ht, [...n, t]);
                                  }),
                                  (e.value = ''),
                                  E(
                                      'Horario agregado a cambios pendientes',
                                      'success'
                                  ));
                        })())
                    );
                if ('remove-time-slot' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e, t) {
                            if (vt)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const n = String(e || '').trim(),
                                i = String(t || '').trim();
                            if (!qt(n) || !i)
                                return void E(
                                    'No se pudo identificar el horario a eliminar',
                                    'warning'
                                );
                            const o = _t(a[n] || []),
                                r = o.filter((e) => e !== i);
                            r.length !== o.length
                                ? (ln(() => {
                                      Rt(n, r);
                                  }),
                                  E(
                                      'Horario eliminado de cambios pendientes',
                                      'success'
                                  ))
                                : E(
                                      'El horario ya no existe en el borrador',
                                      'info'
                                  );
                        })(
                            decodeURIComponent(o.dataset.date || ''),
                            decodeURIComponent(o.dataset.time || '')
                        ))
                    );
                if ('approve-transfer' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e) {
                            if (
                                confirm(
                                    '¿Aprobar el comprobante de transferencia de esta cita?'
                                )
                            )
                                if (e)
                                    try {
                                        (await w('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'paid',
                                                paymentPaidAt:
                                                    new Date().toISOString(),
                                            },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            E(
                                                'Transferencia aprobada',
                                                'success'
                                            ));
                                    } catch (e) {
                                        E(
                                            `No se pudo aprobar: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else E('Id de cita invalido', 'error');
                        })(Number(o.dataset.id || 0)))
                    );
                if ('reject-transfer' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e) {
                            if (
                                confirm(
                                    '¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.'
                                )
                            )
                                if (e)
                                    try {
                                        (await w('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'failed',
                                            },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            E(
                                                'Transferencia rechazada',
                                                'warning'
                                            ));
                                    } catch (e) {
                                        E(
                                            `No se pudo rechazar: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else E('Id de cita invalido', 'error');
                        })(Number(o.dataset.id || 0)))
                    );
                if ('cancel-appointment' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e) {
                            if (confirm('¿Estas seguro de cancelar esta cita?'))
                                if (e)
                                    try {
                                        (await w('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                status: 'cancelled',
                                            },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            E(
                                                'Cita cancelada correctamente',
                                                'success'
                                            ));
                                    } catch (e) {
                                        E(
                                            `No se pudo cancelar la cita: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else E('Id de cita invalido', 'error');
                        })(Number(o.dataset.id || 0)))
                    );
                if ('mark-no-show' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e) {
                            if (confirm('Marcar esta cita como "No asistio"?'))
                                if (e)
                                    try {
                                        (await w('appointments', {
                                            method: 'PATCH',
                                            body: { id: e, status: 'no_show' },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            E(
                                                'Cita marcada como no asistio',
                                                'success'
                                            ));
                                    } catch (e) {
                                        E(
                                            `No se pudo marcar no-show: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else E('Id de cita invalido', 'error');
                        })(Number(o.dataset.id || 0)))
                    );
                if ('mark-contacted' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e, n = '') {
                            let a = null;
                            const i = Number(e);
                            i > 0 && (a = t.find((e) => Number(e.id) === i));
                            const o = n ? decodeURIComponent(n) : '';
                            if (
                                (!a && o && (a = t.find((e) => e.fecha === o)),
                                a)
                            )
                                try {
                                    ne.delete(ce(a));
                                    const e = a.id || Date.now();
                                    (a.id || (a.id = e),
                                        await w('callbacks', {
                                            method: 'PATCH',
                                            body: {
                                                id: Number(e),
                                                status: 'contactado',
                                            },
                                        }),
                                        await H(),
                                        ve({
                                            filter: X.filter,
                                            sort: X.sort,
                                            search: X.search,
                                        }),
                                        K(),
                                        E(
                                            'Marcado como contactado',
                                            'success'
                                        ));
                                } catch (e) {
                                    E(
                                        `No se pudo actualizar callback: ${e.message}`,
                                        'error'
                                    );
                                }
                            else E('Callback no encontrado', 'error');
                        })(
                            Number(o.dataset.callbackId || 0),
                            o.dataset.callbackDate || ''
                        ))
                    );
                if ('queue-ticket-action' === r)
                    return (
                        i.preventDefault(),
                        void (await wa(
                            Number(o.dataset.queueId || 0),
                            o.dataset.queueAction || '',
                            Number(o.dataset.queueConsultorio || 0)
                        ))
                    );
                if ('queue-reprint-ticket' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function (e) {
                            const t = Number(e || 0);
                            if (!t)
                                return void E(
                                    'Ticket invalido para reimpresion',
                                    'error'
                                );
                            const n = String(t);
                            if (!An.reprintInFlightIds.has(n)) {
                                (An.reprintInFlightIds.add(n),
                                    pa(),
                                    Tn('reprint_started', { ticketId: t }));
                                try {
                                    const e = (await ra(t)).payload || {};
                                    if (e?.printed)
                                        (xn(`Ticket #${t} reimpreso`, {
                                            level: 'info',
                                        }),
                                            E('Ticket reimpreso', 'success'),
                                            Tn('reprint_success', {
                                                ticketId: t,
                                            }));
                                    else {
                                        const n = (function (
                                            e,
                                            { fallback: t = '' } = {}
                                        ) {
                                            const n = String(
                                                    e?.print?.errorCode || ''
                                                ).toLowerCase(),
                                                a = String(
                                                    e?.print?.message || ''
                                                ).trim(),
                                                i = Number(e?.statusCode || 0);
                                            return 'printer_disabled' === n
                                                ? 'Impresora deshabilitada: ticket generado sin impresion'
                                                : 'printer_host_missing' === n
                                                  ? 'Impresora sin host configurado'
                                                  : 'printer_connect_failed' ===
                                                      n
                                                    ? 'No se pudo conectar con la impresora termica'
                                                    : 'printer_write_failed' ===
                                                        n
                                                      ? 'Conexion con impresora abierta, pero fallo la impresion'
                                                      : a ||
                                                        (i >= 500
                                                            ? 'Fallo de impresion termica'
                                                            : String(
                                                                  t ||
                                                                      'sin detalle'
                                                              ));
                                        })(e, { fallback: 'sin detalle' });
                                        (xn(
                                            `Ticket #${t} generado sin impresion (${n})`,
                                            { level: 'warning' }
                                        ),
                                            E(
                                                `Ticket generado sin impresion: ${n}`,
                                                'warning'
                                            ),
                                            Tn('reprint_degraded', {
                                                ticketId: t,
                                                detail: n,
                                                statusCode: Number(
                                                    e?.statusCode || 0
                                                ),
                                            }));
                                    }
                                } catch (e) {
                                    const n = oa(e);
                                    (xn(
                                        `Error al reimprimir ticket #${t}: ${n}`,
                                        { level: 'error' }
                                    ),
                                        E(
                                            `No se pudo reimprimir ticket: ${n}`,
                                            'error'
                                        ),
                                        Tn('reprint_failed', {
                                            ticketId: t,
                                            error: n,
                                        }));
                                } finally {
                                    (An.reprintInFlightIds.delete(n), pa());
                                }
                            }
                        })(Number(o.dataset.queueId || 0)))
                    );
            } catch (e) {
                E(`Error ejecutando accion: ${e.message}`, 'error');
            }
        } else o.closest('.toast')?.remove();
    });
    const i = document.getElementById('appointmentFilter');
    i &&
        i.addEventListener('change', () => {
            dt();
        });
    const o = document.getElementById('searchAppointments');
    o &&
        o.addEventListener('input', () => {
            dt();
        });
    const r = document.getElementById('appointmentSort');
    r &&
        r.addEventListener('change', () => {
            !(function (e) {
                const t = ot(e),
                    { sortSelect: n } = at();
                (n && (n.value = t), st(Ge, t), dt());
            })(r.value || 'datetime_desc');
        });
    const c = document.getElementById('callbackFilter');
    c && c.addEventListener('change', ye);
    const l = document.getElementById('searchCallbacks');
    l && l.addEventListener('input', we);
    const u = document.getElementById('adminQuickCommand');
    u instanceof HTMLInputElement &&
        u.addEventListener('keydown', async (e) => {
            'Enter' === e.key && (e.preventDefault(), await ki(u.value));
        });
}
document.addEventListener('DOMContentLoaded', async () => {
    ((_e = Oe()),
        Ve(_e, { persist: !1, animate: !1 }),
        (function () {
            if (He) return;
            const e = Pe();
            e &&
                ('function' == typeof e.addEventListener
                    ? (e.addEventListener('change', We), (He = !0))
                    : 'function' == typeof e.addListener &&
                      (e.addListener(We), (He = !0)));
        })(),
        Fe ||
            'function' != typeof window.addEventListener ||
            (window.addEventListener('storage', Ke), (Fe = !0)),
        (function () {
            const e = (function () {
                try {
                    return {
                        mode: Ya(localStorage.getItem(Ta), Na),
                        consultorio: Qa(localStorage.getItem(qa), 1),
                    };
                } catch (e) {
                    return { mode: Na, consultorio: 1 };
                }
            })();
            ((Ha.mode = e.mode), (Ha.consultorio = e.consultorio));
            const t = (function () {
                try {
                    const e = new URL(window.location.href),
                        t = String(e.searchParams.get('station') || '')
                            .trim()
                            .toLowerCase(),
                        n = String(e.searchParams.get('lock') || '')
                            .trim()
                            .toLowerCase(),
                        a = '' !== t,
                        i = '' !== n;
                    if (!a && !i) return null;
                    let o = null;
                    'c1' === t || '1' === t
                        ? (o = 1)
                        : ('c2' !== t && '2' !== t) || (o = 2);
                    let r = null;
                    return (
                        ['1', 'true', 'locked', 'yes'].includes(n)
                            ? (r = Ma)
                            : ['0', 'false', 'free', 'no'].includes(n) &&
                              (r = Na),
                        {
                            consultorio: o,
                            mode: r,
                            hadStationParam: a,
                            hadLockParam: i,
                        }
                    );
                } catch (e) {
                    return null;
                }
            })();
            (t
                ? ((Ha.mode = Ya(t.mode, Ha.mode)),
                  (Ha.consultorio = Qa(t.consultorio, Ha.consultorio)),
                  Xa(Ha.mode, Ha.consultorio),
                  Fa('station_bootstrap', {
                      source: 'query',
                      mode: Ha.mode,
                      consultorio: Ha.consultorio,
                  }),
                  (function () {
                      try {
                          const e = new URL(window.location.href),
                              t = e.searchParams.has('station'),
                              n = e.searchParams.has('lock');
                          if (!t && !n) return;
                          (e.searchParams.delete('station'),
                              e.searchParams.delete('lock'));
                          const a = `${e.pathname}${e.search}${e.hash}`;
                          window.history &&
                              'function' ==
                                  typeof window.history.replaceState &&
                              window.history.replaceState(
                                  null,
                                  '',
                                  a || e.pathname
                              );
                      } catch (e) {}
                  })())
                : Fa('station_bootstrap', {
                      source: 'storage',
                      mode: Ha.mode,
                      consultorio: Ha.consultorio,
                  }),
                ti());
        })(),
        Li(),
        (function () {
            const e = { sort: ot(_(Ge, Ye)), density: rt(_(Je, Qe)) },
                { sortSelect: t } = at();
            (t && (t.value = e.sort), ct(e.density));
        })(),
        xa ||
            (xa = window.setInterval(() => {
                ci();
            }, 3e4)),
        ci(),
        di(ja()),
        Ga());
    const e = document.getElementById('loginForm');
    (e && e.addEventListener('submit', $i),
        Ra().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await yi(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                Ua() ? gi(!za()) : Ka(!Va());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => bi({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => bi({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!Ua() || !za()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = fi();
                if (0 === n.length) return (e.preventDefault(), void t.focus());
                const a = n[0],
                    i = n[n.length - 1],
                    o = document.activeElement;
                o instanceof HTMLElement && t.contains(o)
                    ? e.shiftKey && o === a
                        ? (e.preventDefault(), i.focus())
                        : e.shiftKey ||
                          o !== i ||
                          (e.preventDefault(), a.focus())
                    : (e.preventDefault(), (e.shiftKey ? i : a).focus());
            })(e),
                'Escape' !== e.key
                    ? (function (e) {
                          const t = document.getElementById('adminDashboard');
                          if (!t || t.classList.contains('is-hidden')) return;
                          const n =
                              (a = e.target) instanceof HTMLElement &&
                              (!!a.isContentEditable ||
                                  Boolean(
                                      a.closest(
                                          'input, textarea, select, [contenteditable="true"]'
                                      )
                                  ));
                          var a;
                          const i = String(e.key || '').toLowerCase(),
                              o = String(e.code || '').toLowerCase();
                          if (
                              (e.ctrlKey || e.metaKey) &&
                              'k' === i &&
                              !e.altKey &&
                              !e.shiftKey
                          )
                              return (e.preventDefault(), void ui());
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              document
                                  .getElementById('appointments')
                                  ?.classList.contains('active') &&
                              !n
                          )
                              return (
                                  e.preventDefault(),
                                  void (function () {
                                      const { searchInput: e } = at();
                                      e instanceof HTMLInputElement &&
                                          (e.focus({ preventScroll: !0 }),
                                          e.select());
                                  })()
                              );
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              document
                                  .getElementById('callbacks')
                                  ?.classList.contains('active') &&
                              !n
                          )
                              return (
                                  e.preventDefault(),
                                  void (function () {
                                      const e = oe().searchInput;
                                      e instanceof HTMLInputElement &&
                                          (e.focus({ preventScroll: !0 }),
                                          e.select());
                                  })()
                              );
                          if (
                              '/' === e.key &&
                              !e.altKey &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              on() &&
                              !n
                          )
                              return (e.preventDefault(), void an());
                          if (
                              !(
                                  '/' !== e.key ||
                                  e.altKey ||
                                  e.ctrlKey ||
                                  e.metaKey ||
                                  n
                              )
                          )
                              return (e.preventDefault(), void ui());
                          if (
                              ba() &&
                              !n &&
                              !e.ctrlKey &&
                              !e.metaKey &&
                              !e.altKey &&
                              !e.shiftKey
                          ) {
                              if (e.repeat) return;
                              if (ai(e, 1))
                                  return (
                                      e.preventDefault(),
                                      void oi(1, { source: 'numpad' })
                                  );
                              if (ai(e, 2))
                                  return (
                                      e.preventDefault(),
                                      void oi(2, { source: 'numpad' })
                                  );
                              if (
                                  (function (e) {
                                      if (
                                          'numpadenter' ===
                                          String(e.code || '').toLowerCase()
                                      )
                                          return !0;
                                      const t = String(
                                          e.key || ''
                                      ).toLowerCase();
                                      return (
                                          3 === Number(e.location || 0) &&
                                          'enter' === t
                                      );
                                  })(e)
                              )
                                  return (
                                      e.preventDefault(),
                                      void ri(Ha.consultorio, {
                                          source: 'numpad',
                                      })
                                  );
                          }
                          if (!e.altKey || !e.shiftKey) return;
                          if (n) return;
                          if ('keyr' === o)
                              return (
                                  e.preventDefault(),
                                  void wi({ showSuccessToast: !0 })
                              );
                          if ('m' === i || 'keym' === o)
                              return (
                                  e.preventDefault(),
                                  Ua() ? void gi(!za()) : void Ka(!Va())
                              );
                          if (on()) {
                              if ('ArrowLeft' === e.key)
                                  return (e.preventDefault(), void en(-1));
                              if ('ArrowRight' === e.key)
                                  return (e.preventDefault(), void en(1));
                              if ('keyy' === o)
                                  return (e.preventDefault(), void tn());
                              if ('keys' === o)
                                  return (e.preventDefault(), void nn());
                              if ('keyd' === o)
                                  return (e.preventDefault(), void gn());
                              if ('keyw' === o)
                                  return (e.preventDefault(), void bn());
                              if ('keyv' === o)
                                  return (e.preventDefault(), void pn());
                              if ('keyx' === o)
                                  return (e.preventDefault(), void hn());
                              if ('keyq' === o)
                                  return (e.preventDefault(), void yn());
                              if ('keyg' === o)
                                  return (e.preventDefault(), void un());
                              if ('keyz' === o)
                                  return (e.preventDefault(), void dn());
                          }
                          if (ba()) {
                              if ('keyj' === o)
                                  return (
                                      e.preventDefault(),
                                      void ri(1, { source: 'shortcut' })
                                  );
                              if ('keyk' === o)
                                  return (
                                      e.preventDefault(),
                                      void ri(2, { source: 'shortcut' })
                                  );
                              if ('keyu' === o)
                                  return (
                                      e.preventDefault(),
                                      void ya({ silent: !1 })
                                  );
                              if ('keyf' === o)
                                  return (e.preventDefault(), void $a());
                              if ('keyl' === o)
                                  return (
                                      e.preventDefault(),
                                      void Ea('sla_risk')
                                  );
                              if ('keyw' === o)
                                  return (
                                      e.preventDefault(),
                                      void Ea('waiting')
                                  );
                              if ('keyc' === o)
                                  return (
                                      e.preventDefault(),
                                      void Ea('called')
                                  );
                              if ('keya' === o)
                                  return (e.preventDefault(), void Ea('all'));
                              if ('keyi' === o)
                                  return (
                                      e.preventDefault(),
                                      void Ea('walk_in')
                                  );
                              if ('keyo' === o)
                                  return (e.preventDefault(), void Ea('all'));
                              if ('keyg' === o)
                                  return (
                                      e.preventDefault(),
                                      void ka('completar')
                                  );
                              if ('keyh' === o)
                                  return (
                                      e.preventDefault(),
                                      void ka('no_show')
                                  );
                              if ('keyb' === o)
                                  return (
                                      e.preventDefault(),
                                      void ka('cancelar')
                                  );
                              if ('keyp' === o)
                                  return (e.preventDefault(), void Ca());
                          }
                          const r =
                              {
                                  keya: 'all',
                                  keyh: 'today',
                                  keyt: 'pending_transfer',
                                  keyn: 'no_show',
                              }[o] || null;
                          if (r) return (e.preventDefault(), void vi(r));
                          const s =
                              { keyp: 'pending', keyc: 'contacted' }[o] || null;
                          if (s) return (e.preventDefault(), void Si(s));
                          const c = La.get(o) || La.get(i);
                          c && (e.preventDefault(), yi(c));
                      })(e)
                    : bi({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (Ua() || bi(), Ga(), pi(za()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await yi(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return Pa(
                            window.location.hash.replace(/^#/, '').trim(),
                            e
                        );
                    })({ fallback: 'dashboard' }),
                    {
                        refresh: !1,
                        updateHash: !1,
                        focus: !1,
                        closeMobileNav: !1,
                    }
                ));
        }));
    const t = document.getElementById('importFileInput');
    (t &&
        t.addEventListener('change', () =>
            (async function (e) {
                const t = e.files && e.files[0];
                if (
                    t &&
                    ((e.value = ''),
                    confirm(
                        'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
                    ))
                )
                    try {
                        const e = await t.text(),
                            n = JSON.parse(e);
                        if (!n || 'object' != typeof n)
                            throw new Error(
                                'El archivo no contiene datos validos'
                            );
                        const a = {
                            appointments: Array.isArray(n.appointments)
                                ? n.appointments
                                : [],
                            callbacks: Array.isArray(n.callbacks)
                                ? n.callbacks
                                : [],
                            reviews: Array.isArray(n.reviews) ? n.reviews : [],
                            queue_tickets: Array.isArray(n.queue_tickets)
                                ? n.queue_tickets
                                : [],
                            availability:
                                n.availability &&
                                'object' == typeof n.availability
                                    ? n.availability
                                    : {},
                        };
                        (await w('import', { method: 'POST', body: a }),
                            await H(),
                            li());
                        const i = document.querySelector('.nav-item.active');
                        (await Ci(i?.dataset.section || 'dashboard'),
                            E(
                                `Datos importados: ${a.appointments.length} citas`,
                                'success'
                            ));
                    } catch (e) {
                        E(`Error al importar: ${e.message}`, 'error');
                    }
            })(t)
        ),
        document.addEventListener('visibilitychange', () => {
            document.hidden
                ? Sa({ reason: 'hidden' })
                : 'queue' === Oa() && va({ immediate: !0 });
        }),
        window.addEventListener('online', async () => {
            const e = await wi({ showSuccessToast: !1, showErrorToast: !1 });
            ('queue' === Oa() && va({ immediate: !0 }),
                e
                    ? E('Conexion restaurada. Datos actualizados.', 'success')
                    : E(
                          'Conexion restaurada, pero no se pudieron refrescar datos.',
                          'warning'
                      ));
        }),
        window.addEventListener('offline', () => {
            'queue' === Oa() && Sa({ reason: 'offline' });
        }),
        window.addEventListener('piel:queue-ops', () => {
            window.requestAnimationFrame(() => {
                ti();
            });
        }),
        pi(!1),
        Wa(Va()),
        await (async function () {
            if (!navigator.onLine && _('appointments', null))
                return (
                    E('Modo offline: mostrando datos locales', 'info'),
                    void (await Ei())
                );
            (await (async function () {
                try {
                    const e = await k('status');
                    return (
                        !!e.authenticated && (e.csrfToken && v(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (E('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await Ei()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (Sa({ reason: 'paused' }),
                          bi(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })(),
        ti());
});
