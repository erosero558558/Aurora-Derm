import {
    bindQueueOpsPilotActions,
    renderQueueOpsPilotActionMarkup,
} from './actions.js';
import {
    createTurneroRemoteReleaseReadinessModel,
    loadTurneroRemoteReleaseHealth,
    renderTurneroRemoteReleaseReadinessCard,
} from '../../../../../../../../queue-shared/turnero-remote-release-readiness.js';
import {
    createTurneroPublicShellDriftModel,
    loadTurneroPublicShellHtml,
    renderTurneroPublicShellDriftCard,
} from '../../../../../../../../queue-shared/turnero-public-shell-drift.js';
import {
    mountTurneroReleaseEvidenceBundleCard,
    renderTurneroReleaseEvidenceBundleCard,
} from '../../../../../../../../queue-shared/turnero-release-evidence-bundle.js';

function resolvePublicShellDriftOptions(manifest = {}) {
    const config =
        manifest?.publicShellDrift ||
        manifest?.turneroPublicShellDrift ||
        manifest?.queuePublicShellDrift ||
        {};

    const ga4Needles = Array.isArray(config.expectedGa4Needles)
        ? config.expectedGa4Needles
        : Array.isArray(config.trustedGa4Needles)
          ? config.trustedGa4Needles
          : ['googletagmanager.com', 'gtag(', 'dataLayer'];

    return {
        pageUrl: '/',
        timeoutMs: config.timeoutMs || 6000,
        expectedStylesNeedle:
            config.expectedStylesNeedle ||
            config.trustedPublicStylesNeedle ||
            'styles.css',
        expectedShellScriptNeedle:
            config.expectedShellScriptNeedle ||
            config.trustedPublicShellScriptNeedle ||
            'script.js',
        expectedGa4Needles: ga4Needles,
        requireGa4Markers: config.requireGa4Markers !== false,
    };
}

function renderPilotRolloutStations(pilot, escapeHtml) {
    if (
        !Array.isArray(pilot.rolloutStations) ||
        !pilot.rolloutStations.length
    ) {
        return '';
    }

    return `
        <div class="queue-ops-pilot__lanes">
            ${pilot.rolloutStations
                .map(
                    (station) => `
                        <article class="queue-ops-pilot__lane" data-state="${
                            station.ready
                                ? 'ready'
                                : station.live
                                  ? 'warning'
                                  : 'pending'
                        }">
                            <span>${escapeHtml(station.title)}</span>
                            <strong>${escapeHtml(
                                station.ready
                                    ? 'Desktop lista'
                                    : station.live
                                      ? 'Desktop visible'
                                      : 'Pendiente'
                            )}</strong>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

function normalizeReleaseEvidenceState(value, fallback = 'warning') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();

    if (normalized === 'alert') {
        return 'blocked';
    }

    if (
        normalized === 'ready' ||
        normalized === 'warning' ||
        normalized === 'blocked'
    ) {
        return normalized;
    }

    return fallback;
}

function buildQueueOpsPilotReleaseEvidenceLocalModel(pilot) {
    const blockers = Array.isArray(pilot.goLiveIssues)
        ? pilot.goLiveIssues
              .filter((issue) => issue.state === 'alert')
              .map((issue, index) => ({
                  key: String(issue.id || `local_blocker_${index + 1}`),
                  title: String(issue.label || 'Bloqueo').trim(),
                  detail: String(issue.detail || '').trim(),
              }))
        : [];
    const state = normalizeReleaseEvidenceState(
        pilot.readinessState,
        'warning'
    );

    return {
        readySurfaceCount: Number(pilot.confirmedCount || 0),
        totalSurfaceCount: Number(pilot.totalSteps || 0),
        openingPackageState: state,
        openingPackageStatus: state,
        state,
        clinicName: String(pilot.clinicName || pilot.brandName || '').trim(),
        brandName: String(pilot.clinicName || pilot.brandName || '').trim(),
        clinicId: String(pilot.clinicId || '').trim(),
        profileFingerprint: String(pilot.profileFingerprint || '').trim(),
        releaseMode: String(pilot.releaseMode || '').trim(),
        runtimeSource: String(pilot.runtimeSource || '').trim(),
        blockers,
    };
}

