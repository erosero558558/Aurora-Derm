#!/usr/bin/env node
/**
 * Agent Orchestrator
 *
 * Canonical source: AGENT_BOARD.yaml
 * Legacy tombstones: JULES_TASKS.md, KIMI_TASKS.md
 *
 * Commands:
 *   node agent-orchestrator.js status [--json]
 *   node agent-orchestrator.js conflicts [--strict]
 *   node agent-orchestrator.js handoffs <status|lint|create|close>
 *   node agent-orchestrator.js policy lint [--json]
 *   node agent-orchestrator.js codex-check
 *   node agent-orchestrator.js codex <start|stop> <CDX-ID> [--block C1] [--to done]
 *   node agent-orchestrator.js task <ls|claim|start|finish> [<AG-ID>] [...]
 *   node agent-orchestrator.js sync
 *   node agent-orchestrator.js close <task_id> [--evidence path]
 *   node agent-orchestrator.js metrics [--json] [--profile local|ci] [--write|--no-write] [--dry-run]
 *   node agent-orchestrator.js metrics baseline <show|set|reset> [--from current] [--json]
 */

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const readline = require('readline');
const { resolve, dirname } = require('path');
const coreFlags = require('./tools/agent-orchestrator/core/flags');
const coreParsers = require('./tools/agent-orchestrator/core/parsers');
const coreSerializers = require('./tools/agent-orchestrator/core/serializers');
const corePolicy = require('./tools/agent-orchestrator/core/policy');
const coreTime = require('./tools/agent-orchestrator/core/time');
const coreIo = require('./tools/agent-orchestrator/core/io');
const coreOutput = require('./tools/agent-orchestrator/core/output');
const domainConflicts = require('./tools/agent-orchestrator/domain/conflicts');
const domainHandoffs = require('./tools/agent-orchestrator/domain/handoffs');
const domainCodexMirror = require('./tools/agent-orchestrator/domain/codex-mirror');
const domainTaskGuards = require('./tools/agent-orchestrator/domain/task-guards');
const domainTaskCreate = require('./tools/agent-orchestrator/domain/task-create');
const domainTaskShape = require('./tools/agent-orchestrator/domain/task-shape');
const domainDiagnostics = require('./tools/agent-orchestrator/domain/diagnostics');
const domainMetrics = require('./tools/agent-orchestrator/domain/metrics');
const domainStatus = require('./tools/agent-orchestrator/domain/status');
const domainJobs = require('./tools/agent-orchestrator/domain/jobs');
const domainBoardLeases = require('./tools/agent-orchestrator/domain/board-leases');
const domainBoardDoctor = require('./tools/agent-orchestrator/domain/board-doctor');
const domainBoardEvents = require('./tools/agent-orchestrator/domain/board-events');
const domainGitHubSignals = require('./tools/agent-orchestrator/domain/github-signals');
const statusCommandHandlers = require('./tools/agent-orchestrator/commands/status');
const conflictsCommandHandlers = require('./tools/agent-orchestrator/commands/conflicts');
const policyCommandHandlers = require('./tools/agent-orchestrator/commands/policy');
const handoffsCommandHandlers = require('./tools/agent-orchestrator/commands/handoffs');
const codexCommandHandlers = require('./tools/agent-orchestrator/commands/codex');
const metricsCommandHandlers = require('./tools/agent-orchestrator/commands/metrics');
const syncCommandHandlers = require('./tools/agent-orchestrator/commands/sync');
const closeCommandHandlers = require('./tools/agent-orchestrator/commands/close');
const taskCommandHandlers = require('./tools/agent-orchestrator/commands/task');
const leasesCommandHandlers = require('./tools/agent-orchestrator/commands/leases');
const boardCommandHandlers = require('./tools/agent-orchestrator/commands/board');
const jobsCommandHandlers = require('./tools/agent-orchestrator/commands/jobs');
const publishCommandHandlers = require('./tools/agent-orchestrator/commands/publish');
const domainIntake = require('./tools/agent-orchestrator/domain/intake');
const runtimeGovernanceCommands = require('./tools/agent-orchestrator/commands/runtime-governance');
const runtimeIntakeCommands = require('./tools/agent-orchestrator/commands/runtime-intake');

const ROOT = __dirname;
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const HANDOFFS_PATH = resolve(ROOT, 'AGENT_HANDOFFS.yaml');
const SIGNALS_PATH = resolve(ROOT, 'AGENT_SIGNALS.yaml');
const JOBS_PATH = resolve(ROOT, 'AGENT_JOBS.yaml');
const JULES_PATH = resolve(ROOT, 'JULES_TASKS.md');
const KIMI_PATH = resolve(ROOT, 'KIMI_TASKS.md');
const CODEX_PLAN_PATH = resolve(ROOT, 'PLAN_MAESTRO_CODEX_2026.md');
const EVIDENCE_DIR = resolve(ROOT, 'verification', 'agent-runs');
const METRICS_PATH = resolve(ROOT, 'verification', 'agent-metrics.json');
const GOVERNANCE_POLICY_PATH = resolve(ROOT, 'governance-policy.json');
const CONTRIBUTION_HISTORY_PATH = resolve(
    ROOT,
    'verification',
    'agent-contribution-history.json'
);
const DOMAIN_HEALTH_HISTORY_PATH = resolve(
    ROOT,
    'verification',
    'agent-domain-health-history.json'
);
const BOARD_EVENTS_PATH = resolve(
    ROOT,
    'verification',
    'agent-board-events.jsonl'
);
const PUBLISH_EVENTS_PATH = resolve(
    ROOT,
    'verification',
    'agent-publish-events.jsonl'
);
const DEFAULT_GITHUB_REPOSITORY =
    process.env.AGENT_GITHUB_REPOSITORY ||
    process.env.GITHUB_REPOSITORY ||
    'erosero558558/piel-en-armonia';
