import { createTurneroReleaseActionsRunner } from './turnero-release-actions-runner.js';
import {
    appendTurneroIncidentJournalEntry,
    buildTurneroIncidentJournalMarkdown,
    buildTurneroIncidentJournalStats,
    clearTurneroIncidentJournal,
    readTurneroIncidentJournal,
} from './turnero-release-incident-journal.js';
import {
    toArray,
    toReleaseControlCenterSnapshot,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseConsolePlaybook } from './turnero-remediation-playbook.js';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeObject(value) {
    return isPlainObject(value) ? value : {};
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function nowIso() {
    return new Date().toISOString();
}

function resolveHost(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function composeSnapshot(input = {}) {
    const source = normalizeObject(input.snapshot || input);
    const parts = normalizeObject(source.parts);
    const clinicProfile = normalizeObject(
        source.clinicProfile ||
            source.turneroClinicProfile ||
            parts.clinicProfile ||
            input.clinicProfile ||
            {}
    );
    const pilotReadiness = normalizeObject(
        source.pilotReadiness ||
            parts.pilotReadiness ||
            input.pilotReadiness ||
            {}
    );
    const remoteReleaseReadiness = normalizeObject(
        source.remoteReleaseReadiness ||
            parts.remoteReleaseReadiness ||
            input.remoteReleaseReadiness ||
            {}
    );
    const publicShellDrift = normalizeObject(
        source.publicShellDrift ||
            parts.publicShellDrift ||
            input.publicShellDrift ||
            {}
    );
    const releaseEvidenceBundle = normalizeObject(
        source.releaseEvidenceBundle ||
            parts.releaseEvidenceBundle ||
            input.releaseEvidenceBundle ||
            {}
    );

    return toReleaseControlCenterSnapshot({
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        pilotReadiness,
        remoteReleaseReadiness,
        publicShellDrift,
        releaseEvidenceBundle,
        clinicId:
            input.clinicId ||
            source.clinicId ||
            pilotReadiness.clinicId ||
            remoteReleaseReadiness.clinicId ||
            '',
        profileFingerprint:
            input.profileFingerprint ||
            source.profileFingerprint ||
            pilotReadiness.profileFingerprint ||
            remoteReleaseReadiness.profileFingerprint ||
            '',
        releaseMode:
            input.releaseMode ||
            source.releaseMode ||
            pilotReadiness.releaseMode ||
            clinicProfile.release?.mode ||
            'suite_v2',
    });
}

function buildOwnerBreakdownRows(playbook) {
    const rows = Array.isArray(playbook.ownerBreakdown)
        ? playbook.ownerBreakdown
        : Array.isArray(playbook.ownerBreakdownRows)
          ? playbook.ownerBreakdownRows
          : [];

    return rows.map((row) => ({
        owner: toText(row.owner || row.label || 'unknown'),
        label: toText(row.label || row.owner || 'Pendiente'),
        focus: toText(row.focus || ''),
        total: Number(row.total || 0),
        blocker: Number(row.blocker || 0),
        warning: Number(row.warning || 0),
        info: Number(row.info || 0),
        score: Number(row.score || 0),
        sources: toArray(row.sources),
        topTitles: toArray(row.topTitles),
    }));
}

function buildTurneroReleaseOpsPack(model) {
    const snapshot = model.snapshot || composeSnapshot(model);
    const playbook =
        model.playbook || buildTurneroReleaseConsolePlaybook(snapshot);
    const journalEntries = Array.isArray(model.journalEntries)
        ? model.journalEntries.filter(Boolean)
        : readTurneroIncidentJournal(playbook.clinicId || snapshot.clinicId);
    const journalStats =
        model.journalStats || buildTurneroIncidentJournalStats(journalEntries);

    return {
        surface: 'admin_queue',
        generatedAt: toText(model.generatedAt || nowIso(), nowIso()),
        clinicProfile:
            snapshot.parts?.clinicProfile ||
            snapshot.turneroClinicProfile ||
            model.clinicProfile ||
            {},
        turneroClinicProfile:
            snapshot.parts?.clinicProfile ||
            snapshot.turneroClinicProfile ||
            model.clinicProfile ||
            {},
        clinicId: toText(playbook.clinicId || snapshot.clinicId || ''),
        profileFingerprint: toText(
            playbook.profileFingerprint || snapshot.profileFingerprint || ''
        ),
        pilotReadiness:
            snapshot.parts?.pilotReadiness || snapshot.pilotReadiness || {},
        remoteReleaseReadiness:
            snapshot.parts?.remoteReleaseReadiness ||
            snapshot.remoteReleaseReadiness ||
            {},
        publicShellDrift:
            snapshot.parts?.publicShellDrift || snapshot.publicShellDrift || {},
        releaseEvidenceBundle:
            snapshot.parts?.releaseEvidenceBundle ||
            snapshot.releaseEvidenceBundle ||
            {},
        playbook,
        incidentJournal: journalEntries,
        incidentJournalStats: journalStats,
        journalStats,
        journalMarkdown:
            model.journalMarkdown ||
            buildTurneroIncidentJournalMarkdown(
                playbook.clinicId || snapshot.clinicId,
                journalEntries
            ),
        runnerState: normalizeObject(model.runnerState),
        decision: toText(playbook.decision || 'review'),
        decisionReason: toText(playbook.decisionReason || ''),
        summary: normalizeObject(playbook.summary),
        summaryText: toText(playbook.summaryText || ''),
    };
}

function buildTurneroReleaseOpsHandoff(model, options = {}) {
    const pack = model.pack || buildTurneroReleaseOpsPack(model, options);
    const playbook = pack.playbook || model.playbook || {};
    const summary = normalizeObject(playbook.summary);
    const ownerRows = buildOwnerBreakdownRows(playbook);
    const incidents = Array.isArray(playbook.incidents)
        ? playbook.incidents
        : [];
    const journalEntries = Array.isArray(pack.incidentJournal)
        ? pack.incidentJournal
        : [];
    const journalHighlights = journalEntries.slice(0, 5);

    return [
        '# Turnero Release Ops Handoff',
        '',
        `- Decision: ${toText(playbook.decision, 'review')}`,
        `- Summary: ${toText(playbook.summaryText || playbook.evidenceSummary || '')}`,
        `- Counts: blocker=${Number(summary.blocker || 0)}, warning=${Number(
            summary.warning || 0
        )}, info=${Number(summary.info || 0)}`,
        `- Clinic: ${toText(playbook.clinicName || pack.clinicId || 'unknown')} (${toText(
            playbook.clinicId || pack.clinicId || 'unknown'
        )})`,
        `- Fingerprint: ${toText(playbook.profileFingerprint || pack.profileFingerprint || '')}`,
        '',
        '## Owner Breakdown',
        ...(ownerRows.length
            ? ownerRows.map(
                  (row) =>
                      `- ${toText(row.label || row.owner)}: blocker=${Number(
                          row.blocker || 0
                      )}, warning=${Number(row.warning || 0)}, info=${Number(
                          row.info || 0
                      )}`
              )
            : ['- Sin owners pendientes.']),
        '',
        '## Incidents',
        ...(incidents.length
            ? incidents.map(
                  (incident) =>
                      `- [${toText(incident.severity, 'info')}] ${toText(
                          incident.title || 'Incidente'
                      )}: ${toText(incident.detail || '')}`
              )
            : ['- Sin incidentes.']),
        '',
        '## Bitácora',
        ...(journalHighlights.length
            ? journalHighlights.map(
                  (entry) =>
                      `- [${toText(entry.severity, 'info')}] ${toText(
                          entry.title || 'Entrada'
                      )}: ${toText(entry.detail || entry.summary || '')}`
              )
            : ['- Sin entradas en la bitácora.']),
        '',
        '## Next Step',
        playbook.decision === 'ready'
            ? '- Liberate la release.'
            : playbook.decision === 'review'
              ? '- Revisa las señales warning antes de liberar.'
              : '- Corrige los bloqueos hold antes de liberar.',
    ].join('\n');
}

function buildJournalEntryForAction(action, model, result) {
    const playbook = model.playbook || {};
    const topIncident = Array.isArray(playbook.incidents)
        ? playbook.incidents[0]
        : null;
    const severity =
        playbook.decision === 'ready'
            ? 'info'
            : playbook.decision === 'review'
              ? 'warning'
              : 'blocker';
    return {
        id: `${action}-${Date.now().toString(36)}`,
        title: `${action}`,
        detail:
            result?.error?.message ||
            playbook.summaryText ||
            playbook.decisionReason ||
            topIncident?.detail ||
            '',
        owner: topIncident?.owner || 'ops',
        severity,
        source: 'release-ops-console',
        state: severity,
        topIncidentTitles: topIncident ? [topIncident.title] : [],
        recommendedCommands: ['refresh-all', 'copy-handoff', 'download-pack'],
        recommendedDocs: ['Runbook de release', 'Bitácora de incidentes'],
        evidence: {
            action,
            decision: playbook.decision,
            decisionReason: playbook.decisionReason,
            lastRunAt: model.runnerState?.lastRunAt || '',
        },
        updatedAt: nowIso(),
    };
}

function renderOwnerBreakdown(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return `
            <article class="queue-ops-pilot__handoff-item" role="listitem">
                <strong>Sin owners</strong>
                <p>No hay owners clasificados.</p>
            </article>
        `.trim();
    }

    return rows
        .map(
            (row) => `
                <article class="queue-ops-pilot__handoff-item" role="listitem">
                    <strong>${escapeHtml(row.label || row.owner)}</strong>
                    <p>B ${escapeHtml(String(row.blocker || 0))} · W ${escapeHtml(
                        String(row.warning || 0)
                    )} · I ${escapeHtml(String(row.info || 0))}</p>
                </article>
            `
        )
        .join('');
}

function renderJournalEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return `
            <article class="queue-ops-pilot__issues-item" data-state="ready" role="listitem">
                <div class="queue-ops-pilot__issues-item-head">
                    <strong>Sin entradas</strong>
                    <span class="queue-ops-pilot__issues-item-badge">Listo</span>
                </div>
                <p>No hay bitácora registrada todavía.</p>
            </article>
        `.trim();
    }

    return entries
        .slice(0, 5)
        .map(
            (entry) => `
                <article class="queue-ops-pilot__issues-item" data-state="${escapeHtml(
                    entry.severity || 'info'
                )}" role="listitem">
                    <div class="queue-ops-pilot__issues-item-head">
                        <strong>${escapeHtml(entry.title || 'Entrada')}</strong>
                        <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                            entry.severity || 'info'
                        )}</span>
                    </div>
                    <p>${escapeHtml(entry.detail || entry.summary || '')}</p>
                    <code>${escapeHtml(entry.updatedAt || '')}</code>
                </article>
            `
        )
        .join('');
}

