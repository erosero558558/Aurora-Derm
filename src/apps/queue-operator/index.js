import {
    getState,
    subscribe,
    updateState,
} from '../admin-v3/shared/core/store.js';
import {
    hasFocusedInput,
    setText,
    createToast,
} from '../admin-v3/shared/ui/render.js';
import { createSurfaceHeartbeatClient } from '../queue-shared/surface-heartbeat.js';
import { buildOperatorSurfaceState } from '../queue-shared/turnero-runtime-contract.mjs';
import {
    createEmptyOperatorShellState as createEmptyShellState,
    getOperatorShellMetaLabel as getShellMetaLabel,
    getOperatorShellModeLabel as getShellModeLabel,
    getOperatorShellReadiness as getShellReadiness,
    getOperatorShellSettingsButtonCopy,
    getOperatorShellSupportLabel as getShellSupportLabel,
    hydrateOperatorShellState,
} from './shell-state.mjs';
import { buildOperatorHeartbeatPayload as buildHeartbeatPayload } from './heartbeat-payload.mjs';
import {
    checkAuthStatus,
    getReusableOpenClawRedirectUrl,
    isOperatorAuthMode,
    loginWith2FA,
    loginWithPassword,
    logoutSession,
    pollOperatorAuthStatus,
    startOperatorAuth,
} from './pin-auth.js';
import {
    refreshAdminData,
    refreshStatusLabel,
} from '../admin-v3/shared/modules/data.js';
import {
    applyQueueRuntimeDefaults,
    clearQueueCommandAdapter,
    hydrateQueueFromData,
    queueNumpadAction,
    renderQueueSection,
    refreshQueueState,
    setQueueCommandAdapter,
    setQueueFilter,
    setQueueSearch,
} from '../admin-v3/shared/modules/queue.js';
import { normalizeQueueAction } from '../admin-v3/shared/modules/queue/helpers.js';
import {
    getActiveCalledTicketForStation,
    getQueueSource,
    getWaitingForConsultorio,
} from '../admin-v3/shared/modules/queue/selectors.js';
import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicReleaseMode,
    getTurneroClinicReadiness,
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
import { buildTurneroSurfaceRuntimeWatch } from '../queue-shared/turnero-surface-runtime-watch.js';
import { buildTurneroSurfaceOpsReadinessPack } from '../queue-shared/turnero-surface-ops-readiness-pack.js';
import { buildTurneroSurfaceOpsSummary } from '../queue-shared/turnero-surface-ops-summary.js';
import { mountTurneroSurfaceIncidentBanner } from '../queue-shared/turnero-surface-incident-banner.js';
import { mountTurneroSurfaceCheckpointChip } from '../queue-shared/turnero-surface-checkpoint-chip.js';
import { buildTurneroSurfaceServiceHandoverPack } from '../queue-shared/turnero-surface-service-handover-pack.js';
import { mountTurneroSurfaceServiceHandoverBanner } from '../queue-shared/turnero-surface-service-handover-banner.js';
import { buildTurneroSurfaceOnboardingPack } from '../queue-shared/turnero-surface-onboarding-pack.js';
import { mountTurneroSurfaceOnboardingBanner } from '../queue-shared/turnero-surface-onboarding-banner.js';
import { buildTurneroSurfaceRolloutPack } from '../queue-shared/turnero-surface-rollout-pack.js';
import { mountTurneroSurfaceRolloutBanner } from '../queue-shared/turnero-surface-rollout-banner.js';
import { listTurneroSurfaceFallbackDrills } from '../queue-shared/turnero-surface-fallback-drill-store.js';
import { listTurneroSurfaceCheckinLogbook } from '../queue-shared/turnero-surface-checkin-logbook.js';
import {
    dismissQueueSensitiveDialog,
    handleQueueAction,
} from '../admin-v3/core/boot/listeners/action-groups/queue.js';
import {
    eventMatchesBinding,
    isNumpadAddEvent,
    isNumpadDecimalEvent,
    isNumpadEnterEvent,
    isNumpadSubtractEvent,
} from '../admin-v3/shared/modules/queue/runtime/numpad/index.js';
import { resolveOperatorQueueAdapter } from './queue-adapters.js';
import {
    createTurneroSurfaceHandoffLedger,
    resolveTurneroSurfaceHandoffState,
} from '../queue-shared/turnero-surface-handoff-ledger.js';
import { buildTurneroSurfaceSyncPack } from '../queue-shared/turnero-surface-sync-pack.js';
import { buildTurneroSurfaceSyncReadout } from '../queue-shared/turnero-surface-sync-readout.js';
import { mountTurneroSurfaceSyncBanner } from '../queue-shared/turnero-surface-sync-banner.js';
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

const QUEUE_REFRESH_MS = 8000;
const OPERATOR_HEARTBEAT_MS = 15000;
const OPERATOR_PILOT_BLOCK_TOAST_COOLDOWN_MS = 2500;

let refreshIntervalId = 0;
let operatorHeartbeat = null;
let operatorAuthPollPromise = null;
let lastOperatorGuardToastAt = 0;
let lastOperatorGuardToastKey = '';

function hideOperatorSurfaceOpsPanel(panel) {
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

function initOperatorOpsTheme() {
    if (
        window.PielOpsTheme &&
        typeof window.PielOpsTheme.initAutoOpsTheme === 'function'
    ) {
        return window.PielOpsTheme.initAutoOpsTheme({
            surface: 'operator',
            family: 'command',
            mode: 'system',
        });
    }

    const tone = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light';
    document.documentElement.setAttribute('data-theme-mode', 'system');
    document.documentElement.setAttribute('data-theme', tone);
    document.documentElement.setAttribute('data-ops-tone', tone);
    document.documentElement.setAttribute('data-ops-family', 'command');
    if (document.body instanceof HTMLElement) {
        document.body.setAttribute('data-ops-tone', tone);
        document.body.setAttribute('data-ops-family', 'command');
    }

    return {
        surface: 'operator',
        family: 'command',
        mode: 'system',
        tone,
    };
}

function createEmptyNumpadValidationState() {
    return {
        bindingFingerprint: '',
        validatedActions: {
            call: false,
            recall: false,
            complete: false,
            noShow: false,
        },
        lastAction: '',
        lastCode: '',
        lastAt: '',
    };
}
const operatorRuntime = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    numpad: createEmptyNumpadValidationState(),
    shell: createEmptyShellState(),
    surfaceContract: null,
    surfaceBootstrap: null,
    pilotBlockToastAt: 0,
    shellRuntime: createEmptyShellRuntimeState(),
    shellRuntimeSnapshot: createEmptyShellRuntimeSnapshot(),
    queueAdapter: null,
    releaseBootStatusListener: null,
    releaseShellStatusListener: null,
    surfaceSyncPack: null,
    surfaceGoLivePack: null,
    surfaceFleetPack: null,
    surfaceSupportPack: null,
    surfacePackagePack: null,
    surfaceRoadmapPack: null,
    surfaceExecutiveReviewPack: null,
    surfaceAcceptancePack: null,
    surfaceReplicationPack: null,
    surfaceRenewalPack: null,
    surfaceSuccessPack: null,
    surfaceExpansionPack: null,
    surfaceDeliveryPack: null,
};
let operatorClinicProfile = null;

function createEmptyShellRuntimeState() {
    return {
        connectivity: 'online',
        mode: 'live',
        offlineEnabled: false,
        snapshotAgeSec: null,
        outboxSize: 0,
        reconciliationSize: 0,
        lastSuccessfulSyncAt: '',
        updateChannel: 'stable',
        reason: 'connected',
    };
}

function createEmptyShellRuntimeSnapshot() {
    return {
        snapshot: null,
        outbox: [],
        reconciliation: [],
        hasAuthenticatedSession: false,
        lastAuthenticatedAt: '',
    };
}

function normalizeOperatorShellRuntime(status = {}) {
    const fallback = createEmptyShellRuntimeState();
    const mode = String(status?.mode || fallback.mode)
        .trim()
        .toLowerCase();
    const connectivity = String(status?.connectivity || fallback.connectivity)
        .trim()
        .toLowerCase();

    return {
        connectivity: connectivity === 'offline' ? 'offline' : 'online',
        mode: mode === 'offline' || mode === 'safe' ? mode : fallback.mode,
        offlineEnabled: status?.offlineEnabled === true,
        snapshotAgeSec: Number.isFinite(Number(status?.snapshotAgeSec))
            ? Number(status.snapshotAgeSec)
            : null,
        outboxSize: Math.max(0, Number(status?.outboxSize || 0) || 0),
        reconciliationSize: Math.max(
            0,
            Number(status?.reconciliationSize || 0) || 0
        ),
        lastSuccessfulSyncAt: String(status?.lastSuccessfulSyncAt || ''),
        updateChannel:
            String(status?.updateChannel || '')
                .trim()
                .toLowerCase() === 'pilot'
                ? 'pilot'
                : 'stable',
        reason: String(status?.reason || fallback.reason),
    };
}

function normalizeOperatorShellRuntimeSnapshot(snapshot = {}) {
    const fallback = createEmptyShellRuntimeSnapshot();
    return {
        snapshot:
            snapshot?.snapshot && typeof snapshot.snapshot === 'object'
                ? snapshot.snapshot
                : null,
        outbox: Array.isArray(snapshot?.outbox)
            ? snapshot.outbox
            : fallback.outbox,
        reconciliation: Array.isArray(snapshot?.reconciliation)
            ? snapshot.reconciliation
            : fallback.reconciliation,
        hasAuthenticatedSession: snapshot?.hasAuthenticatedSession === true,
        lastAuthenticatedAt: String(snapshot?.lastAuthenticatedAt || ''),
    };
}

function syncOperatorShellRuntime(status, snapshot = {}) {
    operatorRuntime.shellRuntime = normalizeOperatorShellRuntime(status);
    operatorRuntime.shellRuntimeSnapshot =
        normalizeOperatorShellRuntimeSnapshot(snapshot);
}

function getById(id) {
    return document.getElementById(id);
}

function getOperatorSurfaceProfileStatusNode() {
    const allNodes = Array.from(
        document.querySelectorAll('.queue-operator-profile-status')
    ).filter((node) => node instanceof HTMLElement);
    const visibleNodes = allNodes.filter((node) => {
        if (node.hidden) {
            return false;
        }
        if (node.closest('[hidden]')) {
            return false;
        }
        return !node.closest('.is-hidden');
    });
    const visibleAppNode = visibleNodes.find(
        (node) => node.closest('#operatorApp') instanceof HTMLElement
    );
    const existingNode = getById('operatorProfileStatus');
    const selectedNode =
        visibleAppNode ||
        (existingNode instanceof HTMLElement ? existingNode : null) ||
        allNodes[0] ||
        null;

    if (!(selectedNode instanceof HTMLElement)) {
        return null;
    }

    if (selectedNode.id !== 'operatorProfileStatus') {
        if (
            existingNode instanceof HTMLElement &&
            existingNode !== selectedNode &&
            existingNode.id === 'operatorProfileStatus'
        ) {
            const hiddenHost = existingNode.parentElement;
            if (hiddenHost instanceof HTMLElement) {
                hiddenHost
                    .querySelectorAll('.turnero-surface-ops__stack')
                    .forEach((stack) => {
                        if (stack instanceof HTMLElement) {
                            stack.remove();
                        }
                    });
            }
            existingNode.removeAttribute('id');
        }
        selectedNode.id = 'operatorProfileStatus';
    }

    return selectedNode;
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getOperatorConsultorioShortLabel(consultorio) {
    return getTurneroConsultorioLabel(operatorClinicProfile, consultorio, {
        short: true,
    });
}

function getOperatorCommercialScope() {
    return (
        String(
            operatorClinicProfile?.region ||
                operatorClinicProfile?.branding?.city ||
                'regional'
        ).trim() || 'regional'
    );
}

function getOperatorFleetScope() {
    return (
        String(operatorClinicProfile?.region || 'regional').trim() || 'regional'
    );
}

function getOperatorSurfaceCurrentRoute() {
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

function ensureOperatorSurfaceCommercialPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-commercial="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceCommercial = 'true';
        host.className = 'turnero-surface-ops__stack';
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-integrity="true"]'
        );
        if (integrityHost instanceof HTMLElement) {
            integrityHost.insertAdjacentElement('afterend', host);
        } else {
            const opsHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-ops="true"]'
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

    return {
        host,
        bannerHost,
        chipsHost,
    };
}

function buildOperatorSurfaceCommercialPack() {
    const scope = getOperatorCommercialScope();
    const ledgerStore = createTurneroSurfaceCommercialLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceCommercialOwnerStore(
        scope,
        operatorClinicProfile
    );
    const pack = buildTurneroSurfaceCommercialPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        runtimeState:
            getOperatorSurfaceContract().state === 'alert'
                ? 'blocked'
                : 'ready',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        packageTier: 'pilot-plus',
        commercialOwner: 'ernesto',
        opsOwner: 'ops-lead',
        scopeState: 'ready',
        pricingState: 'watch',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'operator-turnos' }),
    });

    return {
        ...pack,
        readout: buildTurneroSurfaceCommercialReadout({
            snapshot: pack.snapshot,
            gate: pack.gate,
        }),
    };
}

function renderOperatorSurfaceCommercialState() {
    const panel = ensureOperatorSurfaceCommercialPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildOperatorSurfaceCommercialPack();
    operatorRuntime.surfaceCommercialPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceCommercialBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Operator surface commercial',
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
    renderOperatorSurfaceRenewalState();
    renderOperatorSurfaceSuccessState();
    renderOperatorSurfaceReplicationState();
    return pack;
}

function getOperatorSurfaceReplicationScope() {
    return getOperatorCommercialScope();
}

function getOperatorSurfaceSuccessScope() {
    return getOperatorCommercialScope();
}

function getOperatorSurfaceRenewalScope() {
    return getOperatorCommercialScope();
}

function ensureOperatorSurfaceRenewalPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-renewal="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceRenewal = 'true';
        host.className = 'turnero-surface-ops__stack';
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-ops="true"]'
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

function ensureOperatorSurfaceSuccessPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-success="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceSuccess = 'true';
        host.className = 'turnero-surface-ops__stack';
        const renewalHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-renewal="true"]'
        );
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceSuccessPack() {
    const scope = getOperatorSurfaceSuccessScope();
    const ledgerStore = createTurneroSurfaceSuccessLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceSuccessOwnerStore(
        scope,
        operatorClinicProfile
    );
    const pack = buildTurneroSurfaceSuccessPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        adoptionState: 'watch',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-lead',
        followupWindow: 'mensual',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'operator-turnos' }),
    });

    return pack;
}

function buildOperatorSurfaceRenewalPack() {
    const scope = getOperatorSurfaceRenewalScope();
    const ledgerStore = createTurneroSurfaceRenewalLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceRenewalOwnerStore(
        scope,
        operatorClinicProfile
    );
    return buildTurneroSurfaceRenewalPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        runtimeState:
            getOperatorSurfaceContract().state === 'alert'
                ? 'blocked'
                : 'ready',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        renewalValueBand: 'high',
        retentionSignal: 'stable',
        feedbackState: 'good',
        activityState: 'active',
        pendingCorrections: 0,
        renewalOwner: 'renewal-lead',
        commercialOwner: 'ernesto',
        successOwner: 'ops-lead',
        nextRenewalWindow: '30 dias',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'operator-turnos' }),
    });
}

