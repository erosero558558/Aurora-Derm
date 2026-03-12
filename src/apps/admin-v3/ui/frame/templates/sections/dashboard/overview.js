export function renderDashboardOperationsGrid() {
    return `
        <div class="sony-grid sony-grid-two">
            <article class="sony-panel dashboard-card-operations">
                <header>
                    <h3>Siguientes pasos</h3>
                    <small id="operationDeckMeta">Atajos utiles para el dia</small>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>
                    <div><span>Llamadas</span><strong id="operationPendingCallbacksCount">0</strong></div>
                    <div><span>Hoy</span><strong id="operationTodayLoadCount">0</strong></div>
                </div>
                <p id="operationQueueHealth">Sin pendientes urgentes.</p>
                <div id="operationActionList" class="operations-action-list"></div>
            </article>

            <article class="sony-panel" id="dashboardOpenclawOpsPanel">
                <header>
                    <div>
                        <h3>OpenClaw / WhatsApp Ops</h3>
                        <small id="openclawBridgeMeta">Leyendo bridge operativo...</small>
                    </div>
                    <span class="dashboard-signal-chip" id="openclawBridgeChip">Pendiente</span>
                </header>
                <p class="dashboard-secondary-summary" id="dashboardOpenclawOpsSummary">
                    La consola operativa mostrara estado del bridge, outbox y slots retenidos.
                </p>
                <div class="sony-panel-stats dashboard-secondary-metrics">
                    <div><span>Outbox</span><strong id="openclawOpsOutboxCount">0</strong></div>
                    <div><span>Fallos</span><strong id="openclawOpsFailCount">0</strong></div>
                    <div><span>Holds</span><strong id="openclawOpsHoldCount">0</strong></div>
                    <div><span>Checkouts</span><strong id="openclawOpsCheckoutCount">0</strong></div>
                </div>
                <div id="dashboardOpenclawOpsActions" class="operations-action-list"></div>
                <ul id="dashboardOpenclawOpsItems" class="sony-list dashboard-attention-list"></ul>
            </article>
        </div>

        <article class="sony-panel" id="dashboardClinicalHistoryPanel">
            <header>
                <div>
                    <h3>Historia clinica conversacional</h3>
                    <small id="dashboardClinicalHistoryMeta">
                        Esperando snapshot clinico desde el backend canonico.
                    </small>
                </div>
                <span class="dashboard-signal-chip" id="dashboardClinicalHistoryChip">Pendiente</span>
            </header>
            <p class="dashboard-secondary-summary" id="dashboardClinicalHistorySummary">
                La cola clinica mostrara borradores listos para revision, reconciliaciones y eventos del staff.
            </p>
            <div class="sony-panel-stats dashboard-secondary-metrics">
                <div><span>Sesiones</span><strong id="clinicalHistorySessionCount">0</strong></div>
                <div><span>Revision</span><strong id="clinicalHistoryReviewCount">0</strong></div>
                <div><span>IA pendiente</span><strong id="clinicalHistoryPendingAiCount">0</strong></div>
                <div><span>Eventos abiertos</span><strong id="clinicalHistoryEventCount">0</strong></div>
            </div>
            <div class="sony-grid sony-grid-two">
                <article class="dashboard-signal-card">
                    <span>Cola de revision</span>
                    <strong id="clinicalHistoryQueueHeadline">Sin casos pendientes</strong>
                    <small id="clinicalHistoryQueueMeta">
                        Cuando OpenClaw deje historias en review_required apareceran aqui.
                    </small>
                    <div id="dashboardClinicalHistoryActions" class="operations-action-list"></div>
                    <ul id="dashboardClinicalReviewQueue" class="sony-list dashboard-attention-list"></ul>
                </article>
                <article class="dashboard-signal-card">
                    <span>Eventos recientes</span>
                    <strong id="clinicalHistoryEventHeadline">Sin actividad reciente</strong>
                    <small id="clinicalHistoryEventMeta">
                        El feed operativo resumira conciliaciones, alertas y lecturas pendientes.
                    </small>
                    <ul id="dashboardClinicalEventFeed" class="sony-list dashboard-attention-list"></ul>
                </article>
            </div>
        </article>
    `;
}
