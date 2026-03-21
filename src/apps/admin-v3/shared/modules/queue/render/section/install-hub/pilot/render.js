import {
    bindQueueOpsPilotActions,
    renderQueueOpsPilotActionMarkup,
} from './actions.js';
import { getState } from '../../../../../../core/store.js';
import {
    createTurneroRemoteReleaseReadinessModel,
    loadTurneroRemoteReleaseHealth,
    renderTurneroRemoteReleaseReadinessCard,
} from '../../../../../../../../queue-shared/turnero-remote-release-readiness.js';
import {
    createTurneroPublicShellDriftModel,
    loadTurneroPublicShellHtml,
    renderTurneroPublicShellDriftCard,
} from '../../../../../../../../queue-shared/turnero-public-shell-drift.js';
import { mountTurneroReleaseControlCenterCard } from '../../../../../../../../queue-shared/turnero-release-control-center.js';
import {
    createTurneroReleaseEvidenceBundleModel,
    mountTurneroReleaseEvidenceBundleCard,
    renderTurneroReleaseEvidenceBundleCard,
} from '../../../../../../../../queue-shared/turnero-release-evidence-bundle.js';
import { mountMultiClinicControlTowerCard } from '../../../../../../../../queue-shared/turnero-release-control-tower.js';
import { mountTurneroReleaseRolloutCommandCenterCard } from '../../../../../../../../queue-shared/turnero-release-rollout-command-center.js';
import { mountTurneroReleaseExecutivePortfolioStudio } from '../../../../../../../../queue-shared/turnero-release-executive-portfolio-studio.js';
import { buildTurneroReleaseServiceQualityMetrics } from '../../../../../../../../queue-shared/turnero-release-service-quality-metrics.js';
import { mountTurneroReleaseMissionControlCard } from '../../../../../../../../queue-shared/turnero-release-mission-control.js';
import { renderTurneroReleaseAutomationMesh } from '../../../../../../../../queue-shared/turnero-release-automation-mesh.js';
import { mountTurneroReleaseOpsConsoleCard } from '../../../../../../../../queue-shared/turnero-release-ops-console.js';
import { mountTurneroAdminQueueSurfaceOpsConsole } from '../../../../../../../../queue-shared/turnero-admin-queue-surface-ops-console.js';
import { mountTurneroAdminQueueSurfaceAcceptanceConsole } from '../../../../../../../../queue-shared/turnero-admin-queue-surface-acceptance-console.js';
import { mountTurneroReleaseBoardOpsHub } from '../../../../../../../../queue-shared/turnero-release-board-ops-hub.js';
import { renderTurneroReleaseWarRoom } from '../../../../../../../../queue-shared/turnero-release-war-room.js';
import { mountTurneroReleaseStrategyDigitalTwinStudio } from '../../../../../../../../queue-shared/turnero-release-strategy-digital-twin-studio.js';
import { mountQueueIncidentExecutionWorkbenchCard } from './incident-execution-workbench.js';
import { getSurfaceTelemetryState } from '../telemetry/state.js';
import {
    getInstallHubSurfaceDefinition,
    getInstallHubSurfaceTelemetryCopy,
    resolveInstallHubSurfaceIdByTelemetryKey,
} from '../registry.js';
import { mountTurneroAdminQueueSurfaceRolloutConsole } from '../../../../../../../../queue-shared/turnero-admin-queue-surface-rollout-console.js';
import {
    getFlowOsRecoveryFreezeNotice,
    hideFlowOsRecoveryHost,
    isFlowOsRecoveryPilotHostFrozen,
} from '../../../../../../../../queue-shared/flow-os-recovery-freeze.js';

function resolvePublicShellDriftOptions(manifest = {}) {
    const config =
        manifest?.publicShellDrift ||
        manifest?.turneroPublicShellDrift ||
        manifest?.queuePublicShellDrift ||
        {};

    const ga4Needles = Array.isArray(config.expectedGa4Needles)
        ? config.expectedGa4Needles
        : Array.isArray(config.trustedGa4Needles)
          ? config.trustedGa4Needles
          : ['googletagmanager.com', 'gtag(', 'dataLayer'];

    return {
        pageUrl: '/',
        timeoutMs: config.timeoutMs || 6000,
        expectedStylesNeedle:
            config.expectedStylesNeedle ||
            config.trustedPublicStylesNeedle ||
            'styles.css',
        expectedShellScriptNeedle:
            config.expectedShellScriptNeedle ||
            config.trustedPublicShellScriptNeedle ||
            'script.js',
        expectedGa4Needles: ga4Needles,
        requireGa4Markers: config.requireGa4Markers !== false,
    };
}

function resolveTurneroRolloutManifest(manifest = {}) {
    const source =
        manifest?.turneroReleaseManifest ||
        manifest?.releaseManifest ||
        manifest?.turneroPilotReleaseManifest ||
        manifest;
    return source && typeof source === 'object' ? source : {};
}

function buildTurneroRolloutSurfaceRegistry() {
    return {
        surfaces: ['operator', 'kiosk', 'display'].map((surfaceKey) => {
            const registrySurfaceId =
                resolveInstallHubSurfaceIdByTelemetryKey(surfaceKey) ||
                surfaceKey;
            const definition =
                getInstallHubSurfaceDefinition(registrySurfaceId) || {};
            const telemetryCopy =
                getInstallHubSurfaceTelemetryCopy(surfaceKey) || {};

            return {
                id: registrySurfaceId,
                key: surfaceKey,
                family: definition.family || '',
                route: definition.webFallbackUrl || definition.guideUrl || '',
                productName:
                    definition.productName || telemetryCopy.title || surfaceKey,
                ops: {
                    installHub: {
                        title:
                            telemetryCopy.title ||
                            definition.cardCopy?.title ||
                            surfaceKey,
                        description:
                            telemetryCopy.emptySummary ||
                            definition.cardCopy?.description ||
                            '',
                        recommendedFor:
                            definition.cardCopy?.recommendedFor || '',
                    },
                },
                catalog: {
                    description: definition.cardCopy?.description || '',
                    eyebrow: definition.cardCopy?.eyebrow || '',
                },
            };
        }),
    };
}

function renderPilotRolloutStations(pilot, escapeHtml) {
    if (
        !Array.isArray(pilot.rolloutStations) ||
        !pilot.rolloutStations.length
    ) {
        return '';
    }

    return `
        <div class="queue-ops-pilot__lanes">
            ${pilot.rolloutStations
                .map(
                    (station) => `
                        <article class="queue-ops-pilot__lane" data-state="${
                            station.ready
                                ? 'ready'
                                : station.live
                                  ? 'warning'
                                  : 'pending'
                        }">
                            <span>${escapeHtml(station.title)}</span>
                            <strong>${escapeHtml(
                                station.ready
                                    ? 'Desktop lista'
                                    : station.live
                                      ? 'Desktop visible'
                                      : 'Pendiente'
                            )}</strong>
                        </article>
                    `
                )
                .join('')}
        </div>
    `;
}

function normalizeBoardOpsHubText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeBoardOpsHubNumber(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
}

function clampBoardOpsHubPercent(value, fallback = 0) {
    return Math.max(
        0,
        Math.min(100, normalizeBoardOpsHubNumber(value, fallback))
    );
}

function normalizeBoardOpsHubArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeBoardOpsHubSeverity(value, fallback = 'warning') {
    const normalized = normalizeBoardOpsHubText(value, fallback).toLowerCase();
    if (
        ['alert', 'critical', 'blocker', 'blocked', 'high'].includes(normalized)
    ) {
        return 'alert';
    }
    if (
        ['warning', 'watch', 'pending', 'review', 'medium'].includes(normalized)
    ) {
        return 'warning';
    }
    if (
        ['ready', 'done', 'approved', 'closed', 'ok', 'success'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    return fallback;
}

function normalizeBoardOpsHubApprovalStatus(value, fallback = 'requested') {
    const normalized = normalizeBoardOpsHubText(value, fallback).toLowerCase();
    if (['approved', 'done', 'closed'].includes(normalized)) {
        return 'done';
    }
    if (['rejected', 'cancelled', 'canceled', 'blocked'].includes(normalized)) {
        return 'blocked';
    }
    if (['working', 'in-progress', 'progress', 'doing'].includes(normalized)) {
        return 'working';
    }
    if (['paused', 'hold'].includes(normalized)) {
        return 'paused';
    }
    return 'requested';
}

function averageBoardOpsHubPercent(values, fallback = 0) {
    const numbers = normalizeBoardOpsHubArray(values)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

    if (!numbers.length) {
        return fallback;
    }

    return Number(
        (
            numbers.reduce((sum, value) => sum + value, 0) / numbers.length
        ).toFixed(1)
    );
}

function normalizeBoardOpsHubClinic(
    source = {},
    index = 0,
    region = 'regional'
) {
    const clinic = source && typeof source === 'object' ? source : {};
    return {
        clinicId: normalizeBoardOpsHubText(
            clinic.clinicId ||
                clinic.clinic_id ||
                clinic.id ||
                `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        label: normalizeBoardOpsHubText(
            clinic.label ||
                clinic.clinicName ||
                clinic.name ||
                clinic.branding?.name ||
                clinic.branding?.short_name ||
                `Clínica ${index + 1}`
        ),
        region: normalizeBoardOpsHubText(
            clinic.region || region || 'regional',
            'regional'
        ),
        status: normalizeBoardOpsHubText(
            clinic.status || (clinic.ready === false ? 'watch' : 'active'),
            'active'
        ),
        adoptionRate: clampBoardOpsHubPercent(
            clinic.adoptionRate ??
                clinic.adoptionPct ??
                clinic.adoption ??
                clinic.progressPct,
            72
        ),
        valueScore: clampBoardOpsHubPercent(
            clinic.valueScore ??
                clinic.valuePct ??
                clinic.value ??
                clinic.valueRealization,
            76
        ),
    };
}

function normalizeBoardOpsHubIncident(
    source = {},
    index = 0,
    kind = 'incident'
) {
    const incident = source && typeof source === 'object' ? source : {};
    const severity = normalizeBoardOpsHubSeverity(
        incident.severity ||
            incident.state ||
            incident.tone ||
            incident.status ||
            'warning',
        'warning'
    );

    return {
        id: normalizeBoardOpsHubText(
            incident.id || incident.incidentId || `${kind}-${index + 1}`
        ),
        title: normalizeBoardOpsHubText(
            incident.title ||
                incident.label ||
                incident.name ||
                incident.summary ||
                'Incident'
        ),
        detail: normalizeBoardOpsHubText(
            incident.detail ||
                incident.summary ||
                incident.note ||
                incident.reason ||
                ''
        ),
        owner: normalizeBoardOpsHubText(
            incident.owner ||
                incident.assignee ||
                incident.suggestedOwner ||
                'board'
        ),
        severity,
        state: severity,
        source: normalizeBoardOpsHubText(
            incident.source || incident.kind || kind || 'pilot'
        ),
        category: normalizeBoardOpsHubText(
            incident.category || incident.type || kind || 'go-live'
        ),
        dueDate: normalizeBoardOpsHubText(
            incident.dueDate || incident.dueAt || incident.due || ''
        ),
    };
}

function normalizeBoardOpsHubApproval(
    source = {},
    index = 0,
    kind = 'approval'
) {
    const approval = source && typeof source === 'object' ? source : {};
    const status = normalizeBoardOpsHubApprovalStatus(
        approval.status ||
            approval.state ||
            (approval.ready === false ? 'requested' : 'approved')
    );

    return {
        id: normalizeBoardOpsHubText(
            approval.id || approval.approvalId || `${kind}-${index + 1}`
        ),
        title: normalizeBoardOpsHubText(
            approval.title ||
                approval.label ||
                approval.name ||
                approval.summary ||
                'Approval'
        ),
        detail: normalizeBoardOpsHubText(
            approval.detail ||
                approval.summary ||
                approval.note ||
                approval.reason ||
                ''
        ),
        owner: normalizeBoardOpsHubText(
            approval.owner ||
                approval.assignee ||
                approval.suggestedApprover ||
                'board'
        ),
        status,
        source: normalizeBoardOpsHubText(
            approval.source || approval.kind || kind || 'pilot'
        ),
        requestedAt: normalizeBoardOpsHubText(
            approval.requestedAt || new Date().toISOString()
        ),
        resolvedAt:
            approval.resolvedAt === undefined || approval.resolvedAt === null
                ? null
                : normalizeBoardOpsHubText(approval.resolvedAt),
    };
}

function buildBoardOpsHubPayload(
    pilot = {},
    manifest = {},
    releaseControlCenterModel = {}
) {
    const clinicProfile =
        pilot.clinicProfile ||
        pilot.turneroClinicProfile ||
        manifest.clinicProfile ||
        manifest.turneroClinicProfile ||
        {};
    const region = normalizeBoardOpsHubText(
        pilot.region ||
            clinicProfile.region ||
            clinicProfile.branding?.region ||
            clinicProfile.address?.region ||
            manifest.region ||
            'regional',
        'regional'
    );
    const scope = normalizeBoardOpsHubText(
        pilot.scope ||
            region ||
            clinicProfile.clinicId ||
            clinicProfile.clinic_id ||
            'regional',
        'regional'
    );
    const programName = normalizeBoardOpsHubText(
        pilot.programName ||
            pilot.program ||
            clinicProfile.programName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            'Turnero Web por Clínica'
    );

    const clinicCandidates = [
        pilot.clinicProfiles,
        pilot.turneroClinicProfiles,
        manifest.clinicProfiles,
        manifest.turneroClinicProfiles,
        clinicProfile.regionalClinics,
        clinicProfile.clinics,
    ].find((entry) => Array.isArray(entry) && entry.length > 0);

    const clinics = clinicCandidates
        ? clinicCandidates.map((clinic, index) =>
              normalizeBoardOpsHubClinic(clinic, index, region)
          )
        : [
              normalizeBoardOpsHubClinic(
                  {
                      clinicId:
                          clinicProfile.clinicId ||
                          clinicProfile.clinic_id ||
                          pilot.clinicId ||
                          `${region}-clinic`,
                      label:
                          clinicProfile.branding?.name ||
                          clinicProfile.branding?.short_name ||
                          pilot.clinicName ||
                          pilot.brandName ||
                          programName,
                      region,
                      adoptionRate:
                          pilot.progressPct ||
                          (normalizeBoardOpsHubNumber(pilot.totalSteps, 0) > 0
                              ? Number(
                                    (
                                        (normalizeBoardOpsHubNumber(
                                            pilot.confirmedCount,
                                            0
                                        ) /
                                            normalizeBoardOpsHubNumber(
                                                pilot.totalSteps,
                                                1
                                            )) *
                                        100
                                    ).toFixed(1)
                                )
                              : 72),
                      valueScore: normalizeBoardOpsHubNumber(
                          pilot.valueScore || pilot.valuePct,
                          76
                      ),
                      status:
                          pilot.readinessState === 'ready' ? 'active' : 'watch',
                  },
                  0,
                  region
              ),
          ];

    const goLiveIssues = normalizeBoardOpsHubArray(pilot.goLiveIssues);
    const readinessItems = normalizeBoardOpsHubArray(pilot.readinessItems);
    const handoffItems = normalizeBoardOpsHubArray(pilot.handoffItems);
    const readinessIncidents = readinessItems
        .filter((item) => {
            const state = item && typeof item === 'object' ? item : {};
            return !(
                state.ready === true ||
                normalizeBoardOpsHubSeverity(
                    state.state || state.severity || state.tone || state.status,
                    'warning'
                ) === 'ready'
            );
        })
        .map((item, index) =>
            normalizeBoardOpsHubIncident(item, index, 'readiness')
        );

    const incidents = [
        ...goLiveIssues.map((item, index) =>
            normalizeBoardOpsHubIncident(item, index, 'go-live')
        ),
        ...readinessIncidents,
    ];

    const approvals = readinessItems
        .filter((item) => {
            const state = item && typeof item === 'object' ? item : {};
            return (
                state.ready === true ||
                normalizeBoardOpsHubSeverity(
                    state.state || state.severity || state.tone || state.status,
                    'warning'
                ) === 'ready'
            );
        })
        .map((item, index) =>
            normalizeBoardOpsHubApproval(item, index, 'readiness')
        )
        .concat(
            handoffItems.map((item, index) =>
                normalizeBoardOpsHubApproval(item, index, 'handoff')
            )
        );

    return {
        pilot,
        manifest,
        releaseControlCenterModel,
        clinicProfile,
        region,
        scope,
        programName,
        clinics,
        incidents,
        approvals,
        kpis: {
            blockedIncidents: incidents.filter(
                (item) => item.severity === 'alert'
            ).length,
            pendingApprovals: approvals.filter((item) => item.status !== 'done')
                .length,
            avgAdoption: averageBoardOpsHubPercent(
                clinics.map((clinic) => clinic.adoptionRate),
                72
            ),
            avgValue: averageBoardOpsHubPercent(
                clinics.map((clinic) => clinic.valueScore),
                76
            ),
            clinicCount: clinics.length,
        },
        value: {
            realizationPct: averageBoardOpsHubPercent(
                clinics.map((clinic) => clinic.valueScore),
                76
            ),
            valueScore: averageBoardOpsHubPercent(
                clinics.map((clinic) => clinic.valueScore),
                76
            ),
        },
        governance: {
            decision:
                releaseControlCenterModel?.decision ||
                pilot.readinessState ||
                'review',
            mode:
                releaseControlCenterModel?.decision ||
                pilot.readinessState ||
                'review',
        },
    };
}

function normalizeStrategyDigitalTwinClinic(
    source = {},
    index = 0,
    region = 'regional'
) {
    const clinic = source && typeof source === 'object' ? source : {};
    const clinicId = normalizeBoardOpsHubText(
        clinic.clinicId ||
            clinic.clinic_id ||
            clinic.id ||
            clinic.code ||
            clinic.branding?.short_name ||
            clinic.branding?.name ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const clinicName = normalizeBoardOpsHubText(
        clinic.clinicName ||
            clinic.name ||
            clinic.label ||
            clinic.branding?.short_name ||
            clinic.branding?.name ||
            clinicId,
        clinicId
    );
    const baseDemand = normalizeBoardOpsHubNumber(
        clinic.baseDemand ??
            clinic.expectedBenefit ??
            clinic.demand ??
            clinic.monthlyDemand ??
            clinic.forecastDemand ??
            clinic.valueScore,
        22 + index * 3
    );
    const growthFactor = normalizeBoardOpsHubNumber(
        clinic.growthFactor ?? clinic.growth ?? clinic.demandGrowth,
        1.06
    );
    const seasonality = normalizeBoardOpsHubNumber(
        clinic.seasonality ?? clinic.seasonalityFactor,
        1
    );
    const adoptionRate = clampBoardOpsHubPercent(
        clinic.adoptionRate ??
            clinic.adoptionPct ??
            clinic.adoption ??
            clinic.procurementReadiness ??
            clinic.valueScore,
        72
    );
    const qualityScore = clampBoardOpsHubPercent(
        clinic.qualityScore ?? clinic.serviceQualityScore ?? adoptionRate,
        76
    );
    const resilienceScore = clampBoardOpsHubPercent(
        clinic.resilienceScore ?? clinic.reliabilityScore ?? qualityScore - 4,
        74
    );

    return {
        clinicId,
        clinicName,
        label: clinicName,
        region: normalizeBoardOpsHubText(
            clinic.region || clinic.area || region,
            region
        ),
        baseDemand,
        growthFactor,
        seasonality,
        adoptionRate,
        qualityScore,
        resilienceScore,
        queueFlowScore: clampBoardOpsHubPercent(
            clinic.queueFlowScore ?? qualityScore * 0.75 + adoptionRate * 0.25,
            qualityScore
        ),
        callAccuracyScore: clampBoardOpsHubPercent(
            clinic.callAccuracyScore ??
                qualityScore * 0.85 + resilienceScore * 0.15,
            qualityScore
        ),
        deskReadinessScore: clampBoardOpsHubPercent(
            clinic.deskReadinessScore ?? resilienceScore,
            resilienceScore
        ),
        patientSignalScore: clampBoardOpsHubPercent(
            clinic.patientSignalScore ??
                adoptionRate * 0.6 + qualityScore * 0.4,
            adoptionRate
        ),
        status: normalizeBoardOpsHubText(
            clinic.status ||
                (qualityScore >= 75
                    ? 'active'
                    : qualityScore >= 60
                      ? 'watch'
                      : 'stabilize'),
            'watch'
        ),
    };
}

function resolveStrategyDigitalTwinStudioClinics(
    pilot = {},
    manifest = {},
    releaseControlCenterModel = {},
    snapshot = {}
) {
    const clinicProfile =
        pilot.clinicProfile ||
        pilot.turneroClinicProfile ||
        releaseControlCenterModel?.turneroClinicProfile ||
        snapshot?.turneroClinicProfile ||
        manifest.clinicProfile ||
        manifest.turneroClinicProfile ||
        {};
    const region = normalizeBoardOpsHubText(
        pilot.region ||
            clinicProfile.region ||
            clinicProfile.branding?.region ||
            manifest.region ||
            releaseControlCenterModel?.turneroClinicProfile?.region ||
            snapshot?.turneroClinicProfile?.region ||
            'regional',
        'regional'
    );
    const scope = normalizeBoardOpsHubText(
        pilot.scope ||
            region ||
            clinicProfile.clinicId ||
            clinicProfile.clinic_id ||
            'regional',
        'regional'
    );
    const clinicCandidates = [
        pilot.regionalClinics,
        pilot.turneroRegionalClinics,
        manifest.regionalClinics,
        manifest.turneroRegionalClinics,
        releaseControlCenterModel?.turneroClinicProfile?.regionalClinics,
        clinicProfile?.regionalClinics,
        clinicProfile?.clinics,
        snapshot?.turneroClinicProfile?.regionalClinics,
        snapshot?.turneroClinicProfile?.clinics,
    ].find((entry) => Array.isArray(entry) && entry.length > 0);
    const clinics = clinicCandidates
        ? clinicCandidates.map((clinic, index) =>
              normalizeStrategyDigitalTwinClinic(clinic, index, region)
          )
        : [
              normalizeStrategyDigitalTwinClinic(
                  {
                      clinicId:
                          clinicProfile.clinicId ||
                          clinicProfile.clinic_id ||
                          pilot.clinicId ||
                          region,
                      clinicName:
                          clinicProfile.branding?.name ||
                          clinicProfile.branding?.short_name ||
                          pilot.clinicName ||
                          pilot.brandName ||
                          region,
                      region,
                  },
                  0,
                  region
              ),
          ];

    const qualityRows = buildTurneroReleaseServiceQualityMetrics({
        clinics,
    }).rows.map((row, index) => ({
        clinicId: normalizeBoardOpsHubText(
            row.clinicId || clinics[index]?.clinicId || `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        score: Number(
            clampBoardOpsHubPercent(
                row.score,
                clinics[index]?.qualityScore || 76
            ).toFixed(1)
        ),
    }));
    const reliabilityRows = clinics.map((clinic) => ({
        clinicId: clinic.clinicId,
        resilienceScore: Number(
            clampBoardOpsHubPercent(clinic.resilienceScore, 74).toFixed(1)
        ),
    }));

    return {
        clinicProfile,
        region,
        scope,
        clinics,
        qualityRows,
        reliabilityRows,
    };
}

function normalizeReleaseEvidenceState(value, fallback = 'warning') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();

    if (normalized === 'alert') {
        return 'blocked';
    }

    if (
        normalized === 'ready' ||
        normalized === 'warning' ||
        normalized === 'blocked'
    ) {
        return normalized;
    }

    return fallback;
}