function buildConsoleModel(input = {}, options = {}) {
    const snapshot = composeSnapshot(input);
    const playbook =
        options.playbook || buildTurneroReleaseConsolePlaybook(snapshot);
    const runnerState = normalizeObject(
        options.runnerState || input.runnerState
    );
    const journalEntries = Array.isArray(options.journalEntries)
        ? options.journalEntries.filter(Boolean)
        : readTurneroIncidentJournal(playbook.clinicId || snapshot.clinicId);
    const journalStats =
        options.journalStats ||
        buildTurneroIncidentJournalStats(journalEntries);
    const pack =
        options.pack ||
        buildTurneroReleaseOpsPack({
            snapshot,
            playbook,
            journalEntries,
            journalStats,
            runnerState,
            clinicProfile: snapshot.parts?.clinicProfile,
            generatedAt: nowIso(),
        });
    const handoffText =
        options.handoffText ||
        buildTurneroReleaseOpsHandoff({
            pack,
            playbook,
            journalEntries,
            runnerState,
        });

    return {
        snapshot,
        playbook,
        ownerBreakdown: buildOwnerBreakdownRows(playbook),
        journalEntries,
        journalStats,
        journalMarkdown:
            options.journalMarkdown ||
            buildTurneroIncidentJournalMarkdown(
                playbook.clinicId || snapshot.clinicId,
                journalEntries
            ),
        pack,
        handoffText,
        runnerState,
        decision: toText(playbook.decision || 'review'),
        decisionReason: toText(playbook.decisionReason || ''),
        summary: normalizeObject(playbook.summary),
        summaryText: toText(playbook.summaryText || ''),
        tone:
            playbook.decision === 'ready'
                ? 'ready'
                : playbook.decision === 'review'
                  ? 'warning'
                  : 'alert',
        supportCopy: toText(
            playbook.clipboardSummary || playbook.evidenceSummary || ''
        ),
    };
}

