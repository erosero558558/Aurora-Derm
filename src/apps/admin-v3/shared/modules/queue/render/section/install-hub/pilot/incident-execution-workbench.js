import { getState } from '../../../../../../core/store.js';
import {
    buildTurneroReleaseControlCenterModel,
    copyToClipboardSafe,
    downloadJsonSnapshot,
} from '../../../../../../../../queue-shared/turnero-release-control-center.js';
import { normalizeWorkbenchIncident } from '../../../../../../../../queue-shared/turnero-release-incident-playbooks.js';
import {
    buildOwnerRunbookText,
    buildIncidentHandoffText,
    buildOwnerWorkbenchSnapshot,
    buildWorkbenchClipboardBundle,
} from '../../../../../../../../queue-shared/turnero-release-owner-workbench.js';
import { createIncidentExecutorStore } from '../../../../../../../../queue-shared/turnero-release-incident-executor.js';

const STEP_STATE_ORDER = Object.freeze(['todo', 'doing', 'blocked', 'done']);
const STEP_STATE_LABELS = Object.freeze({
    todo: 'Todo',
    doing: 'Doing',
    blocked: 'Blocked',
    done: 'Done',
});

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function escapeHtmlFallback(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeHtml(value, escapeHtmlImpl) {
    return (
        typeof escapeHtmlImpl === 'function'
            ? escapeHtmlImpl
            : escapeHtmlFallback
    )(value);
}

function safeIdPart(value, fallback = 'item') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || fallback;
}

function normalizeStateToken(value) {
    const token = String(value || '')
        .trim()
        .toLowerCase();
    if (STEP_STATE_ORDER.includes(token)) {
        return token;
    }

    if (['alert', 'blocked', 'critical', 'hold', 'error'].includes(token)) {
        return 'blocked';
    }

    if (
        ['warning', 'review', 'watch', 'pending', 'working', 'doing'].includes(
            token
        )
    ) {
        return 'doing';
    }

    if (['ready', 'done', 'success', 'clear', 'ok'].includes(token)) {
        return 'done';
    }

    return 'todo';
}

function normalizeSeverityToken(state, severity) {
    const token = String(severity || state || '')
        .trim()
        .toLowerCase();

    if (['critical', 'hold', 'alert', 'blocked', 'error'].includes(token)) {
        return 'critical';
    }

    if (
        ['warning', 'review', 'watch', 'pending', 'doing', 'working'].includes(
            token
        )
    ) {
        return 'warning';
    }

    if (['ready', 'done', 'success', 'clear', 'ok'].includes(token)) {
        return 'info';
    }

    return 'warning';
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
        return [value.trim()];
    }

    return [];
}

function inferIncidentSourceState(item, fallback = 'todo') {
    const state = String(item?.state || item?.status || fallback)
        .trim()
        .toLowerCase();
    return normalizeStateToken(state);
}

function mapRawIncidentSeed(item, source, index) {
    const raw = asObject(item);
    const title = String(
        raw.title ||
            raw.label ||
            raw.summary ||
            raw.name ||
            raw.code ||
            raw.id ||
            `${source} ${index + 1}`
    ).trim();
    const detail = String(
        raw.detail ||
            raw.summary ||
            raw.reason ||
            raw.note ||
            raw.description ||
            title
    ).trim();
    const code = String(
        raw.code || raw.id || raw.key || raw.kind || raw.category || title
    ).trim();
    const state = inferIncidentSourceState(
        raw,
        source === 'publicShellDrift' ? 'blocked' : 'todo'
    );
    const severity = normalizeSeverityToken(state, raw.severity || raw.level);

    return {
        ...raw,
        id: String(raw.id || code || `${source}-${index + 1}`).trim(),
        code,
        kind: String(raw.kind || source || '').trim(),
        category: String(raw.category || source || '').trim(),
        owner: String(
            raw.owner || raw.recommendedOwner || raw.assignee || ''
        ).trim(),
        title,
        detail,
        severity,
        state,
        status: state,
        source: String(raw.source || source || 'workbench').trim(),
        commands: toList(
            raw.recommendedCommands || raw.commands || raw.actions
        ),
        docs: toList(raw.recommendedDocs || raw.docs || raw.references),
        notes: toList(raw.notes || raw.details),
        blockers: toList(raw.blockers || raw.issues || raw.findings),
        now: toList(raw.now),
        next: toList(raw.next),
        verify: toList(raw.verify),
        escalate: toList(raw.escalate),
    };
}

