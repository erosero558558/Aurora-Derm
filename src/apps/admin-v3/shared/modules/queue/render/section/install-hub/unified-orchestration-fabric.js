import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toArray,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { buildTurneroReleaseControlCenterModel } from '../../../../../../../queue-shared/turnero-release-control-center.js';
import {
    buildUnifiedOrchestrationDomains,
    mountTurneroReleaseUnifiedOrchestrationFabric,
} from '../../../../../../../queue-shared/turnero-release-unified-orchestration-fabric.js';

function resolveUnifiedOrchestrationHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseUnifiedOrchestrationFabricHost') ||
        document.querySelector(
            '[data-turnero-release-unified-orchestration-fabric]'
        )
    );
}

function buildUnifiedOrchestrationContext(
    manifest,
    detectedPlatform,
    deps = {}
) {
    const data = asObject(getState().data || {});
    const currentSnapshot = asObject(
        deps.currentSnapshot ||
            data.turneroReleaseEvidenceBundle ||
            data.turneroReleaseSnapshot ||
            data.currentSnapshot ||
            {}
    );
    const clinicProfile = asObject(
        deps.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            data.turneroClinicProfile ||
            {}
    );
    const controlCenterModel = buildTurneroReleaseControlCenterModel({
        turneroClinicProfile: clinicProfile,
        pilotReadiness:
            data.turneroV2Readiness ||
            data.turneroPilotReadiness ||
            currentSnapshot.pilotReadiness ||
            null,
        remoteReleaseReadiness:
            data.turneroRemoteReleaseReadiness ||
            currentSnapshot.remoteReleaseReadiness ||
            null,
        publicShellDrift:
            data.turneroPublicShellDrift ||
            currentSnapshot.publicShellDrift ||
            null,
        releaseEvidenceBundle:
            currentSnapshot.releaseEvidenceBundle || currentSnapshot,
    });
    const releaseDecision = toText(
        deps.releaseDecision ||
            currentSnapshot.releaseDecision ||
            currentSnapshot.decision ||
            controlCenterModel.decision ||
            'review',
        'review'
    );
    const releaseIncidents = toArray(
        deps.releaseIncidents ||
            currentSnapshot.incidents ||
            controlCenterModel.incidents ||
            []
    );
    const queueMeta = asObject(deps.queueMeta || data.queueMeta || {});
    const queueSurfaceStatus = asObject(
        deps.queueSurfaceStatus || data.queueSurfaceStatus || {}
    );
    const appDownloads = asObject(data.appDownloads || {});
    const remoteReleaseReadiness = asObject(
        data.turneroRemoteReleaseReadiness ||
            currentSnapshot.remoteReleaseReadiness ||
            {}
    );
    const publicShellDrift = asObject(
        data.turneroPublicShellDrift || currentSnapshot.publicShellDrift || {}
    );
    const turneroV2Readiness = asObject(
        data.turneroV2Readiness ||
            data.turneroPilotReadiness ||
            currentSnapshot.pilotReadiness ||
            {}
    );
    const domains = buildUnifiedOrchestrationDomains({
        controlCenterModel,
        releaseDecision,
        releaseIncidents,
        clinicProfile,
        queueMeta,
        queueSurfaceStatus,
        appDownloads,
        remoteReleaseReadiness,
        publicShellDrift,
        turneroV2Readiness,
    });

    return {
        manifest,
        detectedPlatform,
        scope:
            deps.scope ||
            currentSnapshot.region ||
            clinicProfile.region ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            'global',
        region:
            deps.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            'global',
        clinicId:
            deps.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            '',
        clinicLabel:
            deps.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicProfile.clinic_name ||
            clinicProfile.clinicName ||
            '',
        clinicShortName:
            deps.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            '',
        clinicProfile,
        currentSnapshot,
        releaseDecision,
        releaseIncidents,
        controlCenterModel,
        queueMeta,
        queueSurfaceStatus,
        appDownloads,
        remoteReleaseReadiness,
        publicShellDrift,
        turneroV2Readiness,
        domains,
    };
}

export function buildQueueUnifiedOrchestrationFabricContext(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return buildUnifiedOrchestrationContext(manifest, detectedPlatform, deps);
}

export function wireTurneroUnifiedOrchestrationFabric({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveUnifiedOrchestrationHost(mountNode);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const context = buildUnifiedOrchestrationContext(
        manifest,
        detectedPlatform,
        deps
    );
    return mountTurneroReleaseUnifiedOrchestrationFabric(host, context);
}

export function renderQueueUnifiedOrchestrationFabric(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroUnifiedOrchestrationFabric({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
