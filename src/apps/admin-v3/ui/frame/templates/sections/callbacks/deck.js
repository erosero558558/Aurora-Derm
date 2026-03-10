export function renderCallbacksCommandDeck() {
    return `
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
    `;
}
