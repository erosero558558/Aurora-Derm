import { toArray, toText } from './turnero-release-control-center.js';

function normalizeSeverity(value) {
    const severity = toText(value, 'info').toLowerCase();
    if (
        ['blocker', 'critical', 'alert', 'error', 'blocked'].includes(severity)
    ) {
        return 'blocker';
    }
    if (
        ['high', 'warning', 'watch', 'pending', 'pending_review'].includes(
            severity
        )
    ) {
        return 'warning';
    }
    return 'info';
}

function hasDisplayClinicalSurface(rows) {
    return toArray(rows).some((row) => {
        const classification = String(row?.classification || '')
            .trim()
            .toLowerCase();
        const label = String(row?.label || row?.flow || '')
            .trim()
            .toLowerCase();
        return (
            classification === 'clinical-sensitive' &&
            (label.includes('display') || label.includes('sala'))
        );
    });
}

export function buildTurneroReleaseClinicalSafetyGuardrails(input = {}) {
    const incidents = toArray(input.incidents).map((incident) => ({
        ...incident,
        severity: normalizeSeverity(
            incident?.severity ||
                incident?.state ||
                incident?.tone ||
                incident?.status
        ),
    }));
    const surfaces = toArray(input.sensitiveSurfaces);
    const obligations = toArray(input.obligations);
    const accessReviews = toArray(input.accessReviews);
    const retention = toArray(input.retention);
    const openObligations = obligations.filter(
        (item) =>
            String(item?.status || '')
                .trim()
                .toLowerCase() !== 'closed'
    );
    const pendingAccessReviews = accessReviews.filter(
        (item) =>
            String(item?.status || '')
                .trim()
                .toLowerCase() !== 'approved'
    );
    const retentionGaps = retention.filter((item) => {
        const state = String(item?.state || '')
            .trim()
            .toLowerCase();
        return (
            state &&
            !['tracked', 'disposed', 'archived', 'closed'].includes(state)
        );
    });
    const hasFailingIncident = incidents.some(
        (incident) => incident.severity === 'blocker'
    );
    const hasWatchingIncident = incidents.some(
        (incident) => incident.severity === 'warning'
    );

    const guardrails = [
        {
            key: 'display-min-data',
            label: 'Display y sala sin datos clínicos innecesarios',
            state: hasDisplayClinicalSurface(surfaces) ? 'watch' : 'pass',
            detail: hasDisplayClinicalSurface(surfaces)
                ? 'Existe al menos una superficie clínica sensible visible en display/sala.'
                : 'No hay superficies clínicas sensibles visibles en display/sala.',
        },
        {
            key: 'operator-least-privilege',
            label: 'Acceso mínimo necesario en operaciones de clínica',
            state:
                openObligations.length +
                    pendingAccessReviews.length +
                    retentionGaps.length >
                2
                    ? 'watch'
                    : 'pass',
            detail: `${openObligations.length} obligación(es) abiertas · ${pendingAccessReviews.length} revisión(es) pendientes · ${retentionGaps.length} brecha(s) de retención`,
        },
        {
            key: 'clinical-fallback-safety',
            label: 'Fallback operativo sin incidentes bloqueantes',
            state: hasFailingIncident
                ? 'fail'
                : hasWatchingIncident
                  ? 'watch'
                  : 'pass',
            detail: hasFailingIncident
                ? 'Hay incidentes blocker/critical en el journal.'
                : hasWatchingIncident
                  ? 'Hay incidentes warning/high en el journal.'
                  : 'No hay incidentes bloqueantes en el journal.',
        },
    ];

    const summary = {
        all: guardrails.length,
        pass: guardrails.filter((item) => item.state === 'pass').length,
        watch: guardrails.filter((item) => item.state === 'watch').length,
        fail: guardrails.filter((item) => item.state === 'fail').length,
    };

    return {
        guardrails,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
