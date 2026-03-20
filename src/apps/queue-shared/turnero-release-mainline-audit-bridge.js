import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseMainlineAuditManifest } from './turnero-release-mainline-audit-manifest.js';
import { buildTurneroReleaseCommitEvidenceReconciler } from './turnero-release-commit-evidence-reconciler.js';
import {
    DEFAULT_MAINLINE_SURFACES,
    buildTurneroReleaseSurfaceMountAudit,
} from './turnero-release-surface-mount-audit.js';
import { createTurneroReleaseBranchDeltaLedger } from './turnero-release-branch-delta-ledger.js';
import { buildTurneroReleaseRuntimeVsSourceDiff } from './turnero-release-runtime-vs-source-diff.js';
import { buildTurneroReleaseDiagnosticBlockerBoard } from './turnero-release-diagnostic-blocker-board.js';
import { buildTurneroReleaseMainlineAuditScore } from './turnero-release-mainline-audit-score.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

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

function resolveScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.scope ||
            input.region ||
            currentSnapshot.scope ||
            currentSnapshot.region ||
            clinicProfile.region ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            'global',
        'global'
    );
}

function resolveClinicId(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
}

function resolveClinicLabel(
    input = {},
    currentSnapshot = {},
    clinicProfile = {}
) {
    return toText(
        input.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            resolveClinicId(input, currentSnapshot, clinicProfile) ||
            resolveScope(input, currentSnapshot, clinicProfile),
        resolveScope(input, currentSnapshot, clinicProfile)
    );
}

function resolveClinicShortName(
    input = {},
    currentSnapshot = {},
    clinicProfile = {}
) {
    return toText(
        input.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            resolveClinicLabel(input, currentSnapshot, clinicProfile),
        resolveClinicLabel(input, currentSnapshot, clinicProfile)
    );
}

function resolveArrayProperty(sources, keys) {
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }

        for (const key of keys) {
            if (
                Object.prototype.hasOwnProperty.call(source, key) &&
                Array.isArray(source[key])
            ) {
                return source[key];
            }
        }
    }

    return null;
}

function normalizeActualRows(rows, manifestRows = []) {
    return toArray(rows).map((entry, index) => {
        const item = asObject(entry);
        const manifestRow = asObject(manifestRows[index] || {});
        const key = toText(
            item.key || item.moduleKey || item.id || manifestRow.key,
            `actual-${index + 1}`
        );

        return {
            id: toText(item.id, key),
            key,
            label: toText(
                item.label || manifestRow.label,
                `Actual ${index + 1}`
            ),
            owner: toText(item.owner || manifestRow.owner || 'ops'),
            surface: toText(
                item.surface || manifestRow.surface || 'admin-queue'
            ),
            mounted: item.mounted !== false,
            commitRef: toText(
                item.commitRef ||
                    item.commit ||
                    item.sha ||
                    item.hash ||
                    item.fingerprint ||
                    item.evidenceRef ||
                    ''
            ),
            status: toText(item.status || item.state || 'mounted'),
            note: toText(item.note || ''),
            createdAt: toText(
                item.createdAt || item.at || new Date().toISOString()
            ),
            updatedAt: toText(
                item.updatedAt ||
                    item.createdAt ||
                    item.at ||
                    new Date().toISOString()
            ),
        };
    });
}

