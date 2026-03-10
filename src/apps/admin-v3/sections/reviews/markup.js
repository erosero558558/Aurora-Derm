import { escapeHtml, formatDateTime } from '../../shared/ui/render.js';
import { clipCopy, getInitials, getStarLabel } from './helpers.js';

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

export function reviewCard(item, { featured = false } = {}) {
    const rating = Number(item.rating || 0);
    const tone = rating >= 5 ? 'success' : rating <= 3 ? 'danger' : 'neutral';
    const meta =
        rating >= 5
            ? 'Resena de alta confianza'
            : rating <= 3
              ? 'Revisar posible friccion'
              : 'Resena util para contexto';

    return `
        <article class="review-card${featured ? ' is-featured' : ''}" data-rating="${escapeHtml(String(rating))}">
            <header>
                <div class="review-card-heading">
                    <span class="review-avatar">${escapeHtml(
                        getInitials(item.name || 'Anonimo')
                    )}</span>
                    <div>
                        <strong>${escapeHtml(item.name || 'Anonimo')}</strong>
                        <small>${escapeHtml(
                            formatDateTime(item.date || item.createdAt || '')
                        )}</small>
                    </div>
                </div>
                <span class="review-rating-badge" data-tone="${escapeHtml(
                    tone
                )}">${escapeHtml(getStarLabel(rating))}</span>
            </header>
            <p>${escapeHtml(clipCopy(item.comment || item.review || ''))}</p>
            <small>${escapeHtml(meta)}</small>
        </article>
    `;
}

export function renderEmptyReviewsSpotlight() {
    return `
        <div class="reviews-empty-state" data-admin-empty-state="reviews">
            <strong>Sin feedback reciente</strong>
            <p>No hay resenas registradas todavia.</p>
        </div>
    `;
}

export function renderEmptyReviewsGrid() {
    return `
        <div class="reviews-empty-state" data-admin-empty-state="reviews-grid">
            <strong>No hay resenas registradas.</strong>
            <p>Cuando entren comentarios, apareceran aqui con spotlight y lectura editorial.</p>
        </div>
    `;
}

export function renderSpotlightEmpty(summary) {
    return `
        <div class="reviews-empty-state" data-admin-empty-state="reviews-spotlight">
            <strong>Sin spotlight disponible</strong>
            <p>${escapeHtml(summary)}</p>
        </div>
    `;
}

export function renderSpotlightCard(spotlight) {
    const spotlightItem = spotlight.item;

    return `
        <article class="reviews-spotlight-card">
            <div class="reviews-spotlight-top">
                <span class="review-avatar">${escapeHtml(
                    getInitials(spotlightItem.name || 'Anonimo')
                )}</span>
                <div>
                    <small>${escapeHtml(spotlight.eyebrow)}</small>
                    <strong>${escapeHtml(spotlightItem.name || 'Anonimo')}</strong>
                    <small>${escapeHtml(
                        formatDateTime(
                            spotlightItem.date || spotlightItem.createdAt || ''
                        )
                    )}</small>
                </div>
            </div>
            <p class="reviews-spotlight-stars">${escapeHtml(
                getStarLabel(spotlightItem.rating)
            )}</p>
            <p>${escapeHtml(
                clipCopy(
                    spotlightItem.comment || spotlightItem.review || '',
                    320
                )
            )}</p>
            <small>${escapeHtml(spotlight.summary)}</small>
        </article>
    `;
}
