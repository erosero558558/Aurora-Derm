import { buildOwnerPlaybookBoard } from './turnero-release-incident-playbooks.js';
import { buildCommandPack } from './turnero-release-command-library.js';
import { buildExecutionSummary } from './turnero-release-incident-executor.js';

function joinLines(lines = []) {
    return lines.filter(Boolean).join('\n');
}

function renderStepBlock(label, items = []) {
    if (!items.length) return `${label}: sin pasos definidos`;
    return `${label}:\n${items.map((item, index) => `  ${index + 1}. ${item}`).join('\n')}`;
}

export function buildOwnerWorkbenchSnapshot({
    incidents = [],
    context = {},
    executorState = {},
} = {}) {
    const owners = buildOwnerPlaybookBoard({ incidents, context });
    const allPlaybooks = owners.flatMap((owner) => owner.items);
    const executionSummary = buildExecutionSummary({
        playbooks: allPlaybooks,
        executorState,
    });
    const commandPack = buildCommandPack({
        incidents: allPlaybooks,
        clinicId: context.clinicId,
        clinicName: context.clinicName,
        baseUrl: context.baseUrl,
        releaseMode: context.releaseMode,
    });

    return {
        clinicId: context.clinicId || 'unknown-clinic',
        clinicName: context.clinicName || 'Unknown clinic',
        releaseMode: context.releaseMode || 'unknown',
        owners,
        executionSummary,
        commandPack,
        generatedAt: new Date().toISOString(),
    };
}

export function buildOwnerRunbookText(ownerBucket) {
    const header = `OWNER: ${ownerBucket.owner}\nIncidentes: ${ownerBucket.total}\nCríticos: ${ownerBucket.critical}\nBlocked: ${ownerBucket.blocked}`;
    const body = ownerBucket.items
        .map((item) => {
            return joinLines([
                `- ${item.title} [${item.severity}]`,
                `  Impacto: ${item.impact}`,
                `  ${renderStepBlock('Now', item.steps.now)}`,
                `  ${renderStepBlock('Next', item.steps.next)}`,
                `  ${renderStepBlock('Verify', item.steps.verify)}`,
                `  ${renderStepBlock('Escalate', item.steps.escalate)}`,
                `  Comandos:\n${(item.commands.commands || []).map((entry) => `    - ${entry}`).join('\n')}`,
            ]);
        })
        .join('\n\n');
    return `${header}\n\n${body}`.trim();
}

export function buildIncidentHandoffText({ playbook, incidentState }) {
    const notes =
        (incidentState?.notes || [])
            .map(
                (entry) =>
                    `- [${entry.createdAt}] ${entry.author}: ${entry.note}`
            )
            .join('\n') || '- sin notas';
    const steps =
        Object.entries(incidentState?.steps || {})
            .map(
                ([key, value]) =>
                    `- ${key}: ${value.state} (${value.updatedAt || 'sin fecha'})`
            )
            .join('\n') || '- sin avances';

    return [
        `INCIDENTE: ${playbook.title}`,
        `Owner: ${playbook.owner}`,
        `Severity: ${playbook.severity}`,
        `Estado: ${playbook.status}`,
        `Impacto: ${playbook.impact}`,
        'Pasos sugeridos:',
        ...playbook.steps.now.map((entry) => `- ${entry}`),
        'Progreso actual:',
        steps,
        'Notas:',
        notes,
    ].join('\n');
}

export function buildWorkbenchClipboardBundle({
    snapshot,
    executorState = {},
} = {}) {
    const ownerTexts = snapshot.owners.map((owner) => ({
        owner: owner.owner,
        text: buildOwnerRunbookText(owner),
    }));
    const incidentTexts = snapshot.owners.flatMap((owner) =>
        owner.items.map((playbook) => ({
            id: playbook.id,
            owner: playbook.owner,
            text: buildIncidentHandoffText({
                playbook,
                incidentState: executorState.incidents?.[playbook.id] || {},
            }),
        }))
    );

    return {
        ownerTexts,
        incidentTexts,
        commandPackText: snapshot.commandPack
            .map((entry) => {
                return [
                    `INCIDENTE: ${entry.incidentId}`,
                    `Owner: ${entry.owner}`,
                    `Library: ${entry.title}`,
                    ...entry.commands.map((cmd) => `- ${cmd}`),
                ].join('\n');
            })
            .join('\n\n'),
    };
}
