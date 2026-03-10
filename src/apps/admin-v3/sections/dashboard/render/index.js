import { setHtml } from '../../../shared/ui/render.js';
import {
    buildAttentionItems,
    buildOperations,
} from '../markup.js';
import { getDashboardDerivedState } from '../state.js';
import { setFlowMetrics } from './flow.js';
import { setFunnelMetrics } from './funnel.js';
import { setLiveStatus } from './live.js';
import { setOverviewMetrics } from './overview.js';

export function renderDashboard(state) {
    const dashboardState = getDashboardDerivedState(state);

    setOverviewMetrics(dashboardState);
    setLiveStatus(dashboardState);
    setFlowMetrics(dashboardState);
    setHtml('#operationActionList', buildOperations(dashboardState));
    setHtml('#dashboardAttentionList', buildAttentionItems(dashboardState));
    setFunnelMetrics(dashboardState.funnel);
}
