import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    asObject,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseVerdictDossierManifest } from './turnero-release-verdict-dossier-manifest.js';
import { createTurneroReleaseFinalEvidenceConsensusStore } from './turnero-release-final-evidence-consensus-store.js';
import { buildTurneroReleaseRepoDiagnosisCasefile } from './turnero-release-repo-diagnosis-casefile.js';
import { buildTurneroReleaseFinalRiskResidualMap } from './turnero-release-final-risk-residual-map.js';
import { createTurneroReleaseHumanReviewDisagreementLedger } from './turnero-release-human-review-disagreement-ledger.js';
import { buildTurneroReleaseVerdictDossierScore } from './turnero-release-verdict-dossier-score.js';
import { buildTurneroReleaseFinalVerdictDossier } from './turnero-release-final-verdict-dossier-builder.js';

const DEFAULT_DOWNLOAD_FILE_NAME =
    'turnero-release-repo-diagnosis-verdict-dossier-pack.json';

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

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return null;
}

function normalizeScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.scope ||
            currentSnapshot.scope ||
            input.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            'global',
        'global'
    );
}

function normalizeRegion(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            normalizeScope(input, currentSnapshot, clinicProfile),
        'regional'
    );
}

function normalizeClinicId(
    input = {},
    currentSnapshot = {},
    clinicProfile = {}
) {
    return toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
}

function normalizeClinicLabel(
    input = {},
    currentSnapshot = {},
    clinicProfile = {},
    fallback = 'regional'
) {
    return toText(
        input.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            normalizeClinicId(input, currentSnapshot, clinicProfile) ||
            fallback,
        fallback
    );
}

function normalizeClinicShortName(
    input = {},
    currentSnapshot = {},
    clinicProfile = {},
    fallback = 'regional'
) {
    return toText(
        input.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            normalizeClinicLabel(
                input,
                currentSnapshot,
                clinicProfile,
                fallback
            ),
        fallback
    );
}

