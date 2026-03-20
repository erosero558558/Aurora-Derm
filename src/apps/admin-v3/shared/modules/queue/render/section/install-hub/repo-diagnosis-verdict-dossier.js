import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseRepoDiagnosisVerdictDossier } from '../../../../../../../queue-shared/turnero-release-repo-diagnosis-verdict-dossier.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveRepoDiagnosisVerdictDossierHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById(
            'queueReleaseRepoDiagnosisVerdictDossierHost'
        ) ||
        document.querySelector(
            '[data-turnero-release-repo-diagnosis-verdict-dossier]'
        )
    );
}

export function buildQueueRepoDiagnosisVerdictDossierContext(
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
    const scope = toText(
        deps.scope || currentSnapshot.scope || region || clinicId || 'global',
        'global'
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
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
    };
}

export function wireTurneroRepoDiagnosisVerdictDossier({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveRepoDiagnosisVerdictDossierHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseRepoDiagnosisVerdictDossier(
        host,
        buildQueueRepoDiagnosisVerdictDossierContext(
            manifest,
            detectedPlatform,
            deps
        )
    );
}

export function renderQueueRepoDiagnosisVerdictDossier(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroRepoDiagnosisVerdictDossier({
        manifest,
        detectedPlatform,
        ...deps,
    });
}

export default renderQueueRepoDiagnosisVerdictDossier;
