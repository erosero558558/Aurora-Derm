import { toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseDuplicateSignalDetector(input = {}) {
    const signals = Array.isArray(input.signals) ? input.signals : [];
    const map = new Map();

    signals.forEach((signal, index) => {
        const domain = toText(signal.domain || 'general');
        const owner = toText(signal.owner || 'ops');
        const label = toText(
            signal.label || signal.key || `Signal ${index + 1}`
        );
        const key = `${domain}::${owner}::${label}`;
        const rows = map.get(key) || [];
        rows.push({
            id: toText(signal.id || `signal-${index + 1}`),
            domain,
            owner,
            label,
            route: toText(signal.route || ''),
        });
        map.set(key, rows);
    });

    const rows = [...map.entries()]
        .filter(([, value]) => value.length > 1)
        .map(([key, value], index) => ({
            id: `dup-${index + 1}`,
            key,
            count: value.length,
            items: value,
            state: value.length >= 3 ? 'high' : 'watch',
        }));

    return {
        rows,
        summary: {
            all: rows.length,
            high: rows.filter((row) => row.state === 'high').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
