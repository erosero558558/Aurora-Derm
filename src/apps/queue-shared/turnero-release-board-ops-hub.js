import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import {
    buildTurneroReleaseActionRegisterMarkdown,
    createTurneroReleaseActionRegister,
} from './turnero-release-action-register.js';
import {
    buildTurneroReleaseDecisionLogMarkdown,
    createTurneroReleaseDecisionLogStore,
} from './turnero-release-decision-log.js';
import {
    buildTurneroReleaseGovernanceCalendar,
    governanceCalendarToMarkdown,
} from './turnero-release-governance-calendar.js';
import {
    buildTurneroReleaseOkrCascade,
    okrCascadeToMarkdown,
} from './turnero-release-okr-cascade.js';
import {
    buildTurneroReleaseProgramCharter,
    programCharterToMarkdown,
} from './turnero-release-program-charter.js';
import {
    buildTurneroReleaseQuarterlyBusinessReview,
    quarterlyBusinessReviewToMarkdown,
} from './turnero-release-quarterly-business-review.js';
import {
    buildTurneroReleaseSteeringCommittee,
    steeringCommitteeToMarkdown,
} from './turnero-release-steering-committee.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function nowIso() {
    return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toneForDecisionMode(decisionMode) {
    if (decisionMode === 'proceed') return 'ready';
    if (decisionMode === 'review') return 'warning';
    return 'alert';
}

function normalizeSeverity(value, fallback = 'warning') {
    const normalized = toText(value, fallback).toLowerCase();
    if (
        ['alert', 'critical', 'blocker', 'blocked', 'high'].includes(normalized)
    ) {
        return 'alert';
    }
    if (
        ['warning', 'watch', 'pending', 'review', 'medium'].includes(normalized)
    ) {
        return 'warning';
    }
    if (
        ['ready', 'done', 'approved', 'closed', 'ok', 'success'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    return fallback;
}

function normalizeActionStatus(value) {
    const status = toText(value, 'open').toLowerCase();
    if (['done', 'closed', 'complete', 'completed'].includes(status))
        return 'done';
    if (['blocked', 'rejected', 'cancelled', 'canceled'].includes(status))
        return 'blocked';
    if (['working', 'in-progress', 'progress', 'doing'].includes(status))
        return 'working';
    if (['paused', 'hold', 'pending'].includes(status)) return 'paused';
    return 'open';
}

function renderChip(label, value, state = 'info') {
    return `<span class="queue-ops-pilot__chip" data-state="${escapeHtml(
        state
    )}">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function renderItem(title, detail, badge, state = 'info', id = '') {
    return `
        <article
            ${id ? `id="${escapeHtml(id)}"` : ''}
            class="queue-ops-pilot__issues-item"
            data-state="${escapeHtml(state)}"
            role="listitem"
        >
            <div class="queue-ops-pilot__issues-item-head">
                <strong>${escapeHtml(title)}</strong>
                <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(badge)}</span>
            </div>
            <p>${escapeHtml(detail)}</p>
        </article>
    `.trim();
}

function renderPanel({
    id,
    eyebrow,
    title,
    summary = '',
    support = '',
    state = 'ready',
    badge = '',
    body = '',
}) {
    return `
        <section
            id="${escapeHtml(id)}"
            class="queue-ops-pilot__issues turnero-release-board-ops-hub__panel"
            data-state="${escapeHtml(state)}"
            aria-labelledby="${escapeHtml(id)}Title"
        >
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">${escapeHtml(eyebrow)}</p>
                    <h6 id="${escapeHtml(id)}Title">${escapeHtml(title)}</h6>
                </div>
                ${
                    badge
                        ? `<span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                              state
                          )}">${escapeHtml(badge)}</span>`
                        : ''
                }
            </div>
            ${summary ? `<p class="queue-ops-pilot__issues-summary">${escapeHtml(summary)}</p>` : ''}
            ${body}
            ${support ? `<p class="queue-ops-pilot__issues-support">${escapeHtml(support)}</p>` : ''}
        </section>
    `.trim();
}

function averageOf(values, fallback = 0) {
    const numbers = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (!numbers.length) return fallback;
    return Number(
        (
            numbers.reduce((sum, value) => sum + value, 0) / numbers.length
        ).toFixed(1)
    );
}

function uniqueBySignature(items, signatureFn) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const signature = signatureFn(item);
        if (!seen.has(signature)) {
            seen.add(signature);
            result.push(item);
        }
    }
    return result;
}

function normalizeClinic(input = {}, index = 0, fallback = {}) {
    const source = asObject(input);
    const adoptionRate = toNumber(
        source.adoptionRate ??
            source.adoptionPct ??
            source.adoption ??
            source.progressPct,
        toNumber(fallback.adoptionRate, 72)
    );
    const valueScore = toNumber(
        source.valueScore ??
            source.valuePct ??
            source.value ??
            source.valueRealization,
        toNumber(fallback.valueScore, 76)
    );

    return {
        clinicId: toText(
            source.clinicId ||
                source.clinic_id ||
                source.id ||
                `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        label: toText(
            source.label ||
                source.clinicName ||
                source.name ||
                source.branding?.name ||
                source.branding?.short_name ||
                `Clínica ${index + 1}`
        ),
        region: toText(
            source.region || source.zone || fallback.region || 'regional',
            'regional'
        ),
        status: toText(
            source.status || (source.ready === false ? 'watch' : 'active'),
            'active'
        ),
        adoptionRate: Math.max(0, Math.min(100, adoptionRate)),
        valueScore: Math.max(0, Math.min(100, valueScore)),
    };
}

