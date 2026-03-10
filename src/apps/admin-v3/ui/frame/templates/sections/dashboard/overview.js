export function renderDashboardKpiGrid() {
    return `
        <div class="sony-grid sony-grid-kpi">
            <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>
            <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>
            <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>
            <article class="sony-kpi"><h3>Reseñas</h3><strong id="totalReviewsCount">0</strong></article>
            <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>
            <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>
        </div>
    `;
}

export function renderDashboardOperationsGrid() {
    return `
        <div class="sony-grid sony-grid-two">
            <article class="sony-panel dashboard-card-operations">
                <header>
                    <h3>Centro operativo</h3>
                    <small id="operationDeckMeta">Prioridades y acciones</small>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>
                    <div><span>Callbacks</span><strong id="operationPendingCallbacksCount">0</strong></div>
                    <div><span>Carga hoy</span><strong id="operationTodayLoadCount">0</strong></div>
                </div>
                <p id="operationQueueHealth">Cola: estable</p>
                <div id="operationActionList" class="operations-action-list"></div>
            </article>

            <article class="sony-panel" id="funnelSummary">
                <header><h3>Embudo</h3></header>
                <div class="sony-panel-stats">
                    <div><span>View Booking</span><strong id="funnelViewBooking">0</strong></div>
                    <div><span>Start Checkout</span><strong id="funnelStartCheckout">0</strong></div>
                    <div><span>Booking Confirmed</span><strong id="funnelBookingConfirmed">0</strong></div>
                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>
                </div>
            </article>
        </div>
    `;
}
