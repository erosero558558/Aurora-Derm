import {
    bindQueueOpsPilotActions,
    renderQueueOpsPilotActionMarkup,
} from './actions.js';

function buildPilotLeadSummary(pilot) {
    const base = String(pilot.summary || '').trim();
    const goLiveIssues = Array.isArray(pilot.goLiveIssues)
        ? pilot.goLiveIssues.length
        : 0;
    const goLiveSuffix =
        pilot.goLiveBlockingCount > 0
            ? `${pilot.goLiveBlockingCount} bloqueo(s) siguen abiertos para el go-live.`
            : goLiveIssues > 0
              ? `${goLiveIssues} pendiente(s) menores siguen en cola antes de abrir la clinica.`
              : 'Sin bloqueos de salida para este corte.';
    return [base, goLiveSuffix].filter(Boolean).join(' ');
}

function renderPilotRolloutStations(pilot, escapeHtml) {
    if (
        !Array.isArray(pilot.rolloutStations) ||
        !pilot.rolloutStations.length
    ) {
        return '';
    }

    return `
        <div class="queue-ops-pilot__lanes">
            ${pilot.rolloutStations
                .map(
                    (station) => `
                        <article class="queue-ops-pilot__lane" data-state="${
                            station.ready
                                ? 'ready'
                                : station.live
                                  ? 'warning'
                                  : 'pending'
                        }">
                            <span>${escapeHtml(station.title)}</span>
                            <strong>${escapeHtml(
                                station.ready
                                    ? 'Desktop lista'
                                    : station.live
                                      ? 'Desktop visible'
                                      : 'Pendiente'
                            )}</strong>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

function renderPilotFlow(pilot, escapeHtml) {
    if (
        !pilot?.pilotFlow ||
        !Array.isArray(pilot.pilotFlow.phases) ||
        pilot.pilotFlow.phases.length === 0
    ) {
        return '';
    }

    return `
        <section
            id="queueOpsPilotFlow"
            class="queue-ops-pilot__flow"
            aria-labelledby="queueOpsPilotFlowTitle"
        >
            <div class="queue-ops-pilot__flow-head">
                <div>
                    <p class="queue-app-card__eyebrow">Flow de apertura</p>
                    <h6 id="queueOpsPilotFlowTitle">${escapeHtml(
                        pilot.pilotFlow.title
                    )}</h6>
                    <p id="queueOpsPilotFlowSummary" class="queue-ops-pilot__flow-summary">${escapeHtml(
                        pilot.pilotFlow.summary
                    )}</p>
                </div>
                <div class="queue-ops-pilot__flow-meta">
                    <span
                        id="queueOpsPilotFlowProgress"
                        class="queue-ops-pilot__flow-progress"
                        data-state="${escapeHtml(
                            pilot.pilotFlow.currentPhase.state
                        )}"
                    >
                        ${escapeHtml(pilot.pilotFlow.progressLabel)}
                    </span>
                    <div class="queue-ops-pilot__flow-cta">
                        ${renderQueueOpsPilotActionMarkup(
                            pilot.pilotFlow.cta,
                            'primary',
                            {
                                escapeHtml,
                            }
                        )}
                    </div>
                </div>
            </div>
            <div
                id="queueOpsPilotFlowSteps"
                class="queue-ops-pilot__flow-steps"
                role="list"
                aria-label="Secuencia de apertura clínica"
            >
                ${pilot.pilotFlow.phases
                    .map(
                        (phase) => `
                            <a
                                id="queueOpsPilotFlowPhase_${escapeHtml(
                                    phase.id
                                )}"
                                class="queue-ops-pilot__flow-phase"
                                href="${escapeHtml(phase.destination)}"
                                data-state="${escapeHtml(phase.state)}"
                                data-current="${phase.current ? 'true' : 'false'}"
                                role="listitem"
                                ${phase.current ? 'aria-current="step"' : ''}
                            >
                                <div class="queue-ops-pilot__flow-phase-head">
                                    <span class="queue-ops-pilot__flow-phase-order">${escapeHtml(
                                        String(phase.order).padStart(2, '0')
                                    )}</span>
                                    <span class="queue-ops-pilot__flow-phase-status">${escapeHtml(
                                        phase.statusLabel
                                    )}</span>
                                </div>
                                <strong>${escapeHtml(phase.label)}</strong>
                                <span class="queue-ops-pilot__flow-phase-count">${escapeHtml(
                                    phase.countLabel
                                )}</span>
                                <p>${escapeHtml(phase.summary)}</p>
                            </a>
                        `
                    )
                    .join('')}
            </div>
            <p id="queueOpsPilotFlowSupport" class="queue-ops-pilot__flow-support">${escapeHtml(
                pilot.pilotFlow.support
            )}</p>
        </section>
    `;
}

