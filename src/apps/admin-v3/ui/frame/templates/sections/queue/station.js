export function renderQueueStationControls() {
    return `
        <div id="queueStationControl" class="toolbar-row queue-station-bar">
            <div class="queue-station-bar__meta">
                <span id="queueStationBadge">Estacion: libre</span>
                <span id="queueStationModeBadge">Modo: free</span>
                <span id="queuePracticeModeBadge" hidden>Practice ON</span>
            </div>
            <div class="queue-station-bar__actions">
                <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Lock C1</button>
                <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Lock C2</button>
                <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>
                <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">1 tecla</button>
                <button type="button" data-action="queue-toggle-shortcuts">Atajos</button>
                <button type="button" data-action="queue-capture-call-key">Calibrar tecla</button>
                <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>
                <button type="button" data-action="queue-start-practice">Iniciar practica</button>
                <button type="button" data-action="queue-stop-practice">Salir practica</button>
                <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Release C1</button>
                <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Release C2</button>
            </div>
        </div>
    `;
}

export function renderQueueShortcutPanel() {
    return `
        <div id="queueShortcutPanel" class="queue-shortcut-panel" hidden>
            <p class="queue-shortcut-panel__eyebrow">Numpad guide</p>
            <div class="queue-shortcut-panel__grid">
                <p><strong>Enter</strong> llama siguiente.</p>
                <p><strong>Decimal</strong> prepara completar.</p>
                <p><strong>Subtract</strong> prepara no_show.</p>
                <p><strong>Add</strong> re-llama el ticket activo.</p>
            </div>
        </div>
    `;
}
