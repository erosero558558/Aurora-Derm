import { createSurfaceHeartbeatClient } from '../queue-shared/surface-heartbeat.js';
import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicShortName,
    getTurneroConsultorioLabel,
    buildTurneroSurfaceRuntimeStatus,
    getTurneroSurfaceContract,
    loadTurneroClinicProfile,
} from '../queue-shared/turnero-runtime-contract.mjs';
import { mountTurneroSurfaceRuntimeBootstrap } from '../queue-shared/turnero-surface-runtime-bootstrap.js';
import { buildTurneroSurfaceGoLiveSnapshot } from '../queue-shared/turnero-surface-go-live-snapshot.js';
import { createTurneroSurfaceGoLiveLedger } from '../queue-shared/turnero-surface-go-live-ledger.js';
import { buildTurneroSurfaceGoLivePack } from '../queue-shared/turnero-surface-go-live-pack.js';
import { mountTurneroSurfaceGoLiveBanner } from '../queue-shared/turnero-surface-go-live-banner.js';
import { buildTurneroSurfaceFleetPack } from '../queue-shared/turnero-surface-fleet-pack.js';
import { mountTurneroSurfaceFleetBanner } from '../queue-shared/turnero-surface-fleet-banner.js';
import { buildTurneroSurfaceAcceptancePack } from '../queue-shared/turnero-surface-acceptance-pack.js';
import { mountTurneroSurfaceAcceptanceBanner } from '../queue-shared/turnero-surface-acceptance-banner.js';
import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from '../queue-shared/clinic-storage.js';
import { buildTurneroSurfaceRuntimeWatch } from '../queue-shared/turnero-surface-runtime-watch.js';
import { buildTurneroSurfaceOpsReadinessPack } from '../queue-shared/turnero-surface-ops-readiness-pack.js';
import { buildTurneroSurfaceOpsSummary } from '../queue-shared/turnero-surface-ops-summary.js';
import { mountTurneroSurfaceIncidentBanner } from '../queue-shared/turnero-surface-incident-banner.js';
import {
    createTurneroSurfaceHandoffLedger,
    resolveTurneroSurfaceHandoffState,
} from '../queue-shared/turnero-surface-handoff-ledger.js';
import { buildTurneroSurfaceSyncPack } from '../queue-shared/turnero-surface-sync-pack.js';
import { buildTurneroSurfaceSyncReadout } from '../queue-shared/turnero-surface-sync-readout.js';
import { mountTurneroSurfaceSyncBanner } from '../queue-shared/turnero-surface-sync-banner.js';
import { mountTurneroSurfaceCheckpointChip } from '../queue-shared/turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceServiceHandoverPack } from '../queue-shared/turnero-surface-service-handover-pack.js';
import { mountTurneroSurfaceServiceHandoverBanner } from '../queue-shared/turnero-surface-service-handover-banner.js';
import { buildTurneroSurfaceOnboardingPack } from '../queue-shared/turnero-surface-onboarding-pack.js';
import { mountTurneroSurfaceOnboardingBanner } from '../queue-shared/turnero-surface-onboarding-banner.js';
import { buildTurneroSurfaceRolloutPack } from '../queue-shared/turnero-surface-rollout-pack.js';
import { mountTurneroSurfaceRolloutBanner } from '../queue-shared/turnero-surface-rollout-banner.js';
import {
    buildTurneroSurfaceIntegrityPack,
    maskTurneroTicket,
} from '../queue-shared/turnero-surface-integrity-pack.js';
import { mountTurneroSurfaceIntegrityBanner } from '../queue-shared/turnero-surface-integrity-banner.js';
import { buildTurneroSurfaceCommercialPack } from '../queue-shared/turnero-surface-commercial-pack.js';
import { buildTurneroSurfaceCommercialReadout } from '../queue-shared/turnero-surface-commercial-readout.js';
import { mountTurneroSurfaceCommercialBanner } from '../queue-shared/turnero-surface-commercial-banner.js';
import { createTurneroSurfaceCommercialLedger } from '../queue-shared/turnero-surface-commercial-ledger.js';
import { createTurneroSurfaceCommercialOwnerStore } from '../queue-shared/turnero-surface-commercial-owner-store.js';
import { createTurneroSurfaceOnboardingLedger } from '../queue-shared/turnero-surface-onboarding-ledger.js';
import { createTurneroSurfaceOnboardingOwnerStore } from '../queue-shared/turnero-surface-onboarding-owner-store.js';
import { buildTurneroSurfacePackagePack } from '../queue-shared/turnero-surface-package-pack.js';
import { mountTurneroSurfacePackageBanner } from '../queue-shared/turnero-surface-package-banner.js';
import { createTurneroSurfacePackageLedger } from '../queue-shared/turnero-surface-package-ledger.js';
import { createTurneroSurfacePackageOwnerStore } from '../queue-shared/turnero-surface-package-owner-store.js';
import { buildTurneroSurfaceRoadmapPack } from '../queue-shared/turnero-surface-roadmap-pack.js';
import { mountTurneroSurfaceRoadmapBanner } from '../queue-shared/turnero-surface-roadmap-banner.js';
import { createTurneroSurfaceRoadmapLedger } from '../queue-shared/turnero-surface-roadmap-ledger.js';
import { createTurneroSurfaceRoadmapOwnerStore } from '../queue-shared/turnero-surface-roadmap-owner-store.js';
import { buildTurneroSurfaceExecutiveReviewPack } from '../queue-shared/turnero-surface-executive-review-pack.js';
import { mountTurneroSurfaceExecutiveReviewBanner } from '../queue-shared/turnero-surface-executive-review-banner.js';
import { createTurneroSurfaceExecutiveReviewLedger } from '../queue-shared/turnero-surface-executive-review-ledger.js';
import { createTurneroSurfaceExecutiveReviewOwnerStore } from '../queue-shared/turnero-surface-executive-review-owner-store.js';
import { createTurneroSurfaceDeploymentTemplateLedger } from '../queue-shared/turnero-surface-deployment-template-ledger.js';
import { buildTurneroSurfaceReplicationPack } from '../queue-shared/turnero-surface-replication-pack.js';
import { buildTurneroSurfaceReplicationReadout } from '../queue-shared/turnero-surface-replication-readout.js';
import { mountTurneroSurfaceReplicationBanner } from '../queue-shared/turnero-surface-replication-banner.js';
import { createTurneroSurfaceReplicationOwnerStore } from '../queue-shared/turnero-surface-replication-owner-store.js';
import { buildTurneroSurfaceSupportPack } from '../queue-shared/turnero-surface-support-pack.js';
import { mountTurneroSurfaceSupportBanner } from '../queue-shared/turnero-surface-support-banner.js';
import { buildTurneroSurfaceRecoveryPack } from '../queue-shared/turnero-surface-recovery-pack.js';
import { buildTurneroSurfaceContractReadout } from '../queue-shared/turnero-surface-contract-readout.js';
import { mountTurneroSurfaceRecoveryBanner } from '../queue-shared/turnero-surface-recovery-banner.js';
import { buildTurneroSurfaceAdoptionPack } from '../queue-shared/turnero-surface-adoption-pack.js';
import { mountTurneroSurfaceAdoptionBanner } from '../queue-shared/turnero-surface-adoption-banner.js';
import { createTurneroSurfaceSuccessLedger } from '../queue-shared/turnero-surface-success-ledger.js';
import { createTurneroSurfaceSuccessOwnerStore } from '../queue-shared/turnero-surface-success-owner-store.js';
import { buildTurneroSurfaceSuccessPack } from '../queue-shared/turnero-surface-success-pack.js';
import { mountTurneroSurfaceSuccessBanner } from '../queue-shared/turnero-surface-success-banner.js';
import { createTurneroSurfaceExpansionLedger } from '../queue-shared/turnero-surface-expansion-ledger.js';
import { createTurneroSurfaceExpansionOwnerStore } from '../queue-shared/turnero-surface-expansion-owner-store.js';
import { buildTurneroSurfaceExpansionPack } from '../queue-shared/turnero-surface-expansion-pack.js';
import { buildTurneroSurfaceExpansionReadout } from '../queue-shared/turnero-surface-expansion-readout.js';
import { mountTurneroSurfaceExpansionBanner } from '../queue-shared/turnero-surface-expansion-banner.js';
import { createTurneroSurfaceDeliveryLedger } from '../queue-shared/turnero-surface-delivery-ledger.js';
import { createTurneroSurfaceDeliveryOwnerStore } from '../queue-shared/turnero-surface-delivery-owner-store.js';
import { buildTurneroSurfaceDeliveryPack } from '../queue-shared/turnero-surface-delivery-pack.js';
import { mountTurneroSurfaceDeliveryBanner } from '../queue-shared/turnero-surface-delivery-banner.js';
import { createTurneroSurfaceRenewalLedger } from '../queue-shared/turnero-surface-renewal-ledger.js';
import { createTurneroSurfaceRenewalOwnerStore } from '../queue-shared/turnero-surface-renewal-owner-store.js';
import { buildTurneroSurfaceRenewalPack } from '../queue-shared/turnero-surface-renewal-pack.js';
import { mountTurneroSurfaceRenewalBanner } from '../queue-shared/turnero-surface-renewal-banner.js';
import {
    getFlowOsRecoveryFreezeNotice,
    shouldFreezeTurneroSurfaceSignal,
} from '../queue-shared/flow-os-recovery-freeze.js';
import { listTurneroSurfaceFallbackDrills } from '../queue-shared/turnero-surface-fallback-drill-store.js';
import { listTurneroSurfaceCheckinLogbook } from '../queue-shared/turnero-surface-checkin-logbook.js';

const API_ENDPOINT = '/api.php';
const POLL_MS = 2500;
const POLL_MAX_MS = 15000;
const POLL_STALE_THRESHOLD_MS = 30000;
const DISPLAY_BELL_MUTED_STORAGE_KEY = 'queueDisplayBellMuted';
const DISPLAY_LAST_SNAPSHOT_STORAGE_KEY = 'queueDisplayLastSnapshot';
const DISPLAY_LAST_SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DISPLAY_ANNOUNCEMENT_STYLE_ID = 'displayAnnouncementInlineStyles';
const DISPLAY_STAR_STYLE_ID = 'displayStarInlineStyles';
const DISPLAY_BELL_FLASH_CLASS = 'display-bell-flash';
const DISPLAY_BELL_FLASH_DURATION_MS = 1300;
const DISPLAY_BELL_COOLDOWN_MS = 1200;
const DISPLAY_BELL_BLOCKED_HINT_COOLDOWN_MS = 20000;
const DISPLAY_HEARTBEAT_MS = 15000;

function hideDisplaySurfaceOpsPanel(panel) {
    if (!panel || typeof panel !== 'object') {
        return null;
    }

    const note = getFlowOsRecoveryFreezeNotice();
    if (panel.host instanceof HTMLElement) {
        panel.host.hidden = true;
        panel.host.dataset.flowOsRecoveryFrozen = 'true';
        panel.host.dataset.flowOsRecoveryNote = note;
    }
    if (panel.bannerHost instanceof HTMLElement) {
        panel.bannerHost.replaceChildren();
    }
    if (panel.chipsHost instanceof HTMLElement) {
        panel.chipsHost.replaceChildren();
    }
    return null;
}

const state = {
    lastCalledSignature: '',
    callBaselineReady: false,
    audioContext: null,
    pollingId: 0,
    clockId: 0,
    pollingEnabled: false,
    failureStreak: 0,
    refreshBusy: false,
    manualRefreshBusy: false,
    lastHealthySyncAt: 0,
    bellMuted: false,
    lastSnapshot: null,
    connectionState: 'paused',
    lastConnectionMessage: '',
    lastRenderedSignature: '',
    bellFlashId: 0,
    lastBellAt: 0,
    lastBellBlockedHintAt: 0,
    bellPrimed: false,
    lastBellSource: '',
    lastBellOutcome: 'idle',
    clinicProfile: null,
    surfaceBootstrap: null,
    lastRenderedState: null,
    surfaceSyncPack: null,
    surfaceGoLivePack: null,
    surfaceFleetPack: null,
    surfaceAcceptancePack: null,
    surfaceSupportPack: null,
    surfacePackagePack: null,
    surfaceRoadmapPack: null,
    surfaceExecutiveReviewPack: null,
    surfaceReplicationPack: null,
    surfaceRenewalPack: null,
    surfaceSuccessPack: null,
    surfaceExpansionPack: null,
    surfaceDeliveryPack: null,
};

let displayHeartbeat = null;

function initDisplayOpsTheme() {
    if (
        window.PielOpsTheme &&
        typeof window.PielOpsTheme.initAutoOpsTheme === 'function'
    ) {
        return window.PielOpsTheme.initAutoOpsTheme({
            surface: 'display',
            family: 'ambient',
            mode: 'system',
        });
    }

    const tone = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light';
    document.documentElement.setAttribute('data-theme-mode', 'system');
    document.documentElement.setAttribute('data-theme', tone);
    document.documentElement.setAttribute('data-ops-tone', tone);
    document.documentElement.setAttribute('data-ops-family', 'ambient');
    if (document.body instanceof HTMLElement) {
        document.body.setAttribute('data-ops-tone', tone);
        document.body.setAttribute('data-ops-family', 'ambient');
    }

    return {
        surface: 'display',
        family: 'ambient',
        mode: 'system',
        tone,
    };
}

function emitQueueOpsEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'display',
                    event: String(eventName || 'unknown'),
                    at: new Date().toISOString(),
                    ...detail,
                },
            })
        );
    } catch (_error) {
        // no-op
    }
}

function getById(id) {
    return document.getElementById(id);
}

function getDisplayConsultorioLabel(consultorio) {
    if (Number(consultorio || 0) !== 1 && Number(consultorio || 0) !== 2) {
        return 'Recepcion';
    }
    return getTurneroConsultorioLabel(state.clinicProfile, consultorio);
}

function getDisplaySurfaceContract(profile = state.clinicProfile) {
    return getTurneroSurfaceContract(profile, 'display');
}

function getDisplaySurfaceCurrentRoute() {
    if (
        typeof window === 'undefined' ||
        !window.location ||
        typeof window.location.pathname !== 'string'
    ) {
        return '';
    }

    return `${window.location.pathname || ''}${window.location.search || ''}${
        window.location.hash || ''
    }`;
}

function getDisplayCommercialScope() {
    return (
        String(
            state.clinicProfile?.region ||
                state.clinicProfile?.branding?.city ||
                'regional'
        ).trim() || 'regional'
    );
}

function ensureDisplaySurfaceCommercialPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-commercial="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceCommercial = 'true';
        host.className = 'turnero-surface-ops__stack';
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-integrity="true"]'
        );
        if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else {
            const opsHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-ops="true"]'
            );
            if (opsHost instanceof HTMLElement) {
                opsHost.insertAdjacentElement('afterend', host);
            } else {
                statusNode.insertAdjacentElement('afterend', host);
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    let adoptionHost = host.querySelector('[data-role="adoption"]');
    if (!(adoptionHost instanceof HTMLElement)) {
        adoptionHost = document.createElement('div');
        adoptionHost.dataset.role = 'adoption';
        adoptionHost.className = 'turnero-surface-ops__stack';
        host.appendChild(adoptionHost);
    }

    let adoptionBannerHost = adoptionHost.querySelector(
        '[data-role="adoption-banner"]'
    );
    if (!(adoptionBannerHost instanceof HTMLElement)) {
        adoptionBannerHost = document.createElement('div');
        adoptionBannerHost.dataset.role = 'adoption-banner';
        adoptionHost.appendChild(adoptionBannerHost);
    }

    let adoptionChipsHost = adoptionHost.querySelector(
        '[data-role="adoption-chips"]'
    );
    if (!(adoptionChipsHost instanceof HTMLElement)) {
        adoptionChipsHost = document.createElement('div');
        adoptionChipsHost.dataset.role = 'adoption-chips';
        adoptionChipsHost.className = 'turnero-surface-ops__chips';
        adoptionHost.appendChild(adoptionChipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
        adoptionHost,
        adoptionBannerHost,
        adoptionChipsHost,
    };
}

function buildDisplaySurfaceCommercialPack() {
    const scope = getDisplayCommercialScope();
    const ledgerStore = createTurneroSurfaceCommercialLedger(
        scope,
        state.clinicProfile
    );
    const ownerStore = createTurneroSurfaceCommercialOwnerStore(
        scope,
        state.clinicProfile
    );
    const pack = buildTurneroSurfaceCommercialPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-display',
        scopeState: 'ready',
        pricingState: 'ready',
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'sala-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'sala-turnos' }),
    });

    return {
        ...pack,
        readout: buildTurneroSurfaceCommercialReadout({
            snapshot: pack.snapshot,
            gate: pack.gate,
        }),
    };
}

