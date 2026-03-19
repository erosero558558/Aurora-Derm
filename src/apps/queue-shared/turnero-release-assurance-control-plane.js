import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseEvidenceLedger } from './turnero-release-evidence-ledger.js';
import { createTurneroReleaseAuditTrailStore } from './turnero-release-audit-trail-store.js';
import { buildTurneroReleaseControlLibrary } from './turnero-release-control-library.js';
import { createTurneroReleasePolicyExceptionRegistry } from './turnero-release-policy-exception-registry.js';
import { buildTurneroReleaseStageGateAuditor } from './turnero-release-stage-gate-auditor.js';
import {
    buildTurneroReleaseReadinessCertification,
    readinessCertificationToMarkdown,
} from './turnero-release-readiness-certification.js';
import { buildTurneroReleaseAssuranceScorecard } from './turnero-release-assurance-scorecard.js';

export {
    buildTurneroReleaseEvidenceLedger,
    createTurneroReleaseAuditTrailStore,
    buildTurneroReleaseControlLibrary,
    createTurneroReleasePolicyExceptionRegistry,
    buildTurneroReleaseStageGateAuditor,
    buildTurneroReleaseReadinessCertification,
    readinessCertificationToMarkdown,
    buildTurneroReleaseAssuranceScorecard,
};

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
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return isDomElement(target) ? target : null;
}