const DEFAULT_PRIORITY_DOMAINS = ['calendar', 'chat', 'payments'];
const DEFAULT_DOMAIN_HEALTH_WEIGHTS = {
    calendar: 5,
    chat: 3,
    payments: 2,
    default: 1,
};
const DEFAULT_DOMAIN_SIGNAL_SCORES = {
    GREEN: 100,
    YELLOW: 60,
    RED: 0,
};
const DEFAULT_GOVERNANCE_POLICY = {
    version: 1,
    agents: {
        active_executors: ['codex', 'ci'],
        retired_executors: ['claude', 'jules', 'kimi'],
        allow_legacy_terminal_executors: true,
    },
    publishing: {
        enabled: true,
        mode: 'main_auto_guarded',
        trigger: 'validated_checkpoint',
        branch: 'main',
        gate_profile: 'fast_targeted',
        checkpoint_cooldown_seconds: 90,
        max_live_wait_seconds: 180,
        health_url: 'https://pielarmonia.com/api.php?resource=health',
        required_job_key: 'public_main_sync',
    },
    domain_health: {
        priority_domains: DEFAULT_PRIORITY_DOMAINS,
        domain_weights: DEFAULT_DOMAIN_HEALTH_WEIGHTS,
        signal_scores: DEFAULT_DOMAIN_SIGNAL_SCORES,
    },
    summary: {
        thresholds: {
            domain_score_priority_yellow_below: 80,
        },
    },
    enforcement: {
        branch_profiles: {
            pull_request: { fail_on_red: 'warn' },
            main: { fail_on_red: 'warn' },
            staging: { fail_on_red: 'warn' },
            workflow_dispatch: { fail_on_red: 'warn' },
        },
        warning_policies: {
            active_broad_glob: { severity: 'warning', enabled: true },
            handoff_expiring_soon: {
                severity: 'warning',
                enabled: true,
                hours_threshold: 4,
            },
            metrics_baseline_missing: { severity: 'warning', enabled: true },
            from_files_fallback_default_scope: {
                severity: 'warning',
                enabled: true,
            },
            policy_unknown_keys: { severity: 'warning', enabled: true },
            lease_missing_active: { severity: 'warning', enabled: true },
            lease_expired_active: { severity: 'warning', enabled: true },
            heartbeat_stale: { severity: 'warning', enabled: true },
            task_in_progress_stale: { severity: 'warning', enabled: true },
            task_blocked_stale: { severity: 'warning', enabled: true },
            done_without_evidence: { severity: 'warning', enabled: true },
            wip_limit_executor: { severity: 'warning', enabled: true },
            wip_limit_scope: { severity: 'warning', enabled: true },
            retired_executor_active: { severity: 'warning', enabled: true },
            public_main_sync_unconfigured: {
                severity: 'warning',
                enabled: true,
            },
            public_main_sync_stale: { severity: 'warning', enabled: true },
            public_main_sync_failed: { severity: 'warning', enabled: true },
            public_main_sync_head_drift: {
                severity: 'warning',
                enabled: true,
            },
            public_main_sync_telemetry_gap: {
                severity: 'warning',
                enabled: true,
            },
        },
        board_leases: {
            enabled: true,
            required_statuses: ['in_progress', 'review'],
            tracked_statuses: ['in_progress', 'review', 'blocked'],
            ttl_hours_default: 4,
            ttl_hours_max: 24,
            heartbeat_stale_minutes: 30,
            auto_clear_on_terminal: true,
        },
        board_doctor: {
            enabled: true,
            strict_default: false,
            thresholds: {
                in_progress_stale_hours: 24,
                blocked_stale_hours: 24,
                review_stale_hours: 48,
                done_without_evidence_max_hours: 1,
            },
        },
        wip_limits: {
            enabled: true,
            mode: 'warn',
            count_statuses: ['in_progress', 'review', 'blocked'],
            by_executor: {
                codex: 3,
                ci: 3,
            },
            by_scope: {
                calendar: 2,
                payments: 2,
                auth: 2,
                default: 4,
            },
        },
    },
};
const GOVERNANCE_POLICY_CACHE_REF = { current: null };

const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);
const TERMINAL_STATUSES = new Set(['done', 'failed']);

function isTerminalTaskStatus(statusRaw) {
    return TERMINAL_STATUSES.has(
        String(statusRaw || '')
            .trim()
            .toLowerCase()
    );
}
const ALLOWED_TASK_EXECUTORS = new Set([
    'codex',
    'claude',
    'jules',
    'kimi',
    'ci',
]);
const RETIRED_TASK_EXECUTORS = new Set(['claude', 'jules', 'kimi']);
const CRITICAL_SCOPE_KEYWORDS = [
    'payments',
    'auth',
    'calendar',
    'deploy',
    'env',
    'security',
];
const CRITICAL_SCOPE_ALLOWED_EXECUTORS = new Set(['codex']);
const ALLOWED_CODEX_INSTANCES = new Set([
    'codex_backend_ops',
    'codex_frontend',
]);
const ALLOWED_DOMAIN_LANES = new Set(['backend_ops', 'frontend_content']);
const ALLOWED_LANE_LOCKS = new Set(['strict', 'handoff_allowed']);
const DUAL_CODEX_OWNERSHIP_MATRIX =
    domainTaskGuards.DEFAULT_DUAL_CODEX_OWNERSHIP;
const TASK_CREATE_TEMPLATES = {
    docs: {
        executor: 'codex',
        status: 'ready',
        risk: 'low',
        scope: 'docs',
    },
    bugfix: {
        executor: 'codex',
        status: 'ready',
        risk: 'medium',
        scope: 'backend',
    },
    critical: {
        executor: 'codex',
        status: 'ready',
        risk: 'high',
        scope: 'calendar',
        requireCriticalScope: true,
    },
};

function normalizeEol(value) {
    return coreParsers.normalizeEol(value);
}

function shallowMerge(target, source) {
    return corePolicy.shallowMerge(target, source);
}

function getGovernancePolicy() {
    return corePolicy.getGovernancePolicy({
        cacheRef: GOVERNANCE_POLICY_CACHE_REF,
        existsSync,
        readFileSync,
        policyPath: GOVERNANCE_POLICY_PATH,
        defaultPolicy: DEFAULT_GOVERNANCE_POLICY,
    });
}

function readGovernancePolicyStrict() {
    return corePolicy.readGovernancePolicyStrict({
        existsSync,
        readFileSync,
        policyPath: GOVERNANCE_POLICY_PATH,
    });
}

function validateGovernancePolicy(rawPolicy) {
    return corePolicy.validateGovernancePolicy(rawPolicy, {
        defaultPolicy: DEFAULT_GOVERNANCE_POLICY,
        policyPath: 'governance-policy.json',
        policyExists: existsSync(GOVERNANCE_POLICY_PATH),
    });
}

function unquote(value) {
    return coreParsers.unquote(value);
}

function parseInlineArray(value) {
    return coreParsers.parseInlineArray(value);
}

function parseScalar(value) {
    return coreParsers.parseScalar(value);
}

function parseBoard() {
    if (!existsSync(BOARD_PATH)) {
        throw new Error(`No existe ${BOARD_PATH}`);
    }
    return coreParsers.parseBoardContent(readFileSync(BOARD_PATH, 'utf8'), {
        allowedStatuses: ALLOWED_STATUSES,
    });
}

function parseHandoffs() {
    if (!existsSync(HANDOFFS_PATH)) {
        return { version: 1, handoffs: [] };
    }
    return coreParsers.parseHandoffsContent(
        readFileSync(HANDOFFS_PATH, 'utf8')
    );
}

function parseCodexActiveBlocks() {
    if (!existsSync(CODEX_PLAN_PATH)) {
        return [];
    }
    return coreParsers.parseCodexActiveBlocksContent(
        readFileSync(CODEX_PLAN_PATH, 'utf8')
    );
}

function serializeHandoffs(data) {
    return coreSerializers.serializeHandoffs(data);
}

function parseSignals() {
    return coreIo.readSignalsFile({
        signalsPath: SIGNALS_PATH,
        exists: existsSync,
        readFile: readFileSync,
        parseSignalsContent: coreParsers.parseSignalsContent,
        currentDate,
    });
}

function parseJobs() {
    return coreIo.readJobsFile({
        jobsPath: JOBS_PATH,
        exists: existsSync,
        readFile: readFileSync,
        parseJobsContent: coreParsers.parseJobsContent,
        currentDate,
    });
}

function writeSignals(data) {
    return coreIo.writeSignalsFile(data, {
        signalsPath: SIGNALS_PATH,
        serializeSignals: (value) =>
            coreSerializers.serializeSignals(value, { currentDate }),
        writeFile: writeFileSync,
    });
}

function parseFlags(args) {
    return coreFlags.parseFlags(args);
}

function parseCsvList(value) {
    return coreFlags.parseCsvList(value);
}

function isTruthyFlagValue(value) {
    return coreFlags.isTruthyFlagValue(value);
}

function isFlagEnabled(flags, ...keys) {
    return coreFlags.isFlagEnabled(flags, ...keys);
}

function isoNow() {
    return coreTime.isoNow();
}

function plusHoursIso(hours) {
    return coreTime.plusHoursIso(hours);
}

function ensureTask(board, taskId) {
    const task = board.tasks.find((item) => String(item.id) === String(taskId));
    if (!task) {
        throw new Error(`No existe task_id ${taskId} en AGENT_BOARD.yaml`);
    }
    return task;
}

