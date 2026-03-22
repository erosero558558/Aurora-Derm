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
    const lines = [];
    if (summary?.active) {
        lines.push(
            `Estrategia activa: ${summary.active.id} (${summary.active.title || 'sin titulo'})`
        );
        lines.push(
            `Cobertura: aligned=${summary.aligned_tasks || 0}, support=${summary.support_tasks || 0}, exception=${summary.exception_tasks || 0}, orphan=${summary.orphan_tasks || 0}, dispersion=${summary.dispersion_score || 0}, slot_tasks=${summary.slot_tasks || 0}`
        );
    } else {
        lines.push('Sin estrategia activa.');
    }
    if (summary?.next) {
        lines.push(
            `Draft siguiente: ${summary.next.id} (${summary.next.title || 'sin titulo'})`
        );
    }
    const overloaded = Array.isArray(summary?.rows)
        ? summary.rows.filter((row) => row.exceeds_wip_limit)
        : [];
    if (overloaded.length > 0) {
        lines.push(
            `Subfrentes saturados: ${overloaded
                .map(
                    (row) =>
                        `${row.subfront_id}(${row.slot_tasks}/${row.wip_limit})`
                )
                .join(', ')}`
        );
    }
    const laneRows = Array.isArray(summary?.lane_rows) ? summary.lane_rows : [];
    if (laneRows.length > 0) {
        lines.push(
            `Lanes: ${laneRows
                .map(
                    (row) =>
                        `${row.codex_instance}=${row.slot_tasks}/${row.lane_capacity} slots`
                )
                .join(', ')}`
        );
    }
    if (Number(summary?.exception_expired_tasks || 0) > 0) {
        lines.push(
            `Deuda exception expirada: ${summary.exception_expired_tasks} (${(summary.exception_expired_task_ids || []).join(', ')})`
        );
    }
    return lines.join('\n');
}

function buildStrategySnapshotEvent(action, board, extra = {}) {
    return {
        event_type: `strategy.${action}`,
        occurred_at:
            String(extra.occurred_at || '').trim() || new Date().toISOString(),
        actor: String(extra.actor || '').trim(),
        command: String(extra.command || `strategy ${action}`).trim(),
        reason: String(extra.reason || '').trim(),
        strategy: {
            active: board?.strategy?.active || null,
            next: board?.strategy?.next || null,
            updated_at: String(board?.strategy?.updated_at || '').trim(),
        },
        meta: extra.meta || null,
    };
}

