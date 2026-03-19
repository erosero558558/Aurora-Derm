import { buildTurneroReleaseEscalationMatrix } from './turnero-release-escalation-matrix.js';
import { buildTurneroReleaseOwnershipBoard } from './turnero-release-ownership-board.js';

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueStrings(values) {
    return Array.from(
        new Set(
            toArray(values)
                .map(String)
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
}

function priorityScore(value) {
    if (value === 'high') return 3;
    if (value === 'medium') return 2;
    return 1;
}

function stageScore(value) {
    if (value === 'escalate-now') return 4;
    if (value === 'active-incident') return 3;
    if (value === 'watch') return 2;
    return 1;
}

function normalizeWindow(stage) {
    if (stage === 'escalate-now') return 'ahora';
    if (stage === 'active-incident') return '15m';
    if (stage === 'watch') return '30m';
    return 'siguiente-turno';
}

function buildStepId(lane, index) {
    return `${String(lane?.owner || 'unknown').trim()}-${index + 1}`;
}

function laneSummaryText(lane) {
    const summary = lane?.summary || {};
    return `B${summary.blocker || 0}/W${summary.warning || 0}/I${summary.info || 0}`;
}

function buildStep(lane, incident, index) {
    return {
        id: buildStepId(lane, index),
        owner: lane?.owner || 'unknown',
        ownerLabel: lane?.label || lane?.owner || 'Pendiente',
        priority: lane?.priority || 'low',
        stage: lane?.stage || 'stable',
        window: normalizeWindow(lane?.stage),
        title: incident?.title || `Acción ${index + 1}`,
        severity: incident?.severity || 'info',
        why: incident?.why || '',
        note: lane?.note || '',
        escalationTarget: lane?.escalationTarget || 'coordinación',
        nextWindow: lane?.nextWindow || 'Monitor',
        summaryText: laneSummaryText(lane),
        commands: uniqueStrings(
            incident?.recommendedCommands || lane?.commands
        ).slice(0, 4),
        docs: uniqueStrings(incident?.recommendedDocs || lane?.docs).slice(
            0,
            4
        ),
        nextCheck:
            incident?.nextCheck ||
            lane?.nextChecks?.[0] ||
            'Revalidar snapshot del panel.',
    };
}

function compareSteps(left, right) {
    const stageDiff = stageScore(right.stage) - stageScore(left.stage);
    if (stageDiff !== 0) return stageDiff;
    const priorityDiff =
        priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return String(left.ownerLabel || '').localeCompare(
        String(right.ownerLabel || '')
    );
}

export function buildTurneroReleaseTimeline(snapshot, options = {}) {
    const board = buildTurneroReleaseOwnershipBoard(snapshot, options);
    const matrix = buildTurneroReleaseEscalationMatrix(snapshot, {
        ...options,
        decision: options.decision || board.decision,
    });

    const steps = toArray(matrix?.lanes)
        .flatMap((lane) => {
            const incidents = toArray(lane?.incidents);
            if (!incidents.length) {
                return [
                    {
                        id: buildStepId(lane, 0),
                        owner: lane?.owner || 'unknown',
                        ownerLabel: lane?.label || lane?.owner || 'Pendiente',
                        priority: lane?.priority || 'low',
                        stage: lane?.stage || 'stable',
                        window: normalizeWindow(lane?.stage),
                        title: `Mantener ${lane?.label || lane?.owner || 'owner'} en monitoreo`,
                        severity: 'info',
                        why: lane?.focus || 'Sin incidentes abiertos.',
                        note: lane?.note || '',
                        escalationTarget:
                            lane?.escalationTarget || 'coordinación',
                        nextWindow: lane?.nextWindow || 'Monitor',
                        summaryText: laneSummaryText(lane),
                        commands: uniqueStrings(lane?.commands).slice(0, 3),
                        docs: uniqueStrings(lane?.docs).slice(0, 3),
                        nextCheck:
                            lane?.nextChecks?.[0] ||
                            'Volver a revisar en la siguiente verificación.',
                    },
                ];
            }

            return incidents.map((incident, index) =>
                buildStep(lane, incident, index)
            );
        })
        .sort(compareSteps);

    const windows = {
        ahora: steps.filter((step) => step.window === 'ahora'),
        '15m': steps.filter((step) => step.window === '15m'),
        '30m': steps.filter((step) => step.window === '30m'),
        'siguiente-turno': steps.filter(
            (step) => step.window === 'siguiente-turno'
        ),
    };

    return {
        clinicId: board?.clinicId || 'default-clinic',
        profileFingerprint: board?.profileFingerprint || null,
        generatedAt: new Date().toISOString(),
        decision: board?.decision || 'review',
        decisionReason: board?.decisionReason || '',
        stepCount: steps.length,
        laneCount: toArray(matrix?.lanes).length,
        windows,
        steps,
    };
}

export function buildTurneroReleaseTimelineMarkdown(timeline) {
    const header = [
        `# Release Timeline — ${String(
            timeline?.clinicId || 'default-clinic'
        )}`,
        '',
        `- Fingerprint: ${timeline?.profileFingerprint || 'sin fingerprint'}`,
        `- Generado: ${timeline?.generatedAt || new Date().toISOString()}`,
        `- Decisión: ${timeline?.decision || 'review'} — ${
            timeline?.decisionReason || 'sin motivo'
        }`,
        `- Pasos: ${timeline?.stepCount || 0}`,
        '',
    ];

    const body = toArray(timeline?.steps).flatMap((step, index) => [
        `## ${index + 1}. [${step.window}] ${step.ownerLabel}`,
        `- Título: ${step.title}`,
        `- Severidad: ${step.severity}`,
        `- Prioridad: ${step.priority}`,
        `- Escalación: ${step.escalationTarget}`,
        `- Resumen lane: ${step.summaryText}`,
        step.why ? `- Por qué: ${step.why}` : '- Por qué: sin detalle',
        step.commands.length
            ? `- Comandos: ${step.commands.join(' | ')}`
            : '- Comandos: sin comandos',
        step.docs.length
            ? `- Docs: ${step.docs.join(' | ')}`
            : '- Docs: sin docs',
        `- Siguiente chequeo: ${step.nextCheck}`,
        '',
    ]);

    return [...header, ...body].join('\n').trim();
}