function renderOperatorSurfaceRenewalState() {
    const panel = ensureOperatorSurfaceRenewalPanel();
    if (!panel) {
        return null;
    }

    if (shouldFreezeTurneroSurfaceSignal('renewal')) {
        operatorRuntime.surfaceRenewalPack = null;
        return hideOperatorSurfaceOpsPanel(panel);
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfaceRenewalPack = null;
        return null;
    }

    const pack = buildOperatorSurfaceRenewalPack();
    operatorRuntime.surfaceRenewalPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceRenewalBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Operator surface renewal',
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

function renderOperatorSurfaceSuccessState() {
    const panel = ensureOperatorSurfaceSuccessPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfaceSuccessPack = null;
        renderOperatorSurfaceExpansionState();
        return null;
    }

    const pack = buildOperatorSurfaceSuccessPack();
    operatorRuntime.surfaceSuccessPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceSuccessBanner(panel.bannerHost, {
        pack,
        readout: pack.readout,
        title: 'Operator surface success',
        eyebrow: 'Customer success',
    });
    panel.chipsHost.replaceChildren();
    pack.readout.chips.forEach((chip) => {
        const chipNode = document.createElement('span');
        panel.chipsHost.appendChild(chipNode);
        mountTurneroSurfaceCheckpointChip(chipNode, chip);
    });
    renderOperatorSurfaceExpansionState();

    return pack;
}

function getOperatorSurfaceExpansionScope() {
    return getOperatorCommercialScope();
}

function getOperatorSurfaceDeliveryScope() {
    return getOperatorCommercialScope();
}

function ensureOperatorSurfaceExpansionPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-expansion="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceExpansion = 'true';
        host.className = 'turnero-surface-ops__stack';
        const successHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-success="true"]'
        );
        const commercialHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-commercial="true"]'
        );
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceExpansionPack(state = getState()) {
    const scope = getOperatorSurfaceExpansionScope();
    const ledgerStore = createTurneroSurfaceExpansionLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceExpansionOwnerStore(
        scope,
        operatorClinicProfile
    );
    const syncHealth = getQueueSyncHealth(state);
    return buildTurneroSurfaceExpansionPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        runtimeState: syncHealth.degraded
            ? 'degraded'
            : syncHealth.syncMode || 'ready',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        opportunityState: 'watch',
        demandSignal: 'medium',
        gapState: 'triage-plus',
        expansionOwner: 'ops-lead',
        nextModuleHint: 'historia-clinica-lite',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator' }),
        owners: ownerStore.list({ surfaceKey: 'operator' }),
    });
}

function buildOperatorSurfaceDeliveryPack(
    state = getState(),
    runtimeState = null
) {
    const scope = getOperatorSurfaceDeliveryScope();
    const ledgerStore = createTurneroSurfaceDeliveryLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceDeliveryOwnerStore(
        scope,
        operatorClinicProfile
    );
    const syncHealth = getQueueSyncHealth(state);
    const surfaceBootstrapState = operatorRuntime.surfaceBootstrap?.state || {};

    return buildTurneroSurfaceDeliveryPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        runtimeState:
            runtimeState?.state ||
            (syncHealth.degraded ? 'watch' : syncHealth.syncMode || 'ready'),
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        targetWindow: surfaceBootstrapState.registry?.manifest ? '48h' : '72h',
        dependencyState: 'watch',
        blockerState:
            runtimeState?.state === 'blocked' || operatorRuntime.online === false
                ? 'blocked'
                : 'clear',
        deliveryOwner: 'ops-lead',
        releaseOwner: 'release-lead',
        opsOwner: 'operator-supervisor',
        checklist: {
            summary: {
                all: 5,
                pass: 4,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator' }),
        owners: ownerStore.list({ surfaceKey: 'operator' }),
    });
}

function renderOperatorSurfaceDeliveryState(
    state = getState(),
    runtimeState = null
) {
    const host = getById('operatorSurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    if (shouldFreezeTurneroSurfaceSignal('delivery')) {
        operatorRuntime.surfaceDeliveryPack = null;
        return null;
    }

    if (!operatorClinicProfile) {
        operatorRuntime.surfaceDeliveryPack = null;
        return null;
    }

    const pack = buildOperatorSurfaceDeliveryPack(state, runtimeState);
    operatorRuntime.surfaceDeliveryPack = pack;

    const deliveryHost = document.createElement('section');
    deliveryHost.className =
        'turnero-surface-delivery-stack turnero-surface-ops__stack';
    host.appendChild(deliveryHost);
    mountTurneroSurfaceDeliveryBanner(deliveryHost, {
        pack,
        title: 'Operator surface delivery',
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

function renderOperatorSurfaceExpansionState(state = getState()) {
    const panel = ensureOperatorSurfaceExpansionPanel();
    if (!panel) {
        return null;
    }

    if (shouldFreezeTurneroSurfaceSignal('expansion')) {
        operatorRuntime.surfaceExpansionPack = null;
        return hideOperatorSurfaceOpsPanel(panel);
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfaceExpansionPack = null;
        return null;
    }

    const pack = buildOperatorSurfaceExpansionPack(state);
    const readout = buildTurneroSurfaceExpansionReadout({
        snapshot: pack.snapshot,
        gate: pack.gate,
        checklist: pack.checklist,
        ledger: pack.ledger,
        owners: pack.owners,
    });
    operatorRuntime.surfaceExpansionPack = {
        ...pack,
        readout,
    };
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceExpansionBanner(panel.bannerHost, {
        pack: operatorRuntime.surfaceExpansionPack,
        readout,
        title: 'Operator surface expansion',
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
    return operatorRuntime.surfaceExpansionPack;
}

function ensureOperatorSurfaceReplicationPanel() {
    const host = getById('operatorSurfaceReplicationHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    if (!host.className.includes('turnero-surface-ops__stack')) {
        host.className = `${host.className} turnero-surface-ops__stack`.trim();
    }
    host.dataset.turneroOperatorSurfaceReplication = 'true';

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

function buildOperatorSurfaceReplicationPack() {
    const scope = getOperatorSurfaceReplicationScope();
    const templateLedger = createTurneroSurfaceDeploymentTemplateLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceReplicationOwnerStore(
        scope,
        operatorClinicProfile
    );
    const pack = buildTurneroSurfaceReplicationPack({
        surfaceKey: 'operator-turnos',
        surfaceLabel:
            operatorClinicProfile?.surfaces?.operator?.label ||
            'Turnero Operador',
        clinicProfile: operatorClinicProfile,
        runtimeState: 'ready',
        truth: 'watch',
        templateState: 'ready',
        assetProfile: 'mini-pc + printer',
        replicationOwner: 'ops-lead',
        installTimeBucket: 'half-day',
        documentationState: 'ready',
        templates: templateLedger.list({ surfaceKey: 'operator-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'operator-turnos' }),
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

function renderOperatorSurfaceReplicationState() {
    const panel = ensureOperatorSurfaceReplicationPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildOperatorSurfaceReplicationPack();
    operatorRuntime.surfaceReplicationPack = pack;
    panel.host.hidden = false;
    mountTurneroSurfaceReplicationBanner(panel.bannerHost, {
        snapshot: pack.snapshot,
        checklist: pack.checklist,
        gate: pack.gate,
        templates: pack.templates,
        owners: pack.owners,
        title: 'Operator surface replication',
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

function ensureOperatorSurfaceOpsHosts() {
    return Array.from(
        document.querySelectorAll('.queue-operator-profile-status')
    )
        .filter((node) => node instanceof HTMLElement)
        .map((statusNode) => {
            let host = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-ops="true"]'
            );
            if (!(host instanceof HTMLElement)) {
                host = document.createElement('div');
                host.dataset.turneroOperatorSurfaceOps = 'true';
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
        });
}

function buildOperatorSurfaceOpsTelemetryEntry(now = Date.now()) {
    const heartbeatPayload = buildOperatorHeartbeatPayload();
    const heartbeatClient = ensureOperatorHeartbeat();
    const lastSentAt = Number(heartbeatClient?.getLastSentAt?.() || 0);
    const ageSeconds =
        lastSentAt > 0
            ? Math.max(0, Math.round((now - lastSentAt) / 1000))
            : null;
    const staleThresholdSeconds = Math.max(
        45,
        Math.round(OPERATOR_HEARTBEAT_MS / 1000) * 3
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

function renderOperatorSurfaceOps() {
    const hosts = ensureOperatorSurfaceOpsHosts();
    if (!hosts.length) {
        return;
    }

    if (!operatorClinicProfile) {
        hosts.forEach(({ host }) => {
            host.hidden = true;
        });
        renderOperatorSurfaceGoLiveState();
        renderOperatorSurfaceFleetState();
        return;
    }

    const now = Date.now();
    const drills = listTurneroSurfaceFallbackDrills({
        clinicProfile: operatorClinicProfile,
        surface: 'operator',
    });
    const logbook = listTurneroSurfaceCheckinLogbook({
        clinicProfile: operatorClinicProfile,
        surface: 'operator',
    });
    const currentRoute = getOperatorSurfaceCurrentRoute();
    const watch = buildTurneroSurfaceRuntimeWatch({
        surface: 'operator',
        telemetryEntry: buildOperatorSurfaceOpsTelemetryEntry(now),
        clinicProfile: operatorClinicProfile,
        safeMode: operatorRuntime.shellRuntime.mode === 'safe',
        now,
    });
    const readiness = buildTurneroSurfaceOpsReadinessPack({
        surface: 'operator',
        watch,
        drills,
        logbook,
        now,
    });
    const summary = buildTurneroSurfaceOpsSummary({
        surface: 'operator',
        watch,
        readiness,
        drills,
        logbook,
    });
    const adoptionPack = buildTurneroSurfaceAdoptionPack({
        surfaceKey: 'operator-turnos',
        surfaceId: 'operator',
        role: 'operator',
        roleLabel: 'Operador',
        handoffMode: 'guided',
        currentRoute,
        clinicProfile: operatorClinicProfile,
        scope:
            operatorClinicProfile?.region ||
            operatorClinicProfile?.branding?.city ||
            'regional',
    });

    hosts.forEach(
        ({
            host,
            bannerHost,
            chipsHost,
            adoptionBannerHost,
            adoptionChipsHost,
        }) => {
            host.hidden = false;
            mountTurneroSurfaceIncidentBanner(bannerHost, {
                surface: 'operator',
                watch,
                readiness,
                summary,
            });
            chipsHost.replaceChildren();
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
                chipsHost.appendChild(chipNode);
                mountTurneroSurfaceCheckpointChip(chipNode, chip);
            });
            mountTurneroSurfaceAdoptionBanner(adoptionBannerHost, {
                title: 'Turnero Operador',
                eyebrow: 'Adoption',
                pack: adoptionPack,
            });
            adoptionChipsHost.replaceChildren();
            adoptionPack.chips.forEach((chip) => {
                const chipNode = document.createElement('span');
                adoptionChipsHost.appendChild(chipNode);
                mountTurneroSurfaceCheckpointChip(chipNode, chip);
            });
        }
    );
    renderOperatorSurfaceGoLiveState();
    renderOperatorSurfaceFleetState();
}

function ensureOperatorSurfaceIntegrityPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-integrity="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceIntegrity = 'true';
        host.className = 'turnero-surface-ops__stack';
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceIntegrityPack(state = getState()) {
    const queueState = state?.queue || {};
    const queueMeta = getQueueSource().queueMeta || {};
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket =
        getWaitingForConsultorio(Number(queueState.stationConsultorio || 1)) ||
        (Array.isArray(queueMeta?.nextTickets)
            ? queueMeta.nextTickets[0]
            : null);
    const visibleTurn = String(
        activeTicket?.ticketCode || waitingTicket?.ticketCode || 'A-202'
    )
        .trim()
        .toUpperCase();
    const announcedTurn = String(
        activeTicket?.ticketCode || visibleTurn || 'A-202'
    )
        .trim()
        .toUpperCase();
    const ticketDisplay = visibleTurn.replace(/[^A-Z0-9]/g, '') || 'A202';
    const maskedTicket = maskTurneroTicket(ticketDisplay, 'masked') || 'A**2';
    const syncHealth = getQueueSyncHealth(state);

    return buildTurneroSurfaceIntegrityPack({
        surfaceKey: 'operator-turnos',
        queueVersion: String(
            queueMeta?.updatedAt || queueState.updatedAt || ''
        ).trim(),
        visibleTurn,
        announcedTurn,
        ticketDisplay,
        maskedTicket,
        privacyMode: 'masked',
        heartbeat: {
            state: resolveOperatorSurfaceSyncHeartbeatState(syncHealth),
            channel: resolveOperatorSurfaceSyncHeartbeatChannel(),
        },
        evidence: [],
    });
}

function ensureOperatorSurfaceServiceHandoverPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-service-handover="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceServiceHandover = 'true';
        host.className = 'turnero-surface-ops__stack';
        const integrityHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-integrity="true"]'
        );
        const opsHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceServiceHandoverPack() {
    return buildTurneroSurfaceServiceHandoverPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        scope:
            operatorClinicProfile?.region ||
            operatorClinicProfile?.branding?.city ||
            'regional',
    });
}

function renderOperatorSurfaceServiceHandoverState() {
    const panel = ensureOperatorSurfaceServiceHandoverPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        renderOperatorSurfacePackageState();
        return null;
    }

    const pack = buildOperatorSurfaceServiceHandoverPack();
    operatorRuntime.surfaceServiceHandoverPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceServiceHandoverBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface service handover',
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

function getOperatorSurfaceOnboardingScope() {
    return getOperatorCommercialScope();
}

function ensureOperatorSurfaceOnboardingPanel() {
    let host = document.getElementById('operatorSurfaceOnboardingHost');
    if (!(host instanceof HTMLElement)) {
        const statusNode = getOperatorSurfaceProfileStatusNode();
        if (!(statusNode instanceof HTMLElement)) {
            return null;
        }

        host = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-onboarding="true"]'
        );
        if (!(host instanceof HTMLElement)) {
            host = document.createElement('div');
            host.dataset.turneroOperatorSurfaceOnboarding = 'true';
            host.className = 'turnero-surface-ops__stack';
            const serviceHandoverHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-service-handover="true"]'
            );
            const integrityHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-integrity="true"]'
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

function buildOperatorSurfaceOnboardingPack() {
    const scope = getOperatorSurfaceOnboardingScope();
    const ledgerStore = createTurneroSurfaceOnboardingLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceOnboardingOwnerStore(
        scope,
        operatorClinicProfile
    );

    return buildTurneroSurfaceOnboardingPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        scope,
        runtimeState:
            getOperatorSurfaceContract().state === 'alert'
                ? 'blocked'
                : 'ready',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        kickoffState: 'ready',
        dataIntakeState: 'ready',
        accessState: 'watch',
        onboardingOwner: 'ops-lead',
        trainingWindow: 'martes 09:00',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator-turnos' }),
        owners: ownerStore.list({ surfaceKey: 'operator-turnos' }),
    });
}

function renderOperatorSurfaceOnboardingState() {
    const panel = ensureOperatorSurfaceOnboardingPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildOperatorSurfaceOnboardingPack();
    operatorRuntime.surfaceOnboardingPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceOnboardingBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface onboarding',
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

function renderOperatorSurfaceIntegrityState(state = getState()) {
    const panel = ensureOperatorSurfaceIntegrityPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        return null;
    }

    const pack = buildOperatorSurfaceIntegrityPack(state);
    operatorRuntime.surfaceIntegrityPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceIntegrityBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface integrity',
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

function ensureOperatorSurfaceGoLivePanel() {
    const syncHost = getById('operatorSurfaceSyncHost');
    if (!(syncHost instanceof HTMLElement)) {
        return null;
    }

    let host = syncHost.parentElement?.querySelector(
        '[data-turnero-operator-surface-go-live="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceGoLive = 'true';
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

function getOperatorSurfaceGoLiveScope() {
    return 'operator';
}

function buildOperatorSurfaceGoLivePack() {
    const heartbeatPayload = buildHeartbeatPayload();
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getOperatorSurfaceContract(operatorClinicProfile, 'operator');
    const snapshot = buildTurneroSurfaceGoLiveSnapshot({
        scope: getOperatorSurfaceGoLiveScope(),
        surfaceKey: 'operator',
        surfaceLabel: 'Operador',
        clinicProfile: operatorClinicProfile,
        runtimeState: String(heartbeatPayload.status || 'unknown').trim(),
        truth: String(
            heartbeatPayload.details?.surfaceContractState ||
                surfaceContract.state ||
                heartbeatPayload.status ||
                'unknown'
        ).trim(),
        printerState: operatorRuntime.shell?.available ? 'ready' : 'watch',
        bellState: String(
            heartbeatPayload.details?.readinessState ||
                operatorRuntime.shellRuntime.connectivity ||
                'watch'
        ).trim(),
        signageState:
            heartbeatPayload.details?.surfaceRouteCurrent &&
            heartbeatPayload.details?.surfaceRouteExpected &&
            heartbeatPayload.details.surfaceRouteCurrent ===
                heartbeatPayload.details.surfaceRouteExpected
                ? 'ready'
                : 'watch',
        operatorReady:
            heartbeatPayload.status === 'ready' &&
            surfaceContract.state !== 'alert' &&
            operatorRuntime.online !== false,
        updatedAt: String(
            heartbeatPayload.lastEventAt || heartbeatPayload.reportedAt || ''
        ).trim(),
    });
    const ledger = createTurneroSurfaceGoLiveLedger(
        snapshot.scope,
        operatorClinicProfile
    );

    return buildTurneroSurfaceGoLivePack({
        ...snapshot,
        clinicProfile: operatorClinicProfile,
        evidence: ledger.list({ surfaceKey: snapshot.surfaceKey }),
    });
}

function renderOperatorSurfaceGoLiveState() {
    const panel = ensureOperatorSurfaceGoLivePanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildOperatorSurfaceGoLivePack();
    operatorRuntime.surfaceGoLivePack = pack;
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

function ensureOperatorSurfaceFleetPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-fleet="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceFleet = 'true';
        host.className = 'turnero-surface-ops__stack';
        const supportHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-support="true"]'
        );
        if (supportHost instanceof HTMLElement) {
            supportHost.insertAdjacentElement('afterend', host);
        } else {
            const goLiveHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-go-live="true"]'
            );
            if (goLiveHost instanceof HTMLElement) {
                goLiveHost.insertAdjacentElement('afterend', host);
            } else {
                const integrityHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-operator-surface-integrity="true"]'
                );
                if (integrityHost instanceof HTMLElement) {
                    integrityHost.insertAdjacentElement('afterend', host);
                } else {
                    const opsHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceFleetPack() {
    const goLiveBand = operatorRuntime.surfaceGoLivePack?.gate?.band || 'watch';
    return buildTurneroSurfaceFleetPack({
        surfaceKey: 'operator',
        scope: getOperatorFleetScope(),
        clinicProfile: operatorClinicProfile,
        runtimeState: goLiveBand,
        truth: goLiveBand === 'ready' ? 'aligned' : 'watch',
    });
}

function renderOperatorSurfaceFleetState() {
    const panel = ensureOperatorSurfaceFleetPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildOperatorSurfaceFleetPack();
    operatorRuntime.surfaceFleetPack = pack;
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

function ensureOperatorSurfaceSupportPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-support="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceSupport = 'true';
        host.className = 'turnero-surface-ops__stack';
        const goLiveHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-go-live="true"]'
        );
        if (goLiveHost instanceof HTMLElement) {
            goLiveHost.insertAdjacentElement('afterend', host);
        } else {
            const integrityHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-integrity="true"]'
            );
            if (integrityHost instanceof HTMLElement) {
                integrityHost.insertAdjacentElement('afterend', host);
            } else {
                const opsHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceSupportPack(state = getState()) {
    const currentRoute =
        typeof window !== 'undefined' && window.location
            ? `${window.location.pathname || ''}${window.location.hash || ''}`
            : '';
    return buildTurneroSurfaceSupportPack({
        scope: 'queue-support',
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        currentRoute,
        runtimeState: state?.queue || null,
    });
}

function renderOperatorSurfaceSupportState(state = getState()) {
    const panel = ensureOperatorSurfaceSupportPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildOperatorSurfaceSupportPack(state);
    operatorRuntime.surfaceSupportPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceSupportBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface support',
    });
    panel.chipsHost.replaceChildren();
    (Array.isArray(pack.readout?.chips) ? pack.readout.chips : []).forEach(
        (chip) => {
            const chipNode = document.createElement('span');
            panel.chipsHost.appendChild(chipNode);
            mountTurneroSurfaceCheckpointChip(chipNode, chip);
        }
    );
    const executiveReviewPanel = ensureOperatorSurfaceExecutiveReviewPanel();
    if (executiveReviewPanel) {
        const executiveReviewPack = buildOperatorSurfaceExecutiveReviewPack();
        operatorRuntime.surfaceExecutiveReviewPack = executiveReviewPack;
        executiveReviewPanel.host.hidden = false;
        executiveReviewPanel.host.dataset.state = executiveReviewPack.gate.band;
        executiveReviewPanel.host.dataset.band = executiveReviewPack.gate.band;
        executiveReviewPanel.bannerHost.replaceChildren();
        mountTurneroSurfaceExecutiveReviewBanner(executiveReviewPanel.bannerHost, {
            pack: executiveReviewPack,
            title: 'Operator surface executive review',
            eyebrow: 'Executive review gate',
        });
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
    renderOperatorSurfacePackageState(state);
    return pack;
}

function getOperatorSurfacePackageScope() {
    return getOperatorCommercialScope();
}

function ensureOperatorSurfacePackagePanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-package="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfacePackage = 'true';
        host.className = 'turnero-surface-ops__stack';
        const supportHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-support="true"]'
        );
        if (supportHost instanceof HTMLElement) {
            supportHost.insertAdjacentElement('afterend', host);
        } else {
            const goLiveHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-go-live="true"]'
            );
            if (goLiveHost instanceof HTMLElement) {
                goLiveHost.insertAdjacentElement('afterend', host);
            } else {
                const integrityHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-operator-surface-integrity="true"]'
                );
                if (integrityHost instanceof HTMLElement) {
                    integrityHost.insertAdjacentElement('afterend', host);
                } else {
                    const opsHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfacePackagePack(state = getState()) {
    const scope = getOperatorSurfacePackageScope();
    const ledgerStore = createTurneroSurfacePackageLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfacePackageOwnerStore(
        scope,
        operatorClinicProfile
    );
    const syncHealth = getQueueSyncHealth(state);
    const pack = buildTurneroSurfacePackagePack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        runtimeState: syncHealth.degraded
            ? 'degraded'
            : syncHealth.syncMode || 'live',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        packageTier: 'pilot-plus',
        bundleState: 'watch',
        provisioningState: 'watch',
        onboardingKitState: 'draft',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator' }),
        owners: ownerStore.list({ surfaceKey: 'operator' }),
    });

    return {
        ...pack,
    };
}

