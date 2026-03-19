import { toArray, toText } from './turnero-release-control-center.js';

function normalizeDecision(value) {
    return toText(value, 'review').toLowerCase();
}

export function buildTurneroReleaseIntegrationConfidenceScore(input = {}) {
    const contractSummary = input.contractSummary || {
        critical: 0,
        degraded: 0,
        watch: 0,
        all: 0,
    };
    const slaSummary = input.slaSummary || {
        breach: 0,
        watch: 0,
        all: 0,
    };
    const replayQueue = toArray(input.replayQueue);
    const mappingDebt = toArray(input.mappingDebt);
    const bridgeSummary = input.bridgeSummary || {
        degraded: 0,
        watch: 0,
    };
    const releaseDecision = normalizeDecision(input.releaseDecision);

    let score = 100;
    score -= Number(contractSummary.degraded || 0) * 10;
    score -= Number(contractSummary.watch || 0) * 4;
    score -= Number(slaSummary.breach || 0) * 12;
    score -= Number(slaSummary.watch || 0) * 4;
    score -=
        replayQueue.filter(
            (item) => normalizeDecision(item.state || '') !== 'closed'
        ).length * 3;
    score -=
        mappingDebt.filter(
            (item) => normalizeDecision(item.state || '') !== 'closed'
        ).length * 4;
    score -= Number(bridgeSummary.degraded || 0) * 7;
    score -= Number(bridgeSummary.watch || 0) * 3;

    if (releaseDecision === 'hold' || releaseDecision === 'blocked') {
        score -= 14;
    } else if (releaseDecision === 'review') {
        score -= 6;
    }

    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'fragile';

    let decision = score < 55 ? 'hold' : score < 75 ? 'review' : 'ready';
    if (releaseDecision === 'hold' || releaseDecision === 'blocked') {
        decision = 'hold';
    } else if (releaseDecision === 'review' && decision === 'ready') {
        decision = 'review';
    }

    return {
        score,
        band,
        decision,
        releaseDecision,
        summary: `Confidence ${score} | ${band} | ${decision}`,
        generatedAt: new Date().toISOString(),
    };
}
