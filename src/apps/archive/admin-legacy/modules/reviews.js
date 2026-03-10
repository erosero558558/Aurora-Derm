import { currentReviews } from './state.js';
import { escapeHtml } from './ui.js';

export function loadReviews() {
    const avgRating =
        currentReviews.length > 0
            ? (
                  currentReviews.reduce(
                      (sum, r) => sum + (Number(r.rating) || 0),
                      0
                  ) / currentReviews.length
              ).toFixed(1)
            : '0.0';

    document.getElementById('adminAvgRating').textContent = avgRating;
    document.getElementById('totalReviewsCount').textContent =
        `${currentReviews.length} reseñas`;

    const starsContainer = document.getElementById('adminRatingStars');
    const fullStars = Math.floor(Number(avgRating));
    starsContainer.innerHTML = '';
    for (let i = 1; i <= 5; i += 1) {
        const star = document.createElement('i');
        star.className = i <= fullStars ? 'fas fa-star' : 'far fa-star';
        starsContainer.appendChild(star);
    }

    const grid = document.getElementById('reviewsGrid');
    if (currentReviews.length === 0) {
        grid.innerHTML =
            '<p class="empty-message">No hay reseñas registradas</p>';
        return;
    }

    grid.innerHTML = currentReviews
        .slice()
        .sort((a, b) =>
            String(b.date || '').localeCompare(String(a.date || ''))
        )
        .map(
            (r) => `
            <div class="review-card-admin">
                <div class="review-header-admin">
                    <strong>${escapeHtml(r.name || 'Paciente')}</strong>
                    ${r.verified ? '<i class="fas fa-check-circle verified review-verified-icon"></i>' : ''}
                </div>
                <div class="review-rating">${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}</div>
                <p>${escapeHtml(r.text || '')}</p>
                <small>${escapeHtml(new Date(r.date).toLocaleDateString('es-EC'))}</small>
            </div>
        `
        )
        .join('');
}
