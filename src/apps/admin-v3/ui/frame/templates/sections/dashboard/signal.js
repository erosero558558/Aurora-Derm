export function renderDashboardSignalPanel() {
    return `
        <article class="sony-panel dashboard-signal-panel">
            <header>
                <div>
                    <h3>Señal operativa</h3>
                    <small id="operationRefreshSignal">Tiempo real</small>
                </div>
                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
            </header>
            <p id="dashboardLiveMeta">
                Sin alertas criticas en la operacion actual.
            </p>
            <div class="dashboard-signal-stack">
                <article class="dashboard-signal-card">
                    <span>Push</span>
                    <strong id="dashboardPushStatus">Sin validar</strong>
                    <small id="dashboardPushMeta">Permisos del navegador</small>
                </article>
                <article class="dashboard-signal-card">
                    <span>Atencion</span>
                    <strong id="dashboardQueueHealth">Cola: estable</strong>
                    <small id="dashboardFlowStatus">Sin cuellos de botella</small>
                </article>
            </div>
            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
        </article>
    `;
}
