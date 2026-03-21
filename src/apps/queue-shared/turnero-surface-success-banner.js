import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceSuccessReadout } from './turnero-surface-success-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceSuccessBannerInlineStyles';

function ensureBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-success-banner {
            gap: 0.22rem;
        }
        .turnero-surface-success-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-success-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-success-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-success-banner__meta {
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

function resolveSuccessReadout(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const directReadout = asObject(input.readout);
    const readout =
        Object.keys(directReadout).length > 0
            ? directReadout
            : buildTurneroSurfaceSuccessReadout({
                  snapshot,
                  gate,
              });

    return {
        snapshot,
        gate,
        readout,
    };
}

export function buildTurneroSurfaceSuccessBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveSuccessReadout(input);
    const title = toString(input.title, 'Customer success visible');
    const summary = toString(
        input.summary,
        readout.summary ||
            `${toString(readout.surfaceLabel, readout.surfaceKey || 'surface')} · ${toString(readout.adoptionState, 'watch')}`
    );
    const detail = toString(
        input.detail,
        readout.detail ||
            `Gate ${toString(readout.gateBand, 'watch')} · score ${Number(
                readout.gateScore || 0
            )}`
    );
    const badge = toString(
        input.badge,
        readout.badge || `${readout.gateBand} · ${Number(readout.gateScore || 0)}`
    );
    const state = normalizeBannerState(gate.band);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-success-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(gate.band, 'degraded'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'hold-success-readiness')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface customer success'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-success-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceSuccessBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureBannerStyles();

    const { snapshot, gate, readout } = resolveSuccessReadout(input);
    root.hidden = false;
    root.className = 'turnero-surface-ops__banner-host';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'degraded');
    root.dataset.decision = toString(
        gate.decision,
        'hold-success-readiness'
    );
    root.innerHTML = buildTurneroSurfaceSuccessBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-success-banner') || root;
}
