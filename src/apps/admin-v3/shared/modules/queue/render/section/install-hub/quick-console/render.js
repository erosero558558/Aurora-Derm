import {
    bindQueueQuickConsoleActions,
    renderQueueQuickConsoleActionMarkup,
} from './actions.js';

export function renderQueueQuickConsoleView(manifest, detectedPlatform, deps) {
    const { buildQueueQuickConsole, setHtml, escapeHtml } = deps;
    const root = document.getElementById('queueQuickConsole');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const consoleData = buildQueueQuickConsole(manifest, detectedPlatform);
    setHtml(
        '#queueQuickConsole',
        `
            <section class="queue-quick-console__shell" data-state="${escapeHtml(
                consoleData.tone
            )}">
                <div class="queue-quick-console__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Consola rápida</p>
                        <h5 id="queueQuickConsoleTitle" class="queue-app-card__title">${escapeHtml(
                            consoleData.title
                        )}</h5>
                        <p id="queueQuickConsoleSummary" class="queue-quick-console__summary">${escapeHtml(
                            consoleData.summary
                        )}</p>
                    </div>
                    <div class="queue-quick-console__chips">
                        ${consoleData.chips
                            .map(
                                (chip, index) => `
                                    <span
                                        ${index === 0 ? 'id="queueQuickConsoleChip"' : ''}
                                        class="queue-quick-console__chip"
                                    >
                                        ${escapeHtml(chip)}
                                    </span>
                                `
                            )
                            .join('')}
                    </div>
                </div>
                <div id="queueQuickConsoleActions" class="queue-quick-console__actions">
                    ${consoleData.actions
                        .map((action, index) =>
                            renderQueueQuickConsoleActionMarkup(action, index, {
                                escapeHtml,
                            })
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    bindQueueQuickConsoleActions(manifest, detectedPlatform, deps);
}
