export function renderDashboardHeroPanel() {
    return `
        <article class="sony-panel dashboard-hero-panel">
            <div class="dashboard-hero-copy">
                <p class="sony-kicker">Recepcion/Admin</p>
                <h3>Inicio operativo</h3>
                <p id="dashboardHeroSummary">
                    Agenda, pendientes y horarios en un solo frente simple para el equipo.
                </p>
            </div>
            <div class="dashboard-hero-actions">
                <button type="button" data-action="context-open-appointments-overview">Ver agenda</button>
                <button type="button" data-action="context-open-callbacks-pending">Revisar pendientes</button>
            </div>
            <div class="dashboard-home-grid">
                <article class="dashboard-home-card" id="opsTodaySummaryCard">
                    <span>Pacientes hoy</span>
                    <strong id="opsTodayCount">0</strong>
                    <small id="opsTodayMeta">Sin agenda inmediata</small>
                    <button type="button" data-action="context-open-appointments-overview">Abrir agenda</button>
                </article>
                <article class="dashboard-home-card" id="opsPendingSummaryCard">
                    <span>Pendientes</span>
                    <strong id="opsPendingCount">0</strong>
                    <small id="opsPendingMeta">Sin seguimiento pendiente</small>
                    <button type="button" data-action="context-open-callbacks-pending">Ver pendientes</button>
                </article>
                <article class="dashboard-home-card" id="opsAvailabilitySummaryCard">
                    <span>Horarios</span>
                    <strong id="opsAvailabilityCount">0</strong>
                    <small id="opsAvailabilityMeta">Sin horarios publicados</small>
                    <button type="button" data-action="context-open-availability">Abrir horarios</button>
                </article>
            </div>
        </article>
    `;
}
