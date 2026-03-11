import { setHtml } from '../../../../../../../ui/render.js';
import { buildSurfaceTelemetryCards } from '../cards.js';
import { buildSurfaceTelemetryAutoRefreshMeta } from './auto-refresh.js';
import { buildSurfaceTelemetryShell } from './shell.js';
import { buildSurfaceTelemetrySummary } from './summary.js';

export function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) return;

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const summary = buildSurfaceTelemetrySummary(cards);

    setHtml(
        '#queueSurfaceTelemetry',
        buildSurfaceTelemetryShell({
            cards,
            autoRefresh,
            ...summary,
        })
    );
}
