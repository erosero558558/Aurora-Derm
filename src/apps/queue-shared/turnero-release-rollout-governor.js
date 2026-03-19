import { buildTurneroReleaseEvidencePack } from './turnero-release-evidence-pack-factory.js';
import { compareSnapshotAgainstBaseline } from './turnero-release-baseline-compare.js';
import {
    createReleaseHistoryStore,
    normalizeReleaseSnapshot,
} from './turnero-release-history-store.js';
import { buildTurneroReleaseOwnershipBoard } from './turnero-release-ownership-board.js';
import { buildReleaseApprovalQueuePack } from './turnero-release-approval-queue.js';
import { buildReleaseCanaryRegistryPack } from './turnero-release-canary-registry.js';
import { computeReleaseRiskBudget } from './turnero-release-risk-budget.js';
import { computeReleaseSlaMonitor } from './turnero-release-sla-monitor.js';
import { buildReleasePromotionPipeline } from './turnero-release-promotion-pipeline.js';
import {
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

function nowIso() {
    return new Date().toISOString();
}

function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return min;
    }

    return Math.max(min, Math.min(max, parsed));
}

function safeFilePart(value, fallback = 'turnero-release-rollout-governor') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function toIsoDatePart(value) {
    const parsed = value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString().slice(0, 10).replaceAll('-', '');
    }

    return parsed.toISOString().slice(0, 10).replaceAll('-', '');
}

function snapshotScore(snapshot = {}) {
    const normalized = normalizeReleaseSnapshot(snapshot || {});
    const score = Number(normalized.meta?.score || normalized.score || NaN);
    if (Number.isFinite(score)) {
        return clamp(score, 0, 100);
    }

    const alertCount = Number(normalized.alertCount || 0);
    const warningCount = Number(normalized.warningCount || 0);
    const incidentCount = Number(normalized.incidentCount || 0);
    const surfaceCount = Number(normalized.surfaceCount || 0);

    return clamp(
        100 -
            alertCount * 25 -
            warningCount * 8 -
            incidentCount * 2 -
            Math.max(0, 4 - surfaceCount) * 6,
        0,
        100
    );
}

function compareSnapshotsAscending(left, right) {
    const leftTime = new Date(left.savedAt || left.generatedAt || 0).getTime();
    const rightTime = new Date(
        right.savedAt || right.generatedAt || 0
    ).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
        return 0;
    }
    if (Number.isNaN(leftTime)) {
        return -1;
    }
    if (Number.isNaN(rightTime)) {
        return 1;
    }

    return leftTime - rightTime;
}

function resolveSnapshotReference(store, clinicId, value, fallback = null) {
    if (!value) {
        return fallback;
    }

    if (typeof value === 'string') {
        return store.find(clinicId, value) || fallback;
    }

    return normalizeReleaseSnapshot(value);
}

function buildScorecard({
    currentSnapshot,
    baselineCompare,
    ownerBoard,
    approvals,
    canary,
    sla,
}) {
    const current = normalizeReleaseSnapshot(currentSnapshot || {});
    const alertCount = Number(current.alertCount || 0);
    const warningCount = Number(current.warningCount || 0);
    const ownerBlockedCount = toArray(ownerBoard?.lanes).filter((lane) => {
        const summary = lane?.summary || {};
        return (
            Number(summary.blocker || 0) > 0 ||
            String(lane?.status || '').toLowerCase() === 'blocked'
        );
    }).length;
    const approvalBlockingCount = Number(approvals?.blockingCount || 0);
    const canaryState = toText(canary?.active?.state || 'draft').toLowerCase();
    const canaryPenalty =
        canaryState === 'live'
            ? 0
            : canaryState === 'armed'
              ? 4
              : canaryState === 'hold'
                ? 10
                : canaryState === 'rolled_back'
                  ? 18
                  : 8;
    const slaPenalty =
        sla?.slaStatus === 'healthy' ? 0 : sla?.slaStatus === 'watch' ? 6 : 12;
    const baselinePenalty = baselineCompare?.ok === false ? 8 : 0;
    const score = clamp(
        100 -
            alertCount * 24 -
            warningCount * 8 -
            ownerBlockedCount * 6 -
            approvalBlockingCount * 5 -
            canaryPenalty -
            slaPenalty -
            baselinePenalty,
        0,
        100
    );
    const grade =
        score >= 90
            ? 'A'
            : score >= 80
              ? 'B'
              : score >= 70
                ? 'C'
                : score >= 50
                  ? 'D'
                  : 'F';

    return {
        score,
        grade,
        alertCount,
        warningCount,
        ownerBlockedCount,
        approvalBlockingCount,
        canaryState,
        baselinePenalty,
        summary: `Scorecard ${Math.round(score)}/100 · grade ${grade} · alerts ${alertCount} · warnings ${warningCount}`,
    };
}

