export function renderDashboardOperationsGrid() {
    return `
        <div class="sony-grid sony-grid-two">
            <article class="sony-panel dashboard-card-operations">
                <header>
                    <h3>Siguientes pasos</h3>
                    <small id="operationDeckMeta">Atajos utiles para el dia</small>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>
                    <div><span>Llamadas</span><strong id="operationPendingCallbacksCount">0</strong></div>
                    <div><span>Hoy</span><strong id="operationTodayLoadCount">0</strong></div>
                </div>
                <p id="operationQueueHealth">Sin pendientes urgentes.</p>
                <div id="operationActionList" class="operations-action-list"></div>
            </article>

            <article class="sony-panel" id="funnelSummary">
                <header>
                    <h3>Mas herramientas</h3>
                    <small>Analitica y diagnostico fuera del flujo principal</small>
                </header>
                <p class="dashboard-secondary-summary">
                    Resenas, embudo y turnero avanzado siguen disponibles, pero ya no compiten con la operacion diaria.
                </p>
                <div class="dashboard-secondary-links">
                    <a href="#reviews" class="dashboard-secondary-link" data-section="reviews">Abrir resenas</a>
                    <a href="#queue" class="dashboard-secondary-link" data-section="queue">Turnero avanzado</a>
                </div>
                <div class="sony-panel-stats dashboard-secondary-metrics">
                    <div><span>Reservas</span><strong id="funnelViewBooking">0</strong></div>
                    <div><span>Checkout</span><strong id="funnelStartCheckout">0</strong></div>
                    <div><span>Confirmadas</span><strong id="funnelBookingConfirmed">0</strong></div>
                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>
                </div>
            </article>
        </div>
    `;
}
