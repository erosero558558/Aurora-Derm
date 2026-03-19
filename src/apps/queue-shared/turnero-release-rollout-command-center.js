import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toText,
    toArray,
} from './turnero-release-control-center.js';
import { buildReleaseRolloutGovernor } from './turnero-release-rollout-governor.js';
import {
    approveReleaseApproval,
    rejectReleaseApproval,
    reopenReleaseApproval,
    requestReleaseApproval,
    waiveReleaseApproval,
    buildReleaseApprovalQueuePack,
} from './turnero-release-approval-queue.js';
import {
    archiveReleaseCanaryCampaign,
    armReleaseCanaryCampaign,
    buildReleaseCanaryRegistryPack,
    completeReleaseCanaryCampaign,
    createReleaseCanaryCampaign,
    holdReleaseCanaryCampaign,
    rollbackReleaseCanaryCampaign,
    resumeReleaseCanaryCampaign,
    startReleaseCanaryCampaign,
} from './turnero-release-canary-registry.js';
import { createReleaseHistoryStore } from './turnero-release-history-store.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return isDomElement(target) ? target : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toneForDecision(decision) {
    if (decision === 'promote') {
        return 'ready';
    }
    if (decision === 'review') {
        return 'warning';
    }
    return 'alert';
}

function toneForBudget(status) {
    if (status === 'healthy') {
        return 'ready';
    }
    if (status === 'tight' || status === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function toneForSla(status) {
    if (status === 'healthy') {
        return 'ready';
    }
    if (status === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function renderChip(label, value, state = 'info') {
    return `<span class="queue-ops-pilot__chip" data-state="${escapeHtml(
        state
    )}">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function renderRiskSection(model) {
    const risk = model.riskBudget || {};
    return `
        <section id="queueReleaseRolloutCommandCenterRiskBudget" class="queue-ops-pilot__issues" data-state="${escapeHtml(
            toneForBudget(risk.budgetStatus)
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div><p class="queue-app-card__eyebrow">Risk budget</p><h6>Risk / error budget</h6></div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    toneForBudget(risk.budgetStatus)
                )}">${escapeHtml(risk.budgetStatus || 'unknown')}</span>
            </div>
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(risk.summary || '')}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    toneForBudget(risk.budgetStatus)
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Budget restante</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    `${Math.round(risk.remainingBudget || 0)}/100`
                )}</span></div><p>Consumido ${escapeHtml(
                    String(Math.round(risk.consumed || 0))
                )}/100</p></article>
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    toneForBudget(risk.errorBudgetStatus)
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Error budget</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    risk.errorBudgetStatus || 'watch'
                )}</span></div><p>${escapeHtml(
                    `${Math.round(risk.errorBudgetRemaining || 0)}/100 · burn ${Math.round(
                        risk.burnRate || 0
                    )}/100`
                )}</p></article>
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    toneForBudget(risk.budgetStatus)
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Deuda crítica</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    String(risk.criticalDebt || 0)
                )}</span></div><p>Bloqueadores ${escapeHtml(
                    String(risk.blockers || 0)
                )}</p></article>
            </div>
            <p class="queue-ops-pilot__issues-support">El budget resume cuánto margen queda antes de endurecer el gate.</p>
        </section>
    `.trim();
}

function renderSlaSection(model) {
    const sla = model.sla || {};
    const breaches = toArray(sla.recentBreaches);
    return `
        <section id="queueReleaseRolloutCommandCenterSlaMonitor" class="queue-ops-pilot__issues" data-state="${escapeHtml(
            toneForSla(sla.slaStatus)
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div><p class="queue-app-card__eyebrow">SLA / SLO</p><h6>Monitor de SLA</h6></div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    toneForSla(sla.slaStatus)
                )}">${escapeHtml(sla.slaStatus || 'watch')}</span>
            </div>
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(sla.summary || '')}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    toneForSla(sla.slaStatus)
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Confianza SLO</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    `${Math.round(sla.sloConfidence || 0)}%`
                )}</span></div><p>${escapeHtml(
                    `${sla.readyCount || 0} ready · ${sla.warningCount || 0} warning · ${
                        sla.holdCount || 0
                    } hold`
                )}</p></article>
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    toneForSla(sla.slaStatus)
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Momentum</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    sla.recoveryMomentum || 'flat'
                )}</span></div><p>${escapeHtml(
                    sla.minutesSinceReady === null
                        ? 'Sin ready reciente'
                        : `Último ready hace ${sla.minutesSinceReady} min`
                )}</p></article>
                <article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
                    breaches.length ? 'alert' : 'ready'
                )}"><div class="queue-ops-pilot__issues-item-head"><strong>Breaches</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                    String(breaches.length)
                )}</span></div><p>${escapeHtml(
                    breaches.length
                        ? breaches.join(' · ')
                        : 'Sin breaches recientes'
                )}</p></article>
            </div>
            <p class="queue-ops-pilot__issues-support">El SLO monitoriza la estabilidad del corte a partir del historial local.</p>
        </section>
    `.trim();
}

function renderApprovalItem(item) {
    return `<article id="queueReleaseRolloutCommandCenterApprovalItem_${escapeHtml(
        item.approvalId
    )}" class="queue-ops-pilot__handoff-item" role="listitem"><strong>${escapeHtml(
        item.suggestedApprover || 'ops'
    )}</strong><p>${escapeHtml(item.reason || 'Approval required')}</p><p>${escapeHtml(
        `Estado: ${item.status} · Severidad: ${item.severity} · ${item.blockingSignals?.length || 0} señal(es)`
    )}</p></article>`;
}

function renderCanaryItem(item) {
    return `<article id="queueReleaseRolloutCommandCenterCanaryItem_${escapeHtml(
        item.campaignId
    )}" class="queue-ops-pilot__handoff-item" role="listitem"><strong>${escapeHtml(
        item.label || 'Canary campaign'
    )}</strong><p>${escapeHtml(`${item.state} · owner ${item.owner} · budget ${item.budget}/100`)}</p><p>${escapeHtml(
        `baseline ${item.baselineId || 'n/a'} · error ${item.maxErrorRate}`
    )}</p></article>`;
}

function renderStageItem(stage) {
    return `<article id="queueReleaseRolloutCommandCenterPipelineStage_${escapeHtml(
        stage.id
    )}" class="queue-ops-pilot__issues-item" data-state="${escapeHtml(
        stage.status
    )}" role="listitem"><div class="queue-ops-pilot__issues-item-head"><strong>${escapeHtml(
        stage.id
    )}</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
        stage.status
    )}</span></div><p>${escapeHtml(stage.advice || '')}</p><code>${escapeHtml(
        `${stage.owner} · blockers ${stage.blockingCount || 0}`
    )}</code></article>`;
}

function renderApprovalSection(model) {
    const approvals = model.approvals || {};
    const pending = toArray(approvals.pending);
    const activeApproval = pending[0] || approvals.items?.[0] || null;
    return `
        <section id="queueReleaseRolloutCommandCenterApprovalQueue" class="queue-ops-pilot__handoff" data-state="${escapeHtml(
            approvals.blockingCount > 0 ? 'warning' : 'ready'
        )}">
            <div class="queue-ops-pilot__handoff-head">
                <div><p class="queue-app-card__eyebrow">Approval queue</p><h6>Cola de aprobaciones</h6></div>
                <div class="queue-ops-pilot__actions">
                    <button id="queueReleaseRolloutCommandCenterApproveApprovalBtn" type="button" class="queue-ops-pilot__handoff-copy" data-rollout-action="approve-approval" data-approval-id="${escapeHtml(
                        activeApproval?.approvalId || ''
                    )}" ${activeApproval ? '' : 'disabled'}>Aprobar</button>
                    <button id="queueReleaseRolloutCommandCenterRejectApprovalBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="reject-approval" data-approval-id="${escapeHtml(
                        activeApproval?.approvalId || ''
                    )}" ${activeApproval ? '' : 'disabled'}>Rechazar</button>
                    <button id="queueReleaseRolloutCommandCenterWaiveApprovalBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="waive-approval" data-approval-id="${escapeHtml(
                        activeApproval?.approvalId || ''
                    )}" ${activeApproval ? '' : 'disabled'}>Waive</button>
                    <button id="queueReleaseRolloutCommandCenterReopenApprovalBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="reopen-approval" data-approval-id="${escapeHtml(
                        activeApproval?.approvalId || ''
                    )}" ${activeApproval ? '' : 'disabled'}>Reabrir</button>
                </div>
            </div>
            <p class="queue-ops-pilot__handoff-summary">${escapeHtml(approvals.summary || '')}</p>
            <div class="queue-ops-pilot__handoff-items" role="list">${pending.length ? pending.map((item) => renderApprovalItem(item)).join('') : '<article class="queue-ops-pilot__handoff-item" role="listitem"><strong>Sin aprobaciones</strong><p>No hay gates manuales abiertos.</p></article>'}</div>
            <p class="queue-ops-pilot__handoff-support">Pendientes ${escapeHtml(String(pending.length))} · aprobadas ${escapeHtml(String(approvals.approved?.length || 0))}</p>
        </section>
    `.trim();
}

function renderCanarySection(model) {
    const canary = model.canary || {};
    const active = canary.active || null;
    return `
        <section id="queueReleaseRolloutCommandCenterCanaryRegistry" class="queue-ops-pilot__handoff" data-state="${escapeHtml(
            active?.state === 'live'
                ? 'ready'
                : active?.state === 'armed' || active?.state === 'hold'
                  ? 'warning'
                  : active?.state === 'rolled_back'
                    ? 'alert'
                    : 'ready'
        )}">
            <div class="queue-ops-pilot__handoff-head">
                <div><p class="queue-app-card__eyebrow">Canary registry</p><h6>Registro canary</h6></div>
                <div class="queue-ops-pilot__actions">
                    <button id="queueReleaseRolloutCommandCenterCreateCanaryBtn" type="button" class="queue-ops-pilot__handoff-copy" data-rollout-action="create-canary">Crear canary</button>
                    <button id="queueReleaseRolloutCommandCenterArmCanaryBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="arm-canary" data-campaign-id="${escapeHtml(
                        active?.campaignId || ''
                    )}" ${active ? '' : 'disabled'}>Armar</button>
                    <button id="queueReleaseRolloutCommandCenterStartCanaryBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="start-canary" data-campaign-id="${escapeHtml(
                        active?.campaignId || ''
                    )}" ${active ? '' : 'disabled'}>Iniciar</button>
                    <button id="queueReleaseRolloutCommandCenterRollbackCanaryBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="rollback-canary" data-campaign-id="${escapeHtml(
                        active?.campaignId || ''
                    )}" ${active ? '' : 'disabled'}>Rollback</button>
                </div>
            </div>
            <p class="queue-ops-pilot__handoff-summary">${escapeHtml(canary.summary || '')}</p>
            <div class="queue-ops-pilot__handoff-items" role="list">${canary.campaigns?.length ? canary.campaigns.map((item) => renderCanaryItem(item)).join('') : '<article class="queue-ops-pilot__handoff-item" role="listitem"><strong>Sin campañas</strong><p>No hay canary registradas todavía.</p></article>'}</div>
            <p class="queue-ops-pilot__handoff-support">${escapeHtml(active ? `Activa ${active.label} (${active.state})` : 'Sin canary activa')}</p>
        </section>
    `.trim();
}

function renderPipelineSection(model) {
    const pipeline = model.pipeline || {};
    return `
        <section id="queueReleaseRolloutCommandCenterPipeline" class="queue-ops-pilot__issues" data-state="${escapeHtml(
            pipeline.statusTone || 'warning'
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div><p class="queue-app-card__eyebrow">Promotion pipeline</p><h6>Pipeline de promoción</h6></div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    pipeline.statusTone || 'warning'
                )}">${escapeHtml(pipeline.decision || 'review')}</span>
            </div>
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(pipeline.summary || '')}</p>
            <div class="queue-ops-pilot__issues-items" role="list">${pipeline.stages?.length ? pipeline.stages.map((stage) => renderStageItem(stage)).join('') : '<article class="queue-ops-pilot__issues-item" role="listitem" data-state="ready"><div class="queue-ops-pilot__issues-item-head"><strong>Sin stages</strong><span class="queue-ops-pilot__issues-item-badge">ready</span></div><p>No hay stages de promoción definidos todavía.</p></article>'}</div>
            <p class="queue-ops-pilot__issues-support">${escapeHtml(pipeline.decisionReason || pipeline.recommendation || '')}</p>
        </section>
    `.trim();
}

function renderTopControls(model) {
    const activeApproval =
        model.approvals?.pending?.[0] || model.approvals?.items?.[0] || null;
    const activeCanary = model.canary?.active || null;
    return `
        <div class="queue-ops-pilot__actions" aria-label="Acciones de rollout">
            <button id="queueReleaseRolloutCommandCenterCopySummaryBtn" type="button" class="queue-ops-pilot__action queue-ops-pilot__action--primary" data-rollout-action="copy-executive-summary">Copiar resumen ejecutivo</button>
            <button id="queueReleaseRolloutCommandCenterCopyApprovalHandoffBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="copy-approval-handoff">Copiar handoff</button>
            <button id="queueReleaseRolloutCommandCenterCopyCanaryPlanBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="copy-canary-plan">Copiar plan canary</button>
            <button id="queueReleaseRolloutCommandCenterDownloadJsonBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="download-json">Descargar JSON</button>
            <button id="queueReleaseRolloutCommandCenterRequestApprovalBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="request-approval">Solicitar aprobación</button>
            <button id="queueReleaseRolloutCommandCenterCreateCanaryQuickBtn" type="button" class="queue-ops-pilot__action" data-rollout-action="create-canary">Crear canary</button>
        </div>
        <div class="queue-ops-pilot__chips" aria-label="Rollout metrics">
            ${renderChip('Score', Math.round(model.scorecard?.score || 0), toneForDecision(model.decision))}
            ${renderChip('Risk', model.riskBudget?.budgetStatus || 'unknown', toneForBudget(model.riskBudget?.budgetStatus))}
            ${renderChip('SLA', model.sla?.slaStatus || 'unknown', toneForSla(model.sla?.slaStatus))}
            ${renderChip('Canary', activeCanary ? activeCanary.state : 'none', toneForDecision(model.decision))}
            ${renderChip('Approvals', model.approvals?.blockingCount || 0, toneForDecision(model.decision))}
            ${renderChip('History', model.historySnapshots?.length || 0, 'info')}
            ${renderChip('Pending', activeApproval ? activeApproval.status : 'none', toneForDecision(model.decision))}
        </div>
    `;
}

function isRolloutCommandCenterModel(input) {
    return Boolean(
        input &&
        input.exports &&
        input.approvalHandoff &&
        input.canaryPlan &&
        input.pipeline
    );
}

export function buildReleaseRolloutCommandCenter(context = {}) {
    const governor = buildReleaseRolloutGovernor(context);
    const approvalHandoff = governor.approvalHandoff || {
        pendingCount: 0,
        text: '',
        summary: '',
    };
    const canaryPlan = governor.canaryPlan || {
        decision: governor.decision,
        steps: [],
        text: '',
        summary: '',
    };
    const json = {
        ...governor.snapshot,
        executiveSummary: governor.summary,
        approvalHandoff,
        canaryPlan,
    };

    return {
        ...governor,
        approvalHandoff,
        canaryPlan,
        clipboardSummary: governor.summary,
        exports: {
            executiveSummary: governor.summary,
            approvalHandoff: approvalHandoff.text,
            canaryPlan: canaryPlan.summary,
            json,
        },
    };
}

function buildFilename(model) {
    return model.snapshotFileName || 'turnero-release-rollout-governor.json';
}

async function performAction(
    action,
    actions,
    model,
    refreshView,
    options = {}
) {
    const activeCanary = model.canary?.active || null;
    const activeApproval =
        model.approvals?.pending?.[0] || model.approvals?.items?.[0] || null;
    const clinicLabel =
        model.clinicLabel || model.clinicName || model.clinicId || 'default';

    if (action === 'copy-executive-summary') {
        await copyToClipboardSafe(
            model.exports?.executiveSummary || model.summary || ''
        );
        return;
    }

    if (action === 'copy-approval-handoff') {
        await copyToClipboardSafe(
            model.exports?.approvalHandoff || model.approvalHandoff?.text || ''
        );
        return;
    }

    if (action === 'copy-canary-plan') {
        await copyToClipboardSafe(
            model.exports?.canaryPlan || model.canaryPlan?.summary || ''
        );
        return;
    }

    if (action === 'download-json') {
        downloadJsonSnapshot(buildFilename(model), model.exports?.json || {});
        return;
    }

    if (action === 'request-approval') {
        actions.requestApproval({
            reason:
                model.pipeline?.summary || model.summary || 'Approval required',
            severity:
                model.riskBudget?.budgetStatus === 'exhausted'
                    ? 'high'
                    : model.riskBudget?.budgetStatus === 'tight'
                      ? 'medium'
                      : 'low',
            suggestedApprover: model.pipeline?.approvalOwner || 'product-owner',
            blockingSignals: toArray(model.pipeline?.blockingStageIds).map(
                (stageId) => ({
                    id: stageId,
                    title: stageId,
                    detail: `Stage ${stageId} requires attention`,
                })
            ),
            metadata: { source: 'rollout-governor' },
        });
        refreshView();
        return;
    }

    if (action === 'create-canary') {
        actions.createCanary({
            label: `${clinicLabel} canary`,
            owner: 'deploy',
            baselineId: model.baselineSnapshot?.snapshotId || '',
            scoreAtStart: model.scorecard?.score || 0,
            gatesAtStart:
                model.pipeline?.stages?.map((stage) => stage.id) || [],
            notes: [model.summary],
        });
        refreshView();
        return;
    }

    if (action === 'arm-canary' && activeCanary) {
        actions.armCanary(activeCanary.campaignId, {
            baselineId: model.baselineSnapshot?.snapshotId || '',
        });
        refreshView();
        return;
    }

    if (action === 'start-canary' && activeCanary) {
        actions.startCanary(activeCanary.campaignId, {
            scoreAtStart: model.scorecard?.score || 0,
        });
        refreshView();
        return;
    }

    if (action === 'hold-canary' && activeCanary) {
        actions.holdCanary(activeCanary.campaignId, model.summary);
        refreshView();
        return;
    }

    if (action === 'resume-canary' && activeCanary) {
        actions.resumeCanary(activeCanary.campaignId);
        refreshView();
        return;
    }

    if (action === 'rollback-canary' && activeCanary) {
        actions.rollbackCanary(activeCanary.campaignId, model.summary);
        refreshView();
        return;
    }

    if (action === 'complete-canary' && activeCanary) {
        actions.completeCanary(activeCanary.campaignId);
        refreshView();
        return;
    }

    if (action === 'archive-canary' && activeCanary) {
        actions.archiveCanary(activeCanary.campaignId);
        refreshView();
        return;
    }

    if (action === 'approve-approval' && activeApproval) {
        actions.approve(activeApproval.approvalId, model.summary);
        refreshView();
        return;
    }

    if (action === 'reject-approval' && activeApproval) {
        actions.reject(activeApproval.approvalId, model.summary);
        refreshView();
        return;
    }

    if (action === 'waive-approval' && activeApproval) {
        actions.waive(activeApproval.approvalId, model.summary);
        refreshView();
        return;
    }

    if (action === 'reopen-approval' && activeApproval) {
        actions.reopen(activeApproval.approvalId, model.summary);
        refreshView();
    }
}

function bindButtons(section, model, actions, refreshView, options = {}) {
    [
        [
            '#queueReleaseRolloutCommandCenterCopySummaryBtn',
            'copy-executive-summary',
        ],
        [
            '#queueReleaseRolloutCommandCenterCopyApprovalHandoffBtn',
            'copy-approval-handoff',
        ],
        [
            '#queueReleaseRolloutCommandCenterCopyCanaryPlanBtn',
            'copy-canary-plan',
        ],
        ['#queueReleaseRolloutCommandCenterDownloadJsonBtn', 'download-json'],
        [
            '#queueReleaseRolloutCommandCenterRequestApprovalBtn',
            'request-approval',
        ],
        [
            '#queueReleaseRolloutCommandCenterCreateCanaryQuickBtn',
            'create-canary',
        ],
        ['#queueReleaseRolloutCommandCenterCreateCanaryBtn', 'create-canary'],
        ['#queueReleaseRolloutCommandCenterArmCanaryBtn', 'arm-canary'],
        ['#queueReleaseRolloutCommandCenterStartCanaryBtn', 'start-canary'],
        ['#queueReleaseRolloutCommandCenterHoldCanaryBtn', 'hold-canary'],
        ['#queueReleaseRolloutCommandCenterResumeCanaryBtn', 'resume-canary'],
        [
            '#queueReleaseRolloutCommandCenterRollbackCanaryBtn',
            'rollback-canary',
        ],
        [
            '#queueReleaseRolloutCommandCenterCompleteCanaryBtn',
            'complete-canary',
        ],
        ['#queueReleaseRolloutCommandCenterArchiveCanaryBtn', 'archive-canary'],
        [
            '#queueReleaseRolloutCommandCenterApproveApprovalBtn',
            'approve-approval',
        ],
        [
            '#queueReleaseRolloutCommandCenterRejectApprovalBtn',
            'reject-approval',
        ],
        ['#queueReleaseRolloutCommandCenterWaiveApprovalBtn', 'waive-approval'],
        [
            '#queueReleaseRolloutCommandCenterReopenApprovalBtn',
            'reopen-approval',
        ],
    ].forEach(([selector, action]) => {
        const button = section.querySelector(selector);
        if (
            typeof HTMLButtonElement !== 'undefined' &&
            button instanceof HTMLButtonElement
        ) {
            button.onclick = async () => {
                await performAction(
                    action,
                    actions,
                    model,
                    refreshView,
                    options
                );
            };
        }
    });
}

export function renderTurneroReleaseRolloutCommandCenterCard(
    input = {},
    options = {}
) {
    const model = isRolloutCommandCenterModel(input)
        ? input
        : buildReleaseRolloutCommandCenter(input);

    return `
        <section id="queueReleaseRolloutCommandCenter" class="turnero-release-rollout-governor" data-decision="${escapeHtml(
            model.decision
        )}" data-state="${escapeHtml(toneForDecision(model.decision))}" aria-labelledby="queueReleaseRolloutCommandCenterTitle" aria-live="polite">
            <header class="turnero-release-rollout-governor__header">
                <div><p class="queue-app-card__eyebrow">Rollout Governor</p><h6 id="queueReleaseRolloutCommandCenterTitle">Gobernador de rollout</h6></div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    toneForDecision(model.decision)
                )}">${escapeHtml(model.decision)}</span>
            </header>
            <p id="queueReleaseRolloutCommandCenterSummary" class="turnero-release-rollout-governor__summary">${escapeHtml(
                model.summary || ''
            )}</p>
            <p id="queueReleaseRolloutCommandCenterSupport" class="turnero-release-rollout-governor__support">${escapeHtml(
                model.supportCopy || ''
            )}</p>
            ${renderTopControls(model)}
            <div class="turnero-release-rollout-governor__grid">
                ${renderRiskSection(model)}
                ${renderApprovalSection(model)}
                ${renderSlaSection(model)}
                ${renderCanarySection(model)}
                ${renderPipelineSection(model)}
            </div>
            <details id="queueReleaseRolloutCommandCenterPackDetails"><summary>Pack JSON</summary><pre id="queueReleaseRolloutCommandCenterPackJson">${escapeHtml(
                JSON.stringify(model.exports?.json || {}, null, 2)
            )}</pre></details>
        </section>
    `.trim();
}

export function mountTurneroReleaseRolloutCommandCenterCard(
    target,
    options = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const actions = options.actions || createReleaseRolloutActions(options);
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    host.dataset.turneroReleaseRolloutCommandCenterRequestId = requestId;

    function renderView() {
        if (
            host.dataset.turneroReleaseRolloutCommandCenterRequestId !==
            requestId
        ) {
            return null;
        }

        const model = buildReleaseRolloutCommandCenter({
            ...options,
            snapshot: options.snapshot || options.currentSnapshot || {},
        });
        host.innerHTML = renderTurneroReleaseRolloutCommandCenterCard(
            model,
            options
        );
        host.__turneroReleaseRolloutCommandCenterModel = model;
        const section = host.querySelector('#queueReleaseRolloutCommandCenter');
        if (section instanceof HTMLElement) {
            section.__turneroReleaseRolloutCommandCenterModel = model;
            bindButtons(section, model, actions, renderView, options);
        }
        return model;
    }

    renderView();
    host.__turneroReleaseRolloutCommandCenterActions = actions;
    host.__turneroReleaseRolloutCommandCenterRender = renderView;
    return host;
}

export function createReleaseRolloutActions(context = {}) {
    const clinicId = toText(
        context.clinicId || context.snapshot?.clinicId || 'default',
        'default'
    );
    const store = createReleaseHistoryStore({
        namespace: context.historyNamespace,
        storage: context.storage,
    });

    return {
        refresh(override = {}) {
            return buildReleaseRolloutCommandCenter({
                ...context,
                ...override,
            });
        },
        saveSnapshot(snapshotInput = {}) {
            return store.save(
                clinicId,
                snapshotInput.snapshot ||
                    snapshotInput.currentSnapshot ||
                    snapshotInput
            );
        },
        setBaseline(snapshotId) {
            return store.setBaseline(clinicId, snapshotId);
        },
        clearHistory() {
            return store.clear(clinicId);
        },
        getHistory() {
            return store.exportClinic(clinicId);
        },
        createCanary(input = {}) {
            return createReleaseCanaryCampaign(clinicId, input);
        },
        armCanary(campaignId, patch = {}) {
            return armReleaseCanaryCampaign(clinicId, campaignId, patch);
        },
        startCanary(campaignId, patch = {}) {
            return startReleaseCanaryCampaign(clinicId, campaignId, patch);
        },
        holdCanary(campaignId, note = '') {
            return holdReleaseCanaryCampaign(clinicId, campaignId, note);
        },
        resumeCanary(campaignId) {
            return resumeReleaseCanaryCampaign(clinicId, campaignId);
        },
        rollbackCanary(campaignId, reason = '') {
            return rollbackReleaseCanaryCampaign(clinicId, campaignId, reason);
        },
        completeCanary(campaignId) {
            return completeReleaseCanaryCampaign(clinicId, campaignId);
        },
        archiveCanary(campaignId) {
            return archiveReleaseCanaryCampaign(clinicId, campaignId);
        },
        requestApproval(input = {}) {
            return requestReleaseApproval(clinicId, input);
        },
        approve(approvalId, note = '') {
            return approveReleaseApproval(clinicId, approvalId, note);
        },
        reject(approvalId, note = '') {
            return rejectReleaseApproval(clinicId, approvalId, note);
        },
        waive(approvalId, note = '') {
            return waiveReleaseApproval(clinicId, approvalId, note);
        },
        reopen(approvalId, note = '') {
            return reopenReleaseApproval(clinicId, approvalId, note);
        },
        getApprovalQueue() {
            return buildReleaseApprovalQueuePack(clinicId);
        },
        getCanaryRegistry() {
            return buildReleaseCanaryRegistryPack(clinicId);
        },
    };
}

export default buildReleaseRolloutCommandCenter;
