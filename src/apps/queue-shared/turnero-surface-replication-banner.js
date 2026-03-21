import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceReplicationReadout } from './turnero-surface-replication-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceReplicationBannerInlineStyles';

function ensureReplicationBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-replication-banner {
            gap: 0.22rem;
        }
        .turnero-surface-replication-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-replication-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-replication-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeBannerState(gateBand) {
    const normalized = toString(gateBand, 'degraded');
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function buildBannerSummary(readout) {
    return readout.summary;
}

function buildBannerDetail(readout) {
    return readout.detail;
}

function resolveReplicationReadout(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const directReadout = asObject(input.readout);
    const readout =
        Object.keys(directReadout).length > 0
            ? directReadout
            : buildTurneroSurfaceReplicationReadout({
                  snapshot,
                  checklist: input.checklist || pack.checklist,
                  gate,
                  templates: input.templates || pack.templates,
                  owners: input.owners || pack.owners,
              });

    return {
        snapshot,
        gate,
        readout,
    };
}

export function buildTurneroSurfaceReplicationBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveReplicationReadout(input);
    if (toString(gate.band, 'degraded') === 'ready') {
        return '';
    }

    const title = toString(input.title, 'Surface replication visible');
    const summary = toString(input.summary, buildBannerSummary(readout));
    const detail = toString(input.detail, buildBannerDetail(readout));
    const badge = toString(input.badge, readout.badge);
    const state = normalizeBannerState(gate.band);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-replication-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(gate.band, 'degraded'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'hold-scaleout')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface replication'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-replication-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceReplicationBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureReplicationBannerStyles();

    const { snapshot, gate, readout } = resolveReplicationReadout(input);
    if (toString(gate.band, 'degraded') === 'ready') {
        root.hidden = true;
        root.innerHTML = '';
        root.removeAttribute?.('data-state');
        root.removeAttribute?.('data-band');
        root.removeAttribute?.('data-decision');
        return null;
    }

    root.hidden = false;
    root.className =
        'turnero-surface-ops__banner turnero-surface-replication-banner';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'degraded');
    root.dataset.decision = toString(gate.decision, 'hold-scaleout');
    root.innerHTML = buildTurneroSurfaceReplicationBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-replication-banner') || root;
}
