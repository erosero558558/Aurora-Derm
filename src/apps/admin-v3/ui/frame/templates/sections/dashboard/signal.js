export function renderDashboardSignalPanel() {
    return `
        <article class="sony-panel dashboard-signal-panel" id="opsQueueLaunchCard">
            <header>
                <div>
                    <h3>Turnero de sala</h3>
                    <small id="operationRefreshSignal">App separada para recepcion y consultorio</small>
                </div>
                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
            </header>
            <p id="dashboardLiveMeta">
                Abre el turnero solo cuando vayas a llamar pacientes.
            </p>
            <div class="dashboard-signal-stack">
                <article class="dashboard-signal-card">
                    <span>Estado</span>
                    <strong id="opsQueueStatus">Listo para abrir</strong>
                    <small id="opsQueueMeta">Sin cola activa</small>
                </article>
                <article class="dashboard-signal-card">
                    <span>Mas herramientas</span>
                    <strong id="dashboardQueueHealth">Turnero avanzado disponible</strong>
                    <small id="dashboardFlowStatus">Resenas, diagnostico y cola completa siguen fuera del primer paso.</small>
                </article>
            </div>
            <button
                type="button"
                id="openOperatorAppBtn"
                class="dashboard-launch-btn"
                data-action="open-operator-app"
            >
                Abrir turnero
            </button>
            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
        </article>
    `;
}
