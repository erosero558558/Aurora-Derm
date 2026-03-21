import {
    asObject,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { loadTurneroSurfaceRegistrySource } from './turnero-surface-registry-source.js';
import { createTurneroSurfaceHandoffLedger } from './turnero-surface-handoff-ledger.js';
import {
    buildTurneroSurfaceReleaseSyncPack,
    formatTurneroSurfaceReleaseSyncPackBrief,
} from './turnero-surface-release-sync-pack.js';
import {
    buildTurneroSurfaceSmokeReadout,
    formatTurneroSurfaceSmokeReadoutBrief,
} from './turnero-surface-smoke-readout.js';
import { createTurneroSurfaceSmokeEvidenceStore } from './turnero-surface-smoke-evidence-store.js';
import { buildTurneroSurfaceSyncReadout } from './turnero-surface-sync-readout.js';
import { buildTurneroSurfaceReleaseTruthPack } from './turnero-surface-release-truth.js';
import {
    copyToClipboardSafe,
    downloadJsonSnapshot as downloadJsonSnapshotSafe,
} from './turnero-release-control-center.js';

const DEFAULT_SURFACES_URL = '/data/turnero-surfaces.json';
const DEFAULT_MANIFEST_URL = '/release-manifest.json';

function getScope(input = {}) {
    return toString(
        input.scope ||
            input.clinicProfile?.clinic_id ||
            input.clinicProfile?.clinicId ||
            'global',
        'global'
    );
}

function getRegistryOptions(input = {}) {
    return {
        surfacesUrl: toString(input.surfacesUrl, DEFAULT_SURFACES_URL),
        manifestUrl: toString(input.manifestUrl, DEFAULT_MANIFEST_URL),
        fallbackManifestUrl: toString(
            input.fallbackManifestUrl,
            '/app-downloads/pilot/release-manifest.json'
        ),
        refresh: input.refresh === true,
    };
}

function flattenSurfaceHandoffs(surfacePacks = []) {
    const deduped = new Map();

    toArray(surfacePacks).forEach((item) => {
        [
            ...toArray(item?.remoteHandoffs),
            ...toArray(item?.pack?.handoffs),
        ].forEach((handoff) => {
            if (!handoff || typeof handoff !== 'object') {
                return;
            }

            const dedupeKey = [
                toString(handoff.id, ''),
                toString(handoff.surfaceKey, ''),
                toString(handoff.source, ''),
                toString(handoff.note, ''),
            ].join('::');
            if (!deduped.has(dedupeKey)) {
                deduped.set(dedupeKey, handoff);
            }
        });
    });

    return Array.from(deduped.values());
}

function buildSurfacePacksFromTruthPack(truthPack = {}) {
    return toArray(truthPack.rows).map((row) => ({
        label: row.label || row.surfaceKey || row.surfaceId || 'surface',
        surfaceKey: row.surfaceKey || row.surfaceId || 'surface',
        remoteHandoffs: [],
        pack: buildTurneroSurfaceReleaseSyncPack({
            surfaceKey: row.surfaceKey || row.surfaceId || 'surface',
            queueVersion: row.manifestVersion || '',
            visibleTurn: '',
            announcedTurn: '',
            handoffState: row.releaseState === 'degraded' ? 'open' : 'clear',
            heartbeat: {
                state: row.runtimeState === 'degraded' ? 'warning' : 'ready',
                channel: 'browser',
            },
            updatedAt: new Date().toISOString(),
            expectedVisibleTurn: '',
            expectedQueueVersion: row.manifestVersion || '',
            handoffs: [],
            registry: truthPack.registry || {},
            truthPack,
        }).syncPack || {
            surfaceKey: row.surfaceKey || row.surfaceId || 'surface',
            queueVersion: row.manifestVersion || '',
            visibleTurn: '',
            announcedTurn: '',
            handoffState: row.releaseState === 'degraded' ? 'open' : 'clear',
            heartbeatState:
                row.runtimeState === 'degraded' ? 'warning' : 'ready',
            heartbeatChannel: 'browser',
            updatedAt: new Date().toISOString(),
        },
    }));
}

function buildConsoleBrief(state) {
    const lines = [
        formatTurneroSurfaceReleaseSyncPackBrief(state.releaseSyncPack),
        '',
        formatTurneroSurfaceSmokeReadoutBrief(state.smokeReadout),
        '',
        '# Manual smoke evidence',
        '',
    ];

    const evidenceItems = toArray(state.evidenceItems);
    if (evidenceItems.length === 0) {
        lines.push('Sin evidencia manual registrada.');
    } else {
        for (const item of evidenceItems) {
            lines.push(
                `- [${toString(item.status, 'captured')}] ${toString(
                    item.surfaceKey,
                    'surface'
                )} · ${toString(item.title, '')} · ${toString(item.note, '')}`
            );
        }
    }

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        registry: state.registry,
        releaseSyncPack: state.releaseSyncPack,
        smokeReadout: state.smokeReadout,
        smokeGate: state.releaseSyncPack?.smokeGate || null,
        evidence: state.evidenceStore.snapshot(),
        openHandoffs: state.openHandoffs,
        surfacePacks: state.surfacePacks,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${
                      window.location.hash || ''
                  }`
                : '',
    };
}

function renderSurfaceCards(surfacePacks = []) {
    return toArray(surfacePacks)
        .map((item) => {
            const readout = buildTurneroSurfaceSyncReadout(item?.pack || {});
            return `
                <article class="turnero-admin-queue-surface-sync-console__surface" data-state="${escapeHtml(
                    readout.gateBand
                )}">
                    <div class="turnero-admin-queue-surface-sync-console__surface-head">
                        <strong>${escapeHtml(item.label || readout.surfaceKey)}</strong>
                        <span>${escapeHtml(readout.gateBand)} · ${escapeHtml(
                            String(readout.gateScore)
                        )}</span>
                    </div>
                    <p>${escapeHtml(readout.summary)}</p>
                    <dl>
                        <div><dt>Turno visible</dt><dd>${escapeHtml(
                            readout.visibleTurn || '--'
                        )}</dd></div>
                        <div><dt>Version</dt><dd>${escapeHtml(
                            readout.queueVersion || '--'
                        )}</dd></div>
                        <div><dt>Handoffs</dt><dd>${escapeHtml(
                            String(readout.openHandoffs)
                        )}</dd></div>
                    </dl>
                </article>
            `;
        })
        .join('');
}

function renderEvidenceItems(items = []) {
    const rows = toArray(items);
    if (rows.length === 0) {
        return '<p class="turnero-admin-queue-surface-sync-console__empty">Sin evidencia manual.</p>';
    }

    return rows
        .map(
            (item) => `
                <article class="turnero-admin-queue-surface-sync-console__evidence-item" data-source="manual">
                    <div>
                        <strong>${escapeHtml(item.title || 'Manual smoke evidence')}</strong>
                        <p>${escapeHtml(
                            `${item.surfaceKey || 'surface'} · ${item.status || 'captured'} · ${formatTimestamp(item.updatedAt || item.capturedAt)}`
                        )}</p>
                        <p>${escapeHtml(item.note || 'Sin nota')}</p>
                    </div>
                    <button type="button" data-action="remove-evidence" data-evidence-id="${escapeHtml(
                        item.id
                    )}">Eliminar</button>
                </article>
            `
        )
        .join('');
}

function renderEvidenceForm(surfacePacks = []) {
    const options = toArray(surfacePacks)
        .map(
            (item) => `
                <option value="${escapeHtml(
                    item.surfaceKey || item.label || 'surface'
                )}">${escapeHtml(item.label || item.surfaceKey || 'surface')}</option>
            `
        )
        .join('');

    return `
        <div class="turnero-admin-queue-surface-sync-console__handoff-form turnero-admin-queue-surface-sync-console__evidence-form">
            <label>
                <span>Surface</span>
                <select data-field="evidence-surface-key">
                    ${options}
                </select>
            </label>
            <label>
                <span>Titulo</span>
                <input type="text" data-field="evidence-title" placeholder="Manual smoke evidence" />
            </label>
            <label>
                <span>Nota</span>
                <textarea data-field="evidence-note" placeholder="Que se valido manualmente"></textarea>
            </label>
            <label>
                <span>Estado</span>
                <select data-field="evidence-status">
                    <option value="captured">captured</option>
                    <option value="review">review</option>
                    <option value="resolved">resolved</option>
                    <option value="missing">missing</option>
                    <option value="stale">stale</option>
                </select>
            </label>
            <button type="button" data-action="add-evidence">Add evidence</button>
            <button type="button" data-action="clear-evidence">Clear evidence</button>
        </div>
    `;
}

function renderConsole(state) {
    const smokeGate = state.releaseSyncPack?.smokeGate || {
        band: 'unknown',
        score: 0,
    };
    const smokeReadout = state.smokeReadout || {
        summary: {
            state: 'unknown',
            label: 'Desconocido',
            score: 0,
            manifestMode: 'unknown',
            manifestSource: 'missing',
            runtimeState: 'unknown',
            evidenceCaptured: 0,
            evidenceOpen: 0,
            surfaceReadyCount: 0,
            surfaceWatchCount: 0,
            surfaceDegradedCount: 0,
            surfaceBlockedCount: 0,
            openHandoffs: 0,
            brief: '',
        },
    };

    return `
        <div class="turnero-admin-queue-surface-sync-console__header">
            <div>
                <p class="turnero-admin-queue-surface-sync-console__eyebrow">Surface sync</p>
                <h3>Surface Sync Console</h3>
                <p>Smoke, release truth, handoffs y evidence manual para admin.</p>
            </div>
            <div class="turnero-admin-queue-surface-sync-console__actions">
                <button type="button" data-action="copy-brief">Copy brief</button>
                <button type="button" data-action="download-json">Download JSON</button>
            </div>
        </div>
        <div class="turnero-admin-queue-surface-sync-console__metrics">
            <article>
                <strong>${escapeHtml(String(smokeReadout.summary.score || 0))}</strong>
                <span>${escapeHtml(smokeReadout.summary.label || 'Desconocido')}</span>
            </article>
            <article>
                <strong>${escapeHtml(
                    `${Number(smokeReadout.summary.surfaceReadyCount || 0)}/${Number(
                        state.surfacePacks.length || 0
                    )}`
                )}</strong>
                <span>Surfaces ready</span>
            </article>
            <article>
                <strong>${escapeHtml(
                    `${Number(smokeReadout.summary.evidenceCaptured || 0)}/${Number(
                        state.evidenceItems.length || 0
                    )}`
                )}</strong>
                <span>Evidence</span>
            </article>
            <article data-state="${escapeHtml(smokeGate.band || 'unknown')}">
                <strong>${escapeHtml(String(smokeGate.score || 0))}</strong>
                <span>${escapeHtml(smokeGate.band || 'unknown')}</span>
            </article>
        </div>
        <div class="turnero-admin-queue-surface-sync-console__grid">
            ${renderSurfaceCards(state.surfacePacks)}
        </div>
        <div class="turnero-admin-queue-surface-sync-console__handoff">
            ${renderEvidenceForm(state.surfacePacks)}
            <div class="turnero-admin-queue-surface-sync-console__handoff-list">
                <strong>Manual smoke evidence</strong>
                ${renderEvidenceItems(state.evidenceItems)}
            </div>
        </div>
        <div class="turnero-admin-queue-surface-sync-console__handoff">
            <div class="turnero-admin-queue-surface-sync-console__handoff-form">
                <label>
                    <span>Surface</span>
                    <select data-field="surface-key">
                        ${toArray(state.surfacePacks)
                            .map(
                                (item) => `
                                    <option value="${escapeHtml(
                                        item.surfaceKey ||
                                            item.label ||
                                            'surface'
                                    )}">${escapeHtml(
                                        item.label ||
                                            item.surfaceKey ||
                                            'surface'
                                    )}</option>
                                `
                            )
                            .join('')}
                    </select>
                </label>
                <label>
                    <span>Titulo</span>
                    <input type="text" data-field="title" placeholder="Handoff note" />
                </label>
                <label>
                    <span>Nota</span>
                    <textarea data-field="note" placeholder="Que debe revisar la siguiente superficie"></textarea>
                </label>
                <button type="button" data-action="add-handoff">Add handoff</button>
            </div>
            <div class="turnero-admin-queue-surface-sync-console__handoff-list">
                <strong>Open handoffs</strong>
                ${
                    state.openHandoffs.length > 0
                        ? state.openHandoffs
                              .map(
                                  (item) => `
                                      <article class="turnero-admin-queue-surface-sync-console__handoff-item" data-source="${escapeHtml(
                                          item.source || 'local'
                                      )}">
                                          <div>
                                              <strong>${escapeHtml(
                                                  item.title || item.surfaceKey
                                              )}</strong>
                                              <p>${escapeHtml(
                                                  item.surfaceKey
                                              )} · ${escapeHtml(
                                                  item.note || 'Sin detalle'
                                              )}</p>
                                          </div>
                                          ${
                                              item.source === 'local'
                                                  ? `<button type="button" data-action="close-handoff" data-handoff-id="${escapeHtml(
                                                        item.id
                                                    )}">Cerrar</button>`
                                                  : `<span class="turnero-admin-queue-surface-sync-console__remote-pill">reported</span>`
                                          }
                                      </article>
                                  `
                              )
                              .join('')
                        : '<p class="turnero-admin-queue-surface-sync-console__empty">Sin handoffs abiertos.</p>'
                }
            </div>
        </div>
        <pre class="turnero-admin-queue-surface-sync-console__brief">${escapeHtml(
            state.brief || ''
        )}</pre>
    `;
}

