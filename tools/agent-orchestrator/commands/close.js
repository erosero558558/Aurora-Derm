'use strict';

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
        parseHandoffs,
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
    task.acceptance_ref = toRelativeRepoPath(evidencePath);
    board.policy.updated_at = currentDate();
    if (typeof writeBoardAndSync === 'function') {
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'close' }
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
