import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    asObject,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseHonestDiagnosticManifest } from './turnero-release-honest-diagnostic-manifest.js';
import { buildTurneroReleaseRepoVerdictEngine } from './turnero-release-repo-verdict-engine.js';
import { createTurneroReleaseEvidenceAttestationLedger } from './turnero-release-evidence-attestation-ledger.js';
import { buildTurneroReleaseBlockerDispositionMap } from './turnero-release-blocker-disposition-map.js';
import { buildTurneroReleaseFinalOwnerVerdicts } from './turnero-release-final-owner-verdicts.js';
import { buildTurneroReleaseDiagnosticVerdictScore } from './turnero-release-diagnostic-verdict-score.js';
import { buildTurneroReleaseHonestDiagnosticReport } from './turnero-release-honest-diagnostic-report-builder.js';

const DEFAULT_DOWNLOAD_FILE_NAME =
    'turnero-release-honest-diagnostic-pack.json';
const DEFAULT_SCOPE = 'global';
const DEFAULT_EVIDENCE_SUMMARY = Object.freeze({
    all: 8,
    complete: 5,
    partial: 2,
    missing: 1,
});
const DEFAULT_CLOSURE_SUMMARY = Object.freeze({
    all: 4,
    ready: 2,
    blocked: 1,
});
const DEFAULT_BLOCKERS = Object.freeze([
    {
        id: 'blk-1',
        kind: 'runtime-source-drift',
        owner: 'infra',
        severity: 'high',
        status: 'open',
        note: 'Runtime source and deployed bundle diverged.',
    },
    {
        id: 'blk-2',
        kind: 'mounted-without-commit-evidence',
        owner: 'program',
        severity: 'medium',
        status: 'open',
        note: 'Host is mounted but commit evidence is incomplete.',
    },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (target) {
        return target;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('turneroReleaseHonestRepoDiagnosisWorkspace') ||
        document.querySelector(
            '[data-turnero-release-honest-repo-diagnosis-workspace]'
        )
    );
}

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return null;
}

function pickObject(...candidates) {
    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate) &&
            Object.keys(candidate).length > 0
        ) {
            return candidate;
        }
    }

    return null;
}

function normalizeScope(value, fallback = DEFAULT_SCOPE) {
    return toText(value, fallback);
}

