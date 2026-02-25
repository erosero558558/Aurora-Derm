'use strict';

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag
) {
    if (typeof parseExpectedBoardRevisionFlag !== 'function') return null;
    const parsed = parseExpectedBoardRevisionFlag(flags);
    if (parsed instanceof Error) throw parsed;
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
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return payload;
}

function handleCloseCommand(ctx) {
    const {
        args,
        parseFlags,
        resolveTaskEvidencePath,
        existsSync,
        parseBoard,
        currentDate,
        toRelativeRepoPath,
        BOARD_PATH,
        serializeBoard,
        writeFileSync,
        syncDerivedQueues,
        writeBoardAndSync,
        getLastBoardWriteMeta,
        toTaskJson,
        parseExpectedBoardRevisionFlag,
    } = ctx;
    const { positionals, flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!taskId) {
        throw new Error(
            'Uso: node agent-orchestrator.js close <task_id> [--evidence path] [--json]'
        );
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

    task.status = 'done';
    task.updated_at = currentDate();
    task.acceptance_ref = toRelativeRepoPath(evidencePath);
    board.policy.updated_at = currentDate();
    if (typeof writeBoardAndSync === 'function') {
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag
        );
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
        console.log(
            JSON.stringify(
                {
                    version: 1,
                    ok: true,
                    command: 'close',
                    action: 'close',
                    task: toTaskJson(task),
                    evidence_path: toRelativeRepoPath(evidencePath),
                    lease_action: leaseMeta?.lease_action || 'none',
                    lease: leaseMeta?.lease || null,
                    status_since_at: leaseMeta?.status_since_at || null,
                },
                null,
                2
            )
        );
        return;
    }

    console.log(`Tarea cerrada: ${taskId}`);
}

module.exports = {
    handleCloseCommand,
};
