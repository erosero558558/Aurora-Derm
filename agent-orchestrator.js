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
 *   node agent-orchestrator.js intake [--strict] [--json]
 *   node agent-orchestrator.js score [--json]
 *   node agent-orchestrator.js reconcile [--json] [--pr-number 123]
 *   node agent-orchestrator.js stale [--strict] [--json]
 *   node agent-orchestrator.js budget [--json] [--agent jules|kimi|codex]
 *   node agent-orchestrator.js dispatch --agent jules|kimi|codex [--json]
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
const { spawnSync } = require('child_process');
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
const domainIntake = require('./tools/agent-orchestrator/domain/intake');
const taskCommandHandlers = require('./tools/agent-orchestrator/commands/task');

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
const DEFAULT_GITHUB_REPOSITORY =
    process.env.AGENT_GITHUB_REPOSITORY ||
    process.env.GITHUB_REPOSITORY ||
    'erosero558558/piel-en-armonia';
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

function parseSignals() {
    if (!existsSync(SIGNALS_PATH)) {
        return { version: 1, updated_at: currentDate(), signals: [] };
    }
    return coreParsers.parseSignalsContent(readFileSync(SIGNALS_PATH, 'utf8'));
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

function serializeSignals(data) {
    return coreSerializers.serializeSignals(data, {
        currentDate,
    });
}

function parseFlags(args) {
    return coreFlags.parseFlags(args);
}

function writeSignals(data) {
    writeFileSync(SIGNALS_PATH, serializeSignals(data), 'utf8');
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
        source_signal: String(task.source_signal || 'manual'),
        source_ref: String(task.source_ref || ''),
        priority_score: Number(task.priority_score || 0),
        sla_due_at: String(task.sla_due_at || ''),
        attempts: Number(task.attempts || 0),
        blocked_reason: String(task.blocked_reason || ''),
        runtime_impact: String(task.runtime_impact || 'low'),
        critical_zone: Boolean(task.critical_zone),
        acceptance_ref: String(task.acceptance_ref || ''),
        evidence_ref: String(task.evidence_ref || ''),
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
        source_signal: String(task.source_signal || 'manual'),
        source_ref: String(task.source_ref || ''),
        priority_score: Number(task.priority_score || 0),
        sla_due_at: String(task.sla_due_at || ''),
        last_attempt_at: String(task.last_attempt_at || ''),
        attempts: Number(task.attempts || 0),
        blocked_reason: String(task.blocked_reason || ''),
        runtime_impact: String(task.runtime_impact || 'low'),
        critical_zone: Boolean(task.critical_zone),
        acceptance: String(task.acceptance || ''),
        acceptance_ref: String(task.acceptance_ref || ''),
        evidence_ref: String(task.evidence_ref || ''),
        depends_on: Array.isArray(task.depends_on) ? task.depends_on : [],
        prompt: String(task.prompt || ''),
        created_at: String(task.created_at || ''),
        updated_at: String(task.updated_at || ''),
    };
}

function isTerminalTaskStatus(statusRaw) {
    const status = String(statusRaw || '')
        .trim()
        .toLowerCase();
    return status === 'done' || status === 'failed';
}

function isActiveSignalStatus(statusRaw) {
    const status = String(statusRaw || '')
        .trim()
        .toLowerCase();
    return ['open', 'failing', 'active'].includes(status);
}

function getGitHubToken(flags = {}) {
    return String(
        flags.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
    ).trim();
}

function getGitHubRepository(flags = {}) {
    return String(flags.repo || DEFAULT_GITHUB_REPOSITORY).trim();
}

