export function renderQueueFocusModeView(manifest, detectedPlatform, deps) {
    const {
        buildQueueFocusMode,
        setHtml,
        escapeHtml,
        persistOpsFocusMode,
        getHubRoot,
        renderQueueHubDomainView,
        renderQueueQuickConsole,
        renderQueuePlaybook,
    } = deps;
    const root = document.getElementById('queueFocusMode');
    const hub = getHubRoot();
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    if (hub instanceof HTMLElement) {
        hub.dataset.queueFocus = focus.effectiveMode;
        hub.dataset.queueFocusSource =
            focus.selectedMode === 'auto' ? 'auto' : 'manual';
    }

    setHtml(
        '#queueFocusMode',
        `
            <section class="queue-focus-mode__shell">
                <div class="queue-focus-mode__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Modo foco</p>
                        <h5 id="queueFocusModeTitle" class="queue-app-card__title">${escapeHtml(
                            focus.title
                        )}</h5>
                        <p id="queueFocusModeSummary" class="queue-focus-mode__summary">${escapeHtml(
                            focus.summary
                        )}</p>
                    </div>
                    <div class="queue-focus-mode__meta">
                        <span
                            id="queueFocusModeChip"
                            class="queue-focus-mode__chip"
                            data-state="${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? 'auto'
                                    : 'manual'
                            )}"
                        >
                            ${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? `Auto -> ${focus.suggestedMode}`
                                    : `Manual -> ${focus.effectiveMode}`
                            )}
                        </span>
                        <a
                            id="queueFocusModePrimary"
                            href="${escapeHtml(focus.primaryHref)}"
                            class="queue-focus-mode__primary"
                        >
                            ${escapeHtml(focus.primaryLabel)}
                        </a>
                    </div>
                </div>
                <div class="queue-focus-mode__choices" role="tablist" aria-label="Cambiar foco del hub operativo">
                    <button id="queueFocusModeAuto" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="auto" data-state="${focus.selectedMode === 'auto' ? 'active' : 'idle'}">Auto</button>
                    <button id="queueFocusModeOpening" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="opening" data-state="${focus.selectedMode === 'opening' ? 'active' : 'idle'}">Apertura</button>
                    <button id="queueFocusModeOperations" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="operations" data-state="${focus.selectedMode === 'operations' ? 'active' : 'idle'}">Operación</button>
                    <button id="queueFocusModeIncidents" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="incidents" data-state="${focus.selectedMode === 'incidents' ? 'active' : 'idle'}">Incidencias</button>
                    <button id="queueFocusModeClosing" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="closing" data-state="${focus.selectedMode === 'closing' ? 'active' : 'idle'}">Cierre</button>
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-focus-mode]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistOpsFocusMode(button.dataset.queueFocusMode || 'auto');
            renderQueueFocusModeView(manifest, detectedPlatform, deps);
            if (typeof renderQueueHubDomainView === 'function') {
                renderQueueHubDomainView();
            }
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}
