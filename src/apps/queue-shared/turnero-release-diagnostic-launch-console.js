import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseFinalDiagnosisLaunchManifest } from './turnero-release-final-diagnosis-launch-manifest.js';
import { createTurneroReleaseDiagnosticEvidenceLock } from './turnero-release-diagnostic-evidence-lock.js';
import { buildTurneroReleaseVerdictFreezeBoard } from './turnero-release-verdict-freeze-board.js';
import { createTurneroReleaseOwnerSignoffRegistry } from './turnero-release-owner-signoff-registry.js';
import { buildTurneroReleaseFinalReadoutEngine } from './turnero-release-final-readout-engine.js';
import { buildTurneroReleaseDiagnosticLaunchGate } from './turnero-release-diagnostic-launch-gate.js';
import { buildTurneroReleaseFinalRepoReadout } from './turnero-release-final-repo-readout-builder.js';

const DEFAULT_DOWNLOAD_FILE_NAME = 'turnero-release-final-launch-pack.json';
const VALID_SIGNOFF_VERDICTS = new Set(['approve', 'review', 'reject']);

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

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

function normalizeScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    const scope = toText(
        input.scope ||
            input.region ||
            clinicProfile.region ||
            currentSnapshot.scope ||
            currentSnapshot.region ||
            'global',
        'global'
    );
    const region = toText(
        input.region ||
            clinicProfile.region ||
            currentSnapshot.region ||
            scope ||
            'regional',
        'regional'
    );

    return { scope, region };
}

