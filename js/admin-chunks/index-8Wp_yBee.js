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
function v(t) {
    return {
        key: String(t.key || '').toLowerCase(),
        code: String(t.code || '').toLowerCase(),
    };
}
let k = '';
async function w(t, e = {}) {
    const n = String(e.method || 'GET').toUpperCase(),
        a = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== n && k && (a.headers['X-CSRF-Token'] = k),
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
function S(t) {
    k = String(t || '');
}
async function C(t, e = {}) {
    return w(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function q(t, e = {}) {
    return w(`/admin-auth.php?action=${encodeURIComponent(t)}`, e);
}
const A = {
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
function T(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${A[t] || A.menu}</svg>`;
}
function _(t) {
    return `\n        <div class="sony-theme-switcher ${t}" role="group" aria-label="Tema">\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${T('sun')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${T('moon')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${T('system')}</button>\n        </div>\n    `;
}
function $(t, e, n, a = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${a ? ' active' : ''}"\n            data-section="${t}"\n            ${a ? 'aria-current="page"' : ''}\n        >\n            ${T(n)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function M() {
    return `\n        <div class="admin-v3-shell">\n            \n        <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <div class="admin-v3-sidebar__brand">\n                    <strong>Piel en Armonia</strong>\n                    <small>Admin sony_v3</small>\n                </div>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${T('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                \n        ${$('dashboard', 'Dashboard', 'dashboard', !0)}\n        ${$('appointments', 'Citas', 'appointments')}\n        ${$('callbacks', 'Callbacks', 'callbacks')}\n        ${$('reviews', 'Resenas', 'reviews')}\n        ${$('availability', 'Disponibilidad', 'availability')}\n        ${$('queue', 'Turnero Sala', 'queue')}\n    \n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${T('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n    \n            \n        <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n            \n        <header class="admin-v3-topbar">\n            <div class="admin-v3-topbar__copy">\n                <p class="sony-kicker">Sony V3</p>\n                <h2 id="pageTitle">Dashboard</h2>\n            </div>\n            <div class="admin-v3-topbar__actions">\n                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${T('menu')}<span>Menu</span></button>\n                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                ${_('admin-theme-switcher-header')}\n            </div>\n        </header>\n    \n            \n        <section class="admin-v3-context-strip" id="adminProductivityStrip">\n            <div class="admin-v3-context-copy" data-admin-section-hero>\n                <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                <div id="adminContextActions" class="sony-context-actions"></div>\n            </div>\n            <div class="admin-v3-status-rail" data-admin-priority-rail>\n                <article class="sony-status-tile">\n                    <span>Push</span>\n                    <strong id="pushStatusIndicator">Inicializando</strong>\n                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                </article>\n                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                    <span>Sesion</span>\n                    <strong id="adminSessionState">No autenticada</strong>\n                    <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                </article>\n                <article class="sony-status-tile">\n                    <span>Sincronizacion</span>\n                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                    <small id="adminSyncState">Listo para primera sincronizacion</small>\n                </article>\n            </div>\n        </section>\n    \n            \n        \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                \n        <article class="sony-panel dashboard-hero-panel">\n            <div class="dashboard-hero-copy">\n                <p class="sony-kicker">Resumen diario</p>\n                <h3>Prioridades de hoy</h3>\n                <p id="dashboardHeroSummary">\n                    Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                </p>\n            </div>\n            <div class="dashboard-hero-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n            </div>\n            <div class="dashboard-hero-metrics">\n                <div class="dashboard-hero-metric">\n                    <span>Rating</span>\n                    <strong id="dashboardHeroRating">0.0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Reseñas 30d</span>\n                    <strong id="dashboardHeroRecentReviews">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Urgentes SLA</span>\n                    <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Transferencias</span>\n                    <strong id="dashboardHeroPendingTransfers">0</strong>\n                </div>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel dashboard-signal-panel">\n            <header>\n                <div>\n                    <h3>Señal operativa</h3>\n                    <small id="operationRefreshSignal">Tiempo real</small>\n                </div>\n                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n            </header>\n            <p id="dashboardLiveMeta">\n                Sin alertas criticas en la operacion actual.\n            </p>\n            <div class="dashboard-signal-stack">\n                <article class="dashboard-signal-card">\n                    <span>Push</span>\n                    <strong id="dashboardPushStatus">Sin validar</strong>\n                    <small id="dashboardPushMeta">Permisos del navegador</small>\n                </article>\n                <article class="dashboard-signal-card">\n                    <span>Atencion</span>\n                    <strong id="dashboardQueueHealth">Cola: estable</strong>\n                    <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                </article>\n            </div>\n            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-grid sony-grid-kpi">\n            <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n            <article class="sony-kpi"><h3>Reseñas</h3><strong id="totalReviewsCount">0</strong></article>\n            <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n            <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-two">\n            <article class="sony-panel dashboard-card-operations">\n                <header>\n                    <h3>Centro operativo</h3>\n                    <small id="operationDeckMeta">Prioridades y acciones</small>\n                </header>\n                <div class="sony-panel-stats">\n                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                    <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                    <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                </div>\n                <p id="operationQueueHealth">Cola: estable</p>\n                <div id="operationActionList" class="operations-action-list"></div>\n            </article>\n\n            <article class="sony-panel" id="funnelSummary">\n                <header><h3>Embudo</h3></header>\n                <div class="sony-panel-stats">\n                    <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                    <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                    <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                </div>\n            </article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-three">\n            <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n        </div>\n    \n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n    \n        \n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                \n        <article class="sony-panel appointments-command-deck">\n            <header class="section-header appointments-command-head">\n                <div>\n                    <p class="sony-kicker">Agenda clinica</p>\n                    <h3>Citas</h3>\n                    <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                </div>\n                <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n            </header>\n            <div class="appointments-ops-grid">\n                <article class="appointments-ops-card tone-warning">\n                    <span>Transferencias</span>\n                    <strong id="appointmentsOpsPendingTransfer">0</strong>\n                    <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                </article>\n                <article class="appointments-ops-card tone-neutral">\n                    <span>Proximas 48h</span>\n                    <strong id="appointmentsOpsUpcomingCount">0</strong>\n                    <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                </article>\n                <article class="appointments-ops-card tone-danger">\n                    <span>No show</span>\n                    <strong id="appointmentsOpsNoShowCount">0</strong>\n                    <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                </article>\n                <article class="appointments-ops-card tone-success">\n                    <span>Hoy</span>\n                    <strong id="appointmentsOpsTodayCount">0</strong>\n                    <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                </article>\n            </div>\n            <div class="appointments-command-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel appointments-focus-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                    <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                    <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                </div>\n            </header>\n            <div class="appointments-focus-grid">\n                <div class="appointments-focus-stat">\n                    <span>Siguiente ventana</span>\n                    <strong id="appointmentsFocusWindow">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Pago</span>\n                    <strong id="appointmentsFocusPayment">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Estado</span>\n                    <strong id="appointmentsFocusStatus">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Contacto</span>\n                    <strong id="appointmentsFocusContact">-</strong>\n                </div>\n            </div>\n            <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n            <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel appointments-workbench">\n            <header class="section-header appointments-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                </div>\n                <div class="toolbar-group" id="appointmentsDensityToggle">\n                    <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                    <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                </div>\n            </div>\n            <div class="toolbar-row appointments-toolbar">\n                <label>\n                    <span class="sr-only">Filtro</span>\n                    <select id="appointmentFilter">\n                        <option value="all">Todas</option>\n                        <option value="pending_transfer">Transferencias por validar</option>\n                        <option value="upcoming_48h">Proximas 48h</option>\n                        <option value="no_show">No show</option>\n                        <option value="triage_attention">Triage accionable</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden</span>\n                    <select id="appointmentSort">\n                        <option value="datetime_desc">Fecha reciente</option>\n                        <option value="datetime_asc">Fecha ascendente</option>\n                        <option value="patient_az">Paciente (A-Z)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                <p id="appointmentsToolbarState">Sin filtros activos</p>\n            </div>\n\n            <div class="table-scroll appointments-table-shell">\n                <table id="appointmentsTable" class="sony-table">\n                    <thead>\n                        <tr>\n                            <th>Paciente</th>\n                            <th>Servicio</th>\n                            <th>Fecha</th>\n                            <th>Pago</th>\n                            <th>Estado</th>\n                            <th>Acciones</th>\n                        </tr>\n                    </thead>\n                    <tbody id="appointmentsTableBody"></tbody>\n                </table>\n            </div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                \n        <article class="sony-panel callbacks-command-deck">\n            <header class="section-header callbacks-command-head">\n                <div>\n                    <p class="sony-kicker">SLA telefonico</p>\n                    <h3>Callbacks</h3>\n                    <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                </div>\n                <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n            </header>\n            <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n            </div>\n            <div class="callbacks-command-actions">\n                <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel callbacks-next-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                    <h3 id="callbacksOpsNext">Sin telefono</h3>\n                    <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                </div>\n                <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n            </header>\n            <div class="callbacks-next-grid">\n                <div class="callbacks-next-stat">\n                    <span>Espera</span>\n                    <strong id="callbacksNextWait">0 min</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Preferencia</span>\n                    <strong id="callbacksNextPreference">-</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Estado</span>\n                    <strong id="callbacksNextState">Pendiente</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Ultimo corte</span>\n                    <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                </div>\n            </div>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel callbacks-workbench">\n            <header class="section-header callbacks-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                </div>\n            </div>\n            <div class="toolbar-row callbacks-toolbar">\n                <label>\n                    <span class="sr-only">Filtro callbacks</span>\n                    <select id="callbackFilter">\n                        <option value="all">Todos</option>\n                        <option value="pending">Pendientes</option>\n                        <option value="contacted">Contactados</option>\n                        <option value="today">Hoy</option>\n                        <option value="sla_urgent">Urgentes SLA</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden callbacks</span>\n                    <select id="callbackSort">\n                        <option value="recent_desc">Mas recientes</option>\n                        <option value="waiting_desc">Mayor espera (SLA)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />\n                <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="callbacksToolbarMeta">Mostrando 0</p>\n                <p id="callbacksToolbarState">Sin filtros activos</p>\n            </div>\n            <div id="callbacksGrid" class="callbacks-grid"></div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                <header class="section-header availability-header">\n                    <div class="availability-calendar">\n                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                        <div class="availability-badges">\n                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                        </div>\n                    </div>\n                    <div class="toolbar-group calendar-header">\n                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                        <strong id="calendarMonth"></strong>\n                        <button type="button" data-action="change-month" data-delta="1">Next</button>\n                        <button type="button" data-action="availability-today">Hoy</button>\n                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n                    </div>\n                </header>\n\n                <div class="toolbar-row slim">\n                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n                    <p id="availabilitySyncStatus">Sincronizado</p>\n                </div>\n\n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n\n                <div id="availabilityDetailGrid" class="availability-detail-grid">\n                    <article class="sony-panel soft">\n                        <h4 id="selectedDate">-</h4>\n                        <div id="timeSlotsList" class="time-slots-list"></div>\n                    </article>\n\n                    <article class="sony-panel soft">\n                        <div id="availabilityQuickSlotPresets" class="slot-presets">\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                        </div>\n                        <div id="addSlotForm" class="add-slot-form">\n                            <input type="time" id="newSlotTime" />\n                            <button type="button" data-action="add-time-slot">Agregar</button>\n                        </div>\n                        <div id="availabilityDayActions" class="toolbar-group wrap">\n                            <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                            <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                        </div>\n                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                        <div class="toolbar-group">\n                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                        </div>\n                    </article>\n                </div>\n            </div>\n        </section>\n    \n        \n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                \n        <header class="section-header">\n            <div>\n                <h3>Turnero Sala</h3>\n                <p>\n                    Apps operativas, cola en vivo y flujo simple para recepción,\n                    kiosco y TV.\n                </p>\n            </div>\n            <div class="queue-admin-header-actions">\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                <button type="button" data-action="queue-refresh-state">Refrescar</button>\n            </div>\n        </header>\n    \n                \n        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft">\n            <div class="queue-apps-hub__header">\n                <div>\n                    <h4>Apps operativas</h4>\n                    <p>\n                        Instala Operador, Kiosco y Sala TV desde el mismo centro de\n                        control para separar cada equipo por uso.\n                    </p>\n                </div>\n                <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">\n                    Plataforma detectada\n                </span>\n            </div>\n            <div id="queueAppDownloadsCards" class="queue-apps-grid"></div>\n        </div>\n    \n                \n        <div class="sony-grid sony-grid-kpi slim">\n            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n        </div>\n    \n                \n        <div id="queueStationControl" class="toolbar-row">\n            <span id="queueStationBadge">Estacion: libre</span>\n            <span id="queueStationModeBadge">Modo: free</span>\n            <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n            <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n            <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n            <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n            <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n            <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n            <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n            <button type="button" data-action="queue-stop-practice">Salir practica</button>\n            <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n            <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n        </div>\n    \n                \n        <div id="queueShortcutPanel" hidden>\n            <p>Numpad Enter llama siguiente.</p>\n            <p>Numpad Decimal prepara completar.</p>\n            <p>Numpad Subtract prepara no_show.</p>\n            <p>Numpad Add re-llama el ticket activo.</p>\n        </div>\n    \n                \n        <div id="queueTriageToolbar" class="toolbar-row">\n            <button type="button" data-queue-filter="all">Todo</button>\n            <button type="button" data-queue-filter="called">Llamados</button>\n            <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n            <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n            <button type="button" data-action="queue-clear-search">Limpiar</button>\n            <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n            <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n            <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n        </div>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="queueTriageSummary">Sin riesgo</p>\n            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n        </div>\n    \n                \n        <ul id="queueNextAdminList" class="sony-list"></ul>\n\n        <div class="table-scroll">\n            <table class="sony-table queue-admin-table">\n                <thead>\n                    <tr>\n                        <th>Sel</th>\n                        <th>Ticket</th>\n                        <th>Tipo</th>\n                        <th>Estado</th>\n                        <th>Consultorio</th>\n                        <th>Espera</th>\n                        <th>Acciones</th>\n                    </tr>\n                </thead>\n                <tbody id="queueTableBody"></tbody>\n            </table>\n        </div>\n\n        <div id="queueActivityPanel" class="sony-panel soft">\n            <h4>Actividad</h4>\n            <ul id="queueActivityList" class="sony-list"></ul>\n        </div>\n    \n            </div>\n\n            \n        <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n            <form method="dialog">\n                <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                <div class="toolbar-group">\n                    <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                    <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                </div>\n            </form>\n        </dialog>\n    \n        </section>\n    \n    \n        </main>\n    \n            \n        <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n            <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n            <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                <div class="admin-command-dialog__head">\n                    <div>\n                        <p class="sony-kicker">Command Palette</p>\n                        <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                    </div>\n                    <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                </div>\n                <div class="admin-command-box">\n                    <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                </div>\n                <div class="admin-command-dialog__hints">\n                    <span>Ctrl+K abre esta paleta</span>\n                    <span>/ enfoca la busqueda de la seccion activa</span>\n                </div>\n            </div>\n        </div>\n    \n        </div>\n    `;
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
    const t = e('#loginScreen'),
        n = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), n && n.classList.add('is-hidden'));
}
function D() {
    const t = e('#loginScreen'),
        n = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), n && n.classList.remove('is-hidden'));
}
function B() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.remove('is-hidden'),
        t.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function x() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.add('is-hidden'),
        t.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function P(t) {
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
    const a = E[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = a);
}
function I(t) {
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
        H(!1));
}
function F({
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
function H(t) {
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
function O({ clearPassword: t = !1 } = {}) {
    const n = e('#adminPassword'),
        a = e('#admin2FACode');
    (n instanceof HTMLInputElement && t && (n.value = ''),
        a instanceof HTMLInputElement && (a.value = ''));
}
function R(t = 'password') {
    const n = e('2fa' === t ? '#admin2FACode' : '#adminPassword');
    n instanceof HTMLInputElement && (n.focus(), n.select?.());
}
function j(n) {
    const a = (function (t) {
        const e = L[t?.ui?.activeSection || 'dashboard'] || L.dashboard,
            n = t?.auth && 'object' == typeof t.auth ? t.auth : {},
            a = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
            i = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
            o = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
            s =
                t?.data?.availability && 'object' == typeof t.data.availability
                    ? t.data.availability
                    : {},
            r = Array.isArray(t?.data?.queueTickets) ? t.data.queueTickets : [],
            c =
                t?.data?.queueMeta && 'object' == typeof t.data.queueMeta
                    ? t.data.queueMeta
                    : null,
            l = (function (t) {
                return t.filter((t) => {
                    const e = String(
                        t.paymentStatus || t.payment_status || ''
                    ).toLowerCase();
                    return (
                        'pending_transfer_review' === e ||
                        'pending_transfer' === e
                    );
                }).length;
            })(a),
            u = (function (t) {
                return t.filter((t) => {
                    const e = String(t.status || '')
                        .toLowerCase()
                        .trim();
                    return 'pending' === e || 'pendiente' === e;
                }).length;
            })(i),
            d = (function (t) {
                return Object.values(t || {}).filter(
                    (t) => Array.isArray(t) && t.length > 0
                ).length;
            })(s),
            p = (function (t, e) {
                return e && Number.isFinite(Number(e.waitingCount))
                    ? Math.max(0, Number(e.waitingCount))
                    : (Array.isArray(t) ? t : []).filter(
                          (t) =>
                              'waiting' === String(t.status || '').toLowerCase()
                      ).length;
            })(r, c);
        return {
            auth: n,
            config: e,
            appointments: a,
            reviews: o,
            pendingTransfers: l,
            pendingCallbacks: u,
            availabilityDays: d,
            waitingTickets: p,
            dashboardAlerts: l + u,
        };
    })(n);
    ((function (e, n) {
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
                })(e?.ui?.lastRefreshAt || 0)
            ));
    })(n, a.config),
        (function (t) {
            (r('#dashboardBadge', t.dashboardAlerts),
                r('#appointmentsBadge', t.appointments.length),
                r('#callbacksBadge', t.pendingCallbacks),
                r('#reviewsBadge', t.reviews.length),
                r('#availabilityBadge', t.availabilityDays),
                r('#queueBadge', t.waitingTickets));
        })(a),
        (function (t) {
            const n = e('#adminSessionTile'),
                a = t.authenticated
                    ? 'Sesion activa'
                    : t.requires2FA
                      ? 'Verificacion 2FA'
                      : 'No autenticada',
                i = t.authenticated
                    ? 'success'
                    : t.requires2FA
                      ? 'warning'
                      : 'neutral';
            (n?.setAttribute('data-state', i),
                r('#adminSessionState', a),
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
                                    }[String(e.authMethod || '')] ||
                                    'acceso validado',
                                n = Number(e.lastAuthAt || 0);
                            return n
                                ? `Protegida por ${t}. ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                                : `Protegida por ${t}.`;
                        }
                        return e.requires2FA
                            ? 'Esperando codigo de seis digitos para completar el acceso.'
                            : 'Autenticate para operar el panel.';
                    })(t)
                ));
        })(a.auth));
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
function V(t, n, a) {
    if (!n) return;
    const i = e(`#${t}`);
    if (!(i instanceof HTMLElement)) return;
    const o = i.querySelector(n);
    o instanceof HTMLElement && o.setAttribute(a, 'true');
}
const U = 'admin-appointments-sort',
    K = 'admin-appointments-density',
    Q = 'datetime_desc',
    W = 'comfortable';
function G(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function J(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function Y(t) {
    return G(t.paymentStatus || t.payment_status || '');
}
function Z(t) {
    return G(t);
}
function X(t, e = '-') {
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
function tt(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[G(t)] || X(t, 'Pendiente')
    );
}
function et(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[G(t)] || X(t, 'Pendiente')
    );
}
function nt(t) {
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
function at(t) {
    const e = J(t);
    if (!e) return !1;
    const n = new Date(e),
        a = new Date();
    return (
        n.getFullYear() === a.getFullYear() &&
        n.getMonth() === a.getMonth() &&
        n.getDate() === a.getDate()
    );
}
function it(t) {
    const e = J(t);
    if (!e) return !1;
    const n = e - Date.now();
    return n >= 0 && n <= 1728e5;
}
function ot(t) {
    const e = Y(t),
        n = Z(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === n ||
        'cancelled' === n
    );
}
function st(t, e) {
    const n = G(e);
    return 'pending_transfer' === n
        ? t.filter((t) => {
              const e = Y(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === n
          ? t.filter(it)
          : 'no_show' === n
            ? t.filter((t) => 'no_show' === Z(t.status))
            : 'triage_attention' === n
              ? t.filter(ot)
              : t;
}
function rt(t) {
    const e = Y(t),
        n = Z(t.status),
        a = J(t);
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
            : at(t)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: a ? nt(a) : 'Agenda del dia',
                }
              : it(t)
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
function ct(t) {
    const e = t
            .map((t) => ({ item: t, stamp: J(t) }))
            .sort((t, e) => t.stamp - e.stamp),
        n = e.find(({ item: t }) => {
            const e = Y(t);
            return 'pending_transfer_review' === e || 'pending_transfer' === e;
        });
    if (n)
        return {
            item: n.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const a = e.find(({ item: t }) => 'no_show' === Z(t.status));
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
function lt(e) {
    return e.length
        ? e
              .map((e) => {
                  const n = J(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">${(function (
                      e
                  ) {
                      const n = rt(e);
                      return `\n        <div class="appointment-service">\n            <strong>${t(X(e.service, 'Servicio pendiente'))}</strong>\n            <span>Especialista: ${t(X(e.doctor, 'Sin asignar'))}</span>\n            <small>${t(n.label)} | ${t(n.note)}</small>\n        </div>\n    `;
                  })(
                      e
                  )}</td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(a(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(nt(n))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
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
                              const e = G(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(n)
                      )}">${t(tt(n))}</span>\n            <small>Metodo: ${t(((i = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[G(i)] || X(i, 'Metodo pendiente')))}</small>\n            ${a ? `<a href="${t(a)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const n = Z(e.status),
                          a = Y(e),
                          i = rt(e),
                          o = [];
                      return (
                          'pending_transfer_review' === a &&
                              o.push('Transferencia por validar'),
                          'no_show' === n && o.push('Paciente ausente'),
                          'cancelled' === n && o.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${t(
                              (function (t) {
                                  const e = G(t);
                                  return 'completed' === e
                                      ? 'success'
                                      : 'cancelled' === e || 'no_show' === e
                                        ? 'danger'
                                        : 'pending' === e
                                          ? 'warning'
                                          : 'neutral';
                              })(n)
                          )}">${t(et(n))}</span>\n            <small>${t(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const n = Number(e.id || 0),
                          a = Y(e),
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
function ut() {
    const e = b(),
        n = Array.isArray(e?.data?.appointments) ? e.data.appointments : [],
        i = e?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (t, e) {
            const n = G(e),
                a = [...t];
            return 'patient_az' === n
                ? (a.sort((t, e) => G(t.name).localeCompare(G(e.name), 'es')),
                  a)
                : 'datetime_asc' === n
                  ? (a.sort((t, e) => J(t) - J(e)), a)
                  : (a.sort((t, e) => J(e) - J(t)), a);
        })(
            (function (t, e) {
                const n = G(e);
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
                          ].some((t) => G(t).includes(n))
                      )
                    : t;
            })(st(n, i.filter), i.search),
            i.sort
        );
    (c('#appointmentsTableBody', lt(o)),
        (function (t, e, n) {
            (r('#appointmentsToolbarMeta', `Mostrando ${e} de ${n}`),
                r(
                    '#appointmentsToolbarState',
                    (function (t, e) {
                        const n = [];
                        if ('all' !== G(t.filter)) {
                            const e = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            n.push(e[G(t.filter)] || t.filter);
                        }
                        return (
                            G(t.search) && n.push(`Busqueda: ${t.search}`),
                            'patient_az' === G(t.sort)
                                ? n.push('Paciente (A-Z)')
                                : 'datetime_asc' === G(t.sort)
                                  ? n.push('Fecha ascendente')
                                  : n.push('Fecha reciente'),
                            0 === e && n.push('Resultados: 0'),
                            n
                        );
                    })(t, e).join(' | ')
                ));
            const a = document.getElementById('clearAppointmentsFiltersBtn');
            if (a) {
                const e = 'all' !== G(t.filter) || '' !== G(t.search);
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
                    'compact' === G(t.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((e) => {
                        const n = G(e.dataset.density) === G(t.density);
                        e.classList.toggle('is-active', n);
                    }),
                (function (t) {
                    const e = G(t);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const n = G(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', n);
                        });
                })(t.filter),
                (function (t) {
                    try {
                        (localStorage.setItem(U, JSON.stringify(t.sort)),
                            localStorage.setItem(K, JSON.stringify(t.density)));
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
                    `${X(l.service, 'Servicio pendiente')} | ${a(l.date)} ${l.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', nt(J(l))),
                r(
                    '#appointmentsFocusPayment',
                    tt(l.paymentStatus || l.payment_status)
                ),
                r('#appointmentsFocusStatus', et(l.status)),
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
                const e = st(t, 'pending_transfer'),
                    n = st(t, 'upcoming_48h'),
                    a = st(t, 'no_show'),
                    i = st(t, 'triage_attention'),
                    o = t.filter(at);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: n.length,
                    noShowCount: a.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: ct(t),
                };
            })(n),
            o.length,
            n.length
        ));
}
function dt(t) {
    (g((e) => ({ ...e, appointments: { ...e.appointments, ...t } })), ut());
}
function pt(t) {
    dt({ filter: G(t) || 'all' });
}
function mt(t) {
    dt({ search: String(t || '') });
}
function bt(t, e) {
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
        ut());
}
async function gt(t, e) {
    await C('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
const ft = 'admin-callbacks-sort',
    ht = 'admin-callbacks-filter',
    yt = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    vt = new Set(['recent_desc', 'waiting_desc']);
function kt(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function wt(t) {
    const e = kt(t);
    return yt.has(e) ? e : 'all';
}
function St(t) {
    const e = kt(t);
    return vt.has(e) ? e : 'recent_desc';
}
function Ct(t) {
    const e = kt(t);
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
function qt(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function At(t) {
    const e = qt(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function Tt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function _t(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const n = new Date();
    return (
        e.getFullYear() === n.getFullYear() &&
        e.getMonth() === n.getMonth() &&
        e.getDate() === n.getDate()
    );
}
function $t(t) {
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
function Lt(t) {
    try {
        (localStorage.setItem(ht, JSON.stringify(wt(t.filter))),
            localStorage.setItem(ft, JSON.stringify(St(t.sort))));
    } catch (t) {}
}
function Et() {
    const e = b(),
        n = Array.isArray(e?.data?.callbacks) ? e.data.callbacks : [],
        a = e.callbacks,
        o = (function (t, e) {
            const n = [...t];
            return 'waiting_desc' === St(e)
                ? (n.sort((t, e) => qt(t) - qt(e)), n)
                : (n.sort((t, e) => qt(e) - qt(t)), n);
        })(
            (function (t, e) {
                const n = kt(e);
                return n
                    ? t.filter((t) =>
                          [t.telefono, t.phone, t.preferencia, t.status].some(
                              (t) => kt(t).includes(n)
                          )
                      )
                    : t;
            })(
                (function (t, e) {
                    const n = wt(e);
                    return 'pending' === n || 'contacted' === n
                        ? t.filter((t) => Ct(t.status) === n)
                        : 'today' === n
                          ? t.filter((t) => _t(t.fecha || t.createdAt))
                          : 'sla_urgent' === n
                            ? t.filter(
                                  (t) =>
                                      'pending' === Ct(t.status) && At(t) >= 120
                              )
                            : t;
                })(n, a.filter),
                a.search
            ),
            a.sort
        ),
        s = new Set((a.selected || []).map((t) => Number(t || 0))),
        l = (function (t) {
            const e = t.filter((t) => 'pending' === Ct(t.status)),
                n = e.filter((t) => At(t) >= 120),
                a = e.slice().sort((t, e) => qt(t) - qt(e))[0];
            return {
                pendingCount: e.length,
                urgentCount: n.length,
                todayCount: t.filter((t) => _t(t.fecha || t.createdAt)).length,
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
                              const o = Ct(e.status),
                                  s =
                                      'pending' === o
                                          ? 'callback-card pendiente'
                                          : 'callback-card contactado',
                                  r =
                                      'pending' === o
                                          ? 'pendiente'
                                          : 'contactado',
                                  c = Number(e.id || 0),
                                  l = Tt(e),
                                  u = At(e),
                                  d = $t(u),
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
                            'all' !== wt(t.filter) &&
                                e.push(
                                    'pending' === wt(t.filter)
                                        ? 'Pendientes'
                                        : 'contacted' === wt(t.filter)
                                          ? 'Contactados'
                                          : 'today' === wt(t.filter)
                                            ? 'Hoy'
                                            : 'Urgentes SLA'
                                ),
                            kt(t.search) && e.push(`Busqueda: ${t.search}`),
                            'waiting_desc' === St(t.sort)
                                ? e.push('Orden: Mayor espera (SLA)')
                                : e.push('Orden: Mas recientes'),
                            e
                        );
                    })(t).join(' | ')
                ));
            const a = document.getElementById('callbackFilter');
            a instanceof HTMLSelectElement && (a.value = wt(t.filter));
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement && (i.value = St(t.sort));
            const o = document.getElementById('searchCallbacks');
            (o instanceof HTMLInputElement &&
                o.value !== t.search &&
                (o.value = t.search),
                (function (t) {
                    const e = kt(t);
                    document
                        .querySelectorAll(
                            '.callback-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const n = kt(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', n);
                        });
                })(t.filter),
                Lt(t));
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
            (r('#callbacksOpsNext', s ? Tt(s) : 'Sin telefono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${Tt(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                r('#callbacksNextWait', s ? Mt(At(s)) : '0 min'),
                r('#callbacksNextPreference', (s && s.preferencia) || '-'),
                r('#callbacksNextState', s ? $t(At(s)).label : 'Pendiente'));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === a),
                r('#callbacksSelectedCount', a));
        })(l, o.length, n.length, s.size));
}
function Nt(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e && Lt(b().callbacks),
        Et());
}
function Dt(t) {
    Nt({ filter: wt(t), selected: [] });
}
async function Bt(t, e = '') {
    const n = Number(t || 0);
    n <= 0 ||
        (await C('callbacks', {
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
                Et());
        })(n));
}
const xt = 'admin-availability-selected-date',
    Pt = 'admin-availability-month-anchor';
function It(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function Ft(t) {
    return [...new Set(t.map(It).filter(Boolean))].sort();
}
function Ht(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? '' : u(n) === e ? e : '';
}
function Ot(t) {
    const e = Ht(t);
    if (!e) return null;
    const n = new Date(`${e}T12:00:00`);
    return Number.isNaN(n.getTime()) ? null : n;
}
function Rt(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((n) => {
                const a = Ht(n);
                if (!a) return;
                const i = Ft(Array.isArray(t[n]) ? t[n] : []);
                i.length && (e[a] = i);
            }),
        e
    );
}
function jt(t) {
    return Rt(t || {});
}
function zt(t) {
    return JSON.stringify(Rt(t || {}));
}
function Vt(t, e = '') {
    let n = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) n = new Date(t);
    else {
        const e = Ht(t);
        e && (n = new Date(`${e}T12:00:00`));
    }
    if (!n) {
        const t = Ot(e);
        n = t ? new Date(t) : new Date();
    }
    return (n.setDate(1), n.setHours(12, 0, 0, 0), n);
}
function Ut(t, e) {
    const n = Ht(t);
    if (n) return n;
    const a = Object.keys(e || {})[0];
    if (a) {
        const t = Ht(a);
        if (t) return t;
    }
    return u(new Date());
}
function Kt() {
    const t = b(),
        e = Ht(t.availability.selectedDate),
        n = Vt(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(xt, e) : localStorage.removeItem(xt),
            localStorage.setItem(Pt, u(n)));
    } catch (t) {}
}
function Qt(t) {
    const e = jt(b().data.availability || {});
    return zt(t) !== zt(e);
}
function Wt() {
    return jt(b().availability.draft || {});
}
function Gt() {
    const t = b().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function Jt() {
    const t = b(),
        e = Ht(t.availability.selectedDate);
    if (e) return e;
    const n = jt(t.availability.draft || {});
    return Object.keys(n)[0] || u(new Date());
}
function Yt(t, e) {
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
function Zt(t = 1) {
    const e = Wt(),
        n = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!n.length) return '';
    const a = Ht(b().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? n.sort() : n.sort().reverse()).find((e) =>
            t >= 0 ? e >= a : e <= a
        ) || ''
    );
}
function Xt() {
    ((function () {
        const t = b(),
            e = Vt(t.availability.monthAnchor, t.availability.selectedDate),
            n = Jt(),
            a = e.getMonth(),
            i = jt(t.availability.draft),
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
                        e = Jt();
                    return {
                        selectedDate: e,
                        slots: Ft(jt(t.availability.draft)[e] || []),
                    };
                })(),
                a = Gt();
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
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${t(Yt([], a))}</p>`
                      ));
        })(),
        (function () {
            const t = b(),
                n = Jt(),
                a = jt(t.availability.draft),
                i = Array.isArray(a[n]) ? Ft(a[n]) : [],
                o = Gt(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: l,
                } = (function () {
                    const t = b().data.availabilityMeta || {},
                        e = Gt();
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
                        const e = Ot(t);
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
            let d = Yt(i, o);
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
        Kt());
}
function te(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? Xt() : Kt());
}
function ee(t, e = {}) {
    const n = jt(t),
        a = Ut(e.selectedDate || b().availability.selectedDate, n);
    te(
        {
            draft: n,
            selectedDate: a,
            monthAnchor: Vt(e.monthAnchor || b().availability.monthAnchor, a),
            draftDirty: Qt(n),
            ...e,
        },
        { render: !0 }
    );
}
function ne(t) {
    te({ lastAction: String(t || '') }, { render: !0 });
}
function ae(t, e, n = '') {
    const a = Ht(t) || Jt();
    if (!a) return;
    const i = Wt(),
        o = Ft(Array.isArray(e) ? e : []);
    (o.length ? (i[a] = o) : delete i[a],
        ee(i, { selectedDate: a, monthAnchor: a, lastAction: n }));
}
function ie(t, e) {
    const n = Ht(t);
    n &&
        te(
            { selectedDate: n, monthAnchor: Vt(n, n), lastAction: e || '' },
            { render: !0 }
        );
}
function oe() {
    return Ht(b().availability.selectedDate) || Jt();
}
function se(t) {
    return It(t);
}
function re(t) {
    if (Gt()) return;
    const e = b(),
        n = oe();
    if (!n) return;
    const a = Array.isArray(e.availability.draft[n])
            ? e.availability.draft[n]
            : [],
        i = (function (t, e) {
            const n = Ot(t);
            return n ? (n.setDate(n.getDate() + Number(e || 0)), u(n)) : '';
        })(n, t);
    i && ae(i, a, `Duplicado ${a.length} slots en ${i}`);
}
function ce() {
    return Boolean(b().availability.draftDirty);
}
function le() {
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
function ue(t) {
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
function de() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function pe(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function me(t) {
    const e = pe(t);
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
function be(t) {
    const e = pe(t);
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
function ge(t) {
    return Array.isArray(t) ? t : [];
}
function fe(t, e = 0) {
    const n = Number(t);
    return Number.isFinite(n) ? n : e;
}
function he(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function ye(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
let ve = '';
function ke(t) {
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
function we(t, e = 0) {
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
        status: me(t?.status || 'waiting'),
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
function Se(t, e = 0, n = {}) {
    const a = t && 'object' == typeof t ? t : {},
        i = we({ ...a, ...n }, e);
    return (
        ye(a.createdAt, a.created_at) || (i.createdAt = ''),
        ye(a.priorityClass, a.priority_class) || (i.priorityClass = ''),
        ye(a.queueType, a.queue_type) || (i.queueType = ''),
        ye(a.patientInitials, a.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function Ce(t, e, n) {
    return (
        t[String(n)] ||
        t[n] ||
        e.find(
            (t) =>
                Number(
                    t?.assignedConsultorio || t?.assigned_consultorio || 0
                ) === n
        ) ||
        null
    );
}
function qe(t, e, n) {
    return t ? Se(t, e, { status: 'called', assignedConsultorio: n }) : null;
}
function Ae(t, e = []) {
    const n = t && 'object' == typeof t ? t : {},
        a = (function (t) {
            return t.counts && 'object' == typeof t.counts ? t.counts : {};
        })(n),
        i = (function (t) {
            return t.callingNowByConsultorio &&
                'object' == typeof t.callingNowByConsultorio
                ? t.callingNowByConsultorio
                : t.calling_now_by_consultorio &&
                    'object' == typeof t.calling_now_by_consultorio
                  ? t.calling_now_by_consultorio
                  : {};
        })(n),
        o = (function (t) {
            return ge(t.callingNow).concat(ge(t.calling_now));
        })(n),
        s = (function (t) {
            const e = ge(t).map((t, e) => we(t, e));
            return {
                normalizedTickets: e,
                waitingFromTickets: e.filter((t) => 'waiting' === t.status)
                    .length,
                calledFromTickets: e.filter((t) => 'called' === t.status)
                    .length,
                completedFromTickets: e.filter((t) => 'completed' === t.status)
                    .length,
                noShowFromTickets: e.filter((t) => 'no_show' === t.status)
                    .length,
                cancelledFromTickets: e.filter((t) => 'cancelled' === t.status)
                    .length,
            };
        })(e),
        { c1: r, c2: c } = (function (t, e) {
            return { c1: qe(Ce(t, e, 1), 0, 1), c2: qe(Ce(t, e, 2), 1, 2) };
        })(i, o),
        l = (function (t) {
            return ge(t.nextTickets)
                .concat(ge(t.next_tickets))
                .map((t, e) =>
                    Se(
                        {
                            ...t,
                            status: t?.status || 'waiting',
                            assignedConsultorio: null,
                        },
                        e
                    )
                );
        })(n),
        u = (function (t, e, n, a, i) {
            const o = Math.max(
                Number(Boolean(i.c1)) + Number(Boolean(i.c2)),
                a.calledFromTickets
            );
            return {
                waitingCount: fe(
                    t.waitingCount ??
                        t.waiting_count ??
                        e.waiting ??
                        n.length ??
                        a.waitingFromTickets,
                    0
                ),
                calledCount: fe(
                    t.calledCount ?? t.called_count ?? e.called ?? o,
                    0
                ),
                completedCount: fe(
                    e.completed ??
                        t.completedCount ??
                        t.completed_count ??
                        a.completedFromTickets,
                    0
                ),
                noShowCount: fe(
                    e.no_show ??
                        e.noShow ??
                        t.noShowCount ??
                        t.no_show_count ??
                        a.noShowFromTickets,
                    0
                ),
                cancelledCount: fe(
                    e.cancelled ??
                        e.canceled ??
                        t.cancelledCount ??
                        t.cancelled_count ??
                        a.cancelledFromTickets,
                    0
                ),
            };
        })(n, a, l, s, { c1: r, c2: c });
    return {
        updatedAt: String(
            n.updatedAt || n.updated_at || new Date().toISOString()
        ),
        waitingCount: u.waitingCount,
        calledCount: u.calledCount,
        counts: {
            waiting: u.waitingCount,
            called: u.calledCount,
            completed: u.completedCount,
            no_show: u.noShowCount,
            cancelled: u.cancelledCount,
        },
        callingNowByConsultorio: { 1: r, 2: c },
        nextTickets: l,
    };
}
function Te(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function _e(t) {
    return t?.counts && 'object' == typeof t.counts ? t.counts : null;
}
function $e(t) {
    const e = we(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${pe(e.ticketCode || '')}`;
}
function Me(t, e) {
    if (!e) return;
    const n = we(e, t.size);
    (ye(e?.createdAt, e?.created_at) || (n.createdAt = ''),
        ye(e?.priorityClass, e?.priority_class) || (n.priorityClass = ''),
        ye(e?.queueType, e?.queue_type) || (n.queueType = ''),
        t.set($e(n), n));
}
function Le(t) {
    const e = Ae(t),
        n = new Map(),
        a =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        i =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (a && Me(n, { ...a, status: 'called', assignedConsultorio: 1 }),
        i && Me(n, { ...i, status: 'called', assignedConsultorio: 2 }));
    for (const t of ge(e.nextTickets))
        Me(n, { ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(n.values());
}
function Ee() {
    const t = b(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => we(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? Ae(t.data.queueMeta, e)
                : ke(e),
    };
}
function Ne() {
    const t = b(),
        { queueTickets: e } = Ee();
    return (function (t, e) {
        const n = pe(e);
        return n
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => pe(t).includes(n)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const n = pe(e);
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
                                        (Date.now() - he(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === pe(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function De(t, e = null) {
    const n = Array.isArray(e) ? e : Ee().queueTickets,
        a = new Set(n.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(ge(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && a.has(t))
        .sort((t, e) => t - e);
}
function Be() {
    return De(b().queue.selected || []);
}
function xe() {
    const t = (function () {
        const t = new Set(Be());
        return t.size
            ? Ee().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : Ne();
}
function Pe(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        Ee().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Ie() {
    const t = b(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        Ee().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Fe(e) {
    const n = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        a = Math.max(0, Math.round((Date.now() - he(e.createdAt)) / 6e4)),
        i = Number(e.id || 0),
        o = new Set(Be()).has(i),
        s = 'called' === e.status,
        r = s && e.assignedConsultorio,
        c = s,
        l = 'operator' === document.body?.dataset.queueSurface,
        u = l
            ? `<span class="queue-row-marker">${t(s ? 'Live' : 'Fila')}</span>`
            : `<label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${i}" ${o ? 'checked' : ''} />\n                </label>`,
        d = l
            ? `\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                `
            : `\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                `;
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                ${u}\n            </td>\n            <td>${t(e.ticketCode)}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (me(t)) {
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
    )}</td>\n            <td>${n}</td>\n            <td>${a} min</td>\n            <td>\n                <div class="table-actions">\n                    ${d}\n                </div>\n            </td>\n        </tr>\n    `;
}
const He = Object.freeze({
        operator: {
            version: '0.1.0',
            updatedAt: '2026-03-10T00:00:00Z',
            webFallbackUrl: '/operador-turnos.html',
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
            targets: {
                android_tv: {
                    url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                    label: 'Android TV APK',
                },
            },
        },
    }),
    Oe = Object.freeze({
        operator: {
            eyebrow: 'Recepción + consultorio',
            title: 'Operador',
            description:
                'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
            recommendedFor: 'PC operador',
            notes: [
                'Conecta aquí el receptor USB 2.4 GHz del numpad.',
                'Usa station=c1|c2, lock=1 y one_tap si el equipo queda fijo por consultorio.',
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
    });
function Re(t) {
    try {
        return new URL(String(t || ''), window.location.origin).toString();
    } catch (e) {
        return String(t || '');
    }
}
function je(e, n, a) {
    const o = Oe[e],
        s =
            'mac' === a
                ? n.targets.mac
                : 'win' === a
                  ? n.targets.win
                  : n.targets.win || n.targets.mac,
        r =
            'mac' === a
                ? 'macOS'
                : 'win' === a
                  ? 'Windows'
                  : (s && s.label) || 'este equipo',
        c = Object.entries(n.targets || {})
            .filter(([t, e]) => e && e.url)
            .map(
                ([e, n]) =>
                    `\n                <a\n                    href="${t(n.url)}"\n                    class="${e === a ? 'queue-app-card__recommended' : ''}"\n                    download\n                >\n                    ${t(n.label || e)}\n                </a>\n            `
            )
            .join('');
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${t(o.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${t(o.title)}</h5>\n                <p class="queue-app-card__description">${t(o.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${t(n.version || '0.1.0')} · ${t(i(n.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${t(o.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                ${s && s.url ? `<a href="${t(s.url)}" class="queue-app-card__cta-primary" download>Descargar para ${t(r)}</a>` : ''}\n            </div>\n            <div class="queue-app-card__targets">${c}</div>\n            <div class="queue-app-card__links">\n                <a href="${t(n.webFallbackUrl || '/')}">Abrir versión web</a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${t(Re((s && s.url) || ''))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${o.notes.map((e) => `<li>${t(e)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function ze(e) {
    const n = Oe.sala_tv,
        a = e.targets.android_tv || {},
        o = String(a.url || ''),
        s = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(Re(o))}`;
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${t(n.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${t(n.title)}</h5>\n                <p class="queue-app-card__description">${t(n.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${t(e.version || '0.1.0')} · ${t(i(e.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${t(n.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                <a\n                    href="${t(s)}"\n                    class="queue-app-card__cta-primary"\n                    target="_blank"\n                    rel="noopener"\n                >\n                    Mostrar QR de instalación\n                </a>\n                <a href="${t(o)}" download>Descargar APK</a>\n            </div>\n            <div class="queue-app-card__links">\n                <a href="${t(e.webFallbackUrl || '/sala-turnos.html')}">\n                    Abrir fallback web\n                </a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${t(Re(o))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${n.notes.map((e) => `<li>${t(e)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function Ve(e = () => {}) {
    const n = b(),
        { queueMeta: a } = Ee(),
        i = Ne(),
        o = Be(),
        s = xe(),
        l = Pe(n.queue.stationConsultorio);
    ((function () {
        if (
            !(
                document.getElementById('queueAppDownloadsCards') instanceof
                HTMLElement
            )
        )
            return;
        const t = (function () {
                const t =
                    `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
                return t.includes('mac')
                    ? 'mac'
                    : t.includes('win')
                      ? 'win'
                      : 'other';
            })(),
            e = document.getElementById('queueAppsPlatformChip');
        (r(
            '#queueAppsPlatformChip',
            'mac' === t
                ? 'macOS detectado'
                : 'win' === t
                  ? 'Windows detectado'
                  : 'Selecciona la plataforma del equipo'
        ),
            e instanceof HTMLElement && e.setAttribute('data-platform', t));
        const n = (function () {
            const t = b().data.appDownloads;
            return t && 'object' == typeof t
                ? {
                      operator: {
                          ...He.operator,
                          ...(t.operator || {}),
                          targets: {
                              ...He.operator.targets,
                              ...((t.operator && t.operator.targets) || {}),
                          },
                      },
                      kiosk: {
                          ...He.kiosk,
                          ...(t.kiosk || {}),
                          targets: {
                              ...He.kiosk.targets,
                              ...((t.kiosk && t.kiosk.targets) || {}),
                          },
                      },
                      sala_tv: {
                          ...He.sala_tv,
                          ...(t.sala_tv || {}),
                          targets: {
                              ...He.sala_tv.targets,
                              ...((t.sala_tv && t.sala_tv.targets) || {}),
                          },
                      },
                  }
                : He;
        })();
        c(
            '#queueAppDownloadsCards',
            [
                je('operator', n.operator, t),
                je('kiosk', n.kiosk, t),
                ze(n.sala_tv),
            ].join('')
        );
    })(),
        (function (t, e) {
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
            if ('fallback' === pe(n.queue.syncMode))
                return (
                    r('#queueSyncStatus', 'fallback'),
                    void (u && u.setAttribute('data-state', 'fallback'))
                );
            const d = String(t.updatedAt || '').trim();
            if (!d) return;
            const p = Math.max(0, Math.round((Date.now() - he(d)) / 1e3)),
                m = p >= 60;
            if (
                (r('#queueSyncStatus', m ? `Watchdog (${p}s)` : 'vivo'),
                u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
                m)
            ) {
                const t = `stale-${Math.floor(p / 15)}`;
                return void (
                    t !== ve &&
                    ((ve = t), e('Watchdog de cola: realtime en reconnecting'))
                );
            }
            ve = 'live';
        })(a, e),
        (function (t) {
            c(
                '#queueTableBody',
                t.length
                    ? t.map(Fe).join('')
                    : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
            );
        })(i),
        (function (e, n) {
            const a = ge(e.nextTickets),
                i = Number(e.waitingCount || e.counts?.waiting || 0),
                o =
                    n && a.length && i > a.length
                        ? `<li><span>-</span><strong>Mostrando primeros ${a.length} de ${i} en espera</strong></li>`
                        : '';
            c(
                '#queueNextAdminList',
                a.length
                    ? `${o}${a.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
                    : '<li><span>-</span><strong>Sin siguientes</strong></li>'
            );
        })(a, n.queue.fallbackPartial),
        (function ({
            state: t,
            visible: e,
            selectedCount: n,
            activeStationTicket: a,
        }) {
            const i = (function (t) {
                    return t.filter(
                        (t) =>
                            'waiting' === t.status &&
                            (Math.max(
                                0,
                                Math.round((Date.now() - he(t.createdAt)) / 6e4)
                            ) >= 20 ||
                                'appt_overdue' === pe(t.priorityClass))
                    ).length;
                })(e),
                o = [i > 0 ? `riesgo: ${i}` : 'sin riesgo'];
            (n > 0 && o.push(`seleccion: ${n}`),
                t.queue.fallbackPartial && o.push('fallback parcial'),
                a &&
                    o.push(
                        `activo: ${a.ticketCode} en C${t.queue.stationConsultorio}`
                    ),
                r('#queueTriageSummary', o.join(' | ')));
        })({
            state: n,
            visible: i,
            selectedCount: o.length,
            activeStationTicket: l,
        }),
        (function ({ visibleCount: t, selectedCount: e, bulkTargetCount: n }) {
            r('#queueSelectedCount', e);
            const a = document.getElementById('queueSelectionChip');
            a instanceof HTMLElement &&
                a.classList.toggle('is-hidden', 0 === e);
            const i = document.getElementById('queueSelectVisibleBtn');
            i instanceof HTMLButtonElement && (i.disabled = 0 === t);
            const o = document.getElementById('queueClearSelectionBtn');
            (o instanceof HTMLButtonElement && (o.disabled = 0 === e),
                document
                    .querySelectorAll(
                        '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
                    )
                    .forEach((t) => {
                        t instanceof HTMLButtonElement &&
                            (t.disabled = 0 === n);
                    }));
        })({
            visibleCount: i.length,
            selectedCount: o.length,
            bulkTargetCount: s.length,
        }),
        (function (t, e) {
            (r('#queueStationBadge', `Estación C${t.queue.stationConsultorio}`),
                r(
                    '#queueStationModeBadge',
                    'locked' === t.queue.stationMode ? 'Bloqueado' : 'Libre'
                ),
                document
                    .querySelectorAll(
                        '[data-action="queue-call-next"][data-queue-consultorio]'
                    )
                    .forEach((e) => {
                        if (!(e instanceof HTMLButtonElement)) return;
                        const n =
                            2 === Number(e.dataset.queueConsultorio || 1)
                                ? 2
                                : 1;
                        e.disabled =
                            'locked' === t.queue.stationMode &&
                            n !== Number(t.queue.stationConsultorio || 1);
                    }),
                document
                    .querySelectorAll(
                        '[data-action="queue-release-station"][data-queue-consultorio]'
                    )
                    .forEach((n) => {
                        if (!(n instanceof HTMLButtonElement)) return;
                        const a =
                                2 === Number(n.dataset.queueConsultorio || 1)
                                    ? 2
                                    : 1,
                            i =
                                a === Number(t.queue.stationConsultorio || 1)
                                    ? e
                                    : Pe(a);
                        ((n.disabled = !i),
                            'locked' === t.queue.stationMode &&
                                a !== Number(t.queue.stationConsultorio || 1) &&
                                (n.disabled = !0));
                    }));
        })(n, l),
        (function (t) {
            const e = document.getElementById('queuePracticeModeBadge');
            e instanceof HTMLElement && (e.hidden = !t.queue.practiceMode);
            const n = document.getElementById('queueShortcutPanel');
            n instanceof HTMLElement && (n.hidden = !t.queue.helpOpen);
            const a = document.querySelector(
                '[data-action="queue-clear-call-key"]'
            );
            a instanceof HTMLElement && (a.hidden = !t.queue.customCallKey);
            const i = document.querySelector(
                '[data-action="queue-toggle-one-tap"]'
            );
            i instanceof HTMLElement &&
                (i.setAttribute(
                    'aria-pressed',
                    String(Boolean(t.queue.oneTap))
                ),
                (i.textContent = t.queue.oneTap
                    ? '1 tecla ON'
                    : '1 tecla OFF'));
        })(n),
        le());
}
function Ue(t) {
    g((e) => {
        const n = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: n } };
    });
    try {
        le();
    } catch (t) {}
}
function Ke(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: De(t, e.data.queueTickets || []) },
    })),
        e && Ve(Ue));
}
function Qe() {
    Ke([]);
}
function We(t, e = '') {
    try {
        const n = localStorage.getItem(t);
        return null === n ? e : n;
    } catch (t) {
        return e;
    }
}
function Ge(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function Je(t, e) {
    try {
        const n = localStorage.getItem(t);
        return n ? JSON.parse(n) : e;
    } catch (t) {
        return e;
    }
}
function Ye(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function Ze(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const Xe = 'queueStationMode',
    tn = 'queueStationConsultorio',
    en = 'queueOneTapAdvance',
    nn = 'queueCallKeyBindingV1',
    an = 'queueNumpadHelpOpen',
    on = 'queueAdminLastSnapshot',
    sn = new Map([
        [1, !1],
        [2, !1],
    ]),
    rn = new Set(['no_show', 'cancelar']);
function cn(t) {
    (Ge(Xe, t.queue.stationMode || 'free'),
        Ge(tn, t.queue.stationConsultorio || 1),
        Ge(en, t.queue.oneTap ? '1' : '0'),
        Ge(an, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? Ye(nn, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(nn),
        Ye(on, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function ln(t, e = null, n = {}) {
    const a = (Array.isArray(t) ? t : []).map((t, e) => we(t, e)),
        i = Ae(e && 'object' == typeof e ? e : ke(a), a),
        o = a.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof n.fallbackPartial
                ? n.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === pe(n.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === pe(n.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: a, queueMeta: i },
        queue: {
            ...t.queue,
            selected: De(t.queue.selected || [], a),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        cn(b()),
        Ve(Ue));
}
function un(t, e) {
    const n = Number(t || 0),
        a = (b().data.queueTickets || []).map((t, a) => {
            const i = we(t, a);
            return i.id !== n
                ? i
                : we('function' == typeof e ? e(i) : { ...i }, a);
        });
    ln(a, ke(a), { fallbackPartial: !1, syncMode: 'live' });
}
function dn(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), cn(b()), Ve(Ue));
}
function pn(t) {
    dn({ filter: pe(t) || 'all', selected: [] });
}
function mn(t, e) {
    const n = ye(e.createdAt, e.created_at, t?.createdAt, t?.created_at),
        a = ye(
            e.priorityClass,
            e.priority_class,
            t?.priorityClass,
            t?.priority_class,
            'walk_in'
        ),
        i = ye(
            e.queueType,
            e.queue_type,
            t?.queueType,
            t?.queue_type,
            'walk_in'
        ),
        o = ye(
            e.patientInitials,
            e.patient_initials,
            t?.patientInitials,
            t?.patient_initials,
            '--'
        );
    return {
        ...(t || {}),
        ...e,
        status: e.status,
        assignedConsultorio: e.assignedConsultorio,
        createdAt: n || new Date().toISOString(),
        priorityClass: a,
        queueType: i,
        patientInitials: o,
    };
}
function bn(t, e = {}) {
    const { queueState: n, payloadTicket: a } = (function (t) {
        const e =
                t?.data?.queueState ||
                t?.data?.queue_state ||
                t?.data?.queueMeta ||
                t?.data ||
                null,
            n =
                e && 'object' == typeof e
                    ? (function (t) {
                          return t && 'object' == typeof t
                              ? Array.isArray(t.queue_tickets)
                                  ? t.queue_tickets
                                  : Array.isArray(t.queueTickets)
                                    ? t.queueTickets
                                    : Array.isArray(t.tickets)
                                      ? t.tickets
                                      : []
                              : [];
                      })(e)
                    : [];
        return {
            queueState:
                e && 'object' == typeof e ? { ...e, __fullTickets: n } : e,
            payloadTicket: t?.data?.ticket || null,
        };
    })(t);
    if (!n || 'object' != typeof n) return;
    const i = (b().data.queueTickets || []).map((t, e) => we(t, e)),
        o = n.__fullTickets || [];
    if (
        !(function (t, e, n) {
            return (
                e.length > 0 ||
                !!(
                    Te(t, 'queue_tickets') ||
                    Te(t, 'queueTickets') ||
                    Te(t, 'tickets')
                ) ||
                !(!n || 'object' != typeof n) ||
                !!(function (t) {
                    return (
                        Te(t, 'waitingCount') ||
                        Te(t, 'waiting_count') ||
                        Te(t, 'calledCount') ||
                        Te(t, 'called_count') ||
                        Te(t, 'completedCount') ||
                        Te(t, 'completed_count') ||
                        Te(t, 'noShowCount') ||
                        Te(t, 'no_show_count') ||
                        Te(t, 'cancelledCount') ||
                        Te(t, 'cancelled_count')
                    );
                })(t) ||
                !!(function (t) {
                    const e = _e(t);
                    return Boolean(
                        e &&
                        (Te(e, 'waiting') ||
                            Te(e, 'called') ||
                            Te(e, 'completed') ||
                            Te(e, 'no_show') ||
                            Te(e, 'noShow') ||
                            Te(e, 'cancelled') ||
                            Te(e, 'canceled'))
                    );
                })(t) ||
                !(!Te(t, 'nextTickets') && !Te(t, 'next_tickets')) ||
                (function (t) {
                    const e = (function (t) {
                        return t?.callingNowByConsultorio &&
                            'object' == typeof t.callingNowByConsultorio
                            ? t.callingNowByConsultorio
                            : t?.calling_now_by_consultorio &&
                                'object' == typeof t.calling_now_by_consultorio
                              ? t.calling_now_by_consultorio
                              : null;
                    })(t);
                    return (
                        !(
                            !e ||
                            !(
                                Boolean(e[1]) ||
                                Boolean(e[2]) ||
                                Boolean(e[1]) ||
                                Boolean(e[2])
                            )
                        ) ||
                        ge(t?.callingNow)
                            .concat(ge(t?.calling_now))
                            .some(Boolean)
                    );
                })(t)
            );
        })(n, o, a)
    )
        return;
    const s = 'fallback' === pe(e.syncMode) ? 'fallback' : 'live',
        r = Ae(n, i),
        c = (function (t) {
            const e = _e(t),
                n =
                    Te(t, 'waitingCount') ||
                    Te(t, 'waiting_count') ||
                    Boolean(e && Te(e, 'waiting')),
                a =
                    Te(t, 'calledCount') ||
                    Te(t, 'called_count') ||
                    Boolean(e && Te(e, 'called')),
                i = Te(t, 'nextTickets') || Te(t, 'next_tickets'),
                o =
                    Te(t, 'callingNowByConsultorio') ||
                    Te(t, 'calling_now_by_consultorio') ||
                    Te(t, 'callingNow') ||
                    Te(t, 'calling_now');
            return { waiting: n || i, called: a || o };
        })(n),
        l = Le(r),
        u = Boolean(a && 'object' == typeof a);
    if (!(o.length || l.length || u || c.waiting || c.called)) return;
    const d =
        Number(r.waitingCount || 0) >
        l.filter((t) => 'waiting' === t.status).length;
    if (o.length) return void ln(o, r, { fallbackPartial: !1, syncMode: s });
    const p = new Map(i.map((t) => [$e(t), t]));
    ((function (t, e, n) {
        const a = e.callingNowByConsultorio || {},
            i = Number(e.calledCount || e.counts?.called || 0),
            o = Number(e.waitingCount || e.counts?.waiting || 0),
            s = ge(e.nextTickets),
            r = (function (t) {
                const e = new Set(),
                    n = t[1] || t[1] || null,
                    a = t[2] || t[2] || null;
                return (n && e.add($e(n)), a && e.add($e(a)), e);
            })(a),
            c = new Set(s.map((t) => $e(t))),
            l = r.size > 0 || 0 === i,
            u = c.size > 0 || 0 === o,
            d = c.size > 0 && o > c.size;
        for (const [e, a] of t.entries()) {
            const i = we(a, 0);
            n.called && l && 'called' === i.status && !r.has(e)
                ? t.set(
                      e,
                      we(
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
                  u &&
                  'waiting' === i.status &&
                  (o <= 0 ? t.delete(e) : d || c.has(e) || t.delete(e));
        }
    })(p, r, c),
        ln(
            (function (t, e, n) {
                for (const n of e) {
                    const e = $e(n),
                        a = t.get(e) || null;
                    t.set(e, we(mn(a, n), t.size));
                }
                if (n && 'object' == typeof n) {
                    const e = $e(we(n, t.size)),
                        a = t.get(e) || null;
                    t.set(
                        e,
                        we(
                            (function (t, e) {
                                return { ...(t || {}), ...we(e, 0) };
                            })(a, n),
                            t.size
                        )
                    );
                }
                return Array.from(t.values());
            })(p, l, a),
            r,
            { fallbackPartial: d, syncMode: s }
        ));
}
function gn() {
    return Je(on, null);
}
function fn(t, e = '') {
    return (
        !!t?.queueTickets?.length &&
        (ln(t.queueTickets, t.queueMeta || null, {
            fallbackPartial: !0,
            syncMode: 'fallback',
        }),
        e && Ue(e),
        !0)
    );
}
async function hn() {
    try {
        (bn(await C('queue-state'), { syncMode: 'live' }),
            Ue('Queue refresh realizado'));
    } catch (t) {
        (Ue('Queue refresh con error'), fn(gn()));
    }
}
function yn(t, e, n = void 0) {
    un(t, (t) => ({
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
async function vn({ ticketId: t, action: e, consultorio: n }) {
    const a = Number(t || 0),
        i = be(e);
    if (a && i)
        return b().queue.practiceMode
            ? ((function (t, e, n) {
                  'reasignar' !== e && 're-llamar' !== e
                      ? 'liberar' !== e
                          ? 'completar' !== e
                              ? 'no_show' !== e
                                  ? 'cancelar' === e && yn(t, 'cancelled')
                                  : yn(t, 'no_show')
                              : yn(t, 'completed')
                          : yn(t, 'waiting', null)
                      : yn(t, 'called', 2 === Number(n || 1) ? 2 : 1);
              })(a, i, n),
              void Ue(`Practica: accion ${i} en ticket ${a}`))
            : (bn(
                  await C('queue-ticket', {
                      method: 'PATCH',
                      body: { id: a, action: i, consultorio: Number(n || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void Ue(`Accion ${i} ticket ${a}`));
}
async function kn(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        n = b();
    if (!sn.get(e)) {
        if (
            'locked' === n.queue.stationMode &&
            n.queue.stationConsultorio !== e
        )
            return (
                Ue(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (n.queue.practiceMode) {
            const t = (function (t) {
                return (
                    Ee().queueTickets.find(
                        (e) =>
                            'waiting' === e.status &&
                            (!e.assignedConsultorio ||
                                e.assignedConsultorio === t)
                    ) || null
                );
            })(e);
            return t
                ? ((function (t, e) {
                      un(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void Ue(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void Ue('Practica: sin tickets en espera');
        }
        sn.set(e, !0);
        try {
            (bn(
                await C('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                Ue(`Llamado C${e} ejecutado`));
        } catch (t) {
            (Ue(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            sn.set(e, !1);
        }
    }
}
async function wn(t, e, n = 0) {
    const a = {
            ticketId: Number(t || 0),
            action: be(e),
            consultorio: Number(n || 0),
        },
        i = b(),
        o = (function (t) {
            const e = Number(t || 0);
            return (
                (e && Ee().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(a.ticketId);
    if (
        !i.queue.practiceMode &&
        rn.has(a.action) &&
        (function (t, e) {
            const n = be(t);
            return (
                'cancelar' === n ||
                ('no_show' === n &&
                    (!e ||
                        'called' === me(e.status) ||
                        Number(e.assignedConsultorio || 0) > 0))
            );
        })(a.action, o)
    )
        return (ue(a), void Ue(`Accion ${a.action} pendiente de confirmacion`));
    await vn(a);
}
async function Sn() {
    const t = b().queue.pendingSensitiveAction;
    t ? (de(), await vn(t)) : de();
}
function Cn() {
    (de(), Ue('Accion sensible cancelada'));
}
function qn() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (Cn(), 0)
    );
}
async function An(t) {
    const e = Number(t || 0);
    e &&
        (b().queue.practiceMode
            ? Ue(`Practica: reprint ticket ${e}`)
            : (await C('queue-reprint', { method: 'POST', body: { id: e } }),
              Ue(`Reimpresion ticket ${e}`)));
}
function Tn() {
    dn({ helpOpen: !b().queue.helpOpen });
}
function _n(t) {
    const e = Boolean(t);
    (dn({ practiceMode: e, pendingSensitiveAction: null }),
        Ue(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function $n(t) {
    const e = Ie();
    return (
        !!e &&
        (ue({
            ticketId: e.id,
            action: 'completar',
            consultorio: t.queue.stationConsultorio,
        }),
        !0)
    );
}
async function Mn(t) {
    const e = b();
    if (e.queue.captureCallKeyMode)
        return void (function (t) {
            const e = {
                key: String(t.key || ''),
                code: String(t.code || ''),
                location: Number(t.location || 0),
            };
            (dn({ customCallKey: e, captureCallKeyMode: !1 }),
                s('Tecla externa guardada', 'success'),
                Ue(`Tecla externa calibrada: ${e.code}`));
        })(t);
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                pe(e.code) === pe(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await kn(e.queue.stationConsultorio));
    const n = pe(t.code),
        a = pe(t.key),
        i = (function (t, e, n) {
            return (
                'numpadenter' === e ||
                'kpenter' === e ||
                ('enter' === n && 3 === Number(t.location || 0))
            );
        })(t, n, a);
    if (i && e.queue.pendingSensitiveAction) return void (await Sn());
    const o = (function (t, e) {
        return 'numpad2' === t || '2' === e
            ? 2
            : 'numpad1' === t || '1' === e
              ? 1
              : 0;
    })(n, a);
    if (!o)
        return i
            ? (e.queue.oneTap && $n(e) && (await Sn()),
              void (await kn(e.queue.stationConsultorio)))
            : void ((function (t, e) {
                  return (
                      'numpaddecimal' === t ||
                      'kpdecimal' === t ||
                      'decimal' === e ||
                      ',' === e ||
                      '.' === e
                  );
              })(n, a)
                  ? $n(e)
                  : (function (t, e) {
                          return (
                              'numpadsubtract' === t ||
                              'kpsubtract' === t ||
                              '-' === e
                          );
                      })(n, a)
                    ? (function (t) {
                          const e = Ie();
                          e &&
                              ue({
                                  ticketId: e.id,
                                  action: 'no_show',
                                  consultorio: t.queue.stationConsultorio,
                              });
                      })(e)
                    : (function (t, e) {
                          return (
                              'numpadadd' === t || 'kpadd' === t || '+' === e
                          );
                      })(n, a) &&
                      (await (async function (t) {
                          const e = Ie();
                          e &&
                              (await wn(
                                  e.id,
                                  're-llamar',
                                  t.queue.stationConsultorio
                              ),
                              Ue(`Re-llamar ${e.ticketCode}`),
                              s(`Re-llamar ${e.ticketCode}`, 'info'));
                      })(e)));
    !(function (t, e) {
        (function (t, e) {
            return (
                'locked' === e.queue.stationMode &&
                e.queue.stationConsultorio !== t
            );
        })(t, e)
            ? (s('Cambio bloqueado por modo estación', 'warning'),
              Ue('Cambio de estación bloqueado por lock'))
            : (dn({ stationConsultorio: t }), Ue(`Numpad: estacion C${t}`));
    })(o, e);
}
function Ln(t, e) {
    return 'c2' === t || '2' === t ? 2 : 'c1' === t || '1' === t ? 1 : e;
}
function En(t, e) {
    return '1' === t || 'true' === t ? 'locked' : e;
}
function Nn(t, e) {
    return '1' === t || 'true' === t || ('0' !== t && 'false' !== t && e);
}
const Dn = 'appointments',
    Bn = 'callbacks',
    xn = 'reviews',
    Pn = 'availability',
    In = 'availability-meta',
    Fn = 'queue-tickets',
    Hn = 'queue-meta',
    On = 'app-downloads',
    Rn = 'health-status',
    jn = {
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
function zn() {
    return {
        appointments: Je(Dn, []),
        callbacks: Je(Bn, []),
        reviews: Je(xn, []),
        availability: Je(Pn, {}),
        availabilityMeta: Je(In, {}),
        queueTickets: Je(Fn, []),
        queueMeta: Je(Hn, null),
        appDownloads: Je(On, null),
        health: Je(Rn, null),
        funnelMetrics: jn,
    };
}
function Vn(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function Un(t) {
    g((e) => {
        const n = (function (t, e) {
            return {
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
                appDownloads: t.appDownloads || null,
                funnelMetrics: t.funnelMetrics || e,
                health: t.health || null,
            };
            var n;
        })(t, e.data.funnelMetrics);
        return {
            ...e,
            data: { ...e.data, ...n },
            ui: { ...e.ui, lastRefreshAt: Date.now() },
        };
    });
}
async function Kn(t) {
    if (t.funnelMetrics) return t.funnelMetrics;
    const e = await C('funnel-metrics').catch(() => null);
    return e?.data || null;
}
function Qn(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Wn(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function Gn(t) {
    return Wn(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function Jn(t) {
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
function Yn(e, n, a) {
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
function Zn(e, n, a, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(i)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(a)}</small>\n            </div>\n            <strong>${t(String(n))}</strong>\n        </li>\n    `;
}
function Xn(e, n, a) {
    return `\n        <button type="button" class="operations-action-item" data-action="${t(e)}">\n            <span>${t(n)}</span>\n            <small>${t(a)}</small>\n        </button>\n    `;
}
function ta(t) {
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
                })(Gn(t))
            ).length;
        })(e),
        r = (function (t) {
            return t.filter((t) => {
                const e = Qn(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(e),
        c = (function (t) {
            return t.filter((t) => 'pending' === Qn(t.status)).length;
        })(a),
        l = (function (t) {
            return t.filter((t) => {
                if ('pending' !== Qn(t.status)) return !1;
                const e = (function (t) {
                    return Wn(t?.fecha || t?.createdAt || '');
                })(t);
                return !!e && Math.round((Date.now() - e) / 6e4) >= 120;
            }).length;
        })(a),
        u = (function (t) {
            return t.filter((t) => 'no_show' === Qn(t.status)).length;
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
                const a = Wn(t.date || t.createdAt || '');
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
                .map((t) => ({ item: t, stamp: Gn(t) }))
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
function ea(t) {
    const e = ta(t);
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
                              ? `La siguiente cita es ${a.item.name || 'sin nombre'} ${Jn(a.stamp).toLowerCase()}.`
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
                        ? `${Jn(n.stamp)} | ${n.item.name || 'Paciente'}`
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
                        ? `Siguiente hito: ${n.item.name || 'Paciente'} ${Jn(n.stamp).toLowerCase()}`
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
                    Xn(
                        'context-open-appointments-transfer',
                        e > 0
                            ? 'Validar transferencias'
                            : 'Abrir agenda clinica',
                        e > 0
                            ? `${e} comprobante(s) por revisar`
                            : `${i.length} cita(s) en el corte`
                    ),
                    Xn(
                        'context-open-callbacks-pending',
                        n > 0
                            ? 'Resolver callbacks urgentes'
                            : 'Abrir callbacks',
                        n > 0
                            ? `${n} caso(s) fuera de SLA`
                            : `${a} callback(s) pendientes`
                    ),
                    Xn(
                        'refresh-admin-data',
                        'Actualizar tablero',
                        o?.item
                            ? `Proxima cita ${Jn(o.stamp).toLowerCase()}`
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
                    Zn(
                        'Transferencias',
                        n,
                        n > 0
                            ? 'Pago detenido antes de confirmar.'
                            : 'Sin comprobantes pendientes.',
                        n > 0 ? 'warning' : 'success'
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
                        a,
                        a > 0
                            ? `${a} ingreso(s) en la jornada.`
                            : 'No hay citas hoy.',
                        a > 6 ? 'warning' : 'neutral'
                    ),
                    Zn(
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
                    Yn(t.checkoutEntryBreakdown, 'entry', 'count')
                ),
                c(
                    '#funnelSourceList',
                    Yn(t.sourceBreakdown, 'source', 'count')
                ),
                c(
                    '#funnelPaymentMethodList',
                    Yn(t.paymentMethodBreakdown, 'method', 'count')
                ),
                c(
                    '#funnelAbandonList',
                    Yn(t.checkoutAbandonByStep, 'step', 'count')
                ),
                c(
                    '#funnelAbandonReasonList',
                    Yn(t.abandonReasonBreakdown, 'reason', 'count')
                ),
                c(
                    '#funnelStepList',
                    Yn(t.bookingStepBreakdown, 'step', 'count')
                ),
                c(
                    '#funnelErrorCodeList',
                    Yn(t.errorCodeBreakdown, 'code', 'count')
                ));
        })(e.funnel));
}
function na(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function aa(t) {
    const e = new Date(t?.date || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function ia(t) {
    return `${Math.max(0, Math.min(5, Math.round(Number(t || 0))))}/5`;
}
function oa(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function sa(t, e = 220) {
    const n = String(t || '').trim();
    return n
        ? n.length <= e
            ? n
            : `${n.slice(0, e - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function ra() {
    const e = b(),
        n = Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
        a = (function (t) {
            return t.slice().sort((t, e) => aa(e) - aa(t));
        })(n),
        o = (function (t) {
            return t.length
                ? t.reduce((t, e) => t + Number(e.rating || 0), 0) / t.length
                : 0;
        })(n),
        s = (function (t, e = 30) {
            const n = Date.now();
            return t.filter((t) => {
                const a = aa(t);
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
                  return `\n        <article class="reviews-spotlight-card">\n            <div class="reviews-spotlight-top">\n                <span class="review-avatar">${t(oa(n.name || 'Anonimo'))}</span>\n                <div>\n                    <small>${t(e.eyebrow)}</small>\n                    <strong>${t(n.name || 'Anonimo')}</strong>\n                    <small>${t(i(n.date || n.createdAt || ''))}</small>\n                </div>\n            </div>\n            <p class="reviews-spotlight-stars">${t(ia(n.rating))}</p>\n            <p>${t(sa(n.comment || n.review || '', 320))}</p>\n            <small>${t(e.summary)}</small>\n        </article>\n    `;
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
                            return `\n        <article class="review-card${n ? ' is-featured' : ''}" data-rating="${t(String(a))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${t(oa(e.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(e.name || 'Anonimo')}</strong>\n                        <small>${t(i(e.date || e.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${t(o)}">${t(ia(a))}</span>\n            </header>\n            <p>${t(sa(e.comment || e.review || ''))}</p>\n            <small>${t(s)}</small>\n        </article>\n    `;
                        })(e, {
                            featured:
                                n.item &&
                                na(e.name) === na(n.item.name) &&
                                aa(e) === aa(n.item),
                        })
                    )
                    .join('');
            })(a, u)
        ));
}
function ca() {
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
async function la(t = !1) {
    const e = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    C('data'),
                    C('health').catch(() => null),
                ]),
                n = t.data || {},
                a = zn(),
                i = (function (t, e, n) {
                    return {
                        appointments: Array.isArray(t.appointments)
                            ? t.appointments
                            : [],
                        callbacks: Array.isArray(t.callbacks)
                            ? t.callbacks
                            : [],
                        reviews: Array.isArray(t.reviews) ? t.reviews : [],
                        availability:
                            t.availability && 'object' == typeof t.availability
                                ? t.availability
                                : {},
                        availabilityMeta:
                            t.availabilityMeta &&
                            'object' == typeof t.availabilityMeta
                                ? t.availabilityMeta
                                : {},
                        queueTickets: Vn(t),
                        queueMeta:
                            t.queueMeta && 'object' == typeof t.queueMeta
                                ? t.queueMeta
                                : t.queue_state &&
                                    'object' == typeof t.queue_state
                                  ? t.queue_state
                                  : null,
                        appDownloads:
                            t.appDownloads && 'object' == typeof t.appDownloads
                                ? t.appDownloads
                                : n?.appDownloads || null,
                        funnelMetrics:
                            t.funnelMetrics || n?.funnelMetrics || null,
                        health: e && e.ok ? e : null,
                    };
                })({ ...n, funnelMetrics: await Kn(n) }, e, a);
            return (
                Un(i),
                (function (t) {
                    (Ye(Dn, t.appointments || []),
                        Ye(Bn, t.callbacks || []),
                        Ye(xn, t.reviews || []),
                        Ye(Pn, t.availability || {}),
                        Ye(In, t.availabilityMeta || {}),
                        Ye(Fn, t.queueTickets || []),
                        Ye(Hn, t.queueMeta || null),
                        Ye(On, t.appDownloads || null),
                        Ye(Rn, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (Un(zn()), !1);
        }
    })();
    return (
        (function () {
            const t = b(),
                e = jt(t.data.availability || {}),
                n = Ut(t.availability.selectedDate, e);
            (te({
                draft: e,
                selectedDate: n,
                monthAnchor: Vt(t.availability.monthAnchor, n),
                draftDirty: !1,
                lastAction: '',
            }),
                Xt());
        })(),
        await (async function () {
            const t = Array.isArray(b().data.queueTickets)
                    ? b().data.queueTickets.map((t, e) => we(t, e))
                    : [],
                e = (function (t) {
                    return b().data.queueMeta &&
                        'object' == typeof b().data.queueMeta
                        ? Ae(b().data.queueMeta, t)
                        : null;
                })(t);
            t.length
                ? ln(t, e || null, { fallbackPartial: !1, syncMode: 'live' })
                : (function (t) {
                      const e = t ? Le(t) : [];
                      return (
                          !!e.length &&
                          (ln(e, t, {
                              fallbackPartial: !0,
                              syncMode: 'fallback',
                          }),
                          Ue('Queue fallback parcial desde metadata'),
                          !0)
                      );
                  })(e) ||
                  (await hn(),
                  (b().data.queueTickets || []).length ||
                      fn(gn(), 'Queue fallback desde snapshot local') ||
                      ln([], null, { fallbackPartial: !1, syncMode: 'live' }));
        })(),
        j(b()),
        ea(b()),
        ut(),
        Et(),
        ra(),
        Xt(),
        Ve(),
        ca(),
        t &&
            s(
                e ? 'Datos actualizados' : 'Datos cargados desde cache local',
                e ? 'success' : 'warning'
            ),
        e
    );
}
function ua() {
    (I(!1),
        O(),
        H(!1),
        F({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function da(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        n = document.getElementById('admin2FACode'),
        a = e instanceof HTMLInputElement ? e.value : '',
        i = n instanceof HTMLInputElement ? n.value : '';
    try {
        H(!0);
        const t = b();
        if (
            (F({
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
                const n = await q('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    a = String(n.csrfToken || '');
                return (
                    S(a),
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
                const n = await q('login', {
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
                    S(a),
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
                    I(!0),
                    F({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void R('2fa')
                );
        }
        (F({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            D(),
            x(),
            I(!1),
            O({ clearPassword: !0 }),
            await la(!1),
            s('Sesion iniciada', 'success'));
    } catch (t) {
        (F({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            R(b().auth.requires2FA ? '2fa' : 'password'),
            s(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        H(!1);
    }
}
async function pa(t, e) {
    switch (t) {
        case 'appointment-quick-filter':
            return (pt(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-appointment-filters':
            return (dt({ filter: 'all', search: '' }), !0);
        case 'appointment-density':
            return (
                dt({
                    density:
                        'compact' ===
                        G(String(e.dataset.density || 'comfortable'))
                            ? 'compact'
                            : W,
                }),
                !0
            );
        case 'approve-transfer':
            return (
                await (async function (t) {
                    (await gt(t, { paymentStatus: 'paid' }),
                        bt(t, { paymentStatus: 'paid' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia aprobada', 'success'),
                !0
            );
        case 'reject-transfer':
            return (
                await (async function (t) {
                    (await gt(t, { paymentStatus: 'failed' }),
                        bt(t, { paymentStatus: 'failed' }));
                })(Number(e.dataset.id || 0)),
                s('Transferencia rechazada', 'warning'),
                !0
            );
        case 'mark-no-show':
            return (
                await (async function (t) {
                    (await gt(t, { status: 'no_show' }),
                        bt(t, { status: 'no_show' }));
                })(Number(e.dataset.id || 0)),
                s('Marcado como no show', 'warning'),
                !0
            );
        case 'cancel-appointment':
            return (
                await (async function (t) {
                    (await gt(t, { status: 'cancelled' }),
                        bt(t, { status: 'cancelled' }));
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
async function ma(t, n) {
    switch (t) {
        case 'change-month':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!Number.isFinite(e) || 0 === e) return;
                    const n = Vt(
                        b().availability.monthAnchor,
                        b().availability.selectedDate
                    );
                    (n.setMonth(n.getMonth() + e),
                        te({ monthAnchor: n, lastAction: '' }, { render: !0 }));
                })(Number(n.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (ie(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const t = Zt(-1);
                    t
                        ? ie(t, `Fecha previa con slots: ${t}`)
                        : ne('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const t = Zt(1);
                    t
                        ? ie(t, `Siguiente fecha con slots: ${t}`)
                        : ne('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (t) {
                    const e = Ht(t);
                    e &&
                        te(
                            {
                                selectedDate: e,
                                monthAnchor: Vt(e, e),
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
                    if (Gt()) return;
                    const n = e('#newSlotTime');
                    n instanceof HTMLInputElement &&
                        ((n.value = se(t)), n.focus());
                })(String(n.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (Gt()) return;
                    const t = e('#newSlotTime');
                    if (!(t instanceof HTMLInputElement)) return;
                    const n = se(t.value);
                    if (!n) return;
                    const a = b(),
                        i = oe();
                    i &&
                        (ae(
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
                    if (Gt()) return;
                    const n = Ht(t);
                    if (!n) return;
                    const a = b(),
                        i = Array.isArray(a.availability.draft[n])
                            ? a.availability.draft[n]
                            : [],
                        o = se(e);
                    ae(
                        n,
                        i.filter((t) => se(t) !== o),
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
                    if (Gt()) return;
                    const t = b(),
                        e = oe();
                    if (!e) return;
                    const n = Array.isArray(t.availability.draft[e])
                        ? Ft(t.availability.draft[e])
                        : [];
                    te(
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
                    if (Gt()) return;
                    const t = b(),
                        e = Array.isArray(t.availability.clipboard)
                            ? Ft(t.availability.clipboard)
                            : [];
                    if (!e.length) return void ne('Portapapeles vacio');
                    const n = oe();
                    n && ae(n, e, `Pegado ${e.length} slots en ${n}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (re(1), !0);
        case 'duplicate-availability-next-week':
            return (re(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (Gt()) return;
                    const t = oe();
                    t &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${t}. Continuar?`
                        ) &&
                        ae(t, [], `Dia ${t} limpiado`);
                })(),
                !0
            );
        case 'clear-availability-week':
            return (
                (function () {
                    if (Gt()) return;
                    const t = oe();
                    if (!t) return;
                    const e = (function (t) {
                        const e = Ot(t);
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
                    const i = Wt();
                    for (let t = 0; t < 7; t += 1) {
                        const n = new Date(e.start);
                        (n.setDate(e.start.getDate() + t), delete i[u(n)]);
                    }
                    ee(i, {
                        selectedDate: t,
                        lastAction: `Semana limpiada (${n} - ${a})`,
                    });
                })(),
                !0
            );
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (Gt()) return;
                    const t = Wt(),
                        e = await C('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        n =
                            e?.data && 'object' == typeof e.data
                                ? jt(e.data)
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
                        Xt());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (Gt()) return;
                    const t = b();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const e = jt(t.data.availability || {}),
                        n = Ut(t.availability.selectedDate, e);
                    te(
                        {
                            draft: e,
                            selectedDate: n,
                            monthAnchor: Vt(t.availability.monthAnchor, n),
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
const ba = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function ga(t, e = 'dashboard') {
    const n = String(t || '')
        .trim()
        .toLowerCase();
    return ba.has(n) ? n : e;
}
function fa(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            n = e ? `#${e}` : '';
        window.location.hash !== n &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${n}`
            );
    })(ga(t));
}
const ha = 'themeMode',
    ya = new Set(['light', 'dark', 'system']);
const va = 'adminLastSection',
    ka = 'adminSidebarCollapsed';
function wa(t, { persist: e = !1 } = {}) {
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
                const e = ya.has(t) ? t : 'system';
                Ge(ha, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const n = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', n),
                e.setAttribute('aria-pressed', String(n)));
        }));
}
function Sa() {
    const t = b();
    (Ge(va, t.ui.activeSection), Ge(ka, t.ui.sidebarCollapsed ? '1' : '0'));
}
function Ca() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function qa(t) {
    return (
        t instanceof HTMLElement &&
        !t.hidden &&
        'true' !== t.getAttribute('aria-hidden') &&
        (!('disabled' in t) || !t.disabled) &&
        t.getClientRects().length > 0
    );
}
function Aa() {
    const t = b(),
        n = Ca(),
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
async function Ta(t, e = {}) {
    const n = ga(t, 'dashboard'),
        { force: a = !1 } = e,
        i = b().ui.activeSection;
    return (
        !(
            (function (t, e) {
                return (
                    !e &&
                    'availability' === b().ui.activeSection &&
                    'availability' !== t &&
                    ce()
                );
            })(n, a) &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (t) {
            const e = ga(t, 'dashboard');
            (g((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                P(e),
                j(b()),
                fa(e),
                Sa());
        })(n),
        'queue' === n &&
            'queue' !== i &&
            (function () {
                const t = b();
                return (
                    'fallback' !== pe(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await hn()),
        !0)
    );
}
function _a(t) {
    g((e) => ({ ...e, ui: { ...e.ui, ...t(e.ui) } }));
}
function $a() {
    (_a((t) => ({
        sidebarCollapsed: !t.sidebarCollapsed,
        sidebarOpen: t.sidebarOpen,
    })),
        Aa(),
        Sa());
}
function Ma() {
    (_a((t) => ({ sidebarOpen: !t.sidebarOpen })), Aa());
}
function La({ restoreFocus: t = !1 } = {}) {
    if ((_a(() => ({ sidebarOpen: !1 })), Aa(), x(), t)) {
        const t = e('#adminMenuToggle');
        t instanceof HTMLElement && t.focus();
    }
}
function Ea() {
    B();
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function Na() {
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
const Da = {
    appointments_pending_transfer: async () => {
        (await Ta('appointments'), pt('pending_transfer'), mt(''));
    },
    appointments_all: async () => {
        (await Ta('appointments'), pt('all'), mt(''));
    },
    appointments_no_show: async () => {
        (await Ta('appointments'), pt('no_show'), mt(''));
    },
    callbacks_pending: async () => {
        (await Ta('callbacks'), Dt('pending'));
    },
    callbacks_contacted: async () => {
        (await Ta('callbacks'), Dt('contacted'));
    },
    callbacks_sla_urgent: async () => {
        (await Ta('callbacks'), Dt('sla_urgent'));
    },
    queue_sla_risk: async () => {
        (await Ta('queue'), pn('sla_risk'));
    },
    queue_waiting: async () => {
        (await Ta('queue'), pn('waiting'));
    },
    queue_called: async () => {
        (await Ta('queue'), pn('called'));
    },
    queue_no_show: async () => {
        (await Ta('queue'), pn('no_show'));
    },
    queue_all: async () => {
        (await Ta('queue'), pn('all'));
    },
    queue_call_next: async () => {
        (await Ta('queue'), await kn(b().queue.stationConsultorio));
    },
};
async function Ba(t) {
    const e = Da[t];
    'function' == typeof e && (await e());
}
function xa(t) {
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
async function Pa(t, e) {
    switch (t) {
        case 'callback-quick-filter':
            return (Dt(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                Nt({
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
                await Ta('callbacks'),
                Dt('pending'),
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
                await Bt(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.callbackDate || '')
                ),
                s('Callback actualizado', 'success'),
                !0
            );
        case 'callbacks-bulk-select-visible':
            return (
                Nt(
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
            return (Nt({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const t = (b().callbacks.selected || [])
                        .map((t) => Number(t || 0))
                        .filter((t) => t > 0);
                    for (const e of t)
                        try {
                            await Bt(e);
                        } catch (t) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await Ta('callbacks'), Dt('pending'), !0);
        default:
            return !1;
    }
}
async function Ia(t) {
    switch (t) {
        case 'context-open-appointments-transfer':
            return (await Ta('appointments'), pt('pending_transfer'), !0);
        case 'context-open-dashboard':
            return (await Ta('dashboard'), !0);
        default:
            return !1;
    }
}
async function Fa(t, e) {
    switch (t) {
        case 'queue-refresh-state':
            return (await hn(), !0);
        case 'queue-call-next':
            return (await kn(Number(e.dataset.queueConsultorio || 0)), !0);
        case 'queue-release-station':
            return (
                await (async function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1,
                        n = Pe(e);
                    n
                        ? await wn(n.id, 'liberar', e)
                        : Ue(`Sin ticket activo para liberar en C${e}`);
                })(Number(e.dataset.queueConsultorio || 0)),
                !0
            );
        case 'queue-toggle-ticket-select':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!e) return;
                    const n = De(b().queue.selected || []);
                    Ke(n.includes(e) ? n.filter((t) => t !== e) : [...n, e]);
                })(Number(e.dataset.queueId || 0)),
                !0
            );
        case 'queue-select-visible':
            return (Ke(Ne().map((t) => Number(t.id || 0))), !0);
        case 'queue-clear-selection':
            return (Qe(), !0);
        case 'queue-ticket-action':
            return (
                await wn(
                    Number(e.dataset.queueId || 0),
                    String(e.dataset.queueAction || ''),
                    Number(e.dataset.queueConsultorio || 0)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await An(Number(e.dataset.queueId || 0)), !0);
        case 'queue-bulk-action':
            return (
                await (async function (t) {
                    const e = xe(),
                        n = be(t);
                    if (e.length) {
                        if (rn.has(n)) {
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
                                await vn({
                                    ticketId: t.id,
                                    action: n,
                                    consultorio:
                                        t.assignedConsultorio ||
                                        b().queue.stationConsultorio,
                                });
                            } catch (t) {}
                        (Qe(), Ue(`Bulk ${n} sobre ${e.length} tickets`));
                    }
                })(String(e.dataset.queueAction || 'no_show')),
                !0
            );
        case 'queue-bulk-reprint':
            return (
                await (async function () {
                    const t = xe();
                    for (const e of t)
                        try {
                            await An(e.id);
                        } catch (t) {}
                    (Qe(), Ue(`Bulk reimpresion ${t.length}`));
                })(),
                !0
            );
        case 'queue-clear-search':
            return (
                (function () {
                    dn({ search: '', selected: [] });
                    const t = document.getElementById('queueSearchInput');
                    t instanceof HTMLInputElement && (t.value = '');
                })(),
                !0
            );
        case 'queue-toggle-shortcuts':
            return (Tn(), !0);
        case 'queue-toggle-one-tap':
            return (dn({ oneTap: !b().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (_n(!0), !0);
        case 'queue-stop-practice':
            return (_n(!1), !0);
        case 'queue-lock-station':
            return (
                (function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1;
                    (dn({ stationMode: 'locked', stationConsultorio: e }),
                        Ue(`Estacion bloqueada en C${e}`));
                })(Number(e.dataset.queueConsultorio || 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (t) {
                    if ('free' === pe(t))
                        return (
                            dn({ stationMode: 'free' }),
                            void Ue('Estacion en modo libre')
                        );
                    dn({ stationMode: 'locked' });
                })(String(e.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-sensitive-confirm':
            return (await Sn(), !0);
        case 'queue-sensitive-cancel':
            return (Cn(), !0);
        case 'queue-capture-call-key':
            return (
                dn({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    (dn({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        case 'queue-copy-install-link':
            return (
                await (async function (t) {
                    const e = String(t || '').trim();
                    if (e)
                        try {
                            (await navigator.clipboard.writeText(e),
                                s('Enlace copiado', 'success'));
                        } catch (t) {
                            s('No se pudo copiar el enlace', 'error');
                        }
                    else
                        s('No hay enlace de instalación disponible', 'warning');
                })(String(e.dataset.queueInstallUrl || '')),
                !0
            );
        default:
            return !1;
    }
}
async function Ha(t, e) {
    switch (t) {
        case 'close-toast':
            return (e.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                wa(String(e.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return ($a(), !0);
        case 'refresh-admin-data':
            return (await la(!0), !0);
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = xa(t.value);
                e && (await Ba(e), (t.value = ''), x());
            }
            return !0;
        }
        case 'open-command-palette':
            return (B(), Ea(), !0);
        case 'close-command-palette':
            return (x(), !0);
        case 'logout':
            return (
                await (async function () {
                    try {
                        await q('logout', { method: 'POST' });
                    } catch (t) {}
                    (S(''),
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
                N(),
                x(),
                ua(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                g((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                I(!1),
                O(),
                F({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                R('password'),
                !0
            );
        default:
            return !1;
    }
}
async function Oa() {
    ((function () {
        const t = e('#loginScreen'),
            n = e('#adminDashboard');
        if (!(t instanceof HTMLElement && n instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((t.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                ${_('login-theme-bar')}\n            </section>\n        </div>\n    `),
            (n.innerHTML = M()));
    })(),
        (function () {
            const t = e('#adminMainContent');
            (t instanceof HTMLElement &&
                t.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(z).forEach(([t, e]) => {
                    (V(t, e.hero, 'data-admin-section-hero'),
                        V(t, e.priority, 'data-admin-priority-rail'),
                        V(t, e.workbench, 'data-admin-workbench'),
                        V(t, e.detail, 'data-admin-detail-rail'));
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
                        const n = [Ha, pa, Pa, ma, Fa, Ia];
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
            const i = await Ta(
                String(e.getAttribute('data-section') || 'dashboard')
            );
            Ca() && !1 !== i && La();
        }),
        document.addEventListener('click', (t) => {
            const e =
                t.target instanceof Element
                    ? t.target.closest('[data-queue-filter]')
                    : null;
            e &&
                (t.preventDefault(),
                pn(String(e.getAttribute('data-queue-filter') || 'all')));
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
            let t = Q,
                e = W;
            try {
                ((t = JSON.parse(localStorage.getItem(U) || `"${Q}"`)),
                    (e = JSON.parse(localStorage.getItem(K) || `"${W}"`)));
            } catch (t) {}
            g((n) => ({
                ...n,
                appointments: {
                    ...n.appointments,
                    sort: 'string' == typeof t ? t : Q,
                    density: 'string' == typeof e ? e : W,
                },
            }));
        })(),
        (function () {
            let t = 'all',
                e = 'recent_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(ht) || '"all"')),
                    (e = JSON.parse(
                        localStorage.getItem(ft) || '"recent_desc"'
                    )));
            } catch (t) {}
            g((n) => ({
                ...n,
                callbacks: { ...n.callbacks, filter: wt(t), sort: St(e) },
            }));
        })(),
        (function () {
            let t = '',
                e = '';
            try {
                ((t = String(localStorage.getItem(xt) || '')),
                    (e = String(localStorage.getItem(Pt) || '')));
            } catch (t) {}
            const n = Ht(t),
                a = Vt(e, n);
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
            const t = ga(We(va, 'dashboard')),
                e = '1' === We(ka, '0');
            (g((n) => ({
                ...n,
                ui: {
                    ...n.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                P(t),
                fa(t),
                Aa());
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === pe(We(Xe, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(We(tn, '1')) ? 2 : 1,
                    oneTap: '1' === We(en, '0'),
                    helpOpen: '1' === We(an, '0'),
                    customCallKey: Je(nn, null),
                },
                e = pe(Ze('station')),
                n = pe(Ze('lock')),
                a = pe(Ze('one_tap'));
            (g((i) => ({
                ...i,
                queue: {
                    ...i.queue,
                    stationMode: En(n, t.stationMode),
                    stationConsultorio: Ln(e, t.stationConsultorio),
                    oneTap: Nn(a, t.oneTap),
                    helpOpen: t.helpOpen,
                    customCallKey:
                        t.customCallKey && 'object' == typeof t.customCallKey
                            ? t.customCallKey
                            : null,
                },
            })),
                cn(b()));
        })(),
        wa(
            (function () {
                const t = String(We(ha, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return ya.has(t) ? t : 'system';
            })()
        ),
        ua(),
        (function () {
            const t = document.getElementById('appointmentFilter');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    pt(t.value);
                });
            const e = document.getElementById('appointmentSort');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    dt({ sort: G(e.value) || Q });
                });
            const n = document.getElementById('searchAppointments');
            n instanceof HTMLInputElement &&
                n.addEventListener('input', () => {
                    mt(n.value);
                });
            const a = document.getElementById('callbackFilter');
            a instanceof HTMLSelectElement &&
                a.addEventListener('change', () => {
                    Dt(a.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Nt({ sort: St(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value),
                        Nt({ search: String(t || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        dn({ search: String(t || ''), selected: [] }));
                });
            const r = document.getElementById('adminQuickCommand');
            var c;
            r instanceof HTMLInputElement &&
                (c = r).addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = xa(c.value);
                    e && (await Ba(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                n = e('#adminMenuClose'),
                a = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                Ca() ? Ma() : $a();
            }),
                n?.addEventListener('click', () => La({ restoreFocus: !0 })),
                a?.addEventListener('click', () => La({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    Ca() ? Aa() : La();
                }),
                document.addEventListener('keydown', (t) => {
                    if (!Ca() || !b().ui.sidebarOpen) return;
                    if ('Escape' === t.key)
                        return (
                            t.preventDefault(),
                            void La({ restoreFocus: !0 })
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
                        return [n, a, ...i, o].filter(qa);
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
                        return ga(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(b().ui.activeSection);
                    await Ta(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && wa(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            ce() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const t = document.getElementById('loginForm');
    var n;
    (t instanceof HTMLFormElement && t.addEventListener('submit', da),
        (n = {
            navigateToSection: Ta,
            focusQuickCommand: Ea,
            focusCurrentSearch: Na,
            runQuickAction: Ba,
            closeSidebar: () => La({ restoreFocus: !0 }),
            toggleMenu: () => {
                Ca() ? Ma() : $a();
            },
            dismissQueueSensitiveDialog: qn,
            toggleQueueHelp: () => Tn(),
            queueNumpadAction: Mn,
        }),
        window.addEventListener('keydown', (t) => {
            (function (t, e) {
                const {
                        navigateToSection: n,
                        focusQuickCommand: a,
                        focusCurrentSearch: i,
                        runQuickAction: o,
                        closeSidebar: s,
                        toggleMenu: r,
                        dismissQueueSensitiveDialog: c,
                        toggleQueueHelp: u,
                    } = e,
                    { key: d, code: p } = v(t);
                if ('Escape' === t.key)
                    return (('function' == typeof c && c()) || s(), !0);
                if (t.ctrlKey && !t.shiftKey && !t.altKey && 'k' === d)
                    return (t.preventDefault(), a(), !0);
                if (!t.ctrlKey && !t.metaKey && !t.altKey && '/' === d)
                    return (t.preventDefault(), i(), !0);
                if (
                    !(function (t) {
                        return (
                            t.altKey && t.shiftKey && !t.ctrlKey && !t.metaKey
                        );
                    })(t)
                )
                    return !1;
                const m = (function ({ key: t, code: e }) {
                    return e || t;
                })({ key: d, code: p });
                if ('keym' === m) return (t.preventDefault(), r(), !0);
                if ('digit0' === m) return (t.preventDefault(), u(), !0);
                const g = f[m];
                if (g) return (l() || (t.preventDefault(), n(g)), !0);
                const k = (
                    'queue' !== b().ui.activeSection ? h : { ...h, ...y }
                )[m];
                return !!k && (l() || (t.preventDefault(), o(k)), !0);
            })(t, n) ||
                (function (t, e) {
                    if ('function' != typeof e) return !1;
                    const n = b().queue,
                        a = Boolean(n.captureCallKeyMode),
                        { code: i } = v(t),
                        o =
                            (function (t, e) {
                                return (
                                    e.startsWith('numpad') ||
                                    3 === t.location ||
                                    [
                                        'kpenter',
                                        'kpadd',
                                        'kpsubtract',
                                        'kpdecimal',
                                    ].includes(e)
                                );
                            })(t, i) ||
                            a ||
                            (function (t, e, n) {
                                const a = t.customCallKey;
                                return Boolean(
                                    a &&
                                    'object' == typeof a &&
                                    String(a.key || '') ===
                                        String(e.key || '') &&
                                    String(a.code || '').toLowerCase() === n &&
                                    Number(a.location || 0) ===
                                        Number(e.location || 0)
                                );
                            })(n, t, i);
                    !!o &&
                        (l() ||
                            Promise.resolve(
                                e({
                                    key: t.key,
                                    code: t.code,
                                    location: t.location,
                                })
                            ).catch(() => {}));
                })(t, n.queueNumpadAction);
        }));
    const a = await (async function () {
        try {
            const t = await q('status'),
                e = !0 === t.authenticated,
                n = e ? String(t.csrfToken || '') : '';
            return (
                S(n),
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
    (a
        ? (await (async function () {
              (D(), x(), await la(!1));
          })(),
          P(b().ui.activeSection))
        : (N(), x(), ua()),
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
            ca();
        }, 3e4));
}
const Ra = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      Oa().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : Oa()
).catch((t) => {
    throw (console.error('admin-v3 boot failed', t), t);
});
export { Ra as default };
