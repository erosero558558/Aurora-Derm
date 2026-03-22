import { getTurneroClinicBrandName, getTurneroClinicShortName } from './clinic-profile.js';
import { buildTurneroSurfaceExecutiveReviewPack } from './turnero-surface-executive-review-pack.js';
import {
    buildTurneroSurfaceExecutiveReviewSnapshot,
    resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey,
} from './turnero-surface-executive-review-snapshot.js';
import { createTurneroSurfaceExecutiveReviewLedger } from './turnero-surface-executive-review-ledger.js';
import { createTurneroSurfaceExecutiveReviewOwnerStore } from './turnero-surface-executive-review-owner-store.js';
import { mountTurneroSurfaceExecutiveReviewBanner } from './turnero-surface-executive-review-banner.js';
import { ensureTurneroSurfaceOpsStyles, mountTurneroSurfaceCheckpointChip } from './turnero-surface-checkpoint-chip.js';
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

const STYLE_ID = 'turneroAdminQueueSurfaceExecutiveReviewConsoleInlineStyles';
const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'display']);
const DEFAULT_OVERVIEW_CHECKLIST = Object.freeze({
    summary: { all: 6, pass: 4, fail: 2 },
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
        .turnero-admin-queue-surface-executive-review-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-executive-review-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-queue-surface-executive-review-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-executive-review-console__eyebrow,.turnero-admin-queue-surface-executive-review-console__summary,.turnero-admin-queue-surface-executive-review-console__section h4,.turnero-admin-queue-surface-executive-review-console__section p{margin:0}
        .turnero-admin-queue-surface-executive-review-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-executive-review-console__actions,.turnero-admin-queue-surface-executive-review-console__form-actions,.turnero-admin-queue-surface-executive-review-console__section-header,.turnero-admin-queue-surface-executive-review-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-executive-review-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-executive-review-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-executive-review-console__banner-host{min-height:1px}
        .turnero-admin-queue-surface-executive-review-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-executive-review-console__metric{display:grid;gap:.2rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-executive-review-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-executive-review-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-executive-review-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-executive-review-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-executive-review-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-executive-review-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-executive-review-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-executive-review-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-executive-review-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-executive-review-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-executive-review-console__surface-title p,.turnero-admin-queue-surface-executive-review-console__surface-meta,.turnero-admin-queue-surface-executive-review-console__entry-meta{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-executive-review-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-executive-review-console__surface-summary,.turnero-admin-queue-surface-executive-review-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-executive-review-console__surface-banner-host{min-height:1px}
        .turnero-admin-queue-surface-executive-review-console__surface-chip-row{gap:.45rem}
        .turnero-admin-queue-surface-executive-review-console__section{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-executive-review-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-executive-review-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-executive-review-console__form input,.turnero-admin-queue-surface-executive-review-console__form select,.turnero-admin-queue-surface-executive-review-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-executive-review-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-executive-review-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-executive-review-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-executive-review-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-executive-review-console__entry-badge{padding:.28rem .5rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.74rem;white-space:nowrap}
        .turnero-admin-queue-surface-executive-review-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-executive-review-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-executive-review-console__header,.turnero-admin-queue-surface-executive-review-console__surface-header,.turnero-admin-queue-surface-executive-review-console__entry-head{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'regional',
        'regional'
    );
}

function resolveSurfaceOptions(snapshots = []) {
    return snapshots.map((snapshot) => ({
        surfaceKey: snapshot.surfaceKey,
        label: snapshot.surfaceLabel,
    }));
}

function normalizeSeedSnapshot(seed, clinicProfile, scope, fallbackSurfaceKey) {
    const source = asObject(seed);
    const snapshotSource = asObject(
        source.snapshot || source.pack?.snapshot || source
    );
    const normalizedSurfaceKey = toString(
        snapshotSource.surfaceKey || source.surfaceKey || fallbackSurfaceKey,
        fallbackSurfaceKey
    );

    const snapshot = buildTurneroSurfaceExecutiveReviewSnapshot({
        ...snapshotSource,
        scope,
        surfaceKey: normalizedSurfaceKey,
        clinicProfile,
        runtimeState: toString(
            snapshotSource.runtimeState || source.runtimeState,
            'ready'
        ),
        truth: toString(
            snapshotSource.truth || source.truth,
            normalizedSurfaceKey === 'sala-turnos' ? 'aligned' : 'watch'
        ),
        portfolioBand: toString(
            snapshotSource.portfolioBand || source.portfolioBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'watch' : 'core'
        ),
        priorityBand: toString(
            snapshotSource.priorityBand || source.priorityBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'p2' : 'p1'
        ),
        decisionState: toString(
            snapshotSource.decisionState || source.decisionState,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? 'pending'
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'approved'
                  : 'watch'
        ),
        reviewWindow: toString(
            snapshotSource.reviewWindow || source.reviewWindow,
            normalizedSurfaceKey === 'kiosco-turnos' ? '' : 'mensual'
        ),
        reviewOwner: toString(
            snapshotSource.reviewOwner || source.reviewOwner,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? ''
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'ops-display'
                  : 'ops-lead'
        ),
        checklist:
            source.checklist ||
            snapshotSource.checklist ||
            (normalizedSurfaceKey === 'kiosco-turnos'
                ? { summary: { all: 4, pass: 2, fail: 2 } }
                : { summary: { all: 4, pass: 3, fail: 1 } }),
        updatedAt: toString(
            snapshotSource.updatedAt || source.updatedAt,
            new Date().toISOString()
        ),
    });

    return {
        ...snapshot,
        surfaceKey:
            snapshot.surfaceProfileKey || snapshot.surfaceKey || normalizedSurfaceKey,
    };
}

function resolveSurfaceSeeds(input = {}, clinicProfile = null, scope = 'regional') {
    const source = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const provided = new Map();

    source.forEach((seed) => {
        const snapshot = asObject(seed);
        const normalizedSurfaceKey = resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey(
            snapshot.surfaceKey || ''
        );
        if (SURFACE_ORDER.includes(normalizedSurfaceKey)) {
            provided.set(normalizedSurfaceKey, snapshot);
        }
    });

    return SURFACE_ORDER.map((surfaceKey) =>
        normalizeSeedSnapshot(
            provided.get(surfaceKey) ||
                buildTurneroSurfaceExecutiveReviewSnapshot({
                    scope,
                    surfaceKey,
                    clinicProfile,
                    checklist:
                        surfaceKey === 'kiosk'
                            ? { summary: { all: 4, pass: 2, fail: 2 } }
                            : { summary: { all: 4, pass: 3, fail: 1 } },
                }),
            clinicProfile,
            scope,
            surfaceKey
        )
    );
}

function resolveChecklist(input = {}) {
    if (input.checklist && input.checklist.summary) {
        return {
            summary: {
                all: Math.max(0, Number(input.checklist.summary.all || 0) || 0),
                pass: Math.max(0, Number(input.checklist.summary.pass || 0) || 0),
                fail: Math.max(0, Number(input.checklist.summary.fail || 0) || 0),
            },
        };
    }

    return DEFAULT_OVERVIEW_CHECKLIST;
}

function buildOverviewPack(
    input,
    ledgerRows,
    ownerRows,
    clinicProfile,
    scope,
    checklist
) {
    return buildTurneroSurfaceExecutiveReviewPack({
        surfaceKey: 'queue-admin',
        clinicProfile,
        scope,
        runtimeState: toString(input.runtimeState, 'ready'),
        truth: toString(input.truth, 'aligned'),
        portfolioBand: toString(input.portfolioBand, 'core'),
        priorityBand: toString(input.priorityBand, 'p1'),
        decisionState: toString(input.decisionState, 'approved'),
        reviewWindow: toString(input.reviewWindow, 'mensual'),
        reviewOwner: toString(input.reviewOwner, 'ops-admin'),
        checklist: { summary: checklist },
        ledger: ledgerRows,
        owners: ownerRows,
    });
}

function buildSurfacePack(seed, ledgerRows, ownerRows, clinicProfile, scope) {
    const normalizedSeed = normalizeSeedSnapshot(
        seed,
        clinicProfile,
        scope,
        seed?.surfaceKey || 'operator'
    );
    const surfaceKey = normalizedSeed.surfaceKey;
    const normalizedSurfaceKey = resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey(
        surfaceKey
    );
    const ledger = toArray(ledgerRows).filter(
        (entry) =>
            resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey(
                entry?.surfaceKey
            ) === normalizedSurfaceKey
    );
    const owners = toArray(ownerRows).filter(
        (entry) =>
            resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey(
                entry?.surfaceKey
            ) === normalizedSurfaceKey
    );
    const pack = buildTurneroSurfaceExecutiveReviewPack({
        ...normalizedSeed,
        clinicProfile,
        scope,
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

function buildConsoleState(input = {}, ledgerRows = [], ownerRows = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveScope(input, clinicProfile);
    const snapshots = resolveSurfaceSeeds(input, clinicProfile, scope);
    const ledger = Array.isArray(ledgerRows) ? ledgerRows.filter(Boolean) : [];
    const owners = Array.isArray(ownerRows) ? ownerRows.filter(Boolean) : [];
    const checklist = resolveChecklist(input);
    const surfaceOptions = resolveSurfaceOptions(snapshots);
    const surfacePacks = snapshots.map((seed) =>
        buildSurfacePack(seed, ledger, owners, clinicProfile, scope)
    );
    const overviewPack = buildOverviewPack(
        input,
        ledger,
        owners,
        clinicProfile,
        scope,
        checklist.summary
    );
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        '';

    return {
        scope,
        clinicProfile,
        clinicLabel,
        surfaceRegistry: asObject(input.surfaceRegistry),
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
            readyCount: surfacePacks.filter((item) => item.gate.band === 'ready')
                .length,
            watchCount: surfacePacks.filter((item) => item.gate.band === 'watch')
                .length,
            degradedCount: surfacePacks.filter(
                (item) => item.gate.band === 'degraded'
            ).length,
            blockedCount: surfacePacks.filter(
                (item) => item.gate.band === 'blocked'
            ).length,
            ledgerCount: ledger.length,
            ownerCount: owners.length,
            activeOwnerCount: Number(overviewPack.readout.activeOwnerCount || 0) || 0,
            reviewItemCount: Number(overviewPack.readout.reviewItemCount || 0) || 0,
            checklistAll: Number(checklist.summary.all || 0) || 0,
            checklistPass: Number(checklist.summary.pass || 0) || 0,
            checklistFail: Number(checklist.summary.fail || 0) || 0,
        },
        brief: '',
        generatedAt: overviewPack.generatedAt,
    };
}

function buildBrief(state) {
    const lines = [
        '# Surface Executive Review Console',
        `Scope: ${toString(state.scope, 'regional')}`,
        `Clinic: ${toString(
            state.clinicLabel || state.clinicProfile?.clinic_id,
            'sin-clinica'
        )}`,
        `Gate: ${toString(state.gate.band, 'blocked')} · ${Number(
            state.gate.score || 0
        )} · ${toString(state.gate.decision, 'hold-executive-review')}`,
        '',
        ...state.surfacePacks.map(
            (card) =>
                `- ${toString(
                    card.readout.surfaceLabel,
                    card.label || card.snapshot.surfaceKey
                )}: ${toString(card.gate.band, 'blocked')} · ${Number(
                    card.gate.score || 0
                )} · priority ${toString(card.readout.priorityBand, 'unknown')} · review ${toString(
                    card.readout.decisionState,
                    'pending'
                )} · owner ${toString(
                    card.readout.reviewOwner,
                    'sin owner'
                ) || 'sin owner'}`
        ),
        '',
        `Review items: ${state.metrics.reviewItemCount}`,
        `Owners: ${state.metrics.ownerCount}`,
        `Checklist: ${state.metrics.checklistPass}/${state.metrics.checklistAll} pass`,
    ];

    if (state.ledger.length > 0) {
        lines.push('', '## Recent review items');
        state.ledger.slice(0, 6).forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'watch')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'review-item')} · ${toString(
                    entry.title,
                    ''
                )}`
            );
        });
    }

    if (state.owners.length > 0) {
        lines.push('', '## Owners');
        state.owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(
                    entry.actor || entry.owner || entry.name,
                    'owner'
                )} · ${toString(entry.role, 'executive-review')} · ${toString(
                    entry.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
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
        overviewPack: state.overviewPack,
        ledger: state.ledger,
        owners: state.owners,
        checklist: state.checklist,
        gate: state.gate,
        metrics: state.metrics,
        brief: state.brief,
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
                : '',
    };
}

function updateBrief(state) {
    state.brief = buildBrief(state);
    return state.brief;
}

function readValue(root, selector, fallback = '') {
    const field = root.querySelector(selector);
    return field && 'value' in field ? toString(field.value, fallback) : toString(fallback);
}

function resetValue(root, selector, value = '') {
    const field = root.querySelector(selector);
    if (field && 'value' in field) {
        field.value = value;
    }
}

function renderMetric(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-executive-review-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-executive-review-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function chipClass(value, kind = 'band') {
    const normalized = toString(value, 'watch').toLowerCase();
    if (kind === 'priority') {
        return normalized === 'p1' || normalized === 'core'
            ? 'ready'
            : normalized === 'p2' || normalized === 'watch'
              ? 'warning'
              : 'alert';
    }

    if (kind === 'review') {
        return normalized === 'approved' ||
            normalized === 'ready' ||
            normalized === 'aligned'
            ? 'ready'
            : normalized === 'pending' || normalized === 'watch'
              ? 'warning'
              : 'alert';
    }

    return normalized === 'ready'
        ? 'ready'
        : normalized === 'watch'
          ? 'warning'
          : 'alert';
}

function chipHtml(label, value, state) {
    return `
        <span class="turnero-surface-ops__chip" data-state="${escapeHtml(state)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </span>
    `;
}

function renderEntry(entry, kind) {
    const meta =
        kind === 'ledger'
            ? `${toString(entry.owner, 'review') || 'review'} · ${toString(entry.kind, 'review-item')} · ${toString(entry.status, 'watch')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'executive-review')} · ${toString(entry.status, 'active')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;

    return `
        <article class="turnero-admin-queue-surface-executive-review-console__entry" data-state="${escapeHtml(toString(entry.status, 'watch'))}">
            <div class="turnero-admin-queue-surface-executive-review-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.kind || entry.role, 'entry')} · status ${toString(entry.status, 'watch')}`)}</strong>
                <span class="turnero-admin-queue-surface-executive-review-console__entry-badge">${escapeHtml(toString(entry.status, 'watch'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-executive-review-console__entry-meta">${escapeHtml(meta)}</p>
            ${entry.note ? `<p class="turnero-admin-queue-surface-executive-review-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-executive-review-console__list">${entries
              .map((entry) => renderEntry(entry, kind))
              .join('')}</div>`
        : '<p class="turnero-admin-queue-surface-executive-review-console__empty">Sin entradas todavía.</p>';
}

function renderSurfaceCard(card) {
    return `
        <article class="turnero-admin-queue-surface-executive-review-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(card.gate.band)}">
            <div class="turnero-admin-queue-surface-executive-review-console__surface-header">
                <div class="turnero-admin-queue-surface-executive-review-console__surface-title">
                    <strong>${escapeHtml(card.readout.surfaceLabel)}</strong>
                    <p>${escapeHtml(`${card.readout.surfaceKey} · ${card.readout.clinicLabel || card.clinicLabel || ''}`)}</p>
                </div>
                <span class="turnero-admin-queue-surface-executive-review-console__surface-badge">${escapeHtml(`${card.gate.band} · ${Number(card.gate.score || 0)}`)}</span>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-executive-review-console__surface-banner-host"></div>
            <div data-role="chips" class="turnero-admin-queue-surface-executive-review-console__surface-chip-row"></div>
            <p class="turnero-admin-queue-surface-executive-review-console__surface-summary">${escapeHtml(card.readout.summary)}</p>
            <p class="turnero-admin-queue-surface-executive-review-console__surface-meta">${escapeHtml(`Checklist ${card.readout.checklistPass}/${card.readout.checklistAll} · Review items ${card.readout.reviewItemCount} · Owners activos ${card.readout.activeOwnerCount}/${card.readout.ownerCount}`)}</p>
            <p class="turnero-admin-queue-surface-executive-review-console__surface-meta">${escapeHtml(`Priority ${card.readout.priorityBand} · Review ${card.readout.decisionState} · Score ${Number(card.gate.score || 0)}`)}</p>
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
        <section class="turnero-surface-ops-console turnero-admin-queue-surface-executive-review-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-executive-review-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-executive-review-console__eyebrow">Turnero executive review</p>
                    <h3>Surface Executive Review Console</h3>
                    <p class="turnero-admin-queue-surface-executive-review-console__summary">Snapshot, gate y owner ledger por clínica con bandeja para operador, kiosco y sala.</p>
                </div>
                <div class="turnero-admin-queue-surface-executive-review-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-executive-review-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-executive-review-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-executive-review-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-executive-review-console__banner-host" aria-live="polite"></div>
            <div class="turnero-admin-queue-surface-executive-review-console__metrics">
                ${renderMetric('Surfaces', String(state.metrics.totalSurfaces), `${state.metrics.readyCount} ready · ${state.metrics.watchCount} watch · ${state.metrics.degradedCount} degraded · ${state.metrics.blockedCount} blocked`)}
                ${renderMetric('Gate', `${state.gate.band} · ${Number(state.gate.score || 0)}`, state.gate.decision)}
                ${renderMetric('Checklist', `${state.metrics.checklistPass}/${state.metrics.checklistAll}`, `${state.metrics.checklistFail} fail`)}
                ${renderMetric('Review items', String(state.metrics.reviewItemCount), `${state.metrics.ledgerCount} ledger rows`)}
                ${renderMetric('Owners', String(state.metrics.ownerCount), `${state.metrics.activeOwnerCount} active`)}
                ${renderMetric('Score', String(Number(state.gate.score || 0)), state.readout.summary)}
            </div>
            <section class="turnero-admin-queue-surface-executive-review-console__section">
                <div class="turnero-admin-queue-surface-executive-review-console__section-header">
                    <div>
                        <h4>Executive review surfaces</h4>
                        <p>Un card por surface con banner y checkpoint chips ejecutivos.</p>
                    </div>
                </div>
                <div class="turnero-admin-queue-surface-executive-review-console__surface-grid">
                    ${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}
                </div>
            </section>
            <section class="turnero-admin-queue-surface-executive-review-console__section">
                <div class="turnero-admin-queue-surface-executive-review-console__section-header">
                    <div>
                        <h4>Add review item</h4>
                        <p>Agrega una entrada de revisión ejecutiva para cualquier surface.</p>
                    </div>
                </div>
                <form class="turnero-admin-queue-surface-executive-review-console__form" data-action="add-review-item">
                    <label>
                        <span>Surface</span>
                        <select data-field="item-surface-key">${renderFormOptions(state)}</select>
                    </label>
                    <label>
                        <span>Kind</span>
                        <select data-field="item-kind">
                            <option value="review-item" selected>review-item</option>
                            <option value="review">review</option>
                            <option value="note">note</option>
                        </select>
                    </label>
                    <label>
                        <span>Status</span>
                        <select data-field="item-status">
                            <option value="watch" selected>watch</option>
                            <option value="ready">ready</option>
                            <option value="blocked">blocked</option>
                            <option value="draft">draft</option>
                        </select>
                    </label>
                    <label>
                        <span>Owner</span>
                        <input type="text" data-field="item-owner" value="ops" />
                    </label>
                    <label>
                        <span>Title</span>
                        <input type="text" data-field="item-title" value="Executive review item" />
                    </label>
                    <label style="grid-column:1 / -1;">
                        <span>Note</span>
                        <textarea data-field="item-note" placeholder="Review note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-executive-review-console__form-actions" style="grid-column:1 / -1;">
                        <button type="submit" class="turnero-admin-queue-surface-executive-review-console__button" data-tone="primary">Add review item</button>
                    </div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
            </section>
            <section class="turnero-admin-queue-surface-executive-review-console__section">
                <div class="turnero-admin-queue-surface-executive-review-console__section-header">
                    <div>
                        <h4>Add owner</h4>
                        <p>Asigna o actualiza el owner activo para una surface.</p>
                    </div>
                </div>
                <form class="turnero-admin-queue-surface-executive-review-console__form" data-action="add-owner">
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
                        <input type="text" data-field="owner-role" value="executive-review" />
                    </label>
                    <label>
                        <span>Status</span>
                        <input type="text" data-field="owner-status" value="active" />
                    </label>
                    <label style="grid-column:1 / -1;">
                        <span>Note</span>
                        <textarea data-field="owner-note" placeholder="Owner note"></textarea>
                    </label>
                    <div class="turnero-admin-queue-surface-executive-review-console__form-actions" style="grid-column:1 / -1;">
                        <button type="submit" class="turnero-admin-queue-surface-executive-review-console__button" data-tone="primary">Add owner</button>
                    </div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-executive-review-console__brief">${escapeHtml(state.brief)}</pre>
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
    controller.root.dataset.turneroAdminQueueSurfaceExecutiveReviewBand =
        controller.state.gate.band;
    controller.root.innerHTML = renderConsoleHtml(controller.state);

    const overviewBannerHost = controller.root.querySelector('[data-role="banner"]');
    if (overviewBannerHost instanceof HTMLElement) {
        overviewBannerHost.replaceChildren();
        mountTurneroSurfaceExecutiveReviewBanner(overviewBannerHost, {
            pack: controller.state.overviewPack,
            title: 'Surface Executive Review Console',
            eyebrow: 'Executive review overview',
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
            mountTurneroSurfaceExecutiveReviewBanner(bannerHost, {
                pack: card,
                title: card.readout.surfaceLabel,
                eyebrow: 'Executive review gate',
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
                'turnero-surface-executive-review-console.json',
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

        if (action === 'add-review-item') {
            ledgerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="item-surface-key"]',
                    controller.state.surfaceOptions[0]?.surfaceKey || 'operator-turnos'
                ),
                kind: readValue(
                    formTarget,
                    '[data-field="item-kind"]',
                    'review-item'
                ),
                status: readValue(
                    formTarget,
                    '[data-field="item-status"]',
                    'watch'
                ),
                owner: readValue(
                    formTarget,
                    '[data-field="item-owner"]',
                    'ops'
                ),
                title: readValue(
                    formTarget,
                    '[data-field="item-title"]',
                    'Executive review item'
                ),
                note: readValue(
                    formTarget,
                    '[data-field="item-note"]',
                    ''
                ),
            });
            resetValue(formTarget, '[data-field="item-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }

        if (action === 'add-owner') {
            ownerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="owner-surface-key"]',
                    controller.state.surfaceOptions[0]?.surfaceKey || 'operator-turnos'
                ),
                actor: readValue(
                    formTarget,
                    '[data-field="owner-actor"]',
                    'owner'
                ),
                role: readValue(
                    formTarget,
                    '[data-field="owner-role"]',
                    'executive-review'
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

    controller.refresh = () => syncState(controller, input, ledgerStore, ownerStore);
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
        controller.root.removeEventListener('submit', onSubmit);
    };

    controller.root.addEventListener('click', onClick);
    controller.root.addEventListener('submit', onSubmit);
    return controller;
}

export function buildTurneroAdminQueueSurfaceExecutiveReviewConsoleHtml(
    input = {}
) {
    const scope = resolveScope(input, asObject(input.clinicProfile));
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceExecutiveReviewLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceExecutiveReviewOwnerStore(
        scope,
        clinicProfile
    );
    const state = buildConsoleState(
        input,
        Array.isArray(input.ledger) ? input.ledger : ledgerStore.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    updateBrief(state);
    return renderConsoleHtml(state);
}

export function mountTurneroAdminQueueSurfaceExecutiveReviewConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();

    const scope = resolveScope(input, asObject(input.clinicProfile));
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceExecutiveReviewLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceExecutiveReviewOwnerStore(
        scope,
        clinicProfile
    );
    const controller = buildController(input, ledgerStore, ownerStore);

    controller.root.className =
        'turnero-admin-queue-surface-executive-review-console-host';
    controller.root.dataset.turneroAdminQueueSurfaceExecutiveReviewConsole =
        'mounted';
    host.replaceChildren(controller.root);
    controller.refresh();

    return controller;
}

export default mountTurneroAdminQueueSurfaceExecutiveReviewConsole;
