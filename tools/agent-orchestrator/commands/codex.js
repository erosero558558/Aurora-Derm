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

function getCodexParallelismPolicy(getGovernancePolicy) {
    const policy =
        typeof getGovernancePolicy === 'function' ? getGovernancePolicy() : {};
    const raw = policy?.enforcement?.codex_parallelism || {};
    const slotStatuses = Array.isArray(raw.slot_statuses)
        ? raw.slot_statuses
              .map((value) => String(value || '').trim())
              .filter(Boolean)
        : ['in_progress', 'review', 'blocked'];
    const byCodexInstance = {
        codex_backend_ops: Number.parseInt(
            String(raw?.by_codex_instance?.codex_backend_ops ?? '2'),
            10
        ),
        codex_frontend: Number.parseInt(
            String(raw?.by_codex_instance?.codex_frontend ?? '2'),
            10
        ),
        codex_transversal: Number.parseInt(
            String(raw?.by_codex_instance?.codex_transversal ?? '2'),
            10
        ),
    };
    for (const [key, value] of Object.entries(byCodexInstance)) {
        if (!Number.isInteger(value) || value <= 0) {
            byCodexInstance[key] = 2;
        }
    }
    return {
        slot_statuses: slotStatuses,
        slot_statuses_set: new Set(slotStatuses),
        by_codex_instance: byCodexInstance,
    };
}

function normalizeToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function flagBoolean(value) {
    return ['1', 'true', 'yes', 'y', 'si', 's', 'on'].includes(
        normalizeToken(value)
    );
}

function buildCodexUsageError(message, code = 'codex_invalid_usage') {
    const error = new Error(message);
    error.code = code;
    error.error_code = code;
    return error;
}

function ensureCodexTask(task, taskId) {
    if (
        String(task?.executor || '')
            .trim()
            .toLowerCase() !== 'codex'
    ) {
        throw buildCodexUsageError(
            `Task ${taskId} no pertenece a executor codex`
        );
    }
    return task;
}

async function handleCodexPremiumRecordCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        ACTIVE_STATUSES,
        parseExpectedBoardRevisionFlag,
        getGovernancePolicy,
        loadModelUsageLedger,
        appendModelUsageLedgerEntries,
        syncTaskModelRoutingState,
        buildTaskModelUsageSummary,
        validateDecisionPacketFile,
        currentDate,
        writeBoard,
        runCodexCheck,
        printJson,
        toTaskJson,
    } = ctx;
    const { positionals, flags } = parseFlags(args);
    const action = normalizeToken(positionals[0] || 'record');
    if (action !== 'record') {
        throw buildCodexUsageError(
            'Uso: node agent-orchestrator.js codex premium record <CDX-001> --decision-packet-ref verification/codex-decisions/CDX-001-1.md --reason critical_review --execution-mode subagent --premium-session-id sess-001 [--avoided-rework true] [--notes "..."] [--json]'
        );
    }

    const taskId = String(positionals[1] || flags.id || '').trim();
    if (!taskId) {
        throw buildCodexUsageError(
            'codex premium record requiere task_id (CDX-###)'
        );
    }
    if (!/^CDX-\d+$/i.test(taskId)) {
        throw buildCodexUsageError(`task_id Codex invalido: ${taskId}`);
    }

    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'codex premium record' }
    );
    const board = parseBoard();
    const task = ensureCodexTask(ensureTask(board, taskId), taskId);
    const taskStatus = String(task?.status || '').trim();
    if (!ACTIVE_STATUSES.has(taskStatus)) {
        throw buildCodexUsageError(
            `codex premium record requiere tarea CDX activa (actual: ${taskStatus || 'vacio'})`
        );
    }

    const policy =
        typeof getGovernancePolicy === 'function' ? getGovernancePolicy() : {};
    const routingPolicy =
        policy?.codex_model_routing &&
        typeof policy.codex_model_routing === 'object'
            ? policy.codex_model_routing
            : policy;
    const reason = normalizeToken(flags.reason || '');
    const executionMode = normalizeToken(
        flags['execution-mode'] || flags.execution_mode || ''
    );
    const decisionPacketRef = String(
        flags['decision-packet-ref'] || flags.decision_packet_ref || ''
    ).trim();
    const premiumSessionId = String(
        flags['premium-session-id'] || flags.premium_session_id || ''
    ).trim();
    const notes = String(flags.notes || '').trim();
    const outcome = normalizeToken(flags.outcome || 'recorded');
    const avoidedRework = flagBoolean(
        flags['avoided-rework'] || flags.avoided_rework || false
    );

    const allowedReasons = new Set(routingPolicy.premium_reasons || []);
    if (!reason || !allowedReasons.has(reason)) {
        throw buildCodexUsageError(
            `codex premium record requiere --reason valido (${Array.from(
                allowedReasons
            ).join(', ')})`
        );
    }
    const allowedExecutionModes = new Set(
        routingPolicy.allowed_execution_modes || []
    );
    if (!executionMode || !allowedExecutionModes.has(executionMode)) {
        throw buildCodexUsageError(
            `codex premium record requiere --execution-mode valido (${Array.from(
                allowedExecutionModes
            ).join(', ')})`
        );
    }
    if (!decisionPacketRef) {
        throw buildCodexUsageError(
            'codex premium record requiere --decision-packet-ref'
        );
    }
    if (!premiumSessionId) {
        throw buildCodexUsageError(
            'codex premium record requiere --premium-session-id'
        );
    }

    const rootThreadModelTierFlag = String(
        flags['root-thread-model-tier'] || flags.root_thread_model_tier || ''
    ).trim();
    const rootThreadModelTier =
        rootThreadModelTierFlag ||
        (executionMode === 'subagent'
            ? String(
                  routingPolicy.root_thread_model_tier ||
                      routingPolicy.default_model_tier ||
                      'gpt-5.4-mini'
              )
            : String(routingPolicy.premium_model_tier || 'gpt-5.4'));
    if (
        executionMode === 'subagent' &&
        rootThreadModelTier !==
            String(
                routingPolicy.root_thread_model_tier ||
                    routingPolicy.default_model_tier ||
                    'gpt-5.4-mini'
            )
    ) {
        throw buildCodexUsageError(
            `execution_mode=subagent requiere root_thread_model_tier=${String(
                routingPolicy.root_thread_model_tier ||
                    routingPolicy.default_model_tier ||
                    'gpt-5.4-mini'
            )}`
        );
    }
    if (
        executionMode === 'main_thread_exception' &&
        rootThreadModelTier !==
            String(routingPolicy.premium_model_tier || 'gpt-5.4')
    ) {
        throw buildCodexUsageError(
            `execution_mode=main_thread_exception requiere root_thread_model_tier=${String(
                routingPolicy.premium_model_tier || 'gpt-5.4'
            )}`
        );
    }

    const packetValidation =
        typeof validateDecisionPacketFile === 'function'
            ? validateDecisionPacketFile(decisionPacketRef, {
                  taskId,
                  governancePolicy: routingPolicy,
              })
            : { ok: true, errors: [], relative_path: decisionPacketRef };
    if (!packetValidation.ok) {
        throw buildCodexUsageError(packetValidation.errors[0]);
    }

    const currentLedger =
        typeof loadModelUsageLedger === 'function'
            ? loadModelUsageLedger()
            : [];
    const currentSummary =
        typeof buildTaskModelUsageSummary === 'function'
            ? buildTaskModelUsageSummary(task, {
                  governancePolicy: routingPolicy,
                  ledgerEntries: currentLedger,
              })
            : null;
    if (
        currentSummary &&
        Number(currentSummary.premium_calls_used || 0) >=
            Number(currentSummary.premium_budget || 0)
    ) {
        throw buildCodexUsageError(
            `${taskId}: premium budget agotado (${currentSummary.premium_calls_used}/${currentSummary.premium_budget})`,
            'premium_budget_exhausted'
        );
    }

    const entry = {
        timestamp: new Date().toISOString(),
        task_id: taskId,
        codex_instance: String(task.codex_instance || '').trim(),
        model_tier: String(routingPolicy.premium_model_tier || 'gpt-5.4'),
        reason,
        decision_packet_ref:
            packetValidation.relative_path || decisionPacketRef,
        execution_mode: executionMode,
        budget_unit: String(
            routingPolicy.premium_budget_unit || 'premium_session'
        ),
        premium_session_id: premiumSessionId,
        root_thread_model_tier: rootThreadModelTier,
        avoided_rework: avoidedRework,
        outcome,
        notes,
    };
    if (typeof appendModelUsageLedgerEntries !== 'function') {
        throw buildCodexUsageError(
            'codex premium record requiere appendModelUsageLedgerEntries'
        );
    }
    appendModelUsageLedgerEntries(entry);
    const updatedLedger = [...currentLedger, entry];
    if (typeof syncTaskModelRoutingState === 'function') {
        syncTaskModelRoutingState(task, {
            governancePolicy: routingPolicy,
            ledgerEntries: updatedLedger,
        });
    }
    task.updated_at = currentDate();
    writeBoard(board, {
        command: 'codex premium record',
        actor: task.owner || task.executor || '',
        expectRevision,
    });

    const summary =
        typeof buildTaskModelUsageSummary === 'function'
            ? buildTaskModelUsageSummary(task, {
                  governancePolicy: routingPolicy,
                  ledgerEntries: updatedLedger,
              })
            : null;
    const payload = {
        version: 1,
        ok: true,
        command: 'codex',
        action: 'premium',
        subaction: 'record',
        task: typeof toTaskJson === 'function' ? toTaskJson(task) : null,
        ledger_entry: entry,
        model_usage_summary: summary,
    };
    if (flags.json || args.includes('--json')) {
        if (typeof printJson === 'function') {
            printJson(payload);
            return payload;
        }
        console.log(JSON.stringify(payload, null, 2));
        return payload;
    }
    console.log(
        `Codex premium record OK: ${taskId} | session=${premiumSessionId} | premium=${summary ? `${summary.premium_calls_used}/${summary.premium_budget}` : 'n/a'}`
    );
    return payload;
}

