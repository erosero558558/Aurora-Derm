import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { createTurneroSurfaceOnboardingLedger } from './turnero-surface-onboarding-ledger.js';
import { createTurneroSurfaceOnboardingOwnerStore } from './turnero-surface-onboarding-owner-store.js';
import { buildTurneroSurfaceOnboardingBannerHtml } from './turnero-surface-onboarding-banner.js';
import { buildTurneroSurfaceOnboardingPack } from './turnero-surface-onboarding-pack.js';
import { buildTurneroSurfaceOnboardingSnapshot } from './turnero-surface-onboarding-snapshot.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    escapeHtml,
    formatTimestamp,
    resolveTarget,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminQueueSurfaceOnboardingConsoleInlineStyles';
const SURFACE_ORDER = Object.freeze([
    'operator-turnos',
    'kiosco-turnos',
    'sala-turnos',
]);
const DEFAULT_CHECKLIST = Object.freeze({ all: 6, pass: 4, fail: 2 });
const DEFAULT_SURFACE_CHECKLISTS = Object.freeze({
    'operator-turnos': { all: 4, pass: 3, fail: 1 },
    'kiosco-turnos': { all: 4, pass: 2, fail: 2 },
    'sala-turnos': { all: 4, pass: 3, fail: 1 },
});

function surfaceOrderRank(surfaceKey) {
    const index = SURFACE_ORDER.indexOf(toString(surfaceKey, ''));
    return index >= 0 ? index : SURFACE_ORDER.length;
}

function getClinicLabel(clinicProfile = {}) {
    return toString(
        getTurneroClinicBrandName(clinicProfile) ||
            getTurneroClinicShortName(clinicProfile) ||
            clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            '',
        ''
    );
}

function getScope(input = {}, clinicProfile = null) {
    return toString(
        input.scope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'regional',
        'regional'
    );
}

function ensureConsoleStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
        return typeof document !== 'undefined';
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-onboarding-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-onboarding-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.8rem;align-items:flex-start}
        .turnero-admin-queue-surface-onboarding-console__header-copy{display:grid;gap:.2rem}
        .turnero-admin-queue-surface-onboarding-console__eyebrow,.turnero-admin-queue-surface-onboarding-console__meta,.turnero-admin-queue-surface-onboarding-console__section h4,.turnero-admin-queue-surface-onboarding-console__section p{margin:0}
        .turnero-admin-queue-surface-onboarding-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-onboarding-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-onboarding-console__actions,.turnero-admin-queue-surface-onboarding-console__chips{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-onboarding-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-onboarding-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-onboarding-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-onboarding-console__metric{display:grid;gap:.18rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-onboarding-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-onboarding-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-onboarding-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-onboarding-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-onboarding-console__surface[data-state='watch'],.turnero-admin-queue-surface-onboarding-console__surface[data-state='degraded']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-onboarding-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-onboarding-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-onboarding-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-onboarding-console__surface-title p,.turnero-admin-queue-surface-onboarding-console__surface-detail,.turnero-admin-queue-surface-onboarding-console__surface-meta,.turnero-admin-queue-surface-onboarding-console__entry-meta{margin:0;font-size:.84rem;line-height:1.45;opacity:.84}
        .turnero-admin-queue-surface-onboarding-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-onboarding-console__section{display:grid;gap:.5rem}
        .turnero-admin-queue-surface-onboarding-console__section h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;opacity:.72}
        .turnero-admin-queue-surface-onboarding-console__forms{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-onboarding-console__form{display:grid;gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-onboarding-console__form label{display:grid;gap:.28rem;font-size:.78rem}
        .turnero-admin-queue-surface-onboarding-console__form input,.turnero-admin-queue-surface-onboarding-console__form select,.turnero-admin-queue-surface-onboarding-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-onboarding-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-onboarding-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-onboarding-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-onboarding-console__entry[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-onboarding-console__entry[data-state='watch'],.turnero-admin-queue-surface-onboarding-console__entry[data-state='pending']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-onboarding-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-onboarding-console__header,.turnero-admin-queue-surface-onboarding-console__surface-header{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeChecklistSummary(input = {}, fallback = DEFAULT_CHECKLIST) {
    const source = asObject(input);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => asObject(item));
    const all = Number(
        summary.all || (checks.length > 0 ? checks.length : fallback.all)
    ) || 0;
    const pass =
        Number(
            summary.pass ||
                (checks.length > 0
                    ? checks.filter((check) => check.pass === true).length
                    : fallback.pass)
        ) || 0;
    const fail =
        Number(
            summary.fail ||
                (checks.length > 0
                    ? checks.filter((check) => check.pass !== true).length
                    : fallback.fail)
        ) || 0;
    return {
        all: Math.max(0, all),
        pass: Math.max(0, pass),
        fail: Math.max(0, fail),
        checks,
    };
}

function defaultSurfaceChecklist(surfaceKey) {
    return DEFAULT_SURFACE_CHECKLISTS[toString(surfaceKey, '')] || {
        all: 0,
        pass: 0,
        fail: 0,
    };
}

function resolveSurfaceSeeds(input = {}, clinicProfile = null, scope = 'regional') {
    const provided = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const source =
        provided.length > 0
            ? provided
            : [
                  {
                      surfaceKey: 'operator-turnos',
                      runtimeState: 'ready',
                      truth: 'watch',
                      kickoffState: 'ready',
                      dataIntakeState: 'ready',
                      accessState: 'watch',
                      onboardingOwner: 'ops-lead',
                      trainingWindow: 'martes 09:00',
                      checklist: defaultSurfaceChecklist('operator-turnos'),
                  },
                  {
                      surfaceKey: 'kiosco-turnos',
                      runtimeState: 'ready',
                      truth: 'watch',
                      kickoffState: 'watch',
                      dataIntakeState: 'pending',
                      accessState: 'pending',
                      onboardingOwner: '',
                      trainingWindow: '',
                      checklist: defaultSurfaceChecklist('kiosco-turnos'),
                  },
                  {
                      surfaceKey: 'sala-turnos',
                      runtimeState: 'ready',
                      truth: 'aligned',
                      kickoffState: 'ready',
                      dataIntakeState: 'ready',
                      accessState: 'ready',
                      onboardingOwner: 'ops-display',
                      trainingWindow: 'miercoles 08:00',
                      checklist: defaultSurfaceChecklist('sala-turnos'),
                  },
              ];

    return source
        .map((snapshot) => {
            const normalized = buildTurneroSurfaceOnboardingSnapshot({
                ...asObject(snapshot),
                clinicProfile,
                scope,
            });
            return {
                ...normalized,
                checklist: normalizeChecklistSummary(
                    asObject(snapshot.checklist),
                    defaultSurfaceChecklist(normalized.surfaceKey)
                ),
            };
        })
        .sort(
            (left, right) =>
                surfaceOrderRank(left.surfaceKey) -
                surfaceOrderRank(right.surfaceKey)
        );
}

function normalizeLedgerRows(rows = [], scope = 'regional') {
    return toArray(rows)
        .map((entry) => {
            const source = asObject(entry);
            const createdAt =
                toString(source.createdAt || source.updatedAt, '') ||
                new Date().toISOString();
            return {
                id:
                    toString(source.id, '') ||
                    `onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                scope: toString(source.scope, scope),
                surfaceKey: toString(source.surfaceKey, 'surface'),
                title: toString(source.title || source.label, 'Onboarding item'),
                owner: toString(source.owner, 'ops'),
                status: toString(source.status, 'ready').toLowerCase() || 'ready',
                note: toString(source.note || source.detail, ''),
                createdAt,
                updatedAt: toString(source.updatedAt, createdAt),
            };
        })
        .sort((left, right) => {
            const order =
                surfaceOrderRank(left.surfaceKey) -
                surfaceOrderRank(right.surfaceKey);
            return order !== 0
                ? order
                : String(right.updatedAt || right.createdAt || '').localeCompare(
                      String(left.updatedAt || left.createdAt || '')
                  );
        });
}

function normalizeOwnerRows(rows = [], scope = 'regional') {
    return toArray(rows)
        .map((entry) => {
            const source = asObject(entry);
            const createdAt =
                toString(source.createdAt || source.updatedAt, '') ||
                new Date().toISOString();
            return {
                id:
                    toString(source.id, '') ||
                    `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                scope: toString(source.scope, scope),
                surfaceKey: toString(source.surfaceKey, 'surface'),
                actor: toString(source.actor || source.owner, 'owner'),
                role: toString(source.role, 'onboarding'),
                status: toString(source.status, 'active').toLowerCase() || 'active',
                note: toString(source.note || source.detail, ''),
                createdAt,
                updatedAt: toString(source.updatedAt, createdAt),
            };
        })
        .sort((left, right) => {
            const order =
                surfaceOrderRank(left.surfaceKey) -
                surfaceOrderRank(right.surfaceKey);
            return order !== 0
                ? order
                : String(right.updatedAt || right.createdAt || '').localeCompare(
                      String(left.updatedAt || left.createdAt || '')
                  );
        });
}

function resolveOverallChecklist(input = {}) {
    const source = asObject(input.checklist);
    return Object.keys(source).length > 0 || Array.isArray(source.checks)
        ? normalizeChecklistSummary(source, DEFAULT_CHECKLIST)
        : { ...DEFAULT_CHECKLIST };
}

function buildSurfacePack(seed, clinicProfile, scope, ledgerRows, ownerRows) {
    const surfaceKey = toString(seed.surfaceKey, 'surface');
    const checklist = normalizeChecklistSummary(
        asObject(seed.checklist),
        defaultSurfaceChecklist(surfaceKey)
    );
    const ledger = ledgerRows.filter(
        (entry) => toString(entry.surfaceKey, '') === surfaceKey
    );
    const owners = ownerRows.filter(
        (entry) => toString(entry.surfaceKey, '') === surfaceKey
    );
    return buildTurneroSurfaceOnboardingPack({
        ...seed,
        scope: toString(seed.scope, scope),
        surfaceKey,
        clinicProfile,
        checklist: {
            summary: checklist,
            checks: Array.isArray(checklist.checks) ? checklist.checks : [],
        },
        ledger,
        owners,
    });
}

function buildSummaryPack(
    clinicProfile,
    scope,
    checklist,
    surfacePacks,
    ledgerRows,
    ownerRows
) {
    return buildTurneroSurfaceOnboardingPack({
        surfaceKey: 'surface-onboarding-console',
        surfaceLabel: 'Surface Customer Onboarding',
        scope,
        clinicProfile,
        runtimeState:
            surfacePacks.every(
                (pack) => toString(pack.snapshot?.runtimeState, 'watch') === 'ready'
            )
                ? 'ready'
                : 'watch',
        truth:
            surfacePacks.every(
                (pack) => toString(pack.snapshot?.truth, 'watch') === 'aligned'
            )
                ? 'aligned'
                : 'watch',
        kickoffState:
            surfacePacks.every(
                (pack) => toString(pack.snapshot?.kickoffState, 'pending') === 'ready'
            )
                ? 'ready'
                : 'watch',
        dataIntakeState:
            surfacePacks.every(
                (pack) =>
                    toString(pack.snapshot?.dataIntakeState, 'pending') === 'ready'
            )
                ? 'ready'
                : 'watch',
        accessState:
            surfacePacks.every(
                (pack) => toString(pack.snapshot?.accessState, 'pending') === 'ready'
            )
                ? 'ready'
                : 'watch',
        onboardingOwner: toString(
            ownerRows.find((entry) => toString(entry.status, '') === 'active')?.actor,
            ''
        ),
        trainingWindow: toString(
            surfacePacks.find((pack) => toString(pack.snapshot?.trainingWindow, ''))
                ?.snapshot?.trainingWindow,
            ''
        ),
        checklist: {
            summary: checklist,
            checks: Array.isArray(checklist.checks) ? checklist.checks : [],
        },
        snapshots: surfacePacks.map((pack) => pack.snapshot),
        ledger: ledgerRows,
        owners: ownerRows,
    });
}

function buildConsoleState(input = {}, ledgerOverride = null, ownerOverride = null) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = getScope(input, clinicProfile);
    const clinicLabel = getClinicLabel(clinicProfile);
    const surfaceSeeds = resolveSurfaceSeeds(input, clinicProfile, scope);
    const ledgerRows = normalizeLedgerRows(
        Array.isArray(ledgerOverride)
            ? ledgerOverride
            : Array.isArray(input.ledger)
              ? input.ledger
              : [],
        scope
    );
    const ownerRows = normalizeOwnerRows(
        Array.isArray(ownerOverride)
            ? ownerOverride
            : Array.isArray(input.owners)
              ? input.owners
              : [],
        scope
    );
    const surfacePacks = surfaceSeeds.map((seed) =>
        buildSurfacePack(seed, clinicProfile, scope, ledgerRows, ownerRows)
    );
    const checklist = resolveOverallChecklist(input);
    const summaryPack = buildSummaryPack(
        clinicProfile,
        scope,
        checklist,
        surfacePacks,
        ledgerRows,
        ownerRows
    );

    return {
        scope,
        clinicProfile,
        clinicLabel,
        surfaceSeeds,
        surfacePacks,
        ledgerRows,
        ownerRows,
        checklist,
        summaryPack,
        generatedAt: new Date().toISOString(),
    };
}

function metricCard(label, value, state = 'ready') {
    return `<article class="turnero-admin-queue-surface-onboarding-console__metric" data-state="${escapeHtml(
        state
    )}"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(
        label
    )}</span></article>`;
}

function chipHtml(chip = {}) {
    return `<span class="turnero-surface-ops__chip" data-state="${escapeHtml(
        chip.state || 'info'
    )}"><span>${escapeHtml(chip.label || 'Chip')}</span><strong>${escapeHtml(
        chip.value || '--'
    )}</strong></span>`;
}

function chipsRowHtml(chips = []) {
    const rows = toArray(chips);
    return rows.length > 0
        ? `<div class="turnero-admin-queue-surface-onboarding-console__chips">${rows
              .map((chip) => chipHtml(chip))
              .join('')}</div>`
        : '';
}

function surfaceCardHtml(surfacePack) {
    const snapshot = asObject(surfacePack.snapshot);
    const readout = asObject(surfacePack.readout);
    return `
        <article class="turnero-admin-queue-surface-onboarding-console__surface turnero-surface-ops__surface" data-surface="${escapeHtml(
            surfacePack.surfaceKey
        )}" data-state="${escapeHtml(
            readout.gateBand || surfacePack.gate?.band || 'watch'
        )}">
            <div class="turnero-admin-queue-surface-onboarding-console__surface-header">
                <div class="turnero-admin-queue-surface-onboarding-console__surface-title">
                    <strong>${escapeHtml(
                        snapshot.surfaceLabel || surfacePack.surfaceKey
                    )}</strong>
                    <p>${escapeHtml(
                        readout.summary || 'Onboarding visible.'
                    )}</p>
                </div>
                <span class="turnero-admin-queue-surface-onboarding-console__surface-badge">${escapeHtml(
                    readout.badge ||
                        `${surfacePack.gate?.band || 'watch'} · ${Number(
                            surfacePack.gate?.score || 0
                        )}`
                )}</span>
            </div>
            ${buildTurneroSurfaceOnboardingBannerHtml({
                pack: surfacePack,
                title: snapshot.surfaceLabel || surfacePack.surfaceKey,
                eyebrow: 'Surface onboarding',
            })}
            <p class="turnero-admin-queue-surface-onboarding-console__surface-detail">${escapeHtml(
                readout.detail || ''
            )}</p>
            <p class="turnero-admin-queue-surface-onboarding-console__surface-meta">${escapeHtml(
                `Checklist ${Number(readout.checklistPass || 0)}/${Number(
                    readout.checklistAll || 0
                )} · Items ${surfacePack.ledger.length} · Owners ${surfacePack.owners.length}`
            )}</p>
            ${chipsRowHtml(readout.chips)}
        </article>
    `;
}

function buildSurfaceGridHtml(state) {
    return `<div class="turnero-admin-queue-surface-onboarding-console__surface-grid">${state.surfacePacks
        .map((pack) => surfaceCardHtml(pack))
        .join('')}</div>`;
}

function buildSurfaceOptionsHtml(state, selectedSurfaceKey = '') {
    return state.surfaceSeeds
        .map((seed, index) => {
            const surfaceKey = toString(seed.surfaceKey, 'surface');
            const selected =
                surfaceKey === selectedSurfaceKey ||
                (!selectedSurfaceKey && index === 0);
            return `<option value="${escapeHtml(surfaceKey)}"${
                selected ? ' selected' : ''
            }>${escapeHtml(seed.surfaceLabel || surfaceKey)}</option>`;
        })
        .join('');
}

function buildLedgerFormHtml(state) {
    return `
        <form class="turnero-admin-queue-surface-onboarding-console__form" data-role="ledger-form">
            <label><span>Surface</span><select data-field="ledger-surface-key">${buildSurfaceOptionsHtml(
                state
            )}</select></label>
            <label><span>Title</span><input type="text" data-field="ledger-title" placeholder="Onboarding item" /></label>
            <label><span>Note</span><textarea data-field="ledger-note" placeholder="Brief onboarding note"></textarea></label>
            <button type="button" class="turnero-admin-queue-surface-onboarding-console__button" data-action="add-ledger" data-tone="primary">Add onboarding item</button>
        </form>
    `;
}

function buildOwnerFormHtml(state) {
    return `
        <form class="turnero-admin-queue-surface-onboarding-console__form" data-role="owner-form">
            <label><span>Surface</span><select data-field="owner-surface-key">${buildSurfaceOptionsHtml(
                state
            )}</select></label>
            <label><span>Actor</span><input type="text" data-field="owner-actor" placeholder="ops-lead" /></label>
            <label><span>Note</span><textarea data-field="owner-note" placeholder="Owner note"></textarea></label>
            <button type="button" class="turnero-admin-queue-surface-onboarding-console__button" data-action="add-owner" data-tone="primary">Add owner</button>
        </form>
    `;
}

function buildLedgerListHtml(state) {
    if (state.ledgerRows.length === 0) {
        return '<p class="turnero-admin-queue-surface-onboarding-console__meta">Sin onboarding items.</p>';
    }
    return `<div class="turnero-admin-queue-surface-onboarding-console__list">${state.ledgerRows
        .map(
            (entry) => `
                <article class="turnero-admin-queue-surface-onboarding-console__entry" data-state="${escapeHtml(
                    entry.status || 'ready'
                )}" data-ledger-id="${escapeHtml(entry.id)}">
                    <strong>${escapeHtml(entry.title || 'Onboarding item')}</strong>
                    <p>${escapeHtml(
                        `${entry.surfaceKey || 'surface'} · ${entry.owner || 'ops'} · ${entry.status || 'ready'}`
                    )}</p>
                    <p>${escapeHtml(entry.note || 'Sin nota')}</p>
                    <p class="turnero-admin-queue-surface-onboarding-console__entry-meta">${escapeHtml(
                        formatTimestamp(entry.updatedAt || entry.createdAt)
                    )}</p>
                </article>
            `
        )
        .join('')}</div>`;
}

function buildOwnerListHtml(state) {
    if (state.ownerRows.length === 0) {
        return '<p class="turnero-admin-queue-surface-onboarding-console__meta">Sin owners.</p>';
    }
    return `<div class="turnero-admin-queue-surface-onboarding-console__list">${state.ownerRows
        .map(
            (entry) => `
                <article class="turnero-admin-queue-surface-onboarding-console__entry" data-state="${escapeHtml(
                    entry.status || 'active'
                )}" data-owner-id="${escapeHtml(entry.id)}">
                    <strong>${escapeHtml(entry.actor || 'owner')}</strong>
                    <p>${escapeHtml(
                        `${entry.surfaceKey || 'surface'} · ${entry.role || 'onboarding'} · ${entry.status || 'active'}`
                    )}</p>
                    <p>${escapeHtml(entry.note || 'Sin nota')}</p>
                    <p class="turnero-admin-queue-surface-onboarding-console__entry-meta">${escapeHtml(
                        formatTimestamp(entry.updatedAt || entry.createdAt)
                    )}</p>
                </article>
            `
        )
        .join('')}</div>`;
}

