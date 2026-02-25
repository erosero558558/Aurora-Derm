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
const coreOutput = require('./tools/agent-orchestrator/core/output');
const domainConflicts = require('./tools/agent-orchestrator/domain/conflicts');
const domainTaskGuards = require('./tools/agent-orchestrator/domain/task-guards');
const domainTaskCreate = require('./tools/agent-orchestrator/domain/task-create');
const domainDiagnostics = require('./tools/agent-orchestrator/domain/diagnostics');
const domainMetrics = require('./tools/agent-orchestrator/domain/metrics');
const domainStatus = require('./tools/agent-orchestrator/domain/status');
const taskCommandHandlers = require('./tools/agent-orchestrator/commands/task');

const ROOT = __dirname;
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const HANDOFFS_PATH = resolve(ROOT, 'AGENT_HANDOFFS.yaml');
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
    board.policy = board.policy || {};
    board.policy.updated_at = currentDate();
    writeFileSync(BOARD_PATH, serializeBoard(board), 'utf8');
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
    if (flags.evidence) {
        return resolve(ROOT, String(flags.evidence));
    }
    return resolve(EVIDENCE_DIR, `${taskId}.md`);
}

function toRelativeRepoPath(path) {
    const normalizedRoot = ROOT.replace(/\\/g, '/');
    const normalizedPath = String(path).replace(/\\/g, '/');
    return normalizedPath.startsWith(`${normalizedRoot}/`)
        ? normalizedPath.slice(normalizedRoot.length + 1)
        : normalizedPath;
}

function toTaskJson(task) {
    return {
        id: String(task.id || ''),
        title: String(task.title || ''),
        owner: String(task.owner || ''),
        executor: String(task.executor || ''),
        status: String(task.status || ''),
        risk: String(task.risk || ''),
        scope: String(task.scope || ''),
        files: Array.isArray(task.files) ? task.files : [],
        acceptance_ref: String(task.acceptance_ref || ''),
        updated_at: String(task.updated_at || ''),
    };
}

function toTaskFullJson(task) {
    return {
        id: String(task.id || ''),
        title: String(task.title || ''),
        owner: String(task.owner || ''),
        executor: String(task.executor || ''),
        status: String(task.status || ''),
        risk: String(task.risk || ''),
        scope: String(task.scope || ''),
        files: Array.isArray(task.files) ? task.files : [],
        acceptance: String(task.acceptance || ''),
        acceptance_ref: String(task.acceptance_ref || ''),
        depends_on: Array.isArray(task.depends_on) ? task.depends_on : [],
        prompt: String(task.prompt || ''),
        created_at: String(task.created_at || ''),
        updated_at: String(task.updated_at || ''),
    };
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
    if (!block) return '';
    const lines = [];
    lines.push('<!-- CODEX_ACTIVE');
    lines.push(`block: ${block.block || 'C1'}`);
    lines.push(`task_id: ${block.task_id}`);
    lines.push(`status: ${block.status}`);
    lines.push(`files: ${serializeArrayInline(block.files || [])}`);
    lines.push(`updated_at: ${block.updated_at || currentDate()}`);
    lines.push('-->');
    return lines.join('\n');
}

function upsertCodexActiveBlock(planRaw, block) {
    const regex = /<!--\s*CODEX_ACTIVE\s*\n[\s\S]*?-->\s*/g;
    const withoutBlocks = String(planRaw || '').replace(regex, '');
    if (!block) {
        return withoutBlocks.replace(/\n{3,}/g, '\n\n');
    }

    const comment = `${buildCodexActiveComment(block)}\n\n`;
    const anchor = 'Relacion con Operativo 2026:';
    const anchorIndex = withoutBlocks.indexOf(anchor);
    if (anchorIndex === -1) {
        return `${comment}${withoutBlocks}`.replace(/\n{3,}/g, '\n\n');
    }
    const lineEnd = withoutBlocks.indexOf('\n', anchorIndex);
    if (lineEnd === -1) {
        return `${withoutBlocks}\n\n${comment}`.replace(/\n{3,}/g, '\n\n');
    }
    return (
        withoutBlocks.slice(0, lineEnd + 1) +
        '\n' +
        comment +
        withoutBlocks.slice(lineEnd + 1)
    ).replace(/\n{3,}/g, '\n\n');
}

function writeCodexActiveBlock(block) {
    if (!existsSync(CODEX_PLAN_PATH)) {
        throw new Error(`No existe ${CODEX_PLAN_PATH}`);
    }
    const raw = readFileSync(CODEX_PLAN_PATH, 'utf8');
    const next = upsertCodexActiveBlock(raw, block);
    writeFileSync(CODEX_PLAN_PATH, next, 'utf8');
}

function nextHandoffId(handoffs) {
    let max = 0;
    for (const handoff of handoffs || []) {
        const match = String(handoff.id || '').match(/^HO-(\d+)$/);
        if (!match) continue;
        max = Math.max(max, Number(match[1]));
    }
    return `HO-${String(max + 1).padStart(3, '0')}`;
}

