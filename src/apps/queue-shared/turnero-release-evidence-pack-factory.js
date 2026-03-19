import {
    buildTurneroReleaseControlCenterModel,
    toReleaseControlCenterSnapshot,
    toText,
    toArray,
} from './turnero-release-control-center.js';
import { createTurneroReleaseEvidenceBundleModel } from './turnero-release-evidence-bundle.js';
import {
    buildTurneroOwnershipMarkdown,
    buildTurneroReleaseOwnershipBoard,
    buildTurneroOwnerBrief,
} from './turnero-release-ownership-board.js';
import { buildTurneroReleaseEscalationMatrix } from './turnero-release-escalation-matrix.js';
import {
    buildTurneroIncidentJournalMarkdown,
    buildTurneroIncidentJournalStats,
    readTurneroIncidentJournal,
} from './turnero-release-incident-journal.js';
import {
    buildOwnerRunbookText,
    buildWorkbenchClipboardBundle,
    buildOwnerWorkbenchSnapshot,
    buildIncidentHandoffText,
} from './turnero-release-owner-workbench.js';
import {
    createIncidentExecutorStore,
    buildExecutionSummary,
} from './turnero-release-incident-executor.js';
import {
    buildTurneroReleaseTimeline,
    buildTurneroReleaseTimelineMarkdown,
} from './turnero-release-timeline.js';
import {
    buildTurneroReleaseShiftHandoff,
    buildTurneroReleaseShiftHandoffMarkdown,
} from './turnero-release-shift-handoff.js';
import {
    buildTurneroReleaseCheckpointMarkdown,
    buildTurneroReleaseCheckpointStats,
    readTurneroReleaseCheckpointScheduler,
} from './turnero-release-checkpoint-scheduler.js';
import {
    buildTurneroReleaseRecheckPlan,
    buildTurneroReleaseRecheckQueueMarkdown,
    buildTurneroReleaseRecheckStats,
    createTurneroReleaseRecheckQueueStore,
} from './turnero-release-recheck-queue.js';

function nowIso(timestamp) {
    if (timestamp instanceof Date && !Number.isNaN(timestamp.getTime())) {
        return timestamp.toISOString();
    }

    const parsed = timestamp ? new Date(timestamp) : new Date();
    return Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString();
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeBoardIncidents(board) {
    return toArray(board?.lanes).flatMap((lane) =>
        toArray(lane?.incidents).map((incident) => ({
            ...asObject(incident),
            owner: incident?.owner || lane?.owner || 'unknown',
        }))
    );
}

function buildCommandDeckSnapshot(controlCenterSnapshot, options = {}) {
    const clinicId = toText(
        options.clinicId ||
            controlCenterSnapshot?.clinicId ||
            controlCenterSnapshot?.turneroClinicProfile?.clinic_id ||
            'default-clinic'
    );
    const timeline = buildTurneroReleaseTimeline(
        controlCenterSnapshot,
        options
    );
    const checkpoints = readTurneroReleaseCheckpointScheduler(
        clinicId,
        timeline
    );
    const handoff = buildTurneroReleaseShiftHandoff(
        controlCenterSnapshot,
        options
    );
    const timelineMarkdown = buildTurneroReleaseTimelineMarkdown(timeline);
    const checkpointMarkdown = buildTurneroReleaseCheckpointMarkdown(
        clinicId,
        checkpoints
    );
    const handoffMarkdown = buildTurneroReleaseShiftHandoffMarkdown(handoff);

    return {
        clinicId,
        profileFingerprint: toText(
            options.profileFingerprint || timeline.profileFingerprint || ''
        ),
        releaseMode: toText(
            options.releaseMode || controlCenterSnapshot?.releaseMode || ''
        ),
        baseUrl: toText(options.baseUrl || ''),
        generatedAt: nowIso(options.timestamp),
        timeline,
        checkpoints,
        handoff,
        timelineMarkdown,
        checkpointMarkdown,
        handoffMarkdown,
        checkpointStats: buildTurneroReleaseCheckpointStats(checkpoints),
        pack: {
            timeline,
            checkpoints,
            handoff,
            timelineMarkdown,
            checkpointMarkdown,
            handoffMarkdown,
        },
    };
}

function isStaleOwner(lane) {
    const updatedAt = lane?.updatedAt ? new Date(lane.updatedAt) : null;
    if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
        return (
            Number(lane?.summary?.blocker || 0) === 0 &&
            Number(lane?.summary?.warning || 0) === 0
        );
    }

    return Date.now() - updatedAt.getTime() > 60 * 60 * 1000;
}

