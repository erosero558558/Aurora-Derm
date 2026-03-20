import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseTerminalDiagnosticRunway } from '../../../../../../../queue-shared/turnero-release-terminal-diagnostic-runway.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTerminalDiagnosticRunwayHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseTerminalDiagnosticRunwayHost') ||
        document.querySelector(
            '[data-turnero-release-terminal-diagnostic-runway]'
        )
    );
}

export function buildQueueTerminalDiagnosticRunwayContext(
    manifest,
    detectedPlatform,
    deps = {}
) {
    const state = asObject(getState().data || {});
    const currentSnapshot = asObject(
        deps.currentSnapshot ||
            state.turneroReleaseEvidenceBundle ||
            state.turneroReleaseSnapshot ||
            state.currentSnapshot ||
            {}
    );
    const clinicProfile = asObject(
        deps.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            state.turneroClinicProfile ||
            {}
    );
    const region = toText(
        deps.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            'regional',
        'regional'
    );
    const scope = toText(
        deps.scope || currentSnapshot.scope || region || 'regional',
        'regional'
    );
    const dossierDecision = toText(
        deps.dossierDecision ||
            currentSnapshot.dossierDecision ||
            currentSnapshot.repoVerdict ||
            'issue-final-verdict',
        'issue-final-verdict'
    );
    const clinicId = toText(
        deps.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
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

    return {
        sourceManifest: manifest,
        detectedPlatform,
        scope,
        region,
        dossierDecision,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        releaseEvidenceBundle: asObject(
            deps.releaseEvidenceBundle ||
                currentSnapshot.releaseEvidenceBundle ||
                currentSnapshot.turneroReleaseEvidenceBundle ||
                state.turneroReleaseEvidenceBundle ||
                {}
        ),
    };
}

export function wireTurneroTerminalDiagnosticRunway({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveTerminalDiagnosticRunwayHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseTerminalDiagnosticRunway(
        host,
        buildQueueTerminalDiagnosticRunwayContext(
            manifest,
            detectedPlatform,
            deps
        )
    );
}

export function renderQueueTerminalDiagnosticRunway(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroTerminalDiagnosticRunway({
        manifest,
        detectedPlatform,
        ...deps,
    });
}

export default renderQueueTerminalDiagnosticRunway;
