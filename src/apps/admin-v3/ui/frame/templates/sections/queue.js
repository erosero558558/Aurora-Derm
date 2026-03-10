export function renderQueueSection() {
    return `
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