function findCriticalScopeKeyword(scopeValue) {
    return domainTaskGuards.findCriticalScopeKeyword(
        scopeValue,
        CRITICAL_SCOPE_KEYWORDS
    );
}

function inferDomainLaneFromFiles(files) {
    return domainTaskGuards.inferDomainLaneFromFiles(files, {
        ownershipMatrix: DUAL_CODEX_OWNERSHIP_MATRIX,
    });
}

function ensureTaskDualCodexDefaults(task) {
    return domainTaskGuards.ensureTaskDualCodexDefaults(task, {
        ownershipMatrix: DUAL_CODEX_OWNERSHIP_MATRIX,
    });
}

function validateTaskExecutorScopeGuard(task) {
    return domainTaskGuards.validateTaskExecutorScopeGuard(task, {
        criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
        allowedExecutors: CRITICAL_SCOPE_ALLOWED_EXECUTORS,
    });
}

function validateTaskDependsOn(board, task, options = {}) {
    return domainTaskGuards.validateTaskDependsOn(board, task, options);
}

function validateTaskGovernancePrechecks(board, task, options = {}) {
    return domainTaskGuards.validateTaskGovernancePrechecks(board, task, {
        ...options,
        criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
        allowedExecutors: CRITICAL_SCOPE_ALLOWED_EXECUTORS,
        allowedCodexInstances: ALLOWED_CODEX_INSTANCES,
        allowedDomainLanes: ALLOWED_DOMAIN_LANES,
        allowedLaneLocks: ALLOWED_LANE_LOCKS,
        ownershipMatrix: DUAL_CODEX_OWNERSHIP_MATRIX,
        activeStatuses: ACTIVE_STATUSES,
        isExpired,
    });
}

function resolveTaskCreateTemplate(templateNameRaw) {
    return domainTaskCreate.resolveTaskCreateTemplate(templateNameRaw, {
        templates: TASK_CREATE_TEMPLATES,
    });
}

function inferTaskCreateFromFiles(files) {
    return domainTaskCreate.inferTaskCreateFromFiles(files, {
        normalizePathToken,
        criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
        inferTaskDomain,
        findCriticalScopeKeyword,
        criticalScopeAllowedExecutors: CRITICAL_SCOPE_ALLOWED_EXECUTORS,
    });
}

function buildTaskCreateInferenceExplainLines(context = {}) {
    return domainTaskCreate.buildTaskCreateInferenceExplainLines(context);
}

function createPromptInterface(wantsJson = false) {
    return domainTaskCreate.createPromptInterface(wantsJson, {
        readline,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
    });
}

function askLine(rl, promptText) {
    return domainTaskCreate.askLine(rl, promptText);
}

async function collectTaskCreateInteractiveFlags(
    flags = {},
    wantsJson = false
) {
    return domainTaskCreate.collectTaskCreateInteractiveFlags(
        flags,
        wantsJson,
        {
            processObj: process,
            readFileSync,
            readline,
            stdout: process.stdout,
            stderr: process.stderr,
            createPromptInterface,
            askLine,
        }
    );
}

function normalizeBoardLeasesPolicy(policy = getGovernancePolicy()) {
    return domainBoardLeases.normalizeBoardLeasesPolicy(policy);
}

function getTaskLeaseSummary(task, options = {}) {
    return domainBoardLeases.getTaskLeaseSummary(task, options);
}

function parseBoardRevisionValue(value) {
    const n = Number(String(value ?? '').trim());
    return Number.isInteger(n) && n >= 0 ? n : 0;
}

function createBoardRevisionMismatchError(expectedRevision, actualRevision) {
    const error = new Error(
        `board revision mismatch: expected ${expectedRevision}, actual ${actualRevision}`
    );
    error.code = 'board_revision_mismatch';
    error.error_code = 'board_revision_mismatch';
    error.expected_revision = expectedRevision;
    error.actual_revision = actualRevision;
    return error;
}

function parseExpectedBoardRevisionFlag(flags = {}) {
    const raw =
        flags['expect-rev'] !== undefined
            ? flags['expect-rev']
            : flags.expect_rev;
    if (raw === undefined || raw === true || String(raw).trim() === '') {
        return null;
    }
    const parsed = Number(String(raw).trim());
    if (!Number.isInteger(parsed) || parsed < 0) {
        const error = new Error('--expect-rev debe ser entero >= 0');
        error.code = 'invalid_expect_rev';
        error.error_code = 'invalid_expect_rev';
        return error;
    }
    return parsed;
}

function buildBoardWipLimitDiagnostics(board, options = {}) {
    const {
        taskIds = null,
        executors = null,
        scopes = null,
        source = 'command',
        now = new Date(),
    } = options;
    const policy = getGovernancePolicy();
    const leasePolicy = normalizeBoardLeasesPolicy(policy);
    const report = domainBoardDoctor.buildBoardDoctorReport(
        {
            board,
            policy,
            leasePolicy,
            handoffData: { handoffs: [] },
            conflictAnalysis: { blocking: [], handoffCovered: [] },
            now,
        },
        {
            getTaskLeaseSummary,
            makeDiagnostic: domainDiagnostics.makeDiagnostic,
            getWarnPolicyMap: domainDiagnostics.getWarnPolicyMap,
            warnPolicyEnabled: domainDiagnostics.warnPolicyEnabled,
            warnPolicySeverity: domainDiagnostics.warnPolicySeverity,
            isBroadGlobPath: domainDiagnostics.isBroadGlobPath,
        }
    );

    const taskIdSet = Array.isArray(taskIds)
        ? new Set(taskIds.map((v) => String(v || '').trim()).filter(Boolean))
        : null;
    const executorSet = Array.isArray(executors)
        ? new Set(
              executors
                  .map((v) =>
                      String(v || '')
                          .trim()
                          .toLowerCase()
                  )
                  .filter(Boolean)
          )
        : null;
    const scopeSet = Array.isArray(scopes)
        ? new Set(
              scopes
                  .map((v) =>
                      String(v || '')
                          .trim()
                          .toLowerCase()
                  )
                  .filter(Boolean)
          )
        : null;

    return (Array.isArray(report?.diagnostics) ? report.diagnostics : [])
        .filter((diag) =>
            /^warn\.board\.wip_limit_/.test(String(diag.code || ''))
        )
        .filter((diag) => {
            if (!taskIdSet && !executorSet && !scopeSet) return true;
            const diagTaskIds = Array.isArray(diag.task_ids)
                ? diag.task_ids.map((v) => String(v || '').trim())
                : [];
            const diagExecutor = String(diag?.meta?.executor || '')
                .trim()
                .toLowerCase();
            const diagScope = String(diag?.meta?.scope || '')
                .trim()
                .toLowerCase();
            if (taskIdSet && diagTaskIds.some((id) => taskIdSet.has(id)))
                return true;
            if (executorSet && diagExecutor && executorSet.has(diagExecutor))
                return true;
            if (scopeSet && diagScope && scopeSet.has(diagScope)) return true;
            return false;
        })
        .map((diag) => ({ ...diag, source }));
}

function applyBoardLeasesBeforeWrite(board, options = {}) {
    return domainBoardLeases.applyBoardLeasesBeforeWrite(board, {
        policy: getGovernancePolicy(),
        terminalStatuses: TERMINAL_STATUSES,
        ...options,
    });
}

let LAST_BOARD_WRITE_META = null;

function getLastBoardWriteMeta() {
    return LAST_BOARD_WRITE_META;
}

