'use strict';

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
        toTaskJson,
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

    writeFileSync(BOARD_PATH, serializeBoard(board), 'utf8');
    syncDerivedQueues({ silent: wantsJson });

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
