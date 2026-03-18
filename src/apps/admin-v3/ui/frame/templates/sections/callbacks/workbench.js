export function renderCallbacksWorkbench() {
    const quickFilters = [
        ['all', 'Todos', true],
        ['pending', 'Pendientes', false],
        ['contacted', 'Contactados', false],
        ['today', 'Hoy', false],
        ['sla_urgent', 'Urgentes SLA', false],
    ];
    const filters = [
        ['all', 'Todos'],
        ['pending', 'Pendientes'],
        ['contacted', 'Contactados'],
        ['today', 'Hoy'],
        ['sla_urgent', 'Urgentes SLA'],
    ];
    const sorts = [
        ['priority_desc', 'Prioridad comercial'],
        ['recent_desc', 'Mas recientes'],
        ['waiting_desc', 'Mayor espera (SLA)'],
    ];

    const quickFilterButtons = quickFilters
        .map(
            ([value, label, active]) => `
                <button type="button" class="callback-quick-filter-btn${active ? ' is-active' : ''}" data-action="callback-quick-filter" data-filter-value="${value}">${label}</button>
            `
        )
        .join('');
    const filterOptions = filters
        .map(
            ([value, label]) => `
                <option value="${value}">${label}</option>
            `
        )
        .join('');
    const sortOptions = sorts
        .map(
            ([value, label]) => `
                <option value="${value}">${label}</option>
            `
        )
        .join('');

    return `
        <div class="sony-panel callbacks-workbench">
            <header class="section-header callbacks-workbench-head">
                <div>
                    <h3>Workbench</h3>
                    <p>Ordena por prioridad comercial, genera borradores IA y registra el outcome sin salir del panel.</p>
                </div>
            </header>
            <div class="toolbar-row">
                <div class="toolbar-group">
                    ${quickFilterButtons}
                </div>
            </div>
            <div class="toolbar-row callbacks-toolbar">
                <label>
                    <span class="sr-only">Filtro callbacks</span>
                    <select id="callbackFilter">
                        ${filterOptions}
                    </select>
                </label>
                <label>
                    <span class="sr-only">Orden callbacks</span>
                    <select id="callbackSort">
                        ${sortOptions}
                    </select>
                </label>
                <input type="search" id="searchCallbacks" placeholder="Buscar telefono o servicio" />
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