function writeBoard(board, options = {}) {
    const {
        command = 'board_write',
        source = 'cli',
        actor = '',
        expectRevision = null,
    } = options;
    const prevBoard = existsSync(BOARD_PATH) ? parseBoard() : null;
    const prevRevision = parseBoardRevisionValue(prevBoard?.policy?.revision);
    if (expectRevision !== null && expectRevision !== undefined) {
        const expected = Number(expectRevision);
        if (!Number.isInteger(expected) || expected < 0) {
            const error = new Error('--expect-rev debe ser entero >= 0');
            error.code = 'invalid_expect_rev';
            error.error_code = 'invalid_expect_rev';
            throw error;
        }
        if (expected !== prevRevision) {
            throw createBoardRevisionMismatchError(expected, prevRevision);
        }
    }
    board.policy = board.policy || {};
    board.policy.revision = prevRevision + 1;
    const nowIsoValue = isoNow();
    const lifecycle = applyBoardLeasesBeforeWrite(board, {
        prevBoard,
        nowIso: nowIsoValue,
        currentDate: currentDate(),
    });
    const writtenBoard = coreIo.writeBoardFile(board, {
        currentDate,
        boardPath: BOARD_PATH,
        serializeBoard,
        writeFile: writeFileSync,
    });
    let boardEvents = { events: [], appended: 0 };
    try {
        if (prevBoard) {
            boardEvents = domainBoardEvents.appendBoardEventsForDiff(
                prevBoard,
                writtenBoard,
                {
                    appendJsonlFile: coreIo.appendJsonlFile,
                    eventsPath: BOARD_EVENTS_PATH,
                    nowIso: nowIsoValue,
                    command,
                    source,
                    actor,
                }
            );
        }
    } catch {
        boardEvents = { events: [], appended: 0 };
    }
    LAST_BOARD_WRITE_META = {
        now_iso: nowIsoValue,
        revision: {
            previous: prevRevision,
            written: parseBoardRevisionValue(writtenBoard?.policy?.revision),
            expected:
                expectRevision === null || expectRevision === undefined
                    ? null
                    : Number(expectRevision),
        },
        lifecycle,
        board_events: boardEvents,
    };
    return writtenBoard;
}

function writeBoardAndSync(board, options = {}) {
    const { silentSync = false, ...writeOptions } = options;
    writeBoard(board, writeOptions);
    syncDerivedQueues({ silent: silentSync });
}

function appendHandoffBoardEvent(eventType, handoff, options = {}) {
    const {
        actor = '',
        command = 'handoffs',
        source = 'cli',
        reason = '',
        nowIso = isoNow(),
        board = null,
    } = options;
    return domainBoardEvents.appendHandoffEvent({
        appendJsonlFile: coreIo.appendJsonlFile,
        eventsPath: BOARD_EVENTS_PATH,
        eventType,
        handoff,
        actor,
        command,
        source,
        reason,
        nowIso,
        board: board || parseBoard(),
    });
}

function detectDefaultOwner(currentValue = '') {
    return String(
        process.env.AGENT_OWNER ||
            process.env.USERNAME ||
            process.env.USER ||
            currentValue ||
            ''
    ).trim();
}

function isCodexTaskId(taskId) {
    return /^CDX-\d+$/.test(String(taskId || '').trim());
}

function assertNonCodexTaskForTaskCommand(taskId) {
    if (isCodexTaskId(taskId)) {
        throw new Error(
            `Task ${taskId} es CDX-*; usa 'node agent-orchestrator.js codex <start|stop> ...' para mantener CODEX_ACTIVE sincronizado`
        );
    }
}

function getBlockingConflictsForTask(tasks, taskId, handoffs = []) {
    const target = String(taskId || '').trim();
    return analyzeConflicts(tasks, handoffs).blocking.filter(
        (item) =>
            String(item.left.id) === target || String(item.right.id) === target
    );
}

function resolveTaskEvidencePath(taskId, flags = {}) {
    return coreIo.resolveTaskEvidencePath(taskId, flags, {
        rootPath: ROOT,
        evidenceDirPath: EVIDENCE_DIR,
        resolvePath: resolve,
    });
}

function toRelativeRepoPath(path) {
    return coreIo.toRelativeRepoPath(path, {
        rootPath: ROOT,
    });
}

function toTaskJson(task) {
    return domainTaskShape.toTaskJson(task);
}

function toTaskFullJson(task) {
    return domainTaskShape.toTaskFullJson(task);
}

function normalizeTaskForCreateApply(rawTask) {
    return domainTaskCreate.normalizeTaskForCreateApply(rawTask, {
        currentDate,
        allowedTaskExecutors: ALLOWED_TASK_EXECUTORS,
        allowedStatuses: ALLOWED_STATUSES,
    });
}

function loadTaskCreateApplyPayload(applyPathRaw, options = {}) {
    return domainTaskCreate.loadTaskCreateApplyPayload(applyPathRaw, {
        ...options,
        rootPath: ROOT,
        existsSync,
        readFileSync,
    });
}

function summarizeBlockingConflictsForTask(taskId, conflicts) {
    return domainTaskCreate.summarizeBlockingConflictsForTask(
        taskId,
        conflicts
    );
}

function formatBlockingConflictSummary(taskId, conflicts) {
    return domainTaskCreate.formatBlockingConflictSummary(taskId, conflicts);
}

function buildTaskCreatePreviewDiff(existingTask, previewTask) {
    return domainTaskCreate.buildTaskCreatePreviewDiff(
        existingTask,
        previewTask,
        {
            toTaskFullJson,
        }
    );
}

function buildCodexActiveComment(block) {
    return domainCodexMirror.buildCodexActiveComment(block, {
        serializeArrayInline,
        currentDate,
    });
}

function upsertCodexActiveBlock(planRaw, block, options = {}) {
    return domainCodexMirror.upsertCodexActiveBlock(planRaw, block, {
        buildComment: buildCodexActiveComment,
        anchorText: 'Relacion con Operativo 2026:',
        codexInstance: options.codexInstance || options.codex_instance || null,
    });
}

function writeCodexActiveBlock(block, options = {}) {
    return coreIo.writeCodexActiveBlockFile(block, {
        codexPlanPath: CODEX_PLAN_PATH,
        exists: existsSync,
        readFile: readFileSync,
        writeFile: writeFileSync,
        upsertCodexActiveBlock,
        codexInstance: options.codex_instance || block?.codex_instance || null,
    });
}

function nextHandoffId(handoffs) {
    return domainHandoffs.nextHandoffId(handoffs);
}

function nextAgentTaskId(tasks) {
    return domainTaskCreate.nextAgentTaskId(tasks);
}

function quote(value) {
    return coreSerializers.quote(value);
}

function serializeArrayInline(values) {
    return coreSerializers.serializeArrayInline(values);
}

function serializeBoard(board) {
    return coreSerializers.serializeBoard(board, {
        currentDate,
    });
}

function currentDate() {
    return coreTime.currentDate();
}

function getStatusCounts(tasks) {
    return tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});
}

function getExecutorCounts(tasks) {
    return tasks.reduce((acc, task) => {
        acc[task.executor] = (acc[task.executor] || 0) + 1;
        return acc;
    }, {});
}

function percent(part, total) {
    return domainMetrics.percent(part, total);
}

function riskWeight(task) {
    return domainMetrics.riskWeight(task);
}

function buildExecutorContribution(tasks) {
    return domainMetrics.buildExecutorContribution(tasks, {
        activeStatuses: ACTIVE_STATUSES,
    });
}

function inferTaskDomain(task) {
    return domainMetrics.inferTaskDomain(task, { normalizePathToken });
}

