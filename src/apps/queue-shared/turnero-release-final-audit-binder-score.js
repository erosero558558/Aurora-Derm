import { asObject, toArray } from './turnero-release-control-center.js';

function normalizeDisposition(input = {}) {
    if (typeof input === 'string') {
        return { disposition: input };
    }

    return asObject(input);
}

export function buildTurneroReleaseFinalAuditBinderScore(input = {}) {
    const matrixSummary = asObject(input.matrixSummary);
    const disposition = normalizeDisposition(input.disposition);
    const signoffs = toArray(input.signoffs);

    const all = Number(matrixSummary.all || 0);
    const supported = Number(matrixSummary.supported || 0);
    const readyPct = Number(
        asObject(input.disposition).readyPct || disposition.readyPct || 0
    );
    const supportedPct = all > 0 ? (supported / all) * 100 : 0;
    const approvalPct =
        signoffs.length > 0
            ? (signoffs.filter((item) => item.verdict === 'approve').length /
                  signoffs.length) *
              100
            : 0;
    const dispositionWeight =
        disposition.disposition === 'adjudicated-green'
            ? 100
            : disposition.disposition === 'amber-review'
              ? 72
              : disposition.disposition === 'hold'
                ? 24
                : 42;

    let score =
        supportedPct * 0.45 +
        readyPct * 0.25 +
        approvalPct * 0.2 +
        dispositionWeight * 0.1;

    if (!Number.isFinite(score)) {
        score = 0;
    }

    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'ready'
            : score >= 75
              ? 'near-ready'
              : score >= 60
                ? 'review'
                : 'blocked';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'deliver-final-binder'
                : band === 'near-ready'
                  ? 'collect-last-review'
                  : 'hold-binder',
        supportedPct: Number(supportedPct.toFixed(1)),
        approvalPct: Number(approvalPct.toFixed(1)),
        readyPct: Number(readyPct.toFixed(1)),
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalAuditBinderScore;
