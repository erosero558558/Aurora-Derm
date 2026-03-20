import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_MAINLINE_SURFACES = Object.freeze([
    {
        id: 'admin-queue',
        key: 'admin-queue',
        label: 'Admin Queue',
        owner: 'deploy',
        route: '/admin.html#queue',
        enabled: true,
        domains: ['admin-queue', 'deployment', 'incidents'],
    },
    {
        id: 'operator-turnos',
        key: 'operator-turnos',
        label: 'Operator Turnos',
        owner: 'ops',
        route: '/operador-turnos.html',
        enabled: true,
        domains: ['operator-turnos', 'service', 'integration'],
    },
    {
        id: 'kiosco-turnos',
        key: 'kiosco-turnos',
        label: 'Kiosco Turnos',
        owner: 'ops',
        route: '/kiosco-turnos.html',
        enabled: true,
        domains: ['kiosco-turnos', 'service', 'integration'],
    },
    {
        id: 'sala-turnos',
        key: 'sala-turnos',
        label: 'Sala Turnos',
        owner: 'deploy',
        route: '/sala-turnos.html',
        enabled: true,
        domains: ['sala-turnos', 'service', 'incidents'],
    },
]);

function normalizeSurface(surface, index) {
    const item = asObject(surface);
    const key = toText(
        item.key || item.id || item.surfaceId || `surface-${index + 1}`,
        `surface-${index + 1}`
    );
    const domains = toArray(item.domains).map((entry) => toText(entry));

    return {
        id: toText(item.id, key),
        key,
        label: toText(item.label, `Surface ${index + 1}`),
        owner: toText(item.owner, 'ops'),
        route: toText(item.route, ''),
        enabled: item.enabled !== false,
        domains: domains.length > 0 ? domains : [key],
    };
}

export function buildTurneroReleaseSurfaceMountAudit(input = {}) {
    const surfaces = toArray(input.surfaces);
    const normalizedSurfaces = (
        surfaces.length > 0 ? surfaces : DEFAULT_MAINLINE_SURFACES
    ).map((surface, index) => normalizeSurface(surface, index));
    const reconciledRows = toArray(input.reconciledRows).map(asObject);

    const rows = normalizedSurfaces.map((surface, index) => {
        const surfaceId = toText(surface.id, `surface-${index + 1}`);
        const relevant = reconciledRows.filter((row) => {
            const rowSurface = toText(
                row.surface ||
                    row.surfaceId ||
                    row.surfaceKey ||
                    row.surfaceName
            );
            return (
                rowSurface === surfaceId ||
                rowSurface === toText(surface.key) ||
                rowSurface === toText(surface.id) ||
                rowSurface === toText(surface.label)
            );
        });
        const reconciled = relevant.filter(
            (row) => row.state === 'reconciled'
        ).length;
        const expected = relevant.length;
        const auditPct =
            expected > 0
                ? Number(((reconciled / expected) * 100).toFixed(1))
                : 0;
        const state =
            auditPct >= 90 ? 'strong' : auditPct >= 60 ? 'watch' : 'partial';

        return {
            ...surface,
            surfaceId,
            expected,
            reconciled,
            auditPct,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            strong: rows.filter((row) => row.state === 'strong').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            partial: rows.filter((row) => row.state === 'partial').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export { DEFAULT_MAINLINE_SURFACES };
