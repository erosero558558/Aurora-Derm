import { toArray } from './turnero-release-control-center.js';

export function buildTurneroReleaseResilienceScore(input = {}) {
    const dependencyRows = toArray(
        input.dependencyRows || input.dependencyMap?.rows
    );
    const drills = toArray(input.drills);
    const checkpoints = toArray(input.checkpoints);
    const incidents = toArray(
        input.incidents ||
            input.releaseIncidents ||
            input.assurancePack?.incidents
    );

    const criticalDependencies = dependencyRows.filter(
        (row) => row.state === 'critical'
    ).length;
    const watchDependencies = dependencyRows.filter(
        (row) => row.state === 'watch'
    ).length;
    const highIncidents = incidents.filter((item) =>
        ['critical', 'high'].includes(String(item.severity || '').toLowerCase())
    ).length;
    const passedDrills = drills.filter(
        (item) => item.result === 'passed'
    ).length;
    const failedDrills = drills.filter(
        (item) => item.result === 'failed'
    ).length;
    const closedCheckpoints = checkpoints.filter(
        (item) => item.state === 'closed'
    ).length;

    let score = 100;
    score -= criticalDependencies * 12;
    score -= watchDependencies * 5;
    score -= highIncidents * 8;
    score += passedDrills * 4;
    score -= failedDrills * 6;
    score += closedCheckpoints * 2;
    score = Math.max(0, Math.min(100, score));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 55
                ? 'watch'
                : 'fragile';

    return {
        score,
        band,
        generatedAt: new Date().toISOString(),
        factors: {
            criticalDependencies,
            watchDependencies,
            highIncidents,
            passedDrills,
            failedDrills,
            closedCheckpoints,
            penalty:
                criticalDependencies * 12 +
                watchDependencies * 5 +
                highIncidents * 8 +
                failedDrills * 6,
            bonus: passedDrills * 4 + closedCheckpoints * 2,
        },
    };
}
