import { escapeHtml } from '../../../shared/ui/render.js';

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
