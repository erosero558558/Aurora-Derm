import { getState } from '../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../ui/render.js';

function getSortedReviews(reviews) {
    return reviews
        .slice()
        .sort(
            (a, b) =>
                new Date(b.date || b.createdAt || 0).getTime() -
                new Date(a.date || a.createdAt || 0).getTime()
        );
}

function getStarLabel(rating) {
    const safeRating = Math.max(
        0,
        Math.min(5, Math.round(Number(rating || 0)))
    );
    return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
}

function getInitials(name) {
    const parts = String(name || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (!parts.length) return 'AN';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function getSentimentLabel(avgRating, totalReviews) {
    if (!totalReviews) return 'Sin senal suficiente';
    if (avgRating >= 4.6) return 'Feedback excelente';
    if (avgRating >= 4) return 'Tono solido';
    if (avgRating >= 3) return 'Tono mixto';
    return 'Atencion requerida';
}

function buildSummaryRail(sortedReviews, recentCount) {
    const latestReview = sortedReviews[0];
    const latestDate = latestReview
        ? formatDateTime(latestReview.date || latestReview.createdAt || '')
        : '-';
    const latestAuthor = latestReview
        ? String(latestReview.name || 'Anonimo')
        : 'Sin datos';

    return `
        <article class="reviews-rail-card">
            <span>Ultima resena</span>
            <strong>${escapeHtml(latestAuthor)}</strong>
            <small>${escapeHtml(latestDate)}</small>
        </article>
        <article class="reviews-rail-card">
            <span>Cadencia</span>
            <strong>${escapeHtml(String(recentCount))} en 30 dias</strong>
            <small>Lectura del pulso reciente</small>
        </article>
        <article class="reviews-rail-card">
            <span>Seal premium</span>
            <strong>${escapeHtml(
                sortedReviews.length >= 5
                    ? 'Base consistente'
                    : 'Volumen inicial'
            )}</strong>
            <small>Calidad y recurrencia de comentarios</small>
        </article>
    `;
}

export function renderReviewsSection() {
    const state = getState();
    const reviews = Array.isArray(state.data.reviews) ? state.data.reviews : [];
    const sortedReviews = getSortedReviews(reviews);
    const avgRating = reviews.length
        ? reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0) /
          reviews.length
        : 0;
    const fiveStarCount = reviews.filter(
        (item) => Number(item.rating || 0) >= 5
    ).length;
    const recentCount = reviews.filter((item) => {
        const createdAt = new Date(item.date || item.createdAt || '');
        if (Number.isNaN(createdAt.getTime())) return false;
        return Date.now() - createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    setText('#reviewsAverageRating', avgRating.toFixed(1));
    setText('#reviewsFiveStarCount', fiveStarCount);
    setText('#reviewsRecentCount', recentCount);
    setText('#reviewsTotalCount', reviews.length);
    setText(
        '#reviewsSentimentLabel',
        getSentimentLabel(avgRating, reviews.length)
    );
    setHtml(
        '#reviewsSummaryRail',
        buildSummaryRail(sortedReviews, recentCount)
    );

    if (!reviews.length) {
        setHtml(
            '#reviewsSpotlight',
            `
                <div class="reviews-empty-state">
                    <strong>Sin feedback reciente</strong>
                    <p>No hay resenas registradas todavia.</p>
                </div>
            `
        );
        setHtml(
            '#reviewsGrid',
            `
                <div class="reviews-empty-state">
                    <strong>No hay resenas registradas.</strong>
                    <p>Cuando entren comentarios, apareceran aqui con resumen y spotlight.</p>
                </div>
            `
        );
        return;
    }

    const spotlightReview =
        sortedReviews.find((item) => Number(item.rating || 0) >= 5) ||
        sortedReviews[0];

    setHtml(
        '#reviewsSpotlight',
        `
            <article class="reviews-spotlight-card">
                <div class="reviews-spotlight-top">
                    <span class="review-avatar">${escapeHtml(
                        getInitials(spotlightReview.name || 'Anonimo')
                    )}</span>
                    <div>
                        <strong>${escapeHtml(spotlightReview.name || 'Anonimo')}</strong>
                        <small>${escapeHtml(
                            formatDateTime(
                                spotlightReview.date ||
                                    spotlightReview.createdAt ||
                                    ''
                            )
                        )}</small>
                    </div>
                </div>
                <p class="reviews-spotlight-stars">${escapeHtml(
                    getStarLabel(spotlightReview.rating)
                )}</p>
                <p>${escapeHtml(spotlightReview.comment || spotlightReview.review || '')}</p>
            </article>
        `
    );

    const cards = sortedReviews
        .map((item) => {
            const rating = Number(item.rating || 0);
            return `
                <article class="review-card" data-rating="${escapeHtml(String(rating))}">
                    <header>
                        <div class="review-card-heading">
                            <span class="review-avatar">${escapeHtml(
                                getInitials(item.name || 'Anonimo')
                            )}</span>
                            <div>
                                <strong>${escapeHtml(item.name || 'Anonimo')}</strong>
                                <small>${escapeHtml(
                                    formatDateTime(
                                        item.date || item.createdAt || ''
                                    )
                                )}</small>
                            </div>
                        </div>
                        <span class="review-rating-badge">${escapeHtml(
                            getStarLabel(rating)
                        )}</span>
                    </header>
                    <p>${escapeHtml(item.comment || item.review || '')}</p>
                </article>
            `;
        })
        .join('');

    setHtml('#reviewsGrid', cards);
}
