let e = [],
    t = [],
    n = [],
    a = {},
    o = {},
    i = null,
    r = null,
    s = [],
    c = null,
    l = '';
function d(t) {
    e = t || [];
}
function u(e) {
    t = e || [];
}
function m(e) {
    n = e || [];
}
function p(e) {
    a = e || {};
}
function f(e) {
    o = e || {};
}
function g(e) {
    i = e;
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
async function w(e, t = {}) {
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
async function S(e, t = {}) {
    return w(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function k(e, t = {}) {
    return w(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
function E(e) {
    return null == e
        ? ''
        : String(e)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
function C(e, t = 'info', n = '') {
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
    ((o.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${E(r[t])}</div>\n            <div class="toast-message">${E(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificación">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        a.appendChild(o),
        setTimeout(() => {
            o.parentElement &&
                ((o.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => o.remove(), 300));
        }, 5e3));
}
function B(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function $(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function L(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0 ? 0 : t;
}
function I(e) {
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
function A(e) {
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
function D(e) {
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
function N(e) {
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
function M(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function x(e) {
    const t = String(e || '')
        .toLowerCase()
        .trim();
    return 'pending' === t
        ? 'pendiente'
        : 'contacted' === t || 'contactado' === t
          ? 'contactado'
          : 'pendiente';
}
function q(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function _(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
async function H() {
    try {
        const [e, t] = await Promise.all([
                S('data'),
                S('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (d(a), _('appointments', a));
        const o = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: x(e.status) }))
            : [];
        (u(o), _('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (m(i), _('reviews', i));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (p(r), _('availability', r));
        const s =
            n.availabilityMeta && 'object' == typeof n.availabilityMeta
                ? n.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        (f(s), _('availability-meta', s));
        const c = Array.isArray(n.queue_tickets) ? n.queue_tickets : [];
        (h(c), _('queue-tickets', c));
        const l =
            n.queueMeta && 'object' == typeof n.queueMeta ? n.queueMeta : null;
        if (
            (y(l),
            _('queue-meta', l),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            g(n.funnelMetrics);
        else {
            const e = await S('funnel-metrics').catch(() => null);
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
        t && t.ok ? (b(t), _('health-status', t)) : b(null);
    } catch (e) {
        (d(q('appointments', [])),
            u(q('callbacks', []).map((e) => ({ ...e, status: x(e.status) }))),
            m(q('reviews', [])),
            p(q('availability', {})),
            f(q('availability-meta', {})),
            h(q('queue-tickets', [])),
            y(q('queue-meta', null)),
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
            b(q('health-status', null)),
            C(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function P(e) {
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
function F(e) {
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
    const o = document.getElementById(e);
    if (!o) return;
    const i = (function (e) {
        return Array.isArray(e)
            ? e
                  .map((e) => ({
                      label: String(e && e.label ? e.label : 'unknown'),
                      count: L(e && e.count ? e.count : 0),
                  }))
                  .filter((e) => e.count > 0)
                  .sort((e, t) => t.count - e.count)
            : [];
    })(t).slice(0, 6);
    if (0 === i.length)
        return void (o.innerHTML = `<p class="empty-message">${E(a)}</p>`);
    const r = i.reduce((e, t) => e + t.count, 0);
    o.innerHTML = i
        .map((e) => {
            const t = r > 0 ? B((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${E(n(e.label))}</span>\n                <span class="funnel-row-count">${E($(e.count))} (${E(t)})</span>\n            </div>\n        `;
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
function G(e) {
    return `\n        <div class="operations-action-item">\n            <span class="operations-action-icon">\n                <i class="fas ${E(e.icon)}" aria-hidden="true"></i>\n            </span>\n            <div class="operations-action-copy">\n                <span class="operations-action-title">${E(e.title)}</span>\n                <span class="operations-action-meta">${E(e.meta)}</span>\n            </div>\n            <button type="button" class="btn btn-secondary btn-sm" data-action="${E(e.action)}">\n                ${E(e.cta)}\n            </button>\n        </div>\n    `;
}
function K() {
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
    d && (d.textContent = $(l));
    const u = [];
    for (const e of t) 'pendiente' === x(e.status) && u.push(e);
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${E(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${E(e.name)}</span>\n                    <span class="service">${E(I(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${E(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${E(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${E(e.telefono)}</span>\n                    <span class="service">${E(M(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${E(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
            ((i.textContent = $(e)),
                (r.textContent = $(t)),
                (s.textContent = $(n)));
            const u = 3 * e + 2 * t + Math.max(0, n - 6) + o;
            (u >= 9
                ? V(c, 'Cola: prioridad alta', 'warning')
                : u >= 4
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
                    meta: `${$(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${$(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${$(n)} cita(s) activas para seguimiento inmediato`,
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
                (d.innerHTML = m.map(G).join('')));
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
                n = L(t.viewBooking),
                a = L(t.startCheckout),
                o = L(t.bookingConfirmed),
                s = L(t.checkoutAbandon);
            L(t.startRatePct);
            const c = L(t.confirmedRatePct) || (a > 0 ? (o / a) * 100 : 0),
                l = L(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                d = document.getElementById('funnelViewBooking');
            d && (d.textContent = $(n));
            const u = document.getElementById('funnelStartCheckout');
            u && (u.textContent = $(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = $(o));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = B(l));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = B(c));
            const g = L(e.events && e.events.booking_error),
                b = L(e.events && e.events.checkout_error),
                h = a > 0 ? ((g + b) / a) * 100 : 0,
                y = document.getElementById('bookingErrorRate');
            y && (y.textContent = B(h));
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
                (z(
                    'funnelAbandonList',
                    e.checkoutAbandonByStep,
                    P,
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
                    F,
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
                    P,
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
const W = 'all',
    J = 'recent_desc',
    Y = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    Q = new Set(['recent_desc', 'waiting_desc']),
    Z = { filter: W, search: '', sort: J },
    X = {
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
    oe = !1;
function ie() {
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
    return Y.has(t) ? t : W;
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
    return 'pendiente' === x(e?.status);
}
function de() {
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
                    (a.value = Z.sort),
                    e.appendChild(n),
                    e.appendChild(a));
                const o = t.querySelector('.callbacks-quick-filters');
                o ? t.insertBefore(e, o) : t.appendChild(e);
            }
            const o = t.querySelector('.callbacks-quick-filters');
            if (o && !o.querySelector('[data-filter-value="sla_urgent"]')) {
                const e = document.createElement('button');
                ((e.type = 'button'),
                    (e.className = 'callback-quick-filter-btn'),
                    (e.dataset.action = 'callback-quick-filter'),
                    (e.dataset.filterValue = 'sla_urgent'),
                    e.setAttribute('aria-pressed', 'false'),
                    (e.title = 'Pendientes con espera mayor a 2 horas'),
                    (e.textContent = 'Urgentes SLA'),
                    o.appendChild(e));
            }
            const i = e.querySelector('.callbacks-ops-actions');
            if (i) {
                if (!document.getElementById('callbacksBulkSelectVisibleBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkSelectVisibleBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-list-check"></i> Seleccionar visibles'),
                        i.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkClearBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-secondary btn-sm'),
                        (e.id = 'callbacksBulkClearBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-eraser"></i> Limpiar selección'),
                        i.appendChild(e));
                }
                if (!document.getElementById('callbacksBulkMarkBtn')) {
                    const e = document.createElement('button');
                    ((e.type = 'button'),
                        (e.className = 'btn btn-primary btn-sm'),
                        (e.id = 'callbacksBulkMarkBtn'),
                        (e.innerHTML =
                            '<i class="fas fa-check-double"></i> Marcar seleccionados'),
                        i.appendChild(e));
                }
            }
            return !0;
        })()),
        ae)
    );
}
function ue(e) {
    const t = ie(),
        n = e.filter((e) => le(e)).length,
        a = e.filter((e) => le(e) && ne.has(ce(e))).length,
        o = a > 0;
    (t.selectedCountEl && (t.selectedCountEl.textContent = String(a)),
        t.selectionChipEl &&
            t.selectionChipEl.classList.toggle('is-hidden', !o),
        t.selectVisibleBtn instanceof HTMLButtonElement &&
            (t.selectVisibleBtn.disabled = 0 === n),
        t.clearSelectionBtn instanceof HTMLButtonElement &&
            (t.clearSelectionBtn.disabled = !o),
        t.markSelectedBtn instanceof HTMLButtonElement &&
            (t.markSelectedBtn.disabled = !o));
}
function me(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function pe(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t;
}
function fe(e) {
    const t = pe(e);
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
              const o = n ? fe(e.fecha) : 0,
                  i = a ? fe(t.fecha) : 0;
              if (i !== o) return i - o;
              const r = pe(e.fecha),
                  s = pe(t.fecha);
              return (r ? r.getTime() : 0) - (s ? s.getTime() : 0);
          })
        : n.sort((e, t) => {
              const n = pe(e.fecha),
                  a = pe(t.fecha),
                  o = n ? n.getTime() : 0;
              return (a ? a.getTime() : 0) - o;
          });
}
function he() {
    if (oe) return;
    const e = document.getElementById('callbacksGrid');
    if (!e) return;
    const n = ie();
    (n.sortSelect instanceof HTMLSelectElement &&
        n.sortSelect.addEventListener('change', () => {
            ve({
                filter: Z.filter,
                search: Z.search,
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
                              filter: Z.filter,
                              search: Z.search,
                              sort: Z.sort,
                          }))
                        : C(
                              'No hay callbacks pendientes visibles para seleccionar.',
                              'info'
                          );
                })();
            }),
        n.clearSelectionBtn instanceof HTMLButtonElement &&
            n.clearSelectionBtn.addEventListener('click', () => {
                (ne.clear(),
                    ue(te),
                    ve({ filter: Z.filter, search: Z.search, sort: Z.sort }));
            }),
        n.markSelectedBtn instanceof HTMLButtonElement &&
            n.markSelectedBtn.addEventListener('click', () => {
                !(async function () {
                    const e =
                        0 === ne.size
                            ? []
                            : t.filter((e) => le(e) && ne.has(ce(e)));
                    if (0 === e.length)
                        return void C(
                            'No hay callbacks seleccionados para actualizar.',
                            'info'
                        );
                    let n = 0,
                        a = 0;
                    for (const t of e)
                        try {
                            let e = Number(t.id || 0);
                            (e <= 0 && ((e = Date.now() + n), (t.id = e)),
                                await S('callbacks', {
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
                        ? C(
                              'No se pudieron actualizar los callbacks seleccionados.',
                              'error'
                          )
                        : (await H(),
                          ne.clear(),
                          ve({
                              filter: Z.filter,
                              sort: Z.sort,
                              search: Z.search,
                          }),
                          K(),
                          a > 0
                              ? C(`Actualizados ${n}; con error ${a}.`, 'info')
                              : C(
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
                    n && (t ? ne.add(n) : ne.delete(n), ue(te));
                })(t.dataset.callbackSelectKey || '', t.checked);
        }),
        (oe = !0));
}
function ye() {
    ve({
        filter: ie().filterSelect?.value || W,
        sort: ie().sortSelect?.value || Z.sort,
    });
}
function ve(e, { preserveSearch: n = !0 } = {}) {
    (de(), he());
    const a = ie(),
        o = a.searchInput?.value ?? Z.search,
        i = a.sortSelect?.value ?? Z.sort,
        r = n ? (e.search ?? o) : (e.search ?? ''),
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
                        const t = x(e.status),
                            o = pe(e.fecha),
                            i = o ? me(o) : '';
                        return (
                            ('pending' !== n.filter || 'pendiente' === t) &&
                            ('contacted' !== n.filter || 'contactado' === t) &&
                            ('today' !== n.filter || i === a) &&
                            !(
                                'sla_urgent' === n.filter &&
                                (!le(e) || fe(e.fecha) < 120)
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
            filter: e.filter ?? a.filterSelect?.value ?? Z.filter,
            sort: e.sort ?? i,
            search: r,
        });
    ((Z.filter = s.criteria.filter),
        (Z.sort = s.criteria.sort),
        (Z.search = s.criteria.search),
        (te = s.filtered),
        (function (e) {
            const t = new Set(e.filter((e) => le(e)).map((e) => ce(e)));
            Array.from(ne).forEach((e) => {
                t.has(e) || ne.delete(e);
            });
        })(s.filtered),
        (function (e) {
            (de(), he());
            const t = document.getElementById('callbacksGrid');
            t &&
                (0 !== e.length
                    ? (t.innerHTML = e
                          .map((e) => {
                              const t = x(e.status),
                                  n = Number(e.id) || 0,
                                  a = encodeURIComponent(String(e.fecha || '')),
                                  o = String(e.fecha || ''),
                                  i = ce(e),
                                  r = encodeURIComponent(i),
                                  s = pe(o)?.getTime() || 0,
                                  c = fe(o),
                                  l = 'pendiente' === t,
                                  d = l && ne.has(i),
                                  u =
                                      c >= 120
                                          ? 'is-warning'
                                          : c >= 45
                                            ? 'is-accent'
                                            : 'is-muted';
                              return `\n            <div class="callback-card ${t}${d ? ' is-selected' : ''}" data-callback-status="${t}" data-callback-id="${n}" data-callback-key="${E(r)}" data-callback-date="${E(a)}" data-callback-ts="${E(String(s))}">\n                <div class="callback-header">\n                    <span class="callback-phone">${E(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${E(M(e.preferencia))}\n                </span>\n                ${l ? `<label class="toolbar-chip callback-select-chip"><input type="checkbox" data-callback-select-key="${E(r)}" ${d ? 'checked' : ''} /> Seleccionar</label>` : ''}\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${E(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                ${l ? `<span class="toolbar-chip callback-wait-chip ${u}">En cola: ${E(ge(c))}</span>` : ''}\n                <div class="callback-actions">\n                    <a href="tel:${E(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${E(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${l ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                          })
                          .join(''))
                    : (t.innerHTML =
                          '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n                </div>\n        '));
        })(s.filtered),
        (function (e, t, n) {
            const a = ie(),
                {
                    toolbarMeta: o,
                    toolbarState: i,
                    clearFiltersBtn: r,
                    quickFilterButtons: s,
                    filterSelect: c,
                    sortSelect: l,
                    searchInput: d,
                } = a,
                u = e.length,
                m = t.length,
                p = e.filter((e) => 'pendiente' === x(e.status)).length,
                f = e.filter((e) => 'contactado' === x(e.status)).length;
            o &&
                (o.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${E(String(u))}${m !== u ? ` de ${E(String(m))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${E(String(p))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${E(String(f))}</span>`,
                    '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
                ].join(''));
            const g = n.filter !== W,
                b = '' !== n.search,
                h = n.sort !== J;
            if (i)
                if (g || b || h) {
                    const e = [
                        '<span class="toolbar-state-label">Criterios activos:</span>',
                    ];
                    (g &&
                        e.push(
                            `<span class="toolbar-state-value">${E(X[n.filter] || n.filter)}</span>`
                        ),
                        b &&
                            e.push(
                                `<span class="toolbar-state-value is-search">Busqueda: ${E(n.search)}</span>`
                            ),
                        h &&
                            e.push(
                                `<span class="toolbar-state-value is-sort">Orden: ${E(ee[n.sort] || n.sort)}</span>`
                            ),
                        e.push(
                            `<span class="toolbar-state-value">Resultados: ${E(String(u))}</span>`
                        ),
                        (i.innerHTML = e.join('')));
                } else
                    i.innerHTML =
                        '<span class="toolbar-state-empty">Sin filtros activos</span>';
            var y, v;
            (r && r.classList.toggle('is-hidden', !g && !b && !h),
                c && (c.value = n.filter),
                l && (l.value = n.sort),
                d && (d.value = n.search),
                (y = s),
                (v = n.filter),
                y.forEach((e) => {
                    const t = e.dataset.filterValue === v;
                    (e.classList.toggle('is-active', t),
                        e.setAttribute('aria-pressed', String(t)));
                }));
        })(s.filtered, t, s.criteria),
        ue(s.filtered),
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
                    .filter((e) => 'pendiente' === x(e.status))
                    .map((e) => ({ callback: e, minutesWaiting: fe(e.fecha) }))
                    .sort((e, t) => {
                        if (t.minutesWaiting !== e.minutesWaiting)
                            return t.minutesWaiting - e.minutesWaiting;
                        const n = pe(e.callback.fecha),
                            a = pe(t.callback.fecha);
                        return (n ? n.getTime() : 0) - (a ? a.getTime() : 0);
                    }));
            var c;
            const l = s.length,
                d = s.filter((e) => e.minutesWaiting >= 120).length,
                u = s.filter((e) => e.minutesWaiting >= 45).length,
                m = me(new Date()),
                p = s.filter((e) => {
                    const t = pe(e.callback.fecha);
                    return !!t && me(t) === m;
                }).length;
            ((n.textContent = E(String(l))),
                (a.textContent = E(String(d))),
                (o.textContent = E(String(p))),
                (t.className = 'toolbar-chip'),
                d > 0 || l >= 8
                    ? (t.classList.add('is-warning'),
                      (t.textContent = 'Cola: prioridad alta'))
                    : u >= 2 || l >= 3
                      ? (t.classList.add('is-accent'),
                        (t.textContent = 'Cola: atención requerida'))
                      : (t.classList.add('is-muted'),
                        (t.textContent = 'Cola: estable')));
            const f = s[0] || null;
            if (!f)
                return (
                    (i.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = pe(f.callback.fecha),
                b = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((i.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${E(f.callback.telefono || 'Sin teléfono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${E(ge(f.minutesWaiting))} | Preferencia: ${E(M(f.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${E(b)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function we(e, { preserveSearch: t = !0 } = {}) {
    ve({ filter: e }, { preserveSearch: t });
}
function Se() {
    ve({ search: ie().searchInput?.value || '' });
}
function ke() {
    const e = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    if (0 === e.length)
        return (C('No hay callbacks pendientes para priorizar.', 'info'), !1);
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
let Ee = !1;
function Ce(e, t = 'muted') {
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
function Be(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function $e() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function Le(e) {
    const { subscribeBtn: t, testBtn: n } = $e();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Ie(e) {
    const { subscribeBtn: t } = $e();
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
async function Ae() {
    const e = await S('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Te() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Ie(Boolean(t)),
        Ce(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function De() {
    const { subscribeBtn: e } = $e();
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
                      (await S('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              Ce('disponible', 'muted'),
              C('Notificaciones desactivadas', 'info'))
            : (await (async function () {
                  if ('granted' !== (await Notification.requestPermission()))
                      throw new Error('Permiso de notificaciones denegado');
                  const e = await Ae(),
                      t = await navigator.serviceWorker.ready,
                      n = await t.pushManager.getSubscription();
                  if (n) return n;
                  const a = await t.pushManager.subscribe({
                      userVisibleOnly: !0,
                      applicationServerKey: Be(e),
                  });
                  return (
                      await S('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              Ce('activo', 'ok'),
              C('Notificaciones activadas', 'success'));
    } catch (e) {
        (Ce('error', 'error'),
            C(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await Te().catch(() => {
                Ie(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function Ne() {
    const { testBtn: e } = $e();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await S('push-test', { method: 'POST', body: {} })).result ||
                {},
            t = Number(e.success || 0),
            n = Number(e.failed || 0);
        n > 0
            ? C(`Push test: ${t} ok, ${n} fallidos`, 'warning')
            : C(`Push test enviado (${t})`, 'success');
    } catch (e) {
        C(`Push test: ${e.message || 'error'}`, 'error');
    } finally {
        (t && (t.className = n), (e.disabled = !1));
    }
}
const Me = 'themeMode',
    xe = new Set(['light', 'dark', 'system']);
let qe = 'system',
    _e = null,
    He = !1,
    Pe = !1,
    Re = null;
function Fe() {
    return (
        _e ||
            'function' != typeof window.matchMedia ||
            (_e = window.matchMedia('(prefers-color-scheme: dark)')),
        _e
    );
}
function je(e) {
    return xe.has(String(e || '').trim());
}
function Oe() {
    try {
        const e = localStorage.getItem(Me) || 'system';
        return je(e) ? e : 'system';
    } catch (e) {
        return 'system';
    }
}
function Ue(e) {
    const t = document.documentElement;
    if (!t) return;
    const n = (function (e) {
        return 'system' !== e ? e : Fe()?.matches ? 'dark' : 'light';
    })(e);
    (t.setAttribute('data-theme-mode', e), t.setAttribute('data-theme', n));
}
function ze() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((e) => {
            const t = e.dataset.themeMode === qe;
            (e.classList.toggle('is-active', t),
                e.setAttribute('aria-pressed', String(t)));
        });
}
function Ve(e, { persist: t = !1, animate: n = !1 } = {}) {
    const a = je(e) ? e : 'system';
    ((qe = a),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(Me, e);
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
function Ge() {
    'system' === qe && (Ue('system'), ze());
}
function Ke(e) {
    (e?.key && e.key !== Me) ||
        Ve(
            'string' == typeof e?.newValue && je(e.newValue)
                ? e.newValue
                : Oe(),
            { persist: !1, animate: !1 }
        );
}
const We = 'admin-appointments-sort',
    Je = 'admin-appointments-density',
    Ye = 'datetime_desc',
    Qe = 'comfortable',
    Ze = 'all',
    Xe = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
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
function ot(e) {
    const t = String(e || '').trim();
    return tt.has(t) ? t : Ze;
}
function it(e) {
    const t = String(e || '').trim();
    return Xe.has(t) ? t : Ye;
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
        o = 'noshow' === a ? 'no_show' : a,
        i = (function (e, t = new Date()) {
            const n = nt(e);
            return n
                ? (n.getTime() - t.getTime()) / 36e5
                : Number.POSITIVE_INFINITY;
        })(e, t),
        r = 'pending_transfer_review' === n,
        s = 'no_show' === o,
        c = 'completed' === o,
        l = !(c || 'cancelled' === o || s),
        d = l && Number.isFinite(i) && i < -2,
        u = l && Number.isFinite(i) && i >= -2 && i <= 24,
        m = nt(e),
        p =
            s && m
                ? (t.getTime() - m.getTime()) / 864e5
                : Number.POSITIVE_INFINITY,
        f = s && Number.isFinite(p) && p >= 0 && p <= 7;
    let g = 8;
    r
        ? (g = 0)
        : d
          ? (g = 1)
          : u
            ? (g = 2)
            : f
              ? (g = 3)
              : 'confirmed' === o
                ? (g = 4)
                : 'pending' === o
                  ? (g = 5)
                  : s
                    ? (g = 6)
                    : c && (g = 7);
    const b = [];
    return (
        r && b.push({ tone: 'is-warning', label: 'Validar pago' }),
        d
            ? b.push({ tone: 'is-warning', label: 'Atrasada' })
            : u && b.push({ tone: 'is-accent', label: 'Proxima <24h' }),
        f && b.push({ tone: 'is-muted', label: 'Reagendar no-show' }),
        {
            status: o,
            isPendingTransfer: r,
            isOverdue: d,
            isImminent: u,
            requiresNoShowFollowUp: f,
            priorityScore: g,
            hoursUntil: i,
            badges: b,
        }
    );
}
function dt(e) {
    return lt(e).priorityScore;
}
function ut() {
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
            filter: ot(e?.value || Ze),
            sort: it(t?.value || Ye),
            search: String(n?.value || '').trim(),
        };
    })();
    !(function (e) {
        const t = ot(e),
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
                a = ot(t);
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
                        const t = nt(e);
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
                    break;
                case 'triage_attention':
                    o = o.filter((e) => {
                        const t = lt(e, i);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    });
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
                        const t = lt(e);
                        return (
                            t.isPendingTransfer ||
                            t.isOverdue ||
                            t.isImminent ||
                            t.requiresNoShowFollowUp
                        );
                    }).length,
                    d = a.filter((e) => {
                        const t = String(e?.status || 'confirmed');
                        return (
                            'cancelled' !== t &&
                            'completed' !== t &&
                            'no_show' !== t &&
                            'noshow' !== t
                        );
                    }).length,
                    u = [
                        `<span class="toolbar-chip is-accent">Mostrando ${E(String(i))}${r !== i ? ` de ${E(String(r))}` : ''}</span>`,
                        `<span class="toolbar-chip">Hoy: ${E(String(c))}</span>`,
                        `<span class="toolbar-chip">Accionables: ${E(String(d))}</span>`,
                    ];
                (s > 0 &&
                    u.push(
                        `<span class="toolbar-chip is-warning">Por validar: ${E(String(s))}</span>`
                    ),
                    l > 0 &&
                        u.push(
                            `<span class="toolbar-chip is-accent">Triage: ${E(String(l))}</span>`
                        ),
                    (n.innerHTML = u.join('')));
            })(t),
            0 === t.length)
        )
            return void (a.innerHTML =
                '\n            <tr class="table-empty-row">\n                <td colspan="8">\n                    <div class="table-empty-state">\n                        <i class="fas fa-calendar-check" aria-hidden="true"></i>\n                        <strong>No hay citas registradas</strong>\n                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>\n                    </div>\n                </td>\n            </tr>\n        ');
        const o = (function (e, t) {
            const n = it(t),
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
                    const n = dt(e) - dt(t);
                    if (0 !== n) return n;
                    const a = lt(e),
                        i = lt(t);
                    return a.hoursUntil !== i.hoursUntil
                        ? a.hoursUntil - i.hoursUntil
                        : o(e, t);
                }
                return -o(e, t);
            });
        })(t, n?.sort || Ye);
        a.innerHTML = o
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    o = 'cancelled' === t,
                    i = 'no_show' === t || 'noshow' === t,
                    r = lt(e),
                    s = [
                        'appointment-row',
                        a ? 'is-payment-review' : '',
                        o ? 'is-cancelled' : '',
                        i ? 'is-noshow' : '',
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
                        ? `<br><small>Asignado: ${E(A(e.doctorAssigned))}</small>`
                        : '',
                    l = e.transferReference
                        ? `<br><small>Ref: ${E(e.transferReference)}</small>`
                        : '',
                    d = (function (e) {
                        const t = String(e || '').trim();
                        return '' === t
                            ? ''
                            : t.startsWith('/') || /^https?:\/\//i.test(t)
                              ? t
                              : '';
                    })(e.transferProofUrl),
                    u = d
                        ? `<br><a class="appointment-proof-link" href="${E(d)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> Ver comprobante</a>`
                        : '',
                    m = String(e.phone || '').replace(/\D/g, ''),
                    p = r.badges
                        .map(
                            (e) =>
                                `<span class="toolbar-chip ${E(e.tone)}">${E(e.label)}</span>`
                        )
                        .join(''),
                    f = r.isPendingTransfer
                        ? `Hola ${String(e.name || '').trim()}, estamos validando tu comprobante de pago para la cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()}.`
                        : r.isOverdue
                          ? `Hola ${String(e.name || '').trim()}, notamos que tu cita de ${String(e.date || '').trim()} ${String(e.time || '').trim()} quedo pendiente. Te ayudamos a reprogramar.`
                          : r.requiresNoShowFollowUp
                            ? `Hola ${String(e.name || '').trim()}, podemos ayudarte a reagendar tu consulta cuando te convenga.`
                            : '',
                    g = `https://wa.me/${encodeURIComponent(m)}${f ? `?text=${encodeURIComponent(f)}` : ''}`;
                return `\n        <tr class="${s}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${E(e.name)}</strong><br>\n                <small>${E(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${E(String(e.phone || 'Sin telefono'))}</span>\n                    ${p}\n                </div>\n            </td>\n            <td data-label="Servicio">${E(I(e.service))}</td>\n            <td data-label="Doctor">${E(A(e.doctor))}${c}</td>\n            <td data-label="Fecha">${E(
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
                )}</td>\n            <td data-label="Hora">${E(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${E(e.price || '$0.00')}</strong>\n                <small>${E(D(e.paymentMethod))} - ${E(N(n))}</small>\n                ${l}\n                ${u}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${E(t)}">\n                    ${E(T(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${E(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${E(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${E(g)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="${E(r.isPendingTransfer ? 'WhatsApp para validar pago' : r.isOverdue ? 'WhatsApp para reprogramar cita atrasada' : r.requiresNoShowFollowUp ? 'WhatsApp para seguimiento no-show' : 'WhatsApp')}" aria-label="Abrir WhatsApp de ${E(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = at();
            if (!n) return;
            const o = ot(e?.filter || Ze),
                i = it(e?.sort || Ye),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = at();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = o !== Ze,
                l = r.length > 0,
                d = i !== Ye || s !== Qe;
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
                    `<span class="toolbar-state-value is-filter">Filtro: ${E(
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
                            return t[String(e || Ze)] || t.all;
                        })(o)
                    )}</span>`
                ),
                l &&
                    m.push(
                        `<span class="toolbar-state-value is-search">Busqueda: ${E(r)}</span>`
                    ),
                m.push(
                    `<span class="toolbar-state-value">Resultados: ${E(String(u))}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-sort">Orden: ${E(
                        (function (e) {
                            const t = {
                                datetime_desc: 'Mas recientes primero',
                                datetime_asc: 'Proximas primero',
                                triage: 'Triage operativo',
                                patient_az: 'Paciente (A-Z)',
                            };
                            return t[it(e)] || t.datetime_desc;
                        })(i)
                    )}</span>`
                ),
                m.push(
                    `<span class="toolbar-state-value is-density">Densidad: ${E(
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
    ut();
}
function pt(e, t = {}) {
    const { filterSelect: n, searchInput: a } = at(),
        o = ot(e),
        i = !1 !== t.preserveSearch;
    (n && (n.value = o), !i && a && (a.value = ''), ut());
}
function ft() {
    pt(Ze, { preserveSearch: !1 });
}
function gt(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
function bt() {
    if (!Array.isArray(e) || 0 === e.length)
        return void C('No hay citas para exportar', 'warning');
    const t = e.map((e) => [
            Number(e.id) || 0,
            e.date || '',
            e.time || '',
            gt(e.name || ''),
            gt(e.email || ''),
            gt(e.phone || ''),
            gt(I(e.service)),
            gt(A(e.doctor)),
            e.price || '',
            gt(T(e.status || 'confirmed')),
            gt(N(e.paymentStatus)),
            gt(D(e.paymentMethod)),
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
        C('CSV exportado correctamente', 'success'));
}
let ht = null,
    yt = new Date(),
    vt = !1,
    wt = null,
    St = {},
    kt = !1;
const Et = 'admin-availability-day-clipboard',
    Ct = 'admin-availability-last-selected-date';
function Bt(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = {};
    return (
        Object.keys(t)
            .sort()
            .forEach((e) => {
                if (!Dt(e)) return;
                const a = qt(t[e] || []);
                a.length > 0 && (n[e] = a);
            }),
        n
    );
}
function $t(e) {
    St = Bt(e);
}
function Lt() {
    const e = Bt(a),
        t = Bt(St);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                o = t[n] || [];
            return a.length !== o.length || a.some((e, t) => e !== o[t]);
        });
}
function It() {
    return Lt().length > 0;
}
function At(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Tt(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Dt(e) {
    return Boolean(Tt(e));
}
function Nt(e) {
    try {
        const t = String(e || '').trim();
        if (!Dt(t)) return void localStorage.removeItem(Ct);
        localStorage.setItem(Ct, t);
    } catch (e) {}
}
function Mt() {
    wt ||
        (wt = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(Et) || 'null');
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
function xt() {
    try {
        if (
            wt &&
            'object' == typeof wt &&
            Array.isArray(wt.slots) &&
            wt.slots.length > 0
        )
            return void localStorage.setItem(Et, JSON.stringify(wt));
        localStorage.removeItem(Et);
    } catch (e) {}
}
function qt(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function _t(e, t) {
    const n = String(e || '').trim(),
        a = qt(t);
    if (!n || 0 === a.length) return ((wt = null), void xt());
    ((wt = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        xt());
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
function Pt() {
    return ht ? qt(a[ht] || []) : [];
}
function Rt(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const o = qt(t);
    0 !== o.length ? (a[n] = o) : delete a[n];
}
function Ft(e, t) {
    const n = Tt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const o = Math.max(0, Math.round(a));
    return 0 === o
        ? []
        : Array.from({ length: o }, (e, t) => {
              const a = new Date(n);
              return (a.setDate(n.getDate() + t), At(a));
          });
}
function jt(e) {
    return (Array.isArray(e) ? e : []).reduce(
        (e, t) => e + qt(a[t] || []).length,
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
    const o = new Date(n);
    o.setDate(n.getDate() + a);
    const i = At(o);
    (Ot(i), rn(i));
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
function Gt(e) {
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
            'google' === String(o.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = vt ? 'Solo lectura' : 'Editable',
        i = String(ht || '').trim(),
        r = i ? (Array.isArray(a[i]) ? a[i].length : 0) : null;
    if (!i)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${E(t)}</span>`,
            `<span class="availability-summary-chip ${vt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${E(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Tt(i),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : i;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${E(t)}</span>`,
        `<span class="availability-summary-chip ${vt ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${E(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${E(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${E(String(r ?? 0))}</span>`,
    ].join('');
}
function Wt() {
    Mt();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(ht || '').trim()),
        o = Pt(),
        i = o.length > 0,
        r = n ? Ft(ht, 7) : [],
        s = jt(r),
        c = r.filter((e) => qt(a[e] || []).length > 0).length,
        l = qt(wt?.slots || []),
        d = l.length > 0,
        u = e.querySelector('[data-action="copy-availability-day"]'),
        m = e.querySelector('[data-action="paste-availability-day"]'),
        p = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        f = e.querySelector('[data-action="duplicate-availability-next-week"]'),
        g = e.querySelector('[data-action="clear-availability-day"]'),
        b = e.querySelector('[data-action="clear-availability-week"]');
    if (
        (u instanceof HTMLButtonElement && (u.disabled = !n || !i),
        m instanceof HTMLButtonElement && (m.disabled = !n || !d || vt),
        p instanceof HTMLButtonElement && (p.disabled = !n || !i || vt),
        f instanceof HTMLButtonElement && (f.disabled = !n || !i || vt),
        g instanceof HTMLButtonElement && (g.disabled = !n || !i || vt),
        b instanceof HTMLButtonElement && (b.disabled = !n || 0 === s || vt),
        e.classList.toggle('is-hidden', !n && !d),
        !n && !d)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const h = [];
    (n &&
        (h.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${E(Ht(ht))}</span>`
        ),
        h.push(
            `<span class="toolbar-chip is-muted">Slots: ${E(String(o.length))}</span>`
        ),
        h.push(
            `<span class="toolbar-chip is-muted">Semana: ${E(String(c))} dia(s), ${E(String(s))} slot(s)</span>`
        )),
        d
            ? h.push(
                  `<span class="toolbar-chip">Portapapeles: ${E(String(l.length))} (${E(Ht(wt?.sourceDate))})</span>`
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
    const o = Lt(),
        i = o.length,
        r = o
            .slice(0, 2)
            .map((e) => Ht(e))
            .join(', ');
    if (vt)
        t.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    else if (0 === i)
        t.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    else {
        const e = `${i} día${1 === i ? '' : 's'} con cambios pendientes`,
            n = r ? ` (${E(r)}${i > 2 ? '…' : ''})` : '';
        t.innerHTML = `<span class="toolbar-chip is-info">${E(e)}${n}</span>`;
    }
    (n instanceof HTMLButtonElement &&
        ((n.disabled = vt || 0 === i || kt),
        n.setAttribute('aria-busy', String(kt))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === i || kt));
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
    const a = String(o.source || 'store'),
        i = String(o.mode || 'live'),
        r = String(o.timezone || 'America/Guayaquil'),
        s = String(o.calendarAuth || 'n/d'),
        c = !1 === o.calendarTokenHealthy ? 'no' : 'si',
        l = !1 === o.calendarConfigured ? 'no' : 'si',
        d = !1 === o.calendarReachable ? 'no' : 'si',
        u = zt(o.generatedAt),
        m = zt(o.calendarLastSuccessAt),
        p = zt(o.calendarLastErrorAt),
        f = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${E(n)}</strong> | TZ: <strong>${E(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${E(s)}</strong> | Token OK: <strong>${E(c)}</strong> | Configurado: <strong>${E(l)}</strong> | Reachable: <strong>${E(d)}</strong> | Ultimo exito: <strong>${E(m)}</strong> | Snapshot: <strong>${E(u)}</strong>`;
            ('blocked' === i &&
                f &&
                (e += ` | Ultimo error: <strong>${E(p)}</strong> (${E(f)})`),
                (t.innerHTML = e));
        }
        Vt(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${E(u)}</strong>`),
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
        Wt(),
        Jt(),
        !n)
    )
        return;
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const b = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = E(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${E(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
            : `${t}: ${a}`;
    };
    n.innerHTML = [
        b('rosero', 'Dr. Rosero'),
        b('narvaez', 'Dra. Narváez'),
    ].join(' | ');
}
function Qt() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Gt(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        Zt(),
        Kt(),
        Wt(),
        Jt());
}
function Zt() {
    const e = Boolean(String(ht || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', vt || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', vt || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = vt || !e;
        })),
        Wt(),
        Jt());
}
function Xt() {
    const e = yt.getFullYear(),
        t = yt.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = At(new Date());
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
        const o = At(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            (i.tabIndex = 0),
            i.setAttribute('role', 'button'),
            i.setAttribute('aria-label', `Seleccionar ${o}`),
            ht === o && i.classList.add('selected'),
            s === o && i.classList.add('today'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => rn(o)),
            i.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void rn(o))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void Ut(o, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void Ut(o, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void Ut(o, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), Ut(o, 7))
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
function en(e) {
    (yt.setMonth(yt.getMonth() + e), Xt());
}
function tn() {
    const e = new Date();
    ((yt = new Date(e.getFullYear(), e.getMonth(), 1)), Xt(), rn(At(e)));
}
function nn() {
    const e = (function ({
        referenceDate: e = '',
        includeReference: t = !1,
    } = {}) {
        const n = Object.keys(a || {})
            .filter((e) => {
                if (!Dt(e)) return !1;
                const t = a[e];
                return Array.isArray(t) && t.length > 0;
            })
            .sort();
        if (0 === n.length) return '';
        const o = Dt(e) ? String(e).trim() : At(new Date()),
            i = t ? (e) => e >= o : (e) => e > o;
        return n.find(i) || n[0];
    })({ referenceDate: ht || At(new Date()), includeReference: !1 });
    e
        ? (Ot(e), rn(e))
        : C('No hay fechas con horarios configurados', 'warning');
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
    if (!Dt(e)) return;
    ((ht = e), t && Nt(e), Xt());
    const n = Tt(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        n.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        Zt(),
        Kt(),
        sn(e));
}
function sn(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Gt(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            Kt(),
            Wt(),
            void Jt()
        );
    const o = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${vt ? ' is-readonly' : ''}">\n            <span class="time">${E(e)}</span>\n            <div class="slot-actions">\n                ${vt ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        Kt(),
        Wt(),
        Jt());
}
function cn() {
    (Xt(), ht ? sn(ht) : Qt());
}
function ln(e) {
    ('function' == typeof e && e(), cn());
}
async function dn() {
    if (vt)
        return (
            C(
                'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                'warning'
            ),
            !1
        );
    if (!It()) return (C('No hay cambios pendientes por guardar', 'info'), !1);
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
                    const e = Bt(a);
                    return (
                        p(e),
                        await S('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        $t(a),
                        !0
                    );
                } finally {
                    ((kt = !1), Jt());
                }
            })(),
            C('Cambios de disponibilidad guardados', 'success'),
            !0
        );
    } catch (e) {
        return (C(`No se pudieron guardar cambios: ${e.message}`, 'error'), !1);
    }
}
function un() {
    It()
        ? confirm(
              'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
          ) && (p(Bt(St)), cn(), C('Cambios pendientes descartados', 'success'))
        : C('No hay cambios pendientes por descartar', 'info');
}
function mn() {
    return vt
        ? (C(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!ht || (C('Selecciona una fecha primero', 'warning'), !1);
}
function pn() {
    if (!ht) return void C('Selecciona una fecha para copiar', 'warning');
    const e = Pt();
    0 !== e.length
        ? (_t(ht, e),
          Wt(),
          C(
              `Día copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
              'success'
          ))
        : C('No hay horarios para copiar en este dia', 'warning');
}
async function fn() {
    if ((Mt(), !mn())) return;
    const e = qt(wt?.slots || []);
    if (0 === e.length) return void C('Portapapeles vacio', 'warning');
    const t = Pt();
    t.length === e.length && t.every((t, n) => t === e[n])
        ? C('La fecha ya tiene esos mismos horarios', 'warning')
        : (t.length > 0 &&
              !confirm(
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${Ht(ht)} con ${e.length}?`
              )) ||
          (ln(() => {
              Rt(ht, e);
          }),
          C('Horarios pegados en cambios pendientes', 'success'));
}
async function gn() {
    if (!mn()) return;
    const e = Pt();
    if (0 === e.length)
        return void C('No hay horarios para duplicar en este dia', 'warning');
    const t = Tt(ht);
    if (!t) return void C('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const o = At(n),
        i = qt(a[o] || []);
    (i.length > 0 &&
        !confirm(
            `${Ht(o)} ya tiene ${i.length} horario${1 === i.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (ln(() => {
            (Rt(o, e), _t(ht, e));
        }),
        Ot(o),
        rn(o),
        C(`Horarios duplicados a ${Ht(o)} (pendiente de guardar)`, 'success'));
}
async function bn() {
    if (!mn()) return;
    const e = Pt();
    if (0 === e.length)
        return void C('No hay horarios para duplicar en este dia', 'warning');
    const t = Ft(ht, 8).slice(1);
    if (0 === t.length)
        return void C('No se pudieron preparar los siguientes dias', 'error');
    const n = t.filter((t) => {
        const n = qt(a[t] || []);
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
                _t(ht, e));
        }),
        C(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function hn() {
    if (!mn()) return;
    const e = Pt();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${Ht(ht)}?`
          ) &&
          (ln(() => {
              Rt(ht, []);
          }),
          Ot(ht),
          rn(ht),
          C('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : C('No hay horarios que limpiar en este dia', 'warning');
}
async function yn() {
    if (!mn()) return;
    const e = Ft(ht, 7);
    if (0 === e.length)
        return void C('No se pudo preparar la semana de limpieza', 'error');
    const t = e.filter((e) => qt(a[e] || []).length > 0);
    if (0 === t.length)
        return void C(
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
        C(
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
    wn = {
        appt_overdue: 'Cita vencida',
        appt_current: 'Cita vigente',
        walk_in: 'Walk-in',
    },
    Sn = new Set(['completed', 'no_show', 'cancelled']);
function kn(e) {
    const t = Date.parse(String(e || ''));
    return Number.isFinite(t)
        ? new Date(t).toLocaleString('es-EC', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '--';
}
function En(e) {
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
function Cn(e) {
    if (!e || 'object' != typeof e) return;
    const t = Number(e.id || 0);
    if (!t) return;
    const n = Array.isArray(s) ? [...s] : [],
        a = n.findIndex((e) => Number(e?.id || 0) === t);
    (a >= 0 ? (n[a] = { ...n[a], ...e }) : n.push(e), h(n));
}
function Bn(e) {
    return String(e?.message || 'Error desconocido');
}
function $n(e) {
    const t = Bn(e)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return t.includes('consultorio') && t.includes('ocupado');
}
function Ln() {
    (!(function () {
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
            o = document.getElementById('queueC1Now'),
            i = document.getElementById('queueC2Now'),
            r = document.getElementById('queueNextAdminList'),
            s = document.getElementById('queueLastUpdate');
        (t && (t.textContent = String(e.waitingCount || 0)),
            n && (n.textContent = String(e.calledCount || 0)),
            a && (a.textContent = String(e.waitingCount || 0)),
            s && (s.textContent = kn(e.updatedAt)));
        const l = e?.callingNowByConsultorio?.[1],
            d = e?.callingNowByConsultorio?.[2];
        if (
            (o &&
                (o.textContent = l
                    ? `${l.ticketCode || '--'} · ${l.patientInitials || '--'}`
                    : 'Sin llamado'),
            i &&
                (i.textContent = d
                    ? `${d.ticketCode || '--'} · ${d.patientInitials || '--'}`
                    : 'Sin llamado'),
            r)
        ) {
            const t = Array.isArray(e.nextTickets) ? e.nextTickets : [];
            0 === t.length
                ? (r.innerHTML =
                      '<li class="empty-message">No hay turnos en espera.</li>')
                : (r.innerHTML = t
                      .map(
                          (e) =>
                              `\n                        <li>\n                            <strong>${E(e.ticketCode || '--')}</strong>\n                            <span>${E(e.patientInitials || '--')}</span>\n                            <span>#${E(e.position || '-')}</span>\n                        </li>\n                    `
                      )
                      .join(''));
        }
    })(),
        (function () {
            const e = document.getElementById('queueTableBody');
            if (!e) return;
            const t = (function () {
                const e = {
                    waiting: 0,
                    called: 1,
                    completed: 2,
                    no_show: 3,
                    cancelled: 4,
                };
                return [...(Array.isArray(s) ? s : [])].sort((t, n) => {
                    const a = (e[t?.status] ?? 9) - (e[n?.status] ?? 9);
                    if (0 !== a) return a;
                    const o = Date.parse(String(t?.createdAt || '')),
                        i = Date.parse(String(n?.createdAt || ''));
                    return Number.isFinite(o) && Number.isFinite(i) && o !== i
                        ? o - i
                        : Number(t?.id || 0) - Number(n?.id || 0);
                });
            })();
            0 !== t.length
                ? (e.innerHTML = t
                      .map((e) => {
                          const t = Number(e.id || 0),
                              n = String(e.status || 'waiting'),
                              a = 'waiting' === n || 'called' === n,
                              o = 'called' === n,
                              i = Sn.has(n),
                              r = !i,
                              s = !i;
                          return `\n                <tr>\n                    <td>${E(e.ticketCode || '--')}</td>\n                    <td>${E(e.queueType || '--')}</td>\n                    <td>${E(wn[e.priorityClass] || e.priorityClass || '--')}</td>\n                    <td>${E(vn[n] || n)}</td>\n                    <td>${E(e.assignedConsultorio || '-')}</td>\n                    <td>${E(kn(e.createdAt))}</td>\n                    <td>${E(e.patientInitials || '--')}</td>\n                    <td>\n                        <div class="queue-actions">\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reprint-ticket" data-queue-id="${t}">\n                                Reimprimir\n                            </button>\n                            ${a ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${t}">\n                                Re-llamar\n                            </button>` : ''}\n                            ${o ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${t}">\n                                Liberar\n                            </button>` : ''}\n                            ${r ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${t}">\n                                Completar\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${t}">\n                                No show\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${t}">\n                                Cancelar\n                            </button>` : ''}\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C1\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C2\n                            </button>\n                        </div>\n                    </td>\n                </tr>\n            `;
                      })
                      .join(''))
                : (e.innerHTML =
                      '\n            <tr>\n                <td colspan="8" class="empty-message">Sin tickets en cola.</td>\n            </tr>\n        ');
        })());
}
async function In({ silent: e = !1 } = {}) {
    try {
        const e = (await S('data')).data || {};
        return (
            h(Array.isArray(e.queue_tickets) ? e.queue_tickets : []),
            y(
                e.queueMeta && 'object' == typeof e.queueMeta
                    ? e.queueMeta
                    : null
            ),
            Ln(),
            !0
        );
    } catch (t) {
        return (
            e || C(`No se pudo actualizar turnero: ${t.message}`, 'warning'),
            !1
        );
    }
}
async function An(e) {
    const t = Number(e || 0);
    if ([1, 2].includes(t))
        try {
            const e = await S('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: t },
                }),
                n = e?.data?.ticket || null;
            (Cn(n),
                y(En(e?.data?.queueState || {})),
                Ln(),
                n && n.ticketCode
                    ? C(
                          `Llamando ${n.ticketCode} en Consultorio ${t}`,
                          'success'
                      )
                    : C(`Consultorio ${t} actualizado`, 'success'));
        } catch (e) {
            if ($n(e))
                return (await In({ silent: !0 }), void C(Bn(e), 'warning'));
            C(`No se pudo llamar siguiente turno: ${Bn(e)}`, 'error');
        }
    else C('Consultorio invalido', 'error');
}
const Tn = new Map([
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
    Dn = [
        'a[href]',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','),
    Nn = 'adminLastSection',
    Mn = 'adminSidebarCollapsed',
    xn = {
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
let qn = 0,
    _n = 0;
function Hn() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function Pn(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(Hn().map((e) => e.dataset.section)).has(n) ? n : t;
}
function Rn() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? Pn(e, 'dashboard')
        : (function () {
              try {
                  return Pn(localStorage.getItem(Nn), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function Fn() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        Rn() ||
        'dashboard'
    );
}
function jn() {
    return window.innerWidth <= 1024;
}
function On() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Un() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function zn(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function Vn(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!jn() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        zn(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(Mn, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function Gn() {
    jn()
        ? Vn(!1, { persist: !1 })
        : Vn(
              (function () {
                  try {
                      return '1' === localStorage.getItem(Mn);
                  } catch (e) {
                      return !1;
                  }
              })(),
              { persist: !1 }
          );
}
function Kn(e) {
    const t = Pn(e, 'dashboard');
    (Hn().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = Pn(e, 'dashboard');
            try {
                localStorage.setItem(Nn, t);
            } catch (e) {}
        })(t));
}
function Wn(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function Jn() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !qn))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - qn),
        a = (function (e) {
            if (!qn) return 'sin actualizar';
            const t = Math.max(0, e - qn),
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
function Yn() {
    ((qn = Date.now()), Jn());
}
function Qn({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function Zn(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = xn[e && xn[e] ? e : 'dashboard'];
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
        }));
}
function Xn() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function ea() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(Dn)).filter((e) => {
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
function ta(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = jn(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function na(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = Xn();
    if (!t || !n || !a) return;
    const o = Boolean(e && jn());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        ta(o),
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
                const n = ea();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function aa({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = Xn(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (na(!1), e && n && t && t.focus());
}
function oa(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function ia(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = Pn(Fn(), 'dashboard'),
        s = Pn(e, 'dashboard');
    if (
        'availability' === r &&
        'availability' !== s &&
        It() &&
        !confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        )
    )
        return (Kn(r), a || Wn(r), o && oa(r), !1);
    if ((Kn(s), i && aa(), n))
        try {
            (await H(), Yn());
        } catch (e) {
            C(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    return (await da(s), a && Wn(s), o && oa(s), !0);
}
async function ra(e) {
    (await ia('appointments', { focus: !1 }),
        pt(e, { preserveSearch: !1 }),
        oa('appointments'));
}
async function sa(e) {
    (await ia('callbacks', { focus: !1 }),
        we(e, { preserveSearch: !1 }),
        oa('callbacks'));
}
async function ca({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await H(),
            Yn(),
            await da(Fn()),
            e && C('Datos actualizados', 'success'),
            !0
        );
    } catch (e) {
        return (
            t &&
                C(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                ),
            !1
        );
    }
}
async function la(e) {
    const t = document.getElementById('adminQuickCommand'),
        n = String(e || '')
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    if (!n)
        return (
            C(
                'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
                'info'
            ),
            Qn(),
            !1
        );
    if ('help' === n || 'ayuda' === n)
        return (
            C(
                'Comandos: citas hoy, citas por validar, callbacks pendientes, disponibilidad hoy, exportar csv.',
                'info'
            ),
            !0
        );
    if (n.includes('exportar') && n.includes('csv'))
        return (
            await ia('appointments', { focus: !1 }),
            bt(),
            oa('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await ia('dashboard'), !0);
    if (
        n.includes('turnero') ||
        n.includes('cola') ||
        n.includes('consultorio')
    )
        return (
            await ia('queue', { focus: !1 }),
            n.includes('c1') || n.includes('consultorio 1')
                ? await An(1)
                : n.includes('c2') || n.includes('consultorio 2')
                  ? await An(2)
                  : await In({ silent: !0 }),
            oa('queue'),
            !0
        );
    if (n.includes('resena') || n.includes('review'))
        return (await ia('reviews'), !0);
    if (n.includes('callback'))
        return (
            await sa(
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
        return (await ra(e), n.includes('limpiar') && ft(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await ia('availability', { focus: !1 }),
          n.includes('hoy')
              ? tn()
              : n.includes('siguiente')
                ? nn()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  an(),
          oa('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await ca({ showSuccessToast: !0 }), !0)
          : (C(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function da(e) {
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
        Zn(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const i = document.getElementById(e);
    switch ((i && i.classList.add('active'), e)) {
        case 'dashboard':
        default:
            K();
            break;
        case 'appointments':
            mt();
            break;
        case 'callbacks':
            (de(),
                he(),
                ve({
                    filter: ie().filterSelect?.value || Z.filter,
                    sort: ie().sortSelect?.value || Z.sort,
                    search: ie().searchInput?.value || Z.search,
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
                                  `\n            <div class="review-card-admin">\n                <div class="review-header-admin">\n                    <strong>${E(e.name || 'Paciente')}</strong>\n                    ${e.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}\n                </div>\n                <div class="review-rating">${'★'.repeat(Number(e.rating) || 0)}${'☆'.repeat(5 - (Number(e.rating) || 0))}</div>\n                <p>${E(e.text || '')}</p>\n                <small>${E(new Date(e.date).toLocaleDateString('es-EC'))}</small>\n            </div>\n        `
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
                            const e = await S('availability', {
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
                                (p(Bt(t)),
                                f(r),
                                $t(a),
                                (vt = 'google' === String(r.source || '')),
                                Yt(),
                                Zt(),
                                ht && !Dt(ht))
                            )
                                return ((ht = null), Nt(''), void Qt());
                            ht ? sn(ht) : Qt();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                C(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (vt = 'google' === String(o.source || '')),
                                Yt(),
                                Zt());
                        }
                    })(),
                    !ht)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(Ct);
                            return Dt(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    Dt(e) && (ht = e);
                }
                (ht && !Dt(ht) && (ht = null),
                    ht && Ot(ht),
                    Xt(),
                    ht ? rn(ht, { persist: !1 }) : Qt());
            })();
            break;
        case 'queue':
            (Ln(), In({ silent: !0 }));
    }
}
async function ua() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = Rn();
    (Kn(n),
        Wn(n),
        Gn(),
        aa(),
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
                (await H(), Yn());
            } catch (e) {
                C(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = Fn();
            await da(t);
        })(),
        await (async function () {
            if (Ee) return;
            Ee = !0;
            const { subscribeBtn: e, testBtn: t } = $e();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return (Le(!1), void Ce('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await Ae(),
                        Le(!0),
                        Ce('disponible', 'muted'),
                        e.addEventListener('click', De),
                        t.addEventListener('click', Ne),
                        await Te());
                } catch (e) {
                    (Le(!1), Ce('sin configurar', 'warn'));
                }
            }
        })());
}
async function ma(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return k('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && v(t.csrfToken),
                C('Bienvenido al panel de administración', 'success'),
                await ua());
        } catch {
            C('Código incorrecto o sesión expirada', 'error');
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
                void C('Ingresa tu código 2FA', 'info')
            );
        }
        (e.csrfToken && v(e.csrfToken),
            C('Bienvenido al panel de administración', 'success'),
            await ua());
    } catch {
        C('Contraseña incorrecta', 'error');
    }
}
function pa() {
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
                            await k('logout', { method: 'POST' });
                        } catch (e) {}
                        (C('Sesion cerrada correctamente', 'info'),
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
                                queue_tickets: s,
                                availability: a,
                                exportDate: new Date().toISOString(),
                            },
                            i = new Blob([JSON.stringify(o, null, 2)], {
                                type: 'application/json',
                            }),
                            r = URL.createObjectURL(i),
                            c = document.createElement('a');
                        ((c.href = r),
                            (c.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`),
                            document.body.appendChild(c),
                            c.click(),
                            document.body.removeChild(c),
                            URL.revokeObjectURL(r),
                            C('Datos exportados correctamente', 'success'));
                    })()
                );
            if ('open-import-file' === r)
                return (
                    o.preventDefault(),
                    void document.getElementById('importFileInput')?.click()
                );
            if ('set-admin-theme' === r)
                return (
                    o.preventDefault(),
                    void Ve(i.dataset.themeMode || 'system', {
                        persist: !0,
                        animate: !0,
                    })
                );
            if ('toggle-sidebar-collapse' === r)
                return (
                    o.preventDefault(),
                    jn() ? void na(!On()) : void Vn(!Un())
                );
            if ('run-admin-command' === r) {
                o.preventDefault();
                const e = document.getElementById('adminQuickCommand');
                return void (await la(
                    e instanceof HTMLInputElement ? e.value : ''
                ));
            }
            if ('refresh-admin-data' === r)
                return (
                    o.preventDefault(),
                    void (await ca({ showSuccessToast: !0 }))
                );
            if ('context-open-dashboard' === r)
                return (o.preventDefault(), void (await ia('dashboard')));
            if ('context-open-appointments-today' === r)
                return (o.preventDefault(), void (await ra('today')));
            if ('context-open-appointments-transfer' === r)
                return (
                    o.preventDefault(),
                    void (await ra('pending_transfer'))
                );
            if ('context-open-callbacks-pending' === r)
                return (o.preventDefault(), void (await sa('pending')));
            if ('context-open-callbacks-next' === r)
                return (o.preventDefault(), await sa('pending'), void ke());
            if ('queue-refresh-state' === r)
                return (o.preventDefault(), void (await In({ silent: !1 })));
            if ('queue-call-next' === r)
                return (
                    o.preventDefault(),
                    void (await An(Number(i.dataset.queueConsultorio || 0)))
                );
            if ('context-focus-slot-input' === r)
                return (
                    o.preventDefault(),
                    await ia('availability', { focus: !1 }),
                    void an()
                );
            if ('context-availability-today' === r)
                return (
                    o.preventDefault(),
                    await ia('availability', { focus: !1 }),
                    void tn()
                );
            if ('context-availability-next' === r)
                return (
                    o.preventDefault(),
                    await ia('availability', { focus: !1 }),
                    void nn()
                );
            if ('context-copy-availability-day' === r)
                return (
                    o.preventDefault(),
                    await ia('availability', { focus: !1 }),
                    void pn()
                );
            try {
                if ('export-csv' === r) return (o.preventDefault(), void bt());
                if ('appointment-quick-filter' === r)
                    return (
                        o.preventDefault(),
                        void pt(i.dataset.filterValue || 'all')
                    );
                if ('callback-quick-filter' === r)
                    return (
                        o.preventDefault(),
                        void we(i.dataset.filterValue || 'all')
                    );
                if ('callbacks-triage-next' === r)
                    return (o.preventDefault(), await sa('pending'), void ke());
                if ('clear-appointment-filters' === r)
                    return (o.preventDefault(), void ft());
                if ('clear-callback-filters' === r)
                    return (
                        o.preventDefault(),
                        void ve(
                            { filter: W, sort: J, search: '' },
                            { preserveSearch: !1 }
                        )
                    );
                if ('appointment-density' === r)
                    return (
                        o.preventDefault(),
                        void (function (e) {
                            const t = rt(e);
                            (ct(t),
                                st(Je, t),
                                Boolean(
                                    document.getElementById(
                                        'appointmentsTableBody'
                                    )
                                ) && ut());
                        })(i.dataset.density || 'comfortable')
                    );
                if ('change-month' === r)
                    return (
                        o.preventDefault(),
                        void en(Number(i.dataset.delta || 0))
                    );
                if ('availability-today' === r)
                    return (o.preventDefault(), void tn());
                if ('availability-next-with-slots' === r)
                    return (o.preventDefault(), void nn());
                if ('prefill-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (function (e) {
                            if (vt)
                                return void C(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const t = document.getElementById('newSlotTime');
                            t instanceof HTMLInputElement &&
                                ((t.value = String(e || '').trim()), t.focus());
                        })(i.dataset.time || '')
                    );
                if ('copy-availability-day' === r)
                    return (o.preventDefault(), void pn());
                if ('paste-availability-day' === r)
                    return (o.preventDefault(), void (await fn()));
                if ('duplicate-availability-day-next' === r)
                    return (o.preventDefault(), void (await gn()));
                if ('duplicate-availability-next-week' === r)
                    return (o.preventDefault(), void (await bn()));
                if ('clear-availability-day' === r)
                    return (o.preventDefault(), void (await hn()));
                if ('clear-availability-week' === r)
                    return (o.preventDefault(), void (await yn()));
                if ('save-availability-draft' === r)
                    return (o.preventDefault(), void (await dn()));
                if ('discard-availability-draft' === r)
                    return (o.preventDefault(), void un());
                if ('add-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function () {
                            if (vt)
                                return void C(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            if (!ht)
                                return void C(
                                    'Selecciona una fecha primero',
                                    'warning'
                                );
                            const e = document.getElementById('newSlotTime');
                            if (!(e instanceof HTMLInputElement)) return;
                            const t = String(e.value || '').trim();
                            if (!t)
                                return void C('Ingresa un horario', 'warning');
                            const n = qt(a[ht] || []);
                            n.includes(t)
                                ? C('Este horario ya existe', 'warning')
                                : (ln(() => {
                                      Rt(ht, [...n, t]);
                                  }),
                                  (e.value = ''),
                                  C(
                                      'Horario agregado a cambios pendientes',
                                      'success'
                                  ));
                        })())
                    );
                if ('remove-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e, t) {
                            if (vt)
                                return void C(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const n = String(e || '').trim(),
                                o = String(t || '').trim();
                            if (!Dt(n) || !o)
                                return void C(
                                    'No se pudo identificar el horario a eliminar',
                                    'warning'
                                );
                            const i = qt(a[n] || []),
                                r = i.filter((e) => e !== o);
                            r.length !== i.length
                                ? (ln(() => {
                                      Rt(n, r);
                                  }),
                                  C(
                                      'Horario eliminado de cambios pendientes',
                                      'success'
                                  ))
                                : C(
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
                                        (await S('appointments', {
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
                                            C(
                                                'Transferencia aprobada',
                                                'success'
                                            ));
                                    } catch (e) {
                                        C(
                                            `No se pudo aprobar: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else C('Id de cita invalido', 'error');
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
                                        (await S('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'failed',
                                            },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            C(
                                                'Transferencia rechazada',
                                                'warning'
                                            ));
                                    } catch (e) {
                                        C(
                                            `No se pudo rechazar: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else C('Id de cita invalido', 'error');
                        })(Number(i.dataset.id || 0)))
                    );
                if ('cancel-appointment' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e) {
                            if (confirm('¿Estas seguro de cancelar esta cita?'))
                                if (e)
                                    try {
                                        (await S('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                status: 'cancelled',
                                            },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            C(
                                                'Cita cancelada correctamente',
                                                'success'
                                            ));
                                    } catch (e) {
                                        C(
                                            `No se pudo cancelar la cita: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else C('Id de cita invalido', 'error');
                        })(Number(i.dataset.id || 0)))
                    );
                if ('mark-no-show' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e) {
                            if (confirm('Marcar esta cita como "No asistio"?'))
                                if (e)
                                    try {
                                        (await S('appointments', {
                                            method: 'PATCH',
                                            body: { id: e, status: 'no_show' },
                                        }),
                                            await H(),
                                            mt(),
                                            K(),
                                            C(
                                                'Cita marcada como no asistio',
                                                'success'
                                            ));
                                    } catch (e) {
                                        C(
                                            `No se pudo marcar no-show: ${e.message}`,
                                            'error'
                                        );
                                    }
                                else C('Id de cita invalido', 'error');
                        })(Number(i.dataset.id || 0)))
                    );
                if ('mark-contacted' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e, n = '') {
                            let a = null;
                            const o = Number(e);
                            o > 0 && (a = t.find((e) => Number(e.id) === o));
                            const i = n ? decodeURIComponent(n) : '';
                            if (
                                (!a && i && (a = t.find((e) => e.fecha === i)),
                                a)
                            )
                                try {
                                    ne.delete(ce(a));
                                    const e = a.id || Date.now();
                                    (a.id || (a.id = e),
                                        await S('callbacks', {
                                            method: 'PATCH',
                                            body: {
                                                id: Number(e),
                                                status: 'contactado',
                                            },
                                        }),
                                        await H(),
                                        ve({
                                            filter: Z.filter,
                                            sort: Z.sort,
                                            search: Z.search,
                                        }),
                                        K(),
                                        C(
                                            'Marcado como contactado',
                                            'success'
                                        ));
                                } catch (e) {
                                    C(
                                        `No se pudo actualizar callback: ${e.message}`,
                                        'error'
                                    );
                                }
                            else C('Callback no encontrado', 'error');
                        })(
                            Number(i.dataset.callbackId || 0),
                            i.dataset.callbackDate || ''
                        ))
                    );
                if ('queue-ticket-action' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e, t, n = null) {
                            const a = Number(e || 0);
                            if (!a || !t)
                                return void C(
                                    'Accion de ticket invalida',
                                    'error'
                                );
                            const o = { id: a, action: t },
                                i = Number(n || 0);
                            [1, 2].includes(i) && (o.consultorio = i);
                            try {
                                const e = await S('queue-ticket', {
                                        method: 'PATCH',
                                        body: o,
                                    }),
                                    n = e?.data?.ticket || null;
                                (Cn(n),
                                    y(En(e?.data?.queueState || {})),
                                    Ln(),
                                    C(
                                        (function (e, t = '') {
                                            const n = t ? `${t} ` : '';
                                            switch (
                                                String(e || '').toLowerCase()
                                            ) {
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
                                        })(t, n?.ticketCode || ''),
                                        'success'
                                    ));
                            } catch (e) {
                                if ($n(e))
                                    return (
                                        await In({ silent: !0 }),
                                        void C(Bn(e), 'warning')
                                    );
                                C(
                                    `No se pudo actualizar ticket: ${Bn(e)}`,
                                    'error'
                                );
                            }
                        })(
                            Number(i.dataset.queueId || 0),
                            i.dataset.queueAction || '',
                            Number(i.dataset.queueConsultorio || 0)
                        ))
                    );
                if ('queue-reprint-ticket' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e) {
                            const t = Number(e || 0);
                            if (t)
                                try {
                                    const e = await S('queue-reprint', {
                                        method: 'POST',
                                        body: { id: t },
                                    });
                                    e?.printed
                                        ? C('Ticket reimpreso', 'success')
                                        : C(
                                              `Ticket generado sin impresion: ${e?.print?.message || 'sin detalle'}`,
                                              'warning'
                                          );
                                } catch (e) {
                                    C(
                                        `No se pudo reimprimir ticket: ${e.message}`,
                                        'error'
                                    );
                                }
                            else C('Ticket invalido para reimpresion', 'error');
                        })(Number(i.dataset.queueId || 0)))
                    );
            } catch (e) {
                C(`Error ejecutando accion: ${e.message}`, 'error');
            }
        } else i.closest('.toast')?.remove();
    });
    const o = document.getElementById('appointmentFilter');
    o &&
        o.addEventListener('change', () => {
            ut();
        });
    const i = document.getElementById('searchAppointments');
    i &&
        i.addEventListener('input', () => {
            ut();
        });
    const r = document.getElementById('appointmentSort');
    r &&
        r.addEventListener('change', () => {
            !(function (e) {
                const t = it(e),
                    { sortSelect: n } = at();
                (n && (n.value = t), st(We, t), ut());
            })(r.value || 'datetime_desc');
        });
    const c = document.getElementById('callbackFilter');
    c && c.addEventListener('change', ye);
    const l = document.getElementById('searchCallbacks');
    l && l.addEventListener('input', Se);
    const d = document.getElementById('adminQuickCommand');
    d instanceof HTMLInputElement &&
        d.addEventListener('keydown', async (e) => {
            'Enter' === e.key && (e.preventDefault(), await la(d.value));
        });
}
document.addEventListener('DOMContentLoaded', async () => {
    ((qe = Oe()),
        Ve(qe, { persist: !1, animate: !1 }),
        (function () {
            if (He) return;
            const e = Fe();
            e &&
                ('function' == typeof e.addEventListener
                    ? (e.addEventListener('change', Ge), (He = !0))
                    : 'function' == typeof e.addListener &&
                      (e.addListener(Ge), (He = !0)));
        })(),
        Pe ||
            'function' != typeof window.addEventListener ||
            (window.addEventListener('storage', Ke), (Pe = !0)),
        pa(),
        (function () {
            const e = { sort: it(q(We, Ye)), density: rt(q(Je, Qe)) },
                { sortSelect: t } = at();
            (t && (t.value = e.sort), ct(e.density));
        })(),
        _n ||
            (_n = window.setInterval(() => {
                Jn();
            }, 3e4)),
        Jn(),
        Zn(Rn()),
        Gn());
    const e = document.getElementById('loginForm');
    (e && e.addEventListener('submit', ma),
        Hn().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await ia(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                jn() ? na(!On()) : Vn(!Un());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => aa({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => aa({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            (!(function (e) {
                if ('Tab' !== e.key) return;
                if (!jn() || !On()) return;
                const t = document.getElementById('adminSidebar');
                if (!t) return;
                const n = ea();
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
                              return (e.preventDefault(), void Qn());
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
                                      const e = ie().searchInput;
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
                              return (e.preventDefault(), void Qn());
                          if (!e.altKey || !e.shiftKey) return;
                          if (n) return;
                          if ('keyr' === i)
                              return (
                                  e.preventDefault(),
                                  void ca({ showSuccessToast: !0 })
                              );
                          if ('m' === o || 'keym' === i)
                              return (
                                  e.preventDefault(),
                                  jn() ? void na(!On()) : void Vn(!Un())
                              );
                          if (on()) {
                              if ('ArrowLeft' === e.key)
                                  return (e.preventDefault(), void en(-1));
                              if ('ArrowRight' === e.key)
                                  return (e.preventDefault(), void en(1));
                              if ('keyy' === i)
                                  return (e.preventDefault(), void tn());
                              if ('keys' === i)
                                  return (e.preventDefault(), void nn());
                              if ('keyd' === i)
                                  return (e.preventDefault(), void gn());
                              if ('keyw' === i)
                                  return (e.preventDefault(), void bn());
                              if ('keyv' === i)
                                  return (e.preventDefault(), void fn());
                              if ('keyx' === i)
                                  return (e.preventDefault(), void hn());
                              if ('keyq' === i)
                                  return (e.preventDefault(), void yn());
                              if ('keyg' === i)
                                  return (e.preventDefault(), void dn());
                              if ('keyz' === i)
                                  return (e.preventDefault(), void un());
                          }
                          const r =
                              {
                                  keya: 'all',
                                  keyh: 'today',
                                  keyt: 'pending_transfer',
                                  keyn: 'no_show',
                              }[i] || null;
                          if (r) return (e.preventDefault(), void ra(r));
                          const s =
                              { keyp: 'pending', keyc: 'contacted' }[i] || null;
                          if (s) return (e.preventDefault(), void sa(s));
                          const c = Tn.get(i) || Tn.get(o);
                          c && (e.preventDefault(), ia(c));
                      })(e)
                    : aa({ restoreFocus: !0 }));
        }),
        window.addEventListener('resize', () => {
            (jn() || aa(), Gn(), ta(On()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await ia(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return Pn(
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
                        (await S('import', { method: 'POST', body: a }),
                            await H(),
                            Yn());
                        const o = document.querySelector('.nav-item.active');
                        (await da(o?.dataset.section || 'dashboard'),
                            C(
                                `Datos importados: ${a.appointments.length} citas`,
                                'success'
                            ));
                    } catch (e) {
                        C(`Error al importar: ${e.message}`, 'error');
                    }
            })(t)
        ),
        window.addEventListener('online', async () => {
            (await ca({ showSuccessToast: !1, showErrorToast: !1 }))
                ? C('Conexion restaurada. Datos actualizados.', 'success')
                : C(
                      'Conexion restaurada, pero no se pudieron refrescar datos.',
                      'warning'
                  );
        }),
        ta(!1),
        zn(Un()),
        await (async function () {
            if (!navigator.onLine && q('appointments', null))
                return (
                    C('Modo offline: mostrando datos locales', 'info'),
                    void (await ua())
                );
            (await (async function () {
                try {
                    const e = await k('status');
                    return (
                        !!e.authenticated && (e.csrfToken && v(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (C('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await ua()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (aa(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })());
});
