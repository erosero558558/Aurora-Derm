export function buildTurneroReleaseDataExchangeMap(input = {}) {
    const exchanges = Array.isArray(input.exchanges) ? input.exchanges : [];
    const rows = exchanges.map((exchange, index) => {
        const payloadClass = exchange.payloadClass || 'operational';
        const direction = String(exchange.direction || 'bidirectional')
            .trim()
            .toLowerCase();
        const sensitivity =
            payloadClass === 'clinical-sensitive'
                ? 95
                : payloadClass === 'personal-operational'
                  ? 75
                  : payloadClass === 'operational'
                    ? 45
                    : 20;

        return {
            id: exchange.id || `exchange-${index + 1}`,
            label: exchange.label || `Exchange ${index + 1}`,
            source: exchange.source || 'unknown-source',
            target: exchange.target || 'unknown-target',
            direction,
            payloadClass,
            sensitivity,
            owner: exchange.owner || 'integration',
        };
    });

    const summary = {
        all: rows.length,
        bidirectional: rows.filter((row) => row.direction === 'bidirectional')
            .length,
        sensitive: rows.filter((row) => row.sensitivity >= 75).length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