function getControllerState(input = {}) {
    const scope = getScope(input);
    const evidenceStore = createTurneroSurfaceSmokeEvidenceStore(
        scope,
        input.clinicProfile || null
    );
    const handoffStore = createTurneroSurfaceHandoffLedger(
        scope,
        input.clinicProfile || null
    );
    return {
        loading: true,
        error: '',
        scope,
        clinicProfile: input.clinicProfile || null,
        registry: asObject(input.registry),
        surfacePacks: [],
        openHandoffs: [],
        evidenceStore,
        handoffStore,
        evidenceItems: evidenceStore.list({ includeResolved: true }),
        releaseSyncPack: null,
        smokeReadout: null,
        truthPack: input.truthPack || null,
        generatedAt: new Date().toISOString(),
        brief: '',
    };
}

function refreshDerivedState(controller) {
    const surfacePacks = controller.resolveSurfacePacks();
    const remoteHandoffs = flattenSurfaceHandoffs(surfacePacks);
    const localHandoffs =
        controller.state.handoffStore?.list?.({
            includeClosed: false,
        }) || [];
    const openHandoffs = [...localHandoffs, ...remoteHandoffs].filter(
        (handoff) => String(handoff?.status || '').toLowerCase() !== 'closed'
    );
    controller.state.surfacePacks = surfacePacks;
    controller.state.openHandoffs = openHandoffs;
    controller.state.evidenceItems = controller.state.evidenceStore.list({
        includeResolved: true,
    });
    controller.state.releaseSyncPack = buildTurneroSurfaceReleaseSyncPack({
        registry: controller.state.registry,
        truthPack:
            controller.state.truthPack ||
            buildTurneroSurfaceReleaseTruthPack({
                registry: controller.state.registry,
            }),
        surfacePacks,
        evidenceSummary: controller.state.evidenceStore.summary(),
        handoffs: openHandoffs,
        scope: controller.state.scope,
        clinicProfile: controller.state.clinicProfile,
    });
    controller.state.smokeReadout =
        controller.state.releaseSyncPack.smokeReadout ||
        buildTurneroSurfaceSmokeReadout({
            reconciler: controller.state.releaseSyncPack.reconciler,
            runtimeSnapshot: controller.state.releaseSyncPack.runtimeSnapshot,
            smokeGate: controller.state.releaseSyncPack.smokeGate,
            evidenceSummary: controller.state.evidenceStore.summary(),
            surfacePacks,
            openHandoffs: controller.state.openHandoffs.length,
        });
    controller.state.brief = buildConsoleBrief(controller.state);
    controller.state.generatedAt = new Date().toISOString();
}