function normalizeIncident(input = {}, index = 0, sourceKind = 'incident') {
    const source = asObject(input);
    const severity = normalizeSeverity(
        source.severity ||
            source.state ||
            source.tone ||
            source.status ||
            'warning',
        'warning'
    );

    return {
        id: toText(
            source.id || source.incidentId || `${sourceKind}-${index + 1}`
        ),
        title: toText(
            source.title ||
                source.label ||
                source.name ||
                source.summary ||
                'Incident'
        ),
        detail: toText(
            source.detail ||
                source.summary ||
                source.note ||
                source.reason ||
                ''
        ),
        owner: toText(
            source.owner || source.assignee || source.suggestedOwner || 'board'
        ),
        severity,
        state: severity,
        source: toText(source.source || source.kind || sourceKind || 'pilot'),
        category: toText(
            source.category || source.type || sourceKind || 'go-live'
        ),
        dueDate: toText(source.dueDate || source.dueAt || source.due || ''),
    };
}

function normalizeApproval(input = {}, index = 0, sourceKind = 'approval') {
    const source = asObject(input);
    const status = normalizeActionStatus(
        source.status ||
            source.state ||
            (source.ready === false ? 'requested' : 'approved')
    );

    return {
        id: toText(
            source.id || source.approvalId || `${sourceKind}-${index + 1}`
        ),
        title: toText(
            source.title ||
                source.label ||
                source.name ||
                source.summary ||
                'Approval'
        ),
        detail: toText(
            source.detail ||
                source.summary ||
                source.note ||
                source.reason ||
                ''
        ),
        owner: toText(
            source.owner ||
                source.assignee ||
                source.suggestedApprover ||
                'board'
        ),
        status,
        source: toText(source.source || source.kind || sourceKind || 'pilot'),
        requestedAt: toText(source.requestedAt || nowIso()),
        resolvedAt:
            source.resolvedAt === undefined || source.resolvedAt === null
                ? null
                : toText(source.resolvedAt),
    };
}

function resolveSignals(input) {
    const source = asObject(input);
    const pilot = asObject(source.pilot || source);
    const clinicProfile = asObject(
        source.clinicProfile ||
            source.turneroClinicProfile ||
            pilot.clinicProfile ||
            pilot.turneroClinicProfile ||
            {}
    );
    const region = toText(
        source.region ||
            clinicProfile.region ||
            clinicProfile.branding?.region ||
            clinicProfile.address?.region ||
            'regional',
        'regional'
    );
    const scope = toText(
        source.scope ||
            source.region ||
            clinicProfile.region ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            region ||
            'regional',
        'regional'
    );
    const programName = toText(
        source.programName ||
            source.program ||
            clinicProfile.programName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            'Turnero Web por Clínica'
    );

    const explicitClinics = toArray(source.clinics);
    const clinicCandidates = [
        clinicProfile.regionalClinics,
        clinicProfile.clinics,
        pilot.clinicProfiles,
        pilot.turneroClinicProfiles,
        source.snapshot?.clinicProfiles,
        source.snapshot?.turneroClinicProfiles,
    ].find((entry) => Array.isArray(entry) && entry.length > 0);

    const clinics = explicitClinics.length
        ? explicitClinics.map((clinic, index) =>
              normalizeClinic(clinic, index, { region })
          )
        : Array.isArray(clinicCandidates) && clinicCandidates.length > 0
          ? clinicCandidates.map((clinic, index) =>
                normalizeClinic(clinic, index, { region })
            )
          : [
                normalizeClinic(
                    {
                        clinicId:
                            clinicProfile.clinicId ||
                            clinicProfile.clinic_id ||
                            pilot.clinicId ||
                            `${region}-clinic`,
                        label:
                            clinicProfile.branding?.name ||
                            clinicProfile.branding?.short_name ||
                            pilot.clinicName ||
                            pilot.brandName ||
                            programName,
                        region,
                        adoptionRate:
                            pilot.progressPct ||
                            (toNumber(pilot.totalSteps, 0) > 0
                                ? Number(
                                      (
                                          (toNumber(pilot.confirmedCount, 0) /
                                              toNumber(pilot.totalSteps, 1)) *
                                          100
                                      ).toFixed(1)
                                  )
                                : 72),
                        valueScore: toNumber(
                            pilot.valueScore || pilot.valuePct,
                            76
                        ),
                        status:
                            pilot.readinessState === 'ready'
                                ? 'active'
                                : 'watch',
                    },
                    0,
                    { region, adoptionRate: 72, valueScore: 76 }
                ),
            ];

    const explicitIncidents = toArray(source.incidents);
    const explicitApprovals = toArray(source.approvals);
    const goLiveIssues = toArray(source.goLiveIssues || pilot.goLiveIssues);
    const readinessItems = toArray(
        source.readinessItems || pilot.readinessItems
    );
    const handoffItems = toArray(source.handoffItems || pilot.handoffItems);

    const incidents = explicitIncidents.length
        ? explicitIncidents.map((item, index) =>
              normalizeIncident(item, index, 'incident')
          )
        : [
              ...goLiveIssues.map((item, index) =>
                  normalizeIncident(item, index, 'go-live')
              ),
              ...readinessItems
                  .filter((item) => {
                      const state = asObject(item);
                      return !(
                          state.ready === true ||
                          normalizeSeverity(
                              state.state ||
                                  state.severity ||
                                  state.tone ||
                                  state.status,
                              'warning'
                          ) === 'ready'
                      );
                  })
                  .map((item, index) =>
                      normalizeIncident(item, index, 'readiness')
                  ),
          ];

    const approvals = explicitApprovals.length
        ? explicitApprovals.map((item, index) =>
              normalizeApproval(item, index, 'approval')
          )
        : [
              ...readinessItems
                  .filter((item) => {
                      const state = asObject(item);
                      return (
                          state.ready === true ||
                          normalizeSeverity(
                              state.state ||
                                  state.severity ||
                                  state.tone ||
                                  state.status,
                              'warning'
                          ) === 'ready'
                      );
                  })
                  .map((item, index) =>
                      normalizeApproval(item, index, 'readiness')
                  ),
              ...handoffItems.map((item, index) =>
                  normalizeApproval(item, index, 'handoff')
              ),
          ];

    return {
        source,
        pilot,
        clinicProfile,
        region,
        scope,
        programName,
        clinics,
        incidents,
        approvals,
        blockedCount: incidents.filter((item) => item.severity === 'alert')
            .length,
        warningCount: incidents.filter((item) => item.severity === 'warning')
            .length,
        pendingApprovals: approvals.filter((item) => item.status !== 'done')
            .length,
    };
}

