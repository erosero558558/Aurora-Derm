export function renderDashboardFunnelGrid() {
    return `
        <details class="sony-panel dashboard-analytics-disclosure" id="dashboardAdvancedAnalytics">
            <summary>
                <span>Analitica avanzada</span>
                <small>Embudo y detalle operativo secundario</small>
            </summary>
            <div class="sony-grid sony-grid-three dashboard-analytics-grid">
                <article class="sony-panel"><h4>Entry</h4><ul id="funnelEntryList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Source</h4><ul id="funnelSourceList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Payment</h4><ul id="funnelPaymentMethodList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Abandono</h4><ul id="funnelAbandonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Motivo</h4><ul id="funnelAbandonReasonList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Paso</h4><ul id="funnelStepList" class="sony-list"></ul></article>
                <article class="sony-panel"><h4>Error</h4><ul id="funnelErrorCodeList" class="sony-list"></ul></article>
            </div>
        </details>
    `;
}