function renderMetricCard(label, value, detail, tone = 'ready', role = '') {
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

function renderListPanel(title, rows, options = {}) {
    const list = toArray(rows);
    const emptyLabel = toText(options.emptyLabel || 'Sin elementos');
    const limit = Number(options.limit || 4);
    const formatter =
        typeof options.formatter === 'function'
            ? options.formatter
            : (row) => toText(row.label || row.key || row.id || 'Item');
    const detail =
        typeof options.detail === 'function'
            ? options.detail
            : (row) => toText(row.note || row.state || '');
    const tone =
        typeof options.tone === 'function'
            ? options.tone
            : (row) => toText(row.state || row.severity || 'ready');
    const previewRows = list.slice(0, limit);

    return `
        <section class="turnero-release-repo-diagnosis-verdict-dossier__panel">
            <header class="turnero-release-repo-diagnosis-verdict-dossier__panel-header">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(list.length))}</strong>
            </header>
            ${
                previewRows.length > 0
                    ? `<ul class="turnero-release-repo-diagnosis-verdict-dossier__list">${previewRows
                          .map(
                              (row) => `
                    <li data-state="${escapeHtml(tone(row))}">
                        <strong>${escapeHtml(formatter(row))}</strong>
                        <span>${escapeHtml(detail(row) || '\u00a0')}</span>
                    </li>`
                          )
                          .join('')}</ul>`
                    : `<p class="turnero-release-repo-diagnosis-verdict-dossier__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

function buildRepoDiagnosisVerdictDossierPack(input = {}) {
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );
    const clinicProfile = asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            {}
    );
    const scope = normalizeScope(input, currentSnapshot, clinicProfile);
    const region = normalizeRegion(input, currentSnapshot, clinicProfile);
    const clinicId = normalizeClinicId(input, currentSnapshot, clinicProfile);
    const clinicLabel = normalizeClinicLabel(
        input,
        currentSnapshot,
        clinicProfile,
        scope
    );
    const clinicShortName = normalizeClinicShortName(
        input,
        currentSnapshot,
        clinicProfile,
        clinicLabel
    );
    const sourceManifest = asObject(
        input.sourceManifest ||
            input.manifest ||
            currentSnapshot.sourceManifest ||
            {}
    );
    const manifestRows =
        pickArray(
            input.manifestRows,
            sourceManifest.rows,
            currentSnapshot.manifestRows,
            currentSnapshot.items
        ) || [];
    const consensusRows =
        pickArray(
            input.consensusRows,
            currentSnapshot.consensusRows,
            currentSnapshot.consensus,
            currentSnapshot.dossierConsensusRows,
            currentSnapshot.verdictConsensus
        ) || [];
    const disagreementRows =
        pickArray(
            input.disagreementRows,
            currentSnapshot.disagreementRows,
            currentSnapshot.disagreements,
            currentSnapshot.reviewDisagreements
        ) || [];
    const blockers =
        pickArray(
            input.blockers,
            currentSnapshot.blockers,
            currentSnapshot.releaseEvidenceBundle?.blockers,
            currentSnapshot.turneroReleaseEvidenceBundle?.blockers
        ) || [];

    const manifest = buildTurneroReleaseVerdictDossierManifest({
        items: manifestRows.length > 0 ? manifestRows : undefined,
    });
    const casefile = buildTurneroReleaseRepoDiagnosisCasefile({
        manifestRows: manifest.rows,
        consensusRows,
        blockers,
    });
    const riskResidual = buildTurneroReleaseFinalRiskResidualMap({
        blockers,
    });
    const dossierScore = buildTurneroReleaseVerdictDossierScore({
        casefileSummary: casefile.summary,
        riskSummary: riskResidual.summary,
        disagreements: disagreementRows,
        consensus: consensusRows,
    });
    const generatedAt = toText(
        input.generatedAt || currentSnapshot.generatedAt,
        new Date().toISOString()
    );
    const dossierReport = buildTurneroReleaseFinalVerdictDossier({
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        manifest,
        consensus: consensusRows,
        casefile,
        riskResidual,
        disagreements: disagreementRows,
        dossierScore,
        generatedAt,
    });
    const openDisagreements = disagreementRows.filter((row) => {
        const status = toText(row.status || row.state, 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });
    const summary = {
        manifestCount: manifest.summary.all,
        casefileClosed: casefile.summary.closed,
        casefileReview: casefile.summary.review,
        casefileOpen: casefile.summary.open,
        consensusCount: consensusRows.length,
        riskElevated: riskResidual.summary.elevated,
        riskWatch: riskResidual.summary.watch,
        disagreementOpen: openDisagreements.length,
        score: dossierScore.score,
        band: dossierScore.band,
        decision: dossierScore.decision,
    };
    const snapshot = {
        generatedAt,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        sourceManifest,
        manifest,
        consensus: consensusRows.map((row) => ({ ...row })),
        casefile,
        riskResidual,
        disagreements: disagreementRows.map((row) => ({ ...row })),
        dossierScore,
        dossierReport,
        summary,
        blockers: blockers.map((row) => ({ ...row })),
    };

    return {
        ...snapshot,
        clipboardSummary: dossierReport.markdown,
        downloadFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        snapshotFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        snapshot: {
            ...snapshot,
            clipboardSummary: dossierReport.markdown,
            downloadFileName: DEFAULT_DOWNLOAD_FILE_NAME,
            snapshotFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        },
    };
}

function renderTurneroReleaseRepoDiagnosisVerdictDossierHtml(pack) {
    const consensusRows = toArray(pack.consensus);
    const disagreementRows = toArray(pack.disagreements);
    const casefileRows = toArray(pack.casefile?.rows);
    const riskRows = toArray(pack.riskResidual?.rows);

    return `
        <article class="turnero-release-repo-diagnosis-verdict-dossier__card" data-state="${escapeHtml(
            pack.dossierScore.band
        )}">
            <header class="turnero-release-repo-diagnosis-verdict-dossier__header">
                <div>
                    <p class="queue-app-card__eyebrow">Repo diagnosis</p>
                    <h3>Repo Diagnosis Verdict Dossier</h3>
                    <p>
                        Consolida consenso, riesgo residual, casefile y desacuerdos
                        antes del diagnostico honesto final.
                    </p>
                    <p class="turnero-release-repo-diagnosis-verdict-dossier__meta">
                        ${escapeHtml(pack.clinicLabel || pack.scope || 'global')}
                        · ${escapeHtml(formatDateTime(pack.generatedAt))}
                    </p>
                </div>
                <div class="turnero-release-repo-diagnosis-verdict-dossier__actions">
                    <button type="button" data-action="copy-dossier-brief">
                        Copy dossier brief
                    </button>
                    <button type="button" data-action="download-dossier-pack">
                        Download dossier JSON
                    </button>
                </div>
            </header>

            <div class="turnero-release-repo-diagnosis-verdict-dossier__metrics">
                ${renderMetricCard(
                    'Dossier score',
                    String(pack.dossierScore.score),
                    pack.dossierScore.band,
                    pack.dossierScore.band,
                    'score'
                )}
                ${renderMetricCard(
                    'Decision',
                    pack.dossierScore.decision,
                    'Verdict gate',
                    pack.dossierScore.band,
                    'decision'
                )}
                ${renderMetricCard(
                    'Consensus',
                    String(consensusRows.length),
                    `${pack.casefile.summary.closed}/${pack.casefile.summary.all} closed`,
                    consensusRows.length > 0 ? 'ready' : 'warning',
                    'consensus-count'
                )}
                ${renderMetricCard(
                    'Casefile',
                    `${pack.casefile.summary.closed}/${pack.casefile.summary.all}`,
                    `${pack.casefile.summary.review} review · ${pack.casefile.summary.open} open`,
                    pack.casefile.summary.open > 0 ? 'warning' : 'ready',
                    'casefile-closed-count'
                )}
                ${renderMetricCard(
                    'Residual risk',
                    String(pack.riskResidual.summary.elevated),
                    `${pack.riskResidual.summary.watch} watch · ${pack.riskResidual.summary.mitigated} mitigated`,
                    pack.riskResidual.summary.elevated > 0
                        ? 'warning'
                        : 'ready',
                    'risk-elevated-count'
                )}
                ${renderMetricCard(
                    'Disagreements',
                    String(pack.summary.disagreementOpen),
                    `${disagreementRows.length} total`,
                    pack.summary.disagreementOpen > 0 ? 'warning' : 'ready',
                    'disagreement-count'
                )}
            </div>

            <div class="turnero-release-repo-diagnosis-verdict-dossier__body">
                ${renderListPanel('Casefile', casefileRows, {
                    emptyLabel: 'Sin casefile rows',
                    formatter: (row) => row.label || row.key || row.id,
                    detail: (row) =>
                        `${row.state} · ${row.consensusVerdict} · ${row.blockerCount} blockers`,
                    tone: (row) => row.state || 'open',
                })}
                ${renderListPanel('Consensus', consensusRows, {
                    emptyLabel: 'Sin consensus entries',
                    formatter: (row) => row.label || row.key || row.id,
                    detail: (row) => `${row.owner} · ${row.verdict}`,
                    tone: (row) => row.verdict || 'accepted',
                })}
                ${renderListPanel('Residual risk', riskRows, {
                    emptyLabel: 'Sin residual risks',
                    formatter: (row) => row.kind || row.id,
                    detail: (row) =>
                        `${row.severity} · ${row.residual} · ${row.state}`,
                    tone: (row) => row.state || 'low',
                })}
                ${renderListPanel('Disagreements', disagreementRows, {
                    emptyLabel: 'Sin disagreements',
                    formatter: (row) => row.reviewer || row.key || row.id,
                    detail: (row) =>
                        `${row.key || 'n/a'} · ${row.severity} · ${row.status}`,
                    tone: (row) => row.status || 'open',
                })}
            </div>

            <section class="turnero-release-repo-diagnosis-verdict-dossier__editor">
                <div class="turnero-release-repo-diagnosis-verdict-dossier__editor-copy">
                    <h4>Add consensus or disagreement</h4>
                    <p>
                        Persiste review humana y consenso de evidencia en el scope
                        activo del panel.
                    </p>
                </div>
                <div class="turnero-release-repo-diagnosis-verdict-dossier__editor-grid">
                    <section class="turnero-release-repo-diagnosis-verdict-dossier__editor-panel">
                        <p class="queue-app-card__eyebrow">New consensus entry</p>
                        <input data-field="consensus-key" placeholder="Manifest key" />
                        <input data-field="consensus-owner" placeholder="Owner" />
                        <textarea data-field="consensus-note" placeholder="Consensus note"></textarea>
                        <button type="button" data-action="add-consensus">
                            Add consensus
                        </button>
                    </section>
                    <section class="turnero-release-repo-diagnosis-verdict-dossier__editor-panel">
                        <p class="queue-app-card__eyebrow">New disagreement</p>
                        <input data-field="disagreement-reviewer" placeholder="Reviewer" />
                        <input data-field="disagreement-key" placeholder="Manifest key" />
                        <textarea data-field="disagreement-note" placeholder="Disagreement note"></textarea>
                        <button type="button" data-action="add-disagreement">
                            Add disagreement
                        </button>
                    </section>
                </div>
            </section>

            <pre class="turnero-release-repo-diagnosis-verdict-dossier__brief" data-role="dossier-brief">${escapeHtml(
                pack.dossierReport.markdown
            )}</pre>
        </article>
    `;
}

export function buildTurneroReleaseRepoDiagnosisVerdictDossierPack(input = {}) {
    return buildRepoDiagnosisVerdictDossierPack(input);
}

export function mountTurneroReleaseRepoDiagnosisVerdictDossier(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const currentSnapshot = asObject(
        input.currentSnapshot || input.snapshot || {}
    );
    const clinicProfile = asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            {}
    );
    const scope = normalizeScope(input, currentSnapshot, clinicProfile);
    const consensusStore =
        createTurneroReleaseFinalEvidenceConsensusStore(scope);
    const disagreementStore =
        createTurneroReleaseHumanReviewDisagreementLedger(scope);

    let pack = buildRepoDiagnosisVerdictDossierPack({
        ...input,
        currentSnapshot,
        clinicProfile,
        scope,
        consensusRows: consensusStore.list(),
        disagreementRows: disagreementStore.list(),
    });
    let root = null;

    const result = {
        root: null,
        pack,
        recompute: () => {},
    };

    const render = () => {
        pack = buildRepoDiagnosisVerdictDossierPack({
            ...input,
            currentSnapshot,
            clinicProfile,
            scope,
            consensusRows: consensusStore.list(),
            disagreementRows: disagreementStore.list(),
        });
        result.pack = pack;

        if (!root) {
            root = document.createElement('section');
            root.id = 'turneroReleaseRepoDiagnosisVerdictDossier';
            root.className = 'turnero-release-repo-diagnosis-verdict-dossier';
            root.dataset.turneroReleaseRepoDiagnosisVerdictDossier = 'mounted';
            root.addEventListener('click', async (event) => {
                const actionElement =
                    event.target?.closest?.('[data-action]') || event.target;
                const action = actionElement?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'copy-dossier-brief') {
                    await copyToClipboardSafe(
                        pack.dossierReport.markdown || ''
                    );
                    return;
                }

                if (action === 'download-dossier-pack') {
                    downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-consensus') {
                    const key =
                        root.querySelector('[data-field="consensus-key"]')
                            ?.value || '';
                    const owner =
                        root.querySelector('[data-field="consensus-owner"]')
                            ?.value || '';
                    const note =
                        root.querySelector('[data-field="consensus-note"]')
                            ?.value || '';
                    if (!key.trim()) {
                        return;
                    }

                    consensusStore.add({
                        key,
                        label:
                            toArray(pack.manifest.rows).find(
                                (row) => toText(row.key, '') === toText(key, '')
                            )?.label || key,
                        owner: owner || 'program',
                        verdict: 'accepted',
                        note,
                    });
                    render();
                    return;
                }

                if (action === 'add-disagreement') {
                    const reviewer =
                        root.querySelector(
                            '[data-field="disagreement-reviewer"]'
                        )?.value || '';
                    const key =
                        root.querySelector('[data-field="disagreement-key"]')
                            ?.value || '';
                    const note =
                        root.querySelector('[data-field="disagreement-note"]')
                            ?.value || '';
                    if (!reviewer.trim()) {
                        return;
                    }

                    disagreementStore.add({
                        reviewer,
                        key,
                        severity: 'medium',
                        note,
                        status: 'open',
                    });
                    render();
                }
            });
        }

        root.innerHTML =
            renderTurneroReleaseRepoDiagnosisVerdictDossierHtml(pack);
        const scoreNode = root.querySelector('[data-role="score"]');
        const decisionNode = root.querySelector('[data-role="decision"]');
        const consensusNode = root.querySelector(
            '[data-role="consensus-count"]'
        );
        const casefileNode = root.querySelector(
            '[data-role="casefile-closed-count"]'
        );
        const riskNode = root.querySelector(
            '[data-role="risk-elevated-count"]'
        );
        const disagreementNode = root.querySelector(
            '[data-role="disagreement-count"]'
        );
        const briefNode = root.querySelector('[data-role="dossier-brief"]');

        if (scoreNode) {
            scoreNode.textContent = String(pack.dossierScore.score);
        }
        if (decisionNode) {
            decisionNode.textContent = pack.dossierScore.decision;
        }
        if (consensusNode) {
            consensusNode.textContent = String(pack.consensus.length);
        }
        if (casefileNode) {
            casefileNode.textContent = `${pack.casefile.summary.closed}/${pack.casefile.summary.all}`;
        }
        if (riskNode) {
            riskNode.textContent = String(pack.riskResidual.summary.elevated);
        }
        if (disagreementNode) {
            disagreementNode.textContent = String(
                pack.summary.disagreementOpen
            );
        }
        if (briefNode) {
            briefNode.textContent = pack.dossierReport.markdown;
        }
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossier = 'mounted';
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierScore = String(
            pack.dossierScore.score
        );
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierBand =
            pack.dossierScore.band;
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierDecision =
            pack.dossierScore.decision;
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierScope =
            pack.scope;
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierConsensusCount =
            String(pack.consensus.length);
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierDisagreementCount =
            String(pack.summary.disagreementOpen);
        root.dataset.turneroReleaseRepoDiagnosisVerdictDossierGeneratedAt =
            pack.generatedAt;

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(root);
        } else {
            host.innerHTML = '';
            host.appendChild(root);
        }

        host.dataset.turneroReleaseRepoDiagnosisVerdictDossier = 'mounted';
        host.dataset.turneroReleaseRepoDiagnosisVerdictDossierScore = String(
            pack.dossierScore.score
        );
        host.dataset.turneroReleaseRepoDiagnosisVerdictDossierBand =
            pack.dossierScore.band;
        host.dataset.turneroReleaseRepoDiagnosisVerdictDossierDecision =
            pack.dossierScore.decision;
        host.dataset.turneroReleaseRepoDiagnosisVerdictDossierScope =
            pack.scope;

        result.root = root;
        return result;
    };

    result.recompute = render;

    return render();
}

export function renderTurneroReleaseRepoDiagnosisVerdictDossier(
    target,
    input = {}
) {
    return mountTurneroReleaseRepoDiagnosisVerdictDossier(target, input);
}

export {
    buildTurneroReleaseVerdictDossierManifest,
    createTurneroReleaseFinalEvidenceConsensusStore,
    buildTurneroReleaseRepoDiagnosisCasefile,
    buildTurneroReleaseFinalRiskResidualMap,
    createTurneroReleaseHumanReviewDisagreementLedger,
    buildTurneroReleaseVerdictDossierScore,
    buildTurneroReleaseFinalVerdictDossier,
};

export default renderTurneroReleaseRepoDiagnosisVerdictDossier;
