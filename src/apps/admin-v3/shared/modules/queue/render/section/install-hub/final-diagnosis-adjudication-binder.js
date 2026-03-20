import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseFinalDiagnosisAdjudicationBinder } from '../../../../../../../queue-shared/turnero-release-final-diagnosis-adjudication-binder.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveFinalDiagnosisAdjudicationBinderHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById(
            'queueReleaseFinalDiagnosisAdjudicationBinderHost'
        ) ||
        document.querySelector(
            '[data-turnero-release-final-diagnosis-adjudication-binder]'
        )
    );
}

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return null;
}

export function buildQueueFinalDiagnosisAdjudicationBinderContext(
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
    const releaseEvidenceBundle = asObject(
        deps.releaseEvidenceBundle ||
            currentSnapshot.releaseEvidenceBundle ||
            currentSnapshot.turneroReleaseEvidenceBundle ||
            state.turneroReleaseEvidenceBundle ||
            {}
    );
    const clinicProfile = asObject(
        deps.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            state.turneroClinicProfile ||
            {}
    );
    const clinicId = toText(
        deps.clinicId ||
            currentSnapshot.clinicId ||
            releaseEvidenceBundle.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const region = toText(
        deps.region ||
            currentSnapshot.region ||
            releaseEvidenceBundle.region ||
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
            releaseEvidenceBundle.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        deps.clinicShortName ||
            currentSnapshot.clinicShortName ||
            releaseEvidenceBundle.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const manifestItems = pickArray(
        deps.manifestItems,
        currentSnapshot.manifestItems,
        currentSnapshot.adjudicationItems,
        releaseEvidenceBundle.manifestItems,
        releaseEvidenceBundle.adjudicationItems
    );
    const bundles = pickArray(
        deps.bundles,
        currentSnapshot.bundles,
        currentSnapshot.evidenceBundles,
        releaseEvidenceBundle.bundles,
        releaseEvidenceBundle.evidenceBundles
    );
    const blockers = pickArray(
        deps.blockers,
        currentSnapshot.blockers,
        currentSnapshot.reviewBlockers,
        releaseEvidenceBundle.blockers
    );
    const signoffs = pickArray(
        deps.signoffs,
        currentSnapshot.signoffs,
        currentSnapshot.reviewPanelSignoffs,
        releaseEvidenceBundle.signoffs,
        releaseEvidenceBundle.reviewPanelSignoffs
    );

    return {
        sourceManifest: manifest,
        detectedPlatform,
        scope: toText(
            deps.scope ||
                currentSnapshot.scope ||
                releaseEvidenceBundle.scope ||
                clinicId ||
                region ||
                'global',
            'global'
        ),
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        releaseEvidenceBundle,
        ...(manifestItems ? { manifestItems } : {}),
        ...(bundles ? { bundles } : {}),
        ...(blockers ? { blockers } : {}),
        ...(signoffs ? { signoffs } : {}),
        generatedAt: toText(
            deps.generatedAt ||
                currentSnapshot.generatedAt ||
                releaseEvidenceBundle.generatedAt,
            ''
        ),
        downloadFileName: toText(
            deps.downloadFileName ||
                currentSnapshot.downloadFileName ||
                releaseEvidenceBundle.downloadFileName,
            ''
        ),
    };
}

export function wireTurneroFinalDiagnosisAdjudicationBinder({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveFinalDiagnosisAdjudicationBinderHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseFinalDiagnosisAdjudicationBinder(
        host,
        buildQueueFinalDiagnosisAdjudicationBinderContext(
            manifest,
            detectedPlatform,
            deps
        )
    );
}

export function renderQueueFinalDiagnosisAdjudicationBinder(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroFinalDiagnosisAdjudicationBinder({
        manifest,
        detectedPlatform,
        ...deps,
    });
}

export default renderQueueFinalDiagnosisAdjudicationBinder;