function nextAgentTaskId(tasks) {
    let max = 0;
    for (const task of tasks || []) {
        const match = String(task?.id || '').match(/^AG-(\d+)$/);
        if (!match) continue;
        max = Math.max(max, Number(match[1]));
    }
    return `AG-${String(max + 1).padStart(3, '0')}`;
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

function parseTaskMetaMap(path) {
    if (!existsSync(path)) return new Map();
    const raw = normalizeEol(readFileSync(path, 'utf8'));
    const regex = /<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/g;
    const map = new Map();
    let match;

    while ((match = regex.exec(raw)) !== null) {
        const meta = {};
        for (const line of match[1].split('\n')) {
            const m = line.match(/^([\w-]+):\s*(.*)$/);
            if (m) meta[m[1]] = m[2].trim();
        }

        const id = meta.task_id;
        if (id) map.set(id, meta);
    }

    return map;
}

function boardToQueueStatus(taskStatus, executor) {
    if (taskStatus === 'done') return 'done';
    if (taskStatus === 'failed' || taskStatus === 'blocked') return 'failed';
    if (taskStatus === 'in_progress' || taskStatus === 'review') {
        return executor === 'jules' ? 'dispatched' : 'running';
    }
    return 'pending';
}

function renderQueueFile(executor, tasks, existingMeta) {
    const header =
        executor === 'jules'
            ? '# JULES_TASKS.md — Cola derivada desde AGENT_BOARD.yaml'
            : '# KIMI_TASKS.md — Cola derivada desde AGENT_BOARD.yaml';
    const runnerHint =
        executor === 'jules'
            ? 'JULES_API_KEY=xxx node jules-dispatch.js dispatch'
            : 'node kimi-run.js --dispatch';
    const validStatuses =
        executor === 'jules'
            ? 'pending | dispatched | done | failed'
            : 'pending | running | done | failed';

    const lines = [];
    lines.push(header);
    lines.push('');
    lines.push('> Archivo generado por `node agent-orchestrator.js sync`.');
    lines.push('> No editar manualmente; los cambios se sobrescriben.');
    lines.push(`> Ejecutar cola: \`${runnerHint}\``);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Formato de tarea');
    lines.push('');
    lines.push('```');
    lines.push('<!-- TASK');
    lines.push(`status: ${validStatuses}`);
    lines.push('task_id: AG-XXX');
    lines.push('risk: low|medium|high');
    lines.push('scope: docs|frontend|backend|platform|security|ops');
    lines.push('files: path1,path2');
    lines.push('acceptance_ref: verification/agent-runs/AG-XXX.md');
    lines.push('dispatched_by: agent-orchestrator');
    if (executor === 'jules') {
        lines.push('session:');
        lines.push('dispatched:');
    }
    lines.push('-->');
    lines.push('### Titulo');
    lines.push('');
    lines.push('Prompt...');
    lines.push('');
    lines.push('<!-- /TASK -->');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Tareas');
    lines.push('');

    for (const task of tasks) {
        const meta = existingMeta.get(task.id) || {};
        const queueStatus = boardToQueueStatus(task.status, executor);
        const files = Array.isArray(task.files) ? task.files.join(',') : '';
        const acceptanceRef =
            task.acceptance_ref || `verification/agent-runs/${task.id}.md`;

        lines.push('<!-- TASK');
        lines.push(`status: ${queueStatus}`);
        lines.push(`task_id: ${task.id}`);
        lines.push(`risk: ${task.risk || 'medium'}`);
        lines.push(`scope: ${task.scope || 'general'}`);
        lines.push(`files: ${files}`);
        lines.push(`acceptance_ref: ${acceptanceRef}`);
        lines.push('dispatched_by: agent-orchestrator');
        if (executor === 'jules') {
            lines.push(`session: ${meta.session || ''}`);
            lines.push(`dispatched: ${meta.dispatched || ''}`);
        }
        lines.push('-->');
        lines.push(`### ${task.title}`);
        lines.push('');
        lines.push(task.prompt || task.title);
        lines.push('');
        lines.push('<!-- /TASK -->');
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
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

function cmdStatus(args) {
    const wantsJson = args.includes('--json');
    const wantsExplainRed = args.includes('--explain-red');
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const conflictAnalysis = analyzeConflicts(
        board.tasks,
        handoffData.handoffs
    );
    const contribution = buildExecutorContribution(board.tasks);
    const metricsSnapshot = loadMetricsSnapshot();
    const contributionBaseline = normalizeContributionBaseline(metricsSnapshot);
    const contributionTrend = buildContributionTrend(
        contribution,
        contributionBaseline
    );
    const domainHealth = buildDomainHealth(
        board.tasks,
        conflictAnalysis,
        handoffData.handoffs
    );
    const handoffLintErrors = wantsExplainRed ? getHandoffLintErrors() : [];
    const codexCheckReport = wantsExplainRed ? buildCodexCheckReport() : null;
    const domainHealthHistory = wantsExplainRed
        ? buildDomainHealthHistorySummary(loadDomainHealthHistory(), 7)
        : null;
    const data = domainStatus.buildStatusReport({
        board,
        conflictAnalysis,
        contribution,
        contributionTrend,
        domainHealth,
        byStatus: getStatusCounts(board.tasks),
        byExecutor: getExecutorCounts(board.tasks),
    });

    if (wantsExplainRed) {
        data.red_explanation = buildStatusRedExplanation({
            conflictAnalysis,
            handoffData,
            handoffLintErrors,
            codexCheckReport,
            domainHealth,
            domainHealthHistory,
        });
    }

    Object.assign(
        data,
        domainDiagnostics.summarizeDiagnostics(
            buildWarnFirstDiagnostics({
                source: 'status',
                board,
                handoffData,
                conflictAnalysis,
                metricsSnapshot,
            })
        )
    );

    if (wantsJson) {
        coreOutput.printJson(data);
        return;
    }
    process.stdout.write(
        domainStatus.renderStatusText(data, {
            wantsExplainRed,
            getContributionSignal,
            formatPpDelta,
        })
    );
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function loadMetricsSnapshotStrict() {
    if (!existsSync(METRICS_PATH)) {
        throw new Error(
            `No existe ${METRICS_PATH}. Ejecuta \`node agent-orchestrator.js metrics\` primero.`
        );
    }
    try {
        return JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
    } catch (error) {
        throw new Error(
            `No se pudo parsear ${METRICS_PATH}: ${error.message || error}`
        );
    }
}

function baselineFromCurrentMetricsSnapshot(metrics) {
    const current = metrics?.current || {};
    const baseline = {
        tasks_total: safeNumber(current.tasks_total, 0),
        tasks_with_rework: safeNumber(current.tasks_with_rework, 0),
        file_conflicts: safeNumber(current.file_conflicts, 0),
        file_conflicts_handoff: safeNumber(current.file_conflicts_handoff, 0),
        non_critical_lead_time_hours_avg:
            current.non_critical_lead_time_hours_avg === null
                ? null
                : safeNumber(current.non_critical_lead_time_hours_avg, 0),
        coordination_gate_red_rate_pct:
            current.coordination_gate_red_rate_pct === null
                ? null
                : safeNumber(current.coordination_gate_red_rate_pct, 0),
        traceability_pct: safeNumber(current.traceability_pct, 0),
    };

    const contribution =
        metrics?.contribution && Array.isArray(metrics?.contribution?.executors)
            ? metrics.contribution
            : null;

    return {
        baseline,
        baseline_contribution: contribution,
    };
}

function recalcMetricsDeltaWithBaseline(metrics) {
    const next = { ...(metrics || {}) };
    const current = next.current || {};
    const baseline = next.baseline || {};
    const contribution = next.contribution || null;
    const baselineContribution = normalizeContributionBaseline(next);

    next.delta = {
        tasks_total:
            safeNumber(current.tasks_total, 0) -
            safeNumber(baseline.tasks_total, 0),
        file_conflicts:
            safeNumber(current.file_conflicts, 0) -
            safeNumber(baseline.file_conflicts, 0),
        file_conflicts_handoff:
            safeNumber(current.file_conflicts_handoff, 0) -
            safeNumber(baseline.file_conflicts_handoff, 0),
        traceability_pct:
            safeNumber(current.traceability_pct, 0) -
            safeNumber(baseline.traceability_pct, 0),
    };

    if (
        contribution &&
        Array.isArray(contribution.executors) &&
        baselineContribution &&
        Array.isArray(baselineContribution.executors)
    ) {
        next.contribution_delta = buildContributionTrend(
            contribution,
            baselineContribution
        );
    }

    return next;
}

function writeMetricsSnapshotFile(metrics) {
    mkdirSync(dirname(METRICS_PATH), { recursive: true });
    writeFileSync(
        METRICS_PATH,
        `${JSON.stringify(metrics, null, 4)}\n`,
        'utf8'
    );
}

function cmdMetricsBaseline(args = []) {
    const { positionals, flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const subcommand = String(positionals[0] || '').trim() || 'show';

    if (!['show', 'set', 'reset'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js metrics baseline <show|set|reset> [--from current] [--json]'
        );
    }

    if (subcommand === 'show') {
        const metrics = loadMetricsSnapshotStrict();
        const report = {
            version: 1,
            ok: true,
            action: 'show',
            metrics_path: 'verification/agent-metrics.json',
            baseline: metrics.baseline || null,
            baseline_contribution: normalizeContributionBaseline(metrics),
            baseline_meta: metrics.baseline_meta || null,
        };
        if (wantsJson) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log('Metrics baseline (agent-metrics.json):');
        console.log(`- tasks_total: ${report.baseline?.tasks_total ?? 'n/a'}`);
        console.log(
            `- file_conflicts: ${report.baseline?.file_conflicts ?? 'n/a'}`
        );
        console.log(
            `- file_conflicts_handoff: ${report.baseline?.file_conflicts_handoff ?? 'n/a'}`
        );
        console.log(
            `- traceability_pct: ${report.baseline?.traceability_pct ?? 'n/a'}`
        );
        console.log(
            `- baseline_meta: ${
                report.baseline_meta
                    ? `${report.baseline_meta.source || 'n/a'} @ ${report.baseline_meta.updated_at || 'n/a'}`
                    : 'n/a'
            }`
        );
        return;
    }

    let source = String(flags.from || 'current').trim() || 'current';
    source = source.toLowerCase();
    if (source !== 'current') {
        throw new Error(
            `metrics baseline ${subcommand}: --from invalido (${source}). Use current`
        );
    }

    const metrics = loadMetricsSnapshotStrict();
    const next = { ...metrics };
    const normalized = baselineFromCurrentMetricsSnapshot(metrics);
    next.baseline = normalized.baseline;
    if (normalized.baseline_contribution) {
        next.baseline_contribution = normalized.baseline_contribution;
    }
    next.baseline_meta = {
        source: 'current',
        action: subcommand,
        updated_at: new Date().toISOString(),
    };

    const finalMetrics = recalcMetricsDeltaWithBaseline(next);
    writeMetricsSnapshotFile(finalMetrics);

    const report = {
        version: 1,
        ok: true,
        action: subcommand,
        source: 'current',
        metrics_path: 'verification/agent-metrics.json',
        baseline: finalMetrics.baseline,
        baseline_contribution: normalizeContributionBaseline(finalMetrics),
        baseline_meta: finalMetrics.baseline_meta || null,
        delta: finalMetrics.delta || null,
    };

    if (wantsJson) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log(
        `Metrics baseline ${subcommand} OK (source=current) en verification/agent-metrics.json`
    );
}

function cmdMetrics(args = []) {
    if (String(args[0] || '').trim() === 'baseline') {
        cmdMetricsBaseline(args.slice(1));
        return;
    }
    const { flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const profile = String(flags.profile || '')
        .trim()
        .toLowerCase();
    const hasNoWriteFlag = args.includes('--no-write');
    const hasWriteFlag = args.includes('--write');
    const hasDryRunFlag = args.includes('--dry-run');

    if (profile && !['local', 'ci'].includes(profile)) {
        throw new Error(
            `metrics: --profile invalido (${profile}). Use local|ci`
        );
    }
    if (hasNoWriteFlag && hasWriteFlag) {
        throw new Error(
            'metrics: no usar --write y --no-write al mismo tiempo'
        );
    }
    if (hasDryRunFlag && hasWriteFlag) {
        throw new Error('metrics: --dry-run no se puede combinar con --write');
    }

    let noWrite = false;
    if (profile === 'local') noWrite = true;
    if (profile === 'ci') noWrite = false;
    if (hasNoWriteFlag) noWrite = true;
    if (hasWriteFlag) noWrite = false;
    if (hasDryRunFlag) noWrite = true;
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const conflictAnalysis = analyzeConflicts(
        board.tasks,
        handoffData.handoffs
    );
    const blockingConflicts = conflictAnalysis.blocking.length;
    const handoffConflicts = conflictAnalysis.handoffCovered.length;
    const total = board.tasks.length;
    const done = board.tasks.filter((task) => task.status === 'done').length;
    const inProgress = board.tasks.filter(
        (task) => task.status === 'in_progress'
    ).length;
    const contribution = buildExecutorContribution(board.tasks);
    const domainHealth = buildDomainHealth(
        board.tasks,
        conflictAnalysis,
        handoffData.handoffs
    );

    let existing = null;
    if (existsSync(METRICS_PATH)) {
        try {
            existing = JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
        } catch {
            existing = null;
        }
    }

    const baselineContribution =
        normalizeContributionBaseline(existing) || contribution;
    const contributionDelta = buildContributionTrend(
        contribution,
        baselineContribution
    );
    const existingHistory = loadContributionHistory();
    const nextContributionHistory = upsertContributionHistory(
        existingHistory,
        contribution
    );
    const contributionHistorySummary = buildContributionHistorySummary(
        nextContributionHistory,
        7
    );
    const existingDomainHistory = loadDomainHealthHistory();
    const nextDomainHealthHistory = upsertDomainHealthHistory(
        existingDomainHistory,
        domainHealth
    );
    const domainHealthHistorySummary = buildDomainHealthHistorySummary(
        nextDomainHealthHistory,
        7
    );

    const baseline =
        existing && existing.baseline
            ? existing.baseline
            : {
                  tasks_total: total,
                  tasks_with_rework: 0,
                  file_conflicts: blockingConflicts,
                  file_conflicts_handoff: handoffConflicts,
                  non_critical_lead_time_hours_avg: null,
                  coordination_gate_red_rate_pct: null,
                  traceability_pct: 0,
              };

    const traceability =
        total === 0
            ? 100
            : Math.round(
                  (board.tasks.filter(
                      (task) => String(task.acceptance_ref || '').trim() !== ''
                  ).length /
                      total) *
                      100
              );

    const outputFiles = [
        'verification/agent-metrics.json',
        'verification/agent-contribution-history.json',
        'verification/agent-domain-health-history.json',
    ];

    const metrics = {
        version: 1,
        period: {
            timezone: 'America/Guayaquil',
            window_days: 7,
            updated_at: new Date().toISOString(),
        },
        targets:
            existing && existing.targets
                ? existing.targets
                : {
                      rework_reduction_pct: 40,
                      file_conflict_rate_pct_max: 5,
                      non_critical_lead_time_hours_max: 24,
                      coordination_gate_red_rate_pct_max: 10,
                      traceability_pct: 100,
                  },
        baseline: {
            tasks_total: safeNumber(baseline.tasks_total, total),
            tasks_with_rework: safeNumber(baseline.tasks_with_rework, 0),
            file_conflicts: safeNumber(
                baseline.file_conflicts,
                blockingConflicts
            ),
            file_conflicts_handoff: safeNumber(
                baseline.file_conflicts_handoff,
                handoffConflicts
            ),
            non_critical_lead_time_hours_avg:
                baseline.non_critical_lead_time_hours_avg === null
                    ? null
                    : safeNumber(baseline.non_critical_lead_time_hours_avg, 0),
            coordination_gate_red_rate_pct:
                baseline.coordination_gate_red_rate_pct === null
                    ? null
                    : safeNumber(baseline.coordination_gate_red_rate_pct, 0),
            traceability_pct: safeNumber(baseline.traceability_pct, 0),
        },
        current: {
            tasks_total: total,
            tasks_in_progress: inProgress,
            tasks_done: done,
            tasks_with_rework: 0,
            file_conflicts: blockingConflicts,
            file_conflicts_handoff: handoffConflicts,
            non_critical_lead_time_hours_avg: null,
            coordination_gate_red_rate_pct: null,
            traceability_pct: traceability,
        },
        contribution,
        baseline_contribution: baselineContribution,
        contribution_delta: contributionDelta,
        contribution_history: contributionHistorySummary,
        domain_health: domainHealth,
        domain_health_history: domainHealthHistorySummary,
        io: {
            profile: profile || 'default',
            no_write: noWrite,
            dry_run: hasDryRunFlag,
            write_mode: hasDryRunFlag
                ? 'dry-run'
                : noWrite
                  ? 'no-write'
                  : 'write',
            persisted: !noWrite && !hasDryRunFlag,
            output_files: outputFiles,
        },
        delta: {
            tasks_total: total - safeNumber(baseline.tasks_total, total),
            file_conflicts:
                blockingConflicts -
                safeNumber(baseline.file_conflicts, blockingConflicts),
            file_conflicts_handoff:
                handoffConflicts -
                safeNumber(baseline.file_conflicts_handoff, handoffConflicts),
            traceability_pct:
                traceability -
                safeNumber(baseline.traceability_pct, traceability),
        },
    };

    if (!noWrite) {
        mkdirSync(dirname(METRICS_PATH), { recursive: true });
        writeFileSync(
            METRICS_PATH,
            `${JSON.stringify(metrics, null, 4)}\n`,
            'utf8'
        );
        writeFileSync(
            CONTRIBUTION_HISTORY_PATH,
            `${JSON.stringify(nextContributionHistory, null, 4)}\n`,
            'utf8'
        );
        writeFileSync(
            DOMAIN_HEALTH_HISTORY_PATH,
            `${JSON.stringify(nextDomainHealthHistory, null, 4)}\n`,
            'utf8'
        );
    }
    if (wantsJson) {
        console.log(JSON.stringify(metrics, null, 2));
        return;
    }
    if (hasDryRunFlag) {
        console.log(
            `Metricas calculadas (dry-run, profile=${profile || 'default'}).`
        );
        console.log('Archivos de salida (preview):');
        for (const file of outputFiles) {
            console.log(`- ${file}`);
        }
        return;
    }
    if (noWrite) {
        console.log(
            `Metricas calculadas (no-write, profile=${profile || 'default'}).`
        );
        return;
    }
    console.log(
        `Metricas actualizadas en ${METRICS_PATH} (profile=${profile || 'default'})`
    );
}

function cmdConflicts(args) {
    const strict = args.includes('--strict');
    const wantsJson = args.includes('--json');
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const analysis = analyzeConflicts(board.tasks, handoffData.handoffs);

    const report = {
        version: 1,
        strict,
        totals: {
            pairs: analysis.all.length,
            blocking: analysis.blocking.length,
            handoff: analysis.handoffCovered.length,
        },
        conflicts: analysis.all.map(toConflictJsonRecord),
    };
    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'conflicts',
            board,
            handoffData,
            conflictAnalysis: analysis,
        })
    );

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (strict && analysis.blocking.length > 0) {
            process.exitCode = 1;
        }
        return;
    }

    if (analysis.all.length === 0) {
        console.log('Sin conflictos de archivos entre tareas activas.');
        return;
    }

    console.log(`Conflictos detectados (total pares): ${analysis.all.length}`);
    console.log(`- Blocking: ${analysis.blocking.length}`);
    console.log(`- Eximidos por handoff: ${analysis.handoffCovered.length}`);

    for (const item of analysis.all) {
        const kind = item.exempted_by_handoff ? 'HANDOFF' : 'BLOCKING';
        const overlapFiles = item.overlap_files.length
            ? item.overlap_files.join(', ')
            : '(solo wildcard ambiguo)';
        console.log(
            `- [${kind}] ${item.left.id} (${item.left.executor}) <-> ${item.right.id} (${item.right.executor}) :: ${overlapFiles}`
        );
        if (item.handoff_ids.length > 0) {
            console.log(`  handoffs: ${item.handoff_ids.join(', ')}`);
        }
        if (item.ambiguous_wildcard_overlap) {
            console.log(
                '  note: wildcard overlap ambiguo, no eximible automaticamente'
            );
        }
    }

    if (strict && analysis.blocking.length > 0) {
        process.exitCode = 1;
    }
}

function cmdPolicy(args = []) {
    const subcommand = String(args[0] || '').trim() || 'lint';
    const wantsJson = args.includes('--json');

    if (subcommand !== 'lint') {
        throw new Error('Uso: node agent-orchestrator.js policy lint [--json]');
    }

    let rawPolicy;
    let report;
    try {
        rawPolicy = readGovernancePolicyStrict();
        report = validateGovernancePolicy(rawPolicy);
    } catch (error) {
        report = {
            version: 1,
            ok: false,
            error_count: 1,
            warning_count: 0,
            errors: [String(error.message || error)],
            warnings: [],
            effective: null,
            source: {
                path: 'governance-policy.json',
                exists: existsSync(GOVERNANCE_POLICY_PATH),
            },
        };
    }

    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'policy',
            policyReport: report,
        })
    );

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (!report.ok) process.exitCode = 1;
        return reportWithDiagnostics;
    }

    if (!report.ok) {
        throw new Error(
            `Governance policy invalida:\n- ${report.errors.join('\n- ')}`
        );
    }

    console.log('OK: governance-policy.json valido.');
    if (report.warning_count > 0) {
        for (const warning of report.warnings) {
            console.log(`WARN: ${warning}`);
        }
    }
    return report;
}

