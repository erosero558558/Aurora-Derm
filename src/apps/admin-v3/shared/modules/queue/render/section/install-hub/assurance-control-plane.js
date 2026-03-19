import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toArray,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { buildTurneroReleaseControlCenterModel } from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseAssuranceControlPlane } from '../../../../../../../queue-shared/turnero-release-assurance-control-plane.js';

function resolveAssuranceHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseAssuranceControlPlaneHost') ||
        document.querySelector('[data-turnero-release-assurance-control-plane]')
    );
}

function mapToneToComplianceStatus(tone) {
    const normalized = String(tone || '')
        .trim()
        .toLowerCase();
    if (
        normalized === 'alert' ||
        normalized === 'critical' ||
        normalized === 'blocked'
    ) {
        return 'red';
    }
    if (normalized === 'warning' || normalized === 'watch') {
        return 'amber';
    }
    return 'green';
}

function mapDecisionToRiskGrade(decision) {
    const normalized = String(decision || '')
        .trim()
        .toLowerCase();
    if (normalized === 'hold') {
        return 'D';
    }
    if (normalized === 'review') {
        return 'B';
    }
    return 'A';
}

function buildReleaseHistoryParts(data = {}) {
    const clinicProfile = asObject(data.turneroClinicProfile || {});
    const clinicProfileMeta = asObject(data.turneroClinicProfileMeta || {});
    const pilotReadiness = asObject(
        data.turneroV2Readiness || data.turneroPilotReadiness || {}
    );

    return {
        clinicProfile,
        turneroClinicProfile: clinicProfile,
        pilotReadiness,
        turneroPilotReadiness: pilotReadiness,
        remoteReleaseReadiness: data.turneroRemoteReleaseReadiness || null,
        turneroRemoteReleaseReadiness:
            data.turneroRemoteReleaseReadiness || null,
        publicShellDrift: data.turneroPublicShellDrift || null,
        turneroPublicShellDrift: data.turneroPublicShellDrift || null,
        releaseEvidenceBundle: data.turneroReleaseEvidenceBundle || null,
        turneroReleaseEvidenceBundle: data.turneroReleaseEvidenceBundle || null,
        clinicId:
            clinicProfile.clinic_id ||
            clinicProfileMeta.clinicId ||
            'default-clinic',
        profileFingerprint:
            clinicProfileMeta.profileFingerprint ||
            clinicProfile.runtime_meta?.profileFingerprint ||
            '',
        releaseMode:
            clinicProfile.release?.mode ||
            clinicProfile.releaseMode ||
            'suite_v2',
    };
}

function buildAssuranceEvidence(context) {
    const clinicProfile = asObject(context.clinicProfile || {});
    const clinicId = toText(
        context.clinicId || clinicProfile.clinic_id || 'regional',
        'regional'
    );
    const incidents = toArray(context.releaseIncidents);
    const governancePack = asObject(context.governancePack || {});
    const boardOpsPack = asObject(context.boardOpsPack || {});
    const hasGovernancePack = Object.keys(governancePack).length > 0;
    const hasBoardOpsPack = Object.keys(boardOpsPack).length > 0;

    return [
        {
            id: 'clinic-profile',
            label: 'Clinic profile snapshot',
            owner: 'frontend',
            kind: 'profile',
            status: clinicProfile.clinic_id ? 'captured' : 'missing',
            clinicId,
        },
        {
            id: 'incident-journal',
            label: 'Release incident journal',
            owner: 'ops',
            kind: 'incident-journal',
            status: incidents.length ? 'captured' : 'stale',
            clinicId,
        },
        {
            id: 'governance-pack',
            label: 'Governance pack',
            owner: 'deploy',
            kind: 'governance',
            status: hasGovernancePack ? 'captured' : 'stale',
            clinicId,
        },
        {
            id: 'board-ops-pack',
            label: 'Board ops brief',
            owner: 'program',
            kind: 'board-ops',
            status: hasBoardOpsPack ? 'captured' : 'stale',
            clinicId,
        },
    ];
}