async function handleCodexCheckCommand(ctx) {
    const {
        args = [],
        parseFlags,
        buildCodexCheckReport,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        parseBoard,
        parseHandoffs,
        loadMetricsSnapshot,
        loadJobsSnapshot,
        buildLiveFocusSummary,
        verifyOpenClawRuntime,
        buildRuntimeBlockingErrors,
        loadModelUsageLedger,
        buildModelUsageSummary,
        collectPremiumGateBlockers,
        getGovernancePolicy,
        buildWorkspaceComplianceDiagnostics,
        collectWorkspaceTruth,
        buildWorkspaceTruthDiagnostics,
    } = ctx;
    const wantsJson = args.includes('--json');
    const { flags = {} } =
        typeof parseFlags === 'function' ? parseFlags(args) : { flags: {} };
    const workspaceOptions =
        args.includes('--current-only') || Boolean(flags['current-only']) || Boolean(flags.current_only)
            ? { currentOnly: true, allWorktrees: false }
            : { allWorktrees: true, currentOnly: false };
    const board = parseBoard();
    const report = buildCodexCheckReport();
    const focusData =
        typeof buildLiveFocusSummary === 'function'
            ? await buildLiveFocusSummary(board, { now: new Date() })
            : null;
    const hasActiveRuntimeTask = Array.isArray(board?.tasks)
        ? board.tasks.some((task) => {
              const status = String(task?.status || '')
                  .trim()
                  .toLowerCase();
              const codexInstance = String(task?.codex_instance || '')
                  .trim()
                  .toLowerCase();
              const providerMode = String(task?.provider_mode || '')
                  .trim()
                  .toLowerCase();
              return (
                  ['ready', 'in_progress', 'review', 'blocked'].includes(
                      status
                  ) &&
                  codexInstance === 'codex_transversal' &&
                  ['openclaw_chatgpt', 'google_oauth'].includes(providerMode)
              );
          })
        : false;
    const runtimeVerification =
        focusData?.runtimeVerification ||
        (hasActiveRuntimeTask && typeof verifyOpenClawRuntime === 'function'
            ? await verifyOpenClawRuntime()
            : null);
    if (runtimeVerification) {
        const runtimeErrors =
            typeof buildRuntimeBlockingErrors === 'function'
                ? buildRuntimeBlockingErrors(
                      Array.isArray(board?.tasks) ? board.tasks : [],
                      runtimeVerification
                  )
                : [];
        report.runtime = runtimeVerification;
        if (runtimeErrors.length > 0) {
            report.ok = false;
            report.error_count =
                Number(report.error_count || 0) + runtimeErrors.length;
            report.errors = [...(report.errors || []), ...runtimeErrors];
        }
    }
    const governancePolicy =
        typeof getGovernancePolicy === 'function'
            ? getGovernancePolicy()
            : null;
    const modelUsageLedger =
        typeof loadModelUsageLedger === 'function'
            ? loadModelUsageLedger()
            : [];
    const premiumGateBlockers =
        typeof collectPremiumGateBlockers === 'function'
            ? collectPremiumGateBlockers(board.tasks, {
                  governancePolicy,
                  ledgerEntries: modelUsageLedger,
              })
            : [];
    const modelUsageSummary =
        typeof buildModelUsageSummary === 'function'
            ? buildModelUsageSummary(board.tasks, {
                  governancePolicy,
                  ledgerEntries: modelUsageLedger,
                  blockers: premiumGateBlockers,
              })
            : null;
    report.model_usage_summary = modelUsageSummary;
    report.premium_budget_remaining = modelUsageSummary
        ? {
              total_active: modelUsageSummary.active_codex_tasks || 0,
              premium_budget_total:
                  modelUsageSummary.premium_budget_total_active || 0,
              premium_budget_remaining:
                  modelUsageSummary.premium_budget_remaining_active || 0,
          }
        : null;
    report.premium_gate_blockers = premiumGateBlockers;
    if (premiumGateBlockers.length > 0) {
        report.ok = false;
        report.error_count = Number(report.error_count || 0);
        for (const blocker of premiumGateBlockers) {
            const blockerErrors = Array.isArray(blocker.blockers)
                ? blocker.blockers
                : [];
            report.error_count += blockerErrors.length;
            report.errors = [...(report.errors || []), ...blockerErrors];
        }
    }
    const metricsSnapshot =
        typeof loadMetricsSnapshot === 'function'
            ? loadMetricsSnapshot()
            : null;
    const jobsSnapshot = Array.isArray(focusData?.jobs)
        ? focusData.jobs
        : typeof loadJobsSnapshot === 'function'
          ? await loadJobsSnapshot()
          : null;
    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth(workspaceOptions)
            : null;
    report.workspace_hygiene = workspaceReport?.workspace_hygiene || null;
    report.workspace_truth = workspaceReport?.workspace_truth || null;
    const reportWithDiagnostics = attachDiagnostics(
        report,
        [
            ...buildWarnFirstDiagnostics({
                source: 'codex-check',
                board,
                handoffData: parseHandoffs(),
                focusSummary: focusData?.summary || null,
                metricsSnapshot,
                jobsSnapshot,
            }),
            ...(
                typeof buildWorkspaceComplianceDiagnostics === 'function'
                    ? buildWorkspaceComplianceDiagnostics(board.tasks, {
                          source: 'codex-check',
                      })
                    : []
            ),
            ...(
                typeof buildWorkspaceTruthDiagnostics === 'function'
                    ? buildWorkspaceTruthDiagnostics(workspaceReport, {
                          source: 'codex-check',
                      })
                    : []
            ),
        ]
    );
    if (workspaceReport?.workspace_truth?.ok === false) {
        report.ok = false;
        report.error_count = Number(report.error_count || 0) + 1;
        report.errors = [
            ...(Array.isArray(report.errors) ? report.errors : []),
            `workspace truth bloqueado: ${workspaceReport.workspace_truth.blocking_reasons.join(', ') || 'workspace_truth_blocked'}`,
        ];
        reportWithDiagnostics.ok = false;
        reportWithDiagnostics.error_count = Number(report.error_count || 0);
        reportWithDiagnostics.errors = report.errors;
    }

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
        parseHandoffs,
        parseDecisions,
        ACTIVE_STATUSES,
        ALLOWED_STATUSES,
        parseCsvList,
        validateTaskGovernancePrechecks,
        currentDate,
        writeBoard,
        writeCodexActiveBlock,
        parseCodexActiveBlocks,
        parseExpectedBoardRevisionFlag,
        buildBoardWipLimitDiagnostics,
        runCodexCheck,
        getGovernancePolicy,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        ensureTaskWorktree,
        applyWorkspaceTaskSnapshot,
        mirrorWorkspaceBoard,
    } = ctx;
    const subcommand = args[0];
    const { positionals, flags } = parseFlags(args.slice(1));
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!subcommand || !['start', 'stop', 'premium'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js codex <start|stop|premium> ...'
        );
    }
    if (subcommand === 'premium') {
        return handleCodexPremiumRecordCommand({
            ...ctx,
            args: args.slice(1),
        });
    }
    if (!taskId) {
        throw new Error('Codex command requiere task_id (CDX-###)');
    }
    if (!/^CDX-\d+$/.test(taskId)) {
        throw new Error(`task_id Codex invalido: ${taskId}`);
    }

    const board = parseBoard();
    const task = ensureCodexTask(ensureTask(board, taskId), taskId);

    if (subcommand === 'start') {
        const workspaceReport =
            typeof collectWorkspaceTruth === 'function'
                ? collectWorkspaceTruth({
                      allWorktrees: true,
                      currentOnly: false,
                  })
                : null;
        if (typeof assertWorkspaceTruthOk === 'function') {
            assertWorkspaceTruthOk(workspaceReport, {
                commandLabel: 'codex start',
            });
        }
        const requestedRootThreadModel = String(
            flags['root-thread-model-tier'] ||
                flags.root_thread_model_tier ||
                flags.model ||
                flags['model-tier'] ||
                ''
        ).trim();
        if (
            requestedRootThreadModel &&
            requestedRootThreadModel !== 'gpt-5.4-mini'
        ) {
            throw buildCodexUsageError(
                'codex start no permite hilo principal premium; use gpt-5.4-mini como raiz y registre GPT-5.4 via codex premium record'
            );
        }
        const block = String(flags.block || 'C1').trim();
        const filesOverride = flags.files ? parseCsvList(flags.files) : null;
        const codexParallelism = getCodexParallelismPolicy(getGovernancePolicy);
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'codex start' }
        );
        const decisionsData =
            typeof parseDecisions === 'function'
                ? parseDecisions()
                : { decisions: [] };
        const taskInstance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const codexTasks = board.tasks.filter((item) => {
            if (String(item.id || '') === taskId) return false;
            if (
                String(item.executor || '')
                    .trim()
                    .toLowerCase() !== 'codex'
            )
                return false;
            if (
                !codexParallelism.slot_statuses_set.has(
                    String(item.status || '').trim()
                )
            ) {
                return false;
            }
            const itemInstance = String(
                item.codex_instance || 'codex_backend_ops'
            )
                .trim()
                .toLowerCase();
            return itemInstance === taskInstance;
        });
        const laneCapacity = Number(
            codexParallelism.by_codex_instance?.[taskInstance] || 2
        );
        if (codexTasks.length >= laneCapacity) {
            throw new Error(
                `No se puede iniciar ${taskId}; ${taskInstance} ya ocupa ${codexTasks.length}/${laneCapacity} slot(s): ${codexTasks
                    .map((item) => item.id)
                    .join(', ')}`
            );
        }

        if (filesOverride && filesOverride.length > 0) {
            task.files = filesOverride;
        }
        task.status = 'in_progress';
        task.updated_at = currentDate();
        const handoffData =
            typeof parseHandoffs === 'function'
                ? parseHandoffs()
                : { handoffs: [] };
        if (typeof validateTaskGovernancePrechecks === 'function') {
            validateTaskGovernancePrechecks(board, task, {
                allowSelf: true,
                handoffs: Array.isArray(handoffData?.handoffs)
                    ? handoffData.handoffs
                    : [],
                decisionsData,
            });
        }
        task.model_tier_default = 'gpt-5.4-mini';
        let workspaceCapture = null;
        if (typeof ensureTaskWorktree === 'function') {
            workspaceCapture = ensureTaskWorktree(taskId);
            if (typeof applyWorkspaceTaskSnapshot === 'function') {
                applyWorkspaceTaskSnapshot(task, workspaceCapture);
            }
        }
        writeBoard(board, {
            command: 'codex start',
            actor: task.owner || task.executor || '',
            expectRevision,
        });
        if (typeof mirrorWorkspaceBoard === 'function') {
            mirrorWorkspaceBoard();
        }
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
            subfront_id: String(task.subfront_id || '').trim(),
            status: 'in_progress',
            files: task.files || [],
            updated_at: currentDate(),
        });
        await runCodexCheck();
        console.log(
            `Codex start OK: ${taskId} (${block})${workspaceCapture?.worktree_path ? ` | worktree=${workspaceCapture.worktree_path}` : ''}`
        );
        for (const diag of wipDiagnostics) {
            console.log(`WARN [${diag.code}] ${diag.message}`);
        }
        return;
    }

    const nextStatus = String(flags.to || 'review').trim();
    const nextBlockedReason = String(
        flags['blocked-reason'] || flags.blocked_reason || ''
    ).trim();
    const codexParallelism = getCodexParallelismPolicy(getGovernancePolicy);
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'codex stop' }
    );
    if (!ALLOWED_STATUSES.has(nextStatus)) {
        throw new Error(`Status destino invalido: ${nextStatus}`);
    }
    task.status = nextStatus;
    task.blocked_reason =
        nextStatus === 'blocked'
            ? nextBlockedReason || String(task.blocked_reason || '').trim()
            : '';
    task.updated_at = currentDate();
    writeBoard(board, {
        command: 'codex stop',
        actor: task.owner || task.executor || '',
        expectRevision,
    });
    if (typeof mirrorWorkspaceBoard === 'function') {
        mirrorWorkspaceBoard();
    }

    if (codexParallelism.slot_statuses_set.has(nextStatus)) {
        const taskInstance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const existingBlock =
            parseCodexActiveBlocks().find(
                (item) => String(item.task_id || '').trim() === taskId
            ) ||
            parseCodexActiveBlocks().find(
                (item) =>
                    String(item.codex_instance || 'codex_backend_ops')
                        .trim()
                        .toLowerCase() === taskInstance
            ) ||
            {};
        writeCodexActiveBlock({
            codex_instance: taskInstance,
            block: String(flags.block || existingBlock.block || 'C1'),
            task_id: taskId,
            subfront_id: String(task.subfront_id || '').trim(),
            status: nextStatus,
            files: task.files || [],
            updated_at: currentDate(),
        });
    } else {
        const remainingBlocks = parseCodexActiveBlocks().filter(
            (item) => String(item.task_id || '').trim() !== taskId
        );
        writeCodexActiveBlock(null);
        for (const remainingBlock of remainingBlocks) {
            writeCodexActiveBlock(remainingBlock);
        }
    }
    await runCodexCheck();
    console.log(`Codex stop OK: ${taskId} -> ${nextStatus}`);
}

module.exports = {
    handleCodexCheckCommand,
    handleCodexCommand,
};