export function renderQueueOpsPilotView(manifest, detectedPlatform, deps) {
    const { buildQueueOpsPilot, setHtml, escapeHtml } = deps;
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    const leadSummary = buildPilotLeadSummary(pilot);
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}" aria-labelledby="queueOpsPilotTitle">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <p class="queue-ops-pilot__admin-hub">
                            Hub piloto del admin v3
                            <span>Corte activo · Quick-nav > Turnero</span>
                        </p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title" tabindex="-1">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            leadSummary
                        )}</p>
                        ${
                            String(pilot.supportCopy || '').trim()
                                ? `
                                    <p class="queue-ops-pilot__support">${escapeHtml(
                                        pilot.supportCopy
                                    )}</p>
                                `
                                : ''
                        }
                        ${renderPilotFlow(pilot, escapeHtml)}
                        ${renderPilotRolloutStations(pilot, escapeHtml)}
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.primaryAction,
                                'primary',
                                {
                                    escapeHtml,
                                }
                            )}
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.secondaryAction,
                                'secondary',
                                { escapeHtml }
                            )}
                        </div>
                        <section
                            id="queueOpsPilotReadiness"
                            class="queue-ops-pilot__readiness"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__readiness-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Readiness</p>
                                    <h6 id="queueOpsPilotReadinessTitle">${escapeHtml(
                                        pilot.readinessTitle
                                    )}</h6>
                                </div>
                                <span
                                    id="queueOpsPilotReadinessStatus"
                                    class="queue-ops-pilot__readiness-status"
                                    data-state="${escapeHtml(pilot.readinessState)}"
                                >
                                    ${escapeHtml(
                                        pilot.readinessBlockingCount > 0
                                            ? `${pilot.readinessBlockingCount} bloqueo(s)`
                                            : 'Listo'
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotReadinessSummary" class="queue-ops-pilot__readiness-summary">${escapeHtml(
                                pilot.readinessSummary
                            )}</p>
                            <div id="queueOpsPilotReadinessItems" class="queue-ops-pilot__readiness-items" role="list" aria-label="Checklist de readiness de Turnero V2">
                                ${pilot.readinessItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotReadinessItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__readiness-item"
                                                data-state="${escapeHtml(
                                                    item.ready
                                                        ? 'ready'
                                                        : item.blocker
                                                          ? 'alert'
                                                          : 'warning'
                                                )}"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <span class="queue-ops-pilot__readiness-item-badge">${escapeHtml(
                                                    item.ready
                                                        ? 'Listo'
                                                        : item.blocker
                                                          ? 'Bloquea'
                                                          : 'Pendiente'
                                                )}</span>
                                                <p>${escapeHtml(
                                                    item.detail
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotReadinessSupport" class="queue-ops-pilot__readiness-support">${escapeHtml(
                                pilot.readinessSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotIssues"
                            class="queue-ops-pilot__issues"
                            data-state="${escapeHtml(pilot.goLiveIssueState)}"
                        >
                            <div class="queue-ops-pilot__issues-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Go-live</p>
                                    <h6 id="queueOpsPilotIssuesTitle">Bloqueos de salida</h6>
                                </div>
                                <span
                                    id="queueOpsPilotIssuesStatus"
                                    class="queue-ops-pilot__issues-status"
                                    data-state="${escapeHtml(pilot.goLiveIssueState)}"
                                >
                                    ${escapeHtml(
                                        pilot.goLiveIssues.length === 0
                                            ? 'Sin bloqueos'
                                            : pilot.goLiveBlockingCount > 0
                                              ? `${pilot.goLiveBlockingCount} bloqueo(s)`
                                              : `${pilot.goLiveIssues.length} pendiente(s)`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotIssuesSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                                pilot.goLiveSummary
                            )}</p>
                            <div id="queueOpsPilotIssuesItems" class="queue-ops-pilot__issues-items" role="list" aria-label="Bloqueos accionables de Turnero V2">
                                ${
                                    pilot.goLiveIssues.length > 0
                                        ? pilot.goLiveIssues
                                              .map(
                                                  (item) => `
                                                    <article
                                                        id="queueOpsPilotIssuesItem_${escapeHtml(
                                                            item.id
                                                        )}"
                                                        class="queue-ops-pilot__issues-item"
                                                        data-state="${escapeHtml(item.state)}"
                                                        role="listitem"
                                                    >
                                                        <div class="queue-ops-pilot__issues-item-head">
                                                            <strong>${escapeHtml(
                                                                item.label
                                                            )}</strong>
                                                            <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                                                                item.state ===
                                                                    'alert'
                                                                    ? 'Bloquea'
                                                                    : item.state ===
                                                                        'ready'
                                                                      ? 'Listo'
                                                                      : 'Pendiente'
                                                            )}</span>
                                                        </div>
                                                        <p>${escapeHtml(
                                                            item.detail
                                                        )}</p>
                                                        ${
                                                            item.href
                                                                ? `
                                                                    <a
                                                                        id="queueOpsPilotIssuesAction_${escapeHtml(
                                                                            item.id
                                                                        )}"
                                                                        href="${escapeHtml(
                                                                            item.href
                                                                        )}"
                                                                        class="queue-ops-pilot__issues-link"
                                                                        target="_blank"
                                                                        rel="noopener"
                                                                    >
                                                                        ${escapeHtml(
                                                                            item.actionLabel ||
                                                                                'Abrir'
                                                                        )}
                                                                    </a>
                                                                `
                                                                : ''
                                                        }
                                                    </article>
                                                `
                                              )
                                              .join('')
                                        : `
                                            <article
                                                id="queueOpsPilotIssuesItem_ready"
                                                class="queue-ops-pilot__issues-item"
                                                data-state="ready"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__issues-item-head">
                                                    <strong>Sin bloqueos activos</strong>
                                                    <span class="queue-ops-pilot__issues-item-badge">Listo</span>
                                                </div>
                                                <p>Turnero V2 ya no tiene bloqueos de salida por perfil, canon, publicación, PIN o smoke.</p>
                                            </article>
                                        `
                                }
                            </div>
                            <p id="queueOpsPilotIssuesSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                                pilot.goLiveSupport
                            )}</p>
                        </section>
                        <section id="queueOpsPilotCanon" class="queue-ops-pilot__canon">
                            <div class="queue-ops-pilot__canon-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Fallback web</p>
                                    <h6 id="queueOpsPilotCanonTitle">Rutas por clínica</h6>
                                </div>
                                <span id="queueOpsPilotCanonStatus" class="queue-ops-pilot__canon-status">
                                    ${escapeHtml(
                                        `${pilot.canonicalSurfaces.filter((item) => item.ready).length}/${pilot.canonicalSurfaces.length} activas`
                                    )}
                                </span>
                            </div>
                            <div id="queueOpsPilotCanonItems" class="queue-ops-pilot__canon-items" role="list" aria-label="Superficies web canonicas de Turnero V2">
                                ${pilot.canonicalSurfaces
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotCanonItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__canon-item"
                                                data-state="${escapeHtml(
                                                    item.state ||
                                                        (item.ready
                                                            ? 'ready'
                                                            : 'warning')
                                                )}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__canon-item-head">
                                                    <strong>${escapeHtml(
                                                        item.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__canon-item-badge">${escapeHtml(
                                                        item.badge ||
                                                            (item.ready
                                                                ? 'Declarada'
                                                                : 'Pendiente')
                                                    )}</span>
                                                </div>
                                                <code>${escapeHtml(
                                                    item.route
                                                )}</code>
                                                <p>${escapeHtml(
                                                    item.detail ||
                                                        item.url ||
                                                        'Ruta local de Turnero V2'
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotCanonSupport" class="queue-ops-pilot__canon-support">${escapeHtml(
                                pilot.canonicalSupport || ''
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotSmoke"
                            class="queue-ops-pilot__smoke"
                            data-state="${escapeHtml(pilot.smokeState)}"
                        >
                            <div class="queue-ops-pilot__smoke-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Smoke por clínica</p>
                                    <h6 id="queueOpsPilotSmokeTitle">Secuencia repetible</h6>
                                </div>
                                <span
                                    id="queueOpsPilotSmokeStatus"
                                    class="queue-ops-pilot__smoke-status"
                                    data-state="${escapeHtml(pilot.smokeState)}"
                                >
                                    ${escapeHtml(
                                        `${pilot.smokeReadyCount}/${pilot.smokeSteps.length} listos`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotSmokeSummary" class="queue-ops-pilot__smoke-summary">${escapeHtml(
                                pilot.smokeSummary
                            )}</p>
                            <div id="queueOpsPilotSmokeItems" class="queue-ops-pilot__smoke-items" role="list" aria-label="Secuencia de smoke de Turnero V2">
                                ${pilot.smokeSteps
                                    .map(
                                        (step) => `
                                            <article
                                                id="queueOpsPilotSmokeItem_${escapeHtml(
                                                    step.id
                                                )}"
                                                class="queue-ops-pilot__smoke-item"
                                                data-state="${escapeHtml(step.state)}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__smoke-item-head">
                                                    <strong>${escapeHtml(
                                                        step.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__smoke-item-badge">${escapeHtml(
                                                        step.ready
                                                            ? 'Listo'
                                                            : step.state ===
                                                                'alert'
                                                              ? 'Bloquea'
                                                              : 'Pendiente'
                                                    )}</span>
                                                </div>
                                                <p>${escapeHtml(step.detail)}</p>
                                                ${
                                                    step.href
                                                        ? `
                                                            <a
                                                                id="queueOpsPilotSmokeAction_${escapeHtml(
                                                                    step.id
                                                                )}"
                                                                href="${escapeHtml(step.href)}"
                                                                class="queue-ops-pilot__smoke-link"
                                                                target="_blank"
                                                                rel="noopener"
                                                            >
                                                                ${escapeHtml(
                                                                    step.actionLabel ||
                                                                        'Abrir'
                                                                )}
                                                            </a>
                                                        `
                                                        : ''
                                                }
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotSmokeSupport" class="queue-ops-pilot__smoke-support">${escapeHtml(
                                pilot.smokeSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotHandoff"
                            class="queue-ops-pilot__handoff"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__handoff-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Handoff por clínica</p>
                                    <h6 id="queueOpsPilotHandoffTitle">Paquete de apertura</h6>
                                </div>
                                <button
                                    id="queueOpsPilotHandoffCopyBtn"
                                    type="button"
                                    class="queue-ops-pilot__handoff-copy"
                                >
                                    Copiar paquete
                                </button>
                            </div>
                            <p id="queueOpsPilotHandoffSummary" class="queue-ops-pilot__handoff-summary">${escapeHtml(
                                pilot.handoffSummary
                            )}</p>
                            <div id="queueOpsPilotHandoffItems" class="queue-ops-pilot__handoff-items" role="list" aria-label="Paquete de Turnero V2 por clínica">
                                ${pilot.handoffItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotHandoffItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__handoff-item"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <p>${escapeHtml(item.value)}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotHandoffSupport" class="queue-ops-pilot__handoff-support">${escapeHtml(
                                pilot.handoffSupport
                            )}</p>
                        </section>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `
    );

    bindQueueOpsPilotActions(manifest, detectedPlatform, deps);
}
