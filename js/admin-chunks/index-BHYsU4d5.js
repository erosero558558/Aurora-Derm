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
function n(t, e = document) {
    return Array.from(e.querySelectorAll(t));
}
function a(t) {
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
function s(n, a = 'info') {
    const i = e('#toastContainer');
    if (!(i instanceof HTMLElement)) return;
    const o = document.createElement('div');
    ((o.className = `toast ${a}`),
        o.setAttribute('role', 'error' === a ? 'alert' : 'status'),
        (o.innerHTML = `\n        <div class="toast-body">${t(n)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        i.appendChild(o),
        window.setTimeout(() => {
            o.parentElement && o.remove();
        }, 4500));
}
function r(t, n) {
    const a = e(t);
    a && (a.textContent = String(n ?? ''));
}
function c(t, n) {
    const a = e(t);
    a && (a.innerHTML = n);
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
    const n = String(e.method || 'GET').toUpperCase(),
        a = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== n && h && (a.headers['X-CSRF-Token'] = h),
        void 0 !== e.body &&
            ((a.headers['Content-Type'] = 'application/json'),
            (a.body = JSON.stringify(e.body))));
    const i = await fetch(t, a),
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
function q(t) {
    return `\n        <div class="sony-theme-switcher ${t}" role="group" aria-label="Tema">\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${C('sun')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${C('moon')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${C('system')}</button>\n        </div>\n    `;
}
function A(t, e, n, a = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${a ? ' active' : ''}"\n            data-section="${t}"\n            ${a ? 'aria-current="page"' : ''}\n        >\n            ${C(n)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function M() {
    const t = e('#loginScreen'),
        n = e('#adminDashboard');
    if (!(t instanceof HTMLElement && n instanceof HTMLElement))
        throw new Error('Contenedores admin no encontrados');
    ((t.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                ${q('login-theme-bar')}\n            </section>\n        </div>\n    `),
        (n.innerHTML = `\n        <div class="admin-v3-shell">\n            <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n                <header class="sidebar-header">\n                    <div class="admin-v3-sidebar__brand">\n                        <strong>Piel en Armonia</strong>\n                        <small>Admin sony_v3</small>\n                    </div>\n                    <div class="toolbar-group">\n                        <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${C('menu')}</button>\n                        <button type="button" id="adminMenuClose">Cerrar</button>\n                    </div>\n                </header>\n                <nav class="sidebar-nav" id="adminSidebarNav">\n                    \n        ${A('dashboard', 'Dashboard', 'dashboard', !0)}\n        ${A('appointments', 'Citas', 'appointments')}\n        ${A('callbacks', 'Callbacks', 'callbacks')}\n        ${A('reviews', 'Resenas', 'reviews')}\n        ${A('availability', 'Disponibilidad', 'availability')}\n        ${A('queue', 'Turnero Sala', 'queue')}\n    \n                </nav>\n                <footer class="sidebar-footer">\n                    <button type="button" class="logout-btn" data-action="logout">${C('logout')}<span>Cerrar sesion</span></button>\n                </footer>\n            </aside>\n            <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n\n            <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n                <header class="admin-v3-topbar">\n                    <div class="admin-v3-topbar__copy">\n                        <p class="sony-kicker">Sony V3</p>\n                        <h2 id="pageTitle">Dashboard</h2>\n                    </div>\n                    <div class="admin-v3-topbar__actions">\n                        <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${C('menu')}<span>Menu</span></button>\n                        <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                        <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                        ${q('admin-theme-switcher-header')}\n                    </div>\n                </header>\n\n                <section class="admin-v3-context-strip" id="adminProductivityStrip">\n                    <div class="admin-v3-context-copy" data-admin-section-hero>\n                        <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                        <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                        <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                        <div id="adminContextActions" class="sony-context-actions"></div>\n                    </div>\n                    <div class="admin-v3-status-rail" data-admin-priority-rail>\n                        <article class="sony-status-tile">\n                            <span>Push</span>\n                            <strong id="pushStatusIndicator">Inicializando</strong>\n                            <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                        </article>\n                        <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                            <span>Sesion</span>\n                            <strong id="adminSessionState">No autenticada</strong>\n                            <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                        </article>\n                        <article class="sony-status-tile">\n                            <span>Sincronizacion</span>\n                            <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                            <small id="adminSyncState">Listo para primera sincronizacion</small>\n                        </article>\n                    </div>\n                </section>\n\n                \n        \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                <article class="sony-panel dashboard-hero-panel">\n                    <div class="dashboard-hero-copy">\n                        <p class="sony-kicker">Resumen diario</p>\n                        <h3>Prioridades de hoy</h3>\n                        <p id="dashboardHeroSummary">\n                            Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                        </p>\n                    </div>\n                    <div class="dashboard-hero-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n                    </div>\n                    <div class="dashboard-hero-metrics">\n                        <div class="dashboard-hero-metric">\n                            <span>Rating</span>\n                            <strong id="dashboardHeroRating">0.0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Resenas 30d</span>\n                            <strong id="dashboardHeroRecentReviews">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Urgentes SLA</span>\n                            <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                        </div>\n                        <div class="dashboard-hero-metric">\n                            <span>Transferencias</span>\n                            <strong id="dashboardHeroPendingTransfers">0</strong>\n                        </div>\n                    </div>\n                </article>\n\n                <article class="sony-panel dashboard-signal-panel">\n                    <header>\n                        <div>\n                            <h3>Señal operativa</h3>\n                            <small id="operationRefreshSignal">Tiempo real</small>\n                        </div>\n                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n                    </header>\n                    <p id="dashboardLiveMeta">\n                        Sin alertas criticas en la operacion actual.\n                    </p>\n                    <div class="dashboard-signal-stack">\n                        <article class="dashboard-signal-card">\n                            <span>Push</span>\n                            <strong id="dashboardPushStatus">Sin validar</strong>\n                            <small id="dashboardPushMeta">Permisos del navegador</small>\n                        </article>\n                        <article class="dashboard-signal-card">\n                            <span>Atencion</span>\n                            <strong id="dashboardQueueHealth">Cola: estable</strong>\n                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                        </article>\n                    </div>\n                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-kpi">\n                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>\n                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n            </div>\n\n            <div class="sony-grid sony-grid-two">\n                <article class="sony-panel dashboard-card-operations">\n                    <header>\n                        <h3>Centro operativo</h3>\n                        <small id="operationDeckMeta">Prioridades y acciones</small>\n                    </header>\n                    <div class="sony-panel-stats">\n                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                    </div>\n                    <p id="operationQueueHealth">Cola: estable</p>\n                    <div id="operationActionList" class="operations-action-list"></div>\n                </article>\n\n                <article class="sony-panel" id="funnelSummary">\n                    <header><h3>Embudo</h3></header>\n                    <div class="sony-panel-stats">\n                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                    </div>\n                </article>\n            </div>\n\n            <div class="sony-grid sony-grid-three">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n    \n        \n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                <article class="sony-panel appointments-command-deck">\n                    <header class="section-header appointments-command-head">\n                        <div>\n                            <p class="sony-kicker">Agenda clinica</p>\n                            <h3>Citas</h3>\n                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                        </div>\n                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n                    </header>\n                    <div class="appointments-ops-grid">\n                        <article class="appointments-ops-card tone-warning">\n                            <span>Transferencias</span>\n                            <strong id="appointmentsOpsPendingTransfer">0</strong>\n                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                        </article>\n                        <article class="appointments-ops-card tone-neutral">\n                            <span>Proximas 48h</span>\n                            <strong id="appointmentsOpsUpcomingCount">0</strong>\n                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                        </article>\n                        <article class="appointments-ops-card tone-danger">\n                            <span>No show</span>\n                            <strong id="appointmentsOpsNoShowCount">0</strong>\n                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                        </article>\n                        <article class="appointments-ops-card tone-success">\n                            <span>Hoy</span>\n                            <strong id="appointmentsOpsTodayCount">0</strong>\n                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                        </article>\n                    </div>\n                    <div class="appointments-command-actions">\n                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel appointments-focus-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                        </div>\n                    </header>\n                    <div class="appointments-focus-grid">\n                        <div class="appointments-focus-stat">\n                            <span>Siguiente ventana</span>\n                            <strong id="appointmentsFocusWindow">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Pago</span>\n                            <strong id="appointmentsFocusPayment">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Estado</span>\n                            <strong id="appointmentsFocusStatus">-</strong>\n                        </div>\n                        <div class="appointments-focus-stat">\n                            <span>Contacto</span>\n                            <strong id="appointmentsFocusContact">-</strong>\n                        </div>\n                    </div>\n                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n                </article>\n            </div>\n\n            <div class="sony-panel appointments-workbench">\n                <header class="section-header appointments-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                    </div>\n                    <div class="toolbar-group" id="appointmentsDensityToggle">\n                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                    </div>\n                </div>\n                <div class="toolbar-row appointments-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro</span>\n                        <select id="appointmentFilter">\n                            <option value="all">Todas</option>\n                            <option value="pending_transfer">Transferencias por validar</option>\n                            <option value="upcoming_48h">Proximas 48h</option>\n                            <option value="no_show">No show</option>\n                            <option value="triage_attention">Triage accionable</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden</span>\n                        <select id="appointmentSort">\n                            <option value="datetime_desc">Fecha reciente</option>\n                            <option value="datetime_asc">Fecha ascendente</option>\n                            <option value="patient_az">Paciente (A-Z)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                    <p id="appointmentsToolbarState">Sin filtros activos</p>\n                </div>\n\n                <div class="table-scroll appointments-table-shell">\n                    <table id="appointmentsTable" class="sony-table">\n                        <thead>\n                            <tr>\n                                <th>Paciente</th>\n                                <th>Servicio</th>\n                                <th>Fecha</th>\n                                <th>Pago</th>\n                                <th>Estado</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="appointmentsTableBody"></tbody>\n                    </table>\n                </div>\n            </div>\n        </section>\n    \n        \n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                <article class="sony-panel callbacks-command-deck">\n                    <header class="section-header callbacks-command-head">\n                        <div>\n                            <p class="sony-kicker">SLA telefonico</p>\n                            <h3>Callbacks</h3>\n                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                        </div>\n                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n                    </header>\n                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n                    </div>\n                    <div class="callbacks-command-actions">\n                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n                    </div>\n                </article>\n\n                <article class="sony-panel callbacks-next-panel">\n                    <header class="section-header">\n                        <div>\n                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                            <h3 id="callbacksOpsNext">Sin telefono</h3>\n                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                        </div>\n                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n                    </header>\n                    <div class="callbacks-next-grid">\n                        <div class="callbacks-next-stat">\n                            <span>Espera</span>\n                            <strong id="callbacksNextWait">0 min</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Preferencia</span>\n                            <strong id="callbacksNextPreference">-</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Estado</span>\n                            <strong id="callbacksNextState">Pendiente</strong>\n                        </div>\n                        <div class="callbacks-next-stat">\n                            <span>Ultimo corte</span>\n                            <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                        </div>\n                    </div>\n                </article>\n            </div>\n            <div class="sony-panel callbacks-workbench">\n                <header class="section-header callbacks-workbench-head">\n                    <div>\n                        <h3>Workbench</h3>\n                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                    </div>\n                </header>\n                <div class="toolbar-row">\n                    <div class="toolbar-group">\n                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                    </div>\n                </div>\n                <div class="toolbar-row callbacks-toolbar">\n                    <label>\n                        <span class="sr-only">Filtro callbacks</span>\n                        <select id="callbackFilter">\n                            <option value="all">Todos</option>\n                            <option value="pending">Pendientes</option>\n                            <option value="contacted">Contactados</option>\n                            <option value="today">Hoy</option>\n                            <option value="sla_urgent">Urgentes SLA</option>\n                        </select>\n                    </label>\n                    <label>\n                        <span class="sr-only">Orden callbacks</span>\n                        <select id="callbackSort">\n                            <option value="recent_desc">Mas recientes</option>\n                            <option value="waiting_desc">Mayor espera (SLA)</option>\n                        </select>\n                    </label>\n                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n                </div>\n                <div class="toolbar-row slim">\n                    <p id="callbacksToolbarMeta">Mostrando 0</p>\n                    <p id="callbacksToolbarState">Sin filtros activos</p>\n                </div>\n                <div id="callbacksGrid" class="callbacks-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n    \n        \n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                <header class="section-header">\n                    <h3>Turnero Sala</h3>\n                    <div class="queue-admin-header-actions">\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                        <button type="button" data-action="queue-refresh-state">Refrescar</button>\n                    </div>\n                </header>\n\n                <div class="sony-grid sony-grid-kpi slim">\n                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n                </div>\n\n                <div id="queueStationControl" class="toolbar-row">\n                    <span id="queueStationBadge">Estacion: libre</span>\n                    <span id="queueStationModeBadge">Modo: free</span>\n                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n                    <button type="button" data-action="queue-stop-practice">Salir practica</button>\n                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n                </div>\n\n                <div id="queueShortcutPanel" hidden>\n                    <p>Numpad Enter llama siguiente.</p>\n                    <p>Numpad Decimal prepara completar.</p>\n                    <p>Numpad Subtract prepara no_show.</p>\n                </div>\n\n                <div id="queueTriageToolbar" class="toolbar-row">\n                    <button type="button" data-queue-filter="all">Todo</button>\n                    <button type="button" data-queue-filter="called">Llamados</button>\n                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n                    <button type="button" data-action="queue-clear-search">Limpiar</button>\n                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n                </div>\n\n                <div class="toolbar-row slim">\n                    <p id="queueTriageSummary">Sin riesgo</p>\n                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n                </div>\n\n                <ul id="queueNextAdminList" class="sony-list"></ul>\n\n                <div class="table-scroll">\n                    <table class="sony-table queue-admin-table">\n                        <thead>\n                            <tr>\n                                <th>Sel</th>\n                                <th>Ticket</th>\n                                <th>Tipo</th>\n                                <th>Estado</th>\n                                <th>Consultorio</th>\n                                <th>Espera</th>\n                                <th>Acciones</th>\n                            </tr>\n                        </thead>\n                        <tbody id="queueTableBody"></tbody>\n                    </table>\n                </div>\n\n                <div id="queueActivityPanel" class="sony-panel soft">\n                    <h4>Actividad</h4>\n                    <ul id="queueActivityList" class="sony-list"></ul>\n                </div>\n            </div>\n\n            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n                <form method="dialog">\n                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                    <div class="toolbar-group">\n                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                    </div>\n                </form>\n            </dialog>\n        </section>\n    \n    \n            </main>\n\n            <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n                <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n                <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                    <div class="admin-command-dialog__head">\n                        <div>\n                            <p class="sony-kicker">Command Palette</p>\n                            <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                        </div>\n                        <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                    </div>\n                    <div class="admin-command-box">\n                        <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                        <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                    </div>\n                    <div class="admin-command-dialog__hints">\n                        <span>Ctrl+K abre esta paleta</span>\n                        <span>/ enfoca la busqueda de la seccion activa</span>\n                    </div>\n                </div>\n            </div>\n        </div>\n    `));
}
const T = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    },
    $ = {
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
function _() {
    const t = e('#loginScreen'),
        n = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), n && n.classList.add('is-hidden'));
}
function L() {
    const t = e('#loginScreen'),
        n = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), n && n.classList.remove('is-hidden'));
}
function E() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.remove('is-hidden'),
        t.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function N() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.add('is-hidden'),
        t.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function D(t) {
    (n('.admin-section').forEach((e) => {
        e.classList.toggle('active', e.id === t);
    }),
        n('.nav-item[data-section]').forEach((e) => {
            const n = e.dataset.section === t;
            (e.classList.toggle('active', n),
                n
                    ? e.setAttribute('aria-current', 'page')
                    : e.removeAttribute('aria-current'));
        }),
        n('.admin-quick-nav-item[data-section]').forEach((e) => {
            const n = e.dataset.section === t;
            (e.classList.toggle('active', n),
                e.setAttribute('aria-pressed', String(n)));
        }));
    const a = T[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = a);
}
function B(t) {
    const n = e('#group2FA'),
        a = e('#adminLoginStepSummary'),
        i = e('#adminLoginStepEyebrow'),
        o = e('#adminLoginStepTitle'),
        s = e('#adminLoginSupportCopy'),
        r = e('#loginReset2FABtn'),
        c = e('#loginForm');
    n &&
        (n.classList.toggle('is-hidden', !t),
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
        a &&
            (a.textContent = t
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        s &&
            (s.textContent = t
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        P(!1));
}
function x({
    tone: t = 'neutral',
    title: n = 'Proteccion activa',
    message: a = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = e('#adminLoginStatusCard'),
        o = e('#adminLoginStatusTitle'),
        s = e('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', t),
        o && (o.textContent = n),
        s && (s.textContent = a));
}
function P(t) {
    const n = e('#loginBtn'),
        a = e('#loginReset2FABtn'),
        i = e('#adminPassword'),
        o = e('#admin2FACode'),
        s = e('#group2FA'),
        r = Boolean(s && !s.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(t) || r),
        o instanceof HTMLInputElement && (o.disabled = Boolean(t) || !r),
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(t)),
            (n.textContent = t
                ? r
                    ? 'Verificando...'
                    : 'Ingresando...'
                : r
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        a instanceof HTMLButtonElement && (a.disabled = Boolean(t)));
}
function I({ clearPassword: t = !1 } = {}) {
    const n = e('#adminPassword'),
        a = e('#admin2FACode');
    (n instanceof HTMLInputElement && t && (n.value = ''),
        a instanceof HTMLInputElement && (a.value = ''));
}
function H(t = 'password') {
    const n = e('2fa' === t ? '#admin2FACode' : '#adminPassword');
    n instanceof HTMLInputElement && (n.focus(), n.select?.());
}
function F(n) {
    const a = $[n?.ui?.activeSection || 'dashboard'] || $.dashboard,
        i = n?.auth && 'object' == typeof n.auth ? n.auth : {},
        o = Array.isArray(n?.data?.appointments) ? n.data.appointments : [],
        s = Array.isArray(n?.data?.callbacks) ? n.data.callbacks : [],
        l = Array.isArray(n?.data?.reviews) ? n.data.reviews : [],
        u =
            n?.data?.availability && 'object' == typeof n.data.availability
                ? n.data.availability
                : {},
        d = Array.isArray(n?.data?.queueTickets) ? n.data.queueTickets : [],
        p =
            n?.data?.queueMeta && 'object' == typeof n.data.queueMeta
                ? n.data.queueMeta
                : null;
    (r('#adminSectionEyebrow', a.eyebrow),
        r('#adminContextTitle', a.title),
        r('#adminContextSummary', a.summary),
        c(
            '#adminContextActions',
            a.actions
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
            })(n?.ui?.lastRefreshAt || 0)
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
                        n = Number(e.lastAuthAt || 0);
                    return n
                        ? `Protegida por ${t}. ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : `Protegida por ${t}.`;
                }
                return e.requires2FA
                    ? 'Esperando codigo de seis digitos para completar el acceso.'
                    : 'Autenticate para operar el panel.';
            })(i)
        ));
}
const R = {
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
function O(t, n, a) {
    if (!n) return;
    const i = e(`#${t}`);
    if (!(i instanceof HTMLElement)) return;
    const o = i.querySelector(n);
    o instanceof HTMLElement && o.setAttribute(a, 'true');
}
const j = 'admin-appointments-sort',
    z = 'admin-appointments-density',
    V = 'datetime_desc',
    U = 'comfortable';
function K(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Q(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function G(t) {
    return K(t.paymentStatus || t.payment_status || '');
}
function W(t) {
    return K(t);
}
function J(t, e = '-') {
    const n = String(t || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return n
        ? n
              .split(/\s+/)
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ')
        : e;
}
function Y(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[K(t)] || J(t, 'Pendiente')
    );
}
function Z(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[K(t)] || J(t, 'Pendiente')
    );
}
function X(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        n = Math.abs(e);
    return e < 0
        ? n < 60
            ? `Hace ${n} min`
            : n < 1440
              ? `Hace ${Math.round(n / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function tt(t) {
    const e = Q(t);
    if (!e) return !1;
    const n = new Date(e),
        a = new Date();
    return (
        n.getFullYear() === a.getFullYear() &&
        n.getMonth() === a.getMonth() &&
        n.getDate() === a.getDate()
    );
}
function et(t) {
    const e = Q(t);
    if (!e) return !1;
    const n = e - Date.now();
    return n >= 0 && n <= 1728e5;
}
function nt(t) {
    const e = G(t),
        n = W(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === n ||
        'cancelled' === n
    );
}
function at(t, e) {
    const n = K(e);
    return 'pending_transfer' === n
        ? t.filter((t) => {
              const e = G(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === n
          ? t.filter(et)
          : 'no_show' === n
            ? t.filter((t) => 'no_show' === W(t.status))
            : 'triage_attention' === n
              ? t.filter(nt)
              : t;
}
function it(t) {
    const e = G(t),
        n = W(t.status),
        a = Q(t);
    return 'pending_transfer_review' === e || 'pending_transfer' === e
        ? {
              label: 'Transferencia',
              tone: 'warning',
              note: 'No liberar hasta validar pago.',
          }
        : 'no_show' === n
          ? {
                label: 'No show',
                tone: 'danger',
                note: 'Requiere seguimiento o cierre.',
            }
          : 'cancelled' === n
            ? {
                  label: 'Cancelada',
                  tone: 'danger',
                  note: 'Bloqueo operativo cerrado.',
              }
            : tt(t)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: a ? X(a) : 'Agenda del dia',
                }
              : et(t)
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
function ot(t) {
    const e = t
            .map((t) => ({ item: t, stamp: Q(t) }))
            .sort((t, e) => t.stamp - e.stamp),
        n = e.find(({ item: t }) => {
            const e = G(t);
            return 'pending_transfer_review' === e || 'pending_transfer' === e;
        });
    if (n)
        return {
            item: n.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const a = e.find(({ item: t }) => 'no_show' === W(t.status));
    if (a)
        return {
            item: a.item,
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
function st(e) {
    return e.length
        ? e
              .map((e) => {
                  const n = Q(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">${(function (
                      e
                  ) {
                      const n = it(e);
                      return `\n        <div class="appointment-service">\n            <strong>${t(J(e.service, 'Servicio pendiente'))}</strong>\n            <span>Especialista: ${t(J(e.doctor, 'Sin asignar'))}</span>\n            <small>${t(n.label)} | ${t(n.note)}</small>\n        </div>\n    `;
                  })(
                      e
                  )}</td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(a(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(X(n))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      e
                  ) {
                      const n = e.paymentStatus || e.payment_status || '',
                          a = String(
                              e.transferProofUrl ||
                                  e.transferProofURL ||
                                  e.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${t(
                          (function (t) {
                              const e = K(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(n)
                      )}">${t(Y(n))}</span>\n            <small>Metodo: ${t(((i = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[K(i)] || J(i, 'Metodo pendiente')))}</small>\n            ${a ? `<a href="${t(a)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const n = W(e.status),
                          a = G(e),
                          i = it(e),
                          o = [];
                      return (
                          'pending_transfer_review' === a &&
                              o.push('Transferencia por validar'),
                          'no_show' === n && o.push('Paciente ausente'),
                          'cancelled' === n && o.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${t(
                              (function (t) {
                                  const e = K(t);
                                  return 'completed' === e
                                      ? 'success'
                                      : 'cancelled' === e || 'no_show' === e
                                        ? 'danger'
                                        : 'pending' === e
                                          ? 'warning'
                                          : 'neutral';
                              })(n)
                          )}">${t(Z(n))}</span>\n            <small>${t(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const n = Number(e.id || 0),
                          a = G(e),
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
                          ('pending_transfer_review' !== a &&
                              'pending_transfer' !== a) ||
                              (o.push(
                                  `<button type="button" data-action="approve-transfer" data-id="${n}">Aprobar</button>`
                              ),
                              o.push(
                                  `<button type="button" data-action="reject-transfer" data-id="${n}">Rechazar</button>`
                              )),
                          o.push(
                              `<button type="button" data-action="mark-no-show" data-id="${n}">No show</button>`
                          ),
                          o.push(
                              `<button type="button" data-action="cancel-appointment" data-id="${n}">Cancelar</button>`
                          ),
                          `<div class="table-actions">${o.join('')}</div>`
                      );
                  })(e)}</td>\n                </tr>\n            `;
              })
              .join('')
        : `<tr class="table-empty-row"><td colspan="6">${t('No hay citas para el filtro actual.')}</td></tr>`;
}
function rt() {
    const e = b(),
        n = Array.isArray(e?.data?.appointments) ? e.data.appointments : [],
        i = e?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (t, e) {
            const n = K(e),
                a = [...t];
            return 'patient_az' === n
                ? (a.sort((t, e) => K(t.name).localeCompare(K(e.name), 'es')),
                  a)
                : 'datetime_asc' === n
                  ? (a.sort((t, e) => Q(t) - Q(e)), a)
                  : (a.sort((t, e) => Q(e) - Q(t)), a);
        })(
            (function (t, e) {
                const n = K(e);
                return n
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
                          ].some((t) => K(t).includes(n))
                      )
                    : t;
            })(at(n, i.filter), i.search),
            i.sort
        );
    (c('#appointmentsTableBody', st(o)),
        (function (t, e, n) {
            (r('#appointmentsToolbarMeta', `Mostrando ${e} de ${n}`),
                r(
                    '#appointmentsToolbarState',
                    (function (t, e) {
                        const n = [];
                        if ('all' !== K(t.filter)) {
                            const e = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            n.push(e[K(t.filter)] || t.filter);
                        }
                        return (
                            K(t.search) && n.push(`Busqueda: ${t.search}`),
                            'patient_az' === K(t.sort)
                                ? n.push('Paciente (A-Z)')
                                : 'datetime_asc' === K(t.sort)
                                  ? n.push('Fecha ascendente')
                                  : n.push('Fecha reciente'),
                            0 === e && n.push('Resultados: 0'),
                            n
                        );
                    })(t, e).join(' | ')
                ));
            const a = document.getElementById('clearAppointmentsFiltersBtn');
            if (a) {
                const e = 'all' !== K(t.filter) || '' !== K(t.search);
                a.classList.toggle('is-hidden', !e);
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
                    'compact' === K(t.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((e) => {
                        const n = K(e.dataset.density) === K(t.density);
                        e.classList.toggle('is-active', n);
                    }),
                (function (t) {
                    const e = K(t);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const n = K(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', n);
                        });
                })(t.filter),
                (function (t) {
                    try {
                        (localStorage.setItem(j, JSON.stringify(t.sort)),
                            localStorage.setItem(z, JSON.stringify(t.density)));
                    } catch (t) {}
                })(t));
        })(i, o.length, n.length),
        (function (e, n, i) {
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
                        ? `${e.pendingTransferCount} transferencia(s), ${e.triageCount} frente(s) accionables y ${n} cita(s) visibles.`
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
                    `${J(l.service, 'Servicio pendiente')} | ${a(l.date)} ${l.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', X(Q(l))),
                r(
                    '#appointmentsFocusPayment',
                    Y(l.paymentStatus || l.payment_status)
                ),
                r('#appointmentsFocusStatus', Z(l.status)),
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
                const e = at(t, 'pending_transfer'),
                    n = at(t, 'upcoming_48h'),
                    a = at(t, 'no_show'),
                    i = at(t, 'triage_attention'),
                    o = t.filter(tt);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: n.length,
                    noShowCount: a.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: ot(t),
                };
            })(n),
            o.length,
            n.length
        ));
}
function ct(t) {
    (g((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), rt());
}
function lt(t) {
    ct({ filter: K(t) || 'all' });
}
function ut(t) {
    ct({ search: String(t || '') });
}
function dt(t, e) {
    const n = Number(t || 0);
    (g((t) => ({
        ...t,
        data: {
            ...t.data,
            appointments: (t.data.appointments || []).map((t) =>
                Number(t.id || 0) === n ? { ...t, ...e } : t
            ),
        },
    })),
        rt());
}
async function pt(t, e) {
    await k('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
const mt = 'admin-callbacks-sort',
    bt = 'admin-callbacks-filter',
    gt = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    ft = new Set(['recent_desc', 'waiting_desc']);
function ht(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function yt(t) {
    const e = ht(t);
    return gt.has(e) ? e : 'all';
}
function vt(t) {
    const e = ht(t);
    return ft.has(e) ? e : 'recent_desc';
}
function kt(t) {
    const e = ht(t);
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
function wt(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function St(t) {
    const e = wt(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function Ct(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function qt(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const n = new Date();
    return (
        e.getFullYear() === n.getFullYear() &&
        e.getMonth() === n.getMonth() &&
        e.getDate() === n.getDate()
    );
}
function At(t) {
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
function Mt(t) {
    return t < 60 ? `${t} min` : `${Math.round(t / 60)} h`;
}
function Tt(t) {
    try {
        (localStorage.setItem(bt, JSON.stringify(yt(t.filter))),
            localStorage.setItem(mt, JSON.stringify(vt(t.sort))));
    } catch (t) {}
}
function $t() {
    const e = b(),
        n = Array.isArray(e?.data?.callbacks) ? e.data.callbacks : [],
        a = e.callbacks,
        o = (function (t, e) {
            const n = [...t];
            return 'waiting_desc' === vt(e)
                ? (n.sort((t, e) => wt(t) - wt(e)), n)
                : (n.sort((t, e) => wt(e) - wt(t)), n);
        })(
            (function (t, e) {
                const n = ht(e);
                return n
                    ? t.filter((t) =>
                          [t.telefono, t.phone, t.preferencia, t.status].some(
                              (t) => ht(t).includes(n)
                          )
                      )
                    : t;
            })(
                (function (t, e) {
                    const n = yt(e);
                    return 'pending' === n || 'contacted' === n
                        ? t.filter((t) => kt(t.status) === n)
                        : 'today' === n
                          ? t.filter((t) => qt(t.fecha || t.createdAt))
                          : 'sla_urgent' === n
                            ? t.filter(
                                  (t) =>
                                      'pending' === kt(t.status) && St(t) >= 120
                              )
                            : t;
                })(n, a.filter),
                a.search
            ),
            a.sort
        ),
        s = new Set((a.selected || []).map((t) => Number(t || 0))),
        l = (function (t) {
            const e = t.filter((t) => 'pending' === kt(t.status)),
                n = e.filter((t) => St(t) >= 120),
                a = e.slice().sort((t, e) => wt(t) - wt(e))[0];
            return {
                pendingCount: e.length,
                urgentCount: n.length,
                todayCount: t.filter((t) => qt(t.fecha || t.createdAt)).length,
                next: a,
                queueHealth:
                    n.length > 0
                        ? 'Cola: prioridad alta'
                        : e.length > 0
                          ? 'Cola: atencion requerida'
                          : 'Cola: estable',
                queueState:
                    n.length > 0
                        ? 'danger'
                        : e.length > 0
                          ? 'warning'
                          : 'success',
            };
        })(n);
    (c(
        '#callbacksGrid',
        (function (e, n) {
            return e.length
                ? e
                      .map((e, a) =>
                          (function (
                              e,
                              { selected: n = !1, position: a = null } = {}
                          ) {
                              const o = kt(e.status),
                                  s =
                                      'pending' === o
                                          ? 'callback-card pendiente'
                                          : 'callback-card contactado',
                                  r =
                                      'pending' === o
                                          ? 'pendiente'
                                          : 'contactado',
                                  c = Number(e.id || 0),
                                  l = Ct(e),
                                  u = St(e),
                                  d = At(u),
                                  p = e.preferencia || 'Sin preferencia',
                                  m =
                                      'pending' === o
                                          ? 1 === a
                                              ? 'Siguiente contacto recomendado'
                                              : 'Caso pendiente en cola'
                                          : 'Caso ya resuelto';
                              return `\n        <article class="${s}${n ? ' is-selected' : ''}" data-callback-id="${c}" data-callback-status="${r}">\n            <header>\n                <div class="callback-card-heading">\n                    <span class="callback-status-pill" data-tone="${t('pending' === o ? d.tone : 'success')}">${t('pending' === o ? 'Pendiente' : 'Contactado')}</span>\n                    <h4>${t(l)}</h4>\n                </div>\n                <span class="callback-card-wait" data-tone="${t('pending' === o ? d.tone : 'success')}">${t('pending' === o ? d.label : 'Cerrado')}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Preferencia</span><strong>${t(p)}</strong></p>\n                <p><span>Fecha</span><strong>${t(i(e.fecha || e.createdAt || ''))}</strong></p>\n                <p><span>Espera</span><strong>${t(Mt(u))}</strong></p>\n                <p><span>Lectura</span><strong>${t(m)}</strong></p>\n            </div>\n            <p class="callback-card-note">${t('pending' === o ? d.note : 'Registro ya marcado como contactado.')}</p>\n            <div class="callback-actions">\n                <button type="button" data-action="mark-contacted" data-callback-id="${c}" data-callback-date="${t(e.fecha || '')}" ${'pending' !== o ? 'disabled' : ''}>${'pending' === o ? 'Marcar contactado' : 'Contactado'}</button>\n            </div>\n        </article>\n    `;
                          })(e, {
                              selected: n.has(Number(e.id || 0)),
                              position: a + 1,
                          })
                      )
                      .join('')
                : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>';
        })(o, s)
    ),
        (function (t, e, n) {
            (r('#callbacksToolbarMeta', `Mostrando ${e} de ${n}`),
                r(
                    '#callbacksToolbarState',
                    (function (t) {
                        const e = [];
                        return (
                            'all' !== yt(t.filter) &&
                                e.push(
                                    'pending' === yt(t.filter)
                                        ? 'Pendientes'
                                        : 'contacted' === yt(t.filter)
                                          ? 'Contactados'
                                          : 'today' === yt(t.filter)
                                            ? 'Hoy'
                                            : 'Urgentes SLA'
                                ),
                            ht(t.search) && e.push(`Busqueda: ${t.search}`),
                            'waiting_desc' === vt(t.sort)
                                ? e.push('Orden: Mayor espera (SLA)')
                                : e.push('Orden: Mas recientes'),
                            e
                        );
                    })(t).join(' | ')
                ));
            const a = document.getElementById('callbackFilter');
            a instanceof HTMLSelectElement && (a.value = yt(t.filter));
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement && (i.value = vt(t.sort));
            const o = document.getElementById('searchCallbacks');
            (o instanceof HTMLInputElement &&
                o.value !== t.search &&
                (o.value = t.search),
                (function (t) {
                    const e = ht(t);
                    document
                        .querySelectorAll(
                            '.callback-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const n = ht(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', n);
                        });
                })(t.filter),
                Tt(t));
        })(a, o.length, n.length),
        r('#callbacksOpsPendingCount', l.pendingCount),
        r('#callbacksOpsUrgentCount', l.urgentCount),
        r('#callbacksOpsTodayCount', l.todayCount),
        r('#callbacksOpsQueueHealth', l.queueHealth),
        (function (t, e) {
            const n = document.getElementById('callbacksBulkSelectVisibleBtn');
            n instanceof HTMLButtonElement && (n.disabled = 0 === t);
            const a = document.getElementById('callbacksBulkClearBtn');
            a instanceof HTMLButtonElement && (a.disabled = 0 === e);
            const i = document.getElementById('callbacksBulkMarkBtn');
            i instanceof HTMLButtonElement && (i.disabled = 0 === e);
        })(o.length, s.size),
        (function (t, e, n, a) {
            (r(
                '#callbacksDeckSummary',
                n > 0
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
            (r('#callbacksOpsNext', s ? Ct(s) : 'Sin telefono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${Ct(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                r('#callbacksNextWait', s ? Mt(St(s)) : '0 min'),
                r('#callbacksNextPreference', (s && s.preferencia) || '-'),
                r('#callbacksNextState', s ? At(St(s)).label : 'Pendiente'));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === a),
                r('#callbacksSelectedCount', a));
        })(l, o.length, n.length, s.size));
}
function _t(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e && Tt(b().callbacks),
        $t());
}
function Lt(t) {
    _t({ filter: yt(t), selected: [] });
}
async function Et(t, e = '') {
    const n = Number(t || 0);
    n <= 0 ||
        (await k('callbacks', {
            method: 'PATCH',
            body: { id: n, status: 'contacted', fecha: e },
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
                $t());
        })(n));
}
const Nt = 'admin-availability-selected-date',
    Dt = 'admin-availability-month-anchor';
function Bt(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function xt(t) {
    return [...new Set(t.map(Bt).filter(Boolean))].sort();
}
function Pt(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? '' : u(n) === e ? e : '';
}
function It(t) {
    const e = Pt(t);
    if (!e) return null;
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? null : n;
}
function Ht(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((n) => {
                const a = Pt(n);
                if (!a) return;
                const i = xt(Array.isArray(t[n]) ? t[n] : []);
                i.length && (e[a] = i);
            }),
        e
    );
}
function Ft(t) {
    return Ht(t || {});
}
function Rt(t) {
    return JSON.stringify(Ht(t || {}));
}
function Ot(t, e = '') {
    let n = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) n = new Date(t);
    else {
        const e = Pt(t);
        e && (n = new Date(`${e}T12:00:00`));
    }
    if (!n) {
        const t = It(e);
        n = t ? new Date(t) : new Date();
    }
    return (n.setDate(1), n.setHours(12, 0, 0, 0), n);
}
function jt(t, e) {
    const n = Pt(t);
    if (n) return n;
    const a = Object.keys(e || {})[0];
    if (a) {
        const t = Pt(a);
        if (t) return t;
    }
    return u(new Date());
}
function zt() {
    const t = b(),
        e = Pt(t.availability.selectedDate),
        n = Ot(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(Nt, e) : localStorage.removeItem(Nt),
            localStorage.setItem(Dt, u(n)));
    } catch (t) {}
}
function Vt(t) {
    const e = Ft(b().data.availability || {});
    return Rt(t) !== Rt(e);
}
function Ut() {
    return Ft(b().availability.draft || {});
}
function Kt() {
    const t = b().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function Qt() {
    const t = b(),
        e = Pt(t.availability.selectedDate);
    if (e) return e;
    const n = Ft(t.availability.draft || {});
    return Object.keys(n)[0] || u(new Date());
}
function Gt(t, e) {
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
function Wt(t = 1) {
    const e = Ut(),
        n = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!n.length) return '';
    const a = Pt(b().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? n.sort() : n.sort().reverse()).find((e) =>
            t >= 0 ? e >= a : e <= a
        ) || ''
    );
}
function Jt() {
    ((function () {
        const t = b(),
            e = Ot(t.availability.monthAnchor, t.availability.selectedDate),
            n = Qt(),
            a = e.getMonth(),
            i = Ft(t.availability.draft),
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
                    n = (e.getDay() + 6) % 7;
                e.setDate(e.getDate() - n);
                const a = [];
                for (let t = 0; t < 42; t += 1) {
                    const n = new Date(e);
                    (n.setDate(e.getDate() + t), a.push(n));
                }
                return a;
            })(e)
                .map((t) => {
                    const e = u(t),
                        s = Array.isArray(i[e]) ? i[e] : [],
                        r = s.length > 0,
                        c = t.getMonth() === a;
                    return `\n                <button type="button" class="${['calendar-day', c ? '' : 'other-month', r ? 'has-slots' : '', e === n ? 'is-selected' : '', e === o ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${e}">\n                    <span>${t.getDate()}</span>\n                    <small>${r ? `${s.length} slot${1 === s.length ? '' : 's'}` : c ? 'Sin slots' : ''}</small>\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const { selectedDate: e, slots: n } = (function () {
                    const t = b(),
                        e = Qt();
                    return {
                        selectedDate: e,
                        slots: xt(Ft(t.availability.draft)[e] || []),
                    };
                })(),
                a = Kt();
            (r('#selectedDate', e || '-'),
                n.length
                    ? c(
                          '#timeSlotsList',
                          n
                              .map(
                                  (n) =>
                                      `\n            <div class="time-slot-item">\n                <div>\n                    <strong>${t(n)}</strong>\n                    <small>${t(a ? 'Slot publicado' : 'Disponible para consulta')}</small>\n                </div>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(e)}" data-time="${encodeURIComponent(n)}" ${a ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : c(
                          '#timeSlotsList',
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${t(Gt([], a))}</p>`
                      ));
        })(),
        (function () {
            const t = b(),
                n = Qt(),
                a = Ft(t.availability.draft),
                i = Array.isArray(a[n]) ? xt(a[n]) : [],
                o = Kt(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: l,
                } = (function () {
                    const t = b().data.availabilityMeta || {},
                        e = Kt();
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
                    `Fecha: ${n} | ${(function (t) {
                        const e = It(t);
                        return e
                            ? new Intl.DateTimeFormat('es-EC', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                              }).format(e)
                            : t || '-';
                    })(n)} | Fuente: ${s} | Modo: ${c} | Slots: ${i.length}`
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
                ),
                (function (t) {
                    const n = e('#addSlotForm'),
                        a = e('#availabilityQuickSlotPresets');
                    (n && n.classList.toggle('is-hidden', t),
                        a && a.classList.toggle('is-hidden', t));
                    const i = e('#newSlotTime');
                    i instanceof HTMLInputElement && (i.disabled = t);
                    const o = e('[data-action="add-time-slot"]');
                    o instanceof HTMLButtonElement && (o.disabled = t);
                })(o));
            const u = Array.isArray(t.availability.clipboard)
                ? t.availability.clipboard.length
                : 0;
            let d = Gt(i, o);
            (o
                ? (d = 'Edicion bloqueada por proveedor Google')
                : t.availability.lastAction
                  ? (d = String(t.availability.lastAction))
                  : u && (d = `Portapapeles: ${u} slots`),
                r('#availabilityDayActionsStatus', d),
                (function (t, e, n) {
                    document
                        .querySelectorAll(
                            '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                        )
                        .forEach((a) => {
                            a instanceof HTMLButtonElement &&
                                ('availabilityDiscardDraftBtn' !== a.id &&
                                'availabilitySaveDraftBtn' !== a.id
                                    ? 'paste-availability-day' !==
                                      String(a.dataset.action || '')
                                        ? (a.disabled = e)
                                        : (a.disabled = e || 0 === n)
                                    : (a.disabled =
                                          e || !t.availability.draftDirty));
                        });
                })(t, o, u));
        })(),
        zt());
}
function Yt(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? Jt() : zt());
}
function Zt(t, e = {}) {
    const n = Ft(t),
        a = jt(e.selectedDate || b().availability.selectedDate, n);
    Yt(
        {
            draft: n,
            selectedDate: a,
            monthAnchor: Ot(e.monthAnchor || b().availability.monthAnchor, a),
            draftDirty: Vt(n),
            ...e,
        },
        { render: !0 }
    );
}
function Xt(t) {
    Yt({ lastAction: String(t || '') }, { render: !0 });
}
function te(t, e, n = '') {
    const a = Pt(t) || Qt();
    if (!a) return;
    const i = Ut(),
        o = xt(Array.isArray(e) ? e : []);
    (o.length ? (i[a] = o) : delete i[a],
        Zt(i, { selectedDate: a, monthAnchor: a, lastAction: n }));
}
function ee(t, e) {
    const n = Pt(t);
    n &&
        Yt(
            { selectedDate: n, monthAnchor: Ot(n, n), lastAction: e || '' },
            { render: !0 }
        );
}
function ne() {
    return Pt(b().availability.selectedDate) || Qt();
}
function ae(t) {
    return Bt(t);
}
function ie(t) {
    if (Kt()) return;
    const e = b(),
        n = ne();
    if (!n) return;
    const a = Array.isArray(e.availability.draft[n])
            ? e.availability.draft[n]
            : [],
        i = (function (t, e) {
            const n = It(t);
            return n ? (n.setDate(n.getDate() + Number(e || 0)), u(n)) : '';
        })(n, t);
    i && te(i, a, `Duplicado ${a.length} slots en ${i}`);
}
function oe() {
    return Boolean(b().availability.draftDirty);
}
function se(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function re(t) {
    const e = se(t);
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
function ce(t) {
    const e = se(t);
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
function le(t) {
    return Array.isArray(t) ? t : [];
}
function ue(t, e = 0) {
    const n = Number(t);
    return Number.isFinite(n) ? n : e;
}
function de(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function pe(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
function me(t, e = 0) {
    const n = Number(t?.id || t?.ticket_id || e + 1);
    return {
        id: n,
        ticketCode: String(t?.ticketCode || t?.ticket_code || `A-${n}`),
        queueType: String(t?.queueType || t?.queue_type || 'walk_in'),
        patientInitials: String(
            t?.patientInitials || t?.patient_initials || '--'
        ),
        priorityClass: String(
            t?.priorityClass || t?.priority_class || 'walk_in'
        ),
        status: re(t?.status || 'waiting'),
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
function be(t, e = 0, n = {}) {
    const a = t && 'object' == typeof t ? t : {},
        i = me({ ...a, ...n }, e);
    return (
        pe(a.createdAt, a.created_at) || (i.createdAt = ''),
        pe(a.priorityClass, a.priority_class) || (i.priorityClass = ''),
        pe(a.queueType, a.queue_type) || (i.queueType = ''),
        pe(a.patientInitials, a.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function ge(t) {
    const e = t.filter((t) => 'waiting' === t.status),
        n = t.filter((t) => 'called' === t.status),
        a = {
            1: n.find((t) => 1 === t.assignedConsultorio) || null,
            2: n.find((t) => 2 === t.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: e.length,
        calledCount: n.length,
        counts: {
            waiting: e.length,
            called: n.length,
            completed: t.filter((t) => 'completed' === t.status).length,
            no_show: t.filter((t) => 'no_show' === t.status).length,
            cancelled: t.filter((t) => 'cancelled' === t.status).length,
        },
        callingNowByConsultorio: a,
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
function fe(t, e = []) {
    const n = t && 'object' == typeof t ? t : {},
        a = n.counts && 'object' == typeof n.counts ? n.counts : {},
        i =
            n.callingNowByConsultorio &&
            'object' == typeof n.callingNowByConsultorio
                ? n.callingNowByConsultorio
                : n.calling_now_by_consultorio &&
                    'object' == typeof n.calling_now_by_consultorio
                  ? n.calling_now_by_consultorio
                  : {},
        o = le(n.callingNow).concat(le(n.calling_now)),
        s = le(e).map((t, e) => me(t, e)),
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
        l = r ? be(r, 0, { status: 'called', assignedConsultorio: 1 }) : null,
        u = c ? be(c, 1, { status: 'called', assignedConsultorio: 2 }) : null,
        d = le(n.nextTickets)
            .concat(le(n.next_tickets))
            .map((t, e) =>
                be(
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
        g = ue(
            n.waitingCount ?? n.waiting_count ?? a.waiting ?? d.length ?? p,
            0
        ),
        f = ue(n.calledCount ?? n.called_count ?? a.called ?? b, 0),
        h = ue(
            a.completed ??
                n.completedCount ??
                n.completed_count ??
                s.filter((t) => 'completed' === t.status).length,
            0
        ),
        y = ue(
            a.no_show ??
                a.noShow ??
                n.noShowCount ??
                n.no_show_count ??
                s.filter((t) => 'no_show' === t.status).length,
            0
        ),
        v = ue(
            a.cancelled ??
                a.canceled ??
                n.cancelledCount ??
                n.cancelled_count ??
                s.filter((t) => 'cancelled' === t.status).length,
            0
        );
    return {
        updatedAt: String(
            n.updatedAt || n.updated_at || new Date().toISOString()
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
function he(t) {
    const e = me(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${se(e.ticketCode || '')}`;
}
function ye(t) {
    const e = fe(t),
        n = new Map(),
        a = (t) => {
            if (!t) return;
            const e = me(t, n.size);
            (pe(t?.createdAt, t?.created_at) || (e.createdAt = ''),
                pe(t?.priorityClass, t?.priority_class) ||
                    (e.priorityClass = ''),
                pe(t?.queueType, t?.queue_type) || (e.queueType = ''),
                n.set(he(e), e));
        },
        i =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        o =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (i && a({ ...i, status: 'called', assignedConsultorio: 1 }),
        o && a({ ...o, status: 'called', assignedConsultorio: 2 }));
    for (const t of le(e.nextTickets))
        a({ ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(n.values());
}
function ve(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function ke(t, e = '') {
    try {
        const n = localStorage.getItem(t);
        return null === n ? e : n;
    } catch (t) {
        return e;
    }
}
function we(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function Se(t, e) {
    try {
        const n = localStorage.getItem(t);
        return n ? JSON.parse(n) : e;
    } catch (t) {
        return e;
    }
}
function Ce(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function qe(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const Ae = 'queueStationMode',
    Me = 'queueStationConsultorio',
    Te = 'queueOneTapAdvance',
    $e = 'queueCallKeyBindingV1',
    _e = 'queueNumpadHelpOpen',
    Le = 'queueAdminLastSnapshot',
    Ee = new Map([
        [1, !1],
        [2, !1],
    ]),
    Ne = new Set(['no_show', 'cancelar']);
function De(t) {
    (we(Ae, t.queue.stationMode || 'free'),
        we(Me, t.queue.stationConsultorio || 1),
        we(Te, t.queue.oneTap ? '1' : '0'),
        we(_e, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? Ce($e, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })($e),
        Ce(Le, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Be() {
    const t = b(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => me(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? fe(t.data.queueMeta, e)
                : ge(e),
    };
}
function xe() {
    const t = b(),
        { queueTickets: e } = Be();
    return (function (t, e) {
        const n = se(e);
        return n
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => se(t).includes(n)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const n = se(e);
            return 'waiting' === n
                ? t.filter((t) => 'waiting' === t.status)
                : 'called' === n
                  ? t.filter((t) => 'called' === t.status)
                  : 'no_show' === n
                    ? t.filter((t) => 'no_show' === t.status)
                    : 'sla_risk' === n
                      ? t.filter(
                            (t) =>
                                'waiting' === t.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - de(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === se(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function Pe(t, e = null) {
    const n = Array.isArray(e) ? e : Be().queueTickets,
        a = new Set(n.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(le(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && a.has(t))
        .sort((t, e) => t - e);
}
function Ie() {
    return Pe(b().queue.selected || []);
}
function He() {
    const t = (function () {
        const t = new Set(Ie());
        return t.size
            ? Be().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : xe();
}
function Fe(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        Be().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Re() {
    const t = b(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        Be().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Oe() {
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
function je(t) {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        n = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (n && (n.textContent = `Confirmar accion sensible: ${t.action}`),
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
function ze() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
let Ve = '';
function Ue(e) {
    const n = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        a = Math.max(0, Math.round((Date.now() - de(e.createdAt)) / 6e4)),
        i = Number(e.id || 0),
        o = new Set(Ie()).has(i),
        s = 'called' === e.status,
        r = s && e.assignedConsultorio,
        c = s;
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                <label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${i}" ${o ? 'checked' : ''} />\n                </label>\n            </td>\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (re(t)) {
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
    )}</td>\n            <td>${n}</td>\n            <td>${a} min</td>\n            <td>\n                <div class="table-actions">\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                </div>\n            </td>\n        </tr>\n    `;
}
function Ke(e = () => {}) {
    const n = b(),
        { queueMeta: a } = Be(),
        i = xe(),
        o = Ie().length,
        s = He(),
        l = le(a.nextTickets),
        u = Number(a.waitingCount || a.counts?.waiting || 0);
    (!(function (t, e) {
        const n = b(),
            a =
                t.callingNowByConsultorio?.[1] ||
                t.callingNowByConsultorio?.[1] ||
                null,
            i =
                t.callingNowByConsultorio?.[2] ||
                t.callingNowByConsultorio?.[2] ||
                null,
            o = a
                ? String(a.ticketCode || a.ticket_code || 'A-000')
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
            ((c.hidden = !a),
            (c.textContent = a ? `Liberar C1 · ${o}` : 'Release C1'),
            a
                ? c.setAttribute('data-queue-id', String(Number(a.id || 0)))
                : c.removeAttribute('data-queue-id'));
        const l = document.getElementById('queueReleaseC2');
        l instanceof HTMLButtonElement &&
            ((l.hidden = !i),
            (l.textContent = i ? `Liberar C2 · ${s}` : 'Release C2'),
            i
                ? l.setAttribute('data-queue-id', String(Number(i.id || 0)))
                : l.removeAttribute('data-queue-id'));
        const u = document.getElementById('queueSyncStatus');
        if ('fallback' === se(n.queue.syncMode))
            return (
                r('#queueSyncStatus', 'fallback'),
                void (u && u.setAttribute('data-state', 'fallback'))
            );
        const d = String(t.updatedAt || '').trim();
        if (!d) return;
        const p = Math.max(0, Math.round((Date.now() - de(d)) / 1e3)),
            m = p >= 60;
        if (
            (r('#queueSyncStatus', m ? `Watchdog (${p}s)` : 'vivo'),
            u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
            m)
        ) {
            const t = `stale-${Math.floor(p / 15)}`;
            return void (
                t !== Ve &&
                ((Ve = t), e('Watchdog de cola: realtime en reconnecting'))
            );
        }
        Ve = 'live';
    })(a, e),
        c(
            '#queueTableBody',
            i.length
                ? i.map(Ue).join('')
                : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
        ));
    const d =
        n.queue.fallbackPartial && l.length && u > l.length
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
                    Math.round((Date.now() - de(t.createdAt)) / 6e4)
                ) >= 20 ||
                    'appt_overdue' === se(t.priorityClass))
        ).length,
        m = [p > 0 ? `riesgo: ${p}` : 'sin riesgo'];
    (o > 0 && m.push(`seleccion: ${o}`),
        n.queue.fallbackPartial && m.push('fallback parcial'),
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
        r('#queueStationBadge', `Estación C${n.queue.stationConsultorio}`),
        r(
            '#queueStationModeBadge',
            'locked' === n.queue.stationMode ? 'Bloqueado' : 'Libre'
        ));
    const y = document.getElementById('queuePracticeModeBadge');
    y instanceof HTMLElement && (y.hidden = !n.queue.practiceMode);
    const v = document.getElementById('queueShortcutPanel');
    v instanceof HTMLElement && (v.hidden = !n.queue.helpOpen);
    const k = document.querySelector('[data-action="queue-clear-call-key"]');
    k instanceof HTMLElement && (k.hidden = !n.queue.customCallKey);
    const w = document.querySelector('[data-action="queue-toggle-one-tap"]');
    (w instanceof HTMLElement &&
        (w.setAttribute('aria-pressed', String(Boolean(n.queue.oneTap))),
        (w.textContent = n.queue.oneTap ? '1 tecla ON' : '1 tecla OFF')),
        document
            .querySelectorAll(
                '[data-action="queue-call-next"][data-queue-consultorio]'
            )
            .forEach((t) => {
                if (!(t instanceof HTMLButtonElement)) return;
                const e = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1;
                t.disabled =
                    'locked' === n.queue.stationMode &&
                    e !== Number(n.queue.stationConsultorio || 1);
            }));
    const S = Fe(n.queue.stationConsultorio);
    (document
        .querySelectorAll(
            '[data-action="queue-release-station"][data-queue-consultorio]'
        )
        .forEach((t) => {
            if (!(t instanceof HTMLButtonElement)) return;
            const e = 2 === Number(t.dataset.queueConsultorio || 1) ? 2 : 1,
                a = Fe(e);
            ((t.disabled = !a),
                'locked' === n.queue.stationMode &&
                    e !== Number(n.queue.stationConsultorio || 1) &&
                    (t.disabled = !0));
        }),
        S &&
            (m.push(
                `activo: ${S.ticketCode} en C${n.queue.stationConsultorio}`
            ),
            r('#queueTriageSummary', m.join(' | '))),
        Oe());
}
function Qe(t) {
    g((e) => {
        const n = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: n } };
    });
    try {
        Oe();
    } catch (t) {}
}
function Ge(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: Pe(t, e.data.queueTickets || []) },
    })),
        e && Ke(Qe));
}
function We() {
    Ge([]);
}
function Je(t, e = null, n = {}) {
    const a = (Array.isArray(t) ? t : []).map((t, e) => me(t, e)),
        i = fe(e && 'object' == typeof e ? e : ge(a), a),
        o = a.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof n.fallbackPartial
                ? n.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === se(n.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === se(n.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: a, queueMeta: i },
        queue: {
            ...t.queue,
            selected: Pe(t.queue.selected || [], a),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        De(b()),
        Ke(Qe));
}
function Ye(t, e) {
    const n = Number(t || 0),
        a = (b().data.queueTickets || []).map((t, a) => {
            const i = me(t, a);
            return i.id !== n
                ? i
                : me('function' == typeof e ? e(i) : { ...i }, a);
        });
    Je(a, ge(a), { fallbackPartial: !1, syncMode: 'live' });
}
function Ze(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), De(b()), Ke(Qe));
}
function Xe(t) {
    Ze({ filter: se(t) || 'all', selected: [] });
}
function tn(t, e = {}) {
    const n =
        t?.data?.queueState ||
        t?.data?.queue_state ||
        t?.data?.queueMeta ||
        t?.data ||
        null;
    if (!n || 'object' != typeof n) return;
    const a = (function (t) {
            return t && 'object' == typeof t
                ? Array.isArray(t.queue_tickets)
                    ? t.queue_tickets
                    : Array.isArray(t.queueTickets)
                      ? t.queueTickets
                      : Array.isArray(t.tickets)
                        ? t.tickets
                        : []
                : [];
        })(n),
        i = t?.data?.ticket || null;
    if (
        !(function (t, e, n) {
            if (e.length > 0) return !0;
            if (
                ve(t, 'queue_tickets') ||
                ve(t, 'queueTickets') ||
                ve(t, 'tickets')
            )
                return !0;
            if (n && 'object' == typeof n) return !0;
            if (
                ve(t, 'waitingCount') ||
                ve(t, 'waiting_count') ||
                ve(t, 'calledCount') ||
                ve(t, 'called_count') ||
                ve(t, 'completedCount') ||
                ve(t, 'completed_count') ||
                ve(t, 'noShowCount') ||
                ve(t, 'no_show_count') ||
                ve(t, 'cancelledCount') ||
                ve(t, 'cancelled_count')
            )
                return !0;
            const a =
                t?.counts && 'object' == typeof t.counts ? t.counts : null;
            if (
                a &&
                (ve(a, 'waiting') ||
                    ve(a, 'called') ||
                    ve(a, 'completed') ||
                    ve(a, 'no_show') ||
                    ve(a, 'noShow') ||
                    ve(a, 'cancelled') ||
                    ve(a, 'canceled'))
            )
                return !0;
            if (ve(t, 'nextTickets') || ve(t, 'next_tickets')) return !0;
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
                ) || le(t?.callingNow).concat(le(t?.calling_now)).some(Boolean)
            );
        })(n, a, i)
    )
        return;
    const o = 'fallback' === se(e.syncMode) ? 'fallback' : 'live',
        s = (b().data.queueTickets || []).map((t, e) => me(t, e)),
        r = fe(n, s),
        c = (function (t) {
            const e =
                    t?.counts && 'object' == typeof t.counts ? t.counts : null,
                n =
                    ve(t, 'waitingCount') ||
                    ve(t, 'waiting_count') ||
                    Boolean(e && ve(e, 'waiting')),
                a =
                    ve(t, 'calledCount') ||
                    ve(t, 'called_count') ||
                    Boolean(e && ve(e, 'called')),
                i = ve(t, 'nextTickets') || ve(t, 'next_tickets'),
                o =
                    ve(t, 'callingNowByConsultorio') ||
                    ve(t, 'calling_now_by_consultorio') ||
                    ve(t, 'callingNow') ||
                    ve(t, 'calling_now');
            return { waiting: n || i, called: a || o };
        })(n),
        l = ye(r),
        u = Boolean(i && 'object' == typeof i);
    if (!(a.length || l.length || u || c.waiting || c.called)) return;
    const d =
        Number(r.waitingCount || 0) >
        l.filter((t) => 'waiting' === t.status).length;
    if (a.length) return void Je(a, r, { fallbackPartial: !1, syncMode: o });
    const p = new Map(s.map((t) => [he(t), t]));
    (!(function (t, e, n) {
        const a = e.callingNowByConsultorio || {},
            i = Number(e.calledCount || e.counts?.called || 0),
            o = Number(e.waitingCount || e.counts?.waiting || 0),
            s = le(e.nextTickets),
            r = new Set(),
            c = a[1] || a[1] || null,
            l = a[2] || a[2] || null;
        (c && r.add(he(c)), l && r.add(he(l)));
        const u = new Set(s.map((t) => he(t))),
            d = r.size > 0 || 0 === i,
            p = u.size > 0 || 0 === o,
            m = u.size > 0 && o > u.size;
        for (const [e, a] of t.entries()) {
            const i = me(a, 0);
            n.called && d && 'called' === i.status && !r.has(e)
                ? t.set(
                      e,
                      me(
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
                : n.waiting &&
                  p &&
                  'waiting' === i.status &&
                  (o <= 0 ? t.delete(e) : m || u.has(e) || t.delete(e));
        }
    })(p, r, c),
        Je(
            (function (t, e, n) {
                for (const n of e) {
                    const e = he(n),
                        a = t.get(e) || null,
                        i = pe(
                            n.createdAt,
                            n.created_at,
                            a?.createdAt,
                            a?.created_at
                        ),
                        o = pe(
                            n.priorityClass,
                            n.priority_class,
                            a?.priorityClass,
                            a?.priority_class,
                            'walk_in'
                        ),
                        s = pe(
                            n.queueType,
                            n.queue_type,
                            a?.queueType,
                            a?.queue_type,
                            'walk_in'
                        ),
                        r = pe(
                            n.patientInitials,
                            n.patient_initials,
                            a?.patientInitials,
                            a?.patient_initials,
                            '--'
                        );
                    t.set(
                        e,
                        me(
                            {
                                ...(a || {}),
                                ...n,
                                status: n.status,
                                assignedConsultorio: n.assignedConsultorio,
                                createdAt: i || new Date().toISOString(),
                                priorityClass: o,
                                queueType: s,
                                patientInitials: r,
                            },
                            t.size
                        )
                    );
                }
                if (n && 'object' == typeof n) {
                    const e = me(n, t.size),
                        a = he(e),
                        i = t.get(a) || null;
                    t.set(a, me({ ...(i || {}), ...e }, t.size));
                }
                return Array.from(t.values());
            })(p, l, i),
            r,
            { fallbackPartial: d, syncMode: o }
        ));
}
function en() {
    return Se(Le, null);
}
function nn(t, e = '') {
    return (
        !!t?.queueTickets?.length &&
        (Je(t.queueTickets, t.queueMeta || null, {
            fallbackPartial: !0,
            syncMode: 'fallback',
        }),
        e && Qe(e),
        !0)
    );
}
async function an() {
    try {
        (tn(await k('queue-state'), { syncMode: 'live' }),
            Qe('Queue refresh realizado'));
    } catch (t) {
        (Qe('Queue refresh con error'), nn(en()));
    }
}
function on(t, e, n = void 0) {
    Ye(t, (t) => ({
        ...t,
        status: e,
        assignedConsultorio: void 0 === n ? t.assignedConsultorio : n,
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
async function sn({ ticketId: t, action: e, consultorio: n }) {
    const a = Number(t || 0),
        i = ce(e);
    if (a && i)
        return b().queue.practiceMode
            ? ((function (t, e, n) {
                  'reasignar' !== e && 're-llamar' !== e
                      ? 'liberar' !== e
                          ? 'completar' !== e
                              ? 'no_show' !== e
                                  ? 'cancelar' === e && on(t, 'cancelled')
                                  : on(t, 'no_show')
                              : on(t, 'completed')
                          : on(t, 'waiting', null)
                      : on(t, 'called', 2 === Number(n || 1) ? 2 : 1);
              })(a, i, n),
              void Qe(`Practica: accion ${i} en ticket ${a}`))
            : (tn(
                  await k('queue-ticket', {
                      method: 'PATCH',
                      body: { id: a, action: i, consultorio: Number(n || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void Qe(`Accion ${i} ticket ${a}`));
}
async function rn(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        n = b();
    if (!Ee.get(e)) {
        if (
            'locked' === n.queue.stationMode &&
            n.queue.stationConsultorio !== e
        )
            return (
                Qe(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (n.queue.practiceMode) {
            const t = (function (t) {
                return Be().queueTickets.find(
                    (e) =>
                        'waiting' === e.status &&
                        (!e.assignedConsultorio || e.assignedConsultorio === t)
                );
            })(e);
            return t
                ? ((function (t, e) {
                      Ye(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void Qe(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void Qe('Practica: sin tickets en espera');
        }
        Ee.set(e, !0);
        try {
            (tn(
                await k('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                Qe(`Llamado C${e} ejecutado`));
        } catch (t) {
            (Qe(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            Ee.set(e, !1);
        }
    }
}
async function cn(t, e, n = 0) {
    const a = {
            ticketId: Number(t || 0),
            action: ce(e),
            consultorio: Number(n || 0),
        },
        i = b(),
        o = (function (t) {
            const e = Number(t || 0);
            return (
                (e && Be().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(a.ticketId);
    if (
        !i.queue.practiceMode &&
        Ne.has(a.action) &&
        (function (t, e) {
            const n = ce(t);
            return (
                'cancelar' === n ||
                ('no_show' === n &&
                    (!e ||
                        'called' === re(e.status) ||
                        Number(e.assignedConsultorio || 0) > 0))
            );
        })(a.action, o)
    )
        return (je(a), void Qe(`Accion ${a.action} pendiente de confirmacion`));
    await sn(a);
}
async function ln() {
    const t = b().queue.pendingSensitiveAction;
    t ? (ze(), await sn(t)) : ze();
}
function un() {
    (ze(), Qe('Accion sensible cancelada'));
}
function dn() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (un(), 0)
    );
}
async function pn(t) {
    const e = Number(t || 0);
    e &&
        (b().queue.practiceMode
            ? Qe(`Practica: reprint ticket ${e}`)
            : (await k('queue-reprint', { method: 'POST', body: { id: e } }),
              Qe(`Reimpresion ticket ${e}`)));
}
function mn() {
    Ze({ helpOpen: !b().queue.helpOpen });
}
function bn(t) {
    const e = Boolean(t);
    (Ze({ practiceMode: e, pendingSensitiveAction: null }),
        Qe(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function gn(t) {
    const e = Re();
    return (
        !!e &&
        (je({
            ticketId: e.id,
            action: 'completar',
            consultorio: t.queue.stationConsultorio,
        }),
        !0)
    );
}
async function fn(t) {
    const e = b();
    if (e.queue.captureCallKeyMode)
        return void (function (t) {
            const e = {
                key: String(t.key || ''),
                code: String(t.code || ''),
                location: Number(t.location || 0),
            };
            (Ze({ customCallKey: e, captureCallKeyMode: !1 }),
                s('Tecla externa guardada', 'success'),
                Qe(`Tecla externa calibrada: ${e.code}`));
        })(t);
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                se(e.code) === se(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await rn(e.queue.stationConsultorio));
    const n = se(t.code),
        a = se(t.key),
        i =
            'numpadenter' === n ||
            'kpenter' === n ||
            ('enter' === a && 3 === Number(t.location || 0));
    if (i && e.queue.pendingSensitiveAction) return void (await ln());
    const o = (function (t, e) {
        return 'numpad2' === t || '2' === e
            ? 2
            : 'numpad1' === t || '1' === e
              ? 1
              : 0;
    })(n, a);
    if (!o)
        return i
            ? (e.queue.oneTap && gn(e) && (await ln()),
              void (await rn(e.queue.stationConsultorio)))
            : void ('numpaddecimal' !== n &&
              'kpdecimal' !== n &&
              'decimal' !== a &&
              ',' !== a &&
              '.' !== a
                  ? 'numpadsubtract' !== n && 'kpsubtract' !== n && '-' !== a
                      ? ('numpadadd' === n || 'kpadd' === n || '+' === a) &&
                        (await (async function (t) {
                            const e = Re();
                            e &&
                                (await cn(
                                    e.id,
                                    're-llamar',
                                    t.queue.stationConsultorio
                                ),
                                Qe(`Re-llamar ${e.ticketCode}`),
                                s(`Re-llamar ${e.ticketCode}`, 'info'));
                        })(e))
                      : (function (t) {
                            const e = Re();
                            e &&
                                je({
                                    ticketId: e.id,
                                    action: 'no_show',
                                    consultorio: t.queue.stationConsultorio,
                                });
                        })(e)
                  : gn(e));
    !(function (t, e) {
        (function (t, e) {
            return (
                'locked' === e.queue.stationMode &&
                e.queue.stationConsultorio !== t
            );
        })(t, e)
            ? (s('Cambio bloqueado por modo estación', 'warning'),
              Qe('Cambio de estación bloqueado por lock'))
            : (Ze({ stationConsultorio: t }), Qe(`Numpad: estacion C${t}`));
    })(o, e);
}
function hn(t, e) {
    return 'c2' === t || '2' === t ? 2 : 'c1' === t || '1' === t ? 1 : e;
}
function yn(t, e) {
    return '1' === t || 'true' === t ? 'locked' : e;
}
function vn(t, e) {
    return '1' === t || 'true' === t || ('0' !== t && 'false' !== t && e);
}
const kn = 'appointments',
    wn = 'callbacks',
    Sn = 'reviews',
    Cn = 'availability',
    qn = 'availability-meta',
    An = 'queue-tickets',
    Mn = 'queue-meta',
    Tn = 'health-status';
function $n(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function _n(t) {
    g((e) => {
        return {
            ...e,
            data: {
                ...e.data,
                appointments: t.appointments || [],
                callbacks:
                    ((n = t.callbacks || []),
                    (Array.isArray(n) ? n : []).map((t) => ({
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
        var n;
    });
}
function Ln(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function En(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function Nn(t) {
    return En(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function Dn(t) {
    if (!t) return 'Sin fecha';
    const e = Math.round((t - Date.now()) / 6e4),
        n = Math.abs(e);
    return e < 0
        ? n < 60
            ? `Hace ${n} min`
            : n < 1440
              ? `Hace ${Math.round(n / 60)} h`
              : 'Ya ocurrio'
        : e < 60
          ? `En ${Math.max(e, 0)} min`
          : e < 1440
            ? `En ${Math.round(e / 60)} h`
            : `En ${Math.round(e / 1440)} d`;
}
function Bn(e, n, a) {
    return Array.isArray(e) && 0 !== e.length
        ? e
              .slice(0, 5)
              .map((e) => {
                  const i = String(e[n] || e.label || '-'),
                      o = String(e[a] ?? e.count ?? 0);
                  return `<li><span>${t(i)}</span><strong>${t(o)}</strong></li>`;
              })
              .join('')
        : '<li><span>Sin datos</span><strong>0</strong></li>';
}
function xn(e, n, a, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(i)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(a)}</small>\n            </div>\n            <strong>${t(String(n))}</strong>\n        </li>\n    `;
}
function Pn(e, n, a) {
    return `\n        <button type="button" class="operations-action-item" data-action="${t(e)}">\n            <span>${t(n)}</span>\n            <small>${t(a)}</small>\n        </button>\n    `;
}
function In(t) {
    const {
            appointments: e,
            availability: n,
            callbacks: a,
            funnel: i,
            reviews: o,
        } = (function (t) {
            return {
                appointments: Array.isArray(t?.data?.appointments)
                    ? t.data.appointments
                    : [],
                callbacks: Array.isArray(t?.data?.callbacks)
                    ? t.data.callbacks
                    : [],
                reviews: Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
                availability:
                    t?.data?.availability &&
                    'object' == typeof t.data.availability
                        ? t.data.availability
                        : {},
                funnel: t?.data?.funnelMetrics || {},
            };
        })(t),
        s = (function (t) {
            return t.filter((t) =>
                (function (t) {
                    if (!t) return !1;
                    const e = new Date(t),
                        n = new Date();
                    return (
                        e.getFullYear() === n.getFullYear() &&
                        e.getMonth() === n.getMonth() &&
                        e.getDate() === n.getDate()
                    );
                })(Nn(t))
            ).length;
        })(e),
        r = (function (t) {
            return t.filter((t) => {
                const e = Ln(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(e),
        c = (function (t) {
            return t.filter((t) => 'pending' === Ln(t.status)).length;
        })(a),
        l = (function (t) {
            return t.filter((t) => {
                if ('pending' !== Ln(t.status)) return !1;
                const e = (function (t) {
                    return En(t?.fecha || t?.createdAt || '');
                })(t);
                return !!e && Math.round((Date.now() - e) / 6e4) >= 120;
            }).length;
        })(a),
        u = (function (t) {
            return t.filter((t) => 'no_show' === Ln(t.status)).length;
        })(e),
        d = (function (t) {
            return t.length
                ? (
                      t.reduce((t, e) => t + Number(e.rating || 0), 0) /
                      t.length
                  ).toFixed(1)
                : '0.0';
        })(o),
        p = (function (t, e = 30) {
            const n = Date.now();
            return t.filter((t) => {
                const a = En(t.date || t.createdAt || '');
                return a && n - a <= 24 * e * 60 * 60 * 1e3;
            }).length;
        })(o),
        m = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(n),
        b = (function (t) {
            return t
                .map((t) => ({ item: t, stamp: Nn(t) }))
                .filter((t) => t.stamp > 0 && t.stamp >= Date.now())
                .sort((t, e) => t.stamp - e.stamp)[0];
        })(e);
    return {
        appointments: e,
        availabilityDays: m,
        avgRating: d,
        callbacks: a,
        funnel: i,
        nextAppointment: b,
        noShows: u,
        pendingCallbacks: c,
        pendingTransfers: r,
        recentReviews: p,
        reviews: o,
        todayAppointments: s,
        urgentCallbacks: l,
    };
}
function Hn(t) {
    const e = In(t);
    ((function (t) {
        const {
            appointments: e,
            avgRating: n,
            nextAppointment: a,
            noShows: i,
            pendingCallbacks: o,
            pendingTransfers: s,
            recentReviews: c,
            reviews: l,
            todayAppointments: u,
            urgentCallbacks: d,
        } = t;
        (r('#todayAppointments', u),
            r('#totalAppointments', e.length),
            r('#pendingCallbacks', o),
            r('#totalReviewsCount', l.length),
            r('#totalNoShows', i),
            r('#avgRating', n),
            r('#adminAvgRating', n),
            r('#dashboardHeroRating', n),
            r('#dashboardHeroRecentReviews', c),
            r('#dashboardHeroUrgentCallbacks', d),
            r('#dashboardHeroPendingTransfers', s),
            r(
                '#dashboardHeroSummary',
                (function ({
                    pendingTransfers: t,
                    urgentCallbacks: e,
                    noShows: n,
                    nextAppointment: a,
                }) {
                    return t > 0
                        ? `Primero valida ${t} transferencia(s) antes de liberar mas agenda.`
                        : e > 0
                          ? `Hay ${e} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`
                          : n > 0
                            ? `Revisa ${n} no show del corte actual para cerrar seguimiento.`
                            : a?.item
                              ? `La siguiente cita es ${a.item.name || 'sin nombre'} ${Dn(a.stamp).toLowerCase()}.`
                              : 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
                })({
                    pendingTransfers: s,
                    urgentCallbacks: d,
                    noShows: i,
                    nextAppointment: a,
                })
            ));
    })(e),
        (function (t) {
            const {
                    nextAppointment: e,
                    pendingTransfers: n,
                    todayAppointments: i,
                    urgentCallbacks: o,
                } = t,
                s = n > 0 || o > 0 ? 'warning' : i > 0 ? 'neutral' : 'success';
            (r(
                '#dashboardLiveStatus',
                n > 0 || o > 0 ? 'Atencion' : i > 0 ? 'Activo' : 'Estable'
            ),
                document
                    .getElementById('dashboardLiveStatus')
                    ?.setAttribute('data-state', s),
                r(
                    '#dashboardLiveMeta',
                    (function ({
                        pendingTransfers: t,
                        urgentCallbacks: e,
                        nextAppointment: n,
                    }) {
                        return t > 0
                            ? 'Transferencias detenidas hasta validar comprobante.'
                            : e > 0
                              ? 'Callbacks fuera de SLA requieren llamada inmediata.'
                              : n?.item
                                ? `Siguiente ingreso: ${n.item.name || 'Paciente'} el ${a(n.item.date)} a las ${n.item.time || '--:--'}.`
                                : 'Sin alertas criticas en la operacion actual.';
                    })({
                        pendingTransfers: n,
                        urgentCallbacks: o,
                        nextAppointment: e,
                    })
                ));
        })(e),
        (function (t) {
            const {
                availabilityDays: e,
                nextAppointment: n,
                pendingCallbacks: a,
                pendingTransfers: i,
                todayAppointments: o,
                urgentCallbacks: s,
            } = t;
            (r(
                '#dashboardQueueHealth',
                s > 0
                    ? 'Cola: SLA comprometido'
                    : a > 0
                      ? 'Cola: pendiente por drenar'
                      : 'Cola: estable'
            ),
                r(
                    '#dashboardFlowStatus',
                    n?.item
                        ? `${Dn(n.stamp)} | ${n.item.name || 'Paciente'}`
                        : e > 0
                          ? `${e} dia(s) con slots publicados`
                          : 'Sin citas inmediatas'
                ),
                r('#operationPendingReviewCount', i),
                r('#operationPendingCallbacksCount', a),
                r('#operationTodayLoadCount', o),
                r(
                    '#operationDeckMeta',
                    i > 0 || s > 0
                        ? 'La prioridad ya esta definida'
                        : n?.item
                          ? 'Siguiente accion lista'
                          : 'Operacion sin frentes urgentes'
                ),
                r(
                    '#operationQueueHealth',
                    n?.item
                        ? `Siguiente hito: ${n.item.name || 'Paciente'} ${Dn(n.stamp).toLowerCase()}`
                        : 'Sin citas inmediatas en cola'
                ));
        })(e),
        c(
            '#operationActionList',
            (function (t) {
                const {
                        pendingTransfers: e,
                        urgentCallbacks: n,
                        pendingCallbacks: a,
                    } = t,
                    { appointments: i, nextAppointment: o } = t;
                return [
                    Pn(
                        'context-open-appointments-transfer',
                        e > 0
                            ? 'Validar transferencias'
                            : 'Abrir agenda clinica',
                        e > 0
                            ? `${e} comprobante(s) por revisar`
                            : `${i.length} cita(s) en el corte`
                    ),
                    Pn(
                        'context-open-callbacks-pending',
                        n > 0
                            ? 'Resolver callbacks urgentes'
                            : 'Abrir callbacks',
                        n > 0
                            ? `${n} caso(s) fuera de SLA`
                            : `${a} callback(s) pendientes`
                    ),
                    Pn(
                        'refresh-admin-data',
                        'Actualizar tablero',
                        o?.item
                            ? `Proxima cita ${Dn(o.stamp).toLowerCase()}`
                            : 'Sincronizar agenda y funnel'
                    ),
                ].join('');
            })(e)
        ),
        c(
            '#dashboardAttentionList',
            (function (t) {
                const {
                    availabilityDays: e,
                    pendingTransfers: n,
                    todayAppointments: a,
                    urgentCallbacks: i,
                } = t;
                return [
                    xn(
                        'Transferencias',
                        n,
                        n > 0
                            ? 'Pago detenido antes de confirmar.'
                            : 'Sin comprobantes pendientes.',
                        n > 0 ? 'warning' : 'success'
                    ),
                    xn(
                        'Callbacks urgentes',
                        i,
                        i > 0
                            ? 'Mas de 120 min en espera.'
                            : 'SLA dentro de rango.',
                        i > 0 ? 'danger' : 'success'
                    ),
                    xn(
                        'Agenda de hoy',
                        a,
                        a > 0
                            ? `${a} ingreso(s) en la jornada.`
                            : 'No hay citas hoy.',
                        a > 6 ? 'warning' : 'neutral'
                    ),
                    xn(
                        'Disponibilidad',
                        e,
                        e > 0
                            ? 'Dias con slots listos para publicar.'
                            : 'Sin slots cargados en el calendario.',
                        e > 0 ? 'success' : 'warning'
                    ),
                ].join('');
            })(e)
        ),
        (function (t) {
            const e = t.summary || {};
            (r('#funnelViewBooking', o(e.viewBooking || 0)),
                r('#funnelStartCheckout', o(e.startCheckout || 0)),
                r('#funnelBookingConfirmed', o(e.bookingConfirmed || 0)),
                r(
                    '#funnelAbandonRate',
                    `${Number(e.abandonRatePct || 0).toFixed(1)}%`
                ),
                c(
                    '#funnelEntryList',
                    Bn(t.checkoutEntryBreakdown, 'entry', 'count')
                ),
                c(
                    '#funnelSourceList',
                    Bn(t.sourceBreakdown, 'source', 'count')
                ),
                c(
                    '#funnelPaymentMethodList',
                    Bn(t.paymentMethodBreakdown, 'method', 'count')
                ),
                c(
                    '#funnelAbandonList',
                    Bn(t.checkoutAbandonByStep, 'step', 'count')
                ),
                c(
                    '#funnelAbandonReasonList',
                    Bn(t.abandonReasonBreakdown, 'reason', 'count')
                ),
                c(
                    '#funnelStepList',
                    Bn(t.bookingStepBreakdown, 'step', 'count')
                ),
                c(
                    '#funnelErrorCodeList',
                    Bn(t.errorCodeBreakdown, 'code', 'count')
                ));
        })(e.funnel));
}
function Fn(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Rn(t) {
    const e = new Date(t?.date || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function On(t) {
    return `${Math.max(0, Math.min(5, Math.round(Number(t || 0))))}/5`;
}
function jn(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function zn(t, e = 220) {
    const n = String(t || '').trim();
    return n
        ? n.length <= e
            ? n
            : `${n.slice(0, e - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function Vn() {
    const e = b(),
        n = Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
        a = (function (t) {
            return t.slice().sort((t, e) => Rn(e) - Rn(t));
        })(n),
        o = (function (t) {
            return t.length
                ? t.reduce((t, e) => t + Number(e.rating || 0), 0) / t.length
                : 0;
        })(n),
        s = (function (t, e = 30) {
            const n = Date.now();
            return t.filter((t) => {
                const a = Rn(t);
                return !!a && n - a <= 24 * e * 60 * 60 * 1e3;
            }).length;
        })(n),
        l = (function (t) {
            return t.filter((t) => Number(t.rating || 0) <= 3).length;
        })(n),
        u = (function (t) {
            const e = t.find((t) => Number(t.rating || 0) <= 3);
            if (e)
                return {
                    item: e,
                    eyebrow: 'Feedback accionable',
                    summary:
                        'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
                };
            const n = t.find((t) => Number(t.rating || 0) >= 5);
            return n
                ? {
                      item: n,
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
        })(a),
        { latestAuthor: d, latestDate: p } = (function (t) {
            const e = t[0];
            return {
                latestDate: e ? i(e.date || e.createdAt || '') : '-',
                latestAuthor: e ? String(e.name || 'Anonimo') : 'Sin datos',
            };
        })(a);
    if (
        (r('#reviewsAverageRating', o.toFixed(1)),
        r(
            '#reviewsFiveStarCount',
            (function (t) {
                return t.filter((t) => Number(t.rating || 0) >= 5).length;
            })(n)
        ),
        r('#reviewsRecentCount', s),
        r('#reviewsTotalCount', n.length),
        r(
            '#reviewsSentimentLabel',
            (function (t, e, n) {
                return e
                    ? n > 0 && t < 4
                        ? 'Atencion requerida'
                        : t >= 4.7
                          ? 'Confianza alta'
                          : t >= 4.2
                            ? 'Tono solido'
                            : t >= 3.5
                              ? 'Lectura mixta'
                              : 'Atencion requerida'
                    : 'Sin senal suficiente';
            })(o, n.length, l)
        ),
        c(
            '#reviewsSummaryRail',
            (function ({
                latestAuthor: e,
                latestDate: n,
                recentCount: a,
                lowRatedCount: i,
            }) {
                return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${t(e)}</strong>\n            <small>${t(n)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${t(String(a))} en 30 dias</strong>\n            <small>Volumen reciente de feedback.</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Riesgo</span>\n            <strong>${t(i > 0 ? `${i} por revisar` : 'Sin alertas')}</strong>\n            <small>${t(i > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>\n        </article>\n    `;
            })({
                latestAuthor: d,
                latestDate: p,
                recentCount: s,
                lowRatedCount: l,
            })
        ),
        !n.length)
    )
        return (
            c(
                '#reviewsSpotlight',
                '\n        <div class="reviews-empty-state" data-admin-empty-state="reviews">\n            <strong>Sin feedback reciente</strong>\n            <p>No hay resenas registradas todavia.</p>\n        </div>\n    '
            ),
            void c(
                '#reviewsGrid',
                '\n        <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">\n            <strong>No hay resenas registradas.</strong>\n            <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>\n        </div>\n    '
            )
        );
    (u.item
        ? c(
              '#reviewsSpotlight',
              (function (e) {
                  const n = e.item;
                  return `\n        <article class="reviews-spotlight-card">\n            <div class="reviews-spotlight-top">\n                <span class="review-avatar">${t(jn(n.name || 'Anonimo'))}</span>\n                <div>\n                    <small>${t(e.eyebrow)}</small>\n                    <strong>${t(n.name || 'Anonimo')}</strong>\n                    <small>${t(i(n.date || n.createdAt || ''))}</small>\n                </div>\n            </div>\n            <p class="reviews-spotlight-stars">${t(On(n.rating))}</p>\n            <p>${t(zn(n.comment || n.review || '', 320))}</p>\n            <small>${t(e.summary)}</small>\n        </article>\n    `;
              })(u)
          )
        : c(
              '#reviewsSpotlight',
              `\n        <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">\n            <strong>Sin spotlight disponible</strong>\n            <p>${t(u.summary)}</p>\n        </div>\n    `
          ),
        c(
            '#reviewsGrid',
            (function (e, n) {
                return e
                    .map((e) =>
                        (function (e, { featured: n = !1 } = {}) {
                            const a = Number(e.rating || 0),
                                o =
                                    a >= 5
                                        ? 'success'
                                        : a <= 3
                                          ? 'danger'
                                          : 'neutral',
                                s =
                                    a >= 5
                                        ? 'Resena de alta confianza'
                                        : a <= 3
                                          ? 'Revisar posible friccion'
                                          : 'Resena util para contexto';
                            return `\n        <article class="review-card${n ? ' is-featured' : ''}" data-rating="${t(String(a))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${t(jn(e.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(e.name || 'Anonimo')}</strong>\n                        <small>${t(i(e.date || e.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${t(o)}">${t(On(a))}</span>\n            </header>\n            <p>${t(zn(e.comment || e.review || ''))}</p>\n            <small>${t(s)}</small>\n        </article>\n    `;
                        })(e, {
                            featured:
                                n.item &&
                                Fn(e.name) === Fn(n.item.name) &&
                                Rn(e) === Rn(n.item),
                        })
                    )
                    .join('');
            })(a, u)
        ));
}
function Un() {
    const t = (function () {
        const t = b(),
            e = Number(t.ui.lastRefreshAt || 0);
        if (!e) return 'Datos: sin sincronizar';
        const n = Math.max(0, Math.round((Date.now() - e) / 1e3));
        return n < 60
            ? `Datos: hace ${n}s`
            : `Datos: hace ${Math.round(n / 60)}m`;
    })();
    (r('#adminRefreshStatus', t),
        r(
            '#adminSyncState',
            'Datos: sin sincronizar' === t
                ? 'Listo para primera sincronizacion'
                : t.replace('Datos: ', 'Estado: ')
        ));
}
async function Kn(t = !1) {
    const e = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    k('data'),
                    k('health').catch(() => null),
                ]),
                n = t.data || {};
            let a = n.funnelMetrics || null;
            if (!a) {
                const t = await k('funnel-metrics').catch(() => null);
                a = t?.data || null;
            }
            const i = {
                appointments: Array.isArray(n.appointments)
                    ? n.appointments
                    : [],
                callbacks: Array.isArray(n.callbacks) ? n.callbacks : [],
                reviews: Array.isArray(n.reviews) ? n.reviews : [],
                availability:
                    n.availability && 'object' == typeof n.availability
                        ? n.availability
                        : {},
                availabilityMeta:
                    n.availabilityMeta && 'object' == typeof n.availabilityMeta
                        ? n.availabilityMeta
                        : {},
                queueTickets: $n(n),
                queueMeta:
                    n.queueMeta && 'object' == typeof n.queueMeta
                        ? n.queueMeta
                        : n.queue_state && 'object' == typeof n.queue_state
                          ? n.queue_state
                          : null,
                funnelMetrics: a,
                health: e && e.ok ? e : null,
            };
            return (
                _n(i),
                (function (t) {
                    (Ce(kn, t.appointments || []),
                        Ce(wn, t.callbacks || []),
                        Ce(Sn, t.reviews || []),
                        Ce(Cn, t.availability || {}),
                        Ce(qn, t.availabilityMeta || {}),
                        Ce(An, t.queueTickets || []),
                        Ce(Mn, t.queueMeta || null),
                        Ce(Tn, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (
                _n({
                    appointments: Se(kn, []),
                    callbacks: Se(wn, []),
                    reviews: Se(Sn, []),
                    availability: Se(Cn, {}),
                    availabilityMeta: Se(qn, {}),
                    queueTickets: Se(An, []),
                    queueMeta: Se(Mn, null),
                    health: Se(Tn, null),
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
                e = Ft(t.data.availability || {}),
                n = jt(t.availability.selectedDate, e);
            (Yt({
                draft: e,
                selectedDate: n,
                monthAnchor: Ot(t.availability.monthAnchor, n),
                draftDirty: !1,
                lastAction: '',
            }),
                Jt());
        })(),
        await (async function () {
            const t = Array.isArray(b().data.queueTickets)
                    ? b().data.queueTickets.map((t, e) => me(t, e))
                    : [],
                e = (function (t) {
                    return b().data.queueMeta &&
                        'object' == typeof b().data.queueMeta
                        ? fe(b().data.queueMeta, t)
                        : null;
                })(t);
            t.length
                ? Je(t, e || null, { fallbackPartial: !1, syncMode: 'live' })
                : (function (t) {
                      const e = t ? ye(t) : [];
                      return (
                          !!e.length &&
                          (Je(e, t, {
                              fallbackPartial: !0,
                              syncMode: 'fallback',
                          }),
                          Qe('Queue fallback parcial desde metadata'),
                          !0)
                      );
                  })(e) ||
                  (await an(),
                  (b().data.queueTickets || []).length ||
                      nn(en(), 'Queue fallback desde snapshot local') ||
                      Je([], null, { fallbackPartial: !1, syncMode: 'live' }));
        })(),
        F(b()),
        Hn(b()),
        rt(),
        $t(),
        Vn(),
        Jt(),
        Ke(),
        Un(),
        t &&
            s(
                e ? 'Datos actualizados' : 'Datos cargados desde cache local',
                e ? 'success' : 'warning'
            ),
        e
    );
}
function Qn() {
    (B(!1),
        I(),
        P(!1),
        x({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function Gn(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        n = document.getElementById('admin2FACode'),
        a = e instanceof HTMLInputElement ? e.value : '',
        i = n instanceof HTMLInputElement ? n.value : '';
    try {
        P(!0);
        const t = b();
        if (
            (x({
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
                const n = await w('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    a = String(n.csrfToken || '');
                return (
                    v(a),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: a,
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
                const n = await w('login', {
                    method: 'POST',
                    body: { password: e },
                });
                if (!0 === n.twoFactorRequired)
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
                const a = String(n.csrfToken || '');
                return (
                    v(a),
                    g((t) => ({
                        ...t,
                        auth: {
                            ...t.auth,
                            authenticated: !0,
                            csrfToken: a,
                            requires2FA: !1,
                            lastAuthAt: Date.now(),
                            authMethod: 'password',
                        },
                    })),
                    { authenticated: !0, requires2FA: !1 }
                );
            })(a);
            if (t.requires2FA)
                return (
                    B(!0),
                    x({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void H('2fa')
                );
        }
        (x({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            L(),
            N(),
            B(!1),
            I({ clearPassword: !0 }),
            await Kn(!1),
            s('Sesion iniciada', 'success'));
    } catch (t) {
        (x({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            H(b().auth.requires2FA ? '2fa' : 'password'),
            s(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        P(!1);
    }
}
async function Wn(t, e) {
    switch (t) {
        case 'appointment-quick-filter':
            return (lt(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-appointment-filters':
            return (ct({ filter: 'all', search: '' }), !0);
        case 'appointment-density':
            return (
                ct({
                    density:
                        'compact' ===
                        K(String(e.dataset.density || 'comfortable'))
                            ? 'compact'
                            : U,
                }),
                !0
            );
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await pt(t, { paymentStatus: 'paid' }),
                        dt(t, { paymentStatus: 'paid' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia aprobada', 'success'),
                !0
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await pt(t, { paymentStatus: 'failed' }),
                        dt(t, { paymentStatus: 'failed' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia rechazada', 'warning'),
                !0
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await pt(t, { status: 'no_show' }),
                        dt(t, { status: 'no_show' }));
                })(Number(e.dataset.id || 0)),
                s('Marcado como no show', 'warning'),
                !0
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await pt(t, { status: 'cancelled' }),
                        dt(t, { status: 'cancelled' }));
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
                        n = URL.createObjectURL(e),
                        a = document.createElement('a');
                    ((a.href = n),
                        (a.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`),
                        document.body.appendChild(a),
                        a.click(),
                        a.remove(),
                        URL.revokeObjectURL(n));
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function Jn(t, n) {
    switch (t) {
        case 'change-month':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!Number.isFinite(e) || 0 === e) return;
                    const n = Ot(
                        b().availability.monthAnchor,
                        b().availability.selectedDate
                    );
                    (n.setMonth(n.getMonth() + e),
                        Yt({ monthAnchor: n, lastAction: '' }, { render: !0 }));
                })(Number(n.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (ee(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const t = Wt(-1);
                    t
                        ? ee(t, `Fecha previa con slots: ${t}`)
                        : Xt('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const t = Wt(1);
                    t
                        ? ee(t, `Siguiente fecha con slots: ${t}`)
                        : Xt('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (t) {
                    const e = Pt(t);
                    e &&
                        Yt(
                            {
                                selectedDate: e,
                                monthAnchor: Ot(e, e),
                                lastAction: '',
                            },
                            { render: !0 }
                        );
                })(String(n.dataset.date || '')),
                !0
            );
        case 'prefill-time-slot':
            return (
                (function (t) {
                    if (Kt()) return;
                    const n = e('#newSlotTime');
                    n instanceof HTMLInputElement &&
                        ((n.value = ae(t)), n.focus());
                })(String(n.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (Kt()) return;
                    const t = e('#newSlotTime');
                    if (!(t instanceof HTMLInputElement)) return;
                    const n = ae(t.value);
                    if (!n) return;
                    const a = b(),
                        i = ne();
                    i &&
                        (te(
                            i,
                            [
                                ...(Array.isArray(a.availability.draft[i])
                                    ? a.availability.draft[i]
                                    : []),
                                n,
                            ],
                            `Slot ${n} agregado en ${i}`
                        ),
                        (t.value = ''));
                })(),
                !0
            );
        case 'remove-time-slot':
            return (
                (function (t, e) {
                    if (Kt()) return;
                    const n = Pt(t);
                    if (!n) return;
                    const a = b(),
                        i = Array.isArray(a.availability.draft[n])
                            ? a.availability.draft[n]
                            : [],
                        o = ae(e);
                    te(
                        n,
                        i.filter((t) => ae(t) !== o),
                        `Slot ${o || '-'} removido en ${n}`
                    );
                })(
                    decodeURIComponent(String(n.dataset.date || '')),
                    decodeURIComponent(String(n.dataset.time || ''))
                ),
                !0
            );
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            return (
                (function () {
                    if (Kt()) return;
                    const t = b(),
                        e = ne();
                    if (!e) return;
                    const n = Array.isArray(t.availability.draft[e])
                        ? xt(t.availability.draft[e])
                        : [];
                    Yt(
                        {
                            clipboard: n,
                            clipboardDate: e,
                            lastAction: n.length
                                ? `Portapapeles: ${n.length} slots (${e})`
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
                    if (Kt()) return;
                    const t = b(),
                        e = Array.isArray(t.availability.clipboard)
                            ? xt(t.availability.clipboard)
                            : [];
                    if (!e.length) return void Xt('Portapapeles vacio');
                    const n = ne();
                    n && te(n, e, `Pegado ${e.length} slots en ${n}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (ie(1), !0);
        case 'duplicate-availability-next-week':
            return (ie(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (Kt()) return;
                    const t = ne();
                    t &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${t}. Continuar?`
                        ) &&
                        te(t, [], `Dia ${t} limpiado`);
                })(),
                !0
            );
        case 'clear-availability-week':
            return (
                (function () {
                    if (Kt()) return;
                    const t = ne();
                    if (!t) return;
                    const e = (function (t) {
                        const e = It(t);
                        if (!e) return null;
                        const n = (e.getDay() + 6) % 7,
                            a = new Date(e);
                        a.setDate(e.getDate() - n);
                        const i = new Date(a);
                        return (
                            i.setDate(a.getDate() + 6),
                            { start: a, end: i }
                        );
                    })(t);
                    if (!e) return;
                    const n = u(e.start),
                        a = u(e.end);
                    if (
                        !window.confirm(
                            `Se eliminaran los slots de la semana ${n} a ${a}. Continuar?`
                        )
                    )
                        return;
                    const i = Ut();
                    for (let t = 0; t < 7; t += 1) {
                        const n = new Date(e.start);
                        (n.setDate(e.start.getDate() + t), delete i[u(n)]);
                    }
                    Zt(i, {
                        selectedDate: t,
                        lastAction: `Semana limpiada (${n} - ${a})`,
                    });
                })(),
                !0
            );
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (Kt()) return;
                    const t = Ut(),
                        e = await k('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        n =
                            e?.data && 'object' == typeof e.data
                                ? Ft(e.data)
                                : t,
                        a =
                            e?.meta && 'object' == typeof e.meta
                                ? e.meta
                                : null;
                    (g((t) => ({
                        ...t,
                        data: {
                            ...t.data,
                            availability: n,
                            availabilityMeta: a
                                ? { ...t.data.availabilityMeta, ...a }
                                : t.data.availabilityMeta,
                        },
                        availability: {
                            ...t.availability,
                            draft: n,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        Jt());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (Kt()) return;
                    const t = b();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const e = Ft(t.data.availability || {}),
                        n = jt(t.availability.selectedDate, e);
                    Yt(
                        {
                            draft: e,
                            selectedDate: n,
                            monthAnchor: Ot(t.availability.monthAnchor, n),
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
const Yn = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function Zn(t, e = 'dashboard') {
    const n = String(t || '')
        .trim()
        .toLowerCase();
    return Yn.has(n) ? n : e;
}
function Xn(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            n = e ? `#${e}` : '';
        window.location.hash !== n &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${n}`
            );
    })(Zn(t));
}
const ta = 'themeMode',
    ea = new Set(['light', 'dark', 'system']);
const na = 'adminLastSection',
    aa = 'adminSidebarCollapsed';
function ia(t, { persist: e = !1 } = {}) {
    const n = (function (t) {
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
    (g((e) => ({ ...e, ui: { ...e.ui, themeMode: t, theme: n } })),
        e &&
            (function (t) {
                const e = ea.has(t) ? t : 'system';
                we(ta, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const n = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', n),
                e.setAttribute('aria-pressed', String(n)));
        }));
}
function oa() {
    const t = b();
    (we(na, t.ui.activeSection), we(aa, t.ui.sidebarCollapsed ? '1' : '0'));
}
function sa() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function ra(t) {
    return (
        t instanceof HTMLElement &&
        !t.hidden &&
        'true' !== t.getAttribute('aria-hidden') &&
        (!('disabled' in t) || !t.disabled) &&
        t.getClientRects().length > 0
    );
}
function ca() {
    const t = b(),
        n = sa(),
        a = e('#adminSidebar'),
        i = a instanceof HTMLElement && a.classList.contains('is-open');
    (!(function ({ open: t, collapsed: n }) {
        const a = e('#adminSidebar'),
            i = e('#adminSidebarBackdrop'),
            o = e('#adminMenuToggle');
        (a && a.classList.toggle('is-open', Boolean(t)),
            i && i.classList.toggle('is-hidden', !t),
            o && o.setAttribute('aria-expanded', String(Boolean(t))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(t)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(n)
            ));
        const s = e('#adminSidebarCollapse');
        s && s.setAttribute('aria-pressed', String(Boolean(n)));
    })({
        open: !!n && t.ui.sidebarOpen,
        collapsed: !n && t.ui.sidebarCollapsed,
    }),
        n &&
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
async function la(t, e = {}) {
    const n = Zn(t, 'dashboard'),
        { force: a = !1 } = e,
        i = b().ui.activeSection;
    return (
        !(
            !a &&
            'availability' === b().ui.activeSection &&
            'availability' !== n &&
            oe() &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (t) {
            const e = Zn(t, 'dashboard');
            (g((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                D(e),
                F(b()),
                Xn(e),
                oa());
        })(n),
        'queue' === n &&
            'queue' !== i &&
            (function () {
                const t = b();
                return (
                    'fallback' !== se(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await an()),
        !0)
    );
}
function ua() {
    (g((t) => ({
        ...t,
        ui: {
            ...t.ui,
            sidebarCollapsed: !t.ui.sidebarCollapsed,
            sidebarOpen: t.ui.sidebarOpen,
        },
    })),
        ca(),
        oa());
}
function da() {
    (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !t.ui.sidebarOpen } })),
        ca());
}
function pa({ restoreFocus: t = !1 } = {}) {
    if (
        (g((t) => ({ ...t, ui: { ...t.ui, sidebarOpen: !1 } })), ca(), N(), t)
    ) {
        const t = e('#adminMenuToggle');
        t instanceof HTMLElement && t.focus();
    }
}
function ma() {
    E();
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function ba() {
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
async function ga(t) {
    switch (t) {
        case 'appointments_pending_transfer':
            (await la('appointments'), lt('pending_transfer'), ut(''));
            break;
        case 'appointments_all':
            (await la('appointments'), lt('all'), ut(''));
            break;
        case 'appointments_no_show':
            (await la('appointments'), lt('no_show'), ut(''));
            break;
        case 'callbacks_pending':
            (await la('callbacks'), Lt('pending'));
            break;
        case 'callbacks_contacted':
            (await la('callbacks'), Lt('contacted'));
            break;
        case 'callbacks_sla_urgent':
            (await la('callbacks'), Lt('sla_urgent'));
            break;
        case 'queue_sla_risk':
            (await la('queue'), Xe('sla_risk'));
            break;
        case 'queue_waiting':
            (await la('queue'), Xe('waiting'));
            break;
        case 'queue_called':
            (await la('queue'), Xe('called'));
            break;
        case 'queue_no_show':
            (await la('queue'), Xe('no_show'));
            break;
        case 'queue_all':
            (await la('queue'), Xe('all'));
            break;
        case 'queue_call_next':
            (await la('queue'), await rn(b().queue.stationConsultorio));
    }
}
function fa(t) {
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
async function ha(t, e) {
    switch (t) {
        case 'callback-quick-filter':
            return (Lt(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                _t({
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
                await la('callbacks'),
                Lt('pending'),
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
                await Et(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.callbackDate || '')
                ),
                s('Callback actualizado', 'success'),
                !0
            );
        case 'callbacks-bulk-select-visible':
            return (
                _t(
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
            return (_t({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const t = (b().callbacks.selected || [])
                        .map((t) => Number(t || 0))
                        .filter((t) => t > 0);
                    for (const e of t)
                        try {
                            await Et(e);
                        } catch (t) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await la('callbacks'), Lt('pending'), !0);
        default:
            return !1;
    }
}
async function ya(t) {
    switch (t) {
        case 'context-open-appointments-transfer':
            return (await la('appointments'), lt('pending_transfer'), !0);
        case 'context-open-dashboard':
            return (await la('dashboard'), !0);
        default:
            return !1;
    }
}
async function va(t, e) {
    switch (t) {
        case 'queue-refresh-state':
            return (await an(), !0);
        case 'queue-call-next':
            return (await rn(Number(e.dataset.queueConsultorio || 0)), !0);
        case 'queue-release-station':
            return (
                await (async function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1,
                        n = Fe(e);
                    n
                        ? await cn(n.id, 'liberar', e)
                        : Qe(`Sin ticket activo para liberar en C${e}`);
                })(Number(e.dataset.queueConsultorio || 0)),
                !0
            );
        case 'queue-toggle-ticket-select':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!e) return;
                    const n = Pe(b().queue.selected || []);
                    Ge(n.includes(e) ? n.filter((t) => t !== e) : [...n, e]);
                })(Number(e.dataset.queueId || 0)),
                !0
            );
        case 'queue-select-visible':
            return (Ge(xe().map((t) => Number(t.id || 0))), !0);
        case 'queue-clear-selection':
            return (We(), !0);
        case 'queue-ticket-action':
            return (
                await cn(
                    Number(e.dataset.queueId || 0),
                    String(e.dataset.queueAction || ''),
                    Number(e.dataset.queueConsultorio || 0)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await pn(Number(e.dataset.queueId || 0)), !0);
        case 'queue-bulk-action':
            return (
                await (async function (t) {
                    const e = He(),
                        n = ce(t);
                    if (e.length) {
                        if (Ne.has(n)) {
                            const t = window.confirm(
                                `${(function (t) {
                                    return 'no_show' === t
                                        ? 'No show'
                                        : 'completar' === t || 'completed' === t
                                          ? 'Completar'
                                          : 'Cancelar';
                                })(n)}: confirmar acción masiva`
                            );
                            if (!t) return;
                        }
                        for (const t of e)
                            try {
                                await sn({
                                    ticketId: t.id,
                                    action: n,
                                    consultorio:
                                        t.assignedConsultorio ||
                                        b().queue.stationConsultorio,
                                });
                            } catch (t) {}
                        (We(), Qe(`Bulk ${n} sobre ${e.length} tickets`));
                    }
                })(String(e.dataset.queueAction || 'no_show')),
                !0
            );
        case 'queue-bulk-reprint':
            return (
                await (async function () {
                    const t = He();
                    for (const e of t)
                        try {
                            await pn(e.id);
                        } catch (t) {}
                    (We(), Qe(`Bulk reimpresion ${t.length}`));
                })(),
                !0
            );
        case 'queue-clear-search':
            return (
                (function () {
                    Ze({ search: '', selected: [] });
                    const t = document.getElementById('queueSearchInput');
                    t instanceof HTMLInputElement && (t.value = '');
                })(),
                !0
            );
        case 'queue-toggle-shortcuts':
            return (mn(), !0);
        case 'queue-toggle-one-tap':
            return (Ze({ oneTap: !b().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (bn(!0), !0);
        case 'queue-stop-practice':
            return (bn(!1), !0);
        case 'queue-lock-station':
            return (
                (function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1;
                    (Ze({ stationMode: 'locked', stationConsultorio: e }),
                        Qe(`Estacion bloqueada en C${e}`));
                })(Number(e.dataset.queueConsultorio || 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (t) {
                    if ('free' === se(t))
                        return (
                            Ze({ stationMode: 'free' }),
                            void Qe('Estacion en modo libre')
                        );
                    Ze({ stationMode: 'locked' });
                })(String(e.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-sensitive-confirm':
            return (await ln(), !0);
        case 'queue-sensitive-cancel':
            return (un(), !0);
        case 'queue-capture-call-key':
            return (
                Ze({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    (Ze({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        default:
            return !1;
    }
}
async function ka(t, e) {
    switch (t) {
        case 'close-toast':
            return (e.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                ia(String(e.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return (ua(), !0);
        case 'refresh-admin-data':
            return (await Kn(!0), !0);
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = fa(t.value);
                e && (await ga(e), (t.value = ''), N());
            }
            return !0;
        }
        case 'open-command-palette':
            return (E(), ma(), !0);
        case 'close-command-palette':
            return (N(), !0);
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
                _(),
                N(),
                Qn(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                g((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                B(!1),
                I(),
                x({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                H('password'),
                !0
            );
        default:
            return !1;
    }
}
async function wa() {
    (M(),
        (function () {
            const t = e('#adminMainContent');
            (t instanceof HTMLElement &&
                t.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(R).forEach(([t, e]) => {
                    (O(t, e.hero, 'data-admin-section-hero'),
                        O(t, e.priority, 'data-admin-priority-rail'),
                        O(t, e.workbench, 'data-admin-workbench'),
                        O(t, e.detail, 'data-admin-detail-rail'));
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
            const n = String(e.getAttribute('data-action') || '');
            if (n) {
                t.preventDefault();
                try {
                    await (async function (t, e) {
                        const n = [ka, Wn, ha, Jn, va, ya];
                        for (const a of n) if (await a(t, e)) return !0;
                        return !1;
                    })(n, e);
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
            const n = e.classList.contains('admin-quick-nav-item'),
                a = e.classList.contains('nav-item');
            if (!n && !a) return;
            t.preventDefault();
            const i = await la(
                String(e.getAttribute('data-section') || 'dashboard')
            );
            sa() && !1 !== i && pa();
        }),
        document.addEventListener('click', (t) => {
            const e =
                t.target instanceof Element
                    ? t.target.closest('[data-queue-filter]')
                    : null;
            e &&
                (t.preventDefault(),
                Xe(String(e.getAttribute('data-queue-filter') || 'all')));
        }),
        (function () {
            const t = document.getElementById('callbacksBulkSelectVisibleBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const e = document.getElementById('callbacksBulkClearBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-clear');
            const n = document.getElementById('callbacksBulkMarkBtn');
            n && n.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let t = V,
                e = U;
            try {
                ((t = JSON.parse(localStorage.getItem(j) || `"${V}"`)),
                    (e = JSON.parse(localStorage.getItem(z) || `"${U}"`)));
            } catch (t) {}
            g((n) => ({
                ...n,
                appointments: {
                    ...n.appointments,
                    sort: 'string' == typeof t ? t : V,
                    density: 'string' == typeof e ? e : U,
                },
            }));
        })(),
        (function () {
            let t = 'all',
                e = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(bt) || '"all"')),
                    (e = JSON.parse(
                        localStorage.getItem(mt) || '"recent_desc"'
                    )));
            } catch (t) {}
            g((n) => ({
                ...n,
                callbacks: { ...n.callbacks, filter: yt(t), sort: vt(e) },
            }));
        })(),
        (function () {
            let t = '',
                e = '';
            try {
                ((t = String(localStorage.getItem(Nt) || '')),
                    (e = String(localStorage.getItem(Dt) || '')));
            } catch (t) {}
            const n = Pt(t),
                a = Ot(e, n);
            g((t) => ({
                ...t,
                availability: {
                    ...t.availability,
                    ...(n ? { selectedDate: n } : {}),
                    monthAnchor: a,
                },
            }));
        })(),
        (function () {
            const t = Zn(ke(na, 'dashboard')),
                e = '1' === ke(aa, '0');
            (g((n) => ({
                ...n,
                ui: {
                    ...n.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                D(t),
                Xn(t),
                ca());
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === se(ke(Ae, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(ke(Me, '1')) ? 2 : 1,
                    oneTap: '1' === ke(Te, '0'),
                    helpOpen: '1' === ke(_e, '0'),
                    customCallKey: Se($e, null),
                },
                e = se(qe('station')),
                n = se(qe('lock')),
                a = se(qe('one_tap'));
            (g((i) => ({
                ...i,
                queue: {
                    ...i.queue,
                    stationMode: yn(n, t.stationMode),
                    stationConsultorio: hn(e, t.stationConsultorio),
                    oneTap: vn(a, t.oneTap),
                    helpOpen: t.helpOpen,
                    customCallKey:
                        t.customCallKey && 'object' == typeof t.customCallKey
                            ? t.customCallKey
                            : null,
                },
            })),
                De(b()));
        })(),
        ia(
            (function () {
                const t = String(ke(ta, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return ea.has(t) ? t : 'system';
            })()
        ),
        Qn(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    lt(t.value);
                });
            const e = document.getElementById('appointmentSort');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    ct({ sort: K(e.value) || V });
                });
            const n = document.getElementById('searchAppointments');
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    ut(n.value);
                });
            const a = document.getElementById('callbackFilter');
            a instanceof HTMLSelectElement &&
                a.addEventListener('change', () => {
                    Lt(a.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    _t({ sort: vt(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value),
                        _t({ search: String(t || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        Ze({ search: String(t || ''), selected: [] }));
                });
            const r = document.getElementById('adminQuickCommand');
            var c;
            r instanceof HTMLInputElement &&
                (c = r).addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = fa(c.value);
                    e && (await ga(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                n = e('#adminMenuClose'),
                a = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                sa() ? da() : ua();
            }),
                n?.addEventListener('click', () => pa({ restoreFocus: !0 })),
                a?.addEventListener('click', () => pa({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    sa() ? ca() : pa();
                }),
                document.addEventListener('keydown', (t) => {
                    if (!sa() || !b().ui.sidebarOpen) return;
                    if ('Escape' === t.key)
                        return (
                            t.preventDefault(),
                            void pa({ restoreFocus: !0 })
                        );
                    if ('Tab' !== t.key) return;
                    const n = (function () {
                        const t = e('#adminSidebar');
                        if (!(t instanceof HTMLElement)) return [];
                        const n = e('#adminMenuClose'),
                            a = t.querySelector(
                                '.nav-item.active[data-section]'
                            ),
                            i = Array.from(
                                t.querySelectorAll('.nav-item[data-section]')
                            ).filter((t) => t !== a),
                            o = t.querySelector('.logout-btn');
                        return [n, a, ...i, o].filter(ra);
                    })();
                    if (!n.length) return;
                    const a = n.indexOf(document.activeElement);
                    t.shiftKey
                        ? 0 === a &&
                          (t.preventDefault(), n[n.length - 1].focus())
                        : (-1 !== a && a !== n.length - 1) ||
                          (t.preventDefault(), n[0].focus());
                }),
                window.addEventListener('hashchange', async () => {
                    const t = (function (t = 'dashboard') {
                        return Zn(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(b().ui.activeSection);
                    await la(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && ia(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            oe() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const t = document.getElementById('loginForm');
    (t instanceof HTMLFormElement && t.addEventListener('submit', Gn),
        (function (t) {
            const {
                navigateToSection: e,
                focusQuickCommand: n,
                focusCurrentSearch: a,
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
                    return (t.preventDefault(), void n());
                if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
                    return (t.preventDefault(), void a());
                if (t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey) {
                    const n = p || d;
                    if ('keym' === n) return (t.preventDefault(), void s());
                    if ('digit0' === n) return (t.preventDefault(), void c());
                    if (f[n]) {
                        if (l()) return;
                        return (t.preventDefault(), void e(f[n]));
                    }
                    const a = {
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
                            Object.assign(a, {
                                keyw: 'queue_waiting',
                                keyc: 'queue_called',
                                keya: 'queue_all',
                                keyo: 'queue_all',
                                keyl: 'queue_sla_risk',
                            }),
                        a[n])
                    ) {
                        if (l()) return;
                        return (t.preventDefault(), void i(a[n]));
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
            navigateToSection: la,
            focusQuickCommand: ma,
            focusCurrentSearch: ba,
            runQuickAction: ga,
            closeSidebar: () => pa({ restoreFocus: !0 }),
            toggleMenu: () => {
                sa() ? da() : ua();
            },
            dismissQueueSensitiveDialog: dn,
            toggleQueueHelp: () => mn(),
            queueNumpadAction: fn,
        }));
    const n = await (async function () {
        try {
            const t = await w('status'),
                e = !0 === t.authenticated,
                n = e ? String(t.csrfToken || '') : '';
            return (
                v(n),
                g((t) => ({
                    ...t,
                    auth: {
                        ...t.auth,
                        authenticated: e,
                        csrfToken: n,
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
    (n
        ? (await (async function () {
              (L(), N(), await Kn(!1));
          })(),
          D(b().ui.activeSection))
        : (_(), N(), Qn()),
        (async function () {
            const t = (function () {
                const t = 'Notification' in window,
                    e = 'serviceWorker' in navigator,
                    n = 'PushManager' in window;
                if (!t)
                    return {
                        tone: 'neutral',
                        label: 'Push no disponible',
                        meta: 'Este navegador no soporta notificaciones.',
                    };
                const a = String(Notification.permission || 'default');
                return 'granted' === a
                    ? {
                          tone: 'success',
                          label: e && n ? 'Push listo' : 'Push parcial',
                          meta:
                              e && n
                                  ? 'Permisos concedidos y APIs disponibles.'
                                  : 'Permiso otorgado, pero faltan APIs del navegador.',
                      }
                    : 'denied' === a
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
                const n = document.getElementById(e);
                n &&
                    (n.setAttribute('data-state', t.tone), r(`#${e}`, t.label));
            }),
                ['pushStatusMeta', 'dashboardPushMeta'].forEach((e) => {
                    document.getElementById(e) && r(`#${e}`, t.meta);
                }));
        })(),
        window.setInterval(() => {
            Un();
        }, 3e4));
}
const Sa = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      wa().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : wa()
).catch((t) => {
    throw (console.error('admin-v3 boot failed', t), t);
});
export { Sa as default };
