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

function formatStrategySummary(summary = {}) {
    if (!summary?.active) {
        return 'Sin estrategia activa.';
    }
    return [
        `Estrategia activa: ${summary.active.id} (${summary.active.title || 'sin titulo'})`,
        `Cobertura: aligned=${summary.aligned_tasks || 0}, support=${summary.support_tasks || 0}, exception=${summary.exception_tasks || 0}, orphan=${summary.orphan_tasks || 0}`,
    ].join('\n');
}

async function handleStrategyCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        buildStrategyCoverageSummary,
        buildStrategySeed,
        normalizeStrategyActive,
        validateStrategyConfiguration,
        currentDate,
        detectDefaultOwner,
        writeBoardAndSync,
        writeStrategyActiveBlock,
        parseExpectedBoardRevisionFlag,
        parseCodexStrategyBlocks,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
    } = ctx;
    const wantsJson = args.includes('--json');
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const { flags } = parseFlags(args.slice(1));

    if (!['status', 'set-active', 'close'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js strategy <status|set-active|close> [--seed admin-operativo] [--reason ...] [--expect-rev N] [--json]'
        );
    }

    const board = parseBoard();
    if (subcommand === 'status') {
        const summary = buildStrategyCoverageSummary(board);
        const planBlocks =
            typeof parseCodexStrategyBlocks === 'function'
                ? parseCodexStrategyBlocks()
                : [];
        const payload = {
            version: 1,
            ok: true,
            command: 'strategy',
            action: 'status',
            strategy: summary,
            plan_blocks: planBlocks,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(formatStrategySummary(summary));
        return payload;
    }

    if (subcommand === 'set-active') {
        const seed = String(flags.seed || '').trim();
        if (!seed) {
            throw new Error(
                'strategy set-active requiere --seed (por ahora: admin-operativo)'
            );
        }
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'strategy set-active' }
        );
        const strategy = normalizeStrategyActive(
            buildStrategySeed(seed, {
                currentDate,
                owner:
                    String(flags.owner || '').trim() ||
                    detectDefaultOwner() ||
                    'ernesto',
                detectDefaultOwner,
            })
        );
        const configErrors = validateStrategyConfiguration(
            { strategy: { active: strategy } },
            {}
        );
        if (configErrors.length > 0) {
            throw new Error(
                `strategy set-active invalido: ${configErrors.join(' | ')}`
            );
        }

        board.strategy = { active: strategy };
        const coverage = buildStrategyCoverageSummary(board);
        if (coverage.orphan_tasks > 0) {
            throw new Error(
                `strategy set-active bloqueado: tareas activas no alineadas (${coverage.orphan_task_ids.join(', ')})`
            );
        }

        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'strategy set-active',
            actor: strategy.owner || '',
            expectRevision,
        });
        writeStrategyActiveBlock(strategy);

        const payload = {
            version: 1,
            ok: true,
            command: 'strategy',
            action: 'set-active',
            strategy,
            coverage,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Strategy set-active OK: ${strategy.id} (${strategy.title || 'sin titulo'})`
        );
        return payload;
    }

    const configured = board?.strategy?.active || null;
    if (!configured || typeof configured !== 'object') {
        throw new Error('strategy close requiere strategy.active configurada');
    }
    const activeSummary = buildStrategyCoverageSummary(board);
    if (activeSummary.active && activeSummary.active_tasks_total > 0) {
        throw new Error(
            `strategy close bloqueado: hay ${activeSummary.active_tasks_total} tarea(s) activa(s)`
        );
    }
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'strategy close' }
    );
    const reason = String(flags.reason || flags['close-reason'] || '')
        .trim()
        .toLowerCase();
    board.strategy = {
        active: normalizeStrategyActive({
            ...configured,
            status: 'closed',
            closed_at: String(currentDate()).trim(),
            close_reason: reason || 'manual_close',
        }),
    };
    writeBoardAndSync(board, {
        silentSync: wantsJson,
        command: 'strategy close',
        actor: String(configured.owner || '').trim(),
        expectRevision,
    });
    writeStrategyActiveBlock(board.strategy.active);

    const payload = {
        version: 1,
        ok: true,
        command: 'strategy',
        action: 'close',
        strategy: board.strategy.active,
    };
    if (wantsJson) {
        printJson(payload);
        return payload;
    }
    console.log(
        `Strategy close OK: ${board.strategy.active.id} reason=${board.strategy.active.close_reason || 'manual_close'}`
    );
    return payload;
}

module.exports = {
    handleStrategyCommand,
};
