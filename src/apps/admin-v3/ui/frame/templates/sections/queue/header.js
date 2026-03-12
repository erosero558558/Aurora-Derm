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
        <div id="queueAppsHub" class="queue-apps-hub sony-panel soft" data-queue-domain="operations">
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
            <div id="queueDomainSwitcher" class="queue-domain-switcher"></div>
            <div id="queueFocusMode" class="queue-focus-mode" data-focus-match="opening operations incidents closing"></div>
            <div id="queueNumpadGuide" class="queue-numpad-guide" data-focus-match="opening operations incidents" data-queue-domain-match="operations incidents"></div>
            <div id="queueConsultorioBoard" class="queue-consultorio-board" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents"></div>
            <div id="queueAttentionDeck" class="queue-attention-deck" data-focus-match="operations incidents closing"></div>
            <div id="queueResolutionDeck" class="queue-resolution-deck" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketLookup" class="queue-ticket-lookup" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketRoute" class="queue-ticket-route" data-focus-match="operations incidents closing"></div>
            <div id="queueTicketSimulation" class="queue-ticket-simulation" data-focus-match="operations incidents closing"></div>
            <div id="queueNextTurns" class="queue-next-turns" data-focus-match="opening operations incidents closing"></div>
            <div id="queueMasterSequence" class="queue-master-sequence" data-focus-match="opening operations incidents closing"></div>
            <div id="queueCoverageDeck" class="queue-coverage-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueReserveDeck" class="queue-reserve-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueGeneralGuidance" class="queue-general-guidance" data-focus-match="opening operations incidents closing"></div>
            <div id="queueProjectedDeck" class="queue-projected-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueIncomingDeck" class="queue-incoming-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueScenarioDeck" class="queue-scenario-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueReceptionScript" class="queue-reception-script" data-focus-match="opening operations incidents closing"></div>
            <div id="queueReceptionCollision" class="queue-reception-collision" data-focus-match="opening operations incidents closing"></div>
            <div id="queueReceptionLights" class="queue-reception-lights" data-focus-match="opening operations incidents closing"></div>
            <div id="queueWindowDeck" class="queue-window-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueDeskReply" class="queue-desk-reply" data-focus-match="opening operations incidents closing"></div>
            <div id="queueDeskFallback" class="queue-desk-fallback" data-focus-match="opening operations incidents closing"></div>
            <div id="queueDeskObjections" class="queue-desk-objections" data-focus-match="opening operations incidents closing"></div>
            <div id="queueDeskCloseout" class="queue-desk-closeout" data-focus-match="opening operations incidents closing"></div>
            <div id="queueDeskRecheck" class="queue-desk-recheck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueBlockers" class="queue-blockers" data-focus-match="opening operations incidents closing"></div>
            <div id="queueSlaDeck" class="queue-sla-deck" data-focus-match="opening operations incidents closing"></div>
            <div id="queueWaitRadar" class="queue-wait-radar" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents"></div>
            <div id="queueLoadBalance" class="queue-load-balance" data-focus-match="opening operations incidents closing"></div>
            <div id="queuePriorityLane" class="queue-priority-lane" data-focus-match="opening operations incidents closing"></div>
            <div id="queueQuickTrays" class="queue-quick-trays" data-focus-match="operations incidents closing"></div>
            <div id="queueActiveTray" class="queue-active-tray" data-focus-match="operations incidents closing"></div>
            <div id="queueTrayBurst" class="queue-tray-burst" data-focus-match="operations incidents closing"></div>
            <div id="queueDispatchDeck" class="queue-dispatch-deck" data-focus-match="opening operations incidents" data-queue-domain-match="operations incidents"></div>
            <div id="queueQuickConsole" class="queue-quick-console" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents"></div>
            <div id="queuePlaybook" class="queue-playbook" data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents"></div>
            <div id="queueOpsPilot" class="queue-ops-pilot" data-focus-match="opening operations incidents" data-queue-domain-match="deployment"></div>
            <div id="queueAppDownloadsCards" class="queue-apps-grid" data-focus-match="opening operations" data-queue-domain-match="deployment"></div>
            <div id="queueSurfaceTelemetry" class="queue-surface-telemetry" data-focus-match="opening operations incidents closing" data-queue-domain-match="incidents"></div>
            <div id="queueOpsAlerts" class="queue-ops-alerts" data-focus-match="opening operations incidents closing" data-queue-domain-match="incidents"></div>
            <div id="queueOpeningChecklist" class="queue-opening-checklist" data-focus-match="opening" data-queue-domain-match="deployment"></div>
            <div id="queueShiftHandoff" class="queue-shift-handoff" data-focus-match="closing" data-queue-domain-match="operations"></div>
            <div id="queueOpsLog" class="queue-ops-log" data-focus-match="operations incidents closing" data-queue-domain-match="deployment incidents"></div>
            <div id="queueContingencyDeck" class="queue-contingency-deck" data-focus-match="incidents operations" data-queue-domain-match="incidents"></div>
            <div id="queueInstallConfigurator" class="queue-install-configurator" data-focus-match="opening operations" data-queue-domain-match="deployment"></div>
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
