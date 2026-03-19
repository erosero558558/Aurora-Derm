import { toArray, toText } from './turnero-release-control-center.js';

export function buildTurneroReleasePriorityArbiter(input = {}) {
    const signals = toArray(input.signals).filter(
        (signal) => signal && typeof signal === 'object'
    );
    const backlog = toArray(input.backlog).filter(
        (item) => item && typeof item === 'object'
    );

    const rows = signals
        .map((signal) => {
            const backlogPressure = backlog.filter(
                (item) =>
                    toText(item.owner, '') === toText(signal.owner, '') &&
                    toText(item.state || item.status, 'open') !== 'closed'
            ).length;
            const priorityScore = Number(
                (Number(signal.weight || 0) * 10 + backlogPressure * 4).toFixed(
                    1
                )
            );
            const band =
                priorityScore >= 90
                    ? 'P0'
                    : priorityScore >= 65
                      ? 'P1'
                      : priorityScore >= 40
                        ? 'P2'
                        : 'P3';

            return {
                signalId: toText(signal.id, ''),
                label: toText(signal.label, 'Signal'),
                owner: toText(signal.owner, 'ops'),
                priorityScore,
                band,
            };
        })
        .sort((left, right) => right.priorityScore - left.priorityScore);

    return {
        rows,
        top: rows[0] || null,
        generatedAt: input.generatedAt || new Date().toISOString(),
    };
}