function buildQueueOpsPilotReleaseEvidenceRemoteModel(
    remoteState,
    remoteModel
) {
    const health = remoteState?.health?.payload || {};
    const publicSync =
        health?.checks && typeof health.checks === 'object'
            ? health.checks.publicSync || {}
            : {};
    const diagnosticsPayload =
        remoteState?.diagnostics?.payload &&
        typeof remoteState.diagnostics.payload === 'object'
            ? remoteState.diagnostics.payload
            : {};
    const checks =
        diagnosticsPayload.checks &&
        typeof diagnosticsPayload.checks === 'object'
            ? diagnosticsPayload.checks
            : {};
    const turneroPilot =
        checks.turneroPilot && typeof checks.turneroPilot === 'object'
            ? checks.turneroPilot
            : {};
    const itemsById = Object.fromEntries(
        (Array.isArray(remoteModel.items) ? remoteModel.items : []).map(
            (item) => [item.id, item]
        )
    );
    const blockers = (Array.isArray(remoteModel.items) ? remoteModel.items : [])
        .filter((item) => item.state === 'alert')
        .map((item, index) => ({
            key: String(item.id || `remote_blocker_${index + 1}`),
            title: String(item.label || 'Bloqueo').trim(),
            detail: String(item.detail || '').trim(),
        }));
    const releaseStatus = normalizeReleaseEvidenceState(
        remoteModel.tone,
        'warning'
    );

    return {
        releaseStatus,
        status: releaseStatus,
        finalState: releaseStatus,
        expectedClinicId: String(
            remoteState?.clinicId || turneroPilot.clinicId || ''
        ).trim(),
        expectedProfileFingerprint: String(
            remoteState?.profileFingerprint ||
                turneroPilot.profileFingerprint ||
                ''
        ).trim(),
        deployedCommit: String(publicSync.deployedCommit || '').trim(),
        publicSyncLabel: String(
            itemsById.public_sync?.detail || itemsById.public_sync?.label || ''
        ).trim(),
        diagnosticsLabel: String(
            itemsById.diagnostics?.detail || itemsById.diagnostics?.label || ''
        ).trim(),
        figoLabel: String(
            itemsById.figo?.detail || itemsById.figo?.label || ''
        ).trim(),
        sourceHealthLabel: String(
            [itemsById.availability?.detail, itemsById.booked_slots?.detail]
                .filter(Boolean)
                .join(' · ')
        ).trim(),
        blockers,
    };
}

async function hydrateQueueOpsPilotReleaseEvidence(
    root,
    pilot,
    manifest,
    requestId
) {
    const remoteReleaseHost = document.getElementById(
        'queueOpsPilotRemoteReleaseHost'
    );
    const publicShellDriftHost = document.getElementById(
        'queuePublicShellDriftCard'
    );
    const releaseEvidenceHost = document.getElementById(
        'queueOpsPilotReleaseEvidenceHost'
    );

    if (
        !(remoteReleaseHost instanceof HTMLElement) ||
        !(publicShellDriftHost instanceof HTMLElement) ||
        !(releaseEvidenceHost instanceof HTMLElement)
    ) {
        return;
    }

    const publicShellOptions = resolvePublicShellDriftOptions(manifest);
    const bundleOptions = {
        origin: window.location.origin,
        baseUrl: window.location.origin,
        nativeWaveLabel: 'ola nativa posterior',
        fileNamePrefix: 'turnero-release-evidence',
    };

    remoteReleaseHost.setAttribute('aria-busy', 'true');
    publicShellDriftHost.setAttribute('aria-busy', 'true');
    releaseEvidenceHost.setAttribute('aria-busy', 'true');

    let snapshot = null;

    try {
        const [remoteState, publicShellScan] = await Promise.all([
            loadTurneroRemoteReleaseHealth({
                clinicId: pilot.clinicId,
                profileFingerprint: pilot.profileFingerprint,
            }),
            loadTurneroPublicShellHtml(publicShellOptions),
        ]);

        if (root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
            return;
        }

        const remoteReadinessModel =
            createTurneroRemoteReleaseReadinessModel(remoteState);
        const publicShellDriftModel = createTurneroPublicShellDriftModel(
            {
                pageOk: publicShellScan.ok,
                pageStatus: publicShellScan.pageStatus,
                html: publicShellScan.html,
            },
            publicShellOptions
        );

        remoteReleaseHost.innerHTML =
            renderTurneroRemoteReleaseReadinessCard(remoteReadinessModel);
        publicShellDriftHost.innerHTML = renderTurneroPublicShellDriftCard(
            publicShellDriftModel,
            publicShellOptions
        );

        snapshot = {
            localReadinessModel:
                buildQueueOpsPilotReleaseEvidenceLocalModel(pilot),
            remoteReleaseModel: buildQueueOpsPilotReleaseEvidenceRemoteModel(
                remoteState,
                remoteReadinessModel
            ),
            publicShellDriftModel,
        };
    } catch (error) {
        if (root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
            return;
        }

        const message =
            error instanceof Error
                ? error.message
                : String(error || 'request_failed');
        const fallbackRemoteState = {
            clinicId: pilot.clinicId,
            profileFingerprint: pilot.profileFingerprint,
            health: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            diagnostics: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            availability: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            bookedSlots: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            loadedAt: new Date().toISOString(),
        };
        const remoteReadinessModel =
            createTurneroRemoteReleaseReadinessModel(fallbackRemoteState);
        const publicShellDriftModel = createTurneroPublicShellDriftModel(
            {
                pageOk: false,
                pageStatus: 0,
                html: '',
            },
            publicShellOptions
        );

        remoteReleaseHost.innerHTML =
            renderTurneroRemoteReleaseReadinessCard(remoteReadinessModel);
        publicShellDriftHost.innerHTML = renderTurneroPublicShellDriftCard(
            publicShellDriftModel,
            publicShellOptions
        );

        snapshot = {
            localReadinessModel:
                buildQueueOpsPilotReleaseEvidenceLocalModel(pilot),
            remoteReleaseModel: buildQueueOpsPilotReleaseEvidenceRemoteModel(
                fallbackRemoteState,
                remoteReadinessModel
            ),
            publicShellDriftModel,
        };
    } finally {
        if (root.dataset.turneroQueueOpsPilotRenderId === requestId) {
            remoteReleaseHost.removeAttribute('aria-busy');
            publicShellDriftHost.removeAttribute('aria-busy');
            releaseEvidenceHost.removeAttribute('aria-busy');
        }
    }

    if (!snapshot || root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
        return;
    }

    try {
        mountTurneroReleaseEvidenceBundleCard(
            releaseEvidenceHost,
            snapshot,
            bundleOptions
        );
    } catch (_error) {
        releaseEvidenceHost.innerHTML = renderTurneroReleaseEvidenceBundleCard(
            snapshot,
            bundleOptions
        );
    }
}

