import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseDiagnosticAdjudicationManifest } from './turnero-release-diagnostic-adjudication-manifest.js';
import { buildTurneroReleaseEvidenceBundleRegistry } from './turnero-release-evidence-bundle-registry.js';
import { createTurneroReleaseReviewPanelSignoffStore } from './turnero-release-review-panel-signoff-store.js';
import { buildTurneroReleaseFinalAdjudicationMatrix } from './turnero-release-final-adjudication-matrix.js';
import { buildTurneroReleaseRepoDiagnosisDispositionEngine } from './turnero-release-repo-diagnosis-disposition-engine.js';
import { buildTurneroReleaseFinalAuditBinderScore } from './turnero-release-final-audit-binder-score.js';
import { buildTurneroReleaseFinalAuditBinder } from './turnero-release-final-audit-binder-builder.js';

const DEFAULT_DOWNLOAD_FILE_NAME =
    'turnero-release-final-diagnosis-adjudication-binder.json';
const DEFAULT_SCOPE = 'global';
const DEFAULT_MANIFEST_ITEMS = Object.freeze([
    {
        key: 'mainline-evidence',
        label: 'Mainline Evidence',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'runtime-alignment',
        label: 'Runtime Alignment',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'surface-readiness',
        label: 'Surface Readiness',
        owner: 'ops',
        criticality: 'high',
    },
    {
        key: 'integration-trust',
        label: 'Integration Trust',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'closure-completeness',
        label: 'Closure Completeness',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'human-review',
        label: 'Human Review',
        owner: 'program',
        criticality: 'critical',
    },
]);
const DEFAULT_BUNDLES = Object.freeze([
    {
        key: 'mainline-evidence',
        label: 'Mainline Evidence',
        owner: 'program',
        status: 'ready',
        artifactCount: 4,
    },
    {
        key: 'runtime-alignment',
        label: 'Runtime Alignment',
        owner: 'infra',
        status: 'pending',
        artifactCount: 2,
    },
    {
        key: 'surface-readiness',
        label: 'Surface Readiness',
        owner: 'ops',
        status: 'ready',
        artifactCount: 3,
    },
    {
        key: 'closure-completeness',
        label: 'Closure Completeness',
        owner: 'program',
        status: 'ready',
        artifactCount: 2,
    },
]);
const DEFAULT_BLOCKERS = Object.freeze([
    {
        id: 'blk-1',
        kind: 'runtime-source-drift',
        owner: 'infra',
        severity: 'high',
        status: 'open',
        note: 'Runtime source and release evidence diverged.',
    },
    {
        id: 'blk-2',
        kind: 'signoff-gap',
        owner: 'program',
        severity: 'medium',
        status: 'open',
        note: 'Review panel signoff still needs closure.',
    },
]);

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
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return null;
}