function safeFilePart(value, fallback = 'regional') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function getStorage(options = {}) {
    if (options.storage) {
        return options.storage;
    }

    if (typeof globalThis === 'undefined') {
        return null;
    }

    try {
        return globalThis.localStorage || null;
    } catch (_error) {
        return null;
    }
}

function boardSummaryList(items, emptyLabel, renderFn) {
    const rows = toArray(items);
    if (!rows.length) {
        return `<p class="queue-ops-pilot__issues-summary">${escapeHtml(emptyLabel)}</p>`;
    }

    return `
        <div class="queue-ops-pilot__issues-items" role="list">
            ${rows.map((item, index) => renderFn(item, index)).join('')}
        </div>
    `.trim();
}

function renderBoardOpsHubDecisionItem(entry, index) {
    const state =
        entry.status === 'blocked'
            ? 'alert'
            : entry.status === 'review'
              ? 'warning'
              : 'ready';

    return renderItem(
        entry.title || `Decision ${index + 1}`,
        [
            entry.note,
            `Owner: ${toText(entry.owner || 'board')}`,
            `Priority: ${toText(entry.priority || 'medium')}`,
            `Category: ${toText(entry.category || 'governance')}`,
        ]
            .filter(Boolean)
            .join(' · '),
        `${toText(entry.status || 'open')} · ${toText(entry.source || 'manual')}`,
        state,
        `queueReleaseBoardOpsHubDecision_${escapeHtml(entry.id || `entry-${index + 1}`)}`
    );
}

function renderBoardOpsHubActionItem(entry, index) {
    const state =
        entry.status === 'done'
            ? 'ready'
            : entry.status === 'blocked'
              ? 'alert'
              : entry.status === 'working'
                ? 'warning'
                : 'warning';

    return renderItem(
        entry.title || `Action ${index + 1}`,
        [
            entry.note,
            `Owner: ${toText(entry.owner || 'board')}`,
            `Due: ${toText(entry.dueDate || 'n/a')}`,
            `Severity: ${toText(entry.severity || 'medium')}`,
        ]
            .filter(Boolean)
            .join(' · '),
        `${toText(entry.status || 'open')} · ${toText(entry.source || 'manual')}`,
        state,
        `queueReleaseBoardOpsHubAction_${escapeHtml(entry.id || `entry-${index + 1}`)}`
    );
}

function renderBoardOpsHubClinicItem(clinic, index) {
    return renderItem(
        clinic.label || `Clínica ${index + 1}`,
        [
            `Region: ${toText(clinic.region || 'regional')}`,
            `Adoption: ${toText(clinic.adoptionRate || 0)}%`,
            `Value: ${toText(clinic.valueScore || 0)}%`,
        ].join(' · '),
        toText(clinic.status || 'active'),
        clinic.status === 'active' ? 'ready' : 'warning',
        `queueReleaseBoardOpsHubClinic_${escapeHtml(clinic.clinicId || `clinic-${index + 1}`)}`
    );
}

function renderBoardOpsHubKpiItem(keyResult, index) {
    const numericValue = Number(keyResult.value || 0);
    const numericTarget = Number(keyResult.target || 0);
    const state =
        keyResult.status === 'alert'
            ? 'alert'
            : keyResult.status === 'warning'
              ? 'warning'
              : 'ready';

    return renderItem(
        keyResult.label || `KR ${index + 1}`,
        `${numericValue}${toText(keyResult.unit || '')} / ${numericTarget}${toText(
            keyResult.unit || ''
        )}`,
        state === 'ready'
            ? 'Cumple'
            : state === 'warning'
              ? 'Vigilar'
              : 'Bloquea',
        state,
        `queueReleaseBoardOpsHubKpi_${escapeHtml(keyResult.key || `kr-${index + 1}`)}`
    );
}

function renderBoardOpsHubCalendarItem(event, index) {
    return renderItem(
        event.label || `Event ${index + 1}`,
        [
            event.purpose,
            `Cadence: ${toText(event.cadence || 'weekly')}`,
            `Owner: ${toText(event.owner || 'board')}`,
            event.timing ? `Timing: ${event.timing}` : '',
        ]
            .filter(Boolean)
            .join(' · '),
        toText(event.state || 'ready'),
        event.state === 'ready' ? 'ready' : 'warning',
        `queueReleaseBoardOpsHubCalendar_${escapeHtml(event.key || `event-${index + 1}`)}`
    );
}

