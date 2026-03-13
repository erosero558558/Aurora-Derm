export function renderDashboardOperationsGrid() {
    return `
        <div class="sony-grid sony-grid-three dashboard-operations-grid">
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

            <article class="sony-panel dashboard-card-assistant" id="dashboardAssistantUtility">
                <header>
                    <div>
                        <h3>Utilidad del asistente</h3>
                        <small id="dashboardAssistantMeta">Recepcionista ejecutora en sala</small>
                    </div>
                    <span class="dashboard-signal-chip" id="dashboardAssistantStatus" data-state="neutral">Sin uso</span>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Acciones hoy</span><strong id="dashboardAssistantActioned">0</strong></div>
                    <div><span>Resueltas</span><strong id="dashboardAssistantResolved">0</strong></div>
                    <div><span>Escaladas</span><strong id="dashboardAssistantEscalated">0</strong></div>
                    <div><span>Bloqueos</span><strong id="dashboardAssistantBlocked">0</strong></div>
                </div>
                <p id="dashboardAssistantSummary">Sin actividad del asistente todavia.</p>
                <div class="dashboard-assistant-meta">
                    <p id="dashboardAssistantWindowMeta">7d: 0 sesiones utiles | 0 ms promedio</p>
                    <p id="dashboardAssistantTopIntent">Intent principal: sin datos</p>
                    <p id="dashboardAssistantTopReason">Motivo de apoyo: sin datos</p>
                    <p id="dashboardAssistantTopOutcome">Cierre asistido: sin datos</p>
                </div>
            </article>

            <article class="sony-panel" id="funnelSummary">
                <header>
                    <h3>Herramientas secundarias</h3>
                    <small>Analitica y diagnostico fuera del flujo clinico principal</small>
                </header>
                <p class="dashboard-secondary-summary">
                    Resenas, embudo y diagnostico siguen disponibles, pero ya no compiten con el nucleo interno del consultorio.
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
