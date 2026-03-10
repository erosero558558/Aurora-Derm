function e(e) {
    return String(e ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function t(e, t = document) {
    return t.querySelector(e);
}
function a(e, t = document) {
    return Array.from(t.querySelectorAll(e));
}
function n(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime())
        ? String(e || '')
        : t.toLocaleDateString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          });
}
function i(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime())
        ? String(e || '')
        : t.toLocaleString('es-EC', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          });
}
function o(e) {
    const t = Number(e || 0);
    return Number.isFinite(t) ? Math.round(t).toLocaleString('es-EC') : '0';
}
function s(a, n = 'info') {
    const i = t('#toastContainer');
    if (!(i instanceof HTMLElement)) return;
    const o = document.createElement('div');
    ((o.className = `toast ${n}`),
        o.setAttribute('role', 'error' === n ? 'alert' : 'status'),
        (o.innerHTML = `\n        <div class="toast-body">${e(a)}</div>\n        <button type="button" data-action="close-toast" class="toast-close" aria-label="Cerrar">x</button>\n    `),
        i.appendChild(o),
        window.setTimeout(() => {
            o.parentElement && o.remove();
        }, 4500));
}
function r(e, a) {
    const n = t(e);
    n && (n.textContent = String(a ?? ''));
}
function l(e, a) {
    const n = t(e);
    n && (n.innerHTML = a);
}
function c() {
    const e = document.activeElement;
    return (
        e instanceof HTMLElement &&
        Boolean(
            e.closest(
                'input, textarea, select, [contenteditable="true"], [role="textbox"]'
            )
        )
    );
}
function u(e) {
    const t = e instanceof Date ? e : new Date(e || '');
    return Number.isNaN(t.getTime())
        ? ''
        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
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
            queueAutoRefresh: {
                state: 'idle',
                reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
                intervalMs: 45e3,
                lastAttemptAt: 0,
                lastSuccessAt: 0,
                lastError: '',
                inFlight: !1,
            },
        },
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {},
            availabilityMeta: {},
            queueTickets: [],
            queueMeta: null,
            leadOpsMeta: null,
            queueSurfaceStatus: null,
            appDownloads: null,
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
            sort: 'priority_desc',
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
function g(e) {
    const t = e(m);
    t &&
        ((m = t),
        d.forEach((e) => {
            try {
                e(m);
            } catch (e) {}
        }));
}
const f = Object.freeze({
        digit1: 'dashboard',
        digit2: 'appointments',
        digit3: 'callbacks',
        digit4: 'reviews',
        digit5: 'availability',
        digit6: 'queue',
    }),
    h = Object.freeze({
        keyt: 'appointments_pending_transfer',
        keya: 'appointments_all',
        keyn: 'appointments_no_show',
        keyp: 'callbacks_pending',
        keyc: 'callbacks_contacted',
        keyu: 'callbacks_sla_urgent',
        keyw: 'queue_sla_risk',
        keyl: 'queue_call_next',
    }),
    y = Object.freeze({
        keyw: 'queue_waiting',
        keyc: 'queue_called',
        keya: 'queue_all',
        keyo: 'queue_all',
        keyl: 'queue_sla_risk',
    });
