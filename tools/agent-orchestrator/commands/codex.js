'use strict';

function handleCodexCheckCommand(ctx) {
    const {
        args = [],
        buildCodexCheckReport,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        parseBoard,
        parseHandoffs,
    } = ctx;
    const wantsJson = args.includes('--json');
    const report = buildCodexCheckReport();
    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'codex-check',
            board: parseBoard(),
            handoffData: parseHandoffs(),
        })
    );

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (!report.ok) {
            process.exitCode = 1;
        }
        return reportWithDiagnostics;
    }

    if (!report.ok) {
        throw new Error(
            `Codex mirror invalido:\n- ${report.errors.join('\n- ')}`
        );
    }

    console.log('OK: espejo Codex valido.');
    return report;
}

function handleCodexCommand(ctx) {
    const {
        args,
        parseFlags,
        ensureTask,
        parseBoard,
        ACTIVE_STATUSES,
        ALLOWED_STATUSES,
        parseCsvList,
        currentDate,
        writeBoard,
        writeCodexActiveBlock,
        parseCodexActiveBlocks,
        runCodexCheck,
    } = ctx;
    const subcommand = args[0];
    const { positionals, flags } = parseFlags(args.slice(1));
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!subcommand || !['start', 'stop'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js codex <start|stop> <CDX-001> [--block C1] [--to review|done|blocked]'
        );
    }
    if (!taskId) {
        throw new Error('Codex command requiere task_id (CDX-###)');
    }
    if (!/^CDX-\d+$/.test(taskId)) {
        throw new Error(`task_id Codex invalido: ${taskId}`);
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    if (String(task.executor) !== 'codex') {
        throw new Error(`Task ${taskId} no pertenece a executor codex`);
    }

    if (subcommand === 'start') {
        const block = String(flags.block || 'C1').trim();
        const filesOverride = flags.files ? parseCsvList(flags.files) : null;
        const codexTasks = board.tasks.filter(
            (item) =>
                /^CDX-\d+$/.test(String(item.id || '')) &&
                item.id !== taskId &&
                item.status === 'in_progress'
        );
        if (codexTasks.length > 0) {
            throw new Error(
                `No se puede iniciar ${taskId}; ya hay CDX in_progress: ${codexTasks
                    .map((item) => item.id)
                    .join(', ')}`
            );
        }

        if (filesOverride && filesOverride.length > 0) {
            task.files = filesOverride;
        }
        task.status = 'in_progress';
        task.updated_at = currentDate();
        writeBoard(board);
        writeCodexActiveBlock({
            block,
            task_id: taskId,
            status: 'in_progress',
            files: task.files || [],
            updated_at: currentDate(),
        });
        runCodexCheck();
        console.log(`Codex start OK: ${taskId} (${block})`);
        return;
    }

    const nextStatus = String(flags.to || 'review').trim();
    if (!ALLOWED_STATUSES.has(nextStatus)) {
        throw new Error(`Status destino invalido: ${nextStatus}`);
    }
    task.status = nextStatus;
    task.updated_at = currentDate();
    writeBoard(board);

    if (ACTIVE_STATUSES.has(nextStatus)) {
        const existingBlock = parseCodexActiveBlocks()[0] || {};
        writeCodexActiveBlock({
            block: String(flags.block || existingBlock.block || 'C1'),
            task_id: taskId,
            status: nextStatus,
            files: task.files || [],
            updated_at: currentDate(),
        });
    } else {
        writeCodexActiveBlock(null);
    }
    runCodexCheck();
    console.log(`Codex stop OK: ${taskId} -> ${nextStatus}`);
}

module.exports = {
    handleCodexCheckCommand,
    handleCodexCommand,
};