function buildBoardOpsHubAgendaMarkdown(model) {
    const nextEvent = model.governanceCalendar?.nextEvent;

    return [
        '# Board Ops Agenda',
        '',
        `- Program: ${toText(model.programName)}`,
        `- Scope: ${toText(model.scope)}`,
        `- Region: ${toText(model.region)}`,
        `- Decision mode: ${toText(model.steering.decisionMode)}`,
        `- Open decisions: ${Number(model.openDecisions || 0)}`,
        `- Open actions: ${Number(model.openActions || 0)}`,
        '',
        '## Steering agenda',
        ...toArray(model.steering.agenda).map((item) => `- ${toText(item)}`),
        '',
        '## QBR watch',
        ...toArray(model.qbr.watchItems).map((item) => `- ${toText(item)}`),
        '',
        '## Next governance event',
        nextEvent
            ? `- ${toText(nextEvent.label)} · ${toText(nextEvent.cadence)} · ${toText(
                  nextEvent.timing || 'n/a'
              )}`
            : '- Sin evento próximo.',
    ].join('\n');
}

function buildBoardOpsHubActionPackMarkdown(model) {
    return [
        '# Board Ops Action Pack',
        '',
        steeringCommitteeToMarkdown(model.steering),
        '',
        okrCascadeToMarkdown(model.okrCascade),
        '',
        quarterlyBusinessReviewToMarkdown(model.qbr),
        '',
        programCharterToMarkdown(model.charter),
        '',
        governanceCalendarToMarkdown(model.governanceCalendar),
        '',
        buildTurneroReleaseDecisionLogMarkdown(model.decisionLog, {
            scope: model.scope,
            generatedAt: model.generatedAt,
        }),
        '',
        buildTurneroReleaseActionRegisterMarkdown(model.actionRegister, {
            scope: model.scope,
            generatedAt: model.generatedAt,
        }),
    ].join('\n');
}

export function buildTurneroReleaseBoardOpsHubModel(input = {}, options = {}) {
    const signals = resolveSignals(input);
    const storage = getStorage(options);
    const decisionStore =
        options.decisionStore ||
        createTurneroReleaseDecisionLogStore(signals.scope, { storage });
    const actionStore =
        options.actionStore ||
        createTurneroReleaseActionRegister(signals.scope, { storage });
    const generatedAt = nowIso();
    const source = asObject(input);
    const kpis = asObject(
        source.kpis || signals.pilot.kpis || source.snapshot?.kpis || {}
    );
    const value = asObject(
        source.value || signals.pilot.value || source.snapshot?.value || {}
    );
    const governance = asObject(
        source.governance ||
            signals.pilot.governance ||
            source.snapshot?.governance ||
            {}
    );
    const averageAdoption = averageOf(
        signals.clinics.map((clinic) => clinic.adoptionRate),
        72
    );
    const averageValue = averageOf(
        signals.clinics.map((clinic) => clinic.valueScore),
        76
    );
    const steering = buildTurneroReleaseSteeringCommittee({
        region: signals.region,
        scope: signals.scope,
        programName: signals.programName,
        incidents: signals.incidents,
        approvals: signals.approvals,
    });
    const okrCascade = buildTurneroReleaseOkrCascade({
        region: signals.region,
        scope: signals.scope,
        clinics: signals.clinics,
        objective:
            source.objective ||
            signals.pilot.objective ||
            `${signals.programName} OKR cascade`,
    });
    const qbr = buildTurneroReleaseQuarterlyBusinessReview({
        region: signals.region,
        kpis: {
            ...kpis,
            blockedIncidents: signals.blockedCount,
            pendingApprovals: signals.pendingApprovals,
            avgAdoption: averageAdoption,
            avgValue: averageValue,
        },
        value: {
            ...value,
            realizationPct: averageValue,
            valueScore: averageValue,
        },
        governance: {
            ...governance,
            mode: governance.mode || steering.decisionMode,
            decision: governance.decision || steering.decisionMode,
        },
    });
    const charter = buildTurneroReleaseProgramCharter({
        programName: signals.programName,
        region: signals.region,
        scopeItems: source.scopeItems,
        principles: source.principles,
        governanceRules: source.governanceRules,
        mission: source.mission,
    });
    const governanceEvents = toArray(
        source.events ||
            governance.events ||
            signals.pilot.governanceEvents ||
            signals.pilot.boardEvents
    );
    const governanceCalendar = buildTurneroReleaseGovernanceCalendar(
        governanceEvents.length
            ? {
                  region: signals.region,
                  events: governanceEvents,
              }
            : {
                  region: signals.region,
              }
    );

    const seedModel = {
        ...signals,
        generatedAt,
        kpis: {
            ...kpis,
            blockedIncidents: signals.blockedCount,
            pendingApprovals: signals.pendingApprovals,
            avgAdoption: averageAdoption,
            avgValue: averageValue,
        },
        value: {
            ...value,
            realizationPct: averageValue,
            valueScore: averageValue,
        },
        governance,
        steering,
        okrCascade,
        qbr,
        charter,
        governanceCalendar,
    };

    if (decisionStore.count() === 0) {
        decisionStore.seed(buildSeedDecisionLog(seedModel));
    }

    if (actionStore.count() === 0) {
        actionStore.seed(buildSeedActionRegister(seedModel));
    }

    const decisionLog = decisionStore.list();
    const actionRegister = actionStore.list();
    const openDecisions = decisionLog.filter(
        (entry) => entry.status === 'open' || entry.status === 'review'
    ).length;
    const openActions = actionRegister.filter(
        (entry) => entry.status !== 'done'
    ).length;
    const agendaMarkdown = buildBoardOpsHubAgendaMarkdown({
        ...seedModel,
        decisionLog,
        actionRegister,
        openDecisions,
        openActions,
    });
    const briefMarkdown = buildBoardBriefMarkdown({
        ...seedModel,
        decisionLog,
        actionRegister,
    });
    const actionPackMarkdown = buildBoardOpsHubActionPackMarkdown({
        ...seedModel,
        decisionLog,
        actionRegister,
    });
    const jsonPack = buildBoardJsonPack({
        ...seedModel,
        decisionLog,
        actionRegister,
        agendaMarkdown,
        briefMarkdown,
        actionPackMarkdown,
        openDecisions,
        openActions,
    });

    return {
        ...signals,
        generatedAt,
        storage,
        kpis: seedModel.kpis,
        value: seedModel.value,
        governance,
        steering,
        okrCascade,
        qbr,
        charter,
        governanceCalendar,
        decisionLog,
        actionRegister,
        openDecisions,
        openActions,
        agendaMarkdown,
        briefMarkdown,
        actionPackMarkdown,
        jsonPack,
        decisionStore,
        actionStore,
        state: toneForDecisionMode(steering.decisionMode),
        summary: steering.summary,
        support: qbr.narrative,
    };
}

