import { toArray, toText } from './turnero-release-control-center.js';

function incidentHaystack(item = {}) {
    return [
        item.dependency,
        item.kind,
        item.category,
        item.title,
        item.detail,
        item.code,
        item.summary,
        item.note,
        item.owner,
    ]
        .map((value) => toText(value).toLowerCase())
        .join(' ');
}

function matchesDependency(item, depKey, depLabel) {
    const haystack = incidentHaystack(item);
    const needles = [depKey, depLabel]
        .map((value) => toText(value).toLowerCase())
        .filter(Boolean);
    return needles.some((needle) => haystack.includes(needle));
}

export function buildTurneroReleaseDependencyImpactMap(input = {}) {
    const dependencies = toArray(
        input.dependencies ||
            input.assurancePack?.dependencies ||
            input.dependencyRows
    );
    const incidents = toArray(
        input.releaseIncidents ||
            input.incidents ||
            input.assurancePack?.incidents
    );

    const rows = dependencies.map((dep, index) => {
        const key = toText(
            dep.key || dep.id || `dep-${index + 1}`,
            `dep-${index + 1}`
        );
        const label = toText(dep.label || dep.name || key, key);
        const affected = incidents.filter((incident) =>
            matchesDependency(incident, key, label)
        );
        const baseRiskValue = Number(dep.baseRisk ?? dep.risk ?? 20);
        const baseRisk = Number.isFinite(baseRiskValue) ? baseRiskValue : 20;
        const impactScore = Math.min(100, affected.length * 20 + baseRisk);
        const state =
            impactScore >= 80
                ? 'critical'
                : impactScore >= 50
                  ? 'watch'
                  : 'stable';

        return {
            key,
            label,
            owner: toText(dep.owner || 'unassigned', 'unassigned'),
            baseRisk,
            impactScore,
            affectedCount: affected.length,
            affectedIncidents: affected.map((item) => ({
                id: toText(item.id),
                title: toText(
                    item.title ||
                        item.code ||
                        item.kind ||
                        item.category ||
                        item.id
                ),
                severity: toText(item.severity || 'medium', 'medium'),
            })),
            state,
        };
    });

    return {
        rows,
        summary: {
            critical: rows.filter((row) => row.state === 'critical').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            stable: rows.filter((row) => row.state === 'stable').length,
            totalImpact: rows.reduce((sum, row) => sum + row.impactScore, 0),
        },
        generatedAt: new Date().toISOString(),
    };
}