function renderOperatorSurfacePackageState(state = getState()) {
    const panel = ensureOperatorSurfacePackagePanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfacePackagePack = null;
        renderOperatorSurfaceRoadmapState(state);
        return null;
    }

    const pack = buildOperatorSurfacePackagePack(state);
    operatorRuntime.surfacePackagePack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfacePackageBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface package',
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
    renderOperatorSurfaceRoadmapState(state);
    return pack;
}

function getOperatorSurfaceRoadmapScope() {
    return getOperatorCommercialScope();
}

function ensureOperatorSurfaceRoadmapPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-roadmap="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceRoadmap = 'true';
        host.className = 'turnero-surface-ops__stack';
        const packageHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-package="true"]'
        );
        if (packageHost instanceof HTMLElement) {
            packageHost.insertAdjacentElement('afterend', host);
        } else {
            const supportHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-support="true"]'
            );
            if (supportHost instanceof HTMLElement) {
                supportHost.insertAdjacentElement('afterend', host);
            } else {
                const goLiveHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-operator-surface-go-live="true"]'
                );
                if (goLiveHost instanceof HTMLElement) {
                    goLiveHost.insertAdjacentElement('afterend', host);
                } else {
                    const integrityHost = statusNode.parentElement?.querySelector(
                        '[data-turnero-operator-surface-integrity="true"]'
                    );
                    if (integrityHost instanceof HTMLElement) {
                        integrityHost.insertAdjacentElement('afterend', host);
                    } else {
                        const opsHost = statusNode.parentElement?.querySelector(
                            '[data-turnero-operator-surface-ops="true"]'
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

function buildOperatorSurfaceRoadmapPack(state = getState()) {
    const scope = getOperatorSurfaceRoadmapScope();
    const ledgerStore = createTurneroSurfaceRoadmapLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceRoadmapOwnerStore(
        scope,
        operatorClinicProfile
    );
    const syncHealth = getQueueSyncHealth(state);
    return buildTurneroSurfaceRoadmapPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        runtimeState: syncHealth.degraded
            ? 'degraded'
            : syncHealth.syncMode || 'live',
        truth:
            operatorRuntime.surfaceIntegrityPack?.drift?.state === 'aligned'
                ? 'aligned'
                : 'watch',
        roadmapBand: 'core',
        backlogState: 'curated',
        nextAction: 'stabilize-operator-lane',
        priorityBand: 'p1',
        roadmapOwner: 'ops-lead',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator' }),
        owners: ownerStore.list({ surfaceKey: 'operator' }),
    });
}

function renderOperatorSurfaceRoadmapState(state = getState()) {
    const panel = ensureOperatorSurfaceRoadmapPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfaceRoadmapPack = null;
        renderOperatorSurfaceExecutiveReviewState(state);
        return null;
    }

    const pack = buildOperatorSurfaceRoadmapPack(state);
    operatorRuntime.surfaceRoadmapPack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceRoadmapBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface roadmap',
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
    renderOperatorSurfaceExecutiveReviewState(state);
    return pack;
}

function getOperatorSurfaceExecutiveReviewScope() {
    return getOperatorCommercialScope();
}

function buildOperatorSurfaceExecutiveReviewPack() {
    const scope = getOperatorSurfaceExecutiveReviewScope();
    const ledgerStore = createTurneroSurfaceExecutiveReviewLedger(
        scope,
        operatorClinicProfile
    );
    const ownerStore = createTurneroSurfaceExecutiveReviewOwnerStore(
        scope,
        operatorClinicProfile
    );

    return buildTurneroSurfaceExecutiveReviewPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        scope,
        runtimeState: 'ready',
        truth: 'watch',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'watch',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-lead',
        checklist: {
            summary: {
                all: 4,
                pass: 3,
                fail: 1,
            },
        },
        ledger: ledgerStore.list({ surfaceKey: 'operator' }),
        owners: ownerStore.list({ surfaceKey: 'operator' }),
    });
}

function ensureOperatorSurfaceExecutiveReviewPanel() {
    const statusNode = getOperatorSurfaceProfileStatusNode();
    if (!(statusNode instanceof HTMLElement)) {
        return null;
    }

    let host = statusNode.parentElement?.querySelector(
        '[data-turnero-operator-surface-executive-review="true"]'
    );
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.dataset.turneroOperatorSurfaceExecutiveReview = 'true';
        host.id = 'operatorSurfaceExecutiveReviewHost';
        host.className = 'turnero-surface-ops__stack';
        const packageHost = statusNode.parentElement?.querySelector(
            '[data-turnero-operator-surface-package="true"]'
        );
        if (packageHost instanceof HTMLElement) {
            packageHost.insertAdjacentElement('afterend', host);
        } else {
            const acceptanceHost = statusNode.parentElement?.querySelector(
                '[data-turnero-operator-surface-acceptance="true"]'
            );
            if (acceptanceHost instanceof HTMLElement) {
                acceptanceHost.insertAdjacentElement('beforebegin', host);
            } else {
                const supportHost = statusNode.parentElement?.querySelector(
                    '[data-turnero-operator-surface-support="true"]'
                );
                if (supportHost instanceof HTMLElement) {
                    supportHost.insertAdjacentElement('afterend', host);
                } else {
                    statusNode.insertAdjacentElement('afterend', host);
                }
            }
        }
    }

    host.id = 'operatorSurfaceExecutiveReviewHost';

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

function renderOperatorSurfaceExecutiveReviewState(state = getState()) {
    const panel = ensureOperatorSurfaceExecutiveReviewPanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        operatorRuntime.surfaceExecutiveReviewPack = null;
        return null;
    }

    const pack = buildOperatorSurfaceExecutiveReviewPack(state);
    operatorRuntime.surfaceExecutiveReviewPack = pack;
    panel.host.hidden = false;
    panel.host.dataset.state = pack.gate.band;
    panel.host.dataset.band = pack.gate.band;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceExecutiveReviewBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface executive review',
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