function renderBoardOpsHubSections(model) {
    const steeringBody = [
        `<div class="queue-ops-pilot__chips" aria-label="Steering metrics">`,
        renderChip(
            'Decision mode',
            toText(model.steering.decisionMode || 'review'),
            toneForDecisionMode(model.steering.decisionMode)
        ),
        renderChip(
            'Blocked',
            String(model.steering.blockedCount || 0),
            model.steering.blockedCount ? 'alert' : 'ready'
        ),
        renderChip(
            'Warnings',
            String(model.steering.warningCount || 0),
            model.steering.warningCount ? 'warning' : 'ready'
        ),
        renderChip(
            'Pending approvals',
            String(model.steering.pendingApprovals || 0),
            model.steering.pendingApprovals ? 'warning' : 'ready'
        ),
        `</div>`,
        boardSummaryList(
            model.steering.focus,
            'Sin foco destacado.',
            (item, index) =>
                renderItem(
                    `Focus ${index + 1}`,
                    toText(item),
                    'Focus',
                    'info',
                    `queueReleaseBoardOpsHubFocus_${index + 1}`
                )
        ),
    ].join('');

    const okrBody = [
        `<div class="queue-ops-pilot__chips" aria-label="OKR metrics">`,
        renderChip(
            'Adoption avg',
            `${model.okrCascade.adoptionAvg}%`,
            model.okrCascade.adoptionAvg >= 70 ? 'ready' : 'warning'
        ),
        renderChip(
            'Value avg',
            `${model.okrCascade.valueAvg}%`,
            model.okrCascade.valueAvg >= 75 ? 'ready' : 'warning'
        ),
        renderChip(
            'Active clinics',
            String(model.okrCascade.activeClinics || 0),
            'info'
        ),
        `</div>`,
        boardSummaryList(
            model.okrCascade.keyResults,
            'Sin key results.',
            renderBoardOpsHubKpiItem
        ),
    ].join('');

    const qbrBody = [
        boardSummaryList(
            model.qbr.summary,
            'Sin summary trimestral.',
            (item, index) =>
                renderItem(
                    `QBR ${index + 1}`,
                    toText(item),
                    model.qbr.tone || 'warning',
                    model.qbr.tone === 'ready' ? 'ready' : 'warning',
                    `queueReleaseBoardOpsHubQbr_${index + 1}`
                )
        ),
        boardSummaryList(
            model.qbr.watchItems,
            'Sin watch items.',
            (item, index) =>
                renderItem(
                    `Watch ${index + 1}`,
                    toText(item),
                    model.qbr.tone === 'ready' ? 'Alineado' : 'Vigilar',
                    model.qbr.tone === 'ready' ? 'ready' : 'warning',
                    `queueReleaseBoardOpsHubQbrWatch_${index + 1}`
                )
        ),
    ].join('');

    const charterBody = [
        boardSummaryList(
            [
                `Mission: ${model.charter.mission}`,
                `Program: ${model.charter.programName}`,
                `Region: ${model.charter.region}`,
            ],
            'Sin misión.',
            (item, index) =>
                renderItem(
                    index === 0
                        ? 'Mission'
                        : index === 1
                          ? 'Program'
                          : 'Region',
                    toText(item),
                    'Board',
                    'ready',
                    `queueReleaseBoardOpsHubCharterMeta_${index + 1}`
                )
        ),
        boardSummaryList(model.charter.scope, 'Sin scope.', (item, index) =>
            renderItem(
                `Scope ${index + 1}`,
                toText(item),
                'Scope',
                'info',
                `queueReleaseBoardOpsHubCharterScope_${index + 1}`
            )
        ),
        boardSummaryList(
            model.charter.principles,
            'Sin principios.',
            (item, index) =>
                renderItem(
                    `Principle ${index + 1}`,
                    toText(item),
                    'Principle',
                    'info',
                    `queueReleaseBoardOpsHubCharterPrinciple_${index + 1}`
                )
        ),
        boardSummaryList(
            model.charter.governanceRules,
            'Sin governance rules.',
            (item, index) =>
                renderItem(
                    `Rule ${index + 1}`,
                    toText(item),
                    'Governance',
                    'info',
                    `queueReleaseBoardOpsHubCharterRule_${index + 1}`
                )
        ),
    ].join('');

    const governanceBody = [
        renderItem(
            model.governanceCalendar.nextEvent?.label || 'Next event',
            model.governanceCalendar.nextEvent
                ? `${toText(model.governanceCalendar.nextEvent.cadence)} · ${toText(
                      model.governanceCalendar.nextEvent.timing || 'n/a'
                  )} · ${toText(model.governanceCalendar.nextEvent.owner || 'board')}`
                : 'Sin evento próximo.',
            model.governanceCalendar.nextEvent ? 'Próximo' : 'Pendiente',
            model.governanceCalendar.nextEvent ? 'ready' : 'warning',
            'queueReleaseBoardOpsHubNextGovernanceEvent'
        ),
        boardSummaryList(
            model.governanceCalendar.events,
            'Sin eventos.',
            renderBoardOpsHubCalendarItem
        ),
    ].join('');

    const decisionLogBody = [
        `<div class="queue-ops-pilot__chips" aria-label="Decision metrics">`,
        renderChip(
            'Open',
            String(model.openDecisions || 0),
            model.openDecisions ? 'warning' : 'ready'
        ),
        renderChip(
            'Closed',
            String(model.decisionLog.length - model.openDecisions),
            'info'
        ),
        `</div>`,
        boardSummaryList(
            model.decisionLog,
            'Sin decisiones persistidas.',
            renderBoardOpsHubDecisionItem
        ),
    ].join('');

    const actionRegisterBody = [
        `<div class="queue-ops-pilot__chips" aria-label="Action metrics">`,
        renderChip(
            'Open',
            String(model.openActions || 0),
            model.openActions ? 'warning' : 'ready'
        ),
        renderChip(
            'Done',
            String(model.actionRegister.length - model.openActions),
            'info'
        ),
        `</div>`,
        boardSummaryList(
            model.actionRegister,
            'Sin acciones persistidas.',
            renderBoardOpsHubActionItem
        ),
    ].join('');

    return [
        renderPanel({
            id: 'queueReleaseBoardOpsHubSteering',
            eyebrow: 'Steering committee',
            title: 'Steering committee',
            summary: model.steering.summary,
            support: model.steering.nextStep,
            state: toneForDecisionMode(model.steering.decisionMode),
            badge: toText(model.steering.decisionMode || 'review'),
            body: steeringBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubOkrCascade',
            eyebrow: 'OKR cascade',
            title: 'OKR cascade',
            summary: model.okrCascade.summary,
            support: model.okrCascade.objective,
            state:
                model.okrCascade.adoptionAvg >= 70 &&
                model.okrCascade.valueAvg >= 75
                    ? 'ready'
                    : 'warning',
            badge: `${model.okrCascade.adoptionAvg}% / ${model.okrCascade.valueAvg}%`,
            body: okrBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubQuarterlyBusinessReview',
            eyebrow: 'Quarterly business review',
            title: 'Quarterly business review',
            summary: model.qbr.summary.join(' · '),
            support: model.qbr.narrative,
            state: model.qbr.tone,
            badge: model.qbr.tone,
            body: qbrBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubProgramCharter',
            eyebrow: 'Program charter',
            title: 'Program charter',
            summary: model.charter.mission,
            support: `${model.charter.scope.length} scope item(s) · ${model.charter.principles.length} principle(s) · ${model.charter.governanceRules.length} rule(s)`,
            state: 'ready',
            badge: 'Canon',
            body: charterBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubGovernanceCalendar',
            eyebrow: 'Governance calendar',
            title: 'Governance calendar',
            summary: model.governanceCalendar.summary,
            support: model.governanceCalendar.nextEvent
                ? `Next event: ${toText(model.governanceCalendar.nextEvent.label)}`
                : 'Sin evento próximo.',
            state: model.governanceCalendar.events.length ? 'ready' : 'warning',
            badge: `${model.governanceCalendar.events.length} event(s)`,
            body: governanceBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubDecisionLog',
            eyebrow: 'Decision log',
            title: 'Decision log',
            summary: `${model.openDecisions} open decision(s)`,
            support: 'Persisted in localStorage by scope.',
            state: model.openDecisions ? 'warning' : 'ready',
            badge: `${model.decisionLog.length} total`,
            body: decisionLogBody,
        }),
        renderPanel({
            id: 'queueReleaseBoardOpsHubActionRegister',
            eyebrow: 'Action register',
            title: 'Action register',
            summary: `${model.openActions} open action(s)`,
            support: 'Persisted in localStorage by scope.',
            state: model.openActions ? 'warning' : 'ready',
            badge: `${model.actionRegister.length} total`,
            body: actionRegisterBody,
        }),
    ].join('');
}