function normalizeOwnerBucket(lane = {}) {
    const source = asObject(lane);
    const items = toArray(source.items || source.incidents);
    const criticalCount = Number(
        source.critical ||
            items.filter((item) =>
                ['alert', 'blocker', 'critical'].includes(
                    String(item?.severity || item?.state || '').toLowerCase()
                )
            ).length
    );
    const blockedCount = Number(
        source.blocked ||
            items.filter(
                (item) => String(item?.status || '').toLowerCase() === 'blocked'
            ).length
    );

    return {
        ...source,
        owner: source.owner || source.label || 'unknown',
        items,
        total: Number(source.total || items.length || 0),
        critical: criticalCount,
        blocked: blockedCount,
    };
}

function buildOwnerPacks({
    ownerBoard,
    activeQueue,
    commandDeckSnapshot,
    ownerWorkbenchSnapshot,
    controlCenterModel,
    incidentJournalEntries,
    ownerState,
    incidentExecutorState,
}) {
    const queueTasks = Array.isArray(activeQueue?.tasks)
        ? activeQueue.tasks
        : [];
    const ownerLookup = new Map(queueTasks.map((task) => [task.owner, []]));
    queueTasks.forEach((task) => {
        const bucket = ownerLookup.get(task.owner) || [];
        bucket.push(task);
        ownerLookup.set(task.owner, bucket);
    });

    const ownerSources = toArray(ownerWorkbenchSnapshot?.owners).map(
        normalizeOwnerBucket
    );
    const lanes = ownerSources.length
        ? ownerSources
        : toArray(ownerBoard?.lanes).map(normalizeOwnerBucket);
    const workbenchSnapshot = toArray(ownerWorkbenchSnapshot?.owners).length
        ? ownerWorkbenchSnapshot
        : {
              owners: lanes,
              commandPack: toArray(ownerWorkbenchSnapshot?.commandPack),
          };

    return lanes.map((lane) => {
        const ownerBucket = normalizeOwnerBucket(lane);
        const owner = ownerBucket.owner || ownerBucket.label || 'unknown';
        const brief = buildTurneroOwnerBrief(
            ownerBoard,
            owner,
            ownerState || {}
        );
        const relatedTasks = ownerLookup.get(owner) || [];
        const runbookText = buildOwnerRunbookText(ownerBucket);
        const clipboardBundle = buildWorkbenchClipboardBundle({
            snapshot: workbenchSnapshot,
            executorState: incidentExecutorState || {},
        });

        return {
            owner,
            label: ownerBucket.label || owner,
            focus: ownerBucket.focus || '',
            total: Number(ownerBucket.total || 0),
            critical: Number(ownerBucket.critical || 0),
            blocked: Number(ownerBucket.blocked || 0),
            priority: ownerBucket.priority || 'low',
            stage: ownerBucket.stage || 'stable',
            nextWindow: ownerBucket.nextWindow || 'Monitor',
            escalationTarget: ownerBucket.escalationTarget || 'coordinacion',
            summary: ownerBucket.summary || {},
            incidents: toArray(ownerBucket.incidents),
            commands: toArray(ownerBucket.commands),
            docs: toArray(ownerBucket.docs),
            queueTasks: relatedTasks,
            note: ownerBucket.note || '',
            stale: isStaleOwner(ownerBucket),
            brief,
            runbookText,
            clipboardBundle,
            commandDeck: commandDeckSnapshot,
            journalEntries: incidentJournalEntries,
            markdown: [
                `# Owner evidence — ${ownerBucket.label || owner}`,
                '',
                `- owner: ${owner}`,
                `- focus: ${ownerBucket.focus || 'sin foco'}`,
                `- total: ${ownerBucket.total || 0}`,
                `- critical: ${ownerBucket.critical || 0}`,
                `- blocked: ${ownerBucket.blocked || 0}`,
                `- stage: ${ownerBucket.stage || 'stable'}`,
                `- priority: ${ownerBucket.priority || 'low'}`,
                '',
                '## Brief',
                brief || '- sin brief',
                '',
                '## Runbook',
                runbookText,
                '',
                '## Queue',
                relatedTasks.length
                    ? relatedTasks
                          .map(
                              (task) =>
                                  `- [${task.status}] ${task.title} (${task.kind}, ${task.recommendedWindow})`
                          )
                          .join('\n')
                    : '- sin tareas',
                '',
                '## Journal',
                toArray(incidentJournalEntries).length
                    ? buildTurneroIncidentJournalMarkdown(
                          controlCenterModel.clinicId,
                          incidentJournalEntries
                      )
                    : '- sin bitacora',
            ]
                .filter(Boolean)
                .join('\n'),
        };
    });
}