function getHandoffLintErrors() {
    const errors = [];
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const handoffs = Array.isArray(handoffData.handoffs)
        ? handoffData.handoffs
        : [];
    const byId = new Map(board.tasks.map((task) => [String(task.id), task]));
    const seenHandoffIds = new Set();

    if (String(handoffData.version) !== '1') {
        errors.push(
            `AGENT_HANDOFFS.yaml version invalida: ${handoffData.version}`
        );
    }

    for (const handoff of handoffs) {
        const id = String(handoff.id || '').trim();
        if (!id) {
            errors.push('handoff sin id');
            continue;
        }
        if (!/^HO-\d+$/.test(id)) {
            errors.push(`${id}: formato de id invalido (esperado HO-###)`);
        }
        if (seenHandoffIds.has(id)) {
            errors.push(`${id}: id duplicado`);
        }
        seenHandoffIds.add(id);

        const status = String(handoff.status || '').toLowerCase();
        if (!['active', 'closed'].includes(status)) {
            errors.push(`${id}: status invalido (${status || 'vacio'})`);
        }

        const fromTaskId = String(handoff.from_task || '');
        const toTaskId = String(handoff.to_task || '');
        const fromTask = byId.get(fromTaskId);
        const toTask = byId.get(toTaskId);
        if (!fromTask)
            errors.push(
                `${id}: from_task inexistente (${fromTaskId || 'vacio'})`
            );
        if (!toTask)
            errors.push(`${id}: to_task inexistente (${toTaskId || 'vacio'})`);
        if (fromTaskId && toTaskId && fromTaskId === toTaskId) {
            errors.push(`${id}: from_task y to_task no pueden ser iguales`);
        }

        const files = Array.isArray(handoff.files) ? handoff.files : [];
        if (files.length === 0) {
            errors.push(`${id}: files debe contener al menos un path`);
        }
        for (const rawFile of files) {
            const file = String(rawFile || '').trim();
            if (!file) {
                errors.push(`${id}: files contiene path vacio`);
                continue;
            }
            if (file.includes('*')) {
                errors.push(`${id}: handoff no permite wildcards (${file})`);
            }
            if (file === '/' || file === '.' || file === './') {
                errors.push(`${id}: handoff demasiado amplio (${file})`);
            }
        }

        const createdMs = Date.parse(String(handoff.created_at || ''));
        const expiresMs = Date.parse(String(handoff.expires_at || ''));
        if (!Number.isFinite(createdMs)) {
            errors.push(`${id}: created_at invalido`);
        }
        if (!Number.isFinite(expiresMs)) {
            errors.push(`${id}: expires_at invalido`);
        }
        if (Number.isFinite(createdMs) && Number.isFinite(expiresMs)) {
            if (expiresMs <= createdMs) {
                errors.push(`${id}: expires_at debe ser mayor que created_at`);
            }
            const hours = (expiresMs - createdMs) / (1000 * 60 * 60);
            if (hours > 48) {
                errors.push(`${id}: TTL excede 48h (${hours.toFixed(1)}h)`);
            }
        }

        if (status === 'active') {
            if (isExpired(handoff.expires_at)) {
                errors.push(`${id}: handoff activo pero expirado`);
            }
            if (fromTask && !ACTIVE_STATUSES.has(fromTask.status)) {
                errors.push(
                    `${id}: from_task no esta activo (${fromTask.id}:${fromTask.status})`
                );
            }
            if (toTask && !ACTIVE_STATUSES.has(toTask.status)) {
                errors.push(
                    `${id}: to_task no esta activo (${toTask.id}:${toTask.status})`
                );
            }
        }

        if (fromTask && toTask && files.length > 0) {
            const overlap = analyzeFileOverlap(fromTask.files, toTask.files);
            const overlapSet = new Set(overlap.overlapFiles);
            for (const rawFile of files) {
                const file = normalizePathToken(rawFile);
                if (file && !overlapSet.has(file)) {
                    errors.push(
                        `${id}: file ${rawFile} no pertenece al solape concreto entre ${fromTask.id} y ${toTask.id}`
                    );
                }
            }
        }
    }

    return errors;
}

