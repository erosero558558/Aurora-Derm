export function buildTurneroReleaseIntegrationContractRegistry(input = {}) {
    const contracts = Array.isArray(input.contracts) ? input.contracts : [];
    const rows = contracts.map((contract, index) => {
        const freshnessSlaMinutes = Number(contract.freshnessSlaMinutes || 15);
        const version = contract.version || 'v1';
        const criticality = contract.criticality || 'medium';
        const state = String(contract.state || 'active')
            .trim()
            .toLowerCase();

        return {
            id: contract.id || `contract-${index + 1}`,
            label: contract.label || `Integration Contract ${index + 1}`,
            source: contract.source || 'unknown-source',
            target: contract.target || 'unknown-target',
            owner: contract.owner || 'integration',
            version,
            criticality,
            freshnessSlaMinutes,
            state,
        };
    });

    const summary = {
        all: rows.length,
        critical: rows.filter((row) => row.criticality === 'critical').length,
        active: rows.filter((row) => row.state === 'active').length,
        watch: rows.filter((row) => row.state === 'watch').length,
        degraded: rows.filter((row) => row.state === 'degraded').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
