import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import {
    buildTurneroBulkClipboardText,
    buildTurneroBulkOperationBundle,
    filterTurneroBulkSelection,
} from './turnero-release-bulk-operations.js';
import {
    buildTurneroOwnerAutomationBoard,
    buildTurneroOwnerAutomationMarkdown,
} from './turnero-release-owner-automation.js';
import {
    buildTurneroReleaseEvidenceMarkdown,
    buildTurneroReleaseEvidencePack,
    buildTurneroOwnerEvidenceMarkdown,
    buildTurneroIncidentEvidenceMarkdown,
} from './turnero-release-evidence-pack-factory.js';
import {
    buildTurneroReleaseRecheckPlan,
    createTurneroReleaseRecheckQueueStore,
} from './turnero-release-recheck-queue.js';

function ensureDocument() {
    return typeof document !== 'undefined' ? document : null;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        const doc = ensureDocument();
        if (!doc) return null;
        return doc.querySelector(target) || doc.getElementById(target);
    }

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function getClinicProfile(parts = {}) {
    return asObject(
        parts.clinicProfile ||
            parts.releaseControlCenterSnapshot?.turneroClinicProfile ||
            parts.releaseControlCenterSnapshot?.clinicProfile ||
            parts.snapshot?.turneroClinicProfile ||
            parts.snapshot?.clinicProfile ||
            {}
    );
}

function getBaseUrl(parts = {}, options = {}, clinicProfile = {}) {
    return toText(
        options.baseUrl ||
            parts.baseUrl ||
            clinicProfile?.branding?.base_url ||
            clinicProfile?.branding?.baseUrl ||
            clinicProfile?.baseUrl ||
            globalThis?.location?.origin ||
            ''
    );
}

function ownerCardsHtml(model) {
    return model.ownerBoard.owners
        .map((owner) => {
            const tasks = owner.queueTasks || [];
            const actions = owner.nextActions || [];
            return `
                <article class="queue-ops-pilot__issues-item queue-ops-pilot__automation-owner-card" data-owner="${escapeHtml(
                    owner.owner
                )}" data-state="${escapeHtml(owner.priority)}">
                    <div class="queue-ops-pilot__issues-item-head">
                        <strong>${escapeHtml(owner.label || owner.owner)}</strong>
                        <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                            owner.stage || 'stable'
                        )}</span>
                    </div>
                    <p>${escapeHtml(owner.focus || owner.note || 'Sin foco definido')}</p>
                    <div class="queue-ops-pilot__chips">
                        <span class="queue-ops-pilot__chip">B ${escapeHtml(String(owner.summary?.blocker || 0))}</span>
                        <span class="queue-ops-pilot__chip">W ${escapeHtml(String(owner.summary?.warning || 0))}</span>
                        <span class="queue-ops-pilot__chip">I ${escapeHtml(String(owner.summary?.info || 0))}</span>
                        <span class="queue-ops-pilot__chip">Queue ${escapeHtml(String(tasks.length))}</span>
                    </div>
                    <div class="queue-ops-pilot__actions queue-ops-pilot__automation-owner-actions">
                        <button type="button" data-owner-action="copy-owner" data-owner="${escapeHtml(owner.owner)}">Copiar owner</button>
                        <button type="button" data-owner-action="copy-evidence" data-owner="${escapeHtml(owner.owner)}">Copiar evidencia owner</button>
                        <button type="button" data-owner-action="copy-tasks" data-owner="${escapeHtml(owner.owner)}">Copiar tareas owner</button>
                    </div>
                    <div class="queue-ops-pilot__automation-owner-actions-list">
                        ${
                            actions.length
                                ? actions
                                      .map(
                                          (action) => `
                                            <article class="queue-ops-pilot__smoke-item">
                                                <div class="queue-ops-pilot__smoke-item-head">
                                                    <strong>${escapeHtml(action.label)}</strong>
                                                    <span class="queue-ops-pilot__smoke-item-badge">${escapeHtml(action.kind)}</span>
                                                </div>
                                                <p>${escapeHtml(action.detail || 'Sin detalle')}</p>
                                            </article>
                                        `
                                      )
                                      .join('')
                                : '<p class="queue-ops-pilot__smoke-support">Sin acciones sugeridas.</p>'
                        }
                    </div>
                    <div class="queue-ops-pilot__automation-task-list">
                        ${
                            tasks.length
                                ? tasks
                                      .map(
                                          (task) => `
                                            <article class="queue-ops-pilot__handoff-item" data-task-id="${escapeHtml(task.id)}" data-state="${escapeHtml(task.status)}">
                                                <strong>${escapeHtml(task.title)}</strong>
                                                <p>${escapeHtml(task.kind)} · ${escapeHtml(task.severity)} · ${escapeHtml(task.recommendedWindow)}</p>
                                                <div class="queue-ops-pilot__actions queue-ops-pilot__automation-task-actions">
                                                    <button type="button" data-task-action="running" data-task-id="${escapeHtml(task.id)}">Run</button>
                                                    <button type="button" data-task-action="done" data-task-id="${escapeHtml(task.id)}">Done</button>
                                                    <button type="button" data-task-action="failed" data-task-id="${escapeHtml(task.id)}">Fail</button>
                                                    <button type="button" data-task-action="skipped" data-task-id="${escapeHtml(task.id)}">Skip</button>
                                                    <button type="button" data-task-action="note" data-task-id="${escapeHtml(task.id)}">Note</button>
                                                </div>
                                            </article>
                                        `
                                      )
                                      .join('')
                                : '<p class="queue-ops-pilot__smoke-support">Sin tareas filtradas.</p>'
                        }
                    </div>
                </article>
            `;
        })
        .join('');
}

