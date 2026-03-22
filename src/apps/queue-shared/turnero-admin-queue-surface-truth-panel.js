import {
    asObject,
    copyTextToClipboard,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { loadTurneroSurfaceRegistrySource } from './turnero-surface-registry-source.js';
import {
    buildTurneroSurfaceReleaseTruthPack,
    formatTurneroSurfaceReleaseTruthBrief,
    normalizeTurneroSurfaceKey,
} from './turnero-surface-release-truth.js';
import {
    buildTurneroSurfaceReleaseReadinessPack,
    formatTurneroSurfaceReleaseReadinessBrief,
} from './turnero-surface-release-readiness-pack.js';

const DEFAULT_SURFACES_URL = '/data/turnero-surfaces.json';
const DEFAULT_MANIFEST_URL = '/release-manifest.json';

function getRegistrySourceOptions(input = {}) {
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

function getPanelState(input = {}) {
    const registry = asObject(input.registry);
    const truthPack =
        input.truthPack && typeof input.truthPack === 'object'
            ? input.truthPack
            : buildTurneroSurfaceReleaseTruthPack({
                  registry,
                  loadedAt: input.loadedAt,
              });
    const readinessPack =
        input.readinessPack && typeof input.readinessPack === 'object'
            ? input.readinessPack
            : buildTurneroSurfaceReleaseReadinessPack({
                  registry,
                  truthPack,
                  surfaceKey: input.surfaceKey,
                  surfaceId: input.surfaceId,
                  surfaceRoute: input.surfaceRoute,
                  runtimeState: input.runtimeState,
                  clinicProfile: input.clinicProfile,
              });
    const surfaceKey = normalizeTurneroSurfaceKey(
        input.surfaceKey || input.surfaceId || input.surfaceRoute
    );
    const truthSummary = asObject(truthPack.summary);
    const readinessSummary = asObject(readinessPack.summary);
    const rows = toArray(truthPack.rows);

    return {
        loading: input.loading === true,
        error: toString(input.error, ''),
        registry,
        truthPack,
        readinessPack,
        surfaceKey,
        surfaceId: toString(input.surfaceId, ''),
        surfaceRoute: toString(input.surfaceRoute, ''),
        runtimeState: input.runtimeState || {},
        currentRoute: toString(input.currentRoute, ''),
        clinicProfile: asObject(input.clinicProfile),
        rows,
        truthSummary,
        readinessSummary,
        manifestSource: toString(
            readinessSummary.manifestSource,
            truthSummary.manifestSource || registry.manifestSource || 'missing'
        ),
        requestedManifestUrl: toString(
            readinessSummary.manifestRequestedUrl,
            truthSummary.requestedManifestUrl ||
                registry.requestedManifestUrl ||
                ''
        ),
        resolvedManifestUrl: toString(
            readinessSummary.manifestResolvedUrl,
            truthSummary.resolvedManifestUrl ||
                registry.resolvedManifestUrl ||
                ''
        ),
        generatedAt:
            readinessPack.generatedAt ||
            truthPack.generatedAt ||
            new Date().toISOString(),
    };
}

function buildBriefText(state) {
    return [
        formatTurneroSurfaceReleaseTruthBrief(state.truthPack),
        '',
        formatTurneroSurfaceReleaseReadinessBrief(state.readinessPack),
    ]
        .filter(Boolean)
        .join('\n');
}

function renderPanelRows(state) {
    if (state.rows.length === 0) {
        return `
            <li class="turnero-admin-queue-surface-truth-panel__row turnero-admin-queue-surface-truth-panel__row--empty">
                <strong>Sin superficies cargadas</strong>
                <span>El registry todavía no respondió o viene vacío.</span>
            </li>
        `;
    }

    return state.rows
        .map(
            (row) => `
                <li class="turnero-admin-queue-surface-truth-panel__row" data-truth="${escapeHtml(
                    row.truth || 'unknown'
                )}" data-runtime="${escapeHtml(
                    row.runtimeState || 'unknown'
                )}" data-release="${escapeHtml(row.releaseState || 'unknown')}">
                    <div class="turnero-admin-queue-surface-truth-panel__row-main">
                        <strong>${escapeHtml(row.label || row.surfaceKey || '')}</strong>
                        <span>${escapeHtml(
                            `${row.path || row.surfacePath || ''} · ${row.truthLabel || row.truth || 'unknown'}`
                        )}</span>
                    </div>
                    <div class="turnero-admin-queue-surface-truth-panel__row-meta">
                        <span>runtime ${escapeHtml(row.runtimeState || 'unknown')}</span>
                        <span>release ${escapeHtml(row.releaseState || 'unknown')}</span>
                        <span>manifest v${escapeHtml(row.manifestVersion || 'n/a')}</span>
                    </div>
                </li>
            `
        )
        .join('');
}

function renderPanelSummary(state) {
    const truth = state.truthSummary || {};
    const readiness = state.readinessSummary || {};
    const safeMode = state.readinessPack.safeMode || { enabled: false };
    const fallbackVisible = state.manifestSource === 'fallback';
    const statusTone =
        readiness.state === 'ready'
            ? 'ready'
            : readiness.state === 'watch'
              ? 'warning'
              : readiness.state === 'degraded'
                ? 'danger'
                : 'unknown';

    return `
        <article
            class="queue-app-card turnero-admin-queue-surface-truth-panel"
            data-state="${escapeHtml(statusTone)}"
            data-band="${escapeHtml(toString(readiness.state, 'unknown'))}"
            data-truth="${escapeHtml(toString(truth.mode, 'unknown'))}"
            data-manifest-source="${escapeHtml(toString(state.manifestSource, 'missing'))}"
        >
            <div class="turnero-admin-queue-surface-truth-panel__header">
                <div>
                    <p class="queue-app-card__eyebrow">Surface truth</p>
                    <h5 class="queue-app-card__title">Admin queue · verdad de surfaces</h5>
                    <p class="queue-app-card__description">
                        Truth pack, readiness pack y resolución visible contra release registry.
                    </p>
                </div>
                <div class="turnero-admin-queue-surface-truth-panel__stats">
                    <span class="queue-app-card__tag" data-state="${escapeHtml(
                        readiness.state || 'unknown'
                    )}">${escapeHtml(
                        `${toString(readiness.label, 'Desconocido')} · ${Number(readiness.score || 0)}/100`
                    )}</span>
                    <span class="queue-app-card__tag" data-state="${escapeHtml(
                        truth.mode || 'unknown'
                    )}">${escapeHtml(
                        `${Number(truth.aligned || 0)}/${Number(truth.totalCount || 0)} aligned`
                    )}</span>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-truth-panel__meta">
                <span>Manifest source ${escapeHtml(state.manifestSource)}</span>
                <span>Requested URL ${escapeHtml(state.requestedManifestUrl || '')}</span>
                <span>Resolved URL ${escapeHtml(state.resolvedManifestUrl || '')}</span>
                <span>Timestamp ${escapeHtml(formatTimestamp(state.truthPack.generatedAt || state.generatedAt))}</span>
            </div>
            ${
                fallbackVisible
                    ? `<aside class="turnero-surface-safe-mode-banner" data-state="watch" data-reason="manifest_fallback_visible">
                            <strong>Fallback piloto visible</strong>
                            <p>El manifest salió de /app-downloads/pilot/release-manifest.json. La consola queda en watch y no cuenta como cierre pleno.</p>
                        </aside>`
                    : ''
            }
            ${
                safeMode.enabled
                    ? `<aside class="turnero-surface-safe-mode-banner" data-state="${escapeHtml(
                          safeMode.tone || 'warning'
                      )}" data-reason="${escapeHtml(safeMode.reason || 'unknown')}">
                            <strong>${escapeHtml(safeMode.label || 'Modo seguro visible')}</strong>
                            <p>${escapeHtml(safeMode.detail || '')}</p>
                        </aside>`
                    : ''
            }
            <div class="turnero-admin-queue-surface-truth-panel__summary">
                <article>
                    <span>Ready</span>
                    <strong>${escapeHtml(String(truth.readyCount || truth.aligned || 0))}</strong>
                </article>
                <article>
                    <span>Watch</span>
                    <strong>${escapeHtml(String(truth.watch || 0))}</strong>
                </article>
                <article>
                    <span>Degraded</span>
                    <strong>${escapeHtml(String(truth.degraded || 0))}</strong>
                </article>
                <article>
                    <span>Unknown</span>
                    <strong>${escapeHtml(String(truth.unknown || 0))}</strong>
                </article>
            </div>
            <div class="turnero-admin-queue-surface-truth-panel__readiness">
                <span class="turnero-admin-queue-surface-truth-panel__readiness-label">
                    ${escapeHtml(toString(readiness.label, 'Desconocido'))}
                </span>
                <span class="turnero-admin-queue-surface-truth-panel__readiness-score">
                    Score ${escapeHtml(String(readiness.score || 0))}/100 · smoke ${escapeHtml(
                        `${Number(readiness.smokePass || 0)}/${Number(
                            readiness.smokeAll || 0
                        )}`
                    )}
                </span>
            </div>
            <p class="turnero-admin-queue-surface-truth-panel__note">
                Readiness bands ready / watch / degraded / unknown
            </p>
            <ul class="turnero-admin-queue-surface-truth-panel__rows">
                ${renderPanelRows(state)}
            </ul>
            <div class="turnero-admin-queue-surface-truth-panel__actions">
                <button type="button" data-action="copy-brief">Copy brief</button>
                <button type="button" data-action="download-json">Download JSON</button>
            </div>
            ${
                state.loading
                    ? `<p class="turnero-admin-queue-surface-truth-panel__note">Cargando registry y manifest...</p>`
                    : ''
            }
            ${
                state.error
                    ? `<p class="turnero-admin-queue-surface-truth-panel__error">${escapeHtml(
                          state.error
                      )}</p>`
                    : ''
            }
            <p class="turnero-admin-queue-surface-truth-panel__note">
                Current route ${escapeHtml(state.currentRoute || 'n/a')} · truth ${escapeHtml(
                    toString(truth.mode, 'unknown')
                )} · readiness ${escapeHtml(toString(readiness.state, 'unknown'))}
            </p>
        </article>
    `.trim();
}

