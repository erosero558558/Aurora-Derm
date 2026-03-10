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
            leadOpsMeta: null,
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
    const a = String(e.method || 'GET').toUpperCase(),
        n = {
            method: a,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...(e.headers || {}) },
        };
    ('GET' !== a && k && (n.headers['X-CSRF-Token'] = k),
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
function S(t) {
    k = String(t || '');
}
async function q(t, e = {}) {
    return w(`/api.php?resource=${encodeURIComponent(t)}`, e);
}
async function C(t, e = {}) {
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
function _(t) {
    return `<svg class="icon icon-${t}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${A[t] || A.menu}</svg>`;
}
function $(t) {
    return `\n        <div class="sony-theme-switcher ${t}" role="group" aria-label="Tema">\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${_('sun')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${_('moon')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${_('system')}</button>\n        </div>\n    `;
}
function T(t, e, a, n = !1) {
    return `\n        <a\n            href="#${t}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${t}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${_(a)}\n            <span>${e}</span>\n            <span class="badge" id="${t}Badge">0</span>\n        </a>\n    `;
}
function M() {
    return `\n        <div class="admin-v3-shell">\n            \n        <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <div class="admin-v3-sidebar__brand">\n                    <strong>Piel en Armonia</strong>\n                    <small>Admin sony_v3</small>\n                </div>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${_('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                \n        ${T('dashboard', 'Dashboard', 'dashboard', !0)}\n        ${T('appointments', 'Citas', 'appointments')}\n        ${T('callbacks', 'Callbacks', 'callbacks')}\n        ${T('reviews', 'Resenas', 'reviews')}\n        ${T('availability', 'Disponibilidad', 'availability')}\n        ${T('queue', 'Turnero Sala', 'queue')}\n    \n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${_('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n    \n            \n        <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n            \n        <header class="admin-v3-topbar">\n            <div class="admin-v3-topbar__copy">\n                <p class="sony-kicker">Sony V3</p>\n                <h2 id="pageTitle">Dashboard</h2>\n            </div>\n            <div class="admin-v3-topbar__actions">\n                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${_('menu')}<span>Menu</span></button>\n                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>\n                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                ${$('admin-theme-switcher-header')}\n            </div>\n        </header>\n    \n            \n        <section class="admin-v3-context-strip" id="adminProductivityStrip">\n            <div class="admin-v3-context-copy" data-admin-section-hero>\n                <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>\n                <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>\n                <div id="adminContextActions" class="sony-context-actions"></div>\n            </div>\n            <div class="admin-v3-status-rail" data-admin-priority-rail>\n                <article class="sony-status-tile">\n                    <span>Push</span>\n                    <strong id="pushStatusIndicator">Inicializando</strong>\n                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                </article>\n                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                    <span>Sesion</span>\n                    <strong id="adminSessionState">No autenticada</strong>\n                    <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                </article>\n                <article class="sony-status-tile">\n                    <span>Sincronizacion</span>\n                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                    <small id="adminSyncState">Listo para primera sincronizacion</small>\n                </article>\n            </div>\n        </section>\n    \n            \n        \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                \n        <article class="sony-panel dashboard-hero-panel">\n            <div class="dashboard-hero-copy">\n                <p class="sony-kicker">Resumen diario</p>\n                <h3>Prioridades de hoy</h3>\n                <p id="dashboardHeroSummary">\n                    Agenda, callbacks y disponibilidad con una lectura mas clara y directa.\n                </p>\n            </div>\n            <div class="dashboard-hero-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>\n                <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>\n            </div>\n            <div class="dashboard-hero-metrics">\n                <div class="dashboard-hero-metric">\n                    <span>Rating</span>\n                    <strong id="dashboardHeroRating">0.0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Reseñas 30d</span>\n                    <strong id="dashboardHeroRecentReviews">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Urgentes SLA</span>\n                    <strong id="dashboardHeroUrgentCallbacks">0</strong>\n                </div>\n                <div class="dashboard-hero-metric">\n                    <span>Transferencias</span>\n                    <strong id="dashboardHeroPendingTransfers">0</strong>\n                </div>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel dashboard-signal-panel">\n            <header>\n                <div>\n                    <h3>Señal operativa</h3>\n                    <small id="operationRefreshSignal">Tiempo real</small>\n                </div>\n                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n            </header>\n            <p id="dashboardLiveMeta">\n                Sin alertas criticas en la operacion actual.\n            </p>\n            <div class="dashboard-signal-stack">\n                <article class="dashboard-signal-card">\n                    <span>Push</span>\n                    <strong id="dashboardPushStatus">Sin validar</strong>\n                    <small id="dashboardPushMeta">Permisos del navegador</small>\n                </article>\n                <article class="dashboard-signal-card">\n                    <span>Atencion</span>\n                    <strong id="dashboardQueueHealth">Cola: estable</strong>\n                    <small id="dashboardFlowStatus">Sin cuellos de botella</small>\n                </article>\n            </div>\n            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-grid sony-grid-kpi">\n            <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>\n            <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>\n            <article class="sony-kpi"><h3>Reseñas</h3><strong id="totalReviewsCount">0</strong></article>\n            <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>\n            <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-two">\n            <article class="sony-panel dashboard-card-operations">\n                <header>\n                    <h3>Centro operativo</h3>\n                    <small id="operationDeckMeta">Prioridades y acciones</small>\n                </header>\n                <div class="sony-panel-stats">\n                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                    <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                    <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                </div>\n                <p id="operationQueueHealth">Cola: estable</p>\n                <div id="operationActionList" class="operations-action-list"></div>\n            </article>\n\n            <article class="sony-panel" id="funnelSummary">\n                <header><h3>Embudo</h3></header>\n                <div class="sony-panel-stats">\n                    <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>\n                    <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                    <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>\n                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                </div>\n            </article>\n        </div>\n    \n            \n        <div class="sony-grid sony-grid-three">\n            <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n            <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n        </div>\n    \n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n    \n        \n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                \n        <article class="sony-panel appointments-command-deck">\n            <header class="section-header appointments-command-head">\n                <div>\n                    <p class="sony-kicker">Agenda clinica</p>\n                    <h3>Citas</h3>\n                    <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                </div>\n                <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n            </header>\n            <div class="appointments-ops-grid">\n                <article class="appointments-ops-card tone-warning">\n                    <span>Transferencias</span>\n                    <strong id="appointmentsOpsPendingTransfer">0</strong>\n                    <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                </article>\n                <article class="appointments-ops-card tone-neutral">\n                    <span>Proximas 48h</span>\n                    <strong id="appointmentsOpsUpcomingCount">0</strong>\n                    <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                </article>\n                <article class="appointments-ops-card tone-danger">\n                    <span>No show</span>\n                    <strong id="appointmentsOpsNoShowCount">0</strong>\n                    <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                </article>\n                <article class="appointments-ops-card tone-success">\n                    <span>Hoy</span>\n                    <strong id="appointmentsOpsTodayCount">0</strong>\n                    <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                </article>\n            </div>\n            <div class="appointments-command-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel appointments-focus-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                    <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                    <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                </div>\n            </header>\n            <div class="appointments-focus-grid">\n                <div class="appointments-focus-stat">\n                    <span>Siguiente ventana</span>\n                    <strong id="appointmentsFocusWindow">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Pago</span>\n                    <strong id="appointmentsFocusPayment">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Estado</span>\n                    <strong id="appointmentsFocusStatus">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Contacto</span>\n                    <strong id="appointmentsFocusContact">-</strong>\n                </div>\n            </div>\n            <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n            <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel appointments-workbench">\n            <header class="section-header appointments-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                </div>\n                <div class="toolbar-group" id="appointmentsDensityToggle">\n                    <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                    <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                </div>\n            </div>\n            <div class="toolbar-row appointments-toolbar">\n                <label>\n                    <span class="sr-only">Filtro</span>\n                    <select id="appointmentFilter">\n                        <option value="all">Todas</option>\n                        <option value="pending_transfer">Transferencias por validar</option>\n                        <option value="upcoming_48h">Proximas 48h</option>\n                        <option value="no_show">No show</option>\n                        <option value="triage_attention">Triage accionable</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden</span>\n                    <select id="appointmentSort">\n                        <option value="datetime_desc">Fecha reciente</option>\n                        <option value="datetime_asc">Fecha ascendente</option>\n                        <option value="patient_az">Paciente (A-Z)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                <p id="appointmentsToolbarState">Sin filtros activos</p>\n            </div>\n\n            <div class="table-scroll appointments-table-shell">\n                <table id="appointmentsTable" class="sony-table">\n                    <thead>\n                        <tr>\n                            <th>Paciente</th>\n                            <th>Servicio</th>\n                            <th>Fecha</th>\n                            <th>Pago</th>\n                            <th>Estado</th>\n                            <th>Acciones</th>\n                        </tr>\n                    </thead>\n                    <tbody id="appointmentsTableBody"></tbody>\n                </table>\n            </div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                \n        <article class="sony-panel callbacks-command-deck">\n            <header class="section-header callbacks-command-head">\n                <div>\n                    <p class="sony-kicker">SLA telefonico</p>\n                    <h3>Callbacks</h3>\n                    <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                </div>\n                <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n            </header>\n            <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hot</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n            </div>\n            <div class="callbacks-command-actions">\n                <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel callbacks-next-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                    <h3 id="callbacksOpsNext">Sin telefono</h3>\n                    <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                </div>\n                <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n            </header>\n            <div class="callbacks-next-grid">\n                <div class="callbacks-next-stat">\n                    <span>Espera</span>\n                    <strong id="callbacksNextWait">0 min</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Servicio</span>\n                    <strong id="callbacksNextPreference">-</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Accion</span>\n                    <strong id="callbacksNextState">Pendiente</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Estado IA</span>\n                    <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                </div>\n            </div>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel callbacks-workbench">\n            <header class="section-header callbacks-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p>Ordena por prioridad comercial, genera borradores IA y registra el outcome sin salir del panel.</p>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                </div>\n            </div>\n            <div class="toolbar-row callbacks-toolbar">\n                <label>\n                    <span class="sr-only">Filtro callbacks</span>\n                    <select id="callbackFilter">\n                        <option value="all">Todos</option>\n                        <option value="pending">Pendientes</option>\n                        <option value="contacted">Contactados</option>\n                        <option value="today">Hoy</option>\n                        <option value="sla_urgent">Urgentes SLA</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden callbacks</span>\n                    <select id="callbackSort">\n                        <option value="priority_desc">Prioridad comercial</option>\n                        <option value="recent_desc">Mas recientes</option>\n                        <option value="waiting_desc">Mayor espera (SLA)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchCallbacks" placeholder="Buscar telefono o servicio" />\n                <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="callbacksToolbarMeta">Mostrando 0</p>\n                <p id="callbacksToolbarState">Sin filtros activos</p>\n            </div>\n            <div id="callbacksGrid" class="callbacks-grid"></div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                \n        <header class="section-header availability-header">\n            <div class="availability-calendar">\n                <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                <div class="availability-badges">\n                    <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                    <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                    <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                </div>\n            </div>\n            <div class="toolbar-group calendar-header">\n                <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                <strong id="calendarMonth"></strong>\n                <button type="button" data-action="change-month" data-delta="1">Next</button>\n                <button type="button" data-action="availability-today">Hoy</button>\n                <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n            </div>\n        </header>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n            <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n            <p id="availabilitySyncStatus">Sincronizado</p>\n        </div>\n    \n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n                \n        <div id="availabilityDetailGrid" class="availability-detail-grid">\n            <article class="sony-panel soft">\n                <h4 id="selectedDate">-</h4>\n                <div id="timeSlotsList" class="time-slots-list"></div>\n            </article>\n\n            <article class="sony-panel soft">\n                <div id="availabilityQuickSlotPresets" class="slot-presets">\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                </div>\n                <div id="addSlotForm" class="add-slot-form">\n                    <input type="time" id="newSlotTime" />\n                    <button type="button" data-action="add-time-slot">Agregar</button>\n                </div>\n                <div id="availabilityDayActions" class="toolbar-group wrap">\n                    <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                    <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                    <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                    <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                    <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                    <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                </div>\n                <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                <div class="toolbar-group">\n                    <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                    <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                </div>\n            </article>\n        </div>\n    \n            </div>\n        </section>\n    \n        \n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                \n        <header class="section-header">\n            <div>\n                <h3>Turnero Sala</h3>\n                <p>\n                    Apps operativas, cola en vivo y flujo simple para recepción,\n                    kiosco y TV.\n                </p>\n            </div>\n            <div class="queue-admin-header-actions">\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                <button type="button" data-action="queue-refresh-state">Refrescar</button>\n            </div>\n        </header>\n    \n                \n        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft">\n            <div class="queue-apps-hub__header">\n                <div>\n                    <h4>Apps operativas</h4>\n                    <p>\n                        Instala Operador, Kiosco y Sala TV desde el mismo centro de\n                        control para separar cada equipo por uso.\n                    </p>\n                </div>\n                <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">\n                    Plataforma detectada\n                </span>\n            </div>\n            <div id="queueAppDownloadsCards" class="queue-apps-grid"></div>\n            <div id="queueInstallConfigurator" class="queue-install-configurator"></div>\n        </div>\n    \n                \n        <div class="sony-grid sony-grid-kpi slim">\n            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n        </div>\n    \n                \n        <div id="queueStationControl" class="toolbar-row">\n            <span id="queueStationBadge">Estacion: libre</span>\n            <span id="queueStationModeBadge">Modo: free</span>\n            <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n            <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n            <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n            <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n            <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n            <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n            <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n            <button type="button" data-action="queue-stop-practice">Salir practica</button>\n            <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n            <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n        </div>\n    \n                \n        <div id="queueShortcutPanel" hidden>\n            <p>Numpad Enter llama siguiente.</p>\n            <p>Numpad Decimal prepara completar.</p>\n            <p>Numpad Subtract prepara no_show.</p>\n            <p>Numpad Add re-llama el ticket activo.</p>\n        </div>\n    \n                \n        <div id="queueTriageToolbar" class="toolbar-row">\n            <button type="button" data-queue-filter="all">Todo</button>\n            <button type="button" data-queue-filter="called">Llamados</button>\n            <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n            <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n            <button type="button" data-action="queue-clear-search">Limpiar</button>\n            <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n            <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n            <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n        </div>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="queueTriageSummary">Sin riesgo</p>\n            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n        </div>\n    \n                \n        <ul id="queueNextAdminList" class="sony-list"></ul>\n        <div id="queueHelpRequestsPanel" class="sony-panel soft">\n            <h4>Apoyos recepcion</h4>\n            <ul id="queueHelpRequestsList" class="sony-list">\n                <li><span>-</span><strong>Sin apoyos pendientes</strong></li>\n            </ul>\n        </div>\n\n        <div class="table-scroll">\n            <table class="sony-table queue-admin-table">\n                <thead>\n                    <tr>\n                        <th>Sel</th>\n                        <th>Ticket</th>\n                        <th>Tipo</th>\n                        <th>Estado</th>\n                        <th>Consultorio</th>\n                        <th>Espera</th>\n                        <th>Acciones</th>\n                    </tr>\n                </thead>\n                <tbody id="queueTableBody"></tbody>\n            </table>\n        </div>\n\n        <div id="queueActivityPanel" class="sony-panel soft">\n            <h4>Actividad</h4>\n            <ul id="queueActivityList" class="sony-list"></ul>\n        </div>\n    \n            </div>\n\n            \n        <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n            <form method="dialog">\n                <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                <div class="toolbar-group">\n                    <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                    <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                </div>\n            </form>\n        </dialog>\n    \n        </section>\n    \n    \n        </main>\n    \n            \n        <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n            <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n            <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                <div class="admin-command-dialog__head">\n                    <div>\n                        <p class="sony-kicker">Command Palette</p>\n                        <h3 id="adminCommandPaletteTitle">Accion rapida</h3>\n                    </div>\n                    <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                </div>\n                <div class="admin-command-box">\n                    <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />\n                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                </div>\n                <div class="admin-command-dialog__hints">\n                    <span>Ctrl+K abre esta paleta</span>\n                    <span>/ enfoca la busqueda de la seccion activa</span>\n                </div>\n            </div>\n        </div>\n    \n        </div>\n    `;
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
        a = e('#adminDashboard');
    (t && t.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function D() {
    const t = e('#loginScreen'),
        a = e('#adminDashboard');
    (t && t.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function B() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.remove('is-hidden'),
        t.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function P() {
    const t = e('#adminCommandPalette');
    t instanceof HTMLElement &&
        (t.classList.add('is-hidden'),
        t.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function I(t) {
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
    const n = E[t] || 'Dashboard',
        i = e('#pageTitle');
    i && (i.textContent = n);
}
function x(t) {
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
        F(!1));
}
function H({
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
function F(t) {
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
function O({ clearPassword: t = !1 } = {}) {
    const a = e('#adminPassword'),
        n = e('#admin2FACode');
    (a instanceof HTMLInputElement && t && (a.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function R(t = 'password') {
    const a = e('2fa' === t ? '#admin2FACode' : '#adminPassword');
    a instanceof HTMLInputElement && (a.focus(), a.select?.());
}
function j(a) {
    const n = (function (t) {
        const e = L[t?.ui?.activeSection || 'dashboard'] || L.dashboard,
            a = t?.auth && 'object' == typeof t.auth ? t.auth : {},
            n = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
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
            })(n),
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
            auth: a,
            config: e,
            appointments: n,
            reviews: o,
            pendingTransfers: l,
            pendingCallbacks: u,
            availabilityDays: d,
            waitingTickets: p,
            dashboardAlerts: l + u,
        };
    })(a);
    ((function (e, a) {
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
                })(e?.ui?.lastRefreshAt || 0)
            ));
    })(a, n.config),
        (function (t) {
            (r('#dashboardBadge', t.dashboardAlerts),
                r('#appointmentsBadge', t.appointments.length),
                r('#callbacksBadge', t.pendingCallbacks),
                r('#reviewsBadge', t.reviews.length),
                r('#availabilityBadge', t.availabilityDays),
                r('#queueBadge', t.waitingTickets));
        })(n),
        (function (t) {
            const a = e('#adminSessionTile'),
                n = t.authenticated
                    ? 'Sesion activa'
                    : t.requires2FA
                      ? 'Verificacion 2FA'
                      : 'No autenticada',
                i = t.authenticated
                    ? 'success'
                    : t.requires2FA
                      ? 'warning'
                      : 'neutral';
            (a?.setAttribute('data-state', i),
                r('#adminSessionState', n),
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
                                a = Number(e.lastAuthAt || 0);
                            return a
                                ? `Protegida por ${t}. ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                                : `Protegida por ${t}.`;
                        }
                        return e.requires2FA
                            ? 'Esperando codigo de seis digitos para completar el acceso.'
                            : 'Autenticate para operar el panel.';
                    })(t)
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
function V(t, a, n) {
    if (!a) return;
    const i = e(`#${t}`);
    if (!(i instanceof HTMLElement)) return;
    const o = i.querySelector(a);
    o instanceof HTMLElement && o.setAttribute(n, 'true');
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
    return G(t.paymentStatus || t.payment_status || '');
}
function Y(t) {
    return G(t);
}
function Z(t, e = '-') {
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
function X(t) {
    return (function (t) {
        const e = new Date(t || '');
        return Number.isNaN(e.getTime()) ? 0 : e.getTime();
    })(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function tt(t) {
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
function et(t) {
    const e = X(t);
    if (!e) return !1;
    const a = new Date(e),
        n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function at(t) {
    const e = X(t);
    if (!e) return !1;
    const a = e - Date.now();
    return a >= 0 && a <= 1728e5;
}
function nt(t) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[G(t)] || Z(t, 'Pendiente')
    );
}
function it(t) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[G(t)] || Z(t, 'Pendiente')
    );
}
function ot(t) {
    const e = J(t),
        a = Y(t.status);
    return (
        'pending_transfer_review' === e ||
        'pending_transfer' === e ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function st(t, e) {
    const a = G(e);
    return 'pending_transfer' === a
        ? t.filter((t) => {
              const e = J(t);
              return (
                  'pending_transfer_review' === e || 'pending_transfer' === e
              );
          })
        : 'upcoming_48h' === a
          ? t.filter(at)
          : 'no_show' === a
            ? t.filter((t) => 'no_show' === Y(t.status))
            : 'triage_attention' === a
              ? t.filter(ot)
              : t;
}
function rt(t) {
    const e = J(t),
        a = Y(t.status),
        n = X(t);
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
            : et(t)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: n ? tt(n) : 'Agenda del dia',
                }
              : at(t)
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
            .map((t) => ({ item: t, stamp: X(t) }))
            .sort((t, e) => t.stamp - e.stamp),
        a = e.find(({ item: t }) => {
            const e = J(t);
            return 'pending_transfer_review' === e || 'pending_transfer' === e;
        });
    if (a)
        return {
            item: a.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const n = e.find(({ item: t }) => 'no_show' === Y(t.status));
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
function lt(e) {
    return e.length
        ? e
              .map((e) => {
                  const a = X(e);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(e.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${t(e.name || 'Sin nombre')}</strong>\n                            <span>${t(e.email || 'Sin email')}</span>\n                            <small>${t(e.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">${(function (
                      e
                  ) {
                      const a = rt(e);
                      return `\n        <div class="appointment-service">\n            <strong>${t(Z(e.service, 'Servicio pendiente'))}</strong>\n            <span>Especialista: ${t(Z(e.doctor, 'Sin asignar'))}</span>\n            <small>${t(a.label)} | ${t(a.note)}</small>\n        </div>\n    `;
                  })(
                      e
                  )}</td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${t(n(e.date))}</strong>\n                            <span>${t(e.time || '--:--')}</span>\n                            <small>${t(tt(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
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
                              const e = G(t);
                              return 'paid' === e
                                  ? 'success'
                                  : 'failed' === e
                                    ? 'danger'
                                    : 'pending_cash' === e
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${t(nt(a))}</span>\n            <small>Metodo: ${t(((i = e.paymentMethod || e.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[G(i)] || Z(i, 'Metodo pendiente')))}</small>\n            ${n ? `<a href="${t(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      e
                  )}</td>\n                    <td data-label="Estado">${(function (
                      e
                  ) {
                      const a = Y(e.status),
                          n = J(e),
                          i = rt(e),
                          o = [];
                      return (
                          'pending_transfer_review' === n &&
                              o.push('Transferencia por validar'),
                          'no_show' === a && o.push('Paciente ausente'),
                          'cancelled' === a && o.push('Cita cerrada'),
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
                              })(a)
                          )}">${t(it(a))}</span>\n            <small>${t(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      e
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      e
                  ) {
                      const a = Number(e.id || 0),
                          n = J(e),
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
function ut() {
    const e = b(),
        a = Array.isArray(e?.data?.appointments) ? e.data.appointments : [],
        i = e?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (t, e) {
            const a = G(e),
                n = [...t];
            return 'patient_az' === a
                ? (n.sort((t, e) => G(t.name).localeCompare(G(e.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort((t, e) => X(t) - X(e)), n)
                  : (n.sort((t, e) => X(e) - X(t)), n);
        })(
            (function (t, e) {
                const a = G(e);
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
                          ].some((t) => G(t).includes(a))
                      )
                    : t;
            })(st(a, i.filter), i.search),
            i.sort
        );
    (c('#appointmentsTableBody', lt(o)),
        (function (t, e, a) {
            (r('#appointmentsToolbarMeta', `Mostrando ${e} de ${a}`),
                r(
                    '#appointmentsToolbarState',
                    (function (t, e) {
                        const a = [];
                        if ('all' !== G(t.filter)) {
                            const e = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            a.push(e[G(t.filter)] || t.filter);
                        }
                        return (
                            G(t.search) && a.push(`Busqueda: ${t.search}`),
                            'patient_az' === G(t.sort)
                                ? a.push('Paciente (A-Z)')
                                : 'datetime_asc' === G(t.sort)
                                  ? a.push('Fecha ascendente')
                                  : a.push('Fecha reciente'),
                            0 === e && a.push('Resultados: 0'),
                            a
                        );
                    })(t, e).join(' | ')
                ));
            const n = document.getElementById('clearAppointmentsFiltersBtn');
            if (n) {
                const e = 'all' !== G(t.filter) || '' !== G(t.search);
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
                    'compact' === G(t.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((e) => {
                        const a = G(e.dataset.density) === G(t.density);
                        e.classList.toggle('is-active', a);
                    }),
                (function (t) {
                    const e = G(t);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((t) => {
                            const a = G(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', a);
                        });
                })(t.filter),
                (function (t) {
                    try {
                        (localStorage.setItem(U, JSON.stringify(t.sort)),
                            localStorage.setItem(K, JSON.stringify(t.density)));
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
                    `${Z(l.service, 'Servicio pendiente')} | ${n(l.date)} ${l.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', tt(X(l))),
                r(
                    '#appointmentsFocusPayment',
                    nt(l.paymentStatus || l.payment_status)
                ),
                r('#appointmentsFocusStatus', it(l.status)),
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
                    a = st(t, 'upcoming_48h'),
                    n = st(t, 'no_show'),
                    i = st(t, 'triage_attention'),
                    o = t.filter(et);
                return {
                    pendingTransferCount: e.length,
                    upcomingCount: a.length,
                    noShowCount: n.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: ct(t),
                };
            })(a),
            o.length,
            a.length
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
        ut());
}
async function gt(t, e) {
    await q('appointments', {
        method: 'PATCH',
        body: { id: Number(t || 0), ...e },
    });
}
const ft = 'admin-callbacks-sort',
    ht = 'admin-callbacks-filter',
    yt = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    vt = new Set(['priority_desc', 'recent_desc', 'waiting_desc']);
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
    return vt.has(e) ? e : 'priority_desc';
}
function qt(t) {
    const e = kt(t);
    return e.includes('contact') || 'resolved' === e || 'atendido' === e
        ? 'contacted'
        : 'pending';
}
function Ct(t) {
    return t?.leadOps && 'object' == typeof t.leadOps ? t.leadOps : {};
}
function At(t) {
    const e = new Date(t?.fecha || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function _t(t) {
    const e = At(t);
    return e ? Math.max(0, Math.round((Date.now() - e) / 6e4)) : 0;
}
function $t(t) {
    return t < 60
        ? `${t} min`
        : t < 1440
          ? `${Math.round(t / 60)} h`
          : `${Math.round(t / 1440)} d`;
}
function Tt(t) {
    return (
        String(t?.telefono || t?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function Mt(t) {
    const e = kt(Ct(t).priorityBand);
    return 'hot' === e || 'warm' === e ? e : 'cold';
}
function Lt(t) {
    const e = Mt(t);
    return 'hot' === e ? 3 : 'warm' === e ? 2 : 1;
}
function Et(t) {
    const e = Array.isArray(Ct(t).serviceHints) ? Ct(t).serviceHints : [];
    return String(e[0] || '').trim() || 'Sin sugerencia';
}
function Nt(t) {
    return (
        String(Ct(t).nextAction || '').trim() || 'Mantener visible en la cola'
    );
}
function Dt(t, e = '') {
    const a = kt(Ct(t).aiStatus);
    return 'requested' === a
        ? 'online' === e
            ? 'IA pendiente'
            : 'IA no disponible'
        : 'completed' === a
          ? 'Borrador listo'
          : 'accepted' === a
            ? 'Borrador usado'
            : 'failed' === a
              ? 'IA fallida'
              : 'disabled' === e
                ? 'IA apagada'
                : 'Sin IA';
}
function Bt(t) {
    return String(Ct(t).aiDraft || '').trim();
}
function Pt(t) {
    const e = Number(Ct(t).heuristicScore || 0);
    return Number.isFinite(e) ? e : 0;
}
function It(t) {
    const e = new Date(t || '');
    if (Number.isNaN(e.getTime())) return !1;
    const a = new Date();
    return (
        e.getFullYear() === a.getFullYear() &&
        e.getMonth() === a.getMonth() &&
        e.getDate() === a.getDate()
    );
}
function xt(t) {
    try {
        (localStorage.setItem(ht, JSON.stringify(wt(t.filter))),
            localStorage.setItem(ft, JSON.stringify(St(t.sort))));
    } catch (t) {}
}
function Ht() {
    const e = b(),
        a = Array.isArray(e?.data?.callbacks) ? e.data.callbacks : [],
        n =
            e?.data?.leadOpsMeta && 'object' == typeof e.data.leadOpsMeta
                ? e.data.leadOpsMeta
                : null,
        o = e.callbacks,
        s = (function (t, e) {
            const a = St(e),
                n = [...t];
            return 'waiting_desc' === a
                ? (n.sort((t, e) => At(t) - At(e)), n)
                : 'recent_desc' === a
                  ? (n.sort((t, e) => At(e) - At(t)), n)
                  : (n.sort((t, e) => {
                        const a = Lt(e) - Lt(t);
                        if (0 !== a) return a;
                        const n = Pt(e) - Pt(t);
                        return 0 !== n ? n : At(t) - At(e);
                    }),
                    n);
        })(
            (function (t, e, a = '') {
                const n = kt(e);
                return n
                    ? t.filter((t) => {
                          const e = Ct(t);
                          return [
                              t.telefono,
                              t.phone,
                              t.preferencia,
                              t.status,
                              Et(t),
                              Nt(t),
                              Dt(t, a),
                              ...(Array.isArray(e.reasonCodes)
                                  ? e.reasonCodes
                                  : []),
                              ...(Array.isArray(e.serviceHints)
                                  ? e.serviceHints
                                  : []),
                          ].some((t) => kt(t).includes(n));
                      })
                    : t;
            })(
                (function (t, e) {
                    const a = wt(e);
                    return 'pending' === a || 'contacted' === a
                        ? t.filter((t) => qt(t.status) === a)
                        : 'today' === a
                          ? t.filter((t) => It(t.fecha || t.createdAt))
                          : 'sla_urgent' === a
                            ? t.filter(
                                  (t) =>
                                      'pending' === qt(t.status) && _t(t) >= 120
                              )
                            : t;
                })(a, o.filter),
                o.search,
                String(n?.worker?.mode || '')
            ),
            o.sort
        ),
        l = new Set((o.selected || []).map((t) => Number(t || 0))),
        u = (function (t, e = null) {
            const a = t.filter((t) => 'pending' === qt(t.status)),
                n = a.filter((t) => _t(t) >= 120),
                i = a.filter((t) => 3 === Lt(t)),
                o = a.slice().sort((t, e) => {
                    const a = Lt(e) - Lt(t);
                    return 0 !== a ? a : At(t) - At(e);
                })[0],
                s = kt(e?.worker?.mode || '');
            return {
                pendingCount: a.length,
                urgentCount: n.length,
                hotCount: i.length,
                todayCount: t.filter((t) => It(t.fecha || t.createdAt)).length,
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
    (c(
        '#callbacksGrid',
        s.length
            ? s
                  .map((e, a) =>
                      (function (
                          e,
                          {
                              selected: a = !1,
                              position: n = null,
                              workerMode: o = '',
                          } = {}
                      ) {
                          const s = String(e.status || '')
                                  .toLowerCase()
                                  .includes('contact')
                                  ? 'contacted'
                                  : 'pending',
                              r = Number(e.id || 0),
                              c = Tt(e),
                              l = _t(e),
                              u = Mt(e),
                              d = Bt(e);
                          return `\n        <article class="callback-card ${t(u)} ${'pending' === s ? 'pendiente' : 'contactado'}${a ? ' is-selected' : ''}" data-callback-id="${r}" data-callback-status="${'pending' === s ? 'pendiente' : 'contactado'}">\n            <header>\n                <div class="callback-card-heading">\n                    <div class="callback-card-badges">\n                        <span class="callback-status-pill" data-tone="${t(u)}">${t(
                              (function (t) {
                                  const e = Mt(t);
                                  return 'hot' === e
                                      ? 'Hot'
                                      : 'warm' === e
                                        ? 'Warm'
                                        : 'Cold';
                              })(e)
                          )}</span>\n                        <span class="callback-status-pill subtle">${t(Dt(e, o))}</span>\n                    </div>\n                    <h4>${t(c)}</h4>\n                    <p class="callback-card-subtitle">${t(1 === n ? 'Siguiente lead sugerido' : 'Lead interno')}${Pt(e) ? ` · Score ${t(String(Pt(e)))}` : ''}</p>\n                </div>\n                <span class="callback-card-wait" data-tone="${t('pending' === s ? u : 'success')}">${t($t(l))}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Servicio</span><strong>${t(Et(e))}</strong></p>\n                <p><span>Fecha</span><strong>${t(i(e.fecha || e.createdAt || ''))}</strong></p>\n                <p><span>Siguiente accion</span><strong>${t(Nt(e))}</strong></p>\n                <p><span>Outcome</span><strong>${t(
                              (function (t) {
                                  const e = kt(Ct(t).outcome);
                                  return 'cita_cerrada' === e
                                      ? 'Cita cerrada'
                                      : 'sin_respuesta' === e
                                        ? 'Sin respuesta'
                                        : 'descartado' === e
                                          ? 'Descartado'
                                          : 'contactado' === e
                                            ? 'Contactado'
                                            : 'Pendiente';
                              })(e)
                          )}</strong></p>\n            </div>\n            <p class="callback-card-note">${t(e.preferencia || 'Sin preferencia registrada')}</p>\n            ${d ? `<div class="callback-card-draft"><span>Borrador IA</span><p>${t(d)}</p></div>` : ''}\n            ${(function (
                              e,
                              a
                          ) {
                              const n = Number(e.id || 0),
                                  i = Bt(e);
                              return `\n        <div class="callback-actions">\n            <button type="button" data-action="mark-contacted" data-callback-id="${n}" data-callback-date="${t(e.fecha || '')}" ${'pending' !== a ? 'disabled' : ''}>${'pending' === a ? 'Marcar contactado' : 'Contactado'}</button>\n            <button type="button" class="ghost" data-action="lead-ai-request" data-callback-id="${n}" data-objective="whatsapp_draft">Generar borrador IA</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="cita_cerrada">Cita cerrada</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="sin_respuesta">Sin respuesta</button>\n            <button type="button" class="ghost" data-action="callback-outcome" data-callback-id="${n}" data-outcome="descartado">Descartar</button>\n            ${i ? `<button type="button" class="ghost" data-action="callback-copy-ai" data-callback-id="${n}">Copiar borrador</button>` : ''}\n        </div>\n    `;
                          })(e, s)}\n        </article>\n    `;
                      })(e, {
                          selected: l.has(Number(e.id || 0)),
                          position: a + 1,
                          workerMode: String(n?.worker?.mode || ''),
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    ),
        (function (t, e, a) {
            (r('#callbacksToolbarMeta', `Mostrando ${e} de ${a}`),
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
                            'priority_desc' === St(t.sort)
                                ? e.push('Orden: Prioridad comercial')
                                : 'waiting_desc' === St(t.sort)
                                  ? e.push('Orden: Mayor espera (SLA)')
                                  : e.push('Orden: Mas recientes'),
                            e
                        );
                    })(t).join(' | ')
                ));
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement && (n.value = wt(t.filter));
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
                            const a = kt(t.dataset.filterValue) === e;
                            t.classList.toggle('is-active', a);
                        });
                })(t.filter),
                xt(t));
        })(o, s.length, a.length),
        r('#callbacksOpsPendingCount', u.pendingCount),
        r('#callbacksOpsUrgentCount', u.hotCount),
        r('#callbacksOpsTodayCount', u.todayCount),
        r('#callbacksOpsQueueHealth', u.queueHealth),
        (function (t, e) {
            const a = document.getElementById('callbacksBulkSelectVisibleBtn');
            a instanceof HTMLButtonElement && (a.disabled = 0 === t);
            const n = document.getElementById('callbacksBulkClearBtn');
            n instanceof HTMLButtonElement && (n.disabled = 0 === e);
            const i = document.getElementById('callbacksBulkMarkBtn');
            i instanceof HTMLButtonElement && (i.disabled = 0 === e);
        })(s.length, l.size),
        (function (t, e, a, n) {
            r(
                '#callbacksDeckSummary',
                a > 0
                    ? `${t.pendingCount} pendiente(s), ${t.hotCount} hot y ${e} visibles.`
                    : 'Sin callbacks pendientes.'
            );
            const i = document.getElementById('callbacksQueueChip');
            i &&
                ((i.textContent =
                    'danger' === t.queueState
                        ? 'Prioridad alta'
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
                r('#callbacksNextWait', s ? $t(_t(s)) : '0 min'),
                r('#callbacksNextPreference', s ? Et(s) : '-'),
                r('#callbacksNextState', s ? Nt(s) : 'Pendiente'),
                r(
                    '#callbacksDeckHint',
                    s ? Dt(s, t.workerMode) : 'Sin bloqueos'
                ));
            const c = document.getElementById('callbacksSelectionChip');
            (c && c.classList.toggle('is-hidden', 0 === n),
                r('#callbacksSelectedCount', n));
        })(u, s.length, a.length, l.size));
}
function Ft(t, { persist: e = !0 } = {}) {
    (g((e) => ({ ...e, callbacks: { ...e.callbacks, ...t } })),
        e && xt(b().callbacks),
        Ht());
}
function Ot(t) {
    Ft({ filter: wt(t), selected: [] });
}
function Rt(t) {
    const e = Number(t?.id || 0);
    (g((a) => ({
        ...a,
        data: {
            ...a.data,
            callbacks: (a.data.callbacks || []).map((a) =>
                Number(a.id || 0) === e ? { ...a, ...t } : a
            ),
        },
        callbacks: {
            ...a.callbacks,
            selected: (a.callbacks.selected || []).filter(
                (t) => Number(t || 0) !== e
            ),
        },
    })),
        Ht());
}
async function jt(t, e) {
    const a = Number(t || 0);
    if (a <= 0) return null;
    const n = await q('callbacks', { method: 'PATCH', body: { id: a, ...e } });
    return n?.data || null;
}
async function zt(t, e = '') {
    const a = await jt(t, {
        status: 'contacted',
        fecha: e,
        leadOps: { outcome: 'contactado' },
    });
    return a
        ? (Rt(a), a)
        : ((function (t) {
              Rt({ id: t, status: 'contacted' });
          })(t),
          null);
}
const Vt = 'admin-availability-selected-date',
    Ut = 'admin-availability-month-anchor';
function Kt(t) {
    const e = String(t || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return e ? `${e[1]}:${e[2]}` : '';
}
function Qt(t) {
    return [...new Set(t.map(Kt).filter(Boolean))].sort();
}
function Wt(t) {
    const e = String(t || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return '';
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? '' : u(a) === e ? e : '';
}
function Gt(t) {
    const e = Wt(t);
    if (!e) return null;
    const a = new Date(`${e}T12:00:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Jt(t) {
    const e = {};
    return (
        Object.keys(t || {})
            .sort()
            .forEach((a) => {
                const n = Wt(a);
                if (!n) return;
                const i = Qt(Array.isArray(t[a]) ? t[a] : []);
                i.length && (e[n] = i);
            }),
        e
    );
}
function Yt(t) {
    return Jt(t || {});
}
function Zt(t) {
    return JSON.stringify(Jt(t || {}));
}
function Xt(t, e = '') {
    let a = null;
    if (t instanceof Date && !Number.isNaN(t.getTime())) a = new Date(t);
    else {
        const e = Wt(t);
        e && (a = new Date(`${e}T12:00:00`));
    }
    if (!a) {
        const t = Gt(e);
        a = t ? new Date(t) : new Date();
    }
    return (a.setDate(1), a.setHours(12, 0, 0, 0), a);
}
function te(t, e) {
    const a = Wt(t);
    if (a) return a;
    const n = Object.keys(e || {})[0];
    if (n) {
        const t = Wt(n);
        if (t) return t;
    }
    return u(new Date());
}
function ee() {
    const t = b(),
        e = Wt(t.availability.selectedDate),
        a = Xt(t.availability.monthAnchor, e);
    try {
        (e ? localStorage.setItem(Vt, e) : localStorage.removeItem(Vt),
            localStorage.setItem(Ut, u(a)));
    } catch (t) {}
}
function ae(t) {
    const e = Yt(b().data.availability || {});
    return Zt(t) !== Zt(e);
}
function ne() {
    return Yt(b().availability.draft || {});
}
function ie() {
    const t = b().data.availabilityMeta || {};
    return 'google' === String(t.source || '').toLowerCase();
}
function oe() {
    const t = b(),
        e = Wt(t.availability.selectedDate);
    if (e) return e;
    const a = Yt(t.availability.draft || {});
    return Object.keys(a)[0] || u(new Date());
}
function se(t, e) {
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
function re(t = 1) {
    const e = ne(),
        a = Object.keys(e).filter((t) => e[t]?.length > 0);
    if (!a.length) return '';
    const n = Wt(b().availability.selectedDate) || u(new Date());
    return (
        (t >= 0 ? a.sort() : a.sort().reverse()).find((e) =>
            t >= 0 ? e >= n : e <= n
        ) || ''
    );
}
function ce() {
    ((function () {
        const t = b(),
            e = Xt(t.availability.monthAnchor, t.availability.selectedDate),
            a = oe(),
            n = e.getMonth(),
            i = Yt(t.availability.draft),
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
                        e = oe();
                    return {
                        selectedDate: e,
                        slots: Qt(Yt(t.availability.draft)[e] || []),
                    };
                })(),
                n = ie();
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
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${t(se([], n))}</p>`
                      ));
        })(),
        (function () {
            const t = b(),
                a = oe(),
                n = Yt(t.availability.draft),
                i = Array.isArray(n[a]) ? Qt(n[a]) : [],
                o = ie(),
                {
                    sourceText: s,
                    modeText: c,
                    timezone: l,
                } = (function () {
                    const t = b().data.availabilityMeta || {},
                        e = ie();
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
                        const e = Gt(t);
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
                ),
                (function (t) {
                    const a = e('#addSlotForm'),
                        n = e('#availabilityQuickSlotPresets');
                    (a && a.classList.toggle('is-hidden', t),
                        n && n.classList.toggle('is-hidden', t));
                    const i = e('#newSlotTime');
                    i instanceof HTMLInputElement && (i.disabled = t);
                    const o = e('[data-action="add-time-slot"]');
                    o instanceof HTMLButtonElement && (o.disabled = t);
                })(o));
            const u = Array.isArray(t.availability.clipboard)
                ? t.availability.clipboard.length
                : 0;
            let d = se(i, o);
            (o
                ? (d = 'Edicion bloqueada por proveedor Google')
                : t.availability.lastAction
                  ? (d = String(t.availability.lastAction))
                  : u && (d = `Portapapeles: ${u} slots`),
                r('#availabilityDayActionsStatus', d),
                (function (t, e, a) {
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
                                        ? (n.disabled = e)
                                        : (n.disabled = e || 0 === a)
                                    : (n.disabled =
                                          e || !t.availability.draftDirty));
                        });
                })(t, o, u));
        })(),
        ee());
}
function le(t, { render: e = !1 } = {}) {
    (g((e) => ({ ...e, availability: { ...e.availability, ...t } })),
        e ? ce() : ee());
}
function ue(t, e = {}) {
    const a = Yt(t),
        n = te(e.selectedDate || b().availability.selectedDate, a);
    le(
        {
            draft: a,
            selectedDate: n,
            monthAnchor: Xt(e.monthAnchor || b().availability.monthAnchor, n),
            draftDirty: ae(a),
            ...e,
        },
        { render: !0 }
    );
}
function de(t) {
    le({ lastAction: String(t || '') }, { render: !0 });
}
function pe(t, e, a = '') {
    const n = Wt(t) || oe();
    if (!n) return;
    const i = ne(),
        o = Qt(Array.isArray(e) ? e : []);
    (o.length ? (i[n] = o) : delete i[n],
        ue(i, { selectedDate: n, monthAnchor: n, lastAction: a }));
}
function me(t, e) {
    const a = Wt(t);
    a &&
        le(
            { selectedDate: a, monthAnchor: Xt(a, a), lastAction: e || '' },
            { render: !0 }
        );
}
function be() {
    return Wt(b().availability.selectedDate) || oe();
}
function ge(t) {
    return Kt(t);
}
function fe(t) {
    if (ie()) return;
    const e = b(),
        a = be();
    if (!a) return;
    const n = Array.isArray(e.availability.draft[a])
            ? e.availability.draft[a]
            : [],
        i = (function (t, e) {
            const a = Gt(t);
            return a ? (a.setDate(a.getDate() + Number(e || 0)), u(a)) : '';
        })(a, t);
    i && pe(i, n, `Duplicado ${n.length} slots en ${i}`);
}
function he() {
    return Boolean(b().availability.draftDirty);
}
function ye() {
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
function ve(t) {
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
function ke() {
    const t = document.getElementById('queueSensitiveConfirmDialog');
    (t instanceof HTMLDialogElement && t.open && t.close(),
        t instanceof HTMLElement &&
            (t.removeAttribute('open'), (t.hidden = !0)),
        g((t) => ({
            ...t,
            queue: { ...t.queue, pendingSensitiveAction: null },
        })));
}
function we(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function Se(t) {
    const e = we(t);
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
function qe(t) {
    const e = we(t);
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
function Ce(t) {
    return Array.isArray(t) ? t : [];
}
function Ae(t, e = 0) {
    const a = Number(t);
    return Number.isFinite(a) ? a : e;
}
function _e(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function $e(...t) {
    for (const e of t) {
        const t = String(e ?? '').trim();
        if (t) return t;
    }
    return '';
}
let Te = '';
function Me(t) {
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
        estimatedWaitMin: e.length ? 8 * e.length : 0,
        delayReason: '',
        assistancePendingCount: t.filter((t) => t.needsAssistance).length,
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
                needsAssistance: Boolean(t.needsAssistance),
                assistanceRequestStatus: String(
                    t.assistanceRequestStatus || ''
                ),
                specialPriority: Boolean(t.specialPriority),
                lateArrival: Boolean(t.lateArrival),
                reprintRequestedAt: String(t.reprintRequestedAt || ''),
                estimatedWaitMin: Number(t.estimatedWaitMin || 8 * e || 0),
            })),
        activeHelpRequests: [],
    };
}
function Le(t, e = 0) {
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
        status: Se(t?.status || 'waiting'),
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
        needsAssistance: Boolean(
            t?.needsAssistance ?? t?.needs_assistance ?? !1
        ),
        assistanceRequestStatus: String(
            t?.assistanceRequestStatus || t?.assistance_request_status || ''
        ),
        specialPriority: Boolean(
            t?.specialPriority ?? t?.special_priority ?? !1
        ),
        lateArrival: Boolean(t?.lateArrival ?? t?.late_arrival ?? !1),
        reprintRequestedAt: String(
            t?.reprintRequestedAt || t?.reprint_requested_at || ''
        ),
        estimatedWaitMin:
            Number(t?.estimatedWaitMin ?? t?.estimated_wait_min ?? -1) >= 0
                ? Number(t?.estimatedWaitMin ?? t?.estimated_wait_min)
                : null,
    };
}
function Ee(t, e = 0, a = {}) {
    const n = t && 'object' == typeof t ? t : {},
        i = Le({ ...n, ...a }, e);
    return (
        $e(n.createdAt, n.created_at) || (i.createdAt = ''),
        $e(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        $e(n.queueType, n.queue_type) || (i.queueType = ''),
        $e(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        $e(n.assistanceRequestStatus, n.assistance_request_status) ||
            (i.assistanceRequestStatus = ''),
        $e(n.reprintRequestedAt, n.reprint_requested_at) ||
            (i.reprintRequestedAt = ''),
        i
    );
}
function Ne(t, e, a) {
    return (
        t[String(a)] ||
        t[a] ||
        e.find(
            (t) =>
                Number(
                    t?.assignedConsultorio || t?.assigned_consultorio || 0
                ) === a
        ) ||
        null
    );
}
function De(t, e, a) {
    return t ? Ee(t, e, { status: 'called', assignedConsultorio: a }) : null;
}
function Be(t, e = []) {
    const a = t && 'object' == typeof t ? t : {},
        n = (function (t) {
            return t.counts && 'object' == typeof t.counts ? t.counts : {};
        })(a),
        i = (function (t) {
            return t.callingNowByConsultorio &&
                'object' == typeof t.callingNowByConsultorio
                ? t.callingNowByConsultorio
                : t.calling_now_by_consultorio &&
                    'object' == typeof t.calling_now_by_consultorio
                  ? t.calling_now_by_consultorio
                  : {};
        })(a),
        o = (function (t) {
            return Ce(t.callingNow).concat(Ce(t.calling_now));
        })(a),
        s = (function (t) {
            const e = Ce(t).map((t, e) => Le(t, e));
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
            return { c1: De(Ne(t, e, 1), 0, 1), c2: De(Ne(t, e, 2), 1, 2) };
        })(i, o),
        l = (function (t) {
            return Ce(t.nextTickets)
                .concat(Ce(t.next_tickets))
                .map((t, e) =>
                    Ee(
                        {
                            ...t,
                            status: t?.status || 'waiting',
                            assignedConsultorio: null,
                        },
                        e
                    )
                );
        })(a),
        u = (function (t, e, a, n, i) {
            const o = Math.max(
                Number(Boolean(i.c1)) + Number(Boolean(i.c2)),
                n.calledFromTickets
            );
            return {
                waitingCount: Ae(
                    t.waitingCount ??
                        t.waiting_count ??
                        e.waiting ??
                        a.length ??
                        n.waitingFromTickets,
                    0
                ),
                calledCount: Ae(
                    t.calledCount ?? t.called_count ?? e.called ?? o,
                    0
                ),
                completedCount: Ae(
                    e.completed ??
                        t.completedCount ??
                        t.completed_count ??
                        n.completedFromTickets,
                    0
                ),
                noShowCount: Ae(
                    e.no_show ??
                        e.noShow ??
                        t.noShowCount ??
                        t.no_show_count ??
                        n.noShowFromTickets,
                    0
                ),
                cancelledCount: Ae(
                    e.cancelled ??
                        e.canceled ??
                        t.cancelledCount ??
                        t.cancelled_count ??
                        n.cancelledFromTickets,
                    0
                ),
            };
        })(a, n, l, s, { c1: r, c2: c });
    return {
        updatedAt: String(
            a.updatedAt || a.updated_at || new Date().toISOString()
        ),
        waitingCount: u.waitingCount,
        calledCount: u.calledCount,
        estimatedWaitMin: Math.max(
            0,
            Number(a.estimatedWaitMin || a.estimated_wait_min || 0)
        ),
        delayReason: String(a.delayReason || a.delay_reason || ''),
        assistancePendingCount: Math.max(
            0,
            Number(a.assistancePendingCount || a.assistance_pending_count || 0)
        ),
        counts: {
            waiting: u.waitingCount,
            called: u.calledCount,
            completed: u.completedCount,
            no_show: u.noShowCount,
            cancelled: u.cancelledCount,
        },
        callingNowByConsultorio: { 1: r, 2: c },
        nextTickets: l,
        activeHelpRequests: Array.isArray(a.activeHelpRequests)
            ? a.activeHelpRequests
            : Array.isArray(a.active_help_requests)
              ? a.active_help_requests
              : [],
    };
}
function Pe(t, e) {
    return Object.prototype.hasOwnProperty.call(t || {}, e);
}
function Ie(t) {
    return t?.counts && 'object' == typeof t.counts ? t.counts : null;
}
function xe(t) {
    const e = Le(t, 0);
    return e.id > 0 ? `id:${e.id}` : `code:${we(e.ticketCode || '')}`;
}
function He(t, e) {
    if (!e) return;
    const a = Le(e, t.size);
    ($e(e?.createdAt, e?.created_at) || (a.createdAt = ''),
        $e(e?.priorityClass, e?.priority_class) || (a.priorityClass = ''),
        $e(e?.queueType, e?.queue_type) || (a.queueType = ''),
        t.set(xe(a), a));
}
function Fe(t) {
    const e = Be(t),
        a = new Map(),
        n =
            e.callingNowByConsultorio?.[1] ||
            e.callingNowByConsultorio?.[1] ||
            null,
        i =
            e.callingNowByConsultorio?.[2] ||
            e.callingNowByConsultorio?.[2] ||
            null;
    (n && He(a, { ...n, status: 'called', assignedConsultorio: 1 }),
        i && He(a, { ...i, status: 'called', assignedConsultorio: 2 }));
    for (const t of Ce(e.nextTickets))
        He(a, { ...t, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function Oe() {
    const t = b(),
        e = Array.isArray(t.data.queueTickets)
            ? t.data.queueTickets.map((t, e) => Le(t, e))
            : [];
    return {
        queueTickets: e,
        queueMeta:
            t.data.queueMeta && 'object' == typeof t.data.queueMeta
                ? Be(t.data.queueMeta, e)
                : Me(e),
    };
}
function Re() {
    const t = b(),
        { queueTickets: e } = Oe();
    return (function (t, e) {
        const a = we(e);
        return a
            ? t.filter((t) =>
                  [t.ticketCode, t.patientInitials, t.status, t.queueType].some(
                      (t) => we(t).includes(a)
                  )
              )
            : t;
    })(
        (function (t, e) {
            const a = we(e);
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
                                        (Date.now() - _e(t.createdAt)) / 6e4
                                    )
                                ) >= 20 ||
                                    'appt_overdue' === we(t.priorityClass))
                        )
                      : t;
        })(e, t.queue.filter),
        t.queue.search
    );
}
function je(t, e = null) {
    const a = Array.isArray(e) ? e : Oe().queueTickets,
        n = new Set(a.map((t) => Number(t.id || 0)).filter((t) => t > 0));
    return [...new Set(Ce(t).map((t) => Number(t || 0)))]
        .filter((t) => t > 0 && n.has(t))
        .sort((t, e) => t - e);
}
function ze() {
    return je(b().queue.selected || []);
}
function Ve() {
    const t = (function () {
        const t = new Set(ze());
        return t.size
            ? Oe().queueTickets.filter((e) => t.has(Number(e.id || 0)))
            : [];
    })();
    return t.length ? t : Re();
}
function Ue(t) {
    const e = 2 === Number(t || 0) ? 2 : 1;
    return (
        Oe().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Ke() {
    const t = b(),
        e = Number(t.queue.stationConsultorio || 1);
    return (
        Oe().queueTickets.find(
            (t) =>
                'called' === t.status &&
                Number(t.assignedConsultorio || 0) === e
        ) || null
    );
}
function Qe(e) {
    const a = e.assignedConsultorio ? `C${e.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - _e(e.createdAt)) / 6e4)),
        i = Number(e.id || 0),
        o = new Set(ze()).has(i),
        s = 'called' === e.status,
        r = s && e.assignedConsultorio,
        c = s,
        l = 'operator' === document.body?.dataset.queueSurface,
        u = [
            e.specialPriority ? 'Prioridad' : '',
            e.needsAssistance ? 'Apoyo' : '',
            e.lateArrival ? 'Tarde' : '',
            e.reprintRequestedAt ? 'Reimpresion' : '',
        ].filter(Boolean),
        d = `\n        <div>${t(e.ticketCode)}</div>\n        ${u.length ? `<div class="queue-row-flags">${u.map((e) => `<span>${t(e)}</span>`).join(' · ')}</div>` : ''}\n    `,
        p = l
            ? `<span class="queue-row-marker">${t(s ? 'Live' : 'Fila')}</span>`
            : `<label class="queue-select-cell">\n                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${i}" ${o ? 'checked' : ''} />\n                </label>`,
        m = l
            ? `\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    ${e.needsAssistance ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="atender_apoyo">Atender apoyo</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="resolver_apoyo">Resolver apoyo</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                `
            : `\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>\n                    ${c ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="re-llamar" data-queue-consultorio="${2 === Number(e.assignedConsultorio || 1) ? 2 : 1}">Re-llamar</button>` : ''}\n                    ${r ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="liberar">Liberar</button>` : ''}\n                    ${e.needsAssistance ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="atender_apoyo">Atender apoyo</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="resolver_apoyo">Resolver apoyo</button>` : ''}\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="completar">Completar</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="no_show">No show</button>\n                    <button type="button" data-action="queue-ticket-action" data-queue-id="${i}" data-queue-action="cancelar">Cancelar</button>\n                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${i}">Reimprimir</button>\n                `;
    return `\n        <tr data-queue-id="${i}" class="${o ? 'is-selected' : ''}">\n            <td>\n                ${p}\n            </td>\n            <td>${d}</td>\n            <td>${t(e.queueType)}</td>\n            <td>${t(
        (function (t) {
            switch (Se(t)) {
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
    )}</td>\n            <td>${a}</td>\n            <td>${n} min</td>\n            <td>\n                <div class="table-actions">\n                    ${m}\n                </div>\n            </td>\n        </tr>\n    `;
}
const We = Object.freeze({
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
    Ge = Object.freeze({
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
    });
let Je = null;
function Ye() {
    const t = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    return t.includes('mac') ? 'mac' : t.includes('win') ? 'win' : 'other';
}
function Ze(t) {
    try {
        return new URL(String(t || ''), window.location.origin).toString();
    } catch (e) {
        return String(t || '');
    }
}
function Xe(t) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(Ze(t))}`;
}
function ta(t, e, a) {
    const n = new URL(
        String(a.guideUrl || `/app-downloads/?surface=${t}`),
        `${window.location.origin}/`
    );
    return (
        n.searchParams.set('surface', t),
        'sala_tv' === t
            ? n.searchParams.set('platform', 'android_tv')
            : n.searchParams.set(
                  'platform',
                  'mac' === e.platform ? 'mac' : 'win'
              ),
        'operator' === t
            ? (n.searchParams.set('station', 'c2' === e.station ? 'c2' : 'c1'),
              n.searchParams.set('lock', e.lock ? '1' : '0'),
              n.searchParams.set('one_tap', e.oneTap ? '1' : '0'))
            : (n.searchParams.delete('station'),
              n.searchParams.delete('lock'),
              n.searchParams.delete('one_tap')),
        `${n.pathname}${n.search}`
    );
}
function ea(t) {
    if (Je) return Je;
    const e = b();
    return (
        (Je = {
            surface: 'operator',
            station:
                2 === Number(e.queue && e.queue.stationConsultorio)
                    ? 'c2'
                    : 'c1',
            lock: Boolean(e.queue && 'locked' === e.queue.stationMode),
            oneTap: Boolean(e.queue && e.queue.oneTap),
            platform: 'win' === t || 'mac' === t ? t : 'win',
        }),
        Je
    );
}
function aa(t, e) {
    return 'mac' === e && t.targets.mac
        ? t.targets.mac
        : 'win' === e && t.targets.win
          ? t.targets.win
          : t.targets.win || t.targets.mac || null;
}
function na(e, a, n) {
    const o = Ge[e],
        s = ea(n),
        r = aa(a, n),
        c =
            'mac' === n
                ? 'macOS'
                : 'win' === n
                  ? 'Windows'
                  : (r && r.label) || 'este equipo',
        l = Object.entries(a.targets || {})
            .filter(([t, e]) => e && e.url)
            .map(
                ([e, a]) =>
                    `\n                <a\n                    href="${t(a.url)}"\n                    class="${e === n ? 'queue-app-card__recommended' : ''}"\n                    download\n                >\n                    ${t(a.label || e)}\n                </a>\n            `
            )
            .join('');
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${t(o.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${t(o.title)}</h5>\n                <p class="queue-app-card__description">${t(o.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${t(a.version || '0.1.0')} · ${t(i(a.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${t(o.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                ${r && r.url ? `<a href="${t(r.url)}" class="queue-app-card__cta-primary" download>Descargar para ${t(c)}</a>` : ''}\n            </div>\n            <div class="queue-app-card__targets">${l}</div>\n            <div class="queue-app-card__links">\n                <a href="${t(a.webFallbackUrl || '/')}">Abrir versión web</a>\n                <a href="${t(ta(e, s, a))}">Centro de instalación</a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${t(Ze((r && r.url) || ''))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${o.notes.map((e) => `<li>${t(e)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function ia(e) {
    const a = Ge.sala_tv,
        n = ea(Ye()),
        o = e.targets.android_tv || {},
        s = String(o.url || ''),
        r = Xe(s);
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${t(a.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${t(a.title)}</h5>\n                <p class="queue-app-card__description">${t(a.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${t(e.version || '0.1.0')} · ${t(i(e.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${t(a.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                <a\n                    href="${t(r)}"\n                    class="queue-app-card__cta-primary"\n                    target="_blank"\n                    rel="noopener"\n                >\n                    Mostrar QR de instalación\n                </a>\n                <a href="${t(s)}" download>Descargar APK</a>\n            </div>\n            <div class="queue-app-card__links">\n                <a href="${t(e.webFallbackUrl || '/sala-turnos.html')}">\n                    Abrir fallback web\n                </a>\n                <a href="${t(ta('sala_tv', n, e))}">\n                    Centro de instalación\n                </a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${t(Ze(s))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${a.notes.map((e) => `<li>${t(e)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function oa(e, a) {
    const n = document.getElementById('queueInstallConfigurator');
    if (!(n instanceof HTMLElement)) return;
    const i = ea(a),
        o =
            'kiosk' === i.surface || 'sala_tv' === i.surface
                ? i.surface
                : 'operator',
        s = e[o];
    if (!s) return void (n.innerHTML = '');
    const r =
            'sala_tv' === o
                ? 'android_tv'
                : 'mac' === i.platform
                  ? 'mac'
                  : 'win',
        l = (s.targets && s.targets[r]) || aa(s, a) || null,
        u = (function (t, e, a) {
            const n = new URL(
                String(e.webFallbackUrl || '/'),
                `${window.location.origin}/`
            );
            return (
                'operator' === t &&
                    (n.searchParams.set(
                        'station',
                        'c2' === a.station ? 'c2' : 'c1'
                    ),
                    n.searchParams.set('lock', a.lock ? '1' : '0'),
                    n.searchParams.set('one_tap', a.oneTap ? '1' : '0')),
                n.toString()
            );
        })(o, s, i),
        d = Xe(('sala_tv' === o && l && l.url) || u),
        p = ta(o, i, s),
        m = (function (t) {
            if ('sala_tv' === t.surface)
                return [
                    'Abre el QR desde otra pantalla o descarga la APK directamente.',
                    'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
                    'Valida audio, reconexión y que la sala refleje llamados reales.',
                ];
            if ('kiosk' === t.surface)
                return [
                    'Instala la app en el mini PC o PC del kiosco.',
                    'Deja la impresora térmica conectada y la app en fullscreen.',
                    'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
                ];
            const e = 'c2' === t.station ? 'C2' : 'C1';
            return [
                `Instala Turnero Operador en el PC de ${e} y conecta el receptor USB del Genius Numpad 1000.`,
                `En el primer arranque deja el equipo como ${t.lock ? `${e} fijo` : 'modo libre'}${t.oneTap ? ' con 1 tecla' : ''}.`,
                'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
            ];
        })(i)
            .map((e) => `<li>${t(e)}</li>`)
            .join('');
    c(
        '#queueInstallConfigurator',
        `\n            <div class="queue-install-configurator__grid">\n                <section class="queue-install-configurator__panel">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Preparar equipo</p>\n                        <h5 class="queue-app-card__title">Asistente de instalación</h5>\n                        <p class="queue-app-card__description">\n                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.\n                        </p>\n                    </div>\n                    <div class="queue-install-configurator__fields">\n                        <label class="queue-install-field" for="queueInstallSurfaceSelect">\n                            <span>Equipo</span>\n                            <select id="queueInstallSurfaceSelect">\n                                <option value="operator"${'operator' === o ? ' selected' : ''}>Operador</option>\n                                <option value="kiosk"${'kiosk' === o ? ' selected' : ''}>Kiosco</option>\n                                <option value="sala_tv"${'sala_tv' === o ? ' selected' : ''}>Sala TV</option>\n                            </select>\n                        </label>\n                        ${'operator' === o ? `\n                                    <label class="queue-install-field" for="queueInstallProfileSelect">\n                                        <span>Perfil operador</span>\n                                        <select id="queueInstallProfileSelect">\n                                            <option value="c1_locked"${i.lock && 'c1' === i.station ? ' selected' : ''}>C1 fijo</option>\n                                            <option value="c2_locked"${i.lock && 'c2' === i.station ? ' selected' : ''}>C2 fijo</option>\n                                            <option value="free"${i.lock ? '' : ' selected'}>Modo libre</option>\n                                        </select>\n                                    </label>\n                                ` : ''}\n                        ${'sala_tv' !== o ? `\n                                    <label class="queue-install-field" for="queueInstallPlatformSelect">\n                                        <span>Plataforma</span>\n                                        <select id="queueInstallPlatformSelect">\n                                            <option value="win"${'win' === i.platform ? ' selected' : ''}>Windows</option>\n                                            <option value="mac"${'mac' === i.platform ? ' selected' : ''}>macOS</option>\n                                        </select>\n                                    </label>\n                                ` : ''}\n                        ${'operator' === o ? `\n                                    <label class="queue-install-toggle">\n                                        <input id="queueInstallOneTapInput" type="checkbox"${i.oneTap ? ' checked' : ''} />\n                                        <span>Activar 1 tecla para este operador</span>\n                                    </label>\n                                ` : ''}\n                    </div>\n                </section>\n                <section class="queue-install-configurator__panel queue-install-configurator__result">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Resultado listo</p>\n                        <h5 class="queue-app-card__title">${t(
            (function (t) {
                return 'sala_tv' === t.surface
                    ? 'Sala TV lista para TCL C655'
                    : 'kiosk' === t.surface
                      ? 'Kiosco listo para mostrador'
                      : t.lock
                        ? `Operador ${'c2' === t.station ? 'C2' : 'C1'} fijo`
                        : 'Operador en modo libre';
            })(i)
        )}</h5>\n                        <p class="queue-app-card__description">\n                            ${'sala_tv' === o ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}\n                        </p>\n                    </div>\n                    <div class="queue-install-result__chips">\n                        <span class="queue-app-card__tag">\n                            ${t(l && l.label ? l.label : 'Perfil listo')}\n                        </span>\n                        ${'operator' === o ? `<span class="queue-app-card__tag">${i.lock ? ('c2' === i.station ? 'C2 bloqueado' : 'C1 bloqueado') : 'Modo libre'}</span>` : ''}\n                    </div>\n                    <div class="queue-install-result__meta">\n                        <span>Descarga recomendada</span>\n                        <strong>${t((l && l.url) || 'Sin artefacto')}</strong>\n                    </div>\n                    <div class="queue-install-result__meta">\n                        <span>Ruta web preparada</span>\n                        <strong>${t(u)}</strong>\n                    </div>\n                    <div class="queue-install-configurator__actions">\n                        ${l && l.url ? `<a href="${t(l.url)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>` : ''}\n                        <button\n                            type="button"\n                            data-action="queue-copy-install-link"\n                            data-queue-install-url="${t(Ze((l && l.url) || ''))}"\n                        >\n                            Copiar descarga\n                        </button>\n                        <a href="${t(u)}" target="_blank" rel="noopener">\n                            Abrir ruta preparada\n                        </a>\n                        <button\n                            type="button"\n                            data-action="queue-copy-install-link"\n                            data-queue-install-url="${t(u)}"\n                        >\n                            Copiar ruta preparada\n                        </button>\n                        <a href="${t(d)}" target="_blank" rel="noopener">\n                            Mostrar QR\n                        </a>\n                        <a href="${t(p)}" target="_blank" rel="noopener">\n                            Abrir centro público\n                        </a>\n                    </div>\n                    <ul class="queue-app-card__notes">${m}</ul>\n                </section>\n            </div>\n        `
    );
    const b = document.getElementById('queueInstallSurfaceSelect');
    b instanceof HTMLSelectElement &&
        (b.onchange = () => {
            ((Je = { ...i, surface: b.value }), oa(e, a));
        });
    const g = document.getElementById('queueInstallProfileSelect');
    g instanceof HTMLSelectElement &&
        (g.onchange = () => {
            ((Je = {
                ...i,
                station: 'c2_locked' === g.value ? 'c2' : 'c1',
                lock: 'free' !== g.value,
            }),
                oa(e, a));
        });
    const f = document.getElementById('queueInstallPlatformSelect');
    f instanceof HTMLSelectElement &&
        (f.onchange = () => {
            ((Je = { ...i, platform: 'mac' === f.value ? 'mac' : 'win' }),
                oa(e, a));
        });
    const h = document.getElementById('queueInstallOneTapInput');
    h instanceof HTMLInputElement &&
        (h.onchange = () => {
            ((Je = { ...i, oneTap: h.checked }), oa(e, a));
        });
}
function sa() {
    if (
        !(
            document.getElementById('queueAppDownloadsCards') instanceof
            HTMLElement
        )
    )
        return;
    const t = Ye(),
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
    const a = (function () {
        const t = b().data.appDownloads;
        return t && 'object' == typeof t
            ? {
                  operator: {
                      ...We.operator,
                      ...(t.operator || {}),
                      targets: {
                          ...We.operator.targets,
                          ...((t.operator && t.operator.targets) || {}),
                      },
                  },
                  kiosk: {
                      ...We.kiosk,
                      ...(t.kiosk || {}),
                      targets: {
                          ...We.kiosk.targets,
                          ...((t.kiosk && t.kiosk.targets) || {}),
                      },
                  },
                  sala_tv: {
                      ...We.sala_tv,
                      ...(t.sala_tv || {}),
                      targets: {
                          ...We.sala_tv.targets,
                          ...((t.sala_tv && t.sala_tv.targets) || {}),
                      },
                  },
              }
            : We;
    })();
    (c(
        '#queueAppDownloadsCards',
        [
            na('operator', a.operator, t),
            na('kiosk', a.kiosk, t),
            ia(a.sala_tv),
        ].join('')
    ),
        oa(a, t));
}
function ra(e = () => {}) {
    const a = b(),
        { queueMeta: n } = Oe(),
        i = Re(),
        o = ze(),
        s = Ve(),
        l = Ue(a.queue.stationConsultorio);
    (sa(),
        (function (t, e) {
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
            if ('fallback' === we(a.queue.syncMode))
                return (
                    r('#queueSyncStatus', 'fallback'),
                    void (u && u.setAttribute('data-state', 'fallback'))
                );
            const d = String(t.updatedAt || '').trim();
            if (!d) return;
            const p = Math.max(0, Math.round((Date.now() - _e(d)) / 1e3)),
                m = p >= 60,
                g = Math.max(0, Number(t.assistancePendingCount || 0)),
                f = m ? `Watchdog (${p}s)` : 'vivo';
            if (
                (r('#queueSyncStatus', g ? `${f} · ${g} apoyo(s)` : f),
                u && u.setAttribute('data-state', m ? 'reconnecting' : 'live'),
                m)
            ) {
                const t = `stale-${Math.floor(p / 15)}`;
                return void (
                    t !== Te &&
                    ((Te = t), e('Watchdog de cola: realtime en reconnecting'))
                );
            }
            Te = 'live';
        })(n, e),
        (function (t) {
            c(
                '#queueTableBody',
                t.length
                    ? t.map(Qe).join('')
                    : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
            );
        })(i),
        (function (e, a) {
            const n = Ce(e.nextTickets),
                i = Number(e.waitingCount || e.counts?.waiting || 0),
                o =
                    a && n.length && i > n.length
                        ? `<li><span>-</span><strong>Mostrando primeros ${n.length} de ${i} en espera</strong></li>`
                        : '';
            c(
                '#queueNextAdminList',
                n.length
                    ? `${o}${n.map((e) => `<li><span>${t(e.ticketCode || e.ticket_code || '--')}</span><strong>${t(e.patientInitials || e.patient_initials || '--')}</strong></li>`).join('')}`
                    : '<li><span>-</span><strong>Sin siguientes</strong></li>'
            );
        })(n, a.queue.fallbackPartial),
        (function (e) {
            const a = Ce(e.activeHelpRequests);
            c(
                '#queueHelpRequestsList',
                a.length
                    ? a
                          .map((e) => {
                              const a = Number(e?.id || 0) || 0,
                                  n = String(
                                      e?.ticketCode ||
                                          e?.ticket_code ||
                                          'Sin ticket'
                                  ),
                                  i = String(
                                      e?.patientInitials ||
                                          e?.patient_initials ||
                                          '--'
                                  ),
                                  o = String(
                                      e?.reasonLabel ||
                                          e?.reason_label ||
                                          'Apoyo operativo'
                                  ),
                                  s = String(
                                      e?.status || 'pending'
                                  ).toLowerCase(),
                                  r = (function (t) {
                                      const e = String(t || '')
                                          .trim()
                                          .toLowerCase();
                                      return 'attended' === e
                                          ? 'Atendido'
                                          : 'resolved' === e
                                            ? 'Resuelto'
                                            : 'Pendiente';
                                  })(s),
                                  c =
                                      'resolved' === s
                                          ? ''
                                          : `\n                                    ${'pending' === s ? `<button type="button" data-action="queue-help-request-status" data-queue-help-id="${a}" data-queue-help-status="attended">Atender</button>` : ''}\n                                    <button type="button" data-action="queue-help-request-status" data-queue-help-id="${a}" data-queue-help-status="resolved">Resolver</button>\n                                `;
                              return `\n                            <li>\n                                <span>${t(n)} · ${t(i)}</span>\n                                <strong>${t(o)} · ${t(r)}</strong>\n                                ${c ? `<div class="table-actions">${c}</div>` : ''}\n                            </li>\n                        `;
                          })
                          .join('')
                    : '<li><span>-</span><strong>Sin apoyos pendientes</strong></li>'
            );
        })(n),
        (function ({
            state: t,
            visible: e,
            selectedCount: a,
            activeStationTicket: n,
        }) {
            const i = (function (t) {
                    return t.filter(
                        (t) =>
                            'waiting' === t.status &&
                            (Math.max(
                                0,
                                Math.round((Date.now() - _e(t.createdAt)) / 6e4)
                            ) >= 20 ||
                                'appt_overdue' === we(t.priorityClass))
                    ).length;
                })(e),
                o = [i > 0 ? `riesgo: ${i}` : 'sin riesgo'];
            (a > 0 && o.push(`seleccion: ${a}`),
                t.queue.fallbackPartial && o.push('fallback parcial'),
                n &&
                    o.push(
                        `activo: ${n.ticketCode} en C${t.queue.stationConsultorio}`
                    ),
                r('#queueTriageSummary', o.join(' | ')));
        })({
            state: a,
            visible: i,
            selectedCount: o.length,
            activeStationTicket: l,
        }),
        (function ({ visibleCount: t, selectedCount: e, bulkTargetCount: a }) {
            r('#queueSelectedCount', e);
            const n = document.getElementById('queueSelectionChip');
            n instanceof HTMLElement &&
                n.classList.toggle('is-hidden', 0 === e);
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
                            (t.disabled = 0 === a);
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
                        const a =
                            2 === Number(e.dataset.queueConsultorio || 1)
                                ? 2
                                : 1;
                        e.disabled =
                            'locked' === t.queue.stationMode &&
                            a !== Number(t.queue.stationConsultorio || 1);
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
                                n === Number(t.queue.stationConsultorio || 1)
                                    ? e
                                    : Ue(n);
                        ((a.disabled = !i),
                            'locked' === t.queue.stationMode &&
                                n !== Number(t.queue.stationConsultorio || 1) &&
                                (a.disabled = !0));
                    }));
        })(a, l),
        (function (t) {
            const e = document.getElementById('queuePracticeModeBadge');
            e instanceof HTMLElement && (e.hidden = !t.queue.practiceMode);
            const a = document.getElementById('queueShortcutPanel');
            a instanceof HTMLElement && (a.hidden = !t.queue.helpOpen);
            const n = document.querySelector(
                '[data-action="queue-clear-call-key"]'
            );
            n instanceof HTMLElement && (n.hidden = !t.queue.customCallKey);
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
        })(a),
        ye());
}
function ca(t) {
    g((e) => {
        const a = [
            { at: new Date().toISOString(), message: String(t || '') },
            ...(e.queue.activity || []),
        ].slice(0, 30);
        return { ...e, queue: { ...e.queue, activity: a } };
    });
    try {
        ye();
    } catch (t) {}
}
function la(t, { render: e = !0 } = {}) {
    (g((e) => ({
        ...e,
        queue: { ...e.queue, selected: je(t, e.data.queueTickets || []) },
    })),
        e && ra(ca));
}
function ua() {
    la([]);
}
function da(t, e = '') {
    try {
        const a = localStorage.getItem(t);
        return null === a ? e : a;
    } catch (t) {
        return e;
    }
}
function pa(t, e) {
    try {
        localStorage.setItem(t, String(e));
    } catch (t) {}
}
function ma(t, e) {
    try {
        const a = localStorage.getItem(t);
        return a ? JSON.parse(a) : e;
    } catch (t) {
        return e;
    }
}
function ba(t, e) {
    try {
        localStorage.setItem(t, JSON.stringify(e));
    } catch (t) {}
}
function ga(t) {
    try {
        return new URL(window.location.href).searchParams.get(t) || '';
    } catch (t) {
        return '';
    }
}
const fa = 'queueStationMode',
    ha = 'queueStationConsultorio',
    ya = 'queueOneTapAdvance',
    va = 'queueCallKeyBindingV1',
    ka = 'queueNumpadHelpOpen',
    wa = 'queueAdminLastSnapshot',
    Sa = new Map([
        [1, !1],
        [2, !1],
    ]),
    qa = new Set(['no_show', 'cancelar']);
function Ca(t) {
    (pa(fa, t.queue.stationMode || 'free'),
        pa(ha, t.queue.stationConsultorio || 1),
        pa(ya, t.queue.oneTap ? '1' : '0'),
        pa(ka, t.queue.helpOpen ? '1' : '0'),
        t.queue.customCallKey
            ? ba(va, t.queue.customCallKey)
            : (function (t) {
                  try {
                      localStorage.removeItem(t);
                  } catch (t) {}
              })(va),
        ba(wa, {
            queueMeta: t.data.queueMeta,
            queueTickets: t.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Aa(t, e = null, a = {}) {
    const n = (Array.isArray(t) ? t : []).map((t, e) => Le(t, e)),
        i = Be(e && 'object' == typeof e ? e : Me(n), n),
        o = n.filter((t) => 'waiting' === t.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === we(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === we(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live';
    (g((t) => ({
        ...t,
        data: { ...t.data, queueTickets: n, queueMeta: i },
        queue: {
            ...t.queue,
            selected: je(t.queue.selected || [], n),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        Ca(b()),
        ra(ca));
}
function _a(t, e) {
    const a = Number(t || 0),
        n = (b().data.queueTickets || []).map((t, n) => {
            const i = Le(t, n);
            return i.id !== a
                ? i
                : Le('function' == typeof e ? e(i) : { ...i }, n);
        });
    Aa(n, Me(n), { fallbackPartial: !1, syncMode: 'live' });
}
function $a(t) {
    (g((e) => ({ ...e, queue: { ...e.queue, ...t } })), Ca(b()), ra(ca));
}
function Ta(t) {
    $a({ filter: we(t) || 'all', selected: [] });
}
function Ma(t, e) {
    const a = $e(e.createdAt, e.created_at, t?.createdAt, t?.created_at),
        n = $e(
            e.priorityClass,
            e.priority_class,
            t?.priorityClass,
            t?.priority_class,
            'walk_in'
        ),
        i = $e(
            e.queueType,
            e.queue_type,
            t?.queueType,
            t?.queue_type,
            'walk_in'
        ),
        o = $e(
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
        createdAt: a || new Date().toISOString(),
        priorityClass: n,
        queueType: i,
        patientInitials: o,
    };
}
function La(t, e = {}) {
    const { queueState: a, payloadTicket: n } = (function (t) {
        const e =
                t?.data?.queueState ||
                t?.data?.queue_state ||
                t?.data?.queueMeta ||
                t?.data ||
                null,
            a =
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
                e && 'object' == typeof e ? { ...e, __fullTickets: a } : e,
            payloadTicket: t?.data?.ticket || null,
        };
    })(t);
    if (!a || 'object' != typeof a) return;
    const i = (b().data.queueTickets || []).map((t, e) => Le(t, e)),
        o = a.__fullTickets || [];
    if (
        !(function (t, e, a) {
            return (
                e.length > 0 ||
                !!(
                    Pe(t, 'queue_tickets') ||
                    Pe(t, 'queueTickets') ||
                    Pe(t, 'tickets')
                ) ||
                !(!a || 'object' != typeof a) ||
                !!(function (t) {
                    return (
                        Pe(t, 'waitingCount') ||
                        Pe(t, 'waiting_count') ||
                        Pe(t, 'calledCount') ||
                        Pe(t, 'called_count') ||
                        Pe(t, 'completedCount') ||
                        Pe(t, 'completed_count') ||
                        Pe(t, 'noShowCount') ||
                        Pe(t, 'no_show_count') ||
                        Pe(t, 'cancelledCount') ||
                        Pe(t, 'cancelled_count')
                    );
                })(t) ||
                !!(function (t) {
                    const e = Ie(t);
                    return Boolean(
                        e &&
                        (Pe(e, 'waiting') ||
                            Pe(e, 'called') ||
                            Pe(e, 'completed') ||
                            Pe(e, 'no_show') ||
                            Pe(e, 'noShow') ||
                            Pe(e, 'cancelled') ||
                            Pe(e, 'canceled'))
                    );
                })(t) ||
                !(!Pe(t, 'nextTickets') && !Pe(t, 'next_tickets')) ||
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
                        Ce(t?.callingNow)
                            .concat(Ce(t?.calling_now))
                            .some(Boolean)
                    );
                })(t)
            );
        })(a, o, n)
    )
        return;
    const s = 'fallback' === we(e.syncMode) ? 'fallback' : 'live',
        r = Be(a, i),
        c = (function (t) {
            const e = Ie(t),
                a =
                    Pe(t, 'waitingCount') ||
                    Pe(t, 'waiting_count') ||
                    Boolean(e && Pe(e, 'waiting')),
                n =
                    Pe(t, 'calledCount') ||
                    Pe(t, 'called_count') ||
                    Boolean(e && Pe(e, 'called')),
                i = Pe(t, 'nextTickets') || Pe(t, 'next_tickets'),
                o =
                    Pe(t, 'callingNowByConsultorio') ||
                    Pe(t, 'calling_now_by_consultorio') ||
                    Pe(t, 'callingNow') ||
                    Pe(t, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        l = Fe(r),
        u = Boolean(n && 'object' == typeof n);
    if (!(o.length || l.length || u || c.waiting || c.called)) return;
    const d =
        Number(r.waitingCount || 0) >
        l.filter((t) => 'waiting' === t.status).length;
    if (o.length) return void Aa(o, r, { fallbackPartial: !1, syncMode: s });
    const p = new Map(i.map((t) => [xe(t), t]));
    ((function (t, e, a) {
        const n = e.callingNowByConsultorio || {},
            i = Number(e.calledCount || e.counts?.called || 0),
            o = Number(e.waitingCount || e.counts?.waiting || 0),
            s = Ce(e.nextTickets),
            r = (function (t) {
                const e = new Set(),
                    a = t[1] || t[1] || null,
                    n = t[2] || t[2] || null;
                return (a && e.add(xe(a)), n && e.add(xe(n)), e);
            })(n),
            c = new Set(s.map((t) => xe(t))),
            l = r.size > 0 || 0 === i,
            u = c.size > 0 || 0 === o,
            d = c.size > 0 && o > c.size;
        for (const [e, n] of t.entries()) {
            const i = Le(n, 0);
            a.called && l && 'called' === i.status && !r.has(e)
                ? t.set(
                      e,
                      Le(
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
                  (o <= 0 ? t.delete(e) : d || c.has(e) || t.delete(e));
        }
    })(p, r, c),
        Aa(
            (function (t, e, a) {
                for (const a of e) {
                    const e = xe(a),
                        n = t.get(e) || null;
                    t.set(e, Le(Ma(n, a), t.size));
                }
                if (a && 'object' == typeof a) {
                    const e = xe(Le(a, t.size)),
                        n = t.get(e) || null;
                    t.set(
                        e,
                        Le(
                            (function (t, e) {
                                return { ...(t || {}), ...Le(e, 0) };
                            })(n, a),
                            t.size
                        )
                    );
                }
                return Array.from(t.values());
            })(p, l, n),
            r,
            { fallbackPartial: d, syncMode: s }
        ));
}
function Ea() {
    return ma(wa, null);
}
function Na(t, e = '') {
    return (
        !!t?.queueTickets?.length &&
        (Aa(t.queueTickets, t.queueMeta || null, {
            fallbackPartial: !0,
            syncMode: 'fallback',
        }),
        e && ca(e),
        !0)
    );
}
async function Da() {
    try {
        (La(await q('queue-state'), { syncMode: 'live' }),
            ca('Queue refresh realizado'));
    } catch (t) {
        (ca('Queue refresh con error'), Na(Ea()));
    }
}
function Ba(t, e, a = void 0) {
    _a(t, (t) => ({
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
async function Pa({ ticketId: t, action: e, consultorio: a }) {
    const n = Number(t || 0),
        i = qe(e);
    if (n && i)
        return b().queue.practiceMode
            ? ((function (t, e, a) {
                  'reasignar' !== e && 're-llamar' !== e
                      ? 'liberar' !== e
                          ? 'completar' !== e
                              ? 'no_show' !== e
                                  ? 'cancelar' === e && Ba(t, 'cancelled')
                                  : Ba(t, 'no_show')
                              : Ba(t, 'completed')
                          : Ba(t, 'waiting', null)
                      : Ba(t, 'called', 2 === Number(a || 1) ? 2 : 1);
              })(n, i, a),
              void ca(`Practica: accion ${i} en ticket ${n}`))
            : (La(
                  await q('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live' }
              ),
              void ca(`Accion ${i} ticket ${n}`));
}
async function Ia(t) {
    const e = 2 === Number(t || 0) ? 2 : 1,
        a = b();
    if (!Sa.get(e)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== e
        )
            return (
                ca(`Llamado bloqueado para C${e} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const t = (function (t) {
                return (
                    Oe().queueTickets.find(
                        (e) =>
                            'waiting' === e.status &&
                            (!e.assignedConsultorio ||
                                e.assignedConsultorio === t)
                    ) || null
                );
            })(e);
            return t
                ? ((function (t, e) {
                      _a(t, (t) => ({
                          ...t,
                          status: 'called',
                          assignedConsultorio: e,
                          calledAt: new Date().toISOString(),
                      }));
                  })(t.id, e),
                  void ca(`Practica: llamado ${t.ticketCode} en C${e}`))
                : void ca('Practica: sin tickets en espera');
        }
        Sa.set(e, !0);
        try {
            (La(
                await q('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: e },
                }),
                { syncMode: 'live' }
            ),
                ca(`Llamado C${e} ejecutado`));
        } catch (t) {
            (ca(`Error llamando siguiente en C${e}`),
                s(`Error llamando siguiente en C${e}`, 'error'));
        } finally {
            Sa.set(e, !1);
        }
    }
}
async function xa(t, e, a = 0) {
    const n = {
            ticketId: Number(t || 0),
            action: qe(e),
            consultorio: Number(a || 0),
        },
        i = b(),
        o = (function (t) {
            const e = Number(t || 0);
            return (
                (e && Oe().queueTickets.find((t) => Number(t.id || 0) === e)) ||
                null
            );
        })(n.ticketId);
    if (
        !i.queue.practiceMode &&
        qa.has(n.action) &&
        (function (t, e) {
            const a = qe(t);
            return (
                'cancelar' === a ||
                ('no_show' === a &&
                    (!e ||
                        'called' === Se(e.status) ||
                        Number(e.assignedConsultorio || 0) > 0))
            );
        })(n.action, o)
    )
        return (ve(n), void ca(`Accion ${n.action} pendiente de confirmacion`));
    await Pa(n);
}
async function Ha() {
    const t = b().queue.pendingSensitiveAction;
    t ? (ke(), await Pa(t)) : ke();
}
function Fa() {
    (ke(), ca('Accion sensible cancelada'));
}
function Oa() {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        e = b().queue.pendingSensitiveAction;
    return !(
        (!Boolean(e) &&
            !(t instanceof HTMLDialogElement
                ? t.open
                : t instanceof HTMLElement &&
                  (!t.hidden || t.hasAttribute('open')))) ||
        (Fa(), 0)
    );
}
async function Ra(t) {
    const e = Number(t || 0);
    e &&
        (b().queue.practiceMode
            ? ca(`Practica: reprint ticket ${e}`)
            : (await q('queue-reprint', { method: 'POST', body: { id: e } }),
              ca(`Reimpresion ticket ${e}`)));
}
function ja() {
    $a({ helpOpen: !b().queue.helpOpen });
}
function za(t) {
    const e = Boolean(t);
    ($a({ practiceMode: e, pendingSensitiveAction: null }),
        ca(e ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function Va(t) {
    const e = Ke();
    return (
        !!e &&
        (ve({
            ticketId: e.id,
            action: 'completar',
            consultorio: t.queue.stationConsultorio,
        }),
        !0)
    );
}
async function Ua(t) {
    const e = b();
    if (e.queue.captureCallKeyMode)
        return void (function (t) {
            const e = {
                key: String(t.key || ''),
                code: String(t.code || ''),
                location: Number(t.location || 0),
            };
            ($a({ customCallKey: e, captureCallKeyMode: !1 }),
                s('Tecla externa guardada', 'success'),
                ca(`Tecla externa calibrada: ${e.code}`));
        })(t);
    if (
        (function (t, e) {
            return (
                !(!e || 'object' != typeof e) &&
                we(e.code) === we(t.code) &&
                String(e.key || '') === String(t.key || '') &&
                Number(e.location || 0) === Number(t.location || 0)
            );
        })(t, e.queue.customCallKey)
    )
        return void (await Ia(e.queue.stationConsultorio));
    const a = we(t.code),
        n = we(t.key),
        i = (function (t, e, a) {
            return (
                'numpadenter' === e ||
                'kpenter' === e ||
                ('enter' === a && 3 === Number(t.location || 0))
            );
        })(t, a, n);
    if (i && e.queue.pendingSensitiveAction) return void (await Ha());
    const o = (function (t, e) {
        return 'numpad2' === t || '2' === e
            ? 2
            : 'numpad1' === t || '1' === e
              ? 1
              : 0;
    })(a, n);
    if (!o)
        return i
            ? (e.queue.oneTap && Va(e) && (await Ha()),
              void (await Ia(e.queue.stationConsultorio)))
            : void ((function (t, e) {
                  return (
                      'numpaddecimal' === t ||
                      'kpdecimal' === t ||
                      'decimal' === e ||
                      ',' === e ||
                      '.' === e
                  );
              })(a, n)
                  ? Va(e)
                  : (function (t, e) {
                          return (
                              'numpadsubtract' === t ||
                              'kpsubtract' === t ||
                              '-' === e
                          );
                      })(a, n)
                    ? (function (t) {
                          const e = Ke();
                          e &&
                              ve({
                                  ticketId: e.id,
                                  action: 'no_show',
                                  consultorio: t.queue.stationConsultorio,
                              });
                      })(e)
                    : (function (t, e) {
                          return (
                              'numpadadd' === t || 'kpadd' === t || '+' === e
                          );
                      })(a, n) &&
                      (await (async function (t) {
                          const e = Ke();
                          e &&
                              (await xa(
                                  e.id,
                                  're-llamar',
                                  t.queue.stationConsultorio
                              ),
                              ca(`Re-llamar ${e.ticketCode}`),
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
              ca('Cambio de estación bloqueado por lock'))
            : ($a({ stationConsultorio: t }), ca(`Numpad: estacion C${t}`));
    })(o, e);
}
function Ka(t, e) {
    return 'c2' === t || '2' === t ? 2 : 'c1' === t || '1' === t ? 1 : e;
}
function Qa(t, e) {
    return '1' === t || 'true' === t ? 'locked' : e;
}
function Wa(t, e) {
    return '1' === t || 'true' === t || ('0' !== t && 'false' !== t && e);
}
const Ga = 'appointments',
    Ja = 'callbacks',
    Ya = 'reviews',
    Za = 'availability',
    Xa = 'availability-meta',
    tn = 'queue-tickets',
    en = 'queue-meta',
    an = 'leadops-meta',
    nn = 'app-downloads',
    on = 'health-status',
    sn = {
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
function rn() {
    return {
        appointments: ma(Ga, []),
        callbacks: ma(Ja, []),
        reviews: ma(Ya, []),
        availability: ma(Za, {}),
        availabilityMeta: ma(Xa, {}),
        queueTickets: ma(tn, []),
        queueMeta: ma(en, null),
        leadOpsMeta: ma(an, null),
        appDownloads: ma(nn, null),
        health: ma(on, null),
        funnelMetrics: sn,
    };
}
function cn(t) {
    return Array.isArray(t.queue_tickets)
        ? t.queue_tickets
        : Array.isArray(t.queueTickets)
          ? t.queueTickets
          : [];
}
function ln(t) {
    g((e) => {
        const a = (function (t, e) {
            return {
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
                        leadOps:
                            t.leadOps && 'object' == typeof t.leadOps
                                ? t.leadOps
                                : {},
                    }))),
                reviews: t.reviews || [],
                availability: t.availability || {},
                availabilityMeta: t.availabilityMeta || {},
                queueTickets: t.queueTickets || [],
                queueMeta: t.queueMeta || null,
                leadOpsMeta: t.leadOpsMeta || null,
                appDownloads: t.appDownloads || null,
                funnelMetrics: t.funnelMetrics || e,
                health: t.health || null,
            };
            var a;
        })(t, e.data.funnelMetrics);
        return {
            ...e,
            data: { ...e.data, ...a },
            ui: { ...e.ui, lastRefreshAt: Date.now() },
        };
    });
}
async function un(t) {
    if (t.funnelMetrics) return t.funnelMetrics;
    const e = await q('funnel-metrics').catch(() => null);
    return e?.data || null;
}
function dn(e, a, n) {
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
function pn(e, a, n, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${t(i)}">\n            <div>\n                <span>${t(e)}</span>\n                <small>${t(n)}</small>\n            </div>\n            <strong>${t(String(a))}</strong>\n        </li>\n    `;
}
function mn(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function bn(t) {
    const e = new Date(t || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function gn(t) {
    return bn(`${t?.date || ''}T${t?.time || '00:00'}:00`);
}
function fn(t) {
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
function hn(e, a, n) {
    return `\n        <button type="button" class="operations-action-item" data-action="${t(e)}">\n            <span>${t(a)}</span>\n            <small>${t(n)}</small>\n        </button>\n    `;
}
function yn(t) {
    const {
            appointments: e,
            availability: a,
            callbacks: n,
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
                        a = new Date();
                    return (
                        e.getFullYear() === a.getFullYear() &&
                        e.getMonth() === a.getMonth() &&
                        e.getDate() === a.getDate()
                    );
                })(gn(t))
            ).length;
        })(e),
        r = (function (t) {
            return t.filter((t) => {
                const e = mn(t.paymentStatus || t.payment_status);
                return (
                    'pending_transfer_review' === e || 'pending_transfer' === e
                );
            }).length;
        })(e),
        c = (function (t) {
            return t.filter((t) => 'pending' === mn(t.status)).length;
        })(n),
        l = (function (t) {
            return t.filter((t) => {
                if ('pending' !== mn(t.status)) return !1;
                const e = (function (t) {
                    return bn(t?.fecha || t?.createdAt || '');
                })(t);
                return !!e && Math.round((Date.now() - e) / 6e4) >= 120;
            }).length;
        })(n),
        u = (function (t) {
            return t.filter((t) => 'no_show' === mn(t.status)).length;
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
            const a = Date.now();
            return t.filter((t) => {
                const n = bn(t.date || t.createdAt || '');
                return n && a - n <= 24 * e * 60 * 60 * 1e3;
            }).length;
        })(o),
        m = (function (t) {
            return Object.values(t || {}).filter(
                (t) => Array.isArray(t) && t.length > 0
            ).length;
        })(a),
        b = (function (t) {
            return t
                .map((t) => ({ item: t, stamp: gn(t) }))
                .filter((t) => t.stamp > 0 && t.stamp >= Date.now())
                .sort((t, e) => t.stamp - e.stamp)[0];
        })(e);
    return {
        appointments: e,
        availabilityDays: m,
        avgRating: d,
        callbacks: n,
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
function vn(t) {
    const e = yn(t);
    ((function (t) {
        const {
            appointments: e,
            avgRating: a,
            nextAppointment: n,
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
            r('#avgRating', a),
            r('#adminAvgRating', a),
            r('#dashboardHeroRating', a),
            r('#dashboardHeroRecentReviews', c),
            r('#dashboardHeroUrgentCallbacks', d),
            r('#dashboardHeroPendingTransfers', s),
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
                              ? `La siguiente cita es ${n.item.name || 'sin nombre'} ${fn(n.stamp).toLowerCase()}.`
                              : 'Agenda, callbacks y disponibilidad con una lectura clara y una sola prioridad por pantalla.';
                })({
                    pendingTransfers: s,
                    urgentCallbacks: d,
                    noShows: i,
                    nextAppointment: n,
                })
            ));
    })(e),
        (function (t) {
            const {
                    nextAppointment: e,
                    pendingTransfers: a,
                    todayAppointments: i,
                    urgentCallbacks: o,
                } = t,
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
                        pendingTransfers: t,
                        urgentCallbacks: e,
                        nextAppointment: a,
                    }) {
                        return t > 0
                            ? 'Transferencias detenidas hasta validar comprobante.'
                            : e > 0
                              ? 'Callbacks fuera de SLA requieren llamada inmediata.'
                              : a?.item
                                ? `Siguiente ingreso: ${a.item.name || 'Paciente'} el ${n(a.item.date)} a las ${a.item.time || '--:--'}.`
                                : 'Sin alertas criticas en la operacion actual.';
                    })({
                        pendingTransfers: a,
                        urgentCallbacks: o,
                        nextAppointment: e,
                    })
                ));
        })(e),
        (function (t) {
            const {
                availabilityDays: e,
                nextAppointment: a,
                pendingCallbacks: n,
                pendingTransfers: i,
                todayAppointments: o,
                urgentCallbacks: s,
            } = t;
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
                        ? `${fn(a.stamp)} | ${a.item.name || 'Paciente'}`
                        : e > 0
                          ? `${e} dia(s) con slots publicados`
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
                        ? `Siguiente hito: ${a.item.name || 'Paciente'} ${fn(a.stamp).toLowerCase()}`
                        : 'Sin citas inmediatas en cola'
                ));
        })(e),
        c(
            '#operationActionList',
            (function (t) {
                const {
                        pendingTransfers: e,
                        urgentCallbacks: a,
                        pendingCallbacks: n,
                    } = t,
                    { appointments: i, nextAppointment: o } = t;
                return [
                    hn(
                        'context-open-appointments-transfer',
                        e > 0
                            ? 'Validar transferencias'
                            : 'Abrir agenda clinica',
                        e > 0
                            ? `${e} comprobante(s) por revisar`
                            : `${i.length} cita(s) en el corte`
                    ),
                    hn(
                        'context-open-callbacks-pending',
                        a > 0
                            ? 'Resolver callbacks urgentes'
                            : 'Abrir callbacks',
                        a > 0
                            ? `${a} caso(s) fuera de SLA`
                            : `${n} callback(s) pendientes`
                    ),
                    hn(
                        'refresh-admin-data',
                        'Actualizar tablero',
                        o?.item
                            ? `Proxima cita ${fn(o.stamp).toLowerCase()}`
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
                    pendingTransfers: a,
                    todayAppointments: n,
                    urgentCallbacks: i,
                } = t;
                return [
                    pn(
                        'Transferencias',
                        a,
                        a > 0
                            ? 'Pago detenido antes de confirmar.'
                            : 'Sin comprobantes pendientes.',
                        a > 0 ? 'warning' : 'success'
                    ),
                    pn(
                        'Callbacks urgentes',
                        i,
                        i > 0
                            ? 'Mas de 120 min en espera.'
                            : 'SLA dentro de rango.',
                        i > 0 ? 'danger' : 'success'
                    ),
                    pn(
                        'Agenda de hoy',
                        n,
                        n > 0
                            ? `${n} ingreso(s) en la jornada.`
                            : 'No hay citas hoy.',
                        n > 6 ? 'warning' : 'neutral'
                    ),
                    pn(
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
                    dn(t.checkoutEntryBreakdown, 'entry', 'count')
                ),
                c(
                    '#funnelSourceList',
                    dn(t.sourceBreakdown, 'source', 'count')
                ),
                c(
                    '#funnelPaymentMethodList',
                    dn(t.paymentMethodBreakdown, 'method', 'count')
                ),
                c(
                    '#funnelAbandonList',
                    dn(t.checkoutAbandonByStep, 'step', 'count')
                ),
                c(
                    '#funnelAbandonReasonList',
                    dn(t.abandonReasonBreakdown, 'reason', 'count')
                ),
                c(
                    '#funnelStepList',
                    dn(t.bookingStepBreakdown, 'step', 'count')
                ),
                c(
                    '#funnelErrorCodeList',
                    dn(t.errorCodeBreakdown, 'code', 'count')
                ));
        })(e.funnel));
}
function kn(t) {
    return String(t || '')
        .toLowerCase()
        .trim();
}
function wn(t) {
    const e = new Date(t?.date || t?.createdAt || '');
    return Number.isNaN(e.getTime()) ? 0 : e.getTime();
}
function Sn(t) {
    return `${Math.max(0, Math.min(5, Math.round(Number(t || 0))))}/5`;
}
function qn(t) {
    const e = String(t || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return e.length ? e.map((t) => t.charAt(0).toUpperCase()).join('') : 'AN';
}
function Cn(t, e = 220) {
    const a = String(t || '').trim();
    return a
        ? a.length <= e
            ? a
            : `${a.slice(0, e - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function An() {
    const e = b(),
        a = Array.isArray(e?.data?.reviews) ? e.data.reviews : [],
        n = (function (t) {
            return t.slice().sort((t, e) => wn(e) - wn(t));
        })(a),
        o = (function (t) {
            return t.length
                ? t.reduce((t, e) => t + Number(e.rating || 0), 0) / t.length
                : 0;
        })(a),
        s = (function (t, e = 30) {
            const a = Date.now();
            return t.filter((t) => {
                const n = wn(t);
                return !!n && a - n <= 24 * e * 60 * 60 * 1e3;
            }).length;
        })(a),
        l = (function (t) {
            return t.filter((t) => Number(t.rating || 0) <= 3).length;
        })(a),
        u = (function (t) {
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
        })(n),
        { latestAuthor: d, latestDate: p } = (function (t) {
            const e = t[0];
            return {
                latestDate: e ? i(e.date || e.createdAt || '') : '-',
                latestAuthor: e ? String(e.name || 'Anonimo') : 'Sin datos',
            };
        })(n);
    if (
        (r('#reviewsAverageRating', o.toFixed(1)),
        r(
            '#reviewsFiveStarCount',
            (function (t) {
                return t.filter((t) => Number(t.rating || 0) >= 5).length;
            })(a)
        ),
        r('#reviewsRecentCount', s),
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
            })(o, a.length, l)
        ),
        c(
            '#reviewsSummaryRail',
            (function ({
                latestAuthor: e,
                latestDate: a,
                recentCount: n,
                lowRatedCount: i,
            }) {
                return `\n        <article class="reviews-rail-card">\n            <span>Ultima resena</span>\n            <strong>${t(e)}</strong>\n            <small>${t(a)}</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Cadencia</span>\n            <strong>${t(String(n))} en 30 dias</strong>\n            <small>Volumen reciente de feedback.</small>\n        </article>\n        <article class="reviews-rail-card">\n            <span>Riesgo</span>\n            <strong>${t(i > 0 ? `${i} por revisar` : 'Sin alertas')}</strong>\n            <small>${t(i > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>\n        </article>\n    `;
            })({
                latestAuthor: d,
                latestDate: p,
                recentCount: s,
                lowRatedCount: l,
            })
        ),
        !a.length)
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
                  const a = e.item;
                  return `\n        <article class="reviews-spotlight-card">\n            <div class="reviews-spotlight-top">\n                <span class="review-avatar">${t(qn(a.name || 'Anonimo'))}</span>\n                <div>\n                    <small>${t(e.eyebrow)}</small>\n                    <strong>${t(a.name || 'Anonimo')}</strong>\n                    <small>${t(i(a.date || a.createdAt || ''))}</small>\n                </div>\n            </div>\n            <p class="reviews-spotlight-stars">${t(Sn(a.rating))}</p>\n            <p>${t(Cn(a.comment || a.review || '', 320))}</p>\n            <small>${t(e.summary)}</small>\n        </article>\n    `;
              })(u)
          )
        : c(
              '#reviewsSpotlight',
              `\n        <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">\n            <strong>Sin spotlight disponible</strong>\n            <p>${t(u.summary)}</p>\n        </div>\n    `
          ),
        c(
            '#reviewsGrid',
            (function (e, a) {
                return e
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
                            return `\n        <article class="review-card${a ? ' is-featured' : ''}" data-rating="${t(String(n))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${t(qn(e.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${t(e.name || 'Anonimo')}</strong>\n                        <small>${t(i(e.date || e.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${t(o)}">${t(Sn(n))}</span>\n            </header>\n            <p>${t(Cn(e.comment || e.review || ''))}</p>\n            <small>${t(s)}</small>\n        </article>\n    `;
                        })(e, {
                            featured:
                                a.item &&
                                kn(e.name) === kn(a.item.name) &&
                                wn(e) === wn(a.item),
                        })
                    )
                    .join('');
            })(n, u)
        ));
}
function _n() {
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
async function $n(t = !1) {
    const e = await (async function () {
        try {
            const [t, e] = await Promise.all([
                    q('data'),
                    q('health').catch(() => null),
                ]),
                a = t.data || {},
                n = rn(),
                i = (function (t, e, a) {
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
                        queueTickets: cn(t),
                        queueMeta:
                            t.queueMeta && 'object' == typeof t.queueMeta
                                ? t.queueMeta
                                : t.queue_state &&
                                    'object' == typeof t.queue_state
                                  ? t.queue_state
                                  : null,
                        leadOpsMeta:
                            t.leadOpsMeta && 'object' == typeof t.leadOpsMeta
                                ? t.leadOpsMeta
                                : a?.leadOpsMeta || null,
                        appDownloads:
                            t.appDownloads && 'object' == typeof t.appDownloads
                                ? t.appDownloads
                                : a?.appDownloads || null,
                        funnelMetrics:
                            t.funnelMetrics || a?.funnelMetrics || null,
                        health: e && e.ok ? e : null,
                    };
                })({ ...a, funnelMetrics: await un(a) }, e, n);
            return (
                ln(i),
                (function (t) {
                    (ba(Ga, t.appointments || []),
                        ba(Ja, t.callbacks || []),
                        ba(Ya, t.reviews || []),
                        ba(Za, t.availability || {}),
                        ba(Xa, t.availabilityMeta || {}),
                        ba(tn, t.queueTickets || []),
                        ba(en, t.queueMeta || null),
                        ba(an, t.leadOpsMeta || null),
                        ba(nn, t.appDownloads || null),
                        ba(on, t.health || null));
                })(i),
                !0
            );
        } catch (t) {
            return (ln(rn()), !1);
        }
    })();
    return (
        (function () {
            const t = b(),
                e = Yt(t.data.availability || {}),
                a = te(t.availability.selectedDate, e);
            (le({
                draft: e,
                selectedDate: a,
                monthAnchor: Xt(t.availability.monthAnchor, a),
                draftDirty: !1,
                lastAction: '',
            }),
                ce());
        })(),
        await (async function () {
            const t = Array.isArray(b().data.queueTickets)
                    ? b().data.queueTickets.map((t, e) => Le(t, e))
                    : [],
                e = (function (t) {
                    return b().data.queueMeta &&
                        'object' == typeof b().data.queueMeta
                        ? Be(b().data.queueMeta, t)
                        : null;
                })(t);
            t.length
                ? Aa(t, e || null, { fallbackPartial: !1, syncMode: 'live' })
                : (function (t) {
                      const e = t ? Fe(t) : [];
                      return (
                          !!e.length &&
                          (Aa(e, t, {
                              fallbackPartial: !0,
                              syncMode: 'fallback',
                          }),
                          ca('Queue fallback parcial desde metadata'),
                          !0)
                      );
                  })(e) ||
                  (await Da(),
                  (b().data.queueTickets || []).length ||
                      Na(Ea(), 'Queue fallback desde snapshot local') ||
                      Aa([], null, { fallbackPartial: !1, syncMode: 'live' }));
        })(),
        j(b()),
        vn(b()),
        ut(),
        Ht(),
        An(),
        ce(),
        ra(),
        _n(),
        t &&
            s(
                e ? 'Datos actualizados' : 'Datos cargados desde cache local',
                e ? 'success' : 'warning'
            ),
        e
    );
}
function Tn() {
    (x(!1),
        O(),
        F(!1),
        H({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function Mn(t) {
    t.preventDefault();
    const e = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = e instanceof HTMLInputElement ? e.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        F(!0);
        const t = b();
        if (
            (H({
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
                const a = await C('login-2fa', {
                        method: 'POST',
                        body: { code: e },
                    }),
                    n = String(a.csrfToken || '');
                return (
                    S(n),
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
                const a = await C('login', {
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
                    S(n),
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
                    x(!0),
                    H({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void R('2fa')
                );
        }
        (H({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            D(),
            P(),
            x(!1),
            O({ clearPassword: !0 }),
            await $n(!1),
            s('Sesion iniciada', 'success'));
    } catch (t) {
        (H({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                t?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            R(b().auth.requires2FA ? '2fa' : 'password'),
            s(t?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        F(!1);
    }
}
async function Ln(t, e) {
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
async function En(t, a) {
    switch (t) {
        case 'change-month':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!Number.isFinite(e) || 0 === e) return;
                    const a = Xt(
                        b().availability.monthAnchor,
                        b().availability.selectedDate
                    );
                    (a.setMonth(a.getMonth() + e),
                        le({ monthAnchor: a, lastAction: '' }, { render: !0 }));
                })(Number(a.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (me(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const t = re(-1);
                    t
                        ? me(t, `Fecha previa con slots: ${t}`)
                        : de('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const t = re(1);
                    t
                        ? me(t, `Siguiente fecha con slots: ${t}`)
                        : de('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (t) {
                    const e = Wt(t);
                    e &&
                        le(
                            {
                                selectedDate: e,
                                monthAnchor: Xt(e, e),
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
                    if (ie()) return;
                    const a = e('#newSlotTime');
                    a instanceof HTMLInputElement &&
                        ((a.value = ge(t)), a.focus());
                })(String(a.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (ie()) return;
                    const t = e('#newSlotTime');
                    if (!(t instanceof HTMLInputElement)) return;
                    const a = ge(t.value);
                    if (!a) return;
                    const n = b(),
                        i = be();
                    i &&
                        (pe(
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
                    if (ie()) return;
                    const a = Wt(t);
                    if (!a) return;
                    const n = b(),
                        i = Array.isArray(n.availability.draft[a])
                            ? n.availability.draft[a]
                            : [],
                        o = ge(e);
                    pe(
                        a,
                        i.filter((t) => ge(t) !== o),
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
                    if (ie()) return;
                    const t = b(),
                        e = be();
                    if (!e) return;
                    const a = Array.isArray(t.availability.draft[e])
                        ? Qt(t.availability.draft[e])
                        : [];
                    le(
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
                    if (ie()) return;
                    const t = b(),
                        e = Array.isArray(t.availability.clipboard)
                            ? Qt(t.availability.clipboard)
                            : [];
                    if (!e.length) return void de('Portapapeles vacio');
                    const a = be();
                    a && pe(a, e, `Pegado ${e.length} slots en ${a}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (fe(1), !0);
        case 'duplicate-availability-next-week':
            return (fe(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (ie()) return;
                    const t = be();
                    t &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${t}. Continuar?`
                        ) &&
                        pe(t, [], `Dia ${t} limpiado`);
                })(),
                !0
            );
        case 'clear-availability-week':
            return (
                (function () {
                    if (ie()) return;
                    const t = be();
                    if (!t) return;
                    const e = (function (t) {
                        const e = Gt(t);
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
                    const i = ne();
                    for (let t = 0; t < 7; t += 1) {
                        const a = new Date(e.start);
                        (a.setDate(e.start.getDate() + t), delete i[u(a)]);
                    }
                    ue(i, {
                        selectedDate: t,
                        lastAction: `Semana limpiada (${a} - ${n})`,
                    });
                })(),
                !0
            );
        case 'save-availability-draft':
            return (
                await (async function () {
                    if (ie()) return;
                    const t = ne(),
                        e = await q('availability', {
                            method: 'POST',
                            body: { availability: t },
                        }),
                        a =
                            e?.data && 'object' == typeof e.data
                                ? Yt(e.data)
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
                        ce());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (ie()) return;
                    const t = b();
                    if (
                        t.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const e = Yt(t.data.availability || {}),
                        a = te(t.availability.selectedDate, e);
                    le(
                        {
                            draft: e,
                            selectedDate: a,
                            monthAnchor: Xt(t.availability.monthAnchor, a),
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
const Nn = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function Dn(t, e = 'dashboard') {
    const a = String(t || '')
        .trim()
        .toLowerCase();
    return Nn.has(a) ? a : e;
}
function Bn(t) {
    !(function (t) {
        const e = String(t || '').replace(/^#/, ''),
            a = e ? `#${e}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(Dn(t));
}
const Pn = 'themeMode',
    In = new Set(['light', 'dark', 'system']);
function xn(t, { persist: e = !1 } = {}) {
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
                const e = In.has(t) ? t : 'system';
                pa(Pn, e);
            })(t),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((e) => {
            const a = e.dataset.themeMode === t;
            (e.classList.toggle('is-active', a),
                e.setAttribute('aria-pressed', String(a)));
        }));
}
const Hn = 'adminLastSection',
    Fn = 'adminSidebarCollapsed';
function On() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function Rn(t) {
    return (
        t instanceof HTMLElement &&
        !t.hidden &&
        'true' !== t.getAttribute('aria-hidden') &&
        (!('disabled' in t) || !t.disabled) &&
        t.getClientRects().length > 0
    );
}
function jn() {
    const t = b(),
        a = On(),
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
function zn() {
    const t = b();
    (pa(Hn, t.ui.activeSection), pa(Fn, t.ui.sidebarCollapsed ? '1' : '0'));
}
async function Vn(t, e = {}) {
    const a = Dn(t, 'dashboard'),
        { force: n = !1 } = e,
        i = b().ui.activeSection;
    return (
        !(
            (function (t, e) {
                return (
                    !e &&
                    'availability' === b().ui.activeSection &&
                    'availability' !== t &&
                    he()
                );
            })(a, n) &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (t) {
            const e = Dn(t, 'dashboard');
            (g((t) => ({ ...t, ui: { ...t.ui, activeSection: e } })),
                I(e),
                j(b()),
                Bn(e),
                zn());
        })(a),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const t = b();
                return (
                    'fallback' !== we(t.queue.syncMode) &&
                    !Boolean(t.queue.fallbackPartial)
                );
            })() &&
            (await Da()),
        !0)
    );
}
function Un(t) {
    g((e) => ({ ...e, ui: { ...e.ui, ...t(e.ui) } }));
}
function Kn() {
    (Un((t) => ({
        sidebarCollapsed: !t.sidebarCollapsed,
        sidebarOpen: t.sidebarOpen,
    })),
        jn(),
        zn());
}
function Qn() {
    (Un((t) => ({ sidebarOpen: !t.sidebarOpen })), jn());
}
function Wn({ restoreFocus: t = !1 } = {}) {
    if ((Un(() => ({ sidebarOpen: !1 })), jn(), P(), t)) {
        const t = e('#adminMenuToggle');
        t instanceof HTMLElement && t.focus();
    }
}
function Gn() {
    B();
    const t = document.getElementById('adminQuickCommand');
    t instanceof HTMLInputElement && t.focus();
}
function Jn() {
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
const Yn = {
    appointments_pending_transfer: async () => {
        (await Vn('appointments'), pt('pending_transfer'), mt(''));
    },
    appointments_all: async () => {
        (await Vn('appointments'), pt('all'), mt(''));
    },
    appointments_no_show: async () => {
        (await Vn('appointments'), pt('no_show'), mt(''));
    },
    callbacks_pending: async () => {
        (await Vn('callbacks'), Ot('pending'));
    },
    callbacks_contacted: async () => {
        (await Vn('callbacks'), Ot('contacted'));
    },
    callbacks_sla_urgent: async () => {
        (await Vn('callbacks'), Ot('sla_urgent'));
    },
    queue_sla_risk: async () => {
        (await Vn('queue'), Ta('sla_risk'));
    },
    queue_waiting: async () => {
        (await Vn('queue'), Ta('waiting'));
    },
    queue_called: async () => {
        (await Vn('queue'), Ta('called'));
    },
    queue_no_show: async () => {
        (await Vn('queue'), Ta('no_show'));
    },
    queue_all: async () => {
        (await Vn('queue'), Ta('all'));
    },
    queue_call_next: async () => {
        (await Vn('queue'), await Ia(b().queue.stationConsultorio));
    },
};
async function Zn(t) {
    const e = Yn[t];
    'function' == typeof e && (await e());
}
function Xn(t) {
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
async function ti(t, e) {
    switch (t) {
        case 'callback-quick-filter':
            return (Ot(String(e.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                Ft({
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
                await Vn('callbacks'),
                Ot('pending'),
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
                await zt(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.callbackDate || '')
                ),
                s('Callback actualizado', 'success'),
                !0
            );
        case 'lead-ai-request':
            return (
                await (async function (t, e = 'whatsapp_draft') {
                    const a = Number(t || 0);
                    if (a <= 0) return null;
                    const n = await q('lead-ai-request', {
                        method: 'POST',
                        body: { callbackId: a, objective: e },
                    });
                    return n?.data ? (Rt(n.data), n.data) : null;
                })(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.objective || 'whatsapp_draft')
                ),
                s('Solicitud IA encolada', 'success'),
                !0
            );
        case 'callback-outcome':
            return (
                await (async function (t, e) {
                    const a = await jt(t, {
                        status: 'contacted',
                        leadOps: { outcome: e },
                    });
                    return (a && Rt(a), a);
                })(
                    Number(e.dataset.callbackId || 0),
                    String(e.dataset.outcome || '')
                ),
                s('Outcome actualizado', 'success'),
                !0
            );
        case 'callback-copy-ai': {
            const t = Number(e.dataset.callbackId || 0),
                a = (b().data.callbacks || []).find(
                    (e) => Number(e.id || 0) === t
                ),
                n = String(a?.leadOps?.aiDraft || '').trim();
            return n
                ? navigator?.clipboard?.writeText
                    ? (await navigator.clipboard.writeText(n),
                      await (async function (t) {
                          const e = await jt(t, {
                              leadOps: { aiStatus: 'accepted' },
                          });
                          return (e && Rt(e), e);
                      })(t),
                      s('Borrador copiado', 'success'),
                      !0)
                    : (s('Clipboard no disponible', 'error'), !0)
                : (s('Aun no hay borrador IA', 'error'), !0);
        }
        case 'callbacks-bulk-select-visible':
            return (
                Ft(
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
            return (Ft({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const t = (b().callbacks.selected || [])
                        .map((t) => Number(t || 0))
                        .filter((t) => t > 0);
                    for (const e of t)
                        try {
                            await zt(e);
                        } catch (t) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await Vn('callbacks'), Ot('pending'), !0);
        default:
            return !1;
    }
}
async function ei(t) {
    switch (t) {
        case 'context-open-appointments-transfer':
            return (await Vn('appointments'), pt('pending_transfer'), !0);
        case 'context-open-dashboard':
            return (await Vn('dashboard'), !0);
        default:
            return !1;
    }
}
async function ai(t, e) {
    switch (t) {
        case 'queue-bulk-action':
            return (
                await (async function (t) {
                    const e = Ve(),
                        a = qe(t);
                    if (e.length) {
                        if (qa.has(a)) {
                            const t = window.confirm(
                                `${(function (t) {
                                    return 'no_show' === t
                                        ? 'No show'
                                        : 'completar' === t || 'completed' === t
                                          ? 'Completar'
                                          : 'Cancelar';
                                })(a)}: confirmar acción masiva`
                            );
                            if (!t) return;
                        }
                        for (const t of e)
                            try {
                                await Pa({
                                    ticketId: t.id,
                                    action: a,
                                    consultorio:
                                        t.assignedConsultorio ||
                                        b().queue.stationConsultorio,
                                });
                            } catch (t) {}
                        (ua(), ca(`Bulk ${a} sobre ${e.length} tickets`));
                    }
                })(String(e.dataset.queueAction || 'no_show')),
                !0
            );
        case 'queue-bulk-reprint':
            return (
                await (async function () {
                    const t = Ve();
                    for (const e of t)
                        try {
                            await Ra(e.id);
                        } catch (t) {}
                    (ua(), ca(`Bulk reimpresion ${t.length}`));
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function ni(t, e) {
    return (
        'queue-copy-install-link' === t &&
        (await (async function (t) {
            const e = String(t || '').trim();
            if (e)
                try {
                    (await navigator.clipboard.writeText(e),
                        s('Enlace copiado', 'success'));
                } catch (t) {
                    s('No se pudo copiar el enlace', 'error');
                }
            else s('No hay enlace de instalación disponible', 'warning');
        })(String(e.dataset.queueInstallUrl || '')),
        !0)
    );
}
async function ii(t) {
    switch (t) {
        case 'queue-sensitive-confirm':
            return (await Ha(), !0);
        case 'queue-sensitive-cancel':
            return (Fa(), !0);
        default:
            return !1;
    }
}
function oi(t, e = 0) {
    return Number(t?.dataset?.queueConsultorio || e);
}
function si(t, e = 0) {
    return Number(t?.dataset?.queueId || e);
}
async function ri(t, e) {
    switch (t) {
        case 'queue-refresh-state':
            return (await Da(), !0);
        case 'queue-call-next':
            return (await Ia(oi(e)), !0);
        case 'queue-release-station':
            return (
                await (async function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1,
                        a = Ue(e);
                    a
                        ? await xa(a.id, 'liberar', e)
                        : ca(`Sin ticket activo para liberar en C${e}`);
                })(oi(e)),
                !0
            );
        case 'queue-toggle-shortcuts':
            return (ja(), !0);
        case 'queue-toggle-one-tap':
            return ($a({ oneTap: !b().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (za(!0), !0);
        case 'queue-stop-practice':
            return (za(!1), !0);
        case 'queue-lock-station':
            return (
                (function (t) {
                    const e = 2 === Number(t || 0) ? 2 : 1;
                    ($a({ stationMode: 'locked', stationConsultorio: e }),
                        ca(`Estacion bloqueada en C${e}`));
                })(oi(e, 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (t) {
                    if ('free' === we(t))
                        return (
                            $a({ stationMode: 'free' }),
                            void ca('Estacion en modo libre')
                        );
                    $a({ stationMode: 'locked' });
                })(String(e.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-capture-call-key':
            return (
                $a({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    ($a({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        default:
            return !1;
    }
}
async function ci(t, e) {
    switch (t) {
        case 'queue-toggle-ticket-select':
            return (
                (function (t) {
                    const e = Number(t || 0);
                    if (!e) return;
                    const a = je(b().queue.selected || []);
                    la(a.includes(e) ? a.filter((t) => t !== e) : [...a, e]);
                })(si(e)),
                !0
            );
        case 'queue-select-visible':
            return (la(Re().map((t) => Number(t.id || 0))), !0);
        case 'queue-clear-selection':
            return (ua(), !0);
        case 'queue-ticket-action':
            return (
                await xa(
                    si(e),
                    (function (t, e = '') {
                        return String(t?.dataset?.queueAction || e);
                    })(e),
                    oi(e)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await Ra(si(e)), !0);
        case 'queue-help-request-status':
            return (
                await (async function (t, e) {
                    const a = Number(t || 0),
                        n = String(e || '')
                            .trim()
                            .toLowerCase();
                    if (a && n)
                        try {
                            (La(
                                await q('queue-help-request', {
                                    method: 'PATCH',
                                    body: { id: a, status: n },
                                }),
                                { syncMode: 'live' }
                            ),
                                ca(`Apoyo ${a} -> ${n}`));
                        } catch (t) {
                            (ca(`Error actualizando apoyo ${a}`),
                                s(`Error actualizando apoyo ${a}`, 'error'));
                        }
                })(
                    Number(e.dataset.queueHelpId || 0),
                    String(e.dataset.queueHelpStatus || '')
                ),
                !0
            );
        case 'queue-clear-search':
            return (
                (function () {
                    $a({ search: '', selected: [] });
                    const t = document.getElementById('queueSearchInput');
                    t instanceof HTMLInputElement && (t.value = '');
                })(),
                !0
            );
        default:
            return !1;
    }
}
async function li(t, e) {
    const a = [ri, ci, ai, ii, ni];
    for (const n of a) if (await n(t, e)) return !0;
    return !1;
}
async function ui(t, e) {
    switch (t) {
        case 'close-toast':
            return (e.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                xn(String(e.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return (Kn(), !0);
        case 'refresh-admin-data':
            return (await $n(!0), !0);
        case 'run-admin-command': {
            const t = document.getElementById('adminQuickCommand');
            if (t instanceof HTMLInputElement) {
                const e = Xn(t.value);
                e && (await Zn(e), (t.value = ''), P());
            }
            return !0;
        }
        case 'open-command-palette':
            return (B(), Gn(), !0);
        case 'close-command-palette':
            return (P(), !0);
        case 'logout':
            return (
                await (async function () {
                    try {
                        await C('logout', { method: 'POST' });
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
                P(),
                Tn(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                g((t) => ({ ...t, auth: { ...t.auth, requires2FA: !1 } })),
                x(!1),
                O(),
                H({
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
async function di() {
    ((function () {
        const t = e('#loginScreen'),
            a = e('#adminDashboard');
        if (!(t instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((t.innerHTML = `\n        <div class="admin-v3-login">\n            <section class="admin-v3-login__hero">\n                <div class="admin-v3-login__brand">\n                    <p class="sony-kicker">Piel en Armonia</p>\n                    <h1>Centro operativo claro y protegido</h1>\n                    <p>\n                        Acceso editorial para agenda, callbacks y disponibilidad con\n                        jerarquia simple y lectura rapida.\n                    </p>\n                </div>\n                <div class="admin-v3-login__facts">\n                    <article class="admin-v3-login__fact">\n                        <span>Sesion</span>\n                        <strong>Acceso administrativo aislado</strong>\n                        <small>Entrada dedicada para operacion diaria.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Proteccion</span>\n                        <strong>Clave y 2FA en la misma tarjeta</strong>\n                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                    </article>\n                    <article class="admin-v3-login__fact">\n                        <span>Entorno</span>\n                        <strong>Activos self-hosted y CSP activa</strong>\n                        <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                    </article>\n                </div>\n            </section>\n\n            <section class="admin-v3-login__panel">\n                <div class="admin-v3-login__panel-head">\n                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                    <p id="adminLoginStepSummary">\n                        Usa tu clave para abrir el workbench operativo.\n                    </p>\n                </div>\n\n                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                    <p id="adminLoginStatusMessage">\n                        El panel usa autenticacion endurecida y activos self-hosted.\n                    </p>\n                </div>\n\n                <form id="loginForm" class="sony-login-form" novalidate>\n                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                        <span>Contrasena</span>\n                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                    </label>\n                    <div id="group2FA" class="is-hidden">\n                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                            <span>Codigo 2FA</span>\n                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                        </label>\n                    </div>\n                    <div class="admin-login-actions">\n                        <button id="loginBtn" type="submit">Ingresar</button>\n                        <button\n                            id="loginReset2FABtn"\n                            type="button"\n                            class="sony-login-reset is-hidden"\n                            data-action="reset-login-2fa"\n                        >\n                            Volver\n                        </button>\n                    </div>\n                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                    </p>\n                </form>\n\n                ${$('login-theme-bar')}\n            </section>\n        </div>\n    `),
            (a.innerHTML = M()));
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
            const a = String(e.getAttribute('data-action') || '');
            if (a) {
                t.preventDefault();
                try {
                    await (async function (t, e) {
                        const a = [ui, Ln, ti, En, li, ei];
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
            const i = await Vn(
                String(e.getAttribute('data-section') || 'dashboard')
            );
            On() && !1 !== i && Wn();
        }),
        document.addEventListener('click', (t) => {
            const e =
                t.target instanceof Element
                    ? t.target.closest('[data-queue-filter]')
                    : null;
            e &&
                (t.preventDefault(),
                Ta(String(e.getAttribute('data-queue-filter') || 'all')));
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
            let t = Q,
                e = W;
            try {
                ((t = JSON.parse(localStorage.getItem(U) || `"${Q}"`)),
                    (e = JSON.parse(localStorage.getItem(K) || `"${W}"`)));
            } catch (t) {}
            g((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof t ? t : Q,
                    density: 'string' == typeof e ? e : W,
                },
            }));
        })(),
        (function () {
            let t = 'all',
                e = 'priority_desc';
            try {
                ((t = JSON.parse(localStorage.getItem(ht) || '"all"')),
                    (e = JSON.parse(
                        localStorage.getItem(ft) || '"priority_desc"'
                    )));
            } catch (t) {}
            g((a) => ({
                ...a,
                callbacks: { ...a.callbacks, filter: wt(t), sort: St(e) },
            }));
        })(),
        (function () {
            let t = '',
                e = '';
            try {
                ((t = String(localStorage.getItem(Vt) || '')),
                    (e = String(localStorage.getItem(Ut) || '')));
            } catch (t) {}
            const a = Wt(t),
                n = Xt(e, a);
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
            const t = Dn(da(Hn, 'dashboard')),
                e = '1' === da(Fn, '0');
            (g((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: t,
                    sidebarCollapsed: e,
                    sidebarOpen: !1,
                },
            })),
                I(t),
                Bn(t),
                jn());
        })(),
        (function () {
            const t = {
                    stationMode:
                        'locked' === we(da(fa, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(da(ha, '1')) ? 2 : 1,
                    oneTap: '1' === da(ya, '0'),
                    helpOpen: '1' === da(ka, '0'),
                    customCallKey: ma(va, null),
                },
                e = we(ga('station')),
                a = we(ga('lock')),
                n = we(ga('one_tap'));
            (g((i) => ({
                ...i,
                queue: {
                    ...i.queue,
                    stationMode: Qa(a, t.stationMode),
                    stationConsultorio: Ka(e, t.stationConsultorio),
                    oneTap: Wa(n, t.oneTap),
                    helpOpen: t.helpOpen,
                    customCallKey:
                        t.customCallKey && 'object' == typeof t.customCallKey
                            ? t.customCallKey
                            : null,
                },
            })),
                Ca(b()));
        })(),
        xn(
            (function () {
                const t = String(da(Pn, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return In.has(t) ? t : 'system';
            })()
        ),
        Tn(),
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
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    mt(a.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    Ot(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Ft({ sort: St(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var t;
                    ((t = o.value),
                        Ft({ search: String(t || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    var t;
                    ((t = s.value),
                        $a({ search: String(t || ''), selected: [] }));
                });
            const r = document.getElementById('adminQuickCommand');
            var c;
            r instanceof HTMLInputElement &&
                (c = r).addEventListener('keydown', async (t) => {
                    if ('Enter' !== t.key) return;
                    t.preventDefault();
                    const e = Xn(c.value);
                    e && (await Zn(e));
                });
        })(),
        (function () {
            const t = e('#adminMenuToggle'),
                a = e('#adminMenuClose'),
                n = e('#adminSidebarBackdrop');
            (t?.addEventListener('click', () => {
                On() ? Qn() : Kn();
            }),
                a?.addEventListener('click', () => Wn({ restoreFocus: !0 })),
                n?.addEventListener('click', () => Wn({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    On() ? jn() : Wn();
                }),
                document.addEventListener('keydown', (t) => {
                    if (!On() || !b().ui.sidebarOpen) return;
                    if ('Escape' === t.key)
                        return (
                            t.preventDefault(),
                            void Wn({ restoreFocus: !0 })
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
                        return [a, n, ...i, o].filter(Rn);
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
                        return Dn(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            t
                        );
                    })(b().ui.activeSection);
                    await Vn(t, { force: !0 });
                }),
                window.addEventListener('storage', (t) => {
                    'themeMode' === t.key && xn(String(t.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (t) => {
            he() && (t.preventDefault(), (t.returnValue = ''));
        }));
    const t = document.getElementById('loginForm');
    var a;
    (t instanceof HTMLFormElement && t.addEventListener('submit', Mn),
        (a = {
            navigateToSection: Vn,
            focusQuickCommand: Gn,
            focusCurrentSearch: Jn,
            runQuickAction: Zn,
            closeSidebar: () => Wn({ restoreFocus: !0 }),
            toggleMenu: () => {
                On() ? Qn() : Kn();
            },
            dismissQueueSensitiveDialog: Oa,
            toggleQueueHelp: () => ja(),
            queueNumpadAction: Ua,
        }),
        window.addEventListener('keydown', (t) => {
            (function (t, e) {
                const {
                        navigateToSection: a,
                        focusQuickCommand: n,
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
                    return (t.preventDefault(), n(), !0);
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
                if (g) return (l() || (t.preventDefault(), a(g)), !0);
                const k = (
                    'queue' !== b().ui.activeSection ? h : { ...h, ...y }
                )[m];
                return !!k && (l() || (t.preventDefault(), o(k)), !0);
            })(t, a) ||
                (function (t, e) {
                    if ('function' != typeof e) return !1;
                    const a = b().queue,
                        n = Boolean(a.captureCallKeyMode),
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
                            n ||
                            (function (t, e, a) {
                                const n = t.customCallKey;
                                return Boolean(
                                    n &&
                                    'object' == typeof n &&
                                    String(n.key || '') ===
                                        String(e.key || '') &&
                                    String(n.code || '').toLowerCase() === a &&
                                    Number(n.location || 0) ===
                                        Number(e.location || 0)
                                );
                            })(a, t, i);
                    !!o &&
                        (l() ||
                            Promise.resolve(
                                e({
                                    key: t.key,
                                    code: t.code,
                                    location: t.location,
                                })
                            ).catch(() => {}));
                })(t, a.queueNumpadAction);
        }));
    const n = await (async function () {
        try {
            const t = await C('status'),
                e = !0 === t.authenticated,
                a = e ? String(t.csrfToken || '') : '';
            return (
                S(a),
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
    (n
        ? (await (async function () {
              (D(), P(), await $n(!1));
          })(),
          I(b().ui.activeSection))
        : (N(), P(), Tn()),
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
            _n();
        }, 3e4));
}
const pi = (
    'loading' === document.readyState
        ? new Promise((t, e) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      di().then(t).catch(e);
                  },
                  { once: !0 }
              );
          })
        : di()
).catch((t) => {
    throw (console.error('admin-v3 boot failed', t), t);
});
export { pi as default };
