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
    if (normalized === 'ready' || normalized === 'high' || normalized === 'good') {
        return 'ready';
    }
    if (
        ['watch', 'medium', 'mixed', 'stable', 'expanding'].includes(normalized)
    ) {
        return 'warning';
    }
    return 'alert';
}

export function buildTurneroSurfaceRenewalReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const gateBand = toString(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;
    const renewalValueBand = toString(snapshot.renewalValueBand, 'medium');
    const retentionSignal = toString(snapshot.retentionSignal, 'stable');
    const feedbackState = toString(snapshot.feedbackState, 'good');
    const activityState = toString(snapshot.activityState, 'active');
    const pendingCorrections = Math.max(
        0,
        Number(snapshot.pendingCorrections || 0) || 0
    );
    const renewalOwner = toString(snapshot.renewalOwner, '');
    const commercialOwner = toString(snapshot.commercialOwner, '');
    const successOwner = toString(snapshot.successOwner, '');
    const nextRenewalWindow = toString(snapshot.nextRenewalWindow, '');

    return {
        scope: toString(snapshot.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        renewalValueBand,
        retentionSignal,
        feedbackState,
        activityState,
        pendingCorrections,
        renewalOwner,
        commercialOwner,
        successOwner,
        nextRenewalWindow,
        state: gateBand,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'hold-renewal-readiness'),
        summary: toString(
            gate.summary,
            `Renewal ${gateBand} para ${toString(
                snapshot.surfaceLabel,
                snapshot.surfaceKey || 'surface'
            )}`
        ),
        detail: toString(
            gate.detail,
            [
                `value ${renewalValueBand}`,
                `retention ${retentionSignal}`,
                `feedback ${feedbackState}`,
                `activity ${activityState}`,
                `corrections ${pendingCorrections}`,
                `owner ${renewalOwner || 'sin owner'}`,
            ].join(' · ')
        ),
        badge: `${gateBand} · ${gateScore}`,
        chips: [
            {
                label: 'value',
                value: renewalValueBand,
                state: resolveState(renewalValueBand),
            },
            {
                label: 'renewal',
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
