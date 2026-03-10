export function renderCallbacksSection() {
    return `
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
    `;
}