function buildBrief(state) {
    const summary = asObject(state.summaryPack.readout);
    const lines = [
        summary.brief || '# Surface Customer Onboarding',
        '',
        '## Snapshot count',
    ];
    state.surfacePacks.forEach((pack) => {
        lines.push(
            `- ${toString(pack.snapshot?.surfaceLabel, pack.surfaceKey)}: ${toString(
                pack.gate?.band,
                'watch'
            )} (${Number(pack.gate?.score || 0)})`
        );
    });
    return lines.join('\n').trim();
}

function buildExportPayload(state) {
    return {
        scope: state.scope,
        clinicLabel: state.clinicLabel,
        checklist: state.checklist,
        snapshots: state.surfacePacks.map((pack) => pack.snapshot),
        surfacePacks: state.surfacePacks,
        ledger: state.ledgerRows,
        owners: state.ownerRows,
        summaryPack: state.summaryPack,
        generatedAt: state.generatedAt,
    };
}

export function buildTurneroAdminQueueSurfaceOnboardingConsoleHtml(input = {}) {
    const state = buildConsoleState(input, input.ledger, input.owners);
    const readout = asObject(state.summaryPack.readout);

    return `
        <section class="turnero-admin-queue-surface-onboarding-console" data-role="console" data-state="${escapeHtml(
            readout.gateBand || 'blocked'
        )}">
            <div class="turnero-admin-queue-surface-onboarding-console__header">
                <div class="turnero-admin-queue-surface-onboarding-console__header-copy">
                    <p class="turnero-admin-queue-surface-onboarding-console__eyebrow">Surface onboarding</p>
                    <h3>Surface Customer Onboarding</h3>
                    <p class="turnero-admin-queue-surface-onboarding-console__meta">${escapeHtml(
                        `${state.clinicLabel || 'Clínica'} · scope ${state.scope}`
                    )}</p>
                </div>
                <div class="turnero-admin-queue-surface-onboarding-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-onboarding-console__button" data-action="copy-brief" data-tone="primary">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-onboarding-console__button" data-action="download-json">Download JSON</button>
                </div>
            </div>
            <div class="turnero-admin-queue-surface-onboarding-console__metrics">
                ${metricCard('Snapshots', state.surfacePacks.length)}
                ${metricCard('Onboarding items', state.ledgerRows.length)}
                ${metricCard('Owners', state.ownerRows.length)}
                ${metricCard(
                    'Gate',
                    `${readout.gateScore || 0} · ${readout.gateBand || 'watch'}`,
                    readout.gateBand === 'ready'
                        ? 'ready'
                        : readout.gateBand === 'watch' ||
                            readout.gateBand === 'degraded'
                          ? 'warning'
                          : 'alert'
                )}
            </div>
            ${buildTurneroSurfaceOnboardingBannerHtml({
                pack: state.summaryPack,
                title: 'Surface Customer Onboarding',
                eyebrow: 'Surface onboarding',
            })}
            ${buildSurfaceGridHtml(state)}
            <div class="turnero-admin-queue-surface-onboarding-console__forms">
                ${buildLedgerFormHtml(state)}
                ${buildOwnerFormHtml(state)}
            </div>
            <section class="turnero-admin-queue-surface-onboarding-console__section">
                <h4>Onboarding items</h4>
                ${buildLedgerListHtml(state)}
            </section>
            <section class="turnero-admin-queue-surface-onboarding-console__section">
                <h4>Owners</h4>
                ${buildOwnerListHtml(state)}
            </section>
            <pre class="turnero-admin-queue-surface-onboarding-console__brief" data-role="brief">${escapeHtml(
                buildBrief(state)
            )}</pre>
        </section>
    `;
}

