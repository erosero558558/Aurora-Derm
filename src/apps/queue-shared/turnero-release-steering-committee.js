import { asObject, toArray, toText } from './turnero-release-control-center.js';

function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeIncident(input, index = 0) {
    const source = asObject(input);
    const severity = String(
        source.severity ||
            source.state ||
            source.tone ||
            source.status ||
            'info'
    )
        .trim()
        .toLowerCase();

    return {
        id: toText(source.id || source.incidentId || `incident-${index + 1}`),
        title: toText(
            source.title || source.label || source.name || 'Incidente'
        ),
        detail: toText(source.detail || source.summary || source.note || ''),
        severity:
            severity === 'critical' ||
            severity === 'blocker' ||
            severity === 'blocked'
                ? 'alert'
                : severity === 'warning' || severity === 'watch'
                  ? 'warning'
                  : severity === 'ready' || severity === 'done'
                    ? 'ready'
                    : 'info',
        owner: toText(source.owner || source.assignee || 'board'),
        source: toText(source.source || source.kind || 'pilot'),
    };
}

function normalizeApproval(input, index = 0) {
    const source = asObject(input);
    const status = String(
        source.status ||
            source.state ||
            (source.ready === false ? 'requested' : 'approved')
    )
        .trim()
        .toLowerCase();

    return {
        id: toText(source.id || source.approvalId || `approval-${index + 1}`),
        title: toText(
            source.title || source.label || source.name || 'Approval'
        ),
        detail: toText(source.detail || source.summary || source.note || ''),
        owner: toText(
            source.owner ||
                source.assignee ||
                source.suggestedApprover ||
                'board'
        ),
        status:
            status === 'approved' || status === 'done' || status === 'closed'
                ? 'approved'
                : status === 'rejected' || status === 'cancelled'
                  ? 'rejected'
                  : status === 'waived'
                    ? 'waived'
                    : status === 'reopened'
                      ? 'reopened'
                      : 'requested',
        source: toText(source.source || source.kind || 'pilot'),
    };
}

function decisionModeFromCounts(blockedCount, pendingApprovals) {
    if (blockedCount > 2 || pendingApprovals > 3) {
        return 'intervention';
    }

    if (blockedCount > 0 || pendingApprovals > 0) {
        return 'review';
    }

    return 'proceed';
}

function buildAgenda(incidents, approvals) {
    const agenda = [
        'Estado general del rollout y cobertura regional',
        'Bloqueos críticos, owners y tiempos de resolución',
        'Presupuesto, riesgo y compliance del programa',
        'Decisiones requeridas para la siguiente ventana',
        'Hitos de cohorte y dependencias inter-clínica',
    ];

    if (incidents.length > 0) {
        agenda.unshift(
            `Revisar ${incidents.length} señal${incidents.length === 1 ? '' : 'es'} de riesgo`
        );
    }

    if (approvals.length > 0) {
        agenda.splice(
            2,
            0,
            `Cerrar ${approvals.length} aprobación${approvals.length === 1 ? '' : 'es'} pendiente${approvals.length === 1 ? '' : 's'}`
        );
    }

    return agenda;
}

export function buildTurneroReleaseSteeringCommittee(input = {}) {
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );
    const programName = toText(input.programName || 'Turnero Web por Clínica');
    const incidents = toArray(input.incidents).map(normalizeIncident);
    const approvals = toArray(input.approvals).map(normalizeApproval);
    const blockedCount = incidents.filter(
        (item) => item.severity === 'alert'
    ).length;
    const warningCount = incidents.filter(
        (item) => item.severity === 'warning'
    ).length;
    const pendingApprovals = approvals.filter(
        (item) => item.status !== 'approved'
    ).length;
    const decisionMode = decisionModeFromCounts(blockedCount, pendingApprovals);
    const agenda = buildAgenda(incidents, approvals);
    const focus = [
        ...incidents.slice(0, 3).map((incident) => incident.title),
        ...approvals.slice(0, 2).map((approval) => approval.title),
    ].filter(Boolean);

    return {
        region,
        scope: toText(input.scope || region || 'regional', 'regional'),
        programName,
        decisionMode,
        blockedCount,
        warningCount,
        pendingApprovals,
        incidentCount: incidents.length,
        approvalCount: approvals.length,
        focus,
        agenda,
        summary:
            input.summary ||
            (decisionMode === 'intervention'
                ? `Intervención requerida en ${region}.`
                : decisionMode === 'review'
                  ? `Revisión requerida en ${region}.`
                  : `Listo para proceder en ${region}.`),
        nextStep:
            decisionMode === 'proceed'
                ? 'Mantener cadence y liberar la siguiente ventana.'
                : decisionMode === 'review'
                  ? 'Cerrar los puntos abiertos antes del steering.'
                  : 'Escalar a comité y cortar bloqueos críticos.',
        generatedAt: new Date().toISOString(),
    };
}

export function steeringCommitteeToMarkdown(pack = {}) {
    const agenda = toArray(pack.agenda);
    const focus = toArray(pack.focus);

    return [
        '# Steering Committee Pack',
        '',
        `- Programa: ${toText(pack.programName || 'Turnero Web por Clínica')}`,
        `- Región: ${toText(pack.region || pack.scope || 'regional', 'regional')}`,
        `- Decision mode: ${toText(pack.decisionMode || 'review')}`,
        `- Bloqueos: ${toNumber(pack.blockedCount, 0)}`,
        `- Warnings: ${toNumber(pack.warningCount, 0)}`,
        `- Pending approvals: ${toNumber(pack.pendingApprovals, 0)}`,
        '',
        '## Agenda',
        ...(agenda.length
            ? agenda.map((item) => `- ${toText(item)}`)
            : ['- Sin agenda disponible.']),
        '',
        '## Focus',
        ...(focus.length
            ? focus.map((item) => `- ${toText(item)}`)
            : ['- Sin focus destacado.']),
        '',
        `## Next step`,
        `- ${toText(pack.nextStep || 'Mantener cadence.')}`,
        '',
        `Generated at: ${toText(pack.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export default buildTurneroReleaseSteeringCommittee;