export function renderTurneroReleaseBoardOpsHub(model) {
    const boardState =
        model.state || toneForDecisionMode(model.steering?.decisionMode);
    const actionButtons = [
        {
            id: 'queueReleaseBoardOpsHubCopyAgendaBtn',
            action: 'copy-agenda',
            label: 'Copiar agenda',
            primary: true,
        },
        {
            id: 'queueReleaseBoardOpsHubCopyBriefBtn',
            action: 'copy-brief',
            label: 'Copiar brief',
        },
        {
            id: 'queueReleaseBoardOpsHubCopyActionPackBtn',
            action: 'copy-action-pack',
            label: 'Copiar action pack',
        },
        {
            id: 'queueReleaseBoardOpsHubDownloadJsonBtn',
            action: 'download-json',
            label: 'Descargar JSON',
        },
    ];

    return `
        <section
            id="queueReleaseBoardOpsHub"
            class="queue-ops-pilot__issues turnero-release-board-ops-hub"
            data-state="${escapeHtml(boardState)}"
            data-scope="${escapeHtml(model.scope)}"
            aria-labelledby="queueReleaseBoardOpsHubTitle"
        >
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Board ops hub</p>
                    <h6 id="queueReleaseBoardOpsHubTitle">Board Ops Hub</h6>
                </div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    boardState
                )}">
                    ${escapeHtml(toText(model.steering?.decisionMode || 'review'))}
                </span>
            </div>
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.summary ||
                    `${toText(model.programName)} · ${toText(model.region)}`
            )}</p>
            <p class="queue-ops-pilot__issues-support">${escapeHtml(
                model.support ||
                    'Steering, OKRs, QBR, charter, governance calendar, decision log y action register.'
            )}</p>
            <div class="queue-ops-pilot__chips" aria-label="Board ops metrics">
                ${renderChip('Scope', model.scope, 'info')}
                ${renderChip('Clinics', String(model.clinics.length), 'info')}
                ${renderChip(
                    'Open decisions',
                    String(model.openDecisions),
                    model.openDecisions ? 'warning' : 'ready'
                )}
                ${renderChip(
                    'Open actions',
                    String(model.openActions),
                    model.openActions ? 'warning' : 'ready'
                )}
                ${renderChip(
                    'Adoption avg',
                    `${model.okrCascade.adoptionAvg}%`,
                    model.okrCascade.adoptionAvg >= 70 ? 'ready' : 'warning'
                )}
                ${renderChip(
                    'Value avg',
                    `${model.okrCascade.valueAvg}%`,
                    model.okrCascade.valueAvg >= 75 ? 'ready' : 'warning'
                )}
            </div>
            <div class="queue-ops-pilot__actions" aria-label="Board ops actions">
                ${actionButtons
                    .map(
                        (button) => `
                            <button
                                id="${escapeHtml(button.id)}"
                                type="button"
                                class="queue-ops-pilot__action${
                                    button.primary
                                        ? ' queue-ops-pilot__action--primary'
                                        : ''
                                }"
                                data-board-ops-action="${escapeHtml(button.action)}"
                            >
                                ${escapeHtml(button.label)}
                            </button>
                        `
                    )
                    .join('')}
            </div>
            <div class="turnero-release-board-ops-hub__panels">
                ${renderBoardOpsHubSections(model)}
            </div>
        </section>
    `.trim();
}