async function handleStrategyCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseCsvList,
        parseBoard,
        parseHandoffs,
        buildStrategyCoverageSummary,
        buildCoverageForStrategy,
        buildStrategySeed,
        buildStrategyPreview,
        buildStrategySeedCatalog,
        buildStrategyIntakeTask,
        normalizeStrategyActive,
        validateStrategyConfiguration,
        currentDate,
        isoNow,
        detectDefaultOwner,
        writeBoardAndSync,
        writeStrategyPlanBlocks,
        appendStrategySnapshot,
        nextAgentTaskId,
        validateTaskGovernancePrechecks,
        getBlockingConflictsForTask,
        toTaskJson,
        toTaskFullJson,
        mapLaneToCodexInstance,
        parseExpectedBoardRevisionFlag,
        parseCodexStrategyBlocks,
        findAlignedActiveCodexMirrorTasks,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
    } = ctx;
    const wantsJson = args.includes('--json');
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const { flags } = parseFlags(args.slice(1));

    if (
        ![
            'status',
            'preview',
            'set-next',
            'activate-next',
            'set-active',
            'close',
            'intake',
        ].includes(subcommand)
    ) {
        throw new Error(
            'Uso: node agent-orchestrator.js strategy <status|preview|set-next|activate-next|set-active|close|intake> [--seed admin-operativo] [--title ... --scope ... --files a,b] [--reason ...] [--expect-rev N] [--json]'
        );
    }

    const board = parseBoard();
    const planBlocks =
        typeof parseCodexStrategyBlocks === 'function'
            ? parseCodexStrategyBlocks()
            : { active: [], next: [] };

    if (subcommand === 'status') {
        const summary = buildStrategyCoverageSummary(board);
        const payload = {
            version: 1,
            ok: true,
            command: 'strategy',
            action: 'status',
            strategy: summary,
            plan_blocks: planBlocks,
            seed_catalog: buildStrategySeedCatalog(),
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(formatStrategySummary(summary));
        return payload;
    }

    if (subcommand === 'preview') {
        const seed = String(flags.seed || '').trim();
        if (!seed) {
            throw new Error('strategy preview requiere --seed');
        }
        const preview = buildStrategyPreview(board, seed, {
            currentDate,
            owner:
                String(flags.owner || '').trim() ||
                detectDefaultOwner() ||
                'ernesto',
        });
        const payload = {
            version: 1,
            ok: preview.ok,
            command: 'strategy',
            action: 'preview',
            preview,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Preview ${preview.activation_ready ? 'OK' : 'BLOCKED'}: ${preview.candidate.id}`
        );
        for (const blocker of preview.activation_blockers || []) {
            console.log(`- ${blocker}`);
        }
        return payload;
    }

    if (subcommand === 'set-active') {
        const active = board?.strategy?.active || null;
        if (
            active &&
            String(active.status || '')
                .trim()
                .toLowerCase() === 'active'
        ) {
            throw new Error(
                'strategy set-active queda solo para bootstrap; usa set-next -> activate-next cuando ya existe strategy.active'
            );
        }
        const seed = String(flags.seed || '').trim();
        if (!seed) {
            throw new Error('strategy set-active requiere --seed');
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
            })
        );
        const nextBoard = {
            ...board,
            strategy: {
                active: strategy,
                next: null,
                updated_at: currentDate(),
            },
        };
        const configErrors = validateStrategyConfiguration(nextBoard);
        const coverage = buildStrategyCoverageSummary(nextBoard);
        if (configErrors.length > 0) {
            throw new Error(
                `strategy set-active invalido: ${configErrors.join(' | ')}`
            );
        }
        if (coverage.orphan_tasks > 0) {
            throw new Error(
                `strategy set-active bloqueado: tareas activas no alineadas (${coverage.orphan_task_ids.join(', ')})`
            );
        }
        writeBoardAndSync(nextBoard, {
            silentSync: wantsJson,
            command: 'strategy set-active',
            actor: strategy.owner || '',
            expectRevision,
        });
        writeStrategyPlanBlocks(nextBoard.strategy);
        appendStrategySnapshot(
            buildStrategySnapshotEvent('set-active', nextBoard, {
                actor: strategy.owner || '',
                command: 'strategy set-active',
                occurred_at: isoNow(),
                meta: { compatibility_mode: true },
            })
        );
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

    if (subcommand === 'set-next') {
        const seed = String(flags.seed || '').trim();
        if (!seed) {
            throw new Error('strategy set-next requiere --seed');
        }
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'strategy set-next' }
        );
        const preview = buildStrategyPreview(board, seed, {
            currentDate,
            owner:
                String(flags.owner || '').trim() ||
                detectDefaultOwner() ||
                'ernesto',
        });
        const draftBlockers = [
            ...(preview.validation_errors || []),
            ...(preview.scope_collisions || []),
        ];
        if (draftBlockers.length > 0) {
            throw new Error(
                `strategy set-next invalido: ${draftBlockers.join(' | ')}`
            );
        }
        board.strategy = {
            active: board?.strategy?.active || null,
            next: preview.candidate,
            updated_at: currentDate(),
        };
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'strategy set-next',
            actor: preview.candidate.owner || '',
            expectRevision,
        });
        writeStrategyPlanBlocks(board.strategy);
        appendStrategySnapshot(
            buildStrategySnapshotEvent('set-next', board, {
                actor: preview.candidate.owner || '',
                command: 'strategy set-next',
                occurred_at: isoNow(),
                meta: {
                    seed: preview.seed,
                    activation_ready: preview.activation_ready,
                    activation_blockers: preview.activation_blockers,
                },
            })
        );
        const payload = {
            version: 1,
            ok: true,
            command: 'strategy',
            action: 'set-next',
            strategy: board.strategy.next,
            preview,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Strategy set-next OK: ${board.strategy.next.id} (activation_ready=${preview.activation_ready})`
        );
        return payload;
    }

    if (subcommand === 'activate-next') {
        const nextStrategy = board?.strategy?.next || null;
        if (!nextStrategy || typeof nextStrategy !== 'object') {
            throw new Error('strategy activate-next requiere strategy.next');
        }
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'strategy activate-next' }
        );
        const reason =
            String(flags.reason || '')
                .trim()
                .toLowerCase() || 'activate_next';
        const configErrors = validateStrategyConfiguration(board);
        const impact = buildCoverageForStrategy(board, nextStrategy, {
            nowIso: isoNow(),
        });
        const activationBlockers = [
            ...configErrors,
            ...(impact.scope_collisions || []),
            ...(impact.orphan_tasks > 0
                ? [
                      `strategy activate-next bloqueado: tareas activas fuera del nuevo frente (${impact.orphan_task_ids.join(', ')})`,
                  ]
                : []),
            ...(impact.exception_expired_tasks > 0
                ? [
                      `strategy activate-next bloqueado: exceptions expiradas (${impact.exception_expired_task_ids.join(', ')})`,
                  ]
                : []),
        ];
        if (activationBlockers.length > 0) {
            throw new Error(activationBlockers.join(' | '));
        }

        const previousActive = board?.strategy?.active || null;
        board.strategy = {
            active: normalizeStrategyActive({
                ...nextStrategy,
                status: 'active',
                started_at: currentDate(),
                closed_at: '',
                close_reason: '',
            }),
            next: null,
            updated_at: currentDate(),
        };
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'strategy activate-next',
            actor: String(board.strategy.active?.owner || '').trim(),
            expectRevision,
        });
        writeStrategyPlanBlocks(board.strategy);
        appendStrategySnapshot(
            buildStrategySnapshotEvent('activate-next', board, {
                actor: String(board.strategy.active?.owner || '').trim(),
                command: 'strategy activate-next',
                occurred_at: isoNow(),
                reason,
                meta: {
                    previous_active: previousActive,
                },
            })
        );
        const payload = {
            version: 1,
            ok: true,
            command: 'strategy',
            action: 'activate-next',
            reason,
            strategy: board.strategy.active,
            previous_active: previousActive,
            impact,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Strategy activate-next OK: ${board.strategy.active.id} reason=${reason}`
        );
        return payload;
    }

    if (subcommand === 'close') {
        const configured = board?.strategy?.active || null;
        if (!configured || typeof configured !== 'object') {
            throw new Error(
                'strategy close requiere strategy.active configurada'
            );
        }
        if (board?.strategy?.next) {
            throw new Error(
                'strategy close requiere strategy.next vacia; usa activate-next para promocionar el draft'
            );
        }
        const activeSummary = buildStrategyCoverageSummary(board);
        if (activeSummary.active && activeSummary.active_tasks_total > 0) {
            throw new Error(
                `strategy close bloqueado: hay ${activeSummary.active_tasks_total} tarea(s) activa(s)`
            );
        }
        if (activeSummary.exception_expired_tasks > 0) {
            throw new Error(
                `strategy close bloqueado: exceptions expiradas (${activeSummary.exception_expired_task_ids.join(', ')})`
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
            next: null,
            updated_at: currentDate(),
        };
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'strategy close',
            actor: String(configured.owner || '').trim(),
            expectRevision,
        });
        writeStrategyPlanBlocks(board.strategy);
        appendStrategySnapshot(
            buildStrategySnapshotEvent('close', board, {
                actor: String(configured.owner || '').trim(),
                command: 'strategy close',
                occurred_at: isoNow(),
                reason: reason || 'manual_close',
            })
        );

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

    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'strategy intake' }
    );
    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth({
                  allWorktrees: true,
                  currentOnly: false,
              })
            : null;
    if (typeof assertWorkspaceTruthOk === 'function') {
        assertWorkspaceTruthOk(workspaceReport, {
            commandLabel: 'strategy intake',
        });
    }
    const files = parseCsvList(flags.files || '');
    const { task, subfront, intake_defaults } = buildStrategyIntakeTask(
        board,
        {
            title: flags.title,
            scope: flags.scope,
            files,
            subfront_id: flags['subfront-id'] || flags.subfront_id || '',
            owner: flags.owner,
            executor: flags.executor,
            status: flags.status,
            risk: flags.risk,
            prompt: flags.prompt,
        },
        {
            currentDate,
            nowIso: isoNow,
            detectDefaultOwner,
            nextAgentTaskId,
            mapLaneToCodexInstance,
        }
    );
    if (
        /^AG-\d+$/i.test(String(task.id || '').trim()) &&
        String(task.executor || '')
            .trim()
            .toLowerCase() === 'codex' &&
        typeof findAlignedActiveCodexMirrorTasks === 'function'
    ) {
        const alignedMirrors = findAlignedActiveCodexMirrorTasks(board, task, {
            activeStatuses: new Set(['ready', 'in_progress', 'review', 'blocked']),
        }).map((candidate) => String(candidate?.id || '').trim());
        if (alignedMirrors.length === 0) {
            throw new Error(
                `strategy intake requiere CDX-* activa alineada antes de abrir soporte AG para ${task.id}`
            );
        }
        task.depends_on = Array.from(
            new Set([
                ...(Array.isArray(task.depends_on) ? task.depends_on : []),
                alignedMirrors[0],
            ])
        );
    }
    const handoffs = parseHandoffs();
    validateTaskGovernancePrechecks(board, task, {
        handoffs: handoffs.handoffs,
        nowIso: isoNow(),
    });
    board.tasks.push(task);
    const blockingConflicts = getBlockingConflictsForTask(
        board.tasks,
        task.id,
        handoffs.handoffs
    );
    if (blockingConflicts.length > 0) {
        throw new Error(
            `strategy intake bloqueado por conflicto activo: ${blockingConflicts
                .map((item) => {
                    const other =
                        String(item.left.id) === task.id
                            ? item.right
                            : item.left;
                    const filesText = item.overlap_files.length
                        ? item.overlap_files.join(', ')
                        : '(wildcard ambiguo)';
                    return `${task.id} <-> ${other.id} :: ${filesText}`;
                })
                .join(' | ')}`
        );
    }
    writeBoardAndSync(board, {
        silentSync: wantsJson,
        command: 'strategy intake',
        actor: task.owner || task.executor || '',
        expectRevision,
    });
    const payload = {
        version: 1,
        ok: true,
        command: 'strategy',
        action: 'intake',
        task: toTaskJson(task),
        task_full: toTaskFullJson(task),
        subfront,
        intake_defaults,
    };
    if (wantsJson) {
        printJson(payload);
        return payload;
    }
    console.log(
        `Strategy intake OK: ${task.id} -> ${subfront.subfront_id} [${task.strategy_role}]`
    );
    return payload;
}

module.exports = {
    handleStrategyCommand,
};
