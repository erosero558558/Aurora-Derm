import { icon } from '../ui/icons.js';
import { escapeHtml, qs, qsa, setHtml, setText } from '../ui/render.js';

const SECTION_TITLES = {
    dashboard: 'Dashboard',
    appointments: 'Citas',
    callbacks: 'Callbacks',
    reviews: 'Resenas',
    availability: 'Disponibilidad',
    queue: 'Turnero Sala',
};

const SECTION_CONTEXT = {
    dashboard: {
        eyebrow: 'Control Deck',
        title: 'Vista general operativa',
        summary: 'Supervisa agenda, callbacks y cola desde un solo frente.',
        actions: [
            {
                action: 'context-open-appointments-transfer',
                label: 'Transferencias',
                meta: 'Revisar pagos por validar',
                shortcut: 'Alt+Shift+T',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Callbacks',
                meta: 'Atender pendientes',
                shortcut: 'Alt+Shift+P',
            },
            {
                action: 'refresh-admin-data',
                label: 'Sincronizar',
                meta: 'Refrescar tablero',
                shortcut: 'Ctrl+K',
            },
        ],
    },
    appointments: {
        eyebrow: 'Agenda',
        title: 'Triage de citas',
        summary: 'Filtra transferencias, no show y carga inmediata de agenda.',
        actions: [
            {
                action: 'clear-appointment-filters',
                label: 'Limpiar filtros',
                meta: 'Volver a la vista completa',
                shortcut: 'Reset',
            },
            {
                action: 'export-csv',
                label: 'Exportar CSV',
                meta: 'Descargar corte operativo',
                shortcut: 'CSV',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Ir a callbacks',
                meta: 'Cruzar citas con llamadas',
                shortcut: 'Alt+Shift+3',
            },
        ],
    },
    callbacks: {
        eyebrow: 'Triage',
        title: 'Callbacks accionables',
        summary: 'Prioriza SLA, resuelve pendientes y escala casos urgentes.',
        actions: [
            {
                action: 'callbacks-triage-next',
                label: 'Siguiente llamada',
                meta: 'Enfocar contacto prioritario',
                shortcut: 'Next',
            },
            {
                action: 'context-open-callbacks-next',
                label: 'Ir al siguiente',
                meta: 'Abrir tarjeta prioritaria',
                shortcut: 'Alt+Shift+3',
            },
            {
                action: 'context-open-appointments-transfer',
                label: 'Cruzar citas',
                meta: 'Ver pagos pendientes',
                shortcut: 'Alt+Shift+2',
            },
        ],
    },
    reviews: {
        eyebrow: 'Calidad',
        title: 'Lectura de resenas',
        summary: 'Detecta tono, volumen reciente y feedback util del paciente.',
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
                meta: 'Regresar al resumen',
                shortcut: 'Alt+Shift+1',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Ir a callbacks',
                meta: 'Cerrar el loop operativo',
                shortcut: 'Alt+Shift+3',
            },
        ],
    },
    availability: {
        eyebrow: 'Calendario',
        title: 'Planeacion de disponibilidad',
        summary:
            'Gestiona slots, duplicados y semanas futuras sin perder contexto.',
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
                meta: 'Buscar el siguiente hueco',
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
        eyebrow: 'Operacion Sala',
        title: 'Control de turnero',
        summary: 'Despacha C1/C2, vigila SLA y ejecuta acciones sensibles.',
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

function contextActionItem(action) {
    const extraAttrs = [
        `data-action="${escapeHtml(action.action)}"`,
        action.queueConsultorio
            ? `data-queue-consultorio="${escapeHtml(action.queueConsultorio)}"`
            : '',
        action.filterValue
            ? `data-filter-value="${escapeHtml(action.filterValue)}"`
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    return `
        <button type="button" class="sony-context-action" ${extraAttrs}>
            <span class="sony-context-action-copy">
                <strong>${escapeHtml(action.label)}</strong>
                <small>${escapeHtml(action.meta)}</small>
            </span>
            <span class="sony-context-action-key">${escapeHtml(action.shortcut || '')}</span>
        </button>
    `;
}

function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = String(
            item.paymentStatus || item.payment_status || ''
        ).toLowerCase();
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => {
        const status = String(item.status || '')
            .toLowerCase()
            .trim();
        return status === 'pending' || status === 'pendiente';
    }).length;
}

function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

