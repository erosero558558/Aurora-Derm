import { buildTurneroSurfaceReplicationPack } from './turnero-surface-replication-pack.js';
import { mountTurneroSurfaceReplicationBanner } from './turnero-surface-replication-banner.js';
import { createTurneroSurfaceDeploymentTemplateLedger } from './turnero-surface-deployment-template-ledger.js';
import { createTurneroSurfaceReplicationOwnerStore } from './turnero-surface-replication-owner-store.js';
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

const STYLE_ID = 'turneroAdminQueueSurfaceReplicationConsoleInlineStyles';

function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
        return typeof document !== 'undefined';
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-admin-queue-surface-replication-console{display:grid;gap:.9rem}
        .turnero-admin-queue-surface-replication-console__header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.85rem;align-items:flex-start}
        .turnero-admin-queue-surface-replication-console__header h3{margin:0;font-family:'FrauncesSoft',serif;font-weight:500;letter-spacing:.01em}
        .turnero-admin-queue-surface-replication-console__eyebrow,.turnero-admin-queue-surface-replication-console__summary,.turnero-admin-queue-surface-replication-console__section h4,.turnero-admin-queue-surface-replication-console__section p{margin:0}
        .turnero-admin-queue-surface-replication-console__eyebrow{font-size:.76rem;text-transform:uppercase;letter-spacing:.12em;opacity:.68}
        .turnero-admin-queue-surface-replication-console__actions,.turnero-admin-queue-surface-replication-console__form-actions,.turnero-admin-queue-surface-replication-console__section-header{display:flex;flex-wrap:wrap;gap:.5rem}
        .turnero-admin-queue-surface-replication-console__button{min-height:38px;padding:.56rem .84rem;border-radius:999px;border:1px solid rgb(15 23 32 / 12%);background:rgb(255 255 255 / 88%);color:inherit;font:inherit;cursor:pointer}
        .turnero-admin-queue-surface-replication-console__button[data-tone='primary']{border-color:rgb(15 107 220 / 22%);background:rgb(15 107 220 / 10%);color:rgb(10 67 137)}
        .turnero-admin-queue-surface-replication-console__banner-host{min-height:1px}
        .turnero-admin-queue-surface-replication-console__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .turnero-admin-queue-surface-replication-console__metric{display:grid;gap:.2rem;padding:.78rem .88rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 80%)}
        .turnero-admin-queue-surface-replication-console__metric strong{font-size:1.02rem}
        .turnero-admin-queue-surface-replication-console__surface-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.75rem}
        .turnero-admin-queue-surface-replication-console__surface{display:grid;gap:.65rem;padding:.95rem 1rem;border-radius:22px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%)}
        .turnero-admin-queue-surface-replication-console__surface[data-state='ready']{border-color:rgb(22 163 74 / 20%)}
        .turnero-admin-queue-surface-replication-console__surface[data-state='watch']{border-color:rgb(180 83 9 / 18%)}
        .turnero-admin-queue-surface-replication-console__surface[data-state='degraded']{border-color:rgb(234 88 12 / 18%)}
        .turnero-admin-queue-surface-replication-console__surface[data-state='blocked']{border-color:rgb(190 24 93 / 18%)}
        .turnero-admin-queue-surface-replication-console__surface-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
        .turnero-admin-queue-surface-replication-console__surface-title{display:grid;gap:.15rem}
        .turnero-admin-queue-surface-replication-console__surface-title strong{font-size:.98rem}
        .turnero-admin-queue-surface-replication-console__surface-title p,.turnero-admin-queue-surface-replication-console__entry-meta{margin:0;font-size:.8rem;opacity:.82;line-height:1.45}
        .turnero-admin-queue-surface-replication-console__surface-badge{padding:.38rem .6rem;border-radius:999px;background:rgb(15 23 32 / 5%);font-size:.76rem;white-space:nowrap}
        .turnero-admin-queue-surface-replication-console__surface-summary,.turnero-admin-queue-surface-replication-console__entry-note{margin:0;font-size:.85rem;line-height:1.45}
        .turnero-admin-queue-surface-replication-console__surface-chip-row{display:flex;flex-wrap:wrap;gap:.45rem}
        .turnero-admin-queue-surface-replication-console__section{display:grid;gap:.55rem}
        .turnero-admin-queue-surface-replication-console__form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;padding:.8rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 72%)}
        .turnero-admin-queue-surface-replication-console__form label{display:grid;gap:.3rem;font-size:.78rem}
        .turnero-admin-queue-surface-replication-console__form input,.turnero-admin-queue-surface-replication-console__form select,.turnero-admin-queue-surface-replication-console__form textarea{min-height:38px;padding:.48rem .62rem;border-radius:12px;border:1px solid rgb(15 23 32 / 14%);background:rgb(255 255 255 / 96%);color:inherit;font:inherit}
        .turnero-admin-queue-surface-replication-console__form textarea{min-height:82px;resize:vertical}
        .turnero-admin-queue-surface-replication-console__list{display:grid;gap:.45rem}
        .turnero-admin-queue-surface-replication-console__entry{display:grid;gap:.22rem;padding:.72rem .8rem;border-radius:16px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 76%)}
        .turnero-admin-queue-surface-replication-console__entry-head{display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start}
        .turnero-admin-queue-surface-replication-console__empty{margin:0;font-size:.84rem;opacity:.72}
        .turnero-admin-queue-surface-replication-console__brief{margin:0;padding:.85rem .95rem;border-radius:18px;border:1px solid rgb(15 23 32 / 10%);background:rgb(255 255 255 / 82%);white-space:pre-wrap;font-size:.84rem;line-height:1.5}
        @media (max-width:760px){.turnero-admin-queue-surface-replication-console__header,.turnero-admin-queue-surface-replication-console__surface-header,.turnero-admin-queue-surface-replication-console__entry-head{flex-direction:column}}
    `;
    document.head.appendChild(styleEl);
    return true;
}

function getClinicLabel(clinicProfile = {}) {
    return toString(
        clinicProfile?.branding?.name || clinicProfile?.branding?.short_name,
        ''
    );
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
        return toString(clinicProfile?.surfaces?.display?.label, 'Turnero Sala TV');
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

function resolveSurfaceSeeds(input = {}, clinicProfile = null) {
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
                  templateState: 'ready',
                  assetProfile: 'mini-pc + printer',
                  replicationOwner: 'ops-lead',
                  installTimeBucket: 'half-day',
                  documentationState: 'ready',
              },
              {
                  surfaceKey: 'kiosco-turnos',
                  label: getSurfaceLabel('kiosco-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'watch',
                  templateState: 'draft',
                  assetProfile: 'kiosk + printer',
                  replicationOwner: '',
                  installTimeBucket: 'unknown',
                  documentationState: 'draft',
              },
              {
                  surfaceKey: 'sala-turnos',
                  label: getSurfaceLabel('sala-turnos', clinicProfile),
                  runtimeState: 'ready',
                  truth: 'aligned',
                  templateState: 'ready',
                  assetProfile: 'tv + audio',
                  replicationOwner: 'ops-display',
                  installTimeBucket: 'half-day',
                  documentationState: 'ready',
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
            scope: toString(seed.scope, ''),
            runtimeState: toString(seed.runtimeState, 'unknown'),
            truth: toString(seed.truth, 'unknown'),
            templateState: toString(seed.templateState, 'draft'),
            assetProfile: toString(seed.assetProfile, 'unknown'),
            replicationOwner: toString(seed.replicationOwner, ''),
            installTimeBucket: toString(seed.installTimeBucket, 'unknown'),
            documentationState: toString(seed.documentationState, 'draft'),
            updatedAt: toString(seed.updatedAt, new Date().toISOString()),
            checklist:
                seed.checklist && typeof seed.checklist === 'object'
                    ? seed.checklist
                    : defaultChecklistForSurface(surfaceKey),
        };
    });
}

function buildSurfacePack(seed, templates = [], owners = []) {
    const surfaceKey = toString(seed.surfaceKey, 'surface');
    return buildTurneroSurfaceReplicationPack({
        ...seed,
        surfaceKey,
        templates: templates.filter((entry) => entry.surfaceKey === surfaceKey),
        owners: owners.filter((entry) => entry.surfaceKey === surfaceKey),
    });
}

function buildChecklist(surfacePacks = []) {
    const checks = surfacePacks.flatMap((pack) => [
        {
            key: `${pack.surfaceKey}-template`,
            label: `${pack.label} template`,
            pass: pack.readout.templateState === 'ready',
        },
        {
            key: `${pack.surfaceKey}-replication`,
            label: `${pack.label} replication`,
            pass: pack.readout.gateBand !== 'blocked',
        },
        {
            key: `${pack.surfaceKey}-score`,
            label: `${pack.label} score`,
            pass: normalizeChecklistSummary(pack.checklist).pass >= 2,
        },
    ]);
    return {
        checks,
        summary: {
            all: checks.length,
            pass: checks.filter((item) => item.pass).length,
            fail: checks.filter((item) => !item.pass).length,
        },
    };
}

function buildBannerSnapshot(scope, clinicProfile, surfacePacks, checklist) {
    const readyTemplates = surfacePacks.filter(
        (pack) => pack.readout.templateState === 'ready'
    ).length;
    const mixedTemplates =
        readyTemplates > 0 && readyTemplates < surfacePacks.length;
    const firstOwner = surfacePacks.find((pack) =>
        toString(pack.readout.replicationOwner, '')
    )?.readout.replicationOwner;
    const installBuckets = Array.from(
        new Set(
            surfacePacks.map((pack) =>
                toString(pack.readout.installTimeBucket, 'unknown')
            )
        )
    );

    return {
        scope: toString(scope, 'global') || 'global',
        surfaceKey: 'surface-replication',
        surfaceLabel: 'Surface Replication Scaleout',
        clinicId: toString(
            clinicProfile?.clinic_id || clinicProfile?.clinicId,
            ''
        ),
        clinicLabel: getClinicLabel(clinicProfile),
        runtimeState: surfacePacks.some((pack) =>
            ['blocked', 'degraded'].includes(pack.gate.band)
        )
            ? 'degraded'
            : 'ready',
        truth: checklist.summary.fail > 0 ? 'watch' : 'aligned',
        templateState:
            readyTemplates === surfacePacks.length
                ? 'ready'
                : mixedTemplates
                  ? 'watch'
                  : 'draft',
        assetProfile: 'multi-surface cluster',
        replicationOwner: toString(firstOwner, ''),
        installTimeBucket:
            installBuckets.length === 1 ? installBuckets[0] : 'mixed',
        documentationState: checklist.summary.fail > 0 ? 'draft' : 'ready',
        updatedAt: new Date().toISOString(),
    };
}

function buildBrief(state) {
    const lines = [
        '# Surface Replication Scaleout',
        '',
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'global')}`,
        `Gate: ${toString(state.gate.band, 'blocked')} (${Number(
            state.gate.score || 0
        )})`,
        `Decision: ${toString(state.gate.decision, 'hold-scaleout')}`,
        '',
        '## Surfaces',
    ];

    state.surfacePacks.forEach((pack) => {
        lines.push(
            `- ${toString(pack.label, pack.surfaceKey)} · template ${pack.readout.templateState} · replication ${pack.readout.gateBand} · score ${Number(pack.readout.gateScore || 0)}`
        );
    });

    lines.push(
        '',
        '## Checklist',
        `- ${state.checklist.summary.pass}/${state.checklist.summary.all} pass`
    );
    lines.push('', '## Templates');
    if (state.templates.length === 0) {
        lines.push('- Sin templates registrados.');
    } else {
        state.templates.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.template, 'deployment-template')} · ${toString(entry.version, 'v1')} · ${toString(entry.note, '')}`
            );
        });
    }
    lines.push('', '## Owners');
    if (state.owners.length === 0) {
        lines.push('- Sin owners registrados.');
    } else {
        state.owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(entry.surfaceKey, 'surface')} · ${toString(entry.actor, 'owner')} · ${toString(entry.role, 'replication')} · ${toString(entry.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

function buildDownloadSnapshot(state) {
    return {
        scope: state.scope,
        clinicId: state.clinicId,
        clinicLabel: state.clinicLabel,
        generatedAt: state.generatedAt,
        checklist: state.checklist,
        gate: state.gate,
        bannerSnapshot: state.bannerSnapshot,
        surfacePacks: state.surfacePacks.map((pack) => ({
            surfaceKey: pack.surfaceKey,
            label: pack.label,
            snapshot: pack.snapshot,
            checklist: pack.checklist,
            gate: pack.gate,
            readout: pack.readout,
        })),
        templates: state.templates,
        owners: state.owners,
        brief: state.brief,
    };
}

function renderMetric(label, value, detail = '') {
    return `
        <article class="turnero-admin-queue-surface-replication-console__metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<span class="turnero-admin-queue-surface-replication-console__entry-meta">${escapeHtml(detail)}</span>` : ''}
        </article>
    `;
}

function renderSurfaceCard(card) {
    return `
        <article class="turnero-admin-queue-surface-replication-console__surface" data-surface-key="${escapeHtml(card.surfaceKey)}" data-state="${escapeHtml(card.readout.gateBand)}">
            <div class="turnero-admin-queue-surface-replication-console__surface-header">
                <div class="turnero-admin-queue-surface-replication-console__surface-title">
                    <strong>${escapeHtml(card.label)}</strong>
                    <p>${escapeHtml(card.readout.surfaceLabel || card.readout.surfaceKey)}</p>
                </div>
                <span class="turnero-admin-queue-surface-replication-console__surface-badge">${escapeHtml(`${card.readout.gateBand} · ${Number(card.readout.gateScore || 0)}`)}</span>
            </div>
            <p class="turnero-admin-queue-surface-replication-console__surface-summary">${escapeHtml(`${card.readout.runtimeState} · ${card.readout.truth} · ${card.readout.assetProfile}`)}</p>
            <p class="turnero-admin-queue-surface-replication-console__entry-meta">${escapeHtml(`Template ${card.readout.templateState} · owner ${toString(card.readout.replicationOwner, 'sin owner') || 'sin owner'} · install ${card.readout.installTimeBucket} · docs ${card.readout.documentationState}`)}</p>
            <p class="turnero-admin-queue-surface-replication-console__entry-meta">${escapeHtml(`Checklist ${card.checklist.summary.pass}/${card.checklist.summary.all} · Templates ${card.templates.length} · Owners ${card.owners.length} · Decision ${card.readout.gateDecision}`)}</p>
            <div class="turnero-admin-queue-surface-replication-console__surface-chip-row">
                <span data-role="template-chip"></span>
                <span data-role="replication-chip"></span>
                <span data-role="score-chip"></span>
            </div>
        </article>
    `;
}

function renderEntry(entry, kind) {
    const meta =
        kind === 'template'
            ? `${toString(entry.owner, 'ops')} · ${toString(entry.version, 'v1')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`
            : `${toString(entry.actor, 'owner')} · ${toString(entry.role, 'replication')} · ${formatTimestamp(entry.updatedAt || entry.createdAt)}`;
    return `
        <article class="turnero-admin-queue-surface-replication-console__entry" data-state="${escapeHtml(toString(entry.status, 'ready'))}">
            <div class="turnero-admin-queue-surface-replication-console__entry-head">
                <strong>${escapeHtml(`${toString(entry.surfaceKey, 'surface')} · ${toString(entry.kind || entry.role || entry.template, 'entry')} · status ${toString(entry.status, 'ready')}`)}</strong>
                <span class="turnero-admin-queue-surface-replication-console__surface-badge">${escapeHtml(toString(entry.status, 'ready'))}</span>
            </div>
            <p class="turnero-admin-queue-surface-replication-console__entry-meta">${escapeHtml(meta)}</p>
            ${entry.note ? `<p class="turnero-admin-queue-surface-replication-console__entry-note">${escapeHtml(entry.note)}</p>` : ''}
        </article>
    `;
}

function renderEntryList(entries, kind) {
    return entries.length
        ? `<div class="turnero-admin-queue-surface-replication-console__list">${entries.map((entry) => renderEntry(entry, kind)).join('')}</div>`
        : '<p class="turnero-admin-queue-surface-replication-console__empty">Sin entradas todavía.</p>';
}

function renderConsoleHtml(state) {
    return `
        <section class="turnero-admin-queue-surface-replication-console" data-state="${escapeHtml(state.gate.band)}">
            <div class="turnero-admin-queue-surface-replication-console__header">
                <div>
                    <p class="turnero-admin-queue-surface-replication-console__eyebrow">Turnero replication</p>
                    <h3>Surface Replication Scaleout</h3>
                    <p class="turnero-admin-queue-surface-replication-console__summary">Mapa clinic-scoped de templates, owners y gate de replicación por surface.</p>
                </div>
                <div class="turnero-admin-queue-surface-replication-console__actions">
                    <button type="button" class="turnero-admin-queue-surface-replication-console__button" data-action="copy-brief">Copy brief</button>
                    <button type="button" class="turnero-admin-queue-surface-replication-console__button" data-action="download-json">Download JSON</button>
                    <button type="button" class="turnero-admin-queue-surface-replication-console__button" data-action="refresh">Refresh</button>
                </div>
            </div>
            <div data-role="banner" class="turnero-admin-queue-surface-replication-console__banner-host" aria-live="polite"></div>
            <div class="turnero-admin-queue-surface-replication-console__metrics">
                ${renderMetric('Surfaces', String(state.surfacePacks.length), `${state.metrics.readyCount} ready / ${state.metrics.watchCount} watch`)}
                ${renderMetric('Templates', String(state.templates.length), `${state.gate.readyTemplateCount}/${state.gate.templateCount} ready`)}
                ${renderMetric('Owners', String(state.owners.length), `${state.gate.activeOwnerCount}/${state.gate.ownerCount} active`)}
                ${renderMetric('Gate', `${Number(state.gate.score || 0)} · ${state.gate.band}`, state.gate.decision)}
            </div>
            <div class="turnero-admin-queue-surface-replication-console__surface-grid">${state.surfacePacks.map((card) => renderSurfaceCard(card)).join('')}</div>
            <section class="turnero-admin-queue-surface-replication-console__section">
                <div class="turnero-admin-queue-surface-replication-console__section-header">
                    <div>
                        <h4>Add template</h4>
                        <p>Template deployable por surface, guardado con scope de clínica.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-replication-console__button" data-action="clear-templates">Clear templates</button>
                </div>
                <form class="turnero-admin-queue-surface-replication-console__form" data-action="add-template">
                    <label>Surface key <select data-field="template-surface-key">${state.surfaceOptions.map((option, index) => `<option value="${escapeHtml(option.surfaceKey)}"${index === 0 ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>
                    <label>Kind <input data-field="template-kind" type="text" value="deployment-template" /></label>
                    <label>Version <input data-field="template-version" type="text" value="v1" /></label>
                    <label>Status <input data-field="template-status" type="text" value="ready" /></label>
                    <label>Owner <input data-field="template-owner" type="text" value="ops" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="template-note">Template note</textarea></label>
                    <div class="turnero-admin-queue-surface-replication-console__form-actions"><button type="submit" class="turnero-admin-queue-surface-replication-console__button" data-tone="primary">Add template</button></div>
                </form>
                ${renderEntryList(state.templates, 'template')}
            </section>
            <section class="turnero-admin-queue-surface-replication-console__section">
                <div class="turnero-admin-queue-surface-replication-console__section-header">
                    <div>
                        <h4>Add owner</h4>
                        <p>Owner operativo para la replicación de la surface activa.</p>
                    </div>
                    <button type="button" class="turnero-admin-queue-surface-replication-console__button" data-action="clear-owners">Clear owners</button>
                </div>
                <form class="turnero-admin-queue-surface-replication-console__form" data-action="add-owner">
                    <label>Surface key <select data-field="owner-surface-key">${state.surfaceOptions.map((option, index) => `<option value="${escapeHtml(option.surfaceKey)}"${index === 0 ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>
                    <label>Actor <input data-field="owner-actor" type="text" value="owner" /></label>
                    <label>Role <input data-field="owner-role" type="text" value="replication" /></label>
                    <label>Status <input data-field="owner-status" type="text" value="active" /></label>
                    <label style="grid-column:1 / -1;">Note <textarea data-field="owner-note">Replication owner note</textarea></label>
                    <div class="turnero-admin-queue-surface-replication-console__form-actions"><button type="submit" class="turnero-admin-queue-surface-replication-console__button" data-tone="primary">Add owner</button></div>
                </form>
                ${renderEntryList(state.owners, 'owner')}
            </section>
            <pre data-role="brief" class="turnero-admin-queue-surface-replication-console__brief">${escapeHtml(state.brief)}</pre>
        </section>
    `;
}

function createMetricNode(label, value, detail = '') {
    const node = document.createElement('article');
    node.className = 'turnero-admin-queue-surface-replication-console__metric';
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('strong');
    valueNode.textContent = value;
    node.appendChild(labelNode);
    node.appendChild(valueNode);
    let detailNode = null;
    if (detail) {
        detailNode = document.createElement('span');
        detailNode.className =
            'turnero-admin-queue-surface-replication-console__entry-meta';
        detailNode.textContent = detail;
        node.appendChild(detailNode);
    }
    return { node, valueNode, detailNode };
}

function createSurfaceCardNode(card) {
    const node = document.createElement('article');
    node.className = 'turnero-admin-queue-surface-replication-console__surface';
    node.dataset.surfaceKey = card.surfaceKey;

    const header = document.createElement('div');
    header.className =
        'turnero-admin-queue-surface-replication-console__surface-header';
    const title = document.createElement('div');
    title.className =
        'turnero-admin-queue-surface-replication-console__surface-title';
    const titleStrong = document.createElement('strong');
    const titleMeta = document.createElement('p');
    title.appendChild(titleStrong);
    title.appendChild(titleMeta);
    const badge = document.createElement('span');
    badge.className =
        'turnero-admin-queue-surface-replication-console__surface-badge';
    header.appendChild(title);
    header.appendChild(badge);

    const summary = document.createElement('p');
    summary.className =
        'turnero-admin-queue-surface-replication-console__surface-summary';
    const detail = document.createElement('p');
    detail.className =
        'turnero-admin-queue-surface-replication-console__entry-meta';
    const checklist = document.createElement('p');
    checklist.className =
        'turnero-admin-queue-surface-replication-console__entry-meta';

    const chips = document.createElement('div');
    chips.className =
        'turnero-admin-queue-surface-replication-console__surface-chip-row';
    const templateChip = document.createElement('span');
    const replicationChip = document.createElement('span');
    const scoreChip = document.createElement('span');
    chips.appendChild(templateChip);
    chips.appendChild(replicationChip);
    chips.appendChild(scoreChip);

    node.appendChild(header);
    node.appendChild(summary);
    node.appendChild(detail);
    node.appendChild(checklist);
    node.appendChild(chips);

    return {
        node,
        titleStrong,
        titleMeta,
        badge,
        summary,
        detail,
        checklist,
        templateChip,
        replicationChip,
        scoreChip,
    };
}

function bindListener(node, type, handler) {
    if (!node) {
        return;
    }

    if (!node.listeners || typeof node.listeners.get !== 'function') {
        node.listeners = new Map();
    }
    node.listeners.set(type, handler);

    if (typeof node.addEventListener === 'function') {
        node.addEventListener(type, handler);
        return;
    }

    if (type === 'click') {
        node.onclick = handler;
    } else if (type === 'submit') {
        node.onsubmit = handler;
    }
}

function unbindListener(node, type, handler) {
    if (!node) {
        return;
    }

    if (node.listeners && typeof node.listeners.delete === 'function') {
        node.listeners.delete(type);
    }

    if (typeof node.removeEventListener === 'function') {
        node.removeEventListener(type, handler);
        return;
    }

    if (type === 'click' && node.onclick === handler) {
        node.onclick = null;
    } else if (type === 'submit' && node.onsubmit === handler) {
        node.onsubmit = null;
    }
}

function updateSurfaceCardNodes(cardRefs, card) {
    cardRefs.node.dataset.state = card.readout.gateBand;
    cardRefs.titleStrong.textContent = card.label;
    cardRefs.titleMeta.textContent =
        card.readout.surfaceLabel || card.readout.surfaceKey;
    cardRefs.badge.textContent = `${card.readout.gateBand} · ${Number(
        card.readout.gateScore || 0
    )}`;
    cardRefs.summary.textContent = `${card.readout.runtimeState} · ${card.readout.truth} · ${card.readout.assetProfile}`;
    cardRefs.detail.textContent = `Template ${card.readout.templateState} · owner ${toString(card.readout.replicationOwner, 'sin owner') || 'sin owner'} · install ${card.readout.installTimeBucket} · docs ${card.readout.documentationState}`;
    cardRefs.checklist.textContent = `Checklist ${card.checklist.summary.pass}/${card.checklist.summary.all} · Templates ${card.templates.length} · Owners ${card.owners.length} · Decision ${card.readout.gateDecision}`;
}

function buildConsoleState(input = {}, templates = [], owners = []) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            'global',
        'global'
    );
    const surfaceSeeds = resolveSurfaceSeeds(input, clinicProfile);
    const templateRows = Array.isArray(templates) ? templates.filter(Boolean) : [];
    const ownerRows = Array.isArray(owners) ? owners.filter(Boolean) : [];
    const surfacePacks = surfaceSeeds.map((seed) =>
        buildSurfacePack(seed, templateRows, ownerRows)
    );
    const checklist = buildChecklist(surfacePacks);
    const bannerSnapshot = buildBannerSnapshot(
        scope,
        clinicProfile,
        surfacePacks,
        checklist
    );
    const gate = buildTurneroSurfaceReplicationPack({
        ...bannerSnapshot,
        checklist,
        templates: templateRows,
        owners: ownerRows,
    }).gate;

    return {
        scope,
        clinicProfile,
        clinicId: bannerSnapshot.clinicId,
        clinicLabel: bannerSnapshot.clinicLabel,
        surfaceOptions: surfacePacks.map((pack) => ({
            surfaceKey: pack.surfaceKey,
            label: pack.readout.surfaceLabel || pack.label,
        })),
        surfaceSeeds,
        surfacePacks,
        templates: templateRows,
        owners: ownerRows,
        checklist,
        bannerSnapshot,
        gate,
        metrics: {
            readyCount: surfacePacks.filter((pack) => pack.gate.band === 'ready')
                .length,
            watchCount: surfacePacks.filter((pack) => pack.gate.band === 'watch')
                .length,
        },
        brief: '',
        generatedAt: new Date().toISOString(),
    };
}

function syncState(controller, input, templateLedger, ownerStore) {
    const nextState = buildConsoleState(
        input,
        templateLedger.list(),
        ownerStore.list()
    );
    Object.assign(controller.state, nextState);
    controller.state.brief = buildBrief(controller.state);
    controller.state.generatedAt = new Date().toISOString();

    controller.root.dataset.state = controller.state.gate.band;
    mountTurneroSurfaceReplicationBanner(controller.bannerHost, {
        snapshot: controller.state.bannerSnapshot,
        checklist: controller.state.checklist,
        gate: controller.state.gate,
        templates: controller.state.templates,
        owners: controller.state.owners,
        title: 'Surface Replication Scaleout',
    });

    controller.metricNodes[0].valueNode.textContent = String(
        controller.state.surfacePacks.length
    );
    if (controller.metricNodes[0].detailNode) {
        controller.metricNodes[0].detailNode.textContent = `${controller.state.metrics.readyCount} ready / ${controller.state.metrics.watchCount} watch`;
    }
    controller.metricNodes[1].valueNode.textContent = String(
        controller.state.templates.length
    );
    if (controller.metricNodes[1].detailNode) {
        controller.metricNodes[1].detailNode.textContent = `${controller.state.gate.readyTemplateCount}/${controller.state.gate.templateCount} ready`;
    }
    controller.metricNodes[2].valueNode.textContent = String(
        controller.state.owners.length
    );
    if (controller.metricNodes[2].detailNode) {
        controller.metricNodes[2].detailNode.textContent = `${controller.state.gate.activeOwnerCount}/${controller.state.gate.ownerCount} active`;
    }
    controller.metricNodes[3].valueNode.textContent = `${Number(
        controller.state.gate.score || 0
    )} · ${controller.state.gate.band}`;
    if (controller.metricNodes[3].detailNode) {
        controller.metricNodes[3].detailNode.textContent =
            controller.state.gate.decision;
    }

    controller.surfaceCardRefs.forEach((cardRefs, index) => {
        const pack = controller.state.surfacePacks[index];
        if (!pack) {
            return;
        }
        updateSurfaceCardNodes(cardRefs, pack);
        mountTurneroSurfaceCheckpointChip(cardRefs.templateChip, {
            label: 'template',
            value: pack.readout.templateState,
            state: pack.readout.templateState === 'ready' ? 'ready' : 'warning',
        });
        mountTurneroSurfaceCheckpointChip(cardRefs.replicationChip, {
            label: 'replication',
            value: pack.readout.gateBand,
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        });
        mountTurneroSurfaceCheckpointChip(cardRefs.scoreChip, {
            label: 'score',
            value: String(Number(pack.readout.gateScore || 0)),
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        });
    });

    controller.templatesList.innerHTML = renderEntryList(
        controller.state.templates,
        'template'
    );
    controller.ownersList.innerHTML = renderEntryList(
        controller.state.owners,
        'owner'
    );
    controller.briefNode.textContent = controller.state.brief;
}

function buildController(input, templateLedger, ownerStore) {
    const state = buildConsoleState(
        input,
        Array.isArray(input.templates) ? input.templates : templateLedger.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    state.brief = buildBrief(state);

    const root = document.createElement('section');
    root.className = 'turnero-admin-queue-surface-replication-console';
    root.dataset.state = state.gate.band;

    const header = document.createElement('div');
    header.className = 'turnero-admin-queue-surface-replication-console__header';
    const headerCopy = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'turnero-admin-queue-surface-replication-console__eyebrow';
    eyebrow.textContent = 'Turnero replication';
    const title = document.createElement('h3');
    title.textContent = 'Surface Replication Scaleout';
    const summary = document.createElement('p');
    summary.className = 'turnero-admin-queue-surface-replication-console__summary';
    summary.textContent =
        'Mapa clinic-scoped de templates, owners y gate de replicación por surface.';
    headerCopy.appendChild(eyebrow);
    headerCopy.appendChild(title);
    headerCopy.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'turnero-admin-queue-surface-replication-console__actions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className =
        'turnero-admin-queue-surface-replication-console__button';
    copyButton.dataset.action = 'copy-brief';
    copyButton.textContent = 'Copy brief';
    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className =
        'turnero-admin-queue-surface-replication-console__button';
    downloadButton.dataset.action = 'download-json';
    downloadButton.textContent = 'Download JSON';
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className =
        'turnero-admin-queue-surface-replication-console__button';
    refreshButton.dataset.action = 'refresh';
    refreshButton.textContent = 'Refresh';
    actions.appendChild(copyButton);
    actions.appendChild(downloadButton);
    actions.appendChild(refreshButton);
    header.appendChild(headerCopy);
    header.appendChild(actions);

    const bannerHost = document.createElement('div');
    bannerHost.dataset.role = 'banner';
    bannerHost.className =
        'turnero-admin-queue-surface-replication-console__banner-host';

    const metrics = document.createElement('div');
    metrics.className = 'turnero-admin-queue-surface-replication-console__metrics';
    const metricNodes = [
        createMetricNode(
            'Surfaces',
            String(state.surfacePacks.length),
            `${state.metrics.readyCount} ready / ${state.metrics.watchCount} watch`
        ),
        createMetricNode(
            'Templates',
            String(state.templates.length),
            `${state.gate.readyTemplateCount}/${state.gate.templateCount} ready`
        ),
        createMetricNode(
            'Owners',
            String(state.owners.length),
            `${state.gate.activeOwnerCount}/${state.gate.ownerCount} active`
        ),
        createMetricNode(
            'Gate',
            `${Number(state.gate.score || 0)} · ${state.gate.band}`,
            state.gate.decision
        ),
    ];
    metricNodes.forEach((entry) => metrics.appendChild(entry.node));

    const surfaceGrid = document.createElement('div');
    surfaceGrid.className =
        'turnero-admin-queue-surface-replication-console__surface-grid';
    const surfaceCardRefs = state.surfacePacks.map((card) => {
        const refs = createSurfaceCardNode(card);
        surfaceGrid.appendChild(refs.node);
        return refs;
    });

    const templateSection = document.createElement('section');
    templateSection.className =
        'turnero-admin-queue-surface-replication-console__section';
    const templateHeader = document.createElement('div');
    templateHeader.className =
        'turnero-admin-queue-surface-replication-console__section-header';
    const templateCopy = document.createElement('div');
    const templateTitle = document.createElement('h4');
    templateTitle.textContent = 'Add template';
    const templateDesc = document.createElement('p');
    templateDesc.textContent =
        'Template deployable por surface, guardado con scope de clínica.';
    templateCopy.appendChild(templateTitle);
    templateCopy.appendChild(templateDesc);
    const clearTemplatesButton = document.createElement('button');
    clearTemplatesButton.type = 'button';
    clearTemplatesButton.className =
        'turnero-admin-queue-surface-replication-console__button';
    clearTemplatesButton.dataset.action = 'clear-templates';
    clearTemplatesButton.textContent = 'Clear templates';
    templateHeader.appendChild(templateCopy);
    templateHeader.appendChild(clearTemplatesButton);
    const templateForm = document.createElement('form');
    templateForm.className = 'turnero-admin-queue-surface-replication-console__form';
    templateForm.dataset.action = 'add-template';
    const templateSurfaceSelect = document.createElement('select');
    templateSurfaceSelect.dataset.field = 'template-surface-key';
    state.surfaceOptions.forEach((option, index) => {
        const optionEl = document.createElement('option');
        optionEl.value = option.surfaceKey;
        optionEl.textContent = option.label;
        if (index === 0) {
            optionEl.selected = true;
        }
        templateSurfaceSelect.appendChild(optionEl);
    });
    templateSurfaceSelect.value =
        state.surfaceOptions[0]?.surfaceKey || 'surface';
    const templateKindInput = document.createElement('input');
    templateKindInput.dataset.field = 'template-kind';
    templateKindInput.type = 'text';
    templateKindInput.value = 'deployment-template';
    const templateVersionInput = document.createElement('input');
    templateVersionInput.dataset.field = 'template-version';
    templateVersionInput.type = 'text';
    templateVersionInput.value = 'v1';
    const templateStatusInput = document.createElement('input');
    templateStatusInput.dataset.field = 'template-status';
    templateStatusInput.type = 'text';
    templateStatusInput.value = 'ready';
    const templateOwnerInput = document.createElement('input');
    templateOwnerInput.dataset.field = 'template-owner';
    templateOwnerInput.type = 'text';
    templateOwnerInput.value = 'ops';
    const templateNoteInput = document.createElement('textarea');
    templateNoteInput.dataset.field = 'template-note';
    templateNoteInput.value = 'Template note';
    const templateSubmit = document.createElement('button');
    templateSubmit.type = 'submit';
    templateSubmit.className =
        'turnero-admin-queue-surface-replication-console__button';
    templateSubmit.dataset.tone = 'primary';
    templateSubmit.textContent = 'Add template';
    [
        ['Surface key', templateSurfaceSelect],
        ['Kind', templateKindInput],
        ['Version', templateVersionInput],
        ['Status', templateStatusInput],
        ['Owner', templateOwnerInput],
        ['Note', templateNoteInput],
    ].forEach(([labelText, control]) => {
        const label = document.createElement('label');
        label.textContent = labelText;
        label.appendChild(control);
        if (labelText === 'Note') {
            label.style.gridColumn = '1 / -1';
        }
        templateForm.appendChild(label);
    });
    const templateActions = document.createElement('div');
    templateActions.className =
        'turnero-admin-queue-surface-replication-console__form-actions';
    templateActions.appendChild(templateSubmit);
    templateForm.appendChild(templateActions);
    const templatesList = document.createElement('div');
    templateSection.appendChild(templateHeader);
    templateSection.appendChild(templateForm);
    templateSection.appendChild(templatesList);

    const ownerSection = document.createElement('section');
    ownerSection.className = 'turnero-admin-queue-surface-replication-console__section';
    const ownerHeader = document.createElement('div');
    ownerHeader.className =
        'turnero-admin-queue-surface-replication-console__section-header';
    const ownerCopy = document.createElement('div');
    const ownerTitle = document.createElement('h4');
    ownerTitle.textContent = 'Add owner';
    const ownerDesc = document.createElement('p');
    ownerDesc.textContent =
        'Owner operativo para la replicación de la surface activa.';
    ownerCopy.appendChild(ownerTitle);
    ownerCopy.appendChild(ownerDesc);
    const clearOwnersButton = document.createElement('button');
    clearOwnersButton.type = 'button';
    clearOwnersButton.className =
        'turnero-admin-queue-surface-replication-console__button';
    clearOwnersButton.dataset.action = 'clear-owners';
    clearOwnersButton.textContent = 'Clear owners';
    ownerHeader.appendChild(ownerCopy);
    ownerHeader.appendChild(clearOwnersButton);
    const ownerForm = document.createElement('form');
    ownerForm.className = 'turnero-admin-queue-surface-replication-console__form';
    ownerForm.dataset.action = 'add-owner';
    const ownerSurfaceSelect = document.createElement('select');
    ownerSurfaceSelect.dataset.field = 'owner-surface-key';
    state.surfaceOptions.forEach((option, index) => {
        const optionEl = document.createElement('option');
        optionEl.value = option.surfaceKey;
        optionEl.textContent = option.label;
        if (index === 0) {
            optionEl.selected = true;
        }
        ownerSurfaceSelect.appendChild(optionEl);
    });
    ownerSurfaceSelect.value = state.surfaceOptions[0]?.surfaceKey || 'surface';
    const ownerActorInput = document.createElement('input');
    ownerActorInput.dataset.field = 'owner-actor';
    ownerActorInput.type = 'text';
    ownerActorInput.value = 'owner';
    const ownerRoleInput = document.createElement('input');
    ownerRoleInput.dataset.field = 'owner-role';
    ownerRoleInput.type = 'text';
    ownerRoleInput.value = 'replication';
    const ownerStatusInput = document.createElement('input');
    ownerStatusInput.dataset.field = 'owner-status';
    ownerStatusInput.type = 'text';
    ownerStatusInput.value = 'active';
    const ownerNoteInput = document.createElement('textarea');
    ownerNoteInput.dataset.field = 'owner-note';
    ownerNoteInput.value = 'Replication owner note';
    const ownerSubmit = document.createElement('button');
    ownerSubmit.type = 'submit';
    ownerSubmit.className =
        'turnero-admin-queue-surface-replication-console__button';
    ownerSubmit.dataset.tone = 'primary';
    ownerSubmit.textContent = 'Add owner';
    [
        ['Surface key', ownerSurfaceSelect],
        ['Actor', ownerActorInput],
        ['Role', ownerRoleInput],
        ['Status', ownerStatusInput],
        ['Note', ownerNoteInput],
    ].forEach(([labelText, control]) => {
        const label = document.createElement('label');
        label.textContent = labelText;
        label.appendChild(control);
        if (labelText === 'Note') {
            label.style.gridColumn = '1 / -1';
        }
        ownerForm.appendChild(label);
    });
    const ownerActions = document.createElement('div');
    ownerActions.className =
        'turnero-admin-queue-surface-replication-console__form-actions';
    ownerActions.appendChild(ownerSubmit);
    ownerForm.appendChild(ownerActions);
    const ownersList = document.createElement('div');
    ownerSection.appendChild(ownerHeader);
    ownerSection.appendChild(ownerForm);
    ownerSection.appendChild(ownersList);

    const briefNode = document.createElement('pre');
    briefNode.dataset.role = 'brief';
    briefNode.className = 'turnero-admin-queue-surface-replication-console__brief';

    root.appendChild(header);
    root.appendChild(bannerHost);
    root.appendChild(metrics);
    root.appendChild(surfaceGrid);
    root.appendChild(templateSection);
    root.appendChild(ownerSection);
    root.appendChild(briefNode);

    const controller = {
        root,
        state,
        bannerHost,
        metricNodes,
        surfaceCardRefs,
        templatesList,
        ownersList,
        briefNode,
        refs: {
            copyButton,
            downloadButton,
            refreshButton,
            clearTemplatesButton,
            clearOwnersButton,
            templateForm,
            ownerForm,
            templateSurfaceSelect,
            templateKindInput,
            templateVersionInput,
            templateStatusInput,
            templateOwnerInput,
            templateNoteInput,
            ownerSurfaceSelect,
            ownerActorInput,
            ownerRoleInput,
            ownerStatusInput,
            ownerNoteInput,
            templateSubmit,
            ownerSubmit,
            surfaceGrid,
        },
    };

    const onCopy = async () => copyTextToClipboard(controller.state.brief);
    const onDownload = () =>
        downloadJsonSnapshot(
            'turnero-surface-replication-console.json',
            buildDownloadSnapshot(controller.state)
        );
    const onRefresh = () => syncState(controller, input, templateLedger, ownerStore);
    const onClearTemplates = () => {
        templateLedger.clear();
        syncState(controller, input, templateLedger, ownerStore);
    };
    const onClearOwners = () => {
        ownerStore.clear();
        syncState(controller, input, templateLedger, ownerStore);
    };
    const onTemplateSubmit = (event) => {
        event.preventDefault();
        templateLedger.add({
            surfaceKey: toString(
                controller.refs.templateSurfaceSelect.value,
                controller.state.surfaceOptions[0]?.surfaceKey || 'surface'
            ),
            kind: toString(
                controller.refs.templateKindInput.value,
                'deployment-template'
            ),
            version: toString(controller.refs.templateVersionInput.value, 'v1'),
            status: toString(controller.refs.templateStatusInput.value, 'ready'),
            owner: toString(controller.refs.templateOwnerInput.value, 'ops'),
            note: toString(controller.refs.templateNoteInput.value, ''),
        });
        controller.refs.templateNoteInput.value = '';
        syncState(controller, input, templateLedger, ownerStore);
    };
    const onOwnerSubmit = (event) => {
        event.preventDefault();
        ownerStore.add({
            surfaceKey: toString(
                controller.refs.ownerSurfaceSelect.value,
                controller.state.surfaceOptions[0]?.surfaceKey || 'surface'
            ),
            actor: toString(controller.refs.ownerActorInput.value, 'owner'),
            role: toString(controller.refs.ownerRoleInput.value, 'replication'),
            status: toString(controller.refs.ownerStatusInput.value, 'active'),
            note: toString(controller.refs.ownerNoteInput.value, ''),
        });
        controller.refs.ownerNoteInput.value = '';
        syncState(controller, input, templateLedger, ownerStore);
    };

    bindListener(copyButton, 'click', onCopy);
    bindListener(downloadButton, 'click', onDownload);
    bindListener(refreshButton, 'click', onRefresh);
    bindListener(clearTemplatesButton, 'click', onClearTemplates);
    bindListener(clearOwnersButton, 'click', onClearOwners);
    bindListener(templateForm, 'submit', onTemplateSubmit);
    bindListener(ownerForm, 'submit', onOwnerSubmit);

    controller.destroy = () => {
        unbindListener(copyButton, 'click', onCopy);
        unbindListener(downloadButton, 'click', onDownload);
        unbindListener(refreshButton, 'click', onRefresh);
        unbindListener(clearTemplatesButton, 'click', onClearTemplates);
        unbindListener(clearOwnersButton, 'click', onClearOwners);
        unbindListener(templateForm, 'submit', onTemplateSubmit);
        unbindListener(ownerForm, 'submit', onOwnerSubmit);
    };
    controller.refresh = () => {
        syncState(controller, input, templateLedger, ownerStore);
        return controller.state;
    };

    controller.refresh();
    return controller;
}

export function buildTurneroAdminQueueSurfaceReplicationConsoleHtml(input = {}) {
    const scope = toString(input.scope, 'global') || 'global';
    const clinicProfile = asObject(input.clinicProfile);
    const templateLedger = createTurneroSurfaceDeploymentTemplateLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceReplicationOwnerStore(
        scope,
        clinicProfile
    );
    const state = buildConsoleState(
        input,
        Array.isArray(input.templates) ? input.templates : templateLedger.list(),
        Array.isArray(input.owners) ? input.owners : ownerStore.list()
    );
    state.brief = buildBrief(state);
    return renderConsoleHtml(state);
}

export function mountTurneroAdminQueueSurfaceReplicationConsole(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!(host instanceof HTMLElement) || typeof document === 'undefined') {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureStyles();
    const scope = toString(input.scope, 'global') || 'global';
    const clinicProfile = asObject(input.clinicProfile);
    const templateLedger = createTurneroSurfaceDeploymentTemplateLedger(
        scope,
        clinicProfile
    );
    const ownerStore = createTurneroSurfaceReplicationOwnerStore(
        scope,
        clinicProfile
    );
    const controller = buildController(input, templateLedger, ownerStore);
    controller.root.className = 'turnero-admin-queue-surface-replication-console';
    host.replaceChildren(controller.root);
    controller.refresh();
    return controller;
}