function normalizeRows(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasObjectContent(value) {
    return Boolean(
        value && typeof value === 'object' && Object.keys(value).length
    );
}

function mapToneToComplianceStatus(tone) {
    const normalized = String(tone || '')
        .trim()
        .toLowerCase();
    if (
        normalized === 'alert' ||
        normalized === 'critical' ||
        normalized === 'blocked'
    ) {
        return 'red';
    }
    if (normalized === 'warning' || normalized === 'watch') {
        return 'amber';
    }
    return 'green';
}

function mapDecisionToRiskGrade(decision) {
    const normalized = String(decision || '')
        .trim()
        .toLowerCase();
    if (normalized === 'hold') {
        return 'D';
    }
    if (normalized === 'review') {
        return 'B';
    }
    return 'A';
}

function buildDefaultEvidenceRows(model) {
    const clinicProfile = asObject(
        model.clinicProfile || model.turneroClinicProfile || {}
    );
    const clinicId = toText(
        model.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            model.scope ||
            'regional',
        'regional'
    );

    return [
        {
            id: 'clinic-profile',
            label: 'Clinic profile snapshot',
            owner: 'frontend',
            kind: 'profile',
            status: hasObjectContent(clinicProfile) ? 'captured' : 'missing',
            clinicId,
        },
        {
            id: 'incident-journal',
            label: 'Release incident journal',
            owner: 'ops',
            kind: 'incident-journal',
            status: normalizeRows(model.incidents).length
                ? 'captured'
                : 'stale',
            clinicId,
        },
        {
            id: 'governance-pack',
            label: 'Governance pack',
            owner: 'deploy',
            kind: 'governance',
            status: hasObjectContent(model.governancePack)
                ? 'captured'
                : 'stale',
            clinicId,
        },
        {
            id: 'board-ops-pack',
            label: 'Board ops brief',
            owner: 'program',
            kind: 'board-ops',
            status: hasObjectContent(model.boardOpsPack) ? 'captured' : 'stale',
            clinicId,
        },
    ];
}

function buildDefaultControlRows(model) {
    const incidents = normalizeRows(model.incidents);
    const hasCriticalIncident = incidents.some((incident) =>
        ['critical', 'alert', 'blocked', 'error'].includes(
            String(incident?.severity || incident?.state || '')
                .trim()
                .toLowerCase()
        )
    );
    const hasAnyIncident = incidents.length > 0;
    const complianceStatus = String(
        model.complianceStatus ||
            mapToneToComplianceStatus(model.tone) ||
            'amber'
    )
        .trim()
        .toLowerCase();
    const hasGovernancePack = hasObjectContent(model.governancePack);
    const hasBoardOpsPack = hasObjectContent(model.boardOpsPack);

    return [
        {
            key: 'clinic-profile-canon',
            label: 'Clinic profile canon',
            owner: 'frontend',
            state: hasObjectContent(
                model.clinicProfile || model.turneroClinicProfile
            )
                ? 'pass'
                : 'watch',
        },
        {
            key: 'incident-journal',
            label: 'Release incident journal',
            owner: 'ops',
            state: hasCriticalIncident
                ? 'fail'
                : hasAnyIncident
                  ? 'watch'
                  : 'pass',
        },
        {
            key: 'governance-pack',
            label: 'Governance pack',
            owner: 'deploy',
            state:
                complianceStatus === 'red'
                    ? 'fail'
                    : complianceStatus === 'amber'
                      ? 'watch'
                      : 'pass',
        },
        {
            key: 'board-ops-pack',
            label: 'Board ops brief',
            owner: 'program',
            state: hasBoardOpsPack || hasGovernancePack ? 'pass' : 'watch',
        },
    ];
}

function buildAssuranceSummary(model) {
    const controlSummary = model.controls?.summary || {};
    const evidenceTotals = model.evidence?.totals || {};
    const gateStates = normalizeRows(model.stageGates?.gates).map(
        (gate) => gate.state
    );

    return [
        `Scope: ${model.scope}`,
        `Region: ${model.region}`,
        `Certification: ${model.certification?.status || 'conditional'}`,
        `Score: ${model.scorecard?.score ?? 0} (${model.scorecard?.grade || 'N/A'})`,
        `Decision: ${model.scorecard?.decision || 'review'}`,
        `Controls: ${controlSummary.pass || 0} pass / ${controlSummary.watch || 0} watch / ${controlSummary.fail || 0} fail`,
        `Evidence: ${evidenceTotals.captured || 0} captured / ${evidenceTotals.stale || 0} stale / ${evidenceTotals.missing || 0} missing`,
        `Gates: ${gateStates.join(' · ') || 'n/a'}`,
        `Open policy exceptions: ${model.openExceptionsCount}`,
        `Audit entries: ${model.auditTrail.length}`,
    ].join('\n');
}

function assuranceBriefToMarkdown(pack = {}) {
    const lines = [
        '# Assurance Control Plane',
        '',
        `Certification: ${pack.certification?.status || 'conditional'}`,
        `Assurance score: ${pack.scorecard?.score ?? 0} (${pack.scorecard?.grade || 'N/A'})`,
        `Decision: ${pack.scorecard?.decision || 'review'}`,
        `Open policy exceptions: ${pack.openExceptionsCount ?? (pack.exceptions || []).filter((item) => item.status !== 'closed').length}`,
        `Audit entries: ${(pack.auditTrail || []).length}`,
    ];

    return lines.join('\n');
}

function renderMetric(label, value, state = 'ready', role = '') {
    return `<article class="turnero-release-assurance-control-plane__metric" data-state="${escapeHtml(
        state
    )}">
        <strong>${escapeHtml(label)}</strong>
        <span${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
            value
        )}</span>
    </article>`;
}

function renderListRow(label, value, state = 'ready') {
    return `<li class="turnero-release-assurance-control-plane__list-row" data-state="${escapeHtml(
        state
    )}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value)}</span>
    </li>`;
}

function renderAssuranceHtml(model) {
    const gateStates = normalizeRows(model.stageGates?.gates);
    const gateStateText =
        gateStates.map((gate) => gate.state).join(' · ') || 'n/a';
    const controlSummary = model.controls?.summary || {};
    const evidenceTotals = model.evidence?.totals || {};
    const exceptionCount = model.openExceptionsCount;
    const auditCount = model.auditTrail.length;
    const certificationState = model.certification?.status || 'conditional';
    const scorecard = model.scorecard || {};

    return `
        <header class="turnero-release-assurance-control-plane__header">
            <div class="turnero-release-assurance-control-plane__copy">
                <p class="queue-app-card__eyebrow">Assurance</p>
                <h6 id="queueReleaseAssuranceControlPlaneTitle">Assurance Control Plane</h6>
                <p id="queueReleaseAssuranceControlPlaneSummary" class="turnero-release-assurance-control-plane__summary">${escapeHtml(
                    model.summary
                )}</p>
                <p id="queueReleaseAssuranceControlPlaneSupport" class="turnero-release-assurance-control-plane__support">${escapeHtml(
                    model.summary
                )}</p>
            </div>
            <div class="turnero-release-assurance-control-plane__meta">
                <span data-state="${escapeHtml(certificationState)}">${escapeHtml(
                    certificationState
                )}</span>
                <span>${escapeHtml(model.clinicLabel || model.clinicId || 'regional')}</span>
                <span>Generated ${escapeHtml(model.generatedAt || '')}</span>
            </div>
        </header>

        <div class="turnero-release-assurance-control-plane__metrics">
            ${renderMetric(
                'Certification',
                certificationState,
                certificationState,
                'certification-status'
            )}
            ${renderMetric(
                'Assurance score',
                `${scorecard.score ?? 0} / ${scorecard.grade || 'N/A'}`,
                scorecard.decision || certificationState,
                'assurance-score'
            )}
            ${renderMetric(
                'Controls',
                `${controlSummary.pass || 0} pass · ${controlSummary.watch || 0} watch · ${controlSummary.fail || 0} fail`,
                controlSummary.fail > 0
                    ? 'alert'
                    : controlSummary.watch > 0
                      ? 'warning'
                      : 'ready',
                'control-summary'
            )}
            ${renderMetric(
                'Evidence',
                `${evidenceTotals.captured || 0} captured · ${evidenceTotals.stale || 0} stale · ${evidenceTotals.missing || 0} missing`,
                evidenceTotals.missing > 0
                    ? 'alert'
                    : evidenceTotals.stale > 0
                      ? 'warning'
                      : 'ready',
                'evidence-status'
            )}
            ${renderMetric(
                'Open exceptions',
                String(exceptionCount),
                exceptionCount > 0 ? 'warning' : 'ready',
                'open-exceptions'
            )}
            ${renderMetric(
                'Audit entries',
                String(auditCount),
                auditCount > 0 ? 'ready' : 'info',
                'audit-entries'
            )}
        </div>

        <div class="turnero-release-assurance-control-plane__actions">
            <button type="button" id="queueReleaseAssuranceControlPlaneCopyCertificationBriefBtn" data-action="copy-certification-brief">Copy certification brief</button>
            <button type="button" id="queueReleaseAssuranceControlPlaneDownloadJsonBtn" data-action="download-assurance-json">Download assurance JSON</button>
            <button type="button" id="queueReleaseAssuranceControlPlaneAddAuditEntryBtn" data-action="add-audit-entry">Add audit entry</button>
            <button type="button" id="queueReleaseAssuranceControlPlaneAddPolicyExceptionBtn" data-action="add-policy-exception">Add policy exception</button>
        </div>

        <div class="turnero-release-assurance-control-plane__overview">
            <ul class="turnero-release-assurance-control-plane__list">
                ${renderListRow('Scope', model.scope, 'info')}
                ${renderListRow('Region', model.region, 'info')}
                ${renderListRow('Gate states', gateStateText, certificationState)}
                ${renderListRow('Exceptions', String(exceptionCount), exceptionCount > 0 ? 'warning' : 'ready')}
                ${renderListRow('Audit trail', String(auditCount), auditCount > 0 ? 'ready' : 'info')}
            </ul>
        </div>

        <div class="turnero-release-assurance-control-plane__inputs">
            <div class="turnero-release-assurance-control-plane__input-group">
                <label>
                    <span>New policy exception</span>
                    <input type="text" data-field="exception-title" placeholder="Exception title" />
                </label>
                <label>
                    <span>Owner</span>
                    <input type="text" data-field="exception-owner" placeholder="Owner" />
                </label>
                <label>
                    <span>Expiry date</span>
                    <input type="text" data-field="exception-expiry" placeholder="Expiry date" />
                </label>
                <label>
                    <span>Rationale</span>
                    <textarea data-field="exception-rationale" placeholder="Rationale"></textarea>
                </label>
            </div>
            <div class="turnero-release-assurance-control-plane__input-group">
                <label>
                    <span>Audit action</span>
                    <input type="text" data-field="audit-action" placeholder="Action" />
                </label>
                <label>
                    <span>Audit actor</span>
                    <input type="text" data-field="audit-actor" placeholder="Actor" />
                </label>
                <label>
                    <span>Audit note</span>
                    <textarea data-field="audit-note" placeholder="Note"></textarea>
                </label>
            </div>
        </div>

        <pre data-role="assurance-brief" class="turnero-release-assurance-control-plane__brief">${escapeHtml(
            assuranceBriefToMarkdown(model)
        )}</pre>
    `;
}

function bindAssuranceActions(root, model, refresh) {
    if (!(root instanceof HTMLElement)) {
        return;
    }

    root.addEventListener('click', async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-certification-brief') {
            await copyToClipboardSafe(
                readinessCertificationToMarkdown(model.certification)
            );
            return;
        }

        if (action === 'download-assurance-json') {
            downloadJsonSnapshot(model.snapshotFileName, model.pack);
            return;
        }

        if (action === 'add-audit-entry') {
            const auditAction =
                root.querySelector('[data-field="audit-action"]')?.value || '';
            const auditActor =
                root.querySelector('[data-field="audit-actor"]')?.value || '';
            const auditNote =
                root.querySelector('[data-field="audit-note"]')?.value || '';
            model.auditStore.add({
                action: auditAction || 'manual-review',
                actor: auditActor || 'operator',
                note: auditNote || '',
                status: 'recorded',
            });
            refresh();
            return;
        }

        if (action === 'add-policy-exception') {
            const title =
                root.querySelector('[data-field="exception-title"]')?.value ||
                '';
            const owner =
                root.querySelector('[data-field="exception-owner"]')?.value ||
                '';
            const expiresAt =
                root.querySelector('[data-field="exception-expiry"]')?.value ||
                '';
            const rationale =
                root.querySelector('[data-field="exception-rationale"]')
                    ?.value || '';

            if (!title.trim()) {
                return;
            }

            model.exceptionStore.add({
                title,
                owner,
                expiresAt,
                rationale,
                status: 'open',
            });
            refresh();
        }
    });
}