function buildQueueOpsPilotReleaseEvidenceLocalModel(pilot) {
    const blockers = Array.isArray(pilot.goLiveIssues)
        ? pilot.goLiveIssues
              .filter((issue) => issue.state === 'alert')
              .map((issue, index) => ({
                  key: String(issue.id || `local_blocker_${index + 1}`),
                  title: String(issue.label || 'Bloqueo').trim(),
                  detail: String(issue.detail || '').trim(),
              }))
        : [];
    const state = normalizeReleaseEvidenceState(
        pilot.readinessState,
        'warning'
    );

    return {
        readySurfaceCount: Number(pilot.confirmedCount || 0),
        totalSurfaceCount: Number(pilot.totalSteps || 0),
        openingPackageState: state,
        openingPackageStatus: state,
        state,
        clinicName: String(pilot.clinicName || pilot.brandName || '').trim(),
        brandName: String(pilot.clinicName || pilot.brandName || '').trim(),
        clinicId: String(pilot.clinicId || '').trim(),
        profileFingerprint: String(pilot.profileFingerprint || '').trim(),
        releaseMode: String(pilot.releaseMode || '').trim(),
        runtimeSource: String(pilot.runtimeSource || '').trim(),
        blockers,
    };
}

function buildQueueOpsPilotReleaseEvidenceRemoteModel(
    remoteState,
    remoteModel
) {
    const health = remoteState?.health?.payload || {};
    const publicSync =
        health?.checks && typeof health.checks === 'object'
            ? health.checks.publicSync || {}
            : {};
    const diagnosticsPayload =
        remoteState?.diagnostics?.payload &&
        typeof remoteState.diagnostics.payload === 'object'
            ? remoteState.diagnostics.payload
            : {};
    const checks =
        diagnosticsPayload.checks &&
        typeof diagnosticsPayload.checks === 'object'
            ? diagnosticsPayload.checks
            : {};
    const turneroPilot =
        checks.turneroPilot && typeof checks.turneroPilot === 'object'
            ? checks.turneroPilot
            : {};
    const itemsById = Object.fromEntries(
        (Array.isArray(remoteModel.items) ? remoteModel.items : []).map(
            (item) => [item.id, item]
        )
    );
    const blockers = (Array.isArray(remoteModel.items) ? remoteModel.items : [])
        .filter((item) => item.state === 'alert')
        .map((item, index) => ({
            key: String(item.id || `remote_blocker_${index + 1}`),
            title: String(item.label || 'Bloqueo').trim(),
            detail: String(item.detail || '').trim(),
        }));
    const releaseStatus = normalizeReleaseEvidenceState(
        remoteModel.tone,
        'warning'
    );

    return {
        releaseStatus,
        status: releaseStatus,
        finalState: releaseStatus,
        expectedClinicId: String(
            remoteState?.clinicId || turneroPilot.clinicId || ''
        ).trim(),
        expectedProfileFingerprint: String(
            remoteState?.profileFingerprint ||
                turneroPilot.profileFingerprint ||
                ''
        ).trim(),
        deployedCommit: String(publicSync.deployedCommit || '').trim(),
        publicSyncLabel: String(
            itemsById.public_sync?.detail || itemsById.public_sync?.label || ''
        ).trim(),
        diagnosticsLabel: String(
            itemsById.diagnostics?.detail || itemsById.diagnostics?.label || ''
        ).trim(),
        figoLabel: String(
            itemsById.figo?.detail || itemsById.figo?.label || ''
        ).trim(),
        sourceHealthLabel: String(
            [itemsById.availability?.detail, itemsById.booked_slots?.detail]
                .filter(Boolean)
                .join(' · ')
        ).trim(),
        blockers,
    };
}

