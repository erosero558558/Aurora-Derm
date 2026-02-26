let e = [],
    t = [],
    n = [],
    a = {},
    o = {},
    i = null,
    r = null,
    s = '';
function c(t) {
    e = t || [];
}
function l(e) {
    t = e || [];
}
function d(e) {
    n = e || [];
}
function u(e) {
    a = e || {};
}
function m(e) {
    o = e || {};
}
function f(e) {
    i = e;
}
function p(e) {
    r = e || null;
}
function g(e) {
    s = e;
}
async function h(e, t = {}) {
    const n = {
        method: t.method || 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    };
    (s && t.method && 'GET' !== t.method && (n.headers['X-CSRF-Token'] = s),
        void 0 !== t.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(t.body))));
    const a = await fetch(e, n),
        o = await a.text();
    let i;
    try {
        i = o ? JSON.parse(o) : {};
    } catch (e) {
        throw new Error('Respuesta no valida del servidor');
    }
    if (!a.ok || !1 === i.ok) throw new Error(i.error || `HTTP ${a.status}`);
    return i;
}
async function y(e, t = {}) {
    return h(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function b(e, t = {}) {
    return h(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
function v(e) {
    return null == e
        ? ''
        : String(e)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
function w(e, t = 'info', n = '') {
    const a = document.getElementById('toastContainer');
    if (!a) return;
    const o = document.createElement('div');
    o.className = `toast ${t}`;
    const i = 'error' === t;
    (o.setAttribute('role', i ? 'alert' : 'status'),
        o.setAttribute('aria-live', i ? 'assertive' : 'polite'),
        o.setAttribute('aria-atomic', 'true'));
    const r = {
        success: n || 'Éxito',
        error: n || 'Error',
        warning: n || 'Advertencia',
        info: n || 'Información',
    };
    ((o.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${v(r[t])}</div>\n            <div class="toast-message">${v(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificación">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        a.appendChild(o),
        setTimeout(() => {
            o.parentElement &&
                ((o.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => o.remove(), 300));
        }, 5e3));
}
function S(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function k(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function E(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0 ? 0 : t;
}
function C(e) {
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
function L(e) {
    return (
        {
            rosero: 'Dr. Rosero',
            narvaez: 'Dra. Narváez',
            indiferente: 'Cualquiera disponible',
        }[e] || e
    );
}
function B(e) {
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
function $(e) {
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
function D(e) {
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
function I(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function A(e) {
    const t = String(e || '')
        .toLowerCase()
        .trim();
    return 'pending' === t
        ? 'pendiente'
        : 'contacted' === t || 'contactado' === t
          ? 'contactado'
          : 'pendiente';
}
function T(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function M(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
async function N() {
    try {
        const [e, t] = await Promise.all([
                y('data'),
                y('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (c(a), M('appointments', a));
        const o = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: A(e.status) }))
            : [];
        (l(o), M('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (d(i), M('reviews', i));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (u(r), M('availability', r));
        const s =
            n.availabilityMeta && 'object' == typeof n.availabilityMeta
                ? n.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        if (
            (m(s),
            M('availability-meta', s),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            f(n.funnelMetrics);
        else {
            const e = await y('funnel-metrics').catch(() => null);
            e && e.data && 'object' == typeof e.data
                ? f(e.data)
                : f({
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
        t && t.ok ? (p(t), M('health-status', t)) : p(null);
    } catch (e) {
        (c(T('appointments', [])),
            l(T('callbacks', []).map((e) => ({ ...e, status: A(e.status) }))),
            d(T('reviews', [])),
            u(T('availability', {})),
            m(T('availability-meta', {})),
            f({
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
            p(T('health-status', null)),
            w(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function x(e) {
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
function H(e) {
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
function _(e) {
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
function P(e) {
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
function R(e) {
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
function j(e) {
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
function F(e, t, n, a) {
    const o = document.getElementById(e);
    if (!o) return;
    const i = (function (e) {
        return Array.isArray(e)
            ? e
                  .map((e) => ({
                      label: String(e && e.label ? e.label : 'unknown'),
                      count: E(e && e.count ? e.count : 0),
                  }))
                  .filter((e) => e.count > 0)
                  .sort((e, t) => t.count - e.count)
            : [];
    })(t).slice(0, 6);
    if (0 === i.length)
        return void (o.innerHTML = `<p class="empty-message">${v(a)}</p>`);
    const r = i.reduce((e, t) => e + t.count, 0);
    o.innerHTML = i
        .map((e) => {
            const t = r > 0 ? S((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${v(n(e.label))}</span>\n                <span class="funnel-row-count">${v(k(e.count))} (${v(t)})</span>\n            </div>\n        `;
        })
        .join('');
}
function q(e, t, n = 'muted') {
    e &&
        ((e.className = 'toolbar-chip'),
        'accent' === n
            ? e.classList.add('is-accent')
            : 'warning' === n && e.classList.add('is-warning'),
        (e.textContent = t));
}
function O(e) {
    return `\n        <div class="operations-action-item">\n            <span class="operations-action-icon">\n                <i class="fas ${v(e.icon)}" aria-hidden="true"></i>\n            </span>\n            <div class="operations-action-copy">\n                <span class="operations-action-title">${v(e.title)}</span>\n                <span class="operations-action-meta">${v(e.meta)}</span>\n            </div>\n            <button type="button" class="btn btn-secondary btn-sm" data-action="${v(e.action)}">\n                ${v(e.cta)}\n            </button>\n        </div>\n    `;
}
function z() {
    document.getElementById('totalAppointments').textContent = e.length;
    const a = new Date().toISOString().split('T')[0],
        o = [];
    let s = 0,
        c = 0,
        l = 0;
    for (const t of e) {
        (t.date === a && 'cancelled' !== t.status && o.push(t),
            'pending_transfer_review' === t.paymentStatus && s++);
        const e = t.status || 'confirmed';
        ('confirmed' === e && c++, 'no_show' === e && l++);
    }
    document.getElementById('todayAppointments').textContent = o.length;
    const d = document.getElementById('totalNoShows');
    d && (d.textContent = k(l));
    const u = [];
    for (const e of t) 'pendiente' === A(e.status) && u.push(e);
    document.getElementById('pendingCallbacks').textContent = u.length;
    let m = 0;
    (n.length > 0 &&
        (m = (
            n.reduce((e, t) => e + (Number(t.rating) || 0), 0) / n.length
        ).toFixed(1)),
        (document.getElementById('avgRating').textContent = m),
        (document.getElementById('appointmentsBadge').textContent =
            s > 0 ? `${c} (${s} por validar)` : c),
        (document.getElementById('callbacksBadge').textContent = u.length),
        (document.getElementById('reviewsBadge').textContent = n.length));
    const f = document.getElementById('todayAppointmentsList');
    0 === o.length
        ? (f.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (f.innerHTML = o
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${v(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${v(e.name)}</span>\n                    <span class="service">${v(C(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${v(e.telefono)}</span>\n                    <span class="service">${v(I(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join('')),
        (function ({
            pendingTransfers: e = 0,
            pendingCallbacks: t = 0,
            todayAppointmentsCount: n = 0,
            confirmedCount: a = 0,
            totalNoShows: o = 0,
        }) {
            const i = document.getElementById('operationPendingReviewCount'),
                r = document.getElementById('operationPendingCallbacksCount'),
                s = document.getElementById('operationTodayLoadCount'),
                c = document.getElementById('operationQueueHealth'),
                l = document.getElementById('operationRefreshSignal'),
                d = document.getElementById('operationActionList');
            if (!(i && r && s && c && l && d)) return;
            ((i.textContent = k(e)),
                (r.textContent = k(t)),
                (s.textContent = k(n)));
            const u = 3 * e + 2 * t + Math.max(0, n - 6) + o;
            (u >= 9
                ? q(c, 'Cola: prioridad alta', 'warning')
                : u >= 4
                  ? q(c, 'Cola: atención recomendada', 'accent')
                  : q(c, 'Cola: estable', 'muted'),
                a <= 0
                    ? q(l, 'Agenda: sin citas confirmadas', 'warning')
                    : n >= 6
                      ? q(l, 'Agenda: demanda alta hoy', 'accent')
                      : q(l, 'Agenda: operación normal', 'muted'));
            const m = [];
            (e > 0 &&
                m.push({
                    icon: 'fa-money-check-dollar',
                    title: 'Transferencias pendientes',
                    meta: `${k(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${k(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${k(n)} cita(s) activas para seguimiento inmediato`,
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
                (d.innerHTML = m.map(O).join('')));
        })({
            pendingTransfers: s,
            pendingCallbacks: u.length,
            todayAppointmentsCount: o.length,
            confirmedCount: c,
            totalNoShows: l,
        }),
        (function () {
            const e =
                    i && 'object' == typeof i
                        ? i
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
                n = E(t.viewBooking),
                a = E(t.startCheckout),
                o = E(t.bookingConfirmed),
                s = E(t.checkoutAbandon);
            E(t.startRatePct);
            const c = E(t.confirmedRatePct) || (a > 0 ? (o / a) * 100 : 0),
                l = E(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                d = document.getElementById('funnelViewBooking');
            d && (d.textContent = k(n));
            const u = document.getElementById('funnelStartCheckout');
            u && (u.textContent = k(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = k(o));
            const f = document.getElementById('funnelAbandonRate');
            f && (f.textContent = S(l));
            const p = document.getElementById('checkoutConversionRate');
            p && (p.textContent = S(c));
            const g = E(e.events && e.events.booking_error),
                h = E(e.events && e.events.checkout_error),
                y = a > 0 ? ((g + h) / a) * 100 : 0,
                b = document.getElementById('bookingErrorRate');
            b && (b.textContent = S(y));
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
                    o = !!e && Boolean(e.calendarTokenHealthy);
                let i = `Agenda ${t}: ${n}`;
                ('google' === t && (i += a && o ? ' (OK)' : ' (revisar)'),
                    (v.textContent = i));
            }
            document.getElementById('funnelAbandonList') &&
                (F(
                    'funnelAbandonList',
                    e.checkoutAbandonByStep,
                    x,
                    'Sin datos de abandono'
                ),
                F(
                    'funnelEntryList',
                    e.checkoutEntryBreakdown,
                    H,
                    'Sin datos de entrada'
                ),
                F(
                    'funnelPaymentMethodList',
                    e.paymentMethodBreakdown,
                    _,
                    'Sin datos de pago'
                ),
                F(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    P,
                    'Sin datos de origen'
                ),
                F(
                    'funnelAbandonReasonList',
                    e.checkoutAbandonByReason,
                    R,
                    'Sin datos de motivo'
                ),
                F(
                    'funnelStepList',
                    e.bookingStepBreakdown,
                    x,
                    'Sin datos de pasos'
                ),
                F(
                    'funnelErrorCodeList',
                    e.errorCodeBreakdown,
                    j,
                    'Sin datos de error'
                ));
        })());
}
const U = 'all',
    V = new Set(['all', 'pending', 'contacted', 'today']),
    G = { filter: U, search: '' },
    K = {
        all: 'Todos',
        pending: 'Pendientes',
        contacted: 'Contactados',
        today: 'Hoy',
    };
function W() {
    return {
        filterSelect: document.getElementById('callbackFilter'),
        searchInput: document.getElementById('searchCallbacks'),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="callback-quick-filter"][data-filter-value]'
            )
        ),
        toolbarMeta: document.getElementById('callbacksToolbarMeta'),
        toolbarState: document.getElementById('callbacksToolbarState'),
        clearFiltersBtn: document.getElementById('clearCallbacksFiltersBtn'),
    };
}
function J(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return V.has(t) ? t : U;
}
function Q(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Y(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t;
}
function Z(e) {
    const t = Y(e);
    if (!t) return 0;
    const n = Date.now() - t.getTime();
    return Number.isFinite(n) ? Math.max(0, Math.round(n / 6e4)) : 0;
}
function X(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 'reciÃ©n';
    if (t < 60) return `${t} min`;
    const n = Math.floor(t / 60),
        a = t % 60;
    return 0 === a ? `${n} h` : `${n} h ${a} min`;
}
function ee() {
    te({ filter: W().filterSelect?.value || U });
}
function te(e, { preserveSearch: n = !0 } = {}) {
    const a = W(),
        o = a.searchInput?.value ?? G.search,
        i = n ? (e.search ?? o) : (e.search ?? ''),
        r = (function (e) {
            const n = {
                    filter: J(e.filter),
                    search: String(e.search || '')
                        .trim()
                        .toLowerCase(),
                },
                a = Q(new Date());
            var o;
            return {
                filtered: ((o = t),
                [...o].sort((e, t) => {
                    const n = Y(e.fecha),
                        a = Y(t.fecha),
                        o = n ? n.getTime() : 0;
                    return (a ? a.getTime() : 0) - o;
                })).filter((e) => {
                    const t = A(e.status),
                        o = Y(e.fecha),
                        i = o ? Q(o) : '';
                    return (
                        ('pending' !== n.filter || 'pendiente' === t) &&
                        ('contacted' !== n.filter || 'contactado' === t) &&
                        ('today' !== n.filter || i === a) &&
                        ('' === n.search ||
                            [e.telefono, e.preferencia, e.fecha, t]
                                .map((e) => String(e || '').toLowerCase())
                                .join(' ')
                                .includes(n.search))
                    );
                }),
                criteria: n,
            };
        })({
            filter: e.filter ?? a.filterSelect?.value ?? G.filter,
            search: i,
        });
    ((G.filter = r.criteria.filter),
        (G.search = r.criteria.search),
        (function (e) {
            const t = document.getElementById('callbacksGrid');
            t &&
                (0 !== e.length
                    ? (t.innerHTML = e
                          .map((e) => {
                              const t = A(e.status),
                                  n = Number(e.id) || 0,
                                  a = encodeURIComponent(String(e.fecha || '')),
                                  o = String(e.fecha || ''),
                                  i = Y(o)?.getTime() || 0,
                                  r = Z(o),
                                  s =
                                      r >= 120
                                          ? 'is-warning'
                                          : r >= 45
                                            ? 'is-accent'
                                            : 'is-muted';
                              return `\n            <div class="callback-card ${t}" data-callback-status="${t}" data-callback-id="${n}" data-callback-date="${v(a)}" data-callback-ts="${v(String(i))}">\n                <div class="callback-header">\n                    <span class="callback-phone">${v(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${v(I(e.preferencia))}\n                </span>\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${v(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                ${'pendiente' === t ? `<span class="toolbar-chip callback-wait-chip ${s}">En cola: ${v(X(r))}</span>` : ''}\n                <div class="callback-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${v(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${'pendiente' === t ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                          })
                          .join(''))
                    : (t.innerHTML =
                          '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n                </div>\n        '));
        })(r.filtered),
        (function (e, t, n) {
            const a = W(),
                {
                    toolbarMeta: o,
                    toolbarState: i,
                    clearFiltersBtn: r,
                    quickFilterButtons: s,
                    filterSelect: c,
                    searchInput: l,
                } = a,
                d = e.length,
                u = t.length,
                m = e.filter((e) => 'pendiente' === A(e.status)).length,
                f = e.filter((e) => 'contactado' === A(e.status)).length;
            o &&
                (o.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${v(String(d))}${u !== d ? ` de ${v(String(u))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${v(String(m))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${v(String(f))}</span>`,
                ].join(''));
            const p = n.filter !== U,
                g = '' !== n.search;
            if (i)
                if (p || g) {
                    const e = [
                        '<span class="toolbar-state-label">Criterios activos:</span>',
                    ];
                    (p &&
                        e.push(
                            `<span class="toolbar-state-value">${v(K[n.filter] || n.filter)}</span>`
                        ),
                        g &&
                            e.push(
                                `<span class="toolbar-state-value is-search">Busqueda: ${v(n.search)}</span>`
                            ),
                        e.push(
                            `<span class="toolbar-state-value">Resultados: ${v(String(d))}</span>`
                        ),
                        (i.innerHTML = e.join('')));
                } else
                    i.innerHTML =
                        '<span class="toolbar-state-empty">Sin filtros activos</span>';
            var h, y;
            (r && r.classList.toggle('is-hidden', !p && !g),
                c && (c.value = n.filter),
                l && (l.value = n.search),
                (h = s),
                (y = n.filter),
                h.forEach((e) => {
                    const t = e.dataset.filterValue === y;
                    (e.classList.toggle('is-active', t),
                        e.setAttribute('aria-pressed', String(t)));
                }));
        })(r.filtered, t, r.criteria),
        (function (e) {
            const t = document.getElementById('callbacksOpsQueueHealth'),
                n = document.getElementById('callbacksOpsPendingCount'),
                a = document.getElementById('callbacksOpsUrgentCount'),
                o = document.getElementById('callbacksOpsTodayCount'),
                i = document.getElementById('callbacksOpsNext'),
                r = document.getElementById('callbacksOpsNextBtn');
            if (!(t && n && a && o && i)) return;
            const s =
                ((c = e),
                (Array.isArray(c) ? c : [])
                    .filter((e) => 'pendiente' === A(e.status))
                    .map((e) => ({ callback: e, minutesWaiting: Z(e.fecha) }))
                    .sort((e, t) => {
                        if (t.minutesWaiting !== e.minutesWaiting)
                            return t.minutesWaiting - e.minutesWaiting;
                        const n = Y(e.callback.fecha),
                            a = Y(t.callback.fecha);
                        return (n ? n.getTime() : 0) - (a ? a.getTime() : 0);
                    }));
            var c;
            const l = s.length,
                d = s.filter((e) => e.minutesWaiting >= 120).length,
                u = s.filter((e) => e.minutesWaiting >= 45).length,
                m = Q(new Date()),
                f = s.filter((e) => {
                    const t = Y(e.callback.fecha);
                    return !!t && Q(t) === m;
                }).length;
            ((n.textContent = v(String(l))),
                (a.textContent = v(String(d))),
                (o.textContent = v(String(f))),
                (t.className = 'toolbar-chip'),
                d > 0 || l >= 8
                    ? (t.classList.add('is-warning'),
                      (t.textContent = 'Cola: prioridad alta'))
                    : u >= 2 || l >= 3
                      ? (t.classList.add('is-accent'),
                        (t.textContent = 'Cola: atenciÃ³n requerida'))
                      : (t.classList.add('is-muted'),
                        (t.textContent = 'Cola: estable')));
            const p = s[0] || null;
            if (!p)
                return (
                    (i.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = Y(p.callback.fecha),
                h = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((i.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${v(p.callback.telefono || 'Sin telÃ©fono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${v(X(p.minutesWaiting))} | Preferencia: ${v(I(p.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${v(h)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function ne(e, { preserveSearch: t = !0 } = {}) {
    te({ filter: e }, { preserveSearch: t });
}
function ae() {
    te({ search: W().searchInput?.value || '' });
}
function oe() {
    const e = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    if (0 === e.length)
        return (w('No hay callbacks pendientes para priorizar.', 'info'), !1);
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
let ie = !1;
function re(e, t = 'muted') {
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
function se(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function ce() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function le(e) {
    const { subscribeBtn: t, testBtn: n } = ce();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function de(e) {
    const { subscribeBtn: t } = ce();
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
async function ue() {
    const e = await y('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function me() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        de(Boolean(t)),
        re(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function fe() {
    const { subscribeBtn: e } = ce();
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
                      (await y('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              re('disponible', 'muted'),
              w('Notificaciones desactivadas', 'info'))
            : (await (async function () {
                  if ('granted' !== (await Notification.requestPermission()))
                      throw new Error('Permiso de notificaciones denegado');
                  const e = await ue(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: se(e),
                  });
                  return (
                      await y('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              re('activo', 'ok'),
              w('Notificaciones activadas', 'success'));
    } catch (e) {
        (re('error', 'error'),
            w(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await me().catch(() => {
                de(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function pe() {
    const { testBtn: e } = ce();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await y('push-test', { method: 'POST', body: {} })).result ||
                {},
            t = Number(e.success || 0),
            n = Number(e.failed || 0);
        n > 0
            ? w(`Push test: ${t} ok, ${n} fallidos`, 'warning')
            : w(`Push test enviado (${t})`, 'success');
    } catch (e) {
        w(`Push test: ${e.message || 'error'}`, 'error');
    } finally {
        (t && (t.className = n), (e.disabled = !1));
    }
}
const ge = 'themeMode',
    he = new Set(['light', 'dark', 'system']);
let ye = 'system',
    be = null,
    ve = !1,
    we = !1,
    Se = null;
function ke() {
    return (
        be ||
            'function' != typeof window.matchMedia ||
            (be = window.matchMedia('(prefers-color-scheme: dark)')),
        be
    );
}
function Ee(e) {
    return he.has(String(e || '').trim());
}
function Ce() {
    try {
        const e = localStorage.getItem(ge) || 'system';
        return Ee(e) ? e : 'system';
    } catch (e) {
        return 'system';
    }
}
function Le(e) {
    const t = document.documentElement;
    if (!t) return;
    const n = (function (e) {
        return 'system' !== e ? e : ke()?.matches ? 'dark' : 'light';
    })(e);
    (t.setAttribute('data-theme-mode', e), t.setAttribute('data-theme', n));
}
function Be() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((e) => {
            const t = e.dataset.themeMode === ye;
            (e.classList.toggle('is-active', t),
                e.setAttribute('aria-pressed', String(t)));
        });
}
function $e(e, { persist: t = !1, animate: n = !1 } = {}) {
    const a = Ee(e) ? e : 'system';
    ((ye = a),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(ge, e);
                } catch (e) {}
            })(a),
        n &&
            document.body &&
            (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
                (Se && clearTimeout(Se),
                document.body.classList.remove('theme-transition'),
                document.body.offsetWidth,
                document.body.classList.add('theme-transition'),
                (Se = setTimeout(() => {
                    document.body?.classList.remove('theme-transition');
                }, 220)))),
        Le(a),
        Be());
}
function De() {
    'system' === ye && (Le('system'), Be());
}
function Ie(e) {
    (e?.key && e.key !== ge) ||
        $e(
            'string' == typeof e?.newValue && Ee(e.newValue)
                ? e.newValue
                : Ce(),
            { persist: !1, animate: !1 }
        );
}
const Ae = 'admin-appointments-sort',
    Te = 'admin-appointments-density',
    Me = 'datetime_desc',
    Ne = 'comfortable',
    xe = 'all',
    He = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
    _e = new Set(['comfortable', 'compact']),
    Pe = new Set([
        'all',
        'today',
        'upcoming_48h',
        'week',
        'month',
        'confirmed',
        'cancelled',
        'no_show',
        'pending_transfer',
    ]);
function Re() {
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
function je(e) {
    const t = String(e || '').trim();
    return Pe.has(t) ? t : xe;
}
function Fe(e) {
    const t = String(e || '').trim();
    return He.has(t) ? t : Me;
}
function qe(e) {
    const t = String(e || '').trim();
    return _e.has(t) ? t : Ne;
}
function Oe(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ze(e) {
    const t = qe(e),
        { appointmentsSection: n } = Re();
    (n?.classList.toggle('appointments-density-compact', 'compact' === t),
        (function (e) {
            const t = qe(e),
                { densityButtons: n } = Re();
            n.forEach((e) => {
                const n = e.dataset.density === t;
                (e.classList.toggle('is-active', n),
                    e.setAttribute('aria-pressed', n ? 'true' : 'false'));
            });
        })(t));
}
function Ue(e) {
    const t = String(e?.paymentStatus || ''),
        n = String(e?.status || 'confirmed'),
        a = new Date().toISOString().split('T')[0],
        o = String(e?.date || '');
    return 'pending_transfer_review' === t
        ? 0
        : 'confirmed' === n && o === a
          ? 1
          : 'confirmed' === n
            ? 2
            : 'pending' === n
              ? 3
              : 'no_show' === n || 'noshow' === n
                ? 4
                : 'completed' === n
                  ? 5
                  : 'cancelled' === n
                    ? 6
                    : 7;
}
function Ve() {
    const t = (function () {
        const { filterSelect: e, sortSelect: t, searchInput: n } = Re();
        return {
            filter: je(e?.value || xe),
            sort: Fe(t?.value || Me),
            search: String(n?.value || '').trim(),
        };
    })();
    !(function (e) {
        const t = je(e),
            { quickFilterButtons: n } = Re();
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
                a = je(t);
            let o = [...n];
            const i = new Date(),
                r = (function (e) {
                    const t = e instanceof Date ? e : new Date(e);
                    return Number.isNaN(t.getTime())
                        ? ''
                        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                })(i),
                s = new Date(i);
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
                l = i.getMonth();
            switch (a) {
                case 'today':
                    o = o.filter((e) => e.date === r);
                    break;
                case 'upcoming_48h':
                    o = o.filter((e) => {
                        const t = (function (e) {
                            const t = String(e?.date || '').trim();
                            if (!t) return null;
                            const n =
                                    String(e?.time || '00:00').trim() ||
                                    '00:00',
                                a = new Date(`${t}T${n}:00`);
                            return Number.isNaN(a.getTime()) ? null : a;
                        })(e);
                        if (!t) return !1;
                        const n = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== n &&
                            'completed' !== n &&
                            t >= i &&
                            t <= s
                        );
                    });
                    break;
                case 'week':
                    o = o.filter((e) => e.date >= c.start && e.date <= c.end);
                    break;
                case 'month':
                    o = o.filter((e) => new Date(e.date).getMonth() === l);
                    break;
                case 'confirmed':
                case 'cancelled':
                case 'no_show':
                    o = o.filter((e) => (e.status || 'confirmed') === a);
                    break;
                case 'pending_transfer':
                    o = o.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    );
            }
            return o;
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
                    o = Array.isArray(e) ? e : [],
                    i = a.length,
                    r = o.length,
                    s = a.filter(
                        (e) => 'pending_transfer_review' === e.paymentStatus
                    ).length,
                    c = (function (e) {
                        const t = new Date().toISOString().split('T')[0];
                        return e.filter((e) => e.date === t).length;
                    })(a),
                    l = a.filter((e) => {
                        const t = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== t &&
                            'completed' !== t &&
                            'no_show' !== t &&
                            'noshow' !== t
                        );
                    }).length,
                    d = [
                        `<span class="toolbar-chip is-accent">Mostrando ${v(String(i))}${r !== i ? ` de ${v(String(r))}` : ''}</span>`,
                        `<span class="toolbar-chip">Hoy: ${v(String(c))}</span>`,
                        `<span class="toolbar-chip">Accionables: ${v(String(l))}</span>`,
                    ];
                (s > 0 &&
                    d.push(
                        `<span class="toolbar-chip is-warning">Por validar: ${v(String(s))}</span>`
                    ),
                    (n.innerHTML = d.join('')));
            })(t),
            0 === t.length)
        )
            return void (a.innerHTML =
                '\n            <tr class="table-empty-row">\n                <td colspan="8">\n                    <div class="table-empty-state">\n                        <i class="fas fa-calendar-check" aria-hidden="true"></i>\n                        <strong>No hay citas registradas</strong>\n                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>\n                    </div>\n                </td>\n            </tr>\n        ');
        const o = (function (e, t) {
            const n = Fe(t),
                a = Array.isArray(e) ? [...e] : [],
                o = (e, t) => {
                    const n = `${String(e?.date || '')} ${String(e?.time || '')}`,
                        a = `${String(t?.date || '')} ${String(t?.time || '')}`;
                    return n.localeCompare(a);
                };
            return a.sort((e, t) => {
                if ('patient_az' === n) {
                    const n = String(e?.name || '').toLocaleLowerCase('es'),
                        a = String(t?.name || '').toLocaleLowerCase('es'),
                        i = n.localeCompare(a, 'es');
                    return 0 !== i ? i : o(e, t);
                }
                if ('datetime_asc' === n) return o(e, t);
                if ('triage' === n) {
                    const n = Ue(e) - Ue(t);
                    return 0 !== n ? n : o(e, t);
                }
                return -o(e, t);
            });
        })(t, n?.sort || Me);
        a.innerHTML = o
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    o = [
                        'appointment-row',
                        a ? 'is-payment-review' : '',
                        'cancelled' === t ? 'is-cancelled' : '',
                        'no_show' === t || 'noshow' === t ? 'is-noshow' : '',
                    ]
                        .filter(Boolean)
                        .join(' '),
                    i = e.doctorAssigned
                        ? `<br><small>Asignado: ${v(L(e.doctorAssigned))}</small>`
                        : '',
                    r = e.transferReference
                        ? `<br><small>Ref: ${v(e.transferReference)}</small>`
                        : '',
                    s = (function (e) {
                        const t = String(e || '').trim();
                        return '' === t
                            ? ''
                            : t.startsWith('/') || /^https?:\/\//i.test(t)
                              ? t
                              : '';
                    })(e.transferProofUrl),
                    c = s
                        ? `<br><a class="appointment-proof-link" href="${v(s)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> Ver comprobante</a>`
                        : '',
                    l = String(e.phone || '').replace(/\D/g, '');
                return `\n        <tr class="${o}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${v(e.name)}</strong><br>\n                <small>${v(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${v(String(e.phone || 'Sin telefono'))}</span>\n                </div>\n            </td>\n            <td data-label="Servicio">${v(C(e.service))}</td>\n            <td data-label="Doctor">${v(L(e.doctor))}${i}</td>\n            <td data-label="Fecha">${v(
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
                )}</td>\n            <td data-label="Hora">${v(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${v(e.price || '$0.00')}</strong>\n                <small>${v($(e.paymentMethod))} - ${v(D(n))}</small>\n                ${r}\n                ${c}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${v(t)}">\n                    ${v(B(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${v(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(l)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp" aria-label="Abrir WhatsApp de ${v(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = Re();
            if (!n) return;
            const o = je(e?.filter || xe),
                i = Fe(e?.sort || Me),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = Re();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = o !== xe,
                l = r.length > 0,
                d = i !== Me || s !== Ne;
            if (
                (a &&
                    (a.classList.toggle('is-hidden', !c && !l),
                    (a.disabled = !c && !l)),
                !c && !l && !d)
            )
                return void (n.innerHTML =
                    '<span class="toolbar-state-empty">Sin filtros activos</span>');
            const u = Array.isArray(t) ? t.length : 0,
                m = [
                    `<span class="toolbar-state-label">${c || l ? 'Criterios activos:' : 'Vista activa:'}</span>`,
                ];
            (c &&
                m.push(
                    `<span class="toolbar-state-value is-filter">Filtro: ${v(
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
                            };
                            return t[String(e || xe)] || t.all;
                        })(o)
                    )}</span>`
                ),
                l &&
                    m.push(
                        `<span class="toolbar-state-value is-search">Busqueda: ${v(r)}</span>`
                    ),
                m.push(
                    `<span class="toolbar-state-value">Resultados: ${v(String(u))}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-sort">Orden: ${v(
                        (function (e) {
                            const t = {
                                datetime_desc: 'Mas recientes primero',
                                datetime_asc: 'Proximas primero',
                                triage: 'Triage operativo',
                                patient_az: 'Paciente (A-Z)',
                            };
                            return t[Fe(e)] || t.datetime_desc;
                        })(i)
                    )}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-density">Densidad: ${v(
                        (function (e) {
                            const t = {
                                comfortable: 'Comoda',
                                compact: 'Compacta',
                            };
                            return t[qe(e)] || t.comfortable;
                        })(s)
                    )}</span>`
                ),
                (n.innerHTML = m.join('')));
        })(t, n));
}
function Ge() {
    Ve();
}
function Ke(e, t = {}) {
    const { filterSelect: n, searchInput: a } = Re(),
        o = je(e),
        i = !1 !== t.preserveSearch;
    (n && (n.value = o), !i && a && (a.value = ''), Ve());
}
function We() {
    Ke(xe, { preserveSearch: !1 });
}
function Je(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
function Qe() {
    if (!Array.isArray(e) || 0 === e.length)
        return void w('No hay citas para exportar', 'warning');
    const t = e.map((e) => [
            Number(e.id) || 0,
            e.date || '',
            e.time || '',
            Je(e.name || ''),
            Je(e.email || ''),
            Je(e.phone || ''),
            Je(C(e.service)),
            Je(L(e.doctor)),
            e.price || '',
            Je(B(e.status || 'confirmed')),
            Je(D(e.paymentStatus)),
            Je($(e.paymentMethod)),
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
        o = URL.createObjectURL(a),
        i = document.createElement('a');
    ((i.href = o),
        (i.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`),
        document.body.appendChild(i),
        i.click(),
        document.body.removeChild(i),
        URL.revokeObjectURL(o),
        w('CSV exportado correctamente', 'success'));
}
let Ye = null,
    Ze = new Date(),
    Xe = !1,
    et = null,
    tt = {},
    nt = !1;
const at = 'admin-availability-day-clipboard',
    ot = 'admin-availability-last-selected-date';
function it(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = {};
    return (
        Object.keys(t)
            .sort()
            .forEach((e) => {
                if (!ut(e)) return;
                const a = gt(t[e] || []);
                a.length > 0 && (n[e] = a);
            }),
        n
    );
}
function rt(e) {
    tt = it(e);
}
function st() {
    const e = it(a),
        t = it(tt);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                o = t[n] || [];
            return a.length !== o.length || a.some((e, t) => e !== o[t]);
        });
}
function ct() {
    return st().length > 0;
}
function lt(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function dt(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function ut(e) {
    return Boolean(dt(e));
}
function mt(e) {
    try {
        const t = String(e || '').trim();
        if (!ut(t)) return void localStorage.removeItem(ot);
        localStorage.setItem(ot, t);
    } catch (e) {}
}
function ft() {
    et ||
        (et = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(at) || 'null');
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
function pt() {
    try {
        if (
            et &&
            'object' == typeof et &&
            Array.isArray(et.slots) &&
            et.slots.length > 0
        )
            return void localStorage.setItem(at, JSON.stringify(et));
        localStorage.removeItem(at);
    } catch (e) {}
}
function gt(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function ht(e, t) {
    const n = String(e || '').trim(),
        a = gt(t);
    if (!n || 0 === a.length) return ((et = null), void pt());
    ((et = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        pt());
}
function yt(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = dt(t);
    return n
        ? n.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          })
        : t;
}
function bt() {
    return Ye ? gt(a[Ye] || []) : [];
}
function vt(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const o = gt(t);
    0 !== o.length ? (a[n] = o) : delete a[n];
}
function wt(e, t) {
    const n = dt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const o = Math.max(0, Math.round(a));
    return 0 === o
        ? []
        : Array.from({ length: o }, (e, t) => {
              const a = new Date(n);
              return (a.setDate(n.getDate() + t), lt(a));
          });
}
function St(e) {
    return (Array.isArray(e) ? e : []).reduce(
        (e, t) => e + gt(a[t] || []).length,
        0
    );
}
function kt(e) {
    const t = dt(e);
    t && (Ze = new Date(t.getFullYear(), t.getMonth(), 1));
}
function Et(e, t) {
    const n = dt(e);
    if (!n) return;
    const a = Number(t);
    if (!Number.isFinite(a) || 0 === a) return;
    const o = new Date(n);
    o.setDate(n.getDate() + a);
    const i = lt(o);
    (kt(i), jt(i));
}
function Ct(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function Lt(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function Bt(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function $t() {
    const e = document.getElementById('availabilitySelectionSummary');
    if (!e) return;
    const t =
            'google' === String(o.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = Xe ? 'Solo lectura' : 'Editable',
        i = String(Ye || '').trim(),
        r = i ? (Array.isArray(a[i]) ? a[i].length : 0) : null;
    if (!i)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
            `<span class="availability-summary-chip ${Xe ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = dt(i),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : i;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
        `<span class="availability-summary-chip ${Xe ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${v(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${v(String(r ?? 0))}</span>`,
    ].join('');
}
function Dt() {
    ft();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(Ye || '').trim()),
        o = bt(),
        i = o.length > 0,
        r = n ? wt(Ye, 7) : [],
        s = St(r),
        c = r.filter((e) => gt(a[e] || []).length > 0).length,
        l = gt(et?.slots || []),
        d = l.length > 0,
        u = e.querySelector('[data-action="copy-availability-day"]'),
        m = e.querySelector('[data-action="paste-availability-day"]'),
        f = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        p = e.querySelector('[data-action="duplicate-availability-next-week"]'),
        g = e.querySelector('[data-action="clear-availability-day"]'),
        h = e.querySelector('[data-action="clear-availability-week"]');
    if (
        (u instanceof HTMLButtonElement && (u.disabled = !n || !i),
        m instanceof HTMLButtonElement && (m.disabled = !n || !d || Xe),
        f instanceof HTMLButtonElement && (f.disabled = !n || !i || Xe),
        p instanceof HTMLButtonElement && (p.disabled = !n || !i || Xe),
        g instanceof HTMLButtonElement && (g.disabled = !n || !i || Xe),
        h instanceof HTMLButtonElement && (h.disabled = !n || 0 === s || Xe),
        e.classList.toggle('is-hidden', !n && !d),
        !n && !d)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const y = [];
    (n &&
        (y.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${v(yt(Ye))}</span>`
        ),
        y.push(
            `<span class="toolbar-chip is-muted">Slots: ${v(String(o.length))}</span>`
        ),
        y.push(
            `<span class="toolbar-chip is-muted">Semana: ${v(String(c))} dia(s), ${v(String(s))} slot(s)</span>`
        )),
        d
            ? y.push(
                  `<span class="toolbar-chip">Portapapeles: ${v(String(l.length))} (${v(yt(et?.sourceDate))})</span>`
              )
            : y.push(
                  '<span class="toolbar-chip is-muted">Portapapeles vacío</span>'
              ),
        Xe &&
            y.push(
                '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
            ),
        (t.innerHTML = y.join('')));
}
function It() {
    const e = document.getElementById('availabilityDraftPanel'),
        t = document.getElementById('availabilityDraftStatus'),
        n = document.getElementById('availabilitySaveDraftBtn'),
        a = document.getElementById('availabilityDiscardDraftBtn');
    if (!e || !t) return;
    const o = st(),
        i = o.length,
        r = o
            .slice(0, 2)
            .map((e) => yt(e))
            .join(', ');
    if (Xe)
        t.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    else if (0 === i)
        t.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    else {
        const e = `${i} día${1 === i ? '' : 's'} con cambios pendientes`,
            n = r ? ` (${v(r)}${i > 2 ? '…' : ''})` : '';
        t.innerHTML = `<span class="toolbar-chip is-info">${v(e)}${n}</span>`;
    }
    (n instanceof HTMLButtonElement &&
        ((n.disabled = Xe || 0 === i || nt),
        n.setAttribute('aria-busy', String(nt))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === i || nt));
}
function At() {
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
    const a = String(o.source || 'store'),
        i = String(o.mode || 'live'),
        r = String(o.timezone || 'America/Guayaquil'),
        s = String(o.calendarAuth || 'n/d'),
        c = !1 === o.calendarTokenHealthy ? 'no' : 'si',
        l = !1 === o.calendarConfigured ? 'no' : 'si',
        d = !1 === o.calendarReachable ? 'no' : 'si',
        u = Ct(o.generatedAt),
        m = Ct(o.calendarLastSuccessAt),
        f = Ct(o.calendarLastErrorAt),
        p = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${v(n)}</strong> | TZ: <strong>${v(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${v(s)}</strong> | Token OK: <strong>${v(c)}</strong> | Configurado: <strong>${v(l)}</strong> | Reachable: <strong>${v(d)}</strong> | Ultimo exito: <strong>${v(m)}</strong> | Snapshot: <strong>${v(u)}</strong>`;
            ('blocked' === i &&
                p &&
                (e += ` | Ultimo error: <strong>${v(f)}</strong> (${v(p)})`),
                (t.innerHTML = e));
        }
        Lt(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${v(u)}</strong>`),
            Lt(
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
        $t(),
        Dt(),
        It(),
        !n)
    )
        return;
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const h = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = v(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${v(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        h('rosero', 'Dr. Rosero'),
        h('narvaez', 'Dra. Narváez'),
    ].join(' | ');
}
function Tt() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Bt(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        Mt(),
        $t(),
        Dt(),
        It());
}
function Mt() {
    const e = Boolean(String(Ye || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', Xe || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', Xe || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = Xe || !e;
        })),
        Dt(),
        It());
}
function Nt() {
    const e = Ze.getFullYear(),
        t = Ze.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = lt(new Date());
    ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].forEach((e) => {
        const t = document.createElement('div');
        ((t.className = 'calendar-day-header'),
            (t.textContent = e),
            r.appendChild(t));
    });
    for (let e = n - 1; e >= 0; e -= 1) {
        const t = i - e,
            n = document.createElement('div');
        ((n.className = 'calendar-day other-month'),
            (n.textContent = t),
            r.appendChild(n));
    }
    for (let n = 1; n <= o; n += 1) {
        const o = lt(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            (i.tabIndex = 0),
            i.setAttribute('role', 'button'),
            i.setAttribute('aria-label', `Seleccionar ${o}`),
            Ye === o && i.classList.add('selected'),
            s === o && i.classList.add('today'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => jt(o)),
            i.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void jt(o))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void Et(o, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void Et(o, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void Et(o, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), Et(o, 7))
                            )
            ),
            r.appendChild(i));
    }
    const c = 42 - (n + o);
    for (let e = 1; e <= c; e += 1) {
        const t = document.createElement('div');
        ((t.className = 'calendar-day other-month'),
            (t.textContent = e),
            r.appendChild(t));
    }
}
function xt(e) {
    (Ze.setMonth(Ze.getMonth() + e), Nt());
}
function Ht() {
    const e = new Date();
    ((Ze = new Date(e.getFullYear(), e.getMonth(), 1)), Nt(), jt(lt(e)));
}
function _t() {
    const e = (function ({
        referenceDate: e = '',
        includeReference: t = !1,
    } = {}) {
        const n = Object.keys(a || {})
            .filter((e) => {
                if (!ut(e)) return !1;
                const t = a[e];
                return Array.isArray(t) && t.length > 0;
            })
            .sort();
        if (0 === n.length) return '';
        const o = ut(e) ? String(e).trim() : lt(new Date()),
            i = t ? (e) => e >= o : (e) => e > o;
        return n.find(i) || n[0];
    })({ referenceDate: Ye || lt(new Date()), includeReference: !1 });
    e
        ? (kt(e), jt(e))
        : w('No hay fechas con horarios configurados', 'warning');
}
function Pt() {
    const e = document.getElementById('newSlotTime');
    e instanceof HTMLInputElement &&
        (Xe || e.closest('.is-hidden') || e.focus({ preventScroll: !0 }));
}
function Rt() {
    return (
        document.getElementById('availability')?.classList.contains('active') ||
        !1
    );
}
function jt(e, { persist: t = !0 } = {}) {
    if (!ut(e)) return;
    ((Ye = e), t && mt(e), Nt());
    const n = dt(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        n.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        Mt(),
        $t(),
        Ft(e));
}
function Ft(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Bt(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            $t(),
            Dt(),
            void It()
        );
    const o = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${Xe ? ' is-readonly' : ''}">\n            <span class="time">${v(e)}</span>\n            <div class="slot-actions">\n                ${Xe ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        $t(),
        Dt(),
        It());
}
function qt() {
    (Nt(), Ye ? Ft(Ye) : Tt());
}
function Ot(e) {
    ('function' == typeof e && e(), qt());
}
async function zt() {
    if (Xe)
        return (
            w(
                'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                'warning'
            ),
            !1
        );
    if (!ct()) return (w('No hay cambios pendientes por guardar', 'info'), !1);
    try {
        return (
            await (async function () {
                if (Xe)
                    throw new Error(
                        'Disponibilidad en solo lectura (Google Calendar).'
                    );
                if (nt) return !1;
                ((nt = !0), It());
                try {
                    const e = it(a);
                    return (
                        u(e),
                        await y('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        rt(a),
                        !0
                    );
                } finally {
                    ((nt = !1), It());
                }
            })(),
            w('Cambios de disponibilidad guardados', 'success'),
            !0
        );
    } catch (e) {
        return (w(`No se pudieron guardar cambios: ${e.message}`, 'error'), !1);
    }
}
function Ut() {
    ct()
        ? confirm(
              'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
          ) && (u(it(tt)), qt(), w('Cambios pendientes descartados', 'success'))
        : w('No hay cambios pendientes por descartar', 'info');
}
function Vt() {
    return Xe
        ? (w(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!Ye || (w('Selecciona una fecha primero', 'warning'), !1);
}
function Gt() {
    if (!Ye) return void w('Selecciona una fecha para copiar', 'warning');
    const e = bt();
    0 !== e.length
        ? (ht(Ye, e),
          Dt(),
          w(
              `Día copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
              'success'
          ))
        : w('No hay horarios para copiar en este dia', 'warning');
}
async function Kt() {
    if ((ft(), !Vt())) return;
    const e = gt(et?.slots || []);
    if (0 === e.length) return void w('Portapapeles vacio', 'warning');
    const t = bt();
    t.length === e.length && t.every((t, n) => t === e[n])
        ? w('La fecha ya tiene esos mismos horarios', 'warning')
        : (t.length > 0 &&
              !confirm(
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${yt(Ye)} con ${e.length}?`
              )) ||
          (Ot(() => {
              vt(Ye, e);
          }),
          w('Horarios pegados en cambios pendientes', 'success'));
}
async function Wt() {
    if (!Vt()) return;
    const e = bt();
    if (0 === e.length)
        return void w('No hay horarios para duplicar en este dia', 'warning');
    const t = dt(Ye);
    if (!t) return void w('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const o = lt(n),
        i = gt(a[o] || []);
    (i.length > 0 &&
        !confirm(
            `${yt(o)} ya tiene ${i.length} horario${1 === i.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (Ot(() => {
            (vt(o, e), ht(Ye, e));
        }),
        kt(o),
        jt(o),
        w(`Horarios duplicados a ${yt(o)} (pendiente de guardar)`, 'success'));
}
async function Jt() {
    if (!Vt()) return;
    const e = bt();
    if (0 === e.length)
        return void w('No hay horarios para duplicar en este dia', 'warning');
    const t = wt(Ye, 8).slice(1);
    if (0 === t.length)
        return void w('No se pudieron preparar los siguientes dias', 'error');
    const n = t.filter((t) => {
        const n = gt(a[t] || []);
        return (
            n.length > 0 &&
            (n.length !== e.length || n.some((t, n) => t !== e[n]))
        );
    }).length;
    (n > 0 &&
        !confirm(
            `Se reemplazaran horarios en ${n} dia(s). Deseas continuar?`
        )) ||
        (Ot(() => {
            (t.forEach((t) => {
                vt(t, e);
            }),
                ht(Ye, e));
        }),
        w(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function Qt() {
    if (!Vt()) return;
    const e = bt();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${yt(Ye)}?`
          ) &&
          (Ot(() => {
              vt(Ye, []);
          }),
          kt(Ye),
          jt(Ye),
          w('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : w('No hay horarios que limpiar en este dia', 'warning');
}
async function Yt() {
    if (!Vt()) return;
    const e = wt(Ye, 7);
    if (0 === e.length)
        return void w('No se pudo preparar la semana de limpieza', 'error');
    const t = e.filter((e) => gt(a[e] || []).length > 0);
    if (0 === t.length)
        return void w(
            'No hay horarios para limpiar en los proximos 7 dias',
            'warning'
        );
    const n = St(t);
    confirm(
        `Eliminar ${n} horario(s) en ${t.length} dia(s) desde ${yt(Ye)}?`
    ) &&
        (Ot(() => {
            t.forEach((e) => {
                vt(e, []);
            });
        }),
        kt(Ye),
        jt(Ye),
        w(
            `Semana limpiada (${t.length} dia(s)) pendiente de guardar`,
            'success'
        ));
}
const Zt = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'reviews'],
        ['digit5', 'availability'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'reviews'],
        ['5', 'availability'],
    ]),
    Xt = [
        'a[href]',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','),
    en = 'adminLastSection',
    tn = 'adminSidebarCollapsed',
    nn = {
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
    };
let an = 0,
    on = 0;
function rn() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function sn(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(rn().map((e) => e.dataset.section)).has(n) ? n : t;
}
function cn() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? sn(e, 'dashboard')
        : (function () {
              try {
                  return sn(localStorage.getItem(en), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function ln() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        cn() ||
        'dashboard'
    );
}
function dn() {
    return window.innerWidth <= 1024;
}
function un() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function mn() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function fn(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function pn(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!dn() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        fn(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(tn, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function gn() {
    dn()
        ? pn(!1, { persist: !1 })
        : pn(
              (function () {
                  try {
                      return '1' === localStorage.getItem(tn);
                  } catch (e) {
                      return !1;
                  }
              })(),
              { persist: !1 }
          );
}
function hn(e) {
    const t = sn(e, 'dashboard');
    (rn().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = sn(e, 'dashboard');
            try {
                localStorage.setItem(en, t);
            } catch (e) {}
        })(t));
}
function yn(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function bn() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !an))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - an),
        a = (function (e) {
            if (!an) return 'sin actualizar';
            const t = Math.max(0, e - an),
                n = Math.floor(t / 6e4);
            return n <= 0
                ? 'hace menos de 1 min'
                : 1 === n
                  ? 'hace 1 min'
                  : `hace ${n} min`;
        })(t),
        o = n >= 3e5;
    (e.classList.remove('status-pill-muted'),
        e.classList.add(o ? 'status-pill-stale' : 'status-pill-live'),
        (e.textContent = `Datos: ${a}`));
}
function vn() {
    ((an = Date.now()), bn());
}
function wn({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function Sn(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = nn[e && nn[e] ? e : 'dashboard'];
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
                        (t.title = e.hint || e.label),
                        (t.innerHTML = `<i class="fas ${e.icon}" aria-hidden="true"></i><span>${e.label}</span>`),
                        t
                    );
                })(e)
            );
        }));
}
function kn() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function En() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(Xt)).filter((e) => {
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
function Cn(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = dn(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function Ln(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = kn();
    if (!t || !n || !a) return;
    const o = Boolean(e && dn());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        Cn(o),
        o &&
            (function () {
                const e = document.getElementById('adminSidebar');
                if (!e) return;
                const t = e.querySelector('.nav-item.active');
                if (t instanceof HTMLElement)
                    return (
                        t.scrollIntoView({ block: 'nearest' }),
                        void t.focus()
                    );
                const n = En();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function Bn({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = kn(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (Ln(!1), e && n && t && t.focus());
}
function $n(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function Dn(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = e || 'dashboard';
    if ((hn(r), i && Bn(), n))
        try {
            (await N(), vn());
        } catch (e) {
            w(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    (await Nn(r), a && yn(r), o && $n(r));
}
async function In(e) {
    (await Dn('appointments', { focus: !1 }),
        Ke(e, { preserveSearch: !1 }),
        $n('appointments'));
}
async function An(e) {
    (await Dn('callbacks', { focus: !1 }),
        ne(e, { preserveSearch: !1 }),
        $n('callbacks'));
}
async function Tn({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await N(),
            vn(),
            await Nn(ln()),
            e && w('Datos actualizados', 'success'),
            !0
        );
    } catch (e) {
        return (
            t &&
                w(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                ),
            !1
        );
    }
}
async function Mn(e) {
    const t = document.getElementById('adminQuickCommand'),
        n = String(e || '')
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    if (!n)
        return (
            w(
                'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
                'info'
            ),
            wn(),
            !1
        );
    if ('help' === n || 'ayuda' === n)
        return (
            w(
                'Comandos: citas hoy, citas por validar, callbacks pendientes, disponibilidad hoy, exportar csv.',
                'info'
            ),
            !0
        );
    if (n.includes('exportar') && n.includes('csv'))
        return (
            await Dn('appointments', { focus: !1 }),
            Qe(),
            $n('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await Dn('dashboard'), !0);
    if (n.includes('resena') || n.includes('review'))
        return (await Dn('reviews'), !0);
    if (n.includes('callback'))
        return (
            await An(
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
        return (await In(e), n.includes('limpiar') && We(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await Dn('availability', { focus: !1 }),
          n.includes('hoy')
              ? Ht()
              : n.includes('siguiente')
                ? _t()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  Pt(),
          $n('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await Tn({ showSuccessToast: !0 }), !0)
          : (w(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function Nn(e) {
    const t = document.getElementById('pageTitle');
    (t &&
        (t.textContent =
            {
                dashboard: 'Dashboard',
                appointments: 'Citas',
                callbacks: 'Callbacks',
                reviews: 'Resenas',
                availability: 'Disponibilidad',
            }[e] || 'Dashboard'),
        Sn(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const i = document.getElementById(e);
    switch ((i && i.classList.add('active'), e)) {
        case 'dashboard':
        default:
            z();
            break;
        case 'appointments':
            Ge();
            break;
        case 'callbacks':
            te({
                filter: W().filterSelect?.value || G.filter,
                search: W().searchInput?.value || G.search,
            });
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
                const o = document.getElementById('reviewsGrid');
                0 !== n.length
                    ? (o.innerHTML = n
                          .slice()
                          .sort((e, t) =>
                              String(t.date || '').localeCompare(
                                  String(e.date || '')
                              )
                          )
                          .map(
                              (e) =>
                                  `\n            <div class="review-card-admin">\n                <div class="review-header-admin">\n                    <strong>${v(e.name || 'Paciente')}</strong>\n                    ${e.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}\n                </div>\n                <div class="review-rating">${'★'.repeat(Number(e.rating) || 0)}${'☆'.repeat(5 - (Number(e.rating) || 0))}</div>\n                <p>${v(e.text || '')}</p>\n                <small>${v(new Date(e.date).toLocaleDateString('es-EC'))}</small>\n            </div>\n        `
                          )
                          .join(''))
                    : (o.innerHTML =
                          '<p class="empty-message">No hay reseñas registradas</p>');
            })();
            break;
        case 'availability':
            await (async function () {
                if (
                    (await (async function () {
                        try {
                            const e = await y('availability', {
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
                                i = o && 'object' == typeof o ? o : {},
                                r = {
                                    ...i,
                                    ...n,
                                    source: String(
                                        n.source || i.source || 'store'
                                    ),
                                    mode: String(n.mode || i.mode || 'live'),
                                    timezone: String(
                                        n.timezone ||
                                            i.timezone ||
                                            'America/Guayaquil'
                                    ),
                                    generatedAt: String(
                                        n.generatedAt ||
                                            i.generatedAt ||
                                            new Date().toISOString()
                                    ),
                                };
                            if (
                                (u(it(t)),
                                m(r),
                                rt(a),
                                (Xe = 'google' === String(r.source || '')),
                                At(),
                                Mt(),
                                Ye && !ut(Ye))
                            )
                                return ((Ye = null), mt(''), void Tt());
                            Ye ? Ft(Ye) : Tt();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                w(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (Xe = 'google' === String(o.source || '')),
                                At(),
                                Mt());
                        }
                    })(),
                    !Ye)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(ot);
                            return ut(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    ut(e) && (Ye = e);
                }
                (Ye && !ut(Ye) && (Ye = null),
                    Ye && kt(Ye),
                    Nt(),
                    Ye ? jt(Ye, { persist: !1 }) : Tt());
            })();
    }
}
async function xn() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = cn();
    (hn(n),
        yn(n),
        gn(),
        Bn(),
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
                (await N(), vn());
            } catch (e) {
                w(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = ln();
            await Nn(t);
        })(),
        await (async function () {
            if (ie) return;
            ie = !0;
            const { subscribeBtn: e, testBtn: t } = ce();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return (le(!1), void re('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await ue(),
                        le(!0),
                        re('disponible', 'muted'),
                        e.addEventListener('click', fe),
                        t.addEventListener('click', pe),
                        await me());
                } catch (e) {
                    (le(!1), re('sin configurar', 'warn'));
                }
            }
        })());
}
async function Hn(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return b('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && g(t.csrfToken),
                w('Bienvenido al panel de administración', 'success'),
                await xn());
        } catch {
            w('Código incorrecto o sesión expirada', 'error');
        }
        return;
    }
    const n = document.getElementById('adminPassword')?.value || '';
    try {
        const e = await (async function (e) {
            return b('login', { method: 'POST', body: { password: e } });
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
                void w('Ingresa tu código 2FA', 'info')
            );
        }
        (e.csrfToken && g(e.csrfToken),
            w('Bienvenido al panel de administración', 'success'),
            await xn());
    } catch {
        w('Contraseña incorrecta', 'error');
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    ((ye = Ce()),
        $e(ye, { persist: !1, animate: !1 }),
        (function () {
            if (ve) return;
            const e = ke();
            e &&
                ('function' == typeof e.addEventListener
                    ? (e.addEventListener('change', De), (ve = !0))
                    : 'function' == typeof e.addListener &&
                      (e.addListener(De), (ve = !0)));
        })(),
        we ||
            'function' != typeof window.addEventListener ||
            (window.addEventListener('storage', Ie), (we = !0)),
        (function () {
            document.addEventListener('click', async (o) => {
                const i = o.target.closest('[data-action]');
                if (!i) return;
                const r = i.dataset.action;
                if ('close-toast' !== r) {
                    if ('logout' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                try {
                                    await b('logout', { method: 'POST' });
                                } catch (e) {}
                                (w('Sesion cerrada correctamente', 'info'),
                                    setTimeout(
                                        () => window.location.reload(),
                                        800
                                    ));
                            })())
                        );
                    if ('export-data' === r)
                        return (
                            o.preventDefault(),
                            void (function () {
                                const o = {
                                        appointments: e,
                                        callbacks: t,
                                        reviews: n,
                                        availability: a,
                                        exportDate: new Date().toISOString(),
                                    },
                                    i = new Blob([JSON.stringify(o, null, 2)], {
                                        type: 'application/json',
                                    }),
                                    r = URL.createObjectURL(i),
                                    s = document.createElement('a');
                                ((s.href = r),
                                    (s.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`),
                                    document.body.appendChild(s),
                                    s.click(),
                                    document.body.removeChild(s),
                                    URL.revokeObjectURL(r),
                                    w(
                                        'Datos exportados correctamente',
                                        'success'
                                    ));
                            })()
                        );
                    if ('open-import-file' === r)
                        return (
                            o.preventDefault(),
                            void document
                                .getElementById('importFileInput')
                                ?.click()
                        );
                    if ('set-admin-theme' === r)
                        return (
                            o.preventDefault(),
                            void $e(i.dataset.themeMode || 'system', {
                                persist: !0,
                                animate: !0,
                            })
                        );
                    if ('toggle-sidebar-collapse' === r)
                        return (
                            o.preventDefault(),
                            dn() ? void Ln(!un()) : void pn(!mn())
                        );
                    if ('run-admin-command' === r) {
                        o.preventDefault();
                        const e = document.getElementById('adminQuickCommand');
                        return void (await Mn(
                            e instanceof HTMLInputElement ? e.value : ''
                        ));
                    }
                    if ('refresh-admin-data' === r)
                        return (
                            o.preventDefault(),
                            void (await Tn({ showSuccessToast: !0 }))
                        );
                    if ('context-open-dashboard' === r)
                        return (
                            o.preventDefault(),
                            void (await Dn('dashboard'))
                        );
                    if ('context-open-appointments-today' === r)
                        return (o.preventDefault(), void (await In('today')));
                    if ('context-open-appointments-transfer' === r)
                        return (
                            o.preventDefault(),
                            void (await In('pending_transfer'))
                        );
                    if ('context-open-callbacks-pending' === r)
                        return (o.preventDefault(), void (await An('pending')));
                    if ('context-open-callbacks-next' === r)
                        return (
                            o.preventDefault(),
                            await An('pending'),
                            void oe()
                        );
                    if ('context-focus-slot-input' === r)
                        return (
                            o.preventDefault(),
                            await Dn('availability', { focus: !1 }),
                            void Pt()
                        );
                    if ('context-availability-today' === r)
                        return (
                            o.preventDefault(),
                            await Dn('availability', { focus: !1 }),
                            void Ht()
                        );
                    if ('context-availability-next' === r)
                        return (
                            o.preventDefault(),
                            await Dn('availability', { focus: !1 }),
                            void _t()
                        );
                    if ('context-copy-availability-day' === r)
                        return (
                            o.preventDefault(),
                            await Dn('availability', { focus: !1 }),
                            void Gt()
                        );
                    try {
                        if ('export-csv' === r)
                            return (o.preventDefault(), void Qe());
                        if ('appointment-quick-filter' === r)
                            return (
                                o.preventDefault(),
                                void Ke(i.dataset.filterValue || 'all')
                            );
                        if ('callback-quick-filter' === r)
                            return (
                                o.preventDefault(),
                                void ne(i.dataset.filterValue || 'all')
                            );
                        if ('callbacks-triage-next' === r)
                            return (
                                o.preventDefault(),
                                await An('pending'),
                                void oe()
                            );
                        if ('clear-appointment-filters' === r)
                            return (o.preventDefault(), void We());
                        if ('clear-callback-filters' === r)
                            return (
                                o.preventDefault(),
                                void te(
                                    { filter: U, search: '' },
                                    { preserveSearch: !1 }
                                )
                            );
                        if ('appointment-density' === r)
                            return (
                                o.preventDefault(),
                                void (function (e) {
                                    const t = qe(e);
                                    (ze(t),
                                        Oe(Te, t),
                                        Boolean(
                                            document.getElementById(
                                                'appointmentsTableBody'
                                            )
                                        ) && Ve());
                                })(i.dataset.density || 'comfortable')
                            );
                        if ('change-month' === r)
                            return (
                                o.preventDefault(),
                                void xt(Number(i.dataset.delta || 0))
                            );
                        if ('availability-today' === r)
                            return (o.preventDefault(), void Ht());
                        if ('availability-next-with-slots' === r)
                            return (o.preventDefault(), void _t());
                        if ('prefill-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (function (e) {
                                    if (Xe)
                                        return void w(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    const t =
                                        document.getElementById('newSlotTime');
                                    t instanceof HTMLInputElement &&
                                        ((t.value = String(e || '').trim()),
                                        t.focus());
                                })(i.dataset.time || '')
                            );
                        if ('copy-availability-day' === r)
                            return (o.preventDefault(), void Gt());
                        if ('paste-availability-day' === r)
                            return (o.preventDefault(), void (await Kt()));
                        if ('duplicate-availability-day-next' === r)
                            return (o.preventDefault(), void (await Wt()));
                        if ('duplicate-availability-next-week' === r)
                            return (o.preventDefault(), void (await Jt()));
                        if ('clear-availability-day' === r)
                            return (o.preventDefault(), void (await Qt()));
                        if ('clear-availability-week' === r)
                            return (o.preventDefault(), void (await Yt()));
                        if ('save-availability-draft' === r)
                            return (o.preventDefault(), void (await zt()));
                        if ('discard-availability-draft' === r)
                            return (o.preventDefault(), void Ut());
                        if ('add-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function () {
                                    if (Xe)
                                        return void w(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    if (!Ye)
                                        return void w(
                                            'Selecciona una fecha primero',
                                            'warning'
                                        );
                                    const e =
                                        document.getElementById('newSlotTime');
                                    if (!(e instanceof HTMLInputElement))
                                        return;
                                    const t = String(e.value || '').trim();
                                    if (!t)
                                        return void w(
                                            'Ingresa un horario',
                                            'warning'
                                        );
                                    const n = gt(a[Ye] || []);
                                    n.includes(t)
                                        ? w('Este horario ya existe', 'warning')
                                        : (Ot(() => {
                                              vt(Ye, [...n, t]);
                                          }),
                                          (e.value = ''),
                                          w(
                                              'Horario agregado a cambios pendientes',
                                              'success'
                                          ));
                                })())
                            );
                        if ('remove-time-slot' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e, t) {
                                    if (Xe)
                                        return void w(
                                            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                            'warning'
                                        );
                                    const n = String(e || '').trim(),
                                        o = String(t || '').trim();
                                    if (!ut(n) || !o)
                                        return void w(
                                            'No se pudo identificar el horario a eliminar',
                                            'warning'
                                        );
                                    const i = gt(a[n] || []),
                                        r = i.filter((e) => e !== o);
                                    r.length !== i.length
                                        ? (Ot(() => {
                                              vt(n, r);
                                          }),
                                          w(
                                              'Horario eliminado de cambios pendientes',
                                              'success'
                                          ))
                                        : w(
                                              'El horario ya no existe en el borrador',
                                              'info'
                                          );
                                })(
                                    decodeURIComponent(i.dataset.date || ''),
                                    decodeURIComponent(i.dataset.time || '')
                                ))
                            );
                        if ('approve-transfer' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Aprobar el comprobante de transferencia de esta cita?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await y('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        paymentStatus: 'paid',
                                                        paymentPaidAt:
                                                            new Date().toISOString(),
                                                    },
                                                }),
                                                    await N(),
                                                    Ge(),
                                                    z(),
                                                    w(
                                                        'Transferencia aprobada',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                w(
                                                    `No se pudo aprobar: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else w('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('reject-transfer' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await y('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        paymentStatus: 'failed',
                                                    },
                                                }),
                                                    await N(),
                                                    Ge(),
                                                    z(),
                                                    w(
                                                        'Transferencia rechazada',
                                                        'warning'
                                                    ));
                                            } catch (e) {
                                                w(
                                                    `No se pudo rechazar: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else w('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('cancel-appointment' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            '¿Estas seguro de cancelar esta cita?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await y('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        status: 'cancelled',
                                                    },
                                                }),
                                                    await N(),
                                                    Ge(),
                                                    z(),
                                                    w(
                                                        'Cita cancelada correctamente',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                w(
                                                    `No se pudo cancelar la cita: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else w('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        if ('mark-no-show' === r)
                            return (
                                o.preventDefault(),
                                void (await (async function (e) {
                                    if (
                                        confirm(
                                            'Marcar esta cita como "No asistio"?'
                                        )
                                    )
                                        if (e)
                                            try {
                                                (await y('appointments', {
                                                    method: 'PATCH',
                                                    body: {
                                                        id: e,
                                                        status: 'no_show',
                                                    },
                                                }),
                                                    await N(),
                                                    Ge(),
                                                    z(),
                                                    w(
                                                        'Cita marcada como no asistio',
                                                        'success'
                                                    ));
                                            } catch (e) {
                                                w(
                                                    `No se pudo marcar no-show: ${e.message}`,
                                                    'error'
                                                );
                                            }
                                        else w('Id de cita invalido', 'error');
                                })(Number(i.dataset.id || 0)))
                            );
                        'mark-contacted' === r &&
                            (o.preventDefault(),
                            await (async function (e, n = '') {
                                let a = null;
                                const o = Number(e);
                                o > 0 &&
                                    (a = t.find((e) => Number(e.id) === o));
                                const i = n ? decodeURIComponent(n) : '';
                                if (
                                    (!a &&
                                        i &&
                                        (a = t.find((e) => e.fecha === i)),
                                    a)
                                )
                                    try {
                                        const e = a.id || Date.now();
                                        (a.id || (a.id = e),
                                            await y('callbacks', {
                                                method: 'PATCH',
                                                body: {
                                                    id: Number(e),
                                                    status: 'contactado',
                                                },
                                            }),
                                            await N(),
                                            te({
                                                filter: G.filter,
                                                search: G.search,
                                            }),
                                            z(),
                                            w(
                                                'Marcado como contactado',
                                                'success'
                                            ));
                                    } catch (e) {
                                        w(
                                            `No se pudo actualizar callback: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else w('Callback no encontrado', 'error');
                            })(
                                Number(i.dataset.callbackId || 0),
                                i.dataset.callbackDate || ''
                            ));
                    } catch (e) {
                        w(`Error ejecutando accion: ${e.message}`, 'error');
                    }
                } else i.closest('.toast')?.remove();
            });
            const o = document.getElementById('appointmentFilter');
            o &&
                o.addEventListener('change', () => {
                    Ve();
                });
            const i = document.getElementById('searchAppointments');
            i &&
                i.addEventListener('input', () => {
                    Ve();
                });
            const r = document.getElementById('appointmentSort');
            r &&
                r.addEventListener('change', () => {
                    !(function (e) {
                        const t = Fe(e),
                            { sortSelect: n } = Re();
                        (n && (n.value = t), Oe(Ae, t), Ve());
                    })(r.value || 'datetime_desc');
                });
            const s = document.getElementById('callbackFilter');
            s && s.addEventListener('change', ee);
            const c = document.getElementById('searchCallbacks');
            c && c.addEventListener('input', ae);
            const l = document.getElementById('adminQuickCommand');
            l instanceof HTMLInputElement &&
                l.addEventListener('keydown', async (e) => {
                    'Enter' === e.key &&
                        (e.preventDefault(), await Mn(l.value));
                });
        })(),
        (function () {
            const e = { sort: Fe(T(Ae, Me)), density: qe(T(Te, Ne)) },
                { sortSelect: t } = Re();
            (t && (t.value = e.sort), ze(e.density));
        })(),
        on ||
            (on = window.setInterval(() => {
                bn();
            }, 3e4)),
        bn(),
        Sn(cn()),
        gn());
    const o = document.getElementById('loginForm');
    (o && o.addEventListener('submit', Hn),
        rn().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await Dn(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                dn() ? Ln(!un()) : pn(!mn());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => Bn({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => Bn({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!dn() || !un()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = En();
                if (0 === n.length) return (e.preventDefault(), void t.focus());
                const a = n[0],
                    o = n[n.length - 1],
                    i = document.activeElement;
                i instanceof HTMLElement && t.contains(i)
                    ? e.shiftKey && i === a
                        ? (e.preventDefault(), o.focus())
                        : e.shiftKey ||
                          i !== o ||
                          (e.preventDefault(), a.focus())
                    : (e.preventDefault(), (e.shiftKey ? o : a).focus());
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
                          const o = String(e.key || '').toLowerCase(),
                              i = String(e.code || '').toLowerCase();
                          if (
                              (e.ctrlKey || e.metaKey) &&
                              'k' === o &&
                              !e.altKey &&
                              !e.shiftKey
                          )
                              return (e.preventDefault(), void wn());
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
                                      const { searchInput: e } = Re();
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
                                      const e = W().searchInput;
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
                              Rt() &&
                              !n
                          )
                              return (e.preventDefault(), void Pt());
                          if (
                              !(
                                  '/' !== e.key ||
                                  e.altKey ||
                                  e.ctrlKey ||
                                  e.metaKey ||
                                  n
                              )
                          )
                              return (e.preventDefault(), void wn());
                          if (!e.altKey || !e.shiftKey) return;
                          if (n) return;
                          if ('keyr' === i)
                              return (
                                  e.preventDefault(),
                                  void Tn({ showSuccessToast: !0 })
                              );
                          if ('m' === o || 'keym' === i)
                              return (
                                  e.preventDefault(),
                                  dn() ? void Ln(!un()) : void pn(!mn())
                              );
                          if (Rt()) {
                              if ('ArrowLeft' === e.key)
                                  return (e.preventDefault(), void xt(-1));
                              if ('ArrowRight' === e.key)
                                  return (e.preventDefault(), void xt(1));
                              if ('keyy' === i)
                                  return (e.preventDefault(), void Ht());
                              if ('keys' === i)
                                  return (e.preventDefault(), void _t());
                              if ('keyd' === i)
                                  return (e.preventDefault(), void Wt());
                              if ('keyw' === i)
                                  return (e.preventDefault(), void Jt());
                              if ('keyv' === i)
                                  return (e.preventDefault(), void Kt());
                              if ('keyx' === i)
                                  return (e.preventDefault(), void Qt());
                              if ('keyq' === i)
                                  return (e.preventDefault(), void Yt());
                              if ('keyg' === i)
                                  return (e.preventDefault(), void zt());
                              if ('keyz' === i)
                                  return (e.preventDefault(), void Ut());
                          }
                          const r =
                              {
                                  keya: 'all',
                                  keyh: 'today',
                                  keyt: 'pending_transfer',
                                  keyn: 'no_show',
                              }[i] || null;
                          if (r) return (e.preventDefault(), void In(r));
                          const s =
                              { keyp: 'pending', keyc: 'contacted' }[i] || null;
                          if (s) return (e.preventDefault(), void An(s));
                          const c = Zt.get(i) || Zt.get(o);
                          c && (e.preventDefault(), Dn(c));
                      })(e)
                    : Bn({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (dn() || Bn(), gn(), Cn(un()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await Dn(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return sn(
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
    const i = document.getElementById('importFileInput');
    (i &&
        i.addEventListener('change', () =>
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
                            availability:
                                n.availability &&
                                'object' == typeof n.availability
                                    ? n.availability
                                    : {},
                        };
                        (await y('import', { method: 'POST', body: a }),
                            await N(),
                            vn());
                        const o = document.querySelector('.nav-item.active');
                        (await Nn(o?.dataset.section || 'dashboard'),
                            w(
                                `Datos importados: ${a.appointments.length} citas`,
                                'success'
                            ));
                    } catch (e) {
                        w(`Error al importar: ${e.message}`, 'error');
                    }
            })(i)
        ),
        window.addEventListener('online', async () => {
            (await Tn({ showSuccessToast: !1, showErrorToast: !1 }))
                ? w('Conexion restaurada. Datos actualizados.', 'success')
                : w(
                      'Conexion restaurada, pero no se pudieron refrescar datos.',
                      'warning'
                  );
        }),
        Cn(!1),
        fn(mn()),
        await (async function () {
            if (!navigator.onLine && T('appointments', null))
                return (
                    w('Modo offline: mostrando datos locales', 'info'),
                    void (await xn())
                );
            (await (async function () {
                try {
                    const e = await b('status');
                    return (
                        !!e.authenticated && (e.csrfToken && g(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (w('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await xn()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (Bn(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })());
});
