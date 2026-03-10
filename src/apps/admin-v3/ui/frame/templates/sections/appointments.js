export function renderAppointmentsSection() {
    return `
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
    `;
}