function renderDisplaySurfaceCommercialState() {
    const panel = ensureDisplaySurfaceCommercialPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildDisplaySurfaceCommercialPack();
    state.surfaceCommercialPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceCommercialBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Display surface commercial',
    });
    panel.chipsHost.replaceChildren();
    [
        {
            label: 'tier',
            value: pack.readout.packageTier,
            state:
                pack.readout.packageTier === 'pilot-plus' ? 'ready' : 'warning',
        },
        {
            label: 'commercial',
            value: pack.readout.gateBand,
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
        {
            label: 'score',
            value: String(pack.readout.gateScore || 0),
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceRenewalState();
    renderDisplaySurfaceSuccessState();
    renderDisplaySurfaceReplicationState();
    return pack;
}

function getDisplaySurfaceReplicationScope() {
    return getDisplayCommercialScope();
}

function getDisplaySurfaceSuccessScope() {
    return getDisplayCommercialScope();
}

function getDisplaySurfaceRenewalScope() {
    return getDisplayCommercialScope();
}

function ensureDisplaySurfaceRenewalPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-renewal="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceRenewal = 'true';
        host.className = 'turnero-surface-ops__stack';
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-ops="true"]'
        );
        if (commercialHost instanceof HTMLElement) {
            commercialHost.insertAdjacentElement('afterend', host);
        } else if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else if (opsHost instanceof HTMLElement) {
            opsHost.insertAdjacentElement('afterend', host);
        } else {
            statusNode.insertAdjacentElement('afterend', host);
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function ensureDisplaySurfaceSuccessPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-success="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceSuccess = 'true';
        host.className = 'turnero-surface-ops__stack';
        const renewalHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-renewal="true"]'
        );
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-ops="true"]'
        );
        if (renewalHost instanceof HTMLElement) {
            renewalHost.insertAdjacentElement('afterend', host);
        } else if (commercialHost instanceof HTMLElement) {
            commercialHost.insertAdjacentElement('afterend', host);
        } else if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else if (opsHost instanceof HTMLElement) {
            opsHost.insertAdjacentElement('afterend', host);
        } else {
            statusNode.insertAdjacentElement('afterend', host);
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceSuccessPack() {
    const scope = getDisplaySurfaceSuccessScope();
    const ledgerStore = createTurneroSurfaceSuccessLedger(
        scope,
        state.clinicProfile
    );
    const ownerStore = createTurneroSurfaceSuccessOwnerStore(
        scope,
        state.clinicProfile
    );
    const pack = buildTurneroSurfaceSuccessPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        adoptionState: 'ready',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-display',
        followupWindow: 'mensual',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'sala-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'sala-turnos' }),
    });

    return pack;
}

function buildDisplaySurfaceRenewalPack() {
    const scope = getDisplaySurfaceRenewalScope();
    const ledgerStore = createTurneroSurfaceRenewalLedger(
        scope,
        state.clinicProfile
    );
    const ownerStore = createTurneroSurfaceRenewalOwnerStore(
        scope,
        state.clinicProfile
    );
    return buildTurneroSurfaceRenewalPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
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
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'sala-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'sala-turnos' }),
    });
}

function renderDisplaySurfaceRenewalState() {
    const panel = ensureDisplaySurfaceRenewalPanel();
    if (!panel) {
        return null;
    }

    if (shouldFreezeTurneroSurfaceSignal('renewal')) {
        state.surfaceRenewalPack = null;
        return hideDisplaySurfaceOpsPanel(panel);
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        state.surfaceRenewalPack = null;
        return null;
    }

    const pack = buildDisplaySurfaceRenewalPack();
    state.surfaceRenewalPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceRenewalBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Display surface renewal',
        eyebrow: 'Renewal retention',
    });
    panel.chipsHost.replaceChildren();
    pack.readout.chips.forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });

    return pack;
}

function renderDisplaySurfaceSuccessState() {
    const panel = ensureDisplaySurfaceSuccessPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        state.surfaceSuccessPack = null;
        renderDisplaySurfaceExpansionState();
        return null;
    }

    const pack = buildDisplaySurfaceSuccessPack();
    state.surfaceSuccessPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceSuccessBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Display surface success',
        eyebrow: 'Customer success',
    });
    panel.chipsHost.replaceChildren();
    pack.readout.chips.forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceExpansionState();

    return pack;
}

function getDisplaySurfaceExpansionScope() {
    return getDisplayCommercialScope();
}

function getDisplaySurfaceDeliveryScope() {
    return getDisplayCommercialScope();
}

function ensureDisplaySurfaceExpansionPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-expansion="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceExpansion = 'true';
        host.className = 'turnero-surface-ops__stack';
        const successHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-success="true"]'
        );
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-ops="true"]'
        );
        if (successHost instanceof HTMLElement) {
            successHost.insertAdjacentElement('afterend', host);
        } else if (commercialHost instanceof HTMLElement) {
            commercialHost.insertAdjacentElement('afterend', host);
        } else if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else if (opsHost instanceof HTMLElement) {
            opsHost.insertAdjacentElement('afterend', host);
        } else {
            statusNode.insertAdjacentElement('afterend', host);
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceExpansionPack(inputState = state) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const scope = getDisplaySurfaceExpansionScope();
    const ledgerStore = createTurneroSurfaceExpansionLedger(
        scope,
        resolvedInputState.clinicProfile
    );
    const ownerStore = createTurneroSurfaceExpansionOwnerStore(
        scope,
        resolvedInputState.clinicProfile
    );
    return buildTurneroSurfaceExpansionPack({
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        runtimeState:
            resolvedInputState?.lastRenderedState?.state ||
            resolvedInputState?.connectionState ||
            'ready',
        truth: resolvedInputState?.lastRenderedState ? 'aligned' : 'watch',
        opportunityState: 'ready',
        demandSignal: 'medium',
        gapState: 'voice-announcer',
        expansionOwner: 'ops-display',
        nextModuleHint: 'analytics-board',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'display' }),
        owners: ownerStore.list({ surfaceKey: 'display' }),
    });
}

function buildDisplaySurfaceDeliveryPack(inputState = state, runtimeState = null) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const scope = getDisplaySurfaceDeliveryScope();
    const ledgerStore = createTurneroSurfaceDeliveryLedger(
        scope,
        resolvedInputState.clinicProfile
    );
    const ownerStore = createTurneroSurfaceDeliveryOwnerStore(
        scope,
        resolvedInputState.clinicProfile
    );
    return buildTurneroSurfaceDeliveryPack({
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        runtimeState:
            runtimeState?.state ||
            resolvedInputState?.lastRenderedState?.state ||
            resolvedInputState?.connectionState ||
            'ready',
        truth: resolvedInputState?.lastRenderedState ? 'aligned' : 'watch',
        targetWindow: resolvedInputState?.pollingEnabled ? '24h' : 'next-sync',
        dependencyState: 'ready',
        blockerState: 'clear',
        deliveryOwner: 'ops-display',
        releaseOwner: 'release-lead',
        opsOwner: 'av-ops',
        checklist: {
            summary: {
                all: 5,
                pass: 5,
                fail: 0,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'display' }),
        owners: ownerStore.list({ surfaceKey: 'display' }),
    });
}

function renderDisplaySurfaceDeliveryState(runtimeState = null, target = null) {
    const host =
        target instanceof HTMLElement
            ? target
            : getById('displaySurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const deliveryHost =
        target instanceof HTMLElement
            ? host
            : document.createElement('section');
    deliveryHost.className =
        'turnero-surface-delivery-stack turnero-surface-ops__stack';
    if (!(target instanceof HTMLElement)) {
        host.appendChild(deliveryHost);
    }
    deliveryHost.replaceChildren();

    if (shouldFreezeTurneroSurfaceSignal('delivery')) {
        state.surfaceDeliveryPack = null;
        return null;
    }

    if (!state.clinicProfile) {
        state.surfaceDeliveryPack = null;
        return null;
    }

    const pack = buildDisplaySurfaceDeliveryPack(state, runtimeState);
    state.surfaceDeliveryPack = pack;
    mountTurneroSurfaceDeliveryBanner(deliveryHost, {
        pack,
        title: 'Display surface delivery',
        eyebrow: 'Delivery gate',
    });

    const chips = document.createElement('div');
    chips.className = 'turnero-surface-ops__chips';
    deliveryHost.appendChild(chips);
    (pack.readout?.checkpoints || []).slice(0, 3).forEach((chip) => {
        const chipNode = document.createElement('span');
        chips.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });

    return pack;
}

function renderDisplaySurfaceExpansionState(inputState = state) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const panel = ensureDisplaySurfaceExpansionPanel();
    if (!panel) {
        return null;
    }

    if (shouldFreezeTurneroSurfaceSignal('expansion')) {
        resolvedInputState.surfaceExpansionPack = null;
        return hideDisplaySurfaceOpsPanel(panel);
    }

    if (!resolvedInputState.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        resolvedInputState.surfaceExpansionPack = null;
        return null;
    }

    const pack = buildDisplaySurfaceExpansionPack(resolvedInputState);
    const readout = buildTurneroSurfaceExpansionReadout({
        snapshot: pack.snapshot,
        gate: pack.gate,
        checklist: pack.checklist,
        ledger: pack.ledger,
        owners: pack.owners,
    });
    resolvedInputState.surfaceExpansionPack = {
        ...pack,
        readout,
    };
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceExpansionBanner(panel.bannerHost, {
        pack: resolvedInputState.surfaceExpansionPack,
        readout,
        title: 'Display surface expansion',
        eyebrow: 'Expansion gate',
    });
    panel.chipsHost.replaceChildren();
    const checkpoints = Array.isArray(readout.checkpoints)
        ? readout.checkpoints
        : [];
    checkpoints.slice(0, 3).forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    return resolvedInputState.surfaceExpansionPack;
}

function ensureDisplaySurfaceReplicationPanel() {
    const host = getById('displaySurfaceReplicationHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    if (!host.className.includes('turnero-surface-ops__stack')) {
        host.className = `${host.className} turnero-surface-ops__stack`.trim();
    }
    host.dataset.turneroDisplaySurfaceReplication = 'true';

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceReplicationPack() {
    const scope = getDisplaySurfaceReplicationScope();
    const templateLedger = createTurneroSurfaceDeploymentTemplateLedger(
        scope,
        state.clinicProfile
    );
    const ownerStore = createTurneroSurfaceReplicationOwnerStore(
        scope,
        state.clinicProfile
    );
    const pack = buildTurneroSurfaceReplicationPack({
        surfaceKey: 'sala-turnos',
        surfaceLabel:
            state.clinicProfile?.surfaces?.display?.label || 'Turnero Sala TV',
        clinicProfile: state.clinicProfile,
        runtimeState: 'ready',
        truth: 'aligned',
        templateState: 'ready',
        assetProfile: 'tv + audio',
        replicationOwner: 'ops-display',
        installTimeBucket: 'half-day',
        documentationState: 'ready',
        templates: templateLedger.list({ surfaceKey: 'sala-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'sala-turnos' }),
    });

    return {
        ...pack,
        readout: buildTurneroSurfaceReplicationReadout({
            snapshot: pack.snapshot,
            checklist: pack.checklist,
            gate: pack.gate,
            templates: pack.templates,
            owners: pack.owners,
        }),
    };
}

function renderDisplaySurfaceReplicationState() {
    const panel = ensureDisplaySurfaceReplicationPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildDisplaySurfaceReplicationPack();
    state.surfaceReplicationPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceReplicationBanner(panel.bannerHost, {
        snapshot: pack.snapshot,
        checklist: pack.checklist,
        gate: pack.gate,
        templates: pack.templates,
        owners: pack.owners,
        title: 'Display surface replication',
    });
    panel.chipsHost.replaceChildren();
    [
        {
            label: 'template',
            value: pack.readout.templateState,
            state: pack.readout.templateState === 'ready' ? 'ready' : 'warning',
        },
        {
            label: 'replication',
            value: pack.readout.gateBand,
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
        {
            label: 'score',
            value: String(pack.readout.gateScore || 0),
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    return pack;
}

function ensureDisplaySurfaceOpsPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-ops="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceOps = 'true';
        host.className = 'turnero-surface-ops__stack';
        statusNode.insertAdjacentElement('afterend', host);
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    let adoptionHost = host.querySelector('[data-role="adoption"]');
    if (!(adoptionHost instanceof HTMLElement)) {
        adoptionHost = document.createElement('div');
        adoptionHost.dataset.role = 'adoption';
        adoptionHost.className = 'turnero-surface-ops__stack';
        host.appendChild(adoptionHost);
    }

    let adoptionBannerHost = adoptionHost.querySelector(
        '[data-role="adoption-banner"]'
    );
    if (!(adoptionBannerHost instanceof HTMLElement)) {
        adoptionBannerHost = document.createElement('div');
        adoptionBannerHost.dataset.role = 'adoption-banner';
        adoptionHost.appendChild(adoptionBannerHost);
    }

    let adoptionChipsHost = adoptionHost.querySelector(
        '[data-role="adoption-chips"]'
    );
    if (!(adoptionChipsHost instanceof HTMLElement)) {
        adoptionChipsHost = document.createElement('div');
        adoptionChipsHost.dataset.role = 'adoption-chips';
        adoptionChipsHost.className = 'turnero-surface-ops__chips';
        adoptionHost.appendChild(adoptionChipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
        adoptionHost,
        adoptionBannerHost,
        adoptionChipsHost,
    };
}

function buildDisplaySurfaceOpsTelemetryEntry(now = Date.now()) {
    const heartbeatPayload = buildDisplayHeartbeatPayload();
    const heartbeatClient = ensureDisplayHeartbeat();
    const lastSentAt = Number(heartbeatClient?.getLastSentAt?.() || 0);
    const ageSeconds =
        lastSentAt > 0
            ? Math.max(0, Math.round((now - lastSentAt) / 1000))
            : null;
    const staleThresholdSeconds = Math.max(
        45,
        Math.round(DISPLAY_HEARTBEAT_MS / 1000) * 3
    );

    return {
        status: heartbeatPayload.status,
        stale:
            Number.isFinite(ageSeconds) && ageSeconds >= staleThresholdSeconds,
        summary: heartbeatPayload.summary,
        clinicId: heartbeatPayload.clinicId,
        profileFingerprint: heartbeatPayload.profileFingerprint,
        surfaceContractState: heartbeatPayload.surfaceContractState,
        surfaceRouteExpected: heartbeatPayload.surfaceRouteExpected,
        surfaceRouteCurrent: heartbeatPayload.surfaceRouteCurrent,
        latest: {
            ageSec: ageSeconds,
            lastEventAt: heartbeatPayload.lastEventAt,
            reportedAt:
                lastSentAt > 0
                    ? new Date(lastSentAt).toISOString()
                    : heartbeatPayload.lastEventAt,
            details:
                heartbeatPayload.details &&
                typeof heartbeatPayload.details === 'object'
                    ? heartbeatPayload.details
                    : {},
        },
    };
}

function renderDisplaySurfaceOps() {
    const panel = ensureDisplaySurfaceOpsPanel();
    if (!panel) {
        return;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        renderDisplaySurfaceGoLiveState();
        renderDisplaySurfaceFleetState();
        return;
    }

    const now = Date.now();
    const drills = listTurneroSurfaceFallbackDrills({
        clinicProfile: state.clinicProfile,
        surface: 'display',
    });
    const logbook = listTurneroSurfaceCheckinLogbook({
        clinicProfile: state.clinicProfile,
        surface: 'display',
    });
    const currentRoute = getDisplaySurfaceCurrentRoute();
    const watch = buildTurneroSurfaceRuntimeWatch({
        surface: 'display',
        telemetryEntry: buildDisplaySurfaceOpsTelemetryEntry(now),
        clinicProfile: state.clinicProfile,
        now,
    });
    const readiness = buildTurneroSurfaceOpsReadinessPack({
        surface: 'display',
        watch,
        drills,
        logbook,
        now,
    });
    const summary = buildTurneroSurfaceOpsSummary({
        surface: 'display',
        watch,
        readiness,
        drills,
        logbook,
    });
    const adoptionPack = buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'sala-turnos',
        surfaceId: 'sala_tv',
        role: 'display',
        roleLabel: 'Pantalla',
        handoffMode: 'broadcast',
        currentRoute,
        clinicProfile: state.clinicProfile,
        scope:
            state.clinicProfile?.region ||
            state.clinicProfile?.branding?.city ||
            'regional',
    });

    panel.host.hidden = false;
    mountTurneroSurfaceIncidentBanner(panel.bannerHost, {
        surface: 'display',
        watch,
        readiness,
        summary,
    });
    panel.chipsHost.replaceChildren();
    [
        {
            label: 'Ops',
            value: summary.opsChipValue,
            state: summary.opsChipState,
        },
        {
            label: 'Heartbeat',
            value: summary.heartbeatChipValue,
            state: summary.heartbeatChipState,
        },
        {
            label: 'Score',
            value: summary.scoreLabel,
            state: summary.scoreState,
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    mountTurneroSurfaceAdoptionBanner(panel.adoptionBannerHost, {
        title: 'Turnero Sala',
        eyebrow: 'Adoption',
        pack: adoptionPack,
    });
    panel.adoptionChipsHost.replaceChildren();
    adoptionPack.chips.forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.adoptionChipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceGoLiveState();
    renderDisplaySurfaceFleetState();
}

function ensureDisplaySurfaceIntegrityPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-integrity="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceIntegrity = 'true';
        host.className = 'turnero-surface-ops__stack';
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-ops="true"]'
        );
        if (opsHost instanceof HTMLElement) {
            opsHost.insertAdjacentElement('afterend', host);
        } else {
            statusNode.insertAdjacentElement('afterend', host);
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return { host, bannerHost, chipsHost };
}

function buildDisplaySurfaceIntegrityPack() {
    const queueState = normalizeQueueStatePayload(
        state.lastRenderedState || {}
    );
    const callingNow = Array.isArray(queueState.callingNow)
        ? queueState.callingNow
        : [];
    const nextTickets = Array.isArray(queueState.nextTickets)
        ? queueState.nextTickets
        : [];
    const byConsultorio = {
        1: null,
        2: null,
    };
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            byConsultorio[consultorio] = ticket;
        }
    }
    const primaryCallingTicket = selectPrimaryCallingTicket(
        callingNow,
        byConsultorio
    );
    const visibleTurn = String(
        primaryCallingTicket?.ticketCode ||
            nextTickets[0]?.ticketCode ||
            'A-202'
    )
        .trim()
        .toUpperCase();
    const announcedTurn = String(
        nextTickets[0]?.ticketCode ||
            primaryCallingTicket?.ticketCode ||
            'A-201'
    )
        .trim()
        .toUpperCase();
    const ticketDisplay = visibleTurn.replace(/[^A-Z0-9]/g, '') || 'A202';

    return buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'sala-turnos',
        queueVersion: String(queueState.updatedAt || '').trim(),
        visibleTurn,
        announcedTurn,
        ticketDisplay,
        maskedTicket: maskTurneroTicket(ticketDisplay, 'masked') || 'A**2',
        privacyMode: 'masked',
        heartbeat: {
            state: resolveDisplaySurfaceSyncHeartbeatState(),
            channel: resolveDisplaySurfaceSyncHeartbeatChannel(),
        },
        evidence: [],
    });
}

function ensureDisplaySurfaceServiceHandoverPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-service-handover="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceServiceHandover = 'true';
        host.className = 'turnero-surface-ops__stack';
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-ops="true"]'
        );
        if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else if (opsHost instanceof HTMLElement) {
            opsHost.insertAdjacentElement('afterend', host);
        } else {
            statusNode.insertAdjacentElement('afterend', host);
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return { host, bannerHost, chipsHost };
}

function buildDisplaySurfaceServiceHandoverPack() {
    return buildTurneroSurfaceServiceHandoverPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
        scope:
            state.clinicProfile?.region ||
            state.clinicProfile?.branding?.city ||
            'regional',
    });
}

function renderDisplaySurfaceServiceHandoverState() {
    const panel = ensureDisplaySurfaceServiceHandoverPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildDisplaySurfaceServiceHandoverPack();
    state.surfaceServiceHandoverPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceServiceHandoverBanner(panel.bannerHost, {
        pack,
        title: 'Display surface service handover',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.chips) ? pack.readout.chips : []).forEach(
        (chip) => {
            const chipNode = document.createElement('span');
            panel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        }
    );
    return pack;
}

function getDisplaySurfaceOnboardingScope() {
    return getDisplayCommercialScope();
}

function ensureDisplaySurfaceOnboardingPanel() {
    let host = getById('displaySurfaceOnboardingHost');
    if (!(host instanceof HTMLElement)) {
        const statusNode = getById('displayProfileStatus');
        if (!(statusNode instanceof HTMLElement)) {
            return null;
        }

        host = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-onboarding="true"]'
        );
        if (!(host instanceof HTMLElement)) {
            host = document.createElement('div');
            host.dataset.turneroDisplaySurfaceOnboarding = 'true';
            host.className = 'turnero-surface-ops__stack';
            const serviceHandoverHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-service-handover="true"]'
            );
            const integrityHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-integrity="true"]'
            );
            if (serviceHandoverHost instanceof HTMLElement) {
                serviceHandoverHost.insertAdjacentElement('afterend', host);
            } else if (integrityHost instanceof HTMLElement) {
                integrityHost.insertAdjacentElement('afterend', host);
            } else {
                statusNode.insertAdjacentElement('afterend', host);
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return { host, bannerHost, chipsHost };
}

function buildDisplaySurfaceOnboardingPack() {
    const scope = getDisplaySurfaceOnboardingScope();
    const ledgerStore = createTurneroSurfaceOnboardingLedger(
        scope,
        state.clinicProfile
    );
    const ownerStore = createTurneroSurfaceOnboardingOwnerStore(
        scope,
        state.clinicProfile
    );

    return buildTurneroSurfaceOnboardingPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
        scope,
        runtimeState: 'ready',
        truth: 'aligned',
        kickoffState: 'ready',
        dataIntakeState: 'ready',
        accessState: 'ready',
        onboardingOwner: 'ops-display',
        trainingWindow: 'miercoles 08:00',
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'sala-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'sala-turnos' }),
    });
}

function renderDisplaySurfaceOnboardingState() {
    const panel = ensureDisplaySurfaceOnboardingPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildDisplaySurfaceOnboardingPack();
    state.surfaceOnboardingPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceOnboardingBanner(panel.bannerHost, {
        pack,
        title: 'Display surface onboarding',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.chips) ? pack.readout.chips : []).forEach(
        (chip) => {
            const chipNode = document.createElement('span');
            panel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        }
    );
    return pack;
}

function renderDisplaySurfaceIntegrityState() {
    const panel = ensureDisplaySurfaceIntegrityPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildDisplaySurfaceIntegrityPack();
    state.surfaceIntegrityPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceIntegrityBanner(panel.bannerHost, {
        pack,
        title: 'Display surface integrity',
    });
    panel.chipsHost.replaceChildren();
    [
        {
            label: 'Turn',
            value: pack.snapshot.visibleTurn || 'none',
            state:
                pack.drift.state === 'aligned'
                    ? 'ready'
                    : pack.drift.state === 'watch'
                      ? 'warning'
                      : 'alert',
        },
        {
            label: 'Mask',
            value: pack.maskState.maskedTicket || pack.maskState.state,
            state:
                pack.maskState.state === 'protected'
                    ? 'ready'
                    : pack.maskState.state === 'open'
                      ? 'warning'
                      : pack.maskState.state === 'watch'
                        ? 'warning'
                        : 'alert',
        },
        {
            label: 'Gate',
            value: `${pack.gate.band} · ${pack.gate.score}`,
            state:
                pack.gate.band === 'ready'
                    ? 'ready'
                    : pack.gate.band === 'watch'
                      ? 'warning'
                      : 'alert',
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    return pack;
}

function ensureDisplaySurfaceGoLivePanel() {
    const syncHost = getById('displaySurfaceSyncHost');
    if (!(syncHost instanceof HTMLElement)) {
        return null;
    }

    let host = syncHost.parentElement?.querySelector(
        '[data-turnero-display-surface-go-live="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceGoLive = 'true';
        host.className = 'turnero-surface-ops__stack';
        syncHost.insertAdjacentElement('afterend', host);
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return { host, bannerHost, chipsHost };
}

function getDisplaySurfaceGoLiveScope() {
    return 'display';
}

function getDisplaySurfaceFleetScope() {
    return (
        String(state.clinicProfile?.region || 'regional').trim() || 'regional'
    );
}

function buildDisplaySurfaceGoLivePack() {
    const heartbeatPayload = buildDisplayHeartbeatPayload();
    const surfaceContract =
        getDisplaySurfaceContract(state.clinicProfile) ||
        getTurneroSurfaceContract(state.clinicProfile, 'display');
    const snapshot = buildTurneroSurfaceGoLiveSnapshot({
        scope: getDisplaySurfaceGoLiveScope(),
        surfaceKey: 'display',
        surfaceLabel: 'Sala TV',
        clinicProfile: state.clinicProfile,
        runtimeState: String(heartbeatPayload.status || 'unknown').trim(),
        truth: String(
            heartbeatPayload.details?.surfaceContractState ||
                surfaceContract.state ||
                heartbeatPayload.status ||
                'unknown'
        ).trim(),
        printerState: state.lastSnapshot ? 'ready' : 'watch',
        bellState: heartbeatPayload.details?.bellPrimed ? 'ready' : 'watch',
        signageState:
            heartbeatPayload.details?.surfaceRouteCurrent &&
            heartbeatPayload.details?.surfaceRouteExpected &&
            heartbeatPayload.details.surfaceRouteCurrent ===
                heartbeatPayload.details.surfaceRouteExpected
                ? 'ready'
                : 'watch',
        operatorReady:
            heartbeatPayload.status === 'ready' ||
            Boolean(
                heartbeatPayload.details?.connection === 'live' &&
                heartbeatPayload.details?.bellPrimed &&
                !heartbeatPayload.details?.bellMuted
            ),
        updatedAt: String(
            heartbeatPayload.lastEventAt || state.lastBellAt || ''
        ).trim(),
    });
    const ledger = createTurneroSurfaceGoLiveLedger(
        snapshot.scope,
        state.clinicProfile
    );

    return buildTurneroSurfaceGoLivePack({
        ...snapshot,
        clinicProfile: state.clinicProfile,
        evidence: ledger.list({ surfaceKey: snapshot.surfaceKey }),
    });
}

function renderDisplaySurfaceGoLiveState() {
    const panel = ensureDisplaySurfaceGoLivePanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildDisplaySurfaceGoLivePack();
    state.surfaceGoLivePack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceGoLiveBanner(panel.bannerHost, {
        pack,
    });
    panel.chipsHost.replaceChildren();
    pack.checklist.checks.forEach((check) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, {
            label: check.label,
            value: check.pass ? 'Listo' : 'Pendiente',
            state: check.pass ? 'ready' : 'alert',
        });
    });
    return pack;
}

function ensureDisplaySurfaceFleetPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-fleet="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceFleet = 'true';
        host.className = 'turnero-surface-ops__stack';
        const supportHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-support="true"]'
        );
        if (supportHost instanceof HTMLElement) {
            supportHost.insertAdjacentElement('afterend', host);
        } else {
            const goLiveHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-go-live="true"]'
            );
            if (goLiveHost instanceof HTMLElement) {
                goLiveHost.insertAdjacentElement('afterend', host);
            } else {
                const integrityHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-display-surface-integrity="true"]'
                );
                if (integrityHost instanceof HTMLElement) {
                    integrityHost.insertAdjacentElement('afterend', host);
                } else {
                    const opsHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-display-surface-ops="true"]'
                    );
                    if (opsHost instanceof HTMLElement) {
                        opsHost.insertAdjacentElement('afterend', host);
                    } else {
                        statusNode.insertAdjacentElement('afterend', host);
                    }
                }
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return { host, bannerHost, chipsHost };
}

function buildDisplaySurfaceFleetPack() {
    const goLiveBand = state.surfaceGoLivePack?.gate?.band || 'watch';
    return buildTurneroSurfaceFleetPack({
        surfaceKey: 'display',
        scope: getDisplaySurfaceFleetScope(),
        clinicProfile: state.clinicProfile,
        runtimeState: goLiveBand,
        truth: goLiveBand === 'ready' ? 'aligned' : 'watch',
    });
}

function renderDisplaySurfaceFleetState() {
    const panel = ensureDisplaySurfaceFleetPanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildDisplaySurfaceFleetPack();
    state.surfaceFleetPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceFleetBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Surface Fleet Readiness',
    });
    panel.chipsHost.replaceChildren();
    [
        {
            label: 'Wave',
            value: pack.readout.waveLabel || 'none',
            state: pack.readout.waveLabel ? 'ready' : 'warning',
        },
        {
            label: 'Fleet',
            value: pack.readout.gateBand,
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
        {
            label: 'Score',
            value: String(pack.readout.gateScore || 0),
            state:
                pack.readout.gateBand === 'ready'
                    ? 'ready'
                    : pack.readout.gateBand === 'watch'
                      ? 'warning'
                      : 'alert',
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    return pack;
}

function ensureDisplaySurfaceSupportPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-support="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceSupport = 'true';
        host.className = 'turnero-surface-ops__stack';
        const goLiveHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-go-live="true"]'
        );
        if (goLiveHost instanceof HTMLElement) {
            goLiveHost.insertAdjacentElement('afterend', host);
        } else {
            const integrityHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-integrity="true"]'
            );
            if (integrityHost instanceof HTMLElement) {
                integrityHost.insertAdjacentElement('afterend', host);
            } else {
                const opsHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-display-surface-ops="true"]'
                );
                if (opsHost instanceof HTMLElement) {
                    opsHost.insertAdjacentElement('afterend', host);
                } else {
                    statusNode.insertAdjacentElement('afterend', host);
                }
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceSupportPack(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const currentRoute =
        typeof window !== 'undefined' && window.location
            ? `${window.location.pathname || ''}${window.location.hash || ''}`
            : '';
    return buildTurneroSurfaceSupportPack({
        scope: 'queue-support',
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        currentRoute,
        runtimeState: resolvedInputState?.lastRenderedState || null,
    });
}

function renderDisplaySurfaceSupportState(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const panel = ensureDisplaySurfaceSupportPanel();
    if (!panel) {
        return null;
    }

    if (!resolvedInputState.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        renderDisplaySurfacePackageState(resolvedInputState);
        return null;
    }

    const pack = buildDisplaySurfaceSupportPack(resolvedInputState);
    resolvedInputState.surfaceSupportPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceSupportBanner(panel.bannerHost, {
        pack,
        title: 'Display surface support',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.chips) ? pack.readout.chips : []).forEach(
        (chip) => {
            const chipNode = document.createElement('span');
            panel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        }
    );
    const executiveReviewPanel = ensureDisplaySurfaceExecutiveReviewPanel();
    if (executiveReviewPanel) {
        const executiveReviewPack = buildDisplaySurfaceExecutiveReviewPack(
            resolvedInputState
        );
        resolvedInputState.surfaceExecutiveReviewPack = executiveReviewPack;
        executiveReviewPanel.host.hidden = false;
        executiveReviewPanel.host.dataset.state = executiveReviewPack.gate.band;
        executiveReviewPanel.host.dataset.band = executiveReviewPack.gate.band;
        executiveReviewPanel.bannerHost.replaceChildren();
        mountTurneroSurfaceExecutiveReviewBanner(
            executiveReviewPanel.bannerHost,
            {
                pack: executiveReviewPack,
                title: 'Display surface executive review',
                eyebrow: 'Executive review gate',
            }
        );
        executiveReviewPanel.chipsHost.replaceChildren();
        (Array.isArray(executiveReviewPack.readout?.checkpoints)
            ? executiveReviewPack.readout.checkpoints
            : []
        ).forEach((chip) => {
            const chipNode = document.createElement('span');
            executiveReviewPanel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        });
    }
    renderDisplaySurfacePackageState(resolvedInputState);
    return pack;
}

