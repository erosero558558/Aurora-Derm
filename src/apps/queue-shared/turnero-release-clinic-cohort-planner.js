import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildMultiClinicRegionalRegistry } from './turnero-release-regional-registry.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function cohortMeta(cohort) {
    switch (cohort) {
        case 'pilot':
            return { label: 'Pilot', traffic: 100, rank: 0 };
        case 'wave-1':
            return { label: 'Wave 1', traffic: 20, rank: 1 };
        case 'wave-2':
            return { label: 'Wave 2', traffic: 35, rank: 2 };
        case 'wave-3':
            return { label: 'Wave 3', traffic: 50, rank: 3 };
        default:
            return { label: 'Holdouts', traffic: 0, rank: 4 };
    }
}

function riskBandForScore(riskScore) {
    if (riskScore >= 75) {
        return 'critical';
    }
    if (riskScore >= 55) {
        return 'high';
    }
    if (riskScore >= 35) {
        return 'medium';
    }
    return 'low';
}

function scoreClinic(clinic, totalClinics = 0) {
    const readinessScore = safeNumber(clinic.readinessScore, 0);
    const riskScore = safeNumber(clinic.riskScore, 0);
    const priorityBonus = clamp(
        15 - safeNumber(clinic.priorityTier, 3) * 2,
        0,
        12
    );
    const blockerPenalty = clamp(
        safeNumber(clinic.blockingCount, 0) * 8,
        0,
        32
    );
    const warningPenalty = clamp(safeNumber(clinic.warningCount, 0) * 3, 0, 12);
    const spreadBonus = totalClinics > 1 ? 4 : 0;

    return clamp(
        Math.round(
            readinessScore * 0.65 +
                (100 - riskScore) * 0.35 +
                priorityBonus +
                spreadBonus -
                blockerPenalty -
                warningPenalty
        ),
        0,
        100
    );
}

function pickCohort(plan, totalClinics) {
    if (totalClinics <= 1) {
        return 'pilot';
    }

    if (
        plan.score >= 85 &&
        plan.riskBand !== 'critical' &&
        plan.blockingCount === 0
    ) {
        return 'wave-1';
    }

    if (
        plan.score >= 70 &&
        plan.riskBand !== 'critical' &&
        plan.riskBand !== 'high'
    ) {
        return 'wave-2';
    }

    if (plan.score >= 55 && plan.riskBand !== 'critical') {
        return 'wave-3';
    }

    if (plan.priorityTier <= 1 && plan.score >= 65) {
        return 'pilot';
    }

    return 'holdouts';
}

function computeDecision(plan) {
    if (plan.cohort === 'holdouts' || plan.riskBand === 'critical') {
        return 'hold';
    }

    if (plan.score >= 75 && plan.blockingCount === 0) {
        return 'promote';
    }

    if (plan.score >= 55) {
        return 'review';
    }

    return 'hold';
}

function buildOwnerCoverage(clinic, ownerCounts, totalClinics) {
    const ownerCount = safeNumber(ownerCounts.get(clinic.ownerTeam), 0);
    const share = totalClinics
        ? Math.round((ownerCount / totalClinics) * 100)
        : 0;

    return {
        ownerTeam: clinic.ownerTeam,
        clinicCount: ownerCount,
        sharePct: share,
        label:
            ownerCount > 0
                ? `${clinic.ownerTeam} cubre ${ownerCount} clínica(s)`
                : `${clinic.ownerTeam} sin cobertura`,
    };
}

function buildEntryCriteria(plan) {
    const criteria = [];

    if (plan.score >= 70) {
        criteria.push('readiness >= 70');
    } else {
        criteria.push('readiness en estabilización');
    }

    if (plan.riskBand === 'low') {
        criteria.push('risk band low');
    } else {
        criteria.push(`risk band ${plan.riskBand}`);
    }

    if (plan.blockingCount > 0) {
        criteria.push(`${plan.blockingCount} blocker(s) abiertos`);
    } else {
        criteria.push('sin blockers abiertos');
    }

    return criteria;
}

