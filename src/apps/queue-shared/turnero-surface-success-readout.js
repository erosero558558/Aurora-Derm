function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function resolveState(state) {
    const normalized = toString(state, 'watch').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch' || normalized === 'mixed') {
        return 'warning';
    }
    return 'alert';
}

export function buildTurneroSurfaceSuccessReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const gateBand = toString(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;
    const adoptionState = toString(snapshot.adoptionState, 'watch');
    const incidentRateBand = toString(snapshot.incidentRateBand, 'low');
    const feedbackState = toString(snapshot.feedbackState, 'good');
    const successOwner = toString(snapshot.successOwner, '');
    const followupWindow = toString(snapshot.followupWindow, '');

    return {
        scope: toString(snapshot.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        adoptionState,
        incidentRateBand,
        feedbackState,
        successOwner,
        followupWindow,
        state: gateBand,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'hold-success-readiness'),
        summary: toString(
            gate.summary,
            `Success ${gateBand} para ${toString(
                snapshot.surfaceLabel,
                snapshot.surfaceKey || 'surface'
            )}`
        ),
        detail: toString(
            gate.detail,
            [
                `adoption ${adoptionState}`,
                `incident ${incidentRateBand}`,
                `feedback ${feedbackState}`,
                `owner ${successOwner || 'sin owner'}`,
                `follow-up ${followupWindow || 'sin ventana'}`,
            ].join(' · ')
        ),
        badge: `${gateBand} · ${gateScore}`,
        chips: [
            {
                label: 'adoption',
                value: adoptionState,
                state: resolveState(adoptionState),
            },
            {
                label: 'success',
                value: gateBand,
                state: resolveState(gateBand),
            },
            {
                label: 'score',
                value: String(gateScore),
                state: resolveState(gateBand),
            },
        ],
        generatedAt: new Date().toISOString(),
    };
}