async function fetchGitHubJson(path, token) {
    if (!token) {
        throw new Error('GITHUB_TOKEN/GH_TOKEN requerido para consultar GitHub API');
    }
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
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GitHub API ${response.status}: ${text}`);
    }
    return response.json();
}

function issueToSignal(issue) {
    const labels = Array.isArray(issue?.labels)
        ? issue.labels
              .map((item) =>
                  typeof item === 'string'
                      ? item
                      : item?.name
                        ? String(item.name)
                        : ''
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
            String(issue.title || '').toLowerCase().includes('[alerta prod]') ||
            labels.some((item) =>
                ['prod-alert', 'critical', 'incident'].includes(
                    String(item).toLowerCase()
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
    const branch = String(run?.head_branch || run?.headBranch || 'main').trim();
    const workflowSlug = workflowLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const sourceRef = `workflow:${workflowSlug || 'workflow'}:${branch || 'main'}`;
    const title = `${workflowLabel}: ${String(run?.display_title || '').trim()}`.trim();
    const severity =
        workflowLabel.toLowerCase().includes('post-deploy') ||
        workflowLabel.toLowerCase().includes('production monitor')
            ? 'high'
            : 'medium';
    const critical =
        workflowLabel.toLowerCase().includes('post-deploy') ||
        workflowLabel.toLowerCase().includes('production monitor') ||
        workflowLabel.toLowerCase().includes('repair git sync');
    return {
        source: 'workflow',
        source_ref: sourceRef,
        fingerprint: sourceRef,
        title,
        status:
            String(run.conclusion || '').toLowerCase() === 'failure'
                ? 'failing'
                : String(run.status || 'open').toLowerCase(),
        url: String(run.html_url || run.url || ''),
        labels: [`workflow:${workflowLabel}`],
        severity,
        critical,
        runtime_impact: critical ? 'high' : 'low',
        detected_at: String(run.created_at || ''),
        updated_at: String(run.updated_at || run.created_at || ''),
    };
}

async function collectGitHubSignals(flags = {}) {
    const token = getGitHubToken(flags);
    const repository = getGitHubRepository(flags);
    if (!token) {
        return { repository, issues: [], workflows: [], source: 'local_only' };
    }

    const [issuesPayload, runsPayload] = await Promise.all([
        fetchGitHubJson(`/repos/${repository}/issues?state=open&per_page=100`, token),
        fetchGitHubJson(
            `/repos/${repository}/actions/runs?status=completed&per_page=50`,
            token
        ),
    ]);

    const issues = Array.isArray(issuesPayload)
        ? issuesPayload
              .filter((item) => !item.pull_request)
              .map(issueToSignal)
        : [];
    const workflows = Array.isArray(runsPayload?.workflow_runs)
        ? runsPayload.workflow_runs
              .filter(
                  (item) =>
                      String(item?.conclusion || '').toLowerCase() === 'failure'
              )
              .slice(0, 25)
              .map(runToSignal)
        : [];

    return {
        repository,
        source: 'github_api',
        issues,
        workflows,
    };
}

function applySignalStateTransitions(mergedSignals, incomingSignals, nowIso) {
    const incomingFingerprints = new Set(
        (incomingSignals || [])
            .map((item) => String(item.fingerprint || '').trim())
            .filter(Boolean)
    );
    for (const signal of mergedSignals || []) {
        const fingerprint = String(signal.fingerprint || '').trim();
        if (!fingerprint || incomingFingerprints.has(fingerprint)) {
            continue;
        }
        const source = String(signal.source || '').toLowerCase();
        if (source === 'workflow') {
            signal.status = 'resolved';
            signal.updated_at = nowIso;
        } else if (source === 'issue') {
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
            (task) =>
                String(task.source_ref || '').trim() === sourceRef &&
                String(task.source_signal || 'manual').toLowerCase() === sourceSignal
        );
        const suggestedTask = domainIntake.buildTaskFromSignal(signal, {
            nowIso,
            owner,
        });

        if (!existing) {
            const createdTask = { ...suggestedTask, id: nextAgentTaskId(board.tasks) };
            board.tasks.push(createdTask);
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

        existing.title = suggestedTask.title;
        existing.risk = suggestedTask.risk;
        existing.scope = suggestedTask.scope;
        existing.files = suggestedTask.files;
        existing.priority_score = suggestedTask.priority_score;
        existing.sla_due_at = suggestedTask.sla_due_at;
        existing.runtime_impact = suggestedTask.runtime_impact;
        existing.critical_zone = suggestedTask.critical_zone;
        existing.source_signal = suggestedTask.source_signal;
        existing.source_ref = suggestedTask.source_ref;
        existing.prompt = suggestedTask.prompt;
        existing.updated_at = String(nowIso).slice(0, 10);
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
        if (!sourceSignal || !sourceRef) continue;
        if (!['issue', 'workflow'].includes(sourceSignal)) continue;
        if (isTerminalTaskStatus(task.status)) continue;
        const key = `${sourceSignal}:${sourceRef}`;
        if (activeSignalRefs.has(key)) continue;

        task.status = 'done';
        task.blocked_reason = '';
        task.updated_at = String(nowIso).slice(0, 10);
        task.evidence_ref = 'signal_resolved:auto';
        if (!String(task.acceptance_ref || '').trim()) {
            task.acceptance_ref = task.evidence_ref;
        }
    }

    return { created, reopened, refreshed };
}

function buildStaleReport(board, signals) {
    const activeSignals = (signals || []).filter((item) =>
        isActiveSignalStatus(item.status)
    );
    const criticalSignals = activeSignals.filter((item) => Boolean(item.critical));
    const activeTasks = (board.tasks || []).filter((task) =>
        ACTIVE_STATUSES.has(String(task.status || '').trim())
    );
    const readyOrInProgress = activeTasks.filter((task) => {
        const status = String(task.status || '').trim();
        return status === 'ready' || status === 'in_progress';
    });
    const invalidCriticalIdle =
        criticalSignals.length > 0 && readyOrInProgress.length === 0;
    return {
        version: 1,
        ok: !invalidCriticalIdle,
        counts: {
            active_signals: activeSignals.length,
            critical_active_signals: criticalSignals.length,
            active_tasks: activeTasks.length,
            ready_or_in_progress_tasks: readyOrInProgress.length,
        },
        invalid_reasons: invalidCriticalIdle
            ? ['critical_signals_without_ready_or_in_progress_tasks']
            : [],
        critical_signals: criticalSignals.slice(0, 10).map((item) => ({
            id: String(item.id || ''),
            source_ref: String(item.source_ref || ''),
            title: String(item.title || ''),
            severity: String(item.severity || ''),
            status: String(item.status || ''),
        })),
    };
}

function runScriptCommand(scriptPath, args = [], options = {}) {
    const env = { ...process.env, ...(options.env || {}) };
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: ROOT,
        env,
        encoding: 'utf8',
    });
    if (options.captureOutput) {
        return result;
    }
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result;
}

function applyQueueStateToBoard(board, queueMetaMap, queueKind, nowDate) {
    let changed = 0;
    let doneWithEvidence = 0;
    for (const task of board.tasks || []) {
        if (String(task.executor || '') !== queueKind) continue;
        const meta = queueMetaMap.get(String(task.id || ''));
        if (!meta) continue;
        const queueStatus = String(meta.status || '').toLowerCase();
        let nextStatus = String(task.status || '');

        if (queueKind === 'jules') {
            if (queueStatus === 'dispatched') nextStatus = 'in_progress';
            else if (queueStatus === 'done') nextStatus = 'done';
            else if (queueStatus === 'failed') nextStatus = 'failed';
        } else if (queueKind === 'kimi') {
            if (queueStatus === 'running') nextStatus = 'in_progress';
            else if (queueStatus === 'done') nextStatus = 'done';
            else if (queueStatus === 'failed') nextStatus = 'failed';
        }

        if (nextStatus !== String(task.status || '')) {
            task.status = nextStatus;
            task.updated_at = nowDate;
            changed += 1;
        }
        if (nextStatus === 'done' && !String(task.evidence_ref || '').trim()) {
            task.evidence_ref = `queue:${queueKind}`;
            if (!String(task.acceptance_ref || '').trim()) {
                task.acceptance_ref = task.evidence_ref;
            }
            doneWithEvidence += 1;
        }
    }
    return { changed, doneWithEvidence };
}

function extractTaskIdsFromText(value) {
    const text = String(value || '');
    const matches = text.match(/\b(?:AG|CDX)-\d+\b/g);
    return Array.from(new Set(matches || []));
}

async function collectMergedPullRequestEvidence(flags = {}) {
    const token = getGitHubToken(flags);
    if (!token) return [];
    const repository = getGitHubRepository(flags);
    const requestedPr = String(flags['pr-number'] || flags.pr || '').trim();

    let pulls = [];
    if (requestedPr) {
        const pull = await fetchGitHubJson(
            `/repos/${repository}/pulls/${requestedPr}`,
            token
        );
        pulls = [pull];
    } else {
        const payload = await fetchGitHubJson(
            `/repos/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=40`,
            token
        );
        pulls = Array.isArray(payload) ? payload : [];
    }

    return pulls
        .filter((pr) => Boolean(pr?.merged_at))
        .map((pr) => {
            const taskIds = extractTaskIdsFromText(
                `${String(pr.title || '')}\n${String(pr.body || '')}`
            );
            return {
                number: Number(pr.number),
                merged_at: String(pr.merged_at || ''),
                url: String(pr.html_url || ''),
                task_ids: taskIds,
            };
        })
        .filter((item) => item.task_ids.length > 0);
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

function hasRateLimitToken(valueRaw) {
    const value = String(valueRaw || '').toLowerCase();
    return (
        value.includes('429') ||
        value.includes('rate limit') ||
        value.includes('rate_limit') ||
        value.includes('too many requests')
    );
}

function detectKimiRateLimitActive({ board, signals, date }) {
    const signalList = Array.isArray(signals) ? signals : [];
    for (const signal of signalList) {
        if (!isActiveSignalStatus(signal?.status)) continue;
        const title = String(signal?.title || '');
        const labelCorpus = Array.isArray(signal?.labels)
            ? signal.labels.map((item) => String(item)).join(' ')
            : '';
        if (
            hasRateLimitToken(title) ||
            hasRateLimitToken(labelCorpus)
        ) {
            return true;
        }
        if (
            title.toLowerCase().includes('kimi') &&
            labelCorpus.toLowerCase().includes('workflow')
        ) {
            return true;
        }
    }

    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    for (const task of tasks) {
        if (String(task?.executor || '').toLowerCase() !== 'kimi') continue;
        const lastAttemptAt = String(task?.last_attempt_at || '');
        if (date && !lastAttemptAt.startsWith(date)) continue;
        if (hasRateLimitToken(task?.blocked_reason)) {
            return true;
        }
    }

    return false;
}

function buildBudgetSnapshot({ board, signals, date }) {
    const today = String(date || currentDate());
    const baseLimits = {
        jules: Number.parseInt(process.env.JULES_DAILY_LIMIT || '80', 10),
        kimi: Number.parseInt(process.env.KIMI_DAILY_LIMIT || '180', 10),
        codex: Number.parseInt(process.env.CODEX_DAILY_LIMIT || '999', 10),
    };

    const kimiRateLimited = detectKimiRateLimitActive({
        board,
        signals,
        date: today,
    });
    const effectiveLimits = {
        ...baseLimits,
        kimi: kimiRateLimited ? Math.min(baseLimits.kimi, 120) : baseLimits.kimi,
    };

    const usage = { jules: 0, kimi: 0, codex: 0 };
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    for (const task of tasks) {
        const lastAttemptAt = String(task?.last_attempt_at || '');
        const executor = String(task?.executor || '').toLowerCase();
        if (!lastAttemptAt.startsWith(today)) continue;
        if (!Object.prototype.hasOwnProperty.call(usage, executor)) continue;
        const attempts = Number.parseInt(String(task?.attempts || '0'), 10);
        usage[executor] += Number.isFinite(attempts) && attempts > 0 ? attempts : 0;
    }

    const remaining = {
        jules: effectiveLimits.jules - usage.jules,
        kimi: effectiveLimits.kimi - usage.kimi,
        codex: effectiveLimits.codex - usage.codex,
    };
    const exceeded = Object.keys(remaining).filter(
        (agent) => remaining[agent] < 0
    );

    return {
        date: today,
        limits: effectiveLimits,
        limits_base: baseLimits,
        usage,
        remaining,
        exceeded,
        kimi_rate_limited: kimiRateLimited,
    };
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
    const scope = normalizePathToken(task?.scope || '');
    const files = Array.isArray(task?.files)
        ? task.files.map((item) => normalizePathToken(item))
        : [];
    const corpus = [scope, ...files].join(' ');

    if (
        corpus.includes('calendar') ||
        corpus.includes('availability') ||
        corpus.includes('booked-slots')
    ) {
        return 'calendar';
    }
    if (
        corpus.includes('chat') ||
        corpus.includes('figo') ||
        corpus.includes('telegram')
    ) {
        return 'chat';
    }
    if (
        corpus.includes('payment') ||
        corpus.includes('payments') ||
        corpus.includes('stripe')
    ) {
        return 'payments';
    }

    if (scope) {
        const first = scope.split(/[/:]/)[0].trim();
        if (first) return first;
    }
    return 'other';
}

function buildDomainHealth(tasks, conflictAnalysis, handoffs = []) {
    const governancePolicy = getGovernancePolicy();
    const domainHealthPolicy = governancePolicy?.domain_health || {};
    const priorityDomains = Array.isArray(domainHealthPolicy.priority_domains)
        ? domainHealthPolicy.priority_domains.map((d) => String(d))
        : DEFAULT_PRIORITY_DOMAINS.slice();
    const domainWeights = shallowMerge(
        DEFAULT_DOMAIN_HEALTH_WEIGHTS,
        domainHealthPolicy.domain_weights || {}
    );
    const signalScores = shallowMerge(
        DEFAULT_DOMAIN_SIGNAL_SCORES,
        domainHealthPolicy.signal_scores || {}
    );
    const domainMap = new Map();
    const taskById = new Map();

    function ensureDomain(domain) {
        const key = String(domain || 'other').trim() || 'other';
        if (!domainMap.has(key)) {
            domainMap.set(key, {
                domain: key,
                tasks_total: 0,
                active_tasks: 0,
                done_tasks: 0,
                blocked_tasks: 0,
                failed_tasks: 0,
                ready_tasks: 0,
                review_tasks: 0,
                in_progress_tasks: 0,
                blocking_conflicts: 0,
                handoff_conflicts: 0,
                active_expired_handoffs: 0,
                reasons: [],
                signal: 'GREEN',
            });
        }
        return domainMap.get(key);
    }

    for (const domain of priorityDomains) {
        ensureDomain(domain);
    }

    for (const task of tasks || []) {
        const domain = inferTaskDomain(task);
        const row = ensureDomain(domain);
        const status = String(task.status || '');

        row.tasks_total += 1;
        if (ACTIVE_STATUSES.has(status)) row.active_tasks += 1;
        if (status === 'done') row.done_tasks += 1;
        if (status === 'blocked') row.blocked_tasks += 1;
        if (status === 'failed') row.failed_tasks += 1;
        if (status === 'ready') row.ready_tasks += 1;
        if (status === 'review') row.review_tasks += 1;
        if (status === 'in_progress') row.in_progress_tasks += 1;

        taskById.set(String(task.id || ''), { task, domain });
    }

    for (const conflict of conflictAnalysis?.all || []) {
        const leftDomain = inferTaskDomain(conflict.left);
        const rightDomain = inferTaskDomain(conflict.right);
        const domains = new Set([leftDomain, rightDomain]);
        for (const domain of domains) {
            const row = ensureDomain(domain);
            if (conflict.exempted_by_handoff) {
                row.handoff_conflicts += 1;
            } else {
                row.blocking_conflicts += 1;
            }
        }
    }

    for (const handoff of handoffs || []) {
        if (String(handoff.status || '').toLowerCase() !== 'active') continue;
        if (!isExpired(handoff.expires_at)) continue;

        const from = taskById.get(String(handoff.from_task || ''));
        const to = taskById.get(String(handoff.to_task || ''));
        const domains = new Set([
            from?.domain || 'other',
            to?.domain || 'other',
        ]);
        for (const domain of domains) {
            ensureDomain(domain).active_expired_handoffs += 1;
        }
    }

    const rows = Array.from(domainMap.values()).map((row) => {
        const reasons = [];
        let signal = 'GREEN';

        if (row.blocking_conflicts > 0) {
            signal = 'RED';
            reasons.push(`blocking_conflicts:${row.blocking_conflicts}`);
        }
        if (row.failed_tasks > 0) {
            signal = 'RED';
            reasons.push(`failed_tasks:${row.failed_tasks}`);
        }
        if (row.blocked_tasks > 0 && signal !== 'RED') {
            signal = 'YELLOW';
            reasons.push(`blocked_tasks:${row.blocked_tasks}`);
        } else if (row.blocked_tasks > 0) {
            reasons.push(`blocked_tasks:${row.blocked_tasks}`);
        }
        if (row.active_expired_handoffs > 0 && signal !== 'RED') {
            signal = 'YELLOW';
            reasons.push(
                `active_expired_handoffs:${row.active_expired_handoffs}`
            );
        } else if (row.active_expired_handoffs > 0) {
            reasons.push(
                `active_expired_handoffs:${row.active_expired_handoffs}`
            );
        }
        if (row.handoff_conflicts > 0 && signal === 'GREEN') {
            signal = 'YELLOW';
            reasons.push(`handoff_conflicts:${row.handoff_conflicts}`);
        } else if (row.handoff_conflicts > 0) {
            reasons.push(`handoff_conflicts:${row.handoff_conflicts}`);
        }
        if (signal === 'GREEN' && row.active_tasks > 0 && row.tasks_total > 0) {
            signal = 'YELLOW';
            reasons.push(`active_tasks:${row.active_tasks}`);
        }
        if (row.tasks_total === 0) {
            reasons.push('no_tasks');
        }
        if (reasons.length === 0) {
            reasons.push('stable');
        }

        return {
            ...row,
            weight: domainWeights[row.domain] ?? domainWeights.default,
            signal_score_pct: 0,
            weighted_score_points: 0,
            signal,
            reasons,
        };
    });

    for (const row of rows) {
        row.signal_score_pct = signalScores[row.signal] ?? signalScores.GREEN;
        row.weighted_score_points = Math.round(
            row.signal_score_pct * row.weight
        );
    }

    const priorityIndex = new Map(priorityDomains.map((d, i) => [d, i]));
    rows.sort((a, b) => {
        const aPri = priorityIndex.has(a.domain)
            ? priorityIndex.get(a.domain)
            : 999;
        const bPri = priorityIndex.has(b.domain)
            ? priorityIndex.get(b.domain)
            : 999;
        return (
            aPri - bPri ||
            b.tasks_total - a.tasks_total ||
            String(a.domain).localeCompare(String(b.domain))
        );
    });

    const bySignal = rows.reduce(
        (acc, row) => {
            acc[row.signal] = (acc[row.signal] || 0) + 1;
            return acc;
        },
        { GREEN: 0, YELLOW: 0, RED: 0 }
    );

    const totalWeight = rows.reduce(
        (acc, row) => acc + Number(row.weight || 0),
        0
    );
    const totalWeightedPoints = rows.reduce(
        (acc, row) => acc + Number(row.weighted_score_points || 0),
        0
    );
    const priorityRows = rows.filter((row) =>
        priorityDomains.includes(row.domain)
    );
    const priorityWeight = priorityRows.reduce(
        (acc, row) => acc + Number(row.weight || 0),
        0
    );
    const priorityWeightedPoints = priorityRows.reduce(
        (acc, row) => acc + Number(row.weighted_score_points || 0),
        0
    );
    const overallWeightedScorePct =
        totalWeight > 0
            ? Math.round((totalWeightedPoints / totalWeight) * 10) / 10
            : 100;
    const priorityWeightedScorePct =
        priorityWeight > 0
            ? Math.round((priorityWeightedPoints / priorityWeight) * 10) / 10
            : 100;

    return {
        version: 1,
        priority_domains: priorityDomains.slice(),
        scoring: {
            signal_scores: { ...signalScores },
            domain_weights: { ...domainWeights },
            total_weight: totalWeight,
            total_weighted_points: totalWeightedPoints,
            overall_weighted_score_pct: overallWeightedScorePct,
            priority_weight: priorityWeight,
            priority_weighted_points: priorityWeightedPoints,
            priority_weighted_score_pct: priorityWeightedScorePct,
            primary_metric: 'priority_weighted_score_pct',
            policy_source: existsSync(GOVERNANCE_POLICY_PATH)
                ? 'governance-policy.json'
                : 'defaults',
        },
        totals: {
            domains: rows.length,
            by_signal: bySignal,
        },
        domains: Object.fromEntries(rows.map((row) => [row.domain, row])),
        ranking: rows,
    };
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
    const rows = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking
        : [];
    return rows
        .map((row) => ({
            domain: String(row.domain || ''),
            signal: String(row.signal || 'GREEN'),
            tasks_total: Number(row.tasks_total || 0),
            active_tasks: Number(row.active_tasks || 0),
            done_tasks: Number(row.done_tasks || 0),
            blocking_conflicts: Number(row.blocking_conflicts || 0),
            handoff_conflicts: Number(row.handoff_conflicts || 0),
            active_expired_handoffs: Number(row.active_expired_handoffs || 0),
        }))
        .sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
}

function upsertDomainHealthHistory(history, domainHealth) {
    const base = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(base.snapshots)
        ? base.snapshots.slice()
        : [];
    const nowIso = new Date().toISOString();
    const date = nowIso.slice(0, 10);
    const snapshotRows = sanitizeDomainHealthSnapshot(domainHealth);
    const countsBySignal = snapshotRows.reduce(
        (acc, row) => {
            acc[row.signal] = (acc[row.signal] || 0) + 1;
            return acc;
        },
        { GREEN: 0, YELLOW: 0, RED: 0 }
    );
    const snapshot = {
        date,
        captured_at: nowIso,
        counts_by_signal: countsBySignal,
        domains: snapshotRows,
    };

    const next = snapshots.filter((item) => String(item.date || '') !== date);
    next.push(snapshot);
    next.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
    );

    return {
        version: 1,
        updated_at: nowIso,
        snapshots: next.slice(-365),
    };
}

function buildDomainHealthHistorySummary(history, days = 7) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const ordered = snapshots
        .filter((item) => item && typeof item === 'object' && item.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const recent = ordered.slice(-Math.max(1, Number(days) || 7));

    const domainSet = new Set();
    for (const item of recent) {
        for (const row of Array.isArray(item.domains) ? item.domains : []) {
            domainSet.add(String(row.domain || ''));
        }
    }
    const domains = Array.from(domainSet).filter(Boolean).sort();

    const daily = recent.map((item) => {
        const byDomain = {};
        for (const row of Array.isArray(item.domains) ? item.domains : []) {
            byDomain[String(row.domain || '')] = {
                signal: String(row.signal || 'GREEN'),
                tasks_total: Number(row.tasks_total || 0),
                active_tasks: Number(row.active_tasks || 0),
                done_tasks: Number(row.done_tasks || 0),
                blocking_conflicts: Number(row.blocking_conflicts || 0),
                handoff_conflicts: Number(row.handoff_conflicts || 0),
                active_expired_handoffs: Number(
                    row.active_expired_handoffs || 0
                ),
            };
        }
        return {
            date: String(item.date),
            captured_at: String(item.captured_at || ''),
            counts_by_signal: item.counts_by_signal || {
                GREEN: 0,
                YELLOW: 0,
                RED: 0,
            },
            domains: byDomain,
        };
    });

    let windowDelta = { available: false, rows: [] };
    let regressions = {
        green_to_red: [],
        worsened_signal: [],
    };
    if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];
        const union = Array.from(
            new Set([
                ...Object.keys(first.domains),
                ...Object.keys(last.domains),
            ])
        ).sort();
        windowDelta = {
            available: true,
            from_date: first.date,
            to_date: last.date,
            rows: union.map((domain) => {
                const firstBlocking = Number(
                    first.domains[domain]?.blocking_conflicts || 0
                );
                const lastBlocking = Number(
                    last.domains[domain]?.blocking_conflicts || 0
                );
                const firstSignal = String(
                    first.domains[domain]?.signal || 'GREEN'
                );
                const lastSignal = String(
                    last.domains[domain]?.signal || 'GREEN'
                );
                return {
                    domain,
                    signal_from: firstSignal,
                    signal_to: lastSignal,
                    blocking_conflicts_from: firstBlocking,
                    blocking_conflicts_to: lastBlocking,
                    blocking_conflicts_delta: lastBlocking - firstBlocking,
                };
            }),
        };

        const severity = { GREEN: 0, YELLOW: 1, RED: 2 };
        regressions = {
            green_to_red: windowDelta.rows
                .filter(
                    (row) =>
                        row.signal_from === 'GREEN' && row.signal_to === 'RED'
                )
                .map((row) => ({
                    domain: row.domain,
                    from_date: first.date,
                    to_date: last.date,
                    signal_from: row.signal_from,
                    signal_to: row.signal_to,
                    blocking_conflicts_delta: row.blocking_conflicts_delta,
                })),
            worsened_signal: windowDelta.rows
                .filter((row) => {
                    const from = severity[row.signal_from] ?? 0;
                    const to = severity[row.signal_to] ?? 0;
                    return to > from;
                })
                .map((row) => ({
                    domain: row.domain,
                    from_date: first.date,
                    to_date: last.date,
                    signal_from: row.signal_from,
                    signal_to: row.signal_to,
                })),
        };
    }

    return {
        version: 1,
        source_file: 'verification/agent-domain-health-history.json',
        window_days: Math.max(1, Number(days) || 7),
        snapshots_total: ordered.length,
        domains,
        daily,
        window_delta: windowDelta,
        regressions,
    };
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

async function cmdIntake(args = []) {
    const { flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const strict = args.includes('--strict');
    const noWrite = isFlagEnabled(flags, 'no-write', 'dry-run');
    const nowIso = new Date().toISOString();

    const board = parseBoard();
    const existingSignals = parseSignals();
    let incomingSignals = [];
    let normalizedIncomingSignals = [];
    let source = 'local_only';
    let repository = getGitHubRepository(flags);

    try {
        const githubSignals = await collectGitHubSignals(flags);
        incomingSignals = [
            ...(githubSignals.issues || []),
            ...(githubSignals.workflows || []),
        ];
        source = githubSignals.source;
        repository = githubSignals.repository || repository;
    } catch (error) {
        source = 'github_api_error';
        if (strict) {
            throw error;
        }
    }

    normalizedIncomingSignals = (incomingSignals || []).map((item) =>
        domainIntake.normalizeSignal(item, { nowIso })
    );

    const mergedSignals = domainIntake.mergeSignals(
        existingSignals.signals || [],
        normalizedIncomingSignals,
        { nowIso }
    );
    const allowSignalTransitions = source === 'github_api';
    if (allowSignalTransitions) {
        applySignalStateTransitions(mergedSignals, normalizedIncomingSignals, nowIso);
    }
    const intakeResult = upsertTasksFromSignals(board, mergedSignals, {
        nowIso,
        owner: detectDefaultOwner('orchestrator'),
    });

    if (!noWrite) {
        writeSignals({
            version: 1,
            updated_at: nowIso,
            signals: mergedSignals,
        });
        writeBoardAndSync(board, { silentSync: wantsJson });
    }

    const staleReport = buildStaleReport(board, mergedSignals);
    const report = {
        version: 1,
        ok: !strict || staleReport.ok,
        command: 'intake',
        source,
        repository,
        no_write: noWrite,
        intake: {
            incoming_signals: incomingSignals.length,
            incoming_signals_normalized: normalizedIncomingSignals.length,
            total_signals: mergedSignals.length,
            created_tasks: intakeResult.created,
            reopened_tasks: intakeResult.reopened,
            refreshed_tasks: intakeResult.refreshed,
        },
        stale: staleReport,
    };

    if (wantsJson) {
        coreOutput.printJson(report);
        if (strict && !staleReport.ok) {
            process.exitCode = 1;
        }
        return;
    }

    console.log('== Agent Intake ==');
    console.log(`Source: ${source}`);
    console.log(`Repository: ${repository}`);
    console.log(`Incoming signals: ${incomingSignals.length}`);
    console.log(`Total signals: ${mergedSignals.length}`);
    console.log(
        `Tasks: created=${intakeResult.created}, reopened=${intakeResult.reopened}, refreshed=${intakeResult.refreshed}`
    );
    if (strict && !staleReport.ok) {
        throw new Error(
            `Intake stale gate fallido: ${staleReport.invalid_reasons.join(', ')}`
        );
    }
}

function cmdScore(args = []) {
    const wantsJson = args.includes('--json');
    const { flags } = parseFlags(args);
    const noWrite = isFlagEnabled(flags, 'no-write', 'dry-run');
    const nowTs = Date.now();
    const nowDate = currentDate();
    const board = parseBoard();
    let changed = 0;
    let escalated = 0;
    let overdueBoosted = 0;

    for (const task of board.tasks) {
        const before = JSON.stringify(toTaskJson(task));
        const normalized = domainIntake.normalizeTaskForScoring(task, { nowTs });
        task.priority_score = normalized.priority_score;
        task.sla_due_at = normalized.sla_due_at;
        task.attempts = normalized.attempts;
        task.runtime_impact = normalized.runtime_impact;
        task.critical_zone = normalized.critical_zone;
        task.blocked_reason = normalized.blocked_reason;

        if (
            findCriticalScopeKeyword(task.scope) &&
            !['codex', 'claude'].includes(String(task.executor || '').toLowerCase())
        ) {
            task.executor = 'codex';
        }

        if (
            normalized.executor === 'codex' &&
            String(task.executor || '').toLowerCase() !== 'codex'
        ) {
            task.executor = 'codex';
            task.status = isTerminalTaskStatus(task.status) ? 'ready' : task.status;
            escalated += 1;
        }

        const dueTs = Date.parse(String(task.sla_due_at || ''));
        if (
            Number.isFinite(dueTs) &&
            dueTs < nowTs &&
            !isTerminalTaskStatus(task.status)
        ) {
            if (Number(task.priority_score || 0) < 100) {
                task.priority_score = 100;
                overdueBoosted += 1;
            }
        }

        task.updated_at = nowDate;
        const after = JSON.stringify(toTaskJson(task));
        if (before !== after) {
            changed += 1;
        }
    }

    if (!noWrite && changed > 0) {
        writeBoardAndSync(board, { silentSync: wantsJson });
    }

    const report = {
        version: 1,
        ok: true,
        command: 'score',
        no_write: noWrite,
        changed_tasks: changed,
        escalated_to_codex: escalated,
        overdue_boosted: overdueBoosted,
        totals: {
            tasks: board.tasks.length,
            active: board.tasks.filter((task) =>
                ACTIVE_STATUSES.has(String(task.status || ''))
            ).length,
        },
    };

    if (wantsJson) {
        coreOutput.printJson(report);
        return;
    }

    console.log('== Agent Score ==');
    console.log(`Tasks changed: ${changed}`);
    console.log(`Escalated to codex: ${escalated}`);
    console.log(`Overdue boosted: ${overdueBoosted}`);
}

async function cmdReconcile(args = []) {
    const { flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const strict = args.includes('--strict');
    const nowDate = currentDate();
    const board = parseBoard();
    const julesMeta = parseTaskMetaMap(JULES_PATH);
    const kimiMeta = parseTaskMetaMap(KIMI_PATH);

    const queueResultJules = applyQueueStateToBoard(
        board,
        julesMeta,
        'jules',
        nowDate
    );
    const queueResultKimi = applyQueueStateToBoard(
        board,
        kimiMeta,
        'kimi',
        nowDate
    );

    let prEvidenceApplied = 0;
    let pulls = [];
    try {
        pulls = await collectMergedPullRequestEvidence(flags);
    } catch (error) {
        if (strict) {
            throw error;
        }
    }

    for (const pull of pulls) {
        for (const taskId of pull.task_ids) {
            const task = board.tasks.find(
                (item) => String(item.id || '') === String(taskId)
            );
            if (!task) continue;
            task.status = 'done';
            task.updated_at = nowDate;
            task.evidence_ref = `pr#${pull.number}`;
            if (!String(task.acceptance_ref || '').trim()) {
                task.acceptance_ref = task.evidence_ref;
            }
            prEvidenceApplied += 1;
        }
    }

    const doneWithoutEvidence = board.tasks.filter(
        (task) =>
            String(task.status || '') === 'done' &&
            !String(task.evidence_ref || task.acceptance_ref || '').trim()
    );
    if (strict && doneWithoutEvidence.length > 0) {
        throw new Error(
            `reconcile: tareas done sin evidencia_ref (${doneWithoutEvidence
                .map((task) => String(task.id))
                .join(', ')})`
        );
    }

    writeBoardAndSync(board, { silentSync: wantsJson });

    const report = {
        version: 1,
        ok: doneWithoutEvidence.length === 0,
        command: 'reconcile',
        queue: {
            jules: queueResultJules,
            kimi: queueResultKimi,
        },
        pull_request_evidence_applied: prEvidenceApplied,
        merged_pull_requests_scanned: pulls.length,
        done_without_evidence: doneWithoutEvidence.map((task) => task.id),
    };

    if (wantsJson) {
        coreOutput.printJson(report);
        if (strict && !report.ok) {
            process.exitCode = 1;
        }
        return;
    }

    console.log('== Agent Reconcile ==');
    console.log(
        `Queue updates: jules=${queueResultJules.changed}, kimi=${queueResultKimi.changed}`
    );
    console.log(`PR evidence applied: ${prEvidenceApplied}`);
    if (!report.ok) {
        console.log(
            `WARN: done sin evidencia -> ${report.done_without_evidence.join(', ')}`
        );
    }
}