function countWaitingTickets(queueTickets, queueMeta) {
    if (queueMeta && Number.isFinite(Number(queueMeta.waitingCount))) {
        return Math.max(0, Number(queueMeta.waitingCount));
    }

    return (Array.isArray(queueTickets) ? queueTickets : []).filter(
        (ticket) => String(ticket.status || '').toLowerCase() === 'waiting'
    ).length;
}

function formatSyncMeta(lastRefreshAt) {
    const ts = Number(lastRefreshAt || 0);
    if (!ts) return 'Listo para primera sincronizacion';

    return `Ultima carga ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}

function formatAuthMeta(auth) {
    const authState = auth && typeof auth === 'object' ? auth : {};

    if (authState.authenticated) {
        const methodMap = {
            session: 'sesion restaurada',
            password: 'clave validada',
            '2fa': '2FA validado',
        };
        const authMethod =
            methodMap[String(authState.authMethod || '')] || 'acceso validado';
        const validatedAt = Number(authState.lastAuthAt || 0);

        if (!validatedAt) {
            return `Protegida por ${authMethod}.`;
        }

        return `Protegida por ${authMethod}. ${new Date(
            validatedAt
        ).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    if (authState.requires2FA) {
        return 'Esperando codigo de seis digitos para completar el acceso.';
    }

    return 'Autenticate para operar el panel.';
}

function sectionTemplate() {
    return `
        <section id="dashboard" class="admin-section active" tabindex="-1">
            <div class="dashboard-stage">
                <article class="sony-panel dashboard-hero-panel">
                    <div class="dashboard-hero-copy">
                        <p class="sony-kicker">Admin premium minimal</p>
                        <h3>Centro operativo diario</h3>
                        <p id="dashboardHeroSummary">
                            Agenda, callbacks y disponibilidad en una sola vista de control.
                        </p>
                    </div>
                    <div class="dashboard-hero-actions">
                        <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>
                        <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>
                        <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>
                    </div>
                    <div class="dashboard-hero-metrics">
                        <div class="dashboard-hero-metric">
                            <span>Rating</span>
                            <strong id="dashboardHeroRating">0.0</strong>
                        </div>
                        <div class="dashboard-hero-metric">
                            <span>Resenas 30d</span>
                            <strong id="dashboardHeroRecentReviews">0</strong>
                        </div>
                        <div class="dashboard-hero-metric">
                            <span>Urgentes SLA</span>
                            <strong id="dashboardHeroUrgentCallbacks">0</strong>
                        </div>
                        <div class="dashboard-hero-metric">
                            <span>Transferencias</span>
                            <strong id="dashboardHeroPendingTransfers">0</strong>
                        </div>
                    </div>
                </article>

                <article class="sony-panel dashboard-signal-panel">
                    <header>
                        <div>
                            <h3>Señal operativa</h3>
                            <small id="operationRefreshSignal">Tiempo real</small>
                        </div>
                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
                    </header>
                    <p id="dashboardLiveMeta">
                        Sin alertas criticas en la operacion actual.
                    </p>
                    <div class="dashboard-signal-stack">
                        <article class="dashboard-signal-card">
                            <span>Push</span>
                            <strong id="dashboardPushStatus">Sin validar</strong>
                            <small id="dashboardPushMeta">Permisos del navegador</small>
                        </article>
                        <article class="dashboard-signal-card">
                            <span>Atencion</span>
                            <strong id="dashboardQueueHealth">Cola: estable</strong>
                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>
                        </article>
                    </div>
                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
                </article>
            </div>

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
                        <small id="operationDeckMeta">Prioridades y acciones</small>
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
            <div class="appointments-stage">
                <article class="sony-panel appointments-command-deck">
                    <header class="section-header appointments-command-head">
                        <div>
                            <p class="sony-kicker">Agenda Premium</p>
                            <h3>Citas</h3>
                            <p id="appointmentsDeckSummary">Sin citas cargadas.</p>
                        </div>
                        <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>
                    </header>
                    <div class="appointments-ops-grid">
                        <article class="appointments-ops-card tone-warning">
                            <span>Transferencias</span>
                            <strong id="appointmentsOpsPendingTransfer">0</strong>
                            <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>
                        </article>
                        <article class="appointments-ops-card tone-neutral">
                            <span>Proximas 48h</span>
                            <strong id="appointmentsOpsUpcomingCount">0</strong>
                            <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>
                        </article>
                        <article class="appointments-ops-card tone-danger">
                            <span>No show</span>
                            <strong id="appointmentsOpsNoShowCount">0</strong>
                            <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>
                        </article>
                        <article class="appointments-ops-card tone-success">
                            <span>Hoy</span>
                            <strong id="appointmentsOpsTodayCount">0</strong>
                            <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>
                        </article>
                    </div>
                    <div class="appointments-command-actions">
                        <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>
                        <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>
                        <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>
                    </div>
                </article>

                <article class="sony-panel appointments-focus-panel">
                    <header class="section-header">
                        <div>
                            <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>
                            <h3 id="appointmentsFocusPatient">Sin citas activas</h3>
                            <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>
                        </div>
                    </header>
                    <div class="appointments-focus-grid">
                        <div class="appointments-focus-stat">
                            <span>Siguiente ventana</span>
                            <strong id="appointmentsFocusWindow">-</strong>
                        </div>
                        <div class="appointments-focus-stat">
                            <span>Pago</span>
                            <strong id="appointmentsFocusPayment">-</strong>
                        </div>
                        <div class="appointments-focus-stat">
                            <span>Estado</span>
                            <strong id="appointmentsFocusStatus">-</strong>
                        </div>
                        <div class="appointments-focus-stat">
                            <span>Contacto</span>
                            <strong id="appointmentsFocusContact">-</strong>
                        </div>
                    </div>
                    <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>
                    <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>
                </article>
            </div>

            <div class="sony-panel appointments-workbench">
                <header class="section-header appointments-workbench-head">
                    <div>
                        <h3>Workbench</h3>
                        <p id="appointmentsWorkbenchHint">Triage, pagos y seguimiento sin salir de la mesa.</p>
                    </div>
                    <div class="toolbar-group" id="appointmentsDensityToggle">
                        <button type="button" data-action="appointment-density" data-density="comfortable" class="is-active">Comodo</button>
                        <button type="button" data-action="appointment-density" data-density="compact">Compacto</button>
                    </div>
                </header>
                <div class="toolbar-row">
                    <div class="toolbar-group">
                        <button type="button" class="appointment-quick-filter-btn is-active" data-action="appointment-quick-filter" data-filter-value="all">Todas</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="pending_transfer">Transferencias</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="upcoming_48h">48h</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="no_show">No show</button>
                        <button type="button" class="appointment-quick-filter-btn" data-action="appointment-quick-filter" data-filter-value="triage_attention">Triage</button>
                    </div>
                </div>
                <div class="toolbar-row appointments-toolbar">
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

                <div class="table-scroll appointments-table-shell">
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
            <div class="callbacks-stage">
                <article class="sony-panel callbacks-command-deck">
                    <header class="section-header callbacks-command-head">
                        <div>
                            <p class="sony-kicker">Triage de SLA</p>
                            <h3>Callbacks</h3>
                            <p id="callbacksDeckSummary">Sin callbacks pendientes.</p>
                        </div>
                        <span class="callbacks-queue-chip" id="callbacksQueueChip">Cola estable</span>
                    </header>
                    <div id="callbacksOpsPanel" class="callbacks-ops-grid">
                        <article class="callbacks-ops-card"><span>Pendientes</span><strong id="callbacksOpsPendingCount">0</strong></article>
                        <article class="callbacks-ops-card"><span>Urgentes</span><strong id="callbacksOpsUrgentCount">0</strong></article>
                        <article class="callbacks-ops-card"><span>Hoy</span><strong id="callbacksOpsTodayCount">0</strong></article>
                        <article class="callbacks-ops-card wide"><span>Estado</span><strong id="callbacksOpsQueueHealth">Cola: estable</strong></article>
                    </div>
                    <div class="callbacks-command-actions">
                        <button type="button" id="callbacksOpsNextBtn" data-action="callbacks-triage-next">Siguiente llamada</button>
                        <button type="button" id="callbacksBulkSelectVisibleBtn">Seleccionar visibles</button>
                        <button type="button" id="callbacksBulkClearBtn">Limpiar seleccion</button>
                        <button type="button" id="callbacksBulkMarkBtn">Marcar contactados</button>
                    </div>
                </article>

                <article class="sony-panel callbacks-next-panel">
                    <header class="section-header">
                        <div>
                            <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente contacto</p>
                            <h3 id="callbacksOpsNext">Sin telefono</h3>
                            <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>
                        </div>
                        <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>
                    </header>
                    <div class="callbacks-next-grid">
                        <div class="callbacks-next-stat">
                            <span>Espera</span>
                            <strong id="callbacksNextWait">0 min</strong>
                        </div>
                        <div class="callbacks-next-stat">
                            <span>Preferencia</span>
                            <strong id="callbacksNextPreference">-</strong>
                        </div>
                        <div class="callbacks-next-stat">
                            <span>Estado</span>
                            <strong id="callbacksNextState">Pendiente</strong>
                        </div>
                        <div class="callbacks-next-stat">
                            <span>Ultimo corte</span>
                            <strong id="callbacksDeckHint">Sin bloqueos</strong>
                        </div>
                    </div>
                </article>
            </div>
            <div class="sony-panel callbacks-workbench">
                <header class="section-header callbacks-workbench-head">
                    <div>
                        <h3>Workbench</h3>
                        <p>Ordena por espera, filtra por SLA y drena la cola con acciones masivas.</p>
                    </div>
                </header>
                <div class="toolbar-row">
                    <div class="toolbar-group">
                        <button type="button" class="callback-quick-filter-btn is-active" data-action="callback-quick-filter" data-filter-value="all">Todos</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="pending">Pendientes</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="contacted">Contactados</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="today">Hoy</button>
                        <button type="button" class="callback-quick-filter-btn" data-action="callback-quick-filter" data-filter-value="sla_urgent">Urgentes SLA</button>
                    </div>
                </div>
                <div class="toolbar-row callbacks-toolbar">
                    <label>
                        <span class="sr-only">Filtro callbacks</span>
                        <select id="callbackFilter">
                            <option value="all">Todos</option>
                            <option value="pending">Pendientes</option>
                            <option value="contacted">Contactados</option>
                            <option value="today">Hoy</option>
                            <option value="sla_urgent">Urgentes SLA</option>
                        </select>
                    </label>
                    <label>
                        <span class="sr-only">Orden callbacks</span>
                        <select id="callbackSort">
                            <option value="recent_desc">Mas recientes</option>
                            <option value="waiting_desc">Mayor espera (SLA)</option>
                        </select>
                    </label>
                    <input type="search" id="searchCallbacks" placeholder="Buscar telefono" />
                    <button type="button" id="clearCallbacksFiltersBtn" data-action="clear-callback-filters">Limpiar</button>
                </div>
                <div class="toolbar-row slim">
                    <p id="callbacksToolbarMeta">Mostrando 0</p>
                    <p id="callbacksToolbarState">Sin filtros activos</p>
                </div>
                <div id="callbacksGrid" class="callbacks-grid"></div>
            </div>
        </section>

        <section id="reviews" class="admin-section" tabindex="-1">
            <div class="reviews-stage">
                <article class="sony-panel reviews-summary-panel">
                    <header class="section-header">
                        <div>
                            <h3>Resenas</h3>
                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>
                        </div>
                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>
                    </header>
                    <div class="reviews-summary-grid">
                        <div class="reviews-summary-stat">
                            <span>5 estrellas</span>
                            <strong id="reviewsFiveStarCount">0</strong>
                        </div>
                        <div class="reviews-summary-stat">
                            <span>Ultimos 30 dias</span>
                            <strong id="reviewsRecentCount">0</strong>
                        </div>
                        <div class="reviews-summary-stat">
                            <span>Total</span>
                            <strong id="reviewsTotalCount">0</strong>
                        </div>
                    </div>
                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>
                </article>

                <article class="sony-panel reviews-spotlight-panel">
                    <header class="section-header"><h3>Spotlight</h3></header>
                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>
                </article>
            </div>
            <div class="sony-panel">
                <div id="reviewsGrid" class="reviews-grid"></div>
            </div>
        </section>

        <section id="availability" class="admin-section" tabindex="-1">
            <div class="sony-panel availability-container">
                <header class="section-header availability-header">
                    <div class="availability-calendar">
                        <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>
                        <div class="availability-badges">
                            <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>
                            <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>
                            <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>
                        </div>
                    </div>
                    <div class="toolbar-group calendar-header">
                        <button type="button" data-action="change-month" data-delta="-1">Prev</button>
                        <strong id="calendarMonth"></strong>
                        <button type="button" data-action="change-month" data-delta="1">Next</button>
                        <button type="button" data-action="availability-today">Hoy</button>
                        <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>
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
                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>
                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>
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
                    <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>
                    <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>
                    <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>
                    <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>
                    <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>
                </div>

                <div class="toolbar-row slim">
                    <p id="queueTriageSummary">Sin riesgo</p>
                    <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>
                </div>

                <ul id="queueNextAdminList" class="sony-list"></ul>

                <div class="table-scroll">
                    <table class="sony-table queue-admin-table">
                        <thead>
                            <tr>
                                <th>Sel</th>
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
            <section class="sony-login-hero">
                <div class="sony-login-brand">
                    <p class="sony-kicker">Piel en Armonia</p>
                    <h1>Admin Operations</h1>
                    <p>Centro de control con una capa visual premium, autenticacion endurecida y flujo rapido para operacion diaria.</p>
                </div>
                <div class="sony-login-badge-row">
                    <span class="sony-login-badge">Sony-like UI</span>
                    <span class="sony-login-badge">CSP self-hosted</span>
                    <span class="sony-login-badge">2FA ready</span>
                </div>
                <div class="sony-login-trust-grid">
                    <article class="sony-login-trust-card">
                        <span>Acceso</span>
                        <strong>Sesion de administrador</strong>
                        <small>Entrada aislada para operacion y triage.</small>
                    </article>
                    <article class="sony-login-trust-card">
                        <span>Proteccion</span>
                        <strong>Clave + verificacion</strong>
                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>
                    </article>
                    <article class="sony-login-trust-card">
                        <span>Entorno</span>
                        <strong>Activos locales</strong>
                        <small>Fuentes, iconos y estilos propios sin dependencias remotas.</small>
                    </article>
                </div>
            </section>

            <section class="sony-login-panel">
                <div class="sony-login-panel-head">
                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>
                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>
                    <p id="adminLoginStepSummary">
                        Usa tu clave para entrar al centro operativo.
                    </p>
                </div>

                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">
                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>
                    <p id="adminLoginStatusMessage">
                        El panel usa autenticacion endurecida y activos self-hosted.
                    </p>
                </div>

                <form id="loginForm" class="sony-login-form" novalidate>
                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">
                        <span>Contrasena</span>
                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />
                    </label>
                    <div id="group2FA" class="is-hidden">
                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">
                            <span>Codigo 2FA</span>
                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />
                        </label>
                    </div>
                    <div class="admin-login-actions">
                        <button id="loginBtn" type="submit">Ingresar</button>
                        <button
                            id="loginReset2FABtn"
                            type="button"
                            class="sony-login-reset is-hidden"
                            data-action="reset-login-2fa"
                        >
                            Volver
                        </button>
                    </div>
                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">
                        Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.
                    </p>
                </form>

                <div class="sony-theme-switcher login-theme-bar" role="group" aria-label="Tema">
                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
                    <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
                </div>
            </section>
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
                </div>
            </header>

            <section class="sony-context-strip" id="adminProductivityStrip">
                <div class="sony-context-grid">
                    <div class="sony-context-copy">
                        <p class="sony-kicker" id="adminSectionEyebrow">Control Deck</p>
                        <h3 id="adminContextTitle">Vista general operativa</h3>
                        <p id="adminContextSummary">Monitorea agenda, callbacks y cola desde un solo frente.</p>
                        <div id="adminContextActions" class="sony-context-actions"></div>
                    </div>
                    <div class="sony-command-stage">
                        <div class="sony-command-box">
                            <input id="adminQuickCommand" type="text" placeholder="Comando rapido (Ctrl+K)" />
                            <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>
                        </div>
                        <div class="sony-status-cluster">
                            <article class="sony-status-tile">
                                <span>Push</span>
                                <strong id="pushStatusIndicator">Inicializando</strong>
                                <small id="pushStatusMeta">Comprobando permisos del navegador</small>
                            </article>
                            <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">
                                <span>Sesion</span>
                                <strong id="adminSessionState">No autenticada</strong>
                                <small id="adminSessionMeta">Autenticate para operar el panel</small>
                            </article>
                            <article class="sony-status-tile">
                                <span>Sincronizacion</span>
                                <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>
                                <small id="adminSyncState">Listo para primera sincronizacion</small>
                            </article>
                        </div>
                    </div>
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
    const summary = qs('#adminLoginStepSummary');
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');

    if (!group) return;

    group.classList.toggle('is-hidden', !visible);
    form?.classList.toggle('is-2fa-stage', Boolean(visible));
    resetBtn?.classList.toggle('is-hidden', !visible);

    if (eyebrow) {
        eyebrow.textContent = visible
            ? 'Verificacion secundaria'
            : 'Ingreso protegido';
    }
    if (title) {
        title.textContent = visible
            ? 'Confirma el codigo 2FA'
            : 'Acceso de administrador';
    }
    if (summary) {
        summary.textContent = visible
            ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
            : 'Usa tu clave para entrar al centro operativo.';
    }
    if (support) {
        support.textContent = visible
            ? 'El backend ya valido la clave. Falta la segunda verificacion.'
            : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.';
    }

    setLoginSubmittingState(false);
}

export function getSectionTitle(section) {
    return SECTION_TITLES[section] || 'Dashboard';
}

export function setLoginFeedback({
    tone = 'neutral',
    title = 'Proteccion activa',
    message = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const card = qs('#adminLoginStatusCard');
    const titleEl = qs('#adminLoginStatusTitle');
    const messageEl = qs('#adminLoginStatusMessage');

    card?.setAttribute('data-state', tone);
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
}

export function setLoginSubmittingState(submitting) {
    const button = qs('#loginBtn');
    const resetBtn = qs('#loginReset2FABtn');
    const passwordInput = qs('#adminPassword');
    const codeInput = qs('#admin2FACode');
    const group = qs('#group2FA');
    const requires2FA = Boolean(
        group && !group.classList.contains('is-hidden')
    );

    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled = Boolean(submitting) || requires2FA;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled = Boolean(submitting) || !requires2FA;
    }

    if (button instanceof HTMLButtonElement) {
        button.disabled = Boolean(submitting);
        button.textContent = submitting
            ? requires2FA
                ? 'Verificando...'
                : 'Ingresando...'
            : requires2FA
              ? 'Verificar y entrar'
              : 'Ingresar';
    }

    if (resetBtn instanceof HTMLButtonElement) {
        resetBtn.disabled = Boolean(submitting);
    }
}

export function resetLoginForm({ clearPassword = false } = {}) {
    const passwordInput = qs('#adminPassword');
    const codeInput = qs('#admin2FACode');

    if (passwordInput instanceof HTMLInputElement && clearPassword) {
        passwordInput.value = '';
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.value = '';
    }
}

export function focusLoginField(field = 'password') {
    const target = field === '2fa' ? qs('#admin2FACode') : qs('#adminPassword');
    if (target instanceof HTMLInputElement) {
        target.focus();
        target.select?.();
    }
}

export function renderAdminChrome(state) {
    const section = state?.ui?.activeSection || 'dashboard';
    const config = SECTION_CONTEXT[section] || SECTION_CONTEXT.dashboard;
    const auth =
        state?.auth && typeof state.auth === 'object' ? state.auth : {};
    const appointments = Array.isArray(state?.data?.appointments)
        ? state.data.appointments
        : [];
    const callbacks = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const availability =
        state?.data?.availability && typeof state.data.availability === 'object'
            ? state.data.availability
            : {};
    const queueTickets = Array.isArray(state?.data?.queueTickets)
        ? state.data.queueTickets
        : [];
    const queueMeta =
        state?.data?.queueMeta && typeof state.data.queueMeta === 'object'
            ? state.data.queueMeta
            : null;

    setText('#adminSectionEyebrow', config.eyebrow);
    setText('#adminContextTitle', config.title);
    setText('#adminContextSummary', config.summary);
    setHtml(
        '#adminContextActions',
        config.actions.map((action) => contextActionItem(action)).join('')
    );
    setText('#adminSyncState', formatSyncMeta(state?.ui?.lastRefreshAt || 0));

    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const availabilityDays = countAvailabilityDays(availability);
    const waitingTickets = countWaitingTickets(queueTickets, queueMeta);
    const dashboardAlerts = pendingTransfers + pendingCallbacks;

    setText('#dashboardBadge', dashboardAlerts);
    setText('#appointmentsBadge', appointments.length);
    setText('#callbacksBadge', pendingCallbacks);
    setText('#reviewsBadge', reviews.length);
    setText('#availabilityBadge', availabilityDays);
    setText('#queueBadge', waitingTickets);

    const sessionTile = qs('#adminSessionTile');
    const sessionLabel = auth.authenticated
        ? 'Sesion activa'
        : auth.requires2FA
          ? 'Verificacion 2FA'
          : 'No autenticada';
    const sessionTone = auth.authenticated
        ? 'success'
        : auth.requires2FA
          ? 'warning'
          : 'neutral';

    sessionTile?.setAttribute('data-state', sessionTone);
    setText('#adminSessionState', sessionLabel);
    setText('#adminSessionMeta', formatAuthMeta(auth));
}
