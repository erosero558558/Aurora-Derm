export function renderCallbacksWorkbench() {
    return `
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
    `;
}
