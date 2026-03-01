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
function p(e) {
    a = e || {};
}
function f(e) {
    i = e || {};
}
function g(e) {
    o = e;
}
function b(e) {
    r = e || null;
}
function y(e) {
    s = Array.isArray(e) ? e : [];
}
function h(e) {
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
async function k(e, t = {}) {
    return S(
        (function (e) {
            const t = new URLSearchParams();
            return (t.set('resource', e), `/api.php?${t.toString()}`);
        })(e),
        t
    );
}
async function w(e, t = {}) {
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
function q(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function _(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function A(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0 ? 0 : t;
}
function L(e) {
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
function T(e) {
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
            no_show: 'No asistió',
            noshow: 'No asistió',
        }[e] || e
    );
}
function M(e) {
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
function B(e) {
    return (
        {
            ahora: 'Lo antes posible',
            '15min': 'En 15 minutos',
            '30min': 'En 30 minutos',
            '1hora': 'En 1 hora',
        }[e] || e
    );
}
function N(e) {
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
function x(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function H(e, t) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return [];
    for (const n of t) if (n && Array.isArray(e[n])) return e[n];
    return [];
}
function F(e, t) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return null;
    for (const n of t) {
        if (!n) continue;
        const t = e[n];
        if (t && 'object' == typeof t && !Array.isArray(t)) return t;
    }
    return null;
}
function P(e, t, n = 0) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return Number(n || 0);
    for (const n of t) {
        if (!n) continue;
        const t = Number(e[n]);
        if (Number.isFinite(t)) return t;
    }
    return Number(n || 0);
}
async function R() {
    try {
        const [e, t] = await Promise.all([
                k('data'),
                k('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (u(a), x('appointments', a));
        const i = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: N(e.status) }))
            : [];
        (d(i), x('callbacks', i));
        const o = Array.isArray(n.reviews) ? n.reviews : [];
        (m(o), x('reviews', o));
        const r =
            n.availability && 'object' == typeof n.availability
                ? n.availability
                : {};
        (p(r), x('availability', r));
        const s =
            n.availabilityMeta && 'object' == typeof n.availabilityMeta
                ? n.availabilityMeta
                : {
                      source: 'store',
                      mode: 'live',
                      generatedAt: new Date().toISOString(),
                  };
        (f(s), x('availability-meta', s));
        const c =
                n.queueState && 'object' == typeof n.queueState
                    ? n.queueState
                    : n.queue_state && 'object' == typeof n.queue_state
                      ? n.queue_state
                      : null,
            l =
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : n.queue_meta && 'object' == typeof n.queue_meta
                      ? n.queue_meta
                      : c,
            v = Array.isArray(n.queue_tickets)
                ? n.queue_tickets
                : Array.isArray(n.queueTickets)
                  ? n.queueTickets
                  : (function (e) {
                        if (!e || 'object' != typeof e) return [];
                        const t = e,
                            n =
                                String(
                                    t.updatedAt || t.updated_at || ''
                                ).trim() || new Date().toISOString();
                        let a = H(t, [
                            'callingNow',
                            'calling_now',
                            'calledTickets',
                            'called_tickets',
                        ]);
                        if (0 === a.length) {
                            const e = F(t, [
                                'callingNowByConsultorio',
                                'calling_now_by_consultorio',
                            ]);
                            e && (a = Object.values(e).filter(Boolean));
                        }
                        const i = H(t, [
                                'queue_tickets',
                                'queueTickets',
                                'tickets',
                            ]),
                            o = H(t, [
                                'waitingTickets',
                                'waiting_tickets',
                                'nextTickets',
                                'next_tickets',
                            ]),
                            r = new Map();
                        let s = 1;
                        const c = (e, t) => {
                            if (!e || 'object' != typeof e) return;
                            const a = Number(e.id || e.ticket_id || 0),
                                i = String(
                                    e.ticketCode || e.ticket_code || ''
                                ).trim(),
                                o = a
                                    ? `id:${a}`
                                    : i
                                      ? `code:${i}`
                                      : 'tmp:' + s++,
                                c = r.get(o) || {},
                                l = String(
                                    t || e.status || c.status || 'waiting'
                                ).toLowerCase(),
                                u = Number(
                                    e.assignedConsultorio ??
                                        e.assigned_consultorio ??
                                        c.assignedConsultorio ??
                                        0
                                );
                            r.set(o, {
                                id: a || Number(c.id || 0) || s++,
                                ticketCode: i || c.ticketCode || '--',
                                queueType: String(
                                    e.queueType ||
                                        e.queue_type ||
                                        c.queueType ||
                                        'walk_in'
                                ),
                                priorityClass: String(
                                    e.priorityClass ||
                                        e.priority_class ||
                                        c.priorityClass ||
                                        'walk_in'
                                ),
                                status: l,
                                assignedConsultorio:
                                    1 === u || 2 === u ? u : null,
                                patientInitials: String(
                                    e.patientInitials ||
                                        e.patient_initials ||
                                        c.patientInitials ||
                                        '--'
                                ),
                                phoneLast4: String(
                                    e.phoneLast4 ||
                                        e.phone_last4 ||
                                        c.phoneLast4 ||
                                        ''
                                ),
                                createdAt: String(
                                    e.createdAt ||
                                        e.created_at ||
                                        c.createdAt ||
                                        n
                                ),
                                calledAt:
                                    'called' === l
                                        ? String(
                                              e.calledAt ||
                                                  e.called_at ||
                                                  c.calledAt ||
                                                  n
                                          )
                                        : '',
                                completedAt: String(
                                    e.completedAt ||
                                        e.completed_at ||
                                        c.completedAt ||
                                        ''
                                ),
                            });
                        };
                        for (const e of i) c(e, String(e?.status || 'waiting'));
                        for (const e of o) c(e, 'waiting');
                        for (const e of a) c(e, 'called');
                        return Array.from(r.values());
                    })(c || l);
        (y(v), x('queue-tickets', v));
        const S = (function (e) {
            if (!e || 'object' != typeof e) return null;
            const t = e,
                n = F(t, ['counts']) || {};
            let a = H(t, [
                'callingNow',
                'calling_now',
                'calledTickets',
                'called_tickets',
            ]);
            if (0 === a.length) {
                const e = F(t, [
                    'callingNowByConsultorio',
                    'calling_now_by_consultorio',
                ]);
                e && (a = Object.values(e).filter(Boolean));
            }
            const i = H(t, [
                    'nextTickets',
                    'next_tickets',
                    'waitingTickets',
                    'waiting_tickets',
                ]),
                o = P(t, ['waitingCount', 'waiting_count'], Number.NaN),
                r = P(t, ['calledCount', 'called_count'], Number.NaN),
                s = Number.isFinite(o)
                    ? o
                    : P(n, ['waiting', 'waiting_count'], i.length),
                c = Number.isFinite(r)
                    ? r
                    : P(n, ['called', 'called_count'], a.length),
                l = { 1: null, 2: null };
            for (const e of a) {
                const t = Number(
                    e?.assignedConsultorio ?? e?.assigned_consultorio ?? 0
                );
                (1 !== t && 2 !== t) ||
                    (l[String(t)] = {
                        ...e,
                        id: Number(e?.id || e?.ticket_id || 0) || 0,
                        ticketCode: String(
                            e?.ticketCode || e?.ticket_code || '--'
                        ),
                        patientInitials: String(
                            e?.patientInitials || e?.patient_initials || '--'
                        ),
                        assignedConsultorio: t,
                        calledAt: String(e?.calledAt || e?.called_at || ''),
                    });
            }
            return {
                updatedAt:
                    String(t.updatedAt || t.updated_at || '').trim() ||
                    new Date().toISOString(),
                waitingCount: Math.max(0, Number(s || 0)),
                calledCount: Math.max(0, Number(c || 0)),
                counts: n,
                callingNowByConsultorio: l,
                nextTickets: Array.isArray(i)
                    ? i.map((e, t) => ({
                          ...e,
                          id: Number(e?.id || e?.ticket_id || 0) || 0,
                          ticketCode: String(
                              e?.ticketCode || e?.ticket_code || '--'
                          ),
                          patientInitials: String(
                              e?.patientInitials || e?.patient_initials || '--'
                          ),
                          queueType: String(
                              e?.queueType || e?.queue_type || 'walk_in'
                          ),
                          priorityClass: String(
                              e?.priorityClass || e?.priority_class || 'walk_in'
                          ),
                          position:
                              Number(e?.position || 0) > 0
                                  ? Number(e.position)
                                  : t + 1,
                      }))
                    : [],
            };
        })(l);
        if (
            (h(S),
            x('queue-meta', S),
            n.funnelMetrics && 'object' == typeof n.funnelMetrics)
        )
            g(n.funnelMetrics);
        else {
            const e = await k('funnel-metrics').catch(() => null);
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
        (u(D('appointments', [])),
            d(D('callbacks', []).map((e) => ({ ...e, status: N(e.status) }))),
            m(D('reviews', [])),
            p(D('availability', {})),
            f(D('availability-meta', {})),
            y(D('queue-tickets', [])),
            h(D('queue-meta', null)),
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
            b(D('health-status', null)),
            E(
                'No se pudo conectar al backend. Usando datos locales.',
                'warning'
            ));
    }
}
function j(e) {
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
function O(e) {
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
function z(e) {
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
function U(e) {
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
function V(e) {
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
function K(e) {
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
function W(e, t, n, a) {
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
            const t = r > 0 ? q((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${C(n(e.label))}</span>\n                <span class="funnel-row-count">${C(_(e.count))} (${C(t)})</span>\n            </div>\n        `;
        })
        .join('');
}
function G(e, t, n = 'muted') {
    e &&
        ((e.className = 'toolbar-chip'),
        'accent' === n
            ? e.classList.add('is-accent')
            : 'warning' === n && e.classList.add('is-warning'),
        (e.textContent = t));
}
function J(e) {
    return `\n        <div class="operations-action-item">\n            <span class="operations-action-icon">\n                <i class="fas ${C(e.icon)}" aria-hidden="true"></i>\n            </span>\n            <div class="operations-action-copy">\n                <span class="operations-action-title">${C(e.title)}</span>\n                <span class="operations-action-meta">${C(e.meta)}</span>\n            </div>\n            <button type="button" class="btn btn-secondary btn-sm" data-action="${C(e.action)}">\n                ${C(e.cta)}\n            </button>\n        </div>\n    `;
}
function Q() {
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
    u && (u.textContent = _(l));
    const d = [];
    for (const e of t) 'pendiente' === N(e.status) && d.push(e);
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
    const p = document.getElementById('todayAppointmentsList');
    0 === i.length
        ? (p.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (p.innerHTML = i
              .map(
                  (e) =>
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-time">\n                    <span class="time">${C(e.time)}</span>\n                </div>\n                <div class="upcoming-info">\n                    <span class="name">${C(e.name)}</span>\n                    <span class="service">${C(L(e.service))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${C(e.phone)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${C(String(e.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
                      `\n            <div class="upcoming-item">\n                <div class="upcoming-info">\n                    <span class="name">${C(e.telefono)}</span>\n                    <span class="service">${C(B(e.preferencia))}</span>\n                </div>\n                <div class="upcoming-actions">\n                    <a href="tel:${C(e.telefono)}" class="btn-icon" title="Llamar">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                </div>\n            </div>\n        `
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
            ((o.textContent = _(e)),
                (r.textContent = _(t)),
                (s.textContent = _(n)));
            const d = 3 * e + 2 * t + Math.max(0, n - 6) + i;
            (d >= 9
                ? G(c, 'Cola: prioridad alta', 'warning')
                : d >= 4
                  ? G(c, 'Cola: atención recomendada', 'accent')
                  : G(c, 'Cola: estable', 'muted'),
                a <= 0
                    ? G(l, 'Agenda: sin citas confirmadas', 'warning')
                    : n >= 6
                      ? G(l, 'Agenda: demanda alta hoy', 'accent')
                      : G(l, 'Agenda: operación normal', 'muted'));
            const m = [];
            (e > 0 &&
                m.push({
                    icon: 'fa-money-check-dollar',
                    title: 'Transferencias pendientes',
                    meta: `${_(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${_(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${_(n)} cita(s) activas para seguimiento inmediato`,
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
                (u.innerHTML = m.map(J).join('')));
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
            u && (u.textContent = _(n));
            const d = document.getElementById('funnelStartCheckout');
            d && (d.textContent = _(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = _(i));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = q(l));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = q(c));
            const g = A(e.events && e.events.booking_error),
                b = A(e.events && e.events.checkout_error),
                y = a > 0 ? ((g + b) / a) * 100 : 0,
                h = document.getElementById('bookingErrorRate');
            h && (h.textContent = q(y));
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
                (W(
                    'funnelAbandonList',
                    e.checkoutAbandonByStep,
                    j,
                    'Sin datos de abandono'
                ),
                W(
                    'funnelEntryList',
                    e.checkoutEntryBreakdown,
                    O,
                    'Sin datos de entrada'
                ),
                W(
                    'funnelPaymentMethodList',
                    e.paymentMethodBreakdown,
                    z,
                    'Sin datos de pago'
                ),
                W(
                    'funnelSourceList',
                    e.eventSourceBreakdown,
                    U,
                    'Sin datos de origen'
                ),
                W(
                    'funnelAbandonReasonList',
                    e.checkoutAbandonByReason,
                    V,
                    'Sin datos de motivo'
                ),
                W(
                    'funnelStepList',
                    e.bookingStepBreakdown,
                    j,
                    'Sin datos de pasos'
                ),
                W(
                    'funnelErrorCodeList',
                    e.errorCodeBreakdown,
                    K,
                    'Sin datos de error'
                ));
        })());
}
const Y = 'all',
    X = 'recent_desc',
    Z = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    ee = new Set(['recent_desc', 'waiting_desc']),
    te = { filter: Y, search: '', sort: X },
    ne = {
        all: 'Todos',
        pending: 'Pendientes',
        contacted: 'Contactados',
        today: 'Hoy',
        sla_urgent: 'Urgentes SLA',
    },
    ae = { recent_desc: 'Más recientes', waiting_desc: 'Mayor espera (SLA)' };
let ie = [];
const oe = new Set();
let re = !1,
    se = !1;
function ce() {
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
function le(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return Z.has(t) ? t : Y;
}
function ue(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return ee.has(t) ? t : X;
}
function de(e) {
    const t = Number(e?.id || 0);
    return t > 0
        ? `id:${t}`
        : `fallback:${String(e?.fecha || '').trim()}|${String(e?.telefono || '').trim()}|${String(e?.preferencia || '').trim()}`;
}
function me(e) {
    return 'pendiente' === N(e?.status);
}
function pe() {
    return (
        !!re ||
        ((re = (function () {
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
                    Object.entries(ae).forEach(([e, t]) => {
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
                    Object.entries(ae).forEach(([e, t]) => {
                        const n = document.createElement('option');
                        ((n.value = e), (n.textContent = t), a.appendChild(n));
                    }),
                    (a.value = te.sort),
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
        re)
    );
}
function fe(e) {
    const t = ce(),
        n = e.filter((e) => me(e)).length,
        a = e.filter((e) => me(e) && oe.has(de(e))).length,
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
function ge(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function be(e) {
    if (!e) return null;
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? null : t;
}
function ye(e) {
    const t = be(e);
    if (!t) return 0;
    const n = Date.now() - t.getTime();
    return Number.isFinite(n) ? Math.max(0, Math.round(n / 6e4)) : 0;
}
function he(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t <= 0) return 'recién';
    if (t < 60) return `${t} min`;
    const n = Math.floor(t / 60),
        a = t % 60;
    return 0 === a ? `${n} h` : `${n} h ${a} min`;
}
function ve(e, t = X) {
    const n = [...e];
    return 'waiting_desc' === ue(t)
        ? n.sort((e, t) => {
              const n = me(e),
                  a = me(t);
              if (n !== a) return n ? -1 : 1;
              const i = n ? ye(e.fecha) : 0,
                  o = a ? ye(t.fecha) : 0;
              if (o !== i) return o - i;
              const r = be(e.fecha),
                  s = be(t.fecha);
              return (r ? r.getTime() : 0) - (s ? s.getTime() : 0);
          })
        : n.sort((e, t) => {
              const n = be(e.fecha),
                  a = be(t.fecha),
                  i = n ? n.getTime() : 0;
              return (a ? a.getTime() : 0) - i;
          });
}
function Se() {
    if (se) return;
    const e = document.getElementById('callbacksGrid');
    if (!e) return;
    const n = ce();
    (n.sortSelect instanceof HTMLSelectElement &&
        n.sortSelect.addEventListener('change', () => {
            we({
                filter: te.filter,
                search: te.search,
                sort: n.sortSelect.value || X,
            });
        }),
        n.selectVisibleBtn instanceof HTMLButtonElement &&
            n.selectVisibleBtn.addEventListener('click', () => {
                !(function () {
                    const e = ie.filter((e) => me(e));
                    0 !== e.length
                        ? (e.forEach((e) => {
                              oe.add(de(e));
                          }),
                          we({
                              filter: te.filter,
                              search: te.search,
                              sort: te.sort,
                          }))
                        : E(
                              'No hay callbacks pendientes visibles para seleccionar.',
                              'info'
                          );
                })();
            }),
        n.clearSelectionBtn instanceof HTMLButtonElement &&
            n.clearSelectionBtn.addEventListener('click', () => {
                (oe.clear(),
                    fe(ie),
                    we({
                        filter: te.filter,
                        search: te.search,
                        sort: te.sort,
                    }));
            }),
        n.markSelectedBtn instanceof HTMLButtonElement &&
            n.markSelectedBtn.addEventListener('click', () => {
                !(async function () {
                    const e =
                        0 === oe.size
                            ? []
                            : t.filter((e) => me(e) && oe.has(de(e)));
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
                                await k('callbacks', {
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
                        : (await R(),
                          oe.clear(),
                          we({
                              filter: te.filter,
                              sort: te.sort,
                              search: te.search,
                          }),
                          Q(),
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
                    n && (t ? oe.add(n) : oe.delete(n), fe(ie));
                })(t.dataset.callbackSelectKey || '', t.checked);
        }),
        (se = !0));
}
function ke() {
    we({
        filter: ce().filterSelect?.value || Y,
        sort: ce().sortSelect?.value || te.sort,
    });
}
function we(e, { preserveSearch: n = !0 } = {}) {
    (pe(), Se());
    const a = ce(),
        i = a.searchInput?.value ?? te.search,
        o = a.sortSelect?.value ?? te.sort,
        r = n ? (e.search ?? i) : (e.search ?? ''),
        s = (function (e) {
            const n = {
                    filter: le(e.filter),
                    search: String(e.search || '')
                        .trim()
                        .toLowerCase(),
                    sort: ue(e.sort),
                },
                a = ge(new Date());
            return {
                filtered: ve(
                    t.filter((e) => {
                        const t = N(e.status),
                            i = be(e.fecha),
                            o = i ? ge(i) : '';
                        return (
                            ('pending' !== n.filter || 'pendiente' === t) &&
                            ('contacted' !== n.filter || 'contactado' === t) &&
                            ('today' !== n.filter || o === a) &&
                            !(
                                'sla_urgent' === n.filter &&
                                (!me(e) || ye(e.fecha) < 120)
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
            filter: e.filter ?? a.filterSelect?.value ?? te.filter,
            sort: e.sort ?? o,
            search: r,
        });
    ((te.filter = s.criteria.filter),
        (te.sort = s.criteria.sort),
        (te.search = s.criteria.search),
        (ie = s.filtered),
        (function (e) {
            const t = new Set(e.filter((e) => me(e)).map((e) => de(e)));
            Array.from(oe).forEach((e) => {
                t.has(e) || oe.delete(e);
            });
        })(s.filtered),
        (function (e) {
            (pe(), Se());
            const t = document.getElementById('callbacksGrid');
            t &&
                (0 !== e.length
                    ? (t.innerHTML = e
                          .map((e) => {
                              const t = N(e.status),
                                  n = Number(e.id) || 0,
                                  a = encodeURIComponent(String(e.fecha || '')),
                                  i = String(e.fecha || ''),
                                  o = de(e),
                                  r = encodeURIComponent(o),
                                  s = be(i)?.getTime() || 0,
                                  c = ye(i),
                                  l = 'pendiente' === t,
                                  u = l && oe.has(o),
                                  d =
                                      c >= 120
                                          ? 'is-warning'
                                          : c >= 45
                                            ? 'is-accent'
                                            : 'is-muted';
                              return `\n            <div class="callback-card ${t}${u ? ' is-selected' : ''}" data-callback-status="${t}" data-callback-id="${n}" data-callback-key="${C(r)}" data-callback-date="${C(a)}" data-callback-ts="${C(String(s))}">\n                <div class="callback-header">\n                    <span class="callback-phone">${C(e.telefono)}</span>\n                    <span class="status-badge status-${t}">\n                        ${'pendiente' === t ? 'Pendiente' : 'Contactado'}\n                    </span>\n                </div>\n                <span class="callback-preference">\n                    <i class="fas fa-clock"></i>\n                    ${C(B(e.preferencia))}\n                </span>\n                ${l ? `<label class="toolbar-chip callback-select-chip"><input type="checkbox" data-callback-select-key="${C(r)}" ${u ? 'checked' : ''} /> Seleccionar</label>` : ''}\n                <p class="callback-time">\n                    <i class="fas fa-calendar"></i>\n                    ${C(new Date(e.fecha).toLocaleString('es-EC'))}\n                </p>\n                ${l ? `<span class="toolbar-chip callback-wait-chip ${d}">En cola: ${C(he(c))}</span>` : ''}\n                <div class="callback-actions">\n                    <a href="tel:${C(e.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${C(e.telefono)}">\n                        <i class="fas fa-phone"></i>\n                        Llamar\n                    </a>\n                    ${l ? `\n                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${a}">\n                            <i class="fas fa-check"></i>\n                            Marcar contactado\n                        </button>\n                    ` : ''}\n                </div>\n            </div>\n        `;
                          })
                          .join(''))
                    : (t.innerHTML =
                          '\n            <div class="card-empty-state">\n                <i class="fas fa-phone-slash" aria-hidden="true"></i>\n                <strong>No hay callbacks registrados</strong>\n                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>\n                </div>\n        '));
        })(s.filtered),
        (function (e, t, n) {
            const a = ce(),
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
                p = e.filter((e) => 'pendiente' === N(e.status)).length,
                f = e.filter((e) => 'contactado' === N(e.status)).length;
            i &&
                (i.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${C(String(d))}${m !== d ? ` de ${C(String(m))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${C(String(p))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${C(String(f))}</span>`,
                    '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
                ].join(''));
            const g = n.filter !== Y,
                b = '' !== n.search,
                y = n.sort !== X;
            if (o)
                if (g || b || y) {
                    const e = [
                        '<span class="toolbar-state-label">Criterios activos:</span>',
                    ];
                    (g &&
                        e.push(
                            `<span class="toolbar-state-value">${C(ne[n.filter] || n.filter)}</span>`
                        ),
                        b &&
                            e.push(
                                `<span class="toolbar-state-value is-search">Busqueda: ${C(n.search)}</span>`
                            ),
                        y &&
                            e.push(
                                `<span class="toolbar-state-value is-sort">Orden: ${C(ae[n.sort] || n.sort)}</span>`
                            ),
                        e.push(
                            `<span class="toolbar-state-value">Resultados: ${C(String(d))}</span>`
                        ),
                        (o.innerHTML = e.join('')));
                } else
                    o.innerHTML =
                        '<span class="toolbar-state-empty">Sin filtros activos</span>';
            var h, v;
            (r && r.classList.toggle('is-hidden', !g && !b && !y),
                c && (c.value = n.filter),
                l && (l.value = n.sort),
                u && (u.value = n.search),
                (h = s),
                (v = n.filter),
                h.forEach((e) => {
                    const t = e.dataset.filterValue === v;
                    (e.classList.toggle('is-active', t),
                        e.setAttribute('aria-pressed', String(t)));
                }));
        })(s.filtered, t, s.criteria),
        fe(s.filtered),
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
                    .filter((e) => 'pendiente' === N(e.status))
                    .map((e) => ({ callback: e, minutesWaiting: ye(e.fecha) }))
                    .sort((e, t) => {
                        if (t.minutesWaiting !== e.minutesWaiting)
                            return t.minutesWaiting - e.minutesWaiting;
                        const n = be(e.callback.fecha),
                            a = be(t.callback.fecha);
                        return (n ? n.getTime() : 0) - (a ? a.getTime() : 0);
                    }));
            var c;
            const l = s.length,
                u = s.filter((e) => e.minutesWaiting >= 120).length,
                d = s.filter((e) => e.minutesWaiting >= 45).length,
                m = ge(new Date()),
                p = s.filter((e) => {
                    const t = be(e.callback.fecha);
                    return !!t && ge(t) === m;
                }).length;
            ((n.textContent = C(String(l))),
                (a.textContent = C(String(u))),
                (i.textContent = C(String(p))),
                (t.className = 'toolbar-chip'),
                u > 0 || l >= 8
                    ? (t.classList.add('is-warning'),
                      (t.textContent = 'Cola: prioridad alta'))
                    : d >= 2 || l >= 3
                      ? (t.classList.add('is-accent'),
                        (t.textContent = 'Cola: atención requerida'))
                      : (t.classList.add('is-muted'),
                        (t.textContent = 'Cola: estable')));
            const f = s[0] || null;
            if (!f)
                return (
                    (o.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = be(f.callback.fecha),
                b = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((o.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${C(f.callback.telefono || 'Sin teléfono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${C(he(f.minutesWaiting))} | Preferencia: ${C(B(f.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${C(b)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function Ce(e, { preserveSearch: t = !0 } = {}) {
    we({ filter: e }, { preserveSearch: t });
}
function Ee() {
    we({ search: ce().searchInput?.value || '' });
}
function qe() {
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
let _e = !1;
function Ae(e, t = 'muted') {
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
function Le(e) {
    const t = (e + '='.repeat((4 - (e.length % 4)) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/'),
        n = window.atob(t),
        a = new Uint8Array(n.length);
    for (let e = 0; e < n.length; e += 1) a[e] = n.charCodeAt(e);
    return a;
}
function Te() {
    return {
        subscribeBtn: document.getElementById('subscribePushBtn'),
        testBtn: document.getElementById('testPushBtn'),
    };
}
function $e(e) {
    const { subscribeBtn: t, testBtn: n } = Te();
    (t && (t.classList.toggle('is-hidden', !e), (t.disabled = !e)),
        n && (n.classList.toggle('is-hidden', !e), (n.disabled = !e)));
}
function Me(e) {
    const { subscribeBtn: t } = Te();
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
    const e = await k('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Be() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Me(Boolean(t)),
        Ae(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
        t
    );
}
async function Ne() {
    const { subscribeBtn: e } = Te();
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
                      (await k('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              Ae('disponible', 'muted'),
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
                      applicationServerKey: Le(e),
                  });
                  return (
                      await k('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              Ae('activo', 'ok'),
              E('Notificaciones activadas', 'success'));
    } catch (e) {
        (Ae('error', 'error'),
            E(`Push: ${e.message || 'error desconocido'}`, 'error'));
    } finally {
        ((e.disabled = !1),
            await Be().catch(() => {
                Me(!1);
            }),
            'subscribe' !== e.dataset.action &&
                'unsubscribe' !== e.dataset.action &&
                (e.innerHTML = n));
    }
}
async function De() {
    const { testBtn: e } = Te();
    if (!e) return;
    const t = e.querySelector('i'),
        n = t ? t.className : '';
    ((e.disabled = !0), t && (t.className = 'fas fa-spinner fa-spin'));
    try {
        const e =
                (await k('push-test', { method: 'POST', body: {} })).result ||
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
const xe = 'queueThemeAdmin',
    He = 'themeMode',
    Fe = new Set(['light', 'dark', 'system']);
let Pe = 'system',
    Re = null,
    je = !1,
    Oe = !1,
    ze = null;
function Ue() {
    return (
        Re ||
            'function' != typeof window.matchMedia ||
            (Re = window.matchMedia('(prefers-color-scheme: dark)')),
        Re
    );
}
function Ve(e) {
    return Fe.has(String(e || '').trim());
}
function Ke() {
    try {
        const e =
            localStorage.getItem(xe) || localStorage.getItem(He) || 'system';
        return Ve(e) ? e : 'system';
    } catch (e) {
        return 'system';
    }
}
function We(e) {
    const t = document.documentElement;
    if (!t) return;
    const n = (function (e) {
        return 'system' !== e ? e : Ue()?.matches ? 'dark' : 'light';
    })(e);
    (t.setAttribute('data-theme-mode', e), t.setAttribute('data-theme', n));
}
function Ge() {
    document
        .querySelectorAll('.admin-theme-btn[data-theme-mode]')
        .forEach((e) => {
            const t = e.dataset.themeMode === Pe;
            (e.classList.toggle('is-active', t),
                e.setAttribute('aria-pressed', String(t)));
        });
}
function Je(e, { persist: t = !1, animate: n = !1 } = {}) {
    const a = Ve(e) ? e : 'system';
    ((Pe = a),
        t &&
            (function (e) {
                try {
                    (localStorage.setItem(xe, e), localStorage.setItem(He, e));
                } catch (e) {}
            })(a),
        n &&
            document.body &&
            (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
                (ze && clearTimeout(ze),
                document.body.classList.remove('theme-transition'),
                document.body.offsetWidth,
                document.body.classList.add('theme-transition'),
                (ze = setTimeout(() => {
                    document.body?.classList.remove('theme-transition');
                }, 220)))),
        We(a),
        Ge());
}
function Qe() {
    'system' === Pe && (We('system'), Ge());
}
function Ye(e) {
    (e?.key && e.key !== xe && e.key !== He) ||
        Je(
            'string' == typeof e?.newValue && Ve(e.newValue)
                ? e.newValue
                : Ke(),
            { persist: !1, animate: !1 }
        );
}
const Xe = 'admin-appointments-sort',
    Ze = 'admin-appointments-density',
    et = 'datetime_desc',
    tt = 'comfortable',
    nt = 'all',
    at = new Set(['datetime_desc', 'datetime_asc', 'triage', 'patient_az']),
    it = new Set(['comfortable', 'compact']),
    ot = new Set([
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
function rt(e) {
    const t = String(e?.date || '').trim();
    if (!t) return null;
    const n = String(e?.time || '00:00').trim() || '00:00',
        a = new Date(`${t}T${n}:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function st() {
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
function ct(e) {
    const t = String(e || '').trim();
    return ot.has(t) ? t : nt;
}
function lt(e) {
    const t = String(e || '').trim();
    return at.has(t) ? t : et;
}
function ut(e) {
    const t = String(e || '').trim();
    return it.has(t) ? t : tt;
}
function dt(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function mt(e) {
    const t = ut(e),
        { appointmentsSection: n } = st();
    (n?.classList.toggle('appointments-density-compact', 'compact' === t),
        (function (e) {
            const t = ut(e),
                { densityButtons: n } = st();
            n.forEach((e) => {
                const n = e.dataset.density === t;
                (e.classList.toggle('is-active', n),
                    e.setAttribute('aria-pressed', n ? 'true' : 'false'));
            });
        })(t));
}
function pt(e, t = new Date()) {
    const n = String(e?.paymentStatus || ''),
        a = String(e?.status || 'confirmed'),
        i = 'noshow' === a ? 'no_show' : a,
        o = (function (e, t = new Date()) {
            const n = rt(e);
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
        m = rt(e),
        p =
            s && m
                ? (t.getTime() - m.getTime()) / 864e5
                : Number.POSITIVE_INFINITY,
        f = s && Number.isFinite(p) && p >= 0 && p <= 7;
    let g = 8;
    r
        ? (g = 0)
        : u
          ? (g = 1)
          : d
            ? (g = 2)
            : f
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
        f && b.push({ tone: 'is-muted', label: 'Reagendar no-show' }),
        {
            status: i,
            isPendingTransfer: r,
            isOverdue: u,
            isImminent: d,
            requiresNoShowFollowUp: f,
            priorityScore: g,
            hoursUntil: o,
            badges: b,
        }
    );
}
function ft(e) {
    return pt(e).priorityScore;
}
function gt() {
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
        const { filterSelect: e, sortSelect: t, searchInput: n } = st();
        return {
            filter: ct(e?.value || nt),
            sort: lt(t?.value || et),
            search: String(n?.value || '').trim(),
        };
    })();
    !(function (e) {
        const t = ct(e),
            { quickFilterButtons: n } = st();
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
                a = ct(t);
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
                        const t = rt(e);
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
                        const t = pt(e, o);
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
                        const t = pt(e);
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
            const n = lt(t),
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
                    const n = ft(e) - ft(t);
                    if (0 !== n) return n;
                    const a = pt(e),
                        o = pt(t);
                    return a.hoursUntil !== o.hoursUntil
                        ? a.hoursUntil - o.hoursUntil
                        : i(e, t);
                }
                return -i(e, t);
            });
        })(t, n?.sort || et);
        a.innerHTML = i
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    i = 'cancelled' === t,
                    o = 'no_show' === t || 'noshow' === t,
                    r = pt(e),
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
                        ? `<br><small>Asignado: ${C(T(e.doctorAssigned))}</small>`
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
                    p = r.badges
                        .map(
                            (e) =>
                                `<span class="toolbar-chip ${C(e.tone)}">${C(e.label)}</span>`
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
                return `\n        <tr class="${s}">\n            <td data-label="Paciente" class="appointment-cell-main">\n                <strong>${C(e.name)}</strong><br>\n                <small>${C(e.email)}</small>\n                <div class="appointment-inline-meta">\n                    <span class="toolbar-chip">${C(String(e.phone || 'Sin telefono'))}</span>\n                    ${p}\n                </div>\n            </td>\n            <td data-label="Servicio">${C(L(e.service))}</td>\n            <td data-label="Doctor">${C(T(e.doctor))}${c}</td>\n            <td data-label="Fecha">${C(
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
                )}</td>\n            <td data-label="Hora">${C(e.time)}</td>\n            <td data-label="Pago" class="appointment-payment-cell">\n                <strong>${C(e.price || '$0.00')}</strong>\n                <small>${C(M(e.paymentMethod))} - ${C(I(n))}</small>\n                ${l}\n                ${d}\n            </td>\n            <td data-label="Estado">\n                <span class="status-badge status-${C(t)}">\n                    ${C($(t))}\n                </span>\n            </td>\n            <td data-label="Acciones">\n                <div class="table-actions">\n                    ${a ? `\n                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(e.id) || 0}" title="Aprobar transferencia">\n                        <i class="fas fa-check"></i>\n                    </button>\n                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(e.id) || 0}" title="Rechazar transferencia">\n                        <i class="fas fa-ban"></i>\n                    </button>\n                    ` : ''}\n                    <a href="tel:${C(e.phone)}" class="btn-icon" title="Llamar" aria-label="Llamar a ${C(e.name)}">\n                        <i class="fas fa-phone"></i>\n                    </a>\n                    <a href="https://wa.me/${C(g)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="${C(r.isPendingTransfer ? 'WhatsApp para validar pago' : r.isOverdue ? 'WhatsApp para reprogramar cita atrasada' : r.requiresNoShowFollowUp ? 'WhatsApp para seguimiento no-show' : 'WhatsApp')}" aria-label="Abrir WhatsApp de ${C(e.name)}">\n                        <i class="fab fa-whatsapp"></i>\n                    </a>\n                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(e.id) || 0}" title="Cancelar">\n                        <i class="fas fa-times"></i>\n                    </button>\n                    ${'cancelled' !== t && 'completed' !== t && 'no_show' !== t ? `\n                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(e.id) || 0}" title="Marcar no asistio">\n                        <i class="fas fa-user-slash"></i>\n                    </button>\n                    ` : ''}\n                </div>\n            </td>\n        </tr>\n    `;
            })
            .join('');
    })(n, { sort: t.sort }),
        (function (e, t) {
            const { stateRow: n, clearBtn: a } = st();
            if (!n) return;
            const i = ct(e?.filter || nt),
                o = lt(e?.sort || et),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = st();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = i !== nt,
                l = r.length > 0,
                u = o !== et || s !== tt;
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
                            return t[String(e || nt)] || t.all;
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
                            return t[lt(e)] || t.datetime_desc;
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
                            return t[ut(e)] || t.comfortable;
                        })(s)
                    )}</span>`
                ),
                (n.innerHTML = m.join('')));
        })(t, n));
}
function bt() {
    gt();
}
function yt(e, t = {}) {
    const { filterSelect: n, searchInput: a } = st(),
        i = ct(e),
        o = !1 !== t.preserveSearch;
    (n && (n.value = i), !o && a && (a.value = ''), gt());
}
function ht() {
    yt(nt, { preserveSearch: !1 });
}
function vt(e) {
    let t = String(e ?? '');
    return (/^[=+\-@]/.test(t) && (t = "'" + t), `"${t.replace(/"/g, '""')}"`);
}
function St() {
    if (!Array.isArray(e) || 0 === e.length)
        return void E('No hay citas para exportar', 'warning');
    const t = e.map((e) => [
            Number(e.id) || 0,
            e.date || '',
            e.time || '',
            vt(e.name || ''),
            vt(e.email || ''),
            vt(e.phone || ''),
            vt(L(e.service)),
            vt(T(e.doctor)),
            e.price || '',
            vt($(e.status || 'confirmed')),
            vt(I(e.paymentStatus)),
            vt(M(e.paymentMethod)),
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
let kt = null,
    wt = new Date(),
    Ct = !1,
    Et = null,
    qt = {},
    _t = !1;
const At = 'admin-availability-day-clipboard',
    Lt = 'admin-availability-last-selected-date';
function Tt(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = {};
    return (
        Object.keys(t)
            .sort()
            .forEach((e) => {
                if (!Dt(e)) return;
                const a = Pt(t[e] || []);
                a.length > 0 && (n[e] = a);
            }),
        n
    );
}
function $t(e) {
    qt = Tt(e);
}
function Mt() {
    const e = Tt(a),
        t = Tt(qt);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                i = t[n] || [];
            return a.length !== i.length || a.some((e, t) => e !== i[t]);
        });
}
function It() {
    return Mt().length > 0;
}
function Bt(e) {
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Nt(e) {
    const t = String(e || '').trim(),
        n = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (n) return new Date(Number(n[1]), Number(n[2]) - 1, Number(n[3]));
    const a = new Date(t);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Dt(e) {
    return Boolean(Nt(e));
}
function xt(e) {
    try {
        const t = String(e || '').trim();
        if (!Dt(t)) return void localStorage.removeItem(Lt);
        localStorage.setItem(Lt, t);
    } catch (e) {}
}
function Ht() {
    Et ||
        (Et = (function () {
            try {
                const e = JSON.parse(localStorage.getItem(At) || 'null');
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
function Ft() {
    try {
        if (
            Et &&
            'object' == typeof Et &&
            Array.isArray(Et.slots) &&
            Et.slots.length > 0
        )
            return void localStorage.setItem(At, JSON.stringify(Et));
        localStorage.removeItem(At);
    } catch (e) {}
}
function Pt(e) {
    return Array.from(
        new Set(
            (Array.isArray(e) ? e : [])
                .map((e) => String(e || '').trim())
                .filter(Boolean)
        )
    ).sort();
}
function Rt(e, t) {
    const n = String(e || '').trim(),
        a = Pt(t);
    if (!n || 0 === a.length) return ((Et = null), void Ft());
    ((Et = { sourceDate: n, slots: a, copiedAt: new Date().toISOString() }),
        Ft());
}
function jt(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = Nt(t);
    return n
        ? n.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          })
        : t;
}
function Ot() {
    return kt ? Pt(a[kt] || []) : [];
}
function zt(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const i = Pt(t);
    0 !== i.length ? (a[n] = i) : delete a[n];
}
function Ut(e, t) {
    const n = Nt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const i = Math.max(0, Math.round(a));
    return 0 === i
        ? []
        : Array.from({ length: i }, (e, t) => {
              const a = new Date(n);
              return (a.setDate(n.getDate() + t), Bt(a));
          });
}
function Vt(e) {
    return (Array.isArray(e) ? e : []).reduce(
        (e, t) => e + Pt(a[t] || []).length,
        0
    );
}
function Kt(e) {
    const t = Nt(e);
    t && (wt = new Date(t.getFullYear(), t.getMonth(), 1));
}
function Wt(e, t) {
    const n = Nt(e);
    if (!n) return;
    const a = Number(t);
    if (!Number.isFinite(a) || 0 === a) return;
    const i = new Date(n);
    i.setDate(n.getDate() + a);
    const o = Bt(i);
    (Kt(o), un(o));
}
function Gt(e) {
    const t = String(e || '').trim();
    if (!t) return 'n/d';
    const n = new Date(t);
    return Number.isNaN(n.getTime()) ? 'n/d' : n.toLocaleString('es-EC');
}
function Jt(e) {
    const t = document.getElementById('availabilityHelperText');
    t && (t.textContent = String(e || '').trim());
}
function Qt(e) {
    const t = document.getElementById('timeSlotsCountBadge');
    if (!t) return;
    const n =
        Number.isFinite(Number(e)) && Number(e) > 0 ? Math.round(Number(e)) : 0;
    t.textContent = `${n} horario${1 === n ? '' : 's'}`;
}
function Yt() {
    const e = document.getElementById('availabilitySelectionSummary');
    if (!e) return;
    const t =
            'google' === String(i.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = Ct ? 'Solo lectura' : 'Editable',
        o = String(kt || '').trim(),
        r = o ? (Array.isArray(a[o]) ? a[o].length : 0) : null;
    if (!o)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${C(t)}</span>`,
            `<span class="availability-summary-chip ${Ct ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${C(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Nt(o),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : o;
    e.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${C(t)}</span>`,
        `<span class="availability-summary-chip ${Ct ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${C(n)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${C(c)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${C(String(r ?? 0))}</span>`,
    ].join('');
}
function Xt() {
    Ht();
    const e = document.getElementById('availabilityDayActions'),
        t = document.getElementById('availabilityDayActionsStatus');
    if (!e || !t) return;
    const n = Boolean(String(kt || '').trim()),
        i = Ot(),
        o = i.length > 0,
        r = n ? Ut(kt, 7) : [],
        s = Vt(r),
        c = r.filter((e) => Pt(a[e] || []).length > 0).length,
        l = Pt(Et?.slots || []),
        u = l.length > 0,
        d = e.querySelector('[data-action="copy-availability-day"]'),
        m = e.querySelector('[data-action="paste-availability-day"]'),
        p = e.querySelector('[data-action="duplicate-availability-day-next"]'),
        f = e.querySelector('[data-action="duplicate-availability-next-week"]'),
        g = e.querySelector('[data-action="clear-availability-day"]'),
        b = e.querySelector('[data-action="clear-availability-week"]');
    if (
        (d instanceof HTMLButtonElement && (d.disabled = !n || !o),
        m instanceof HTMLButtonElement && (m.disabled = !n || !u || Ct),
        p instanceof HTMLButtonElement && (p.disabled = !n || !o || Ct),
        f instanceof HTMLButtonElement && (f.disabled = !n || !o || Ct),
        g instanceof HTMLButtonElement && (g.disabled = !n || !o || Ct),
        b instanceof HTMLButtonElement && (b.disabled = !n || 0 === s || Ct),
        e.classList.toggle('is-hidden', !n && !u),
        !n && !u)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const y = [];
    (n &&
        (y.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${C(jt(kt))}</span>`
        ),
        y.push(
            `<span class="toolbar-chip is-muted">Slots: ${C(String(i.length))}</span>`
        ),
        y.push(
            `<span class="toolbar-chip is-muted">Semana: ${C(String(c))} dia(s), ${C(String(s))} slot(s)</span>`
        )),
        u
            ? y.push(
                  `<span class="toolbar-chip">Portapapeles: ${C(String(l.length))} (${C(jt(Et?.sourceDate))})</span>`
              )
            : y.push(
                  '<span class="toolbar-chip is-muted">Portapapeles vacío</span>'
              ),
        Ct &&
            y.push(
                '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
            ),
        (t.innerHTML = y.join('')));
}
function Zt() {
    const e = document.getElementById('availabilityDraftPanel'),
        t = document.getElementById('availabilityDraftStatus'),
        n = document.getElementById('availabilitySaveDraftBtn'),
        a = document.getElementById('availabilityDiscardDraftBtn');
    if (!e || !t) return;
    const i = Mt(),
        o = i.length,
        r = i
            .slice(0, 2)
            .map((e) => jt(e))
            .join(', ');
    if (Ct)
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
        ((n.disabled = Ct || 0 === o || _t),
        n.setAttribute('aria-busy', String(_t))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === o || _t));
}
function en() {
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
        d = Gt(i.generatedAt),
        m = Gt(i.calendarLastSuccessAt),
        p = Gt(i.calendarLastErrorAt),
        f = String(i.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === o ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${C(n)}</strong> | TZ: <strong>${C(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${C(s)}</strong> | Token OK: <strong>${C(c)}</strong> | Configurado: <strong>${C(l)}</strong> | Reachable: <strong>${C(u)}</strong> | Ultimo exito: <strong>${C(m)}</strong> | Snapshot: <strong>${C(d)}</strong>`;
            ('blocked' === o &&
                f &&
                (e += ` | Ultimo error: <strong>${C(p)}</strong> (${C(f)})`),
                (t.innerHTML = e));
        }
        Jt(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else
        ((e.innerHTML = 'Fuente: <strong>Configuracion local</strong>'),
            t && (t.innerHTML = `Snapshot: <strong>${C(d)}</strong>`),
            Jt(
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
        Yt(),
        Xt(),
        Zt(),
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
function tn() {
    const e = document.getElementById('selectedDate');
    (e && (e.textContent = 'Selecciona una fecha'), Qt(0));
    const t = document.getElementById('timeSlotsList');
    (t &&
        (t.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>'),
        nn(),
        Yt(),
        Xt(),
        Zt());
}
function nn() {
    const e = Boolean(String(kt || '').trim()),
        t = document.getElementById('addSlotForm');
    t && t.classList.toggle('is-hidden', Ct || !e);
    const n = document.getElementById('availabilityQuickSlotPresets');
    (n &&
        (n.classList.toggle('is-hidden', Ct || !e),
        n.querySelectorAll('.slot-preset-btn').forEach((t) => {
            t.disabled = Ct || !e;
        })),
        Xt(),
        Zt());
}
function an() {
    const e = wt.getFullYear(),
        t = wt.getMonth(),
        n = new Date(e, t, 1).getDay(),
        i = new Date(e, t + 1, 0).getDate(),
        o = new Date(e, t, 0).getDate();
    document.getElementById('calendarMonth').textContent = new Date(
        e,
        t
    ).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    const r = document.getElementById('availabilityCalendar');
    r.innerHTML = '';
    const s = Bt(new Date());
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
        const i = Bt(new Date(e, t, n)),
            o = document.createElement('div');
        ((o.className = 'calendar-day'),
            (o.textContent = n),
            (o.tabIndex = 0),
            o.setAttribute('role', 'button'),
            o.setAttribute('aria-label', `Seleccionar ${i}`),
            kt === i && o.classList.add('selected'),
            s === i && o.classList.add('today'),
            a[i] && a[i].length > 0 && o.classList.add('has-slots'),
            o.addEventListener('click', () => un(i)),
            o.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void un(i))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void Wt(i, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void Wt(i, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void Wt(i, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), Wt(i, 7))
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
function on(e) {
    (wt.setMonth(wt.getMonth() + e), an());
}
function rn() {
    const e = new Date();
    ((wt = new Date(e.getFullYear(), e.getMonth(), 1)), an(), un(Bt(e)));
}
function sn() {
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
        const i = Dt(e) ? String(e).trim() : Bt(new Date()),
            o = t ? (e) => e >= i : (e) => e > i;
        return n.find(o) || n[0];
    })({ referenceDate: kt || Bt(new Date()), includeReference: !1 });
    e
        ? (Kt(e), un(e))
        : E('No hay fechas con horarios configurados', 'warning');
}
function cn() {
    const e = document.getElementById('newSlotTime');
    e instanceof HTMLInputElement &&
        (Ct || e.closest('.is-hidden') || e.focus({ preventScroll: !0 }));
}
function ln() {
    return (
        document.getElementById('availability')?.classList.contains('active') ||
        !1
    );
}
function un(e, { persist: t = !0 } = {}) {
    if (!Dt(e)) return;
    ((kt = e), t && xt(e), an());
    const n = Nt(e) || new Date(e);
    ((document.getElementById('selectedDate').textContent =
        n.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })),
        nn(),
        Yt(),
        dn(e));
}
function dn(e) {
    const t = a[e] || [],
        n = document.getElementById('timeSlotsList');
    if ((Qt(t.length), 0 === t.length))
        return (
            (n.innerHTML =
                '<p class="empty-message">No hay horarios configurados para este dia</p>'),
            Yt(),
            Xt(),
            void Zt()
        );
    const i = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${Ct ? ' is-readonly' : ''}">\n            <span class="time">${C(e)}</span>\n            <div class="slot-actions">\n                ${Ct ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${i}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        Yt(),
        Xt(),
        Zt());
}
function mn() {
    (an(), kt ? dn(kt) : tn());
}
function pn(e) {
    ('function' == typeof e && e(), mn());
}
async function fn() {
    if (Ct)
        return (
            E(
                'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                'warning'
            ),
            !1
        );
    if (!It()) return (E('No hay cambios pendientes por guardar', 'info'), !1);
    try {
        return (
            await (async function () {
                if (Ct)
                    throw new Error(
                        'Disponibilidad en solo lectura (Google Calendar).'
                    );
                if (_t) return !1;
                ((_t = !0), Zt());
                try {
                    const e = Tt(a);
                    return (
                        p(e),
                        await k('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        $t(a),
                        !0
                    );
                } finally {
                    ((_t = !1), Zt());
                }
            })(),
            E('Cambios de disponibilidad guardados', 'success'),
            !0
        );
    } catch (e) {
        return (E(`No se pudieron guardar cambios: ${e.message}`, 'error'), !1);
    }
}
function gn() {
    It()
        ? confirm(
              'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
          ) && (p(Tt(qt)), mn(), E('Cambios pendientes descartados', 'success'))
        : E('No hay cambios pendientes por descartar', 'info');
}
function bn() {
    return Ct
        ? (E(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!kt || (E('Selecciona una fecha primero', 'warning'), !1);
}
function yn() {
    if (!kt) return void E('Selecciona una fecha para copiar', 'warning');
    const e = Ot();
    0 !== e.length
        ? (Rt(kt, e),
          Xt(),
          E(
              `Día copiado (${e.length} horario${1 === e.length ? '' : 's'})`,
              'success'
          ))
        : E('No hay horarios para copiar en este dia', 'warning');
}
async function hn() {
    if ((Ht(), !bn())) return;
    const e = Pt(Et?.slots || []);
    if (0 === e.length) return void E('Portapapeles vacio', 'warning');
    const t = Ot();
    t.length === e.length && t.every((t, n) => t === e[n])
        ? E('La fecha ya tiene esos mismos horarios', 'warning')
        : (t.length > 0 &&
              !confirm(
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${jt(kt)} con ${e.length}?`
              )) ||
          (pn(() => {
              zt(kt, e);
          }),
          E('Horarios pegados en cambios pendientes', 'success'));
}
async function vn() {
    if (!bn()) return;
    const e = Ot();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Nt(kt);
    if (!t) return void E('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const i = Bt(n),
        o = Pt(a[i] || []);
    (o.length > 0 &&
        !confirm(
            `${jt(i)} ya tiene ${o.length} horario${1 === o.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (pn(() => {
            (zt(i, e), Rt(kt, e));
        }),
        Kt(i),
        un(i),
        E(`Horarios duplicados a ${jt(i)} (pendiente de guardar)`, 'success'));
}
async function Sn() {
    if (!bn()) return;
    const e = Ot();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Ut(kt, 8).slice(1);
    if (0 === t.length)
        return void E('No se pudieron preparar los siguientes dias', 'error');
    const n = t.filter((t) => {
        const n = Pt(a[t] || []);
        return (
            n.length > 0 &&
            (n.length !== e.length || n.some((t, n) => t !== e[n]))
        );
    }).length;
    (n > 0 &&
        !confirm(
            `Se reemplazaran horarios en ${n} dia(s). Deseas continuar?`
        )) ||
        (pn(() => {
            (t.forEach((t) => {
                zt(t, e);
            }),
                Rt(kt, e));
        }),
        E(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function kn() {
    if (!bn()) return;
    const e = Ot();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${jt(kt)}?`
          ) &&
          (pn(() => {
              zt(kt, []);
          }),
          Kt(kt),
          un(kt),
          E('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : E('No hay horarios que limpiar en este dia', 'warning');
}
async function wn() {
    if (!bn()) return;
    const e = Ut(kt, 7);
    if (0 === e.length)
        return void E('No se pudo preparar la semana de limpieza', 'error');
    const t = e.filter((e) => Pt(a[e] || []).length > 0);
    if (0 === t.length)
        return void E(
            'No hay horarios para limpiar en los proximos 7 dias',
            'warning'
        );
    const n = Vt(t);
    confirm(
        `Eliminar ${n} horario(s) en ${t.length} dia(s) desde ${jt(kt)}?`
    ) &&
        (pn(() => {
            t.forEach((e) => {
                zt(e, []);
            });
        }),
        Kt(kt),
        un(kt),
        E(
            `Semana limpiada (${t.length} dia(s)) pendiente de guardar`,
            'success'
        ));
}
const Cn = {
    waiting: 'En espera',
    called: 'Llamado',
    completed: 'Completado',
    no_show: 'No asistio',
    cancelled: 'Cancelado',
};
function En() {
    try {
        return Boolean(window.__PIEL_QUEUE_PRACTICE_MODE);
    } catch (e) {
        return !1;
    }
}
const qn = {
        appt_overdue: 'Cita vencida',
        appt_current: 'Cita vigente',
        walk_in: 'Walk-in',
    },
    _n = new Set(['completed', 'no_show', 'cancelled']),
    An = new Set(['waiting', 'called']),
    Ln = ['completar', 'no_show', 'cancelar'],
    Tn = { completar: 'Completar', no_show: 'No show', cancelar: 'Cancelar' },
    $n = ['all', 'waiting', 'called', 'sla_risk', 'appointments', 'walk_in'],
    Mn = 'queueAdminLastSnapshot',
    In = {
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
function Bn(e, t) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return [];
    for (const n of t) {
        if (!n) continue;
        const t = e[n];
        if (Array.isArray(t)) return t;
    }
    return [];
}
function Nn(e, t) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return null;
    for (const n of t) {
        if (!n) continue;
        const t = e[n];
        if (t && 'object' == typeof t && !Array.isArray(t)) return t;
    }
    return null;
}
function Dn(e, t, n = 0) {
    if (!e || 'object' != typeof e || !Array.isArray(t)) return Number(n || 0);
    for (const n of t) {
        if (!n) continue;
        const t = e[n],
            a = Number(t);
        if (Number.isFinite(a)) return a;
    }
    return Number(n || 0);
}
function xn(e) {
    const t = e && 'object' == typeof e ? e : {},
        n = Nn(t, ['counts']) || {},
        a = Bn(t, ['queue_tickets', 'queueTickets', 'tickets']);
    let i = Bn(t, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (0 === i.length) {
        const e = Nn(t, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        e && (i = Object.values(e).filter(Boolean));
    }
    const o = Bn(t, [
            'nextTickets',
            'next_tickets',
            'waitingTickets',
            'waiting_tickets',
        ]),
        r = Bn(t, ['waitingTickets', 'waiting_tickets', 'waiting']),
        s = Bn(t, ['calledTickets', 'called_tickets', 'called']),
        c = Dn(t, ['waitingCount', 'waiting_count'], Number.NaN),
        l = Dn(t, ['calledCount', 'called_count'], Number.NaN),
        u = Number.isFinite(c) ? c : Dn(n, ['waiting', 'waiting_count'], 0),
        d = Number.isFinite(l) ? l : Dn(n, ['called', 'called_count'], 0);
    return {
        updatedAt:
            String(t.updatedAt || t.updated_at || '').trim() ||
            new Date().toISOString(),
        counts: n,
        waitingCount: Math.max(0, u),
        calledCount: Math.max(0, d),
        queueTickets: a,
        waitingTickets: r,
        calledTickets: s,
        callingNow: Array.isArray(i) ? i : [],
        nextTickets: Array.isArray(o) ? o : [],
    };
}
function Hn() {
    In.fallbackContext = null;
}
function Fn(e, { reason: t = 'state_fallback' } = {}) {
    const n = xn(e),
        a = Number(n.waitingCount || 0),
        i = Number(n.calledCount || 0),
        o = Array.isArray(n.nextTickets) ? n.nextTickets.length : 0,
        r = Array.isArray(n.callingNow) ? n.callingNow.length : 0,
        s = Math.max(0, a + i),
        c = Math.max(0, o + r);
    In.fallbackContext = {
        reason: String(t || 'state_fallback'),
        waitingCount: Math.max(0, a),
        calledCount: Math.max(0, i),
        nextTicketsCount: Math.max(0, o),
        callingNowCount: Math.max(0, r),
        knownCount: s,
        sampledCount: c,
        partial: s > c,
        updatedAt: n.updatedAt,
    };
}
function Pn() {
    if ('state_fallback' !== In.lastRefreshMode) return null;
    const e = In.fallbackContext;
    return e && 'object' == typeof e ? e : null;
}
function Rn(e, t = {}) {
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
function jn(e) {
    const t = Math.max(0, Number(e || 0)),
        n = Math.round(t / 1e3);
    if (n < 60) return `${n}s`;
    const a = Math.floor(n / 60),
        i = n % 60;
    return i <= 0 ? `${a}m` : `${a}m ${i}s`;
}
function On(e) {
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
function zn() {
    try {
        const e = localStorage.getItem(Mn);
        return e ? On(JSON.parse(e)) : null;
    } catch (e) {
        return null;
    }
}
function Un(e, { source: t = 'fallback' } = {}) {
    const n = On(e);
    if (!n) return !1;
    const a = Array.isArray(n.data.queueTickets) ? n.data.queueTickets : [],
        i =
            n.data.queueMeta && 'object' == typeof n.data.queueMeta
                ? n.data.queueMeta
                : null;
    (y(a), h(i), Hn(), _a());
    const o = Math.max(0, Date.now() - Date.parse(String(n.savedAt || '')));
    return (
        Wn('reconnecting', `Respaldo local activo (${jn(o)})`, {
            log: !0,
            level: 'warning',
            reason: 'Respaldo local',
        }),
        Rn('snapshot_restored', { source: t, ageMs: o, queueCount: a.length }),
        !0
    );
}
function Vn() {
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
            }[In.syncState || 'paused'],
            n = String(In.syncMessage || '').trim();
        t.textContent = `Sync ${e}: ${n || 'sin detalle'}`;
    }
    const n = e.querySelector('#queueActivityList');
    n instanceof HTMLElement &&
        (Array.isArray(In.activityLog) && In.activityLog.length
            ? (n.innerHTML = In.activityLog
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
function Kn(e, { level: t = 'info' } = {}) {
    const n = String(e || '').trim();
    if (!n) return;
    const a = Date.now(),
        i = ['info', 'warning', 'error'].includes(t) ? t : 'info',
        o = In.activityLog[0] || null;
    (o && o.message === n && o.level === i && a - Number(o.ts || 0) < 2e3) ||
        ((In.activitySeq = Number(In.activitySeq || 0) + 1),
        In.activityLog.unshift({
            id: In.activitySeq,
            ts: a,
            level: i,
            message: n,
        }),
        (In.activityLog = In.activityLog.slice(0, 15)),
        Vn());
}
function Wn(e, t, { log: n = !1, level: a = 'info', reason: i = '' } = {}) {
    const o = String(e || 'paused').toLowerCase(),
        r = String(t || '').trim(),
        s =
            o !== String(In.syncState || 'paused') ||
            r !== String(In.syncMessage || '');
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
            ((In.syncState = a),
                (In.syncMessage = o),
                n ? ((n.dataset.state = a), (n.textContent = o), Vn()) : Vn());
        })(o, r),
        s && Rn('sync_state', { state: o, message: r }),
        !n || !s)
    )
        return s;
    const c = String(i || '').trim();
    return (Kn(c ? `${c}: ${r || o}` : r || o, { level: a }), s);
}
function Gn({ log: e = !1 } = {}) {
    if (!La()) return { stale: !1, ageMs: 0 };
    if ('offline' === String(In.syncState || '').toLowerCase())
        return { stale: !1, ageMs: 0 };
    const t = Date.parse(String(c?.updatedAt || ''));
    if (!Number.isFinite(t)) return { stale: !1, ageMs: 0 };
    const n = Math.max(0, Date.now() - t);
    if (n < 3e4) return { stale: !1, ageMs: n };
    const a = `Watchdog: datos de cola estancados (${jn(n)})`;
    return (
        Wn('reconnecting', a, {
            log: e,
            level: 'warning',
            reason: 'Watchdog de cola',
        }),
        { stale: !0, ageMs: n, message: a }
    );
}
function Jn() {
    const e = Math.max(0, Number(In.realtimeFailureStreak || 0)),
        t = 2500 * Math.pow(2, Math.min(e, 3));
    return Math.min(15e3, t);
}
function Qn() {
    In.realtimeTimerId &&
        (window.clearTimeout(In.realtimeTimerId), (In.realtimeTimerId = 0));
}
function Yn({ immediate: e = !1 } = {}) {
    if ((Qn(), !In.realtimeEnabled)) return;
    const t = e ? 0 : Jn();
    In.realtimeTimerId = window.setTimeout(() => {
        Aa();
    }, t);
}
function Xn(e) {
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
function Zn(e) {
    const t = Date.parse(String(e || ''));
    return Number.isFinite(t) ? t : null;
}
function ea(e, t = Date.now()) {
    if (!Number.isFinite(e)) return !1;
    const n = new Date(e),
        a = new Date(t);
    return (
        n.getFullYear() === a.getFullYear() &&
        n.getMonth() === a.getMonth() &&
        n.getDate() === a.getDate()
    );
}
function ta(e) {
    return Number.isFinite(e) ? `${Math.max(0, Math.round(e))}m` : '--';
}
function na(e) {
    const t = String(e ?? '');
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function aa() {
    In.opsActionsBound ||
        ((In.opsActionsBound = !0),
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
                            const t = ua(e);
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
                                da(e) ? 'yes' : 'no',
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
                                .map(na)
                                .join(','),
                            ...n.map((e) => e.map(na).join(',')),
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
                        Kn(`CSV exportado: ${n.length} ticket(s) visibles`, {
                            level: 'info',
                        }),
                        E(`CSV exportado (${n.length} tickets).`, 'success'),
                        Rn('queue_export_csv', {
                            rows: n.length,
                            filter: la(e?.activeFilter || 'all'),
                        }));
                })(In.lastViewState || pa());
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
                    l = Zn(e?.createdAt),
                    u = Zn(e?.calledAt),
                    d = Zn(e?.completedAt),
                    m = d ?? u ?? l ?? Zn(e?.updatedAt);
                (Number.isFinite(m) && (c = null === c ? m : Math.max(c, m)),
                    Number.isFinite(l) && ea(l, n) && (i += 1));
                const p = d ?? u ?? l;
                if (
                    ('completed' === t &&
                        Number.isFinite(p) &&
                        ea(p, n) &&
                        (o += 1),
                    'no_show' === t &&
                        Number.isFinite(p) &&
                        ea(p, n) &&
                        (r += 1),
                    'waiting' === t &&
                        Number.isFinite(l) &&
                        Math.max(0, Math.round((n - l) / 6e4)) >= 20 &&
                        (s += 1),
                    !Number.isFinite(l))
                )
                    continue;
                let f = null;
                if (
                    (Number.isFinite(u)
                        ? (f = u)
                        : 'waiting' === t || 'called' === t
                          ? (f = n)
                          : Number.isFinite(d) && (f = d),
                    !Number.isFinite(f))
                )
                    continue;
                const g = Math.max(0, Math.round((f - l) / 6e4));
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
        i && (i.textContent = ta(e.avgWaitMinutes)),
        o && (o.textContent = ta(e.p95WaitMinutes)),
        r && (r.textContent = String(e.slaRiskCount)),
        c)
    ) {
        const t =
            Number.isFinite(e.latestSignalTs) && null !== e.latestSignalTs
                ? Xn(e.latestSignalTs)
                : '--';
        c.textContent = `Muestra: ${e.waitSampleSize} ticket(s) · ultima señal ${t}`;
    }
}
function ia(e) {
    const t = xn(e),
        n = (e, { positionFallback: t = null } = {}) => {
            const n = Number(e?.position || 0);
            return {
                ...e,
                id: Number(e?.id || e?.ticket_id || 0) || 0,
                ticketCode: String(e?.ticketCode || e?.ticket_code || '--'),
                patientInitials: String(
                    e?.patientInitials || e?.patient_initials || '--'
                ),
                assignedConsultorio:
                    Number(
                        e?.assignedConsultorio ?? e?.assigned_consultorio ?? 0
                    ) || null,
                calledAt: String(e?.calledAt || e?.called_at || ''),
                queueType: String(e?.queueType || e?.queue_type || 'walk_in'),
                priorityClass: String(
                    e?.priorityClass || e?.priority_class || 'walk_in'
                ),
                position: n > 0 ? n : Number(t || 0) > 0 ? Number(t) : null,
            };
        },
        a = { 1: null, 2: null },
        i = Array.isArray(t.callingNow) ? t.callingNow : [];
    for (const e of i) {
        const t = Number(
            e?.assignedConsultorio ?? e?.assigned_consultorio ?? 0
        );
        (1 !== t && 2 !== t) || (a[String(t)] = n(e));
    }
    return {
        updatedAt: t.updatedAt,
        waitingCount: Number(t.waitingCount || 0),
        calledCount: Number(t.calledCount || 0),
        counts: t.counts || {},
        callingNowByConsultorio: a,
        nextTickets: Array.isArray(t.nextTickets)
            ? t.nextTickets.map((e, t) => n(e, { positionFallback: t + 1 }))
            : [],
    };
}
function oa(e, t = []) {
    const n = xn(e),
        a = new Map();
    if (Array.isArray(t))
        for (const e of t) {
            const t = Number(e?.id || 0);
            t && a.set(t, e);
        }
    const i = new Map(),
        o = String(n.updatedAt || '').trim() || new Date().toISOString(),
        r = (e, t) => {
            if (!e || 'object' != typeof e) return;
            const n = Number(e.id || e.ticket_id || 0);
            if (!n) return;
            const r = a.get(n) || {},
                s = String(t || 'waiting').toLowerCase(),
                c = Number(
                    e.assignedConsultorio ??
                        e.assigned_consultorio ??
                        r.assignedConsultorio ??
                        0
                ),
                l = String(e.createdAt ?? e.created_at ?? r.createdAt ?? o),
                u = String(e.calledAt ?? e.called_at ?? r.calledAt ?? o),
                d = String(
                    e.completedAt ?? e.completed_at ?? r.completedAt ?? ''
                ),
                m = Number.isFinite(n) ? `#${n}` : '--';
            i.set(n, {
                id: n,
                ticketCode: String(
                    e.ticketCode ?? e.ticket_code ?? r.ticketCode ?? m
                ),
                queueType: String(
                    e.queueType ?? e.queue_type ?? r.queueType ?? 'walk_in'
                ),
                priorityClass: String(
                    e.priorityClass ??
                        e.priority_class ??
                        r.priorityClass ??
                        'walk_in'
                ),
                status: s,
                assignedConsultorio: 1 === c || 2 === c ? c : null,
                createdAt: l,
                calledAt: 'called' === s ? u : '',
                completedAt: _n.has(s) ? d || o : '',
                patientInitials: String(
                    e.patientInitials ??
                        e.patient_initials ??
                        r.patientInitials ??
                        '--'
                ),
                phoneLast4: String(
                    e.phoneLast4 ?? e.phone_last4 ?? r.phoneLast4 ?? ''
                ),
            });
        },
        s = Array.isArray(n.queueTickets) ? n.queueTickets : [];
    for (const e of s) r(e, String(e?.status || 'waiting'));
    const c = Array.isArray(n.waitingTickets) ? n.waitingTickets : [];
    for (const e of c) r(e, 'waiting');
    const l = Array.isArray(n.calledTickets) ? n.calledTickets : [];
    for (const e of l) r(e, 'called');
    const u = Array.isArray(n.nextTickets) ? n.nextTickets : [];
    for (const e of u) {
        if (!e || 'object' != typeof e) continue;
        const t = Number(e.id || e.ticket_id || 0),
            n = (t && a.get(t)) || {};
        r(
            {
                ...n,
                ...e,
                queueType: e.queueType ?? n.queueType ?? 'walk_in',
                priorityClass: e.priorityClass ?? n.priorityClass ?? 'walk_in',
            },
            'waiting'
        );
    }
    const d = Array.isArray(n.callingNow) ? n.callingNow : [];
    for (const e of d) r(e, 'called');
    if (
        0 === i.size &&
        Number(n.waitingCount || 0) + Number(n.calledCount || 0) > 0
    )
        for (const e of a.values()) {
            const t = String(e?.status || '').toLowerCase();
            An.has(t) && r(e, t);
        }
    return Array.from(i.values());
}
function ra(e, t = '') {
    const n = Array.isArray(e) ? e : [],
        a = [],
        i = [];
    for (const e of n) {
        const t = String(e?.status || '').toLowerCase();
        'waiting' === t ? a.push(e) : 'called' === t && i.push(e);
    }
    (a.sort((e, t) => {
        const n = ca(e?.priorityClass) - ca(t?.priorityClass);
        if (0 !== n) return n;
        const a = Date.parse(String(e?.createdAt || '')),
            i = Date.parse(String(t?.createdAt || ''));
        return Number.isFinite(a) && Number.isFinite(i) && a !== i
            ? a - i
            : Number(e?.id || 0) - Number(t?.id || 0);
    }),
        i.sort((e, t) => {
            const n = Date.parse(String(e?.calledAt || e?.updatedAt || '')),
                a = Date.parse(String(t?.calledAt || t?.updatedAt || ''));
            return Number.isFinite(n) && Number.isFinite(a) && n !== a
                ? a - n
                : Number(t?.id || 0) - Number(e?.id || 0);
        }));
    const o = { 1: null, 2: null };
    for (const e of i) {
        const t = Number(e?.assignedConsultorio || 0);
        (1 !== t && 2 !== t) || o[String(t)] || (o[String(t)] = e);
    }
    return {
        updatedAt: String(t || '').trim() || new Date().toISOString(),
        waitingCount: a.length,
        calledCount: i.length,
        counts: {
            waiting: a.length,
            called: i.length,
            completed: n.filter(
                (e) => 'completed' === String(e?.status || '').toLowerCase()
            ).length,
            no_show: n.filter(
                (e) => 'no_show' === String(e?.status || '').toLowerCase()
            ).length,
            cancelled: n.filter(
                (e) => 'cancelled' === String(e?.status || '').toLowerCase()
            ).length,
        },
        callingNowByConsultorio: o,
        nextTickets: a
            .slice(0, 10)
            .map((e, t) => ({
                id: Number(e?.id || 0),
                ticketCode: String(e?.ticketCode || '--'),
                patientInitials: String(e?.patientInitials || '--'),
                queueType: String(e?.queueType || 'walk_in'),
                priorityClass: String(e?.priorityClass || 'walk_in'),
                position: t + 1,
                createdAt:
                    String(e?.createdAt || '').trim() ||
                    new Date().toISOString(),
            })),
    };
}
function sa(e) {
    return (
        { waiting: 0, called: 1, completed: 2, no_show: 3, cancelled: 4 }[
            String(e || '').toLowerCase()
        ] ?? 9
    );
}
function ca(e) {
    return (
        { appt_overdue: 0, appt_current: 1, walk_in: 2 }[
            String(e || '').toLowerCase()
        ] ?? 9
    );
}
function la(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return $n.includes(t) ? t : 'all';
}
function ua(e) {
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
function da(e) {
    if ('waiting' !== String(e?.status || '').toLowerCase()) return !1;
    const t = ua(e);
    return Number.isFinite(t) && t >= 20;
}
function ma(e) {
    return String(e || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
function pa() {
    const e =
        ((t = Array.isArray(s) ? s : []),
        [...t].sort((e, t) => {
            const n = sa(e?.status) - sa(t?.status);
            if (0 !== n) return n;
            const a = ca(e?.priorityClass) - ca(t?.priorityClass);
            if (0 !== a) return a;
            const i = ua(e),
                o = ua(t);
            if (Number.isFinite(i) && Number.isFinite(o) && i !== o)
                return o - i;
            const r = Date.parse(String(e?.createdAt || '')),
                s = Date.parse(String(t?.createdAt || ''));
            return Number.isFinite(r) && Number.isFinite(s) && r !== s
                ? r - s
                : Number(e?.id || 0) - Number(t?.id || 0);
        }));
    var t;
    const n = la(In.activeFilter),
        a = String(In.searchTerm || ''),
        i = e.filter(
            (e) =>
                (function (e, t) {
                    const n = la(t),
                        a = String(e?.status || '').toLowerCase(),
                        i = String(e?.queueType || '').toLowerCase();
                    return (
                        'all' === n ||
                        ('waiting' === n
                            ? 'waiting' === a
                            : 'called' === n
                              ? 'called' === a
                              : 'sla_risk' === n
                                ? da(e)
                                : 'appointments' === n
                                  ? 'appointment' === i
                                  : 'walk_in' !== n || 'walk_in' === i)
                    );
                })(e, n) &&
                (function (e, t) {
                    const n = ma(t);
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
                            .map((e) => ma(e))
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
        c = e.filter((e) => da(e)).length;
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
function fa(e) {
    const t = String(e || '').toLowerCase();
    return Tn[t] || 'Accion';
}
function ga(e, t) {
    const n = String(e || '').toLowerCase();
    return Ln.includes(n)
        ? (Array.isArray(t?.tickets) ? t.tickets : []).filter((e) =>
              (function (e, t) {
                  const n = String(e || '').toLowerCase(),
                      a = String(t || '').toLowerCase();
                  return !(
                      !An.has(a) ||
                      ('completar' === n
                          ? 'called' !== a && 'waiting' !== a
                          : ('no_show' !== n && 'cancelar' !== n) ||
                            ('called' !== a && 'waiting' !== a))
                  );
              })(n, e?.status)
          )
        : [];
}
function ba(e) {
    if (!e || 'object' != typeof e) return;
    const t = Number(e.id || 0);
    if (!t) return;
    const n = Array.isArray(s) ? [...s] : [],
        a = n.findIndex((e) => Number(e?.id || 0) === t);
    (a >= 0 ? (n[a] = { ...n[a], ...e }) : n.push(e), y(n));
}
function ya(e) {
    return String(e?.message || 'Error desconocido');
}
async function ha(e) {
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
function va(e) {
    const t = ya(e)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return t.includes('consultorio') && t.includes('ocupado');
}
function Sa(e, t = '') {
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
function ka(e) {
    return document.querySelector(
        `#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${e}"]`
    );
}
function wa(e, t) {
    const n = ka(e),
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
            const o = ka(e);
            return (
                o?.parentElement === a && o.nextSibling
                    ? a.insertBefore(i, o.nextSibling)
                    : a.appendChild(i),
                i
            );
        })(e),
        i = `Consultorio ${e}`,
        o = Boolean(t && t.id),
        r = In.pendingCallByConsultorio.has(String(e));
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
function Ca(e) {
    const t = {
        all: 'Todos',
        waiting: 'En espera',
        called: 'Llamados',
        sla_risk: 'SLA +20m',
        appointments: 'Cita',
        walk_in: 'Walk-in',
    };
    return t[la(e)] || t.all;
}
function Ea() {
    const e = document.querySelector('#queue .queue-admin-shell');
    if (!(e instanceof HTMLElement)) return;
    let t = document.getElementById('queueTriageToolbar');
    if (!(t instanceof HTMLElement)) {
        ((t = document.createElement('section')),
            (t.id = 'queueTriageToolbar'),
            (t.className = 'queue-triage-toolbar'),
            (t.innerHTML = `\n            <div class="queue-triage-filters" role="group" aria-label="Filtros de turnero">\n                ${$n.map((e) => `\n                        <button\n                            type="button"\n                            class="btn btn-secondary btn-sm queue-triage-filter"\n                            data-queue-filter="${e}"\n                        >\n                            ${C(Ca(e))}\n                        </button>\n                    `).join('')}\n            </div>\n            <div class="queue-triage-search-wrap">\n                <input\n                    id="queueSearchInput"\n                    class="queue-triage-search"\n                    type="search"\n                    inputmode="search"\n                    autocomplete="off"\n                    placeholder="Buscar ticket, iniciales o ultimos 4"\n                    aria-label="Buscar en cola"\n                />\n                <button\n                    type="button"\n                    class="btn btn-secondary btn-sm"\n                    data-action="queue-clear-search"\n                >\n                    Limpiar\n                </button>\n            </div>\n            <div class="queue-triage-filters" role="group" aria-label="Acciones masivas sobre tickets visibles">\n                ${Ln.map((e) => `\n                        <button\n                            type="button"\n                            class="btn btn-secondary btn-sm"\n                            data-action="queue-bulk-action"\n                            data-queue-action="${e}"\n                        >\n                            ${C(fa(e))}\n                        </button>\n                    `).join('')}\n                <button\n                    type="button"\n                    class="btn btn-secondary btn-sm"\n                    data-action="queue-bulk-reprint"\n                >\n                    Reimprimir visibles\n                </button>\n            </div>\n            <p id="queueTriageSummary" class="queue-triage-summary" role="status" aria-live="polite">Sin datos de cola</p>\n            <p class="queue-triage-summary">\n                Atajos: Alt+Shift+J (C1), Alt+Shift+K (C2), Alt+Shift+F (buscar), Alt+Shift+L (SLA), Alt+Shift+U (refrescar), Alt+Shift+P (reimprimir visibles), Alt+Shift+W/C/A/I (estado), Numpad Enter / + / . / - / 0 (estación)\n            </p>\n        `));
        const n = e.querySelector('.queue-admin-kpis');
        n?.parentElement === e ? e.insertBefore(t, n) : e.appendChild(t);
    }
    const n = document.getElementById('queueSearchInput');
    (n instanceof HTMLInputElement &&
        n.value !== String(In.searchTerm || '') &&
        (n.value = String(In.searchTerm || '')),
        In.triageControlsBound ||
            ((In.triageControlsBound = !0),
            t.addEventListener('click', (e) => {
                const t = e.target.closest('[data-queue-filter]');
                if (t instanceof HTMLElement)
                    return (
                        (In.activeFilter = la(t.dataset.queueFilter || 'all')),
                        void _a()
                    );
                const n = e.target.closest('[data-action="queue-bulk-action"]');
                n instanceof HTMLElement
                    ? Na(n.dataset.queueAction || '')
                    : e.target.closest(
                            '[data-action="queue-bulk-reprint"]'
                        ) instanceof HTMLElement
                      ? Da()
                      : e.target.closest(
                            '[data-action="queue-clear-search"]'
                        ) instanceof HTMLElement &&
                        ((In.searchTerm = ''), _a());
            }),
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    ((In.searchTerm = n.value || ''), _a());
                })));
}
function qa() {
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
        s && (s.textContent = Xn(e.updatedAt)));
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
        wa(1, l),
        wa(2, u),
        r)
    ) {
        const t = Array.isArray(e.nextTickets) ? e.nextTickets : [],
            n = Pn();
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
function _a() {
    (Ea(), Vn());
    const e = pa();
    ((In.lastViewState = e),
        (function (e) {
            const t = document.getElementById('queueTriageToolbar');
            if (!(t instanceof HTMLElement)) return;
            const n = la(e?.activeFilter || 'all');
            t.querySelectorAll('[data-queue-filter]').forEach((e) => {
                if (!(e instanceof HTMLButtonElement)) return;
                const t = la(e.dataset.queueFilter || '') === n;
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
                            a = ga(n, e).length,
                            i = fa(n);
                        ((t.textContent = `${i} visibles (${a})`),
                            (t.disabled = In.bulkActionInFlight || 0 === a),
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
                        In.bulkReprintInFlight ||
                        In.bulkActionInFlight ||
                        0 === t),
                    i.setAttribute('aria-disabled', String(i.disabled)));
            }
            const o = document.getElementById('queueTriageSummary');
            if (o instanceof HTMLElement) {
                const t = Number(e?.tickets?.length || 0),
                    n = Number(e?.totalCount || 0),
                    a = Number(e?.riskCount || 0),
                    i = Number(e?.waitingCount || 0),
                    r = Pn();
                let s = '';
                (In.bulkActionInFlight
                    ? (s = ' · ejecutando accion masiva...')
                    : In.bulkReprintInFlight &&
                      (s = ' · reimprimiendo tickets visibles...'),
                    r?.partial &&
                        (s += ` · fallback parcial ${r.sampledCount}/${r.knownCount}`),
                    (o.textContent = `${t}/${n} visibles · ${i} en espera · ${a} en riesgo SLA${s}`));
            }
        })(e),
        qa(),
        aa(),
        (function (e) {
            const t = document.getElementById('queueTableBody');
            if (!t) return;
            const n = Array.isArray(e?.tickets) ? e.tickets : [];
            if (0 === n.length) {
                const n = Number(e?.totalCount || 0),
                    a = la(e?.activeFilter || 'all'),
                    i = String(e?.searchTerm || '').trim(),
                    o = Pn();
                let r = 'Sin tickets en cola.';
                if (n > 0 && ('all' !== a || '' !== i)) {
                    const e = [];
                    ('all' !== a && e.push(`filtro "${Ca(a)}"`),
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
                        o = _n.has(n),
                        r = !o,
                        s = !o,
                        c = In.reprintInFlightIds.has(String(t)),
                        l = ua(e),
                        u = da(e),
                        d = u ? 'queue-row-risk' : '',
                        m = Number.isFinite(l) ? `${l}m` : '--';
                    return `\n                <tr class="${d}">\n                    <td>${C(e.ticketCode || '--')}</td>\n                    <td>${C(e.queueType || '--')}</td>\n                    <td>${C(qn[e.priorityClass] || e.priorityClass || '--')}</td>\n                    <td class="queue-status-cell">\n                        <span>${C(Cn[n] || n)}</span>\n                        ${u ? '<small class="queue-risk-note">SLA > 20m</small>' : ''}\n                    </td>\n                    <td>${C(e.assignedConsultorio || '-')}</td>\n                    <td>\n                        <span>${C(Xn(e.createdAt))}</span>\n                        <small class="queue-wait-note">Espera: ${C(m)}</small>\n                    </td>\n                    <td>${C(e.patientInitials || '--')}</td>\n                    <td>\n                        <div class="queue-actions">\n                            <button\n                                type="button"\n                                class="btn btn-secondary btn-sm"\n                                data-action="queue-reprint-ticket"\n                                data-queue-id="${t}"\n                                ${c ? 'disabled aria-disabled="true"' : ''}\n                            >\n                                ${c ? 'Reimprimiendo...' : 'Reimprimir'}\n                            </button>\n                            ${a ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${t}">\n                                Re-llamar\n                            </button>` : ''}\n                            ${i ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${t}">\n                                Liberar\n                            </button>` : ''}\n                            ${r ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${t}">\n                                Completar\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${t}">\n                                No show\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${t}">\n                                Cancelar\n                            </button>` : ''}\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C1\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C2\n                            </button>\n                        </div>\n                    </td>\n                </tr>\n            `;
                })
                .join('');
        })(e));
    const t = document.querySelector('#queue .queue-admin-table-wrap');
    t instanceof HTMLElement &&
        t.setAttribute(
            'aria-busy',
            String(In.bulkActionInFlight || In.bulkReprintInFlight)
        );
}
async function Aa() {
    if (!In.realtimeEnabled) return;
    if (!La()) return (Wn('paused', 'Cola en pausa'), void Qn());
    if (document.hidden)
        return (Wn('paused', 'Cola en pausa (pestana oculta)'), void Yn());
    if (!1 === navigator.onLine)
        return (
            (In.realtimeFailureStreak += 1),
            Wn('offline', 'Sin conexion al backend', {
                log: !0,
                level: 'warning',
                reason: 'Realtime',
            }),
            void Yn()
        );
    if (In.realtimeRequestInFlight) return void Yn();
    In.realtimeRequestInFlight = !0;
    const e = await $a({ silent: !0, fromRealtime: !0 });
    if (((In.realtimeRequestInFlight = !1), e && 'live' === In.lastRefreshMode))
        ((In.realtimeFailureStreak = 0),
            Wn('live', 'Cola en vivo', {
                log: !0,
                level: 'info',
                reason: 'Realtime',
            }),
            Gn({ log: !0 }));
    else if (
        !e ||
        ('snapshot' !== In.lastRefreshMode &&
            'state_fallback' !== In.lastRefreshMode)
    )
        ((In.realtimeFailureStreak += 1),
            Wn(
                'reconnecting',
                `Reintentando en ${Math.max(1, Math.ceil(Jn() / 1e3))}s`,
                { log: !0, level: 'warning', reason: 'Realtime' }
            ));
    else {
        In.realtimeFailureStreak += 1;
        const e = Math.max(1, Math.ceil(Jn() / 1e3));
        Wn(
            'reconnecting',
            'state_fallback' === In.lastRefreshMode
                ? `Cola visible (fallback) · reconectando en ${e}s`
                : `Respaldo local activo · reconectando en ${e}s`,
            { log: !0, level: 'warning', reason: 'Realtime' }
        );
    }
    Yn();
}
function La() {
    return (
        'queue' === document.querySelector('.nav-item.active')?.dataset.section
    );
}
async function Ta({
    fromRealtime: e = !1,
    silent: t = !1,
    reason: n = 'data_error',
} = {}) {
    try {
        const a = await k('queue-state'),
            i = xn(a?.data || {});
        return (
            y(oa(i, s)),
            h(ia(i)),
            Fn(i, { reason: n }),
            (In.lastRefreshMode = 'state_fallback'),
            Rn('sync_fallback_queue_state', {
                source: e ? 'realtime' : 'manual',
                reason: String(n || 'data_error'),
                queueCount: Number(i.waitingCount || 0),
            }),
            _a(),
            !t &&
                La() &&
                Wn(
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
async function $a({ silent: e = !1, fromRealtime: t = !1 } = {}) {
    try {
        const n = (await k('data')).data || {},
            a =
                n.queueState && 'object' == typeof n.queueState
                    ? n.queueState
                    : n.queue_state && 'object' == typeof n.queue_state
                      ? n.queue_state
                      : null,
            i = Array.isArray(n.queue_tickets)
                ? n.queue_tickets
                : Array.isArray(n.queueTickets)
                  ? n.queueTickets
                  : Array.isArray(a?.queue_tickets)
                    ? a.queue_tickets
                    : Array.isArray(a?.queueTickets)
                      ? a.queueTickets
                      : Array.isArray(a?.tickets)
                        ? a.tickets
                        : null,
            o = Array.isArray(i),
            r = o && 0 === i.length,
            l =
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : n.queue_meta && 'object' == typeof n.queue_meta
                      ? n.queue_meta
                      : a && 'object' == typeof a
                        ? a
                        : null,
            u = l ? ia(l) : null;
        let d = o ? oa({ queue_tickets: i }, s) : [],
            m = !1;
        if ((!o || r) && u) {
            const e = Number(u.waitingCount || 0) + Number(u.calledCount || 0);
            e > 0 &&
                ((d = oa(u, s)),
                Fn(u, { reason: 'data_missing_queue_tickets_meta' }),
                (m = !0),
                Rn('sync_fallback_queue_meta', {
                    source: t ? 'realtime' : 'manual',
                    queueCount: e,
                }));
        }
        const p = Array.isArray(s)
                ? s.filter((e) => An.has(String(e?.status || '').toLowerCase()))
                      .length
                : 0,
            f = u
                ? Number(u.waitingCount || 0) + Number(u.calledCount || 0)
                : 0;
        if (
            r &&
            !m &&
            p > 0 &&
            0 === f &&
            (await Ta({
                silent: e,
                fromRealtime: t,
                reason: 'data_empty_queue_tickets',
            }))
        )
            return !0;
        if (
            (!o || r) &&
            0 === d.length &&
            (await Ta({
                silent: e,
                fromRealtime: t,
                reason: 'data_missing_queue_tickets',
            }))
        )
            return !0;
        (y(d),
            h(u || ra(d, n?.updatedAt || new Date().toISOString())),
            m || Hn(),
            (In.lastRefreshMode = m ? 'state_fallback' : 'live'),
            (In.lastHealthySyncAt = Date.now()),
            (function () {
                try {
                    const e = {
                        savedAt: new Date().toISOString(),
                        data: {
                            queueTickets: Array.isArray(s) ? s : [],
                            queueMeta: c && 'object' == typeof c ? c : null,
                        },
                    };
                    localStorage.setItem(Mn, JSON.stringify(e));
                } catch (e) {}
            })(),
            Rn('sync_success', {
                source: t ? 'realtime' : 'manual',
                queueCount: d.length,
            }),
            _a());
        const g = Gn({ log: !t && La() });
        return (
            t ||
                !La() ||
                g.stale ||
                Wn('live', 'Cola sincronizada', {
                    log: !0,
                    level: 'info',
                    reason: 'Sincronizacion manual',
                }),
            !0
        );
    } catch (n) {
        if (
            await Ta({
                silent: e,
                fromRealtime: t,
                reason: 'data_request_error',
            })
        )
            return !0;
        const a = Un(zn(), { source: t ? 'realtime_error' : 'manual_error' });
        return (
            a || Hn(),
            (In.lastRefreshMode = a ? 'snapshot' : 'error'),
            a
                ? Rn('sync_fallback_snapshot', {
                      source: t ? 'realtime' : 'manual',
                  })
                : Rn('sync_failed', {
                      source: t ? 'realtime' : 'manual',
                      error: ya(n),
                  }),
            !t &&
                La() &&
                Wn(
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
function Ma({ immediate: e = !0 } = {}) {
    return (
        (In.realtimeEnabled = !0),
        (In.realtimeFailureStreak = 0),
        La()
            ? e
                ? (Wn('live', 'Sincronizando cola...'), Qn(), void Aa())
                : (Wn('live', 'Cola en vivo'), void Yn())
            : (Wn('paused', 'Cola en pausa'), void Qn())
    );
}
function Ia({ reason: e = 'paused' } = {}) {
    ((In.realtimeEnabled = !1),
        (In.realtimeFailureStreak = 0),
        (In.realtimeRequestInFlight = !1),
        Qn());
    const t = String(e || 'paused').toLowerCase();
    'offline' !== t
        ? Wn(
              'paused',
              'hidden' !== t
                  ? 'Cola en pausa'
                  : 'Cola en pausa (pestana oculta)'
          )
        : Wn('offline', 'Sin conexion al backend');
}
async function Ba(e, t, n = null, { silent: a = !1, skipRender: i = !1 } = {}) {
    try {
        const o = await (async function (e, t, n = null) {
            const a = Number(e || 0);
            if (!a || !t) throw new Error('Accion de ticket invalida');
            const i = { id: a, action: t },
                o = Number(n || 0);
            [1, 2].includes(o) && (i.consultorio = o);
            const r = await k('queue-ticket', { method: 'PATCH', body: i }),
                c = r?.data?.ticket || null;
            ba(c);
            const l =
                r?.data?.queueState ||
                r?.data?.queue_state ||
                r?.data?.queueMeta ||
                r?.data?.queue_meta ||
                null;
            return (h(l ? ia(l) : ra(s, new Date().toISOString())), c);
        })(e, t, n);
        return (
            i || _a(),
            a ||
                (Kn(Sa(t, o?.ticketCode || ''), { level: 'info' }),
                E(Sa(t, o?.ticketCode || ''), 'success')),
            Rn('ticket_action_success', {
                action: String(t || ''),
                ticketId: Number(e || 0),
                consultorio: Number(n || 0) || null,
            }),
            !0
        );
    } catch (n) {
        return va(n)
            ? (await $a({ silent: !0 }),
              a || (Kn(ya(n), { level: 'warning' }), E(ya(n), 'warning')),
              Rn('ticket_action_busy', {
                  action: String(t || ''),
                  ticketId: Number(e || 0),
                  error: ya(n),
              }),
              !1)
            : (a ||
                  (Kn(`Error al actualizar ticket: ${ya(n)}`, {
                      level: 'error',
                  }),
                  E(`No se pudo actualizar ticket: ${ya(n)}`, 'error')),
              Rn('ticket_action_failed', {
                  action: String(t || ''),
                  ticketId: Number(e || 0),
                  error: ya(n),
              }),
              !1);
    }
}
async function Na(e) {
    const t = String(e || '').toLowerCase();
    if (!Ln.includes(t))
        return (
            E('Accion masiva invalida', 'error'),
            { ok: !1, success: 0, failed: 0 }
        );
    if (En())
        return (
            Kn(`Modo práctica: bulk ${t} simulado (sin cambios reales)`, {
                level: 'info',
            }),
            E(`Modo práctica: bulk ${fa(t).toLowerCase()} simulado.`, 'info'),
            Rn('bulk_action_practice_simulated', { action: t }),
            { ok: !0, success: 0, failed: 0, simulated: !0 }
        );
    if (In.bulkActionInFlight) return { ok: !1, success: 0, failed: 0 };
    const n = ga(t, In.lastViewState || pa());
    if (0 === n.length)
        return (
            Kn(`Bulk ${t}: sin tickets visibles elegibles`, { level: 'info' }),
            E(`No hay tickets visibles para ${fa(t).toLowerCase()}.`, 'info'),
            { ok: !1, success: 0, failed: 0 }
        );
    if (
        !window.confirm(
            `Se aplicara "${fa(t)}" a ${n.length} ticket(s) visibles. Deseas continuar?`
        )
    )
        return { ok: !1, success: 0, failed: 0 };
    ((In.bulkActionInFlight = !0),
        _a(),
        Rn('bulk_action_started', { action: t, requested: n.length }));
    let a = 0,
        i = 0;
    try {
        for (const e of n)
            (await Ba(Number(e?.id || 0), t, null, {
                silent: !0,
                skipRender: !0,
            }))
                ? (a += 1)
                : (i += 1);
        await $a({ silent: !0 });
    } finally {
        ((In.bulkActionInFlight = !1), _a());
    }
    return a > 0 && 0 === i
        ? (Kn(`Bulk ${t}: ${a} ticket(s) procesados`, { level: 'info' }),
          E(`${fa(t)} aplicado a ${a} ticket(s).`, 'success'),
          Rn('bulk_action_success', { action: t, success: a, failed: i }),
          { ok: !0, success: a, failed: i })
        : a > 0
          ? (Kn(`Bulk ${t}: ${a} exitos y ${i} fallos`, { level: 'warning' }),
            E(`${fa(t)} parcial: ${a} exitos, ${i} fallos.`, 'warning'),
            Rn('bulk_action_partial', { action: t, success: a, failed: i }),
            { ok: !0, success: a, failed: i })
          : (Kn(`Bulk ${t}: fallo total`, { level: 'error' }),
            E(
                `No se pudo aplicar ${fa(t).toLowerCase()} en tickets visibles.`,
                'error'
            ),
            Rn('bulk_action_failed', { action: t, success: a, failed: i }),
            { ok: !1, success: a, failed: i });
}
async function Da() {
    if (En())
        return (
            Kn(
                'Modo práctica: reimpresión visible simulada (sin impresión real)',
                { level: 'info' }
            ),
            E('Modo práctica: reimpresión simulada.', 'info'),
            Rn('bulk_reprint_practice_simulated', {}),
            { ok: !0, success: 0, failed: 0, simulated: !0 }
        );
    if (In.bulkReprintInFlight) return { ok: !1, success: 0, failed: 0 };
    const e = In.lastViewState || pa(),
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
    ((In.bulkReprintInFlight = !0),
        _a(),
        Rn('bulk_reprint_started', { requested: n.length }));
    let a = 0,
        i = 0;
    try {
        for (const e of n) {
            const t = Number(e?.id || 0);
            if (t)
                try {
                    const e = await ha(t);
                    e.payload?.printed ? (a += 1) : (i += 1);
                } catch (e) {
                    i += 1;
                }
            else i += 1;
        }
    } finally {
        ((In.bulkReprintInFlight = !1), _a());
    }
    return a > 0 && 0 === i
        ? (Kn(`Bulk reimpresion: ${a} ticket(s) reimpresos`, { level: 'info' }),
          E(`Reimpresion completa: ${a} ticket(s).`, 'success'),
          Rn('bulk_reprint_success', { success: a, failed: i }),
          { ok: !0, success: a, failed: i })
        : a > 0
          ? (Kn(`Bulk reimpresion parcial: ${a} exitos y ${i} fallos`, {
                level: 'warning',
            }),
            E(`Reimpresion parcial: ${a} exitos, ${i} fallos.`, 'warning'),
            Rn('bulk_reprint_partial', { success: a, failed: i }),
            { ok: !0, success: a, failed: i })
          : (Kn('Bulk reimpresion: fallo total', { level: 'error' }),
            E('No se pudo reimprimir tickets visibles.', 'error'),
            Rn('bulk_reprint_failed', { success: a, failed: i }),
            { ok: !1, success: a, failed: i });
}
function xa(e) {
    ((In.activeFilter = la(e)), _a());
}
function Ha() {
    Ea();
    const e = document.getElementById('queueSearchInput');
    e instanceof HTMLInputElement &&
        (e.focus({ preventScroll: !0 }), e.select());
}
const Fa = new Map([
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
    Pa = [
        'a[href]',
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','),
    Ra = 'adminLastSection',
    ja = 'adminSidebarCollapsed',
    Oa = 'queueStationMode',
    za = 'queueStationConsultorio',
    Ua = 'queueOneTapAdvance',
    Va = 'queueCallKeyBindingV1',
    Ka = 'queueOnboardingSeenV1',
    Wa = 'queueOnboardingProgressV2',
    Ga = 'locked',
    Ja = 'free',
    Qa = new Set(['numpadenter', 'kpenter']),
    Ya = new Set(['enter', 'return']),
    Xa = new Set(['numpadadd', 'kpadd']),
    Za = new Set(['+', 'add', 'plus']),
    ei = new Set(['numpadsubtract', 'kpsubtract']),
    ti = new Set(['-', 'subtract', 'minus']),
    ni = new Set(['numpaddecimal', 'kpdecimal']),
    ai = new Set(['.', ',', 'decimal', 'separator', 'delete', 'del']),
    ii = 'queueNumpadHelpOpen',
    oi = new Set(['completar', 'no_show', 'cancelar', 'reasignar']),
    ri = 'queuePracticeCoachInlineStyles',
    si = 'queueSensitiveConfirmInlineStyles',
    ci = Object.freeze({
        completar: 'completar atencion',
        no_show: 'marcar como no_show',
        cancelar: 'cancelar ticket',
        reasignar: 'reasignar ticket',
    }),
    li = Object.freeze([
        Object.freeze({
            id: 'call_next',
            label: 'Llamar siguiente (Numpad Enter)',
        }),
        Object.freeze({
            id: 're_llamar',
            label: 'Re-llamar ticket activo (Numpad +)',
        }),
        Object.freeze({
            id: 'completar',
            label: 'Completar ticket activo (Numpad . / ,)',
        }),
        Object.freeze({ id: 'no_show', label: 'Marcar no_show (Numpad -)' }),
    ]),
    ui = Object.freeze([
        Object.freeze({
            id: 'station_locked',
            label: 'Bloquear estación en C1 o C2',
        }),
        Object.freeze({
            id: 'shortcuts_opened',
            label: 'Abrir panel de atajos numpad',
        }),
        Object.freeze({
            id: 'practice_completed',
            label: 'Completar práctica guiada (4 acciones)',
        }),
    ]),
    di = {
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
                    action: 'context-appointment-quick-filter',
                    filterValue: 'today',
                    icon: 'fa-calendar-day',
                    label: 'Filtrar hoy',
                },
                {
                    action: 'context-appointment-quick-filter',
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
                    action: 'context-callback-quick-filter',
                    filterValue: 'pending',
                    icon: 'fa-phone',
                    label: 'Pendientes',
                },
                {
                    action: 'context-callback-quick-filter',
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
let mi = 0,
    pi = 0;
const fi = { mode: Ja, consultorio: 1, oneTapAdvance: !1 },
    gi = {
        helpOpen: !1,
        onboardingVisible: !1,
        onboardingProgress: null,
        practiceMode: !1,
        practiceTickId: 0,
        practiceState: null,
        oneTapInFlight: !1,
        lastOneTapAt: 0,
        customCallKey: null,
        captureCallKeyMode: !1,
        pendingSensitiveAction: null,
        pendingSensitiveActionBusy: !1,
    };
function bi(e, t = {}) {
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
function yi(e, t = !1) {
    try {
        const n = localStorage.getItem(e);
        return null === n ? Boolean(t) : '1' === n || 'true' === n;
    } catch (e) {
        return Boolean(t);
    }
}
function hi(e, t) {
    try {
        localStorage.setItem(e, t ? '1' : '0');
    } catch (e) {}
}
function vi() {
    const e = {};
    return (
        ui.forEach((t) => {
            e[t.id] = !1;
        }),
        e
    );
}
function Si(e) {
    const t = vi();
    return e && 'object' == typeof e
        ? (ui.forEach((n) => {
              t[n.id] = Boolean(e[n.id]);
          }),
          t)
        : t;
}
function ki() {
    return (
        gi.onboardingProgress || (gi.onboardingProgress = vi()),
        gi.onboardingProgress
    );
}
function wi() {
    const e = ki();
    return ui.reduce((t, n) => (e[n.id] ? t + 1 : t), 0);
}
function Ci() {
    const e = document.getElementById('queueOnboardingChecklist'),
        t = document.getElementById('queueOnboardingProgressPill'),
        n = document.getElementById('queueOnboardingMeta'),
        a = ki(),
        i = ui.length,
        o = wi();
    (e instanceof HTMLElement &&
        (e.innerHTML = ui
            .map(
                (e) =>
                    `<li class="queue-practice-step${Boolean(a[e.id]) ? ' is-done' : ''}">${e.label}</li>`
            )
            .join('')),
        t instanceof HTMLElement && (t.textContent = `${o}/${i}`),
        n instanceof HTMLElement &&
            (n.textContent =
                o >= i
                    ? 'Checklist completado. Puedes cerrar la guía o iniciar práctica cuando quieras.'
                    : `Paso ${Math.min(i, o + 1)} de ${i}. Completa los pasos para dejar esta estación lista.`));
}
function Ei(e, { source: t = 'manual', announce: n = !1 } = {}) {
    const a = String(e || '')
        .trim()
        .toLowerCase();
    if (!a) return !1;
    if (!ui.some((e) => e.id === a)) return !1;
    const i = ki();
    if (i[a]) return !1;
    ((i[a] = !0),
        (function (e) {
            try {
                localStorage.setItem(Wa, JSON.stringify(Si(e)));
            } catch (e) {}
        })(i),
        Ci());
    const o = wi(),
        r = ui.length;
    return (
        bi('onboarding_step_completed', {
            source: t,
            stepId: a,
            completedCount: o,
            totalSteps: r,
        }),
        n &&
            E(
                o >= r
                    ? 'Checklist de guía completado.'
                    : `Guía: paso ${o}/${r} completado.`,
                o >= r ? 'success' : 'info'
            ),
        !0
    );
}
function qi() {
    return document.getElementById('queueShortcutPanel');
}
function _i(e) {
    const t = to(e);
    if (!t) return 'Numpad Enter';
    const { code: n, key: a, location: i } = t;
    return 'numpadenter' === n || 'kpenter' === n
        ? 'Numpad Enter'
        : ('enter' !== a && 'return' !== a) || 3 !== i
          ? 'enter' === a || 'return' === a
              ? 'Enter externo'
              : a && 3 === i
                ? `${a.toUpperCase()} (numpad)`
                : a
                  ? 1 === a.length
                      ? a.toUpperCase()
                      : a
                  : n || 'Tecla externa'
          : 'Enter (numpad)';
}
function Ai() {
    const e = qi(),
        t = document.querySelector('[data-action="queue-toggle-shortcuts"]');
    (e instanceof HTMLElement &&
        ((e.hidden = !gi.helpOpen),
        e.setAttribute('aria-hidden', String(!gi.helpOpen))),
        t instanceof HTMLButtonElement &&
            (t.setAttribute('aria-pressed', String(gi.helpOpen)),
            (t.textContent = gi.helpOpen ? 'Ocultar atajos' : 'Atajos numpad')),
        (function () {
            const e = qi();
            if (!(e instanceof HTMLElement)) return;
            const t = e.querySelector('ul');
            if (!(t instanceof HTMLElement)) return;
            let n = t.querySelector('[data-queue-one-tap-hint]');
            n instanceof HTMLLIElement ||
                ((n = document.createElement('li')),
                (n.dataset.queueOneTapHint = '1'),
                t.appendChild(n));
            const a = eo(fi.oneTapAdvance, !1);
            n.innerHTML = a
                ? '<strong>Modo 1 tecla:</strong> activo. Numpad Enter completa ticket activo y llama siguiente.'
                : '<strong>Modo 1 tecla:</strong> desactivado. Flujo recomendado: Numpad . y luego Numpad Enter.';
        })(),
        (function () {
            const e = qi();
            if (!(e instanceof HTMLElement)) return;
            const t = e.querySelector('ul');
            if (!(t instanceof HTMLElement)) return;
            let n = t.querySelector('[data-queue-call-key-hint]');
            if (
                (n instanceof HTMLLIElement ||
                    ((n = document.createElement('li')),
                    (n.dataset.queueCallKeyHint = '1'),
                    t.appendChild(n)),
                gi.customCallKey)
            ) {
                const e = _i(gi.customCallKey);
                n.innerHTML = '';
                const t = document.createElement('strong');
                ((t.textContent = 'Tecla externa activa:'),
                    n.appendChild(t),
                    n.append(` ${e} (capturada en esta estación)`));
            } else
                n.innerHTML =
                    '<strong>Tecla externa:</strong> opcional. Usa "Calibrar tecla externa" si tu numpad inalámbrico no envía Numpad Enter.';
        })());
}
function Li(e, { announce: t = !1, source: n = 'manual' } = {}) {
    ((gi.helpOpen = Boolean(e)),
        hi(ii, gi.helpOpen),
        Ai(),
        gi.helpOpen && Ei('shortcuts_opened', { source: n, announce: !1 }),
        bi('shortcut_panel_toggled', { source: n, open: gi.helpOpen }),
        t &&
            E(
                gi.helpOpen
                    ? 'Panel de atajos numpad visible'
                    : 'Panel de atajos numpad oculto',
                'info'
            ));
}
function Ti({ source: e = 'manual', announce: t = !0 } = {}) {
    Li(!gi.helpOpen, { source: e, announce: t });
}
function $i() {
    return document.getElementById('queueOnboardingPanel');
}
function Mi() {
    const e = {};
    return (
        li.forEach((t) => {
            e[t.id] = !1;
        }),
        {
            startedAt: Date.now(),
            lastActionAt: 0,
            actionsCount: 0,
            completed: e,
            completedAt: 0,
        }
    );
}
function Ii() {
    const e = gi.practiceState;
    return e && e.completed && 'object' == typeof e.completed
        ? li.reduce((t, n) => (e.completed[n.id] ? t + 1 : t), 0)
        : 0;
}
function Bi() {
    gi.practiceTickId &&
        (window.clearInterval(gi.practiceTickId), (gi.practiceTickId = 0));
}
function Ni() {
    const e = (function () {
        let e = document.getElementById('queuePracticeCoachPanel');
        if (e instanceof HTMLElement) return e;
        if (!(document.getElementById('queue') instanceof HTMLElement))
            return null;
        const t = $i();
        return t instanceof HTMLElement
            ? ((function () {
                  if (document.getElementById(ri)) return;
                  const e = document.createElement('style');
                  ((e.id = ri),
                      (e.textContent =
                          "\n        #queue .queue-practice-coach {\n            margin-top: 0.75rem;\n            border: 1px solid var(--admin-border, #d8e1f0);\n            border-radius: 16px;\n            padding: 0.9rem 1rem;\n            background: linear-gradient(160deg, #f6f9ff, #ffffff);\n        }\n        #queue .queue-practice-coach-header {\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            gap: 0.6rem;\n            margin-bottom: 0.48rem;\n        }\n        #queue .queue-practice-coach-header h4 {\n            margin: 0;\n            font-size: 1rem;\n        }\n        #queue .queue-practice-progress {\n            font-size: 0.86rem;\n            font-weight: 700;\n            color: #1f4f9f;\n            background: #eaf2ff;\n            border-radius: 999px;\n            padding: 0.15rem 0.55rem;\n        }\n        #queue .queue-practice-meta {\n            margin: 0 0 0.5rem;\n            color: #4f5d73;\n            font-size: 0.9rem;\n        }\n        #queue .queue-practice-steps {\n            margin: 0;\n            padding-left: 1.1rem;\n            display: grid;\n            gap: 0.3rem;\n        }\n        #queue .queue-practice-step.is-done {\n            color: #0d7a4a;\n            font-weight: 600;\n        }\n        #queue .queue-practice-step.is-done::marker {\n            content: '✓ ';\n            color: #0d7a4a;\n        }\n        #queue .queue-practice-actions {\n            margin-top: 0.62rem;\n            display: flex;\n            justify-content: flex-end;\n        }\n        #queue .queue-onboarding-header {\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            gap: 0.6rem;\n            margin-bottom: 0.35rem;\n        }\n        #queue .queue-onboarding-panel .queue-practice-meta {\n            margin: 0 0 0.5rem;\n        }\n        #queue .queue-onboarding-panel .queue-practice-steps {\n            margin: 0 0 0.55rem;\n            padding-left: 1.1rem;\n            display: grid;\n            gap: 0.3rem;\n        }\n    "),
                      document.head.appendChild(e));
              })(),
              (e = document.createElement('section')),
              (e.id = 'queuePracticeCoachPanel'),
              (e.className = 'queue-practice-coach'),
              e.setAttribute('aria-label', 'Práctica guiada turnero'),
              (e.hidden = !0),
              (e.innerHTML = `\n        <div class="queue-practice-coach-header">\n            <h4>Práctica guiada</h4>\n            <span id="queuePracticeProgressPill" class="queue-practice-progress">0/${li.length}</span>\n        </div>\n        <p id="queuePracticeMeta" class="queue-practice-meta">\n            Activa práctica para ensayar sin afectar la cola real.\n        </p>\n        <ol id="queuePracticeStepsList" class="queue-practice-steps"></ol>\n        <div class="queue-practice-actions">\n            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reset-practice">\n                Reiniciar práctica\n            </button>\n        </div>\n    `),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    })();
    if (!(e instanceof HTMLElement)) return;
    const t = Boolean(gi.practiceMode);
    if (((e.hidden = !t), !t)) return;
    const n = Ii(),
        a = li.length,
        i = document.getElementById('queuePracticeProgressPill');
    i instanceof HTMLElement && (i.textContent = `${n}/${a}`);
    const o = document.getElementById('queuePracticeMeta');
    if (o instanceof HTMLElement) {
        const e = gi.practiceState,
            t = Number(e?.actionsCount || 0),
            i = (function () {
                const e = gi.practiceState;
                if (!e || !Number.isFinite(e.startedAt) || e.startedAt <= 0)
                    return '00:00';
                const t = Math.max(
                    0,
                    Math.floor((Date.now() - Number(e.startedAt || 0)) / 1e3)
                );
                return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            })();
        o.textContent =
            n >= a
                ? `Práctica completada en ${i}. Acciones simuladas: ${t}.`
                : `Paso ${Math.min(a, n + 1)} de ${a}. Tiempo: ${i}.`;
    }
    !(function () {
        const e = document.getElementById('queuePracticeStepsList');
        if (!(e instanceof HTMLElement)) return;
        const t = gi.practiceState?.completed || {};
        e.innerHTML = li
            .map(
                (e) =>
                    `<li class="queue-practice-step${Boolean(t[e.id]) ? ' is-done' : ''}">${e.label}</li>`
            )
            .join('');
    })();
}
function Di(
    e,
    { source: t = 'manual', consultorio: n = null, ticketId: a = null } = {}
) {
    if (!gi.practiceMode) return;
    gi.practiceState || (gi.practiceState = Mi());
    const i = gi.practiceState;
    ((i.actionsCount = Number(i.actionsCount || 0) + 1),
        (i.lastActionAt = Date.now()));
    const o = (function (e) {
        const t = (function (e) {
            return String(e || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/-/g, '_');
        })(e);
        return t
            ? 'call_next' === t || 'callnext' === t
                ? 'call_next'
                : 're_llamar' === t || 'rellamar' === t
                  ? 're_llamar'
                  : 'completar' === t || 'bulk_completar' === t
                    ? 'completar'
                    : 'no_show' === t || 'bulk_no_show' === t
                      ? 'no_show'
                      : ''
            : '';
    })(e);
    let r = !1;
    o && !i.completed[o] && ((i.completed[o] = !0), (r = !0));
    const s = Ii(),
        c = li.length,
        l = s >= c;
    (l && !i.completedAt && (i.completedAt = Date.now()),
        Ni(),
        l && Ei('practice_completed', { source: t, announce: !1 }),
        bi('practice_action_simulated', {
            source: t,
            action: e,
            stepId: o || null,
            stepCompleted: r,
            completedCount: s,
            totalSteps: c,
            consultorio: n,
            ticketId: a,
            finished: l,
        }),
        r &&
            E(
                l
                    ? 'Práctica completada. Lista para operación real.'
                    : `Práctica: paso ${s}/${c} completado.`,
                l ? 'success' : 'info'
            ));
}
function xi({ source: e = 'manual', announce: t = !1 } = {}) {
    ((gi.practiceState = Mi()),
        Ni(),
        bi('practice_progress_reset', { source: e, totalSteps: li.length }),
        t && E('Práctica reiniciada desde el paso 1.', 'info'));
}
function Hi() {
    const e = Boolean(gi.practiceMode),
        t = document.getElementById('queuePracticeModeBadge');
    t instanceof HTMLElement && (t.hidden = !e);
    const n = document.querySelector('[data-action="queue-stop-practice"]');
    (n instanceof HTMLButtonElement && (n.hidden = !e), Ni());
}
function Fi(e, { source: t = 'manual' } = {}) {
    ((gi.practiceMode = Boolean(e)),
        gi.practiceMode
            ? (xi({ source: t, announce: !1 }),
              Bi(),
              (gi.practiceTickId = window.setInterval(() => {
                  gi.practiceMode ? Ni() : Bi();
              }, 1e3)))
            : (Bi(), (gi.practiceState = null)));
    try {
        window.__PIEL_QUEUE_PRACTICE_MODE = gi.practiceMode;
    } catch (e) {}
    (Hi(),
        bi(
            gi.practiceMode
                ? 'practice_mode_enabled'
                : 'practice_mode_disabled',
            { source: t, stationMode: fi.mode, consultorio: fi.consultorio }
        ));
}
function Pi(
    e,
    { source: t = 'manual', consultorio: n = null, ticketId: a = null } = {}
) {
    (E(`Modo práctica: "${e}" simulado${n ? ` en C${n}` : ''}.`, 'info'),
        Di(e, { source: t, consultorio: n, ticketId: a }));
}
function Ri(e, { persist: t = !1, source: n = 'manual' } = {}) {
    const a = $i(),
        i = Boolean(e);
    ((gi.onboardingVisible = i),
        a instanceof HTMLElement &&
            ((a.hidden = !i), a.setAttribute('aria-hidden', String(!i))),
        !i && t && hi(Ka, !0),
        Ci(),
        Ni(),
        bi(i ? 'onboarding_opened' : 'onboarding_closed', { source: n }));
}
function ji() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function Oi(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(ji().map((e) => e.dataset.section)).has(n) ? n : t;
}
function zi() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? Oi(e, 'dashboard')
        : (function () {
              try {
                  return Oi(localStorage.getItem(Ra), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function Ui() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        zi() ||
        'dashboard'
    );
}
function Vi() {
    return window.innerWidth <= 1024;
}
function Ki() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Wi() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function Gi(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function Ji(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!Vi() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        Gi(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(ja, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function Qi() {
    Vi()
        ? Ji(!1, { persist: !1 })
        : Ji(
              (function () {
                  try {
                      return '1' === localStorage.getItem(ja);
                  } catch (e) {
                      return !1;
                  }
              })(),
              { persist: !1 }
          );
}
function Yi(e) {
    const t = Oi(e, 'dashboard');
    (ji().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = Oi(e, 'dashboard');
            try {
                localStorage.setItem(Ra, t);
            } catch (e) {}
        })(t));
}
function Xi(e, t = Ja) {
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return n === Ga || n === Ja ? n : t;
}
function Zi(e, t = 1) {
    const n = Number(e || 0);
    return 1 === n || 2 === n ? n : t;
}
function eo(e, t = !1) {
    if ('boolean' == typeof e) return e;
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return (
        !!['1', 'true', 'yes', 'on', 'enabled'].includes(n) ||
        (!['0', 'false', 'no', 'off', 'disabled'].includes(n) && Boolean(t))
    );
}
function to(e, t = null) {
    if (!e || 'object' != typeof e) return t;
    const n = String(e.code || '')
            .trim()
            .toLowerCase(),
        a = String(e.key || '')
            .trim()
            .toLowerCase(),
        i = Number(e.location),
        o = Number.isFinite(i) ? Math.max(0, Math.min(3, Math.round(i))) : null;
    return n || a ? { code: n, key: a, location: o } : t;
}
function no(e, t) {
    try {
        (localStorage.setItem(Oa, Xi(e, Ja)),
            localStorage.setItem(za, String(Zi(t, 1))));
    } catch (e) {}
}
function ao(e) {
    try {
        localStorage.setItem(Ua, e ? '1' : '0');
    } catch (e) {}
}
function io() {
    return fi.mode === Ga;
}
function oo() {
    const e = document.getElementById('queue');
    if (!(e instanceof HTMLElement)) return;
    const t = Xi(fi.mode, Ja),
        n = Zi(fi.consultorio, 1),
        a = eo(fi.oneTapAdvance, !1),
        i = to(gi.customCallKey, null),
        o = Boolean(gi.captureCallKeyMode);
    ((e.dataset.stationMode = t),
        (e.dataset.stationConsultorio = String(n)),
        (e.dataset.oneTapAdvance = a ? '1' : '0'),
        (e.dataset.customCallKey = i ? '1' : '0'),
        (e.dataset.captureCallKeyMode = o ? '1' : '0'));
    const r = document.getElementById('queueStationBadge');
    r instanceof HTMLElement &&
        ((r.textContent = `Estación C${n}`),
        (r.dataset.consultorio = String(n)));
    const s = document.getElementById('queueStationModeBadge');
    if (s instanceof HTMLElement) {
        const e = t === Ga;
        ((s.dataset.mode = e ? Ga : Ja),
            (s.textContent = e ? 'Bloqueado' : 'Libre'));
    }
    const c = document.getElementById('queueStationHint');
    if (c instanceof HTMLElement) {
        let e =
            t === Ga
                ? a
                    ? `Modo 1 tecla activo: Numpad Enter completa ticket activo y llama siguiente en C${n}.`
                    : `Numpad Enter llama en C${n}. Numpad . completa, Numpad - no_show y Numpad + re-llama.`
                : a
                  ? 'Modo libre + 1 tecla: Numpad 1/2 elige consultorio y Numpad Enter completa + llama.'
                  : 'Modo libre: Numpad 1/2 selecciona consultorio, Numpad Enter llama y Numpad 0 abre ayuda.';
        (i && (e += ` Tecla externa activa: ${_i(i)}.`),
            o &&
                (e +=
                    ' Calibración en curso: presiona la tecla deseada o Esc para cancelar.'),
            gi.pendingSensitiveAction &&
                (e +=
                    ' Accion sensible pendiente: Numpad Enter confirma y Esc cancela.'),
            (c.textContent = e));
    }
    document
        .querySelectorAll('[data-action="queue-lock-station"]')
        .forEach((e) => {
            if (!(e instanceof HTMLButtonElement)) return;
            const a = Zi(e.dataset.queueConsultorio || 0, 0),
                i = t === Ga && a === n;
            (e.classList.toggle('is-active', i),
                (e.disabled = t === Ga),
                e.setAttribute('aria-pressed', String(i)));
        });
    const l = document.querySelector(
        '[data-action="queue-set-station-mode"][data-queue-mode="free"]'
    );
    if (l instanceof HTMLButtonElement) {
        const e = t === Ja;
        (l.classList.toggle('is-active', e),
            (l.disabled = e),
            l.setAttribute('aria-pressed', String(e)));
    }
    const u = document.querySelector(
        '[data-action="queue-reconfigure-station"]'
    );
    u instanceof HTMLButtonElement && (u.disabled = t !== Ga);
    const d = (function () {
        const e = document.querySelector(
            '#queue .queue-station-control-actions'
        );
        if (!(e instanceof HTMLElement)) return null;
        let t = document.querySelector('[data-action="queue-toggle-one-tap"]');
        if (t instanceof HTMLButtonElement) return t;
        ((t = document.createElement('button')),
            (t.type = 'button'),
            (t.className = 'btn btn-secondary btn-sm'),
            (t.dataset.action = 'queue-toggle-one-tap'),
            t.setAttribute('aria-pressed', 'false'),
            (t.textContent = 'Modo 1 tecla'));
        const n = e.querySelector('[data-action="queue-toggle-shortcuts"]');
        return (
            n && n.parentElement === e
                ? e.insertBefore(t, n)
                : e.appendChild(t),
            t
        );
    })();
    d instanceof HTMLButtonElement &&
        (d.classList.toggle('is-active', a),
        d.setAttribute('aria-pressed', String(a)),
        (d.textContent = a ? 'Modo 1 tecla: ON' : 'Modo 1 tecla: OFF'),
        (d.title = a
            ? 'Desactivar modo 1 tecla (Alt+Shift+E)'
            : 'Activar modo 1 tecla (Alt+Shift+E)'));
    const { captureButton: m, clearButton: p } = (function () {
        const e = document.querySelector(
            '#queue .queue-station-control-actions'
        );
        if (!(e instanceof HTMLElement))
            return { captureButton: null, clearButton: null };
        let t = document.querySelector(
            '[data-action="queue-capture-call-key"]'
        );
        if (!(t instanceof HTMLButtonElement)) {
            ((t = document.createElement('button')),
                (t.type = 'button'),
                (t.className = 'btn btn-secondary btn-sm'),
                (t.dataset.action = 'queue-capture-call-key'),
                t.setAttribute('aria-pressed', 'false'),
                (t.textContent = 'Calibrar tecla externa'));
            const n = e.querySelector('[data-action="queue-toggle-shortcuts"]');
            n && n.parentElement === e
                ? e.insertBefore(t, n)
                : e.appendChild(t);
        }
        let n = document.querySelector('[data-action="queue-clear-call-key"]');
        if (!(n instanceof HTMLButtonElement)) {
            ((n = document.createElement('button')),
                (n.type = 'button'),
                (n.className = 'btn btn-secondary btn-sm'),
                (n.dataset.action = 'queue-clear-call-key'),
                (n.textContent = 'Quitar tecla externa'),
                (n.hidden = !0));
            const a = t && t.parentElement === e ? t.nextSibling : null;
            a ? e.insertBefore(n, a) : e.appendChild(n);
        }
        return { captureButton: t, clearButton: n };
    })();
    (m instanceof HTMLButtonElement &&
        (m.classList.toggle('is-active', o),
        m.setAttribute('aria-pressed', String(o)),
        o
            ? ((m.textContent = 'Escuchando tecla...'),
              (m.title =
                  'Presiona la tecla externa de llamado (Esc para cancelar)'))
            : i
              ? ((m.textContent = 'Recalibrar tecla externa'),
                (m.title = `Tecla actual: ${_i(i)}`))
              : ((m.textContent = 'Calibrar tecla externa'),
                (m.title = 'Asigna una tecla externa para llamar siguiente'))),
        p instanceof HTMLButtonElement &&
            ((p.hidden = !i),
            (p.disabled = o),
            p.setAttribute('aria-hidden', String(!i)),
            i
                ? (p.title = `Quitar tecla externa (${_i(i)})`)
                : p.removeAttribute('title')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((e) => {
                if (!(e instanceof HTMLElement)) return;
                (e.dataset.stationDefaultTitle ||
                    (e.dataset.stationDefaultTitle = String(
                        e.getAttribute('title') || ''
                    ).trim()),
                    e.dataset.stationBaseDisabled ||
                        (e.dataset.stationBaseDisabled = e.matches(':disabled')
                            ? '1'
                            : '0'));
                const a = Zi(e.dataset.queueConsultorio || 0, 0),
                    i = t === Ga && a !== n;
                if (
                    (e.classList.toggle('is-station-blocked', i),
                    e instanceof HTMLButtonElement)
                ) {
                    const t =
                        '1' === e.dataset.stationBaseDisabled ||
                        i ||
                        e.disabled;
                    ((e.disabled = t),
                        e.setAttribute('aria-disabled', String(t)));
                }
                if (i)
                    e.setAttribute(
                        'title',
                        `Estación bloqueada en C${n}. Reconfigura estación para llamar C${a}.`
                    );
                else {
                    const t = String(
                        e.dataset.stationDefaultTitle || ''
                    ).trim();
                    t ? e.setAttribute('title', t) : e.removeAttribute('title');
                }
            }),
        Ai(),
        Co());
}
function ro(
    e,
    { persist: t = !0, announce: n = !1, source: a = 'manual' } = {}
) {
    const i = eo(e, !1),
        o = i !== fi.oneTapAdvance;
    ((fi.oneTapAdvance = i),
        t && ao(i),
        oo(),
        n &&
            o &&
            E(
                i
                    ? 'Modo 1 tecla activado: Numpad Enter completa y llama siguiente.'
                    : 'Modo 1 tecla desactivado: vuelve flujo completar + llamar.',
                i ? 'success' : 'info'
            ),
        o &&
            bi('one_tap_mode_toggled', {
                source: a,
                enabled: i,
                stationMode: fi.mode,
                consultorio: fi.consultorio,
            }));
}
function so(
    e,
    { persist: t = !0, announce: n = !0, source: a = 'manual' } = {}
) {
    const i = to(e, null);
    if (
        ((gi.customCallKey = i),
        t &&
            (function (e) {
                try {
                    const t = to(e, null);
                    if (!t) return void localStorage.removeItem(Va);
                    localStorage.setItem(Va, JSON.stringify(t));
                } catch (e) {}
            })(i),
        oo(),
        i)
    )
        return (
            bi('call_key_binding_saved', {
                source: a,
                binding: i,
                stationMode: fi.mode,
                consultorio: fi.consultorio,
            }),
            void (n && E(`Tecla externa guardada: ${_i(i)}.`, 'success'))
        );
    (bi('call_key_binding_cleared', {
        source: a,
        stationMode: fi.mode,
        consultorio: fi.consultorio,
    }),
        n &&
            E(
                'Tecla externa eliminada. Se usa Numpad Enter estándar.',
                'info'
            ));
}
function co(e, { source: t = 'manual', announce: n = !0 } = {}) {
    const a = Boolean(e);
    a !== gi.captureCallKeyMode &&
        ((gi.captureCallKeyMode = a),
        oo(),
        bi(a ? 'call_key_capture_started' : 'call_key_capture_stopped', {
            source: t,
            stationMode: fi.mode,
            consultorio: fi.consultorio,
        }),
        n &&
            E(
                a
                    ? 'Calibración activa: presiona la tecla externa para llamar siguiente.'
                    : 'Calibración detenida.',
                a ? 'info' : 'warning'
            ));
}
function lo(
    { mode: e = fi.mode, consultorio: t = fi.consultorio },
    { persist: n = !0, announce: a = !1, source: i = 'manual' } = {}
) {
    const o = Xi(e, fi.mode),
        r = Zi(t, fi.consultorio),
        s = o !== fi.mode,
        c = r !== fi.consultorio;
    ((s || c) &&
        gi.pendingSensitiveAction &&
        Eo({ source: i, reason: 'station_config_changed', announce: !1 }),
        (fi.mode = o),
        (fi.consultorio = r),
        n && no(o, r),
        oo(),
        o === Ga && Ei('station_locked', { source: i, announce: !1 }),
        a &&
            (s || c) &&
            (o === Ga
                ? E(`Estación bloqueada en C${r}`, 'success')
                : E(`Estación en modo libre (C${r})`, 'info')),
        (s || c) &&
            bi('station_config_updated', {
                source: i,
                mode: o,
                consultorio: r,
                changedMode: s,
                changedConsultorio: c,
            }));
}
function uo(e) {
    if (
        (function (e) {
            const t = to(gi.customCallKey, null);
            if (!t) return !1;
            const n = po(e);
            if (!n) return !1;
            const a = !t.code || t.code === n.code,
                i = !t.key || t.key === n.key,
                o = 'number' != typeof t.location || t.location === n.location;
            return a && i && o;
        })(e)
    )
        return !0;
    const t = go(e);
    return !!Qa.has(t) || ho(e, Ya);
}
function mo(e) {
    const t = Number(e?.location);
    return Number.isFinite(t) ? Math.max(0, Math.min(3, Math.round(t))) : 0;
}
function po(e) {
    return to({ code: go(e), key: bo(e), location: mo(e) }, null);
}
function fo(e, t) {
    const n = String(t || '');
    if (!n) return !1;
    if (go(e) === `numpad${n}`) return !0;
    const a = String(e.key || '').trim();
    return yo(e) && a === n;
}
function go(e) {
    return String(e?.code || '')
        .trim()
        .toLowerCase();
}
function bo(e) {
    return String(e?.key || '')
        .trim()
        .toLowerCase();
}
function yo(e) {
    return 3 === Number(e?.location || 0);
}
function ho(e, t) {
    return yo(e) && t.has(bo(e));
}
function vo(e) {
    const t = Zi(e, 0);
    if (![1, 2].includes(t)) return 0;
    const n = document.getElementById(`queueReleaseC${t}`),
        a = Number(n?.dataset?.queueId || 0);
    return Number.isFinite(a) ? a : 0;
}
function So(e) {
    const t = Zi(e, 0);
    if (![1, 2].includes(t)) return '--';
    const n = document.getElementById(`queueReleaseC${t}`),
        a = String(n?.textContent || '')
            .trim()
            .match(/\(([^)]+)\)\s*$/);
    return a && a[1] ? a[1].trim() : '--';
}
function ko(e) {
    return oi.has(String(e || '').toLowerCase());
}
function wo(e) {
    const t = String(e || '').toLowerCase();
    return ci[t] || t || 'ejecutar accion';
}
function Co() {
    const e = (function () {
        !(function () {
            if (document.getElementById(si)) return;
            const e = document.createElement('style');
            ((e.id = si),
                (e.textContent =
                    "\n        #queueSensitiveConfirmDialog {\n            position: fixed;\n            inset: 0;\n            z-index: 1200;\n            display: none;\n            align-items: center;\n            justify-content: center;\n            padding: 1.25rem;\n        }\n        #queueSensitiveConfirmDialog.is-open {\n            display: flex;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-backdrop {\n            position: absolute;\n            inset: 0;\n            background: rgb(15 23 42 / 55%);\n            backdrop-filter: blur(2px);\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-card {\n            position: relative;\n            width: min(520px, 100%);\n            border-radius: 20px;\n            border: 1px solid rgb(15 23 42 / 14%);\n            background: #fff;\n            box-shadow: 0 22px 50px rgb(15 23 42 / 22%);\n            padding: 1.25rem;\n            color: #0f172a;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-card h4 {\n            margin: 0 0 0.5rem;\n            font-size: 1.05rem;\n            font-weight: 700;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-card p {\n            margin: 0;\n            line-height: 1.5;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-hint {\n            margin-top: 0.65rem;\n            color: #475569;\n            font-size: 0.92rem;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-actions {\n            display: flex;\n            gap: 0.6rem;\n            justify-content: flex-end;\n            margin-top: 1rem;\n        }\n        #queueSensitiveConfirmDialog .queue-sensitive-confirm-actions .btn {\n            min-width: 128px;\n        }\n        [data-theme='dark'] #queueSensitiveConfirmDialog .queue-sensitive-confirm-card {\n            background: #111c33;\n            color: #e7edf9;\n            border-color: rgb(148 163 184 / 24%);\n            box-shadow: 0 24px 55px rgb(2 8 23 / 55%);\n        }\n        [data-theme='dark'] #queueSensitiveConfirmDialog .queue-sensitive-confirm-hint {\n            color: #b6c5de;\n        }\n        @media (max-width: 720px) {\n            #queueSensitiveConfirmDialog .queue-sensitive-confirm-card {\n                padding: 1rem;\n                border-radius: 16px;\n            }\n            #queueSensitiveConfirmDialog .queue-sensitive-confirm-actions .btn {\n                min-width: 0;\n                flex: 1 1 auto;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            #queueSensitiveConfirmDialog,\n            #queueSensitiveConfirmDialog * {\n                animation: none !important;\n                transition: none !important;\n            }\n        }\n    "),
                document.head.appendChild(e));
        })();
        let e = document.getElementById('queueSensitiveConfirmDialog');
        return (
            e instanceof HTMLElement ||
                ((e = document.createElement('div')),
                (e.id = 'queueSensitiveConfirmDialog'),
                (e.hidden = !0),
                e.setAttribute('aria-hidden', 'true'),
                (e.innerHTML =
                    '\n        <div class="queue-sensitive-confirm-backdrop" data-action="queue-sensitive-cancel"></div>\n        <div\n            class="queue-sensitive-confirm-card"\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="queueSensitiveConfirmTitle"\n            aria-describedby="queueSensitiveConfirmMessage"\n        >\n            <h4 id="queueSensitiveConfirmTitle">Confirmar accion sensible</h4>\n            <p id="queueSensitiveConfirmMessage"></p>\n            <p class="queue-sensitive-confirm-hint">\n                Numpad Enter confirma. Esc cancela.\n            </p>\n            <div class="queue-sensitive-confirm-actions">\n                <button type="button" class="btn btn-secondary btn-sm" data-action="queue-sensitive-cancel">\n                    Cancelar\n                </button>\n                <button type="button" class="btn btn-primary btn-sm" data-action="queue-sensitive-confirm">\n                    Confirmar\n                </button>\n            </div>\n        </div>\n    '),
                document.body.appendChild(e)),
            e
        );
    })();
    if (!(e instanceof HTMLElement)) return;
    const t = gi.pendingSensitiveAction,
        n = Boolean(t);
    ((e.hidden = !n),
        e.classList.toggle('is-open', n),
        e.setAttribute('aria-hidden', String(!n)));
    const a = document.getElementById('queueSensitiveConfirmMessage'),
        i = e.querySelector('[data-action="queue-sensitive-confirm"]'),
        o = e.querySelector('[data-action="queue-sensitive-cancel"]');
    if (!(a instanceof HTMLElement)) return;
    if (!n)
        return (
            (a.textContent = ''),
            i instanceof HTMLButtonElement &&
                ((i.disabled = !1), (i.textContent = 'Confirmar')),
            void (o instanceof HTMLButtonElement && (o.disabled = !1))
        );
    const r = wo(t.action),
        s =
            t.ticketLabel && '--' !== t.ticketLabel
                ? ` (${t.ticketLabel})`
                : '';
    ((a.textContent = `Vas a ${r}${s} en C${t.consultorio}.`),
        i instanceof HTMLButtonElement &&
            ((i.disabled = gi.pendingSensitiveActionBusy),
            (i.textContent = gi.pendingSensitiveActionBusy
                ? 'Procesando...'
                : 'Confirmar')),
        o instanceof HTMLButtonElement &&
            (o.disabled = gi.pendingSensitiveActionBusy));
}
function Eo({
    source: e = 'manual',
    reason: t = 'dismissed',
    announce: n = !1,
} = {}) {
    const a = gi.pendingSensitiveAction;
    return (
        !!a &&
        ((gi.pendingSensitiveAction = null),
        (gi.pendingSensitiveActionBusy = !1),
        Co(),
        'confirmed' !== t &&
            bi('action_cancelled', {
                source: e,
                action: a.action,
                consultorio: a.consultorio,
                ticketId: a.ticketId,
                reason: t,
            }),
        n && E('Accion sensible cancelada', 'info'),
        !0)
    );
}
async function qo({ source: e = 'guard_confirm' } = {}) {
    const t = gi.pendingSensitiveAction;
    if (!t) return !1;
    if (gi.pendingSensitiveActionBusy) return !1;
    ((gi.pendingSensitiveActionBusy = !0), Co());
    try {
        return gi.practiceMode
            ? (E(
                  `Modo practica: accion "${t.action}" simulada en C${t.consultorio}.`,
                  'info'
              ),
              Di(t.action, {
                  source: e,
                  consultorio: t.consultorio,
                  ticketId: t.ticketId,
              }),
              bi('action_confirmed', {
                  source: e,
                  action: t.action,
                  consultorio: t.consultorio,
                  ticketId: t.ticketId,
                  practiceMode: !0,
              }),
              Eo({ source: e, reason: 'confirmed', announce: !1 }),
              !0)
            : (await Ba(t.ticketId, t.action, t.consultorio))
              ? (bi('action_confirmed', {
                    source: e,
                    action: t.action,
                    consultorio: t.consultorio,
                    ticketId: t.ticketId,
                    practiceMode: !1,
                }),
                bi('station_ticket_action', {
                    source: e,
                    action: t.action,
                    consultorio: t.consultorio,
                    ticketId: t.ticketId,
                }),
                Eo({ source: e, reason: 'confirmed', announce: !1 }),
                !0)
              : (Co(), !1);
    } finally {
        ((gi.pendingSensitiveActionBusy = !1), Co());
    }
}
async function _o(
    e,
    { source: t = 'numpad', requirePreparation: n = !1 } = {}
) {
    const a = String(e || '').toLowerCase(),
        i = Zi(fi.consultorio, 0);
    if (![1, 2].includes(i))
        return (E('Consultorio de estación inválido', 'error'), !1);
    const o = vo(i);
    if (!o) return (E(`No hay ticket activo en C${i}`, 'warning'), !1);
    if (ko(a)) {
        if (n)
            return (function (e, { source: t = 'numpad' } = {}) {
                const n = String(e || '').toLowerCase();
                if (!ko(n)) return !1;
                const a = Zi(fi.consultorio, 0);
                if (![1, 2].includes(a))
                    return (E('Consultorio de estacion invalido', 'error'), !1);
                const i = vo(a);
                if (!i)
                    return (E(`No hay ticket activo en C${a}`, 'warning'), !1);
                const o = So(a);
                return (
                    (gi.pendingSensitiveAction = {
                        action: n,
                        consultorio: a,
                        ticketId: i,
                        ticketLabel: o,
                        source: String(t || 'manual'),
                        preparedAt: new Date().toISOString(),
                    }),
                    (gi.pendingSensitiveActionBusy = !1),
                    Co(),
                    bi('sensitive_action_prepared', {
                        source: t,
                        action: n,
                        consultorio: a,
                        ticketId: i,
                    }),
                    E(
                        `${wo(n)} listo. Numpad Enter para confirmar o Esc para cancelar.`,
                        'warning'
                    ),
                    !0
                );
            })(a, { source: t });
        const e = (function ({
            action: e,
            consultorio: t,
            source: n = 'manual',
        } = {}) {
            const a = String(e || '').toLowerCase(),
                i = Zi(t, 0),
                o = So(i);
            return window.confirm(
                `Acción sensible: ${a} ${'--' !== o ? `(${o})` : ''} en C${i}. ¿Deseas continuar?`
            )
                ? window.confirm(
                      'Confirmación final: esta acción afectará la cola actual. ¿Confirmas ejecutar ahora?'
                  )
                    ? (bi('action_confirmed', {
                          source: n,
                          action: a,
                          consultorio: i || null,
                      }),
                      !0)
                    : (bi('action_cancelled', {
                          source: n,
                          action: a,
                          consultorio: i || null,
                          reason: 'second_confirm_declined',
                      }),
                      !1)
                : (bi('action_cancelled', {
                      source: n,
                      action: a,
                      consultorio: i || null,
                      reason: 'first_confirm_declined',
                  }),
                  !1);
        })({ action: a, consultorio: i, source: t });
        if (!e) return !1;
    }
    if (gi.practiceMode)
        return (
            E(`Modo práctica: acción "${a}" simulada en C${i}.`, 'info'),
            Di(a, { source: t, consultorio: i, ticketId: o }),
            !0
        );
    const r = await Ba(o, a, i);
    return (
        r &&
            bi('station_ticket_action', {
                source: t,
                action: a,
                consultorio: i,
                ticketId: o,
            }),
        r
    );
}
function Ao(e, { source: t = 'manual' } = {}) {
    const n = Zi(e, 0);
    (E(
        `Cambio bloqueado por modo estación (C${fi.consultorio}). Usa "Reconfigurar estación" para cambiar.`,
        'warning'
    ),
        bi('station_change_blocked', {
            source: t,
            attemptedConsultorio: n || null,
            stationConsultorio: fi.consultorio,
            stationMode: fi.mode,
        }),
        oo());
}
function Lo(e, { source: t = 'numpad' } = {}) {
    const n = Zi(e, 0);
    [1, 2].includes(n) &&
        (io()
            ? Ao(n, { source: t })
            : (lo(
                  { mode: Ja, consultorio: n },
                  { persist: !0, announce: !1, source: t }
              ),
              E(`Consultorio objetivo C${n}`, 'info')));
}
async function To(e, { source: t = 'manual' } = {}) {
    const n = Zi(e, 0);
    return [1, 2].includes(n)
        ? io() &&
          !(function (e) {
              const t = Zi(e, 0);
              return !(![1, 2].includes(t) || (io() && t !== fi.consultorio));
          })(n)
            ? (Ao(n, { source: t }), !1)
            : gi.practiceMode
              ? (E(`Modo práctica: llamada simulada en C${n}.`, 'info'),
                Di('call_next', { source: t, consultorio: n }),
                !0)
              : (io() &&
                    bi('station_locked_call', { source: t, consultorio: n }),
                'numpad' === t && E(`Llamando siguiente en C${n}`, 'info'),
                await (async function (e) {
                    const t = Number(e || 0);
                    if (![1, 2].includes(t))
                        return void E('Consultorio invalido', 'error');
                    const n = String(t);
                    if (!In.pendingCallByConsultorio.has(n)) {
                        (In.pendingCallByConsultorio.add(n), qa());
                        try {
                            const e = await k('queue-call-next', {
                                    method: 'POST',
                                    body: { consultorio: t },
                                }),
                                n = e?.data?.ticket || null;
                            ba(n);
                            const a =
                                e?.data?.queueState ||
                                e?.data?.queue_state ||
                                e?.data?.queueMeta ||
                                e?.data?.queue_meta ||
                                null;
                            h(a ? ia(a) : ra(s, new Date().toISOString()));
                            try {
                                await $a({ silent: !0 });
                            } catch (e) {}
                            (_a(),
                                n && n.ticketCode
                                    ? (Kn(
                                          `Llamado en C${t}: ${n.ticketCode} (${n.patientInitials || '--'})`,
                                          { level: 'info' }
                                      ),
                                      E(
                                          `Llamando ${n.ticketCode} en Consultorio ${t}`,
                                          'success'
                                      ),
                                      Rn('call_next_success', {
                                          consultorio: t,
                                          ticketId: Number(n.id || 0),
                                          ticketCode: String(
                                              n.ticketCode || ''
                                          ),
                                      }))
                                    : (Kn(
                                          `Llamado en C${t} sin ticket asignado`,
                                          { level: 'warning' }
                                      ),
                                      E(
                                          `Consultorio ${t} actualizado`,
                                          'success'
                                      ),
                                      Rn('call_next_empty', {
                                          consultorio: t,
                                      })));
                        } catch (e) {
                            if (va(e))
                                return (
                                    await $a({ silent: !0 }),
                                    Kn(`C${t} ocupado: ${ya(e)}`, {
                                        level: 'warning',
                                    }),
                                    E(ya(e), 'warning'),
                                    void Rn('call_next_busy', {
                                        consultorio: t,
                                        error: ya(e),
                                    })
                                );
                            (Kn(`Error llamando siguiente en C${t}: ${ya(e)}`, {
                                level: 'error',
                            }),
                                E(
                                    `No se pudo llamar siguiente turno: ${ya(e)}`,
                                    'error'
                                ),
                                Rn('call_next_failed', {
                                    consultorio: t,
                                    error: ya(e),
                                }));
                        } finally {
                            (In.pendingCallByConsultorio.delete(n), qa());
                        }
                    }
                })(n),
                window.requestAnimationFrame(() => {
                    oo();
                }),
                !0)
        : (E('Consultorio invalido', 'error'), !1);
}
function $o(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function Mo() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !mi))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - mi),
        a = (function (e) {
            if (!mi) return 'sin actualizar';
            const t = Math.max(0, e - mi),
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
function Io() {
    ((mi = Date.now()), Mo());
}
function Bo({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function No(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = di[e && di[e] ? e : 'dashboard'];
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
        oo());
}
function Do() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function xo() {
    const e = document.getElementById('adminSidebar');
    return e
        ? Array.from(e.querySelectorAll(Pa)).filter((e) => {
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
function Ho(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = Vi(),
        i = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!i && a)),
        n &&
            (i
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function Fo(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = Do();
    if (!t || !n || !a) return;
    const i = Boolean(e && Vi());
    (t.classList.toggle('is-open', i),
        n.classList.toggle('is-hidden', !i),
        n.setAttribute('aria-hidden', String(!i)),
        document.body.classList.toggle('admin-sidebar-open', i),
        a.setAttribute('aria-expanded', String(i)),
        Ho(i),
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
                const n = xo();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function Po({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = Do(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    (Fo(!1), e && n && t && t.focus());
}
function Ro(e) {
    const t = document.getElementById('adminDashboard');
    if (!t || t.classList.contains('is-hidden')) return;
    const n =
        (a = e.target) instanceof HTMLElement &&
        (!!a.isContentEditable ||
            Boolean(
                a.closest('input, textarea, select, [contenteditable="true"]')
            ));
    var a;
    const i = String(e.key || '').toLowerCase(),
        o = String(e.code || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && 'k' === i && !e.altKey && !e.shiftKey)
        return (e.preventDefault(), void Bo());
    if (
        '/' === e.key &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        document.getElementById('appointments')?.classList.contains('active') &&
        !n
    )
        return (
            e.preventDefault(),
            void (function () {
                const { searchInput: e } = st();
                e instanceof HTMLInputElement &&
                    (e.focus({ preventScroll: !0 }), e.select());
            })()
        );
    if (
        '/' === e.key &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        document.getElementById('callbacks')?.classList.contains('active') &&
        !n
    )
        return (
            e.preventDefault(),
            void (function () {
                const e = ce().searchInput;
                e instanceof HTMLInputElement &&
                    (e.focus({ preventScroll: !0 }), e.select());
            })()
        );
    if ('/' === e.key && !e.altKey && !e.ctrlKey && !e.metaKey && ln() && !n)
        return (e.preventDefault(), void cn());
    if (!('/' !== e.key || e.altKey || e.ctrlKey || e.metaKey || n))
        return (e.preventDefault(), void Bo());
    if (La() && !n && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (gi.captureCallKeyMode)
            return (
                e.preventDefault(),
                void (function (e, { source: t = 'capture' } = {}) {
                    if (!gi.captureCallKeyMode) return !1;
                    if ('escape' === bo(e))
                        return (
                            co(!1, { source: `${t}_escape`, announce: !0 }),
                            !0
                        );
                    if (e.repeat) return !0;
                    if (e.ctrlKey || e.metaKey || e.altKey) return !0;
                    if (
                        (function (e) {
                            const t = bo(e),
                                n = go(e);
                            if (!t && !n) return !0;
                            const a = new Set([
                                    'shift',
                                    'control',
                                    'alt',
                                    'meta',
                                    'altgraph',
                                    'capslock',
                                    'numlock',
                                    'scrolllock',
                                ]),
                                i = new Set([
                                    'shiftleft',
                                    'shiftright',
                                    'controlleft',
                                    'controlright',
                                    'altleft',
                                    'altright',
                                    'metaleft',
                                    'metaright',
                                ]);
                            return a.has(t) || i.has(n);
                        })(e)
                    )
                        return !0;
                    const n = po(e);
                    !n ||
                        (so(n, { persist: !0, announce: !0, source: t }),
                        co(!1, { source: `${t}_saved`, announce: !1 }));
                })(e, { source: 'capture_keyboard' })
            );
        if (e.repeat) return;
        if (gi.pendingSensitiveAction && uo(e))
            return (
                e.preventDefault(),
                void qo({ source: 'numpad_enter_confirm' })
            );
        if (
            (function (e) {
                return fo(e, 0);
            })(e)
        )
            return (
                e.preventDefault(),
                void Ti({ source: 'numpad', announce: !0 })
            );
        if (
            (function (e) {
                const t = go(e);
                return !!Xa.has(t) || ho(e, Za);
            })(e)
        )
            return (
                e.preventDefault(),
                void _o('re-llamar', { source: 'numpad_add' })
            );
        if (
            (function (e) {
                const t = go(e);
                return !!ni.has(t) || ho(e, ai);
            })(e)
        )
            return (
                e.preventDefault(),
                void _o('completar', {
                    source: 'numpad_decimal',
                    requirePreparation: !0,
                })
            );
        if (
            (function (e) {
                const t = go(e);
                return !!ei.has(t) || ho(e, ti);
            })(e)
        )
            return (
                e.preventDefault(),
                void _o('no_show', {
                    source: 'numpad_subtract',
                    requirePreparation: !0,
                })
            );
        if (fo(e, 1))
            return (e.preventDefault(), void Lo(1, { source: 'numpad' }));
        if (fo(e, 2))
            return (e.preventDefault(), void Lo(2, { source: 'numpad' }));
        if (uo(e))
            return (
                e.preventDefault(),
                void (fi.oneTapAdvance
                    ? (async function ({ source: e = 'numpad_one_tap' } = {}) {
                          const t = Zi(fi.consultorio, 0);
                          if (![1, 2].includes(t))
                              return (
                                  E(
                                      'Consultorio de estación inválido',
                                      'error'
                                  ),
                                  !1
                              );
                          const n = Date.now();
                          if (gi.oneTapInFlight)
                              return (
                                  E(
                                      'Flujo 1 tecla en proceso. Espera un momento.',
                                      'warning'
                                  ),
                                  bi('one_tap_blocked', {
                                      source: e,
                                      consultorio: t,
                                      reason: 'in_flight',
                                  }),
                                  !1
                              );
                          if (gi.lastOneTapAt > 0 && n - gi.lastOneTapAt < 1200)
                              return (
                                  E(
                                      'Espera un segundo antes de volver a usar Numpad Enter.',
                                      'warning'
                                  ),
                                  bi('one_tap_blocked', {
                                      source: e,
                                      consultorio: t,
                                      reason: 'cooldown',
                                      cooldownMs: 1200,
                                  }),
                                  !1
                              );
                          gi.oneTapInFlight = !0;
                          try {
                              const n = vo(t);
                              let a = !1;
                              if (n)
                                  if (gi.practiceMode)
                                      (bi('practice_one_tap_simulated', {
                                          source: e,
                                          consultorio: t,
                                          ticketId: n,
                                      }),
                                          Di('completar', {
                                              source: e,
                                              consultorio: t,
                                              ticketId: n,
                                          }));
                                  else {
                                      if (!(await Ba(n, 'completar', t)))
                                          return !1;
                                      a = !0;
                                  }
                              const i = await To(t, { source: e });
                              return (
                                  i &&
                                      (E(
                                          gi.practiceMode
                                              ? `Modo práctica 1 tecla en C${t}: completar + llamar simulado.`
                                              : n
                                                ? `Flujo 1 tecla en C${t}: atención cerrada y siguiente llamado.`
                                                : `Flujo 1 tecla en C${t}: llamando siguiente.`,
                                          gi.practiceMode ? 'info' : 'success'
                                      ),
                                      bi('station_one_tap_executed', {
                                          source: e,
                                          consultorio: t,
                                          hadActiveTicket: Boolean(n),
                                          completedInThisFlow: a,
                                          practiceMode: gi.practiceMode,
                                      }),
                                      (gi.lastOneTapAt = Date.now())),
                                  i
                              );
                          } finally {
                              gi.oneTapInFlight = !1;
                          }
                      })({ source: 'numpad_one_tap' })
                    : To(fi.consultorio, { source: 'numpad' }))
            );
    }
    if (!e.altKey || !e.shiftKey) return;
    if (n) return;
    if ('keyr' === o)
        return (e.preventDefault(), void Vo({ showSuccessToast: !0 }));
    if ('m' === i || 'keym' === o)
        return (e.preventDefault(), Vi() ? void Fo(!Ki()) : void Ji(!Wi()));
    if (ln()) {
        if ('ArrowLeft' === e.key) return (e.preventDefault(), void on(-1));
        if ('ArrowRight' === e.key) return (e.preventDefault(), void on(1));
        if ('keyy' === o) return (e.preventDefault(), void rn());
        if ('keys' === o) return (e.preventDefault(), void sn());
        if ('keyd' === o) return (e.preventDefault(), void vn());
        if ('keyw' === o) return (e.preventDefault(), void Sn());
        if ('keyv' === o) return (e.preventDefault(), void hn());
        if ('keyx' === o) return (e.preventDefault(), void kn());
        if ('keyq' === o) return (e.preventDefault(), void wn());
        if ('keyg' === o) return (e.preventDefault(), void fn());
        if ('keyz' === o) return (e.preventDefault(), void gn());
    }
    if (La()) {
        if ('digit0' === o || 'numpad0' === o)
            return (
                e.preventDefault(),
                void Ti({ source: 'shortcut', announce: !1 })
            );
        if ('keyj' === o)
            return (e.preventDefault(), void To(1, { source: 'shortcut' }));
        if ('keyk' === o)
            return (e.preventDefault(), void To(2, { source: 'shortcut' }));
        if ('keyu' === o) return (e.preventDefault(), void $a({ silent: !1 }));
        if ('keye' === o)
            return (
                e.preventDefault(),
                void ro(!fi.oneTapAdvance, {
                    persist: !0,
                    announce: !0,
                    source: 'shortcut',
                })
            );
        if ('keyf' === o) return (e.preventDefault(), void Ha());
        if ('keyl' === o) return (e.preventDefault(), void xa('sla_risk'));
        if ('keyw' === o) return (e.preventDefault(), void xa('waiting'));
        if ('keyc' === o) return (e.preventDefault(), void xa('called'));
        if ('keya' === o) return (e.preventDefault(), void xa('all'));
        if ('keyi' === o) return (e.preventDefault(), void xa('walk_in'));
        if ('keyo' === o) return (e.preventDefault(), void xa('all'));
        if ('keyg' === o)
            return (
                e.preventDefault(),
                gi.practiceMode
                    ? void Pi('bulk_completar', { source: 'shortcut' })
                    : void Na('completar')
            );
        if ('keyh' === o)
            return (
                e.preventDefault(),
                gi.practiceMode
                    ? void Pi('bulk_no_show', { source: 'shortcut' })
                    : void Na('no_show')
            );
        if ('keyb' === o)
            return (
                e.preventDefault(),
                gi.practiceMode
                    ? void Pi('bulk_cancelar', { source: 'shortcut' })
                    : void Na('cancelar')
            );
        if ('keyp' === o)
            return (
                e.preventDefault(),
                gi.practiceMode
                    ? void Pi('bulk_reprint', { source: 'shortcut' })
                    : void Da()
            );
    }
    const r =
        {
            keya: 'all',
            keyh: 'today',
            keyt: 'pending_transfer',
            keyn: 'no_show',
        }[o] || null;
    if (r) return (e.preventDefault(), void zo(r));
    const s = { keyp: 'pending', keyc: 'contacted' }[o] || null;
    if (s) return (e.preventDefault(), void Uo(s));
    const c = Fa.get(o) || Fa.get(i);
    c && (e.preventDefault(), Oo(c));
}
function jo(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function Oo(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: i = !0,
            closeMobileNav: o = !0,
        } = t,
        r = Oi(Ui(), 'dashboard'),
        s = Oi(e, 'dashboard');
    if (
        'availability' === r &&
        'availability' !== s &&
        It() &&
        !confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        )
    )
        return (Yi(r), a || $o(r), i && jo(r), !1);
    if ((Yi(s), o && Po(), n))
        try {
            (await R(), Io());
        } catch (e) {
            E(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    return (await Wo(s), a && $o(s), i && jo(s), !0);
}
async function zo(e) {
    (await Oo('appointments', { focus: !1 }),
        yt(e, { preserveSearch: !1 }),
        jo('appointments'));
}
async function Uo(e) {
    (await Oo('callbacks', { focus: !1 }),
        Ce(e, { preserveSearch: !1 }),
        jo('callbacks'));
}
async function Vo({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await R(),
            Io(),
            await Wo(Ui()),
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
async function Ko(e) {
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
            Bo(),
            !1
        );
    if ('help' === n || 'ayuda' === n)
        return (
            E(
                'Comandos: citas hoy, citas por validar, callbacks pendientes, turnero c1/c2, turnero 1 tecla, turnero sla, disponibilidad hoy, exportar csv.',
                'info'
            ),
            !0
        );
    if (n.includes('exportar') && n.includes('csv'))
        return (
            await Oo('appointments', { focus: !1 }),
            St(),
            jo('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await Oo('dashboard'), !0);
    if (
        n.includes('turnero') ||
        n.includes('cola') ||
        n.includes('consultorio')
    )
        return (
            await Oo('queue', { focus: !1 }),
            n.includes('1 tecla on') ||
            n.includes('modo 1 tecla on') ||
            n.includes('one tap on')
                ? ro(!0, { persist: !0, announce: !0, source: 'command' })
                : n.includes('1 tecla off') ||
                    n.includes('modo 1 tecla off') ||
                    n.includes('one tap off')
                  ? ro(!1, { persist: !0, announce: !0, source: 'command' })
                  : n.includes('1 tecla') ||
                      n.includes('one tap') ||
                      n.includes('modo express')
                    ? ro(!fi.oneTapAdvance, {
                          persist: !0,
                          announce: !0,
                          source: 'command',
                      })
                    : n.includes('c1') || n.includes('consultorio 1')
                      ? await To(1, { source: 'command' })
                      : n.includes('completar visibles') ||
                          n.includes('bulk completar')
                        ? gi.practiceMode
                            ? Pi('bulk_completar', { source: 'command' })
                            : await Na('completar')
                        : n.includes('no show visibles') ||
                            n.includes('bulk no show')
                          ? gi.practiceMode
                              ? Pi('bulk_no_show', { source: 'command' })
                              : await Na('no_show')
                          : n.includes('cancelar visibles') ||
                              n.includes('bulk cancelar')
                            ? gi.practiceMode
                                ? Pi('bulk_cancelar', { source: 'command' })
                                : await Na('cancelar')
                            : n.includes('reimprimir visibles') ||
                                n.includes('bulk reprint')
                              ? gi.practiceMode
                                  ? Pi('bulk_reprint', { source: 'command' })
                                  : await Da()
                              : n.includes('sla')
                                ? (xa('sla_risk'), Ha())
                                : n.includes('buscar')
                                  ? Ha()
                                  : n.includes('c2') ||
                                      n.includes('consultorio 2')
                                    ? await To(2, { source: 'command' })
                                    : await $a({ silent: !0 }),
            jo('queue'),
            !0
        );
    if (n.includes('resena') || n.includes('review'))
        return (await Oo('reviews'), !0);
    if (n.includes('callback'))
        return (
            await Uo(
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
        return (await zo(e), n.includes('limpiar') && ht(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await Oo('availability', { focus: !1 }),
          n.includes('hoy')
              ? rn()
              : n.includes('siguiente')
                ? sn()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  cn(),
          jo('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await Vo({ showSuccessToast: !0 }), !0)
          : (E(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function Wo(e) {
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
        No(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const o = document.getElementById(e);
    switch (
        (o && o.classList.add('active'),
        'queue' !== e &&
            (Ia({ reason: 'paused' }),
            co(!1, { source: 'section_change', announce: !1 })),
        e)
    ) {
        case 'dashboard':
        default:
            Q();
            break;
        case 'appointments':
            bt();
            break;
        case 'callbacks':
            (pe(),
                Se(),
                we({
                    filter: ce().filterSelect?.value || te.filter,
                    sort: ce().sortSelect?.value || te.sort,
                    search: ce().searchInput?.value || te.search,
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
                            const e = await k('availability', {
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
                                (p(Tt(t)),
                                f(r),
                                $t(a),
                                (Ct = 'google' === String(r.source || '')),
                                en(),
                                nn(),
                                kt && !Dt(kt))
                            )
                                return ((kt = null), xt(''), void tn());
                            kt ? dn(kt) : tn();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                E(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (Ct = 'google' === String(i.source || '')),
                                en(),
                                nn());
                        }
                    })(),
                    !kt)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(Lt);
                            return Dt(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    Dt(e) && (kt = e);
                }
                (kt && !Dt(kt) && (kt = null),
                    kt && Kt(kt),
                    an(),
                    kt ? un(kt, { persist: !1 }) : tn());
            })();
            break;
        case 'queue':
            (!(function () {
                if (!In.snapshotLoaded) {
                    In.snapshotLoaded = !0;
                    const e = zn();
                    !e ||
                        (Array.isArray(s) && 0 !== s.length) ||
                        Un(e, { source: 'startup' });
                }
                (_a(),
                    Wn('paused', 'Sincronizacion lista'),
                    In.activityLog.length ||
                        Kn('Consola de turnero lista para operacion', {
                            level: 'info',
                        }),
                    $a({ silent: !0 }));
            })(),
                Ma({ immediate: !0 }),
                oo(),
                Ai(),
                Ci(),
                yi(Ka, !1)
                    ? Ri(!1, { source: 'autoload' })
                    : Ri(!0, { source: 'autoload' }));
    }
}
async function Go() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = zi();
    (Yi(n),
        $o(n),
        Qi(),
        Po(),
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
                (await R(), Io());
            } catch (e) {
                E(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = Ui();
            await Wo(t);
        })(),
        await (async function () {
            if (_e) return;
            _e = !0;
            const { subscribeBtn: e, testBtn: t } = Te();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return ($e(!1), void Ae('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await Ie(),
                        $e(!0),
                        Ae('disponible', 'muted'),
                        e.addEventListener('click', Ne),
                        t.addEventListener('click', De),
                        await Be());
                } catch (e) {
                    ($e(!1), Ae('sin configurar', 'warn'));
                }
            }
        })());
}
async function Jo(e) {
    e.preventDefault();
    const t = document.getElementById('group2FA');
    if (t && !t.classList.contains('is-hidden')) {
        const e = document.getElementById('admin2FACode')?.value || '';
        try {
            const t = await (async function (e) {
                return w('login-2fa', { method: 'POST', body: { code: e } });
            })(e);
            (t.csrfToken && v(t.csrfToken),
                E('Bienvenido al panel de administración', 'success'),
                await Go());
        } catch {
            E('Código incorrecto o sesión expirada', 'error');
        }
        return;
    }
    const n = document.getElementById('adminPassword')?.value || '';
    try {
        const e = await (async function (e) {
            return w('login', { method: 'POST', body: { password: e } });
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
            await Go());
    } catch {
        E('Contraseña incorrecta', 'error');
    }
}
function Qo() {
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
                            await w('logout', { method: 'POST' });
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
                    void Je(o.dataset.themeMode || 'system', {
                        persist: !0,
                        animate: !0,
                    })
                );
            if ('toggle-sidebar-collapse' === r)
                return (
                    i.preventDefault(),
                    Vi() ? void Fo(!Ki()) : void Ji(!Wi())
                );
            if ('run-admin-command' === r) {
                i.preventDefault();
                const e = document.getElementById('adminQuickCommand');
                return void (await Ko(
                    e instanceof HTMLInputElement ? e.value : ''
                ));
            }
            if ('refresh-admin-data' === r)
                return (
                    i.preventDefault(),
                    void (await Vo({ showSuccessToast: !0 }))
                );
            if ('context-open-dashboard' === r)
                return (i.preventDefault(), void (await Oo('dashboard')));
            if ('context-open-appointments-today' === r)
                return (i.preventDefault(), void (await zo('today')));
            if ('context-open-appointments-transfer' === r)
                return (
                    i.preventDefault(),
                    void (await zo('pending_transfer'))
                );
            if ('context-open-callbacks-pending' === r)
                return (i.preventDefault(), void (await Uo('pending')));
            if ('context-open-callbacks-next' === r)
                return (i.preventDefault(), await Uo('pending'), void qe());
            if ('queue-refresh-state' === r)
                return (
                    i.preventDefault(),
                    await $a({ silent: !1 }),
                    void oo()
                );
            if ('queue-sensitive-confirm' === r)
                return (
                    i.preventDefault(),
                    void (await qo({ source: 'dialog_button' }))
                );
            if ('queue-sensitive-cancel' === r)
                return (
                    i.preventDefault(),
                    void Eo({
                        source: 'dialog_button',
                        reason: 'dialog_cancel',
                        announce: !1,
                    })
                );
            if ('queue-lock-station' === r) {
                i.preventDefault();
                const e = Zi(o.dataset.queueConsultorio || 0, 0);
                if (![1, 2].includes(e)) return;
                return void lo(
                    { mode: Ga, consultorio: e },
                    { persist: !0, announce: !0, source: 'station_panel' }
                );
            }
            if ('queue-set-station-mode' === r)
                return (
                    i.preventDefault(),
                    void lo(
                        {
                            mode: Xi(o.dataset.queueMode || Ja, Ja),
                            consultorio: fi.consultorio,
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
                    lo(
                        { mode: Ja, consultorio: fi.consultorio },
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
            if ('queue-toggle-shortcuts' === r)
                return (
                    i.preventDefault(),
                    void Ti({ source: 'button', announce: !1 })
                );
            if ('queue-open-onboarding' === r)
                return (
                    i.preventDefault(),
                    void Ri(!0, { persist: !1, source: 'station_panel_button' })
                );
            if ('queue-toggle-one-tap' === r)
                return (
                    i.preventDefault(),
                    void ro(!fi.oneTapAdvance, {
                        persist: !0,
                        announce: !0,
                        source: 'station_panel_button',
                    })
                );
            if ('queue-capture-call-key' === r)
                return (
                    i.preventDefault(),
                    void co(!gi.captureCallKeyMode, {
                        source: 'station_panel_button',
                        announce: !0,
                    })
                );
            if ('queue-clear-call-key' === r) {
                if ((i.preventDefault(), !gi.customCallKey)) return;
                if (
                    !window.confirm(
                        `Se eliminará la tecla externa (${_i(gi.customCallKey)}). ¿Deseas continuar?`
                    )
                )
                    return;
                return (
                    so(null, {
                        persist: !0,
                        announce: !0,
                        source: 'station_panel_button',
                    }),
                    void co(!1, {
                        source: 'station_panel_button_clear',
                        announce: !1,
                    })
                );
            }
            if ('queue-start-practice' === r)
                return (
                    i.preventDefault(),
                    Ri(!1, { persist: !1, source: 'practice_start' }),
                    Fi(!0, { source: 'practice_start' }),
                    Li(!0, { source: 'practice_start', announce: !1 }),
                    E(
                        'Modo práctica activo: simulación local, no se enviarán cambios a la cola real.',
                        'info'
                    ),
                    void bi('onboarding_practice_started', {
                        stationMode: fi.mode,
                        consultorio: fi.consultorio,
                    })
                );
            if ('queue-reset-practice' === r)
                return (
                    i.preventDefault(),
                    gi.practiceMode
                        ? void xi({
                              source: 'practice_reset_button',
                              announce: !0,
                          })
                        : void E(
                              'Activa modo práctica para reiniciar el entrenamiento.',
                              'warning'
                          )
                );
            if ('queue-stop-practice' === r)
                return (
                    i.preventDefault(),
                    Fi(!1, { source: 'practice_stop_button' }),
                    void E(
                        'Modo práctica desactivado. Operación real reanudada.',
                        'success'
                    )
                );
            if ('queue-dismiss-onboarding' === r) {
                i.preventDefault();
                const e = wi(),
                    t = ui.length;
                if (
                    e < t &&
                    !window.confirm(
                        `La guía aún no está completa (${e}/${t}). ¿Deseas cerrarla de todos modos?`
                    )
                )
                    return;
                return (
                    Ri(!1, { persist: !0, source: 'onboarding_button' }),
                    void E('Guía inicial completada', 'success')
                );
            }
            if ('queue-call-next' === r)
                return (
                    i.preventDefault(),
                    void (await To(Number(o.dataset.queueConsultorio || 0), {
                        source: 'button',
                    }))
                );
            if ('context-focus-slot-input' === r)
                return (
                    i.preventDefault(),
                    await Oo('availability', { focus: !1 }),
                    void cn()
                );
            if ('context-availability-today' === r)
                return (
                    i.preventDefault(),
                    await Oo('availability', { focus: !1 }),
                    void rn()
                );
            if ('context-availability-next' === r)
                return (
                    i.preventDefault(),
                    await Oo('availability', { focus: !1 }),
                    void sn()
                );
            if ('context-copy-availability-day' === r)
                return (
                    i.preventDefault(),
                    await Oo('availability', { focus: !1 }),
                    void yn()
                );
            try {
                if ('export-csv' === r) return (i.preventDefault(), void St());
                if ('context-appointment-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void yt(o.dataset.filterValue || 'all')
                    );
                if ('appointment-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void yt(o.dataset.filterValue || 'all')
                    );
                if ('context-callback-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void Ce(o.dataset.filterValue || 'all')
                    );
                if ('callback-quick-filter' === r)
                    return (
                        i.preventDefault(),
                        void Ce(o.dataset.filterValue || 'all')
                    );
                if ('callbacks-triage-next' === r)
                    return (i.preventDefault(), await Uo('pending'), void qe());
                if ('clear-appointment-filters' === r)
                    return (i.preventDefault(), void ht());
                if ('clear-callback-filters' === r)
                    return (
                        i.preventDefault(),
                        void we(
                            { filter: Y, sort: X, search: '' },
                            { preserveSearch: !1 }
                        )
                    );
                if ('appointment-density' === r)
                    return (
                        i.preventDefault(),
                        void (function (e) {
                            const t = ut(e);
                            (mt(t),
                                dt(Ze, t),
                                Boolean(
                                    document.getElementById(
                                        'appointmentsTableBody'
                                    )
                                ) && gt());
                        })(o.dataset.density || 'comfortable')
                    );
                if ('change-month' === r)
                    return (
                        i.preventDefault(),
                        void on(Number(o.dataset.delta || 0))
                    );
                if ('availability-today' === r)
                    return (i.preventDefault(), void rn());
                if ('availability-next-with-slots' === r)
                    return (i.preventDefault(), void sn());
                if ('prefill-time-slot' === r)
                    return (
                        i.preventDefault(),
                        void (function (e) {
                            if (Ct)
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
                    return (i.preventDefault(), void yn());
                if ('paste-availability-day' === r)
                    return (i.preventDefault(), void (await hn()));
                if ('duplicate-availability-day-next' === r)
                    return (i.preventDefault(), void (await vn()));
                if ('duplicate-availability-next-week' === r)
                    return (i.preventDefault(), void (await Sn()));
                if ('clear-availability-day' === r)
                    return (i.preventDefault(), void (await kn()));
                if ('clear-availability-week' === r)
                    return (i.preventDefault(), void (await wn()));
                if ('save-availability-draft' === r)
                    return (i.preventDefault(), void (await fn()));
                if ('discard-availability-draft' === r)
                    return (i.preventDefault(), void gn());
                if ('add-time-slot' === r)
                    return (
                        i.preventDefault(),
                        void (await (async function () {
                            if (Ct)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            if (!kt)
                                return void E(
                                    'Selecciona una fecha primero',
                                    'warning'
                                );
                            const e = document.getElementById('newSlotTime');
                            if (!(e instanceof HTMLInputElement)) return;
                            const t = String(e.value || '').trim();
                            if (!t)
                                return void E('Ingresa un horario', 'warning');
                            const n = Pt(a[kt] || []);
                            n.includes(t)
                                ? E('Este horario ya existe', 'warning')
                                : (pn(() => {
                                      zt(kt, [...n, t]);
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
                            if (Ct)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const n = String(e || '').trim(),
                                i = String(t || '').trim();
                            if (!Dt(n) || !i)
                                return void E(
                                    'No se pudo identificar el horario a eliminar',
                                    'warning'
                                );
                            const o = Pt(a[n] || []),
                                r = o.filter((e) => e !== i);
                            r.length !== o.length
                                ? (pn(() => {
                                      zt(n, r);
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
                                        (await k('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'paid',
                                                paymentPaidAt:
                                                    new Date().toISOString(),
                                            },
                                        }),
                                            await R(),
                                            bt(),
                                            Q(),
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
                                        (await k('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                paymentStatus: 'failed',
                                            },
                                        }),
                                            await R(),
                                            bt(),
                                            Q(),
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
                                        (await k('appointments', {
                                            method: 'PATCH',
                                            body: {
                                                id: e,
                                                status: 'cancelled',
                                            },
                                        }),
                                            await R(),
                                            bt(),
                                            Q(),
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
                                        (await k('appointments', {
                                            method: 'PATCH',
                                            body: { id: e, status: 'no_show' },
                                        }),
                                            await R(),
                                            bt(),
                                            Q(),
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
                                    oe.delete(de(a));
                                    const e = a.id || Date.now();
                                    (a.id || (a.id = e),
                                        await k('callbacks', {
                                            method: 'PATCH',
                                            body: {
                                                id: Number(e),
                                                status: 'contactado',
                                            },
                                        }),
                                        await R(),
                                        we({
                                            filter: te.filter,
                                            sort: te.sort,
                                            search: te.search,
                                        }),
                                        Q(),
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
                        gi.practiceMode
                            ? void Pi(
                                  String(
                                      o.dataset.queueAction || 'ticket_action'
                                  ),
                                  {
                                      source: 'button',
                                      consultorio:
                                          Number(
                                              o.dataset.queueConsultorio || 0
                                          ) || null,
                                      ticketId:
                                          Number(o.dataset.queueId || 0) ||
                                          null,
                                  }
                              )
                            : void (await Ba(
                                  Number(o.dataset.queueId || 0),
                                  o.dataset.queueAction || '',
                                  Number(o.dataset.queueConsultorio || 0)
                              ))
                    );
                if ('queue-reprint-ticket' === r)
                    return (
                        i.preventDefault(),
                        gi.practiceMode
                            ? void Pi('reprint_ticket', {
                                  source: 'button',
                                  ticketId:
                                      Number(o.dataset.queueId || 0) || null,
                              })
                            : void (await (async function (e) {
                                  const t = Number(e || 0);
                                  if (!t)
                                      return void E(
                                          'Ticket invalido para reimpresion',
                                          'error'
                                      );
                                  const n = String(t);
                                  if (!In.reprintInFlightIds.has(n)) {
                                      (In.reprintInFlightIds.add(n),
                                          _a(),
                                          Rn('reprint_started', {
                                              ticketId: t,
                                          }));
                                      try {
                                          const e = (await ha(t)).payload || {};
                                          if (e?.printed)
                                              (Kn(`Ticket #${t} reimpreso`, {
                                                  level: 'info',
                                              }),
                                                  E(
                                                      'Ticket reimpreso',
                                                      'success'
                                                  ),
                                                  Rn('reprint_success', {
                                                      ticketId: t,
                                                  }));
                                          else {
                                              const n = (function (
                                                  e,
                                                  { fallback: t = '' } = {}
                                              ) {
                                                  const n = String(
                                                          e?.print?.errorCode ||
                                                              ''
                                                      ).toLowerCase(),
                                                      a = String(
                                                          e?.print?.message ||
                                                              ''
                                                      ).trim(),
                                                      i = Number(
                                                          e?.statusCode || 0
                                                      );
                                                  return 'printer_disabled' ===
                                                      n
                                                      ? 'Impresora deshabilitada: ticket generado sin impresion'
                                                      : 'printer_host_missing' ===
                                                          n
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
                                              })(e, {
                                                  fallback: 'sin detalle',
                                              });
                                              (Kn(
                                                  `Ticket #${t} generado sin impresion (${n})`,
                                                  { level: 'warning' }
                                              ),
                                                  E(
                                                      `Ticket generado sin impresion: ${n}`,
                                                      'warning'
                                                  ),
                                                  Rn('reprint_degraded', {
                                                      ticketId: t,
                                                      detail: n,
                                                      statusCode: Number(
                                                          e?.statusCode || 0
                                                      ),
                                                  }));
                                          }
                                      } catch (e) {
                                          const n = ya(e);
                                          (Kn(
                                              `Error al reimprimir ticket #${t}: ${n}`,
                                              { level: 'error' }
                                          ),
                                              E(
                                                  `No se pudo reimprimir ticket: ${n}`,
                                                  'error'
                                              ),
                                              Rn('reprint_failed', {
                                                  ticketId: t,
                                                  error: n,
                                              }));
                                      } finally {
                                          (In.reprintInFlightIds.delete(n),
                                              _a());
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
            gt();
        });
    const o = document.getElementById('searchAppointments');
    o &&
        o.addEventListener('input', () => {
            gt();
        });
    const r = document.getElementById('appointmentSort');
    r &&
        r.addEventListener('change', () => {
            !(function (e) {
                const t = lt(e),
                    { sortSelect: n } = st();
                (n && (n.value = t), dt(Xe, t), gt());
            })(r.value || 'datetime_desc');
        });
    const c = document.getElementById('callbackFilter');
    c && c.addEventListener('change', ke);
    const l = document.getElementById('searchCallbacks');
    l && l.addEventListener('input', Ee);
    const u = document.getElementById('adminQuickCommand');
    u instanceof HTMLInputElement &&
        u.addEventListener('keydown', async (e) => {
            'Enter' === e.key && (e.preventDefault(), await Ko(u.value));
        });
}
async function Yo() {
    ((Pe = Ke()),
        Je(Pe, { persist: !1, animate: !1 }),
        (function () {
            if (je) return;
            const e = Ue();
            e &&
                ('function' == typeof e.addEventListener
                    ? (e.addEventListener('change', Qe), (je = !0))
                    : 'function' == typeof e.addListener &&
                      (e.addListener(Qe), (je = !0)));
        })(),
        Oe ||
            'function' != typeof window.addEventListener ||
            (window.addEventListener('storage', Ye), (Oe = !0)),
        (function () {
            Bi();
            const e = (function () {
                try {
                    return {
                        mode: Xi(localStorage.getItem(Oa), Ja),
                        consultorio: Zi(localStorage.getItem(za), 1),
                    };
                } catch (e) {
                    return { mode: Ja, consultorio: 1 };
                }
            })();
            ((fi.mode = e.mode),
                (fi.consultorio = e.consultorio),
                (fi.oneTapAdvance = (function () {
                    try {
                        return eo(localStorage.getItem(Ua), !1);
                    } catch (e) {
                        return !1;
                    }
                })()),
                (gi.customCallKey = (function () {
                    try {
                        const e = localStorage.getItem(Va);
                        return e ? to(JSON.parse(e), null) : null;
                    } catch (e) {
                        return null;
                    }
                })()),
                (gi.onboardingProgress = (function () {
                    try {
                        const e = localStorage.getItem(Wa);
                        return e ? Si(JSON.parse(e)) : vi();
                    } catch (e) {
                        return vi();
                    }
                })()),
                (gi.helpOpen = yi(ii, !1)),
                (gi.onboardingVisible = !1),
                (gi.practiceMode = !1),
                (gi.practiceState = null),
                (gi.practiceTickId = 0),
                (gi.oneTapInFlight = !1),
                (gi.lastOneTapAt = 0),
                (gi.captureCallKeyMode = !1),
                (gi.pendingSensitiveAction = null),
                (gi.pendingSensitiveActionBusy = !1));
            try {
                window.__PIEL_QUEUE_PRACTICE_MODE = !1;
            } catch (e) {}
            const t = (function () {
                try {
                    const e = new URL(window.location.href),
                        t = String(e.searchParams.get('station') || '')
                            .trim()
                            .toLowerCase(),
                        n = String(e.searchParams.get('lock') || '')
                            .trim()
                            .toLowerCase(),
                        a = String(
                            e.searchParams.get('onetap') ||
                                e.searchParams.get('one_tap') ||
                                ''
                        )
                            .trim()
                            .toLowerCase(),
                        i = '' !== t,
                        o = '' !== n,
                        r = '' !== a;
                    if (!i && !o && !r) return null;
                    let s = null;
                    'c1' === t || '1' === t
                        ? (s = 1)
                        : ('c2' !== t && '2' !== t) || (s = 2);
                    let c = null;
                    return (
                        ['1', 'true', 'locked', 'yes'].includes(n)
                            ? (c = Ga)
                            : ['0', 'false', 'free', 'no'].includes(n) &&
                              (c = Ja),
                        {
                            consultorio: s,
                            mode: c,
                            oneTapAdvance: r ? eo(a, !1) : null,
                            hadStationParam: i,
                            hadLockParam: o,
                            hadOneTapParam: r,
                        }
                    );
                } catch (e) {
                    return null;
                }
            })();
            (t
                ? ((fi.mode = Xi(t.mode, fi.mode)),
                  (fi.consultorio = Zi(t.consultorio, fi.consultorio)),
                  null !== t.oneTapAdvance &&
                      ((fi.oneTapAdvance = eo(
                          t.oneTapAdvance,
                          fi.oneTapAdvance
                      )),
                      ao(fi.oneTapAdvance)),
                  no(fi.mode, fi.consultorio),
                  bi('station_bootstrap', {
                      source: 'query',
                      mode: fi.mode,
                      consultorio: fi.consultorio,
                      oneTapAdvance: fi.oneTapAdvance,
                  }),
                  (function () {
                      try {
                          const e = new URL(window.location.href),
                              t = e.searchParams.has('station'),
                              n = e.searchParams.has('lock'),
                              a =
                                  e.searchParams.has('onetap') ||
                                  e.searchParams.has('one_tap');
                          if (!t && !n && !a) return;
                          (e.searchParams.delete('station'),
                              e.searchParams.delete('lock'),
                              e.searchParams.delete('onetap'),
                              e.searchParams.delete('one_tap'));
                          const i = `${e.pathname}${e.search}${e.hash}`;
                          window.history &&
                              'function' ==
                                  typeof window.history.replaceState &&
                              window.history.replaceState(
                                  null,
                                  '',
                                  i || e.pathname
                              );
                      } catch (e) {}
                  })())
                : bi('station_bootstrap', {
                      source: 'storage',
                      mode: fi.mode,
                      consultorio: fi.consultorio,
                      oneTapAdvance: fi.oneTapAdvance,
                  }),
                oo(),
                Ai(),
                Co(),
                fi.mode === Ga &&
                    Ei('station_locked', { source: 'bootstrap', announce: !1 }),
                gi.helpOpen &&
                    Ei('shortcuts_opened', {
                        source: 'bootstrap',
                        announce: !1,
                    }),
                Ci(),
                Hi(),
                Ri(!1, { source: 'bootstrap' }));
        })(),
        Qo(),
        (function () {
            const e = { sort: lt(D(Xe, et)), density: ut(D(Ze, tt)) },
                { sortSelect: t } = st();
            (t && (t.value = e.sort), mt(e.density));
        })(),
        pi ||
            (pi = window.setInterval(() => {
                Mo();
            }, 3e4)),
        Mo(),
        No(zi()),
        Qi());
    const e = document.getElementById('loginForm');
    (e && e.addEventListener('submit', Jo),
        ji().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await Oo(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                Vi() ? Fo(!Ki()) : Ji(!Wi());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => Po({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => Po({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            if (
                ((function (e) {
                    if ('Tab' !== e.key) return;
                    if (!Vi() || !Ki()) return;
                    const t = document.getElementById('adminSidebar');
                    if (!t) return;
                    const n = xo();
                    if (0 === n.length)
                        return (e.preventDefault(), void t.focus());
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
                'Escape' !== e.key)
            )
                Ro(e);
            else {
                if (
                    (function (e) {
                        return !(
                            !La() ||
                            (gi.pendingSensitiveAction
                                ? (e.preventDefault(),
                                  Eo({
                                      source: 'keyboard_escape',
                                      reason: 'keyboard_escape',
                                      announce: !0,
                                  }),
                                  0)
                                : gi.onboardingVisible
                                  ? (e.preventDefault(),
                                    Ri(!1, {
                                        persist: !0,
                                        source: 'keyboard_escape',
                                    }),
                                    0)
                                  : !gi.helpOpen ||
                                    (e.preventDefault(),
                                    Li(!1, {
                                        source: 'keyboard_escape',
                                        announce: !1,
                                    }),
                                    0))
                        );
                    })(e)
                )
                    return;
                Po({ restoreFocus: !0 });
            }
        }),
        window.addEventListener('resize', () => {
            (Vi() || Po(), Qi(), Ho(Ki()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await Oo(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return Oi(
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
                        (await k('import', { method: 'POST', body: a }),
                            await R(),
                            Io());
                        const i = document.querySelector('.nav-item.active');
                        (await Wo(i?.dataset.section || 'dashboard'),
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
                ? Ia({ reason: 'hidden' })
                : 'queue' === Ui() && Ma({ immediate: !0 });
        }),
        window.addEventListener('online', async () => {
            const e = await Vo({ showSuccessToast: !1, showErrorToast: !1 });
            ('queue' === Ui() && Ma({ immediate: !0 }),
                e
                    ? E('Conexion restaurada. Datos actualizados.', 'success')
                    : E(
                          'Conexion restaurada, pero no se pudieron refrescar datos.',
                          'warning'
                      ));
        }),
        window.addEventListener('offline', () => {
            'queue' === Ui() && Ia({ reason: 'offline' });
        }),
        window.addEventListener('piel:queue-ops', () => {
            window.requestAnimationFrame(() => {
                oo();
            });
        }),
        Ho(!1),
        Gi(Wi()),
        await (async function () {
            if (!navigator.onLine && D('appointments', null))
                return (
                    E('Modo offline: mostrando datos locales', 'info'),
                    void (await Go())
                );
            (await (async function () {
                try {
                    const e = await w('status');
                    return (
                        !!e.authenticated && (e.csrfToken && v(e.csrfToken), !0)
                    );
                } catch (e) {
                    return (E('No se pudo verificar la sesion', 'warning'), !1);
                }
            })())
                ? await Go()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (Ia({ reason: 'paused' }),
                          co(!1, { source: 'logout', announce: !1 }),
                          Bi(),
                          (gi.practiceMode = !1),
                          (gi.practiceState = null),
                          Hi(),
                          Po(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })(),
        oo());
}
let Xo = null;
function Zo() {
    return (Xo || (Xo = Yo()), Xo);
}
export { Zo as bootLegacyAdminAuto };
