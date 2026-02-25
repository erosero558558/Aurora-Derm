#!/usr/bin/env node
/**
 * Agent Orchestrator
 *
 * Canonical source: AGENT_BOARD.yaml
 * Derived queues:   JULES_TASKS.md, KIMI_TASKS.md
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
const coreQueues = require('./tools/agent-orchestrator/core/queues');
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
const statusCommandHandlers = require('./tools/agent-orchestrator/commands/status');
const conflictsCommandHandlers = require('./tools/agent-orchestrator/commands/conflicts');
const policyCommandHandlers = require('./tools/agent-orchestrator/commands/policy');
const handoffsCommandHandlers = require('./tools/agent-orchestrator/commands/handoffs');
const codexCommandHandlers = require('./tools/agent-orchestrator/commands/codex');
const metricsCommandHandlers = require('./tools/agent-orchestrator/commands/metrics');
const syncCommandHandlers = require('./tools/agent-orchestrator/commands/sync');
const closeCommandHandlers = require('./tools/agent-orchestrator/commands/close');
const taskCommandHandlers = require('./tools/agent-orchestrator/commands/task');
const domainIntake = require('./tools/agent-orchestrator/domain/intake');
const runtimeGovernanceCommands = require('./tools/agent-orchestrator/commands/runtime-governance');
const runtimeIntakeCommands = require('./tools/agent-orchestrator/commands/runtime-intake');

const ROOT = __dirname;
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const HANDOFFS_PATH = resolve(ROOT, 'AGENT_HANDOFFS.yaml');
const SIGNALS_PATH = resolve(ROOT, 'AGENT_SIGNALS.yaml');
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
const CRITICAL_SCOPE_KEYWORDS = [
    'payments',
    'auth',
    'calendar',
    'deploy',
    'env',
    'security',
];
const CRITICAL_SCOPE_ALLOWED_EXECUTORS = new Set(['codex', 'claude']);
const TASK_CREATE_TEMPLATES = {
    docs: {
        executor: 'kimi',
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
    if (!existsSync(SIGNALS_PATH)) {
        return { version: 1, updated_at: currentDate(), signals: [] };
    }
    return coreParsers.parseSignalsContent(readFileSync(SIGNALS_PATH, 'utf8'));
}

function serializeSignals(data) {
    return coreSerializers.serializeSignals(data, { currentDate });
}

function writeSignals(data) {
    writeFileSync(SIGNALS_PATH, serializeSignals(data), 'utf8');
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

function writeBoard(board) {
    return coreIo.writeBoardFile(board, {
        currentDate,
        boardPath: BOARD_PATH,
        serializeBoard,
        writeFile: writeFileSync,
    });
}

function writeBoardAndSync(board, options = {}) {
    const { silentSync = false } = options;
    writeBoard(board);
    syncDerivedQueues({ silent: silentSync });
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

function upsertCodexActiveBlock(planRaw, block) {
    return domainCodexMirror.upsertCodexActiveBlock(planRaw, block, {
        buildComment: buildCodexActiveComment,
        anchorText: 'Relacion con Operativo 2026:',
    });
}

function writeCodexActiveBlock(block) {
    return coreIo.writeCodexActiveBlockFile(block, {
        codexPlanPath: CODEX_PLAN_PATH,
        exists: existsSync,
        readFile: readFileSync,
        writeFile: writeFileSync,
        upsertCodexActiveBlock,
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
}) {
    return domainDiagnostics.buildWarnFirstDiagnostics({
        source,
        policy: getGovernancePolicy(),
        board,
        handoffData,
        conflictAnalysis,
        metricsSnapshot,
        policyReport,
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

function cmdStatus(args) {
    statusCommandHandlers.handleStatusCommand({
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
            codexPlanPath: CODEX_PLAN_PATH,
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
        }
    );
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
        findCriticalScopeKeyword,
        CRITICAL_SCOPE_KEYWORDS,
        CRITICAL_SCOPE_ALLOWED_EXECUTORS,
        buildTaskCreateInferenceExplainLines,
        buildTaskCreateWarnDiagnostics,
        attachDiagnostics,
        printJson: coreOutput.printJson,
    });
}

function syncDerivedQueues(options = {}) {
    return coreIo.syncDerivedQueuesFiles(options, {
        parseBoard,
        parseTaskMetaMap: (path) =>
            coreQueues.parseTaskMetaMap(path, {
                exists: existsSync,
                readFile: readFileSync,
                normalize: normalizeEol,
            }),
        renderQueueFile: coreQueues.renderQueueFile,
        julesPath: JULES_PATH,
        kimiPath: KIMI_PATH,
        writeFile: writeFileSync,
        log: (msg) => console.log(msg),
    });
}

function cmdSync() {
    syncCommandHandlers.handleSyncCommand({
        syncDerivedQueues,
    });
}

function cmdClose(args) {
    closeCommandHandlers.handleCloseCommand({
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
    });
}

// â”€â”€â”€ Signal / Intake helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getGitHubToken(flags = {}) {
    return String(
        flags.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    ).trim();
}

function getGitHubRepository(flags = {}) {
    return String(flags.repo || DEFAULT_GITHUB_REPOSITORY).trim();
}

async function fetchGitHubJson(path, token) {
    if (!token)
        throw new Error(
            'GITHUB_TOKEN/GH_TOKEN requerido para consultar GitHub API'
        );
    const url = String(path || '').startsWith('http')
        ? String(path)
        : `https://api.github.com${path}`;
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'pielarmonia-agent-orchestrator',
        },
    });
    if (!response.ok)
        throw new Error(
            `GitHub API ${response.status}: ${await response.text()}`
        );
    return response.json();
}

function issueToSignal(issue) {
    const labels = Array.isArray(issue?.labels)
        ? issue.labels
              .map((l) =>
                  typeof l === 'string' ? l : l?.name ? String(l.name) : ''
              )
              .filter(Boolean)
        : [];
    return {
        source: 'issue',
        source_ref: `issue#${issue.number}`,
        title: String(issue.title || `Issue ${issue.number}`),
        status: String(issue.state || 'open').toLowerCase(),
        url: String(issue.html_url || issue.url || ''),
        labels,
        critical:
            String(issue.title || '')
                .toLowerCase()
                .includes('[alerta prod]') ||
            labels.some((l) =>
                ['prod-alert', 'critical', 'incident'].includes(
                    String(l).toLowerCase()
                )
            ),
        detected_at: String(issue.created_at || ''),
        updated_at: String(issue.updated_at || issue.created_at || ''),
    };
}

function runToSignal(run) {
    const workflowLabel = String(
        run?.workflow_name || run?.name || 'workflow'
    ).trim();
    const branch = String(run?.head_branch || 'main').trim();
    const workflowSlug = workflowLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const sourceRef = `workflow:${workflowSlug || 'workflow'}:${branch || 'main'}`;
    const critical =
        workflowLabel.toLowerCase().includes('post-deploy') ||
        workflowLabel.toLowerCase().includes('production monitor') ||
        workflowLabel.toLowerCase().includes('repair git sync');
    return {
        source: 'workflow',
        source_ref: sourceRef,
        fingerprint: sourceRef,
        title: `${workflowLabel}: ${String(run?.display_title || '').trim()}`.trim(),
        status:
            String(run.conclusion || '').toLowerCase() === 'failure'
                ? 'failing'
                : String(run.status || 'open').toLowerCase(),
        url: String(run.html_url || run.url || ''),
        labels: [`workflow:${workflowLabel}`],
        severity: critical ? 'high' : 'medium',
        critical,
        runtime_impact: critical ? 'high' : 'low',
        detected_at: String(run.created_at || ''),
        updated_at: String(run.updated_at || run.created_at || ''),
    };
}

async function collectGitHubSignals(flags = {}) {
    const token = getGitHubToken(flags);
    const repository = getGitHubRepository(flags);
    if (!token)
        return { repository, issues: [], workflows: [], source: 'local_only' };
    const [issuesPayload, runsPayload] = await Promise.all([
        fetchGitHubJson(
            `/repos/${repository}/issues?state=open&per_page=100`,
            token
        ),
        fetchGitHubJson(
            `/repos/${repository}/actions/runs?status=completed&per_page=50`,
            token
        ),
    ]);
    return {
        repository,
        source: 'github_api',
        issues: Array.isArray(issuesPayload)
            ? issuesPayload.filter((i) => !i.pull_request).map(issueToSignal)
            : [],
        workflows: Array.isArray(runsPayload?.workflow_runs)
            ? runsPayload.workflow_runs
                  .filter(
                      (r) =>
                          String(r?.conclusion || '').toLowerCase() ===
                          'failure'
                  )
                  .slice(0, 25)
                  .map(runToSignal)
            : [],
    };
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
});
const governanceRuntime =
    runtimeGovernanceCommands.createRuntimeGovernanceCommands({
        conflictsCommandHandlers,
        policyCommandHandlers,
        handoffsCommandHandlers,
        codexCommandHandlers,
        parseBoard,
        parseHandoffs,
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
        buildCodexCheckReport,
        ALLOWED_STATUSES,
        currentDate,
        writeBoard,
        writeCodexActiveBlock,
        parseCodexActiveBlocks,
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
        task: () => cmdTask(args),
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
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
});
