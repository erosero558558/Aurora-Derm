import { renderAppointmentsSection } from './appointments.js';
import { renderAvailabilitySection } from './availability.js';
import { renderCallbacksSection } from './callbacks.js';
import { renderClinicalHistorySection } from './clinical-history.js';
import { renderDashboardSection } from './dashboard.js';
import { renderQueueSection } from './queue.js';

export function renderAllSections() {
    return `
        ${renderQueueSection()}
        ${renderDashboardSection()}
        ${renderClinicalHistorySection()}
        ${renderAppointmentsSection()}
        ${renderCallbacksSection()}
        ${renderAvailabilitySection()}
    `;
}