function cmdStale(args = []) {
    const wantsJson = args.includes('--json');
    const strict = args.includes('--strict');
    const board = parseBoard();
    const signals = parseSignals();
    const report = buildStaleReport(board, signals.signals || []);
    const result = {
        version: 1,
        ok: report.ok,
        command: 'stale',
        ...report,
    };

    if (wantsJson) {
        coreOutput.printJson(result);
        if (strict && !report.ok) {
            process.exitCode = 1;
        }
        return;
    }

    console.log('== Agent Stale Check ==');
    console.log(
        `Signals activos: ${report.counts.active_signals} (critical=${report.counts.critical_active_signals})`
    );
    console.log(
        `Tasks ready/in_progress: ${report.counts.ready_or_in_progress_tasks}`
    );
    if (strict && !report.ok) {
        throw new Error(`stale gate fallido: ${report.invalid_reasons.join(', ')}`);
    }
}

function cmdBudget(args = []) {
    const wantsJson = args.includes('--json');
    const { flags } = parseFlags(args);
    const strict = args.includes('--strict');
    const agentFilter = String(flags.agent || 'all')
        .trim()
        .toLowerCase();
    const board = parseBoard();
    const signals = parseSignals();
    const snapshot = buildBudgetSnapshot({
        board,
        signals: signals.signals || [],
        date: currentDate(),
    });

    const agents = ['jules', 'kimi', 'codex'].filter(
        (item) => agentFilter === 'all' || item === agentFilter
    );
    const exceeded = agents.filter((item) => snapshot.remaining[item] < 0);
    const report = {
        version: 1,
        ok: exceeded.length === 0,
        command: 'budget',
        date: snapshot.date,
        limits: snapshot.limits,
        limits_base: snapshot.limits_base,
        usage: snapshot.usage,
        remaining: snapshot.remaining,
        kimi_rate_limited: snapshot.kimi_rate_limited,
        exceeded,
    };

    if (wantsJson) {
        coreOutput.printJson(report);
        if (strict && !report.ok) {
            process.exitCode = 1;
        }
        return;
    }

    console.log('== Agent Budget ==');
    for (const agent of agents) {
        console.log(
            `- ${agent}: used=${snapshot.usage[agent]} limit=${snapshot.limits[agent]} remaining=${snapshot.remaining[agent]}`
        );
    }
    if (snapshot.kimi_rate_limited) {
        console.log('- kimi adaptive limit activo por rate-limit detectado (120/día).');
    }
    if (strict && !report.ok) {
        throw new Error(`budget excedido: ${exceeded.join(', ')}`);
    }
}

