export function renderQueueTriageToolbar() {
    return `
        <div id="queueTriageToolbar" class="queue-triage-toolbar">
            <div class="queue-triage-toolbar__filters">
                <button type="button" data-queue-filter="all">Todo</button>
                <button type="button" data-queue-filter="called">Llamados</button>
                <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>
                <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />
                <button type="button" data-action="queue-clear-search">Limpiar</button>
            </div>
            <div class="queue-triage-toolbar__bulk">
                <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>
                <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>
                <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>
                <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>
                <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>
            </div>
        </div>
    `;
}

export function renderQueueTriageMeta() {
    return `
        <div class="toolbar-row slim queue-triage-toolbar__meta">
            <p id="queueTriageSummary">Sin riesgo</p>
            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>
        </div>
    `;
}
