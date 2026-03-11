import { SURFACE_TELEMETRY_COPY } from '../../constants.js';

export function buildSurfaceTelemetrySummary(surfaceKey, group) {
    return (
        String(group.summary || '').trim() ||
        SURFACE_TELEMETRY_COPY[surfaceKey]?.emptySummary ||
        'Sin señal todavía.'
    );
}
