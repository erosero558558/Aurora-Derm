import { getState } from '../core/store.js';
import { escapeHtml, formatDateTime, setHtml } from '../ui/render.js';

export function renderReviewsSection() {
    const state = getState();
    const reviews = Array.isArray(state.data.reviews) ? state.data.reviews : [];

    if (!reviews.length) {
        setHtml('#reviewsGrid', '<p>No hay resenas registradas.</p>');
        return;
    }

    const cards = reviews
        .slice()
        .sort(
            (a, b) =>
                new Date(b.date || b.createdAt || 0).getTime() -
                new Date(a.date || a.createdAt || 0).getTime()
        )
        .map((item) => {
            const rating = Number(item.rating || 0);
            const stars = '★★★★★☆☆☆☆☆'.slice(
                5 - Math.max(0, Math.min(5, rating)),
                10 - Math.max(0, Math.min(5, rating))
            );
            return `
                <article class="review-card">
                    <header><strong>${escapeHtml(item.name || 'Anonimo')}</strong><span>${stars}</span></header>
                    <p>${escapeHtml(item.comment || item.review || '')}</p>
                    <small>${escapeHtml(formatDateTime(item.date || item.createdAt || ''))}</small>
                </article>
            `;
        })
        .join('');

    setHtml('#reviewsGrid', cards);
}
