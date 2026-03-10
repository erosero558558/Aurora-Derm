export function renderDashboardSection() {
    return `
        <section id="dashboard" class="admin-section active" tabindex="-1">
            <div class="dashboard-stage">
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
                            <span>Resenas 30d</span>
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

                <article class="sony-panel dashboard-signal-panel">
                    <header>
                        <div>
                            <h3>Señal operativa</h3>
                            <small id="operationRefreshSignal">Tiempo real</small>
                        </div>
                        <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
                    </header>
                    <p id="dashboardLiveMeta">
                        Sin alertas criticas en la operacion actual.
                    </p>
                    <div class="dashboard-signal-stack">
                        <article class="dashboard-signal-card">
                            <span>Push</span>
                            <strong id="dashboardPushStatus">Sin validar</strong>
                            <small id="dashboardPushMeta">Permisos del navegador</small>
                        </article>
                        <article class="dashboard-signal-card">
                            <span>Atencion</span>
                            <strong id="dashboardQueueHealth">Cola: estable</strong>
                            <small id="dashboardFlowStatus">Sin cuellos de botella</small>
                        </article>
                    </div>
                    <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
                </article>
            </div>

            <div class="sony-grid sony-grid-kpi">
                <article class="sony-kpi"><h3>Citas hoy</h3><strong id="todayAppointments">0</strong></article>
                <article class="sony-kpi"><h3>Total citas</h3><strong id="totalAppointments">0</strong></article>
                <article class="sony-kpi"><h3>Callbacks pendientes</h3><strong id="pendingCallbacks">0</strong></article>
                <article class="sony-kpi"><h3>Resenas</h3><strong id="totalReviewsCount">0</strong></article>
                <article class="sony-kpi"><h3>No show</h3><strong id="totalNoShows">0</strong></article>
                <article class="sony-kpi"><h3>Rating</h3><strong id="avgRating">0.0</strong></article>
            </div>

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

            <div class="sony-grid sony-grid-three">
                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>
            </div>
            <div class="sr-only" id="adminAvgRating"></div>
        </section>
    `;
}