function buildQueueOpsPilotReleaseEvidenceSnapshot(
    pilot,
    remoteState,
    remoteReadinessModel,
    publicShellDriftModel
) {
    const generatedAt = new Date().toISOString();
    const turneroClinicProfile =
        pilot.clinicProfile ||
        pilot.turneroClinicProfile ||
        getState()?.data?.turneroClinicProfile ||
        null;
    const localReadinessModel =
        buildQueueOpsPilotReleaseEvidenceLocalModel(pilot);
    const remoteReleaseModel = buildQueueOpsPilotReleaseEvidenceRemoteModel(
        remoteState,
        remoteReadinessModel
    );

    return {
        generatedAt,
        turneroClinicProfile,
        pilotReadiness: pilot,
        remoteReleaseReadiness: remoteReadinessModel,
        publicShellDrift: publicShellDriftModel,
        localReadinessModel,
        remoteReleaseModel,
        publicShellDriftModel,
        releaseEvidenceBundle: {
            generatedAt,
            turneroClinicProfile,
            pilotReadiness: pilot,
            remoteReleaseReadiness: remoteReadinessModel,
            publicShellDrift: publicShellDriftModel,
            localReadinessModel,
            remoteReleaseModel,
            publicShellDriftModel,
        },
    };
}

function renderQueueOpsPilotReleaseWarRoom(
    root,
    pilot,
    manifest,
    requestId,
    options = {}
) {
    const host = document.getElementById('queueOpsPilotReleaseWarRoomHost');

    if (
        !(host instanceof HTMLElement) ||
        root.dataset.turneroQueueOpsPilotRenderId !== requestId
    ) {
        return;
    }

    return renderTurneroReleaseWarRoom(
        host,
        {
            clinicProfile:
                manifest?.turneroClinicProfile ||
                manifest?.clinicProfile ||
                getState()?.data?.turneroClinicProfile ||
                null,
            pilotReadiness: pilot,
            remoteReleaseReadiness:
                options.remoteReleaseReadiness ||
                manifest?.turneroRemoteReleaseReadiness ||
                manifest?.remoteReleaseReadiness ||
                getState()?.data?.turneroRemoteReleaseReadiness ||
                null,
            publicShellDrift:
                options.publicShellDrift ||
                manifest?.turneroPublicShellDrift ||
                manifest?.publicShellDrift ||
                getState()?.data?.turneroPublicShellDrift ||
                null,
            releaseEvidenceBundle:
                options.releaseEvidenceBundle ||
                manifest?.turneroReleaseEvidenceBundle ||
                manifest?.releaseEvidenceBundle ||
                getState()?.data?.turneroReleaseEvidenceBundle ||
                null,
        },
        { replace: true }
    );
}

function renderQueueOpsPilotAutomationMesh(
    root,
    pilot,
    manifest,
    requestId,
    options = {}
) {
    const host = document.getElementById('queueOpsPilotAutomationMeshHost');

    if (
        !(host instanceof HTMLElement) ||
        root.dataset.turneroQueueOpsPilotRenderId !== requestId
    ) {
        return null;
    }

    return renderTurneroReleaseAutomationMesh(
        host,
        {
            clinicProfile:
                options.snapshot?.turneroClinicProfile ||
                options.snapshot?.clinicProfile ||
                pilot.clinicProfile ||
                pilot.turneroClinicProfile ||
                manifest?.turneroClinicProfile ||
                manifest?.clinicProfile ||
                getState()?.data?.turneroClinicProfile ||
                null,
            pilotReadiness: pilot,
            remoteReleaseReadiness:
                options.remoteReleaseReadiness ||
                manifest?.turneroRemoteReleaseReadiness ||
                manifest?.remoteReleaseReadiness ||
                getState()?.data?.turneroRemoteReleaseReadiness ||
                null,
            publicShellDrift:
                options.publicShellDrift ||
                manifest?.turneroPublicShellDrift ||
                manifest?.publicShellDrift ||
                getState()?.data?.turneroPublicShellDrift ||
                null,
            releaseEvidenceBundle:
                options.releaseEvidenceBundle ||
                manifest?.turneroReleaseEvidenceBundle ||
                manifest?.releaseEvidenceBundle ||
                getState()?.data?.turneroReleaseEvidenceBundle ||
                null,
            releaseControlCenterSnapshot: options.snapshot || null,
            releaseWarRoomSnapshot: options.releaseWarRoomSnapshot || null,
            incidentJournalEntries:
                options.incidentJournalEntries ||
                options.releaseWarRoomSnapshot?.journalEntries ||
                getState()?.data?.turneroIncidentJournalEntries ||
                [],
            incidentExecutorState: options.incidentExecutorState || null,
            releaseCommandDeckSnapshot:
                options.releaseCommandDeckSnapshot || null,
            ownerWorkbenchSnapshot: options.ownerWorkbenchSnapshot || null,
            recheckQueueSnapshot: options.recheckQueueSnapshot || null,
        },
        {
            decision:
                options.releaseEvidenceBundle?.finalDecision ||
                options.releaseEvidenceBundle?.decision ||
                pilot.readinessState,
            releaseMode:
                pilot.releaseMode ||
                pilot.clinicProfile?.release?.mode ||
                manifest?.release?.mode ||
                '',
            baseUrl:
                pilot.clinicProfile?.branding?.base_url ||
                pilot.clinicProfile?.branding?.baseUrl ||
                pilot.clinicProfile?.baseUrl ||
                globalThis?.location?.origin ||
                '',
            storage: options.storage,
            clinicId: pilot.clinicId,
        }
    );
}

