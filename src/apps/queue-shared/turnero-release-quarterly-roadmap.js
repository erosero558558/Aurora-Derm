import { toArray, toText } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildTurneroReleaseQuarterlyRoadmap(input = {}) {
    const region = toText(input.region || 'regional', 'regional');
    const clinicsTarget = safeNumber(
        input.clinicsTarget,
        toArray(input.clinics).length || 4
    );
    const quarterlyThemes = [
        'Pilot hardening',
        'Regional rollout',
        'Scale optimization',
        'Portfolio maturity',
    ];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
        const clinicsNext = clinicsTarget * (index + 1);
        const investmentBand = ['low', 'medium', 'high', 'high'][index];
        const focus = quarterlyThemes[index];

        return {
            quarter,
            theme: focus,
            focus,
            clinicsTarget: clinicsNext,
            investmentBand,
            state: index === 0 ? 'ready' : index === 1 ? 'warning' : 'watch',
        };
    });

    return {
        region,
        clinicsTarget,
        quarters,
        state: 'ready',
        summary: `Quarterly roadmap for ${region} with target ${clinicsTarget} clinic(s) per quarter.`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseQuarterlyRoadmap;
