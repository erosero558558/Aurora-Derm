export function renderQueueHeader() {
    return `
        <header class="section-header">
            <div>
                <h3>Turnero Sala</h3>
                <p>
                    Apps operativas, cola en vivo y flujo simple para recepción,
                    kiosco y TV.
                </p>
            </div>
            <div class="queue-admin-header-actions">
                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>
                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>
                <button type="button" data-action="queue-refresh-state">Refrescar</button>
            </div>
        </header>
    `;
}

export function renderQueueAppsHub() {
    return `
        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft">
            <div class="queue-apps-hub__header">
                <div>
                    <h4>Apps operativas</h4>
                    <p>
                        Instala Operador, Kiosco y Sala TV desde el mismo centro de
                        control para separar cada equipo por uso.
                    </p>
                </div>
                <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">
                    Plataforma detectada
                </span>
            </div>
            <div id="queueOpsPilot" class="queue-ops-pilot"></div>
            <div id="queueAppDownloadsCards" class="queue-apps-grid"></div>
            <div id="queueSurfaceTelemetry" class="queue-surface-telemetry"></div>
            <div id="queueOpeningChecklist" class="queue-opening-checklist"></div>
            <div id="queueContingencyDeck" class="queue-contingency-deck"></div>
            <div id="queueInstallConfigurator" class="queue-install-configurator"></div>
        </div>
    `;
}

export function renderQueueKpiGrid() {
    return `
        <div class="sony-grid sony-grid-kpi slim">
            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>
            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>
            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>
            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>
            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>
        </div>
    `;
}