export function renderTurneroReleaseOpsConsoleCard(input = {}, options = {}) {
    const model = input?.pack ? input : buildConsoleModel(input, options);
    const summary = normalizeObject(model.summary);
    const runnerState = normalizeObject(model.runnerState);
    const journalStats = normalizeObject(
        model.journalStats || model.incidentJournalStats
    );
    const journalEntries = Array.isArray(model.journalEntries)
        ? model.journalEntries
        : Array.isArray(model.incidentJournal)
          ? model.incidentJournal
          : [];
    const journalMarkdown = toText(
        model.journalMarkdown ||
            buildTurneroIncidentJournalMarkdown(
                model.playbook?.clinicId || model.snapshot?.clinicId,
                journalEntries
            )
    );

    return `
        <section
            id="queueReleaseOpsConsole"
            class="queue-ops-pilot__issues queue-ops-pilot__release-ops-console"
            data-state="${escapeHtml(model.tone)}"
            data-decision="${escapeHtml(model.decision)}"
            aria-labelledby="queueReleaseOpsConsoleTitle"
            aria-live="polite"
        >
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Release Ops Console</p>
                    <h6 id="queueReleaseOpsConsoleTitle">Consola de operaciones</h6>
                </div>
                <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                    model.tone
                )}">
                    ${escapeHtml(model.decision)}
                </span>
            </div>
            <p id="queueReleaseOpsConsoleSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.summaryText || model.playbook?.summaryText || ''
            )}</p>
            <p id="queueReleaseOpsConsoleSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                `${model.supportCopy || ''}${
                    runnerState.lastAction
                        ? ` · Última acción: ${runnerState.lastAction}${
                              runnerState.lastRunAt
                                  ? ` @ ${runnerState.lastRunAt}`
                                  : ''
                          }`
                        : ''
                }`
            )}</p>
            <div class="queue-ops-pilot__actions" aria-label="Acciones de la consola">
                <button id="queueReleaseOpsConsoleRefreshAllBtn" type="button" class="queue-ops-pilot__action queue-ops-pilot__action--primary" data-action="refresh-all">Refrescar todo</button>
                <button id="queueReleaseOpsConsoleRefreshPilotBtn" type="button" class="queue-ops-pilot__action" data-action="refresh-pilot">Refrescar piloto</button>
                <button id="queueReleaseOpsConsoleRefreshRemoteBtn" type="button" class="queue-ops-pilot__action" data-action="refresh-remote">Refrescar remoto</button>
                <button id="queueReleaseOpsConsoleRefreshShellBtn" type="button" class="queue-ops-pilot__action" data-action="refresh-shell">Refrescar shell</button>
                <button id="queueReleaseOpsConsoleRefreshEvidenceBtn" type="button" class="queue-ops-pilot__action" data-action="refresh-evidence">Refrescar evidencia</button>
                <button id="queueReleaseOpsConsoleRecalculateBtn" type="button" class="queue-ops-pilot__action" data-action="recalculate-decision">Recalcular decisión</button>
            </div>
            <section class="queue-ops-pilot__handoff" data-state="${escapeHtml(model.tone)}">
                <div class="queue-ops-pilot__handoff-head">
                    <div>
                        <p class="queue-app-card__eyebrow">Handoff</p>
                        <h6 id="queueReleaseOpsConsoleHandoffTitle">Resumen operativo</h6>
                    </div>
                    <div class="queue-ops-pilot__actions">
                        <button id="queueReleaseOpsConsoleCopyHandoffBtn" type="button" class="queue-ops-pilot__handoff-copy" data-action="copy-handoff">Copiar handoff</button>
                        <button id="queueReleaseOpsConsoleDownloadPackBtn" type="button" class="queue-ops-pilot__action" data-action="download-pack">Descargar pack</button>
                    </div>
                </div>
                <div id="queueReleaseOpsConsoleOwnerBreakdown" class="queue-ops-pilot__handoff-items" role="list" aria-label="Breakdown por owner">
                    ${renderOwnerBreakdown(model.ownerBreakdown)}
                </div>
                <p id="queueReleaseOpsConsoleHandoffSummary" class="queue-ops-pilot__handoff-support">${escapeHtml(
                    `B ${Number(summary.blocker || 0)} · W ${Number(summary.warning || 0)} · I ${Number(
                        summary.info || 0
                    )}`
                )}</p>
            </section>
            <section
                id="queueReleaseOpsConsoleJournal"
                class="queue-ops-pilot__issues"
                data-state="${escapeHtml(
                    journalStats.blocker > 0
                        ? 'alert'
                        : journalStats.warning > 0
                          ? 'warning'
                          : 'ready'
                )}"
            >
                <div class="queue-ops-pilot__issues-head">
                    <div>
                        <p class="queue-app-card__eyebrow">Bitácora</p>
                        <h6 id="queueReleaseOpsConsoleJournalTitle">Incidentes locales</h6>
                    </div>
                    <div class="queue-ops-pilot__actions">
                        <button id="queueReleaseOpsConsoleClearJournalBtn" type="button" class="queue-ops-pilot__action" data-action="clear-journal">Limpiar bitácora</button>
                    </div>
                </div>
                <p id="queueReleaseOpsConsoleJournalSummary" class="queue-ops-pilot__issues-summary">Total ${escapeHtml(
                    String(journalStats.total || 0)
                )} · Bloqueos ${escapeHtml(String(journalStats.blocker || 0))} · Advertencias ${escapeHtml(
                    String(journalStats.warning || 0)
                )}</p>
                <div id="queueReleaseOpsConsoleJournalItems" class="queue-ops-pilot__issues-items" role="list" aria-label="Entradas de bitácora">
                    ${renderJournalEntries(journalEntries)}
                </div>
                <details id="queueReleaseOpsConsoleJournalMarkdownDetails">
                    <summary>Markdown</summary>
                    <pre id="queueReleaseOpsConsoleJournalMarkdown">${escapeHtml(
                        journalMarkdown
                    )}</pre>
                </details>
            </section>
            <details id="queueReleaseOpsConsolePackDetails">
                <summary>Pack JSON</summary>
                <pre id="queueReleaseOpsConsolePackJson">${escapeHtml(
                    JSON.stringify(model.pack || {}, null, 2)
                )}</pre>
            </details>
            ${runnerState.lastError ? `<p id="queueReleaseOpsConsoleError" class="queue-ops-pilot__issues-support">Error: ${escapeHtml(runnerState.lastError.message || runnerState.lastError.code || 'unknown_error')}</p>` : ''}
        </section>
    `.trim();
}

