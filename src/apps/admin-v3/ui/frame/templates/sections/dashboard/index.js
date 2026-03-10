import { renderDashboardFunnelGrid } from './funnel.js';
import { renderDashboardHeroPanel } from './hero.js';
import {
    renderDashboardKpiGrid,
    renderDashboardOperationsGrid,
} from './overview.js';
import { renderDashboardSignalPanel } from './signal.js';

export function renderDashboardSection() {
    return `
        <section id="dashboard" class="admin-section active" tabindex="-1">
            <div class="dashboard-stage">
                ${renderDashboardHeroPanel()}
                ${renderDashboardSignalPanel()}
            </div>

            ${renderDashboardKpiGrid()}
            ${renderDashboardOperationsGrid()}
            ${renderDashboardFunnelGrid()}
            <div class="sr-only" id="adminAvgRating"></div>
        </section>
    `;
}