function countOpenRows(rows = []) {
    return toArray(rows).filter((row) => {
        const status = toText(row.status || row.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;
}

function toneForRepoVerdict(verdict) {
    if (verdict === 'ready-for-honest-diagnostic') {
        return 'ready';
    }

    if (verdict === 'review') {
        return 'warning';
    }

    return 'alert';
}

function renderMetric(label, value, detail, tone = 'info', role = '') {
    return `
        <article class="queue-app-card__metric" data-state="${escapeHtml(tone)}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <small>${escapeHtml(detail || '\u00a0')}</small>
        </article>
    `;
}

function renderRowListItem(row, detail, tone = 'info') {
    return `
        <li data-state="${escapeHtml(tone)}">
            <strong>${escapeHtml(row.label || row.kind || row.owner || 'Item')}</strong>
            <span>${escapeHtml(detail)}</span>
        </li>
    `;
}

function renderPanel(title, count, emptyLabel, itemsHtml) {
    return `
        <section class="turnero-release-honest-repo-diagnosis-workspace__panel">
            <header class="turnero-release-honest-repo-diagnosis-workspace__panel-header">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(count))}</strong>
            </header>
            ${
                itemsHtml
                    ? itemsHtml
                    : `<p class="turnero-release-honest-repo-diagnosis-workspace__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

export function buildTurneroReleaseHonestRepoDiagnosisWorkspacePack(
    input = {}
) {
    const scope = normalizeScope(input.scope || input.region || DEFAULT_SCOPE);
    const region = normalizeScope(
        input.region || input.scope || 'regional',
        'regional'
    );
    const clinicProfile = asObject(input.clinicProfile);
    const currentSnapshot = asObject(input.currentSnapshot);
    const releaseEvidenceBundle = asObject(input.releaseEvidenceBundle);
    const sourceManifest = asObject(input.sourceManifest || input.manifest);
    const detectedPlatform = toText(input.detectedPlatform, 'unknown');
    const clinicId = toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const clinicLabel = toText(
        input.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        input.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const manifestItems = pickArray(
        input.items,
        input.manifestRows,
        currentSnapshot.manifestRows,
        releaseEvidenceBundle.manifestRows,
        sourceManifest.rows
    );
    const manifest = buildTurneroReleaseHonestDiagnosticManifest({
        items: manifestItems || undefined,
    });
    const blockers =
        pickArray(
            input.blockers,
            releaseEvidenceBundle.blockers,
            currentSnapshot.blockers
        ) || DEFAULT_BLOCKERS;
    const gaps =
        pickArray(
            input.gaps,
            releaseEvidenceBundle.gaps,
            currentSnapshot.gaps
        ) || [];
    const branchDelta =
        pickArray(
            input.branchDelta,
            releaseEvidenceBundle.branchDelta,
            currentSnapshot.branchDelta,
            currentSnapshot.branchDeltas
        ) || [];
    const evidenceSummary =
        pickObject(
            input.evidenceSummary,
            releaseEvidenceBundle.evidenceSummary,
            currentSnapshot.evidenceSummary
        ) || DEFAULT_EVIDENCE_SUMMARY;
    const closureSummary =
        pickObject(
            input.closureSummary,
            releaseEvidenceBundle.closureSummary,
            currentSnapshot.closureSummary
        ) || DEFAULT_CLOSURE_SUMMARY;
    const attestationRows =
        pickArray(
            input.attestationRows,
            releaseEvidenceBundle.attestations,
            currentSnapshot.attestations
        ) || [];

    const blockerMap = buildTurneroReleaseBlockerDispositionMap({
        blockers,
        gaps,
        branchDelta,
    });
    const blockerRows = blockerMap.rows.filter(
        (row) => row.source === 'blocker'
    );
    const gapRows = blockerMap.rows.filter((row) => row.source === 'gap');
    const branchDeltaRows = blockerMap.rows.filter(
        (row) => row.source === 'branch-delta'
    );

    const repoVerdict = buildTurneroReleaseRepoVerdictEngine({
        manifestRows: manifest.rows,
        blockerRows,
        gapRows,
        branchDeltaRows,
        evidenceSummary,
        closureSummary,
        releaseEvidenceBundle,
    });
    const ownerVerdicts = buildTurneroReleaseFinalOwnerVerdicts({
        manifestRows: manifest.rows,
        blockerRows,
        gapRows,
        branchDeltaRows,
        attestationRows,
    });
    const verdictScore = buildTurneroReleaseDiagnosticVerdictScore({
        ownerSummary: ownerVerdicts.summary,
        blockerSummary: blockerMap.summary,
        gapSummary: {
            all: gapRows.length,
            open: countOpenRows(gapRows),
        },
        branchDeltaSummary: {
            all: branchDeltaRows.length,
            open: countOpenRows(branchDeltaRows),
        },
        repoVerdict,
    });
    const summary = {
        blockerCount: blockerRows.length,
        gapCount: gapRows.length,
        branchDeltaCount: branchDeltaRows.length,
        openBlockerCount: blockerMap.summary.open,
        mustCloseCount: blockerMap.summary.mustClose,
        openGapCount: countOpenRows(gapRows),
        openBranchDeltaCount: countOpenRows(branchDeltaRows),
        attestationCount: attestationRows.length,
        manifestCount: manifest.rows.length,
    };
    const report = buildTurneroReleaseHonestDiagnosticReport({
        scope,
        region,
        clinicProfile,
        detectedPlatform,
        manifest,
        blockerMap,
        repoVerdict,
        ownerVerdicts,
        attestations: attestationRows,
        verdictScore,
        summary,
        blockerRows,
        gapRows,
        branchDeltaRows,
    });

    return {
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        releaseEvidenceBundle,
        sourceManifest,
        detectedPlatform,
        manifest,
        blockerMap,
        blockerRows,
        gapRows,
        branchDeltaRows,
        repoVerdict,
        ownerVerdicts,
        attestations: attestationRows,
        verdictScore,
        summary,
        report,
        snapshotFileName: input.snapshotFileName || DEFAULT_DOWNLOAD_FILE_NAME,
        generatedAt: new Date().toISOString(),
    };
}

function renderWorkspaceHtml(pack) {
    const dispositionRows = toArray(pack.blockerMap?.rows);
    const ownerRows = toArray(pack.ownerVerdicts?.rows);
    const attestations = toArray(pack.attestations);
    const blockerItems = dispositionRows
        .slice(0, 4)
        .map((row) =>
            renderRowListItem(
                row,
                `${row.source} · ${row.owner} · ${row.disposition}`,
                row.disposition
            )
        )
        .join('');
    const ownerItems = ownerRows
        .slice(0, 4)
        .map((row) =>
            renderRowListItem(
                row,
                `${row.blockers} blockers · ${row.gaps} gaps · ${row.branchDelta} delta · ${row.attestations} attestations`,
                row.readiness
            )
        )
        .join('');
    const attestationItems = attestations
        .slice(0, 4)
        .map((row) =>
            renderRowListItem(
                row,
                `${row.owner} · ${row.status} · ${row.createdAt}`,
                row.status
            )
        )
        .join('');

    return `
        <article class="turnero-release-honest-repo-diagnosis-workspace__card" data-state="${escapeHtml(
            pack.verdictScore?.band || 'review'
        )}">
            <header class="turnero-release-honest-repo-diagnosis-workspace__header">
                <div>
                    <p class="queue-app-card__eyebrow">Honest repo diagnosis</p>
                    <h3>Honest Repo Diagnosis Workspace</h3>
                    <p>
                        Contraste honesto entre evidencia, bloqueos, gaps y branch delta
                        antes del diagnóstico final del repo.
                    </p>
                </div>
                <div class="turnero-release-honest-repo-diagnosis-workspace__actions">
                    <button type="button" data-action="copy-honest-brief">
                        Copy honest brief
                    </button>
                    <button type="button" data-action="download-honest-pack">
                        Download honest JSON
                    </button>
                </div>
            </header>
            <div class="turnero-release-honest-repo-diagnosis-workspace__metrics">
                ${renderMetric(
                    'Verdict score',
                    String(pack.verdictScore?.score ?? 0),
                    pack.verdictScore?.band || 'n/a',
                    pack.verdictScore?.band || 'review',
                    'score'
                )}
                ${renderMetric(
                    'Decision',
                    pack.verdictScore?.decision || 'review',
                    'Honest gate',
                    pack.verdictScore?.band || 'review',
                    'decision'
                )}
                ${renderMetric(
                    'Repo verdict',
                    pack.repoVerdict?.verdict || 'review',
                    `Evidence ${pack.repoVerdict?.evidencePct ?? 0}% · Closure ${
                        pack.repoVerdict?.closurePct ?? 0
                    }%`,
                    toneForRepoVerdict(pack.repoVerdict?.verdict),
                    'repo-verdict'
                )}
                ${renderMetric(
                    'Must-close',
                    String(pack.blockerMap?.summary?.mustClose ?? 0),
                    `${pack.blockerMap?.summary?.open ?? 0} open`,
                    pack.blockerMap?.summary?.mustClose > 0
                        ? 'warning'
                        : 'ready',
                    'must-close-count'
                )}
                ${renderMetric(
                    'Gaps',
                    String(pack.summary?.gapCount ?? 0),
                    `${pack.summary?.openGapCount ?? 0} open`,
                    (pack.summary?.openGapCount ?? 0) > 0 ? 'warning' : 'ready',
                    'gap-count'
                )}
                ${renderMetric(
                    'Branch delta',
                    String(pack.summary?.branchDeltaCount ?? 0),
                    `${pack.summary?.openBranchDeltaCount ?? 0} open`,
                    (pack.summary?.openBranchDeltaCount ?? 0) > 0
                        ? 'warning'
                        : 'ready',
                    'branch-delta-count'
                )}
            </div>
            <div class="turnero-release-honest-repo-diagnosis-workspace__body">
                ${renderPanel(
                    'Blocker disposition',
                    dispositionRows.length,
                    'No blockers, gaps, or branch deltas detected.',
                    blockerItems
                        ? `<ul class="turnero-release-honest-repo-diagnosis-workspace__list">${blockerItems}</ul>`
                        : ''
                )}
                ${renderPanel(
                    'Final owner verdicts',
                    ownerRows.length,
                    'No owner verdicts yet.',
                    ownerItems
                        ? `<ul class="turnero-release-honest-repo-diagnosis-workspace__list">${ownerItems}</ul>`
                        : ''
                )}
                <section class="turnero-release-honest-repo-diagnosis-workspace__panel">
                    <header class="turnero-release-honest-repo-diagnosis-workspace__panel-header">
                        <p class="queue-app-card__eyebrow">Attestation ledger</p>
                        <strong>${escapeHtml(String(attestations.length))}</strong>
                    </header>
                    <div class="turnero-release-honest-repo-diagnosis-workspace__panel-grid">
                        <input data-field="att-key" placeholder="Manifest key" />
                        <input data-field="att-owner" placeholder="Owner" />
                        <textarea
                            data-field="att-note"
                            placeholder="Evidence note"
                            rows="3"
                        ></textarea>
                        <button type="button" data-action="add-attestation">
                            Add attestation
                        </button>
                    </div>
                    ${
                        attestationItems
                            ? `<ul class="turnero-release-honest-repo-diagnosis-workspace__list">${attestationItems}</ul>`
                            : `<p class="turnero-release-honest-repo-diagnosis-workspace__empty">No attestations yet.</p>`
                    }
                </section>
            </div>
            <pre class="turnero-release-honest-repo-diagnosis-workspace__brief" data-role="honest-brief">${escapeHtml(
                pack.report?.markdown || ''
            )}</pre>
        </article>
    `;
}

export function mountTurneroReleaseHonestRepoDiagnosisWorkspace(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const scope = normalizeScope(input.scope || input.region || DEFAULT_SCOPE);
    const attestationStore =
        createTurneroReleaseEvidenceAttestationLedger(scope);
    let pack = buildTurneroReleaseHonestRepoDiagnosisWorkspacePack({
        ...input,
        scope,
        attestationRows: toArray(input.attestationRows).length
            ? input.attestationRows
            : attestationStore.list(),
    });

    const root = document.createElement('section');
    root.id = 'turneroReleaseHonestRepoDiagnosisWorkspace';
    root.className = 'turnero-release-honest-repo-diagnosis-workspace';

    const result = {
        root,
        pack,
        recompute: null,
    };

    const renderState = () => {
        root.dataset.turneroReleaseHonestRepoDiagnosisWorkspace = 'mounted';
        root.dataset.turneroReleaseHonestRepoDiagnosisWorkspaceBand =
            pack.verdictScore?.band || 'review';
        root.dataset.turneroReleaseHonestRepoDiagnosisWorkspaceDecision =
            pack.verdictScore?.decision || 'review';
        root.dataset.turneroReleaseHonestRepoDiagnosisWorkspaceScore = String(
            pack.verdictScore?.score ?? 0
        );
        root.innerHTML = renderWorkspaceHtml(pack);
    };

    const recompute = () => {
        pack = buildTurneroReleaseHonestRepoDiagnosisWorkspacePack({
            ...input,
            scope,
            attestationRows: attestationStore.list(),
        });
        result.pack = pack;
        renderState();
        return pack;
    };

    result.recompute = recompute;

    root.addEventListener('click', async (event) => {
        const actionNode = event.target?.closest?.('[data-action]');
        const action = actionNode?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-honest-brief') {
            await copyToClipboardSafe(pack.report?.markdown || '');
            return;
        }

        if (action === 'download-honest-pack') {
            downloadJsonSnapshot(pack.snapshotFileName, pack);
            return;
        }

        if (action === 'add-attestation') {
            const key =
                root.querySelector('[data-field="att-key"]')?.value || '';
            const owner =
                root.querySelector('[data-field="att-owner"]')?.value || '';
            const note =
                root.querySelector('[data-field="att-note"]')?.value || '';
            if (!key.trim()) {
                return;
            }

            attestationStore.add({
                key,
                label: key,
                owner: owner || 'program',
                note,
                status: 'attested',
            });
            recompute();
        }
    });

    renderState();
    host.appendChild(root);
    return result;
}

export function wireTurneroReleaseHonestRepoDiagnosisWorkspace({
    mountNode,
    ...input
} = {}) {
    return mountTurneroReleaseHonestRepoDiagnosisWorkspace(mountNode, input);
}

export function renderTurneroReleaseHonestRepoDiagnosisWorkspace(
    target,
    input = {}
) {
    return mountTurneroReleaseHonestRepoDiagnosisWorkspace(target, input);
}

export default mountTurneroReleaseHonestRepoDiagnosisWorkspace;
