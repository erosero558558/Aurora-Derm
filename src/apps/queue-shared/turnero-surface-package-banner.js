import { ensureTurneroSurfaceOpsStyles } from './turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfacePackageReadout } from './turnero-surface-package-readout.js';
import {
    asObject,
    escapeHtml,
    resolveTarget,
    toString,
} from './turnero-surface-helpers.js';

const STYLE_ID = 'turneroSurfacePackageBannerInlineStyles';

function ensurePackageBannerStyles() {
    if (typeof document === 'undefined') {
        return false;
    }
    if (document.getElementById(STYLE_ID)) {
        return true;
    }

    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
        .turnero-surface-package-banner {
            gap: 0.22rem;
        }
        .turnero-surface-package-banner[data-state='warning'] {
            border-color: rgb(180 83 9 / 18%);
            background: rgb(255 251 235 / 82%);
            color: rgb(120 53 15);
        }
        .turnero-surface-package-banner[data-state='alert'] {
            border-color: rgb(190 24 93 / 18%);
            background: rgb(255 241 242 / 84%);
            color: rgb(159 18 57);
        }
        .turnero-surface-package-banner__meta {
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
                : buildTurneroSurfacePackageReadout({
                      snapshot,
                      gate,
                      checklist: input.checklist || pack.checklist,
                      ledger: input.ledger || pack.ledger,
                      owners: input.owners || pack.owners,
                      latestArtifacts: pack.latestArtifacts,
                  }),
    };
}

function buildBannerSummary(readout) {
    return [
        `tier ${toString(readout.packageTier, 'pilot')}`,
        `owner ${toString(readout.packageOwner, 'sin owner') || 'sin owner'}`,
        `bundle ${toString(readout.bundleState, 'draft')}`,
        `provisioning ${toString(readout.provisioningState, 'draft')}`,
        `onboarding ${toString(readout.onboardingKitState, 'draft')}`,
    ].join(' · ');
}

function buildBannerDetail(readout) {
    return [
        `Checklist ${Number(readout.checklistPass || 0)}/${Number(
            readout.checklistAll || 0
        )}`,
        `Artefactos listos ${Number(readout.readyArtifactCount || 0)}/${Number(
            readout.requiredArtifactCount || 3
        )}`,
        `Score ${Number(readout.gateScore || 0)}`,
        `Decision ${toString(
            readout.gateDecision,
            'hold-package-standardization'
        )}`,
    ].join(' · ');
}

function buildBannerBadge(readout) {
    return `${toString(readout.gateBand, 'blocked')} · ${Number(
        readout.gateScore || 0
    )}`;
}

export function buildTurneroSurfacePackageBannerHtml(input = {}) {
    const { snapshot, gate, readout } = resolveReadout(input);
    if (toString(gate.band, 'blocked') === 'ready') {
        return '';
    }

    const title = toString(
        input.title,
        'Surface package standardization visible'
    );
    const summary = toString(input.summary, buildBannerSummary(readout));
    const detail = toString(input.detail, buildBannerDetail(readout));
    const badge = toString(input.badge, buildBannerBadge(readout));
    const state = normalizeBannerState(gate.band);

    return `
        <section
            class="turnero-surface-ops__banner turnero-surface-package-banner"
            data-surface="${escapeHtml(snapshot.surfaceKey || 'surface')}"
            data-state="${escapeHtml(state)}"
            data-band="${escapeHtml(toString(gate.band, 'blocked'))}"
            data-decision="${escapeHtml(
                toString(gate.decision, 'hold-package-standardization')
            )}"
        >
            <div class="turnero-surface-ops__banner-copy">
                <p class="turnero-surface-ops__banner-eyebrow">
                    ${escapeHtml(toString(input.eyebrow, 'Surface package standardization'))}
                </p>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
                <p class="turnero-surface-package-banner__meta">
                    ${escapeHtml(detail)}
                </p>
            </div>
            <span class="turnero-surface-ops__banner-badge">
                ${escapeHtml(badge)}
            </span>
        </section>
    `;
}

export function mountTurneroSurfacePackageBanner(target, input = {}) {
    const root = resolveTarget(target);
    if (!(root instanceof HTMLElement)) {
        return null;
    }

    ensureTurneroSurfaceOpsStyles();
    ensurePackageBannerStyles();

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
    root.className = 'turnero-surface-ops__banner turnero-surface-package-banner';
    root.dataset.state = normalizeBannerState(gate.band);
    root.dataset.band = toString(gate.band, 'blocked');
    root.dataset.decision = toString(
        gate.decision,
        'hold-package-standardization'
    );
    root.innerHTML = buildTurneroSurfacePackageBannerHtml({
        snapshot,
        gate,
        readout,
        ...input,
    });
    return root.querySelector?.('.turnero-surface-package-banner') || root;
}
