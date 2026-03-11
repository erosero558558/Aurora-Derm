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
            runtimeRevision: 0,
            lastRuntimeMutationAt: 0,
            selected: [],
            fallbackPartial: !1,
            syncMode: 'live',
            pendingSensitiveAction: null,
            activity: [],
        },
    };
let m = structuredClone(p);
function g() {
    return m;
}
function b(e) {
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
    y = Object.freeze({
        keyt: 'appointments_pending_transfer',
        keya: 'appointments_all',
        keyn: 'appointments_no_show',
        keyp: 'callbacks_pending',
        keyc: 'callbacks_contacted',
        keyu: 'callbacks_sla_urgent',
        keyw: 'queue_sla_risk',
        keyl: 'queue_call_next',
    }),
    v = Object.freeze({
        keyw: 'queue_waiting',
        keyc: 'queue_called',
        keya: 'queue_all',
        keyo: 'queue_all',
        keyl: 'queue_sla_risk',
    });
function h(e) {
    return {
        key: String(e.key || '').toLowerCase(),
        code: String(e.code || '').toLowerCase(),
    };
}
let k = '';
async function q(e, t = {}) {
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
function $(e) {
    k = String(e || '');
}
async function _(e, t = {}) {
    return q(`/api.php?resource=${encodeURIComponent(e)}`, t);
}
async function C(e, t = {}) {
    return q(`/admin-auth.php?action=${encodeURIComponent(e)}`, t);
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
function w(e) {
    return `<svg class="icon icon-${e}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${S[e] || S.menu}</svg>`;
}
function L(e) {
    return `\n        <div class="sony-theme-switcher ${e}" role="group" aria-label="Tema">\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${w('sun')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${w('moon')}</button>\n            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${w('system')}</button>\n        </div>\n    `;
}
function A(e, t, a, n = !1) {
    return `\n        <a\n            href="#${e}"\n            class="nav-item${n ? ' active' : ''}"\n            data-section="${e}"\n            ${n ? 'aria-current="page"' : ''}\n        >\n            ${w(a)}\n            <span>${t}</span>\n            <span class="badge" id="${e}Badge">0</span>\n        </a>\n    `;
}
function T(e) {
    return `<p class="admin-nav-group__label">${e}</p>`;
}
function M() {
    return `\n        <div class="admin-v3-shell">\n            \n        <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">\n            <header class="sidebar-header">\n                <div class="admin-v3-sidebar__brand">\n                    <strong>Piel en Armonia</strong>\n                    <small>Admin sony_v3</small>\n                </div>\n                <div class="toolbar-group">\n                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${w('menu')}</button>\n                    <button type="button" id="adminMenuClose">Cerrar</button>\n                </div>\n            </header>\n            <nav class="sidebar-nav" id="adminSidebarNav">\n                \n        <div class="admin-nav-group" id="adminPrimaryNav">\n            ${T('Flujo diario')}\n            ${A('dashboard', 'Inicio', 'dashboard', !0)}\n            ${A('appointments', 'Agenda', 'appointments')}\n            ${A('callbacks', 'Pendientes', 'callbacks')}\n            ${A('availability', 'Horarios', 'availability')}\n        </div>\n        <div class="admin-nav-group admin-nav-group-secondary" id="adminSecondaryNav">\n            ${T('Mas herramientas')}\n            ${A('reviews', 'Resenas', 'reviews')}\n            ${A('queue', 'Turnero avanzado', 'queue')}\n        </div>\n    \n            </nav>\n            <footer class="sidebar-footer">\n                <button type="button" class="logout-btn" data-action="logout">${w('logout')}<span>Cerrar sesion</span></button>\n            </footer>\n        </aside>\n        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>\n    \n            \n        <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">\n            \n        <header class="admin-v3-topbar">\n            <div class="admin-v3-topbar__copy">\n                <p class="sony-kicker">Panel operativo</p>\n                <h2 id="pageTitle">Inicio</h2>\n            </div>\n            <div class="admin-v3-topbar__actions">\n                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${w('menu')}<span>Menu</span></button>\n                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Acciones</button>\n                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>\n                ${L('admin-theme-switcher-header')}\n            </div>\n        </header>\n    \n            \n        <section class="admin-v3-context-strip" id="adminProductivityStrip">\n            <div class="admin-v3-context-copy" data-admin-section-hero>\n                <p class="sony-kicker" id="adminSectionEyebrow">Recepcion/Admin</p>\n                <h3 id="adminContextTitle">Que requiere atencion ahora</h3>\n                <p id="adminContextSummary">Trabaja con agenda, pendientes y turnero sin mezclar herramientas avanzadas en el primer paso.</p>\n                <div id="adminContextActions" class="sony-context-actions"></div>\n            </div>\n            <div class="admin-v3-status-rail" data-admin-priority-rail>\n                <article class="sony-status-tile">\n                    <span>Push</span>\n                    <strong id="pushStatusIndicator">Inicializando</strong>\n                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>\n                </article>\n                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">\n                    <span>Sesion</span>\n                    <strong id="adminSessionState">No autenticada</strong>\n                    <small id="adminSessionMeta">Autenticate para operar el panel</small>\n                </article>\n                <article class="sony-status-tile">\n                    <span>Sincronizacion</span>\n                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>\n                    <small id="adminSyncState">Listo para primera sincronizacion</small>\n                </article>\n            </div>\n        </section>\n    \n            \n        \n        <section id="dashboard" class="admin-section active" tabindex="-1">\n            <div class="dashboard-stage">\n                \n        <article class="sony-panel dashboard-hero-panel">\n            <div class="dashboard-hero-copy">\n                <p class="sony-kicker">Recepcion/Admin</p>\n                <h3>Inicio operativo</h3>\n                <p id="dashboardHeroSummary">\n                    Agenda, pendientes y horarios en un solo frente simple para el equipo.\n                </p>\n            </div>\n            <div class="dashboard-hero-actions">\n                <button type="button" data-action="context-open-appointments-overview">Ver agenda</button>\n                <button type="button" data-action="context-open-callbacks-pending">Revisar pendientes</button>\n            </div>\n            <div class="dashboard-home-grid">\n                <article class="dashboard-home-card" id="opsTodaySummaryCard">\n                    <span>Pacientes hoy</span>\n                    <strong id="opsTodayCount">0</strong>\n                    <small id="opsTodayMeta">Sin agenda inmediata</small>\n                    <button type="button" data-action="context-open-appointments-overview">Abrir agenda</button>\n                </article>\n                <article class="dashboard-home-card" id="opsPendingSummaryCard">\n                    <span>Pendientes</span>\n                    <strong id="opsPendingCount">0</strong>\n                    <small id="opsPendingMeta">Sin seguimiento pendiente</small>\n                    <button type="button" data-action="context-open-callbacks-pending">Ver pendientes</button>\n                </article>\n                <article class="dashboard-home-card" id="opsAvailabilitySummaryCard">\n                    <span>Horarios</span>\n                    <strong id="opsAvailabilityCount">0</strong>\n                    <small id="opsAvailabilityMeta">Sin horarios publicados</small>\n                    <button type="button" data-action="context-open-availability">Abrir horarios</button>\n                </article>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel dashboard-signal-panel" id="opsQueueLaunchCard">\n            <header>\n                <div>\n                    <h3>Turnero de sala</h3>\n                    <small id="operationRefreshSignal">App separada para recepcion y consultorio</small>\n                </div>\n                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>\n            </header>\n            <p id="dashboardLiveMeta">\n                Abre el turnero solo cuando vayas a llamar pacientes.\n            </p>\n            <div class="dashboard-signal-stack">\n                <article class="dashboard-signal-card">\n                    <span>Estado</span>\n                    <strong id="opsQueueStatus">Listo para abrir</strong>\n                    <small id="opsQueueMeta">Sin cola activa</small>\n                </article>\n                <article class="dashboard-signal-card">\n                    <span>Mas herramientas</span>\n                    <strong id="dashboardQueueHealth">Turnero avanzado disponible</strong>\n                    <small id="dashboardFlowStatus">Resenas, diagnostico y cola completa siguen fuera del primer paso.</small>\n                </article>\n            </div>\n            <button\n                type="button"\n                id="openOperatorAppBtn"\n                class="dashboard-launch-btn"\n                data-action="open-operator-app"\n            >\n                Abrir turnero\n            </button>\n            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-grid sony-grid-two">\n            <article class="sony-panel dashboard-card-operations">\n                <header>\n                    <h3>Siguientes pasos</h3>\n                    <small id="operationDeckMeta">Atajos utiles para el dia</small>\n                </header>\n                <div class="sony-panel-stats">\n                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>\n                    <div><span>Llamadas</span><strong id="operationPendingCallbacksCount">0</strong></div>\n                    <div><span>Hoy</span><strong id="operationTodayLoadCount">0</strong></div>\n                </div>\n                <p id="operationQueueHealth">Sin pendientes urgentes.</p>\n                <div id="operationActionList" class="operations-action-list"></div>\n            </article>\n\n            <article class="sony-panel" id="funnelSummary">\n                <header>\n                    <h3>Mas herramientas</h3>\n                    <small>Analitica y diagnostico fuera del flujo principal</small>\n                </header>\n                <p class="dashboard-secondary-summary">\n                    Resenas, embudo y turnero avanzado siguen disponibles, pero ya no compiten con la operacion diaria.\n                </p>\n                <div class="dashboard-secondary-links">\n                    <a href="#reviews" class="dashboard-secondary-link" data-section="reviews">Abrir resenas</a>\n                    <a href="#queue" class="dashboard-secondary-link" data-section="queue">Turnero avanzado</a>\n                </div>\n                <div class="sony-panel-stats dashboard-secondary-metrics">\n                    <div><span>Reservas</span><strong id="funnelViewBooking">0</strong></div>\n                    <div><span>Checkout</span><strong id="funnelStartCheckout">0</strong></div>\n                    <div><span>Confirmadas</span><strong id="funnelBookingConfirmed">0</strong></div>\n                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>\n                </div>\n            </article>\n        </div>\n    \n            \n        <details class="sony-panel dashboard-analytics-disclosure" id="dashboardAdvancedAnalytics">\n            <summary>\n                <span>Analitica avanzada</span>\n                <small>Embudo y detalle operativo secundario</small>\n            </summary>\n            <div class="sony-grid sony-grid-three dashboard-analytics-grid">\n                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>\n                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>\n            </div>\n        </details>\n    \n            <div class="sr-only" id="adminAvgRating"></div>\n        </section>\n    \n        \n        <section id="appointments" class="admin-section" tabindex="-1">\n            <div class="appointments-stage">\n                \n        <article class="sony-panel appointments-command-deck">\n            <header class="section-header appointments-command-head">\n                <div>\n                    <p class="sony-kicker">Agenda clinica</p>\n                    <h3>Citas</h3>\n                    <p id="appointmentsDeckSummary">Sin citas cargadas.</p>\n                </div>\n                <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>\n            </header>\n            <div class="appointments-ops-grid">\n                <article class="appointments-ops-card tone-warning">\n                    <span>Transferencias</span>\n                    <strong id="appointmentsOpsPendingTransfer">0</strong>\n                    <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>\n                </article>\n                <article class="appointments-ops-card tone-neutral">\n                    <span>Proximas 48h</span>\n                    <strong id="appointmentsOpsUpcomingCount">0</strong>\n                    <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>\n                </article>\n                <article class="appointments-ops-card tone-danger">\n                    <span>No show</span>\n                    <strong id="appointmentsOpsNoShowCount">0</strong>\n                    <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>\n                </article>\n                <article class="appointments-ops-card tone-success">\n                    <span>Hoy</span>\n                    <strong id="appointmentsOpsTodayCount">0</strong>\n                    <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>\n                </article>\n            </div>\n            <div class="appointments-command-actions">\n                <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>\n                <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>\n                <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel appointments-focus-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>\n                    <h3 id="appointmentsFocusPatient">Sin citas activas</h3>\n                    <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>\n                </div>\n            </header>\n            <div class="appointments-focus-grid">\n                <div class="appointments-focus-stat">\n                    <span>Siguiente ventana</span>\n                    <strong id="appointmentsFocusWindow">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Pago</span>\n                    <strong id="appointmentsFocusPayment">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Estado</span>\n                    <strong id="appointmentsFocusStatus">-</strong>\n                </div>\n                <div class="appointments-focus-stat">\n                    <span>Contacto</span>\n                    <strong id="appointmentsFocusContact">-</strong>\n                </div>\n            </div>\n            <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>\n            <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel appointments-workbench">\n            <header class="section-header appointments-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>\n                </div>\n                <div class="toolbar-group" id="appointmentsDensityToggle">\n                    <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>\n                    <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>\n                    <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>\n                </div>\n            </div>\n            <div class="toolbar-row appointments-toolbar">\n                <label>\n                    <span class="sr-only">Filtro</span>\n                    <select id="appointmentFilter">\n                        <option value="all">Todas</option>\n                        <option value="pending_transfer">Transferencias por validar</option>\n                        <option value="upcoming_48h">Proximas 48h</option>\n                        <option value="no_show">No show</option>\n                        <option value="triage_attention">Triage accionable</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden</span>\n                    <select id="appointmentSort">\n                        <option value="datetime_desc">Fecha reciente</option>\n                        <option value="datetime_asc">Fecha ascendente</option>\n                        <option value="patient_az">Paciente (A-Z)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchAppointments" placeholder="Buscar paciente" />\n                <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="appointmentsToolbarMeta">Mostrando 0</p>\n                <p id="appointmentsToolbarState">Sin filtros activos</p>\n            </div>\n\n            <div class="table-scroll appointments-table-shell">\n                <table id="appointmentsTable" class="sony-table">\n                    <thead>\n                        <tr>\n                            <th>Paciente</th>\n                            <th>Servicio</th>\n                            <th>Fecha</th>\n                            <th>Pago</th>\n                            <th>Estado</th>\n                            <th>Acciones</th>\n                        </tr>\n                    </thead>\n                    <tbody id="appointmentsTableBody"></tbody>\n                </table>\n            </div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="callbacks" class="admin-section" tabindex="-1">\n            <div class="callbacks-stage">\n                \n        <article class="sony-panel callbacks-command-deck">\n            <header class="section-header callbacks-command-head">\n                <div>\n                    <p class="sony-kicker">SLA telefonico</p>\n                    <h3>Callbacks</h3>\n                    <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>\n                </div>\n                <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>\n            </header>\n            <div id="callbacksOpsPanel" class="callbacks-ops-grid">\n                <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hot</span><strong id="callbacksOpsUrgentCount">0</strong></article>\n                <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>\n                <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>\n            </div>\n            <div class="callbacks-command-actions">\n                <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>\n                <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>\n                <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>\n                <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>\n            </div>\n        </article>\n    \n                \n        <article class="sony-panel callbacks-next-panel">\n            <header class="section-header">\n                <div>\n                    <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>\n                    <h3 id="callbacksOpsNext">Sin telefono</h3>\n                    <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>\n                </div>\n                <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>\n            </header>\n            <div class="callbacks-next-grid">\n                <div class="callbacks-next-stat">\n                    <span>Espera</span>\n                    <strong id="callbacksNextWait">0 min</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Servicio</span>\n                    <strong id="callbacksNextPreference">-</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Accion</span>\n                    <strong id="callbacksNextState">Pendiente</strong>\n                </div>\n                <div class="callbacks-next-stat">\n                    <span>Estado IA</span>\n                    <strong id="callbacksDeckHint">Sin bloqueos</strong>\n                </div>\n            </div>\n        </article>\n    \n            </div>\n\n            \n        <div class="sony-panel callbacks-workbench">\n            <header class="section-header callbacks-workbench-head">\n                <div>\n                    <h3>Workbench</h3>\n                    <p>Ordena por prioridad comercial, genera borradores IA y registra el outcome sin salir del panel.</p>\n                </div>\n            </header>\n            <div class="toolbar-row">\n                <div class="toolbar-group">\n                    <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>\n                    <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>\n                </div>\n            </div>\n            <div class="toolbar-row callbacks-toolbar">\n                <label>\n                    <span class="sr-only">Filtro callbacks</span>\n                    <select id="callbackFilter">\n                        <option value="all">Todos</option>\n                        <option value="pending">Pendientes</option>\n                        <option value="contacted">Contactados</option>\n                        <option value="today">Hoy</option>\n                        <option value="sla_urgent">Urgentes SLA</option>\n                    </select>\n                </label>\n                <label>\n                    <span class="sr-only">Orden callbacks</span>\n                    <select id="callbackSort">\n                        <option value="priority_desc">Prioridad comercial</option>\n                        <option value="recent_desc">Mas recientes</option>\n                        <option value="waiting_desc">Mayor espera (SLA)</option>\n                    </select>\n                </label>\n                <input type="search" id="searchCallbacks" placeholder="Buscar telefono o servicio" />\n                <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>\n            </div>\n            <div class="toolbar-row slim">\n                <p id="callbacksToolbarMeta">Mostrando 0</p>\n                <p id="callbacksToolbarState">Sin filtros activos</p>\n            </div>\n            <div id="callbacksGrid" class="callbacks-grid"></div>\n        </div>\n    \n        </section>\n    \n        \n        <section id="reviews" class="admin-section" tabindex="-1">\n            <div class="reviews-stage">\n                <article class="sony-panel reviews-summary-panel">\n                    <header class="section-header">\n                        <div>\n                            <h3>Resenas</h3>\n                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>\n                        </div>\n                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>\n                    </header>\n                    <div class="reviews-summary-grid">\n                        <div class="reviews-summary-stat">\n                            <span>5 estrellas</span>\n                            <strong id="reviewsFiveStarCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Ultimos 30 dias</span>\n                            <strong id="reviewsRecentCount">0</strong>\n                        </div>\n                        <div class="reviews-summary-stat">\n                            <span>Total</span>\n                            <strong id="reviewsTotalCount">0</strong>\n                        </div>\n                    </div>\n                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>\n                </article>\n\n                <article class="sony-panel reviews-spotlight-panel">\n                    <header class="section-header"><h3>Spotlight</h3></header>\n                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>\n                </article>\n            </div>\n            <div class="sony-panel">\n                <div id="reviewsGrid" class="reviews-grid"></div>\n            </div>\n        </section>\n    \n        \n        <section id="availability" class="admin-section" tabindex="-1">\n            <div class="sony-panel availability-container">\n                \n        <header class="section-header availability-header">\n            <div class="availability-calendar">\n                <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>\n                <div class="availability-badges">\n                    <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>\n                    <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>\n                    <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>\n                </div>\n            </div>\n            <div class="toolbar-group calendar-header">\n                <button type="button" data-action="change-month" data-delta="-1">Prev</button>\n                <strong id="calendarMonth"></strong>\n                <button type="button" data-action="change-month" data-delta="1">Next</button>\n                <button type="button" data-action="availability-today">Hoy</button>\n                <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>\n                <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>\n            </div>\n        </header>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="availabilitySelectionSummary">Selecciona una fecha</p>\n            <p id="availabilityDraftStatus">Sin cambios pendientes</p>\n            <p id="availabilitySyncStatus">Sincronizado</p>\n        </div>\n    \n                <div id="availabilityCalendar" class="availability-calendar-grid"></div>\n                \n        <div id="availabilityDetailGrid" class="availability-detail-grid">\n            <article class="sony-panel soft">\n                <h4 id="selectedDate">-</h4>\n                <div id="timeSlotsList" class="time-slots-list"></div>\n            </article>\n\n            <article class="sony-panel soft">\n                <div id="availabilityQuickSlotPresets" class="slot-presets">\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>\n                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>\n                </div>\n                <div id="addSlotForm" class="add-slot-form">\n                    <input type="time" id="newSlotTime" />\n                    <button type="button" data-action="add-time-slot">Agregar</button>\n                </div>\n                <div id="availabilityDayActions" class="toolbar-group wrap">\n                    <button type="button" data-action="copy-availability-day">Copiar dia</button>\n                    <button type="button" data-action="paste-availability-day">Pegar dia</button>\n                    <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>\n                    <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>\n                    <button type="button" data-action="clear-availability-day">Limpiar dia</button>\n                    <button type="button" data-action="clear-availability-week">Limpiar semana</button>\n                </div>\n                <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>\n                <div class="toolbar-group">\n                    <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>\n                    <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>\n                </div>\n            </article>\n        </div>\n    \n            </div>\n        </section>\n    \n        \n        <section id="queue" class="admin-section" tabindex="-1">\n            <div class="sony-panel">\n                \n        <header class="section-header">\n            <div>\n                <h3>Turnero Sala</h3>\n                <p>\n                    Apps operativas, cola en vivo y flujo simple para recepción,\n                    kiosco y TV.\n                </p>\n            </div>\n            <div class="queue-admin-header-actions">\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>\n                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>\n                <button type="button" data-action="queue-refresh-state">Refrescar</button>\n            </div>\n        </header>\n    \n                \n        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft">\n            <div class="queue-apps-hub__header">\n                <div>\n                    <h4>Apps operativas</h4>\n                    <p>\n                        Instala Operador, Kiosco y Sala TV desde el mismo centro de\n                        control para separar cada equipo por uso.\n                    </p>\n                </div>\n                <div class="queue-apps-hub__header-meta">\n                    <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">\n                        Plataforma detectada\n                    </span>\n                    <span id="queueAppsRefreshShieldChip" class="queue-apps-refresh-shield-chip" data-state="idle">\n                        Refresh sin bloqueo\n                    </span>\n                </div>\n            </div>\n            <div id="queueFocusMode" class="queue-focus-mode" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueNumpadGuide" class="queue-numpad-guide" data-focus-match="opening operations incidents"></div>\n            <div id="queueConsultorioBoard" class="queue-consultorio-board" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueAttentionDeck" class="queue-attention-deck" data-focus-match="operations incidents closing"></div>\n            <div id="queueResolutionDeck" class="queue-resolution-deck" data-focus-match="operations incidents closing"></div>\n            <div id="queueTicketLookup" class="queue-ticket-lookup" data-focus-match="operations incidents closing"></div>\n            <div id="queueTicketRoute" class="queue-ticket-route" data-focus-match="operations incidents closing"></div>\n            <div id="queueTicketSimulation" class="queue-ticket-simulation" data-focus-match="operations incidents closing"></div>\n            <div id="queueNextTurns" class="queue-next-turns" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueWaitRadar" class="queue-wait-radar" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueLoadBalance" class="queue-load-balance" data-focus-match="opening operations incidents closing"></div>\n            <div id="queuePriorityLane" class="queue-priority-lane" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueQuickTrays" class="queue-quick-trays" data-focus-match="operations incidents closing"></div>\n            <div id="queueActiveTray" class="queue-active-tray" data-focus-match="operations incidents closing"></div>\n            <div id="queueTrayBurst" class="queue-tray-burst" data-focus-match="operations incidents closing"></div>\n            <div id="queueDispatchDeck" class="queue-dispatch-deck" data-focus-match="opening operations incidents"></div>\n            <div id="queueQuickConsole" class="queue-quick-console" data-focus-match="opening operations incidents closing"></div>\n            <div id="queuePlaybook" class="queue-playbook" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueOpsPilot" class="queue-ops-pilot" data-focus-match="opening operations incidents"></div>\n            <div id="queueAppDownloadsCards" class="queue-apps-grid" data-focus-match="opening operations"></div>\n            <div id="queueSurfaceTelemetry" class="queue-surface-telemetry" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueOpsAlerts" class="queue-ops-alerts" data-focus-match="opening operations incidents closing"></div>\n            <div id="queueOpeningChecklist" class="queue-opening-checklist" data-focus-match="opening"></div>\n            <div id="queueShiftHandoff" class="queue-shift-handoff" data-focus-match="closing"></div>\n            <div id="queueOpsLog" class="queue-ops-log" data-focus-match="operations incidents closing"></div>\n            <div id="queueContingencyDeck" class="queue-contingency-deck" data-focus-match="incidents operations"></div>\n            <div id="queueInstallConfigurator" class="queue-install-configurator" data-focus-match="opening operations"></div>\n        </div>\n    \n                \n        <div class="sony-grid sony-grid-kpi slim">\n            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>\n            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>\n            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>\n        </div>\n    \n                \n        <div id="queueStationControl" class="toolbar-row">\n            <span id="queueStationBadge">Estacion: libre</span>\n            <span id="queueStationModeBadge">Modo: free</span>\n            <span id="queuePracticeModeBadge" hidden>Practice ON</span>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>\n            <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>\n            <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>\n            <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>\n            <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>\n            <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>\n            <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>\n            <button type="button" data-action="queue-start-practice">Iniciar practica</button>\n            <button type="button" data-action="queue-stop-practice">Salir practica</button>\n            <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>\n            <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>\n        </div>\n    \n                \n        <div id="queueShortcutPanel" hidden>\n            <p>Numpad Enter llama siguiente.</p>\n            <p>Numpad Decimal prepara completar.</p>\n            <p>Numpad Subtract prepara no_show.</p>\n            <p>Numpad Add re-llama el ticket activo.</p>\n        </div>\n    \n                \n        <div id="queueTriageToolbar" class="toolbar-row">\n            <button type="button" data-queue-filter="all">Todo</button>\n            <button type="button" data-queue-filter="called">Llamados</button>\n            <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>\n            <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />\n            <button type="button" data-action="queue-clear-search">Limpiar</button>\n            <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>\n            <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>\n            <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>\n            <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>\n        </div>\n    \n                \n        <div class="toolbar-row slim">\n            <p id="queueTriageSummary">Sin riesgo</p>\n            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>\n        </div>\n    \n                \n        <ul id="queueNextAdminList" class="sony-list"></ul>\n\n        <div class="table-scroll">\n            <table class="sony-table queue-admin-table">\n                <thead>\n                    <tr>\n                        <th>Sel</th>\n                        <th>Ticket</th>\n                        <th>Tipo</th>\n                        <th>Estado</th>\n                        <th>Consultorio</th>\n                        <th>Espera</th>\n                        <th>Acciones</th>\n                    </tr>\n                </thead>\n                <tbody id="queueTableBody"></tbody>\n            </table>\n        </div>\n\n        <div id="queueActivityPanel" class="sony-panel soft">\n            <h4>Actividad</h4>\n            <ul id="queueActivityList" class="sony-list"></ul>\n        </div>\n    \n            </div>\n\n            \n        <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">\n            <form method="dialog">\n                <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>\n                <div class="toolbar-group">\n                    <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>\n                    <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>\n                </div>\n            </form>\n        </dialog>\n    \n        </section>\n    \n    \n        </main>\n    \n            \n        <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">\n            <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>\n            <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">\n                <div class="admin-command-dialog__head">\n                    <div>\n                        <p class="sony-kicker">Acciones rapidas</p>\n                        <h3 id="adminCommandPaletteTitle">Ir a una tarea</h3>\n                    </div>\n                    <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>\n                </div>\n                <div class="admin-command-box">\n                    <input id="adminQuickCommand" type="text" placeholder="Ej. agenda, pendientes, horarios, turnero" />\n                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>\n                </div>\n                <div class="admin-command-dialog__hints">\n                    <span>Ctrl+K abre esta paleta</span>\n                    <span>/ enfoca la busqueda de la seccion activa</span>\n                </div>\n            </div>\n        </div>\n    \n        </div>\n    `;
}
const E = {
        dashboard: {
            eyebrow: 'Recepcion/Admin',
            title: 'Que requiere atencion ahora',
            summary:
                'Agenda, pendientes y turnero separados en un panel mas simple para la operacion diaria.',
            actions: [
                {
                    action: 'open-operator-app',
                    label: 'Abrir turnero',
                    meta: 'Ir a la app operativa de sala',
                },
                {
                    action: 'context-open-appointments-overview',
                    label: 'Ver agenda',
                    meta: 'Ir a pacientes y citas del dia',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Revisar pendientes',
                    meta: 'Llamadas y seguimientos pendientes',
                },
            ],
        },
        appointments: {
            eyebrow: 'Agenda del dia',
            title: 'Pacientes y citas',
            summary:
                'Consulta la agenda, filtra pendientes y resuelve pagos sin perder el hilo del dia.',
            actions: [
                {
                    action: 'clear-appointment-filters',
                    label: 'Limpiar filtros',
                    meta: 'Volver a la agenda completa',
                },
                {
                    action: 'export-csv',
                    label: 'Exportar CSV',
                    meta: 'Descargar agenda para soporte',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ver pendientes',
                    meta: 'Cruzar seguimiento telefonico',
                },
            ],
        },
        callbacks: {
            eyebrow: 'Seguimiento',
            title: 'Pendientes de contacto',
            summary:
                'Prioriza llamadas pendientes y resuelve primero los casos mas atrasados.',
            actions: [
                {
                    action: 'callbacks-triage-next',
                    label: 'Siguiente llamada',
                    meta: 'Mover foco al siguiente caso',
                },
                {
                    action: 'context-open-callbacks-next',
                    label: 'Abrir siguiente',
                    meta: 'Ir a la tarjeta prioritaria',
                },
                {
                    action: 'context-open-appointments-overview',
                    label: 'Ver agenda',
                    meta: 'Cruzar citas y seguimientos',
                },
            ],
        },
        reviews: {
            eyebrow: 'Calidad',
            title: 'Resenas y calidad reciente',
            summary:
                'Consulta feedback y calidad reciente desde una vista secundaria.',
            actions: [
                {
                    action: 'refresh-admin-data',
                    label: 'Actualizar',
                    meta: 'Sincronizar resenas',
                },
                {
                    action: 'context-open-dashboard',
                    label: 'Volver al inicio',
                    meta: 'Regresar al resumen operativo',
                },
                {
                    action: 'context-open-callbacks-pending',
                    label: 'Ver pendientes',
                    meta: 'Cerrar seguimiento operativo',
                },
            ],
        },
        availability: {
            eyebrow: 'Horarios',
            title: 'Horarios de atencion',
            summary:
                'Gestiona horarios publicados y prepara nuevas jornadas sin salir del calendario.',
            actions: [
                {
                    action: 'context-availability-today',
                    label: 'Ir a hoy',
                    meta: 'Volver al dia actual',
                },
                {
                    action: 'context-availability-next',
                    label: 'Siguiente con slots',
                    meta: 'Buscar siguiente dia util',
                },
                {
                    action: 'context-copy-availability-day',
                    label: 'Copiar dia',
                    meta: 'Duplicar jornada seleccionada',
                },
            ],
        },
        queue: {
            eyebrow: 'Herramientas avanzadas',
            title: 'Turnero y diagnostico de sala',
            summary:
                'Mantiene el turnero completo, instaladores y diagnostico fuera del flujo principal diario.',
            actions: [
                {
                    action: 'open-operator-app',
                    label: 'Abrir turnero',
                    meta: 'Ir a la app operativa separada',
                },
                {
                    action: 'queue-call-next',
                    label: 'Llamar C1',
                    meta: 'Despachar siguiente ticket',
                    queueConsultorio: '1',
                },
                {
                    action: 'queue-refresh-state',
                    label: 'Refrescar cola',
                    meta: 'Sincronizar estado operativo',
                },
            ],
        },
    },
    B = {
        dashboard: 'Inicio',
        appointments: 'Agenda',
        callbacks: 'Pendientes',
        reviews: 'Resenas',
        availability: 'Horarios',
        queue: 'Turnero avanzado',
    };
function N() {
    const e = t('#loginScreen'),
        a = t('#adminDashboard');
    (e && e.classList.remove('is-hidden'), a && a.classList.add('is-hidden'));
}
function I() {
    const e = t('#loginScreen'),
        a = t('#adminDashboard');
    (e && e.classList.add('is-hidden'), a && a.classList.remove('is-hidden'));
}
function P() {
    const e = t('#adminCommandPalette');
    e instanceof HTMLElement &&
        (e.classList.remove('is-hidden'),
        e.setAttribute('aria-hidden', 'false'),
        document.body.classList.add('admin-command-open'));
}
function j() {
    const e = t('#adminCommandPalette');
    e instanceof HTMLElement &&
        (e.classList.add('is-hidden'),
        e.setAttribute('aria-hidden', 'true'),
        document.body.classList.remove('admin-command-open'));
}
function x(e) {
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
    const n = B[e] || 'Inicio',
        i = t('#pageTitle');
    i && (i.textContent = n);
}
function R(e) {
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
        O(!1));
}
function D({
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
function O(e) {
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
function H({ clearPassword: e = !1 } = {}) {
    const a = t('#adminPassword'),
        n = t('#admin2FACode');
    (a instanceof HTMLInputElement && e && (a.value = ''),
        n instanceof HTMLInputElement && (n.value = ''));
}
function F(e = 'password') {
    const a = t('2fa' === e ? '#admin2FACode' : '#adminPassword');
    a instanceof HTMLInputElement && (a.focus(), a.select?.());
}
function U(a) {
    const n = (function (e) {
        const t = E[e?.ui?.activeSection || 'dashboard'] || E.dashboard,
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
                            return `\n        <button type="button" class="sony-context-action" ${[`data-action="${e(t.action)}"`, t.queueConsultorio ? `data-queue-consultorio="${e(t.queueConsultorio)}"` : '', t.filterValue ? `data-filter-value="${e(t.filterValue)}"` : ''].filter(Boolean).join(' ')}>\n            <span class="sony-context-action-copy">\n                <strong>${e(t.label)}</strong>\n                <small>${e(t.meta)}</small>\n            </span>\n            ${t.shortcut ? `<span class="sony-context-action-key">${e(t.shortcut)}</span>` : ''}\n        </button>\n    `;
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
const K = {
    dashboard: {
        hero: '.dashboard-hero-panel',
        priority: '.dashboard-signal-panel',
        workbench: '.dashboard-card-operations',
        detail: '#dashboardAdvancedAnalytics',
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
const z = 'admin-appointments-sort',
    Q = 'admin-appointments-density',
    G = 'datetime_desc',
    W = 'comfortable';
function J(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function Y(e) {
    return J(e.paymentStatus || e.payment_status || '');
}
function Z(e) {
    return J(e);
}
function X(e, t = '-') {
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
function ee(e) {
    return (function (e) {
        const t = new Date(e || '');
        return Number.isNaN(t.getTime()) ? 0 : t.getTime();
    })(`${e?.date || ''}T${e?.time || '00:00'}:00`);
}
function te(e) {
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
function ae(e) {
    const t = ee(e);
    if (!t) return !1;
    const a = new Date(t),
        n = new Date();
    return (
        a.getFullYear() === n.getFullYear() &&
        a.getMonth() === n.getMonth() &&
        a.getDate() === n.getDate()
    );
}
function ne(e) {
    const t = ee(e);
    if (!t) return !1;
    const a = t - Date.now();
    return a >= 0 && a <= 1728e5;
}
function ie(e) {
    return (
        {
            pending_transfer_review: 'Validar pago',
            pending_transfer: 'Transferencia',
            pending_cash: 'Pago en consultorio',
            pending_gateway: 'Pago en proceso',
            paid: 'Pagado',
            failed: 'Fallido',
        }[J(e)] || X(e, 'Pendiente')
    );
}
function oe(e) {
    return (
        {
            confirmed: 'Confirmada',
            pending: 'Pendiente',
            completed: 'Completada',
            cancelled: 'Cancelada',
            no_show: 'No show',
        }[J(e)] || X(e, 'Pendiente')
    );
}
function se(e) {
    const t = Y(e),
        a = Z(e.status);
    return (
        'pending_transfer_review' === t ||
        'pending_transfer' === t ||
        'no_show' === a ||
        'cancelled' === a
    );
}
function re(e, t) {
    const a = J(t);
    return 'pending_transfer' === a
        ? e.filter((e) => {
              const t = Y(e);
              return (
                  'pending_transfer_review' === t || 'pending_transfer' === t
              );
          })
        : 'upcoming_48h' === a
          ? e.filter(ne)
          : 'no_show' === a
            ? e.filter((e) => 'no_show' === Z(e.status))
            : 'triage_attention' === a
              ? e.filter(se)
              : e;
}
function le(e) {
    const t = Y(e),
        a = Z(e.status),
        n = ee(e);
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
            : ae(e)
              ? {
                    label: 'Hoy',
                    tone: 'success',
                    note: n ? te(n) : 'Agenda del dia',
                }
              : ne(e)
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
function ce(e) {
    const t = e
            .map((e) => ({ item: e, stamp: ee(e) }))
            .sort((e, t) => e.stamp - t.stamp),
        a = t.find(({ item: e }) => {
            const t = Y(e);
            return 'pending_transfer_review' === t || 'pending_transfer' === t;
        });
    if (a)
        return {
            item: a.item,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y confirma al paciente antes del check-in.',
            tags: ['Pago por validar', 'Liberar agenda'],
        };
    const n = t.find(({ item: e }) => 'no_show' === Z(e.status));
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
function ue(t) {
    return t.length
        ? t
              .map((t) => {
                  const a = ee(t);
                  return `\n                <tr class="appointment-row" data-appointment-id="${Number(t.id || 0)}">\n                    <td data-label="Paciente">\n                        <div class="appointment-person">\n                            <strong>${e(t.name || 'Sin nombre')}</strong>\n                            <span>${e(t.email || 'Sin email')}</span>\n                            <small>${e(t.phone || 'Sin telefono')}</small>\n                        </div>\n                    </td>\n                    <td data-label="Servicio">${(function (
                      t
                  ) {
                      const a = le(t);
                      return `\n        <div class="appointment-service">\n            <strong>${e(X(t.service, 'Servicio pendiente'))}</strong>\n            <span>Especialista: ${e(X(t.doctor, 'Sin asignar'))}</span>\n            <small>${e(a.label)} | ${e(a.note)}</small>\n        </div>\n    `;
                  })(
                      t
                  )}</td>\n                    <td data-label="Fecha">\n                        <div class="appointment-date-stack">\n                            <strong>${e(n(t.date))}</strong>\n                            <span>${e(t.time || '--:--')}</span>\n                            <small>${e(te(a))}</small>\n                        </div>\n                    </td>\n                    <td data-label="Pago">${(function (
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
                              const t = J(e);
                              return 'paid' === t
                                  ? 'success'
                                  : 'failed' === t
                                    ? 'danger'
                                    : 'pending_cash' === t
                                      ? 'neutral'
                                      : 'warning';
                          })(a)
                      )}">${e(ie(a))}</span>\n            <small>Metodo: ${e(((i = t.paymentMethod || t.payment_method || ''), { transfer: 'Transferencia', cash: 'Consultorio', card: 'Tarjeta', gateway: 'Pasarela' }[J(i)] || X(i, 'Metodo pendiente')))}</small>\n            ${n ? `<a href="${e(n)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}\n        </div>\n    `;
                      var i;
                  })(
                      t
                  )}</td>\n                    <td data-label="Estado">${(function (
                      t
                  ) {
                      const a = Z(t.status),
                          n = Y(t),
                          i = le(t),
                          o = [];
                      return (
                          'pending_transfer_review' === n &&
                              o.push('Transferencia por validar'),
                          'no_show' === a && o.push('Paciente ausente'),
                          'cancelled' === a && o.push('Cita cerrada'),
                          `\n        <div class="appointment-status-stack">\n            <span class="appointment-pill" data-tone="${e(
                              (function (e) {
                                  const t = J(e);
                                  return 'completed' === t
                                      ? 'success'
                                      : 'cancelled' === t || 'no_show' === t
                                        ? 'danger'
                                        : 'pending' === t
                                          ? 'warning'
                                          : 'neutral';
                              })(a)
                          )}">${e(oe(a))}</span>\n            <small>${e(o[0] || i.note)}</small>\n        </div>\n    `
                      );
                  })(
                      t
                  )}</td>\n                    <td data-label="Acciones">${(function (
                      t
                  ) {
                      const a = Number(t.id || 0),
                          n = Y(t),
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
function de() {
    const t = g(),
        a = Array.isArray(t?.data?.appointments) ? t.data.appointments : [],
        i = t?.appointments || {
            filter: 'all',
            search: '',
            sort: 'datetime_desc',
            density: 'comfortable',
        },
        o = (function (e, t) {
            const a = J(t),
                n = [...e];
            return 'patient_az' === a
                ? (n.sort((e, t) => J(e.name).localeCompare(J(t.name), 'es')),
                  n)
                : 'datetime_asc' === a
                  ? (n.sort((e, t) => ee(e) - ee(t)), n)
                  : (n.sort((e, t) => ee(t) - ee(e)), n);
        })(
            (function (e, t) {
                const a = J(t);
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
                          ].some((e) => J(e).includes(a))
                      )
                    : e;
            })(re(a, i.filter), i.search),
            i.sort
        );
    (l('#appointmentsTableBody', ue(o)),
        (function (e, t, a) {
            (r('#appointmentsToolbarMeta', `Mostrando ${t} de ${a}`),
                r(
                    '#appointmentsToolbarState',
                    (function (e, t) {
                        const a = [];
                        if ('all' !== J(e.filter)) {
                            const t = {
                                pending_transfer: 'Transferencias por validar',
                                triage_attention: 'Triage accionable',
                                upcoming_48h: 'Proximas 48h',
                                no_show: 'No show',
                            };
                            a.push(t[J(e.filter)] || e.filter);
                        }
                        return (
                            J(e.search) && a.push(`Busqueda: ${e.search}`),
                            'patient_az' === J(e.sort)
                                ? a.push('Paciente (A-Z)')
                                : 'datetime_asc' === J(e.sort)
                                  ? a.push('Fecha ascendente')
                                  : a.push('Fecha reciente'),
                            0 === t && a.push('Resultados: 0'),
                            a
                        );
                    })(e, t).join(' | ')
                ));
            const n = document.getElementById('clearAppointmentsFiltersBtn');
            if (n) {
                const t = 'all' !== J(e.filter) || '' !== J(e.search);
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
                    'compact' === J(e.density)
                ),
                document
                    .querySelectorAll(
                        '[data-action="appointment-density"][data-density]'
                    )
                    .forEach((t) => {
                        const a = J(t.dataset.density) === J(e.density);
                        t.classList.toggle('is-active', a);
                    }),
                (function (e) {
                    const t = J(e);
                    document
                        .querySelectorAll(
                            '.appointment-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((e) => {
                            const a = J(e.dataset.filterValue) === t;
                            e.classList.toggle('is-active', a);
                        });
                })(e.filter),
                (function (e) {
                    try {
                        (localStorage.setItem(z, JSON.stringify(e.sort)),
                            localStorage.setItem(Q, JSON.stringify(e.density)));
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
                    `${X(c.service, 'Servicio pendiente')} | ${n(c.date)} ${c.time || '--:--'}`
                ),
                r('#appointmentsFocusWindow', te(ee(c))),
                r(
                    '#appointmentsFocusPayment',
                    ie(c.paymentStatus || c.payment_status)
                ),
                r('#appointmentsFocusStatus', oe(c.status)),
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
                const t = re(e, 'pending_transfer'),
                    a = re(e, 'upcoming_48h'),
                    n = re(e, 'no_show'),
                    i = re(e, 'triage_attention'),
                    o = e.filter(ae);
                return {
                    pendingTransferCount: t.length,
                    upcomingCount: a.length,
                    noShowCount: n.length,
                    todayCount: o.length,
                    triageCount: i.length,
                    focus: ce(e),
                };
            })(a),
            o.length,
            a.length
        ));
}
function pe(e) {
    (b((t) => ({ ...t, appointments: { ...t.appointments, ...e } })), de());
}
function me(e) {
    pe({ filter: J(e) || 'all' });
}
function ge(e) {
    pe({ search: String(e || '') });
}
function be(e, t) {
    const a = Number(e || 0);
    (b((e) => ({
        ...e,
        data: {
            ...e.data,
            appointments: (e.data.appointments || []).map((e) =>
                Number(e.id || 0) === a ? { ...e, ...t } : e
            ),
        },
    })),
        de());
}
async function fe(e, t) {
    await _('appointments', {
        method: 'PATCH',
        body: { id: Number(e || 0), ...t },
    });
}
const ye = 'admin-callbacks-sort',
    ve = 'admin-callbacks-filter',
    he = new Set(['all', 'pending', 'contacted', 'today', 'sla_urgent']),
    ke = new Set(['priority_desc', 'recent_desc', 'waiting_desc']);
function qe(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function $e(e) {
    const t = qe(e);
    return he.has(t) ? t : 'all';
}
function _e(e) {
    const t = qe(e);
    return ke.has(t) ? t : 'priority_desc';
}
function Ce(e) {
    const t = qe(e);
    return t.includes('contact') || 'resolved' === t || 'atendido' === t
        ? 'contacted'
        : 'pending';
}
function Se(e) {
    const t = new Date(e?.fecha || e?.createdAt || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function we(e) {
    const t = Se(e);
    return t ? Math.max(0, Math.round((Date.now() - t) / 6e4)) : 0;
}
function Le(e) {
    return e < 60
        ? `${e} min`
        : e < 1440
          ? `${Math.round(e / 60)} h`
          : `${Math.round(e / 1440)} d`;
}
function Ae(e) {
    const t = new Date(e || '');
    if (Number.isNaN(t.getTime())) return !1;
    const a = new Date();
    return (
        t.getFullYear() === a.getFullYear() &&
        t.getMonth() === a.getMonth() &&
        t.getDate() === a.getDate()
    );
}
function Te(e) {
    return e?.leadOps && 'object' == typeof e.leadOps ? e.leadOps : {};
}
function Me(e) {
    const t = qe(Te(e).priorityBand);
    return 'hot' === t || 'warm' === t ? t : 'cold';
}
function Ee(e) {
    const t = Me(e);
    return 'hot' === t ? 3 : 'warm' === t ? 2 : 1;
}
function Be(e) {
    const t = Array.isArray(Te(e).serviceHints) ? Te(e).serviceHints : [];
    return String(t[0] || '').trim() || 'Sin sugerencia';
}
function Ne(e) {
    return (
        String(Te(e).nextAction || '').trim() || 'Mantener visible en la cola'
    );
}
function Ie(e, t = '') {
    const a = qe(Te(e).aiStatus);
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
function Pe(e) {
    return String(Te(e).aiDraft || '').trim();
}
function je(e) {
    const t = Number(Te(e).heuristicScore || 0);
    return Number.isFinite(t) ? t : 0;
}
function xe(e) {
    return (
        String(e?.telefono || e?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}
function Re(e) {
    try {
        (localStorage.setItem(ve, JSON.stringify($e(e.filter))),
            localStorage.setItem(ye, JSON.stringify(_e(e.sort))));
    } catch (e) {}
}
function De() {
    const t = g(),
        a = Array.isArray(t?.data?.callbacks) ? t.data.callbacks : [],
        n =
            t?.data?.leadOpsMeta && 'object' == typeof t.data.leadOpsMeta
                ? t.data.leadOpsMeta
                : null,
        o = t.callbacks,
        s = (function (e, t) {
            const a = _e(t),
                n = [...e];
            return 'waiting_desc' === a
                ? (n.sort((e, t) => Se(e) - Se(t)), n)
                : 'recent_desc' === a
                  ? (n.sort((e, t) => Se(t) - Se(e)), n)
                  : (n.sort((e, t) => {
                        const a = Ee(t) - Ee(e);
                        if (0 !== a) return a;
                        const n = je(t) - je(e);
                        return 0 !== n ? n : Se(e) - Se(t);
                    }),
                    n);
        })(
            (function (e, t, a = '') {
                const n = qe(t);
                return n
                    ? e.filter((e) => {
                          const t = Te(e);
                          return [
                              e.telefono,
                              e.phone,
                              e.preferencia,
                              e.status,
                              Be(e),
                              Ne(e),
                              Ie(e, a),
                              ...(Array.isArray(t.reasonCodes)
                                  ? t.reasonCodes
                                  : []),
                              ...(Array.isArray(t.serviceHints)
                                  ? t.serviceHints
                                  : []),
                          ].some((e) => qe(e).includes(n));
                      })
                    : e;
            })(
                (function (e, t) {
                    const a = $e(t);
                    return 'pending' === a || 'contacted' === a
                        ? e.filter((e) => Ce(e.status) === a)
                        : 'today' === a
                          ? e.filter((e) => Ae(e.fecha || e.createdAt))
                          : 'sla_urgent' === a
                            ? e.filter(
                                  (e) =>
                                      'pending' === Ce(e.status) && we(e) >= 120
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
            const a = e.filter((e) => 'pending' === Ce(e.status)),
                n = a.filter((e) => we(e) >= 120),
                i = a.filter((e) => 3 === Ee(e)),
                o = a.slice().sort((e, t) => {
                    const a = Ee(t) - Ee(e);
                    return 0 !== a ? a : Se(e) - Se(t);
                })[0],
                s = qe(t?.worker?.mode || '');
            return {
                pendingCount: a.length,
                urgentCount: n.length,
                hotCount: i.length,
                todayCount: e.filter((e) => Ae(e.fecha || e.createdAt)).length,
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
                              l = xe(t),
                              c = we(t),
                              u = Me(t),
                              d = Pe(t);
                          return `\n        <article class="callback-card ${e(u)} ${'pending' === s ? 'pendiente' : 'contactado'}${a ? ' is-selected' : ''}" data-callback-id="${r}" data-callback-status="${'pending' === s ? 'pendiente' : 'contactado'}">\n            <header>\n                <div class="callback-card-heading">\n                    <div class="callback-card-badges">\n                        <span class="callback-status-pill" data-tone="${e(u)}">${e(
                              (function (e) {
                                  const t = Me(e);
                                  return 'hot' === t
                                      ? 'Hot'
                                      : 'warm' === t
                                        ? 'Warm'
                                        : 'Cold';
                              })(t)
                          )}</span>\n                        <span class="callback-status-pill subtle">${e(Ie(t, o))}</span>\n                    </div>\n                    <h4>${e(l)}</h4>\n                    <p class="callback-card-subtitle">${e(1 === n ? 'Siguiente lead sugerido' : 'Lead interno')}${je(t) ? ` · Score ${e(String(je(t)))}` : ''}</p>\n                </div>\n                <span class="callback-card-wait" data-tone="${e('pending' === s ? u : 'success')}">${e(Le(c))}</span>\n            </header>\n            <div class="callback-card-grid">\n                <p><span>Servicio</span><strong>${e(Be(t))}</strong></p>\n                <p><span>Fecha</span><strong>${e(i(t.fecha || t.createdAt || ''))}</strong></p>\n                <p><span>Siguiente accion</span><strong>${e(Ne(t))}</strong></p>\n                <p><span>Outcome</span><strong>${e(
                              (function (e) {
                                  const t = qe(Te(e).outcome);
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
                                  i = Pe(t);
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
                            'all' !== $e(e.filter) &&
                                t.push(
                                    'pending' === $e(e.filter)
                                        ? 'Pendientes'
                                        : 'contacted' === $e(e.filter)
                                          ? 'Contactados'
                                          : 'today' === $e(e.filter)
                                            ? 'Hoy'
                                            : 'Urgentes SLA'
                                ),
                            qe(e.search) && t.push(`Busqueda: ${e.search}`),
                            'priority_desc' === _e(e.sort)
                                ? t.push('Orden: Prioridad comercial')
                                : 'waiting_desc' === _e(e.sort)
                                  ? t.push('Orden: Mayor espera (SLA)')
                                  : t.push('Orden: Mas recientes'),
                            t
                        );
                    })(e).join(' | ')
                ));
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement && (n.value = $e(e.filter));
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement && (i.value = _e(e.sort));
            const o = document.getElementById('searchCallbacks');
            (o instanceof HTMLInputElement &&
                o.value !== e.search &&
                (o.value = e.search),
                (function (e) {
                    const t = qe(e);
                    document
                        .querySelectorAll(
                            '.callback-quick-filter-btn[data-filter-value]'
                        )
                        .forEach((e) => {
                            const a = qe(e.dataset.filterValue) === t;
                            e.classList.toggle('is-active', a);
                        });
                })(e.filter),
                Re(e));
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
            (r('#callbacksOpsNext', s ? xe(s) : 'Sin telefono'),
                r(
                    '#callbacksNextSummary',
                    s
                        ? `Prioriza ${xe(s)} antes de seguir con la cola.`
                        : 'La siguiente llamada prioritaria aparecera aqui.'
                ),
                r('#callbacksNextWait', s ? Le(we(s)) : '0 min'),
                r('#callbacksNextPreference', s ? Be(s) : '-'),
                r('#callbacksNextState', s ? Ne(s) : 'Pendiente'),
                r(
                    '#callbacksDeckHint',
                    s ? Ie(s, e.workerMode) : 'Sin bloqueos'
                ));
            const l = document.getElementById('callbacksSelectionChip');
            (l && l.classList.toggle('is-hidden', 0 === n),
                r('#callbacksSelectedCount', n));
        })(u, s.length, a.length, c.size));
}
function Oe(e, { persist: t = !0 } = {}) {
    (b((t) => ({ ...t, callbacks: { ...t.callbacks, ...e } })),
        t && Re(g().callbacks),
        De());
}
function He(e) {
    Oe({ filter: $e(e), selected: [] });
}
function Fe(e) {
    const t = Number(e?.id || 0);
    (b((a) => ({
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
        De());
}
async function Ue(e, t) {
    const a = Number(e || 0);
    if (a <= 0) return null;
    const n = await _('callbacks', { method: 'PATCH', body: { id: a, ...t } });
    return n?.data || null;
}
async function Ke(e, t = '') {
    const a = await Ue(e, {
        status: 'contacted',
        fecha: t,
        leadOps: { outcome: 'contactado' },
    });
    return a
        ? (Fe(a), a)
        : ((function (e) {
              Fe({ id: e, status: 'contacted' });
          })(e),
          null);
}
const Ve = 'admin-availability-selected-date',
    ze = 'admin-availability-month-anchor';
function Qe(e) {
    const t = String(e || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    return t ? `${t[1]}:${t[2]}` : '';
}
function Ge(e) {
    return [...new Set(e.map(Qe).filter(Boolean))].sort();
}
function We(e) {
    const t = String(e || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
    const a = new Date(`${t}T12:00:00`);
    return Number.isNaN(a.getTime()) ? '' : u(a) === t ? t : '';
}
function Je(e) {
    const t = We(e);
    if (!t) return null;
    const a = new Date(`${t}T12:00:00`);
    return Number.isNaN(a.getTime()) ? null : a;
}
function Ye(e, t = '') {
    let a = null;
    if (e instanceof Date && !Number.isNaN(e.getTime())) a = new Date(e);
    else {
        const t = We(e);
        t && (a = new Date(`${t}T12:00:00`));
    }
    if (!a) {
        const e = Je(t);
        a = e ? new Date(e) : new Date();
    }
    return (a.setDate(1), a.setHours(12, 0, 0, 0), a);
}
function Ze(e, t) {
    const a = We(e);
    if (a) return a;
    const n = Object.keys(t || {})[0];
    if (n) {
        const e = We(n);
        if (e) return e;
    }
    return u(new Date());
}
function Xe(e) {
    const t = {};
    return (
        Object.keys(e || {})
            .sort()
            .forEach((a) => {
                const n = We(a);
                if (!n) return;
                const i = Ge(Array.isArray(e[a]) ? e[a] : []);
                i.length && (t[n] = i);
            }),
        t
    );
}
function et(e) {
    return Xe(e || {});
}
function tt(e) {
    return JSON.stringify(Xe(e || {}));
}
function at() {
    const e = g(),
        t = We(e.availability.selectedDate),
        a = Ye(e.availability.monthAnchor, t);
    try {
        (t ? localStorage.setItem(Ve, t) : localStorage.removeItem(Ve),
            localStorage.setItem(ze, u(a)));
    } catch (e) {}
}
function nt(e, t) {
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
function it() {
    const e = g().data.availabilityMeta || {};
    return 'google' === String(e.source || '').toLowerCase();
}
function ot(e) {
    const t = et(g().data.availability || {});
    return tt(e) !== tt(t);
}
function st() {
    return et(g().availability.draft || {});
}
function rt() {
    const e = g(),
        t = We(e.availability.selectedDate);
    if (t) return t;
    const a = et(e.availability.draft || {});
    return Object.keys(a)[0] || u(new Date());
}
function lt(e = 1) {
    const t = st(),
        a = Object.keys(t).filter((e) => t[e]?.length > 0);
    if (!a.length) return '';
    const n = We(g().availability.selectedDate) || u(new Date());
    return (
        (e >= 0 ? a.sort() : a.sort().reverse()).find((t) =>
            e >= 0 ? t >= n : t <= n
        ) || ''
    );
}
function ct() {
    ((function () {
        const e = g(),
            t = Ye(e.availability.monthAnchor, e.availability.selectedDate),
            a = rt(),
            n = t.getMonth(),
            i = et(e.availability.draft),
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
                    const e = g(),
                        t = rt();
                    return {
                        selectedDate: t,
                        slots: Ge(et(e.availability.draft)[t] || []),
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
                          `<p class="empty-message" data-admin-empty-state="availability-slots">${e(nt([], n))}</p>`
                      ));
        })(),
        (function () {
            const e = g(),
                a = rt(),
                n = et(e.availability.draft),
                i = Array.isArray(n[a]) ? Ge(n[a]) : [],
                o = it(),
                {
                    sourceText: s,
                    modeText: l,
                    timezone: c,
                } = (function () {
                    const e = g().data.availabilityMeta || {},
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
                        const t = Je(e);
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
            let d = nt(i, o);
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
        at());
}
function ut(e, { render: t = !1 } = {}) {
    (b((t) => ({ ...t, availability: { ...t.availability, ...e } })),
        t ? ct() : at());
}
function dt(e, t = {}) {
    const a = et(e),
        n = Ze(t.selectedDate || g().availability.selectedDate, a);
    ut(
        {
            draft: a,
            selectedDate: n,
            monthAnchor: Ye(t.monthAnchor || g().availability.monthAnchor, n),
            draftDirty: ot(a),
            ...t,
        },
        { render: !0 }
    );
}
function pt(e) {
    ut({ lastAction: String(e || '') }, { render: !0 });
}
function mt(e, t, a = '') {
    const n = We(e) || rt();
    if (!n) return;
    const i = st(),
        o = Ge(Array.isArray(t) ? t : []);
    (o.length ? (i[n] = o) : delete i[n],
        dt(i, { selectedDate: n, monthAnchor: n, lastAction: a }));
}
function gt(e, t) {
    const a = We(e);
    a &&
        ut(
            { selectedDate: a, monthAnchor: Ye(a, a), lastAction: t || '' },
            { render: !0 }
        );
}
function bt() {
    return We(g().availability.selectedDate) || rt();
}
function ft(e) {
    return Qe(e);
}
function yt(e) {
    if (it()) return;
    const t = g(),
        a = bt();
    if (!a) return;
    const n = Array.isArray(t.availability.draft[a])
            ? t.availability.draft[a]
            : [],
        i = (function (e, t) {
            const a = Je(e);
            return a ? (a.setDate(a.getDate() + Number(t || 0)), u(a)) : '';
        })(a, e);
    i && mt(i, n, `Duplicado ${n.length} slots en ${i}`);
}
function vt() {
    return Boolean(g().availability.draftDirty);
}
function ht() {
    const t = g().queue.activity || [];
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
function kt(e) {
    const t = document.getElementById('queueSensitiveConfirmDialog'),
        a = document.getElementById('queueSensitiveConfirmMessage');
    if (
        (a && (a.textContent = `Confirmar accion sensible: ${e.action}`),
        b((t) => ({ ...t, queue: { ...t.queue, pendingSensitiveAction: e } })),
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
function qt() {
    const e = document.getElementById('queueSensitiveConfirmDialog');
    (e instanceof HTMLDialogElement && e.open && e.close(),
        e instanceof HTMLElement &&
            (e.removeAttribute('open'), (e.hidden = !0)),
        b((e) => ({
            ...e,
            queue: { ...e.queue, pendingSensitiveAction: null },
        })));
}
function $t(e, t) {
    return (
        e.callingNowByConsultorio?.[String(t)] ||
        e.callingNowByConsultorio?.[t] ||
        null
    );
}
function _t(e) {
    return e ? String(e.ticketCode || e.ticket_code || 'A-000') : 'Sin llamado';
}
function Ct(e, t, a, n) {
    const i = document.getElementById(e);
    i instanceof HTMLButtonElement &&
        ((i.hidden = !a),
        (i.textContent = a ? `Liberar C${t} · ${n}` : `Release C${t}`),
        a
            ? i.setAttribute('data-queue-id', String(Number(a.id || 0)))
            : i.removeAttribute('data-queue-id'));
}
function St(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function wt(e) {
    const t = St(e);
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
function Lt(e) {
    const t = St(e);
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
function At(e) {
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
function Et(...e) {
    for (const t of e) {
        const e = String(t ?? '').trim();
        if (e) return e;
    }
    return '';
}
let Bt = '';
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
function It(e, t = 0) {
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
        status: wt(e?.status || 'waiting'),
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
function Pt(e, t = 0, a = {}) {
    const n = e && 'object' == typeof e ? e : {},
        i = It({ ...n, ...a }, t);
    return (
        Et(n.createdAt, n.created_at) || (i.createdAt = ''),
        Et(n.priorityClass, n.priority_class) || (i.priorityClass = ''),
        Et(n.queueType, n.queue_type) || (i.queueType = ''),
        Et(n.patientInitials, n.patient_initials) || (i.patientInitials = ''),
        i
    );
}
function jt(e, t, a) {
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
function xt(e, t, a) {
    return e ? Pt(e, t, { status: 'called', assignedConsultorio: a }) : null;
}
function Rt(e, t = []) {
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
            return At(e.callingNow).concat(At(e.calling_now));
        })(a),
        s = (function (e) {
            const t = At(e).map((e, t) => It(e, t));
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
            return { c1: xt(jt(e, t, 1), 0, 1), c2: xt(jt(e, t, 2), 1, 2) };
        })(i, o),
        c = (function (e) {
            return At(e.nextTickets)
                .concat(At(e.next_tickets))
                .map((e, t) =>
                    Pt(
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
                At(a.activeHelpRequests).filter(
                    (e) => 'pending' === String(e?.status || '').toLowerCase()
                ).length ??
                At(a.active_help_requests).filter(
                    (e) => 'pending' === String(e?.status || '').toLowerCase()
                ).length,
            0
        ),
        activeHelpRequests: At(a.activeHelpRequests).length
            ? At(a.activeHelpRequests)
            : At(a.active_help_requests),
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
function Dt(e, t) {
    return Object.prototype.hasOwnProperty.call(e || {}, t);
}
function Ot(e) {
    return e?.counts && 'object' == typeof e.counts ? e.counts : null;
}
function Ht(e) {
    const t = It(e, 0);
    return t.id > 0 ? `id:${t.id}` : `code:${St(t.ticketCode || '')}`;
}
function Ft(e, t) {
    if (!t) return;
    const a = It(t, e.size);
    (Et(t?.createdAt, t?.created_at) || (a.createdAt = ''),
        Et(t?.priorityClass, t?.priority_class) || (a.priorityClass = ''),
        Et(t?.queueType, t?.queue_type) || (a.queueType = ''),
        e.set(Ht(a), a));
}
function Ut(e) {
    const t = Rt(e),
        a = new Map(),
        n =
            t.callingNowByConsultorio?.[1] ||
            t.callingNowByConsultorio?.[1] ||
            null,
        i =
            t.callingNowByConsultorio?.[2] ||
            t.callingNowByConsultorio?.[2] ||
            null;
    (n && Ft(a, { ...n, status: 'called', assignedConsultorio: 1 }),
        i && Ft(a, { ...i, status: 'called', assignedConsultorio: 2 }));
    for (const e of At(t.nextTickets))
        Ft(a, { ...e, status: 'waiting', assignedConsultorio: null });
    return Array.from(a.values());
}
function Kt() {
    const e = g(),
        t = Array.isArray(e.data.queueTickets)
            ? e.data.queueTickets.map((e, t) => It(e, t))
            : [];
    return {
        queueTickets: t,
        queueMeta:
            e.data.queueMeta && 'object' == typeof e.data.queueMeta
                ? Rt(e.data.queueMeta, t)
                : Nt(t),
    };
}
function Vt() {
    const e = g(),
        { queueTickets: t } = Kt();
    return (function (e, t) {
        const a = St(t);
        return a
            ? e.filter((e) =>
                  [e.ticketCode, e.patientInitials, e.status, e.queueType].some(
                      (e) => St(e).includes(a)
                  )
              )
            : e;
    })(
        (function (e, t) {
            const a = St(t);
            return 'waiting' === a
                ? e.filter((e) => 'waiting' === e.status)
                : 'waiting_unassigned' === a
                  ? e.filter(
                        (e) =>
                            'waiting' === e.status &&
                            !Number(e.assignedConsultorio || 0)
                    )
                  : 'waiting_c1' === a
                    ? e.filter(
                          (e) =>
                              'waiting' === e.status &&
                              1 === Number(e.assignedConsultorio || 0)
                      )
                    : 'waiting_c2' === a
                      ? e.filter(
                            (e) =>
                                'waiting' === e.status &&
                                2 === Number(e.assignedConsultorio || 0)
                        )
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
                                              (Date.now() - Mt(e.createdAt)) /
                                                  6e4
                                          )
                                      ) >= 20 ||
                                          'appt_overdue' ===
                                              St(e.priorityClass))
                              )
                            : e;
        })(t, e.queue.filter),
        e.queue.search
    );
}
function zt(e, t = null) {
    const a = Array.isArray(t) ? t : Kt().queueTickets,
        n = new Set(a.map((e) => Number(e.id || 0)).filter((e) => e > 0));
    return [...new Set(At(e).map((e) => Number(e || 0)))]
        .filter((e) => e > 0 && n.has(e))
        .sort((e, t) => e - t);
}
function Qt() {
    return zt(g().queue.selected || []);
}
function Gt() {
    const e = (function () {
        const e = new Set(Qt());
        return e.size
            ? Kt().queueTickets.filter((t) => e.has(Number(t.id || 0)))
            : [];
    })();
    return e.length ? e : Vt();
}
function Wt(e) {
    const t = Number(e || 0);
    return (
        (t && Kt().queueTickets.find((e) => Number(e.id || 0) === t)) || null
    );
}
function Jt(e) {
    const t = 2 === Number(e || 0) ? 2 : 1;
    return (
        Kt().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
function Yt(e) {
    return (
        Kt().queueTickets.find(
            (t) =>
                'waiting' === t.status &&
                (!t.assignedConsultorio || t.assignedConsultorio === e)
        ) || null
    );
}
function Zt() {
    const e = g(),
        t = Number(e.queue.stationConsultorio || 1);
    return (
        Kt().queueTickets.find(
            (e) =>
                'called' === e.status &&
                Number(e.assignedConsultorio || 0) === t
        ) || null
    );
}
function Xt(t) {
    const a = t.assignedConsultorio ? `C${t.assignedConsultorio}` : '-',
        n = Math.max(0, Math.round((Date.now() - Mt(t.createdAt)) / 6e4)),
        i = Number(t.id || 0),
        o = new Set(Qt()).has(i),
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
            switch (wt(e)) {
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
const ea = Object.freeze({
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
    ta = Object.freeze({
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
    aa = Object.freeze({
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
    na = 'queueInstallPresetV1',
    ia = 'queueOpeningChecklistV1',
    oa = 'queueShiftHandoffV1',
    sa = 'queueOpsLogV1',
    ra = 'queueOpsLogFilterV1',
    la = 'queueOpsAlertsV1',
    ca = 'queueOpsFocusModeV1',
    ua = 'queueOpsPlaybookV1',
    da = 'queueTicketLookupV1',
    pa = Object.freeze([
        'operator_ready',
        'kiosk_ready',
        'sala_ready',
        'smoke_ready',
    ]),
    ma = Object.freeze([
        'queue_clear',
        'operator_handoff',
        'kiosk_handoff',
        'sala_handoff',
    ]);
let ga = null,
    ba = null,
    fa = null,
    ya = null,
    va = null,
    ha = null,
    ka = null,
    qa = null,
    $a = null,
    _a = null,
    Ca = {
        lastAt: 0,
        timerId: 0,
        settleTimerId: 0,
        pendingManifest: null,
        pendingPlatform: '',
    };
function Sa() {
    const e = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    return e.includes('mac') ? 'mac' : e.includes('win') ? 'win' : 'other';
}
function wa(e) {
    return String(e || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 48);
}
function La(e) {
    (Ta(), ($a = wa(e)));
    try {
        $a
            ? window.localStorage.setItem(da, $a)
            : window.localStorage.removeItem(da);
    } catch (e) {}
    return $a;
}
function Aa() {
    if ('string' == typeof $a) return $a;
    const e = wa(g().queue.search);
    return (
        ($a =
            (function () {
                try {
                    return wa(window.localStorage.getItem(da) || '');
                } catch (e) {
                    return '';
                }
            })() || e),
        $a
    );
}
function Ta() {
    return ((_a = null), null);
}
function Ma(e) {
    return e && 'object' == typeof e ? { ...e } : null;
}
function Ea() {
    const e = document.getElementById('queueAppsHub');
    return e instanceof HTMLElement ? e : null;
}
function Ba() {
    const e = Ca.pendingManifest
            ? {
                  state: 'deferred',
                  label: 'Refresh en espera',
                  detail: 'Se mantiene el hub estable hasta que termine la interacción actual.',
              }
            : ja()
              ? {
                    state: 'active',
                    label: 'Protegiendo interacción',
                    detail: 'El hub aplaza repaints breves mientras estás usando sus controles.',
                }
              : {
                    state: 'idle',
                    label: 'Refresh sin bloqueo',
                    detail: 'El hub puede repintarse cuando llegue información nueva.',
                },
        t = Ea(),
        a = (function () {
            const e = document.getElementById('queueAppsRefreshShieldChip');
            return e instanceof HTMLElement ? e : null;
        })();
    (t && (t.dataset.queueInteractionState = e.state),
        a &&
            ((a.dataset.state = e.state),
            (a.textContent = e.label),
            (a.title = e.detail),
            a.setAttribute('aria-label', e.detail)));
}
function Na() {
    Ca.settleTimerId &&
        (window.clearTimeout(Ca.settleTimerId), (Ca.settleTimerId = 0));
}
function Ia() {
    if ((Na(), Ca.pendingManifest)) return void Ba();
    if (!ja()) return void Ba();
    const e = Math.max(80, 900 - Pa());
    Ca.settleTimerId = window.setTimeout(() => {
        ((Ca.settleTimerId = 0),
            Ca.pendingManifest ? Ba() : ja() ? Ia() : Ba());
    }, e);
}
function Pa() {
    return Ca.lastAt
        ? Math.max(0, Date.now() - Ca.lastAt)
        : Number.POSITIVE_INFINITY;
}
function ja() {
    return Pa() < 900;
}
function xa() {
    (Ca.timerId && (window.clearTimeout(Ca.timerId), (Ca.timerId = 0)),
        (Ca.pendingManifest = null),
        (Ca.pendingPlatform = ''),
        Ba(),
        Ia());
}
function Ra(e, t) {
    ((Ca.pendingManifest = e),
        (Ca.pendingPlatform = t),
        Ca.timerId && window.clearTimeout(Ca.timerId),
        Na(),
        Ba());
    const a = Math.max(80, 900 - Pa());
    Ca.timerId = window.setTimeout(() => {
        !(function () {
            const e = Ca.pendingManifest,
                t = Ca.pendingPlatform;
            ((Ca.timerId = 0),
                e
                    ? ja()
                        ? Ra(e, t)
                        : lo({
                              allowDuringInteraction: !0,
                              manifestOverride: e,
                              platformOverride: t,
                          })
                    : xa());
        })();
    }, a);
}
function Da(e) {
    try {
        return new URL(String(e || ''), window.location.origin).toString();
    } catch (t) {
        return String(e || '');
    }
}
function Oa(e) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(Da(e))}`;
}
function Ha(e, t, a) {
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
function Fa(e, t) {
    const a = e && 'object' == typeof e ? e : {},
        n = 'mac' === a.platform || 'mac' === t ? 'mac' : 'win';
    return {
        surface:
            'kiosk' === a.surface || 'sala_tv' === a.surface
                ? a.surface
                : 'operator',
        station: 'c2' === a.station ? 'c2' : 'c1',
        lock: Boolean(a.lock),
        oneTap: Boolean(a.oneTap),
        platform: n,
    };
}
function Ua(e, t) {
    ga = Fa(e, t);
    try {
        window.localStorage.setItem(na, JSON.stringify(ga));
    } catch (e) {}
    return ga;
}
function Ka(e) {
    if (ga) return ga;
    const t = (function (e) {
        try {
            const t = window.localStorage.getItem(na);
            return t ? Fa(JSON.parse(t), e) : null;
        } catch (e) {
            return null;
        }
    })(e);
    return t
        ? ((ga = t), ga)
        : ((ga = (function (e) {
              const t = g(),
                  a = Ln('operator'),
                  n = String(a.details.station || '').toLowerCase(),
                  i = String(a.details.stationMode || '')
                      .trim()
                      .toLowerCase(),
                  o = a.details.oneTap;
              return Fa(
                  {
                      surface: 'operator',
                      station:
                          'c2' === n
                              ? 'c2'
                              : 'c1' === n
                                ? 'c1'
                                : 2 ===
                                    Number(
                                        t.queue && t.queue.stationConsultorio
                                    )
                                  ? 'c2'
                                  : 'c1',
                      lock:
                          'locked' === i ||
                          ('free' !== i &&
                              Boolean(
                                  t.queue && 'locked' === t.queue.stationMode
                              )),
                      oneTap:
                          'boolean' == typeof o
                              ? o
                              : Boolean(t.queue && t.queue.oneTap),
                      platform: 'win' === e || 'mac' === e ? e : 'win',
                  },
                  e
              );
          })(e)),
          ga);
}
function Va(e) {
    const t = Ka(e),
        a = 'c2' === t.station ? 'C2' : 'C1';
    return `Operador ${t.lock ? `${a} fijo` : `${a} libre`}${t.oneTap ? ' · 1 tecla' : ''}`;
}
function za(e) {
    const t = Ka(e);
    return [
        {
            id: 'operator_c1_locked',
            label: 'Operador C1',
            state: 'operator' === t.surface && 'c1' === t.station && t.lock,
            nextPreset: { ...t, surface: 'operator', station: 'c1', lock: !0 },
        },
        {
            id: 'operator_c2_locked',
            label: 'Operador C2',
            state: 'operator' === t.surface && 'c2' === t.station && t.lock,
            nextPreset: { ...t, surface: 'operator', station: 'c2', lock: !0 },
        },
        {
            id: 'operator_free',
            label: 'Operador libre',
            state: 'operator' === t.surface && !t.lock,
            nextPreset: {
                ...t,
                surface: 'operator',
                station: 'c2' === t.station ? 'c2' : 'c1',
                lock: !1,
            },
        },
        {
            id: 'kiosk',
            label: 'Kiosco',
            state: 'kiosk' === t.surface,
            nextPreset: { ...t, surface: 'kiosk' },
        },
        {
            id: 'sala_tv',
            label: 'Sala TV',
            state: 'sala_tv' === t.surface,
            nextPreset: { ...t, surface: 'sala_tv' },
        },
    ];
}
function Qa() {
    const e = new Date();
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
}
function Ga(e = Qa()) {
    return { date: e, steps: pa.reduce((e, t) => ((e[t] = !1), e), {}) };
}
function Wa(e) {
    const t = Qa(),
        a = e && 'object' == typeof e ? e : {};
    return {
        date: (String(a.date || '').trim(), t),
        steps: pa.reduce(
            (e, t) => ((e[t] = Boolean(a.steps && a.steps[t])), e),
            {}
        ),
    };
}
function Ja(e) {
    ba = Wa(e);
    try {
        localStorage.setItem(ia, JSON.stringify(ba));
    } catch (e) {}
    return ba;
}
function Ya() {
    const e = Qa();
    return (
        (ba && ba.date === e) ||
            (ba = (function () {
                const e = Qa();
                try {
                    const t = localStorage.getItem(ia);
                    if (!t) return Ga(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? Ga(e) : Wa(a);
                } catch (t) {
                    return Ga(e);
                }
            })()),
        ba
    );
}
function Za(e) {
    const t = Ya(),
        a = (Array.isArray(e) ? e : []).filter((e) => pa.includes(e));
    if (!a.length) return t;
    const n = { ...t.steps };
    return (
        a.forEach((e) => {
            n[e] = !0;
        }),
        Ja({ ...t, steps: n })
    );
}
function Xa(e = Qa()) {
    return { date: e, steps: ma.reduce((e, t) => ((e[t] = !1), e), {}) };
}
function en(e) {
    const t = Qa(),
        a = e && 'object' == typeof e ? e : {};
    return {
        date: (String(a.date || '').trim(), t),
        steps: ma.reduce(
            (e, t) => ((e[t] = Boolean(a.steps && a.steps[t])), e),
            {}
        ),
    };
}
function tn(e) {
    fa = en(e);
    try {
        localStorage.setItem(oa, JSON.stringify(fa));
    } catch (e) {}
    return fa;
}
function an() {
    const e = Qa();
    return (
        (fa && fa.date === e) ||
            (fa = (function () {
                const e = Qa();
                try {
                    const t = localStorage.getItem(oa);
                    if (!t) return Xa(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? Xa(e) : en(a);
                } catch (t) {
                    return Xa(e);
                }
            })()),
        fa
    );
}
function nn(e) {
    const t = an(),
        a = (Array.isArray(e) ? e : []).filter((e) => ma.includes(e));
    if (!a.length) return t;
    const n = { ...t.steps };
    return (
        a.forEach((e) => {
            n[e] = !0;
        }),
        tn({ ...t, steps: n })
    );
}
function on(e = Qa()) {
    return { date: e, items: [] };
}
function sn(e) {
    const t = e && 'object' == typeof e ? e : {},
        a = String(t.tone || 'info')
            .trim()
            .toLowerCase();
    return {
        id: String(
            t.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
        ),
        createdAt: String(t.createdAt || new Date().toISOString()),
        tone: 'success' === a || 'warning' === a || 'alert' === a ? a : 'info',
        title: String(t.title || 'Evento operativo'),
        summary: String(t.summary || '').trim(),
        source: String(t.source || 'manual').trim() || 'manual',
    };
}
function rn(e) {
    const t = Qa(),
        a = e && 'object' == typeof e ? e : {};
    return {
        date: (String(a.date || '').trim(), t),
        items: Array.isArray(a.items)
            ? a.items.map((e) => sn(e)).slice(0, 24)
            : [],
    };
}
function ln(e) {
    ya = rn(e);
    try {
        localStorage.setItem(sa, JSON.stringify(ya));
    } catch (e) {}
    return ya;
}
function cn() {
    const e = Qa();
    return (
        (ya && ya.date === e) ||
            (ya = (function () {
                const e = Qa();
                try {
                    const t = localStorage.getItem(sa);
                    if (!t) return on(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? on(e) : rn(a);
                } catch (t) {
                    return on(e);
                }
            })()),
        ya
    );
}
function un(e) {
    const t = cn(),
        a = sn({ ...e, createdAt: e?.createdAt || new Date().toISOString() }),
        n = t.items[0];
    if (n && n.title === a.title && n.summary === a.summary) {
        const e = Date.parse(n.createdAt),
            i = Date.parse(a.createdAt);
        if (Number.isFinite(e) && Number.isFinite(i) && Math.abs(i - e) < 3e4)
            return t;
    }
    return ln({ ...t, items: [a, ...t.items].slice(0, 24) });
}
function dn(e) {
    const t = String(e || 'all')
        .trim()
        .toLowerCase();
    return 'incidents' === t || 'changes' === t || 'status' === t ? t : 'all';
}
function pn(e = Qa()) {
    return { date: e, reviewed: {} };
}
function mn(e) {
    const t = Qa(),
        a = e && 'object' == typeof e ? e : {},
        n = a.reviewed && 'object' == typeof a.reviewed ? a.reviewed : {},
        i = Object.entries(n).reduce((e, [t, a]) => {
            if (!t) return e;
            const n = String(a?.reviewedAt || '').trim();
            return (
                (e[String(t)] = { reviewedAt: n || new Date().toISOString() }),
                e
            );
        }, {});
    return { date: (String(a.date || '').trim(), t), reviewed: i };
}
function gn(e) {
    ha = mn(e);
    try {
        localStorage.setItem(la, JSON.stringify(ha));
    } catch (e) {}
    return ha;
}
function bn() {
    const e = Qa();
    return (
        (ha && ha.date === e) ||
            (ha = (function () {
                const e = Qa();
                try {
                    const t = localStorage.getItem(la);
                    if (!t) return pn(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? pn(e) : mn(a);
                } catch (t) {
                    return pn(e);
                }
            })()),
        ha
    );
}
function fn(e) {
    const t = String(e || 'auto')
        .trim()
        .toLowerCase();
    return 'opening' === t ||
        'operations' === t ||
        'incidents' === t ||
        'closing' === t
        ? t
        : 'auto';
}
function yn(e = Qa()) {
    return {
        date: e,
        modes: { opening: {}, operations: {}, incidents: {}, closing: {} },
    };
}
function vn(e) {
    const t = Qa(),
        a = e && 'object' == typeof e ? e : {},
        n = a.modes && 'object' == typeof a.modes ? a.modes : {};
    return {
        date: (String(a.date || '').trim(), t),
        modes: {
            opening:
                n.opening && 'object' == typeof n.opening
                    ? { ...n.opening }
                    : {},
            operations:
                n.operations && 'object' == typeof n.operations
                    ? { ...n.operations }
                    : {},
            incidents:
                n.incidents && 'object' == typeof n.incidents
                    ? { ...n.incidents }
                    : {},
            closing:
                n.closing && 'object' == typeof n.closing
                    ? { ...n.closing }
                    : {},
        },
    };
}
function hn(e) {
    qa = vn(e);
    try {
        localStorage.setItem(ua, JSON.stringify(qa));
    } catch (e) {}
    return qa;
}
function kn() {
    const e = Qa();
    return (
        (qa && qa.date === e) ||
            (qa = (function () {
                const e = Qa();
                try {
                    const t = localStorage.getItem(ua);
                    if (!t) return yn(e);
                    const a = JSON.parse(t);
                    return String(a?.date || '') !== e ? yn(e) : vn(a);
                } catch (t) {
                    return yn(e);
                }
            })()),
        qa
    );
}
function qn(e, t, a) {
    const n = kn(),
        i =
            'opening' === e ||
            'operations' === e ||
            'incidents' === e ||
            'closing' === e
                ? e
                : 'operations';
    return hn({
        ...n,
        modes: { ...n.modes, [i]: { ...(n.modes[i] || {}), [t]: Boolean(a) } },
    });
}
function $n(e, t) {
    return 'mac' === t && e.targets.mac
        ? e.targets.mac
        : 'win' === t && e.targets.win
          ? e.targets.win
          : e.targets.win || e.targets.mac || null;
}
function _n(e, t, a) {
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
function Cn(t, a, n) {
    const o = ta[t],
        s = Ka(n),
        r = $n(a, n),
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
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${e(o.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${e(o.title)}</h5>\n                <p class="queue-app-card__description">${e(o.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${e(a.version || '0.1.0')} · ${e(i(a.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${e(o.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                ${r && r.url ? `<a href="${e(r.url)}" class="queue-app-card__cta-primary" download>Descargar para ${e(l)}</a>` : ''}\n            </div>\n            <div class="queue-app-card__targets">${c}</div>\n            <div class="queue-app-card__links">\n                <a href="${e(a.webFallbackUrl || '/')}">Abrir versión web</a>\n                <a href="${e(Ha(t, s, a))}">Centro de instalación</a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${e(Da((r && r.url) || ''))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${o.notes.map((t) => `<li>${e(t)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function Sn(t) {
    const a = ta.sala_tv,
        n = Ka(Sa()),
        o = t.targets.android_tv || {},
        s = String(o.url || ''),
        r = Oa(s);
    return `\n        <article class="queue-app-card">\n            <div>\n                <p class="queue-app-card__eyebrow">${e(a.eyebrow)}</p>\n                <h5 class="queue-app-card__title">${e(a.title)}</h5>\n                <p class="queue-app-card__description">${e(a.description)}</p>\n            </div>\n            <p class="queue-app-card__meta">\n                v${e(t.version || '0.1.0')} · ${e(i(t.updatedAt || ''))}\n            </p>\n            <span class="queue-app-card__tag">Ideal para ${e(a.recommendedFor)}</span>\n            <div class="queue-app-card__actions">\n                <a\n                    href="${e(r)}"\n                    class="queue-app-card__cta-primary"\n                    target="_blank"\n                    rel="noopener"\n                >\n                    Mostrar QR de instalación\n                </a>\n                <a href="${e(s)}" download>Descargar APK</a>\n            </div>\n            <div class="queue-app-card__links">\n                <a href="${e(t.webFallbackUrl || '/sala-turnos.html')}">\n                    Abrir fallback web\n                </a>\n                <a href="${e(Ha('sala_tv', n, t))}">\n                    Centro de instalación\n                </a>\n                <button\n                    type="button"\n                    data-action="queue-copy-install-link"\n                    data-queue-install-url="${e(Da(s))}"\n                >\n                    Copiar enlace\n                </button>\n            </div>\n            <ul class="queue-app-card__notes">\n                ${a.notes.map((t) => `<li>${e(t)}</li>`).join('')}\n            </ul>\n        </article>\n    `;
}
function wn(e, t) {
    const a = Ka(t),
        n = e.operator || ea.operator,
        i = e.kiosk || ea.kiosk,
        o = e.sala_tv || ea.sala_tv,
        s = _n('operator', n, { ...a }),
        r = _n('kiosk', i, { ...a }),
        l = _n('sala_tv', o, { ...a }),
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
function Ln(e) {
    const t = Dn(e),
        a = t.latest && 'object' == typeof t.latest ? t.latest : null;
    return {
        group: t,
        latest: a,
        details: a?.details && 'object' == typeof a.details ? a.details : {},
    };
}
function An(e) {
    const t = Ka(e),
        a = Ya(),
        n = 'c2' === t.station ? 'c2' : 'c1',
        i = Ln('operator'),
        o = Ln('kiosk'),
        s = Ln('display'),
        r = String(i.details.station || '').toLowerCase(),
        l = String(i.details.connection || 'live').toLowerCase(),
        c = !t.lock || !r || r === n,
        u =
            'ready' === i.group.status &&
            !i.group.stale &&
            Boolean(i.details.numpadSeen) &&
            c &&
            'fallback' !== l,
        d = String(o.details.connection || '').toLowerCase(),
        p =
            'ready' === o.group.status &&
            !o.group.stale &&
            Boolean(o.details.printerPrinted) &&
            'live' === d,
        m = String(s.details.connection || '').toLowerCase(),
        b =
            'ready' === s.group.status &&
            !s.group.stale &&
            Boolean(s.details.bellPrimed) &&
            !s.details.bellMuted &&
            'live' === m,
        f =
            u &&
            b &&
            (function (e = 21600) {
                const t = Kt().queueMeta;
                return (
                    Number(t?.calledCount || 0) > 0 ||
                    !!(
                        Array.isArray(g().data?.queueTickets)
                            ? g().data.queueTickets
                            : []
                    ).some((e) => 'called' === String(e.status || '')) ||
                    (g().queue?.activity || []).some((t) => {
                        const a = String(t?.message || '');
                        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(a))
                            return !1;
                        const n = Date.parse(String(t?.at || ''));
                        return !Number.isFinite(n) || Date.now() - n <= 1e3 * e;
                    })
                );
            })(),
        y = {
            operator_ready: {
                suggested: u,
                reason: u
                    ? `Heartbeat operador listo${t.lock ? ` en ${n.toUpperCase()} fijo` : ''} con numpad detectado.`
                    : 'unknown' === i.group.status
                      ? 'Todavía no hay heartbeat reciente del operador.'
                      : c
                        ? i.details.numpadSeen
                            ? 'Confirma el operador manualmente antes de abrir consulta.'
                            : 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                        : `El operador reporta ${r.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`,
            },
            kiosk_ready: {
                suggested: p,
                reason: p
                    ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                    : 'unknown' === o.group.status
                      ? 'Todavía no hay heartbeat reciente del kiosco.'
                      : o.details.printerPrinted
                        ? 'live' !== d
                            ? 'El kiosco no está reportando cola en vivo todavía.'
                            : 'Confirma el kiosco manualmente antes de abrir autoservicio.'
                        : 'Falta imprimir un ticket real o de prueba para validar la térmica.',
            },
            sala_ready: {
                suggested: b,
                reason: b
                    ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                    : 'unknown' === s.group.status
                      ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                      : s.details.bellMuted
                        ? 'La TV sigue en mute o con campanilla apagada.'
                        : s.details.bellPrimed
                          ? 'live' !== m
                              ? 'La Sala TV no está reportando conexión en vivo todavía.'
                              : 'Confirma la Sala TV manualmente antes del primer llamado.'
                          : 'Falta ejecutar la prueba de campanilla en la TV.',
            },
            smoke_ready: {
                suggested: f,
                reason: f
                    ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                    : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
            },
        },
        v = Object.entries(y)
            .filter(([e, t]) => !a.steps[e] && Boolean(t?.suggested))
            .map(([e]) => e);
    return { suggestedIds: v, suggestions: y, suggestedCount: v.length };
}
function Tn(e) {
    const t = an(),
        { queueMeta: a } = Kt(),
        n = Ln('operator'),
        i = Ln('kiosk'),
        o = Ln('display'),
        s = Number(a?.waitingCount || 0),
        r = Number(a?.calledCount || 0),
        l = s <= 0 && r <= 0,
        c =
            l &&
            'unknown' !== n.group.status &&
            !n.group.stale &&
            Boolean(n.details.numpadSeen),
        u =
            l &&
            Number(i.details.pendingOffline || 0) <= 0 &&
            'fallback' !== String(i.details.connection || 'live').toLowerCase(),
        d =
            l &&
            'unknown' !== o.group.status &&
            !o.group.stale &&
            !o.details.bellMuted,
        p = {
            queue_clear: {
                suggested: l,
                reason: l
                    ? 'La cola ya no reporta tickets en espera ni llamados activos.'
                    : `Quedan ${s} en espera y ${r} llamados activos. Atiende eso antes del cierre.`,
            },
            operator_handoff: {
                suggested: c,
                reason: c
                    ? 'El operador sigue reportando numpad detectado y equipo visible para relevo.'
                    : 'Abre Operador y deja claro el perfil/estación antes de entregar el puesto.',
            },
            kiosk_handoff: {
                suggested: u,
                reason: u
                    ? 'El kiosco no reporta pendientes offline para el siguiente turno.'
                    : `El kiosco todavía muestra ${Number(i.details.pendingOffline || 0)} pendiente(s) offline o conexión degradada.`,
            },
            sala_handoff: {
                suggested: d,
                reason: d
                    ? 'La Sala TV sigue visible y sin mute para la siguiente apertura.'
                    : 'Valida mute/foreground de la Sala TV antes de cerrar el turno.',
            },
        },
        m = Object.entries(p)
            .filter(([e, a]) => !t.steps[e] && Boolean(a?.suggested))
            .map(([e]) => e);
    return { suggestions: p, suggestedIds: m, suggestedCount: m.length };
}
function Mn(e) {
    const t = g(),
        { queueMeta: a } = Kt(),
        n = Ya(),
        o = an(),
        s = pa.filter((e) => n.steps[e]).length,
        r = ma.filter((e) => o.steps[e]).length,
        l = Ln('operator'),
        c = Ln('kiosk'),
        u = Ln('display'),
        d = Un(),
        p = `Cola: espera ${Number(a?.waitingCount || 0)}, llamados ${Number(a?.calledCount || 0)}, sync ${String(t.queue?.syncMode || 'live')}.`,
        m = `Operador: ${String(l.latest?.deviceLabel || 'sin equipo')} · ${String(l.group.summary || 'sin resumen')} `,
        b = `Kiosco: ${String(c.latest?.deviceLabel || 'sin equipo')} · ${String(c.group.summary || 'sin resumen')} `,
        f = `Sala TV: ${String(u.latest?.deviceLabel || 'sin equipo')} · ${String(u.group.summary || 'sin resumen')} `;
    return [
        `Relevo Turnero Sala - ${i(new Date().toISOString())}`,
        p,
        `Sync operativo: ${d.title}.`,
        m.trim(),
        b.trim(),
        f.trim(),
        `Apertura confirmada: ${s}/${pa.length}.`,
        `Cierre confirmado: ${r}/${ma.length}.`,
        `Perfil actual operador: ${'c2' === Ka(e).station ? 'C2' : 'C1'}${Ka(e).lock ? ' fijo' : ' libre'}.`,
    ].join('\n');
}
function En(e, t) {
    const a = Un(),
        n = Hn(e, t),
        i = n.find((e) => 'alert' === e.state),
        o = n.find((e) => 'warning' === e.state || 'unknown' === e.state),
        s = i || o;
    return 'alert' === a.state
        ? {
              tone: 'alert',
              source: 'incident',
              title: `Incidencia: ${a.title}`,
              summary: a.summary,
          }
        : s
          ? {
                tone: 'alert' === s.state ? 'alert' : 'warning',
                source: 'incident',
                title: `Incidencia: ${s.title}`,
                summary: `${s.summary} ${s.ageLabel}.`,
            }
          : {
                tone: 'success',
                source: 'incident',
                title: 'Sin incidencia crítica visible',
                summary:
                    'No hay alertas abiertas en Operador, Kiosco o Sala TV. Se registró estabilidad del sistema para seguimiento.',
            };
}
function Bn(e) {
    return 'incidents' === e
        ? 'Incidencias'
        : 'changes' === e
          ? 'Cambios'
          : 'status' === e
            ? 'Estados'
            : 'Todo';
}
async function Nn(e) {
    try {
        (await navigator.clipboard.writeText(Mn(e)),
            s('Resumen de relevo copiado', 'success'));
    } catch (e) {
        s('No se pudo copiar el resumen de relevo', 'error');
    }
}
function In(e, t) {
    const a = Ya(),
        n = wn(e, t),
        i = An(t),
        o = Un(),
        s = [Dn('operator'), Dn('kiosk'), Dn('display')],
        r = n.filter((e) => a.steps[e.id]).length,
        l = i.suggestedCount,
        c = n
            .filter((e) => !a.steps[e.id])
            .filter((e) => !i.suggestions[e.id]?.suggested),
        u = s.filter((e) => 'ready' === e.status && !e.stale).length,
        d =
            s.filter((e) => 'ready' !== e.status || e.stale).length +
            ('ready' === o.state ? 0 : 1),
        p =
            n.length > 0
                ? Math.max(0, Math.min(100, Math.round((r / n.length) * 100)))
                : 0;
    let m = 'idle',
        g = 'Siguiente paso',
        b = 'Centro de apertura listo',
        f =
            'Sigue la siguiente acción sugerida para terminar la apertura sin revisar cada tarjeta por separado.',
        y = null,
        v = null,
        h = '';
    return (
        'alert' === o.state
            ? ((m = 'alert'),
              (b = 'Resuelve la cola antes de abrir'),
              (f =
                  'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.'),
              (y = {
                  kind: 'button',
                  id: 'queueOpsPilotRefreshBtn',
                  action: 'queue-refresh-state',
                  label: 'Refrescar cola ahora',
              }),
              (v = {
                  kind: 'anchor',
                  href: '/admin.html#queue',
                  label: 'Abrir cola admin',
              }),
              (h =
                  'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.'))
            : l > 0
              ? ((m = 'suggested'),
                (b = `Confirma ${l} paso(s) ya validados`),
                (f =
                    c.length > 0
                        ? `${l} paso(s) ya aparecen listos por heartbeat. Después te quedará ${c[0].title}.`
                        : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.'),
                (y = {
                    kind: 'button',
                    id: 'queueOpsPilotApplyBtn',
                    label: `Confirmar sugeridos (${l})`,
                }),
                (v = c.length
                    ? {
                          kind: 'anchor',
                          href: c[0].href,
                          label: c[0].actionLabel,
                      }
                    : {
                          kind: 'anchor',
                          href: '/admin.html#queue',
                          label: 'Volver a la cola',
                      }),
                (h =
                    'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.'))
              : c.length > 0
                ? ((m = 'warning' === o.state ? 'warning' : 'active'),
                  (b = `Siguiente paso: ${c[0].title}`),
                  (f =
                      c.length > 1
                          ? `Quedan ${c.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                          : 'Solo queda una validación manual para dejar la apertura lista.'),
                  (y = {
                      kind: 'anchor',
                      href: c[0].href,
                      label: c[0].actionLabel,
                  }),
                  (v =
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
                  (h = String(
                      i.suggestions[c[0].id]?.reason || c[0].hint || ''
                  )))
                : ((m = 'ready'),
                  (g = 'Operación lista'),
                  (b = 'Apertura completada'),
                  (f =
                      'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.'),
                  (y = {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  }),
                  (v = {
                      kind: 'anchor',
                      href: _n('operator', e.operator || ea.operator, {
                          ...Ka(t),
                      }),
                      label: 'Abrir operador',
                  }),
                  (h =
                      'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.')),
        {
            tone: m,
            eyebrow: g,
            title: b,
            summary: f,
            supportCopy: h,
            progressPct: p,
            confirmedCount: r,
            suggestedCount: l,
            totalSteps: n.length,
            readyEquipmentCount: u,
            issueCount: d,
            primaryAction: y,
            secondaryAction: v,
        }
    );
}
function Pn(t, a = 'secondary') {
    if (!t) return '';
    const n =
        'primary' === a
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';
    return 'button' === t.kind
        ? `\n            <button\n                ${t.id ? `id="${e(t.id)}"` : ''}\n                type="button"\n                class="${n}"\n                ${t.action ? `data-action="${e(t.action)}"` : ''}\n            >\n                ${e(t.label || 'Continuar')}\n            </button>\n        `
        : `\n        <a\n            ${t.id ? `id="${e(t.id)}"` : ''}\n            href="${e(t.href || '/')}"\n            class="${n}"\n            target="_blank"\n            rel="noopener"\n        >\n            ${e(t.label || 'Continuar')}\n        </a>\n    `;
}
function jn(t, a) {
    if (!(document.getElementById('queueOpsPilot') instanceof HTMLElement))
        return;
    const n = In(t, a);
    l(
        '#queueOpsPilot',
        `\n            <section class="queue-ops-pilot__shell" data-state="${e(n.tone)}">\n                <div class="queue-ops-pilot__layout">\n                    <div class="queue-ops-pilot__copy">\n                        <p class="queue-app-card__eyebrow">${e(n.eyebrow)}</p>\n                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${e(n.summary)}</p>\n                        <p class="queue-ops-pilot__support">${e(n.supportCopy)}</p>\n                        <div class="queue-ops-pilot__actions">\n                            ${Pn(n.primaryAction, 'primary')}\n                            ${Pn(n.secondaryAction, 'secondary')}\n                        </div>\n                    </div>\n                    <div class="queue-ops-pilot__status">\n                        <div class="queue-ops-pilot__progress">\n                            <div class="queue-ops-pilot__progress-head">\n                                <span>Apertura confirmada</span>\n                                <strong id="queueOpsPilotProgressValue">${e(`${n.confirmedCount}/${n.totalSteps}`)}</strong>\n                            </div>\n                            <div class="queue-ops-pilot__bar" aria-hidden="true">\n                                <span style="width:${e(String(n.progressPct))}%"></span>\n                            </div>\n                        </div>\n                        <div class="queue-ops-pilot__chips">\n                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">\n                                Confirmados ${e(String(n.confirmedCount))}\n                            </span>\n                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">\n                                Sugeridos ${e(String(n.suggestedCount))}\n                            </span>\n                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">\n                                Equipos listos ${e(String(n.readyEquipmentCount))}/3\n                            </span>\n                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">\n                                Incidencias ${e(String(n.issueCount))}\n                            </span>\n                        </div>\n                    </div>\n                </div>\n            </section>\n        `
    );
    const i = document.getElementById('queueOpsPilotApplyBtn');
    i instanceof HTMLButtonElement &&
        (i.onclick = () => {
            const e = An(a);
            e.suggestedIds.length &&
                (Za(e.suggestedIds),
                un({
                    tone: 'success',
                    source: 'opening',
                    title: `Apertura: ${e.suggestedIds.length} sugerido(s) confirmados`,
                    summary: `Se confirmaron pasos de apertura ya validados por telemetría. Perfil activo: ${Va(a)}.`,
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                jn(t, a),
                no(t, a),
                oo(t, a));
        });
}
function xn(e) {
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
function Rn(e, t = 'Sin heartbeat reciente') {
    const a = Number(e?.ageSec);
    return Number.isFinite(a) ? `Heartbeat hace ${xn(a)}` : t;
}
function Dn(e) {
    const t = (function () {
        const e = g().data.queueSurfaceStatus;
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
function On(e, t) {
    if (!t || 'object' != typeof t) return ['Sin señal'];
    const a = t.details && 'object' == typeof t.details ? t.details : {},
        n = [],
        i = String(t.appMode || '').trim();
    if (
        ('desktop' === i
            ? n.push('Desktop')
            : 'android_tv' === i
              ? n.push('Android TV')
              : n.push('Web'),
        'operator' === e)
    ) {
        const e = String(a.station || '').toUpperCase(),
            t = String(a.stationMode || ''),
            i = Boolean(a.oneTap),
            o = Boolean(a.numpadSeen);
        (e && n.push('locked' === t ? `${e} fijo` : `${e} libre`),
            n.push(i ? '1 tecla ON' : '1 tecla OFF'),
            n.push(o ? 'Numpad listo' : 'Numpad pendiente'));
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
function Hn(e, t) {
    const a = Ka(t);
    return [
        {
            key: 'operator',
            appConfig: e.operator || ea.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: e.kiosk || ea.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: e.sala_tv || ea.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ].map((e) => {
        const t = Dn(e.key),
            n = t.latest && 'object' == typeof t.latest ? t.latest : null,
            i = String(t.status || 'unknown'),
            o =
                String(t.summary || '').trim() ||
                aa[e.key]?.emptySummary ||
                'Sin señal todavía.',
            s = _n(e.fallbackSurface, e.appConfig, {
                ...a,
                surface: e.fallbackSurface,
            });
        return {
            key: e.key,
            title: aa[e.key]?.title || e.key,
            state:
                'ready' === i || 'warning' === i || 'alert' === i
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
            deviceLabel: String(n?.deviceLabel || 'Sin equipo reportando'),
            summary: o,
            ageLabel:
                n && void 0 !== n.ageSec && null !== n.ageSec
                    ? `Heartbeat hace ${xn(n.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: On(e.key, n),
            route: s,
            actionLabel: e.actionLabel,
        };
    });
}
function Fn(t, a) {
    if (
        !(
            document.getElementById('queueSurfaceTelemetry') instanceof
            HTMLElement
        )
    )
        return;
    const n = Hn(t, a),
        i = (function () {
            const e = (function () {
                    const e = g().ui?.queueAutoRefresh;
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
                    ? `ultimo ciclo hace ${xn(Math.max(0, Math.round((Date.now() - Number(e.lastSuccessAt || 0)) / 1e3)))}`
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
        `\n            <section class="queue-surface-telemetry__shell">\n                <div class="queue-surface-telemetry__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Equipos en vivo</p>\n                        <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${e(o ? 'Equipos con atención urgente' : s ? 'Equipos con señal parcial' : 'Equipos en vivo')}</h5>\n                        <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${e(r)}</p>\n                        <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">\n                            <span\n                                id="queueSurfaceTelemetryAutoState"\n                                class="queue-surface-telemetry__auto-state"\n                                data-state="${e(i.state)}"\n                            >\n                                ${e(i.label)}\n                            </span>\n                            <span class="queue-surface-telemetry__auto-copy">${e(i.meta)}</span>\n                        </div>\n                    </div>\n                    <span\n                        id="queueSurfaceTelemetryStatus"\n                        class="queue-surface-telemetry__status"\n                        data-state="${e(u)}"\n                    >\n                        ${e(c)}\n                    </span>\n                </div>\n                <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">\n                    ${n.map((t) => `\n                                <article\n                                    class="queue-surface-card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-surface-card__header">\n                                        <div>\n                                            <strong>${e(t.title)}</strong>\n                                            <p class="queue-surface-card__meta">${e(t.deviceLabel)}</p>\n                                        </div>\n                                        <span class="queue-surface-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p class="queue-surface-card__summary">${e(t.summary)}</p>\n                                    <p class="queue-surface-card__age">${e(t.ageLabel)}</p>\n                                    <div class="queue-surface-card__chips">\n                                        ${t.chips.map((t) => `<span class="queue-surface-card__chip">${e(t)}</span>`).join('')}\n                                    </div>\n                                    <div class="queue-surface-card__actions">\n                                        <a\n                                            href="${e(t.route)}"\n                                            target="_blank"\n                                            rel="noopener"\n                                            class="queue-surface-card__action queue-surface-card__action--primary"\n                                        >\n                                            ${e(t.actionLabel)}\n                                        </a>\n                                        <button\n                                            type="button"\n                                            class="queue-surface-card__action"\n                                            data-action="queue-copy-install-link"\n                                            data-queue-install-url="${e(t.route)}"\n                                        >\n                                            Copiar ruta\n                                        </button>\n                                        <button\n                                            type="button"\n                                            class="queue-surface-card__action"\n                                            data-action="refresh-admin-data"\n                                        >\n                                            Actualizar estado\n                                        </button>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    );
}
function Un() {
    const e = g(),
        { queueMeta: t } = Kt(),
        a = String(e.queue?.syncMode || 'live')
            .trim()
            .toLowerCase(),
        n = Boolean(e.queue?.fallbackPartial),
        i = String(t?.updatedAt || '').trim(),
        o = i ? Date.parse(i) : NaN,
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
function Kn() {
    const e = Un();
    if ('ready' === e.state) return null;
    const { queueMeta: t } = Kt(),
        a = Date.parse(String(t?.updatedAt || '')),
        n = Number.isFinite(a)
            ? `Ultima cola actualizada hace ${xn(Math.max(0, Math.round((Date.now() - a) / 1e3)))}`
            : 'Sin marca reciente de cola';
    return {
        id: `queue_sync_${e.state}`,
        scope: 'Cola admin',
        tone: 'alert' === e.state ? 'alert' : 'warning',
        title:
            'alert' === e.state
                ? 'Realtime degradado o en fallback'
                : 'Realtime lento o en reconexión',
        summary: e.summary,
        meta: n,
        href: '/admin.html#queue',
        actionLabel: 'Abrir cola admin',
    };
}
function Vn(e, t) {
    const a = Ka(t),
        n = 'c2' === a.station ? 'c2' : 'c1',
        i = _n('operator', e.operator || ea.operator, { ...a }),
        { group: o, latest: s, details: r } = Ln('operator'),
        l = String(r.station || '')
            .trim()
            .toLowerCase(),
        c = String(r.connection || 'live')
            .trim()
            .toLowerCase(),
        u = Rn(s);
    return !s || o.stale || 'unknown' === String(o.status || '')
        ? {
              id: 'operator_signal',
              scope: 'Operador',
              tone: 'alert' === String(o.status || '') ? 'alert' : 'warning',
              title: 'Operador sin señal reciente',
              summary:
                  String(o.summary || '').trim() ||
                  'Todavía no hay heartbeat suficiente del equipo operador para confiar en el llamado diario.',
              meta: u,
              href: i,
              actionLabel: 'Abrir operador',
          }
        : a.lock && l && l !== n
          ? {
                id: 'operator_station_mismatch',
                scope: 'Operador',
                tone: 'alert',
                title: `Operador en ${l.toUpperCase()} y perfil activo en ${n.toUpperCase()}`,
                summary:
                    'La estación reportada no coincide con el preset bloqueado. Corrige el perfil o reabre el operador antes del siguiente llamado.',
                meta: u,
                href: i,
                actionLabel: 'Corregir operador',
            }
          : r.numpadSeen
            ? 'live' !== c
                ? {
                      id: 'operator_connection',
                      scope: 'Operador',
                      tone: 'warning',
                      title: 'Operador fuera de cola viva',
                      summary:
                          'El operador sigue arriba, pero no está reportando conexión viva con la cola. Mantén el fallback preparado antes de seguir atendiendo.',
                      meta: u,
                      href: i,
                      actionLabel: 'Revisar operador',
                  }
                : null
            : {
                  id: 'operator_numpad_pending',
                  scope: 'Operador',
                  tone: 'warning',
                  title: 'Genius Numpad 1000 sin pulsación reciente',
                  summary:
                      'Falta una tecla real del numpad para cerrar la validación operativa. Si usas 1 tecla, este chequeo conviene resolverlo primero.',
                  meta: u,
                  href: i,
                  actionLabel: 'Validar numpad',
              };
}
function zn(e, t) {
    const a = Ka(t),
        n = _n('kiosk', e.kiosk || ea.kiosk, { ...a }),
        { group: i, latest: o, details: s } = Ln('kiosk'),
        r = String(s.connection || 'live')
            .trim()
            .toLowerCase(),
        l = Math.max(0, Number(s.pendingOffline || 0)),
        c = Rn(o);
    return !o || i.stale || 'unknown' === String(i.status || '')
        ? {
              id: 'kiosk_signal',
              scope: 'Kiosco',
              tone: 'alert' === String(i.status || '') ? 'alert' : 'warning',
              title: 'Kiosco sin señal reciente',
              summary:
                  String(i.summary || '').trim() ||
                  'No hay heartbeat reciente del kiosco. Conviene abrir la superficie antes de dejar autoservicio abierto.',
              meta: c,
              href: n,
              actionLabel: 'Abrir kiosco',
          }
        : s.printerPrinted
          ? l > 0
              ? {
                    id: 'kiosk_offline_pending',
                    scope: 'Kiosco',
                    tone: 'warning',
                    title: 'Kiosco con pendientes offline',
                    summary: `El kiosco mantiene ${l} registro(s) sin sincronizar. Resuélvelo antes de dejar el equipo solo por mucho tiempo.`,
                    meta: c,
                    href: n,
                    actionLabel: 'Revisar kiosco',
                }
              : 'live' !== r
                ? {
                      id: 'kiosk_connection',
                      scope: 'Kiosco',
                      tone: 'warning',
                      title: 'Kiosco sin cola viva',
                      summary:
                          'El kiosco está arriba, pero la cola no figura como viva. Mantén una ruta web preparada antes de seguir recibiendo pacientes.',
                      meta: c,
                      href: n,
                      actionLabel: 'Revisar kiosco',
                  }
                : null
          : {
                id: 'kiosk_printer_pending',
                scope: 'Kiosco',
                tone: 'warning',
                title: 'Térmica pendiente en kiosco',
                summary:
                    'Todavía no hay impresión OK reportada. Genera un ticket real o de prueba antes de depender del kiosco.',
                meta: c,
                href: n,
                actionLabel: 'Probar kiosco',
            };
}
function Qn(e, t) {
    const a = Ka(t),
        n = _n('sala_tv', e.sala_tv || ea.sala_tv, { ...a }),
        { group: i, latest: o, details: s } = Ln('display'),
        r = String(s.connection || 'live')
            .trim()
            .toLowerCase(),
        l = Rn(o);
    return !o || i.stale || 'unknown' === String(i.status || '')
        ? {
              id: 'display_signal',
              scope: 'Sala TV',
              tone: 'alert' === String(i.status || '') ? 'alert' : 'warning',
              title: 'Sala TV sin señal reciente',
              summary:
                  String(i.summary || '').trim() ||
                  'La TV no está enviando heartbeat reciente. Conviene abrir la app o el fallback antes del siguiente llamado.',
              meta: l,
              href: n,
              actionLabel: 'Abrir sala TV',
          }
        : s.bellMuted
          ? {
                id: 'display_bell_muted',
                scope: 'Sala TV',
                tone: 'alert',
                title: 'Campanilla o volumen apagados en Sala TV',
                summary:
                    'La TV reporta mute o campanilla desactivada. El llamado visual puede salir, pero perderás confirmación sonora para pacientes.',
                meta: l,
                href: n,
                actionLabel: 'Corregir audio',
            }
          : s.bellPrimed
            ? 'live' !== r
                ? {
                      id: 'display_connection',
                      scope: 'Sala TV',
                      tone: 'warning',
                      title: 'Sala TV fuera de cola viva',
                      summary:
                          'La pantalla sigue abierta, pero no está marcando conexión viva. Conviene revisar la app o la red antes de depender de la TV.',
                      meta: l,
                      href: n,
                      actionLabel: 'Revisar sala TV',
                  }
                : null
            : {
                  id: 'display_bell_pending',
                  scope: 'Sala TV',
                  tone: 'warning',
                  title: 'Sala TV sin prueba de campanilla',
                  summary:
                      'Falta ejecutar la prueba de audio o campanilla en la TCL C655. Hazlo antes del siguiente llamado real.',
                  meta: l,
                  href: n,
                  actionLabel: 'Probar sala TV',
              };
}
function Gn(t, a) {
    const n = document.getElementById('queueOpsAlerts');
    if (!(n instanceof HTMLElement)) return;
    const o = (function (e, t) {
        const a = bn(),
            n = [Kn(), Vn(e, t), zn(e, t), Qn(e, t)]
                .filter(Boolean)
                .map((e) => {
                    const t = a.reviewed[String(e.id)] || null;
                    return {
                        ...e,
                        reviewed: Boolean(t),
                        reviewedAt: t?.reviewedAt || '',
                    };
                }),
            i = n.filter((e) => 'alert' === e.tone).length,
            o = n.filter((e) => e.reviewed).length,
            s = n.length - o;
        return {
            tone: i > 0 ? 'alert' : n.length > 0 ? 'warning' : 'ready',
            title:
                0 === n.length
                    ? 'Sin alertas activas'
                    : i > 0
                      ? 'Alertas activas del turno'
                      : 'Observaciones activas del turno',
            summary:
                0 === n.length
                    ? 'La cola, Operador, Kiosco y Sala TV no muestran incidencias abiertas ahora mismo.'
                    : i > 0
                      ? `${i} alerta(s) crítica(s) y ${Math.max(0, n.length - i)} observación(es) activas. Marca una alerta como revisada cuando ya alguien la atendió, pero seguirá visible hasta resolverse.`
                      : `${n.length} observación(es) activas. Usa este panel para decidir qué equipo abrir primero sin bajar por toda la pantalla.`,
            alerts: n,
            criticalCount: i,
            reviewedCount: o,
            pendingCount: s,
        };
    })(t, a);
    l(
        '#queueOpsAlerts',
        `\n            <section class="queue-ops-alerts__shell" data-state="${e(o.tone)}">\n                <div class="queue-ops-alerts__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Prioridad viva</p>\n                        <h5 id="queueOpsAlertsTitle" class="queue-app-card__title">${e(o.title)}</h5>\n                        <p id="queueOpsAlertsSummary" class="queue-ops-alerts__summary">${e(o.summary)}</p>\n                    </div>\n                    <div class="queue-ops-alerts__meta">\n                        <span id="queueOpsAlertsChipTotal" class="queue-ops-alerts__chip">\n                            Alertas ${e(String(o.alerts.length))}\n                        </span>\n                        <span id="queueOpsAlertsChipPending" class="queue-ops-alerts__chip">\n                            Pendientes ${e(String(o.pendingCount))}\n                        </span>\n                        <span id="queueOpsAlertsChipReviewed" class="queue-ops-alerts__chip" data-state="${e(o.reviewedCount > 0 ? 'reviewed' : 'idle')}">\n                            Revisadas ${e(String(o.reviewedCount))}\n                        </span>\n                        <button\n                            id="queueOpsAlertsApplyBtn"\n                            type="button"\n                            class="queue-ops-alerts__action queue-ops-alerts__action--primary"\n                            ${o.pendingCount > 0 ? '' : 'disabled'}\n                        >\n                            Marcar visibles revisadas\n                        </button>\n                    </div>\n                </div>\n                <div id="queueOpsAlertsItems" class="queue-ops-alerts__list" role="list" aria-label="Alertas activas por equipo">\n                    ${o.alerts.length > 0 ? o.alerts.map((t) => `\n                                        <article\n                                            id="queueOpsAlert_${e(t.id)}"\n                                            class="queue-ops-alerts__item"\n                                            data-state="${e(t.tone)}"\n                                            data-reviewed="${t.reviewed ? 'true' : 'false'}"\n                                            role="listitem"\n                                        >\n                                            <div class="queue-ops-alerts__item-head">\n                                                <div class="queue-ops-alerts__item-copy">\n                                                    <span class="queue-ops-alerts__scope">${e(t.scope)}</span>\n                                                    <strong>${e(t.title)}</strong>\n                                                </div>\n                                                <div class="queue-ops-alerts__item-meta">\n                                                    <span class="queue-ops-alerts__severity">${e('alert' === t.tone ? 'Critica' : 'Revisar')}</span>\n                                                    ${t.reviewed ? `<span class="queue-ops-alerts__reviewed">Revisada ${e(i(t.reviewedAt))}</span>` : ''}\n                                                </div>\n                                            </div>\n                                            <p class="queue-ops-alerts__item-summary">${e(t.summary)}</p>\n                                            <p class="queue-ops-alerts__item-note">${e(t.meta)}</p>\n                                            <div class="queue-ops-alerts__actions">\n                                                <a\n                                                    href="${e(t.href)}"\n                                                    class="queue-ops-alerts__action queue-ops-alerts__action--primary"\n                                                    target="_blank"\n                                                    rel="noopener"\n                                                >\n                                                    ${e(t.actionLabel)}\n                                                </a>\n                                                <button\n                                                    id="queueOpsAlertReview_${e(t.id)}"\n                                                    type="button"\n                                                    class="queue-ops-alerts__action"\n                                                    data-queue-alert-review="${e(t.id)}"\n                                                    data-review-state="${t.reviewed ? 'clear' : 'review'}"\n                                                >\n                                                    ${e(t.reviewed ? 'Marcar pendiente otra vez' : 'Marcar revisada')}\n                                                </button>\n                                            </div>\n                                        </article>\n                                    `).join('') : '\n                                <article class="queue-ops-alerts__empty" role="listitem">\n                                    <strong>Sin prioridades abiertas</strong>\n                                    <p>La telemetría actual no muestra incidentes ni observaciones activas en cola, operador, kiosco o sala.</p>\n                                </article>\n                            '}\n                </div>\n            </section>\n        `
    );
    const s = document.getElementById('queueOpsAlertsApplyBtn');
    (s instanceof HTMLButtonElement &&
        (s.onclick = () => {
            const e = o.alerts.filter((e) => !e.reviewed).map((e) => e.id);
            e.length &&
                ((function (e) {
                    const t = Array.isArray(e)
                        ? e.map((e) => String(e || '').trim()).filter(Boolean)
                        : [];
                    if (!t.length) return bn();
                    const a = bn(),
                        n = { ...a.reviewed },
                        i = new Date().toISOString();
                    (t.forEach((e) => {
                        n[e] = { reviewedAt: i };
                    }),
                        gn({ ...a, reviewed: n }));
                })(e),
                un({
                    tone: o.criticalCount > 0 ? 'warning' : 'info',
                    source: 'incident',
                    title: `Alertas revisadas: ${e.length}`,
                    summary: `Se marcaron como revisadas las alertas visibles del turno. Perfil activo: ${Va(a)}.`,
                }),
                Gn(t, a),
                oo(t, a));
        }),
        n.querySelectorAll('[data-queue-alert-review]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = String(e.dataset.queueAlertReview || '').trim(),
                        i = o.alerts.find((e) => e.id === n);
                    if (!i) return;
                    const s = 'clear' !== e.dataset.reviewState;
                    (!(function (e, t) {
                        const a = bn(),
                            n = { ...a.reviewed };
                        (t
                            ? (n[String(e)] = {
                                  reviewedAt: new Date().toISOString(),
                              })
                            : delete n[String(e)],
                            gn({ ...a, reviewed: n }));
                    })(n, s),
                        un({
                            tone: s ? 'info' : 'warning',
                            source: 'incident',
                            title: `${s ? 'Alerta revisada' : 'Alerta reabierta'}: ${i.scope}`,
                            summary: s
                                ? `${i.title}. Sigue visible hasta que la condición se resuelva.`
                                : `${i.title}. La alerta vuelve al tablero pendiente del turno.`,
                        }),
                        Gn(t, a),
                        oo(t, a));
                });
        }));
}
function Wn(e, t) {
    const a =
            (ka ||
                (ka = (function () {
                    try {
                        return fn(localStorage.getItem(ca));
                    } catch (e) {
                        return 'auto';
                    }
                })()),
            ka),
        n = Boolean(e && 'object' == typeof e),
        i = Un(),
        o = pa.length - pa.filter((e) => Ya().steps[e]).length,
        s = ma.length - ma.filter((e) => an().steps[e]).length,
        r = Dn('operator'),
        l = Dn('kiosk'),
        c = Dn('display'),
        u =
            'alert' === i.state ||
            [r, l, c].some(
                (e) => 'alert' === String(e.status || '').toLowerCase()
            ),
        d = Boolean(Tn().suggestions.queue_clear?.suggested),
        p = u
            ? 'incidents'
            : o > 0
              ? 'opening'
              : d && s > 0
                ? 'closing'
                : 'operations',
        m = 'auto' === a ? p : a;
    return 'opening' === m
        ? {
              selectedMode: a,
              suggestedMode: p,
              effectiveMode: m,
              title: 'Modo foco: Apertura',
              summary:
                  o > 0
                      ? `Quedan ${o} validaciones de apertura. Mantén visibles Operador, Telemetría y el checklist hasta dejar lista la mañana.`
                      : 'La apertura ya está confirmada, pero puedes revisar el checklist o ajustar la instalación del equipo.',
              primaryHref: '#queueOpeningChecklist',
              primaryLabel: 'Ir a apertura diaria',
          }
        : 'incidents' === m
          ? {
                selectedMode: a,
                suggestedMode: p,
                effectiveMode: m,
                title: 'Modo foco: Incidencias',
                summary:
                    'alert' === i.state
                        ? 'La cola está degradada o en fallback. En este modo se priorizan contingencias, equipos vivos y señales críticas.'
                        : 'Mantén a la vista contingencias y equipos con señal parcial para resolver la incidencia sin distraerte con instalación o cierre.',
                primaryHref: '#queueContingencyDeck',
                primaryLabel: 'Ir a contingencias',
            }
          : 'closing' === m
            ? {
                  selectedMode: a,
                  suggestedMode: p,
                  effectiveMode: m,
                  title: 'Modo foco: Cierre',
                  summary:
                      s > 0
                          ? `La cola ya permite relevo y faltan ${s} paso(s) para cerrar el turno con evidencia clara.`
                          : 'El relevo ya quedó completo; usa este foco si necesitas revisar la salida del día o copiar el resumen final.',
                  primaryHref: '#queueShiftHandoff',
                  primaryLabel: 'Ir a cierre y relevo',
              }
            : {
                  selectedMode: a,
                  suggestedMode: p,
                  effectiveMode: 'operations',
                  title: 'Modo foco: Operación',
                  summary: n
                      ? 'Mantén visibles equipos en vivo, bitácora y contingencias para operar durante el día sin mezclar apertura o cierre.'
                      : 'Mantén visibles equipos y bitácora mientras el hub termina de cargar el catálogo operativo.',
                  primaryHref: '#queueSurfaceTelemetry',
                  primaryLabel: 'Ir a equipos en vivo',
              };
}
function Jn(t, a) {
    const n = document.getElementById('queueFocusMode'),
        i = document.getElementById('queueAppsHub');
    if (!(n instanceof HTMLElement)) return;
    const o = Wn(t);
    (i instanceof HTMLElement &&
        ((i.dataset.queueFocus = o.effectiveMode),
        (i.dataset.queueFocusSource =
            'auto' === o.selectedMode ? 'auto' : 'manual')),
        l(
            '#queueFocusMode',
            `\n            <section class="queue-focus-mode__shell">\n                <div class="queue-focus-mode__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Modo foco</p>\n                        <h5 id="queueFocusModeTitle" class="queue-app-card__title">${e(o.title)}</h5>\n                        <p id="queueFocusModeSummary" class="queue-focus-mode__summary">${e(o.summary)}</p>\n                    </div>\n                    <div class="queue-focus-mode__meta">\n                        <span\n                            id="queueFocusModeChip"\n                            class="queue-focus-mode__chip"\n                            data-state="${e('auto' === o.selectedMode ? 'auto' : 'manual')}"\n                        >\n                            ${e('auto' === o.selectedMode ? `Auto -> ${o.suggestedMode}` : `Manual -> ${o.effectiveMode}`)}\n                        </span>\n                        <a\n                            id="queueFocusModePrimary"\n                            href="${e(o.primaryHref)}"\n                            class="queue-focus-mode__primary"\n                        >\n                            ${e(o.primaryLabel)}\n                        </a>\n                    </div>\n                </div>\n                <div class="queue-focus-mode__choices" role="tablist" aria-label="Cambiar foco del hub operativo">\n                    <button id="queueFocusModeAuto" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="auto" data-state="${'auto' === o.selectedMode ? 'active' : 'idle'}">Auto</button>\n                    <button id="queueFocusModeOpening" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="opening" data-state="${'opening' === o.selectedMode ? 'active' : 'idle'}">Apertura</button>\n                    <button id="queueFocusModeOperations" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="operations" data-state="${'operations' === o.selectedMode ? 'active' : 'idle'}">Operación</button>\n                    <button id="queueFocusModeIncidents" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="incidents" data-state="${'incidents' === o.selectedMode ? 'active' : 'idle'}">Incidencias</button>\n                    <button id="queueFocusModeClosing" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="closing" data-state="${'closing' === o.selectedMode ? 'active' : 'idle'}">Cierre</button>\n                </div>\n            </section>\n        `
        ),
        n.querySelectorAll('[data-queue-focus-mode]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    (!(function (e) {
                        ka = fn(e);
                        try {
                            localStorage.setItem(ca, ka);
                        } catch (e) {}
                    })(e.dataset.queueFocusMode || 'auto'),
                        Jn(t, a),
                        Zi(t, a),
                        to(t, a));
                });
        }));
}
function Yn(e, t) {
    const a = e && 'object' == typeof e ? e : null;
    if (!a) return '';
    const n = String(a.action || '')
            .trim()
            .toLowerCase(),
        i = 2 === Number(a.consultorio || 0) ? 'C2' : 'C1',
        o = Wt(a.ticketId) || t || null,
        s = o?.ticketCode ? String(o.ticketCode) : 'ticket activo';
    return 'completar' === n
        ? `completar ${s} en ${i}`
        : 'no_show' === n
          ? `marcar no show ${s} en ${i}`
          : 'cancelar' === n
            ? `cancelar ${s} en ${i}`
            : 'liberar' === n
              ? `liberar ${s} en ${i}`
              : `${n || 'confirmar acción'} ${s} en ${i}`;
}
function Zn() {
    const e = document.getElementById('queueSensitiveConfirmDialog');
    (e instanceof HTMLDialogElement && e.open && e.close(),
        e instanceof HTMLElement &&
            (e.removeAttribute('open'), (e.hidden = !0)));
}
function Xn(e, t, a) {
    const n = 'C' + (2 === Number(e.queue.stationConsultorio || 1) ? 2 : 1),
        i = Yn(e.queue.pendingSensitiveAction, t);
    return [
        {
            id: 'enter',
            keyLabel: 'Enter',
            detail: i
                ? `Confirma ${i}.`
                : e.queue.oneTap && t && a
                  ? `Completa ${t.ticketCode} y llama ${a.ticketCode} en ${n}.`
                  : e.queue.oneTap && t
                    ? `Completa ${t.ticketCode}; después no queda ticket en espera para ${n}.`
                    : a
                      ? `Llama ${a.ticketCode} en ${n}.`
                      : `Sin ticket en espera para ${n}.`,
            state: i ? 'alert' : a || t ? 'ready' : 'idle',
        },
        {
            id: 'decimal',
            keyLabel: '.',
            detail: t
                ? `Prepara completar ${t.ticketCode}.`
                : `Sin ticket llamado en ${n}.`,
            state: t ? 'ready' : 'idle',
        },
        {
            id: 'subtract',
            keyLabel: '-',
            detail: t
                ? `Prepara no show para ${t.ticketCode}.`
                : `Sin ticket llamado en ${n}.`,
            state: t ? 'ready' : 'idle',
        },
        {
            id: 'add',
            keyLabel: '+',
            detail: t
                ? `Re-llama ${t.ticketCode} sin cambiar estación.`
                : `Sin ticket llamado en ${n}.`,
            state: t ? 'ready' : 'idle',
        },
        {
            id: 'station',
            keyLabel: '1 / 2',
            detail:
                'locked' === e.queue.stationMode
                    ? `Bloqueado en ${n}; 1/2 no cambian estación ahora.`
                    : '1/2 cambian la estación activa antes del siguiente llamado.',
            state: 'locked' === e.queue.stationMode ? 'warning' : 'ready',
        },
    ];
}
function ei(t, a) {
    if (!(document.getElementById('queueNumpadGuide') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = g(),
            n = 2 === Number(a.queue.stationConsultorio || 1) ? 2 : 1,
            i = `C${n}`,
            o = 'locked' === a.queue.stationMode ? 'fijo' : 'libre',
            s = Zt(),
            r = Yt(n),
            l = Yn(a.queue.pendingSensitiveAction, s),
            c = (function (e) {
                if (!e || 'object' != typeof e) return 'Enter integrado';
                const t = String(e.code || e.key || 'tecla externa').trim();
                return t ? `Externa ${t}` : 'Tecla externa';
            })(a.queue.customCallKey),
            u = Ln('operator'),
            d = String(u.details.station || '')
                .trim()
                .toUpperCase(),
            p =
                'locked' ===
                String(u.details.stationMode || '')
                    .trim()
                    .toLowerCase()
                    ? 'fijo'
                    : 'libre',
            m = d ? `${d} ${p}` : 'sin señal',
            b =
                d &&
                (d !== i ||
                    ('locked' ===
                        String(u.details.stationMode || '')
                            .trim()
                            .toLowerCase()) !=
                        ('locked' === a.queue.stationMode)),
            f = Ka(t),
            y = _n('operator', e.operator || ea.operator, {
                ...f,
                station: 2 === n ? 'c2' : 'c1',
                lock: 'locked' === a.queue.stationMode,
                oneTap: Boolean(a.queue.oneTap),
            });
        let v = 'ready',
            h = `Admin en ${i} ${o}.`,
            k =
                'Usa este bloque para saber qué hará el siguiente toque del Genius Numpad 1000 antes de pulsarlo.';
        return (
            a.queue.captureCallKeyMode
                ? ((v = 'warning'),
                  (h =
                      'Calibración activa: la próxima tecla externa quedará ligada al llamado del operador.'),
                  (k =
                      'Pulsa ahora la tecla del Genius Numpad 1000 que quieras mapear y evita tocar Enter hasta cerrar la calibración.'))
                : l
                  ? ((v = 'alert'),
                    (h = `Enter confirmará ${l}.`),
                    (k =
                        'La acción sensible ya quedó preparada. Enter confirma y Escape cancela antes de seguir llamando.'))
                  : b
                    ? ((v = 'warning'),
                      (h = `Admin en ${i} ${o}, pero Operador reporta ${m}.`),
                      (k =
                          'Alinea la estación o el lock antes de llamar desde el numpad para evitar operar sobre el consultorio equivocado.'))
                    : a.queue.oneTap && s && r
                      ? ((v = 'active'),
                        (h = `Enter completará ${s.ticketCode} y llamará ${r.ticketCode} en ${i}.`),
                        (k =
                            'Con 1 tecla activo, una sola pulsación de Enter cierra el ticket actual y avanza la cola del mismo consultorio.'))
                      : a.queue.oneTap && s
                        ? ((v = 'active'),
                          (h = `Enter completará ${s.ticketCode}; después no quedará siguiente ticket en espera.`),
                          (k =
                              '1 tecla sigue activa, pero no hay otro paciente listo para llamar en esta estación.'))
                        : r
                          ? ((v = 'ready'),
                            (h = `Enter llamará ${r.ticketCode} en ${i}.`),
                            (k =
                                'Usa Decimal o Subtract solo si ya hay un ticket activo en la estación y necesitas una acción sensible.'))
                          : ((h = `No hay ticket en espera para ${i}.`),
                            (k =
                                'El numpad sigue listo, pero ahora mismo Enter no avanzará la cola hasta que llegue otro ticket.')),
            {
                tone: v,
                title: 'Numpad en vivo',
                summary: h,
                supportCopy: k,
                chips: [
                    { id: 'station', label: `Admin ${i} ${o}` },
                    { id: 'operator', label: `Operador ${m}` },
                    {
                        id: 'one_tap',
                        label: '1 tecla ' + (a.queue.oneTap ? 'ON' : 'OFF'),
                    },
                    { id: 'binding', label: c },
                ],
                actions: {
                    operatorUrl: y,
                    oneTapLabel: a.queue.oneTap
                        ? 'Desactivar 1 tecla'
                        : 'Activar 1 tecla',
                },
                keyCards: Xn(a, s, r),
            }
        );
    })(t, a);
    l(
        '#queueNumpadGuide',
        `\n            <section class="queue-numpad-guide__shell" data-state="${e(n.tone)}">\n                <div class="queue-numpad-guide__header">\n                    <div class="queue-numpad-guide__copy">\n                        <p class="queue-app-card__eyebrow">Genius Numpad 1000</p>\n                        <h5 id="queueNumpadGuideTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueNumpadGuideSummary" class="queue-numpad-guide__summary">${e(n.summary)}</p>\n                        <p class="queue-numpad-guide__support">${e(n.supportCopy)}</p>\n                    </div>\n                    <div class="queue-numpad-guide__meta">\n                        <span id="queueNumpadGuideChipStation" class="queue-numpad-guide__chip">\n                            ${e(n.chips[0].label)}\n                        </span>\n                        <span id="queueNumpadGuideChipOperator" class="queue-numpad-guide__chip">\n                            ${e(n.chips[1].label)}\n                        </span>\n                        <span id="queueNumpadGuideChipOneTap" class="queue-numpad-guide__chip">\n                            ${e(n.chips[2].label)}\n                        </span>\n                        <span id="queueNumpadGuideChipBinding" class="queue-numpad-guide__chip">\n                            ${e(n.chips[3].label)}\n                        </span>\n                    </div>\n                </div>\n                <div id="queueNumpadGuideActions" class="queue-numpad-guide__actions">\n                    <button\n                        id="queueNumpadGuideToggleOneTap"\n                        type="button"\n                        class="queue-numpad-guide__action queue-numpad-guide__action--primary"\n                    >\n                        ${e(n.actions.oneTapLabel)}\n                    </button>\n                    <button\n                        id="queueNumpadGuideCaptureKey"\n                        type="button"\n                        class="queue-numpad-guide__action"\n                    >\n                        Calibrar tecla externa\n                    </button>\n                    <a\n                        id="queueNumpadGuideOpenOperator"\n                        href="${e(n.actions.operatorUrl)}"\n                        class="queue-numpad-guide__action"\n                        target="_blank"\n                        rel="noopener"\n                    >\n                        Abrir operador\n                    </a>\n                </div>\n                <div id="queueNumpadGuideKeys" class="queue-numpad-guide__keys" role="list" aria-label="Acciones vivas del numpad">\n                    ${n.keyCards.map((t) => `\n                                <article\n                                    id="queueNumpadGuideKey_${e(t.id)}"\n                                    class="queue-numpad-guide__key"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <strong>${e(t.keyLabel)}</strong>\n                                    <p>${e(t.detail)}</p>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    );
    const i = document.getElementById('queueNumpadGuideToggleOneTap');
    i instanceof HTMLButtonElement &&
        (i.onclick = () => {
            const e = document.querySelector(
                '#queueStationControl [data-action="queue-toggle-one-tap"]'
            );
            e instanceof HTMLButtonElement && e.click();
        });
    const o = document.getElementById('queueNumpadGuideCaptureKey');
    o instanceof HTMLButtonElement &&
        (o.onclick = () => {
            const e = document.querySelector(
                '#queueStationControl [data-action="queue-capture-call-key"]'
            );
            e instanceof HTMLButtonElement && e.click();
        });
}
function ti(e, t) {
    const a = ni(e, t);
    if (!Number.isFinite(a))
        return 'called' === t ? 'sin marca de llamado' : 'sin marca de espera';
    const n = Math.max(0, Math.round((Date.now() - a) / 1e3));
    return 'called' === t ? `llamado hace ${xn(n)}` : `espera hace ${xn(n)}`;
}
function ai(e, t = 'waiting') {
    const a = ni(e, t);
    return Number.isFinite(a)
        ? Math.max(0, Math.round((Date.now() - a) / 1e3))
        : null;
}
function ni(e, t = 'waiting') {
    const a = 'called' === t ? e?.calledAt : e?.createdAt;
    return Date.parse(String(a || ''));
}
function ii() {
    return Kt()
        .queueTickets.filter((e) => 'waiting' === e.status)
        .sort((e, t) => {
            const a = ni(e, 'waiting'),
                n = ni(t, 'waiting');
            return Number.isFinite(a) && Number.isFinite(n)
                ? a - n
                : Number.isFinite(a)
                  ? -1
                  : Number.isFinite(n)
                    ? 1
                    : Number(e.id || 0) - Number(t.id || 0);
        });
}
function oi(e) {
    return (Array.isArray(e) ? e : [])
        .filter(
            (e) =>
                'waiting' ===
                String(e?.status || '')
                    .trim()
                    .toLowerCase()
        )
        .sort((e, t) => {
            const a = ni(e, 'waiting'),
                n = ni(t, 'waiting');
            return Number.isFinite(a) && Number.isFinite(n)
                ? a - n
                : Number.isFinite(a)
                  ? -1
                  : Number.isFinite(n)
                    ? 1
                    : Number(e?.id || 0) - Number(t?.id || 0);
        });
}
function si() {
    return ii().filter((e) => !Number(e.assignedConsultorio || 0));
}
function ri(e) {
    const t = 2 === Number(e || 0) ? 2 : 1;
    return ii().filter((e) => Number(e.assignedConsultorio || 0) === t);
}
function li(e, t) {
    const a = 2 === Number(t || 0) ? 2 : 1;
    return oi(e).filter((e) => Number(e.assignedConsultorio || 0) === a);
}
function ci(e, t) {
    const a = 2 === Number(t || 0) ? 2 : 1;
    return (
        (Array.isArray(e) ? e : []).find(
            (e) =>
                'called' ===
                    String(e?.status || '')
                        .trim()
                        .toLowerCase() &&
                Number(e?.assignedConsultorio || 0) === a
        ) || null
    );
}
function ui(e) {
    const t = String(e?.priorityClass || '')
            .trim()
            .toLowerCase(),
        a = String(e?.queueType || '')
            .trim()
            .toLowerCase();
    return 'appt_overdue' === t
        ? 'Cita vencida'
        : 'appointment' === a
          ? 'Cita'
          : 'Walk-in';
}
function di(e) {
    const t = ai(e, 'waiting') || 0,
        a = String(e?.priorityClass || '')
            .trim()
            .toLowerCase(),
        n = String(e?.queueType || '')
            .trim()
            .toLowerCase();
    let i = 0;
    return (
        'appt_overdue' === a ? (i += 240) : 'appointment' === n && (i += 120),
        Number(e?.assignedConsultorio || 0) && (i += 45),
        t + i
    );
}
function pi(e, t, a) {
    const n = 2 === Number(a || 0) ? 2 : 1,
        i = `c${n}`,
        o = Ln('operator'),
        s = String(o.details.station || '')
            .trim()
            .toLowerCase(),
        r =
            'locked' ===
            String(o.details.stationMode || '')
                .trim()
                .toLowerCase(),
        l = s === i,
        c =
            Boolean(o.latest) &&
            !o.group.stale &&
            'unknown' !==
                String(o.group.status || '')
                    .trim()
                    .toLowerCase(),
        u = l
            ? `Operador ${i.toUpperCase()} ${r ? 'fijo' : 'libre'}`
            : c
              ? `Operador activo en ${String(s || 'otra estación').toUpperCase()}`
              : 'Sin operador dedicado';
    return {
        slot: n,
        slotKey: i,
        operator: o,
        operatorStation: s,
        operatorLocked: r,
        operatorAssigned: l,
        operatorLive: c,
        operatorLabel: u,
        operatorUrl: _n('operator', e.operator || ea.operator, {
            ...Ka(t),
            station: i,
            lock: !0,
        }),
        oneTapLabel: l
            ? '1 tecla ' + (o.details.oneTap ? 'ON' : 'OFF')
            : '1 tecla sin validar',
        numpadLabel: l
            ? o.details.numpadSeen
                ? 'Numpad listo'
                : 'Numpad pendiente'
            : 'Numpad sin señal',
        heartbeatLabel: Rn(o.latest, 'Sin heartbeat'),
    };
}
function mi(t, a) {
    if (
        !(
            document.getElementById('queueConsultorioBoard') instanceof
            HTMLElement
        )
    )
        return;
    const n = (function (e, t) {
        const a = [1, 2].map((a) =>
                (function (e, t, a) {
                    const n = pi(e, t, a),
                        {
                            slot: i,
                            slotKey: o,
                            operatorAssigned: s,
                            operatorLive: r,
                            operatorLabel: l,
                            operatorUrl: c,
                            oneTapLabel: u,
                            numpadLabel: d,
                            heartbeatLabel: p,
                        } = n,
                        m = Jt(i),
                        g = Yt(i);
                    let b = 'idle',
                        f = 'Sin cola',
                        y =
                            'No hay ticket activo ni en espera para este consultorio en este momento.',
                        v = 'Sin ticket listo',
                        h = 'none';
                    return (
                        m
                            ? ((b = 'active'),
                              (f = 'Llamado activo'),
                              (y = `${m.ticketCode} sigue en atención. Puedes re-llamar o liberar ${o.toUpperCase()} sin salir del hub.`),
                              (v = `Re-llamar ${m.ticketCode}`),
                              (h = 'recall'))
                            : g && s && r
                              ? ((b = 'ready'),
                                (f = 'Listo para llamar'),
                                (y = `${g.ticketCode} ya puede llamarse desde ${o.toUpperCase()} con el operador correcto arriba y heartbeat vigente.`),
                                (v = `Llamar ${g.ticketCode}`),
                                (h = 'call'))
                              : g
                                ? ((b = 'warning'),
                                  (f = 'Falta operador'),
                                  (y = `${g.ticketCode} está listo, pero ${o.toUpperCase()} todavía no tiene un operador dedicado o señal suficiente para confiar en el llamado rápido.`),
                                  (v = `Abrir Operador ${o.toUpperCase()}`),
                                  (h = 'open'))
                                : s
                                  ? s &&
                                    r &&
                                    ((b = 'ready'),
                                    (f = 'Listo hoy'),
                                    (y = `${o.toUpperCase()} ya tiene operador en vivo y puede recibir el siguiente ticket en cuanto entre a la cola.`),
                                    (v = `Abrir Operador ${o.toUpperCase()}`),
                                    (h = 'open'))
                                  : ((b = r ? 'warning' : 'idle'),
                                    (f = r
                                        ? 'Sin operador dedicado'
                                        : 'Sin señal'),
                                    (y = r
                                        ? `${o.toUpperCase()} no coincide con el operador reportado. Conviene abrir el operador correcto antes del siguiente pico de atención.`
                                        : `Todavía no hay heartbeat del operador preparado para ${o.toUpperCase()}.`),
                                    (v = `Abrir Operador ${o.toUpperCase()}`),
                                    (h = 'open')),
                        {
                            slot: i,
                            slotKey: o,
                            state: b,
                            badge: f,
                            operatorUrl: c,
                            operatorLabel: l,
                            oneTapLabel: u,
                            numpadLabel: d,
                            heartbeatLabel: p,
                            summary: y,
                            currentLabel: m
                                ? `${m.ticketCode} · ${ti(m, 'called')}`
                                : 'Sin llamado',
                            nextLabel: g
                                ? `${g.ticketCode} · ${ti(g, 'waiting')}`
                                : 'Sin ticket en espera',
                            primaryLabel: v,
                            primaryAction: h,
                            canRelease: Boolean(m),
                            currentTicketId: Number(m?.id || 0),
                        }
                    );
                })(e, t, a)
            ),
            n = a.filter((e) => 'active' === e.state).length,
            i = a.filter(
                (e) => 'ready' === e.state || 'active' === e.state
            ).length,
            o = a.filter(
                (e) => 'warning' === e.state || 'alert' === e.state
            ).length;
        return {
            title:
                o > 0
                    ? 'Mesa por consultorio con pendientes'
                    : 'Mesa por consultorio lista',
            summary:
                o > 0
                    ? 'Cada tarjeta resume C1 y C2 con ticket actual, siguiente en cola y el operador esperado para resolver el turno sin navegar por toda la tabla.'
                    : 'C1 y C2 ya muestran su contexto operativo directo: ticket activo, siguiente en cola y acceso inmediato al operador correcto.',
            statusLabel:
                o > 0
                    ? `${o} pendiente(s)`
                    : i > 0
                      ? `${i}/2 listo(s)`
                      : 'Sin cola ahora',
            statusState: o > 0 ? 'warning' : i > 0 ? 'ready' : 'idle',
            chips: [`Activos ${n}`, `Listos ${i}`, `Pendientes ${o}`],
            cards: a,
        };
    })(t, a);
    (l(
        '#queueConsultorioBoard',
        `\n            <section class="queue-consultorio-board__shell" data-state="${e(n.statusState)}">\n                <div class="queue-consultorio-board__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Mesa por consultorio</p>\n                        <h5 id="queueConsultorioBoardTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueConsultorioBoardSummary" class="queue-consultorio-board__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-consultorio-board__meta">\n                        <span\n                            id="queueConsultorioBoardStatus"\n                            class="queue-consultorio-board__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-consultorio-board__chips">\n                            ${n.chips.map((t) => `<span class="queue-consultorio-board__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queueConsultorioBoardCards" class="queue-consultorio-board__grid" role="list" aria-label="Estado vivo por consultorio">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueConsultorioCard_${e(t.slotKey)}"\n                                    class="queue-consultorio-card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-consultorio-card__header">\n                                        <div>\n                                            <strong>${e(t.slotKey.toUpperCase())}</strong>\n                                            <p class="queue-consultorio-card__operator">${e(t.operatorLabel)}</p>\n                                        </div>\n                                        <span class="queue-consultorio-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p class="queue-consultorio-card__summary">${e(t.summary)}</p>\n                                    <div class="queue-consultorio-card__facts">\n                                        <div class="queue-consultorio-card__fact">\n                                            <span>Ahora</span>\n                                            <strong id="queueConsultorioCurrent_${e(t.slotKey)}">${e(t.currentLabel)}</strong>\n                                        </div>\n                                        <div class="queue-consultorio-card__fact">\n                                            <span>Siguiente</span>\n                                            <strong id="queueConsultorioNext_${e(t.slotKey)}">${e(t.nextLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-consultorio-card__chips">\n                                        <span class="queue-consultorio-card__chip">${e(t.oneTapLabel)}</span>\n                                        <span class="queue-consultorio-card__chip">${e(t.numpadLabel)}</span>\n                                        <span class="queue-consultorio-card__chip">${e(t.heartbeatLabel)}</span>\n                                    </div>\n                                    <div class="queue-consultorio-card__actions">\n                                        <button\n                                            id="queueConsultorioPrimary_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-consultorio-card__action queue-consultorio-card__action--primary"\n                                            data-queue-consultorio-action="${e(t.primaryAction)}"\n                                            data-queue-consultorio="${e(String(t.slot))}"\n                                            data-queue-ticket-id="${e(String(t.currentTicketId))}"\n                                            ${'none' === t.primaryAction ? 'disabled' : ''}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                        <button\n                                            id="queueConsultorioRelease_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-consultorio-card__action"\n                                            data-queue-consultorio-release="${e(String(t.slot))}"\n                                            ${t.canRelease ? '' : 'disabled'}\n                                        >\n                                            Liberar ${e(t.slotKey.toUpperCase())}\n                                        </button>\n                                        <a\n                                            id="queueConsultorioOpenOperator_${e(t.slotKey)}"\n                                            href="${e(t.operatorUrl)}"\n                                            class="queue-consultorio-card__action"\n                                            target="_blank"\n                                            rel="noopener"\n                                        >\n                                            Operador ${e(t.slotKey.toUpperCase())}\n                                        </a>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const t = document.getElementById(
                `queueConsultorioPrimary_${e.slotKey}`
            );
            t instanceof HTMLButtonElement &&
                (t.onclick = () => {
                    if ('call' === e.primaryAction) {
                        const t = document.querySelector(
                            `#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${e.slot}"]`
                        );
                        return void (
                            t instanceof HTMLButtonElement && t.click()
                        );
                    }
                    if ('recall' === e.primaryAction && e.currentTicketId > 0) {
                        const t = document.querySelector(
                            `[data-action="queue-ticket-action"][data-queue-id="${e.currentTicketId}"][data-queue-action="re-llamar"]`
                        );
                        if (t instanceof HTMLButtonElement)
                            return void t.click();
                    }
                    'open' === e.primaryAction &&
                        window.open(e.operatorUrl, '_blank', 'noopener');
                });
            const a = document.getElementById(
                `queueConsultorioRelease_${e.slotKey}`
            );
            a instanceof HTMLButtonElement &&
                (a.onclick = () => {
                    const t = document.getElementById(
                        2 === e.slot ? 'queueReleaseC2' : 'queueReleaseC1'
                    );
                    t instanceof HTMLButtonElement && t.click();
                });
        }));
}
function gi(e, t) {
    return 'recall' === t
        ? {
              title: `Seguimiento ${e.slotKey.toUpperCase()}: re-llamado`,
              summary: `${e.currentLabel.split(' · ')[0]} se re-llamó desde seguimiento de atención.`,
          }
        : 'complete' === t
          ? {
                title: `Seguimiento ${e.slotKey.toUpperCase()}: ticket completado`,
                summary: `${e.currentLabel.split(' · ')[0]} se cerró desde seguimiento de atención.`,
            }
          : 'release' === t
            ? {
                  title: `Seguimiento ${e.slotKey.toUpperCase()}: consultorio liberado`,
                  summary: `${e.currentLabel.split(' · ')[0]} se liberó para devolverlo a la cola.`,
              }
            : 'call' === t
              ? {
                    title: `Seguimiento ${e.slotKey.toUpperCase()}: siguiente llamado`,
                    summary: `${e.nextLabel.split(' · ')[0]} se llamó desde seguimiento de atención.`,
                }
              : {
                    title: `Seguimiento ${e.slotKey.toUpperCase()}: operador abierto`,
                    summary: `Se abrió Operador ${e.slotKey.toUpperCase()} desde seguimiento de atención.`,
                };
}
async function bi(e, t, a, n) {
    if (e && t && 'none' !== t)
        try {
            const { callNextForConsultorio: a, runQueueTicketAction: n } =
                await Promise.resolve().then(function () {
                    return Ts;
                });
            if ('recall' === t && e.currentTicketId > 0)
                await n(e.currentTicketId, 're-llamar', e.slot);
            else if ('complete' === t && e.currentTicketId > 0)
                await n(e.currentTicketId, 'completar');
            else if ('release' === t && e.currentTicketId > 0)
                await n(e.currentTicketId, 'liberar');
            else if ('call' === t) await a(e.slot);
            else {
                if ('open' !== t) return;
                window.open(e.operatorUrl, '_blank', 'noopener');
            }
            un({
                source: 'attention_deck',
                tone:
                    'release' === t
                        ? 'warning'
                        : 'complete' === t
                          ? 'success'
                          : 'info',
                ...gi(e, t),
            });
        } catch (e) {
            s('No se pudo ejecutar la acción de seguimiento', 'error');
        } finally {
            so(a, n);
        }
}
function fi(t, a) {
    if (!(document.getElementById('queueAttentionDeck') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = [1, 2].map((a) =>
                (function (e, t, a) {
                    const n = pi(e, t, a),
                        {
                            slot: i,
                            slotKey: o,
                            operatorAssigned: s,
                            operatorLive: r,
                            operatorLabel: l,
                            operatorUrl: c,
                            oneTapLabel: u,
                            numpadLabel: d,
                            heartbeatLabel: p,
                        } = n,
                        m = Jt(i),
                        g = Yt(i),
                        b = ri(i).length,
                        f = si().length,
                        y = (m && ai(m, 'called')) || 0,
                        v = m ? ti(m, 'called') : 'sin llamado activo';
                    let h = 'idle',
                        k = 'Sin atención activa',
                        q = `${o.toUpperCase()} sin llamado activo`,
                        $ =
                            'Este consultorio no tiene un ticket llamado en este momento. Cuando vuelva a haber atención en curso, aquí verás su seguimiento y la presión detrás.',
                        _ = 'Sin seguimiento pendiente',
                        C = 'none',
                        S = 'Sin acción';
                    if (m) {
                        const e = g?.ticketCode || '';
                        y >= 360 && b > 0
                            ? ((h = 'alert'),
                              (k = 'Cola frenada'),
                              (q = `${m.ticketCode} está reteniendo ${o.toUpperCase()}`),
                              ($ = `${m.ticketCode} va ${v} y ${e} ya espera detrás. Re-llama o libera ${o.toUpperCase()} si el paciente no entró para no congelar la cola.`),
                              (_ = `Re-llamar ${m.ticketCode} o liberar ${o.toUpperCase()}`),
                              (C = 'recall'),
                              (S = `Re-llamar ${m.ticketCode}`))
                            : y >= 120
                              ? ((h = 'warning'),
                                (k = 'Revisar llamado'),
                                (q = `${m.ticketCode} pide confirmación`),
                                ($ = g
                                    ? `${m.ticketCode} va ${v} y ${e} ya espera detrás. Conviene re-llamar o cerrar la atención para destrabar el siguiente paso.`
                                    : `${m.ticketCode} va ${v}. Revisa si el paciente ya pasó o vuelve a llamarlo antes de perder contexto.`),
                                (_ = `Re-llamar ${m.ticketCode}`),
                                (C = 'recall'),
                                (S = `Re-llamar ${m.ticketCode}`))
                              : ((h = 'active'),
                                (k = 'En atención'),
                                (q = `${m.ticketCode} sigue en ${o.toUpperCase()}`),
                                ($ = g
                                    ? `${m.ticketCode} va ${v}. ${e} ya está en la cola de ${o.toUpperCase()}, así que conviene mantener este consultorio visible para cerrar y seguir sin pausa.`
                                    : `${m.ticketCode} va ${v}. No hay otro ticket asignado detrás por ahora, pero conviene mantener el operador a la vista.`),
                                (_ = g
                                    ? `Completa ${m.ticketCode} cuando salga para llamar ${e}`
                                    : `Mantén visible ${m.ticketCode} en Operador ${o.toUpperCase()}`),
                                (C = 'open'),
                                (S = `Abrir Operador ${o.toUpperCase()}`));
                    } else
                        g && s && r
                            ? ((h = 'ready'),
                              (k = 'Siguiente listo'),
                              (q = `${g.ticketCode} ya espera en ${o.toUpperCase()}`),
                              ($ = `${g.ticketCode} está alineado al consultorio y el operador reporta señal estable. Puedes llamarlo desde aquí sin volver a la tabla.`),
                              (_ = `Llamar ${g.ticketCode}`),
                              (C = 'call'),
                              (S = `Llamar ${g.ticketCode}`))
                            : g
                              ? ((h = 'warning'),
                                (k = 'Falta operador'),
                                (q = `${g.ticketCode} espera, pero ${o.toUpperCase()} no está listo`),
                                ($ = `${g.ticketCode} ya es el siguiente ticket para ${o.toUpperCase()}, pero todavía falta alinear el operador o recuperar su heartbeat antes del llamado.`),
                                (_ = `Abrir Operador ${o.toUpperCase()}`),
                                (C = 'open'),
                                (S = `Abrir Operador ${o.toUpperCase()}`))
                              : s &&
                                r &&
                                ((h = 'ready'),
                                (k = 'Operador atento'),
                                (q = `${o.toUpperCase()} listo para recibir`),
                                ($ = `${o.toUpperCase()} ya tiene operador en vivo, sin llamado activo y sin cola asignada detrás.`),
                                (_ = `Mantener ${o.toUpperCase()} visible`),
                                (C = 'open'),
                                (S = `Abrir Operador ${o.toUpperCase()}`));
                    return {
                        slot: i,
                        slotKey: o,
                        state: h,
                        badge: k,
                        headline: q,
                        detail: $,
                        recommendationLabel: _,
                        currentLabel: m
                            ? `${m.ticketCode} · ${v}`
                            : 'Sin llamado activo',
                        nextLabel: g
                            ? `${g.ticketCode} · ${ti(g, 'waiting')}`
                            : 'Sin ticket detrás',
                        pressureLabel: `Detrás ${b} · General ${f}`,
                        operatorUrl: c,
                        operatorLabel: l,
                        oneTapLabel: u,
                        numpadLabel: d,
                        heartbeatLabel: p,
                        primaryAction: C,
                        primaryLabel: S,
                        currentTicketId: Number(m?.id || 0),
                        canComplete: Boolean(m),
                        canRelease: Boolean(m),
                        hasActiveTicket: Boolean(m),
                        queueBehindCount: b,
                    };
                })(e, t, a)
            ),
            n = a.filter((e) => e.hasActiveTicket).length,
            i = a.filter((e) => ['warning', 'alert'].includes(e.state)).length,
            o = a.filter((e) => 'alert' === e.state).length;
        return {
            title:
                o > 0
                    ? 'Seguimiento de atención crítico'
                    : i > 0
                      ? 'Seguimiento de atención por revisar'
                      : n > 0
                        ? 'Seguimiento de atención en curso'
                        : 'Seguimiento de atención despejado',
            summary:
                o > 0
                    ? 'Estos llamados ya están frenando el consultorio y conviene intervenir antes de que la cola detrás siga envejeciendo.'
                    : i > 0
                      ? 'Aquí se vigilan llamados activos, edad de atención y la cola que ya quedó detrás para reaccionar sin bajar a la tabla.'
                      : n > 0
                        ? 'Los consultorios tienen llamados activos, pero aún no muestran señales de atasco; el panel sigue dejando a mano las acciones rápidas.'
                        : 'No hay llamados activos ahora mismo. Cuando vuelva a haber atención en curso, aquí verás el tiempo y la acción sugerida.',
            statusLabel:
                o > 0
                    ? `${o} llamado(s) críticos`
                    : i > 0
                      ? `${i} llamado(s) por revisar`
                      : n > 0
                        ? `${n} atención(es) en curso`
                        : 'Sin llamados activos',
            statusState:
                o > 0 ? 'alert' : i > 0 ? 'warning' : n > 0 ? 'ready' : 'idle',
            chips: [
                `Activos ${n}`,
                `Revisar ${i}`,
                `Detrás ${a.reduce((e, t) => e + Number(t.queueBehindCount || 0), 0)}`,
            ],
            cards: a,
        };
    })(t, a);
    (l(
        '#queueAttentionDeck',
        `\n            <section class="queue-attention-deck__shell" data-state="${e(n.statusState)}">\n                <div class="queue-attention-deck__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Seguimiento de atención</p>\n                        <h5 id="queueAttentionDeckTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueAttentionDeckSummary" class="queue-attention-deck__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-attention-deck__meta">\n                        <span\n                            id="queueAttentionDeckStatus"\n                            class="queue-attention-deck__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-attention-deck__chips">\n                            ${n.chips.map((t) => `<span class="queue-attention-deck__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queueAttentionDeckCards" class="queue-attention-deck__grid" role="list" aria-label="Seguimiento de tickets llamados por consultorio">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueAttentionCard_${e(t.slotKey)}"\n                                    class="queue-attention-card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-attention-card__header">\n                                        <div>\n                                            <strong>${e(t.slotKey.toUpperCase())}</strong>\n                                            <p class="queue-attention-card__operator">${e(t.operatorLabel)}</p>\n                                        </div>\n                                        <span class="queue-attention-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p id="queueAttentionHeadline_${e(t.slotKey)}" class="queue-attention-card__headline">${e(t.headline)}</p>\n                                    <p class="queue-attention-card__detail">${e(t.detail)}</p>\n                                    <div class="queue-attention-card__facts">\n                                        <div class="queue-attention-card__fact">\n                                            <span>Ahora</span>\n                                            <strong id="queueAttentionCurrent_${e(t.slotKey)}">${e(t.currentLabel)}</strong>\n                                        </div>\n                                        <div class="queue-attention-card__fact">\n                                            <span>Siguiente</span>\n                                            <strong id="queueAttentionNext_${e(t.slotKey)}">${e(t.nextLabel)}</strong>\n                                        </div>\n                                        <div class="queue-attention-card__fact">\n                                            <span>Presión</span>\n                                            <strong id="queueAttentionPressure_${e(t.slotKey)}">${e(t.pressureLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-attention-card__chips">\n                                        <span class="queue-attention-card__chip">${e(t.oneTapLabel)}</span>\n                                        <span class="queue-attention-card__chip">${e(t.numpadLabel)}</span>\n                                        <span class="queue-attention-card__chip">${e(t.heartbeatLabel)}</span>\n                                    </div>\n                                    <strong id="queueAttentionRecommendation_${e(t.slotKey)}" class="queue-attention-card__recommendation">${e(t.recommendationLabel)}</strong>\n                                    <div class="queue-attention-card__actions">\n                                        <button\n                                            id="queueAttentionPrimary_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-attention-card__action queue-attention-card__action--primary"\n                                            ${'none' === t.primaryAction ? 'disabled' : ''}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                        <button\n                                            id="queueAttentionComplete_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-attention-card__action"\n                                            ${t.canComplete ? '' : 'disabled'}\n                                        >\n                                            Completar\n                                        </button>\n                                        <button\n                                            id="queueAttentionRelease_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-attention-card__action"\n                                            ${t.canRelease ? '' : 'disabled'}\n                                        >\n                                            Liberar\n                                        </button>\n                                        <a\n                                            id="queueAttentionOpenOperator_${e(t.slotKey)}"\n                                            href="${e(t.operatorUrl)}"\n                                            class="queue-attention-card__action"\n                                            target="_blank"\n                                            rel="noopener"\n                                        >\n                                            Operador ${e(t.slotKey.toUpperCase())}\n                                        </a>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const n = document.getElementById(
                `queueAttentionPrimary_${e.slotKey}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0), await bi(e, e.primaryAction, t, a));
                });
            const i = document.getElementById(
                `queueAttentionComplete_${e.slotKey}`
            );
            i instanceof HTMLButtonElement &&
                (i.onclick = async () => {
                    ((i.disabled = !0), await bi(e, 'complete', t, a));
                });
            const o = document.getElementById(
                `queueAttentionRelease_${e.slotKey}`
            );
            o instanceof HTMLButtonElement &&
                (o.onclick = async () => {
                    ((o.disabled = !0), await bi(e, 'release', t, a));
                });
        }));
}
function yi(e, t, a = '') {
    return 'complete' === t
        ? {
              title: `Resolución ${e.slotKey.toUpperCase()}: ticket completado`,
              summary: `${e.currentLabel.split(' · ')[0]} se completó desde resolución rápida.`,
          }
        : 'no_show' === t
          ? {
                title: `Resolución ${e.slotKey.toUpperCase()}: no show pendiente`,
                summary: a
                    ? `Quedó pendiente confirmar ${a}.`
                    : `${e.currentLabel.split(' · ')[0]} se envió a confirmación de no show.`,
            }
          : 'release' === t
            ? {
                  title: `Resolución ${e.slotKey.toUpperCase()}: ticket liberado`,
                  summary: `${e.currentLabel.split(' · ')[0]} se liberó desde resolución rápida.`,
              }
            : 'confirm' === t
              ? {
                    title: `Resolución ${e.slotKey.toUpperCase()}: confirmación aplicada`,
                    summary:
                        a ||
                        'La acción sensible pendiente se confirmó desde el hub.',
                }
              : 'cancel' === t
                ? {
                      title: `Resolución ${e.slotKey.toUpperCase()}: confirmación cancelada`,
                      summary:
                          a ||
                          'La acción sensible pendiente se canceló desde el hub.',
                  }
                : 'call' === t
                  ? {
                        title: `Resolución ${e.slotKey.toUpperCase()}: siguiente llamado`,
                        summary: `${e.primaryLabel.replace('Llamar ', '')} se llamó desde resolución rápida.`,
                    }
                  : {
                        title: `Resolución ${e.slotKey.toUpperCase()}: operador abierto`,
                        summary: `Se abrió Operador ${e.slotKey.toUpperCase()} desde resolución rápida.`,
                    };
}
async function vi(e, t, a, n) {
    if (e && t && 'none' !== t)
        try {
            const {
                callNextForConsultorio: a,
                cancelQueueSensitiveAction: n,
                confirmQueueSensitiveAction: i,
                runQueueTicketAction: o,
            } = await Promise.resolve().then(function () {
                return Ts;
            });
            if ('complete' === t && e.currentTicketId > 0)
                await o(e.currentTicketId, 'completar');
            else if ('no_show' === t && e.currentTicketId > 0)
                (await o(e.currentTicketId, 'no_show', e.slot),
                    g().queue.pendingSensitiveAction && Zn());
            else if ('release' === t && e.currentTicketId > 0)
                await o(e.currentTicketId, 'liberar');
            else if ('confirm' === t) await i();
            else if ('cancel' === t) n();
            else if ('call' === t) await a(e.slot);
            else {
                if ('open' !== t) return;
                window.open(e.operatorUrl, '_blank', 'noopener');
            }
            un({
                source: 'resolution_deck',
                tone:
                    'complete' === t
                        ? 'success'
                        : 'cancel' === t || 'release' === t || 'no_show' === t
                          ? 'warning'
                          : 'info',
                ...yi(
                    e,
                    t,
                    'no_show' === t
                        ? Yn(
                              g().queue.pendingSensitiveAction,
                              Wt(e.currentTicketId)
                          )
                        : Yn(g().queue.pendingSensitiveAction)
                ),
            });
        } catch (e) {
            s('No se pudo ejecutar la resolución rápida', 'error');
        } finally {
            so(a, n);
        }
}
function hi(t, a) {
    if (
        !(document.getElementById('queueResolutionDeck') instanceof HTMLElement)
    )
        return;
    const n = (function (e, t) {
        const a = g(),
            n = [1, 2].map((a) =>
                (function (e, t, a) {
                    const n = g(),
                        i = pi(e, t, a),
                        {
                            slot: o,
                            slotKey: s,
                            operatorLabel: r,
                            operatorUrl: l,
                            heartbeatLabel: c,
                        } = i,
                        u = Jt(o),
                        d = Yt(o),
                        p = ri(o).length,
                        m = n.queue.pendingSensitiveAction,
                        b = u && Number(m?.ticketId || 0) === Number(u.id || 0),
                        f = b ? Yn(m, u) : '',
                        y = u ? ti(u, 'called') : 'sin llamado activo',
                        v = String(u?.ticketCode || ''),
                        h = String(d?.ticketCode || '');
                    let k = 'idle',
                        q = 'Sin cierre pendiente',
                        $ = `${s.toUpperCase()} sin ticket por cerrar`,
                        _ =
                            'No hay un ticket llamado pendiente de resolución en este consultorio.',
                        C = 'Sin ticket activo',
                        S = 'none',
                        w = 'Sin acción';
                    return (
                        b
                            ? ((k = 'alert'),
                              (q = 'Confirmación pendiente'),
                              ($ = `${v} espera decisión final`),
                              (_ = `Quedó pendiente confirmar ${f}. Usa confirmar o cancelar antes de seguir operando este consultorio.`),
                              (C = `Pendiente: ${f}`),
                              (S = 'confirm'),
                              (w = 'Confirmar pendiente'))
                            : u
                              ? ((k = p > 0 ? 'warning' : 'ready'),
                                (q =
                                    p > 0
                                        ? 'Cerrar y seguir'
                                        : 'Cerrar atención'),
                                ($ = `${v} ya puede resolverse`),
                                (_ = d
                                    ? `Si ${v} ya salió, completar deja listo ${h}. Si no apareció, no show requerirá confirmación; si fue un llamado equivocado, liberar lo devuelve a recepción.`
                                    : `Completar cierra ${v}. No show requerirá confirmación y liberar lo devuelve a la cola general.`),
                                (C = `${y} · detrás ${p}`),
                                (S = 'complete'),
                                (w = `Completar ${v}`))
                              : d &&
                                ((k = 'ready'),
                                (q = 'Siguiente listo'),
                                ($ = `${h} espera la siguiente llamada`),
                                (_ = `No hay cierre pendiente en ${s.toUpperCase()}. El próximo movimiento útil aquí es llamar ${h}.`),
                                (C = `Espera ${ti(d, 'waiting')}`),
                                (S = 'call'),
                                (w = `Llamar ${h}`)),
                        {
                            slot: o,
                            slotKey: s,
                            state: k,
                            badge: q,
                            headline: $,
                            summary: _,
                            statusLabel: C,
                            operatorLabel: r,
                            operatorUrl: l,
                            heartbeatLabel: c,
                            currentLabel: u
                                ? `${v} · ${y}`
                                : 'Sin ticket en cierre',
                            completePreview: u
                                ? d
                                    ? `Cierra ${v} y deja listo ${h}`
                                    : `Cierra ${v} y deja ${s.toUpperCase()} libre`
                                : 'Sin ticket activo que cerrar',
                            noShowPreview: u
                                ? d
                                    ? `Marca ausencia y conserva ${h} listo después de confirmar`
                                    : `Marca ausencia y limpia ${s.toUpperCase()} después de confirmar`
                                : 'No show no aplica ahora',
                            releasePreview: u
                                ? `Devuelve ${v} a la cola general para revisarlo en recepción`
                                : 'Liberar no aplica ahora',
                            primaryAction: S,
                            primaryLabel: w,
                            currentTicketId: Number(u?.id || 0),
                            hasCurrentTicket: Boolean(u),
                            hasPendingSensitive: Boolean(b),
                        }
                    );
                })(e, t, a)
            ),
            i = a.queue.pendingSensitiveAction,
            o = Yn(i, null),
            s = Wt(i?.ticketId),
            r = 2 === Number(i?.consultorio || 0) ? 'C2' : 'C1',
            l = n.filter((e) => e.hasCurrentTicket).length,
            c = n.filter((e) => e.hasPendingSensitive).length,
            u = n.filter((e) => 'complete' === e.primaryAction).length;
        return {
            title:
                c > 0
                    ? 'Resolución rápida con confirmación pendiente'
                    : u > 0
                      ? 'Resolución rápida lista'
                      : l > 0
                        ? 'Resolución rápida en seguimiento'
                        : 'Resolución rápida despejada',
            summary:
                c > 0
                    ? 'El hub dejó visible una acción sensible pendiente para que no quede escondida en el diálogo y puedas confirmarla o cancelarla a tiempo.'
                    : u > 0
                      ? 'Este bloque traduce cada ticket llamado a tres salidas claras: completar, no show o liberar, con impacto visible sobre el siguiente turno.'
                      : l > 0
                        ? 'Todavía hay tickets en atención, pero sin una resolución inmediata pendiente.'
                        : 'No hay tickets llamados por resolver en este momento.',
            statusLabel:
                c > 0
                    ? `${c} confirmación(es) pendiente(s)`
                    : u > 0
                      ? `${u} cierre(s) listos`
                      : l > 0
                        ? `${l} atención(es) en curso`
                        : 'Sin resolución pendiente',
            statusState:
                c > 0 ? 'alert' : u > 0 ? 'ready' : l > 0 ? 'warning' : 'idle',
            chips: [`Activos ${l}`, `Listos ${u}`, `Confirmar ${c}`],
            pendingAction:
                i && o
                    ? {
                          copy: o,
                          ticketCode: String(s?.ticketCode || 'ticket'),
                          slotLabel: r,
                      }
                    : null,
            cards: n,
        };
    })(t, a);
    (l(
        '#queueResolutionDeck',
        `\n            <section class="queue-resolution-deck__shell" data-state="${e(n.statusState)}">\n                <div class="queue-resolution-deck__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Resolución rápida</p>\n                        <h5 id="queueResolutionDeckTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueResolutionDeckSummary" class="queue-resolution-deck__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-resolution-deck__meta">\n                        <span\n                            id="queueResolutionDeckStatus"\n                            class="queue-resolution-deck__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-resolution-deck__chips">\n                            ${n.chips.map((t) => `<span class="queue-resolution-deck__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                ${n.pendingAction ? `\n                            <div id="queueResolutionPending" class="queue-resolution-deck__pending">\n                                <div>\n                                    <strong>Confirmación pendiente</strong>\n                                    <p>${e(n.pendingAction.copy)}</p>\n                                </div>\n                                <div class="queue-resolution-deck__pending-actions">\n                                    <button id="queueResolutionPendingConfirm" type="button" class="queue-resolution-deck__action queue-resolution-deck__action--primary">Confirmar</button>\n                                    <button id="queueResolutionPendingCancel" type="button" class="queue-resolution-deck__action">Cancelar</button>\n                                </div>\n                            </div>\n                        ` : ''}\n                <div id="queueResolutionDeckCards" class="queue-resolution-deck__grid" role="list" aria-label="Resolución rápida por consultorio">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueResolutionCard_${e(t.slotKey)}"\n                                    class="queue-resolution-card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-resolution-card__header">\n                                        <div>\n                                            <strong>${e(t.slotKey.toUpperCase())}</strong>\n                                            <p class="queue-resolution-card__operator">${e(t.operatorLabel)}</p>\n                                        </div>\n                                        <span class="queue-resolution-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p id="queueResolutionHeadline_${e(t.slotKey)}" class="queue-resolution-card__headline">${e(t.headline)}</p>\n                                    <p class="queue-resolution-card__summary">${e(t.summary)}</p>\n                                    <div class="queue-resolution-card__facts">\n                                        <div class="queue-resolution-card__fact">\n                                            <span>Actual</span>\n                                            <strong id="queueResolutionCurrent_${e(t.slotKey)}">${e(t.currentLabel)}</strong>\n                                        </div>\n                                        <div class="queue-resolution-card__fact">\n                                            <span>Estado</span>\n                                            <strong id="queueResolutionStatusLine_${e(t.slotKey)}">${e(t.statusLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-resolution-card__previews">\n                                        <div class="queue-resolution-card__preview">\n                                            <span>Completar</span>\n                                            <strong id="queueResolutionCompletePreview_${e(t.slotKey)}">${e(t.completePreview)}</strong>\n                                        </div>\n                                        <div class="queue-resolution-card__preview">\n                                            <span>No show</span>\n                                            <strong id="queueResolutionNoShowPreview_${e(t.slotKey)}">${e(t.noShowPreview)}</strong>\n                                        </div>\n                                        <div class="queue-resolution-card__preview">\n                                            <span>Liberar</span>\n                                            <strong id="queueResolutionReleasePreview_${e(t.slotKey)}">${e(t.releasePreview)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-resolution-card__chips">\n                                        <span class="queue-resolution-card__chip">${e(t.heartbeatLabel)}</span>\n                                    </div>\n                                    <div class="queue-resolution-card__actions">\n                                        <button\n                                            id="queueResolutionPrimary_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-resolution-deck__action queue-resolution-deck__action--primary"\n                                            ${'none' === t.primaryAction ? 'disabled' : ''}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                        <button\n                                            id="queueResolutionNoShow_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-resolution-deck__action"\n                                            ${t.hasCurrentTicket ? '' : 'disabled'}\n                                        >\n                                            No show\n                                        </button>\n                                        <button\n                                            id="queueResolutionRelease_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-resolution-deck__action"\n                                            ${t.hasCurrentTicket ? '' : 'disabled'}\n                                        >\n                                            Liberar\n                                        </button>\n                                        <a\n                                            id="queueResolutionOpenOperator_${e(t.slotKey)}"\n                                            href="${e(t.operatorUrl)}"\n                                            class="queue-resolution-deck__action"\n                                            target="_blank"\n                                            rel="noopener"\n                                        >\n                                            Operador ${e(t.slotKey.toUpperCase())}\n                                        </a>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const n = document.getElementById(
                `queueResolutionPrimary_${e.slotKey}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0), await vi(e, e.primaryAction, t, a));
                });
            const i = document.getElementById(
                `queueResolutionNoShow_${e.slotKey}`
            );
            i instanceof HTMLButtonElement &&
                (i.onclick = async () => {
                    ((i.disabled = !0), await vi(e, 'no_show', t, a));
                });
            const o = document.getElementById(
                `queueResolutionRelease_${e.slotKey}`
            );
            o instanceof HTMLButtonElement &&
                (o.onclick = async () => {
                    ((o.disabled = !0), await vi(e, 'release', t, a));
                });
        }));
    const i = document.getElementById('queueResolutionPendingConfirm');
    i instanceof HTMLButtonElement &&
        (i.onclick = async () => {
            i.disabled = !0;
            const e = g().queue.pendingSensitiveAction,
                o = 2 === Number(e?.consultorio || 0) ? 'c2' : 'c1',
                s = n.cards.find((e) => e.slotKey === o) || n.cards[0];
            await vi(s, 'confirm', t, a);
        });
    const o = document.getElementById('queueResolutionPendingCancel');
    o instanceof HTMLButtonElement &&
        (o.onclick = async () => {
            o.disabled = !0;
            const e = g().queue.pendingSensitiveAction,
                i = 2 === Number(e?.consultorio || 0) ? 'c2' : 'c1',
                s = n.cards.find((e) => e.slotKey === i) || n.cards[0];
            await vi(s, 'cancel', t, a);
        });
}
function ki(e) {
    return String(e || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim();
}
function qi(e) {
    const t = String(e?.status || '')
            .trim()
            .toLowerCase(),
        a = Number(e?.assignedConsultorio || 0);
    return 'called' === t
        ? a > 0
            ? `Llamado C${a}`
            : 'Llamado'
        : 'waiting' === t
          ? a > 0
              ? `En espera C${a}`
              : 'En espera general'
          : 'completed' === t
            ? 'Completado'
            : 'no_show' === t
              ? 'No asistió'
              : 'cancelled' === t
                ? 'Cancelado'
                : String(e?.status || 'Sin estado');
}
function $i(e, t) {
    if (!t) return Number.POSITIVE_INFINITY;
    const a = ki(e?.ticketCode),
        n = ki(e?.patientInitials),
        i = ki(e?.queueType),
        o = ki(e?.status),
        s = String(e?.phoneLast4 || '')
            .replace(/\s+/g, '')
            .trim();
    return a === t
        ? 0
        : a.startsWith(t)
          ? 1
          : a.includes(t)
            ? 2
            : n === t
              ? 3
              : n.includes(t)
                ? 4
                : s && s.includes(t)
                  ? 5
                  : o.includes(t)
                    ? 6
                    : i.includes(t)
                      ? 7
                      : Number.POSITIVE_INFINITY;
}
function _i(e, t) {
    return [1, 2]
        .map((a) => {
            const n = pi(e, t, a);
            return {
                slot: a,
                context: n,
                load: ri(a).length + (Jt(a) ? 1 : 0),
                readinessScore:
                    n.operatorAssigned && n.operatorLive
                        ? 0
                        : n.operatorLive
                          ? 1
                          : 2,
            };
        })
        .sort((e, t) =>
            e.readinessScore !== t.readinessScore
                ? e.readinessScore - t.readinessScore
                : e.load !== t.load
                  ? e.load - t.load
                  : e.slot - t.slot
        )[0];
}
function Ci(e, t) {
    const a = Aa(),
        n = a
            ? (function (e, t = 4) {
                  const a = ki(e);
                  if (!a) return [];
                  const n = {
                      called: 0,
                      waiting: 1,
                      completed: 2,
                      no_show: 3,
                      cancelled: 4,
                  };
                  return [...Kt().queueTickets]
                      .map((e) => ({ ticket: e, score: $i(e, a) }))
                      .filter((e) => Number.isFinite(e.score))
                      .sort((e, t) => {
                          if (e.score !== t.score) return e.score - t.score;
                          const a =
                                  n[
                                      String(
                                          e.ticket?.status || ''
                                      ).toLowerCase()
                                  ] ?? 9,
                              i =
                                  n[
                                      String(
                                          t.ticket?.status || ''
                                      ).toLowerCase()
                                  ] ?? 9;
                          if (a !== i) return a - i;
                          const o =
                                  'called' === e.ticket?.status
                                      ? 'called'
                                      : 'waiting',
                              s =
                                  'called' === t.ticket?.status
                                      ? 'called'
                                      : 'waiting',
                              r = ni(e.ticket, o),
                              l = ni(t.ticket, s);
                          return Number.isFinite(r) && Number.isFinite(l)
                              ? r - l
                              : Number(e.ticket?.id || 0) -
                                    Number(t.ticket?.id || 0);
                      })
                      .slice(0, t)
                      .map((e) => e.ticket);
              })(a, 4)
            : [],
        i = n[0]
            ? (function (e, t, a) {
                  if (!e) return null;
                  const n = Number(e.assignedConsultorio || 0),
                      i = 2 === n ? 2 : 1 === n ? 1 : 0,
                      o = String(e.ticketCode || 'ticket'),
                      s = String(e.status || 'waiting')
                          .trim()
                          .toLowerCase(),
                      r = qi(e),
                      l =
                          'waiting' === s || 'called' === s
                              ? ti(e, 'called' === s ? 'called' : 'waiting')
                              : `Último estado · ${r}`,
                      c = ui(e),
                      u = e.patientInitials
                          ? `Paciente ${String(e.patientInitials).trim()}`
                          : 'Paciente sin iniciales',
                      d = g().queue.pendingSensitiveAction,
                      p =
                          Number(d?.ticketId || 0) === Number(e.id || 0)
                              ? Yn(d, e)
                              : '';
                  let m = `${o} localizado`,
                      b =
                          'El ticket está disponible para seguimiento rápido desde el hub.',
                      f =
                          'Usa el botón principal para ejecutar la siguiente jugada útil sin bajar a la tabla.',
                      y = 'idle',
                      v = r,
                      h = 'table',
                      k = 'Ver en tabla',
                      q = 0;
                  const $ = [],
                      _ = new Set(),
                      C = (e, t, a = {}) => {
                          const n = `${e}:${Number(a.consultorio || 0)}`;
                          _.has(n) ||
                              (_.add(n),
                              $.push({
                                  kind: e,
                                  label: t,
                                  consultorio: Number(a.consultorio || 0),
                              }));
                      },
                      S =
                          i > 0
                              ? _n('operator', t.operator || ea.operator, {
                                    ...Ka(a),
                                    station: 2 === i ? 'c2' : 'c1',
                                    lock: !0,
                                })
                              : '';
                  if (p)
                      ((y = 'alert'),
                          (v = 'Confirmación pendiente'),
                          (m = `${o} espera confirmación sensible`),
                          (b = `La acción ${p} quedó preparada y visible dentro del hub.`),
                          (f =
                              'Confirma o cancela desde aquí antes de seguir llamando para no perder el contexto de este ticket.'),
                          (h = 'confirm'),
                          (k = 'Confirmar pendiente'),
                          C('cancel', 'Cancelar pendiente'));
                  else if ('called' === s)
                      ((y = 'active'),
                          (v = i > 0 ? `En atención C${i}` : 'En atención'),
                          (m =
                              i > 0
                                  ? `${o} está llamado en C${i}`
                                  : `${o} está llamado`),
                          (b =
                              i > 0
                                  ? `${l}. Puedes completar, marcar no show o liberar ${o} desde esta misma tarjeta.`
                                  : `${l}. Este ticket necesita cierre operativo antes de seguir con el resto de la cola.`),
                          (f =
                              'Completa si ya pasó a consulta; usa no show o liberar solo si necesitas destrabar la cola con una acción sensible.'),
                          (h = 'complete'),
                          (k = `Completar ${o}`),
                          (q = i),
                          i > 0 &&
                              (C('recall', 'Re-llamar', { consultorio: i }),
                              C('no_show', 'No show', { consultorio: i })),
                          C('release', 'Liberar', { consultorio: i }));
                  else if ('waiting' === s && 0 === i) {
                      const e = _i(t, a);
                      ((y = 0 === e.readinessScore ? 'ready' : 'warning'),
                          (v =
                              0 === e.readinessScore
                                  ? `Listo para C${e.slot}`
                                  : `Pendiente de C${e.slot}`),
                          (m = `${o} sigue en la cola general`),
                          (b = `${l}. Todavía no tiene consultorio; puedes mandarlo directo a C${e.slot} desde el hub.`),
                          (f =
                              0 === e.readinessScore
                                  ? `El operador de C${e.slot} ya está listo, así que este es el destino más simple para destrabar recepción.`
                                  : `Conviene reasignarlo a C${e.slot}, pero primero valida el operador si quieres llamarlo enseguida.`),
                          (h = 'assign'),
                          (k = `Asignar a C${e.slot}`),
                          (q = e.slot),
                          C('assign', 'Asignar a C' + (2 === e.slot ? 1 : 2), {
                              consultorio: 2 === e.slot ? 1 : 2,
                          }));
                  } else if ('waiting' === s && i > 0) {
                      const t = Jt(i),
                          a = Yt(i),
                          n = Number(a?.id || 0) === Number(e.id || 0);
                      ((y = n && !t ? 'ready' : 'warning'),
                          (v = n ? `Siguiente en C${i}` : `En cola C${i}`),
                          (m = `${o} ya está asignado a C${i}`),
                          n && !t
                              ? ((b = `${l}. Es el siguiente ticket listo para llamarse en C${i}.`),
                                (f =
                                    'Puedes llamar desde aquí si el consultorio está libre; si no, abre Operador para mantener la atención alineada.'),
                                (h = 'call'),
                                (k = `Llamar ${o}`),
                                (q = i))
                              : t
                                ? ((b = `${l}. C${i} todavía atiende ${String(t.ticketCode || 'otro ticket')}, así que conviene abrir el operador o revisar la tabla antes de mover este turno.`),
                                  (f =
                                      'Este ticket ya está encaminado al consultorio; usa Operador si quieres seguir la secuencia del mismo C.'),
                                  (h = 'open'),
                                  (k = `Abrir Operador C${i}`))
                                : ((b = `${l}. Hay otros tickets antes que ${o} en C${i}, así que la tabla sigue siendo la mejor vista para ordenar esta cola.`),
                                  (f =
                                      'Abre la tabla filtrada por este ticket para revisar su posición exacta antes de llamarlo o moverlo.')),
                          C('assign', 'Mover a C' + (2 === i ? 1 : 2), {
                              consultorio: 2 === i ? 1 : 2,
                          }));
                  } else
                      'completed' === s
                          ? ((y = 'ready'),
                            (v = 'Atención cerrada'),
                            (m = `${o} ya se completó`),
                            (b =
                                'El ticket ya cerró su flujo, pero puedes reimprimirlo o abrir la tabla si necesitas verificar el cierre.'),
                            (f =
                                'Usa reimpresión solo si el paciente necesita respaldo físico del turno.'),
                            (h = 'reprint'),
                            (k = `Reimprimir ${o}`))
                          : 'no_show' === s
                            ? ((y = 'warning'),
                              (v = 'No show registrado'),
                              (m = `${o} quedó como no show`),
                              (b =
                                  'La ausencia ya fue registrada. Reimprime o abre la tabla si necesitas revisar el historial inmediato.'),
                              (f =
                                  'Si fue un error operativo, revisa el flujo desde la tabla antes de volver a tocar este ticket.'),
                              (h = 'reprint'),
                              (k = `Reimprimir ${o}`))
                            : 'cancelled' === s &&
                              ((y = 'idle'),
                              (v = 'Cancelado'),
                              (m = `${o} quedó cancelado`),
                              (b =
                                  'Este ticket ya salió de la cola. Usa la tabla si necesitas validar el motivo o seguir con otro turno.'),
                              (f =
                                  'No hay una acción operativa inmediata sobre este ticket desde el hub.'));
                  return (
                      i > 0 &&
                          'open' !== h &&
                          C('open', `Operador C${i}`, { consultorio: i }),
                      C('table', 'Ver en tabla'),
                      {
                          ticketId: Number(e.id || 0),
                          ticketCode: o,
                          panelState: y,
                          badge: v,
                          headline: m,
                          detail: b,
                          recommendation: f,
                          pendingCopy: p,
                          statusCopy: r,
                          ageLabel: l,
                          priorityLabel: c,
                          patientLabel: u,
                          consultorio: i,
                          operatorUrl: S,
                          primaryAction: h,
                          primaryLabel: k,
                          primaryConsultorio: q,
                          secondaryActions: $,
                      }
                  );
              })(n[0], e, t)
            : null,
        o = (
            a
                ? n.slice(1)
                : (function (e = 4) {
                      const t = [Jt(1), Jt(2), si()[0] || null, Yt(1), Yt(2)],
                          a = new Set();
                      return t
                          .filter((e) => {
                              const t = Number(e?.id || 0);
                              return !(!t || a.has(t) || (a.add(t), 0));
                          })
                          .slice(0, e);
                  })(4)
        )
            .map((e) => ({
                id: Number(e?.id || 0),
                ticketCode: String(e?.ticketCode || ''),
                label: qi(e),
            }))
            .filter((e) => e.id > 0 && e.ticketCode);
    return a
        ? i
            ? {
                  title: `${i.ticketCode} localizado`,
                  summary:
                      'alert' === i.panelState
                          ? 'Este ticket ya tiene una acción sensible pendiente y el hub la deja visible para cerrar rápido.'
                          : 'El hub encontró el ticket y te deja su próxima acción útil sin abrir la tabla completa.',
                  statusLabel:
                      n.length > 1
                          ? `${n.length} coincidencias · 1 activa`
                          : 'Coincidencia directa',
                  statusState: i.panelState,
                  term: a,
                  result: i,
                  suggestions: o,
              }
            : {
                  title: 'Atajo por ticket sin coincidencias',
                  summary:
                      'No encontramos ese ticket en la cola actual. Revisa el código o limpia la búsqueda para volver a las sugerencias vivas.',
                  statusLabel: 'Sin coincidencias',
                  statusState: 'warning',
                  term: a,
                  result: null,
                  suggestions: o,
              }
        : {
              title: 'Atajo por ticket listo',
              summary:
                  'Escribe un ticket para encontrarlo aunque no esté en la vista actual y resolverlo desde el hub sin bajar a la tabla.',
              statusLabel: o.length
                  ? `${o.length} ticket(s) sugerido(s)`
                  : 'Sin sugerencias ahora',
              statusState: o.length ? 'ready' : 'idle',
              term: a,
              result: i,
              suggestions: o,
          };
}
function Si(e, t, a = 0) {
    const n = 2 === Number(a || e?.consultorio || 0) ? 'C2' : 'C1',
        i = String(e?.ticketCode || 'ticket');
    return 'assign' === t
        ? {
              title: `Atajo por ticket: reasignado a ${n}`,
              summary: `${i} se reasignó a ${n} desde el hub.`,
          }
        : 'call' === t
          ? {
                title: 'Atajo por ticket: llamado rápido',
                summary: `${i} se llamó desde el atajo del hub.`,
            }
          : 'complete' === t
            ? {
                  title: 'Atajo por ticket: ticket completado',
                  summary: `${i} se completó desde el hub.`,
              }
            : 'recall' === t
              ? {
                    title: 'Atajo por ticket: re-llamado',
                    summary: `${i} se re-llamó en ${n} desde el hub.`,
                }
              : 'no_show' === t
                ? {
                      title: 'Atajo por ticket: no show pendiente',
                      summary: `${i} quedó listo para confirmar no show desde el hub.`,
                  }
                : 'release' === t
                  ? {
                        title: 'Atajo por ticket: ticket liberado',
                        summary: `${i} volvió a la cola general desde el hub.`,
                    }
                  : 'open' === t
                    ? {
                          title: 'Atajo por ticket: operador abierto',
                          summary: `Se abrió Operador ${n} desde el hub.`,
                      }
                    : 'table' === t
                      ? {
                            title: 'Atajo por ticket: tabla filtrada',
                            summary: `La tabla quedó enfocada en ${i}.`,
                        }
                      : 'reprint' === t
                        ? {
                              title: 'Atajo por ticket: reimpresión',
                              summary: `${i} se reimprimió desde el hub.`,
                          }
                        : 'confirm' === t
                          ? {
                                title: 'Atajo por ticket: confirmación aplicada',
                                summary: `${i} confirmó su acción sensible desde el hub.`,
                            }
                          : {
                                title: 'Atajo por ticket: confirmación cancelada',
                                summary: `${i} canceló su acción sensible desde el hub.`,
                            };
}
function wi(t, a) {
    const n = document.getElementById('queueTicketLookup');
    if (!(n instanceof HTMLElement)) return;
    const i = Ci(t, a);
    l(
        '#queueTicketLookup',
        `\n            <section class="queue-ticket-lookup__shell" data-state="${e(i.statusState)}">\n                <div class="queue-ticket-lookup__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Atajo por ticket</p>\n                        <h5 id="queueTicketLookupTitle" class="queue-app-card__title">${e(i.title)}</h5>\n                        <p id="queueTicketLookupSummary" class="queue-ticket-lookup__summary">${e(i.summary)}</p>\n                    </div>\n                    <span\n                        id="queueTicketLookupStatus"\n                        class="queue-ticket-lookup__status"\n                        data-state="${e(i.statusState)}"\n                    >\n                        ${e(i.statusLabel)}\n                    </span>\n                </div>\n                <div class="queue-ticket-lookup__controls">\n                    <label class="queue-ticket-lookup__field" for="queueTicketLookupInput">\n                        <span>Buscar ticket</span>\n                        <input\n                            id="queueTicketLookupInput"\n                            type="search"\n                            value="${e(i.term)}"\n                            placeholder="Ej. A-1520"\n                            autocomplete="off"\n                            spellcheck="false"\n                        />\n                    </label>\n                    <div class="queue-ticket-lookup__control-actions">\n                        <button\n                            id="queueTicketLookupSearchBtn"\n                            type="button"\n                            class="queue-ticket-lookup__action queue-ticket-lookup__action--primary"\n                        >\n                            Buscar\n                        </button>\n                        <button\n                            id="queueTicketLookupClearBtn"\n                            type="button"\n                            class="queue-ticket-lookup__action"\n                            ${i.term ? '' : 'disabled'}\n                        >\n                            Limpiar\n                        </button>\n                    </div>\n                </div>\n                ${i.suggestions.length ? `\n                            <div id="queueTicketLookupSuggestions" class="queue-ticket-lookup__suggestions" role="list" aria-label="Tickets sugeridos">\n                                ${i.suggestions.map((t, a) => `\n                                            <button\n                                                id="queueTicketLookupSuggestion_${e(String(a))}"\n                                                type="button"\n                                                class="queue-ticket-lookup__suggestion"\n                                                data-queue-ticket-lookup-suggestion="${e(t.ticketCode)}"\n                                                role="listitem"\n                                            >\n                                                <strong>${e(t.ticketCode)}</strong>\n                                                <span>${e(t.label)}</span>\n                                            </button>\n                                        `).join('')}\n                            </div>\n                        ` : ''}\n                ${i.result ? `\n                            <article\n                                id="queueTicketLookupResult"\n                                class="queue-ticket-lookup__result"\n                                data-state="${e(i.result.panelState)}"\n                            >\n                                <div class="queue-ticket-lookup__result-header">\n                                    <div>\n                                        <p id="queueTicketLookupMatchCode" class="queue-ticket-lookup__match-code">${e(i.result.ticketCode)}</p>\n                                        <p id="queueTicketLookupHeadline" class="queue-ticket-lookup__headline">${e(i.result.headline)}</p>\n                                    </div>\n                                    <span id="queueTicketLookupBadge" class="queue-ticket-lookup__badge">${e(i.result.badge)}</span>\n                                </div>\n                                ${i.result.pendingCopy ? `\n                                            <div id="queueTicketLookupPending" class="queue-ticket-lookup__pending">\n                                                <strong>Confirmación pendiente</strong>\n                                                <p>${e(i.result.pendingCopy)}</p>\n                                            </div>\n                                        ` : ''}\n                                <p id="queueTicketLookupDetail" class="queue-ticket-lookup__detail">${e(i.result.detail)}</p>\n                                <div class="queue-ticket-lookup__chips">\n                                    <span class="queue-ticket-lookup__chip">${e(i.result.statusCopy)}</span>\n                                    <span class="queue-ticket-lookup__chip">${e(i.result.ageLabel)}</span>\n                                    <span class="queue-ticket-lookup__chip">${e(i.result.priorityLabel)}</span>\n                                    <span class="queue-ticket-lookup__chip">${e(i.result.patientLabel)}</span>\n                                </div>\n                                <p id="queueTicketLookupRecommendation" class="queue-ticket-lookup__recommendation">${e(i.result.recommendation)}</p>\n                                <div class="queue-ticket-lookup__actions">\n                                    <button\n                                        id="queueTicketLookupPrimary"\n                                        type="button"\n                                        class="queue-ticket-lookup__action queue-ticket-lookup__action--primary"\n                                        data-queue-ticket-lookup-action="${e(i.result.primaryAction)}"\n                                        data-queue-ticket-lookup-consultorio="${e(String(i.result.primaryConsultorio || 0))}"\n                                    >\n                                        ${e(i.result.primaryLabel)}\n                                    </button>\n                                    ${i.result.secondaryActions.map((t, a) => `\n                                                <button\n                                                    id="queueTicketLookupSecondary_${e(String(a))}"\n                                                    type="button"\n                                                    class="queue-ticket-lookup__action"\n                                                    data-queue-ticket-lookup-action="${e(t.kind)}"\n                                                    data-queue-ticket-lookup-consultorio="${e(String(t.consultorio || 0))}"\n                                                >\n                                                    ${e(t.label)}\n                                                </button>\n                                            `).join('')}\n                                </div>\n                            </article>\n                        ` : `\n                            <article\n                                id="queueTicketLookupEmpty"\n                                class="queue-ticket-lookup__empty"\n                                data-state="${e(i.statusState)}"\n                            >\n                                <strong>${e(i.title)}</strong>\n                                <p>${e(i.summary)}</p>\n                            </article>\n                        `}\n            </section>\n        `
    );
    const o = document.getElementById('queueTicketLookupInput'),
        r = document.getElementById('queueTicketLookupSearchBtn'),
        c = document.getElementById('queueTicketLookupClearBtn'),
        u = () => {
            (La(o instanceof HTMLInputElement ? o.value : i.term), so(t, a));
        };
    (o instanceof HTMLInputElement &&
        (o.onkeydown = (e) => {
            'Enter' === e.key
                ? (e.preventDefault(), u())
                : 'Escape' === e.key &&
                  o.value &&
                  (e.preventDefault(), (o.value = ''), La(''), so(t, a));
        }),
        r instanceof HTMLButtonElement && (r.onclick = u),
        c instanceof HTMLButtonElement &&
            (c.onclick = () => {
                (La(''), so(t, a));
            }),
        n
            .querySelectorAll('[data-queue-ticket-lookup-suggestion]')
            .forEach((e) => {
                e instanceof HTMLButtonElement &&
                    (e.onclick = () => {
                        (La(e.dataset.queueTicketLookupSuggestion || ''),
                            so(t, a));
                    });
            }),
        n.querySelectorAll('[data-queue-ticket-lookup-action]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                i.result &&
                (e.onclick = async () => {
                    ((e.disabled = !0),
                        await (async function (e, t, a, n, i = {}) {
                            if (!e || !t || 'none' === t) return;
                            const o =
                                Number(
                                    i.consultorio ||
                                        e.primaryConsultorio ||
                                        e.consultorio ||
                                        0
                                ) || 0;
                            try {
                                const {
                                    callNextForConsultorio: a,
                                    cancelQueueSensitiveAction: n,
                                    confirmQueueSensitiveAction: i,
                                    reprintQueueTicket: s,
                                    runQueueTicketAction: r,
                                } = await Promise.resolve().then(function () {
                                    return Ts;
                                });
                                if ('assign' === t && e.ticketId > 0 && o > 0)
                                    await r(e.ticketId, 'reasignar', o);
                                else if ('call' === t && o > 0) await a(o);
                                else if ('complete' === t && e.ticketId > 0)
                                    await r(e.ticketId, 'completar');
                                else if (
                                    'recall' === t &&
                                    e.ticketId > 0 &&
                                    o > 0
                                )
                                    await r(e.ticketId, 're-llamar', o);
                                else if (
                                    'no_show' === t &&
                                    e.ticketId > 0 &&
                                    o > 0
                                )
                                    (await r(e.ticketId, 'no_show', o),
                                        g().queue.pendingSensitiveAction &&
                                            Zn());
                                else if ('release' === t && e.ticketId > 0)
                                    await r(e.ticketId, 'liberar');
                                else if ('open' === t && e.operatorUrl)
                                    window.open(
                                        e.operatorUrl,
                                        '_blank',
                                        'noopener'
                                    );
                                else {
                                    if ('table' === t && e.ticketCode) {
                                        const {
                                            setQueueFilter: a,
                                            setQueueSearch: n,
                                        } = await Promise.resolve().then(
                                            function () {
                                                return jo;
                                            }
                                        );
                                        return (
                                            un({
                                                source: 'ticket_lookup',
                                                tone: 'info',
                                                ...Si(e, t),
                                            }),
                                            a('all'),
                                            n(e.ticketCode),
                                            void requestAnimationFrame(() => {
                                                const e =
                                                    document.getElementById(
                                                        'queueSearchInput'
                                                    );
                                                e instanceof HTMLInputElement &&
                                                    (e.focus(), e.select());
                                            })
                                        );
                                    }
                                    if ('reprint' === t && e.ticketId > 0)
                                        await s(e.ticketId);
                                    else if ('confirm' === t) await i();
                                    else {
                                        if ('cancel' !== t) return;
                                        n();
                                    }
                                }
                                un({
                                    source: 'ticket_lookup',
                                    tone:
                                        'complete' === t
                                            ? 'success'
                                            : 'cancel' === t || 'release' === t
                                              ? 'warning'
                                              : 'info',
                                    ...Si(e, t, o),
                                });
                            } catch (e) {
                                s(
                                    'No se pudo ejecutar el atajo por ticket',
                                    'error'
                                );
                            } finally {
                                so(a, n);
                            }
                        })(
                            i.result,
                            e.dataset.queueTicketLookupAction || '',
                            t,
                            a,
                            {
                                consultorio: Number(
                                    e.dataset.queueTicketLookupConsultorio || 0
                                ),
                            }
                        ));
                });
        }));
}
function Li(e, t, a = '') {
    const n = String(e?.ticketCode || '').trim(),
        i = Number(e?.id || 0);
    return i && n ? { ticketId: i, ticketCode: n, label: t, detail: a } : null;
}
function Ai(t, a) {
    if (!(document.getElementById('queueTicketRoute') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = Ci(e, t),
            n = a.result;
        if (!n)
            return {
                title: 'Ruta del ticket en espera',
                summary:
                    a.term && !a.result
                        ? 'No hay una coincidencia activa para construir una ruta. Ajusta el ticket o limpia la búsqueda.'
                        : 'Busca un ticket para ver su carril real, la presión alrededor y a qué turno conviene saltar después.',
                statusLabel: a.term
                    ? 'Sin ruta disponible'
                    : 'Sin ticket cargado',
                statusState: a.term ? 'warning' : 'idle',
                result: null,
                pivots: [],
                laneLabel: 'Sin ticket seleccionado',
                positionLabel: 'Sin posición visible',
                pressureLabel: 'Sin presión calculada',
                impactLabel:
                    'El panel se activa cuando el lookup encuentra un ticket real en la cola.',
            };
        const i = Wt(n.ticketId);
        if (!i)
            return {
                title: 'Ruta del ticket sin snapshot',
                summary:
                    'El ticket ya no está en el estado local. Refresca la cola o vuelve a buscarlo para reconstruir la ruta.',
                statusLabel: 'Snapshot vencido',
                statusState: 'warning',
                result: null,
                pivots: [],
                laneLabel: 'Sin snapshot',
                positionLabel: 'Desconocida',
                pressureLabel: 'Refresca la cola',
                impactLabel: 'No se pudo reconstruir el contexto del ticket.',
            };
        const o = String(i.status || '')
                .trim()
                .toLowerCase(),
            s = Number(i.assignedConsultorio || 0),
            r = 2 === s ? 2 : 1 === s ? 1 : 0,
            l = String(i.ticketCode || 'ticket'),
            c = si(),
            u = ii(),
            d = r > 0 ? ri(r) : c,
            p = d.findIndex((e) => Number(e.id || 0) === Number(i.id || 0)),
            m = p > 0 ? d[p - 1] : null,
            g = p >= 0 && p < d.length - 1 ? d[p + 1] : null,
            b = r > 0 ? Jt(r) : null,
            f = c[0] || null,
            y = [];
        let v = `Ruta de ${l}`,
            h =
                'Este panel resume el carril real del ticket y los pivotes más útiles alrededor.',
            k = 'Ruta preparada',
            q = n.panelState,
            $ = r > 0 ? `C${r}` : 'Cola general',
            _ = 'Sin posición visible',
            C = `${u.length} ticket(s) esperando`,
            S = 'Sin impacto inmediato calculado.';
        const w = (e) => {
            e && (y.some((t) => t.ticketId === e.ticketId) || y.push(e));
        };
        if ('called' === o && r > 0) {
            const e = d.length;
            (($ = `C${r} · ticket activo`),
                (_ = 'Paciente en atención ahora'),
                (C =
                    e > 0
                        ? `${e} ticket(s) detrás en C${r}`
                        : `Sin espera detrás en C${r}`),
                (S = g
                    ? `Si ${l} cierra ahora, ${g.ticketCode} queda listo para llamado en C${r}.`
                    : `Si ${l} cierra ahora, C${r} queda libre y la presión vuelve a recepción.`),
                (h =
                    e > 0
                        ? `${l} está reteniendo la cola de C${r}; conviene tener a la vista el siguiente turno y el fallback general.`
                        : `${l} es el único ticket activo en C${r} y no tiene cola inmediata detrás.`),
                (k =
                    e > 0
                        ? `${e} ticket(s) esperando detrás`
                        : 'Sin cola detrás'),
                w(
                    Li(
                        g,
                        `Ver siguiente ${String(g?.ticketCode || '')}`,
                        `Es el próximo turno listo detrás de ${l}.`
                    )
                ),
                w(
                    Li(
                        f,
                        `Ver general ${String(f?.ticketCode || '')}`,
                        'Es el ticket más antiguo que todavía no tiene consultorio.'
                    )
                ));
        } else if ('waiting' === o && r > 0) {
            const e = Math.max(0, p + (b ? 1 : 0));
            (($ = `C${r} · cola asignada`),
                (_ =
                    e <= 0 ? 'Listo para llamado' : `${e} paso(s) por delante`),
                (C = `${d.length} ticket(s) esperando en C${r}`),
                b && p <= 0
                    ? ((S = g
                          ? `${b.ticketCode} atiende ahora; cuando cierre, ${l} queda primero y ${g.ticketCode} sigue detrás.`
                          : `${b.ticketCode} atiende ahora; cuando cierre, ${l} queda primero en C${r}.`),
                      w(
                          Li(
                              b,
                              `Ver ticket activo ${b.ticketCode}`,
                              `Es el bloqueo inmediato antes de ${l}.`
                          )
                      ))
                    : b
                      ? ((S = `${b.ticketCode} atiende ahora y ${m?.ticketCode || 'otro ticket'} sigue antes que ${l} en C${r}.`),
                        w(
                            Li(
                                m,
                                `Ver anterior ${String(m?.ticketCode || '')}`,
                                `Va antes que ${l} dentro del carril C${r}.`
                            )
                        ))
                      : m
                        ? ((S = `${m.ticketCode} sigue antes en C${r}; ${l} no debería llamarse hasta que ese turno avance.`),
                          w(
                              Li(
                                  m,
                                  `Ver anterior ${m.ticketCode}`,
                                  `Va antes que ${l} en la cola asignada.`
                              )
                          ))
                        : (S = `${l} ya es el siguiente turno útil de C${r} y puede llamarse desde el lookup o el operador.`),
                w(
                    Li(
                        g,
                        `Ver siguiente ${String(g?.ticketCode || '')}`,
                        `Quedará detrás de ${l} cuando esta misma cola avance.`
                    )
                ),
                (k =
                    e <= 0
                        ? 'Siguiente listo'
                        : `${e} paso(s) antes de llamarlo`),
                (h =
                    e <= 1
                        ? `${l} ya está muy cerca de la cabecera de C${r}.`
                        : `${l} sigue dentro de una cola asignada y conviene revisar el bloqueo inmediato antes de moverlo.`));
        } else if ('waiting' === o) {
            const a = c.findIndex(
                    (e) => Number(e.id || 0) === Number(i.id || 0)
                ),
                n = a > 0 ? a : 0,
                o = _i(e, t);
            (($ = 'Cola general · sin consultorio'),
                (_ =
                    0 === n
                        ? 'Primero sin consultorio'
                        : `${n} ticket(s) por delante`),
                (C = `${c.length} ticket(s) en cola general`),
                (S =
                    0 === o.readinessScore
                        ? `Si lo reasignas a C${o.slot}, ${l} sale de recepción y entra a un consultorio con operador vivo.`
                        : `El desvío natural es C${o.slot}, pero todavía conviene validar ese operador antes del llamado.`),
                (k = 0 === n ? 'Cabecera general' : `${n} delante`),
                (h =
                    0 === n
                        ? `${l} ya lidera la cola sin consultorio y es buen candidato a despacho inmediato.`
                        : `${l} sigue esperando en recepción y todavía tiene otros turnos generales delante.`),
                w(
                    Li(
                        m,
                        `Ver anterior ${String(m?.ticketCode || '')}`,
                        `Va antes que ${l} en la cola general.`
                    )
                ),
                w(
                    Li(
                        g,
                        `Ver siguiente ${String(g?.ticketCode || '')}`,
                        `Queda detrás de ${l} en la cola general.`
                    )
                ),
                w(
                    Li(
                        Jt(o.slot),
                        `Ver activo C${o.slot}`,
                        `Es el ticket que hoy bloquea el consultorio sugerido para ${l}.`
                    )
                ));
        } else {
            const e = r > 0 ? Jt(r) : null,
                t = r > 0 ? Yt(r) : f;
            (($ =
                'completed' === o
                    ? 'Ruta cerrada · completado'
                    : 'no_show' === o
                      ? 'Ruta cerrada · no show'
                      : 'Ruta cerrada · cancelado'),
                (_ = n.statusCopy),
                (C =
                    r > 0
                        ? `C${r} sigue operando en vivo`
                        : 'Recepción sigue operando en vivo'),
                (S = e
                    ? `${l} ya no afecta la cola; ahora el foco está en ${e.ticketCode}.`
                    : t
                      ? `${l} ya cerró. El siguiente pivote útil quedó en ${t.ticketCode}.`
                      : `${l} ya cerró y no deja una presión inmediata visible en este carril.`),
                (h =
                    'La ruta de este ticket ya terminó; el panel salta al turno vivo más cercano para no perder continuidad operativa.'),
                (k = 'Ruta cerrada'),
                w(
                    Li(
                        e,
                        `Ver activo ${String(e?.ticketCode || '')}`,
                        'Es el turno vivo más cercano dentro del mismo carril.'
                    )
                ),
                w(
                    Li(
                        t,
                        `Ver siguiente ${String(t?.ticketCode || '')}`,
                        'Es el siguiente turno útil relacionado con este carril.'
                    )
                ));
        }
        return {
            title: v,
            summary: h,
            statusLabel: k,
            statusState: q,
            result: n,
            laneLabel: $,
            positionLabel: _,
            pressureLabel: C,
            impactLabel: S,
            pivots: y.slice(0, 2),
        };
    })(t, a);
    l(
        '#queueTicketRoute',
        `\n            <section class="queue-ticket-route__shell" data-state="${e(n.statusState)}">\n                <div class="queue-ticket-route__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Ruta del ticket</p>\n                        <h5 id="queueTicketRouteTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueTicketRouteSummary" class="queue-ticket-route__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-ticket-route__meta">\n                        <span\n                            id="queueTicketRouteStatus"\n                            class="queue-ticket-route__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <button\n                            id="queueTicketRouteCopyBtn"\n                            type="button"\n                            class="queue-ticket-route__action"\n                            ${n.result ? '' : 'disabled'}\n                        >\n                            Copiar ruta\n                        </button>\n                    </div>\n                </div>\n                ${n.result ? `\n                            <div class="queue-ticket-route__grid">\n                                <article class="queue-ticket-route__fact">\n                                    <span>Carril</span>\n                                    <strong id="queueTicketRouteLane">${e(n.laneLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-route__fact">\n                                    <span>Posición</span>\n                                    <strong id="queueTicketRoutePosition">${e(n.positionLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-route__fact">\n                                    <span>Presión</span>\n                                    <strong id="queueTicketRoutePressure">${e(n.pressureLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-route__fact queue-ticket-route__fact--wide">\n                                    <span>Impacto</span>\n                                    <strong id="queueTicketRouteImpact">${e(n.impactLabel)}</strong>\n                                </article>\n                            </div>\n                            <div class="queue-ticket-route__actions">\n                                <button\n                                    id="queueTicketRoutePivotPrimary"\n                                    type="button"\n                                    class="queue-ticket-route__action queue-ticket-route__action--primary"\n                                    ${n.pivots[0] ? '' : 'disabled'}\n                                >\n                                    ${e(n.pivots[0]?.label || 'Sin pivote principal')}\n                                </button>\n                                <button\n                                    id="queueTicketRoutePivotSecondary"\n                                    type="button"\n                                    class="queue-ticket-route__action"\n                                    ${n.pivots[1] ? '' : 'disabled'}\n                                >\n                                    ${e(n.pivots[1]?.label || 'Sin pivote secundario')}\n                                </button>\n                            </div>\n                            <div class="queue-ticket-route__pivot-notes">\n                                <p id="queueTicketRoutePivotDetailPrimary">${e(n.pivots[0]?.detail || 'No hay otro ticket relacionado por cargar ahora.')}</p>\n                                <p id="queueTicketRoutePivotDetailSecondary">${e(n.pivots[1]?.detail || 'Cuando aparezca otro pivote útil, quedará disponible aquí.')}</p>\n                            </div>\n                        ` : `\n                            <article\n                                id="queueTicketRouteEmpty"\n                                class="queue-ticket-route__empty"\n                                data-state="${e(n.statusState)}"\n                            >\n                                <strong>${e(n.title)}</strong>\n                                <p>${e(n.summary)}</p>\n                            </article>\n                        `}\n            </section>\n        `
    );
    const o = document.getElementById('queueTicketRouteCopyBtn');
    o instanceof HTMLButtonElement &&
        (o.onclick = () => {
            !(function (e) {
                if (!e || !e.result) return Promise.resolve();
                const t = e.pivots.length
                        ? e.pivots.map(
                              (e, t) => `${t + 1}. ${e.label} - ${e.detail}`
                          )
                        : ['Sin pivotes relacionados disponibles.'],
                    a = [
                        `${e.title} - ${i(new Date().toISOString())}`,
                        `Estado: ${e.statusLabel}`,
                        `Carril: ${e.laneLabel}`,
                        `Posición: ${e.positionLabel}`,
                        `Presión: ${e.pressureLabel}`,
                        `Impacto: ${e.impactLabel}`,
                        'Pivotes:',
                        ...t,
                    ].join('\n');
                navigator.clipboard
                    .writeText(a)
                    .then(() => s('Ruta copiada', 'success'))
                    .catch(() => s('No se pudo copiar la ruta', 'error'));
            })(n);
        });
    const r = document.getElementById('queueTicketRoutePivotPrimary');
    r instanceof HTMLButtonElement &&
        n.pivots[0] &&
        (r.onclick = () => {
            (La(n.pivots[0].ticketCode),
                un({
                    source: 'ticket_route',
                    tone: 'info',
                    title: 'Ruta del ticket: pivote principal',
                    summary: `${n.pivots[0].ticketCode} quedó cargado desde la ruta de ${n.result.ticketCode}.`,
                }),
                so(t, a));
        });
    const c = document.getElementById('queueTicketRoutePivotSecondary');
    c instanceof HTMLButtonElement &&
        n.pivots[1] &&
        (c.onclick = () => {
            (La(n.pivots[1].ticketCode),
                un({
                    source: 'ticket_route',
                    tone: 'info',
                    title: 'Ruta del ticket: pivote secundario',
                    summary: `${n.pivots[1].ticketCode} quedó cargado desde la ruta de ${n.result.ticketCode}.`,
                }),
                so(t, a));
        });
}
function Ti(t, a) {
    if (
        !(
            document.getElementById('queueTicketSimulation') instanceof
            HTMLElement
        )
    )
        return;
    const n = (function (e, t) {
        const a = Ci(e, t),
            n = a.result;
        if (!n)
            return {
                title: 'Simulación operativa en espera',
                summary:
                    a.term && !a.result
                        ? 'No hay una coincidencia activa para simular. Ajusta el ticket o limpia la búsqueda para volver a intentarlo.'
                        : 'Busca un ticket para proyectar el efecto de su siguiente acción útil antes de tocar la cola real.',
                statusLabel: a.term
                    ? 'Sin simulación disponible'
                    : 'Sin ticket cargado',
                statusState: a.term ? 'warning' : 'idle',
                result: null,
                beforeLabel: 'Sin ticket seleccionado',
                actionLabel: 'Sin acción',
                afterLabel: 'Sin proyección',
                riskLabel:
                    'La simulación se activa cuando el lookup encuentra un ticket real.',
                focusLabel: 'Sin foco siguiente',
                focusDetail: 'No hay pivote operativo calculado todavía.',
                focusPivot: null,
            };
        const i = (function (e = '') {
                const t = _a;
                if (!t) return null;
                const a = wa(e);
                if (!a || a !== t.lookupTerm) return Ta();
                const n = Wt(t.sourceTicketId),
                    i = String(n?.status || '')
                        .trim()
                        .toLowerCase(),
                    o = Number(n?.assignedConsultorio || 0);
                return n && i === t.sourceStatus && o === t.sourceConsultorio
                    ? t
                    : Ta();
            })(Aa()),
            o = Array.isArray(i?.tickets)
                ? i.tickets.map(Ma).filter(Boolean)
                : Kt().queueTickets.map(Ma).filter(Boolean),
            s = o.map(Ma).filter(Boolean),
            r =
                (function (e, t) {
                    const a = Number(t || 0);
                    return (
                        (a &&
                            (Array.isArray(e) ? e : []).find(
                                (e) => Number(e?.id || 0) === a
                            )) ||
                        null
                    );
                })(o, n.ticketId) || Wt(n.ticketId);
        if (!r)
            return {
                title: 'Simulación sin snapshot',
                summary:
                    'El ticket ya no está en el estado local. Refresca la cola o vuelve a buscarlo antes de proyectar el siguiente paso.',
                statusLabel: 'Snapshot vencido',
                statusState: 'warning',
                result: null,
                beforeLabel: 'Sin snapshot',
                actionLabel: n.primaryLabel,
                afterLabel: 'Sin proyección',
                riskLabel: 'Refresca la cola para reconstruir la simulación.',
                focusLabel: 'Sin foco siguiente',
                focusDetail: 'No se pudo reconstruir el contexto del ticket.',
                focusPivot: null,
            };
        const l = String(r.status || '')
                .trim()
                .toLowerCase(),
            c = qi(r),
            u =
                'waiting' === l || 'called' === l
                    ? ti(r, 'called' === l ? 'called' : 'waiting')
                    : `Último estado · ${c}`,
            d = Number(r.assignedConsultorio || 0),
            p = 2 === d ? 2 : 1 === d ? 1 : 0,
            m = String(r.ticketCode || 'ticket'),
            b = g().queue.pendingSensitiveAction,
            f = i || Number(b?.ticketId || 0) !== Number(r.id || 0) ? null : b,
            y = oi(o).filter((e) => !Number(e.assignedConsultorio || 0)),
            v = p > 0 ? li(o, p) : y,
            h = v.findIndex((e) => Number(e.id || 0) === Number(r.id || 0)),
            k = p > 0 ? ci(o, p) : null;
        let q = `Simulación de ${m}`,
            $ = i
                ? `Secuencia encadenada desde ${i.sourceTicketCode || 'la simulación previa'} para ver el siguiente paso sin tocar la cola real todavía.`
                : 'Este bloque proyecta el siguiente efecto útil sobre la cola antes de ejecutar la acción real.',
            _ = i ? 'Secuencia simulada' : 'Simulación lista',
            C = i ? 'ready' : n.panelState,
            S = `${c} · ${u}`,
            w = n.primaryLabel,
            L = 'Sin proyección calculada',
            A = 'Sin riesgo inmediato calculado.',
            T = 'Sin siguiente foco',
            M = 'No quedó un pivote útil después de esta acción.',
            E = null,
            B = null;
        const N = (e, t, a) => {
            if (e) return ((E = e), (T = e.label), void (M = e.detail));
            ((E = null), (T = t), (M = a));
        };
        if (f) {
            const e = Yn(f, r),
                t = 2 === Number(f.consultorio || 0) ? 2 : 1,
                a = String(f.action || '')
                    .trim()
                    .toLowerCase();
            B = s.map((e) =>
                Number(e.id || 0) === Number(r.id || 0)
                    ? {
                          ...e,
                          status:
                              'no_show' === a
                                  ? 'no_show'
                                  : 'completar' === a
                                    ? 'completed'
                                    : String(e.status || 'waiting'),
                          assignedConsultorio:
                              'no_show' === a || 'completar' === a
                                  ? null
                                  : e.assignedConsultorio,
                          completedAt:
                              'no_show' === a || 'completar' === a
                                  ? new Date().toISOString()
                                  : e.completedAt,
                      }
                    : e
            );
            const n = li(B, t)[0] || null;
            ((q = `Simulación retenida para ${m}`),
                ($ =
                    'Ya existe una acción sensible pendiente para este ticket. El siguiente cambio real depende de confirmarla o cancelarla.'),
                (_ = 'Confirmación pendiente'),
                (C = 'alert'),
                (S = `Pendiente · ${e}`),
                (w = `Confirmar ${e}`),
                (L =
                    'no_show' ===
                        String(f.action || '')
                            .trim()
                            .toLowerCase() ||
                    'completar' ===
                        String(f.action || '')
                            .trim()
                            .toLowerCase()
                        ? n
                            ? `${n.ticketCode} queda primero en C${t} tras confirmar.`
                            : `C${t} queda libre tras confirmar.`
                        : `${m} cambia de estado cuando confirmes la acción pendiente.`),
                (A =
                    'Mientras la confirmación siga pendiente, Enter y el flujo rápido del hub quedan tomados por esta acción sensible.'),
                N(
                    Li(
                        n,
                        `Cargar ${String(n?.ticketCode || '')}`,
                        'Es el turno que quedaría primero después de confirmar la acción pendiente.'
                    ),
                    'Sin siguiente foco',
                    'No hay otro ticket listo detrás de esta confirmación.'
                ));
        } else if ('called' === l && p > 0) {
            B = s.map((e) =>
                Number(e.id || 0) === Number(r.id || 0)
                    ? {
                          ...e,
                          status: 'completed',
                          assignedConsultorio: null,
                          completedAt: new Date().toISOString(),
                      }
                    : e
            );
            const e = li(B, p)[0] || null,
                t = y[0] || null,
                a = li(o, p).length;
            ((S = `${m} ocupa C${p} · ${a} detrás`),
                (w = `Completar ${m}`),
                (L = e
                    ? `${e.ticketCode} queda listo en C${p} cuando cierres ${m}.`
                    : `C${p} queda libre en cuanto cierres ${m}.`),
                (A = e
                    ? `La cola de C${p} depende de cerrar ${m}; detrás ya espera ${e.ticketCode}.`
                    : `No hay otro ticket asignado detrás, así que cerrar ${m} devuelve el foco a recepción.`),
                N(
                    Li(
                        e || t,
                        `Cargar ${String((e || t)?.ticketCode || '')}`,
                        e
                            ? 'Es el siguiente turno que quedará listo al cerrar la atención actual.'
                            : 'Es el ticket general más antiguo si C no recibe otro turno enseguida.'
                    ),
                    'Sin siguiente foco',
                    'No hay otro ticket útil para cargar después de este cierre.'
                ));
        } else if ('waiting' === l && 0 === p) {
            const e = Number(n.primaryConsultorio || 0);
            B =
                e > 0
                    ? s.map((t) =>
                          Number(t.id || 0) === Number(r.id || 0)
                              ? { ...t, assignedConsultorio: e }
                              : t
                      )
                    : null;
            const t = e > 0 ? ci(B || o, e) : null,
                a =
                    ((I = [
                        ...(e > 0 ? li(B || o, e) : []),
                        ...(B ? [] : [{ ...r, assignedConsultorio: e }]),
                    ]),
                    [...(Array.isArray(I) ? I : [])].sort((e, t) => {
                        const a = ni(e, 'waiting'),
                            n = ni(t, 'waiting');
                        return Number.isFinite(a) && Number.isFinite(n)
                            ? a - n
                            : Number.isFinite(a)
                              ? -1
                              : Number.isFinite(n)
                                ? 1
                                : Number(e?.id || 0) - Number(t?.id || 0);
                    })),
                i = a.findIndex((e) => Number(e.id || 0) === Number(r.id || 0)),
                l = t || (i > 0 ? a[i - 1] : null),
                c = i + (t ? 1 : 0);
            ((S =
                h > 0
                    ? `Cola general · ${h} turno(s) delante`
                    : 'Cabecera de cola general'),
                (w = n.primaryLabel),
                (L =
                    e > 0
                        ? c <= 0
                            ? `${m} quedaría listo para llamado en C${e}.`
                            : `${m} entraría a C${e} con ${c} paso(s) por delante.`
                        : `${m} seguiría en la cola general.`),
                (A =
                    e > 0
                        ? l
                            ? `${String(l.ticketCode || 'otro turno')} seguiría delante en C${e} después de reasignar.`
                            : `No habría bloqueo inmediato en C${e} después de reasignar.`
                        : 'Sin consultorio sugerido disponible para este turno.'),
                N(
                    Li(
                        l,
                        `Cargar ${String(l?.ticketCode || '')}`,
                        'Es el bloqueo inmediato que seguiría antes de este ticket tras la reasignación.'
                    ),
                    c <= 0 ? 'Sin bloqueo inmediato' : 'Sin pivote siguiente',
                    c <= 0
                        ? 'Después de reasignarlo, este ticket quedaría listo sin otro bloqueo delante.'
                        : 'No se pudo calcular el ticket que quedaría delante.'
                ));
        } else if ('waiting' === l && p > 0) {
            const e = li(o, p),
                t =
                    e.find((e) => Number(e.id || 0) !== Number(r.id || 0)) ||
                    null,
                a = h > 0 ? v[h - 1] : null,
                i = e[0] || null;
            Number(i?.id || 0) !== Number(r.id || 0) || k
                ? ((S = `C${p} asignado · ${Math.max(h + (k ? 1 : 0), 0)} paso(s) delante`),
                  (w = n.primaryLabel),
                  (L = a
                      ? `${m} seguiría esperando detrás de ${a.ticketCode} en C${p}.`
                      : k
                        ? `${m} seguiría esperando a que ${k.ticketCode} libere C${p}.`
                        : `${m} ya quedó en C${p}, pero todavía conviene usar el operador o la tabla para moverlo.`),
                  (A =
                      'Esta acción no cambia de inmediato la cola; sirve para abrir contexto o revisar el bloqueo exacto antes de tocar el ticket.'),
                  N(
                      Li(
                          k || a,
                          `Cargar ${String((k || a)?.ticketCode || '')}`,
                          'Es el ticket que todavía bloquea o precede a este turno dentro del consultorio.'
                      ),
                      'Sin bloqueo directo',
                      'No hay otro ticket visible delante dentro del mismo carril.'
                  ))
                : ((B = s.map((e) =>
                      Number(e.id || 0) === Number(r.id || 0)
                          ? {
                                ...e,
                                status: 'called',
                                assignedConsultorio: p,
                                calledAt: new Date().toISOString(),
                            }
                          : e
                  )),
                  (S = `Cabecera de C${p} · listo para llamado`),
                  (w = `Llamar ${m}`),
                  (L = t
                      ? `${m} pasaría a atención y ${t.ticketCode} quedaría siguiente en C${p}.`
                      : `${m} pasaría a atención y C${p} quedaría sin otro ticket asignado detrás.`),
                  (A = t
                      ? `El flujo de C${p} seguiría vivo con ${t.ticketCode} detrás.`
                      : 'Sin otro turno detrás, el siguiente cuello vuelve a recepción.'),
                  N(
                      Li(
                          t || y[0] || null,
                          `Cargar ${String((t || y[0] || null)?.ticketCode || '')}`,
                          t
                              ? 'Es el turno que quedaría inmediatamente detrás después del llamado.'
                              : 'Es el ticket general más antiguo si quieres ver el siguiente frente de presión.'
                      ),
                      'Sin siguiente foco',
                      'No hay otro turno útil calculado después de este llamado.'
                  ));
        } else {
            const e = p > 0 ? Jt(p) : y[0] || null;
            ((S = `${n.statusCopy} · ruta cerrada`),
                (w =
                    'reprint' === n.primaryAction
                        ? n.primaryLabel
                        : 'Sin acción operativa directa'),
                (L =
                    'La cola real ya no depende de este ticket; cualquier decisión ahora pasa por el siguiente turno vivo.'),
                (A =
                    'El riesgo ya no está en este ticket sino en el siguiente paciente que sostenga el carril.'),
                N(
                    Li(
                        e,
                        `Cargar ${String(e?.ticketCode || '')}`,
                        'Es el turno vivo más cercano después del cierre de este ticket.'
                    ),
                    'Sin siguiente foco',
                    'No hay otro turno cercano para tomar como siguiente foco.'
                ));
        }
        var I;
        return {
            title: q,
            summary: $,
            statusLabel: _,
            statusState: C,
            result: n,
            beforeLabel: S,
            actionLabel: w,
            afterLabel: L,
            riskLabel: A,
            focusLabel: T,
            focusDetail: M,
            focusPivot: E,
            projectedTickets: B,
        };
    })(t, a);
    l(
        '#queueTicketSimulation',
        `\n            <section class="queue-ticket-simulation__shell" data-state="${e(n.statusState)}">\n                <div class="queue-ticket-simulation__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Simulación operativa</p>\n                        <h5 id="queueTicketSimulationTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueTicketSimulationSummary" class="queue-ticket-simulation__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-ticket-simulation__meta">\n                        <span\n                            id="queueTicketSimulationStatus"\n                            class="queue-ticket-simulation__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <button\n                            id="queueTicketSimulationCopyBtn"\n                            type="button"\n                            class="queue-ticket-simulation__action"\n                            ${n.result ? '' : 'disabled'}\n                        >\n                            Copiar simulación\n                        </button>\n                    </div>\n                </div>\n                ${n.result ? `\n                            <div class="queue-ticket-simulation__grid">\n                                <article class="queue-ticket-simulation__fact">\n                                    <span>Antes</span>\n                                    <strong id="queueTicketSimulationBefore">${e(n.beforeLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-simulation__fact">\n                                    <span>Acción sugerida</span>\n                                    <strong id="queueTicketSimulationAction">${e(n.actionLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-simulation__fact">\n                                    <span>Después</span>\n                                    <strong id="queueTicketSimulationAfter">${e(n.afterLabel)}</strong>\n                                </article>\n                                <article class="queue-ticket-simulation__fact queue-ticket-simulation__fact--wide">\n                                    <span>Riesgo / presión</span>\n                                    <strong id="queueTicketSimulationRisk">${e(n.riskLabel)}</strong>\n                                </article>\n                            </div>\n                            <div class="queue-ticket-simulation__actions">\n                                <button\n                                    id="queueTicketSimulationFocusBtn"\n                                    type="button"\n                                    class="queue-ticket-simulation__action queue-ticket-simulation__action--primary"\n                                    ${n.focusPivot ? '' : 'disabled'}\n                                >\n                                    ${e(n.focusLabel)}\n                                </button>\n                            </div>\n                            <p id="queueTicketSimulationFocusDetail" class="queue-ticket-simulation__focus-detail">${e(n.focusDetail)}</p>\n                        ` : `\n                            <article\n                                id="queueTicketSimulationEmpty"\n                                class="queue-ticket-simulation__empty"\n                                data-state="${e(n.statusState)}"\n                            >\n                                <strong>${e(n.title)}</strong>\n                                <p>${e(n.summary)}</p>\n                            </article>\n                        `}\n            </section>\n        `
    );
    const o = document.getElementById('queueTicketSimulationCopyBtn');
    o instanceof HTMLButtonElement &&
        (o.onclick = () => {
            !(function (e) {
                if (!e || !e.result) return Promise.resolve();
                const t = [
                    `${e.title} - ${i(new Date().toISOString())}`,
                    `Estado: ${e.statusLabel}`,
                    `Antes: ${e.beforeLabel}`,
                    `Acción: ${e.actionLabel}`,
                    `Después: ${e.afterLabel}`,
                    `Riesgo: ${e.riskLabel}`,
                    `Siguiente foco: ${e.focusLabel}`,
                    e.focusDetail,
                ];
                navigator.clipboard
                    .writeText(t.join('\n'))
                    .then(() => s('Simulación copiada', 'success'))
                    .catch(() => s('No se pudo copiar la simulación', 'error'));
            })(n);
        });
    const r = document.getElementById('queueTicketSimulationFocusBtn');
    r instanceof HTMLButtonElement &&
        n.focusPivot &&
        (r.onclick = () => {
            (La(n.focusPivot.ticketCode),
                Array.isArray(n.projectedTickets) &&
                    (function (e) {
                        const t = wa(e?.lookupTerm || ''),
                            a = Number(e?.targetTicketId || 0),
                            n = Number(e?.sourceTicketId || 0),
                            i = Array.isArray(e?.tickets)
                                ? e.tickets.map(Ma).filter(Boolean)
                                : [];
                        t && a && n && i.length
                            ? (_a = {
                                  lookupTerm: t,
                                  targetTicketId: a,
                                  sourceTicketId: n,
                                  sourceStatus: String(e?.sourceStatus || '')
                                      .trim()
                                      .toLowerCase(),
                                  sourceConsultorio: Number(
                                      e?.sourceConsultorio || 0
                                  ),
                                  sourceTicketCode: String(
                                      e?.sourceTicketCode || ''
                                  ).trim(),
                                  actionLabel: String(
                                      e?.actionLabel || ''
                                  ).trim(),
                                  tickets: i,
                              })
                            : Ta();
                    })({
                        lookupTerm: n.focusPivot.ticketCode,
                        targetTicketId: n.focusPivot.ticketId,
                        sourceTicketId: n.result.ticketId,
                        sourceStatus: Wt(n.result.ticketId)?.status,
                        sourceConsultorio: n.result.consultorio,
                        sourceTicketCode: n.result.ticketCode,
                        actionLabel: n.actionLabel,
                        tickets: n.projectedTickets,
                    }),
                un({
                    source: 'ticket_simulation',
                    tone: 'info',
                    title: 'Simulación operativa: foco siguiente',
                    summary: `${n.focusPivot.ticketCode} quedó cargado desde la simulación de ${n.result.ticketCode}.`,
                }),
                so(t, a));
        });
}
function Mi(e, t, a) {
    const n = 2 === Number(a || 0) ? 2 : 1,
        i = `c${n}`,
        o = pi(e, t, n),
        s = Jt(n),
        r = ri(n),
        l = si(),
        c = Gi(e, t, n),
        u = [];
    if (s) {
        const e = r[0] || null,
            t = l[0] || null;
        u.push({
            id: `${i}_0`,
            state: 'active',
            actionLabel: `Completar ${s.ticketCode}`,
            support: e
                ? `Deja ${e.ticketCode} listo para ${i.toUpperCase()}.`
                : t
                  ? `Libera ${i.toUpperCase()} para absorber ${t.ticketCode} desde cola general.`
                  : `Libera ${i.toUpperCase()} sin otro ticket esperando detrás.`,
            pivot: Li(
                s,
                `Cargar ${s.ticketCode}`,
                `Es el ticket que hoy ocupa ${i.toUpperCase()}.`
            ),
        });
    }
    const d = r[0] || null;
    if (d) {
        const e = r[1] || null,
            t = Boolean(o.operatorAssigned && o.operatorLive);
        u.push({
            id: `${i}_1`,
            state: t ? 'ready' : 'warning',
            actionLabel: t
                ? s
                    ? `Llamar ${d.ticketCode} después del cierre`
                    : `Llamar ${d.ticketCode}`
                : `Abrir Operador ${i.toUpperCase()} para ${d.ticketCode}`,
            support: e
                ? `${e.ticketCode} quedaría inmediatamente detrás en ${i.toUpperCase()}.`
                : l[0]
                  ? `Luego ${i.toUpperCase()} puede absorber ${l[0].ticketCode} desde general.`
                  : 'Sin otro ticket asignado detrás por ahora.',
            pivot: Li(
                d,
                `Cargar ${d.ticketCode}`,
                `Es el siguiente turno que ya espera en ${i.toUpperCase()}.`
            ),
        });
    }
    const p = r[1] || null;
    p
        ? u.push({
              id: `${i}_2`,
              state: 'idle',
              actionLabel: `Preparar ${p.ticketCode}`,
              support: `${ti(p, 'waiting')}. Quedará detrás del primer llamado del carril.`,
              pivot: Li(
                  p,
                  `Cargar ${p.ticketCode}`,
                  `Sigue detrás del primer ticket en ${i.toUpperCase()}.`
              ),
          })
        : l[0] &&
          c.targetTicketId === Number(l[0].id || 0) &&
          u.push({
              id: `${i}_2`,
              state:
                  'assign' === c.primaryAction
                      ? 'suggested'
                      : 'open' === c.primaryAction
                        ? 'warning'
                        : 'idle',
              actionLabel:
                  'assign' === c.primaryAction
                      ? `Traer ${l[0].ticketCode} desde general`
                      : c.primaryLabel,
              support: c.detail,
              pivot: Li(
                  l[0],
                  `Cargar ${l[0].ticketCode}`,
                  `Es el siguiente ticket general candidato para ${i.toUpperCase()}.`
              ),
          });
    const m = u[0] || null;
    return {
        laneKey: i,
        laneLabel: i.toUpperCase(),
        state: m?.state || 'idle',
        badge: m
            ? 'active' === m.state
                ? 'Atención en curso'
                : 'ready' === m.state
                  ? 'Siguiente listo'
                  : 'warning' === m.state
                    ? 'Preparar operador'
                    : 'Secuencia lista'
            : 'Sin presión',
        headline: m
            ? `${i.toUpperCase()} ya tiene la siguiente ronda trazada`
            : `${i.toUpperCase()} sin pasos inmediatos`,
        summary: m
            ? m.support
            : `No hay ticket en curso ni espera asignada para ${i.toUpperCase()} ahora mismo.`,
        steps: u,
    };
}
function Ei(e, t) {
    const a = si(),
        n = { 1: pi(e, t, 1), 2: pi(e, t, 2) },
        i = {
            1: ri(1).length + (Jt(1) ? 1 : 0),
            2: ri(2).length + (Jt(2) ? 1 : 0),
        },
        o = a.slice(0, 3).map((a, o) => {
            const s = (function (e, t, a, n) {
                    return [1, 2]
                        .map((i) => {
                            const o = n[i] || pi(e, t, i),
                                s = Boolean(
                                    o.operatorAssigned && o.operatorLive
                                ),
                                r = Jt(i);
                            return {
                                slot: i,
                                slotKey: `c${i}`,
                                operatorReady: s,
                                context: o,
                                score:
                                    Number(a[i] || 0) +
                                    (s ? 0 : 2) +
                                    (r ? 0.5 : 0),
                            };
                        })
                        .sort((e, t) =>
                            e.score !== t.score
                                ? e.score - t.score
                                : e.operatorReady !== t.operatorReady
                                  ? e.operatorReady
                                      ? -1
                                      : 1
                                  : e.slot - t.slot
                        )[0];
                })(e, t, i, n),
                r = s.slot,
                l = Number(i[r] || 0);
            return (
                (i[r] = l + 1),
                {
                    id: `general_${o}`,
                    state: s.operatorReady ? 'suggested' : 'warning',
                    actionLabel: s.operatorReady
                        ? `Asignar ${a.ticketCode} a C${r}`
                        : `Preparar ${a.ticketCode} para C${r}`,
                    support: s.operatorReady
                        ? l <= 0
                            ? `${a.ticketCode} quedaría listo para llamado en C${r}.`
                            : `${a.ticketCode} entraría con ${l} paso(s) delante en C${r}.`
                        : `Primero deja arriba Operador C${r}; después ${a.ticketCode} entraría con ${l} paso(s) delante.`,
                    pivot: Li(
                        a,
                        `Cargar ${a.ticketCode}`,
                        `Es el siguiente ticket general que recepción puede despachar a C${r}.`
                    ),
                }
            );
        }),
        s = o[0] || null;
    return {
        laneKey: 'general',
        laneLabel: 'General',
        state: s?.state || 'idle',
        badge: s ? 'Recepción en curso' : 'Sin cola general',
        headline: s
            ? `${a.length} ticket(s) esperan despacho`
            : 'Cola general al día',
        summary: s
            ? s.support
            : 'No hay tickets sin consultorio esperando en recepción.',
        steps: o,
    };
}
function Bi(t, a) {
    const n = document.getElementById('queueNextTurns');
    if (!(n instanceof HTMLElement)) return;
    const o = (function (e, t) {
        const a = [Mi(e, t, 1), Mi(e, t, 2), Ei(e, t)],
            n = a.reduce((e, t) => e + Number(t.steps.length || 0), 0),
            i = a.filter((e) => e.steps.length > 0),
            o =
                a.find((e) => 'active' === e.state) ||
                a.find((e) => 'warning' === e.state) ||
                a.find((e) => 'ready' === e.state) ||
                i[0] ||
                null;
        return {
            title: 'Próximos turnos',
            summary: o
                ? `${o.laneLabel} marca el siguiente frente útil. ${o.summary}`
                : 'No hay movimientos inmediatos pendientes entre consultorios y recepción.',
            statusLabel:
                n > 0
                    ? `${n} movimiento(s) trazados`
                    : 'Sin movimientos inmediatos',
            statusState: o ? o.state : 'idle',
            cards: a,
        };
    })(t, a);
    l(
        '#queueNextTurns',
        `\n            <section class="queue-next-turns__shell" data-state="${e(o.statusState)}">\n                <div class="queue-next-turns__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Ventana inmediata</p>\n                        <h5 id="queueNextTurnsTitle" class="queue-app-card__title">${e(o.title)}</h5>\n                        <p id="queueNextTurnsSummary" class="queue-next-turns__summary">${e(o.summary)}</p>\n                    </div>\n                    <div class="queue-next-turns__meta">\n                        <span\n                            id="queueNextTurnsStatus"\n                            class="queue-next-turns__status"\n                            data-state="${e(o.statusState)}"\n                        >\n                            ${e(o.statusLabel)}\n                        </span>\n                        <button\n                            id="queueNextTurnsCopyBtn"\n                            type="button"\n                            class="queue-next-turns__action"\n                            ${o.cards.some((e) => e.steps.length) ? '' : 'disabled'}\n                        >\n                            Copiar secuencia\n                        </button>\n                    </div>\n                </div>\n                <div id="queueNextTurnsCards" class="queue-next-turns__grid" role="list" aria-label="Próximos turnos por carril">\n                    ${o.cards.map((t) => `\n                                <article\n                                    id="queueNextTurnsCard_${e(t.laneKey)}"\n                                    class="queue-next-turns__card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-next-turns__card-head">\n                                        <div>\n                                            <p class="queue-next-turns__lane">${e(t.laneLabel)}</p>\n                                            <strong id="queueNextTurnsHeadline_${e(t.laneKey)}">${e(t.headline)}</strong>\n                                        </div>\n                                        <span class="queue-next-turns__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p id="queueNextTurnsSummary_${e(t.laneKey)}" class="queue-next-turns__card-summary">${e(t.summary)}</p>\n                                    ${t.steps.length ? `\n                                                <div class="queue-next-turns__steps" role="list" aria-label="Secuencia de ${e(t.laneLabel)}">\n                                                    ${t.steps.map((a, n) => `\n                                                                <article class="queue-next-turns__step" data-state="${e(a.state)}" role="listitem">\n                                                                    <div class="queue-next-turns__step-copy">\n                                                                        <span class="queue-next-turns__step-index">${n + 1}</span>\n                                                                        <div>\n                                                                            <strong id="queueNextTurnsStep_${e(t.laneKey)}_${n}">${e(a.actionLabel)}</strong>\n                                                                            <p>${e(a.support)}</p>\n                                                                        </div>\n                                                                    </div>\n                                                                    <button\n                                                                        id="queueNextTurnsLoad_${e(t.laneKey)}_${n}"\n                                                                        type="button"\n                                                                        class="queue-next-turns__load"\n                                                                        data-queue-next-turns-ticket="${e(a.pivot?.ticketCode || '')}"\n                                                                        data-queue-next-turns-action="${e(a.actionLabel)}"\n                                                                        ${a.pivot ? '' : 'disabled'}\n                                                                    >\n                                                                        ${e(a.pivot?.label || 'Sin ticket')}\n                                                                    </button>\n                                                                </article>\n                                                            `).join('')}\n                                                </div>\n                                            ` : '\n                                                <article class="queue-next-turns__empty">\n                                                    <strong>Sin pasos inmediatos</strong>\n                                                    <p>Este carril no necesita intervención ahora mismo.</p>\n                                                </article>\n                                            '}\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    );
    const r = document.getElementById('queueNextTurnsCopyBtn');
    (r instanceof HTMLButtonElement &&
        (r.onclick = () => {
            !(function (e) {
                if (!e) return Promise.resolve();
                const t = [
                    `Próximos turnos - ${i(new Date().toISOString())}`,
                    `Estado: ${e.statusLabel}`,
                    e.summary,
                    '',
                    ...e.cards.flatMap((e) => [
                        `${e.laneLabel} - ${e.badge}`,
                        ...(e.steps.length
                            ? e.steps.map(
                                  (e, t) =>
                                      `${t + 1}. ${e.actionLabel} - ${e.support}`
                              )
                            : ['Sin pasos inmediatos.']),
                        '',
                    ]),
                ];
                navigator.clipboard
                    .writeText(t.join('\n').trim())
                    .then(() => {
                        s('Secuencia copiada', 'success');
                    })
                    .catch(() => {
                        s('No se pudo copiar la secuencia', 'error');
                    });
            })(o);
        }),
        n.querySelectorAll('[data-queue-next-turns-ticket]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = String(
                            e.dataset.queueNextTurnsTicket || ''
                        ).trim(),
                        i = String(e.dataset.queueNextTurnsAction || '').trim();
                    n &&
                        (La(n),
                        un({
                            source: 'next_turns',
                            tone: 'info',
                            title: 'Próximos turnos: ticket cargado',
                            summary: `${n} quedó cargado desde la secuencia inmediata (${i || 'sin acción visible'}).`,
                        }),
                        so(t, a));
                });
        }));
}
function Ni({ ageSec: e, backlog: t, operatorReady: a }) {
    const n = Math.max(0, Number(t || 0)),
        i = Number.isFinite(Number(e)) ? Number(e) : null;
    return n <= 0
        ? {
              state: 'idle',
              badge: 'Sin cola',
              support: 'Sin presión de espera por ahora.',
          }
        : (null !== i && i >= 900) || n >= 4 || (!a && null !== i && i >= 480)
          ? {
                state: 'alert',
                badge: 'Atender ya',
                support:
                    null !== i
                        ? `Espera máxima ${xn(i)}.`
                        : 'Hay demasiada presión acumulada.',
            }
          : (null !== i && i >= 480) || n >= 2 || !a
            ? {
                  state: 'warning',
                  badge: 'Vigilar',
                  support:
                      null !== i
                          ? `Espera máxima ${xn(i)}.`
                          : 'Hace falta vigilar esta línea.',
              }
            : {
                  state: 'ready',
                  badge: 'Bajo control',
                  support:
                      null !== i
                          ? `Espera máxima ${xn(i)}.`
                          : 'Cola controlada.',
              };
}
function Ii(t, a) {
    if (!(document.getElementById('queueWaitRadar') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = ['general', 'c1', 'c2'].map((a) =>
                (function (e, t, a) {
                    if ('general' === a) {
                        const a = si(),
                            n = a[0] || null,
                            i = Gi(e, t, 1),
                            o = Gi(e, t, 2),
                            s =
                                [i, o]
                                    .filter(
                                        (e) =>
                                            'assign' === e.primaryAction &&
                                            e.targetTicketId ===
                                                Number(n?.id || 0)
                                    )
                                    .sort((e, t) => e.slot - t.slot)[0] || null,
                            r = [i, o].find((e) => 'open' === e.primaryAction),
                            l = Ni({
                                ageSec: ai(n, 'waiting'),
                                backlog: a.length,
                                operatorReady: Boolean(s),
                            });
                        if (!n)
                            return {
                                laneKey: 'general',
                                laneLabel: 'General',
                                state: 'idle',
                                badge: 'Sin cola',
                                headline: 'Cola general al día',
                                detail: 'No hay tickets sin consultorio esperando despacho en este momento.',
                                oldestLabel: 'Sin ticket pendiente',
                                pressureLabel: 'General 0 · C1 0 · C2 0',
                                recommendationLabel: 'Sin movimiento urgente',
                                chips: [
                                    'Sin consultorio 0',
                                    'Operación estable',
                                ],
                                primaryLabel: 'Sin acción',
                                actionCard: null,
                            };
                        let c =
                                'Es el ticket más antiguo sin consultorio y merece la próxima revisión del turno.',
                            u = 'Abrir cola admin',
                            d = null;
                        const p = [`Sin consultorio ${a.length}`];
                        return (
                            s
                                ? ((c = `${s.slotKey.toUpperCase()} está en mejor posición para absorber este ticket sin bajar a la tabla completa.`),
                                  (u = `Asignar ${n.ticketCode} a ${s.slotKey.toUpperCase()}`),
                                  (d = { ...s, primaryLabel: u }),
                                  p.push(
                                      `Recomendado ${s.slotKey.toUpperCase()}`
                                  ))
                                : r
                                  ? ((c =
                                        'La cola general ya tiene presión, pero todavía falta dejar listo el operador recomendado antes de reasignar con confianza.'),
                                    (u = `Abrir Operador ${r.slotKey.toUpperCase()}`),
                                    (d = { ...r, primaryLabel: u }),
                                    p.push(`Falta ${r.slotKey.toUpperCase()}`))
                                  : p.push('Sin operador listo'),
                            p.push(l.support),
                            {
                                laneKey: 'general',
                                laneLabel: 'General',
                                state: l.state,
                                badge: l.badge,
                                headline: `${n.ticketCode} lidera la cola general`,
                                detail: c,
                                oldestLabel: `${n.ticketCode} · ${ti(n, 'waiting')}`,
                                pressureLabel: `General ${a.length} · C1 ${ri(1).length} · C2 ${ri(2).length}`,
                                recommendationLabel: u,
                                chips: p,
                                primaryLabel: d ? d.primaryLabel : 'Sin acción',
                                actionCard: d,
                            }
                        );
                    }
                    const n = 'c2' === a ? 2 : 1,
                        i = pi(e, t, n),
                        o = Gi(e, t, n),
                        s = ri(n),
                        r = si(),
                        l = Jt(n),
                        c =
                            s[0] ||
                            (('assign' === o.primaryAction ||
                                'rebalance' === o.primaryAction) &&
                            o.targetTicketId > 0
                                ? Wt(o.targetTicketId)
                                : null),
                        u = s.length
                            ? s.length
                            : 'assign' === o.primaryAction
                              ? r.length
                              : 'rebalance' === o.primaryAction
                                ? ri(2 === n ? 1 : 2).length
                                : 0;
                    if (!c && l)
                        return {
                            laneKey: a,
                            laneLabel: a.toUpperCase(),
                            state: 'active',
                            badge: 'En atención',
                            headline: `${l.ticketCode} está en consulta`,
                            detail: `No hay espera nueva para ${a.toUpperCase()}, pero el consultorio sigue ocupado y listo para retomar el siguiente turno desde el mismo hub.`,
                            oldestLabel: `${l.ticketCode} · ${ti(l, 'called')}`,
                            pressureLabel: `Propios ${s.length} · General ${r.length}`,
                            recommendationLabel: o.primaryLabel,
                            chips: [
                                i.operatorLabel,
                                i.oneTapLabel,
                                i.heartbeatLabel,
                            ],
                            primaryLabel: o.primaryLabel,
                            actionCard: 'none' === o.primaryAction ? null : o,
                        };
                    if (!c)
                        return {
                            laneKey: a,
                            laneLabel: a.toUpperCase(),
                            state:
                                i.operatorAssigned && i.operatorLive
                                    ? 'ready'
                                    : 'idle',
                            badge:
                                i.operatorAssigned && i.operatorLive
                                    ? 'Listo'
                                    : 'Sin cola',
                            headline:
                                i.operatorAssigned && i.operatorLive
                                    ? `${a.toUpperCase()} listo para absorber demanda`
                                    : `${a.toUpperCase()} sin espera propia`,
                            detail:
                                i.operatorAssigned && i.operatorLive
                                    ? `No hay tickets esperando ahora, pero ${a.toUpperCase()} ya tiene operador y heartbeat para responder al siguiente ingreso.`
                                    : `No hay presión visible en ${a.toUpperCase()} y todavía no hace falta una acción rápida desde el radar.`,
                            oldestLabel: 'Sin ticket pendiente',
                            pressureLabel: `Propios ${s.length} · General ${r.length}`,
                            recommendationLabel: o.primaryLabel,
                            chips: [
                                i.operatorLabel,
                                i.oneTapLabel,
                                i.heartbeatLabel,
                            ],
                            primaryLabel:
                                'none' === o.primaryAction
                                    ? 'Sin acción'
                                    : o.primaryLabel,
                            actionCard: 'none' === o.primaryAction ? null : o,
                        };
                    const d = Ni({
                            ageSec: ai(c, 'waiting'),
                            backlog: u,
                            operatorReady:
                                'open' !== o.primaryAction &&
                                'none' !== o.primaryAction,
                        }),
                        p =
                            'open' === o.primaryAction
                                ? 'Falta operador'
                                : d.badge;
                    return {
                        laneKey: a,
                        laneLabel: a.toUpperCase(),
                        state:
                            'open' === o.primaryAction && 'ready' === d.state
                                ? 'warning'
                                : d.state,
                        badge: p,
                        headline: `${c.ticketCode} presiona ${a.toUpperCase()}`,
                        detail: o.detail,
                        oldestLabel: `${c.ticketCode} · ${ti(c, 'waiting')}`,
                        pressureLabel: `Propios ${s.length} · General ${r.length}`,
                        recommendationLabel: o.primaryLabel,
                        chips: [i.operatorLabel, i.oneTapLabel, d.support],
                        primaryLabel: o.primaryLabel,
                        actionCard: 'none' === o.primaryAction ? null : o,
                    };
                })(e, t, a)
            ),
            n = a.filter((e) => 'alert' === e.state).length,
            i = a.filter((e) => 'warning' === e.state).length,
            o = a.filter((e) => e.actionCard).length,
            s = ii().reduce((e, t) => {
                const a = ai(t, 'waiting');
                return null !== a ? Math.max(e, a) : e;
            }, 0);
        return {
            title:
                n > 0
                    ? 'Radar de espera en rojo'
                    : i > 0
                      ? 'Radar de espera con presión'
                      : 'Radar de espera bajo control',
            summary:
                n > 0
                    ? 'La cola ya muestra una espera que conviene atender antes de seguir navegando por otras tarjetas del hub.'
                    : i > 0
                      ? 'El radar agrupa la línea más vieja por cola general y consultorio para que recepción vea primero dónde está subiendo la presión.'
                      : 'No hay presión visible: la cola general y ambos consultorios están bajo control por ahora.',
            statusLabel:
                n > 0
                    ? `${n} en rojo`
                    : i > 0
                      ? `${i} por vigilar`
                      : 'Sin espera crítica',
            statusState: n > 0 ? 'alert' : i > 0 ? 'warning' : 'ready',
            chips: [
                `Acciones ${o}`,
                `Alertas ${n}`,
                s > 0 ? `Espera máxima ${xn(s)}` : 'Espera máxima 0s',
            ],
            cards: a,
        };
    })(t, a);
    (l(
        '#queueWaitRadar',
        `\n            <section class="queue-wait-radar__shell" data-state="${e(n.statusState)}">\n                <div class="queue-wait-radar__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Radar de espera</p>\n                        <h5 id="queueWaitRadarTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueWaitRadarSummary" class="queue-wait-radar__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-wait-radar__meta">\n                        <span\n                            id="queueWaitRadarStatus"\n                            class="queue-wait-radar__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-wait-radar__chips">\n                            ${n.chips.map((t) => `<span class="queue-wait-radar__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queueWaitRadarCards" class="queue-wait-radar__grid" role="list" aria-label="Radar de espera por línea">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueWaitRadarCard_${e(t.laneKey)}"\n                                    class="queue-wait-radar__card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-wait-radar__card-header">\n                                        <div>\n                                            <strong>${e(t.laneLabel)}</strong>\n                                            <p id="queueWaitRadarHeadline_${e(t.laneKey)}" class="queue-wait-radar__headline">${e(t.headline)}</p>\n                                        </div>\n                                        <span class="queue-wait-radar__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p class="queue-wait-radar__detail">${e(t.detail)}</p>\n                                    <div class="queue-wait-radar__facts">\n                                        <div class="queue-wait-radar__fact">\n                                            <span>Ticket crítico</span>\n                                            <strong id="queueWaitRadarOldest_${e(t.laneKey)}">${e(t.oldestLabel)}</strong>\n                                        </div>\n                                        <div class="queue-wait-radar__fact">\n                                            <span>Presión</span>\n                                            <strong id="queueWaitRadarPressure_${e(t.laneKey)}">${e(t.pressureLabel)}</strong>\n                                        </div>\n                                        <div class="queue-wait-radar__fact">\n                                            <span>Siguiente jugada</span>\n                                            <strong id="queueWaitRadarRecommendation_${e(t.laneKey)}">${e(t.recommendationLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-wait-radar__lane-chips">\n                                        ${t.chips.map((t) => `<span class="queue-wait-radar__lane-chip">${e(t)}</span>`).join('')}\n                                    </div>\n                                    <div class="queue-wait-radar__actions">\n                                        <button\n                                            id="queueWaitRadarPrimary_${e(t.laneKey)}"\n                                            type="button"\n                                            class="queue-wait-radar__action queue-wait-radar__action--primary"\n                                            ${t.actionCard ? '' : 'disabled'}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const n = document.getElementById(
                `queueWaitRadarPrimary_${e.laneKey}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0),
                        await (async function (e, t, a) {
                            e?.actionCard &&
                                (await Ji(e.actionCard, t, a, {
                                    source: 'wait_radar',
                                }));
                        })(e, t, a));
                });
        }));
}
function Pi(e, t) {
    return Number.isFinite(e) && 0 !== e
        ? e > 0
            ? `+${e} vs ${t.toUpperCase()}`
            : `${Math.abs(e)} menos que ${t.toUpperCase()}`
        : `Parejo con ${t.toUpperCase()}`;
}
function ji(t, a) {
    if (!(document.getElementById('queueLoadBalance') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = [1, 2].map((a) =>
                (function (e, t, a) {
                    const n = pi(e, t, a),
                        i = Gi(e, t, a),
                        o = 2 === a ? 1 : 2,
                        s = 2 === o ? 'c2' : 'c1',
                        r = Gi(e, t, o),
                        l = ri(a),
                        c = ri(o),
                        u = si(),
                        d = Jt(a),
                        p = Jt(o),
                        m = l.length + (d ? 1 : 0),
                        g = c.length + (p ? 1 : 0),
                        b = m - g,
                        f = Math.abs(b),
                        y = n.operatorAssigned && n.operatorLive;
                    let v = y || m > 0 || u.length > 0 ? 'ready' : 'idle',
                        h = y ? 'Parejo' : 'Sin operador',
                        k = `${n.slotKey.toUpperCase()} con carga estable`,
                        q =
                            0 === f && 0 === u.length
                                ? `La carga visible está pareja entre ${n.slotKey.toUpperCase()} y ${s.toUpperCase()} y no hay cola general esperando reparto.`
                                : `${n.slotKey.toUpperCase()} mantiene un margen manejable frente a ${s.toUpperCase()}, pero conviene vigilar el siguiente movimiento del turno.`,
                        $ = y
                            ? 'Listo para absorber'
                            : 'Falta operador dedicado',
                        _ = 'none' === i.primaryAction ? null : i,
                        C = _ ? _.primaryLabel : 'Sin acción';
                    if ('rebalance' === r.primaryAction && b >= 2) {
                        const e = `Mover ${r.targetTicketCode} a ${s.toUpperCase()}`;
                        ((v = f >= 3 ? 'alert' : 'warning'),
                            (h = 'Más cargado'),
                            (k = `${n.slotKey.toUpperCase()} está absorbiendo de más`),
                            (q = `${n.slotKey.toUpperCase()} lleva ${l.length} en espera frente a ${c.length} de ${s.toUpperCase()}. ${s.toUpperCase()} ya puede tomar ${r.targetTicketCode} para repartir mejor el turno.`),
                            ($ = `Ceder ${r.targetTicketCode} a ${s.toUpperCase()}`),
                            (_ = { ...r, primaryLabel: e }),
                            (C = e));
                    } else
                        'rebalance' === i.primaryAction
                            ? ((v = 'ready'),
                              (h = 'Puede absorber'),
                              (k = `${n.slotKey.toUpperCase()} puede equilibrar ${s.toUpperCase()}`),
                              (q = `${n.slotKey.toUpperCase()} tiene margen operativo para absorber ${i.targetTicketCode} y bajar la presión que ya acumula ${s.toUpperCase()}.`),
                              ($ = `Absorber ${i.targetTicketCode}`),
                              (_ = i),
                              (C = i.primaryLabel))
                            : 'assign' === i.primaryAction
                              ? ((v = 'ready'),
                                (h = 'Capacidad libre'),
                                (k = `${n.slotKey.toUpperCase()} puede absorber cola general`),
                                (q = `Hay ${u.length} ticket(s) sin consultorio. ${n.slotKey.toUpperCase()} es la mejor salida inmediata para tomar ${i.targetTicketCode} y mantener la recepción liviana.`),
                                ($ = `Tomar ${i.targetTicketCode} de general`),
                                (_ = i),
                                (C = i.primaryLabel))
                              : 'call' === i.primaryAction
                                ? ((v = 'ready'),
                                  (h = 'Siguiente listo'),
                                  (k = `${n.slotKey.toUpperCase()} ya tiene siguiente ticket`),
                                  (q = `${i.targetTicketCode} ya está alineado a ${n.slotKey.toUpperCase()}. Llamarlo ahora evita que el balance vuelva a abrirse al siguiente refresh.`),
                                  ($ = `Llamar ${i.targetTicketCode}`),
                                  (_ = i),
                                  (C = i.primaryLabel))
                                : 'open' === i.primaryAction &&
                                    (l.length > 0 || u.length > 0 || f > 0)
                                  ? ((v = 'warning'),
                                    (h = 'Falta operador'),
                                    (k = `Prepara ${n.slotKey.toUpperCase()} para balancear`),
                                    (q = `${n.slotKey.toUpperCase()} tiene margen o cola pendiente, pero todavía falta un operador confiable para ejecutar el balance con seguridad.`),
                                    ($ = `Abrir Operador ${n.slotKey.toUpperCase()}`),
                                    (_ = i),
                                    (C = i.primaryLabel))
                                  : f <= 1 &&
                                    0 === u.length &&
                                    ((v =
                                        y || m > 0 || g > 0 ? 'ready' : 'idle'),
                                    (h = y ? 'Parejo' : 'Sin señal'),
                                    (k = `${n.slotKey.toUpperCase()} está bajo control`),
                                    (q = d
                                        ? `${d.ticketCode} sigue en atención y la cola pendiente no abre un desvío material frente a ${s.toUpperCase()}.`
                                        : `La diferencia con ${s.toUpperCase()} no supera un turno y no hay cola general acumulándose ahora mismo.`),
                                    ($ =
                                        0 === f
                                            ? `Mismo nivel que ${s.toUpperCase()}`
                                            : `Diferencia corta frente a ${s.toUpperCase()}`));
                    return {
                        slot: a,
                        slotKey: n.slotKey,
                        state: v,
                        badge: h,
                        headline: k,
                        detail: q,
                        loadLabel: `En cola ${l.length} · Atención ${d ? d.ticketCode : 'Libre'}`,
                        deltaLabel: Pi(b, s),
                        capacityLabel: $,
                        chips: [
                            n.operatorLabel,
                            n.oneTapLabel,
                            `General ${u.length}`,
                        ],
                        operatorUrl: n.operatorUrl,
                        actionCard: _,
                        primaryLabel: C,
                    };
                })(e, t, a)
            ),
            n = ri(1).length + (Jt(1) ? 1 : 0),
            i = ri(2).length + (Jt(2) ? 1 : 0),
            o = Math.abs(n - i),
            s = si().length,
            r = a.filter((e) => 'alert' === e.state).length,
            l = a.filter((e) => 'warning' === e.state).length,
            c = a.filter(
                (e) =>
                    e.actionCard &&
                    ['assign', 'rebalance', 'call'].includes(
                        e.actionCard.primaryAction
                    )
            ).length,
            u = a.filter(
                (e) =>
                    e.actionCard &&
                    'open' === e.actionCard.primaryAction &&
                    'warning' === e.state
            ).length,
            d = a.filter((e) => 'idle' !== e.state).length;
        return {
            title:
                r > 0
                    ? 'Balance de carga desviado'
                    : l > 0
                      ? 'Balance de carga por vigilar'
                      : c > 0
                        ? 'Balance de carga con margen'
                        : 'Balance de carga estable',
            summary:
                r > 0
                    ? 'Uno de los consultorios ya está absorbiendo de más y conviene rebalancear antes de que el radar de espera siga escalando.'
                    : l > 0
                      ? 'Aquí ves qué consultorio está más liviano, cuál está absorbiendo de más y cuál es el siguiente ajuste para repartir la cola.'
                      : c > 0
                        ? 'La carga está controlada, pero todavía puedes absorber un ticket o dejar un llamado listo sin bajar a la tabla.'
                        : 'C1, C2 y la cola general se ven parejos; no hace falta rebalancear el turno en este momento.',
            statusLabel:
                r > 0
                    ? `Gap ${o} con rebalanceo urgente`
                    : u > 0
                      ? `${u} bloqueo(s) para balancear`
                      : c > 0
                        ? `${c} ajuste(s) sugerido(s)`
                        : d > 0
                          ? `Gap actual ${o}`
                          : 'Sin carga pendiente',
            statusState:
                r > 0
                    ? 'alert'
                    : l > 0
                      ? 'warning'
                      : d > 0 || c > 0
                        ? 'ready'
                        : 'idle',
            chips: [`Gap C1/C2 ${o}`, `General ${s}`, `Ajustes ${c}`],
            cards: a,
        };
    })(t, a);
    (l(
        '#queueLoadBalance',
        `\n            <section class="queue-load-balance__shell" data-state="${e(n.statusState)}">\n                <div class="queue-load-balance__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Balance de carga</p>\n                        <h5 id="queueLoadBalanceTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueLoadBalanceSummary" class="queue-load-balance__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-load-balance__meta">\n                        <span\n                            id="queueLoadBalanceStatus"\n                            class="queue-load-balance__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-load-balance__chips">\n                            ${n.chips.map((t) => `<span class="queue-load-balance__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queueLoadBalanceCards" class="queue-load-balance__grid" role="list" aria-label="Balance de carga por consultorio">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueLoadBalanceCard_${e(t.slotKey)}"\n                                    class="queue-load-balance__card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-load-balance__card-header">\n                                        <div>\n                                            <strong>${e(t.slotKey.toUpperCase())}</strong>\n                                            <p id="queueLoadBalanceHeadline_${e(t.slotKey)}" class="queue-load-balance__headline">${e(t.headline)}</p>\n                                        </div>\n                                        <span class="queue-load-balance__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p class="queue-load-balance__detail">${e(t.detail)}</p>\n                                    <div class="queue-load-balance__facts">\n                                        <div class="queue-load-balance__fact">\n                                            <span>Carga visible</span>\n                                            <strong id="queueLoadBalanceLoad_${e(t.slotKey)}">${e(t.loadLabel)}</strong>\n                                        </div>\n                                        <div class="queue-load-balance__fact">\n                                            <span>Delta</span>\n                                            <strong id="queueLoadBalanceDelta_${e(t.slotKey)}">${e(t.deltaLabel)}</strong>\n                                        </div>\n                                        <div class="queue-load-balance__fact">\n                                            <span>Capacidad</span>\n                                            <strong id="queueLoadBalanceCapacity_${e(t.slotKey)}">${e(t.capacityLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-load-balance__lane-chips">\n                                        ${t.chips.map((t) => `<span class="queue-load-balance__lane-chip">${e(t)}</span>`).join('')}\n                                    </div>\n                                    <div class="queue-load-balance__actions">\n                                        <button\n                                            id="queueLoadBalancePrimary_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-load-balance__action queue-load-balance__action--primary"\n                                            ${t.actionCard ? '' : 'disabled'}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                        <a\n                                            id="queueLoadBalanceOpenOperator_${e(t.slotKey)}"\n                                            href="${e(t.operatorUrl)}"\n                                            class="queue-load-balance__action"\n                                            target="_blank"\n                                            rel="noopener"\n                                        >\n                                            Operador ${e(t.slotKey.toUpperCase())}\n                                        </a>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const n = document.getElementById(
                `queueLoadBalancePrimary_${e.slotKey}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0),
                        await (async function (e, t, a) {
                            e?.actionCard &&
                                (await Ji(e.actionCard, t, a, {
                                    source: 'load_balance',
                                }));
                        })(e, t, a));
                });
        }));
}
function xi(e) {
    const t = Number(e?.assignedConsultorio || 0);
    return 2 === t ? 'C2' : 1 === t ? 'C1' : 'General';
}
function Ri(e, t, a, n) {
    const i = Number(a?.id || 0);
    if (i <= 0) return null;
    const o = Number(a?.assignedConsultorio || 0);
    if (!o) {
        const e = [n[1], n[2]]
            .filter(Boolean)
            .find(
                (e) => 'assign' === e.primaryAction && e.targetTicketId === i
            );
        return (
            e ||
            [n[1], n[2]]
                .filter(Boolean)
                .find((e) => 'open' === e.primaryAction) ||
            null
        );
    }
    const s = 2 === o ? 2 : 1,
        r = ri(s);
    return r.length
        ? 0 !== r.findIndex((e) => Number(e.id || 0) === i)
            ? null
            : n[s] || null
        : null;
}
function Di(t, a) {
    if (!(document.getElementById('queuePriorityLane') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = { 1: Gi(e, t, 1), 2: Gi(e, t, 2) },
            n = (function (e = 4) {
                return [...ii()]
                    .sort((e, t) => {
                        const a = di(t) - di(e);
                        if (0 !== a) return a;
                        const n = ni(e, 'waiting'),
                            i = ni(t, 'waiting');
                        return Number.isFinite(n) && Number.isFinite(i)
                            ? n - i
                            : Number(e.id || 0) - Number(t.id || 0);
                    })
                    .slice(0, Math.max(1, Number(e || 4)));
            })(4).map((n, i) =>
                (function (e, t, a, n, i) {
                    const o = ai(a, 'waiting') || 0,
                        s = Number(a?.assignedConsultorio || 0),
                        r = xi(a),
                        l = ui(a),
                        c = s ? ri(s) : si(),
                        u = c.findIndex(
                            (e) => Number(e.id || 0) === Number(a?.id || 0)
                        ),
                        d = Ri(0, 0, a, i),
                        p = s ? Jt(s) : null,
                        m = 1 === s || 2 === s ? pi(e, t, s) : null,
                        g =
                            o >= 840 ||
                            'appt_overdue' ===
                                String(a?.priorityClass || '')
                                    .trim()
                                    .toLowerCase()
                                ? 'alert'
                                : o >= 480
                                  ? 'warning'
                                  : 'ready';
                    let b = g,
                        f =
                            'alert' === g
                                ? 'Urgente'
                                : d?.primaryAction &&
                                    'open' !== d.primaryAction &&
                                    'none' !== d.primaryAction
                                  ? 'Acción lista'
                                  : 'En fila',
                        y = s
                            ? `${a.ticketCode} ya está en ${r} y conviene seguir su próxima jugada sin bajar a la tabla.`
                            : `${a.ticketCode} sigue en cola general y necesita consultorio antes de seguir envejeciendo.`,
                        v = d
                            ? d.primaryLabel
                            : 'Espera su turno en la secuencia',
                        h = d ? d.primaryLabel : 'Sin acción',
                        k = [
                            `#${n + 1} global`,
                            u >= 0 ? `Posición ${u + 1} en ${r}` : r,
                            l,
                        ];
                    if (d)
                        if ('assign' === d.primaryAction) {
                            const e = `Asignar ${a.ticketCode} a ${d.slotKey.toUpperCase()}`;
                            ((y = `${a.ticketCode} es el siguiente ticket que conviene sacar de cola general. ${d.slotKey.toUpperCase()} tiene mejor ventana para absorberlo ahora.`),
                                (v = e),
                                (h = e));
                        } else if ('call' === d.primaryAction)
                            y = `${a.ticketCode} ya es el siguiente de ${r} y puede llamarse desde el hub sin revisar toda la tabla.`;
                        else if ('rebalance' === d.primaryAction) {
                            const e = `Mover ${a.ticketCode} a ${d.slotKey.toUpperCase()}`;
                            ((y = `${a.ticketCode} conviene moverlo ahora para repartir la carga entre consultorios antes de que siga subiendo la espera.`),
                                (v = e),
                                (h = e),
                                k.push('Rebalanceo sugerido'));
                        } else
                            'open' === d.primaryAction &&
                                ((b = 'warning'),
                                (f = 'Falta operador'),
                                (y = p
                                    ? `${a.ticketCode} será el siguiente de ${r}, pero ${p.ticketCode} sigue en atención. Deja el operador listo para no perder el ritmo cuando liberes.`
                                    : `${a.ticketCode} ya está listo, pero todavía falta operador confiable en ${r} para ejecutarlo desde el hub.`),
                                k.push(
                                    m?.heartbeatLabel ||
                                        'Operador sin heartbeat'
                                ));
                    else if (s && u > 0) {
                        const e = c[u - 1] || null;
                        ((b = 'alert' === g ? 'warning' : 'idle'),
                            (f = e ? 'Bloqueado' : 'En cola'),
                            (y = e
                                ? `${a.ticketCode} todavía va detrás de ${e.ticketCode} en ${r}. No hace falta tocarlo hasta que salga ese turno.`
                                : `${a.ticketCode} todavía no tiene una jugada inmediata en ${r}.`),
                            (v = e
                                ? `Esperar a ${e.ticketCode}`
                                : 'Sin acción inmediata'),
                            k.push('Aún no es el siguiente'));
                    } else k.push('Sin operador listo');
                    return {
                        index: n,
                        state: b,
                        badge: f,
                        headline: `${a.ticketCode} · ${r}`,
                        summary: y,
                        metaLabel: `${r} · ${ti(a, 'waiting')} · ${l}`,
                        recommendationLabel: v,
                        chips: k,
                        primaryLabel: h,
                        actionCard: d,
                    };
                })(e, t, n, i, a)
            ),
            i = n.filter(
                (e) =>
                    e.actionCard &&
                    e.actionCard.primaryAction &&
                    'none' !== e.actionCard.primaryAction
            ).length,
            o = n.filter((e) => 'alert' === e.state).length,
            s = n.filter((e) => 'warning' === e.state).length;
        return {
            title:
                o > 0
                    ? 'Fila priorizada con urgencias'
                    : i > 0
                      ? 'Fila priorizada lista'
                      : 'Fila priorizada estable',
            summary:
                o > 0
                    ? 'Esta secuencia resume los siguientes tickets que recepción debería tocar primero, con la jugada inmediata sugerida para cada uno.'
                    : i > 0
                      ? 'Aquí aparece una secuencia corta de tickets críticos para operar uno detrás de otro sin abrir toda la cola.'
                      : 'No hay tickets en espera que exijan una secuencia inmediata ahora mismo.',
            statusLabel:
                o > 0
                    ? `${o} urgencia(s) en secuencia`
                    : i > 0
                      ? `${i} paso(s) listos`
                      : 'Sin secuencia urgente',
            statusState:
                o > 0 ? 'alert' : s > 0 ? 'warning' : i > 0 ? 'ready' : 'idle',
            chips: [`Tickets ${n.length}`, `Urgencias ${o}`, `Acciones ${i}`],
            items: n,
        };
    })(t, a);
    (l(
        '#queuePriorityLane',
        `\n            <section class="queue-priority-lane__shell" data-state="${e(n.statusState)}">\n                <div class="queue-priority-lane__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Fila priorizada</p>\n                        <h5 id="queuePriorityLaneTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queuePriorityLaneSummary" class="queue-priority-lane__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-priority-lane__meta">\n                        <span\n                            id="queuePriorityLaneStatus"\n                            class="queue-priority-lane__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-priority-lane__chips">\n                            ${n.chips.map((t) => `<span class="queue-priority-lane__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queuePriorityLaneItems" class="queue-priority-lane__list" role="list" aria-label="Secuencia priorizada de tickets">\n                    ${n.items.length ? n.items.map((t) => `\n                                <article\n                                    id="queuePriorityLaneItem_${e(String(t.index))}"\n                                    class="queue-priority-lane__item"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-priority-lane__item-rank">\n                                        <span>${e(String(t.index + 1))}</span>\n                                    </div>\n                                    <div class="queue-priority-lane__item-main">\n                                        <div class="queue-priority-lane__item-header">\n                                            <div>\n                                                <p id="queuePriorityLaneHeadline_${e(String(t.index))}" class="queue-priority-lane__headline">${e(t.headline)}</p>\n                                                <p id="queuePriorityLaneMeta_${e(String(t.index))}" class="queue-priority-lane__meta-line">${e(t.metaLabel)}</p>\n                                            </div>\n                                            <span class="queue-priority-lane__badge">${e(t.badge)}</span>\n                                        </div>\n                                        <p class="queue-priority-lane__detail">${e(t.summary)}</p>\n                                        <div class="queue-priority-lane__chips-row">\n                                            ${t.chips.map((t) => `<span class="queue-priority-lane__lane-chip">${e(t)}</span>`).join('')}\n                                        </div>\n                                    </div>\n                                    <div class="queue-priority-lane__item-side">\n                                        <strong id="queuePriorityLaneRecommendation_${e(String(t.index))}" class="queue-priority-lane__recommendation">${e(t.recommendationLabel)}</strong>\n                                        <button\n                                            id="queuePriorityLanePrimary_${e(String(t.index))}"\n                                            type="button"\n                                            class="queue-priority-lane__action queue-priority-lane__action--primary"\n                                            ${t.actionCard ? '' : 'disabled'}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                    </div>\n                                </article>\n                            `).join('') : '\n                                <article\n                                    id="queuePriorityLaneEmpty"\n                                    class="queue-priority-lane__empty"\n                                    data-state="idle"\n                                    role="listitem"\n                                >\n                                    <strong>Sin tickets por secuenciar</strong>\n                                    <p>Cuando vuelva a entrar cola, aquí aparecerán los siguientes tickets críticos en el orden recomendado.</p>\n                                </article>\n                            '}\n                </div>\n            </section>\n        `
    ),
        n.items.forEach((e) => {
            const n = document.getElementById(
                `queuePriorityLanePrimary_${e.index}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0),
                        await (async function (e, t, a) {
                            e?.actionCard &&
                                (await Ji(e.actionCard, t, a, {
                                    source: 'priority_lane',
                                }));
                        })(e, t, a));
                });
        }));
}
function Oi() {
    if (!(document.getElementById('queueQuickTrays') instanceof HTMLElement))
        return;
    const t = (function () {
        const e = g(),
            t = String(e.queue?.filter || 'all')
                .trim()
                .toLowerCase(),
            a = Kt().queueTickets,
            n = si(),
            i = ri(1),
            o = ri(2),
            s = a.filter((e) => 'called' === e.status),
            r = a.filter(
                (e) =>
                    'waiting' === e.status &&
                    (Math.max(
                        0,
                        Math.round((Date.now() - ni(e, 'waiting')) / 6e4)
                    ) >= 20 ||
                        'appt_overdue' ===
                            String(e.priorityClass || '')
                                .trim()
                                .toLowerCase())
            ),
            l = [
                {
                    filter: 'sla_risk',
                    label: 'Urgentes',
                    count: r.length,
                    summary:
                        r.length > 0
                            ? `${r[0].ticketCode} abre la bandeja de riesgo y debería revisarse primero.`
                            : 'No hay tickets vencidos o en riesgo SLA ahora mismo.',
                },
                {
                    filter: 'waiting_unassigned',
                    label: 'Sin consultorio',
                    count: n.length,
                    summary:
                        n.length > 0
                            ? `${n[0].ticketCode} sigue sin consultorio y conviene despacharlo desde el hub o la tabla.`
                            : 'Toda la cola en espera ya tiene consultorio asignado.',
                },
                {
                    filter: 'waiting_c1',
                    label: 'C1 en espera',
                    count: i.length,
                    summary:
                        i.length > 0
                            ? `${i[0].ticketCode} es el siguiente ticket visible en C1.`
                            : 'C1 no tiene tickets esperando en la tabla.',
                },
                {
                    filter: 'waiting_c2',
                    label: 'C2 en espera',
                    count: o.length,
                    summary:
                        o.length > 0
                            ? `${o[0].ticketCode} es el siguiente ticket visible en C2.`
                            : 'C2 no tiene tickets esperando en la tabla.',
                },
                {
                    filter: 'called',
                    label: 'Llamados activos',
                    count: s.length,
                    summary:
                        s.length > 0
                            ? `${s[0].ticketCode} ya fue llamado y queda en seguimiento activo.`
                            : 'No hay tickets llamados activos en este momento.',
                },
            ].map((e) => ({
                ...e,
                active: t === e.filter,
                countLabel: 1 === e.count ? '1 ticket' : `${e.count} tickets`,
                actionLabel:
                    e.count > 0
                        ? e.active
                            ? 'Bandeja activa'
                            : 'Abrir bandeja'
                        : 'Sin tickets',
            })),
            c = l.find((e) => e.active) || null,
            u = l.filter((e) => e.count > 0).length;
        return {
            title:
                u > 0
                    ? 'Bandejas rápidas listas'
                    : 'Bandejas rápidas sin carga',
            summary:
                u > 0
                    ? 'Abre la tabla ya filtrada por el frente correcto sin tocar primero el triage manual.'
                    : 'Cuando vuelva a entrar cola, aquí aparecerán accesos directos a las vistas más útiles para recepción.',
            statusLabel: c
                ? `Filtro activo: ${c.label}`
                : u > 0
                  ? `${u} bandeja(s) con tickets`
                  : 'Sin bandejas activas',
            statusState: c ? 'ready' : u > 0 ? 'warning' : 'idle',
            trays: l,
        };
    })();
    (l(
        '#queueQuickTrays',
        `\n            <section class="queue-quick-trays__shell" data-state="${e(t.statusState)}">\n                <div class="queue-quick-trays__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Bandejas rápidas</p>\n                        <h5 id="queueQuickTraysTitle" class="queue-app-card__title">${e(t.title)}</h5>\n                        <p id="queueQuickTraysSummary" class="queue-quick-trays__summary">${e(t.summary)}</p>\n                    </div>\n                    <div class="queue-quick-trays__meta">\n                        <span\n                            id="queueQuickTraysStatus"\n                            class="queue-quick-trays__status"\n                            data-state="${e(t.statusState)}"\n                        >\n                            ${e(t.statusLabel)}\n                        </span>\n                    </div>\n                </div>\n                <div id="queueQuickTraysCards" class="queue-quick-trays__grid" role="list" aria-label="Bandejas rápidas de la cola">\n                    ${t.trays.map((t) => `\n                                <article\n                                    id="queueQuickTray_${e(t.filter)}"\n                                    class="queue-quick-tray"\n                                    data-state="${t.count > 0 ? 'ready' : 'idle'}"\n                                    data-active="${t.active ? 'true' : 'false'}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-quick-tray__header">\n                                        <div>\n                                            <strong>${e(t.label)}</strong>\n                                            <p class="queue-quick-tray__summary">${e(t.summary)}</p>\n                                        </div>\n                                        <span\n                                            id="queueQuickTrayCount_${e(t.filter)}"\n                                            class="queue-quick-tray__count"\n                                        >\n                                            ${e(t.countLabel)}\n                                        </span>\n                                    </div>\n                                    <button\n                                        id="queueQuickTrayAction_${e(t.filter)}"\n                                        type="button"\n                                        class="queue-quick-tray__action"\n                                        data-action="queue-open-quick-tray"\n                                        data-queue-filter-value="${e(t.filter)}"\n                                        ${t.active || 0 === t.count ? 'disabled' : ''}\n                                    >\n                                        ${e(t.actionLabel)}\n                                    </button>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        t.trays.forEach((e) => {
            const t = document.getElementById(
                `queueQuickTrayAction_${e.filter}`
            );
            t instanceof HTMLButtonElement &&
                (t.onclick = () => {
                    !(function (e, t, a) {
                        un({
                            tone: a > 0 ? 'info' : 'warning',
                            source: 'quick_trays',
                            title: `Bandeja rápida: ${t}`,
                            summary:
                                a > 0
                                    ? `Se abrió la vista filtrada de ${t.toLowerCase()} desde el hub.`
                                    : `Se abrió ${t.toLowerCase()}, pero no había tickets visibles para ese filtro.`,
                        });
                        const n = document.getElementById('queueTriageToolbar');
                        n instanceof HTMLElement &&
                            n.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                            });
                    })(e.filter, e.label, e.count);
                });
        }));
}
function Hi(e) {
    const t = String(e || 'all')
        .trim()
        .toLowerCase();
    return 'sla_risk' === t
        ? 'Urgentes'
        : 'waiting_unassigned' === t
          ? 'Sin consultorio'
          : 'waiting_c1' === t
            ? 'C1 en espera'
            : 'waiting_c2' === t
              ? 'C2 en espera'
              : 'called' === t
                ? 'Llamados activos'
                : 'waiting' === t
                  ? 'Todos en espera'
                  : 'no_show' === t
                    ? 'No show'
                    : 'Tabla completa';
}
function Fi(e, t, a, n, i) {
    const o = String(g().queue?.filter || 'all')
            .trim()
            .toLowerCase(),
        s = Number(a?.assignedConsultorio || 0),
        r = xi(a),
        l = ui(a),
        c = ti(a, 'called' === a?.status ? 'called' : 'waiting');
    let u = 'called' === a?.status ? 'active' : 'ready',
        d = 'called' === a?.status ? 'Llamado' : 'Pendiente',
        p = `${a.ticketCode} sigue visible en la bandeja actual.`,
        m = 'Sin acción',
        b = 'Sin acción',
        f = 'none',
        y = null,
        v = null;
    if ('called' === a?.status && s)
        ((u = 'active'),
            (d = 'Llamado'),
            (p = `${a.ticketCode} ya fue llamado en ${r}. Puedes re-llamarlo desde esta bandeja sin salir del filtro.`),
            (m = `Re-llamar ${a.ticketCode}`),
            (b = m),
            (f = 'recall'),
            (v = {
                ticketId: Number(a.id || 0),
                consultorio: s,
                ticketCode: String(a.ticketCode || ''),
            }));
    else {
        const e = Ri(0, 0, a, i);
        if (e)
            ((f = 'dispatch'),
                (y = e),
                (m =
                    'waiting_unassigned' === o && 'assign' === e.primaryAction
                        ? `Asignar ${a.ticketCode} a ${e.slotKey.toUpperCase()}`
                        : 'rebalance' === e.primaryAction
                          ? `Mover ${a.ticketCode} a ${e.slotKey.toUpperCase()}`
                          : e.primaryLabel),
                (b = m),
                (p =
                    'assign' === e.primaryAction
                        ? `${a.ticketCode} sigue sin consultorio. ${e.slotKey.toUpperCase()} es la salida más directa desde esta bandeja.`
                        : 'call' === e.primaryAction
                          ? `${a.ticketCode} ya es el siguiente ticket listo dentro de la bandeja actual.`
                          : 'open' === e.primaryAction
                            ? `${a.ticketCode} necesita dejar listo el operador correcto antes de avanzar desde esta bandeja.`
                            : `${a.ticketCode} tiene una siguiente jugada sugerida dentro de la bandeja actual.`),
                (d =
                    'open' === e.primaryAction
                        ? 'Falta operador'
                        : 'call' === e.primaryAction
                          ? 'Llamar'
                          : 'assign' === e.primaryAction
                            ? 'Asignar'
                            : 'rebalance' === e.primaryAction
                              ? 'Mover'
                              : d),
                (u = 'open' === e.primaryAction ? 'warning' : u));
        else if (('waiting_c1' !== o && 'waiting_c2' !== o) || !s)
            'sla_risk' === o &&
                ((d = 'Vigilar'),
                (u = 'warning'),
                (p = `${a.ticketCode} sigue visible por riesgo SLA y conviene mantenerlo a la vista aunque todavía no tenga una acción directa desde esta bandeja.`),
                (m = 'Revisar radar y despacho'),
                (b = m));
        else {
            const e = ri(s),
                t = e.findIndex((e) => Number(e.id || 0) === Number(a.id || 0)),
                n = t > 0 ? e[t - 1] : null;
            ((d = n ? 'En cola' : d),
                (u = n ? 'idle' : u),
                (p = n
                    ? `${a.ticketCode} todavía va detrás de ${n.ticketCode} en ${r}.`
                    : `${a.ticketCode} está visible, pero todavía no requiere una acción rápida adicional desde esta bandeja.`),
                (m = n ? `Esperar a ${n.ticketCode}` : 'Sin acción inmediata'),
                (b = m));
        }
    }
    return {
        index: n,
        state: u,
        badge: d,
        headline: `${a.ticketCode} · ${r}`,
        metaLabel: `${c} · ${l}`,
        summary: p,
        recommendationLabel: m,
        primaryLabel: b,
        actionKind: f,
        actionCard: y,
        actionPayload: v,
    };
}
function Ui(t, a) {
    if (!(document.getElementById('queueActiveTray') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = g(),
            n = String(a.queue?.filter || 'all')
                .trim()
                .toLowerCase(),
            i = String(a.queue?.search || '').trim(),
            o = Vt(),
            s = { 1: Gi(e, t, 1), 2: Gi(e, t, 2) },
            r = o.slice(0, 3).map((e, t) => Fi(0, 0, e, t, s)),
            l = Hi(n),
            c = [];
        ('all' !== n && c.push(l), i && c.push(`búsqueda "${i}"`));
        const u = c.length > 0;
        return {
            title: u
                ? `Bandeja activa: ${c.join(' · ')}`
                : 'Bandeja activa: tabla completa',
            summary: u
                ? 'Este panel resume la bandeja que tienes abierta y te deja ejecutar la siguiente jugada útil sin perder el contexto del filtro.'
                : 'No hay un filtro activo sobre la tabla. Usa una bandeja rápida cuando quieras abrir un frente operativo concreto.',
            statusLabel: u ? `${o.length} visible(s)` : 'Sin filtro activo',
            statusState: r.some((e) => 'warning' === e.state)
                ? 'warning'
                : u
                  ? 'ready'
                  : 'idle',
            hasContext: u,
            items: r,
            contextLabel: c.join(' · '),
        };
    })(t, a);
    (l(
        '#queueActiveTray',
        `\n            <section class="queue-active-tray__shell" data-state="${e(n.statusState)}">\n                <div class="queue-active-tray__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Bandeja activa</p>\n                        <h5 id="queueActiveTrayTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueActiveTraySummary" class="queue-active-tray__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-active-tray__meta">\n                        <span\n                            id="queueActiveTrayStatus"\n                            class="queue-active-tray__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-active-tray__actions">\n                            <button\n                                id="queueActiveTrayResetBtn"\n                                type="button"\n                                class="queue-active-tray__action"\n                                data-action="queue-reset-tray-context"\n                                ${n.hasContext ? '' : 'disabled'}\n                            >\n                                Limpiar bandeja\n                            </button>\n                            <a\n                                id="queueActiveTrayOpenTable"\n                                href="#queueTriageToolbar"\n                                class="queue-active-tray__action"\n                            >\n                                Ir a tabla\n                            </a>\n                        </div>\n                    </div>\n                </div>\n                <div id="queueActiveTrayItems" class="queue-active-tray__list" role="list" aria-label="Resumen de la bandeja activa">\n                    ${n.items.length ? n.items.map((t) => `\n                                        <article\n                                            id="queueActiveTrayItem_${e(String(t.index))}"\n                                            class="queue-active-tray__item"\n                                            data-state="${e(t.state)}"\n                                            role="listitem"\n                                        >\n                                            <div class="queue-active-tray__item-main">\n                                                <div class="queue-active-tray__item-header">\n                                                    <div>\n                                                        <p id="queueActiveTrayHeadline_${e(String(t.index))}" class="queue-active-tray__headline">${e(t.headline)}</p>\n                                                        <p id="queueActiveTrayMeta_${e(String(t.index))}" class="queue-active-tray__meta-line">${e(t.metaLabel)}</p>\n                                                    </div>\n                                                    <span class="queue-active-tray__badge">${e(t.badge)}</span>\n                                                </div>\n                                                <p class="queue-active-tray__detail">${e(t.summary)}</p>\n                                            </div>\n                                            <div class="queue-active-tray__item-side">\n                                                <strong id="queueActiveTrayRecommendation_${e(String(t.index))}" class="queue-active-tray__recommendation">${e(t.recommendationLabel)}</strong>\n                                                <button\n                                                    id="queueActiveTrayPrimary_${e(String(t.index))}"\n                                                    type="button"\n                                                    class="queue-active-tray__primary"\n                                                    ${'none' === t.actionKind ? 'disabled' : ''}\n                                                >\n                                                    ${e(t.primaryLabel)}\n                                                </button>\n                                            </div>\n                                        </article>\n                                    `).join('') : '\n                                <article\n                                    id="queueActiveTrayEmpty"\n                                    class="queue-active-tray__empty"\n                                    role="listitem"\n                                >\n                                    <strong>Sin tickets visibles en esta bandeja</strong>\n                                    <p>Prueba otra bandeja rápida o limpia el filtro actual para volver a la tabla completa.</p>\n                                </article>\n                            '}\n                </div>\n            </section>\n        `
    ),
        n.items.forEach((e) => {
            const n = document.getElementById(
                `queueActiveTrayPrimary_${e.index}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0),
                        await (async function (e, t, a) {
                            if (e && 'none' !== e.actionKind)
                                try {
                                    if (
                                        'dispatch' === e.actionKind &&
                                        e.actionCard
                                    )
                                        return void (await Ji(
                                            e.actionCard,
                                            t,
                                            a,
                                            { source: 'active_tray' }
                                        ));
                                    if (
                                        'recall' === e.actionKind &&
                                        e.actionPayload?.ticketId > 0 &&
                                        e.actionPayload?.consultorio > 0
                                    ) {
                                        const { runQueueTicketAction: t } =
                                            await Promise.resolve().then(
                                                function () {
                                                    return Ts;
                                                }
                                            );
                                        (await t(
                                            e.actionPayload.ticketId,
                                            're-llamar',
                                            e.actionPayload.consultorio
                                        ),
                                            un({
                                                tone: 'info',
                                                source: 'active_tray',
                                                title: 'Bandeja activa: re-llamado',
                                                summary: `${e.actionPayload.ticketCode} se re-llamó desde la bandeja activa.`,
                                            }));
                                    }
                                } catch (e) {
                                    s(
                                        'No se pudo ejecutar la acción de la bandeja activa',
                                        'error'
                                    );
                                } finally {
                                    so(t, a);
                                }
                        })(e, t, a));
                });
        }));
}
function Ki(e) {
    return (
        !!e &&
        ('recall' === e.actionKind
            ? Number(e.actionPayload?.ticketId || 0) > 0
            : 'dispatch' === e.actionKind &&
              ['assign', 'rebalance', 'call'].includes(
                  String(e.actionCard?.primaryAction || '')
              ))
    );
}
function Vi(e, t) {
    const a = g(),
        n = String(a.queue?.filter || 'all')
            .trim()
            .toLowerCase(),
        i = String(a.queue?.search || '').trim(),
        o = Vt(),
        s = { 1: Gi(e, t, 1), 2: Gi(e, t, 2) },
        r = o.slice(0, 3).map((e, t) => Fi(0, 0, e, t, s)),
        l = [];
    ('all' !== n && l.push(Hi(n)), i && l.push(`búsqueda "${i}"`));
    const c = l.length > 0,
        u = r.find((e) => Ki(e)),
        d = u
            ? (function (e) {
                  if (!Ki(e)) return [];
                  if ('recall' === e.actionKind)
                      return [
                          {
                              tone: 'ready',
                              kind: 'recall',
                              title: e.recommendationLabel,
                              detail: e.summary,
                              ticketCode: String(
                                  e.actionPayload?.ticketCode || ''
                              ),
                              ticketId: Number(e.actionPayload?.ticketId || 0),
                              consultorio: Number(
                                  e.actionPayload?.consultorio || 0
                              ),
                          },
                      ];
                  const t = e.actionCard;
                  if (!t) return [];
                  const a = [
                      {
                          tone:
                              'rebalance' === t.primaryAction
                                  ? 'warning'
                                  : 'ready',
                          kind: 'dispatch',
                          title: e.recommendationLabel,
                          detail: e.summary,
                          actionCard: t,
                      },
                  ];
                  if (
                      ['assign', 'rebalance'].includes(t.primaryAction) &&
                      t.targetTicketId > 0 &&
                      t.slot > 0
                  ) {
                      const e = t.slotKey.toUpperCase();
                      a.push({
                          tone: 'ready',
                          kind: 'call',
                          title: `Llamar ${t.targetTicketCode} en ${e}`,
                          detail: `${t.targetTicketCode} queda encaminado a ${e}; la ráfaga completa el llamado sin salir de la bandeja actual.`,
                          consultorio: t.slot,
                          ticketCode: t.targetTicketCode,
                      });
                  }
                  return a;
              })(u)
            : [],
        p = r.filter((e) => e !== u && 'none' !== e.actionKind).length,
        m = r.filter(
            (e) =>
                'dispatch' === e.actionKind &&
                'open' === String(e.actionCard?.primaryAction || '')
        ).length,
        b = c
            ? `Ráfaga operativa: ${l.join(' · ')}`
            : 'Ráfaga operativa: activa una bandeja';
    let f =
            'Activa una bandeja rápida o una búsqueda para convertir la cola visible en una secuencia corta y accionable.',
        y = 'Sin contexto activo',
        v = 'idle';
    return (
        c && d.length > 0
            ? ((f =
                  d.length > 1
                      ? 'La ráfaga enlaza los pasos mínimos sobre la misma bandeja para reducir clics y dejar el siguiente ticket ya encaminado.'
                      : 'La ráfaga ejecuta la jugada más corta que sale de la bandeja actual sin obligarte a bajar a la tabla.'),
              (p > 0 || m > 0) &&
                  (f += ` Después quedarán ${p + m} frente(s) para revisión manual.`),
              (y = `${d.length} paso(s) listos`),
              (v = m > 0 ? 'warning' : 'ready'))
            : c && r.length > 0
              ? ((f =
                    m > 0
                        ? 'La bandeja ya tiene tickets visibles, pero la secuencia automática se frena porque todavía falta abrir o alinear el operador correcto.'
                        : 'La bandeja sigue visible, pero por ahora no hay una secuencia automática segura; revisa las recomendaciones individuales o cambia de bandeja.'),
                (y =
                    m > 0
                        ? `${m} bloqueo(s) manual(es)`
                        : 'Sin ráfaga automática'),
                (v = m > 0 ? 'warning' : 'idle'))
              : c &&
                ((f =
                    'La bandeja actual quedó sin tickets visibles. Limpia el contexto o abre otra bandeja rápida para generar una nueva secuencia.'),
                (y = 'Bandeja vacía')),
        {
            title: b,
            summary: f,
            statusLabel: y,
            statusState: v,
            hasContext: c,
            steps: d,
            canRun: d.length > 0,
            primaryLabel:
                d.length > 0
                    ? `Ejecutar ráfaga (${d.length})`
                    : 'Sin ráfaga lista',
            copyLabel: c ? 'Copiar ráfaga' : 'Copiar guía',
            contextLabel: c ? l.join(' · ') : 'tabla completa',
            visibleCount: o.length,
            blockedCount: m,
            manualCount: p,
        }
    );
}
async function zi(e, t, a) {
    if (!e) return;
    if ('dispatch' === e.kind && e.actionCard)
        return void (await Ji(e.actionCard, t, a, {
            source: 'tray_burst',
            deferRerender: !0,
        }));
    const { callNextForConsultorio: n, runQueueTicketAction: i } =
        await Promise.resolve().then(function () {
            return Ts;
        });
    if ('call' === e.kind && e.consultorio > 0)
        return (
            await n(e.consultorio),
            void un({
                tone: 'info',
                source: 'tray_burst',
                title: `Ráfaga: llamado en C${e.consultorio}`,
                summary: `${e.ticketCode} se llamó como parte de la ráfaga operativa.`,
            })
        );
    'recall' === e.kind &&
        e.ticketId > 0 &&
        e.consultorio > 0 &&
        (await i(e.ticketId, 're-llamar', e.consultorio),
        un({
            tone: 'info',
            source: 'tray_burst',
            title: `Ráfaga: re-llamado en C${e.consultorio}`,
            summary: `${e.ticketCode} se re-llamó como parte de la ráfaga operativa.`,
        }));
}
function Qi(t, a) {
    if (!(document.getElementById('queueTrayBurst') instanceof HTMLElement))
        return;
    const n = Vi(t, a);
    l(
        '#queueTrayBurst',
        `\n            <section class="queue-tray-burst__shell" data-state="${e(n.statusState)}">\n                <div class="queue-tray-burst__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Ráfaga operativa</p>\n                        <h5 id="queueTrayBurstTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueTrayBurstSummary" class="queue-tray-burst__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-tray-burst__meta">\n                        <span\n                            id="queueTrayBurstStatus"\n                            class="queue-tray-burst__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-tray-burst__actions">\n                            <button\n                                id="queueTrayBurstRunBtn"\n                                type="button"\n                                class="queue-tray-burst__action queue-tray-burst__action--primary"\n                                ${n.canRun ? '' : 'disabled'}\n                            >\n                                ${e(n.primaryLabel)}\n                            </button>\n                            <button\n                                id="queueTrayBurstCopyBtn"\n                                type="button"\n                                class="queue-tray-burst__action"\n                                ${n.hasContext ? '' : 'disabled'}\n                            >\n                                ${e(n.copyLabel)}\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div id="queueTrayBurstSteps" class="queue-tray-burst__steps" role="list" aria-label="Secuencia de ráfaga operativa">\n                    ${n.steps.length ? n.steps.map((t, a) => `\n                                        <article\n                                            id="queueTrayBurstStep_${e(String(a))}"\n                                            class="queue-tray-burst__step"\n                                            data-state="${e(t.tone)}"\n                                            role="listitem"\n                                        >\n                                            <span class="queue-tray-burst__step-rank">${a + 1}</span>\n                                            <div class="queue-tray-burst__step-main">\n                                                <p id="queueTrayBurstStepTitle_${e(String(a))}" class="queue-tray-burst__step-title">${e(t.title)}</p>\n                                                <p id="queueTrayBurstStepDetail_${e(String(a))}" class="queue-tray-burst__step-detail">${e(t.detail)}</p>\n                                            </div>\n                                        </article>\n                                    `).join('') : '\n                                <article\n                                    id="queueTrayBurstEmpty"\n                                    class="queue-tray-burst__empty"\n                                    role="listitem"\n                                >\n                                    <strong>Sin secuencia automática disponible</strong>\n                                    <p>Activa una bandeja con tickets visibles o deja listo el operador correcto para que la ráfaga pueda encadenar pasos seguros.</p>\n                                </article>\n                            '}\n                </div>\n            </section>\n        `
    );
    const o = document.getElementById('queueTrayBurstRunBtn');
    o instanceof HTMLButtonElement &&
        (o.onclick = async () => {
            ((o.disabled = !0),
                await (async function (e, t) {
                    const a = Vi(e, t);
                    if (a.steps.length)
                        try {
                            for (const n of a.steps) await zi(n, e, t);
                            un({
                                tone: 'success',
                                source: 'tray_burst',
                                title: 'Ráfaga operativa ejecutada',
                                summary: `${a.steps.length} paso(s) se ejecutaron desde ${a.contextLabel}.`,
                            });
                        } catch (e) {
                            s(
                                'No se pudo completar la ráfaga operativa',
                                'error'
                            );
                        } finally {
                            so(e, t);
                        }
                })(t, a));
        });
    const r = document.getElementById('queueTrayBurstCopyBtn');
    r instanceof HTMLButtonElement &&
        (r.onclick = () => {
            !(async function (e) {
                try {
                    (await navigator.clipboard.writeText(
                        (function (e) {
                            return [
                                `${e.title} - ${i(new Date().toISOString())}`,
                                `Estado: ${e.statusLabel}`,
                                `Contexto: ${e.contextLabel}`,
                                `Tickets visibles: ${e.visibleCount}`,
                                ...e.steps.map(
                                    (e, t) =>
                                        `${t + 1}. ${e.title} - ${e.detail}`
                                ),
                                e.steps.length
                                    ? `Pendientes manuales: ${e.manualCount + e.blockedCount}`
                                    : 'Sin secuencia automática lista',
                            ].join('\n');
                        })(e)
                    ),
                        s('Ráfaga copiada', 'success'));
                } catch (e) {
                    s('No se pudo copiar la ráfaga', 'error');
                }
            })(n);
        });
}
function Gi(e, t, a) {
    const n = pi(e, t, a),
        {
            slot: i,
            slotKey: o,
            operatorAssigned: s,
            operatorLive: r,
            operatorLabel: l,
            operatorUrl: c,
            oneTapLabel: u,
            numpadLabel: d,
            heartbeatLabel: p,
        } = n,
        m = 2 === i ? 1 : 2,
        g = Jt(i),
        b = ri(i),
        f = ri(m),
        y = si(),
        v = b[0] || null,
        h = y[0] || null,
        k = 0 === b.length && f.length >= 2 ? f[1] : null,
        q = b.length,
        $ = f.length,
        _ = y.length;
    let C = 'idle',
        S = 'Sin acción inmediata',
        w = `${o.toUpperCase()} sin movimiento urgente`,
        L =
            'No hay ticket listo para mover o llamar desde este consultorio en este momento.',
        A = 'none',
        T = 'Sin acción',
        M = null,
        E = 'Sin ticket pendiente';
    return (
        g
            ? ((C = 'active'),
              (S = 'En atención'),
              (w = `${g.ticketCode} sigue en atención`),
              (L = `${o.toUpperCase()} está ocupado ahora. Deja visible el operador y prepara el siguiente paso sin cambiar de tarjeta.`),
              (A = 'open'),
              (T = `Abrir Operador ${o.toUpperCase()}`),
              (M = g),
              (E = `${g.ticketCode} · ${ti(g, 'called')}`))
            : v && s && r
              ? ((C = 'ready'),
                (S = 'Llamar ahora'),
                (w = `${v.ticketCode} listo para ${o.toUpperCase()}`),
                (L = `El ticket ya está alineado a ${o.toUpperCase()} y el operador correcto está arriba. Puedes llamarlo sin bajar a la tabla.`),
                (A = 'call'),
                (T = `Llamar ${v.ticketCode}`),
                (M = v),
                (E = `${v.ticketCode} · ${ti(v, 'waiting')}`))
              : h && s && r
                ? ((C = 'suggested'),
                  (S = 'Tomar de cola general'),
                  (w = `${o.toUpperCase()} puede absorber ${h.ticketCode}`),
                  (L = `Hay ${_} ticket(s) sin consultorio. Reasigna el más antiguo a ${o.toUpperCase()} para destrabar recepción antes del siguiente pico.`),
                  (A = 'assign'),
                  (T = `Asignar ${h.ticketCode}`),
                  (M = h),
                  (E = `${h.ticketCode} · ${ti(h, 'waiting')}`))
                : k && s && r
                  ? ((C = 'warning'),
                    (S = 'Rebalancear cola'),
                    (w = `${o.toUpperCase()} puede ayudar a C${m}`),
                    (L = `C${m} ya acumula ${$} en espera. Mueve ${k.ticketCode} a ${o.toUpperCase()} para repartir mejor la carga.`),
                    (A = 'rebalance'),
                    (T = `Mover ${k.ticketCode}`),
                    (M = k),
                    (E = `${k.ticketCode} · ${ti(k, 'waiting')}`))
                  : v || h || k
                    ? ((C = 'warning'),
                      (S = 'Falta operador'),
                      (w = `Prepara Operador ${o.toUpperCase()}`),
                      (L = `Hay ticket pendiente para ${o.toUpperCase()}, pero todavía no coincide el operador reportado. Abre la app correcta antes de despachar desde aquí.`),
                      (A = 'open'),
                      (T = `Abrir Operador ${o.toUpperCase()}`),
                      (M = v || h || k),
                      (E = M
                          ? `${M.ticketCode} · ${ti(M, 'waiting')}`
                          : 'Sin ticket pendiente'))
                    : !s && r
                      ? ((C = 'warning'),
                        (S = 'Operador en otra estación'),
                        (w = `${o.toUpperCase()} sin operador dedicado`),
                        (L = `El operador vivo no coincide con ${o.toUpperCase()}. Deja abierto el consultorio correcto antes de que vuelva a entrar cola.`),
                        (A = 'open'),
                        (T = `Abrir Operador ${o.toUpperCase()}`))
                      : s &&
                        r &&
                        ((C = 'ready'),
                        (S = 'Equipo listo'),
                        (w = `${o.toUpperCase()} preparado para el próximo ticket`),
                        (L = `No hay turno esperando ahora, pero ${o.toUpperCase()} ya tiene operador, numpad y heartbeat listos para absorber el siguiente ingreso.`),
                        (A = 'open'),
                        (T = `Abrir Operador ${o.toUpperCase()}`)),
        {
            slot: i,
            slotKey: o,
            state: C,
            badge: S,
            headline: w,
            detail: L,
            targetTicketId: Number(M?.id || 0),
            targetTicketCode: String(M?.ticketCode || ''),
            targetLabel: E,
            primaryAction: A,
            primaryLabel: T,
            operatorUrl: c,
            queueMixLabel: `${o.toUpperCase()} ${q} · General ${_}`,
            backlogLabel: `C${m} ${$} · Heartbeat ${p}`,
            chips: [l, u, d],
        }
    );
}
function Wi(e) {
    return 'call' === e.primaryAction
        ? {
              title: `Despacho ${e.slotKey.toUpperCase()}: llamado rápido`,
              summary: `${e.targetTicketCode} se llamó desde la tarjeta de despacho sugerido.`,
          }
        : 'assign' === e.primaryAction
          ? {
                title: `Despacho ${e.slotKey.toUpperCase()}: ticket tomado de cola general`,
                summary: `${e.targetTicketCode} se reasignó a ${e.slotKey.toUpperCase()} desde el hub.`,
            }
          : 'rebalance' === e.primaryAction
            ? {
                  title: `Despacho ${e.slotKey.toUpperCase()}: rebalanceo aplicado`,
                  summary: `${e.targetTicketCode} se movió a ${e.slotKey.toUpperCase()} para repartir la carga del turno.`,
              }
            : {
                  title: `Despacho ${e.slotKey.toUpperCase()}: operador abierto`,
                  summary: `Se abrió la ruta preparada de Operador ${e.slotKey.toUpperCase()} desde el hub.`,
              };
}
async function Ji(e, t, a, n = {}) {
    if (e && 'none' !== e.primaryAction)
        try {
            const { callNextForConsultorio: t, runQueueTicketAction: a } =
                await Promise.resolve().then(function () {
                    return Ts;
                });
            ('call' === e.primaryAction
                ? await t(e.slot)
                : ('assign' === e.primaryAction ||
                        'rebalance' === e.primaryAction) &&
                    e.targetTicketId > 0
                  ? await a(e.targetTicketId, 'reasignar', e.slot)
                  : 'open' === e.primaryAction &&
                    window.open(e.operatorUrl, '_blank', 'noopener'),
                un({
                    source:
                        'string' == typeof n.source && n.source
                            ? n.source
                            : 'dispatch',
                    tone: 'rebalance' === e.primaryAction ? 'warning' : 'info',
                    ...Wi(e),
                }));
        } catch (e) {
            s('No se pudo ejecutar el despacho sugerido', 'error');
        } finally {
            n.deferRerender || so(t, a);
        }
}
function Yi(t, a) {
    if (!(document.getElementById('queueDispatchDeck') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = [1, 2].map((a) => Gi(e, t, a)),
            n = a.filter((e) =>
                ['call', 'assign', 'rebalance'].includes(e.primaryAction)
            ).length,
            i = a.filter(
                (e) => 'warning' === e.state && 'open' === e.primaryAction
            ).length;
        return {
            title:
                n > 0
                    ? 'Despacho sugerido listo'
                    : i > 0
                      ? 'Despacho sugerido con bloqueos'
                      : 'Despacho sugerido estable',
            summary:
                n > 0
                    ? 'Aquí aparece la siguiente jugada útil por consultorio para llamar o mover tickets sin revisar toda la tabla.'
                    : i > 0
                      ? 'El hub detectó tickets movibles, pero aún falta operador o contexto para despacharlos con confianza.'
                      : 'No hay movimiento urgente: ambos consultorios están balanceados o sin cola pendiente.',
            statusLabel:
                n > 0
                    ? `${n} acción(es) recomendada(s)`
                    : i > 0
                      ? `${i} bloqueo(s) operativos`
                      : 'Sin movimiento urgente',
            statusState: n > 0 ? 'ready' : i > 0 ? 'warning' : 'idle',
            chips: [
                `Generales ${si().length}`,
                `Acciones ${n}`,
                `Bloqueos ${i}`,
            ],
            cards: a,
        };
    })(t, a);
    (l(
        '#queueDispatchDeck',
        `\n            <section class="queue-dispatch-deck__shell" data-state="${e(n.statusState)}">\n                <div class="queue-dispatch-deck__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Despacho sugerido</p>\n                        <h5 id="queueDispatchDeckTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueDispatchDeckSummary" class="queue-dispatch-deck__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-dispatch-deck__meta">\n                        <span\n                            id="queueDispatchDeckStatus"\n                            class="queue-dispatch-deck__status"\n                            data-state="${e(n.statusState)}"\n                        >\n                            ${e(n.statusLabel)}\n                        </span>\n                        <div class="queue-dispatch-deck__chips">\n                            ${n.chips.map((t) => `<span class="queue-dispatch-deck__chip">${e(t)}</span>`).join('')}\n                        </div>\n                    </div>\n                </div>\n                <div id="queueDispatchDeckCards" class="queue-dispatch-deck__grid" role="list" aria-label="Despacho sugerido por consultorio">\n                    ${n.cards.map((t) => `\n                                <article\n                                    id="queueDispatchCard_${e(t.slotKey)}"\n                                    class="queue-dispatch-card"\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-dispatch-card__header">\n                                        <div>\n                                            <strong>${e(t.slotKey.toUpperCase())}</strong>\n                                            <p id="queueDispatchHeadline_${e(t.slotKey)}" class="queue-dispatch-card__headline">${e(t.headline)}</p>\n                                        </div>\n                                        <span class="queue-dispatch-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <p id="queueDispatchDetail_${e(t.slotKey)}" class="queue-dispatch-card__detail">${e(t.detail)}</p>\n                                    <div class="queue-dispatch-card__facts">\n                                        <div class="queue-dispatch-card__fact">\n                                            <span>Ticket objetivo</span>\n                                            <strong id="queueDispatchTarget_${e(t.slotKey)}">${e(t.targetLabel)}</strong>\n                                        </div>\n                                        <div class="queue-dispatch-card__fact">\n                                            <span>Mix de cola</span>\n                                            <strong id="queueDispatchQueue_${e(t.slotKey)}">${e(t.queueMixLabel)}</strong>\n                                        </div>\n                                        <div class="queue-dispatch-card__fact">\n                                            <span>Contexto</span>\n                                            <strong id="queueDispatchBacklog_${e(t.slotKey)}">${e(t.backlogLabel)}</strong>\n                                        </div>\n                                    </div>\n                                    <div class="queue-dispatch-card__chips">\n                                        ${t.chips.map((t) => `<span class="queue-dispatch-card__chip">${e(t)}</span>`).join('')}\n                                    </div>\n                                    <div class="queue-dispatch-card__actions">\n                                        <button\n                                            id="queueDispatchPrimary_${e(t.slotKey)}"\n                                            type="button"\n                                            class="queue-dispatch-card__action queue-dispatch-card__action--primary"\n                                            data-queue-dispatch-action="${e(t.primaryAction)}"\n                                            data-queue-consultorio="${e(String(t.slot))}"\n                                            data-queue-ticket-id="${e(String(t.targetTicketId))}"\n                                            ${'none' === t.primaryAction ? 'disabled' : ''}\n                                        >\n                                            ${e(t.primaryLabel)}\n                                        </button>\n                                        <a\n                                            id="queueDispatchOpenOperator_${e(t.slotKey)}"\n                                            href="${e(t.operatorUrl)}"\n                                            class="queue-dispatch-card__action"\n                                            target="_blank"\n                                            rel="noopener"\n                                        >\n                                            Operador ${e(t.slotKey.toUpperCase())}\n                                        </a>\n                                    </div>\n                                </article>\n                            `).join('')}\n                </div>\n            </section>\n        `
    ),
        n.cards.forEach((e) => {
            const n = document.getElementById(
                `queueDispatchPrimary_${e.slotKey}`
            );
            n instanceof HTMLButtonElement &&
                (n.onclick = async () => {
                    ((n.disabled = !0), await Ji(e, t, a));
                });
        }));
}
function Zi(t, a) {
    if (!(document.getElementById('queueQuickConsole') instanceof HTMLElement))
        return;
    const n = (function (e, t) {
        const a = Wn(e),
            n = Ka(t),
            i = e.operator || ea.operator,
            o = e.kiosk || ea.kiosk,
            s = e.sala_tv || ea.sala_tv,
            r = _n('operator', i, { ...n }),
            l = _n('kiosk', o, { ...n }),
            c = _n('sala_tv', s, { ...n }),
            u = An(t),
            d = Tn(),
            p = Un(),
            m = [
                Va(t),
                p.badge,
                'closing' === a.effectiveMode
                    ? `Relevo ${d.suggestedCount}/${ma.length}`
                    : `Apertura ${u.suggestedCount}/${pa.length}`,
            ];
        return 'opening' === a.effectiveMode
            ? {
                  tone: 'opening',
                  title: 'Consola rápida: Apertura',
                  summary:
                      u.suggestedCount > 0
                          ? 'Confirma pasos sugeridos o abre cada superficie sin bajar al resto del panel. Ideal para dejar listo Operador, Kiosco y Sala TV en menos clics.'
                          : 'Abre cada superficie operativa o vuelve al checklist de apertura para completar las validaciones manuales pendientes.',
                  chips: m,
                  actions: [
                      {
                          id: 'queueQuickConsoleAction_opening_apply',
                          kind: 'button',
                          label:
                              u.suggestedCount > 0
                                  ? `Confirmar sugeridos (${u.suggestedCount})`
                                  : 'Sin sugeridos ahora',
                          variant: 'primary',
                      },
                      {
                          id: 'queueQuickConsoleAction_open_operator',
                          kind: 'anchor',
                          label: 'Abrir Operador',
                          href: r,
                          external: !0,
                      },
                      {
                          id: 'queueQuickConsoleAction_open_kiosk',
                          kind: 'anchor',
                          label: 'Abrir Kiosco',
                          href: l,
                          external: !0,
                      },
                      {
                          id: 'queueQuickConsoleAction_open_sala',
                          kind: 'anchor',
                          label: 'Abrir Sala TV',
                          href: c,
                          external: !0,
                      },
                  ],
              }
            : 'incidents' === a.effectiveMode
              ? {
                    tone: 'incidents',
                    title: 'Consola rápida: Incidencias',
                    summary:
                        'Enfoca refresh, contingencia y registro de incidencia sin perder tiempo buscando la acción correcta en todo el hub.',
                    chips: m,
                    actions: [
                        {
                            id: 'queueQuickConsoleAction_refresh',
                            kind: 'button',
                            label: 'Refrescar cola',
                            variant: 'primary',
                            action: 'queue-refresh-state',
                        },
                        {
                            id: 'queueQuickConsoleAction_incident_log',
                            kind: 'button',
                            label: 'Registrar incidencia',
                        },
                        {
                            id: 'queueQuickConsoleAction_open_contingency',
                            kind: 'anchor',
                            label: 'Ir a contingencias',
                            href: '#queueContingencyDeck',
                        },
                        {
                            id: 'queueQuickConsoleAction_open_log',
                            kind: 'anchor',
                            label: 'Ir a bitácora',
                            href: '#queueOpsLog',
                        },
                    ],
                }
              : 'closing' === a.effectiveMode
                ? {
                      tone: 'closing',
                      title: 'Consola rápida: Cierre',
                      summary:
                          d.suggestedCount > 0
                              ? 'Confirma el relevo sugerido, copia el resumen y deja a la vista las superficies críticas del cierre.'
                              : 'Abre operador o sala y remata el cierre del turno sin desplazarte por todos los bloques.',
                      chips: m,
                      actions: [
                          {
                              id: 'queueQuickConsoleAction_closing_apply',
                              kind: 'button',
                              label:
                                  d.suggestedCount > 0
                                      ? `Confirmar relevo (${d.suggestedCount})`
                                      : 'Sin relevo sugerido ahora',
                              variant: 'primary',
                          },
                          {
                              id: 'queueQuickConsoleAction_copy_handoff',
                              kind: 'button',
                              label: 'Copiar resumen de relevo',
                          },
                          {
                              id: 'queueQuickConsoleAction_open_operator_close',
                              kind: 'anchor',
                              label: 'Abrir Operador',
                              href: r,
                              external: !0,
                          },
                          {
                              id: 'queueQuickConsoleAction_open_sala_close',
                              kind: 'anchor',
                              label: 'Abrir Sala TV',
                              href: c,
                              external: !0,
                          },
                      ],
                  }
                : {
                      tone: 'operations',
                      title: 'Consola rápida: Operación',
                      summary:
                          'Llama el siguiente turno, refresca la cola o abre la superficie correcta sin saltar entre el header y el resto del hub.',
                      chips: m,
                      actions: [
                          {
                              id: 'queueQuickConsoleAction_call_c1',
                              kind: 'button',
                              label: 'Llamar C1',
                              variant: 'primary',
                              action: 'queue-call-next',
                              consultorio: 1,
                          },
                          {
                              id: 'queueQuickConsoleAction_call_c2',
                              kind: 'button',
                              label: 'Llamar C2',
                              action: 'queue-call-next',
                              consultorio: 2,
                          },
                          {
                              id: 'queueQuickConsoleAction_refresh_ops',
                              kind: 'button',
                              label: 'Refrescar cola',
                              action: 'queue-refresh-state',
                          },
                          {
                              id: 'queueQuickConsoleAction_open_operator_ops',
                              kind: 'anchor',
                              label: 'Abrir Operador',
                              href: r,
                              external: !0,
                          },
                      ],
                  };
    })(t, a);
    l(
        '#queueQuickConsole',
        `\n            <section class="queue-quick-console__shell" data-state="${e(n.tone)}">\n                <div class="queue-quick-console__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Consola rápida</p>\n                        <h5 id="queueQuickConsoleTitle" class="queue-app-card__title">${e(n.title)}</h5>\n                        <p id="queueQuickConsoleSummary" class="queue-quick-console__summary">${e(n.summary)}</p>\n                    </div>\n                    <div class="queue-quick-console__chips">\n                        ${n.chips.map((t, a) => `\n                                    <span\n                                        ${0 === a ? 'id="queueQuickConsoleChip"' : ''}\n                                        class="queue-quick-console__chip"\n                                    >\n                                        ${e(t)}\n                                    </span>\n                                `).join('')}\n                    </div>\n                </div>\n                <div id="queueQuickConsoleActions" class="queue-quick-console__actions">\n                    ${n.actions
            .map((t, a) =>
                (function (t, a) {
                    const n = String(t.id || `queueQuickConsoleAction_${a}`),
                        i =
                            'primary' === t.variant
                                ? 'queue-quick-console__action queue-quick-console__action--primary'
                                : 'queue-quick-console__action';
                    return 'anchor' === t.kind
                        ? `\n            <a\n                id="${e(n)}"\n                href="${e(t.href || '#queue')}"\n                class="${i}"\n                ${t.external ? 'target="_blank" rel="noopener"' : ''}\n            >\n                ${e(t.label || 'Abrir')}\n            </a>\n        `
                        : `\n        <button\n            id="${e(n)}"\n            type="button"\n            class="${i}"\n            ${t.action ? `data-action="${e(t.action)}"` : ''}\n            ${t.consultorio ? `data-queue-consultorio="${e(String(t.consultorio))}"` : ''}\n        >\n            ${e(t.label || 'Continuar')}\n        </button>\n    `;
                })(t, a)
            )
            .join(
                ''
            )}\n                </div>\n            </section>\n        `
    );
    const i = document.getElementById('queueQuickConsoleAction_opening_apply');
    i instanceof HTMLButtonElement &&
        ((i.disabled = An(a).suggestedCount <= 0),
        (i.onclick = () => {
            const e = An(a);
            e.suggestedIds.length &&
                (Za(e.suggestedIds),
                un({
                    tone: 'success',
                    source: 'opening',
                    title: `Apertura: ${e.suggestedIds.length} sugerido(s) confirmados`,
                    summary: `La consola rápida confirmó sugeridos de apertura. Perfil activo: ${Va(a)}.`,
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                jn(t, a),
                no(t, a),
                io(t, a),
                oo(t, a));
        }));
    const o = document.getElementById('queueQuickConsoleAction_incident_log');
    o instanceof HTMLButtonElement &&
        (o.onclick = () => {
            (un(En(t, a)), Zi(t, a), to(t, a), oo(t, a));
        });
    const s = document.getElementById('queueQuickConsoleAction_closing_apply');
    s instanceof HTMLButtonElement &&
        ((s.disabled = Tn().suggestedCount <= 0),
        (s.onclick = () => {
            const e = Tn();
            e.suggestedIds.length &&
                (nn(e.suggestedIds),
                un({
                    tone: 'success',
                    source: 'handoff',
                    title: `Relevo: ${e.suggestedIds.length} sugerido(s) confirmados`,
                    summary:
                        'La consola rápida confirmó el relevo sugerido del turno.',
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                io(t, a),
                oo(t, a));
        }));
    const r = document.getElementById('queueQuickConsoleAction_copy_handoff');
    r instanceof HTMLButtonElement &&
        (r.onclick = () => {
            Nn(a);
        });
}
function Xi(e, t) {
    const a = Wn(e),
        n = (function (e, t) {
            const a = Ka(t),
                n = e.operator || ea.operator,
                i = e.kiosk || ea.kiosk,
                o = e.sala_tv || ea.sala_tv;
            return {
                opening: [
                    {
                        id: 'opening_operator',
                        title: 'Abrir Operador',
                        detail: 'Verifica estación, lock y flujo base del equipo principal.',
                        href: _n('operator', n, { ...a }),
                        actionLabel: 'Abrir Operador',
                    },
                    {
                        id: 'opening_kiosk',
                        title: 'Validar Kiosco + térmica',
                        detail: 'Confirma ticket térmico, cola viva y contingencia offline limpia.',
                        href: _n('kiosk', i, { ...a }),
                        actionLabel: 'Abrir Kiosco',
                    },
                    {
                        id: 'opening_sala',
                        title: 'Validar Sala TV',
                        detail: 'Deja audio, campanilla y visualización listos en la TCL C655.',
                        href: _n('sala_tv', o, { ...a }),
                        actionLabel: 'Abrir Sala TV',
                    },
                ],
                operations: [
                    {
                        id: 'operations_monitor',
                        title: 'Monitorear equipos vivos',
                        detail: 'Revisa heartbeat, cola viva y estado general antes de seguir atendiendo.',
                        href: '#queueSurfaceTelemetry',
                        actionLabel: 'Ir a equipos',
                    },
                    {
                        id: 'operations_call',
                        title: 'Lanzar siguiente llamada',
                        detail: 'Usa C1/C2 o el operador actual para mover la cola con el menor roce posible.',
                        href: '#queueQuickConsole',
                        actionLabel: 'Ir a consola',
                    },
                    {
                        id: 'operations_log',
                        title: 'Registrar cambio importante',
                        detail: 'Si cambias perfil o detectas desvío, deja rastro en la bitácora operativa.',
                        href: '#queueOpsLog',
                        actionLabel: 'Ir a bitácora',
                    },
                ],
                incidents: [
                    {
                        id: 'incidents_refresh',
                        title: 'Refrescar y confirmar sync',
                        detail: 'Atiende primero fallback, retrasos y watchdog antes de tocar hardware.',
                        href: '#queueContingencyDeck',
                        actionLabel: 'Ir a contingencias',
                    },
                    {
                        id: 'incidents_surface',
                        title: 'Abrir el equipo afectado',
                        detail: 'Ve directo a Operador, Kiosco o Sala TV según la superficie que cayó.',
                        href: '#queueQuickConsole',
                        actionLabel: 'Ir a consola',
                    },
                    {
                        id: 'incidents_log',
                        title: 'Registrar incidencia',
                        detail: 'Deja en la bitácora qué falló, qué se hizo y qué queda pendiente.',
                        href: '#queueOpsLog',
                        actionLabel: 'Ir a bitácora',
                    },
                ],
                closing: [
                    {
                        id: 'closing_queue',
                        title: 'Confirmar cola limpia',
                        detail: 'No cierres si todavía hay tickets waiting o called.',
                        href: '#queueShiftHandoff',
                        actionLabel: 'Ir a relevo',
                    },
                    {
                        id: 'closing_surfaces',
                        title: 'Dejar superficies listas',
                        detail: 'Operador, Kiosco y Sala TV deben quedar claros para el siguiente turno.',
                        href: '#queueSurfaceTelemetry',
                        actionLabel: 'Ir a equipos',
                    },
                    {
                        id: 'closing_copy',
                        title: 'Copiar y cerrar relevo',
                        detail: 'Entrega un resumen textual corto del estado del turno.',
                        href: '#queueShiftHandoff',
                        actionLabel: 'Ir a resumen',
                    },
                ],
            };
        })(e, t),
        i = a.effectiveMode,
        o = n[i] || [],
        s = kn(),
        r = s.modes && 'object' == typeof s.modes[i] ? s.modes[i] : {},
        l = o.filter((e) => Boolean(r[e.id])).length,
        c = o.find((e) => !r[e.id]) || null,
        u = c
            ? `Paso actual: ${c.title}. ${c.detail}`
            : 'La secuencia de este modo ya quedó completa. Puedes reiniciarla o pasar al siguiente momento del turno.';
    return {
        mode: i,
        title: `Playbook activo: ${a.title.replace('Modo foco: ', '')}`,
        summary: u,
        steps: o,
        completedCount: l,
        totalSteps: o.length,
        nextStep: c,
        modeState: r,
    };
}
function eo(e, t) {
    const a = Xi(e, t),
        n = Ya(),
        i = an(),
        o = An(t),
        s = Tn(),
        r = Un(),
        l = Dn('operator'),
        c = Dn('kiosk'),
        u = Dn('display'),
        d = cn(),
        p = d.items.some((e) => 'incident' === e.source),
        m = d.items.some((e) => 'status' === e.source),
        g = {
            opening_operator: {
                suggested:
                    Boolean(n.steps.operator_ready) ||
                    Boolean(o.suggestions.operator_ready?.suggested),
                reason:
                    o.suggestions.operator_ready?.reason ||
                    'Operador todavía necesita validación explícita.',
            },
            opening_kiosk: {
                suggested:
                    Boolean(n.steps.kiosk_ready) ||
                    Boolean(o.suggestions.kiosk_ready?.suggested),
                reason:
                    o.suggestions.kiosk_ready?.reason ||
                    'Kiosco todavía necesita validación explícita.',
            },
            opening_sala: {
                suggested:
                    Boolean(n.steps.sala_ready) ||
                    Boolean(o.suggestions.sala_ready?.suggested),
                reason:
                    o.suggestions.sala_ready?.reason ||
                    'Sala TV todavía necesita validación explícita.',
            },
        },
        b =
            'ready' === l.status &&
            'unknown' !== c.status &&
            'ready' === u.status,
        f =
            'alert' === r.state ||
            [l, c, u].some((e) =>
                ['alert', 'warning', 'unknown'].includes(
                    String(e.status || '').toLowerCase()
                )
            ),
        y = {
            incidents_refresh: {
                suggested: 'alert' !== r.state,
                reason: r.summary,
            },
            incidents_surface: {
                suggested:
                    'unknown' !== l.status ||
                    'unknown' !== c.status ||
                    'unknown' !== u.status,
                reason: 'Al menos una superficie ya está reportando señal para investigar desde el equipo correcto.',
            },
            incidents_log: {
                suggested: p,
                reason: p
                    ? 'La bitácora ya tiene al menos una incidencia registrada.'
                    : 'Todavía no hay incidencia registrada en la bitácora.',
            },
        },
        v =
            (Boolean(i.steps.operator_handoff) ||
                Boolean(s.suggestions.operator_handoff?.suggested)) &&
            (Boolean(i.steps.kiosk_handoff) ||
                Boolean(s.suggestions.kiosk_handoff?.suggested)) &&
            (Boolean(i.steps.sala_handoff) ||
                Boolean(s.suggestions.sala_handoff?.suggested)),
        h = {
            closing_queue: {
                suggested:
                    Boolean(i.steps.queue_clear) ||
                    Boolean(s.suggestions.queue_clear?.suggested),
                reason:
                    s.suggestions.queue_clear?.reason ||
                    'La cola todavía necesita una validación final.',
            },
            closing_surfaces: {
                suggested: v,
                reason: v
                    ? 'Operador, Kiosco y Sala TV ya aparecen listos para el siguiente turno.'
                    : 'Todavía falta dejar una o más superficies listas para mañana.',
            },
            closing_copy: {
                suggested:
                    Boolean(i.steps.queue_clear) ||
                    (Boolean(s.suggestions.queue_clear?.suggested) && v),
                reason: 'Cuando cola y superficies quedan listas, conviene copiar el resumen final del relevo.',
            },
        },
        k =
            {
                opening: g,
                operations: {
                    operations_monitor: {
                        suggested: b,
                        reason: b
                            ? 'Las superficies ya reportan señal suficiente para operar con seguimiento.'
                            : 'Falta señal estable en alguna superficie antes de dar por monitoreo resuelto.',
                    },
                    operations_call: {
                        suggested:
                            'alert' !== r.state &&
                            'ready' === l.status &&
                            !l.stale,
                        reason: 'Llamar siguiente conviene cuando Operador está listo y la cola no está en fallback.',
                    },
                    operations_log: {
                        suggested: m,
                        reason: m
                            ? 'La bitácora ya tiene estado operativo o cambios recientes.'
                            : 'No hay estado operativo reciente en la bitácora.',
                    },
                },
                incidents: y,
                closing: h,
            }[a.mode] || {},
        q = a.steps
            .filter((e) => !a.modeState[e.id] && Boolean(k[e.id]?.suggested))
            .map((e) => e.id);
    return {
        suggestions: k,
        suggestedIds: q,
        suggestedCount: q.length,
        incidentOpen: f,
    };
}
function to(t, a) {
    const n = document.getElementById('queuePlaybook');
    if (!(n instanceof HTMLElement)) return;
    const o = Xi(t, a),
        r = eo(t, a);
    l(
        '#queuePlaybook',
        `\n            <section class="queue-playbook__shell" data-state="${e(o.mode)}">\n                <div class="queue-playbook__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Playbook activo</p>\n                        <h5 id="queuePlaybookTitle" class="queue-app-card__title">${e(o.title)}</h5>\n                        <p id="queuePlaybookSummary" class="queue-playbook__summary">${e(o.summary)}</p>\n                    </div>\n                    <div class="queue-playbook__meta">\n                        <span\n                            id="queuePlaybookChip"\n                            class="queue-playbook__chip"\n                            data-state="${o.completedCount >= o.totalSteps ? 'ready' : 'active'}"\n                        >\n                            ${e(o.completedCount >= o.totalSteps ? 'Secuencia completa' : `Paso ${Math.min(o.completedCount + 1, o.totalSteps)}/${o.totalSteps}`)}\n                        </span>\n                        <span\n                            id="queuePlaybookAssistChip"\n                            class="queue-playbook__assist"\n                            data-state="${r.suggestedCount > 0 ? 'suggested' : o.completedCount >= o.totalSteps ? 'ready' : 'idle'}"\n                        >\n                            ${e(r.suggestedCount > 0 ? `Sugeridos ${r.suggestedCount}` : o.completedCount >= o.totalSteps ? 'Rutina completa' : 'Sin sugeridos')}\n                        </span>\n                        <button\n                            id="queuePlaybookApplyBtn"\n                            type="button"\n                            class="queue-playbook__action queue-playbook__action--primary"\n                            ${o.nextStep ? '' : 'disabled'}\n                        >\n                            ${o.nextStep ? `Marcar: ${o.nextStep.title}` : 'Sin pasos pendientes'}\n                        </button>\n                        <button\n                            id="queuePlaybookAssistBtn"\n                            type="button"\n                            class="queue-playbook__action"\n                            ${r.suggestedCount > 0 ? '' : 'disabled'}\n                        >\n                            ${r.suggestedCount > 0 ? `Confirmar sugeridos (${r.suggestedCount})` : 'Sin sugeridos ahora'}\n                        </button>\n                        <button\n                            id="queuePlaybookCopyBtn"\n                            type="button"\n                            class="queue-playbook__action"\n                        >\n                            Copiar secuencia\n                        </button>\n                        <button\n                            id="queuePlaybookResetBtn"\n                            type="button"\n                            class="queue-playbook__action"\n                        >\n                            Reiniciar playbook\n                        </button>\n                    </div>\n                </div>\n                <div id="queuePlaybookSteps" class="queue-playbook__steps" role="list" aria-label="Secuencia operativa por foco">\n                    ${o.steps
            .map((t) => {
                const a = Boolean(o.modeState[t.id]),
                    n = !a && o.nextStep && o.nextStep.id === t.id,
                    i = !a && Boolean(r.suggestions[t.id]?.suggested),
                    s = a
                        ? 'ready'
                        : n
                          ? 'current'
                          : i
                            ? 'suggested'
                            : 'pending';
                return `\n                                <article class="queue-playbook__step" data-state="${s}" role="listitem">\n                                    <div class="queue-playbook__step-head">\n                                        <div>\n                                            <strong>${e(t.title)}</strong>\n                                            <p>${e(t.detail)}</p>\n                                        </div>\n                                        <span class="queue-playbook__step-state">${e(a ? 'Hecho' : n ? 'Actual' : i ? 'Sugerido' : 'Pendiente')}</span>\n                                    </div>\n                                    <p class="queue-playbook__step-note">${e(r.suggestions[t.id]?.reason || t.detail)}</p>\n                                    <div class="queue-playbook__step-actions">\n                                        <a\n                                            href="${e(t.href)}"\n                                            class="queue-playbook__step-primary"\n                                            ${String(t.href || '').startsWith('#') ? '' : 'target="_blank" rel="noopener"'}\n                                        >\n                                            ${e(t.actionLabel)}\n                                        </a>\n                                        <button\n                                            id="queuePlaybookToggle_${e(t.id)}"\n                                            type="button"\n                                            class="queue-playbook__step-toggle"\n                                            data-queue-playbook-step="${e(t.id)}"\n                                            data-state="${s}"\n                                        >\n                                            ${a ? 'Marcar pendiente' : 'Marcar hecho'}\n                                        </button>\n                                    </div>\n                                </article>\n                            `;
            })
            .join(
                ''
            )}\n                </div>\n            </section>\n        `
    );
    const c = document.getElementById('queuePlaybookApplyBtn');
    c instanceof HTMLButtonElement &&
        (c.onclick = () => {
            o.nextStep &&
                (qn(o.mode, o.nextStep.id, !0),
                un({
                    tone: 'info',
                    source: 'status',
                    title: `Playbook ${o.mode}: paso confirmado`,
                    summary: `${o.nextStep.title} quedó marcado como hecho desde el playbook activo.`,
                }),
                to(t, a),
                oo(t, a));
        });
    const u = document.getElementById('queuePlaybookAssistBtn');
    u instanceof HTMLButtonElement &&
        (u.onclick = () => {
            r.suggestedIds.length &&
                (r.suggestedIds.forEach((e) => {
                    qn(o.mode, e, !0);
                }),
                un({
                    tone: 'success',
                    source: 'status',
                    title: `Playbook ${o.mode}: sugeridos confirmados`,
                    summary: `Se confirmaron ${r.suggestedIds.length} paso(s) sugeridos por señales del sistema.`,
                }),
                to(t, a),
                oo(t, a));
        });
    const d = document.getElementById('queuePlaybookCopyBtn');
    d instanceof HTMLButtonElement &&
        (d.onclick = () => {
            !(async function (e, t) {
                try {
                    (await navigator.clipboard.writeText(
                        (function (e, t) {
                            const a = Xi(e, t),
                                n = eo(e, t);
                            return [
                                `${a.title} - ${i(new Date().toISOString())}`,
                                `Progreso: ${a.completedCount}/${a.totalSteps}`,
                                `Sugeridos actuales: ${n.suggestedCount}`,
                                ...a.steps.map(
                                    (e) =>
                                        `${Boolean(a.modeState[e.id]) ? '[x]' : '[ ]'} ${e.title} - ${e.detail}`
                                ),
                            ].join('\n');
                        })(e, t)
                    ),
                        s('Playbook copiado', 'success'));
                } catch (e) {
                    s('No se pudo copiar el playbook', 'error');
                }
            })(t, a);
        });
    const p = document.getElementById('queuePlaybookResetBtn');
    (p instanceof HTMLButtonElement &&
        (p.onclick = () => {
            (!(function (e) {
                const t = kn(),
                    a =
                        'opening' === e ||
                        'operations' === e ||
                        'incidents' === e ||
                        'closing' === e
                            ? e
                            : 'operations';
                hn({ ...t, modes: { ...t.modes, [a]: {} } });
            })(o.mode),
                un({
                    tone: 'warning',
                    source: 'status',
                    title: `Playbook ${o.mode}: reiniciado`,
                    summary:
                        'La secuencia del modo activo se reinició para volver a guiar el flujo desde el primer paso.',
                }),
                to(t, a),
                oo(t, a));
        }),
        n.querySelectorAll('[data-queue-playbook-step]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = String(e.dataset.queuePlaybookStep || ''),
                        i = !o.modeState[n];
                    (qn(o.mode, n, i), to(t, a));
                });
        }));
}
function ao(t, a) {
    if (
        !(
            document.getElementById('queueContingencyDeck') instanceof
            HTMLElement
        )
    )
        return;
    const { syncHealth: n, cards: i } = (function (e, t) {
            const a = Ka(t),
                n = e.operator || ea.operator,
                i = e.kiosk || ea.kiosk,
                o = e.sala_tv || ea.sala_tv,
                s = Un(),
                r = 'c2' === a.station ? 'C2' : 'C1',
                l = a.lock ? `${r} fijo` : 'modo libre',
                c = _n('operator', n, { ...a }),
                u = _n('kiosk', i, { ...a }),
                d = _n('sala_tv', o, { ...a });
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
                            { type: 'copy', url: c, label: 'Copiar ruta' },
                            {
                                type: 'link',
                                href: Ha('operator', a, n),
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
                            { type: 'copy', url: u, label: 'Copiar ruta' },
                            {
                                type: 'link',
                                href: Ha('kiosk', a, i),
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
                                href: Ha('sala_tv', a, o),
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
        `\n            <section class="queue-contingency-deck__shell">\n                <div class="queue-contingency-deck__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Contingencia rápida</p>\n                        <h5 id="queueContingencyTitle" class="queue-app-card__title">${e(o)}</h5>\n                        <p id="queueContingencySummary" class="queue-contingency-deck__summary">${e(s)}</p>\n                    </div>\n                    <span\n                        id="queueContingencyStatus"\n                        class="queue-contingency-deck__status"\n                        data-state="${e(n.state)}"\n                    >\n                        ${e(n.badge)}\n                    </span>\n                </div>\n                <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">\n                    ${i
            .map(
                (t) =>
                    `\n                                <article\n                                    class="queue-contingency-card"\n                                    ${'sync_issue' === t.id ? 'id="queueContingencySyncCard"' : ''}\n                                    data-state="${e(t.state)}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-contingency-card__header">\n                                        <div>\n                                            <strong>${e(t.title)}</strong>\n                                            <p class="queue-contingency-card__summary">${e(t.summary)}</p>\n                                        </div>\n                                        <span class="queue-contingency-card__badge">${e(t.badge)}</span>\n                                    </div>\n                                    <ul class="queue-contingency-card__steps">\n                                        ${t.steps.map((t) => `<li>${e(t)}</li>`).join('')}\n                                    </ul>\n                                    <div class="queue-contingency-card__actions">\n                                        ${t.actions
                        .map((a, n) =>
                            (function (t, a, n) {
                                const i = e(a.label || 'Abrir'),
                                    o = a.primary
                                        ? 'queue-contingency-card__action queue-contingency-card__action--primary'
                                        : 'queue-contingency-card__action';
                                return 'button' === a.type
                                    ? `\n            <button\n                type="button"\n                class="${o}"\n                data-action="${e(a.action || '')}"\n                data-queue-contingency-card="${e(t)}"\n                data-queue-contingency-action-index="${e(String(n))}"\n            >\n                ${i}\n            </button>\n        `
                                    : 'copy' === a.type
                                      ? `\n            <button\n                type="button"\n                class="${o}"\n                data-action="queue-copy-install-link"\n                data-queue-install-url="${e(a.url || '')}"\n                data-queue-contingency-card="${e(t)}"\n                data-queue-contingency-action-index="${e(String(n))}"\n            >\n                ${i}\n            </button>\n        `
                                      : `\n        <a\n            href="${e(a.href || '/')}"\n            class="${o}"\n            ${a.external ? 'target="_blank" rel="noopener"' : ''}\n        >\n            ${i}\n        </a>\n    `;
                            })(t.id, a, n)
                        )
                        .join(
                            ''
                        )}\n                                    </div>\n                                </article>\n                            `
            )
            .join(
                ''
            )}\n                </div>\n            </section>\n        `
    );
}
function no(t, a) {
    const n = document.getElementById('queueOpeningChecklist');
    if (!(n instanceof HTMLElement)) return;
    const i = Ya(),
        o = wn(t, a),
        s = An(a),
        r = o.filter((e) => i.steps[e.id]).length,
        c = o.filter(
            (e) => !i.steps[e.id] && Boolean(s.suggestions[e.id]?.suggested)
        ).length,
        u = o.length - r,
        d =
            u <= 0
                ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
                : c > 0
                  ? `${c} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
                  : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';
    (l(
        '#queueOpeningChecklist',
        `\n            <section class="queue-opening-checklist__shell">\n                <div class="queue-opening-checklist__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Apertura diaria</p>\n                        <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${e(u <= 0 ? 'Apertura diaria lista' : c > 0 ? 'Apertura diaria asistida' : r <= 0 ? 'Apertura diaria pendiente' : `Apertura diaria: faltan ${u} paso(s)`)}</h5>\n                        <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${e(d)}</p>\n                    </div>\n                    <div class="queue-opening-checklist__meta">\n                        <span\n                            id="queueOpeningChecklistAssistChip"\n                            class="queue-opening-checklist__assist"\n                            data-state="${c > 0 ? 'suggested' : u <= 0 ? 'ready' : 'idle'}"\n                        >\n                            ${e(c > 0 ? `Sugeridos ${c}` : u <= 0 ? 'Checklist completo' : `Confirmados ${r}/${o.length}`)}\n                        </span>\n                        <button\n                            id="queueOpeningChecklistApplyBtn"\n                            type="button"\n                            class="queue-opening-checklist__apply"\n                            ${c > 0 ? '' : 'disabled'}\n                        >\n                            ${c > 0 ? `Confirmar sugeridos (${c})` : 'Sin sugeridos todavía'}\n                        </button>\n                        <button\n                            id="queueOpeningChecklistResetBtn"\n                            type="button"\n                            class="queue-opening-checklist__reset"\n                        >\n                            Reiniciar apertura de hoy\n                        </button>\n                        <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">\n                            ${e(
            (function (e) {
                const t = String(e || '').trim(),
                    a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
                return a ? `${a[3]}/${a[2]}/${a[1]}` : t || '--';
            })(i.date)
        )}\n                        </span>\n                    </div>\n                </div>\n                <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">\n                    ${o
            .map((t) => {
                const a = Boolean(i.steps[t.id]),
                    n = !a && Boolean(s.suggestions[t.id]?.suggested),
                    o = a ? 'ready' : n ? 'suggested' : 'pending',
                    r = a ? 'Confirmado' : n ? 'Sugerido' : 'Pendiente',
                    l = String(s.suggestions[t.id]?.reason || t.hint);
                return `\n                                <article\n                                    class="queue-opening-step"\n                                    data-state="${o}"\n                                    role="listitem"\n                                >\n                                    <div class="queue-opening-step__header">\n                                        <div>\n                                            <strong>${e(t.title)}</strong>\n                                            <p class="queue-opening-step__detail">${e(t.detail)}</p>\n                                        </div>\n                                        <span class="queue-opening-step__state">\n                                            ${e(r)}\n                                        </span>\n                                    </div>\n                                    <p class="queue-opening-step__hint">${e(t.hint)}</p>\n                                    <p class="queue-opening-step__evidence">${e(l)}</p>\n                                    <div class="queue-opening-step__actions">\n                                        <a\n                                            href="${e(t.href)}"\n                                            target="_blank"\n                                            rel="noopener"\n                                            class="queue-opening-step__primary"\n                                        >\n                                            ${e(t.actionLabel)}\n                                        </a>\n                                        <button\n                                            id="queueOpeningToggle_${e(t.id)}"\n                                            type="button"\n                                            class="queue-opening-step__toggle"\n                                            data-queue-opening-step="${e(t.id)}"\n                                            data-state="${o}"\n                                        >\n                                            ${a ? 'Marcar pendiente' : n ? 'Confirmar sugerido' : 'Marcar listo'}\n                                        </button>\n                                    </div>\n                                </article>\n                            `;
            })
            .join(
                ''
            )}\n                </div>\n            </section>\n        `
    ),
        n.querySelectorAll('[data-queue-opening-step]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = String(e.dataset.queueOpeningStep || '');
                    (!(function (e, t) {
                        const a = Ya();
                        pa.includes(e) &&
                            Ja({
                                ...a,
                                steps: { ...a.steps, [e]: Boolean(t) },
                            });
                    })(n, !Ya().steps[n]),
                        Jn(t, a),
                        Zi(t, a),
                        to(t, a),
                        jn(t, a),
                        no(t, a),
                        io(t, a));
                });
        }));
    const p = document.getElementById('queueOpeningChecklistApplyBtn');
    p instanceof HTMLButtonElement &&
        (p.onclick = () => {
            s.suggestedIds.length &&
                (Za(s.suggestedIds),
                un({
                    tone: 'success',
                    source: 'opening',
                    title: `Apertura: ${s.suggestedIds.length} sugerido(s) confirmados`,
                    summary: `El checklist de apertura quedó actualizado usando telemetría reciente. Perfil activo: ${Va(a)}.`,
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                jn(t, a),
                no(t, a),
                io(t, a),
                oo(t, a));
        });
    const m = document.getElementById('queueOpeningChecklistResetBtn');
    m instanceof HTMLButtonElement &&
        (m.onclick = () => {
            (Ja(Ga(Qa())),
                un({
                    tone: 'warning',
                    source: 'opening',
                    title: 'Apertura reiniciada',
                    summary:
                        'Se limpiaron las confirmaciones de apertura del día para volver a validar operador, kiosco, sala y smoke final.',
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                jn(t, a),
                no(t, a),
                io(t, a),
                oo(t, a));
        });
}
function io(t, a) {
    const n = document.getElementById('queueShiftHandoff');
    if (!(n instanceof HTMLElement)) return;
    const i = an(),
        o = (function (e, t) {
            const a = Ka(t),
                n = e.operator || ea.operator,
                i = e.kiosk || ea.kiosk,
                o = e.sala_tv || ea.sala_tv;
            return [
                {
                    id: 'queue_clear',
                    title: 'Cola sin tickets activos',
                    detail: 'Confirma que no quedan pacientes en espera ni llamados activos antes de cerrar el turno.',
                    hint: 'No cierres el día si aún hay tickets `waiting` o `called`.',
                    href: '/admin.html#queue',
                    actionLabel: 'Abrir cola admin',
                },
                {
                    id: 'operator_handoff',
                    title: 'Operador listo para relevo',
                    detail: 'Deja visible el perfil activo, valida el numpad y entrega el equipo sin dejar dudas de estación o modo.',
                    hint: 'El PC operador debe quedar identificable para el siguiente turno.',
                    href: _n('operator', n, { ...a }),
                    actionLabel: 'Abrir operador',
                },
                {
                    id: 'kiosk_handoff',
                    title: 'Kiosco sin pendientes offline',
                    detail: 'Verifica que el kiosco no tenga tickets pendientes por sincronizar y que el autoservicio pueda reabrirse limpio.',
                    hint: 'Si hay pendientes offline, no cierres sin sincronizar o anotar la contingencia.',
                    href: _n('kiosk', i, { ...a }),
                    actionLabel: 'Abrir kiosco',
                },
                {
                    id: 'sala_handoff',
                    title: 'Sala TV lista para mañana',
                    detail: 'Deja la TCL C655 identificable, con audio visible y sin mute para la siguiente apertura.',
                    hint: 'Una TV sin mute o fuera de foreground complica el arranque del siguiente turno.',
                    href: _n('sala_tv', o, { ...a }),
                    actionLabel: 'Abrir sala TV',
                },
            ];
        })(t, a),
        s = Tn(),
        r = o.filter((e) => i.steps[e.id]).length,
        c = o.filter(
            (e) => !i.steps[e.id] && Boolean(s.suggestions[e.id]?.suggested)
        ).length,
        u = o.length - r,
        d =
            u <= 0
                ? 'Relevo listo'
                : s.suggestions.queue_clear?.suggested
                  ? c > 0
                      ? 'Cierre y relevo asistido'
                      : `Cierre: faltan ${u} paso(s)`
                  : 'No cierres todavía',
        p =
            u <= 0
                ? 'El relevo quedó documentado para hoy y la cola ya está sin pendientes visibles.'
                : s.suggestions.queue_clear?.suggested
                  ? c > 0
                      ? `${c} paso(s) de relevo ya aparecen listos por telemetría. Copia el resumen o confirma sugeridos para cerrar más rápido.`
                      : 'Ya no hay tickets activos. Termina las comprobaciones de equipos para dejar el siguiente turno más claro.'
                  : String(
                        s.suggestions.queue_clear?.reason ||
                            'La cola todavía tiene actividad.'
                    );
    l(
        '#queueShiftHandoff',
        `\n            <section class="queue-shift-handoff__shell">\n                <div class="queue-shift-handoff__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Cierre y relevo</p>\n                        <h5 id="queueShiftHandoffTitle" class="queue-app-card__title">${e(d)}</h5>\n                        <p id="queueShiftHandoffSummary" class="queue-shift-handoff__summary">${e(p)}</p>\n                    </div>\n                    <div class="queue-shift-handoff__meta">\n                        <span\n                            id="queueShiftHandoffAssistChip"\n                            class="queue-shift-handoff__assist"\n                            data-state="${c > 0 ? 'suggested' : u <= 0 ? 'ready' : 'idle'}"\n                        >\n                            ${e(c > 0 ? `Sugeridos ${c}` : u <= 0 ? 'Relevo completo' : `Confirmados ${r}/${o.length}`)}\n                        </span>\n                        <button\n                            id="queueShiftHandoffCopyBtn"\n                            type="button"\n                            class="queue-shift-handoff__copy"\n                        >\n                            Copiar resumen de relevo\n                        </button>\n                        <button\n                            id="queueShiftHandoffApplyBtn"\n                            type="button"\n                            class="queue-shift-handoff__apply"\n                            ${c > 0 ? '' : 'disabled'}\n                        >\n                            ${c > 0 ? `Confirmar sugeridos (${c})` : 'Sin sugeridos todavía'}\n                        </button>\n                        <button\n                            id="queueShiftHandoffResetBtn"\n                            type="button"\n                            class="queue-shift-handoff__reset"\n                        >\n                            Reiniciar relevo de hoy\n                        </button>\n                    </div>\n                </div>\n                <div class="queue-shift-handoff__summary-box">\n                    <pre id="queueShiftHandoffPreview" class="queue-shift-handoff__preview">${e(Mn(a))}</pre>\n                </div>\n                <div id="queueShiftHandoffSteps" class="queue-shift-handoff__steps" role="list" aria-label="Checklist de cierre y relevo">\n                    ${o
            .map((t) => {
                const a = Boolean(i.steps[t.id]),
                    n = !a && Boolean(s.suggestions[t.id]?.suggested),
                    o = a ? 'ready' : n ? 'suggested' : 'pending',
                    r = a ? 'Confirmado' : n ? 'Sugerido' : 'Pendiente',
                    l = String(s.suggestions[t.id]?.reason || t.hint);
                return `\n                                <article class="queue-shift-step" data-state="${o}" role="listitem">\n                                    <div class="queue-shift-step__header">\n                                        <div>\n                                            <strong>${e(t.title)}</strong>\n                                            <p class="queue-shift-step__detail">${e(t.detail)}</p>\n                                        </div>\n                                        <span class="queue-shift-step__state">${e(r)}</span>\n                                    </div>\n                                    <p class="queue-shift-step__hint">${e(t.hint)}</p>\n                                    <p class="queue-shift-step__evidence">${e(l)}</p>\n                                    <div class="queue-shift-step__actions">\n                                        <a\n                                            href="${e(t.href)}"\n                                            target="_blank"\n                                            rel="noopener"\n                                            class="queue-shift-step__primary"\n                                        >\n                                            ${e(t.actionLabel)}\n                                        </a>\n                                        <button\n                                            id="queueShiftToggle_${e(t.id)}"\n                                            type="button"\n                                            class="queue-shift-step__toggle"\n                                            data-queue-shift-step="${e(t.id)}"\n                                            data-state="${o}"\n                                        >\n                                            ${a ? 'Marcar pendiente' : n ? 'Confirmar sugerido' : 'Marcar listo'}\n                                        </button>\n                                    </div>\n                                </article>\n                            `;
            })
            .join(
                ''
            )}\n                </div>\n            </section>\n        `
    );
    const m = document.getElementById('queueShiftHandoffCopyBtn');
    m instanceof HTMLButtonElement &&
        (m.onclick = () => {
            Nn(a);
        });
    const g = document.getElementById('queueShiftHandoffApplyBtn');
    g instanceof HTMLButtonElement &&
        (g.onclick = () => {
            s.suggestedIds.length &&
                (nn(s.suggestedIds),
                un({
                    tone: 'success',
                    source: 'handoff',
                    title: `Relevo: ${s.suggestedIds.length} sugerido(s) confirmados`,
                    summary:
                        'El cierre del día quedó marcado con pasos validados por telemetría para operador, kiosco y sala.',
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                io(t, a),
                oo(t, a));
        });
    const b = document.getElementById('queueShiftHandoffResetBtn');
    (b instanceof HTMLButtonElement &&
        (b.onclick = () => {
            (tn(Xa(Qa())),
                un({
                    tone: 'warning',
                    source: 'handoff',
                    title: 'Relevo reiniciado',
                    summary:
                        'Se limpiaron las marcas de cierre del día para rehacer el relevo con estado fresco.',
                }),
                Jn(t, a),
                Zi(t, a),
                to(t, a),
                io(t, a),
                oo(t, a));
        }),
        n.querySelectorAll('[data-queue-shift-step]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = String(e.dataset.queueShiftStep || '');
                    (!(function (e, t) {
                        const a = an();
                        ma.includes(e) &&
                            tn({
                                ...a,
                                steps: { ...a.steps, [e]: Boolean(t) },
                            });
                    })(n, !an().steps[n]),
                        Jn(t, a),
                        Zi(t, a),
                        to(t, a),
                        io(t, a));
                });
        }));
}
function oo(t, a) {
    const n = document.getElementById('queueOpsLog');
    if (!(n instanceof HTMLElement)) return;
    const o = cn(),
        r =
            (va ||
                (va = (function () {
                    try {
                        return dn(localStorage.getItem(ra));
                    } catch (e) {
                        return 'all';
                    }
                })()),
            va),
        c = (function (e, t) {
            const a = Array.isArray(e) ? e : [];
            return 'incidents' === t
                ? a.filter(
                      (e) =>
                          'incident' === e.source ||
                          'warning' === e.tone ||
                          'alert' === e.tone
                  )
                : 'changes' === t
                  ? a.filter((e) =>
                        [
                            'config',
                            'opening',
                            'handoff',
                            'dispatch',
                            'ticket_simulation',
                            'next_turns',
                        ].includes(e.source)
                    )
                  : 'status' === t
                    ? a.filter((e) => 'status' === e.source)
                    : a;
        })(o.items, r),
        u = o.items[0] || null,
        d = u
            ? `${u.title}. ${u.summary} Vista actual: ${Bn(r)}.`
            : 'Todavía no hay eventos guardados hoy. Registra el estado actual, una incidencia o deja rastro del relevo sin salir del admin.',
        p =
            o.items.length > 0
                ? `${o.items.length} evento(s) hoy`
                : 'Sin eventos',
        m = u
            ? 'alert' === u.tone
                ? 'alert'
                : 'warning' === u.tone
                  ? 'warning'
                  : 'ready'
            : 'idle';
    l(
        '#queueOpsLog',
        `\n            <section class="queue-ops-log__shell">\n                <div class="queue-ops-log__header">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Bitácora operativa</p>\n                        <h5 id="queueOpsLogTitle" class="queue-app-card__title">Bitácora operativa del día</h5>\n                        <p id="queueOpsLogSummary" class="queue-ops-log__summary">${e(d)}</p>\n                        <div class="queue-ops-log__filters" role="tablist" aria-label="Filtro de bitácora">\n                            <button\n                                id="queueOpsLogFilterAll"\n                                type="button"\n                                class="queue-ops-log__filter"\n                                data-filter="all"\n                                data-state="${'all' === r ? 'active' : 'idle'}"\n                            >\n                                Todo\n                            </button>\n                            <button\n                                id="queueOpsLogFilterIncidents"\n                                type="button"\n                                class="queue-ops-log__filter"\n                                data-filter="incidents"\n                                data-state="${'incidents' === r ? 'active' : 'idle'}"\n                            >\n                                Incidencias\n                            </button>\n                            <button\n                                id="queueOpsLogFilterChanges"\n                                type="button"\n                                class="queue-ops-log__filter"\n                                data-filter="changes"\n                                data-state="${'changes' === r ? 'active' : 'idle'}"\n                            >\n                                Cambios\n                            </button>\n                            <button\n                                id="queueOpsLogFilterStatus"\n                                type="button"\n                                class="queue-ops-log__filter"\n                                data-filter="status"\n                                data-state="${'status' === r ? 'active' : 'idle'}"\n                            >\n                                Estados\n                            </button>\n                        </div>\n                    </div>\n                    <div class="queue-ops-log__meta">\n                        <span\n                            id="queueOpsLogChip"\n                            class="queue-ops-log__chip"\n                            data-state="${e(m)}"\n                        >\n                            ${e(p)}\n                        </span>\n                        <button\n                            id="queueOpsLogStatusBtn"\n                            type="button"\n                            class="queue-ops-log__action queue-ops-log__action--primary"\n                        >\n                            Registrar estado actual\n                        </button>\n                        <button\n                            id="queueOpsLogIncidentBtn"\n                            type="button"\n                            class="queue-ops-log__action"\n                        >\n                            Registrar incidencia actual\n                        </button>\n                        <button\n                            id="queueOpsLogCopyBtn"\n                            type="button"\n                            class="queue-ops-log__action"\n                        >\n                            Copiar bitácora\n                        </button>\n                        <button\n                            id="queueOpsLogClearBtn"\n                            type="button"\n                            class="queue-ops-log__action"\n                        >\n                            Limpiar bitácora de hoy\n                        </button>\n                    </div>\n                </div>\n                <div id="queueOpsLogItems" class="queue-ops-log__list" role="list" aria-label="Bitácora operativa">\n                    ${
            c.length > 0
                ? c
                      .map(
                          (t) =>
                              `\n                                        <article class="queue-ops-log__item" data-state="${e(t.tone)}" role="listitem">\n                                            <div class="queue-ops-log__item-head">\n                                                <div class="queue-ops-log__item-copy">\n                                                    <strong>${e(t.title)}</strong>\n                                                    <span class="queue-ops-log__source">${e(
                                  (function (e) {
                                      const t = String(e || '')
                                          .trim()
                                          .toLowerCase();
                                      return 'incident' === t
                                          ? 'Incidencia'
                                          : 'config' === t
                                            ? 'Configuración'
                                            : 'opening' === t
                                              ? 'Apertura'
                                              : 'handoff' === t
                                                ? 'Relevo'
                                                : 'status' === t
                                                  ? 'Estado'
                                                  : 'dispatch' === t
                                                    ? 'Despacho'
                                                    : 'ticket_simulation' === t
                                                      ? 'Simulación'
                                                      : 'next_turns' === t
                                                        ? 'Próximos turnos'
                                                        : 'Manual';
                                  })(t.source)
                              )}</span>\n                                                </div>\n                                                <span>${e(i(t.createdAt))}</span>\n                                            </div>\n                                            <p>${e(t.summary)}</p>\n                                        </article>\n                                    `
                      )
                      .join('')
                : `\n                                <article class="queue-ops-log__empty" role="listitem">\n                                    <strong>Sin eventos para este filtro</strong>\n                                    <p>No hay registros en ${e(Bn(r).toLowerCase())} hoy. Cambia el filtro o registra un estado/incidencia nueva.</p>\n                                </article>\n                            `
        }\n                </div>\n            </section>\n        `
    );
    const g = document.getElementById('queueOpsLogStatusBtn');
    g instanceof HTMLButtonElement &&
        (g.onclick = () => {
            (un(
                (function (e, t) {
                    const a = In(e, t),
                        n = Un(),
                        i = Ya(),
                        o = an(),
                        s = pa.filter((e) => i.steps[e]).length,
                        r = ma.filter((e) => o.steps[e]).length;
                    return {
                        tone:
                            'alert' === n.state
                                ? 'alert'
                                : a.issueCount > 0
                                  ? 'warning'
                                  : 'success',
                        source: 'status',
                        title: 'Estado actual registrado',
                        summary: `${a.title}. Apertura ${s}/${pa.length}, cierre ${r}/${ma.length}, equipos listos ${a.readyEquipmentCount}/3, sync ${n.title.toLowerCase()}, perfil ${Va(t)}.`,
                    };
                })(t, a)
            ),
                oo(t, a));
        });
    const b = document.getElementById('queueOpsLogIncidentBtn');
    b instanceof HTMLButtonElement &&
        (b.onclick = () => {
            (un(En(t, a)), oo(t, a));
        });
    const f = document.getElementById('queueOpsLogCopyBtn');
    f instanceof HTMLButtonElement &&
        (f.onclick = () => {
            !(async function (e) {
                try {
                    (await navigator.clipboard.writeText(
                        (function (e) {
                            const t = cn(),
                                a = t.items.length
                                    ? t.items.map(
                                          (e) =>
                                              `${i(e.createdAt)} · ${e.title}\n${e.summary}`
                                      )
                                    : ['Sin eventos registrados hoy.'];
                            return [
                                `Bitácora Turnero Sala - ${i(new Date().toISOString())}`,
                                `Perfil actual: ${Va(e)}.`,
                                '',
                                ...a,
                            ].join('\n\n');
                        })(e)
                    ),
                        s('Bitácora operativa copiada', 'success'));
                } catch (e) {
                    s('No se pudo copiar la bitácora operativa', 'error');
                }
            })(a);
        });
    const y = document.getElementById('queueOpsLogClearBtn');
    (y instanceof HTMLButtonElement &&
        (y.onclick = () => {
            (ln(on(Qa())), oo(t, a));
        }),
        n.querySelectorAll('[data-filter]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    (!(function (e) {
                        va = dn(e);
                        try {
                            localStorage.setItem(ra, va);
                        } catch (e) {}
                    })(e.dataset.filter || 'all'),
                        oo(t, a));
                });
        }));
}
function so(e, t) {
    (Jn(e, t),
        ei(e, t),
        mi(e, t),
        fi(e, t),
        hi(e, t),
        wi(e, t),
        Ai(e, t),
        Ti(e, t),
        Bi(e, t),
        Ii(e, t),
        ji(e, t),
        Di(e, t),
        Oi(),
        Ui(e, t),
        Qi(e, t),
        Yi(e, t),
        Zi(e, t),
        to(e, t),
        jn(e, t),
        Fn(e, t),
        Gn(e, t),
        ao(e, t),
        no(e, t),
        io(e, t),
        oo(e, t),
        ro(e, t),
        Ba(),
        Ia());
}
function ro(t, a) {
    const n = document.getElementById('queueInstallConfigurator');
    if (!(n instanceof HTMLElement)) return;
    const i = Ka(a),
        o =
            'kiosk' === i.surface || 'sala_tv' === i.surface
                ? i.surface
                : 'operator',
        s = t[o];
    if (!s) return void (n.innerHTML = '');
    const r =
            'sala_tv' === o
                ? 'android_tv'
                : 'mac' === i.platform
                  ? 'mac'
                  : 'win',
        c = (s.targets && s.targets[r]) || $n(s, a) || null,
        u = _n(o, s, i),
        d = Oa(('sala_tv' === o && c && c.url) || u),
        p = Ha(o, i, s),
        m = (function (e) {
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
        })(i)
            .map((t) => `<li>${e(t)}</li>`)
            .join('');
    (l(
        '#queueInstallConfigurator',
        `\n            <div class="queue-install-configurator__grid">\n                <section class="queue-install-configurator__panel">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Preparar equipo</p>\n                        <h5 class="queue-app-card__title">Asistente de instalación</h5>\n                        <p class="queue-app-card__description">\n                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.\n                        </p>\n                    </div>\n                    <div class="queue-install-configurator__presets" role="group" aria-label="Perfiles rápidos de instalación">\n                        ${za(
            a
        )
            .map(
                (t) =>
                    `\n                <button\n                    id="queueInstallPreset_${e(t.id)}"\n                    type="button"\n                    class="queue-install-preset-btn"\n                    data-queue-install-preset="${e(t.id)}"\n                    data-state="${t.state ? 'active' : 'idle'}"\n                >\n                    ${e(t.label)}\n                </button>\n            `
            )
            .join(
                ''
            )}\n                    </div>\n                    <div class="queue-install-configurator__fields">\n                        <label class="queue-install-field" for="queueInstallSurfaceSelect">\n                            <span>Equipo</span>\n                            <select id="queueInstallSurfaceSelect">\n                                <option value="operator"${'operator' === o ? ' selected' : ''}>Operador</option>\n                                <option value="kiosk"${'kiosk' === o ? ' selected' : ''}>Kiosco</option>\n                                <option value="sala_tv"${'sala_tv' === o ? ' selected' : ''}>Sala TV</option>\n                            </select>\n                        </label>\n                        ${'operator' === o ? `\n                                    <label class="queue-install-field" for="queueInstallProfileSelect">\n                                        <span>Perfil operador</span>\n                                        <select id="queueInstallProfileSelect">\n                                            <option value="c1_locked"${i.lock && 'c1' === i.station ? ' selected' : ''}>C1 fijo</option>\n                                            <option value="c2_locked"${i.lock && 'c2' === i.station ? ' selected' : ''}>C2 fijo</option>\n                                            <option value="free"${i.lock ? '' : ' selected'}>Modo libre</option>\n                                        </select>\n                                    </label>\n                                ` : ''}\n                        ${'sala_tv' !== o ? `\n                                    <label class="queue-install-field" for="queueInstallPlatformSelect">\n                                        <span>Plataforma</span>\n                                        <select id="queueInstallPlatformSelect">\n                                            <option value="win"${'win' === i.platform ? ' selected' : ''}>Windows</option>\n                                            <option value="mac"${'mac' === i.platform ? ' selected' : ''}>macOS</option>\n                                        </select>\n                                    </label>\n                                ` : ''}\n                        ${'operator' === o ? `\n                                    <label class="queue-install-toggle">\n                                        <input id="queueInstallOneTapInput" type="checkbox"${i.oneTap ? ' checked' : ''} />\n                                        <span>Activar 1 tecla para este operador</span>\n                                    </label>\n                                ` : ''}\n                    </div>\n                </section>\n                <section class="queue-install-configurator__panel queue-install-configurator__result">\n                    <div>\n                        <p class="queue-app-card__eyebrow">Resultado listo</p>\n                        <h5 class="queue-app-card__title">${e(
            (function (e) {
                return 'sala_tv' === e.surface
                    ? 'Sala TV lista para TCL C655'
                    : 'kiosk' === e.surface
                      ? 'Kiosco listo para mostrador'
                      : e.lock
                        ? `Operador ${'c2' === e.station ? 'C2' : 'C1'} fijo`
                        : 'Operador en modo libre';
            })(i)
        )}</h5>\n                        <p class="queue-app-card__description">\n                            ${'sala_tv' === o ? 'Usa el APK para la TV y mantén el fallback web como respaldo.' : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'}\n                        </p>\n                    </div>\n                    <div class="queue-install-result__chips">\n                        <span class="queue-app-card__tag">\n                            ${e(c && c.label ? c.label : 'Perfil listo')}\n                        </span>\n                        ${'operator' === o ? `<span class="queue-app-card__tag">${i.lock ? ('c2' === i.station ? 'C2 bloqueado' : 'C1 bloqueado') : 'Modo libre'}</span>` : ''}\n                    </div>\n                    <div class="queue-install-result__meta">\n                        <span>Descarga recomendada</span>\n                        <strong>${e((c && c.url) || 'Sin artefacto')}</strong>\n                    </div>\n                    <div class="queue-install-result__meta">\n                        <span>Ruta web preparada</span>\n                        <strong>${e(u)}</strong>\n                    </div>\n                    <div class="queue-install-configurator__actions">\n                        ${c && c.url ? `<a href="${e(c.url)}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>` : ''}\n                        <button\n                            type="button"\n                            data-action="queue-copy-install-link"\n                            data-queue-install-url="${e(Da((c && c.url) || ''))}"\n                        >\n                            Copiar descarga\n                        </button>\n                        <a href="${e(u)}" target="_blank" rel="noopener">\n                            Abrir ruta preparada\n                        </a>\n                        <button\n                            type="button"\n                            data-action="queue-copy-install-link"\n                            data-queue-install-url="${e(u)}"\n                        >\n                            Copiar ruta preparada\n                        </button>\n                        <a href="${e(d)}" target="_blank" rel="noopener">\n                            Mostrar QR\n                        </a>\n                        <a href="${e(p)}" target="_blank" rel="noopener">\n                            Abrir centro público\n                        </a>\n                    </div>\n                    <ul class="queue-app-card__notes">${m}</ul>\n                </section>\n            </div>\n        `
    ),
        n.querySelectorAll('[data-queue-install-preset]').forEach((e) => {
            e instanceof HTMLButtonElement &&
                (e.onclick = () => {
                    const n = za(a).find(
                        (t) => t.id === e.dataset.queueInstallPreset
                    );
                    n &&
                        (Ua(n.nextPreset, a),
                        un({
                            tone: 'info',
                            source: 'config',
                            title: `Preset rápido: ${n.label}`,
                            summary: `${Va(a)}. El asistente ya quedó listo con este perfil.`,
                        }),
                        so(t, a));
                });
        }));
    const g = document.getElementById('queueInstallSurfaceSelect');
    g instanceof HTMLSelectElement &&
        (g.onchange = () => {
            (Ua({ ...i, surface: g.value }, a), so(t, a));
        });
    const b = document.getElementById('queueInstallProfileSelect');
    b instanceof HTMLSelectElement &&
        (b.onchange = () => {
            (Ua(
                {
                    ...i,
                    station: 'c2_locked' === b.value ? 'c2' : 'c1',
                    lock: 'free' !== b.value,
                },
                a
            ),
                un({
                    tone: 'info',
                    source: 'config',
                    title: 'Perfil operativo ajustado',
                    summary: `${Va(a)}. La ruta preparada ya quedó alineada para descarga y fallback.`,
                }),
                so(t, a));
        });
    const f = document.getElementById('queueInstallPlatformSelect');
    f instanceof HTMLSelectElement &&
        (f.onchange = () => {
            (Ua({ ...i, platform: 'mac' === f.value ? 'mac' : 'win' }, a),
                so(t, a));
        });
    const y = document.getElementById('queueInstallOneTapInput');
    y instanceof HTMLInputElement &&
        (y.onchange = () => {
            (Ua({ ...i, oneTap: y.checked }, a),
                un({
                    tone: y.checked ? 'info' : 'warning',
                    source: 'config',
                    title: y.checked
                        ? 'Modo 1 tecla activado'
                        : 'Modo 1 tecla desactivado',
                    summary: `${Va(a)}. Ajuste guardado en el preparador de rutas operativas.`,
                }),
                so(t, a));
        });
}
function lo(e = {}) {
    const {
        allowDuringInteraction: t = !1,
        manifestOverride: a = null,
        platformOverride: n = '',
    } = e || {};
    if (
        !(
            document.getElementById('queueAppDownloadsCards') instanceof
            HTMLElement
        )
    )
        return;
    const i = Ea();
    i &&
        (function (e) {
            if (
                !(e instanceof HTMLElement) ||
                'true' === e.dataset.queueInteractionBound
            )
                return;
            const t = () => {
                ((Ca.lastAt = Date.now()), Ba(), Ia());
            };
            (e.addEventListener('pointerdown', t, !0),
                e.addEventListener('keydown', t, !0),
                e.addEventListener('focusin', t, !0),
                e.addEventListener('input', t, !0),
                e.addEventListener('change', t, !0),
                (e.dataset.queueInteractionBound = 'true'));
        })(i);
    const o = 'mac' === n || 'win' === n || 'other' === n ? n : Sa(),
        s = document.getElementById('queueAppsPlatformChip');
    (r(
        '#queueAppsPlatformChip',
        'mac' === o
            ? 'macOS detectado'
            : 'win' === o
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo'
    ),
        s instanceof HTMLElement && s.setAttribute('data-platform', o));
    const c =
        a && 'object' == typeof a
            ? a
            : (function () {
                  const e = g().data.appDownloads;
                  return e && 'object' == typeof e
                      ? {
                            operator: {
                                ...ea.operator,
                                ...(e.operator || {}),
                                targets: {
                                    ...ea.operator.targets,
                                    ...((e.operator && e.operator.targets) ||
                                        {}),
                                },
                            },
                            kiosk: {
                                ...ea.kiosk,
                                ...(e.kiosk || {}),
                                targets: {
                                    ...ea.kiosk.targets,
                                    ...((e.kiosk && e.kiosk.targets) || {}),
                                },
                            },
                            sala_tv: {
                                ...ea.sala_tv,
                                ...(e.sala_tv || {}),
                                targets: {
                                    ...ea.sala_tv.targets,
                                    ...((e.sala_tv && e.sala_tv.targets) || {}),
                                },
                            },
                        }
                      : ea;
              })();
    !t && i && 'true' === i.dataset.queueHubReady && ja()
        ? Ra(c, o)
        : (xa(),
          l(
              '#queueAppDownloadsCards',
              [
                  Cn('operator', c.operator, o),
                  Cn('kiosk', c.kiosk, o),
                  Sn(c.sala_tv),
              ].join('')
          ),
          Jn(c, o),
          ei(c, o),
          mi(c, o),
          fi(c, o),
          hi(c, o),
          wi(c, o),
          Ai(c, o),
          Ti(c, o),
          Bi(c, o),
          Ii(c, o),
          ji(c, o),
          Di(c, o),
          Oi(),
          Ui(c, o),
          Qi(c, o),
          Yi(c, o),
          Zi(c, o),
          to(c, o),
          jn(c, o),
          Fn(c, o),
          Gn(c, o),
          ao(c, o),
          no(c, o),
          io(c, o),
          oo(c, o),
          ro(c, o),
          i && (i.dataset.queueHubReady = 'true'),
          Ba(),
          Ia());
}
function co(t = () => {}) {
    const a = g(),
        { queueMeta: n } = Kt(),
        i = Vt(),
        o = Qt(),
        s = Gt(),
        c = Jt(a.queue.stationConsultorio);
    (lo(),
        (function (e, t) {
            const a = g();
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
                    const t = $t(e, 1),
                        a = $t(e, 2),
                        n = _t(t),
                        i = _t(a);
                    (r('#queueC1Now', n),
                        r('#queueC2Now', i),
                        Ct('queueReleaseC1', 1, t, n),
                        Ct('queueReleaseC2', 2, a, i));
                })(e),
                (function (e, t, a) {
                    const n = document.getElementById('queueSyncStatus');
                    if ('fallback' === St(e.queue.syncMode))
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
                            e !== Bt &&
                            ((Bt = e),
                            a('Watchdog de cola: realtime en reconnecting'))
                        );
                    }
                    Bt = 'live';
                })(a, e, t));
        })(n, t),
        (function (e) {
            l(
                '#queueTableBody',
                e.length
                    ? e.map(Xt).join('')
                    : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
            );
        })(i),
        (function (t, a) {
            const n = At(t.nextTickets),
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
                                'appt_overdue' === St(e.priorityClass))
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
                                    : Jt(n);
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
        ht());
}
function uo(e) {
    b((t) => {
        const a = [
            { at: new Date().toISOString(), message: String(e || '') },
            ...(t.queue.activity || []),
        ].slice(0, 30);
        return { ...t, queue: { ...t.queue, activity: a } };
    });
    try {
        ht();
    } catch (e) {}
}
function po(e, { render: t = !0 } = {}) {
    (b((t) => ({
        ...t,
        queue: { ...t.queue, selected: zt(e, t.data.queueTickets || []) },
    })),
        t && co(uo));
}
function mo(e) {
    const t = Number(e || 0);
    if (!t) return;
    const a = zt(g().queue.selected || []);
    po(a.includes(t) ? a.filter((e) => e !== t) : [...a, t]);
}
function go() {
    po(Vt().map((e) => Number(e.id || 0)));
}
function bo() {
    po([]);
}
function fo(e, t = '') {
    try {
        const a = localStorage.getItem(e);
        return null === a ? t : a;
    } catch (e) {
        return t;
    }
}
function yo(e, t) {
    try {
        localStorage.setItem(e, String(t));
    } catch (e) {}
}
function vo(e, t) {
    try {
        const a = localStorage.getItem(e);
        return a ? JSON.parse(a) : t;
    } catch (e) {
        return t;
    }
}
function ho(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
function ko(e) {
    try {
        return new URL(window.location.href).searchParams.get(e) || '';
    } catch (e) {
        return '';
    }
}
const qo = 'queueStationMode',
    $o = 'queueStationConsultorio',
    _o = 'queueOneTapAdvance',
    Co = 'queueCallKeyBindingV1',
    So = 'queueNumpadHelpOpen',
    wo = 'queueAdminLastSnapshot',
    Lo = new Map([
        [1, !1],
        [2, !1],
    ]),
    Ao = new Set(['no_show', 'cancelar']);
function To(e) {
    (yo(qo, e.queue.stationMode || 'free'),
        yo($o, e.queue.stationConsultorio || 1),
        yo(_o, e.queue.oneTap ? '1' : '0'),
        yo(So, e.queue.helpOpen ? '1' : '0'),
        e.queue.customCallKey
            ? ho(Co, e.queue.customCallKey)
            : (function (e) {
                  try {
                      localStorage.removeItem(e);
                  } catch (e) {}
              })(Co),
        ho(wo, {
            queueMeta: e.data.queueMeta,
            queueTickets: e.data.queueTickets,
            updatedAt: new Date().toISOString(),
        }));
}
function Mo(e, t = null, a = {}) {
    const n = (Array.isArray(e) ? e : []).map((e, t) => It(e, t)),
        i = Rt(t && 'object' == typeof t ? t : Nt(n), n),
        o = n.filter((e) => 'waiting' === e.status).length,
        s =
            'boolean' == typeof a.fallbackPartial
                ? a.fallbackPartial
                : Number(i.waitingCount || 0) > o,
        r =
            'fallback' === St(a.syncMode)
                ? 'fallback'
                : s
                  ? 'live' === St(a.syncMode)
                      ? 'live'
                      : 'fallback'
                  : 'live',
        l = Boolean(a.bumpRuntimeRevision),
        c = l ? Date.now() : 0;
    (b((e) => ({
        ...e,
        data: { ...e.data, queueTickets: n, queueMeta: i },
        queue: {
            ...e.queue,
            selected: zt(e.queue.selected || [], n),
            runtimeRevision: l
                ? Number(e.queue.runtimeRevision || 0) + 1
                : Number(e.queue.runtimeRevision || 0),
            lastRuntimeMutationAt: l
                ? c
                : Number(e.queue.lastRuntimeMutationAt || 0),
            fallbackPartial: s,
            syncMode: r,
        },
    })),
        To(g()),
        co(uo));
}
function Eo(e, t) {
    const a = Number(e || 0),
        n = (g().data.queueTickets || []).map((e, n) => {
            const i = It(e, n);
            return i.id !== a
                ? i
                : It('function' == typeof t ? t(i) : { ...i }, n);
        });
    Mo(n, Nt(n), {
        fallbackPartial: !1,
        syncMode: 'live',
        bumpRuntimeRevision: !0,
    });
}
function Bo(e) {
    (b((t) => ({ ...t, queue: { ...t.queue, ...e } })), To(g()), co(uo));
}
function No(e) {
    Bo({ filter: St(e) || 'all', selected: [] });
}
function Io(e) {
    Bo({ search: String(e || ''), selected: [] });
}
function Po() {
    Bo({ search: '', selected: [] });
    const e = document.getElementById('queueSearchInput');
    e instanceof HTMLInputElement && (e.value = '');
}
var jo = Object.freeze({
    __proto__: null,
    appendActivity: uo,
    clearQueueSearch: Po,
    clearQueueSelection: bo,
    mutateTicketLocal: Eo,
    selectVisibleQueueTickets: go,
    setQueueFilter: No,
    setQueueSearch: Io,
    setQueueSelection: po,
    setQueueStateWithTickets: Mo,
    toggleQueueTicketSelection: mo,
    updateQueueUi: Bo,
});
function xo(e, t) {
    const a = Et(t.createdAt, t.created_at, e?.createdAt, e?.created_at),
        n = Et(
            t.priorityClass,
            t.priority_class,
            e?.priorityClass,
            e?.priority_class,
            'walk_in'
        ),
        i = Et(
            t.queueType,
            t.queue_type,
            e?.queueType,
            e?.queue_type,
            'walk_in'
        ),
        o = Et(
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
function Ro(e, t = {}) {
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
    const i = (g().data.queueTickets || []).map((e, t) => It(e, t)),
        o = a.__fullTickets || [];
    if (
        !(function (e, t, a) {
            return (
                t.length > 0 ||
                !!(
                    Dt(e, 'queue_tickets') ||
                    Dt(e, 'queueTickets') ||
                    Dt(e, 'tickets')
                ) ||
                !(!a || 'object' != typeof a) ||
                !!(function (e) {
                    return (
                        Dt(e, 'waitingCount') ||
                        Dt(e, 'waiting_count') ||
                        Dt(e, 'calledCount') ||
                        Dt(e, 'called_count') ||
                        Dt(e, 'completedCount') ||
                        Dt(e, 'completed_count') ||
                        Dt(e, 'noShowCount') ||
                        Dt(e, 'no_show_count') ||
                        Dt(e, 'cancelledCount') ||
                        Dt(e, 'cancelled_count')
                    );
                })(e) ||
                !!(function (e) {
                    const t = Ot(e);
                    return Boolean(
                        t &&
                        (Dt(t, 'waiting') ||
                            Dt(t, 'called') ||
                            Dt(t, 'completed') ||
                            Dt(t, 'no_show') ||
                            Dt(t, 'noShow') ||
                            Dt(t, 'cancelled') ||
                            Dt(t, 'canceled'))
                    );
                })(e) ||
                !(!Dt(e, 'nextTickets') && !Dt(e, 'next_tickets')) ||
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
                        At(e?.callingNow)
                            .concat(At(e?.calling_now))
                            .some(Boolean)
                    );
                })(e)
            );
        })(a, o, n)
    )
        return;
    const s = 'fallback' === St(t.syncMode) ? 'fallback' : 'live',
        r = Rt(a, i),
        l = (function (e) {
            const t = Ot(e),
                a =
                    Dt(e, 'waitingCount') ||
                    Dt(e, 'waiting_count') ||
                    Boolean(t && Dt(t, 'waiting')),
                n =
                    Dt(e, 'calledCount') ||
                    Dt(e, 'called_count') ||
                    Boolean(t && Dt(t, 'called')),
                i = Dt(e, 'nextTickets') || Dt(e, 'next_tickets'),
                o =
                    Dt(e, 'callingNowByConsultorio') ||
                    Dt(e, 'calling_now_by_consultorio') ||
                    Dt(e, 'callingNow') ||
                    Dt(e, 'calling_now');
            return { waiting: a || i, called: n || o };
        })(a),
        c = Ut(r),
        u = Boolean(n && 'object' == typeof n);
    if (!(o.length || c.length || u || l.waiting || l.called)) return;
    const d =
        Number(r.waitingCount || 0) >
        c.filter((e) => 'waiting' === e.status).length;
    if (o.length)
        return void Mo(o, r, {
            fallbackPartial: !1,
            syncMode: s,
            bumpRuntimeRevision: Boolean(t.bumpRuntimeRevision),
        });
    const p = new Map(i.map((e) => [Ht(e), e]));
    ((function (e, t, a) {
        const n = t.callingNowByConsultorio || {},
            i = Number(t.calledCount || t.counts?.called || 0),
            o = Number(t.waitingCount || t.counts?.waiting || 0),
            s = At(t.nextTickets),
            r = (function (e) {
                const t = new Set(),
                    a = e[1] || e[1] || null,
                    n = e[2] || e[2] || null;
                return (a && t.add(Ht(a)), n && t.add(Ht(n)), t);
            })(n),
            l = new Set(s.map((e) => Ht(e))),
            c = r.size > 0 || 0 === i,
            u = l.size > 0 || 0 === o,
            d = l.size > 0 && o > l.size;
        for (const [t, n] of e.entries()) {
            const i = It(n, 0);
            a.called && c && 'called' === i.status && !r.has(t)
                ? e.set(
                      t,
                      It(
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
        Mo(
            (function (e, t, a) {
                for (const a of t) {
                    const t = Ht(a),
                        n = e.get(t) || null;
                    e.set(t, It(xo(n, a), e.size));
                }
                if (a && 'object' == typeof a) {
                    const t = Ht(It(a, e.size)),
                        n = e.get(t) || null;
                    e.set(
                        t,
                        It(
                            (function (e, t) {
                                return { ...(e || {}), ...It(t, 0) };
                            })(n, a),
                            e.size
                        )
                    );
                }
                return Array.from(e.values());
            })(p, c, n),
            r,
            {
                fallbackPartial: d,
                syncMode: s,
                bumpRuntimeRevision: Boolean(t.bumpRuntimeRevision),
            }
        ));
}
function Do() {
    return vo(wo, null);
}
function Oo(e, t = '') {
    return (
        !!e?.queueTickets?.length &&
        (Mo(e.queueTickets, e.queueMeta || null, {
            fallbackPartial: !0,
            syncMode: 'fallback',
        }),
        t && uo(t),
        !0)
    );
}
async function Ho() {
    try {
        (Ro(await _('queue-state'), { syncMode: 'live' }),
            uo('Queue refresh realizado'));
    } catch (e) {
        (uo('Queue refresh con error'), Oo(Do()));
    }
}
async function Fo() {
    const e = Array.isArray(g().data.queueTickets)
            ? g().data.queueTickets.map((e, t) => It(e, t))
            : [],
        t = (function (e) {
            return g().data.queueMeta && 'object' == typeof g().data.queueMeta
                ? Rt(g().data.queueMeta, e)
                : null;
        })(e);
    e.length
        ? Mo(e, t || null, { fallbackPartial: !1, syncMode: 'live' })
        : (function (e) {
              const t = e ? Ut(e) : [];
              return (
                  !!t.length &&
                  (Mo(t, e, { fallbackPartial: !0, syncMode: 'fallback' }),
                  uo('Queue fallback parcial desde metadata'),
                  !0)
              );
          })(t) ||
          (await Ho(),
          (g().data.queueTickets || []).length ||
              Oo(Do(), 'Queue fallback desde snapshot local') ||
              Mo([], null, { fallbackPartial: !1, syncMode: 'live' }));
}
const Uo = 'appointments',
    Ko = 'callbacks',
    Vo = 'reviews',
    zo = 'availability',
    Qo = 'availability-meta',
    Go = 'queue-tickets',
    Wo = 'queue-meta',
    Jo = 'leadops-meta',
    Yo = 'queue-surface-status',
    Zo = 'app-downloads',
    Xo = 'health-status',
    es = {
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
function ts() {
    return {
        appointments: vo(Uo, []),
        callbacks: vo(Ko, []),
        reviews: vo(Vo, []),
        availability: vo(zo, {}),
        availabilityMeta: vo(Qo, {}),
        queueTickets: vo(Go, []),
        queueMeta: vo(Wo, null),
        leadOpsMeta: vo(Jo, null),
        queueSurfaceStatus: vo(Yo, null),
        appDownloads: vo(Zo, null),
        health: vo(Xo, null),
        funnelMetrics: es,
    };
}
function as(e) {
    return Array.isArray(e.queue_tickets)
        ? e.queue_tickets
        : Array.isArray(e.queueTickets)
          ? e.queueTickets
          : [];
}
function ns(e) {
    const t = new Date(e || '').getTime();
    return Number.isFinite(t) ? t : 0;
}
function is(e, t = {}) {
    let a = !1;
    return (
        b((n) => {
            const i = (function (e, t) {
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
            })(e, n.data.funnelMetrics);
            return (
                (a = (function (e, t, a = {}) {
                    const n = Number(a.queueRuntimeRevision ?? -1),
                        i = Number(e.queue?.runtimeRevision || 0);
                    if (n >= 0 && i !== n) return !0;
                    const o = ns(
                            e.data?.queueMeta?.updatedAt ||
                                e.data?.queueMeta?.updated_at
                        ),
                        s = ns(
                            t.queueMeta?.updatedAt || t.queueMeta?.updated_at
                        );
                    return o > 0 && s > 0 && o > s;
                })(n, i, t)),
                {
                    ...n,
                    data: {
                        ...n.data,
                        ...i,
                        queueTickets: a ? n.data.queueTickets : i.queueTickets,
                        queueMeta: a ? n.data.queueMeta : i.queueMeta,
                    },
                    ui: { ...n.ui, lastRefreshAt: Date.now() },
                }
            );
        }),
        { preservedQueueData: a }
    );
}
function os() {
    const e = g(),
        t = Number(e.ui.lastRefreshAt || 0);
    if (!t) return 'Datos: sin sincronizar';
    const a = Math.max(0, Math.round((Date.now() - t) / 1e3));
    return a < 60 ? `Datos: hace ${a}s` : `Datos: hace ${Math.round(a / 60)}m`;
}
async function ss(e) {
    if (e.funnelMetrics) return e.funnelMetrics;
    const t = await _('funnel-metrics').catch(() => null);
    return t?.data || null;
}
async function rs() {
    const e = Number(g().queue?.runtimeRevision || 0);
    try {
        const [t, a] = await Promise.all([
                _('data'),
                _('health').catch(() => null),
            ]),
            n = t.data || {},
            i = ts(),
            o = (function (e, t, a) {
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
                    queueTickets: as(e),
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
            })({ ...n, funnelMetrics: await ss(n) }, a, i),
            { preservedQueueData: s } = is(o, { queueRuntimeRevision: e });
        return (
            (function (e) {
                (ho(Uo, e.appointments || []),
                    ho(Ko, e.callbacks || []),
                    ho(Vo, e.reviews || []),
                    ho(zo, e.availability || {}),
                    ho(Qo, e.availabilityMeta || {}),
                    ho(Go, e.queueTickets || []),
                    ho(Wo, e.queueMeta || null),
                    ho(Jo, e.leadOpsMeta || null),
                    ho(Yo, e.queueSurfaceStatus || null),
                    ho(Zo, e.appDownloads || null),
                    ho(Xo, e.health || null));
            })(o),
            { ok: !0, preservedQueueData: s }
        );
    } catch (e) {
        return (is(ts()), { ok: !1, preservedQueueData: !1 });
    }
}
let ls = !1,
    cs = !1;
function us() {
    if ('undefined' != typeof window) {
        const e = Number(window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__);
        if (Number.isFinite(e) && e > 0) return Math.max(50, Math.round(e));
    }
    return 45e3;
}
function ds(e) {
    b((t) => ({
        ...t,
        ui: {
            ...t.ui,
            queueAutoRefresh: {
                state: 'idle',
                reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
                intervalMs: us(),
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
function ps() {
    const e = g();
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
async function ms(e = 'timer') {
    const t = ps(),
        a = us();
    if (!t.active)
        return (
            ds({
                state: t.state,
                reason: t.reason,
                intervalMs: a,
                inFlight: !1,
            }),
            !1
        );
    if (cs) return !1;
    ((cs = !0),
        ds({
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
        const e = await rs(),
            t = Boolean(e?.ok),
            n = Boolean(e?.preservedQueueData);
        return (
            n || (await Fo()),
            ds({
                state: t ? 'active' : 'warning',
                reason: t
                    ? n
                        ? 'Auto-refresh activo; se preservó la cola local por una operación reciente.'
                        : 'Auto-refresh activo en esta sección.'
                    : 'Sincronización degradada: usando cache local.',
                intervalMs: a,
                lastSuccessAt: Date.now(),
                inFlight: !1,
                lastError: t ? '' : 'cache_local',
            }),
            t &&
                n &&
                uo(
                    'Auto-refresh preservó la cola local después de una operación reciente'
                ),
            co(),
            (function () {
                const e = os();
                (r('#adminRefreshStatus', e),
                    r(
                        '#adminSyncState',
                        'Datos: sin sincronizar' === e
                            ? 'Listo para primera sincronizacion'
                            : e.replace('Datos: ', 'Estado: ')
                    ));
            })(),
            t
        );
    } catch (e) {
        return (
            ds({
                state: 'warning',
                reason: 'No se pudo refrescar Equipos en vivo. Revisa red local o fuerza una actualización manual.',
                intervalMs: a,
                inFlight: !1,
                lastError: e?.message || 'refresh_failed',
            }),
            'queue' === g().ui?.activeSection && co(),
            !1
        );
    } finally {
        cs = !1;
    }
}
function gs(e = {}) {
    const { immediate: t = !1, reason: a = 'sync' } = e,
        n = ps(),
        i = us();
    return (
        ds({ state: n.state, reason: n.reason, intervalMs: i, inFlight: cs }),
        'queue' === g().ui?.activeSection && co(),
        t && n.active ? (ms(a), !0) : n.active
    );
}
function bs() {
    'visible' !== document.visibilityState ? gs() : ms('visibility');
}
function fs() {
    ('undefined' != typeof document && 'hidden' === document.visibilityState) ||
        ('queue' === g().ui?.activeSection && ms('focus'));
}
function ys() {
    'queue' === g().ui?.activeSection && ms('online');
}
function vs(e, t, a = void 0) {
    Eo(e, (e) => ({
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
async function hs({ ticketId: e, action: t, consultorio: a }) {
    const n = Number(e || 0),
        i = Lt(t);
    if (n && i)
        return g().queue.practiceMode
            ? ((function (e, t, a) {
                  'reasignar' !== t && 're-llamar' !== t
                      ? 'liberar' !== t
                          ? 'completar' !== t
                              ? 'no_show' !== t
                                  ? 'cancelar' === t && vs(e, 'cancelled')
                                  : vs(e, 'no_show')
                              : vs(e, 'completed')
                          : vs(e, 'waiting', null)
                      : vs(e, 'called', 2 === Number(a || 1) ? 2 : 1);
              })(n, i, a),
              void uo(`Practica: accion ${i} en ticket ${n}`))
            : (Ro(
                  await _('queue-ticket', {
                      method: 'PATCH',
                      body: { id: n, action: i, consultorio: Number(a || 0) },
                  }),
                  { syncMode: 'live', bumpRuntimeRevision: !0 }
              ),
              void uo(`Accion ${i} ticket ${n}`));
}
async function ks(e) {
    const t = 2 === Number(e || 0) ? 2 : 1,
        a = g();
    if (!Lo.get(t)) {
        if (
            'locked' === a.queue.stationMode &&
            a.queue.stationConsultorio !== t
        )
            return (
                uo(`Llamado bloqueado para C${t} por lock de estacion`),
                void s('Modo bloqueado: consultorio no permitido', 'warning')
            );
        if (a.queue.practiceMode) {
            const e = Yt(t);
            return e
                ? ((function (e, t) {
                      Eo(e, (e) => ({
                          ...e,
                          status: 'called',
                          assignedConsultorio: t,
                          calledAt: new Date().toISOString(),
                      }));
                  })(e.id, t),
                  void uo(`Practica: llamado ${e.ticketCode} en C${t}`))
                : void uo('Practica: sin tickets en espera');
        }
        Lo.set(t, !0);
        try {
            (Ro(
                await _('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: t },
                }),
                { syncMode: 'live', bumpRuntimeRevision: !0 }
            ),
                uo(`Llamado C${t} ejecutado`));
        } catch (e) {
            (uo(`Error llamando siguiente en C${t}`),
                s(`Error llamando siguiente en C${t}`, 'error'));
        } finally {
            Lo.set(t, !1);
        }
    }
}
async function qs(e, t, a = 0) {
    const n = {
            ticketId: Number(e || 0),
            action: Lt(t),
            consultorio: Number(a || 0),
        },
        i = g(),
        o = Wt(n.ticketId);
    if (
        !i.queue.practiceMode &&
        Ao.has(n.action) &&
        (function (e, t) {
            const a = Lt(e);
            return (
                'cancelar' === a ||
                ('no_show' === a &&
                    (!t ||
                        'called' === wt(t.status) ||
                        Number(t.assignedConsultorio || 0) > 0))
            );
        })(n.action, o)
    )
        return (kt(n), void uo(`Accion ${n.action} pendiente de confirmacion`));
    await hs(n);
}
async function $s(e) {
    const t = 2 === Number(e || 0) ? 2 : 1,
        a = Jt(t);
    a
        ? await qs(a.id, 'liberar', t)
        : uo(`Sin ticket activo para liberar en C${t}`);
}
async function _s() {
    const e = g().queue.pendingSensitiveAction;
    e ? (qt(), await hs(e)) : qt();
}
function Cs() {
    (qt(), uo('Accion sensible cancelada'));
}
function Ss() {
    const e = document.getElementById('queueSensitiveConfirmDialog'),
        t = g().queue.pendingSensitiveAction;
    return !(
        (!Boolean(t) &&
            !(e instanceof HTMLDialogElement
                ? e.open
                : e instanceof HTMLElement &&
                  (!e.hidden || e.hasAttribute('open')))) ||
        (Cs(), 0)
    );
}
async function ws(e) {
    const t = Gt(),
        a = Lt(e);
    if (t.length) {
        if (Ao.has(a)) {
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
                await hs({
                    ticketId: e.id,
                    action: a,
                    consultorio:
                        e.assignedConsultorio || g().queue.stationConsultorio,
                });
            } catch (e) {}
        (bo(), uo(`Bulk ${a} sobre ${t.length} tickets`));
    }
}
async function Ls(e) {
    const t = Number(e || 0);
    t &&
        (g().queue.practiceMode
            ? uo(`Practica: reprint ticket ${t}`)
            : (await _('queue-reprint', { method: 'POST', body: { id: t } }),
              uo(`Reimpresion ticket ${t}`)));
}
async function As() {
    const e = Gt();
    for (const t of e)
        try {
            await Ls(t.id);
        } catch (e) {}
    (bo(), uo(`Bulk reimpresion ${e.length}`));
}
var Ts = Object.freeze({
    __proto__: null,
    callNextForConsultorio: ks,
    cancelQueueSensitiveAction: Cs,
    confirmQueueSensitiveAction: _s,
    dismissQueueSensitiveDialog: Ss,
    reprintQueueTicket: Ls,
    runQueueBulkAction: ws,
    runQueueBulkReprint: As,
    runQueueReleaseStation: $s,
    runQueueTicketAction: qs,
});
function Ms() {
    Bo({ helpOpen: !g().queue.helpOpen });
}
function Es(e) {
    const t = Boolean(e);
    (Bo({ practiceMode: t, pendingSensitiveAction: null }),
        uo(t ? 'Modo practica activo' : 'Modo practica desactivado'));
}
function Bs(e) {
    const t = Zt();
    return (
        !!t &&
        (kt({
            ticketId: t.id,
            action: 'completar',
            consultorio: e.queue.stationConsultorio,
        }),
        !0)
    );
}
async function Ns(e) {
    const t = g();
    if (t.queue.captureCallKeyMode)
        return void (function (e) {
            const t = {
                key: String(e.key || ''),
                code: String(e.code || ''),
                location: Number(e.location || 0),
            };
            (Bo({ customCallKey: t, captureCallKeyMode: !1 }),
                s('Tecla externa guardada', 'success'),
                uo(`Tecla externa calibrada: ${t.code}`));
        })(e);
    if (
        (function (e, t) {
            return (
                !(!t || 'object' != typeof t) &&
                St(t.code) === St(e.code) &&
                String(t.key || '') === String(e.key || '') &&
                Number(t.location || 0) === Number(e.location || 0)
            );
        })(e, t.queue.customCallKey)
    )
        return void (await ks(t.queue.stationConsultorio));
    const a = St(e.code),
        n = St(e.key),
        i = (function (e, t, a) {
            return (
                'numpadenter' === t ||
                'kpenter' === t ||
                ('enter' === a && 3 === Number(e.location || 0))
            );
        })(e, a, n);
    if (i && t.queue.pendingSensitiveAction) return void (await _s());
    const o = (function (e, t) {
        return 'numpad2' === e || '2' === t
            ? 2
            : 'numpad1' === e || '1' === t
              ? 1
              : 0;
    })(a, n);
    if (!o)
        return i
            ? (t.queue.oneTap && Bs(t) && (await _s()),
              void (await ks(t.queue.stationConsultorio)))
            : void ((function (e, t) {
                  return (
                      'numpaddecimal' === e ||
                      'kpdecimal' === e ||
                      'decimal' === t ||
                      ',' === t ||
                      '.' === t
                  );
              })(a, n)
                  ? Bs(t)
                  : (function (e, t) {
                          return (
                              'numpadsubtract' === e ||
                              'kpsubtract' === e ||
                              '-' === t
                          );
                      })(a, n)
                    ? (function (e) {
                          const t = Zt();
                          t &&
                              kt({
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
                          const t = Zt();
                          t &&
                              (await qs(
                                  t.id,
                                  're-llamar',
                                  e.queue.stationConsultorio
                              ),
                              uo(`Re-llamar ${t.ticketCode}`),
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
              uo('Cambio de estación bloqueado por lock'))
            : (Bo({ stationConsultorio: e }), uo(`Numpad: estacion C${e}`));
    })(o, t);
}
function Is(e, t) {
    return 'c2' === e || '2' === e ? 2 : 'c1' === e || '1' === e ? 1 : t;
}
function Ps(e, t) {
    return '1' === e || 'true' === e ? 'locked' : t;
}
function js(e, t) {
    return '1' === e || 'true' === e || ('0' !== e && 'false' !== e && t);
}
function xs(t, a, n) {
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
function Rs(t, a, n, i = 'neutral') {
    return `\n        <li class="dashboard-attention-item" data-tone="${e(i)}">\n            <div>\n                <span>${e(t)}</span>\n                <small>${e(n)}</small>\n            </div>\n            <strong>${e(String(a))}</strong>\n        </li>\n    `;
}
function Ds(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function Os(e) {
    const t = new Date(e || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function Hs(e) {
    return Os(`${e?.date || ''}T${e?.time || '00:00'}:00`);
}
function Fs(e) {
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
function Us(t, a, n) {
    return `\n        <button type="button" class="operations-action-item" data-action="${e(t)}">\n            <span>${e(a)}</span>\n            <small>${e(n)}</small>\n        </button>\n    `;
}
function Ks(e) {
    const {
            appointments: t,
            availability: a,
            callbacks: n,
            funnel: i,
            queueMeta: o,
            queueTickets: s,
            reviews: r,
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
                queueTickets: Array.isArray(e?.data?.queueTickets)
                    ? e.data.queueTickets
                    : [],
                queueMeta:
                    e?.data?.queueMeta && 'object' == typeof e.data.queueMeta
                        ? e.data.queueMeta
                        : null,
                funnel: e?.data?.funnelMetrics || {},
            };
        })(e),
        l = (function (e) {
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
                })(Hs(e))
            ).length;
        })(t),
        c = (function (e) {
            return e.filter((e) => {
                const t = Ds(e.paymentStatus || e.payment_status);
                return (
                    'pending_transfer_review' === t || 'pending_transfer' === t
                );
            }).length;
        })(t),
        u = (function (e) {
            return e.filter((e) => 'pending' === Ds(e.status)).length;
        })(n),
        d = (function (e) {
            return e.filter((e) => {
                if ('pending' !== Ds(e.status)) return !1;
                const t = (function (e) {
                    return Os(e?.fecha || e?.createdAt || '');
                })(e);
                return !!t && Math.round((Date.now() - t) / 6e4) >= 120;
            }).length;
        })(n),
        p = (function (e) {
            return e.filter((e) => 'no_show' === Ds(e.status)).length;
        })(t),
        m = (function (e) {
            return e.length
                ? (
                      e.reduce((e, t) => e + Number(t.rating || 0), 0) /
                      e.length
                  ).toFixed(1)
                : '0.0';
        })(r),
        g = (function (e, t = 30) {
            const a = Date.now();
            return e.filter((e) => {
                const n = Os(e.date || e.createdAt || '');
                return n && a - n <= 24 * t * 60 * 60 * 1e3;
            }).length;
        })(r),
        b = (function (e) {
            return Object.values(e || {}).filter(
                (e) => Array.isArray(e) && e.length > 0
            ).length;
        })(a),
        f = (function (e) {
            return e
                .map((e) => ({ item: e, stamp: Hs(e) }))
                .filter((e) => e.stamp > 0 && e.stamp >= Date.now())
                .sort((e, t) => e.stamp - t.stamp)[0];
        })(t),
        y = Number.isFinite(Number(o?.waitingCount))
            ? Math.max(0, Number(o.waitingCount))
            : s.filter(
                  (e) => 'waiting' === String(e.status || '').toLowerCase()
              ).length;
    return {
        appointments: t,
        availabilityDays: b,
        avgRating: m,
        calledTickets: Number.isFinite(Number(o?.calledCount))
            ? Math.max(0, Number(o.calledCount))
            : s.filter((e) => 'called' === String(e.status || '').toLowerCase())
                  .length,
        callbacks: n,
        funnel: i,
        nextAppointment: f,
        noShows: p,
        pendingCallbacks: u,
        pendingTasks: c + u,
        pendingTransfers: c,
        queueMeta: o,
        recentReviews: g,
        reviews: r,
        todayAppointments: l,
        urgentCallbacks: d,
        waitingTickets: y,
    };
}
function Vs(e) {
    const t = Ks(e);
    ((function (e) {
        const {
            appointments: t,
            nextAppointment: a,
            pendingTasks: n,
            pendingTransfers: i,
            todayAppointments: o,
            availabilityDays: s,
            calledTickets: l,
            pendingCallbacks: c,
            waitingTickets: u,
        } = e;
        (r(
            '#dashboardHeroSummary',
            (function ({
                pendingCallbacks: e,
                pendingTransfers: t,
                urgentCallbacks: a,
                noShows: n,
                nextAppointment: i,
            }) {
                return t > 0
                    ? `Primero revisa ${t} pago(s) antes de confirmar mas citas.`
                    : a > 0
                      ? `Hay ${a} llamada(s) atrasada(s); conviene atenderlas primero.`
                      : e > 0
                        ? `Tienes ${e} seguimiento(s) pendiente(s) por llamar o confirmar.`
                        : n > 0
                          ? `Revisa ${n} no show para cerrar seguimiento del dia.`
                          : i?.item
                            ? `La siguiente atencion es ${i.item.name || 'sin nombre'} ${Fs(i.stamp).toLowerCase()}.`
                            : 'Empieza por agenda, pendientes y turnero sin mezclar herramientas avanzadas en el primer paso.';
            })({
                pendingCallbacks: c,
                pendingTransfers: i,
                nextAppointment: a,
                urgentCallbacks: e.urgentCallbacks,
                noShows: e.noShows,
            })
        ),
            r('#opsTodayCount', o),
            r(
                '#opsTodayMeta',
                a?.item
                    ? `${a.item.name || 'Paciente'} a las ${a.item.time || '--:--'}`
                    : t.length > 0
                      ? `${t.length} cita(s) registradas`
                      : 'Sin citas cargadas'
            ),
            r('#opsPendingCount', n),
            r(
                '#opsPendingMeta',
                n > 0
                    ? `${i} pago(s) y ${c} llamada(s)`
                    : 'Sin pagos ni llamadas pendientes'
            ),
            r('#opsAvailabilityCount', s),
            r(
                '#opsAvailabilityMeta',
                s > 0
                    ? `${s} dia(s) con horarios activos`
                    : 'Aun no hay horarios cargados'
            ),
            r(
                '#opsQueueStatus',
                u > 0
                    ? `${u} en espera`
                    : l > 0
                      ? `${l} en atencion`
                      : 'Listo para abrir'
            ),
            r(
                '#opsQueueMeta',
                u > 0 || l > 0
                    ? `Turnero listo para atender ${u + l} ticket(s)`
                    : 'Abre la app solo cuando vayas a llamar pacientes'
            ));
    })(t),
        (function (e) {
            const {
                    calledTickets: t,
                    nextAppointment: a,
                    pendingTransfers: i,
                    pendingTasks: o,
                    todayAppointments: s,
                    urgentCallbacks: l,
                    waitingTickets: c,
                } = e,
                u =
                    i > 0 || l > 0
                        ? 'warning'
                        : c > 0 || t > 0 || s > 0
                          ? 'neutral'
                          : 'success';
            (r(
                '#dashboardLiveStatus',
                i > 0 || l > 0
                    ? 'Atencion'
                    : c > 0 || t > 0 || s > 0
                      ? 'Activo'
                      : 'Estable'
            ),
                document
                    .getElementById('dashboardLiveStatus')
                    ?.setAttribute('data-state', u),
                r(
                    '#dashboardLiveMeta',
                    (function ({
                        calledTickets: e,
                        pendingTransfers: t,
                        urgentCallbacks: a,
                        nextAppointment: i,
                        waitingTickets: o,
                    }) {
                        return t > 0
                            ? 'Hay pagos pendientes antes de cerrar la agenda.'
                            : a > 0
                              ? 'Hay seguimientos atrasados que requieren llamada inmediata.'
                              : o > 0 || e > 0
                                ? `${o} paciente(s) en espera y ${e} llamado(s) en sala.`
                                : i?.item
                                  ? `Siguiente ingreso: ${i.item.name || 'Paciente'} el ${n(i.item.date)} a las ${i.item.time || '--:--'}.`
                                  : 'Sin frentes criticos en este momento.';
                    })({
                        calledTickets: t,
                        pendingTransfers: i,
                        urgentCallbacks: l,
                        nextAppointment: a,
                        waitingTickets: c,
                    })
                ),
                r(
                    '#operationRefreshSignal',
                    o > 0
                        ? 'Tareas claras para recepcion/admin'
                        : 'Operacion simple y sin frentes urgentes'
                ));
        })(t),
        (function (e) {
            const {
                availabilityDays: t,
                calledTickets: a,
                nextAppointment: n,
                pendingCallbacks: i,
                pendingTransfers: o,
                todayAppointments: s,
                urgentCallbacks: l,
                waitingTickets: c,
            } = e;
            (r(
                '#dashboardQueueHealth',
                c > 0 || a > 0
                    ? 'El turnero esta activo en una app separada'
                    : 'El turnero avanzado sigue disponible en Mas herramientas'
            ),
                r(
                    '#dashboardFlowStatus',
                    n?.item
                        ? `${Fs(n.stamp)} | ${n.item.name || 'Paciente'}`
                        : t > 0
                          ? `${t} dia(s) con horarios publicados`
                          : 'Sin citas inmediatas ni cola activa'
                ),
                r('#operationPendingReviewCount', o),
                r('#operationPendingCallbacksCount', i),
                r('#operationTodayLoadCount', s),
                r(
                    '#operationDeckMeta',
                    o > 0 || l > 0 || i > 0
                        ? 'Estas son las acciones utiles del dia'
                        : n?.item
                          ? 'La siguiente accion ya esta clara'
                          : 'Operacion sin frentes urgentes'
                ),
                r(
                    '#operationQueueHealth',
                    o > 0
                        ? `${o} pago(s) requieren revision antes de cerrar el dia`
                        : n?.item
                          ? `Siguiente paciente: ${n.item.name || 'Paciente'} ${Fs(n.stamp).toLowerCase()}`
                          : 'Sin citas inmediatas en cola'
                ));
        })(t),
        l(
            '#operationActionList',
            (function (e) {
                const {
                    appointments: t,
                    availabilityDays: a,
                    nextAppointment: n,
                    pendingCallbacks: i,
                    pendingTransfers: o,
                    waitingTickets: s,
                } = e;
                return [
                    Us(
                        'context-open-appointments-overview',
                        'Abrir agenda',
                        n?.item
                            ? `Siguiente cita ${Fs(n.stamp).toLowerCase()}`
                            : `${t.length} cita(s) cargadas`
                    ),
                    Us(
                        'context-open-callbacks-pending',
                        'Revisar pendientes',
                        o > 0
                            ? `${o} pago(s) y ${i} llamada(s) por resolver`
                            : `${i} llamada(s) pendientes`
                    ),
                    Us(
                        'context-open-availability',
                        'Abrir horarios',
                        a > 0
                            ? `${a} dia(s) con horarios publicados`
                            : s > 0
                              ? 'Revisa horarios para sostener la cola de hoy'
                              : 'Publica nuevos horarios cuando haga falta'
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
                    Rs(
                        'Transferencias',
                        a,
                        a > 0
                            ? 'Pago detenido antes de confirmar.'
                            : 'Sin comprobantes pendientes.',
                        a > 0 ? 'warning' : 'success'
                    ),
                    Rs(
                        'Callbacks urgentes',
                        i,
                        i > 0
                            ? 'Mas de 120 min en espera.'
                            : 'SLA dentro de rango.',
                        i > 0 ? 'danger' : 'success'
                    ),
                    Rs(
                        'Agenda de hoy',
                        n,
                        n > 0
                            ? `${n} ingreso(s) en la jornada.`
                            : 'No hay citas hoy.',
                        n > 6 ? 'warning' : 'neutral'
                    ),
                    Rs(
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
                    xs(e.checkoutEntryBreakdown, 'entry', 'count')
                ),
                l(
                    '#funnelSourceList',
                    xs(e.sourceBreakdown, 'source', 'count')
                ),
                l(
                    '#funnelPaymentMethodList',
                    xs(e.paymentMethodBreakdown, 'method', 'count')
                ),
                l(
                    '#funnelAbandonList',
                    xs(e.checkoutAbandonByStep, 'step', 'count')
                ),
                l(
                    '#funnelAbandonReasonList',
                    xs(e.abandonReasonBreakdown, 'reason', 'count')
                ),
                l(
                    '#funnelStepList',
                    xs(e.bookingStepBreakdown, 'step', 'count')
                ),
                l(
                    '#funnelErrorCodeList',
                    xs(e.errorCodeBreakdown, 'code', 'count')
                ));
        })(t.funnel));
}
function zs(e) {
    return String(e || '')
        .toLowerCase()
        .trim();
}
function Qs(e) {
    const t = new Date(e?.date || e?.createdAt || '');
    return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}
function Gs(e) {
    return `${Math.max(0, Math.min(5, Math.round(Number(e || 0))))}/5`;
}
function Ws(e) {
    const t = String(e || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return t.length ? t.map((e) => e.charAt(0).toUpperCase()).join('') : 'AN';
}
function Js(e, t = 220) {
    const a = String(e || '').trim();
    return a
        ? a.length <= t
            ? a
            : `${a.slice(0, t - 1).trim()}...`
        : 'Sin comentario escrito.';
}
function Ys() {
    const t = g(),
        a = Array.isArray(t?.data?.reviews) ? t.data.reviews : [],
        n = (function (e) {
            return e.slice().sort((e, t) => Qs(t) - Qs(e));
        })(a),
        o = (function (e) {
            return e.length
                ? e.reduce((e, t) => e + Number(t.rating || 0), 0) / e.length
                : 0;
        })(a),
        s = (function (e, t = 30) {
            const a = Date.now();
            return e.filter((e) => {
                const n = Qs(e);
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
                  return `\n        <article class="reviews-spotlight-card">\n            <div class="reviews-spotlight-top">\n                <span class="review-avatar">${e(Ws(a.name || 'Anonimo'))}</span>\n                <div>\n                    <small>${e(t.eyebrow)}</small>\n                    <strong>${e(a.name || 'Anonimo')}</strong>\n                    <small>${e(i(a.date || a.createdAt || ''))}</small>\n                </div>\n            </div>\n            <p class="reviews-spotlight-stars">${e(Gs(a.rating))}</p>\n            <p>${e(Js(a.comment || a.review || '', 320))}</p>\n            <small>${e(t.summary)}</small>\n        </article>\n    `;
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
                            return `\n        <article class="review-card${a ? ' is-featured' : ''}" data-rating="${e(String(n))}">\n            <header>\n                <div class="review-card-heading">\n                    <span class="review-avatar">${e(Ws(t.name || 'Anonimo'))}</span>\n                    <div>\n                        <strong>${e(t.name || 'Anonimo')}</strong>\n                        <small>${e(i(t.date || t.createdAt || ''))}</small>\n                    </div>\n                </div>\n                <span class="review-rating-badge" data-tone="${e(o)}">${e(Gs(n))}</span>\n            </header>\n            <p>${e(Js(t.comment || t.review || ''))}</p>\n            <small>${e(s)}</small>\n        </article>\n    `;
                        })(t, {
                            featured:
                                a.item &&
                                zs(t.name) === zs(a.item.name) &&
                                Qs(t) === Qs(a.item),
                        })
                    )
                    .join('');
            })(n, u)
        ));
}
function Zs() {
    const e = os();
    (r('#adminRefreshStatus', e),
        r(
            '#adminSyncState',
            'Datos: sin sincronizar' === e
                ? 'Listo para primera sincronizacion'
                : e.replace('Datos: ', 'Estado: ')
        ));
}
async function Xs(e = !1) {
    const t = await rs(),
        a = Boolean(t?.ok);
    return (
        (function () {
            const e = g(),
                t = et(e.data.availability || {}),
                a = Ze(e.availability.selectedDate, t);
            (ut({
                draft: t,
                selectedDate: a,
                monthAnchor: Ye(e.availability.monthAnchor, a),
                draftDirty: !1,
                lastAction: '',
            }),
                ct());
        })(),
        t?.preservedQueueData || (await Fo()),
        U(g()),
        Vs(g()),
        de(),
        De(),
        Ys(),
        ct(),
        co(),
        Zs(),
        e &&
            s(
                a ? 'Datos actualizados' : 'Datos cargados desde cache local',
                a ? 'success' : 'warning'
            ),
        a
    );
}
function er() {
    (R(!1),
        H(),
        O(!1),
        D({
            tone: 'neutral',
            title: 'Proteccion activa',
            message:
                'Usa tu clave de administrador para acceder al centro operativo.',
        }));
}
async function tr(e) {
    e.preventDefault();
    const t = document.getElementById('adminPassword'),
        a = document.getElementById('admin2FACode'),
        n = t instanceof HTMLInputElement ? t.value : '',
        i = a instanceof HTMLInputElement ? a.value : '';
    try {
        O(!0);
        const e = g();
        if (
            (D({
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
                    $(n),
                    b((e) => ({
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
                        b((e) => ({
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
                    $(n),
                    b((e) => ({
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
                    R(!0),
                    D({
                        tone: 'warning',
                        title: 'Codigo 2FA requerido',
                        message:
                            'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                    }),
                    void F('2fa')
                );
        }
        (D({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        }),
            I(),
            j(),
            R(!1),
            H({ clearPassword: !0 }),
            await Xs(!1),
            gs({
                immediate: 'queue' === g().ui.activeSection,
                reason: 'login',
            }),
            s('Sesion iniciada', 'success'));
    } catch (e) {
        (D({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                e?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        }),
            F(g().auth.requires2FA ? '2fa' : 'password'),
            s(e?.message || 'No se pudo iniciar sesion', 'error'));
    } finally {
        O(!1);
    }
}
async function ar(e, t) {
    switch (e) {
        case 'appointment-quick-filter':
            return (me(String(t.dataset.filterValue || 'all')), !0);
        case 'clear-appointment-filters':
            return (pe({ filter: 'all', search: '' }), !0);
        case 'appointment-density':
            return (
                pe({
                    density:
                        'compact' ===
                        J(String(t.dataset.density || 'comfortable'))
                            ? 'compact'
                            : W,
                }),
                !0
            );
        case 'approve-transfer':
            return (
                await (async function (e) {
                    (await fe(e, { paymentStatus: 'paid' }),
                        be(e, { paymentStatus: 'paid' }));
                })(Number(t.dataset.id || 0)),
                s('Transferencia aprobada', 'success'),
                !0
            );
        case 'reject-transfer':
            return (
                await (async function (e) {
                    (await fe(e, { paymentStatus: 'failed' }),
                        be(e, { paymentStatus: 'failed' }));
                })(Number(t.dataset.id || 0)),
                s('Transferencia rechazada', 'warning'),
                !0
            );
        case 'mark-no-show':
            return (
                await (async function (e) {
                    (await fe(e, { status: 'no_show' }),
                        be(e, { status: 'no_show' }));
                })(Number(t.dataset.id || 0)),
                s('Marcado como no show', 'warning'),
                !0
            );
        case 'cancel-appointment':
            return (
                await (async function (e) {
                    (await fe(e, { status: 'cancelled' }),
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
                            ...(g().data.appointments || []).map((e) => [
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
async function nr(e, a) {
    switch (e) {
        case 'change-month':
            return (
                (function (e) {
                    const t = Number(e || 0);
                    if (!Number.isFinite(t) || 0 === t) return;
                    const a = Ye(
                        g().availability.monthAnchor,
                        g().availability.selectedDate
                    );
                    (a.setMonth(a.getMonth() + t),
                        ut({ monthAnchor: a, lastAction: '' }, { render: !0 }));
                })(Number(a.dataset.delta || 0)),
                !0
            );
        case 'availability-today':
        case 'context-availability-today':
            return (gt(u(new Date()), 'Hoy'), !0);
        case 'availability-prev-with-slots':
            return (
                (function () {
                    const e = lt(-1);
                    e
                        ? gt(e, `Fecha previa con slots: ${e}`)
                        : pt('No hay fechas anteriores con slots');
                })(),
                !0
            );
        case 'availability-next-with-slots':
        case 'context-availability-next':
            return (
                (function () {
                    const e = lt(1);
                    e
                        ? gt(e, `Siguiente fecha con slots: ${e}`)
                        : pt('No hay fechas siguientes con slots');
                })(),
                !0
            );
        case 'select-availability-day':
            return (
                (function (e) {
                    const t = We(e);
                    t &&
                        ut(
                            {
                                selectedDate: t,
                                monthAnchor: Ye(t, t),
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
                        ((a.value = ft(e)), a.focus());
                })(String(a.dataset.time || '')),
                !0
            );
        case 'add-time-slot':
            return (
                (function () {
                    if (it()) return;
                    const e = t('#newSlotTime');
                    if (!(e instanceof HTMLInputElement)) return;
                    const a = ft(e.value);
                    if (!a) return;
                    const n = g(),
                        i = bt();
                    i &&
                        (mt(
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
                    const n = g(),
                        i = Array.isArray(n.availability.draft[a])
                            ? n.availability.draft[a]
                            : [],
                        o = ft(t);
                    mt(
                        a,
                        i.filter((e) => ft(e) !== o),
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
                    const e = g(),
                        t = bt();
                    if (!t) return;
                    const a = Array.isArray(e.availability.draft[t])
                        ? Ge(e.availability.draft[t])
                        : [];
                    ut(
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
                    const e = g(),
                        t = Array.isArray(e.availability.clipboard)
                            ? Ge(e.availability.clipboard)
                            : [];
                    if (!t.length) return void pt('Portapapeles vacio');
                    const a = bt();
                    a && mt(a, t, `Pegado ${t.length} slots en ${a}`);
                })(),
                !0
            );
        case 'duplicate-availability-day-next':
            return (yt(1), !0);
        case 'duplicate-availability-next-week':
            return (yt(7), !0);
        case 'clear-availability-day':
            return (
                (function () {
                    if (it()) return;
                    const e = bt();
                    e &&
                        window.confirm(
                            `Se eliminaran los slots del dia ${e}. Continuar?`
                        ) &&
                        mt(e, [], `Dia ${e} limpiado`);
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
                        const t = Je(e);
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
                    const i = st();
                    for (let e = 0; e < 7; e += 1) {
                        const a = new Date(t.start);
                        (a.setDate(t.start.getDate() + e), delete i[u(a)]);
                    }
                    dt(i, {
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
                    const e = st(),
                        t = await _('availability', {
                            method: 'POST',
                            body: { availability: e },
                        }),
                        a =
                            t?.data && 'object' == typeof t.data
                                ? et(t.data)
                                : e,
                        n =
                            t?.meta && 'object' == typeof t.meta
                                ? t.meta
                                : null;
                    (b((e) => ({
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
                        ct());
                })(),
                s('Disponibilidad guardada', 'success'),
                !0
            );
        case 'discard-availability-draft':
            return (
                (function () {
                    if (it()) return;
                    const e = g();
                    if (
                        e.availability.draftDirty &&
                        !window.confirm(
                            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
                        )
                    )
                        return;
                    const t = et(e.data.availability || {}),
                        a = Ze(e.availability.selectedDate, t);
                    ut(
                        {
                            draft: t,
                            selectedDate: a,
                            monthAnchor: Ye(e.availability.monthAnchor, a),
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
const ir = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);
function or(e, t = 'dashboard') {
    const a = String(e || '')
        .trim()
        .toLowerCase();
    return ir.has(a) ? a : t;
}
function sr(e) {
    !(function (e) {
        const t = String(e || '').replace(/^#/, ''),
            a = t ? `#${t}` : '';
        window.location.hash !== a &&
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}${a}`
            );
    })(or(e));
}
const rr = 'themeMode',
    lr = new Set(['light', 'dark', 'system']);
function cr(e, { persist: t = !1 } = {}) {
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
    (b((t) => ({ ...t, ui: { ...t.ui, themeMode: e, theme: a } })),
        t &&
            (function (e) {
                const t = lr.has(e) ? e : 'system';
                yo(rr, t);
            })(e),
        Array.from(
            document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
        ).forEach((t) => {
            const a = t.dataset.themeMode === e;
            (t.classList.toggle('is-active', a),
                t.setAttribute('aria-pressed', String(a)));
        }));
}
const ur = 'adminLastSection',
    dr = 'adminSidebarCollapsed';
function pr() {
    return window.matchMedia('(max-width: 1024px)').matches;
}
function mr(e) {
    return (
        e instanceof HTMLElement &&
        !e.hidden &&
        'true' !== e.getAttribute('aria-hidden') &&
        (!('disabled' in e) || !e.disabled) &&
        e.getClientRects().length > 0
    );
}
function gr() {
    const e = g(),
        a = pr(),
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
function br() {
    const e = g();
    (yo(ur, e.ui.activeSection), yo(dr, e.ui.sidebarCollapsed ? '1' : '0'));
}
async function fr(e, t = {}) {
    const a = or(e, 'dashboard'),
        { force: n = !1 } = t,
        i = g().ui.activeSection;
    return (
        !(
            (function (e, t) {
                return (
                    !t &&
                    'availability' === g().ui.activeSection &&
                    'availability' !== e &&
                    vt()
                );
            })(a, n) &&
            !window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            )
        ) &&
        ((function (e) {
            const t = or(e, 'dashboard');
            (b((e) => ({ ...e, ui: { ...e.ui, activeSection: t } })),
                x(t),
                U(g()),
                sr(t),
                br());
        })(a),
        gs({
            immediate: 'queue' === a,
            reason: 'queue' === a ? 'section-enter' : 'section-exit',
        }),
        'queue' === a &&
            'queue' !== i &&
            (function () {
                const e = g();
                return (
                    'fallback' !== St(e.queue.syncMode) &&
                    !Boolean(e.queue.fallbackPartial)
                );
            })() &&
            (await Ho()),
        !0)
    );
}
function yr(e) {
    b((t) => ({ ...t, ui: { ...t.ui, ...e(t.ui) } }));
}
function vr() {
    (yr((e) => ({
        sidebarCollapsed: !e.sidebarCollapsed,
        sidebarOpen: e.sidebarOpen,
    })),
        gr(),
        br());
}
function hr() {
    (yr((e) => ({ sidebarOpen: !e.sidebarOpen })), gr());
}
function kr({ restoreFocus: e = !1 } = {}) {
    if ((yr(() => ({ sidebarOpen: !1 })), gr(), j(), e)) {
        const e = t('#adminMenuToggle');
        e instanceof HTMLElement && e.focus();
    }
}
function qr() {
    P();
    const e = document.getElementById('adminQuickCommand');
    e instanceof HTMLInputElement && e.focus();
}
function $r() {
    const e = g().ui.activeSection;
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
const _r = {
    appointments_overview: async () => {
        (await fr('appointments'), me('all'), ge(''));
    },
    appointments_pending_transfer: async () => {
        (await fr('appointments'), me('pending_transfer'), ge(''));
    },
    appointments_all: async () => {
        (await fr('appointments'), me('all'), ge(''));
    },
    appointments_no_show: async () => {
        (await fr('appointments'), me('no_show'), ge(''));
    },
    callbacks_pending: async () => {
        (await fr('callbacks'), He('pending'));
    },
    callbacks_contacted: async () => {
        (await fr('callbacks'), He('contacted'));
    },
    callbacks_sla_urgent: async () => {
        (await fr('callbacks'), He('sla_urgent'));
    },
    availability_section: async () => {
        await fr('availability');
    },
    queue_sla_risk: async () => {
        (await fr('queue'), No('sla_risk'));
    },
    queue_waiting: async () => {
        (await fr('queue'), No('waiting'));
    },
    queue_called: async () => {
        (await fr('queue'), No('called'));
    },
    queue_no_show: async () => {
        (await fr('queue'), No('no_show'));
    },
    queue_all: async () => {
        (await fr('queue'), No('all'));
    },
    queue_call_next: async () => {
        (await fr('queue'), await ks(g().queue.stationConsultorio));
    },
};
async function Cr(e) {
    const t = _r[e];
    'function' == typeof t && (await t());
}
function Sr(e) {
    const t = String(e || '')
        .trim()
        .toLowerCase();
    return t
        ? (t.includes('callbacks') && t.includes('pend')) ||
          t.includes('pendient') ||
          (t.includes('llamad') && !t.includes('turnero'))
            ? 'callbacks_pending'
            : t.includes('callback') && (t.includes('urg') || t.includes('sla'))
              ? 'callbacks_sla_urgent'
              : t.includes('agenda') || t.includes('citas')
                ? t.includes('transfer')
                    ? 'appointments_pending_transfer'
                    : 'appointments_overview'
                : t.includes('citas') && t.includes('transfer')
                  ? 'appointments_pending_transfer'
                  : t.includes('horario') ||
                      t.includes('disponibilidad') ||
                      t.includes('slots')
                    ? 'availability_section'
                    : t.includes('queue') ||
                        t.includes('cola') ||
                        t.includes('turnero')
                      ? 'queue_sla_risk'
                      : t.includes('no show')
                        ? 'appointments_no_show'
                        : null
        : null;
}
async function wr(e, t) {
    switch (e) {
        case 'callback-quick-filter':
            return (He(String(t.dataset.filterValue || 'all')), !0);
        case 'clear-callback-filters':
            return (
                Oe({
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
                await fr('callbacks'),
                He('pending'),
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
                await Ke(
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
                    const n = await _('lead-ai-request', {
                        method: 'POST',
                        body: { callbackId: a, objective: t },
                    });
                    return n?.data ? (Fe(n.data), n.data) : null;
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
                    const a = await Ue(e, {
                        status: 'contacted',
                        leadOps: { outcome: t },
                    });
                    return (a && Fe(a), a);
                })(
                    Number(t.dataset.callbackId || 0),
                    String(t.dataset.outcome || '')
                ),
                s('Outcome actualizado', 'success'),
                !0
            );
        case 'callback-copy-ai': {
            const e = Number(t.dataset.callbackId || 0),
                a = (g().data.callbacks || []).find(
                    (t) => Number(t.id || 0) === e
                ),
                n = String(a?.leadOps?.aiDraft || '').trim();
            return n
                ? navigator?.clipboard?.writeText
                    ? (await navigator.clipboard.writeText(n),
                      await (async function (e) {
                          const t = await Ue(e, {
                              leadOps: { aiStatus: 'accepted' },
                          });
                          return (t && Fe(t), t);
                      })(e),
                      s('Borrador copiado', 'success'),
                      !0)
                    : (s('Clipboard no disponible', 'error'), !0)
                : (s('Aun no hay borrador IA', 'error'), !0);
        }
        case 'callbacks-bulk-select-visible':
            return (
                Oe(
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
            return (Oe({ selected: [] }, { persist: !1 }), !0);
        case 'callbacks-bulk-mark':
            return (
                await (async function () {
                    const e = (g().callbacks.selected || [])
                        .map((e) => Number(e || 0))
                        .filter((e) => e > 0);
                    for (const t of e)
                        try {
                            await Ke(t);
                        } catch (e) {}
                })(),
                !0
            );
        case 'context-open-callbacks-pending':
            return (await fr('callbacks'), He('pending'), !0);
        default:
            return !1;
    }
}
async function Lr(e) {
    switch (e) {
        case 'context-open-appointments-overview':
            return (await fr('appointments'), me('all'), ge(''), !0);
        case 'context-open-appointments-transfer':
            return (await fr('appointments'), me('pending_transfer'), !0);
        case 'context-open-availability':
            return (await fr('availability'), !0);
        case 'context-open-dashboard':
            return (await fr('dashboard'), !0);
        default:
            return !1;
    }
}
async function Ar(e, t) {
    switch (e) {
        case 'queue-bulk-action':
            return (await ws(String(t.dataset.queueAction || 'no_show')), !0);
        case 'queue-bulk-reprint':
            return (await As(), !0);
        default:
            return !1;
    }
}
async function Tr(e, t) {
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
async function Mr(e) {
    switch (e) {
        case 'queue-sensitive-confirm':
            return (await _s(), !0);
        case 'queue-sensitive-cancel':
            return (Cs(), !0);
        default:
            return !1;
    }
}
function Er(e, t = 0) {
    return Number(e?.dataset?.queueConsultorio || t);
}
function Br(e, t = 0) {
    return Number(e?.dataset?.queueId || t);
}
async function Nr(e, t) {
    switch (e) {
        case 'queue-refresh-state':
            return (await Ho(), !0);
        case 'queue-call-next':
            return (await ks(Er(t)), !0);
        case 'queue-release-station':
            return (await $s(Er(t)), !0);
        case 'queue-toggle-shortcuts':
            return (Ms(), !0);
        case 'queue-toggle-one-tap':
            return (Bo({ oneTap: !g().queue.oneTap }), !0);
        case 'queue-start-practice':
            return (Es(!0), !0);
        case 'queue-stop-practice':
            return (Es(!1), !0);
        case 'queue-lock-station':
            return (
                (function (e) {
                    const t = 2 === Number(e || 0) ? 2 : 1;
                    (Bo({ stationMode: 'locked', stationConsultorio: t }),
                        uo(`Estacion bloqueada en C${t}`));
                })(Er(t, 1)),
                !0
            );
        case 'queue-set-station-mode':
            return (
                (function (e) {
                    if ('free' === St(e))
                        return (
                            Bo({ stationMode: 'free' }),
                            void uo('Estacion en modo libre')
                        );
                    Bo({ stationMode: 'locked' });
                })(String(t.dataset.queueMode || 'free')),
                !0
            );
        case 'queue-capture-call-key':
            return (
                Bo({ captureCallKeyMode: !0 }),
                s('Calibración activa: presiona la tecla externa', 'info'),
                !0
            );
        case 'queue-clear-call-key':
            return (
                window.confirm('¿Quitar tecla externa calibrada?') &&
                    (Bo({ customCallKey: null, captureCallKeyMode: !1 }),
                    s('Tecla externa eliminada', 'success')),
                !0
            );
        default:
            return !1;
    }
}
async function Ir(e, t) {
    switch (e) {
        case 'queue-toggle-ticket-select':
            return (mo(Br(t)), !0);
        case 'queue-select-visible':
            return (go(), !0);
        case 'queue-clear-selection':
            return (bo(), !0);
        case 'queue-ticket-action':
            return (
                await qs(
                    Br(t),
                    (function (e, t = '') {
                        return String(e?.dataset?.queueAction || t);
                    })(t),
                    Er(t)
                ),
                !0
            );
        case 'queue-reprint-ticket':
            return (await Ls(Br(t)), !0);
        case 'queue-clear-search':
            return (Po(), !0);
        case 'queue-open-quick-tray':
            return (
                Po(),
                No(String(t?.dataset?.queueFilterValue || 'all')),
                !0
            );
        case 'queue-reset-tray-context':
            return (Po(), No('all'), !0);
        default:
            return !1;
    }
}
async function Pr(e, t) {
    const a = [Nr, Ir, Ar, Mr, Tr];
    for (const n of a) if (await n(e, t)) return !0;
    return !1;
}
async function jr(e, t) {
    switch (e) {
        case 'close-toast':
            return (t.closest('.toast')?.remove(), !0);
        case 'set-admin-theme':
            return (
                cr(String(t.dataset.themeMode || 'system'), { persist: !0 }),
                !0
            );
        case 'toggle-sidebar-collapse':
            return (vr(), !0);
        case 'refresh-admin-data':
            return (await Xs(!0), !0);
        case 'run-admin-command': {
            const e = document.getElementById('adminQuickCommand');
            if (e instanceof HTMLInputElement) {
                const t = Sr(e.value);
                t && (await Cr(t), (e.value = ''), j());
            }
            return !0;
        }
        case 'open-command-palette':
            return (P(), qr(), !0);
        case 'open-operator-app':
            return (
                window.location.assign(
                    (function () {
                        const e = new URL(window.location.href),
                            t = new URL('/operador-turnos.html', e.origin);
                        return (
                            ['station', 'lock', 'one_tap'].forEach((a) => {
                                const n = e.searchParams.get(a);
                                n && t.searchParams.set(a, n);
                            }),
                            `${t.pathname}${t.search}`
                        );
                    })()
                ),
                !0
            );
        case 'close-command-palette':
            return (j(), !0);
        case 'logout':
            return (
                await (async function () {
                    try {
                        await C('logout', { method: 'POST' });
                    } catch (e) {}
                    ($(''),
                        b((e) => ({
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
                gs({ immediate: !1, reason: 'logout' }),
                N(),
                j(),
                er(),
                s('Sesion cerrada', 'info'),
                !0
            );
        case 'reset-login-2fa':
            return (
                b((e) => ({ ...e, auth: { ...e.auth, requires2FA: !1 } })),
                R(!1),
                H(),
                D({
                    tone: 'neutral',
                    title: 'Ingreso protegido',
                    message:
                        'Volviste al paso de clave. Puedes reintentar el acceso.',
                }),
                F('password'),
                !0
            );
        default:
            return !1;
    }
}
async function xr() {
    (!(function () {
        const e = t('#loginScreen'),
            a = t('#adminDashboard');
        if (!(e instanceof HTMLElement && a instanceof HTMLElement))
            throw new Error('Contenedores admin no encontrados');
        ((e.innerHTML = `\n        <div class="admin-v3-login">\n            \n        <section class="admin-v3-login__hero">\n            <div class="admin-v3-login__brand">\n                <p class="sony-kicker">Piel en Armonia</p>\n                <h1>Centro operativo claro y protegido</h1>\n                <p>\n                    Acceso editorial para agenda, callbacks y disponibilidad con\n                    jerarquia simple y lectura rapida.\n                </p>\n            </div>\n            <div class="admin-v3-login__facts">\n                <article class="admin-v3-login__fact">\n                    <span>Sesion</span>\n                    <strong>Acceso administrativo aislado</strong>\n                    <small>Entrada dedicada para operacion diaria.</small>\n                </article>\n                <article class="admin-v3-login__fact">\n                    <span>Proteccion</span>\n                    <strong>Clave y 2FA en la misma tarjeta</strong>\n                    <small>El segundo paso aparece solo cuando el backend lo exige.</small>\n                </article>\n                <article class="admin-v3-login__fact">\n                    <span>Entorno</span>\n                    <strong>Activos self-hosted y CSP activa</strong>\n                    <small>Sin dependencias remotas para estilos ni fuentes.</small>\n                </article>\n            </div>\n        </section>\n    \n            \n        <section class="admin-v3-login__panel">\n            <div class="admin-v3-login__panel-head">\n                <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>\n                <h2 id="adminLoginStepTitle">Acceso de administrador</h2>\n                <p id="adminLoginStepSummary">\n                    Usa tu clave para abrir el workbench operativo.\n                </p>\n            </div>\n\n            <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">\n                <strong id="adminLoginStatusTitle">Proteccion activa</strong>\n                <p id="adminLoginStatusMessage">\n                    El panel usa autenticacion endurecida y activos self-hosted.\n                </p>\n            </div>\n\n            <form id="loginForm" class="sony-login-form" novalidate>\n                <label id="adminPasswordField" class="admin-login-field" for="adminPassword">\n                    <span>Contrasena</span>\n                    <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />\n                </label>\n                <div id="group2FA" class="is-hidden">\n                    <label id="admin2FAField" class="admin-login-field" for="admin2FACode">\n                        <span>Codigo 2FA</span>\n                        <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />\n                    </label>\n                </div>\n                <div class="admin-login-actions">\n                    <button id="loginBtn" type="submit">Ingresar</button>\n                    <button\n                        id="loginReset2FABtn"\n                        type="button"\n                        class="sony-login-reset is-hidden"\n                        data-action="reset-login-2fa"\n                    >\n                        Volver\n                    </button>\n                </div>\n                <p id="adminLoginSupportCopy" class="admin-login-support-copy">\n                    Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.\n                </p>\n            </form>\n\n            ${L('login-theme-bar')}\n        </section>\n    \n        </div>\n    `),
            (a.innerHTML = M()));
    })(),
        (function () {
            const e = t('#adminMainContent');
            (e instanceof HTMLElement &&
                e.setAttribute('data-admin-frame', 'sony_v3'),
                Object.entries(K).forEach(([e, t]) => {
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
                        const a = [jr, ar, wr, nr, Pr, Lr];
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
            e.preventDefault();
            const a = await fr(
                String(t.getAttribute('data-section') || 'dashboard')
            );
            pr() && !1 !== a && kr();
        }),
        document.addEventListener('click', (e) => {
            const t =
                e.target instanceof Element
                    ? e.target.closest('[data-queue-filter]')
                    : null;
            t &&
                (e.preventDefault(),
                No(String(t.getAttribute('data-queue-filter') || 'all')));
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
            let e = G,
                t = W;
            try {
                ((e = JSON.parse(localStorage.getItem(z) || `"${G}"`)),
                    (t = JSON.parse(localStorage.getItem(Q) || `"${W}"`)));
            } catch (e) {}
            b((a) => ({
                ...a,
                appointments: {
                    ...a.appointments,
                    sort: 'string' == typeof e ? e : G,
                    density: 'string' == typeof t ? t : W,
                },
            }));
        })(),
        (function () {
            let e = 'all',
                t = 'priority_desc';
            try {
                ((e = JSON.parse(localStorage.getItem(ve) || '"all"')),
                    (t = JSON.parse(
                        localStorage.getItem(ye) || '"priority_desc"'
                    )));
            } catch (e) {}
            b((a) => ({
                ...a,
                callbacks: { ...a.callbacks, filter: $e(e), sort: _e(t) },
            }));
        })(),
        (function () {
            let e = '',
                t = '';
            try {
                ((e = String(localStorage.getItem(Ve) || '')),
                    (t = String(localStorage.getItem(ze) || '')));
            } catch (e) {}
            const a = We(e),
                n = Ye(t, a);
            b((e) => ({
                ...e,
                availability: {
                    ...e.availability,
                    ...(a ? { selectedDate: a } : {}),
                    monthAnchor: n,
                },
            }));
        })(),
        (function () {
            const e = or(fo(ur, 'dashboard')),
                t = '1' === fo(dr, '0');
            (b((a) => ({
                ...a,
                ui: {
                    ...a.ui,
                    activeSection: e,
                    sidebarCollapsed: t,
                    sidebarOpen: !1,
                },
            })),
                x(e),
                sr(e),
                gr());
        })(),
        (function () {
            const e = {
                    stationMode:
                        'locked' === St(fo(qo, 'free')) ? 'locked' : 'free',
                    stationConsultorio: 2 === Number(fo($o, '1')) ? 2 : 1,
                    oneTap: '1' === fo(_o, '0'),
                    helpOpen: '1' === fo(So, '0'),
                    customCallKey: vo(Co, null),
                },
                t = St(ko('station')),
                a = St(ko('lock')),
                n = St(ko('one_tap'));
            (b((i) => ({
                ...i,
                queue: {
                    ...i.queue,
                    stationMode: Ps(a, e.stationMode),
                    stationConsultorio: Is(t, e.stationConsultorio),
                    oneTap: js(n, e.oneTap),
                    helpOpen: e.helpOpen,
                    customCallKey:
                        e.customCallKey && 'object' == typeof e.customCallKey
                            ? e.customCallKey
                            : null,
                },
            })),
                To(g()));
        })(),
        cr(
            (function () {
                const e = String(fo(rr, 'system') || 'system')
                    .trim()
                    .toLowerCase();
                return lr.has(e) ? e : 'system';
            })()
        ),
        er(),
        (function () {
            const e = document.getElementById('appointmentFilter');
            e instanceof HTMLSelectElement &&
                e.addEventListener('change', () => {
                    me(e.value);
                });
            const t = document.getElementById('appointmentSort');
            t instanceof HTMLSelectElement &&
                t.addEventListener('change', () => {
                    pe({ sort: J(t.value) || G });
                });
            const a = document.getElementById('searchAppointments');
            a instanceof HTMLInputElement &&
                a.addEventListener('input', () => {
                    ge(a.value);
                });
            const n = document.getElementById('callbackFilter');
            n instanceof HTMLSelectElement &&
                n.addEventListener('change', () => {
                    He(n.value);
                });
            const i = document.getElementById('callbackSort');
            i instanceof HTMLSelectElement &&
                i.addEventListener('change', () => {
                    Oe({ sort: _e(i.value), selected: [] });
                });
            const o = document.getElementById('searchCallbacks');
            o instanceof HTMLInputElement &&
                o.addEventListener('input', () => {
                    var e;
                    ((e = o.value),
                        Oe({ search: String(e || ''), selected: [] }));
                });
            const s = document.getElementById('queueSearchInput');
            s instanceof HTMLInputElement &&
                s.addEventListener('input', () => {
                    Io(s.value);
                });
            const r = document.getElementById('adminQuickCommand');
            var l;
            r instanceof HTMLInputElement &&
                (l = r).addEventListener('keydown', async (e) => {
                    if ('Enter' !== e.key) return;
                    e.preventDefault();
                    const t = Sr(l.value);
                    t && (await Cr(t));
                });
        })(),
        (function () {
            const e = t('#adminMenuToggle'),
                a = t('#adminMenuClose'),
                n = t('#adminSidebarBackdrop');
            (e?.addEventListener('click', () => {
                pr() ? hr() : vr();
            }),
                a?.addEventListener('click', () => kr({ restoreFocus: !0 })),
                n?.addEventListener('click', () => kr({ restoreFocus: !0 })),
                window.addEventListener('resize', () => {
                    pr() ? gr() : kr();
                }),
                document.addEventListener('keydown', (e) => {
                    if (!pr() || !g().ui.sidebarOpen) return;
                    if ('Escape' === e.key)
                        return (
                            e.preventDefault(),
                            void kr({ restoreFocus: !0 })
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
                        return [a, n, ...i, o].filter(mr);
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
                        return or(
                            String(window.location.hash || '').replace(
                                /^#/,
                                ''
                            ),
                            e
                        );
                    })(g().ui.activeSection);
                    await fr(e, { force: !0 });
                }),
                window.addEventListener('storage', (e) => {
                    'themeMode' === e.key && cr(String(e.newValue || 'system'));
                }));
        })(),
        window.addEventListener('beforeunload', (e) => {
            vt() && (e.preventDefault(), (e.returnValue = ''));
        }));
    const e = document.getElementById('loginForm');
    var a;
    (e instanceof HTMLFormElement && e.addEventListener('submit', tr),
        (a = {
            navigateToSection: fr,
            focusQuickCommand: qr,
            focusCurrentSearch: $r,
            runQuickAction: Cr,
            closeSidebar: () => kr({ restoreFocus: !0 }),
            toggleMenu: () => {
                pr() ? hr() : vr();
            },
            dismissQueueSensitiveDialog: Ss,
            toggleQueueHelp: () => Ms(),
            queueNumpadAction: Ns,
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
                    { key: d, code: p } = h(e);
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
                const b = f[m];
                if (b) return (c() || (e.preventDefault(), a(b)), !0);
                const k = (
                    'queue' !== g().ui.activeSection ? y : { ...y, ...v }
                )[m];
                return !!k && (c() || (e.preventDefault(), o(k)), !0);
            })(e, a) ||
                (function (e, t) {
                    if ('function' != typeof t) return !1;
                    const a = g().queue,
                        n = Boolean(a.captureCallKeyMode),
                        { code: i } = h(e),
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
                $(a),
                b((e) => ({
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
              (I(), j(), await Xs(!1));
          })(),
          x(g().ui.activeSection))
        : (N(), j(), er()),
        ls ||
            'undefined' == typeof window ||
            ((ls = !0),
            window.setInterval(() => {
                ms('timer');
            }, us()),
            document.addEventListener('visibilitychange', bs),
            window.addEventListener('focus', fs),
            window.addEventListener('online', ys),
            gs({
                immediate:
                    g().auth?.authenticated &&
                    'queue' === g().ui?.activeSection,
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
            Zs();
        }, 3e4));
}
const Rr = (
    'loading' === document.readyState
        ? new Promise((e, t) => {
              document.addEventListener(
                  'DOMContentLoaded',
                  () => {
                      xr().then(e).catch(t);
                  },
                  { once: !0 }
              );
          })
        : xr()
).catch((e) => {
    throw (console.error('admin-v3 boot failed', e), e);
});
export { Rr as default };
