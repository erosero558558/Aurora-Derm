function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toState(value, fallback = 'amber') {
    return (
        String(value || fallback)
            .trim()
            .toLowerCase() || fallback
    );
}

export function buildTurneroReleaseStageGateAuditor(input = {}) {
    const incidents = Array.isArray(input.incidents) ? input.incidents : [];
    const complianceStatus = toState(input.complianceStatus, 'amber');
    const riskGrade =
        String(input.riskGrade || 'B')
            .trim()
            .toUpperCase() || 'B';
    const controlSummary = {
        fail: toNumber(input.controlSummary?.fail, 0),
        watch: toNumber(input.controlSummary?.watch, 0),
    };
    const evidenceTotals = {
        missing: toNumber(input.evidenceTotals?.missing, 0),
        stale: toNumber(input.evidenceTotals?.stale, 0),
    };
    const criticalIncidents = incidents.filter((item) =>
        ['critical', 'alert', 'blocked', 'error'].includes(
            String(item?.severity || item?.state || '')
                .trim()
                .toLowerCase()
        )
    ).length;

    const gates = [
        { key: 'gate-pilot', label: 'Pilot Gate' },
        { key: 'gate-readiness', label: 'Readiness Gate' },
        { key: 'gate-release', label: 'Release Gate' },
    ].map((gate, index) => {
        let state = 'pass';
        if (
            criticalIncidents > 0 ||
            complianceStatus === 'red' ||
            controlSummary.fail > 0 ||
            evidenceTotals.missing > 0
        ) {
            state = 'fail';
        } else if (
            riskGrade === 'C' ||
            riskGrade === 'D' ||
            controlSummary.watch > 1 ||
            evidenceTotals.stale > 0
        ) {
            state = index === 0 ? 'pass' : 'watch';
        }

        return {
            ...gate,
            state,
        };
    });

    return {
        gates,
        generatedAt: new Date().toISOString(),
    };
}
