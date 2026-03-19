export function buildTurneroReleaseSyncSlaMonitor(input = {}) {
    const contracts = Array.isArray(input.contracts) ? input.contracts : [];
    const healthSignals = Array.isArray(input.healthSignals)
        ? input.healthSignals
        : [];

    const rows = contracts.map((contract, index) => {
        const freshnessSlaMinutes = Number(contract.freshnessSlaMinutes || 15);
        const signal =
            healthSignals.find((item) => item.contractId === contract.id) || {};
        const lagMinutes = Number(signal.lagMinutes || 0);
        const successRate = Number(signal.successRate || 100);
        const state =
            lagMinutes > freshnessSlaMinutes * 2 || successRate < 80
                ? 'breach'
                : lagMinutes > freshnessSlaMinutes || successRate < 92
                  ? 'watch'
                  : 'healthy';

        return {
            contractId: contract.id || `contract-${index + 1}`,
            label: contract.label || `Contract ${index + 1}`,
            freshnessSlaMinutes,
            lagMinutes,
            successRate,
            state,
        };
    });

    const summary = {
        all: rows.length,
        healthy: rows.filter((row) => row.state === 'healthy').length,
        watch: rows.filter((row) => row.state === 'watch').length,
        breach: rows.filter((row) => row.state === 'breach').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
