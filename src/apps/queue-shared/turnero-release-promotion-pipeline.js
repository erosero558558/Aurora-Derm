import {
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

function countBlocking(regressions = []) {
    return toArray(regressions).filter((entry) =>
        ['alert', 'critical', 'blocker', 'hold', 'red'].includes(
            normalizeSeverity(entry?.severity || entry?.state || 'info')
        )
    ).length;
}

function countWarnings(regressions = []) {
    return toArray(regressions).filter(
        (entry) =>
            normalizeSeverity(entry?.severity || entry?.state || 'info') ===
            'warning'
    ).length;
}

function blockedOwners(ownerBoard) {
    return toArray(ownerBoard?.lanes).filter((lane) => {
        const summary = lane?.summary || {};
        return (
            Number(summary.blocker || 0) > 0 ||
            String(lane?.status || '').toLowerCase() === 'blocked'
        );
    }).length;
}

function approvalBlocking(approvals = {}) {
    return (
        Number(approvals?.blockingCount || approvals?.pending?.length || 0) || 0
    );
}

function canaryStatus(canary = {}) {
    return toText(
        canary?.active?.state || canary?.current?.state || 'draft',
        'draft'
    ).toLowerCase();
}

export function buildReleasePromotionPipeline(input = {}) {
    const score = Number.isFinite(input?.scorecard?.score)
        ? input.scorecard.score
        : 0;
    const regressions = toArray(input?.radar?.regressions);
    const evidenceBlocking = countBlocking(regressions);
    const evidenceWarnings = countWarnings(regressions);
    const approvalBlockingCount = approvalBlocking(input?.approvals);
    const ownerBlockedCount = blockedOwners(input?.ownerBoard);
    const canaryState = canaryStatus(input?.canary);
    const slaStatus = toText(
        input?.sla?.slaStatus || 'watch',
        'watch'
    ).toLowerCase();
    const budgetStatus = toText(
        input?.riskBudget?.budgetStatus || 'tight',
        'tight'
    ).toLowerCase();
    const errorBudgetStatus = toText(
        input?.riskBudget?.errorBudgetStatus || 'watch',
        'watch'
    ).toLowerCase();

    const stages = [
        {
            id: 'evidence',
            status:
                evidenceBlocking === 0
                    ? 'green'
                    : evidenceBlocking <= 2
                      ? 'yellow'
                      : 'red',
            blockingCount: evidenceBlocking,
            owner: 'ops',
            advice:
                evidenceBlocking === 0
                    ? 'Evidencia suficiente.'
                    : 'Reducir señales críticas y drift antes de promover.',
        },
        {
            id: 'owners',
            status: ownerBlockedCount > 0 ? 'red' : 'green',
            blockingCount: ownerBlockedCount,
            owner: 'ops',
            advice:
                ownerBlockedCount > 0
                    ? 'Resolver owners bloqueados.'
                    : 'Owners en rango.',
        },
        {
            id: 'approvals',
            status:
                approvalBlockingCount === 0
                    ? 'green'
                    : approvalBlockingCount <= 2
                      ? 'yellow'
                      : 'red',
            blockingCount: approvalBlockingCount,
            owner: 'product-owner',
            advice:
                approvalBlockingCount === 0
                    ? 'Sin aprobaciones pendientes.'
                    : 'Cerrar aprobaciones antes de promover.',
        },
        {
            id: 'canary',
            status:
                canaryState === 'live'
                    ? 'green'
                    : canaryState === 'armed' || canaryState === 'hold'
                      ? 'yellow'
                      : canaryState === 'completed'
                        ? 'yellow'
                        : 'red',
            blockingCount:
                ['none', 'draft'].includes(canaryState) ||
                canaryState === 'hold'
                    ? 1
                    : canaryState === 'rolled_back'
                      ? 2
                      : 0,
            owner: 'deploy',
            advice:
                canaryState === 'live'
                    ? 'Canary activo.'
                    : canaryState === 'armed'
                      ? 'Armar y observar canary antes del corte completo.'
                      : canaryState === 'hold'
                        ? 'Canary en hold, requiere validación.'
                        : canaryState === 'rolled_back'
                          ? 'Revisar el rollback antes de volver a promover.'
                          : 'Crear o rearmar canary antes de promoción completa.',
        },
        {
            id: 'slo',
            status:
                slaStatus === 'healthy' && errorBudgetStatus !== 'burned'
                    ? 'green'
                    : slaStatus === 'watch'
                      ? 'yellow'
                      : 'red',
            blockingCount:
                slaStatus === 'healthy' ? 0 : slaStatus === 'watch' ? 1 : 2,
            owner: 'ops',
            advice:
                slaStatus === 'healthy'
                    ? 'SLA dentro de rango.'
                    : 'Atender las señales de SLA/SLO antes de promover.',
        },
        {
            id: 'promotion',
            status:
                score >= 85 &&
                approvalBlockingCount === 0 &&
                slaStatus === 'healthy' &&
                budgetStatus === 'healthy' &&
                canaryState === 'live'
                    ? 'green'
                    : score >= 70 &&
                        approvalBlockingCount <= 1 &&
                        budgetStatus !== 'exhausted' &&
                        slaStatus !== 'breached'
                      ? 'yellow'
                      : 'red',
            blockingCount: [
                score < 85,
                approvalBlockingCount > 0,
                slaStatus !== 'healthy',
                budgetStatus === 'exhausted',
                canaryState !== 'live',
            ].filter(Boolean).length,
            owner: 'product-owner',
            advice:
                score >= 85
                    ? 'Listo para promoción vigilada.'
                    : 'Aún no conviene promover.',
        },
    ];

    const hardStops = stages.filter((stage) => stage.status === 'red').length;
    const yellowStages = stages.filter(
        (stage) => stage.status === 'yellow'
    ).length;
    const decision =
        canaryState === 'rolled_back'
            ? 'rollback'
            : hardStops > 0
              ? 'hold'
              : yellowStages > 1 || canaryState !== 'live'
                ? 'review'
                : 'promote';
    const decisionReason =
        decision === 'promote'
            ? 'Sin bloqueos hard y canary en vivo.'
            : decision === 'review'
              ? 'Hay señales amarillas o el canary todavía no está listo.'
              : decision === 'rollback'
                ? 'Se detectó rollback o una condición equivalente.'
                : 'Hay bloqueos que impiden la promoción.';
    const approvalOwner =
        approvalBlockingCount === 0 ? 'deploy' : 'product-owner';

    return {
        stages,
        decision,
        decisionReason,
        blockingStages: stages.filter((stage) => stage.status !== 'green'),
        blockingStageIds: stages
            .filter((stage) => stage.status !== 'green')
            .map((stage) => stage.id),
        greenStageIds: stages
            .filter((stage) => stage.status === 'green')
            .map((stage) => stage.id),
        yellowStageIds: stages
            .filter((stage) => stage.status === 'yellow')
            .map((stage) => stage.id),
        approvalOwner,
        canaryState,
        evidenceBlocking,
        evidenceWarnings,
        summary: `Pipeline ${decision} | red ${hardStops} | yellow ${yellowStages} | canary ${canaryState}`,
        recommendation:
            decision === 'promote'
                ? 'Promover con vigilancia.'
                : decision === 'review'
                  ? 'Mantener en review.'
                  : decision === 'rollback'
                    ? 'Rollback y validación.'
                    : 'Mantener en hold.',
        statusTone:
            decision === 'promote'
                ? 'ready'
                : decision === 'review'
                  ? 'warning'
                  : 'alert',
    };
}

export default buildReleasePromotionPipeline;