export function renderTurneroAdminQueueSurfaceTruthPanel(input = {}) {
    const state = getPanelState({
        ...input,
        loading: input.loading === true,
    });
    return renderPanelSummary(state);
}

function bindPanelActions(root, controller) {
    if (!(root instanceof HTMLElement)) {
        return;
    }

    if (root.dataset.turneroTruthPanelBound === 'true') {
        return;
    }

    root.dataset.turneroTruthPanelBound = 'true';
    root.addEventListener('click', async (event) => {
        const actionNode =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!(actionNode instanceof HTMLElement)) {
            return;
        }

        const action = String(actionNode.dataset.action || '');
        if (!action) {
            return;
        }

        const state = controller.state;
        if (action === 'copy-brief') {
            const brief = buildBriefText(state);
            await copyTextToClipboard(brief);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot('turnero-surface-truth.json', {
                registry: state.registry,
                truthPack: state.truthPack,
                readinessPack: state.readinessPack,
                clinicProfile: state.clinicProfile,
                currentRoute: state.currentRoute,
                generatedAt: state.generatedAt,
            });
        }
    });
}

export function mountTurneroAdminQueueSurfaceTruthPanel(target, input = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const state = getPanelState({
        ...input,
        loading: true,
    });
    const controller = {
        root: null,
        state,
        ready: Promise.resolve(null),
        rerender(nextState = {}) {
            Object.assign(controller.state, nextState);
            if (controller.root) {
                controller.root.innerHTML =
                    renderTurneroAdminQueueSurfaceTruthPanel(controller.state);
            }
            return controller.root;
        },
        setRegistry(nextRegistry = {}) {
            controller.state.registry = asObject(nextRegistry);
            const nextTruthPack = buildTurneroSurfaceReleaseTruthPack({
                registry: controller.state.registry,
            });
            return controller.rerender({
                loading: false,
                truthPack: nextTruthPack,
                readinessPack: buildTurneroSurfaceReleaseReadinessPack({
                    registry: controller.state.registry,
                    truthPack: nextTruthPack,
                    surfaceKey: controller.state.surfaceKey,
                    surfaceId: controller.state.surfaceId,
                    surfaceRoute: controller.state.surfaceRoute,
                    runtimeState: controller.state.runtimeState,
                    clinicProfile: controller.state.clinicProfile,
                }),
            });
        },
        setTruthPack(nextTruthPack = {}) {
            controller.state.truthPack = nextTruthPack;
            return controller.rerender({ loading: false });
        },
        setReadinessPack(nextReadinessPack = {}) {
            controller.state.readinessPack = nextReadinessPack;
            return controller.rerender({ loading: false });
        },
        setClinicProfile(nextClinicProfile = {}) {
            controller.state.clinicProfile = asObject(nextClinicProfile);
            return controller.rerender({ loading: false });
        },
        setError(error) {
            controller.state.error = toString(
                error?.message || error,
                'surface_truth_panel_error'
            );
            return controller.rerender({ loading: false });
        },
    };

    host.innerHTML = renderTurneroAdminQueueSurfaceTruthPanel(state);
    controller.root = host.firstElementChild || host;
    bindPanelActions(controller.root, controller);

    controller.ready = (async () => {
        const loadOptions = getRegistrySourceOptions(input);
        try {
            if (!input.registry) {
                const loaded =
                    await loadTurneroSurfaceRegistrySource(loadOptions);
                controller.state.registry = loaded;
                controller.state.truthPack =
                    buildTurneroSurfaceReleaseTruthPack({
                        registry: loaded,
                    });
                controller.state.readinessPack =
                    buildTurneroSurfaceReleaseReadinessPack({
                        registry: loaded,
                        truthPack: controller.state.truthPack,
                        surfaceKey: input.surfaceKey,
                        surfaceId: input.surfaceId,
                        surfaceRoute: input.surfaceRoute,
                        runtimeState: input.runtimeState,
                        clinicProfile: input.clinicProfile,
                    });
                controller.state.loading = false;
                controller.state.error = '';
                controller.rerender();
                return controller;
            }

            controller.state.loading = false;
            controller.rerender();
            return controller;
        } catch (error) {
            controller.state.loading = false;
            controller.state.error = String(error?.message || error || '');
            controller.rerender();
            return controller;
        }
    })();

    return controller;
}