function buildIncidentPacks({ incidents, activeQueue, controlCenterModel }) {
    const queueTasks = Array.isArray(activeQueue?.tasks)
        ? activeQueue.tasks
        : [];
    const queueLookup = new Map(
        queueTasks.map((task) => [task.incidentId || task.id, task])
    );

    return toArray(incidents).map((incident, index) => {
        const source = asObject(incident);
        const incidentId = toText(
            source.id || source.incidentId || `incident-${index + 1}`
        );
        const queueTask = queueLookup.get(incidentId) || null;
        const markdown = [
            `# Incident evidence — ${source.title || incidentId}`,
            '',
            `- incidentId: ${incidentId}`,
            `- owner: ${source.owner || 'unknown'}`,
            `- severity: ${source.severity || source.state || 'info'}`,
            `- source: ${source.source || 'unknown'}`,
            queueTask
                ? `- recheck: ${queueTask.title} [${queueTask.status}]`
                : '- recheck: sin tarea enlazada',
            '',
            '## Detail',
            toText(
                source.detail ||
                    source.summary ||
                    source.note ||
                    source.reason ||
                    ''
            ),
            '',
            '## Commands',
            toArray(source.recommendedCommands || source.commands).length
                ? toArray(source.recommendedCommands || source.commands)
                      .map((command) => `- ${command}`)
                      .join('\n')
                : '- sin comandos',
            '',
            '## Docs',
            toArray(source.recommendedDocs || source.docs).length
                ? toArray(source.recommendedDocs || source.docs)
                      .map((doc) => `- ${doc}`)
                      .join('\n')
                : '- sin docs',
        ]
            .filter(Boolean)
            .join('\n');

        return {
            incidentId,
            owner: toText(source.owner || 'unknown'),
            title: toText(source.title || source.label || incidentId),
            severity: toText(source.severity || source.state || 'info'),
            detail: toText(
                source.detail || source.summary || source.note || ''
            ),
            source: toText(source.source || 'unknown'),
            queueTask,
            markdown,
            controlCenter: controlCenterModel,
        };
    });
}