async function hydrateQueueOpsPilotReleaseEvidence(
    root,
    pilot,
    manifest,
    requestId,
    options = {}
) {
    const remoteReleaseHost = document.getElementById(
        'queueOpsPilotRemoteReleaseHost'
    );
    const publicShellDriftHost = document.getElementById(
        'queuePublicShellDriftCard'
    );
    const releaseControlCenterHost = document.getElementById(
        'queueReleaseControlCenterHost'
    );
    const releaseEvidenceHost = document.getElementById(
        'queueOpsPilotReleaseEvidenceHost'
    );
    const rolloutGovernorHost = document.getElementById(
        'queueOpsPilotRolloutGovernorHost'
    );
    const executivePortfolioStudioHost = document.getElementById(
        'queueOpsPilotExecutivePortfolioStudioHost'
    );
    const strategyDigitalTwinStudioHost = document.getElementById(
        'queueOpsPilotStrategyDigitalTwinStudioHost'
    );
    const multiClinicControlTowerHost = document.getElementById(
        'queueMultiClinicControlTowerHost'
    );
    const boardOpsHubHost = document.getElementById(
        'queueReleaseBoardOpsHubHost'
    );
    const releaseOpsConsoleHost = document.getElementById(
        'queueReleaseOpsConsoleHost'
    );
    const surfaceAcceptanceConsoleHost = document.getElementById(
        'queueSurfaceAcceptanceConsoleHost'
    );
    const missionControlHost = document.getElementById(
        'queueReleaseMissionControlHost'
    );
    const incidentWorkbenchHost = document.getElementById(
        'queueIncidentExecutionWorkbenchHost'
    );

    if (
        !(remoteReleaseHost instanceof HTMLElement) ||
        !(publicShellDriftHost instanceof HTMLElement) ||
        !(releaseEvidenceHost instanceof HTMLElement)
    ) {
        return;
    }

    const freezeExecutivePortfolioStudio = isFlowOsRecoveryPilotHostFrozen(
        'queueOpsPilotExecutivePortfolioStudioHost'
    );
    const freezeStrategyDigitalTwinStudio = isFlowOsRecoveryPilotHostFrozen(
        'queueOpsPilotStrategyDigitalTwinStudioHost'
    );
    const freezeMultiClinicControlTower = isFlowOsRecoveryPilotHostFrozen(
        'queueMultiClinicControlTowerHost'
    );
    const freezeNote = getFlowOsRecoveryFreezeNotice();

    if (freezeExecutivePortfolioStudio) {
        hideFlowOsRecoveryHost(executivePortfolioStudioHost, freezeNote);
    }
    if (freezeStrategyDigitalTwinStudio) {
        hideFlowOsRecoveryHost(strategyDigitalTwinStudioHost, freezeNote);
    }
    if (freezeMultiClinicControlTower) {
        hideFlowOsRecoveryHost(multiClinicControlTowerHost, freezeNote);
    }

    const publicShellOptions = resolvePublicShellDriftOptions(manifest);
    const bundleOptions = {
        origin: window.location.origin,
        baseUrl: window.location.origin,
        nativeWaveLabel: 'ola nativa posterior',
        fileNamePrefix: 'turnero-release-evidence',
    };

    remoteReleaseHost.setAttribute('aria-busy', 'true');
    publicShellDriftHost.setAttribute('aria-busy', 'true');
    if (releaseControlCenterHost instanceof HTMLElement) {
        releaseControlCenterHost.setAttribute('aria-busy', 'true');
    }
    releaseEvidenceHost.setAttribute('aria-busy', 'true');
    if (rolloutGovernorHost instanceof HTMLElement) {
        rolloutGovernorHost.setAttribute('aria-busy', 'true');
    }
    if (
        executivePortfolioStudioHost instanceof HTMLElement &&
        !freezeExecutivePortfolioStudio
    ) {
        executivePortfolioStudioHost.setAttribute('aria-busy', 'true');
    }
    if (
        strategyDigitalTwinStudioHost instanceof HTMLElement &&
        !freezeStrategyDigitalTwinStudio
    ) {
        strategyDigitalTwinStudioHost.setAttribute('aria-busy', 'true');
    }
    if (
        multiClinicControlTowerHost instanceof HTMLElement &&
        !freezeMultiClinicControlTower
    ) {
        multiClinicControlTowerHost.setAttribute('aria-busy', 'true');
    }
    if (missionControlHost instanceof HTMLElement) {
        missionControlHost.setAttribute('aria-busy', 'true');
    }

    let snapshot;
    let remoteReadinessModel;
    let publicShellDriftModel;
    let releaseEvidenceBundleModel;
    let releaseControlCenterSection = null;
    let rolloutGovernorModel = null;

    try {
        const [remoteState, publicShellScan] = await Promise.all([
            loadTurneroRemoteReleaseHealth({
                clinicId: pilot.clinicId,
                profileFingerprint: pilot.profileFingerprint,
            }),
            loadTurneroPublicShellHtml(publicShellOptions),
        ]);

        if (root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
            return;
        }

        remoteReadinessModel =
            createTurneroRemoteReleaseReadinessModel(remoteState);
        publicShellDriftModel = createTurneroPublicShellDriftModel(
            {
                pageOk: publicShellScan.ok,
                pageStatus: publicShellScan.pageStatus,
                html: publicShellScan.html,
            },
            publicShellOptions
        );

        remoteReleaseHost.innerHTML =
            renderTurneroRemoteReleaseReadinessCard(remoteReadinessModel);
        publicShellDriftHost.innerHTML = renderTurneroPublicShellDriftCard(
            publicShellDriftModel,
            publicShellOptions
        );

        snapshot = buildQueueOpsPilotReleaseEvidenceSnapshot(
            pilot,
            remoteState,
            remoteReadinessModel,
            publicShellDriftModel
        );
        releaseEvidenceBundleModel = createTurneroReleaseEvidenceBundleModel(
            snapshot,
            bundleOptions
        );
    } catch (error) {
        if (root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
            return;
        }

        const message =
            error instanceof Error
                ? error.message
                : String(error || 'request_failed');
        const fallbackRemoteState = {
            clinicId: pilot.clinicId,
            profileFingerprint: pilot.profileFingerprint,
            health: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            diagnostics: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            availability: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            bookedSlots: {
                kind: 'unavailable',
                ok: false,
                status: 0,
                error: message,
                payload: {},
            },
            loadedAt: new Date().toISOString(),
        };
        remoteReadinessModel =
            createTurneroRemoteReleaseReadinessModel(fallbackRemoteState);
        publicShellDriftModel = createTurneroPublicShellDriftModel(
            {
                pageOk: false,
                pageStatus: 0,
                html: '',
            },
            publicShellOptions
        );

        remoteReleaseHost.innerHTML =
            renderTurneroRemoteReleaseReadinessCard(remoteReadinessModel);
        publicShellDriftHost.innerHTML = renderTurneroPublicShellDriftCard(
            publicShellDriftModel,
            publicShellOptions
        );

        snapshot = buildQueueOpsPilotReleaseEvidenceSnapshot(
            pilot,
            fallbackRemoteState,
            remoteReadinessModel,
            publicShellDriftModel
        );
        releaseEvidenceBundleModel = createTurneroReleaseEvidenceBundleModel(
            snapshot,
            bundleOptions
        );
    } finally {
        if (root.dataset.turneroQueueOpsPilotRenderId === requestId) {
            remoteReleaseHost.removeAttribute('aria-busy');
            publicShellDriftHost.removeAttribute('aria-busy');
            if (releaseControlCenterHost instanceof HTMLElement) {
                releaseControlCenterHost.removeAttribute('aria-busy');
            }
            releaseEvidenceHost.removeAttribute('aria-busy');
            if (rolloutGovernorHost instanceof HTMLElement) {
                rolloutGovernorHost.removeAttribute('aria-busy');
            }
            if (
                executivePortfolioStudioHost instanceof HTMLElement &&
                !freezeExecutivePortfolioStudio
            ) {
                executivePortfolioStudioHost.removeAttribute('aria-busy');
            }
            if (
                strategyDigitalTwinStudioHost instanceof HTMLElement &&
                !freezeStrategyDigitalTwinStudio
            ) {
                strategyDigitalTwinStudioHost.removeAttribute('aria-busy');
            }
            if (
                multiClinicControlTowerHost instanceof HTMLElement &&
                !freezeMultiClinicControlTower
            ) {
                multiClinicControlTowerHost.removeAttribute('aria-busy');
            }
            if (missionControlHost instanceof HTMLElement) {
                missionControlHost.removeAttribute('aria-busy');
            }
        }
    }

    if (!snapshot || root.dataset.turneroQueueOpsPilotRenderId !== requestId) {
        return;
    }

    if (releaseControlCenterHost instanceof HTMLElement) {
        try {
            releaseControlCenterSection = mountTurneroReleaseControlCenterCard(
                releaseControlCenterHost,
                snapshot
            );
        } catch (_error) {
            releaseControlCenterHost.innerHTML = '';
        }
    }

    try {
        mountTurneroReleaseEvidenceBundleCard(
            releaseEvidenceHost,
            snapshot,
            bundleOptions
        );
    } catch (_error) {
        releaseEvidenceHost.innerHTML = renderTurneroReleaseEvidenceBundleCard(
            snapshot,
            bundleOptions
        );
    }

    if (rolloutGovernorHost instanceof HTMLElement) {
        const rolloutClinicProfile =
            pilot.clinicProfile ||
            pilot.turneroClinicProfile ||
            snapshot.turneroClinicProfile ||
            null;
        try {
            mountTurneroReleaseRolloutCommandCenterCard(rolloutGovernorHost, {
                snapshot,
                clinicId: pilot.clinicId,
                clinicLabel:
                    pilot.clinicName ||
                    pilot.brandName ||
                    pilot.clinicProfile?.branding?.name ||
                    pilot.clinicId,
            });
        } catch (_error) {
            rolloutGovernorHost.innerHTML = '';
        }

        try {
            const rolloutConsoleHost = document.createElement('div');
            rolloutConsoleHost.className =
                'queue-ops-pilot__rollout-surface-console-host';
            rolloutGovernorHost.appendChild(rolloutConsoleHost);
            mountTurneroAdminQueueSurfaceRolloutConsole(rolloutConsoleHost, {
                clinicProfile: rolloutClinicProfile,
                scope: 'regional',
                snapshots: [
                    { surfaceKey: 'operator' },
                    { surfaceKey: 'kiosk' },
                    { surfaceKey: 'sala_tv' },
                ],
                surfaceRegistry: buildTurneroRolloutSurfaceRegistry(),
                releaseManifest: resolveTurneroRolloutManifest(manifest),
            });
        } catch (_error) {
            const rolloutConsoleHost = rolloutGovernorHost.querySelector(
                '.queue-ops-pilot__rollout-surface-console-host'
            );
            if (rolloutConsoleHost instanceof HTMLElement) {
                rolloutConsoleHost.remove();
            }
        }
    }

    const releaseControlCenterModel =
        releaseControlCenterSection?.__turneroReleaseControlCenterModel ||
        releaseControlCenterHost.querySelector?.('#queueReleaseControlCenter')
            ?.__turneroReleaseControlCenterModel ||
        null;
    rolloutGovernorModel =
        rolloutGovernorHost.__turneroReleaseRolloutCommandCenterModel || null;

    if (
        executivePortfolioStudioHost instanceof HTMLElement &&
        !freezeExecutivePortfolioStudio
    ) {
        try {
            mountTurneroReleaseExecutivePortfolioStudio(
                executivePortfolioStudioHost,
                {
                    controlCenterModel: releaseControlCenterModel,
                    releaseControlCenterModel,
                    governancePack: rolloutGovernorModel,
                    rolloutGovernorModel,
                    releaseIncidents:
                        releaseControlCenterModel?.incidents || [],
                    clinicProfile:
                        pilot.clinicProfile ||
                        pilot.turneroClinicProfile ||
                        releaseControlCenterModel?.turneroClinicProfile ||
                        snapshot.turneroClinicProfile,
                    regionalClinics:
                        pilot.regionalClinics ||
                        pilot.turneroRegionalClinics ||
                        manifest.regionalClinics ||
                        manifest.turneroRegionalClinics ||
                        releaseControlCenterModel?.turneroClinicProfile
                            ?.regionalClinics ||
                        [],
                    region:
                        pilot.region ||
                        pilot.clinicProfile?.region ||
                        manifest.region ||
                        releaseControlCenterModel?.turneroClinicProfile
                            ?.region ||
                        'regional',
                    runwayBudget:
                        rolloutGovernorModel?.riskBudget?.remainingBudget ||
                        rolloutGovernorModel?.riskBudget?.budgetMax ||
                        snapshot?.runwayBudget,
                    riskGrade: rolloutGovernorModel?.scorecard?.grade || 'B',
                    complianceStatus:
                        releaseControlCenterModel?.decision === 'hold'
                            ? 'red'
                            : releaseControlCenterModel?.decision === 'review'
                              ? 'amber'
                              : 'green',
                }
            );
        } catch (_error) {
            executivePortfolioStudioHost.innerHTML = '';
        }
    }

    const strategyDigitalTwinStudioContext =
        resolveStrategyDigitalTwinStudioClinics(
            pilot,
            manifest,
            releaseControlCenterModel,
            snapshot
        );

    if (
        strategyDigitalTwinStudioHost instanceof HTMLElement &&
        !freezeStrategyDigitalTwinStudio
    ) {
        try {
            strategyDigitalTwinStudioHost.innerHTML = '';
            mountTurneroReleaseStrategyDigitalTwinStudio(
                strategyDigitalTwinStudioHost,
                {
                    ...strategyDigitalTwinStudioContext,
                    clinicProfile:
                        strategyDigitalTwinStudioContext.clinicProfile ||
                        pilot.clinicProfile ||
                        pilot.turneroClinicProfile ||
                        releaseControlCenterModel?.turneroClinicProfile ||
                        snapshot.turneroClinicProfile,
                    turneroClinicProfile:
                        pilot.turneroClinicProfile ||
                        releaseControlCenterModel?.turneroClinicProfile ||
                        snapshot.turneroClinicProfile,
                    turneroRegionalClinics:
                        pilot.turneroRegionalClinics ||
                        manifest.turneroRegionalClinics ||
                        releaseControlCenterModel?.turneroClinicProfile
                            ?.regionalClinics,
                }
            );
        } catch (_error) {
            strategyDigitalTwinStudioHost.innerHTML = '';
        }
    }

    if (
        multiClinicControlTowerHost instanceof HTMLElement &&
        !freezeMultiClinicControlTower
    ) {
        try {
            mountMultiClinicControlTowerCard(multiClinicControlTowerHost, {
                snapshot,
                clinicId: pilot.clinicId,
                clinicLabel:
                    pilot.clinicName ||
                    pilot.brandName ||
                    pilot.clinicProfile?.branding?.name ||
                    pilot.clinicId,
                clinicProfile:
                    pilot.clinicProfile || pilot.turneroClinicProfile,
                clinicProfiles:
                    pilot.clinicProfiles ||
                    pilot.turneroClinicProfiles ||
                    manifest.clinicProfiles ||
                    manifest.turneroClinicProfiles,
                storage: options.storage,
            });
        } catch (_error) {
            multiClinicControlTowerHost.innerHTML = '';
        }
    }

    if (boardOpsHubHost instanceof HTMLElement) {
        try {
            mountTurneroReleaseBoardOpsHub(boardOpsHubHost, {
                ...buildBoardOpsHubPayload(
                    pilot,
                    manifest,
                    releaseControlCenterModel
                ),
                snapshot,
                storage: options.storage,
            });
        } catch (_error) {
            boardOpsHubHost.innerHTML = '';
        }
    }

    if (releaseOpsConsoleHost instanceof HTMLElement) {
        try {
            const clinicProfile =
                pilot.clinicProfile || pilot.turneroClinicProfile || {};
            const surfaceOpsTelemetryMap = {
                operator: getSurfaceTelemetryState('operator'),
                kiosk: getSurfaceTelemetryState('kiosk'),
                display: getSurfaceTelemetryState('display'),
            };
            const surfaceOpsRegistry = ['operator', 'kiosk', 'display'].reduce(
                (accumulator, surfaceKey) => {
                    const registrySurfaceId =
                        resolveInstallHubSurfaceIdByTelemetryKey(surfaceKey) ||
                        surfaceKey;
                    const definition =
                        getInstallHubSurfaceDefinition(registrySurfaceId) || {};
                    const telemetryCopy =
                        getInstallHubSurfaceTelemetryCopy(surfaceKey) || {};

                    accumulator[surfaceKey] = {
                        id: definition.id || registrySurfaceId || surfaceKey,
                        label:
                            telemetryCopy.title ||
                            definition.cardCopy?.title ||
                            surfaceKey,
                        title:
                            telemetryCopy.title ||
                            definition.cardCopy?.title ||
                            surfaceKey,
                        notes: Array.isArray(definition.cardCopy?.notes)
                            ? definition.cardCopy.notes
                            : [],
                        guideUrl: definition.guideUrl || '',
                        emptySummary: telemetryCopy.emptySummary || '',
                    };
                    return accumulator;
                },
                {}
            );
            const releaseOpsLegacyHost = document.createElement('div');
            const surfaceOpsConsoleHost = document.createElement('div');
            releaseOpsConsoleHost.replaceChildren(
                releaseOpsLegacyHost,
                surfaceOpsConsoleHost
            );

            mountTurneroReleaseOpsConsoleCard(releaseOpsLegacyHost, {
                snapshot,
                clinicProfile:
                    pilot.clinicProfile || pilot.turneroClinicProfile,
                refreshPilotReadiness: () => snapshot.pilotReadiness || pilot,
                refreshRemoteRelease: () =>
                    loadTurneroRemoteReleaseHealth({
                        clinicId: pilot.clinicId,
                        profileFingerprint: pilot.profileFingerprint,
                    }),
                refreshPublicShellDrift: () =>
                    loadTurneroPublicShellHtml(publicShellOptions),
                publicShellOptions,
            });
            mountTurneroAdminQueueSurfaceOpsConsole(surfaceOpsConsoleHost, {
                clinicProfile,
                telemetryMap: surfaceOpsTelemetryMap,
                surfaceRegistry: surfaceOpsRegistry,
                releaseManifest: {},
                now: () => Date.now(),
            });
            if (surfaceAcceptanceConsoleHost instanceof HTMLElement) {
                mountTurneroAdminQueueSurfaceAcceptanceConsole(
                    surfaceAcceptanceConsoleHost,
                    {
                        clinicProfile,
                        scope:
                            pilot.region ||
                            clinicProfile.region ||
                            clinicProfile.clinic_id ||
                            'global',
                        telemetryMap: surfaceOpsTelemetryMap,
                        surfaceRegistry: surfaceOpsRegistry,
                        releaseManifest: {},
                        now: () => Date.now(),
                    }
                );
            }
        } catch (_error) {
            releaseOpsConsoleHost.innerHTML = '';
            if (surfaceAcceptanceConsoleHost instanceof HTMLElement) {
                surfaceAcceptanceConsoleHost.innerHTML = '';
            }
        }
    }

    if (incidentWorkbenchHost instanceof HTMLElement) {
        try {
            mountQueueIncidentExecutionWorkbenchCard(incidentWorkbenchHost, {
                pilot,
                manifest,
                snapshot,
            });
        } catch (_error) {
            incidentWorkbenchHost.innerHTML = '';
        }
    }

    const releaseWarRoomSnapshot = renderQueueOpsPilotReleaseWarRoom(
        root,
        pilot,
        manifest,
        requestId,
        {
            remoteReleaseReadiness: remoteReadinessModel,
            publicShellDrift: publicShellDriftModel,
            releaseEvidenceBundle:
                releaseEvidenceBundleModel ||
                createTurneroReleaseEvidenceBundleModel(
                    snapshot,
                    bundleOptions
                ),
        }
    );

    if (missionControlHost instanceof HTMLElement) {
        try {
            mountTurneroReleaseMissionControlCard(missionControlHost, {
                snapshot,
                releaseWarRoomSnapshot:
                    releaseWarRoomSnapshot ||
                    options.releaseWarRoomSnapshot ||
                    null,
                storage: options.storage,
                clinicId: pilot.clinicId,
                clinicProfile:
                    pilot.clinicProfile || pilot.turneroClinicProfile,
            });
        } catch (_error) {
            missionControlHost.innerHTML = '';
        }
    }

    renderQueueOpsPilotAutomationMesh(root, pilot, manifest, requestId, {
        snapshot,
        remoteReadiness: remoteReadinessModel,
        publicShellDrift: publicShellDriftModel,
        releaseEvidenceBundle:
            releaseEvidenceBundleModel ||
            createTurneroReleaseEvidenceBundleModel(snapshot, bundleOptions),
        releaseWarRoomSnapshot:
            releaseWarRoomSnapshot || options.releaseWarRoomSnapshot || null,
        incidentJournalEntries:
            releaseWarRoomSnapshot?.journalEntries ||
            options.releaseWarRoomSnapshot?.journalEntries ||
            snapshot?.journalEntries ||
            [],
    });
}

