export function renderQueuePlaybookView(manifest, detectedPlatform, deps) {
    const {
        setHtml,
        escapeHtml,
        buildQueuePlaybook,
        buildQueuePlaybookAssist,
        setOpsPlaybookStep,
        appendOpsLogEntry,
        renderQueuePlaybook,
        renderQueueOpsLog,
        copyQueuePlaybookReport,
        resetOpsPlaybookMode,
    } = deps;
    const root = document.getElementById('queuePlaybook');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    setHtml(
        '#queuePlaybook',
        `
            <section class="queue-playbook__shell" data-state="${escapeHtml(
                playbook.mode
            )}">
                <div class="queue-playbook__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Playbook activo</p>
                        <h5 id="queuePlaybookTitle" class="queue-app-card__title">${escapeHtml(
                            playbook.title
                        )}</h5>
                        <p id="queuePlaybookSummary" class="queue-playbook__summary">${escapeHtml(
                            playbook.summary
                        )}</p>
                    </div>
                    <div class="queue-playbook__meta">
                        <span
                            id="queuePlaybookChip"
                            class="queue-playbook__chip"
                            data-state="${playbook.completedCount >= playbook.totalSteps ? 'ready' : 'active'}"
                        >
                            ${escapeHtml(
                                playbook.completedCount >= playbook.totalSteps
                                    ? 'Secuencia completa'
                                    : `Paso ${Math.min(playbook.completedCount + 1, playbook.totalSteps)}/${playbook.totalSteps}`
                            )}
                        </span>
                        <span
                            id="queuePlaybookAssistChip"
                            class="queue-playbook__assist"
                            data-state="${assist.suggestedCount > 0 ? 'suggested' : playbook.completedCount >= playbook.totalSteps ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                assist.suggestedCount > 0
                                    ? `Sugeridos ${assist.suggestedCount}`
                                    : playbook.completedCount >=
                                        playbook.totalSteps
                                      ? 'Rutina completa'
                                      : 'Sin sugeridos'
                            )}
                        </span>
                        <button
                            id="queuePlaybookApplyBtn"
                            type="button"
                            class="queue-playbook__action queue-playbook__action--primary"
                            ${playbook.nextStep ? '' : 'disabled'}
                        >
                            ${playbook.nextStep ? `Marcar: ${playbook.nextStep.title}` : 'Sin pasos pendientes'}
                        </button>
                        <button
                            id="queuePlaybookAssistBtn"
                            type="button"
                            class="queue-playbook__action"
                            ${assist.suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${assist.suggestedCount > 0 ? `Confirmar sugeridos (${assist.suggestedCount})` : 'Sin sugeridos ahora'}
                        </button>
                        <button id="queuePlaybookCopyBtn" type="button" class="queue-playbook__action">
                            Copiar secuencia
                        </button>
                        <button id="queuePlaybookResetBtn" type="button" class="queue-playbook__action">
                            Reiniciar playbook
                        </button>
                    </div>
                </div>
                <div id="queuePlaybookSteps" class="queue-playbook__steps" role="list" aria-label="Secuencia operativa por foco">
                    ${playbook.steps
                        .map((step) => {
                            const done = Boolean(playbook.modeState[step.id]);
                            const isCurrent =
                                !done &&
                                playbook.nextStep &&
                                playbook.nextStep.id === step.id;
                            const isSuggested =
                                !done &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = done
                                ? 'ready'
                                : isCurrent
                                  ? 'current'
                                  : isSuggested
                                    ? 'suggested'
                                    : 'pending';
                            return `
                                <article class="queue-playbook__step" data-state="${stepState}" role="listitem">
                                    <div class="queue-playbook__step-head">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p>${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-playbook__step-state">${escapeHtml(
                                            done
                                                ? 'Hecho'
                                                : isCurrent
                                                  ? 'Actual'
                                                  : isSuggested
                                                    ? 'Sugerido'
                                                    : 'Pendiente'
                                        )}</span>
                                    </div>
                                    <p class="queue-playbook__step-note">${escapeHtml(
                                        assist.suggestions[step.id]?.reason ||
                                            step.detail
                                    )}</p>
                                    <div class="queue-playbook__step-actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            class="queue-playbook__step-primary"
                                            ${String(step.href || '').startsWith('#') ? '' : 'target="_blank" rel="noopener"'}
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queuePlaybookToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-playbook__step-toggle"
                                            data-queue-playbook-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${done ? 'Marcar pendiente' : 'Marcar hecho'}
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queuePlaybookApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!playbook.nextStep) {
                return;
            }
            setOpsPlaybookStep(playbook.mode, playbook.nextStep.id, true);
            appendOpsLogEntry({
                tone: 'info',
                source: 'status',
                title: `Playbook ${playbook.mode}: paso confirmado`,
                summary: `${playbook.nextStep.title} quedó marcado como hecho desde el playbook activo.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const assistButton = document.getElementById('queuePlaybookAssistBtn');
    if (assistButton instanceof HTMLButtonElement) {
        assistButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            assist.suggestedIds.forEach((stepId) => {
                setOpsPlaybookStep(playbook.mode, stepId, true);
            });
            appendOpsLogEntry({
                tone: 'success',
                source: 'status',
                title: `Playbook ${playbook.mode}: sugeridos confirmados`,
                summary: `Se confirmaron ${assist.suggestedIds.length} paso(s) sugeridos por señales del sistema.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queuePlaybookCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueuePlaybookReport(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queuePlaybookResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpsPlaybookMode(playbook.mode);
            appendOpsLogEntry({
                tone: 'warning',
                source: 'status',
                title: `Playbook ${playbook.mode}: reiniciado`,
                summary:
                    'La secuencia del modo activo se reinició para volver a guiar el flujo desde el primer paso.',
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-playbook-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queuePlaybookStep || '');
            const nextValue = !playbook.modeState[stepId];
            setOpsPlaybookStep(playbook.mode, stepId, nextValue);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}
