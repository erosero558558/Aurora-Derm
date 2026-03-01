import { icon } from '../ui/icons.js';
import { qs, qsa } from '../ui/render.js';

const SECTION_TITLES = {
    dashboard: 'Dashboard',
    appointments: 'Citas',
    callbacks: 'Callbacks',
    reviews: 'Resenas',
    availability: 'Disponibilidad',
    queue: 'Turnero Sala',
};

function quickNavItem(section, label, shortcut, isActive = false) {
    return `
        <button
            type="button"
            class="admin-quick-nav-item${isActive ? ' active' : ''}"
            data-section="${section}"
            aria-pressed="${isActive ? 'true' : 'false'}"
        >
            <span>${label}</span>
            <span class="admin-quick-nav-shortcut">${shortcut}</span>
        </button>
    `;
}

function navItem(section, label, iconName, isActive = false) {
    return `
        <a
            href="#${section}"
            class="nav-item${isActive ? ' active' : ''}"
            data-section="${section}"
            ${isActive ? 'aria-current="page"' : ''}
        >
            ${icon(iconName)}
            <span>${label}</span>
            <span class="badge" id="${section}Badge">0</span>
        </a>
    `;
}

function sectionTemplate() {
    return `
        <section id="dashboard" class="admin-section active" tabindex="-1">
            <div class="sony-grid sony-grid-kpi">
                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>
                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>
                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>
                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>
                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>
                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>
            </div>

            <div class="sony-grid sony-grid-two">
                <article class="sony-panel dashboard-card-operations">
                    <header>
                        <h3>Centro operativo</h3>
                        <small id="operationRefreshSignal">Tiempo real</small>
                    </header>
                    <div class="sony-panel-stats">
                        <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>
                        <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>
                        <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>
                    </div>
                    <p id="operationQueueHealth">Cola: estable</p>
                    <div id="operationActionList" class="operations-action-list"></div>
                </article>

                <article class="sony-panel" id="funnelSummary">
                    <header><h3>Embudo</h3></header>
                    <div class="sony-panel-stats">
                        <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>
                        <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>
                        <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>
                        <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>
                    </div>
                </article>
            </div>

            <div class="sony-grid sony-grid-three">
                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>
            </div>
            <div class="sr-only" id="adminAvgRating"></div>
        </section>

        <section id="appointments" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                <header class="section-header"><h3>Citas</h3></header>
                <div class="toolbar-row">
                    <div class="toolbar-group">
                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>
                    </div>
                    <div class="toolbar-group" id="appointmentsDensityToggle">
                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>
                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>
                    </div>
                </div>
                <div class="toolbar-row">
                    <label>
                        <span class="sr-only">Filtro</span>
                        <select id="appointmentFilter">
                            <option value="all">Todas</option>
                            <option value="pending_transfer">Transferencias por validar</option>
                            <option value="upcoming_48h">Proximas 48h</option>
                            <option value="no_show">No show</option>
                            <option value="triage_attention">Triage accionable</option>
                        </select>
                    </label>
                    <label>
                        <span class="sr-only">Orden</span>
                        <select id="appointmentSort">
                            <option value="datetime_desc">Fecha reciente</option>
                            <option value="datetime_asc">Fecha ascendente</option>
                            <option value="patient_az">Paciente (A-Z)</option>
                        </select>
                    </label>
                    <input type="search" id="searchAppointments" placeholder="Buscar paciente" />
                    <button type="button" id="clearAppointmentsFiltersBtn" data-action="clear-appointment-filters" class="is-hidden">Limpiar</button>
                </div>
                <div class="toolbar-row slim">
                    <p id="appointmentsToolbarMeta">Mostrando 0</p>
                    <p id="appointmentsToolbarState">Sin filtros activos</p>
                </div>

                <div class="table-scroll">
                    <table id="appointmentsTable" class="sony-table">
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Servicio</th>
                                <th>Fecha</th>
                                <th>Pago</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="appointmentsTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <section id="callbacks" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                <header class="section-header"><h3>Callbacks</h3></header>
                <div id="callbacksOpsPanel" class="sony-grid sony-grid-kpi slim">
                    <article class="sony-kpi"><h4>Pendientes</h4><strong id="callbacksOpsPendingCount">0</strong></article>
                    <article class="sony-kpi"><h4>Urgentes</h4><strong id="callbacksOpsUrgentCount">0</strong></article>
                    <article class="sony-kpi"><h4>Siguiente</h4><strong id="callbacksOpsNext">-</strong></article>
                    <article class="sony-kpi"><h4>Estado</h4><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>
                    <article class="sony-kpi"><h4>Hoy</h4><strong id="callbacksOpsTodayCount">0</strong></article>
                </div>
                <div class="toolbar-row">
                    <div class="toolbar-group">
                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>
                    </div>
                    <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>
                </div>
                <div class="toolbar-row">
                    <label>
                        <span class="sr-only">Filtro callbacks</span>
                        <select id="callbackFilter">
                            <option value="all">Todos</option>
                            <option value="pending">Pendientes</option>
                            <option value="contacted">Contactados</option>
                            <option value="today">Hoy</option>
                        </select>
                    </label>
                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />
                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>
                    <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>
                    <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>
                </div>
                <div class="toolbar-row slim">
                    <p id="callbacksToolbarMeta">Mostrando 0</p>
                    <p id="callbacksToolbarState">Sin filtros activos</p>
                    <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>
                </div>
                <div id="callbacksGrid" class="callbacks-grid"></div>
            </div>
        </section>

        <section id="reviews" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                <header class="section-header"><h3>Resenas</h3></header>
                <div id="reviewsGrid" class="reviews-grid"></div>
            </div>
        </section>

        <section id="availability" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                <header class="section-header">
                    <h3 class="availability-calendar">Disponibilidad</h3>
                    <div class="toolbar-group">
                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>
                        <strong id="calendarMonth"></strong>
                        <button type="button" data-action="change-month" data-delta="1">Next</button>
                        <button type="button" data-action="availability-today">Hoy</button>
                        <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>
                    </div>
                </header>

                <div class="toolbar-row slim">
                    <p id="availabilitySelectionSummary">Selecciona una fecha</p>
                    <p id="availabilityDraftStatus">Sin cambios pendientes</p>
                    <p id="availabilitySyncStatus">Sincronizado</p>
                </div>

                <div id="availabilityCalendar" class="availability-calendar-grid"></div>

                <div id="availabilityDetailGrid" class="availability-detail-grid">
                    <article class="sony-panel soft">
                        <h4 id="selectedDate">-</h4>
                        <div id="timeSlotsList" class="time-slots-list"></div>
                    </article>

                    <article class="sony-panel soft">
                        <div id="availabilityQuickSlotPresets" class="slot-presets">
                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>
                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>
                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>
                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>
                            <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>
                        </div>
                        <div id="addSlotForm" class="add-slot-form">
                            <input type="time" id="newSlotTime" />
                            <button type="button" data-action="add-time-slot">Agregar</button>
                        </div>
                        <div id="availabilityDayActions" class="toolbar-group wrap">
                            <button type="button" data-action="copy-availability-day">Copiar dia</button>
                            <button type="button" data-action="paste-availability-day">Pegar dia</button>
                            <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>
                            <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>
                            <button type="button" data-action="clear-availability-day">Limpiar dia</button>
                            <button type="button" data-action="clear-availability-week">Limpiar semana</button>
                        </div>
                        <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>
                        <div class="toolbar-group">
                            <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>
                            <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        <section id="queue" class="admin-section" tabindex="-1">
            <div class="sony-panel">
                <header class="section-header">
                    <h3>Turnero Sala</h3>
                    <div class="queue-admin-header-actions">
                        <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>
                        <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>
                        <button type="button" data-action="queue-refresh-state">Refrescar</button>
                    </div>
                </header>

                <div class="sony-grid sony-grid-kpi slim">
                    <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>
                    <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>
                    <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>
                    <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>
                    <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>
                </div>

                <div id="queueStationControl" class="toolbar-row">
                    <span id="queueStationBadge">Estacion: libre</span>
                    <span id="queueStationModeBadge">Modo: free</span>
                    <span id="queuePracticeModeBadge" hidden>Practice ON</span>
                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>
                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>
                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>
                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>
                    <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>
                    <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>
                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>
                    <button type="button" data-action="queue-start-practice">Iniciar practica</button>
                    <button type="button" data-action="queue-stop-practice">Salir practica</button>
                </div>

                <div id="queueShortcutPanel" hidden>
                    <p>Numpad Enter llama siguiente.</p>
                    <p>Numpad Decimal prepara completar.</p>
                    <p>Numpad Subtract prepara no_show.</p>
                </div>

                <div id="queueTriageToolbar" class="toolbar-row">
                    <button type="button" data-queue-filter="all">Todo</button>
                    <button type="button" data-queue-filter="called">Llamados</button>
                    <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>
                    <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />
                    <button type="button" data-action="queue-clear-search">Limpiar</button>
                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>
                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>
                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>
                </div>

                <p id="queueTriageSummary">Sin riesgo</p>

                <ul id="queueNextAdminList" class="sony-list"></ul>

                <div class="table-scroll">
                    <table class="sony-table queue-admin-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Consultorio</th>
                                <th>Espera</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="queueTableBody"></tbody>
                    </table>
                </div>

                <div id="queueActivityPanel" class="sony-panel soft">
                    <h4>Actividad</h4>
                    <ul id="queueActivityList" class="sony-list"></ul>
                </div>
            </div>

            <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">
                <form method="dialog">
                    <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>
                    <div class="toolbar-group">
                        <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>
                        <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>
                    </div>
                </form>
            </dialog>

            <button type="button" id="queueReleaseC1" hidden>release</button>
        </section>
    `;
}

