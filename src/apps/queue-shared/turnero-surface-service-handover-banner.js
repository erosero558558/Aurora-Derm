import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceServiceHandoverReadout } from './turnero-surface-service-handover-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfaceServiceHandoverBannerInlineStyles';

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
        .turnero-surface-service-handover-banner {
            gap: 0.22rem;
        }
        .turnero-surface-service-handover-banner[data-state='ready'] {
            border-color: rgb(22 163 74 / 18%);
            background: rgb(240 253 244 / 82%);
            color: rgb(22 101 52);
        }
        .turnero-surface-service-handover-banner[data-state='watch'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-service-handover-banner[data-state='blocked'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-service-handover-banner__meta {
            opacity: 0.86;
        }
    `;
    document.head.appendChild(styleEl);
    return true;
}

function resolveReadout(input = {}) {
    const pack = asObject(input.pack);
    const snapshot = asObject(input.snapshot || pack.snapshot);
    const gate = asObject(input.gate || pack.gate);
    const checklist = asObject(input.checklist || pack.checklist);
    const playbook = Array.isArray(input.playbook)
        ? input.playbook
        : Array.isArray(pack.playbook)
          ? pack.playbook
          : [];
    const roster = Array.isArray(input.roster)
        ? input.roster
        : Array.isArray(pack.roster)
          ? pack.roster
          : [];

    return (
        input.readout ||
        pack.readout ||
        buildTurneroSurfaceServiceHandoverReadout({
            snapshot,
            gate,
            checklist,
            playbook,
            roster,
        })
    );
}

export function buildTurneroSurfaceServiceHandoverBannerHtml(input = {}) {
    const readout = resolveReadout(input);
    const title = toString(
        input.title,
        readout.title || 'Surface service handover'
    );
    const eyebrow = toString(
        input.eyebrow,
        'Surface service handover'
    );

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-service-handover-banner"
            data-surface="${escapeHtml(readout.surfaceKey || 'surface')}"
            data-state="${escapeHtml(readout.state || readout.gateBand || 'watch')}"
            data-band="${escapeHtml(readout.gateBand || 'watch')}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(eyebrow)}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(readout.summary || 'Service handover visible.')}</p>
                <p class="turnero-surface-service-handover-banner__meta">
                    ${escapeHtml(readout.detail || 'Sin detalle adicional.')}
                </p>
                <p class="turnero-surface-service-handover-banner__meta">
                    ${escapeHtml(
                        `Gate ${toString(readout.gateBand, 'watch')} · decision ${toString(
                            readout.gateDecision,
                            'review-service-handover'
                        )}`
                    )}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(readout.badge || `${readout.gateBand || 'watch'} · ${Number(readout.gateScore || 0)}`)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfaceServiceHandoverBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensureBannerStyles();
    root.innerHTML = buildTurneroSurfaceServiceHandoverBannerHtml(input);
    return root.querySelector('.turnero-surface-service-handover-banner');
}
