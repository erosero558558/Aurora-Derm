import { asObject, toText } from './turnero-release-control-center.js';
import { buildMultiClinicCohortPlanner } from './turnero-release-clinic-cohort-planner.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function compareHotspots(left, right) {
    if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
    }

    if (right.score !== left.score) {
        return left.score - right.score;
    }

    return toText(left.clinicLabel).localeCompare(toText(right.clinicLabel));
}

function hotspotReason(plan) {
    if (plan.riskBand === 'critical') {
        return 'Riesgo crítico';
    }

    if (plan.blockingCount > 0) {
        return `${plan.blockingCount} blocker(s)`;
    }

    if (plan.riskBand === 'high') {
        return 'Riesgo alto';
    }

    if (plan.decision === 'review') {
        return 'Revisión pendiente';
    }

    return 'Monitoreo';
}

export function buildMultiClinicPortfolioHeatmap(input = {}) {
    const source = asObject(input);
    const planner = source.planner || buildMultiClinicCohortPlanner(source);
    const plans = Array.isArray(planner.plans) ? planner.plans : [];
    const byOwner = new Map();
    const bySeverity = {
        ready: 0,
        warning: 0,
        alert: 0,
    };
    const byDecision = {
        promote: 0,
        review: 0,
        hold: 0,
    };

    for (const plan of plans) {
        const severity =
            plan.state === 'ready'
                ? 'ready'
                : plan.state === 'warning'
                  ? 'warning'
                  : 'alert';
        bySeverity[severity] += 1;
        byDecision[plan.decision] =
            safeNumber(byDecision[plan.decision], 0) + 1;

        const ownerKey = toText(plan.ownerTeam, 'unknown');
        const current = byOwner.get(ownerKey) || {
            ownerTeam: ownerKey,
            clinicCount: 0,
            scoreSum: 0,
            riskSum: 0,
            clinics: [],
        };

        current.clinicCount += 1;
        current.scoreSum += safeNumber(plan.score, 0);
        current.riskSum += safeNumber(
            plan.riskScore,
            100 - safeNumber(plan.score, 0)
        );
        current.clinics.push(plan);
        byOwner.set(ownerKey, current);
    }

    const owners = Array.from(byOwner.values())
        .map((entry) => ({
            ownerTeam: entry.ownerTeam,
            clinicCount: entry.clinicCount,
            averageScore: entry.clinicCount
                ? Math.round(entry.scoreSum / entry.clinicCount)
                : 0,
            averageRisk: entry.clinicCount
                ? Math.round(entry.riskSum / entry.clinicCount)
                : 0,
            state:
                entry.clinicCount === 1
                    ? 'single-point-of-failure'
                    : entry.clinicCount <= 2
                      ? 'thin-coverage'
                      : 'healthy-coverage',
            clinics: entry.clinics.slice().sort(compareHotspots),
        }))
        .sort((left, right) => {
            if (right.averageRisk !== left.averageRisk) {
                return right.averageRisk - left.averageRisk;
            }

            return toText(left.ownerTeam).localeCompare(
                toText(right.ownerTeam)
            );
        });
    const hotspots = plans
        .slice()
        .sort(compareHotspots)
        .slice(0, 5)
        .map((plan) => ({
            clinicId: plan.clinicId,
            clinicLabel: plan.clinicLabel,
            region: plan.region,
            ownerTeam: plan.ownerTeam,
            score: plan.score,
            riskScore: safeNumber(
                plan.riskScore,
                100 - safeNumber(plan.score, 0)
            ),
            riskBand: plan.riskBand,
            blockingCount: plan.blockingCount,
            warningCount: plan.warningCount,
            decision: plan.decision,
            tone: plan.state,
            reason: hotspotReason(plan),
        }));

    return {
        planner,
        bySeverity,
        byDecision,
        byOwner: owners,
        hotspots,
        summary: plans.length
            ? `Heatmap multi-clinic ${plans.length} clínica(s) · alert ${bySeverity.alert} · warning ${bySeverity.warning} · ready ${bySeverity.ready}.`
            : 'Heatmap multi-clinic vacío.',
        heatmapCells: plans.map((plan) => ({
            clinicId: plan.clinicId,
            clinicLabel: plan.clinicLabel,
            region: plan.region,
            ownerTeam: plan.ownerTeam,
            score: plan.score,
            riskScore: safeNumber(
                plan.riskScore,
                100 - safeNumber(plan.score, 0)
            ),
            state: plan.state,
            decision: plan.decision,
            cohort: plan.cohort,
        })),
    };
}

export default buildMultiClinicPortfolioHeatmap;
