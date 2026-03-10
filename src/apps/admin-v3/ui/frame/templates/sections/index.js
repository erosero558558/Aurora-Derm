import { renderAppointmentsSection } from './appointments.js';
import { renderAvailabilitySection } from './availability.js';
import { renderCallbacksSection } from './callbacks.js';
import { renderDashboardSection } from './dashboard.js';
import { renderQueueSection } from './queue.js';
import { renderReviewsSection } from './reviews.js';

export function renderAllSections() {
    return `
        ${renderDashboardSection()}
        ${renderAppointmentsSection()}
        ${renderCallbacksSection()}
        ${renderReviewsSection()}
        ${renderAvailabilitySection()}
        ${renderQueueSection()}
    `;
}