export function renderQueueOpsPilotView(manifest, detectedPlatform, deps = {}) {
    const { buildQueueOpsPilot, setHtml, escapeHtml } = deps;
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    const renderRequestId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
    root.dataset.turneroQueueOpsPilotRenderId = renderRequestId;
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            pilot.summary
                        )}</p>
                        <p class="queue-ops-pilot__support">${escapeHtml(
                            pilot.supportCopy
                        )}</p>
                        ${renderPilotRolloutStations(pilot, escapeHtml)}
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.primaryAction,
                                'primary',
                                {
                                    escapeHtml,
                                }
                            )}
                            ${renderQueueOpsPilotActionMarkup(
                                pilot.secondaryAction,
                                'secondary',
                                { escapeHtml }
                            )}
                        </div>
                        <section
                            id="queueOpsPilotReadiness"
                            class="queue-ops-pilot__readiness"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__readiness-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Readiness</p>
                                    <h6 id="queueOpsPilotReadinessTitle">${escapeHtml(
                                        pilot.readinessTitle
                                    )}</h6>
                                </div>
                                <span
                                    id="queueOpsPilotReadinessStatus"
                                    class="queue-ops-pilot__readiness-status"
                                    data-state="${escapeHtml(pilot.readinessState)}"
                                >
                                    ${escapeHtml(
                                        pilot.readinessBlockingCount > 0
                                            ? `${pilot.readinessBlockingCount} bloqueo(s)`
                                            : 'Listo'
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotReadinessSummary" class="queue-ops-pilot__readiness-summary">${escapeHtml(
                                pilot.readinessSummary
                            )}</p>
                            <div id="queueOpsPilotReadinessItems" class="queue-ops-pilot__readiness-items" role="list" aria-label="Checklist de readiness de Turnero V2">
                                ${pilot.readinessItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotReadinessItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__readiness-item"
                                                data-state="${escapeHtml(
                                                    item.ready
                                                        ? 'ready'
                                                        : item.blocker
                                                          ? 'alert'
                                                          : 'warning'
                                                )}"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <span class="queue-ops-pilot__readiness-item-badge">${escapeHtml(
                                                    item.ready
                                                        ? 'Listo'
                                                        : item.blocker
                                                          ? 'Bloquea'
                                                          : 'Pendiente'
                                                )}</span>
                                                <p>${escapeHtml(
                                                    item.detail
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotReadinessSupport" class="queue-ops-pilot__readiness-support">${escapeHtml(
                                pilot.readinessSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotIssues"
                            class="queue-ops-pilot__issues"
                            data-state="${escapeHtml(pilot.goLiveIssueState)}"
                        >
                            <div class="queue-ops-pilot__issues-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Go-live</p>
                                    <h6 id="queueOpsPilotIssuesTitle">Bloqueos de salida</h6>
                                </div>
                                <span
                                    id="queueOpsPilotIssuesStatus"
                                    class="queue-ops-pilot__issues-status"
                                    data-state="${escapeHtml(pilot.goLiveIssueState)}"
                                >
                                    ${escapeHtml(
                                        pilot.goLiveIssues.length === 0
                                            ? 'Sin bloqueos'
                                            : pilot.goLiveBlockingCount > 0
                                              ? `${pilot.goLiveBlockingCount} bloqueo(s)`
                                              : `${pilot.goLiveIssues.length} pendiente(s)`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotIssuesSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                                pilot.goLiveSummary
                            )}</p>
                            <div id="queueOpsPilotIssuesItems" class="queue-ops-pilot__issues-items" role="list" aria-label="Bloqueos accionables de Turnero V2">
                                ${
                                    pilot.goLiveIssues.length > 0
                                        ? pilot.goLiveIssues
                                              .map(
                                                  (item) => `
                                                    <article
                                                        id="queueOpsPilotIssuesItem_${escapeHtml(
                                                            item.id
                                                        )}"
                                                        class="queue-ops-pilot__issues-item"
                                                        data-state="${escapeHtml(item.state)}"
                                                        role="listitem"
                                                    >
                                                        <div class="queue-ops-pilot__issues-item-head">
                                                            <strong>${escapeHtml(
                                                                item.label
                                                            )}</strong>
                                                            <span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
                                                                item.state ===
                                                                    'alert'
                                                                    ? 'Bloquea'
                                                                    : item.state ===
                                                                        'ready'
                                                                      ? 'Listo'
                                                                      : 'Pendiente'
                                                            )}</span>
                                                        </div>
                                                        <p>${escapeHtml(
                                                            item.detail
                                                        )}</p>
                                                        ${
                                                            item.href
                                                                ? `
                                                                    <a
                                                                        id="queueOpsPilotIssuesAction_${escapeHtml(
                                                                            item.id
                                                                        )}"
                                                                        href="${escapeHtml(
                                                                            item.href
                                                                        )}"
                                                                        class="queue-ops-pilot__issues-link"
                                                                        target="_blank"
                                                                        rel="noopener"
                                                                    >
                                                                        ${escapeHtml(
                                                                            item.actionLabel ||
                                                                                'Abrir'
                                                                        )}
                                                                    </a>
                                                                `
                                                                : ''
                                                        }
                                                    </article>
                                                `
                                              )
                                              .join('')
                                        : `
                                            <article
                                                id="queueOpsPilotIssuesItem_ready"
                                                class="queue-ops-pilot__issues-item"
                                                data-state="ready"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__issues-item-head">
                                                    <strong>Sin bloqueos activos</strong>
                                                    <span class="queue-ops-pilot__issues-item-badge">Listo</span>
                                                </div>
                                                <p>Turnero V2 ya no tiene bloqueos de salida por perfil, canon, publicación, PIN o smoke.</p>
                                            </article>
                                        `
                                }
                            </div>
                            <p id="queueOpsPilotIssuesSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                                pilot.goLiveSupport
                            )}</p>
                        </section>
                        <div
                            id="queuePublicShellDriftCard"
                            data-turnero-public-shell-drift
                        ></div>
                        <div
                            id="queueReleaseControlCenterHost"
                            aria-live="polite"
                        ></div>
                        <section id="queueOpsPilotCanon" class="queue-ops-pilot__canon">
                            <div class="queue-ops-pilot__canon-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Fallback web</p>
                                    <h6 id="queueOpsPilotCanonTitle">Rutas por clínica</h6>
                                </div>
                                <span id="queueOpsPilotCanonStatus" class="queue-ops-pilot__canon-status">
                                    ${escapeHtml(
                                        `${pilot.canonicalSurfaces.filter((item) => item.ready).length}/${pilot.canonicalSurfaces.length} activas`
                                    )}
                                </span>
                            </div>
                            <div id="queueOpsPilotCanonItems" class="queue-ops-pilot__canon-items" role="list" aria-label="Superficies web canonicas de Turnero V2">
                                ${pilot.canonicalSurfaces
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotCanonItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__canon-item"
                                                data-state="${escapeHtml(
                                                    item.state ||
                                                        (item.ready
                                                            ? 'ready'
                                                            : 'warning')
                                                )}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__canon-item-head">
                                                    <strong>${escapeHtml(
                                                        item.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__canon-item-badge">${escapeHtml(
                                                        item.badge ||
                                                            (item.ready
                                                                ? 'Declarada'
                                                                : 'Pendiente')
                                                    )}</span>
                                                </div>
                                                <code>${escapeHtml(
                                                    item.route
                                                )}</code>
                                                <p>${escapeHtml(
                                                    item.detail ||
                                                        item.url ||
                                                        'Ruta local de Turnero V2'
                                                )}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotCanonSupport" class="queue-ops-pilot__canon-support">${escapeHtml(
                                pilot.canonicalSupport || ''
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotSmoke"
                            class="queue-ops-pilot__smoke"
                            data-state="${escapeHtml(pilot.smokeState)}"
                        >
                            <div class="queue-ops-pilot__smoke-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Smoke por clínica</p>
                                    <h6 id="queueOpsPilotSmokeTitle">Secuencia repetible</h6>
                                </div>
                                <span
                                    id="queueOpsPilotSmokeStatus"
                                    class="queue-ops-pilot__smoke-status"
                                    data-state="${escapeHtml(pilot.smokeState)}"
                                >
                                    ${escapeHtml(
                                        `${pilot.smokeReadyCount}/${pilot.smokeSteps.length} listos`
                                    )}
                                </span>
                            </div>
                            <p id="queueOpsPilotSmokeSummary" class="queue-ops-pilot__smoke-summary">${escapeHtml(
                                pilot.smokeSummary
                            )}</p>
                            <div id="queueOpsPilotSmokeItems" class="queue-ops-pilot__smoke-items" role="list" aria-label="Secuencia de smoke de Turnero V2">
                                ${pilot.smokeSteps
                                    .map(
                                        (step) => `
                                            <article
                                                id="queueOpsPilotSmokeItem_${escapeHtml(
                                                    step.id
                                                )}"
                                                class="queue-ops-pilot__smoke-item"
                                                data-state="${escapeHtml(step.state)}"
                                                role="listitem"
                                            >
                                                <div class="queue-ops-pilot__smoke-item-head">
                                                    <strong>${escapeHtml(
                                                        step.label
                                                    )}</strong>
                                                    <span class="queue-ops-pilot__smoke-item-badge">${escapeHtml(
                                                        step.ready
                                                            ? 'Listo'
                                                            : step.state ===
                                                                'alert'
                                                              ? 'Bloquea'
                                                              : 'Pendiente'
                                                    )}</span>
                                                </div>
                                                <p>${escapeHtml(step.detail)}</p>
                                                ${
                                                    step.href
                                                        ? `
                                                            <a
                                                                id="queueOpsPilotSmokeAction_${escapeHtml(
                                                                    step.id
                                                                )}"
                                                                href="${escapeHtml(step.href)}"
                                                                class="queue-ops-pilot__smoke-link"
                                                                target="_blank"
                                                                rel="noopener"
                                                            >
                                                                ${escapeHtml(
                                                                    step.actionLabel ||
                                                                        'Abrir'
                                                                )}
                                                            </a>
                                                        `
                                                        : ''
                                                }
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotSmokeSupport" class="queue-ops-pilot__smoke-support">${escapeHtml(
                                pilot.smokeSupport
                            )}</p>
                        </section>
                        <section
                            id="queueOpsPilotHandoff"
                            class="queue-ops-pilot__handoff"
                            data-state="${escapeHtml(pilot.readinessState)}"
                        >
                            <div class="queue-ops-pilot__handoff-head">
                                <div>
                                    <p class="queue-app-card__eyebrow">Handoff por clínica</p>
                                    <h6 id="queueOpsPilotHandoffTitle">Paquete de apertura</h6>
                                </div>
                                <button
                                    id="queueOpsPilotHandoffCopyBtn"
                                    type="button"
                                    class="queue-ops-pilot__handoff-copy"
                                >
                                    Copiar paquete
                                </button>
                            </div>
                            <p id="queueOpsPilotHandoffSummary" class="queue-ops-pilot__handoff-summary">${escapeHtml(
                                pilot.handoffSummary
                            )}</p>
                            <div id="queueOpsPilotHandoffItems" class="queue-ops-pilot__handoff-items" role="list" aria-label="Paquete de Turnero V2 por clínica">
                                ${pilot.handoffItems
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueOpsPilotHandoffItem_${escapeHtml(
                                                    item.id
                                                )}"
                                                class="queue-ops-pilot__handoff-item"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    item.label
                                                )}</strong>
                                                <p>${escapeHtml(item.value)}</p>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                            <p id="queueOpsPilotHandoffSupport" class="queue-ops-pilot__handoff-support">${escapeHtml(
                                pilot.handoffSupport
                            )}</p>
                        </section>
                        <div
                            id="queueOpsPilotRemoteReleaseHost"
                            class="queue-ops-pilot__remote-release-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueOpsPilotReleaseEvidenceHost"
                            class="queue-ops-pilot__release-evidence-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueOpsPilotRolloutGovernorHost"
                            class="queue-ops-pilot__rollout-governor-host"
                            aria-live="polite"
                        ></div>
                        <div
                        id="queueOpsPilotExecutivePortfolioStudioHost"
                            class="queue-ops-pilot__executive-portfolio-studio-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueOpsPilotStrategyDigitalTwinStudioHost"
                            class="queue-ops-pilot__strategy-digital-twin-studio-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueMultiClinicControlTowerHost"
                            class="queue-ops-pilot__multi-clinic-control-tower-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueReleaseBoardOpsHubHost"
                            class="queue-ops-pilot__board-ops-hub-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueReleaseOpsConsoleHost"
                            class="queue-ops-pilot__release-ops-console-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueSurfaceAcceptanceConsoleHost"
                            class="queue-ops-pilot__surface-acceptance-console-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueReleaseMissionControlHost"
                            class="queue-ops-pilot__release-mission-control-host"
                            aria-live="polite"
                        ></div>
                        <div
                            id="queueIncidentExecutionWorkbenchHost"
                            class="queue-ops-pilot__incident-workbench-host"
                            aria-live="polite"
                        ></div>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
                <div
                    id="queueOpsPilotReleaseWarRoomHost"
                    class="queue-ops-pilot__release-war-room-host"
                    aria-live="polite"
                ></div>
                <div
                    id="queueOpsPilotAutomationMeshHost"
                    class="queue-ops-pilot__automation-mesh-host"
                    aria-live="polite"
                ></div>
            </section>
        `
    );

    const releaseWarRoomSnapshot = renderQueueOpsPilotReleaseWarRoom(
        root,
        pilot,
        manifest,
        renderRequestId
    );

    void hydrateQueueOpsPilotReleaseEvidence(
        root,
        pilot,
        manifest,
        renderRequestId,
        {
            releaseWarRoomSnapshot,
        }
    );

    bindQueueOpsPilotActions(manifest, detectedPlatform, deps);
}