function ensureOperatorSurfaceAcceptancePanel() {
    const host = getById('operatorSurfaceAcceptanceHost');
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

function buildOperatorSurfaceAcceptancePack() {
    const currentRoute =
        typeof window !== 'undefined' && window.location
            ? `${window.location.pathname || ''}${window.location.hash || ''}`
            : '';
    return buildTurneroSurfaceAcceptancePack({
        surfaceKey: 'operator-turnos',
        clinicProfile: operatorClinicProfile,
        currentRoute,
    });
}

function renderOperatorSurfaceAcceptanceState() {
    const panel = ensureOperatorSurfaceAcceptancePanel();
    if (!panel) {
        return null;
    }

    if (!operatorClinicProfile) {
        panel.host.hidden = true;
        panel.bannerHost.replaceChildren();
        panel.chipsHost.replaceChildren();
        return null;
    }

    const pack = buildOperatorSurfaceAcceptancePack();
    operatorRuntime.surfaceAcceptancePack = pack;
    panel.host.hidden = false;
    panel.bannerHost.replaceChildren();
    mountTurneroSurfaceAcceptanceBanner(panel.bannerHost, {
        pack,
        title: 'Operator surface acceptance',
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

function renderOperatorProfileStatus(profile) {
    getOperatorSurfaceProfileStatusNode();
    const surfaceRuntime = buildTurneroSurfaceRuntimeStatus(
        profile,
        'operator'
    );
    const state =
        surfaceRuntime.uiState === 'alert'
            ? 'danger'
            : surfaceRuntime.uiState === 'warning'
              ? 'warning'
              : 'success';
    const text = surfaceRuntime.text;

    document
        .querySelectorAll('.queue-operator-profile-status')
        .forEach((node) => {
            if (!(node instanceof HTMLElement)) {
                return;
            }
            node.dataset.state = state;
            node.textContent = text;
        });
    renderOperatorSurfaceOps();
    renderOperatorSurfaceIntegrityState();
    renderOperatorSurfaceServiceHandoverState();
    renderOperatorSurfaceOnboardingState();
    renderOperatorSurfaceAcceptanceState();
    renderOperatorSurfaceCommercialState();
}

function getOperatorSurfaceContract(profile = operatorClinicProfile) {
    return (
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(profile, 'operator')
    );
}

function getOperatorPilotBlockDetail() {
    const surfaceContract = getOperatorSurfaceContract();
    if (surfaceContract.state !== 'alert') {
        return '';
    }

    if (surfaceContract.reason === 'profile_missing') {
        return 'No se puede operar este equipo: clinic-profile.json remoto ausente. Corrige el perfil y recarga la página antes de llamar tickets.';
    }

    return `No se puede operar este equipo: la ruta no coincide con el canon del piloto (${surfaceContract.expectedRoute || '/operador-turnos.html'}). Corrige el acceso antes de operar la cola.`;
}

function isOperatorPilotBlocked() {
    return getOperatorSurfaceContract().state === 'alert';
}

function notifyOperatorPilotBlocked() {
    const detail = getOperatorPilotBlockDetail();
    if (!detail) {
        return;
    }

    const now = Date.now();
    if (
        now - Number(operatorRuntime.pilotBlockToastAt || 0) <
        OPERATOR_PILOT_BLOCK_TOAST_COOLDOWN_MS
    ) {
        return;
    }

    operatorRuntime.pilotBlockToastAt = now;
    createToast(detail, 'error');
}

function applyOperatorClinicProfile(profile) {
    operatorClinicProfile = profile;
    operatorRuntime.surfaceContract = getTurneroSurfaceContract(
        profile,
        'operator'
    );
    const clinicName = getTurneroClinicBrandName(profile);
    const clinicShortName = getTurneroClinicShortName(profile);
    const clinicId = String(profile?.clinic_id || '').trim() || 'sin-clinic-id';
    const clinicCity = String(profile?.branding?.city || '').trim();
    const consultorioSummary = [
        getTurneroConsultorioLabel(profile, 1, { short: true }),
        getTurneroConsultorioLabel(profile, 2, { short: true }),
    ].join(' / ');
    const operatorRoute = String(
        profile?.surfaces?.operator?.route || '/operador-turnos.html'
    ).trim();
    const releaseMode = getTurneroClinicReleaseMode(profile);

    document.title = `Turnero Operador - ${clinicName}`;
    document.querySelectorAll('.queue-operator-kicker').forEach((node) => {
        if (node instanceof HTMLElement) {
            node.textContent = `${clinicShortName} · Operador`;
        }
    });
    setText(
        '#operatorClinicMeta',
        [
            'Piloto web por clínica',
            clinicId,
            clinicCity || clinicShortName,
            `releaseMode ${releaseMode}`,
        ]
            .filter(Boolean)
            .join(' · ')
    );
    setText(
        '#operatorSurfaceMeta',
        `Ruta ${operatorRoute} · ${consultorioSummary}`
    );
    renderOperatorProfileStatus(profile);
    renderOperatorSurfaceIntegrityState();
    renderOperatorSurfaceRecoveryState();
    renderOperatorSurfaceAcceptanceState();
    renderOperatorSurfaceSupportState();
}

function getDesktopBridge() {
    return typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null
        ? window.turneroDesktop
        : null;
}

function getQueueSyncHealth(state = getState()) {
    const syncMode = String(state?.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state?.queue?.fallbackPartial);
    const degraded = syncMode === 'fallback' || fallbackPartial;

    return {
        syncMode,
        fallbackPartial,
        degraded,
    };
}

function getOperatorSurfaceSyncScope() {
    return (
        String(operatorClinicProfile?.clinic_id || '').trim() ||
        'default-clinic'
    );
}

function getOperatorSurfaceSyncKey(state = getState()) {
    const surfaceState = buildOperatorSurfaceState(state.queue);
    return `operator:c${Number(surfaceState.stationConsultorio || 1) || 1}`;
}

function resolveOperatorSurfaceSyncHeartbeatState(syncHealth) {
    if (!operatorRuntime.online) {
        return 'offline';
    }
    if (
        operatorRuntime.shellRuntime.mode === 'offline' ||
        syncHealth.degraded
    ) {
        return 'warning';
    }
    return 'ready';
}

function resolveOperatorSurfaceSyncHeartbeatChannel() {
    if (operatorRuntime.shell.available) {
        return 'desktop';
    }
    return operatorRuntime.shellRuntime.mode === 'offline'
        ? 'browser-offline'
        : 'browser';
}

function buildOperatorSurfaceSyncPack(
    state = getState(),
    syncHealth = getQueueSyncHealth(state)
) {
    const { queueMeta } = getQueueSource();
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket =
        getWaitingForConsultorio(Number(state.queue.stationConsultorio || 1)) ||
        (Array.isArray(queueMeta?.nextTickets)
            ? queueMeta.nextTickets[0]
            : null);
    const callingNow = Object.values(
        queueMeta?.callingNowByConsultorio &&
            typeof queueMeta.callingNowByConsultorio === 'object'
            ? queueMeta.callingNowByConsultorio
            : {}
    ).filter(Boolean);
    const nextTickets = Array.isArray(queueMeta?.nextTickets)
        ? queueMeta.nextTickets
        : [];
    const surfaceKey = getOperatorSurfaceSyncKey(state);
    const handoffStore = createTurneroSurfaceHandoffLedger(
        getOperatorSurfaceSyncScope(),
        operatorClinicProfile
    );
    const handoffs = handoffStore.list({
        includeClosed: false,
        surfaceKey,
    });
    const expectedVisibleTurn = String(
        activeTicket?.ticketCode || waitingTicket?.ticketCode || ''
    )
        .trim()
        .toUpperCase();
    const announcedTurn = String(activeTicket?.ticketCode || '')
        .trim()
        .toUpperCase();

    return buildTurneroSurfaceSyncPack({
        surfaceKey,
        queueVersion: String(queueMeta?.updatedAt || '').trim(),
        visibleTurn: expectedVisibleTurn,
        announcedTurn,
        handoffState: resolveTurneroSurfaceHandoffState(handoffs),
        heartbeat: {
            state: resolveOperatorSurfaceSyncHeartbeatState(syncHealth),
            channel: resolveOperatorSurfaceSyncHeartbeatChannel(),
        },
        updatedAt: String(
            queueMeta?.updatedAt || activeTicket?.calledAt || ''
        ).trim(),
        counts: queueMeta?.counts || null,
        waitingCount: Number(queueMeta?.waitingCount || 0),
        calledCount: Number(queueMeta?.calledCount || 0),
        callingNow,
        nextTickets,
        expectedVisibleTurn,
        expectedQueueVersion: String(queueMeta?.updatedAt || '').trim(),
        handoffs,
    });
}

function renderOperatorSurfaceSyncState(
    state = getState(),
    syncHealth = getQueueSyncHealth(state)
) {
    const host = getById('operatorSurfaceSyncHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const pack = buildOperatorSurfaceSyncPack(state, syncHealth);
    operatorRuntime.surfaceSyncPack = pack;
    const readout = buildTurneroSurfaceSyncReadout(pack);
    host.replaceChildren();
    mountTurneroSurfaceSyncBanner(host, {
        title: 'Operator surface sync',
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
    renderOperatorSurfaceIntegrityState(state);
    renderOperatorSurfaceServiceHandoverState();
    renderOperatorSurfaceCommercialState();
    renderOperatorSurfaceSupportState(state);
    renderOperatorSurfaceGoLiveState();
    return pack;
}

function renderOperatorSurfaceRecoveryState(
    state = getState(),
    syncHealth = getQueueSyncHealth(state)
) {
    const host = getById('operatorSurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const runtimeState = {
        online: operatorRuntime.online,
        connectivity: operatorRuntime.shellRuntime.connectivity,
        mode: operatorRuntime.shellRuntime.mode,
        reason: operatorRuntime.shellRuntime.reason,
        authenticated: Boolean(state?.auth?.authenticated),
        pendingCount: operatorRuntime.shellRuntime.outboxSize,
        outboxSize: operatorRuntime.shellRuntime.outboxSize,
        reconciliationSize: operatorRuntime.shellRuntime.reconciliationSize,
        updateChannel: operatorRuntime.shellRuntime.updateChannel,
        summary: getOperatorRuntimeSummary(syncHealth),
    };
    const pack = buildTurneroSurfaceRecoveryPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        runtimeState,
        heartbeat: buildHeartbeatPayload(),
    });
    const readout = buildTurneroSurfaceContractReadout({
        snapshot: pack.snapshot,
        drift: pack.drift,
        gate: pack.gate,
        readiness: pack.readiness,
    });

    host.replaceChildren();
    mountTurneroSurfaceRecoveryBanner(host, {
        title: 'Operator surface recovery',
        snapshot: pack.snapshot,
        drift: pack.drift,
        gate: pack.gate,
        readiness: pack.readiness,
        readout,
    });

    const chips = document.createElement('div');
    chips.className = 'turnero-surface-recovery-checkpoints';
    host.appendChild(chips);
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

    renderOperatorSurfaceRolloutState(state, syncHealth, runtimeState);
    renderOperatorSurfaceDeliveryState(state, runtimeState);

    return pack;
}

function renderOperatorSurfaceRolloutState(
    state = getState(),
    syncHealth = getQueueSyncHealth(state),
    runtimeState = null
) {
    const host = getById('operatorSurfaceRecoveryHost');
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const surfaceBootstrapState = operatorRuntime.surfaceBootstrap?.state || {};
    const pack = buildTurneroSurfaceRolloutPack({
        surfaceKey: 'operator',
        clinicProfile: operatorClinicProfile,
        surfaceRegistry: surfaceBootstrapState.registry || {},
        releaseManifest: surfaceBootstrapState.registry?.manifest || {},
        runtimeState: runtimeState || {
            state:
                !operatorRuntime.online ||
                operatorRuntime.shellRuntime.connectivity === 'offline'
                    ? 'blocked'
                    : syncHealth.degraded
                      ? 'watch'
                      : 'ready',
            status: operatorRuntime.shellRuntime.mode,
            summary: getOperatorRuntimeSummary(syncHealth),
            online: operatorRuntime.online,
            connectivity: operatorRuntime.shellRuntime.connectivity,
            mode: operatorRuntime.shellRuntime.mode,
            reason: operatorRuntime.shellRuntime.reason,
        },
        truth:
            surfaceBootstrapState.truthSummary?.mode ||
            surfaceBootstrapState.truthPack?.summary?.mode ||
            '',
        currentRoute: `${window.location.pathname || ''}${
            window.location.hash || ''
        }`,
    });

    const rolloutHost = document.createElement('section');
    rolloutHost.className =
        'turnero-surface-rollout-stack turnero-surface-ops__stack';
    host.appendChild(rolloutHost);
    mountTurneroSurfaceRolloutBanner(rolloutHost, {
        title: 'Operator surface rollout',
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

function getOperatorMutationBlocker(state = getState()) {
    if (!state?.auth?.authenticated) {
        return null;
    }

    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return null;
    }

    if (
        !operatorRuntime.online ||
        operatorRuntime.shellRuntime.connectivity === 'offline'
    ) {
        const safeReason = operatorRuntime.shellRuntime.reason;
        return {
            key: 'offline_safe',
            tone: 'danger',
            title: 'Modo seguro',
            summary:
                safeReason === 'snapshot_expired'
                    ? 'El último snapshot válido ya venció. Mantén la vista solo como referencia y espera red antes de volver a operar.'
                    : safeReason === 'no_authenticated_session'
                      ? 'No hay una sesión previa válida y el login offline no está disponible. Mantén la pantalla en solo lectura.'
                      : safeReason === 'reconciliation_pending'
                        ? 'Hay acciones en conciliación. Mantén la cola en línea o solo lectura hasta limpiarlas.'
                        : 'La consola quedó en modo seguro. Puedes revisar la cola o hardware, pero no llamar ni cerrar tickets hasta recuperar red.',
            toast: 'Modo seguro activo. Las acciones sobre tickets quedan bloqueadas hasta recuperar conexión.',
        };
    }

    if (getQueueSyncHealth(state).degraded) {
        return {
            key: 'fallback',
            tone: 'warning',
            title: 'Cola en fallback local',
            summary:
                'La superficie está mostrando cache local. Puedes revisar contexto y preparar hardware, pero evita llamar, reasignar o cerrar tickets hasta volver a sincronizar.',
            toast: 'Cola en fallback local. Refresca y espera sincronización antes de operar tickets.',
        };
    }

    return null;
}

async function refreshDesktopSnapshot() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.getRuntimeSnapshot !== 'function') {
        operatorRuntime.shell = createEmptyShellState();
        syncOperatorShellRuntime(createEmptyShellRuntimeState());
        syncShellSettingsButton();
        return operatorRuntime.shell;
    }

    try {
        const snapshot = await bridge.getRuntimeSnapshot();
        operatorRuntime.shell = hydrateOperatorShellState(snapshot);
        syncOperatorShellRuntime(
            snapshot?.shellStatus || operatorRuntime.shellRuntime,
            operatorRuntime.shellRuntimeSnapshot
        );
    } catch (_error) {
        operatorRuntime.shell = createEmptyShellState();
    }

    syncShellSettingsButton();
    return operatorRuntime.shell;
}

function resolveOperatorAppMode() {
    const bridge = getDesktopBridge();
    return operatorRuntime.shell.available ||
        (bridge && typeof bridge.openSettings === 'function')
        ? 'desktop'
        : 'web';
}

function buildOperatorHeartbeatPayload() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const syncHealth = getQueueSyncHealth(state);
    const surfaceSyncPack =
        operatorRuntime.surfaceSyncPack ||
        buildOperatorSurfaceSyncPack(state, syncHealth);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const clinicId = String(operatorClinicProfile?.clinic_id || '').trim();
    const clinicName = String(
        operatorClinicProfile?.branding?.name ||
            operatorClinicProfile?.branding?.short_name ||
            ''
    ).trim();
    const profileFingerprint = getTurneroClinicProfileFingerprint(
        operatorClinicProfile
    );
    const profileSource = String(
        operatorClinicProfile?.runtime_meta?.source || 'remote'
    ).trim();
    const releaseMode = getTurneroClinicReleaseMode(operatorClinicProfile);
    const readiness = getTurneroClinicReadiness(operatorClinicProfile);
    const payload = buildHeartbeatPayload({
        queueState: state.queue,
        online: operatorRuntime.online,
        shell: operatorRuntime.shell,
        shellRuntime: operatorRuntime.shellRuntime,
        appMode: resolveOperatorAppMode(),
        numpadStatus,
        syncHealth,
        surfaceSyncSnapshot: surfaceSyncPack.snapshot,
        surfaceSyncHandoffOpenCount: surfaceSyncPack.handoffs.filter(
            (handoff) => handoff.status !== 'closed'
        ).length,
    });
    if (surfaceContract.state === 'alert') {
        payload.status = 'alert';
        payload.summary = surfaceContract.detail;
    }
    payload.details = {
        ...(payload.details && typeof payload.details === 'object'
            ? payload.details
            : {}),
        clinicId,
        clinicName,
        profileSource,
        profileFingerprint,
        releaseMode,
        readinessState: String(readiness.state || ''),
        readinessSummary: String(readiness.summary || ''),
        surfaceContractState: String(surfaceContract.state || ''),
        surfaceRouteExpected: String(surfaceContract.expectedRoute || ''),
        surfaceRouteCurrent: String(surfaceContract.currentRoute || ''),
    };
    payload.clinicId = clinicId;
    payload.clinicName = clinicName;
    payload.profileSource = profileSource;
    payload.profileFingerprint = profileFingerprint;
    payload.releaseMode = releaseMode;
    payload.readinessState = String(readiness.state || '');
    payload.surfaceContractState = String(surfaceContract.state || '');
    payload.surfaceRouteExpected = String(surfaceContract.expectedRoute || '');
    payload.surfaceRouteCurrent = String(surfaceContract.currentRoute || '');
    return payload;
}

function ensureOperatorHeartbeat() {
    if (operatorHeartbeat) {
        return operatorHeartbeat;
    }

    operatorHeartbeat = createSurfaceHeartbeatClient({
        surface: 'operator',
        intervalMs: OPERATOR_HEARTBEAT_MS,
        getPayload: buildOperatorHeartbeatPayload,
    });
    return operatorHeartbeat;
}

function syncOperatorHeartbeat(
    reason = 'state_change',
    { force = false } = {}
) {
    if (!getState().auth.authenticated) {
        operatorHeartbeat?.stop();
        return;
    }
    const heartbeat = ensureOperatorHeartbeat();
    if (force) {
        void heartbeat.beatNow(reason);
        return;
    }
    heartbeat.notify(reason);
}

function setLoginStatus(state, title, message) {
    const card = getById('operatorLoginStatus');
    const titleNode = getById('operatorLoginStatusTitle');
    const messageNode = getById('operatorLoginStatusMessage');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', state);
    }
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
}

function setOperatorLoginMode(operatorMode) {
    const operatorFlow = getById('operatorOpenClawFlow');
    const legacyFields = getById('operatorLegacyLoginFields');

    if (operatorFlow instanceof HTMLElement) {
        operatorFlow.classList.toggle('is-hidden', !operatorMode);
    }
    if (legacyFields instanceof HTMLElement) {
        legacyFields.classList.toggle('is-hidden', operatorMode);
    }
}

function formatOperatorChallengeExpiry(challenge) {
    const expiresAt = String(challenge?.expiresAt || '').trim();
    if (expiresAt === '') {
        return '';
    }

    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function normalizeOperatorTransport(value, fallback = '') {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'web_broker') {
        return 'web_broker';
    }
    if (raw === 'local_helper') {
        return 'local_helper';
    }
    return fallback;
}

function readOperatorAuthError(auth) {
    return String(auth?.lastError || auth?.error || '').trim();
}

function openOperatorWebBrokerFlow(redirectUrl) {
    const url = String(redirectUrl || '').trim();
    if (!url) {
        return false;
    }

    try {
        window.location.replace(url);
        return true;
    } catch (_error) {
        return false;
    }
}

function resolveOperatorAuthCopy(auth) {
    const status = String(auth?.status || 'anonymous')
        .trim()
        .toLowerCase();
    const helperOpened = auth?.helperUrlOpened === true;
    const expiresAt = formatOperatorChallengeExpiry(auth?.challenge);
    const transport = normalizeOperatorTransport(
        auth?.transport,
        normalizeOperatorTransport(auth?.openClawSnapshot?.transport, '')
    );
    const lastError = readOperatorAuthError(auth);

    switch (status) {
        case 'pending':
            if (transport === 'web_broker') {
                return {
                    tone: 'warning',
                    title: 'Continua con OpenClaw',
                    message:
                        lastError ||
                        'Tu acceso web con Google sigue pendiente. Continúa con OpenClaw en esta misma pantalla para terminar el ingreso del turnero.',
                    summary:
                        'El broker retomará la misma sesión web del operador sin crear otro inicio.',
                    primaryLabel: 'Continuar con OpenClaw',
                    helperMeta: expiresAt
                        ? `El acceso web actual expira a las ${expiresAt}.`
                        : 'El acceso web actual seguirá activo por unos minutos.',
                    showRetry: false,
                    showLinkHint: false,
                };
            }
            return {
                tone: 'warning',
                title: 'Esperando confirmación en OpenClaw',
                message:
                    'Completa el login de Google en la ventana abierta y el turnero se autenticará automáticamente.',
                summary:
                    'La misma sesión quedará disponible para operar el turnero sin usar clave local.',
                primaryLabel: 'Volver a abrir OpenClaw',
                helperMeta: expiresAt
                    ? `El challenge actual expira a las ${expiresAt}.`
                    : 'El challenge actual seguirá activo por unos minutos.',
                showRetry: true,
                showLinkHint: !helperOpened,
            };
        case 'openclaw_no_logueado':
            return {
                tone: 'warning',
                title: 'OpenClaw necesita tu sesión',
                message:
                    lastError ||
                    'OpenClaw no encontró un perfil OAuth válido en este equipo.',
                summary:
                    'Inicia sesión en OpenClaw con tu perfil autorizado y luego genera un nuevo enlace.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Cuando OpenClaw tenga sesión activa, el siguiente challenge debería autenticarse sin pedir clave.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'No se pudo completar el bridge',
                message:
                    lastError ||
                    'El helper local de OpenClaw no respondió desde este equipo.',
                summary:
                    'Verifica que el bridge local siga vivo antes de volver a generar el challenge.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el helper fue reiniciado, genera un challenge nuevo.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'El enlace expiró',
                message:
                    lastError ||
                    'El challenge de OpenClaw expiró antes de completar la autenticación.',
                summary:
                    'Genera un nuevo enlace y termina el login sin cerrar esta pantalla.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El nuevo challenge se abrirá en una ventana aparte para completar el acceso.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'email_no_permitido':
            return {
                tone: 'danger',
                title: 'Email no autorizado',
                message:
                    lastError ||
                    'La cuenta autenticada en OpenClaw no está autorizada para operar este turnero.',
                summary:
                    'Cierra esa sesión en OpenClaw y vuelve a intentar con un correo permitido.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El próximo intento usará un challenge nuevo para otro perfil.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'identity_missing':
            return {
                tone: 'danger',
                title: 'Identidad incompleta',
                message:
                    lastError ||
                    'OpenClaw no devolvió una identidad utilizable para este turnero.',
                summary:
                    'Usa una cuenta que publique email valido para este turnero antes de reintentar.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'El siguiente intento pedira otra vez la identidad en el broker web.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'identity_unverified':
            return {
                tone: 'danger',
                title: 'Email no verificado',
                message:
                    lastError ||
                    'OpenClaw autenticó la cuenta, pero no confirmó un email verificado para este turnero.',
                summary:
                    'Vuelve a entrar con una cuenta con email verificado para continuar.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'Este acceso exige la validacion fuerte del broker web antes de dejarte continuar.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'broker_claims_invalid':
            return {
                tone: 'danger',
                title: 'Identidad no confiable',
                message:
                    lastError ||
                    'No se pudieron validar los claims firmados que OpenClaw devolvió para este acceso.',
                summary:
                    'Revisa la configuracion OIDC del broker antes de volver a intentarlo.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'El siguiente intento exigirá un id_token firmado válido para este equipo.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'cancelled':
            return {
                tone: 'warning',
                title: 'Login cancelado',
                message:
                    lastError ||
                    'Cancelaste el login web de OpenClaw antes de volver al turnero.',
                summary:
                    'Puedes lanzar un intento nuevo en esta misma pantalla cuando quieras.',
                primaryLabel: 'Continuar con OpenClaw',
                helperMeta:
                    'La próxima vez volveremos a abrir otra vez el broker web para terminar el acceso.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'invalid_state':
            return {
                tone: 'warning',
                title: 'Intento expirado',
                message:
                    lastError ||
                    'El intento web ya no es válido. Genera uno nuevo para seguir.',
                summary:
                    'Este equipo no pudo retomar la sesion previa, asi que necesitara un intento nuevo.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'El siguiente click emitira una redireccion nueva para este equipo.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'broker_unavailable':
            return {
                tone: 'danger',
                title: 'Broker no disponible',
                message:
                    lastError ||
                    'OpenClaw no respondió a tiempo durante el login web.',
                summary:
                    'Si vuelve a pasar, vuelve a intentarlo desde esta misma pantalla cuando el broker responda otra vez.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'No hace falta helper local para reabrir el broker web.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'code_exchange_failed':
            return {
                tone: 'danger',
                title: 'Codigo no validado',
                message:
                    lastError ||
                    'No se pudo intercambiar el código devuelto por OpenClaw.',
                summary:
                    'Necesitamos que Google emita otro codigo para este equipo antes de continuar.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'El siguiente click abrira una nueva redireccion al broker web.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'transport_misconfigured':
            return {
                tone: 'danger',
                title: 'Runtime desalineado',
                message:
                    lastError ||
                    'El runtime devolvió un estado OpenClaw sin transport válido.',
                summary:
                    'Corrige el runtime del broker para que publique un transport válido antes de seguir.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'Necesitamos transport=web_broker o local_helper para volver a emitir el acceso.',
                showRetry: true,
                showLinkHint: false,
            };
        case 'operator_auth_not_configured':
            return {
                tone: 'danger',
                title: 'OpenClaw no está configurado',
                message:
                    lastError ||
                    'Falta configuración del bridge local para completar el acceso.',
                summary:
                    'Corrige la configuración antes de volver a generar un enlace.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'Cuando la configuración vuelva a estar disponible, podrás crear un challenge nuevo.',
                showRetry: true,
                showLinkHint: false,
            };
        default:
            return {
                tone: 'neutral',
                title: 'PIN operativo y Google',
                message:
                    'Usa Google en OpenClaw para validar la sesión del turnero sin pedir una clave local en este equipo.',
                summary:
                    'La sesión quedará compartida con el panel administrativo y el modo operativo seguirá listo para reingresar.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el navegador bloquea la ventana, podrás usar el enlace manual.',
                showRetry: false,
                showLinkHint: true,
            };
    }
}

function syncOperatorLoginSurface(auth = getState().auth) {
    const operatorMode = isOperatorAuthMode(auth);
    const transport = normalizeOperatorTransport(
        auth?.transport,
        normalizeOperatorTransport(auth?.openClawSnapshot?.transport, '')
    );
    const openButton = getById('operatorOpenClawBtn');
    const retryButton = getById('operatorOpenClawRetryBtn');
    const summaryNode = getById('operatorOpenClawSummary');
    const helperMeta = getById('operatorOpenClawHelperMeta');
    const helperLink = getById('operatorOpenClawHelperLink');
    const helperLinkRow = getById('operatorOpenClawLinkRow');
    const manualRow = getById('operatorOpenClawManualRow');
    const manualCode = getById('operatorOpenClawManualCode');

    setOperatorLoginMode(operatorMode);

    if (!operatorMode) {
        setLoginStatus(
            auth.requires2FA ? 'warning' : 'neutral',
            auth.requires2FA ? 'Código 2FA requerido' : 'Acceso protegido',
            auth.requires2FA
                ? 'La contraseña fue validada. Ingresa ahora el código de seis dígitos.'
                : 'Inicia sesión para abrir la consola operativa del turnero.'
        );
        return;
    }

    show2FA(false);
    resetLoginForm();

    const copy = resolveOperatorAuthCopy(auth);
    const challenge = auth?.challenge || null;
    const helperUrl = String(challenge?.helperUrl || '').trim();
    const manualValue = String(challenge?.manualCode || '').trim();
    const supportsLocalHelperFallback = transport === 'local_helper';

    setLoginStatus(copy.tone, copy.title, copy.message);

    if (summaryNode) {
        summaryNode.textContent = copy.summary;
    }
    if (helperMeta) {
        helperMeta.textContent = copy.helperMeta;
    }
    if (openButton instanceof HTMLButtonElement) {
        openButton.dataset.idleLabel = copy.primaryLabel;
        openButton.textContent = copy.primaryLabel;
    }
    if (retryButton instanceof HTMLButtonElement) {
        retryButton.classList.toggle('is-hidden', !copy.showRetry);
    }
    if (helperLink instanceof HTMLAnchorElement) {
        helperLink.href = helperUrl || '#';
    }
    if (helperLinkRow instanceof HTMLElement) {
        const showHelperLinkRow =
            supportsLocalHelperFallback &&
            (helperUrl !== '' || copy.showLinkHint);
        helperLinkRow.classList.toggle('is-hidden', !showHelperLinkRow);
    }
    if (manualCode) {
        manualCode.textContent = manualValue;
    }
    if (manualRow instanceof HTMLElement) {
        manualRow.classList.toggle(
            'is-hidden',
            !supportsLocalHelperFallback || manualValue === ''
        );
    }
}

function setSubmitting(submitting) {
    const loginButton = getById('operatorLoginBtn');
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    const openClawButton = getById('operatorOpenClawBtn');
    const retryClawButton = getById('operatorOpenClawRetryBtn');
    const operatorMode = isOperatorAuthMode(getState().auth);

    if (loginButton instanceof HTMLButtonElement) {
        loginButton.disabled = submitting;
        loginButton.textContent = submitting ? 'Validando...' : 'Ingresar';
    }
    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled = submitting || operatorMode;
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled = submitting || operatorMode;
    }
    if (openClawButton instanceof HTMLButtonElement) {
        const idleLabel = String(
            openClawButton.dataset.idleLabel || 'Abrir OpenClaw'
        );
        openClawButton.disabled = submitting;
        openClawButton.textContent = submitting ? 'Preparando...' : idleLabel;
    }
    if (retryClawButton instanceof HTMLButtonElement) {
        retryClawButton.disabled = submitting;
    }
}

function show2FA(required) {
    const group = getById('operator2FAGroup');
    const resetButton = getById('operatorReset2FABtn');
    if (group instanceof HTMLElement) {
        group.classList.toggle('is-hidden', !required);
    }
    if (resetButton instanceof HTMLElement) {
        resetButton.classList.toggle('is-hidden', !required);
    }
}

function resetLoginForm({ clearPassword = false } = {}) {
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    if (passwordInput instanceof HTMLInputElement && clearPassword) {
        passwordInput.value = '';
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.value = '';
    }
}

function focusLoginField(target = 'password') {
    const id =
        target === '2fa'
            ? 'operator2FACode'
            : target === 'operator_auth'
              ? 'operatorOpenClawBtn'
              : 'operatorPassword';
    const input = getById(id);
    if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLButtonElement
    ) {
        window.setTimeout(() => input.focus(), 20);
    }
}

function humanizeCallKeyLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return 'Numpad Enter';
    }
    return raw
        .replace(/^NumpadEnter$/i, 'Numpad Enter')
        .replace(/^NumpadAdd$/i, 'Numpad Add')
        .replace(/^NumpadDecimal$/i, 'Numpad Decimal')
        .replace(/^NumpadSubtract$/i, 'Numpad Subtract');
}

function formatOperatorLabelList(labels) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return '';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} y ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

function getOperatorCallKeyBinding(queueState = getState().queue) {
    const customBinding =
        queueState?.customCallKey &&
        typeof queueState.customCallKey === 'object'
            ? queueState.customCallKey
            : null;

    return {
        binding: customBinding,
        fingerprint: customBinding
            ? `${String(customBinding.code || '')}|${String(customBinding.key || '')}|${Number(customBinding.location || 0)}`
            : 'default:numpadenter',
        label: humanizeCallKeyLabel(
            customBinding
                ? customBinding.code || customBinding.key || 'tecla externa'
                : 'NumpadEnter'
        ),
    };
}

function syncOperatorNumpadBinding(queueState = getState().queue) {
    const binding = getOperatorCallKeyBinding(queueState);
    if (operatorRuntime.numpad.bindingFingerprint === binding.fingerprint) {
        return binding;
    }

    operatorRuntime.numpad.bindingFingerprint = binding.fingerprint;
    operatorRuntime.numpad.validatedActions.call = false;

    if (!Object.values(operatorRuntime.numpad.validatedActions).some(Boolean)) {
        operatorRuntime.numpad.lastAction = '';
        operatorRuntime.numpad.lastCode = '';
        operatorRuntime.numpad.lastAt = '';
    }

    return binding;
}

function buildOperatorNumpadStatus(queueState = getState().queue) {
    const callKeyBinding = syncOperatorNumpadBinding(queueState);
    const checks = [
        {
            id: 'call',
            label: callKeyBinding.label,
            validated: Boolean(operatorRuntime.numpad.validatedActions.call),
        },
        {
            id: 'recall',
            label: '+',
            validated: Boolean(operatorRuntime.numpad.validatedActions.recall),
        },
        {
            id: 'complete',
            label: '.',
            validated: Boolean(
                operatorRuntime.numpad.validatedActions.complete
            ),
        },
        {
            id: 'noShow',
            label: '-',
            validated: Boolean(operatorRuntime.numpad.validatedActions.noShow),
        },
    ];
    const validatedCount = checks.filter((check) => check.validated).length;
    const requiredCount = checks.length;
    const ready = validatedCount === requiredCount;
    const pendingLabels = checks
        .filter((check) => !check.validated)
        .map((check) => check.label);
    const label = ready
        ? 'Numpad listo'
        : `Numpad ${validatedCount}/${requiredCount}`;
    const summary = ready
        ? `${label} · ${checks.map((check) => check.label).join(', ')}`
        : `${label} · faltan ${formatOperatorLabelList(pendingLabels)}`;

    return {
        callKeyLabel: callKeyBinding.label,
        ready,
        seen: validatedCount > 0,
        validatedCount,
        requiredCount,
        pendingLabels,
        label,
        summary,
        headline: `${validatedCount}/${requiredCount} teclas operativas listas`,
        checks,
        lastAction: operatorRuntime.numpad.lastAction,
        lastCode: operatorRuntime.numpad.lastCode,
        lastAt: operatorRuntime.numpad.lastAt,
    };
}

function renderOperatorNumpadMatrix(queueState = getState().queue) {
    const root = getById('operatorNumpadMatrix');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const status = buildOperatorNumpadStatus(queueState);
    root.innerHTML = status.checks
        .map(
            (check) => `
                <span
                    id="operatorNumpadCheck_${escapeHtml(check.id)}"
                    class="queue-operator-numpad-chip"
                    data-state="${check.validated ? 'ready' : 'warning'}"
                >
                    <span class="queue-operator-numpad-chip__label">${escapeHtml(
                        check.label
                    )}</span>
                    <strong class="queue-operator-numpad-chip__state">${check.validated ? 'OK' : 'Pendiente'}</strong>
                </span>
            `
        )
        .join('');
}

function setReadinessCheck(id, state, detail) {
    const node = getById(id);
    if (!(node instanceof HTMLElement)) {
        return;
    }

    const card = node.closest('.queue-operator-readiness-check');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', state);
    }
    node.textContent = detail;
}

function formatOperatorRuntimeAge(seconds) {
    const ageSec = Number(seconds);
    if (!Number.isFinite(ageSec) || ageSec < 0) {
        return 'sin sync válido';
    }
    if (ageSec < 60) {
        return `${Math.round(ageSec)}s`;
    }
    if (ageSec < 3600) {
        return `${Math.round(ageSec / 60)}m`;
    }
    return `${Math.round(ageSec / 3600)}h`;
}

function formatOperatorRuntimeTimestamp(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) {
        return 'sin registro';
    }
    return date.toLocaleString('es-EC', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getOperatorRuntimeModeLabel() {
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'Offline operativo';
    }
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        return 'Modo seguro';
    }
    if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        return 'Live con conciliación';
    }
    return 'Live';
}

function getOperatorRuntimeTone(syncHealth = getQueueSyncHealth()) {
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        return 'danger';
    }
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'warning';
    }
    return operatorRuntime.shellRuntime.reconciliationSize > 0 ||
        operatorRuntime.shellRuntime.outboxSize > 0 ||
        syncHealth.degraded
        ? 'warning'
        : 'ready';
}

function getOperatorRuntimeSummary(syncHealth = getQueueSyncHealth()) {
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'Puedes llamar, re-llamar, completar y no show. Todo quedará pendiente de replay hasta recuperar red.';
    }
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        if (
            operatorRuntime.shellRuntime.reason === 'no_authenticated_session'
        ) {
            return 'Solo lectura: no hay sesión previa válida y el login offline no está disponible.';
        }
        if (operatorRuntime.shellRuntime.reason === 'snapshot_expired') {
            return 'Solo lectura: el snapshot local venció y no conviene operar así.';
        }
        if (operatorRuntime.shellRuntime.reason === 'reconciliation_pending') {
            return 'Solo lectura: hay acciones en conciliación pendientes antes de volver a contingencia.';
        }
        return 'Solo lectura hasta recuperar red y un snapshot sano.';
    }
    if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        return 'La app sigue en línea, pero hay acciones en conciliación y no debe volver a contingencia todavía.';
    }
    if (syncHealth.degraded) {
        return 'La cola quedó en fallback local; refresca y espera sincronización antes de operar tickets.';
    }
    return 'Shell y cola en vivo para la operación diaria.';
}

