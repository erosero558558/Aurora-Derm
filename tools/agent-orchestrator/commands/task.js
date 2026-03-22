'use strict';

const terminalEvidence = require('../domain/evidence');
const domainStrategy = require('../domain/strategy');
const publishCommandHandlers = require('./publish');

async function handleTaskCommand(ctx) {
    const {
        args,
        parseFlags,
        parseBoard,
        parseHandoffs,
        buildLiveFocusSummary,
        parseCsvList,
        detectDefaultOwner,
        ACTIVE_STATUSES,
        getStatusCounts,
        getExecutorCounts,
        toTaskJson,
        toTaskFullJson,
        ensureTask,
        resolveTaskEvidencePath,
        existsSync,
        toRelativeRepoPath,
        currentDate,
        writeBoardAndSync,
        assertNonCodexTaskForTaskCommand,
        loadTaskCreateApplyPayload,
        normalizeTaskForCreateApply,
        validateTaskGovernancePrechecks,
        parseDecisions,
        getBlockingConflictsForTask,
        nextAgentTaskId,
        summarizeBlockingConflictsForTask,
        formatBlockingConflictSummary,
        buildTaskCreatePreviewDiff,
        ALLOWED_STATUSES,
        isFlagEnabled,
        collectTaskCreateInteractiveFlags,
        resolveTaskCreateTemplate,
        inferTaskCreateFromFiles,
        ALLOWED_TASK_EXECUTORS,
        RETIRED_TASK_EXECUTORS,
        findCriticalScopeKeyword,
        CRITICAL_SCOPE_KEYWORDS,
        CRITICAL_SCOPE_ALLOWED_EXECUTORS,
        ALLOWED_CODEX_INSTANCES,
        ALLOWED_DOMAIN_LANES,
        ALLOWED_LANE_LOCKS,
        ALLOWED_PROVIDER_MODES,
        ALLOWED_RUNTIME_SURFACES,
        ALLOWED_RUNTIME_TRANSPORTS,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        buildTaskCreateInferenceExplainLines,
        buildTaskCreateWarnDiagnostics,
        attachDiagnostics,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        buildBoardWipLimitDiagnostics,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        ensureTaskWorktree,
        applyWorkspaceTaskSnapshot,
        mirrorWorkspaceBoard,
        printJson,
    } = ctx;

    const subcommand = args[0];
    const parsed = parseFlags(args.slice(1));
    const { positionals } = parsed;
    let { flags } = parsed;
    const wantsJson = args.includes('--json');
    const normalizedSubcommand = String(subcommand || '').trim();
    const taskId = String(positionals[0] || flags.id || '').trim();

    if (
        !normalizedSubcommand ||
        !['ls', 'create', 'claim', 'start', 'finish'].includes(
            normalizedSubcommand
        )
    ) {
        throw new Error(
            'Uso: node agent-orchestrator.js task <ls|create|claim|start|finish> [AG-001] [--owner x] [--executor y] [--status z] [--blocked-reason "..."] [--files a,b] [--template docs|bugfix|critical|runtime] [--codex-instance codex_backend_ops|codex_frontend|codex_transversal] [--domain-lane backend_ops|frontend_content|transversal_runtime] [--lane-lock strict|handoff_allowed] [--provider-mode openclaw_chatgpt|google_oauth] [--runtime-surface figo_queue|leadops_worker|operator_auth] [--runtime-transport hybrid_http_cli|http_bridge|cli_helper] [--strategy-id STRAT-...] [--subfront-id SF-...] [--strategy-role primary|support|exception] [--strategy-reason "..."] [--focus-id FOCUS-...] [--focus-step step] [--integration-slice frontend_runtime|backend_readiness|runtime_support|ops_deploy|desktop_shells|tests_quality|governance_evidence] [--work-type forward|support|fix|refactor|decision|evidence] [--expected-outcome "..."] [--decision-ref DEC-...] [--rework-parent AG-...] [--rework-reason "..."] [--cross-domain true|false] [--evidence path] [--active|--mine]'
        );
    }

    if (normalizedSubcommand === 'ls') {
        handleTaskList({
            args,
            flags,
            wantsJson,
            parseBoard,
            parseCsvList,
            detectDefaultOwner,
            ACTIVE_STATUSES,
            getStatusCounts,
            getExecutorCounts,
            toTaskJson,
            printJson,
        });
        return;
    }

    if (normalizedSubcommand === 'create') {
        await handleTaskCreate({
            args,
            positionals,
            flags,
            wantsJson,
            parseBoard,
            parseHandoffs,
            loadTaskCreateApplyPayload,
            normalizeTaskForCreateApply,
            validateTaskGovernancePrechecks,
            parseDecisions,
            ACTIVE_STATUSES,
            getBlockingConflictsForTask,
            toRelativeRepoPath,
            toTaskJson,
            toTaskFullJson,
            nextAgentTaskId,
            summarizeBlockingConflictsForTask,
            formatBlockingConflictSummary,
            buildTaskCreatePreviewDiff,
            detectDefaultOwner,
            ALLOWED_STATUSES,
            isFlagEnabled,
            parseCsvList,
            collectTaskCreateInteractiveFlags,
            resolveTaskCreateTemplate,
            inferTaskCreateFromFiles,
            ALLOWED_TASK_EXECUTORS,
            RETIRED_TASK_EXECUTORS,
            findCriticalScopeKeyword,
            CRITICAL_SCOPE_KEYWORDS,
            CRITICAL_SCOPE_ALLOWED_EXECUTORS,
            ALLOWED_CODEX_INSTANCES,
            ALLOWED_DOMAIN_LANES,
            ALLOWED_LANE_LOCKS,
            ALLOWED_PROVIDER_MODES,
            ALLOWED_RUNTIME_SURFACES,
            ALLOWED_RUNTIME_TRANSPORTS,
            inferDomainLaneFromFiles,
            ensureTaskDualCodexDefaults,
            currentDate,
            writeBoardAndSync,
            buildTaskCreateInferenceExplainLines,
            buildTaskCreateWarnDiagnostics,
            attachDiagnostics,
            buildBoardWipLimitDiagnostics,
            getLastBoardWriteMeta,
            parseExpectedBoardRevisionFlag,
            collectWorkspaceTruth,
            assertWorkspaceTruthOk,
            ensureTaskWorktree,
            applyWorkspaceTaskSnapshot,
            printJson,
        });
        return;
    }

    if (!taskId) {
        throw new Error('Task command requiere task_id');
    }

    assertNonCodexTaskForTaskCommand(taskId);

    if (normalizedSubcommand === 'claim') {
        handleTaskClaim({
            flags,
            wantsJson,
            taskId,
            ensureTask,
            parseBoard,
            detectDefaultOwner,
            ALLOWED_TASK_EXECUTORS,
            RETIRED_TASK_EXECUTORS,
            ALLOWED_STATUSES,
            parseCsvList,
            validateTaskGovernancePrechecks,
            parseDecisions,
            ACTIVE_STATUSES,
            isFlagEnabled,
            inferDomainLaneFromFiles,
            ensureTaskDualCodexDefaults,
            parseHandoffs,
            getBlockingConflictsForTask,
            currentDate,
            writeBoardAndSync,
            toTaskJson,
            attachDiagnostics,
            buildBoardWipLimitDiagnostics,
            getLastBoardWriteMeta,
            parseExpectedBoardRevisionFlag,
            collectWorkspaceTruth,
            assertWorkspaceTruthOk,
            ensureTaskWorktree,
            applyWorkspaceTaskSnapshot,
            mirrorWorkspaceBoard,
            printJson,
        });
        return;
    }

    if (normalizedSubcommand === 'start') {
        await handleTaskStart({
            buildLiveFocusSummary,
            flags,
            wantsJson,
            taskId,
            ensureTask,
            parseBoard,
            detectDefaultOwner,
            ALLOWED_TASK_EXECUTORS,
            RETIRED_TASK_EXECUTORS,
            ACTIVE_STATUSES,
            parseCsvList,
            validateTaskGovernancePrechecks,
            parseDecisions,
            isFlagEnabled,
            inferDomainLaneFromFiles,
            ensureTaskDualCodexDefaults,
            parseHandoffs,
            getBlockingConflictsForTask,
            currentDate,
            writeBoardAndSync,
            toTaskJson,
            attachDiagnostics,
            buildBoardWipLimitDiagnostics,
            getLastBoardWriteMeta,
            parseExpectedBoardRevisionFlag,
            collectWorkspaceTruth,
            assertWorkspaceTruthOk,
            ensureTaskWorktree,
            applyWorkspaceTaskSnapshot,
            mirrorWorkspaceBoard,
            printJson,
        });
        return;
    }

    if (normalizedSubcommand === 'finish') {
        handleTaskFinish({
            flags,
            wantsJson,
            taskId,
            ensureTask,
            parseBoard,
            resolveTaskEvidencePath,
            existsSync,
            toRelativeRepoPath,
            currentDate,
            writeBoardAndSync,
            toTaskJson,
            getLastBoardWriteMeta,
            parseExpectedBoardRevisionFlag,
            printJson,
        });
    }
}