async function performAction(
    action,
    runner,
    model,
    options,
    host,
    refreshView
) {
    const journalClinicId = model.playbook?.clinicId || model.snapshot.clinicId;
    let result = null;

    if (action === 'refresh-pilot') {
        result = await runner.refreshPilotReadiness();
        await runner.refreshEvidenceBundle();
        await runner.recalculateDecision();
    } else if (action === 'refresh-remote') {
        result = await runner.refreshRemoteRelease();
        await runner.refreshEvidenceBundle();
        await runner.recalculateDecision();
    } else if (action === 'refresh-shell') {
        result = await runner.refreshPublicShellDrift();
        await runner.refreshEvidenceBundle();
        await runner.recalculateDecision();
    } else if (action === 'refresh-evidence') {
        result = await runner.refreshEvidenceBundle();
        await runner.recalculateDecision();
    } else if (action === 'refresh-all') {
        result = await runner.refreshAll();
    } else if (action === 'recalculate-decision') {
        result = await runner.recalculateDecision();
    } else if (action === 'copy-handoff') {
        result = await runner.copyHandoff();
    } else if (action === 'download-pack') {
        result = await runner.downloadPack();
    } else if (action === 'clear-journal') {
        clearTurneroIncidentJournal(journalClinicId);
        result = { ok: true, cleared: true };
    }

    const latestSnapshot = composeSnapshot({
        snapshot: options.snapshot || options.initialSnapshot || {},
        clinicProfile: runner.state.results.clinicProfile,
        pilotReadiness: runner.state.results.pilotReadiness,
        remoteReleaseReadiness: runner.state.results.remoteReleaseReadiness,
        publicShellDrift: runner.state.results.publicShellDrift,
        releaseEvidenceBundle: runner.state.results.releaseEvidenceBundle,
    });
    const playbook =
        runner.state.results.playbook ||
        buildTurneroReleaseConsolePlaybook(latestSnapshot);

    if (
        action !== 'copy-handoff' &&
        action !== 'download-pack' &&
        action !== 'clear-journal'
    ) {
        appendTurneroIncidentJournalEntry(
            journalClinicId,
            buildJournalEntryForAction(
                action,
                {
                    snapshot: latestSnapshot,
                    playbook,
                    runnerState: runner.state,
                },
                result
            )
        );
    }

    refreshView();
    host.removeAttribute('aria-busy');
    return result;
}

