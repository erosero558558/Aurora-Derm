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

async function handleCodexCheckCommand(ctx) {
    const {
        args = [],
        buildCodexCheckReport,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        parseBoard,
        parseHandoffs,
        loadMetricsSnapshot,
        loadJobsSnapshot,
    } = ctx;
    const wantsJson = args.includes('--json');
    const report = buildCodexCheckReport();
    const metricsSnapshot =
        typeof loadMetricsSnapshot === 'function'
            ? loadMetricsSnapshot()
            : null;
    const jobsSnapshot =
        typeof loadJobsSnapshot === 'function'
            ? await loadJobsSnapshot()
            : null;
    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'codex-check',
            board: parseBoard(),
            handoffData: parseHandoffs(),
            metricsSnapshot,
            jobsSnapshot,
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

async function handleCodexCommand(ctx) {
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
        parseExpectedBoardRevisionFlag,
        buildBoardWipLimitDiagnostics,
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
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'codex start' }
        );
        const taskInstance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const codexTasks = board.tasks.filter((item) => {
            if (String(item.id || '') === taskId) return false;
            if (String(item.status || '') !== 'in_progress') return false;
            if (
                String(item.executor || '')
                    .trim()
                    .toLowerCase() !== 'codex'
            )
                return false;
            const itemInstance = String(
                item.codex_instance || 'codex_backend_ops'
            )
                .trim()
                .toLowerCase();
            return itemInstance === taskInstance;
        });
        if (codexTasks.length > 0) {
            throw new Error(
                `No se puede iniciar ${taskId}; ya hay task codex in_progress en ${taskInstance}: ${codexTasks
                    .map((item) => item.id)
                    .join(', ')}`
            );
        }

        if (filesOverride && filesOverride.length > 0) {
            task.files = filesOverride;
        }
        task.status = 'in_progress';
        task.updated_at = currentDate();
        writeBoard(board, {
            command: 'codex start',
            actor: task.owner || task.executor || '',
            expectRevision,
        });
        const wipDiagnostics =
            typeof buildBoardWipLimitDiagnostics === 'function'
                ? buildBoardWipLimitDiagnostics(board, {
                      source: 'codex start',
                      taskIds: [taskId],
                      executors: [task.executor],
                      scopes: [task.scope],
                  })
                : [];
        writeCodexActiveBlock({
            codex_instance: taskInstance,
            block,
            task_id: taskId,
            status: 'in_progress',
            files: task.files || [],
            updated_at: currentDate(),
        });
        await runCodexCheck();
        console.log(`Codex start OK: ${taskId} (${block})`);
        for (const diag of wipDiagnostics) {
            console.log(`WARN [${diag.code}] ${diag.message}`);
        }
        return;
    }

    const nextStatus = String(flags.to || 'review').trim();
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'codex stop' }
    );
    if (!ALLOWED_STATUSES.has(nextStatus)) {
        throw new Error(`Status destino invalido: ${nextStatus}`);
    }
    task.status = nextStatus;
    task.updated_at = currentDate();
    writeBoard(board, {
        command: 'codex stop',
        actor: task.owner || task.executor || '',
        expectRevision,
    });

    if (ACTIVE_STATUSES.has(nextStatus)) {
        const taskInstance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const existingBlock =
            parseCodexActiveBlocks().find(
                (item) =>
                    String(item.codex_instance || 'codex_backend_ops')
                        .trim()
                        .toLowerCase() === taskInstance
            ) || {};
        writeCodexActiveBlock({
            codex_instance: taskInstance,
            block: String(flags.block || existingBlock.block || 'C1'),
            task_id: taskId,
            status: nextStatus,
            files: task.files || [],
            updated_at: currentDate(),
        });
    } else {
        writeCodexActiveBlock(null, {
            codex_instance: String(task.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase(),
        });
    }
    await runCodexCheck();
    console.log(`Codex stop OK: ${taskId} -> ${nextStatus}`);
}

module.exports = {
    handleCodexCheckCommand,
    handleCodexCommand,
};
