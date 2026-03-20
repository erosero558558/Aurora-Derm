import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toArray,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseMainlineAuditBridge } from '../../../../../../../queue-shared/turnero-release-mainline-audit-bridge.js';

function resolveMainlineAuditHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseMainlineAuditBridgeHost') ||
        document.querySelector('[data-turnero-release-mainline-audit-bridge]')
    );
}

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return null;
}

export function buildQueueMainlineAuditBridgeContext(
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
    const clinicId = toText(
        deps.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const region = toText(
        deps.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            clinicId ||
            'regional',
        'regional'
    );
    const clinicLabel = toText(
        deps.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            currentSnapshot.brandName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        deps.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const manifestRows = pickArray(
        deps.manifestRows,
        currentSnapshot.manifestRows,
        currentSnapshot.rows,
        currentSnapshot.items,
        currentSnapshot.sourceManifest?.rows
    );
    const actualRows = pickArray(
        deps.actualRows,
        currentSnapshot.actualRows,
        currentSnapshot.commitRows,
        currentSnapshot.commitEvidenceRows,
        currentSnapshot.evidenceRows
    );
    const runtimeRows = pickArray(
        deps.runtimeRows,
        currentSnapshot.runtimeRows,
        currentSnapshot.surfaceRows,
        currentSnapshot.runtimeSurfaceRows
    );
    const provenance = pickArray(
        deps.provenance,
        currentSnapshot.provenance,
        currentSnapshot.commitProvenance,
        currentSnapshot.evidenceProvenance
    );
    const surfaces = pickArray(
        deps.surfaces,
        currentSnapshot.surfaces,
        currentSnapshot.surfaceRows,
        clinicProfile.surfaces
    );
    const branchDelta = pickArray(
        deps.branchDelta,
        currentSnapshot.branchDelta,
        currentSnapshot.branchDeltas,
        currentSnapshot.deltaRows
    );

    return {
        sourceManifest: manifest,
        detectedPlatform,
        scope: toText(
            deps.scope ||
                currentSnapshot.scope ||
                region ||
                clinicId ||
                'global',
            'global'
        ),
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        ...(manifestRows !== null ? { manifestRows } : {}),
        ...(actualRows !== null ? { actualRows } : {}),
        ...(runtimeRows !== null ? { runtimeRows } : {}),
        ...(provenance !== null ? { provenance } : {}),
        ...(surfaces !== null ? { surfaces } : {}),
        ...(branchDelta !== null ? { branchDelta } : {}),
    };
}

export function wireTurneroMainlineAuditBridge({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveMainlineAuditHost(mountNode);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const context = buildQueueMainlineAuditBridgeContext(
        manifest,
        detectedPlatform,
        deps
    );
    return mountTurneroReleaseMainlineAuditBridge(host, context);
}

export function renderQueueMainlineAuditBridge(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroMainlineAuditBridge({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
