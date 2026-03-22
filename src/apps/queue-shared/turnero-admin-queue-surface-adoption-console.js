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
import { createTurneroSurfaceTrainingLedger } from './turnero-surface-training-ledger.js';
import { createTurneroSurfaceOperatorAckStore } from './turnero-surface-operator-ack-store.js';
import { buildTurneroSurfaceAdoptionPack } from './turnero-surface-adoption-pack.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';

const STYLE_ID = 'turneroAdminQueueSurfaceAdoptionConsoleInlineStyles';
const DEFAULT_SURFACES_URL = '/data/turnero-surfaces.json';
const DEFAULT_MANIFEST_URL = '/release-manifest.json';

function ensureAdoptionConsoleStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-adoption-console__header-copy {
            display: grid;
            gap: 0.18rem;
        }
        .turnero-admin-queue-surface-adoption-console__metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-adoption-console__metric {
            display: grid;
            gap: 0.2rem;
            padding: 0.78rem 0.88rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 80%);
        }
        .turnero-admin-queue-surface-adoption-console__metric strong {
            font-size: 1.05rem;
        }
        .turnero-admin-queue-surface-adoption-console__surface-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
        }
        .turnero-admin-queue-surface-adoption-console__surface-grid div {
            padding: 0.55rem 0.62rem;
            border-radius: 14px;
            background: rgb(15 23 32 / 3%);
        }
        .turnero-admin-queue-surface-adoption-console__surface-grid dt {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.68;
        }
        .turnero-admin-queue-surface-adoption-console__surface-grid dd {
            margin: 0.2rem 0 0;
            font-weight: 700;
        }
        .turnero-admin-queue-surface-adoption-console__surface-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }
        .turnero-admin-queue-surface-adoption-console__surface {
            display: grid;
            gap: 0.68rem;
        }
        .turnero-admin-queue-surface-adoption-console__surface[data-state='ready'] {
            border-color: rgb(22 163 74 / 20%);
        }
        .turnero-admin-queue-surface-adoption-console__surface[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
        }
        .turnero-admin-queue-surface-adoption-console__surface[data-state='degraded'] {
            border-color: rgb(234 88 12 / 18%);
        }
        .turnero-admin-queue-surface-adoption-console__surface[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
        }
        .turnero-admin-queue-surface-adoption-console__form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.6rem;
            padding: 0.8rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 72%);
        }
        .turnero-admin-queue-surface-adoption-console__form-grid label {
            display: grid;
            gap: 0.3rem;
            font-size: 0.78rem;
        }
        .turnero-admin-queue-surface-adoption-console__form-grid input,
        .turnero-admin-queue-surface-adoption-console__form-grid select,
        .turnero-admin-queue-surface-adoption-console__form-grid textarea {
            min-height: 38px;
            padding: 0.48rem 0.62rem;
            border-radius: 12px;
            border: 1px solid rgb(15 23 32 / 14%);
            background: rgb(255 255 255 / 96%);
            color: inherit;
            font: inherit;
        }
        .turnero-admin-queue-surface-adoption-console__form-grid textarea {
            min-height: 84px;
            resize: vertical;
        }
        .turnero-admin-queue-surface-adoption-console__form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
            align-items: end;
        }
        .turnero-admin-queue-surface-adoption-console__list {
            display: grid;
            gap: 0.45rem;
        }
        .turnero-admin-queue-surface-adoption-console__item {
            display: flex;
            justify-content: space-between;
            gap: 0.7rem;
            align-items: flex-start;
            padding: 0.72rem 0.8rem;
            border-radius: 16px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 76%);
        }
        .turnero-admin-queue-surface-adoption-console__item p {
            margin: 0.08rem 0 0;
        }
        .turnero-admin-queue-surface-adoption-console__brief {
            margin: 0;
            padding: 0.85rem 0.95rem;
            border-radius: 18px;
            border: 1px solid rgb(15 23 32 / 10%);
            background: rgb(255 255 255 / 82%);
            white-space: pre-wrap;
            font-size: 0.84rem;
            line-height: 1.5;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getScope(input = {}) {
    return toString(
        input.scope ||
            input.clinicProfile?.region ||
            input.clinicProfile?.branding?.city ||
            'regional',
        'regional'
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

function getClinicLabel(clinicProfile = {}) {
    return toString(
        clinicProfile?.branding?.name || clinicProfile?.branding?.short_name,
        ''
    );
}

function normalizeSeed(seed = {}, clinicProfile = null) {
    const source = asObject(seed);
    const surfaceKey = toString(source.surfaceKey, 'operator-turnos');
    const normalizedSurfaceKey = surfaceKey
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    const role =
        normalizedSurfaceKey === 'kiosco-turnos'
            ? 'frontdesk'
            : normalizedSurfaceKey === 'sala-turnos'
              ? 'display'
              : 'operator';

    return {
        scope: toString(source.scope, getScope({ clinicProfile })),
        surfaceKey: normalizedSurfaceKey,
        surfaceId: toString(
            source.surfaceId,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? 'kiosk'
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'sala_tv'
                  : 'operator'
        ),
        surfaceLabel: toString(
            source.surfaceLabel,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? 'Turnero Kiosco'
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'Turnero Sala TV'
                  : 'Turnero Operador'
        ),
        role,
        roleLabel: toString(
            source.roleLabel,
            role === 'frontdesk'
                ? 'Recepcion'
                : role === 'display'
                  ? 'Pantalla'
                  : 'Operador'
        ),
        handoffMode: toString(
            source.handoffMode,
            role === 'operator'
                ? 'guided'
                : role === 'display'
                  ? 'broadcast'
                  : 'manual'
        ),
        currentRoute: toString(source.currentRoute, ''),
        runtimeState: source.runtimeState || {
            state: 'watch',
            summary: 'Runtime en observacion.',
        },
        truthState: toString(source.truthState, 'aligned'),
    };
}

function getCurrentRoute() {
    if (
        typeof window === 'undefined' ||
        !window.location ||
        typeof window.location.pathname !== 'string'
    ) {
        return '';
    }

    return `${window.location.pathname || ''}${window.location.search || ''}${
        window.location.hash || ''
    }`;
}

function resolveSnapshotSeeds(input = {}, clinicProfile = null) {
    const provided = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];

    if (provided.length > 0) {
        return provided.map((seed) => normalizeSeed(seed, clinicProfile));
    }

    return ['operator-turnos', 'kiosco-turnos', 'sala-turnos'].map(
        (surfaceKey) =>
            normalizeSeed(
                {
                    surfaceKey,
                    scope: getScope({ clinicProfile }),
                },
                clinicProfile
            )
    );
}

function normalizeRegistrySnapshot(registry = {}) {
    const source = asObject(registry);
    return {
        ...source,
        surfaces: Array.isArray(source.surfaces) ? source.surfaces : [],
        manifest:
            source.manifest && typeof source.manifest === 'object'
                ? source.manifest
                : null,
        warnings: Array.isArray(source.warnings) ? source.warnings : [],
        errors: Array.isArray(source.errors) ? source.errors : [],
        loadedAt: toString(source.loadedAt, new Date().toISOString()),
        mode: toString(source.mode, 'unknown'),
        manifestSource: toString(source.manifestSource, 'missing'),
    };
}

function buildSurfacePack(
    seed,
    registry,
    clinicProfile,
    trainingLedger,
    ackStore
) {
    const normalizedSeed = normalizeSeed(seed, clinicProfile);
    return buildTurneroSurfaceAdoptionPack({
        ...normalizedSeed,
        registry: normalizeRegistrySnapshot(registry),
        clinicProfile,
        trainingLedger,
        ackStore,
    });
}

function buildConsoleMetrics(surfacePacks = []) {
    const totals = {
        total: surfacePacks.length,
        ready: 0,
        watch: 0,
        degraded: 0,
        blocked: 0,
        score: 0,
        training: 0,
        manualHandoff: 0,
        acknowledgements: 0,
        checklistPass: 0,
        checklistTotal: 0,
    };

    surfacePacks.forEach((pack) => {
        const band = toString(pack.band || pack.gate?.band, 'watch');
        if (band in totals) {
            totals[band] += 1;
        }
        totals.score += Number(pack.score || pack.gate?.score || 0) || 0;
        totals.training += Number(pack.readout?.trainingCount || 0) || 0;
        totals.manualHandoff +=
            Number(pack.readout?.manualHandoffCount || 0) || 0;
        totals.acknowledgements +=
            Number(pack.readout?.acknowledgementCount || 0) || 0;
        totals.checklistPass +=
            Number(pack.readout?.checklistPassCount || 0) || 0;
        totals.checklistTotal +=
            Number(pack.readout?.checklistTotalCount || 0) || 0;
    });

    totals.score = surfacePacks.length
        ? Math.round(totals.score / surfacePacks.length)
        : 0;

    return totals;
}

function buildAggregateGate(metrics = {}) {
    const total = Number(metrics.total || 0) || 0;
    const ready = Number(metrics.ready || 0) || 0;
    const watch = Number(metrics.watch || 0) || 0;
    const degraded = Number(metrics.degraded || 0) || 0;
    const blocked = Number(metrics.blocked || 0) || 0;

    let band = 'watch';
    if (blocked > 0) {
        band = 'blocked';
    } else if (degraded > 0) {
        band = 'degraded';
    } else if (total > 0 && ready === total) {
        band = 'ready';
    } else if (watch > 0) {
        band = 'watch';
    }

    const score = Number(metrics.score || 0) || 0;
    const decision =
        band === 'ready'
            ? 'adoption-go'
            : band === 'degraded'
              ? 'stabilize-adoption'
              : band === 'blocked'
                ? 'hold-adoption'
                : 'review-adoption-evidence';

    return {
        band,
        score,
        decision,
        summary:
            band === 'ready'
                ? 'Las tres superficies quedaron alineadas para adopcion.'
                : band === 'blocked'
                  ? 'Al menos una superficie esta bloqueada.'
                  : band === 'degraded'
                    ? 'Hay drift visible en una o mas superficies.'
                    : 'La adopcion sigue en observacion.',
    };
}

function buildEvidenceEntries(surfacePacks = []) {
    return surfacePacks
        .flatMap((pack) => {
            const label = toString(
                pack.readout?.surfaceLabel || pack.snapshot?.surfaceLabel,
                pack.surfaceKey || 'surface'
            );
            return [
                ...toArray(pack.trainingEntries).map((entry) => ({
                    ...entry,
                    surfaceLabel: label,
                })),
                ...toArray(pack.ackEntries).map((entry) => ({
                    ...entry,
                    surfaceLabel: label,
                })),
            ];
        })
        .sort((left, right) => {
            const leftTime = Date.parse(
                String(left.updatedAt || left.createdAt || left.at || '')
            );
            const rightTime = Date.parse(
                String(right.updatedAt || right.createdAt || right.at || '')
            );
            const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
            const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
            return (
                safeRight - safeLeft ||
                String(right.id).localeCompare(String(left.id))
            );
        });
}

function buildChipHtml(chip = {}) {
    const state = toString(chip.state, 'warning');
    return `
        <span class="turnero-surface-ops__chip" data-state="${escapeHtml(state)}">
            <span>${escapeHtml(chip.label || '')}</span>
            <strong>${escapeHtml(chip.value || '')}</strong>
        </span>
    `;
}

function buildSurfaceEvidenceHtml(entries = [], emptyLabel = '') {
    const rows = toArray(entries);
    if (rows.length === 0) {
        return `<p class="turnero-surface-ops-console__empty">${escapeHtml(
            emptyLabel || 'Sin evidencia registrada.'
        )}</p>`;
    }

    return `
        <ul class="turnero-surface-ops-console__list turnero-admin-queue-surface-adoption-console__evidence-list">
            ${rows
                .map(
                    (item) => `
                        <li class="turnero-admin-queue-surface-adoption-console__item" data-evidence-id="${escapeHtml(
                            item.id
                        )}">
                            <div>
                                <strong>${escapeHtml(
                                    item.title || item.kind || 'Evidence'
                                )}</strong>
                                <p>${escapeHtml(
                                    `${item.surfaceLabel || item.surfaceKey || 'surface'} · ${item.kind || 'training'} · ${formatTimestamp(
                                        item.updatedAt ||
                                            item.createdAt ||
                                            item.at
                                    )}`
                                )}</p>
                                <p>${escapeHtml(item.detail || item.note || '')}</p>
                            </div>
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function buildSurfaceCardHtml(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const readout = asObject(pack.readout);
    const gate = asObject(pack.gate);
    const checklist = asObject(snapshot.checklist);
    const chips = Array.isArray(readout.chips) ? readout.chips : [];
    const surfaceKey = toString(
        snapshot.surfaceKey,
        pack.surfaceKey || 'surface'
    );

    return `
        <article
            class="turnero-admin-queue-surface-adoption-console__surface turnero-surface-ops-console__surface"
            data-state="${escapeHtml(toString(pack.band || gate.band, 'watch'))}"
            data-surface-key="${escapeHtml(surfaceKey)}"
        >
            <div class="turnero-surface-ops-console__surface-header">
                <div>
                    <strong class="turnero-surface-ops-console__surface-title">
                        ${escapeHtml(readout.surfaceLabel || snapshot.surfaceLabel || surfaceKey)}
                    </strong>
                    <p class="turnero-surface-ops-console__meta">
                        ${escapeHtml(
                            `${toString(readout.roleLabel, readout.role || 'surface')} · ${toString(readout.handoffMode, 'manual')} · ${toString(snapshot.expectedRoute, '')}`
                        )}
                    </p>
                </div>
                <span class="queue-app-card__tag">${escapeHtml(
                    `${toString(pack.band || gate.band, 'watch')} · ${Number(
                        pack.score || gate.score || 0
                    )}`
                )}</span>
            </div>
            <p class="turnero-surface-ops-console__meta">${escapeHtml(
                readout.summary || gate.summary || ''
            )}</p>
            <p class="turnero-surface-ops-console__meta">${escapeHtml(
                readout.detail || gate.summary || ''
            )}</p>
            <div class="turnero-admin-queue-surface-adoption-console__surface-chips">
                ${chips.map((chip) => buildChipHtml(chip)).join('')}
            </div>
            <div class="turnero-admin-queue-surface-adoption-console__surface-grid">
                <div>
                    <dt>Truth</dt>
                    <dd>${escapeHtml(toString(snapshot.truth?.state, 'watch'))}</dd>
                </div>
                <div>
                    <dt>Runtime</dt>
                    <dd>${escapeHtml(toString(snapshot.runtime?.state, 'watch'))}</dd>
                </div>
                <div>
                    <dt>Checklist</dt>
                    <dd>${escapeHtml(
                        `${Number(checklist.summary?.pass || 0)}/${Number(
                            checklist.summary?.all || 0
                        )}`
                    )}</dd>
                </div>
                <div>
                    <dt>Score</dt>
                    <dd>${escapeHtml(
                        `${Number(pack.score || gate.score || 0)}/100`
                    )}</dd>
                </div>
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Training</h4>
                ${buildSurfaceEvidenceHtml(
                    toArray(pack.trainingEntries).filter(
                        (entry) => entry.kind === 'training'
                    ),
                    'Sin training registrado.'
                )}
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Manual handoff</h4>
                ${buildSurfaceEvidenceHtml(
                    toArray(pack.trainingEntries).filter(
                        (entry) => entry.kind === 'manual_handoff'
                    ),
                    'Sin handoff manual registrado.'
                )}
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Acknowledgements</h4>
                ${buildSurfaceEvidenceHtml(
                    toArray(pack.ackEntries),
                    'Sin acknowledgements registrados.'
                )}
            </div>
            <div class="turnero-surface-ops-console__actions turnero-admin-queue-surface-adoption-console__surface-actions">
                <button
                    type="button"
                    class="turnero-surface-ops-console__button"
                    data-action="clear-surface-training"
                    data-surface-key="${escapeHtml(surfaceKey)}"
                >
                    Clear training
                </button>
                <button
                    type="button"
                    class="turnero-surface-ops-console__button"
                    data-action="clear-surface-acknowledgements"
                    data-surface-key="${escapeHtml(surfaceKey)}"
                >
                    Clear acknowledgements
                </button>
            </div>
        </article>
    `;
}

function buildEvidenceFormHtml(state) {
    const surfaceOptions = toArray(state.surfacePacks)
        .map(
            (pack) => `
                <option value="${escapeHtml(pack.surfaceKey || pack.snapshot?.surfaceKey || '')}">
                    ${escapeHtml(pack.readout?.surfaceLabel || pack.snapshot?.surfaceLabel || pack.surfaceKey || '')}
                </option>
            `
        )
        .join('');

    return `
        <form class="turnero-admin-queue-surface-adoption-console__form-grid" data-role="evidence-form">
            <label>
                <span>Surface</span>
                <select data-field="surface-key">
                    ${surfaceOptions}
                </select>
            </label>
            <label>
                <span>Type</span>
                <select data-field="kind">
                    <option value="training">training</option>
                    <option value="manual_handoff">manual_handoff</option>
                    <option value="ack">ack</option>
                </select>
            </label>
            <label>
                <span>Title</span>
                <input type="text" data-field="title" value="Training readiness" />
            </label>
            <label>
                <span>Owner</span>
                <input type="text" data-field="owner" value="ops" />
            </label>
            <label style="grid-column: 1 / -1;">
                <span>Note</span>
                <textarea data-field="note" placeholder="Notes for adoption evidence"></textarea>
            </label>
            <div class="turnero-admin-queue-surface-adoption-console__form-actions" style="grid-column: 1 / -1;">
                <button type="submit" class="turnero-surface-ops-console__button" data-action="add-evidence" data-tone="primary">
                    Add evidence
                </button>
                <button type="button" class="turnero-surface-ops-console__button" data-action="clear-selected-surface">
                    Clear selected surface
                </button>
            </div>
        </form>
    `;
}

function buildMetricsHtml(state) {
    const metrics = asObject(state.metrics);
    return `
        <article class="turnero-admin-queue-surface-adoption-console__metric">
            <span>Surfaces</span>
            <strong>${escapeHtml(String(metrics.total || 0))}</strong>
            <span>${escapeHtml(
                `${String(metrics.ready || 0)} ready · ${String(metrics.watch || 0)} watch`
            )}</span>
        </article>
        <article class="turnero-admin-queue-surface-adoption-console__metric">
            <span>Gate</span>
            <strong>${escapeHtml(`${toString(state.gate.band, 'watch')} · ${Number(state.gate.score || 0)}`)}</strong>
            <span>${escapeHtml(toString(state.gate.decision, 'review-adoption-evidence'))}</span>
        </article>
        <article class="turnero-admin-queue-surface-adoption-console__metric">
            <span>Checklist</span>
            <strong>${escapeHtml(
                `${String(metrics.checklistPass || 0)}/${String(metrics.checklistTotal || 0)}`
            )}</strong>
            <span>${escapeHtml(
                `${String(metrics.training || 0)} training · ${String(
                    metrics.manualHandoff || 0
                )} handoff`
            )}</span>
        </article>
        <article class="turnero-admin-queue-surface-adoption-console__metric">
            <span>Acks</span>
            <strong>${escapeHtml(String(metrics.acknowledgements || 0))}</strong>
            <span>${escapeHtml(`Registry ${toString(state.registry?.mode, 'unknown')}`)}</span>
        </article>
    `;
}

function buildConsoleBrief(state) {
    const lines = [
        '# Surface adoption brief',
        `Scope: ${state.scope}`,
        `Registry: ${toString(state.registry?.mode, 'unknown')} · manifest ${toString(
            state.registry?.manifest?.version,
            state.manifestVersion || 'n/a'
        )}`,
        `Aggregate: ${toString(state.gate.band, 'watch')} · ${Number(
            state.metrics.ready || 0
        )}/${Number(state.metrics.total || 0)} ready · score ${Number(
            state.gate.score || 0
        )}/100`,
        '',
        '## Surfaces',
    ];

    toArray(state.surfacePacks).forEach((pack) => {
        const readout = asObject(pack.readout);
        lines.push(
            `- ${toString(readout.surfaceLabel, pack.surfaceKey)} · ${toString(
                pack.band || pack.gate?.band,
                'watch'
            )} · ${Number(readout.checklistPassCount || 0)}/${Number(
                readout.checklistTotalCount || 0
            )} checks · training ${Number(
                readout.trainingCount || 0
            )} · handoff ${Number(
                readout.manualHandoffCount || 0
            )} · ack ${Number(readout.acknowledgementCount || 0)}`
        );
    });

    lines.push(
        '',
        `Training entries: ${Number(state.metrics.training || 0)}`,
        `Manual handoffs: ${Number(state.metrics.manualHandoff || 0)}`,
        `Acknowledgements: ${Number(state.metrics.acknowledgements || 0)}`
    );

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        registry: state.registry,
        snapshotSeeds: state.snapshotSeeds,
        surfacePacks: toArray(state.surfacePacks).map((pack) => ({
            surfaceKey: pack.surfaceKey,
            surfaceId: pack.surfaceId,
            surfaceToken: pack.surfaceToken,
            snapshot: pack.snapshot,
            gate: pack.gate,
            readout: pack.readout,
            score: pack.score,
            band: pack.band,
            decision: pack.decision,
            chips: pack.chips,
            trainingEntries: pack.trainingEntries,
            ackEntries: pack.ackEntries,
            generatedAt: pack.generatedAt,
        })),
        evidence: buildEvidenceEntries(state.surfacePacks),
        metrics: state.metrics,
        gate: state.gate,
        brief: state.brief,
        generatedAt: state.generatedAt,
        currentRoute: getCurrentRoute(),
    };
}