function getDisplaySurfacePackageScope() {
    return getDisplayCommercialScope();
}

function ensureDisplaySurfacePackagePanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-package="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfacePackage = 'true';
        host.className = 'turnero-surface-ops__stack';
        const supportHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-support="true"]'
        );
        if (supportHost instanceof HTMLElement) {
            supportHost.insertAdjacentElement('afterend', host);
        } else {
            const goLiveHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-go-live="true"]'
            );
            if (goLiveHost instanceof HTMLElement) {
                goLiveHost.insertAdjacentElement('afterend', host);
            } else {
                const integrityHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-display-surface-integrity="true"]'
                );
                if (integrityHost instanceof HTMLElement) {
                    integrityHost.insertAdjacentElement('afterend', host);
                } else {
                    const opsHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-display-surface-ops="true"]'
                    );
                    if (opsHost instanceof HTMLElement) {
                        opsHost.insertAdjacentElement('afterend', host);
                    } else {
                        statusNode.insertAdjacentElement('afterend', host);
                    }
                }
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfacePackagePack(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const scope = getDisplaySurfacePackageScope();
    const ledgerStore = createTurneroSurfacePackageLedger(
        scope,
        resolvedInputState.clinicProfile
    );
    const ownerStore = createTurneroSurfacePackageOwnerStore(
        scope,
        resolvedInputState.clinicProfile
    );
    const pack = buildTurneroSurfacePackagePack({
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        runtimeState:
            resolvedInputState?.lastRenderedState?.state ||
            resolvedInputState?.connectionState ||
            'ready',
        truth: resolvedInputState?.lastRenderedState ? 'aligned' : 'watch',
        packageTier: 'pilot-plus',
        bundleState: 'ready',
        provisioningState: 'watch',
        onboardingKitState: 'draft',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'display' }),
        owners: ownerStore.list({ surfaceKey: 'display' }),
    });

    return {
        ...pack,
    };
}

function renderDisplaySurfacePackageState(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const panel = ensureDisplaySurfacePackagePanel();
    if (!panel) {
        return null;
    }

    if (!resolvedInputState.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        resolvedInputState.surfacePackagePack = null;
        renderDisplaySurfaceRoadmapState(resolvedInputState);
        return null;
    }

    const pack = buildDisplaySurfacePackagePack(resolvedInputState);
    resolvedInputState.surfacePackagePack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfacePackageBanner(panel.bannerHost, {
        pack,
        title: 'Display surface package',
        eyebrow: 'Package gate',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.checkpoints)
        ? pack.readout.checkpoints
        : []
    ).forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceRoadmapState(resolvedInputState);
    return pack;
}

function getDisplaySurfaceRoadmapScope() {
    return getDisplayCommercialScope();
}

function ensureDisplaySurfaceRoadmapPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-roadmap="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceRoadmap = 'true';
        host.className = 'turnero-surface-ops__stack';
        const packageHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-package="true"]'
        );
        if (packageHost instanceof HTMLElement) {
            packageHost.insertAdjacentElement('afterend', host);
        } else {
            const supportHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-support="true"]'
            );
            if (supportHost instanceof HTMLElement) {
                supportHost.insertAdjacentElement('afterend', host);
            } else {
                const goLiveHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-display-surface-go-live="true"]'
                );
                if (goLiveHost instanceof HTMLElement) {
                    goLiveHost.insertAdjacentElement('afterend', host);
                } else {
                    const integrityHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-display-surface-integrity="true"]'
                    );
                    if (integrityHost instanceof HTMLElement) {
                        integrityHost.insertAdjacentElement('afterend', host);
                    } else {
                        const opsHost = statusNode.parentElement?.querySelector(
                            '[data-turnero-display-surface-ops="true"]'
                        );
                        if (opsHost instanceof HTMLElement) {
                            opsHost.insertAdjacentElement('afterend', host);
                        } else {
                            statusNode.insertAdjacentElement('afterend', host);
                        }
                    }
                }
            }
        }
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceRoadmapPack(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const scope = getDisplaySurfaceRoadmapScope();
    const ledgerStore = createTurneroSurfaceRoadmapLedger(
        scope,
        resolvedInputState.clinicProfile
    );
    const ownerStore = createTurneroSurfaceRoadmapOwnerStore(
        scope,
        resolvedInputState.clinicProfile
    );
    return buildTurneroSurfaceRoadmapPack({
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        runtimeState:
            resolvedInputState?.lastRenderedState?.state ||
            resolvedInputState?.connectionState ||
            'ready',
        truth: resolvedInputState?.lastRenderedState ? 'aligned' : 'watch',
        roadmapBand: 'core',
        backlogState: 'curated',
        nextAction: 'analytics-board',
        priorityBand: 'p1',
        roadmapOwner: 'ops-display',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'display' }),
        owners: ownerStore.list({ surfaceKey: 'display' }),
    });
}

function renderDisplaySurfaceRoadmapState(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const panel = ensureDisplaySurfaceRoadmapPanel();
    if (!panel) {
        return null;
    }

    if (!resolvedInputState.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        resolvedInputState.surfaceRoadmapPack = null;
        renderDisplaySurfaceExecutiveReviewState(resolvedInputState);
        return null;
    }

    const pack = buildDisplaySurfaceRoadmapPack(resolvedInputState);
    resolvedInputState.surfaceRoadmapPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceRoadmapBanner(panel.bannerHost, {
        pack,
        title: 'Display surface roadmap',
        eyebrow: 'Roadmap gate',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.checkpoints)
        ? pack.readout.checkpoints
        : []
    ).forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceExecutiveReviewState(resolvedInputState);
    return pack;
}

function getDisplaySurfaceExecutiveReviewScope() {
    return getDisplayCommercialScope();
}

function buildDisplaySurfaceExecutiveReviewPack(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const scope = getDisplaySurfaceExecutiveReviewScope();
    const ledgerStore = createTurneroSurfaceExecutiveReviewLedger(
        scope,
        resolvedInputState.clinicProfile
    );
    const ownerStore = createTurneroSurfaceExecutiveReviewOwnerStore(
        scope,
        resolvedInputState.clinicProfile
    );

    return buildTurneroSurfaceExecutiveReviewPack({
        surfaceKey: 'display',
        clinicProfile: resolvedInputState.clinicProfile,
        scope,
        runtimeState: 'ready',
        truth: 'aligned',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'approved',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-display',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'display' }),
        owners: ownerStore.list({ surfaceKey: 'display' }),
    });
}

function ensureDisplaySurfaceExecutiveReviewPanel() {
    const statusNode = getById('displayProfileStatus');
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-display-surface-executive-review="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroDisplaySurfaceExecutiveReview = 'true';
        host.id = 'displaySurfaceExecutiveReviewHost';
        host.className = 'turnero-surface-ops__stack';
        const packageHost = statusNode.parentElement?.querySelector(
            '[data-turnero-display-surface-package="true"]'
        );
        if (packageHost instanceof HTMLElement) {
            packageHost.insertAdjacentElement('afterend', host);
        } else {
            const acceptanceHost = statusNode.parentElement?.querySelector(
                '[data-turnero-display-surface-acceptance="true"]'
            );
            if (acceptanceHost instanceof HTMLElement) {
                acceptanceHost.insertAdjacentElement('beforebegin', host);
            } else {
                const supportHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-display-surface-support="true"]'
                );
                if (supportHost instanceof HTMLElement) {
                    supportHost.insertAdjacentElement('afterend', host);
                } else {
                    statusNode.insertAdjacentElement('afterend', host);
                }
            }
        }
    }

    host.id = 'displaySurfaceExecutiveReviewHost';

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function renderDisplaySurfaceExecutiveReviewState(inputState) {
    const resolvedInputState =
        inputState && typeof inputState === 'object' ? inputState : state;
    const panel = ensureDisplaySurfaceExecutiveReviewPanel();
    if (!panel) {
        return null;
    }

    if (!resolvedInputState.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        resolvedInputState.surfaceExecutiveReviewPack = null;
        return null;
    }

    const pack = buildDisplaySurfaceExecutiveReviewPack(resolvedInputState);
    resolvedInputState.surfaceExecutiveReviewPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceExecutiveReviewBanner(panel.bannerHost, {
        pack,
        title: 'Display surface executive review',
        eyebrow: 'Executive review gate',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.checkpoints)
        ? pack.readout.checkpoints
        : []
    ).forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    return pack;
}