function getOperatorRuntimeMeta() {
    return [
        `Sync ${formatOperatorRuntimeTimestamp(
            operatorRuntime.shellRuntime.lastSuccessfulSyncAt
        )}`,
        `edad ${formatOperatorRuntimeAge(
            operatorRuntime.shellRuntime.snapshotAgeSec
        )}`,
        `outbox ${operatorRuntime.shellRuntime.outboxSize}`,
        `conciliación ${operatorRuntime.shellRuntime.reconciliationSize}`,
        `canal ${operatorRuntime.shellRuntime.updateChannel}`,
    ].join(' · ');
}

function updateOperatorRuntimeCard(syncHealth = getQueueSyncHealth()) {
    const card = getById('operatorShellRuntimeCard');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', getOperatorRuntimeTone(syncHealth));
    }

    setText('#operatorShellRuntimeMode', getOperatorRuntimeModeLabel());
    setText(
        '#operatorShellRuntimeSummary',
        getOperatorRuntimeSummary(syncHealth)
    );
    setText('#operatorShellRuntimeMeta', getOperatorRuntimeMeta());

    const recoveryButton = getById('operatorShellRecoveryBtn');
    if (!(recoveryButton instanceof HTMLButtonElement)) {
        return;
    }

    const bridge = getDesktopBridge();
    const canOpenSettings = bridge && typeof bridge.openSettings === 'function';
    const prefersSettings =
        operatorRuntime.shellRuntime.mode === 'safe' && canOpenSettings;

    recoveryButton.hidden = false;
    recoveryButton.textContent = prefersSettings
        ? 'Abrir ajustes'
        : 'Reintentar sync';
    recoveryButton.title = prefersSettings
        ? 'Revisar la configuración local del equipo'
        : 'Intentar sincronizar la cola ahora';
}