function normalizeSourceInput(input = {}) {
    const currentSnapshot = asObject(
        input.currentSnapshot || input.snapshot || {}
    );
    const releaseEvidenceBundle = asObject(
        input.releaseEvidenceBundle ||
            currentSnapshot.releaseEvidenceBundle ||
            currentSnapshot.turneroReleaseEvidenceBundle ||
            {}
    );
    const clinicProfile = asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            releaseEvidenceBundle.clinicProfile ||
            releaseEvidenceBundle.turneroClinicProfile ||
            {}
    );
    const clinicId = toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            releaseEvidenceBundle.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const region = toText(
        input.region ||
            currentSnapshot.region ||
            releaseEvidenceBundle.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            clinicId ||
            'regional',
        'regional'
    );
    const scope = toText(
        input.scope ||
            currentSnapshot.scope ||
            releaseEvidenceBundle.scope ||
            clinicId ||
            region ||
            DEFAULT_SCOPE,
        DEFAULT_SCOPE
    );
    const clinicLabel = toText(
        input.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            releaseEvidenceBundle.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        input.clinicShortName ||
            currentSnapshot.clinicShortName ||
            releaseEvidenceBundle.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const detectedPlatform = toText(
        input.detectedPlatform ||
            input.platform ||
            currentSnapshot.detectedPlatform ||
            releaseEvidenceBundle.detectedPlatform,
        ''
    );
    const generatedAt = toText(
        input.generatedAt ||
            currentSnapshot.generatedAt ||
            releaseEvidenceBundle.generatedAt,
        new Date().toISOString()
    );
    const downloadFileName = toText(
        input.downloadFileName ||
            currentSnapshot.downloadFileName ||
            releaseEvidenceBundle.downloadFileName,
        DEFAULT_DOWNLOAD_FILE_NAME
    );
    const manifestItems =
        pickArray(
            input.manifestItems,
            input.items,
            currentSnapshot.manifestItems,
            currentSnapshot.adjudicationItems,
            releaseEvidenceBundle.manifestItems,
            releaseEvidenceBundle.adjudicationItems
        ) || DEFAULT_MANIFEST_ITEMS;
    const bundles =
        pickArray(
            input.bundles,
            currentSnapshot.bundles,
            currentSnapshot.evidenceBundles,
            releaseEvidenceBundle.bundles,
            releaseEvidenceBundle.evidenceBundles
        ) || DEFAULT_BUNDLES;
    const blockers =
        pickArray(
            input.blockers,
            currentSnapshot.blockers,
            releaseEvidenceBundle.blockers,
            currentSnapshot.reviewBlockers
        ) || DEFAULT_BLOCKERS;
    const signoffs =
        pickArray(
            input.signoffs,
            currentSnapshot.signoffs,
            currentSnapshot.reviewPanelSignoffs,
            releaseEvidenceBundle.signoffs,
            releaseEvidenceBundle.reviewPanelSignoffs
        ) || [];

    return {
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        detectedPlatform,
        generatedAt,
        downloadFileName,
        manifestItems,
        bundles,
        blockers,
        signoffs,
        sources: {
            currentSnapshot: Boolean(
                currentSnapshot && Object.keys(currentSnapshot).length > 0
            ),
            releaseEvidenceBundle: Boolean(
                releaseEvidenceBundle &&
                Object.keys(releaseEvidenceBundle).length > 0
            ),
            clinicProfile: Boolean(
                clinicProfile && Object.keys(clinicProfile).length > 0
            ),
        },
    };
}

function countVerdicts(rows, verdict) {
    return toArray(rows).filter((row) => row.verdict === verdict).length;
}

function buildPackFromSource(source, signoffsOverride = null) {
    const manifest = buildTurneroReleaseDiagnosticAdjudicationManifest({
        items: source.manifestItems,
    });
    const bundleRegistry = buildTurneroReleaseEvidenceBundleRegistry({
        bundles: source.bundles,
    });
    const signoffs = toArray(
        signoffsOverride === null ? source.signoffs : signoffsOverride
    ).map((row) => ({
        id: toText(row.id, ''),
        reviewer: toText(row.reviewer, 'reviewer'),
        verdict:
            toText(row.verdict, 'review').toLowerCase() === 'approve'
                ? 'approve'
                : toText(row.verdict, 'review').toLowerCase() === 'reject'
                  ? 'reject'
                  : 'review',
        note: toText(row.note, ''),
        createdAt: toText(row.createdAt, new Date().toISOString()),
    }));
    const signoffStore = createTurneroReleaseReviewPanelSignoffStore(
        source.scope || DEFAULT_SCOPE,
        signoffs
    );
    const storedSignoffs = signoffStore.list();
    const matrix = buildTurneroReleaseFinalAdjudicationMatrix({
        manifestRows: manifest.rows,
        bundleRows: bundleRegistry.rows,
        blockers: source.blockers,
    });
    const disposition = buildTurneroReleaseRepoDiagnosisDispositionEngine({
        matrixSummary: matrix.summary,
        signoffs: storedSignoffs,
        bundleSummary: bundleRegistry.summary,
    });
    const binderScore = buildTurneroReleaseFinalAuditBinderScore({
        matrixSummary: matrix.summary,
        disposition,
        signoffs: storedSignoffs,
    });
    const binderReport = buildTurneroReleaseFinalAuditBinder({
        context: {
            scope: source.scope,
            region: source.region,
            clinicId: source.clinicId,
            clinicLabel: source.clinicLabel,
            clinicShortName: source.clinicShortName,
            detectedPlatform: source.detectedPlatform,
        },
        manifest,
        bundleRegistry,
        matrix,
        disposition,
        signoffs: storedSignoffs,
        binderScore,
        generatedAt: source.generatedAt,
    });
    const summary = {
        score: binderScore.score,
        band: binderScore.band,
        decision: binderScore.decision,
        disposition: disposition.disposition,
        bundlesReady: bundleRegistry.summary.ready,
        bundlesAll: bundleRegistry.summary.all,
        supported: matrix.summary.supported,
        partial: matrix.summary.partial,
        blocked: matrix.summary.blocked,
        missing: matrix.summary.missing,
        approvals: countVerdicts(storedSignoffs, 'approve'),
        reviews: countVerdicts(storedSignoffs, 'review'),
        rejects: countVerdicts(storedSignoffs, 'reject'),
    };
    const context = {
        scope: source.scope,
        region: source.region,
        clinicId: source.clinicId,
        clinicLabel: source.clinicLabel,
        clinicShortName: source.clinicShortName,
        detectedPlatform: source.detectedPlatform,
        generatedAt: source.generatedAt,
        downloadFileName: source.downloadFileName,
        sources: source.sources,
    };
    const snapshot = {
        context,
        manifest,
        bundleRegistry,
        signoffs: storedSignoffs,
        matrix,
        disposition,
        binderScore,
        binderReport,
        summary,
        generatedAt: source.generatedAt,
        downloadFileName: source.downloadFileName,
        briefMarkdown: binderReport.markdown,
    };

    return {
        context,
        manifest,
        bundleRegistry,
        signoffs: storedSignoffs,
        matrix,
        disposition,
        binderScore,
        binderReport,
        summary,
        generatedAt: source.generatedAt,
        downloadFileName: source.downloadFileName,
        briefMarkdown: binderReport.markdown,
        snapshot,
    };
}