function normalizeVerdict(value, fallback = 'review') {
    const verdict = toText(value, fallback).toLowerCase();
    return VALID_SIGNOFF_VERDICTS.has(verdict) ? verdict : fallback;
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

function renderListItem(row, label, detail, tone = 'info') {
    return `
        <li data-state="${escapeHtml(tone)}">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(detail)}</span>
        </li>
    `;
}

function renderPanel(title, count, rows, options = {}) {
    const limit = Number(options.limit || 4);
    const items = toArray(rows).slice(0, limit);
    const emptyLabel = toText(options.emptyLabel || 'Sin elementos');
    const formatter =
        typeof options.formatter === 'function'
            ? options.formatter
            : (row) => toText(row.label || row.kind || row.key || row.id);
    const detailer =
        typeof options.detail === 'function' ? options.detail : () => '';
    const itemTone =
        typeof options.itemTone === 'function'
            ? options.itemTone
            : () => toText(options.tone || 'ready');

    return `
        <section class="queue-app-card__panel">
            <header class="queue-app-card__panel-head">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(count))}</strong>
            </header>
            <ul class="queue-app-card__list">
                ${
                    items.length > 0
                        ? items
                              .map((row) =>
                                  renderListItem(
                                      row,
                                      formatter(row),
                                      detailer(row),
                                      itemTone(row)
                                  )
                              )
                              .join('')
                        : `<li data-state="ready">${escapeHtml(emptyLabel)}</li>`
                }
            </ul>
        </section>
    `;
}

function buildTurneroReleaseDiagnosticLaunchConsolePack(
    input = {},
    state = {}
) {
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            input.snapshot ||
            input.releaseEvidenceBundle ||
            {}
    );
    const releaseEvidenceBundle = asObject(
        input.releaseEvidenceBundle ||
            currentSnapshot.releaseEvidenceBundle ||
            currentSnapshot.parts?.releaseEvidenceBundle ||
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
    const { scope, region } = normalizeScope(
        input,
        currentSnapshot,
        clinicProfile
    );
    const clinicId = toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            releaseEvidenceBundle.clinicId ||
            scope,
        scope
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
    const blockers = pickArray(
        input.blockers,
        releaseEvidenceBundle.blockers,
        currentSnapshot.blockers,
        currentSnapshot.gaps,
        releaseEvidenceBundle.gaps
    ).map((blocker) => ({ ...asObject(blocker) }));
    const manifestItems = pickArray(
        input.items,
        input.manifestRows,
        currentSnapshot.manifestRows,
        releaseEvidenceBundle.manifestRows
    );
    const manifest = buildTurneroReleaseFinalDiagnosisLaunchManifest({
        items: manifestItems.length > 0 ? manifestItems : undefined,
    });
    const lockStore =
        state.lockStore || createTurneroReleaseDiagnosticEvidenceLock(scope);
    const signoffStore =
        state.signoffStore || createTurneroReleaseOwnerSignoffRegistry(scope);
    const lock =
        state.lock !== undefined && state.lock !== null
            ? state.lock
            : lockStore.get();
    const signoffs = Array.isArray(state.signoffs)
        ? state.signoffs
        : signoffStore.list();
    const freezeBoard = buildTurneroReleaseVerdictFreezeBoard({ blockers });
    const readout = buildTurneroReleaseFinalReadoutEngine({
        manifestSummary: manifest.summary,
        lock,
        freezeSummary: freezeBoard.summary,
        signoffs,
    });
    const launchGate = buildTurneroReleaseDiagnosticLaunchGate({
        readout,
        signoffs,
    });
    const finalReadout = buildTurneroReleaseFinalRepoReadout({
        lock,
        freezeBoard,
        launchGate,
    });
    const generatedAt = new Date().toISOString();
    const snapshot = {
        generatedAt,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        currentSnapshot,
        releaseEvidenceBundle,
        blockers,
        manifest,
        lock,
        freezeBoard,
        signoffs,
        readout,
        launchGate,
        finalReadout,
    };

    return {
        ...snapshot,
        downloadFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        snapshotFileName: DEFAULT_DOWNLOAD_FILE_NAME,
        clipboardSummary: finalReadout.markdown,
        snapshot,
    };
}

function renderTurneroReleaseDiagnosticLaunchConsoleHtml(pack) {
    return `
        <div class="turnero-release-diagnostic-launch-console__card" data-state="${escapeHtml(
            pack.launchGate.band
        )}">
            <header class="turnero-release-diagnostic-launch-console__header">
                <div>
                    <p class="queue-app-card__eyebrow">Final diagnostic</p>
                    <h3>Final Diagnostic Launch Console</h3>
                    <p>
                        Freeze the final evidence snapshot, capture owner signoff, and
                        gate the honest diagnostic launch for ${escapeHtml(
                            pack.clinicLabel
                        )}.
                    </p>
                </div>
                <div class="turnero-release-diagnostic-launch-console__actions">
                    <button type="button" data-action="lock-evidence">Lock evidence</button>
                    <button type="button" data-action="copy-launch-brief">Copy launch brief</button>
                    <button type="button" data-action="download-launch-pack">Download launch pack</button>
                </div>
            </header>

            <div class="turnero-release-diagnostic-launch-console__metrics">
                ${renderMetric(
                    'Launch gate',
                    String(pack.launchGate.score),
                    pack.launchGate.band,
                    pack.launchGate.band,
                    'launch-score'
                )}
                ${renderMetric(
                    'Decision',
                    pack.launchGate.decision,
                    'Gate decision',
                    pack.launchGate.band,
                    'launch-decision'
                )}
                ${renderMetric(
                    'Evidence lock',
                    pack.lock?.status || 'unlocked',
                    `Scope ${pack.scope}`,
                    pack.lock?.status === 'locked' ? 'ready' : 'warning',
                    'lock-status'
                )}
                ${renderMetric(
                    'Approved signoffs',
                    String(pack.launchGate.approved),
                    `of ${pack.launchGate.totalSignoffs}`,
                    pack.launchGate.approved >= 3 ? 'ready' : 'warning',
                    'approved-signoffs'
                )}
            </div>

            <div class="turnero-release-diagnostic-launch-console__panels">
                ${renderPanel(
                    'Launch manifest',
                    pack.manifest.summary.all,
                    pack.manifest.rows,
                    {
                        limit: 6,
                        formatter: (row) => row.label,
                        detail: (row) => `${row.owner} · ${row.criticality}`,
                        itemTone: (row) =>
                            row.criticality === 'critical'
                                ? 'alert'
                                : 'warning',
                        emptyLabel: 'No launch items',
                    }
                )}
                ${renderPanel(
                    'Freeze board',
                    pack.freezeBoard.summary.all,
                    pack.freezeBoard.rows,
                    {
                        limit: 6,
                        formatter: (row) => row.kind,
                        detail: (row) =>
                            `${row.owner} · ${row.severity} · ${row.status}`,
                        itemTone: (row) =>
                            row.frozen
                                ? row.severity === 'high'
                                    ? 'alert'
                                    : 'warning'
                                : 'ready',
                        emptyLabel: 'No blockers',
                    }
                )}
                ${renderPanel(
                    'Owner signoffs',
                    pack.signoffs.length,
                    pack.signoffs,
                    {
                        limit: 6,
                        formatter: (row) => row.owner,
                        detail: (row) =>
                            `${row.verdict} · ${row.note || 'Sin nota'}`,
                        itemTone: (row) =>
                            row.verdict === 'approve'
                                ? 'ready'
                                : row.verdict === 'reject'
                                  ? 'alert'
                                  : 'warning',
                        emptyLabel: 'No signoffs yet',
                    }
                )}
            </div>

            <div class="turnero-release-diagnostic-launch-console__workbench">
                <div class="turnero-release-diagnostic-launch-console__signoff-form">
                    <p class="queue-app-card__eyebrow">Owner signoff</p>
                    <input
                        data-field="signoff-owner"
                        placeholder="Owner"
                        style="width:100%;margin-top:6px;"
                    />
                    <input
                        data-field="signoff-verdict"
                        placeholder="approve/review/reject"
                        style="width:100%;margin-top:6px;"
                    />
                    <textarea
                        data-field="signoff-note"
                        placeholder="Note"
                        style="width:100%;margin-top:6px;"
                    ></textarea>
                    <button
                        type="button"
                        data-action="add-signoff"
                        style="margin-top:8px;"
                    >
                        Add signoff
                    </button>
                </div>

                <pre
                    data-role="launch-brief"
                    style="white-space:pre-wrap;margin-top:16px;"
                >${escapeHtml(pack.finalReadout.markdown)}</pre>
            </div>

            <p class="turnero-release-diagnostic-launch-console__footer">
                Generated at: ${escapeHtml(formatDateTime(pack.generatedAt))}
            </p>
        </div>
    `;
}

export function mountTurneroReleaseDiagnosticLaunchConsole(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const scope = normalizeScope(
        input,
        asObject(
            input.currentSnapshot ||
                input.snapshot ||
                input.releaseEvidenceBundle ||
                {}
        ),
        asObject(
            input.clinicProfile ||
                input.turneroClinicProfile ||
                input.currentSnapshot?.clinicProfile ||
                input.currentSnapshot?.turneroClinicProfile ||
                input.releaseEvidenceBundle?.clinicProfile ||
                input.releaseEvidenceBundle?.turneroClinicProfile ||
                {}
        )
    ).scope;
    const lockStore = createTurneroReleaseDiagnosticEvidenceLock(scope);
    const signoffStore = createTurneroReleaseOwnerSignoffRegistry(scope);
    let pack = buildTurneroReleaseDiagnosticLaunchConsolePack(input, {
        lockStore,
        signoffStore,
    });
    const result = {
        root: null,
        pack,
        recompute: () => {},
    };
    let root = null;

    const render = () => {
        const nextPack = buildTurneroReleaseDiagnosticLaunchConsolePack(input, {
            lockStore,
            signoffStore,
        });
        pack = nextPack;
        result.pack = nextPack;

        if (!root) {
            root = document.createElement('section');
            root.id = 'turneroReleaseDiagnosticLaunchConsole';
            root.className =
                'queue-app-card turnero-release-diagnostic-launch-console';
            root.dataset.turneroReleaseDiagnosticLaunchConsole = 'mounted';
            root.addEventListener('click', async (event) => {
                const actionElement =
                    event.target?.closest?.('[data-action]') || event.target;
                const action = actionElement?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'lock-evidence') {
                    lockStore.set({
                        status: 'locked',
                        note: 'Final evidence snapshot locked',
                    });
                    render();
                    return;
                }

                if (action === 'copy-launch-brief') {
                    await copyToClipboardSafe(pack.finalReadout.markdown);
                    return;
                }

                if (action === 'download-launch-pack') {
                    downloadJsonSnapshot(pack.downloadFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-signoff') {
                    const owner =
                        root.querySelector('[data-field="signoff-owner"]')
                            ?.value || '';
                    const verdict =
                        root.querySelector('[data-field="signoff-verdict"]')
                            ?.value || '';
                    const note =
                        root.querySelector('[data-field="signoff-note"]')
                            ?.value || '';

                    if (!owner.trim()) {
                        return;
                    }

                    signoffStore.add({
                        owner,
                        verdict: normalizeVerdict(verdict),
                        note,
                    });
                    render();
                }
            });
        }

        root.innerHTML =
            renderTurneroReleaseDiagnosticLaunchConsoleHtml(nextPack);
        root.dataset.turneroReleaseDiagnosticLaunchConsole = 'mounted';
        root.dataset.turneroReleaseDiagnosticLaunchScope = nextPack.scope;
        root.dataset.turneroReleaseDiagnosticLaunchRegion = nextPack.region;
        root.dataset.turneroReleaseDiagnosticLaunchScore = String(
            nextPack.launchGate.score
        );
        root.dataset.turneroReleaseDiagnosticLaunchBand =
            nextPack.launchGate.band;
        root.dataset.turneroReleaseDiagnosticLaunchDecision =
            nextPack.launchGate.decision;
        root.dataset.turneroReleaseDiagnosticLaunchLockStatus =
            nextPack.lock?.status || 'unlocked';
        root.dataset.turneroReleaseDiagnosticLaunchApprovedSignoffs = String(
            nextPack.launchGate.approved
        );
        root.dataset.turneroReleaseDiagnosticLaunchFrozenBlockers = String(
            nextPack.freezeBoard.summary.frozen
        );
        root.dataset.turneroReleaseDiagnosticLaunchHighFrozen = String(
            nextPack.freezeBoard.summary.high
        );
        root.dataset.turneroReleaseDiagnosticLaunchCriticalChecks = String(
            nextPack.readout.criticalChecks
        );
        root.dataset.turneroReleaseDiagnosticLaunchGeneratedAt =
            nextPack.generatedAt;

        const scoreNode = root.querySelector('[data-role="launch-score"]');
        const decisionNode = root.querySelector(
            '[data-role="launch-decision"]'
        );
        const lockNode = root.querySelector('[data-role="lock-status"]');
        const approvedNode = root.querySelector(
            '[data-role="approved-signoffs"]'
        );
        const briefNode = root.querySelector('[data-role="launch-brief"]');
        if (scoreNode) {
            scoreNode.textContent = String(nextPack.launchGate.score);
        }
        if (decisionNode) {
            decisionNode.textContent = nextPack.launchGate.decision;
        }
        if (lockNode) {
            lockNode.textContent = nextPack.lock?.status || 'unlocked';
        }
        if (approvedNode) {
            approvedNode.textContent = String(nextPack.launchGate.approved);
        }
        if (briefNode) {
            briefNode.textContent = nextPack.finalReadout.markdown;
        }

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(root);
        } else {
            host.innerHTML = '';
            host.appendChild(root);
        }

        host.dataset.turneroReleaseDiagnosticLaunchConsole = 'mounted';
        host.dataset.turneroReleaseDiagnosticLaunchScope = nextPack.scope;
        host.dataset.turneroReleaseDiagnosticLaunchRegion = nextPack.region;
        host.dataset.turneroReleaseDiagnosticLaunchScore = String(
            nextPack.launchGate.score
        );
        host.dataset.turneroReleaseDiagnosticLaunchBand =
            nextPack.launchGate.band;
        host.dataset.turneroReleaseDiagnosticLaunchDecision =
            nextPack.launchGate.decision;
        host.dataset.turneroReleaseDiagnosticLaunchLockStatus =
            nextPack.lock?.status || 'unlocked';

        result.root = root;
        root.__turneroReleaseDiagnosticLaunchConsolePack = nextPack;
        return result;
    };

    result.recompute = render;
    return render();
}

export function renderTurneroReleaseDiagnosticLaunchConsole(
    target,
    input = {}
) {
    return mountTurneroReleaseDiagnosticLaunchConsole(target, input);
}

export { buildTurneroReleaseDiagnosticLaunchConsolePack };

export default mountTurneroReleaseDiagnosticLaunchConsole;