function flattenSourceEntries(source, label) {
    if (!source) {
        return [];
    }

    if (Array.isArray(source)) {
        return source.map((item, index) =>
            mapRawIncidentSeed(item, label, index)
        );
    }

    const objectValue = asObject(source);
    const preferredArrays = [
        objectValue.incidents,
        objectValue.journalEntries,
        objectValue.items,
        objectValue.entries,
        objectValue.records,
        objectValue.notes,
        objectValue.signals,
        objectValue.blockers,
    ].filter(Array.isArray);

    if (preferredArrays.length > 0) {
        return preferredArrays.flatMap((entry) =>
            entry.map((item, index) => mapRawIncidentSeed(item, label, index))
        );
    }

    if (
        objectValue.title ||
        objectValue.label ||
        objectValue.summary ||
        objectValue.detail ||
        objectValue.reason ||
        objectValue.id
    ) {
        return [mapRawIncidentSeed(objectValue, label, 0)];
    }

    return [];
}

function collectWorkbenchIncidentSeeds(
    snapshot,
    controlCenterModel,
    manifest = {}
) {
    const sources = [
        ['controlCenter', controlCenterModel?.incidents],
        ['controlCenterJournal', controlCenterModel?.journalEntries],
        ['releaseControlCenter', manifest?.turneroReleaseControlCenter],
        ['releaseControlCenter', manifest?.controlCenter],
        ['warRoom', manifest?.turneroReleaseWarRoom],
        ['warRoom', manifest?.warRoom],
        ['remoteReleaseReadiness', snapshot?.remoteReleaseReadiness?.items],
        ['publicShellDrift', snapshot?.publicShellDrift?.blockers],
        ['pilotReadiness', snapshot?.pilotReadiness?.goLiveIssues],
        ['localReadiness', snapshot?.localReadinessModel?.blockers],
        ['releaseEvidenceBundle', snapshot?.releaseEvidenceBundle?.incidents],
    ];

    return sources.flatMap(([label, source]) =>
        flattenSourceEntries(source, label)
    );
}

function dedupeWorkbenchSeeds(seeds) {
    const map = new Map();

    seeds.forEach((seed, index) => {
        const normalized = normalizeWorkbenchIncident(seed, index);
        const key = [
            normalized.id,
            normalized.code,
            normalized.owner,
            normalized.title,
            normalized.severity,
            normalized.status,
        ]
            .map((part) =>
                String(part || '')
                    .trim()
                    .toLowerCase()
            )
            .join('|');

        if (!map.has(key)) {
            map.set(key, normalized);
        }
    });

    return Array.from(map.values());
}

function resolveWorkbenchContext({ pilot, snapshot, manifest }) {
    const clinicProfile = asObject(
        snapshot?.turneroClinicProfile ||
            manifest?.turneroClinicProfile ||
            manifest?.clinicProfile ||
            getState()?.data?.turneroClinicProfile ||
            {}
    );
    const clinicId = String(
        pilot?.clinicId ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            'default-clinic'
    ).trim();
    const clinicName = String(
        pilot?.clinicName ||
            clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            'Piel en Armonia'
    ).trim();
    const baseUrl = String(
        clinicProfile?.branding?.base_url ||
            manifest?.baseUrl ||
            globalThis?.location?.origin ||
            ''
    ).trim();
    const releaseMode = String(
        pilot?.releaseMode || clinicProfile?.release?.mode || 'unknown'
    ).trim();

    return {
        clinicId,
        clinicName,
        baseUrl,
        releaseMode,
    };
}

function resolveWorkbenchTone(controlCenterModel, workbenchSnapshot) {
    const controlCenterTone = String(controlCenterModel?.tone || '').trim();
    if (controlCenterTone) {
        return controlCenterTone;
    }

    const summaries = toArray(workbenchSnapshot?.executionSummary);
    if (summaries.some((entry) => (entry?.counters?.blocked || 0) > 0)) {
        return 'alert';
    }

    if (
        summaries.some(
            (entry) =>
                (entry?.counters?.doing || 0) > 0 ||
                (entry?.counters?.todo || 0) > 0
        )
    ) {
        return 'warning';
    }

    return 'ready';
}

