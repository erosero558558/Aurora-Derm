export function buildTurneroReleaseBridgeObservabilityPack(input = {}) {
    const bridgeSignals = Array.isArray(input.bridgeSignals)
        ? input.bridgeSignals
        : [];
    const rows = bridgeSignals.map((signal, index) => {
        const latencyMs = Number(signal.latencyMs || 0);
        const errorRate = Number(signal.errorRate || 0);
        const freshnessLag = Number(signal.freshnessLag || 0);
        const state =
            errorRate > 5 || latencyMs > 2500 || freshnessLag > 30
                ? 'degraded'
                : errorRate > 2 || latencyMs > 1200 || freshnessLag > 15
                  ? 'watch'
                  : 'healthy';

        return {
            id: signal.id || `bridge-${index + 1}`,
            label: signal.label || `Bridge Signal ${index + 1}`,
            latencyMs,
            errorRate,
            freshnessLag,
            state,
        };
    });

    const summary = {
        all: rows.length,
        healthy: rows.filter((row) => row.state === 'healthy').length,
        watch: rows.filter((row) => row.state === 'watch').length,
        degraded: rows.filter((row) => row.state === 'degraded').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
