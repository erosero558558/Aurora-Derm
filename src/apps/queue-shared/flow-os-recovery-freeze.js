const FLOW_OS_RECOVERY_CYCLE = Object.freeze({
    id: 'flow-os-recovery-2026-03-21',
    status: 'active',
    startsAt: '2026-03-21',
    endsAt: '2026-04-20',
    allowedSlice:
        'admin v3 + queue/turnero + auth/OpenClaw + readiness + deploy',
});

const FLOW_OS_RECOVERY_FROZEN_ADMIN_PANEL_IDS = Object.freeze([
    'queueRegionalProgramOfficeHost',
    'queueReleaseServiceExcellenceAdoptionCloudHost',
    'queueSurfaceCommercialConsoleHost',
    'queueSurfaceRenewalConsoleHost',
    'queueSurfaceExpansionConsoleHost',
]);

const FLOW_OS_RECOVERY_FROZEN_PILOT_HOST_IDS = Object.freeze([
    'queueOpsPilotExecutivePortfolioStudioHost',
    'queueOpsPilotStrategyDigitalTwinStudioHost',
    'queueMultiClinicControlTowerHost',
]);

const FLOW_OS_RECOVERY_FROZEN_SURFACE_SIGNALS = Object.freeze([
    'renewal',
    'expansion',
]);

export function isFlowOsRecoveryFreezeActive() {
    return FLOW_OS_RECOVERY_CYCLE.status === 'active';
}

export function getFlowOsRecoveryFreezeNotice() {
    return `Recovery cycle ${FLOW_OS_RECOVERY_CYCLE.startsAt} -> ${FLOW_OS_RECOVERY_CYCLE.endsAt}: freeze duro en ${FLOW_OS_RECOVERY_CYCLE.allowedSlice}.`;
}

export function isFlowOsRecoveryAdminPanelFrozen(panelId) {
    return (
        isFlowOsRecoveryFreezeActive() &&
        FLOW_OS_RECOVERY_FROZEN_ADMIN_PANEL_IDS.includes(String(panelId || ''))
    );
}

export function isFlowOsRecoveryPilotHostFrozen(hostId) {
    return (
        isFlowOsRecoveryFreezeActive() &&
        FLOW_OS_RECOVERY_FROZEN_PILOT_HOST_IDS.includes(String(hostId || ''))
    );
}

export function shouldFreezeTurneroSurfaceSignal(signalId) {
    return (
        isFlowOsRecoveryFreezeActive() &&
        FLOW_OS_RECOVERY_FROZEN_SURFACE_SIGNALS.includes(String(signalId || ''))
    );
}

export function hideFlowOsRecoveryHost(host, note = '') {
    if (!(host instanceof HTMLElement)) {
        return;
    }

    host.hidden = true;
    host.dataset.flowOsRecoveryFrozen = 'true';
    host.dataset.flowOsRecoveryNote = String(note || '').trim();
    host.replaceChildren();
}

export {
    FLOW_OS_RECOVERY_CYCLE,
    FLOW_OS_RECOVERY_FROZEN_ADMIN_PANEL_IDS,
    FLOW_OS_RECOVERY_FROZEN_PILOT_HOST_IDS,
    FLOW_OS_RECOVERY_FROZEN_SURFACE_SIGNALS,
};
