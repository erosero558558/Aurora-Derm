import { asObject, toArray, toText } from './turnero-release-control-center.js';

function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function resolveTone(blockedCount, pendingApprovals, adoptionAvg, valueAvg) {
    if (blockedCount > 0 || pendingApprovals > 0) {
        return 'warning';
    }

    if (adoptionAvg < 70 || valueAvg < 75) {
        return 'warning';
    }

    return 'ready';
}

export function buildTurneroReleaseQuarterlyBusinessReview(input = {}) {
    const kpis = asObject(input.kpis);
    const value = asObject(input.value);
    const governance = asObject(input.governance);
    const blockedCount = toNumber(
        kpis.blockedIncidents ?? kpis.blockedCount,
        0
    );
    const pendingApprovals = toNumber(kpis.pendingApprovals ?? 0, 0);
    const adoptionAvg = toNumber(
        kpis.avgAdoption ?? kpis.adoptionAvg ?? value.adoptionAvg ?? 72,
        72
    );
    const valueAvg = toNumber(
        value.realizationPct ?? value.valueScore ?? kpis.avgValue ?? 76,
        76
    );
    const tone = resolveTone(
        blockedCount,
        pendingApprovals,
        adoptionAvg,
        valueAvg
    );
    const summary = [
        `Adopción promedio ${adoptionAvg}%`,
        `value realization ${valueAvg}%`,
        `Bloqueos abiertos ${blockedCount}`,
        `Aprobaciones pendientes ${pendingApprovals}`,
        `Gobernanza ${toText(governance.mode || governance.decision || 'review')}`,
    ];

    const watchItems = [];
    if (blockedCount > 0) {
        watchItems.push(
            'Resolver bloqueos abiertos antes de cerrar el trimestre.'
        );
    }
    if (pendingApprovals > 0) {
        watchItems.push(
            'Cerrar aprobaciones pendientes para estabilizar el rollout.'
        );
    }
    if (adoptionAvg < 70) {
        watchItems.push('La adopción está por debajo de la meta.');
    }
    if (valueAvg < 75) {
        watchItems.push('El value score necesita refuerzo.');
    }
    if (!watchItems.length) {
        watchItems.push(
            'La cadencia trimestral puede mantenerse sin fricciones mayores.'
        );
    }

    return {
        region: toText(input.region || 'regional', 'regional'),
        summary,
        watchItems,
        narrative:
            input.narrative ||
            `El comité trimestral revisa ${adoptionAvg}% de adopción y ${valueAvg}% de value realization.`,
        tone,
        generatedAt: new Date().toISOString(),
    };
}

export function quarterlyBusinessReviewToMarkdown(review = {}) {
    const summary = toArray(review.summary);
    const watchItems = toArray(review.watchItems);

    return [
        '# Quarterly Business Review',
        '',
        `- Region: ${toText(review.region || 'regional')}`,
        `- Tone: ${toText(review.tone || 'warning')}`,
        '',
        '## Summary',
        ...(summary.length
            ? summary.map((item) => `- ${toText(item)}`)
            : ['- Sin summary.']),
        '',
        '## Watch items',
        ...(watchItems.length
            ? watchItems.map((item) => `- ${toText(item)}`)
            : ['- Sin watch items.']),
        '',
        `Generated at: ${toText(review.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export default buildTurneroReleaseQuarterlyBusinessReview;