function resolveBoardOpsHubAction(target) {
    if (!target) {
        return null;
    }

    if (typeof target.closest === 'function') {
        return target.closest('[data-board-ops-action]');
    }

    if (
        typeof target.getAttribute === 'function' &&
        target.getAttribute('data-board-ops-action')
    ) {
        return target;
    }

    return null;
}

export function mountTurneroReleaseBoardOpsHub(target, input = {}) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const state = host.__turneroReleaseBoardOpsHubState || {};
    state.input = input;
    state.storage = getStorage(input);
    const resolvedSignals = resolveSignals(state.input);
    state.scope = resolvedSignals.scope;
    if (!state.decisionStore) {
        state.decisionStore = createTurneroReleaseDecisionLogStore(
            resolvedSignals.scope,
            { storage: state.storage }
        );
    }
    if (!state.actionStore) {
        state.actionStore = createTurneroReleaseActionRegister(
            resolvedSignals.scope,
            { storage: state.storage }
        );
    }

    const renderCurrent = () => {
        const model = buildTurneroReleaseBoardOpsHubModel(state.input, {
            storage: state.storage,
            decisionStore: state.decisionStore,
            actionStore: state.actionStore,
        });

        state.model = model;
        host.dataset.turneroReleaseBoardOpsHubScope = model.scope;
        host.dataset.turneroReleaseBoardOpsHubDecisionMode =
            model.steering.decisionMode;
        host.innerHTML = renderTurneroReleaseBoardOpsHub(model);
        host.__turneroReleaseBoardOpsHubModel = model;
        host.__turneroReleaseBoardOpsHubRefresh = renderCurrent;
        return model;
    };

    if (state.clickHandler) {
        host.removeEventListener('click', state.clickHandler);
    }

    state.clickHandler = async (event) => {
        const actionTarget = resolveBoardOpsHubAction(event.target);
        if (!actionTarget) {
            return;
        }

        const action = actionTarget.getAttribute('data-board-ops-action');
        if (!action) {
            return;
        }

        const model =
            state.model ||
            buildTurneroReleaseBoardOpsHubModel(state.input, {
                storage: state.storage,
                decisionStore: state.decisionStore,
                actionStore: state.actionStore,
            });

        if (action === 'copy-agenda') {
            await copyToClipboardSafe(model.agendaMarkdown);
            return;
        }

        if (action === 'copy-brief') {
            await copyToClipboardSafe(model.briefMarkdown);
            return;
        }

        if (action === 'copy-action-pack') {
            await copyToClipboardSafe(model.actionPackMarkdown);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot(
                `turnero-release-board-ops-hub-${safeFilePart(model.scope)}.json`,
                buildBoardJsonPack(model)
            );
        }
    };

    host.addEventListener('click', state.clickHandler);
    host.__turneroReleaseBoardOpsHubState = state;
    renderCurrent();
    return host;
}

export default mountTurneroReleaseBoardOpsHub;

