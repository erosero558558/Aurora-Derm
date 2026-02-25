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
function d(e) {
    t = e || [];
}
function l(e) {
    n = e || [];
}
function u(e) {
    a = e || {};
}
function m(e) {
    o = e || {};
}
function p(e) {
    i = e;
}
function f(e) {
    r = e || null;
}
function g(e) {
    s = e;
}
async function b(e, t = {}) {
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
async function h(e, t = {}) {
    return b(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function y(e, t = {}) {
    return b(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
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
        success: n || 'Exito',
        error: n || 'Error',
        warning: n || 'Advertencia',
        info: n || 'Información',
    };
    ((o.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${v(r[t])}</div>\n            <div class="toast-message">${v(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificacion">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
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
            acne: 'Tratamiento de Acne',
            cancer: 'Deteccion de Cancer de Piel',
        }[e] || e
    );
}
function B(e) {
    return (
        {
            rosero: 'Dr. Rosero',
            narvaez: 'Dra. Narváez',
            indiferente: 'Cualquiera disponible',
        }[e] || e
    );
}
function L(e) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            cancelled: 'Cancelada',
            completed: 'Completada',
            no_show: 'No asistio',
            noshow: 'No asistio',
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
function I(e) {
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
function A(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function T(e) {
    const t = String(e || '')
        .toLowerCase()
        .trim();
    return 'pending' === t
        ? 'pendiente'
        : 'contacted' === t || 'contactado' === t
          ? 'contactado'
          : 'pendiente';
}
function D(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function N(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
async function M() {
    try {
        const [e, t] = await Promise.all([
                h('data'),
                h('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (c(a), N('appointments', a));
        const o = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: T(e.status) }))
            : [];
        (d(o), N('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (l(i), N('reviews', i));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (u(r), N('availability', r));
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
            N('availability-meta', s),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            p(n.funnelMetrics);
        else {
            const e = await h('funnel-metrics').catch(() => null);
            e && e.data && 'object' == typeof e.data
                ? p(e.data)
                : p({
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
        t && t.ok ? (f(t), N('health-status', t)) : f(null);
    } catch (e) {
        (c(D('appointments', [])),
            d(D('callbacks', []).map((e) => ({ ...e, status: T(e.status) }))),
            l(D('reviews', [])),
            u(D('availability', {})),
            m(D('availability-meta', {})),
            p({
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
            f(D('health-status', null)),
            w(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function _(e) {
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
function P(e) {
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
function R(e) {
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
function H(e) {
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
function x(e) {
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
function O() {
    document.getElementById('totalAppointments').textContent = e.length;
    const a = new Date().toISOString().split('T')[0],
        o = [];
    let s = 0,
        c = 0,
        d = 0;
    for (const t of e) {
        (t.date === a && 'cancelled' !== t.status && o.push(t),
            'pending_transfer_review' === t.paymentStatus && s++);
        const e = t.status || 'confirmed';
        ('confirmed' === e && c++, 'no_show' === e && d++);
    }
    document.getElementById('todayAppointments').textContent = o.length;
    const l = document.getElementById('totalNoShows');
    l && (l.textContent = k(d));
    const u = [];
    for (const e of t) 'pendiente' === T(e.status) && u.push(e);
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
    const p = document.getElementById('todayAppointmentsList');
    0 === o.length
        ? (p.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (p.innerHTML = o
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${v(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${v(e.name)}</span>\n                    <span class="service">${v(C(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join(''));
    const f = document.getElementById('recentCallbacksList'),
        g = t.slice(-5).reverse();
    (0 === g.length
        ? (f.innerHTML =
              '<p class="empty-message">No hay callbacks pendientes</p>')
        : (f.innerHTML = g
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${v(e.telefono)}</span>\n                    <span class="service">${v(A(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
              )
              .join('')),
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
                d = E(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                l = document.getElementById('funnelViewBooking');
            l && (l.textContent = k(n));
            const u = document.getElementById('funnelStartCheckout');
            u && (u.textContent = k(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = k(o));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = S(d));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = S(c));
            const g = E(e.events && e.events.booking_error),
                b = E(e.events && e.events.checkout_error),
                h = a > 0 ? ((g + b) / a) * 100 : 0,
                y = document.getElementById('bookingErrorRate');
            y && (y.textContent = S(h));
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
                    _,
                    'Sin datos de abandono'
                ),
                F(
                    'funnelEntryList',
                    e.checkoutEntryBreakdown,
                    P,
                    'Sin datos de entrada'
                ),
                F(
                    'funnelPaymentMethodList',
                    e.paymentMethodBreakdown,
                    R,
                    'Sin datos de pago'
                ),
                F(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    H,
                    'Sin datos de origen'
                ),
                F(
                    'funnelAbandonReasonList',
                    e.checkoutAbandonByReason,
                    x,
                    'Sin datos de motivo'
                ),
                F(
                    'funnelStepList',
                    e.bookingStepBreakdown,
                    _,
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
function U(e) {
    const t = document.getElementById('callbacksGrid');
    t &&
        (0 !== e.length
            ? (t.innerHTML = e
                  .map((e) => {
                      const t = T(e.status),
                          n = Number(e.id) || 0,
                          a = encodeURIComponent(String(e.fecha || ''));
                      return `\n            <div class="callback-card ${t}">\n                <div class="callback-header">\n                    <span class="callback-phone">${v(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${v(A(e.preferencia))}\n                </span>\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${v(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                <div class="callback-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${v(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${'pendiente' === t ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                  })
                  .join(''))
            : (t.innerHTML =
                  '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n            </div>\n        '));
}
function q() {
    U(t);
}
function z() {
    const e = document.getElementById('callbackFilter').value;
    let n = [...t];
    ('pending' === e
        ? (n = n.filter((e) => 'pendiente' === T(e.status)))
        : 'contacted' === e &&
          (n = n.filter((e) => 'contactado' === T(e.status))),
        U(n));
}
let G = !1;
function W(e, t = 'muted') {
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
function V(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function J() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function K(e) {
    const { subscribeBtn: t, testBtn: n } = J();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Y(e) {
    const { subscribeBtn: t } = J();
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
async function X() {
    const e = await h('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Z() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Y(Boolean(t)),
        W(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function Q() {
    const { subscribeBtn: e } = J();
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
                      (await h('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              W('disponible', 'muted'),
              w('Notificaciones desactivadas', 'info'))
            : (await (async function () {
                  if ('granted' !== (await Notification.requestPermission()))
                      throw new Error('Permiso de notificaciones denegado');
                  const e = await X(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: V(e),
                  });
                  return (
                      await h('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              W('activo', 'ok'),
              w('Notificaciones activadas', 'success'));
    } catch (e) {
        (W('error', 'error'),
            w(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await Z().catch(() => {
                Y(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function ee() {
    const { testBtn: e } = J();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await h('push-test', { method: 'POST', body: {} })).result ||
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
function te(t) {
    const n = document.getElementById('appointmentsTableBody');
    if (!n) return;
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
                d = [
                    `<span class="toolbar-chip is-accent">Mostrando ${v(String(i))}${r !== i ? ` de ${v(String(r))}` : ''}</span>`,
                    `<span class="toolbar-chip">Hoy: ${v(String(c))}</span>`,
                ];
            (s > 0 &&
                d.push(
                    `<span class="toolbar-chip is-warning">Por validar: ${v(String(s))}</span>`
                ),
                (n.innerHTML = d.join('')));
        })(t),
        0 === t.length)
    )
        return void (n.innerHTML =
            '\n            <tr class="table-empty-row">\n                <td colspan="8">\n                    <div class="table-empty-state">\n                        <i class="fas fa-calendar-check" aria-hidden="true"></i>\n                        <strong>No hay citas registradas</strong>\n                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>\n                    </div>\n                </td>\n            </tr>\n        ');
    const a = [...t].sort((e, t) => {
        const n = (e.date || '') + ' ' + (e.time || '');
        return ((t.date || '') + ' ' + (t.time || '')).localeCompare(n);
    });
    n.innerHTML = a
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
                    ? `<br><small>Asignado: ${v(B(e.doctorAssigned))}</small>`
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
                d = String(e.phone || '').replace(/\D/g, '');
            return `\n        <tr class="${o}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${v(e.name)}</strong><br>\n                <small>${v(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${v(String(e.phone || 'Sin telefono'))}</span>\n                </div>\n            </td>\n            <td data-label="Servicio">${v(C(e.service))}</td>\n            <td data-label="Doctor">${v(B(e.doctor))}${i}</td>\n            <td data-label="Fecha">${v(
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
            )}</td>\n            <td data-label="Hora">${v(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${v(e.price || '$0.00')}</strong>\n                <small>${v($(e.paymentMethod))} - ${v(I(n))}</small>\n                ${r}\n                ${c}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${v(t)}">\n                    ${v(L(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${v(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(d)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp" aria-label="Abrir WhatsApp de ${v(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
        })
        .join('');
}
function ne() {
    te(e);
}
function ae(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
let oe = null,
    ie = new Date(),
    re = !1;
function se(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function ce(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function de(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function le(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function ue() {
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
        d = !1 === o.calendarConfigured ? 'no' : 'si',
        l = !1 === o.calendarReachable ? 'no' : 'si',
        u = ce(o.generatedAt),
        m = ce(o.calendarLastSuccessAt),
        p = ce(o.calendarLastErrorAt),
        f = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${v(n)}</strong> | TZ: <strong>${v(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${v(s)}</strong> | Token OK: <strong>${v(c)}</strong> | Configurado: <strong>${v(d)}</strong> | Reachable: <strong>${v(l)}</strong> | Ultimo exito: <strong>${v(m)}</strong> | Snapshot: <strong>${v(u)}</strong>`;
            ('blocked' === i &&
                f &&
                (e += ` | Ultimo error: <strong>${v(p)}</strong> (${v(f)})`),
                (t.innerHTML = e));
        }
        de(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${v(u)}</strong>`),
            de(
                'Selecciona un dia para revisar horarios y agregar o eliminar slots.'
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
        !n)
    )
        return;
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const b = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = v(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${v(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        b('rosero', 'Dr. Rosero'),
        b('narvaez', 'Dra. Narvaez'),
    ].join(' | ');
}
function me() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), le(0));
    const t = document.getElementById('timeSlotsList');
    t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>');
}
function pe() {
    const e = document.getElementById('addSlotForm');
    e && e.classList.toggle('is-hidden', re);
}
function fe() {
    const e = ie.getFullYear(),
        t = ie.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    ((r.innerHTML = ''),
        ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].forEach((e) => {
            const t = document.createElement('div');
            ((t.className = 'calendar-day-header'),
                (t.textContent = e),
                r.appendChild(t));
        }));
    for (let e = n - 1; e >= 0; e -= 1) {
        const t = i - e,
            n = document.createElement('div');
        ((n.className = 'calendar-day other-month'),
            (n.textContent = t),
            r.appendChild(n));
    }
    for (let n = 1; n <= o; n += 1) {
        const o = se(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            oe === o && i.classList.add('selected'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => ge(o)),
            r.appendChild(i));
    }
    const s = 42 - (n + o);
    for (let e = 1; e <= s; e += 1) {
        const t = document.createElement('div');
        ((t.className = 'calendar-day other-month'),
            (t.textContent = e),
            r.appendChild(t));
    }
}
function ge(e) {
    ((oe = e), fe());
    const t = new Date(e);
    ((document.getElementById('selectedDate').textContent =
        t.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        document
            .getElementById('addSlotForm')
            .classList.toggle('is-hidden', re),
        be(e));
}
function be(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((le(t.length), 0 === t.length))
        return void (n.innerHTML =
            '<p class="empty-message">No hay horarios configurados para este dia</p>');
    const o = encodeURIComponent(String(e || ''));
    n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${re ? ' is-readonly' : ''}">\n            <span class="time">${v(e)}</span>\n            <div class="slot-actions">\n                ${re ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('');
}
async function he() {
    if (re)
        throw new Error('Disponibilidad en solo lectura (Google Calendar).');
    await h('availability', { method: 'POST', body: { availability: a } });
}
const ye = [
    'a[href]',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');
function ve() {
    return Array.from(document.querySelectorAll('.nav-item[data-section]'));
}
function we() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return new Set(ve().map((e) => e.dataset.section)).has(e) ? e : 'dashboard';
}
function Se() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        we() ||
        'dashboard'
    );
}
function ke() {
    return window.innerWidth <= 1024;
}
function Ee() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Ce(e) {
    ve().forEach((t) => {
        const n = t.dataset.section === e;
        (t.classList.toggle('active', n),
            n
                ? t.setAttribute('aria-current', 'page')
                : t.removeAttribute('aria-current'));
    });
}
function Be() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function Le() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(ye)).filter(
              (e) =>
                  e instanceof HTMLElement &&
                  !e.hasAttribute('disabled') &&
                  !e.hasAttribute('aria-hidden')
          )
        : [];
}
function $e(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = ke(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function Ie(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = Be();
    if (!t || !n || !a) return;
    const o = Boolean(e && ke());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        $e(o),
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
                const n = Le();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function Ae({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = Be(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (Ie(!1), e && n && t && t.focus());
}
async function Te(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = e || 'dashboard';
    if ((Ce(r), i && Ae(), n))
        try {
            await M();
        } catch (e) {
            w(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    (await De(r),
        a &&
            (function (e) {
                const t = `#${e}`;
                window.location.hash !== t &&
                    (window.history &&
                    'function' == typeof window.history.replaceState
                        ? window.history.replaceState(null, '', t)
                        : (window.location.hash = t));
            })(r),
        o &&
            (function (e, { preventScroll: t = !0 } = {}) {
                const n = document.getElementById(e);
                n &&
                    (n.hasAttribute('tabindex') ||
                        n.setAttribute('tabindex', '-1'),
                    window.requestAnimationFrame(() => {
                        'function' == typeof n.focus &&
                            n.focus({ preventScroll: t });
                    }));
            })(r));
}
async function De(e) {
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
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const i = document.getElementById(e);
    switch ((i && i.classList.add('active'), e)) {
        case 'dashboard':
        default:
            O();
            break;
        case 'appointments':
            ne();
            break;
        case 'callbacks':
            q();
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
                (await (async function () {
                    try {
                        const e = await h('availability', {
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
                                source: String(n.source || i.source || 'store'),
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
                        (u(t),
                            m(r),
                            (re = 'google' === String(r.source || '')),
                            ue(),
                            pe(),
                            oe && !a[oe] && ((oe = null), me()));
                    } catch (e) {
                        (console.error('Error refreshing availability:', e),
                            w(
                                `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                'error'
                            ),
                            (re = 'google' === String(o.source || '')),
                            ue(),
                            pe());
                    }
                })(),
                    fe(),
                    oe || me());
            })();
    }
}
async function Ne() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'),
        t && t.classList.remove('is-hidden'),
        Ce(we()),
        Ae(),
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
                await M();
            } catch (e) {
                w(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = Se();
            await De(t);
        })(),
        await (async function () {
            if (G) return;
            G = !0;
            const { subscribeBtn: e, testBtn: t } = J();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return (K(!1), void W('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await X(),
                        K(!0),
                        W('disponible', 'muted'),
                        e.addEventListener('click', Q),
                        t.addEventListener('click', ee),
                        await Z());
                } catch (e) {
                    (K(!1), W('sin configurar', 'warn'));
                }
            }
        })());
}
async function Me(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return y('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && g(t.csrfToken),
                w('Bienvenido al panel de administracion', 'success'),
                await Ne());
        } catch {
            w('Codigo incorrecto o sesion expirada', 'error');
        }
        return;
    }
    const n = document.getElementById('adminPassword')?.value || '';
    try {
        const e = await (async function (e) {
            return y('login', { method: 'POST', body: { password: e } });
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
                void w('Ingresa tu codigo 2FA', 'info')
            );
        }
        (e.csrfToken && g(e.csrfToken),
            w('Bienvenido al panel de administracion', 'success'),
            await Ne());
    } catch {
        w('Contrasena incorrecta', 'error');
    }
}
function _e() {
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
                            await y('logout', { method: 'POST' });
                        } catch (e) {}
                        (w('Sesion cerrada correctamente', 'info'),
                            setTimeout(() => window.location.reload(), 800));
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
                            w('Datos exportados correctamente', 'success'));
                    })()
                );
            if ('open-import-file' === r)
                return (
                    o.preventDefault(),
                    void document.getElementById('importFileInput')?.click()
                );
            try {
                if ('export-csv' === r)
                    return (
                        o.preventDefault(),
                        void (function () {
                            if (!Array.isArray(e) || 0 === e.length)
                                return void w(
                                    'No hay citas para exportar',
                                    'warning'
                                );
                            const t = e.map((e) => [
                                    Number(e.id) || 0,
                                    e.date || '',
                                    e.time || '',
                                    ae(e.name || ''),
                                    ae(e.email || ''),
                                    ae(e.phone || ''),
                                    ae(C(e.service)),
                                    ae(B(e.doctor)),
                                    e.price || '',
                                    ae(L(e.status || 'confirmed')),
                                    ae(I(e.paymentStatus)),
                                    ae($(e.paymentMethod)),
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
                                a = new Blob([n], {
                                    type: 'text/csv;charset=utf-8;',
                                }),
                                o = URL.createObjectURL(a),
                                i = document.createElement('a');
                            ((i.href = o),
                                (i.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`),
                                document.body.appendChild(i),
                                i.click(),
                                document.body.removeChild(i),
                                URL.revokeObjectURL(o),
                                w('CSV exportado correctamente', 'success'));
                        })()
                    );
                if ('change-month' === r)
                    return (
                        o.preventDefault(),
                        (s = Number(i.dataset.delta || 0)),
                        ie.setMonth(ie.getMonth() + s),
                        void fe()
                    );
                if ('add-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function () {
                            if (re)
                                return void w(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            if (!oe)
                                return void w(
                                    'Selecciona una fecha primero',
                                    'warning'
                                );
                            const e =
                                document.getElementById('newSlotTime').value;
                            if (e)
                                if ((a[oe] || (a[oe] = []), a[oe].includes(e)))
                                    w('Este horario ya existe', 'warning');
                                else
                                    try {
                                        (a[oe].push(e),
                                            await he(),
                                            be(oe),
                                            fe(),
                                            (document.getElementById(
                                                'newSlotTime'
                                            ).value = ''),
                                            w('Horario agregado', 'success'));
                                    } catch (e) {
                                        w(
                                            `No se pudo guardar el horario: ${e.message}`,
                                            'error'
                                        );
                                    }
                            else w('Ingresa un horario', 'warning');
                        })())
                    );
                if ('remove-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e, t) {
                            if (re)
                                w(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            else
                                try {
                                    ((a[e] = (a[e] || []).filter(
                                        (e) => e !== t
                                    )),
                                        await he(),
                                        be(e),
                                        fe(),
                                        w('Horario eliminado', 'success'));
                                } catch (e) {
                                    w(
                                        `No se pudo eliminar el horario: ${e.message}`,
                                        'error'
                                    );
                                }
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
                                        (await h('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'paid',
                                                paymentPaidAt:
                                                    new Date().toISOString(),
                                            },
                                        }),
                                            await M(),
                                            ne(),
                                            O(),
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
                                        (await h('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'failed',
                                            },
                                        }),
                                            await M(),
                                            ne(),
                                            O(),
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
                            if (confirm('¿Estas seguro de cancelar esta cita?'))
                                if (e)
                                    try {
                                        (await h('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                status: 'cancelled',
                                            },
                                        }),
                                            await M(),
                                            ne(),
                                            O(),
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
                            if (confirm('Marcar esta cita como "No asistio"?'))
                                if (e)
                                    try {
                                        (await h('appointments', {
                                            method: 'PATCH',
                                            body: { id: e, status: 'no_show' },
                                        }),
                                            await M(),
                                            ne(),
                                            O(),
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
                        o > 0 && (a = t.find((e) => Number(e.id) === o));
                        const i = n ? decodeURIComponent(n) : '';
                        if ((!a && i && (a = t.find((e) => e.fecha === i)), a))
                            try {
                                const e = a.id || Date.now();
                                (a.id || (a.id = e),
                                    await h('callbacks', {
                                        method: 'PATCH',
                                        body: {
                                            id: Number(e),
                                            status: 'contactado',
                                        },
                                    }),
                                    await M(),
                                    q(),
                                    O(),
                                    w('Marcado como contactado', 'success'));
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
            var s;
        } else i.closest('.toast')?.remove();
    });
    const o = document.getElementById('appointmentFilter');
    o &&
        o.addEventListener('change', () => {
            !(function () {
                const t = document.getElementById('appointmentFilter').value;
                let n = [...e];
                const a = new Date().toISOString().split('T')[0],
                    o = (function () {
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
                    i = new Date().getMonth();
                switch (t) {
                    case 'today':
                        n = n.filter((e) => e.date === a);
                        break;
                    case 'week':
                        n = n.filter(
                            (e) => e.date >= o.start && e.date <= o.end
                        );
                        break;
                    case 'month':
                        n = n.filter((e) => new Date(e.date).getMonth() === i);
                        break;
                    case 'confirmed':
                    case 'cancelled':
                    case 'no_show':
                        n = n.filter((e) => (e.status || 'confirmed') === t);
                        break;
                    case 'pending_transfer':
                        n = n.filter(
                            (e) => 'pending_transfer_review' === e.paymentStatus
                        );
                }
                te(n);
            })();
        });
    const i = document.getElementById('searchAppointments');
    i &&
        i.addEventListener('input', () => {
            !(function () {
                const t = document
                    .getElementById('searchAppointments')
                    .value.toLowerCase();
                te(
                    e.filter(
                        (e) =>
                            String(e.name || '')
                                .toLowerCase()
                                .includes(t) ||
                            String(e.email || '')
                                .toLowerCase()
                                .includes(t) ||
                            String(e.phone || '').includes(t)
                    )
                );
            })();
        });
    const r = document.getElementById('callbackFilter');
    r && r.addEventListener('change', z);
}
document.addEventListener('DOMContentLoaded', async () => {
    _e();
    const e = document.getElementById('loginForm');
    (e && e.addEventListener('submit', Me),
        ve().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await Te(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                const e = document.getElementById('adminSidebar'),
                    t = e?.classList.contains('is-open');
                Ie(!t);
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => Ae({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => Ae({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!ke() || !Ee()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = Le();
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
                'Escape' === e.key && Ae({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (ke() || Ae(), $e(Ee()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await Te(we(), {
                    refresh: !1,
                    updateHash: !1,
                    focus: !1,
                    closeMobileNav: !1,
                }));
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
                            availability:
                                n.availability &&
                                'object' == typeof n.availability
                                    ? n.availability
                                    : {},
                        };
                        (await h('import', { method: 'POST', body: a }),
                            await M());
                        const o = document.querySelector('.nav-item.active');
                        (await De(o?.dataset.section || 'dashboard'),
                            w(
                                `Datos importados: ${a.appointments.length} citas`,
                                'success'
                            ));
                    } catch (e) {
                        w(`Error al importar: ${e.message}`, 'error');
                    }
            })(t)
        ),
        window.addEventListener('online', async () => {
            (w('Conexion restaurada. Actualizando datos...', 'success'),
                await M(),
                await De(Se()));
        }),
        $e(!1),
        await (async function () {
            if (!navigator.onLine && D('appointments', null))
                return (
                    w('Modo offline: mostrando datos locales', 'info'),
                    void (await Ne())
                );
            (await (async function () {
                try {
                    const e = await y('status');
                    return (
                        !!e.authenticated && (e.csrfToken && g(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (w('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await Ne()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (Ae(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })());
});