function buildTrend({
    historySnapshots,
    currentSnapshot,
    baselineCompare,
    scorecard,
}) {
    const ordered = toArray(historySnapshots).sort(compareSnapshotsAscending);
    const recent = ordered.slice(-5);
    const recentScores = recent.map((snapshot) => snapshotScore(snapshot));
    const currentScore = snapshotScore(currentSnapshot);
    const previousScore =
        recentScores.length > 1
            ? recentScores[recentScores.length - 2]
            : recentScores[0] || currentScore;
    const delta = currentScore - previousScore;
    const direction =
        delta > 5 ? 'improving' : delta < -5 ? 'regressing' : 'stable';
    const baselineChangeCount = Number(
        baselineCompare?.diff?.totalChanges ||
            baselineCompare?.diff?.changes?.length ||
            0
    );

    return {
        direction,
        delta,
        currentScore,
        previousScore,
        baselineChangeCount,
        windowSize: recent.length,
        recentScores,
        summary: `Trend ${direction} · delta ${delta >= 0 ? '+' : ''}${Math.round(
            delta
        )} · baseline changes ${baselineChangeCount} · score ${Math.round(
            scorecard?.score || currentScore
        )}/100`,
    };
}

function buildRadar({ evidencePack, baselineCompare, ownerBoard }) {
    const controlCenterModel =
        evidencePack?.globalPack?.controlCenterModel ||
        evidencePack?.controlCenterModel ||
        {};
    const incidents = toArray(controlCenterModel.incidents).map(
        (incident, index) => ({
            id: incident?.code || incident?.id || `incident-${index + 1}`,
            kind: 'incident',
            owner: toText(incident?.owner || 'ops'),
            label: toText(
                incident?.title || incident?.code || `Incidente ${index + 1}`
            ),
            detail: toText(incident?.detail || ''),
            severity: normalizeSeverity(
                incident?.state || incident?.severity || 'info'
            ),
            source: 'control-center',
        })
    );
    const blockedOwners = toArray(ownerBoard?.lanes)
        .filter((lane) => {
            const summary = lane?.summary || {};
            return (
                Number(summary.blocker || 0) > 0 ||
                String(lane?.status || '').toLowerCase() === 'blocked'
            );
        })
        .map((lane, index) => ({
            id: lane?.owner || `owner-${index + 1}`,
            kind: 'owner',
            owner: toText(lane?.owner || 'ops'),
            label: toText(lane?.label || lane?.owner || `Owner ${index + 1}`),
            detail: toText(
                `blocker=${Number(lane?.summary?.blocker || 0)}, warning=${Number(
                    lane?.summary?.warning || 0
                )}`
            ),
            severity: 'warning',
            source: 'owner-board',
        }));
    const baselineChanges = toArray(baselineCompare?.topDeltas).map(
        (change, index) => ({
            id: change?.key || `baseline-${index + 1}`,
            kind: change?.kind || 'baseline',
            owner: toText(change?.owner || 'ops'),
            label: toText(
                change?.label || change?.summary || `Cambio ${index + 1}`
            ),
            detail: toText(change?.summary || ''),
            severity: normalizeSeverity(change?.severity || 'warning'),
            source: 'baseline-compare',
        })
    );
    const regressions = [...incidents, ...blockedOwners, ...baselineChanges];

    return {
        regressions,
        topIssues: regressions.slice(0, 8),
        summary: regressions.length
            ? `Radar con ${regressions.length} señal(es) de regresión`
            : 'Radar limpio, sin regresiones visibles.',
    };
}

function buildApprovalHandoff(governor) {
    const pending = toArray(governor?.approvals?.pending);
    const lines = pending.length
        ? pending.map(
              (item) =>
                  `- [${toText(item.severity || 'medium')}] ${toText(
                      item.suggestedApprover || 'ops'
                  )}: ${toText(item.reason || '')}`
          )
        : ['- No hay aprobaciones pendientes.'];

    return {
        pendingCount: pending.length,
        text: ['# Approval handoff', '', ...lines].join('\n'),
        summary: pending.length
            ? `${pending.length} aprobación(es) pendientes`
            : 'Sin aprobaciones pendientes',
    };
}