export function renderV2Shell() {
    const loginScreen = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');

    if (
        !(loginScreen instanceof HTMLElement) ||
        !(dashboard instanceof HTMLElement)
    ) {
        throw new Error('Contenedores admin no encontrados');
    }

    loginScreen.innerHTML = `
        <div class="sony-login-shell">
            <div class="sony-login-brand">
                <p class="sony-kicker">Piel en Armonia</p>
                <h1>Admin Operations</h1>
                <p>Panel operativo con estilo Sony-like.</p>
            </div>
            <form id="loginForm" class="sony-login-form">
                <label for="adminPassword">Contrasena</label>
                <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" />
                <div id="group2FA" class="is-hidden">
                    <label for="admin2FACode">Codigo 2FA</label>
                    <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" />
                </div>
                <button id="loginBtn" type="submit">Ingresar</button>
            </form>
            <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">
                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
                <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
            </div>
        </div>
    `;

    dashboard.innerHTML = `
        <aside class="admin-sidebar" id="adminSidebar" tabindex="-1">
            <header class="sidebar-header">
                <strong>Piel en Armonia</strong>
                <div class="toolbar-group">
                    <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${icon('menu')}</button>
                    <button type="button" id="adminMenuClose">Cerrar</button>
                </div>
            </header>
            <nav class="sidebar-nav" id="adminSidebarNav">
                ${navItem('dashboard', 'Dashboard', 'dashboard', true)}
                ${navItem('appointments', 'Citas', 'appointments')}
                ${navItem('callbacks', 'Callbacks', 'callbacks')}
                ${navItem('reviews', 'Resenas', 'reviews')}
                ${navItem('availability', 'Disponibilidad', 'availability')}
                ${navItem('queue', 'Turnero Sala', 'queue')}
            </nav>
            <footer class="sidebar-footer">
                <button type="button" class="logout-btn" data-action="logout">${icon('logout')}<span>Cerrar sesion</span></button>
            </footer>
        </aside>
        <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>

        <main class="admin-main" id="adminMainContent" tabindex="-1">
            <header class="admin-header">
                <div class="admin-header-title-wrap">
                    <button type="button" id="adminMenuToggle" aria-controls="adminSidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
                    <h2 id="pageTitle">Dashboard</h2>
                </div>
                <nav class="admin-quick-nav" data-qa="admin-quick-nav" aria-label="Navegacion rapida">
                    ${quickNavItem('dashboard', 'Dashboard', 'Alt+Shift+1', true)}
                    ${quickNavItem('appointments', 'Citas', 'Alt+Shift+2')}
                    ${quickNavItem('callbacks', 'Callbacks', 'Alt+Shift+3')}
                    ${quickNavItem('reviews', 'Resenas', 'Alt+Shift+4')}
                    ${quickNavItem('availability', 'Disponibilidad', 'Alt+Shift+5')}
                    ${quickNavItem('queue', 'Turnero', 'Alt+Shift+6')}
                </nav>
                <div class="admin-header-actions">
                    <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">
                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
                        <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
                    </div>
                    <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>
                    <p id="adminRefreshStatus">Datos: sin sincronizar</p>
                </div>
            </header>

            <section class="sony-context-strip" id="adminProductivityStrip">
                <h3 id="adminContextTitle">Acciones rapidas</h3>
                <div id="adminContextActions"></div>
                <div class="sony-command-box">
                    <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />
                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>
                </div>
            </section>

            ${sectionTemplate()}
        </main>
    `;
}

