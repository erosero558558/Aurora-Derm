'use strict';

const terminalEvidence = require('../domain/evidence');
const domainStrategy = require('../domain/strategy');
const publishCommandHandlers = require('./publish');

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'comando mutante' } = options;
    if (typeof parseExpectedBoardRevisionFlag !== 'function') return null;
    const parsed = parseExpectedBoardRevisionFlag(flags);
    if (parsed instanceof Error) throw parsed;
    if (required && (parsed === null || parsed === undefined)) {
        const error = new Error(
            `${commandLabel} requiere --expect-rev para evitar carreras de AGENT_BOARD.yaml`
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    return parsed;
}

function printCloseJsonError(error) {
    const payload = {
        version: 1,
        ok: false,
        command: 'close',
        error: String(error?.message || error || 'close_failed'),
        error_code: String(error?.error_code || error?.code || 'close_failed'),
    };
    if (payload.error_code === 'board_revision_mismatch') {
        payload.expected_revision = Number(error?.expected_revision);
        payload.actual_revision = Number(error?.actual_revision);
    }
    if (error?.branch_alignment) {
        payload.branch_alignment = error.branch_alignment;
    }
    if (error?.workspace_truth) {
        payload.workspace_truth = error.workspace_truth;
    }
    if (error?.workspace_hygiene) {
        payload.workspace_hygiene = error.workspace_hygiene;
    }
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return payload;
}

function createBoardRevisionMismatchError(expectedRevision, actualRevision) {
    const error = new Error(
        `board revision mismatch: expected ${expectedRevision}, actual ${actualRevision}`
    );
    error.code = 'board_revision_mismatch';
    error.error_code = 'board_revision_mismatch';
    error.expected_revision = expectedRevision;
    error.actual_revision = actualRevision;
    return error;
}

function syncCodexPlanOnClose(taskId, ctx = {}) {
    if (!/^CDX-\d+$/i.test(String(taskId || '').trim())) {
        return;
    }
    const { parseCodexActiveBlocks, writeCodexActiveBlock } = ctx;
    if (
        typeof parseCodexActiveBlocks !== 'function' ||
        typeof writeCodexActiveBlock !== 'function'
    ) {
        return;
    }
    const remainingBlocks = parseCodexActiveBlocks().filter(
        (item) =>
            String(item?.task_id || '').trim() !== String(taskId || '').trim()
    );
    writeCodexActiveBlock(null);
    for (const remainingBlock of remainingBlocks) {
        writeCodexActiveBlock(remainingBlock);
    }
}

async function handleCloseCommand(ctx) {
    const {
        args,
        parseFlags,
        resolveTaskEvidencePath,
        existsSync,
        parseBoard,
        parseHandoffs,
        currentDate,
        toRelativeRepoPath,
        BOARD_PATH,
        serializeBoard,
        writeFileSync,
        syncDerivedQueues,
        writeBoard,
        writeBoardAndSync,
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot,
        buildFocusSummary,
        buildLiveFocusSummary,
        parseDecisions,
        verifyOpenClawRuntime,
        rootPath,
        publishEventsPath,
        writeCodexActiveBlock,
        parseCodexActiveBlocks,
        getLastBoardWriteMeta,
        toTaskJson,
        parseExpectedBoardRevisionFlag,
        loadModelUsageLedger,
        buildTaskModelUsageSummary,
        captureTaskWorkspace,
        applyWorkspaceTaskSnapshot,
        runWorkspaceSync,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
    } = ctx;
    const { positionals, flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!taskId) {
        throw new Error(
            'Uso: node agent-orchestrator.js close <task_id> [--evidence path] [--json]'
        );
    }
    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth({
                  allWorktrees: true,
                  currentOnly: false,
              })
            : null;
    if (typeof assertWorkspaceTruthOk === 'function') {
        assertWorkspaceTruthOk(workspaceReport, {
            commandLabel: 'close',
        });
    }

    const evidencePath = resolveTaskEvidencePath(taskId, flags);
    if (!existsSync(evidencePath)) {
        throw new Error(`No existe evidencia requerida: ${evidencePath}`);
    }

    const board = parseBoard();
    const task = board.tasks.find((item) => String(item.id) === String(taskId));
    if (!task) {
        throw new Error(`No existe task_id ${taskId} en AGENT_BOARD.yaml`);
    }
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'close' }
    );
    const currentRevisionRaw = Number(board?.policy?.revision);
    const currentRevision =
        Number.isInteger(currentRevisionRaw) && currentRevisionRaw >= 0
            ? currentRevisionRaw
            : 0;
    if (
        expectRevision !== null &&
        expectRevision !== undefined &&
        Number(expectRevision) !== currentRevision
    ) {
        throw createBoardRevisionMismatchError(
            Number(expectRevision),
            currentRevision
        );
    }
    const modelUsageLedger =
        typeof loadModelUsageLedger === 'function'
            ? loadModelUsageLedger()
            : [];
    const isCodexTask =
        String(task.executor || '')
            .trim()
            .toLowerCase() === 'codex';
    let workspaceCapture = null;
    if (isCodexTask && typeof captureTaskWorkspace === 'function') {
        workspaceCapture = captureTaskWorkspace(taskId);
        if (typeof applyWorkspaceTaskSnapshot === 'function') {
            applyWorkspaceTaskSnapshot(task, workspaceCapture);
        }
    }

    if (isCodexTask) {
        let focusSummary = null;
        if (typeof buildLiveFocusSummary === 'function') {
            focusSummary = (
                await buildLiveFocusSummary(board, { now: new Date() })
            )?.summary;
        } else if (typeof buildFocusSummary === 'function') {
            const decisionsData =
                typeof parseDecisions === 'function'
                    ? parseDecisions()
                    : { decisions: [] };
            const jobsSnapshot =
                typeof buildJobsSnapshot === 'function' &&
                typeof parseJobs === 'function'
                    ? await buildJobsSnapshot(parseJobs())
                    : [];
            const initialFocusSummary = buildFocusSummary(board, {
                decisionsData,
                jobsSnapshot,
                now: new Date(),
            });
            const runtimeVerification =
                Array.isArray(initialFocusSummary?.configured?.required_checks) &&
                initialFocusSummary.configured.required_checks.some((item) =>
                    String(item || '')
                        .trim()
                        .toLowerCase()
                        .startsWith('runtime:')
                ) &&
                typeof verifyOpenClawRuntime === 'function'
                    ? await verifyOpenClawRuntime()
                    : null;
            focusSummary = buildFocusSummary(board, {
                decisionsData,
                jobsSnapshot,
                runtimeVerification,
                now: new Date(),
            });
        }
        publishCommandHandlers.assertReleaseRequiredChecks(
            focusSummary,
            'close'
        );
    }

    if (task.cross_domain) {
        const handoffData =
            typeof parseHandoffs === 'function'
                ? parseHandoffs()
                : { handoffs: [] };
        const closedForTask = (handoffData.handoffs || []).filter((handoff) => {
            if (String(handoff?.status || '').toLowerCase() !== 'closed') {
                return false;
            }
            return (
                String(handoff?.from_task || '') === String(taskId) ||
                String(handoff?.to_task || '') === String(taskId)
            );
        });
        if (closedForTask.length === 0) {
            throw new Error(
                `No se puede cerrar ${taskId}: cross_domain=true requiere handoff cerrado vinculado`
            );
        }
    }

    task.status = 'done';
    task.updated_at = currentDate();
    terminalEvidence.applyCanonicalEvidenceRefs(
        task,
        toRelativeRepoPath(evidencePath)
    );
    board.policy.updated_at = currentDate();
    let publishResult = null;
    if (isCodexTask) {
        if (
            typeof writeBoard !== 'function' ||
            !rootPath ||
            !publishEventsPath
        ) {
            const error = new Error(
                `close ${taskId} requiere runtime de publish Codex configurado`
            );
            error.code = 'close_publish_runtime_missing';
            error.error_code = 'close_publish_runtime_missing';
            if (wantsJson) {
                return printCloseJsonError(error);
            }
            throw error;
        }

        const allowedPatterns = publishCommandHandlers.buildAllowedPatterns(
            taskId,
            task
        );
        const plannedSurfaceFiles = ['AGENT_BOARD.yaml'];
        const explicitDirtyFiles = [
            ...(Array.isArray(task.files) ? task.files : []),
            'AGENT_BOARD.yaml',
            toRelativeRepoPath(evidencePath),
        ];
        if (/^CDX-\d+$/i.test(taskId)) {
            plannedSurfaceFiles.push('PLAN_MAESTRO_CODEX_2026.md');
            explicitDirtyFiles.push('PLAN_MAESTRO_CODEX_2026.md');
        }
        try {
            publishCommandHandlers.runPublishPreflight({
                rootPath,
                board,
                task,
                allowedPatterns,
                publishEventsPath,
                allowNoChanges: true,
                extraSurfaceFiles: plannedSurfaceFiles,
            });
            writeBoard(board, {
                command: 'close',
                actor: task.owner || task.executor || '',
                expectRevision,
            });
            syncCodexPlanOnClose(taskId, {
                parseCodexActiveBlocks,
                writeCodexActiveBlock,
            });
            syncDerivedQueues({ silent: wantsJson });
            const postMaterializationPreflight =
                publishCommandHandlers.runPublishPreflight({
                    rootPath,
                    board,
                    task,
                    allowedPatterns,
                    publishEventsPath,
                    allowNoChanges: false,
                    skipCooldown: true,
                });
            publishResult =
                await publishCommandHandlers.finalizePreparedPublish(
                    {
                        rootPath,
                        publishEventsPath,
                        parseJobs,
                        buildJobsSnapshot,
                        findJobSnapshot,
                    },
                    {
                        board,
                        task,
                        taskId,
                        summary:
                            publishCommandHandlers.buildClosePublishSummary(
                                taskId,
                                task
                            ),
                        releaseException:
                            domainStrategy.isReleasePromotionExceptionTask(
                                task
                            ),
                        allowedPatterns,
                        gateCommands: postMaterializationPreflight.gateCommands,
                        ignoredDirtyEntries:
                            postMaterializationPreflight.ignoredDirtyEntries,
                        explicitDirtyFiles: [...new Set(explicitDirtyFiles)],
                        command: 'close',
                    }
                );
            if (typeof runWorkspaceSync === 'function') {
                runWorkspaceSync();
            }
        } catch (error) {
            if (wantsJson) {
                return printCloseJsonError(error);
            }
            throw error;
        }
    } else if (typeof writeBoardAndSync === 'function') {
        try {
            writeBoardAndSync(board, {
                silentSync: wantsJson,
                command: 'close',
                actor: task.owner || task.executor || '',
                expectRevision,
            });
        } catch (error) {
            if (wantsJson) {
                return printCloseJsonError(error);
            }
            throw error;
        }
    } else {
        writeFileSync(BOARD_PATH, serializeBoard(board), 'utf8');
        syncDerivedQueues({ silent: wantsJson });
    }
    const writeMeta =
        typeof getLastBoardWriteMeta === 'function'
            ? getLastBoardWriteMeta()
            : null;
    const leaseMeta = Array.isArray(writeMeta?.lifecycle?.task_results)
        ? writeMeta.lifecycle.task_results.find(
              (row) => String(row.task_id || '') === String(taskId)
          )
        : null;

    if (wantsJson) {
        const modelUsageSummary =
            typeof buildTaskModelUsageSummary === 'function'
                ? buildTaskModelUsageSummary(task, {
                      ledgerEntries: modelUsageLedger,
                  })
                : null;
        console.log(
            JSON.stringify(
                {
                    version: 1,
                    ok: true,
                    command: 'close',
                    action: 'close',
                    task: toTaskJson(task),
                    workspace: workspaceCapture
                        ? {
                              snapshot_checked_at:
                                  workspaceCapture.snapshot?.checked_at || null,
                              sync_state:
                                  workspaceCapture.task_row?.sync_state || null,
                          }
                        : null,
                    evidence_path: toRelativeRepoPath(evidencePath),
                    lease_action: leaseMeta?.lease_action || 'none',
                    lease: leaseMeta?.lease || null,
                    status_since_at: leaseMeta?.status_since_at || null,
                    published_commit: publishResult?.published_commit || null,
                    publish_transport: publishResult?.publish_transport || null,
                    branch_alignment: publishResult?.branch_alignment || null,
                    live_status: publishResult?.live_status || null,
                    verification_pending:
                        publishResult?.verification_pending || false,
                    model_usage_summary: modelUsageSummary,
                },
                null,
                2
            )
        );
        return;
    }

    const modelUsageSummary =
        typeof buildTaskModelUsageSummary === 'function'
            ? buildTaskModelUsageSummary(task, {
                  ledgerEntries: modelUsageLedger,
              })
            : null;
    if (publishResult?.published_commit) {
        console.log(
            `Tarea cerrada y publicada: ${taskId} -> ${publishResult.published_commit}${modelUsageSummary ? ` | premium=${modelUsageSummary.premium_calls_used}/${modelUsageSummary.premium_budget}` : ''}`
        );
        return;
    }

    console.log(
        `Tarea cerrada: ${taskId}${modelUsageSummary ? ` | premium=${modelUsageSummary.premium_calls_used}/${modelUsageSummary.premium_budget}` : ''}`
    );
}

module.exports = {
    handleCloseCommand,
};