function handleTaskList(ctx) {
    const {
        flags,
        args,
        wantsJson,
        parseBoard,
        parseCsvList,
        detectDefaultOwner,
        ACTIVE_STATUSES,
        getStatusCounts,
        getExecutorCounts,
        toTaskJson,
        printJson,
    } = ctx;
    const board = parseBoard();
    const limitRaw = String(flags.limit || '').trim();
    const limit = limitRaw === '' ? null : Number(limitRaw);
    if (limitRaw !== '' && (!Number.isFinite(limit) || limit <= 0)) {
        throw new Error('task ls --limit debe ser numero > 0');
    }

    const statusFilter = flags.status ? parseCsvList(flags.status) : [];
    const executorFilter = String(flags.executor || '')
        .trim()
        .toLowerCase();
    const mineOnly = args.includes('--mine');
    if (mineOnly && flags.owner) {
        throw new Error('task ls no permite combinar --mine con --owner');
    }
    const mineOwner = mineOnly ? detectDefaultOwner() : '';
    if (mineOnly && !mineOwner) {
        throw new Error(
            'task ls --mine requiere AGENT_OWNER/USERNAME/USER disponible'
        );
    }
    const ownerFilter = String(flags.owner || mineOwner || '')
        .trim()
        .toLowerCase();
    const scopeFilter = String(flags.scope || '')
        .trim()
        .toLowerCase();
    const riskFilter = String(flags.risk || '')
        .trim()
        .toLowerCase();
    const idFilter = String(flags.id || '')
        .trim()
        .toLowerCase();
    const activeOnly = args.includes('--active');

    const filtered = board.tasks.filter((task) => {
        const id = String(task.id || '').trim();
        const status = String(task.status || '').trim();
        const executor = String(task.executor || '')
            .trim()
            .toLowerCase();
        const owner = String(task.owner || '')
            .trim()
            .toLowerCase();
        const scope = String(task.scope || '')
            .trim()
            .toLowerCase();
        const risk = String(task.risk || '')
            .trim()
            .toLowerCase();

        if (idFilter && id.toLowerCase() !== idFilter) return false;
        if (activeOnly && !ACTIVE_STATUSES.has(status)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(status))
            return false;
        if (executorFilter && executor !== executorFilter) return false;
        if (ownerFilter && owner !== ownerFilter) return false;
        if (scopeFilter && !scope.includes(scopeFilter)) return false;
        if (riskFilter && risk !== riskFilter) return false;
        return true;
    });

    filtered.sort((a, b) => {
        const aUpdated = String(a.updated_at || '');
        const bUpdated = String(b.updated_at || '');
        const byUpdated = bUpdated.localeCompare(aUpdated);
        if (byUpdated !== 0) return byUpdated;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });

    const limited =
        Number.isFinite(limit) && limit !== null
            ? filtered.slice(0, limit)
            : filtered;

    const report = {
        version: 1,
        ok: true,
        command: 'task',
        action: 'ls',
        filters: {
            active: activeOnly,
            status: statusFilter,
            executor: executorFilter || null,
            owner: ownerFilter || null,
            mine: mineOnly,
            scope: scopeFilter || null,
            risk: riskFilter || null,
            id: idFilter || null,
            limit: Number.isFinite(limit) && limit !== null ? limit : null,
        },
        summary: {
            total: board.tasks.length,
            matched: filtered.length,
            returned: limited.length,
            matched_active: filtered.filter((t) =>
                ACTIVE_STATUSES.has(String(t.status || ''))
            ).length,
            by_status: getStatusCounts(limited),
            by_executor: getExecutorCounts(limited),
        },
        tasks: limited.map(toTaskJson),
    };

    if (wantsJson) {
        printJson(report);
        return;
    }

    console.log('== Task List ==');
    console.log(
        `Matched: ${report.summary.matched}/${report.summary.total} (returned ${report.summary.returned})`
    );
    const filterParts = [];
    if (activeOnly) filterParts.push('active=true');
    if (statusFilter.length > 0)
        filterParts.push(`status=${statusFilter.join(',')}`);
    if (executorFilter) filterParts.push(`executor=${executorFilter}`);
    if (ownerFilter) filterParts.push(`owner=${ownerFilter}`);
    if (mineOnly) filterParts.push('mine=true');
    if (scopeFilter) filterParts.push(`scope~=${scopeFilter}`);
    if (riskFilter) filterParts.push(`risk=${riskFilter}`);
    if (idFilter) filterParts.push(`id=${idFilter}`);
    if (report.filters.limit !== null) filterParts.push(`limit=${limit}`);
    console.log(`Filters: ${filterParts.join(' | ') || '(none)'}`);
    for (const task of limited) {
        const filesCount = Array.isArray(task.files) ? task.files.length : 0;
        console.log(
            `- ${task.id} [${task.status}] exec=${task.executor} owner=${task.owner || 'n/a'} risk=${task.risk || 'n/a'} scope=${task.scope || 'n/a'} files=${filesCount}`
        );
    }
}

function formatBlockingConflictDetails(taskId, blockingConflicts) {
    return blockingConflicts
        .map((item) => {
            const other =
                String(item.left.id) === taskId ? item.right : item.left;
            const files = item.overlap_files.length
                ? item.overlap_files.join(', ')
                : '(wildcard ambiguo)';
            return `${taskId} <-> ${other.id} :: ${files}`;
        })
        .join(' | ');
}

function getTaskWriteLeaseMeta(getLastBoardWriteMeta, taskId) {
    const meta =
        typeof getLastBoardWriteMeta === 'function'
            ? getLastBoardWriteMeta()
            : null;
    const rows = Array.isArray(meta?.lifecycle?.task_results)
        ? meta.lifecycle.task_results
        : [];
    return (
        rows.find((row) => String(row.task_id || '') === String(taskId)) || null
    );
}

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

function printTaskJsonError(printJson, error, action = null) {
    const payload = {
        version: 1,
        ok: false,
        command: 'task',
        ...(action ? { action } : {}),
        error: String(error?.message || error || 'task_failed'),
        error_code: String(error?.error_code || error?.code || 'task_failed'),
    };
    if (payload.error_code === 'board_revision_mismatch') {
        payload.expected_revision = Number(error?.expected_revision);
        payload.actual_revision = Number(error?.actual_revision);
    }
    if (error?.workspace_truth) {
        payload.workspace_truth = error.workspace_truth;
    }
    if (error?.workspace_hygiene) {
        payload.workspace_hygiene = error.workspace_hygiene;
    }
    printJson(payload);
    process.exitCode = 1;
    return payload;
}

function readStringFlag(flags = {}, kebabName, snakeName) {
    const value = readLiteralStringFlag(flags, kebabName, snakeName);
    return String(value || '')
        .trim()
        .toLowerCase();
}

function readLiteralStringFlag(flags = {}, kebabName, snakeName) {
    const kebabValue = flags[kebabName];
    const snakeValue = flags[snakeName];
    const value =
        kebabValue !== undefined && kebabValue !== true
            ? kebabValue
            : snakeValue !== undefined && snakeValue !== true
              ? snakeValue
              : '';
    return String(value || '').trim();
}

function hasFlag(flags = {}, kebabName, snakeName) {
    return (
        Object.prototype.hasOwnProperty.call(flags, kebabName) ||
        Object.prototype.hasOwnProperty.call(flags, snakeName)
    );
}

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function isRetiredExecutor(executor, retiredExecutors) {
    return retiredExecutors.has(
        String(executor || '')
            .trim()
            .toLowerCase()
    );
}

function createRetiredExecutorError(executor, commandLabel) {
    const error = new Error(`${commandLabel}: executor retirado (${executor})`);
    error.code = 'executor_retired';
    error.error_code = 'executor_retired';
    return error;
}

