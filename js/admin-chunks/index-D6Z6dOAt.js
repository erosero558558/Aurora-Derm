function t(t) {
    return String(t ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function e(t, e = document) {
    return e.querySelector(t);
}
function a(t, e = document) {
    return Array.from(e.querySelectorAll(t));
}
function n(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime())
        ? String(t || '')
        : e.toLocaleString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          });
}
function i(t) {
    const e = Number(t || 0);
    return Number.isFinite(e) ? Math.round(e).toLocaleString('es-EC') : '0';
}
function o(a, n = 'info') {
    const i = e('#toastContainer');
    if (!(i instanceof HTMLElement)) return;
    const o = document.createElement('div');
    ((o.className = `toast ${n}`),
        o.setAttribute('role', 'error' === n ? 'alert' : 'status'),
        (o.innerHTML = `\n        <div class="toast-body">${t(a)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        i.appendChild(o),
        window.setTimeout(() => {
            o.parentElement && o.remove();
        }, 4500));
}
function s(t, a) {
    const n = e(t);
    n && (n.textContent = String(a ?? ''));
}
function c(t, a) {
    const n = e(t);
    n && (n.innerHTML = a);
}
function l() {
    const t = document.activeElement;
    return (
        t instanceof HTMLElement &&
        Boolean(
            t.closest(
                'input, textarea, select, [contenteditable="true"], [role="textbox"]'
            )
        )
    );
}
function r(t) {
    const e = t instanceof Date ? t : new Date(t || '');
    return Number.isNaN(e.getTime())
        ? ''
        : `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
const u = new Set(),
    d = {
        auth: { authenticated: !1, csrfToken: '', requires2FA: !1 },
        ui: {
            activeSection: 'dashboard',
            sidebarCollapsed: !1,
            sidebarOpen: !1,
            themeMode: 'system',
            theme: 'light',
            lastRefreshAt: 0,
        },
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {},
            availabilityMeta: {},
            queueTickets: [],
            queueMeta: null,
            funnelMetrics: null,
            health: null,
        },
        appointments: {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        callbacks: { filter: 'all', search: '', selected: [] },
        availability: {
            monthAnchor: new Date(),
            selectedDate: '',
            draft: {},
            draftDirty: !1,
            clipboard: [],
        },
        queue: {
            filter: 'all',
            search: '',
            oneTap: !1,
            practiceMode: !1,
            customCallKey: null,
            captureCallKeyMode: !1,
            stationMode: 'free',
            stationConsultorio: 1,
            pendingSensitiveAction: null,
            activity: [],
        },
    };
let p = structuredClone(d);
function m() {
    return p;
}
function b(t) {
    ((p = { ...p, ...t }), y());
}
function f(t) {
    const e = t(p);
    e && ((p = e), y());
}
function y() {
    u.forEach((t) => {
        try {
            t(p);
        } catch (t) {}
    });
}
const g = {
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
};
function h(t, e = '') {
    try {
        const a = localStorage.getItem(t);
        return null === a ? e : a;
    } catch (t) {
        return e;
    }
}
function v(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function k(t, e) {
    try {
        const a = localStorage.getItem(t);
        return a ? JSON.parse(a) : e;
    } catch (t) {
        return e;
    }
}
function w(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function q(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const C = 'themeMode',
    S = new Set(['light', 'dark', 'system']);
const A = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function M(t, e = 'dashboard') {
    const a = String(t || '')
        .trim()
        .toLowerCase();
    return A.has(a) ? a : e;
}
function T(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            a = e ? `#${e}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(M(t));
}
let _ = '';
async function N(t, e = {}) {
    const a = String(e.method || 'GET').toUpperCase(),
        n = {
            method: a,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== a && _ && (n.headers['X-CSRF-Token'] = _),
        void 0 !== e.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(e.body))));
    const i = await fetch(t, n),
        o = await i.text();
    let s;
    try {
        s = o ? JSON.parse(o) : {};
    } catch (t) {
        throw new Error(`Respuesta no valida (${i.status})`);
    }
    if (
        ((s = (function (t) {
            return t && 'object' == typeof t ? t : {};
        })(s)),
        !i.ok || !1 === s.ok)
    )
        throw new Error(s.error || s.message || `HTTP ${i.status}`);
    return s;
}
function $(t) {
    _ = String(t || '');
}
async function D(t, e = {}) {
    return N(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function L(t, e = {}) {
    return N(`/admin-auth.php?action=${encodeURIComponent(t)}`, e);
}
const E = {
    dashboard:
        '<path d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6zm10 0h8v-6h-8v6z"/>',
    appointments: '<path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 8H6v10h14V10z"/>',
    callbacks:
        '<path d="M6.6 10.8c1.4 2.8 3.7 5.2 6.5 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1.3.4 2.7.6 4.1.6.7 0 1.2.6 1.2 1.2V21c0 .7-.6 1.2-1.2 1.2C10.8 22.2 1.8 13.2 1.8 2.4 1.8 1.8 2.4 1.2 3 1.2h4.2c.7 0 1.2.6 1.2 1.2 0 1.4.2 2.8.6 4.1.1.4 0 .9-.3 1.2l-2.1 2.1z"/>',
    reviews:
        '<path d="m12 17.3-6.2 3.6 1.6-6.9L2 9.4l7.1-.6L12 2l2.9 6.8 7.1.6-5.4 4.6 1.6 6.9z"/>',
    availability:
        '<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 11h5v2h-7V7h2v6z"/>',
    queue: '<path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z"/>',
    menu: '<path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>',
    logout: '<path d="M10 17v-2h6V9h-6V7h8v10h-8zM4 19V5h8v2H6v10h6v2H4zm13.6-5L14 10.4l1.4-1.4 6 6-6 6-1.4-1.4 3.6-3.6H9v-2h8.6z"/>',
    sun: '<path d="M6.8 4.2 5.4 2.8 4 4.2l1.4 1.4 1.4-1.4zm10.8 0 1.4-1.4-1.4-1.4-1.4 1.4 1.4 1.4zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0-6h-2v3h2V0zm0 21h-2v3h2v-3zM0 11v2h3v-2H0zm21 0v2h3v-2h-3zM5.4 20.6 4 22l1.4 1.4 1.4-1.4-1.4-1.4zm13.2 0-1.4 1.4 1.4 1.4 1.4-1.4-1.4-1.4z"/>',
    moon: '<path d="M14.5 2.5a9 9 0 1 0 7 14.5 8 8 0 1 1-7-14.5z"/>',
    system: '<path d="M3 4h18v12H3V4zm2 2v8h14V6H5zm-2 12h18v2H3v-2z"/>',
};
function B(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${E[t] || E.menu}</svg>`;
}
const I = {
    dashboard: 'Dashboard',
    appointments: 'Citas',
    callbacks: 'Callbacks',
    reviews: 'Resenas',
    availability: 'Disponibilidad',
    queue: 'Turnero Sala',
};
function x(t, e, a, n = !1) {
    return `\n        <button\n            type="button"\n            class="admin-quick-nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            aria-pressed="${n ? 'true' : 'false'}"\n        >\n            <span>${e}</span>\n            <span class="admin-quick-nav-shortcut">${a}</span>\n        </button>\n    `;
}
function P(t, e, a, n = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${B(a)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function H() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function O() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function R(t) {
    (a('.admin-section').forEach((e) => {
        e.classList.toggle('active', e.id === t);
    }),
        a('.nav-item[data-section]').forEach((e) => {
            const a = e.dataset.section === t;
            (e.classList.toggle('active', a),
                a
                    ? e.setAttribute('aria-current', 'page')
                    : e.removeAttribute('aria-current'));
        }),
        a('.admin-quick-nav-item[data-section]').forEach((e) => {
            const a = e.dataset.section === t;
            (e.classList.toggle('active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
    const n = I[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = n);
}
function z({ open: t, collapsed: a }) {
    const n = e('#adminSidebar'),
        i = e('#adminSidebarBackdrop'),
        o = e('#adminMenuToggle');
    (n && n.classList.toggle('is-open', Boolean(t)),
        i && i.classList.toggle('is-hidden', !t),
        o && o.setAttribute('aria-expanded', String(Boolean(t))),
        document.body.classList.toggle('admin-sidebar-open', Boolean(t)),
        document.body.classList.toggle('admin-sidebar-collapsed', Boolean(a)));
    const s = e('#adminSidebarCollapse');
    s && s.setAttribute('aria-pressed', String(Boolean(a)));
}
function j(t) {
    const a = e('#group2FA');
    a && a.classList.toggle('is-hidden', !t);
}
const F = 'appointments',
    K = 'callbacks',
    V = 'reviews',
    Q = 'availability',
    U = 'availability-meta',
    G = 'queue-tickets',
    J = 'queue-meta',
    W = 'health-status';
function Y(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function X(t) {
    f((e) => {
        return {
            ...e,
            data: {
                ...e.data,
                appointments: t.appointments || [],
                callbacks:
                    ((a = t.callbacks || []),
                    (Array.isArray(a) ? a : []).map((t) => ({
                        ...t,
                        status: String(t.status || '')
                            .toLowerCase()
                            .includes('contact')
                            ? 'contacted'
                            : 'pending',
                    }))),
                reviews: t.reviews || [],
                availability: t.availability || {},
                availabilityMeta: t.availabilityMeta || {},
                queueTickets: t.queueTickets || [],
                queueMeta: t.queueMeta || null,
                funnelMetrics: t.funnelMetrics || e.data.funnelMetrics,
                health: t.health || null,
            },
            ui: { ...e.ui, lastRefreshAt: Date.now() },
        };
        var a;
    });
}
function Z(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function tt(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function et(t) {
    return Z(t.paymentStatus || t.payment_status || '');
}
function at(t) {
    const e = tt(
        `${String(t.date || '').trim()}T${String(t.time || '00:00').trim()}:00`
    );
    if (!e) return !1;
    const a = e - Date.now();
    return a >= 0 && a <= 1728e5;
}
function nt(t) {
    const e = et(t),
        a = Z(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function it() {
    const e = m(),
        a = Array.isArray(e.data.appointments) ? e.data.appointments : [],
        n = (function (t, e) {
            const a = Z(e),
                n = [...t];
            return 'patient_az' === a
                ? (n.sort((t, e) => Z(t.name).localeCompare(Z(e.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort(
                        (t, e) =>
                            tt(`${t.date || ''}T${t.time || '00:00'}:00`) -
                            tt(`${e.date || ''}T${e.time || '00:00'}:00`)
                    ),
                    n)
                  : (n.sort((t, e) => {
                        const a = tt(`${t.date || ''}T${t.time || '00:00'}:00`);
                        return (
                            tt(`${e.date || ''}T${e.time || '00:00'}:00`) - a
                        );
                    }),
                    n);
        })(
            (function (t, e) {
                const a = Z(e);
                return a
                    ? t.filter((t) =>
                          [
                              t.name,
                              t.email,
                              t.phone,
                              t.service,
                              t.doctor,
                              t.paymentStatus,
                          ].some((t) => Z(t).includes(a))
                      )
                    : t;
            })(
                (function (t, e) {
                    const a = Z(e);
                    return 'pending_transfer' === a
                        ? t.filter((t) => {
                              const e = et(t);
                              return (
                                  'pending_transfer_review' === e ||
                                  'pending_transfer' === e
                              );
                          })
                        : 'upcoming_48h' === a
                          ? t.filter(at)
                          : 'no_show' === a
                            ? t.filter((t) => 'no_show' === Z(t.status))
                            : 'triage_attention' === a
                              ? t.filter(nt)
                              : t;
                })(a, e.appointments.filter),
                e.appointments.search
            ),
            e.appointments.sort
        );
    var i;
    (c(
        '#appointmentsTableBody',
        (i = n).length
            ? i
                  .map((e) => {
                      const a = `${(function (t) {
                          const e = new Date(t || '');
                          return Number.isNaN(e.getTime())
                              ? String(t || '')
                              : e.toLocaleDateString('es-EC', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                });
                      })(e.date)} ${t(e.time || '')}`;
                      return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">${t(e.name || 'Sin nombre')}</td>\n                    <td data-label="Servicio">${t(e.service || '-')}</td>\n                    <td data-label="Fecha">${a}</td>\n                    <td data-label="Pago">${t(((n = e.paymentStatus || e.payment_status), { pending_transfer_review: 'Validar pago', pending_transfer: 'Transferencia', pending_cash: 'Pago en consultorio', pending_gateway: 'Pago en proceso', paid: 'Pagado', failed: 'Fallido' }[Z(n)] || n || 'Pendiente'))}</td>\n                    <td data-label="Estado">${t(
                          (function (t) {
                              return (
                                  {
                                      confirmed: 'Confirmada',
                                      pending: 'Pendiente',
                                      completed: 'Completada',
                                      cancelled: 'Cancelada',
                                      no_show: 'No show',
                                  }[Z(t)] ||
                                  t ||
                                  'Pendiente'
                              );
                          })(e.status)
                      )}</td>\n                    <td data-label="Acciones">${(function (
                          e
                      ) {
                          const a = Number(e.id || 0);
                          return `\n        <div class="table-actions">\n            <a href="https://wa.me/${encodeURIComponent(String(e.phone || '').replace(/\s+/g, ''))}" target="_blank" rel="noopener" aria-label="WhatsApp de ${t(e.name || 'Paciente')}" title="WhatsApp para validar pago">WhatsApp</a>\n            <button type="button" data-action="approve-transfer" data-id="${a}">Aprobar</button>\n            <button type="button" data-action="reject-transfer" data-id="${a}">Rechazar</button>\n            <button type="button" data-action="mark-no-show" data-id="${a}">No show</button>\n            <button type="button" data-action="cancel-appointment" data-id="${a}">Cancelar</button>\n            <button type="button" data-action="context-open-appointments-transfer">Triage</button>\n        </div>\n    `;
                      })(e)}</td>\n                </tr>\n            `;
                      var n;
                  })
                  .join('')
            : '<tr class="table-empty-row"><td colspan="6">No hay resultados</td></tr>'
    ),
        s('#appointmentsToolbarMeta', `Mostrando ${n.length} de ${a.length}`));
    const o = [];
    ('all' !== Z(e.appointments.filter) &&
        ('pending_transfer' === Z(e.appointments.filter)
            ? o.push('Transferencias por validar')
            : 'triage_attention' === Z(e.appointments.filter)
              ? o.push('Triage accionable')
              : 'upcoming_48h' === Z(e.appointments.filter)
                ? o.push('Proximas 48h')
                : 'no_show' === Z(e.appointments.filter)
                  ? o.push('No show')
                  : o.push(e.appointments.filter)),
        Z(e.appointments.search) &&
            o.push(`Busqueda: ${e.appointments.search}`),
        s(
            '#appointmentsToolbarState',
            o.length ? o.join(' | ') : 'Sin filtros activos'
        ));
    const l = document.getElementById('clearAppointmentsFiltersBtn');
    l && l.classList.toggle('is-hidden', 0 === o.length);
    const r = document.getElementById('appointmentFilter');
    r instanceof HTMLSelectElement && (r.value = e.appointments.filter);
    const u = document.getElementById('appointmentSort');
    u instanceof HTMLSelectElement && (u.value = e.appointments.sort);
    const d = document.getElementById('searchAppointments');
    d instanceof HTMLInputElement &&
        d.value !== e.appointments.search &&
        (d.value = e.appointments.search);
    const p = document.getElementById('appointments');
    (p &&
        p.classList.toggle(
            'appointments-density-compact',
            'compact' === Z(e.appointments.density)
        ),
        document
            .querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
            .forEach((t) => {
                const a = Z(t.dataset.density) === Z(e.appointments.density);
                t.classList.toggle('is-active', a);
            }),
        (function (t) {
            const e = Z(t);
            document
                .querySelectorAll(
                    '.appointment-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const a = Z(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', a);
                });
        })(e.appointments.filter),
        (function (t) {
            try {
                (localStorage.setItem(
                    'admin-appointments-sort',
                    JSON.stringify(t.sort)
                ),
                    localStorage.setItem(
                        'admin-appointments-density',
                        JSON.stringify(t.density)
                    ));
            } catch (t) {}
        })(e.appointments));
}
function ot(t) {
    (f((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), it());
}
function st(t) {
    ot({ filter: Z(t) || 'all' });
}
function ct(t, e) {
    const a = Number(t || 0);
    (f((t) => {
        const n = (t.data.appointments || []).map((t) =>
            Number(t.id || 0) === a ? { ...t, ...e } : t
        );
        return { ...t, data: { ...t.data, appointments: n } };
    }),
        it());
}
async function lt(t, e) {
    await D('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
function rt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ut(t) {
    const e = rt(t);
    return 'contacted' === e || 'contactado' === e ? 'contacted' : 'pending';
}
function dt(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const a = new Date();
    return (
        e.getFullYear() === a.getFullYear() &&
        e.getMonth() === a.getMonth() &&
        e.getDate() === a.getDate()
    );
}
function pt() {
    const e = m(),
        a = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
        i = (function (t, e) {
            const a = rt(e);
            return a
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          rt(t).includes(a)
                      )
                  )
                : t;
        })(
            (function (t, e) {
                const a = rt(e);
                return 'pending' === a || 'contacted' === a
                    ? t.filter((t) => ut(t.status) === a)
                    : 'today' === a
                      ? t.filter((t) => dt(t.fecha || t.createdAt))
                      : t;
            })(a, e.callbacks.filter),
            e.callbacks.search
        ),
        o = new Set((e.callbacks.selected || []).map((t) => Number(t || 0)));
    (c(
        '#callbacksGrid',
        i.length
            ? i
                  .map((e) =>
                      (function (e, a) {
                          const i = ut(e.status),
                              o =
                                  'pending' === i
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              s = 'pending' === i ? 'pendiente' : 'contactado',
                              c = Number(e.id || 0),
                              l =
                                  String(
                                      e.telefono || e.phone || 'Sin telefono'
                                  ).trim() || 'Sin telefono',
                              r = (() => {
                                  const t = new Date(
                                      e.fecha || e.createdAt || ''
                                  );
                                  return Number.isNaN(t.getTime())
                                      ? 0
                                      : Math.max(
                                            0,
                                            Math.round(
                                                (Date.now() - t.getTime()) / 6e4
                                            )
                                        );
                              })();
                          return `\n        <article class="${o}${a ? ' is-selected' : ''}" data-callback-id="${c}" data-callback-status="${s}">\n            <header>\n                <h4>${t(l)}</h4>\n                <span>${'pending' === i ? 'Pendiente' : 'Contactado'}</span>\n            </header>\n            <p>Preferencia: ${t(e.preferencia || '-')}</p>\n            <p>Fecha: ${t(n(e.fecha || e.createdAt || ''))}</p>\n            <p>Espera: ${r} min</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${c}" data-callback-date="${t(e.fecha || '')}">Marcar contactado</button>\n            </div>\n        </article>\n    `;
                      })(e, o.has(Number(e.id || 0)))
                  )
                  .join('')
            : '<p>No hay callbacks para el filtro actual.</p>'
    ),
        s('#callbacksToolbarMeta', `Mostrando ${i.length} de ${a.length}`));
    const l = [];
    ('all' !== rt(e.callbacks.filter) &&
        l.push(
            'pending' === rt(e.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === rt(e.callbacks.filter)
                  ? 'Contactados'
                  : 'Hoy'
        ),
        rt(e.callbacks.search) && l.push(`Busqueda: ${e.callbacks.search}`),
        s(
            '#callbacksToolbarState',
            l.length ? l.join(' | ') : 'Sin filtros activos'
        ));
    const r = document.getElementById('callbackFilter');
    r instanceof HTMLSelectElement && (r.value = e.callbacks.filter);
    const u = document.getElementById('searchCallbacks');
    (u instanceof HTMLInputElement &&
        u.value !== e.callbacks.search &&
        (u.value = e.callbacks.search),
        (function (t) {
            const e = rt(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const a = rt(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', a);
                });
        })(e.callbacks.filter));
    const d = (function (t) {
        const e = t.filter((t) => 'pending' === ut(t.status)),
            a = e.filter((t) => {
                const e = new Date(t.fecha || t.createdAt || '');
                return (
                    !Number.isNaN(e.getTime()) &&
                    Date.now() - e.getTime() >= 36e5
                );
            }),
            n = e
                .slice()
                .sort(
                    (t, e) =>
                        new Date(t.fecha || t.createdAt || 0).getTime() -
                        new Date(e.fecha || e.createdAt || 0).getTime()
                )[0];
        return {
            pendingCount: e.length,
            urgentCount: a.length,
            todayCount: t.filter((t) => dt(t.fecha || t.createdAt)).length,
            next: n,
            queueHealth:
                a.length > 0
                    ? 'Cola: prioridad alta'
                    : e.length > 0
                      ? 'Cola: atencion requerida'
                      : 'Cola: estable',
        };
    })(a);
    (s('#callbacksOpsPendingCount', d.pendingCount),
        s('#callbacksOpsUrgentCount', d.urgentCount),
        s('#callbacksOpsTodayCount', d.todayCount),
        s('#callbacksOpsQueueHealth', d.queueHealth),
        s(
            '#callbacksOpsNext',
            d.next
                ? String(d.next.telefono || d.next.phone || 'Sin telefono')
                : 'Sin telefono'
        ));
    const p = document.getElementById('callbacksSelectionChip');
    (p && p.classList.toggle('is-hidden', 0 === o.size),
        s('#callbacksSelectedCount', o.size));
}
function mt(t) {
    (f((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })), pt());
}
function bt(t) {
    mt({ filter: rt(t) || 'all' });
}
async function ft(t, e = '') {
    const a = Number(t || 0);
    a <= 0 ||
        (await D('callbacks', {
            method: 'PATCH',
            body: { id: a, status: 'contacted', fecha: e },
        }),
        (function (t) {
            const e = Number(t || 0);
            (f((t) => {
                const a = (t.data.callbacks || []).map((t) =>
                    Number(t.id || 0) === e ? { ...t, status: 'contacted' } : t
                );
                return {
                    ...t,
                    data: { ...t.data, callbacks: a },
                    callbacks: {
                        ...t.callbacks,
                        selected: (t.callbacks.selected || []).filter(
                            (t) => Number(t || 0) !== e
                        ),
                    },
                };
            }),
                pt());
        })(a));
}
function yt(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function gt(t) {
    return [...new Set(t.map(yt).filter(Boolean))].sort();
}
function ht(t) {
    const e = {};
    return (
        Object.entries(t || {}).forEach(([t, a]) => {
            e[t] = gt(Array.isArray(a) ? a : []);
        }),
        e
    );
}
function vt() {
    return ht(m().availability.draft || {});
}
function kt() {
    const t = m().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function wt() {
    const t = m();
    if (t.availability.selectedDate) return t.availability.selectedDate;
    const e = t.availability.draft || {};
    return Object.keys(e).sort()[0] || r(new Date());
}
function qt(t) {
    f((e) => ({ ...e, availability: { ...e.availability, ...t } }));
}
function Ct() {
    ((function () {
        const t = m(),
            e = new Date(t.availability.monthAnchor || new Date()),
            a = wt(),
            n = e.getMonth(),
            i = ht(t.availability.draft),
            o = r(new Date());
        var l;
        s(
            '#calendarMonth',
            ((l = e),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(l))
        );
        c(
            '#availabilityCalendar',
            (function (t) {
                const e = new Date(t.getFullYear(), t.getMonth(), 1),
                    a = (e.getDay() + 6) % 7;
                e.setDate(e.getDate() - a);
                const n = [];
                for (let t = 0; t < 42; t += 1) {
                    const a = new Date(e);
                    (a.setDate(e.getDate() + t), n.push(a));
                }
                return n;
            })(e)
                .map((t) => {
                    const e = r(t),
                        s = Array.isArray(i[e]) && i[e].length > 0;
                    return `\n                <button type="button" class="${['calendar-day', t.getMonth() === n ? '' : 'other-month', s ? 'has-slots' : '', e === a ? 'is-selected' : '', e === o ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${e}">\n                    <span>${t.getDate()}</span>\n                    ${s ? `<small>${i[e].length} slots</small>` : ''}\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const e = m(),
                a = wt(),
                n = gt(ht(e.availability.draft)[a] || []);
            (s('#selectedDate', a || '-'),
                n.length
                    ? c(
                          '#timeSlotsList',
                          n
                              .map(
                                  (e) =>
                                      `\n            <div class="time-slot-item">\n                <span>${t(e)}</span>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(a)}" data-time="${encodeURIComponent(e)}" ${kt() ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : c(
                          '#timeSlotsList',
                          '<p class="empty-message">No hay horarios configurados</p>'
                      ));
        })(),
        (function () {
            const t = m(),
                a = wt(),
                n = ht(t.availability.draft),
                i = Array.isArray(n[a]) ? n[a].length : 0,
                o = kt();
            (s(
                '#availabilitySelectionSummary',
                `Fuente: ${o ? 'Google Calendar' : 'Local'} | Modo: ${o ? 'Solo lectura' : 'Editable'} | Slots: ${i}`
            ),
                s(
                    '#availabilityDraftStatus',
                    t.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                s(
                    '#availabilitySyncStatus',
                    o ? 'Google Calendar' : 'Store local'
                ),
                s(
                    '#availabilityDayActionsStatus',
                    o
                        ? 'Edicion bloqueada por proveedor Google'
                        : t.availability.clipboard.length
                          ? `Portapapeles: ${t.availability.clipboard.length} slots`
                          : 'Sin acciones pendientes'
                ));
            const c = e('#addSlotForm'),
                l = e('#availabilityQuickSlotPresets');
            (c && c.classList.toggle('is-hidden', o),
                l && l.classList.toggle('is-hidden', o),
                document
                    .querySelectorAll(
                        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                    )
                    .forEach((e) => {
                        e instanceof HTMLButtonElement &&
                            ('availabilityDiscardDraftBtn' !== e.id &&
                            'availabilitySaveDraftBtn' !== e.id
                                ? (e.disabled = o)
                                : (e.disabled =
                                      o || !t.availability.draftDirty));
                    }));
        })());
}
function St(t, e) {
    const a = vt(),
        n = String(t || '').trim();
    n &&
        ((a[n] = gt(e)),
        qt({ draft: a, selectedDate: n, draftDirty: !0 }),
        Ct());
}
function At(t) {
    if (kt()) return;
    const e = m(),
        a = e.availability.selectedDate || wt(),
        n = Array.isArray(e.availability.draft[a])
            ? e.availability.draft[a]
            : [],
        i = new Date(a);
    if (Number.isNaN(i.getTime())) return;
    i.setDate(i.getDate() + Number(t || 0));
    const o = r(i),
        s = vt();
    ((s[o] = gt(n)),
        qt({
            draft: s,
            selectedDate: o,
            draftDirty: !0,
            monthAnchor: new Date(i),
        }),
        Ct());
}
const Mt = 'queueStationMode',
    Tt = 'queueStationConsultorio',
    _t = 'queueOneTapAdvance',
    Nt = 'queueCallKeyBindingV1',
    $t = 'queueNumpadHelpOpen',
    Dt = 'queueAdminLastSnapshot',
    Lt = new Map([
        [1, !1],
        [2, !1],
    ]);
let Et = '';
const Bt = new Set(['completar', 'no_show', 'cancelar']);
function It(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function xt(t) {
    const e = It(t);
    return ['waiting', 'wait', 'en_espera', 'espera'].includes(e)
        ? 'waiting'
        : ['called', 'calling', 'llamado'].includes(e)
          ? 'called'
          : ['completed', 'complete', 'completar', 'done'].includes(e)
            ? 'completed'
            : [
                    'no_show',
                    'noshow',
                    'no-show',
                    'no show',
                    'no_asistio',
                ].includes(e)
              ? 'no_show'
              : ['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(e)
                ? 'cancelled'
                : e || 'waiting';
}
function Pt(t) {
    const e = It(t);
    return ['complete', 'completed', 'completar'].includes(e)
        ? 'completar'
        : ['no_show', 'noshow', 'no-show', 'no show'].includes(e)
          ? 'no_show'
          : [
                  'cancel',
                  'cancelled',
                  'canceled',
                  'cancelar',
                  'cancelado',
              ].includes(e)
            ? 'cancelar'
            : ['reasignar', 'reassign'].includes(e)
              ? 'reasignar'
              : ['re-llamar', 'rellamar', 'recall', 'llamar'].includes(e)
                ? 're-llamar'
                : ['liberar', 'release'].includes(e)
                  ? 'liberar'
                  : e;
}
function Ht(t) {
    return Array.isArray(t) ? t : [];
}
function Ot(t, e = 0) {
    const a = Number(t);
    return Number.isFinite(a) ? a : e;
}
function Rt(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function zt(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
function jt(t) {
    f((e) => {
        const a = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: a } };
    });
    try {
        ie();
    } catch (t) {}
}
function Ft(t) {
    (v(Mt, t.queue.stationMode || 'free'),
        v(Tt, t.queue.stationConsultorio || 1),
        v(_t, t.queue.oneTap ? '1' : '0'),
        v($t, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? w(Nt, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(Nt),
        w(Dt, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Kt(t, e = 0) {
    const a = Number(t?.id || t?.ticket_id || e + 1);
    return {
        id: a,
        ticketCode: String(t?.ticketCode || t?.ticket_code || `A-${a}`),
        queueType: String(t?.queueType || t?.queue_type || 'walk_in'),
        patientInitials: String(
            t?.patientInitials || t?.patient_initials || '--'
        ),
        priorityClass: String(
            t?.priorityClass || t?.priority_class || 'walk_in'
        ),
        status: xt(t?.status || 'waiting'),
        assignedConsultorio:
            2 === Number(t?.assignedConsultorio || t?.assigned_consultorio || 0)
                ? 2
                : 1 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
                  ? 1
                  : null,
        createdAt: String(
            t?.createdAt || t?.created_at || new Date().toISOString()
        ),
        calledAt: String(t?.calledAt || t?.called_at || ''),
        completedAt: String(t?.completedAt || t?.completed_at || ''),
    };
}
function Vt(t, e = 0, a = {}) {
    const n = t && 'object' == typeof t ? t : {},
        i = Kt({ ...n, ...a }, e);
    return (
        zt(n.createdAt, n.created_at) || (i.createdAt = ''),
        zt(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        zt(n.queueType, n.queue_type) || (i.queueType = ''),
        zt(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function Qt(t) {
    const e = t.filter((t) => 'waiting' === t.status),
        a = t.filter((t) => 'called' === t.status),
        n = {
            1: a.find((t) => 1 === t.assignedConsultorio) || null,
            2: a.find((t) => 2 === t.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: e.length,
        calledCount: a.length,
        counts: {
            waiting: e.length,
            called: a.length,
            completed: t.filter((t) => 'completed' === t.status).length,
            no_show: t.filter((t) => 'no_show' === t.status).length,
            cancelled: t.filter((t) => 'cancelled' === t.status).length,
        },
        callingNowByConsultorio: n,
        nextTickets: e
            .slice(0, 5)
            .map((t, e) => ({
                id: t.id,
                ticketCode: t.ticketCode,
                patientInitials: t.patientInitials,
                position: e + 1,
            })),
    };
}
function Ut(t, e = []) {
    const a = t && 'object' == typeof t ? t : {},
        n = a.counts && 'object' == typeof a.counts ? a.counts : {},
        i =
            a.callingNowByConsultorio &&
            'object' == typeof a.callingNowByConsultorio
                ? a.callingNowByConsultorio
                : a.calling_now_by_consultorio &&
                    'object' == typeof a.calling_now_by_consultorio
                  ? a.calling_now_by_consultorio
                  : {},
        o = Ht(a.callingNow).concat(Ht(a.calling_now)),
        s = Ht(e).map((t, e) => Kt(t, e)),
        c =
            i[1] ||
            i[1] ||
            o.find(
                (t) =>
                    1 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        l =
            i[2] ||
            i[2] ||
            o.find(
                (t) =>
                    2 ===
                    Number(
                        t?.assignedConsultorio || t?.assigned_consultorio || 0
                    )
            ) ||
            null,
        r = c ? Vt(c, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        u = l ? Vt(l, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = Ht(a.nextTickets)
            .concat(Ht(a.next_tickets))
            .map((t, e) =>
                Vt(
                    {
                        ...t,
                        status: t?.status || 'waiting',
                        assignedConsultorio: null,
                    },
                    e
                )
            ),
        p = s.filter((t) => 'waiting' === t.status).length,
        m = s.filter((t) => 'called' === t.status).length,
        b = Math.max(Number(Boolean(r)) + Number(Boolean(u)), m),
        f = Ot(
            a.waitingCount ?? a.waiting_count ?? n.waiting ?? d.length ?? p,
            0
        ),
        y = Ot(a.calledCount ?? a.called_count ?? n.called ?? b, 0),
        g = Ot(
            n.completed ??
                a.completedCount ??
                a.completed_count ??
                s.filter((t) => 'completed' === t.status).length,
            0
        ),
        h = Ot(
            n.no_show ??
                n.noShow ??
                a.noShowCount ??
                a.no_show_count ??
                s.filter((t) => 'no_show' === t.status).length,
            0
        ),
        v = Ot(
            n.cancelled ??
                n.canceled ??
                a.cancelledCount ??
                a.cancelled_count ??
                s.filter((t) => 'cancelled' === t.status).length,
            0
        );
    return {
        updatedAt: String(
            a.updatedAt || a.updated_at || new Date().toISOString()
        ),
        waitingCount: f,
        calledCount: y,
        counts: {
            waiting: f,
            called: y,
            completed: g,
            no_show: h,
            cancelled: v,
        },
        callingNowByConsultorio: { 1: r, 2: u },
        nextTickets: d,
    };
}
function Gt(t) {
    const e = Kt(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${It(e.ticketCode || '')}`;
}
function Jt(t) {
    const e = Ut(t),
        a = new Map(),
        n = (t) => {
            if (!t) return;
            const e = Kt(t, a.size);
            (zt(t?.createdAt, t?.created_at) || (e.createdAt = ''),
                zt(t?.priorityClass, t?.priority_class) ||
                    (e.priorityClass = ''),
                zt(t?.queueType, t?.queue_type) || (e.queueType = ''),
                a.set(Gt(e), e));
        },
        i =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        o =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (i && n({ ...i, status: 'called', assignedConsultorio: 1 }),
        o && n({ ...o, status: 'called', assignedConsultorio: 2 }));
    for (const t of Ht(e.nextTickets))
        n({ ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function Wt() {
    const t = m(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => Kt(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? Ut(t.data.queueMeta, e)
                : Qt(e),
    };
}
function Yt() {
    const t = m(),
        { queueTickets: e } = Wt();
    return (function (t, e) {
        const a = It(e);
        return a
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => It(t).includes(a)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const a = It(e);
            return 'waiting' === a
                ? t.filter((t) => 'waiting' === t.status)
                : 'called' === a
                  ? t.filter((t) => 'called' === t.status)
                  : 'no_show' === a
                    ? t.filter((t) => 'no_show' === t.status)
                    : 'sla_risk' === a
                      ? t.filter(
                            (t) =>
                                'waiting' === t.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - Rt(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === It(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function Xt(e) {
    const a = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - Rt(e.createdAt)) / 6e4)),
        i = Number(e.id || 0);
    return `\n        <tr data-queue-id="${i}">\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (xt(t)) {
                case 'waiting':
                    return 'En espera';
                case 'called':
                    return 'Llamado';
                case 'completed':
                    return 'Completado';
                case 'no_show':
                    return 'No asistio';
                case 'cancelled':
                    return 'Cancelado';
                default:
                    return String(t || '--');
            }
        })(e.status)
    )}</td>\n            <td>${a}</td>\n            <td>${n} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function Zt(t) {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        a = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (a && (a.textContent = `Confirmar accion sensible: ${t.action}`),
        f((e) => ({ ...e, queue: { ...e.queue, pendingSensitiveAction: t } })),
        e instanceof HTMLDialogElement && 'function' == typeof e.showModal)
    ) {
        if (((e.hidden = !1), e.removeAttribute('hidden'), !e.open))
            try {
                e.showModal();
            } catch (t) {
                e.setAttribute('open', '');
            }
    } else
        e instanceof HTMLElement &&
            (e.setAttribute('open', ''), (e.hidden = !1));
}
function te() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        f((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function ee(t, e = null, a = {}) {
    const n = Ht(t).map((t, e) => Kt(t, e)),
        i = Ut(e && 'object' == typeof e ? e : Qt(n), n),
        o = n.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        c =
            'fallback' === It(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === It(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (f((t) => ({
        ...t,
        data: { ...t.data, queueTickets: n, queueMeta: i },
        queue: { ...t.queue, fallbackPartial: s, syncMode: c },
    })),
        Ft(m()),
        oe());
}
function ae(t, e) {
    const a = Number(t || 0),
        n = (m().data.queueTickets || []).map((t, n) => {
            const i = Kt(t, n);
            return i.id !== a
                ? i
                : Kt('function' == typeof e ? e(i) : { ...i }, n);
        });
    ee(n, Qt(n), { fallbackPartial: !1, syncMode: 'live' });
}
function ne(t) {
    (f((e) => ({ ...e, queue: { ...e.queue, ...t } })), Ft(m()), oe());
}
function ie() {
    const e = m().queue.activity || [];
    c(
        '#queueActivityList',
        e.length
            ? e
                  .map(
                      (e) =>
                          `<li><span>${t(n(e.at))}</span><strong>${t(e.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function oe() {
    const e = m(),
        { queueMeta: a } = Wt(),
        n = Yt(),
        i = Ht(a.nextTickets),
        o = Number(a.waitingCount || a.counts?.waiting || 0);
    (!(function (t) {
        const e = m(),
            a = Ut(t, e.data.queueTickets || []),
            n =
                a.callingNowByConsultorio?.[1] ||
                a.callingNowByConsultorio?.[1] ||
                null,
            i =
                a.callingNowByConsultorio?.[2] ||
                a.callingNowByConsultorio?.[2] ||
                null,
            o = n
                ? String(n.ticketCode || n.ticket_code || 'A-000')
                : 'Sin llamado',
            c = i
                ? String(i.ticketCode || i.ticket_code || 'A-000')
                : 'Sin llamado';
        (s(
            '#queueWaitingCountAdmin',
            Number(a.waitingCount || a.counts?.waiting || 0)
        ),
            s(
                '#queueCalledCountAdmin',
                Number(a.calledCount || a.counts?.called || 0)
            ),
            s('#queueC1Now', o),
            s('#queueC2Now', c),
            s('#queueReleaseC1', o));
        const l = document.getElementById('queueSyncStatus');
        if ('fallback' === It(e.queue.syncMode))
            return (
                s('#queueSyncStatus', 'fallback'),
                void (l && l.setAttribute('data-state', 'fallback'))
            );
        const r = String(a.updatedAt || '').trim();
        if (!r) return;
        const u = Math.max(0, Math.round((Date.now() - Rt(r)) / 1e3)),
            d = u >= 60;
        if (
            (s('#queueSyncStatus', d ? `Watchdog (${u}s)` : 'vivo'),
            l && l.setAttribute('data-state', d ? 'reconnecting' : 'live'),
            d)
        ) {
            const t = `stale-${Math.floor(u / 15)}`;
            return void (
                t !== Et &&
                ((Et = t), jt('Watchdog de cola: realtime en reconnecting'))
            );
        }
        Et = 'live';
    })(a),
        c(
            '#queueTableBody',
            n.length
                ? n.map(Xt).join('')
                : '<tr><td colspan="6">No hay tickets para filtro</td></tr>'
        ));
    const l =
        e.queue.fallbackPartial && i.length && o > i.length
            ? `<li><span>-</span><strong>Mostrando primeros ${i.length} de ${o} en espera</strong></li>`
            : '';
    c(
        '#queueNextAdminList',
        i.length
            ? `${l}${i.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
    const r = n.filter(
            (t) =>
                'waiting' === t.status &&
                (Math.max(
                    0,
                    Math.round((Date.now() - Rt(t.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === It(t.priorityClass))
        ).length,
        u = [r > 0 ? `riesgo: ${r}` : 'sin riesgo'];
    (e.queue.fallbackPartial && u.push('fallback parcial'),
        s('#queueTriageSummary', u.join(' | ')),
        s('#queueStationBadge', `Estación C${e.queue.stationConsultorio}`),
        s(
            '#queueStationModeBadge',
            'locked' === e.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const d = document.getElementById('queuePracticeModeBadge');
    d instanceof HTMLElement && (d.hidden = !e.queue.practiceMode);
    const p = document.getElementById('queueShortcutPanel');
    p instanceof HTMLElement && (p.hidden = !e.queue.helpOpen);
    const b = document.querySelector('[data-action="queue-clear-call-key"]');
    b instanceof HTMLElement && (b.hidden = !e.queue.customCallKey);
    const f = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (f instanceof HTMLElement &&
        (f.setAttribute('aria-pressed', String(Boolean(e.queue.oneTap))),
        (f.textContent = e.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((t) => {
                if (!(t instanceof HTMLButtonElement)) return;
                const a = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1;
                t.disabled =
                    'locked' === e.queue.stationMode &&
                    a !== Number(e.queue.stationConsultorio || 1);
            }),
        ie());
}
function se(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function ce(t, e = {}) {
    const a =
        t?.data?.queueState ||
        t?.data?.queue_state ||
        t?.data?.queueMeta ||
        t?.data ||
        null;
    if (!a || 'object' != typeof a) return;
    const n = (function (t) {
            return t && 'object' == typeof t
                ? Array.isArray(t.queue_tickets)
                    ? t.queue_tickets
                    : Array.isArray(t.queueTickets)
                      ? t.queueTickets
                      : Array.isArray(t.tickets)
                        ? t.tickets
                        : []
                : [];
        })(a),
        i = t?.data?.ticket || null;
    if (
        !(function (t, e, a) {
            if (e.length > 0) return !0;
            if (
                se(t, 'queue_tickets') ||
                se(t, 'queueTickets') ||
                se(t, 'tickets')
            )
                return !0;
            if (a && 'object' == typeof a) return !0;
            if (
                se(t, 'waitingCount') ||
                se(t, 'waiting_count') ||
                se(t, 'calledCount') ||
                se(t, 'called_count') ||
                se(t, 'completedCount') ||
                se(t, 'completed_count') ||
                se(t, 'noShowCount') ||
                se(t, 'no_show_count') ||
                se(t, 'cancelledCount') ||
                se(t, 'cancelled_count')
            )
                return !0;
            const n =
                t?.counts && 'object' == typeof t.counts ? t.counts : null;
            if (
                n &&
                (se(n, 'waiting') ||
                    se(n, 'called') ||
                    se(n, 'completed') ||
                    se(n, 'no_show') ||
                    se(n, 'noShow') ||
                    se(n, 'cancelled') ||
                    se(n, 'canceled'))
            )
                return !0;
            if (se(t, 'nextTickets') || se(t, 'next_tickets')) return !0;
            const i =
                t?.callingNowByConsultorio &&
                'object' == typeof t.callingNowByConsultorio
                    ? t.callingNowByConsultorio
                    : t?.calling_now_by_consultorio &&
                        'object' == typeof t.calling_now_by_consultorio
                      ? t.calling_now_by_consultorio
                      : null;
            return (
                !(
                    !i ||
                    !(
                        Boolean(i[1]) ||
                        Boolean(i[2]) ||
                        Boolean(i[1]) ||
                        Boolean(i[2])
                    )
                ) || Ht(t?.callingNow).concat(Ht(t?.calling_now)).some(Boolean)
            );
        })(a, n, i)
    )
        return;
    const o = 'fallback' === It(e.syncMode) ? 'fallback' : 'live',
        s = (m().data.queueTickets || []).map((t, e) => Kt(t, e)),
        c = Ut(a, s),
        l = (function (t) {
            const e =
                    t?.counts && 'object' == typeof t.counts ? t.counts : null,
                a =
                    se(t, 'waitingCount') ||
                    se(t, 'waiting_count') ||
                    Boolean(e && se(e, 'waiting')),
                n =
                    se(t, 'calledCount') ||
                    se(t, 'called_count') ||
                    Boolean(e && se(e, 'called')),
                i = se(t, 'nextTickets') || se(t, 'next_tickets'),
                o =
                    se(t, 'callingNowByConsultorio') ||
                    se(t, 'calling_now_by_consultorio') ||
                    se(t, 'callingNow') ||
                    se(t, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        r = Jt(c),
        u = Boolean(i && 'object' == typeof i);
    if (!(n.length || r.length || u || l.waiting || l.called)) return;
    const d =
            Number(c.waitingCount || 0) >
            r.filter((t) => 'waiting' === t.status).length,
        p = new Map(s.map((t) => [Gt(t), t]));
    if (n.length) ee(n, c, { fallbackPartial: !1, syncMode: o });
    else {
        !(function (t, e, a) {
            const n = e.callingNowByConsultorio || {},
                i = Number(e.calledCount || e.counts?.called || 0),
                o = Number(e.waitingCount || e.counts?.waiting || 0),
                s = Ht(e.nextTickets),
                c = new Set(),
                l = n[1] || n[1] || null,
                r = n[2] || n[2] || null;
            (l && c.add(Gt(l)), r && c.add(Gt(r)));
            const u = new Set(s.map((t) => Gt(t))),
                d = c.size > 0 || 0 === i,
                p = u.size > 0 || 0 === o,
                m = u.size > 0 && o > u.size;
            for (const [e, n] of t.entries()) {
                const i = Kt(n, 0);
                a.called && d && 'called' === i.status && !c.has(e)
                    ? t.set(
                          e,
                          Kt(
                              {
                                  ...i,
                                  status: 'completed',
                                  assignedConsultorio: null,
                                  completedAt:
                                      i.completedAt || new Date().toISOString(),
                              },
                              0
                          )
                      )
                    : a.waiting &&
                      p &&
                      'waiting' === i.status &&
                      (o <= 0 ? t.delete(e) : m || u.has(e) || t.delete(e));
            }
        })(p, c, l);
        for (const t of r) {
            const e = Gt(t),
                a = p.get(e) || null,
                n = zt(t.createdAt, t.created_at, a?.createdAt, a?.created_at),
                i = zt(
                    t.priorityClass,
                    t.priority_class,
                    a?.priorityClass,
                    a?.priority_class,
                    'walk_in'
                ),
                o = zt(
                    t.queueType,
                    t.queue_type,
                    a?.queueType,
                    a?.queue_type,
                    'walk_in'
                ),
                s = zt(
                    t.patientInitials,
                    t.patient_initials,
                    a?.patientInitials,
                    a?.patient_initials,
                    '--'
                );
            p.set(
                e,
                Kt(
                    {
                        ...(a || {}),
                        ...t,
                        status: t.status,
                        assignedConsultorio: t.assignedConsultorio,
                        createdAt: n || new Date().toISOString(),
                        priorityClass: i,
                        queueType: o,
                        patientInitials: s,
                    },
                    p.size
                )
            );
        }
        if (u) {
            const t = Kt(i, p.size),
                e = Gt(t),
                a = p.get(e) || null;
            p.set(e, Kt({ ...(a || {}), ...t }, p.size));
        }
        ee(Array.from(p.values()), c, { fallbackPartial: d, syncMode: o });
    }
}
function le(t, e, a = null) {
    ae(t, (t) => ({
        ...t,
        status: e,
        assignedConsultorio: a ?? t.assignedConsultorio,
        completedAt: new Date().toISOString(),
    }));
}
async function re() {
    try {
        (ce(await D('queue-state'), { syncMode: 'live' }),
            jt('Queue refresh realizado'));
    } catch (t) {
        jt('Queue refresh con error');
        const e = k(Dt, null);
        e?.queueTickets &&
            ee(e.queueTickets, e.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            });
    }
}
function ue(t) {
    ne({ filter: It(t) || 'all' });
}
async function de(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        a = m();
    if (!Lt.get(e)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== e
        )
            return (
                jt(`Llamado bloqueado para C${e} por lock de estacion`),
                void o('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const t = (function (t) {
                return Wt().queueTickets.find(
                    (e) =>
                        'waiting' === e.status &&
                        (!e.assignedConsultorio || e.assignedConsultorio === t)
                );
            })(e);
            return t
                ? ((function (t, e) {
                      ae(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void jt(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void jt('Practica: sin tickets en espera');
        }
        Lt.set(e, !0);
        try {
            (ce(
                await D('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                jt(`Llamado C${e} ejecutado`));
        } catch (t) {
            (jt(`Error llamando siguiente en C${e}`),
                o(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            Lt.set(e, !1);
        }
    }
}
async function pe({ ticketId: t, action: e, consultorio: a }) {
    const n = Number(t || 0),
        i = Pt(e);
    if (n && i)
        return m().queue.practiceMode
            ? ('reasignar' === i || 're-llamar' === i || 'rellamar' === i
                  ? le(n, 'called', 2 === Number(a || 1) ? 2 : 1)
                  : 'completar' === i
                    ? le(n, 'completed')
                    : 'no_show' === i
                      ? le(n, 'no_show')
                      : 'cancelar' === i && le(n, 'cancelled'),
              void jt(`Practica: accion ${i} en ticket ${n}`))
            : (ce(
                  await D('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void jt(`Accion ${i} ticket ${n}`));
}
async function me() {
    const t = m().queue.pendingSensitiveAction;
    t ? (te(), await pe(t)) : te();
}
function be() {
    (te(), jt('Accion sensible cancelada'));
}
function fe() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = m().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (be(), 0)
    );
}
async function ye(t) {
    const e = Number(t || 0);
    e &&
        (m().queue.practiceMode
            ? jt(`Practica: reprint ticket ${e}`)
            : (await D('queue-reprint', { method: 'POST', body: { id: e } }),
              jt(`Reimpresion ticket ${e}`)));
}
function ge() {
    ne({ helpOpen: !m().queue.helpOpen });
}
function he(t) {
    const e = Boolean(t);
    (te(),
        ne({ practiceMode: e }),
        jt(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function ve() {
    const t = m(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        Wt().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
async function ke(t) {
    const e = m();
    if (e.queue.captureCallKeyMode) {
        const e = {
            key: String(t.key || ''),
            code: String(t.code || ''),
            location: Number(t.location || 0),
        };
        return (
            ne({ customCallKey: e, captureCallKeyMode: !1 }),
            o('Tecla externa guardada', 'success'),
            void jt(`Tecla externa calibrada: ${e.code}`)
        );
    }
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                It(e.code) === It(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await de(e.queue.stationConsultorio));
    const a = It(t.code),
        n = It(t.key),
        i =
            'numpadenter' === a ||
            'kpenter' === a ||
            ('enter' === n && 3 === Number(t.location || 0));
    if (i && e.queue.pendingSensitiveAction) await me();
    else {
        if ('numpad2' === a || '2' === n)
            return 'locked' === e.queue.stationMode &&
                2 !== e.queue.stationConsultorio
                ? (o('Cambio bloqueado por modo estación', 'warning'),
                  void jt('Cambio de estación bloqueado por lock'))
                : (ne({ stationConsultorio: 2 }),
                  void jt('Numpad: estacion C2'));
        if ('numpad1' === a || '1' === n)
            return 'locked' === e.queue.stationMode &&
                1 !== e.queue.stationConsultorio
                ? (o('Cambio bloqueado por modo estación', 'warning'),
                  void jt('Cambio de estación bloqueado por lock'))
                : (ne({ stationConsultorio: 1 }),
                  void jt('Numpad: estacion C1'));
        if (i) {
            if (e.queue.oneTap) {
                const t = ve();
                t &&
                    (await pe({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    }));
            }
            await de(e.queue.stationConsultorio);
        } else {
            if (
                'numpaddecimal' === a ||
                'kpdecimal' === a ||
                'decimal' === n ||
                ',' === n ||
                '.' === n
            ) {
                const t = ve();
                return void (
                    t &&
                    Zt({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadsubtract' === a || 'kpsubtract' === a || '-' === n) {
                const t = ve();
                return void (
                    t &&
                    Zt({
                        ticketId: t.id,
                        action: 'no_show',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadadd' === a || 'kpadd' === a || '+' === n) {
                const t = ve();
                t &&
                    (await pe({
                        ticketId: t.id,
                        action: 're-llamar',
                        consultorio: e.queue.stationConsultorio,
                    }),
                    jt(`Re-llamar ${t.ticketCode}`),
                    o(`Re-llamar ${t.ticketCode}`, 'info'));
            }
        }
    }
}
function we(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
const qe = 'adminLastSection',
    Ce = 'adminSidebarCollapsed';
function Se(t, { persist: e = !1 } = {}) {
    const a = (function (t) {
        const e = (function (t) {
            return 'light' === t || 'dark' === t
                ? t
                : window.matchMedia &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';
        })(t);
        return (
            document.documentElement.setAttribute('data-theme-mode', t),
            document.documentElement.setAttribute('data-theme', e),
            e
        );
    })(t);
    (f((e) => ({ ...e, ui: { ...e.ui, themeMode: t, theme: a } })),
        e &&
            (function (t) {
                const e = S.has(t) ? t : 'system';
                v(C, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const a = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
}
function Ae() {
    const t = m();
    (v(qe, t.ui.activeSection), v(Ce, t.ui.sidebarCollapsed ? '1' : '0'));
}
function Me() {
    s(
        '#adminRefreshStatus',
        (function () {
            const t = m(),
                e = Number(t.ui.lastRefreshAt || 0);
            if (!e) return 'Datos: sin sincronizar';
            const a = Math.max(0, Math.round((Date.now() - e) / 1e3));
            return a < 60
                ? `Datos: hace ${a}s`
                : `Datos: hace ${Math.round(a / 60)}m`;
        })()
    );
}
function Te() {
    ((function (e) {
        const a = Array.isArray(e.data.appointments) ? e.data.appointments : [],
            n = Array.isArray(e.data.callbacks) ? e.data.callbacks : [],
            o = Array.isArray(e.data.reviews) ? e.data.reviews : [],
            l = e.data.funnelMetrics || {},
            r = new Date().toISOString().split('T')[0],
            u = a.filter((t) => String(t.date || '') === r).length,
            d = n.filter((t) => {
                const e = we(t.status);
                return 'pending' === e || 'pendiente' === e;
            }).length,
            p = a.filter((t) => 'no_show' === we(t.status)).length,
            m = o.length
                ? (
                      o.reduce((t, e) => t + Number(e.rating || 0), 0) /
                      o.length
                  ).toFixed(1)
                : '0.0';
        (s('#todayAppointments', u),
            s('#totalAppointments', a.length),
            s('#pendingCallbacks', d),
            s('#totalReviewsCount', o.length),
            s('#totalNoShows', p),
            s('#avgRating', m),
            s('#adminAvgRating', m));
        const b = l.summary || {};
        (s('#funnelViewBooking', i(b.viewBooking || 0)),
            s('#funnelStartCheckout', i(b.startCheckout || 0)),
            s('#funnelBookingConfirmed', i(b.bookingConfirmed || 0)),
            s(
                '#funnelAbandonRate',
                `${Number(b.abandonRatePct || 0).toFixed(1)}%`
            ));
        const f = (e, a, n) =>
            Array.isArray(e) && e.length
                ? e
                      .slice(0, 6)
                      .map((e) => {
                          return (
                              (i = String(e[a] || e.label || '-')),
                              (o = String(e[n] ?? e.count ?? 0)),
                              `<li><span>${t(i)}</span><strong>${t(o)}</strong></li>`
                          );
                          var i, o;
                      })
                      .join('')
                : '<li><span>Sin datos</span><strong>0</strong></li>';
        (c('#funnelEntryList', f(l.checkoutEntryBreakdown, 'entry', 'count')),
            c('#funnelSourceList', f(l.sourceBreakdown, 'source', 'count')),
            c(
                '#funnelPaymentMethodList',
                f(l.paymentMethodBreakdown, 'method', 'count')
            ),
            c(
                '#funnelAbandonReasonList',
                f(l.abandonReasonBreakdown, 'reason', 'count')
            ),
            c('#funnelStepList', f(l.bookingStepBreakdown, 'step', 'count')),
            c('#funnelErrorCodeList', f(l.errorCodeBreakdown, 'code', 'count')),
            c(
                '#funnelAbandonList',
                f(l.checkoutAbandonByStep, 'step', 'count')
            ));
        const y = a.filter((t) => {
                const e = we(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length,
            g = n.filter((t) => {
                const e = we(t.status);
                if ('pending' !== e && 'pendiente' !== e) return !1;
                const a = new Date(t.fecha || t.createdAt || '');
                return (
                    !Number.isNaN(a.getTime()) &&
                    (Date.now() - a.getTime()) / 6e4 >= 60
                );
            }).length;
        (s('#operationPendingReviewCount', y),
            s('#operationPendingCallbacksCount', d),
            s('#operationTodayLoadCount', u),
            s(
                '#operationQueueHealth',
                g > 0 ? 'Cola: atencion requerida' : 'Cola: estable'
            ),
            c(
                '#operationActionList',
                [
                    {
                        action: 'context-open-appointments-transfer',
                        label: 'Validar transferencias',
                        desc: `${y} por revisar`,
                    },
                    {
                        action: 'context-open-callbacks-pending',
                        label: 'Triage callbacks',
                        desc: `${d} pendientes`,
                    },
                    {
                        action: 'refresh-admin-data',
                        label: 'Actualizar tablero',
                        desc: 'Sincronizar datos',
                    },
                ]
                    .map(
                        (e) =>
                            `\n            <button type="button" class="operations-action-item" data-action="${e.action}">\n                <span>${t(e.label)}</span>\n                <small>${t(e.desc)}</small>\n            </button>\n        `
                    )
                    .join('')
            ));
    })(m()),
        it(),
        pt(),
        (function () {
            const e = m(),
                a = Array.isArray(e.data.reviews) ? e.data.reviews : [];
            a.length
                ? c(
                      '#reviewsGrid',
                      a
                          .slice()
                          .sort(
                              (t, e) =>
                                  new Date(
                                      e.date || e.createdAt || 0
                                  ).getTime() -
                                  new Date(t.date || t.createdAt || 0).getTime()
                          )
                          .map((e) => {
                              const a = Number(e.rating || 0),
                                  i = '★★★★★☆☆☆☆☆'.slice(
                                      5 - Math.max(0, Math.min(5, a)),
                                      10 - Math.max(0, Math.min(5, a))
                                  );
                              return `\n                <article class="review-card">\n                    <header><strong>${t(e.name || 'Anonimo')}</strong><span>${i}</span></header>\n                    <p>${t(e.comment || e.review || '')}</p>\n                    <small>${t(n(e.date || e.createdAt || ''))}</small>\n                </article>\n            `;
                          })
                          .join('')
                  )
                : c('#reviewsGrid', '<p>No hay resenas registradas.</p>');
        })(),
        Ct(),
        oe(),
        Me());
}
async function _e(t, e = {}) {
    const a = M(t, 'dashboard'),
        { force: n = !1 } = e,
        i = m().ui.activeSection;
    (n ||
        'availability' !== m().ui.activeSection ||
        'availability' === a ||
        !Boolean(m().availability.draftDirty) ||
        window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        )) &&
        (!(function (t) {
            const e = M(t, 'dashboard');
            (f((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                R(e),
                T(e),
                Ae());
        })(a),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const t = m();
                return (
                    'fallback' !== It(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await re()));
}
function Ne() {
    f((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    }));
    const t = m();
    (z({ open: t.ui.sidebarOpen, collapsed: t.ui.sidebarCollapsed }), Ae());
}
function $e() {
    f((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } }));
    const t = m();
    z({ open: t.ui.sidebarOpen, collapsed: t.ui.sidebarCollapsed });
}
function De() {
    (f((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })),
        z({ open: !1, collapsed: m().ui.sidebarCollapsed }));
}
function Le() {
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function Ee() {
    const t = m().ui.activeSection;
    if ('appointments' === t) {
        const t = document.getElementById('searchAppointments');
        return void (t instanceof HTMLInputElement && t.focus());
    }
    if ('callbacks' === t) {
        const t = document.getElementById('searchCallbacks');
        return void (t instanceof HTMLInputElement && t.focus());
    }
    if ('queue' === t) {
        const t = document.getElementById('queueSearchInput');
        t instanceof HTMLInputElement && t.focus();
    }
}
async function Be(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await _e('appointments'), st('pending_transfer'));
            break;
        case 'appointments_all':
            (await _e('appointments'), st('all'));
            break;
        case 'appointments_no_show':
            (await _e('appointments'), st('no_show'));
            break;
        case 'callbacks_pending':
            (await _e('callbacks'), bt('pending'));
            break;
        case 'callbacks_contacted':
            (await _e('callbacks'), bt('contacted'));
            break;
        case 'queue_sla_risk':
            (await _e('queue'), ue('sla_risk'));
            break;
        case 'queue_waiting':
            (await _e('queue'), ue('waiting'));
            break;
        case 'queue_called':
            (await _e('queue'), ue('called'));
            break;
        case 'queue_no_show':
            (await _e('queue'), ue('no_show'));
            break;
        case 'queue_all':
            (await _e('queue'), ue('all'));
            break;
        case 'queue_call_next':
            (await _e('queue'), await de(m().queue.stationConsultorio));
    }
}
async function Ie(t = !1) {
    const e = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    D('data'),
                    D('health').catch(() => null),
                ]),
                a = t.data || {};
            let n = a.funnelMetrics || null;
            if (!n) {
                const t = await D('funnel-metrics').catch(() => null);
                n = t?.data || null;
            }
            const i = {
                appointments: Array.isArray(a.appointments)
                    ? a.appointments
                    : [],
                callbacks: Array.isArray(a.callbacks) ? a.callbacks : [],
                reviews: Array.isArray(a.reviews) ? a.reviews : [],
                availability:
                    a.availability && 'object' == typeof a.availability
                        ? a.availability
                        : {},
                availabilityMeta:
                    a.availabilityMeta && 'object' == typeof a.availabilityMeta
                        ? a.availabilityMeta
                        : {},
                queueTickets: Y(a),
                queueMeta:
                    a.queueMeta && 'object' == typeof a.queueMeta
                        ? a.queueMeta
                        : a.queue_state && 'object' == typeof a.queue_state
                          ? a.queue_state
                          : null,
                funnelMetrics: n,
                health: e && e.ok ? e : null,
            };
            return (
                X(i),
                (function (t) {
                    (w(F, t.appointments || []),
                        w(K, t.callbacks || []),
                        w(V, t.reviews || []),
                        w(Q, t.availability || {}),
                        w(U, t.availabilityMeta || {}),
                        w(G, t.queueTickets || []),
                        w(J, t.queueMeta || null),
                        w(W, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (
                X({
                    appointments: k(F, []),
                    callbacks: k(K, []),
                    reviews: k(V, []),
                    availability: k(Q, {}),
                    availabilityMeta: k(U, {}),
                    queueTickets: k(G, []),
                    queueMeta: k(J, null),
                    health: k(W, null),
                    funnelMetrics: {
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
                        checkoutEntryBreakdown: [],
                        paymentMethodBreakdown: [],
                        bookingStepBreakdown: [],
                        sourceBreakdown: [],
                        abandonReasonBreakdown: [],
                        errorCodeBreakdown: [],
                    },
                }),
                !1
            );
        }
    })();
    (!(function () {
        const t = ht(m().data.availability || {}),
            e = wt();
        (qt({
            draft: t,
            selectedDate: e,
            monthAnchor: new Date(e || new Date()),
            draftDirty: !1,
        }),
            Ct());
    })(),
        await (async function () {
            const t = m(),
                e = Array.isArray(t.data.queueTickets)
                    ? t.data.queueTickets.map((t, e) => Kt(t, e))
                    : [],
                a =
                    t.data.queueMeta && 'object' == typeof t.data.queueMeta
                        ? Ut(t.data.queueMeta, e)
                        : null;
            if (e.length)
                return void ee(e, a || null, {
                    fallbackPartial: !1,
                    syncMode: 'live',
                });
            const n = a ? Jt(a) : [];
            if (n.length)
                return (
                    ee(n, a, { fallbackPartial: !0, syncMode: 'fallback' }),
                    void jt('Queue fallback parcial desde metadata')
                );
            if ((await re(), (m().data.queueTickets || []).length)) return;
            const i = k(Dt, null);
            if (i?.queueTickets?.length)
                return (
                    ee(i.queueTickets, i.queueMeta || null, {
                        fallbackPartial: !0,
                        syncMode: 'fallback',
                    }),
                    void jt('Queue fallback desde snapshot local')
                );
            ee([], null, { fallbackPartial: !1, syncMode: 'live' });
        })(),
        Te(),
        t &&
            o(
                e ? 'Datos actualizados' : 'Datos cargados desde cache local',
                e ? 'success' : 'warning'
            ));
}
function xe(t) {
    const e = String(t || '')
        .trim()
        .toLowerCase();
    return e
        ? e.includes('callbacks') && e.includes('pend')
            ? 'callbacks_pending'
            : e.includes('citas') && e.includes('transfer')
              ? 'appointments_pending_transfer'
              : e.includes('queue') || e.includes('cola')
                ? 'queue_sla_risk'
                : e.includes('no show')
                  ? 'appointments_no_show'
                  : null
        : null;
}
async function Pe(t, a) {
    switch (t) {
        case 'close-toast':
            return void a.closest('.toast')?.remove();
        case 'set-admin-theme':
            return void Se(String(a.dataset.themeMode || 'system'), {
                persist: !0,
            });
        case 'toggle-sidebar-collapse':
            return void Ne();
        case 'refresh-admin-data':
            return void (await Ie(!0));
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = xe(t.value);
                e && (await Be(e));
            }
            return;
        }
        case 'logout':
            return (
                await (async function () {
                    try {
                        await L('logout', { method: 'POST' });
                    } catch (t) {}
                    ($(''),
                        b({
                            ...m(),
                            auth: {
                                authenticated: !1,
                                csrfToken: '',
                                requires2FA: !1,
                            },
                        }));
                })(),
                H(),
                void o('Sesion cerrada', 'info')
            );
        case 'appointment-quick-filter':
            return void st(String(a.dataset.filterValue || 'all'));
        case 'clear-appointment-filters':
            return void ot({ filter: 'all', search: '' });
        case 'appointment-density':
            return void ot({
                density:
                    'compact' === Z(String(a.dataset.density || 'comfortable'))
                        ? 'compact'
                        : 'comfortable',
            });
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await lt(t, { paymentStatus: 'paid' }),
                        ct(t, { paymentStatus: 'paid' }));
                })(Number(a.dataset.id || 0)),
                void o('Transferencia aprobada', 'success')
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await lt(t, { paymentStatus: 'failed' }),
                        ct(t, { paymentStatus: 'failed' }));
                })(Number(a.dataset.id || 0)),
                void o('Transferencia rechazada', 'warning')
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await lt(t, { status: 'no_show' }),
                        ct(t, { status: 'no_show' }));
                })(Number(a.dataset.id || 0)),
                void o('Marcado como no show', 'warning')
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await lt(t, { status: 'cancelled' }),
                        ct(t, { status: 'cancelled' }));
                })(Number(a.dataset.id || 0)),
                void o('Cita cancelada', 'warning')
            );
        case 'export-csv':
            return void (function () {
                const t = [
                        [
                            'id',
                            'name',
                            'service',
                            'date',
                            'time',
                            'status',
                            'payment_status',
                        ],
                        ...(m().data.appointments || []).map((t) => [
                            t.id,
                            t.name,
                            t.service,
                            t.date,
                            t.time,
                            t.status,
                            t.paymentStatus || t.payment_status || '',
                        ]),
                    ]
                        .map((t) =>
                            t
                                .map(
                                    (t) =>
                                        `"${String(t ?? '').replace(/"/g, '""')}"`
                                )
                                .join(',')
                        )
                        .join('\n'),
                    e = new Blob([t], { type: 'text/csv;charset=utf-8' }),
                    a = URL.createObjectURL(e),
                    n = document.createElement('a');
                ((n.href = a),
                    (n.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
                    document.body.appendChild(n),
                    n.click(),
                    n.remove(),
                    URL.revokeObjectURL(a));
            })();
        case 'callback-quick-filter':
            return void bt(String(a.dataset.filterValue || 'all'));
        case 'clear-callback-filters':
            return void mt({ filter: 'all', search: '', selected: [] });
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await _e('callbacks'),
                bt('pending'),
                void (function () {
                    const t = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    t instanceof HTMLElement && t.focus();
                })()
            );
        case 'mark-contacted':
            return (
                await ft(
                    Number(a.dataset.callbackId || 0),
                    String(a.dataset.callbackDate || '')
                ),
                void o('Callback actualizado', 'success')
            );
        case 'change-month':
            return void (function (t) {
                const e = Number(t || 0);
                Number.isFinite(e) &&
                    0 !== e &&
                    (f((t) => {
                        const a = new Date(
                            t.availability.monthAnchor || new Date()
                        );
                        return (
                            a.setMonth(a.getMonth() + e),
                            {
                                ...t,
                                availability: {
                                    ...t.availability,
                                    monthAnchor: a,
                                },
                            }
                        );
                    }),
                    Ct());
            })(Number(a.dataset.delta || 0));
        case 'availability-today':
        case 'context-availability-today':
            return void (function () {
                const t = new Date();
                (f((e) => ({
                    ...e,
                    availability: {
                        ...e.availability,
                        selectedDate: r(t),
                        monthAnchor: new Date(t),
                    },
                })),
                    Ct());
            })();
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return void (function () {
                const t = vt(),
                    e = r(new Date()),
                    a = Object.keys(t)
                        .filter(
                            (a) =>
                                a >= e && Array.isArray(t[a]) && t[a].length > 0
                        )
                        .sort()[0];
                a &&
                    (f((t) => ({
                        ...t,
                        availability: {
                            ...t.availability,
                            selectedDate: a,
                            monthAnchor: new Date(a),
                        },
                    })),
                    Ct());
            })();
        case 'select-availability-day':
            return void (function (t) {
                const e = String(t || '').trim();
                e && (qt({ selectedDate: e }), Ct());
            })(String(a.dataset.date || ''));
        case 'prefill-time-slot':
            return void (function (t) {
                const a = e('#newSlotTime');
                a instanceof HTMLInputElement && ((a.value = yt(t)), a.focus());
            })(String(a.dataset.time || ''));
        case 'add-time-slot':
            return void (function () {
                if (kt()) return;
                const t = e('#newSlotTime');
                if (!(t instanceof HTMLInputElement)) return;
                const a = yt(t.value);
                if (!a) return;
                const n = m(),
                    i = n.availability.selectedDate || wt();
                (St(i, [
                    ...(Array.isArray(n.availability.draft[i])
                        ? n.availability.draft[i]
                        : []),
                    a,
                ]),
                    (t.value = ''));
            })();
        case 'remove-time-slot':
            return void (function (t, e) {
                if (kt()) return;
                const a = m();
                St(
                    t,
                    (Array.isArray(a.availability.draft[t])
                        ? a.availability.draft[t]
                        : []
                    ).filter((t) => yt(t) !== yt(e))
                );
            })(
                decodeURIComponent(String(a.dataset.date || '')),
                decodeURIComponent(String(a.dataset.time || ''))
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return void (function () {
                if (kt()) return;
                const t = m(),
                    e = t.availability.selectedDate || wt();
                (qt({
                    clipboard: gt(
                        Array.isArray(t.availability.draft[e])
                            ? t.availability.draft[e]
                            : []
                    ),
                }),
                    Ct());
            })();
        case 'paste-availability-day':
            return void (function () {
                if (kt()) return;
                const t = m();
                St(
                    t.availability.selectedDate || wt(),
                    t.availability.clipboard || []
                );
            })();
        case 'duplicate-availability-day-next':
            return void At(1);
        case 'duplicate-availability-next-week':
            return void At(7);
        case 'clear-availability-day':
            return void (kt() || St(m().availability.selectedDate || wt(), []));
        case 'clear-availability-week':
            return void (function () {
                if (kt()) return;
                const t = m().availability.selectedDate || wt(),
                    e = new Date(t);
                if (Number.isNaN(e.getTime())) return;
                const a = vt();
                for (let t = 0; t < 7; t += 1) {
                    const n = new Date(e);
                    (n.setDate(e.getDate() + t), (a[r(n)] = []));
                }
                (qt({ draft: a, draftDirty: !0 }), Ct());
            })();
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (kt()) return;
                    const t = vt();
                    (await D('availability', {
                        method: 'POST',
                        body: { availability: t },
                    }),
                        f((e) => ({
                            ...e,
                            data: { ...e.data, availability: t },
                            availability: {
                                ...e.availability,
                                draft: t,
                                draftDirty: !1,
                            },
                        })),
                        Ct());
                })(),
                void o('Disponibilidad guardada', 'success')
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    const t = ht(m().data.availability || {});
                    (f((e) => ({
                        ...e,
                        availability: {
                            ...e.availability,
                            draft: t,
                            draftDirty: !1,
                        },
                    })),
                        Ct());
                })(),
                void o('Borrador descartado', 'info')
            );
        case 'queue-refresh-state':
            return void (await re());
        case 'queue-call-next':
            return void (await de(Number(a.dataset.queueConsultorio || 0)));
        case 'queue-ticket-action':
            return void (await (async function (t, e, a = 0) {
                const n = {
                    ticketId: Number(t || 0),
                    action: Pt(e),
                    consultorio: Number(a || 0),
                };
                if (!m().queue.practiceMode && Bt.has(n.action))
                    return (
                        Zt(n),
                        void jt(`Accion ${n.action} pendiente de confirmacion`)
                    );
                await pe(n);
            })(
                Number(a.dataset.queueId || 0),
                String(a.dataset.queueAction || ''),
                Number(a.dataset.queueConsultorio || 0)
            ));
        case 'queue-reprint-ticket':
            return void (await ye(Number(a.dataset.queueId || 0)));
        case 'queue-bulk-action':
            return void (await (async function (t) {
                const e = Yt(),
                    a = Pt(t);
                if (e.length) {
                    if (Bt.has(a)) {
                        const t =
                            'no_show' === a
                                ? 'No show'
                                : 'completar' === a || 'completed' === a
                                  ? 'Completar'
                                  : 'Cancelar';
                        if (!window.confirm(`${t}: confirmar acción masiva`))
                            return;
                    }
                    for (const t of e)
                        try {
                            await pe({
                                ticketId: t.id,
                                action: a,
                                consultorio:
                                    t.assignedConsultorio ||
                                    m().queue.stationConsultorio,
                            });
                        } catch (t) {}
                    jt(`Bulk ${a} sobre ${e.length} tickets`);
                }
            })(String(a.dataset.queueAction || 'no_show')));
        case 'queue-bulk-reprint':
            return void (await (async function () {
                const t = Yt();
                for (const e of t)
                    try {
                        await ye(e.id);
                    } catch (t) {}
                jt(`Bulk reimpresion ${t.length}`);
            })());
        case 'queue-clear-search':
            return void (function () {
                ne({ search: '' });
                const t = document.getElementById('queueSearchInput');
                t instanceof HTMLInputElement && (t.value = '');
            })();
        case 'queue-toggle-shortcuts':
            return void ge();
        case 'queue-toggle-one-tap':
            return void ne({ oneTap: !m().queue.oneTap });
        case 'queue-start-practice':
            return void he(!0);
        case 'queue-stop-practice':
            return void he(!1);
        case 'queue-lock-station':
            return void (function (t) {
                const e = 2 === Number(t || 0) ? 2 : 1;
                (ne({ stationMode: 'locked', stationConsultorio: e }),
                    jt(`Estacion bloqueada en C${e}`));
            })(Number(a.dataset.queueConsultorio || 1));
        case 'queue-set-station-mode':
            return void (function (t) {
                if ('free' === It(t))
                    return (
                        ne({ stationMode: 'free' }),
                        void jt('Estacion en modo libre')
                    );
                ne({ stationMode: 'locked' });
            })(String(a.dataset.queueMode || 'free'));
        case 'queue-sensitive-confirm':
            return void (await me());
        case 'queue-sensitive-cancel':
            return void be();
        case 'queue-capture-call-key':
            return (
                ne({ captureCallKeyMode: !0 }),
                void o('Calibración activa: presiona la tecla externa', 'info')
            );
        case 'queue-clear-call-key':
            return void (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                (ne({ customCallKey: null, captureCallKeyMode: !1 }),
                o('Tecla externa eliminada', 'success'))
            );
        case 'callbacks-bulk-select-visible':
            return void mt({
                selected: Array.from(
                    document.querySelectorAll('#callbacksGrid .callback-card')
                )
                    .map((t) => Number(t.getAttribute('data-callback-id') || 0))
                    .filter((t) => t > 0),
            });
        case 'callbacks-bulk-mark':
            return void (await (async function () {
                const t = (m().callbacks.selected || [])
                    .map((t) => Number(t || 0))
                    .filter((t) => t > 0);
                for (const e of t)
                    try {
                        await ft(e);
                    } catch (t) {}
            })());
        case 'context-open-appointments-transfer':
            return (await _e('appointments'), void st('pending_transfer'));
        case 'context-open-callbacks-pending':
            return (await _e('callbacks'), void bt('pending'));
        case 'context-open-dashboard':
            return void (await _e('dashboard'));
    }
}
async function He(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = e instanceof HTMLInputElement ? e.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        if (m().auth.requires2FA)
            await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Codigo 2FA requerido');
                const a = await L('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    n = String(a.csrfToken || '');
                return (
                    $(n),
                    b({
                        ...m(),
                        auth: {
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                        },
                    }),
                    { authenticated: !0 }
                );
            })(i);
        else {
            const t = await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Contrasena requerida');
                const a = await L('login', {
                    method: 'POST',
                    body: { password: e },
                });
                if (!0 === a.twoFactorRequired)
                    return (
                        b({ ...m(), auth: { ...m().auth, requires2FA: !0 } }),
                        o('Codigo 2FA requerido', 'info'),
                        { authenticated: !1, requires2FA: !0 }
                    );
                const n = String(a.csrfToken || '');
                return (
                    $(n),
                    b({
                        ...m(),
                        auth: {
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                        },
                    }),
                    { authenticated: !0, requires2FA: !1 }
                );
            })(n);
            if (t.requires2FA) return void j(!0);
        }
        (O(), j(!1), await Ie(!1), o('Sesion iniciada', 'success'));
    } catch (t) {
        o(t?.message || 'No se pudo iniciar sesion', 'error');
    }
}
async function Oe() {
    (!(function () {
        const t = e('#loginScreen'),
            a = e('#adminDashboard');
        if (!(t instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((t.innerHTML = `\n        <div class="sony-login-shell">\n            <div class="sony-login-brand">\n                <p class="sony-kicker">Piel en Armonia</p>\n                <h1>Admin Operations</h1>\n                <p>Panel operativo con estilo Sony-like.</p>\n            </div>\n            <form id="loginForm" class="sony-login-form">\n                <label for="adminPassword">Contrasena</label>\n                <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" />\n                <div id="group2FA" class="is-hidden">\n                    <label for="admin2FACode">Codigo 2FA</label>\n                    <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" />\n                </div>\n                <button id="loginBtn" type="submit">Ingresar</button>\n            </form>\n            <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${B('sun')}</button>\n                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${B('moon')}</button>\n                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${B('system')}</button>\n            </div>\n        </div>\n    `),
            (a.innerHTML = `\n        <aside class="admin-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <strong>Piel en Armonia</strong>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${B('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                ${P('dashboard', 'Dashboard', 'dashboard', !0)}\n                ${P('appointments', 'Citas', 'appointments')}\n                ${P('callbacks', 'Callbacks', 'callbacks')}\n                ${P('reviews', 'Resenas', 'reviews')}\n                ${P('availability', 'Disponibilidad', 'availability')}\n                ${P('queue', 'Turnero Sala', 'queue')}\n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${B('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n        <main class="admin-main" id="adminMainContent" tabindex="-1">\n            <header class="admin-header">\n                <div class="admin-header-title-wrap">\n                    <button type="button" id="adminMenuToggle" aria-controls="adminSidebar" aria-expanded="false">${B('menu')}<span>Menu</span></button>\n                    <h2 id="pageTitle">Dashboard</h2>\n                </div>\n                <nav class="admin-quick-nav" data-qa="admin-quick-nav" aria-label="Navegacion rapida">\n                    ${x('dashboard', 'Dashboard', 'Alt+Shift+1', !0)}\n                    ${x('appointments', 'Citas', 'Alt+Shift+2')}\n                    ${x('callbacks', 'Callbacks', 'Alt+Shift+3')}\n                    ${x('reviews', 'Resenas', 'Alt+Shift+4')}\n                    ${x('availability', 'Disponibilidad', 'Alt+Shift+5')}\n                    ${x('queue', 'Turnero', 'Alt+Shift+6')}\n                </nav>\n                <div class="admin-header-actions">\n                    <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${B('sun')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${B('moon')}</button>\n                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${B('system')}</button>\n                    </div>\n                    <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                    <p id="adminRefreshStatus">Datos: sin sincronizar</p>\n                </div>\n            </header>\n\n            <section class="sony-context-strip" id="adminProductivityStrip">\n                <h3 id="adminContextTitle">Acciones rapidas</h3>\n                <div id="adminContextActions"></div>\n                <div class="sony-command-box">\n                    <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />\n                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                </div>\n            </section>\n\n            \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationRefreshSignal">Tiempo real</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header"><h3>Citas</h3></header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </div>\n                <div class="toolbar-row">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header"><h3>Callbacks</h3></header>\n                <div id="callbacksOpsPanel" class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Pendientes</h4><strong id="callbacksOpsPendingCount">0</strong></article>\n                    <article class="sony-kpi"><h4>Urgentes</h4><strong id="callbacksOpsUrgentCount">0</strong></article>\n                    <article class="sony-kpi"><h4>Siguiente</h4><strong id="callbacksOpsNext">-</strong></article>\n                    <article class="sony-kpi"><h4>Estado</h4><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    <article class="sony-kpi"><h4>Hoy</h4><strong id="callbacksOpsTodayCount">0</strong></article>\n                </div>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                    </div>\n                    <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                </div>\n                <div class="toolbar-row">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                    <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                    <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                    <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header"><h3>Resenas</h3></header>\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3 class="availability-calendar">Disponibilidad</h3>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <p id="queueTriageSummary">Sin riesgo</p>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n\n            <button type="button" id="queueReleaseC1" hidden>release</button>\n        </section>\n    \n        </main>\n    `));
    })(),
        document.body.classList.add('admin-v2-mode'),
        (function () {
            (document.addEventListener('click', async (t) => {
                const e =
                    t.target instanceof Element
                        ? t.target.closest('[data-action]')
                        : null;
                if (!e) return;
                const a = String(e.getAttribute('data-action') || '');
                if (a) {
                    t.preventDefault();
                    try {
                        await Pe(a, e);
                    } catch (t) {
                        o(t?.message || 'Error ejecutando accion', 'error');
                    }
                }
            }),
                document.addEventListener('click', async (t) => {
                    const e =
                        t.target instanceof Element
                            ? t.target.closest('[data-section]')
                            : null;
                    if (!e) return;
                    const a = e.classList.contains('admin-quick-nav-item'),
                        n = e.classList.contains('nav-item');
                    (a || n) &&
                        (t.preventDefault(),
                        await _e(
                            String(
                                e.getAttribute('data-section') || 'dashboard'
                            )
                        ),
                        window.matchMedia('(max-width: 1024px)').matches &&
                            De());
                }),
                document.addEventListener('click', (t) => {
                    const e =
                        t.target instanceof Element
                            ? t.target.closest('[data-queue-filter]')
                            : null;
                    e &&
                        (t.preventDefault(),
                        ue(
                            String(e.getAttribute('data-queue-filter') || 'all')
                        ));
                }));
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const e = document.getElementById('callbacksBulkMarkBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = 'datetime_desc',
                e = 'comfortable';
            try {
                ((t = JSON.parse(
                    localStorage.getItem('admin-appointments-sort') ||
                        '"datetime_desc"'
                )),
                    (e = JSON.parse(
                        localStorage.getItem('admin-appointments-density') ||
                            '"comfortable"'
                    )));
            } catch (t) {}
            f((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof t ? t : 'datetime_desc',
                    density: 'string' == typeof e ? e : 'comfortable',
                },
            }));
        })(),
        (function () {
            const t = M(h(qe, 'dashboard')),
                e = '1' === h(Ce, '0');
            (f((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                R(t),
                T(t),
                z({ open: !1, collapsed: e }));
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === It(h(Mt, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(h(Tt, '1')) ? 2 : 1,
                    oneTap: '1' === h(_t, '0'),
                    helpOpen: '1' === h($t, '0'),
                    customCallKey: k(Nt, null),
                },
                e = It(q('station')),
                a = It(q('lock')),
                n = It(q('one_tap')),
                i =
                    'c2' === e || '2' === e
                        ? 2
                        : 'c1' === e || '1' === e
                          ? 1
                          : t.stationConsultorio,
                o = '1' === a || 'true' === a ? 'locked' : t.stationMode,
                s =
                    '1' === n ||
                    'true' === n ||
                    ('0' !== n && 'false' !== n && t.oneTap);
            (f((e) => ({
                ...e,
                queue: {
                    ...e.queue,
                    stationMode: o,
                    stationConsultorio: i,
                    oneTap: s,
                    helpOpen: t.helpOpen,
                    customCallKey:
                        t.customCallKey && 'object' == typeof t.customCallKey
                            ? t.customCallKey
                            : null,
                },
            })),
                Ft(m()));
        })(),
        Se(
            (function () {
                const t = String(h(C, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return S.has(t) ? t : 'system';
            })()
        ),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    st(t.value);
                });
            const e = document.getElementById('appointmentSort');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    ot({ sort: Z(e.value) || 'datetime_desc' });
                });
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    var t;
                    ((t = a.value), ot({ search: String(t || '') }));
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    bt(n.value);
                });
            const i = document.getElementById('searchCallbacks');
            i instanceof HTMLInputElement &&
                i.addEventListener('input', () => {
                    var t;
                    ((t = i.value), mt({ search: String(t || '') }));
                });
            const o = document.getElementById('queueSearchInput');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value), ne({ search: String(t || '') }));
                });
            const s = document.getElementById('adminQuickCommand');
            s instanceof HTMLInputElement &&
                s.addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = xe(s.value);
                    e && (await Be(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                a = e('#adminMenuClose'),
                n = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                window.matchMedia('(max-width: 1024px)').matches ? $e() : Ne();
            }),
                a?.addEventListener('click', () => De()),
                n?.addEventListener('click', () => De()),
                window.addEventListener('resize', () => {
                    window.matchMedia('(max-width: 1024px)').matches || De();
                }),
                window.addEventListener('hashchange', async () => {
                    const t = (function (t = 'dashboard') {
                        return M(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(m().ui.activeSection);
                    await _e(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && Se(String(t.newValue || 'system'));
                }));
        })());
    const t = document.getElementById('loginForm');
    (t instanceof HTMLFormElement && t.addEventListener('submit', He),
        (function (t) {
            const {
                navigateToSection: e,
                focusQuickCommand: a,
                focusCurrentSearch: n,
                runQuickAction: i,
                closeSidebar: o,
                toggleMenu: s,
                dismissQueueSensitiveDialog: c,
                toggleQueueHelp: r,
                queueNumpadAction: u,
            } = t;
            window.addEventListener('keydown', (t) => {
                const d = String(t.key || '').toLowerCase(),
                    p = String(t.code || '').toLowerCase();
                if ('Escape' === t.key) {
                    if ('function' == typeof c && c()) return;
                    return void o();
                }
                if (t.ctrlKey && !t.shiftKey && !t.altKey && 'k' === d)
                    return (t.preventDefault(), void a());
                if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
                    return (t.preventDefault(), void n());
                if (t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey) {
                    const a = p || d;
                    if ('keym' === a) return (t.preventDefault(), void s());
                    if ('digit0' === a) return (t.preventDefault(), void r());
                    if (g[a]) {
                        if (l()) return;
                        return (t.preventDefault(), void e(g[a]));
                    }
                    const n = {
                        keyt: 'appointments_pending_transfer',
                        keya: 'appointments_all',
                        keyn: 'appointments_no_show',
                        keyp: 'callbacks_pending',
                        keyc: 'callbacks_contacted',
                        keyw: 'queue_sla_risk',
                        keyl: 'queue_call_next',
                    };
                    if (
                        ('queue' === m().ui.activeSection &&
                            Object.assign(n, {
                                keyw: 'queue_waiting',
                                keyc: 'queue_called',
                                keya: 'queue_all',
                                keyo: 'queue_all',
                                keyl: 'queue_sla_risk',
                            }),
                        n[a])
                    ) {
                        if (l()) return;
                        return (t.preventDefault(), void i(n[a]));
                    }
                }
                const b = m().queue,
                    f = Boolean(b.captureCallKeyMode),
                    y = b.customCallKey,
                    h =
                        y &&
                        'object' == typeof y &&
                        String(y.key || '') === String(t.key || '') &&
                        String(y.code || '').toLowerCase() === p &&
                        Number(y.location || 0) === Number(t.location || 0);
                if (
                    p.startsWith('numpad') ||
                    3 === t.location ||
                    ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(
                        p
                    ) ||
                    f ||
                    h
                ) {
                    if (l()) return;
                    Promise.resolve(
                        u({ key: t.key, code: t.code, location: t.location })
                    ).catch(() => {});
                }
            });
        })({
            navigateToSection: _e,
            focusQuickCommand: Le,
            focusCurrentSearch: Ee,
            runQuickAction: Be,
            closeSidebar: De,
            toggleMenu: () => {
                window.matchMedia('(max-width: 1024px)').matches ? $e() : Ne();
            },
            dismissQueueSensitiveDialog: fe,
            toggleQueueHelp: () => ge(),
            queueNumpadAction: ke,
        }));
    const a = await (async function () {
        try {
            const t = await L('status'),
                e = !0 === t.authenticated,
                a = e ? String(t.csrfToken || '') : '';
            return (
                $(a),
                b({
                    ...m(),
                    auth: { authenticated: e, csrfToken: a, requires2FA: !1 },
                }),
                e
            );
        } catch (t) {
            return !1;
        }
    })();
    (a
        ? await (async function () {
              (O(), await Ie(!1), R(m().ui.activeSection));
          })()
        : H(),
        (async function () {
            document.getElementById('pushStatusIndicator') &&
                s('#pushStatusIndicator', 'Push no configurado');
        })(),
        window.setInterval(() => {
            Me();
        }, 3e4));
}
const Re = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      Oe().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : Oe()
).catch((t) => {
    throw (console.error('admin-v2 boot failed', t), t);
});
export { Re as default };
