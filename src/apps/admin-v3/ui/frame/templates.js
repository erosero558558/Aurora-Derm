import { icon } from '../../shared/ui/icons.js';
import { escapeHtml, qs } from '../../shared/ui/render.js';

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

export function contextActionItem(action) {
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

function sectionTemplate() {
    return `
        <section id="dashboard" class="admin-section active" tabindex="-1">
            <div class="dashboard-stage">
                <article class="sony-panel dashboard-hero-panel">
                    <div class="dashboard-hero-copy">
                        <p class="sony-kicker">Resumen diario</p>
                        <h3>Prioridades de hoy</h3>
                        <p id="dashboardHeroSummary">
                            Agenda, callbacks y disponibilidad con una lectura mas clara y directa.
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
                            <p class="sony-kicker">Agenda clinica</p>
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
                        <p id="appointmentsWorkbenchHint">Filtros, orden y tabla en un workbench unico.</p>
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
                            <p class="sony-kicker">SLA telefonico</p>
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

export function renderV3Frame() {
    const loginScreen = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');

    if (
        !(loginScreen instanceof HTMLElement) ||
        !(dashboard instanceof HTMLElement)
    ) {
        throw new Error('Contenedores admin no encontrados');
    }

    loginScreen.innerHTML = `
        <div class="admin-v3-login">
            <section class="admin-v3-login__hero">
                <div class="admin-v3-login__brand">
                    <p class="sony-kicker">Piel en Armonia</p>
                    <h1>Centro operativo claro y protegido</h1>
                    <p>
                        Acceso editorial para agenda, callbacks y disponibilidad con
                        jerarquia simple y lectura rapida.
                    </p>
                </div>
                <div class="admin-v3-login__facts">
                    <article class="admin-v3-login__fact">
                        <span>Sesion</span>
                        <strong>Acceso administrativo aislado</strong>
                        <small>Entrada dedicada para operacion diaria.</small>
                    </article>
                    <article class="admin-v3-login__fact">
                        <span>Proteccion</span>
                        <strong>Clave y 2FA en la misma tarjeta</strong>
                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>
                    </article>
                    <article class="admin-v3-login__fact">
                        <span>Entorno</span>
                        <strong>Activos self-hosted y CSP activa</strong>
                        <small>Sin dependencias remotas para estilos ni fuentes.</small>
                    </article>
                </div>
            </section>

            <section class="admin-v3-login__panel">
                <div class="admin-v3-login__panel-head">
                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>
                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>
                    <p id="adminLoginStepSummary">
                        Usa tu clave para abrir el workbench operativo.
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
                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.
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
        <div class="admin-v3-shell">
            <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">
                <header class="sidebar-header">
                    <div class="admin-v3-sidebar__brand">
                        <strong>Piel en Armonia</strong>
                        <small>Admin sony_v3</small>
                    </div>
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

            <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">
                <header class="admin-v3-topbar">
                    <div class="admin-v3-topbar__copy">
                        <p class="sony-kicker">Sony V3</p>
                        <h2 id="pageTitle">Dashboard</h2>
                    </div>
                    <div class="admin-v3-topbar__actions">
                        <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
                        <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>
                        <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>
                        <div class="sony-theme-switcher admin-theme-switcher-header" role="group" aria-label="Tema">
                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
                            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
                        </div>
                    </div>
                </header>

                <section class="admin-v3-context-strip" id="adminProductivityStrip">
                    <div class="admin-v3-context-copy" data-admin-section-hero>
                        <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>
                        <h3 id="adminContextTitle">Que requiere atencion ahora</h3>
                        <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>
                        <div id="adminContextActions" class="sony-context-actions"></div>
                    </div>
                    <div class="admin-v3-status-rail" data-admin-priority-rail>
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
                </section>

                ${sectionTemplate()}
            </main>

            <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">
                <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>
                <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">
                    <div class="admin-command-dialog__head">
                        <div>
                            <p class="sony-kicker">Command Palette</p>
                            <h3 id="adminCommandPaletteTitle">Accion rapida</h3>
                        </div>
                        <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>
                    </div>
                    <div class="admin-command-box">
                        <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />
                        <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>
                    </div>
                    <div class="admin-command-dialog__hints">
                        <span>Ctrl+K abre esta paleta</span>
                        <span>/ enfoca la busqueda de la seccion activa</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