function applyDualCodexOverrides(task, flags = {}, helpers = {}) {
    if (!task || typeof task !== 'object') return;
    const {
        isFlagEnabled = () => false,
        inferDomainLaneFromFiles = () => ({ lane: 'backend_ops' }),
        ensureTaskDualCodexDefaults = () => task,
        skipLaneInference = false,
    } = helpers;

    const explicitCodexInstance = readStringFlag(
        flags,
        'codex-instance',
        'codex_instance'
    );
    const explicitDomainLane = readStringFlag(
        flags,
        'domain-lane',
        'domain_lane'
    );
    const explicitLaneLock = readStringFlag(flags, 'lane-lock', 'lane_lock');
    const explicitProviderMode = readStringFlag(
        flags,
        'provider-mode',
        'provider_mode'
    );
    const explicitRuntimeSurface = readStringFlag(
        flags,
        'runtime-surface',
        'runtime_surface'
    );
    const explicitRuntimeTransport = readStringFlag(
        flags,
        'runtime-transport',
        'runtime_transport'
    );
    const explicitRuntimeLastTransport = readStringFlag(
        flags,
        'runtime-last-transport',
        'runtime_last_transport'
    );
    const hasCrossDomainFlag = hasFlag(flags, 'cross-domain', 'cross_domain');

    if (explicitDomainLane) {
        task.domain_lane = explicitDomainLane;
    }
    if (explicitCodexInstance) {
        task.codex_instance = explicitCodexInstance;
    }
    if (explicitLaneLock) {
        task.lane_lock = explicitLaneLock;
    }
    if (explicitProviderMode) {
        task.provider_mode = explicitProviderMode;
    }
    if (explicitRuntimeSurface) {
        task.runtime_surface = explicitRuntimeSurface;
    }
    if (explicitRuntimeTransport) {
        task.runtime_transport = explicitRuntimeTransport;
    }
    if (explicitRuntimeLastTransport) {
        task.runtime_last_transport = explicitRuntimeLastTransport;
    }
    if (hasCrossDomainFlag) {
        task.cross_domain = isFlagEnabled(
            flags,
            'cross-domain',
            'cross_domain'
        );
    }

    if (
        !skipLaneInference &&
        !explicitDomainLane &&
        Array.isArray(task.files) &&
        task.files.length > 0
    ) {
        const inferred = inferDomainLaneFromFiles(task.files);
        if (inferred?.lane) {
            task.domain_lane = String(inferred.lane);
        }
    }

    ensureTaskDualCodexDefaults(task);
}

function applyStrategyOverrides(task, flags = {}) {
    if (!task || typeof task !== 'object') return;
    const strategyId = readLiteralStringFlag(
        flags,
        'strategy-id',
        'strategy_id'
    );
    const subfrontId = readLiteralStringFlag(
        flags,
        'subfront-id',
        'subfront_id'
    );
    const strategyRole = readStringFlag(
        flags,
        'strategy-role',
        'strategy_role'
    );
    const strategyReason = readLiteralStringFlag(
        flags,
        'strategy-reason',
        'strategy_reason'
    );

    if (strategyId) {
        task.strategy_id = strategyId;
    }
    if (subfrontId) {
        task.subfront_id = subfrontId;
    }
    if (strategyRole) {
        task.strategy_role = strategyRole;
    }
    if (strategyReason) {
        task.strategy_reason = strategyReason;
    }
}

function applyFocusOverrides(task, flags = {}) {
    if (!task || typeof task !== 'object') return;
    const focusId = readLiteralStringFlag(flags, 'focus-id', 'focus_id');
    const focusStep = readLiteralStringFlag(flags, 'focus-step', 'focus_step');
    const integrationSlice = readStringFlag(
        flags,
        'integration-slice',
        'integration_slice'
    );
    const workType = readStringFlag(flags, 'work-type', 'work_type');
    const expectedOutcome = readLiteralStringFlag(
        flags,
        'expected-outcome',
        'expected_outcome'
    );
    const decisionRef = readLiteralStringFlag(
        flags,
        'decision-ref',
        'decision_ref'
    );
    const reworkParent = readLiteralStringFlag(
        flags,
        'rework-parent',
        'rework_parent'
    );
    const reworkReason = readLiteralStringFlag(
        flags,
        'rework-reason',
        'rework_reason'
    );

    if (focusId) task.focus_id = focusId;
    if (focusStep) task.focus_step = focusStep;
    if (integrationSlice) task.integration_slice = integrationSlice;
    if (workType) task.work_type = workType;
    if (expectedOutcome) task.expected_outcome = expectedOutcome;
    if (decisionRef) task.decision_ref = decisionRef;
    if (reworkParent) task.rework_parent = reworkParent;
    if (reworkReason) task.rework_reason = reworkReason;
}

function applyReleasePublishPreset(task) {
    if (!task || typeof task !== 'object') return;
    task.status = 'review';
    task.strategy_role = 'exception';
    task.strategy_reason = 'validated_release_promotion';
    task.integration_slice = 'governance_evidence';
    task.work_type = 'evidence';
}

function applyReleasePublishStrategyDefaults(board, task) {
    if (!task || typeof task !== 'object') return;
    const activeStrategy = domainStrategy.getActiveStrategy(board);
    if (!activeStrategy) return;
    if (!String(task.strategy_id || '').trim()) {
        task.strategy_id = activeStrategy.id;
    }
    if (!String(task.subfront_id || '').trim()) {
        const subfront = domainStrategy.getSubfrontByCodexInstance(
            activeStrategy,
            task.codex_instance
        );
        if (subfront?.subfront_id) {
            task.subfront_id = subfront.subfront_id;
        }
    }
}

function applyBlockedReasonOverride(task, flags = {}, commandLabel) {
    if (!task || typeof task !== 'object') return;
    const hasExplicitBlockedReason =
        Object.prototype.hasOwnProperty.call(flags, 'blocked-reason') ||
        Object.prototype.hasOwnProperty.call(flags, 'blocked_reason');
    const explicitBlockedReason = String(
        flags['blocked-reason'] || flags.blocked_reason || ''
    ).trim();
    const nextStatus = String(task.status || '').trim();

    if (nextStatus !== 'blocked') {
        if (hasExplicitBlockedReason && explicitBlockedReason) {
            throw new Error(
                `${commandLabel} solo acepta --blocked-reason cuando status=blocked`
            );
        }
        task.blocked_reason = '';
        return;
    }

    if (explicitBlockedReason) {
        task.blocked_reason = explicitBlockedReason;
    }
    if (!String(task.blocked_reason || '').trim()) {
        throw new Error(
            `${commandLabel} requiere --blocked-reason cuando status=blocked`
        );
    }
}