function updateOperatorReadiness() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const syncHealth = getQueueSyncHealth(state);
    const blocker = getOperatorMutationBlocker(state);
    const stationNumber =
        Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `${getOperatorConsultorioShortLabel(stationNumber)} ${
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre'
    }`;
    const routeSummary = `${stationLabel} · ${
        state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF'
    }`;
    const runtimeMode = operatorRuntime.shellRuntime.mode;
    const networkSummary =
        runtimeMode === 'offline'
            ? 'Offline operativo con snapshot fresco y replay pendiente'
            : blocker?.key === 'offline_safe'
              ? 'Equipo sin red segura para operar'
              : syncHealth.degraded
                ? 'Red en línea, pero la cola quedó en fallback local'
                : 'Sesión activa y red en línea';
    const shellSummary = getShellReadiness(operatorRuntime.shell);

    setReadinessCheck(
        'operatorReadyRoute',
        surfaceContract.state === 'alert' ? 'danger' : 'ready',
        surfaceContract.state === 'alert'
            ? surfaceContract.detail
            : routeSummary
    );
    setReadinessCheck(
        'operatorReadyNetwork',
        runtimeMode === 'offline'
            ? 'warning'
            : blocker?.key === 'offline_safe'
              ? 'danger'
              : syncHealth.degraded
                ? 'warning'
                : 'ready',
        networkSummary
    );
    setReadinessCheck(
        'operatorReadyShell',
        shellSummary.state,
        shellSummary.detail
    );
    setReadinessCheck(
        'operatorReadyNumpad',
        numpadStatus.ready ? 'ready' : 'warning',
        numpadStatus.headline
    );
    renderOperatorNumpadMatrix(state.queue);

    const readinessTitle = getById('operatorReadinessTitle');
    const readinessSummary = getById('operatorReadinessSummary');
    const readyForLiveUse =
        runtimeMode === 'live' &&
        operatorRuntime.online &&
        surfaceContract.state !== 'alert' &&
        !syncHealth.degraded &&
        numpadStatus.ready;
    const readyForOfflineUse =
        runtimeMode === 'offline' &&
        surfaceContract.state !== 'alert' &&
        numpadStatus.ready;
    const pendingCount = numpadStatus.pendingLabels.length;

    if (readinessTitle) {
        readinessTitle.textContent =
            surfaceContract.state === 'alert'
                ? surfaceContract.reason === 'profile_missing'
                    ? 'Perfil de clínica no cargado'
                    : 'Ruta del piloto incorrecta'
                : blocker?.key === 'offline_safe'
                  ? 'Modo seguro'
                  : blocker?.key === 'fallback'
                    ? 'Sincronización pendiente'
                    : readyForOfflineUse
                      ? 'Offline operativo'
                      : readyForLiveUse
                        ? 'Equipo listo para operar'
                        : pendingCount === numpadStatus.requiredCount
                          ? 'Falta validar el numpad'
                          : `Faltan validar ${pendingCount} tecla(s)`;
    }

    if (readinessSummary) {
        readinessSummary.textContent =
            surfaceContract.state === 'alert'
                ? surfaceContract.detail
                : blocker?.key === 'offline_safe'
                  ? 'Mantén la pantalla solo como referencia hasta recuperar red o una sesión válida.'
                  : blocker?.key === 'fallback'
                    ? 'La cola está en fallback local. Mantén la vista como referencia y refresca antes de reanudar llamados o cierres.'
                    : readyForOfflineUse
                      ? 'La contingencia offline está habilitada. Puedes operar con las cuatro teclas del numpad y el replay se hará al reconectar.'
                      : readyForLiveUse
                        ? 'La ruta, la sesión y las cuatro teclas operativas ya respondieron. Puedes pasar al primer llamado real.'
                        : `Valida ${formatOperatorLabelList(
                              numpadStatus.pendingLabels
                          )} en el Genius Numpad 1000 antes del primer llamado real.`;
    }
}

function noteNumpadActivity(event) {
    const state = getState();
    const callKeyBinding = syncOperatorNumpadBinding(state.queue);
    const code = String(event?.code || '').trim();
    const key = String(event?.key || '').trim();
    const codeNormalized = code.toLowerCase();
    const keyNormalized = key.toLowerCase();

    let action = '';
    if (
        callKeyBinding.binding
            ? eventMatchesBinding(event, callKeyBinding.binding)
            : isNumpadEnterEvent(event, codeNormalized, keyNormalized)
    ) {
        operatorRuntime.numpad.validatedActions.call = true;
        action = 'call';
    } else if (isNumpadAddEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.recall = true;
        action = 'recall';
    } else if (isNumpadDecimalEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.complete = true;
        action = 'complete';
    } else if (isNumpadSubtractEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.noShow = true;
        action = 'noShow';
    }

    if (!action) {
        return;
    }

    operatorRuntime.numpad.lastAction = action;
    operatorRuntime.numpad.lastCode = code || key || action;
    operatorRuntime.numpad.lastAt = new Date().toISOString();
    syncOperatorHeartbeat('numpad');
}

function updateOperatorActionGuide() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract = getOperatorSurfaceContract();
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket = getWaitingForConsultorio(
        Number(state.queue.stationConsultorio || 1)
    );
    const pendingAction = state.queue.pendingSensitiveAction;

    let title;
    let summary;

    if (surfaceContract.state === 'alert') {
        title =
            surfaceContract.reason === 'profile_missing'
                ? 'Operación bloqueada por perfil'
                : 'Operación bloqueada por ruta';
        summary = getOperatorPilotBlockDetail();
    } else if (pendingAction && pendingAction.action) {
        const actionLabel =
            pendingAction.action === 'completed'
                ? 'completar'
                : pendingAction.action === 'no_show'
                  ? 'marcar no show'
                  : pendingAction.action;
        title = `Confirmar ${actionLabel}`;
        summary =
            'Revisa el diálogo sensible y confirma o cancela antes de seguir con otro ticket.';
    } else if (activeTicket && activeTicket.ticketCode) {
        title = `Ticket ${activeTicket.ticketCode} en curso`;
        summary =
            'Usa + para re-llamar, . para preparar completar y - para preparar no show.';
    } else if (waitingTicket && waitingTicket.ticketCode) {
        title = `Siguiente: ${waitingTicket.ticketCode}`;
        summary = `Pulsa ${numpadStatus.callKeyLabel} para llamar ${waitingTicket.ticketCode} en ${getOperatorConsultorioShortLabel(
            Number(state.queue.stationConsultorio || 1)
        )}.`;
    } else {
        title = 'Sin tickets en espera';
        summary =
            'Mantén el equipo listo y usa Refrescar si esperas nuevos turnos o check-ins.';
    }

    setText('#operatorActionTitle', title);
    setText('#operatorActionSummary', summary);
}