function cmdHandoffs(args) {
    const firstArg = String(args[0] || '');
    const subcommand =
        !firstArg || firstArg.startsWith('--') ? 'status' : firstArg;
    const wantsJson = args.includes('--json');
    const handoffData = parseHandoffs();

    if (subcommand === 'status') {
        const total = handoffData.handoffs.length;
        const active = handoffData.handoffs.filter(
            (item) => String(item.status) === 'active'
        );
        const closed = handoffData.handoffs.filter(
            (item) => String(item.status) === 'closed'
        );
        const expiredActive = active.filter((item) =>
            isExpired(item.expires_at)
        );
        const report = {
            version: 1,
            summary: {
                total,
                active: active.length,
                closed: closed.length,
                active_expired: expiredActive.length,
            },
            handoffs: handoffData.handoffs,
        };
        const reportWithDiagnostics = attachDiagnostics(
            report,
            buildWarnFirstDiagnostics({
                source: 'handoffs.status',
                handoffData,
            })
        );
        if (wantsJson) {
            console.log(JSON.stringify(reportWithDiagnostics, null, 2));
            return;
        }
        console.log('== Agent Handoffs ==');
        console.log(`Total: ${total}`);
        console.log(`Active: ${active.length}`);
        console.log(`Closed: ${closed.length}`);
        console.log(`Active expirados: ${expiredActive.length}`);
        return;
    }

    if (subcommand === 'lint') {
        const errors = getHandoffLintErrors();
        const report = {
            version: 1,
            ok: errors.length === 0,
            error_count: errors.length,
            errors,
        };
        const reportWithDiagnostics = attachDiagnostics(
            report,
            buildWarnFirstDiagnostics({
                source: 'handoffs.lint',
                handoffData,
            })
        );
        if (wantsJson) {
            console.log(JSON.stringify(reportWithDiagnostics, null, 2));
            if (errors.length > 0) {
                process.exitCode = 1;
            }
            return;
        }
        if (errors.length === 0) {
            console.log('OK: handoffs validos.');
            return;
        }
        console.log(`Errores de handoff: ${errors.length}`);
        for (const error of errors) console.log(`- ${error}`);
        process.exitCode = 1;
        return;
    }

    if (subcommand === 'create') {
        const { flags } = parseFlags(args.slice(1));
        const board = parseBoard();
        const handoffs = parseHandoffs();

        const fromTaskId = String(flags.from || flags.from_task || '').trim();
        const toTaskId = String(flags.to || flags.to_task || '').trim();
        const reason = String(flags.reason || '').trim();
        const approvedBy = String(
            flags['approved-by'] || flags.approved_by || ''
        ).trim();
        const files = parseCsvList(flags.files || '');
        const ttlHours = Number(flags['ttl-hours'] || flags.ttl_hours || 24);

        if (!fromTaskId || !toTaskId) {
            throw new Error(
                'Uso: node agent-orchestrator.js handoffs create --from AG-001 --to CDX-001 --files path1,path2 --reason motivo --approved-by ernesto [--ttl-hours 24]'
            );
        }
        if (!reason) {
            throw new Error('handoffs create requiere --reason');
        }
        if (!approvedBy) {
            throw new Error('handoffs create requiere --approved-by');
        }
        if (files.length === 0) {
            throw new Error('handoffs create requiere --files con lista CSV');
        }
        if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 48) {
            throw new Error('--ttl-hours debe estar en rango 1..48');
        }

        const fromTask = ensureTask(board, fromTaskId);
        const toTask = ensureTask(board, toTaskId);
        if (
            !ACTIVE_STATUSES.has(fromTask.status) ||
            !ACTIVE_STATUSES.has(toTask.status)
        ) {
            throw new Error(
                `Ambas tareas deben estar activas (from=${fromTask.status}, to=${toTask.status})`
            );
        }

        const overlap = analyzeFileOverlap(fromTask.files, toTask.files);
        if (!overlap.anyOverlap) {
            throw new Error(
                `No hay solape de archivos entre ${fromTaskId} y ${toTaskId}`
            );
        }
        if (overlap.ambiguousWildcardOverlap) {
            throw new Error(
                'No se puede crear handoff automatico con overlap ambiguo por wildcards; usa files concretos'
            );
        }
        const overlapSet = new Set(overlap.overlapFiles);
        const normalizedFiles = files.map(normalizePathToken);
        for (let i = 0; i < normalizedFiles.length; i++) {
            if (!overlapSet.has(normalizedFiles[i])) {
                throw new Error(
                    `File fuera del solape real: ${files[i]} (solape: ${overlap.overlapFiles.join(', ') || 'ninguno'})`
                );
            }
        }

        const handoff = {
            id: nextHandoffId(handoffs.handoffs),
            status: 'active',
            from_task: fromTaskId,
            to_task: toTaskId,
            reason,
            files,
            approved_by: approvedBy,
            created_at: isoNow(),
            expires_at: plusHoursIso(ttlHours),
        };

        handoffs.handoffs.push(handoff);
        writeFileSync(HANDOFFS_PATH, serializeHandoffs(handoffs), 'utf8');

        const errors = getHandoffLintErrors();
        if (errors.length > 0) {
            throw new Error(
                `Handoff creado pero invalido:\n- ${errors.join('\n- ')}`
            );
        }

        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        action: 'create',
                        handoff,
                    },
                    null,
                    2
                )
            );
            return;
        }

        console.log(`Handoff creado: ${handoff.id}`);
        console.log(
            `${handoff.from_task} -> ${handoff.to_task} :: ${handoff.files.join(', ')} (expira ${handoff.expires_at})`
        );
        return;
    }

    if (subcommand === 'close') {
        const { positionals, flags } = parseFlags(args.slice(1));
        const handoffId = String(positionals[0] || flags.id || '').trim();
        const closeReason = String(flags.reason || 'closed_manual').trim();
        if (!handoffId) {
            throw new Error(
                'Uso: node agent-orchestrator.js handoffs close <HO-001> [--reason motivo]'
            );
        }
        const handoffs = parseHandoffs();
        const handoff = handoffs.handoffs.find(
            (item) => String(item.id) === handoffId
        );
        if (!handoff) {
            throw new Error(`No existe handoff ${handoffId}`);
        }
        handoff.status = 'closed';
        handoff.closed_at = isoNow();
        handoff.close_reason = closeReason;
        writeFileSync(HANDOFFS_PATH, serializeHandoffs(handoffs), 'utf8');
        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        action: 'close',
                        handoff,
                    },
                    null,
                    2
                )
            );
            return;
        }
        console.log(`Handoff cerrado: ${handoffId}`);
        return;
    }

    throw new Error(
        'Uso: node agent-orchestrator.js handoffs <status|lint|create|close>'
    );
}