function renderConsoleHtml(state) {
    const surfaceCards = toArray(state.surfacePacks)
        .map((pack) => buildSurfaceCardHtml(pack))
        .join('');
    const evidenceEntries = toArray(state.evidenceEntries);
    const brief = state.brief || buildConsoleBrief(state);

    return `
        <section
            class="turnero-surface-ops-console turnero-admin-queue-surface-adoption-console"
            data-scope="${escapeHtml(state.scope)}"
            data-state="${escapeHtml(toString(state.gate.band, 'watch'))}"
        >
            <div class="turnero-surface-ops-console__header">
                <div class="turnero-admin-queue-surface-adoption-console__header-copy">
                    <p class="turnero-surface-ops-console__surface-title">Surface adoption</p>
                    <h3>Surface Adoption Console</h3>
                    <p>
                        ${escapeHtml(
                            `Scope ${state.scope} · ${String(
                                state.surfacePacks.length
                            )} surfaces · registry ${toString(
                                state.registry?.mode,
                                'unknown'
                            )} · ${toString(
                                state.registry?.manifestSource,
                                'missing'
                            )}`
                        )}
                    </p>
                </div>
                <div class="turnero-surface-ops-console__actions">
                    <button type="button" class="turnero-surface-ops-console__button" data-action="copy-brief" data-tone="primary">
                        Copy brief
                    </button>
                    <button type="button" class="turnero-surface-ops-console__button" data-action="download-json">
                        Download JSON
                    </button>
                </div>
            </div>
            <div class="turnero-surface-ops-console__grid">
                ${buildMetricsHtml(state)}
            </div>
            <div class="turnero-surface-ops-console__grid">
                ${surfaceCards}
            </div>
            <div class="turnero-surface-ops-console__section">
                <h4>Evidence capture</h4>
                ${buildEvidenceFormHtml(state)}
                <div class="turnero-surface-ops-console__section">
                    <h4>Recent evidence</h4>
                    ${buildSurfaceEvidenceHtml(
                        evidenceEntries,
                        'Sin evidencia capturada.'
                    )}
                </div>
            </div>
            <pre class="turnero-admin-queue-surface-adoption-console__brief" data-role="brief">${escapeHtml(
                brief
            )}</pre>
        </section>
    `;
}