export function buildTurneroReleaseAssuranceControlPlaneModel(input = {}) {
    const context = asObject(input);
    const scope = toText(
        context.scope || context.region || context.clinicId || 'global',
        'global'
    );
    const clinicProfile = asObject(
        context.clinicProfile || context.turneroClinicProfile || {}
    );
    const clinicId = toText(
        context.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            scope,
        scope
    );
    const clinicLabel = toText(
        context.clinicLabel ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicProfile.clinicName ||
            clinicProfile.clinic_name ||
            clinicId,
        clinicId
    );
    const region = toText(
        context.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            clinicProfile.location?.region ||
            scope,
        scope
    );
    const auditStore = createTurneroReleaseAuditTrailStore(scope);
    const exceptionStore = createTurneroReleasePolicyExceptionRegistry(scope);
    const auditTrail = auditStore.list();
    const exceptions = exceptionStore.list();
    const evidence = buildTurneroReleaseEvidenceLedger({
        clinicId,
        evidence:
            Array.isArray(context.evidence) && context.evidence.length
                ? context.evidence
                : buildDefaultEvidenceRows({
                      ...context,
                      clinicId,
                      clinicProfile,
                  }),
    });
    const controls = buildTurneroReleaseControlLibrary({
        controls:
            Array.isArray(context.controls) && context.controls.length
                ? context.controls
                : buildDefaultControlRows({
                      ...context,
                      clinicId,
                      clinicProfile,
                  }),
    });
    const incidents = normalizeRows(context.incidents);
    const complianceStatus = toText(
        context.complianceStatus ||
            context.governancePack?.compliance?.status ||
            mapToneToComplianceStatus(context.tone) ||
            'amber',
        'amber'
    ).toLowerCase();
    const riskGrade = toText(
        context.riskGrade ||
            context.governancePack?.risks?.grade ||
            mapDecisionToRiskGrade(context.decision) ||
            'B',
        'B'
    ).toUpperCase();
    const stageGates = buildTurneroReleaseStageGateAuditor({
        incidents,
        complianceStatus,
        riskGrade,
        controlSummary: controls.summary,
        evidenceTotals: evidence.totals,
    });
    const certification = buildTurneroReleaseReadinessCertification({
        stageGates: stageGates.gates,
        evidenceTotals: evidence.totals,
        exceptions,
    });
    const scorecard = buildTurneroReleaseAssuranceScorecard({
        controlSummary: controls.summary,
        evidenceTotals: evidence.totals,
        exceptions,
    });
    const openExceptionsCount = exceptions.filter(
        (item) =>
            String(item?.status || '')
                .trim()
                .toLowerCase() !== 'closed'
    ).length;
    const generatedAt = new Date().toISOString();
    const summary = buildAssuranceSummary({
        scope,
        region,
        certification,
        scorecard,
        controls,
        evidence,
        stageGates,
        openExceptionsCount,
        auditTrail,
    });
    const pack = {
        title: 'Assurance Control Plane',
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicProfile,
        incidents,
        governancePack: asObject(
            context.governancePack || context.turneroGovernancePack || {}
        ),
        boardOpsPack: asObject(
            context.boardOpsPack || context.turneroBoardOpsPack || {}
        ),
        evidence,
        controls,
        exceptions,
        auditTrail,
        stageGates,
        certification,
        scorecard,
        openExceptionsCount,
        summary,
        generatedAt,
    };

    return {
        id: 'turneroReleaseAssuranceControlPlane',
        hostId: 'queueReleaseAssuranceControlPlaneHost',
        panelId: 'queueReleaseAssuranceControlPlane',
        title: 'Assurance Control Plane',
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicProfile,
        incidents,
        governancePack: pack.governancePack,
        boardOpsPack: pack.boardOpsPack,
        evidence,
        controls,
        exceptions,
        auditTrail,
        stageGates,
        certification,
        scorecard,
        openExceptionsCount,
        summary,
        generatedAt,
        snapshotFileName: 'turnero-release-assurance-pack.json',
        pack,
    };
}

