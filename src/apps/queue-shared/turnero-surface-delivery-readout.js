function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function resolveGateState(band) {
    const normalized = toString(band, 'blocked').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function resolveWindowState(targetWindow, gateBand) {
    if (!toString(targetWindow)) {
        return 'alert';
    }
    return resolveGateState(gateBand);
}

function formatOwnerCoverage(ownerCoverage = {}) {
    return ['delivery', 'release', 'ops']
        .map((role) => {
            const item = ownerCoverage?.[role] || {};
            return `${role}: ${toString(item.actor, 'sin-owner')}`;
        })
        .join(' · ');
}

export function buildTurneroSurfaceDeliveryReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const openDependencyCount = Number(gate.openDependencyCount || 0) || 0;
    const openBlockerCount = Number(gate.openBlockerCount || 0) || 0;
    const ownerCoverage = asObject(gate.ownerCoverage);

    return {
        scope: toString(snapshot.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(snapshot.surfaceLabel, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'watch'),
        targetWindow: toString(snapshot.targetWindow, ''),
        openDependencyCount,
        openBlockerCount,
        ownerCoverage,
        ownerCoverageSummary: formatOwnerCoverage(ownerCoverage),
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'hold-delivery-plan'),
        summary: toString(
            gate.summary,
            `Delivery ${gateBand} para ${toString(
                snapshot.surfaceLabel,
                snapshot.surfaceKey || 'surface'
            )}`
        ),
        detail: toString(
            gate.detail,
            [
                `window ${toString(snapshot.targetWindow, 'sin-ventana')}`,
                `deps ${openDependencyCount}`,
                `blockers ${openBlockerCount}`,
                formatOwnerCoverage(ownerCoverage),
            ].join(' · ')
        ),
        badge: `${gateBand} · ${gateScore}`,
        checkpoints: [
            {
                label: 'window',
                value: toString(snapshot.targetWindow, 'sin-ventana'),
                state: resolveWindowState(snapshot.targetWindow, gateBand),
            },
            {
                label: 'deps',
                value: `${openDependencyCount} deps · ${openBlockerCount} blk`,
                state:
                    openBlockerCount > 0
                        ? 'alert'
                        : openDependencyCount > 0
                          ? 'warning'
                          : 'ready',
            },
            {
                label: 'gate',
                value: `${gateBand} · ${gateScore}`,
                state: resolveGateState(gateBand),
            },
        ],
        chips: [],
        generatedAt: new Date().toISOString(),
    };
}
