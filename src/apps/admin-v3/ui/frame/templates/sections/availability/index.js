import { renderAvailabilityHeader } from './header.js';
import { renderAvailabilityStatusRow } from './status.js';
import { renderAvailabilityDetailGrid } from './detail.js';

export function renderAvailabilitySection() {
    return `
        <section id="availability" class="admin-section" tabindex="-1">
            <div class="sony-panel availability-container">
                ${renderAvailabilityHeader()}
                ${renderAvailabilityStatusRow()}
                <div id="availabilityCalendar" class="availability-calendar-grid"></div>
                ${renderAvailabilityDetailGrid()}
            </div>
        </section>
    `;
}