function buildConsoleState(input = {}, registry = null, currentState = {}) {
    const previousState = asObject(currentState);
    const clinicProfile = asObject(
        input.clinicProfile || previousState.clinicProfile
    );
    const scope = toString(
        input.scope || previousState.scope || getScope({ clinicProfile }),
        'regional'
    );
    const trainingLedger =
        previousState.trainingLedger ||
        input.trainingLedger ||
        createTurneroSurfaceTrainingLedger(scope, clinicProfile);
    const ackStore =
        previousState.ackStore ||
        input.ackStore ||
        createTurneroSurfaceOperatorAckStore(scope, clinicProfile);
    const snapshotSeeds = resolveSnapshotSeeds(input, clinicProfile);
    const normalizedRegistry = normalizeRegistrySnapshot(registry);
    const surfacePacks = snapshotSeeds.map((seed) =>
        buildSurfacePack(
            seed,
            normalizedRegistry,
            clinicProfile,
            trainingLedger,
            ackStore
        )
    );
    const metrics = buildConsoleMetrics(surfacePacks);
    const gate = buildAggregateGate(metrics);
    const evidenceEntries = buildEvidenceEntries(surfacePacks);
    const manifestVersion = toString(
        normalizedRegistry.manifest?.version,
        toString(input.manifestVersion, '')
    );
    const generatedAt = new Date().toISOString();
    const brief = buildConsoleBrief({
        scope,
        registry: normalizedRegistry,
        manifestVersion,
        surfacePacks,
        metrics,
        gate,
    });

    return {
        scope,
        clinicProfile,
        clinicId: toString(
            clinicProfile?.clinic_id || clinicProfile?.clinicId,
            ''
        ),
        clinicLabel: getClinicLabel(clinicProfile),
        snapshotSeeds,
        registry: normalizedRegistry,
        manifestVersion,
        trainingLedger,
        ackStore,
        surfacePacks,
        evidenceEntries,
        metrics,
        gate,
        brief,
        generatedAt,
        currentRoute: getCurrentRoute(),
    };
}

