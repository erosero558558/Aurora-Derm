import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceExecutiveReviewReadout } from './turnero-surface-executive-review-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceExecutiveReviewBannerInlineStyles';

function ensureExecutiveReviewBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }

    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-executive-review-banner {
            gap: 0.22rem;
        }
        .turnero-surface-executive-review-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-executive-review-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-executive-review-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function normalizeBannerState(gateBand) {
    const normalized = toString(gateBand, 'blocked');
    if (normalized === 'ready') {
        return 'ready';
    }

    if (normalized === 'watch') {
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
                : buildTurneroSurfaceExecutiveReviewReadout({
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
        `priority ${toString(readout.priorityBand, 'unknown')}`,
        `review ${toString(readout.decisionState, 'pending')}`,
        `owner ${toString(readout.reviewOwner, 'ops')}`,
        `items ${Number(readout.reviewItemCount || 0)}`,
    ].join(' · ');
}

function buildBannerDetail(readout) {
    return [
        `Checklist ${Number(readout.checklistPass || 0)}/${Number(
            readout.checklistAll || 0
        )}`,
        `Owners activos ${Number(readout.activeOwnerCount || 0)}`,
        `Score ${Number(readout.gateScore || 0)}`,
        `Decision ${toString(
            readout.gateDecision,
            'hold-executive-review'
        )}`,
    ].join(' · ');
}

function buildBannerBadge(readout) {
    return `${toString(readout.gateBand, 'blocked')} · ${Number(
        readout.gateScore || 0
    )}`;
}

export function buildTurneroSurfaceExecutiveReviewBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveReadout(input);
    if (toString(gate.band, 'blocked') === 'ready') {
        return '';
    }

    const title = toString(
        input.title,
        'Surface executive review visible'
    );
    const summary = toString(input.summary, buildBannerSummary(readout));
    const detail = toString(input.detail, buildBannerDetail(readout));
    const badge = toString(input.badge, buildBannerBadge(readout));
    const state = normalizeBannerState(gate.band);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-executive-review-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(gate.band, 'blocked'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'hold-executive-review')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Executive review'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-executive-review-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceExecutiveReviewBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureExecutiveReviewBannerStyles();

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
    root.className = 'turnero-surface-ops__banner turnero-surface-executive-review-banner';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'blocked');
    root.dataset.decision = toString(
        gate.decision,
        'hold-executive-review'
    );
    root.innerHTML = buildTurneroSurfaceExecutiveReviewBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-executive-review-banner') || root;
}

export default mountTurneroSurfaceExecutiveReviewBanner;