function handleTaskClaim(ctx) {
    const {
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        detectDefaultOwner,
        ALLOWED_TASK_EXECUTORS,
        RETIRED_TASK_EXECUTORS,
        ALLOWED_STATUSES,
        parseCsvList,
        validateTaskGovernancePrechecks,
        parseDecisions,
        ACTIVE_STATUSES,
        isFlagEnabled,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        parseHandoffs,
        getBlockingConflictsForTask,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        attachDiagnostics,
        buildBoardWipLimitDiagnostics,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        printJson,
    } = ctx;

    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth({
                  allWorktrees: true,
                  currentOnly: false,
              })
            : null;
    if (typeof assertWorkspaceTruthOk === 'function') {
        assertWorkspaceTruthOk(workspaceReport, {
            commandLabel: 'task claim',
        });
    }
    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const decisionsData =
        typeof parseDecisions === 'function'
            ? parseDecisions()
            : { decisions: [] };

    const owner = detectDefaultOwner(task.owner);
    const ownerOverride = flags.owner ? String(flags.owner).trim() : owner;
    if (!ownerOverride) {
        throw new Error(
            'task claim requiere --owner o variable AGENT_OWNER/USERNAME/USER'
        );
    }
    task.owner = ownerOverride;

    if (flags.executor) {
        const nextExecutor = String(flags.executor).trim().toLowerCase();
        if (!ALLOWED_TASK_EXECUTORS.has(nextExecutor)) {
            throw new Error(`Executor invalido: ${nextExecutor}`);
        }
        if (isRetiredExecutor(nextExecutor, RETIRED_TASK_EXECUTORS)) {
            throw createRetiredExecutorError(nextExecutor, 'task claim');
        }
        task.executor = nextExecutor;
    }
    if (flags.status) {
        const nextStatus = String(flags.status).trim();
        if (!ALLOWED_STATUSES.has(nextStatus)) {
            throw new Error(`Status invalido: ${nextStatus}`);
        }
        task.status = nextStatus;
    }
    if (flags.files) {
        const files = parseCsvList(flags.files);
        if (files.length === 0) {
            throw new Error('task claim --files requiere lista CSV no vacia');
        }
        task.files = files;
    }

    applyDualCodexOverrides(task, flags, {
        isFlagEnabled,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
    });
    applyStrategyOverrides(task, flags);
    applyFocusOverrides(task, flags);
    applyBlockedReasonOverride(task, flags, 'task claim');
    if (isRetiredExecutor(task.executor, RETIRED_TASK_EXECUTORS)) {
        throw createRetiredExecutorError(task.executor, 'task claim');
    }
    const handoffData = parseHandoffs();
    validateTaskGovernancePrechecks(board, task, {
        allowSelf: true,
        handoffs: handoffData.handoffs,
        decisionsData,
    });

    if (ACTIVE_STATUSES.has(String(task.status || '').trim())) {
        const blockingConflicts = getBlockingConflictsForTask(
            board.tasks,
            taskId,
            handoffData.handoffs
        );
        if (blockingConflicts.length > 0) {
            throw new Error(
                `task claim bloqueado por conflicto activo: ${formatBlockingConflictDetails(
                    taskId,
                    blockingConflicts
                )}`
            );
        }
    }

    task.updated_at = currentDate();
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'task claim' }
    );
    try {
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'task claim',
            actor: task.owner || task.executor || '',
            expectRevision,
        });
    } catch (error) {
        if (wantsJson) {
            printTaskJsonError(printJson, error, 'claim');
            return;
        }
        throw error;
    }
    const leaseMeta = getTaskWriteLeaseMeta(getLastBoardWriteMeta, taskId);
    const wipDiagnostics =
        typeof buildBoardWipLimitDiagnostics === 'function'
            ? buildBoardWipLimitDiagnostics(board, {
                  source: 'task claim',
                  taskIds: [taskId],
                  executors: [task.executor],
                  scopes: [task.scope],
              })
            : [];
    const basePayload = {
        version: 1,
        ok: true,
        command: 'task',
        action: 'claim',
        task: toTaskJson(task),
        lease_action: leaseMeta?.lease_action || 'none',
        lease: leaseMeta?.lease || null,
        status_since_at: leaseMeta?.status_since_at || null,
    };
    if (wantsJson) {
        printJson(
            typeof attachDiagnostics === 'function'
                ? attachDiagnostics(basePayload, wipDiagnostics)
                : basePayload
        );
        return;
    }
    console.log(
        `Task claim OK: ${taskId} owner=${task.owner} status=${task.status}`
    );
    for (const diag of wipDiagnostics) {
        console.log(`WARN [${diag.code}] ${diag.message}`);
    }
}

async function handleTaskStart(ctx) {
    const {
        buildLiveFocusSummary,
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        detectDefaultOwner,
        ALLOWED_TASK_EXECUTORS,
        RETIRED_TASK_EXECUTORS,
        ACTIVE_STATUSES,
        parseCsvList,
        validateTaskGovernancePrechecks,
        parseDecisions,
        isFlagEnabled,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        parseHandoffs,
        getBlockingConflictsForTask,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        attachDiagnostics,
        buildBoardWipLimitDiagnostics,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        ensureTaskWorktree,
        applyWorkspaceTaskSnapshot,
        mirrorWorkspaceBoard,
        printJson,
    } = ctx;

    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth({
                  allWorktrees: true,
                  currentOnly: false,
              })
            : null;
    if (typeof assertWorkspaceTruthOk === 'function') {
        assertWorkspaceTruthOk(workspaceReport, {
            commandLabel: 'task start',
        });
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const decisionsData =
        typeof parseDecisions === 'function'
            ? parseDecisions()
            : { decisions: [] };

    const releasePublish = isFlagEnabled(
        flags,
        'release-publish',
        'release_publish'
    );
    if (releasePublish && !/^(AG|CDX)-\d+$/i.test(String(taskId || '').trim())) {
        throw new Error(
            'task start --release-publish solo permite tareas existentes AG-* o CDX-*'
        );
    }
    if (
        releasePublish &&
        Object.prototype.hasOwnProperty.call(flags, 'status') &&
        String(flags.status || '').trim() !== 'review'
    ) {
        throw new Error(
            'task start --release-publish fija status=review y no acepta otro status'
        );
    }

    const nextStatus = String(
        releasePublish ? 'review' : flags.status || 'in_progress'
    ).trim();
    if (!ACTIVE_STATUSES.has(nextStatus)) {
        throw new Error(
            `task start requiere status activo (${Array.from(ACTIVE_STATUSES).join(', ')})`
        );
    }

    if (flags.owner) {
        task.owner = String(flags.owner).trim();
    } else if (String(task.owner || '').trim() === '') {
        task.owner = detectDefaultOwner(task.owner) || 'unassigned';
    }
    if (flags.executor) {
        const nextExecutor = String(flags.executor).trim().toLowerCase();
        if (!ALLOWED_TASK_EXECUTORS.has(nextExecutor)) {
            throw new Error(`Executor invalido: ${nextExecutor}`);
        }
        if (isRetiredExecutor(nextExecutor, RETIRED_TASK_EXECUTORS)) {
            throw createRetiredExecutorError(nextExecutor, 'task start');
        }
        task.executor = nextExecutor;
    }
    if (flags.scope) {
        task.scope = String(flags.scope).trim();
    }
    if (flags.files) {
        const files = parseCsvList(flags.files);
        if (files.length === 0) {
            throw new Error('task start --files requiere lista CSV no vacia');
        }
        task.files = files;
    }

    task.status = nextStatus;
    task.updated_at = currentDate();

    const handoffData = parseHandoffs();
    const preserveFrontendReleaseLane = Boolean(
        releasePublish &&
            String(task.scope || '').trim().toLowerCase() ===
                'frontend-public' &&
            String(task.domain_lane || '').trim().toLowerCase() ===
                'frontend_content' &&
            String(task.codex_instance || '').trim().toLowerCase() ===
                'codex_frontend'
    );
    applyDualCodexOverrides(task, flags, {
        isFlagEnabled,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        skipLaneInference: preserveFrontendReleaseLane,
    });
    applyStrategyOverrides(task, flags);
    applyFocusOverrides(task, flags);
    if (releasePublish) {
        applyReleasePublishPreset(task);
        applyReleasePublishStrategyDefaults(board, task);
        if (typeof buildLiveFocusSummary === 'function') {
            const focusData = await buildLiveFocusSummary(board, {
                now: new Date(),
            });
            publishCommandHandlers.assertReleaseRequiredChecks(
                focusData?.summary,
                'task start --release-publish'
            );
        }
    }
    applyBlockedReasonOverride(task, flags, 'task start');
    if (isRetiredExecutor(task.executor, RETIRED_TASK_EXECUTORS)) {
        throw createRetiredExecutorError(task.executor, 'task start');
    }
    validateTaskGovernancePrechecks(board, task, {
        allowSelf: true,
        handoffs: handoffData.handoffs,
        decisionsData,
    });

    const blockingConflicts = getBlockingConflictsForTask(
        board.tasks,
        taskId,
        handoffData.handoffs
    );
    if (blockingConflicts.length > 0) {
        throw new Error(
            `task start bloqueado por conflicto activo: ${formatBlockingConflictDetails(
                taskId,
                blockingConflicts
            )}`
        );
    }
    if (releasePublish && typeof buildLiveFocusSummary === 'function') {
        const focusData = await buildLiveFocusSummary(board, {
            now: new Date(),
        });
        publishCommandHandlers.assertReleaseRequiredChecks(
            focusData?.summary,
            'task start --release-publish'
        );
    }

    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'task start' }
    );
    let workspaceCapture = null;
    if (
        String(task.executor || '')
            .trim()
            .toLowerCase() === 'codex' &&
        typeof ensureTaskWorktree === 'function'
    ) {
        workspaceCapture = ensureTaskWorktree(taskId);
        if (typeof applyWorkspaceTaskSnapshot === 'function') {
            applyWorkspaceTaskSnapshot(task, workspaceCapture);
        }
    }
    try {
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'task start',
            actor: task.owner || task.executor || '',
            expectRevision,
        });
        if (
            String(task.executor || '')
                .trim()
                .toLowerCase() === 'codex' &&
            typeof mirrorWorkspaceBoard === 'function'
        ) {
            mirrorWorkspaceBoard();
        }
    } catch (error) {
        if (wantsJson) {
            printTaskJsonError(printJson, error, 'start');
            return;
        }
        throw error;
    }
    const leaseMeta = getTaskWriteLeaseMeta(getLastBoardWriteMeta, taskId);
    const wipDiagnostics =
        typeof buildBoardWipLimitDiagnostics === 'function'
            ? buildBoardWipLimitDiagnostics(board, {
                  source: 'task start',
                  taskIds: [taskId],
                  executors: [task.executor],
                  scopes: [task.scope],
              })
            : [];
    const basePayload = {
        version: 1,
        ok: true,
        command: 'task',
        action: 'start',
        task: toTaskJson(task),
        workspace: workspaceCapture
            ? {
                  worktree_path: workspaceCapture.worktree_path,
                  snapshot_checked_at:
                      workspaceCapture.snapshot?.checked_at || null,
              }
            : null,
        lease_action: leaseMeta?.lease_action || 'none',
        lease: leaseMeta?.lease || null,
        status_since_at: leaseMeta?.status_since_at || null,
    };
    if (wantsJson) {
        printJson(
            typeof attachDiagnostics === 'function'
                ? attachDiagnostics(basePayload, wipDiagnostics)
                : basePayload
        );
        return;
    }
    console.log(
        `Task start OK: ${taskId} -> ${nextStatus}${workspaceCapture?.worktree_path ? ` | worktree=${workspaceCapture.worktree_path}` : ''}`
    );
    for (const diag of wipDiagnostics) {
        console.log(`WARN [${diag.code}] ${diag.message}`);
    }
}

