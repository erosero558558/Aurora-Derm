import { toArray, toText } from './turnero-release-control-center.js';

function normalizeRouteLane(severity) {
    const normalized = toText(severity, 'medium').toLowerCase();
    if (normalized === 'critical') {
        return 'immediate';
    }
    if (normalized === 'high') {
        return 'priority';
    }
    if (normalized === 'medium') {
        return 'scheduled';
    }
    return 'observe';
}

function normalizeRouteOwner(signal) {
    const domain = toText(signal.domain, '').toLowerCase();
    if (['privacy', 'security'].includes(domain)) {
        return 'governance';
    }
    if (['integration', 'reliability'].includes(domain)) {
        return 'infra';
    }
    if (['service', 'telemetry'].includes(domain)) {
        return 'ops';
    }
    if (['strategy', 'governance', 'memory'].includes(domain)) {
        return 'program';
    }
    return toText(signal.owner, 'ops');
}

export function buildTurneroReleasePolicyRouter(input = {}) {
    const signals = toArray(input.signals).filter(
        (signal) => signal && typeof signal === 'object'
    );

    const rows = signals.map((signal) => {
        const lane = normalizeRouteLane(signal.severity);
        return {
            signalId: toText(signal.id, ''),
            label: toText(signal.label, 'Signal'),
            domain: toText(signal.domain, 'general'),
            owner: normalizeRouteOwner(signal),
            lane,
            route:
                lane === 'immediate'
                    ? 'war-room'
                    : lane === 'priority'
                      ? 'owner-workbench'
                      : lane === 'scheduled'
                        ? 'backlog'
                        : 'monitor',
        };
    });

    return {
        rows,
        generatedAt: input.generatedAt || new Date().toISOString(),
    };
}