function buildDomainHealth(tasks, conflictAnalysis, handoffs = []) {
    return domainMetrics.buildDomainHealth(tasks, conflictAnalysis, handoffs, {
        getGovernancePolicy,
        shallowMerge,
        defaultPriorityDomains: DEFAULT_PRIORITY_DOMAINS,
        defaultDomainHealthWeights: DEFAULT_DOMAIN_HEALTH_WEIGHTS,
        defaultDomainSignalScores: DEFAULT_DOMAIN_SIGNAL_SCORES,
        activeStatuses: ACTIVE_STATUSES,
        isExpired,
        normalizePathToken,
        policyExists: existsSync(GOVERNANCE_POLICY_PATH),
    });
}

function loadContributionHistory() {
    if (!existsSync(CONTRIBUTION_HISTORY_PATH)) return null;
    try {
        return JSON.parse(readFileSync(CONTRIBUTION_HISTORY_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function sanitizeContributionSnapshotExecutors(contribution) {
    return domainMetrics.sanitizeContributionSnapshotExecutors(contribution);
}

function upsertContributionHistory(history, contribution) {
    return domainMetrics.upsertContributionHistory(history, contribution);
}

function buildContributionHistorySummary(history, days = 7) {
    return domainMetrics.buildContributionHistorySummary(history, days);
}

function loadDomainHealthHistory() {
    if (!existsSync(DOMAIN_HEALTH_HISTORY_PATH)) return null;
    try {
        return JSON.parse(readFileSync(DOMAIN_HEALTH_HISTORY_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function sanitizeDomainHealthSnapshot(domainHealth) {
    return domainMetrics.sanitizeDomainHealthSnapshot(domainHealth);
}

function upsertDomainHealthHistory(history, domainHealth) {
    return domainMetrics.upsertDomainHealthHistory(history, domainHealth);
}

function buildDomainHealthHistorySummary(history, days = 7) {
    return domainMetrics.buildDomainHealthHistorySummary(history, days);
}

async function loadJobsSnapshot() {
    const registry = parseJobs();
    return domainJobs.buildJobsSnapshot(registry, {
        existsSync,
        readFileSync,
        fetchImpl: typeof fetch === 'function' ? fetch : null,
    });
}

function summarizeJobsSnapshot(jobs) {
    return domainJobs.summarizeJobsSnapshot(jobs);
}

function loadMetricsSnapshot() {
    if (!existsSync(METRICS_PATH)) return null;
    try {
        return JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function normalizeContributionBaseline(metricsSnapshot) {
    return domainMetrics.normalizeContributionBaseline(metricsSnapshot);
}

function buildContributionTrend(currentContribution, baselineContribution) {
    return domainMetrics.buildContributionTrend(
        currentContribution,
        baselineContribution
    );
}

function getContributionSignal(row) {
    return domainMetrics.getContributionSignal(row);
}

function formatPpDelta(value) {
    return domainMetrics.formatPpDelta(value);
}

function wildcardToRegex(pattern) {
    return domainConflicts.wildcardToRegex(pattern);
}

function normalizePathToken(value) {
    return domainConflicts.normalizePathToken(value);
}

function hasWildcard(value) {
    return domainConflicts.hasWildcard(value);
}

function analyzeFileOverlap(filesA, filesB) {
    return domainConflicts.analyzeFileOverlap(filesA, filesB);
}

function _filesOverlap(filesA, filesB) {
    return domainConflicts.filesOverlap(filesA, filesB);
}

function isExpired(dateValue) {
    return domainConflicts.isExpired(dateValue);
}

function isActiveHandoff(handoff) {
    return domainConflicts.isActiveHandoff(handoff);
}

function sameTaskPair(handoff, leftTask, rightTask) {
    return domainConflicts.sameTaskPair(handoff, leftTask, rightTask);
}

function analyzeConflicts(tasks, handoffs = []) {
    return domainConflicts.analyzeConflicts(tasks, handoffs, {
        activeStatuses: ACTIVE_STATUSES,
    });
}

function _detectConflicts(tasks, handoffs = []) {
    return domainConflicts.detectConflicts(tasks, handoffs, {
        activeStatuses: ACTIVE_STATUSES,
    });
}

function toConflictJsonRecord(item) {
    return domainConflicts.toConflictJsonRecord(item);
}

function buildStatusRedExplanation({
    conflictAnalysis,
    handoffData,
    handoffLintErrors,
    codexCheckReport,
    domainHealth,
    domainHealthHistory,
}) {
    return domainDiagnostics.buildStatusRedExplanation(
        {
            conflictAnalysis,
            handoffData,
            handoffLintErrors,
            codexCheckReport,
            domainHealth,
            domainHealthHistory,
        },
        {
            isExpired,
            toConflictJsonRecord,
        }
    );
}

function buildWarnFirstDiagnostics({
    source,
    board = null,
    handoffData = null,
    conflictAnalysis = null,
    metricsSnapshot = null,
    policyReport = null,
    jobsSnapshot = null,
}) {
    return domainDiagnostics.buildWarnFirstDiagnostics({
        source,
        policy: getGovernancePolicy(),
        board,
        handoffData,
        conflictAnalysis,
        metricsSnapshot,
        policyReport,
        jobsSnapshot,
        activeStatuses: ACTIVE_STATUSES,
    });
}

function attachDiagnostics(report, diagnostics) {
    return domainDiagnostics.attachDiagnostics(report, diagnostics);
}

function buildTaskCreateWarnDiagnostics(input = {}) {
    return domainDiagnostics.buildTaskCreateWarnDiagnostics({
        ...input,
        policy: getGovernancePolicy(),
    });
}

async function cmdStatus(args) {
    return statusCommandHandlers.handleStatusCommand({
        args,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        buildExecutorContribution,
        loadMetricsSnapshot,
        normalizeContributionBaseline,
        buildContributionTrend,
        buildDomainHealth,
        getHandoffLintErrors,
        buildCodexCheckReport,
        buildDomainHealthHistorySummary,
        loadDomainHealthHistory,
        getStatusCounts,
        getExecutorCounts,
        buildStatusRedExplanation,
        printJson: coreOutput.printJson,
        renderStatusText: domainStatus.renderStatusText,
        getContributionSignal,
        formatPpDelta,
        summarizeDiagnostics: domainDiagnostics.summarizeDiagnostics,
        buildWarnFirstDiagnostics,
        getGovernancePolicy,
        loadJobsSnapshot,
        summarizeJobsSnapshot,
    });
}

function safeNumber(value, fallback = 0) {
    return domainMetrics.safeNumber(value, fallback);
}

function loadMetricsSnapshotStrict() {
    return domainMetrics.loadMetricsSnapshotStrict({
        existsSync,
        readFileSync,
        metricsPath: METRICS_PATH,
    });
}

function baselineFromCurrentMetricsSnapshot(metrics) {
    return domainMetrics.baselineFromCurrentMetricsSnapshot(metrics);
}

function recalcMetricsDeltaWithBaseline(metrics) {
    return domainMetrics.recalcMetricsDeltaWithBaseline(metrics);
}

function writeMetricsSnapshotFile(metrics) {
    return domainMetrics.writeMetricsSnapshotFile(metrics, {
        mkdirSync,
        dirname,
        writeFileSync,
        metricsPath: METRICS_PATH,
    });
}

function cmdMetricsBaseline(args = []) {
    return metricsCommandHandlers.handleMetricsBaselineCommand({
        args,
        parseFlags,
        loadMetricsSnapshotStrict,
        normalizeContributionBaseline,
        baselineFromCurrentMetricsSnapshot,
        recalcMetricsDeltaWithBaseline,
        writeMetricsSnapshotFile,
    });
}

function cmdMetrics(args = []) {
    return metricsCommandHandlers.handleMetricsCommand({
        args,
        handleMetricsBaselineCommand:
            metricsCommandHandlers.handleMetricsBaselineCommand,
        loadMetricsSnapshotStrict,
        baselineFromCurrentMetricsSnapshot,
        recalcMetricsDeltaWithBaseline,
        writeMetricsSnapshotFile,
        parseFlags,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        buildExecutorContribution,
        buildDomainHealth,
        existsSync,
        readFileSync,
        METRICS_PATH,
        normalizeContributionBaseline,
        buildContributionTrend,
        loadContributionHistory,
        upsertContributionHistory,
        buildContributionHistorySummary,
        loadDomainHealthHistory,
        upsertDomainHealthHistory,
        buildDomainHealthHistorySummary,
        safeNumber,
        mkdirSync,
        dirname,
        writeFileSync,
        CONTRIBUTION_HISTORY_PATH,
        DOMAIN_HEALTH_HISTORY_PATH,
    });
}

function getHandoffLintErrors() {
    return domainHandoffs.getHandoffLintErrors(
        {
            board: parseBoard(),
            handoffData: parseHandoffs(),
        },
        {
            analyzeFileOverlap,
            normalizePathToken,
            isExpired,
            activeStatuses: ACTIVE_STATUSES,
        }
    );
}

function buildCodexCheckReport() {
    return domainCodexMirror.buildCodexCheckReport(
        {
            board: parseBoard(),
            blocks: parseCodexActiveBlocks(),
            handoffs: parseHandoffs().handoffs,
            codexPlanPath: CODEX_PLAN_PATH,
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired,
        }
    );
}

function cmdLeases(args) {
    return leasesCommandHandlers.handleLeasesCommand({
        args,
        parseFlags,
        parseBoard,
        ensureTask,
        currentDate,
        isoNow,
        writeBoardAndSync,
        toTaskJson,
        getGovernancePolicy,
        listBoardLeases: domainBoardLeases.listBoardLeases,
        renewTaskLease: domainBoardLeases.renewTaskLease,
        clearTaskLease: domainBoardLeases.clearTaskLease,
        normalizeBoardLeasesPolicy,
        parseExpectedBoardRevisionFlag,
        summarizeDiagnostics: domainDiagnostics.summarizeDiagnostics,
        makeDiagnostic: domainDiagnostics.makeDiagnostic,
        printJson: coreOutput.printJson,
    });
}

function cmdBoard(args) {
    return boardCommandHandlers.handleBoardCommand({
        args,
        parseFlags,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        getGovernancePolicy,
        buildBoardDoctorReport: domainBoardDoctor.buildBoardDoctorReport,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        loadMetricsSnapshot,
        summarizeDiagnostics: domainDiagnostics.summarizeDiagnostics,
        listBoardLeases: domainBoardLeases.listBoardLeases,
        getTaskLeaseSummary,
        makeDiagnostic: domainDiagnostics.makeDiagnostic,
        getWarnPolicyMap: domainDiagnostics.getWarnPolicyMap,
        warnPolicyEnabled: domainDiagnostics.warnPolicyEnabled,
        warnPolicySeverity: domainDiagnostics.warnPolicySeverity,
        isBroadGlobPath: domainDiagnostics.isBroadGlobPath,
        normalizeBoardLeasesPolicy,
        EVENTS_PATH: BOARD_EVENTS_PATH,
        tailBoardEvents: domainBoardEvents.tailBoardEvents,
        statsBoardEvents: domainBoardEvents.statsBoardEvents,
        readJsonlFile: coreIo.readJsonlFile,
        printJson: coreOutput.printJson,
        loadJobsSnapshot,
    });
}

async function cmdTask(args) {
    await taskCommandHandlers.handleTaskCommand({
        args,
        parseFlags,
        parseBoard,
        parseHandoffs,
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
        inferDomainLaneFromFiles,
        ensureTaskDualCodexDefaults,
        buildTaskCreateInferenceExplainLines,
        buildTaskCreateWarnDiagnostics,
        attachDiagnostics,
        getLastBoardWriteMeta,
        parseExpectedBoardRevisionFlag,
        buildBoardWipLimitDiagnostics,
        printJson: coreOutput.printJson,
    });
}

function renderRetiredQueueTombstone() {
    return (
        '# Retired Derived Queue\n\n' +
        'Este archivo queda preservado solo por compatibilidad historica.\n' +
        'Desde 2026-03-03 el orquestador opera en modo codex-only y ya no genera ni sincroniza esta cola.\n'
    );
}

function syncDerivedQueues(options = {}) {
    const { silent = false } = options;
    const tombstone = renderRetiredQueueTombstone();
    writeFileSync(JULES_PATH, tombstone, 'utf8');
    writeFileSync(KIMI_PATH, tombstone, 'utf8');
    if (!silent) {
        console.log(
            'Sync completado: colas derivadas retiradas, se preservan tombstones.'
        );
    }
    return {
        retired: true,
        jules_tasks: 0,
        kimi_tasks: 0,
    };
}

function cmdSync() {
    syncCommandHandlers.handleSyncCommand({
        syncDerivedQueues,
    });
}

async function cmdJobs(args) {
    return jobsCommandHandlers.handleJobsCommand({
        args,
        parseFlags,
        parseJobs,
        buildJobsSnapshot: loadJobsSnapshot,
        findJobSnapshot: domainJobs.findJobSnapshot,
        printJson: coreOutput.printJson,
    });
}

async function cmdPublish(args) {
    return publishCommandHandlers.handlePublishCommand({
        args,
        parseFlags,
        parseBoard,
        ensureTask,
        parseJobs,
        buildJobsSnapshot: loadJobsSnapshot,
        findJobSnapshot: domainJobs.findJobSnapshot,
        printJson: coreOutput.printJson,
        rootPath: ROOT,
        publishEventsPath: PUBLISH_EVENTS_PATH,
    });
}

function cmdClose(args) {
    closeCommandHandlers.handleCloseCommand({
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
    });
}

// â”€â”€â”€ Signal / Intake helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const githubSignalsRuntime = domainGitHubSignals.createGitHubSignalsRuntime({
    defaultRepository: DEFAULT_GITHUB_REPOSITORY,
    processObj: process,
    fetchImpl: typeof fetch === 'function' ? fetch : null,
});

function getGitHubToken(flags = {}) {
    return githubSignalsRuntime.getGitHubToken(flags);
}

function getGitHubRepository(flags = {}) {
    return githubSignalsRuntime.getGitHubRepository(flags);
}

async function fetchGitHubJson(path, token) {
    return githubSignalsRuntime.fetchGitHubJson(path, token);
}

async function collectGitHubSignals(flags = {}) {
    return githubSignalsRuntime.collectGitHubSignals(flags);
}

function isActiveSignalStatus(statusRaw) {
    const s = String(statusRaw || '')
        .toLowerCase()
        .trim();
    return s === 'open' || s === 'failing' || s === 'active';
}

function applySignalStateTransitions(mergedSignals, incomingSignals, nowIso) {
    const fps = new Set(
        (incomingSignals || [])
            .map((i) => String(i.fingerprint || '').trim())
            .filter(Boolean)
    );
    for (const signal of mergedSignals || []) {
        const fp = String(signal.fingerprint || '').trim();
        if (!fp || fps.has(fp)) continue;
        const src = String(signal.source || '').toLowerCase();
        if (src === 'workflow') {
            signal.status = 'resolved';
            signal.updated_at = nowIso;
        } else if (src === 'issue') {
            signal.status = 'closed';
            signal.updated_at = nowIso;
        }
    }
}

function normalizeTaskFilesForOverlap(files) {
    const next = new Set();
    for (const file of Array.isArray(files) ? files : []) {
        const normalized = String(file || '')
            .trim()
            .toLowerCase();
        if (!normalized) continue;
        next.add(normalized);
    }
    return next;
}

function hasFilesOverlap(leftFiles, rightFiles) {
    const left = normalizeTaskFilesForOverlap(leftFiles);
    const right = normalizeTaskFilesForOverlap(rightFiles);
    if (left.size === 0 || right.size === 0) return false;
    for (const file of left) {
        if (right.has(file)) return true;
    }
    return false;
}

function findActiveOverlapTask(tasks, suggestedTask) {
    const targetScope = String(suggestedTask?.scope || '')
        .trim()
        .toLowerCase();
    for (const task of Array.isArray(tasks) ? tasks : []) {
        if (isTerminalTaskStatus(task?.status)) continue;
        const scope = String(task?.scope || '')
            .trim()
            .toLowerCase();
        if (targetScope && scope !== targetScope) continue;
        if (!hasFilesOverlap(task?.files, suggestedTask?.files)) continue;
        return task;
    }
    return null;
}

function isCriticalTask(task) {
    return (
        Boolean(task?.critical_zone) ||
        String(task?.runtime_impact || '').toLowerCase() === 'high' ||
        String(task?.risk || '').toLowerCase() === 'high'
    );
}

function collapseWorkflowTasksCoveredByIssueTasks(tasks, nowIso) {
    const activeIssueTasks = (Array.isArray(tasks) ? tasks : []).filter(
        (task) =>
            !isTerminalTaskStatus(task?.status) &&
            String(task?.source_signal || '').toLowerCase() === 'issue' &&
            isCriticalTask(task)
    );
    let collapsed = 0;

    for (const task of Array.isArray(tasks) ? tasks : []) {
        if (isTerminalTaskStatus(task?.status)) continue;
        if (String(task?.source_signal || '').toLowerCase() !== 'workflow')
            continue;
        if (!isCriticalTask(task)) continue;

        const taskScope = String(task?.scope || '')
            .trim()
            .toLowerCase();
        const coveredByIssue = activeIssueTasks.find((issueTask) => {
            const issueScope = String(issueTask?.scope || '')
                .trim()
                .toLowerCase();
            if (taskScope && issueScope && taskScope !== issueScope) {
                return false;
            }
            return hasFilesOverlap(issueTask?.files, task?.files);
        });
        if (!coveredByIssue) continue;

        task.status = 'done';
        task.blocked_reason = '';
        task.updated_at = String(nowIso).slice(0, 10);
        task.evidence_ref = 'signal_deduped_to_issue:auto';
        if (!String(task.acceptance_ref || '').trim()) {
            task.acceptance_ref = task.evidence_ref;
        }
        collapsed += 1;
    }

    return collapsed;
}

function upsertTasksFromSignals(board, signals, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString());
    const owner = String(options.owner || detectDefaultOwner('orchestrator'));
    let created = 0;
    let reopened = 0;
    let refreshed = 0;
    const activeSignalRefs = new Set();

    for (const signal of signals || []) {
        if (!isActiveSignalStatus(signal.status)) continue;
        const sourceSignal = String(signal.source || 'manual').toLowerCase();
        const sourceRef = String(signal.source_ref || '').trim();
        if (!sourceRef) continue;
        activeSignalRefs.add(`${sourceSignal}:${sourceRef}`);
        const existing = board.tasks.find(
            (t) =>
                String(t.source_ref || '').trim() === sourceRef &&
                String(t.source_signal || 'manual').toLowerCase() ===
                    sourceSignal
        );
        const suggestedTask = domainIntake.buildTaskFromSignal(signal, {
            nowIso,
            owner,
        });
        if (!existing) {
            const overlapActiveTask = findActiveOverlapTask(
                board.tasks,
                suggestedTask
            );
            if (overlapActiveTask) {
                const overlapSourceSignal = String(
                    overlapActiveTask.source_signal || 'manual'
                ).toLowerCase();

                // Priorizamos señal de issue sobre workflow cuando ambos apuntan al mismo archivo activo.
                if (
                    sourceSignal === 'issue' &&
                    overlapSourceSignal === 'workflow'
                ) {
                    Object.assign(overlapActiveTask, {
                        ...suggestedTask,
                        id: overlapActiveTask.id,
                        status: 'ready',
                        acceptance_ref: '',
                        evidence_ref: '',
                        blocked_reason: '',
                        updated_at: String(nowIso).slice(0, 10),
                    });
                } else {
                    const overlapPriority = Number.parseInt(
                        String(overlapActiveTask.priority_score || '0'),
                        10
                    );
                    const suggestedPriority = Number.parseInt(
                        String(suggestedTask.priority_score || '0'),
                        10
                    );
                    overlapActiveTask.priority_score = Number.isFinite(
                        Math.max(overlapPriority, suggestedPriority)
                    )
                        ? Math.max(overlapPriority, suggestedPriority)
                        : overlapActiveTask.priority_score;

                    if (String(suggestedTask.sla_due_at || '').trim()) {
                        if (
                            !String(
                                overlapActiveTask.sla_due_at || ''
                            ).trim() ||
                            String(suggestedTask.sla_due_at) <
                                String(overlapActiveTask.sla_due_at)
                        ) {
                            overlapActiveTask.sla_due_at =
                                suggestedTask.sla_due_at;
                        }
                    }

                    if (suggestedTask.runtime_impact === 'high') {
                        overlapActiveTask.runtime_impact = 'high';
                    }
                    if (suggestedTask.critical_zone) {
                        overlapActiveTask.critical_zone = true;
                    }
                    if (
                        (overlapActiveTask.critical_zone ||
                            overlapActiveTask.runtime_impact === 'high' ||
                            findCriticalScopeKeyword(
                                overlapActiveTask.scope
                            )) &&
                        !['codex', 'claude'].includes(
                            String(
                                overlapActiveTask.executor || ''
                            ).toLowerCase()
                        )
                    ) {
                        overlapActiveTask.executor = 'codex';
                    }
                    overlapActiveTask.updated_at = String(nowIso).slice(0, 10);
                }
                refreshed += 1;
                continue;
            }
            board.tasks.push({
                ...suggestedTask,
                id: nextAgentTaskId(board.tasks),
            });
            created += 1;
            continue;
        }
        if (isTerminalTaskStatus(existing.status)) {
            existing.status = 'ready';
            existing.acceptance_ref = '';
            existing.evidence_ref = '';
            existing.blocked_reason = '';
            reopened += 1;
        } else {
            refreshed += 1;
        }
        Object.assign(existing, {
            title: suggestedTask.title,
            risk: suggestedTask.risk,
            scope: suggestedTask.scope,
            files: suggestedTask.files,
            priority_score: suggestedTask.priority_score,
            sla_due_at: suggestedTask.sla_due_at,
            runtime_impact: suggestedTask.runtime_impact,
            critical_zone: suggestedTask.critical_zone,
            source_signal: suggestedTask.source_signal,
            source_ref: suggestedTask.source_ref,
            prompt: suggestedTask.prompt,
            updated_at: String(nowIso).slice(0, 10),
        });
        if (
            (existing.critical_zone ||
                existing.runtime_impact === 'high' ||
                findCriticalScopeKeyword(existing.scope)) &&
            !['codex', 'claude'].includes(
                String(existing.executor || '').toLowerCase()
            )
        ) {
            existing.executor = 'codex';
        }
    }

    collapseWorkflowTasksCoveredByIssueTasks(board.tasks, nowIso);

    for (const task of board.tasks || []) {
        const sourceSignal = String(task.source_signal || '').toLowerCase();
        const sourceRef = String(task.source_ref || '').trim();
        if (
            !sourceSignal ||
            !sourceRef ||
            !['issue', 'workflow'].includes(sourceSignal)
        )
            continue;
        if (
            isTerminalTaskStatus(task.status) ||
            activeSignalRefs.has(`${sourceSignal}:${sourceRef}`)
        )
            continue;
        task.status = 'done';
        task.blocked_reason = '';
        task.updated_at = String(nowIso).slice(0, 10);
        task.evidence_ref = 'signal_resolved:auto';
        if (!String(task.acceptance_ref || '').trim())
            task.acceptance_ref = task.evidence_ref;
    }
    return { created, reopened, refreshed };
}

function buildStaleReport(board, signals) {
    const activeSignals = (signals || []).filter((s) =>
        isActiveSignalStatus(s.status)
    );
    const criticalSignals = activeSignals.filter((s) => Boolean(s.critical));
    const readyOrInProgress = (board.tasks || []).filter((t) => {
        const s = String(t.status || '').trim();
        return s === 'ready' || s === 'in_progress';
    });
    const invalidCriticalIdle =
        criticalSignals.length > 0 && readyOrInProgress.length === 0;
    return {
        version: 1,
        ok: !invalidCriticalIdle,
        counts: {
            active_signals: activeSignals.length,
            critical_active_signals: criticalSignals.length,
            active_tasks: (board.tasks || []).filter((t) =>
                ACTIVE_STATUSES.has(String(t.status || ''))
            ).length,
            ready_or_in_progress_tasks: readyOrInProgress.length,
        },
        invalid_reasons: invalidCriticalIdle
            ? ['critical_signals_without_ready_or_in_progress_tasks']
            : [],
        critical_signals: criticalSignals.slice(0, 10).map((s) => ({
            id: String(s.id || ''),
            source_ref: String(s.source_ref || ''),
            title: String(s.title || ''),
            severity: String(s.severity || ''),
            status: String(s.status || ''),
        })),
    };
}

// â”€â”€â”€ Rate-limit detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function hasRateLimitToken(valueRaw) {
    const v = String(valueRaw || '').toLowerCase();
    return (
        v.includes('429') ||
        v.includes('rate limit') ||
        v.includes('rate_limit') ||
        v.includes('too many requests')
    );
}

function detectKimiRateLimitActive({ board, signals }) {
    for (const signal of Array.isArray(signals) ? signals : []) {
        if (!isActiveSignalStatus(signal?.status)) continue;
        const title = String(signal?.title || '');
        const labelCorpus = Array.isArray(signal?.labels)
            ? signal.labels.map((l) => String(l)).join(' ')
            : '';
        if (hasRateLimitToken(title) || hasRateLimitToken(labelCorpus))
            return true;
        if (
            title.toLowerCase().includes('kimi') &&
            labelCorpus.toLowerCase().includes('workflow')
        )
            return true;
    }
    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        if (String(task?.executor || '').toLowerCase() !== 'kimi') continue;
        if (hasRateLimitToken(task?.blocked_reason)) return true;
    }
    return false;
}

// â”€â”€â”€ New commands: intake / score / stale / budget / dispatch / reconcile â”€â”€â”€â”€

const runtimeIntake = runtimeIntakeCommands.createRuntimeIntakeCommands({
    parseFlags,
    isFlagEnabled,
    parseBoard,
    parseSignals,
    getGitHubRepository,
    collectGitHubSignals,
    domainIntake,
    applySignalStateTransitions,
    upsertTasksFromSignals,
    detectDefaultOwner,
    writeSignals,
    writeBoardAndSync,
    buildStaleReport,
    printJson: coreOutput.printJson,
    processObj: process,
    currentDate,
    toTaskJson,
    findCriticalScopeKeyword,
    isTerminalTaskStatus,
    detectKimiRateLimitActive,
    getGitHubToken,
    fetchGitHubJson,
    attachDiagnostics,
    parseExpectedBoardRevisionFlag,
    buildBoardWipLimitDiagnostics,
});
const governanceRuntime =
    runtimeGovernanceCommands.createRuntimeGovernanceCommands({
        conflictsCommandHandlers,
        policyCommandHandlers,
        handoffsCommandHandlers,
        codexCommandHandlers,
        parseBoard,
        parseHandoffs,
        loadMetricsSnapshot,
        analyzeConflicts,
        toConflictJsonRecord,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        readGovernancePolicyStrict,
        validateGovernancePolicy,
        existsSync,
        governancePolicyPath: GOVERNANCE_POLICY_PATH,
        isExpired,
        getHandoffLintErrors,
        parseFlags,
        parseCsvList,
        ensureTask,
        ACTIVE_STATUSES,
        analyzeFileOverlap,
        normalizePathToken,
        nextHandoffId,
        isoNow,
        plusHoursIso,
        HANDOFFS_PATH,
        serializeHandoffs,
        writeFileSync,
        appendHandoffBoardEvent,
        parseExpectedBoardRevisionFlag,
        buildCodexCheckReport,
        loadJobsSnapshot,
        ALLOWED_STATUSES,
        currentDate,
        writeBoard,
        writeCodexActiveBlock,
        parseCodexActiveBlocks,
        buildBoardWipLimitDiagnostics,
    });

async function main() {
    const [command = 'status', ...args] = process.argv.slice(2);
    const commands = {
        status: () => cmdStatus(args),
        conflicts: () => governanceRuntime.conflicts(args),
        intake: () => runtimeIntake.intake(args),
        score: () => runtimeIntake.score(args),
        reconcile: () => runtimeIntake.reconcile(args),
        stale: () => runtimeIntake.stale(args),
        budget: () => runtimeIntake.budget(args),
        dispatch: () => runtimeIntake.dispatch(args),
        handoffs: () => governanceRuntime.handoffs(args),
        policy: () => governanceRuntime.policy(args),
        'codex-check': () => governanceRuntime.codexCheck(args),
        codex: () => governanceRuntime.codex(args),
        leases: () => cmdLeases(args),
        board: () => cmdBoard(args),
        task: () => cmdTask(args),
        jobs: () => cmdJobs(args),
        publish: () => cmdPublish(args),
        sync: () => cmdSync(),
        close: () => cmdClose(args),
        metrics: () => cmdMetrics(args),
    };

    if (!commands[command]) {
        throw new Error(`Comando no soportado: ${command}`);
    }
    await commands[command]();
}

main().catch((error) => {
    const argv = process.argv.slice(2);
    const wantsJson = argv.includes('--json');
    if (wantsJson) {
        const [command = 'status', subcommand = ''] = argv;
        const payload = {
            version: 1,
            ok: false,
            command:
                command === 'board' && subcommand
                    ? `${command} ${subcommand}`
                    : command,
            error: String(error && error.message ? error.message : error),
            error_code: error?.error_code || error?.code || 'command_failed',
        };
        if (
            ['task', 'handoffs', 'leases', 'codex'].includes(command) &&
            subcommand
        ) {
            payload.action = subcommand;
        }
        for (const key of [
            'expected_revision',
            'actual_revision',
            'task_id',
            'expected',
            'actual',
        ]) {
            if (Object.prototype.hasOwnProperty.call(error || {}, key)) {
                payload[key] = error[key];
            }
        }
        console.log(JSON.stringify(payload, null, 2));
        process.exit(1);
        return;
    }
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
});