export function mountTurneroAdminQueueSurfaceOnboardingConsole(
    target,
    input = {}
) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureConsoleStyles();

    const clinicProfile = asObject(input.clinicProfile);
    const scope = getScope(input, clinicProfile);
    const ledgerStore = createTurneroSurfaceOnboardingLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceOnboardingOwnerStore(
        scope,
        clinicProfile
    );

    let state = buildConsoleState(input, ledgerStore.list(), ownerStore.list());

    const render = () => {
        root.innerHTML = buildTurneroAdminQueueSurfaceOnboardingConsoleHtml({
            ...input,
            clinicProfile,
            scope,
            snapshots: state.surfacePacks.map((pack) => pack.snapshot),
            checklist: state.checklist,
            ledger: state.ledgerRows,
            owners: state.ownerRows,
        });
        root.dataset.state = toString(state.summaryPack.gate?.band, 'blocked');
        return root.querySelector(
            '.turnero-admin-queue-surface-onboarding-console'
        );
    };

    const recompute = () => {
        state = buildConsoleState(input, ledgerStore.list(), ownerStore.list());
        return render();
    };

    render();
    root.onclick = async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyToClipboardSafe(buildBrief(state));
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-customer-onboarding.json',
                buildExportPayload(state)
            );
            return;
        }
        if (action === 'add-ledger') {
            const surfaceKey = toString(
                root.querySelector('[data-field="ledger-surface-key"]')?.value,
                ''
            );
            const title = toString(
                root.querySelector('[data-field="ledger-title"]')?.value,
                ''
            );
            const note = toString(
                root.querySelector('[data-field="ledger-note"]')?.value,
                ''
            );
            if (!surfaceKey) {
                return;
            }
            ledgerStore.add({
                surfaceKey,
                title: title || 'Onboarding item',
                owner: 'ops',
                status: 'ready',
                note,
            });
            recompute();
            return;
        }
        if (action === 'add-owner') {
            const surfaceKey = toString(
                root.querySelector('[data-field="owner-surface-key"]')?.value,
                ''
            );
            const actor = toString(
                root.querySelector('[data-field="owner-actor"]')?.value,
                ''
            );
            const note = toString(
                root.querySelector('[data-field="owner-note"]')?.value,
                ''
            );
            if (!surfaceKey) {
                return;
            }
            ownerStore.add({
                surfaceKey,
                actor: actor || 'owner',
                role: 'onboarding',
                status: 'active',
                note,
            });
            recompute();
        }
    };

    return {
        root,
        get state() {
            return state;
        },
        recompute,
    };
}
