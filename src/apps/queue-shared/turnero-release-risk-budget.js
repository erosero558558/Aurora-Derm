import {
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return min;
    }

    return Math.max(min, Math.min(max, parsed));
}

function countBlockedOwners(ownerBoard) {
    return toArray(ownerBoard?.lanes).filter((lane) => {
        const summary = lane?.summary || {};
        return (
            Number(summary.blocker || 0) > 0 ||
            String(lane?.status || '').toLowerCase() === 'blocked'
        );
    }).length;
}

function countRegressionSignals(regressions = []) {
    const normalized = toArray(regressions);
    return {
        critical: normalized.filter(
            (entry) =>
                normalizeSeverity(entry?.severity || entry?.state || 'info') ===
                'alert'
        ).length,
        warning: normalized.filter(
            (entry) =>
                normalizeSeverity(entry?.severity || entry?.state || 'info') ===
                'warning'
        ).length,
        info: normalized.filter(
            (entry) =>
                normalizeSeverity(entry?.severity || entry?.state || 'info') ===
                'info'
        ).length,
    };
}

function canaryPenalty(state) {
    const normalized = toText(state, 'draft').toLowerCase();

    if (normalized === 'live') {
        return 0;
    }
    if (normalized === 'armed') {
        return 6;
    }
    if (normalized === 'hold') {
        return 14;
    }
    if (normalized === 'rolled_back') {
        return 20;
    }
    if (normalized === 'completed') {
        return 2;
    }
    if (normalized === 'archived') {
        return 1;
    }

    return 12;
}

function slaPenalty(status) {
    const normalized = toText(status, 'watch').toLowerCase();

    if (normalized === 'healthy') {
        return 0;
    }
    if (normalized === 'watch') {
        return 8;
    }
    if (normalized === 'breached') {
        return 18;
    }

    return 10;
}

function trendPenalty(direction) {
    const normalized = toText(direction, 'stable').toLowerCase();

    if (normalized.includes('improv')) {
        return 0;
    }
    if (normalized.includes('flat') || normalized.includes('stable')) {
        return 4;
    }
    if (normalized.includes('regress') || normalized.includes('down')) {
        return 12;
    }

    return 6;
}

export function computeReleaseRiskBudget(input = {}) {
    const scorecard = input?.scorecard || {};
    const score = clamp(
        Number.isFinite(scorecard.score) ? scorecard.score : input?.score,
        0,
        100
    );
    const approvals = input?.approvals || {};
    const canary = input?.canary || {};
    const sla = input?.sla || {};
    const ownerBoard = input?.ownerBoard || {};
    const regressions = toArray(
        input?.radar?.regressions || input?.regressions
    );
    const regressionCounts = countRegressionSignals(regressions);
    const blockedOwners = countBlockedOwners(ownerBoard);
    const approvalBlockingCount = Number(
        approvals.blockingCount || approvals.pending?.length || 0
    );
    const activeCanaryState = toText(
        canary?.active?.state ||
            canary?.current?.state ||
            input?.canaryState ||
            'draft'
    );
    const slaStatus = toText(
        sla.slaStatus || sla.status || input?.slaStatus || 'watch'
    );
    const trendDirection = toText(
        input?.trend?.direction || input?.trendDirection || 'stable'
    );

    const consumed = clamp(
        (100 - score) * 0.42 +
            regressionCounts.critical * 16 +
            regressionCounts.warning * 6 +
            approvalBlockingCount * 7 +
            blockedOwners * 5 +
            canaryPenalty(activeCanaryState) +
            slaPenalty(slaStatus) +
            trendPenalty(trendDirection),
        0,
        100
    );
    const remainingBudget = clamp(100 - consumed, 0, 100);
    const errorBudgetRemaining = clamp(
        100 -
            regressionCounts.critical * 20 -
            regressionCounts.warning * 8 -
            approvalBlockingCount * 5 -
            blockedOwners * 4 -
            slaPenalty(slaStatus),
        0,
        100
    );
    const budgetStatus =
        remainingBudget >= 70
            ? 'healthy'
            : remainingBudget >= 40
              ? 'tight'
              : 'exhausted';
    const errorBudgetStatus =
        errorBudgetRemaining >= 70
            ? 'healthy'
            : errorBudgetRemaining >= 35
              ? 'watch'
              : 'burned';
    const burnRate = clamp(
        regressionCounts.critical * 18 +
            regressionCounts.warning * 6 +
            approvalBlockingCount * 5 +
            blockedOwners * 4 +
            trendPenalty(trendDirection),
        0,
        100
    );

    return {
        budgetMax: 100,
        consumed,
        remainingBudget,
        burnRate,
        budgetStatus,
        errorBudgetRemaining,
        errorBudgetStatus,
        criticalDebt:
            regressionCounts.critical + blockedOwners + approvalBlockingCount,
        blockers:
            regressionCounts.critical +
            regressionCounts.warning +
            approvalBlockingCount +
            blockedOwners,
        summary: `Risk budget ${budgetStatus} | restante ${Math.round(
            remainingBudget
        )}/100 | error ${Math.round(errorBudgetRemaining)}/100 | burn ${Math.round(
            burnRate
        )}/100`,
    };
}

export default computeReleaseRiskBudget;