function handleTaskFinish(ctx) {
    const {
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        resolveTaskEvidencePath,
        existsSync,
        toRelativeRepoPath,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        printJson,
    } = ctx;

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    const nextStatus = String(flags.to || flags.status || 'done').trim();
    if (!['done', 'failed'].includes(nextStatus)) {
        throw new Error(
            "task finish solo permite estados terminales 'done' o 'failed'"
        );
    }

    let evidencePath = null;
    if (nextStatus === 'done') {
        evidencePath = resolveTaskEvidencePath(taskId, flags);
        if (!existsSync(evidencePath)) {
            throw new Error(`No existe evidencia requerida: ${evidencePath}`);
        }
        terminalEvidence.applyCanonicalEvidenceRefs(
            task,
            toRelativeRepoPath(evidencePath)
        );
    }

    task.status = nextStatus;
    task.updated_at = currentDate();
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'task finish' }
    );
    try {
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'task finish',
            actor: task.owner || task.executor || '',
            expectRevision,
        });
    } catch (error) {
        if (wantsJson) {
            printTaskJsonError(printJson, error, 'finish');
            return;
        }
        throw error;
    }
    const leaseMeta = getTaskWriteLeaseMeta(getLastBoardWriteMeta, taskId);

    if (wantsJson) {
        printJson({
            version: 1,
            ok: true,
            command: 'task',
            action: 'finish',
            task: toTaskJson(task),
            evidence_path: evidencePath
                ? toRelativeRepoPath(evidencePath)
                : null,
            lease_action: leaseMeta?.lease_action || 'none',
            lease: leaseMeta?.lease || null,
            status_since_at: leaseMeta?.status_since_at || null,
        });
        return;
    }

    console.log(`Task finish OK: ${taskId} -> ${nextStatus}`);
}

