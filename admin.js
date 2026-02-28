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
    o = e || {};
}
function g(e) {
    i = e;
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
    ((o.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${C(r[t])}</div>\n            <div class="toast-message">${C(e)}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="close-toast" aria-label="Cerrar notificación">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        a.appendChild(o),
        setTimeout(() => {
            o.parentElement &&
                ((o.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => o.remove(), 300));
        }, 5e3));
}
function _(e) {
    const t = Number(e);
    return Number.isFinite(t) ? `${t.toFixed(1)}%` : '0%';
}
function A(e) {
    const t = Number(e);
    return !Number.isFinite(t) || t < 0
        ? '0'
        : Math.round(t).toLocaleString('es-EC');
}
function q(e) {
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
                w('data'),
                w('health').catch(() => null),
            ]),
            n = e.data || {},
            a = Array.isArray(n.appointments) ? n.appointments : [];
        (u(a), x('appointments', a));
        const o = Array.isArray(n.callbacks)
            ? n.callbacks.map((e) => ({ ...e, status: N(e.status) }))
            : [];
        (d(o), x('callbacks', o));
        const i = Array.isArray(n.reviews) ? n.reviews : [];
        (m(i), x('reviews', i));
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
                        const o = H(t, [
                                'queue_tickets',
                                'queueTickets',
                                'tickets',
                            ]),
                            i = H(t, [
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
                                o = String(
                                    e.ticketCode || e.ticket_code || ''
                                ).trim(),
                                i = a
                                    ? `id:${a}`
                                    : o
                                      ? `code:${o}`
                                      : 'tmp:' + s++,
                                c = r.get(i) || {},
                                l = String(
                                    t || e.status || c.status || 'waiting'
                                ).toLowerCase(),
                                u = Number(
                                    e.assignedConsultorio ??
                                        e.assigned_consultorio ??
                                        c.assignedConsultorio ??
                                        0
                                );
                            r.set(i, {
                                id: a || Number(c.id || 0) || s++,
                                ticketCode: o || c.ticketCode || '--',
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
                        for (const e of o) c(e, String(e?.status || 'waiting'));
                        for (const e of i) c(e, 'waiting');
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
            const o = H(t, [
                    'nextTickets',
                    'next_tickets',
                    'waitingTickets',
                    'waiting_tickets',
                ]),
                i = P(t, ['waitingCount', 'waiting_count'], Number.NaN),
                r = P(t, ['calledCount', 'called_count'], Number.NaN),
                s = Number.isFinite(i)
                    ? i
                    : P(n, ['waiting', 'waiting_count'], o.length),
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
                nextTickets: Array.isArray(o)
                    ? o.map((e, t) => ({
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
    const o = document.getElementById(e);
    if (!o) return;
    const i = (function (e) {
        return Array.isArray(e)
            ? e
                  .map((e) => ({
                      label: String(e && e.label ? e.label : 'unknown'),
                      count: q(e && e.count ? e.count : 0),
                  }))
                  .filter((e) => e.count > 0)
                  .sort((e, t) => t.count - e.count)
            : [];
    })(t).slice(0, 6);
    if (0 === i.length)
        return void (o.innerHTML = `<p class="empty-message">${C(a)}</p>`);
    const r = i.reduce((e, t) => e + t.count, 0);
    o.innerHTML = i
        .map((e) => {
            const t = r > 0 ? _((e.count / r) * 100) : '0%';
            return `\n            <div class="funnel-row">\n                <span class="funnel-row-label">${C(n(e.label))}</span>\n                <span class="funnel-row-count">${C(A(e.count))} (${C(t)})</span>\n            </div>\n        `;
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
    const u = document.getElementById('totalNoShows');
    u && (u.textContent = A(l));
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
    0 === o.length
        ? (p.innerHTML = '<p class="empty-message">No hay citas para hoy</p>')
        : (p.innerHTML = o
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
            totalNoShows: o = 0,
        }) {
            const i = document.getElementById('operationPendingReviewCount'),
                r = document.getElementById('operationPendingCallbacksCount'),
                s = document.getElementById('operationTodayLoadCount'),
                c = document.getElementById('operationQueueHealth'),
                l = document.getElementById('operationRefreshSignal'),
                u = document.getElementById('operationActionList');
            if (!(i && r && s && c && l && u)) return;
            ((i.textContent = A(e)),
                (r.textContent = A(t)),
                (s.textContent = A(n)));
            const d = 3 * e + 2 * t + Math.max(0, n - 6) + o;
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
                    meta: `${A(e)} comprobante(s) por validar en citas`,
                    action: 'context-open-appointments-transfer',
                    cta: 'Revisar',
                }),
                t > 0 &&
                    m.push({
                        icon: 'fa-phone',
                        title: 'Callbacks por contactar',
                        meta: `${A(t)} solicitud(es) de llamada sin gestionar`,
                        action: 'context-open-callbacks-pending',
                        cta: 'Atender',
                    }),
                n > 0 &&
                    m.push({
                        icon: 'fa-calendar-day',
                        title: 'Agenda de hoy',
                        meta: `${A(n)} cita(s) activas para seguimiento inmediato`,
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
                n = q(t.viewBooking),
                a = q(t.startCheckout),
                o = q(t.bookingConfirmed),
                s = q(t.checkoutAbandon);
            q(t.startRatePct);
            const c = q(t.confirmedRatePct) || (a > 0 ? (o / a) * 100 : 0),
                l = q(t.abandonRatePct) || (a > 0 ? (s / a) * 100 : 0),
                u = document.getElementById('funnelViewBooking');
            u && (u.textContent = A(n));
            const d = document.getElementById('funnelStartCheckout');
            d && (d.textContent = A(a));
            const m = document.getElementById('funnelBookingConfirmed');
            m && (m.textContent = A(o));
            const p = document.getElementById('funnelAbandonRate');
            p && (p.textContent = _(l));
            const f = document.getElementById('checkoutConversionRate');
            f && (f.textContent = _(c));
            const g = q(e.events && e.events.booking_error),
                b = q(e.events && e.events.checkout_error),
                y = a > 0 ? ((g + b) / a) * 100 : 0,
                h = document.getElementById('bookingErrorRate');
            h && (h.textContent = _(y));
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
let oe = [];
const ie = new Set();
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
        re)
    );
}
function fe(e) {
    const t = ce(),
        n = e.filter((e) => me(e)).length,
        a = e.filter((e) => me(e) && ie.has(de(e))).length,
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
              const o = n ? ye(e.fecha) : 0,
                  i = a ? ye(t.fecha) : 0;
              if (i !== o) return i - o;
              const r = be(e.fecha),
                  s = be(t.fecha);
              return (r ? r.getTime() : 0) - (s ? s.getTime() : 0);
          })
        : n.sort((e, t) => {
              const n = be(e.fecha),
                  a = be(t.fecha),
                  o = n ? n.getTime() : 0;
              return (a ? a.getTime() : 0) - o;
          });
}
function Se() {
    if (se) return;
    const e = document.getElementById('callbacksGrid');
    if (!e) return;
    const n = ce();
    (n.sortSelect instanceof HTMLSelectElement &&
        n.sortSelect.addEventListener('change', () => {
            ke({
                filter: te.filter,
                search: te.search,
                sort: n.sortSelect.value || X,
            });
        }),
        n.selectVisibleBtn instanceof HTMLButtonElement &&
            n.selectVisibleBtn.addEventListener('click', () => {
                !(function () {
                    const e = oe.filter((e) => me(e));
                    0 !== e.length
                        ? (e.forEach((e) => {
                              ie.add(de(e));
                          }),
                          ke({
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
                (ie.clear(),
                    fe(oe),
                    ke({
                        filter: te.filter,
                        search: te.search,
                        sort: te.sort,
                    }));
            }),
        n.markSelectedBtn instanceof HTMLButtonElement &&
            n.markSelectedBtn.addEventListener('click', () => {
                !(async function () {
                    const e =
                        0 === ie.size
                            ? []
                            : t.filter((e) => me(e) && ie.has(de(e)));
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
                        : (await R(),
                          ie.clear(),
                          ke({
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
                    n && (t ? ie.add(n) : ie.delete(n), fe(oe));
                })(t.dataset.callbackSelectKey || '', t.checked);
        }),
        (se = !0));
}
function we() {
    ke({
        filter: ce().filterSelect?.value || Y,
        sort: ce().sortSelect?.value || te.sort,
    });
}
function ke(e, { preserveSearch: n = !0 } = {}) {
    (pe(), Se());
    const a = ce(),
        o = a.searchInput?.value ?? te.search,
        i = a.sortSelect?.value ?? te.sort,
        r = n ? (e.search ?? o) : (e.search ?? ''),
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
                            o = be(e.fecha),
                            i = o ? ge(o) : '';
                        return (
                            ('pending' !== n.filter || 'pendiente' === t) &&
                            ('contacted' !== n.filter || 'contactado' === t) &&
                            ('today' !== n.filter || i === a) &&
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
            sort: e.sort ?? i,
            search: r,
        });
    ((te.filter = s.criteria.filter),
        (te.sort = s.criteria.sort),
        (te.search = s.criteria.search),
        (oe = s.filtered),
        (function (e) {
            const t = new Set(e.filter((e) => me(e)).map((e) => de(e)));
            Array.from(ie).forEach((e) => {
                t.has(e) || ie.delete(e);
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
                                  o = String(e.fecha || ''),
                                  i = de(e),
                                  r = encodeURIComponent(i),
                                  s = be(o)?.getTime() || 0,
                                  c = ye(o),
                                  l = 'pendiente' === t,
                                  u = l && ie.has(i),
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
                    toolbarMeta: o,
                    toolbarState: i,
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
            o &&
                (o.innerHTML = [
                    `<span class="toolbar-chip is-accent">Mostrando ${C(String(d))}${m !== d ? ` de ${C(String(m))}` : ''}</span>`,
                    `<span class="toolbar-chip">Pendientes: ${C(String(p))}</span>`,
                    `<span class="toolbar-chip">Contactados: ${C(String(f))}</span>`,
                    '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
                ].join(''));
            const g = n.filter !== Y,
                b = '' !== n.search,
                y = n.sort !== X;
            if (i)
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
                        (i.innerHTML = e.join('')));
                } else
                    i.innerHTML =
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
                o = document.getElementById('callbacksOpsTodayCount'),
                i = document.getElementById('callbacksOpsNext'),
                r = document.getElementById('callbacksOpsNextBtn');
            if (!(t && n && a && o && i)) return;
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
                (o.textContent = C(String(p))),
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
                    (i.innerHTML =
                        '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>'),
                    void (r instanceof HTMLButtonElement && (r.disabled = !0))
                );
            const g = be(f.callback.fecha),
                b = g ? g.toLocaleString('es-EC') : 'Fecha no disponible';
            ((i.innerHTML = `\n        <div class="callbacks-ops-next-card">\n            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>\n            <strong class="callbacks-ops-next-phone">${C(f.callback.telefono || 'Sin teléfono')}</strong>\n            <span class="callbacks-ops-next-meta">Espera: ${C(he(f.minutesWaiting))} | Preferencia: ${C(B(f.callback.preferencia))}</span>\n            <span class="callbacks-ops-next-meta">Registrado: ${C(b)}</span>\n        </div>\n    `),
                r instanceof HTMLButtonElement && (r.disabled = !1));
        })(t));
}
function Ce(e, { preserveSearch: t = !0 } = {}) {
    ke({ filter: e }, { preserveSearch: t });
}
function Ee() {
    ke({ search: ce().searchInput?.value || '' });
}
function _e() {
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
let Ae = !1;
function qe(e, t = 'muted') {
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
    const e = await w('push-config'),
        t = String(e.publicKey || '');
    if (!t) throw new Error('VAPID public key no disponible');
    return t;
}
async function Be() {
    const e = await navigator.serviceWorker.ready,
        t = await e.pushManager.getSubscription();
    return (
        Me(Boolean(t)),
        qe(t ? 'activo' : 'disponible', t ? 'ok' : 'muted'),
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
                      (await w('push-unsubscribe', {
                          method: 'POST',
                          body: { endpoint: t.endpoint },
                      }),
                      await t.unsubscribe());
              })(),
              qe('disponible', 'muted'),
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
                      await w('push-subscribe', {
                          method: 'POST',
                          body: { subscription: a },
                      }),
                      a
                  );
              })(),
              qe('activo', 'ok'),
              E('Notificaciones activadas', 'success'));
    } catch (e) {
        (qe('error', 'error'),
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
    (e?.key && e.key !== xe) ||
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
    ot = new Set(['comfortable', 'compact']),
    it = new Set([
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
    return it.has(t) ? t : nt;
}
function lt(e) {
    const t = String(e || '').trim();
    return at.has(t) ? t : et;
}
function ut(e) {
    const t = String(e || '').trim();
    return ot.has(t) ? t : tt;
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
        o = 'noshow' === a ? 'no_show' : a,
        i = (function (e, t = new Date()) {
            const n = rt(e);
            return n
                ? (n.getTime() - t.getTime()) / 36e5
                : Number.POSITIVE_INFINITY;
        })(e, t),
        r = 'pending_transfer_review' === n,
        s = 'no_show' === o,
        c = 'completed' === o,
        l = !(c || 'cancelled' === o || s),
        u = l && Number.isFinite(i) && i < -2,
        d = l && Number.isFinite(i) && i >= -2 && i <= 24,
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
        u
            ? b.push({ tone: 'is-warning', label: 'Atrasada' })
            : d && b.push({ tone: 'is-accent', label: 'Proxima <24h' }),
        f && b.push({ tone: 'is-muted', label: 'Reagendar no-show' }),
        {
            status: o,
            isPendingTransfer: r,
            isOverdue: u,
            isImminent: d,
            requiresNoShowFollowUp: f,
            priorityScore: g,
            hoursUntil: i,
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
                        const t = rt(e);
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
                        const t = pt(e, i);
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
                        `<span class="toolbar-chip is-accent">Mostrando ${C(String(i))}${r !== i ? ` de ${C(String(r))}` : ''}</span>`,
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
        const o = (function (e, t) {
            const n = lt(t),
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
                    const n = ft(e) - ft(t);
                    if (0 !== n) return n;
                    const a = pt(e),
                        i = pt(t);
                    return a.hoursUntil !== i.hoursUntil
                        ? a.hoursUntil - i.hoursUntil
                        : o(e, t);
                }
                return -o(e, t);
            });
        })(t, n?.sort || et);
        a.innerHTML = o
            .map((e) => {
                const t = String(e.status || 'confirmed'),
                    n = String(e.paymentStatus || ''),
                    a = 'pending_transfer_review' === n,
                    o = 'cancelled' === t,
                    i = 'no_show' === t || 'noshow' === t,
                    r = pt(e),
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
            const o = ct(e?.filter || nt),
                i = lt(e?.sort || et),
                r = String(e?.search || '').trim(),
                s = (function () {
                    const { appointmentsSection: e } = st();
                    return e?.classList.contains('appointments-density-compact')
                        ? 'compact'
                        : 'comfortable';
                })(),
                c = o !== nt,
                l = r.length > 0,
                u = i !== et || s !== tt;
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
                        })(o)
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
                        })(i)
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
        o = ct(e),
        i = !1 !== t.preserveSearch;
    (n && (n.value = o), !i && a && (a.value = ''), gt());
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
        o = URL.createObjectURL(a),
        i = document.createElement('a');
    ((i.href = o),
        (i.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`),
        document.body.appendChild(i),
        i.click(),
        document.body.removeChild(i),
        URL.revokeObjectURL(o),
        E('CSV exportado correctamente', 'success'));
}
let wt = null,
    kt = new Date(),
    Ct = !1,
    Et = null,
    _t = {},
    At = !1;
const qt = 'admin-availability-day-clipboard',
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
    _t = Tt(e);
}
function Mt() {
    const e = Tt(a),
        t = Tt(_t);
    return Array.from(new Set([...Object.keys(e), ...Object.keys(t)]))
        .sort()
        .filter((n) => {
            const a = e[n] || [],
                o = t[n] || [];
            return a.length !== o.length || a.some((e, t) => e !== o[t]);
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
                const e = JSON.parse(localStorage.getItem(qt) || 'null');
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
            return void localStorage.setItem(qt, JSON.stringify(Et));
        localStorage.removeItem(qt);
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
    return wt ? Pt(a[wt] || []) : [];
}
function zt(e, t) {
    const n = String(e || '').trim();
    if (!n) return;
    const o = Pt(t);
    0 !== o.length ? (a[n] = o) : delete a[n];
}
function Ut(e, t) {
    const n = Nt(e),
        a = Number(t);
    if (!n || !Number.isFinite(a)) return [];
    const o = Math.max(0, Math.round(a));
    return 0 === o
        ? []
        : Array.from({ length: o }, (e, t) => {
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
    t && (kt = new Date(t.getFullYear(), t.getMonth(), 1));
}
function Wt(e, t) {
    const n = Nt(e);
    if (!n) return;
    const a = Number(t);
    if (!Number.isFinite(a) || 0 === a) return;
    const o = new Date(n);
    o.setDate(n.getDate() + a);
    const i = Bt(o);
    (Kt(i), un(i));
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
            'google' === String(o.source || 'store')
                ? 'Google Calendar'
                : 'Local',
        n = Ct ? 'Solo lectura' : 'Editable',
        i = String(wt || '').trim(),
        r = i ? (Array.isArray(a[i]) ? a[i].length : 0) : null;
    if (!i)
        return void (e.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${C(t)}</span>`,
            `<span class="availability-summary-chip ${Ct ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${C(n)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join(''));
    const s = Nt(i),
        c = s
            ? s.toLocaleDateString('es-EC', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
              })
            : i;
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
    const n = Boolean(String(wt || '').trim()),
        o = Ot(),
        i = o.length > 0,
        r = n ? Ut(wt, 7) : [],
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
        (d instanceof HTMLButtonElement && (d.disabled = !n || !i),
        m instanceof HTMLButtonElement && (m.disabled = !n || !u || Ct),
        p instanceof HTMLButtonElement && (p.disabled = !n || !i || Ct),
        f instanceof HTMLButtonElement && (f.disabled = !n || !i || Ct),
        g instanceof HTMLButtonElement && (g.disabled = !n || !i || Ct),
        b instanceof HTMLButtonElement && (b.disabled = !n || 0 === s || Ct),
        e.classList.toggle('is-hidden', !n && !u),
        !n && !u)
    )
        return void (t.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>');
    const y = [];
    (n &&
        (y.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${C(jt(wt))}</span>`
        ),
        y.push(
            `<span class="toolbar-chip is-muted">Slots: ${C(String(o.length))}</span>`
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
    const o = Mt(),
        i = o.length,
        r = o
            .slice(0, 2)
            .map((e) => jt(e))
            .join(', ');
    if (Ct)
        t.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    else if (0 === i)
        t.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    else {
        const e = `${i} día${1 === i ? '' : 's'} con cambios pendientes`,
            n = r ? ` (${C(r)}${i > 2 ? '…' : ''})` : '';
        t.innerHTML = `<span class="toolbar-chip is-info">${C(e)}${n}</span>`;
    }
    (n instanceof HTMLButtonElement &&
        ((n.disabled = Ct || 0 === i || At),
        n.setAttribute('aria-busy', String(At))),
        a instanceof HTMLButtonElement && (a.disabled = 0 === i || At));
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
    const a = String(o.source || 'store'),
        i = String(o.mode || 'live'),
        r = String(o.timezone || 'America/Guayaquil'),
        s = String(o.calendarAuth || 'n/d'),
        c = !1 === o.calendarTokenHealthy ? 'no' : 'si',
        l = !1 === o.calendarConfigured ? 'no' : 'si',
        u = !1 === o.calendarReachable ? 'no' : 'si',
        d = Gt(o.generatedAt),
        m = Gt(o.calendarLastSuccessAt),
        p = Gt(o.calendarLastErrorAt),
        f = String(o.calendarLastErrorReason || '').trim();
    if ('google' === a) {
        const n = 'blocked' === i ? 'bloqueado' : 'live';
        if (
            ((e.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${C(n)}</strong> | TZ: <strong>${C(r)}</strong>`),
            t)
        ) {
            let e = `Auth: <strong>${C(s)}</strong> | Token OK: <strong>${C(c)}</strong> | Configurado: <strong>${C(l)}</strong> | Reachable: <strong>${C(u)}</strong> | Ultimo exito: <strong>${C(m)}</strong> | Snapshot: <strong>${C(d)}</strong>`;
            ('blocked' === i &&
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
    const g = o.doctorCalendars;
    if (!g || 'object' != typeof g) return void (n.innerHTML = '');
    const b = (e, t) => {
        const n = g[e];
        if (!n || 'object' != typeof n) return `${t}: n/d`;
        const a = C(String(n.idMasked || 'n/d')),
            o = String(n.openUrl || '');
        return /^https:\/\/calendar\.google\.com\//.test(o)
            ? `${t}: ${a} <a href="${C(o)}" target="_blank" rel="noopener noreferrer">Abrir</a>`
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
    const e = Boolean(String(wt || '').trim()),
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
    const e = kt.getFullYear(),
        t = kt.getMonth(),
        n = new Date(e, t, 1).getDay(),
        o = new Date(e, t + 1, 0).getDate(),
        i = new Date(e, t, 0).getDate();
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
        const t = i - e,
            n = document.createElement('div');
        ((n.className = 'calendar-day other-month'),
            (n.textContent = t),
            r.appendChild(n));
    }
    for (let n = 1; n <= o; n += 1) {
        const o = Bt(new Date(e, t, n)),
            i = document.createElement('div');
        ((i.className = 'calendar-day'),
            (i.textContent = n),
            (i.tabIndex = 0),
            i.setAttribute('role', 'button'),
            i.setAttribute('aria-label', `Seleccionar ${o}`),
            wt === o && i.classList.add('selected'),
            s === o && i.classList.add('today'),
            a[o] && a[o].length > 0 && i.classList.add('has-slots'),
            i.addEventListener('click', () => un(o)),
            i.addEventListener('keydown', (e) =>
                'Enter' === e.key || ' ' === e.key
                    ? (e.preventDefault(), void un(o))
                    : 'ArrowLeft' === e.key
                      ? (e.preventDefault(), void Wt(o, -1))
                      : 'ArrowRight' === e.key
                        ? (e.preventDefault(), void Wt(o, 1))
                        : 'ArrowUp' === e.key
                          ? (e.preventDefault(), void Wt(o, -7))
                          : void (
                                'ArrowDown' === e.key &&
                                (e.preventDefault(), Wt(o, 7))
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
function on(e) {
    (kt.setMonth(kt.getMonth() + e), an());
}
function rn() {
    const e = new Date();
    ((kt = new Date(e.getFullYear(), e.getMonth(), 1)), an(), un(Bt(e)));
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
        const o = Dt(e) ? String(e).trim() : Bt(new Date()),
            i = t ? (e) => e >= o : (e) => e > o;
        return n.find(i) || n[0];
    })({ referenceDate: wt || Bt(new Date()), includeReference: !1 });
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
    ((wt = e), t && xt(e), an());
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
    const o = encodeURIComponent(String(e || ''));
    ((n.innerHTML = t
        .slice()
        .sort()
        .map(
            (e) =>
                `\n        <div class="time-slot-item${Ct ? ' is-readonly' : ''}">\n            <span class="time">${C(e)}</span>\n            <div class="slot-actions">\n                ${Ct ? '<span class="slot-readonly-tag">Solo lectura</span>' : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${o}" data-time="${encodeURIComponent(String(e || ''))}">\n                    <i class="fas fa-trash"></i>\n                </button>`}\n            </div>\n        </div>\n    `
        )
        .join('')),
        Yt(),
        Xt(),
        Zt());
}
function mn() {
    (an(), wt ? dn(wt) : tn());
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
                if (At) return !1;
                ((At = !0), Zt());
                try {
                    const e = Tt(a);
                    return (
                        p(e),
                        await w('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        $t(a),
                        !0
                    );
                } finally {
                    ((At = !1), Zt());
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
          ) && (p(Tt(_t)), mn(), E('Cambios pendientes descartados', 'success'))
        : E('No hay cambios pendientes por descartar', 'info');
}
function bn() {
    return Ct
        ? (E(
              'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
              'warning'
          ),
          !1)
        : !!wt || (E('Selecciona una fecha primero', 'warning'), !1);
}
function yn() {
    if (!wt) return void E('Selecciona una fecha para copiar', 'warning');
    const e = Ot();
    0 !== e.length
        ? (Rt(wt, e),
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
                  `Reemplazar ${t.length} horario${1 === t.length ? '' : 's'} en ${jt(wt)} con ${e.length}?`
              )) ||
          (pn(() => {
              zt(wt, e);
          }),
          E('Horarios pegados en cambios pendientes', 'success'));
}
async function vn() {
    if (!bn()) return;
    const e = Ot();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Nt(wt);
    if (!t) return void E('Fecha seleccionada invalida', 'error');
    const n = new Date(t);
    n.setDate(t.getDate() + 1);
    const o = Bt(n),
        i = Pt(a[o] || []);
    (i.length > 0 &&
        !confirm(
            `${jt(o)} ya tiene ${i.length} horario${1 === i.length ? '' : 's'}. Deseas reemplazarlos?`
        )) ||
        (pn(() => {
            (zt(o, e), Rt(wt, e));
        }),
        Kt(o),
        un(o),
        E(`Horarios duplicados a ${jt(o)} (pendiente de guardar)`, 'success'));
}
async function Sn() {
    if (!bn()) return;
    const e = Ot();
    if (0 === e.length)
        return void E('No hay horarios para duplicar en este dia', 'warning');
    const t = Ut(wt, 8).slice(1);
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
                Rt(wt, e));
        }),
        E(
            `Horarios duplicados a los proximos ${t.length} dias (pendiente de guardar)`,
            'success'
        ));
}
async function wn() {
    if (!bn()) return;
    const e = Ot();
    0 !== e.length
        ? confirm(
              `Eliminar ${e.length} horario${1 === e.length ? '' : 's'} de ${jt(wt)}?`
          ) &&
          (pn(() => {
              zt(wt, []);
          }),
          Kt(wt),
          un(wt),
          E('Horarios del dia eliminados (pendiente de guardar)', 'success'))
        : E('No hay horarios que limpiar en este dia', 'warning');
}
async function kn() {
    if (!bn()) return;
    const e = Ut(wt, 7);
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
        `Eliminar ${n} horario(s) en ${t.length} dia(s) desde ${jt(wt)}?`
    ) &&
        (pn(() => {
            t.forEach((e) => {
                zt(e, []);
            });
        }),
        Kt(wt),
        un(wt),
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
const _n = {
        appt_overdue: 'Cita vencida',
        appt_current: 'Cita vigente',
        walk_in: 'Walk-in',
    },
    An = new Set(['completed', 'no_show', 'cancelled']),
    qn = new Set(['waiting', 'called']),
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
    let o = Bn(t, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (0 === o.length) {
        const e = Nn(t, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        e && (o = Object.values(e).filter(Boolean));
    }
    const i = Bn(t, [
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
        callingNow: Array.isArray(o) ? o : [],
        nextTickets: Array.isArray(i) ? i : [],
    };
}
function Hn() {
    In.fallbackContext = null;
}
function Fn(e, { reason: t = 'state_fallback' } = {}) {
    const n = xn(e),
        a = Number(n.waitingCount || 0),
        o = Number(n.calledCount || 0),
        i = Array.isArray(n.nextTickets) ? n.nextTickets.length : 0,
        r = Array.isArray(n.callingNow) ? n.callingNow.length : 0,
        s = Math.max(0, a + o),
        c = Math.max(0, i + r);
    In.fallbackContext = {
        reason: String(t || 'state_fallback'),
        waitingCount: Math.max(0, a),
        calledCount: Math.max(0, o),
        nextTicketsCount: Math.max(0, i),
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
        o = n % 60;
    return o <= 0 ? `${a}m` : `${a}m ${o}s`;
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
        o =
            n.data.queueMeta && 'object' == typeof n.data.queueMeta
                ? n.data.queueMeta
                : null;
    (y(a), h(o), Hn(), Aa());
    const i = Math.max(0, Date.now() - Date.parse(String(n.savedAt || '')));
    return (
        Wn('reconnecting', `Respaldo local activo (${jn(i)})`, {
            log: !0,
            level: 'warning',
            reason: 'Respaldo local',
        }),
        Rn('snapshot_restored', { source: t, ageMs: i, queueCount: a.length }),
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
        o = ['info', 'warning', 'error'].includes(t) ? t : 'info',
        i = In.activityLog[0] || null;
    (i && i.message === n && i.level === o && a - Number(i.ts || 0) < 2e3) ||
        ((In.activitySeq = Number(In.activitySeq || 0) + 1),
        In.activityLog.unshift({
            id: In.activitySeq,
            ts: a,
            level: o,
            message: n,
        }),
        (In.activityLog = In.activityLog.slice(0, 15)),
        Vn());
}
function Wn(e, t, { log: n = !1, level: a = 'info', reason: o = '' } = {}) {
    const i = String(e || 'paused').toLowerCase(),
        r = String(t || '').trim(),
        s =
            i !== String(In.syncState || 'paused') ||
            r !== String(In.syncMessage || '');
    if (
        ((function (e, t) {
            const n = document.getElementById('queueSyncStatus'),
                a = String(e || 'paused').toLowerCase(),
                o = {
                    live: 'Cola en vivo',
                    reconnecting: 'Reintentando sincronizacion',
                    offline: 'Sin conexion al backend',
                    paused: 'Cola en pausa',
                },
                i = String(t || '').trim() || o[a] || o.paused;
            ((In.syncState = a),
                (In.syncMessage = i),
                n ? ((n.dataset.state = a), (n.textContent = i), Vn()) : Vn());
        })(i, r),
        s && Rn('sync_state', { state: i, message: r }),
        !n || !s)
    )
        return s;
    const c = String(o || '').trim();
    return (Kn(c ? `${c}: ${r || i}` : r || i, { level: a }), s);
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
        qa();
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
                        o = new Blob([`\ufeff${a}`], {
                            type: 'text/csv;charset=utf-8',
                        }),
                        i = `turnero-resumen-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`,
                        r = URL.createObjectURL(o),
                        s = document.createElement('a');
                    ((s.href = r),
                        (s.download = i),
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
            let o = 0,
                i = 0,
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
                    Number.isFinite(l) && ea(l, n) && (o += 1));
                const p = d ?? u ?? l;
                if (
                    ('completed' === t &&
                        Number.isFinite(p) &&
                        ea(p, n) &&
                        (i += 1),
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
            const l = i + r;
            return {
                ticketsToday: o,
                completedToday: i,
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
        o = document.getElementById('queueOpsAvgWait'),
        i = document.getElementById('queueOpsP95Wait'),
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
        o && (o.textContent = ta(e.avgWaitMinutes)),
        i && (i.textContent = ta(e.p95WaitMinutes)),
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
function oa(e) {
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
        o = Array.isArray(t.callingNow) ? t.callingNow : [];
    for (const e of o) {
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
function ia(e, t = []) {
    const n = xn(e),
        a = new Map();
    if (Array.isArray(t))
        for (const e of t) {
            const t = Number(e?.id || 0);
            t && a.set(t, e);
        }
    const o = new Map(),
        i = String(n.updatedAt || '').trim() || new Date().toISOString(),
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
                l = String(e.createdAt ?? e.created_at ?? r.createdAt ?? i),
                u = String(e.calledAt ?? e.called_at ?? r.calledAt ?? i),
                d = String(
                    e.completedAt ?? e.completed_at ?? r.completedAt ?? ''
                ),
                m = Number.isFinite(n) ? `#${n}` : '--';
            o.set(n, {
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
                completedAt: An.has(s) ? d || i : '',
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
        0 === o.size &&
        Number(n.waitingCount || 0) + Number(n.calledCount || 0) > 0
    )
        for (const e of a.values()) {
            const t = String(e?.status || '').toLowerCase();
            qn.has(t) && r(e, t);
        }
    return Array.from(o.values());
}
function ra(e, t = '') {
    const n = Array.isArray(e) ? e : [],
        a = [],
        o = [];
    for (const e of n) {
        const t = String(e?.status || '').toLowerCase();
        'waiting' === t ? a.push(e) : 'called' === t && o.push(e);
    }
    (a.sort((e, t) => {
        const n = ca(e?.priorityClass) - ca(t?.priorityClass);
        if (0 !== n) return n;
        const a = Date.parse(String(e?.createdAt || '')),
            o = Date.parse(String(t?.createdAt || ''));
        return Number.isFinite(a) && Number.isFinite(o) && a !== o
            ? a - o
            : Number(e?.id || 0) - Number(t?.id || 0);
    }),
        o.sort((e, t) => {
            const n = Date.parse(String(e?.calledAt || e?.updatedAt || '')),
                a = Date.parse(String(t?.calledAt || t?.updatedAt || ''));
            return Number.isFinite(n) && Number.isFinite(a) && n !== a
                ? a - n
                : Number(t?.id || 0) - Number(e?.id || 0);
        }));
    const i = { 1: null, 2: null };
    for (const e of o) {
        const t = Number(e?.assignedConsultorio || 0);
        (1 !== t && 2 !== t) || i[String(t)] || (i[String(t)] = e);
    }
    return {
        updatedAt: String(t || '').trim() || new Date().toISOString(),
        waitingCount: a.length,
        calledCount: o.length,
        counts: {
            waiting: a.length,
            called: o.length,
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
        callingNowByConsultorio: i,
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
        o = Math.round((a - t) / 6e4);
    return o >= 0 ? o : 0;
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
            const o = ua(e),
                i = ua(t);
            if (Number.isFinite(o) && Number.isFinite(i) && o !== i)
                return i - o;
            const r = Date.parse(String(e?.createdAt || '')),
                s = Date.parse(String(t?.createdAt || ''));
            return Number.isFinite(r) && Number.isFinite(s) && r !== s
                ? r - s
                : Number(e?.id || 0) - Number(t?.id || 0);
        }));
    var t;
    const n = la(In.activeFilter),
        a = String(In.searchTerm || ''),
        o = e.filter(
            (e) =>
                (function (e, t) {
                    const n = la(t),
                        a = String(e?.status || '').toLowerCase(),
                        o = String(e?.queueType || '').toLowerCase();
                    return (
                        'all' === n ||
                        ('waiting' === n
                            ? 'waiting' === a
                            : 'called' === n
                              ? 'called' === a
                              : 'sla_risk' === n
                                ? da(e)
                                : 'appointments' === n
                                  ? 'appointment' === o
                                  : 'walk_in' !== n || 'walk_in' === o)
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
        i = e.filter(
            (e) => 'waiting' === String(e?.status || '').toLowerCase()
        ).length,
        r = e.filter(
            (e) => 'called' === String(e?.status || '').toLowerCase()
        ).length,
        c = e.filter((e) => da(e)).length;
    return {
        tickets: o,
        totalCount: e.length,
        waitingCount: i,
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
                      !qn.has(a) ||
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
        o = await a.text();
    let i;
    try {
        i = o ? JSON.parse(o) : {};
    } catch (e) {
        throw new Error('Respuesta invalida del servidor');
    }
    const r =
        i && 'object' == typeof i
            ? { ...i, statusCode: a.status }
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
function wa(e) {
    return document.querySelector(
        `#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${e}"]`
    );
}
function ka(e, t) {
    const n = wa(e),
        a = (function (e) {
            const t = `queueReleaseC${e}`,
                n = document.getElementById(t);
            if (n instanceof HTMLButtonElement) return n;
            const a = document.querySelector(
                '#queue .queue-admin-header-actions'
            );
            if (!(a instanceof HTMLElement)) return null;
            const o = document.createElement('button');
            ((o.type = 'button'),
                (o.id = t),
                (o.className = 'btn btn-secondary btn-sm'),
                (o.dataset.action = 'queue-ticket-action'),
                (o.dataset.queueAction = 'liberar'),
                (o.dataset.queueConsultorio = String(e)),
                (o.disabled = !0),
                (o.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${e}`));
            const i = wa(e);
            return (
                i?.parentElement === a && i.nextSibling
                    ? a.insertBefore(o, i.nextSibling)
                    : a.appendChild(o),
                o
            );
        })(e),
        o = `Consultorio ${e}`,
        i = Boolean(t && t.id),
        r = In.pendingCallByConsultorio.has(String(e));
    if (n instanceof HTMLButtonElement) {
        const e = i || r;
        if (((n.disabled = e), r)) n.title = `Procesando llamado para ${o}`;
        else if (i) {
            const e = String(t?.ticketCode || '--');
            n.title = `${o} ocupado por ${e}`;
        } else n.title = `Llamar siguiente turno en ${o}`;
    }
    if (!(a instanceof HTMLButtonElement)) return;
    if (((a.disabled = !i), !i))
        return (
            delete a.dataset.queueId,
            (a.title = `Sin turno activo en ${o}`),
            void (a.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${e}`)
        );
    const s = String(t?.ticketCode || '--');
    ((a.dataset.queueId = String(t?.id || '')),
        (a.title = `Liberar ${s} de ${o}`),
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
                        void Aa()
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
                        ((In.searchTerm = ''), Aa());
            }),
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    ((In.searchTerm = n.value || ''), Aa());
                })));
}
function _a() {
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
        s && (s.textContent = Xn(e.updatedAt)));
    const l = e?.callingNowByConsultorio?.[1],
        u = e?.callingNowByConsultorio?.[2];
    if (
        (o &&
            (o.textContent = l
                ? `${l.ticketCode || '--'} · ${l.patientInitials || '--'}`
                : 'Sin llamado'),
        i &&
            (i.textContent = u
                ? `${u.ticketCode || '--'} · ${u.patientInitials || '--'}`
                : 'Sin llamado'),
        ka(1, l),
        ka(2, u),
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
function Aa() {
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
                            o = fa(n);
                        ((t.textContent = `${o} visibles (${a})`),
                            (t.disabled = In.bulkActionInFlight || 0 === a),
                            t.setAttribute(
                                'aria-disabled',
                                String(t.disabled)
                            ));
                    }));
            const o = t.querySelector('[data-action="queue-bulk-reprint"]');
            if (o instanceof HTMLButtonElement) {
                const t = (Array.isArray(e?.tickets) ? e.tickets : []).length;
                ((o.textContent = `Reimprimir visibles (${t})`),
                    (o.disabled =
                        In.bulkReprintInFlight ||
                        In.bulkActionInFlight ||
                        0 === t),
                    o.setAttribute('aria-disabled', String(o.disabled)));
            }
            const i = document.getElementById('queueTriageSummary');
            if (i instanceof HTMLElement) {
                const t = Number(e?.tickets?.length || 0),
                    n = Number(e?.totalCount || 0),
                    a = Number(e?.riskCount || 0),
                    o = Number(e?.waitingCount || 0),
                    r = Pn();
                let s = '';
                (In.bulkActionInFlight
                    ? (s = ' · ejecutando accion masiva...')
                    : In.bulkReprintInFlight &&
                      (s = ' · reimprimiendo tickets visibles...'),
                    r?.partial &&
                        (s += ` · fallback parcial ${r.sampledCount}/${r.knownCount}`),
                    (i.textContent = `${t}/${n} visibles · ${o} en espera · ${a} en riesgo SLA${s}`));
            }
        })(e),
        _a(),
        aa(),
        (function (e) {
            const t = document.getElementById('queueTableBody');
            if (!t) return;
            const n = Array.isArray(e?.tickets) ? e.tickets : [];
            if (0 === n.length) {
                const n = Number(e?.totalCount || 0),
                    a = la(e?.activeFilter || 'all'),
                    o = String(e?.searchTerm || '').trim(),
                    i = Pn();
                let r = 'Sin tickets en cola.';
                if (n > 0 && ('all' !== a || '' !== o)) {
                    const e = [];
                    ('all' !== a && e.push(`filtro "${Ca(a)}"`),
                        '' !== o && e.push(`búsqueda "${o}"`),
                        (r = `No hay tickets para ${e.join(' y ')}.`));
                } else
                    'all' === a &&
                        '' === o &&
                        i &&
                        i.knownCount > 0 &&
                        (r = `Cola en fallback: backend reporta ${i.knownCount} ticket(s) activos. Refresca para vista completa.`);
                return void (t.innerHTML = `\n            <tr>\n                <td colspan="8" class="empty-message">${C(r)}</td>\n            </tr>\n        `);
            }
            t.innerHTML = n
                .map((e) => {
                    const t = Number(e.id || 0),
                        n = String(e.status || 'waiting'),
                        a = 'waiting' === n || 'called' === n,
                        o = 'called' === n,
                        i = An.has(n),
                        r = !i,
                        s = !i,
                        c = In.reprintInFlightIds.has(String(t)),
                        l = ua(e),
                        u = da(e),
                        d = u ? 'queue-row-risk' : '',
                        m = Number.isFinite(l) ? `${l}m` : '--';
                    return `\n                <tr class="${d}">\n                    <td>${C(e.ticketCode || '--')}</td>\n                    <td>${C(e.queueType || '--')}</td>\n                    <td>${C(_n[e.priorityClass] || e.priorityClass || '--')}</td>\n                    <td class="queue-status-cell">\n                        <span>${C(Cn[n] || n)}</span>\n                        ${u ? '<small class="queue-risk-note">SLA > 20m</small>' : ''}\n                    </td>\n                    <td>${C(e.assignedConsultorio || '-')}</td>\n                    <td>\n                        <span>${C(Xn(e.createdAt))}</span>\n                        <small class="queue-wait-note">Espera: ${C(m)}</small>\n                    </td>\n                    <td>${C(e.patientInitials || '--')}</td>\n                    <td>\n                        <div class="queue-actions">\n                            <button\n                                type="button"\n                                class="btn btn-secondary btn-sm"\n                                data-action="queue-reprint-ticket"\n                                data-queue-id="${t}"\n                                ${c ? 'disabled aria-disabled="true"' : ''}\n                            >\n                                ${c ? 'Reimprimiendo...' : 'Reimprimir'}\n                            </button>\n                            ${a ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${t}">\n                                Re-llamar\n                            </button>` : ''}\n                            ${o ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${t}">\n                                Liberar\n                            </button>` : ''}\n                            ${r ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${t}">\n                                Completar\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${t}">\n                                No show\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${t}">\n                                Cancelar\n                            </button>` : ''}\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C1\n                            </button>\n                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${t}" ${s ? '' : 'disabled'}>\n                                C2\n                            </button>\n                        </div>\n                    </td>\n                </tr>\n            `;
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
async function qa() {
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
        const a = await w('queue-state'),
            o = xn(a?.data || {});
        return (
            y(ia(o, s)),
            h(oa(o)),
            Fn(o, { reason: n }),
            (In.lastRefreshMode = 'state_fallback'),
            Rn('sync_fallback_queue_state', {
                source: e ? 'realtime' : 'manual',
                reason: String(n || 'data_error'),
                queueCount: Number(o.waitingCount || 0),
            }),
            Aa(),
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
        const n = (await w('data')).data || {},
            a =
                n.queueState && 'object' == typeof n.queueState
                    ? n.queueState
                    : n.queue_state && 'object' == typeof n.queue_state
                      ? n.queue_state
                      : null,
            o = Array.isArray(n.queue_tickets)
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
            i = Array.isArray(o),
            r = i && 0 === o.length,
            l =
                n.queueMeta && 'object' == typeof n.queueMeta
                    ? n.queueMeta
                    : n.queue_meta && 'object' == typeof n.queue_meta
                      ? n.queue_meta
                      : a && 'object' == typeof a
                        ? a
                        : null,
            u = l ? oa(l) : null;
        let d = i ? ia({ queue_tickets: o }, s) : [],
            m = !1;
        if ((!i || r) && u) {
            const e = Number(u.waitingCount || 0) + Number(u.calledCount || 0);
            e > 0 &&
                ((d = ia(u, s)),
                Fn(u, { reason: 'data_missing_queue_tickets_meta' }),
                (m = !0),
                Rn('sync_fallback_queue_meta', {
                    source: t ? 'realtime' : 'manual',
                    queueCount: e,
                }));
        }
        const p = Array.isArray(s)
                ? s.filter((e) => qn.has(String(e?.status || '').toLowerCase()))
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
            (!i || r) &&
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
            Aa());
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
                ? (Wn('live', 'Sincronizando cola...'), Qn(), void qa())
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
async function Ba(e, t, n = null, { silent: a = !1, skipRender: o = !1 } = {}) {
    try {
        const i = await (async function (e, t, n = null) {
            const a = Number(e || 0);
            if (!a || !t) throw new Error('Accion de ticket invalida');
            const o = { id: a, action: t },
                i = Number(n || 0);
            [1, 2].includes(i) && (o.consultorio = i);
            const r = await w('queue-ticket', { method: 'PATCH', body: o }),
                c = r?.data?.ticket || null;
            ba(c);
            const l =
                r?.data?.queueState ||
                r?.data?.queue_state ||
                r?.data?.queueMeta ||
                r?.data?.queue_meta ||
                null;
            return (h(l ? oa(l) : ra(s, new Date().toISOString())), c);
        })(e, t, n);
        return (
            o || Aa(),
            a ||
                (Kn(Sa(t, i?.ticketCode || ''), { level: 'info' }),
                E(Sa(t, i?.ticketCode || ''), 'success')),
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
        Aa(),
        Rn('bulk_action_started', { action: t, requested: n.length }));
    let a = 0,
        o = 0;
    try {
        for (const e of n)
            (await Ba(Number(e?.id || 0), t, null, {
                silent: !0,
                skipRender: !0,
            }))
                ? (a += 1)
                : (o += 1);
        await $a({ silent: !0 });
    } finally {
        ((In.bulkActionInFlight = !1), Aa());
    }
    return a > 0 && 0 === o
        ? (Kn(`Bulk ${t}: ${a} ticket(s) procesados`, { level: 'info' }),
          E(`${fa(t)} aplicado a ${a} ticket(s).`, 'success'),
          Rn('bulk_action_success', { action: t, success: a, failed: o }),
          { ok: !0, success: a, failed: o })
        : a > 0
          ? (Kn(`Bulk ${t}: ${a} exitos y ${o} fallos`, { level: 'warning' }),
            E(`${fa(t)} parcial: ${a} exitos, ${o} fallos.`, 'warning'),
            Rn('bulk_action_partial', { action: t, success: a, failed: o }),
            { ok: !0, success: a, failed: o })
          : (Kn(`Bulk ${t}: fallo total`, { level: 'error' }),
            E(
                `No se pudo aplicar ${fa(t).toLowerCase()} en tickets visibles.`,
                'error'
            ),
            Rn('bulk_action_failed', { action: t, success: a, failed: o }),
            { ok: !1, success: a, failed: o });
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
        Aa(),
        Rn('bulk_reprint_started', { requested: n.length }));
    let a = 0,
        o = 0;
    try {
        for (const e of n) {
            const t = Number(e?.id || 0);
            if (t)
                try {
                    const e = await ha(t);
                    e.payload?.printed ? (a += 1) : (o += 1);
                } catch (e) {
                    o += 1;
                }
            else o += 1;
        }
    } finally {
        ((In.bulkReprintInFlight = !1), Aa());
    }
    return a > 0 && 0 === o
        ? (Kn(`Bulk reimpresion: ${a} ticket(s) reimpresos`, { level: 'info' }),
          E(`Reimpresion completa: ${a} ticket(s).`, 'success'),
          Rn('bulk_reprint_success', { success: a, failed: o }),
          { ok: !0, success: a, failed: o })
        : a > 0
          ? (Kn(`Bulk reimpresion parcial: ${a} exitos y ${o} fallos`, {
                level: 'warning',
            }),
            E(`Reimpresion parcial: ${a} exitos, ${o} fallos.`, 'warning'),
            Rn('bulk_reprint_partial', { success: a, failed: o }),
            { ok: !0, success: a, failed: o })
          : (Kn('Bulk reimpresion: fallo total', { level: 'error' }),
            E('No se pudo reimprimir tickets visibles.', 'error'),
            Rn('bulk_reprint_failed', { success: a, failed: o }),
            { ok: !1, success: a, failed: o });
}
function xa(e) {
    ((In.activeFilter = la(e)), Aa());
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
    eo = new Set(['numpadsubtract', 'kpsubtract']),
    to = new Set(['-', 'subtract', 'minus']),
    no = new Set(['numpaddecimal', 'kpdecimal']),
    ao = new Set(['.', ',', 'decimal', 'separator', 'delete', 'del']),
    oo = 'queueNumpadHelpOpen',
    io = new Set(['completar', 'no_show', 'cancelar', 'reasignar']),
    ro = 'queuePracticeCoachInlineStyles',
    so = Object.freeze([
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
    co = Object.freeze([
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
    lo = {
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
let uo = 0,
    mo = 0;
const po = { mode: Ja, consultorio: 1, oneTapAdvance: !1 },
    fo = {
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
    };
function go(e, t = {}) {
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
function bo(e, t = !1) {
    try {
        const n = localStorage.getItem(e);
        return null === n ? Boolean(t) : '1' === n || 'true' === n;
    } catch (e) {
        return Boolean(t);
    }
}
function yo(e, t) {
    try {
        localStorage.setItem(e, t ? '1' : '0');
    } catch (e) {}
}
function ho() {
    const e = {};
    return (
        co.forEach((t) => {
            e[t.id] = !1;
        }),
        e
    );
}
function vo(e) {
    const t = ho();
    return e && 'object' == typeof e
        ? (co.forEach((n) => {
              t[n.id] = Boolean(e[n.id]);
          }),
          t)
        : t;
}
function So() {
    return (
        fo.onboardingProgress || (fo.onboardingProgress = ho()),
        fo.onboardingProgress
    );
}
function wo() {
    const e = So();
    return co.reduce((t, n) => (e[n.id] ? t + 1 : t), 0);
}
function ko() {
    const e = document.getElementById('queueOnboardingChecklist'),
        t = document.getElementById('queueOnboardingProgressPill'),
        n = document.getElementById('queueOnboardingMeta'),
        a = So(),
        o = co.length,
        i = wo();
    (e instanceof HTMLElement &&
        (e.innerHTML = co
            .map(
                (e) =>
                    `<li class="queue-practice-step${Boolean(a[e.id]) ? ' is-done' : ''}">${e.label}</li>`
            )
            .join('')),
        t instanceof HTMLElement && (t.textContent = `${i}/${o}`),
        n instanceof HTMLElement &&
            (n.textContent =
                i >= o
                    ? 'Checklist completado. Puedes cerrar la guía o iniciar práctica cuando quieras.'
                    : `Paso ${Math.min(o, i + 1)} de ${o}. Completa los pasos para dejar esta estación lista.`));
}
function Co(e, { source: t = 'manual', announce: n = !1 } = {}) {
    const a = String(e || '')
        .trim()
        .toLowerCase();
    if (!a) return !1;
    if (!co.some((e) => e.id === a)) return !1;
    const o = So();
    if (o[a]) return !1;
    ((o[a] = !0),
        (function (e) {
            try {
                localStorage.setItem(Wa, JSON.stringify(vo(e)));
            } catch (e) {}
        })(o),
        ko());
    const i = wo(),
        r = co.length;
    return (
        go('onboarding_step_completed', {
            source: t,
            stepId: a,
            completedCount: i,
            totalSteps: r,
        }),
        n &&
            E(
                i >= r
                    ? 'Checklist de guía completado.'
                    : `Guía: paso ${i}/${r} completado.`,
                i >= r ? 'success' : 'info'
            ),
        !0
    );
}
function Eo() {
    return document.getElementById('queueShortcutPanel');
}
function _o(e) {
    const t = ei(e);
    if (!t) return 'Numpad Enter';
    const { code: n, key: a, location: o } = t;
    return 'numpadenter' === n || 'kpenter' === n
        ? 'Numpad Enter'
        : ('enter' !== a && 'return' !== a) || 3 !== o
          ? 'enter' === a || 'return' === a
              ? 'Enter externo'
              : a && 3 === o
                ? `${a.toUpperCase()} (numpad)`
                : a
                  ? 1 === a.length
                      ? a.toUpperCase()
                      : a
                  : n || 'Tecla externa'
          : 'Enter (numpad)';
}
function Ao() {
    const e = Eo(),
        t = document.querySelector('[data-action="queue-toggle-shortcuts"]');
    (e instanceof HTMLElement &&
        ((e.hidden = !fo.helpOpen),
        e.setAttribute('aria-hidden', String(!fo.helpOpen))),
        t instanceof HTMLButtonElement &&
            (t.setAttribute('aria-pressed', String(fo.helpOpen)),
            (t.textContent = fo.helpOpen ? 'Ocultar atajos' : 'Atajos numpad')),
        (function () {
            const e = Eo();
            if (!(e instanceof HTMLElement)) return;
            const t = e.querySelector('ul');
            if (!(t instanceof HTMLElement)) return;
            let n = t.querySelector('[data-queue-one-tap-hint]');
            n instanceof HTMLLIElement ||
                ((n = document.createElement('li')),
                (n.dataset.queueOneTapHint = '1'),
                t.appendChild(n));
            const a = Zo(po.oneTapAdvance, !1);
            n.innerHTML = a
                ? '<strong>Modo 1 tecla:</strong> activo. Numpad Enter completa ticket activo y llama siguiente.'
                : '<strong>Modo 1 tecla:</strong> desactivado. Flujo recomendado: Numpad . y luego Numpad Enter.';
        })(),
        (function () {
            const e = Eo();
            if (!(e instanceof HTMLElement)) return;
            const t = e.querySelector('ul');
            if (!(t instanceof HTMLElement)) return;
            let n = t.querySelector('[data-queue-call-key-hint]');
            if (
                (n instanceof HTMLLIElement ||
                    ((n = document.createElement('li')),
                    (n.dataset.queueCallKeyHint = '1'),
                    t.appendChild(n)),
                fo.customCallKey)
            ) {
                const e = _o(fo.customCallKey);
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
function qo(e, { announce: t = !1, source: n = 'manual' } = {}) {
    ((fo.helpOpen = Boolean(e)),
        yo(oo, fo.helpOpen),
        Ao(),
        fo.helpOpen && Co('shortcuts_opened', { source: n, announce: !1 }),
        go('shortcut_panel_toggled', { source: n, open: fo.helpOpen }),
        t &&
            E(
                fo.helpOpen
                    ? 'Panel de atajos numpad visible'
                    : 'Panel de atajos numpad oculto',
                'info'
            ));
}
function Lo({ source: e = 'manual', announce: t = !0 } = {}) {
    qo(!fo.helpOpen, { source: e, announce: t });
}
function To() {
    return document.getElementById('queueOnboardingPanel');
}
function $o() {
    const e = {};
    return (
        so.forEach((t) => {
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
function Mo() {
    const e = fo.practiceState;
    return e && e.completed && 'object' == typeof e.completed
        ? so.reduce((t, n) => (e.completed[n.id] ? t + 1 : t), 0)
        : 0;
}
function Io() {
    fo.practiceTickId &&
        (window.clearInterval(fo.practiceTickId), (fo.practiceTickId = 0));
}
function Bo() {
    const e = (function () {
        let e = document.getElementById('queuePracticeCoachPanel');
        if (e instanceof HTMLElement) return e;
        if (!(document.getElementById('queue') instanceof HTMLElement))
            return null;
        const t = To();
        return t instanceof HTMLElement
            ? ((function () {
                  if (document.getElementById(ro)) return;
                  const e = document.createElement('style');
                  ((e.id = ro),
                      (e.textContent =
                          "\n        #queue .queue-practice-coach {\n            margin-top: 0.75rem;\n            border: 1px solid var(--admin-border, #d8e1f0);\n            border-radius: 16px;\n            padding: 0.9rem 1rem;\n            background: linear-gradient(160deg, #f6f9ff, #ffffff);\n        }\n        #queue .queue-practice-coach-header {\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            gap: 0.6rem;\n            margin-bottom: 0.48rem;\n        }\n        #queue .queue-practice-coach-header h4 {\n            margin: 0;\n            font-size: 1rem;\n        }\n        #queue .queue-practice-progress {\n            font-size: 0.86rem;\n            font-weight: 700;\n            color: #1f4f9f;\n            background: #eaf2ff;\n            border-radius: 999px;\n            padding: 0.15rem 0.55rem;\n        }\n        #queue .queue-practice-meta {\n            margin: 0 0 0.5rem;\n            color: #4f5d73;\n            font-size: 0.9rem;\n        }\n        #queue .queue-practice-steps {\n            margin: 0;\n            padding-left: 1.1rem;\n            display: grid;\n            gap: 0.3rem;\n        }\n        #queue .queue-practice-step.is-done {\n            color: #0d7a4a;\n            font-weight: 600;\n        }\n        #queue .queue-practice-step.is-done::marker {\n            content: '✓ ';\n            color: #0d7a4a;\n        }\n        #queue .queue-practice-actions {\n            margin-top: 0.62rem;\n            display: flex;\n            justify-content: flex-end;\n        }\n        #queue .queue-onboarding-header {\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            gap: 0.6rem;\n            margin-bottom: 0.35rem;\n        }\n        #queue .queue-onboarding-panel .queue-practice-meta {\n            margin: 0 0 0.5rem;\n        }\n        #queue .queue-onboarding-panel .queue-practice-steps {\n            margin: 0 0 0.55rem;\n            padding-left: 1.1rem;\n            display: grid;\n            gap: 0.3rem;\n        }\n    "),
                      document.head.appendChild(e));
              })(),
              (e = document.createElement('section')),
              (e.id = 'queuePracticeCoachPanel'),
              (e.className = 'queue-practice-coach'),
              e.setAttribute('aria-label', 'Práctica guiada turnero'),
              (e.hidden = !0),
              (e.innerHTML = `\n        <div class="queue-practice-coach-header">\n            <h4>Práctica guiada</h4>\n            <span id="queuePracticeProgressPill" class="queue-practice-progress">0/${so.length}</span>\n        </div>\n        <p id="queuePracticeMeta" class="queue-practice-meta">\n            Activa práctica para ensayar sin afectar la cola real.\n        </p>\n        <ol id="queuePracticeStepsList" class="queue-practice-steps"></ol>\n        <div class="queue-practice-actions">\n            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reset-practice">\n                Reiniciar práctica\n            </button>\n        </div>\n    `),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    })();
    if (!(e instanceof HTMLElement)) return;
    const t = Boolean(fo.practiceMode);
    if (((e.hidden = !t), !t)) return;
    const n = Mo(),
        a = so.length,
        o = document.getElementById('queuePracticeProgressPill');
    o instanceof HTMLElement && (o.textContent = `${n}/${a}`);
    const i = document.getElementById('queuePracticeMeta');
    if (i instanceof HTMLElement) {
        const e = fo.practiceState,
            t = Number(e?.actionsCount || 0),
            o = (function () {
                const e = fo.practiceState;
                if (!e || !Number.isFinite(e.startedAt) || e.startedAt <= 0)
                    return '00:00';
                const t = Math.max(
                    0,
                    Math.floor((Date.now() - Number(e.startedAt || 0)) / 1e3)
                );
                return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            })();
        i.textContent =
            n >= a
                ? `Práctica completada en ${o}. Acciones simuladas: ${t}.`
                : `Paso ${Math.min(a, n + 1)} de ${a}. Tiempo: ${o}.`;
    }
    !(function () {
        const e = document.getElementById('queuePracticeStepsList');
        if (!(e instanceof HTMLElement)) return;
        const t = fo.practiceState?.completed || {};
        e.innerHTML = so
            .map(
                (e) =>
                    `<li class="queue-practice-step${Boolean(t[e.id]) ? ' is-done' : ''}">${e.label}</li>`
            )
            .join('');
    })();
}
function No(
    e,
    { source: t = 'manual', consultorio: n = null, ticketId: a = null } = {}
) {
    if (!fo.practiceMode) return;
    fo.practiceState || (fo.practiceState = $o());
    const o = fo.practiceState;
    ((o.actionsCount = Number(o.actionsCount || 0) + 1),
        (o.lastActionAt = Date.now()));
    const i = (function (e) {
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
    i && !o.completed[i] && ((o.completed[i] = !0), (r = !0));
    const s = Mo(),
        c = so.length,
        l = s >= c;
    (l && !o.completedAt && (o.completedAt = Date.now()),
        Bo(),
        l && Co('practice_completed', { source: t, announce: !1 }),
        go('practice_action_simulated', {
            source: t,
            action: e,
            stepId: i || null,
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
function Do({ source: e = 'manual', announce: t = !1 } = {}) {
    ((fo.practiceState = $o()),
        Bo(),
        go('practice_progress_reset', { source: e, totalSteps: so.length }),
        t && E('Práctica reiniciada desde el paso 1.', 'info'));
}
function xo() {
    const e = Boolean(fo.practiceMode),
        t = document.getElementById('queuePracticeModeBadge');
    t instanceof HTMLElement && (t.hidden = !e);
    const n = document.querySelector('[data-action="queue-stop-practice"]');
    (n instanceof HTMLButtonElement && (n.hidden = !e), Bo());
}
function Ho(e, { source: t = 'manual' } = {}) {
    ((fo.practiceMode = Boolean(e)),
        fo.practiceMode
            ? (Do({ source: t, announce: !1 }),
              Io(),
              (fo.practiceTickId = window.setInterval(() => {
                  fo.practiceMode ? Bo() : Io();
              }, 1e3)))
            : (Io(), (fo.practiceState = null)));
    try {
        window.__PIEL_QUEUE_PRACTICE_MODE = fo.practiceMode;
    } catch (e) {}
    (xo(),
        go(
            fo.practiceMode
                ? 'practice_mode_enabled'
                : 'practice_mode_disabled',
            { source: t, stationMode: po.mode, consultorio: po.consultorio }
        ));
}
function Fo(
    e,
    { source: t = 'manual', consultorio: n = null, ticketId: a = null } = {}
) {
    (E(`Modo práctica: "${e}" simulado${n ? ` en C${n}` : ''}.`, 'info'),
        No(e, { source: t, consultorio: n, ticketId: a }));
}
function Po(e, { persist: t = !1, source: n = 'manual' } = {}) {
    const a = To(),
        o = Boolean(e);
    ((fo.onboardingVisible = o),
        a instanceof HTMLElement &&
            ((a.hidden = !o), a.setAttribute('aria-hidden', String(!o))),
        !o && t && yo(Ka, !0),
        ko(),
        Bo(),
        go(o ? 'onboarding_opened' : 'onboarding_closed', { source: n }));
}
function Ro() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}
function jo(e, t = 'dashboard') {
    const n = String(e || '').trim();
    return n && new Set(Ro().map((e) => e.dataset.section)).has(n) ? n : t;
}
function Oo() {
    const e = window.location.hash.replace(/^#/, '').trim();
    return e
        ? jo(e, 'dashboard')
        : (function () {
              try {
                  return jo(localStorage.getItem(Ra), 'dashboard');
              } catch (e) {
                  return 'dashboard';
              }
          })();
}
function zo() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        Oo() ||
        'dashboard'
    );
}
function Uo() {
    return window.innerWidth <= 1024;
}
function Vo() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}
function Ko() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}
function Wo(e) {
    const t = document.getElementById('adminSidebarCollapse');
    if (!(t instanceof HTMLButtonElement)) return;
    const n = e ? 'Expandir navegación lateral' : 'Contraer navegación lateral';
    (t.setAttribute('aria-pressed', String(e)),
        t.setAttribute('aria-label', n),
        t.setAttribute('title', n));
}
function Go(e, { persist: t = !0 } = {}) {
    if (!document.body) return !1;
    const n = Boolean(!Uo() && e);
    return (
        document.body.classList.toggle('admin-sidebar-collapsed', n),
        Wo(n),
        t &&
            (function (e) {
                try {
                    localStorage.setItem(ja, e ? '1' : '0');
                } catch (e) {}
            })(n),
        n
    );
}
function Jo() {
    Uo()
        ? Go(!1, { persist: !1 })
        : Go(
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
function Qo(e) {
    const t = jo(e, 'dashboard');
    (Ro().forEach((e) => {
        const n = e.dataset.section === t;
        (e.classList.toggle('active', n),
            n
                ? e.setAttribute('aria-current', 'page')
                : e.removeAttribute('aria-current'),
            e instanceof HTMLButtonElement &&
                e.setAttribute('aria-pressed', String(n)));
    }),
        (function (e) {
            const t = jo(e, 'dashboard');
            try {
                localStorage.setItem(Ra, t);
            } catch (e) {}
        })(t));
}
function Yo(e, t = Ja) {
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return n === Ga || n === Ja ? n : t;
}
function Xo(e, t = 1) {
    const n = Number(e || 0);
    return 1 === n || 2 === n ? n : t;
}
function Zo(e, t = !1) {
    if ('boolean' == typeof e) return e;
    const n = String(e || '')
        .trim()
        .toLowerCase();
    return (
        !!['1', 'true', 'yes', 'on', 'enabled'].includes(n) ||
        (!['0', 'false', 'no', 'off', 'disabled'].includes(n) && Boolean(t))
    );
}
function ei(e, t = null) {
    if (!e || 'object' != typeof e) return t;
    const n = String(e.code || '')
            .trim()
            .toLowerCase(),
        a = String(e.key || '')
            .trim()
            .toLowerCase(),
        o = Number(e.location),
        i = Number.isFinite(o) ? Math.max(0, Math.min(3, Math.round(o))) : null;
    return n || a ? { code: n, key: a, location: i } : t;
}
function ti(e, t) {
    try {
        (localStorage.setItem(Oa, Yo(e, Ja)),
            localStorage.setItem(za, String(Xo(t, 1))));
    } catch (e) {}
}
function ni(e) {
    try {
        localStorage.setItem(Ua, e ? '1' : '0');
    } catch (e) {}
}
function ai() {
    return po.mode === Ga;
}
function oi(e) {
    const t = Xo(e, 0);
    return !(![1, 2].includes(t) || (ai() && t !== po.consultorio));
}
function ii() {
    const e = document.getElementById('queue');
    if (!(e instanceof HTMLElement)) return;
    const t = Yo(po.mode, Ja),
        n = Xo(po.consultorio, 1),
        a = Zo(po.oneTapAdvance, !1),
        o = ei(fo.customCallKey, null),
        i = Boolean(fo.captureCallKeyMode);
    ((e.dataset.stationMode = t),
        (e.dataset.stationConsultorio = String(n)),
        (e.dataset.oneTapAdvance = a ? '1' : '0'),
        (e.dataset.customCallKey = o ? '1' : '0'),
        (e.dataset.captureCallKeyMode = i ? '1' : '0'));
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
        (o && (e += ` Tecla externa activa: ${_o(o)}.`),
            i &&
                (e +=
                    ' Calibración en curso: presiona la tecla deseada o Esc para cancelar.'),
            (c.textContent = e));
    }
    document
        .querySelectorAll('[data-action="queue-lock-station"]')
        .forEach((e) => {
            if (!(e instanceof HTMLButtonElement)) return;
            const a = Xo(e.dataset.queueConsultorio || 0, 0),
                o = t === Ga && a === n;
            (e.classList.toggle('is-active', o),
                (e.disabled = t === Ga),
                e.setAttribute('aria-pressed', String(o)));
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
        (m.classList.toggle('is-active', i),
        m.setAttribute('aria-pressed', String(i)),
        i
            ? ((m.textContent = 'Escuchando tecla...'),
              (m.title =
                  'Presiona la tecla externa de llamado (Esc para cancelar)'))
            : o
              ? ((m.textContent = 'Recalibrar tecla externa'),
                (m.title = `Tecla actual: ${_o(o)}`))
              : ((m.textContent = 'Calibrar tecla externa'),
                (m.title = 'Asigna una tecla externa para llamar siguiente'))),
        p instanceof HTMLButtonElement &&
            ((p.hidden = !o),
            (p.disabled = i),
            p.setAttribute('aria-hidden', String(!o)),
            o
                ? (p.title = `Quitar tecla externa (${_o(o)})`)
                : p.removeAttribute('title')),
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
                const a = Xo(e.dataset.queueConsultorio || 0, 0),
                    o = t === Ga && a !== n;
                if (
                    (e.classList.toggle('is-station-blocked', o),
                    e instanceof HTMLButtonElement &&
                        e.setAttribute('aria-disabled', String(e.disabled)),
                    o)
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
            }),
        Ao());
}
function ri(
    e,
    { persist: t = !0, announce: n = !1, source: a = 'manual' } = {}
) {
    const o = Zo(e, !1),
        i = o !== po.oneTapAdvance;
    ((po.oneTapAdvance = o),
        t && ni(o),
        ii(),
        n &&
            i &&
            E(
                o
                    ? 'Modo 1 tecla activado: Numpad Enter completa y llama siguiente.'
                    : 'Modo 1 tecla desactivado: vuelve flujo completar + llamar.',
                o ? 'success' : 'info'
            ),
        i &&
            go('one_tap_mode_toggled', {
                source: a,
                enabled: o,
                stationMode: po.mode,
                consultorio: po.consultorio,
            }));
}
function si(
    e,
    { persist: t = !0, announce: n = !0, source: a = 'manual' } = {}
) {
    const o = ei(e, null);
    if (
        ((fo.customCallKey = o),
        t &&
            (function (e) {
                try {
                    const t = ei(e, null);
                    if (!t) return void localStorage.removeItem(Va);
                    localStorage.setItem(Va, JSON.stringify(t));
                } catch (e) {}
            })(o),
        ii(),
        o)
    )
        return (
            go('call_key_binding_saved', {
                source: a,
                binding: o,
                stationMode: po.mode,
                consultorio: po.consultorio,
            }),
            void (n && E(`Tecla externa guardada: ${_o(o)}.`, 'success'))
        );
    (go('call_key_binding_cleared', {
        source: a,
        stationMode: po.mode,
        consultorio: po.consultorio,
    }),
        n &&
            E(
                'Tecla externa eliminada. Se usa Numpad Enter estándar.',
                'info'
            ));
}
function ci(e, { source: t = 'manual', announce: n = !0 } = {}) {
    const a = Boolean(e);
    a !== fo.captureCallKeyMode &&
        ((fo.captureCallKeyMode = a),
        ii(),
        go(a ? 'call_key_capture_started' : 'call_key_capture_stopped', {
            source: t,
            stationMode: po.mode,
            consultorio: po.consultorio,
        }),
        n &&
            E(
                a
                    ? 'Calibración activa: presiona la tecla externa para llamar siguiente.'
                    : 'Calibración detenida.',
                a ? 'info' : 'warning'
            ));
}
function li(
    { mode: e = po.mode, consultorio: t = po.consultorio },
    { persist: n = !0, announce: a = !1, source: o = 'manual' } = {}
) {
    const i = Yo(e, po.mode),
        r = Xo(t, po.consultorio),
        s = i !== po.mode,
        c = r !== po.consultorio;
    ((po.mode = i),
        (po.consultorio = r),
        n && ti(i, r),
        ii(),
        i === Ga && Co('station_locked', { source: o, announce: !1 }),
        a &&
            (s || c) &&
            (i === Ga
                ? E(`Estación bloqueada en C${r}`, 'success')
                : E(`Estación en modo libre (C${r})`, 'info')),
        (s || c) &&
            go('station_config_updated', {
                source: o,
                mode: i,
                consultorio: r,
                changedMode: s,
                changedConsultorio: c,
            }));
}
function ui(e) {
    const t = Number(e?.location);
    return Number.isFinite(t) ? Math.max(0, Math.min(3, Math.round(t))) : 0;
}
function di(e) {
    return ei({ code: pi(e), key: fi(e), location: ui(e) }, null);
}
function mi(e, t) {
    const n = String(t || '');
    if (!n) return !1;
    if (pi(e) === `numpad${n}`) return !0;
    const a = String(e.key || '').trim();
    return gi(e) && a === n;
}
function pi(e) {
    return String(e?.code || '')
        .trim()
        .toLowerCase();
}
function fi(e) {
    return String(e?.key || '')
        .trim()
        .toLowerCase();
}
function gi(e) {
    return 3 === Number(e?.location || 0);
}
function bi(e, t) {
    return gi(e) && t.has(fi(e));
}
function yi(e) {
    const t = Xo(e, 0);
    if (![1, 2].includes(t)) return 0;
    const n = document.getElementById(`queueReleaseC${t}`),
        a = Number(n?.dataset?.queueId || 0);
    return Number.isFinite(a) ? a : 0;
}
async function hi(e, { source: t = 'numpad' } = {}) {
    const n = String(e || '').toLowerCase(),
        a = Xo(po.consultorio, 0);
    if (![1, 2].includes(a))
        return (E('Consultorio de estación inválido', 'error'), !1);
    const o = yi(a);
    if (!o) return (E(`No hay ticket activo en C${a}`, 'warning'), !1);
    if (
        (function (e) {
            return io.has(String(e || '').toLowerCase());
        })(n) &&
        !(function ({ action: e, consultorio: t, source: n = 'manual' } = {}) {
            const a = String(e || '').toLowerCase(),
                o = Xo(t, 0),
                i = (function (e) {
                    const t = Xo(e, 0);
                    if (![1, 2].includes(t)) return '--';
                    const n = document.getElementById(`queueReleaseC${t}`),
                        a = String(n?.textContent || '')
                            .trim()
                            .match(/\(([^)]+)\)\s*$/);
                    return a && a[1] ? a[1].trim() : '--';
                })(o);
            return window.confirm(
                `Acción sensible: ${a} ${'--' !== i ? `(${i})` : ''} en C${o}. ¿Deseas continuar?`
            )
                ? window.confirm(
                      'Confirmación final: esta acción afectará la cola actual. ¿Confirmas ejecutar ahora?'
                  )
                    ? (go('action_confirmed', {
                          source: n,
                          action: a,
                          consultorio: o || null,
                      }),
                      !0)
                    : (go('action_cancelled', {
                          source: n,
                          action: a,
                          consultorio: o || null,
                          reason: 'second_confirm_declined',
                      }),
                      !1)
                : (go('action_cancelled', {
                      source: n,
                      action: a,
                      consultorio: o || null,
                      reason: 'first_confirm_declined',
                  }),
                  !1);
        })({ action: n, consultorio: a, source: t })
    )
        return !1;
    if (fo.practiceMode)
        return (
            E(`Modo práctica: acción "${n}" simulada en C${a}.`, 'info'),
            No(n, { source: t, consultorio: a, ticketId: o }),
            !0
        );
    const i = await Ba(o, n, a);
    return (
        i &&
            go('station_ticket_action', {
                source: t,
                action: n,
                consultorio: a,
                ticketId: o,
            }),
        i
    );
}
function vi(e, { source: t = 'manual' } = {}) {
    const n = Xo(e, 0);
    (E(
        `Cambio bloqueado por modo estación (C${po.consultorio}). Usa "Reconfigurar estación" para cambiar.`,
        'warning'
    ),
        go('station_change_blocked', {
            source: t,
            attemptedConsultorio: n || null,
            stationConsultorio: po.consultorio,
            stationMode: po.mode,
        }),
        ii());
}
function Si(e, { source: t = 'numpad' } = {}) {
    const n = Xo(e, 0);
    [1, 2].includes(n) &&
        (ai()
            ? vi(n, { source: t })
            : (li(
                  { mode: Ja, consultorio: n },
                  { persist: !0, announce: !1, source: t }
              ),
              E(`Consultorio objetivo C${n}`, 'info')));
}
async function wi(e, { source: t = 'manual' } = {}) {
    const n = Xo(e, 0);
    if (![1, 2].includes(n)) return (E('Consultorio invalido', 'error'), !1);
    const a = String(t || 'manual').toLowerCase(),
        o = a.startsWith('numpad') || 'shortcut' === a || 'command' === a;
    return !oi(n) && o
        ? (vi(n, { source: t }), !1)
        : fo.practiceMode
          ? (E(`Modo práctica: llamada simulada en C${n}.`, 'info'),
            No('call_next', { source: t, consultorio: n }),
            !0)
          : (!oi(n) &&
                ai() &&
                (E(
                    `Estación bloqueada en C${po.consultorio}. Llamando manualmente C${n}.`,
                    'warning'
                ),
                go('station_manual_override', {
                    source: t,
                    consultorio: n,
                    stationConsultorio: po.consultorio,
                })),
            ai() && go('station_locked_call', { source: t, consultorio: n }),
            'numpad' === t && E(`Llamando siguiente en C${n}`, 'info'),
            await (async function (e) {
                const t = Number(e || 0);
                if (![1, 2].includes(t))
                    return void E('Consultorio invalido', 'error');
                const n = String(t);
                if (!In.pendingCallByConsultorio.has(n)) {
                    (In.pendingCallByConsultorio.add(n), _a());
                    try {
                        const e = await w('queue-call-next', {
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
                        h(a ? oa(a) : ra(s, new Date().toISOString()));
                        try {
                            await $a({ silent: !0 });
                        } catch (e) {}
                        (Aa(),
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
                                      ticketCode: String(n.ticketCode || ''),
                                  }))
                                : (Kn(`Llamado en C${t} sin ticket asignado`, {
                                      level: 'warning',
                                  }),
                                  E(`Consultorio ${t} actualizado`, 'success'),
                                  Rn('call_next_empty', { consultorio: t })));
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
                        (In.pendingCallByConsultorio.delete(n), _a());
                    }
                }
            })(n),
            window.requestAnimationFrame(() => {
                ii();
            }),
            !0);
}
function ki(e) {
    const t = `#${e}`;
    window.location.hash !== t &&
        (window.history && 'function' == typeof window.history.replaceState
            ? window.history.replaceState(null, '', t)
            : (window.location.hash = t));
}
function Ci() {
    const e = document.getElementById('adminRefreshStatus');
    if (!e) return;
    if ((e.classList.remove('status-pill-live', 'status-pill-stale'), !uo))
        return (
            e.classList.add('status-pill-muted'),
            void (e.textContent = 'Datos: sin actualizar')
        );
    const t = Date.now(),
        n = Math.max(0, t - uo),
        a = (function (e) {
            if (!uo) return 'sin actualizar';
            const t = Math.max(0, e - uo),
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
function Ei() {
    ((uo = Date.now()), Ci());
}
function _i({ select: e = !0 } = {}) {
    const t = document.getElementById('adminQuickCommand');
    return (
        t instanceof HTMLInputElement &&
        (t.focus({ preventScroll: !0 }), e && t.select(), !0)
    );
}
function Ai(e) {
    const t = document.getElementById('adminContextTitle'),
        n = document.getElementById('adminContextActions');
    if (!t || !n) return;
    const a = lo[e && lo[e] ? e : 'dashboard'];
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
        ii());
}
function qi() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}
function Li() {
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
function Ti(e) {
    const t = document.getElementById('adminSidebar'),
        n = document.getElementById('adminMainContent'),
        a = Uo(),
        o = Boolean(a && e);
    (t && t.setAttribute('aria-hidden', String(!o && a)),
        n &&
            (o
                ? n.setAttribute('aria-hidden', 'true')
                : n.removeAttribute('aria-hidden')));
}
function $i(e) {
    const { sidebar: t, backdrop: n, toggleBtn: a } = qi();
    if (!t || !n || !a) return;
    const o = Boolean(e && Uo());
    (t.classList.toggle('is-open', o),
        n.classList.toggle('is-hidden', !o),
        n.setAttribute('aria-hidden', String(!o)),
        document.body.classList.toggle('admin-sidebar-open', o),
        a.setAttribute('aria-expanded', String(o)),
        Ti(o),
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
                const n = Li();
                n[0] instanceof HTMLElement ? n[0].focus() : e.focus();
            })());
}
function Mi({ restoreFocus: e = !1 } = {}) {
    const { toggleBtn: t } = qi(),
        n = document
            .getElementById('adminSidebar')
            ?.classList.contains('is-open');
    ($i(!1), e && n && t && t.focus());
}
function Ii(e) {
    const t = document.getElementById('adminDashboard');
    if (!t || t.classList.contains('is-hidden')) return;
    const n =
        (a = e.target) instanceof HTMLElement &&
        (!!a.isContentEditable ||
            Boolean(
                a.closest('input, textarea, select, [contenteditable="true"]')
            ));
    var a;
    const o = String(e.key || '').toLowerCase(),
        i = String(e.code || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && 'k' === o && !e.altKey && !e.shiftKey)
        return (e.preventDefault(), void _i());
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
        return (e.preventDefault(), void _i());
    if (La() && !n && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (fo.captureCallKeyMode)
            return (
                e.preventDefault(),
                void (function (e, { source: t = 'capture' } = {}) {
                    if (!fo.captureCallKeyMode) return !1;
                    if ('escape' === fi(e))
                        return (
                            ci(!1, { source: `${t}_escape`, announce: !0 }),
                            !0
                        );
                    if (e.repeat) return !0;
                    if (e.ctrlKey || e.metaKey || e.altKey) return !0;
                    if (
                        (function (e) {
                            const t = fi(e),
                                n = pi(e);
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
                                o = new Set([
                                    'shiftleft',
                                    'shiftright',
                                    'controlleft',
                                    'controlright',
                                    'altleft',
                                    'altright',
                                    'metaleft',
                                    'metaright',
                                ]);
                            return a.has(t) || o.has(n);
                        })(e)
                    )
                        return !0;
                    const n = di(e);
                    !n ||
                        (si(n, { persist: !0, announce: !0, source: t }),
                        ci(!1, { source: `${t}_saved`, announce: !1 }));
                })(e, { source: 'capture_keyboard' })
            );
        if (e.repeat) return;
        if (
            (function (e) {
                return mi(e, 0);
            })(e)
        )
            return (
                e.preventDefault(),
                void Lo({ source: 'numpad', announce: !0 })
            );
        if (
            (function (e) {
                const t = pi(e);
                return !!Xa.has(t) || bi(e, Za);
            })(e)
        )
            return (
                e.preventDefault(),
                void hi('re-llamar', { source: 'numpad_add' })
            );
        if (
            (function (e) {
                const t = pi(e);
                return !!no.has(t) || bi(e, ao);
            })(e)
        )
            return (
                e.preventDefault(),
                void hi('completar', { source: 'numpad_decimal' })
            );
        if (
            (function (e) {
                const t = pi(e);
                return !!eo.has(t) || bi(e, to);
            })(e)
        )
            return (
                e.preventDefault(),
                void hi('no_show', { source: 'numpad_subtract' })
            );
        if (mi(e, 1))
            return (e.preventDefault(), void Si(1, { source: 'numpad' }));
        if (mi(e, 2))
            return (e.preventDefault(), void Si(2, { source: 'numpad' }));
        if (
            (function (e) {
                if (
                    (function (e) {
                        const t = ei(fo.customCallKey, null);
                        if (!t) return !1;
                        const n = di(e);
                        if (!n) return !1;
                        const a = !t.code || t.code === n.code,
                            o = !t.key || t.key === n.key,
                            i =
                                'number' != typeof t.location ||
                                t.location === n.location;
                        return a && o && i;
                    })(e)
                )
                    return !0;
                const t = pi(e);
                return !!Qa.has(t) || bi(e, Ya);
            })(e)
        )
            return (
                e.preventDefault(),
                void (po.oneTapAdvance
                    ? (async function ({ source: e = 'numpad_one_tap' } = {}) {
                          const t = Xo(po.consultorio, 0);
                          if (![1, 2].includes(t))
                              return (
                                  E(
                                      'Consultorio de estación inválido',
                                      'error'
                                  ),
                                  !1
                              );
                          const n = Date.now();
                          if (fo.oneTapInFlight)
                              return (
                                  E(
                                      'Flujo 1 tecla en proceso. Espera un momento.',
                                      'warning'
                                  ),
                                  go('one_tap_blocked', {
                                      source: e,
                                      consultorio: t,
                                      reason: 'in_flight',
                                  }),
                                  !1
                              );
                          if (fo.lastOneTapAt > 0 && n - fo.lastOneTapAt < 1200)
                              return (
                                  E(
                                      'Espera un segundo antes de volver a usar Numpad Enter.',
                                      'warning'
                                  ),
                                  go('one_tap_blocked', {
                                      source: e,
                                      consultorio: t,
                                      reason: 'cooldown',
                                      cooldownMs: 1200,
                                  }),
                                  !1
                              );
                          fo.oneTapInFlight = !0;
                          try {
                              const n = yi(t);
                              let a = !1;
                              if (n)
                                  if (fo.practiceMode)
                                      (go('practice_one_tap_simulated', {
                                          source: e,
                                          consultorio: t,
                                          ticketId: n,
                                      }),
                                          No('completar', {
                                              source: e,
                                              consultorio: t,
                                              ticketId: n,
                                          }));
                                  else {
                                      if (!(await Ba(n, 'completar', t)))
                                          return !1;
                                      a = !0;
                                  }
                              const o = await wi(t, { source: e });
                              return (
                                  o &&
                                      (E(
                                          fo.practiceMode
                                              ? `Modo práctica 1 tecla en C${t}: completar + llamar simulado.`
                                              : n
                                                ? `Flujo 1 tecla en C${t}: atención cerrada y siguiente llamado.`
                                                : `Flujo 1 tecla en C${t}: llamando siguiente.`,
                                          fo.practiceMode ? 'info' : 'success'
                                      ),
                                      go('station_one_tap_executed', {
                                          source: e,
                                          consultorio: t,
                                          hadActiveTicket: Boolean(n),
                                          completedInThisFlow: a,
                                          practiceMode: fo.practiceMode,
                                      }),
                                      (fo.lastOneTapAt = Date.now())),
                                  o
                              );
                          } finally {
                              fo.oneTapInFlight = !1;
                          }
                      })({ source: 'numpad_one_tap' })
                    : wi(po.consultorio, { source: 'numpad' }))
            );
    }
    if (!e.altKey || !e.shiftKey) return;
    if (n) return;
    if ('keyr' === i)
        return (e.preventDefault(), void Hi({ showSuccessToast: !0 }));
    if ('m' === o || 'keym' === i)
        return (e.preventDefault(), Uo() ? void $i(!Vo()) : void Go(!Ko()));
    if (ln()) {
        if ('ArrowLeft' === e.key) return (e.preventDefault(), void on(-1));
        if ('ArrowRight' === e.key) return (e.preventDefault(), void on(1));
        if ('keyy' === i) return (e.preventDefault(), void rn());
        if ('keys' === i) return (e.preventDefault(), void sn());
        if ('keyd' === i) return (e.preventDefault(), void vn());
        if ('keyw' === i) return (e.preventDefault(), void Sn());
        if ('keyv' === i) return (e.preventDefault(), void hn());
        if ('keyx' === i) return (e.preventDefault(), void wn());
        if ('keyq' === i) return (e.preventDefault(), void kn());
        if ('keyg' === i) return (e.preventDefault(), void fn());
        if ('keyz' === i) return (e.preventDefault(), void gn());
    }
    if (La()) {
        if ('digit0' === i || 'numpad0' === i)
            return (
                e.preventDefault(),
                void Lo({ source: 'shortcut', announce: !1 })
            );
        if ('keyj' === i)
            return (e.preventDefault(), void wi(1, { source: 'shortcut' }));
        if ('keyk' === i)
            return (e.preventDefault(), void wi(2, { source: 'shortcut' }));
        if ('keyu' === i) return (e.preventDefault(), void $a({ silent: !1 }));
        if ('keye' === i)
            return (
                e.preventDefault(),
                void ri(!po.oneTapAdvance, {
                    persist: !0,
                    announce: !0,
                    source: 'shortcut',
                })
            );
        if ('keyf' === i) return (e.preventDefault(), void Ha());
        if ('keyl' === i) return (e.preventDefault(), void xa('sla_risk'));
        if ('keyw' === i) return (e.preventDefault(), void xa('waiting'));
        if ('keyc' === i) return (e.preventDefault(), void xa('called'));
        if ('keya' === i) return (e.preventDefault(), void xa('all'));
        if ('keyi' === i) return (e.preventDefault(), void xa('walk_in'));
        if ('keyo' === i) return (e.preventDefault(), void xa('all'));
        if ('keyg' === i)
            return (
                e.preventDefault(),
                fo.practiceMode
                    ? void Fo('bulk_completar', { source: 'shortcut' })
                    : void Na('completar')
            );
        if ('keyh' === i)
            return (
                e.preventDefault(),
                fo.practiceMode
                    ? void Fo('bulk_no_show', { source: 'shortcut' })
                    : void Na('no_show')
            );
        if ('keyb' === i)
            return (
                e.preventDefault(),
                fo.practiceMode
                    ? void Fo('bulk_cancelar', { source: 'shortcut' })
                    : void Na('cancelar')
            );
        if ('keyp' === i)
            return (
                e.preventDefault(),
                fo.practiceMode
                    ? void Fo('bulk_reprint', { source: 'shortcut' })
                    : void Da()
            );
    }
    const r =
        {
            keya: 'all',
            keyh: 'today',
            keyt: 'pending_transfer',
            keyn: 'no_show',
        }[i] || null;
    if (r) return (e.preventDefault(), void Di(r));
    const s = { keyp: 'pending', keyc: 'contacted' }[i] || null;
    if (s) return (e.preventDefault(), void xi(s));
    const c = Fa.get(i) || Fa.get(o);
    c && (e.preventDefault(), Ni(c));
}
function Bi(e, { preventScroll: t = !0 } = {}) {
    const n = document.getElementById(e);
    n &&
        (n.hasAttribute('tabindex') || n.setAttribute('tabindex', '-1'),
        window.requestAnimationFrame(() => {
            'function' == typeof n.focus && n.focus({ preventScroll: t });
        }));
}
async function Ni(e, t = {}) {
    const {
            refresh: n = !0,
            updateHash: a = !0,
            focus: o = !0,
            closeMobileNav: i = !0,
        } = t,
        r = jo(zo(), 'dashboard'),
        s = jo(e, 'dashboard');
    if (
        'availability' === r &&
        'availability' !== s &&
        It() &&
        !confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        )
    )
        return (Qo(r), a || ki(r), o && Bi(r), !1);
    if ((Qo(s), i && Mi(), n))
        try {
            (await R(), Ei());
        } catch (e) {
            E(
                `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                'warning'
            );
        }
    return (await Pi(s), a && ki(s), o && Bi(s), !0);
}
async function Di(e) {
    (await Ni('appointments', { focus: !1 }),
        yt(e, { preserveSearch: !1 }),
        Bi('appointments'));
}
async function xi(e) {
    (await Ni('callbacks', { focus: !1 }),
        Ce(e, { preserveSearch: !1 }),
        Bi('callbacks'));
}
async function Hi({ showSuccessToast: e = !1, showErrorToast: t = !0 } = {}) {
    try {
        return (
            await R(),
            Ei(),
            await Pi(zo()),
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
async function Fi(e) {
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
            _i(),
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
            await Ni('appointments', { focus: !1 }),
            St(),
            Bi('appointments'),
            !0
        );
    if (n.includes('dashboard') || n.includes('inicio'))
        return (await Ni('dashboard'), !0);
    if (
        n.includes('turnero') ||
        n.includes('cola') ||
        n.includes('consultorio')
    )
        return (
            await Ni('queue', { focus: !1 }),
            n.includes('1 tecla on') ||
            n.includes('modo 1 tecla on') ||
            n.includes('one tap on')
                ? ri(!0, { persist: !0, announce: !0, source: 'command' })
                : n.includes('1 tecla off') ||
                    n.includes('modo 1 tecla off') ||
                    n.includes('one tap off')
                  ? ri(!1, { persist: !0, announce: !0, source: 'command' })
                  : n.includes('1 tecla') ||
                      n.includes('one tap') ||
                      n.includes('modo express')
                    ? ri(!po.oneTapAdvance, {
                          persist: !0,
                          announce: !0,
                          source: 'command',
                      })
                    : n.includes('c1') || n.includes('consultorio 1')
                      ? await wi(1, { source: 'command' })
                      : n.includes('completar visibles') ||
                          n.includes('bulk completar')
                        ? fo.practiceMode
                            ? Fo('bulk_completar', { source: 'command' })
                            : await Na('completar')
                        : n.includes('no show visibles') ||
                            n.includes('bulk no show')
                          ? fo.practiceMode
                              ? Fo('bulk_no_show', { source: 'command' })
                              : await Na('no_show')
                          : n.includes('cancelar visibles') ||
                              n.includes('bulk cancelar')
                            ? fo.practiceMode
                                ? Fo('bulk_cancelar', { source: 'command' })
                                : await Na('cancelar')
                            : n.includes('reimprimir visibles') ||
                                n.includes('bulk reprint')
                              ? fo.practiceMode
                                  ? Fo('bulk_reprint', { source: 'command' })
                                  : await Da()
                              : n.includes('sla')
                                ? (xa('sla_risk'), Ha())
                                : n.includes('buscar')
                                  ? Ha()
                                  : n.includes('c2') ||
                                      n.includes('consultorio 2')
                                    ? await wi(2, { source: 'command' })
                                    : await $a({ silent: !0 }),
            Bi('queue'),
            !0
        );
    if (n.includes('resena') || n.includes('review'))
        return (await Ni('reviews'), !0);
    if (n.includes('callback'))
        return (
            await xi(
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
        return (await Di(e), n.includes('limpiar') && ht(), !0);
    }
    return n.includes('disponibilidad') ||
        n.includes('horario') ||
        n.includes('calendario')
        ? (await Ni('availability', { focus: !1 }),
          n.includes('hoy')
              ? rn()
              : n.includes('siguiente')
                ? sn()
                : (n.includes('agregar') || n.includes('nuevo horario')) &&
                  cn(),
          Bi('availability'),
          !0)
        : n.includes('actualizar') || n.includes('refrescar') || 'refresh' === n
          ? (await Hi({ showSuccessToast: !0 }), !0)
          : (E(
                'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
                'warning'
            ),
            t instanceof HTMLInputElement &&
                (t.focus({ preventScroll: !0 }), t.select()),
            !1);
}
async function Pi(e) {
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
        Ai(e),
        document
            .querySelectorAll('.admin-section')
            .forEach((e) => e.classList.remove('active')));
    const i = document.getElementById(e);
    switch (
        (i && i.classList.add('active'),
        'queue' !== e &&
            (Ia({ reason: 'paused' }),
            ci(!1, { source: 'section_change', announce: !1 })),
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
                ke({
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
                                  `\n            <div class="review-card-admin">\n                <div class="review-header-admin">\n                    <strong>${C(e.name || 'Paciente')}</strong>\n                    ${e.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}\n                </div>\n                <div class="review-rating">${'★'.repeat(Number(e.rating) || 0)}${'☆'.repeat(5 - (Number(e.rating) || 0))}</div>\n                <p>${C(e.text || '')}</p>\n                <small>${C(new Date(e.date).toLocaleDateString('es-EC'))}</small>\n            </div>\n        `
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
                                (p(Tt(t)),
                                f(r),
                                $t(a),
                                (Ct = 'google' === String(r.source || '')),
                                en(),
                                nn(),
                                wt && !Dt(wt))
                            )
                                return ((wt = null), xt(''), void tn());
                            wt ? dn(wt) : tn();
                        } catch (e) {
                            (console.error('Error refreshing availability:', e),
                                E(
                                    `Error al actualizar disponibilidad: ${e?.message || 'error desconocido'}`,
                                    'error'
                                ),
                                (Ct = 'google' === String(o.source || '')),
                                en(),
                                nn());
                        }
                    })(),
                    !wt)
                ) {
                    const e = (function () {
                        try {
                            const e = localStorage.getItem(Lt);
                            return Dt(e) ? String(e).trim() : '';
                        } catch (e) {
                            return '';
                        }
                    })();
                    Dt(e) && (wt = e);
                }
                (wt && !Dt(wt) && (wt = null),
                    wt && Kt(wt),
                    an(),
                    wt ? un(wt, { persist: !1 }) : tn());
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
                (Aa(),
                    Wn('paused', 'Sincronizacion lista'),
                    In.activityLog.length ||
                        Kn('Consola de turnero lista para operacion', {
                            level: 'info',
                        }),
                    $a({ silent: !0 }));
            })(),
                Ma({ immediate: !0 }),
                ii(),
                Ao(),
                ko(),
                bo(Ka, !1)
                    ? Po(!1, { source: 'autoload' })
                    : Po(!0, { source: 'autoload' }));
    }
}
async function Ri() {
    const e = document.getElementById('loginScreen'),
        t = document.getElementById('adminDashboard');
    (e && e.classList.add('is-hidden'), t && t.classList.remove('is-hidden'));
    const n = Oo();
    (Qo(n),
        ki(n),
        Jo(),
        Mi(),
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
                (await R(), Ei());
            } catch (e) {
                E(
                    `No se pudo actualizar datos en vivo: ${e?.message || 'error desconocido'}`,
                    'warning'
                );
            }
            const t = zo();
            await Pi(t);
        })(),
        await (async function () {
            if (Ae) return;
            Ae = !0;
            const { subscribeBtn: e, testBtn: t } = Te();
            if (e && t) {
                if (
                    'undefined' == typeof window ||
                    !('serviceWorker' in navigator) ||
                    !('PushManager' in window) ||
                    'undefined' == typeof Notification
                )
                    return ($e(!1), void qe('no soportado', 'warn'));
                try {
                    (await navigator.serviceWorker.register('/sw.js'),
                        await Ie(),
                        $e(!0),
                        qe('disponible', 'muted'),
                        e.addEventListener('click', Ne),
                        t.addEventListener('click', De),
                        await Be());
                } catch (e) {
                    ($e(!1), qe('sin configurar', 'warn'));
                }
            }
        })());
}
async function ji(e) {
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
                await Ri());
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
            await Ri());
    } catch {
        E('Contraseña incorrecta', 'error');
    }
}
function Oi() {
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
                        (E('Sesion cerrada correctamente', 'info'),
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
                            E('Datos exportados correctamente', 'success'));
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
                    void Je(i.dataset.themeMode || 'system', {
                        persist: !0,
                        animate: !0,
                    })
                );
            if ('toggle-sidebar-collapse' === r)
                return (
                    o.preventDefault(),
                    Uo() ? void $i(!Vo()) : void Go(!Ko())
                );
            if ('run-admin-command' === r) {
                o.preventDefault();
                const e = document.getElementById('adminQuickCommand');
                return void (await Fi(
                    e instanceof HTMLInputElement ? e.value : ''
                ));
            }
            if ('refresh-admin-data' === r)
                return (
                    o.preventDefault(),
                    void (await Hi({ showSuccessToast: !0 }))
                );
            if ('context-open-dashboard' === r)
                return (o.preventDefault(), void (await Ni('dashboard')));
            if ('context-open-appointments-today' === r)
                return (o.preventDefault(), void (await Di('today')));
            if ('context-open-appointments-transfer' === r)
                return (
                    o.preventDefault(),
                    void (await Di('pending_transfer'))
                );
            if ('context-open-callbacks-pending' === r)
                return (o.preventDefault(), void (await xi('pending')));
            if ('context-open-callbacks-next' === r)
                return (o.preventDefault(), await xi('pending'), void _e());
            if ('queue-refresh-state' === r)
                return (
                    o.preventDefault(),
                    await $a({ silent: !1 }),
                    void ii()
                );
            if ('queue-lock-station' === r) {
                o.preventDefault();
                const e = Xo(i.dataset.queueConsultorio || 0, 0);
                if (![1, 2].includes(e)) return;
                return void li(
                    { mode: Ga, consultorio: e },
                    { persist: !0, announce: !0, source: 'station_panel' }
                );
            }
            if ('queue-set-station-mode' === r)
                return (
                    o.preventDefault(),
                    void li(
                        {
                            mode: Yo(i.dataset.queueMode || Ja, Ja),
                            consultorio: po.consultorio,
                        },
                        { persist: !0, announce: !0, source: 'station_panel' }
                    )
                );
            if ('queue-reconfigure-station' === r) {
                if (
                    (o.preventDefault(),
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
                    li(
                        { mode: Ja, consultorio: po.consultorio },
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
                    o.preventDefault(),
                    void Lo({ source: 'button', announce: !1 })
                );
            if ('queue-open-onboarding' === r)
                return (
                    o.preventDefault(),
                    void Po(!0, { persist: !1, source: 'station_panel_button' })
                );
            if ('queue-toggle-one-tap' === r)
                return (
                    o.preventDefault(),
                    void ri(!po.oneTapAdvance, {
                        persist: !0,
                        announce: !0,
                        source: 'station_panel_button',
                    })
                );
            if ('queue-capture-call-key' === r)
                return (
                    o.preventDefault(),
                    void ci(!fo.captureCallKeyMode, {
                        source: 'station_panel_button',
                        announce: !0,
                    })
                );
            if ('queue-clear-call-key' === r) {
                if ((o.preventDefault(), !fo.customCallKey)) return;
                if (
                    !window.confirm(
                        `Se eliminará la tecla externa (${_o(fo.customCallKey)}). ¿Deseas continuar?`
                    )
                )
                    return;
                return (
                    si(null, {
                        persist: !0,
                        announce: !0,
                        source: 'station_panel_button',
                    }),
                    void ci(!1, {
                        source: 'station_panel_button_clear',
                        announce: !1,
                    })
                );
            }
            if ('queue-start-practice' === r)
                return (
                    o.preventDefault(),
                    Po(!1, { persist: !1, source: 'practice_start' }),
                    Ho(!0, { source: 'practice_start' }),
                    qo(!0, { source: 'practice_start', announce: !1 }),
                    E(
                        'Modo práctica activo: simulación local, no se enviarán cambios a la cola real.',
                        'info'
                    ),
                    void go('onboarding_practice_started', {
                        stationMode: po.mode,
                        consultorio: po.consultorio,
                    })
                );
            if ('queue-reset-practice' === r)
                return (
                    o.preventDefault(),
                    fo.practiceMode
                        ? void Do({
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
                    o.preventDefault(),
                    Ho(!1, { source: 'practice_stop_button' }),
                    void E(
                        'Modo práctica desactivado. Operación real reanudada.',
                        'success'
                    )
                );
            if ('queue-dismiss-onboarding' === r) {
                o.preventDefault();
                const e = wo(),
                    t = co.length;
                if (
                    e < t &&
                    !window.confirm(
                        `La guía aún no está completa (${e}/${t}). ¿Deseas cerrarla de todos modos?`
                    )
                )
                    return;
                return (
                    Po(!1, { persist: !0, source: 'onboarding_button' }),
                    void E('Guía inicial completada', 'success')
                );
            }
            if ('queue-call-next' === r)
                return (
                    o.preventDefault(),
                    void (await wi(Number(i.dataset.queueConsultorio || 0), {
                        source: 'button',
                    }))
                );
            if ('context-focus-slot-input' === r)
                return (
                    o.preventDefault(),
                    await Ni('availability', { focus: !1 }),
                    void cn()
                );
            if ('context-availability-today' === r)
                return (
                    o.preventDefault(),
                    await Ni('availability', { focus: !1 }),
                    void rn()
                );
            if ('context-availability-next' === r)
                return (
                    o.preventDefault(),
                    await Ni('availability', { focus: !1 }),
                    void sn()
                );
            if ('context-copy-availability-day' === r)
                return (
                    o.preventDefault(),
                    await Ni('availability', { focus: !1 }),
                    void yn()
                );
            try {
                if ('export-csv' === r) return (o.preventDefault(), void St());
                if ('appointment-quick-filter' === r)
                    return (
                        o.preventDefault(),
                        void yt(i.dataset.filterValue || 'all')
                    );
                if ('callback-quick-filter' === r)
                    return (
                        o.preventDefault(),
                        void Ce(i.dataset.filterValue || 'all')
                    );
                if ('callbacks-triage-next' === r)
                    return (o.preventDefault(), await xi('pending'), void _e());
                if ('clear-appointment-filters' === r)
                    return (o.preventDefault(), void ht());
                if ('clear-callback-filters' === r)
                    return (
                        o.preventDefault(),
                        void ke(
                            { filter: Y, sort: X, search: '' },
                            { preserveSearch: !1 }
                        )
                    );
                if ('appointment-density' === r)
                    return (
                        o.preventDefault(),
                        void (function (e) {
                            const t = ut(e);
                            (mt(t),
                                dt(Ze, t),
                                Boolean(
                                    document.getElementById(
                                        'appointmentsTableBody'
                                    )
                                ) && gt());
                        })(i.dataset.density || 'comfortable')
                    );
                if ('change-month' === r)
                    return (
                        o.preventDefault(),
                        void on(Number(i.dataset.delta || 0))
                    );
                if ('availability-today' === r)
                    return (o.preventDefault(), void rn());
                if ('availability-next-with-slots' === r)
                    return (o.preventDefault(), void sn());
                if ('prefill-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (function (e) {
                            if (Ct)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const t = document.getElementById('newSlotTime');
                            t instanceof HTMLInputElement &&
                                ((t.value = String(e || '').trim()), t.focus());
                        })(i.dataset.time || '')
                    );
                if ('copy-availability-day' === r)
                    return (o.preventDefault(), void yn());
                if ('paste-availability-day' === r)
                    return (o.preventDefault(), void (await hn()));
                if ('duplicate-availability-day-next' === r)
                    return (o.preventDefault(), void (await vn()));
                if ('duplicate-availability-next-week' === r)
                    return (o.preventDefault(), void (await Sn()));
                if ('clear-availability-day' === r)
                    return (o.preventDefault(), void (await wn()));
                if ('clear-availability-week' === r)
                    return (o.preventDefault(), void (await kn()));
                if ('save-availability-draft' === r)
                    return (o.preventDefault(), void (await fn()));
                if ('discard-availability-draft' === r)
                    return (o.preventDefault(), void gn());
                if ('add-time-slot' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function () {
                            if (Ct)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            if (!wt)
                                return void E(
                                    'Selecciona una fecha primero',
                                    'warning'
                                );
                            const e = document.getElementById('newSlotTime');
                            if (!(e instanceof HTMLInputElement)) return;
                            const t = String(e.value || '').trim();
                            if (!t)
                                return void E('Ingresa un horario', 'warning');
                            const n = Pt(a[wt] || []);
                            n.includes(t)
                                ? E('Este horario ya existe', 'warning')
                                : (pn(() => {
                                      zt(wt, [...n, t]);
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
                        o.preventDefault(),
                        void (await (async function (e, t) {
                            if (Ct)
                                return void E(
                                    'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
                                    'warning'
                                );
                            const n = String(e || '').trim(),
                                o = String(t || '').trim();
                            if (!Dt(n) || !o)
                                return void E(
                                    'No se pudo identificar el horario a eliminar',
                                    'warning'
                                );
                            const i = Pt(a[n] || []),
                                r = i.filter((e) => e !== o);
                            r.length !== i.length
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
                                        (await w('appointments', {
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
                                        (await w('appointments', {
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
                        })(Number(i.dataset.id || 0)))
                    );
                if ('cancel-appointment' === r)
                    return (
                        o.preventDefault(),
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
                        })(Number(i.dataset.id || 0)))
                    );
                if ('mark-no-show' === r)
                    return (
                        o.preventDefault(),
                        void (await (async function (e) {
                            if (confirm('Marcar esta cita como "No asistio"?'))
                                if (e)
                                    try {
                                        (await w('appointments', {
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
                                    ie.delete(de(a));
                                    const e = a.id || Date.now();
                                    (a.id || (a.id = e),
                                        await w('callbacks', {
                                            method: 'PATCH',
                                            body: {
                                                id: Number(e),
                                                status: 'contactado',
                                            },
                                        }),
                                        await R(),
                                        ke({
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
                            Number(i.dataset.callbackId || 0),
                            i.dataset.callbackDate || ''
                        ))
                    );
                if ('queue-ticket-action' === r)
                    return (
                        o.preventDefault(),
                        fo.practiceMode
                            ? void Fo(
                                  String(
                                      i.dataset.queueAction || 'ticket_action'
                                  ),
                                  {
                                      source: 'button',
                                      consultorio:
                                          Number(
                                              i.dataset.queueConsultorio || 0
                                          ) || null,
                                      ticketId:
                                          Number(i.dataset.queueId || 0) ||
                                          null,
                                  }
                              )
                            : void (await Ba(
                                  Number(i.dataset.queueId || 0),
                                  i.dataset.queueAction || '',
                                  Number(i.dataset.queueConsultorio || 0)
                              ))
                    );
                if ('queue-reprint-ticket' === r)
                    return (
                        o.preventDefault(),
                        fo.practiceMode
                            ? void Fo('reprint_ticket', {
                                  source: 'button',
                                  ticketId:
                                      Number(i.dataset.queueId || 0) || null,
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
                                          Aa(),
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
                                                      o = Number(
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
                                                              (o >= 500
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
                                              Aa());
                                      }
                                  }
                              })(Number(i.dataset.queueId || 0)))
                    );
            } catch (e) {
                E(`Error ejecutando accion: ${e.message}`, 'error');
            }
        } else i.closest('.toast')?.remove();
    });
    const o = document.getElementById('appointmentFilter');
    o &&
        o.addEventListener('change', () => {
            gt();
        });
    const i = document.getElementById('searchAppointments');
    i &&
        i.addEventListener('input', () => {
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
    c && c.addEventListener('change', we);
    const l = document.getElementById('searchCallbacks');
    l && l.addEventListener('input', Ee);
    const u = document.getElementById('adminQuickCommand');
    u instanceof HTMLInputElement &&
        u.addEventListener('keydown', async (e) => {
            'Enter' === e.key && (e.preventDefault(), await Fi(u.value));
        });
}
document.addEventListener('DOMContentLoaded', async () => {
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
            Io();
            const e = (function () {
                try {
                    return {
                        mode: Yo(localStorage.getItem(Oa), Ja),
                        consultorio: Xo(localStorage.getItem(za), 1),
                    };
                } catch (e) {
                    return { mode: Ja, consultorio: 1 };
                }
            })();
            ((po.mode = e.mode),
                (po.consultorio = e.consultorio),
                (po.oneTapAdvance = (function () {
                    try {
                        return Zo(localStorage.getItem(Ua), !1);
                    } catch (e) {
                        return !1;
                    }
                })()),
                (fo.customCallKey = (function () {
                    try {
                        const e = localStorage.getItem(Va);
                        return e ? ei(JSON.parse(e), null) : null;
                    } catch (e) {
                        return null;
                    }
                })()),
                (fo.onboardingProgress = (function () {
                    try {
                        const e = localStorage.getItem(Wa);
                        return e ? vo(JSON.parse(e)) : ho();
                    } catch (e) {
                        return ho();
                    }
                })()),
                (fo.helpOpen = bo(oo, !1)),
                (fo.onboardingVisible = !1),
                (fo.practiceMode = !1),
                (fo.practiceState = null),
                (fo.practiceTickId = 0),
                (fo.oneTapInFlight = !1),
                (fo.lastOneTapAt = 0),
                (fo.captureCallKeyMode = !1));
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
                        o = '' !== t,
                        i = '' !== n,
                        r = '' !== a;
                    if (!o && !i && !r) return null;
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
                            oneTapAdvance: r ? Zo(a, !1) : null,
                            hadStationParam: o,
                            hadLockParam: i,
                            hadOneTapParam: r,
                        }
                    );
                } catch (e) {
                    return null;
                }
            })();
            (t
                ? ((po.mode = Yo(t.mode, po.mode)),
                  (po.consultorio = Xo(t.consultorio, po.consultorio)),
                  null !== t.oneTapAdvance &&
                      ((po.oneTapAdvance = Zo(
                          t.oneTapAdvance,
                          po.oneTapAdvance
                      )),
                      ni(po.oneTapAdvance)),
                  ti(po.mode, po.consultorio),
                  go('station_bootstrap', {
                      source: 'query',
                      mode: po.mode,
                      consultorio: po.consultorio,
                      oneTapAdvance: po.oneTapAdvance,
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
                          const o = `${e.pathname}${e.search}${e.hash}`;
                          window.history &&
                              'function' ==
                                  typeof window.history.replaceState &&
                              window.history.replaceState(
                                  null,
                                  '',
                                  o || e.pathname
                              );
                      } catch (e) {}
                  })())
                : go('station_bootstrap', {
                      source: 'storage',
                      mode: po.mode,
                      consultorio: po.consultorio,
                      oneTapAdvance: po.oneTapAdvance,
                  }),
                ii(),
                Ao(),
                po.mode === Ga &&
                    Co('station_locked', { source: 'bootstrap', announce: !1 }),
                fo.helpOpen &&
                    Co('shortcuts_opened', {
                        source: 'bootstrap',
                        announce: !1,
                    }),
                ko(),
                xo(),
                Po(!1, { source: 'bootstrap' }));
        })(),
        Oi(),
        (function () {
            const e = { sort: lt(D(Xe, et)), density: ut(D(Ze, tt)) },
                { sortSelect: t } = st();
            (t && (t.value = e.sort), mt(e.density));
        })(),
        mo ||
            (mo = window.setInterval(() => {
                Ci();
            }, 3e4)),
        Ci(),
        Ai(Oo()),
        Jo());
    const e = document.getElementById('loginForm');
    (e && e.addEventListener('submit', ji),
        Ro().forEach((e) => {
            e.addEventListener('click', async (t) => {
                (t.preventDefault(),
                    await Ni(e.dataset.section || 'dashboard'));
            });
        }),
        document
            .getElementById('adminMenuToggle')
            ?.addEventListener('click', () => {
                Uo() ? $i(!Vo()) : Go(!Ko());
            }),
        document
            .getElementById('adminMenuClose')
            ?.addEventListener('click', () => Mi({ restoreFocus: !0 })),
        document
            .getElementById('adminSidebarBackdrop')
            ?.addEventListener('click', () => Mi({ restoreFocus: !0 })),
        window.addEventListener('keydown', (e) => {
            if (
                ((function (e) {
                    if ('Tab' !== e.key) return;
                    if (!Uo() || !Vo()) return;
                    const t = document.getElementById('adminSidebar');
                    if (!t) return;
                    const n = Li();
                    if (0 === n.length)
                        return (e.preventDefault(), void t.focus());
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
                'Escape' !== e.key)
            )
                Ii(e);
            else {
                if (
                    (function (e) {
                        return !(
                            !La() ||
                            (fo.onboardingVisible
                                ? (e.preventDefault(),
                                  Po(!1, {
                                      persist: !0,
                                      source: 'keyboard_escape',
                                  }),
                                  0)
                                : !fo.helpOpen ||
                                  (e.preventDefault(),
                                  qo(!1, {
                                      source: 'keyboard_escape',
                                      announce: !1,
                                  }),
                                  0))
                        );
                    })(e)
                )
                    return;
                Mi({ restoreFocus: !0 });
            }
        }),
        window.addEventListener('resize', () => {
            (Uo() || Mi(), Jo(), Ti(Vo()));
        }),
        window.addEventListener('hashchange', async () => {
            const e = document.getElementById('adminDashboard');
            e &&
                !e.classList.contains('is-hidden') &&
                (await Ni(
                    (function ({ fallback: e = 'dashboard' } = {}) {
                        return jo(
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
                            await R(),
                            Ei());
                        const o = document.querySelector('.nav-item.active');
                        (await Pi(o?.dataset.section || 'dashboard'),
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
                : 'queue' === zo() && Ma({ immediate: !0 });
        }),
        window.addEventListener('online', async () => {
            const e = await Hi({ showSuccessToast: !1, showErrorToast: !1 });
            ('queue' === zo() && Ma({ immediate: !0 }),
                e
                    ? E('Conexion restaurada. Datos actualizados.', 'success')
                    : E(
                          'Conexion restaurada, pero no se pudieron refrescar datos.',
                          'warning'
                      ));
        }),
        window.addEventListener('offline', () => {
            'queue' === zo() && Ia({ reason: 'offline' });
        }),
        window.addEventListener('piel:queue-ops', () => {
            window.requestAnimationFrame(() => {
                ii();
            });
        }),
        Ti(!1),
        Wo(Ko()),
        await (async function () {
            if (!navigator.onLine && D('appointments', null))
                return (
                    E('Modo offline: mostrando datos locales', 'info'),
                    void (await Ri())
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
                ? await Ri()
                : (function () {
                      const e = document.getElementById('loginScreen'),
                          t = document.getElementById('adminDashboard');
                      (Ia({ reason: 'paused' }),
                          ci(!1, { source: 'logout', announce: !1 }),
                          Io(),
                          (fo.practiceMode = !1),
                          (fo.practiceState = null),
                          xo(),
                          Mi(),
                          e && e.classList.remove('is-hidden'),
                          t && t.classList.add('is-hidden'));
                  })();
        })(),
        ii());
});