function ensureDisplaySurfaceAcceptancePanel() {
    const host = getById('displaySurfaceAcceptanceHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    let bannerHost = host.querySelector('[data-role="banner"]');
    if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.dataset.role = 'banner';
        host.appendChild(bannerHost);
    }

    let chipsHost = host.querySelector('[data-role="chips"]');
    if (!(chipsHost instanceof HTMLElement)) {
        chipsHost = document.createElement('div');
        chipsHost.dataset.role = 'chips';
        chipsHost.className = 'turnero-surface-ops__chips';
        host.appendChild(chipsHost);
    }

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildDisplaySurfaceAcceptancePack() {
    const currentRoute =
        typeof window !== 'undefined' && window.location
            ? `${window.location.pathname || ''}${window.location.hash || ''}`
            : '';
    return buildTurneroSurfaceAcceptancePack({
        surfaceKey: 'sala-turnos',
        clinicProfile: state.clinicProfile,
        currentRoute,
    });
}

function renderDisplaySurfaceAcceptanceState() {
    const panel = ensureDisplaySurfaceAcceptancePanel();
    if (!panel) {
        return null;
    }

    if (!state.clinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildDisplaySurfaceAcceptancePack();
    state.surfaceAcceptancePack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceAcceptanceBanner(panel.bannerHost, {
        pack,
        title: 'Display surface acceptance',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.chips) ? pack.readout.chips : []).forEach(
        (chip) => {
            const chipNode = document.createElement('span');
            panel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        }
    );
    return pack;
}

function renderDisplayProfileStatus(profile) {
    const surfaceRuntime = buildTurneroSurfaceRuntimeStatus(profile, 'display');
    const el = getById('displayProfileStatus');
    if (!(el instanceof HTMLElement)) {
        return;
    }

    el.dataset.state =
        surfaceRuntime.uiState === 'alert'
            ? 'alert'
            : surfaceRuntime.uiState === 'warning'
              ? 'warning'
              : 'ready';
    el.textContent = surfaceRuntime.text;
    try {
        renderDisplaySurfaceRecoveryState();
    } catch (_error) {
        // Keep the status chrome and sync panels alive even if rollout rendering fails.
    }
    renderDisplaySurfaceOps();
    renderDisplaySurfaceIntegrityState();
    renderDisplaySurfaceServiceHandoverState();
    renderDisplaySurfaceOnboardingState();
    renderDisplaySurfaceAcceptanceState();
    renderDisplaySurfaceCommercialState();
    renderDisplaySurfaceSupportState();
    renderDisplaySurfaceFleetState();
}

function renderDisplaySurfaceRecoveryState() {
    const host = getById('displaySurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    let recoveryHost = host.querySelector('[data-role="recovery"]');
    if (!(recoveryHost instanceof HTMLElement)) {
        recoveryHost = document.createElement('section');
        recoveryHost.dataset.role = 'recovery';
        recoveryHost.className = 'turnero-surface-ops__stack';
    }

    let rolloutHost = host.querySelector('[data-role="rollout"]');
    if (!(rolloutHost instanceof HTMLElement)) {
        rolloutHost = document.createElement('section');
        rolloutHost.dataset.role = 'rollout';
        rolloutHost.className =
            'turnero-surface-rollout-stack turnero-surface-ops__stack';
    }

    let deliveryHost = host.querySelector('[data-role="delivery"]');
    if (!(deliveryHost instanceof HTMLElement)) {
        deliveryHost = document.createElement('section');
        deliveryHost.dataset.role = 'delivery';
        deliveryHost.className =
            'turnero-surface-delivery-stack turnero-surface-ops__stack';
    }

    if (
        recoveryHost.parentElement !== host ||
        rolloutHost.parentElement !== host ||
        deliveryHost.parentElement !== host
    ) {
        host.replaceChildren();
        host.appendChild(recoveryHost);
        host.appendChild(rolloutHost);
        host.appendChild(deliveryHost);
    }

    const connectionState = String(state.connectionState || 'paused');
    const surfaceContract = getTurneroSurfaceContract(
        state.clinicProfile,
        'display'
    );
    const heartbeat = buildDisplayHeartbeatPayload();
    const effectiveState =
        heartbeat.status === 'ready'
            ? 'ready'
            : heartbeat.status === 'warning'
              ? 'watch'
              : 'blocked';
    const runtimeState = {
        state: effectiveState,
        status: heartbeat.status,
        summary: heartbeat.summary,
        online: navigator.onLine !== false,
        connectivity: connectionState === 'offline' ? 'offline' : 'online',
        mode: resolveDisplayAppMode(),
        reason:
            connectionState === 'offline'
                ? 'network_offline'
                : surfaceContract.reason || '',
        bellPrimed: Boolean(state.bellPrimed),
        bellMuted: Boolean(state.bellMuted),
        pendingCount: Number(state.lastSnapshot ? 0 : 1),
        outboxSize: Number(state.lastSnapshot ? 0 : 1),
        updateChannel: 'stable',
        details: {
            connectionState,
            connectionMessage: String(state.lastConnectionMessage || ''),
            bellOutcome: String(state.lastBellOutcome || 'idle'),
            bellSource: String(state.lastBellSource || ''),
            surfaceContractState: String(surfaceContract.state || ''),
            surfaceRouteExpected: String(surfaceContract.expectedRoute || ''),
            surfaceRouteCurrent: String(surfaceContract.currentRoute || ''),
        },
    };
    const pack = buildTurneroSurfaceRecoveryPack({
        surfaceKey: 'display',
        clinicProfile: state.clinicProfile,
        runtimeState,
        heartbeat,
    });
    const readout = buildTurneroSurfaceContractReadout({
        snapshot: pack.snapshot,
        drift: pack.drift,
        gate: pack.gate,
        readiness: pack.readiness,
    });

    recoveryHost.hidden = false;
    recoveryHost.replaceChildren();
    mountTurneroSurfaceRecoveryBanner(recoveryHost, {
        title: 'Display surface recovery',
        snapshot: pack.snapshot,
        drift: pack.drift,
        gate: pack.gate,
        readiness: pack.readiness,
        readout,
    });

    const chips = document.createElement('div');
    chips.className = 'turnero-surface-recovery-checkpoints';
    recoveryHost.appendChild(chips);
    mountTurneroSurfaceCheckpointChip(chips, {
        label: 'Contract',
        value: readout.contractValue,
        state: readout.contractTone,
    });
    mountTurneroSurfaceCheckpointChip(chips, {
        label: 'Drift',
        value: readout.driftState,
        state: readout.driftTone,
    });
    mountTurneroSurfaceCheckpointChip(chips, {
        label: 'Gate',
        value: readout.badge,
        state: readout.gateTone,
    });

    renderDisplaySurfaceRolloutState(runtimeState, rolloutHost);
    renderDisplaySurfaceDeliveryState(runtimeState, deliveryHost);

    return pack;
}

function renderDisplaySurfaceRolloutState(runtimeState = null, target = null) {
    const host =
        target instanceof HTMLElement
            ? target
            : getById('displaySurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const surfaceBootstrapState = state.surfaceBootstrap?.state || {};
    const pack = buildTurneroSurfaceRolloutPack({
        surfaceKey: 'sala_tv',
        clinicProfile: state.clinicProfile,
        surfaceRegistry: surfaceBootstrapState.registry || {},
        releaseManifest: surfaceBootstrapState.registry?.manifest || {},
        runtimeState: runtimeState || {
            state: state.pollingEnabled ? 'ready' : 'watch',
            status: state.connectionState || 'paused',
            summary: state.lastConnectionMessage || '',
        },
        truth:
            surfaceBootstrapState.truthSummary?.mode ||
            surfaceBootstrapState.truthPack?.summary?.mode ||
            '',
        currentRoute: `${window.location.pathname || ''}${
            window.location.hash || ''
        }`,
    });

    const rolloutHost =
        target instanceof HTMLElement
            ? host
            : document.createElement('section');
    rolloutHost.className =
        'turnero-surface-rollout-stack turnero-surface-ops__stack';
    if (!(target instanceof HTMLElement)) {
        host.appendChild(rolloutHost);
    }
    rolloutHost.replaceChildren();
    mountTurneroSurfaceRolloutBanner(rolloutHost, {
        title: 'Display surface rollout',
        pack,
    });

    const chips = document.createElement('div');
    chips.className = 'turnero-surface-ops__chips';
    rolloutHost.appendChild(chips);
    (pack.readout?.checkpointChips || []).forEach((chip) => {
        const chipNode = document.createElement('span');
        chips.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });

    return pack;
}

function getDisplayPilotBlockDetail() {
    const surfaceContract = getDisplaySurfaceContract();
    if (surfaceContract.state !== 'alert') {
        return '';
    }

    if (surfaceContract.reason === 'profile_missing') {
        return 'Pantalla bloqueada: clinic-profile.json remoto ausente. Corrige el perfil y recarga antes de mostrar llamados.';
    }

    return `Pantalla bloqueada: la ruta no coincide con el canon del piloto (${surfaceContract.expectedRoute || '/sala-turnos.html'}). Corrige el acceso antes de usar esta TV.`;
}

function isDisplayPilotBlocked() {
    return getDisplaySurfaceContract().state === 'alert';
}

function applyDisplayClinicProfile(profile) {
    state.clinicProfile = profile;
    const clinicName = getTurneroClinicBrandName(profile);
    const clinicShortName = getTurneroClinicShortName(profile);
    const clinicId = String(profile?.clinic_id || '').trim() || 'sin-clinic-id';
    const clinicCity = String(profile?.branding?.city || '').trim();
    const consultorioSummary = [
        getTurneroConsultorioLabel(profile, 1, { short: true }),
        getTurneroConsultorioLabel(profile, 2, { short: true }),
    ].join(' / ');
    document.title = `Sala de Espera | ${clinicName}`;

    const brandNode =
        document.getElementById('displayBrandName') ||
        document.querySelector('.display-brand strong');
    if (brandNode instanceof HTMLElement) {
        brandNode.textContent = clinicName;
    }

    const brandMeta = getById('displayBrandMeta');
    if (brandMeta instanceof HTMLElement) {
        brandMeta.textContent = `Vista pacientes · ${consultorioSummary}`;
    }

    const clinicMeta = getById('displayClinicMeta');
    if (clinicMeta instanceof HTMLElement) {
        clinicMeta.textContent = [clinicId, clinicCity || clinicShortName]
            .filter(Boolean)
            .join(' · ');
    }
    renderDisplayProfileStatus(profile);
    renderDisplaySurfaceIntegrityState();
    renderDisplaySurfaceRecoveryState();
    renderDisplaySurfaceAcceptanceState();

    if (state.lastRenderedState) {
        renderState(state.lastRenderedState);
        return;
    }

    renderCalledTicket(
        'displayConsultorio1',
        null,
        getDisplayConsultorioLabel(1)
    );
    renderCalledTicket(
        'displayConsultorio2',
        null,
        getDisplayConsultorioLabel(2)
    );
}

function parseStructuredStorageValue(rawValue) {
    if (!rawValue) return null;
    if (typeof rawValue === 'object') {
        return rawValue;
    }
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawValue);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
        return null;
    }
}

function normalizeDisplayBellPreference(rawValue, fallbackValue = false) {
    if (
        rawValue === true ||
        rawValue === 1 ||
        rawValue === '1' ||
        rawValue === 'true'
    ) {
        return true;
    }
    if (
        rawValue === false ||
        rawValue === 0 ||
        rawValue === '0' ||
        rawValue === 'false'
    ) {
        return false;
    }
    return Boolean(fallbackValue);
}

function normalizeDisplaySnapshotStorage(rawValue) {
    const parsed = parseStructuredStorageValue(rawValue);
    if (!parsed || Array.isArray(parsed)) {
        return null;
    }

    const savedAtTs = Date.parse(String(parsed.savedAt || ''));
    if (!Number.isFinite(savedAtTs)) {
        return null;
    }
    if (Date.now() - savedAtTs > DISPLAY_LAST_SNAPSHOT_MAX_AGE_MS) {
        return null;
    }

    return {
        savedAt: new Date(savedAtTs).toISOString(),
        data: normalizeQueueStateSnapshot(parsed.data || {}),
    };
}

function resolveDisplayAppMode() {
    const agent =
        `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
    if (
        agent.includes('android') ||
        agent.includes('google tv') ||
        agent.includes('aft')
    ) {
        return 'android_tv';
    }
    return 'web';
}

function buildDisplayHeartbeatPayload() {
    const connectionState = String(state.connectionState || 'paused');
    const healthySync = Boolean(state.lastHealthySyncAt);
    const surfaceContract = getDisplaySurfaceContract();
    const clinicId = String(state.clinicProfile?.clinic_id || '').trim();
    const clinicName = String(
        state.clinicProfile?.branding?.name ||
            state.clinicProfile?.branding?.short_name ||
            ''
    ).trim();
    const profileFingerprint = getTurneroClinicProfileFingerprint(
        state.clinicProfile
    );
    const profileSource = String(
        state.clinicProfile?.runtime_meta?.source || 'remote'
    ).trim();
    const surfaceSyncPack =
        state.surfaceSyncPack || buildDisplaySurfaceSyncPack();

    let status = 'warning';
    let summary = 'Sala TV pendiente de validación.';
    if (surfaceContract.state === 'alert') {
        status = 'alert';
        summary = surfaceContract.detail;
    } else if (connectionState === 'offline') {
        status = 'alert';
        summary =
            'Sala TV sin conexión; usa respaldo local y confirma llamados manuales.';
    } else if (state.bellMuted) {
        status = 'warning';
        summary =
            'La campanilla está en silencio; reactivarla antes de operar.';
    } else if (state.lastBellOutcome === 'blocked' || !state.bellPrimed) {
        status = 'alert';
        summary = 'La TV no confirmó audio; repite la prueba de campanilla.';
    } else if (connectionState === 'live' && healthySync) {
        status = 'ready';
        summary =
            'Sala TV lista: cola en vivo, audio activo y respaldo local disponible.';
    }

    return {
        instance: 'main',
        deviceLabel: 'Sala TV TCL C655',
        appMode: resolveDisplayAppMode(),
        status,
        summary,
        networkOnline: navigator.onLine !== false,
        lastEvent:
            state.lastBellOutcome === 'played'
                ? 'bell_ok'
                : state.lastBellOutcome === 'blocked'
                  ? 'bell_blocked'
                  : 'heartbeat',
        lastEventAt:
            state.lastBellAt > 0
                ? new Date(state.lastBellAt).toISOString()
                : new Date().toISOString(),
        details: {
            connection: connectionState,
            bellMuted: Boolean(state.bellMuted),
            bellPrimed: Boolean(state.bellPrimed),
            bellOutcome: String(state.lastBellOutcome || 'idle'),
            healthySync,
            clinicId,
            clinicName,
            profileSource,
            profileFingerprint,
            surfaceContractState: String(surfaceContract.state || ''),
            surfaceRouteExpected: String(surfaceContract.expectedRoute || ''),
            surfaceRouteCurrent: String(surfaceContract.currentRoute || ''),
            surfaceSyncSnapshot: surfaceSyncPack.snapshot,
            surfaceSyncHandoffOpenCount: surfaceSyncPack.handoffs.filter(
                (handoff) => handoff.status !== 'closed'
            ).length,
        },
    };
}

function getDisplaySurfaceSyncScope() {
    return (
        String(state.clinicProfile?.clinic_id || '').trim() || 'default-clinic'
    );
}

function resolveDisplaySurfaceSyncHeartbeatState() {
    const connectionState = String(state.connectionState || 'paused');
    if (connectionState === 'offline') {
        return 'offline';
    }
    if (connectionState === 'live' && state.lastHealthySyncAt) {
        return 'ready';
    }
    return 'warning';
}

function resolveDisplaySurfaceSyncHeartbeatChannel() {
    const connectionState = String(state.connectionState || 'paused');
    return connectionState === 'live'
        ? 'queue-state-live'
        : connectionState === 'offline'
          ? 'queue-state-offline'
          : 'queue-state-pending';
}

function buildDisplaySurfaceSyncPack() {
    const queueState = normalizeQueueStatePayload(
        state.lastRenderedState || {}
    );
    const callingNow = Array.isArray(queueState.callingNow)
        ? queueState.callingNow
        : [];
    const nextTickets = Array.isArray(queueState.nextTickets)
        ? queueState.nextTickets
        : [];
    const byConsultorio = {
        1: null,
        2: null,
    };
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            byConsultorio[consultorio] = ticket;
        }
    }
    const primaryCallingTicket = selectPrimaryCallingTicket(
        callingNow,
        byConsultorio
    );
    const expectedVisibleTurn = String(
        primaryCallingTicket?.ticketCode || nextTickets[0]?.ticketCode || ''
    )
        .trim()
        .toUpperCase();
    const announcedTurn = String(primaryCallingTicket?.ticketCode || '')
        .trim()
        .toUpperCase();
    const handoffStore = createTurneroSurfaceHandoffLedger(
        getDisplaySurfaceSyncScope(),
        state.clinicProfile
    );
    const handoffs = handoffStore.list({
        includeClosed: false,
        surfaceKey: 'display',
    });

    return buildTurneroSurfaceSyncPack({
        surfaceKey: 'display',
        queueVersion: String(queueState.updatedAt || '').trim(),
        visibleTurn: expectedVisibleTurn,
        announcedTurn,
        handoffState: resolveTurneroSurfaceHandoffState(handoffs),
        heartbeat: {
            state: resolveDisplaySurfaceSyncHeartbeatState(),
            channel: resolveDisplaySurfaceSyncHeartbeatChannel(),
        },
        updatedAt: String(queueState.updatedAt || '').trim(),
        counts: {
            waiting: Math.max(0, Number(nextTickets.length || 0)),
            called: Math.max(0, Number(queueState.calledCount || 0)),
        },
        waitingCount: nextTickets.length,
        calledCount: Number(queueState.calledCount || 0),
        callingNow,
        nextTickets,
        expectedVisibleTurn,
        expectedQueueVersion: String(queueState.updatedAt || '').trim(),
        handoffs,
    });
}

function renderDisplaySurfaceSyncState() {
    const host = getById('displaySurfaceSyncHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const pack = buildDisplaySurfaceSyncPack();
    state.surfaceSyncPack = pack;
    const readout = buildTurneroSurfaceSyncReadout(pack);
    host.replaceChildren();
    mountTurneroSurfaceSyncBanner(host, {
        title: 'Display surface sync',
        pack,
    });

    const chips = document.createElement('div');
    chips.className = 'turnero-surface-sync-checkpoints';
    host.appendChild(chips);
    [
        {
            label: 'Turno',
            value: readout.visibleTurn || '--',
            state: readout.visibleTurn ? 'ready' : 'neutral',
        },
        {
            label: 'Drift',
            value: readout.driftState,
            state:
                readout.driftState === 'aligned'
                    ? 'ready'
                    : readout.driftState === 'watch'
                      ? 'warning'
                      : 'danger',
        },
        {
            label: 'Gate',
            value: `${readout.gateBand} · ${readout.gateScore}`,
            state:
                readout.gateBand === 'ready'
                    ? 'ready'
                    : readout.gateBand === 'watch'
                      ? 'warning'
                      : 'danger',
        },
        {
            label: 'Handoffs',
            value: String(readout.openHandoffs),
            state: readout.openHandoffs > 0 ? 'warning' : 'ready',
        },
    ].forEach((chip) => {
        const chipNode = document.createElement('span');
        chips.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderDisplaySurfaceIntegrityState();
    renderDisplaySurfaceServiceHandoverState();
    renderDisplaySurfaceCommercialState();
    renderDisplaySurfaceSupportState();
    renderDisplaySurfaceGoLiveState();
    return pack;
}

function ensureDisplayHeartbeat() {
    if (displayHeartbeat) {
        return displayHeartbeat;
    }

    displayHeartbeat = createSurfaceHeartbeatClient({
        surface: 'display',
        intervalMs: DISPLAY_HEARTBEAT_MS,
        getPayload: buildDisplayHeartbeatPayload,
    });
    return displayHeartbeat;
}

function notifyDisplayHeartbeat(reason = 'state_change') {
    ensureDisplayHeartbeat().notify(reason);
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeTicketCodeForDisplay(value) {
    const raw = String(value || '')
        .trim()
        .toUpperCase();
    if (!raw) {
        return '--';
    }
    const sanitized = raw.replace(/[^A-Z0-9-]/g, '');
    return sanitized || '--';
}

function normalizePatientInitialsForDisplay(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '--';
    }

    const folded = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!folded) {
        return '--';
    }

    const words = folded.split(/[\s-]+/).filter(Boolean);
    let initials = '';
    if (words.length >= 2) {
        const first = String(words[0] || '').charAt(0);
        const last = String(words[words.length - 1] || '').charAt(0);
        initials = `${first}${last}`;
    } else if (words.length === 1) {
        const compact = String(words[0] || '').replace(/[^A-Za-z0-9]/g, '');
        if (!compact) return '--';
        initials =
            compact.length <= 3 && compact === compact.toUpperCase()
                ? compact
                : compact.slice(0, 2);
    }

    const normalized = initials.toUpperCase().trim();
    if (!normalized) {
        return '--';
    }
    return normalized.slice(0, 3);
}

function getQueueStateArray(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return [];
    }
    for (const key of keys) {
        if (!key) continue;
        if (Array.isArray(source[key])) {
            return source[key];
        }
    }
    return [];
}

function getQueueStateObject(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return null;
    }
    for (const key of keys) {
        if (!key) continue;
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
    }
    return null;
}

function getQueueStateNumber(source, keys, fallback = 0) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return Number(fallback || 0);
    }
    for (const key of keys) {
        if (!key) continue;
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return Number(fallback || 0);
}

function normalizeQueueStatePayload(rawState) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const counts = getQueueStateObject(state, ['counts']) || {};
    const waitingCountRaw = getQueueStateNumber(
        state,
        ['waitingCount', 'waiting_count'],
        Number.NaN
    );
    const calledCountRaw = getQueueStateNumber(
        state,
        ['calledCount', 'called_count'],
        Number.NaN
    );
    let callingNow = getQueueStateArray(state, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (callingNow.length === 0) {
        const byConsultorio = getQueueStateObject(state, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        if (byConsultorio) {
            callingNow = Object.values(byConsultorio).filter(Boolean);
        }
    }

    const nextTickets = getQueueStateArray(state, [
        'nextTickets',
        'next_tickets',
        'waitingTickets',
        'waiting_tickets',
    ]);

    const waitingCount = Number.isFinite(waitingCountRaw)
        ? waitingCountRaw
        : getQueueStateNumber(
              counts,
              ['waiting', 'waiting_count'],
              nextTickets.length
          );
    const calledCount = Number.isFinite(calledCountRaw)
        ? calledCountRaw
        : getQueueStateNumber(
              counts,
              ['called', 'called_count'],
              callingNow.length
          );

    return {
        updatedAt:
            String(state.updatedAt || state.updated_at || '').trim() ||
            new Date().toISOString(),
        waitingCount: Math.max(0, Number(waitingCount || 0)),
        calledCount: Math.max(0, Number(calledCount || 0)),
        callingNow: Array.isArray(callingNow)
            ? callingNow.map((ticket) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: normalizeTicketCodeForDisplay(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: normalizePatientInitialsForDisplay(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  assignedConsultorio:
                      Number(
                          ticket?.assignedConsultorio ??
                              ticket?.assigned_consultorio ??
                              0
                      ) || null,
                  calledAt: String(ticket?.calledAt || ticket?.called_at || ''),
              }))
            : [],
        nextTickets: Array.isArray(nextTickets)
            ? nextTickets.map((ticket, index) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: normalizeTicketCodeForDisplay(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: normalizePatientInitialsForDisplay(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  position:
                      Number(ticket?.position || 0) > 0
                          ? Number(ticket.position)
                          : index + 1,
              }))
            : [],
    };
}

async function apiRequest(resource) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    params.set('t', String(Date.now()));
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    });

    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (_error) {
        throw new Error('Respuesta JSON invalida');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function setConnectionStatus(stateLabel, message) {
    const el = getById('displayConnectionState');
    if (!el) return;

    const normalized = String(stateLabel || 'live').toLowerCase();
    const fallbackByState = {
        live: 'Conectado',
        reconnecting: 'Reconectando',
        offline: 'Sin conexion',
        paused: 'En pausa',
    };

    const normalizedMessage =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;
    const changed =
        normalized !== state.connectionState ||
        normalizedMessage !== state.lastConnectionMessage;

    state.connectionState = normalized;
    state.lastConnectionMessage = normalizedMessage;
    el.dataset.state = normalized;
    el.textContent = normalizedMessage;

    if (changed) {
        emitQueueOpsEvent('connection_state', {
            state: normalized,
            message: normalizedMessage,
        });
    }
    renderDisplaySetupStatus();
}

function ensureDisplayOpsHintEl() {
    let el = getById('displayOpsHint');
    if (el) return el;

    const updatedAtEl = getById('displayUpdatedAt');
    if (!updatedAtEl?.parentElement) return null;

    el = document.createElement('span');
    el.id = 'displayOpsHint';
    el.className = 'display-updated-at';
    el.textContent = 'Estado operativo: inicializando...';
    updatedAtEl.insertAdjacentElement('afterend', el);
    return el;
}

function ensureDisplayStarStyles() {
    if (document.getElementById(DISPLAY_STAR_STYLE_ID)) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = DISPLAY_STAR_STYLE_ID;
    styleEl.textContent = `
        body[data-display-mode='star'] .display-header {
            border-bottom-color: color-mix(in srgb, var(--accent) 18%, var(--border));
            box-shadow: 0 10px 32px rgb(16 36 61 / 10%);
        }
        body[data-display-mode='star'] .display-brand strong {
            letter-spacing: -0.02em;
        }
        body[data-display-mode='star'] .display-privacy-pill {
            width: fit-content;
            border: 1px solid color-mix(in srgb, var(--accent) 24%, #fff 76%);
            border-radius: 999px;
            padding: 0.22rem 0.66rem;
            background: color-mix(in srgb, var(--accent-soft) 90%, #fff 10%);
            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);
            font-size: 0.83rem;
            font-weight: 600;
            line-height: 1.3;
        }
        body[data-display-mode='star'] .display-layout {
            gap: 1.1rem;
        }
        body[data-display-mode='star'] .display-panel {
            border-radius: 22px;
            padding: 1.12rem;
        }
        body[data-display-mode='star'] .display-next-list li {
            min-height: 68px;
        }
        #displayMetrics {
            margin: 0.7rem 1.35rem 0;
            display: flex;
            flex-wrap: wrap;
            gap: 0.56rem;
        }
        .display-metric-chip {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.36rem 0.7rem;
            background: var(--surface-soft);
            color: var(--muted);
            font-size: 0.9rem;
            font-weight: 600;
        }
        .display-metric-chip strong {
            color: var(--text);
            font-size: 1.02rem;
            margin-left: 0.28rem;
        }
        .display-metric-chip[data-kind='active'] {
            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);
            background: color-mix(in srgb, var(--accent-soft) 88%, #fff 12%);
            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);
        }
        .display-metric-chip[data-kind='active'] strong {
            color: var(--accent);
        }
        #displayAnnouncement .display-announcement-support {
            margin: 0.24rem 0 0;
            color: var(--muted);
            font-size: clamp(0.98rem, 1.45vw, 1.15rem);
            font-weight: 500;
            line-height: 1.3;
        }
        #displayAnnouncement.is-live .display-announcement-support {
            color: color-mix(in srgb, var(--accent) 60%, var(--muted) 40%);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} .display-header {
            box-shadow:
                0 0 0 2px color-mix(in srgb, var(--accent) 34%, #fff 66%),
                0 14px 34px rgb(16 36 61 / 18%);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} #displayAnnouncement {
            border-color: color-mix(in srgb, var(--accent) 45%, #fff 55%);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, #fff 72%);
            transform: translateY(-1px);
        }
        body.${DISPLAY_BELL_FLASH_CLASS} .display-called-card.is-live {
            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);
            box-shadow: 0 12px 24px rgb(16 36 61 / 14%);
        }
        @media (max-width: 720px) {
            #displayMetrics {
                margin: 0.56rem 0.9rem 0;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function ensureDisplayAnnouncementStyles() {
    if (document.getElementById(DISPLAY_ANNOUNCEMENT_STYLE_ID)) {
        return;
    }
    const styleEl = document.createElement('style');
    styleEl.id = DISPLAY_ANNOUNCEMENT_STYLE_ID;
    styleEl.textContent = `
        #displayAnnouncement {
            margin: 0.75rem 1.35rem 0;
            padding: 1rem 1.2rem;
            border-radius: 18px;
            border: 1px solid color-mix(in srgb, var(--accent) 28%, #fff 72%);
            background: linear-gradient(120deg, color-mix(in srgb, var(--accent-soft) 92%, #fff 8%), #fff);
            box-shadow: 0 12px 24px rgb(16 36 61 / 11%);
        }
        #displayAnnouncement .display-announcement-label {
            margin: 0;
            color: var(--muted);
            font-size: 0.96rem;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        #displayAnnouncement .display-announcement-text {
            margin: 0.24rem 0 0;
            font-size: clamp(1.34rem, 2.5vw, 2.15rem);
            line-height: 1.18;
            font-weight: 700;
            letter-spacing: 0.01em;
            color: var(--text);
        }
        #displayAnnouncement.is-live .display-announcement-text {
            color: var(--accent);
        }
        #displayAnnouncement.is-bell {
            border-color: color-mix(in srgb, var(--accent) 40%, #fff 60%);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, #fff 78%);
        }
        #displayAnnouncement.is-idle {
            border-color: var(--border);
            background: linear-gradient(160deg, var(--surface-soft), #fff);
        }
        #displayAnnouncement.is-blocked {
            border-color: color-mix(in srgb, var(--danger) 50%, #fff 50%);
            background:
                linear-gradient(160deg, rgb(239 107 107 / 14%), rgb(255 255 255 / 5%)),
                var(--surface-soft);
        }
        #displayAnnouncement.is-blocked .display-announcement-text {
            color: #ffd7d7;
        }
        #displayAnnouncement.is-blocked .display-announcement-support {
            color: #ffd7d7;
        }
        @media (max-width: 720px) {
            #displayAnnouncement {
                margin: 0.6rem 0.9rem 0;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            #displayAnnouncement {
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function ensureDisplayAnnouncementEl() {
    let el = getById('displayAnnouncement');
    if (el instanceof HTMLElement) {
        return el;
    }

    const layout = document.querySelector('.display-layout');
    if (!(layout instanceof HTMLElement)) {
        return null;
    }

    ensureDisplayAnnouncementStyles();
    ensureDisplayStarStyles();
    el = document.createElement('section');
    el.id = 'displayAnnouncement';
    el.className = 'display-announcement is-idle';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `
        <p class="display-announcement-label">Llamando ahora</p>
        <p class="display-announcement-text">Esperando siguiente llamado...</p>
        <p class="display-announcement-support">Consulta la pantalla para el consultorio asignado.</p>
    `;
    layout.insertAdjacentElement('beforebegin', el);
    return el;
}

function setDisplayAnnouncement(ticket) {
    const el = ensureDisplayAnnouncementEl();
    if (!(el instanceof HTMLElement)) return;

    const textEl = el.querySelector('.display-announcement-text');
    const supportEl = el.querySelector('.display-announcement-support');
    if (!(textEl instanceof HTMLElement)) return;

    if (!ticket) {
        el.classList.add('is-idle');
        el.classList.remove('is-live');
        el.classList.remove('is-blocked');
        delete el.dataset.consultorio;
        const idleText = 'Esperando siguiente llamado...';
        const idleSupport =
            'Consulta la pantalla para el consultorio asignado.';
        if (textEl.textContent !== idleText) {
            textEl.textContent = idleText;
            emitQueueOpsEvent('announcement_update', {
                mode: 'idle',
            });
        }
        if (
            supportEl instanceof HTMLElement &&
            supportEl.textContent !== idleSupport
        ) {
            supportEl.textContent = idleSupport;
        }
        return;
    }

    const consultorio = Number(ticket?.assignedConsultorio || 0);
    const consultorioLabel = getDisplayConsultorioLabel(consultorio);
    const ticketCode = normalizeTicketCodeForDisplay(
        ticket?.ticketCode || '--'
    );
    const patientInitials = normalizePatientInitialsForDisplay(
        ticket?.patientInitials || '--'
    );
    const nextText = `${consultorioLabel} · Turno ${ticketCode}`;
    const supportText = `Paciente ${patientInitials}: pasa con calma al ${consultorioLabel}.`;
    el.classList.remove('is-idle');
    el.classList.add('is-live');
    el.classList.remove('is-blocked');
    el.dataset.consultorio = String(consultorio || '');
    if (textEl.textContent !== nextText) {
        textEl.textContent = nextText;
        emitQueueOpsEvent('announcement_update', {
            mode: 'live',
            consultorio,
            ticketCode,
        });
    }
    if (
        supportEl instanceof HTMLElement &&
        supportEl.textContent !== supportText
    ) {
        supportEl.textContent = supportText;
    }
}

function setDisplayBlockedAnnouncement(detail) {
    const el = ensureDisplayAnnouncementEl();
    if (!(el instanceof HTMLElement)) return;

    const textEl = el.querySelector('.display-announcement-text');
    const supportEl = el.querySelector('.display-announcement-support');
    if (!(textEl instanceof HTMLElement)) return;

    const title = 'Pantalla bloqueada';
    const support =
        String(detail || '').trim() ||
        'Corrige el perfil por clínica antes de usar esta TV.';
    el.classList.remove('is-live', 'is-idle');
    el.classList.add('is-blocked');
    delete el.dataset.consultorio;
    if (textEl.textContent !== title) {
        textEl.textContent = title;
        emitQueueOpsEvent('announcement_update', {
            mode: 'blocked',
        });
    }
    if (supportEl instanceof HTMLElement && supportEl.textContent !== support) {
        supportEl.textContent = support;
    }
}

function selectPrimaryCallingTicket(callingNow, byConsultorio) {
    const active = Array.isArray(callingNow) ? callingNow.filter(Boolean) : [];
    if (active.length === 0) {
        return null;
    }

    let bestTicket = active[0];
    let bestTs = Number.NEGATIVE_INFINITY;
    for (const ticket of active) {
        const calledAtTs = Date.parse(String(ticket?.calledAt || ''));
        if (Number.isFinite(calledAtTs) && calledAtTs >= bestTs) {
            bestTs = calledAtTs;
            bestTicket = ticket;
        }
    }

    if (Number.isFinite(bestTs)) {
        return bestTicket;
    }
    return byConsultorio[1] || byConsultorio[2] || bestTicket;
}

function setDisplayOpsHint(message) {
    const el = ensureDisplayOpsHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Estado operativo';
}

function renderDisplaySetupStatus() {
    const titleEl = getById('displaySetupTitle');
    const summaryEl = getById('displaySetupSummary');
    const checksEl = getById('displaySetupChecks');
    if (
        !(titleEl instanceof HTMLElement) ||
        !(summaryEl instanceof HTMLElement) ||
        !(checksEl instanceof HTMLElement)
    ) {
        return;
    }

    const connectionState = String(state.connectionState || 'paused');
    const connectionMessage = String(
        state.lastConnectionMessage || 'Sincronizacion pendiente'
    );
    const bellTestAge =
        state.lastBellAt > 0
            ? formatElapsedAge(Date.now() - state.lastBellAt)
            : '';
    const surfaceContract = getTurneroSurfaceContract(
        state.clinicProfile,
        'display'
    );
    const snapshotSavedAt = Date.parse(
        String(state.lastSnapshot?.savedAt || '')
    );
    const snapshotAge = Number.isFinite(snapshotSavedAt)
        ? formatElapsedAge(Date.now() - snapshotSavedAt)
        : '';

    const checks = [
        {
            label: 'Perfil de clínica',
            state: surfaceContract.state === 'alert' ? 'danger' : 'ready',
            detail: surfaceContract.detail,
        },
        {
            label: 'Conexion y cola',
            state:
                connectionState === 'live'
                    ? state.lastHealthySyncAt
                        ? 'ready'
                        : 'warning'
                    : connectionState === 'offline'
                      ? 'danger'
                      : 'warning',
            detail:
                connectionState === 'live'
                    ? state.lastHealthySyncAt
                        ? `Panel en vivo (${formatLastHealthySyncAge()}).`
                        : 'Conectado, pero esperando una sincronizacion saludable.'
                    : connectionMessage,
        },
        {
            label: 'Audio del TV',
            state: state.bellPrimed ? 'ready' : 'warning',
            detail: state.bellPrimed
                ? 'Audio desbloqueado para WebView/navegador.'
                : 'Toca "Probar campanilla" una vez para habilitar audio en la TCL C655.',
        },
        {
            label: 'Campanilla',
            state: state.bellMuted
                ? 'warning'
                : state.lastBellOutcome === 'played'
                  ? 'ready'
                  : state.lastBellOutcome === 'blocked'
                    ? 'danger'
                    : 'warning',
            detail: state.bellMuted
                ? 'Esta en silencio. Reactivala antes de operar la sala.'
                : state.lastBellOutcome === 'played'
                  ? `Prueba sonora confirmada${bellTestAge ? ` · hace ${bellTestAge}` : ''}.`
                  : state.lastBellOutcome === 'blocked'
                    ? 'El audio fue bloqueado. Repite la prueba sonora en la TV.'
                    : 'Todavia no hay prueba sonora confirmada.',
        },
        {
            label: 'Respaldo local',
            state: Number.isFinite(snapshotSavedAt) ? 'ready' : 'warning',
            detail: Number.isFinite(snapshotSavedAt)
                ? `Ultimo respaldo local ${snapshotAge} de antiguedad.`
                : 'Aun sin snapshot local para contingencia.',
        },
    ];

    let title = 'Finaliza la puesta en marcha';
    let summary =
        'Confirma conexion, audio y campanilla antes de dejar la TV en operacion continua.';
    if (surfaceContract.state === 'alert') {
        title =
            surfaceContract.reason === 'profile_missing'
                ? 'Perfil de clínica no cargado'
                : 'Ruta del piloto incorrecta';
        summary = surfaceContract.detail;
    } else if (connectionState === 'offline') {
        title = 'Sala TV en contingencia';
        summary =
            'La TV puede seguir mostrando respaldo local, pero el enlace con la cola no esta disponible.';
    } else if (state.bellMuted) {
        title = 'Campanilla en silencio';
        summary =
            'La campanilla esta apagada. Reactivala antes de iniciar llamados reales.';
    } else if (state.lastBellOutcome === 'blocked' || !state.bellPrimed) {
        title = 'Falta habilitar audio';
        summary =
            'Haz una prueba sonora en la TCL C655 para desbloquear audio y confirmar volumen.';
    } else if (state.lastBellOutcome !== 'played' || state.lastBellAt <= 0) {
        title = 'Falta probar la campanilla';
        summary =
            'Ejecuta "Probar campanilla" y confirma sonido en sala antes de abrir pacientes.';
    } else if (connectionState === 'live' && state.lastHealthySyncAt) {
        title = 'Sala TV lista para llamados';
        summary =
            'La cola esta en vivo, la campanilla ya respondio y la TV tiene respaldo local para contingencia.';
    }

    titleEl.textContent = title;
    summaryEl.textContent = summary;
    checksEl.innerHTML = checks
        .map(
            (check) => `
                <article class="display-setup-check" data-state="${escapeHtml(check.state)}" role="listitem">
                    <strong>${escapeHtml(check.label)}</strong>
                    <span>${escapeHtml(check.detail)}</span>
                </article>
            `
        )
        .join('');
    renderDisplaySurfaceSyncState();
    renderDisplaySurfaceOps();
    renderDisplaySurfaceRecoveryState();
    renderDisplaySurfaceAcceptanceState();
    notifyDisplayHeartbeat('setup_status');
}

function ensureDisplayMetricsEl() {
    let el = getById('displayMetrics');
    if (el instanceof HTMLElement) {
        return el;
    }

    const announcement = ensureDisplayAnnouncementEl();
    if (!(announcement instanceof HTMLElement)) {
        return null;
    }

    ensureDisplayStarStyles();
    el = document.createElement('section');
    el.id = 'displayMetrics';
    el.className = 'display-metrics';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
        <span class="display-metric-chip" data-kind="waiting">
            En cola
            <strong data-metric="waiting">0</strong>
        </span>
        <span class="display-metric-chip" data-kind="active">
            Llamando
            <strong data-metric="active">0</strong>
        </span>
        <span class="display-metric-chip" data-kind="next">
            Siguientes
            <strong data-metric="next">0</strong>
        </span>
    `;
    announcement.insertAdjacentElement('afterend', el);
    return el;
}

function setMetricValue(container, metricName, value) {
    if (!(container instanceof HTMLElement)) return;
    const valueEl = container.querySelector(`[data-metric="${metricName}"]`);
    if (!(valueEl instanceof HTMLElement)) return;
    const nextValue = String(Math.max(0, Number(value || 0)));
    if (valueEl.textContent !== nextValue) {
        valueEl.textContent = nextValue;
    }
}

function renderDisplayMetrics(queueState) {
    const metricsEl = ensureDisplayMetricsEl();
    if (!(metricsEl instanceof HTMLElement)) return;

    const normalizedState = normalizeQueueStatePayload(queueState);
    const waitingCount = Number(normalizedState.waitingCount || 0);
    const callingCount = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow.length
        : 0;
    const nextCount = Array.isArray(normalizedState.nextTickets)
        ? normalizedState.nextTickets.length
        : 0;

    setMetricValue(metricsEl, 'waiting', waitingCount);
    setMetricValue(metricsEl, 'active', callingCount);
    setMetricValue(metricsEl, 'next', nextCount);
}

function ensureDisplayManualRefreshButton() {
    let button = getById('displayManualRefreshBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayManualRefreshBtn';
    button.type = 'button';
    button.className = 'display-control-btn';
    button.textContent = 'Refrescar panel';
    button.setAttribute('aria-label', 'Refrescar estado de turnos en pantalla');
    clockWrap.appendChild(button);
    return button;
}

function setDisplayManualRefreshLoading(isLoading) {
    const button = ensureDisplayManualRefreshButton();
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading ? 'Refrescando...' : 'Refrescar panel';
}

function ensureDisplayBellToggleButton() {
    let button = getById('displayBellToggleBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayBellToggleBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.setAttribute('aria-label', 'Alternar campanilla de llamados');
    clockWrap.appendChild(button);
    return button;
}

function ensureDisplayBellTestButton() {
    let button = getById('displayBellTestBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displayBellTestBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.textContent = 'Probar campanilla';
    button.setAttribute('aria-label', 'Probar campanilla de llamados');
    clockWrap.appendChild(button);
    return button;
}

function renderBellToggle() {
    const button = ensureDisplayBellToggleButton();
    if (!(button instanceof HTMLButtonElement)) return;

    button.textContent = state.bellMuted ? 'Campanilla: Off' : 'Campanilla: On';
    button.dataset.state = state.bellMuted ? 'muted' : 'enabled';
    button.setAttribute('aria-pressed', String(state.bellMuted));
    button.title = state.bellMuted
        ? 'Campanilla en silencio'
        : 'Campanilla activa';
    renderDisplaySetupStatus();
}

function persistBellPreference() {
    persistClinicScopedStorageValue(
        DISPLAY_BELL_MUTED_STORAGE_KEY,
        state.clinicProfile,
        state.bellMuted ? '1' : '0'
    );
}

function loadBellPreference() {
    state.bellMuted = readClinicScopedStorageValue(
        DISPLAY_BELL_MUTED_STORAGE_KEY,
        state.clinicProfile,
        {
            fallbackValue: false,
            normalizeValue: normalizeDisplayBellPreference,
        }
    );
}

function setBellMuted(nextMuted, { announce = false } = {}) {
    state.bellMuted = Boolean(nextMuted);
    persistBellPreference();
    renderBellToggle();
    emitQueueOpsEvent('bell_muted_changed', {
        muted: state.bellMuted,
        announce,
    });
    if (announce) {
        setDisplayOpsHint(
            state.bellMuted
                ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                : 'Campanilla activa para nuevos llamados.'
        );
    }
}

function toggleBellMuted() {
    setBellMuted(!state.bellMuted, { announce: true });
}

function normalizeQueueStateSnapshot(queueState) {
    const safeState = normalizeQueueStatePayload(queueState);
    return {
        updatedAt: String(safeState.updatedAt || new Date().toISOString()),
        waitingCount: Number(safeState.waitingCount || 0),
        calledCount: Number(safeState.calledCount || 0),
        callingNow: Array.isArray(safeState.callingNow)
            ? safeState.callingNow
            : [],
        nextTickets: Array.isArray(safeState.nextTickets)
            ? safeState.nextTickets
            : [],
    };
}

function persistLastSnapshot(queueState) {
    const data = normalizeQueueStateSnapshot(queueState);
    const snapshot = {
        savedAt: new Date().toISOString(),
        data,
    };
    state.lastSnapshot = snapshot;
    persistClinicScopedStorageValue(
        DISPLAY_LAST_SNAPSHOT_STORAGE_KEY,
        state.clinicProfile,
        snapshot
    );
    renderSnapshotHint();
}

function loadLastSnapshot() {
    state.lastSnapshot = readClinicScopedStorageValue(
        DISPLAY_LAST_SNAPSHOT_STORAGE_KEY,
        state.clinicProfile,
        {
            fallbackValue: null,
            normalizeValue: normalizeDisplaySnapshotStorage,
        }
    );
    renderSnapshotHint();
    return state.lastSnapshot;
}

function renderFromSnapshot(snapshot, { mode = 'restore' } = {}) {
    if (isDisplayPilotBlocked()) {
        renderDisplayPilotBlockedState();
        return false;
    }
    if (!snapshot?.data) return false;

    renderState(snapshot.data);
    const ageMs = Math.max(
        0,
        Date.now() - Date.parse(String(snapshot.savedAt || ''))
    );
    const ageLabel = formatElapsedAge(ageMs);
    setConnectionStatus('reconnecting', 'Respaldo local activo');
    setDisplayOpsHint(
        mode === 'startup'
            ? `Mostrando respaldo local (${ageLabel}) mientras conecta.`
            : `Sin backend. Mostrando ultimo estado local (${ageLabel}).`
    );
    emitQueueOpsEvent('snapshot_restored', {
        mode,
        ageMs,
    });
    return true;
}

function ensureDisplaySnapshotHintEl() {
    let hint = getById('displaySnapshotHint');
    if (hint instanceof HTMLElement) {
        return hint;
    }

    const opsHint = ensureDisplayOpsHintEl();
    if (!opsHint?.parentElement) return null;

    hint = document.createElement('span');
    hint.id = 'displaySnapshotHint';
    hint.className = 'display-updated-at';
    hint.textContent = 'Respaldo: sin datos locales';
    opsHint.insertAdjacentElement('afterend', hint);
    return hint;
}

function renderSnapshotHint() {
    const hint = ensureDisplaySnapshotHintEl();
    if (!(hint instanceof HTMLElement)) return;

    if (!state.lastSnapshot?.savedAt) {
        hint.textContent = 'Respaldo: sin datos locales';
        renderDisplaySetupStatus();
        return;
    }

    const savedAtTs = Date.parse(String(state.lastSnapshot.savedAt || ''));
    if (!Number.isFinite(savedAtTs)) {
        hint.textContent = 'Respaldo: sin datos locales';
        renderDisplaySetupStatus();
        return;
    }
    hint.textContent = `Respaldo: ${formatElapsedAge(Date.now() - savedAtTs)} de antiguedad`;
    renderDisplaySetupStatus();
}

function ensureDisplaySnapshotClearButton() {
    let button = getById('displaySnapshotClearBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const clockWrap = document.querySelector('.display-clock-wrap');
    if (!clockWrap) return null;

    button = document.createElement('button');
    button.id = 'displaySnapshotClearBtn';
    button.type = 'button';
    button.className = 'display-control-btn display-control-btn-muted';
    button.textContent = 'Limpiar respaldo';
    button.setAttribute('aria-label', 'Limpiar respaldo local del panel');
    clockWrap.appendChild(button);
    return button;
}

function renderNoDataFallback(message = 'No hay turnos pendientes.') {
    state.lastRenderedSignature = '';
    state.lastCalledSignature = '';
    state.callBaselineReady = true;
    renderCalledTicket(
        'displayConsultorio1',
        null,
        getDisplayConsultorioLabel(1)
    );
    renderCalledTicket(
        'displayConsultorio2',
        null,
        getDisplayConsultorioLabel(2)
    );
    setDisplayAnnouncement(null);
    const list = getById('displayNextList');
    if (list) {
        list.innerHTML = `<li class="display-empty">${escapeHtml(message)}</li>`;
    }
    renderDisplayMetrics({
        waitingCount: 0,
        callingNow: [],
        nextTickets: [],
    });
}

function renderDisplayPilotBlockedState() {
    const detail = getDisplayPilotBlockDetail();
    state.lastRenderedState = null;
    state.lastRenderedSignature = '';
    state.lastCalledSignature = '';
    state.callBaselineReady = true;
    clearBellFlashClass();
    renderCalledTicket(
        'displayConsultorio1',
        null,
        getDisplayConsultorioLabel(1)
    );
    renderCalledTicket(
        'displayConsultorio2',
        null,
        getDisplayConsultorioLabel(2)
    );
    setDisplayBlockedAnnouncement(detail);
    const list = getById('displayNextList');
    if (list) {
        list.innerHTML = `<li class="display-empty display-empty-blocked">${escapeHtml(detail || 'Pantalla bloqueada por configuración del piloto.')}</li>`;
    }
    renderDisplayMetrics({
        waitingCount: 0,
        callingNow: [],
        nextTickets: [],
    });
    setConnectionStatus('paused', 'Pantalla bloqueada');
    setDisplayOpsHint(detail);
}

function clearLastSnapshot({ announce = false } = {}) {
    state.lastSnapshot = null;
    state.lastRenderedSignature = '';
    removeClinicScopedStorageValue(
        DISPLAY_LAST_SNAPSHOT_STORAGE_KEY,
        state.clinicProfile
    );
    renderSnapshotHint();
    if (state.connectionState !== 'live') {
        renderNoDataFallback('Sin respaldo local disponible.');
        if (navigator.onLine === false) {
            setConnectionStatus('offline', 'Sin conexion');
        } else {
            setConnectionStatus('reconnecting', 'Sin respaldo local');
        }
    }
    if (announce) {
        setDisplayOpsHint(
            'Respaldo local limpiado. Esperando datos en vivo del backend.'
        );
    }
    emitQueueOpsEvent('snapshot_cleared', { announce });
}

function formatElapsedAge(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const seconds = Math.round(safeMs / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (remSeconds <= 0) {
        return `${minutes}m`;
    }
    return `${minutes}m ${remSeconds}s`;
}

function formatLastHealthySyncAge() {
    if (!state.lastHealthySyncAt) {
        return 'sin sincronizacion confirmada';
    }
    return `hace ${formatElapsedAge(Date.now() - state.lastHealthySyncAt)}`;
}

function evaluateQueueFreshness(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const updatedAtTs = Date.parse(String(normalizedState.updatedAt || ''));
    if (!Number.isFinite(updatedAtTs)) {
        return {
            stale: false,
            missingTimestamp: true,
            ageMs: null,
        };
    }

    const ageMs = Math.max(0, Date.now() - updatedAtTs);
    return {
        stale: ageMs >= POLL_STALE_THRESHOLD_MS,
        missingTimestamp: false,
        ageMs,
    };
}

function renderCalledTicket(containerId, ticket, consultorioLabel) {
    const container = getById(containerId);
    if (!container) return;

    if (!ticket) {
        container.innerHTML = `
            <article class="display-called-card is-empty">
                <h3>${consultorioLabel}</h3>
                <p>Sin llamado activo</p>
            </article>
        `;
        return;
    }

    const calledAtTs = Date.parse(String(ticket.calledAt || ''));
    const isFreshCall =
        Number.isFinite(calledAtTs) && Date.now() - calledAtTs <= 8000;
    const cardClass = isFreshCall
        ? 'display-called-card is-live is-fresh'
        : 'display-called-card is-live';

    container.innerHTML = `
        <article class="${cardClass}">
            <h3>${consultorioLabel}</h3>
            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
        </article>
    `;
}

function renderNextTickets(nextTickets) {
    const list = getById('displayNextList');
    if (!list) return;

    if (!Array.isArray(nextTickets) || nextTickets.length === 0) {
        list.innerHTML =
            '<li class="display-empty">No hay turnos pendientes.</li>';
        return;
    }

    list.innerHTML = nextTickets
        .slice(0, 8)
        .map(
            (ticket) => `
                <li>
                    <span class="next-code">${escapeHtml(ticket.ticketCode || '--')}</span>
                    <span class="next-initials">${escapeHtml(ticket.patientInitials || '--')}</span>
                    <span class="next-position">#${escapeHtml(ticket.position || '-')}</span>
                </li>
            `
        )
        .join('');
}

function computeCalledSignature(callingNow) {
    if (!Array.isArray(callingNow) || callingNow.length === 0) {
        return '';
    }
    return callingNow
        .map((ticket) => {
            const consultorio = String(ticket.assignedConsultorio || '-');
            const id = Number(ticket.id || 0);
            const code = normalizeTicketCodeForDisplay(
                ticket.ticketCode || '--'
            );
            const key = id > 0 ? `id-${id}` : `code-${code}`;
            return `${consultorio}:${key}`;
        })
        .sort()
        .join('|');
}

function toSignatureSet(signature) {
    if (!signature) {
        return new Set();
    }
    return new Set(
        String(signature)
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean)
    );
}

function clearBellFlashClass() {
    if (state.bellFlashId) {
        window.clearTimeout(state.bellFlashId);
        state.bellFlashId = 0;
    }
    document.body.classList.remove(DISPLAY_BELL_FLASH_CLASS);
    const announcement = getById('displayAnnouncement');
    if (announcement instanceof HTMLElement) {
        announcement.classList.remove('is-bell');
    }
}

function triggerBellFlash() {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
        return;
    }

    clearBellFlashClass();
    // Restart animation deterministically for repeated calls.
    void body.offsetWidth;
    body.classList.add(DISPLAY_BELL_FLASH_CLASS);
    const announcement = getById('displayAnnouncement');
    if (announcement instanceof HTMLElement) {
        announcement.classList.add('is-bell');
    }
    state.bellFlashId = window.setTimeout(() => {
        clearBellFlashClass();
    }, DISPLAY_BELL_FLASH_DURATION_MS);
}

async function primeBellAudio({ source = 'unknown' } = {}) {
    try {
        if (!state.audioContext) {
            state.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            )();
        }
        const ctx = state.audioContext;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        state.bellPrimed = ctx.state === 'running';
        emitQueueOpsEvent('bell_audio_primed', {
            source,
            running: state.bellPrimed,
        });
        renderDisplaySetupStatus();
        return state.bellPrimed;
    } catch (_error) {
        state.bellPrimed = false;
        emitQueueOpsEvent('bell_audio_primed', {
            source,
            running: false,
        });
        renderDisplaySetupStatus();
        return false;
    }
}

function showBellBlockedHintIfDue() {
    const now = Date.now();
    if (
        state.lastBellBlockedHintAt > 0 &&
        now - state.lastBellBlockedHintAt <
            DISPLAY_BELL_BLOCKED_HINT_COOLDOWN_MS
    ) {
        return;
    }
    state.lastBellBlockedHintAt = now;
    state.lastBellOutcome = 'blocked';
    renderDisplaySetupStatus();
    setDisplayOpsHint(
        'Audio bloqueado por navegador. Toca "Probar campanilla" una vez para habilitar sonido.'
    );
}

async function playBell({ source = 'new_call', force = false } = {}) {
    if (isDisplayPilotBlocked()) {
        return;
    }
    triggerBellFlash();
    if (state.bellMuted && !force) {
        return;
    }

    const now = Date.now();
    if (
        !force &&
        state.lastBellAt > 0 &&
        now - state.lastBellAt < DISPLAY_BELL_COOLDOWN_MS
    ) {
        return;
    }

    try {
        const canPlay = await primeBellAudio({ source });
        if (!canPlay) {
            state.lastBellSource = source;
            showBellBlockedHintIfDue();
            return;
        }

        const ctx = state.audioContext;
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(932, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.24);
        state.lastBellAt = Date.now();
        state.lastBellSource = source;
        state.lastBellOutcome = 'played';
        renderDisplaySetupStatus();
        emitQueueOpsEvent('bell_played', {
            source,
            muted: state.bellMuted,
        });
    } catch (_error) {
        state.lastBellSource = source;
        showBellBlockedHintIfDue();
    }
}

function renderUpdatedAt(queueState) {
    const badge = getById('displayUpdatedAt');
    if (!badge) return;
    const normalizedState = normalizeQueueStatePayload(queueState);
    const ts = Date.parse(String(normalizedState.updatedAt || ''));
    if (!Number.isFinite(ts)) {
        badge.textContent = 'Actualizacion pendiente';
        return;
    }
    badge.textContent = `Actualizado ${new Date(ts).toLocaleTimeString(
        'es-EC',
        {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
    )}`;
}

function computeDisplayRenderSignature(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const callingNow = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow.map((ticket) => ({
              id: Number(ticket?.id || 0),
              ticketCode: String(ticket?.ticketCode || ''),
              patientInitials: String(ticket?.patientInitials || ''),
              consultorio: Number(ticket?.assignedConsultorio || 0),
              calledAt: String(ticket?.calledAt || ''),
          }))
        : [];
    const nextTickets = Array.isArray(normalizedState.nextTickets)
        ? normalizedState.nextTickets.slice(0, 8).map((ticket) => ({
              id: Number(ticket?.id || 0),
              ticketCode: String(ticket?.ticketCode || ''),
              patientInitials: String(ticket?.patientInitials || ''),
              position: Number(ticket?.position || 0),
          }))
        : [];
    const updatedAt = String(normalizedState.updatedAt || '');
    return JSON.stringify({ updatedAt, callingNow, nextTickets });
}

function renderState(queueState) {
    if (isDisplayPilotBlocked()) {
        renderDisplayPilotBlockedState();
        return;
    }
    const normalizedState = normalizeQueueStatePayload(queueState);
    state.lastRenderedState = normalizedState;
    const renderSignature = computeDisplayRenderSignature(normalizedState);
    const isSameRender = renderSignature === state.lastRenderedSignature;

    const callingNow = Array.isArray(normalizedState.callingNow)
        ? normalizedState.callingNow
        : [];
    const byConsultorio = {
        1: null,
        2: null,
    };
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            byConsultorio[consultorio] = ticket;
        }
    }
    const primaryCallingTicket = selectPrimaryCallingTicket(
        callingNow,
        byConsultorio
    );

    if (!isSameRender) {
        renderCalledTicket(
            'displayConsultorio1',
            byConsultorio[1],
            getDisplayConsultorioLabel(1)
        );
        renderCalledTicket(
            'displayConsultorio2',
            byConsultorio[2],
            getDisplayConsultorioLabel(2)
        );
        renderNextTickets(normalizedState?.nextTickets || []);
        renderUpdatedAt(normalizedState);
        state.lastRenderedSignature = renderSignature;
        emitQueueOpsEvent('render_update', {
            callingNowCount: callingNow.length,
            nextCount: Array.isArray(normalizedState?.nextTickets)
                ? normalizedState.nextTickets.length
                : 0,
        });
    }
    setDisplayAnnouncement(primaryCallingTicket);
    renderDisplayMetrics(normalizedState);
    renderDisplaySurfaceSyncState();
    notifyDisplayHeartbeat('queue_state');

    const nextSignature = computeCalledSignature(callingNow);
    if (!state.callBaselineReady) {
        state.lastCalledSignature = nextSignature;
        state.callBaselineReady = true;
        return;
    }

    if (nextSignature !== state.lastCalledSignature) {
        const previousSet = toSignatureSet(state.lastCalledSignature);
        const currentSet = toSignatureSet(nextSignature);
        const addedCalls = [];
        for (const item of currentSet) {
            if (!previousSet.has(item)) {
                addedCalls.push(item);
            }
        }
        if (addedCalls.length > 0) {
            void playBell({ source: 'new_call' });
        }
        emitQueueOpsEvent('called_signature_changed', {
            signature: nextSignature,
            added_count: addedCalls.length,
        });
    }
    state.lastCalledSignature = nextSignature;
}

function getPollDelayMs() {
    const attempts = Math.max(0, Number(state.failureStreak || 0));
    const delay = POLL_MS * Math.pow(2, Math.min(attempts, 3));
    return Math.min(POLL_MAX_MS, delay);
}

function clearPollingTimer() {
    if (!state.pollingId) return;
    window.clearTimeout(state.pollingId);
    state.pollingId = 0;
}

function scheduleNextPoll({ immediate = false } = {}) {
    clearPollingTimer();
    if (!state.pollingEnabled) return;
    const delay = immediate ? 0 : getPollDelayMs();
    state.pollingId = window.setTimeout(() => {
        void runDisplayPollTick();
    }, delay);
}

async function refreshDisplayState() {
    if (isDisplayPilotBlocked()) {
        renderDisplayPilotBlockedState();
        return {
            ok: false,
            stale: false,
            blocked: true,
            reason: 'pilot_blocked',
            usedSnapshot: false,
        };
    }
    if (state.refreshBusy) {
        return { ok: false, stale: false, reason: 'busy' };
    }
    state.refreshBusy = true;
    try {
        const payload = await apiRequest('queue-state');
        const queueState = normalizeQueueStatePayload(payload.data || {});
        renderState(queueState);
        persistLastSnapshot(queueState);
        const freshness = evaluateQueueFreshness(queueState);
        return {
            ok: true,
            stale: Boolean(freshness.stale),
            missingTimestamp: Boolean(freshness.missingTimestamp),
            ageMs: freshness.ageMs,
            usedSnapshot: false,
        };
    } catch (error) {
        const snapshotRestored = renderFromSnapshot(state.lastSnapshot, {
            mode: 'restore',
        });
        if (!snapshotRestored) {
            const list = getById('displayNextList');
            if (list) {
                list.innerHTML = `<li class="display-empty">Sin conexion: ${escapeHtml(error.message)}</li>`;
            }
        }
        return {
            ok: false,
            stale: false,
            reason: 'fetch_error',
            errorMessage: error.message,
            usedSnapshot: snapshotRestored,
        };
    } finally {
        state.refreshBusy = false;
    }
}

async function runDisplayPollTick() {
    if (!state.pollingEnabled) return;

    if (isDisplayPilotBlocked()) {
        renderDisplayPilotBlockedState();
        return;
    }

    if (document.hidden) {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        setDisplayOpsHint('Pantalla en pausa por pestana oculta.');
        scheduleNextPoll();
        return;
    }

    if (navigator.onLine === false) {
        state.failureStreak += 1;
        const restored = renderFromSnapshot(state.lastSnapshot, {
            mode: 'restore',
        });
        if (!restored) {
            setConnectionStatus('offline', 'Sin conexion');
            setDisplayOpsHint(
                'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
            );
        }
        scheduleNextPoll();
        return;
    }

    const refreshResult = await refreshDisplayState();
    if (refreshResult.ok && !refreshResult.stale) {
        state.failureStreak = 0;
        state.lastHealthySyncAt = Date.now();
        setConnectionStatus('live', 'Conectado');
        setDisplayOpsHint(`Panel estable (${formatLastHealthySyncAge()}).`);
    } else if (refreshResult.ok && refreshResult.stale) {
        // Keep transport status live: stale queue timestamps mean source drift,
        // not necessarily that the display lost its backend connection.
        state.failureStreak = 0;
        state.lastHealthySyncAt = 0;
        const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
        setConnectionStatus('live', `Watchdog: datos estancados ${staleAge}`);
        setDisplayOpsHint(
            `Datos estancados ${staleAge}. Verifica fuente de cola.`
        );
    } else {
        state.failureStreak += 1;
        if (refreshResult.usedSnapshot) {
            scheduleNextPoll();
            return;
        }
        const retrySeconds = Math.max(1, Math.ceil(getPollDelayMs() / 1000));
        setConnectionStatus('reconnecting', `Reconectando en ${retrySeconds}s`);
        setDisplayOpsHint(
            `Conexion inestable. Reintento automatico en ${retrySeconds}s.`
        );
    }
    scheduleNextPoll();
}

async function runDisplayManualRefresh() {
    if (state.manualRefreshBusy) return;
    if (isDisplayPilotBlocked()) {
        renderDisplayPilotBlockedState();
        return;
    }
    state.manualRefreshBusy = true;
    setDisplayManualRefreshLoading(true);
    setConnectionStatus('reconnecting', 'Refrescando panel...');

    try {
        const refreshResult = await refreshDisplayState();
        if (refreshResult.ok && !refreshResult.stale) {
            state.failureStreak = 0;
            state.lastHealthySyncAt = Date.now();
            setConnectionStatus('live', 'Conectado');
            setDisplayOpsHint(
                `Sincronizacion manual exitosa (${formatLastHealthySyncAge()}).`
            );
            return;
        }
        if (refreshResult.ok && refreshResult.stale) {
            state.failureStreak = 0;
            state.lastHealthySyncAt = 0;
            const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
            setConnectionStatus(
                'live',
                `Watchdog: datos estancados ${staleAge}`
            );
            setDisplayOpsHint(`Persisten datos estancados (${staleAge}).`);
            return;
        }
        if (refreshResult.usedSnapshot) {
            return;
        }
        const retrySeconds = Math.max(1, Math.ceil(getPollDelayMs() / 1000));
        setConnectionStatus(
            navigator.onLine === false ? 'offline' : 'reconnecting',
            navigator.onLine === false
                ? 'Sin conexion'
                : `Reconectando en ${retrySeconds}s`
        );
        setDisplayOpsHint(
            navigator.onLine === false
                ? 'Sin internet. Llamado manual temporal.'
                : `Refresh manual sin exito. Reintento automatico en ${retrySeconds}s.`
        );
    } finally {
        state.manualRefreshBusy = false;
        setDisplayManualRefreshLoading(false);
    }
}

function startDisplayPolling({ immediate = true } = {}) {
    state.pollingEnabled = true;
    if (immediate) {
        setConnectionStatus('live', 'Sincronizando...');
        void runDisplayPollTick();
        return;
    }
    scheduleNextPoll();
}

function stopDisplayPolling({ reason = 'paused' } = {}) {
    state.pollingEnabled = false;
    state.failureStreak = 0;
    clearPollingTimer();

    const normalizedReason = String(reason || 'paused').toLowerCase();
    if (normalizedReason === 'offline') {
        setConnectionStatus('offline', 'Sin conexion');
        setDisplayOpsHint(
            'Sin conexion. Mantener protocolo manual de llamados.'
        );
        return;
    }
    if (normalizedReason === 'hidden') {
        setConnectionStatus('paused', 'En pausa (pestana oculta)');
        setDisplayOpsHint('Pantalla oculta. Reanuda al volver al frente.');
        return;
    }
    setConnectionStatus('paused', 'En pausa');
    setDisplayOpsHint('Sincronizacion pausada.');
}

function updateClock() {
    const el = getById('displayClock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function initDisplay() {
    initDisplayOpsTheme();
    document.body.dataset.displayMode = 'star';
    ensureDisplayStarStyles();
    updateClock();
    state.clockId = window.setInterval(updateClock, 1000);

    ensureDisplayOpsHintEl();
    ensureDisplaySnapshotHintEl();
    ensureDisplayAnnouncementEl();
    ensureDisplayMetricsEl();
    const manualRefreshButton = ensureDisplayManualRefreshButton();
    if (manualRefreshButton instanceof HTMLButtonElement) {
        manualRefreshButton.addEventListener('click', () => {
            void runDisplayManualRefresh();
        });
    }
    const bellToggleButton = ensureDisplayBellToggleButton();
    if (bellToggleButton instanceof HTMLButtonElement) {
        bellToggleButton.addEventListener('click', () => {
            toggleBellMuted();
        });
    }
    const bellTestButton = ensureDisplayBellTestButton();
    if (bellTestButton instanceof HTMLButtonElement) {
        bellTestButton.addEventListener('click', () => {
            void playBell({ source: 'manual_test', force: true });
            setDisplayOpsHint(
                'Campanilla de prueba ejecutada. Si no escuchas sonido, revisa audio del equipo/TV.'
            );
        });
    }
    const clearSnapshotButton = ensureDisplaySnapshotClearButton();
    if (clearSnapshotButton instanceof HTMLButtonElement) {
        clearSnapshotButton.addEventListener('click', () => {
            clearLastSnapshot({ announce: true });
        });
    }
    renderBellToggle();
    renderSnapshotHint();
    renderDisplaySetupStatus();

    setConnectionStatus('paused', 'Sincronizacion lista');
    setDisplayOpsHint('Cargando perfil de clinica...');

    const unlockAudio = () => {
        void primeBellAudio({ source: 'user_gesture' });
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopDisplayPolling({ reason: 'hidden' });
            return;
        }
        if (!state.clinicProfile || isDisplayPilotBlocked()) {
            return;
        }
        startDisplayPolling({ immediate: true });
    });

    window.addEventListener('online', () => {
        if (!state.clinicProfile || isDisplayPilotBlocked()) {
            return;
        }
        startDisplayPolling({ immediate: true });
    });

    window.addEventListener('offline', () => {
        stopDisplayPolling({ reason: 'offline' });
    });

    window.addEventListener('beforeunload', () => {
        stopDisplayPolling({ reason: 'paused' });
        displayHeartbeat?.stop();
        if (state.clockId) {
            window.clearInterval(state.clockId);
            state.clockId = 0;
        }
    });

    window.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey) return;
        const keyCode = String(event.code || '').toLowerCase();
        if (keyCode === 'keyr') {
            event.preventDefault();
            void runDisplayManualRefresh();
            return;
        }
        if (keyCode === 'keym') {
            event.preventDefault();
            toggleBellMuted();
            return;
        }
        if (keyCode === 'keyb') {
            event.preventDefault();
            void playBell({ source: 'shortcut_test', force: true });
            setDisplayOpsHint('Campanilla de prueba ejecutada con teclado.');
            return;
        }
        if (keyCode === 'keyx') {
            event.preventDefault();
            clearLastSnapshot({ announce: true });
        }
    });

    void loadTurneroClinicProfile().then((profile) => {
        applyDisplayClinicProfile(profile);
        loadBellPreference();
        loadLastSnapshot();
        renderBellToggle();
        renderSnapshotHint();
        renderDisplaySetupStatus();
        state.surfaceBootstrap = mountTurneroSurfaceRuntimeBootstrap(
            '#displaySurfaceRuntimeBootstrap',
            {
                clinicProfile: state.clinicProfile,
                surfaceKey: 'sala_tv',
                currentRoute: `${window.location.pathname || ''}${
                    window.location.hash || ''
                }`,
                runtimeState: {
                    state: state.pollingEnabled ? 'ready' : 'watch',
                    status: state.connectionState || 'paused',
                    summary: state.lastConnectionMessage || '',
                },
                heartbeat: buildDisplayHeartbeatPayload(),
                storageInfo: {
                    state: state.lastSnapshot ? 'ready' : 'unknown',
                    scope: 'display',
                    key: 'snapshot',
                    updatedAt: state.lastSnapshot?.savedAt || '',
                },
            }
        );
        void state.surfaceBootstrap?.ready?.then(() => {
            renderDisplaySurfaceRecoveryState();
        });
        ensureDisplayHeartbeat().start({ immediate: false });

        if (isDisplayPilotBlocked()) {
            renderDisplayPilotBlockedState();
            return;
        }

        if (!renderFromSnapshot(state.lastSnapshot, { mode: 'startup' })) {
            setDisplayOpsHint('Esperando primera sincronizacion...');
        }
        startDisplayPolling({ immediate: true });
    });
}

document.addEventListener('DOMContentLoaded', initDisplay);