function bindConsoleActions(root, controller) {
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.turneroAdoptionConsoleBound === 'true'
    ) {
        return;
    }

    root.dataset.turneroAdoptionConsoleBound = 'true';

    root.addEventListener('click', async (event) => {
        const actionTarget =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!(actionTarget instanceof HTMLElement)) {
            return;
        }

        const action = toString(actionTarget.dataset.action);
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyTextToClipboard(controller.state.brief);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-adoption-console.json',
                buildDownloadSnapshot(controller.state)
            );
            return;
        }

        if (action === 'clear-surface-training') {
            const surfaceKey = toString(actionTarget.dataset.surfaceKey);
            if (surfaceKey) {
                controller.state.trainingLedger.clear({
                    surfaceKey,
                    kind: 'training',
                });
                controller.refresh();
            }
            return;
        }

        if (action === 'clear-surface-acknowledgements') {
            const surfaceKey = toString(actionTarget.dataset.surfaceKey);
            if (surfaceKey) {
                controller.state.ackStore.clear({ surfaceKey });
                controller.refresh();
            }
            return;
        }

        if (action === 'clear-selected-surface') {
            const form = root.querySelector('[data-role="evidence-form"]');
            const surfaceField =
                form instanceof HTMLFormElement
                    ? form.querySelector('[data-field="surface-key"]')
                    : null;
            const surfaceKey = toString(surfaceField?.value);
            if (surfaceKey) {
                controller.state.trainingLedger.clear({ surfaceKey });
                controller.state.ackStore.clear({ surfaceKey });
                controller.refresh();
            }
        }
    });

    root.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }
        if (!form.matches('[data-role="evidence-form"]')) {
            return;
        }

        event.preventDefault();
        const surfaceKey = toString(
            form.querySelector('[data-field="surface-key"]')?.value,
            controller.state.surfacePacks[0]?.snapshot?.surfaceKey || 'operator'
        );
        const kind = toString(
            form.querySelector('[data-field="kind"]')?.value,
            'training'
        );
        const title = toString(
            form.querySelector('[data-field="title"]')?.value
        );
        const owner = toString(
            form.querySelector('[data-field="owner"]')?.value,
            'ops'
        );
        const note = toString(form.querySelector('[data-field="note"]')?.value);

        if (kind === 'ack') {
            controller.state.ackStore.addAck({
                surfaceKey,
                title: title || 'Operator acknowledgement',
                note,
                owner,
                source: 'manual',
                state: 'recorded',
            });
        } else if (kind === 'manual_handoff') {
            controller.state.trainingLedger.addManualHandoff({
                surfaceKey,
                title: title || 'Manual handoff evidence',
                detail: note,
                owner,
                source: 'manual',
                state: 'recorded',
            });
        } else {
            controller.state.trainingLedger.addTraining({
                surfaceKey,
                title: title || 'Training readiness',
                detail: note,
                owner,
                source: 'manual',
                state: 'recorded',
            });
        }

        const surfaceField = form.querySelector('[data-field="surface-key"]');
        const kindField = form.querySelector('[data-field="kind"]');
        const titleField = form.querySelector('[data-field="title"]');
        const noteField = form.querySelector('[data-field="note"]');
        const ownerField = form.querySelector('[data-field="owner"]');

        if (surfaceField && 'value' in surfaceField) {
            surfaceField.value = surfaceKey;
        }
        if (kindField && 'value' in kindField) {
            kindField.value = 'training';
        }
        if (titleField && 'value' in titleField) {
            titleField.value = 'Training readiness';
        }
        if (noteField && 'value' in noteField) {
            noteField.value = '';
        }
        if (ownerField && 'value' in ownerField) {
            ownerField.value = 'ops';
        }

        controller.refresh();
    });
}

