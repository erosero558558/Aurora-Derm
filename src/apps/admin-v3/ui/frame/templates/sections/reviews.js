export function renderReviewsSection() {
    return `
        <section id="reviews" class="admin-section" tabindex="-1">
            <div class="reviews-stage">
                <article class="sony-panel reviews-summary-panel">
                    <header class="section-header">
                        <div>
                            <h3>Resenas</h3>
                            <p id="reviewsSentimentLabel">Sin senal suficiente</p>
                        </div>
                        <span class="reviews-score-pill" id="reviewsAverageRating">0.0</span>
                    </header>
                    <div class="reviews-summary-grid">
                        <div class="reviews-summary-stat">
                            <span>5 estrellas</span>
                            <strong id="reviewsFiveStarCount">0</strong>
                        </div>
                        <div class="reviews-summary-stat">
                            <span>Ultimos 30 dias</span>
                            <strong id="reviewsRecentCount">0</strong>
                        </div>
                        <div class="reviews-summary-stat">
                            <span>Total</span>
                            <strong id="reviewsTotalCount">0</strong>
                        </div>
                    </div>
                    <div id="reviewsSummaryRail" class="reviews-summary-rail"></div>
                </article>

                <article class="sony-panel reviews-spotlight-panel">
                    <header class="section-header"><h3>Spotlight</h3></header>
                    <div id="reviewsSpotlight" class="reviews-spotlight"></div>
                </article>
            </div>
            <div class="sony-panel">
                <div id="reviewsGrid" class="reviews-grid"></div>
            </div>
        </section>
    `;
}
