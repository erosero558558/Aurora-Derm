export function renderQueueHeader() {
    return `
        <header class="section-header queue-premium-heading">
            <div class="queue-premium-heading__copy">
                <p class="sony-kicker">Control room</p>
                <h3>Turnero Control</h3>
                <p>
                    Operación unificada del turnero para recepción, operador,
                    kiosco y sala, con queue, surfaces y release registry en la
                    lectura principal del admin.
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
                        La lectura base abre primero el control room del
                        turnero y deja truth panel, release deck y app hub
                        visibles antes del modo experto.
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
                            <p>Modo activo, foco del turno y confirmación visible de release, registry y surfaces.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--control">
                        <div id="queueDomainSwitcher" class="queue-domain-switcher" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueAdminViewMode" class="queue-admin-view-mode" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueFocusMode" class="queue-focus-mode" data-focus-match="opening operations incidents closing" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueNumpadGuide" class="queue-numpad-guide" data-focus-match="opening operations incidents" data-queue-domain-match="operations incidents" data-queue-basic-match="operations"></div>
                        <div id="queueConsultorioBoard" class="queue-consultorio-board" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents" data-queue-basic-match="operations"></div>
                        <div id="queueQuickConsole" class="queue-quick-console" data-focus-match="opening operations incidents closing" data-queue-domain-match="operations incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueSurfaceTruthPanel" class="queue-app-card turnero-admin-queue-surface-truth-panel" data-turnero-surface-truth-panel data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseCommandDeck" class="queue-release-command-deck" data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening incidents closing"></div>
                        <div id="queuePilotReadinessCard" class="queue-apps-grid" data-turnero-pilot-readiness data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueAppDownloadsCards" class="queue-apps-grid" data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
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
                        <div id="queueReliabilityRecoveryNerveCenterHost" class="queue-reliability-recovery-nerve-center" data-turnero-reliability-recovery data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents"></div>
                        <div id="queueSurfaceRecoveryConsoleHost" class="queue-surface-recovery-console-host" data-turnero-surface-recovery-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents"></div>
                        <div id="queueSurfaceServiceHandoverConsoleHost" class="queue-surface-service-handover-console-host" data-turnero-surface-service-handover-console data-focus-match="incidents operations" data-queue-domain-match="incidents" data-queue-basic-match="incidents"></div>
                    </div>
                </section>

                <section class="queue-premium-band" data-band="deployment">
                    <div class="queue-premium-band__header">
                        <div>
                            <p class="queue-premium-band__eyebrow">Deployment</p>
                            <h5>Apertura y rollout</h5>
                            <p>Checklist, rollout y trazas de despliegue para abrir clínica con evidencia ya visible en el control room.</p>
                        </div>
                    </div>
                    <div class="queue-premium-band__grid queue-premium-band__grid--deployment">
                        <div id="queuePlaybook" class="queue-playbook" data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening incidents closing"></div>
                        <div id="queueOpsPilot" class="queue-ops-pilot" data-focus-match="opening operations incidents" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueReleaseIntelligenceSuiteHost" class="queue-release-intelligence-suite" data-turnero-release-intelligence data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseHistoryDashboard" class="queue-release-history-dashboard" data-turnero-release-history data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseGovernanceSuiteHost" class="queue-release-governance-suite" data-turnero-release-governance data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseIntegrationCommandCenterHost" class="queue-app-card queue-release-integration-command-center" data-turnero-release-integration-command-center data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueRegionalProgramOfficeHost" class="queue-app-card queue-regional-program-office-host" data-turnero-regional-program-office data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseAssuranceControlPlaneHost" class="queue-app-card queue-assurance-control-plane-host" data-turnero-release-assurance-control-plane data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseSafetyPrivacyCockpitHost" class="queue-app-card queue-safety-privacy-cockpit-host" data-turnero-release-safety-privacy-cockpit data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseServiceExcellenceAdoptionCloudHost" class="queue-app-card queue-release-service-excellence-adoption-cloud" data-turnero-release-service-excellence-adoption-cloud data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueSurfaceAdoptionConsoleHost" class="queue-app-card queue-surface-adoption-console-host" data-turnero-surface-adoption-console data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseUnifiedOrchestrationFabricHost" class="queue-app-card queue-release-unified-orchestration-fabric" data-turnero-release-unified-orchestration-fabric data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseRepoTruthAuditStudioHost" class="queue-app-card queue-release-repo-truth-audit-studio" data-turnero-release-repo-truth-audit-studio data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseRepoDiagnosticPrepHubHost" class="queue-app-card queue-release-repo-diagnostic-prep-hub" data-turnero-release-repo-diagnostic-prep-hub data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseMainlineAuditBridgeHost" class="queue-app-card queue-release-mainline-audit-bridge" data-turnero-release-mainline-audit-bridge data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueOpeningChecklist" class="queue-opening-checklist" data-focus-match="opening" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueShiftHandoff" class="queue-shift-handoff" data-focus-match="closing" data-queue-domain-match="operations" data-queue-basic-match="closing"></div>
                        <div id="queueOpsLog" class="queue-ops-log" data-focus-match="operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="incidents closing"></div>
                        <div id="queueInstallConfigurator" class="queue-install-configurator" data-focus-match="opening operations" data-queue-domain-match="deployment" data-queue-basic-match="opening"></div>
                        <div id="queueReleaseMainlineClosureCockpitHost" class="queue-app-card queue-release-mainline-closure-cockpit" data-turnero-release-mainline-closure-cockpit data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseRepoDiagnosisVerdictDossierHost" class="queue-app-card queue-release-repo-diagnosis-verdict-dossier" data-turnero-release-repo-diagnosis-verdict-dossier data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseFinalDiagnosisAdjudicationBinderHost" class="queue-app-card queue-release-final-diagnosis-adjudication-binder" data-turnero-release-final-diagnosis-adjudication-binder data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueFinalDiagnosticLaunchConsoleHost" class="queue-app-card queue-final-diagnostic-launch-console" data-turnero-final-diagnostic-launch-console data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseTerminalDiagnosticRunwayHost" class="queue-app-card queue-release-terminal-diagnostic-runway" data-turnero-release-terminal-diagnostic-runway data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueReleaseHonestRepoDiagnosisWorkspaceHost" class="queue-app-card queue-release-honest-repo-diagnosis-workspace" data-turnero-release-honest-repo-diagnosis-workspace data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueFinalDiagnosticExecutionConsoleHost" class="queue-app-card queue-final-diagnostic-execution-console" data-turnero-final-diagnostic-execution-console data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
                        <div id="queueFinalRepoDiagnosticHandoffPackHost" class="queue-app-card queue-release-final-repo-diagnostic-handoff-pack" data-turnero-release-final-repo-diagnostic-handoff-pack data-focus-match="opening operations incidents closing" data-queue-domain-match="deployment incidents" data-queue-basic-match="opening operations incidents closing"></div>
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
