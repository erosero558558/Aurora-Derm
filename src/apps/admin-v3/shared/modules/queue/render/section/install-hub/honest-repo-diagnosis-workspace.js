import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseHonestRepoDiagnosisWorkspace } from '../../../../../../../queue-shared/turnero-release-honest-repo-diagnosis-workspace.js';

const DEFAULT_EVIDENCE_SUMMARY = Object.freeze({
    all: 8,
    complete: 5,
    partial: 2,
    missing: 1,
});
const DEFAULT_CLOSURE_SUMMARY = Object.freeze({
    all: 4,
    ready: 2,
    blocked: 1,
});
const DEFAULT_BLOCKERS = Object.freeze([
    {
        id: 'blk-1',
        kind: 'runtime-source-drift',
        owner: 'infra',
        severity: 'high',
        status: 'open',
        note: 'Runtime source and deployed bundle diverged.',
    },
    {
        id: 'blk-2',
        kind: 'mounted-without-commit-evidence',
        owner: 'program',
        severity: 'medium',
        status: 'open',
        note: 'Host is mounted but commit evidence is incomplete.',
    },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveHonestRepoDiagnosisWorkspaceHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById(
            'queueReleaseHonestRepoDiagnosisWorkspaceHost'
        ) ||
        document.querySelector(
            '[data-turnero-release-honest-repo-diagnosis-workspace]'
        )
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

function pickObject(...candidates) {
    for (const candidate of candidates) {
        if (
            candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate) &&
            Object.keys(candidate).length > 0
        ) {
            return candidate;
        }
    }

    return null;
}

export function buildQueueHonestRepoDiagnosisWorkspaceContext(
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
    const blockers =
        pickArray(
            deps.blockers,
            releaseEvidenceBundle.blockers,
            currentSnapshot.blockers
        ) || DEFAULT_BLOCKERS;
    const gaps =
        pickArray(
            deps.gaps,
            releaseEvidenceBundle.gaps,
            currentSnapshot.gaps
        ) || [];
    const branchDelta =
        pickArray(
            deps.branchDelta,
            releaseEvidenceBundle.branchDelta,
            currentSnapshot.branchDelta,
            currentSnapshot.branchDeltas
        ) || [];
    const evidenceSummary =
        pickObject(
            deps.evidenceSummary,
            releaseEvidenceBundle.evidenceSummary,
            currentSnapshot.evidenceSummary
        ) || DEFAULT_EVIDENCE_SUMMARY;
    const closureSummary =
        pickObject(
            deps.closureSummary,
            releaseEvidenceBundle.closureSummary,
            currentSnapshot.closureSummary
        ) || DEFAULT_CLOSURE_SUMMARY;

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
        releaseEvidenceBundle,
        blockers,
        gaps,
        branchDelta,
        evidenceSummary,
        closureSummary,
    };
}

export function wireTurneroReleaseHonestRepoDiagnosisWorkspace({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveHonestRepoDiagnosisWorkspaceHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseHonestRepoDiagnosisWorkspace(
        host,
        buildQueueHonestRepoDiagnosisWorkspaceContext(
            manifest,
            detectedPlatform,
            deps
        )
    );
}

export function renderQueueHonestRepoDiagnosisWorkspace(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroReleaseHonestRepoDiagnosisWorkspace({
        manifest,
        detectedPlatform,
        ...deps,
    });
}

export default renderQueueHonestRepoDiagnosisWorkspace;