function buildExitCriteria(plan) {
    const criteria = [
        'evidencia operacional alineada',
        'owner coverage validada',
    ];

    if (plan.score >= 80) {
        criteria.push('score >= 80');
    }

    if (plan.riskBand === 'critical') {
        criteria.push('bajar risk band');
    }

    return criteria;
}

function buildPlan(clinic, totalClinics, ownerCounts) {
    const score = scoreClinic(clinic, totalClinics);
    const riskBand = riskBandForScore(clinic.riskScore);
    const cohort = pickCohort(
        {
            ...clinic,
            score,
            riskBand,
        },
        totalClinics
    );
    const meta = cohortMeta(cohort);
    const decision = computeDecision({
        ...clinic,
        score,
        riskBand,
        cohort,
    });
    const approvalDebt = clamp(
        safeNumber(clinic.blockingCount, 0) * 2 +
            safeNumber(clinic.warningCount, 0) +
            (riskBand === 'high' ? 1 : 0) +
            (riskBand === 'critical' ? 2 : 0),
        0,
        20
    );

    return {
        clinicId: clinic.clinicId,
        clinicLabel: clinic.clinicLabel,
        region: clinic.region,
        province: clinic.province,
        cluster: clinic.cluster,
        ownerTeam: clinic.ownerTeam,
        ownerCoverage: buildOwnerCoverage(clinic, ownerCounts, totalClinics),
        readinessScore: safeNumber(clinic.readinessScore, 0),
        riskScore: safeNumber(clinic.riskScore, 100 - score),
        score,
        riskBand,
        blockingCount: safeNumber(clinic.blockingCount, 0),
        warningCount: safeNumber(clinic.warningCount, 0),
        approvalDebt,
        cohort,
        cohortLabel: meta.label,
        cohortRank: meta.rank,
        decision,
        targetTrafficPercent: meta.traffic,
        entryCriteria: buildEntryCriteria({
            ...clinic,
            score,
            riskBand,
            blockingCount: safeNumber(clinic.blockingCount, 0),
        }),
        exitCriteria: buildExitCriteria({
            ...clinic,
            score,
            riskBand,
        }),
        promotionRecommendation:
            decision === 'promote'
                ? 'promote-now'
                : decision === 'review'
                  ? 'review-before-promotion'
                  : 'hold',
        tags: toArray(clinic.tags),
        releaseMode: clinic.releaseMode,
        profileFingerprint: clinic.profileFingerprint,
        state:
            decision === 'promote'
                ? 'ready'
                : decision === 'review'
                  ? 'warning'
                  : 'alert',
    };
}

function comparePlans(left, right) {
    if (left.cohortRank !== right.cohortRank) {
        return left.cohortRank - right.cohortRank;
    }

    if (right.score !== left.score) {
        return right.score - left.score;
    }

    return toText(left.clinicLabel).localeCompare(toText(right.clinicLabel));
}

function aggregateCohort(plans, cohortId) {
    const rows = plans.filter((plan) => plan.cohort === cohortId);
    const count = rows.length;
    const scoreSum = rows.reduce(
        (accumulator, plan) => accumulator + safeNumber(plan.score, 0),
        0
    );
    const riskSum = rows.reduce(
        (accumulator, plan) =>
            accumulator +
            safeNumber(plan.riskScore, 100 - safeNumber(plan.score, 0)),
        0
    );

    return {
        cohort: cohortId,
        label: cohortMeta(cohortId).label,
        count,
        clinics: rows,
        averageScore: count ? Math.round(scoreSum / count) : 0,
        averageRisk: count ? Math.round(riskSum / count) : 0,
        targetTrafficPercent: cohortMeta(cohortId).traffic,
        summary: count
            ? `${cohortMeta(cohortId).label} ${count} clínica(s)`
            : `${cohortMeta(cohortId).label} vacío`,
        tone:
            cohortId === 'holdouts'
                ? 'alert'
                : count > 0 && rows.some((plan) => plan.riskBand === 'critical')
                  ? 'warning'
                  : count > 0
                    ? 'ready'
                    : 'info',
    };
}