function updateOperatorGuardState() {
    const state = getState();
    const blocker = getOperatorMutationBlocker(state);
    let title = 'Operación habilitada';
    let summary =
        'La cola sigue en vivo. Puedes llamar, re-llamar y cerrar tickets desde esta superficie.';
    let tone = 'success';

    if (operatorRuntime.shellRuntime.mode === 'offline') {
        title = 'Offline operativo';
        summary =
            'Puedes llamar, re-llamar, completar y no show. Los cambios quedarán en cola hasta recuperar red.';
        tone = 'warning';
    } else if (blocker) {
        title = blocker.title;
        summary = blocker.summary;
        tone = blocker.tone;
    } else if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        title = 'Operación online con conciliación';
        summary =
            'El equipo puede seguir trabajando en línea, pero no debe volver a contingencia hasta limpiar la conciliación.';
        tone = 'warning';
    }

    const card = getById('operatorGuardCard');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', tone);
    }
    setText('#operatorGuardTitle', title);
    setText('#operatorGuardSummary', summary);
}

function isSafeOperatorAction(action) {
    return [
        'queue-refresh-state',
        'queue-toggle-shortcuts',
        'queue-toggle-one-tap',
        'queue-lock-station',
        'queue-set-station-mode',
        'queue-capture-call-key',
        'queue-clear-call-key',
        'queue-clear-search',
        'queue-sensitive-cancel',
        'queue-toggle-ticket-select',
    ].includes(String(action || '').trim());
}

function isMutatingOperatorAction(action) {
    return [
        'queue-call-next',
        'queue-ticket-action',
        'queue-sensitive-confirm',
        'queue-reprint-ticket',
        'queue-bulk-action',
        'queue-bulk-reprint',
        'queue-release-station',
    ].includes(String(action || '').trim());
}

function isOperatorActionAllowedDuringOffline(
    action,
    element,
    state = getState()
) {
    const actionName = String(action || '').trim();
    if (!isMutatingOperatorAction(actionName)) {
        return true;
    }

    if (actionName === 'queue-call-next') {
        return true;
    }

    if (actionName === 'queue-ticket-action') {
        const ticketAction = normalizeQueueAction(
            element?.dataset?.queueAction
        );
        return ['re-llamar', 'completar', 'no_show'].includes(ticketAction);
    }

    if (actionName === 'queue-sensitive-confirm') {
        const pendingAction = normalizeQueueAction(
            state.queue.pendingSensitiveAction?.action
        );
        return ['re-llamar', 'completar', 'no_show'].includes(pendingAction);
    }

    return false;
}

function getOperatorActionGuard(action, element, state = getState()) {
    if (!state?.auth?.authenticated) {
        return null;
    }

    if (isMutatingOperatorAction(action) && isOperatorPilotBlocked()) {
        const surfaceContract = getOperatorSurfaceContract();
        const detail = getOperatorPilotBlockDetail();
        return {
            key:
                surfaceContract.reason === 'profile_missing'
                    ? 'pilot_profile'
                    : 'pilot_route',
            tone: 'danger',
            title:
                surfaceContract.reason === 'profile_missing'
                    ? 'Operación bloqueada por perfil'
                    : 'Operación bloqueada por ruta',
            summary: detail,
            toast: detail,
        };
    }

    const blocker = getOperatorMutationBlocker(state);
    if (blocker && isMutatingOperatorAction(action)) {
        return blocker;
    }

    if (
        operatorRuntime.shellRuntime.mode === 'offline' &&
        !isOperatorActionAllowedDuringOffline(action, element, state)
    ) {
        return {
            key: 'offline_scope',
            tone: 'warning',
            title: 'Offline operativo limitado',
            summary:
                'En contingencia solo están permitidos llamar, re-llamar, completar y no show. El resto queda bloqueado hasta recuperar red.',
            toast: 'Acción fuera de scope offline. Recupera red para reasignar, liberar, reimprimir o usar acciones masivas.',
        };
    }

    return null;
}

function syncOperatorActionAvailability() {
    document.querySelectorAll('[data-action]').forEach((node) => {
        const action = String(node.getAttribute('data-action') || '').trim();
        const blocker = getOperatorActionGuard(action, node);
        const allowInteractionThroughGuard =
            blocker?.key === 'pilot_profile' || blocker?.key === 'pilot_route';
        const disabled = Boolean(blocker) && !allowInteractionThroughGuard;
        const guardDisabledState = node.getAttribute(
            'data-operator-guard-disabled'
        );
        const guardTitle = node.getAttribute('data-operator-guard-title');
        if (
            node instanceof HTMLButtonElement ||
            node instanceof HTMLInputElement
        ) {
            if (disabled) {
                if (!guardDisabledState) {
                    node.setAttribute(
                        'data-operator-guard-disabled',
                        node.disabled ? 'preserved' : 'forced'
                    );
                }
                node.disabled = true;
            } else if (guardDisabledState === 'forced') {
                node.disabled = false;
            }
        }
        if (disabled) {
            node.setAttribute('aria-disabled', 'true');
            node.setAttribute(
                'data-operator-guard-title',
                blocker?.summary || ''
            );
            node.setAttribute('title', blocker?.summary || '');
        } else {
            node.removeAttribute('data-operator-guard-disabled');
            node.removeAttribute('aria-disabled');
            if (guardTitle && node.getAttribute('title') === guardTitle) {
                node.removeAttribute('title');
            }
            node.removeAttribute('data-operator-guard-title');
        }
    });
}

function notifyOperatorMutationBlocked(blocker) {
    if (!blocker) {
        return;
    }

    const now = Date.now();
    if (
        blocker.key === lastOperatorGuardToastKey &&
        now - lastOperatorGuardToastAt < 3000
    ) {
        return;
    }

    lastOperatorGuardToastKey = blocker.key;
    lastOperatorGuardToastAt = now;
    createToast(blocker.toast, blocker.tone === 'danger' ? 'error' : 'warning');
}

async function openOperatorSettings() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.openSettings !== 'function') {
        return false;
    }

    try {
        await bridge.openSettings();
        return true;
    } catch (error) {
        createToast(
            error?.message || 'No se pudo abrir la configuración local',
            'error'
        );
        return false;
    }
}

async function handleOperatorRecoveryAction() {
    if (
        operatorRuntime.shellRuntime.mode === 'safe' &&
        (await openOperatorSettings())
    ) {
        return true;
    }

    await Promise.all([refreshQueueState(), refreshDesktopSnapshot()]);
    updateOperatorChrome({
        heartbeatReason: 'manual_recovery',
        forceHeartbeat: true,
    });
    return true;
}

function isOpenSettingsShortcut(event) {
    const key = String(event?.key || '')
        .trim()
        .toLowerCase();
    const code = String(event?.code || '')
        .trim()
        .toLowerCase();

    return (
        key === 'f10' ||
        (Boolean(event?.ctrlKey || event?.metaKey) &&
            (key === ',' || code === 'comma'))
    );
}

function syncShellSettingsButton() {
    const button = getById('operatorAppSettingsBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    const bridge = getDesktopBridge();
    const canOpenSettings = bridge && typeof bridge.openSettings === 'function';

    button.classList.toggle('is-hidden', !canOpenSettings);
    if (canOpenSettings) {
        const buttonCopy = getOperatorShellSettingsButtonCopy(
            operatorRuntime.shell
        );
        button.textContent = buttonCopy.text;
        button.title = buttonCopy.title;
    }
}

function syncLoggedOutAccessState() {
    const state = getState();
    if (isOperatorAuthMode(state.auth)) {
        return;
    }

    if (state.auth.authenticated || state.auth.requires2FA) {
        return;
    }

    if (
        !operatorRuntime.online ||
        operatorRuntime.shellRuntime.connectivity === 'offline'
    ) {
        setLoginStatus(
            'warning',
            'Sin login offline',
            'El ingreso offline no está habilitado. Recupera conexión para iniciar sesión.'
        );
        return;
    }

    setLoginStatus(
        'neutral',
        'PIN operativo',
        state.auth.configured
            ? 'Ingresa el PIN de la clínica para abrir la consola operativa del turnero.'
            : 'Pide a admin que configure el PIN operativo antes de usar esta consola.'
    );
}

function updateOperatorChrome({
    heartbeatReason = 'render',
    forceHeartbeat = false,
} = {}) {
    const state = getState();
    const surfaceState = buildOperatorSurfaceState(state.queue);
    const stationLabel = `C${surfaceState.stationConsultorio} ${
        surfaceState.locked ? 'bloqueado' : 'libre'
    }`;
    const oneTapLabel = surfaceState.oneTap ? '1 tecla ON' : '1 tecla OFF';
    const callKey = state.queue.customCallKey
        ? String(
              state.queue.customCallKey.code ||
                  state.queue.customCallKey.key ||
                  'tecla externa'
          )
        : 'Numpad Enter';
    const shellModeLabel = getShellModeLabel(operatorRuntime.shell);
    const shellReadiness = getShellReadiness(operatorRuntime.shell);
    const networkOnline = operatorRuntime.online;
    const syncHealth = getQueueSyncHealth(state);
    const networkSummary = !networkOnline
        ? 'Sin red local'
        : operatorRuntime.shellRuntime.mode === 'offline'
          ? 'Servidor sin respuesta'
          : syncHealth.degraded
            ? 'Sync degradado'
            : 'Red en línea';
    const networkMeta = !networkOnline
        ? 'La conectividad local cayó. La app solo debe operar si el runtime quedó en offline operativo.'
        : operatorRuntime.shellRuntime.mode === 'offline'
          ? 'La red local sigue arriba, pero el backend no respondió y la consola pasó a contingencia.'
          : syncHealth.degraded
            ? `${refreshStatusLabel()} · cola en fallback local; refresca antes de operar.`
            : `${refreshStatusLabel()} · heartbeat operador listo para admin y shell.`;

    setText('#operatorStationSummary', stationLabel);
    setText(
        '#operatorOneTapSummary',
        `${oneTapLabel} · ${refreshStatusLabel()} · ${shellModeLabel}`
    );
    setText('#operatorCallKeySummary', humanizeCallKeyLabel(callKey));
    setText('#operatorShellModeSummary', shellModeLabel);
    setText(
        '#operatorShellMetaSummary',
        getShellMetaLabel(operatorRuntime.shell)
    );
    setText(
        '#operatorShellSupportSummary',
        getShellSupportLabel(operatorRuntime.shell)
    );
    setText('#operatorShellRuntimeMode', getOperatorRuntimeModeLabel());
    setText(
        '#operatorShellRuntimeSummary',
        getOperatorRuntimeSummary(syncHealth)
    );
    setText('#operatorShellRuntimeMeta', getOperatorRuntimeMeta());
    setText('#operatorNetworkSummary', networkSummary);
    setText('#operatorNetworkMetaSummary', networkMeta);
    getById('operatorShellCard')?.setAttribute(
        'data-state',
        shellReadiness.state
    );
    const shellSupportNode = getById('operatorShellSupportSummary');
    if (shellSupportNode instanceof HTMLElement) {
        shellSupportNode.setAttribute(
            'title',
            getShellSupportLabel(operatorRuntime.shell)
        );
    }
    getById('operatorNetworkCard')?.setAttribute(
        'data-state',
        !networkOnline
            ? 'danger'
            : operatorRuntime.shellRuntime.mode === 'offline' ||
                syncHealth.degraded
              ? 'warning'
              : 'ready'
    );
    updateOperatorRuntimeCard(syncHealth);
    renderQueueSection();
    updateOperatorActionGuide();
    updateOperatorReadiness();
    updateOperatorGuardState();
    syncOperatorActionAvailability();
    renderOperatorSurfaceSyncState(state, syncHealth);
    renderOperatorSurfaceRecoveryState(state, syncHealth);
    renderOperatorSurfaceAcceptanceState();
    renderOperatorSurfaceOps();
    syncOperatorHeartbeat(heartbeatReason, { force: forceHeartbeat });
}

function mountAuthenticatedView() {
    getById('operatorLoginView')?.classList.add('is-hidden');
    getById('operatorApp')?.classList.remove('is-hidden');
}

function mountLoggedOutView() {
    getById('operatorApp')?.classList.add('is-hidden');
    getById('operatorLoginView')?.classList.remove('is-hidden');
    syncLoggedOutAccessState();
}

function stopRefreshLoop() {
    if (refreshIntervalId) {
        window.clearInterval(refreshIntervalId);
        refreshIntervalId = 0;
    }
}

function startRefreshLoop() {
    stopRefreshLoop();
    refreshIntervalId = window.setInterval(() => {
        void refreshQueueState();
    }, QUEUE_REFRESH_MS);
}

async function bootAuthenticatedSurface(showToast = false) {
    mountAuthenticatedView();
    const refreshResult = await refreshAdminData();
    await hydrateQueueFromData();
    await refreshDesktopSnapshot();
    operatorRuntime.surfaceBootstrap?.setRuntimeState?.(
        operatorRuntime.shellRuntime
    );
    operatorRuntime.surfaceBootstrap?.setHeartbeat?.(
        buildOperatorHeartbeatPayload()
    );
    operatorRuntime.surfaceBootstrap?.setStorageInfo?.({
        state:
            operatorRuntime.shellRuntimeSnapshot.outbox.length > 0 ||
            operatorRuntime.shellRuntimeSnapshot.reconciliation.length > 0
                ? 'watch'
                : 'ready',
        scope: 'operator',
        key: 'shell-snapshot',
        updatedAt:
            operatorRuntime.shellRuntime.lastSuccessfulSyncAt ||
            operatorRuntime.shellRuntimeSnapshot.lastAuthenticatedAt ||
            '',
    });
    await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(true);
    await operatorRuntime.queueAdapter?.syncStateSnapshot?.({
        healthy: Boolean(refreshResult?.ok),
    });
    await refreshQueueState();
    if (operatorClinicProfile) {
        renderOperatorProfileStatus(operatorClinicProfile);
    }
    ensureOperatorHeartbeat().start({ immediate: false });
    updateOperatorChrome();
    startRefreshLoop();
    if (showToast) {
        createToast(
            refreshResult?.ok
                ? 'Operador conectado'
                : 'Operador cargado con respaldo local',
            refreshResult?.ok ? 'success' : 'warning'
        );
    }
}

function ensureOperatorAuthPolling() {
    const auth = getState().auth;
    if (
        normalizeOperatorTransport(
            auth?.transport,
            normalizeOperatorTransport(auth?.openClawSnapshot?.transport, '')
        ) === 'web_broker'
    ) {
        return operatorAuthPollPromise;
    }

    if (
        operatorAuthPollPromise ||
        !isOperatorAuthMode(auth) ||
        auth.authenticated ||
        String(auth.status || '') !== 'pending'
    ) {
        return operatorAuthPollPromise;
    }

    operatorAuthPollPromise = pollOperatorAuthStatus({
        onUpdate: (snapshot) => {
            syncOperatorLoginSurface(snapshot);
        },
    })
        .then(async (snapshot) => {
            operatorAuthPollPromise = null;
            syncOperatorLoginSurface(snapshot);
            if (snapshot.authenticated) {
                await bootAuthenticatedSurface(true);
            }
            return snapshot;
        })
        .catch((error) => {
            operatorAuthPollPromise = null;
            setLoginStatus(
                'danger',
                'No se pudo iniciar sesión',
                error?.message ||
                    'No se pudo consultar el estado del login OpenClaw.'
            );
            createToast(
                error?.message || 'No se pudo consultar el estado de OpenClaw',
                'error'
            );
            return getState().auth;
        });

    return operatorAuthPollPromise;
}

async function startOperatorAuthFlow(forceNew = false) {
    try {
        const currentAuth = getState().auth;
        const currentStatus = String(currentAuth?.status || '')
            .trim()
            .toLowerCase();
        const currentTransport = normalizeOperatorTransport(
            currentAuth?.transport,
            normalizeOperatorTransport(
                currentAuth?.openClawSnapshot?.transport,
                ''
            )
        );
        const reusableRedirectUrl = getReusableOpenClawRedirectUrl(currentAuth);

        if (
            !forceNew &&
            isOperatorAuthMode(currentAuth) &&
            currentStatus === 'pending' &&
            currentTransport === 'web_broker' &&
            reusableRedirectUrl
        ) {
            syncOperatorLoginSurface(currentAuth);
            if (!openOperatorWebBrokerFlow(reusableRedirectUrl)) {
                createToast(
                    'No se pudo retomar el acceso web de OpenClaw desde esta pestaña',
                    'error'
                );
            }
            return currentAuth;
        }

        setSubmitting(true);
        setLoginStatus(
            'neutral',
            currentTransport === 'web_broker'
                ? forceNew
                    ? 'Generando nuevo acceso web'
                    : 'Abriendo OpenClaw'
                : forceNew
                  ? 'Generando nuevo enlace'
                  : 'Abriendo OpenClaw',
            currentTransport === 'web_broker'
                ? 'Preparando el acceso web con Google para validar la sesión del turnero.'
                : 'Preparando el challenge local para validar la sesion del turnero.'
        );

        const snapshot = await startOperatorAuth({
            forceNew,
            openHelper: true,
        });
        syncOperatorLoginSurface(snapshot);

        if (snapshot.authenticated) {
            await bootAuthenticatedSurface(true);
            return snapshot;
        }

        const snapshotStatus = String(snapshot.status || '')
            .trim()
            .toLowerCase();
        const snapshotTransport = normalizeOperatorTransport(
            snapshot?.transport,
            normalizeOperatorTransport(
                snapshot?.openClawSnapshot?.transport,
                ''
            )
        );

        if (snapshotStatus === 'pending') {
            if (snapshotTransport === 'web_broker') {
                const redirectUrl = getReusableOpenClawRedirectUrl(snapshot);
                if (redirectUrl && openOperatorWebBrokerFlow(redirectUrl)) {
                    return snapshot;
                }
                createToast(
                    redirectUrl
                        ? 'Continúa con Google desde esta misma pestaña'
                        : 'El acceso web quedó listo para retomarse desde esta misma pantalla',
                    redirectUrl ? 'info' : 'warning'
                );
                return snapshot;
            }

            createToast(
                snapshot.helperUrlOpened
                    ? 'OpenClaw listo para confirmar'
                    : 'Usa el enlace manual de OpenClaw si la ventana no se abrió',
                snapshot.helperUrlOpened ? 'info' : 'warning'
            );
            void ensureOperatorAuthPolling();
            return snapshot;
        }

        createToast(
            readOperatorAuthError(snapshot) ||
                'No se pudo iniciar el flujo OpenClaw',
            'warning'
        );
        return snapshot;
    } catch (error) {
        setLoginStatus(
            'danger',
            'No se pudo iniciar sesión',
            error?.message ||
                'No se pudo abrir el flujo OpenClaw para este turnero.'
        );
        createToast(
            error?.message || 'No se pudo abrir el flujo OpenClaw',
            'error'
        );
        return getState().auth;
    } finally {
        setSubmitting(false);
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    if (isOperatorAuthMode(getState().auth)) {
        await startOperatorAuthFlow(false);
        return;
    }

    if (
        !operatorRuntime.online &&
        !getState().auth.authenticated &&
        !getState().auth.requires2FA
    ) {
        syncLoggedOutAccessState();
        createToast(
            'El ingreso offline no está habilitado. Recupera conexión para iniciar sesión.',
            'warning'
        );
        return;
    }

    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';
    const state = getState();

    try {
        setSubmitting(true);
        setLoginStatus(
            state.auth.requires2FA ? 'warning' : 'neutral',
            state.auth.requires2FA ? 'Validando código' : 'Validando PIN',
            state.auth.requires2FA
                ? 'Comprobando el código adicional antes de abrir la consola operativa.'
                : 'Comprobando el PIN operativo de la clínica.'
        );

        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                show2FA(true);
                setLoginStatus(
                    'warning',
                    'Código requerido',
                    'El PIN fue validado. Ingresa ahora el código solicitado.'
                );
                focusLoginField('2fa');
                return;
            }
        }

        show2FA(false);
        resetLoginForm({ clearPassword: true });
        setLoginStatus(
            'success',
            'Acceso concedido',
            'Sesión autenticada. Cargando la operación diaria.'
        );
        await bootAuthenticatedSurface(true);
    } catch (error) {
        setLoginStatus(
            'danger',
            'No se pudo iniciar sesión',
            error?.message || 'Verifica el PIN operativo.'
        );
        focusLoginField(getState().auth.requires2FA ? '2fa' : 'password');
        createToast(error?.message || 'No se pudo iniciar sesión', 'error');
    } finally {
        setSubmitting(false);
    }
}