function buildCodexCheckReport() {
    const board = parseBoard();
    const blocks = parseCodexActiveBlocks();
    const errors = [];
    const codexTasks = board.tasks.filter((task) =>
        /^CDX-\d+$/.test(String(task.id || ''))
    );
    const codexInProgress = codexTasks.filter(
        (task) => task.status === 'in_progress'
    );
    const activeCodexTasks = codexTasks.filter((task) =>
        ACTIVE_STATUSES.has(task.status)
    );

    if (codexInProgress.length > 1) {
        errors.push(
            `Mas de un CDX in_progress (${codexInProgress.map((t) => t.id).join(', ')})`
        );
    }

    if (blocks.length > 1) {
        errors.push(`Mas de un bloque CODEX_ACTIVE en ${CODEX_PLAN_PATH}`);
    }

    if (blocks.length === 0) {
        if (activeCodexTasks.length > 0) {
            errors.push(
                `Hay tareas CDX activas sin bloque CODEX_ACTIVE: ${activeCodexTasks
                    .map((task) => task.id)
                    .join(', ')}`
            );
        }
    } else {
        const block = blocks[0];
        const taskId = String(block.task_id || '').trim();
        const blockStatus = String(block.status || '').trim();
        const blockFiles = Array.isArray(block.files)
            ? block.files.map(normalizePathToken)
            : [];
        const task = board.tasks.find((item) => String(item.id) === taskId);

        if (!taskId) {
            errors.push('CODEX_ACTIVE.task_id vacio');
        }
        if (!/^CDX-\d+$/.test(taskId)) {
            errors.push(`CODEX_ACTIVE.task_id invalido (${taskId || 'vacio'})`);
        }
        if (!task) {
            errors.push(
                `CODEX_ACTIVE.task_id no existe en board: ${taskId || 'vacio'}`
            );
        } else {
            if (String(task.executor) !== 'codex') {
                errors.push(
                    `${task.id}: executor debe ser codex (actual: ${task.executor})`
                );
            }
            if (blockStatus !== String(task.status)) {
                errors.push(
                    `${task.id}: status desalineado plan(${blockStatus || 'vacio'}) != board(${task.status})`
                );
            }
            const boardFiles = new Set(
                (task.files || []).map(normalizePathToken)
            );
            for (const file of blockFiles) {
                if (!boardFiles.has(file)) {
                    errors.push(
                        `${task.id}: file del bloque CODEX_ACTIVE no reservado en board (${file})`
                    );
                }
            }
        }

        if (activeCodexTasks.length === 0 && ACTIVE_STATUSES.has(blockStatus)) {
            errors.push(
                'CODEX_ACTIVE indica tarea activa pero no hay CDX activo en board'
            );
        }
    }

    const activeBlock = blocks[0] || null;
    const activeBlockTaskId = activeBlock
        ? String(activeBlock.task_id || '').trim()
        : '';
    const activeBlockTask = activeBlockTaskId
        ? board.tasks.find((item) => String(item.id) === activeBlockTaskId) ||
          null
        : null;

    return {
        version: 1,
        ok: errors.length === 0,
        error_count: errors.length,
        errors,
        summary: {
            codex_tasks_total: codexTasks.length,
            codex_in_progress: codexInProgress.length,
            codex_active: activeCodexTasks.length,
            plan_blocks: blocks.length,
        },
        codex_task_ids: codexTasks.map((task) => String(task.id)),
        codex_in_progress_ids: codexInProgress.map((task) => String(task.id)),
        codex_active_ids: activeCodexTasks.map((task) => String(task.id)),
        plan_block: activeBlock
            ? {
                  block: String(activeBlock.block || ''),
                  task_id: String(activeBlock.task_id || ''),
                  status: String(activeBlock.status || ''),
                  files: Array.isArray(activeBlock.files)
                      ? activeBlock.files
                      : [],
                  updated_at: String(activeBlock.updated_at || ''),
              }
            : null,
        board_task_for_plan_block: activeBlockTask
            ? {
                  id: String(activeBlockTask.id || ''),
                  executor: String(activeBlockTask.executor || ''),
                  status: String(activeBlockTask.status || ''),
                  files: Array.isArray(activeBlockTask.files)
                      ? activeBlockTask.files
                      : [],
              }
            : null,
    };
}