export function buildTurneroReleaseEvidencePack(parts = {}, options = {}) {
    const controlCenterSnapshot =
        parts.releaseControlCenterSnapshot ||
        parts.controlCenterSnapshot ||
        parts.snapshot ||
        parts;
    const controlCenterModel = buildTurneroReleaseControlCenterModel(
        controlCenterSnapshot
    );
    const clinicId = toText(
        options.clinicId ||
            controlCenterModel.clinicId ||
            controlCenterSnapshot?.clinicId ||
            'default-clinic'
    );
    const profileFingerprint = toText(
        options.profileFingerprint ||
            controlCenterModel.profileFingerprint ||
            controlCenterSnapshot?.profileFingerprint ||
            ''
    );
    const releaseMode = toText(
        options.releaseMode ||
            controlCenterModel.releaseMode ||
            controlCenterSnapshot?.releaseMode ||
            ''
    );
    const baseUrl = toText(
        options.baseUrl ||
            controlCenterSnapshot?.turneroClinicProfile?.branding?.base_url ||
            controlCenterSnapshot?.turneroClinicProfile?.branding?.baseUrl ||
            controlCenterSnapshot?.turneroClinicProfile?.baseUrl ||
            ''
    );
    const generatedAt = nowIso(options.timestamp);
    const incidentJournalEntries = toArray(parts.incidentJournalEntries);
    if (!incidentJournalEntries.length) {
        incidentJournalEntries.push(...readTurneroIncidentJournal(clinicId));
    }
    const releaseWarRoomSnapshot = asObject(parts.releaseWarRoomSnapshot);
    const ownerState = asObject(
        parts.ownerState || releaseWarRoomSnapshot.ownerState || {}
    );
    const incidentExecutorStore = createIncidentExecutorStore({
        clinicId,
        storage: options.storage,
    });
    const incidentExecutorState =
        parts.incidentExecutorState || incidentExecutorStore.read();
    const ownerBoard = buildTurneroReleaseOwnershipBoard(
        controlCenterSnapshot,
        {
            ownerState,
        }
    );
    const escalationMatrix = buildTurneroReleaseEscalationMatrix(
        controlCenterSnapshot,
        {
            ownerState,
            journalEntries: incidentJournalEntries,
            decision: controlCenterModel.decision,
        }
    );
    const recheckQueueStore = createTurneroReleaseRecheckQueueStore({
        clinicId,
        storage: options.storage,
    });
    const recheckQueueSnapshot =
        parts.recheckQueueSnapshot || recheckQueueStore.read();
    const recheckPlan = buildTurneroReleaseRecheckPlan({
        clinicId,
        incidents: normalizeBoardIncidents(ownerBoard),
        owners: ownerBoard.lanes,
        decision: controlCenterModel.decision,
        profileFingerprint,
        releaseMode,
        baseUrl,
        generatedAt,
        queueSnapshot: recheckQueueSnapshot,
    });
    const activeQueue =
        Array.isArray(recheckQueueSnapshot.tasks) &&
        recheckQueueSnapshot.tasks.length
            ? recheckQueueSnapshot
            : recheckPlan;
    const commandDeckSnapshot =
        parts.releaseCommandDeckSnapshot ||
        buildCommandDeckSnapshot(controlCenterSnapshot, {
            clinicId,
            profileFingerprint,
            releaseMode,
            baseUrl,
            timestamp: generatedAt,
        });
    const ownerWorkbenchSnapshot =
        parts.ownerWorkbenchSnapshot ||
        buildOwnerWorkbenchSnapshot({
            incidents: normalizeBoardIncidents(ownerBoard),
            context: {
                clinicId,
                clinicName: controlCenterModel.clinicName,
                releaseMode,
                baseUrl,
            },
            executorState: incidentExecutorState,
        });
    const releaseEvidenceBundle =
        parts.releaseEvidenceBundle ||
        createTurneroReleaseEvidenceBundleModel(controlCenterSnapshot, {
            clinicId,
            profileFingerprint,
            releaseMode,
            baseUrl,
            timestamp: generatedAt,
        });
    const ownerPacks = buildOwnerPacks({
        ownerBoard,
        activeQueue,
        commandDeckSnapshot,
        ownerWorkbenchSnapshot,
        controlCenterModel,
        incidentJournalEntries,
        ownerState,
        incidentExecutorState,
    });
    const incidentPacks = buildIncidentPacks({
        incidents: normalizeBoardIncidents(ownerBoard),
        activeQueue,
        controlCenterModel,
    });
    const journalStats = buildTurneroIncidentJournalStats(
        incidentJournalEntries
    );
    const executionSummary = buildExecutionSummary({
        playbooks:
            ownerWorkbenchSnapshot.owners?.flatMap((owner) => owner.items) ||
            [],
        executorState: incidentExecutorState,
    });
    const queueStats = buildTurneroReleaseRecheckStats(activeQueue);
    const summary = {
        ownerCount: ownerPacks.length,
        incidentCount: incidentPacks.length,
        queueCount: queueStats.total,
        staleOwnerCount: ownerPacks.filter((pack) => pack.stale).length,
        blockerCount: controlCenterModel.alertCount,
        warningCount: controlCenterModel.warningCount,
        journalCount: journalStats.total || incidentJournalEntries.length,
        executionCount: executionSummary.length,
    };
    const globalPack = {
        clinicId,
        clinicName: controlCenterModel.clinicName,
        clinicShortName: controlCenterModel.clinicShortName,
        profileFingerprint,
        releaseMode,
        baseUrl,
        decision: controlCenterModel.decision,
        decisionReason: controlCenterModel.decisionReason,
        generatedAt,
        controlCenterSnapshot,
        controlCenterModel,
        releaseEvidenceBundle,
        releaseWarRoomSnapshot: releaseWarRoomSnapshot || null,
        releaseCommandDeckSnapshot: commandDeckSnapshot,
        ownerWorkbenchSnapshot,
        incidentExecutorState,
        incidentJournalEntries,
        incidentJournalMarkdown: buildTurneroIncidentJournalMarkdown(
            clinicId,
            incidentJournalEntries
        ),
        recheckQueueSnapshot: activeQueue,
        recheckPlan,
        recheckMarkdown: buildTurneroReleaseRecheckQueueMarkdown(activeQueue),
        ownerBoard,
        escalationMatrix,
        ownerBoardMarkdown: buildTurneroOwnershipMarkdown(ownerBoard),
        controlCenterMarkdown: controlCenterModel.runbookMarkdown || '',
        commandDeckMarkdown: [
            commandDeckSnapshot.timelineMarkdown,
            commandDeckSnapshot.checkpointMarkdown,
            commandDeckSnapshot.handoffMarkdown,
        ]
            .filter(Boolean)
            .join('\n\n'),
        ownerWorkbenchMarkdown: buildWorkbenchClipboardBundle({
            snapshot: ownerWorkbenchSnapshot,
            executorState: incidentExecutorState,
        }).commandPackText,
        summary,
    };

    return {
        generatedAt,
        globalPack,
        ownerPacks,
        incidentPacks,
        summary,
        releaseEvidenceMarkdown: buildTurneroReleaseEvidenceMarkdown({
            globalPack,
            ownerPacks,
            incidentPacks,
            summary,
        }),
    };
}

