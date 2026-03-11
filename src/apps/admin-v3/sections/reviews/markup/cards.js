import { escapeHtml, formatDateTime } from '../../../shared/ui/render.js';
import { clipCopy, getInitials, getStarLabel } from '../helpers.js';

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
