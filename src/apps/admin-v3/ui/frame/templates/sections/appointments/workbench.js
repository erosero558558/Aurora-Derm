export function renderAppointmentsWorkbench() {
    return `
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
    `;
}
