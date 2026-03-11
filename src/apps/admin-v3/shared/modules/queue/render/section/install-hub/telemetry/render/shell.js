import { escapeHtml } from '../../../../../../../ui/render.js';

export function buildSurfaceTelemetryShell({
    cards,
    autoRefresh,
    title,
    summary,
    statusLabel,
    statusState,
}) {
    return `
        <section class="queue-surface-telemetry__shell">
            <div class="queue-surface-telemetry__header">
                <div>
                    <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                    <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(title)}</h5>
                    <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(summary)}</p>
                    <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                        <span id="queueSurfaceTelemetryAutoState" class="queue-surface-telemetry__auto-state" data-state="${escapeHtml(autoRefresh.state)}">${escapeHtml(autoRefresh.label)}</span>
                        <span class="queue-surface-telemetry__auto-copy">${escapeHtml(autoRefresh.meta)}</span>
                    </div>
                </div>
                <span id="queueSurfaceTelemetryStatus" class="queue-surface-telemetry__status" data-state="${escapeHtml(statusState)}">${escapeHtml(statusLabel)}</span>
            </div>
            <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                ${cards
                    .map(
                        (card) => `
                    <article class="queue-surface-card" data-state="${escapeHtml(card.state)}" role="listitem">
                        <div class="queue-surface-card__header">
                            <div>
                                <strong>${escapeHtml(card.title)}</strong>
                                <p class="queue-surface-card__meta">${escapeHtml(card.deviceLabel)}</p>
                            </div>
                            <span class="queue-surface-card__badge">${escapeHtml(card.badge)}</span>
                        </div>
                        <p class="queue-surface-card__summary">${escapeHtml(card.summary)}</p>
                        <p class="queue-surface-card__age">${escapeHtml(card.ageLabel)}</p>
                        <div class="queue-surface-card__chips">${card.chips.map((chip) => `<span class="queue-surface-card__chip">${escapeHtml(chip)}</span>`).join('')}</div>
                        <div class="queue-surface-card__actions">
                            <a href="${escapeHtml(card.route)}" target="_blank" rel="noopener" class="queue-surface-card__action queue-surface-card__action--primary">${escapeHtml(card.actionLabel)}</a>
                            <button type="button" class="queue-surface-card__action" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(card.route)}">Copiar ruta</button>
                            <button type="button" class="queue-surface-card__action" data-action="refresh-admin-data">Actualizar estado</button>
                        </div>
                    </article>
                `
                    )
                    .join('')}
            </div>
        </section>
    `;
}
