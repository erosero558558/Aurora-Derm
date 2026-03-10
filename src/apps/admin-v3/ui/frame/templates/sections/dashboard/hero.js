export function renderDashboardHeroPanel() {
    return `
        <article class="sony-panel dashboard-hero-panel">
            <div class="dashboard-hero-copy">
                <p class="sony-kicker">Resumen diario</p>
                <h3>Prioridades de hoy</h3>
                <p id="dashboardHeroSummary">
                    Agenda, callbacks y disponibilidad con una lectura mas clara y directa.
                </p>
            </div>
            <div class="dashboard-hero-actions">
                <button type="button" data-action="context-open-appointments-transfer">Ver transferencias</button>
                <button type="button" data-action="context-open-callbacks-pending">Ir a callbacks</button>
                <button type="button" data-action="refresh-admin-data">Actualizar tablero</button>
            </div>
            <div class="dashboard-hero-metrics">
                <div class="dashboard-hero-metric">
                    <span>Rating</span>
                    <strong id="dashboardHeroRating">0.0</strong>
                </div>
                <div class="dashboard-hero-metric">
                    <span>Reseñas 30d</span>
                    <strong id="dashboardHeroRecentReviews">0</strong>
                </div>
                <div class="dashboard-hero-metric">
                    <span>Urgentes SLA</span>
                    <strong id="dashboardHeroUrgentCallbacks">0</strong>
                </div>
                <div class="dashboard-hero-metric">
                    <span>Transferencias</span>
                    <strong id="dashboardHeroPendingTransfers">0</strong>
                </div>
            </div>
        </article>
    `;
}
