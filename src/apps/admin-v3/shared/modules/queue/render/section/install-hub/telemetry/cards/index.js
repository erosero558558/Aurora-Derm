import { buildPreparedSurfaceUrl } from '../../manifest.js';
import { ensureInstallPreset } from '../../state.js';
import { formatHeartbeatAge } from '../format.js';
import { getSurfaceTelemetryState } from '../state.js';
import { getSurfaceTelemetryCatalog } from './catalog.js';
import { buildSurfaceTelemetryChips } from './chips.js';
import { buildSurfaceTelemetrySummary } from './summary.js';

function resolveTelemetryBadge(effectiveState) {
    if (effectiveState === 'ready') return 'En vivo';
    if (effectiveState === 'alert') return 'Atender';
    if (effectiveState === 'warning') return 'Revisar';
    return 'Sin señal';
}

function buildSurfaceTelemetryCard(entry, preset) {
    const group = getSurfaceTelemetryState(entry.key);
    const latest =
        group.latest && typeof group.latest === 'object' ? group.latest : null;
    const effectiveState = String(group.status || 'unknown');

    return {
        key: entry.key,
        title: entry.title,
        state: ['ready', 'warning', 'alert'].includes(effectiveState)
            ? effectiveState
            : 'unknown',
        badge: resolveTelemetryBadge(effectiveState),
        deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
        summary: buildSurfaceTelemetrySummary(entry.key, group),
        ageLabel:
            latest && latest.ageSec !== undefined && latest.ageSec !== null
                ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                : 'Sin heartbeat todavía',
        chips: buildSurfaceTelemetryChips(entry.key, latest),
        route: buildPreparedSurfaceUrl(entry.fallbackSurface, entry.appConfig, {
            ...preset,
            surface: entry.fallbackSurface,
        }),
        actionLabel: entry.actionLabel,
    };
}

export function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    return getSurfaceTelemetryCatalog(manifest).map((entry) =>
        buildSurfaceTelemetryCard(entry, preset)
    );
}
