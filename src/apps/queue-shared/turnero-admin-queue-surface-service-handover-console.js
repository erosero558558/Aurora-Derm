import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { createTurneroSurfaceOwnerRosterStore } from './turnero-surface-owner-roster-store.js';
import { createTurneroSurfaceServicePlaybookLedger } from './turnero-surface-service-playbook-ledger.js';
import { buildTurneroSurfaceServiceHandoverBannerHtml } from './turnero-surface-service-handover-banner.js';
import { buildTurneroSurfaceServiceHandoverGate } from './turnero-surface-service-handover-gate.js';
import { buildTurneroSurfaceServiceHandoverPack } from './turnero-surface-service-handover-pack.js';
import { buildTurneroSurfaceServiceHandoverSnapshot } from './turnero-surface-service-handover-snapshot.js';
import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
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

const STYLE_ID = 'turneroAdminQueueSurfaceServiceHandoverConsoleInlineStyles';
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
        .turnero-admin-queue-surface-service-handover-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-service-handover-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.8rem;align-items:flex-start}
        .turnero-admin-queue-surface-service-handover-console__header-copy{display:grid;gap:.2rem}
        .turnero-admin-queue-surface-service-handover-console__eyebrow,.turnero-admin-queue-surface-service-handover-console__meta,.turnero-admin-queue-surface-service-handover-console__section h4,.turnero-admin-queue-surface-service-handover-console__section p{margin:0}
        .turnero-admin-queue-surface-service-handover-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-service-handover-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-service-handover-console__actions,.turnero-admin-queue-surface-service-handover-console__form-actions,.turnero-admin-queue-surface-service-handover-console__chips{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-service-handover-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-service-handover-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-service-handover-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-service-handover-console__metric{display:grid;gap:.18rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-service-handover-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-service-handover-console__banner-host{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-service-handover-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem}
        .turnero-admin-queue-surface-service-handover-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-service-handover-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-service-handover-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-service-handover-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-service-handover-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-service-handover-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-service-handover-console__surface-title p,.turnero-admin-queue-surface-service-handover-console__surface-detail,.turnero-admin-queue-surface-service-handover-console__surface-meta,.turnero-admin-queue-surface-service-handover-console__entry-meta{margin:0;font-size:.84rem;line-height:1.45;opacity:.84}
        .turnero-admin-queue-surface-service-handover-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-service-handover-console__section{display:grid;gap:.5rem}
        .turnero-admin-queue-surface-service-handover-console__section h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;opacity:.72}
        .turnero-admin-queue-surface-service-handover-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-service-handover-console__form label{display:grid;gap:.28rem;font-size:.78rem}
        .turnero-admin-queue-surface-service-handover-console__form input,.turnero-admin-queue-surface-service-handover-console__form select,.turnero-admin-queue-surface-service-handover-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-service-handover-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-service-handover-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-service-handover-console__entry{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-service-handover-console__entry[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-service-handover-console__entry[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-service-handover-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-service-handover-console__header,.turnero-admin-queue-surface-service-handover-console__surface-header{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeChecklistSummary(input = {}, fallback = DEFAULT_CHECKLIST) {
    const source = asObject(input);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => asObject(item));
    const all = Number(summary.all || (checks.length > 0 ? checks.length : fallback.all)) || 0;
    const pass = Number(summary.pass || (checks.length > 0 ? checks.filter((check) => check.pass === true).length : fallback.pass)) || 0;
    const fail = Number(summary.fail || (checks.length > 0 ? checks.filter((check) => check.pass !== true).length : fallback.fail)) || 0;
    return { all: Math.max(0, all), pass: Math.max(0, pass), fail: Math.max(0, fail), checks };
}

function defaultSurfaceChecklist(surfaceKey) {
    return DEFAULT_SURFACE_CHECKLISTS[toString(surfaceKey, '')] || { all: 0, pass: 0, fail: 0 };
}

function resolveSurfaceSeeds(input = {}, clinicProfile = null, scope = 'regional') {
    const provided = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const source = provided.length > 0 ? provided : [
        { surfaceKey: 'operator-turnos', checklist: defaultSurfaceChecklist('operator-turnos') },
        { surfaceKey: 'kiosco-turnos', checklist: defaultSurfaceChecklist('kiosco-turnos') },
        { surfaceKey: 'sala-turnos', checklist: defaultSurfaceChecklist('sala-turnos') },
    ];
    return source.map((snapshot) => {
        const normalized = buildTurneroSurfaceServiceHandoverSnapshot({
            ...asObject(snapshot),
            clinicProfile,
            scope,
        });
        return {
            ...normalized,
            checklist: normalizeChecklistSummary(asObject(snapshot.checklist), defaultSurfaceChecklist(normalized.surfaceKey)),
        };
    }).sort((left, right) => surfaceOrderRank(left.surfaceKey) - surfaceOrderRank(right.surfaceKey));
}

function normalizePlaybookRows(rows = [], scope = 'regional') {
    return toArray(rows).map((entry) => {
        const source = asObject(entry);
        const createdAt = toString(source.createdAt || source.updatedAt, '') || new Date().toISOString();
        return {
            id: toString(source.id, '') || `playbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            scope: toString(source.scope, scope),
            surfaceKey: toString(source.surfaceKey, 'surface'),
            title: toString(source.title || source.label, 'Service playbook item'),
            owner: toString(source.owner, 'ops'),
            status: toString(source.status, 'ready').toLowerCase() || 'ready',
            note: toString(source.note || source.detail, ''),
            createdAt,
            updatedAt: toString(source.updatedAt, createdAt),
        };
    }).sort((left, right) => {
        const order = surfaceOrderRank(left.surfaceKey) - surfaceOrderRank(right.surfaceKey);
        return order !== 0 ? order : String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
    });
}

function normalizeRosterRows(rows = [], scope = 'regional') {
    return toArray(rows).map((entry) => {
        const source = asObject(entry);
        const createdAt = toString(source.createdAt || source.updatedAt, '') || new Date().toISOString();
        return {
            id: toString(source.id, '') || `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            scope: toString(source.scope, scope),
            surfaceKey: toString(source.surfaceKey, 'surface'),
            actor: toString(source.actor || source.owner, 'owner'),
            role: toString(source.role, 'primary').toLowerCase() || 'primary',
            status: toString(source.status, 'active').toLowerCase() || 'active',
            note: toString(source.note || source.detail, ''),
            createdAt,
            updatedAt: toString(source.updatedAt, createdAt),
        };
    }).sort((left, right) => {
        const order = surfaceOrderRank(left.surfaceKey) - surfaceOrderRank(right.surfaceKey);
        return order !== 0 ? order : String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
    });
}

function resolveOverallChecklist(input = {}) {
    const source = asObject(input.checklist);
    return Object.keys(source).length > 0 || Array.isArray(source.checks)
        ? normalizeChecklistSummary(source, DEFAULT_CHECKLIST)
        : { ...DEFAULT_CHECKLIST };
}

function resolveSummaryOwners(rosterRows = []) {
    const activeRows = rosterRows.filter((entry) => toString(entry.status, 'active') !== 'blocked');
    const primary = activeRows.find((entry) => toString(entry.role, '') === 'primary') || activeRows[0] || null;
    const backup = activeRows.find((entry) => toString(entry.role, '') === 'backup' && entry.actor !== primary?.actor) || activeRows.find((entry) => entry.actor !== primary?.actor) || null;
    return { primaryOwner: toString(primary?.actor, ''), backupOwner: toString(backup?.actor, '') };
}

function buildSurfacePack(seed, clinicProfile, scope, playbookRows, rosterRows) {
    const surfaceKey = toString(seed.surfaceKey, 'surface');
    const checklist = normalizeChecklistSummary(asObject(seed.checklist), defaultSurfaceChecklist(surfaceKey));
    const playbook = playbookRows.filter((entry) => toString(entry.surfaceKey, '') === surfaceKey);
    const roster = rosterRows.filter((entry) => toString(entry.surfaceKey, '') === surfaceKey);
    return buildTurneroSurfaceServiceHandoverPack({
        ...seed,
        scope: toString(seed.scope, scope),
        surfaceKey,
        clinicProfile,
        checklist,
        playbook,
        roster,
    });
}

function buildSummaryPack(clinicProfile, scope, checklist, playbookRows, rosterRows, overallGate) {
    const owners = resolveSummaryOwners(rosterRows);
    return buildTurneroSurfaceServiceHandoverPack({
        surfaceKey: 'service-handover-console',
        surfaceLabel: 'Surface Service Handover Console',
        scope,
        clinicProfile,
        runtimeState: overallGate.band === 'ready' ? 'ready' : 'watch',
        truth: overallGate.band === 'ready' ? 'aligned' : 'watch',
        primaryOwner: owners.primaryOwner,
        backupOwner: owners.backupOwner,
        playbookState: overallGate.readyPlaybookCount > 0 ? 'ready' : 'missing',
        supportChannel: overallGate.band === 'ready' ? 'chat' : 'whatsapp',
        handoverMode: overallGate.band === 'ready' ? 'broadcast' : 'guided',
        checklist,
        playbook: playbookRows,
        roster: rosterRows,
        gate: overallGate,
    });
}

function buildConsoleState(input = {}, playbookOverride = null, rosterOverride = null) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = getScope(input, clinicProfile);
    const clinicLabel = getClinicLabel(clinicProfile);
    const surfaceSeeds = resolveSurfaceSeeds(input, clinicProfile, scope);
    const playbookRows = normalizePlaybookRows(Array.isArray(playbookOverride) ? playbookOverride : Array.isArray(input.playbook) ? input.playbook : [], scope);
    const rosterRows = normalizeRosterRows(Array.isArray(rosterOverride) ? rosterOverride : Array.isArray(input.roster) ? input.roster : [], scope);
    const surfacePacks = surfaceSeeds.map((seed) => buildSurfacePack(seed, clinicProfile, scope, playbookRows, rosterRows));
    const checklist = resolveOverallChecklist(input);
    const overallGate = buildTurneroSurfaceServiceHandoverGate({
        surfacePacks,
        checklist,
        playbook: playbookRows,
        roster: rosterRows,
    });
    return {
        scope,
        clinicProfile,
        clinicLabel,
        surfaceSeeds,
        surfacePacks,
        playbookRows,
        rosterRows,
        checklist,
        overallGate,
        summaryPack: buildSummaryPack(clinicProfile, scope, checklist, playbookRows, rosterRows, overallGate),
        generatedAt: new Date().toISOString(),
    };
}

function metricCard(label, value, state = 'ready') {
    return `<article class="turnero-admin-queue-surface-service-handover-console__metric" data-state="${escapeHtml(state)}"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></article>`;
}

function chipHtml(chip = {}) {
    return `<span class="turnero-surface-ops__chip" data-state="${escapeHtml(chip.state || 'info')}"><span>${escapeHtml(chip.label || 'Chip')}</span><strong>${escapeHtml(chip.value || '--')}</strong></span>`;
}

function chipsRowHtml(chips = []) {
    const rows = toArray(chips);
    return rows.length > 0
        ? `<div class="turnero-admin-queue-surface-service-handover-console__chips">${rows.map((chip) => chipHtml(chip)).join('')}</div>`
        : '';
}

function surfaceCardHtml(surfacePack) {
    const snapshot = asObject(surfacePack.snapshot);
    const readout = asObject(surfacePack.readout);
    const summary = asObject(surfacePack.checklist?.summary);
    return `
        <article class="turnero-admin-queue-surface-service-handover-console__surface turnero-surface-ops__surface" data-surface="${escapeHtml(surfacePack.surfaceKey)}" data-state="${escapeHtml(readout.gateBand || surfacePack.gate?.band || 'watch')}">
            <div class="turnero-admin-queue-surface-service-handover-console__surface-header">
                <div class="turnero-admin-queue-surface-service-handover-console__surface-title">
                    <strong>${escapeHtml(snapshot.surfaceLabel || surfacePack.surfaceKey)}</strong>
                    <p>${escapeHtml(readout.summary || 'Service handover visible.')}</p>
                </div>
                <span class="turnero-admin-queue-surface-service-handover-console__surface-badge">${escapeHtml(readout.badge || `${surfacePack.gate?.band || 'watch'} · ${Number(surfacePack.gate?.score || 0)}`)}</span>
            </div>
            ${buildTurneroSurfaceServiceHandoverBannerHtml({ pack: surfacePack, title: snapshot.surfaceLabel || surfacePack.surfaceKey, eyebrow: 'Surface service handover' })}
            <p class="turnero-admin-queue-surface-service-handover-console__surface-detail">${escapeHtml(readout.detail || '')}</p>
            <p class="turnero-admin-queue-surface-service-handover-console__surface-meta">${escapeHtml(`Checklist ${Number(summary.pass || 0)}/${Number(summary.all || 0)} · Playbook ${surfacePack.playbook.length} · Owners ${surfacePack.roster.length}`)}</p>
            ${chipsRowHtml(readout.chips)}
        </article>
    `;
}

function buildSurfaceGridHtml(state) {
    return `<div class="turnero-admin-queue-surface-service-handover-console__surface-grid">${state.surfacePacks.map((pack) => surfaceCardHtml(pack)).join('')}</div>`;
}

function buildSurfaceOptionsHtml(state, selectedSurfaceKey = '') {
    return state.surfaceSeeds
        .map((seed, index) => {
            const surfaceKey = toString(seed.surfaceKey, 'surface');
            const selected = surfaceKey === selectedSurfaceKey || (!selectedSurfaceKey && index === 0);
            return `<option value="${escapeHtml(surfaceKey)}"${selected ? ' selected' : ''}>${escapeHtml(seed.surfaceLabel || surfaceKey)}</option>`;
        })
        .join('');
}

function buildPlaybookFormHtml(state) {
    return `
        <form class="turnero-admin-queue-surface-service-handover-console__form" data-role="playbook-form">
            <label><span>Surface</span><select data-field="playbook-surface-key">${buildSurfaceOptionsHtml(state)}</select></label>
            <label><span>Title</span><input type="text" data-field="playbook-title" placeholder="Service playbook item" /></label>
            <label><span>Owner</span><input type="text" data-field="playbook-owner" value="ops" /></label>
            <label><span>Status</span><select data-field="playbook-status"><option value="ready">ready</option><option value="watch">watch</option><option value="blocked">blocked</option><option value="draft">draft</option></select></label>
            <label><span>Note</span><textarea data-field="playbook-note" placeholder="Brief playbook note"></textarea></label>
            <div class="turnero-admin-queue-surface-service-handover-console__form-actions"><button type="button" class="turnero-admin-queue-surface-ops-console__button turnero-admin-queue-surface-service-handover-console__button" data-action="add-playbook" data-tone="primary">Add playbook</button></div>
        </form>
    `;
}

function buildOwnerFormHtml(state) {
    return `
        <form class="turnero-admin-queue-surface-service-handover-console__form" data-role="owner-form">
            <label><span>Surface</span><select data-field="owner-surface-key">${buildSurfaceOptionsHtml(state)}</select></label>
            <label><span>Actor</span><input type="text" data-field="owner-actor" placeholder="ops-lead" /></label>
            <label><span>Role</span><input type="text" data-field="owner-role" value="primary" /></label>
            <label><span>Status</span><select data-field="owner-status"><option value="active">active</option><option value="watch">watch</option><option value="blocked">blocked</option><option value="standby">standby</option><option value="handoff">handoff</option></select></label>
            <label><span>Note</span><textarea data-field="owner-note" placeholder="Owner note"></textarea></label>
            <div class="turnero-admin-queue-surface-service-handover-console__form-actions"><button type="button" class="turnero-admin-queue-surface-ops-console__button turnero-admin-queue-surface-service-handover-console__button" data-action="add-owner" data-tone="primary">Add owner</button></div>
        </form>
    `;
}

function buildPlaybookListHtml(state) {
    if (state.playbookRows.length === 0) {
        return '<p class="turnero-admin-queue-surface-service-handover-console__meta">Sin playbook.</p>';
    }
    return `<div class="turnero-admin-queue-surface-service-handover-console__list">${state.playbookRows.map((entry) => `<article class="turnero-admin-queue-surface-service-handover-console__entry" data-state="${escapeHtml(entry.status || 'ready')}" data-playbook-id="${escapeHtml(entry.id)}"><div><strong>${escapeHtml(entry.title || 'Service playbook item')}</strong><p>${escapeHtml(`${entry.surfaceKey || 'surface'} · ${entry.owner || 'ops'} · ${entry.status || 'ready'}`)}</p><p>${escapeHtml(entry.note || 'Sin nota')}</p></div><div class="turnero-admin-queue-surface-service-handover-console__entry-meta"><span>${escapeHtml(formatTimestamp(entry.updatedAt || entry.createdAt))}</span></div></article>`).join('')}</div>`;
}

function buildOwnerListHtml(state) {
    if (state.rosterRows.length === 0) {
        return '<p class="turnero-admin-queue-surface-service-handover-console__meta">Sin owners.</p>';
    }
    return `<div class="turnero-admin-queue-surface-service-handover-console__list">${state.rosterRows.map((entry) => `<article class="turnero-admin-queue-surface-service-handover-console__entry" data-state="${escapeHtml(entry.status || 'active')}" data-owner-id="${escapeHtml(entry.id)}"><div><strong>${escapeHtml(entry.actor || 'owner')}</strong><p>${escapeHtml(`${entry.surfaceKey || 'surface'} · ${entry.role || 'primary'} · ${entry.status || 'active'}`)}</p><p>${escapeHtml(entry.note || 'Sin nota')}</p></div><div class="turnero-admin-queue-surface-service-handover-console__entry-meta"><span>${escapeHtml(formatTimestamp(entry.updatedAt || entry.createdAt))}</span></div></article>`).join('')}</div>`;
}

function buildBrief(state) {
    const gate = state.overallGate || {};
    const lines = [
        '# Surface Service Handover Console',
        '',
        `Clinic: ${toString(state.clinicLabel, state.clinicProfile?.clinic_id || 'n/a')}`,
        `Scope: ${toString(state.scope, 'regional')}`,
        `Gate: ${toString(gate.band, 'unknown')} (${Number(gate.score || 0)})`,
        `Decision: ${toString(gate.decision, 'review-service-handover')}`,
        '',
        '## Surfaces',
    ];
    state.surfacePacks.forEach((pack) => {
        lines.push(`- ${toString(pack.snapshot?.surfaceLabel, pack.surfaceKey)} · ${toString(pack.readout?.gateBand, 'unknown')} · ${toString(pack.readout?.summary, '')} · ${toString(pack.readout?.detail, '')}`);
    });
    lines.push('', '## Playbook');
    if (state.playbookRows.length === 0) {
        lines.push('- Sin playbook.');
    } else {
        state.playbookRows.forEach((entry) => {
            lines.push(`- [${toString(entry.status, 'ready')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.title, 'Service playbook item')} · ${toString(entry.owner, 'ops')} · ${toString(entry.note, '')}`);
        });
    }
    lines.push('', '## Owners');
    if (state.rosterRows.length === 0) {
        lines.push('- Sin owners.');
    } else {
        state.rosterRows.forEach((entry) => {
            lines.push(`- [${toString(entry.status, 'active')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.actor, 'owner')} · ${toString(entry.role, 'primary')} · ${toString(entry.note, '')}`);
        });
    }
    return lines.join('\n').trim();
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        clinicLabel: state.clinicLabel,
        checklist: state.checklist,
        gate: state.overallGate,
        summaryPack: state.summaryPack,
        surfacePacks: state.surfacePacks,
        playbook: state.playbookRows,
        roster: state.rosterRows,
        brief: buildBrief(state),
        generatedAt: state.generatedAt,
        currentRoute:
            typeof window !== 'undefined'
                ? `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
                : '',
    };
}

function buildConsoleHtml(state) {
    const bannerHtml = buildTurneroSurfaceServiceHandoverBannerHtml({
        pack: state.summaryPack,
        title: 'Surface Service Handover Console',
        eyebrow: 'Admin console',
    });
    const brief = buildBrief(state);
    return `
        <section class="turnero-admin-queue-surface-service-handover-console" data-state="${escapeHtml(state.overallGate.band || 'watch')}" data-scope="${escapeHtml(state.scope)}" data-surfaces="${escapeHtml(String(state.surfacePacks.length))}" data-playbook="${escapeHtml(String(state.playbookRows.length))}" data-owners="${escapeHtml(String(state.rosterRows.length))}">
            <header class="turnero-admin-queue-surface-service-handover-console__header">
                <div class="turnero-admin-queue-surface-service-handover-console__header-copy">
                    <p class="turnero-admin-queue-surface-service-handover-console__eyebrow">Surface Service Handover</p>
                    <h3>Surface Service Handover Console</h3>
                    <p class="turnero-admin-queue-surface-service-handover-console__meta">${escapeHtml(`${state.clinicLabel || 'Clinic'} · scope ${state.scope} · ${state.overallGate.band} · ${Number(state.overallGate.score || 0)}`)}</p>
                    <p class="turnero-admin-queue-surface-service-handover-console__meta">${escapeHtml(`${state.surfacePacks.length} surfaces · ready ${state.overallGate.readySnapshotCount || 0} · watch ${state.overallGate.watchSnapshotCount || 0} · blocked ${state.overallGate.blockedSnapshotCount || 0}`)}</p>
                </div>
                <div class="turnero-admin-queue-surface-service-handover-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-ops-console__button turnero-admin-queue-surface-service-handover-console__button" data-action="copy-brief" data-tone="primary">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-ops-console__button turnero-admin-queue-surface-service-handover-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-ops-console__button turnero-admin-queue-surface-service-handover-console__button" data-action="recompute">Recompute</button>
                </div>
            </header>
            <div class="turnero-admin-queue-surface-service-handover-console__metrics">${[
                metricCard('Surfaces', state.surfacePacks.length, state.overallGate.band),
                metricCard('Gate', `${state.overallGate.band} · ${Number(state.overallGate.score || 0)}`, state.overallGate.band),
                metricCard('Playbook', state.playbookRows.length, state.playbookRows.length ? 'watch' : 'ready'),
                metricCard('Owners', state.rosterRows.length, state.rosterRows.length ? 'watch' : 'ready'),
            ].join('')}</div>
            <div class="turnero-admin-queue-surface-service-handover-console__banner-host">${bannerHtml}${chipsRowHtml(state.summaryPack.readout?.chips)}</div>
            ${buildSurfaceGridHtml(state)}
            <section class="turnero-admin-queue-surface-service-handover-console__section">
                <h4>Playbook</h4>
                <p class="turnero-admin-queue-surface-service-handover-console__meta">Read and add playbook rows per surface.</p>
                ${buildPlaybookFormHtml(state)}
                ${buildPlaybookListHtml(state)}
            </section>
            <section class="turnero-admin-queue-surface-service-handover-console__section">
                <h4>Owners</h4>
                <p class="turnero-admin-queue-surface-service-handover-console__meta">Read and add owner rows per surface.</p>
                ${buildOwnerFormHtml(state)}
                ${buildOwnerListHtml(state)}
            </section>
            <pre class="turnero-admin-queue-surface-service-handover-console__brief" data-role="brief">${escapeHtml(brief)}</pre>
        </section>
    `;
}

function syncState(target, source) {
    Object.keys(target).forEach((key) => {
        delete target[key];
    });
    Object.assign(target, source);
}

function getFieldValue(form, fieldName, fallback = '') {
    if (!(form instanceof HTMLElement)) {
        return fallback;
    }
    const field = form.querySelector(`[data-field="${fieldName}"]`);
    return field ? toString(field.value, fallback) : fallback;
}

function setConsoleDataset(host, state) {
    if (!(host instanceof HTMLElement)) {
        return;
    }
    host.dataset.turneroAdminQueueSurfaceServiceHandoverConsole = 'mounted';
    host.dataset.band = state.overallGate.band;
    host.dataset.state = state.overallGate.band;
    host.dataset.surfaceCount = String(state.surfacePacks.length);
    host.dataset.playbookCount = String(state.playbookRows.length);
    host.dataset.ownerCount = String(state.rosterRows.length);
}

export function buildTurneroAdminQueueSurfaceServiceHandoverConsoleHtml(input = {}) {
    return buildConsoleHtml(buildConsoleState(input, input.playbook, input.roster));
}

export function mountTurneroAdminQueueSurfaceServiceHandoverConsole(target, input = {}) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureConsoleStyles();

    const scope = getScope(input, asObject(input.clinicProfile));
    const clinicProfile = asObject(input.clinicProfile);
    const playbookLedger =
        input.playbookLedger ||
        createTurneroSurfaceServicePlaybookLedger(scope, clinicProfile);
    const ownerRosterStore =
        input.ownerRosterStore ||
        createTurneroSurfaceOwnerRosterStore(scope, clinicProfile);

    const state = buildConsoleState(input, playbookLedger.list(), ownerRosterStore.list());
    const controller = {
        root: host,
        state,
        playbookLedger,
        ownerRosterStore,
        refresh,
        destroy,
    };
    let destroyed = false;

    function render() {
        if (destroyed) {
            return controller;
        }
        syncState(
            state,
            buildConsoleState(
                input,
                playbookLedger.list(),
                ownerRosterStore.list()
            )
        );
        host.innerHTML = buildConsoleHtml(state);
        setConsoleDataset(host, state);
        return controller;
    }

    function refresh() {
        return render();
    }

    async function handleAction(action, actionTarget) {
        if (action === 'copy-brief') {
            await copyTextToClipboard(buildBrief(state));
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-service-handover-console.json',
                buildDownloadPayload(state)
            );
            return;
        }
        if (action === 'recompute') {
            render();
            return;
        }
        if (action === 'add-playbook') {
            const form =
                actionTarget.closest('[data-role="playbook-form"]') ||
                host.querySelector('[data-role="playbook-form"]');
            if (!(form instanceof HTMLElement)) {
                return;
            }
            playbookLedger.add({
                scope: state.scope,
                surfaceKey: getFieldValue(
                    form,
                    'playbook-surface-key',
                    state.surfacePacks[0]?.surfaceKey || 'operator-turnos'
                ),
                title: getFieldValue(form, 'playbook-title', 'Service playbook item'),
                owner: getFieldValue(form, 'playbook-owner', 'ops'),
                status: getFieldValue(form, 'playbook-status', 'ready'),
                note: getFieldValue(form, 'playbook-note', ''),
            });
            render();
            return;
        }
        if (action === 'add-owner') {
            const form =
                actionTarget.closest('[data-role="owner-form"]') ||
                host.querySelector('[data-role="owner-form"]');
            if (!(form instanceof HTMLElement)) {
                return;
            }
            ownerRosterStore.add({
                scope: state.scope,
                surfaceKey: getFieldValue(
                    form,
                    'owner-surface-key',
                    state.surfacePacks[0]?.surfaceKey || 'operator-turnos'
                ),
                actor: getFieldValue(form, 'owner-actor', 'owner'),
                role: getFieldValue(form, 'owner-role', 'primary'),
                status: getFieldValue(form, 'owner-status', 'active'),
                note: getFieldValue(form, 'owner-note', ''),
            });
            render();
        }
    }

    function onClick(event) {
        const targetNode = event?.target;
        if (typeof Element === 'undefined' || !(targetNode instanceof Element)) {
            return;
        }
        const actionTarget = targetNode.closest('[data-action]');
        if (!actionTarget) {
            return;
        }
        const action = toString(actionTarget.getAttribute('data-action'), '');
        if (!action) {
            return;
        }
        event.preventDefault();
        handleAction(action, actionTarget);
    }

    function destroy() {
        destroyed = true;
        host.removeEventListener('click', onClick);
    }

    host.addEventListener('click', onClick);
    render();
    return controller;
}
