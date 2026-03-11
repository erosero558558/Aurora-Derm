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
                <div class="queue-apps-hub__header-meta">
                    <span id="queueAppsPlatformChip" class="queue-apps-platform-chip">
                        Plataforma detectada
                    </span>
                    <span id="queueAppsRefreshShieldChip" class="queue-apps-refresh-shield-chip" data-state="idle">
                        Refresh sin bloqueo
                    </span>
                </div>
            </div>
            <div id="queueFocusMode" class="queue-focus-mode" data-focus-match="opening operations incidents closing"></div>
            <div id="queueNumpadGuide" class="queue-numpad-guide" data-focus-match="opening operations incidents"></div>
            <div id="queueConsultorioBoard" class="queue-consultorio-board" data-focus-match="opening operations incidents closing"></div>
            <div id="queueAttentionDeck" class="queue-attention-deck" data-focus-match="operations incidents closing"></div>
            <div id="queueResolutionDeck" class="queue-resolution-deck" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketLookup" class="queue-ticket-lookup" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketRoute" class="queue-ticket-route" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketSimulation" class="queue-ticket-simulation" data-focus-match="operations incidents closing"></div>
            <div id="queueNextTurns" class="queue-next-turns" data-focus-match="opening operations incidents closing"></div>
            <div id="queueWaitRadar" class="queue-wait-radar" data-focus-match="opening operations incidents closing"></div>
            <div id="queueLoadBalance" class="queue-load-balance" data-focus-match="opening operations incidents closing"></div>
            <div id="queuePriorityLane" class="queue-priority-lane" data-focus-match="opening operations incidents closing"></div>
            <div id="queueQuickTrays" class="queue-quick-trays" data-focus-match="operations incidents closing"></div>
            <div id="queueActiveTray" class="queue-active-tray" data-focus-match="operations incidents closing"></div>
            <div id="queueTrayBurst" class="queue-tray-burst" data-focus-match="operations incidents closing"></div>
            <div id="queueDispatchDeck" class="queue-dispatch-deck" data-focus-match="opening operations incidents"></div>
            <div id="queueQuickConsole" class="queue-quick-console" data-focus-match="opening operations incidents closing"></div>
            <div id="queuePlaybook" class="queue-playbook" data-focus-match="opening operations incidents closing"></div>
            <div id="queueOpsPilot" class="queue-ops-pilot" data-focus-match="opening operations incidents"></div>
            <div id="queueAppDownloadsCards" class="queue-apps-grid" data-focus-match="opening operations"></div>
            <div id="queueSurfaceTelemetry" class="queue-surface-telemetry" data-focus-match="opening operations incidents closing"></div>
            <div id="queueOpsAlerts" class="queue-ops-alerts" data-focus-match="opening operations incidents closing"></div>
            <div id="queueOpeningChecklist" class="queue-opening-checklist" data-focus-match="opening"></div>
            <div id="queueShiftHandoff" class="queue-shift-handoff" data-focus-match="closing"></div>
            <div id="queueOpsLog" class="queue-ops-log" data-focus-match="operations incidents closing"></div>
            <div id="queueContingencyDeck" class="queue-contingency-deck" data-focus-match="incidents operations"></div>
            <div id="queueInstallConfigurator" class="queue-install-configurator" data-focus-match="opening operations"></div>
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