function buildSeedDecisionLog(model) {
    const rows = [];
    model.incidents.forEach((incident) => {
        if (incident.severity === 'ready') return;
        rows.push({
            id: `seed-${incident.id}`,
            title: `Resolver ${incident.title}`,
            owner: incident.owner || 'board',
            status: incident.severity === 'alert' ? 'open' : 'review',
            priority: incident.severity === 'alert' ? 'high' : 'medium',
            note:
                incident.detail ||
                `Señal procedente de ${incident.source || 'pilot'}`,
            category: incident.category || 'incident',
            source: incident.source || 'pilot',
            metadata: { incidentId: incident.id },
        });
    });
    model.approvals.forEach((approval) => {
        if (approval.status === 'done') return;
        rows.push({
            id: `seed-${approval.id}`,
            title: `Cerrar aprobación ${approval.title}`,
            owner: approval.owner || 'board',
            status: 'review',
            priority: 'medium',
            note:
                approval.detail ||
                `Aprobación procedente de ${approval.source || 'pilot'}`,
            category: 'approval',
            source: approval.source || 'pilot',
            metadata: { approvalId: approval.id },
        });
    });
    if (!rows.length) {
        rows.push({
            id: 'seed-board-review',
            title: `Revisar steering del programa ${model.region}`,
            owner: 'board',
            status: 'open',
            priority: 'medium',
            note: model.steering.summary,
            category: 'board',
            source: 'steering',
        });
    }
    return uniqueBySignature(
        rows,
        (entry) => `${entry.title}:${entry.owner}:${entry.status}`
    );
}

function buildSeedActionRegister(model) {
    const rows = [];
    model.approvals.forEach((approval, index) => {
        rows.push({
            id: `seed-action-${approval.id || index + 1}`,
            title: `Cerrar ${approval.title}`,
            owner: approval.owner || 'board',
            dueDate: approval.requestedAt || model.generatedAt,
            status: approval.status === 'done' ? 'done' : 'open',
            severity: approval.status === 'done' ? 'low' : 'medium',
            note:
                approval.detail ||
                `Seguimiento de ${approval.source || 'pilot'}`,
            source: approval.source || 'pilot',
            metadata: { approvalId: approval.id },
        });
    });
    model.incidents.forEach((incident, index) => {
        if (incident.severity === 'ready') return;
        rows.push({
            id: `seed-action-${incident.id || index + 1}`,
            title: `Remediar ${incident.title}`,
            owner: incident.owner || 'board',
            dueDate: incident.dueDate || model.generatedAt,
            status: incident.severity === 'alert' ? 'blocked' : 'open',
            severity: incident.severity === 'alert' ? 'high' : 'medium',
            note:
                incident.detail ||
                `Señal procedente de ${incident.source || 'pilot'}`,
            source: incident.source || 'pilot',
            metadata: { incidentId: incident.id },
        });
    });
    if (!rows.length) {
        rows.push({
            id: 'seed-action-board-sync',
            title: 'Mantener la cadence del board',
            owner: 'board',
            dueDate:
                model.governanceCalendar.nextEvent?.timing || model.generatedAt,
            status: 'open',
            severity: 'low',
            note: model.qbr.watchItems[0] || model.steering.nextStep,
            source: 'governance',
        });
    }
    return uniqueBySignature(
        rows,
        (entry) => `${entry.title}:${entry.owner}:${entry.status}`
    );
}

function buildBoardBriefMarkdown(model) {
    const openDecisions = model.decisionLog.filter(
        (entry) => entry.status === 'open' || entry.status === 'review'
    ).length;
    const openActions = model.actionRegister.filter(
        (entry) => entry.status !== 'done'
    ).length;

    return [
        '# Board Ops Brief',
        '',
        `- Program: ${toText(model.programName)}`,
        `- Scope: ${toText(model.scope)}`,
        `- Region: ${toText(model.region)}`,
        `- Decision mode: ${toText(model.steering.decisionMode)}`,
        `- Clinics: ${model.clinics.length}`,
        `- Adoption avg: ${model.okrCascade.adoptionAvg}%`,
        `- Value avg: ${model.okrCascade.valueAvg}%`,
        `- Open decisions: ${openDecisions}`,
        `- Open actions: ${openActions}`,
        '',
        '## Steering agenda',
        ...model.steering.agenda.map((item) => `- ${toText(item)}`),
        '',
        '## Key results',
        ...model.okrCascade.keyResults.map(
            (keyResult) =>
                `- ${toText(keyResult.label)}: ${Number(keyResult.value || 0)}${toText(
                    keyResult.unit || ''
                )} / ${Number(keyResult.target || 0)}${toText(keyResult.unit || '')}`
        ),
        '',
        '## QBR watch',
        ...model.qbr.watchItems.map((item) => `- ${toText(item)}`),
        '',
        `Next step: ${toText(model.steering.nextStep)}`,
    ].join('\n');
}

function buildBoardJsonPack(model) {
    return {
        generatedAt: model.generatedAt,
        scope: model.scope,
        region: model.region,
        programName: model.programName,
        clinics: model.clinics,
        incidents: model.incidents,
        approvals: model.approvals,
        kpis: model.kpis,
        value: model.value,
        governance: model.governance,
        steering: model.steering,
        okrCascade: model.okrCascade,
        qbr: model.qbr,
        charter: model.charter,
        governanceCalendar: model.governanceCalendar,
        decisionLog: model.decisionLog,
        actionRegister: model.actionRegister,
        agendaMarkdown: model.agendaMarkdown,
        briefMarkdown: model.briefMarkdown,
        actionPackMarkdown: model.actionPackMarkdown,
    };
}
