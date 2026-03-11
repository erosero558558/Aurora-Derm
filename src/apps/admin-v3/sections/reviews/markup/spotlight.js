import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import { clipCopy, getInitials, getStarLabel } from '../helpers.js';

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
