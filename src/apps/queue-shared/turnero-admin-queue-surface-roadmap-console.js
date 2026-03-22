import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { buildTurneroSurfaceRoadmapPack } from './turnero-surface-roadmap-pack.js';
import { buildTurneroSurfaceRoadmapReadout } from './turnero-surface-roadmap-readout.js';
import {
    buildTurneroSurfaceRoadmapSnapshot,
    normalizeTurneroSurfaceRoadmapSurfaceKey,
} from './turnero-surface-roadmap-snapshot.js';
import { createTurneroSurfaceRoadmapLedger } from './turnero-surface-roadmap-ledger.js';
import { createTurneroSurfaceRoadmapOwnerStore } from './turnero-surface-roadmap-owner-store.js';
import { buildTurneroSurfaceRoadmapGate } from './turnero-surface-roadmap-gate.js';
import { mountTurneroSurfaceRoadmapBanner } from './turnero-surface-roadmap-banner.js';
import {
    ensureTurneroSurfaceOpsStyles,
    mountTurneroSurfaceCheckpointChip,
} from './turnero-surface-checkpoint-chip.js';
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

const STYLE_ID = 'turneroAdminQueueSurfaceRoadmapConsoleInlineStyles';
const SURFACE_ORDER = Object.freeze([
    'operator-turnos',
    'kiosco-turnos',
    'sala-turnos',
]);
const SURFACE_LABELS = Object.freeze({
    'operator-turnos': 'Turnero Operador',
    'kiosco-turnos': 'Turnero Kiosco',
    'sala-turnos': 'Turnero Sala TV',
});

function ensureStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-roadmap-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-roadmap-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-queue-surface-roadmap-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-roadmap-console__eyebrow,.turnero-admin-queue-surface-roadmap-console__summary,.turnero-admin-queue-surface-roadmap-console__section h4,.turnero-admin-queue-surface-roadmap-console__section p{margin:0}
        .turnero-admin-queue-surface-roadmap-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-roadmap-console__actions,.turnero-admin-queue-surface-roadmap-console__form-actions,.turnero-admin-queue-surface-roadmap-console__section-header,.turnero-admin-queue-surface-roadmap-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-roadmap-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-roadmap-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-roadmap-console__banner-host{min-height:1px}
        .turnero-admin-queue-surface-roadmap-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-roadmap-console__metric{display:grid;gap:.2rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-roadmap-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-roadmap-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-roadmap-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-roadmap-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-roadmap-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-roadmap-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-roadmap-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-roadmap-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-roadmap-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-roadmap-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-roadmap-console__surface-title p,.turnero-admin-queue-surface-roadmap-console__surface-meta,.turnero-admin-queue-surface-roadmap-console__entry-meta{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-roadmap-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-roadmap-console__surface-summary,.turnero-admin-queue-surface-roadmap-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-roadmap-console__surface-banner-host{min-height:1px}
        .turnero-admin-queue-surface-roadmap-console__surface-chip-row{gap:.45rem}
        .turnero-admin-queue-surface-roadmap-console__surface-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.45rem}
        .turnero-admin-queue-surface-roadmap-console__stat{display:grid;gap:.18rem;padding:.68rem .74rem;border-radius:16px;border:1px solid rgb(15 23 32 / 9%);background:rgb(255 255 255 / 74%)}
        .turnero-admin-queue-surface-roadmap-console__stat strong{font-size:.83rem;text-transform:uppercase;letter-spacing:.08em;opacity:.7}
        .turnero-admin-queue-surface-roadmap-console__stat span,.turnero-admin-queue-surface-roadmap-console__stat p{margin:0;font-size:.82rem;line-height:1.45}
        .turnero-admin-queue-surface-roadmap-console__section{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-roadmap-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-roadmap-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-roadmap-console__form input,.turnero-admin-queue-surface-roadmap-console__form select,.turnero-admin-queue-surface-roadmap-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-roadmap-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-roadmap-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-roadmap-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-roadmap-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-roadmap-console__entry-badge{padding:.28rem .5rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.74rem;white-space:nowrap}
        .turnero-admin-queue-surface-roadmap-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-roadmap-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-roadmap-console__header,.turnero-admin-queue-surface-roadmap-console__surface-header,.turnero-admin-queue-surface-roadmap-console__entry-head{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'queue-roadmap',
        'queue-roadmap'
    );
}

function getSurfaceLabel(surfaceKey, clinicProfile, surfaceRegistry = {}) {
    const normalizedSurfaceKey = normalizeTurneroSurfaceRoadmapSurfaceKey(
        surfaceKey
    );
    const registryEntry = asObject(
        surfaceRegistry?.[normalizedSurfaceKey] ||
            surfaceRegistry?.[
                normalizedSurfaceKey === 'operator-turnos'
                    ? 'operator'
                    : normalizedSurfaceKey === 'kiosco-turnos'
                      ? 'kiosk'
                      : 'display'
            ]
    );

    return toString(
        registryEntry.label ||
            registryEntry.title ||
            registryEntry.shortLabel,
        buildTurneroSurfaceRoadmapSnapshot({
            surfaceKey: normalizedSurfaceKey,
            clinicProfile,
            surfaceRegistry,
        }).surfaceLabel || SURFACE_LABELS[normalizedSurfaceKey]
    );
}

function resolveSurfaceOptions(input = {}, clinicProfile = null) {
    const surfaceRegistry = asObject(input.surfaceRegistry);
    return SURFACE_ORDER.map((surfaceKey) => ({
        surfaceKey,
        label: getSurfaceLabel(surfaceKey, clinicProfile, surfaceRegistry),
    }));
}

function buildDefaultChecklist(surfaceKey) {
    return surfaceKey === 'kiosco-turnos'
        ? { summary: { all: 4, pass: 2, fail: 2 } }
        : { summary: { all: 4, pass: 3, fail: 1 } };
}

function buildDefaultSurfaceSeed(
    surfaceKey,
    clinicProfile,
    scope,
    surfaceRegistry = {}
) {
    const baseSeed =
        {
            'operator-turnos': {
                runtimeState: 'ready',
                truth: 'watch',
                roadmapBand: 'core',
                backlogState: 'curated',
                nextAction: 'stabilize-operator-lane',
                priorityBand: 'p1',
                roadmapOwner: 'ops-lead',
            },
            'kiosco-turnos': {
                runtimeState: 'ready',
                truth: 'watch',
                roadmapBand: 'watch',
                backlogState: 'draft',
                nextAction: 'close-hardware-gaps',
                priorityBand: 'p2',
                roadmapOwner: '',
            },
            'sala-turnos': {
                runtimeState: 'ready',
                truth: 'aligned',
                roadmapBand: 'core',
                backlogState: 'curated',
                nextAction: 'analytics-board',
                priorityBand: 'p1',
                roadmapOwner: 'ops-display',
            },
        }[surfaceKey] || {};

    return buildTurneroSurfaceRoadmapSnapshot({
        ...baseSeed,
        scope,
        surfaceKey,
        clinicProfile,
        surfaceRegistry,
        updatedAt: new Date().toISOString(),
    });
}

function normalizeSeedSnapshot(
    seed,
    clinicProfile,
    scope,
    fallbackSurfaceKey,
    surfaceRegistry = {}
) {
    const source = asObject(seed);
    const snapshotSource = asObject(source.snapshot || source.pack?.snapshot || source);
    const normalizedSurfaceKey = normalizeTurneroSurfaceRoadmapSurfaceKey(
        snapshotSource.surfaceKey || source.surfaceKey || fallbackSurfaceKey
    );
    const baseSnapshot = buildTurneroSurfaceRoadmapSnapshot({
        ...snapshotSource,
        scope,
        surfaceKey: normalizedSurfaceKey,
        clinicProfile,
        surfaceRegistry,
        runtimeState: toString(
            snapshotSource.runtimeState || source.runtimeState,
            'ready'
        ),
        truth: toString(
            snapshotSource.truth || source.truth,
            normalizedSurfaceKey === 'sala-turnos' ? 'aligned' : 'watch'
        ),
        roadmapBand: toString(
            snapshotSource.roadmapBand || source.roadmapBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'watch' : 'core'
        ),
        backlogState: toString(
            snapshotSource.backlogState || source.backlogState,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'draft' : 'curated'
        ),
        nextAction: toString(
            snapshotSource.nextAction || source.nextAction,
            normalizedSurfaceKey === 'operator-turnos'
                ? 'stabilize-operator-lane'
                : normalizedSurfaceKey === 'kiosco-turnos'
                  ? 'close-hardware-gaps'
                  : 'analytics-board'
        ),
        priorityBand: toString(
            snapshotSource.priorityBand || source.priorityBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'p2' : 'p1'
        ),
        roadmapOwner: toString(
            snapshotSource.roadmapOwner || source.roadmapOwner,
            normalizedSurfaceKey === 'operator-turnos'
                ? 'ops-lead'
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'ops-display'
                  : ''
        ),
        updatedAt: toString(
            snapshotSource.updatedAt || source.updatedAt,
            new Date().toISOString()
        ),
    });

    return {
        ...baseSnapshot,
        checklist:
            source.checklist ||
            snapshotSource.checklist ||
            buildDefaultChecklist(normalizedSurfaceKey),
    };
}

function resolveSurfaceSeeds(input = {}, clinicProfile = null, scope = 'queue-roadmap') {
    const source = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const provided = new Map();

    source.forEach((seed, index) => {
        const snapshot = asObject(seed);
        const normalizedSurfaceKey = normalizeTurneroSurfaceRoadmapSurfaceKey(
            snapshot.surfaceKey || source[index]?.surfaceKey || ''
        );
        if (SURFACE_ORDER.includes(normalizedSurfaceKey)) {
            provided.set(normalizedSurfaceKey, snapshot);
        }
    });

    return SURFACE_ORDER.map((surfaceKey) =>
        normalizeSeedSnapshot(
            provided.get(surfaceKey) ||
                buildDefaultSurfaceSeed(
                    surfaceKey,
                    clinicProfile,
                    scope,
                    asObject(input.surfaceRegistry)
                ),
            clinicProfile,
            scope,
            surfaceKey,
            asObject(input.surfaceRegistry)
        )
    );
}

function normalizeChecklistSummary(checklist = {}) {
    const summary =
        checklist && typeof checklist === 'object' ? checklist.summary : null;
    return {
        all: Math.max(0, Number(summary?.all || 0) || 0),
        pass: Math.max(0, Number(summary?.pass || 0) || 0),
        fail: Math.max(0, Number(summary?.fail || 0) || 0),
    };
}

function resolveChecklist(input = {}, surfacePacks = []) {
    if (input.checklist && input.checklist.summary) {
        return normalizeChecklistSummary(input.checklist);
    }

    return surfacePacks.reduce(
        (accumulator, item) => {
            const summary = normalizeChecklistSummary(item.checklist);
            accumulator.all += summary.all;
            accumulator.pass += summary.pass;
            accumulator.fail += summary.fail;
            return accumulator;
        },
        { all: 0, pass: 0, fail: 0 }
    );
}

function buildSurfacePack(
    seed,
    ledgerRows = [],
    ownerRows = [],
    clinicProfile,
    scope,
    surfaceRegistry
) {
    const normalizedSeed = normalizeSeedSnapshot(
        seed,
        clinicProfile,
        scope,
        seed?.surfaceKey || 'operator-turnos',
        surfaceRegistry
    );
    const surfaceKey = normalizedSeed.surfaceKey;
    const ledger = ledgerRows.filter(
        (entry) =>
            normalizeTurneroSurfaceRoadmapSurfaceKey(entry.surfaceKey) ===
            surfaceKey
    );
    const owners = ownerRows.filter(
        (entry) =>
            normalizeTurneroSurfaceRoadmapSurfaceKey(entry.surfaceKey) ===
            surfaceKey
    );
    const pack = buildTurneroSurfaceRoadmapPack({
        ...normalizedSeed,
        clinicProfile,
        scope,
        surfaceRegistry,
        checklist: normalizedSeed.checklist,
        ledger,
        owners,
    });

    return {
        ...pack,
        surfaceKey: pack.snapshot.surfaceKey,
        label: pack.readout.surfaceLabel,
        ledger,
        owners,
    };
}

function buildOverviewPack(
    input,
    ledgerRows,
    ownerRows,
    clinicProfile,
    scope,
    checklist,
    surfacePacks = []
) {
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        clinicProfile?.branding?.name ||
        clinicProfile?.clinic_id ||
        '';
    const firstP1 = surfacePacks.find(
        (item) => toString(item.readout?.priorityBand, 'p3') === 'p1'
    );
    const firstAttentionSurface =
        surfacePacks.find((item) => item.gate.band !== 'ready') || surfacePacks[0];
    const snapshot = {
        scope,
        surfaceKey: 'roadmap-overview',
        surfaceLabel: 'Roadmap overview',
        surfaceRoute: '/admin.html#queue',
        clinicId: toString(
            clinicProfile?.clinic_id || clinicProfile?.clinicId || clinicProfile?.id,
            ''
        ),
        clinicLabel,
        runtimeState: toString(input.runtimeState, 'watch'),
        truth: toString(input.truth, 'watch'),
        roadmapBand: firstAttentionSurface?.readout?.roadmapBand || 'watch',
        backlogState:
            firstAttentionSurface?.gate?.band === 'ready' ? 'curated' : 'review',
        nextAction:
            firstAttentionSurface?.readout?.nextAction ||
            'review-next-investment',
        priorityBand: firstP1?.readout?.priorityBand || 'p2',
        roadmapOwner:
            firstAttentionSurface?.readout?.roadmapOwner || 'ops-lead',
        updatedAt: new Date().toISOString(),
    };
    const gate = buildTurneroSurfaceRoadmapGate({
        checklist: { summary: checklist },
        ledger: ledgerRows,
        owners: ownerRows,
    });
    const readout = buildTurneroSurfaceRoadmapReadout({
        snapshot,
        gate,
        checklist: { summary: checklist },
        ledger: ledgerRows,
        owners: ownerRows,
    });

    return {
        snapshot,
        checklist: { summary: checklist },
        ledger: ledgerRows,
        owners: ownerRows,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}

function buildConsoleState(input = {}, ledgerRows = [], ownerRows = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveScope(input, clinicProfile);
    const surfaceRegistry = asObject(input.surfaceRegistry);
    const snapshots = resolveSurfaceSeeds(input, clinicProfile, scope);
    const ledger = Array.isArray(ledgerRows) ? ledgerRows.filter(Boolean) : [];
    const owners = Array.isArray(ownerRows) ? ownerRows.filter(Boolean) : [];
    const surfaceOptions = resolveSurfaceOptions(input, clinicProfile);
    const surfacePacks = snapshots.map((seed) =>
        buildSurfacePack(
            seed,
            ledger,
            owners,
            clinicProfile,
            scope,
            surfaceRegistry
        )
    );
    const checklist = resolveChecklist(input, surfacePacks);
    const overviewPack = buildOverviewPack(
        input,
        ledger,
        owners,
        clinicProfile,
        scope,
        checklist,
        surfacePacks
    );
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        '';

    return {
        scope,
        clinicProfile,
        clinicLabel,
        surfaceRegistry,
        releaseManifest: asObject(input.releaseManifest),
        surfaceOptions,
        snapshots,
        surfacePacks,
        ledger,
        owners,
        checklist,
        overviewPack,
        gate: overviewPack.gate,
        readout: overviewPack.readout,
        metrics: {
            totalSurfaces: surfacePacks.length,
            readyCount: surfacePacks.filter((item) => item.gate.band === 'ready').length,
            watchCount: surfacePacks.filter((item) => item.gate.band === 'watch').length,
            degradedCount: surfacePacks.filter((item) => item.gate.band === 'degraded').length,
            blockedCount: surfacePacks.filter((item) => item.gate.band === 'blocked').length,
            ledgerCount: ledger.length,
            ownerCount: owners.length,
            activeOwnerCount: Number(overviewPack.readout.activeOwnerCount || 0) || 0,
            readyLedgerCount: Number(overviewPack.readout.readyLedgerCount || 0) || 0,
            checklistAll: Number(checklist.all || 0) || 0,
            checklistPass: Number(checklist.pass || 0) || 0,
            checklistFail: Number(checklist.fail || 0) || 0,
        },
        brief: '',
        generatedAt: overviewPack.generatedAt,
    };
}

function updateBrief(state) {
    state.brief = [
        '# Surface Roadmap Prioritization',
        `Scope: ${toString(state.scope, 'queue-roadmap')}`,
        `Clinic: ${toString(
            state.clinicLabel || state.clinicProfile?.clinic_id,
            'sin-clinica'
        )}`,
        `Gate: ${toString(state.gate.band, 'blocked')} · ${Number(
            state.gate.score || 0
        )} · ${toString(state.gate.decision, 'stabilize-before-roadmap')}`,
        '',
        ...state.surfacePacks.map(
            (card) =>
                `- ${toString(card.readout.surfaceLabel, card.label || card.snapshot.surfaceKey)}: ${toString(card.gate.band, 'blocked')} · ${Number(card.gate.score || 0)} · ${toString(card.readout.priorityBand, 'p3')} · backlog ${toString(card.readout.backlogState, 'draft')} · next ${toString(card.readout.nextAction, 'sin siguiente accion')} · owner ${toString(card.readout.roadmapOwner, 'sin owner') || 'sin owner'}`
        ),
        '',
        `Roadmap items: ${state.metrics.ledgerCount}`,
        `Owners: ${state.metrics.ownerCount}`,
        `Checklist: ${state.metrics.checklistPass}/${state.metrics.checklistAll} pass`,
    ]
        .join('\n')
        .trim();

    return state.brief;
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        clinicLabel: state.clinicLabel,
        surfaceRegistry: state.surfaceRegistry,
        releaseManifest: state.releaseManifest,
        snapshots: state.snapshots,
        surfacePacks: state.surfacePacks,
        ledger: state.ledger,
        owners: state.owners,
        checklist: state.checklist,
        overviewPack: state.overviewPack,
        gate: state.gate,
        summary: {
            totalSurfaces: state.metrics.totalSurfaces,
            readyCount: state.metrics.readyCount,
            watchCount: state.metrics.watchCount,
            degradedCount: state.metrics.degradedCount,
            blockedCount: state.metrics.blockedCount,
            ledgerCount: state.metrics.ledgerCount,
            ownerCount: state.metrics.ownerCount,
            activeOwnerCount: state.metrics.activeOwnerCount,
            readyLedgerCount: state.metrics.readyLedgerCount,
        },
        brief: state.brief,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
                : '',
    };
}

function readValue(root, selector, fallback = '') {
    const field = root.querySelector(selector);
    return field && 'value' in field
        ? toString(field.value, fallback)
        : toString(fallback);
}

function resetValue(root, selector, value = '') {
    const field = root.querySelector(selector);
    if (field && 'value' in field) {
        field.value = value;
    }
}

function renderMetric(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-roadmap-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-roadmap-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderSurfaceStat(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-roadmap-console__stat">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
            ${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
        </article>
    `;
}

function renderEntryRow(entry, kind) {
    const meta =
        kind === 'ledger'
            ? `${toString(entry.owner, 'ops')} · ${toString(entry.priorityBand, 'p3')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'roadmap')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;
    return `
        <article class="turnero-admin-queue-surface-roadmap-console__entry" data-state="${escapeHtml(toString(entry.status, 'planned'))}">
            <div class="turnero-admin-queue-surface-roadmap-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.title || entry.actor, kind === 'ledger' ? 'Roadmap item' : 'owner')} · status ${toString(entry.status, 'planned')}`)}</strong>
                <span class="turnero-admin-queue-surface-roadmap-console__entry-badge">${escapeHtml(toString(entry.status, 'planned'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-roadmap-console__entry-meta">${escapeHtml(meta)}</p>
            ${
                entry.nextAction
                    ? `<p class="turnero-admin-queue-surface-roadmap-console__entry-note">${escapeHtml(`Next ${entry.nextAction}`)}</p>`
                    : ''
            }
            ${entry.note ? `<p class="turnero-admin-queue-surface-roadmap-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-roadmap-console__list">${entries.map((entry) => renderEntryRow(entry, kind)).join('')}</div>`
        : '<p class="turnero-admin-queue-surface-roadmap-console__empty">Sin entradas todavia.</p>';
}

function renderSurfaceCard(card) {
    return `
        <article class="turnero-admin-queue-surface-roadmap-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(card.gate.band)}">
            <div class="turnero-admin-queue-surface-roadmap-console__surface-header">
                <div class="turnero-admin-queue-surface-roadmap-console__surface-title">
                    <strong>${escapeHtml(card.readout.surfaceLabel)}</strong>
                    <p>${escapeHtml(`${card.readout.surfaceKey} · ${card.readout.surfaceRoute || ''}`)}</p>
                </div>
                <span class="turnero-admin-queue-surface-roadmap-console__surface-badge">${escapeHtml(card.readout.badge)}</span>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-roadmap-console__surface-banner-host"></div>
            <div data-role="chips" class="turnero-admin-queue-surface-roadmap-console__surface-chip-row"></div>
            <p class="turnero-admin-queue-surface-roadmap-console__surface-summary">${escapeHtml(card.readout.summary)}</p>
            <p class="turnero-admin-queue-surface-roadmap-console__surface-meta">${escapeHtml(card.readout.detail)}</p>
            <div class="turnero-admin-queue-surface-roadmap-console__surface-stats">
                ${renderSurfaceStat('Priority', toString(card.readout.priorityBand, 'p3'), `Roadmap ${toString(card.readout.roadmapBand, 'watch')}`)}
                ${renderSurfaceStat('Backlog', toString(card.readout.backlogState, 'draft'), `${Number(card.readout.readyLedgerCount || 0)}/${Number(card.readout.ledgerCount || 0)} ready`)}
                ${renderSurfaceStat('Owner', toString(card.readout.roadmapOwner, 'sin owner') || 'sin owner', `Owners activos ${Number(card.readout.activeOwnerCount || 0)}/${Number(card.readout.ownerCount || 0)}`)}
                ${renderSurfaceStat('Next action', toString(card.readout.nextAction, 'sin siguiente accion'), card.readout.updatedAtLabel || '')}
            </div>
        </article>
    `;
}

function renderFormOptions(state) {
    return state.surfaceOptions
        .map(
            (option) => `
                <option value="${escapeHtml(option.surfaceKey)}">${escapeHtml(option.label || option.surfaceKey)}</option>
            `
        )
        .join('');
}

function renderConsoleHtml(state) {
    return `
        <section class="turnero-admin-queue-surface-roadmap-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-roadmap-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-roadmap-console__eyebrow">Turnero roadmap</p>
                    <h3>Surface Roadmap Prioritization</h3>
                    <p class="turnero-admin-queue-surface-roadmap-console__summary">Backlog minimo, owners y gate de siguiente inversion para operator, kiosk y display.</p>
                </div>
                <div class="turnero-admin-queue-surface-roadmap-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-roadmap-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-roadmap-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-roadmap-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-roadmap-console__banner-host"></div>
            <div class="turnero-admin-queue-surface-roadmap-console__metrics">
                ${renderMetric('Surfaces', String(state.metrics.totalSurfaces), `${state.metrics.readyCount} ready · ${state.metrics.watchCount} watch · ${state.metrics.degradedCount} degraded · ${state.metrics.blockedCount} blocked`)}
                ${renderMetric('Gate', `${state.gate.band} · ${Number(state.gate.score || 0)}`, toString(state.gate.decision, 'stabilize-before-roadmap'))}
                ${renderMetric('Checklist', `${state.metrics.checklistPass}/${state.metrics.checklistAll}`, `${state.metrics.checklistFail} fail`)}
                ${renderMetric('Roadmap items', String(state.metrics.ledgerCount), `${state.metrics.readyLedgerCount} ready or planned`)}
                ${renderMetric('Owners', String(state.metrics.ownerCount), `${state.metrics.activeOwnerCount} active`)}
            </div>
            <section class="turnero-admin-queue-surface-roadmap-console__section">
                <div class="turnero-admin-queue-surface-roadmap-console__section-header">
                    <div>
                        <h4>Roadmap surfaces</h4>
                        <p>Un card por surface con banner, chips y siguiente accion visible.</p>
                    </div>
                </div>
                <div class="turnero-admin-queue-surface-roadmap-console__surface-grid">
                    ${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}
                </div>
            </section>
            <section class="turnero-admin-queue-surface-roadmap-console__section">
                <div class="turnero-admin-queue-surface-roadmap-console__section-header">
                    <div>
                        <h4>Add roadmap item</h4>
                        <p>Agrega un item priorizado con owner y siguiente accion.</p>
                    </div>
                </div>
                <form class="turnero-admin-queue-surface-roadmap-console__form" data-action="add-entry">
                    <label>
                        <span>Surface</span>
                        <select data-field="entry-surface-key">${renderFormOptions(state)}</select>
                    </label>
                    <label>
                        <span>Status</span>
                        <select data-field="entry-status">
                            <option value="planned" selected>planned</option>
                            <option value="ready">ready</option>
                            <option value="done">done</option>
                            <option value="approved">approved</option>
                            <option value="watch">watch</option>
                            <option value="blocked">blocked</option>
                            <option value="draft">draft</option>
                        </select>
                    </label>
                    <label>
                        <span>Priority</span>
                        <select data-field="entry-priority-band">
                            <option value="p1">p1</option>
                            <option value="p2" selected>p2</option>
                            <option value="p3">p3</option>
                        </select>
                    </label>
                    <label>
                        <span>Owner</span>
                        <input type="text" data-field="entry-owner" value="ops" />
                    </label>
                    <label>
                        <span>Title</span>
                        <input type="text" data-field="entry-title" value="Roadmap item" />
                    </label>
                    <label>
                        <span>Next action</span>
                        <input type="text" data-field="entry-next-action" value="" />
                    </label>
                    <label style="grid-column:1 / -1;">
                        <span>Note</span>
                        <textarea data-field="entry-note" placeholder="Roadmap note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-roadmap-console__form-actions" style="grid-column:1 / -1;">
                        <button type="submit" class="turnero-admin-queue-surface-roadmap-console__button" data-tone="primary">Add roadmap item</button>
                    </div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
            </section>
            <section class="turnero-admin-queue-surface-roadmap-console__section">
                <div class="turnero-admin-queue-surface-roadmap-console__section-header">
                    <div>
                        <h4>Add owner</h4>
                        <p>Asigna owner de roadmap, producto u operaciones por surface.</p>
                    </div>
                </div>
                <form class="turnero-admin-queue-surface-roadmap-console__form" data-action="add-owner">
                    <label>
                        <span>Surface</span>
                        <select data-field="owner-surface-key">${renderFormOptions(state)}</select>
                    </label>
                    <label>
                        <span>Actor</span>
                        <input type="text" data-field="owner-actor" value="owner" />
                    </label>
                    <label>
                        <span>Role</span>
                        <input type="text" data-field="owner-role" value="roadmap" />
                    </label>
                    <label>
                        <span>Status</span>
                        <input type="text" data-field="owner-status" value="active" />
                    </label>
                    <label style="grid-column:1 / -1;">
                        <span>Note</span>
                        <textarea data-field="owner-note" placeholder="Owner note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-roadmap-console__form-actions" style="grid-column:1 / -1;">
                        <button type="submit" class="turnero-admin-queue-surface-roadmap-console__button" data-tone="primary">Add owner</button>
                    </div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-roadmap-console__brief">${escapeHtml(state.brief)}</pre>
        </section>
    `;
}

function mountSurfaceChips(host, checkpoints) {
    host.replaceChildren();
    toArray(checkpoints).forEach((chip) => {
        const chipNode = document.createElement('span');
        host.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
}

function syncState(controller, input, ledgerStore, ownerStore) {
    controller.state = buildConsoleState(
        input,
        ledgerStore.list(),
        ownerStore.list()
    );
    updateBrief(controller.state);
    controller.root.dataset.state = controller.state.gate.band;
    controller.root.dataset.turneroAdminQueueSurfaceRoadmapBand =
        controller.state.gate.band;
    controller.root.innerHTML = renderConsoleHtml(controller.state);

    const overviewBannerHost = controller.root.querySelector('[data-role="banner"]');
    if (overviewBannerHost instanceof HTMLElement) {
        overviewBannerHost.replaceChildren();
        mountTurneroSurfaceRoadmapBanner(overviewBannerHost, {
            pack: controller.state.overviewPack,
            title: 'Surface Roadmap Prioritization',
            eyebrow: 'Roadmap overview',
        });
    }

    controller.state.surfacePacks.forEach((card) => {
        const cardHost = controller.root.querySelector(
            `[data-surface-key="${card.surfaceKey}"]`
        );
        if (!(cardHost instanceof HTMLElement)) {
            return;
        }

        cardHost.dataset.state = card.gate.band;
        const bannerHost = cardHost.querySelector('[data-role="banner"]');
        if (bannerHost instanceof HTMLElement) {
            bannerHost.replaceChildren();
            mountTurneroSurfaceRoadmapBanner(bannerHost, {
                pack: card,
                title: card.readout.surfaceLabel,
                eyebrow: 'Roadmap gate',
            });
        }

        const chipsHost = cardHost.querySelector('[data-role="chips"]');
        if (chipsHost instanceof HTMLElement) {
            mountSurfaceChips(chipsHost, card.readout.checkpoints);
        }
    });

    const briefHost = controller.root.querySelector('[data-role="brief"]');
    if (briefHost instanceof HTMLElement) {
        briefHost.textContent = controller.state.brief;
    }

    return controller.state;
}

function buildController(input, ledgerStore, ownerStore) {
    const controller = {
        root: document.createElement('section'),
        state: null,
        refresh: null,
        destroy: null,
    };

    const onClick = async (event) => {
        const actionTarget =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('[data-action]')
                : event.target instanceof HTMLElement
                  ? event.target
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
                'turnero-surface-roadmap-console.json',
                buildDownloadPayload(controller.state)
            );
            return;
        }

        if (action === 'refresh') {
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    const onSubmit = (event) => {
        const formTarget =
            event.target && typeof event.target.closest === 'function'
                ? event.target.closest('form[data-action]')
                : event.target instanceof HTMLElement
                  ? event.target
                  : null;
        if (!(formTarget instanceof HTMLElement)) {
            return;
        }

        const action = toString(formTarget.dataset.action);
        if (!action) {
            return;
        }

        event.preventDefault();

        if (action === 'add-entry') {
            ledgerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="entry-surface-key"]',
                    controller.state.surfaceOptions[0]?.surfaceKey ||
                        'operator-turnos'
                ),
                status: readValue(
                    formTarget,
                    '[data-field="entry-status"]',
                    'planned'
                ),
                priorityBand: readValue(
                    formTarget,
                    '[data-field="entry-priority-band"]',
                    'p2'
                ),
                owner: readValue(
                    formTarget,
                    '[data-field="entry-owner"]',
                    'ops'
                ),
                title: readValue(
                    formTarget,
                    '[data-field="entry-title"]',
                    'Roadmap item'
                ),
                nextAction: readValue(
                    formTarget,
                    '[data-field="entry-next-action"]',
                    ''
                ),
                note: readValue(
                    formTarget,
                    '[data-field="entry-note"]',
                    ''
                ),
            });
            resetValue(formTarget, '[data-field="entry-note"]', '');
            resetValue(formTarget, '[data-field="entry-next-action"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }

        if (action === 'add-owner') {
            ownerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="owner-surface-key"]',
                    controller.state.surfaceOptions[0]?.surfaceKey ||
                        'operator-turnos'
                ),
                actor: readValue(
                    formTarget,
                    '[data-field="owner-actor"]',
                    'owner'
                ),
                role: readValue(
                    formTarget,
                    '[data-field="owner-role"]',
                    'roadmap'
                ),
                status: readValue(
                    formTarget,
                    '[data-field="owner-status"]',
                    'active'
                ),
                note: readValue(
                    formTarget,
                    '[data-field="owner-note"]',
                    ''
                ),
            });
            resetValue(formTarget, '[data-field="owner-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    controller.root.className = 'turnero-admin-queue-surface-roadmap-console';
    controller.root.dataset.turneroAdminQueueSurfaceRoadmapConsole = 'mounted';
    controller.root.dataset.turneroAdminQueueSurfaceRoadmapScope = toString(
        input.scope,
        'queue-roadmap'
    );
    controller.root.addEventListener('click', onClick);
    controller.root.addEventListener('submit', onSubmit);
    controller.refresh = () => syncState(controller, input, ledgerStore, ownerStore);
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
        controller.root.removeEventListener('submit', onSubmit);
    };

    syncState(controller, input, ledgerStore, ownerStore);
    return controller;
}

export function buildTurneroAdminQueueSurfaceRoadmapConsoleHtml(input = {}) {
    const state =
        input.surfacePacks && input.gate
            ? input
            : buildConsoleState(
                  input,
                  Array.isArray(input.ledger) ? input.ledger : [],
                  Array.isArray(input.owners) ? input.owners : []
              );
    updateBrief(state);
    return renderConsoleHtml(state);
}

export function mountTurneroAdminQueueSurfaceRoadmapConsole(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();

    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveScope(input, clinicProfile);
    const ledgerStore =
        input.ledgerStore &&
        typeof input.ledgerStore.list === 'function' &&
        typeof input.ledgerStore.add === 'function'
            ? input.ledgerStore
            : createTurneroSurfaceRoadmapLedger(scope, clinicProfile);
    const ownerStore =
        input.ownerStore &&
        typeof input.ownerStore.list === 'function' &&
        typeof input.ownerStore.add === 'function'
            ? input.ownerStore
            : createTurneroSurfaceRoadmapOwnerStore(scope, clinicProfile);
    const controller = buildController(
        {
            ...input,
            scope,
            clinicProfile,
        },
        ledgerStore,
        ownerStore
    );

    root.replaceChildren(controller.root);
    return {
        root: controller.root,
        state: controller.state,
        refresh: controller.refresh,
        destroy: controller.destroy,
    };
}
