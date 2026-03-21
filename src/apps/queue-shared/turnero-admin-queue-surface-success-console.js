import { getTurneroClinicBrandName, getTurneroClinicShortName } from './clinic-profile.js';
import { createTurneroSurfaceSuccessLedger } from './turnero-surface-success-ledger.js';
import { createTurneroSurfaceSuccessOwnerStore } from './turnero-surface-success-owner-store.js';
import { buildTurneroSurfaceSuccessPack } from './turnero-surface-success-pack.js';
import { buildTurneroSurfaceSuccessSnapshot } from './turnero-surface-success-snapshot.js';
import { mountTurneroSurfaceSuccessBanner } from './turnero-surface-success-banner.js';
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

const STYLE_ID = 'turneroAdminQueueSurfaceSuccessConsoleInlineStyles';

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
        .turnero-admin-queue-surface-success-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-success-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-queue-surface-success-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-success-console__eyebrow,.turnero-admin-queue-surface-success-console__summary,.turnero-admin-queue-surface-success-console__section h4,.turnero-admin-queue-surface-success-console__section p{margin:0}
        .turnero-admin-queue-surface-success-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-success-console__actions,.turnero-admin-queue-surface-success-console__form-actions,.turnero-admin-queue-surface-success-console__section-header,.turnero-admin-queue-surface-success-console__summary-chips{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-success-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-success-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-success-console__banner-host{min-height:1px}
        .turnero-admin-queue-surface-success-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-success-console__metric{display:grid;gap:.2rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-success-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-success-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-success-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-success-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-success-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-success-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-success-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-success-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-success-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-success-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-success-console__surface-title p,.turnero-admin-queue-surface-success-console__entry-meta{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-success-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-success-console__surface-summary,.turnero-admin-queue-surface-success-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-success-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-success-console__section{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-success-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-success-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-success-console__form input,.turnero-admin-queue-surface-success-console__form select,.turnero-admin-queue-surface-success-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-success-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-success-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-success-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-success-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-success-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-success-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-success-console__header,.turnero-admin-queue-surface-success-console__surface-header,.turnero-admin-queue-surface-success-console__entry-head{flex-direction:column}}
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
        return toString(clinicProfile?.surfaces?.kiosk?.label, 'Turnero Kiosco');
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
                  adoptionState: 'watch',
                  incidentRateBand: 'low',
                  feedbackState: 'good',
                  successOwner: 'ops-lead',
                  followupWindow: 'mensual',
                  checklist: defaultChecklistForSurface('operator-turnos'),
              },
              {
                  surfaceKey: 'kiosco-turnos',
                  label: getSurfaceLabel('kiosco-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  adoptionState: 'watch',
                  incidentRateBand: 'medium',
                  feedbackState: 'mixed',
                  successOwner: '',
                  followupWindow: '',
                  checklist: defaultChecklistForSurface('kiosco-turnos'),
              },
              {
                  surfaceKey: 'sala-turnos',
                  label: getSurfaceLabel('sala-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'aligned',
                  adoptionState: 'ready',
                  incidentRateBand: 'low',
                  feedbackState: 'good',
                  successOwner: 'ops-display',
                  followupWindow: 'mensual',
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
            truth: toString(
                seed.truth,
                surfaceKey === 'sala-turnos' ? 'aligned' : 'watch'
            ),
            adoptionState: toString(
                seed.adoptionState,
                surfaceKey === 'sala-turnos' ? 'ready' : 'watch'
            ),
            incidentRateBand: toString(
                seed.incidentRateBand,
                surfaceKey === 'kiosco-turnos' ? 'medium' : 'low'
            ),
            feedbackState: toString(
                seed.feedbackState,
                surfaceKey === 'kiosco-turnos' ? 'mixed' : 'good'
            ),
            successOwner: toString(
                seed.successOwner,
                surfaceKey === 'kiosco-turnos'
                    ? ''
                    : surfaceKey === 'sala-turnos'
                      ? 'ops-display'
                      : 'ops-lead'
            ),
            followupWindow: toString(
                seed.followupWindow,
                surfaceKey === 'kiosco-turnos' ? '' : 'mensual'
            ),
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
    return buildTurneroSurfaceSuccessPack({
        ...seed,
        ledger,
        owners,
    });
}

function buildAggregateSnapshot(input, state) {
    const clinicProfile = asObject(input.clinicProfile);
    const ownerSeed =
        state.surfacePacks.find((pack) => toString(pack.readout?.successOwner, '')) ||
        null;
    const successOwner = toString(
        input.successOwner,
        toString(
            ownerSeed?.readout?.successOwner ||
                ownerSeed?.snapshot?.successOwner,
            'success-lead'
        )
    );
    const followupWindow = toString(
        input.followupWindow,
        toString(
            state.surfacePacks.find((pack) =>
                toString(pack.readout?.followupWindow, '')
            )?.readout?.followupWindow,
            'mensual'
        )
    );
    const adoptionState =
        state.metrics.ready >= state.metrics.total && state.metrics.total > 0
            ? 'ready'
            : state.metrics.ready > 0
              ? 'watch'
              : 'draft';
    const incidentRateBand =
        state.metrics.blocked > 0
            ? 'high'
            : state.metrics.degraded > 0
              ? 'medium'
              : 'low';
    const feedbackState =
        state.metrics.blocked > 0
            ? 'mixed'
            : state.metrics.ready >= state.metrics.total && state.metrics.total > 0
              ? 'good'
              : 'mixed';
    const runtimeState =
        state.metrics.blocked > 0
            ? 'watch'
            : state.metrics.ready >= state.metrics.total && state.metrics.total > 0
              ? 'ready'
              : 'watch';
    const truth =
        state.metrics.ready >= state.metrics.total && state.metrics.total > 0
            ? 'aligned'
            : 'watch';

    return buildTurneroSurfaceSuccessSnapshot({
        scope: toString(
            input.scope ||
                clinicProfile.region ||
                clinicProfile.branding?.city ||
                'regional',
            'regional'
        ),
        surfaceKey: 'regional-success',
        surfaceLabel: 'Customer Success',
        clinicProfile,
        runtimeState,
        truth,
        adoptionState,
        incidentRateBand,
        feedbackState,
        successOwner,
        followupWindow,
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
    const metrics = {
        total: surfacePacks.length,
        ready: 0,
        watch: 0,
        degraded: 0,
        blocked: 0,
        score: 0,
        adoptionReady: 0,
        lowIncidents: 0,
        goodFeedback: 0,
        evidence: ledger.length,
        owners: owners.length,
        checklistPass: Number(checklist.pass || 0) || 0,
        checklistTotal: Number(checklist.all || 0) || 0,
        checklistFail: Number(checklist.fail || 0) || 0,
    };

    surfacePacks.forEach((pack) => {
        const band = toString(pack.gate?.band, 'watch');
        if (band in metrics) {
            metrics[band] += 1;
        }
        metrics.score += Number(pack.readout?.gateScore || pack.gate?.score || 0) || 0;
        if (toString(pack.readout?.adoptionState, 'watch') === 'ready') {
            metrics.adoptionReady += 1;
        }
        if (toString(pack.readout?.incidentRateBand, 'low') === 'low') {
            metrics.lowIncidents += 1;
        }
        if (toString(pack.readout?.feedbackState, 'good') === 'good') {
            metrics.goodFeedback += 1;
        }
    });

    metrics.score = surfacePacks.length
        ? Math.round(metrics.score / surfacePacks.length)
        : 0;

    const aggregateSnapshot = buildAggregateSnapshot(input, {
        surfacePacks,
        metrics,
    });
    const bannerPack = buildTurneroSurfaceSuccessPack({
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
        '# Surface Customer Success',
        `Scope: ${toString(input.scope || aggregateSnapshot.scope, 'regional')}`,
        `Clinic: ${toString(clinicLabel || clinicProfile.clinic_id, 'sin-clinica')}`,
        `Gate: ${Number(bannerPack.gate.score || 0) || 0} · ${toString(bannerPack.gate.band, 'watch')} · ${toString(bannerPack.gate.decision, 'review-success-readiness')}`,
        '',
        ...surfacePacks.map(
            (card) =>
                `- ${toString(card.readout.surfaceLabel, card.snapshot.surfaceKey)}: ${toString(card.readout.adoptionState, 'watch')} · ${toString(card.readout.incidentRateBand, 'low')} · ${toString(card.readout.feedbackState, 'good')} · owner ${toString(card.readout.successOwner, 'sin owner') || 'sin owner'} · follow-up ${toString(card.readout.followupWindow, 'sin ventana') || 'sin ventana'}`
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
        bannerPack,
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
        <article class="turnero-admin-queue-surface-success-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-success-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function chipClass(value, kind = 'band') {
    const normalized = toString(value, 'watch').toLowerCase();
    if (kind === 'adoption') {
        return normalized === 'ready'
            ? 'ready'
            : normalized === 'watch' || normalized === 'draft'
              ? 'warning'
              : 'alert';
    }

    return normalized === 'ready' || normalized === 'low' || normalized === 'good'
        ? 'ready'
        : normalized === 'watch' || normalized === 'mixed' || normalized === 'medium'
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
            ? `${toString(entry.owner, 'success')} · ${toString(entry.kind, 'followup-note')} · ${toString(entry.signal, 'value')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'success')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;
    return `
        <article class="turnero-admin-queue-surface-success-console__entry" data-state="${escapeHtml(toString(entry.status, 'ready'))}">
            <div class="turnero-admin-queue-surface-success-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.kind || entry.role, 'entry')} · status ${toString(entry.status, 'ready')}`)}</strong>
                <span class="turnero-admin-queue-surface-success-console__surface-badge">${escapeHtml(toString(entry.status, 'ready'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-success-console__entry-meta">${escapeHtml(meta)}</p>
            ${entry.note ? `<p class="turnero-admin-queue-surface-success-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-success-console__list">${entries.map((entry) => renderEntry(entry, kind)).join('')}</div>`
        : '<p class="turnero-admin-queue-surface-success-console__empty">Sin entradas todavía.</p>';
}

function renderSurfaceCardHtml(card = {}) {
    const snapshot = asObject(card.snapshot);
    const readout = asObject(card.readout);
    const gate = asObject(card.gate);
    const checklist = normalizeChecklistSummary(card.checklist);

    return `
        <article
            class="turnero-admin-queue-surface-success-console__surface"
            data-surface-key="${escapeHtml(card.surfaceKey)}"
            data-state="${escapeHtml(toString(gate.band, 'watch'))}"
        >
            <div class="turnero-admin-queue-surface-success-console__surface-header">
                <div class="turnero-admin-queue-surface-success-console__surface-title">
                    <strong>${escapeHtml(card.label)}</strong>
                    <p>${escapeHtml(readout.surfaceKey)}</p>
                </div>
                <span class="turnero-admin-queue-surface-success-console__surface-badge">${escapeHtml(`${toString(readout.gateBand, 'watch')} · ${Number(readout.gateScore || 0)}`)}</span>
            </div>
            <p class="turnero-admin-queue-surface-success-console__surface-summary">${escapeHtml(`${toString(readout.adoptionState, 'watch')} · incidents ${toString(readout.incidentRateBand, 'low')} · feedback ${toString(readout.feedbackState, 'good')}`)}</p>
            <p class="turnero-admin-queue-surface-success-console__entry-meta">${escapeHtml(`Owner ${toString(readout.successOwner, 'sin owner') || 'sin owner'} · Follow-up ${toString(readout.followupWindow, 'sin ventana') || 'sin ventana'} · Checklist ${checklist.pass}/${checklist.all} · Ledger ${card.ledger.length} · Owners ${card.owners.length}`)}</p>
            <p class="turnero-admin-queue-surface-success-console__entry-meta">${escapeHtml(`Runtime ${toString(snapshot.runtimeState, 'unknown')} · Truth ${toString(snapshot.truth, 'unknown')} · Decision ${toString(readout.gateDecision, 'review-success-readiness')}`)}</p>
            <div class="turnero-admin-queue-surface-success-console__surface-chip-row">
                ${chipHtml('adoption', readout.adoptionState, chipClass(readout.adoptionState, 'adoption'))}
                ${chipHtml('success', readout.gateBand, chipClass(readout.gateBand))}
                ${chipHtml('score', String(Number(readout.gateScore || 0)), chipClass(readout.gateBand))}
            </div>
        </article>
    `;
}

function renderConsoleHtml(state) {
    return `
        <section class="turnero-surface-ops-console turnero-admin-queue-surface-success-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-success-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-success-console__eyebrow">Turnero customer success</p>
                    <h3>Surface Customer Success Console</h3>
                    <p class="turnero-admin-queue-surface-success-console__summary">Evidence minima, owners y gate de continuidad por surface.</p>
                </div>
                <div class="turnero-admin-queue-surface-success-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-success-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-success-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-success-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-success-console__banner-host" aria-live="polite"></div>
            <div class="turnero-admin-queue-surface-success-console__summary-chips">
                ${chipHtml('adoption', state.readout.adoptionState, chipClass(state.readout.adoptionState, 'adoption'))}
                ${chipHtml('success', state.gate.band, chipClass(state.gate.band))}
                ${chipHtml('score', String(Number(state.readout.gateScore || 0)), chipClass(state.gate.band))}
            </div>
            <div class="turnero-admin-queue-surface-success-console__metrics">
                ${renderMetric('Surfaces', String(state.metrics.total), `${state.metrics.ready} ready / ${state.metrics.watch} watch / ${state.metrics.blocked} blocked`)}
                ${renderMetric('Evidence', String(state.metrics.evidence), `${state.metrics.checklistPass}/${state.metrics.checklistTotal} checklist pass`)}
                ${renderMetric('Owners', String(state.metrics.owners), `${state.metrics.adoptionReady} adoption-ready / ${state.metrics.lowIncidents} low incidents`)}
                ${renderMetric('Success gate', `${Number(state.gate.score || 0)} · ${state.gate.band}`, state.gate.decision)}
            </div>
            <div class="turnero-admin-queue-surface-success-console__surface-grid">${state.surfacePacks.map((card) => renderSurfaceCardHtml(card)).join('')}</div>
            <section class="turnero-admin-queue-surface-success-console__section">
                <div class="turnero-admin-queue-surface-success-console__section-header">
                    <div>
                        <h4>Evidence</h4>
                        <p>Notas de adopcion, incidentes, valor percibido y follow-up continuo.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-success-console__button" data-action="clear-ledger">Clear evidence</button>
                </div>
                <form class="turnero-admin-queue-surface-success-console__form" data-action="add-evidence">
                    <label>Surface key <input data-field="evidence-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Kind <select data-field="evidence-kind"><option value="adoption">adoption</option><option value="incident">incident</option><option value="value">value</option><option value="followup" selected>followup</option><option value="feedback">feedback</option></select></label>
                    <label>Status <select data-field="evidence-status"><option value="ready">ready</option><option value="watch">watch</option><option value="degraded">degraded</option><option value="blocked">blocked</option><option value="done">done</option><option value="closed">closed</option></select></label>
                    <label>Signal <select data-field="evidence-signal"><option value="value" selected>value</option><option value="adoption">adoption</option><option value="incident">incident</option><option value="feedback">feedback</option><option value="followup">followup</option></select></label>
                    <label>Owner <input data-field="evidence-owner" type="text" value="success" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="evidence-note">Customer success note</textarea></label>
                    <div class="turnero-admin-queue-surface-success-console__form-actions" style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-success-console__button" data-tone="primary">Add evidence</button></div>
                </form>
                ${renderEntryList(state.ledger, 'ledger')}
            </section>
            <section class="turnero-admin-queue-surface-success-console__section">
                <div class="turnero-admin-queue-surface-success-console__section-header">
                    <div>
                        <h4>Owners</h4>
                        <p>Responsables de seguimiento continuo por surface.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-success-console__button" data-action="clear-owners">Clear owners</button>
                </div>
                <form class="turnero-admin-queue-surface-success-console__form" data-action="add-owner">
                    <label>Surface key <input data-field="owner-surface-key" type="text" value="${escapeHtml(state.snapshots[0]?.surfaceKey || 'operator-turnos')}" /></label>
                    <label>Actor <input data-field="owner-actor" type="text" value="owner" /></label>
                    <label>Role <input data-field="owner-role" type="text" value="success" /></label>
                    <label>Status <input data-field="owner-status" type="text" value="active" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="owner-note">Owner note</textarea></label>
                    <div class="turnero-admin-queue-surface-success-console__form-actions" style="grid-column:1 / -1;"><button type="submit" class="turnero-admin-queue-surface-success-console__button" data-tone="primary">Add owner</button></div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-success-console__brief">${escapeHtml(state.brief)}</pre>
        </section>
    `;
}
