import { escapeHtml } from '../../../shared/ui/render.js';

export function buildSummaryRail({
    latestAuthor,
    latestDate,
    recentCount,
    lowRatedCount,
}) {
    return `
        <article class="reviews-rail-card">
            <span>Ultima resena</span>
            <strong>${escapeHtml(latestAuthor)}</strong>
            <small>${escapeHtml(latestDate)}</small>
        </article>
        <article class="reviews-rail-card">
            <span>Cadencia</span>
            <strong>${escapeHtml(String(recentCount))} en 30 dias</strong>
            <small>Volumen reciente de feedback.</small>
        </article>
        <article class="reviews-rail-card">
            <span>Riesgo</span>
            <strong>${escapeHtml(lowRatedCount > 0 ? `${lowRatedCount} por revisar` : 'Sin alertas')}</strong>
            <small>${escapeHtml(lowRatedCount > 0 ? 'Hay comentarios que requieren lectura completa.' : 'La conversacion reciente esta estable.')}</small>
        </article>
    `;
}