export function mountTurneroReleaseAssuranceControlPlane(target, input = {}) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const model = buildTurneroReleaseAssuranceControlPlaneModel(input);
    const root = document.createElement('section');
    root.innerHTML = renderAssuranceHtml(model);
    root.id = 'queueReleaseAssuranceControlPlane';
    root.className = 'queue-app-card turnero-release-assurance-control-plane';
    root.dataset.state = model.certification?.status || 'conditional';
    root.dataset.scope = model.scope || 'global';
    root.dataset.region = model.region || model.scope || 'global';
    root.dataset.clinicId = model.clinicId || 'global';
    root.dataset.requestId = model.generatedAt || new Date().toISOString();

    const summaryNode = root.querySelector(
        '#queueReleaseAssuranceControlPlaneSummary'
    );
    const supportNode = root.querySelector(
        '#queueReleaseAssuranceControlPlaneSupport'
    );
    const certificationNode = root.querySelector(
        '[data-role="certification-status"]'
    );
    const scoreNode = root.querySelector('[data-role="assurance-score"]');
    const evidenceNode = root.querySelector('[data-role="evidence-status"]');
    const exceptionsNode = root.querySelector('[data-role="open-exceptions"]');
    const auditNode = root.querySelector('[data-role="audit-entries"]');
    const briefNode = root.querySelector('[data-role="assurance-brief"]');

    const syncNodes = () => {
        model.auditTrail = model.auditStore.list();
        model.exceptions = model.exceptionStore.list();
        model.openExceptionsCount = model.exceptions.filter(
            (item) =>
                String(item?.status || '')
                    .trim()
                    .toLowerCase() !== 'closed'
        ).length;
        model.certification = buildTurneroReleaseReadinessCertification({
            stageGates: model.stageGates.gates,
            evidenceTotals: model.evidence.totals,
            exceptions: model.exceptions,
        });
        model.scorecard = buildTurneroReleaseAssuranceScorecard({
            controlSummary: model.controls.summary,
            evidenceTotals: model.evidence.totals,
            exceptions: model.exceptions,
        });
        model.summary = buildAssuranceSummary({
            scope: model.scope,
            region: model.region,
            certification: model.certification,
            scorecard: model.scorecard,
            controls: model.controls,
            evidence: model.evidence,
            stageGates: model.stageGates,
            openExceptionsCount: model.openExceptionsCount,
            auditTrail: model.auditTrail,
        });
        model.pack.auditTrail = model.auditTrail;
        model.pack.exceptions = model.exceptions;
        model.pack.openExceptionsCount = model.openExceptionsCount;
        model.pack.certification = model.certification;
        model.pack.scorecard = model.scorecard;
        model.pack.summary = model.summary;

        if (summaryNode) {
            summaryNode.textContent = model.summary;
        }
        if (supportNode) {
            supportNode.textContent = model.summary;
        }
        if (certificationNode) {
            certificationNode.textContent = model.certification.status;
        }
        if (scoreNode) {
            scoreNode.textContent = `${model.scorecard.score} / ${model.scorecard.grade}`;
        }
        if (evidenceNode) {
            evidenceNode.textContent = `${model.evidence.totals.captured} captured · ${model.evidence.totals.stale} stale · ${model.evidence.totals.missing} missing`;
        }
        if (exceptionsNode) {
            exceptionsNode.textContent = String(model.openExceptionsCount);
        }
        if (auditNode) {
            auditNode.textContent = String(model.auditTrail.length);
        }
        if (briefNode) {
            briefNode.textContent = assuranceBriefToMarkdown(model);
        }
        root.dataset.state = model.certification.status || 'conditional';
        root.dataset.score = String(model.scorecard.score || 0);
    };

    model.auditStore = createTurneroReleaseAuditTrailStore(model.scope);
    model.exceptionStore = createTurneroReleasePolicyExceptionRegistry(
        model.scope
    );

    root.dataset.state = model.certification?.status || 'conditional';
    root.dataset.score = String(model.scorecard?.score || 0);
    root.dataset.decision = model.scorecard?.decision || 'review';

    host.innerHTML = '';
    host.appendChild(root);
    bindAssuranceActions(root, model, syncNodes);
    model.auditTrail = model.auditStore.list();
    model.exceptions = model.exceptionStore.list();
    syncNodes();

    host.dataset.turneroReleaseAssuranceControlPlaneScope =
        model.scope || 'global';
    host.dataset.turneroReleaseAssuranceControlPlaneRequestId =
        model.generatedAt || new Date().toISOString();
    host.dataset.turneroReleaseAssuranceControlPlaneDecision =
        model.scorecard?.decision || 'review';

    return {
        root,
        pack: model.pack,
        refresh: syncNodes,
    };
}

export { assuranceBriefToMarkdown };

export default buildTurneroReleaseAssuranceControlPlaneModel;