function cmdCodexCheck(args = []) {
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

function cmdCodex(args) {
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
        cmdCodexCheck([]);
        console.log(`Codex start OK: ${taskId} (${block})`);
        return;
    }

    if (subcommand === 'stop') {
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
        cmdCodexCheck([]);
        console.log(`Codex stop OK: ${taskId} -> ${nextStatus}`);
    }
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
        printJson: coreOutput.printJson,
    });
}

function syncDerivedQueues(options = {}) {
    const { silent = false } = options;
    const board = parseBoard();
    const julesMeta = parseTaskMetaMap(JULES_PATH);
    const kimiMeta = parseTaskMetaMap(KIMI_PATH);

    const julesTasks = board.tasks.filter((task) => task.executor === 'jules');
    const kimiTasks = board.tasks.filter((task) => task.executor === 'kimi');

    const julesContent = renderQueueFile('jules', julesTasks, julesMeta);
    const kimiContent = renderQueueFile('kimi', kimiTasks, kimiMeta);

    writeFileSync(JULES_PATH, julesContent, 'utf8');
    writeFileSync(KIMI_PATH, kimiContent, 'utf8');

    if (!silent) {
        console.log(
            `Sync completado: ${julesTasks.length} tareas Jules, ${kimiTasks.length} tareas Kimi.`
        );
    }
}

function cmdSync() {
    syncDerivedQueues({ silent: false });
}

function cmdClose(args) {
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

async function main() {
    const [command = 'status', ...args] = process.argv.slice(2);
    const commands = {
        status: () => cmdStatus(args),
        conflicts: () => cmdConflicts(args),
        handoffs: () => cmdHandoffs(args),
        policy: () => cmdPolicy(args),
        'codex-check': () => cmdCodexCheck(args),
        codex: () => cmdCodex(args),
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
