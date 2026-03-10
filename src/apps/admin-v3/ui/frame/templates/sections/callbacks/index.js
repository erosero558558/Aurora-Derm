import { renderCallbacksCommandDeck } from './deck.js';
import { renderCallbacksFocusPanel } from './focus.js';
import { renderCallbacksWorkbench } from './workbench.js';

export function renderCallbacksSection() {
    return `
        <section id="callbacks" class="admin-section" tabindex="-1">
            <div class="callbacks-stage">
                ${renderCallbacksCommandDeck()}
                ${renderCallbacksFocusPanel()}
            </div>

            ${renderCallbacksWorkbench()}
        </section>
    `;
}
