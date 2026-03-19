import { toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseIntegrationInventory(input = {}) {
    const registryRows = Array.isArray(input.registryRows)
        ? input.registryRows
        : [];
    const surfaces = Array.isArray(input.surfaces) ? input.surfaces : [];

    const rows = registryRows.map((row) => {
        const availableOn = surfaces
            .filter(
                (surface) =>
                    Array.isArray(surface.domains) &&
                    surface.domains.includes(row.key)
            )
            .map((surface) => toText(surface.id || surface.key || 'surface'));

        return {
            key: toText(row.key),
            label: toText(row.label),
            owner: toText(row.owner || 'ops'),
            mounted: Boolean(row.mounted),
            availableOn,
            surfaceCount: availableOn.length,
            readiness:
                row.mounted && availableOn.length > 0
                    ? 'present'
                    : row.mounted
                      ? 'partial'
                      : 'missing',
        };
    });

    const summary = {
        all: rows.length,
        present: rows.filter((row) => row.readiness === 'present').length,
        partial: rows.filter((row) => row.readiness === 'partial').length,
        missing: rows.filter((row) => row.readiness === 'missing').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