function buildAssuranceControls(context) {
    const clinicProfile = asObject(context.clinicProfile || {});
    const incidents = toArray(context.releaseIncidents);
    const complianceStatus = String(
        context.complianceStatus ||
            mapToneToComplianceStatus(context.tone) ||
            'amber'
    )
        .trim()
        .toLowerCase();
    const hasCriticalIncident = incidents.some((incident) =>
        ['critical', 'alert', 'blocked', 'error'].includes(
            String(incident?.severity || incident?.state || '')
                .trim()
                .toLowerCase()
        )
    );
    const hasAnyIncident = incidents.length > 0;
    const hasBoardOpsPack =
        Object.keys(asObject(context.boardOpsPack || {})).length > 0;

    return [
        {
            key: 'clinic-profile-canon',
            label: 'Clinic profile canon',
            owner: 'frontend',
            state: clinicProfile.clinic_id ? 'pass' : 'watch',
        },
        {
            key: 'incident-journal',
            label: 'Release incident journal',
            owner: 'ops',
            state: hasCriticalIncident
                ? 'fail'
                : hasAnyIncident
                  ? 'watch'
                  : 'pass',
        },
        {
            key: 'governance-pack',
            label: 'Governance pack',
            owner: 'deploy',
            state:
                complianceStatus === 'red'
                    ? 'fail'
                    : complianceStatus === 'amber'
                      ? 'watch'
                      : 'pass',
        },
        {
            key: 'board-ops-pack',
            label: 'Board ops brief',
            owner: 'program',
            state: hasBoardOpsPack ? 'pass' : 'watch',
        },
    ];
}

function buildAssuranceContext(manifest, detectedPlatform, deps = {}) {
    const data = asObject(getState().data || {});
    const historyParts = buildReleaseHistoryParts(data);
    const controlCenterModel =
        buildTurneroReleaseControlCenterModel(historyParts);
    const clinicProfile = asObject(historyParts.clinicProfile || {});
    const clinicId = toText(
        deps.clinicId ||
            clinicProfile.clinic_id ||
            controlCenterModel.clinicId ||
            historyParts.clinicId ||
            'regional',
        'regional'
    );
    const region = toText(
        deps.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            clinicProfile.location?.region ||
            'regional',
        'regional'
    );
    const clinicLabel = toText(
        deps.clinicLabel ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicId,
        clinicId
    );
    const releaseIncidents = toArray(
        deps.releaseIncidents || controlCenterModel.incidents
    );
    const tone = toText(
        deps.tone || controlCenterModel.tone || 'warning',
        'warning'
    );
    const decision = toText(
        deps.decision || controlCenterModel.decision || 'review',
        'review'
    );
    const complianceStatus = toText(
        deps.complianceStatus || mapToneToComplianceStatus(tone) || 'amber',
        'amber'
    );
    const riskGrade = toText(
        deps.riskGrade || mapDecisionToRiskGrade(decision) || 'B',
        'B'
    ).toUpperCase();
    const governancePack = asObject(
        deps.governancePack || {
            compliance: {
                status: complianceStatus,
            },
            risks: {
                grade: riskGrade,
            },
            summary: controlCenterModel.summary,
            supportCopy: controlCenterModel.supportCopy,
            runbookMarkdown: controlCenterModel.runbookMarkdown,
            incidents: releaseIncidents,
        }
    );
    const boardOpsPack = asObject(
        deps.boardOpsPack || {
            title: 'Board ops brief',
            decision,
            summary: controlCenterModel.summary,
            supportCopy: controlCenterModel.supportCopy,
            incidents: releaseIncidents,
            generatedAt: controlCenterModel.generatedAt,
        }
    );
    const evidence =
        Array.isArray(deps.evidence) && deps.evidence.length
            ? deps.evidence
            : buildAssuranceEvidence({
                  clinicProfile,
                  clinicId,
                  releaseIncidents,
                  governancePack,
                  boardOpsPack,
              });
    const controls =
        Array.isArray(deps.controls) && deps.controls.length
            ? deps.controls
            : buildAssuranceControls({
                  clinicProfile,
                  releaseIncidents,
                  governancePack,
                  boardOpsPack,
                  tone,
                  complianceStatus,
              });

    return {
        manifest,
        detectedPlatform,
        clinicProfile,
        clinicId,
        clinicLabel,
        region,
        scope: deps.scope || region || 'regional',
        releaseIncidents,
        governancePack,
        boardOpsPack,
        evidence,
        controls,
        complianceStatus,
        riskGrade,
        tone,
        decision,
    };
}

export function buildQueueAssuranceControlPlaneContext(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return buildAssuranceContext(manifest, detectedPlatform, deps);
}

export function wireTurneroAssuranceControlPlane({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveAssuranceHost(mountNode);
    if (!(host instanceof HTMLElement)) {
        return null;
    }

    const context = buildAssuranceContext(manifest, detectedPlatform, deps);
    return mountTurneroReleaseAssuranceControlPlane(host, context);
}

export function renderQueueAssuranceControlPlane(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroAssuranceControlPlane({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