function cmdDispatch(args = []) {
    const wantsJson = args.includes('--json');
    const strict = args.includes('--strict');
    const { flags } = parseFlags(args);
    const agent = String(flags.agent || '').trim().toLowerCase();
    if (!['jules', 'kimi', 'codex'].includes(agent)) {
        throw new Error(
            'dispatch requiere --agent jules|kimi|codex'
        );
    }

    const nowIso = new Date().toISOString();
    const nowDate = currentDate();
    const board = parseBoard();
    const signals = parseSignals();
    const budgetSnapshot = buildBudgetSnapshot({
        board,
        signals: signals.signals || [],
        date: nowDate,
    });
    const runnable = board.tasks
        .filter(
            (task) =>
                String(task.executor || '').toLowerCase() === agent &&
                String(task.status || '') === 'ready'
        )
        .sort(
            (a, b) =>
                Number(b.priority_score || 0) - Number(a.priority_score || 0)
        );

    const defaultPerRun = agent === 'jules' ? 2 : agent === 'kimi' ? 2 : 1;
    const envPerRun =
        agent === 'jules'
            ? process.env.JULES_MAX_DISPATCH_PER_RUN
            : process.env.KIMI_MAX_DISPATCH_PER_RUN;
    const perRunLimit = Number.parseInt(String(envPerRun || defaultPerRun), 10);
    const requestedLimit =
        Number.isFinite(perRunLimit) && perRunLimit > 0 ? perRunLimit : defaultPerRun;
    const remainingBudget = Math.max(
        0,
        Number(budgetSnapshot.remaining[agent] || 0)
    );
    const effectiveLimit = Math.max(0, Math.min(requestedLimit, remainingBudget));
    const selected = runnable.slice(0, effectiveLimit);

    for (const task of selected) {
        task.last_attempt_at = nowIso;
        task.attempts =
            Number.parseInt(String(task.attempts || '0'), 10) + 1;
    }
    writeBoardAndSync(board, { silentSync: wantsJson });

    let runnerExitCode = 0;
    let runnerStdout = '';
    let runnerStderr = '';

    if (agent === 'jules' && selected.length > 0) {
        const result = runScriptCommand('jules-dispatch.js', ['dispatch'], {
            captureOutput: true,
            env: {
                JULES_MAX_DISPATCH_PER_RUN: String(selected.length || 1),
            },
        });
        runnerExitCode = Number(result.status || 0);
        runnerStdout = String(result.stdout || '');
        runnerStderr = String(result.stderr || '');
    } else if (agent === 'kimi' && selected.length > 0) {
        const result = runScriptCommand(
            'kimi-run.js',
            ['--dispatch', '--no-diff'],
            {
                captureOutput: true,
                env: {
                    KIMI_MAX_DISPATCH_PER_RUN: String(selected.length || 1),
                },
            }
        );
        runnerExitCode = Number(result.status || 0);
        runnerStdout = String(result.stdout || '');
        runnerStderr = String(result.stderr || '');
    } else {
        runnerStdout =
            selected.length > 0
                ? 'codex dispatch is manual by design'
                : `dispatch skipped: ${agent} sin presupuesto disponible`;
    }

    if (runnerExitCode === 0) {
        const metaMap =
            agent === 'jules'
                ? parseTaskMetaMap(JULES_PATH)
                : agent === 'kimi'
                  ? parseTaskMetaMap(KIMI_PATH)
                  : new Map();
        if (metaMap.size > 0) {
            applyQueueStateToBoard(board, metaMap, agent, nowDate);
            writeBoardAndSync(board, { silentSync: wantsJson });
        }
    }

    const report = {
        version: 1,
        ok: runnerExitCode === 0,
        command: 'dispatch',
        agent,
        selected_tasks: selected.map((task) => task.id),
        selected_count: selected.length,
        requested_limit: requestedLimit,
        effective_limit: effectiveLimit,
        budget_remaining: remainingBudget,
        budget_kimi_rate_limited: budgetSnapshot.kimi_rate_limited,
        runner_exit_code: runnerExitCode,
        runner_stdout: runnerStdout.trim(),
        runner_stderr: runnerStderr.trim(),
    };

    if (wantsJson) {
        coreOutput.printJson(report);
        if (strict && !report.ok) {
            process.exitCode = 1;
        }
        return;
    }

    console.log(`== Agent Dispatch (${agent}) ==`);
    console.log(`Selected: ${selected.length}`);
    if (runnerStdout.trim()) console.log(runnerStdout.trim());
    if (runnerStderr.trim()) console.log(runnerStderr.trim());
    if (strict && runnerExitCode !== 0) {
        throw new Error(`dispatch runner fallo para ${agent}`);
    }
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
    const data = {
        version: board.version,
        policy: board.policy,
        totals: {
            tasks: board.tasks.length,
            byStatus: getStatusCounts(board.tasks),
            byExecutor: getExecutorCounts(board.tasks),
        },
        contribution,
        contribution_trend: contributionTrend,
        domain_health: domainHealth,
        conflicts: conflictAnalysis.blocking.length,
        conflicts_breakdown: {
            blocking: conflictAnalysis.blocking.length,
            handoff: conflictAnalysis.handoffCovered.length,
            total_pairs: conflictAnalysis.all.length,
        },
    };

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

    if (wantsJson) {
        coreOutput.printJson(data);
        return;
    }

    console.log('== Agent Orchestrator Status ==');
    console.log(`Version board: ${data.version}`);
    console.log(`Total tasks: ${data.totals.tasks}`);
    console.log(`Conflicts activos (blocking): ${data.conflicts}`);
    console.log(
        `Conflicts eximidos por handoff: ${data.conflicts_breakdown.handoff}`
    );
    console.log('');
    console.log('Por estado:');
    for (const [status, count] of Object.entries(data.totals.byStatus)) {
        console.log(`- ${status}: ${count}`);
    }
    console.log('');
    console.log('Por ejecutor:');
    for (const [executor, count] of Object.entries(data.totals.byExecutor)) {
        console.log(`- ${executor}: ${count}`);
    }
    if (Array.isArray(data.domain_health?.ranking)) {
        console.log('');
        console.log('Semaforo por dominio:');
        if (data.domain_health?.scoring) {
            console.log(
                `- Score dominios (ponderado priority): ${data.domain_health.scoring.priority_weighted_score_pct}%`
            );
            console.log(
                `- Score dominios (ponderado global): ${data.domain_health.scoring.overall_weighted_score_pct}%`
            );
        }
        for (const row of data.domain_health.ranking) {
            console.log(
                `- [${row.signal}] ${row.domain}: tasks=${row.tasks_total}, active=${row.active_tasks}, blocking=${row.blocking_conflicts}, handoff=${row.handoff_conflicts}`
            );
        }
    }
    if (data.contribution.top_executor) {
        const executorsByName = new Map(
            data.contribution.executors.map((row) => [row.executor, row])
        );
        const trendByExecutor = new Map(
            Array.isArray(data.contribution_trend?.rows)
                ? data.contribution_trend.rows.map((row) => [row.executor, row])
                : []
        );
        console.log('');
        console.log('Aporte (ranking por completado ponderado):');
        if (data.contribution_trend) {
            console.log(
                `- Baseline de comparacion: ${data.contribution_trend.baseline_source}`
            );
        } else {
            console.log(
                '- Baseline de comparacion: n/a (ejecuta `node agent-orchestrator.js metrics` para fijarlo)'
            );
        }
        for (const row of data.contribution.ranking) {
            const fullRow = executorsByName.get(row.executor) || row;
            const trendRow = trendByExecutor.get(row.executor);
            const signal = getContributionSignal({
                ...fullRow,
                rank: row.rank,
            });
            const weightedDoneDelta = trendRow
                ? formatPpDelta(trendRow.weighted_done_points_pct_delta)
                : 'n/a';
            console.log(
                `- [${signal}] #${row.rank} ${row.executor}: ${row.weighted_done_points_pct}% (done ponderado, delta ${weightedDoneDelta} vs baseline), ${row.done_tasks_pct}% (tareas done)`
            );
        }
    }

    if (wantsExplainRed) {
        const explain = data.red_explanation || {};
        console.log('');
        console.log('Explain RED (status):');
        console.log(`- Signal: ${explain.signal || 'n/a'}`);
        console.log(
            `- Blockers: ${
                Array.isArray(explain.blockers) && explain.blockers.length > 0
                    ? explain.blockers.join(', ')
                    : 'none'
            }`
        );
        console.log(
            `- Reasons: ${
                Array.isArray(explain.reasons) && explain.reasons.length > 0
                    ? explain.reasons.join(', ')
                    : 'none'
            }`
        );
        if (
            Array.isArray(explain.top_blocking_conflicts) &&
            explain.top_blocking_conflicts.length > 0
        ) {
            console.log('- Top blocking conflicts:');
            for (const item of explain.top_blocking_conflicts) {
                const files = Array.isArray(item.overlap_files)
                    ? item.overlap_files.join(', ')
                    : '';
                console.log(
                    `  - ${item.left?.id || 'n/a'} <-> ${item.right?.id || 'n/a'} :: ${files || '(wildcard ambiguo)'}`
                );
            }
        }
    }
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

    if (wantsJson) {
        console.log(JSON.stringify(report, null, 2));
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

    if (wantsJson) {
        console.log(JSON.stringify(report, null, 2));
        if (!report.ok) process.exitCode = 1;
        return report;
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
        if (wantsJson) {
            console.log(JSON.stringify(report, null, 2));
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
        if (wantsJson) {
            console.log(JSON.stringify(report, null, 2));
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

    if (wantsJson) {
        console.log(JSON.stringify(report, null, 2));
        if (!report.ok) {
            process.exitCode = 1;
        }
        return report;
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
    task.evidence_ref = task.acceptance_ref;
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
        intake: () => cmdIntake(args),
        score: () => cmdScore(args),
        reconcile: () => cmdReconcile(args),
        stale: () => cmdStale(args),
        budget: () => cmdBudget(args),
        dispatch: () => cmdDispatch(args),
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
