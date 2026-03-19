import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_STEPS = Object.freeze([
    {
        key: 'queue-core',
        label: 'Queue Core',
        owner: 'ops',
        domain: 'service',
        requiredSurfaces: ['admin', 'operator', 'kiosk', 'display'],
    },
    {
        key: 'remote-readiness',
        label: 'Remote Readiness',
        owner: 'infra',
        domain: 'integration',
        requiredSurfaces: ['admin', 'operator', 'display'],
    },
    {
        key: 'release-governance',
        label: 'Release Governance',
        owner: 'program',
        domain: 'governance',
        requiredSurfaces: ['admin'],
    },
    {
        key: 'assurance',
        label: 'Assurance',
        owner: 'program',
        domain: 'assurance',
        requiredSurfaces: ['admin', 'operator'],
    },
    {
        key: 'reliability',
        label: 'Reliability',
        owner: 'infra',
        domain: 'reliability',
        requiredSurfaces: ['operator', 'display'],
    },
    {
        key: 'privacy',
        label: 'Safety Privacy',
        owner: 'governance',
        domain: 'privacy',
        requiredSurfaces: ['admin', 'kiosk'],
    },
    {
        key: 'telemetry',
        label: 'Telemetry',
        owner: 'ops',
        domain: 'telemetry',
        requiredSurfaces: ['admin', 'operator'],
    },
    {
        key: 'strategy',
        label: 'Strategy',
        owner: 'program',
        domain: 'strategy',
        requiredSurfaces: ['admin'],
    },
    {
        key: 'orchestration',
        label: 'Orchestration',
        owner: 'ops',
        domain: 'orchestration',
        requiredSurfaces: ['admin', 'display'],
    },
]);

function normalizeRows(value, fallbackPrefix = 'row') {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item, index) => {
            const row = asObject(item);
            const fallbackId = `${fallbackPrefix}-${index + 1}`;
            const id = toText(row.id || row.key, fallbackId);

            return {
                ...row,
                id,
                key: toText(row.key, id),
            };
        });
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry], index) => {
                const row = asObject(entry);
                const fallbackId = `${fallbackPrefix}-${index + 1}`;
                const id = toText(row.id || row.key || key, fallbackId);

                return {
                    ...row,
                    id,
                    key: toText(row.key, id),
                };
            });
    }

    return [];
}

function normalizeRequiredSurfaces(value) {
    const rows = toArray(value)
        .map((entry) => toText(entry))
        .filter(Boolean);

    return rows.length ? [...new Set(rows)] : ['admin'];
}

export function buildTurneroReleaseStepManifest(input = {}) {
    const sourceSteps = normalizeRows(input.steps, 'step');
    const steps = sourceSteps.length ? sourceSteps : DEFAULT_STEPS;
    const rows = steps.map((step, index) => {
        const item = asObject(step);
        const fallbackId = `step-${index + 1}`;
        const id = toText(item.id || item.key, fallbackId);
        const key = toText(item.key, id);
        const label = toText(item.label, `Step ${index + 1}`);
        const owner = toText(item.owner, 'ops');
        const domain = toText(item.domain, 'general');

        return {
            id,
            key,
            label,
            owner,
            domain,
            requiredSurfaces: normalizeRequiredSurfaces(item.requiredSurfaces),
        };
    });

    const surfaceCount = [
        ...new Set(rows.flatMap((row) => row.requiredSurfaces)),
    ].length;
    const domainCount = [
        ...new Set(rows.map((row) => row.domain).filter(Boolean)),
    ].length;

    return {
        rows,
        summary: {
            all: rows.length,
            surfaces: surfaceCount,
            domains: domainCount,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseStepManifest;