export function buildMultiClinicCohortPlanner(input = {}) {
    const source = asObject(input);
    const registry =
        source.registry ||
        buildMultiClinicRegionalRegistry(source, {
            scope: source.scope,
            selectedClinicId: source.selectedClinicId,
        });
    const clinics = Array.isArray(registry.clinics) ? registry.clinics : [];
    const ownerCounts = new Map();

    for (const clinic of clinics) {
        ownerCounts.set(
            clinic.ownerTeam,
            safeNumber(ownerCounts.get(clinic.ownerTeam), 0) + 1
        );
    }

    const plans = clinics.map((clinic) =>
        buildPlan(clinic, clinics.length, ownerCounts)
    );
    plans.sort(comparePlans);

    const cohorts = [
        aggregateCohort(plans, 'pilot'),
        aggregateCohort(plans, 'wave-1'),
        aggregateCohort(plans, 'wave-2'),
        aggregateCohort(plans, 'wave-3'),
        aggregateCohort(plans, 'holdouts'),
    ];

    const counts = plans.reduce(
        (accumulator, plan) => {
            accumulator.total += 1;
            accumulator[plan.cohort.replace('-', '')] =
                safeNumber(accumulator[plan.cohort.replace('-', '')], 0) + 1;
            accumulator[plan.decision] =
                safeNumber(accumulator[plan.decision], 0) + 1;
            accumulator.scoreSum += safeNumber(plan.score, 0);
            accumulator.approvalDebt += safeNumber(plan.approvalDebt, 0);
            return accumulator;
        },
        {
            total: 0,
            pilot: 0,
            wave1: 0,
            wave2: 0,
            wave3: 0,
            holdouts: 0,
            promote: 0,
            review: 0,
            hold: 0,
            scoreSum: 0,
            approvalDebt: 0,
        }
    );

    const averageScore = counts.total
        ? Math.round(counts.scoreSum / counts.total)
        : 0;
    const recommendedNextCohort =
        cohorts.find(
            (cohort) =>
                cohort.cohort !== 'holdouts' &&
                cohort.count > 0 &&
                cohort.averageScore >= 60
        )?.cohort ||
        (cohorts.some((cohort) => cohort.count > 0)
            ? cohorts.find(
                  (cohort) => cohort.cohort !== 'holdouts' && cohort.count > 0
              )?.cohort || 'holdouts'
            : 'holdouts');
    const recommendedCohort = cohorts.find(
        (cohort) => cohort.cohort === recommendedNextCohort
    );
    const highestScorePlan = plans[0] || null;

    return {
        registry,
        plans,
        cohorts,
        counts: {
            ...counts,
            averageScore,
        },
        recommendedNextCohort,
        recommendedTrafficPercent: recommendedCohort?.targetTrafficPercent || 0,
        highestScorePlan,
        summary: plans.length
            ? `Cohort planner ${plans.length} clínica(s) · pilot ${counts.pilot} · wave-1 ${counts.wave1} · wave-2 ${counts.wave2} · wave-3 ${counts.wave3} · holdouts ${counts.holdouts} · avg ${averageScore}/100.`
            : 'Cohort planner vacío.',
        ownerCounts: Object.fromEntries(ownerCounts.entries()),
        topPriorityPlans: plans.slice(0, 5),
        byDecision: {
            promote: counts.promote,
            review: counts.review,
            hold: counts.hold,
        },
        byRiskBand: plans.reduce(
            (accumulator, plan) => {
                accumulator[plan.riskBand] =
                    safeNumber(accumulator[plan.riskBand], 0) + 1;
                return accumulator;
            },
            {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0,
            }
        ),
    };
}

export { cohortMeta, scoreClinic };

export default buildMultiClinicCohortPlanner;