function buildDefaultActualRows(manifestRows = []) {
    return toArray(manifestRows).map((row, index) => {
        const item = asObject(row);
        const key = toText(item.key || item.id, `mainline-item-${index + 1}`);

        return {
            id: toText(item.id, key),
            key,
            label: toText(item.label, `Mainline item ${index + 1}`),
            owner: toText(item.owner, 'ops'),
            surface: toText(item.surface, 'admin-queue'),
            mounted: true,
            commitRef: '',
            status: 'mounted',
            note: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    });
}

function normalizeRuntimeRows(rows, manifestRows = []) {
    return toArray(rows).map((entry, index) => {
        const item = asObject(entry);
        const manifestRow = asObject(manifestRows[index] || {});
        const key = toText(
            item.key || item.moduleKey || item.id || manifestRow.key,
            `runtime-${index + 1}`
        );

        return {
            id: toText(item.id, key),
            key,
            label: toText(
                item.label || manifestRow.label,
                `Runtime ${index + 1}`
            ),
            surface: toText(
                item.surface || item.surfaceId || manifestRow.surface,
                'admin-queue'
            ),
            present: item.present !== false && item.mounted !== false,
            fingerprint: toText(
                item.fingerprint ||
                    item.commitRef ||
                    item.digest ||
                    item.sha ||
                    item.hash ||
                    item.version ||
                    ''
            ),
            state: toText(item.state || item.status || 'present'),
        };
    });
}

function buildDefaultRuntimeRows(manifestRows = []) {
    return toArray(manifestRows).map((row, index) => {
        const item = asObject(row);
        const key = toText(item.key || item.id, `mainline-item-${index + 1}`);

        return {
            id: toText(item.id, key),
            key,
            label: toText(item.label, `Mainline item ${index + 1}`),
            surface: toText(item.surface, 'admin-queue'),
            present: true,
            fingerprint: `runtime-${key}`,
            state: 'present',
        };
    });
}

function normalizeBranchDeltaRows(rows) {
    return toArray(rows).map((entry, index) => {
        const item = asObject(entry);
        const createdAt =
            toText(item.createdAt || item.at || '', '') ||
            new Date().toISOString();

        return {
            id:
                toText(item.id || item.key || '', '') ||
                `delta-${Date.now()}-${index + 1}`,
            title: toText(item.title || item.label || 'Branch delta'),
            owner: toText(item.owner || 'program'),
            area: toText(item.area || item.domain || 'general'),
            severity: toText(item.severity || 'medium').toLowerCase(),
            status: toText(
                item.status ||
                    item.state ||
                    (item.closed === true ? 'closed' : 'open'),
                'open'
            ).toLowerCase(),
            note: toText(item.note || ''),
            createdAt,
            updatedAt: toText(item.updatedAt || createdAt, createdAt),
        };
    });
}

function formatOpenDeltaCount(branchDelta) {
    return toArray(branchDelta).filter((entry) => {
        const status = toText(entry.status || entry.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;
}

function mergeBranchDeltaRows(baseRows = [], liveRows = []) {
    const merged = toArray(liveRows).map(asObject);
    const seen = new Set(
        merged.map((entry) => toText(entry.id || entry.key || ''))
    );

    for (const entry of toArray(baseRows).map(asObject)) {
        const key = toText(entry.id || entry.key || '');
        if (!key || seen.has(key)) {
            continue;
        }

        merged.push(entry);
        seen.add(key);
    }

    return merged;
}

function renderMetricCard(label, value, detail = '', tone = 'info') {
    return `
        <article class="turnero-release-mainline-audit-bridge__metric" data-tone="${escapeHtml(
            tone
        )}">
            <p>${escapeHtml(label)}</p>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderRowListItem(entry, detail) {
    return `
        <li class="turnero-release-mainline-audit-bridge__list-item">
            <strong>${escapeHtml(entry)}</strong>
            <span>${escapeHtml(detail)}</span>
        </li>
    `;
}

function renderPreviewList(title, rows, emptyLabel, renderer) {
    const list = toArray(rows);
    return `
        <section class="turnero-release-mainline-audit-bridge__preview">
            <h4>${escapeHtml(title)}</h4>
            ${
                list.length > 0
                    ? `<ul>${list.map((row, index) => renderer(row, index)).join('')}</ul>`
                    : `<p class="turnero-release-mainline-audit-bridge__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

export function mainlineBriefToMarkdown(pack = {}) {
    const summary = asObject(pack.summary || {});
    const lines = [
        '# Mainline Audit Bridge',
        '',
        `Scope: ${summary.scope || pack.scope || 'global'}`,
        `Clinic: ${summary.clinicLabel || pack.clinicLabel || 'n/a'}`,
        `Audit score: ${pack.auditScore?.score ?? 0} (${pack.auditScore?.band || 'n/a'})`,
        `Decision: ${pack.auditScore?.decision || 'review'}`,
        '',
        `Manifest rows: ${pack.manifest?.summary?.all ?? 0}`,
        `Reconciled rows: ${pack.reconciled?.summary?.reconciled ?? 0}/${pack.reconciled?.summary?.all ?? 0}`,
        `Mounted without evidence: ${pack.reconciled?.summary?.mountedNoEvidence ?? 0}`,
        `Evidence without mount: ${pack.reconciled?.summary?.evidenceNoMount ?? 0}`,
        `Runtime drift: ${pack.runtimeDiff?.summary?.drift ?? 0}`,
        `Open branch deltas: ${summary.openBranchDeltas ?? 0}`,
        `Blockers: ${pack.blockerBoard?.summary?.all ?? 0}`,
    ];

    return lines.join('\n');
}

export function renderTurneroReleaseMainlineAuditBridgeHtml(pack = {}) {
    const manifestRows = toArray(pack.manifest?.rows);
    const reconciledRows = toArray(pack.reconciled?.rows);
    const runtimeRows = toArray(pack.runtimeDiff?.rows);
    const blockers = toArray(pack.blockerBoard?.rows);
    const branchDelta = toArray(pack.branchDelta);
    const updatedAt = formatDateTime(
        pack.generatedAt || new Date().toISOString()
    );

    return `
        <article class="turnero-release-mainline-audit-bridge__card">
            <header class="turnero-release-mainline-audit-bridge__header">
                <p class="sony-kicker">Repo prep</p>
                <h3>Mainline Audit Bridge</h3>
                <p>
                    Puente de auditoría para contrastar evidencia, montaje real
                    y drift antes del diagnóstico final.
                </p>
                <p class="turnero-release-mainline-audit-bridge__meta">
                    ${escapeHtml(pack.clinicLabel || pack.clinicShortName || pack.scope || 'global')}
                    · ${escapeHtml(updatedAt)}
                </p>
            </header>

            <div class="turnero-release-mainline-audit-bridge__metrics">
                ${renderMetricCard(
                    'Audit score',
                    String(pack.auditScore?.score ?? 0),
                    pack.auditScore?.band || 'n/a',
                    pack.auditScore?.band || 'watch'
                )}
                ${renderMetricCard(
                    'Decision',
                    pack.auditScore?.decision || 'review',
                    'Mainline gate'
                )}
                ${renderMetricCard(
                    'Runtime drift',
                    String(pack.runtimeDiff?.summary?.drift ?? 0),
                    `${pack.runtimeDiff?.summary?.aligned ?? 0} aligned`,
                    pack.runtimeDiff?.summary?.drift > 0 ? 'alert' : 'ready'
                )}
                ${renderMetricCard(
                    'Open deltas',
                    String(formatOpenDeltaCount(branchDelta)),
                    'Local ledger',
                    formatOpenDeltaCount(branchDelta) > 0 ? 'warning' : 'ready'
                )}
            </div>

            <div class="turnero-release-mainline-audit-bridge__actions">
                <button type="button" data-action="copy-mainline-brief">
                    Copy mainline brief
                </button>
                <button type="button" data-action="download-mainline-json">
                    Download mainline JSON
                </button>
            </div>

            <div class="turnero-release-mainline-audit-bridge__delta-form">
                <div class="turnero-release-mainline-audit-bridge__delta-copy">
                    <h4>Add branch delta</h4>
                    <p>
                        Registra la brecha real que falta cerrar antes del
                        diagnóstico final.
                    </p>
                </div>
                <input data-field="delta-title" placeholder="Delta title" />
                <input data-field="delta-owner" placeholder="Owner" />
                <input data-field="delta-area" placeholder="Area" />
                <button type="button" data-action="add-branch-delta">
                    Add branch delta
                </button>
            </div>

            <div class="turnero-release-mainline-audit-bridge__panels">
                ${renderPreviewList(
                    'Manifest',
                    manifestRows,
                    'Sin manifest rows',
                    (row) =>
                        renderRowListItem(
                            row.key || row.id,
                            `${row.label} · ${row.surface} · ${row.criticality}`
                        )
                )}
                ${renderPreviewList(
                    'Reconciled evidence',
                    reconciledRows,
                    'Sin reconciliación',
                    (row) =>
                        renderRowListItem(
                            row.key || row.id,
                            `${row.state} · ${row.surface}${row.commitRef ? ` · ${row.commitRef}` : ''}`
                        )
                )}
                ${renderPreviewList(
                    'Runtime diff',
                    runtimeRows,
                    'Sin runtime rows',
                    (row) =>
                        renderRowListItem(
                            row.key || row.id,
                            `${row.state} · ${row.surface}${row.fingerprint ? ` · ${row.fingerprint}` : ''}`
                        )
                )}
                ${renderPreviewList(
                    'Blockers',
                    blockers,
                    'Sin blockers',
                    (row) =>
                        renderRowListItem(
                            row.kind,
                            `${row.severity} · ${row.count} · ${row.owner}`
                        )
                )}
            </div>

            <section class="turnero-release-mainline-audit-bridge__branch-delta">
                <h4>Branch delta ledger</h4>
                <p data-role="open-delta-count">${escapeHtml(
                    String(formatOpenDeltaCount(branchDelta))
                )} open</p>
                ${
                    branchDelta.length > 0
                        ? `<ul data-role="branch-delta-list">${branchDelta
                              .map((entry) =>
                                  renderRowListItem(
                                      entry.title,
                                      `${entry.owner} · ${entry.area} · ${entry.status}`
                                  )
                              )
                              .join('')}</ul>`
                        : '<p class="turnero-release-mainline-audit-bridge__empty" data-role="branch-delta-list">No branch deltas yet</p>'
                }
            </section>

            <pre class="turnero-release-mainline-audit-bridge__brief" data-role="mainline-brief">${escapeHtml(
                pack.briefMarkdown || mainlineBriefToMarkdown(pack)
            )}</pre>
        </article>
    `;
}

export function buildTurneroReleaseMainlineAuditBridgePack(
    input = {},
    branchDeltaStore = null
) {
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
    const scope = resolveScope(input, currentSnapshot, clinicProfile);
    const clinicId = resolveClinicId(input, currentSnapshot, clinicProfile);
    const clinicLabel = resolveClinicLabel(
        input,
        currentSnapshot,
        clinicProfile
    );
    const clinicShortName = resolveClinicShortName(
        input,
        currentSnapshot,
        clinicProfile
    );
    const sourceManifest = asObject(input.sourceManifest || {});
    const manifestRowsSource = resolveArrayProperty(
        [input, currentSnapshot, sourceManifest],
        ['manifestRows', 'rows', 'items']
    );
    const manifest = buildTurneroReleaseMainlineAuditManifest({
        items: manifestRowsSource !== null ? manifestRowsSource : undefined,
    });
    const actualRowsSource = resolveArrayProperty(
        [input, currentSnapshot],
        ['actualRows', 'actual', 'commitRows', 'evidenceRows']
    );
    const runtimeRowsSource = resolveArrayProperty(
        [input, currentSnapshot],
        ['runtimeRows', 'surfaceRows', 'runtimeSurfaceRows']
    );
    const provenanceSource = resolveArrayProperty(
        [input, currentSnapshot],
        [
            'provenance',
            'commitEvidence',
            'commitProvenance',
            'evidenceProvenance',
        ]
    );
    const surfacesSource = resolveArrayProperty(
        [input, currentSnapshot, clinicProfile],
        ['surfaces', 'surfaceRows', 'runtimeSurfaces']
    );
    const branchDeltaSource = resolveArrayProperty(
        [input, currentSnapshot],
        ['branchDelta', 'branchDeltas', 'deltaRows']
    );
    const branchDeltaBase =
        branchDeltaSource !== null
            ? normalizeBranchDeltaRows(branchDeltaSource)
            : [];
    const liveBranchDeltaRows = branchDeltaStore
        ? branchDeltaStore.list()
        : null;
    const branchDelta =
        liveBranchDeltaRows !== null && liveBranchDeltaRows.length > 0
            ? mergeBranchDeltaRows(branchDeltaBase, liveBranchDeltaRows)
            : branchDeltaBase;
    const actualRows =
        actualRowsSource !== null
            ? normalizeActualRows(actualRowsSource, manifest.rows)
            : buildDefaultActualRows(manifest.rows);
    const runtimeRows =
        runtimeRowsSource !== null
            ? normalizeRuntimeRows(runtimeRowsSource, manifest.rows)
            : buildDefaultRuntimeRows(manifest.rows);
    const reconciled = buildTurneroReleaseCommitEvidenceReconciler({
        manifestRows: manifest.rows,
        actualRows,
        provenance:
            provenanceSource !== null
                ? toArray(provenanceSource).map(asObject)
                : [],
    });
    const mountAudit = buildTurneroReleaseSurfaceMountAudit({
        surfaces:
            surfacesSource !== null
                ? toArray(surfacesSource).map(asObject)
                : DEFAULT_MAINLINE_SURFACES,
        reconciledRows: reconciled.rows,
    });
    const runtimeDiff = buildTurneroReleaseRuntimeVsSourceDiff({
        manifestRows: manifest.rows,
        reconciledRows: reconciled.rows,
        runtimeRows,
    });
    const blockerBoard = buildTurneroReleaseDiagnosticBlockerBoard({
        reconciledSummary: reconciled.summary,
        runtimeDiffSummary: runtimeDiff.summary,
        branchDelta,
    });
    const auditScore = buildTurneroReleaseMainlineAuditScore({
        reconciledSummary: reconciled.summary,
        mountSummary: mountAudit.summary,
        runtimeDiffSummary: runtimeDiff.summary,
        blockerSummary: blockerBoard.summary,
    });
    const openBranchDeltas = formatOpenDeltaCount(branchDelta);
    const generatedAt = new Date().toISOString();
    const summary = {
        scope,
        region: toText(
            input.region ||
                currentSnapshot.region ||
                clinicProfile.region ||
                scope,
            scope
        ),
        clinicId,
        clinicLabel,
        clinicShortName,
        manifestRows: manifest.summary.all,
        reconciled: reconciled.summary.reconciled,
        mountedNoEvidence: reconciled.summary.mountedNoEvidence,
        evidenceNoMount: reconciled.summary.evidenceNoMount,
        missing: reconciled.summary.missing,
        runtimeAligned: runtimeDiff.summary.aligned,
        runtimeDrift: runtimeDiff.summary.drift,
        openBranchDeltas,
        blockers: blockerBoard.summary.all,
        score: auditScore.score,
        band: auditScore.band,
        decision: auditScore.decision,
    };
    const snapshot = {
        generatedAt,
        sourceManifest,
        currentSnapshot,
        clinicProfile,
        scope,
        region: summary.region,
        clinicId,
        clinicLabel,
        clinicShortName,
        manifest,
        reconciled,
        mountAudit,
        branchDelta,
        runtimeDiff,
        blockerBoard,
        auditScore,
        summary,
    };
    const briefMarkdown = mainlineBriefToMarkdown({
        ...snapshot,
        briefMarkdown: '',
    });

    return {
        ...snapshot,
        briefMarkdown,
        clipboardSummary: briefMarkdown,
        downloadFileName: 'turnero-release-mainline-audit-pack.json',
        snapshotFileName: 'turnero-release-mainline-audit-pack.json',
        snapshot: {
            ...snapshot,
            briefMarkdown,
            clipboardSummary: briefMarkdown,
            downloadFileName: 'turnero-release-mainline-audit-pack.json',
        },
    };
}

export function mountTurneroReleaseMainlineAuditBridge(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

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
    const branchDeltaStore = createTurneroReleaseBranchDeltaLedger(
        resolveScope(input, currentSnapshot, clinicProfile)
    );
    let pack = buildTurneroReleaseMainlineAuditBridgePack(
        input,
        branchDeltaStore
    );
    let root = null;

    const result = {
        root: null,
        pack,
        recompute: () => {},
    };

    const render = () => {
        pack = buildTurneroReleaseMainlineAuditBridgePack(
            input,
            branchDeltaStore
        );
        result.pack = pack;

        if (!root) {
            root = document.createElement('section');
            root.id = 'turneroReleaseMainlineAuditBridge';
            root.className = 'turnero-release-mainline-audit-bridge';
            root.dataset.turneroReleaseMainlineAuditBridge = 'mounted';
            root.addEventListener('click', async (event) => {
                const actionElement =
                    event.target?.closest?.('[data-action]') || event.target;
                const action = actionElement?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'copy-mainline-brief') {
                    await copyToClipboardSafe(pack.briefMarkdown);
                    return;
                }

                if (action === 'download-mainline-json') {
                    downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-branch-delta') {
                    const title =
                        root.querySelector('[data-field="delta-title"]')
                            ?.value || '';
                    const owner =
                        root.querySelector('[data-field="delta-owner"]')
                            ?.value || '';
                    const area =
                        root.querySelector('[data-field="delta-area"]')
                            ?.value || '';

                    if (!title.trim()) {
                        return;
                    }

                    branchDeltaStore.add({
                        title,
                        owner: owner || 'program',
                        area: area || 'mainline-audit',
                        severity: 'medium',
                        status: 'open',
                    });
                    render();
                }
            });
        }

        root.innerHTML = renderTurneroReleaseMainlineAuditBridgeHtml(pack);
        root.dataset.turneroReleaseMainlineAuditScore = String(
            pack.auditScore.score
        );
        root.dataset.turneroReleaseMainlineAuditBand = pack.auditScore.band;
        root.dataset.turneroReleaseMainlineAuditDecision =
            pack.auditScore.decision;
        root.dataset.turneroReleaseMainlineAuditScope = pack.scope;
        root.dataset.turneroReleaseMainlineAuditOpenDeltas = String(
            pack.summary.openBranchDeltas
        );
        root.dataset.turneroReleaseMainlineAuditGeneratedAt = pack.generatedAt;

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(root);
        } else {
            host.innerHTML = '';
            host.appendChild(root);
        }

        host.dataset.turneroReleaseMainlineAuditBridge = 'mounted';
        host.dataset.turneroReleaseMainlineAuditScore = String(
            pack.auditScore.score
        );
        host.dataset.turneroReleaseMainlineAuditBand = pack.auditScore.band;
        host.dataset.turneroReleaseMainlineAuditDecision =
            pack.auditScore.decision;
        host.dataset.turneroReleaseMainlineAuditScope = pack.scope;

        result.root = root;
        return result;
    };

    result.recompute = render;

    return render();
}

export function renderTurneroReleaseMainlineAuditBridge(target, input = {}) {
    return mountTurneroReleaseMainlineAuditBridge(target, input);
}

export default mountTurneroReleaseMainlineAuditBridge;
