import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceRoadmapReadout } from './turnero-surface-roadmap-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceRoadmapBannerInlineStyles';

function ensureRoadmapBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-roadmap-banner {
            gap: 0.22rem;
        }
        .turnero-surface-roadmap-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-roadmap-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-roadmap-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-roadmap-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeBannerState(gateBand) {
    if (gateBand === 'ready') {
        return 'ready';
    }
    if (gateBand === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function resolveReadout(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const directReadout = asObject(input.readout);

    return {
        snapshot,
        gate,
        readout:
            Object.keys(directReadout).length > 0
                ? directReadout
                : buildTurneroSurfaceRoadmapReadout({
                      snapshot,
                      gate,
                      checklist: input.checklist || pack.checklist,
                      ledger: input.ledger || pack.ledger,
                      owners: input.owners || pack.owners,
                  }),
    };
}

function buildBannerSummary(readout) {
    return [
        `priority ${toString(readout.priorityBand, 'p3')}`,
        `owner ${toString(readout.roadmapOwner, 'sin owner') || 'sin owner'}`,
        `backlog ${toString(readout.backlogState, 'draft')}`,
    ].join(' · ');
}

function buildBannerDetail(readout) {
    return [
        `Next ${toString(readout.nextAction, 'sin siguiente accion')}`,
        `Checklist ${Number(readout.checklistPass || 0)}/${Number(
            readout.checklistAll || 0
        )}`,
        `Backlog listo ${Number(readout.readyLedgerCount || 0)}/${Number(
            readout.ledgerCount || 0
        )}`,
        `Score ${Number(readout.gateScore || 0)}`,
    ].join(' · ');
}

export function buildTurneroSurfaceRoadmapBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveReadout(input);
    if (toString(gate.band, 'blocked') === 'ready') {
        return '';
    }

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-roadmap-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(normalizeBannerState(gate.band))}"
            data-band="${escapeHtml(toString(gate.band, 'blocked'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'stabilize-before-roadmap')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface roadmap prioritization'))}
                </p>
                <strong>${escapeHtml(
                    toString(
                        input.title,
                        'Surface roadmap prioritization visible'
                    )
                )}</strong>
                <p>${escapeHtml(toString(input.summary, buildBannerSummary(readout)))}</p>
                <p class="turnero-surface-roadmap-banner__meta">
                    ${escapeHtml(toString(input.detail, buildBannerDetail(readout)))}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(toString(input.badge, readout.badge || `${readout.gateBand || 'blocked'} · ${Number(readout.gateScore || 0)}`))}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceRoadmapBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureRoadmapBannerStyles();

    const { snapshot, gate, readout } = resolveReadout(input);
    if (toString(gate.band, 'blocked') === 'ready') {
        root.hidden = true;
        root.innerHTML = '';
        root.removeAttribute?.('data-state');
        root.removeAttribute?.('data-band');
        root.removeAttribute?.('data-decision');
        return null;
    }

    root.hidden = false;
    root.className = 'turnero-surface-ops__banner turnero-surface-roadmap-banner';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'blocked');
    root.dataset.decision = toString(
        gate.decision,
        'stabilize-before-roadmap'
    );
    root.innerHTML = buildTurneroSurfaceRoadmapBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-roadmap-banner') || root;
}
