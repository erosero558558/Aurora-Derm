export function renderQueueHeader() {
    return `
        <header class="section-header queue-premium-heading">
            <div class="queue-premium-heading__copy">
                <p class="sony-kicker">Control room</p>
                <h3>Turnero Sala</h3>
                <p>
                    Operación unificada del piloto web para recepción, operador,
                    kiosco y sala, con foco claro entre operación diaria,
                    incidentes y despliegue.
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
                        Corte premium-operativo del piloto web. La lectura
                        diaria se abre primero en basic mode y revela lo experto
                        solo cuando hace falta.
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
            <div class="queue-premium-shell">
                <section class="queue-premium-band" data-band="control-room">
                    <div class="queue-premium-band__header">
                        <div>
                            <p class="queue-premium-band__eyebrow">Control room</p>
                            <h5>Mandos principales</h5>
                            <p>Modo activo, foco del turno y acceso rápido a estación, numpad y consola diaria.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--control">
                        <div id="queueDomainSwitcher" class="queue-domain-switcher" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueAdminViewMode" class="queue-admin-view-mode" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueFocusMode" class="queue-focus-mode" data-focus-match="opening operations incidents closing" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueNumpadGuide" class="queue-numpad-guide" data-focus-match="opening operations incidents" data-queue-domain-match="operations incidents" data-queue-basic-match="operations"></div>
                        <div id="queueConsultorioBoard" class="queue-consultorio-board" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents" data-queue-basic-match="operations"></div>
                        <div id="queueQuickConsole" class="queue-quick-console" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents" data-queue-basic-match="opening operations incidents closing"></div>
                    </div>
                </section>

                <section class="queue-premium-band" data-band="live-queue">
                    <div class="queue-premium-band__header">
                        <div>
                            <p class="queue-premium-band__eyebrow">Live queue</p>
                            <h5>Operación en vivo</h5>
                            <p>Lo que necesita recepción para abrir, llamar, equilibrar espera y cerrar el siguiente movimiento.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--live">
                        <div id="queueAttentionDeck" class="queue-attention-deck" data-focus-match="operations incidents closing" data-queue-basic-match="operations"></div>
                        <div id="queueResolutionDeck" class="queue-resolution-deck" data-focus-match="operations incidents closing" data-queue-basic-match="operations"></div>
                        <div id="queueNextTurns" class="queue-next-turns" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueMasterSequence" class="queue-master-sequence" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueCoverageDeck" class="queue-coverage-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueReserveDeck" class="queue-reserve-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueGeneralGuidance" class="queue-general-guidance" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueProjectedDeck" class="queue-projected-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueIncomingDeck" class="queue-incoming-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueScenarioDeck" class="queue-scenario-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueWaitRadar" class="queue-wait-radar" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents"></div>
                        <div id="queueLoadBalance" class="queue-load-balance" data-focus-match="opening operations incidents closing"></div>
                        <div id="queuePriorityLane" class="queue-priority-lane" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueQuickTrays" class="queue-quick-trays" data-focus-match="operations incidents closing" data-queue-basic-match="operations"></div>
                        <div id="queueActiveTray" class="queue-active-tray" data-focus-match="operations incidents closing"></div>
                        <div id="queueTrayBurst" class="queue-tray-burst" data-focus-match="operations incidents closing"></div>
                        <div id="queueDispatchDeck" class="queue-dispatch-deck" data-focus-match="opening operations incidents" data-queue-domain-match="operations incidents"></div>
                    </div>
                </section>

                <section class="queue-premium-band" data-band="incidents">
                    <div class="queue-premium-band__header">
                        <div>
                            <p class="queue-premium-band__eyebrow">Incidents</p>
                            <h5>Diagnóstico y resolución</h5>
                            <p>Lookup, simulación, contingencia y trazas para recuperar la operación sin salir del flow clínico.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--incidents">
                        <div id="queueTicketLookup" class="queue-ticket-lookup" data-focus-match="operations incidents closing"></div>
                        <div id="queueTicketRoute" class="queue-ticket-route" data-focus-match="operations incidents closing"></div>
                        <div id="queueTicketSimulation" class="queue-ticket-simulation" data-focus-match="operations incidents closing"></div>
                        <div id="queueReceptionScript" class="queue-reception-script" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueReceptionCollision" class="queue-reception-collision" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueReceptionLights" class="queue-reception-lights" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueWindowDeck" class="queue-window-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskReply" class="queue-desk-reply" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskFallback" class="queue-desk-fallback" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskObjections" class="queue-desk-objections" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskCloseout" class="queue-desk-closeout" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskRecheck" class="queue-desk-recheck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskShift" class="queue-desk-shift" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskPromise" class="queue-desk-promise" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalation" class="queue-desk-escalation" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationTalk" class="queue-desk-escalation-talk" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationConfirm" class="queue-desk-escalation-confirm" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationFollowup" class="queue-desk-escalation-followup" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationReopen" class="queue-desk-escalation-reopen" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationLimit" class="queue-desk-escalation-limit" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationBridge" class="queue-desk-escalation-bridge" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationBrief" class="queue-desk-escalation-brief" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationReturn" class="queue-desk-escalation-return" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueDeskEscalationResolution" class="queue-desk-escalation-resolution" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueBlockers" class="queue-blockers" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueSlaDeck" class="queue-sla-deck" data-focus-match="opening operations incidents closing"></div>
                        <div id="queueSurfaceTelemetry" class="queue-surface-telemetry" data-focus-match="opening operations incidents closing" data-queue-domain-match="incidents" data-queue-basic-match="incidents closing"></div>
                        <div id="queueOpsAlerts" class="queue-ops-alerts" data-focus-match="opening operations incidents closing" data-queue-domain-match="incidents" data-queue-basic-match="incidents"></div>
                        <div id="queueContingencyDeck" class="queue-contingency-deck" data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents"></div>
                    </div>
                </section>

                <section class="queue-premium-band" data-band="deployment">
                    <div class="queue-premium-band__header">
                        <div>
                            <p class="queue-premium-band__eyebrow">Deployment</p>
                            <h5>Apertura y rollout</h5>
                            <p>Checklist, superficie instalada y handoff listo para abrir clínica sin fricción.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--deployment">
                        <div id="queuePlaybook" class="queue-playbook" data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening incidents closing"></div>
                        <div id="queuePilotReadinessCard" class="queue-apps-grid" data-turnero-pilot-readiness data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueOpsPilot" class="queue-ops-pilot" data-focus-match="opening operations incidents" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueReleaseCommandDeck" class="queue-release-command-deck" data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening incidents closing"></div>
                        <div id="queueReleaseIntelligenceSuiteHost" class="queue-release-intelligence-suite" data-turnero-release-intelligence data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseHistoryDashboard" class="queue-release-history-dashboard" data-turnero-release-history data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueAppDownloadsCards" class="queue-apps-grid" data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueOpeningChecklist" class="queue-opening-checklist" data-focus-match="opening" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueShiftHandoff" class="queue-shift-handoff" data-focus-match="closing" data-queue-domain-match="operations" data-queue-basic-match="closing"></div>
                        <div id="queueOpsLog" class="queue-ops-log" data-focus-match="operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="incidents closing"></div>
                        <div id="queueInstallConfigurator" class="queue-install-configurator" data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                    </div>
                </section>
            </div>
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
