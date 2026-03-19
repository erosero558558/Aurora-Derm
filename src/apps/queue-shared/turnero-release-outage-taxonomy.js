import { toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_CLASSES = Object.freeze({
    health: 'platform-health',
    publicSync: 'public-sync',
    figo: 'clinical-backend',
    shellDrift: 'web-shell',
    fallback: 'config-fallback',
});

function normalizeSeverity(value) {
    const severity = toText(value, 'medium').toLowerCase();
    if (
        ['critical', 'hold', 'blocker', 'blocked', 'alert', 'severe'].includes(
            severity
        )
    ) {
        return 'critical';
    }
    if (['high', 'error', 'red'].includes(severity)) {
        return 'high';
    }
    if (['medium', 'warning', 'review', 'amber'].includes(severity)) {
        return 'medium';
    }
    return 'low';
}

export function buildTurneroReleaseOutageTaxonomy(input = {}) {
    const incidents = toArray(
        input.releaseIncidents ||
            input.incidents ||
            input.riskIncidents ||
            input.assurancePack?.incidents
    );

    const rows = incidents.map((item, index) => {
        const incident = item && typeof item === 'object' ? item : {};
        const kind = toText(
            incident.kind ||
                incident.type ||
                incident.category ||
                incident.code ||
                'generic',
            'generic'
        );
        const severity = normalizeSeverity(
            incident.severity ||
                incident.level ||
                incident.state ||
                incident.status
        );
        const taxonomy = DEFAULT_CLASSES[kind] || 'general-ops';
        const recoveryMode =
            severity === 'critical'
                ? 'rollback_or_failover'
                : severity === 'high'
                  ? 'guided_recovery'
                  : severity === 'medium'
                    ? 'observe_and_recheck'
                    : 'watch_and_recheck';

        return {
            id: toText(incident.id, `incident-${index + 1}`),
            title: toText(incident.title || incident.label || kind, kind),
            kind,
            taxonomy,
            severity,
            recoveryMode,
            owner: toText(incident.owner || 'unassigned', 'unassigned'),
            source: toText(incident.source || 'runtime', 'runtime'),
            note: toText(
                incident.note || incident.detail || incident.summary || '',
                ''
            ),
        };
    });

    return {
        rows,
        counts: {
            critical: rows.filter((row) => row.severity === 'critical').length,
            high: rows.filter((row) => row.severity === 'high').length,
            medium: rows.filter((row) => row.severity === 'medium').length,
            low: rows.filter((row) => row.severity === 'low').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
