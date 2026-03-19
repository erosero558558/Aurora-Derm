import { buildTurneroReleaseSignalBus } from './turnero-release-signal-bus.js';
import { buildTurneroReleasePolicyRouter } from './turnero-release-policy-router.js';
import { buildTurneroReleaseWorkflowOrchestrator } from './turnero-release-workflow-orchestrator.js';
import { buildTurneroReleasePriorityArbiter } from './turnero-release-priority-arbiter.js';
import { createTurneroReleaseOperatorFeed } from './turnero-release-operator-feed.js';
import { createTurneroReleaseUnifiedMemoryIndex } from './turnero-release-unified-memory-index.js';
import { buildTurneroReleaseFederatedReadinessScore } from './turnero-release-federated-readiness-score.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

const DEFAULT_SCOPE = 'global';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.getElementById(target) || document.querySelector(target)
        );
    }

    return target;
}

function normalizeScope(value) {
    return toText(value, DEFAULT_SCOPE);
}

function toneForDecision(decision) {
    const normalized = toText(decision, 'review').toLowerCase();
    if (normalized === 'hold') {
        return 'alert';
    }
    if (normalized === 'review') {
        return 'warning';
    }
    return 'ready';
}

function toneForBand(band) {
    const normalized = toText(band, '').toLowerCase();
    if (normalized === 'fragile') {
        return 'alert';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'ready';
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function sumWorkflowSteps(workflows = []) {
    return toArray(workflows).reduce(
        (total, workflow) => total + toArray(workflow?.steps).length,
        0
    );
}

function buildRouteSummary(routes = []) {
    const counts = routes.reduce((accumulator, route) => {
        const key = toText(route?.route, 'monitor');
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
    }, {});

    return [
        `war-room ${counts['war-room'] || 0}`,
        `owner-workbench ${counts['owner-workbench'] || 0}`,
        `backlog ${counts.backlog || 0}`,
        `monitor ${counts.monitor || 0}`,
    ].join(' · ');
}

function renderTag(label, value, tone = 'ready') {
    return `<span class="queue-app-card__tag" data-state="${escapeHtml(
        tone
    )}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function renderSummaryCard({
    label,
    value,
    detail,
    preview = '',
    tone = 'ready',
    role = '',
}) {
    return `
        <article class="turnero-release-unified-orchestration-fabric__summary-card" data-state="${escapeHtml(
            tone
        )}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <span>${escapeHtml(detail)}</span>
            ${preview ? `<small>${escapeHtml(preview)}</small>` : '<small>&nbsp;</small>'}
        </article>
    `;
}

function renderEntryList(rows = [], emptyLabel = '', renderRow = null) {
    const items = toArray(rows);
    if (items.length === 0) {
        return `<p class="queue-app-card__description">${escapeHtml(
            emptyLabel
        )}</p>`;
    }

    return `
        <ul class="queue-app-card__notes">
            ${items
                .map((row, index) =>
                    typeof renderRow === 'function'
                        ? renderRow(row, index)
                        : `<li>${escapeHtml(toText(row?.label, 'Item'))}</li>`
                )
                .join('')}
        </ul>
    `;
}

function signalPreview(rows = []) {
    const preview = toArray(rows)
        .slice(0, 2)
        .map(
            (row) =>
                `${toText(row?.label, 'Signal')} (${toText(row?.severity, 'low')})`
        )
        .filter(Boolean);
    return preview.length ? preview.join(' · ') : 'Sin señales';
}

function feedPreview(rows = []) {
    const preview = toArray(rows)
        .slice(0, 3)
        .map((row) => {
            const label = toText(row?.title, 'Operator event');
            const lane = toText(row?.lane, 'scheduled');
            const state = toText(row?.state, 'open');
            return `${label} · ${lane} · ${state}`;
        })
        .filter(Boolean);
    return preview.length ? preview.join(' | ') : 'Sin feed';
}

function memoryPreview(rows = []) {
    const preview = toArray(rows)
        .slice(0, 3)
        .map((row) => {
            const domain = toText(row?.domain, 'general');
            const key = toText(row?.key, 'snapshot');
            const state = toText(row?.state, 'stored');
            return `${domain}/${key} · ${state}`;
        })
        .filter(Boolean);
    return preview.length ? preview.join(' | ') : 'Sin memoria';
}

function buildSignal(label, severity, state, kind, owner = 'ops') {
    return {
        label: toText(label, 'Signal'),
        severity: toText(severity, 'low'),
        state: toText(state, 'open'),
        kind: toText(kind, 'signal'),
        owner: toText(owner, 'ops'),
    };
}

function buildUnifiedOrchestrationFallbackDomains(input = {}) {
    const controlCenterModel = asObject(input.controlCenterModel);
    const releaseDecision = toText(
        input.releaseDecision || controlCenterModel.decision || 'review',
        'review'
    ).toLowerCase();
    const incidents = toArray(
        input.releaseIncidents || controlCenterModel.incidents
    );
    const clinicProfile = asObject(input.clinicProfile || {});
    const remoteReleaseReadiness = asObject(input.remoteReleaseReadiness || {});
    const publicShellDrift = asObject(input.publicShellDrift || {});
    const queueMeta = asObject(input.queueMeta || {});
    const queueSurfaceStatus = asObject(input.queueSurfaceStatus || {});
    const appDownloads = asObject(input.appDownloads || {});
    const readiness = asObject(input.turneroV2Readiness || {});
    const regionalClinics = Array.isArray(clinicProfile.regionalClinics)
        ? clinicProfile.regionalClinics
        : [];
    const degradedSurfaceCount = ['operator', 'kiosk', 'display']
        .map((surfaceKey) => asObject(queueSurfaceStatus[surfaceKey]))
        .filter((surface) => {
            const state = toText(
                surface.status || surface.state || surface.tone || 'ready',
                'ready'
            ).toLowerCase();
            return !['ready', 'ok', 'live', 'healthy'].includes(state);
        }).length;
    const waitingCount = safeNumber(queueMeta.waitingCount, 0);
    const calledCount = safeNumber(queueMeta.calledCount, 0);
    const estimatedWaitMin = safeNumber(queueMeta.estimatedWaitMin, 0);
    const releaseMode = toText(clinicProfile.release?.mode || 'suite_v2');
    const adminModeDefault = toText(
        clinicProfile.release?.admin_mode_default || 'basic'
    );

    return [
        {
            key: 'governance',
            owner: 'program',
            signals: [
                buildSignal(
                    releaseDecision === 'ready'
                        ? 'Steering aligned'
                        : `Steering ${releaseDecision}`,
                    releaseDecision === 'hold'
                        ? 'critical'
                        : releaseDecision === 'review'
                          ? 'medium'
                          : 'low',
                    releaseDecision === 'ready' ? 'closed' : 'open',
                    'decision',
                    'program'
                ),
                buildSignal(
                    incidents.length > 0
                        ? `${incidents.length} release incident(s)`
                        : 'Incident journal clear',
                    incidents.length > 2
                        ? 'high'
                        : incidents.length > 0
                          ? 'medium'
                          : 'low',
                    incidents.length > 0 ? 'open' : 'closed',
                    'incident',
                    'ops'
                ),
            ],
        },
        {
            key: 'integration',
            owner: 'infra',
            signals: [
                buildSignal(
                    remoteReleaseReadiness.ready === true
                        ? 'Remote release ready'
                        : 'Remote release pending',
                    remoteReleaseReadiness.ready === true ? 'low' : 'high',
                    remoteReleaseReadiness.ready === true ? 'closed' : 'open',
                    'readiness',
                    'infra'
                ),
                buildSignal(
                    publicShellDrift.pageOk === false
                        ? 'Public shell unavailable'
                        : 'Public shell aligned',
                    publicShellDrift.pageOk === false ? 'high' : 'low',
                    publicShellDrift.pageOk === false ? 'open' : 'closed',
                    'shell',
                    'frontend'
                ),
                buildSignal(
                    Object.keys(appDownloads).length > 0
                        ? 'App downloads synced'
                        : 'App downloads pending',
                    Object.keys(appDownloads).length > 0 ? 'low' : 'medium',
                    Object.keys(appDownloads).length > 0 ? 'closed' : 'open',
                    'catalog',
                    'deploy'
                ),
            ],
        },
        {
            key: 'reliability',
            owner: 'infra',
            signals: [
                buildSignal(
                    degradedSurfaceCount > 0
                        ? `${degradedSurfaceCount} surface(s) degraded`
                        : 'All surfaces healthy',
                    degradedSurfaceCount > 1
                        ? 'high'
                        : degradedSurfaceCount > 0
                          ? 'medium'
                          : 'low',
                    degradedSurfaceCount > 0 ? 'open' : 'closed',
                    'surface',
                    'infra'
                ),
                buildSignal(
                    estimatedWaitMin > 0
                        ? `Estimated wait ${estimatedWaitMin}m`
                        : 'Queue wait within target',
                    estimatedWaitMin >= 12
                        ? 'high'
                        : estimatedWaitMin >= 8
                          ? 'medium'
                          : 'low',
                    estimatedWaitMin >= 8 ? 'open' : 'closed',
                    'queue',
                    'ops'
                ),
            ],
        },
        {
            key: 'service',
            owner: 'ops',
            signals: [
                buildSignal(
                    waitingCount > calledCount
                        ? `${waitingCount - calledCount} waiting above called`
                        : 'Queue balanced',
                    waitingCount - calledCount > 8
                        ? 'high'
                        : waitingCount - calledCount > 0
                          ? 'medium'
                          : 'low',
                    waitingCount > calledCount ? 'open' : 'closed',
                    'throughput',
                    'ops'
                ),
                buildSignal(
                    toText(readiness.readinessState, 'ready') === 'ready'
                        ? 'Operational readiness ready'
                        : `Operational readiness ${toText(
                              readiness.readinessState,
                              'unknown'
                          )}`,
                    toText(readiness.readinessState, 'ready') === 'ready'
                        ? 'low'
                        : 'medium',
                    toText(readiness.readinessState, 'ready') === 'ready'
                        ? 'closed'
                        : 'open',
                    'readiness',
                    'ops'
                ),
            ],
        },
        {
            key: 'strategy',
            owner: 'program',
            signals: [
                buildSignal(
                    `Release mode ${releaseMode}`,
                    releaseMode === 'suite_v2' ? 'low' : 'medium',
                    releaseMode === 'suite_v2' ? 'closed' : 'open',
                    'mode',
                    'program'
                ),
                buildSignal(
                    regionalClinics.length > 1
                        ? `${regionalClinics.length} clinics in rollout`
                        : 'Single clinic rollout',
                    regionalClinics.length > 1 ? 'medium' : 'low',
                    regionalClinics.length > 1 ? 'open' : 'closed',
                    'portfolio',
                    'program'
                ),
                buildSignal(
                    adminModeDefault === 'basic'
                        ? 'Basic admin default'
                        : 'Expert admin default',
                    adminModeDefault === 'basic' ? 'low' : 'medium',
                    adminModeDefault === 'basic' ? 'closed' : 'open',
                    'admin-mode',
                    'program'
                ),
            ],
        },
    ];
}

function buildResolvedDomains(input = {}) {
    const explicitDomains = toArray(input.domains).filter(
        (domain) => domain && typeof domain === 'object'
    );
    if (explicitDomains.length > 0) {
        return explicitDomains;
    }

    return buildUnifiedOrchestrationFallbackDomains(input);
}

function buildTurneroReleaseUnifiedOrchestrationFabricPack(input = {}) {
    const scope = normalizeScope(
        input.scope ||
            input.region ||
            input.clinicId ||
            input.clinicProfile?.region ||
            input.turneroClinicProfile?.region
    );
    const region = normalizeScope(
        input.region ||
            input.clinicProfile?.region ||
            input.turneroClinicProfile?.region ||
            scope
    );
    const clinicProfile = asObject(
        input.clinicProfile || input.turneroClinicProfile || {}
    );
    const clinicId = toText(
        input.clinicId || clinicProfile.clinic_id || clinicProfile.clinicId,
        scope
    );
    const clinicLabel = toText(
        input.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicProfile.clinic_name ||
            clinicProfile.clinicName ||
            clinicId,
        clinicId
    );
    const clinicShortName = toText(
        input.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const releaseDecision = toText(input.releaseDecision || 'review', 'review')
        .trim()
        .toLowerCase();
    const releaseIncidents = toArray(input.releaseIncidents || input.incidents);
    const domains = buildResolvedDomains({
        ...input,
        scope,
        region,
        clinicProfile,
        releaseDecision,
        releaseIncidents,
    });
    const operatorFeed = toArray(input.operatorFeed).filter(
        (item) => item && typeof item === 'object'
    );
    const memoryIndex = toArray(input.memoryIndex).filter(
        (item) => item && typeof item === 'object'
    );
    const signalBus = buildTurneroReleaseSignalBus({
        domains,
        generatedAt: input.generatedAt,
    });
    const policy = buildTurneroReleasePolicyRouter({
        signals: signalBus.rows,
        generatedAt: input.generatedAt,
    });
    const workflows = buildTurneroReleaseWorkflowOrchestrator({
        routes: policy.rows,
        generatedAt: input.generatedAt,
    });
    const priority = buildTurneroReleasePriorityArbiter({
        signals: signalBus.rows,
        backlog: operatorFeed,
        generatedAt: input.generatedAt,
    });
    const federatedScore = buildTurneroReleaseFederatedReadinessScore({
        signalSummary: signalBus.summary,
        priorityTop: priority.top,
        operatorFeed,
        memoryIndex,
        generatedAt: input.generatedAt,
    });
    const generatedAt = input.generatedAt || new Date().toISOString();
    const pack = {
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        releaseDecision,
        incidentCount: releaseIncidents.length,
        domains,
        signalBus,
        policy,
        workflows,
        priority,
        operatorFeed,
        memoryIndex,
        federatedScore,
        generatedAt,
    };

    pack.briefMarkdown = orchestrationBriefToMarkdown(pack);
    pack.snapshotFileName = 'turnero-release-orchestration-pack.json';
    pack.clipboardSummary = pack.briefMarkdown;
    pack.snapshot = {
        scope: pack.scope,
        region: pack.region,
        clinicId: pack.clinicId,
        clinicLabel: pack.clinicLabel,
        clinicShortName: pack.clinicShortName,
        releaseDecision: pack.releaseDecision,
        incidentCount: pack.incidentCount,
        domains: pack.domains,
        signalBus: pack.signalBus,
        policy: pack.policy,
        workflows: pack.workflows,
        priority: pack.priority,
        operatorFeed: pack.operatorFeed,
        memoryIndex: pack.memoryIndex,
        federatedScore: pack.federatedScore,
        generatedAt: pack.generatedAt,
        briefMarkdown: pack.briefMarkdown,
    };

    return pack;
}

function orchestrationBriefToMarkdown(pack = {}) {
    const routes = toArray(pack.policy?.rows);
    const workflows = toArray(pack.workflows?.rows);
    const openFeedCount = toArray(pack.operatorFeed).filter(
        (item) => toText(item?.state || item?.status, 'open') !== 'closed'
    ).length;
    const closedFeedCount = toArray(pack.operatorFeed).length - openFeedCount;
    const workflowStepCount = sumWorkflowSteps(workflows);

    return [
        '# Unified Orchestration Fabric',
        '',
        `Scope: ${toText(pack.scope, 'global')}`,
        `Region: ${toText(pack.region, 'global')}`,
        `Clinic: ${toText(
            pack.clinicLabel || pack.clinicShortName,
            'unknown'
        )} (${toText(pack.clinicId, 'unknown')})`,
        `Release decision: ${toText(pack.releaseDecision, 'review')}`,
        `Signals: ${pack.signalBus?.summary?.all ?? 0} total | ${
            pack.signalBus?.summary?.critical ?? 0
        } critical | ${pack.signalBus?.summary?.high ?? 0} high | ${
            pack.signalBus?.summary?.open ?? 0
        } open`,
        `Policy routes: ${routes.length} total | ${buildRouteSummary(routes)}`,
        `Workflows: ${workflows.length} total | ${workflowStepCount} step(s)`,
        `Priority: ${pack.priority?.top?.label || 'n/a'} (${toText(
            pack.priority?.top?.band,
            'P3'
        )}) · ${pack.priority?.top?.priorityScore ?? 0}`,
        `Operator feed: ${openFeedCount} open | ${closedFeedCount} closed`,
        `Memory entries: ${toArray(pack.memoryIndex).length}`,
        `Federated readiness: ${pack.federatedScore?.score ?? 0} (${toText(
            pack.federatedScore?.band,
            'n/a'
        )}) · ${toText(pack.federatedScore?.decision, 'review')}`,
        `Generated at: ${formatDateTime(
            pack.generatedAt || new Date().toISOString()
        )}`,
    ].join('\n');
}

function renderUnifiedOrchestrationFabricMarkup(pack = {}) {
    const routes = toArray(pack.policy?.rows);
    const workflows = toArray(pack.workflows?.rows);
    const openFeedCount = toArray(pack.operatorFeed).filter(
        (item) => toText(item?.state || item?.status, 'open') !== 'closed'
    ).length;
    const closedFeedCount = toArray(pack.operatorFeed).length - openFeedCount;
    const workflowStepCount = sumWorkflowSteps(workflows);
    const routeSummary = buildRouteSummary(routes);
    const signalTone =
        pack.signalBus?.summary?.critical > 0
            ? 'alert'
            : pack.signalBus?.summary?.high > 0
              ? 'warning'
              : 'ready';
    const priorityTone = toneForBand(pack.priority?.top?.band);
    const readinessTone = toneForDecision(pack.federatedScore?.decision);

    return `
        <section
            id="turneroReleaseUnifiedOrchestrationFabric"
            class="queue-app-card turnero-release-unified-orchestration-fabric"
            data-scope="${escapeHtml(pack.scope || DEFAULT_SCOPE)}"
            data-region="${escapeHtml(pack.region || DEFAULT_SCOPE)}"
            data-clinic-id="${escapeHtml(pack.clinicId || '')}"
            data-state="${escapeHtml(readinessTone)}"
            aria-labelledby="turneroReleaseUnifiedOrchestrationFabricTitle"
            aria-live="polite"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Unified orchestration</p>
                    <h6 id="turneroReleaseUnifiedOrchestrationFabricTitle">Unified Orchestration Fabric</h6>
                    <p>${escapeHtml(pack.clinicLabel || pack.clinicShortName || 'unknown')} · ${escapeHtml(pack.region || pack.scope || 'global')}</p>
                </div>
                <div class="queue-app-card__meta">
                    ${renderTag('Decision', toText(pack.federatedScore?.decision, 'review'), readinessTone)}
                    ${renderTag('Score', String(pack.federatedScore?.score ?? 0), readinessTone)}
                    ${renderTag('Signals', String(pack.signalBus?.summary?.open ?? 0), signalTone)}
                </div>
            </header>

            <p class="queue-app-card__description">
                Señales, policy routing, workflows, prioridades, operator feed y memoria scoped en una sola superficie de coordinación.
            </p>

            <div class="turnero-release-unified-orchestration-fabric__summary-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:16px;">
                ${renderSummaryCard({
                    label: 'Signals',
                    value: String(pack.signalBus?.summary?.open ?? 0),
                    detail: `${pack.signalBus?.summary?.all ?? 0} total · ${pack.signalBus?.summary?.critical ?? 0} critical · ${pack.signalBus?.summary?.high ?? 0} high`,
                    preview: signalPreview(pack.signalBus?.rows),
                    tone: signalTone,
                    role: 'signal-count',
                })}
                ${renderSummaryCard({
                    label: 'Policy',
                    value: String(routes.length),
                    detail: routeSummary,
                    preview: routeSummary,
                    tone: routes.some((route) => route.route === 'war-room')
                        ? 'warning'
                        : 'ready',
                    role: 'policy-count',
                })}
                ${renderSummaryCard({
                    label: 'Workflows',
                    value: String(workflows.length),
                    detail: `${workflowStepCount} step(s) total`,
                    preview: workflows.length
                        ? `${workflows.length} workflow(s)`
                        : 'Sin workflows',
                    tone: workflows.some(
                        (workflow) => workflow.route === 'war-room'
                    )
                        ? 'warning'
                        : 'ready',
                    role: 'workflow-count',
                })}
                ${renderSummaryCard({
                    label: 'Priority',
                    value: String(pack.priority?.top?.priorityScore ?? 0),
                    detail: pack.priority?.top
                        ? `${pack.priority.top.band} · ${pack.priority.top.label}`
                        : 'Sin prioridad',
                    preview: pack.priority?.top
                        ? `${pack.priority.top.owner} · ${pack.priority.top.signalId}`
                        : 'Sin prioridad',
                    tone: priorityTone,
                    role: 'priority-score',
                })}
                ${renderSummaryCard({
                    label: 'Feed',
                    value: String(openFeedCount),
                    detail: `${openFeedCount} open · ${closedFeedCount} closed`,
                    preview: feedPreview(pack.operatorFeed),
                    tone: openFeedCount > 3 ? 'warning' : 'ready',
                    role: 'feed-open-count',
                })}
                ${renderSummaryCard({
                    label: 'Memory',
                    value: String(toArray(pack.memoryIndex).length),
                    detail: `${toArray(pack.memoryIndex).length} scoped entry(s)`,
                    preview: memoryPreview(pack.memoryIndex),
                    tone: 'ready',
                    role: 'memory-count',
                })}
                ${renderSummaryCard({
                    label: 'Readiness',
                    value: String(pack.federatedScore?.score ?? 0),
                    detail: `${toText(pack.federatedScore?.band, 'n/a')} · ${toText(pack.federatedScore?.decision, 'review')}`,
                    preview: pack.federatedScore?.decision || 'review',
                    tone: readinessTone,
                    role: 'federated-score',
                })}
            </div>

            <div class="turnero-release-unified-orchestration-fabric__workspace" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px;">
                <section class="queue-app-card turnero-release-unified-orchestration-fabric__panel">
                    <p class="queue-app-card__eyebrow">Operator feed</p>
                    <h6 class="queue-app-card__title">Registrar señal operativa</h6>
                    <p class="queue-app-card__description">Captura un evento visible para el turno y deja el feed persistido por scope.</p>
                    <div class="turnero-release-unified-orchestration-fabric__form" style="display:grid;gap:8px;">
                        <input data-field="feed-title" placeholder="Event title" />
                        <input data-field="feed-owner" placeholder="Owner" />
                        <input data-field="feed-lane" placeholder="Lane" />
                        <button type="button" class="queue-app-card__cta-primary" data-action="add-feed-event">Add feed event</button>
                    </div>
                    ${renderEntryList(
                        pack.operatorFeed.slice(0, 4),
                        'Sin operator feed todavía.',
                        (row) => `
                        <li>
                            <strong>${escapeHtml(toText(row.title, 'Operator event'))}</strong>
                            <span>${escapeHtml(toText(row.owner, 'ops'))}</span>
                            <span>${escapeHtml(toText(row.lane, 'scheduled'))}</span>
                            <span>${escapeHtml(toText(row.state, 'open'))}</span>
                        </li>
                    `
                    )}
                </section>

                <section class="queue-app-card turnero-release-unified-orchestration-fabric__panel">
                    <p class="queue-app-card__eyebrow">Unified memory</p>
                    <h6 class="queue-app-card__title">Persistir memoria</h6>
                    <p class="queue-app-card__description">Guarda acuerdos, decisiones o referencias del turno en memoria scoped.</p>
                    <div class="turnero-release-unified-orchestration-fabric__form" style="display:grid;gap:8px;">
                        <input data-field="memory-domain" placeholder="Domain" />
                        <input data-field="memory-key" placeholder="Key" />
                        <textarea data-field="memory-value" placeholder="Value"></textarea>
                        <button type="button" class="queue-app-card__cta-primary" data-action="add-memory-entry">Add memory entry</button>
                    </div>
                    ${renderEntryList(
                        pack.memoryIndex.slice(0, 4),
                        'Sin memoria todavía.',
                        (row) => `
                        <li>
                            <strong>${escapeHtml(toText(row.domain, 'general'))}</strong>
                            <span>${escapeHtml(toText(row.key, 'snapshot'))}</span>
                            <span>${escapeHtml(toText(row.owner, 'ops'))}</span>
                            <span>${escapeHtml(toText(row.state, 'stored'))}</span>
                        </li>
                    `
                    )}
                </section>
            </div>

            <div class="queue-app-card__actions" aria-label="Acciones de orquestación">
                <button type="button" data-action="copy-orchestration-brief">Copy orchestration brief</button>
                <button type="button" class="queue-app-card__cta-primary" data-action="download-orchestration-pack">Download orchestration JSON</button>
            </div>

            <pre data-role="orchestration-brief" class="turnero-release-unified-orchestration-fabric__brief">${escapeHtml(pack.briefMarkdown || orchestrationBriefToMarkdown(pack))}</pre>
        </section>
    `;
}

function collectRenderedNodes(rootElement) {
    return {
        feedTitle: rootElement.querySelector('[data-field="feed-title"]'),
        feedOwner: rootElement.querySelector('[data-field="feed-owner"]'),
        feedLane: rootElement.querySelector('[data-field="feed-lane"]'),
        memoryDomain: rootElement.querySelector('[data-field="memory-domain"]'),
        memoryKey: rootElement.querySelector('[data-field="memory-key"]'),
        memoryValue: rootElement.querySelector('[data-field="memory-value"]'),
    };
}

function syncRenderedState(host, rootElement, pack) {
    if (host && host.dataset) {
        host.dataset.turneroUnifiedOrchestrationFabricMounted = 'true';
        host.dataset.turneroUnifiedOrchestrationFabricScope = pack.scope || '';
        host.dataset.turneroUnifiedOrchestrationFabricRegion =
            pack.region || '';
        host.dataset.turneroUnifiedOrchestrationFabricScore = String(
            pack.federatedScore?.score ?? 0
        );
        host.dataset.turneroUnifiedOrchestrationFabricDecision = toText(
            pack.federatedScore?.decision,
            'review'
        );
    }

    if (rootElement && rootElement.dataset) {
        rootElement.dataset.scope = pack.scope || '';
        rootElement.dataset.region = pack.region || '';
        rootElement.dataset.clinicId = pack.clinicId || '';
        rootElement.dataset.state = toneForDecision(
            pack.federatedScore?.decision
        );
    }
}

export function buildUnifiedOrchestrationFabricFallbackDomains(input = {}) {
    return buildUnifiedOrchestrationFallbackDomains(input);
}

export function buildUnifiedOrchestrationDomains(input = {}) {
    return buildResolvedDomains(input);
}

export function buildTurneroReleaseUnifiedOrchestrationFabricPackModel(
    input = {}
) {
    return buildTurneroReleaseUnifiedOrchestrationFabricPack(input);
}

export function orchestrationBriefToMarkdownModel(pack = {}) {
    return orchestrationBriefToMarkdown(pack);
}

export function mountTurneroReleaseUnifiedOrchestrationFabric(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const scope = normalizeScope(
        input.scope ||
            input.region ||
            input.clinicId ||
            input.clinicProfile?.region ||
            input.turneroClinicProfile?.region
    );
    const feedStore = createTurneroReleaseOperatorFeed(scope);
    const memoryStore = createTurneroReleaseUnifiedMemoryIndex(scope);
    const buildPack = () =>
        buildTurneroReleaseUnifiedOrchestrationFabricPack({
            ...input,
            scope,
            region: input.region || scope,
            operatorFeed: feedStore.list(),
            memoryIndex: memoryStore.list(),
        });

    let pack = buildPack();
    let rootElement = null;
    let nodes = {};
    const result = {
        root: null,
        pack,
        recompute: null,
        feedStore,
        memoryStore,
    };

    const render = () => {
        host.innerHTML = renderUnifiedOrchestrationFabricMarkup(pack);
        rootElement =
            host.querySelector('#turneroReleaseUnifiedOrchestrationFabric') ||
            host;
        nodes = collectRenderedNodes(rootElement);
        syncRenderedState(host, rootElement, pack);
        result.root = rootElement;
        result.pack = pack;
    };

    const recompute = () => {
        const nextPack = buildPack();
        Object.keys(pack).forEach((key) => {
            delete pack[key];
        });
        Object.assign(pack, nextPack);
        pack.briefMarkdown = orchestrationBriefToMarkdown(pack);
        pack.snapshotFileName = 'turnero-release-orchestration-pack.json';
        pack.clipboardSummary = pack.briefMarkdown;
        pack.snapshot = {
            scope: pack.scope,
            region: pack.region,
            clinicId: pack.clinicId,
            clinicLabel: pack.clinicLabel,
            clinicShortName: pack.clinicShortName,
            releaseDecision: pack.releaseDecision,
            incidentCount: pack.incidentCount,
            domains: pack.domains,
            signalBus: pack.signalBus,
            policy: pack.policy,
            workflows: pack.workflows,
            priority: pack.priority,
            operatorFeed: pack.operatorFeed,
            memoryIndex: pack.memoryIndex,
            federatedScore: pack.federatedScore,
            generatedAt: pack.generatedAt,
            briefMarkdown: pack.briefMarkdown,
        };
        render();
    };
    result.recompute = recompute;

    const handleClick = async (event) => {
        const targetNode =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-action]')
                : event.target;
        const action = toText(targetNode?.getAttribute?.('data-action'), '');
        if (!action) {
            return;
        }

        if (action === 'copy-orchestration-brief') {
            await copyToClipboardSafe(pack.briefMarkdown || '');
            return;
        }

        if (action === 'download-orchestration-pack') {
            downloadJsonSnapshot(pack.snapshotFileName, pack.snapshot);
            return;
        }

        if (action === 'add-feed-event') {
            const title = toText(nodes.feedTitle?.value, '');
            if (!title) {
                return;
            }

            feedStore.add({
                title,
                owner: toText(nodes.feedOwner?.value, 'ops'),
                lane: toText(nodes.feedLane?.value, 'scheduled'),
                state: 'open',
            });
            recompute();
            return;
        }

        if (action === 'add-memory-entry') {
            const domain = toText(nodes.memoryDomain?.value, '');
            if (!domain) {
                return;
            }

            memoryStore.add({
                domain,
                key: toText(nodes.memoryKey?.value, 'snapshot'),
                value: toText(nodes.memoryValue?.value, ''),
                state: 'stored',
            });
            recompute();
        }
    };

    if (host.__turneroUnifiedOrchestrationFabricClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroUnifiedOrchestrationFabricClickHandler
        );
    }

    host.__turneroUnifiedOrchestrationFabricClickHandler = handleClick;
    host.addEventListener('click', handleClick);

    render();

    return result;
}

export function renderTurneroReleaseUnifiedOrchestrationFabric(
    target,
    input = {}
) {
    return mountTurneroReleaseUnifiedOrchestrationFabric(target, input);
}

export {
    buildTurneroReleaseUnifiedOrchestrationFabricPack,
    orchestrationBriefToMarkdown,
};

export default mountTurneroReleaseUnifiedOrchestrationFabric;