function renderAdoptionConsole(controller) {
    controller.state = buildConsoleState(
        controller.input,
        controller.registry,
        controller.state
    );
    controller.root.innerHTML = renderConsoleHtml(controller.state);
    return controller.state;
}

export function buildTurneroAdminQueueSurfaceAdoptionConsoleHtml(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope || getScope({ clinicProfile }),
        'regional'
    );
    const trainingLedger =
        input.trainingLedger ||
        createTurneroSurfaceTrainingLedger(scope, clinicProfile);
    const ackStore =
        input.ackStore ||
        createTurneroSurfaceOperatorAckStore(scope, clinicProfile);
    return renderConsoleHtml(
        buildConsoleState(
            {
                ...input,
                scope,
                clinicProfile,
                trainingLedger,
                ackStore,
            },
            input.registry || null
        )
    );
}

export function mountTurneroAdminQueueSurfaceAdoptionConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureAdoptionConsoleStyles();

    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope || getScope({ clinicProfile }),
        'regional'
    );
    const trainingLedger =
        input.trainingLedger ||
        createTurneroSurfaceTrainingLedger(scope, clinicProfile);
    const ackStore =
        input.ackStore ||
        createTurneroSurfaceOperatorAckStore(scope, clinicProfile);
    const controller = {
        root: document.createElement('section'),
        input: {
            ...input,
            scope,
            clinicProfile,
            trainingLedger,
            ackStore,
        },
        registry: normalizeRegistrySnapshot(input.registry || null),
        state: null,
        refresh: null,
        destroy: null,
    };

    controller.root.className =
        'turnero-surface-ops-console turnero-admin-queue-surface-adoption-console';

    controller.refresh = () => {
        return renderAdoptionConsole(controller);
    };
    controller.destroy = () => {
        controller.root.remove();
    };

    bindConsoleActions(controller.root, controller);
    controller.refresh();
    host.replaceChildren(controller.root);

    if (!input.registry) {
        void loadTurneroSurfaceRegistrySource(getRegistryOptions(input)).then(
            (registry) => {
                controller.registry = normalizeRegistrySnapshot(registry);
                controller.refresh();
            }
        );
    }

    return controller;
}