function incidentCardsHtml(model) {
    return model.incidentPacks
        .map(
            (incident) => `
                <article class="queue-ops-pilot__issues-item queue-ops-pilot__automation-incident-card" data-incident-id="${escapeHtml(
                    incident.incidentId
                )}" data-state="${escapeHtml(incident.severity)}">
                    <div class="queue-ops-pilot__issues-item-head">
                        <strong>${escapeHtml(incident.title)}</strong>
                        <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                            incident.severity
                        )}</span>
                    </div>
                    <p>${escapeHtml(incident.detail || 'Sin detalle')}</p>
                    <div class="queue-ops-pilot__actions">
                        <button type="button" data-incident-action="copy-incident" data-incident-id="${escapeHtml(
                            incident.incidentId
                        )}">Copiar incidente</button>
                    </div>
                </article>
            `
        )
        .join('');
}

function staleOwnersHtml(model) {
    if (!model.ownerBoard.staleOwners.length) {
        return '<p class="queue-ops-pilot__smoke-support">No hay owners stale.</p>';
    }

    return `
        <div class="queue-ops-pilot__automation-stale-list">
            ${model.ownerBoard.staleOwners
                .map(
                    (owner) => `
                        <article class="queue-ops-pilot__lane" data-state="warning">
                            <span>${escapeHtml(owner.label || owner.owner)}</span>
                            <strong>${escapeHtml(owner.nextWindow || 'Monitor')}</strong>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

export function buildTurneroReleaseAutomationMeshModel(
    parts = {},
    options = {}
) {
    const clinicProfile = getClinicProfile(parts);
    const baseUrl = getBaseUrl(parts, options, clinicProfile);
    const controlCenterSnapshot =
        parts.releaseControlCenterSnapshot ||
        parts.controlCenterSnapshot ||
        parts.snapshot ||
        {};
    const evidencePack = buildTurneroReleaseEvidencePack(
        {
            ...parts,
            releaseControlCenterSnapshot: controlCenterSnapshot,
            clinicProfile,
        },
        {
            ...options,
            baseUrl,
        }
    );
    const globalPack = evidencePack.globalPack;
    const ownerPacks = toArray(evidencePack.ownerPacks);
    const incidentPacks = toArray(evidencePack.incidentPacks);
    const queueStore = createTurneroReleaseRecheckQueueStore({
        clinicId: globalPack.clinicId,
        storage: options.storage,
    });
    const queueSnapshot = globalPack.recheckQueueSnapshot?.tasks?.length
        ? globalPack.recheckQueueSnapshot
        : queueStore.read();
    const recheckPlan =
        globalPack.recheckPlan ||
        buildTurneroReleaseRecheckPlan({
            clinicId: globalPack.clinicId,
            incidents: incidentPacks.length
                ? incidentPacks
                : globalPack.ownerBoard?.lanes || [],
            owners: ownerPacks.length
                ? ownerPacks
                : globalPack.ownerBoard?.lanes || [],
            decision: globalPack.decision,
            profileFingerprint: globalPack.profileFingerprint,
            releaseMode: globalPack.releaseMode,
            baseUrl,
            generatedAt: globalPack.generatedAt,
            queueSnapshot,
        });
    const activeQueue =
        Array.isArray(queueSnapshot.tasks) && queueSnapshot.tasks.length
            ? queueSnapshot
            : recheckPlan;
    const ownerBoard = buildTurneroOwnerAutomationBoard({
        owners: ownerPacks.length
            ? ownerPacks
            : globalPack.ownerBoard?.lanes || [],
        incidents: incidentPacks.length
            ? incidentPacks
            : globalPack.ownerBoard?.lanes || [],
        queueSnapshot: activeQueue,
        ownerState: asObject(
            globalPack.releaseWarRoomSnapshot?.ownerState ||
                parts.releaseWarRoomSnapshot?.ownerState ||
                {}
        ),
        executorState: globalPack.incidentExecutorState,
        journalEntries: globalPack.incidentJournalEntries,
        commandDeck: globalPack.releaseCommandDeckSnapshot,
        decision: globalPack.decision,
        profileFingerprint: globalPack.profileFingerprint,
        releaseMode: globalPack.releaseMode,
        baseUrl,
        clinicId: globalPack.clinicId,
    });
    const bulkBundle = buildTurneroBulkOperationBundle({
        board: ownerBoard,
        evidencePack,
        queueSnapshot: activeQueue,
    });
    const selection = normalizeSelection(options.selection || {});
    const filteredBundle = filterTurneroBulkSelection(bulkBundle, selection);

    return {
        clinicProfile,
        baseUrl,
        decision: globalPack.decision,
        generatedAt: globalPack.generatedAt,
        controlCenterSnapshot,
        evidencePack,
        globalPack,
        queueStore,
        queueSnapshot: activeQueue,
        recheckPlan,
        ownerBoard,
        bulkBundle,
        filteredBundle,
        selection,
        staleOwners: ownerBoard.staleOwners,
        queueMarkdown: buildTurneroBulkClipboardText(bulkBundle, selection),
        boardMarkdown: buildTurneroOwnerAutomationMarkdown(ownerBoard),
        evidenceMarkdown: buildTurneroReleaseEvidenceMarkdown(evidencePack),
    };
}

function normalizeSelection(selection = {}) {
    return {
        owner:
            toText(selection.owner || 'all')
                .trim()
                .toLowerCase() || 'all',
        severity:
            toText(selection.severity || 'all')
                .trim()
                .toLowerCase() || 'all',
        kind:
            toText(selection.kind || 'all')
                .trim()
                .toLowerCase() || 'all',
    };
}

function renderRootHtml(model) {
    return `
        <section class="queue-ops-pilot__automation-mesh" data-state="${escapeHtml(
            model.decision || 'review'
        )}">
            <header class="queue-ops-pilot__issues-head queue-ops-pilot__automation-mesh-head">
                <div>
                    <p class="queue-app-card__eyebrow">Release Automation Mesh</p>
                    <h6>Consola de rechecks y evidence packs</h6>
                    <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                        model.globalPack.clinicName || 'Turnero'
                    )}</p>
                </div>
                <div class="queue-ops-pilot__automation-mesh-meta">
                    <span>Decision: ${escapeHtml(model.decision || 'review')}</span>
                    <span>Fingerprint: ${escapeHtml(
                        model.globalPack.profileFingerprint || 'unknown'
                    )}</span>
                    <span>Rechecks: ${escapeHtml(
                        String(model.queueSnapshot.tasks.length)
                    )}</span>
                </div>
            </header>

            <div class="queue-ops-pilot__actions queue-ops-pilot__automation-mesh-actions">
                <button type="button" data-mesh-action="build-rechecks">Construir rechecks</button>
                <button type="button" data-mesh-action="copy-queue">Copiar cola</button>
                <button type="button" data-mesh-action="copy-board">Copiar board</button>
                <button type="button" data-mesh-action="copy-evidence">Copiar evidencia global</button>
                <button type="button" data-mesh-action="download-pack">Descargar pack</button>
                <button type="button" data-mesh-action="clear-queue">Limpiar cola</button>
            </div>

            <div class="queue-ops-pilot__automation-filters">
                <label>
                    Owner
                    <select data-mesh-filter="owner">
                        ${model.bulkBundle.selectionOptions.owners
                            .map(
                                (owner) => `
                                    <option value="${escapeHtml(owner)}" ${owner === model.selection.owner ? 'selected' : ''}>${escapeHtml(owner)}</option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
                <label>
                    Severity
                    <select data-mesh-filter="severity">
                        ${model.bulkBundle.selectionOptions.severities
                            .map(
                                (severity) => `
                                    <option value="${escapeHtml(severity)}" ${severity === model.selection.severity ? 'selected' : ''}>${escapeHtml(severity)}</option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
                <label>
                    Kind
                    <select data-mesh-filter="kind">
                        ${model.bulkBundle.selectionOptions.kinds
                            .map(
                                (kind) => `
                                    <option value="${escapeHtml(kind)}" ${kind === model.selection.kind ? 'selected' : ''}>${escapeHtml(kind)}</option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
            </div>

            <section class="queue-ops-pilot__issues">
                <div class="queue-ops-pilot__issues-head">
                    <div>
                        <p class="queue-app-card__eyebrow">Stale owners</p>
                        <h6>Prioridad de seguimiento</h6>
                    </div>
                    <span class="queue-ops-pilot__issues-status" data-state="${escapeHtml(
                        model.staleOwners.length ? 'warning' : 'ready'
                    )}">${escapeHtml(String(model.staleOwners.length))}</span>
                </div>
                ${staleOwnersHtml(model)}
            </section>

            <section class="queue-ops-pilot__issues">
                <div class="queue-ops-pilot__issues-head">
                    <div>
                        <p class="queue-app-card__eyebrow">Owners</p>
                        <h6>Board y tareas</h6>
                    </div>
                    <span class="queue-ops-pilot__issues-status" data-state="ready">${escapeHtml(
                        String(
                            model.filteredBundle.summary?.selectedOwners ??
                                model.ownerBoard.owners.length
                        )
                    )}</span>
                </div>
                <div class="queue-ops-pilot__automation-owner-grid">
                    ${ownerCardsHtml({
                        ...model,
                        ownerBoard: {
                            ...model.ownerBoard,
                            owners: model.filteredBundle.owners,
                        },
                    })}
                </div>
            </section>

            <section class="queue-ops-pilot__issues">
                <div class="queue-ops-pilot__issues-head">
                    <div>
                        <p class="queue-app-card__eyebrow">Incidents</p>
                        <h6>Evidence packs</h6>
                    </div>
                    <span class="queue-ops-pilot__issues-status" data-state="ready">${escapeHtml(
                        String(
                            model.filteredBundle.summary?.selectedIncidents ??
                                model.evidencePack.incidentPacks.length
                        )
                    )}</span>
                </div>
                <div class="queue-ops-pilot__automation-incident-grid">
                    ${incidentCardsHtml({
                        ...model,
                        incidentPacks: model.filteredBundle.incidents,
                    })}
                </div>
            </section>

            <details class="queue-ops-pilot__smoke">
                <summary>Evidence completa</summary>
                <pre class="queue-ops-pilot__automation-pre">${escapeHtml(
                    model.evidenceMarkdown
                )}</pre>
            </details>
        </section>
    `;
}

function bindTaskActions(host, store, rerender) {
    host.querySelectorAll('[data-task-action]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', () => {
            const action = button.getAttribute('data-task-action');
            const taskId = button.getAttribute('data-task-id') || '';

            if (!taskId) {
                return;
            }

            if (action === 'running') {
                store.markRunning(taskId);
            } else if (action === 'done') {
                store.markDone(taskId);
            } else if (action === 'failed') {
                store.markFailed(taskId);
            } else if (action === 'skipped') {
                store.markSkipped(taskId);
            } else if (action === 'note') {
                const note =
                    typeof prompt === 'function'
                        ? prompt('Nota para la tarea')
                        : '';
                if (note) {
                    store.appendNote(taskId, note);
                }
            }

            rerender();
        });
    });
}

function bindOwnerActions(host, model, rerender) {
    host.querySelectorAll('[data-owner-action]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', async () => {
            const owner = button.getAttribute('data-owner') || 'unknown';
            const ownerPack =
                model.evidencePack.ownerPacks.find(
                    (item) => item.owner === owner
                ) || null;

            if (!ownerPack) {
                return;
            }

            const action = button.getAttribute('data-owner-action');
            if (action === 'copy-owner') {
                await copyToClipboardSafe(
                    buildTurneroOwnerEvidenceMarkdown(ownerPack)
                );
            } else if (action === 'copy-evidence') {
                await copyToClipboardSafe(
                    buildTurneroOwnerEvidenceMarkdown(ownerPack)
                );
            } else if (action === 'copy-tasks') {
                await copyToClipboardSafe(
                    ownerPack.queueTasks.length
                        ? ownerPack.queueTasks
                              .map(
                                  (task) =>
                                      `- [${task.status}] ${task.title} (${task.kind}, ${task.recommendedWindow})`
                              )
                              .join('\n')
                        : '- sin tareas'
                );
            }

            rerender();
        });
    });
}

function bindIncidentActions(host, model, rerender) {
    host.querySelectorAll('[data-incident-action]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', async () => {
            const incidentId = button.getAttribute('data-incident-id') || '';
            const incidentPack =
                model.evidencePack.incidentPacks.find(
                    (item) => item.incidentId === incidentId
                ) || null;

            if (!incidentPack) {
                return;
            }

            if (
                button.getAttribute('data-incident-action') === 'copy-incident'
            ) {
                await copyToClipboardSafe(
                    buildTurneroIncidentEvidenceMarkdown(incidentPack)
                );
            }

            rerender();
        });
    });
}

function bindMeshActions(host, store, model, rerender) {
    const filters = {
        owner: host.querySelector('[data-mesh-filter="owner"]'),
        severity: host.querySelector('[data-mesh-filter="severity"]'),
        kind: host.querySelector('[data-mesh-filter="kind"]'),
    };

    Object.values(filters).forEach((select) => {
        if (!(select instanceof HTMLSelectElement)) {
            return;
        }

        select.addEventListener('change', () => {
            rerender({
                owner: toText(filters.owner?.value || 'all'),
                severity: toText(filters.severity?.value || 'all'),
                kind: toText(filters.kind?.value || 'all'),
            });
        });
    });

    host.querySelectorAll('[data-mesh-action]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        button.addEventListener('click', async () => {
            const action = button.getAttribute('data-mesh-action');
            if (action === 'build-rechecks') {
                store.enqueue(model.recheckPlan.tasks, {
                    source: 'release-automation-mesh',
                    profileFingerprint: model.globalPack.profileFingerprint,
                    releaseMode: model.globalPack.releaseMode,
                    baseUrl: model.baseUrl,
                });
            } else if (action === 'copy-queue') {
                await copyToClipboardSafe(model.queueMarkdown);
            } else if (action === 'copy-board') {
                await copyToClipboardSafe(model.boardMarkdown);
            } else if (action === 'copy-evidence') {
                await copyToClipboardSafe(model.evidenceMarkdown);
            } else if (action === 'download-pack') {
                downloadJsonSnapshot(
                    `${model.globalPack.clinicId || 'turnero'}-release-automation-mesh.json`,
                    {
                        ...model.evidencePack,
                        boardMarkdown: model.boardMarkdown,
                        queueMarkdown: model.queueMarkdown,
                        evidenceMarkdown: model.evidenceMarkdown,
                    }
                );
            } else if (action === 'clear-queue') {
                store.clear();
            }

            rerender();
        });
    });

    bindTaskActions(host, store, () => rerender());
    bindOwnerActions(host, model, () => rerender());
    bindIncidentActions(host, model, () => rerender());
}

export function renderTurneroReleaseAutomationMesh(
    target,
    parts = {},
    options = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const clinicProfile = getClinicProfile(parts);
    let currentSelection = normalizeSelection(options.selection || {});
    const store = createTurneroReleaseRecheckQueueStore({
        clinicId:
            options.clinicId ||
            parts.clinicId ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            'default-clinic',
        storage: options.storage,
    });

    const rerender = (selectionOverride) => {
        if (selectionOverride) {
            currentSelection = normalizeSelection({
                ...currentSelection,
                ...selectionOverride,
            });
        }

        const model = buildTurneroReleaseAutomationMeshModel(parts, {
            ...options,
            selection: currentSelection,
            storage: options.storage,
            baseUrl: getBaseUrl(parts, options, clinicProfile),
        });
        host.innerHTML = renderRootHtml(model);
        bindMeshActions(host, store, model, rerender);
        return model;
    };

    return rerender();
}

export function mountTurneroReleaseAutomationMesh(
    target,
    parts = {},
    options = {}
) {
    return renderTurneroReleaseAutomationMesh(target, parts, options);
}

export default buildTurneroReleaseAutomationMeshModel;