function bindConsoleActions(root, controller) {
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.turneroSmokeConsoleBound === 'true'
    ) {
        return;
    }

    root.dataset.turneroSmokeConsoleBound = 'true';
    root.addEventListener('click', async (event) => {
        const targetNode =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!(targetNode instanceof HTMLElement)) {
            return;
        }

        const action = String(targetNode.dataset.action || '');
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyToClipboardSafe(controller.state.brief);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshotSafe(
                'turnero-surface-smoke-console.json',
                buildDownloadSnapshot(controller.state)
            );
            return;
        }

        if (action === 'add-handoff') {
            const surfaceField = root.querySelector(
                '[data-field="surface-key"]'
            );
            const titleField = root.querySelector('[data-field="title"]');
            const noteField = root.querySelector('[data-field="note"]');
            const surfaceKey = toString(surfaceField?.value, '');
            if (!surfaceKey) {
                return;
            }

            controller.state.handoffStore?.add?.({
                surfaceKey,
                title: toString(titleField?.value, 'Handoff note'),
                note: toString(noteField?.value, ''),
                owner: 'ops',
                source: 'local',
                status: 'open',
            });
            if (titleField) {
                titleField.value = '';
            }
            if (noteField) {
                noteField.value = '';
            }
            controller.refresh();
            return;
        }

        if (action === 'add-evidence') {
            const surfaceField = root.querySelector(
                '[data-field="evidence-surface-key"]'
            );
            const titleField = root.querySelector(
                '[data-field="evidence-title"]'
            );
            const noteField = root.querySelector(
                '[data-field="evidence-note"]'
            );
            const statusField = root.querySelector(
                '[data-field="evidence-status"]'
            );
            const surfaceKey = toString(surfaceField?.value, '');
            if (!surfaceKey) {
                return;
            }

            controller.state.evidenceStore.add({
                surfaceKey,
                title: toString(titleField?.value, 'Manual smoke evidence'),
                note: toString(noteField?.value, ''),
                status: toString(statusField?.value, 'captured'),
                source: 'manual',
                author: 'admin',
            });

            if (titleField) {
                titleField.value = '';
            }
            if (noteField) {
                noteField.value = '';
            }
            controller.refresh();
            return;
        }

        if (action === 'remove-evidence') {
            const evidenceId = toString(
                targetNode.getAttribute('data-evidence-id'),
                ''
            );
            if (!evidenceId) {
                return;
            }
            controller.state.evidenceStore.remove(evidenceId);
            controller.refresh();
            return;
        }

        if (action === 'clear-evidence') {
            controller.state.evidenceStore.clear();
            controller.refresh();
            return;
        }

        if (action === 'close-handoff') {
            const handoffId = toString(
                targetNode.getAttribute('data-handoff-id'),
                ''
            );
            if (!handoffId) {
                return;
            }
            controller.state.handoffStore?.close?.(handoffId);
            controller.refresh();
        }
    });
}

