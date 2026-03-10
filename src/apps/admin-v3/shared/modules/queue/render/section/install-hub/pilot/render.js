import { escapeHtml, setHtml } from '../../../../../../ui/render.js';
import { buildOpeningChecklistAssist } from '../checklist.js';
import { applyOpeningChecklistSuggestions } from '../state.js';
import { renderQueueOpsPilotAction } from './actions.js';
import { buildQueueOpsPilot } from './model.js';

export function renderQueueOpsPilot(manifest, detectedPlatform, rerenderAll) {
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) return;

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    setHtml(
        '#queueOpsPilot',
        `
        <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
            <div class="queue-ops-pilot__layout">
                <div class="queue-ops-pilot__copy">
                    <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                    <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(pilot.title)}</h5>
                    <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(pilot.summary)}</p>
                    <p class="queue-ops-pilot__support">${escapeHtml(pilot.supportCopy)}</p>
                    <div class="queue-ops-pilot__actions">
                        ${renderQueueOpsPilotAction(pilot.primaryAction, 'primary')}
                        ${renderQueueOpsPilotAction(pilot.secondaryAction, 'secondary')}
                    </div>
                </div>
                <div class="queue-ops-pilot__status">
                    <div class="queue-ops-pilot__progress">
                        <div class="queue-ops-pilot__progress-head">
                            <span>Apertura confirmada</span>
                            <strong id="queueOpsPilotProgressValue">${escapeHtml(`${pilot.confirmedCount}/${pilot.totalSteps}`)}</strong>
                        </div>
                        <div class="queue-ops-pilot__bar" aria-hidden="true">
                            <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                        </div>
                    </div>
                    <div class="queue-ops-pilot__chips">
                        <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">Confirmados ${escapeHtml(String(pilot.confirmedCount))}</span>
                        <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">Sugeridos ${escapeHtml(String(pilot.suggestedCount))}</span>
                        <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3</span>
                        <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">Incidencias ${escapeHtml(String(pilot.issueCount))}</span>
                    </div>
                </div>
            </div>
        </section>
    `
    );

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) return;
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            rerenderAll();
        };
    }
}
