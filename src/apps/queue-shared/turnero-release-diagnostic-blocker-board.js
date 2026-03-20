import { asObject, toArray, toText } from './turnero-release-control-center.js';

function makeBlocker(kind, owner, severity, count, label) {
    return {
        kind,
        label,
        owner,
        severity,
        count,
        status: 'open',
    };
}

export function buildTurneroReleaseDiagnosticBlockerBoard(input = {}) {
    const reconciled = asObject(input.reconciledSummary || {});
    const runtimeDiff = asObject(input.runtimeDiffSummary || {});
    const branchDelta = toArray(input.branchDelta).map(asObject);

    const blockers = [];
    if ((reconciled.missing || 0) > 0) {
        blockers.push(
            makeBlocker(
                'missing-mainline-evidence',
                'program',
                'high',
                reconciled.missing,
                'Missing mainline evidence'
            )
        );
    }
    if ((reconciled.mountedNoEvidence || 0) > 0) {
        blockers.push(
            makeBlocker(
                'mounted-without-commit-evidence',
                'program',
                'medium',
                reconciled.mountedNoEvidence,
                'Mounted without commit evidence'
            )
        );
    }
    if ((runtimeDiff.drift || 0) > 0) {
        blockers.push(
            makeBlocker(
                'runtime-source-drift',
                'infra',
                'high',
                runtimeDiff.drift,
                'Runtime source drift'
            )
        );
    }

    const openDeltas = branchDelta.filter((item) => {
        const status = toText(item.status || item.state || 'open', 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    }).length;

    if (openDeltas > 0) {
        blockers.push(
            makeBlocker(
                'branch-delta-open',
                'program',
                'medium',
                openDeltas,
                'Open branch deltas'
            )
        );
    }

    return {
        rows: blockers,
        summary: {
            all: blockers.length,
            high: blockers.filter((row) => row.severity === 'high').length,
            medium: blockers.filter((row) => row.severity === 'medium').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