function buildWorkbenchModel({
    pilot = {},
    snapshot = {},
    manifest = {},
} = {}) {
    const controlCenterModel = (() => {
        try {
            return buildTurneroReleaseControlCenterModel(snapshot);
        } catch (_error) {
            return {
                incidents: [],
                journalEntries: [],
                summary: '',
                supportCopy: '',
                decision: 'review',
                tone: 'warning',
                clipboardSummary: '',
            };
        }
    })();
    const context = resolveWorkbenchContext({ pilot, snapshot, manifest });
    const executor = createIncidentExecutorStore({
        clinicId: context.clinicId,
    });
    const executorState = executor.read();
    const incidentSeeds = dedupeWorkbenchSeeds(
        collectWorkbenchIncidentSeeds(snapshot, controlCenterModel, manifest)
    );
    const workbenchSnapshot = buildOwnerWorkbenchSnapshot({
        incidents: incidentSeeds,
        context,
        executorState,
    });
    const clipboardBundle = buildWorkbenchClipboardBundle({
        snapshot: workbenchSnapshot,
        executorState,
    });

    return {
        ...workbenchSnapshot,
        context,
        clipboardBundle,
        controlCenterModel,
        executor,
        executorState,
        incidents: incidentSeeds,
        tone: resolveWorkbenchTone(controlCenterModel, workbenchSnapshot),
        summary:
            controlCenterModel.summary ||
            (incidentSeeds.length
                ? `${incidentSeeds.length} incidente(s) normalizado(s) para el workbench.`
                : 'No hay incidentes normalizados para el workbench.'),
        supportCopy:
            controlCenterModel.supportCopy ||
            'Usa este workbench para ajustar estados locales, handoffs y paquetes de comandos por owner.',
        decision: controlCenterModel.decision || 'review',
        clipboardSummary:
            controlCenterModel.clipboardSummary ||
            `Incident Execution Workbench · ${context.clinicName} · ${context.clinicId}`,
    };
}

function renderStateBadge(state, escapeHtmlImpl) {
    const label = STEP_STATE_LABELS[state] || state;
    return `<span class="admin-queue-incident-workbench__state-badge" data-state="${escapeHtml(
        state,
        escapeHtmlImpl
    )}">${escapeHtml(label, escapeHtmlImpl)}</span>`;
}

function renderOwnerCard(ownerBucket, escapeHtmlImpl) {
    const ownerText = buildOwnerRunbookText(ownerBucket);
    const previewTitles = ownerBucket.items
        .slice(0, 3)
        .map((item) => item.title)
        .filter(Boolean);
    const ownerId = safeIdPart(ownerBucket.owner);
    const summaryText = previewTitles.length
        ? previewTitles.join(' · ')
        : 'Sin incidentes asignados';

    return `
        <article
            class="admin-queue-incident-workbench__owner-card"
            data-owner="${escapeHtml(ownerBucket.owner, escapeHtmlImpl)}"
        >
            <div class="admin-queue-incident-workbench__owner-head">
                <div>
                    <p class="queue-app-card__eyebrow">Owner</p>
                    <h6 id="queueIncidentExecutionWorkbenchOwner_${escapeHtml(
                        ownerId,
                        escapeHtmlImpl
                    )}">${escapeHtml(ownerBucket.owner, escapeHtmlImpl)}</h6>
                </div>
                <span class="admin-queue-incident-workbench__owner-pill">
                    ${escapeHtml(String(ownerBucket.total), escapeHtmlImpl)}
                </span>
            </div>
            <p class="admin-queue-incident-workbench__owner-summary">
                ${escapeHtml(summaryText, escapeHtmlImpl)}
            </p>
            <div class="admin-queue-incident-workbench__owner-stats">
                <span>Críticos ${escapeHtml(
                    String(ownerBucket.critical),
                    escapeHtmlImpl
                )}</span>
                <span>Blocked ${escapeHtml(
                    String(ownerBucket.blocked),
                    escapeHtmlImpl
                )}</span>
            </div>
            <button
                id="queueIncidentExecutionWorkbenchCopyOwner_${escapeHtml(
                    ownerId,
                    escapeHtmlImpl
                )}"
                type="button"
                class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                data-workbench-action="copy-owner-runbook"
                data-owner="${escapeHtml(ownerBucket.owner, escapeHtmlImpl)}"
            >
                Copiar runbook
            </button>
            <pre class="admin-queue-incident-workbench__owner-preview">${escapeHtml(
                ownerText,
                escapeHtmlImpl
            )}</pre>
        </article>
    `;
}

function renderStepItem({
    playbook,
    incidentState,
    phase,
    stepText,
    index,
    escapeHtmlImpl,
}) {
    const stepKey = `${phase}:${index}`;
    const stepState =
        incidentState?.steps?.[stepKey]?.state || normalizeStateToken('todo');
    const stepStateId = `${safeIdPart(playbook.id)}_${phase}_${index}`;

    return `
        <li
            class="admin-queue-incident-workbench__step"
            data-state="${escapeHtml(stepState, escapeHtmlImpl)}"
            data-phase="${escapeHtml(phase, escapeHtmlImpl)}"
            data-step-index="${escapeHtml(String(index), escapeHtmlImpl)}"
        >
            <div class="admin-queue-incident-workbench__step-head">
                <strong>${escapeHtml(stepText, escapeHtmlImpl)}</strong>
                ${renderStateBadge(stepState, escapeHtmlImpl)}
            </div>
            <div class="admin-queue-incident-workbench__state-grid" role="group" aria-label="Estados de ejecución">
                ${STEP_STATE_ORDER.map(
                    (nextState) => `
                        <button
                            id="queueIncidentExecutionWorkbenchStep_${escapeHtml(
                                stepStateId,
                                escapeHtmlImpl
                            )}_${escapeHtml(nextState, escapeHtmlImpl)}"
                            type="button"
                            class="admin-queue-incident-workbench__state-toggle"
                            data-workbench-action="set-step-state"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                            data-phase="${escapeHtml(phase, escapeHtmlImpl)}"
                            data-step-index="${escapeHtml(
                                String(index),
                                escapeHtmlImpl
                            )}"
                            data-next-state="${escapeHtml(
                                nextState,
                                escapeHtmlImpl
                            )}"
                            aria-pressed="${stepState === nextState ? 'true' : 'false'}"
                        >
                            ${escapeHtml(STEP_STATE_LABELS[nextState], escapeHtmlImpl)}
                        </button>
                    `
                ).join('')}
            </div>
        </li>
    `;
}