export function showLoginView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

export function showDashboardView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
}

export function setActiveSection(section) {
    qsa('.admin-section').forEach((node) => {
        node.classList.toggle('active', node.id === section);
    });

    qsa('.nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        if (active) {
            node.setAttribute('aria-current', 'page');
        } else {
            node.removeAttribute('aria-current');
        }
    });

    qsa('.admin-quick-nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        node.setAttribute('aria-pressed', String(active));
    });

    const title = SECTION_TITLES[section] || 'Dashboard';
    const pageTitle = qs('#pageTitle');
    if (pageTitle) pageTitle.textContent = title;
}

export function setSidebarState({ open, collapsed }) {
    const sidebar = qs('#adminSidebar');
    const backdrop = qs('#adminSidebarBackdrop');
    const toggle = qs('#adminMenuToggle');

    if (sidebar) sidebar.classList.toggle('is-open', Boolean(open));
    if (backdrop) backdrop.classList.toggle('is-hidden', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(Boolean(open)));

    document.body.classList.toggle('admin-sidebar-open', Boolean(open));
    document.body.classList.toggle(
        'admin-sidebar-collapsed',
        Boolean(collapsed)
    );

    const collapseBtn = qs('#adminSidebarCollapse');
    if (collapseBtn)
        collapseBtn.setAttribute('aria-pressed', String(Boolean(collapsed)));
}

export function setLogin2FAVisibility(visible) {
    const group = qs('#group2FA');
    if (!group) return;
    group.classList.toggle('is-hidden', !visible);
}

export function getSectionTitle(section) {
    return SECTION_TITLES[section] || 'Dashboard';
}