function escapeHtml(value) {
    return toText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toneFromBand(band) {
    if (band === 'ready') {
        return 'ready';
    }

    if (band === 'near-ready' || band === 'review') {
        return 'warning';
    }

    return 'alert';
}

function renderMetricCard(label, value, detail, tone = 'ready', role = '') {
    return `
        <article class="turnero-release-final-diagnosis-adjudication-binder__metric" data-state="${escapeHtml(
            tone
        )}"${role ? ` data-role="${escapeHtml(role)}"` : ''}>
            <strong>${escapeHtml(label)}</strong>
            <span class="turnero-release-final-diagnosis-adjudication-binder__metric-value">${escapeHtml(
                value
            )}</span>
            <small>${escapeHtml(detail)}</small>
        </article>
    `;
}

function renderRowList(title, rows = [], options = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const emptyLabel = toText(options.emptyLabel, 'Sin registros');
    const limit = Number.isFinite(Number(options.limit))
        ? Number(options.limit)
        : list.length;
    const tone =
        typeof options.tone === 'function'
            ? options.tone
            : (row) => toText(row.state || row.status || 'ready', 'ready');
    const formatter =
        typeof options.formatter === 'function'
            ? options.formatter
            : (row) => toText(row.label || row.key || row.id, 'Item');
    const detailer =
        typeof options.detailer === 'function'
            ? options.detailer
            : (row) =>
                  toText(
                      row.detail ||
                          row.note ||
                          row.bundleStatus ||
                          row.state ||
                          row.status,
                      ''
                  );

    return `
        <section class="turnero-release-final-diagnosis-adjudication-binder__list-card">
            <h4>${escapeHtml(title)}</h4>
            ${
                list.length > 0
                    ? `<ul>${list
                          .slice(0, limit)
                          .map((row, index) => {
                              const detail = detailer(row, index);
                              return `
                                  <li data-state="${escapeHtml(tone(row, index))}">
                                      <strong>${escapeHtml(formatter(row, index))}</strong>
                                      <span>${escapeHtml(detail || ' ')}</span>
                                  </li>
                              `;
                          })
                          .join('')}</ul>`
                    : `<p class="turnero-release-final-diagnosis-adjudication-binder__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

function renderTurneroReleaseFinalDiagnosisAdjudicationBinderHtml(pack) {
    const bandTone = toneFromBand(pack.binderScore.band);

    return `
        <article class="turnero-release-final-diagnosis-adjudication-binder__card" data-state="${escapeHtml(
            bandTone
        )}" data-band="${escapeHtml(pack.binderScore.band)}" data-decision="${escapeHtml(
            pack.binderScore.decision
        )}">
            <header class="turnero-release-final-diagnosis-adjudication-binder__header">
                <div>
                    <p class="queue-app-card__eyebrow">Deployment band</p>
                    <h3>Final Diagnosis Adjudication Binder</h3>
                    <p>
                        Binder final de adjudicación antes del workspace honesto
                        y de la consola final.
                    </p>
                </div>
                <div class="turnero-release-final-diagnosis-adjudication-binder__actions">
                    <button type="button" data-action="copy-binder-brief">Copy binder brief</button>
                    <button type="button" data-action="download-binder-pack">Download binder JSON</button>
                </div>
            </header>
            <div class="turnero-release-final-diagnosis-adjudication-binder__metrics">
                ${renderMetricCard(
                    'Score',
                    String(pack.binderScore.score),
                    pack.binderScore.band,
                    bandTone,
                    'binder-score'
                )}
                ${renderMetricCard(
                    'Decision',
                    pack.binderScore.decision,
                    'Final binder gate',
                    bandTone,
                    'binder-decision'
                )}
                ${renderMetricCard(
                    'Disposition',
                    pack.disposition.disposition,
                    `${pack.disposition.approvals} approvals`,
                    toneFromBand(pack.summary.band || pack.binderScore.band),
                    'binder-disposition'
                )}
                ${renderMetricCard(
                    'Bundles',
                    `${pack.bundleRegistry.summary.ready}/${pack.bundleRegistry.summary.all}`,
                    'ready bundles',
                    pack.bundleRegistry.summary.ready ===
                        pack.bundleRegistry.summary.all
                        ? 'ready'
                        : 'warning',
                    'bundle-ready'
                )}
                ${renderMetricCard(
                    'Matrix',
                    `${pack.matrix.summary.supported}/${pack.matrix.summary.all}`,
                    `${pack.matrix.summary.partial} partial · ${pack.matrix.summary.blocked} blocked`,
                    pack.matrix.summary.blocked > 0 ? 'alert' : 'ready',
                    'matrix-supported'
                )}
                ${renderMetricCard(
                    'Signoffs',
                    String(pack.signoffs.length),
                    `${pack.summary.approvals} approve · ${pack.summary.rejects} reject`,
                    pack.summary.rejects > 0 ? 'alert' : 'ready',
                    'signoff-count'
                )}
            </div>
            <div class="turnero-release-final-diagnosis-adjudication-binder__body">
                ${renderRowList('Evidence bundles', pack.bundleRegistry.rows, {
                    limit: 4,
                    emptyLabel: 'No evidence bundles',
                    tone: (row) => row.status || 'ready',
                    detailer: (row) =>
                        `${row.owner || 'program'} · ${row.artifactCount} artifacts`,
                })}
                ${renderRowList('Adjudication matrix', pack.matrix.rows, {
                    limit: 6,
                    emptyLabel: 'No adjudication rows',
                    tone: (row) => row.state || 'ready',
                    detailer: (row) =>
                        `${row.bundleLabel || row.bundleKey || 'bundle'} · ${
                            row.blockerCount > 0
                                ? `${row.blockerCount} blocker(s)`
                                : row.bundleStatus
                        }`,
                })}
                ${renderRowList('Review panel signoffs', pack.signoffs, {
                    limit: 6,
                    emptyLabel: 'No review panel signoffs',
                    tone: (row) => row.verdict || 'review',
                    formatter: (row) => row.reviewer || 'Reviewer',
                    detailer: (row) =>
                        `${row.verdict}${row.note ? ` · ${row.note}` : ''}`,
                })}
            </div>
            <div class="turnero-release-final-diagnosis-adjudication-binder__signoff-form">
                <label>
                    Reviewer
                    <input data-field="signoff-reviewer" type="text" placeholder="Reviewer" />
                </label>
                <label>
                    Verdict
                    <input data-field="signoff-verdict" type="text" placeholder="approve / review / reject" />
                </label>
                <label>
                    Note
                    <input data-field="signoff-note" type="text" placeholder="Review note" />
                </label>
                <button type="button" data-action="add-panel-signoff">Add signoff</button>
            </div>
            <pre class="turnero-release-final-diagnosis-adjudication-binder__brief" data-role="binder-brief">${escapeHtml(
                pack.briefMarkdown
            )}</pre>
        </article>
    `;
}

function syncRootState(root, pack) {
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinder = 'mounted';
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinderBand =
        pack.binderScore.band;
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinderDecision =
        pack.binderScore.decision;
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinderDisposition =
        pack.disposition.disposition;
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinderScore = String(
        pack.binderScore.score
    );
    root.dataset.turneroReleaseFinalDiagnosisAdjudicationBinderClinicId =
        pack.context.clinicId || '';
}

export function buildTurneroReleaseFinalDiagnosisAdjudicationBinderPack(
    input = {}
) {
    return buildPackFromSource(normalizeSourceInput(input));
}

export function mountTurneroReleaseFinalDiagnosisAdjudicationBinder(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const source = normalizeSourceInput(input);
    const pack = buildPackFromSource(source);
    const root = document.createElement('section');
    root.id = 'turneroReleaseFinalDiagnosisAdjudicationBinder';
    root.className = 'turnero-release-final-diagnosis-adjudication-binder';
    root.innerHTML =
        renderTurneroReleaseFinalDiagnosisAdjudicationBinderHtml(pack);
    syncRootState(root, pack);

    if (typeof host.replaceChildren === 'function') {
        host.replaceChildren(root);
    } else {
        host.innerHTML = '';
        host.appendChild(root);
    }

    syncRootState(host, pack);

    const signoffStore = createTurneroReleaseReviewPanelSignoffStore(
        pack.context.scope || DEFAULT_SCOPE,
        pack.signoffs
    );

    const refresh = () => {
        const nextPack = buildPackFromSource(source, signoffStore.list());
        Object.assign(pack, nextPack);
        root.innerHTML =
            renderTurneroReleaseFinalDiagnosisAdjudicationBinderHtml(pack);
        syncRootState(root, pack);
        syncRootState(host, pack);
        root.__turneroReleaseFinalDiagnosisAdjudicationBinderPack = pack;
        return pack;
    };

    const handleClick = async (event) => {
        const actionTarget =
            event.target?.closest?.('[data-action]') || event.target;
        const action = actionTarget?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-binder-brief') {
            await copyToClipboardSafe(pack.briefMarkdown);
            return;
        }

        if (action === 'download-binder-pack') {
            downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
            return;
        }

        if (action === 'add-panel-signoff') {
            const reviewer =
                root.querySelector('[data-field="signoff-reviewer"]')?.value ||
                '';
            const verdict =
                root.querySelector('[data-field="signoff-verdict"]')?.value ||
                '';
            const note =
                root.querySelector('[data-field="signoff-note"]')?.value || '';

            if (!toText(reviewer, '')) {
                return;
            }

            signoffStore.add({
                reviewer,
                verdict,
                note,
            });
            refresh();
        }
    };

    if (host.__turneroReleaseFinalDiagnosisAdjudicationBinderClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseFinalDiagnosisAdjudicationBinderClickHandler
        );
    }

    host.__turneroReleaseFinalDiagnosisAdjudicationBinderClickHandler =
        handleClick;
    host.addEventListener('click', handleClick);

    root.__turneroReleaseFinalDiagnosisAdjudicationBinderPack = pack;

    return {
        root,
        pack,
        recompute: refresh,
    };
}

export function wireTurneroReleaseFinalDiagnosisAdjudicationBinder({
    mountNode,
    ...input
} = {}) {
    return mountTurneroReleaseFinalDiagnosisAdjudicationBinder(
        mountNode || input.target || null,
        input
    );
}

export function renderTurneroReleaseFinalDiagnosisAdjudicationBinder(
    input = {}
) {
    return wireTurneroReleaseFinalDiagnosisAdjudicationBinder(input);
}

export default mountTurneroReleaseFinalDiagnosisAdjudicationBinder;
