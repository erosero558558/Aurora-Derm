import { toArray } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function countOpenItems(items) {
    return toArray(items).filter((item) => {
        const status = String(item?.status || '')
            .trim()
            .toLowerCase();
        return status !== 'closed' && status !== 'approved';
    }).length;
}

export function buildTurneroReleaseSafetyPrivacyScore(input = {}) {
    const matrixSummary = input.matrixSummary || {};
    const obligations = toArray(input.obligations);
    const accessReviews = toArray(input.accessReviews);
    const guardrailSummary = input.guardrailSummary || {};
    const retention = toArray(input.retention);

    let score = 100;
    score -= safeNumber(matrixSummary.restricted, 0) * 6;
    score -= countOpenItems(obligations) * 4;
    score -= countOpenItems(accessReviews) * 3;
    score -= safeNumber(guardrailSummary.watch, 0) * 5;
    score -= safeNumber(guardrailSummary.fail, 0) * 18;
    score +=
        retention.filter(
            (item) =>
                String(item?.state || '')
                    .trim()
                    .toLowerCase() === 'tracked'
        ).length * 1.5;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'elevated-risk';

    const decision = score < 55 ? 'hold' : score < 75 ? 'review' : 'ready';

    return {
        score,
        band,
        decision,
        generatedAt: new Date().toISOString(),
    };
}
