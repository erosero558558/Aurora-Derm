'use strict';

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'runtime command' } = options;
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

async function handleRuntimeCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        currentDate,
        isoNow,
        writeBoardAndSync,
        toTaskJson,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
        verifyOpenClawRuntime,
        invokeOpenClawRuntime,
        parseExpectedBoardRevisionFlag,
        OPENCLAW_PROVIDER,
        PILOT_RUNTIME_PROVIDER,
        getGovernancePolicy,
        rootPath,
        fetchImpl,
    } = ctx;
    const subcommand = String(args[0] || 'verify')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { flags, positionals } = parseFlags(args.slice(1));

    if (!['verify', 'invoke'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js runtime <verify|invoke> [pilot_runtime|openclaw_chatgpt|task_id] [--expect-rev n] [--json]'
        );
    }

    if (subcommand === 'verify') {
        const provider = String(positionals[0] || PILOT_RUNTIME_PROVIDER)
            .trim()
            .toLowerCase();
        if (![PILOT_RUNTIME_PROVIDER, OPENCLAW_PROVIDER].includes(provider)) {
            const error = new Error(
                `runtime verify: provider invalido (${provider})`
            );
            error.code = 'invalid_provider';
            error.error_code = 'invalid_provider';
            throw error;
        }
        const runtime = await verifyOpenClawRuntime({
            fetchImpl,
            governancePolicy: getGovernancePolicy(),
            rootPath,
            provider,
        });
        const report = {
            version: 1,
            ok: Boolean(runtime.ok),
            command: 'runtime verify',
            provider,
            runtime,
        };
        if (wantsJson) {
            printJson(report);
            if (!report.ok) process.exitCode = 1;
            return report;
        }
        if (!report.ok) {
            const summaryMessage = String(
                runtime?.summary?.message || ''
            ).trim();
            throw new Error(
                `runtime verify fallo para ${provider}: ${
                    summaryMessage ||
                    runtime.surfaces
                        .filter((surface) => !surface.healthy)
                        .map((surface) => surface.surface)
                        .join(', ')
                }`
            );
        }
        const runtimeState = String(runtime?.summary?.state || 'healthy').trim();
        console.log(
            `OK: ${provider} ${runtimeState === 'healthy' ? 'healthy' : `ready (${runtimeState})`} en ${
                String(runtime?.summary?.message || '').trim() ||
                runtime.surfaces
                    .map((surface) => `${surface.surface}=${surface.state}`)
                    .join(', ')
            }`
        );
        return report;
    }

    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!taskId) {
        throw new Error('runtime invoke requiere task_id');
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'runtime invoke' }
    );
    const result = await invokeOpenClawRuntime(task, {
        fetchImpl,
        governancePolicy: getGovernancePolicy(),
        rootPath,
    });

    task.runtime_last_transport = String(result.runtime_transport || '').trim();
    task.last_attempt_at = isoNow();
    task.attempts =
        (Number.parseInt(String(task.attempts || '0'), 10) || 0) + 1;
    task.updated_at = currentDate();
    if (!result.ok) {
        task.blocked_reason = String(
            result.errorCode || result.error || 'runtime_invoke_failed'
        );
    } else {
        task.blocked_reason = '';
    }

    writeBoardAndSync(board, {
        silentSync: wantsJson,
        command: 'runtime invoke',
        actor: task.owner || 'runtime',
        expectRevision,
    });

    const report = {
        version: 1,
        ok: Boolean(result.ok),
        command: 'runtime invoke',
        task: toTaskJson(task),
        result,
    };
    if (wantsJson) {
        printJson(report);
        if (!report.ok) process.exitCode = 1;
        return report;
    }
    if (!report.ok) {
        throw new Error(
            `runtime invoke fallo para ${taskId}: ${result.errorCode || result.error || 'unknown_error'}`
        );
    }
    console.log(
        `Runtime invoke OK: ${taskId} -> ${result.runtime_surface} (${result.runtime_transport})`
    );
    return report;
}

module.exports = {
    handleRuntimeCommand,
};