function renderIncidentCard(playbook, incidentState, escapeHtmlImpl, index) {
    const incidentId = safeIdPart(playbook.id);
    const execution = incidentState || {};
    const notes = toArray(execution.notes);
    const openByDefault =
        index === 0 ||
        notes.length > 0 ||
        Object.keys(execution.steps || {}).length > 0 ||
        String(playbook.status).toLowerCase() === 'blocked';
    const counters = {
        todo: 0,
        doing: 0,
        blocked: 0,
        done: 0,
    };

    Object.values(execution.steps || {}).forEach((value) => {
        const state = normalizeStateToken(value?.state || 'todo');
        if (Object.prototype.hasOwnProperty.call(counters, state)) {
            counters[state] += 1;
        }
    });

    const notePreview = notes.length
        ? notes
              .slice(-2)
              .map(
                  (entry) =>
                      `<li><strong>${escapeHtml(
                          entry.author || 'admin',
                          escapeHtmlImpl
                      )}</strong><span>${escapeHtml(
                          entry.note,
                          escapeHtmlImpl
                      )}</span></li>`
              )
              .join('')
        : '<li><span>Sin notas aún.</span></li>';

    return `
        <details
            class="admin-queue-incident-workbench__incident"
            data-incident-id="${escapeHtml(playbook.id, escapeHtmlImpl)}"
            ${openByDefault ? 'open' : ''}
        >
            <summary class="admin-queue-incident-workbench__incident-summary">
                <div class="admin-queue-incident-workbench__incident-summary-copy">
                    <strong>${escapeHtml(playbook.title, escapeHtmlImpl)}</strong>
                    <span>${escapeHtml(playbook.code, escapeHtmlImpl)}</span>
                </div>
                <div class="admin-queue-incident-workbench__incident-summary-meta">
                    <span data-owner="${escapeHtml(
                        playbook.owner,
                        escapeHtmlImpl
                    )}">${escapeHtml(playbook.owner, escapeHtmlImpl)}</span>
                    <span data-severity="${escapeHtml(
                        playbook.severity,
                        escapeHtmlImpl
                    )}">${escapeHtml(playbook.severity, escapeHtmlImpl)}</span>
                    <span data-status="${escapeHtml(
                        playbook.status,
                        escapeHtmlImpl
                    )}">${escapeHtml(playbook.status, escapeHtmlImpl)}</span>
                </div>
                <div class="admin-queue-incident-workbench__incident-counters">
                    <span>${escapeHtml(String(counters.todo), escapeHtmlImpl)}</span>
                    <span>${escapeHtml(String(counters.doing), escapeHtmlImpl)}</span>
                    <span>${escapeHtml(String(counters.blocked), escapeHtmlImpl)}</span>
                    <span>${escapeHtml(String(counters.done), escapeHtmlImpl)}</span>
                </div>
            </summary>
            <div class="admin-queue-incident-workbench__incident-body">
                <p class="admin-queue-incident-workbench__incident-impact">
                    ${escapeHtml(playbook.impact, escapeHtmlImpl)}
                </p>
                <div class="admin-queue-incident-workbench__phase-grid">
                    ${['now', 'next', 'verify', 'escalate']
                        .map(
                            (phase) => `
                                <article class="admin-queue-incident-workbench__phase" data-phase="${escapeHtml(
                                    phase,
                                    escapeHtmlImpl
                                )}">
                                    <div class="admin-queue-incident-workbench__phase-head">
                                        <strong>${escapeHtml(
                                            phase.toUpperCase(),
                                            escapeHtmlImpl
                                        )}</strong>
                                        <span>${escapeHtml(
                                            String(
                                                playbook.steps?.[phase]
                                                    ?.length || 0
                                            ),
                                            escapeHtmlImpl
                                        )} paso(s)</span>
                                    </div>
                                    <ol class="admin-queue-incident-workbench__step-list">
                                        ${(playbook.steps?.[phase] || [])
                                            .map((stepText, stepIndex) =>
                                                renderStepItem({
                                                    playbook,
                                                    incidentState: execution,
                                                    phase,
                                                    stepText,
                                                    index: stepIndex,
                                                    escapeHtmlImpl,
                                                })
                                            )
                                            .join('')}
                                    </ol>
                                </article>
                            `
                        )
                        .join('')}
                </div>
                <div class="admin-queue-incident-workbench__command-pack">
                    <div class="admin-queue-incident-workbench__command-pack-head">
                        <strong>Command pack</strong>
                        <span>${escapeHtml(
                            playbook.commands?.title || 'Commands',
                            escapeHtmlImpl
                        )}</span>
                    </div>
                    <ul>
                        ${(playbook.commands?.commands || [])
                            .map(
                                (command) =>
                                    `<li><code>${escapeHtml(
                                        command,
                                        escapeHtmlImpl
                                    )}</code></li>`
                            )
                            .join('')}
                    </ul>
                </div>
                <div class="admin-queue-incident-workbench__note-shell">
                    <div class="admin-queue-incident-workbench__note-head">
                        <strong>Notas</strong>
                        <span>${escapeHtml(String(notes.length), escapeHtmlImpl)} guardada(s)</span>
                    </div>
                    <textarea
                        id="queueIncidentExecutionWorkbenchNote_${escapeHtml(
                            incidentId,
                            escapeHtmlImpl
                        )}"
                        class="admin-queue-incident-workbench__note-input"
                        data-workbench-note-for="${escapeHtml(
                            playbook.id,
                            escapeHtmlImpl
                        )}"
                        rows="4"
                        placeholder="Escribe un handoff breve, contexto de owner o siguiente paso..."
                    ></textarea>
                    <div class="admin-queue-incident-workbench__note-actions">
                        <button
                            type="button"
                            class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                            data-workbench-action="save-note"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                        >
                            Guardar nota
                        </button>
                        <button
                            type="button"
                            class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                            data-workbench-action="copy-incident-runbook"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                        >
                            Copiar runbook
                        </button>
                        <button
                            type="button"
                            class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                            data-workbench-action="copy-incident-handoff"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                        >
                            Copiar handoff
                        </button>
                        <button
                            type="button"
                            class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                            data-workbench-action="copy-incident-commands"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                        >
                            Copiar comandos
                        </button>
                        <button
                            type="button"
                            class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                            data-workbench-action="reset-incident"
                            data-incident-id="${escapeHtml(
                                playbook.id,
                                escapeHtmlImpl
                            )}"
                        >
                            Reset incidente
                        </button>
                    </div>
                    <ul class="admin-queue-incident-workbench__note-list">
                        ${notePreview}
                    </ul>
                </div>
            </div>
        </details>
    `;
}

