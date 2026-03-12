export function renderQueueQuickConsoleActionMarkup(action, index, deps) {
    const { escapeHtml } = deps;
    const safeId = String(action.id || `queueQuickConsoleAction_${index}`);
    const className =
        action.variant === 'primary'
            ? 'queue-quick-console__action queue-quick-console__action--primary'
            : 'queue-quick-console__action';

    if (action.kind === 'anchor') {
        return `
            <a
                id="${escapeHtml(safeId)}"
                href="${escapeHtml(action.href || '#queue')}"
                class="${className}"
                ${action.external ? 'target="_blank" rel="noopener"' : ''}
            >
                ${escapeHtml(action.label || 'Abrir')}
            </a>
        `;
    }

    return `
        <button
            id="${escapeHtml(safeId)}"
            type="button"
            class="${className}"
            ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            ${action.consultorio ? `data-queue-consultorio="${escapeHtml(String(action.consultorio))}"` : ''}
        >
            ${escapeHtml(action.label || 'Continuar')}
        </button>
    `;
}

export function bindQueueQuickConsoleActions(manifest, detectedPlatform, deps) {
    const {
        buildOpeningChecklistAssist,
        applyOpeningChecklistSuggestions,
        appendOpsLogEntry,
        getInstallPresetLabel,
        renderQueueFocusMode,
        renderQueueQuickConsole,
        renderQueuePlaybook,
        renderQueueOpsPilot,
        renderOpeningChecklist,
        renderShiftHandoff,
        renderQueueOpsLog,
        buildOpsLogIncidentEntry,
        buildShiftHandoffAssist,
        applyShiftHandoffSuggestions,
        copyShiftHandoffSummary,
    } = deps;

    const openingApplyButton = document.getElementById(
        'queueQuickConsoleAction_opening_apply'
    );
    if (openingApplyButton instanceof HTMLButtonElement) {
        openingApplyButton.disabled =
            buildOpeningChecklistAssist(detectedPlatform).suggestedCount <= 0;
        openingApplyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `La consola rápida confirmó sugeridos de apertura. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const incidentButton = document.getElementById(
        'queueQuickConsoleAction_incident_log'
    );
    if (incidentButton instanceof HTMLButtonElement) {
        incidentButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogIncidentEntry(manifest, detectedPlatform)
            );
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const closingApplyButton = document.getElementById(
        'queueQuickConsoleAction_closing_apply'
    );
    if (closingApplyButton instanceof HTMLButtonElement) {
        closingApplyButton.disabled =
            buildShiftHandoffAssist(detectedPlatform).suggestedCount <= 0;
        closingApplyButton.onclick = () => {
            const assist = buildShiftHandoffAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyShiftHandoffSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'handoff',
                title: `Relevo: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary:
                    'La consola rápida confirmó el relevo sugerido del turno.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyHandoffButton = document.getElementById(
        'queueQuickConsoleAction_copy_handoff'
    );
    if (copyHandoffButton instanceof HTMLButtonElement) {
        copyHandoffButton.onclick = () => {
            void copyShiftHandoffSummary(detectedPlatform);
        };
    }
}
