import { toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseWireCoverageMatrix(input = {}) {
    const surfaces = Array.isArray(input.surfaces) ? input.surfaces : [];
    const inventoryRows = Array.isArray(input.inventoryRows)
        ? input.inventoryRows
        : [];

    const rows = surfaces.map((surface, index) => {
        const wired = Array.isArray(surface.domains)
            ? surface.domains.length
            : 0;
        const expected = inventoryRows.length || Number(surface.expected || 0);
        const coveragePct =
            expected > 0 ? Number(((wired / expected) * 100).toFixed(1)) : 0;
        const state =
            coveragePct >= 90
                ? 'strong'
                : coveragePct >= 70
                  ? 'watch'
                  : 'partial';

        return {
            surfaceId: toText(surface.id || `surface-${index + 1}`),
            label: toText(surface.label || `Surface ${index + 1}`),
            wired,
            expected,
            coveragePct,
            state,
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