function renderWorkbenchBody(model, escapeHtmlImpl) {
    const blockedCount = model.executionSummary.filter(
        (item) => (item.counters.blocked || 0) > 0
    ).length;
    const doingCount = model.executionSummary.filter(
        (item) => (item.counters.doing || 0) > 0
    ).length;
    const commandPackText = model.clipboardBundle.commandPackText;
    const ownerBoardText = model.clipboardBundle.ownerTexts
        .map((entry) => entry.text)
        .join('\n\n');
    const handoffText = model.clipboardBundle.incidentTexts
        .map((entry) => entry.text)
        .join('\n\n');

    return `
        <section
            id="queueIncidentExecutionWorkbench"
            class="admin-queue-incident-workbench"
            data-state="${escapeHtml(model.tone, escapeHtmlImpl)}"
            aria-labelledby="queueIncidentExecutionWorkbenchTitle"
            aria-live="polite"
        >
            <div class="admin-queue-incident-workbench__header">
                <div>
                    <p class="queue-app-card__eyebrow">Incident execution</p>
                    <h6 id="queueIncidentExecutionWorkbenchTitle">Incident Execution Workbench</h6>
                    <p id="queueIncidentExecutionWorkbenchSummary" class="admin-queue-incident-workbench__summary">
                        ${escapeHtml(model.summary, escapeHtmlImpl)}
                    </p>
                </div>
                <div class="admin-queue-incident-workbench__stats">
                    <span>Owners <strong>${escapeHtml(String(model.owners.length), escapeHtmlImpl)}</strong></span>
                    <span>Incidents <strong>${escapeHtml(String(model.commandPack.length), escapeHtmlImpl)}</strong></span>
                    <span>Blocked <strong>${escapeHtml(String(blockedCount), escapeHtmlImpl)}</strong></span>
                    <span>Doing <strong>${escapeHtml(String(doingCount), escapeHtmlImpl)}</strong></span>
                </div>
            </div>
            <p id="queueIncidentExecutionWorkbenchSupport" class="admin-queue-incident-workbench__support">
                ${escapeHtml(model.supportCopy, escapeHtmlImpl)}
            </p>
            <div class="admin-queue-incident-workbench__actions">
                <button
                    id="queueIncidentExecutionWorkbenchCopyBoardBtn"
                    type="button"
                    class="queue-ops-pilot__action queue-ops-pilot__action--primary admin-queue-incident-workbench__action"
                    data-workbench-action="copy-board"
                    ${ownerBoardText ? '' : 'disabled'}
                >
                    Copiar board
                </button>
                <button
                    id="queueIncidentExecutionWorkbenchCopyHandoffBtn"
                    type="button"
                    class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                    data-workbench-action="copy-handoff"
                    ${handoffText ? '' : 'disabled'}
                >
                    Copiar handoff
                </button>
                <button
                    id="queueIncidentExecutionWorkbenchCopyCommandsBtn"
                    type="button"
                    class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                    data-workbench-action="copy-commands"
                    ${commandPackText ? '' : 'disabled'}
                >
                    Copiar comandos
                </button>
                <button
                    id="queueIncidentExecutionWorkbenchDownloadBtn"
                    type="button"
                    class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                    data-workbench-action="download-json"
                >
                    Export JSON
                </button>
                <button
                    id="queueIncidentExecutionWorkbenchResetBtn"
                    type="button"
                    class="queue-ops-pilot__action admin-queue-incident-workbench__action"
                    data-workbench-action="reset-clinic"
                >
                    Reset clinic
                </button>
            </div>
            <div
                id="queueIncidentExecutionWorkbenchOwnerBoard"
                class="admin-queue-incident-workbench__board"
                role="list"
                aria-label="Board por owner"
            >
                ${
                    model.owners.length
                        ? model.owners
                              .map((ownerBucket) =>
                                  renderOwnerCard(ownerBucket, escapeHtmlImpl)
                              )
                              .join('')
                        : `
                            <article class="admin-queue-incident-workbench__empty">
                                <strong>Sin owners normalizados</strong>
                                <p>No se encontraron incidentes para construir el board. Usa el control center o la evidencia remota para poblar el workbench.</p>
                            </article>
                        `
                }
            </div>
            <div
                id="queueIncidentExecutionWorkbenchAccordion"
                class="admin-queue-incident-workbench__accordion"
            >
                ${
                    model.owners.length
                        ? model.owners
                              .flatMap((ownerBucket) => ownerBucket.items)
                              .map((playbook, index) =>
                                  renderIncidentCard(
                                      playbook,
                                      model.executorState.incidents?.[
                                          playbook.id
                                      ] || {},
                                      escapeHtmlImpl,
                                      index
                                  )
                              )
                              .join('')
                        : `
                            <article class="admin-queue-incident-workbench__empty">
                                <strong>Sin incidentes</strong>
                                <p>Cuando aparezcan incidentes normalizados, aquí verás el acordeón con steps, notas, handoff y comandos.</p>
                            </article>
                        `
                }
            </div>
            <details class="admin-queue-incident-workbench__clipboard">
                <summary>Bundle de clipboard</summary>
                <pre>${escapeHtml(ownerBoardText || 'Sin board para copiar.', escapeHtmlImpl)}</pre>
                <pre>${escapeHtml(handoffText || 'Sin handoff para copiar.', escapeHtmlImpl)}</pre>
                <pre>${escapeHtml(commandPackText || 'Sin comandos para copiar.', escapeHtmlImpl)}</pre>
            </details>
            <p id="queueIncidentExecutionWorkbenchFooter" class="admin-queue-incident-workbench__footer">
                Storage: <code>${escapeHtml(model.executor.key, escapeHtmlImpl)}</code> · Export: <code>${escapeHtml(
                    `${safeIdPart(model.clinicId)}-${String(model.generatedAt).slice(0, 10).replaceAll('-', '')}.json`,
                    escapeHtmlImpl
                )}</code> · Decision: <strong>${escapeHtml(model.decision, escapeHtmlImpl)}</strong>
            </p>
        </section>
    `;
}

