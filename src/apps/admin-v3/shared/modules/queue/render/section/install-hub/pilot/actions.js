export function renderQueueOpsPilotActionMarkup(
    action,
    variant = 'secondary',
    deps
) {
    const { escapeHtml } = deps;
    if (!action) {
        return '';
    }

    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button
                ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
                type="button"
                class="${className}"
                ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            >
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a
            ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            target="_blank"
            rel="noopener"
        >
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

export function bindQueueOpsPilotActions(manifest, detectedPlatform, deps) {
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
        renderQueueOpsLog,
    } = deps;
    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (!(applyButton instanceof HTMLButtonElement)) {
        return;
    }

    applyButton.onclick = () => {
        const assist = buildOpeningChecklistAssist(detectedPlatform);
        if (!assist.suggestedIds.length) {
            return;
        }
        applyOpeningChecklistSuggestions(assist.suggestedIds);
        appendOpsLogEntry({
            tone: 'success',
            source: 'opening',
            title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
            summary: `Se confirmaron pasos de apertura ya validados por telemetría. Perfil activo: ${getInstallPresetLabel(
                detectedPlatform
            )}.`,
        });
        renderQueueFocusMode(manifest, detectedPlatform);
        renderQueueQuickConsole(manifest, detectedPlatform);
        renderQueuePlaybook(manifest, detectedPlatform);
        renderQueueOpsPilot(manifest, detectedPlatform);
        renderOpeningChecklist(manifest, detectedPlatform);
        renderQueueOpsLog(manifest, detectedPlatform);
    };
}
