export function renderDashboardSignalPanel() {
    return `
        <article class="sony-panel dashboard-signal-panel" id="opsQueueLaunchCard">
            <header>
                <div>
                    <h3>Nucleo de consultorio</h3>
                    <small id="operationRefreshSignal">Turnero al frente, OpenClaw y clinica detras</small>
                </div>
                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
            </header>
            <p id="dashboardLiveMeta">
                Prioriza recepcion y consultorio antes de abrir herramientas secundarias.
            </p>
            <div class="dashboard-signal-stack">
                <article class="dashboard-signal-card">
                    <span>Turnero</span>
                    <strong id="opsQueueStatus">Listo para abrir</strong>
                    <small id="opsQueueMeta">Sin cola activa</small>
                </article>
                <article class="dashboard-signal-card">
                    <span>Readiness</span>
                    <strong id="dashboardQueueHealth">Piloto interno en revision</strong>
                    <small id="dashboardFlowStatus">OpenClaw auth e historias clinicas deben quedar listas antes de uso real.</small>
                </article>
            </div>
            <button
                type="button"
                id="openOperatorAppBtn"
                class="dashboard-launch-btn"
                data-action="open-operator-app"
            >
                Abrir turnero operador
            </button>
            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
        </article>
    `;
}