function findTextareaForIncident(section, incidentId) {
    return Array.from(
        section.querySelectorAll('textarea[data-workbench-note-for]')
    ).find((textarea) => textarea.dataset.workbenchNoteFor === incidentId);
}

function bindWorkbenchActions(section, model, parts, options = {}) {
    const host = section.parentElement;
    const refresh = () => {
        if (host instanceof HTMLElement) {
            mountQueueIncidentExecutionWorkbenchCard(host, parts, options);
        }
    };

    section.onclick = async (event) => {
        const button =
            event.target instanceof Element
                ? event.target.closest('button[data-workbench-action]')
                : null;

        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const action = String(button.dataset.workbenchAction || '').trim();
        const incidentId = String(button.dataset.incidentId || '').trim();

        if (action === 'copy-board') {
            await copyToClipboardSafe(
                model.clipboardBundle.ownerTexts
                    .map((entry) => entry.text)
                    .join('\n\n')
            );
            return;
        }

        if (action === 'copy-handoff') {
            await copyToClipboardSafe(
                model.clipboardBundle.incidentTexts
                    .map((entry) => entry.text)
                    .join('\n\n')
            );
            return;
        }

        if (action === 'copy-commands') {
            await copyToClipboardSafe(model.clipboardBundle.commandPackText);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot(
                `${safeIdPart(model.clinicId)}-${String(model.generatedAt)
                    .slice(0, 10)
                    .replaceAll('-', '')}.json`,
                model.executor.exportPack({
                    playbooks: model.commandPack,
                    context: model.context,
                })
            );
            return;
        }

        if (action === 'reset-clinic') {
            try {
                if (globalThis?.localStorage) {
                    globalThis.localStorage.removeItem(model.executor.key);
                } else {
                    model.executor.write({
                        incidents: {},
                        updatedAt: new Date().toISOString(),
                    });
                }
            } catch (_error) {
                model.executor.write({
                    incidents: {},
                    updatedAt: new Date().toISOString(),
                });
            }
            refresh();
            return;
        }

        if (action === 'save-note') {
            const textarea = findTextareaForIncident(section, incidentId);
            const note =
                textarea instanceof HTMLTextAreaElement ? textarea.value : '';
            model.executor.appendNote({
                incidentId,
                note,
                author: 'admin',
            });
            refresh();
            return;
        }

        if (action === 'reset-incident') {
            model.executor.resetIncident(incidentId);
            refresh();
            return;
        }

        if (action === 'copy-owner-runbook') {
            const owner = String(button.dataset.owner || '').trim();
            const ownerBucket = model.owners.find(
                (entry) => entry.owner === owner
            );
            if (ownerBucket) {
                await copyToClipboardSafe(buildOwnerRunbookText(ownerBucket));
            }
            return;
        }

        if (action === 'copy-incident-runbook') {
            const playbook = model.owners
                .flatMap((ownerBucket) => ownerBucket.items)
                .find((entry) => entry.id === incidentId);
            if (playbook) {
                await copyToClipboardSafe(
                    buildOwnerRunbookText({
                        owner: playbook.owner,
                        total: 1,
                        critical:
                            String(playbook.severity).toLowerCase() ===
                            'critical'
                                ? 1
                                : 0,
                        blocked:
                            String(playbook.status).toLowerCase() === 'blocked'
                                ? 1
                                : 0,
                        items: [playbook],
                    })
                );
            }
            return;
        }

        if (action === 'copy-incident-handoff') {
            const playbook = model.owners
                .flatMap((ownerBucket) => ownerBucket.items)
                .find((entry) => entry.id === incidentId);
            if (playbook) {
                await copyToClipboardSafe(
                    buildIncidentHandoffText({
                        playbook,
                        incidentState:
                            model.executorState.incidents?.[playbook.id] || {},
                    })
                );
            }
            return;
        }

        if (action === 'copy-incident-commands') {
            const playbook = model.owners
                .flatMap((ownerBucket) => ownerBucket.items)
                .find((entry) => entry.id === incidentId);
            if (playbook) {
                await copyToClipboardSafe(
                    (playbook.commands?.commands || []).join('\n')
                );
            }
            return;
        }

        if (action === 'set-step-state') {
            const phase = String(button.dataset.phase || '').trim();
            const index = Number(button.dataset.stepIndex || 0);
            const nextState = normalizeStateToken(button.dataset.nextState);

            model.executor.setStepState({
                incidentId,
                lane: phase,
                index,
                nextState,
            });
            refresh();
        }
    };

    section.onkeydown = (event) => {
        if (
            !(event.target instanceof HTMLTextAreaElement) ||
            !event.target.dataset.workbenchNoteFor
        ) {
            return;
        }

        if (!event.ctrlKey || event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        const saveButton = Array.from(
            section.querySelectorAll(
                'button[data-workbench-action="save-note"]'
            )
        ).find(
            (button) =>
                button instanceof HTMLButtonElement &&
                button.dataset.incidentId ===
                    event.target.dataset.workbenchNoteFor
        );
        if (saveButton instanceof HTMLButtonElement) {
            saveButton.click();
        }
    };
}

export function mountQueueIncidentExecutionWorkbenchCard(
    target,
    parts = {},
    options = {}
) {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    try {
        const model = buildWorkbenchModel(parts);
        const escapeHtmlImpl =
            typeof options.escapeHtml === 'function'
                ? options.escapeHtml
                : escapeHtmlFallback;
        target.innerHTML = renderWorkbenchBody(model, escapeHtmlImpl);

        const section = target.querySelector(
            '#queueIncidentExecutionWorkbench'
        );
        if (section instanceof HTMLElement) {
            section.__turneroIncidentWorkbenchModel = model;
            bindWorkbenchActions(section, model, parts, options);
            return section;
        }
    } catch (_error) {
        target.innerHTML = `
            <section class="admin-queue-incident-workbench admin-queue-incident-workbench--empty" aria-live="polite">
                <div class="admin-queue-incident-workbench__empty">
                    <strong>Incident Execution Workbench</strong>
                    <p>No fue posible montar el workbench en este momento.</p>
                </div>
            </section>
        `;
    }

    return null;
}
