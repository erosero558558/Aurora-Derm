export function buildQueuePlaybookReport(manifest, detectedPlatform, deps) {
    const { buildQueuePlaybook, buildQueuePlaybookAssist, formatDateTime } =
        deps;
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    return [
        `${playbook.title} - ${formatDateTime(new Date().toISOString())}`,
        `Progreso: ${playbook.completedCount}/${playbook.totalSteps}`,
        `Sugeridos actuales: ${assist.suggestedCount}`,
        ...playbook.steps.map((step) => {
            const done = Boolean(playbook.modeState[step.id]);
            return `${done ? '[x]' : '[ ]'} ${step.title} - ${step.detail}`;
        }),
    ].join('\n');
}

export async function copyQueuePlaybookReport(
    manifest,
    detectedPlatform,
    deps
) {
    const { createToast } = deps;
    try {
        await navigator.clipboard.writeText(
            buildQueuePlaybookReport(manifest, detectedPlatform, deps)
        );
        createToast('Playbook copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el playbook', 'error');
    }
}
