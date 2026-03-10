import {
    renderAppointmentsCommandDeck,
    renderAppointmentsFocusPanel,
} from './deck.js';
import { renderAppointmentsWorkbench } from './workbench.js';

export function renderAppointmentsSection() {
    return `
        <section id="appointments" class="admin-section" tabindex="-1">
            <div class="appointments-stage">
                ${renderAppointmentsCommandDeck()}
                ${renderAppointmentsFocusPanel()}
            </div>

            ${renderAppointmentsWorkbench()}
        </section>
    `;
}
