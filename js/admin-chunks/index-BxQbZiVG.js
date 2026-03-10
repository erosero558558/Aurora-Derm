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
        : e.toLocaleDateString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
function i(t) {
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
function o(t) {
    const e = Number(t || 0);
    return Number.isFinite(e) ? Math.round(e).toLocaleString('es-EC') : '0';
}
function s(a, n = 'info') {
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
function r(t, a) {
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
function u(t) {
    const e = t instanceof Date ? t : new Date(t || '');
    return Number.isNaN(e.getTime())
        ? ''
        : `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
const d = new Set(),
    p = {
        auth: {
            authenticated: !1,
            csrfToken: '',
            requires2FA: !1,
            lastAuthAt: 0,
            authMethod: '',
        },
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
        callbacks: {
            filter: 'all',
            sort: 'recent_desc',
            search: '',
            selected: [],
        },
        availability: {
            monthAnchor: new Date(),
            selectedDate: '',
            draft: {},
            draftDirty: !1,
            clipboard: [],
            clipboardDate: '',
            lastAction: '',
        },
        queue: {
            filter: 'all',
            search: '',
            helpOpen: !1,
            oneTap: !1,
            practiceMode: !1,
            customCallKey: null,
            captureCallKeyMode: !1,
            stationMode: 'free',
            stationConsultorio: 1,
            selected: [],
            fallbackPartial: !1,
            syncMode: 'live',
            pendingSensitiveAction: null,
            activity: [],
        },
    };
let m = structuredClone(p);
function b() {
    return m;
}
function g(t) {
    const e = t(m);
    e &&
        ((m = e),
        d.forEach((t) => {
            try {
                t(m);
            } catch (t) {}
        }));
}
const f = {
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
};
let h = '';
async function y(t, e = {}) {
    const a = String(e.method || 'GET').toUpperCase(),
        n = {
            method: a,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== a && h && (n.headers['X-CSRF-Token'] = h),
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
function v(t) {
    h = String(t || '');
}
async function k(t, e = {}) {
    return y(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function w(t, e = {}) {
    return y(`/admin-auth.php?action=${encodeURIComponent(t)}`, e);
}
const S = {
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
function C(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${S[t] || S.menu}</svg>`;
}
function q(t, e, a, n = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${C(a)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
const A = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    },
    M = {
        dashboard: {
            eyebrow: 'Resumen Diario',
            title: 'Que requiere atencion ahora',
            summary:
                'Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.',
            actions: [
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Validar pagos',
                    meta: 'Transferencias pendientes',
                    shortcut: 'Alt+Shift+T',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Llamadas',
                    meta: 'Pendientes por contacto',
                    shortcut: 'Alt+Shift+P',
                },
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar',
                    meta: 'Sincronizar tablero',
                    shortcut: 'Ctrl+K',
                },
            ],
        },
        appointments: {
            eyebrow: 'Agenda Clinica',
            title: 'Triage de citas',
            summary:
                'Prioriza transferencias, no show y proximas 48 horas sin perder lectura.',
            actions: [
                {
                    action: 'clear-appointment-filters',
                    label: 'Limpiar filtros',
                    meta: 'Regresar al corte total',
                    shortcut: 'Reset',
                },
                {
                    action: 'export-csv',
                    label: 'Exportar CSV',
                    meta: 'Bajar corte operativo',
                    shortcut: 'CSV',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cruzar seguimiento telefonico',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        callbacks: {
            eyebrow: 'SLA Telefonico',
            title: 'Siguiente callback',
            summary:
                'Ordena la cola por urgencia, contacto pendiente y siguiente accion real.',
            actions: [
                {
                    action: 'callbacks-triage-next',
                    label: 'Siguiente llamada',
                    meta: 'Mover foco al siguiente caso',
                    shortcut: 'Next',
                },
                {
                    action: 'context-open-callbacks-next',
                    label: 'Abrir siguiente',
                    meta: 'Ir a la tarjeta prioritaria',
                    shortcut: 'Alt+Shift+3',
                },
                {
                    action: 'context-open-appointments-transfer',
                    label: 'Cruzar citas',
                    meta: 'Revisar pagos pendientes',
                    shortcut: 'Alt+Shift+2',
                },
            ],
        },
        reviews: {
            eyebrow: 'Lectura De Calidad',
            title: 'Resenas y senal reciente',
            summary:
                'Resume rating, volumen y comentarios utiles sin convertir feedback en ruido.',
            actions: [
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar',
                    meta: 'Sincronizar resenas',
                    shortcut: 'Sync',
                },
                {
                    action: 'context-open-dashboard',
                    label: 'Volver al dashboard',
                    meta: 'Regresar al resumen diario',
                    shortcut: 'Alt+Shift+1',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ir a callbacks',
                    meta: 'Cerrar seguimiento operativo',
                    shortcut: 'Alt+Shift+3',
                },
            ],
        },
        availability: {
            eyebrow: 'Calendario Editorial',
            title: 'Planeacion de disponibilidad',
            summary:
                'Gestiona slots, duplicados y semanas futuras con el calendario como canvas principal.',
            actions: [
                {
                    action: 'context-availability-today',
                    label: 'Ir a hoy',
                    meta: 'Volver al dia actual',
                    shortcut: 'Today',
                },
                {
                    action: 'context-availability-next',
                    label: 'Siguiente con slots',
                    meta: 'Buscar siguiente dia util',
                    shortcut: 'Next',
                },
                {
                    action: 'context-copy-availability-day',
                    label: 'Copiar dia',
                    meta: 'Duplicar jornada seleccionada',
                    shortcut: 'Copy',
                },
            ],
        },
        queue: {
            eyebrow: 'Fase 2',
            title: 'Turnero sala',
            summary:
                'Esta superficie se mantiene compatible, pero su rediseño completo queda fuera de esta primera ola.',
            actions: [
                {
                    action: 'queue-call-next',
                    label: 'Llamar C1',
                    meta: 'Despachar siguiente ticket',
                    shortcut: 'C1',
                    queueConsultorio: '1',
                },
                {
                    action: 'queue-call-next',
                    label: 'Llamar C2',
                    meta: 'Despachar consultorio 2',
                    shortcut: 'C2',
                    queueConsultorio: '2',
                },
                {
                    action: 'queue-refresh-state',
                    label: 'Refrescar cola',
                    meta: 'Sincronizar estado operativo',
                    shortcut: 'Sync',
                },
            ],
        },
    };
function T() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function $() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function _() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.remove('is-hidden'),
        t.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function L() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.add('is-hidden'),
        t.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function E(t) {
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
    const n = A[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = n);
}
function N(t) {
    const a = e('#group2FA'),
        n = e('#adminLoginStepSummary'),
        i = e('#adminLoginStepEyebrow'),
        o = e('#adminLoginStepTitle'),
        s = e('#adminLoginSupportCopy'),
        r = e('#loginReset2FABtn'),
        c = e('#loginForm');
    a &&
        (a.classList.toggle('is-hidden', !t),
        c?.classList.toggle('is-2fa-stage', Boolean(t)),
        r?.classList.toggle('is-hidden', !t),
        i &&
            (i.textContent = t
                ? 'Verificacion secundaria'
                : 'Ingreso protegido'),
        o &&
            (o.textContent = t
                ? 'Confirma el codigo 2FA'
                : 'Acceso de administrador'),
        n &&
            (n.textContent = t
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        s &&
            (s.textContent = t
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        B(!1));
}
function D({
    tone: t = 'neutral',
    title: a = 'Proteccion activa',
    message: n = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = e('#adminLoginStatusCard'),
        o = e('#adminLoginStatusTitle'),
        s = e('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', t),
        o && (o.textContent = a),
        s && (s.textContent = n));
}
function B(t) {
    const a = e('#loginBtn'),
        n = e('#loginReset2FABtn'),
        i = e('#adminPassword'),
        o = e('#admin2FACode'),
        s = e('#group2FA'),
        r = Boolean(s && !s.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(t) || r),
        o instanceof HTMLInputElement && (o.disabled = Boolean(t) || !r),
        a instanceof HTMLButtonElement &&
            ((a.disabled = Boolean(t)),
            (a.textContent = t
                ? r
                    ? 'Verificando...'
                    : 'Ingresando...'
                : r
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        n instanceof HTMLButtonElement && (n.disabled = Boolean(t)));
}
function x({ clearPassword: t = !1 } = {}) {
    const a = e('#adminPassword'),
        n = e('#admin2FACode');
    (a instanceof HTMLInputElement && t && (a.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function P(t = 'password') {
    const a = e('2fa' === t ? '#admin2FACode' : '#adminPassword');
    a instanceof HTMLInputElement && (a.focus(), a.select?.());
}
function I(a) {
    const n = M[a?.ui?.activeSection || 'dashboard'] || M.dashboard,
        i = a?.auth && 'object' == typeof a.auth ? a.auth : {},
        o = Array.isArray(a?.data?.appointments) ? a.data.appointments : [],
        s = Array.isArray(a?.data?.callbacks) ? a.data.callbacks : [],
        l = Array.isArray(a?.data?.reviews) ? a.data.reviews : [],
        u =
            a?.data?.availability && 'object' == typeof a.data.availability
                ? a.data.availability
                : {},
        d = Array.isArray(a?.data?.queueTickets) ? a.data.queueTickets : [],
        p =
            a?.data?.queueMeta && 'object' == typeof a.data.queueMeta
                ? a.data.queueMeta
                : null;
    (r('#adminSectionEyebrow', n.eyebrow),
        r('#adminContextTitle', n.title),
        r('#adminContextSummary', n.summary),
        c(
            '#adminContextActions',
            n.actions
                .map((e) =>
                    (function (e) {
                        return `\n        <button type="button" class="sony-context-action" ${[`data-action="${t(e.action)}"`, e.queueConsultorio ? `data-queue-consultorio="${t(e.queueConsultorio)}"` : '', e.filterValue ? `data-filter-value="${t(e.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${t(e.label)}</strong>\n                <small>${t(e.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${t(e.shortcut || '')}</span>\n        </button>\n    `;
                    })(e)
                )
                .join('')
        ),
        r(
            '#adminSyncState',
            (function (t) {
                const e = Number(t || 0);
                return e
                    ? `Ultima carga ${new Date(e).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Listo para primera sincronizacion';
            })(a?.ui?.lastRefreshAt || 0)
        ));
    const m = (function (t) {
            return t.filter((t) => {
                const e = String(
                    t.paymentStatus || t.payment_status || ''
                ).toLowerCase();
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(o),
        b = (function (t) {
            return t.filter((t) => {
                const e = String(t.status || '')
                    .toLowerCase()
                    .trim();
                return 'pending' === e || 'pendiente' === e;
            }).length;
        })(s),
        g = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(u),
        f = (function (t, e) {
            return e && Number.isFinite(Number(e.waitingCount))
                ? Math.max(0, Number(e.waitingCount))
                : (Array.isArray(t) ? t : []).filter(
                      (t) => 'waiting' === String(t.status || '').toLowerCase()
                  ).length;
        })(d, p);
    (r('#dashboardBadge', m + b),
        r('#appointmentsBadge', o.length),
        r('#callbacksBadge', b),
        r('#reviewsBadge', l.length),
        r('#availabilityBadge', g),
        r('#queueBadge', f));
    const h = e('#adminSessionTile'),
        y = i.authenticated
            ? 'Sesion activa'
            : i.requires2FA
              ? 'Verificacion 2FA'
              : 'No autenticada',
        v = i.authenticated ? 'success' : i.requires2FA ? 'warning' : 'neutral';
    (h?.setAttribute('data-state', v),
        r('#adminSessionState', y),
        r(
            '#adminSessionMeta',
            (function (t) {
                const e = t && 'object' == typeof t ? t : {};
                if (e.authenticated) {
                    const t =
                            {
                                session: 'sesion restaurada',
                                password: 'clave validada',
                                '2fa': '2FA validado',
                            }[String(e.authMethod || '')] || 'acceso validado',
                        a = Number(e.lastAuthAt || 0);
                    return a
                        ? `Protegida por ${t}. ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${t}.`;
                }
                return e.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(i)
        ));
}
const H = {
    dashboard: {
        hero: '.dashboard-hero-panel',
        priority: '.dashboard-signal-panel',
        workbench: '.dashboard-card-operations',
        detail: '#funnelSummary',
    },
    appointments: {
        hero: '.appointments-command-deck',
        priority: '.appointments-focus-panel',
        workbench: '.appointments-workbench',
    },
    callbacks: {
        hero: '.callbacks-command-deck',
        priority: '#callbacksOpsPanel',
        workbench: '.callbacks-workbench',
        detail: '.callbacks-next-panel',
    },
    reviews: {
        hero: '.reviews-summary-panel',
        detail: '.reviews-spotlight-panel',
        workbench: '#reviewsGrid',
    },
    availability: {
        hero: '.availability-header',
        workbench: '.availability-container',
        detail: '#availabilityDetailGrid',
    },
    queue: {
        hero: '#queueStationControl',
        workbench: '.queue-admin-table',
        detail: '#queueActivityPanel',
    },
};
function F(t, a, n) {
    if (!a) return;
    const i = e(`#${t}`);
    if (!(i instanceof HTMLElement)) return;
    const o = i.querySelector(a);
    o instanceof HTMLElement && o.setAttribute(n, 'true');
}
const O = 'admin-appointments-sort',
    R = 'admin-appointments-density',
    j = 'datetime_desc',
    z = 'comfortable';
function V(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function U(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function K(t) {
    return V(t.paymentStatus || t.payment_status || '');
}
function Q(t) {
    return V(t);
}
function G(t, e = '-') {
    const a = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return a
        ? a
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : e;
}
function W(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[V(t)] || G(t, 'Pendiente')
    );
}
function J(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[V(t)] || G(t, 'Pendiente')
    );
}
function Y(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        a = Math.abs(e);
    return e < 0
        ? a < 60
            ? `Hace ${a} min`
            : a < 1440
              ? `Hace ${Math.round(a / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function Z(t) {
    const e = U(t);
    if (!e) return !1;
    const a = new Date(e),
        n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function X(t) {
    const e = U(t);
    if (!e) return !1;
    const a = e - Date.now();
    return a >= 0 && a <= 1728e5;
}
function tt(t) {
    const e = K(t),
        a = Q(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function et(t, e) {
    const a = V(e);
    return 'pending_transfer' === a
        ? t.filter((t) => {
              const e = K(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === a
          ? t.filter(X)
          : 'no_show' === a
            ? t.filter((t) => 'no_show' === Q(t.status))
            : 'triage_attention' === a
              ? t.filter(tt)
              : t;
}
function at(t) {
    const e = K(t),
        a = Q(t.status),
        n = U(t);
    return 'pending_transfer_review' === e || 'pending_transfer' === e
        ? {
              label: 'Transferencia',
              tone: 'warning',
              note: 'No liberar hasta validar pago.',
          }
        : 'no_show' === a
          ? {
                label: 'No show',
                tone: 'danger',
                note: 'Requiere seguimiento o cierre.',
            }
          : 'cancelled' === a
            ? {
                  label: 'Cancelada',
                  tone: 'danger',
                  note: 'Bloqueo operativo cerrado.',
              }
            : Z(t)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: n ? Y(n) : 'Agenda del dia',
                }
              : X(t)
                ? {
                      label: '48h',
                      tone: 'neutral',
                      note: 'Ventana inmediata de agenda.',
                  }
                : {
                      label: 'Programada',
                      tone: 'neutral',
                      note: 'Sin incidencias abiertas.',
                  };
}
function nt(t) {
    const e = t
            .map((t) => ({ item: t, stamp: U(t) }))
            .sort((t, e) => t.stamp - e.stamp),
        a = e.find(({ item: t }) => {
            const e = K(t);
            return 'pending_transfer_review' === e || 'pending_transfer' === e;
        });
    if (a)
        return {
            item: a.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const n = e.find(({ item: t }) => 'no_show' === Q(t.status));
    if (n)
        return {
            item: n.item,
            label: 'Seguimiento abierto',
            hint: 'Define si se reprograma o se cierra la incidencia.',
            tags: ['No show', 'Seguimiento'],
        };
    const i = e.find(({ stamp: t }) => t >= Date.now());
    return i
        ? {
              item: i.item,
              label: 'Siguiente ingreso',
              hint: 'Deja contexto listo para la siguiente atencion.',
              tags: ['Agenda viva'],
          }
        : {
              item: null,
              label: 'Sin foco activo',
              hint: 'Cuando entre una cita accionable aparecera aqui.',
              tags: [],
          };
}
function it(e) {
    return e.length
        ? e
              .map((e) => {
                  const a = U(e),
                      i = at(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">\n                        <div class="appointment-service">\n                            <strong>${t(G(e.service, 'Servicio pendiente'))}</strong>\n                            <span>Especialista: ${t(G(e.doctor, 'Sin asignar'))}</span>\n                            <small>${t(i.label)} | ${t(i.note)}</small>\n                        </div>\n                    </td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(n(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(Y(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      e
                  ) {
                      const a = e.paymentStatus || e.payment_status || '',
                          n = String(
                              e.transferProofUrl ||
                                  e.transferProofURL ||
                                  e.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${t(
                          (function (t) {
                              const e = V(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${t(W(a))}</span>\n            <small>Metodo: ${t(((i = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[V(i)] || G(i, 'Metodo pendiente')))}</small>\n            ${n ? `<a href="${t(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const a = Q(e.status),
                          n = K(e),
                          i = at(e),
                          o = [];
                      return (
                          'pending_transfer_review' === n &&
                              o.push('Transferencia por validar'),
                          'no_show' === a && o.push('Paciente ausente'),
                          'cancelled' === a && o.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${t(
                              (function (t) {
                                  const e = V(t);
                                  return 'completed' === e
                                      ? 'success'
                                      : 'cancelled' === e || 'no_show' === e
                                        ? 'danger'
                                        : 'pending' === e
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${t(J(a))}</span>\n            <small>${t(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const a = Number(e.id || 0),
                          n = K(e),
                          i = (function (t) {
                              const e = String(t || '').replace(/\D+/g, '');
                              return e ? `https://wa.me/${e}` : '';
                          })(e.phone || ''),
                          o = [];
                      return (
                          i &&
                              o.push(
                                  `<a href="${t(i)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${t(e.name || 'Paciente')}" title="WhatsApp para seguimiento">WhatsApp</a>`
                              ),
                          ('pending_transfer_review' !== n &&
                              'pending_transfer' !== n) ||
                              (o.push(
                                  `<button type="button" data-action="approve-transfer" data-id="${a}">Aprobar</button>`
                              ),
                              o.push(
                                  `<button type="button" data-action="reject-transfer" data-id="${a}">Rechazar</button>`
                              )),
                          o.push(
                              `<button type="button" data-action="mark-no-show" data-id="${a}">No show</button>`
                          ),
                          o.push(
                              `<button type="button" data-action="cancel-appointment" data-id="${a}">Cancelar</button>`
                          ),
                          `<div class="table-actions">${o.join('')}</div>`
                      );
                  })(e)}</td>\n                </tr>\n            `;
              })
              .join('')
        : `<tr class="table-empty-row"><td colspan="6">${t('No hay citas para el filtro actual.')}</td></tr>`;
}
function ot() {
    const e = b(),
        a = Array.isArray(e?.data?.appointments) ? e.data.appointments : [],
        i = e?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (t, e) {
            const a = V(e),
                n = [...t];
            return 'patient_az' === a
                ? (n.sort((t, e) => V(t.name).localeCompare(V(e.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort((t, e) => U(t) - U(e)), n)
                  : (n.sort((t, e) => U(e) - U(t)), n);
        })(
            (function (t, e) {
                const a = V(e);
                return a
                    ? t.filter((t) =>
                          [
                              t.name,
                              t.email,
                              t.phone,
                              t.service,
                              t.doctor,
                              t.paymentStatus,
                              t.payment_status,
                              t.status,
                          ].some((t) => V(t).includes(a))
                      )
                    : t;
            })(et(a, i.filter), i.search),
            i.sort
        );
    (c('#appointmentsTableBody', it(o)),
        (function (t, e, a) {
            (r('#appointmentsToolbarMeta', `Mostrando ${e} de ${a}`),
                r(
                    '#appointmentsToolbarState',
                    (function (t, e) {
                        const a = [];
                        if ('all' !== V(t.filter)) {
                            const e = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            a.push(e[V(t.filter)] || t.filter);
                        }
                        return (
                            V(t.search) && a.push(`Busqueda: ${t.search}`),
                            'patient_az' === V(t.sort)
                                ? a.push('Paciente (A-Z)')
                                : 'datetime_asc' === V(t.sort)
                                  ? a.push('Fecha ascendente')
                                  : a.push('Fecha reciente'),
                            0 === e && a.push('Resultados: 0'),
                            a
                        );
                    })(t, e).join(' | ')
                ));
            const n = document.getElementById('clearAppointmentsFiltersBtn');
            if (n) {
                const e = 'all' !== V(t.filter) || '' !== V(t.search);
                n.classList.toggle('is-hidden', !e);
            }
            const i = document.getElementById('appointmentFilter');
            i instanceof HTMLSelectElement && (i.value = t.filter);
            const o = document.getElementById('appointmentSort');
            o instanceof HTMLSelectElement && (o.value = t.sort);
            const s = document.getElementById('searchAppointments');
            s instanceof HTMLInputElement &&
                s.value !== t.search &&
                (s.value = t.search);
            const c = document.getElementById('appointments');
            (c &&
                c.classList.toggle(
                    'appointments-density-compact',
                    'compact' === V(t.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((e) => {
                        const a = V(e.dataset.density) === V(t.density);
                        e.classList.toggle('is-active', a);
                    }),
                (function (t) {
                    const e = V(t);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const a = V(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', a);
                        });
                })(t.filter),
                (function (t) {
                    try {
                        (localStorage.setItem(O, JSON.stringify(t.sort)),
                            localStorage.setItem(R, JSON.stringify(t.density)));
                    } catch (t) {}
                })(t));
        })(i, o.length, a.length),
        (function (e, a, i) {
            (r('#appointmentsOpsPendingTransfer', e.pendingTransferCount),
                r(
                    '#appointmentsOpsPendingTransferMeta',
                    e.pendingTransferCount > 0
                        ? `${e.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                r('#appointmentsOpsUpcomingCount', e.upcomingCount),
                r(
                    '#appointmentsOpsUpcomingMeta',
                    e.upcomingCount > 0
                        ? `${e.upcomingCount} cita(s) dentro de 48h`
                        : 'Sin presion inmediata'
                ),
                r('#appointmentsOpsNoShowCount', e.noShowCount),
                r(
                    '#appointmentsOpsNoShowMeta',
                    e.noShowCount > 0
                        ? `${e.noShowCount} caso(s) con seguimiento`
                        : 'Sin incidencias'
                ),
                r('#appointmentsOpsTodayCount', e.todayCount),
                r(
                    '#appointmentsOpsTodayMeta',
                    e.todayCount > 0
                        ? `${e.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ),
                r(
                    '#appointmentsDeckSummary',
                    i > 0
                        ? `${e.pendingTransferCount} transferencia(s), ${e.triageCount} frente(s) accionables y ${a} cita(s) visibles.`
                        : 'Sin citas cargadas.'
                ),
                r(
                    '#appointmentsWorkbenchHint',
                    e.pendingTransferCount > 0
                        ? 'Primero valida pagos; luego ordena la mesa por fecha o paciente.'
                        : e.triageCount > 0
                          ? 'La agenda tiene incidencias abiertas dentro de esta misma mesa.'
                          : 'Filtros, orden y tabla en un workbench unico.'
                ));
            const o = document.getElementById('appointmentsDeckChip');
            if (o) {
                const t =
                    e.pendingTransferCount > 0 || e.noShowCount > 0
                        ? 'warning'
                        : 'success';
                ((o.textContent =
                    'warning' === t ? 'Atencion operativa' : 'Agenda estable'),
                    o.setAttribute('data-state', t));
            }
            const s = e.focus;
            if ((r('#appointmentsFocusLabel', s.label), !s.item))
                return (
                    r('#appointmentsFocusPatient', 'Sin citas activas'),
                    r(
                        '#appointmentsFocusMeta',
                        'Cuando entren citas accionables apareceran aqui.'
                    ),
                    r('#appointmentsFocusWindow', '-'),
                    r('#appointmentsFocusPayment', '-'),
                    r('#appointmentsFocusStatus', '-'),
                    r('#appointmentsFocusContact', '-'),
                    c('#appointmentsFocusTags', ''),
                    void r('#appointmentsFocusHint', s.hint)
                );
            const l = s.item;
            (r('#appointmentsFocusPatient', l.name || 'Sin nombre'),
                r(
                    '#appointmentsFocusMeta',
                    `${G(l.service, 'Servicio pendiente')} | ${n(l.date)} ${l.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', Y(U(l))),
                r(
                    '#appointmentsFocusPayment',
                    W(l.paymentStatus || l.payment_status)
                ),
                r('#appointmentsFocusStatus', J(l.status)),
                r('#appointmentsFocusContact', l.phone || 'Sin telefono'),
                c(
                    '#appointmentsFocusTags',
                    s.tags
                        .map(
                            (e) =>
                                `<span class="appointments-focus-tag">${t(e)}</span>`
                        )
                        .join('')
                ),
                r('#appointmentsFocusHint', s.hint));
        })(
            (function (t) {
                const e = et(t, 'pending_transfer'),
                    a = et(t, 'upcoming_48h'),
                    n = et(t, 'no_show'),
                    i = et(t, 'triage_attention'),
                    o = t.filter(Z);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: a.length,
                    noShowCount: n.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: nt(t),
                };
            })(a),
            o.length,
            a.length
        ));
}
function st(t) {
    (g((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), ot());
}
function rt(t) {
    st({ filter: V(t) || 'all' });
}
function ct(t) {
    st({ search: String(t || '') });
}
function lt(t, e) {
    const a = Number(t || 0);
    (g((t) => ({
        ...t,
        data: {
            ...t.data,
            appointments: (t.data.appointments || []).map((t) =>
                Number(t.id || 0) === a ? { ...t, ...e } : t
            ),
        },
    })),
        ot());
}
async function ut(t, e) {
    await k('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
const dt = 'admin-callbacks-sort',
    pt = 'admin-callbacks-filter',
    mt = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    bt = new Set(['recent_desc', 'waiting_desc']);
function gt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ft(t) {
    const e = gt(t);
    return mt.has(e) ? e : 'all';
}
function ht(t) {
    const e = gt(t);
    return bt.has(e) ? e : 'recent_desc';
}
function yt(t) {
    const e = gt(t);
    return 'contacted' === e ||
        'contactado' === e ||
        'completed' === e ||
        'done' === e ||
        'resolved' === e ||
        'called' === e ||
        'atendido' === e
        ? 'contacted'
        : 'pending';
}
function vt(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function kt(t) {
    const e = vt(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function wt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function St(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const a = new Date();
    return (
        e.getFullYear() === a.getFullYear() &&
        e.getMonth() === a.getMonth() &&
        e.getDate() === a.getDate()
    );
}
function Ct(t) {
    return t >= 120
        ? { label: 'Critico SLA', tone: 'danger', note: 'Escala inmediata' }
        : t >= 45
          ? {
                label: 'En ventana',
                tone: 'warning',
                note: 'Conviene atender pronto',
            }
          : {
                label: 'Reciente',
                tone: 'neutral',
                note: 'Todavia dentro de margen',
            };
}
function qt(t) {
    return t < 60 ? `${t} min` : `${Math.round(t / 60)} h`;
}
function At(t) {
    try {
        (localStorage.setItem(pt, JSON.stringify(ft(t.filter))),
            localStorage.setItem(dt, JSON.stringify(ht(t.sort))));
    } catch (t) {}
}
function Mt() {
    const e = b(),
        a = Array.isArray(e?.data?.callbacks) ? e.data.callbacks : [],
        n = (function (t, e) {
            const a = gt(e);
            return a
                ? t.filter((t) =>
                      [t.telefono, t.phone, t.preferencia, t.status].some((t) =>
                          gt(t).includes(a)
                      )
                  )
                : t;
        })(
            (function (t, e) {
                const a = ft(e);
                return 'pending' === a || 'contacted' === a
                    ? t.filter((t) => yt(t.status) === a)
                    : 'today' === a
                      ? t.filter((t) => St(t.fecha || t.createdAt))
                      : 'sla_urgent' === a
                        ? t.filter(
                              (t) => 'pending' === yt(t.status) && kt(t) >= 120
                          )
                        : t;
            })(a, e.callbacks.filter),
            e.callbacks.search
        ),
        o = (function (t, e) {
            const a = [...t];
            return 'waiting_desc' === ht(e)
                ? (a.sort((t, e) => vt(t) - vt(e)), a)
                : (a.sort((t, e) => vt(e) - vt(t)), a);
        })(n, e.callbacks.sort),
        s = new Set((e.callbacks.selected || []).map((t) => Number(t || 0)));
    (c(
        '#callbacksGrid',
        o.length
            ? o
                  .map((e, a) =>
                      (function (
                          e,
                          { selected: a = !1, position: n = null } = {}
                      ) {
                          const o = yt(e.status),
                              s =
                                  'pending' === o
                                      ? 'callback-card pendiente'
                                      : 'callback-card contactado',
                              r = 'pending' === o ? 'pendiente' : 'contactado',
                              c = Number(e.id || 0),
                              l = wt(e),
                              u = kt(e),
                              d = Ct(u),
                              p = e.preferencia || 'Sin preferencia',
                              m =
                                  'pending' === o
                                      ? 1 === n
                                          ? 'Siguiente contacto recomendado'
                                          : 'Caso pendiente en cola'
                                      : 'Caso ya resuelto';
                          return `\n        <article class="${s}${a ? ' is-selected' : ''}" data-callback-id="${c}" data-callback-status="${r}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${t('pending' === o ? d.tone : 'success')}">${t('pending' === o ? 'Pendiente' : 'Contactado')}</span>\n                    <h4>${t(l)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${t('pending' === o ? d.tone : 'success')}">${t('pending' === o ? d.label : 'Cerrado')}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${t(p)}</strong></p>\n                <p><span>Fecha</span><strong>${t(i(e.fecha || e.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${t(qt(u))}</strong></p>\n                <p><span>Lectura</span><strong>${t(m)}</strong></p>\n            </div>\n            <p class="callback-card-note">${t('pending' === o ? d.note : 'Registro ya marcado como contactado.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${c}" data-callback-date="${t(e.fecha || '')}" ${'pending' !== o ? 'disabled' : ''}>${'pending' === o ? 'Marcar contactado' : 'Contactado'}</button>\n            </div>\n        </article>\n    `;
                      })(e, {
                          selected: s.has(Number(e.id || 0)),
                          position: a + 1,
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    ),
        r('#callbacksToolbarMeta', `Mostrando ${o.length} de ${a.length}`));
    const l = [];
    ('all' !== ft(e.callbacks.filter) &&
        l.push(
            'pending' === ft(e.callbacks.filter)
                ? 'Pendientes'
                : 'contacted' === ft(e.callbacks.filter)
                  ? 'Contactados'
                  : 'today' === ft(e.callbacks.filter)
                    ? 'Hoy'
                    : 'Urgentes SLA'
        ),
        gt(e.callbacks.search) && l.push(`Busqueda: ${e.callbacks.search}`),
        'waiting_desc' === ht(e.callbacks.sort)
            ? l.push('Orden: Mayor espera (SLA)')
            : l.push('Orden: Mas recientes'),
        r('#callbacksToolbarState', l.join(' | ')));
    const u = document.getElementById('callbackFilter');
    u instanceof HTMLSelectElement && (u.value = ft(e.callbacks.filter));
    const d = document.getElementById('callbackSort');
    d instanceof HTMLSelectElement && (d.value = ht(e.callbacks.sort));
    const p = document.getElementById('searchCallbacks');
    (p instanceof HTMLInputElement &&
        p.value !== e.callbacks.search &&
        (p.value = e.callbacks.search),
        (function (t) {
            const e = gt(t);
            document
                .querySelectorAll(
                    '.callback-quick-filter-btn[data-filter-value]'
                )
                .forEach((t) => {
                    const a = gt(t.dataset.filterValue) === e;
                    t.classList.toggle('is-active', a);
                });
        })(e.callbacks.filter));
    const m = (function (t) {
        const e = t.filter((t) => 'pending' === yt(t.status)),
            a = e.filter((t) => kt(t) >= 120),
            n = e.slice().sort((t, e) => vt(t) - vt(e))[0];
        return {
            pendingCount: e.length,
            urgentCount: a.length,
            todayCount: t.filter((t) => St(t.fecha || t.createdAt)).length,
            next: n,
            queueHealth:
                a.length > 0
                    ? 'Cola: prioridad alta'
                    : e.length > 0
                      ? 'Cola: atencion requerida'
                      : 'Cola: estable',
            queueState:
                a.length > 0 ? 'danger' : e.length > 0 ? 'warning' : 'success',
        };
    })(a);
    (r('#callbacksOpsPendingCount', m.pendingCount),
        r('#callbacksOpsUrgentCount', m.urgentCount),
        r('#callbacksOpsTodayCount', m.todayCount),
        r('#callbacksOpsQueueHealth', m.queueHealth));
    const g = document.getElementById('callbacksBulkSelectVisibleBtn');
    g instanceof HTMLButtonElement && (g.disabled = 0 === o.length);
    const f = document.getElementById('callbacksBulkClearBtn');
    f instanceof HTMLButtonElement && (f.disabled = 0 === s.size);
    const h = document.getElementById('callbacksBulkMarkBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === s.size),
        (function (t, e, a, n) {
            (r(
                '#callbacksDeckSummary',
                a > 0
                    ? `${t.pendingCount} pendiente(s), ${t.urgentCount} fuera de SLA y ${e} visibles.`
                    : 'Sin callbacks pendientes.'
            ),
                r(
                    '#callbacksDeckHint',
                    t.urgentCount > 0
                        ? 'Escala primero los casos criticos.'
                        : t.pendingCount > 0
                          ? 'La cola se puede drenar en esta misma vista.'
                          : 'Sin bloqueos'
                ));
            const i = document.getElementById('callbacksQueueChip');
            i &&
                ((i.textContent =
                    'danger' === t.queueState
                        ? 'SLA comprometido'
                        : 'warning' === t.queueState
                          ? 'Cola activa'
                          : 'Cola estable'),
                i.setAttribute('data-state', t.queueState));
            const o = document.getElementById('callbacksOpsQueueHealth');
            o && o.setAttribute('data-state', t.queueState);
            const s = t.next;
            (r('#callbacksOpsNext', s ? wt(s) : 'Sin telefono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${wt(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                r('#callbacksNextWait', s ? qt(kt(s)) : '0 min'),
                r('#callbacksNextPreference', (s && s.preferencia) || '-'),
                r('#callbacksNextState', s ? Ct(kt(s)).label : 'Pendiente'));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === n),
                r('#callbacksSelectedCount', n));
        })(m, o.length, a.length, s.size),
        At(b().callbacks));
}
function Tt(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e && At(b().callbacks),
        Mt());
}
function $t(t) {
    Tt({ filter: ft(t), selected: [] });
}
async function _t(t, e = '') {
    const a = Number(t || 0);
    a <= 0 ||
        (await k('callbacks', {
            method: 'PATCH',
            body: { id: a, status: 'contacted', fecha: e },
        }),
        (function (t) {
            const e = Number(t || 0);
            (g((t) => ({
                ...t,
                data: {
                    ...t.data,
                    callbacks: (t.data.callbacks || []).map((t) =>
                        Number(t.id || 0) === e
                            ? { ...t, status: 'contacted' }
                            : t
                    ),
                },
                callbacks: {
                    ...t.callbacks,
                    selected: (t.callbacks.selected || []).filter(
                        (t) => Number(t || 0) !== e
                    ),
                },
            })),
                Mt());
        })(a));
}
const Lt = 'admin-availability-selected-date',
    Et = 'admin-availability-month-anchor';
function Nt(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function Dt(t) {
    return [...new Set(t.map(Nt).filter(Boolean))].sort();
}
function Bt(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? '' : u(a) === e ? e : '';
}
function xt(t) {
    const e = Bt(t);
    if (!e) return null;
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Pt(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((a) => {
                const n = Bt(a);
                if (!n) return;
                const i = Dt(Array.isArray(t[a]) ? t[a] : []);
                i.length && (e[n] = i);
            }),
        e
    );
}
function It(t) {
    return Pt(t || {});
}
function Ht(t) {
    return JSON.stringify(Pt(t || {}));
}
function Ft(t, e = '') {
    let a = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) a = new Date(t);
    else {
        const e = Bt(t);
        e && (a = new Date(`${e}T12:00:00`));
    }
    if (!a) {
        const t = xt(e);
        a = t ? new Date(t) : new Date();
    }
    return (a.setDate(1), a.setHours(12, 0, 0, 0), a);
}
function Ot(t, e) {
    const a = Bt(t);
    if (a) return a;
    const n = Object.keys(e || {})[0];
    if (n) {
        const t = Bt(n);
        if (t) return t;
    }
    return u(new Date());
}
function Rt() {
    const t = b(),
        e = Bt(t.availability.selectedDate),
        a = Ft(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(Lt, e) : localStorage.removeItem(Lt),
            localStorage.setItem(Et, u(a)));
    } catch (t) {}
}
function jt(t) {
    const e = It(b().data.availability || {});
    return Ht(t) !== Ht(e);
}
function zt() {
    return It(b().availability.draft || {});
}
function Vt() {
    const t = b().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function Ut() {
    const t = b(),
        e = Bt(t.availability.selectedDate);
    if (e) return e;
    const a = It(t.availability.draft || {});
    return Object.keys(a)[0] || u(new Date());
}
function Kt(t, e) {
    return t.length
        ? 1 === t.length
            ? '1 slot publicado. ' +
              (e
                  ? 'Lectura desde Google Calendar.'
                  : 'Puedes duplicarlo o ampliarlo.')
            : `${t.length} slots en el dia. ${e ? 'Referencia en solo lectura.' : 'Listo para copiar o limpiar.'}`
        : e
          ? 'No hay slots publicados en este dia.'
          : 'Agrega slots o copia una jornada existente.';
}
function Qt(t = 1) {
    const e = zt(),
        a = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!a.length) return '';
    const n = Bt(b().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? a.sort() : a.sort().reverse()).find((e) =>
            t >= 0 ? e >= n : e <= n
        ) || ''
    );
}
function Gt() {
    ((function () {
        const t = b(),
            e = Ft(t.availability.monthAnchor, t.availability.selectedDate),
            a = Ut(),
            n = e.getMonth(),
            i = It(t.availability.draft),
            o = u(new Date());
        var s;
        r(
            '#calendarMonth',
            ((s = e),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(s))
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
                    const e = u(t),
                        s = Array.isArray(i[e]) ? i[e] : [],
                        r = s.length > 0,
                        c = t.getMonth() === n;
                    return `\n                <button type="button" class="${['calendar-day', c ? '' : 'other-month', r ? 'has-slots' : '', e === a ? 'is-selected' : '', e === o ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${e}">\n                    <span>${t.getDate()}</span>\n                    <small>${r ? `${s.length} slot${1 === s.length ? '' : 's'}` : c ? 'Sin slots' : ''}</small>\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const { selectedDate: e, slots: a } = (function () {
                    const t = b(),
                        e = Ut();
                    return {
                        selectedDate: e,
                        slots: Dt(It(t.availability.draft)[e] || []),
                    };
                })(),
                n = Vt();
            (r('#selectedDate', e || '-'),
                a.length
                    ? c(
                          '#timeSlotsList',
                          a
                              .map(
                                  (a) =>
                                      `\n            <div class="time-slot-item">\n                <div>\n                    <strong>${t(a)}</strong>\n                    <small>${t(n ? 'Slot publicado' : 'Disponible para consulta')}</small>\n                </div>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(e)}" data-time="${encodeURIComponent(a)}" ${n ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : c(
                          '#timeSlotsList',
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${t(Kt([], n))}</p>`
                      ));
        })(),
        (function () {
            const t = b(),
                a = Ut(),
                n = It(t.availability.draft),
                i = Array.isArray(n[a]) ? Dt(n[a]) : [],
                o = Vt(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: l,
                } = (function () {
                    const t = b().data.availabilityMeta || {},
                        e = Vt();
                    return {
                        sourceText: e ? 'Google Calendar' : 'Local',
                        modeText: e ? 'Solo lectura' : 'Editable',
                        timezone: String(
                            t.timezone ||
                                Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone ||
                                '-'
                        ),
                    };
                })();
            (r(
                '#availabilityHeading',
                o
                    ? 'Calendario de disponibilidad - Solo lectura'
                    : 'Calendario de disponibilidad'
            ),
                r('#availabilitySourceBadge', `Fuente: ${s}`),
                r('#availabilityModeBadge', `Modo: ${c}`),
                r('#availabilityTimezoneBadge', `TZ: ${l}`),
                r(
                    '#availabilitySelectionSummary',
                    `Fecha: ${a} | ${(function (t) {
                        const e = xt(t);
                        return e
                            ? new Intl.DateTimeFormat('es-EC', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                              }).format(e)
                            : t || '-';
                    })(a)} | Fuente: ${s} | Modo: ${c} | Slots: ${i.length}`
                ),
                r(
                    '#availabilityDraftStatus',
                    t.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                r(
                    '#availabilitySyncStatus',
                    o ? `Google Calendar | ${l}` : `Store local | ${l}`
                ));
            const u = e('#addSlotForm'),
                d = e('#availabilityQuickSlotPresets');
            (u && u.classList.toggle('is-hidden', o),
                d && d.classList.toggle('is-hidden', o));
            const p = e('#newSlotTime');
            p instanceof HTMLInputElement && (p.disabled = o);
            const m = e('[data-action="add-time-slot"]');
            m instanceof HTMLButtonElement && (m.disabled = o);
            const g = Array.isArray(t.availability.clipboard)
                ? t.availability.clipboard.length
                : 0;
            let f = Kt(i, o);
            (o
                ? (f = 'Edicion bloqueada por proveedor Google')
                : t.availability.lastAction
                  ? (f = String(t.availability.lastAction))
                  : g && (f = `Portapapeles: ${g} slots`),
                r('#availabilityDayActionsStatus', f),
                document
                    .querySelectorAll(
                        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                    )
                    .forEach((e) => {
                        e instanceof HTMLButtonElement &&
                            ('availabilityDiscardDraftBtn' !== e.id &&
                            'availabilitySaveDraftBtn' !== e.id
                                ? 'paste-availability-day' !==
                                  String(e.dataset.action || '')
                                    ? (e.disabled = o)
                                    : (e.disabled = o || 0 === g)
                                : (e.disabled =
                                      o || !t.availability.draftDirty));
                    }));
        })(),
        Rt());
}
function Wt(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? Gt() : Rt());
}
function Jt(t, e = {}) {
    const a = It(t),
        n = Ot(e.selectedDate || b().availability.selectedDate, a);
    Wt(
        {
            draft: a,
            selectedDate: n,
            monthAnchor: Ft(e.monthAnchor || b().availability.monthAnchor, n),
            draftDirty: jt(a),
            ...e,
        },
        { render: !0 }
    );
}
function Yt(t) {
    Wt({ lastAction: String(t || '') }, { render: !0 });
}
function Zt(t, e, a = '') {
    const n = Bt(t) || Ut();
    if (!n) return;
    const i = zt(),
        o = Dt(Array.isArray(e) ? e : []);
    (o.length ? (i[n] = o) : delete i[n],
        Jt(i, { selectedDate: n, monthAnchor: n, lastAction: a }));
}
function Xt(t, e) {
    const a = Bt(t);
    a &&
        Wt(
            { selectedDate: a, monthAnchor: Ft(a, a), lastAction: e || '' },
            { render: !0 }
        );
}
function te() {
    return Boolean(b().availability.draftDirty);
}
function ee(t) {
    if (Vt()) return;
    const e = b(),
        a = Bt(e.availability.selectedDate) || Ut(),
        n = Array.isArray(e.availability.draft[a])
            ? e.availability.draft[a]
            : [],
        i = xt(a);
    if (!i) return;
    i.setDate(i.getDate() + Number(t || 0));
    const o = u(i);
    Zt(o, n, `Duplicado ${n.length} slots en ${o}`);
}
function ae(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ne(t) {
    const e = ae(t);
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
function ie(t) {
    const e = ae(t);
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
function oe(t) {
    return Array.isArray(t) ? t : [];
}
function se(t, e = 0) {
    const a = Number(t);
    return Number.isFinite(a) ? a : e;
}
function re(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function ce(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
function le(t, e = 0) {
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
        status: ne(t?.status || 'waiting'),
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
function ue(t, e = 0, a = {}) {
    const n = t && 'object' == typeof t ? t : {},
        i = le({ ...n, ...a }, e);
    return (
        ce(n.createdAt, n.created_at) || (i.createdAt = ''),
        ce(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        ce(n.queueType, n.queue_type) || (i.queueType = ''),
        ce(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function de(t) {
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
function pe(t, e = []) {
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
        o = oe(a.callingNow).concat(oe(a.calling_now)),
        s = oe(e).map((t, e) => le(t, e)),
        r =
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
        c =
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
        l = r ? ue(r, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        u = c ? ue(c, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = oe(a.nextTickets)
            .concat(oe(a.next_tickets))
            .map((t, e) =>
                ue(
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
        b = Math.max(Number(Boolean(l)) + Number(Boolean(u)), m),
        g = se(
            a.waitingCount ?? a.waiting_count ?? n.waiting ?? d.length ?? p,
            0
        ),
        f = se(a.calledCount ?? a.called_count ?? n.called ?? b, 0),
        h = se(
            n.completed ??
                a.completedCount ??
                a.completed_count ??
                s.filter((t) => 'completed' === t.status).length,
            0
        ),
        y = se(
            n.no_show ??
                n.noShow ??
                a.noShowCount ??
                a.no_show_count ??
                s.filter((t) => 'no_show' === t.status).length,
            0
        ),
        v = se(
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
        waitingCount: g,
        calledCount: f,
        counts: {
            waiting: g,
            called: f,
            completed: h,
            no_show: y,
            cancelled: v,
        },
        callingNowByConsultorio: { 1: l, 2: u },
        nextTickets: d,
    };
}
function me(t) {
    const e = le(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${ae(e.ticketCode || '')}`;
}
function be(t) {
    const e = pe(t),
        a = new Map(),
        n = (t) => {
            if (!t) return;
            const e = le(t, a.size);
            (ce(t?.createdAt, t?.created_at) || (e.createdAt = ''),
                ce(t?.priorityClass, t?.priority_class) ||
                    (e.priorityClass = ''),
                ce(t?.queueType, t?.queue_type) || (e.queueType = ''),
                a.set(me(e), e));
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
    for (const t of oe(e.nextTickets))
        n({ ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function ge(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function fe(t, e = '') {
    try {
        const a = localStorage.getItem(t);
        return null === a ? e : a;
    } catch (t) {
        return e;
    }
}
function he(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function ye(t, e) {
    try {
        const a = localStorage.getItem(t);
        return a ? JSON.parse(a) : e;
    } catch (t) {
        return e;
    }
}
function ve(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function ke(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const we = 'queueStationMode',
    Se = 'queueStationConsultorio',
    Ce = 'queueOneTapAdvance',
    qe = 'queueCallKeyBindingV1',
    Ae = 'queueNumpadHelpOpen',
    Me = 'queueAdminLastSnapshot',
    Te = new Map([
        [1, !1],
        [2, !1],
    ]),
    $e = new Set(['no_show', 'cancelar']);
function _e(t) {
    (he(we, t.queue.stationMode || 'free'),
        he(Se, t.queue.stationConsultorio || 1),
        he(Ce, t.queue.oneTap ? '1' : '0'),
        he(Ae, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? ve(qe, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(qe),
        ve(Me, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Le() {
    const t = b(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => le(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? pe(t.data.queueMeta, e)
                : de(e),
    };
}
function Ee() {
    const t = b(),
        { queueTickets: e } = Le();
    return (function (t, e) {
        const a = ae(e);
        return a
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => ae(t).includes(a)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const a = ae(e);
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
                                        (Date.now() - re(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === ae(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function Ne(t, e = null) {
    const a = Array.isArray(e) ? e : Le().queueTickets,
        n = new Set(a.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(oe(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && n.has(t))
        .sort((t, e) => t - e);
}
function De() {
    return Ne(b().queue.selected || []);
}
function Be() {
    const t = (function () {
        const t = new Set(De());
        return t.size
            ? Le().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : Ee();
}
function xe(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        Le().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Pe() {
    const t = b(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        Le().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
let Ie = '';
function He(e) {
    const a = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - re(e.createdAt)) / 6e4)),
        i = Number(e.id || 0),
        o = new Set(De()).has(i),
        s = 'called' === e.status,
        r = s && e.assignedConsultorio,
        c = s;
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                <label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${i}" ${o ? 'checked' : ''} />\n                </label>\n            </td>\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (ne(t)) {
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
    )}</td>\n            <td>${a}</td>\n            <td>${n} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function Fe(t) {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        a = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (a && (a.textContent = `Confirmar accion sensible: ${t.action}`),
        g((e) => ({ ...e, queue: { ...e.queue, pendingSensitiveAction: t } })),
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
function Oe() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function Re() {
    const e = b().queue.activity || [];
    c(
        '#queueActivityList',
        e.length
            ? e
                  .map(
                      (e) =>
                          `<li><span>${t(i(e.at))}</span><strong>${t(e.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function je(e = () => {}) {
    const a = b(),
        { queueMeta: n } = Le(),
        i = Ee(),
        o = De().length,
        s = Be(),
        l = oe(n.nextTickets),
        u = Number(n.waitingCount || n.counts?.waiting || 0);
    (!(function (t, e) {
        const a = b(),
            n =
                t.callingNowByConsultorio?.[1] ||
                t.callingNowByConsultorio?.[1] ||
                null,
            i =
                t.callingNowByConsultorio?.[2] ||
                t.callingNowByConsultorio?.[2] ||
                null,
            o = n
                ? String(n.ticketCode || n.ticket_code || 'A-000')
                : 'Sin llamado',
            s = i
                ? String(i.ticketCode || i.ticket_code || 'A-000')
                : 'Sin llamado';
        (r(
            '#queueWaitingCountAdmin',
            Number(t.waitingCount || t.counts?.waiting || 0)
        ),
            r(
                '#queueCalledCountAdmin',
                Number(t.calledCount || t.counts?.called || 0)
            ),
            r('#queueC1Now', o),
            r('#queueC2Now', s));
        const c = document.getElementById('queueReleaseC1');
        c instanceof HTMLButtonElement &&
            ((c.hidden = !n),
            (c.textContent = n ? `Liberar C1 · ${o}` : 'Release C1'),
            n
                ? c.setAttribute('data-queue-id', String(Number(n.id || 0)))
                : c.removeAttribute('data-queue-id'));
        const l = document.getElementById('queueReleaseC2');
        l instanceof HTMLButtonElement &&
            ((l.hidden = !i),
            (l.textContent = i ? `Liberar C2 · ${s}` : 'Release C2'),
            i
                ? l.setAttribute('data-queue-id', String(Number(i.id || 0)))
                : l.removeAttribute('data-queue-id'));
        const u = document.getElementById('queueSyncStatus');
        if ('fallback' === ae(a.queue.syncMode))
            return (
                r('#queueSyncStatus', 'fallback'),
                void (u && u.setAttribute('data-state', 'fallback'))
            );
        const d = String(t.updatedAt || '').trim();
        if (!d) return;
        const p = Math.max(0, Math.round((Date.now() - re(d)) / 1e3)),
            m = p >= 60;
        if (
            (r('#queueSyncStatus', m ? `Watchdog (${p}s)` : 'vivo'),
            u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
            m)
        ) {
            const t = `stale-${Math.floor(p / 15)}`;
            return void (
                t !== Ie &&
                ((Ie = t), e('Watchdog de cola: realtime en reconnecting'))
            );
        }
        Ie = 'live';
    })(n, e),
        c(
            '#queueTableBody',
            i.length
                ? i.map(He).join('')
                : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
        ));
    const d =
        a.queue.fallbackPartial && l.length && u > l.length
            ? `<li><span>-</span><strong>Mostrando primeros ${l.length} de ${u} en espera</strong></li>`
            : '';
    c(
        '#queueNextAdminList',
        l.length
            ? `${d}${l.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
    const p = i.filter(
            (t) =>
                'waiting' === t.status &&
                (Math.max(
                    0,
                    Math.round((Date.now() - re(t.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === ae(t.priorityClass))
        ).length,
        m = [p > 0 ? `riesgo: ${p}` : 'sin riesgo'];
    (o > 0 && m.push(`seleccion: ${o}`),
        a.queue.fallbackPartial && m.push('fallback parcial'),
        r('#queueTriageSummary', m.join(' | ')),
        r('#queueSelectedCount', o));
    const g = document.getElementById('queueSelectionChip');
    g instanceof HTMLElement && g.classList.toggle('is-hidden', 0 === o);
    const f = document.getElementById('queueSelectVisibleBtn');
    f instanceof HTMLButtonElement && (f.disabled = 0 === i.length);
    const h = document.getElementById('queueClearSelectionBtn');
    (h instanceof HTMLButtonElement && (h.disabled = 0 === o),
        document
            .querySelectorAll(
                '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
            )
            .forEach((t) => {
                t instanceof HTMLButtonElement && (t.disabled = 0 === s.length);
            }),
        r('#queueStationBadge', `Estación C${a.queue.stationConsultorio}`),
        r(
            '#queueStationModeBadge',
            'locked' === a.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const y = document.getElementById('queuePracticeModeBadge');
    y instanceof HTMLElement && (y.hidden = !a.queue.practiceMode);
    const v = document.getElementById('queueShortcutPanel');
    v instanceof HTMLElement && (v.hidden = !a.queue.helpOpen);
    const k = document.querySelector('[data-action="queue-clear-call-key"]');
    k instanceof HTMLElement && (k.hidden = !a.queue.customCallKey);
    const w = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (w instanceof HTMLElement &&
        (w.setAttribute('aria-pressed', String(Boolean(a.queue.oneTap))),
        (w.textContent = a.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((t) => {
                if (!(t instanceof HTMLButtonElement)) return;
                const e = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1;
                t.disabled =
                    'locked' === a.queue.stationMode &&
                    e !== Number(a.queue.stationConsultorio || 1);
            }));
    const S = xe(a.queue.stationConsultorio);
    (document
        .querySelectorAll(
            '[data-action="queue-release-station"][data-queue-consultorio]'
        )
        .forEach((t) => {
            if (!(t instanceof HTMLButtonElement)) return;
            const e = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1,
                n = xe(e);
            ((t.disabled = !n),
                'locked' === a.queue.stationMode &&
                    e !== Number(a.queue.stationConsultorio || 1) &&
                    (t.disabled = !0));
        }),
        S &&
            (m.push(
                `activo: ${S.ticketCode} en C${a.queue.stationConsultorio}`
            ),
            r('#queueTriageSummary', m.join(' | '))),
        Re());
}
function ze(t) {
    g((e) => {
        const a = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: a } };
    });
    try {
        Re();
    } catch (t) {}
}
function Ve(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: Ne(t, e.data.queueTickets || []) },
    })),
        e && je(ze));
}
function Ue() {
    Ve([]);
}
function Ke(t, e = null, a = {}) {
    const n = (Array.isArray(t) ? t : []).map((t, e) => le(t, e)),
        i = pe(e && 'object' == typeof e ? e : de(n), n),
        o = n.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === ae(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === ae(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: n, queueMeta: i },
        queue: {
            ...t.queue,
            selected: Ne(t.queue.selected || [], n),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        _e(b()),
        je(ze));
}
function Qe(t, e) {
    const a = Number(t || 0),
        n = (b().data.queueTickets || []).map((t, n) => {
            const i = le(t, n);
            return i.id !== a
                ? i
                : le('function' == typeof e ? e(i) : { ...i }, n);
        });
    Ke(n, de(n), { fallbackPartial: !1, syncMode: 'live' });
}
function Ge(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), _e(b()), je(ze));
}
function We(t) {
    Ge({ filter: ae(t) || 'all', selected: [] });
}
function Je(t, e = {}) {
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
                ge(t, 'queue_tickets') ||
                ge(t, 'queueTickets') ||
                ge(t, 'tickets')
            )
                return !0;
            if (a && 'object' == typeof a) return !0;
            if (
                ge(t, 'waitingCount') ||
                ge(t, 'waiting_count') ||
                ge(t, 'calledCount') ||
                ge(t, 'called_count') ||
                ge(t, 'completedCount') ||
                ge(t, 'completed_count') ||
                ge(t, 'noShowCount') ||
                ge(t, 'no_show_count') ||
                ge(t, 'cancelledCount') ||
                ge(t, 'cancelled_count')
            )
                return !0;
            const n =
                t?.counts && 'object' == typeof t.counts ? t.counts : null;
            if (
                n &&
                (ge(n, 'waiting') ||
                    ge(n, 'called') ||
                    ge(n, 'completed') ||
                    ge(n, 'no_show') ||
                    ge(n, 'noShow') ||
                    ge(n, 'cancelled') ||
                    ge(n, 'canceled'))
            )
                return !0;
            if (ge(t, 'nextTickets') || ge(t, 'next_tickets')) return !0;
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
                ) || oe(t?.callingNow).concat(oe(t?.calling_now)).some(Boolean)
            );
        })(a, n, i)
    )
        return;
    const o = 'fallback' === ae(e.syncMode) ? 'fallback' : 'live',
        s = (b().data.queueTickets || []).map((t, e) => le(t, e)),
        r = pe(a, s),
        c = (function (t) {
            const e =
                    t?.counts && 'object' == typeof t.counts ? t.counts : null,
                a =
                    ge(t, 'waitingCount') ||
                    ge(t, 'waiting_count') ||
                    Boolean(e && ge(e, 'waiting')),
                n =
                    ge(t, 'calledCount') ||
                    ge(t, 'called_count') ||
                    Boolean(e && ge(e, 'called')),
                i = ge(t, 'nextTickets') || ge(t, 'next_tickets'),
                o =
                    ge(t, 'callingNowByConsultorio') ||
                    ge(t, 'calling_now_by_consultorio') ||
                    ge(t, 'callingNow') ||
                    ge(t, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        l = be(r),
        u = Boolean(i && 'object' == typeof i);
    if (!(n.length || l.length || u || c.waiting || c.called)) return;
    const d =
            Number(r.waitingCount || 0) >
            l.filter((t) => 'waiting' === t.status).length,
        p = new Map(s.map((t) => [me(t), t]));
    if (n.length) Ke(n, r, { fallbackPartial: !1, syncMode: o });
    else {
        !(function (t, e, a) {
            const n = e.callingNowByConsultorio || {},
                i = Number(e.calledCount || e.counts?.called || 0),
                o = Number(e.waitingCount || e.counts?.waiting || 0),
                s = oe(e.nextTickets),
                r = new Set(),
                c = n[1] || n[1] || null,
                l = n[2] || n[2] || null;
            (c && r.add(me(c)), l && r.add(me(l)));
            const u = new Set(s.map((t) => me(t))),
                d = r.size > 0 || 0 === i,
                p = u.size > 0 || 0 === o,
                m = u.size > 0 && o > u.size;
            for (const [e, n] of t.entries()) {
                const i = le(n, 0);
                a.called && d && 'called' === i.status && !r.has(e)
                    ? t.set(
                          e,
                          le(
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
        })(p, r, c);
        for (const t of l) {
            const e = me(t),
                a = p.get(e) || null,
                n = ce(t.createdAt, t.created_at, a?.createdAt, a?.created_at),
                i = ce(
                    t.priorityClass,
                    t.priority_class,
                    a?.priorityClass,
                    a?.priority_class,
                    'walk_in'
                ),
                o = ce(
                    t.queueType,
                    t.queue_type,
                    a?.queueType,
                    a?.queue_type,
                    'walk_in'
                ),
                s = ce(
                    t.patientInitials,
                    t.patient_initials,
                    a?.patientInitials,
                    a?.patient_initials,
                    '--'
                );
            p.set(
                e,
                le(
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
            const t = le(i, p.size),
                e = me(t),
                a = p.get(e) || null;
            p.set(e, le({ ...(a || {}), ...t }, p.size));
        }
        Ke(Array.from(p.values()), r, { fallbackPartial: d, syncMode: o });
    }
}
async function Ye() {
    try {
        (Je(await k('queue-state'), { syncMode: 'live' }),
            ze('Queue refresh realizado'));
    } catch (t) {
        ze('Queue refresh con error');
        const e = ye(Me, null);
        e?.queueTickets &&
            Ke(e.queueTickets, e.queueMeta || null, {
                fallbackPartial: !0,
                syncMode: 'fallback',
            });
    }
}
function Ze(t, e, a = void 0) {
    Qe(t, (t) => ({
        ...t,
        status: e,
        assignedConsultorio: void 0 === a ? t.assignedConsultorio : a,
        calledAt:
            'called' === e
                ? new Date().toISOString()
                : 'waiting' === e
                  ? ''
                  : t.calledAt,
        completedAt:
            'completed' === e || 'no_show' === e || 'cancelled' === e
                ? new Date().toISOString()
                : '',
    }));
}
async function Xe({ ticketId: t, action: e, consultorio: a }) {
    const n = Number(t || 0),
        i = ie(e);
    if (n && i)
        return b().queue.practiceMode
            ? ('reasignar' === i || 're-llamar' === i
                  ? Ze(n, 'called', 2 === Number(a || 1) ? 2 : 1)
                  : 'liberar' === i
                    ? Ze(n, 'waiting', null)
                    : 'completar' === i
                      ? Ze(n, 'completed')
                      : 'no_show' === i
                        ? Ze(n, 'no_show')
                        : 'cancelar' === i && Ze(n, 'cancelled'),
              void ze(`Practica: accion ${i} en ticket ${n}`))
            : (Je(
                  await k('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void ze(`Accion ${i} ticket ${n}`));
}
async function ta(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        a = b();
    if (!Te.get(e)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== e
        )
            return (
                ze(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const t = (function (t) {
                return Le().queueTickets.find(
                    (e) =>
                        'waiting' === e.status &&
                        (!e.assignedConsultorio || e.assignedConsultorio === t)
                );
            })(e);
            return t
                ? ((function (t, e) {
                      Qe(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void ze(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void ze('Practica: sin tickets en espera');
        }
        Te.set(e, !0);
        try {
            (Je(
                await k('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                ze(`Llamado C${e} ejecutado`));
        } catch (t) {
            (ze(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            Te.set(e, !1);
        }
    }
}
async function ea(t, e, a = 0) {
    const n = {
            ticketId: Number(t || 0),
            action: ie(e),
            consultorio: Number(a || 0),
        },
        i = b(),
        o = (function (t) {
            const e = Number(t || 0);
            return (
                (e && Le().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(n.ticketId);
    if (
        !i.queue.practiceMode &&
        $e.has(n.action) &&
        (function (t, e) {
            const a = ie(t);
            return (
                'cancelar' === a ||
                ('no_show' === a &&
                    (!e ||
                        'called' === ne(e.status) ||
                        Number(e.assignedConsultorio || 0) > 0))
            );
        })(n.action, o)
    )
        return (Fe(n), void ze(`Accion ${n.action} pendiente de confirmacion`));
    await Xe(n);
}
async function aa() {
    const t = b().queue.pendingSensitiveAction;
    t ? (Oe(), await Xe(t)) : Oe();
}
function na() {
    (Oe(), ze('Accion sensible cancelada'));
}
function ia() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (na(), 0)
    );
}
async function oa(t) {
    const e = Number(t || 0);
    e &&
        (b().queue.practiceMode
            ? ze(`Practica: reprint ticket ${e}`)
            : (await k('queue-reprint', { method: 'POST', body: { id: e } }),
              ze(`Reimpresion ticket ${e}`)));
}
function sa() {
    Ge({ helpOpen: !b().queue.helpOpen });
}
function ra(t) {
    const e = Boolean(t);
    (Ge({ practiceMode: e, pendingSensitiveAction: null }),
        ze(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
async function ca(t) {
    const e = b();
    if (e.queue.captureCallKeyMode) {
        const e = {
            key: String(t.key || ''),
            code: String(t.code || ''),
            location: Number(t.location || 0),
        };
        return (
            Ge({ customCallKey: e, captureCallKeyMode: !1 }),
            s('Tecla externa guardada', 'success'),
            void ze(`Tecla externa calibrada: ${e.code}`)
        );
    }
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                ae(e.code) === ae(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await ta(e.queue.stationConsultorio));
    const a = ae(t.code),
        n = ae(t.key),
        i =
            'numpadenter' === a ||
            'kpenter' === a ||
            ('enter' === n && 3 === Number(t.location || 0));
    if (i && e.queue.pendingSensitiveAction) await aa();
    else {
        if ('numpad2' === a || '2' === n)
            return 'locked' === e.queue.stationMode &&
                2 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void ze('Cambio de estación bloqueado por lock'))
                : (Ge({ stationConsultorio: 2 }),
                  void ze('Numpad: estacion C2'));
        if ('numpad1' === a || '1' === n)
            return 'locked' === e.queue.stationMode &&
                1 !== e.queue.stationConsultorio
                ? (s('Cambio bloqueado por modo estación', 'warning'),
                  void ze('Cambio de estación bloqueado por lock'))
                : (Ge({ stationConsultorio: 1 }),
                  void ze('Numpad: estacion C1'));
        if (i) {
            if (e.queue.oneTap) {
                const t = Pe();
                t &&
                    (Fe({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    }),
                    await aa());
            }
            await ta(e.queue.stationConsultorio);
        } else {
            if (
                'numpaddecimal' === a ||
                'kpdecimal' === a ||
                'decimal' === n ||
                ',' === n ||
                '.' === n
            ) {
                const t = Pe();
                return void (
                    t &&
                    Fe({
                        ticketId: t.id,
                        action: 'completar',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadsubtract' === a || 'kpsubtract' === a || '-' === n) {
                const t = Pe();
                return void (
                    t &&
                    Fe({
                        ticketId: t.id,
                        action: 'no_show',
                        consultorio: e.queue.stationConsultorio,
                    })
                );
            }
            if ('numpadadd' === a || 'kpadd' === a || '+' === n) {
                const t = Pe();
                t &&
                    (await ea(t.id, 're-llamar', e.queue.stationConsultorio),
                    ze(`Re-llamar ${t.ticketCode}`),
                    s(`Re-llamar ${t.ticketCode}`, 'info'));
            }
        }
    }
}
const la = 'appointments',
    ua = 'callbacks',
    da = 'reviews',
    pa = 'availability',
    ma = 'availability-meta',
    ba = 'queue-tickets',
    ga = 'queue-meta',
    fa = 'health-status';
function ha(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function ya(t) {
    g((e) => {
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
function va(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function ka(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function wa(t) {
    return ka(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function Sa(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        a = Math.abs(e);
    return e < 0
        ? a < 60
            ? `Hace ${a} min`
            : a < 1440
              ? `Hace ${Math.round(a / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function Ca(e, a, n) {
    return Array.isArray(e) && 0 !== e.length
        ? e
              .slice(0, 5)
              .map((e) => {
                  const i = String(e[a] || e.label || '-'),
                      o = String(e[n] ?? e.count ?? 0);
                  return `<li><span>${t(i)}</span><strong>${t(o)}</strong></li>`;
              })
              .join('')
        : '<li><span>Sin datos</span><strong>0</strong></li>';
}
function qa(e, a, n, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(i)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(n)}</small>\n            </div>\n            <strong>${t(String(a))}</strong>\n        </li>\n    `;
}
function Aa(e, a, n) {
    return `\n        <button type="button" class="operations-action-item" data-action="${t(e)}">\n            <span>${t(a)}</span>\n            <small>${t(n)}</small>\n        </button>\n    `;
}
function Ma(t) {
    const e = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        a = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        i = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
        s =
            t?.data?.availability && 'object' == typeof t.data.availability
                ? t.data.availability
                : {},
        l = t?.data?.funnelMetrics || {},
        u = (function (t) {
            return t.filter((t) =>
                (function (t) {
                    if (!t) return !1;
                    const e = new Date(t),
                        a = new Date();
                    return (
                        e.getFullYear() === a.getFullYear() &&
                        e.getMonth() === a.getMonth() &&
                        e.getDate() === a.getDate()
                    );
                })(wa(t))
            ).length;
        })(e),
        d = (function (t) {
            return t.filter((t) => {
                const e = va(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(e),
        p = (function (t) {
            return t.filter((t) => 'pending' === va(t.status)).length;
        })(a),
        m = (function (t) {
            return t.filter((t) => {
                if ('pending' !== va(t.status)) return !1;
                const e = (function (t) {
                    return ka(t?.fecha || t?.createdAt || '');
                })(t);
                return !!e && Math.round((Date.now() - e) / 6e4) >= 120;
            }).length;
        })(a),
        b = (function (t) {
            return t.filter((t) => 'no_show' === va(t.status)).length;
        })(e),
        g = (function (t) {
            return t.length
                ? (
                      t.reduce((t, e) => t + Number(e.rating || 0), 0) /
                      t.length
                  ).toFixed(1)
                : '0.0';
        })(i),
        f = (function (t, e = 30) {
            const a = Date.now();
            return t.filter((t) => {
                const n = ka(t.date || t.createdAt || '');
                return !!n && a - n <= 24 * e * 60 * 60 * 1e3;
            }).length;
        })(i),
        h = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(s),
        y = (function (t) {
            return t
                .map((t) => ({ item: t, stamp: wa(t) }))
                .filter((t) => t.stamp > 0 && t.stamp >= Date.now())
                .sort((t, e) => t.stamp - e.stamp)[0];
        })(e);
    (r('#todayAppointments', u),
        r('#totalAppointments', e.length),
        r('#pendingCallbacks', p),
        r('#totalReviewsCount', i.length),
        r('#totalNoShows', b),
        r('#avgRating', g),
        r('#adminAvgRating', g),
        r('#dashboardHeroRating', g),
        r('#dashboardHeroRecentReviews', f),
        r('#dashboardHeroUrgentCallbacks', m),
        r('#dashboardHeroPendingTransfers', d),
        r(
            '#dashboardHeroSummary',
            (function ({
                pendingTransfers: t,
                urgentCallbacks: e,
                noShows: a,
                nextAppointment: n,
            }) {
                return t > 0
                    ? `Primero valida ${t} transferencia(s) antes de liberar mas agenda.`
                    : e > 0
                      ? `Hay ${e} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`
                      : a > 0
                        ? `Revisa ${a} no show del corte actual para cerrar seguimiento.`
                        : n?.item
                          ? `La siguiente cita es ${n.item.name || 'sin nombre'} ${Sa(n.stamp).toLowerCase()}.`
                          : 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
            })({
                pendingTransfers: d,
                urgentCallbacks: m,
                noShows: b,
                nextAppointment: y,
            })
        ));
    const v = d > 0 || m > 0 ? 'Atencion' : u > 0 ? 'Activo' : 'Estable',
        k = d > 0 || m > 0 ? 'warning' : u > 0 ? 'neutral' : 'success',
        w =
            d > 0
                ? 'Transferencias detenidas hasta validar comprobante.'
                : m > 0
                  ? 'Callbacks fuera de SLA requieren llamada inmediata.'
                  : y?.item
                    ? `Siguiente ingreso: ${y.item.name || 'Paciente'} el ${n(y.item.date)} a las ${y.item.time || '--:--'}.`
                    : 'Sin alertas criticas en la operacion actual.';
    (r('#dashboardLiveStatus', v),
        document
            .getElementById('dashboardLiveStatus')
            ?.setAttribute('data-state', k),
        r('#dashboardLiveMeta', w),
        r(
            '#dashboardQueueHealth',
            m > 0
                ? 'Cola: SLA comprometido'
                : p > 0
                  ? 'Cola: pendiente por drenar'
                  : 'Cola: estable'
        ),
        r(
            '#dashboardFlowStatus',
            y?.item
                ? `${Sa(y.stamp)} | ${y.item.name || 'Paciente'}`
                : h > 0
                  ? `${h} dia(s) con slots publicados`
                  : 'Sin citas inmediatas'
        ),
        r('#operationPendingReviewCount', d),
        r('#operationPendingCallbacksCount', p),
        r('#operationTodayLoadCount', u),
        r(
            '#operationDeckMeta',
            d > 0 || m > 0
                ? 'La prioridad ya esta definida'
                : y?.item
                  ? 'Siguiente accion lista'
                  : 'Operacion sin frentes urgentes'
        ),
        r(
            '#operationQueueHealth',
            y?.item
                ? `Siguiente hito: ${y.item.name || 'Paciente'} ${Sa(y.stamp).toLowerCase()}`
                : 'Sin citas inmediatas en cola'
        ),
        c(
            '#operationActionList',
            [
                Aa(
                    'context-open-appointments-transfer',
                    d > 0 ? 'Validar transferencias' : 'Abrir agenda clinica',
                    d > 0
                        ? `${d} comprobante(s) por revisar`
                        : `${e.length} cita(s) en el corte`
                ),
                Aa(
                    'context-open-callbacks-pending',
                    m > 0 ? 'Resolver callbacks urgentes' : 'Abrir callbacks',
                    m > 0
                        ? `${m} caso(s) fuera de SLA`
                        : `${p} callback(s) pendientes`
                ),
                Aa(
                    'refresh-admin-data',
                    'Actualizar tablero',
                    y?.item
                        ? `Proxima cita ${Sa(y.stamp).toLowerCase()}`
                        : 'Sincronizar agenda y funnel'
                ),
            ].join('')
        ),
        c(
            '#dashboardAttentionList',
            [
                qa(
                    'Transferencias',
                    d,
                    d > 0
                        ? 'Pago detenido antes de confirmar.'
                        : 'Sin comprobantes pendientes.',
                    d > 0 ? 'warning' : 'success'
                ),
                qa(
                    'Callbacks urgentes',
                    m,
                    m > 0
                        ? 'Mas de 120 min en espera.'
                        : 'SLA dentro de rango.',
                    m > 0 ? 'danger' : 'success'
                ),
                qa(
                    'Agenda de hoy',
                    u,
                    u > 0
                        ? `${u} ingreso(s) en la jornada.`
                        : 'No hay citas hoy.',
                    u > 6 ? 'warning' : 'neutral'
                ),
                qa(
                    'Disponibilidad',
                    h,
                    h > 0
                        ? 'Dias con slots listos para publicar.'
                        : 'Sin slots cargados en el calendario.',
                    h > 0 ? 'success' : 'warning'
                ),
            ].join('')
        ));
    const S = l.summary || {};
    (r('#funnelViewBooking', o(S.viewBooking || 0)),
        r('#funnelStartCheckout', o(S.startCheckout || 0)),
        r('#funnelBookingConfirmed', o(S.bookingConfirmed || 0)),
        r('#funnelAbandonRate', `${Number(S.abandonRatePct || 0).toFixed(1)}%`),
        c('#funnelEntryList', Ca(l.checkoutEntryBreakdown, 'entry', 'count')),
        c('#funnelSourceList', Ca(l.sourceBreakdown, 'source', 'count')),
        c(
            '#funnelPaymentMethodList',
            Ca(l.paymentMethodBreakdown, 'method', 'count')
        ),
        c('#funnelAbandonList', Ca(l.checkoutAbandonByStep, 'step', 'count')),
        c(
            '#funnelAbandonReasonList',
            Ca(l.abandonReasonBreakdown, 'reason', 'count')
        ),
        c('#funnelStepList', Ca(l.bookingStepBreakdown, 'step', 'count')),
        c('#funnelErrorCodeList', Ca(l.errorCodeBreakdown, 'code', 'count')));
}
function Ta(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function $a(t) {
    const e = new Date(t?.date || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function _a(t) {
    return `${Math.max(0, Math.min(5, Math.round(Number(t || 0))))}/5`;
}
function La(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function Ea(t, e = 220) {
    const a = String(t || '').trim();
    return a
        ? a.length <= e
            ? a
            : `${a.slice(0, e - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function Na() {
    const t = (function () {
        const t = b(),
            e = Number(t.ui.lastRefreshAt || 0);
        if (!e) return 'Datos: sin sincronizar';
        const a = Math.max(0, Math.round((Date.now() - e) / 1e3));
        return a < 60
            ? `Datos: hace ${a}s`
            : `Datos: hace ${Math.round(a / 60)}m`;
    })();
    (r('#adminRefreshStatus', t),
        r(
            '#adminSyncState',
            'Datos: sin sincronizar' === t
                ? 'Listo para primera sincronizacion'
                : t.replace('Datos: ', 'Estado: ')
        ));
}
async function Da(e = !1) {
    const a = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    k('data'),
                    k('health').catch(() => null),
                ]),
                a = t.data || {};
            let n = a.funnelMetrics || null;
            if (!n) {
                const t = await k('funnel-metrics').catch(() => null);
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
                queueTickets: ha(a),
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
                ya(i),
                (function (t) {
                    (ve(la, t.appointments || []),
                        ve(ua, t.callbacks || []),
                        ve(da, t.reviews || []),
                        ve(pa, t.availability || {}),
                        ve(ma, t.availabilityMeta || {}),
                        ve(ba, t.queueTickets || []),
                        ve(ga, t.queueMeta || null),
                        ve(fa, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (
                ya({
                    appointments: ye(la, []),
                    callbacks: ye(ua, []),
                    reviews: ye(da, []),
                    availability: ye(pa, {}),
                    availabilityMeta: ye(ma, {}),
                    queueTickets: ye(ba, []),
                    queueMeta: ye(ga, null),
                    health: ye(fa, null),
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
    return (
        (function () {
            const t = b(),
                e = It(t.data.availability || {}),
                a = Ot(t.availability.selectedDate, e);
            (Wt({
                draft: e,
                selectedDate: a,
                monthAnchor: Ft(t.availability.monthAnchor, a),
                draftDirty: !1,
                lastAction: '',
            }),
                Gt());
        })(),
        await (async function () {
            const t = b(),
                e = Array.isArray(t.data.queueTickets)
                    ? t.data.queueTickets.map((t, e) => le(t, e))
                    : [],
                a =
                    t.data.queueMeta && 'object' == typeof t.data.queueMeta
                        ? pe(t.data.queueMeta, e)
                        : null;
            if (e.length)
                return void Ke(e, a || null, {
                    fallbackPartial: !1,
                    syncMode: 'live',
                });
            const n = a ? be(a) : [];
            if (n.length)
                return (
                    Ke(n, a, { fallbackPartial: !0, syncMode: 'fallback' }),
                    void ze('Queue fallback parcial desde metadata')
                );
            if ((await Ye(), (b().data.queueTickets || []).length)) return;
            const i = ye(Me, null);
            if (i?.queueTickets?.length)
                return (
                    Ke(i.queueTickets, i.queueMeta || null, {
                        fallbackPartial: !0,
                        syncMode: 'fallback',
                    }),
                    void ze('Queue fallback desde snapshot local')
                );
            Ke([], null, { fallbackPartial: !1, syncMode: 'live' });
        })(),
        I(b()),
        Ma(b()),
        ot(),
        Mt(),
        (function () {
            const e = b(),
                a = Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
                n = (function (t) {
                    return t.slice().sort((t, e) => $a(e) - $a(t));
                })(a),
                o = (function (t) {
                    return t.length
                        ? t.reduce((t, e) => t + Number(e.rating || 0), 0) /
                              t.length
                        : 0;
                })(a),
                s = a.filter((t) => Number(t.rating || 0) >= 5).length,
                l = (function (t, e = 30) {
                    const a = Date.now();
                    return t.filter((t) => {
                        const n = $a(t);
                        return !!n && a - n <= 24 * e * 60 * 60 * 1e3;
                    }).length;
                })(a),
                u = (function (t) {
                    return t.filter((t) => Number(t.rating || 0) <= 3).length;
                })(a),
                d = (function (t) {
                    const e = t.find((t) => Number(t.rating || 0) <= 3);
                    if (e)
                        return {
                            item: e,
                            eyebrow: 'Feedback accionable',
                            summary:
                                'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
                        };
                    const a = t.find((t) => Number(t.rating || 0) >= 5);
                    return a
                        ? {
                              item: a,
                              eyebrow: 'Senal a repetir',
                              summary:
                                  'Usa este comentario como referencia del recorrido que conviene proteger.',
                          }
                        : t[0]
                          ? {
                                item: t[0],
                                eyebrow: 'Ultima voz',
                                summary:
                                    'Es la resena mas reciente dentro del corte actual.',
                            }
                          : {
                                item: null,
                                eyebrow: 'Sin spotlight',
                                summary:
                                    'Cuando entren resenas apareceran aqui con lectura prioritaria.',
                            };
                })(n);
            if (
                (r('#reviewsAverageRating', o.toFixed(1)),
                r('#reviewsFiveStarCount', s),
                r('#reviewsRecentCount', l),
                r('#reviewsTotalCount', a.length),
                r(
                    '#reviewsSentimentLabel',
                    (function (t, e, a) {
                        return e
                            ? a > 0 && t < 4
                                ? 'Atencion requerida'
                                : t >= 4.7
                                  ? 'Confianza alta'
                                  : t >= 4.2
                                    ? 'Tono solido'
                                    : t >= 3.5
                                      ? 'Lectura mixta'
                                      : 'Atencion requerida'
                            : 'Sin senal suficiente';
                    })(o, a.length, u)
                ),
                c(
                    '#reviewsSummaryRail',
                    (function (e, a, n) {
                        const o = e[0],
                            s = o ? i(o.date || o.createdAt || '') : '-';
                        return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${t(o ? String(o.name || 'Anonimo') : 'Sin datos')}</strong>\n            <small>${t(s)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${t(String(a))} en 30 dias</strong>\n            <small>Volumen reciente de feedback.</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Riesgo</span>\n            <strong>${t(n > 0 ? `${n} por revisar` : 'Sin alertas')}</strong>\n            <small>${t(n > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>\n        </article>\n    `;
                    })(n, l, u)
                ),
                !a.length)
            )
                return (
                    c(
                        '#reviewsSpotlight',
                        '\n                <div class="reviews-empty-state" data-admin-empty-state="reviews">\n                    <strong>Sin feedback reciente</strong>\n                    <p>No hay resenas registradas todavia.</p>\n                </div>\n            '
                    ),
                    void c(
                        '#reviewsGrid',
                        '\n                <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">\n                    <strong>No hay resenas registradas.</strong>\n                    <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>\n                </div>\n            '
                    )
                );
            if (d.item) {
                const e = d.item;
                c(
                    '#reviewsSpotlight',
                    `\n                <article class="reviews-spotlight-card">\n                    <div class="reviews-spotlight-top">\n                        <span class="review-avatar">${t(La(e.name || 'Anonimo'))}</span>\n                        <div>\n                            <small>${t(d.eyebrow)}</small>\n                            <strong>${t(e.name || 'Anonimo')}</strong>\n                            <small>${t(i(e.date || e.createdAt || ''))}</small>\n                        </div>\n                    </div>\n                    <p class="reviews-spotlight-stars">${t(_a(e.rating))}</p>\n                    <p>${t(Ea(e.comment || e.review || '', 320))}</p>\n                    <small>${t(d.summary)}</small>\n                </article>\n            `
                );
            } else
                c(
                    '#reviewsSpotlight',
                    `\n                <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">\n                    <strong>Sin spotlight disponible</strong>\n                    <p>${t(d.summary)}</p>\n                </div>\n            `
                );
            c(
                '#reviewsGrid',
                n
                    .map((e) =>
                        (function (e, { featured: a = !1 } = {}) {
                            const n = Number(e.rating || 0),
                                o =
                                    n >= 5
                                        ? 'success'
                                        : n <= 3
                                          ? 'danger'
                                          : 'neutral',
                                s =
                                    n >= 5
                                        ? 'Resena de alta confianza'
                                        : n <= 3
                                          ? 'Revisar posible friccion'
                                          : 'Resena util para contexto';
                            return `\n        <article class="review-card${a ? ' is-featured' : ''}" data-rating="${t(String(n))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${t(La(e.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(e.name || 'Anonimo')}</strong>\n                        <small>${t(i(e.date || e.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${t(o)}">${t(_a(n))}</span>\n            </header>\n            <p>${t(Ea(e.comment || e.review || ''))}</p>\n            <small>${t(s)}</small>\n        </article>\n    `;
                        })(e, {
                            featured:
                                d.item &&
                                Ta(e.name) === Ta(d.item.name) &&
                                $a(e) === $a(d.item),
                        })
                    )
                    .join('')
            );
        })(),
        Gt(),
        je(),
        Na(),
        e &&
            s(
                a ? 'Datos actualizados' : 'Datos cargados desde cache local',
                a ? 'success' : 'warning'
            ),
        a
    );
}
function Ba() {
    (N(!1),
        x(),
        B(!1),
        D({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function xa(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = e instanceof HTMLInputElement ? e.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        B(!0);
        const t = b();
        if (
            (D({
                tone: t.auth.requires2FA ? 'warning' : 'neutral',
                title: t.auth.requires2FA
                    ? 'Validando segundo factor'
                    : 'Validando credenciales',
                message: t.auth.requires2FA
                    ? 'Comprobando el codigo 2FA antes de abrir el panel.'
                    : 'Comprobando clave y proteccion de sesion.',
            }),
            t.auth.requires2FA)
        )
            await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Codigo 2FA requerido');
                const a = await w('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    n = String(a.csrfToken || '');
                return (
                    v(n),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                            lastAuthAt: Date.now(),
                            authMethod: '2fa',
                        },
                    })),
                    { authenticated: !0 }
                );
            })(i);
        else {
            const t = await (async function (t) {
                const e = String(t || '').trim();
                if (!e) throw new Error('Contrasena requerida');
                const a = await w('login', {
                    method: 'POST',
                    body: { password: e },
                });
                if (!0 === a.twoFactorRequired)
                    return (
                        g((t) => ({
                            ...t,
                            auth: {
                                ...t.auth,
                                requires2FA: !0,
                                authMethod: 'password',
                            },
                        })),
                        { authenticated: !1, requires2FA: !0 }
                    );
                const n = String(a.csrfToken || '');
                return (
                    v(n),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: n,
                            requires2FA: !1,
                            lastAuthAt: Date.now(),
                            authMethod: 'password',
                        },
                    })),
                    { authenticated: !0, requires2FA: !1 }
                );
            })(n);
            if (t.requires2FA)
                return (
                    N(!0),
                    D({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void P('2fa')
                );
        }
        (D({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            $(),
            L(),
            N(!1),
            x({ clearPassword: !0 }),
            await Da(!1),
            s('Sesion iniciada', 'success'));
    } catch (t) {
        (D({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            P(b().auth.requires2FA ? '2fa' : 'password'),
            s(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        B(!1);
    }
}
async function Pa(t, e) {
    switch (t) {
        case 'appointment-quick-filter':
            return (rt(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-appointment-filters':
            return (st({ filter: 'all', search: '' }), !0);
        case 'appointment-density':
            return (
                st({
                    density:
                        'compact' ===
                        V(String(e.dataset.density || 'comfortable'))
                            ? 'compact'
                            : z,
                }),
                !0
            );
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await ut(t, { paymentStatus: 'paid' }),
                        lt(t, { paymentStatus: 'paid' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia aprobada', 'success'),
                !0
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await ut(t, { paymentStatus: 'failed' }),
                        lt(t, { paymentStatus: 'failed' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia rechazada', 'warning'),
                !0
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await ut(t, { status: 'no_show' }),
                        lt(t, { status: 'no_show' }));
                })(Number(e.dataset.id || 0)),
                s('Marcado como no show', 'warning'),
                !0
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await ut(t, { status: 'cancelled' }),
                        lt(t, { status: 'cancelled' }));
                })(Number(e.dataset.id || 0)),
                s('Cita cancelada', 'warning'),
                !0
            );
        case 'export-csv':
            return (
                (function () {
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
                            ...(b().data.appointments || []).map((t) => [
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
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function Ia(t, a) {
    switch (t) {
        case 'change-month':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!Number.isFinite(e) || 0 === e) return;
                    const a = Ft(
                        b().availability.monthAnchor,
                        b().availability.selectedDate
                    );
                    (a.setMonth(a.getMonth() + e),
                        Wt({ monthAnchor: a, lastAction: '' }, { render: !0 }));
                })(Number(a.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (Xt(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const t = Qt(-1);
                    t
                        ? Xt(t, `Fecha previa con slots: ${t}`)
                        : Yt('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const t = Qt(1);
                    t
                        ? Xt(t, `Siguiente fecha con slots: ${t}`)
                        : Yt('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (t) {
                    const e = Bt(t);
                    e &&
                        Wt(
                            {
                                selectedDate: e,
                                monthAnchor: Ft(e, e),
                                lastAction: '',
                            },
                            { render: !0 }
                        );
                })(String(a.dataset.date || '')),
                !0
            );
        case 'prefill-time-slot':
            return (
                (function (t) {
                    if (Vt()) return;
                    const a = e('#newSlotTime');
                    a instanceof HTMLInputElement &&
                        ((a.value = Nt(t)), a.focus());
                })(String(a.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (Vt()) return;
                    const t = e('#newSlotTime');
                    if (!(t instanceof HTMLInputElement)) return;
                    const a = Nt(t.value);
                    if (!a) return;
                    const n = b(),
                        i = Bt(n.availability.selectedDate) || Ut();
                    i &&
                        (Zt(
                            i,
                            [
                                ...(Array.isArray(n.availability.draft[i])
                                    ? n.availability.draft[i]
                                    : []),
                                a,
                            ],
                            `Slot ${a} agregado en ${i}`
                        ),
                        (t.value = ''));
                })(),
                !0
            );
        case 'remove-time-slot':
            return (
                (function (t, e) {
                    if (Vt()) return;
                    const a = Bt(t);
                    if (!a) return;
                    const n = b(),
                        i = Array.isArray(n.availability.draft[a])
                            ? n.availability.draft[a]
                            : [],
                        o = Nt(e);
                    Zt(
                        a,
                        i.filter((t) => Nt(t) !== o),
                        `Slot ${o || '-'} removido en ${a}`
                    );
                })(
                    decodeURIComponent(String(a.dataset.date || '')),
                    decodeURIComponent(String(a.dataset.time || ''))
                ),
                !0
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return (
                (function () {
                    if (Vt()) return;
                    const t = b(),
                        e = Bt(t.availability.selectedDate) || Ut(),
                        a = Array.isArray(t.availability.draft[e])
                            ? Dt(t.availability.draft[e])
                            : [];
                    Wt(
                        {
                            clipboard: a,
                            clipboardDate: e,
                            lastAction: a.length
                                ? `Portapapeles: ${a.length} slots (${e})`
                                : 'Portapapeles vacio',
                        },
                        { render: !0 }
                    );
                })(),
                !0
            );
        case 'paste-availability-day':
            return (
                (function () {
                    if (Vt()) return;
                    const t = b(),
                        e = Array.isArray(t.availability.clipboard)
                            ? Dt(t.availability.clipboard)
                            : [];
                    if (!e.length) return void Yt('Portapapeles vacio');
                    const a = Bt(t.availability.selectedDate) || Ut();
                    Zt(a, e, `Pegado ${e.length} slots en ${a}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (ee(1), !0);
        case 'duplicate-availability-next-week':
            return (ee(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (Vt()) return;
                    const t = Bt(b().availability.selectedDate) || Ut();
                    t &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${t}. Continuar?`
                        ) &&
                        Zt(t, [], `Dia ${t} limpiado`);
                })(),
                !0
            );
        case 'clear-availability-week':
            return (
                (function () {
                    if (Vt()) return;
                    const t = Bt(b().availability.selectedDate) || Ut();
                    if (!t) return;
                    const e = (function (t) {
                        const e = xt(t);
                        if (!e) return null;
                        const a = (e.getDay() + 6) % 7,
                            n = new Date(e);
                        n.setDate(e.getDate() - a);
                        const i = new Date(n);
                        return (
                            i.setDate(n.getDate() + 6),
                            { start: n, end: i }
                        );
                    })(t);
                    if (!e) return;
                    const a = u(e.start),
                        n = u(e.end);
                    if (
                        !window.confirm(
                            `Se eliminaran los slots de la semana ${a} a ${n}. Continuar?`
                        )
                    )
                        return;
                    const i = zt();
                    for (let t = 0; t < 7; t += 1) {
                        const a = new Date(e.start);
                        (a.setDate(e.start.getDate() + t), delete i[u(a)]);
                    }
                    Jt(i, {
                        selectedDate: t,
                        lastAction: `Semana limpiada (${a} - ${n})`,
                    });
                })(),
                !0
            );
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (Vt()) return;
                    const t = zt(),
                        e = await k('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        a =
                            e?.data && 'object' == typeof e.data
                                ? It(e.data)
                                : t,
                        n =
                            e?.meta && 'object' == typeof e.meta
                                ? e.meta
                                : null;
                    (g((t) => ({
                        ...t,
                        data: {
                            ...t.data,
                            availability: a,
                            availabilityMeta: n
                                ? { ...t.data.availabilityMeta, ...n }
                                : t.data.availabilityMeta,
                        },
                        availability: {
                            ...t.availability,
                            draft: a,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        Gt());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (Vt()) return;
                    const t = b();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const e = It(t.data.availability || {}),
                        a = Ot(t.availability.selectedDate, e);
                    Wt(
                        {
                            draft: e,
                            selectedDate: a,
                            monthAnchor: Ft(t.availability.monthAnchor, a),
                            draftDirty: !1,
                            lastAction: 'Borrador descartado',
                        },
                        { render: !0 }
                    );
                })(),
                s('Borrador descartado', 'info'),
                !0
            );
        default:
            return !1;
    }
}
const Ha = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function Fa(t, e = 'dashboard') {
    const a = String(t || '')
        .trim()
        .toLowerCase();
    return Ha.has(a) ? a : e;
}
function Oa(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            a = e ? `#${e}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(Fa(t));
}
const Ra = 'themeMode',
    ja = new Set(['light', 'dark', 'system']);
const za = 'adminLastSection',
    Va = 'adminSidebarCollapsed';
function Ua(t, { persist: e = !1 } = {}) {
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
    (g((e) => ({ ...e, ui: { ...e.ui, themeMode: t, theme: a } })),
        e &&
            (function (t) {
                const e = ja.has(t) ? t : 'system';
                he(Ra, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const a = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
}
function Ka() {
    const t = b();
    (he(za, t.ui.activeSection), he(Va, t.ui.sidebarCollapsed ? '1' : '0'));
}
function Qa() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function Ga(t) {
    return (
        t instanceof HTMLElement &&
        !t.hidden &&
        'true' !== t.getAttribute('aria-hidden') &&
        (!('disabled' in t) || !t.disabled) &&
        t.getClientRects().length > 0
    );
}
function Wa() {
    const t = b(),
        a = Qa(),
        n = e('#adminSidebar'),
        i = n instanceof HTMLElement && n.classList.contains('is-open');
    (!(function ({ open: t, collapsed: a }) {
        const n = e('#adminSidebar'),
            i = e('#adminSidebarBackdrop'),
            o = e('#adminMenuToggle');
        (n && n.classList.toggle('is-open', Boolean(t)),
            i && i.classList.toggle('is-hidden', !t),
            o && o.setAttribute('aria-expanded', String(Boolean(t))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(t)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(a)
            ));
        const s = e('#adminSidebarCollapse');
        s && s.setAttribute('aria-pressed', String(Boolean(a)));
    })({
        open: !!a && t.ui.sidebarOpen,
        collapsed: !a && t.ui.sidebarCollapsed,
    }),
        a &&
            t.ui.sidebarOpen &&
            !i &&
            (function () {
                const t = e('#adminSidebar');
                t instanceof HTMLElement &&
                    window.requestAnimationFrame(() => {
                        const e =
                            t.querySelector('.nav-item.active[data-section]') ||
                            t.querySelector('.nav-item[data-section]');
                        e instanceof HTMLElement && e.focus();
                    });
            })());
}
async function Ja(t, e = {}) {
    const a = Fa(t, 'dashboard'),
        { force: n = !1 } = e,
        i = b().ui.activeSection;
    return (
        !(
            !n &&
            'availability' === b().ui.activeSection &&
            'availability' !== a &&
            te() &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (t) {
            const e = Fa(t, 'dashboard');
            (g((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                E(e),
                I(b()),
                Oa(e),
                Ka());
        })(a),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const t = b();
                return (
                    'fallback' !== ae(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await Ye()),
        !0)
    );
}
function Ya() {
    (g((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    })),
        Wa(),
        Ka());
}
function Za() {
    (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } })),
        Wa());
}
function Xa({ restoreFocus: t = !1 } = {}) {
    if (
        (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })), Wa(), L(), t)
    ) {
        const t = e('#adminMenuToggle');
        t instanceof HTMLElement && t.focus();
    }
}
function tn() {
    _();
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function en() {
    const t = b().ui.activeSection;
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
async function an(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await Ja('appointments'), rt('pending_transfer'), ct(''));
            break;
        case 'appointments_all':
            (await Ja('appointments'), rt('all'), ct(''));
            break;
        case 'appointments_no_show':
            (await Ja('appointments'), rt('no_show'), ct(''));
            break;
        case 'callbacks_pending':
            (await Ja('callbacks'), $t('pending'));
            break;
        case 'callbacks_contacted':
            (await Ja('callbacks'), $t('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await Ja('callbacks'), $t('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await Ja('queue'), We('sla_risk'));
            break;
        case 'queue_waiting':
            (await Ja('queue'), We('waiting'));
            break;
        case 'queue_called':
            (await Ja('queue'), We('called'));
            break;
        case 'queue_no_show':
            (await Ja('queue'), We('no_show'));
            break;
        case 'queue_all':
            (await Ja('queue'), We('all'));
            break;
        case 'queue_call_next':
            (await Ja('queue'), await ta(b().queue.stationConsultorio));
    }
}
function nn(t) {
    const e = String(t || '')
        .trim()
        .toLowerCase();
    return e
        ? e.includes('callbacks') && e.includes('pend')
            ? 'callbacks_pending'
            : e.includes('callback') && (e.includes('urg') || e.includes('sla'))
              ? 'callbacks_sla_urgent'
              : e.includes('citas') && e.includes('transfer')
                ? 'appointments_pending_transfer'
                : e.includes('queue') || e.includes('cola')
                  ? 'queue_sla_risk'
                  : e.includes('no show')
                    ? 'appointments_no_show'
                    : null
        : null;
}
async function on(t, e) {
    switch (t) {
        case 'callback-quick-filter':
            return ($t(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                Tt({
                    filter: 'all',
                    sort: 'recent_desc',
                    search: '',
                    selected: [],
                }),
                !0
            );
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await Ja('callbacks'),
                $t('pending'),
                (function () {
                    const t = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    t instanceof HTMLElement && t.focus();
                })(),
                !0
            );
        case 'mark-contacted':
            return (
                await _t(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.callbackDate || '')
                ),
                s('Callback actualizado', 'success'),
                !0
            );
        case 'callbacks-bulk-select-visible':
            return (
                Tt(
                    {
                        selected: Array.from(
                            document.querySelectorAll(
                                '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
                            )
                        )
                            .map((t) =>
                                Number(t.getAttribute('data-callback-id') || 0)
                            )
                            .filter((t) => t > 0),
                    },
                    { persist: !1 }
                ),
                !0
            );
        case 'callbacks-bulk-clear':
            return (Tt({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const t = (b().callbacks.selected || [])
                        .map((t) => Number(t || 0))
                        .filter((t) => t > 0);
                    for (const e of t)
                        try {
                            await _t(e);
                        } catch (t) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await Ja('callbacks'), $t('pending'), !0);
        default:
            return !1;
    }
}
async function sn(t) {
    switch (t) {
        case 'context-open-appointments-transfer':
            return (await Ja('appointments'), rt('pending_transfer'), !0);
        case 'context-open-dashboard':
            return (await Ja('dashboard'), !0);
        default:
            return !1;
    }
}
async function rn(t, e) {
    switch (t) {
        case 'queue-refresh-state':
            return (await Ye(), !0);
        case 'queue-call-next':
            return (await ta(Number(e.dataset.queueConsultorio || 0)), !0);
        case 'queue-release-station':
            return (
                await (async function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1,
                        a = xe(e);
                    a
                        ? await ea(a.id, 'liberar', e)
                        : ze(`Sin ticket activo para liberar en C${e}`);
                })(Number(e.dataset.queueConsultorio || 0)),
                !0
            );
        case 'queue-toggle-ticket-select':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!e) return;
                    const a = Ne(b().queue.selected || []);
                    Ve(a.includes(e) ? a.filter((t) => t !== e) : [...a, e]);
                })(Number(e.dataset.queueId || 0)),
                !0
            );
        case 'queue-select-visible':
            return (Ve(Ee().map((t) => Number(t.id || 0))), !0);
        case 'queue-clear-selection':
            return (Ue(), !0);
        case 'queue-ticket-action':
            return (
                await ea(
                    Number(e.dataset.queueId || 0),
                    String(e.dataset.queueAction || ''),
                    Number(e.dataset.queueConsultorio || 0)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await oa(Number(e.dataset.queueId || 0)), !0);
        case 'queue-bulk-action':
            return (
                await (async function (t) {
                    const e = Be(),
                        a = ie(t);
                    if (e.length) {
                        if ($e.has(a)) {
                            const t =
                                'no_show' === a
                                    ? 'No show'
                                    : 'completar' === a || 'completed' === a
                                      ? 'Completar'
                                      : 'Cancelar';
                            if (
                                !window.confirm(`${t}: confirmar acción masiva`)
                            )
                                return;
                        }
                        for (const t of e)
                            try {
                                await Xe({
                                    ticketId: t.id,
                                    action: a,
                                    consultorio:
                                        t.assignedConsultorio ||
                                        b().queue.stationConsultorio,
                                });
                            } catch (t) {}
                        (Ue(), ze(`Bulk ${a} sobre ${e.length} tickets`));
                    }
                })(String(e.dataset.queueAction || 'no_show')),
                !0
            );
        case 'queue-bulk-reprint':
            return (
                await (async function () {
                    const t = Be();
                    for (const e of t)
                        try {
                            await oa(e.id);
                        } catch (t) {}
                    (Ue(), ze(`Bulk reimpresion ${t.length}`));
                })(),
                !0
            );
        case 'queue-clear-search':
            return (
                (function () {
                    Ge({ search: '', selected: [] });
                    const t = document.getElementById('queueSearchInput');
                    t instanceof HTMLInputElement && (t.value = '');
                })(),
                !0
            );
        case 'queue-toggle-shortcuts':
            return (sa(), !0);
        case 'queue-toggle-one-tap':
            return (Ge({ oneTap: !b().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (ra(!0), !0);
        case 'queue-stop-practice':
            return (ra(!1), !0);
        case 'queue-lock-station':
            return (
                (function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1;
                    (Ge({ stationMode: 'locked', stationConsultorio: e }),
                        ze(`Estacion bloqueada en C${e}`));
                })(Number(e.dataset.queueConsultorio || 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (t) {
                    if ('free' === ae(t))
                        return (
                            Ge({ stationMode: 'free' }),
                            void ze('Estacion en modo libre')
                        );
                    Ge({ stationMode: 'locked' });
                })(String(e.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-sensitive-confirm':
            return (await aa(), !0);
        case 'queue-sensitive-cancel':
            return (na(), !0);
        case 'queue-capture-call-key':
            return (
                Ge({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    (Ge({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        default:
            return !1;
    }
}
async function cn(t, e) {
    switch (t) {
        case 'close-toast':
            return (e.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                Ua(String(e.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return (Ya(), !0);
        case 'refresh-admin-data':
            return (await Da(!0), !0);
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = nn(t.value);
                e && (await an(e), (t.value = ''), L());
            }
            return !0;
        }
        case 'open-command-palette':
            return (_(), tn(), !0);
        case 'close-command-palette':
            return (L(), !0);
        case 'logout':
            return (
                await (async function () {
                    try {
                        await w('logout', { method: 'POST' });
                    } catch (t) {}
                    (v(''),
                        g((t) => ({
                            ...t,
                            auth: {
                                ...t.auth,
                                authenticated: !1,
                                csrfToken: '',
                                requires2FA: !1,
                                lastAuthAt: 0,
                                authMethod: '',
                            },
                        })));
                })(),
                T(),
                L(),
                Ba(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                g((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                N(!1),
                x(),
                D({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                P('password'),
                !0
            );
        default:
            return !1;
    }
}
async function ln() {
    (!(function () {
        const t = e('#loginScreen'),
            a = e('#adminDashboard');
        if (!(t instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((t.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${C('sun')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${C('moon')}</button>\n                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${C('system')}</button>\n                </div>\n            </section>\n        </div>\n    `),
            (a.innerHTML = `\n        <div class="admin-v3-shell">\n            <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n                <header class="sidebar-header">\n                    <div class="admin-v3-sidebar__brand">\n                        <strong>Piel en Armonia</strong>\n                        <small>Admin sony_v3</small>\n                    </div>\n                    <div class="toolbar-group">\n                        <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${C('menu')}</button>\n                        <button type="button" id="adminMenuClose">Cerrar</button>\n                    </div>\n                </header>\n                <nav class="sidebar-nav" id="adminSidebarNav">\n                    ${q('dashboard', 'Dashboard', 'dashboard', !0)}\n                    ${q('appointments', 'Citas', 'appointments')}\n                    ${q('callbacks', 'Callbacks', 'callbacks')}\n                    ${q('reviews', 'Resenas', 'reviews')}\n                    ${q('availability', 'Disponibilidad', 'availability')}\n                    ${q('queue', 'Turnero Sala', 'queue')}\n                </nav>\n                <footer class="sidebar-footer">\n                    <button type="button" class="logout-btn" data-action="logout">${C('logout')}<span>Cerrar sesion</span></button>\n                </footer>\n            </aside>\n            <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n            <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n                <header class="admin-v3-topbar">\n                    <div class="admin-v3-topbar__copy">\n                        <p class="sony-kicker">Sony V3</p>\n                        <h2 id="pageTitle">Dashboard</h2>\n                    </div>\n                    <div class="admin-v3-topbar__actions">\n                        <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${C('menu')}<span>Menu</span></button>\n                        <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                        <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                        <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${C('sun')}</button>\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${C('moon')}</button>\n                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${C('system')}</button>\n                        </div>\n                    </div>\n                </header>\n\n                <section class="admin-v3-context-strip" id="adminProductivityStrip">\n                    <div class="admin-v3-context-copy" data-admin-section-hero>\n                        <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                        <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                        <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="admin-v3-status-rail" data-admin-priority-rail>\n                        <article class="sony-status-tile">\n                            <span>Push</span>\n                            <strong id="pushStatusIndicator">Inicializando</strong>\n                            <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                        </article>\n                        <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                            <span>Sesion</span>\n                            <strong id="adminSessionState">No autenticada</strong>\n                            <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                        </article>\n                        <article class="sony-status-tile">\n                            <span>Sincronizacion</span>\n                            <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                            <small id="adminSyncState">Listo para primera sincronizacion</small>\n                        </article>\n                    </div>\n                </section>\n\n                \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Resumen diario</p>\n                        <h3>Prioridades de hoy</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n\n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda clinica</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n\n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">SLA telefonico</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n\n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n\n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n\n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n            </main>\n\n            <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n                <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n                <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                    <div class="admin-command-dialog__head">\n                        <div>\n                            <p class="sony-kicker">Command Palette</p>\n                            <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                        </div>\n                        <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                    </div>\n                    <div class="admin-command-box">\n                        <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                        <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                    </div>\n                    <div class="admin-command-dialog__hints">\n                        <span>Ctrl+K abre esta paleta</span>\n                        <span>/ enfoca la busqueda de la seccion activa</span>\n                    </div>\n                </div>\n            </div>\n        </div>\n    `));
    })(),
        (function () {
            const t = e('#adminMainContent');
            (t instanceof HTMLElement &&
                t.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(H).forEach(([t, e]) => {
                    (F(t, e.hero, 'data-admin-section-hero'),
                        F(t, e.priority, 'data-admin-priority-rail'),
                        F(t, e.workbench, 'data-admin-workbench'),
                        F(t, e.detail, 'data-admin-detail-rail'));
                }));
        })(),
        document.body.classList.add('admin-v3-mode'),
        document.body.classList.remove('admin-v2-mode'),
        document.addEventListener('click', async (t) => {
            const e =
                t.target instanceof Element
                    ? t.target.closest('[data-action]')
                    : null;
            if (!e) return;
            const a = String(e.getAttribute('data-action') || '');
            if (a) {
                t.preventDefault();
                try {
                    await (async function (t, e) {
                        const a = [cn, Pa, on, Ia, rn, sn];
                        for (const n of a) if (await n(t, e)) return !0;
                        return !1;
                    })(a, e);
                } catch (t) {
                    s(t?.message || 'Error ejecutando accion', 'error');
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
            if (!a && !n) return;
            t.preventDefault();
            const i = await Ja(
                String(e.getAttribute('data-section') || 'dashboard')
            );
            Qa() && !1 !== i && Xa();
        }),
        document.addEventListener('click', (t) => {
            const e =
                t.target instanceof Element
                    ? t.target.closest('[data-queue-filter]')
                    : null;
            e &&
                (t.preventDefault(),
                We(String(e.getAttribute('data-queue-filter') || 'all')));
        }),
        (function () {
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const e = document.getElementById('callbacksBulkClearBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-clear');
            const a = document.getElementById('callbacksBulkMarkBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = j,
                e = z;
            try {
                ((t = JSON.parse(localStorage.getItem(O) || `"${j}"`)),
                    (e = JSON.parse(localStorage.getItem(R) || `"${z}"`)));
            } catch (t) {}
            g((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof t ? t : j,
                    density: 'string' == typeof e ? e : z,
                },
            }));
        })(),
        (function () {
            let t = 'all',
                e = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(pt) || '"all"')),
                    (e = JSON.parse(
                        localStorage.getItem(dt) || '"recent_desc"'
                    )));
            } catch (t) {}
            g((a) => ({
                ...a,
                callbacks: { ...a.callbacks, filter: ft(t), sort: ht(e) },
            }));
        })(),
        (function () {
            let t = '',
                e = '';
            try {
                ((t = String(localStorage.getItem(Lt) || '')),
                    (e = String(localStorage.getItem(Et) || '')));
            } catch (t) {}
            const a = Bt(t),
                n = Ft(e, a);
            g((t) => ({
                ...t,
                availability: {
                    ...t.availability,
                    ...(a ? { selectedDate: a } : {}),
                    monthAnchor: n,
                },
            }));
        })(),
        (function () {
            const t = Fa(fe(za, 'dashboard')),
                e = '1' === fe(Va, '0');
            (g((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                E(t),
                Oa(t),
                Wa());
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === ae(fe(we, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(fe(Se, '1')) ? 2 : 1,
                    oneTap: '1' === fe(Ce, '0'),
                    helpOpen: '1' === fe(Ae, '0'),
                    customCallKey: ye(qe, null),
                },
                e = ae(ke('station')),
                a = ae(ke('lock')),
                n = ae(ke('one_tap')),
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
            (g((e) => ({
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
                _e(b()));
        })(),
        Ua(
            (function () {
                const t = String(fe(Ra, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return ja.has(t) ? t : 'system';
            })()
        ),
        Ba(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    rt(t.value);
                });
            const e = document.getElementById('appointmentSort');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    st({ sort: V(e.value) || j });
                });
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    ct(a.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    $t(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Tt({ sort: ht(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value),
                        Tt({ search: String(t || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        Ge({ search: String(t || ''), selected: [] }));
                });
            const r = document.getElementById('adminQuickCommand');
            var c;
            r instanceof HTMLInputElement &&
                (c = r).addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = nn(c.value);
                    e && (await an(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                a = e('#adminMenuClose'),
                n = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                Qa() ? Za() : Ya();
            }),
                a?.addEventListener('click', () => Xa({ restoreFocus: !0 })),
                n?.addEventListener('click', () => Xa({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    Qa() ? Wa() : Xa();
                }),
                document.addEventListener('keydown', (t) => {
                    if (!Qa() || !b().ui.sidebarOpen) return;
                    if ('Escape' === t.key)
                        return (
                            t.preventDefault(),
                            void Xa({ restoreFocus: !0 })
                        );
                    if ('Tab' !== t.key) return;
                    const a = (function () {
                        const t = e('#adminSidebar');
                        if (!(t instanceof HTMLElement)) return [];
                        const a = e('#adminMenuClose'),
                            n = t.querySelector(
                                '.nav-item.active[data-section]'
                            ),
                            i = Array.from(
                                t.querySelectorAll('.nav-item[data-section]')
                            ).filter((t) => t !== n),
                            o = t.querySelector('.logout-btn');
                        return [a, n, ...i, o].filter(Ga);
                    })();
                    if (!a.length) return;
                    const n = a.indexOf(document.activeElement);
                    t.shiftKey
                        ? 0 === n &&
                          (t.preventDefault(), a[a.length - 1].focus())
                        : (-1 !== n && n !== a.length - 1) ||
                          (t.preventDefault(), a[0].focus());
                }),
                window.addEventListener('hashchange', async () => {
                    const t = (function (t = 'dashboard') {
                        return Fa(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(b().ui.activeSection);
                    await Ja(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && Ua(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            te() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const t = document.getElementById('loginForm');
    (t instanceof HTMLFormElement && t.addEventListener('submit', xa),
        (function (t) {
            const {
                navigateToSection: e,
                focusQuickCommand: a,
                focusCurrentSearch: n,
                runQuickAction: i,
                closeSidebar: o,
                toggleMenu: s,
                dismissQueueSensitiveDialog: r,
                toggleQueueHelp: c,
                queueNumpadAction: u,
            } = t;
            window.addEventListener('keydown', (t) => {
                const d = String(t.key || '').toLowerCase(),
                    p = String(t.code || '').toLowerCase();
                if ('Escape' === t.key) {
                    if ('function' == typeof r && r()) return;
                    return void o();
                }
                if (t.ctrlKey && !t.shiftKey && !t.altKey && 'k' === d)
                    return (t.preventDefault(), void a());
                if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
                    return (t.preventDefault(), void n());
                if (t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey) {
                    const a = p || d;
                    if ('keym' === a) return (t.preventDefault(), void s());
                    if ('digit0' === a) return (t.preventDefault(), void c());
                    if (f[a]) {
                        if (l()) return;
                        return (t.preventDefault(), void e(f[a]));
                    }
                    const n = {
                        keyt: 'appointments_pending_transfer',
                        keya: 'appointments_all',
                        keyn: 'appointments_no_show',
                        keyp: 'callbacks_pending',
                        keyc: 'callbacks_contacted',
                        keyu: 'callbacks_sla_urgent',
                        keyw: 'queue_sla_risk',
                        keyl: 'queue_call_next',
                    };
                    if (
                        ('queue' === b().ui.activeSection &&
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
                const m = b().queue,
                    g = Boolean(m.captureCallKeyMode),
                    h = m.customCallKey,
                    y =
                        h &&
                        'object' == typeof h &&
                        String(h.key || '') === String(t.key || '') &&
                        String(h.code || '').toLowerCase() === p &&
                        Number(h.location || 0) === Number(t.location || 0);
                if (
                    p.startsWith('numpad') ||
                    3 === t.location ||
                    ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(
                        p
                    ) ||
                    g ||
                    y
                ) {
                    if (l()) return;
                    Promise.resolve(
                        u({ key: t.key, code: t.code, location: t.location })
                    ).catch(() => {});
                }
            });
        })({
            navigateToSection: Ja,
            focusQuickCommand: tn,
            focusCurrentSearch: en,
            runQuickAction: an,
            closeSidebar: () => Xa({ restoreFocus: !0 }),
            toggleMenu: () => {
                Qa() ? Za() : Ya();
            },
            dismissQueueSensitiveDialog: ia,
            toggleQueueHelp: () => sa(),
            queueNumpadAction: ca,
        }));
    const a = await (async function () {
        try {
            const t = await w('status'),
                e = !0 === t.authenticated,
                a = e ? String(t.csrfToken || '') : '';
            return (
                v(a),
                g((t) => ({
                    ...t,
                    auth: {
                        ...t.auth,
                        authenticated: e,
                        csrfToken: a,
                        requires2FA: !1,
                        lastAuthAt: e ? Date.now() : 0,
                        authMethod: e ? 'session' : '',
                    },
                })),
                e
            );
        } catch (t) {
            return !1;
        }
    })();
    (a
        ? (await (async function () {
              ($(), L(), await Da(!1));
          })(),
          E(b().ui.activeSection))
        : (T(), L(), Ba()),
        (async function () {
            const t = (function () {
                const t = 'Notification' in window,
                    e = 'serviceWorker' in navigator,
                    a = 'PushManager' in window;
                if (!t)
                    return {
                        tone: 'neutral',
                        label: 'Push no disponible',
                        meta: 'Este navegador no soporta notificaciones.',
                    };
                const n = String(Notification.permission || 'default');
                return 'granted' === n
                    ? {
                          tone: 'success',
                          label: e && a ? 'Push listo' : 'Push parcial',
                          meta:
                              e && a
                                  ? 'Permisos concedidos y APIs disponibles.'
                                  : 'Permiso otorgado, pero faltan APIs del navegador.',
                      }
                    : 'denied' === n
                      ? {
                            tone: 'danger',
                            label: 'Push bloqueado',
                            meta: 'El navegador rechazo permisos de notificacion.',
                        }
                      : {
                            tone: 'warning',
                            label: 'Push pendiente',
                            meta: 'La sesion aun no concede permisos.',
                        };
            })();
            (['pushStatusIndicator', 'dashboardPushStatus'].forEach((e) => {
                const a = document.getElementById(e);
                a &&
                    (a.setAttribute('data-state', t.tone), r(`#${e}`, t.label));
            }),
                ['pushStatusMeta', 'dashboardPushMeta'].forEach((e) => {
                    document.getElementById(e) && r(`#${e}`, t.meta);
                }));
        })(),
        window.setInterval(() => {
            Na();
        }, 3e4));
}
const un = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      ln().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : ln()
).catch((t) => {
    throw (console.error('admin-v3 boot failed', t), t);
});
export { un as default };
