import { asObject, toArray, toText } from './turnero-release-control-center.js';

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

function normalizeSurfaceRows(value) {
    return normalizeRows(value, 'surface').map((surface, index) => {
        const key = toText(surface.key, surface.id || `surface-${index + 1}`);
        const domainList = [
            ...toArray(surface.domains).map((entry) => toText(entry)),
            toText(surface.domain),
            key,
        ].filter(Boolean);

        return {
            ...surface,
            id: toText(surface.id, key),
            key,
            label: toText(surface.label, `Surface ${index + 1}`),
            route: toText(surface.route, ''),
            owner: toText(surface.owner, 'ops'),
            enabled: surface.enabled !== false,
            domains: [...new Set(domainList)],
        };
    });
}

function surfaceSupportsRow(surface, row) {
    const domains = toArray(surface.domains)
        .map((entry) => toText(entry))
        .filter(Boolean);

    if (surface.enabled === false) {
        return false;
    }

    return (
        domains.includes(row.domain) ||
        domains.includes(row.key) ||
        domains.includes(surface.key) ||
        domains.includes(surface.id)
    );
}

export function buildTurneroReleaseWiringAuditModel(input = {}) {
    const manifestRows = normalizeRows(input.manifestRows, 'step');
    const surfaces = normalizeSurfaceRows(input.surfaces);

    const rows = manifestRows.map((row) => {
        const requiredSurfaces = toArray(row.requiredSurfaces)
            .map((entry) => toText(entry))
            .filter(Boolean);
        const coverage = requiredSurfaces.map((surfaceId) => {
            const surface =
                surfaces.find(
                    (item) => item.id === surfaceId || item.key === surfaceId
                ) || {};

            return {
                surfaceId,
                present: surfaceSupportsRow(surface, row),
            };
        });
        const presentCount = coverage.filter((entry) => entry.present).length;
        const total = coverage.length;
        const coveragePct =
            total > 0 ? Number(((presentCount / total) * 100).toFixed(1)) : 0;
        const state =
            coveragePct >= 100
                ? 'pass'
                : coveragePct >= 50
                  ? 'partial'
                  : 'missing';

        return {
            stepKey: row.key,
            key: row.key,
            label: row.label,
            domain: row.domain,
            owner: row.owner,
            requiredSurfaces,
            coverage,
            coveragePct,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            pass: rows.filter((row) => row.state === 'pass').length,
            partial: rows.filter((row) => row.state === 'partial').length,
            missing: rows.filter((row) => row.state === 'missing').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseWiringAuditModel;