export function mountTurneroReleaseOpsConsoleCard(target, options = {}) {
    const host = resolveHost(target);
    if (!host) {
        return null;
    }

    const runner = options.runner || createTurneroReleaseActionsRunner(options);
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    host.dataset.turneroReleaseOpsConsoleRequestId = requestId;

    function renderView() {
        if (host.dataset.turneroReleaseOpsConsoleRequestId !== requestId) {
            return null;
        }

        const snapshot = composeSnapshot({
            snapshot: options.snapshot || options.initialSnapshot || {},
            clinicProfile: runner.state.results.clinicProfile,
            pilotReadiness: runner.state.results.pilotReadiness,
            remoteReleaseReadiness: runner.state.results.remoteReleaseReadiness,
            publicShellDrift: runner.state.results.publicShellDrift,
            releaseEvidenceBundle: runner.state.results.releaseEvidenceBundle,
        });
        const playbook =
            runner.state.results.playbook ||
            buildTurneroReleaseConsolePlaybook(snapshot);
        const journalClinicId = playbook.clinicId || snapshot.clinicId;
        const journalEntries = readTurneroIncidentJournal(journalClinicId);
        const journalStats = buildTurneroIncidentJournalStats(journalEntries);
        const model = buildConsoleModel(
            {
                snapshot,
                playbook,
                journalEntries,
                journalStats,
                runnerState: runner.state,
                clinicProfile: snapshot.parts?.clinicProfile,
                generatedAt: nowIso(),
            },
            options
        );
        host.innerHTML = renderTurneroReleaseOpsConsoleCard(model, options);
        host.__turneroReleaseOpsConsoleModel = model;
        return model;
    }

    renderView();

    if (host.__turneroReleaseOpsConsoleClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseOpsConsoleClickHandler
        );
    }

    host.__turneroReleaseOpsConsoleClickHandler = async (event) => {
        const button =
            typeof Element !== 'undefined' && event.target instanceof Element
                ? event.target.closest('button[data-action]')
                : null;
        if (
            typeof HTMLElement === 'undefined' ||
            !(button instanceof HTMLElement) ||
            typeof host.contains !== 'function' ||
            !host.contains(button)
        ) {
            return;
        }

        const action = button.getAttribute('data-action');
        if (!action) {
            return;
        }

        host.setAttribute('aria-busy', 'true');
        const currentModel =
            host.__turneroReleaseOpsConsoleModel ||
            buildConsoleModel({}, options);
        try {
            await performAction(
                action,
                runner,
                currentModel,
                options,
                host,
                renderView
            );
        } catch (_error) {
            host.removeAttribute('aria-busy');
            renderView();
        }
    };

    host.addEventListener('click', host.__turneroReleaseOpsConsoleClickHandler);

    return host.querySelector('#queueReleaseOpsConsole') || host;
}

export { buildConsoleModel as buildTurneroReleaseOpsConsoleModel };
export { buildTurneroReleaseOpsPack };
export { buildTurneroReleaseOpsHandoff };

export default mountTurneroReleaseOpsConsoleCard;
