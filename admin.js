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
function p(e) {
    i = e;
}
function f(e) {
    r = e || null;
}
function g(e) {
    s = e;
}
async function y(e, t = {}) {
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
    return y(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function b(e, t = {}) {
    return y(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
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
function E(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function k(e) {
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
            acne: 'Tratamiento de Acne',
            cancer: 'Deteccion de Cancer de Piel',
        }[e] || e
    );
}
function C(e) {
    return (
        {
            rosero: 'Dr. Rosero',
            narvaez: 'Dra. Narváez',
            indiferente: 'Cualquiera disponible',
        }[e] || e
    );
}
function $(e) {
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
function L(e) {
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
function A(e) {
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
function T(e, t) {
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
            ? n.callbacks.map((e) => ({ ...e, status: D(e.status) }))
            : [];
        (l(o), N('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (d(i), N('reviews', i));
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
        (c(T('appointments', [])),
            l(T('callbacks', []).map((e) => ({ ...e, status: D(e.status) }))),
            d(T('reviews', [])),
            u(T('availability', {})),
            m(T('availability-meta', {})),
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
            f(T('health-status', null)),
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
function H(e) {
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
function R(e) {
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
                      count: k(e && e.count ? e.count : 0),
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
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${v(n(e.label))}</span>\n                <span class="funnel-row-count">${v(E(e.count))} (${v(t)})</span>\n            </div>\n        `;
        })
        .join('');
}
function O() {
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
    d && (d.textContent = E(l));
    const u = [];
    for (const e of t) 'pendiente' === D(e.status) && u.push(e);
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${v(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${v(e.name)}</span>\n                    <span class="service">${v(B(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${v(e.telefono)}</span>\n                    <span class="service">${v(I(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
                n = k(t.viewBooking),
                a = k(t.startCheckout),
                o = k(t.bookingConfirmed),
                s = k(t.checkoutAbandon);
            k(t.startRatePct);
            const c = k(t.confirmedRatePct) || (a > 0 ? (o / a) * 100 : 0),
                l = k(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                d = document.getElementById('funnelViewBooking');
            d && (d.textContent = E(n));
            const u = document.getElementById('funnelStartCheckout');
            u && (u.textContent = E(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = E(o));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = S(l));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = S(c));
            const g = k(e.events && e.events.booking_error),
                y = k(e.events && e.events.checkout_error),
                h = a > 0 ? ((g + y) / a) * 100 : 0,
                b = document.getElementById('bookingErrorRate');
            b && (b.textContent = S(h));
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
                    H,
                    'Sin datos de pago'
                ),
                F(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    R,
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
function q(e) {
    const t = document.getElementById('callbacksGrid');
    t &&
        (0 !== e.length
            ? (t.innerHTML = e
                  .map((e) => {
                      const t = D(e.status),
                          n = Number(e.id) || 0,
                          a = encodeURIComponent(String(e.fecha || ''));
                      return `\n            <div class="callback-card ${t}">\n                <div class="callback-header">\n                    <span class="callback-phone">${v(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${v(I(e.preferencia))}\n                </span>\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${v(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                <div class="callback-actions">\n                    <a href="tel:${v(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${v(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${'pendiente' === t ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                  })
                  .join(''))
            : (t.innerHTML =
                  '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n            </div>\n        '));
}
function U() {
    q(t);
}
function z() {
    const e = document.getElementById('callbackFilter').value;
    let n = [...t];
    ('pending' === e
        ? (n = n.filter((e) => 'pendiente' === D(e.status)))
        : 'contacted' === e &&
          (n = n.filter((e) => 'contactado' === D(e.status))),
        q(n));
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
function J(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function V() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function K(e) {
    const { subscribeBtn: t, testBtn: n } = V();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Y(e) {
    const { subscribeBtn: t } = V();
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
async function Z() {
    const e = await h('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Q() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Y(Boolean(t)),
        W(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function X() {
    const { subscribeBtn: e } = V();
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
                  const e = await Z(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: J(e),
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
            await Q().catch(() => {
                Y(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function ee() {
    const { testBtn: e } = V();
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
const te = 'admin-appointments-sort',
    ne = 'admin-appointments-density',
    ae = 'datetime_desc',
    oe = 'comfortable',
    ie = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
    re = new Set(['comfortable', 'compact']);
function se() {
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
    };
}
function ce(e) {
    const t = String(e || '').trim();
    return ie.has(t) ? t : ae;
}
function le(e) {
    const t = String(e || '').trim();
    return re.has(t) ? t : oe;
}
function de(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ue(e) {
    const t = le(e),
        { appointmentsSection: n } = se();
    (n?.classList.toggle('appointments-density-compact', 'compact' === t),
        (function (e) {
            const t = le(e),
                { densityButtons: n } = se();
            n.forEach((e) => {
                const n = e.dataset.density === t;
                (e.classList.toggle('is-active', n),
                    e.setAttribute('aria-pressed', n ? 'true' : 'false'));
            });
        })(t));
}
function me(e) {
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
function pe() {
    const t = (function () {
            const { filterSelect: e, sortSelect: t, searchInput: n } = se();
            return {
                filter: String(e?.value || 'all'),
                sort: ce(t?.value || ae),
                search: String(n?.value || '').trim(),
            };
        })(),
        n = (function (e, t) {
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
                    a = String(t || 'all');
                let o = [...n];
                const i = new Date().toISOString().split('T')[0],
                    r = (function () {
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
                    s = new Date().getMonth();
                switch (a) {
                    case 'today':
                        o = o.filter((e) => e.date === i);
                        break;
                    case 'week':
                        o = o.filter(
                            (e) => e.date >= r.start && e.date <= r.end
                        );
                        break;
                    case 'month':
                        o = o.filter((e) => new Date(e.date).getMonth() === s);
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
            const n = ce(t),
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
                    const n = me(e) - me(t);
                    return 0 !== n ? n : o(e, t);
                }
                return -o(e, t);
            });
        })(t, n?.sort || ae);
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
                        ? `<br><small>Asignado: ${v(C(e.doctorAssigned))}</small>`
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
                return `\n        <tr class="${o}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${v(e.name)}</strong><br>\n                <small>${v(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${v(String(e.phone || 'Sin telefono'))}</span>\n                </div>\n            </td>\n            <td data-label="Servicio">${v(B(e.service))}</td>\n            <td data-label="Doctor">${v(C(e.doctor))}${i}</td>\n            <td data-label="Fecha">${v(
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
                )}</td>\n            <td data-label="Hora">${v(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${v(e.price || '$0.00')}</strong>\n                <small>${v(L(e.paymentMethod))} - ${v(A(n))}</small>\n                ${r}\n                ${c}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${v(t)}">\n                    ${v($(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${v(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${v(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${v(l)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp" aria-label="Abrir WhatsApp de ${v(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = se();
            if (!n) return;
            const o = String(e?.filter || 'all'),
                i = ce(e?.sort || ae),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = se();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = 'all' !== o,
                l = r.length > 0,
                d = i !== ae || s !== oe;
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
            var p;
            (c &&
                m.push(
                    `<span class="toolbar-state-value is-filter">Filtro: ${v(((p = o), { all: 'Todas las citas', today: 'Hoy', week: 'Esta semana', month: 'Este mes', confirmed: 'Confirmadas', cancelled: 'Canceladas', no_show: 'No asistio', pending_transfer: 'Transferencias por validar' }[String(p || 'all')] || 'Todas las citas'))}</span>`
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
                            return t[ce(e)] || t.datetime_desc;
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
                            return t[le(e)] || t.comfortable;
                        })(s)
                    )}</span>`
                ),
                (n.innerHTML = m.join('')));
        })(t, n));
}
function fe() {
    pe();
}
function ge(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
let ye = null,
    he = new Date(),
    be = !1,
    ve = null;
const we = 'admin-availability-day-clipboard';
function Se(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Ee(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function ke() {
    ve ||
        (ve = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(we) || 'null');
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
function Be() {
    try {
        if (
            ve &&
            'object' == typeof ve &&
            Array.isArray(ve.slots) &&
            ve.slots.length > 0
        )
            return void localStorage.setItem(we, JSON.stringify(ve));
        localStorage.removeItem(we);
    } catch (e) {}
}
function Ce(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function $e(e, t) {
    const n = String(e || '').trim(),
        a = Ce(t);
    if (!n || 0 === a.length) return ((ve = null), void Be());
    ((ve = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        Be());
}
function Le(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = Ee(t);
    return n
        ? n.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          })
        : t;
}
function Ae() {
    return ye ? Ce(a[ye] || []) : [];
}
function Ie(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const o = Ce(t);
    0 !== o.length ? (a[n] = o) : delete a[n];
}
function De(e) {
    const t = Ee(e);
    t && (he = new Date(t.getFullYear(), t.getMonth(), 1));
}
function Te(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function Ne(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function Me(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function _e() {
    const e = document.getElementById('availabilitySelectionSummary');
    if (!e) return;
    const t =
            'google' === String(o.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = be ? 'Solo lectura' : 'Editable',
        i = String(ye || '').trim(),
        r = i ? (Array.isArray(a[i]) ? a[i].length : 0) : null;
    if (!i)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
            `<span class="availability-summary-chip ${be ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Ee(i),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : i;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${v(t)}</span>`,
        `<span class="availability-summary-chip ${be ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${v(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${v(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${v(String(r ?? 0))}</span>`,
    ].join('');
}
function Pe() {
    ke();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(ye || '').trim()),
        a = Ae(),
        o = a.length > 0,
        i = Ce(ve?.slots || []),
        r = i.length > 0,
        s = e.querySelector('[data-action="copy-availability-day"]'),
        c = e.querySelector('[data-action="paste-availability-day"]'),
        l = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        d = e.querySelector('[data-action="clear-availability-day"]');
    if (
        (s instanceof HTMLButtonElement && (s.disabled = !n || !o),
        c instanceof HTMLButtonElement && (c.disabled = !n || !r || be),
        l instanceof HTMLButtonElement && (l.disabled = !n || !o || be),
        d instanceof HTMLButtonElement && (d.disabled = !n || !o || be),
        e.classList.toggle('is-hidden', !n && !r),
        !n && !r)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const u = [];
    (n &&
        (u.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${v(Le(ye))}</span>`
        ),
        u.push(
            `<span class="toolbar-chip is-muted">Slots: ${v(String(a.length))}</span>`
        )),
        r
            ? u.push(
                  `<span class="toolbar-chip">Portapapeles: ${v(String(i.length))} (${v(Le(ve?.sourceDate))})</span>`
              )
            : u.push(
                  '<span class="toolbar-chip is-muted">Portapapeles vacio</span>'
              ),
        be &&
            u.push(
                '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
            ),
        (t.innerHTML = u.join('')));
}
function He() {
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
        u = Te(o.generatedAt),
        m = Te(o.calendarLastSuccessAt),
        p = Te(o.calendarLastErrorAt),
        f = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${v(n)}</strong> | TZ: <strong>${v(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${v(s)}</strong> | Token OK: <strong>${v(c)}</strong> | Configurado: <strong>${v(l)}</strong> | Reachable: <strong>${v(d)}</strong> | Ultimo exito: <strong>${v(m)}</strong> | Snapshot: <strong>${v(u)}</strong>`;
            ('blocked' === i &&
                f &&
                (e += ` | Ultimo error: <strong>${v(p)}</strong> (${v(f)})`),
                (t.innerHTML = e));
        }
        Ne(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${v(u)}</strong>`),
            Ne(
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
        _e(),
        Pe(),
        !n)
    )
        return;
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const y = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = v(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${v(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        y('rosero', 'Dr. Rosero'),
        y('narvaez', 'Dra. Narvaez'),
    ].join(' | ');
}
function Re() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Me(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        xe(),
        _e(),
        Pe());
}
function xe() {
    const e = Boolean(String(ye || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', be || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', be || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = be || !e;
        })),
        Pe());
}
function je() {
    const e = he.getFullYear(),
        t = he.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = Se(new Date());
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
        const o = Se(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            (i.tabIndex = 0),
            i.setAttribute('role', 'button'),
            i.setAttribute('aria-label', `Seleccionar ${o}`),
            ye === o && i.classList.add('selected'),
            s === o && i.classList.add('today'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => Fe(o)),
            i.addEventListener('keydown', (e) => {
                ('Enter' !== e.key && ' ' !== e.key) ||
                    (e.preventDefault(), Fe(o));
            }),
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
function Fe(e) {
    ((ye = e), je());
    const t = Ee(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        t.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        xe(),
        _e(),
        Oe(e));
}
function Oe(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Me(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            _e(),
            void Pe()
        );
    const o = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${be ? ' is-readonly' : ''}">\n            <span class="time">${v(e)}</span>\n            <div class="slot-actions">\n                ${be ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        _e(),
        Pe());
}
async function qe() {
    if (be)
        throw new Error('Disponibilidad en solo lectura (Google Calendar).');
    await h('availability', { method: 'POST', body: { availability: a } });
}
function Ue() {
    return be
        ? (w(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!ye || (w('Selecciona una fecha primero', 'warning'), !1);
}
const ze = [
    'a[href]',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');
function Ge() {
    return Array.from(document.querySelectorAll('.nav-item[data-section]'));
}
function We() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return new Set(Ge().map((e) => e.dataset.section)).has(e) ? e : 'dashboard';
}
function Je() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        We() ||
        'dashboard'
    );
}
function Ve() {
    return window.innerWidth <= 1024;
}
function Ke() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Ye(e) {
    Ge().forEach((t) => {
        const n = t.dataset.section === e;
        (t.classList.toggle('active', n),
            n
                ? t.setAttribute('aria-current', 'page')
                : t.removeAttribute('aria-current'));
    });
}
function Ze() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function Qe() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(ze)).filter(
              (e) =>
                  e instanceof HTMLElement &&
                  !e.hasAttribute('disabled') &&
                  !e.hasAttribute('aria-hidden')
          )
        : [];
}
function Xe(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = Ve(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function et(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = Ze();
    if (!t || !n || !a) return;
    const o = Boolean(e && Ve());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        Xe(o),
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
                const n = Qe();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function tt({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = Ze(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (et(!1), e && n && t && t.focus());
}
async function nt(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = e || 'dashboard';
    if ((Ye(r), i && tt(), n))
        try {
            await M();
        } catch (e) {
            w(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    (await at(r),
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
async function at(e) {
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
            fe();
            break;
        case 'callbacks':
            U();
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
                            (be = 'google' === String(r.source || '')),
                            He(),
                            xe(),
                            ye && !a[ye] && ((ye = null), Re()));
                    } catch (e) {
                        (console.error('Error refreshing availability:', e),
                            w(
                                `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                'error'
                            ),
                            (be = 'google' === String(o.source || '')),
                            He(),
                            xe());
                    }
                })(),
                    je(),
                    ye ? (xe(), _e()) : Re());
            })();
    }
}
async function ot() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'),
        t && t.classList.remove('is-hidden'),
        Ye(We()),
        tt(),
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
            const t = Je();
            await at(t);
        })(),
        await (async function () {
            if (G) return;
            G = !0;
            const { subscribeBtn: e, testBtn: t } = V();
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
                        await Z(),
                        K(!0),
                        W('disponible', 'muted'),
                        e.addEventListener('click', X),
                        t.addEventListener('click', ee),
                        await Q());
                } catch (e) {
                    (K(!1), W('sin configurar', 'warn'));
                }
            }
        })());
}
async function it(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return b('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && g(t.csrfToken),
                w('Bienvenido al panel de administracion', 'success'),
                await ot());
        } catch {
            w('Codigo incorrecto o sesion expirada', 'error');
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
                void w('Ingresa tu codigo 2FA', 'info')
            );
        }
        (e.csrfToken && g(e.csrfToken),
            w('Bienvenido al panel de administracion', 'success'),
            await ot());
    } catch {
        w('Contrasena incorrecta', 'error');
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    ((function () {
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
                                        ge(e.name || ''),
                                        ge(e.email || ''),
                                        ge(e.phone || ''),
                                        ge(B(e.service)),
                                        ge(C(e.doctor)),
                                        e.price || '',
                                        ge($(e.status || 'confirmed')),
                                        ge(A(e.paymentStatus)),
                                        ge(L(e.paymentMethod)),
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
                                    w(
                                        'CSV exportado correctamente',
                                        'success'
                                    ));
                            })()
                        );
                    if ('clear-appointment-filters' === r)
                        return (
                            o.preventDefault(),
                            void (function () {
                                const { filterSelect: e, searchInput: t } =
                                    se();
                                (e && (e.value = 'all'),
                                    t && (t.value = ''),
                                    pe());
                            })()
                        );
                    if ('appointment-density' === r)
                        return (
                            o.preventDefault(),
                            void (function (e) {
                                const t = le(e);
                                (ue(t),
                                    de(ne, t),
                                    Boolean(
                                        document.getElementById(
                                            'appointmentsTableBody'
                                        )
                                    ) && pe());
                            })(i.dataset.density || 'comfortable')
                        );
                    if ('change-month' === r)
                        return (
                            o.preventDefault(),
                            (s = Number(i.dataset.delta || 0)),
                            he.setMonth(he.getMonth() + s),
                            void je()
                        );
                    if ('availability-today' === r)
                        return (
                            o.preventDefault(),
                            void (function () {
                                const e = new Date();
                                ((he = new Date(
                                    e.getFullYear(),
                                    e.getMonth(),
                                    1
                                )),
                                    je(),
                                    Fe(Se(e)));
                            })()
                        );
                    if ('prefill-time-slot' === r)
                        return (
                            o.preventDefault(),
                            void (function (e) {
                                if (be)
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
                        return (
                            o.preventDefault(),
                            void (function () {
                                if (!ye)
                                    return void w(
                                        'Selecciona una fecha para copiar',
                                        'warning'
                                    );
                                const e = Ae();
                                0 !== e.length
                                    ? ($e(ye, e),
                                      Pe(),
                                      w(
                                          `Dia copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
                                          'success'
                                      ))
                                    : w(
                                          'No hay horarios para copiar en este dia',
                                          'warning'
                                      );
                            })()
                        );
                    if ('paste-availability-day' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                if ((ke(), !Ue())) return;
                                const e = Ce(ve?.slots || []);
                                if (0 === e.length)
                                    return void w(
                                        'Portapapeles vacio',
                                        'warning'
                                    );
                                const t = Ae();
                                if (
                                    t.length === e.length &&
                                    t.every((t, n) => t === e[n])
                                )
                                    w(
                                        'La fecha ya tiene esos mismos horarios',
                                        'warning'
                                    );
                                else if (
                                    !(t.length > 0) ||
                                    confirm(
                                        `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${Le(ye)} con ${e.length}?`
                                    )
                                )
                                    try {
                                        (Ie(ye, e),
                                            await qe(),
                                            De(ye),
                                            Fe(ye),
                                            w(
                                                'Horarios pegados en la fecha seleccionada',
                                                'success'
                                            ));
                                    } catch (e) {
                                        w(
                                            `No se pudieron pegar los horarios: ${e.message}`,
                                            'error'
                                        );
                                    }
                            })())
                        );
                    if ('duplicate-availability-day-next' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                if (!Ue()) return;
                                const e = Ae();
                                if (0 === e.length)
                                    return void w(
                                        'No hay horarios para duplicar en este dia',
                                        'warning'
                                    );
                                const t = Ee(ye);
                                if (!t)
                                    return void w(
                                        'Fecha seleccionada invalida',
                                        'error'
                                    );
                                const n = new Date(t);
                                n.setDate(t.getDate() + 1);
                                const o = Se(n),
                                    i = Ce(a[o] || []);
                                if (
                                    !(i.length > 0) ||
                                    confirm(
                                        `${Le(o)} ya tiene ${i.length} horario${1 === i.length ? '' : 's'}. Deseas reemplazarlos?`
                                    )
                                )
                                    try {
                                        (Ie(o, e),
                                            $e(ye, e),
                                            await qe(),
                                            De(o),
                                            Fe(o),
                                            w(
                                                `Horarios duplicados a ${Le(o)}`,
                                                'success'
                                            ));
                                    } catch (e) {
                                        w(
                                            `No se pudo duplicar el dia: ${e.message}`,
                                            'error'
                                        );
                                    }
                            })())
                        );
                    if ('clear-availability-day' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                if (!Ue()) return;
                                const e = Ae();
                                if (0 !== e.length) {
                                    if (
                                        confirm(
                                            `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${Le(ye)}?`
                                        )
                                    )
                                        try {
                                            (Ie(ye, []),
                                                await qe(),
                                                De(ye),
                                                Fe(ye),
                                                w(
                                                    'Horarios del dia eliminados',
                                                    'success'
                                                ));
                                        } catch (e) {
                                            w(
                                                `No se pudo limpiar el dia: ${e.message}`,
                                                'error'
                                            );
                                        }
                                } else
                                    w(
                                        'No hay horarios que limpiar en este dia',
                                        'warning'
                                    );
                            })())
                        );
                    if ('add-time-slot' === r)
                        return (
                            o.preventDefault(),
                            void (await (async function () {
                                if (be)
                                    return void w(
                                        'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                        'warning'
                                    );
                                if (!ye)
                                    return void w(
                                        'Selecciona una fecha primero',
                                        'warning'
                                    );
                                const e =
                                    document.getElementById(
                                        'newSlotTime'
                                    ).value;
                                if (e)
                                    if (
                                        (a[ye] || (a[ye] = []),
                                        a[ye].includes(e))
                                    )
                                        w('Este horario ya existe', 'warning');
                                    else
                                        try {
                                            (a[ye].push(e),
                                                await qe(),
                                                Oe(ye),
                                                je(),
                                                (document.getElementById(
                                                    'newSlotTime'
                                                ).value = ''),
                                                w(
                                                    'Horario agregado',
                                                    'success'
                                                ));
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
                                if (be)
                                    w(
                                        'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                        'warning'
                                    );
                                else
                                    try {
                                        ((a[e] = (a[e] || []).filter(
                                            (e) => e !== t
                                        )),
                                            await qe(),
                                            Oe(e),
                                            je(),
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
                                                fe(),
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
                                                fe(),
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
                                if (
                                    confirm(
                                        '¿Estas seguro de cancelar esta cita?'
                                    )
                                )
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
                                                fe(),
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
                                if (
                                    confirm(
                                        'Marcar esta cita como "No asistio"?'
                                    )
                                )
                                    if (e)
                                        try {
                                            (await h('appointments', {
                                                method: 'PATCH',
                                                body: {
                                                    id: e,
                                                    status: 'no_show',
                                                },
                                            }),
                                                await M(),
                                                fe(),
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
                            if (
                                (!a && i && (a = t.find((e) => e.fecha === i)),
                                a)
                            )
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
                                        U(),
                                        O(),
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
                var s;
            } else i.closest('.toast')?.remove();
        });
        const o = document.getElementById('appointmentFilter');
        o &&
            o.addEventListener('change', () => {
                pe();
            });
        const i = document.getElementById('searchAppointments');
        i &&
            i.addEventListener('input', () => {
                pe();
            });
        const r = document.getElementById('appointmentSort');
        r &&
            r.addEventListener('change', () => {
                !(function (e) {
                    const t = ce(e),
                        { sortSelect: n } = se();
                    (n && (n.value = t), de(te, t), pe());
                })(r.value || 'datetime_desc');
            });
        const s = document.getElementById('callbackFilter');
        s && s.addEventListener('change', z);
    })(),
        (function () {
            const e = { sort: ce(T(te, ae)), density: le(T(ne, oe)) },
                { sortSelect: t } = se();
            (t && (t.value = e.sort), ue(e.density));
        })());
    const o = document.getElementById('loginForm');
    (o && o.addEventListener('submit', it),
        Ge().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await nt(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                const e = document.getElementById('adminSidebar'),
                    t = e?.classList.contains('is-open');
                et(!t);
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => tt({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => tt({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!Ve() || !Ke()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = Qe();
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
                'Escape' === e.key && tt({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (Ve() || tt(), Xe(Ke()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await nt(We(), {
                    refresh: !1,
                    updateHash: !1,
                    focus: !1,
                    closeMobileNav: !1,
                }));
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
                        (await h('import', { method: 'POST', body: a }),
                            await M());
                        const o = document.querySelector('.nav-item.active');
                        (await at(o?.dataset.section || 'dashboard'),
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
            (w('Conexion restaurada. Actualizando datos...', 'success'),
                await M(),
                await at(Je()));
        }),
        Xe(!1),
        await (async function () {
            if (!navigator.onLine && T('appointments', null))
                return (
                    w('Modo offline: mostrando datos locales', 'info'),
                    void (await ot())
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
                ? await ot()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (tt(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })());
});