async function handleTaskCreate(ctx) {
    const {
        args,
        positionals,
        wantsJson,
        parseBoard,
        parseHandoffs,
        parseDecisions,
        loadTaskCreateApplyPayload,
        normalizeTaskForCreateApply,
        validateTaskGovernancePrechecks,
        ACTIVE_STATUSES,
        getBlockingConflictsForTask,
        toRelativeRepoPath,
        toTaskJson,
        toTaskFullJson,
        nextAgentTaskId,
        summarizeBlockingConflictsForTask,
        formatBlockingConflictSummary,
        buildTaskCreatePreviewDiff,
        detectDefaultOwner,
        ALLOWED_STATUSES,
        isFlagEnabled,
        parseCsvList,
        collectTaskCreateInteractiveFlags,
        resolveTaskCreateTemplate,
        inferTaskCreateFromFiles,
        ALLOWED_TASK_EXECUTORS,
        RETIRED_TASK_EXECUTORS,
        findCriticalScopeKeyword,
        CRITICAL_SCOPE_KEYWORDS,
        CRITICAL_SCOPE_ALLOWED_EXECUTORS,
        ALLOWED_CODEX_INSTANCES,
        ALLOWED_DOMAIN_LANES,
        ALLOWED_LANE_LOCKS,
        ALLOWED_PROVIDER_MODES,
        ALLOWED_RUNTIME_SURFACES,
        ALLOWED_RUNTIME_TRANSPORTS,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        currentDate,
        writeBoardAndSync,
        buildTaskCreateInferenceExplainLines,
        buildTaskCreateWarnDiagnostics,
        attachDiagnostics,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
        printJson,
    } = ctx;
    let { flags } = ctx;

    const createNestedCommand = String(positionals[0] || '')
        .trim()
        .toLowerCase();
    const createNestedAction = String(positionals[1] || '')
        .trim()
        .toLowerCase();

    if (createNestedCommand === 'preview-file') {
        if (!['lint', 'diff'].includes(createNestedAction)) {
            throw new Error(
                'Uso: node agent-orchestrator.js task create preview-file <lint|diff> <preview.json|-> [--json]'
            );
        }
        const diffFormat = String(flags.format || 'compact')
            .trim()
            .toLowerCase();
        if (
            createNestedAction === 'diff' &&
            !['compact', 'full'].includes(diffFormat)
        ) {
            throw new Error(
                `task create preview-file diff: --format invalido (${diffFormat}); permitidos: compact, full`
            );
        }

        const previewPath = String(
            positionals[2] || flags.file || flags.path || ''
        ).trim();
        const loaded = loadTaskCreateApplyPayload(previewPath, {
            modeLabel: 'task create preview-file lint',
        });
        const board = parseBoard();
        const handoffData = parseHandoffs();
        const decisionsData =
            typeof parseDecisions === 'function'
                ? parseDecisions()
                : { decisions: [] };
        const task = normalizeTaskForCreateApply(
            loaded.payload?.task_full || loaded.payload?.task
        );
        applyDualCodexOverrides(
            task,
            {},
            {
                isFlagEnabled,
                inferDomainLaneFromFiles,
                ensureTaskDualCodexDefaults,
            }
        );
        applyStrategyOverrides(task, {});
        applyFocusOverrides(task, {});

        const errors = [];
        const duplicateTask =
            board.tasks.find((item) => String(item.id || '') === task.id) ||
            null;
        const duplicateId = Boolean(duplicateTask);
        if (duplicateId) {
            errors.push(`id duplicado en board: ${task.id}`);
        }

        let governanceOk = true;
        try {
            validateTaskGovernancePrechecks(board, task, {
                handoffs: handoffData.handoffs,
                decisionsData,
            });
        } catch (error) {
            governanceOk = false;
            errors.push(String(error.message || error));
        }

        let blockingConflicts = [];
        if (errors.length === 0 && ACTIVE_STATUSES.has(task.status)) {
            blockingConflicts = getBlockingConflictsForTask(
                [...board.tasks, task],
                task.id,
                handoffData.handoffs
            );
            if (blockingConflicts.length > 0) {
                const details = blockingConflicts
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
                    .join(' | ');
                errors.push(`conflicto activo blocking: ${details}`);
            }
        }

        const basePreviewCheckPayload = {
            version: 1,
            ok: errors.length === 0,
            command: 'task',
            action:
                createNestedAction === 'diff'
                    ? 'create-preview-diff'
                    : 'create-preview-lint',
            preview_file: loaded.path,
            preview_file_resolved: loaded.resolved_path
                ? toRelativeRepoPath(loaded.resolved_path)
                : null,
            task: toTaskJson(task),
            task_full: toTaskFullJson(task),
            id_collision: duplicateId,
            suggested_id_remap: duplicateId
                ? nextAgentTaskId(board.tasks)
                : null,
            checks: {
                preview_payload_schema: 'passed',
                task_normalization: 'passed',
                duplicate_id: duplicateId ? 'failed' : 'passed',
                governance_prechecks: governanceOk ? 'passed' : 'failed',
                conflict_check:
                    ACTIVE_STATUSES.has(task.status) &&
                    blockingConflicts.length > 0
                        ? 'failed'
                        : 'passed',
            },
            errors,
        };

        if (createNestedAction === 'diff') {
            const candidateTaskForConflictCheck = duplicateId
                ? { ...task, id: nextAgentTaskId(board.tasks) }
                : task;
            let conflictErrors = [];
            let conflictItems = [];
            if (ACTIVE_STATUSES.has(candidateTaskForConflictCheck.status)) {
                const handoffData = parseHandoffs();
                const candidateConflicts = getBlockingConflictsForTask(
                    [...board.tasks, candidateTaskForConflictCheck],
                    candidateTaskForConflictCheck.id,
                    handoffData.handoffs
                );
                conflictItems = summarizeBlockingConflictsForTask(
                    candidateTaskForConflictCheck.id,
                    candidateConflicts
                );
                if (candidateConflicts.length > 0) {
                    conflictErrors.push(
                        formatBlockingConflictSummary(
                            candidateTaskForConflictCheck.id,
                            candidateConflicts
                        )
                    );
                }
            }

            const diffPayload = {
                ...basePreviewCheckPayload,
                ok: true,
                errors: [],
                diff_format: diffFormat,
                board_task_same_id: duplicateTask
                    ? toTaskFullJson(duplicateTask)
                    : null,
                field_diff_same_id: duplicateTask
                    ? buildTaskCreatePreviewDiff(duplicateTask, task)
                    : [],
                apply_projection: {
                    basis: duplicateId ? 'remap_candidate' : 'preview_id',
                    projected_task_id: candidateTaskForConflictCheck.id,
                    projected_blocking_conflicts: conflictItems,
                    projected_blocking_conflicts_count: conflictItems.length,
                    projected_blocking_conflicts_error:
                        conflictErrors[0] || null,
                },
            };

            if (wantsJson) {
                if (diffFormat === 'compact') {
                    const compactJsonPayload = {
                        ...diffPayload,
                        json_format: 'compact',
                        task_full: undefined,
                        board_task_same_id: duplicateTask
                            ? toTaskJson(duplicateTask)
                            : null,
                        field_diff_same_id: Array.isArray(
                            diffPayload.field_diff_same_id
                        )
                            ? diffPayload.field_diff_same_id.map((row) => ({
                                  field: row.field,
                              }))
                            : [],
                        field_diff_same_id_count: Array.isArray(
                            diffPayload.field_diff_same_id
                        )
                            ? diffPayload.field_diff_same_id.length
                            : 0,
                    };
                    printJson(compactJsonPayload);
                    return;
                }
                printJson({ ...diffPayload, json_format: 'full' });
                return;
            }

            console.log(
                `Task create preview-file diff: ${task.id} (${loaded.path})`
            );
            console.log(`- format: ${diffFormat}`);
            console.log(`- id_collision: ${duplicateId ? 'yes' : 'no'}`);
            if (duplicateId) {
                console.log(
                    `- suggested_id_remap: ${diffPayload.suggested_id_remap}`
                );
                if (diffPayload.field_diff_same_id.length === 0) {
                    console.log('- field_diff_same_id: (sin cambios)');
                } else {
                    console.log('- field_diff_same_id:');
                    for (const row of diffPayload.field_diff_same_id) {
                        if (diffFormat === 'full') {
                            console.log(
                                `  - ${row.field}: ${JSON.stringify(row.before)} -> ${JSON.stringify(row.after)}`
                            );
                        } else {
                            console.log(`  - ${row.field}`);
                        }
                    }
                }
            }
            console.log(
                `- projected_blocking_conflicts: ${diffPayload.apply_projection.projected_blocking_conflicts_count}`
            );
            if (
                diffPayload.apply_projection.projected_blocking_conflicts_error
            ) {
                console.log(
                    `- projected_conflict_detail: ${diffPayload.apply_projection.projected_blocking_conflicts_error}`
                );
            }
            return;
        }

        if (wantsJson) {
            printJson(basePreviewCheckPayload);
            if (!basePreviewCheckPayload.ok) process.exitCode = 1;
            return;
        }

        console.log(
            `Task create preview-file lint ${basePreviewCheckPayload.ok ? 'OK' : 'FAIL'}: ${task.id} (${loaded.path})`
        );
        if (!basePreviewCheckPayload.ok) {
            for (const error of errors) {
                console.log(`- ${error}`);
            }
            process.exitCode = 1;
        }
        return;
    }

    const applyPathRaw =
        flags.apply || flags['apply-from'] || flags.apply_from || '';
    const applyMode =
        Object.prototype.hasOwnProperty.call(flags, 'apply') ||
        Object.prototype.hasOwnProperty.call(flags, 'apply-from') ||
        Object.prototype.hasOwnProperty.call(flags, 'apply_from');
    const forceIdRemap = isFlagEnabled(
        flags,
        'force-id-remap',
        'force_id_remap'
    );
    const applyToStatusRaw = String(flags.to || '').trim();
    const claimOwnerFlagPresent =
        Object.prototype.hasOwnProperty.call(flags, 'claim-owner') ||
        Object.prototype.hasOwnProperty.call(flags, 'claim_owner');
    const claimOwnerFlagValue =
        flags['claim-owner'] !== undefined
            ? flags['claim-owner']
            : flags.claim_owner;
    const validateOnly = isFlagEnabled(flags, 'validate-only', 'validate_only');
    const previewMode = isFlagEnabled(flags, 'preview', 'dry-run', 'dry_run');
    const explainInference = isFlagEnabled(flags, 'explain');

    if (applyMode) {
        if (isFlagEnabled(flags, 'interactive')) {
            throw new Error(
                'task create --apply no permite combinar --interactive'
            );
        }
        if (previewMode) {
            throw new Error(
                'task create --apply no permite combinar --preview/--dry-run'
            );
        }
        if (validateOnly) {
            throw new Error(
                'task create --apply no permite combinar --validate-only'
            );
        }
        let claimOwner = '';
        if (claimOwnerFlagPresent) {
            if (claimOwnerFlagValue === true) {
                claimOwner = detectDefaultOwner();
            } else {
                claimOwner = String(claimOwnerFlagValue || '').trim();
            }
            if (!claimOwner) {
                throw new Error(
                    'task create --apply: --claim-owner requiere valor o AGENT_OWNER/USERNAME/USER disponible'
                );
            }
        }
        if (applyToStatusRaw && !ALLOWED_STATUSES.has(applyToStatusRaw)) {
            throw new Error(
                `task create --apply: status invalido en --to (${applyToStatusRaw})`
            );
        }
        if (
            flags.title ||
            flags.template ||
            flags.files ||
            flags.executor ||
            flags.status ||
            flags.risk ||
            flags.scope
        ) {
            throw new Error(
                'task create --apply no permite flags de construccion (--title/--template/--files/--executor/--status/--risk/--scope)'
            );
        }

        const applyFile = loadTaskCreateApplyPayload(applyPathRaw, {
            modeLabel: 'task create --apply',
        });
        const sourcePayload = applyFile.payload || {};
        const board = parseBoard();
        const handoffData = parseHandoffs();
        const decisionsData =
            typeof parseDecisions === 'function'
                ? parseDecisions()
                : { decisions: [] };
        const task = normalizeTaskForCreateApply(
            sourcePayload.task_full || sourcePayload.task
        );
        if (isRetiredExecutor(task.executor, RETIRED_TASK_EXECUTORS)) {
            throw createRetiredExecutorError(
                task.executor,
                'task create --apply'
            );
        }
        const originalTaskId = task.id;
        const originalTaskStatus = task.status;
        const originalTaskOwner = task.owner;

        if (applyToStatusRaw) {
            task.status = applyToStatusRaw;
            task.updated_at = currentDate();
        }
        if (claimOwner) {
            task.owner = claimOwner;
            task.updated_at = currentDate();
        }

        const duplicateId = board.tasks.some(
            (item) => String(item.id || '') === task.id
        );
        if (duplicateId && forceIdRemap) {
            task.id = nextAgentTaskId(board.tasks);
            task.updated_at = currentDate();
        } else if (duplicateId) {
            throw new Error(`task create --apply: id duplicado ${task.id}`);
        }

        applyDualCodexOverrides(task, flags, {
            isFlagEnabled,
            inferDomainLaneFromFiles,
            ensureTaskDualCodexDefaults,
        });
        applyStrategyOverrides(task, flags);
        applyFocusOverrides(task, flags);
        validateTaskGovernancePrechecks(board, task, {
            handoffs: handoffData.handoffs,
            decisionsData,
        });
        board.tasks.push(task);

        if (ACTIVE_STATUSES.has(task.status)) {
            const blockingConflicts = getBlockingConflictsForTask(
                board.tasks,
                task.id,
                handoffData.handoffs
            );
            if (blockingConflicts.length > 0) {
                const details = blockingConflicts
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
                    .join(' | ');
                throw new Error(
                    `task create --apply bloqueado por conflicto activo: ${details}`
                );
            }
        }

        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'task create --apply' }
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
                commandLabel: 'task create --apply',
            });
        }
        try {
            writeBoardAndSync(board, {
                silentSync: wantsJson,
                command: 'task create apply',
                actor: task.owner || task.executor || '',
                expectRevision,
            });
        } catch (error) {
            if (wantsJson) {
                printTaskJsonError(printJson, error, 'create');
                return;
            }
            throw error;
        }
        const leaseMeta = getTaskWriteLeaseMeta(getLastBoardWriteMeta, task.id);

        const applyPayload = {
            version: 1,
            ok: true,
            command: 'task',
            action: 'create',
            applied: true,
            apply: true,
            applied_from: applyFile.path,
            applied_from_resolved: applyFile.resolved_path
                ? toRelativeRepoPath(applyFile.resolved_path)
                : null,
            force_id_remap: forceIdRemap,
            id_remapped: task.id !== originalTaskId,
            original_task_id: originalTaskId,
            status_override_applied: Boolean(applyToStatusRaw),
            status_override_to: applyToStatusRaw || null,
            original_task_status: originalTaskStatus,
            owner_claim_applied: Boolean(claimOwner),
            owner_claim_to: claimOwner || null,
            original_task_owner: originalTaskOwner,
            template:
                sourcePayload.template === undefined
                    ? null
                    : sourcePayload.template,
            from_files: Boolean(sourcePayload.from_files),
            file_inference: sourcePayload.file_inference || null,
            executor_source: String(sourcePayload.executor_source || 'apply'),
            scope_source: String(sourcePayload.scope_source || 'apply'),
            risk_source: String(sourcePayload.risk_source || 'apply'),
            preview: false,
            dry_run: false,
            validate_only: false,
            persisted: true,
            task: toTaskJson(task),
            task_full: toTaskFullJson(task),
            lease_action: leaseMeta?.lease_action || 'none',
            lease: leaseMeta?.lease || null,
            status_since_at: leaseMeta?.status_since_at || null,
        };
        if (
            explainInference &&
            Array.isArray(sourcePayload.inference_explanation)
        ) {
            applyPayload.inference_explanation =
                sourcePayload.inference_explanation;
        }

        if (wantsJson) {
            printJson(applyPayload);
            return;
        }

        if (
            explainInference &&
            Array.isArray(applyPayload.inference_explanation)
        ) {
            console.log('Task create explain (applied preview):');
            for (const line of applyPayload.inference_explanation) {
                console.log(`  - ${line}`);
            }
        }

        console.log(
            `Task create APPLY OK: ${task.id} [${task.status}] exec=${task.executor} from=${applyFile.path}`
        );
        return;
    }

    if (previewMode && validateOnly) {
        throw new Error(
            'task create no permite combinar --preview/--dry-run con --validate-only'
        );
    }

    if (isFlagEnabled(flags, 'interactive')) {
        flags = await collectTaskCreateInteractiveFlags(flags, wantsJson);
    }

    const board = parseBoard();
    const decisionsData =
        typeof parseDecisions === 'function'
            ? parseDecisions()
            : { decisions: [] };
    const template = resolveTaskCreateTemplate(flags.template);
    const requestedId = String(flags.id || '').trim();
    const newId = requestedId || nextAgentTaskId(board.tasks);

    if (!/^AG-\d+$/.test(newId)) {
        throw new Error(
            `task create requiere id AG-### (actual: ${newId || 'vacio'})`
        );
    }
    if (board.tasks.some((item) => String(item.id || '') === newId)) {
        throw new Error(`task create: id duplicado ${newId}`);
    }

    const title = String(flags.title || '').trim();
    if (!title) {
        throw new Error('task create requiere --title');
    }

    const explicitExecutor = String(flags.executor || '')
        .trim()
        .toLowerCase();

    const status = String(flags.status || template?.status || 'backlog').trim();
    if (!ALLOWED_STATUSES.has(status)) {
        throw new Error(`task create: status invalido (${status})`);
    }

    const files = parseCsvList(flags.files || '');
    if (files.length === 0) {
        throw new Error('task create requiere --files con lista CSV no vacia');
    }

    const fromFilesEnabled = isFlagEnabled(flags, 'from-files', 'from_files');
    const fileInference = fromFilesEnabled
        ? inferTaskCreateFromFiles(files)
        : null;

    const riskSource = flags.risk
        ? 'flag'
        : fileInference?.risk
          ? 'from_files'
          : template?.risk
            ? 'template'
            : 'default';
    const risk = String(
        flags.risk || fileInference?.risk || template?.risk || 'medium'
    )
        .trim()
        .toLowerCase();
    if (!['low', 'medium', 'high'].includes(risk)) {
        throw new Error(`task create: risk invalido (${risk})`);
    }
    const runtimeImpact = String(
        flags['runtime-impact'] ||
            flags.runtime_impact ||
            template?.runtime_impact ||
            'low'
    )
        .trim()
        .toLowerCase();
    if (!['none', 'low', 'high'].includes(runtimeImpact)) {
        throw new Error(
            `task create: runtime_impact invalido (${runtimeImpact})`
        );
    }
    const criticalZoneFlag = hasFlag(flags, 'critical-zone', 'critical_zone')
        ? isFlagEnabled(flags, 'critical-zone', 'critical_zone')
        : Boolean(template?.critical_zone);

    const owner = String(
        flags.owner || detectDefaultOwner() || 'unassigned'
    ).trim();
    const scopeSource = flags.scope
        ? 'flag'
        : fileInference?.scope
          ? 'from_files'
          : template?.scope
            ? 'template'
            : 'default';
    const scope = String(
        flags.scope || fileInference?.scope || template?.scope || 'general'
    ).trim();
    if (template?.requireCriticalScope && !findCriticalScopeKeyword(scope)) {
        throw new Error(
            `task create: template ${template.name} requiere --scope critico (${CRITICAL_SCOPE_KEYWORDS.join('|')})`
        );
    }

    let executorSource = 'default';
    let executor = String(template?.executor || '')
        .trim()
        .toLowerCase();
    if (explicitExecutor) {
        executor = explicitExecutor;
        executorSource = 'flag';
    } else if (!executor) {
        executor = '';
    } else {
        executorSource = 'template';
    }

    const inferredCriticalScope = fileInference?.critical_scope
        ? String(fileInference.critical_scope)
        : null;
    if (
        !explicitExecutor &&
        inferredCriticalScope &&
        fileInference?.suggested_executor &&
        !CRITICAL_SCOPE_ALLOWED_EXECUTORS.has(executor)
    ) {
        executor = String(fileInference.suggested_executor)
            .trim()
            .toLowerCase();
        executorSource = 'from_files_auto';
    }

    if (!executor) {
        throw new Error('task create requiere --executor');
    }
    if (!ALLOWED_TASK_EXECUTORS.has(executor)) {
        throw new Error(`task create: executor invalido (${executor})`);
    }
    if (isRetiredExecutor(executor, RETIRED_TASK_EXECUTORS)) {
        throw createRetiredExecutorError(executor, 'task create');
    }

    const explicitCodexInstance =
        readStringFlag(flags, 'codex-instance', 'codex_instance') ||
        normalizeOptionalToken(template?.codex_instance);
    const explicitDomainLane =
        readStringFlag(flags, 'domain-lane', 'domain_lane') ||
        normalizeOptionalToken(template?.domain_lane);
    const explicitLaneLock =
        readStringFlag(flags, 'lane-lock', 'lane_lock') ||
        normalizeOptionalToken(template?.lane_lock);
    const explicitProviderMode =
        readStringFlag(flags, 'provider-mode', 'provider_mode') ||
        normalizeOptionalToken(template?.provider_mode);
    const explicitRuntimeSurface =
        readStringFlag(flags, 'runtime-surface', 'runtime_surface') ||
        normalizeOptionalToken(template?.runtime_surface);
    const explicitRuntimeTransport =
        readStringFlag(flags, 'runtime-transport', 'runtime_transport') ||
        normalizeOptionalToken(template?.runtime_transport);
    const hasCrossDomainFlag = hasFlag(flags, 'cross-domain', 'cross_domain');
    const inferredLane = inferDomainLaneFromFiles(files);
    const crossDomain = hasCrossDomainFlag
        ? isFlagEnabled(flags, 'cross-domain', 'cross_domain')
        : Boolean(inferredLane?.hasCrossDomainFiles);
    const domainLane =
        explicitDomainLane ||
        String(inferredLane?.lane || '')
            .trim()
            .toLowerCase() ||
        'backend_ops';
    const codexInstance =
        explicitCodexInstance ||
        (domainLane === 'frontend_content'
            ? 'codex_frontend'
            : domainLane === 'transversal_runtime'
              ? 'codex_transversal'
              : 'codex_backend_ops');
    const laneLock =
        explicitLaneLock || (crossDomain ? 'handoff_allowed' : 'strict');
    if (!ALLOWED_DOMAIN_LANES.has(domainLane)) {
        throw new Error(`task create: domain_lane invalido (${domainLane})`);
    }
    if (!ALLOWED_CODEX_INSTANCES.has(codexInstance)) {
        throw new Error(
            `task create: codex_instance invalido (${codexInstance})`
        );
    }
    if (!ALLOWED_LANE_LOCKS.has(laneLock)) {
        throw new Error(`task create: lane_lock invalido (${laneLock})`);
    }
    if (
        explicitProviderMode &&
        !ALLOWED_PROVIDER_MODES.has(explicitProviderMode)
    ) {
        throw new Error(
            `task create: provider_mode invalido (${explicitProviderMode})`
        );
    }
    if (
        explicitRuntimeSurface &&
        !ALLOWED_RUNTIME_SURFACES.has(explicitRuntimeSurface)
    ) {
        throw new Error(
            `task create: runtime_surface invalido (${explicitRuntimeSurface})`
        );
    }
    if (
        explicitRuntimeTransport &&
        !ALLOWED_RUNTIME_TRANSPORTS.has(explicitRuntimeTransport)
    ) {
        throw new Error(
            `task create: runtime_transport invalido (${explicitRuntimeTransport})`
        );
    }

    const acceptance = String(flags.acceptance || title).trim();
    const acceptanceRef = String(
        flags['acceptance-ref'] || flags.acceptance_ref || ''
    ).trim();
    const dependsOn = parseCsvList(
        flags['depends-on'] || flags.depends_on || ''
    );
    const prompt = String(flags.prompt || title).trim();
    const today = currentDate();

    const task = {
        id: newId,
        title,
        owner,
        executor,
        status,
        risk,
        scope,
        codex_instance: codexInstance,
        domain_lane: domainLane,
        lane_lock: laneLock,
        cross_domain: crossDomain,
        provider_mode: explicitProviderMode,
        runtime_surface: explicitRuntimeSurface,
        runtime_transport: explicitRuntimeTransport,
        runtime_last_transport: '',
        files,
        source_signal: String(
            flags['source-signal'] || flags.source_signal || 'manual'
        )
            .trim()
            .toLowerCase(),
        source_ref: String(
            flags['source-ref'] || flags.source_ref || ''
        ).trim(),
        priority_score:
            Number.parseInt(
                String(flags['priority-score'] || flags.priority_score || '0'),
                10
            ) || 0,
        sla_due_at: String(
            flags['sla-due-at'] || flags.sla_due_at || ''
        ).trim(),
        last_attempt_at: String(
            flags['last-attempt-at'] || flags.last_attempt_at || ''
        ).trim(),
        attempts: Number.parseInt(String(flags.attempts || '0'), 10) || 0,
        blocked_reason: String(
            flags['blocked-reason'] || flags.blocked_reason || ''
        ).trim(),
        runtime_impact: runtimeImpact,
        critical_zone: criticalZoneFlag,
        acceptance,
        acceptance_ref: acceptanceRef,
        evidence_ref: '',
        depends_on: dependsOn,
        prompt,
        strategy_id: '',
        subfront_id: '',
        strategy_role: '',
        strategy_reason: '',
        focus_id: '',
        focus_step: '',
        integration_slice: '',
        work_type: '',
        expected_outcome: '',
        decision_ref: '',
        rework_parent: '',
        rework_reason: '',
        created_at: today,
        updated_at: today,
    };

    const inferenceExplainLines = explainInference
        ? buildTaskCreateInferenceExplainLines({
              fromFilesEnabled,
              fileInference,
              scopeSource,
              riskSource,
              executorSource,
              task,
              templateName: template?.name || null,
          })
        : null;

    const handoffData = parseHandoffs();
    applyDualCodexOverrides(task, flags, {
        isFlagEnabled,
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
    });
    applyStrategyOverrides(task, flags);
    applyFocusOverrides(task, flags);
    validateTaskGovernancePrechecks(board, task, {
        handoffs: handoffData.handoffs,
        decisionsData,
    });

    board.tasks.push(task);

    if (ACTIVE_STATUSES.has(status)) {
        const blockingConflicts = getBlockingConflictsForTask(
            board.tasks,
            newId,
            handoffData.handoffs
        );
        if (blockingConflicts.length > 0) {
            const details = blockingConflicts
                .map((item) => {
                    const other =
                        String(item.left.id) === newId ? item.right : item.left;
                    const filesText = item.overlap_files.length
                        ? item.overlap_files.join(', ')
                        : '(wildcard ambiguo)';
                    return `${newId} <-> ${other.id} :: ${filesText}`;
                })
                .join(' | ');
            throw new Error(
                `task create bloqueado por conflicto activo: ${details}`
            );
        }
    }

    const createPayload = {
        version: 1,
        ok: true,
        command: 'task',
        action: 'create',
        template: template?.name || null,
        from_files: fromFilesEnabled,
        file_inference: fileInference,
        executor_source: executorSource,
        scope_source: scopeSource,
        risk_source: riskSource,
        preview: previewMode,
        dry_run: previewMode,
        validate_only: validateOnly,
        persisted: !previewMode && !validateOnly,
        task: toTaskJson(task),
        task_full: toTaskFullJson(task),
    };
    if (inferenceExplainLines) {
        createPayload.inference_explanation = inferenceExplainLines;
    }

    if (validateOnly) {
        createPayload.validation = {
            active_status: ACTIVE_STATUSES.has(status),
            governance_prechecks: 'passed',
            conflict_check: 'passed',
        };
        delete createPayload.task_full;
    }

    if (!previewMode && !validateOnly) {
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'task create' }
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
                commandLabel: 'task create',
            });
        }
        try {
            writeBoardAndSync(board, {
                silentSync: wantsJson,
                command: 'task create',
                actor: task.owner || task.executor || '',
                expectRevision,
            });
        } catch (error) {
            if (wantsJson) {
                printTaskJsonError(printJson, error, 'create');
                return;
            }
            throw error;
        }
    }
    const leaseMeta =
        !previewMode && !validateOnly
            ? getTaskWriteLeaseMeta(getLastBoardWriteMeta, newId)
            : null;
    createPayload.lease_action = leaseMeta?.lease_action || 'none';
    createPayload.lease = leaseMeta?.lease || null;
    createPayload.status_since_at = leaseMeta?.status_since_at || null;

    const taskCreateDiagnostics = buildTaskCreateWarnDiagnostics({
        fromFilesEnabled,
        fileInference,
        scopeSource,
        task,
    });
    const createPayloadWithDiagnostics = attachDiagnostics(
        createPayload,
        taskCreateDiagnostics
    );

    if (wantsJson) {
        printJson(createPayloadWithDiagnostics);
        return;
    }

    if (explainInference && Array.isArray(inferenceExplainLines)) {
        console.log('Task create explain:');
        for (const line of inferenceExplainLines) {
            console.log(`  - ${line}`);
        }
    }

    console.log(
        `Task create ${validateOnly ? 'VALIDATE OK' : previewMode ? 'PREVIEW' : 'OK'}: ${newId} [${status}] exec=${executor}${template ? ` template=${template.name}` : ''}${fromFilesEnabled ? ' from-files=true' : ''}${executorSource !== 'flag' ? ` executor-source=${executorSource}` : ''}${previewMode || validateOnly ? ' (no-write)' : ''}`
    );
    for (const diag of taskCreateDiagnostics) {
        console.log(
            `WARN [${String(diag.code || '').trim() || 'warn.unknown'}]: ${diag.message || ''}`
        );
    }
}

module.exports = {
    handleTaskCommand,
    handleTaskList,
    handleTaskClaim,
    handleTaskStart,
    handleTaskFinish,
    handleTaskCreate,
};