export function mountTurneroAdminQueueSurfaceSmokeConsole(target, input = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const controller = {
        root: null,
        state: getControllerState(input),
        refresh() {
            refreshDerivedState(controller);
            if (controller.root) {
                controller.root.innerHTML = renderConsole(controller.state);
            }
            return controller.root;
        },
        resolveSurfacePacks() {
            const items =
                typeof input.getSurfacePacks === 'function'
                    ? input.getSurfacePacks()
                    : input.surfacePacks;
            if (Array.isArray(items) && items.length > 0) {
                return items.filter((item) => item && typeof item === 'object');
            }

            const truthPack =
                controller.state.truthPack ||
                buildTurneroSurfaceReleaseTruthPack({
                    registry: controller.state.registry,
                });
            return buildSurfacePacksFromTruthPack(truthPack);
        },
    };

    host.innerHTML = renderConsole(controller.state);
    controller.root = host;
    controller.handoffStore = controller.state.handoffStore;
    bindConsoleActions(controller.root, controller);

    controller.ready = (async () => {
        try {
            if (!input.registry) {
                controller.state.registry =
                    await loadTurneroSurfaceRegistrySource(
                        getRegistryOptions(input)
                    );
            }
            controller.state.loading = false;
            controller.refresh();
            return controller;
        } catch (error) {
            controller.state.loading = false;
            controller.state.error = String(error?.message || error || '');
            controller.refresh();
            return controller;
        }
    })();

    controller.refresh();
    return controller;
}

export function mountTurneroAdminQueueSurfaceSyncConsole(target, input = {}) {
    return mountTurneroAdminQueueSurfaceSmokeConsole(target, input);
}

export function renderTurneroAdminQueueSurfaceSmokeConsole(input = {}) {
    const controller = getControllerState(input);
    refreshDerivedState({
        state: controller,
        resolveSurfacePacks() {
            return Array.isArray(input.surfacePacks) ? input.surfacePacks : [];
        },
    });
    return renderConsole(controller);
}
