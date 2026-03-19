import { toArray, toText } from './turnero-release-control-center.js';

function normalizeSeverity(value, fallback = 'medium') {
    const severity = toText(value, fallback).toLowerCase();
    if (['critical', 'hold', 'blocked', 'alert', 'severe'].includes(severity)) {
        return 'critical';
    }
    if (['high', 'error', 'red'].includes(severity)) {
        return 'high';
    }
    if (['medium', 'warning', 'review', 'amber', 'watch'].includes(severity)) {
        return 'medium';
    }
    return 'low';
}

function normalizeSignalState(value, severity) {
    const state = toText(value, '').toLowerCase();
    if (
        [
            'closed',
            'done',
            'resolved',
            'complete',
            'completed',
            'ready',
            'healthy',
            'ok',
        ].includes(state)
    ) {
        return 'closed';
    }
    if (state) {
        return state;
    }
    return severity === 'low' ? 'closed' : 'open';
}

function safeKeyPart(value, fallback = 'domain') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return normalized || fallback;
}

export function buildTurneroReleaseSignalBus(input = {}) {
    const domains = toArray(input.domains).filter(
        (domain) => domain && typeof domain === 'object'
    );
    const rows = domains.flatMap((domain, index) => {
        const domainKey = safeKeyPart(
            domain.key || domain.id || domain.domain || `domain-${index + 1}`,
            `domain-${index + 1}`
        );
        const signals = toArray(domain.signals).filter(
            (signal) => signal && typeof signal === 'object'
        );

        return signals.map((signal, signalIndex) => {
            const severity = normalizeSeverity(signal.severity || signal.state);
            const state = normalizeSignalState(
                signal.state || signal.status,
                severity
            );
            return {
                id: `${domainKey}:${signalIndex + 1}`,
                domain: domainKey,
                label: toText(
                    signal.label || signal.key || signal.name,
                    `Signal ${signalIndex + 1}`
                ),
                owner: toText(signal.owner || domain.owner || 'ops', 'ops'),
                severity,
                weight:
                    severity === 'critical'
                        ? 10
                        : severity === 'high'
                          ? 7
                          : severity === 'medium'
                            ? 4
                            : 2,
                state,
                kind: toText(signal.kind || signal.type || 'signal', 'signal'),
            };
        });
    });

    const summary = {
        all: rows.length,
        critical: rows.filter((row) => row.severity === 'critical').length,
        high: rows.filter((row) => row.severity === 'high').length,
        open: rows.filter((row) => row.state !== 'closed').length,
    };

    return {
        rows,
        summary,
        generatedAt: input.generatedAt || new Date().toISOString(),
    };
}
