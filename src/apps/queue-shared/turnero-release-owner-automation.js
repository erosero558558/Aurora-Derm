import { buildTurneroReleaseEscalationMatrix } from './turnero-release-escalation-matrix.js';
import {
    normalizeOwner,
    toArray,
    toReleaseControlCenterSnapshot,
    toText,
} from './turnero-release-control-center.js';
import { buildTurneroReleaseOwnershipBoard } from './turnero-release-ownership-board.js';

const STALE_WINDOW_MS = 60 * 60 * 1000;

function nowIso() {
    return new Date().toISOString();
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function ownerPriority(lane) {
    if ((lane.summary?.blocker || 0) > 0 || lane.stage === 'escalate-now') {
        return 'high';
    }
    if ((lane.summary?.warning || 0) > 0 || lane.stage === 'active-incident') {
        return 'medium';
    }
    return 'low';
}

function activityScore(lane, queueTasks, journalEntries) {
    const laneUpdatedAt = lane?.updatedAt
        ? new Date(lane.updatedAt).getTime()
        : 0;
    const queueUpdatedAt = Math.max(
        0,
        ...toArray(queueTasks)
            .map((task) =>
                task?.updatedAt ? new Date(task.updatedAt).getTime() : 0
            )
            .filter(Boolean)
    );
    const journalUpdatedAt = Math.max(
        0,
        ...toArray(journalEntries)
            .map((entry) =>
                entry?.updatedAt ? new Date(entry.updatedAt).getTime() : 0
            )
            .filter(Boolean)
    );
    return Math.max(laneUpdatedAt, queueUpdatedAt, journalUpdatedAt);
}

function isStaleLane(lane, queueTasks, journalEntries) {
    const score = activityScore(lane, queueTasks, journalEntries);
    if (!score) {
        return (
            (lane.summary?.blocker || 0) === 0 &&
            (lane.summary?.warning || 0) === 0
        );
    }
    return Date.now() - score > STALE_WINDOW_MS;
}

function nextAction(actionId, label, detail, kind, commands = []) {
    return {
        id: actionId,
        label,
        detail,
        kind,
        commands: toArray(commands)
            .map((entry) => toText(entry))
            .filter(Boolean),
    };
}

export function buildTurneroOwnerNextActions(ownerLane = {}) {
    const lane = asObject(ownerLane);
    const owner = normalizeOwner(lane.owner || 'unknown');
    const label = toText(lane.label || lane.owner || owner);
    const queueCount = Array.isArray(lane.queueTasks)
        ? lane.queueTasks.length
        : 0;
    const blockerCount = Number(lane.summary?.blocker || 0);
    const warningCount = Number(lane.summary?.warning || 0);

    if (lane.stage === 'escalate-now' || lane.status === 'blocked') {
        return [
            nextAction(
                `${owner}-copy-brief`,
                'Copiar brief',
                `Brief compacto para ${label}.`,
                'copy',
                lane.commands
            ),
            nextAction(
                `${owner}-recheck-now`,
                'Crear recheck',
                'Revalidar la evidencia con la máxima prioridad.',
                'recheck',
                ['queue recheck now', 'review blockers']
            ),
            nextAction(
                `${owner}-escalate`,
                'Escalar ahora',
                'Notificar al owner o al canal operativo.',
                'escalate',
                lane.docs
            ),
        ];
    }

    if (lane.stage === 'active-incident' || blockerCount > 0) {
        return [
            nextAction(
                `${owner}-copy-evidence`,
                'Copiar evidencia',
                `Evidencia operativa para ${label}.`,
                'copy',
                lane.docs
            ),
            nextAction(
                `${owner}-run-queue`,
                'Ejecutar rechecks',
                `Procesar ${queueCount} tarea(s) pendientes.`,
                'run-queue',
                ['run rechecks', 'mark running']
            ),
            nextAction(
                `${owner}-follow-up`,
                'Programar follow-up',
                'Dejar una nota y revisar el siguiente corte.',
                'follow-up',
                lane.nextChecks
            ),
        ];
    }

    if (lane.stage === 'watch' || warningCount > 0) {
        return [
            nextAction(
                `${owner}-recheck`,
                'Programar recheck',
                `Mantener ${label} bajo vigilancia.`,
                'recheck',
                ['queue recheck', 'copy queue']
            ),
            nextAction(
                `${owner}-copy-brief`,
                'Copiar brief',
                'Brief corto para el siguiente turno.',
                'copy',
                lane.commands
            ),
        ];
    }

    return [
        nextAction(
            `${owner}-copy-brief`,
            'Copiar brief',
            `Estado estable para ${label}.`,
            'copy',
            lane.commands
        ),
        nextAction(
            `${owner}-monitor`,
            'Mantener watch',
            'Revalidar en la siguiente ventana.',
            'watch',
            lane.nextChecks
        ),
    ];
}

export function buildTurneroOwnerAutomationBoard({
    incidents = [],
    owners = [],
    queueSnapshot = null,
    ownerState = null,
    executorState = {},
    journalEntries = [],
    commandDeck = null,
    decision = 'review',
    profileFingerprint = '',
    releaseMode = '',
    baseUrl = '',
    clinicId = '',
} = {}) {
    const controlCenter = toReleaseControlCenterSnapshot({
        clinicId,
        profileFingerprint,
        releaseMode,
        releaseEvidenceBundle: queueSnapshot?.releaseEvidenceBundle || {},
    });
    const normalizedOwnerState = asObject(
        ownerState || executorState?.incidents || executorState
    );
    const ownershipBoard = buildTurneroReleaseOwnershipBoard(controlCenter, {
        ownerState: normalizedOwnerState,
    });
    const escalationMatrix = buildTurneroReleaseEscalationMatrix(
        controlCenter,
        {
            ownerState: normalizedOwnerState,
            journalEntries,
            decision,
        }
    );
    const queueTasks = toArray(queueSnapshot?.tasks);
    const queueByOwner = queueTasks.reduce((acc, task) => {
        const owner = normalizeOwner(task.owner || 'unknown');
        acc[owner] = acc[owner] || [];
        acc[owner].push(task);
        return acc;
    }, {});
    const ownerSet = new Map(
        [
            ...toArray(owners),
            ...ownershipBoard.lanes,
            ...toArray(incidents),
        ].map((entry) => {
            if (typeof entry === 'string') {
                const owner = normalizeOwner(entry);
                return [owner, { owner, label: entry }];
            }
            const source = asObject(entry);
            const owner = normalizeOwner(
                source.owner || source.id || 'unknown'
            );
            return [
                owner,
                { owner, label: toText(source.label || source.owner || owner) },
            ];
        })
    );
    const ownersList = Array.from(ownerSet.values()).map((entry) => {
        const lane = escalationMatrix.lanes.find(
            (item) => item.owner === entry.owner
        ) ||
            ownershipBoard.lanes.find((item) => item.owner === entry.owner) || {
                owner: entry.owner,
                label: entry.label,
                incidents: [],
                commands: [],
                docs: [],
                nextChecks: [],
                summary: { blocker: 0, warning: 0, info: 0 },
                priority: 'low',
                stage: 'stable',
                nextWindow: 'Monitor',
                escalationTarget: 'coordinacion',
                laneStatus: 'pending',
                note: '',
                updatedAt: '',
            };
        const queueItems = queueByOwner[entry.owner] || [];
        const nextActions = buildTurneroOwnerNextActions({
            ...lane,
            queueTasks: queueItems,
        });

        return {
            ...lane,
            owner: entry.owner,
            label: entry.label || lane.label || entry.owner,
            priority: ownerPriority(lane),
            queueTasks: queueItems,
            nextActions,
            stale: isStaleLane(lane, queueItems, journalEntries),
            lastActivityAt:
                activityScore(lane, queueItems, journalEntries) || null,
            commandDeck,
        };
    });

    const staleOwners = ownersList.filter((owner) => owner.stale);
    const summary = ownersList.reduce(
        (acc, owner) => {
            acc.total += 1;
            acc[owner.priority] += 1;
            if (owner.stale) acc.stale += 1;
            acc.blocker += Number(owner.summary?.blocker || 0);
            acc.warning += Number(owner.summary?.warning || 0);
            acc.info += Number(owner.summary?.info || 0);
            return acc;
        },
        {
            total: 0,
            high: 0,
            medium: 0,
            low: 0,
            stale: 0,
            blocker: 0,
            warning: 0,
            info: 0,
        }
    );

    return {
        clinicId: controlCenter.clinicId || clinicId || 'default-clinic',
        profileFingerprint: toText(
            profileFingerprint || controlCenter.profileFingerprint || ''
        ),
        releaseMode: toText(releaseMode || controlCenter.releaseMode || ''),
        baseUrl: toText(baseUrl || ''),
        decision,
        generatedAt: nowIso(),
        owners: ownersList.sort((left, right) => {
            const priorityRank = { high: 0, medium: 1, low: 2 };
            const diff =
                priorityRank[left.priority] - priorityRank[right.priority];
            if (diff !== 0) return diff;
            return String(left.label || '').localeCompare(
                String(right.label || '')
            );
        }),
        staleOwners,
        summary,
        ownershipBoard,
        escalationMatrix,
        queueSnapshot,
        journalEntries,
    };
}

export function buildTurneroOwnerAutomationMarkdown(board = {}) {
    const owners = toArray(board.owners);
    const staleOwners = toArray(board.staleOwners);

    return [
        `# Owner Automation Board — ${toText(board.clinicId || 'default-clinic')}`,
        '',
        `- decision: ${toText(board.decision || 'review')}`,
        `- fingerprint: ${toText(board.profileFingerprint || 'unknown')}`,
        `- releaseMode: ${toText(board.releaseMode || 'unknown')}`,
        `- staleOwners: ${staleOwners.length}`,
        '',
        '## Summary',
        `- total: ${board.summary?.total || owners.length}`,
        `- high: ${board.summary?.high || 0}`,
        `- medium: ${board.summary?.medium || 0}`,
        `- low: ${board.summary?.low || 0}`,
        `- blocker: ${board.summary?.blocker || 0}`,
        `- warning: ${board.summary?.warning || 0}`,
        `- info: ${board.summary?.info || 0}`,
        '',
        '## Owners',
        ...owners.flatMap((owner) => [
            `### ${owner.label || owner.owner}`,
            `- owner: ${owner.owner}`,
            `- priority: ${owner.priority}`,
            `- stage: ${owner.stage}`,
            `- nextWindow: ${owner.nextWindow}`,
            `- stale: ${owner.stale ? 'yes' : 'no'}`,
            `- incidents: ${toArray(owner.incidents).length}`,
            `- queueTasks: ${toArray(owner.queueTasks).length}`,
            owner.nextActions.length
                ? `- nextActions: ${owner.nextActions
                      .map((action) => `${action.label} (${action.kind})`)
                      .join(' | ')}`
                : '- nextActions: sin acciones',
            '',
        ]),
        staleOwners.length
            ? [
                  '## Stale owners',
                  ...staleOwners.map(
                      (owner) =>
                          `- ${owner.label || owner.owner}: ${owner.nextWindow || 'Monitor'}`
                  ),
                  '',
              ]
            : ['## Stale owners', '- ninguno', ''],
    ]
        .flat()
        .filter(Boolean)
        .join('\n')
        .trim();
}

export default buildTurneroOwnerAutomationBoard;
