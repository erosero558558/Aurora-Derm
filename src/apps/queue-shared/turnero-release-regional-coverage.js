import { asObject, toText } from './turnero-release-control-center.js';
import { buildMultiClinicRegionalScoreboard } from './turnero-release-regional-scoreboard.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function coverageStatus(region) {
    if (region.clinicCount <= 1) {
        return 'single-point-of-failure';
    }

    if (region.averageRisk >= 65 || region.holdCount > 0) {
        return 'understaffed';
    }

    if (region.averageRisk >= 35 || region.reviewCount > 0) {
        return 'thin-coverage';
    }

    return 'healthy-coverage';
}

function coverageTone(status) {
    if (status === 'healthy-coverage') {
        return 'ready';
    }

    if (status === 'thin-coverage') {
        return 'warning';
    }

    return 'alert';
}

export function buildMultiClinicRegionalCoverage(input = {}) {
    const source = asObject(input);
    const scoreboard =
        source.scoreboard || buildMultiClinicRegionalScoreboard(source);
    const regions = Array.isArray(scoreboard.regions) ? scoreboard.regions : [];
    const coverage = regions.map((region) => {
        const status = coverageStatus(region);
        const coverageScore = clamp(
            100 - safeNumber(region.averageRisk, 0) + region.clinicCount * 5,
            0,
            100
        );

        return {
            region: region.region,
            clinicCount: region.clinicCount,
            ownerTeams: Array.isArray(region.ownerTeams)
                ? region.ownerTeams
                : [],
            averageScore: safeNumber(region.averageScore, 0),
            averageRisk: safeNumber(region.averageRisk, 0),
            status,
            tone: coverageTone(status),
            coverageScore,
            notes:
                status === 'healthy-coverage'
                    ? 'Cobertura saludable'
                    : status === 'thin-coverage'
                      ? 'Cobertura delgada'
                      : status === 'understaffed'
                        ? 'Cobertura con refuerzo pendiente'
                        : 'Punto único de falla',
        };
    });
    const underCoveredRegions = coverage.filter(
        (entry) => entry.status !== 'healthy-coverage'
    );
    const overallStatus =
        coverage.length === 0
            ? 'empty'
            : underCoveredRegions.some(
                    (entry) => entry.status === 'single-point-of-failure'
                )
              ? 'red'
              : underCoveredRegions.length > 0
                ? 'yellow'
                : 'green';

    return {
        scoreboard,
        coverage,
        underCoveredRegions,
        overallStatus,
        summary: coverage.length
            ? `Cobertura regional ${coverage.length} región(es) · ${underCoveredRegions.length} zona(s) por reforzar · estado ${overallStatus}.`
            : 'Cobertura regional vacía.',
        coverageMap: Object.fromEntries(
            coverage.map((entry) => [entry.region, entry])
        ),
    };
}

export default buildMultiClinicRegionalCoverage;