export function buildTurneroOwnerEvidenceMarkdown(ownerPack = {}) {
    return toText(ownerPack.markdown || '');
}

export function buildTurneroIncidentEvidenceMarkdown(incidentPack = {}) {
    return toText(incidentPack.markdown || '');
}

export function buildTurneroReleaseEvidenceMarkdown(pack = {}) {
    const globalPack = asObject(pack.globalPack);
    const ownerPacks = toArray(pack.ownerPacks);
    const incidentPacks = toArray(pack.incidentPacks);

    return [
        '# Turnero Release Evidence Pack',
        '',
        `- clinic: ${toText(globalPack.clinicName || 'unknown')}`,
        `- clinicId: ${toText(globalPack.clinicId || 'unknown')}`,
        `- fingerprint: ${toText(globalPack.profileFingerprint || 'unknown')}`,
        `- releaseMode: ${toText(globalPack.releaseMode || 'unknown')}`,
        `- decision: ${toText(globalPack.decision || 'review')}`,
        '',
        '## Summary',
        `- owners: ${pack.summary?.ownerCount || ownerPacks.length}`,
        `- incidents: ${pack.summary?.incidentCount || incidentPacks.length}`,
        `- rechecks: ${globalPack.recheckQueueSnapshot?.tasks?.length || 0}`,
        `- staleOwners: ${pack.summary?.staleOwnerCount || 0}`,
        '',
        '## Control center',
        toText(
            globalPack.controlCenterMarkdown ||
                globalPack.controlCenterModel?.runbookMarkdown ||
                ''
        ),
        '',
        '## Recheck queue',
        toText(globalPack.recheckMarkdown || ''),
        '',
        '## Owner packs',
        ownerPacks
            .map((ownerPack) => buildTurneroOwnerEvidenceMarkdown(ownerPack))
            .join('\n\n'),
        '',
        '## Incident packs',
        incidentPacks
            .map((incidentPack) =>
                buildTurneroIncidentEvidenceMarkdown(incidentPack)
            )
            .join('\n\n'),
    ]
        .filter(Boolean)
        .join('\n')
        .trim();
}

export default buildTurneroReleaseEvidencePack;
