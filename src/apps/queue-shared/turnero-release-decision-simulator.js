export function buildTurneroReleaseDecisionSimulator(input = {}) {
    const twins = Array.isArray(input.twins) ? input.twins : [];
    const forecastRegional = Number(input.forecastRegional || 0);
    const strategies = [
        {
            key: 'controlled_rollout',
            label: 'Controlled rollout',
            risk: 28,
            speed: 58,
        },
        {
            key: 'aggressive_scale',
            label: 'Aggressive scale',
            risk: 62,
            speed: 88,
        },
        {
            key: 'stabilize_then_expand',
            label: 'Stabilize then expand',
            risk: 18,
            speed: 42,
        },
    ];

    const rows = strategies.map((strategy) => {
        const readyClinics = twins.filter(
            (item) => item.state === 'scale-ready'
        ).length;
        const operationalClinics = twins.filter((item) =>
            ['scale-ready', 'operational'].includes(item.state)
        ).length;
        const confidence = Number(
            (
                operationalClinics * 8 +
                readyClinics * 10 +
                Math.max(0, 100 - strategy.risk) * 0.35 +
                strategy.speed * 0.25 +
                Math.max(0, 100 - forecastRegional / 60) * 0.2
            ).toFixed(1)
        );
        const decision =
            confidence >= 85 ? 'promote' : confidence >= 70 ? 'review' : 'hold';

        return {
            ...strategy,
            readyClinics,
            operationalClinics,
            confidence,
            decision,
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
