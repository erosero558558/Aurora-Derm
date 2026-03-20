import { asObject, toArray } from './turnero-release-control-center.js';

function normalizeVerdict(value) {
    const verdict = String(value || '')
        .trim()
        .toLowerCase();

    if (['approve', 'approved', 'pass', 'ready', 'ok'].includes(verdict)) {
        return 'approve';
    }

    if (
        [
            'reject',
            'rejected',
            'deny',
            'denied',
            'block',
            'blocked',
            'fail',
        ].includes(verdict)
    ) {
        return 'reject';
    }

    return 'review';
}

export function buildTurneroReleaseRepoDiagnosisDispositionEngine(input = {}) {
    const matrixSummary = asObject(input.matrixSummary);
    const bundleSummary = asObject(input.bundleSummary);
    const signoffs = toArray(input.signoffs);

    const all = Number(matrixSummary.all || 0);
    const supported = Number(matrixSummary.supported || 0);
    const partial = Number(matrixSummary.partial || 0);
    const blocked = Number(matrixSummary.blocked || 0);
    const missing = Number(matrixSummary.missing || 0);
    const bundleAll = Number(bundleSummary.all || 0);
    const bundleReady = Number(bundleSummary.ready || 0);
    const approvals = signoffs.filter(
        (item) => normalizeVerdict(item.verdict) === 'approve'
    ).length;
    const rejects = signoffs.filter(
        (item) => normalizeVerdict(item.verdict) === 'reject'
    ).length;
    const reviews = signoffs.length - approvals - rejects;
    const supportedPct = all > 0 ? (supported / all) * 100 : 0;
    const readyPct = bundleAll > 0 ? (bundleReady / bundleAll) * 100 : 0;
    const approvalPct =
        signoffs.length > 0 ? (approvals / signoffs.length) * 100 : 0;

    let disposition = 'review';
    if (blocked > 0 || missing > 0 || rejects > 0) {
        disposition = 'hold';
    } else if (supportedPct >= 80 && readyPct >= 75 && approvals >= 2) {
        disposition = 'adjudicated-green';
    } else if (supportedPct >= 50 || approvals > 0 || partial > 0) {
        disposition = 'amber-review';
    }

    return {
        supportedPct: Number(supportedPct.toFixed(1)),
        partialPct: Number((all > 0 ? (partial / all) * 100 : 0).toFixed(1)),
        readyPct: Number(readyPct.toFixed(1)),
        approvalPct: Number(approvalPct.toFixed(1)),
        approvals,
        rejects,
        reviews,
        disposition,
        status:
            disposition === 'adjudicated-green'
                ? 'ready'
                : disposition === 'amber-review'
                  ? 'watch'
                  : disposition === 'hold'
                    ? 'blocked'
                    : 'review',
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseRepoDiagnosisDispositionEngine;
