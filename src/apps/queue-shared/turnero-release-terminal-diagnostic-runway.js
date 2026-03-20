import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseFinalDiagnosticCharter } from './turnero-release-final-diagnostic-charter.js';
import { buildTurneroReleaseTerminalQuestionChecklist } from './turnero-release-terminal-question-checklist.js';
import { createTurneroReleaseBlockerSettlementLedger } from './turnero-release-blocker-settlement-ledger.js';
import { createTurneroReleaseTerminalAdjudicationSession } from './turnero-release-terminal-adjudication-session.js';
import { buildTurneroReleaseFinalHumanRunbook } from './turnero-release-final-human-runbook.js';
import { buildTurneroReleaseTerminalPackageIntegrityScore } from './turnero-release-terminal-package-integrity-score.js';
import { buildTurneroReleaseTerminalDiagnosticRunway } from './turnero-release-terminal-diagnostic-runway-builder.js';

const DEFAULT_DOWNLOAD_FILE_NAME =
    'turnero-release-terminal-diagnostic-runway.json';

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
        document.getElementById('turneroReleaseTerminalDiagnosticRunway') ||
        document.querySelector(
            '[data-turnero-release-terminal-diagnostic-runway]'
        )
    );
}

function normalizeScope(input = {}, currentSnapshot = {}, clinicProfile = {}) {
    return toText(
        input.scope ||
            input.region ||
            currentSnapshot.scope ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            'regional',
        'regional'
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

function normalizeDossierDecision(input = {}, currentSnapshot = {}) {
    return toText(
        input.dossierDecision ||
            currentSnapshot.dossierDecision ||
            currentSnapshot.repoVerdict ||
            'issue-final-verdict',
        'issue-final-verdict'
    );
}

function renderMetricCard(label, value, detail, tone = 'info', role = '') {
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

function renderListSection(title, count, itemsHtml, emptyLabel) {
    return `
        <section class="turnero-release-terminal-diagnostic-runway__panel">
            <header class="turnero-release-terminal-diagnostic-runway__panel-header">
                <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                <strong>${escapeHtml(String(count))}</strong>
            </header>
            ${
                itemsHtml
                    ? itemsHtml
                    : `<p class="turnero-release-terminal-diagnostic-runway__empty">${escapeHtml(
                          emptyLabel
                      )}</p>`
            }
        </section>
    `;
}

function renderChecklistRows(rows) {
    const items = toArray(rows);
    return items
        .map(
            (row) => `
                <li data-state="${escapeHtml(
                    toText(row.state, 'open').toLowerCase() === 'closed'
                        ? 'ready'
                        : 'warning'
                )}">
                    <strong>${escapeHtml(row.label || row.key || row.id || 'Question')}</strong>
                    <span>${escapeHtml(
                        `${row.owner || 'program'} · ${row.criticality || 'high'}`
                    )}</span>
                </li>
            `
        )
        .join('');
}

function renderSettlementRows(rows) {
    const items = toArray(rows);
    return items
        .map(
            (row) => `
                <li data-state="${escapeHtml(
                    toText(row.state || row.status, 'open').toLowerCase() ===
                        'closed'
                        ? 'ready'
                        : 'warning'
                )}">
                    <strong>${escapeHtml(row.title || row.id || 'Settlement')}</strong>
                    <span>${escapeHtml(
                        `${row.owner || 'program'} · ${row.severity || 'medium'}`
                    )}</span>
                </li>
            `
        )
        .join('');
}

function renderPrincipleRows(principles) {
    return toArray(principles)
        .map(
            (principle) => `
                <li data-state="ready">
                    <strong>${escapeHtml(principle)}</strong>
                </li>
            `
        )
        .join('');
}

function renderRunwayHtml(pack) {
    const openQuestions = toArray(pack.checklist.rows).filter(
        (row) => toText(row.state, 'open').toLowerCase() !== 'closed'
    );
    const openSettlements = toArray(pack.settlements).filter(
        (row) =>
            toText(row.state || row.status, 'open').toLowerCase() !== 'closed'
    );

    return `
        <div class="queue-app-card__body queue-app-card__body--terminal-diagnostic">
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Terminal diagnostic</p>
                    <h3>Terminal Diagnostic Runway</h3>
                    <p>
                        Última estación previa al diagnóstico honesto final del
                        repo/panel.
                    </p>
                </div>
                <div class="queue-app-card__header-meta">
                    <span class="queue-app-card__chip" data-role="runway-band">
                        ${escapeHtml(pack.integrityScore.band)}
                    </span>
                    <span class="queue-app-card__chip" data-role="runway-decision">
                        ${escapeHtml(pack.integrityScore.decision)}
                    </span>
                </div>
            </header>
            <div class="queue-app-card__metrics">
                ${renderMetricCard(
                    'Integrity score',
                    String(pack.integrityScore.score),
                    `${openQuestions.length} open questions`,
                    pack.integrityScore.band,
                    'runway-score'
                )}
                ${renderMetricCard(
                    'Session',
                    pack.session?.status || 'unprepared',
                    pack.session?.moderator || 'program',
                    pack.session?.status === 'ready' ||
                        pack.session?.status === 'locked'
                        ? 'ready'
                        : 'warning',
                    'runway-session'
                )}
                ${renderMetricCard(
                    'Open settlements',
                    String(openSettlements.length),
                    `${pack.settlements.length} total`,
                    openSettlements.length === 0 ? 'ready' : 'warning',
                    'runway-settlement-count'
                )}
                ${renderMetricCard(
                    'Dossier decision',
                    pack.dossierDecision,
                    pack.charter.objective,
                    'info',
                    'runway-dossier-decision'
                )}
            </div>
            <div class="queue-app-card__actions">
                <button type="button" data-action="prepare-terminal-session">
                    Prepare terminal session
                </button>
                <button type="button" data-action="copy-runway-brief">
                    Copy runway brief
                </button>
                <button type="button" data-action="download-runway-pack">
                    Download runway JSON
                </button>
            </div>
            <div class="turnero-release-terminal-diagnostic-runway__grid">
                ${renderListSection(
                    'Charter',
                    toArray(pack.charter.principles).length,
                    `<ul class="turnero-release-terminal-diagnostic-runway__list">${renderPrincipleRows(
                        pack.charter.principles
                    )}</ul>`,
                    'Sin principios'
                )}
                ${renderListSection(
                    'Checklist',
                    toArray(pack.checklist.rows).length,
                    `<ul class="turnero-release-terminal-diagnostic-runway__list" data-role="checklist-list">${renderChecklistRows(
                        pack.checklist.rows
                    )}</ul>`,
                    'Sin preguntas'
                )}
                ${renderListSection(
                    'Blocker settlements',
                    pack.settlements.length,
                    `<ul class="turnero-release-terminal-diagnostic-runway__list" data-role="settlement-list">${renderSettlementRows(
                        pack.settlements
                    )}</ul>`,
                    'Sin settlements'
                )}
            </div>
            <section class="turnero-release-terminal-diagnostic-runway__panel">
                <header class="turnero-release-terminal-diagnostic-runway__panel-header">
                    <p class="queue-app-card__eyebrow">New blocker settlement</p>
                    <strong>Entry</strong>
                </header>
                <div class="turnero-release-terminal-diagnostic-runway__form">
                    <label>
                        <span>Title</span>
                        <input
                            type="text"
                            data-field="settlement-title"
                            placeholder="Settlement title"
                        />
                    </label>
                    <label>
                        <span>Owner</span>
                        <input
                            type="text"
                            data-field="settlement-owner"
                            placeholder="program"
                        />
                    </label>
                    <label>
                        <span>Severity</span>
                        <input
                            type="text"
                            data-field="settlement-severity"
                            placeholder="medium"
                        />
                    </label>
                    <label>
                        <span>Resolution</span>
                        <textarea
                            data-field="settlement-resolution"
                            placeholder="Settlement resolution"
                        ></textarea>
                    </label>
                    <button type="button" data-action="add-settlement">
                        Add settlement
                    </button>
                </div>
            </section>
            <section class="turnero-release-terminal-diagnostic-runway__panel">
                <header class="turnero-release-terminal-diagnostic-runway__panel-header">
                    <p class="queue-app-card__eyebrow">Runbook humano</p>
                    <strong data-role="runbook-step-count">${escapeHtml(
                        String(pack.runbook.steps.length)
                    )}</strong>
                </header>
                <ol class="turnero-release-terminal-diagnostic-runway__steps" data-role="runbook-steps">
                    ${toArray(pack.runbook.steps)
                        .map(
                            (step) => `
                                <li>${escapeHtml(step)}</li>
                            `
                        )
                        .join('')}
                </ol>
            </section>
            <pre class="turnero-release-terminal-diagnostic-runway__brief" data-role="runway-brief">${escapeHtml(
                pack.runway.markdown
            )}</pre>
            <footer class="turnero-release-terminal-diagnostic-runway__footer">
                <span data-role="generated-at">${escapeHtml(
                    formatDateTime(pack.generatedAt)
                )}</span>
            </footer>
        </div>
    `;
}

function buildTurneroReleaseTerminalDiagnosticRunwayPack(input = {}) {
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
    const dossierDecision = normalizeDossierDecision(input, currentSnapshot);
    const settlementStore =
        input.settlementStore ||
        createTurneroReleaseBlockerSettlementLedger(scope);
    const sessionStore =
        input.sessionStore ||
        createTurneroReleaseTerminalAdjudicationSession(scope);
    const charter = buildTurneroReleaseFinalDiagnosticCharter({
        ...input,
        scope,
        region,
        dossierDecision,
    });
    const checklist = buildTurneroReleaseTerminalQuestionChecklist({
        ...input,
        scope,
        region,
        dossierDecision,
    });
    const settlements = toArray(
        input.settlements && input.settlements.length
            ? input.settlements
            : settlementStore.list()
    );
    const session =
        input.session && typeof input.session === 'object'
            ? input.session
            : sessionStore.get();
    const integrityScore = buildTurneroReleaseTerminalPackageIntegrityScore({
        checklistSummary: checklist.summary,
        settlements,
        session,
        dossierDecision,
    });
    const runbook = buildTurneroReleaseFinalHumanRunbook({
        charter,
        checklist,
        settlements,
        session,
        integrityScore,
    });
    const runway = buildTurneroReleaseTerminalDiagnosticRunway({
        scope,
        region,
        dossierDecision,
        charter,
        checklist,
        settlements,
        session,
        integrityScore,
        runbook,
    });

    return {
        scope,
        region,
        dossierDecision,
        currentSnapshot,
        clinicProfile,
        charter,
        checklist,
        settlements,
        session,
        runbook,
        integrityScore,
        runway,
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

export function mountTurneroReleaseTerminalDiagnosticRunway(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const settlementStore =
        input.settlementStore ||
        createTurneroReleaseBlockerSettlementLedger(
            normalizeScope(
                input,
                asObject(input.currentSnapshot),
                asObject(input.clinicProfile)
            )
        );
    const sessionStore =
        input.sessionStore ||
        createTurneroReleaseTerminalAdjudicationSession(
            normalizeScope(
                input,
                asObject(input.currentSnapshot),
                asObject(input.clinicProfile)
            )
        );
    let pack = buildTurneroReleaseTerminalDiagnosticRunwayPack({
        ...input,
        settlementStore,
        sessionStore,
    });

    const root = document.createElement('section');
    root.id = 'turneroReleaseTerminalDiagnosticRunway';
    root.className =
        'turnero-release-terminal-diagnostic-runway queue-app-card';
    root.dataset.turneroReleaseTerminalDiagnosticRunway = 'mounted';
    root.dataset.turneroReleaseTerminalDiagnosticRunwayBand =
        pack.integrityScore.band;
    root.dataset.turneroReleaseTerminalDiagnosticRunwayDecision =
        pack.integrityScore.decision;
    root.dataset.turneroReleaseTerminalDiagnosticRunwayScope = pack.scope;
    root.innerHTML = renderRunwayHtml(pack);

    if (typeof host.replaceChildren === 'function') {
        host.replaceChildren(root);
    } else {
        host.innerHTML = '';
        host.appendChild(root);
    }

    host.dataset.turneroReleaseTerminalDiagnosticRunway = 'mounted';
    host.dataset.turneroReleaseTerminalDiagnosticRunwayBand =
        pack.integrityScore.band;
    host.dataset.turneroReleaseTerminalDiagnosticRunwayDecision =
        pack.integrityScore.decision;
    host.dataset.turneroReleaseTerminalDiagnosticRunwayScope = pack.scope;

    const refs = {
        score: root.querySelector('[data-role="runway-score"]'),
        band: root.querySelector('[data-role="runway-band"]'),
        decision: root.querySelector('[data-role="runway-decision"]'),
        sessionStatus: root.querySelector('[data-role="runway-session"]'),
        settlementCount: root.querySelector(
            '[data-role="runway-settlement-count"]'
        ),
        checklistList: root.querySelector('[data-role="checklist-list"]'),
        settlementList: root.querySelector('[data-role="settlement-list"]'),
        runbookStepCount: root.querySelector(
            '[data-role="runbook-step-count"]'
        ),
        runbookSteps: root.querySelector('[data-role="runbook-steps"]'),
        brief: root.querySelector('[data-role="runway-brief"]'),
        generatedAt: root.querySelector('[data-role="generated-at"]'),
        titleField: root.querySelector('[data-field="settlement-title"]'),
        ownerField: root.querySelector('[data-field="settlement-owner"]'),
        severityField: root.querySelector('[data-field="settlement-severity"]'),
        resolutionField: root.querySelector(
            '[data-field="settlement-resolution"]'
        ),
    };

    function sync() {
        pack = buildTurneroReleaseTerminalDiagnosticRunwayPack({
            ...input,
            settlementStore,
            sessionStore,
            scope: pack.scope,
            region: pack.region,
            dossierDecision: pack.dossierDecision,
        });
        root.dataset.turneroReleaseTerminalDiagnosticRunwayBand =
            pack.integrityScore.band;
        root.dataset.turneroReleaseTerminalDiagnosticRunwayDecision =
            pack.integrityScore.decision;
        root.dataset.turneroReleaseTerminalDiagnosticRunwayScope = pack.scope;
        host.dataset.turneroReleaseTerminalDiagnosticRunwayBand =
            pack.integrityScore.band;
        host.dataset.turneroReleaseTerminalDiagnosticRunwayDecision =
            pack.integrityScore.decision;
        host.dataset.turneroReleaseTerminalDiagnosticRunwayScope = pack.scope;

        if (refs.score) {
            refs.score.textContent = String(pack.integrityScore.score);
        }
        if (refs.band) {
            refs.band.textContent = pack.integrityScore.band;
        }
        if (refs.decision) {
            refs.decision.textContent = pack.integrityScore.decision;
        }
        if (refs.sessionStatus) {
            refs.sessionStatus.textContent =
                pack.session?.status || 'unprepared';
        }
        if (refs.settlementCount) {
            refs.settlementCount.textContent = String(pack.settlements.length);
        }
        if (refs.checklistList) {
            refs.checklistList.innerHTML = renderChecklistRows(
                pack.checklist.rows
            );
        }
        if (refs.settlementList) {
            refs.settlementList.innerHTML = renderSettlementRows(
                pack.settlements
            );
        }
        if (refs.runbookStepCount) {
            refs.runbookStepCount.textContent = String(
                pack.runbook.steps.length
            );
        }
        if (refs.runbookSteps) {
            refs.runbookSteps.innerHTML = toArray(pack.runbook.steps)
                .map((step) => `<li>${escapeHtml(step)}</li>`)
                .join('');
        }
        if (refs.brief) {
            refs.brief.textContent = pack.runway.markdown;
        }
        if (refs.generatedAt) {
            refs.generatedAt.textContent = formatDateTime(pack.generatedAt);
        }

        root.__turneroReleaseTerminalDiagnosticRunwayPack = pack;
    }

    const handleClick = async (event) => {
        const target = event.target;
        const actionNode =
            target && typeof target.closest === 'function'
                ? target.closest('[data-action]')
                : target;
        const action = actionNode?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'prepare-terminal-session') {
            sessionStore.set({
                status: 'prepared',
                moderator: 'program',
                note: 'Terminal diagnostic session prepared',
            });
            sync();
            return;
        }

        if (action === 'copy-runway-brief') {
            await copyToClipboardSafe(pack.runway.markdown);
            return;
        }

        if (action === 'download-runway-pack') {
            downloadJsonSnapshot(DEFAULT_DOWNLOAD_FILE_NAME, pack);
            return;
        }

        if (action === 'add-settlement') {
            const title = toText(refs.titleField?.value);
            if (!title) {
                return;
            }

            settlementStore.add({
                title,
                owner: toText(refs.ownerField?.value, 'program') || 'program',
                severity:
                    toText(refs.severityField?.value, 'medium') || 'medium',
                state: 'open',
                resolution: toText(refs.resolutionField?.value, ''),
            });

            if (refs.titleField) {
                refs.titleField.value = '';
            }
            if (refs.ownerField) {
                refs.ownerField.value = '';
            }
            if (refs.severityField) {
                refs.severityField.value = '';
            }
            if (refs.resolutionField) {
                refs.resolutionField.value = '';
            }

            sync();
        }
    };

    root.addEventListener('click', handleClick);
    root.__turneroReleaseTerminalDiagnosticRunwayPack = pack;
    root.__turneroReleaseTerminalDiagnosticRunwaySync = sync;
    sync();

    const result = {
        root,
        host,
        get pack() {
            return pack;
        },
        sync,
        destroy() {
            root.removeEventListener('click', handleClick);
        },
    };

    return result;
}

export function wireTurneroReleaseTerminalDiagnosticRunway({
    mountNode,
    ...input
} = {}) {
    return mountTurneroReleaseTerminalDiagnosticRunway(mountNode, input);
}

export function renderTurneroReleaseTerminalDiagnosticRunway(
    target,
    input = {}
) {
    return mountTurneroReleaseTerminalDiagnosticRunway(target, input);
}

export default mountTurneroReleaseTerminalDiagnosticRunway;