function resetTwoFactorStage() {
    show2FA(false);
    resetLoginForm();
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            requires2FA: false,
        },
    }));
    setLoginStatus('neutral', 'PIN operativo', 'Volviste al paso de PIN.');
    focusLoginField('password');
}

async function handleDocumentClick(event) {
    const actionNode =
        event.target instanceof Element
            ? event.target.closest(
                  '[data-action], #operatorLogoutBtn, #operatorReset2FABtn, #operatorAppSettingsBtn, #operatorOpenClawBtn, #operatorOpenClawRetryBtn, #operatorShellRecoveryBtn'
              )
            : null;

    if (!actionNode) {
        return;
    }

    if (actionNode.id === 'operatorLogoutBtn') {
        event.preventDefault();
        stopRefreshLoop();
        operatorHeartbeat?.stop();
        await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(false);
        await logoutSession();
        mountLoggedOutView();
        resetLoginForm({ clearPassword: true });
        show2FA(false);
        syncOperatorLoginSurface(getState().auth);
        syncLoggedOutAccessState();
        createToast('Sesión cerrada', 'info');
        focusLoginField(
            isOperatorAuthMode(getState().auth) ? 'operator_auth' : 'password'
        );
        return;
    }

    if (actionNode.id === 'operatorAppSettingsBtn') {
        event.preventDefault();
        await openOperatorSettings();
        return;
    }

    if (actionNode.id === 'operatorShellRecoveryBtn') {
        event.preventDefault();
        await handleOperatorRecoveryAction();
        return;
    }

    if (actionNode.id === 'operatorReset2FABtn') {
        event.preventDefault();
        resetTwoFactorStage();
        return;
    }

    if (actionNode.id === 'operatorOpenClawBtn') {
        event.preventDefault();
        await startOperatorAuthFlow(false);
        return;
    }

    if (actionNode.id === 'operatorOpenClawRetryBtn') {
        event.preventDefault();
        await startOperatorAuthFlow(true);
        return;
    }

    const action = String(actionNode.getAttribute('data-action') || '');
    if (!action) {
        return;
    }

    event.preventDefault();

    if (action === 'close-toast') {
        actionNode.closest('.toast')?.remove();
        return;
    }

    const blocker = getOperatorActionGuard(action, actionNode);
    if (blocker) {
        notifyOperatorMutationBlocked(blocker);
        updateOperatorChrome();
        return;
    }

    await handleQueueAction(action, actionNode);
    updateOperatorChrome();
}

function handleDocumentInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
        return;
    }

    if (target.id === 'queueSearchInput') {
        setQueueSearch(target.value);
        updateOperatorChrome();
    }
}

function handleFilterClick(event) {
    const button =
        event.target instanceof Element
            ? event.target.closest('[data-queue-filter]')
            : null;
    if (!(button instanceof HTMLElement)) {
        return;
    }

    event.preventDefault();
    const filter = String(button.getAttribute('data-queue-filter') || 'all');
    setQueueFilter(filter);
    updateOperatorChrome();
}

function attachKeyboardBridge() {
    document.addEventListener('keydown', async (event) => {
        if (isOpenSettingsShortcut(event)) {
            const opened = await openOperatorSettings();
            if (opened) {
                event.preventDefault();
                return;
            }
        }

        if (!getState().auth.authenticated) {
            return;
        }

        if (event.key === 'Escape' && dismissQueueSensitiveDialog()) {
            event.preventDefault();
            updateOperatorChrome();
            return;
        }

        if (hasFocusedInput()) {
            return;
        }

        const state = getState();
        const callKeyBinding = syncOperatorNumpadBinding(state.queue);
        const codeNormalized = String(event.code || '')
            .trim()
            .toLowerCase();
        const keyNormalized = String(event.key || '')
            .trim()
            .toLowerCase();
        const mutatingNumpadAction =
            (callKeyBinding.binding
                ? eventMatchesBinding(event, callKeyBinding.binding)
                : isNumpadEnterEvent(event, codeNormalized, keyNormalized)) ||
            isNumpadAddEvent(codeNormalized, keyNormalized) ||
            isNumpadDecimalEvent(codeNormalized, keyNormalized) ||
            isNumpadSubtractEvent(codeNormalized, keyNormalized);

        if (isOperatorPilotBlocked() && mutatingNumpadAction) {
            event.preventDefault();
            noteNumpadActivity(event);
            notifyOperatorPilotBlocked();
            updateOperatorChrome();
            return;
        }

        const blocker = getOperatorMutationBlocker(state);
        if (blocker && mutatingNumpadAction) {
            event.preventDefault();
            noteNumpadActivity(event);
            notifyOperatorMutationBlocked(blocker);
            updateOperatorChrome();
            return;
        }

        try {
            await queueNumpadAction({
                key: event.key,
                code: event.code,
                location: event.location,
            });
        } finally {
            noteNumpadActivity(event);
            updateOperatorChrome();
        }
    });
}

function attachVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
        if (
            document.visibilityState === 'visible' &&
            getState().auth.authenticated
        ) {
            void Promise.all([
                refreshQueueState(),
                refreshDesktopSnapshot(),
            ]).then(() => updateOperatorChrome());
        }
    });

    window.addEventListener('online', () => {
        operatorRuntime.online = true;
        if (getState().auth.authenticated) {
            void operatorRuntime.queueAdapter
                ?.reportConnectivity?.('online')
                ?.finally(() => {
                    void refreshQueueState().then(() => updateOperatorChrome());
                });
            return;
        }

        syncLoggedOutAccessState();
    });

    window.addEventListener('offline', () => {
        operatorRuntime.online = false;
        void operatorRuntime.queueAdapter?.reportConnectivity?.('offline');
        if (getState().auth.authenticated) {
            updateOperatorChrome();
            return;
        }

        syncLoggedOutAccessState();
    });
}

async function boot() {
    initOperatorOpsTheme();
    applyQueueRuntimeDefaults();
    operatorRuntime.queueAdapter = resolveOperatorQueueAdapter(
        getDesktopBridge(),
        {
            onShellState(status, snapshot) {
                syncOperatorShellRuntime(status, snapshot);
                if (getState().auth.authenticated) {
                    updateOperatorChrome({
                        heartbeatReason: 'shell_runtime',
                        forceHeartbeat: true,
                    });
                    return;
                }

                syncLoggedOutAccessState();
            },
        }
    );
    setQueueCommandAdapter(operatorRuntime.queueAdapter);
    await operatorRuntime.queueAdapter.init?.();
    applyOperatorClinicProfile(await loadTurneroClinicProfile());
    await refreshDesktopSnapshot();
    operatorRuntime.surfaceBootstrap = mountTurneroSurfaceRuntimeBootstrap(
        '#operatorSurfaceRuntimeBootstrap',
        {
            clinicProfile: operatorClinicProfile,
            surfaceKey: 'operator',
            currentRoute: `${window.location.pathname || ''}${
                window.location.hash || ''
            }`,
            runtimeState: operatorRuntime.shellRuntime,
            heartbeat: buildOperatorHeartbeatPayload(),
            storageInfo: {
                state:
                    operatorRuntime.shellRuntimeSnapshot.outbox.length > 0 ||
                    operatorRuntime.shellRuntimeSnapshot.reconciliation.length >
                        0
                        ? 'watch'
                        : 'ready',
                scope: 'operator',
                key: 'shell-snapshot',
                updatedAt:
                    operatorRuntime.shellRuntime.lastSuccessfulSyncAt ||
                    operatorRuntime.shellRuntimeSnapshot.lastAuthenticatedAt ||
                    '',
            },
        }
    );
    void operatorRuntime.surfaceBootstrap?.ready?.then(() => {
        if (getState().auth.authenticated) {
            renderOperatorSurfaceRecoveryState();
        }
    });
    subscribe(() => {
        if (getState().auth.authenticated) {
            updateOperatorChrome();
        }
    });

    document.addEventListener('click', (event) => {
        void handleDocumentClick(event);
    });
    document.addEventListener('click', handleFilterClick);
    document.addEventListener('input', handleDocumentInput);
    attachKeyboardBridge();
    attachVisibilityRefresh();

    const desktopBridge = getDesktopBridge();
    if (desktopBridge && typeof desktopBridge.onBootStatus === 'function') {
        operatorRuntime.releaseBootStatusListener = desktopBridge.onBootStatus(
            () => {
                void refreshDesktopSnapshot().then(() => {
                    if (getState().auth.authenticated) {
                        updateOperatorChrome({
                            heartbeatReason: 'desktop_status',
                            forceHeartbeat: true,
                        });
                        return;
                    }

                    syncLoggedOutAccessState();
                });
            }
        );
    }

    if (desktopBridge && typeof desktopBridge.onShellEvent === 'function') {
        operatorRuntime.releaseShellStatusListener = desktopBridge.onShellEvent(
            (payload) => {
                operatorRuntime.queueAdapter?.handleShellEvent?.(payload);
            }
        );
    }

    window.addEventListener('beforeunload', () => {
        operatorRuntime.releaseBootStatusListener?.();
        operatorRuntime.releaseShellStatusListener?.();
        clearQueueCommandAdapter();
    });

    const loginForm = getById('operatorLoginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', (event) => {
            void handleLoginSubmit(event);
        });
    }

    await checkAuthStatus();
    const auth = getState().auth;
    if (auth.authenticated) {
        await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(true);
        await bootAuthenticatedSurface();
        return;
    }

    mountLoggedOutView();
    syncOperatorLoginSurface(auth);
    show2FA(false);
    syncLoggedOutAccessState();
    focusLoginField(isOperatorAuthMode(auth) ? 'operator_auth' : 'password');
    if (isOperatorAuthMode(auth) && String(auth.status || '') === 'pending') {
        void ensureOperatorAuthPolling();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void boot();
    });
} else {
    void boot();
}