function v(e) {
    return {
        key: String(e.key || '').toLowerCase(),
        code: String(e.code || '').toLowerCase(),
    };
}
let k = '';
async function w(e, t = {}) {
    const a = String(t.method || 'GET').toUpperCase(),
        n = {
            method: a,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(t.headers || {}) },
        };
    ('GET' !== a && k && (n.headers['X-CSRF-Token'] = k),
        void 0 !== t.body &&
            ((n.headers['Content-Type'] = 'application/json'),
            (n.body = JSON.stringify(t.body))));
    const i = await fetch(e, n),
        o = await i.text();
    let s;
    try {
        s = o ? JSON.parse(o) : {};
    } catch (e) {
        throw new Error(`Respuesta no valida (${i.status})`);
    }
    if (
        ((s = (function (e) {
            return e && 'object' == typeof e ? e : {};
        })(s)),
        !i.ok || !1 === s.ok)
    )
        throw new Error(s.error || s.message || `HTTP ${i.status}`);
    return s;
}
function q(e) {
    k = String(e || '');
}
async function S(e, t = {}) {
    return w(`/api.php?resource=${encodeURIComponent(e)}`, t);
}
async function C(e, t = {}) {
    return w(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
}
const _ = {
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
function A(e) {
    return `<svg class="icon icon-${e}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${_[e] || _.menu}</svg>`;
}
function $(e) {
    return `\n        <div class="sony-theme-switcher ${e}" role="group" aria-label="Tema">\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${A('sun')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${A('moon')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${A('system')}</button>\n        </div>\n    `;
}
function T(e, t, a, n = !1) {
    return `\n        <a\n            href="#${e}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${e}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${A(a)}\n            <span>${t}</span>\n            <span class="badge" id="${e}Badge">0</span>\n        </a>\n    `;
}
function M() {
    return `\n        <div class="admin-v3-shell">\n            \n        <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <div class="admin-v3-sidebar__brand">\n                    <strong>Piel en Armonia</strong>\n                    <small>Admin sony_v3</small>\n                </div>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${A('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                \n        ${T('dashboard', 'Dashboard', 'dashboard', !0)}\n        ${T('appointments', 'Citas', 'appointments')}\n        ${T('callbacks', 'Callbacks', 'callbacks')}\n        ${T('reviews', 'Resenas', 'reviews')}\n        ${T('availability', 'Disponibilidad', 'availability')}\n        ${T('queue', 'Turnero Sala', 'queue')}\n    \n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${A('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n    \n            \n        <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n            \n        <header class="admin-v3-topbar">\n            <div class="admin-v3-topbar__copy">\n                <p class="sony-kicker">Sony V3</p>\n                <h2 id="pageTitle">Dashboard</h2>\n            </div>\n            <div class="admin-v3-topbar__actions">\n                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${A('menu')}<span>Menu</span></button>\n                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                ${$('admin-theme-switcher-header')}\n            </div>\n        </header>\n    \n            \n        <section class="admin-v3-context-strip" id="adminProductivityStrip">\n            <div class="admin-v3-context-copy" data-admin-section-hero>\n                <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                <div id="adminContextActions" class="sony-context-actions"></div>\n            </div>\n            <div class="admin-v3-status-rail" data-admin-priority-rail>\n                <article class="sony-status-tile">\n                    <span>Push</span>\n                    <strong id="pushStatusIndicator">Inicializando</strong>\n                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                </article>\n                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                    <span>Sesion</span>\n                    <strong id="adminSessionState">No autenticada</strong>\n                    <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                </article>\n                <article class="sony-status-tile">\n                    <span>Sincronizacion</span>\n                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                    <small id="adminSyncState">Listo para primera sincronizacion</small>\n                </article>\n            </div>\n        </section>\n    \n            \n        \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                \n        <article class="sony-panel dashboard-hero-panel">\n            <div class="dashboard-hero-copy">\n                <p class="sony-kicker">Resumen diario</p>\n                <h3>Prioridades de hoy</h3>\n                <p id="dashboardHeroSummary">\n                    Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                </p>\n            </div>\n            <div class="dashboard-hero-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n            </div>\n            <div class="dashboard-hero-metrics">\n                <div class="dashboard-hero-metric">\n                    <span>Rating</span>\n                    <strong id="dashboardHeroRating">0.0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Reseñas 30d</span>\n                    <strong id="dashboardHeroRecentReviews">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Urgentes SLA</span>\n                    <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Transferencias</span>\n                    <strong id="dashboardHeroPendingTransfers">0</strong>\n                </div>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel dashboard-signal-panel">\n            <header>\n                <div>\n                    <h3>Señal operativa</h3>\n                    <small id="operationRefreshSignal">Tiempo real</small>\n                </div>\n                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n            </header>\n            <p id="dashboardLiveMeta">\n                Sin alertas criticas en la operacion actual.\n            </p>\n            <div class="dashboard-signal-stack">\n                <article class="dashboard-signal-card">\n                    <span>Push</span>\n                    <strong id="dashboardPushStatus">Sin validar</strong>\n                    <small id="dashboardPushMeta">Permisos del navegador</small>\n                </article>\n                <article class="dashboard-signal-card">\n                    <span>Atencion</span>\n                    <strong id="dashboardQueueHealth">Cola: estable</strong>\n                    <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                </article>\n            </div>\n            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-grid sony-grid-kpi">\n            <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n            <article class="sony-kpi"><h3>Reseñas</h3><strong id="totalReviewsCount">0</strong></article>\n            <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n            <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-two">\n            <article class="sony-panel dashboard-card-operations">\n                <header>\n                    <h3>Centro operativo</h3>\n                    <small id="operationDeckMeta">Prioridades y acciones</small>\n                </header>\n                <div class="sony-panel-stats">\n                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                    <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                    <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                </div>\n                <p id="operationQueueHealth">Cola: estable</p>\n                <div id="operationActionList" class="operations-action-list"></div>\n            </article>\n\n            <article class="sony-panel" id="funnelSummary">\n                <header><h3>Embudo</h3></header>\n                <div class="sony-panel-stats">\n                    <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                    <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                    <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                </div>\n            </article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-three">\n            <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n        </div>\n    \n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n    \n        \n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                \n        <article class="sony-panel appointments-command-deck">\n            <header class="section-header appointments-command-head">\n                <div>\n                    <p class="sony-kicker">Agenda clinica</p>\n                    <h3>Citas</h3>\n                    <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                </div>\n                <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n            </header>\n            <div class="appointments-ops-grid">\n                <article class="appointments-ops-card tone-warning">\n                    <span>Transferencias</span>\n                    <strong id="appointmentsOpsPendingTransfer">0</strong>\n                    <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                </article>\n                <article class="appointments-ops-card tone-neutral">\n                    <span>Proximas 48h</span>\n                    <strong id="appointmentsOpsUpcomingCount">0</strong>\n                    <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                </article>\n                <article class="appointments-ops-card tone-danger">\n                    <span>No show</span>\n                    <strong id="appointmentsOpsNoShowCount">0</strong>\n                    <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                </article>\n                <article class="appointments-ops-card tone-success">\n                    <span>Hoy</span>\n                    <strong id="appointmentsOpsTodayCount">0</strong>\n                    <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                </article>\n            </div>\n            <div class="appointments-command-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel appointments-focus-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                    <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                    <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                </div>\n            </header>\n            <div class="appointments-focus-grid">\n                <div class="appointments-focus-stat">\n                    <span>Siguiente ventana</span>\n                    <strong id="appointmentsFocusWindow">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Pago</span>\n                    <strong id="appointmentsFocusPayment">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Estado</span>\n                    <strong id="appointmentsFocusStatus">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Contacto</span>\n                    <strong id="appointmentsFocusContact">-</strong>\n                </div>\n            </div>\n            <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n            <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel appointments-workbench">\n            <header class="section-header appointments-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                </div>\n                <div class="toolbar-group" id="appointmentsDensityToggle">\n                    <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                    <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                </div>\n            </div>\n            <div class="toolbar-row appointments-toolbar">\n                <label>\n                    <span class="sr-only">Filtro</span>\n                    <select id="appointmentFilter">\n                        <option value="all">Todas</option>\n                        <option value="pending_transfer">Transferencias por validar</option>\n                        <option value="upcoming_48h">Proximas 48h</option>\n                        <option value="no_show">No show</option>\n                        <option value="triage_attention">Triage accionable</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden</span>\n                    <select id="appointmentSort">\n                        <option value="datetime_desc">Fecha reciente</option>\n                        <option value="datetime_asc">Fecha ascendente</option>\n                        <option value="patient_az">Paciente (A-Z)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                <p id="appointmentsToolbarState">Sin filtros activos</p>\n            </div>\n\n            <div class="table-scroll appointments-table-shell">\n                <table id="appointmentsTable" class="sony-table">\n                    <thead>\n                        <tr>\n                            <th>Paciente</th>\n                            <th>Servicio</th>\n                            <th>Fecha</th>\n                            <th>Pago</th>\n                            <th>Estado</th>\n                            <th>Acciones</th>\n                        </tr>\n                    </thead>\n                    <tbody id="appointmentsTableBody"></tbody>\n                </table>\n            </div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                \n        <article class="sony-panel callbacks-command-deck">\n            <header class="section-header callbacks-command-head">\n                <div>\n                    <p class="sony-kicker">SLA telefonico</p>\n                    <h3>Callbacks</h3>\n                    <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                </div>\n                <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n            </header>\n            <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hot</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n            </div>\n            <div class="callbacks-command-actions">\n                <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel callbacks-next-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                    <h3 id="callbacksOpsNext">Sin telefono</h3>\n                    <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                </div>\n                <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n            </header>\n            <div class="callbacks-next-grid">\n                <div class="callbacks-next-stat">\n                    <span>Espera</span>\n                    <strong id="callbacksNextWait">0 min</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Servicio</span>\n                    <strong id="callbacksNextPreference">-</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Accion</span>\n                    <strong id="callbacksNextState">Pendiente</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Estado IA</span>\n                    <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                </div>\n            </div>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel callbacks-workbench">\n            <header class="section-header callbacks-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p>Ordena por prioridad comercial, genera borradores IA y registra el outcome sin salir del panel.</p>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                </div>\n            </div>\n            <div class="toolbar-row callbacks-toolbar">\n                <label>\n                    <span class="sr-only">Filtro callbacks</span>\n                    <select id="callbackFilter">\n                        <option value="all">Todos</option>\n                        <option value="pending">Pendientes</option>\n                        <option value="contacted">Contactados</option>\n                        <option value="today">Hoy</option>\n                        <option value="sla_urgent">Urgentes SLA</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden callbacks</span>\n                    <select id="callbackSort">\n                        <option value="priority_desc">Prioridad comercial</option>\n                        <option value="recent_desc">Mas recientes</option>\n                        <option value="waiting_desc">Mayor espera (SLA)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchCallbacks" placeholder="Buscar telefono o servicio" />\n                <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="callbacksToolbarMeta">Mostrando 0</p>\n                <p id="callbacksToolbarState">Sin filtros activos</p>\n            </div>\n            <div id="callbacksGrid" class="callbacks-grid"></div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                \n        <header class="section-header availability-header">\n            <div class="availability-calendar">\n                <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                <div class="availability-badges">\n                    <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                    <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                    <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                </div>\n            </div>\n            <div class="toolbar-group calendar-header">\n                <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                <strong id="calendarMonth"></strong>\n                <button type="button" data-action="change-month" data-delta="1">Next</button>\n                <button type="button" data-action="availability-today">Hoy</button>\n                <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n            </div>\n        </header>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n            <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n            <p id="availabilitySyncStatus">Sincronizado</p>\n        </div>\n    \n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n                \n        <div id="availabilityDetailGrid" class="availability-detail-grid">\n            <article class="sony-panel soft">\n                <h4 id="selectedDate">-</h4>\n                <div id="timeSlotsList" class="time-slots-list"></div>\n            </article>\n\n            <article class="sony-panel soft">\n                <div id="availabilityQuickSlotPresets" class="slot-presets">\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                </div>\n                <div id="addSlotForm" class="add-slot-form">\n                    <input type="time" id="newSlotTime" />\n                    <button type="button" data-action="add-time-slot">Agregar</button>\n                </div>\n                <div id="availabilityDayActions" class="toolbar-group wrap">\n                    <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                    <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                    <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                    <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                    <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                    <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                </div>\n                <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                <div class="toolbar-group">\n                    <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                    <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                </div>\n            </article>\n        </div>\n    \n            </div>\n        </section>\n    \n        \n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                \n        <header class="section-header">\n            <div>\n                <h3>Turnero Sala</h3>\n                <p>\n                    Apps operativas, cola en vivo y flujo simple para recepción,\n                    kiosco y TV.\n                </p>\n            </div>\n            <div class="queue-admin-header-actions">\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                <button type="button" data-action="queue-refresh-state">Refrescar</button>\n            </div>\n        </header>\n    \n                \n        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft">\n            <div class="queue-apps-hub__header">\n                <div>\n                    <h4>Apps operativas</h4>\n                    <p>\n                        Instala Operador, Kiosco y Sala TV desde el mismo centro de\n                        control para separar cada equipo por uso.\n                    </p>\n                </div>\n                <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">\n                    Plataforma detectada\n                </span>\n            </div>\n            <div id="queueOpsPilot" class="queue-ops-pilot"></div>\n            <div id="queueAppDownloadsCards" class="queue-apps-grid"></div>\n            <div id="queueSurfaceTelemetry" class="queue-surface-telemetry"></div>\n            <div id="queueOpeningChecklist" class="queue-opening-checklist"></div>\n            <div id="queueContingencyDeck" class="queue-contingency-deck"></div>\n            <div id="queueInstallConfigurator" class="queue-install-configurator"></div>\n        </div>\n    \n                \n        <div class="sony-grid sony-grid-kpi slim">\n            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n        </div>\n    \n                \n        <div id="queueStationControl" class="toolbar-row">\n            <span id="queueStationBadge">Estacion: libre</span>\n            <span id="queueStationModeBadge">Modo: free</span>\n            <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n            <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n            <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n            <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n            <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n            <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n            <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n            <button type="button" data-action="queue-stop-practice">Salir practica</button>\n            <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n            <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n        </div>\n    \n                \n        <div id="queueShortcutPanel" hidden>\n            <p>Numpad Enter llama siguiente.</p>\n            <p>Numpad Decimal prepara completar.</p>\n            <p>Numpad Subtract prepara no_show.</p>\n            <p>Numpad Add re-llama el ticket activo.</p>\n        </div>\n    \n                \n        <div id="queueTriageToolbar" class="toolbar-row">\n            <button type="button" data-queue-filter="all">Todo</button>\n            <button type="button" data-queue-filter="called">Llamados</button>\n            <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n            <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n            <button type="button" data-action="queue-clear-search">Limpiar</button>\n            <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n            <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n            <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n        </div>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="queueTriageSummary">Sin riesgo</p>\n            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n        </div>\n    \n                \n        <ul id="queueNextAdminList" class="sony-list"></ul>\n\n        <div class="table-scroll">\n            <table class="sony-table queue-admin-table">\n                <thead>\n                    <tr>\n                        <th>Sel</th>\n                        <th>Ticket</th>\n                        <th>Tipo</th>\n                        <th>Estado</th>\n                        <th>Consultorio</th>\n                        <th>Espera</th>\n                        <th>Acciones</th>\n                    </tr>\n                </thead>\n                <tbody id="queueTableBody"></tbody>\n            </table>\n        </div>\n\n        <div id="queueActivityPanel" class="sony-panel soft">\n            <h4>Actividad</h4>\n            <ul id="queueActivityList" class="sony-list"></ul>\n        </div>\n    \n            </div>\n\n            \n        <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n            <form method="dialog">\n                <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                <div class="toolbar-group">\n                    <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                    <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                </div>\n            </form>\n        </dialog>\n    \n        </section>\n    \n    \n        </main>\n    \n            \n        <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n            <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n            <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                <div class="admin-command-dialog__head">\n                    <div>\n                        <p class="sony-kicker">Command Palette</p>\n                        <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                    </div>\n                    <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                </div>\n                <div class="admin-command-box">\n                    <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                </div>\n                <div class="admin-command-dialog__hints">\n                    <span>Ctrl+K abre esta paleta</span>\n                    <span>/ enfoca la busqueda de la seccion activa</span>\n                </div>\n            </div>\n        </div>\n    \n        </div>\n    `;
}
const L = {
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
            eyebrow: 'Apps Operativas',
            title: 'Operacion simple de recepcion y sala',
            summary:
                'Centraliza instaladores, flujo de operador con numpad y cola en vivo sin mezclar cada equipo en una sola pantalla.',
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
    },
    E = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    };
function N() {
    const e = t('#loginScreen'),
        a = t('#adminDashboard');
    (e && e.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function B() {
    const e = t('#loginScreen'),
        a = t('#adminDashboard');
    (e && e.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function D() {
    const e = t('#adminCommandPalette');
    e instanceof HTMLElement &&
        (e.classList.remove('is-hidden'),
        e.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function P() {
    const e = t('#adminCommandPalette');
    e instanceof HTMLElement &&
        (e.classList.add('is-hidden'),
        e.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function I(e) {
    (a('.admin-section').forEach((t) => {
        t.classList.toggle('active', t.id === e);
    }),
        a('.nav-item[data-section]').forEach((t) => {
            const a = t.dataset.section === e;
            (t.classList.toggle('active', a),
                a
                    ? t.setAttribute('aria-current', 'page')
                    : t.removeAttribute('aria-current'));
        }),
        a('.admin-quick-nav-item[data-section]').forEach((t) => {
            const a = t.dataset.section === e;
            (t.classList.toggle('active', a),
                t.setAttribute('aria-pressed', String(a)));
        }));
    const n = E[e] || 'Dashboard',
        i = t('#pageTitle');
    i && (i.textContent = n);
}
function x(e) {
    const a = t('#group2FA'),
        n = t('#adminLoginStepSummary'),
        i = t('#adminLoginStepEyebrow'),
        o = t('#adminLoginStepTitle'),
        s = t('#adminLoginSupportCopy'),
        r = t('#loginReset2FABtn'),
        l = t('#loginForm');
    a &&
        (a.classList.toggle('is-hidden', !e),
        l?.classList.toggle('is-2fa-stage', Boolean(e)),
        r?.classList.toggle('is-hidden', !e),
        i &&
            (i.textContent = e
                ? 'Verificacion secundaria'
                : 'Ingreso protegido'),
        o &&
            (o.textContent = e
                ? 'Confirma el codigo 2FA'
                : 'Acceso de administrador'),
        n &&
            (n.textContent = e
                ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
                : 'Usa tu clave para entrar al centro operativo.'),
        s &&
            (s.textContent = e
                ? 'El backend ya valido la clave. Falta la segunda verificacion.'
                : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.'),
        H(!1));
}
function O({
    tone: e = 'neutral',
    title: a = 'Proteccion activa',
    message: n = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const i = t('#adminLoginStatusCard'),
        o = t('#adminLoginStatusTitle'),
        s = t('#adminLoginStatusMessage');
    (i?.setAttribute('data-state', e),
        o && (o.textContent = a),
        s && (s.textContent = n));
}
function H(e) {
    const a = t('#loginBtn'),
        n = t('#loginReset2FABtn'),
        i = t('#adminPassword'),
        o = t('#admin2FACode'),
        s = t('#group2FA'),
        r = Boolean(s && !s.classList.contains('is-hidden'));
    (i instanceof HTMLInputElement && (i.disabled = Boolean(e) || r),
        o instanceof HTMLInputElement && (o.disabled = Boolean(e) || !r),
        a instanceof HTMLButtonElement &&
            ((a.disabled = Boolean(e)),
            (a.textContent = e
                ? r
                    ? 'Verificando...'
                    : 'Ingresando...'
                : r
                  ? 'Verificar y entrar'
                  : 'Ingresar')),
        n instanceof HTMLButtonElement && (n.disabled = Boolean(e)));
}
function F({ clearPassword: e = !1 } = {}) {
    const a = t('#adminPassword'),
        n = t('#admin2FACode');
    (a instanceof HTMLInputElement && e && (a.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function j(e = 'password') {
    const a = t('2fa' === e ? '#admin2FACode' : '#adminPassword');
    a instanceof HTMLInputElement && (a.focus(), a.select?.());
}
function R(a) {
    const n = (function (e) {
        const t = L[e?.ui?.activeSection || 'dashboard'] || L.dashboard,
            a = e?.auth && 'object' == typeof e.auth ? e.auth : {},
            n = Array.isArray(e?.data?.appointments) ? e.data.appointments : [],
            i = Array.isArray(e?.data?.callbacks) ? e.data.callbacks : [],
            o = Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
            s =
                e?.data?.availability && 'object' == typeof e.data.availability
                    ? e.data.availability
                    : {},
            r = Array.isArray(e?.data?.queueTickets) ? e.data.queueTickets : [],
            l =
                e?.data?.queueMeta && 'object' == typeof e.data.queueMeta
                    ? e.data.queueMeta
                    : null,
            c = (function (e) {
                return e.filter((e) => {
                    const t = String(
                        e.paymentStatus || e.payment_status || ''
                    ).toLowerCase();
                    return (
                        'pending_transfer_review' === t ||
                        'pending_transfer' === t
                    );
                }).length;
            })(n),
            u = (function (e) {
                return e.filter((e) => {
                    const t = String(e.status || '')
                        .toLowerCase()
                        .trim();
                    return 'pending' === t || 'pendiente' === t;
                }).length;
            })(i),
            d = (function (e) {
                return Object.values(e || {}).filter(
                    (e) => Array.isArray(e) && e.length > 0
                ).length;
            })(s),
            p = (function (e, t) {
                return t && Number.isFinite(Number(t.waitingCount))
                    ? Math.max(0, Number(t.waitingCount))
                    : (Array.isArray(e) ? e : []).filter(
                          (e) =>
                              'waiting' === String(e.status || '').toLowerCase()
                      ).length;
            })(r, l);
        return {
            auth: a,
            config: t,
            appointments: n,
            reviews: o,
            pendingTransfers: c,
            pendingCallbacks: u,
            availabilityDays: d,
            waitingTickets: p,
            dashboardAlerts: c + u,
        };
    })(a);
    ((function (t, a) {
        (r('#adminSectionEyebrow', a.eyebrow),
            r('#adminContextTitle', a.title),
            r('#adminContextSummary', a.summary),
            l(
                '#adminContextActions',
                a.actions
                    .map((t) =>
                        (function (t) {
                            return `\n        <button type="button" class="sony-context-action" ${[`data-action="${e(t.action)}"`, t.queueConsultorio ? `data-queue-consultorio="${e(t.queueConsultorio)}"` : '', t.filterValue ? `data-filter-value="${e(t.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${e(t.label)}</strong>\n                <small>${e(t.meta)}</small>\n            </span>\n            <span class="sony-context-action-key">${e(t.shortcut || '')}</span>\n        </button>\n    `;
                        })(t)
                    )
                    .join('')
            ),
            r(
                '#adminSyncState',
                (function (e) {
                    const t = Number(e || 0);
                    return t
                        ? `Ultima carga ${new Date(t).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Listo para primera sincronizacion';
                })(t?.ui?.lastRefreshAt || 0)
            ));
    })(a, n.config),
        (function (e) {
            (r('#dashboardBadge', e.dashboardAlerts),
                r('#appointmentsBadge', e.appointments.length),
                r('#callbacksBadge', e.pendingCallbacks),
                r('#reviewsBadge', e.reviews.length),
                r('#availabilityBadge', e.availabilityDays),
                r('#queueBadge', e.waitingTickets));
        })(n),
        (function (e) {
            const a = t('#adminSessionTile'),
                n = e.authenticated
                    ? 'Sesion activa'
                    : e.requires2FA
                      ? 'Verificacion 2FA'
                      : 'No autenticada',
                i = e.authenticated
                    ? 'success'
                    : e.requires2FA
                      ? 'warning'
                      : 'neutral';
            (a?.setAttribute('data-state', i),
                r('#adminSessionState', n),
                r(
                    '#adminSessionMeta',
                    (function (e) {
                        const t = e && 'object' == typeof e ? e : {};
                        if (t.authenticated) {
                            const e =
                                    {
                                        session: 'sesion restaurada',
                                        password: 'clave validada',
                                        '2fa': '2FA validado',
                                    }[String(t.authMethod || '')] ||
                                    'acceso validado',
                                a = Number(t.lastAuthAt || 0);
                            return a
                                ? `Protegida por ${e}. ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                                : `Protegida por ${e}.`;
                        }
                        return t.requires2FA
                            ? 'Esperando codigo de seis digitos para completar el acceso.'
                            : 'Autenticate para operar el panel.';
                    })(e)
                ));
        })(n.auth));
}
const z = {
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
        hero: '#queueAppsHub',
        workbench: '.queue-admin-table',
        detail: '#queueActivityPanel',
    },
};
function V(e, a, n) {
    if (!a) return;
    const i = t(`#${e}`);
    if (!(i instanceof HTMLElement)) return;
    const o = i.querySelector(a);
    o instanceof HTMLElement && o.setAttribute(n, 'true');
}
const U = 'admin-appointments-sort',
    K = 'admin-appointments-density',
    Q = 'datetime_desc',
    W = 'comfortable';
function G(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function J(e) {
    return G(e.paymentStatus || e.payment_status || '');
}
function Y(e) {
    return G(e);
}
function Z(e, t = '-') {
    const a = String(e || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    return a
        ? a
              .split(/\s+/)
              .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
              .join(' ')
        : t;
}
function X(e) {
    return (function (e) {
        const t = new Date(e || '');
        return Number.isNaN(t.getTime()) ? 0 : t.getTime();
    })(`${e?.date || ''}T${e?.time || '00:00'}:00`);
}
function ee(e) {
    if (!e) return 'Sin fecha';
    const t = Math.round((e - Date.now()) / 6e4),
        a = Math.abs(t);
    return t < 0
        ? a < 60
            ? `Hace ${a} min`
            : a < 1440
              ? `Hace ${Math.round(a / 60)} h`
              : 'Ya ocurrio'
        : t < 60
          ? `En ${Math.max(t, 0)} min`
          : t < 1440
            ? `En ${Math.round(t / 60)} h`
            : `En ${Math.round(t / 1440)} d`;
}
function te(e) {
    const t = X(e);
    if (!t) return !1;
    const a = new Date(t),
        n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function ae(e) {
    const t = X(e);
    if (!t) return !1;
    const a = t - Date.now();
    return a >= 0 && a <= 1728e5;
}
function ne(e) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[G(e)] || Z(e, 'Pendiente')
    );
}
function ie(e) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[G(e)] || Z(e, 'Pendiente')
    );
}
function oe(e) {
    const t = J(e),
        a = Y(e.status);
    return (
        'pending_transfer_review' === t ||
        'pending_transfer' === t ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function se(e, t) {
    const a = G(t);
    return 'pending_transfer' === a
        ? e.filter((e) => {
              const t = J(e);
              return (
                  'pending_transfer_review' === t || 'pending_transfer' === t
              );
          })
        : 'upcoming_48h' === a
          ? e.filter(ae)
          : 'no_show' === a
            ? e.filter((e) => 'no_show' === Y(e.status))
            : 'triage_attention' === a
              ? e.filter(oe)
              : e;
}
function re(e) {
    const t = J(e),
        a = Y(e.status),
        n = X(e);
    return 'pending_transfer_review' === t || 'pending_transfer' === t
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
            : te(e)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: n ? ee(n) : 'Agenda del dia',
                }
              : ae(e)
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
function le(e) {
    const t = e
            .map((e) => ({ item: e, stamp: X(e) }))
            .sort((e, t) => e.stamp - t.stamp),
        a = t.find(({ item: e }) => {
            const t = J(e);
            return 'pending_transfer_review' === t || 'pending_transfer' === t;
        });
    if (a)
        return {
            item: a.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const n = t.find(({ item: e }) => 'no_show' === Y(e.status));
    if (n)
        return {
            item: n.item,
            label: 'Seguimiento abierto',
            hint: 'Define si se reprograma o se cierra la incidencia.',
            tags: ['No show', 'Seguimiento'],
        };
    const i = t.find(({ stamp: e }) => e >= Date.now());
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
function ce(t) {
    return t.length
        ? t
              .map((t) => {
                  const a = X(t);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(t.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${e(t.name || 'Sin nombre')}</strong>\n                            <span>${e(t.email || 'Sin email')}</span>\n                            <small>${e(t.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">${(function (
                      t
                  ) {
                      const a = re(t);
                      return `\n        <div class="appointment-service">\n            <strong>${e(Z(t.service, 'Servicio pendiente'))}</strong>\n            <span>Especialista: ${e(Z(t.doctor, 'Sin asignar'))}</span>\n            <small>${e(a.label)} | ${e(a.note)}</small>\n        </div>\n    `;
                  })(
                      t
                  )}</td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${e(n(t.date))}</strong>\n                            <span>${e(t.time || '--:--')}</span>\n                            <small>${e(ee(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
                      t
                  ) {
                      const a = t.paymentStatus || t.payment_status || '',
                          n = String(
                              t.transferProofUrl ||
                                  t.transferProofURL ||
                                  t.transfer_proof_url ||
                                  ''
                          ).trim();
                      return `\n        <div class="appointment-payment-stack">\n            <span class="appointment-pill" data-tone="${e(
                          (function (e) {
                              const t = G(e);
                              return 'paid' === t
                                  ? 'success'
                                  : 'failed' === t
                                    ? 'danger'
                                    : 'pending_cash' === t
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${e(ne(a))}</span>\n            <small>Metodo: ${e(((i = t.paymentMethod || t.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[G(i)] || Z(i, 'Metodo pendiente')))}</small>\n            ${n ? `<a href="${e(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      t
                  )}</td>\n                    <td data-label="Estado">${(function (
                      t
                  ) {
                      const a = Y(t.status),
                          n = J(t),
                          i = re(t),
                          o = [];
                      return (
                          'pending_transfer_review' === n &&
                              o.push('Transferencia por validar'),
                          'no_show' === a && o.push('Paciente ausente'),
                          'cancelled' === a && o.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${e(
                              (function (e) {
                                  const t = G(e);
                                  return 'completed' === t
                                      ? 'success'
                                      : 'cancelled' === t || 'no_show' === t
                                        ? 'danger'
                                        : 'pending' === t
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${e(ie(a))}</span>\n            <small>${e(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      t
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      t
                  ) {
                      const a = Number(t.id || 0),
                          n = J(t),
                          i = (function (e) {
                              const t = String(e || '').replace(/\D+/g, '');
                              return t ? `https://wa.me/${t}` : '';
                          })(t.phone || ''),
                          o = [];
                      return (
                          i &&
                              o.push(
                                  `<a href="${e(i)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${e(t.name || 'Paciente')}" title="WhatsApp para seguimiento">WhatsApp</a>`
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
                  })(t)}</td>\n                </tr>\n            `;
              })
              .join('')
        : `<tr class="table-empty-row"><td colspan="6">${e('No hay citas para el filtro actual.')}</td></tr>`;
}
function ue() {
    const t = b(),
        a = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        i = t?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (e, t) {
            const a = G(t),
                n = [...e];
            return 'patient_az' === a
                ? (n.sort((e, t) => G(e.name).localeCompare(G(t.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort((e, t) => X(e) - X(t)), n)
                  : (n.sort((e, t) => X(t) - X(e)), n);
        })(
            (function (e, t) {
                const a = G(t);
                return a
                    ? e.filter((e) =>
                          [
                              e.name,
                              e.email,
                              e.phone,
                              e.service,
                              e.doctor,
                              e.paymentStatus,
                              e.payment_status,
                              e.status,
                          ].some((e) => G(e).includes(a))
                      )
                    : e;
            })(se(a, i.filter), i.search),
            i.sort
        );
    (l('#appointmentsTableBody', ce(o)),
        (function (e, t, a) {
            (r('#appointmentsToolbarMeta', `Mostrando ${t} de ${a}`),
                r(
                    '#appointmentsToolbarState',
                    (function (e, t) {
                        const a = [];
                        if ('all' !== G(e.filter)) {
                            const t = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            a.push(t[G(e.filter)] || e.filter);
                        }
                        return (
                            G(e.search) && a.push(`Busqueda: ${e.search}`),
                            'patient_az' === G(e.sort)
                                ? a.push('Paciente (A-Z)')
                                : 'datetime_asc' === G(e.sort)
                                  ? a.push('Fecha ascendente')
                                  : a.push('Fecha reciente'),
                            0 === t && a.push('Resultados: 0'),
                            a
                        );
                    })(e, t).join(' | ')
                ));
            const n = document.getElementById('clearAppointmentsFiltersBtn');
            if (n) {
                const t = 'all' !== G(e.filter) || '' !== G(e.search);
                n.classList.toggle('is-hidden', !t);
            }
            const i = document.getElementById('appointmentFilter');
            i instanceof HTMLSelectElement && (i.value = e.filter);
            const o = document.getElementById('appointmentSort');
            o instanceof HTMLSelectElement && (o.value = e.sort);
            const s = document.getElementById('searchAppointments');
            s instanceof HTMLInputElement &&
                s.value !== e.search &&
                (s.value = e.search);
            const l = document.getElementById('appointments');
            (l &&
                l.classList.toggle(
                    'appointments-density-compact',
                    'compact' === G(e.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((t) => {
                        const a = G(t.dataset.density) === G(e.density);
                        t.classList.toggle('is-active', a);
                    }),
                (function (e) {
                    const t = G(e);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((e) => {
                            const a = G(e.dataset.filterValue) === t;
                            e.classList.toggle('is-active', a);
                        });
                })(e.filter),
                (function (e) {
                    try {
                        (localStorage.setItem(U, JSON.stringify(e.sort)),
                            localStorage.setItem(K, JSON.stringify(e.density)));
                    } catch (e) {}
                })(e));
        })(i, o.length, a.length),
        (function (t, a, i) {
            (r('#appointmentsOpsPendingTransfer', t.pendingTransferCount),
                r(
                    '#appointmentsOpsPendingTransferMeta',
                    t.pendingTransferCount > 0
                        ? `${t.pendingTransferCount} pago(s) detenidos`
                        : 'Nada por validar'
                ),
                r('#appointmentsOpsUpcomingCount', t.upcomingCount),
                r(
                    '#appointmentsOpsUpcomingMeta',
                    t.upcomingCount > 0
                        ? `${t.upcomingCount} cita(s) dentro de 48h`
                        : 'Sin presion inmediata'
                ),
                r('#appointmentsOpsNoShowCount', t.noShowCount),
                r(
                    '#appointmentsOpsNoShowMeta',
                    t.noShowCount > 0
                        ? `${t.noShowCount} caso(s) con seguimiento`
                        : 'Sin incidencias'
                ),
                r('#appointmentsOpsTodayCount', t.todayCount),
                r(
                    '#appointmentsOpsTodayMeta',
                    t.todayCount > 0
                        ? `${t.todayCount} cita(s) en agenda de hoy`
                        : 'Carga diaria limpia'
                ),
                r(
                    '#appointmentsDeckSummary',
                    i > 0
                        ? `${t.pendingTransferCount} transferencia(s), ${t.triageCount} frente(s) accionables y ${a} cita(s) visibles.`
                        : 'Sin citas cargadas.'
                ),
                r(
                    '#appointmentsWorkbenchHint',
                    t.pendingTransferCount > 0
                        ? 'Primero valida pagos; luego ordena la mesa por fecha o paciente.'
                        : t.triageCount > 0
                          ? 'La agenda tiene incidencias abiertas dentro de esta misma mesa.'
                          : 'Filtros, orden y tabla en un workbench unico.'
                ));
            const o = document.getElementById('appointmentsDeckChip');
            if (o) {
                const e =
                    t.pendingTransferCount > 0 || t.noShowCount > 0
                        ? 'warning'
                        : 'success';
                ((o.textContent =
                    'warning' === e ? 'Atencion operativa' : 'Agenda estable'),
                    o.setAttribute('data-state', e));
            }
            const s = t.focus;
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
                    l('#appointmentsFocusTags', ''),
                    void r('#appointmentsFocusHint', s.hint)
                );
            const c = s.item;
            (r('#appointmentsFocusPatient', c.name || 'Sin nombre'),
                r(
                    '#appointmentsFocusMeta',
                    `${Z(c.service, 'Servicio pendiente')} | ${n(c.date)} ${c.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', ee(X(c))),
                r(
                    '#appointmentsFocusPayment',
                    ne(c.paymentStatus || c.payment_status)
                ),
                r('#appointmentsFocusStatus', ie(c.status)),
                r('#appointmentsFocusContact', c.phone || 'Sin telefono'),
                l(
                    '#appointmentsFocusTags',
                    s.tags
                        .map(
                            (t) =>
                                `<span class="appointments-focus-tag">${e(t)}</span>`
                        )
                        .join('')
                ),
                r('#appointmentsFocusHint', s.hint));
        })(
            (function (e) {
                const t = se(e, 'pending_transfer'),
                    a = se(e, 'upcoming_48h'),
                    n = se(e, 'no_show'),
                    i = se(e, 'triage_attention'),
                    o = e.filter(te);
                return {
                    pendingTransferCount: t.length,
                    upcomingCount: a.length,
                    noShowCount: n.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: le(e),
                };
            })(a),
            o.length,
            a.length
        ));
}
function de(e) {
    (g((t) => ({ ...t, appointments: { ...t.appointments, ...e } })), ue());
}
function pe(e) {
    de({ filter: G(e) || 'all' });
}
function me(e) {
    de({ search: String(e || '') });
}
function be(e, t) {
    const a = Number(e || 0);
    (g((e) => ({
        ...e,
        data: {
            ...e.data,
            appointments: (e.data.appointments || []).map((e) =>
                Number(e.id || 0) === a ? { ...e, ...t } : e
            ),
        },
    })),
        ue());
}
async function ge(e, t) {
    await S('appointments', {
        method: 'PATCH',
        body: { id: Number(e || 0), ...t },
    });
}
const fe = 'admin-callbacks-sort',
    he = 'admin-callbacks-filter',
    ye = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    ve = new Set(['priority_desc', 'recent_desc', 'waiting_desc']);
function ke(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function we(e) {
    const t = ke(e);
    return ye.has(t) ? t : 'all';
}
function qe(e) {
    const t = ke(e);
    return ve.has(t) ? t : 'priority_desc';
}
function Se(e) {
    const t = ke(e);
    return t.includes('contact') || 'resolved' === t || 'atendido' === t
        ? 'contacted'
        : 'pending';
}
function Ce(e) {
    return e?.leadOps && 'object' == typeof e.leadOps ? e.leadOps : {};
}
function _e(e) {
    const t = new Date(e?.fecha || e?.createdAt || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function Ae(e) {
    const t = _e(e);
    return t ? Math.max(0, Math.round((Date.now() - t) / 6e4)) : 0;
}
function $e(e) {
    return e < 60
        ? `${e} min`
        : e < 1440
          ? `${Math.round(e / 60)} h`
          : `${Math.round(e / 1440)} d`;
}
function Te(e) {
    return (
        String(e?.telefono || e?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function Me(e) {
    const t = ke(Ce(e).priorityBand);
    return 'hot' === t || 'warm' === t ? t : 'cold';
}
function Le(e) {
    const t = Me(e);
    return 'hot' === t ? 3 : 'warm' === t ? 2 : 1;
}
function Ee(e) {
    const t = Array.isArray(Ce(e).serviceHints) ? Ce(e).serviceHints : [];
    return String(t[0] || '').trim() || 'Sin sugerencia';
}
function Ne(e) {
    return (
        String(Ce(e).nextAction || '').trim() || 'Mantener visible en la cola'
    );
}
function Be(e, t = '') {
    const a = ke(Ce(e).aiStatus);
    return 'requested' === a
        ? 'online' === t
            ? 'IA pendiente'
            : 'IA no disponible'
        : 'completed' === a
          ? 'Borrador listo'
          : 'accepted' === a
            ? 'Borrador usado'
            : 'failed' === a
              ? 'IA fallida'
              : 'disabled' === t
                ? 'IA apagada'
                : 'Sin IA';
}
function De(e) {
    return String(Ce(e).aiDraft || '').trim();
}
function Pe(e) {
    const t = Number(Ce(e).heuristicScore || 0);
    return Number.isFinite(t) ? t : 0;
}
function Ie(e) {
    const t = new Date(e || '');
    if (Number.isNaN(t.getTime())) return !1;
    const a = new Date();
    return (
        t.getFullYear() === a.getFullYear() &&
        t.getMonth() === a.getMonth() &&
        t.getDate() === a.getDate()
    );
}
function xe(e) {
    try {
        (localStorage.setItem(he, JSON.stringify(we(e.filter))),
            localStorage.setItem(fe, JSON.stringify(qe(e.sort))));
    } catch (e) {}
}
function Oe() {
    const t = b(),
        a = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        n =
            t?.data?.leadOpsMeta && 'object' == typeof t.data.leadOpsMeta
                ? t.data.leadOpsMeta
                : null,
        o = t.callbacks,
        s = (function (e, t) {
            const a = qe(t),
                n = [...e];
            return 'waiting_desc' === a
                ? (n.sort((e, t) => _e(e) - _e(t)), n)
                : 'recent_desc' === a
                  ? (n.sort((e, t) => _e(t) - _e(e)), n)
                  : (n.sort((e, t) => {
                        const a = Le(t) - Le(e);
                        if (0 !== a) return a;
                        const n = Pe(t) - Pe(e);
                        return 0 !== n ? n : _e(e) - _e(t);
                    }),
                    n);
        })(
            (function (e, t, a = '') {
                const n = ke(t);
                return n
                    ? e.filter((e) => {
                          const t = Ce(e);
                          return [
                              e.telefono,
                              e.phone,
                              e.preferencia,
                              e.status,
                              Ee(e),
                              Ne(e),
                              Be(e, a),
                              ...(Array.isArray(t.reasonCodes)
                                  ? t.reasonCodes
                                  : []),
                              ...(Array.isArray(t.serviceHints)
                                  ? t.serviceHints
                                  : []),
                          ].some((e) => ke(e).includes(n));
                      })
                    : e;
            })(
                (function (e, t) {
                    const a = we(t);
                    return 'pending' === a || 'contacted' === a
                        ? e.filter((e) => Se(e.status) === a)
                        : 'today' === a
                          ? e.filter((e) => Ie(e.fecha || e.createdAt))
                          : 'sla_urgent' === a
                            ? e.filter(
                                  (e) =>
                                      'pending' === Se(e.status) && Ae(e) >= 120
                              )
                            : e;
                })(a, o.filter),
                o.search,
                String(n?.worker?.mode || '')
            ),
            o.sort
        ),
        c = new Set((o.selected || []).map((e) => Number(e || 0))),
        u = (function (e, t = null) {
            const a = e.filter((e) => 'pending' === Se(e.status)),
                n = a.filter((e) => Ae(e) >= 120),
                i = a.filter((e) => 3 === Le(e)),
                o = a.slice().sort((e, t) => {
                    const a = Le(t) - Le(e);
                    return 0 !== a ? a : _e(e) - _e(t);
                })[0],
                s = ke(t?.worker?.mode || '');
            return {
                pendingCount: a.length,
                urgentCount: n.length,
                hotCount: i.length,
                todayCount: e.filter((e) => Ie(e.fecha || e.createdAt)).length,
                next: o,
                workerMode: s,
                queueHealth:
                    'offline' === s || 'degraded' === s
                        ? 'Cola estable, IA degradada'
                        : i.length > 0
                          ? 'Cola: prioridad comercial alta'
                          : n.length > 0
                            ? 'Cola: atencion requerida'
                            : a.length > 0
                              ? 'Cola: operativa'
                              : 'Cola: estable',
                queueState:
                    i.length > 0
                        ? 'danger'
                        : n.length > 0
                          ? 'warning'
                          : 'success',
            };
        })(a, n);
    (l(
        '#callbacksGrid',
        s.length
            ? s
                  .map((t, a) =>
                      (function (
                          t,
                          {
                              selected: a = !1,
                              position: n = null,
                              workerMode: o = '',
                          } = {}
                      ) {
                          const s = String(t.status || '')
                                  .toLowerCase()
                                  .includes('contact')
                                  ? 'contacted'
                                  : 'pending',
                              r = Number(t.id || 0),
                              l = Te(t),
                              c = Ae(t),
                              u = Me(t),
                              d = De(t);
                          return `\n        <article class="callback-card ${e(u)} ${'pending' === s ? 'pendiente' : 'contactado'}${a ? ' is-selected' : ''}" data-callback-id="${r}" data-callback-status="${'pending' === s ? 'pendiente' : 'contactado'}">\n            <header>\n                <div class="callback-card-heading">\n                    <div class="callback-card-badges">\n                        <span class="callback-status-pill" data-tone="${e(u)}">${e(
                              (function (e) {
                                  const t = Me(e);
                                  return 'hot' === t
                                      ? 'Hot'
                                      : 'warm' === t
                                        ? 'Warm'
                                        : 'Cold';
                              })(t)
                          )}</span>\n                        <span class="callback-status-pill subtle">${e(Be(t, o))}</span>\n                    </div>\n                    <h4>${e(l)}</h4>\n                    <p class="callback-card-subtitle">${e(1 === n ? 'Siguiente lead sugerido' : 'Lead interno')}${Pe(t) ? ` · Score ${e(String(Pe(t)))}` : ''}</p>\n                </div>\n                <span class="callback-card-wait" data-tone="${e('pending' === s ? u : 'success')}">${e($e(c))}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Servicio</span><strong>${e(Ee(t))}</strong></p>\n                <p><span>Fecha</span><strong>${e(i(t.fecha || t.createdAt || ''))}</strong></p>\n                <p><span>Siguiente accion</span><strong>${e(Ne(t))}</strong></p>\n                <p><span>Outcome</span><strong>${e(
                              (function (e) {
                                  const t = ke(Ce(e).outcome);
                                  return 'cita_cerrada' === t
                                      ? 'Cita cerrada'
                                      : 'sin_respuesta' === t
                                        ? 'Sin respuesta'
                                        : 'descartado' === t
                                          ? 'Descartado'
                                          : 'contactado' === t
                                            ? 'Contactado'
                                            : 'Pendiente';
                              })(t)
                          )}</strong></p>\n            </div>\n            <p class="callback-card-note">${e(t.preferencia || 'Sin preferencia registrada')}</p>\n            ${d ? `<div class="callback-card-draft"><span>Borrador IA</span><p>${e(d)}</p></div>` : ''}\n            ${(function (
                              t,
                              a
                          ) {
                              const n = Number(t.id || 0),
                                  i = De(t);
                              return `\n        <div class="callback-actions">\n            <button type="button" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${e(t.fecha || '')}" ${'pending' !== a ? 'disabled' : ''}>${'pending' === a ? 'Marcar contactado' : 'Contactado'}</button>\n            <button type="button" class="ghost" data-action="lead-ai-request" data-callback-id="${n}" data-objective="whatsapp_draft">Generar borrador IA</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="cita_cerrada">Cita cerrada</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="sin_respuesta">Sin respuesta</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="descartado">Descartar</button>\n            ${i ? `<button type="button" class="ghost" data-action="callback-copy-ai" data-callback-id="${n}">Copiar borrador</button>` : ''}\n        </div>\n    `;
                          })(t, s)}\n        </article>\n    `;
                      })(t, {
                          selected: c.has(Number(t.id || 0)),
                          position: a + 1,
                          workerMode: String(n?.worker?.mode || ''),
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    ),
        (function (e, t, a) {
            (r('#callbacksToolbarMeta', `Mostrando ${t} de ${a}`),
                r(
                    '#callbacksToolbarState',
                    (function (e) {
                        const t = [];
                        return (
                            'all' !== we(e.filter) &&
                                t.push(
                                    'pending' === we(e.filter)
                                        ? 'Pendientes'
                                        : 'contacted' === we(e.filter)
                                          ? 'Contactados'
                                          : 'today' === we(e.filter)
                                            ? 'Hoy'
                                            : 'Urgentes SLA'
                                ),
                            ke(e.search) && t.push(`Busqueda: ${e.search}`),
                            'priority_desc' === qe(e.sort)
                                ? t.push('Orden: Prioridad comercial')
                                : 'waiting_desc' === qe(e.sort)
                                  ? t.push('Orden: Mayor espera (SLA)')
                                  : t.push('Orden: Mas recientes'),
                            t
                        );
                    })(e).join(' | ')
                ));
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement && (n.value = we(e.filter));
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement && (i.value = qe(e.sort));
            const o = document.getElementById('searchCallbacks');
            (o instanceof HTMLInputElement &&
                o.value !== e.search &&
                (o.value = e.search),
                (function (e) {
                    const t = ke(e);
                    document
                        .querySelectorAll(
                            '.callback-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((e) => {
                            const a = ke(e.dataset.filterValue) === t;
                            e.classList.toggle('is-active', a);
                        });
                })(e.filter),
                xe(e));
        })(o, s.length, a.length),
        r('#callbacksOpsPendingCount', u.pendingCount),
        r('#callbacksOpsUrgentCount', u.hotCount),
        r('#callbacksOpsTodayCount', u.todayCount),
        r('#callbacksOpsQueueHealth', u.queueHealth),
        (function (e, t) {
            const a = document.getElementById('callbacksBulkSelectVisibleBtn');
            a instanceof HTMLButtonElement && (a.disabled = 0 === e);
            const n = document.getElementById('callbacksBulkClearBtn');
            n instanceof HTMLButtonElement && (n.disabled = 0 === t);
            const i = document.getElementById('callbacksBulkMarkBtn');
            i instanceof HTMLButtonElement && (i.disabled = 0 === t);
        })(s.length, c.size),
        (function (e, t, a, n) {
            r(
                '#callbacksDeckSummary',
                a > 0
                    ? `${e.pendingCount} pendiente(s), ${e.hotCount} hot y ${t} visibles.`
                    : 'Sin callbacks pendientes.'
            );
            const i = document.getElementById('callbacksQueueChip');
            i &&
                ((i.textContent =
                    'danger' === e.queueState
                        ? 'Prioridad alta'
                        : 'warning' === e.queueState
                          ? 'Cola activa'
                          : 'Cola estable'),
                i.setAttribute('data-state', e.queueState));
            const o = document.getElementById('callbacksOpsQueueHealth');
            o && o.setAttribute('data-state', e.queueState);
            const s = e.next;
            (r('#callbacksOpsNext', s ? Te(s) : 'Sin telefono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${Te(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                r('#callbacksNextWait', s ? $e(Ae(s)) : '0 min'),
                r('#callbacksNextPreference', s ? Ee(s) : '-'),
                r('#callbacksNextState', s ? Ne(s) : 'Pendiente'),
                r(
                    '#callbacksDeckHint',
                    s ? Be(s, e.workerMode) : 'Sin bloqueos'
                ));
            const l = document.getElementById('callbacksSelectionChip');
            (l && l.classList.toggle('is-hidden', 0 === n),
                r('#callbacksSelectedCount', n));
        })(u, s.length, a.length, c.size));
}
function He(e, { persist: t = !0 } = {}) {
    (g((t) => ({ ...t, callbacks: { ...t.callbacks, ...e } })),
        t && xe(b().callbacks),
        Oe());
}
function Fe(e) {
    He({ filter: we(e), selected: [] });
}
function je(e) {
    const t = Number(e?.id || 0);
    (g((a) => ({
        ...a,
        data: {
            ...a.data,
            callbacks: (a.data.callbacks || []).map((a) =>
                Number(a.id || 0) === t ? { ...a, ...e } : a
            ),
        },
        callbacks: {
            ...a.callbacks,
            selected: (a.callbacks.selected || []).filter(
                (e) => Number(e || 0) !== t
            ),
        },
    })),
        Oe());
}
async function Re(e, t) {
    const a = Number(e || 0);
    if (a <= 0) return null;
    const n = await S('callbacks', { method: 'PATCH', body: { id: a, ...t } });
    return n?.data || null;
}
async function ze(e, t = '') {
    const a = await Re(e, {
        status: 'contacted',
        fecha: t,
        leadOps: { outcome: 'contactado' },
    });
    return a
        ? (je(a), a)
        : ((function (e) {
              je({ id: e, status: 'contacted' });
          })(e),
          null);
}
const Ve = 'admin-availability-selected-date',
    Ue = 'admin-availability-month-anchor';
function Ke(e) {
    const t = String(e || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return t ? `${t[1]}:${t[2]}` : '';
}
function Qe(e) {
    return [...new Set(e.map(Ke).filter(Boolean))].sort();
}
function We(e) {
    const t = String(e || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
    const a = new Date(`${t}T12:00:00`);
    return Number.isNaN(a.getTime()) ? '' : u(a) === t ? t : '';
}
function Ge(e) {
    const t = We(e);
    if (!t) return null;
    const a = new Date(`${t}T12:00:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Je(e) {
    const t = {};
    return (
        Object.keys(e || {})
            .sort()
            .forEach((a) => {
                const n = We(a);
                if (!n) return;
                const i = Qe(Array.isArray(e[a]) ? e[a] : []);
                i.length && (t[n] = i);
            }),
        t
    );
}
function Ye(e) {
    return Je(e || {});
}
function Ze(e) {
    return JSON.stringify(Je(e || {}));
}
function Xe(e, t = '') {
    let a = null;
    if (e instanceof Date && !Number.isNaN(e.getTime())) a = new Date(e);
    else {
        const t = We(e);
        t && (a = new Date(`${t}T12:00:00`));
    }
    if (!a) {
        const e = Ge(t);
        a = e ? new Date(e) : new Date();
    }
    return (a.setDate(1), a.setHours(12, 0, 0, 0), a);
}
function et(e, t) {
    const a = We(e);
    if (a) return a;
    const n = Object.keys(t || {})[0];
    if (n) {
        const e = We(n);
        if (e) return e;
    }
    return u(new Date());
}
function tt() {
    const e = b(),
        t = We(e.availability.selectedDate),
        a = Xe(e.availability.monthAnchor, t);
    try {
        (t ? localStorage.setItem(Ve, t) : localStorage.removeItem(Ve),
            localStorage.setItem(Ue, u(a)));
    } catch (e) {}
}
function at(e) {
    const t = Ye(b().data.availability || {});
    return Ze(e) !== Ze(t);
}
function nt() {
    return Ye(b().availability.draft || {});
}
function it() {
    const e = b().data.availabilityMeta || {};
    return 'google' === String(e.source || '').toLowerCase();
}
function ot() {
    const e = b(),
        t = We(e.availability.selectedDate);
    if (t) return t;
    const a = Ye(e.availability.draft || {});
    return Object.keys(a)[0] || u(new Date());
}
function st(e, t) {
    return e.length
        ? 1 === e.length
            ? '1 slot publicado. ' +
              (t
                  ? 'Lectura desde Google Calendar.'
                  : 'Puedes duplicarlo o ampliarlo.')
            : `${e.length} slots en el dia. ${t ? 'Referencia en solo lectura.' : 'Listo para copiar o limpiar.'}`
        : t
          ? 'No hay slots publicados en este dia.'
          : 'Agrega slots o copia una jornada existente.';
}
function rt(e = 1) {
    const t = nt(),
        a = Object.keys(t).filter((e) => t[e]?.length > 0);
    if (!a.length) return '';
    const n = We(b().availability.selectedDate) || u(new Date());
    return (
        (e >= 0 ? a.sort() : a.sort().reverse()).find((t) =>
            e >= 0 ? t >= n : t <= n
        ) || ''
    );
}
function lt() {
    ((function () {
        const e = b(),
            t = Xe(e.availability.monthAnchor, e.availability.selectedDate),
            a = ot(),
            n = t.getMonth(),
            i = Ye(e.availability.draft),
            o = u(new Date());
        var s;
        r(
            '#calendarMonth',
            ((s = t),
            new Intl.DateTimeFormat('es-EC', {
                month: 'long',
                year: 'numeric',
            }).format(s))
        );
        l(
            '#availabilityCalendar',
            (function (e) {
                const t = new Date(e.getFullYear(), e.getMonth(), 1),
                    a = (t.getDay() + 6) % 7;
                t.setDate(t.getDate() - a);
                const n = [];
                for (let e = 0; e < 42; e += 1) {
                    const a = new Date(t);
                    (a.setDate(t.getDate() + e), n.push(a));
                }
                return n;
            })(t)
                .map((e) => {
                    const t = u(e),
                        s = Array.isArray(i[t]) ? i[t] : [],
                        r = s.length > 0,
                        l = e.getMonth() === n;
                    return `\n                <button type="button" class="${['calendar-day', l ? '' : 'other-month', r ? 'has-slots' : '', t === a ? 'is-selected' : '', t === o ? 'is-today' : ''].filter(Boolean).join(' ')}" data-action="select-availability-day" data-date="${t}">\n                    <span>${e.getDate()}</span>\n                    <small>${r ? `${s.length} slot${1 === s.length ? '' : 's'}` : l ? 'Sin slots' : ''}</small>\n                </button>\n            `;
                })
                .join('')
        );
    })(),
        (function () {
            const { selectedDate: t, slots: a } = (function () {
                    const e = b(),
                        t = ot();
                    return {
                        selectedDate: t,
                        slots: Qe(Ye(e.availability.draft)[t] || []),
                    };
                })(),
                n = it();
            (r('#selectedDate', t || '-'),
                a.length
                    ? l(
                          '#timeSlotsList',
                          a
                              .map(
                                  (a) =>
                                      `\n            <div class="time-slot-item">\n                <div>\n                    <strong>${e(a)}</strong>\n                    <small>${e(n ? 'Slot publicado' : 'Disponible para consulta')}</small>\n                </div>\n                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(t)}" data-time="${encodeURIComponent(a)}" ${n ? 'disabled' : ''}>Quitar</button>\n            </div>\n        `
                              )
                              .join('')
                      )
                    : l(
                          '#timeSlotsList',
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${e(st([], n))}</p>`
                      ));
        })(),
        (function () {
            const e = b(),
                a = ot(),
                n = Ye(e.availability.draft),
                i = Array.isArray(n[a]) ? Qe(n[a]) : [],
                o = it(),
                {
                    sourceText: s,
                    modeText: l,
                    timezone: c,
                } = (function () {
                    const e = b().data.availabilityMeta || {},
                        t = it();
                    return {
                        sourceText: t ? 'Google Calendar' : 'Local',
                        modeText: t ? 'Solo lectura' : 'Editable',
                        timezone: String(
                            e.timezone ||
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
                r('#availabilityModeBadge', `Modo: ${l}`),
                r('#availabilityTimezoneBadge', `TZ: ${c}`),
                r(
                    '#availabilitySelectionSummary',
                    `Fecha: ${a} | ${(function (e) {
                        const t = Ge(e);
                        return t
                            ? new Intl.DateTimeFormat('es-EC', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                              }).format(t)
                            : e || '-';
                    })(a)} | Fuente: ${s} | Modo: ${l} | Slots: ${i.length}`
                ),
                r(
                    '#availabilityDraftStatus',
                    e.availability.draftDirty
                        ? 'cambios pendientes'
                        : 'Sin cambios pendientes'
                ),
                r(
                    '#availabilitySyncStatus',
                    o ? `Google Calendar | ${c}` : `Store local | ${c}`
                ),
                (function (e) {
                    const a = t('#addSlotForm'),
                        n = t('#availabilityQuickSlotPresets');
                    (a && a.classList.toggle('is-hidden', e),
                        n && n.classList.toggle('is-hidden', e));
                    const i = t('#newSlotTime');
                    i instanceof HTMLInputElement && (i.disabled = e);
                    const o = t('[data-action="add-time-slot"]');
                    o instanceof HTMLButtonElement && (o.disabled = e);
                })(o));
            const u = Array.isArray(e.availability.clipboard)
                ? e.availability.clipboard.length
                : 0;
            let d = st(i, o);
            (o
                ? (d = 'Edicion bloqueada por proveedor Google')
                : e.availability.lastAction
                  ? (d = String(e.availability.lastAction))
                  : u && (d = `Portapapeles: ${u} slots`),
                r('#availabilityDayActionsStatus', d),
                (function (e, t, a) {
                    document
                        .querySelectorAll(
                            '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
                        )
                        .forEach((n) => {
                            n instanceof HTMLButtonElement &&
                                ('availabilityDiscardDraftBtn' !== n.id &&
                                'availabilitySaveDraftBtn' !== n.id
                                    ? 'paste-availability-day' !==
                                      String(n.dataset.action || '')
                                        ? (n.disabled = t)
                                        : (n.disabled = t || 0 === a)
                                    : (n.disabled =
                                          t || !e.availability.draftDirty));
                        });
                })(e, o, u));
        })(),
        tt());
}
function ct(e, { render: t = !1 } = {}) {
    (g((t) => ({ ...t, availability: { ...t.availability, ...e } })),
        t ? lt() : tt());
}
function ut(e, t = {}) {
    const a = Ye(e),
        n = et(t.selectedDate || b().availability.selectedDate, a);
    ct(
        {
            draft: a,
            selectedDate: n,
            monthAnchor: Xe(t.monthAnchor || b().availability.monthAnchor, n),
            draftDirty: at(a),
            ...t,
        },
        { render: !0 }
    );
}
function dt(e) {
    ct({ lastAction: String(e || '') }, { render: !0 });
}
function pt(e, t, a = '') {
    const n = We(e) || ot();
    if (!n) return;
    const i = nt(),
        o = Qe(Array.isArray(t) ? t : []);
    (o.length ? (i[n] = o) : delete i[n],
        ut(i, { selectedDate: n, monthAnchor: n, lastAction: a }));
}
function mt(e, t) {
    const a = We(e);
    a &&
        ct(
            { selectedDate: a, monthAnchor: Xe(a, a), lastAction: t || '' },
            { render: !0 }
        );
}
function bt() {
    return We(b().availability.selectedDate) || ot();
}
function gt(e) {
    return Ke(e);
}
function ft(e) {
    if (it()) return;
    const t = b(),
        a = bt();
    if (!a) return;
    const n = Array.isArray(t.availability.draft[a])
            ? t.availability.draft[a]
            : [],
        i = (function (e, t) {
            const a = Ge(e);
            return a ? (a.setDate(a.getDate() + Number(t || 0)), u(a)) : '';
        })(a, e);
    i && pt(i, n, `Duplicado ${n.length} slots en ${i}`);
}
function ht() {
    return Boolean(b().availability.draftDirty);
}
function yt() {
    const t = b().queue.activity || [];
    l(
        '#queueActivityList',
        t.length
            ? t
                  .map(
                      (t) =>
                          `<li><span>${e(i(t.at))}</span><strong>${e(t.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}
function vt(e) {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        a = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (a && (a.textContent = `Confirmar accion sensible: ${e.action}`),
        g((t) => ({ ...t, queue: { ...t.queue, pendingSensitiveAction: e } })),
        t instanceof HTMLDialogElement && 'function' == typeof t.showModal)
    ) {
        if (((t.hidden = !1), t.removeAttribute('hidden'), !t.open))
            try {
                t.showModal();
            } catch (e) {
                t.setAttribute('open', '');
            }
    } else
        t instanceof HTMLElement &&
            (t.setAttribute('open', ''), (t.hidden = !1));
}
function kt() {
    const e = document.getElementById('queueSensitiveConfirmDialog');
    (e instanceof HTMLDialogElement && e.open && e.close(),
        e instanceof HTMLElement &&
            (e.removeAttribute('open'), (e.hidden = !0)),
        g((e) => ({
            ...e,
            queue: { ...e.queue, pendingSensitiveAction: null },
        })));
}
function wt(e, t) {
    return (
        e.callingNowByConsultorio?.[String(t)] ||
        e.callingNowByConsultorio?.[t] ||
        null
    );
}
function qt(e) {
    return e ? String(e.ticketCode || e.ticket_code || 'A-000') : 'Sin llamado';
}
function St(e, t, a, n) {
    const i = document.getElementById(e);
    i instanceof HTMLButtonElement &&
        ((i.hidden = !a),
        (i.textContent = a ? `Liberar C${t} · ${n}` : `Release C${t}`),
        a
            ? i.setAttribute('data-queue-id', String(Number(a.id || 0)))
            : i.removeAttribute('data-queue-id'));
}
function Ct(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function _t(e) {
    const t = Ct(e);
    return ['waiting', 'wait', 'en_espera', 'espera'].includes(t)
        ? 'waiting'
        : ['called', 'calling', 'llamado'].includes(t)
          ? 'called'
          : ['completed', 'complete', 'completar', 'done'].includes(t)
            ? 'completed'
            : [
                    'no_show',
                    'noshow',
                    'no-show',
                    'no show',
                    'no_asistio',
                ].includes(t)
              ? 'no_show'
              : ['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(t)
                ? 'cancelled'
                : t || 'waiting';
}
function At(e) {
    const t = Ct(e);
    return ['complete', 'completed', 'completar'].includes(t)
        ? 'completar'
        : ['no_show', 'noshow', 'no-show', 'no show'].includes(t)
          ? 'no_show'
          : [
                  'cancel',
                  'cancelled',
                  'canceled',
                  'cancelar',
                  'cancelado',
              ].includes(t)
            ? 'cancelar'
            : ['reasignar', 'reassign'].includes(t)
              ? 'reasignar'
              : ['re-llamar', 'rellamar', 'recall', 'llamar'].includes(t)
                ? 're-llamar'
                : ['liberar', 'release'].includes(t)
                  ? 'liberar'
                  : t;
}
function $t(e) {
    return Array.isArray(e) ? e : [];
}
function Tt(e, t = 0) {
    const a = Number(e);
    return Number.isFinite(a) ? a : t;
}
function Mt(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function Lt(...e) {
    for (const t of e) {
        const e = String(t ?? '').trim();
        if (e) return e;
    }
    return '';
}
let Et = '';
function Nt(e) {
    const t = e.filter((e) => 'waiting' === e.status),
        a = e.filter((e) => 'called' === e.status),
        n = {
            1: a.find((e) => 1 === e.assignedConsultorio) || null,
            2: a.find((e) => 2 === e.assignedConsultorio) || null,
        };
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: t.length,
        calledCount: a.length,
        counts: {
            waiting: t.length,
            called: a.length,
            completed: e.filter((e) => 'completed' === e.status).length,
            no_show: e.filter((e) => 'no_show' === e.status).length,
            cancelled: e.filter((e) => 'cancelled' === e.status).length,
        },
        callingNowByConsultorio: n,
        nextTickets: t
            .slice(0, 5)
            .map((e, t) => ({
                id: e.id,
                ticketCode: e.ticketCode,
                patientInitials: e.patientInitials,
                position: t + 1,
            })),
    };
}
function Bt(e, t = 0) {
    const a = Number(e?.id || e?.ticket_id || t + 1);
    return {
        id: a,
        ticketCode: String(e?.ticketCode || e?.ticket_code || `A-${a}`),
        queueType: String(e?.queueType || e?.queue_type || 'walk_in'),
        patientInitials: String(
            e?.patientInitials || e?.patient_initials || '--'
        ),
        priorityClass: String(
            e?.priorityClass || e?.priority_class || 'walk_in'
        ),
        status: _t(e?.status || 'waiting'),
        assignedConsultorio:
            2 === Number(e?.assignedConsultorio || e?.assigned_consultorio || 0)
                ? 2
                : 1 ===
                    Number(
                        e?.assignedConsultorio || e?.assigned_consultorio || 0
                    )
                  ? 1
                  : null,
        createdAt: String(
            e?.createdAt || e?.created_at || new Date().toISOString()
        ),
        calledAt: String(e?.calledAt || e?.called_at || ''),
        completedAt: String(e?.completedAt || e?.completed_at || ''),
        needsAssistance: Boolean(e?.needsAssistance ?? e?.needs_assistance),
        assistanceRequestStatus: String(
            e?.assistanceRequestStatus || e?.assistance_request_status || ''
        ),
        activeHelpRequestId:
            Number(e?.activeHelpRequestId ?? e?.active_help_request_id ?? 0) ||
            null,
        specialPriority: Boolean(e?.specialPriority ?? e?.special_priority),
        lateArrival: Boolean(e?.lateArrival ?? e?.late_arrival),
        reprintRequestedAt: String(
            e?.reprintRequestedAt || e?.reprint_requested_at || ''
        ),
        estimatedWaitMin: Math.max(
            0,
            Number(e?.estimatedWaitMin ?? e?.estimated_wait_min ?? 0) || 0
        ),
    };
}
function Dt(e, t = 0, a = {}) {
    const n = e && 'object' == typeof e ? e : {},
        i = Bt({ ...n, ...a }, t);
    return (
        Lt(n.createdAt, n.created_at) || (i.createdAt = ''),
        Lt(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        Lt(n.queueType, n.queue_type) || (i.queueType = ''),
        Lt(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function Pt(e, t, a) {
    return (
        e[String(a)] ||
        e[a] ||
        t.find(
            (e) =>
                Number(
                    e?.assignedConsultorio || e?.assigned_consultorio || 0
                ) === a
        ) ||
        null
    );
}
function It(e, t, a) {
    return e ? Dt(e, t, { status: 'called', assignedConsultorio: a }) : null;
}
function xt(e, t = []) {
    const a = e && 'object' == typeof e ? e : {},
        n = (function (e) {
            return e.counts && 'object' == typeof e.counts ? e.counts : {};
        })(a),
        i = (function (e) {
            return e.callingNowByConsultorio &&
                'object' == typeof e.callingNowByConsultorio
                ? e.callingNowByConsultorio
                : e.calling_now_by_consultorio &&
                    'object' == typeof e.calling_now_by_consultorio
                  ? e.calling_now_by_consultorio
                  : {};
        })(a),
        o = (function (e) {
            return $t(e.callingNow).concat($t(e.calling_now));
        })(a),
        s = (function (e) {
            const t = $t(e).map((e, t) => Bt(e, t));
            return {
                normalizedTickets: t,
                waitingFromTickets: t.filter((e) => 'waiting' === e.status)
                    .length,
                calledFromTickets: t.filter((e) => 'called' === e.status)
                    .length,
                completedFromTickets: t.filter((e) => 'completed' === e.status)
                    .length,
                noShowFromTickets: t.filter((e) => 'no_show' === e.status)
                    .length,
                cancelledFromTickets: t.filter((e) => 'cancelled' === e.status)
                    .length,
            };
        })(t),
        { c1: r, c2: l } = (function (e, t) {
            return { c1: It(Pt(e, t, 1), 0, 1), c2: It(Pt(e, t, 2), 1, 2) };
        })(i, o),
        c = (function (e) {
            return $t(e.nextTickets)
                .concat($t(e.next_tickets))
                .map((e, t) =>
                    Dt(
                        {
                            ...e,
                            status: e?.status || 'waiting',
                            assignedConsultorio: null,
                        },
                        t
                    )
                );
        })(a),
        u = (function (e, t, a, n, i) {
            const o = Math.max(
                Number(Boolean(i.c1)) + Number(Boolean(i.c2)),
                n.calledFromTickets
            );
            return {
                waitingCount: Tt(
                    e.waitingCount ??
                        e.waiting_count ??
                        t.waiting ??
                        a.length ??
                        n.waitingFromTickets,
                    0
                ),
                calledCount: Tt(
                    e.calledCount ?? e.called_count ?? t.called ?? o,
                    0
                ),
                completedCount: Tt(
                    t.completed ??
                        e.completedCount ??
                        e.completed_count ??
                        n.completedFromTickets,
                    0
                ),
                noShowCount: Tt(
                    t.no_show ??
                        t.noShow ??
                        e.noShowCount ??
                        e.no_show_count ??
                        n.noShowFromTickets,
                    0
                ),
                cancelledCount: Tt(
                    t.cancelled ??
                        t.canceled ??
                        e.cancelledCount ??
                        e.cancelled_count ??
                        n.cancelledFromTickets,
                    0
                ),
            };
        })(a, n, c, s, { c1: r, c2: l });
    return {
        updatedAt: String(
            a.updatedAt || a.updated_at || new Date().toISOString()
        ),
        waitingCount: u.waitingCount,
        calledCount: u.calledCount,
        estimatedWaitMin: Tt(
            a.estimatedWaitMin ??
                a.estimated_wait_min ??
                Math.max(0, 8 * c.length),
            0
        ),
        delayReason: String(a.delayReason || a.delay_reason || ''),
        assistancePendingCount: Tt(
            a.assistancePendingCount ??
                a.assistance_pending_count ??
                $t(a.activeHelpRequests).filter(
                    (e) => 'pending' === String(e?.status || '').toLowerCase()
                ).length ??
                $t(a.active_help_requests).filter(
                    (e) => 'pending' === String(e?.status || '').toLowerCase()
                ).length,
            0
        ),
        activeHelpRequests: $t(a.activeHelpRequests).length
            ? $t(a.activeHelpRequests)
            : $t(a.active_help_requests),
        counts: {
            waiting: u.waitingCount,
            called: u.calledCount,
            completed: u.completedCount,
            no_show: u.noShowCount,
            cancelled: u.cancelledCount,
        },
        callingNowByConsultorio: { 1: r, 2: l },
        nextTickets: c,
    };
}
function Ot(e, t) {
    return Object.prototype.hasOwnProperty.call(e || {}, t);
}
function Ht(e) {
    return e?.counts && 'object' == typeof e.counts ? e.counts : null;
}
function Ft(e) {
    const t = Bt(e, 0);
    return t.id > 0 ? `id:${t.id}` : `code:${Ct(t.ticketCode || '')}`;
}
function jt(e, t) {
    if (!t) return;
    const a = Bt(t, e.size);
    (Lt(t?.createdAt, t?.created_at) || (a.createdAt = ''),
        Lt(t?.priorityClass, t?.priority_class) || (a.priorityClass = ''),
        Lt(t?.queueType, t?.queue_type) || (a.queueType = ''),
        e.set(Ft(a), a));
}
function Rt(e) {
    const t = xt(e),
        a = new Map(),
        n =
            t.callingNowByConsultorio?.[1] ||
            t.callingNowByConsultorio?.[1] ||
            null,
        i =
            t.callingNowByConsultorio?.[2] ||
            t.callingNowByConsultorio?.[2] ||
            null;
    (n && jt(a, { ...n, status: 'called', assignedConsultorio: 1 }),
        i && jt(a, { ...i, status: 'called', assignedConsultorio: 2 }));
    for (const e of $t(t.nextTickets))
        jt(a, { ...e, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function zt() {
    const e = b(),
        t = Array.isArray(e.data.queueTickets)
            ? e.data.queueTickets.map((e, t) => Bt(e, t))
            : [];
    return {
        queueTickets: t,
        queueMeta:
            e.data.queueMeta && 'object' == typeof e.data.queueMeta
                ? xt(e.data.queueMeta, t)
                : Nt(t),
    };
}
function Vt() {
    const e = b(),
        { queueTickets: t } = zt();
    return (function (e, t) {
        const a = Ct(t);
        return a
            ? e.filter((e) =>
                  [e.ticketCode, e.patientInitials, e.status, e.queueType].some(
                      (e) => Ct(e).includes(a)
                  )
              )
            : e;
    })(
        (function (e, t) {
            const a = Ct(t);
            return 'waiting' === a
                ? e.filter((e) => 'waiting' === e.status)
                : 'called' === a
                  ? e.filter((e) => 'called' === e.status)
                  : 'no_show' === a
                    ? e.filter((e) => 'no_show' === e.status)
                    : 'sla_risk' === a
                      ? e.filter(
                            (e) =>
                                'waiting' === e.status &&
                                (Math.max(
                                    0,
                                    Math.round(
                                        (Date.now() - Mt(e.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === Ct(e.priorityClass))
                        )
                      : e;
        })(t, e.queue.filter),
        e.queue.search
    );
}
function Ut(e, t = null) {
    const a = Array.isArray(t) ? t : zt().queueTickets,
        n = new Set(a.map((e) => Number(e.id || 0)).filter((e) => e > 0));
    return [...new Set($t(e).map((e) => Number(e || 0)))]
        .filter((e) => e > 0 && n.has(e))
        .sort((e, t) => e - t);
}
function Kt() {
    return Ut(b().queue.selected || []);
}
function Qt() {
    const e = (function () {
        const e = new Set(Kt());
        return e.size
            ? zt().queueTickets.filter((t) => e.has(Number(t.id || 0)))
            : [];
    })();
    return e.length ? e : Vt();
}
function Wt(e) {
    const t = 2 === Number(e || 0) ? 2 : 1;
    return (
        zt().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
function Gt() {
    const e = b(),
        t = Number(e.queue.stationConsultorio || 1);
    return (
        zt().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
function Jt(t) {
    const a = t.assignedConsultorio ? `C${t.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - Mt(t.createdAt)) / 6e4)),
        i = Number(t.id || 0),
        o = new Set(Kt()).has(i),
        s = 'called' === t.status,
        r = 'operator' === document.body?.dataset.queueSurface,
        l = (function (t) {
            const a = [
                t.specialPriority ? 'Prioridad' : '',
                t.needsAssistance ? 'Apoyo' : '',
                t.lateArrival ? 'Tarde' : '',
                t.reprintRequestedAt ? 'Reimpresion' : '',
            ].filter(Boolean);
            return a.length
                ? `<div class="queue-row-flags">${a.map((t) => `<span>${e(t)}</span>`).join(' · ')}</div>`
                : '';
        })(t),
        c = `\n        <div>${e(t.ticketCode)}</div>\n        ${l}\n    `,
        u = (function (t, a, n, i) {
            return n
                ? `<span class="queue-row-marker">${e(i ? 'Live' : 'Fila')}</span>`
                : `<label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${t}" ${a ? 'checked' : ''} />\n                </label>`;
        })(i, o, r, s),
        d = (function (e, t, a) {
            const n = (function (e, t) {
                    return 'called' !== t.status
                        ? ''
                        : `<button type="button" data-action="queue-ticket-action" data-queue-id="${e}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(t.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>`;
                })(t, e),
                i = (function (e, t) {
                    return 'called' === t.status && t.assignedConsultorio
                        ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${e}" data-queue-action="liberar">Liberar</button>`
                        : '';
                })(t, e),
                o = (function (e, t) {
                    return e.needsAssistance
                        ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="atender_apoyo">Atender apoyo</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="resolver_apoyo">Resolver apoyo</button>`
                        : '';
                })(e, t);
            return a
                ? `\n                    ${n}\n                    ${i}\n                    ${o}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${t}">Reimprimir</button>\n                `
                : `\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${n}\n                    ${i}\n                    ${o}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${t}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${t}">Reimprimir</button>\n                `;
        })(t, i, r);
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                ${u}\n            </td>\n            <td>${c}</td>\n            <td>${e(t.queueType)}</td>\n            <td>${e(
        (function (e) {
            switch (_t(e)) {
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
                    return String(e || '--');
            }
        })(t.status)
    )}</td>\n            <td>${a}</td>\n            <td>${n} min</td>\n            <td>\n                <div class="table-actions">\n                    ${d}\n                </div>\n            </td>\n        </tr>\n    `;
}
const Yt = Object.freeze({
        operator: {
            version: '0.1.0',
            updatedAt: '2026-03-10T00:00:00Z',
            webFallbackUrl: '/operador-turnos.html',
            guideUrl: '/app-downloads/?surface=operator',
            targets: {
                win: {
                    url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                    label: 'Windows',
                },
                mac: {
                    url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                    label: 'macOS',
                },
            },
        },
        kiosk: {
            version: '0.1.0',
            updatedAt: '2026-03-10T00:00:00Z',
            webFallbackUrl: '/kiosco-turnos.html',
            guideUrl: '/app-downloads/?surface=kiosk',
            targets: {
                win: {
                    url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                    label: 'Windows',
                },
                mac: {
                    url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                    label: 'macOS',
                },
            },
        },
        sala_tv: {
            version: '0.1.0',
            updatedAt: '2026-03-10T00:00:00Z',
            webFallbackUrl: '/sala-turnos.html',
            guideUrl: '/app-downloads/?surface=sala_tv',
            targets: {
                android_tv: {
                    url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                    label: 'Android TV APK',
                },
            },
        },
    }),
    Zt = Object.freeze({
        operator: {
            eyebrow: 'Recepción + consultorio',
            title: 'Operador',
            description:
                'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
            recommendedFor: 'PC operador',
            notes: [
                'Conecta aquí el receptor USB 2.4 GHz del numpad.',
                'La app desktop ahora puede quedar configurada como C1, C2 o modo libre desde el primer arranque.',
            ],
        },
        kiosk: {
            eyebrow: 'Recepción de pacientes',
            title: 'Kiosco',
            description:
                'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
            recommendedFor: 'PC o mini PC de kiosco',
            notes: [
                'Mantén el equipo en fullscreen y con impresora térmica conectada.',
                'La versión web sigue disponible como respaldo inmediato.',
            ],
        },
        sala_tv: {
            eyebrow: 'Pantalla de sala',
            title: 'Sala TV',
            description:
                'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
            recommendedFor: 'TCL C655 / Google TV',
            notes: [
                'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
                'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
            ],
        },
    }),
    Xt = Object.freeze({
        operator: {
            title: 'Operador',
            emptySummary:
                'Todavía no hay señal del equipo operador. Abre la app o el fallback web para registrar heartbeat.',
        },
        kiosk: {
            title: 'Kiosco',
            emptySummary:
                'Todavía no hay señal del kiosco. Abre el equipo o el fallback web antes de dejar autoservicio.',
        },
        display: {
            title: 'Sala TV',
            emptySummary:
                'Todavía no hay señal de la TV de sala. Abre la app Android TV o el fallback web para registrar estado.',
        },
    }),
    ea = 'queueOpeningChecklistV1',
    ta = Object.freeze([
        'operator_ready',
        'kiosk_ready',
        'sala_ready',
        'smoke_ready',
    ]);
function aa(e, t, a) {
    const n = new URL(
        String(a.guideUrl || `/app-downloads/?surface=${e}`),
        `${window.location.origin}/`
    );
    return (
        n.searchParams.set('surface', e),
        'sala_tv' === e
            ? n.searchParams.set('platform', 'android_tv')
            : n.searchParams.set(
                  'platform',
                  'mac' === t.platform ? 'mac' : 'win'
              ),
        'operator' === e
            ? (n.searchParams.set('station', 'c2' === t.station ? 'c2' : 'c1'),
              n.searchParams.set('lock', t.lock ? '1' : '0'),
              n.searchParams.set('one_tap', t.oneTap ? '1' : '0'))
            : (n.searchParams.delete('station'),
              n.searchParams.delete('lock'),
              n.searchParams.delete('one_tap')),
        `${n.pathname}${n.search}`
    );
}
function na(e, t) {
    return 'mac' === t && e.targets.mac
        ? e.targets.mac
        : 'win' === t && e.targets.win
          ? e.targets.win
          : e.targets.win || e.targets.mac || null;
}
function ia(e, t, a) {
    const n = new URL(
        String(t.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );
    return (
        'operator' === e &&
            (n.searchParams.set('station', 'c2' === a.station ? 'c2' : 'c1'),
            n.searchParams.set('lock', a.lock ? '1' : '0'),
            n.searchParams.set('one_tap', a.oneTap ? '1' : '0')),
        n.toString()
    );
}
function oa() {
    const e = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    return e.includes('mac') ? 'mac' : e.includes('win') ? 'win' : 'other';
}
function sa(e) {
    try {
        return new URL(String(e || ''), window.location.origin).toString();
    } catch (t) {
        return String(e || '');
    }
}
function ra(e) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(sa(e))}`;
}
let la = null,
    ca = null;
function ua() {
    const e = new Date();
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function da(e = ua()) {
    return { date: e, steps: ta.reduce((e, t) => ((e[t] = !1), e), {}) };
}
function pa(e) {
    const t = ua(),
        a = e && 'object' == typeof e ? e : {};
    return {
        date: (String(a.date || '').trim(), t),
        steps: ta.reduce(
            (e, t) => ((e[t] = Boolean(a.steps && a.steps[t])), e),
            {}
        ),
    };
}
function ma(e) {
    ca = pa(e);
    try {
        localStorage.setItem(ea, JSON.stringify(ca));
    } catch (e) {}
    return ca;
}
function ba() {
    const e = ua();
    return (
        (ca && ca.date === e) ||
            (ca = (function () {
                const e = ua();
                try {
                    const t = localStorage.getItem(ea);
                    if (!t) return da(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? da(e) : pa(a);
                } catch (t) {
                    return da(e);
                }
            })()),
        ca
    );
}
function ga(e) {
    const t = ba(),
        a = (Array.isArray(e) ? e : []).filter((e) => ta.includes(e));
    if (!a.length) return t;
    const n = { ...t.steps };
    return (
        a.forEach((e) => {
            n[e] = !0;
        }),
        ma({ ...t, steps: n })
    );
}
function fa(e) {
    if (la) return la;
    const t = b();
    return (
        (la = {
            surface: 'operator',
            station:
                2 === Number(t.queue && t.queue.stationConsultorio)
                    ? 'c2'
                    : 'c1',
            lock: Boolean(t.queue && 'locked' === t.queue.stationMode),
            oneTap: Boolean(t.queue && t.queue.oneTap),
            platform: 'win' === e || 'mac' === e ? e : 'win',
        }),
        la
    );
}
function ha(e, t) {
    return ((la = { ...fa(t), ...(e || {}) }), la);
}
function ya(e) {
    return 'sala_tv' === e.surface
        ? 'Sala TV lista para TCL C655'
        : 'kiosk' === e.surface
          ? 'Kiosco listo para mostrador'
          : e.lock
            ? `Operador ${'c2' === e.station ? 'C2' : 'C1'} fijo`
            : 'Operador en modo libre';
}
function va(e) {
    if ('sala_tv' === e.surface)
        return [
            'Abre el QR desde otra pantalla o descarga la APK directamente.',
            'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
            'Valida audio, reconexión y que la sala refleje llamados reales.',
        ];
    if ('kiosk' === e.surface)
        return [
            'Instala la app en el mini PC o PC del kiosco.',
            'Deja la impresora térmica conectada y la app en fullscreen.',
            'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
        ];
    const t = 'c2' === e.station ? 'C2' : 'C1';
    return [
        `Instala Turnero Operador en el PC de ${t} y conecta el receptor USB del Genius Numpad 1000.`,
        `En el primer arranque deja el equipo como ${e.lock ? `${t} fijo` : 'modo libre'}${e.oneTap ? ' con 1 tecla' : ''}.`,
        'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
    ];
}
function ka(t, a, n) {
    const o = Zt[t],
        s = fa(n),
        r = na(a, n),
        l =
            'mac' === n
                ? 'macOS'
                : 'win' === n
                  ? 'Windows'
                  : (r && r.label) || 'este equipo',
        c = Object.entries(a.targets || {})
            .filter(([e, t]) => t && t.url)
            .map(
                ([t, a]) =>
                    `\n                <a\n                    href="${e(a.url)}"\n                    class="${t === n ? 'queue-app-card__recommended' : ''}"\n                    download\n                >\n                    ${e(a.label || t)}\n                </a>\n            `
            )
            .join('');
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${e(o.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${e(o.title)}</h5>\n                <p class="queue-app-card__description">${e(o.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${e(a.version || '0.1.0')} · ${e(i(a.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${e(o.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                ${r && r.url ? `<a href="${e(r.url)}" class="queue-app-card__cta-primary" download>Descargar para ${e(l)}</a>` : ''}\n            </div>\n            <div class="queue-app-card__targets">${c}</div>\n            <div class="queue-app-card__links">\n                <a href="${e(a.webFallbackUrl || '/')}">Abrir versión web</a>\n                <a href="${e(aa(t, s, a))}">Centro de instalación</a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${e(sa((r && r.url) || ''))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${o.notes.map((t) => `<li>${e(t)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function wa(t) {
    const a = Zt.sala_tv,
        n = fa(oa()),
        o = t.targets.android_tv || {},
        s = String(o.url || ''),
        r = ra(s);
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${e(a.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${e(a.title)}</h5>\n                <p class="queue-app-card__description">${e(a.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${e(t.version || '0.1.0')} · ${e(i(t.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${e(a.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                <a\n                    href="${e(r)}"\n                    class="queue-app-card__cta-primary"\n                    target="_blank"\n                    rel="noopener"\n                >\n                    Mostrar QR de instalación\n                </a>\n                <a href="${e(s)}" download>Descargar APK</a>\n            </div>\n            <div class="queue-app-card__links">\n                <a href="${e(t.webFallbackUrl || '/sala-turnos.html')}">\n                    Abrir fallback web\n                </a>\n                <a href="${e(aa('sala_tv', n, t))}">\n                    Centro de instalación\n                </a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${e(sa(s))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${a.notes.map((t) => `<li>${e(t)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function qa(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t < 0) return 'sin señal';
    if (t < 60) return `${t}s`;
    const a = Math.floor(t / 60),
        n = t % 60;
    if (a >= 60) {
        const e = Math.floor(a / 60),
            t = a % 60;
        return t > 0 ? `${e}h ${t}m` : `${e}h`;
    }
    return n > 0 ? `${a}m ${n}s` : `${a}m`;
}
function Sa(e) {
    const t = (function () {
        const e = b().data.queueSurfaceStatus;
        return e && 'object' == typeof e ? e : {};
    })()[e];
    return t && 'object' == typeof t
        ? t
        : {
              surface: e,
              status: 'unknown',
              stale: !0,
              summary: '',
              latest: null,
              instances: [],
          };
}
function Ca(e, t) {
    if (!t || 'object' != typeof t) return ['Sin señal'];
    const a = t.details && 'object' == typeof t.details ? t.details : {},
        n = [],
        i = String(t.appMode || '').trim();
    if (
        (n.push(
            'desktop' === i
                ? 'Desktop'
                : 'android_tv' === i
                  ? 'Android TV'
                  : 'Web'
        ),
        'operator' === e)
    ) {
        const e = String(a.station || '').toUpperCase(),
            t = String(a.stationMode || '');
        (e && n.push('locked' === t ? `${e} fijo` : `${e} libre`),
            n.push(a.oneTap ? '1 tecla ON' : '1 tecla OFF'),
            n.push(a.numpadSeen ? 'Numpad listo' : 'Numpad pendiente'));
    } else
        'kiosk' === e
            ? (n.push(a.printerPrinted ? 'Térmica OK' : 'Térmica pendiente'),
              n.push(`Offline ${Number(a.pendingOffline || 0)}`),
              n.push(
                  'live' === String(a.connection || '').toLowerCase()
                      ? 'Cola en vivo'
                      : 'Cola degradada'
              ))
            : 'display' === e &&
              (n.push(a.bellPrimed ? 'Audio listo' : 'Audio pendiente'),
              n.push(a.bellMuted ? 'Campanilla Off' : 'Campanilla On'),
              n.push(
                  'live' === String(a.connection || '').toLowerCase()
                      ? 'Sala en vivo'
                      : 'Sala degradada'
              ));
    return n.slice(0, 4);
}
function _a(t, a) {
    if (
        !(
            document.getElementById('queueSurfaceTelemetry') instanceof
            HTMLElement
        )
    )
        return;
    const n = (function (e, t) {
            const a = fa(t);
            return [
                {
                    key: 'operator',
                    appConfig: e.operator || Yt.operator,
                    fallbackSurface: 'operator',
                    actionLabel: 'Abrir operador',
                },
                {
                    key: 'kiosk',
                    appConfig: e.kiosk || Yt.kiosk,
                    fallbackSurface: 'kiosk',
                    actionLabel: 'Abrir kiosco',
                },
                {
                    key: 'display',
                    appConfig: e.sala_tv || Yt.sala_tv,
                    fallbackSurface: 'sala_tv',
                    actionLabel: 'Abrir sala TV',
                },
            ].map((e) => {
                const t = Sa(e.key),
                    n =
                        t.latest && 'object' == typeof t.latest
                            ? t.latest
                            : null,
                    i = String(t.status || 'unknown'),
                    o =
                        String(t.summary || '').trim() ||
                        Xt[e.key]?.emptySummary ||
                        'Sin señal todavía.',
                    s = ia(e.fallbackSurface, e.appConfig, {
                        ...a,
                        surface: e.fallbackSurface,
                    });
                return {
                    key: e.key,
                    title: Xt[e.key]?.title || e.key,
                    state: ['ready', 'warning', 'alert'].includes(i)
                        ? i
                        : 'unknown',
                    badge:
                        'ready' === i
                            ? 'En vivo'
                            : 'alert' === i
                              ? 'Atender'
                              : 'warning' === i
                                ? 'Revisar'
                                : 'Sin señal',
                    deviceLabel: String(
                        n?.deviceLabel || 'Sin equipo reportando'
                    ),
                    summary: o,
                    ageLabel:
                        n && void 0 !== n.ageSec && null !== n.ageSec
                            ? `Heartbeat hace ${qa(n.ageSec)}`
                            : 'Sin heartbeat todavía',
                    chips: Ca(e.key, n),
                    route: s,
                    actionLabel: e.actionLabel,
                };
            });
        })(t, a),
        i = (function () {
            const e = (function () {
                    const e = b().ui?.queueAutoRefresh;
                    return e && 'object' == typeof e
                        ? e
                        : {
                              state: 'idle',
                              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
                              intervalMs: 45e3,
                              lastAttemptAt: 0,
                              lastSuccessAt: 0,
                              lastError: '',
                              inFlight: !1,
                          };
                })(),
                t = String(e.state || 'idle')
                    .trim()
                    .toLowerCase(),
                a = (function (e) {
                    const t = Number(e);
                    if (!Number.isFinite(t) || t <= 0) return 'cada --';
                    const a = Math.max(1, Math.round(t / 1e3));
                    return a < 60
                        ? `cada ${a}s`
                        : `cada ${Math.round(a / 60)}m`;
                })(e.intervalMs),
                n = e.lastSuccessAt
                    ? `ultimo ciclo hace ${qa(Math.max(0, Math.round((Date.now() - Number(e.lastSuccessAt || 0)) / 1e3)))}`
                    : 'sin ciclo exitoso todavía';
            return 'refreshing' === t || Boolean(e.inFlight)
                ? {
                      state: 'active',
                      label: 'Actualizando ahora',
                      meta: `${a} · sincronizando equipos en vivo`,
                  }
                : 'paused' === t
                  ? {
                        state: 'paused',
                        label: 'Auto-refresh en pausa',
                        meta: String(
                            e.reason || 'Reanuda esta sección para continuar.'
                        ),
                    }
                  : 'warning' === t
                    ? {
                          state: 'warning',
                          label: 'Auto-refresh degradado',
                          meta: String(e.reason || `Modo degradado · ${n}`),
                      }
                    : 'active' === t
                      ? {
                            state: 'active',
                            label: 'Auto-refresh activo',
                            meta: `${a} · ${n}`,
                        }
                      : {
                            state: 'idle',
                            label: 'Auto-refresh listo',
                            meta: String(
                                e.reason ||
                                    'Abre Turnero Sala para empezar el monitoreo.'
                            ),
                        };
        })(),
        o = n.some((e) => 'alert' === e.state),
        s = n.some((e) => 'warning' === e.state || 'unknown' === e.state),
        r = o
            ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.'
            : s
              ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.'
              : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.',
        c = o ? 'Atender ahora' : s ? 'Revisar hoy' : 'Todo al día',
        u = o ? 'alert' : s ? 'warning' : 'ready';
    l(
        '#queueSurfaceTelemetry',
        `\n        <section class="queue-surface-telemetry__shell">\n            <div class="queue-surface-telemetry__header">\n                <div>\n                    <p class="queue-app-card__eyebrow">Equipos en vivo</p>\n                    <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${e(o ? 'Equipos con atención urgente' : s ? 'Equipos con señal parcial' : 'Equipos en vivo')}</h5>\n                    <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${e(r)}</p>\n                    <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">\n                        <span id="queueSurfaceTelemetryAutoState" class="queue-surface-telemetry__auto-state" data-state="${e(i.state)}">${e(i.label)}</span>\n                        <span class="queue-surface-telemetry__auto-copy">${e(i.meta)}</span>\n                    </div>\n                </div>\n                <span id="queueSurfaceTelemetryStatus" class="queue-surface-telemetry__status" data-state="${e(u)}">${e(c)}</span>\n            </div>\n            <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">\n                ${n.map((t) => `\n                    <article class="queue-surface-card" data-state="${e(t.state)}" role="listitem">\n                        <div class="queue-surface-card__header">\n                            <div>\n                                <strong>${e(t.title)}</strong>\n                                <p class="queue-surface-card__meta">${e(t.deviceLabel)}</p>\n                            </div>\n                            <span class="queue-surface-card__badge">${e(t.badge)}</span>\n                        </div>\n                        <p class="queue-surface-card__summary">${e(t.summary)}</p>\n                        <p class="queue-surface-card__age">${e(t.ageLabel)}</p>\n                        <div class="queue-surface-card__chips">${t.chips.map((t) => `<span class="queue-surface-card__chip">${e(t)}</span>`).join('')}</div>\n                        <div class="queue-surface-card__actions">\n                            <a href="${e(t.route)}" target="_blank" rel="noopener" class="queue-surface-card__action queue-surface-card__action--primary">${e(t.actionLabel)}</a>\n                            <button type="button" class="queue-surface-card__action" data-action="queue-copy-install-link" data-queue-install-url="${e(t.route)}">Copiar ruta</button>\n                            <button type="button" class="queue-surface-card__action" data-action="refresh-admin-data">Actualizar estado</button>\n                        </div>\n                    </article>\n                `).join('')}\n            </div>\n        </section>\n    `
    );
}
function Aa() {
    const e = b(),
        { queueMeta: t } = zt(),
        a = String(e.queue?.syncMode || 'live')
            .trim()
            .toLowerCase(),
        n = Boolean(e.queue?.fallbackPartial),
        i = String(t?.updatedAt || '').trim(),
        o = i ? Date.parse(i) : Number.NaN,
        s = Number.isFinite(o)
            ? Math.max(0, Math.round((Date.now() - o) / 1e3))
            : null;
    return 'fallback' === a || n
        ? {
              state: 'alert',
              badge: 'Atender ahora',
              title: 'Cola en fallback',
              summary:
                  'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
              steps: [
                  'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                  'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                  'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
              ],
          }
        : Number.isFinite(s) && s >= 60
          ? {
                state: 'warning',
                badge: `Watchdog ${s}s`,
                title: 'Realtime lento o en reconexión',
                summary:
                    'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
                steps: [
                    'Refresca la cola y confirma que Sync vuelva a "vivo".',
                    'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                    'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
                ],
            }
          : {
                state: 'ready',
                badge: 'Sin incidentes',
                title: 'Cola sincronizada',
                summary:
                    'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
                steps: [
                    'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
                    'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
                    'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
                ],
            };
}
function $a(e) {
    const t = Sa(e),
        a = t.latest && 'object' == typeof t.latest ? t.latest : null;
    return {
        group: t,
        details: a?.details && 'object' == typeof a.details ? a.details : {},
    };
}
function Ta(e) {
    const t = fa(e),
        a = 'c2' === t.station ? 'c2' : 'c1',
        n = $a('operator'),
        i = $a('kiosk'),
        o = $a('display'),
        s = String(n.details.station || '').toLowerCase(),
        r = String(n.details.connection || 'live').toLowerCase(),
        l = !t.lock || !s || s === a,
        c =
            'ready' === n.group.status &&
            !n.group.stale &&
            Boolean(n.details.numpadSeen) &&
            l &&
            'fallback' !== r,
        u = String(i.details.connection || '').toLowerCase(),
        d =
            'ready' === i.group.status &&
            !i.group.stale &&
            Boolean(i.details.printerPrinted) &&
            'live' === u,
        p = String(o.details.connection || '').toLowerCase(),
        m =
            'ready' === o.group.status &&
            !o.group.stale &&
            Boolean(o.details.bellPrimed) &&
            !o.details.bellMuted &&
            'live' === p,
        g =
            c &&
            m &&
            (function (e = 21600) {
                const t = zt().queueMeta;
                return (
                    Number(t?.calledCount || 0) > 0 ||
                    !!(
                        Array.isArray(b().data?.queueTickets)
                            ? b().data.queueTickets
                            : []
                    ).some((e) => 'called' === String(e.status || '')) ||
                    (b().queue?.activity || []).some((t) => {
                        const a = String(t?.message || '');
                        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(a))
                            return !1;
                        const n = Date.parse(String(t?.at || ''));
                        return !Number.isFinite(n) || Date.now() - n <= 1e3 * e;
                    })
                );
            })(),
        f = {
            operator_ready: {
                suggested: c,
                reason: c
                    ? `Heartbeat operador listo${t.lock ? ` en ${a.toUpperCase()} fijo` : ''} con numpad detectado.`
                    : 'unknown' === n.group.status
                      ? 'Todavía no hay heartbeat reciente del operador.'
                      : l
                        ? n.details.numpadSeen
                            ? 'Confirma el operador manualmente antes de abrir consulta.'
                            : 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                        : `El operador reporta ${s.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`,
            },
            kiosk_ready: {
                suggested: d,
                reason: d
                    ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                    : 'unknown' === i.group.status
                      ? 'Todavía no hay heartbeat reciente del kiosco.'
                      : i.details.printerPrinted
                        ? 'live' !== u
                            ? 'El kiosco no está reportando cola en vivo todavía.'
                            : 'Confirma el kiosco manualmente antes de abrir autoservicio.'
                        : 'Falta imprimir un ticket real o de prueba para validar la térmica.',
            },
            sala_ready: {
                suggested: m,
                reason: m
                    ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                    : 'unknown' === o.group.status
                      ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                      : o.details.bellMuted
                        ? 'La TV sigue en mute o con campanilla apagada.'
                        : o.details.bellPrimed
                          ? 'live' !== p
                              ? 'La Sala TV no está reportando conexión en vivo todavía.'
                              : 'Confirma la Sala TV manualmente antes del primer llamado.'
                          : 'Falta ejecutar la prueba de campanilla en la TV.',
            },
            smoke_ready: {
                suggested: g,
                reason: g
                    ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                    : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
            },
        },
        h = Object.entries(f)
            .filter(([e, t]) => Boolean(t?.suggested))
            .map(([e]) => e);
    return { suggestedIds: h, suggestions: f, suggestedCount: h.length };
}
function Ma(e, t) {
    const a = fa(t),
        n = e.operator || Yt.operator,
        i = e.kiosk || Yt.kiosk,
        o = e.sala_tv || Yt.sala_tv,
        s = ia('operator', n, { ...a }),
        r = ia('kiosk', i, { ...a }),
        l = ia('sala_tv', o, { ...a }),
        c = 'c2' === a.station ? 'C2' : 'C1';
    return [
        {
            id: 'operator_ready',
            title: 'Operador + Genius Numpad 1000',
            detail: `Abre Operador en ${a.lock ? `${c} fijo` : 'modo libre'}${a.oneTap ? ' con 1 tecla' : ''} y confirma Numpad Enter, Decimal y Subtract.`,
            hint: 'El receptor USB 2.4 GHz del numpad debe quedar conectado en el PC operador.',
            href: s,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_ready',
            title: 'Kiosco + ticket térmico',
            detail: 'Abre el kiosco, genera un ticket de prueba y confirma que el panel muestre "Impresion OK".',
            hint: 'Revisa papel, energía y USB de la térmica antes de dejar autoservicio abierto.',
            href: r,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_ready',
            title: 'Sala TV + audio en TCL C655',
            detail: 'Abre la sala, ejecuta "Probar campanilla" y confirma audio activo con la TV conectada por Ethernet.',
            hint: 'La TCL C655 debe quedar con volumen fijo y sin mute antes del primer llamado real.',
            href: l,
            actionLabel: 'Abrir sala TV',
        },
        {
            id: 'smoke_ready',
            title: 'Smoke final de apertura',
            detail: 'Haz un llamado real o de prueba desde Operador y verifica que recepción, kiosco y sala entiendan el flujo completo.',
            hint: 'Marca este paso solo cuando el llamado salga end-to-end y sea visible en la TV.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
    ];
}
function La(t, a = 'secondary') {
    if (!t) return '';
    const n =
        'primary' === a
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';
    return 'button' === t.kind
        ? `\n            <button ${t.id ? `id="${e(t.id)}"` : ''} type="button" class="${n}" ${t.action ? `data-action="${e(t.action)}"` : ''}>\n                ${e(t.label || 'Continuar')}\n            </button>\n        `
        : `\n        <a ${t.id ? `id="${e(t.id)}"` : ''} href="${e(t.href || '/')}" class="${n}" target="_blank" rel="noopener">\n            ${e(t.label || 'Continuar')}\n        </a>\n    `;
}
function Ea(t, a, n) {
    const i = document.getElementById('queueInstallConfigurator');
    if (!(i instanceof HTMLElement)) return;
    const o = (function (e, t) {
        const a = fa(t),
            n = (function (e) {
                return 'kiosk' === e.surface || 'sala_tv' === e.surface
                    ? e.surface
                    : 'operator';
            })(a),
            i = e[n];
        if (!i) return null;
        const o =
                (i.targets &&
                    i.targets[
                        (function (e, t) {
                            return 'sala_tv' === e
                                ? 'android_tv'
                                : 'mac' === t.platform
                                  ? 'mac'
                                  : 'win';
                        })(n, a)
                    ]) ||
                na(i, t) ||
                null,
            s = ia(n, i, a);
        return {
            preset: a,
            surfaceKey: n,
            appConfig: i,
            downloadTarget: o,
            preparedWebUrl: s,
            qrUrl: ra(('sala_tv' === n && o && o.url) || s),
            guideUrl: aa(n, a, i),
            summaryTitle: ya(a),
            setupSteps: va(a),
        };
    })(t, a);
    o
        ? ((function (t) {
              const {
                  preset: a,
                  surfaceKey: n,
                  downloadTarget: i,
                  preparedWebUrl: o,
                  summaryTitle: s,
                  setupSteps: r,
              } = t;
              var c;
              l(
                  '#queueInstallConfigurator',
                  `\n        <div class="queue-install-configurator__grid">\n            <section class="queue-install-configurator__panel">\n                <div>\n                    <p class="queue-app-card__eyebrow">Preparar equipo</p>\n                    <h5 class="queue-app-card__title">Asistente de instalación</h5>\n                    <p class="queue-app-card__description">Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.</p>\n                </div>\n                <div class="queue-install-configurator__fields">\n                    <label class="queue-install-field" for="queueInstallSurfaceSelect">\n                        <span>Equipo</span>\n                        <select id="queueInstallSurfaceSelect">\n                            <option value="operator"${'operator' === n ? ' selected' : ''}>Operador</option>\n                            <option value="kiosk"${'kiosk' === n ? ' selected' : ''}>Kiosco</option>\n                            <option value="sala_tv"${'sala_tv' === n ? ' selected' : ''}>Sala TV</option>\n                        </select>\n                    </label>\n                    ${(function (
                      e,
                      t
                  ) {
                      return 'operator' !== t
                          ? ''
                          : `\n        <label class="queue-install-field" for="queueInstallProfileSelect">\n            <span>Perfil operador</span>\n            <select id="queueInstallProfileSelect">\n                <option value="c1_locked"${e.lock && 'c1' === e.station ? ' selected' : ''}>C1 fijo</option>\n                <option value="c2_locked"${e.lock && 'c2' === e.station ? ' selected' : ''}>C2 fijo</option>\n                <option value="free"${e.lock ? '' : ' selected'}>Modo libre</option>\n            </select>\n        </label>`;
                  })(a, n)}\n                    ${(function (e, t) {
                      return 'sala_tv' === t
                          ? ''
                          : `\n        <label class="queue-install-field" for="queueInstallPlatformSelect">\n            <span>Plataforma</span>\n            <select id="queueInstallPlatformSelect">\n                <option value="win"${'win' === e.platform ? ' selected' : ''}>Windows</option>\n                <option value="mac"${'mac' === e.platform ? ' selected' : ''}>macOS</option>\n            </select>\n        </label>`;
                  })(a, n)}\n                    ${(function (e, t) {
                      return 'operator' !== t
                          ? ''
                          : `\n        <label class="queue-install-toggle">\n            <input id="queueInstallOneTapInput" type="checkbox"${e.oneTap ? ' checked' : ''} />\n            <span>Activar 1 tecla para este operador</span>\n        </label>`;
                  })(
                      a,
                      n
                  )}\n                </div>\n            </section>\n            <section class="queue-install-configurator__panel queue-install-configurator__result">\n                <div>\n                    <p class="queue-app-card__eyebrow">Resultado listo</p>\n                    <h5 class="queue-app-card__title">${e(s)}</h5>\n                    <p class="queue-app-card__description">${'sala_tv' === n ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}</p>\n                </div>\n                <div class="queue-install-result__chips">\n                    ${(function (
                      t
                  ) {
                      const { downloadTarget: a, preset: n, surfaceKey: i } = t,
                          o =
                              'operator' === i
                                  ? `<span class="queue-app-card__tag">${n.lock ? ('c2' === n.station ? 'C2 bloqueado' : 'C1 bloqueado') : 'Modo libre'}</span>`
                                  : '';
                      return `\n        <span class="queue-app-card__tag">${e(a && a.label ? a.label : 'Perfil listo')}</span>\n        ${o}`;
                  })(
                      t
                  )}\n                </div>\n                <div class="queue-install-result__meta"><span>Descarga recomendada</span><strong>${e((i && i.url) || 'Sin artefacto')}</strong></div>\n                <div class="queue-install-result__meta"><span>Ruta web preparada</span><strong>${e(o)}</strong></div>\n                <div class="queue-install-configurator__actions">\n                    ${(function (
                      t
                  ) {
                      const {
                              downloadTarget: a,
                              preparedWebUrl: n,
                              qrUrl: i,
                              guideUrl: o,
                          } = t,
                          s = (a && a.url) || '';
                      return `\n        ${s ? `<a href="${e(s)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>` : ''}\n        <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${e(s)}">Copiar descarga</button>\n        <a href="${e(n)}" target="_blank" rel="noopener">Abrir ruta preparada</a>\n        <button type="button" data-action="queue-copy-install-link" data-queue-install-url="${e(n)}">Copiar ruta preparada</button>\n        <a href="${e(i)}" target="_blank" rel="noopener">Mostrar QR</a>\n        <a href="${e(o)}" target="_blank" rel="noopener">Abrir centro público</a>`;
                  })(
                      t
                  )}\n                </div>\n                <ul class="queue-app-card__notes">${((c = r), c.map((t) => `<li>${e(t)}</li>`).join(''))}</ul>\n            </section>\n        </div>\n    `
              );
          })(o),
          (function (e, t) {
              (!(function (e, t) {
                  const a = document.getElementById(
                      'queueInstallSurfaceSelect'
                  );
                  a instanceof HTMLSelectElement &&
                      (a.onchange = () => {
                          (ha({ surface: a.value }, e), t());
                      });
              })(e, t),
                  (function (e, t) {
                      const a = document.getElementById(
                          'queueInstallProfileSelect'
                      );
                      a instanceof HTMLSelectElement &&
                          (a.onchange = () => {
                              (ha(
                                  {
                                      station:
                                          'c2_locked' === a.value ? 'c2' : 'c1',
                                      lock: 'free' !== a.value,
                                  },
                                  e
                              ),
                                  t());
                          });
                  })(e, t),
                  (function (e, t) {
                      const a = document.getElementById(
                          'queueInstallPlatformSelect'
                      );
                      a instanceof HTMLSelectElement &&
                          (a.onchange = () => {
                              (ha(
                                  {
                                      platform:
                                          'mac' === a.value ? 'mac' : 'win',
                                  },
                                  e
                              ),
                                  t());
                          });
                  })(e, t),
                  (function (e, t) {
                      const a = document.getElementById(
                          'queueInstallOneTapInput'
                      );
                      a instanceof HTMLInputElement &&
                          (a.onchange = () => {
                              (ha({ oneTap: a.checked }, e), t());
                          });
                  })(e, t));
          })(a, n))
        : (i.innerHTML = '');
}
function Na() {
    if (
        !(
            document.getElementById('queueAppDownloadsCards') instanceof
            HTMLElement
        )
    )
        return;
    const t = oa(),
        a = document.getElementById('queueAppsPlatformChip');
    (r(
        '#queueAppsPlatformChip',
        'mac' === t
            ? 'macOS detectado'
            : 'win' === t
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo'
    ),
        a instanceof HTMLElement && a.setAttribute('data-platform', t));
    const n = (function () {
        const e = b().data.appDownloads;
        return e && 'object' == typeof e
            ? {
                  operator: {
                      ...Yt.operator,
                      ...(e.operator || {}),
                      targets: {
                          ...Yt.operator.targets,
                          ...((e.operator && e.operator.targets) || {}),
                      },
                  },
                  kiosk: {
                      ...Yt.kiosk,
                      ...(e.kiosk || {}),
                      targets: {
                          ...Yt.kiosk.targets,
                          ...((e.kiosk && e.kiosk.targets) || {}),
                      },
                  },
                  sala_tv: {
                      ...Yt.sala_tv,
                      ...(e.sala_tv || {}),
                      targets: {
                          ...Yt.sala_tv.targets,
                          ...((e.sala_tv && e.sala_tv.targets) || {}),
                      },
                  },
              }
            : Yt;
    })();
    l(
        '#queueAppDownloadsCards',
        [
            ka('operator', n.operator, t),
            ka('kiosk', n.kiosk, t),
            wa(n.sala_tv),
        ].join('')
    );
    const i = () => {
        ((function (t, a, n) {
            if (
                !(
                    document.getElementById('queueOpsPilot') instanceof
                    HTMLElement
                )
            )
                return;
            const i = (function (e, t) {
                const a = ba(),
                    n = Ma(e, t),
                    i = Ta(t),
                    o = Aa(),
                    s = n.filter((e) => a.steps[e.id]).length,
                    r = i.suggestedCount,
                    l = n
                        .filter((e) => !a.steps[e.id])
                        .filter((e) => !i.suggestions[e.id]?.suggested),
                    c = ['operator_ready', 'kiosk_ready', 'sala_ready'].filter(
                        (e) => Boolean(i.suggestions[e]?.suggested)
                    ).length,
                    u = Math.max(0, 3 - c) + ('ready' === o.state ? 0 : 1),
                    d =
                        n.length > 0
                            ? Math.max(
                                  0,
                                  Math.min(
                                      100,
                                      Math.round((s / n.length) * 100)
                                  )
                              )
                            : 0;
                let p, m, b, g, f, h, y;
                return (
                    'alert' === o.state
                        ? ((p = 'alert'),
                          (m = 'Siguiente paso'),
                          (b = 'Resuelve la cola antes de abrir'),
                          (g =
                              'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.'),
                          (f = {
                              kind: 'button',
                              id: 'queueOpsPilotRefreshBtn',
                              action: 'queue-refresh-state',
                              label: 'Refrescar cola ahora',
                          }),
                          (h = {
                              kind: 'anchor',
                              href: '/admin.html#queue',
                              label: 'Abrir cola admin',
                          }),
                          (y =
                              'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.'))
                        : r > 0
                          ? ((p = 'suggested'),
                            (m = 'Siguiente paso'),
                            (b = `Confirma ${r} paso(s) ya validados`),
                            (g =
                                l.length > 0
                                    ? `${r} paso(s) ya aparecen listos por heartbeat. Después te quedará ${l[0].title}.`
                                    : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.'),
                            (f = {
                                kind: 'button',
                                id: 'queueOpsPilotApplyBtn',
                                label: `Confirmar sugeridos (${r})`,
                            }),
                            (h =
                                l.length > 0
                                    ? {
                                          kind: 'anchor',
                                          href: l[0].href,
                                          label: l[0].actionLabel,
                                      }
                                    : {
                                          kind: 'anchor',
                                          href: '/admin.html#queue',
                                          label: 'Volver a la cola',
                                      }),
                            (y =
                                'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.'))
                          : l.length > 0
                            ? ((p =
                                  'warning' === o.state ? 'warning' : 'active'),
                              (m = 'Siguiente paso'),
                              (b = `Siguiente paso: ${l[0].title}`),
                              (g =
                                  l.length > 1
                                      ? `Quedan ${l.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                                      : 'Solo queda una validación manual para dejar la apertura lista.'),
                              (f = {
                                  kind: 'anchor',
                                  href: l[0].href,
                                  label: l[0].actionLabel,
                              }),
                              (h =
                                  'warning' === o.state
                                      ? {
                                            kind: 'button',
                                            id: 'queueOpsPilotRefreshBtn',
                                            action: 'queue-refresh-state',
                                            label: 'Refrescar cola',
                                        }
                                      : {
                                            kind: 'anchor',
                                            href: '/admin.html#queue',
                                            label: 'Abrir cola admin',
                                        }),
                              (y = String(
                                  i.suggestions[l[0].id]?.reason ||
                                      l[0].hint ||
                                      ''
                              )))
                            : ((p = 'ready'),
                              (m = 'Operación lista'),
                              (b = 'Apertura completada'),
                              (g =
                                  'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.'),
                              (f = {
                                  kind: 'anchor',
                                  href: '/admin.html#queue',
                                  label: 'Abrir cola admin',
                              }),
                              (h = {
                                  kind: 'anchor',
                                  href: ia(
                                      'operator',
                                      e.operator || Yt.operator,
                                      { ...fa(t) }
                                  ),
                                  label: 'Abrir operador',
                              }),
                              (y =
                                  'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.')),
                    {
                        tone: p,
                        eyebrow: m,
                        title: b,
                        summary: g,
                        supportCopy: y,
                        progressPct: d,
                        confirmedCount: s,
                        suggestedCount: r,
                        totalSteps: n.length,
                        readyEquipmentCount: c,
                        issueCount: u,
                        primaryAction: f,
                        secondaryAction: h,
                    }
                );
            })(t, a);
            l(
                '#queueOpsPilot',
                `\n        <section class="queue-ops-pilot__shell" data-state="${e(i.tone)}">\n            <div class="queue-ops-pilot__layout">\n                <div class="queue-ops-pilot__copy">\n                    <p class="queue-app-card__eyebrow">${e(i.eyebrow)}</p>\n                    <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${e(i.title)}</h5>\n                    <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${e(i.summary)}</p>\n                    <p class="queue-ops-pilot__support">${e(i.supportCopy)}</p>\n                    <div class="queue-ops-pilot__actions">\n                        ${La(i.primaryAction, 'primary')}\n                        ${La(i.secondaryAction, 'secondary')}\n                    </div>\n                </div>\n                <div class="queue-ops-pilot__status">\n                    <div class="queue-ops-pilot__progress">\n                        <div class="queue-ops-pilot__progress-head">\n                            <span>Apertura confirmada</span>\n                            <strong id="queueOpsPilotProgressValue">${e(`${i.confirmedCount}/${i.totalSteps}`)}</strong>\n                        </div>\n                        <div class="queue-ops-pilot__bar" aria-hidden="true">\n                            <span style="width:${e(String(i.progressPct))}%"></span>\n                        </div>\n                    </div>\n                    <div class="queue-ops-pilot__chips">\n                        <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">Confirmados ${e(String(i.confirmedCount))}</span>\n                        <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">Sugeridos ${e(String(i.suggestedCount))}</span>\n                        <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">Equipos listos ${e(String(i.readyEquipmentCount))}/3</span>\n                        <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">Incidencias ${e(String(i.issueCount))}</span>\n                    </div>\n                </div>\n            </div>\n        </section>\n    `
            );
            const o = document.getElementById('queueOpsPilotApplyBtn');
            o instanceof HTMLButtonElement &&
                (o.onclick = () => {
                    const e = Ta(a);
                    e.suggestedIds.length && (ga(e.suggestedIds), n());
                });
        })(n, t, i),
            _a(n, t),
            (function (t, a) {
                if (
                    !(
                        document.getElementById(
                            'queueContingencyDeck'
                        ) instanceof HTMLElement
                    )
                )
                    return;
                const { syncHealth: n, cards: i } = (function (e, t) {
                        const a = fa(t),
                            n = e.operator || Yt.operator,
                            i = e.kiosk || Yt.kiosk,
                            o = e.sala_tv || Yt.sala_tv,
                            s = Aa(),
                            r = 'c2' === a.station ? 'C2' : 'C1',
                            l = a.lock ? `${r} fijo` : 'modo libre',
                            c = ia('operator', n, { ...a }),
                            u = ia('kiosk', i, { ...a }),
                            d = ia('sala_tv', o, { ...a });
                        return {
                            syncHealth: s,
                            cards: [
                                {
                                    id: 'operator_issue',
                                    state: 'neutral',
                                    badge: 'Numpad',
                                    title: 'Numpad no responde',
                                    summary: `Abre Operador en ${l}${a.oneTap ? ' con 1 tecla' : ''}, recalibra la tecla externa y confirma Enter, Decimal y Subtract del Genius Numpad 1000.`,
                                    steps: [
                                        'Confirma que el receptor USB 2.4 GHz siga conectado en el PC operador.',
                                        'Dentro de Operador usa "Calibrar tecla" si el Enter del numpad no dispara llamada.',
                                        'Mientras corriges el teclado, puedes seguir operando por clics sin cambiar de equipo.',
                                    ],
                                    actions: [
                                        {
                                            type: 'link',
                                            href: c,
                                            label: 'Abrir operador',
                                            primary: !0,
                                        },
                                        {
                                            type: 'copy',
                                            url: c,
                                            label: 'Copiar ruta',
                                        },
                                        {
                                            type: 'link',
                                            href: aa('operator', a, n),
                                            label: 'Centro de instalación',
                                            external: !0,
                                        },
                                    ],
                                },
                                {
                                    id: 'kiosk_issue',
                                    state: 'neutral',
                                    badge: 'Térmica',
                                    title: 'Térmica no imprime',
                                    summary:
                                        'Abre Kiosco, genera un ticket de prueba y confirma "Impresion OK" antes de volver al autoservicio.',
                                    steps: [
                                        'Revisa papel, energía y cable USB de la impresora térmica.',
                                        'Si el equipo sigue estable, usa el kiosco web preparado mientras validas la app desktop.',
                                        'No cierres el flujo de check-in hasta imprimir al menos un ticket de prueba correcto.',
                                    ],
                                    actions: [
                                        {
                                            type: 'link',
                                            href: u,
                                            label: 'Abrir kiosco',
                                            primary: !0,
                                        },
                                        {
                                            type: 'copy',
                                            url: u,
                                            label: 'Copiar ruta',
                                        },
                                        {
                                            type: 'link',
                                            href: aa('kiosk', a, i),
                                            label: 'Centro de instalación',
                                            external: !0,
                                        },
                                    ],
                                },
                                {
                                    id: 'sala_issue',
                                    state: 'neutral',
                                    badge: 'Audio',
                                    title: 'Sala TV sin campanilla',
                                    summary:
                                        'Abre la Sala TV, ejecuta la prueba de campanilla y deja la TCL C655 con volumen fijo y Ethernet activo.',
                                    steps: [
                                        'Confirma que la TV no esté en mute y que la app siga en foreground.',
                                        'Si la APK falla, usa `sala-turnos.html` como respaldo inmediato en el navegador de la TV.',
                                        'Solo reinstala la APK si ya probaste campanilla, red y energía de la pantalla.',
                                    ],
                                    actions: [
                                        {
                                            type: 'link',
                                            href: d,
                                            label: 'Abrir sala TV',
                                            primary: !0,
                                        },
                                        {
                                            type: 'link',
                                            href: aa('sala_tv', a, o),
                                            label: 'Instalar APK',
                                            external: !0,
                                        },
                                        {
                                            type: 'copy',
                                            url: d,
                                            label: 'Copiar fallback web',
                                        },
                                    ],
                                },
                                {
                                    id: 'sync_issue',
                                    state: s.state,
                                    badge: s.badge,
                                    title: s.title,
                                    summary: s.summary,
                                    steps: s.steps,
                                    actions: [
                                        {
                                            type: 'button',
                                            action: 'queue-refresh-state',
                                            label: 'Refrescar cola',
                                            primary: 'ready' !== s.state,
                                        },
                                        {
                                            type: 'link',
                                            href: c,
                                            label: 'Abrir operador web',
                                        },
                                        {
                                            type: 'copy',
                                            url: u,
                                            label: 'Copiar kiosco web',
                                        },
                                    ],
                                },
                            ],
                        };
                    })(t, a),
                    o =
                        'alert' === n.state
                            ? 'Contingencia activa'
                            : 'warning' === n.state
                              ? 'Contingencia preventiva'
                              : 'Contingencia rápida lista',
                    s =
                        'alert' === n.state
                            ? 'Resuelve primero la sincronización y luego ataca hardware puntual. Las rutas de abajo ya quedan preparadas para operar sin perder tiempo.'
                            : 'warning' === n.state
                              ? 'Hay señal de retraso en la cola. Usa estas rutas directas antes de que el operador quede fuera de contexto.'
                              : 'Las tarjetas de abajo sirven como ruta corta cuando algo falla en medio de la jornada, sin mezclar instalación con operación.';
                l(
                    '#queueContingencyDeck',
                    `\n        <section class="queue-contingency-deck__shell">\n            <div class="queue-contingency-deck__header">\n                <div>\n                    <p class="queue-app-card__eyebrow">Contingencia rápida</p>\n                    <h5 id="queueContingencyTitle" class="queue-app-card__title">${e(o)}</h5>\n                    <p id="queueContingencySummary" class="queue-contingency-deck__summary">${e(s)}</p>\n                </div>\n                <span id="queueContingencyStatus" class="queue-contingency-deck__status" data-state="${e(n.state)}">${e(n.badge)}</span>\n            </div>\n            <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">\n                ${i
                        .map(
                            (t) =>
                                `\n                    <article class="queue-contingency-card" ${'sync_issue' === t.id ? 'id="queueContingencySyncCard"' : ''} data-state="${e(t.state)}" role="listitem">\n                        <div class="queue-contingency-card__header">\n                            <div>\n                                <strong>${e(t.title)}</strong>\n                                <p class="queue-contingency-card__summary">${e(t.summary)}</p>\n                            </div>\n                            <span class="queue-contingency-card__badge">${e(t.badge)}</span>\n                        </div>\n                        <ul class="queue-contingency-card__steps">${t.steps.map((t) => `<li>${e(t)}</li>`).join('')}</ul>\n                        <div class="queue-contingency-card__actions">${t.actions
                                    .map((a, n) =>
                                        (function (t, a, n) {
                                            const i = e(a.label || 'Abrir'),
                                                o = a.primary
                                                    ? 'queue-contingency-card__action queue-contingency-card__action--primary'
                                                    : 'queue-contingency-card__action';
                                            return 'button' === a.type
                                                ? `\n            <button type="button" class="${o}" data-action="${e(a.action || '')}" data-queue-contingency-card="${e(t)}" data-queue-contingency-action-index="${e(String(n))}">\n                ${i}\n            </button>\n        `
                                                : 'copy' === a.type
                                                  ? `\n            <button type="button" class="${o}" data-action="queue-copy-install-link" data-queue-install-url="${e(a.url || '')}" data-queue-contingency-card="${e(t)}" data-queue-contingency-action-index="${e(String(n))}">\n                ${i}\n            </button>\n        `
                                                  : `\n        <a href="${e(a.href || '/')}" class="${o}" ${a.external ? 'target="_blank" rel="noopener"' : ''}>\n            ${i}\n        </a>\n    `;
                                        })(t.id, a, n)
                                    )
                                    .join(
                                        ''
                                    )}</div>\n                    </article>\n                `
                        )
                        .join(
                            ''
                        )}\n            </div>\n        </section>\n    `
                );
            })(n, t),
            (function (t, a, n) {
                const i = document.getElementById('queueOpeningChecklist');
                if (!(i instanceof HTMLElement)) return;
                const o = ba(),
                    s = Ma(t, a),
                    r = Ta(a);
                (l(
                    '#queueOpeningChecklist',
                    (function (t, a, n) {
                        const i = t.filter((e) => a.steps[e.id]).length,
                            o = t.filter(
                                (e) =>
                                    !a.steps[e.id] &&
                                    Boolean(n.suggestions[e.id]?.suggested)
                            ).length,
                            s = t.length - i,
                            r =
                                s <= 0
                                    ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
                                    : o > 0
                                      ? `${o} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
                                      : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';
                        return `\n        <section class="queue-opening-checklist__shell">\n            <div class="queue-opening-checklist__header">\n                <div>\n                    <p class="queue-app-card__eyebrow">Apertura diaria</p>\n                    <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${e(s <= 0 ? 'Apertura diaria lista' : o > 0 ? 'Apertura diaria asistida' : i <= 0 ? 'Apertura diaria pendiente' : `Apertura diaria: faltan ${s} paso(s)`)}</h5>\n                    <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${e(r)}</p>\n                </div>\n                <div class="queue-opening-checklist__meta">\n                    <span id="queueOpeningChecklistAssistChip" class="queue-opening-checklist__assist" data-state="${o > 0 ? 'suggested' : s <= 0 ? 'ready' : 'idle'}">${e(o > 0 ? `Sugeridos ${o}` : s <= 0 ? 'Checklist completo' : `Confirmados ${i}/${t.length}`)}</span>\n                    <button id="queueOpeningChecklistApplyBtn" type="button" class="queue-opening-checklist__apply" ${o > 0 ? '' : 'disabled'}>${o > 0 ? `Confirmar sugeridos (${o})` : 'Sin sugeridos todavía'}</button>\n                    <button id="queueOpeningChecklistResetBtn" type="button" class="queue-opening-checklist__reset">Reiniciar apertura de hoy</button>\n                    <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">${e(
                            (function (e) {
                                const t = String(e || '').trim(),
                                    a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
                                return a
                                    ? `${a[3]}/${a[2]}/${a[1]}`
                                    : t || '--';
                            })(a.date)
                        )}</span>\n                </div>\n            </div>\n            <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">\n                ${t
                            .map((t) => {
                                const i = Boolean(a.steps[t.id]),
                                    o =
                                        !i &&
                                        Boolean(n.suggestions[t.id]?.suggested),
                                    s = i
                                        ? 'ready'
                                        : o
                                          ? 'suggested'
                                          : 'pending',
                                    r = i
                                        ? 'Confirmado'
                                        : o
                                          ? 'Sugerido'
                                          : 'Pendiente',
                                    l = String(
                                        n.suggestions[t.id]?.reason || t.hint
                                    );
                                return `\n                        <article class="queue-opening-step" data-state="${s}" role="listitem">\n                            <div class="queue-opening-step__header">\n                                <div>\n                                    <strong>${e(t.title)}</strong>\n                                    <p class="queue-opening-step__detail">${e(t.detail)}</p>\n                                </div>\n                                <span class="queue-opening-step__state">${e(r)}</span>\n                            </div>\n                            <p class="queue-opening-step__hint">${e(t.hint)}</p>\n                            <p class="queue-opening-step__evidence">${e(l)}</p>\n                            <div class="queue-opening-step__actions">\n                                <a href="${e(t.href)}" target="_blank" rel="noopener" class="queue-opening-step__primary">${e(t.actionLabel)}</a>\n                                <button id="queueOpeningToggle_${e(t.id)}" type="button" class="queue-opening-step__toggle" data-queue-opening-step="${e(t.id)}" data-state="${s}">${i ? 'Marcar pendiente' : o ? 'Confirmar sugerido' : 'Marcar listo'}</button>\n                            </div>\n                        </article>\n                    `;
                            })
                            .join(
                                ''
                            )}\n            </div>\n        </section>\n    `;
                    })(s, o, r)
                ),
                    (function (e, t) {
                        e.querySelectorAll('[data-queue-opening-step]').forEach(
                            (e) => {
                                e instanceof HTMLButtonElement &&
                                    (e.onclick = () => {
                                        const a = String(
                                            e.dataset.queueOpeningStep || ''
                                        );
                                        (!(function (e, t) {
                                            const a = ba();
                                            ta.includes(e) &&
                                                ma({
                                                    ...a,
                                                    steps: {
                                                        ...a.steps,
                                                        [e]: Boolean(t),
                                                    },
                                                });
                                        })(a, !ba().steps[a]),
                                            t());
                                    });
                            }
                        );
                    })(i, n),
                    (function (e, t) {
                        const a = document.getElementById(
                            'queueOpeningChecklistApplyBtn'
                        );
                        a instanceof HTMLButtonElement &&
                            (a.onclick = () => {
                                e.suggestedIds.length &&
                                    (ga(e.suggestedIds), t());
                            });
                        const n = document.getElementById(
                            'queueOpeningChecklistResetBtn'
                        );
                        n instanceof HTMLButtonElement &&
                            (n.onclick = () => {
                                (ma(da(ua())), t());
                            });
                    })(r, n));
            })(n, t, i),
            Ea(n, t, i));
    };
    i();
}
function Ba(t = () => {}) {
    const a = b(),
        { queueMeta: n } = zt(),
        i = Vt(),
        o = Kt(),
        s = Qt(),
        c = Wt(a.queue.stationConsultorio);
    (Na(),
        (function (e, t) {
            const a = b();
            (!(function (e) {
                (r(
                    '#queueWaitingCountAdmin',
                    Number(e.waitingCount || e.counts?.waiting || 0)
                ),
                    r(
                        '#queueCalledCountAdmin',
                        Number(e.calledCount || e.counts?.called || 0)
                    ));
            })(e),
                (function (e) {
                    const t = wt(e, 1),
                        a = wt(e, 2),
                        n = qt(t),
                        i = qt(a);
                    (r('#queueC1Now', n),
                        r('#queueC2Now', i),
                        St('queueReleaseC1', 1, t, n),
                        St('queueReleaseC2', 2, a, i));
                })(e),
                (function (e, t, a) {
                    const n = document.getElementById('queueSyncStatus');
                    if ('fallback' === Ct(e.queue.syncMode))
                        return (
                            r('#queueSyncStatus', 'fallback'),
                            void (n && n.setAttribute('data-state', 'fallback'))
                        );
                    const i = String(t.updatedAt || '').trim();
                    if (!i) return;
                    const o = Math.max(
                            0,
                            Math.round((Date.now() - Mt(i)) / 1e3)
                        ),
                        s = o >= 60,
                        l = Math.max(0, Number(t.assistancePendingCount || 0)),
                        c = s ? `Watchdog (${o}s)` : 'vivo';
                    if (
                        (r('#queueSyncStatus', l ? `${c} · ${l} apoyo(s)` : c),
                        n &&
                            n.setAttribute(
                                'data-state',
                                s ? 'reconnecting' : 'live'
                            ),
                        s)
                    ) {
                        const e = `stale-${Math.floor(o / 15)}`;
                        return void (
                            e !== Et &&
                            ((Et = e),
                            a('Watchdog de cola: realtime en reconnecting'))
                        );
                    }
                    Et = 'live';
                })(a, e, t));
        })(n, t),
        (function (e) {
            l(
                '#queueTableBody',
                e.length
                    ? e.map(Jt).join('')
                    : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
            );
        })(i),
        (function (t, a) {
            const n = $t(t.nextTickets),
                i = Number(t.waitingCount || t.counts?.waiting || 0),
                o =
                    a && n.length && i > n.length
                        ? `<li><span>-</span><strong>Mostrando primeros ${n.length} de ${i} en espera</strong></li>`
                        : '';
            l(
                '#queueNextAdminList',
                n.length
                    ? `${o}${n.map((t) => `<li><span>${e(t.ticketCode || t.ticket_code || '--')}</span><strong>${e(t.patientInitials || t.patient_initials || '--')}</strong></li>`).join('')}`
                    : '<li><span>-</span><strong>Sin siguientes</strong></li>'
            );
        })(n, a.queue.fallbackPartial),
        (function ({
            state: e,
            visible: t,
            selectedCount: a,
            activeStationTicket: n,
        }) {
            const i = (function (e) {
                    return e.filter(
                        (e) =>
                            'waiting' === e.status &&
                            (Math.max(
                                0,
                                Math.round((Date.now() - Mt(e.createdAt)) / 6e4)
                            ) >= 20 ||
                                'appt_overdue' === Ct(e.priorityClass))
                    ).length;
                })(t),
                o = [i > 0 ? `riesgo: ${i}` : 'sin riesgo'];
            (a > 0 && o.push(`seleccion: ${a}`),
                e.queue.fallbackPartial && o.push('fallback parcial'),
                n &&
                    o.push(
                        `activo: ${n.ticketCode} en C${e.queue.stationConsultorio}`
                    ),
                r('#queueTriageSummary', o.join(' | ')));
        })({
            state: a,
            visible: i,
            selectedCount: o.length,
            activeStationTicket: c,
        }),
        (function ({ visibleCount: e, selectedCount: t, bulkTargetCount: a }) {
            r('#queueSelectedCount', t);
            const n = document.getElementById('queueSelectionChip');
            n instanceof HTMLElement &&
                n.classList.toggle('is-hidden', 0 === t);
            const i = document.getElementById('queueSelectVisibleBtn');
            i instanceof HTMLButtonElement && (i.disabled = 0 === e);
            const o = document.getElementById('queueClearSelectionBtn');
            (o instanceof HTMLButtonElement && (o.disabled = 0 === t),
                document
                    .querySelectorAll(
                        '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
                    )
                    .forEach((e) => {
                        e instanceof HTMLButtonElement &&
                            (e.disabled = 0 === a);
                    }));
        })({
            visibleCount: i.length,
            selectedCount: o.length,
            bulkTargetCount: s.length,
        }),
        (function (e, t) {
            (r('#queueStationBadge', `Estación C${e.queue.stationConsultorio}`),
                r(
                    '#queueStationModeBadge',
                    'locked' === e.queue.stationMode ? 'Bloqueado' : 'Libre'
                ),
                document
                    .querySelectorAll(
                        '[data-action="queue-call-next"][data-queue-consultorio]'
                    )
                    .forEach((t) => {
                        if (!(t instanceof HTMLButtonElement)) return;
                        const a =
                            2 === Number(t.dataset.queueConsultorio || 1)
                                ? 2
                                : 1;
                        t.disabled =
                            'locked' === e.queue.stationMode &&
                            a !== Number(e.queue.stationConsultorio || 1);
                    }),
                document
                    .querySelectorAll(
                        '[data-action="queue-release-station"][data-queue-consultorio]'
                    )
                    .forEach((a) => {
                        if (!(a instanceof HTMLButtonElement)) return;
                        const n =
                                2 === Number(a.dataset.queueConsultorio || 1)
                                    ? 2
                                    : 1,
                            i =
                                n === Number(e.queue.stationConsultorio || 1)
                                    ? t
                                    : Wt(n);
                        ((a.disabled = !i),
                            'locked' === e.queue.stationMode &&
                                n !== Number(e.queue.stationConsultorio || 1) &&
                                (a.disabled = !0));
                    }));
        })(a, c),
        (function (e) {
            const t = document.getElementById('queuePracticeModeBadge');
            t instanceof HTMLElement && (t.hidden = !e.queue.practiceMode);
            const a = document.getElementById('queueShortcutPanel');
            a instanceof HTMLElement && (a.hidden = !e.queue.helpOpen);
            const n = document.querySelector(
                '[data-action="queue-clear-call-key"]'
            );
            n instanceof HTMLElement && (n.hidden = !e.queue.customCallKey);
            const i = document.querySelector(
                '[data-action="queue-toggle-one-tap"]'
            );
            i instanceof HTMLElement &&
                (i.setAttribute(
                    'aria-pressed',
                    String(Boolean(e.queue.oneTap))
                ),
                (i.textContent = e.queue.oneTap
                    ? '1 tecla ON'
                    : '1 tecla OFF'));
        })(a),
        yt());
}
function Da(e) {
    g((t) => {
        const a = [
            { at: new Date().toISOString(), message: String(e || '') },
            ...(t.queue.activity || []),
        ].slice(0, 30);
        return { ...t, queue: { ...t.queue, activity: a } };
    });
    try {
        yt();
    } catch (e) {}
}
function Pa(e, { render: t = !0 } = {}) {
    (g((t) => ({
        ...t,
        queue: { ...t.queue, selected: Ut(e, t.data.queueTickets || []) },
    })),
        t && Ba(Da));
}
function Ia() {
    Pa([]);
}
function xa(e, t = '') {
    try {
        const a = localStorage.getItem(e);
        return null === a ? t : a;
    } catch (e) {
        return t;
    }
}
function Oa(e, t) {
    try {
        localStorage.setItem(e, String(t));
    } catch (e) {}
}
function Ha(e, t) {
    try {
        const a = localStorage.getItem(e);
        return a ? JSON.parse(a) : t;
    } catch (e) {
        return t;
    }
}
function Fa(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ja(e) {
    try {
        return new URL(window.location.href).searchParams.get(e) || '';
    } catch (e) {
        return '';
    }
}
const Ra = 'queueStationMode',
    za = 'queueStationConsultorio',
    Va = 'queueOneTapAdvance',
    Ua = 'queueCallKeyBindingV1',
    Ka = 'queueNumpadHelpOpen',
    Qa = 'queueAdminLastSnapshot',
    Wa = new Map([
        [1, !1],
        [2, !1],
    ]),
    Ga = new Set(['no_show', 'cancelar']);
function Ja(e) {
    (Oa(Ra, e.queue.stationMode || 'free'),
        Oa(za, e.queue.stationConsultorio || 1),
        Oa(Va, e.queue.oneTap ? '1' : '0'),
        Oa(Ka, e.queue.helpOpen ? '1' : '0'),
        e.queue.customCallKey
            ? Fa(Ua, e.queue.customCallKey)
            : (function (e) {
                  try {
                      localStorage.removeItem(e);
                  } catch (e) {}
              })(Ua),
        Fa(Qa, {
            queueMeta: e.data.queueMeta,
            queueTickets: e.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Ya(e, t = null, a = {}) {
    const n = (Array.isArray(e) ? e : []).map((e, t) => Bt(e, t)),
        i = xt(t && 'object' == typeof t ? t : Nt(n), n),
        o = n.filter((e) => 'waiting' === e.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === Ct(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === Ct(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((e) => ({
        ...e,
        data: { ...e.data, queueTickets: n, queueMeta: i },
        queue: {
            ...e.queue,
            selected: Ut(e.queue.selected || [], n),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        Ja(b()),
        Ba(Da));
}
function Za(e, t) {
    const a = Number(e || 0),
        n = (b().data.queueTickets || []).map((e, n) => {
            const i = Bt(e, n);
            return i.id !== a
                ? i
                : Bt('function' == typeof t ? t(i) : { ...i }, n);
        });
    Ya(n, Nt(n), { fallbackPartial: !1, syncMode: 'live' });
}
function Xa(e) {
    (g((t) => ({ ...t, queue: { ...t.queue, ...e } })), Ja(b()), Ba(Da));
}
function en(e) {
    Xa({ filter: Ct(e) || 'all', selected: [] });
}
function tn(e, t) {
    const a = Lt(t.createdAt, t.created_at, e?.createdAt, e?.created_at),
        n = Lt(
            t.priorityClass,
            t.priority_class,
            e?.priorityClass,
            e?.priority_class,
            'walk_in'
        ),
        i = Lt(
            t.queueType,
            t.queue_type,
            e?.queueType,
            e?.queue_type,
            'walk_in'
        ),
        o = Lt(
            t.patientInitials,
            t.patient_initials,
            e?.patientInitials,
            e?.patient_initials,
            '--'
        );
    return {
        ...(e || {}),
        ...t,
        status: t.status,
        assignedConsultorio: t.assignedConsultorio,
        createdAt: a || new Date().toISOString(),
        priorityClass: n,
        queueType: i,
        patientInitials: o,
    };
}
function an(e, t = {}) {
    const { queueState: a, payloadTicket: n } = (function (e) {
        const t =
                e?.data?.queueState ||
                e?.data?.queue_state ||
                e?.data?.queueMeta ||
                e?.data ||
                null,
            a =
                t && 'object' == typeof t
                    ? (function (e) {
                          return e && 'object' == typeof e
                              ? Array.isArray(e.queue_tickets)
                                  ? e.queue_tickets
                                  : Array.isArray(e.queueTickets)
                                    ? e.queueTickets
                                    : Array.isArray(e.tickets)
                                      ? e.tickets
                                      : []
                              : [];
                      })(t)
                    : [];
        return {
            queueState:
                t && 'object' == typeof t ? { ...t, __fullTickets: a } : t,
            payloadTicket: e?.data?.ticket || null,
        };
    })(e);
    if (!a || 'object' != typeof a) return;
    const i = (b().data.queueTickets || []).map((e, t) => Bt(e, t)),
        o = a.__fullTickets || [];
    if (
        !(function (e, t, a) {
            return (
                t.length > 0 ||
                !!(
                    Ot(e, 'queue_tickets') ||
                    Ot(e, 'queueTickets') ||
                    Ot(e, 'tickets')
                ) ||
                !(!a || 'object' != typeof a) ||
                !!(function (e) {
                    return (
                        Ot(e, 'waitingCount') ||
                        Ot(e, 'waiting_count') ||
                        Ot(e, 'calledCount') ||
                        Ot(e, 'called_count') ||
                        Ot(e, 'completedCount') ||
                        Ot(e, 'completed_count') ||
                        Ot(e, 'noShowCount') ||
                        Ot(e, 'no_show_count') ||
                        Ot(e, 'cancelledCount') ||
                        Ot(e, 'cancelled_count')
                    );
                })(e) ||
                !!(function (e) {
                    const t = Ht(e);
                    return Boolean(
                        t &&
                        (Ot(t, 'waiting') ||
                            Ot(t, 'called') ||
                            Ot(t, 'completed') ||
                            Ot(t, 'no_show') ||
                            Ot(t, 'noShow') ||
                            Ot(t, 'cancelled') ||
                            Ot(t, 'canceled'))
                    );
                })(e) ||
                !(!Ot(e, 'nextTickets') && !Ot(e, 'next_tickets')) ||
                (function (e) {
                    const t = (function (e) {
                        return e?.callingNowByConsultorio &&
                            'object' == typeof e.callingNowByConsultorio
                            ? e.callingNowByConsultorio
                            : e?.calling_now_by_consultorio &&
                                'object' == typeof e.calling_now_by_consultorio
                              ? e.calling_now_by_consultorio
                              : null;
                    })(e);
                    return (
                        !(
                            !t ||
                            !(
                                Boolean(t[1]) ||
                                Boolean(t[2]) ||
                                Boolean(t[1]) ||
                                Boolean(t[2])
                            )
                        ) ||
                        $t(e?.callingNow)
                            .concat($t(e?.calling_now))
                            .some(Boolean)
                    );
                })(e)
            );
        })(a, o, n)
    )
        return;
    const s = 'fallback' === Ct(t.syncMode) ? 'fallback' : 'live',
        r = xt(a, i),
        l = (function (e) {
            const t = Ht(e),
                a =
                    Ot(e, 'waitingCount') ||
                    Ot(e, 'waiting_count') ||
                    Boolean(t && Ot(t, 'waiting')),
                n =
                    Ot(e, 'calledCount') ||
                    Ot(e, 'called_count') ||
                    Boolean(t && Ot(t, 'called')),
                i = Ot(e, 'nextTickets') || Ot(e, 'next_tickets'),
                o =
                    Ot(e, 'callingNowByConsultorio') ||
                    Ot(e, 'calling_now_by_consultorio') ||
                    Ot(e, 'callingNow') ||
                    Ot(e, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        c = Rt(r),
        u = Boolean(n && 'object' == typeof n);
    if (!(o.length || c.length || u || l.waiting || l.called)) return;
    const d =
        Number(r.waitingCount || 0) >
        c.filter((e) => 'waiting' === e.status).length;
    if (o.length) return void Ya(o, r, { fallbackPartial: !1, syncMode: s });
    const p = new Map(i.map((e) => [Ft(e), e]));
    ((function (e, t, a) {
        const n = t.callingNowByConsultorio || {},
            i = Number(t.calledCount || t.counts?.called || 0),
            o = Number(t.waitingCount || t.counts?.waiting || 0),
            s = $t(t.nextTickets),
            r = (function (e) {
                const t = new Set(),
                    a = e[1] || e[1] || null,
                    n = e[2] || e[2] || null;
                return (a && t.add(Ft(a)), n && t.add(Ft(n)), t);
            })(n),
            l = new Set(s.map((e) => Ft(e))),
            c = r.size > 0 || 0 === i,
            u = l.size > 0 || 0 === o,
            d = l.size > 0 && o > l.size;
        for (const [t, n] of e.entries()) {
            const i = Bt(n, 0);
            a.called && c && 'called' === i.status && !r.has(t)
                ? e.set(
                      t,
                      Bt(
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
                  u &&
                  'waiting' === i.status &&
                  (o <= 0 ? e.delete(t) : d || l.has(t) || e.delete(t));
        }
    })(p, r, l),
        Ya(
            (function (e, t, a) {
                for (const a of t) {
                    const t = Ft(a),
                        n = e.get(t) || null;
                    e.set(t, Bt(tn(n, a), e.size));
                }
                if (a && 'object' == typeof a) {
                    const t = Ft(Bt(a, e.size)),
                        n = e.get(t) || null;
                    e.set(
                        t,
                        Bt(
                            (function (e, t) {
                                return { ...(e || {}), ...Bt(t, 0) };
                            })(n, a),
                            e.size
                        )
                    );
                }
                return Array.from(e.values());
            })(p, c, n),
            r,
            { fallbackPartial: d, syncMode: s }
        ));
}
function nn() {
    return Ha(Qa, null);
}
function on(e, t = '') {
    return (
        !!e?.queueTickets?.length &&
        (Ya(e.queueTickets, e.queueMeta || null, {
            fallbackPartial: !0,
            syncMode: 'fallback',
        }),
        t && Da(t),
        !0)
    );
}
async function sn() {
    try {
        (an(await S('queue-state'), { syncMode: 'live' }),
            Da('Queue refresh realizado'));
    } catch (e) {
        (Da('Queue refresh con error'), on(nn()));
    }
}
async function rn() {
    const e = Array.isArray(b().data.queueTickets)
            ? b().data.queueTickets.map((e, t) => Bt(e, t))
            : [],
        t = (function (e) {
            return b().data.queueMeta && 'object' == typeof b().data.queueMeta
                ? xt(b().data.queueMeta, e)
                : null;
        })(e);
    e.length
        ? Ya(e, t || null, { fallbackPartial: !1, syncMode: 'live' })
        : (function (e) {
              const t = e ? Rt(e) : [];
              return (
                  !!t.length &&
                  (Ya(t, e, { fallbackPartial: !0, syncMode: 'fallback' }),
                  Da('Queue fallback parcial desde metadata'),
                  !0)
              );
          })(t) ||
          (await sn(),
          (b().data.queueTickets || []).length ||
              on(nn(), 'Queue fallback desde snapshot local') ||
              Ya([], null, { fallbackPartial: !1, syncMode: 'live' }));
}
const ln = 'appointments',
    cn = 'callbacks',
    un = 'reviews',
    dn = 'availability',
    pn = 'availability-meta',
    mn = 'queue-tickets',
    bn = 'queue-meta',
    gn = 'leadops-meta',
    fn = 'queue-surface-status',
    hn = 'app-downloads',
    yn = 'health-status',
    vn = {
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
    };
function kn() {
    return {
        appointments: Ha(ln, []),
        callbacks: Ha(cn, []),
        reviews: Ha(un, []),
        availability: Ha(dn, {}),
        availabilityMeta: Ha(pn, {}),
        queueTickets: Ha(mn, []),
        queueMeta: Ha(bn, null),
        leadOpsMeta: Ha(gn, null),
        queueSurfaceStatus: Ha(fn, null),
        appDownloads: Ha(hn, null),
        health: Ha(yn, null),
        funnelMetrics: vn,
    };
}
function wn(e) {
    return Array.isArray(e.queue_tickets)
        ? e.queue_tickets
        : Array.isArray(e.queueTickets)
          ? e.queueTickets
          : [];
}
function qn(e) {
    g((t) => {
        const a = (function (e, t) {
            return {
                appointments: e.appointments || [],
                callbacks:
                    ((a = e.callbacks || []),
                    (Array.isArray(a) ? a : []).map((e) => ({
                        ...e,
                        status: String(e.status || '')
                            .toLowerCase()
                            .includes('contact')
                            ? 'contacted'
                            : 'pending',
                        leadOps:
                            e.leadOps && 'object' == typeof e.leadOps
                                ? e.leadOps
                                : {},
                    }))),
                reviews: e.reviews || [],
                availability: e.availability || {},
                availabilityMeta: e.availabilityMeta || {},
                queueTickets: e.queueTickets || [],
                queueMeta: e.queueMeta || null,
                leadOpsMeta: e.leadOpsMeta || null,
                queueSurfaceStatus: e.queueSurfaceStatus || null,
                appDownloads: e.appDownloads || null,
                funnelMetrics: e.funnelMetrics || t,
                health: e.health || null,
            };
            var a;
        })(e, t.data.funnelMetrics);
        return {
            ...t,
            data: { ...t.data, ...a },
            ui: { ...t.ui, lastRefreshAt: Date.now() },
        };
    });
}
function Sn() {
    const e = b(),
        t = Number(e.ui.lastRefreshAt || 0);
    if (!t) return 'Datos: sin sincronizar';
    const a = Math.max(0, Math.round((Date.now() - t) / 1e3));
    return a < 60 ? `Datos: hace ${a}s` : `Datos: hace ${Math.round(a / 60)}m`;
}
async function Cn(e) {
    if (e.funnelMetrics) return e.funnelMetrics;
    const t = await S('funnel-metrics').catch(() => null);
    return t?.data || null;
}
async function _n() {
    try {
        const [e, t] = await Promise.all([
                S('data'),
                S('health').catch(() => null),
            ]),
            a = e.data || {},
            n = kn(),
            i = (function (e, t, a) {
                return {
                    appointments: Array.isArray(e.appointments)
                        ? e.appointments
                        : [],
                    callbacks: Array.isArray(e.callbacks) ? e.callbacks : [],
                    reviews: Array.isArray(e.reviews) ? e.reviews : [],
                    availability:
                        e.availability && 'object' == typeof e.availability
                            ? e.availability
                            : {},
                    availabilityMeta:
                        e.availabilityMeta &&
                        'object' == typeof e.availabilityMeta
                            ? e.availabilityMeta
                            : {},
                    queueTickets: wn(e),
                    queueMeta:
                        e.queueMeta && 'object' == typeof e.queueMeta
                            ? e.queueMeta
                            : e.queue_state && 'object' == typeof e.queue_state
                              ? e.queue_state
                              : null,
                    leadOpsMeta:
                        e.leadOpsMeta && 'object' == typeof e.leadOpsMeta
                            ? e.leadOpsMeta
                            : a?.leadOpsMeta || null,
                    queueSurfaceStatus:
                        e.queueSurfaceStatus &&
                        'object' == typeof e.queueSurfaceStatus
                            ? e.queueSurfaceStatus
                            : e.queue_surface_status &&
                                'object' == typeof e.queue_surface_status
                              ? e.queue_surface_status
                              : a?.queueSurfaceStatus || null,
                    appDownloads:
                        e.appDownloads && 'object' == typeof e.appDownloads
                            ? e.appDownloads
                            : a?.appDownloads || null,
                    funnelMetrics: e.funnelMetrics || a?.funnelMetrics || null,
                    health: t && t.ok ? t : null,
                };
            })({ ...a, funnelMetrics: await Cn(a) }, t, n);
        return (
            qn(i),
            (function (e) {
                (Fa(ln, e.appointments || []),
                    Fa(cn, e.callbacks || []),
                    Fa(un, e.reviews || []),
                    Fa(dn, e.availability || {}),
                    Fa(pn, e.availabilityMeta || {}),
                    Fa(mn, e.queueTickets || []),
                    Fa(bn, e.queueMeta || null),
                    Fa(gn, e.leadOpsMeta || null),
                    Fa(fn, e.queueSurfaceStatus || null),
                    Fa(hn, e.appDownloads || null),
                    Fa(yn, e.health || null));
            })(i),
            !0
        );
    } catch (e) {
        return (qn(kn()), !1);
    }
}
let An = !1,
    $n = !1;
function Tn() {
    if ('undefined' != typeof window) {
        const e = Number(window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__);
        if (Number.isFinite(e) && e > 0) return Math.max(50, Math.round(e));
    }
    return 45e3;
}
function Mn(e) {
    g((t) => ({
        ...t,
        ui: {
            ...t.ui,
            queueAutoRefresh: {
                state: 'idle',
                reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
                intervalMs: Tn(),
                lastAttemptAt: 0,
                lastSuccessAt: 0,
                lastError: '',
                inFlight: !1,
                ...(t.ui?.queueAutoRefresh || {}),
                ...e,
            },
        },
    }));
}
function Ln() {
    const e = b();
    return e.auth?.authenticated
        ? 'queue' !== e.ui?.activeSection
            ? {
                  active: !1,
                  state: 'paused',
                  reason: 'Abre Turnero Sala para reanudar el monitoreo.',
              }
            : 'undefined' != typeof document &&
                'hidden' === document.visibilityState
              ? {
                    active: !1,
                    state: 'paused',
                    reason: 'Pestaña oculta. El monitoreo se reanuda al volver al admin.',
                }
              : {
                    active: !0,
                    state: 'active',
                    reason: 'Auto-refresh activo en esta sección.',
                }
        : {
              active: !1,
              state: 'idle',
              reason: 'Inicia sesión para monitorear los equipos.',
          };
}
async function En(e = 'timer') {
    const t = Ln(),
        a = Tn();
    if (!t.active)
        return (
            Mn({
                state: t.state,
                reason: t.reason,
                intervalMs: a,
                inFlight: !1,
            }),
            !1
        );
    if ($n) return !1;
    (($n = !0),
        Mn({
            state: 'refreshing',
            reason:
                'visibility' === e || 'focus' === e || 'online' === e
                    ? 'Actualizando al volver a primer plano.'
                    : 'Actualizando Equipos en vivo.',
            intervalMs: a,
            lastAttemptAt: Date.now(),
            inFlight: !0,
            lastError: '',
        }));
    try {
        const e = await _n();
        return (
            await rn(),
            Mn({
                state: e ? 'active' : 'warning',
                reason: e
                    ? 'Auto-refresh activo en esta sección.'
                    : 'Sincronización degradada: usando cache local.',
                intervalMs: a,
                lastSuccessAt: Date.now(),
                inFlight: !1,
                lastError: e ? '' : 'cache_local',
            }),
            Ba(),
            (function () {
                const e = Sn();
                (r('#adminRefreshStatus', e),
                    r(
                        '#adminSyncState',
                        'Datos: sin sincronizar' === e
                            ? 'Listo para primera sincronizacion'
                            : e.replace('Datos: ', 'Estado: ')
                    ));
            })(),
            e
        );
    } catch (e) {
        return (
            Mn({
                state: 'warning',
                reason: 'No se pudo refrescar Equipos en vivo. Revisa red local o fuerza una actualización manual.',
                intervalMs: a,
                inFlight: !1,
                lastError: e?.message || 'refresh_failed',
            }),
            'queue' === b().ui?.activeSection && Ba(),
            !1
        );
    } finally {
        $n = !1;
    }
}
function Nn(e = {}) {
    const { immediate: t = !1, reason: a = 'sync' } = e,
        n = Ln(),
        i = Tn();
    return (
        Mn({ state: n.state, reason: n.reason, intervalMs: i, inFlight: $n }),
        'queue' === b().ui?.activeSection && Ba(),
        t && n.active ? (En(a), !0) : n.active
    );
}
function Bn() {
    'visible' !== document.visibilityState ? Nn() : En('visibility');
}
function Dn() {
    ('undefined' != typeof document && 'hidden' === document.visibilityState) ||
        ('queue' === b().ui?.activeSection && En('focus'));
}
function Pn() {
    'queue' === b().ui?.activeSection && En('online');
}
function In(e, t, a = void 0) {
    Za(e, (e) => ({
        ...e,
        status: t,
        assignedConsultorio: void 0 === a ? e.assignedConsultorio : a,
        calledAt:
            'called' === t
                ? new Date().toISOString()
                : 'waiting' === t
                  ? ''
                  : e.calledAt,
        completedAt:
            'completed' === t || 'no_show' === t || 'cancelled' === t
                ? new Date().toISOString()
                : '',
    }));
}
async function xn({ ticketId: e, action: t, consultorio: a }) {
    const n = Number(e || 0),
        i = At(t);
    if (n && i)
        return b().queue.practiceMode
            ? ((function (e, t, a) {
                  'reasignar' !== t && 're-llamar' !== t
                      ? 'liberar' !== t
                          ? 'completar' !== t
                              ? 'no_show' !== t
                                  ? 'cancelar' === t && In(e, 'cancelled')
                                  : In(e, 'no_show')
                              : In(e, 'completed')
                          : In(e, 'waiting', null)
                      : In(e, 'called', 2 === Number(a || 1) ? 2 : 1);
              })(n, i, a),
              void Da(`Practica: accion ${i} en ticket ${n}`))
            : (an(
                  await S('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void Da(`Accion ${i} ticket ${n}`));
}
async function On(e) {
    const t = 2 === Number(e || 0) ? 2 : 1,
        a = b();
    if (!Wa.get(t)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== t
        )
            return (
                Da(`Llamado bloqueado para C${t} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const e = (function (e) {
                return (
                    zt().queueTickets.find(
                        (t) =>
                            'waiting' === t.status &&
                            (!t.assignedConsultorio ||
                                t.assignedConsultorio === e)
                    ) || null
                );
            })(t);
            return e
                ? ((function (e, t) {
                      Za(e, (e) => ({
                          ...e,
                          status: 'called',
                          assignedConsultorio: t,
                          calledAt: new Date().toISOString(),
                      }));
                  })(e.id, t),
                  void Da(`Practica: llamado ${e.ticketCode} en C${t}`))
                : void Da('Practica: sin tickets en espera');
        }
        Wa.set(t, !0);
        try {
            (an(
                await S('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: t },
                }),
                { syncMode: 'live' }
            ),
                Da(`Llamado C${t} ejecutado`));
        } catch (e) {
            (Da(`Error llamando siguiente en C${t}`),
                s(`Error llamando siguiente en C${t}`, 'error'));
        } finally {
            Wa.set(t, !1);
        }
    }
}
async function Hn(e, t, a = 0) {
    const n = {
            ticketId: Number(e || 0),
            action: At(t),
            consultorio: Number(a || 0),
        },
        i = b(),
        o = (function (e) {
            const t = Number(e || 0);
            return (
                (t && zt().queueTickets.find((e) => Number(e.id || 0) === t)) ||
                null
            );
        })(n.ticketId);
    if (
        !i.queue.practiceMode &&
        Ga.has(n.action) &&
        (function (e, t) {
            const a = At(e);
            return (
                'cancelar' === a ||
                ('no_show' === a &&
                    (!t ||
                        'called' === _t(t.status) ||
                        Number(t.assignedConsultorio || 0) > 0))
            );
        })(n.action, o)
    )
        return (vt(n), void Da(`Accion ${n.action} pendiente de confirmacion`));
    await xn(n);
}
async function Fn() {
    const e = b().queue.pendingSensitiveAction;
    e ? (kt(), await xn(e)) : kt();
}
function jn() {
    (kt(), Da('Accion sensible cancelada'));
}
function Rn() {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        t = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(t) &&
            !(e instanceof HTMLDialogElement
                ? e.open
                : e instanceof HTMLElement &&
                  (!e.hidden || e.hasAttribute('open')))) ||
        (jn(), 0)
    );
}
async function zn(e) {
    const t = Number(e || 0);
    t &&
        (b().queue.practiceMode
            ? Da(`Practica: reprint ticket ${t}`)
            : (await S('queue-reprint', { method: 'POST', body: { id: t } }),
              Da(`Reimpresion ticket ${t}`)));
}
function Vn() {
    Xa({ helpOpen: !b().queue.helpOpen });
}
function Un(e) {
    const t = Boolean(e);
    (Xa({ practiceMode: t, pendingSensitiveAction: null }),
        Da(t ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function Kn(e) {
    const t = Gt();
    return (
        !!t &&
        (vt({
            ticketId: t.id,
            action: 'completar',
            consultorio: e.queue.stationConsultorio,
        }),
        !0)
    );
}
async function Qn(e) {
    const t = b();
    if (t.queue.captureCallKeyMode)
        return void (function (e) {
            const t = {
                key: String(e.key || ''),
                code: String(e.code || ''),
                location: Number(e.location || 0),
            };
            (Xa({ customCallKey: t, captureCallKeyMode: !1 }),
                s('Tecla externa guardada', 'success'),
                Da(`Tecla externa calibrada: ${t.code}`));
        })(e);
    if (
        (function (e, t) {
            return (
                !(!t || 'object' != typeof t) &&
                Ct(t.code) === Ct(e.code) &&
                String(t.key || '') === String(e.key || '') &&
                Number(t.location || 0) === Number(e.location || 0)
            );
        })(e, t.queue.customCallKey)
    )
        return void (await On(t.queue.stationConsultorio));
    const a = Ct(e.code),
        n = Ct(e.key),
        i = (function (e, t, a) {
            return (
                'numpadenter' === t ||
                'kpenter' === t ||
                ('enter' === a && 3 === Number(e.location || 0))
            );
        })(e, a, n);
    if (i && t.queue.pendingSensitiveAction) return void (await Fn());
    const o = (function (e, t) {
        return 'numpad2' === e || '2' === t
            ? 2
            : 'numpad1' === e || '1' === t
              ? 1
              : 0;
    })(a, n);
    if (!o)
        return i
            ? (t.queue.oneTap && Kn(t) && (await Fn()),
              void (await On(t.queue.stationConsultorio)))
            : void ((function (e, t) {
                  return (
                      'numpaddecimal' === e ||
                      'kpdecimal' === e ||
                      'decimal' === t ||
                      ',' === t ||
                      '.' === t
                  );
              })(a, n)
                  ? Kn(t)
                  : (function (e, t) {
                          return (
                              'numpadsubtract' === e ||
                              'kpsubtract' === e ||
                              '-' === t
                          );
                      })(a, n)
                    ? (function (e) {
                          const t = Gt();
                          t &&
                              vt({
                                  ticketId: t.id,
                                  action: 'no_show',
                                  consultorio: e.queue.stationConsultorio,
                              });
                      })(t)
                    : (function (e, t) {
                          return (
                              'numpadadd' === e || 'kpadd' === e || '+' === t
                          );
                      })(a, n) &&
                      (await (async function (e) {
                          const t = Gt();
                          t &&
                              (await Hn(
                                  t.id,
                                  're-llamar',
                                  e.queue.stationConsultorio
                              ),
                              Da(`Re-llamar ${t.ticketCode}`),
                              s(`Re-llamar ${t.ticketCode}`, 'info'));
                      })(t)));
    !(function (e, t) {
        (function (e, t) {
            return (
                'locked' === t.queue.stationMode &&
                t.queue.stationConsultorio !== e
            );
        })(e, t)
            ? (s('Cambio bloqueado por modo estación', 'warning'),
              Da('Cambio de estación bloqueado por lock'))
            : (Xa({ stationConsultorio: e }), Da(`Numpad: estacion C${e}`));
    })(o, t);
}
function Wn(e, t) {
    return 'c2' === e || '2' === e ? 2 : 'c1' === e || '1' === e ? 1 : t;
}
function Gn(e, t) {
    return '1' === e || 'true' === e ? 'locked' : t;
}
function Jn(e, t) {
    return '1' === e || 'true' === e || ('0' !== e && 'false' !== e && t);
}
function Yn(t, a, n) {
    return Array.isArray(t) && 0 !== t.length
        ? t
              .slice(0, 5)
              .map((t) => {
                  const i = String(t[a] || t.label || '-'),
                      o = String(t[n] ?? t.count ?? 0);
                  return `<li><span>${e(i)}</span><strong>${e(o)}</strong></li>`;
              })
              .join('')
        : '<li><span>Sin datos</span><strong>0</strong></li>';
}
function Zn(t, a, n, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${e(i)}">\n            <div>\n                <span>${e(t)}</span>\n                <small>${e(n)}</small>\n            </div>\n            <strong>${e(String(a))}</strong>\n        </li>\n    `;
}
function Xn(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function ei(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function ti(e) {
    return ei(`${e?.date || ''}T${e?.time || '00:00'}:00`);
}
function ai(e) {
    if (!e) return 'Sin fecha';
    const t = Math.round((e - Date.now()) / 6e4),
        a = Math.abs(t);
    return t < 0
        ? a < 60
            ? `Hace ${a} min`
            : a < 1440
              ? `Hace ${Math.round(a / 60)} h`
              : 'Ya ocurrio'
        : t < 60
          ? `En ${Math.max(t, 0)} min`
          : t < 1440
            ? `En ${Math.round(t / 60)} h`
            : `En ${Math.round(t / 1440)} d`;
}
function ni(t, a, n) {
    return `\n        <button type="button" class="operations-action-item" data-action="${e(t)}">\n            <span>${e(a)}</span>\n            <small>${e(n)}</small>\n        </button>\n    `;
}
function ii(e) {
    const {
            appointments: t,
            availability: a,
            callbacks: n,
            funnel: i,
            reviews: o,
        } = (function (e) {
            return {
                appointments: Array.isArray(e?.data?.appointments)
                    ? e.data.appointments
                    : [],
                callbacks: Array.isArray(e?.data?.callbacks)
                    ? e.data.callbacks
                    : [],
                reviews: Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
                availability:
                    e?.data?.availability &&
                    'object' == typeof e.data.availability
                        ? e.data.availability
                        : {},
                funnel: e?.data?.funnelMetrics || {},
            };
        })(e),
        s = (function (e) {
            return e.filter((e) =>
                (function (e) {
                    if (!e) return !1;
                    const t = new Date(e),
                        a = new Date();
                    return (
                        t.getFullYear() === a.getFullYear() &&
                        t.getMonth() === a.getMonth() &&
                        t.getDate() === a.getDate()
                    );
                })(ti(e))
            ).length;
        })(t),
        r = (function (e) {
            return e.filter((e) => {
                const t = Xn(e.paymentStatus || e.payment_status);
                return (
                    'pending_transfer_review' === t || 'pending_transfer' === t
                );
            }).length;
        })(t),
        l = (function (e) {
            return e.filter((e) => 'pending' === Xn(e.status)).length;
        })(n),
        c = (function (e) {
            return e.filter((e) => {
                if ('pending' !== Xn(e.status)) return !1;
                const t = (function (e) {
                    return ei(e?.fecha || e?.createdAt || '');
                })(e);
                return !!t && Math.round((Date.now() - t) / 6e4) >= 120;
            }).length;
        })(n),
        u = (function (e) {
            return e.filter((e) => 'no_show' === Xn(e.status)).length;
        })(t),
        d = (function (e) {
            return e.length
                ? (
                      e.reduce((e, t) => e + Number(t.rating || 0), 0) /
                      e.length
                  ).toFixed(1)
                : '0.0';
        })(o),
        p = (function (e, t = 30) {
            const a = Date.now();
            return e.filter((e) => {
                const n = ei(e.date || e.createdAt || '');
                return n && a - n <= 24 * t * 60 * 60 * 1e3;
            }).length;
        })(o),
        m = (function (e) {
            return Object.values(e || {}).filter(
                (e) => Array.isArray(e) && e.length > 0
            ).length;
        })(a),
        b = (function (e) {
            return e
                .map((e) => ({ item: e, stamp: ti(e) }))
                .filter((e) => e.stamp > 0 && e.stamp >= Date.now())
                .sort((e, t) => e.stamp - t.stamp)[0];
        })(t);
    return {
        appointments: t,
        availabilityDays: m,
        avgRating: d,
        callbacks: n,
        funnel: i,
        nextAppointment: b,
        noShows: u,
        pendingCallbacks: l,
        pendingTransfers: r,
        recentReviews: p,
        reviews: o,
        todayAppointments: s,
        urgentCallbacks: c,
    };
}
function oi(e) {
    const t = ii(e);
    ((function (e) {
        const {
            appointments: t,
            avgRating: a,
            nextAppointment: n,
            noShows: i,
            pendingCallbacks: o,
            pendingTransfers: s,
            recentReviews: l,
            reviews: c,
            todayAppointments: u,
            urgentCallbacks: d,
        } = e;
        (r('#todayAppointments', u),
            r('#totalAppointments', t.length),
            r('#pendingCallbacks', o),
            r('#totalReviewsCount', c.length),
            r('#totalNoShows', i),
            r('#avgRating', a),
            r('#adminAvgRating', a),
            r('#dashboardHeroRating', a),
            r('#dashboardHeroRecentReviews', l),
            r('#dashboardHeroUrgentCallbacks', d),
            r('#dashboardHeroPendingTransfers', s),
            r(
                '#dashboardHeroSummary',
                (function ({
                    pendingTransfers: e,
                    urgentCallbacks: t,
                    noShows: a,
                    nextAppointment: n,
                }) {
                    return e > 0
                        ? `Primero valida ${e} transferencia(s) antes de liberar mas agenda.`
                        : t > 0
                          ? `Hay ${t} callback(s) fuera de SLA; el siguiente paso es drenar esa cola.`
                          : a > 0
                            ? `Revisa ${a} no show del corte actual para cerrar seguimiento.`
                            : n?.item
                              ? `La siguiente cita es ${n.item.name || 'sin nombre'} ${ai(n.stamp).toLowerCase()}.`
                              : 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
                })({
                    pendingTransfers: s,
                    urgentCallbacks: d,
                    noShows: i,
                    nextAppointment: n,
                })
            ));
    })(t),
        (function (e) {
            const {
                    nextAppointment: t,
                    pendingTransfers: a,
                    todayAppointments: i,
                    urgentCallbacks: o,
                } = e,
                s = a > 0 || o > 0 ? 'warning' : i > 0 ? 'neutral' : 'success';
            (r(
                '#dashboardLiveStatus',
                a > 0 || o > 0 ? 'Atencion' : i > 0 ? 'Activo' : 'Estable'
            ),
                document
                    .getElementById('dashboardLiveStatus')
                    ?.setAttribute('data-state', s),
                r(
                    '#dashboardLiveMeta',
                    (function ({
                        pendingTransfers: e,
                        urgentCallbacks: t,
                        nextAppointment: a,
                    }) {
                        return e > 0
                            ? 'Transferencias detenidas hasta validar comprobante.'
                            : t > 0
                              ? 'Callbacks fuera de SLA requieren llamada inmediata.'
                              : a?.item
                                ? `Siguiente ingreso: ${a.item.name || 'Paciente'} el ${n(a.item.date)} a las ${a.item.time || '--:--'}.`
                                : 'Sin alertas criticas en la operacion actual.';
                    })({
                        pendingTransfers: a,
                        urgentCallbacks: o,
                        nextAppointment: t,
                    })
                ));
        })(t),
        (function (e) {
            const {
                availabilityDays: t,
                nextAppointment: a,
                pendingCallbacks: n,
                pendingTransfers: i,
                todayAppointments: o,
                urgentCallbacks: s,
            } = e;
            (r(
                '#dashboardQueueHealth',
                s > 0
                    ? 'Cola: SLA comprometido'
                    : n > 0
                      ? 'Cola: pendiente por drenar'
                      : 'Cola: estable'
            ),
                r(
                    '#dashboardFlowStatus',
                    a?.item
                        ? `${ai(a.stamp)} | ${a.item.name || 'Paciente'}`
                        : t > 0
                          ? `${t} dia(s) con slots publicados`
                          : 'Sin citas inmediatas'
                ),
                r('#operationPendingReviewCount', i),
                r('#operationPendingCallbacksCount', n),
                r('#operationTodayLoadCount', o),
                r(
                    '#operationDeckMeta',
                    i > 0 || s > 0
                        ? 'La prioridad ya esta definida'
                        : a?.item
                          ? 'Siguiente accion lista'
                          : 'Operacion sin frentes urgentes'
                ),
                r(
                    '#operationQueueHealth',
                    a?.item
                        ? `Siguiente hito: ${a.item.name || 'Paciente'} ${ai(a.stamp).toLowerCase()}`
                        : 'Sin citas inmediatas en cola'
                ));
        })(t),
        l(
            '#operationActionList',
            (function (e) {
                const {
                        pendingTransfers: t,
                        urgentCallbacks: a,
                        pendingCallbacks: n,
                    } = e,
                    { appointments: i, nextAppointment: o } = e;
                return [
                    ni(
                        'context-open-appointments-transfer',
                        t > 0
                            ? 'Validar transferencias'
                            : 'Abrir agenda clinica',
                        t > 0
                            ? `${t} comprobante(s) por revisar`
                            : `${i.length} cita(s) en el corte`
                    ),
                    ni(
                        'context-open-callbacks-pending',
                        a > 0
                            ? 'Resolver callbacks urgentes'
                            : 'Abrir callbacks',
                        a > 0
                            ? `${a} caso(s) fuera de SLA`
                            : `${n} callback(s) pendientes`
                    ),
                    ni(
                        'refresh-admin-data',
                        'Actualizar tablero',
                        o?.item
                            ? `Proxima cita ${ai(o.stamp).toLowerCase()}`
                            : 'Sincronizar agenda y funnel'
                    ),
                ].join('');
            })(t)
        ),
        l(
            '#dashboardAttentionList',
            (function (e) {
                const {
                    availabilityDays: t,
                    pendingTransfers: a,
                    todayAppointments: n,
                    urgentCallbacks: i,
                } = e;
                return [
                    Zn(
                        'Transferencias',
                        a,
                        a > 0
                            ? 'Pago detenido antes de confirmar.'
                            : 'Sin comprobantes pendientes.',
                        a > 0 ? 'warning' : 'success'
                    ),
                    Zn(
                        'Callbacks urgentes',
                        i,
                        i > 0
                            ? 'Mas de 120 min en espera.'
                            : 'SLA dentro de rango.',
                        i > 0 ? 'danger' : 'success'
                    ),
                    Zn(
                        'Agenda de hoy',
                        n,
                        n > 0
                            ? `${n} ingreso(s) en la jornada.`
                            : 'No hay citas hoy.',
                        n > 6 ? 'warning' : 'neutral'
                    ),
                    Zn(
                        'Disponibilidad',
                        t,
                        t > 0
                            ? 'Dias con slots listos para publicar.'
                            : 'Sin slots cargados en el calendario.',
                        t > 0 ? 'success' : 'warning'
                    ),
                ].join('');
            })(t)
        ),
        (function (e) {
            const t = e.summary || {};
            (r('#funnelViewBooking', o(t.viewBooking || 0)),
                r('#funnelStartCheckout', o(t.startCheckout || 0)),
                r('#funnelBookingConfirmed', o(t.bookingConfirmed || 0)),
                r(
                    '#funnelAbandonRate',
                    `${Number(t.abandonRatePct || 0).toFixed(1)}%`
                ),
                l(
                    '#funnelEntryList',
                    Yn(e.checkoutEntryBreakdown, 'entry', 'count')
                ),
                l(
                    '#funnelSourceList',
                    Yn(e.sourceBreakdown, 'source', 'count')
                ),
                l(
                    '#funnelPaymentMethodList',
                    Yn(e.paymentMethodBreakdown, 'method', 'count')
                ),
                l(
                    '#funnelAbandonList',
                    Yn(e.checkoutAbandonByStep, 'step', 'count')
                ),
                l(
                    '#funnelAbandonReasonList',
                    Yn(e.abandonReasonBreakdown, 'reason', 'count')
                ),
                l(
                    '#funnelStepList',
                    Yn(e.bookingStepBreakdown, 'step', 'count')
                ),
                l(
                    '#funnelErrorCodeList',
                    Yn(e.errorCodeBreakdown, 'code', 'count')
                ));
        })(t.funnel));
}
function si(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function ri(e) {
    const t = new Date(e?.date || e?.createdAt || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function li(e) {
    return `${Math.max(0, Math.min(5, Math.round(Number(e || 0))))}/5`;
}
function ci(e) {
    const t = String(e || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return t.length ? t.map((e) => e.charAt(0).toUpperCase()).join('') : 'AN';
}
function ui(e, t = 220) {
    const a = String(e || '').trim();
    return a
        ? a.length <= t
            ? a
            : `${a.slice(0, t - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function di() {
    const t = b(),
        a = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
        n = (function (e) {
            return e.slice().sort((e, t) => ri(t) - ri(e));
        })(a),
        o = (function (e) {
            return e.length
                ? e.reduce((e, t) => e + Number(t.rating || 0), 0) / e.length
                : 0;
        })(a),
        s = (function (e, t = 30) {
            const a = Date.now();
            return e.filter((e) => {
                const n = ri(e);
                return !!n && a - n <= 24 * t * 60 * 60 * 1e3;
            }).length;
        })(a),
        c = (function (e) {
            return e.filter((e) => Number(e.rating || 0) <= 3).length;
        })(a),
        u = (function (e) {
            const t = e.find((e) => Number(e.rating || 0) <= 3);
            if (t)
                return {
                    item: t,
                    eyebrow: 'Feedback accionable',
                    summary:
                        'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
                };
            const a = e.find((e) => Number(e.rating || 0) >= 5);
            return a
                ? {
                      item: a,
                      eyebrow: 'Senal a repetir',
                      summary:
                          'Usa este comentario como referencia del recorrido que conviene proteger.',
                  }
                : e[0]
                  ? {
                        item: e[0],
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
        })(n),
        { latestAuthor: d, latestDate: p } = (function (e) {
            const t = e[0];
            return {
                latestDate: t ? i(t.date || t.createdAt || '') : '-',
                latestAuthor: t ? String(t.name || 'Anonimo') : 'Sin datos',
            };
        })(n);
    if (
        (r('#reviewsAverageRating', o.toFixed(1)),
        r(
            '#reviewsFiveStarCount',
            (function (e) {
                return e.filter((e) => Number(e.rating || 0) >= 5).length;
            })(a)
        ),
        r('#reviewsRecentCount', s),
        r('#reviewsTotalCount', a.length),
        r(
            '#reviewsSentimentLabel',
            (function (e, t, a) {
                return t
                    ? a > 0 && e < 4
                        ? 'Atencion requerida'
                        : e >= 4.7
                          ? 'Confianza alta'
                          : e >= 4.2
                            ? 'Tono solido'
                            : e >= 3.5
                              ? 'Lectura mixta'
                              : 'Atencion requerida'
                    : 'Sin senal suficiente';
            })(o, a.length, c)
        ),
        l(
            '#reviewsSummaryRail',
            (function ({
                latestAuthor: t,
                latestDate: a,
                recentCount: n,
                lowRatedCount: i,
            }) {
                return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${e(t)}</strong>\n            <small>${e(a)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${e(String(n))} en 30 dias</strong>\n            <small>Volumen reciente de feedback.</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Riesgo</span>\n            <strong>${e(i > 0 ? `${i} por revisar` : 'Sin alertas')}</strong>\n            <small>${e(i > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>\n        </article>\n    `;
            })({
                latestAuthor: d,
                latestDate: p,
                recentCount: s,
                lowRatedCount: c,
            })
        ),
        !a.length)
    )
        return (
            l(
                '#reviewsSpotlight',
                '\n        <div class="reviews-empty-state" data-admin-empty-state="reviews">\n            <strong>Sin feedback reciente</strong>\n            <p>No hay resenas registradas todavia.</p>\n        </div>\n    '
            ),
            void l(
                '#reviewsGrid',
                '\n        <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">\n            <strong>No hay resenas registradas.</strong>\n            <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>\n        </div>\n    '
            )
        );
    (u.item
        ? l(
              '#reviewsSpotlight',
              (function (t) {
                  const a = t.item;
                  return `\n        <article class="reviews-spotlight-card">\n            <div class="reviews-spotlight-top">\n                <span class="review-avatar">${e(ci(a.name || 'Anonimo'))}</span>\n                <div>\n                    <small>${e(t.eyebrow)}</small>\n                    <strong>${e(a.name || 'Anonimo')}</strong>\n                    <small>${e(i(a.date || a.createdAt || ''))}</small>\n                </div>\n            </div>\n            <p class="reviews-spotlight-stars">${e(li(a.rating))}</p>\n            <p>${e(ui(a.comment || a.review || '', 320))}</p>\n            <small>${e(t.summary)}</small>\n        </article>\n    `;
              })(u)
          )
        : l(
              '#reviewsSpotlight',
              `\n        <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">\n            <strong>Sin spotlight disponible</strong>\n            <p>${e(u.summary)}</p>\n        </div>\n    `
          ),
        l(
            '#reviewsGrid',
            (function (t, a) {
                return t
                    .map((t) =>
                        (function (t, { featured: a = !1 } = {}) {
                            const n = Number(t.rating || 0),
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
                            return `\n        <article class="review-card${a ? ' is-featured' : ''}" data-rating="${e(String(n))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${e(ci(t.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${e(t.name || 'Anonimo')}</strong>\n                        <small>${e(i(t.date || t.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${e(o)}">${e(li(n))}</span>\n            </header>\n            <p>${e(ui(t.comment || t.review || ''))}</p>\n            <small>${e(s)}</small>\n        </article>\n    `;
                        })(t, {
                            featured:
                                a.item &&
                                si(t.name) === si(a.item.name) &&
                                ri(t) === ri(a.item),
                        })
                    )
                    .join('');
            })(n, u)
        ));
}
function pi() {
    const e = Sn();
    (r('#adminRefreshStatus', e),
        r(
            '#adminSyncState',
            'Datos: sin sincronizar' === e
                ? 'Listo para primera sincronizacion'
                : e.replace('Datos: ', 'Estado: ')
        ));
}
async function mi(e = !1) {
    const t = await _n();
    return (
        (function () {
            const e = b(),
                t = Ye(e.data.availability || {}),
                a = et(e.availability.selectedDate, t);
            (ct({
                draft: t,
                selectedDate: a,
                monthAnchor: Xe(e.availability.monthAnchor, a),
                draftDirty: !1,
                lastAction: '',
            }),
                lt());
        })(),
        await rn(),
        R(b()),
        oi(b()),
        ue(),
        Oe(),
        di(),
        lt(),
        Ba(),
        pi(),
        e &&
            s(
                t ? 'Datos actualizados' : 'Datos cargados desde cache local',
                t ? 'success' : 'warning'
            ),
        t
    );
}
function bi() {
    (x(!1),
        F(),
        H(!1),
        O({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function gi(e) {
    e.preventDefault();
    const t = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = t instanceof HTMLInputElement ? t.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        H(!0);
        const e = b();
        if (
            (O({
                tone: e.auth.requires2FA ? 'warning' : 'neutral',
                title: e.auth.requires2FA
                    ? 'Validando segundo factor'
                    : 'Validando credenciales',
                message: e.auth.requires2FA
                    ? 'Comprobando el codigo 2FA antes de abrir el panel.'
                    : 'Comprobando clave y proteccion de sesion.',
            }),
            e.auth.requires2FA)
        )
            await (async function (e) {
                const t = String(e || '').trim();
                if (!t) throw new Error('Codigo 2FA requerido');
                const a = await C('login-2fa', {
                        method: 'POST',
                        body: { code: t },
                    }),
                    n = String(a.csrfToken || '');
                return (
                    q(n),
                    g((e) => ({
                        ...e,
                        auth: {
                            ...e.auth,
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
            const e = await (async function (e) {
                const t = String(e || '').trim();
                if (!t) throw new Error('Contrasena requerida');
                const a = await C('login', {
                    method: 'POST',
                    body: { password: t },
                });
                if (!0 === a.twoFactorRequired)
                    return (
                        g((e) => ({
                            ...e,
                            auth: {
                                ...e.auth,
                                requires2FA: !0,
                                authMethod: 'password',
                            },
                        })),
                        { authenticated: !1, requires2FA: !0 }
                    );
                const n = String(a.csrfToken || '');
                return (
                    q(n),
                    g((e) => ({
                        ...e,
                        auth: {
                            ...e.auth,
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
            if (e.requires2FA)
                return (
                    x(!0),
                    O({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void j('2fa')
                );
        }
        (O({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            B(),
            P(),
            x(!1),
            F({ clearPassword: !0 }),
            await mi(!1),
            Nn({
                immediate: 'queue' === b().ui.activeSection,
                reason: 'login',
            }),
            s('Sesion iniciada', 'success'));
    } catch (e) {
        (O({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                e?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            j(b().auth.requires2FA ? '2fa' : 'password'),
            s(e?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        H(!1);
    }
}
async function fi(e, t) {
    switch (e) {
        case 'appointment-quick-filter':
            return (pe(String(t.dataset.filterValue || 'all')), !0);
        case 'clear-appointment-filters':
            return (de({ filter: 'all', search: '' }), !0);
        case 'appointment-density':
            return (
                de({
                    density:
                        'compact' ===
                        G(String(t.dataset.density || 'comfortable'))
                            ? 'compact'
                            : W,
                }),
                !0
            );
        case 'approve-transfer':
            return (
                await (async function (e) {
                    (await ge(e, { paymentStatus: 'paid' }),
                        be(e, { paymentStatus: 'paid' }));
                })(Number(t.dataset.id || 0)),
                s('Transferencia aprobada', 'success'),
                !0
            );
        case 'reject-transfer':
            return (
                await (async function (e) {
                    (await ge(e, { paymentStatus: 'failed' }),
                        be(e, { paymentStatus: 'failed' }));
                })(Number(t.dataset.id || 0)),
                s('Transferencia rechazada', 'warning'),
                !0
            );
        case 'mark-no-show':
            return (
                await (async function (e) {
                    (await ge(e, { status: 'no_show' }),
                        be(e, { status: 'no_show' }));
                })(Number(t.dataset.id || 0)),
                s('Marcado como no show', 'warning'),
                !0
            );
        case 'cancel-appointment':
            return (
                await (async function (e) {
                    (await ge(e, { status: 'cancelled' }),
                        be(e, { status: 'cancelled' }));
                })(Number(t.dataset.id || 0)),
                s('Cita cancelada', 'warning'),
                !0
            );
        case 'export-csv':
            return (
                (function () {
                    const e = [
                            [
                                'id',
                                'name',
                                'service',
                                'date',
                                'time',
                                'status',
                                'payment_status',
                            ],
                            ...(b().data.appointments || []).map((e) => [
                                e.id,
                                e.name,
                                e.service,
                                e.date,
                                e.time,
                                e.status,
                                e.paymentStatus || e.payment_status || '',
                            ]),
                        ]
                            .map((e) =>
                                e
                                    .map(
                                        (e) =>
                                            `"${String(e ?? '').replace(/"/g, '""')}"`
                                    )
                                    .join(',')
                            )
                            .join('\n'),
                        t = new Blob([e], { type: 'text/csv;charset=utf-8' }),
                        a = URL.createObjectURL(t),
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
async function hi(e, a) {
    switch (e) {
        case 'change-month':
            return (
                (function (e) {
                    const t = Number(e || 0);
                    if (!Number.isFinite(t) || 0 === t) return;
                    const a = Xe(
                        b().availability.monthAnchor,
                        b().availability.selectedDate
                    );
                    (a.setMonth(a.getMonth() + t),
                        ct({ monthAnchor: a, lastAction: '' }, { render: !0 }));
                })(Number(a.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (mt(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const e = rt(-1);
                    e
                        ? mt(e, `Fecha previa con slots: ${e}`)
                        : dt('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const e = rt(1);
                    e
                        ? mt(e, `Siguiente fecha con slots: ${e}`)
                        : dt('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (e) {
                    const t = We(e);
                    t &&
                        ct(
                            {
                                selectedDate: t,
                                monthAnchor: Xe(t, t),
                                lastAction: '',
                            },
                            { render: !0 }
                        );
                })(String(a.dataset.date || '')),
                !0
            );
        case 'prefill-time-slot':
            return (
                (function (e) {
                    if (it()) return;
                    const a = t('#newSlotTime');
                    a instanceof HTMLInputElement &&
                        ((a.value = gt(e)), a.focus());
                })(String(a.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (it()) return;
                    const e = t('#newSlotTime');
                    if (!(e instanceof HTMLInputElement)) return;
                    const a = gt(e.value);
                    if (!a) return;
                    const n = b(),
                        i = bt();
                    i &&
                        (pt(
                            i,
                            [
                                ...(Array.isArray(n.availability.draft[i])
                                    ? n.availability.draft[i]
                                    : []),
                                a,
                            ],
                            `Slot ${a} agregado en ${i}`
                        ),
                        (e.value = ''));
                })(),
                !0
            );
        case 'remove-time-slot':
            return (
                (function (e, t) {
                    if (it()) return;
                    const a = We(e);
                    if (!a) return;
                    const n = b(),
                        i = Array.isArray(n.availability.draft[a])
                            ? n.availability.draft[a]
                            : [],
                        o = gt(t);
                    pt(
                        a,
                        i.filter((e) => gt(e) !== o),
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
                    if (it()) return;
                    const e = b(),
                        t = bt();
                    if (!t) return;
                    const a = Array.isArray(e.availability.draft[t])
                        ? Qe(e.availability.draft[t])
                        : [];
                    ct(
                        {
                            clipboard: a,
                            clipboardDate: t,
                            lastAction: a.length
                                ? `Portapapeles: ${a.length} slots (${t})`
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
                    if (it()) return;
                    const e = b(),
                        t = Array.isArray(e.availability.clipboard)
                            ? Qe(e.availability.clipboard)
                            : [];
                    if (!t.length) return void dt('Portapapeles vacio');
                    const a = bt();
                    a && pt(a, t, `Pegado ${t.length} slots en ${a}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (ft(1), !0);
        case 'duplicate-availability-next-week':
            return (ft(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (it()) return;
                    const e = bt();
                    e &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${e}. Continuar?`
                        ) &&
                        pt(e, [], `Dia ${e} limpiado`);
                })(),
                !0
            );
        case 'clear-availability-week':
            return (
                (function () {
                    if (it()) return;
                    const e = bt();
                    if (!e) return;
                    const t = (function (e) {
                        const t = Ge(e);
                        if (!t) return null;
                        const a = (t.getDay() + 6) % 7,
                            n = new Date(t);
                        n.setDate(t.getDate() - a);
                        const i = new Date(n);
                        return (
                            i.setDate(n.getDate() + 6),
                            { start: n, end: i }
                        );
                    })(e);
                    if (!t) return;
                    const a = u(t.start),
                        n = u(t.end);
                    if (
                        !window.confirm(
                            `Se eliminaran los slots de la semana ${a} a ${n}. Continuar?`
                        )
                    )
                        return;
                    const i = nt();
                    for (let e = 0; e < 7; e += 1) {
                        const a = new Date(t.start);
                        (a.setDate(t.start.getDate() + e), delete i[u(a)]);
                    }
                    ut(i, {
                        selectedDate: e,
                        lastAction: `Semana limpiada (${a} - ${n})`,
                    });
                })(),
                !0
            );
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (it()) return;
                    const e = nt(),
                        t = await S('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        a =
                            t?.data && 'object' == typeof t.data
                                ? Ye(t.data)
                                : e,
                        n =
                            t?.meta && 'object' == typeof t.meta
                                ? t.meta
                                : null;
                    (g((e) => ({
                        ...e,
                        data: {
                            ...e.data,
                            availability: a,
                            availabilityMeta: n
                                ? { ...e.data.availabilityMeta, ...n }
                                : e.data.availabilityMeta,
                        },
                        availability: {
                            ...e.availability,
                            draft: a,
                            draftDirty: !1,
                            lastAction: `Cambios guardados ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: !1 })}`,
                        },
                    })),
                        lt());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (it()) return;
                    const e = b();
                    if (
                        e.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const t = Ye(e.data.availability || {}),
                        a = et(e.availability.selectedDate, t);
                    ct(
                        {
                            draft: t,
                            selectedDate: a,
                            monthAnchor: Xe(e.availability.monthAnchor, a),
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
const yi = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function vi(e, t = 'dashboard') {
    const a = String(e || '')
        .trim()
        .toLowerCase();
    return yi.has(a) ? a : t;
}
function ki(e) {
    !(function (e) {
        const t = String(e || '').replace(/^#/, ''),
            a = t ? `#${t}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(vi(e));
}
const wi = 'themeMode',
    qi = new Set(['light', 'dark', 'system']);
function Si(e, { persist: t = !1 } = {}) {
    const a = (function (e) {
        const t = (function (e) {
            return 'light' === e || 'dark' === e
                ? e
                : window.matchMedia &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';
        })(e);
        return (
            document.documentElement.setAttribute('data-theme-mode', e),
            document.documentElement.setAttribute('data-theme', t),
            t
        );
    })(e);
    (g((t) => ({ ...t, ui: { ...t.ui, themeMode: e, theme: a } })),
        t &&
            (function (e) {
                const t = qi.has(e) ? e : 'system';
                Oa(wi, t);
            })(e),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((t) => {
            const a = t.dataset.themeMode === e;
            (t.classList.toggle('is-active', a),
                t.setAttribute('aria-pressed', String(a)));
        }));
}
const Ci = 'adminLastSection',
    _i = 'adminSidebarCollapsed';
function Ai() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function $i(e) {
    return (
        e instanceof HTMLElement &&
        !e.hidden &&
        'true' !== e.getAttribute('aria-hidden') &&
        (!('disabled' in e) || !e.disabled) &&
        e.getClientRects().length > 0
    );
}
function Ti() {
    const e = b(),
        a = Ai(),
        n = t('#adminSidebar'),
        i = n instanceof HTMLElement && n.classList.contains('is-open');
    (!(function ({ open: e, collapsed: a }) {
        const n = t('#adminSidebar'),
            i = t('#adminSidebarBackdrop'),
            o = t('#adminMenuToggle');
        (n && n.classList.toggle('is-open', Boolean(e)),
            i && i.classList.toggle('is-hidden', !e),
            o && o.setAttribute('aria-expanded', String(Boolean(e))),
            document.body.classList.toggle('admin-sidebar-open', Boolean(e)),
            document.body.classList.toggle(
                'admin-sidebar-collapsed',
                Boolean(a)
            ));
        const s = t('#adminSidebarCollapse');
        s && s.setAttribute('aria-pressed', String(Boolean(a)));
    })({
        open: !!a && e.ui.sidebarOpen,
        collapsed: !a && e.ui.sidebarCollapsed,
    }),
        a &&
            e.ui.sidebarOpen &&
            !i &&
            (function () {
                const e = t('#adminSidebar');
                e instanceof HTMLElement &&
                    window.requestAnimationFrame(() => {
                        const t =
                            e.querySelector('.nav-item.active[data-section]') ||
                            e.querySelector('.nav-item[data-section]');
                        t instanceof HTMLElement && t.focus();
                    });
            })());
}
function Mi() {
    const e = b();
    (Oa(Ci, e.ui.activeSection), Oa(_i, e.ui.sidebarCollapsed ? '1' : '0'));
}
async function Li(e, t = {}) {
    const a = vi(e, 'dashboard'),
        { force: n = !1 } = t,
        i = b().ui.activeSection;
    return (
        !(
            (function (e, t) {
                return (
                    !t &&
                    'availability' === b().ui.activeSection &&
                    'availability' !== e &&
                    ht()
                );
            })(a, n) &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (e) {
            const t = vi(e, 'dashboard');
            (g((e) => ({ ...e, ui: { ...e.ui, activeSection: t } })),
                I(t),
                R(b()),
                ki(t),
                Mi());
        })(a),
        Nn({
            immediate: 'queue' === a,
            reason: 'queue' === a ? 'section-enter' : 'section-exit',
        }),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const e = b();
                return (
                    'fallback' !== Ct(e.queue.syncMode) &&
                    !Boolean(e.queue.fallbackPartial)
                );
            })() &&
            (await sn()),
        !0)
    );
}
function Ei(e) {
    g((t) => ({ ...t, ui: { ...t.ui, ...e(t.ui) } }));
}
function Ni() {
    (Ei((e) => ({
        sidebarCollapsed: !e.sidebarCollapsed,
        sidebarOpen: e.sidebarOpen,
    })),
        Ti(),
        Mi());
}
function Bi() {
    (Ei((e) => ({ sidebarOpen: !e.sidebarOpen })), Ti());
}
function Di({ restoreFocus: e = !1 } = {}) {
    if ((Ei(() => ({ sidebarOpen: !1 })), Ti(), P(), e)) {
        const e = t('#adminMenuToggle');
        e instanceof HTMLElement && e.focus();
    }
}
function Pi() {
    D();
    const e = document.getElementById('adminQuickCommand');
    e instanceof HTMLInputElement && e.focus();
}
function Ii() {
    const e = b().ui.activeSection;
    if ('appointments' === e) {
        const e = document.getElementById('searchAppointments');
        return void (e instanceof HTMLInputElement && e.focus());
    }
    if ('callbacks' === e) {
        const e = document.getElementById('searchCallbacks');
        return void (e instanceof HTMLInputElement && e.focus());
    }
    if ('queue' === e) {
        const e = document.getElementById('queueSearchInput');
        e instanceof HTMLInputElement && e.focus();
    }
}
const xi = {
    appointments_pending_transfer: async () => {
        (await Li('appointments'), pe('pending_transfer'), me(''));
    },
    appointments_all: async () => {
        (await Li('appointments'), pe('all'), me(''));
    },
    appointments_no_show: async () => {
        (await Li('appointments'), pe('no_show'), me(''));
    },
    callbacks_pending: async () => {
        (await Li('callbacks'), Fe('pending'));
    },
    callbacks_contacted: async () => {
        (await Li('callbacks'), Fe('contacted'));
    },
    callbacks_sla_urgent: async () => {
        (await Li('callbacks'), Fe('sla_urgent'));
    },
    queue_sla_risk: async () => {
        (await Li('queue'), en('sla_risk'));
    },
    queue_waiting: async () => {
        (await Li('queue'), en('waiting'));
    },
    queue_called: async () => {
        (await Li('queue'), en('called'));
    },
    queue_no_show: async () => {
        (await Li('queue'), en('no_show'));
    },
    queue_all: async () => {
        (await Li('queue'), en('all'));
    },
    queue_call_next: async () => {
        (await Li('queue'), await On(b().queue.stationConsultorio));
    },
};
async function Oi(e) {
    const t = xi[e];
    'function' == typeof t && (await t());
}
function Hi(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return t
        ? t.includes('callbacks') && t.includes('pend')
            ? 'callbacks_pending'
            : t.includes('callback') && (t.includes('urg') || t.includes('sla'))
              ? 'callbacks_sla_urgent'
              : t.includes('citas') && t.includes('transfer')
                ? 'appointments_pending_transfer'
                : t.includes('queue') || t.includes('cola')
                  ? 'queue_sla_risk'
                  : t.includes('no show')
                    ? 'appointments_no_show'
                    : null
        : null;
}
async function Fi(e, t) {
    switch (e) {
        case 'callback-quick-filter':
            return (Fe(String(t.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                He({
                    filter: 'all',
                    sort: 'priority_desc',
                    search: '',
                    selected: [],
                }),
                !0
            );
        case 'callbacks-triage-next':
        case 'context-open-callbacks-next':
            return (
                await Li('callbacks'),
                Fe('pending'),
                (function () {
                    const e = document.querySelector(
                        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
                    );
                    e instanceof HTMLElement && e.focus();
                })(),
                !0
            );
        case 'mark-contacted':
            return (
                await ze(
                    Number(t.dataset.callbackId || 0),
                    String(t.dataset.callbackDate || '')
                ),
                s('Callback actualizado', 'success'),
                !0
            );
        case 'lead-ai-request':
            return (
                await (async function (e, t = 'whatsapp_draft') {
                    const a = Number(e || 0);
                    if (a <= 0) return null;
                    const n = await S('lead-ai-request', {
                        method: 'POST',
                        body: { callbackId: a, objective: t },
                    });
                    return n?.data ? (je(n.data), n.data) : null;
                })(
                    Number(t.dataset.callbackId || 0),
                    String(t.dataset.objective || 'whatsapp_draft')
                ),
                s('Solicitud IA encolada', 'success'),
                !0
            );
        case 'callback-outcome':
            return (
                await (async function (e, t) {
                    const a = await Re(e, {
                        status: 'contacted',
                        leadOps: { outcome: t },
                    });
                    return (a && je(a), a);
                })(
                    Number(t.dataset.callbackId || 0),
                    String(t.dataset.outcome || '')
                ),
                s('Outcome actualizado', 'success'),
                !0
            );
        case 'callback-copy-ai': {
            const e = Number(t.dataset.callbackId || 0),
                a = (b().data.callbacks || []).find(
                    (t) => Number(t.id || 0) === e
                ),
                n = String(a?.leadOps?.aiDraft || '').trim();
            return n
                ? navigator?.clipboard?.writeText
                    ? (await navigator.clipboard.writeText(n),
                      await (async function (e) {
                          const t = await Re(e, {
                              leadOps: { aiStatus: 'accepted' },
                          });
                          return (t && je(t), t);
                      })(e),
                      s('Borrador copiado', 'success'),
                      !0)
                    : (s('Clipboard no disponible', 'error'), !0)
                : (s('Aun no hay borrador IA', 'error'), !0);
        }
        case 'callbacks-bulk-select-visible':
            return (
                He(
                    {
                        selected: Array.from(
                            document.querySelectorAll(
                                '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
                            )
                        )
                            .map((e) =>
                                Number(e.getAttribute('data-callback-id') || 0)
                            )
                            .filter((e) => e > 0),
                    },
                    { persist: !1 }
                ),
                !0
            );
        case 'callbacks-bulk-clear':
            return (He({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const e = (b().callbacks.selected || [])
                        .map((e) => Number(e || 0))
                        .filter((e) => e > 0);
                    for (const t of e)
                        try {
                            await ze(t);
                        } catch (e) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await Li('callbacks'), Fe('pending'), !0);
        default:
            return !1;
    }
}
async function ji(e) {
    switch (e) {
        case 'context-open-appointments-transfer':
            return (await Li('appointments'), pe('pending_transfer'), !0);
        case 'context-open-dashboard':
            return (await Li('dashboard'), !0);
        default:
            return !1;
    }
}
async function Ri(e, t) {
    switch (e) {
        case 'queue-bulk-action':
            return (
                await (async function (e) {
                    const t = Qt(),
                        a = At(e);
                    if (t.length) {
                        if (Ga.has(a)) {
                            const e = window.confirm(
                                `${(function (e) {
                                    return 'no_show' === e
                                        ? 'No show'
                                        : 'completar' === e || 'completed' === e
                                          ? 'Completar'
                                          : 'Cancelar';
                                })(a)}: confirmar acción masiva`
                            );
                            if (!e) return;
                        }
                        for (const e of t)
                            try {
                                await xn({
                                    ticketId: e.id,
                                    action: a,
                                    consultorio:
                                        e.assignedConsultorio ||
                                        b().queue.stationConsultorio,
                                });
                            } catch (e) {}
                        (Ia(), Da(`Bulk ${a} sobre ${t.length} tickets`));
                    }
                })(String(t.dataset.queueAction || 'no_show')),
                !0
            );
        case 'queue-bulk-reprint':
            return (
                await (async function () {
                    const e = Qt();
                    for (const t of e)
                        try {
                            await zn(t.id);
                        } catch (e) {}
                    (Ia(), Da(`Bulk reimpresion ${e.length}`));
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function zi(e, t) {
    return (
        'queue-copy-install-link' === e &&
        (await (async function (e) {
            const t = String(e || '').trim();
            if (t)
                try {
                    (await navigator.clipboard.writeText(t),
                        s('Enlace copiado', 'success'));
                } catch (e) {
                    s('No se pudo copiar el enlace', 'error');
                }
            else s('No hay enlace de instalación disponible', 'warning');
        })(String(t.dataset.queueInstallUrl || '')),
        !0)
    );
}
async function Vi(e) {
    switch (e) {
        case 'queue-sensitive-confirm':
            return (await Fn(), !0);
        case 'queue-sensitive-cancel':
            return (jn(), !0);
        default:
            return !1;
    }
}
function Ui(e, t = 0) {
    return Number(e?.dataset?.queueConsultorio || t);
}
function Ki(e, t = 0) {
    return Number(e?.dataset?.queueId || t);
}
async function Qi(e, t) {
    switch (e) {
        case 'queue-refresh-state':
            return (await sn(), !0);
        case 'queue-call-next':
            return (await On(Ui(t)), !0);
        case 'queue-release-station':
            return (
                await (async function (e) {
                    const t = 2 === Number(e || 0) ? 2 : 1,
                        a = Wt(t);
                    a
                        ? await Hn(a.id, 'liberar', t)
                        : Da(`Sin ticket activo para liberar en C${t}`);
                })(Ui(t)),
                !0
            );
        case 'queue-toggle-shortcuts':
            return (Vn(), !0);
        case 'queue-toggle-one-tap':
            return (Xa({ oneTap: !b().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (Un(!0), !0);
        case 'queue-stop-practice':
            return (Un(!1), !0);
        case 'queue-lock-station':
            return (
                (function (e) {
                    const t = 2 === Number(e || 0) ? 2 : 1;
                    (Xa({ stationMode: 'locked', stationConsultorio: t }),
                        Da(`Estacion bloqueada en C${t}`));
                })(Ui(t, 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (e) {
                    if ('free' === Ct(e))
                        return (
                            Xa({ stationMode: 'free' }),
                            void Da('Estacion en modo libre')
                        );
                    Xa({ stationMode: 'locked' });
                })(String(t.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-capture-call-key':
            return (
                Xa({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    (Xa({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        default:
            return !1;
    }
}
async function Wi(e, t) {
    switch (e) {
        case 'queue-toggle-ticket-select':
            return (
                (function (e) {
                    const t = Number(e || 0);
                    if (!t) return;
                    const a = Ut(b().queue.selected || []);
                    Pa(a.includes(t) ? a.filter((e) => e !== t) : [...a, t]);
                })(Ki(t)),
                !0
            );
        case 'queue-select-visible':
            return (Pa(Vt().map((e) => Number(e.id || 0))), !0);
        case 'queue-clear-selection':
            return (Ia(), !0);
        case 'queue-ticket-action':
            return (
                await Hn(
                    Ki(t),
                    (function (e, t = '') {
                        return String(e?.dataset?.queueAction || t);
                    })(t),
                    Ui(t)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await zn(Ki(t)), !0);
        case 'queue-clear-search':
            return (
                (function () {
                    Xa({ search: '', selected: [] });
                    const e = document.getElementById('queueSearchInput');
                    e instanceof HTMLInputElement && (e.value = '');
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function Gi(e, t) {
    const a = [Qi, Wi, Ri, Vi, zi];
    for (const n of a) if (await n(e, t)) return !0;
    return !1;
}
async function Ji(e, t) {
    switch (e) {
        case 'close-toast':
            return (t.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                Si(String(t.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return (Ni(), !0);
        case 'refresh-admin-data':
            return (await mi(!0), !0);
        case 'run-admin-command': {
            const e = document.getElementById('adminQuickCommand');
            if (e instanceof HTMLInputElement) {
                const t = Hi(e.value);
                t && (await Oi(t), (e.value = ''), P());
            }
            return !0;
        }
        case 'open-command-palette':
            return (D(), Pi(), !0);
        case 'close-command-palette':
            return (P(), !0);
        case 'logout':
            return (
                await (async function () {
                    try {
                        await C('logout', { method: 'POST' });
                    } catch (e) {}
                    (q(''),
                        g((e) => ({
                            ...e,
                            auth: {
                                ...e.auth,
                                authenticated: !1,
                                csrfToken: '',
                                requires2FA: !1,
                                lastAuthAt: 0,
                                authMethod: '',
                            },
                        })));
                })(),
                Nn({ immediate: !1, reason: 'logout' }),
                N(),
                P(),
                bi(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                g((e) => ({ ...e, auth: { ...e.auth, requires2FA: !1 } })),
                x(!1),
                F(),
                O({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                j('password'),
                !0
            );
        default:
            return !1;
    }
}
async function Yi() {
    ((function () {
        const e = t('#loginScreen'),
            a = t('#adminDashboard');
        if (!(e instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((e.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                ${$('login-theme-bar')}\n            </section>\n        </div>\n    `),
            (a.innerHTML = M()));
    })(),
        (function () {
            const e = t('#adminMainContent');
            (e instanceof HTMLElement &&
                e.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(z).forEach(([e, t]) => {
                    (V(e, t.hero, 'data-admin-section-hero'),
                        V(e, t.priority, 'data-admin-priority-rail'),
                        V(e, t.workbench, 'data-admin-workbench'),
                        V(e, t.detail, 'data-admin-detail-rail'));
                }));
        })(),
        document.body.classList.add('admin-v3-mode'),
        document.body.classList.remove('admin-v2-mode'),
        document.addEventListener('click', async (e) => {
            const t =
                e.target instanceof Element
                    ? e.target.closest('[data-action]')
                    : null;
            if (!t) return;
            const a = String(t.getAttribute('data-action') || '');
            if (a) {
                e.preventDefault();
                try {
                    await (async function (e, t) {
                        const a = [Ji, fi, Fi, hi, Gi, ji];
                        for (const n of a) if (await n(e, t)) return !0;
                        return !1;
                    })(a, t);
                } catch (e) {
                    s(e?.message || 'Error ejecutando accion', 'error');
                }
            }
        }),
        document.addEventListener('click', async (e) => {
            const t =
                e.target instanceof Element
                    ? e.target.closest('[data-section]')
                    : null;
            if (!t) return;
            const a = t.classList.contains('admin-quick-nav-item'),
                n = t.classList.contains('nav-item');
            if (!a && !n) return;
            e.preventDefault();
            const i = await Li(
                String(t.getAttribute('data-section') || 'dashboard')
            );
            Ai() && !1 !== i && Di();
        }),
        document.addEventListener('click', (e) => {
            const t =
                e.target instanceof Element
                    ? e.target.closest('[data-queue-filter]')
                    : null;
            t &&
                (e.preventDefault(),
                en(String(t.getAttribute('data-queue-filter') || 'all')));
        }),
        (function () {
            const e = document.getElementById('callbacksBulkSelectVisibleBtn');
            e && e.setAttribute('data-action', 'callbacks-bulk-select-visible');
            const t = document.getElementById('callbacksBulkClearBtn');
            t && t.setAttribute('data-action', 'callbacks-bulk-clear');
            const a = document.getElementById('callbacksBulkMarkBtn');
            a && a.setAttribute('data-action', 'callbacks-bulk-mark');
        })(),
        (function () {
            let e = Q,
                t = W;
            try {
                ((e = JSON.parse(localStorage.getItem(U) || `"${Q}"`)),
                    (t = JSON.parse(localStorage.getItem(K) || `"${W}"`)));
            } catch (e) {}
            g((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof e ? e : Q,
                    density: 'string' == typeof t ? t : W,
                },
            }));
        })(),
        (function () {
            let e = 'all',
                t = 'priority_desc';
            try {
                ((e = JSON.parse(localStorage.getItem(he) || '"all"')),
                    (t = JSON.parse(
                        localStorage.getItem(fe) || '"priority_desc"'
                    )));
            } catch (e) {}
            g((a) => ({
                ...a,
                callbacks: { ...a.callbacks, filter: we(e), sort: qe(t) },
            }));
        })(),
        (function () {
            let e = '',
                t = '';
            try {
                ((e = String(localStorage.getItem(Ve) || '')),
                    (t = String(localStorage.getItem(Ue) || '')));
            } catch (e) {}
            const a = We(e),
                n = Xe(t, a);
            g((e) => ({
                ...e,
                availability: {
                    ...e.availability,
                    ...(a ? { selectedDate: a } : {}),
                    monthAnchor: n,
                },
            }));
        })(),
        (function () {
            const e = vi(xa(Ci, 'dashboard')),
                t = '1' === xa(_i, '0');
            (g((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: e,
                    sidebarCollapsed: t,
                    sidebarOpen: !1,
                },
            })),
                I(e),
                ki(e),
                Ti());
        })(),
        (function () {
            const e = {
                    stationMode:
                        'locked' === Ct(xa(Ra, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(xa(za, '1')) ? 2 : 1,
                    oneTap: '1' === xa(Va, '0'),
                    helpOpen: '1' === xa(Ka, '0'),
                    customCallKey: Ha(Ua, null),
                },
                t = Ct(ja('station')),
                a = Ct(ja('lock')),
                n = Ct(ja('one_tap'));
            (g((i) => ({
                ...i,
                queue: {
                    ...i.queue,
                    stationMode: Gn(a, e.stationMode),
                    stationConsultorio: Wn(t, e.stationConsultorio),
                    oneTap: Jn(n, e.oneTap),
                    helpOpen: e.helpOpen,
                    customCallKey:
                        e.customCallKey && 'object' == typeof e.customCallKey
                            ? e.customCallKey
                            : null,
                },
            })),
                Ja(b()));
        })(),
        Si(
            (function () {
                const e = String(xa(wi, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return qi.has(e) ? e : 'system';
            })()
        ),
        bi(),
        (function () {
            const e = document.getElementById('appointmentFilter');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    pe(e.value);
                });
            const t = document.getElementById('appointmentSort');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    de({ sort: G(t.value) || Q });
                });
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    me(a.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    Fe(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    He({ sort: qe(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var e;
                    ((e = o.value),
                        He({ search: String(e || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var e;
                    ((e = s.value),
                        Xa({ search: String(e || ''), selected: [] }));
                });
            const r = document.getElementById('adminQuickCommand');
            var l;
            r instanceof HTMLInputElement &&
                (l = r).addEventListener('keydown', async (e) => {
                    if ('Enter' !== e.key) return;
                    e.preventDefault();
                    const t = Hi(l.value);
                    t && (await Oi(t));
                });
        })(),
        (function () {
            const e = t('#adminMenuToggle'),
                a = t('#adminMenuClose'),
                n = t('#adminSidebarBackdrop');
            (e?.addEventListener('click', () => {
                Ai() ? Bi() : Ni();
            }),
                a?.addEventListener('click', () => Di({ restoreFocus: !0 })),
                n?.addEventListener('click', () => Di({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    Ai() ? Ti() : Di();
                }),
                document.addEventListener('keydown', (e) => {
                    if (!Ai() || !b().ui.sidebarOpen) return;
                    if ('Escape' === e.key)
                        return (
                            e.preventDefault(),
                            void Di({ restoreFocus: !0 })
                        );
                    if ('Tab' !== e.key) return;
                    const a = (function () {
                        const e = t('#adminSidebar');
                        if (!(e instanceof HTMLElement)) return [];
                        const a = t('#adminMenuClose'),
                            n = e.querySelector(
                                '.nav-item.active[data-section]'
                            ),
                            i = Array.from(
                                e.querySelectorAll('.nav-item[data-section]')
                            ).filter((e) => e !== n),
                            o = e.querySelector('.logout-btn');
                        return [a, n, ...i, o].filter($i);
                    })();
                    if (!a.length) return;
                    const n = a.indexOf(document.activeElement);
                    e.shiftKey
                        ? 0 === n &&
                          (e.preventDefault(), a[a.length - 1].focus())
                        : (-1 !== n && n !== a.length - 1) ||
                          (e.preventDefault(), a[0].focus());
                }),
                window.addEventListener('hashchange', async () => {
                    const e = (function (e = 'dashboard') {
                        return vi(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            e
                        );
                    })(b().ui.activeSection);
                    await Li(e, { force: !0 });
                }),
                window.addEventListener('storage', (e) => {
                    'themeMode' === e.key && Si(String(e.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (e) => {
            ht() && (e.preventDefault(), (e.returnValue = ''));
        }));
    const e = document.getElementById('loginForm');
    var a;
    (e instanceof HTMLFormElement && e.addEventListener('submit', gi),
        (a = {
            navigateToSection: Li,
            focusQuickCommand: Pi,
            focusCurrentSearch: Ii,
            runQuickAction: Oi,
            closeSidebar: () => Di({ restoreFocus: !0 }),
            toggleMenu: () => {
                Ai() ? Bi() : Ni();
            },
            dismissQueueSensitiveDialog: Rn,
            toggleQueueHelp: () => Vn(),
            queueNumpadAction: Qn,
        }),
        window.addEventListener('keydown', (e) => {
            (function (e, t) {
                const {
                        navigateToSection: a,
                        focusQuickCommand: n,
                        focusCurrentSearch: i,
                        runQuickAction: o,
                        closeSidebar: s,
                        toggleMenu: r,
                        dismissQueueSensitiveDialog: l,
                        toggleQueueHelp: u,
                    } = t,
                    { key: d, code: p } = v(e);
                if ('Escape' === e.key)
                    return (('function' == typeof l && l()) || s(), !0);
                if (e.ctrlKey && !e.shiftKey && !e.altKey && 'k' === d)
                    return (e.preventDefault(), n(), !0);
                if (!e.ctrlKey && !e.metaKey && !e.altKey && '/' === d)
                    return (e.preventDefault(), i(), !0);
                if (
                    !(function (e) {
                        return (
                            e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey
                        );
                    })(e)
                )
                    return !1;
                const m = (function ({ key: e, code: t }) {
                    return t || e;
                })({ key: d, code: p });
                if ('keym' === m) return (e.preventDefault(), r(), !0);
                if ('digit0' === m) return (e.preventDefault(), u(), !0);
                const g = f[m];
                if (g) return (c() || (e.preventDefault(), a(g)), !0);
                const k = (
                    'queue' !== b().ui.activeSection ? h : { ...h, ...y }
                )[m];
                return !!k && (c() || (e.preventDefault(), o(k)), !0);
            })(e, a) ||
                (function (e, t) {
                    if ('function' != typeof t) return !1;
                    const a = b().queue,
                        n = Boolean(a.captureCallKeyMode),
                        { code: i } = v(e),
                        o =
                            (function (e, t) {
                                return (
                                    t.startsWith('numpad') ||
                                    3 === e.location ||
                                    [
                                        'kpenter',
                                        'kpadd',
                                        'kpsubtract',
                                        'kpdecimal',
                                    ].includes(t)
                                );
                            })(e, i) ||
                            n ||
                            (function (e, t, a) {
                                const n = e.customCallKey;
                                return Boolean(
                                    n &&
                                    'object' == typeof n &&
                                    String(n.key || '') ===
                                        String(t.key || '') &&
                                    String(n.code || '').toLowerCase() === a &&
                                    Number(n.location || 0) ===
                                        Number(t.location || 0)
                                );
                            })(a, e, i);
                    !!o &&
                        (c() ||
                            Promise.resolve(
                                t({
                                    key: e.key,
                                    code: e.code,
                                    location: e.location,
                                })
                            ).catch(() => {}));
                })(e, a.queueNumpadAction);
        }));
    const n = await (async function () {
        try {
            const e = await C('status'),
                t = !0 === e.authenticated,
                a = t ? String(e.csrfToken || '') : '';
            return (
                q(a),
                g((e) => ({
                    ...e,
                    auth: {
                        ...e.auth,
                        authenticated: t,
                        csrfToken: a,
                        requires2FA: !1,
                        lastAuthAt: t ? Date.now() : 0,
                        authMethod: t ? 'session' : '',
                    },
                })),
                t
            );
        } catch (e) {
            return !1;
        }
    })();
    (n
        ? (await (async function () {
              (B(), P(), await mi(!1));
          })(),
          I(b().ui.activeSection))
        : (N(), P(), bi()),
        An ||
            'undefined' == typeof window ||
            ((An = !0),
            window.setInterval(() => {
                En('timer');
            }, Tn()),
            document.addEventListener('visibilitychange', Bn),
            window.addEventListener('focus', Dn),
            window.addEventListener('online', Pn),
            Nn({
                immediate:
                    b().auth?.authenticated &&
                    'queue' === b().ui?.activeSection,
                reason: 'init',
            })),
        (async function () {
            const e = (function () {
                const e = 'Notification' in window,
                    t = 'serviceWorker' in navigator,
                    a = 'PushManager' in window;
                if (!e)
                    return {
                        tone: 'neutral',
                        label: 'Push no disponible',
                        meta: 'Este navegador no soporta notificaciones.',
                    };
                const n = String(Notification.permission || 'default');
                return 'granted' === n
                    ? {
                          tone: 'success',
                          label: t && a ? 'Push listo' : 'Push parcial',
                          meta:
                              t && a
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
            (['pushStatusIndicator', 'dashboardPushStatus'].forEach((t) => {
                const a = document.getElementById(t);
                a &&
                    (a.setAttribute('data-state', e.tone), r(`#${t}`, e.label));
            }),
                ['pushStatusMeta', 'dashboardPushMeta'].forEach((t) => {
                    document.getElementById(t) && r(`#${t}`, e.meta);
                }));
        })(),
        window.setInterval(() => {
            pi();
        }, 3e4));
}
const Zi = (
    'loading' === document.readyState
        ? new Promise((e, t) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      Yi().then(e).catch(t);
                  },
                  { once: !0 }
              );
          })
        : Yi()
).catch((e) => {
    throw (console.error('admin-v3 boot failed', e), e);
});
export { Zi as default };
