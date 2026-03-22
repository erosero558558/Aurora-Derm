import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';
import { createTurneroSurfaceRenewalLedger } from './turnero-surface-renewal-ledger.js';
import { createTurneroSurfaceRenewalOwnerStore } from './turnero-surface-renewal-owner-store.js';
import { buildTurneroSurfaceRenewalPack } from './turnero-surface-renewal-pack.js';
import { buildTurneroSurfaceRenewalSnapshot } from './turnero-surface-renewal-snapshot.js';
import { mountTurneroSurfaceRenewalBanner } from './turnero-surface-renewal-banner.js';
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
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroAdminQueueSurfaceRenewalConsoleInlineStyles';

function ensureStyles() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(STYLE_ID)) return true;

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-renewal-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-renewal-console__header,.turnero-admin-queue-surface-renewal-console__actions,.turnero-admin-queue-surface-renewal-console__section-header,.turnero-admin-queue-surface-renewal-console__form-actions{display:flex;flex-wrap:wrap;gap:.55rem}
        .turnero-admin-queue-surface-renewal-console__header{justify-content:space-between;align-items:flex-start}
        .turnero-admin-queue-surface-renewal-console__header h3,.turnero-admin-queue-surface-renewal-console__eyebrow,.turnero-admin-queue-surface-renewal-console__summary,.turnero-admin-queue-surface-renewal-console__section h4,.turnero-admin-queue-surface-renewal-console__section p{margin:0}
        .turnero-admin-queue-surface-renewal-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-renewal-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-renewal-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-renewal-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-renewal-console__metric,.turnero-admin-queue-surface-renewal-console__surface,.turnero-admin-queue-surface-renewal-console__entry{display:grid;gap:.25rem;padding:.8rem .9rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-renewal-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-renewal-console__surface-header,.turnero-admin-queue-surface-renewal-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-renewal-console__surface-title,.turnero-admin-queue-surface-renewal-console__section{display:grid;gap:.18rem}
        .turnero-admin-queue-surface-renewal-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-renewal-console__surface-title p,.turnero-admin-queue-surface-renewal-console__entry-meta,.turnero-admin-queue-surface-renewal-console__metric span{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-renewal-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-renewal-console__surface-summary,.turnero-admin-queue-surface-renewal-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-renewal-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-renewal-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-renewal-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-renewal-console__form input,.turnero-admin-queue-surface-renewal-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-renewal-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-renewal-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-renewal-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-renewal-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getSurfaceLabel(surfaceKey, clinicProfile) {
    if (surfaceKey === 'operator-turnos') {
        return toString(
            clinicProfile?.surfaces?.operator?.label,
            'Turnero Operador'
        );
    }
    if (surfaceKey === 'kiosco-turnos') {
        return toString(
            clinicProfile?.surfaces?.kiosk?.label,
            'Turnero Kiosco'
        );
    }
    if (surfaceKey === 'sala-turnos') {
        return toString(
            clinicProfile?.surfaces?.display?.label,
            'Turnero Sala TV'
        );
    }
    return toString(surfaceKey, 'surface');
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

function defaultChecklistForSurface(surfaceKey) {
    return surfaceKey === 'kiosco-turnos'
        ? { summary: { all: 4, pass: 2, fail: 2 } }
        : { summary: { all: 4, pass: 3, fail: 1 } };
}

function resolveSnapshotSeeds(input = {}, clinicProfile = null) {
    const source = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : [];
    const direct = source.length
        ? source
        : [
              {
                  surfaceKey: 'operator-turnos',
                  label: getSurfaceLabel('operator-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  renewalValueBand: 'high',
                  retentionSignal: 'stable',
                  feedbackState: 'good',
                  activityState: 'active',
                  pendingCorrections: 0,
                  renewalOwner: 'renewal-lead',
                  commercialOwner: 'ernesto',
                  successOwner: 'ops-lead',
                  nextRenewalWindow: '30 dias',
                  checklist: defaultChecklistForSurface('operator-turnos'),
              },
              {
                  surfaceKey: 'kiosco-turnos',
                  label: getSurfaceLabel('kiosco-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  renewalValueBand: 'medium',
                  retentionSignal: 'fragile',
                  feedbackState: 'mixed',
                  activityState: 'watch',
                  pendingCorrections: 2,
                  renewalOwner: '',
                  commercialOwner: '',
                  successOwner: 'ops-kiosk',
                  nextRenewalWindow: '15 dias',
                  checklist: defaultChecklistForSurface('kiosco-turnos'),
              },
              {
                  surfaceKey: 'sala-turnos',
                  label: getSurfaceLabel('sala-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'aligned',
                  renewalValueBand: 'high',
                  retentionSignal: 'stable',
                  feedbackState: 'good',
                  activityState: 'active',
                  pendingCorrections: 0,
                  renewalOwner: 'ops-display',
                  commercialOwner: 'ernesto',
                  successOwner: 'ops-display',
                  nextRenewalWindow: '45 dias',
                  checklist: defaultChecklistForSurface('sala-turnos'),
              },
          ];

    return direct.map((seed) => {
        const surfaceKey = toString(seed.surfaceKey, 'surface');
        return {
            label: toString(
                seed.label,
                getSurfaceLabel(surfaceKey, clinicProfile)
            ),
            surfaceKey,
            clinicProfile,
            runtimeState: toString(seed.runtimeState, 'ready'),
            truth: toString(seed.truth, 'watch'),
            renewalValueBand: toString(seed.renewalValueBand, 'medium'),
            retentionSignal: toString(seed.retentionSignal, 'stable'),
            feedbackState: toString(seed.feedbackState, 'good'),
            activityState: toString(seed.activityState, 'active'),
            pendingCorrections: Math.max(
                0,
                Number(seed.pendingCorrections || 0) || 0
            ),
            renewalOwner: toString(seed.renewalOwner, ''),
            commercialOwner: toString(seed.commercialOwner, ''),
            successOwner: toString(seed.successOwner, ''),
            nextRenewalWindow: toString(seed.nextRenewalWindow, ''),
            updatedAt: toString(seed.updatedAt, new Date().toISOString()),
            checklist:
                seed.checklist && typeof seed.checklist === 'object'
                    ? seed.checklist
                    : defaultChecklistForSurface(surfaceKey),
        };
    });
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

function buildSurfacePack(seed, ledgerRows = [], ownerRows = []) {
    const surfaceKey = toString(seed.surfaceKey, 'surface');
    const ledger = ledgerRows.filter((entry) => entry.surfaceKey === surfaceKey);
    const owners = ownerRows.filter((entry) => entry.surfaceKey === surfaceKey);
    return buildTurneroSurfaceRenewalPack({
        ...seed,
        ledger,
        owners,
    });
}

function buildAggregateSnapshot(input, surfacePacks = [], metrics = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const renewalOwner = toString(
        input.renewalOwner,
        surfacePacks.find((pack) => toString(pack.readout?.renewalOwner, ''))
            ?.readout?.renewalOwner || 'renewal-lead'
    );
    const commercialOwner = toString(
        input.commercialOwner,
        surfacePacks.find((pack) => toString(pack.readout?.commercialOwner, ''))
            ?.readout?.commercialOwner || ''
    );
    const successOwner = toString(
        input.successOwner,
        surfacePacks.find((pack) => toString(pack.readout?.successOwner, ''))
            ?.readout?.successOwner || ''
    );
    const nextRenewalWindow = toString(
        input.nextRenewalWindow,
        surfacePacks.find((pack) => toString(pack.readout?.nextRenewalWindow, ''))
            ?.readout?.nextRenewalWindow || 'mensual'
    );

    return buildTurneroSurfaceRenewalSnapshot({
        scope: toString(
            input.scope ||
                clinicProfile.region ||
                clinicProfile.branding?.city ||
                'regional',
            'regional'
        ),
        surfaceKey: 'regional-renewal',
        surfaceLabel: 'Renewal Retention',
        clinicProfile,
        runtimeState: metrics.blockedCount > 0 ? 'watch' : 'ready',
        truth:
            metrics.blockedCount > 0 || metrics.degradedCount > 0
                ? 'watch'
                : 'aligned',
        renewalValueBand:
            metrics.highValueCount >= metrics.totalSurfaces &&
            metrics.totalSurfaces > 0
                ? 'high'
                : metrics.highValueCount > 0
                  ? 'medium'
                  : 'low',
        retentionSignal:
            metrics.blockedCount > 0
                ? 'at-risk'
                : metrics.degradedCount > 0 || metrics.watchCount > 0
                  ? 'fragile'
                  : 'stable',
        feedbackState:
            metrics.blockedCount > 0
                ? 'bad'
                : metrics.degradedCount > 0 || metrics.watchCount > 0
                  ? 'mixed'
                  : 'good',
        activityState:
            metrics.readyCount >= metrics.totalSurfaces && metrics.totalSurfaces > 0
                ? 'active'
                : 'watch',
        pendingCorrections: metrics.correctionsPending || 0,
        renewalOwner,
        commercialOwner,
        successOwner,
        nextRenewalWindow,
        updatedAt: new Date().toISOString(),
    });
}

function buildConsoleState(input = {}, ledgerRows = [], ownerRows = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const snapshots = resolveSnapshotSeeds(input, clinicProfile);
    const ledger = Array.isArray(ledgerRows) ? ledgerRows.filter(Boolean) : [];
    const owners = Array.isArray(ownerRows) ? ownerRows.filter(Boolean) : [];
    const surfacePacks = snapshots.map((seed) =>
        buildSurfacePack(seed, ledger, owners)
    );
    const checklist = resolveChecklist(input, surfacePacks);
    const metrics = surfacePacks.reduce(
        (accumulator, pack) => {
            const band = toString(pack.gate?.band, 'watch');
            accumulator.totalSurfaces += 1;
            accumulator.highValueCount +=
                toString(pack.readout?.renewalValueBand, 'medium') === 'high' ? 1 : 0;
            accumulator.correctionsPending +=
                Number(pack.readout?.pendingCorrections || 0) || 0;
            accumulator.evidence += pack.ledger.length;
            accumulator.owners += pack.owners.length;
            accumulator.checklistAll += Number(pack.checklist?.summary?.all || 0) || 0;
            accumulator.checklistPass +=
                Number(pack.checklist?.summary?.pass || 0) || 0;
            if (band === 'ready') accumulator.readyCount += 1;
            else if (band === 'watch') accumulator.watchCount += 1;
            else if (band === 'blocked') accumulator.blockedCount += 1;
            else accumulator.degradedCount += 1;
            return accumulator;
        },
        {
            totalSurfaces: 0,
            readyCount: 0,
            watchCount: 0,
            degradedCount: 0,
            blockedCount: 0,
            highValueCount: 0,
            correctionsPending: 0,
            evidence: 0,
            owners: 0,
            checklistAll: 0,
            checklistPass: 0,
        }
    );
    const aggregateSnapshot = buildAggregateSnapshot(input, surfacePacks, metrics);
    const bannerPack = buildTurneroSurfaceRenewalPack({
        ...aggregateSnapshot,
        checklist: { summary: checklist },
        ledger,
        owners,
    });
    const clinicLabel =
        getTurneroClinicBrandName(clinicProfile) ||
        getTurneroClinicShortName(clinicProfile) ||
        '';
    const brief = [
        '# Surface Renewal Retention',
        `Scope: ${toString(input.scope || aggregateSnapshot.scope, 'regional')}`,
        `Clinic: ${toString(clinicLabel || clinicProfile.clinic_id, 'sin-clinica')}`,
        `Gate: ${Number(bannerPack.gate.score || 0) || 0} · ${toString(
            bannerPack.gate.band,
            'watch'
        )} · ${toString(
            bannerPack.gate.decision,
            'review-renewal-readiness'
        )}`,
        '',
        ...surfacePacks.map(
            (card) =>
                `- ${toString(card.readout.surfaceLabel, card.snapshot.surfaceKey)}: value ${toString(card.readout.renewalValueBand, 'medium')} · retention ${toString(card.readout.retentionSignal, 'stable')} · feedback ${toString(card.readout.feedbackState, 'good')} · corrections ${Number(card.readout.pendingCorrections || 0) || 0} · owner ${toString(card.readout.renewalOwner, 'sin owner') || 'sin owner'}`
        ),
        '',
        `Evidence items: ${ledger.length}`,
        `Owners: ${owners.length}`,
        `Checklist: ${checklist.pass}/${checklist.all} pass`,
    ].join('\n');

    return {
        scope: toString(input.scope, aggregateSnapshot.scope || 'regional'),
        clinicProfile,
        clinicLabel,
        snapshots,
        surfacePacks,
        ledger,
        owners,
        checklist,
        pack: bannerPack,
        gate: bannerPack.gate,
        readout: bannerPack.readout,
        metrics,
        brief,
        generatedAt: bannerPack.generatedAt,
    };
}

function buildDownloadPayload(state) {
    return {
        scope: state.scope,
        clinicProfile: state.clinicProfile,
        clinicLabel: state.clinicLabel,
        snapshots: state.snapshots,
        surfacePacks: state.surfacePacks,
        pack: state.pack,
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
        <article class="turnero-admin-queue-surface-renewal-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-renewal-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderSurfaceCard(card = {}) {
    return `
        <article class="turnero-admin-queue-surface-renewal-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(toString(card.gate?.band, 'watch'))}">
            <div class="turnero-admin-queue-surface-renewal-console__surface-header">
                <div class="turnero-admin-queue-surface-renewal-console__surface-title">
                    <strong>${escapeHtml(toString(card.readout?.surfaceLabel, card.surfaceKey))}</strong>
                    <p>${escapeHtml(toString(card.readout?.surfaceKey, card.surfaceKey))}</p>
                </div>
                <span class="turnero-admin-queue-surface-renewal-console__surface-badge">${escapeHtml(`${toString(card.readout?.gateBand, 'watch')} · ${Number(card.readout?.gateScore || 0)}`)}</span>
            </div>
            <p class="turnero-admin-queue-surface-renewal-console__surface-summary">${escapeHtml(`value ${toString(card.readout?.renewalValueBand, 'medium')} · retention ${toString(card.readout?.retentionSignal, 'stable')} · feedback ${toString(card.readout?.feedbackState, 'good')}`)}</p>
            <p class="turnero-admin-queue-surface-renewal-console__entry-meta">${escapeHtml(`Owner ${toString(card.readout?.renewalOwner, 'sin owner') || 'sin owner'} · Commercial ${toString(card.readout?.commercialOwner, 'sin owner') || 'sin owner'} · Success ${toString(card.readout?.successOwner, 'sin owner') || 'sin owner'}`)}</p>
            <p class="turnero-admin-queue-surface-renewal-console__entry-meta">${escapeHtml(`Corrections ${Number(card.readout?.pendingCorrections || 0) || 0} · Window ${toString(card.readout?.nextRenewalWindow, 'sin ventana') || 'sin ventana'} · Ledger ${card.ledger.length} · Owners ${card.owners.length}`)}</p>
            <div class="turnero-admin-queue-surface-renewal-console__surface-chip-row">
                <span data-role="value-chip"></span>
                <span data-role="renewal-chip"></span>
                <span data-role="score-chip"></span>
            </div>
        </article>
    `;
}

function renderEntry(entry, kind) {
    const meta =
        kind === 'ledger'
            ? `${toString(entry.owner, 'renewal')} · ${toString(entry.kind, 'renewal-note')} · ${toString(entry.signal, 'renewal')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'renewal')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;
    return `
        <article class="turnero-admin-queue-surface-renewal-console__entry" data-state="${escapeHtml(toString(entry.status, 'ready'))}">
            <div class="turnero-admin-queue-surface-renewal-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.kind || entry.role, 'entry')} · status ${toString(entry.status, 'ready')}`)}</strong>
                <span class="turnero-admin-queue-surface-renewal-console__surface-badge">${escapeHtml(toString(entry.status, 'ready'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-renewal-console__entry-meta">${escapeHtml(meta)}</p>
            ${entry.note ? `<p class="turnero-admin-queue-surface-renewal-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-renewal-console__list">${entries.map((entry) => renderEntry(entry, kind)).join('')}</div>`
        : '<p class="turnero-admin-queue-surface-renewal-console__empty">Sin entradas todavía.</p>';
}

function renderConsoleHtml(state) {
    return `
        <section class="turnero-admin-queue-surface-renewal-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-renewal-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-renewal-console__eyebrow">Turnero renewal</p>
                    <h3>Surface Renewal Retention Console</h3>
                    <p class="turnero-admin-queue-surface-renewal-console__summary">Seguimiento de valor renovable, retencion, owners y correcciones por surface.</p>
                </div>
                <div class="turnero-admin-queue-surface-renewal-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-renewal-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-renewal-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-renewal-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" aria-live="polite"></div>
            <div class="turnero-admin-queue-surface-renewal-console__metrics">
                ${renderMetric('Surfaces', String(state.metrics.totalSurfaces), `${state.metrics.readyCount} ready / ${state.metrics.watchCount} watch / ${state.metrics.blockedCount} blocked`)}
                ${renderMetric('High value', String(state.metrics.highValueCount), `${state.metrics.correctionsPending} corrections pending`)}
                ${renderMetric('Evidence', String(state.metrics.evidence), `${state.metrics.checklistPass}/${state.metrics.checklistAll} checklist pass`)}
                ${renderMetric('Renewal gate', `${Number(state.gate.score || 0)} · ${state.gate.band}`, state.gate.decision)}
            </div>
            <div class="turnero-admin-queue-surface-renewal-console__surface-grid">${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}</div>
            <section class="turnero-admin-queue-surface-renewal-console__section">
                <div class="turnero-admin-queue-surface-renewal-console__section-header">
                    <div>
                        <h4>Evidence</h4>
                        <p>Notas de valor, retencion, feedback o correcciones por surface.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-renewal-console__button" data-action="clear-ledger">Clear evidence</button>
                </div>
                <form class="turnero-admin-queue-surface-renewal-console__form" data-action="add-ledger">
                    <label>Surface key <input data-field="ledger-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Kind <input data-field="ledger-kind" type="text" value="renewal-note" /></label>
                    <label>Status <input data-field="ledger-status" type="text" value="ready" /></label>
                    <label>Signal <input data-field="ledger-signal" type="text" value="renewal" /></label>
                    <label>Owner <input data-field="ledger-owner" type="text" value="renewal" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="ledger-note">Renewal note</textarea></label>
                    <div class="turnero-admin-queue-surface-renewal-console__form-actions" style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-renewal-console__button" data-tone="primary">Add evidence</button></div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
            </section>
            <section class="turnero-admin-queue-surface-renewal-console__section">
                <div class="turnero-admin-queue-surface-renewal-console__section-header">
                    <div>
                        <h4>Owners</h4>
                        <p>Responsables renewal, commercial y success por surface.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-renewal-console__button" data-action="clear-owners">Clear owners</button>
                </div>
                <form class="turnero-admin-queue-surface-renewal-console__form" data-action="add-owner">
                    <label>Surface key <input data-field="owner-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Actor <input data-field="owner-actor" type="text" value="owner" /></label>
                    <label>Role <input data-field="owner-role" type="text" value="renewal" /></label>
                    <label>Status <input data-field="owner-status" type="text" value="active" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="owner-note">Owner note</textarea></label>
                    <div class="turnero-admin-queue-surface-renewal-console__form-actions" style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-renewal-console__button" data-tone="primary">Add owner</button></div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-renewal-console__brief">${escapeHtml(state.brief)}</pre>
        </section>
    `;
}

function renderChips(root, state) {
    state.surfacePacks.forEach((card) => {
        const cardHost = root.querySelector(
            `[data-surface-key="${card.surfaceKey}"]`
        );
        if (!(cardHost instanceof HTMLElement)) return;
        const valueChip = cardHost.querySelector('[data-role="value-chip"]');
        const renewalChip = cardHost.querySelector('[data-role="renewal-chip"]');
        const scoreChip = cardHost.querySelector('[data-role="score-chip"]');

        if (valueChip instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(valueChip, {
                label: 'value',
                value: toString(card.readout?.renewalValueBand, 'medium'),
                state:
                    toString(card.readout?.renewalValueBand, 'medium') === 'high'
                        ? 'ready'
                        : toString(card.readout?.renewalValueBand, 'medium') ===
                            'medium'
                          ? 'warning'
                          : 'alert',
            });
        }
        if (renewalChip instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(renewalChip, {
                label: 'renewal',
                value: toString(card.readout?.gateBand, 'watch'),
                state:
                    toString(card.readout?.gateBand, 'watch') === 'ready'
                        ? 'ready'
                        : toString(card.readout?.gateBand, 'watch') === 'watch'
                          ? 'warning'
                          : 'alert',
            });
        }
        if (scoreChip instanceof HTMLElement) {
            mountTurneroSurfaceCheckpointChip(scoreChip, {
                label: 'score',
                value: String(Number(card.readout?.gateScore || 0) || 0),
                state:
                    toString(card.readout?.gateBand, 'watch') === 'ready'
                        ? 'ready'
                        : toString(card.readout?.gateBand, 'watch') === 'watch'
                          ? 'warning'
                          : 'alert',
            });
        }
    });
}

function syncState(controller, input, ledgerStore, ownerStore) {
    controller.state = buildConsoleState(
        input,
        ledgerStore.list(),
        ownerStore.list()
    );
    controller.root.dataset.state = controller.state.gate.band;
    controller.root.innerHTML = renderConsoleHtml(controller.state);

    const bannerHost = controller.root.querySelector('[data-role="banner"]');
    if (bannerHost instanceof HTMLElement) {
        mountTurneroSurfaceRenewalBanner(bannerHost, {
            pack: controller.state.pack,
            readout: controller.state.readout,
            title: 'Surface Renewal Retention Console',
            eyebrow: 'Turnero renewal',
        });
    }

    const briefHost = controller.root.querySelector('[data-role="brief"]');
    if (briefHost instanceof HTMLElement) {
        briefHost.textContent = controller.state.brief;
    }

    renderChips(controller.root, controller.state);
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
                : null;
        if (!(actionTarget instanceof HTMLElement) || !controller.state) {
            return;
        }

        const action = toString(actionTarget.dataset.action, '');
        if (!action) {
            return;
        }

        if (action === 'copy-brief') {
            await copyTextToClipboard(controller.state.brief);
            return;
        }
        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-surface-renewal-console.json',
                buildDownloadPayload(controller.state)
            );
            return;
        }
        if (action === 'clear-ledger') {
            ledgerStore.clear();
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }
        if (action === 'clear-owners') {
            ownerStore.clear();
            syncState(controller, input, ledgerStore, ownerStore);
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
                : null;
        if (!(formTarget instanceof HTMLElement) || !controller.state) {
            return;
        }

        const action = toString(formTarget.dataset.action, '');
        if (!action) {
            return;
        }

        event.preventDefault();

        if (action === 'add-ledger') {
            ledgerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="ledger-surface-key"]',
                    controller.state.snapshots[0]?.surfaceKey || 'surface'
                ),
                kind: readValue(
                    formTarget,
                    '[data-field="ledger-kind"]',
                    'renewal-note'
                ),
                status: readValue(
                    formTarget,
                    '[data-field="ledger-status"]',
                    'ready'
                ),
                signal: readValue(
                    formTarget,
                    '[data-field="ledger-signal"]',
                    'renewal'
                ),
                owner: readValue(
                    formTarget,
                    '[data-field="ledger-owner"]',
                    'renewal'
                ),
                note: readValue(formTarget, '[data-field="ledger-note"]', ''),
            });
            resetValue(formTarget, '[data-field="ledger-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
            return;
        }

        if (action === 'add-owner') {
            ownerStore.add({
                surfaceKey: readValue(
                    formTarget,
                    '[data-field="owner-surface-key"]',
                    controller.state.snapshots[0]?.surfaceKey || 'surface'
                ),
                actor: readValue(
                    formTarget,
                    '[data-field="owner-actor"]',
                    'owner'
                ),
                role: readValue(
                    formTarget,
                    '[data-field="owner-role"]',
                    'renewal'
                ),
                status: readValue(
                    formTarget,
                    '[data-field="owner-status"]',
                    'active'
                ),
                note: readValue(formTarget, '[data-field="owner-note"]', ''),
            });
            resetValue(formTarget, '[data-field="owner-note"]', '');
            syncState(controller, input, ledgerStore, ownerStore);
        }
    };

    controller.refresh = () =>
        syncState(controller, input, ledgerStore, ownerStore);
    controller.destroy = () => {
        controller.root.removeEventListener('click', onClick);
        controller.root.removeEventListener('submit', onSubmit);
    };

    controller.root.addEventListener('click', onClick);
    controller.root.addEventListener('submit', onSubmit);
    return controller;
}

export function buildTurneroAdminQueueSurfaceRenewalConsoleHtml(input = {}) {
    const scope = toString(input.scope, 'regional') || 'regional';
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceRenewalLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceRenewalOwnerStore(
        scope,
        clinicProfile
    );
    const state = buildConsoleState(
        input,
        Array.isArray(input.ledger) ? input.ledger : ledgerStore.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    return renderConsoleHtml(state);
}

export function mountTurneroAdminQueueSurfaceRenewalConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();

    const scope = toString(input.scope, 'regional') || 'regional';
    const clinicProfile = asObject(input.clinicProfile);
    const ledgerStore = createTurneroSurfaceRenewalLedger(scope, clinicProfile);
    const ownerStore = createTurneroSurfaceRenewalOwnerStore(
        scope,
        clinicProfile
    );
    const controller = buildController(input, ledgerStore, ownerStore);
    controller.root.className = 'turnero-admin-queue-surface-renewal-console';
    host.replaceChildren(controller.root);
    controller.refresh();
    return controller;
}