export function renderQueueOpsPilotView(manifest, detectedPlatform, deps) {
    const { buildQueueOpsPilot, setHtml, escapeHtml } = deps;
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    const renderRequestId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
    root.dataset.turneroQueueOpsPilotRenderId = renderRequestId;
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            pilot.summary
                        )}</p>
                        <p class="queue-ops-pilot__support">${escapeHtml(
                            pilot.supportCopy
                        )}</p>
                        ${renderPilotRolloutStations(pilot, escapeHtml)}
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.primaryAction,
                                'primary',
                                {
                                    escapeHtml,
                                }
                            )}
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.secondaryAction,
                                'secondary',
                                { escapeHtml }
                            )}
                        </div>
                        <section
                            id="queueOpsPilotReadiness"
                            class="queue-ops-pilot__readiness"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__readiness-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Readiness</p>
                                    <h6 id="queueOpsPilotReadinessTitle">${escapeHtml(
                                        pilot.readinessTitle
                                    )}</h6>
                                </div>
                                <span
                                    id="queueOpsPilotReadinessStatus"
                                    class="queue-ops-pilot__readiness-status"
                                    data-state="${escapeHtml(pilot.readinessState)}"
                                >
                                    ${escapeHtml(
                                        pilot.readinessBlockingCount > 0
                                            ? `${pilot.readinessBlockingCount} bloqueo(s)`
                                            : 'Listo'
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotReadinessSummary" class="queue-ops-pilot__readiness-summary">${escapeHtml(
                                pilot.readinessSummary
                            )}</p>
                            <div id="queueOpsPilotReadinessItems" class="queue-ops-pilot__readiness-items" role="list" aria-label="Checklist de readiness de Turnero V2">
                                ${pilot.readinessItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotReadinessItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__readiness-item"
                                                data-state="${escapeHtml(
                                                    item.ready
                                                        ? 'ready'
                                                        : item.blocker
                                                          ? 'alert'
                                                          : 'warning'
                                                )}"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <span class="queue-ops-pilot__readiness-item-badge">${escapeHtml(
                                                    item.ready
                                                        ? 'Listo'
                                                        : item.blocker
                                                          ? 'Bloquea'
                                                          : 'Pendiente'
                                                )}</span>
                                                <p>${escapeHtml(
                                                    item.detail
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotReadinessSupport" class="queue-ops-pilot__readiness-support">${escapeHtml(
                                pilot.readinessSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotIssues"
                            class="queue-ops-pilot__issues"
                            data-state="${escapeHtml(pilot.goLiveIssueState)}"
                        >
                            <div class="queue-ops-pilot__issues-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Go-live</p>
                                    <h6 id="queueOpsPilotIssuesTitle">Bloqueos de salida</h6>
                                </div>
                                <span
                                    id="queueOpsPilotIssuesStatus"
                                    class="queue-ops-pilot__issues-status"
                                    data-state="${escapeHtml(pilot.goLiveIssueState)}"
                                >
                                    ${escapeHtml(
                                        pilot.goLiveIssues.length === 0
                                            ? 'Sin bloqueos'
                                            : pilot.goLiveBlockingCount > 0
                                              ? `${pilot.goLiveBlockingCount} bloqueo(s)`
                                              : `${pilot.goLiveIssues.length} pendiente(s)`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotIssuesSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                                pilot.goLiveSummary
                            )}</p>
                            <div id="queueOpsPilotIssuesItems" class="queue-ops-pilot__issues-items" role="list" aria-label="Bloqueos accionables de Turnero V2">
                                ${
                                    pilot.goLiveIssues.length > 0
                                        ? pilot.goLiveIssues
                                              .map(
                                                  (item) => `
                                                    <article
                                                        id="queueOpsPilotIssuesItem_${escapeHtml(
                                                            item.id
                                                        )}"
                                                        class="queue-ops-pilot__issues-item"
                                                        data-state="${escapeHtml(item.state)}"
                                                        role="listitem"
                                                    >
                                                        <div class="queue-ops-pilot__issues-item-head">
                                                            <strong>${escapeHtml(
                                                                item.label
                                                            )}</strong>
                                                            <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                                                                item.state ===
                                                                    'alert'
                                                                    ? 'Bloquea'
                                                                    : item.state ===
                                                                        'ready'
                                                                      ? 'Listo'
                                                                      : 'Pendiente'
                                                            )}</span>
                                                        </div>
                                                        <p>${escapeHtml(
                                                            item.detail
                                                        )}</p>
                                                        ${
                                                            item.href
                                                                ? `
                                                                    <a
                                                                        id="queueOpsPilotIssuesAction_${escapeHtml(
                                                                            item.id
                                                                        )}"
                                                                        href="${escapeHtml(
                                                                            item.href
                                                                        )}"
                                                                        class="queue-ops-pilot__issues-link"
                                                                        target="_blank"
                                                                        rel="noopener"
                                                                    >
                                                                        ${escapeHtml(
                                                                            item.actionLabel ||
                                                                                'Abrir'
                                                                        )}
                                                                    </a>
                                                                `
                                                                : ''
                                                        }
                                                    </article>
                                                `
                                              )
                                              .join('')
                                        : `
                                            <article
                                                id="queueOpsPilotIssuesItem_ready"
                                                class="queue-ops-pilot__issues-item"
                                                data-state="ready"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__issues-item-head">
                                                    <strong>Sin bloqueos activos</strong>
                                                    <span class="queue-ops-pilot__issues-item-badge">Listo</span>
                                                </div>
                                                <p>Turnero V2 ya no tiene bloqueos de salida por perfil, canon, publicación, PIN o smoke.</p>
                                            </article>
                                        `
                                }
                            </div>
                            <p id="queueOpsPilotIssuesSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                                pilot.goLiveSupport
                            )}</p>
                        </section>
                        <div
                            id="queuePublicShellDriftCard"
                            data-turnero-public-shell-drift
                        ></div>
                        <section id="queueOpsPilotCanon" class="queue-ops-pilot__canon">
                            <div class="queue-ops-pilot__canon-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Fallback web</p>
                                    <h6 id="queueOpsPilotCanonTitle">Rutas por clínica</h6>
                                </div>
                                <span id="queueOpsPilotCanonStatus" class="queue-ops-pilot__canon-status">
                                    ${escapeHtml(
                                        `${pilot.canonicalSurfaces.filter((item) => item.ready).length}/${pilot.canonicalSurfaces.length} activas`
                                    )}
                                </span>
                            </div>
                            <div id="queueOpsPilotCanonItems" class="queue-ops-pilot__canon-items" role="list" aria-label="Superficies web canonicas de Turnero V2">
                                ${pilot.canonicalSurfaces
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotCanonItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__canon-item"
                                                data-state="${escapeHtml(
                                                    item.state ||
                                                        (item.ready
                                                            ? 'ready'
                                                            : 'warning')
                                                )}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__canon-item-head">
                                                    <strong>${escapeHtml(
                                                        item.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__canon-item-badge">${escapeHtml(
                                                        item.badge ||
                                                            (item.ready
                                                                ? 'Declarada'
                                                                : 'Pendiente')
                                                    )}</span>
                                                </div>
                                                <code>${escapeHtml(
                                                    item.route
                                                )}</code>
                                                <p>${escapeHtml(
                                                    item.detail ||
                                                        item.url ||
                                                        'Ruta local de Turnero V2'
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotCanonSupport" class="queue-ops-pilot__canon-support">${escapeHtml(
                                pilot.canonicalSupport || ''
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotSmoke"
                            class="queue-ops-pilot__smoke"
                            data-state="${escapeHtml(pilot.smokeState)}"
                        >
                            <div class="queue-ops-pilot__smoke-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Smoke por clínica</p>
                                    <h6 id="queueOpsPilotSmokeTitle">Secuencia repetible</h6>
                                </div>
                                <span
                                    id="queueOpsPilotSmokeStatus"
                                    class="queue-ops-pilot__smoke-status"
                                    data-state="${escapeHtml(pilot.smokeState)}"
                                >
                                    ${escapeHtml(
                                        `${pilot.smokeReadyCount}/${pilot.smokeSteps.length} listos`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotSmokeSummary" class="queue-ops-pilot__smoke-summary">${escapeHtml(
                                pilot.smokeSummary
                            )}</p>
                            <div id="queueOpsPilotSmokeItems" class="queue-ops-pilot__smoke-items" role="list" aria-label="Secuencia de smoke de Turnero V2">
                                ${pilot.smokeSteps
                                    .map(
                                        (step) => `
                                            <article
                                                id="queueOpsPilotSmokeItem_${escapeHtml(
                                                    step.id
                                                )}"
                                                class="queue-ops-pilot__smoke-item"
                                                data-state="${escapeHtml(step.state)}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__smoke-item-head">
                                                    <strong>${escapeHtml(
                                                        step.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__smoke-item-badge">${escapeHtml(
                                                        step.ready
                                                            ? 'Listo'
                                                            : step.state ===
                                                                'alert'
                                                              ? 'Bloquea'
                                                              : 'Pendiente'
                                                    )}</span>
                                                </div>
                                                <p>${escapeHtml(step.detail)}</p>
                                                ${
                                                    step.href
                                                        ? `
                                                            <a
                                                                id="queueOpsPilotSmokeAction_${escapeHtml(
                                                                    step.id
                                                                )}"
                                                                href="${escapeHtml(step.href)}"
                                                                class="queue-ops-pilot__smoke-link"
                                                                target="_blank"
                                                                rel="noopener"
                                                            >
                                                                ${escapeHtml(
                                                                    step.actionLabel ||
                                                                        'Abrir'
                                                                )}
                                                            </a>
                                                        `
                                                        : ''
                                                }
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotSmokeSupport" class="queue-ops-pilot__smoke-support">${escapeHtml(
                                pilot.smokeSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotHandoff"
                            class="queue-ops-pilot__handoff"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__handoff-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Handoff por clínica</p>
                                    <h6 id="queueOpsPilotHandoffTitle">Paquete de apertura</h6>
                                </div>
                                <button
                                    id="queueOpsPilotHandoffCopyBtn"
                                    type="button"
                                    class="queue-ops-pilot__handoff-copy"
                                >
                                    Copiar paquete
                                </button>
                            </div>
                            <p id="queueOpsPilotHandoffSummary" class="queue-ops-pilot__handoff-summary">${escapeHtml(
                                pilot.handoffSummary
                            )}</p>
                            <div id="queueOpsPilotHandoffItems" class="queue-ops-pilot__handoff-items" role="list" aria-label="Paquete de Turnero V2 por clínica">
                                ${pilot.handoffItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotHandoffItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__handoff-item"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <p>${escapeHtml(item.value)}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotHandoffSupport" class="queue-ops-pilot__handoff-support">${escapeHtml(
                                pilot.handoffSupport
                            )}</p>
                        </section>
                        <div
                            id="queueOpsPilotRemoteReleaseHost"
                            class="queue-ops-pilot__remote-release-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueOpsPilotReleaseEvidenceHost"
                            class="queue-ops-pilot__release-evidence-host"
                            aria-live="polite"
                        ></div>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `
    );

    void hydrateQueueOpsPilotReleaseEvidence(
        root,
        pilot,
        manifest,
        renderRequestId
    );

    bindQueueOpsPilotActions(manifest, detectedPlatform, deps);
}