function buildCanaryPlan(governor) {
    const decision = toText(governor?.pipeline?.decision || 'review', 'review');
    const steps = [];

    if (decision === 'promote') {
        steps.push('Armar campaña canary con baseline activo.');
        steps.push('Iniciar canary y observar health, approvals y SLO.');
        steps.push('Promover solo si no aparecen regresiones nuevas.');
    } else if (decision === 'review') {
        steps.push('Cerrar aprobaciones pendientes.');
        steps.push('Repetir snapshot y reevaluar score/risk budget.');
        steps.push('Solo escalar a canary live si SLA queda estable.');
    } else if (decision === 'rollback') {
        steps.push('Congelar campaña actual.');
        steps.push('Comparar contra baseline activo.');
        steps.push('Preparar rollback y handoff por owner.');
    } else {
        steps.push('No promover.');
        steps.push('Resolver bloqueos críticos antes de crear un canary.');
        steps.push('Reintentar cuando la evidencia vuelva a verde.');
    }

    return {
        decision,
        steps,
        text: ['# Canary plan', '', ...steps.map((step) => `- ${step}`)].join(
            '\n'
        ),
        summary: `Plan canary ${decision}: ${steps.join(' ')}`,
    };
}

export function buildReleaseRolloutGovernor(context = {}) {
    const historyStore = createReleaseHistoryStore({
        namespace: context.historyNamespace,
        storage: context.storage,
    });
    const historyPack = context.historyPack
        ? context.historyPack
        : historyStore.exportClinic(
              context.clinicId || context.snapshot?.clinicId
          );
    const historySnapshots = toArray(
        context.history ||
            historyPack.snapshots ||
            historyStore.list(context.clinicId)
    )
        .map((snapshot) => normalizeReleaseSnapshot(snapshot || {}))
        .sort(compareSnapshotsAscending);
    const latestHistorySnapshot =
        historySnapshots.length > 0
            ? historySnapshots[historySnapshots.length - 1]
            : null;
    const currentSnapshot =
        resolveSnapshotReference(
            historyStore,
            context.clinicId,
            context.currentSnapshot ||
                context.snapshot ||
                latestHistorySnapshot,
            latestHistorySnapshot || null
        ) || normalizeReleaseSnapshot(context.snapshot || {});
    const baselineSnapshot =
        resolveSnapshotReference(
            historyStore,
            context.clinicId,
            context.baseline ||
                context.baselineSnapshot ||
                historyPack.baselineSnapshotId,
            historySnapshots[0] || null
        ) || null;
    const baselineCompare =
        currentSnapshot && baselineSnapshot
            ? compareSnapshotAgainstBaseline(currentSnapshot, baselineSnapshot)
            : {
                  ok: false,
                  reason: baselineSnapshot
                      ? 'current_missing'
                      : 'baseline_missing',
                  diff: null,
                  topDeltas: [],
                  ownerDeltaCounts: {},
                  severityDeltaCounts: {},
              };
    const evidencePack =
        context.evidencePack ||
        buildTurneroReleaseEvidencePack(
            {
                releaseControlCenterSnapshot: currentSnapshot,
                snapshot: currentSnapshot,
                releaseWarRoomSnapshot: context.releaseWarRoomSnapshot,
                ownerState: context.ownerState,
                recheckQueueSnapshot: context.recheckQueueSnapshot,
                releaseCommandDeckSnapshot: context.releaseCommandDeckSnapshot,
                ownerWorkbenchSnapshot: context.ownerWorkbenchSnapshot,
                incidentJournalEntries: context.incidentJournalEntries,
                incidentExecutorState: context.incidentExecutorState,
            },
            {
                clinicId:
                    context.clinicId ||
                    currentSnapshot.clinicId ||
                    historyPack.clinicId ||
                    'default',
                profileFingerprint:
                    context.profileFingerprint ||
                    currentSnapshot.profileFingerprint ||
                    '',
                releaseMode:
                    context.releaseMode ||
                    currentSnapshot.releaseMode ||
                    'suite_v2',
                baseUrl:
                    context.baseUrl ||
                    currentSnapshot.turneroClinicProfile?.branding?.base_url ||
                    currentSnapshot.turneroClinicProfile?.branding?.baseUrl ||
                    '',
                timestamp:
                    context.timestamp ||
                    currentSnapshot.generatedAt ||
                    nowIso(),
            }
        );
    const ownerBoard =
        context.ownerBoard ||
        evidencePack?.globalPack?.ownerBoard ||
        buildTurneroReleaseOwnershipBoard(currentSnapshot, {
            ownerState: context.ownerState || {},
        });
    const approvals =
        context.approvals ||
        buildReleaseApprovalQueuePack(
            context.clinicId || currentSnapshot.clinicId
        );
    const canary =
        context.canary ||
        buildReleaseCanaryRegistryPack(
            context.clinicId || currentSnapshot.clinicId
        );
    const trend = buildTrend({
        historySnapshots,
        currentSnapshot,
        baselineCompare,
        scorecard: context.scorecard || {},
    });
    const scorecard =
        context.scorecard ||
        buildScorecard({
            currentSnapshot,
            baselineCompare,
            ownerBoard,
            approvals,
            canary,
            sla: context.sla || {},
        });
    const radar =
        context.radar ||
        buildRadar({
            evidencePack,
            baselineCompare,
            ownerBoard,
        });
    const sla =
        context.sla ||
        computeReleaseSlaMonitor({
            history: historySnapshots,
            windowSize: context.windowSize || 5,
            currentSnapshot,
            baselineSnapshot,
        });
    const riskBudget =
        context.riskBudget ||
        computeReleaseRiskBudget({
            scorecard,
            radar,
            trend,
            approvals,
            canary,
            sla,
            ownerBoard,
        });
    const pipeline =
        context.pipeline ||
        buildReleasePromotionPipeline({
            scorecard,
            radar,
            ownerBoard,
            approvals,
            canary,
            sla,
            riskBudget,
            trend,
        });
    const approvalHandoff = buildApprovalHandoff({
        approvals,
        pipeline,
        riskBudget,
    });
    const canaryPlan = buildCanaryPlan({
        approvals,
        pipeline,
        riskBudget,
        canary,
    });
    const decision = pipeline.decision;
    const releaseMode =
        decision === 'promote'
            ? 'advance'
            : decision === 'review'
              ? 'guarded'
              : decision === 'rollback'
                ? 'recover'
                : 'hold';
    const clinicId = toText(
        context.clinicId ||
            currentSnapshot.clinicId ||
            historyPack.clinicId ||
            'default'
    );
    const clinicLabel = toText(
        context.clinicLabel ||
            context.clinicName ||
            currentSnapshot.clinicName ||
            currentSnapshot.clinicShortName ||
            clinicId,
        clinicId
    );
    const summary = [
        `Rollout governor · ${clinicLabel}`,
        `Decision: ${decision}`,
        `Score: ${Math.round(scorecard.score)}/100 (${scorecard.grade})`,
        riskBudget.summary,
        sla.summary,
        approvals.summary,
        canary.summary,
        pipeline.summary,
    ]
        .filter(Boolean)
        .join(' | ');
    const supportCopy =
        decision === 'promote'
            ? `Promoción vigilada para ${clinicLabel}.`
            : decision === 'review'
              ? 'Todavía quedan señales amarillas antes de promover.'
              : decision === 'rollback'
                ? 'La campaña debe volver a baseline antes de seguir.'
                : 'Hay bloqueos que impiden abrir la promoción.';
    const generatedAt = toText(context.generatedAt, nowIso());
    const snapshotFileName = `${safeFilePart(clinicLabel || clinicId)}-${toIsoDatePart(
        generatedAt
    )}.json`;
    const json = {
        clinicId,
        clinicLabel,
        generatedAt,
        decision,
        releaseMode,
        summary,
        supportCopy,
        scorecard,
        trend,
        radar,
        ownerBoard,
        approvals,
        canary,
        riskBudget,
        sla,
        pipeline,
        approvalHandoff,
        canaryPlan,
        currentSnapshot,
        baselineSnapshot,
        baselineCompare,
        historyPack,
        historySnapshots,
        evidencePack,
    };

    return {
        clinicId,
        clinicLabel,
        clinicName: clinicLabel,
        generatedAt,
        snapshotFileName,
        currentSnapshot,
        baselineSnapshot,
        baselineCompare,
        historyPack,
        historySnapshots,
        evidencePack,
        ownerBoard,
        approvals,
        canary,
        trend,
        scorecard,
        radar,
        sla,
        riskBudget,
        pipeline,
        approvalHandoff,
        canaryPlan,
        decision,
        releaseMode,
        summary,
        supportCopy,
        snapshot: json,
        exports: {
            executiveSummary: summary,
            approvalHandoff: approvalHandoff.text,
            canaryPlan: canaryPlan.summary,
            json,
        },
    };
}

export default buildReleaseRolloutGovernor;
