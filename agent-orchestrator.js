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
    const scope = String(scopeValue || '')
        .trim()
        .toLowerCase();
    if (!scope) return null;
    for (const keyword of CRITICAL_SCOPE_KEYWORDS) {
        if (scope.includes(keyword)) return keyword;
    }
    return null;
}

function validateTaskExecutorScopeGuard(task) {
    const scope = String(task?.scope || '');
    const executor = String(task?.executor || '')
        .trim()
        .toLowerCase();
    const matchedKeyword = findCriticalScopeKeyword(scope);
    if (!matchedKeyword) return;
    if (CRITICAL_SCOPE_ALLOWED_EXECUTORS.has(executor)) return;
    throw new Error(
        `task critica (${scope}) no puede asignarse a executor ${executor}; permitidos: ${Array.from(
            CRITICAL_SCOPE_ALLOWED_EXECUTORS
        ).join(', ')}`
    );
}

function validateTaskDependsOn(board, task, options = {}) {
    const { allowSelf = false } = options;
    const taskId = String(task?.id || '').trim();
    const deps = Array.isArray(task?.depends_on) ? task.depends_on : [];
    const seen = new Set();
    const idsInBoard = new Set(
        (board?.tasks || []).map((item) => String(item.id || ''))
    );

    for (const rawDep of deps) {
        const dep = String(rawDep || '').trim();
        if (!dep) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on contiene valor vacio`
            );
        }
        if (!/^(AG|CDX)-\d+$/.test(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on invalido (${dep}), esperado AG-### o CDX-###`
            );
        }
        if (seen.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on duplicado (${dep})`
            );
        }
        seen.add(dep);
        if (!allowSelf && dep === taskId) {
            throw new Error(
                `task ${taskId}: depends_on no puede referenciarse a si misma`
            );
        }
        if (!idsInBoard.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on no existe en board (${dep})`
            );
        }
    }
}

function validateTaskGovernancePrechecks(board, task, options = {}) {
    validateTaskExecutorScopeGuard(task);
    validateTaskDependsOn(board, task, options);
}

function resolveTaskCreateTemplate(templateNameRaw) {
    const templateName = String(templateNameRaw || '')
        .trim()
        .toLowerCase();
    if (!templateName) return null;
    const template = TASK_CREATE_TEMPLATES[templateName];
    if (!template) {
        throw new Error(
            `task create: template invalido (${templateName}); disponibles: ${Object.keys(
                TASK_CREATE_TEMPLATES
            ).join(', ')}`
        );
    }
    return { name: templateName, ...template };
}

function inferTaskCreateFromFiles(files) {
    const normalizedFiles = Array.isArray(files)
        ? files.map((item) => normalizePathToken(item)).filter(Boolean)
        : [];
    if (normalizedFiles.length === 0) return null;

    const criticalMatches = [];
    for (const keyword of CRITICAL_SCOPE_KEYWORDS) {
        if (normalizedFiles.some((file) => file.includes(keyword))) {
            criticalMatches.push(keyword);
        }
    }

    let scope = null;
    if (criticalMatches.length > 0) {
        scope = criticalMatches[0];
    } else {
        const domain = inferTaskDomain({ scope: '', files: normalizedFiles });
        if (domain && domain !== 'other') {
            scope = domain;
        } else {
            const firstTopLevel = String(normalizedFiles[0] || '')
                .split('/')[0]
                .trim();
            scope = firstTopLevel || 'general';
        }
    }

    const allDocsLike = normalizedFiles.every(
        (file) =>
            file.startsWith('docs/') ||
            file.endsWith('.md') ||
            file.endsWith('.txt')
    );

    const hasHighRiskPathSignals = normalizedFiles.some((file) => {
        return (
            file.startsWith('.github/workflows/') ||
            file.includes('/deploy') ||
            file.includes('deploy/') ||
            file.includes('/auth') ||
            file.includes('/security') ||
            file.includes('/calendar') ||
            file.includes('/payments') ||
            file.includes('/payment') ||
            file.includes('stripe') ||
            file.endsWith('env.php') ||
            file.includes('/secrets') ||
            file.includes('/secret') ||
            file.includes('/backup') ||
            file.includes('/restore')
        );
    });

    let risk = 'medium';
    if (criticalMatches.length > 0 || hasHighRiskPathSignals) {
        risk = 'high';
    } else if (allDocsLike) {
        risk = 'low';
    }

    const criticalScope = findCriticalScopeKeyword(scope);
    const suggestedExecutor = criticalScope ? 'codex' : null;

    return {
        scope,
        risk,
        critical_scope: criticalScope,
        suggested_executor: suggestedExecutor,
        allowed_executors_for_scope: criticalScope
            ? Array.from(CRITICAL_SCOPE_ALLOWED_EXECUTORS)
            : null,
        reasons: {
            critical_keywords: criticalMatches,
            all_docs_like: allDocsLike,
            high_risk_path_signals: hasHighRiskPathSignals,
        },
    };
}

function buildTaskCreateInferenceExplainLines(context = {}) {
    const lines = [];
    const {
        fromFilesEnabled = false,
        fileInference = null,
        scopeSource = 'default',
        riskSource = 'default',
        executorSource = 'default',
        task = null,
        templateName = null,
    } = context;

    if (templateName) {
        lines.push(`template=${templateName}`);
    } else {
        lines.push('template=(none)');
    }

    if (!fromFilesEnabled) {
        lines.push('from-files=disabled');
        lines.push(
            `scope=${task?.scope || 'n/a'} (source=${scopeSource}), risk=${task?.risk || 'n/a'} (source=${riskSource}), executor=${task?.executor || 'n/a'} (source=${executorSource})`
        );
        return lines;
    }

    if (!fileInference) {
        lines.push('from-files=enabled sin inferencia (files vacio/no valido)');
        lines.push(
            `scope=${task?.scope || 'n/a'} (source=${scopeSource}), risk=${task?.risk || 'n/a'} (source=${riskSource}), executor=${task?.executor || 'n/a'} (source=${executorSource})`
        );
        return lines;
    }

    lines.push('from-files=enabled');
    lines.push(
        `inference.scope=${fileInference.scope || 'n/a'} (${fileInference.critical_scope ? `critical:${fileInference.critical_scope}` : 'non-critical'})`
    );
    lines.push(
        `inference.risk=${fileInference.risk || 'n/a'} (docs_like=${Boolean(fileInference?.reasons?.all_docs_like)}, high_risk_signals=${Boolean(fileInference?.reasons?.high_risk_path_signals)})`
    );
    if (fileInference.suggested_executor) {
        lines.push(
            `inference.suggested_executor=${fileInference.suggested_executor} (allowed=${Array.isArray(fileInference.allowed_executors_for_scope) ? fileInference.allowed_executors_for_scope.join(',') : 'n/a'})`
        );
    } else {
        lines.push('inference.suggested_executor=(none)');
    }
    lines.push(
        `resolved.scope=${task?.scope || 'n/a'} (source=${scopeSource}), resolved.risk=${task?.risk || 'n/a'} (source=${riskSource}), resolved.executor=${task?.executor || 'n/a'} (source=${executorSource})`
    );
    return lines;
}

function createPromptInterface(wantsJson = false) {
    return readline.createInterface({
        input: process.stdin,
        output: wantsJson ? process.stderr : process.stdout,
    });
}

function askLine(rl, promptText) {
    return new Promise((resolve) => {
        rl.question(promptText, (answer) => resolve(String(answer || '')));
    });
}

async function collectTaskCreateInteractiveFlags(
    flags = {},
    wantsJson = false
) {
    const merged = { ...(flags || {}) };
    const promptWriter = wantsJson ? process.stderr : process.stdout;
    const promptSteps = async (ask) => {
        if (!String(merged.title || '').trim()) {
            merged.title = (await ask('Titulo: ')).trim();
        }

        if (!String(merged.template || '').trim()) {
            const answer = (
                await ask('Template (docs|bugfix|critical, enter=none): ')
            ).trim();
            if (answer) merged.template = answer;
        }

        if (!String(merged.files || '').trim()) {
            merged.files = (await ask('Files CSV: ')).trim();
        }

        if (
            !Object.prototype.hasOwnProperty.call(merged, 'from-files') &&
            !Object.prototype.hasOwnProperty.call(merged, 'from_files')
        ) {
            const answer = (
                await ask('Inferir scope/risk desde files? (y/N): ')
            )
                .trim()
                .toLowerCase();
            if (['y', 'yes', 'si', 's', '1', 'true'].includes(answer)) {
                merged['from-files'] = true;
            }
        }

        const optionalPrompts = [
            ['executor', 'Executor (enter=auto/template): '],
            ['status', 'Status (enter=auto): '],
            ['risk', 'Risk low|medium|high (enter=auto): '],
            ['scope', 'Scope (enter=auto): '],
            ['depends-on', 'Depends_on CSV (enter=none): '],
        ];
        for (const [key, label] of optionalPrompts) {
            if (String(merged[key] || '').trim()) continue;
            const answer = (await ask(label)).trim();
            if (answer) merged[key] = answer;
        }
    };

    if (!process.stdin.isTTY) {
        const bufferedInput = readFileSync(0, 'utf8');
        const lines = String(bufferedInput || '').split(/\r?\n/);
        let cursor = 0;
        await promptSteps(async (label) => {
            promptWriter.write(label);
            if (cursor >= lines.length) return '';
            const answer = lines[cursor];
            cursor += 1;
            return answer;
        });
        return merged;
    }

    const rl = createPromptInterface(wantsJson);
    try {
        await promptSteps((label) => askLine(rl, label));
    } finally {
        rl.close();
    }
    return merged;
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
    if (!rawTask || typeof rawTask !== 'object') {
        throw new Error(
            'task create --apply requiere payload.task_full o payload.task valido'
        );
    }
    const task = {
        id: String(rawTask.id || '').trim(),
        title: String(rawTask.title || '').trim(),
        owner: String(rawTask.owner || 'unassigned').trim() || 'unassigned',
        executor: String(rawTask.executor || '')
            .trim()
            .toLowerCase(),
        status: String(rawTask.status || '').trim(),
        risk: String(rawTask.risk || '')
            .trim()
            .toLowerCase(),
        scope: String(rawTask.scope || '').trim(),
        files: Array.isArray(rawTask.files)
            ? rawTask.files.map((v) => String(v || '').trim()).filter(Boolean)
            : [],
        acceptance: String(rawTask.acceptance || rawTask.title || '').trim(),
        acceptance_ref: String(rawTask.acceptance_ref || '').trim(),
        depends_on: Array.isArray(rawTask.depends_on)
            ? rawTask.depends_on
                  .map((v) => String(v || '').trim())
                  .filter(Boolean)
            : [],
        prompt: String(rawTask.prompt || rawTask.title || '').trim(),
        created_at:
            String(rawTask.created_at || currentDate()).trim() || currentDate(),
        updated_at:
            String(rawTask.updated_at || currentDate()).trim() || currentDate(),
    };

    if (!/^AG-\d+$/.test(task.id)) {
        throw new Error(
            `task create --apply requiere task.id AG-### (actual: ${task.id || 'vacio'})`
        );
    }
    if (!task.title) {
        throw new Error('task create --apply requiere task.title');
    }
    if (!task.executor) {
        throw new Error('task create --apply requiere task.executor');
    }
    if (!ALLOWED_TASK_EXECUTORS.has(task.executor)) {
        throw new Error(
            `task create --apply: executor invalido (${task.executor})`
        );
    }
    if (!ALLOWED_STATUSES.has(task.status)) {
        throw new Error(
            `task create --apply: status invalido (${task.status})`
        );
    }
    if (!['low', 'medium', 'high'].includes(task.risk)) {
        throw new Error(`task create --apply: risk invalido (${task.risk})`);
    }
    if (task.files.length === 0) {
        throw new Error('task create --apply requiere task.files no vacio');
    }

    return task;
}

function loadTaskCreateApplyPayload(applyPathRaw, options = {}) {
    const modeLabel = String(options.modeLabel || 'task create --apply');
    const applyPath = String(applyPathRaw || '').trim();
    if (!applyPath || applyPath === 'true') {
        throw new Error(
            `${modeLabel} requiere ruta al JSON de preview (ej: --apply verification/task-preview.json o - para stdin)`
        );
    }

    let rawJson = '';
    let resolvedPath = null;
    if (applyPath === '-') {
        rawJson = readFileSync(0, 'utf8');
    } else {
        resolvedPath = resolve(ROOT, applyPath);
        if (!existsSync(resolvedPath)) {
            throw new Error(`No existe archivo de apply: ${resolvedPath}`);
        }
        rawJson = readFileSync(resolvedPath, 'utf8');
    }

    let payload;
    try {
        payload = JSON.parse(rawJson);
    } catch (error) {
        throw new Error(
            `JSON invalido en ${modeLabel} (${applyPath}): ${error.message}`
        );
    }
    if (
        String(payload?.command || '') !== 'task' ||
        String(payload?.action || '') !== 'create'
    ) {
        throw new Error(`${modeLabel} requiere JSON generado por task create`);
    }
    if (
        !(
            payload?.preview === true ||
            payload?.dry_run === true ||
            payload?.persisted === false
        )
    ) {
        throw new Error(
            `${modeLabel} requiere payload de preview/dry-run (persisted=false)`
        );
    }
    return {
        path: applyPath,
        resolved_path: resolvedPath,
        payload,
    };
}

function summarizeBlockingConflictsForTask(taskId, conflicts) {
    const safeTaskId = String(taskId || '').trim();
    return (Array.isArray(conflicts) ? conflicts : []).map((item) => {
        const leftId = String(item?.left?.id || '');
        const other = leftId === safeTaskId ? item?.right : item?.left;
        const overlapFiles = Array.isArray(item?.overlap_files)
            ? item.overlap_files
            : [];
        return {
            other_id: String(other?.id || ''),
            overlap_files: overlapFiles,
            overlap_files_text: overlapFiles.length
                ? overlapFiles.join(', ')
                : '(wildcard ambiguo)',
        };
    });
}

function formatBlockingConflictSummary(taskId, conflicts) {
    return summarizeBlockingConflictsForTask(taskId, conflicts)
        .map(
            (row) =>
                `${taskId} <-> ${row.other_id} :: ${row.overlap_files_text}`
        )
        .join(' | ');
}

function buildTaskCreatePreviewDiff(existingTask, previewTask) {
    if (!existingTask || !previewTask) return [];
    const before = toTaskFullJson(existingTask);
    const after = toTaskFullJson(previewTask);
    const keys = [
        'title',
        'owner',
        'executor',
        'status',
        'risk',
        'scope',
        'files',
        'acceptance',
        'acceptance_ref',
        'depends_on',
        'prompt',
    ];
    const diffs = [];
    for (const key of keys) {
        const left = before[key];
        const right = after[key];
        const leftJson = JSON.stringify(left);
        const rightJson = JSON.stringify(right);
        if (leftJson === rightJson) continue;
        diffs.push({
            field: key,
            before: left,
            after: right,
        });
    }
    return diffs;
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
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((Number(part || 0) / total) * 1000) / 10;
}

function riskWeight(task) {
    const risk = String(task?.risk || '').toLowerCase();
    if (risk === 'high') return 3;
    if (risk === 'medium') return 2;
    return 1;
}

function buildExecutorContribution(tasks) {
    const totals = {
        tasks: tasks.length,
        done_tasks: 0,
        active_tasks: 0,
        weighted_points_total: 0,
        weighted_done_points_total: 0,
        weighted_active_points_total: 0,
    };

    const map = new Map();
    for (const task of tasks) {
        const executor = String(task.executor || 'unknown');
        const status = String(task.status || '');
        const weight = riskWeight(task);
        const isDone = status === 'done';
        const isActive = ACTIVE_STATUSES.has(status);

        totals.weighted_points_total += weight;
        if (isDone) totals.done_tasks += 1;
        if (isActive) totals.active_tasks += 1;
        if (isDone) totals.weighted_done_points_total += weight;
        if (isActive) totals.weighted_active_points_total += weight;

        if (!map.has(executor)) {
            map.set(executor, {
                executor,
                tasks: 0,
                done_tasks: 0,
                active_tasks: 0,
                weighted_points: 0,
                weighted_done_points: 0,
                weighted_active_points: 0,
            });
        }

        const row = map.get(executor);
        row.tasks += 1;
        row.weighted_points += weight;
        if (isDone) {
            row.done_tasks += 1;
            row.weighted_done_points += weight;
        }
        if (isActive) {
            row.active_tasks += 1;
            row.weighted_active_points += weight;
        }
    }

    const executors = Array.from(map.values())
        .map((row) => ({
            ...row,
            tasks_pct: percent(row.tasks, totals.tasks),
            done_tasks_pct: percent(row.done_tasks, totals.done_tasks),
            active_tasks_pct: percent(row.active_tasks, totals.active_tasks),
            weighted_points_pct: percent(
                row.weighted_points,
                totals.weighted_points_total
            ),
            weighted_done_points_pct: percent(
                row.weighted_done_points,
                totals.weighted_done_points_total
            ),
            weighted_active_points_pct: percent(
                row.weighted_active_points,
                totals.weighted_active_points_total
            ),
        }))
        .sort((a, b) => {
            return (
                b.weighted_done_points - a.weighted_done_points ||
                b.done_tasks - a.done_tasks ||
                b.weighted_active_points - a.weighted_active_points ||
                b.tasks - a.tasks ||
                String(a.executor).localeCompare(String(b.executor))
            );
        });

    const ranking = executors.map((row, idx) => ({
        rank: idx + 1,
        executor: row.executor,
        weighted_done_points: row.weighted_done_points,
        weighted_done_points_pct: row.weighted_done_points_pct,
        done_tasks: row.done_tasks,
        done_tasks_pct: row.done_tasks_pct,
    }));

    return {
        scoring: {
            primary_metric: 'weighted_done_points_pct',
            risk_weights: { low: 1, medium: 2, high: 3 },
        },
        totals,
        executors,
        ranking,
        top_executor: ranking[0] || null,
    };
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
    const rows = Array.isArray(contribution?.executors)
        ? contribution.executors
        : [];
    return rows
        .map((row) => ({
            executor: String(row.executor || ''),
            weighted_done_points_pct: Number(row.weighted_done_points_pct || 0),
            done_tasks_pct: Number(row.done_tasks_pct || 0),
            active_tasks_pct: Number(row.active_tasks_pct || 0),
            weighted_active_points_pct: Number(
                row.weighted_active_points_pct || 0
            ),
        }))
        .sort((a, b) => String(a.executor).localeCompare(String(b.executor)));
}

function upsertContributionHistory(history, contribution) {
    const base = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(base.snapshots)
        ? base.snapshots.slice()
        : [];
    const nowIso = new Date().toISOString();
    const date = nowIso.slice(0, 10);
    const snapshot = {
        date,
        captured_at: nowIso,
        top_executor: contribution?.top_executor
            ? String(contribution.top_executor.executor || '')
            : null,
        executors: sanitizeContributionSnapshotExecutors(contribution),
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

function buildContributionHistorySummary(history, days = 7) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const ordered = snapshots
        .filter((item) => item && typeof item === 'object' && item.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const recent = ordered.slice(-Math.max(1, Number(days) || 7));

    const executorSet = new Set();
    for (const item of recent) {
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            executorSet.add(String(row.executor || ''));
        }
    }
    const executors = Array.from(executorSet).filter(Boolean).sort();

    const daily = recent.map((item) => {
        const byExecutor = {};
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            byExecutor[String(row.executor || '')] = {
                weighted_done_points_pct: Number(
                    row.weighted_done_points_pct || 0
                ),
                done_tasks_pct: Number(row.done_tasks_pct || 0),
                active_tasks_pct: Number(row.active_tasks_pct || 0),
            };
        }
        return {
            date: String(item.date),
            captured_at: String(item.captured_at || ''),
            top_executor: item.top_executor ? String(item.top_executor) : null,
            executors: byExecutor,
        };
    });

    let weeklyDelta = { available: false, rows: [] };
    if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];
        const union = Array.from(
            new Set([
                ...Object.keys(first.executors),
                ...Object.keys(last.executors),
            ])
        ).sort();
        weeklyDelta = {
            available: true,
            from_date: first.date,
            to_date: last.date,
            rows: union.map((executor) => {
                const firstVal = Number(
                    first.executors[executor]?.weighted_done_points_pct || 0
                );
                const lastVal = Number(
                    last.executors[executor]?.weighted_done_points_pct || 0
                );
                return {
                    executor,
                    weighted_done_points_pct_from: firstVal,
                    weighted_done_points_pct_to: lastVal,
                    weighted_done_points_pct_delta:
                        Math.round((lastVal - firstVal) * 10) / 10,
                };
            }),
        };
    }

    return {
        version: 1,
        source_file: 'verification/agent-contribution-history.json',
        window_days: Math.max(1, Number(days) || 7),
        snapshots_total: ordered.length,
        daily,
        executors,
        weekly_delta: weeklyDelta,
    };
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
    if (!metricsSnapshot || typeof metricsSnapshot !== 'object') return null;
    if (
        metricsSnapshot.baseline_contribution &&
        Array.isArray(metricsSnapshot.baseline_contribution.executors)
    ) {
        return metricsSnapshot.baseline_contribution;
    }
    if (
        metricsSnapshot.contribution &&
        Array.isArray(metricsSnapshot.contribution.executors)
    ) {
        return metricsSnapshot.contribution;
    }
    return null;
}

function buildContributionTrend(currentContribution, baselineContribution) {
    if (
        !currentContribution ||
        !Array.isArray(currentContribution.executors) ||
        !baselineContribution ||
        !Array.isArray(baselineContribution.executors)
    ) {
        return null;
    }

    const baselineByExecutor = new Map(
        baselineContribution.executors.map((row) => [
            String(row.executor || ''),
            row,
        ])
    );

    const rows = currentContribution.executors.map((row) => {
        const baseline =
            baselineByExecutor.get(String(row.executor || '')) || {};
        const weightedDonePctCurrent = Number(
            row.weighted_done_points_pct || 0
        );
        const weightedDonePctBaseline = Number(
            baseline.weighted_done_points_pct || 0
        );
        const donePctCurrent = Number(row.done_tasks_pct || 0);
        const donePctBaseline = Number(baseline.done_tasks_pct || 0);

        return {
            executor: String(row.executor || ''),
            weighted_done_points_pct_current: weightedDonePctCurrent,
            weighted_done_points_pct_baseline: weightedDonePctBaseline,
            weighted_done_points_pct_delta:
                Math.round(
                    (weightedDonePctCurrent - weightedDonePctBaseline) * 10
                ) / 10,
            done_tasks_pct_current: donePctCurrent,
            done_tasks_pct_baseline: donePctBaseline,
            done_tasks_pct_delta:
                Math.round((donePctCurrent - donePctBaseline) * 10) / 10,
        };
    });

    return {
        baseline_source: 'metrics',
        rows,
    };
}

function getContributionSignal(row) {
    const weightedDone = Number(row.weighted_done_points_pct || 0);
    const active = Number(row.active_tasks || 0);
    const rank = Number(row.rank || 999);

    if (rank === 1 && weightedDone > 0) return 'GREEN';
    if (weightedDone > 0 || active > 0) return 'YELLOW';
    return 'RED';
}

function formatPpDelta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    if (n > 0) return `+${n}pp`;
    return `${n}pp`;
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
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function normalizePathToken(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function hasWildcard(value) {
    return String(value || '').includes('*');
}

function analyzeFileOverlap(filesA, filesB) {
    const overlapFiles = new Set();
    let ambiguousWildcardOverlap = false;
    let anyOverlap = false;

    for (const rawA of filesA || []) {
        for (const rawB of filesB || []) {
            const a = normalizePathToken(rawA);
            const b = normalizePathToken(rawB);
            if (!a || !b) continue;

            if (a === b) {
                anyOverlap = true;
                overlapFiles.add(a);
                continue;
            }

            const aWild = hasWildcard(a);
            const bWild = hasWildcard(b);

            if (!aWild && bWild && wildcardToRegex(b).test(a)) {
                anyOverlap = true;
                overlapFiles.add(a);
                continue;
            }

            if (aWild && !bWild && wildcardToRegex(a).test(b)) {
                anyOverlap = true;
                overlapFiles.add(b);
                continue;
            }

            if (aWild && bWild) {
                // Pattern-vs-pattern overlap is conservatively treated as ambiguous.
                if (wildcardToRegex(a).test(b) || wildcardToRegex(b).test(a)) {
                    anyOverlap = true;
                    ambiguousWildcardOverlap = true;
                }
            }
        }
    }

    return {
        anyOverlap,
        ambiguousWildcardOverlap,
        overlapFiles: Array.from(overlapFiles).sort(),
    };
}

function _filesOverlap(filesA, filesB) {
    return analyzeFileOverlap(filesA, filesB).anyOverlap;
}

function isExpired(dateValue) {
    const parsed = Date.parse(String(dateValue || ''));
    if (!Number.isFinite(parsed)) return true;
    return parsed <= Date.now();
}

function isActiveHandoff(handoff) {
    return (
        String(handoff.status || '').toLowerCase() === 'active' &&
        !isExpired(handoff.expires_at)
    );
}

function sameTaskPair(handoff, leftTask, rightTask) {
    const fromTask = String(handoff.from_task || '');
    const toTask = String(handoff.to_task || '');
    const leftId = String(leftTask.id || '');
    const rightId = String(rightTask.id || '');
    return (
        (fromTask === leftId && toTask === rightId) ||
        (fromTask === rightId && toTask === leftId)
    );
}

function analyzeConflicts(tasks, handoffs = []) {
    const activeTasks = tasks.filter((task) =>
        ACTIVE_STATUSES.has(task.status)
    );
    const activeHandoffs = (handoffs || []).filter(isActiveHandoff);
    const all = [];
    const blocking = [];
    const handoffCovered = [];

    for (let i = 0; i < activeTasks.length; i++) {
        for (let j = i + 1; j < activeTasks.length; j++) {
            const left = activeTasks[i];
            const right = activeTasks[j];
            const overlap = analyzeFileOverlap(left.files, right.files);
            if (!overlap.anyOverlap) continue;

            const matchingHandoffs = activeHandoffs.filter((handoff) =>
                sameTaskPair(handoff, left, right)
            );
            const overlapSet = new Set(overlap.overlapFiles);
            const coveredFiles = new Set();

            for (const handoff of matchingHandoffs) {
                for (const rawFile of handoff.files || []) {
                    const file = normalizePathToken(rawFile);
                    if (overlapSet.has(file)) {
                        coveredFiles.add(file);
                    }
                }
            }

            const fullyCovered =
                !overlap.ambiguousWildcardOverlap &&
                overlap.overlapFiles.length > 0 &&
                overlap.overlapFiles.every((file) => coveredFiles.has(file));

            const record = {
                left,
                right,
                overlap_files: overlap.overlapFiles,
                ambiguous_wildcard_overlap: overlap.ambiguousWildcardOverlap,
                handoff_ids: matchingHandoffs.map((handoff) =>
                    String(handoff.id || '')
                ),
                exempted_by_handoff: fullyCovered,
            };

            all.push(record);
            if (fullyCovered) {
                handoffCovered.push(record);
            } else {
                blocking.push(record);
            }
        }
    }

    return { all, blocking, handoffCovered };
}

function _detectConflicts(tasks, handoffs = []) {
    return analyzeConflicts(tasks, handoffs).blocking;
}

function toConflictJsonRecord(item) {
    return {
        left: {
            id: String(item.left.id || ''),
            executor: String(item.left.executor || ''),
            status: String(item.left.status || ''),
            scope: String(item.left.scope || ''),
        },
        right: {
            id: String(item.right.id || ''),
            executor: String(item.right.executor || ''),
            status: String(item.right.status || ''),
            scope: String(item.right.scope || ''),
        },
        overlap_files: Array.isArray(item.overlap_files)
            ? item.overlap_files
            : [],
        ambiguous_wildcard_overlap: Boolean(item.ambiguous_wildcard_overlap),
        handoff_ids: Array.isArray(item.handoff_ids) ? item.handoff_ids : [],
        exempted_by_handoff: Boolean(item.exempted_by_handoff),
    };
}

function buildStatusRedExplanation({
    conflictAnalysis,
    handoffData,
    handoffLintErrors,
    codexCheckReport,
    domainHealth,
    domainHealthHistory,
}) {
    const blockingConflicts = Array.isArray(conflictAnalysis?.blocking)
        ? conflictAnalysis.blocking
        : [];
    const handoffCovered = Array.isArray(conflictAnalysis?.handoffCovered)
        ? conflictAnalysis.handoffCovered
        : [];
    const handoffs = Array.isArray(handoffData?.handoffs)
        ? handoffData.handoffs
        : [];
    const activeExpiredHandoffs = handoffs.filter(
        (item) =>
            String(item.status || '').toLowerCase() === 'active' &&
            isExpired(item.expires_at)
    );
    const redDomains = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking.filter(
              (row) => String(row.signal || '') === 'RED'
          )
        : [];
    const greenToRedRegressions = Array.isArray(
        domainHealthHistory?.regressions?.green_to_red
    )
        ? domainHealthHistory.regressions.green_to_red
        : [];

    const blockers = [];
    const reasons = [];
    if (blockingConflicts.length > 0) {
        blockers.push('conflicts');
        reasons.push(`blocking_conflicts:${blockingConflicts.length}`);
    }
    if (Array.isArray(handoffLintErrors) && handoffLintErrors.length > 0) {
        blockers.push('handoffs_lint');
        reasons.push(`handoffs_lint:${handoffLintErrors.length}`);
    }
    if (codexCheckReport?.ok === false) {
        blockers.push('codex_check');
        reasons.push(`codex_check:${codexCheckReport.error_count || 0}`);
    }
    if (greenToRedRegressions.length > 0) {
        blockers.push('domain_regression_green_to_red');
        reasons.push(
            `domain_regression_green_to_red:${greenToRedRegressions.length}`
        );
    }
    if (redDomains.length > 0) {
        reasons.push(
            `domain_red:${redDomains.map((row) => String(row.domain)).join(',')}`
        );
    }
    if (activeExpiredHandoffs.length > 0) {
        reasons.push(`handoffs_active_expired:${activeExpiredHandoffs.length}`);
    }
    if (handoffCovered.length > 0) {
        reasons.push(`handoff_conflicts:${handoffCovered.length}`);
    }
    if (reasons.length === 0) {
        reasons.push('no_red_conditions_detected');
    }

    return {
        version: 1,
        signal: blockers.length > 0 ? 'RED' : 'NOT_RED',
        blockers,
        reasons,
        counts: {
            blocking_conflicts: blockingConflicts.length,
            handoff_conflicts: handoffCovered.length,
            handoff_lint_errors: Array.isArray(handoffLintErrors)
                ? handoffLintErrors.length
                : 0,
            codex_check_errors: Number(codexCheckReport?.error_count || 0),
            active_expired_handoffs: activeExpiredHandoffs.length,
            red_domains: redDomains.length,
            domain_regression_green_to_red: greenToRedRegressions.length,
        },
        top_blocking_conflicts: blockingConflicts
            .slice(0, 5)
            .map((item) => toConflictJsonRecord(item)),
        handoff_lint_errors: Array.isArray(handoffLintErrors)
            ? handoffLintErrors.slice(0, 10)
            : [],
        codex_check_errors: Array.isArray(codexCheckReport?.errors)
            ? codexCheckReport.errors.slice(0, 10)
            : [],
        red_domains: redDomains.slice(0, 10).map((row) => ({
            domain: String(row.domain || ''),
            signal: String(row.signal || ''),
            blocking_conflicts: Number(row.blocking_conflicts || 0),
            handoff_conflicts: Number(row.handoff_conflicts || 0),
            reasons: Array.isArray(row.reasons) ? row.reasons : [],
        })),
        domain_regression_green_to_red: greenToRedRegressions.slice(0, 10),
    };
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
            'Uso: node agent-orchestrator.js task <ls|create|claim|start|finish> [AG-001] [--owner x] [--executor y] [--status z] [--files a,b] [--evidence path] [--active|--mine]'
        );
    }

    if (normalizedSubcommand === 'ls') {
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
            console.log(JSON.stringify(report, null, 2));
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
            const filesCount = Array.isArray(task.files)
                ? task.files.length
                : 0;
            console.log(
                `- ${task.id} [${task.status}] exec=${task.executor} owner=${task.owner || 'n/a'} risk=${task.risk || 'n/a'} scope=${task.scope || 'n/a'} files=${filesCount}`
            );
        }
        return;
    }

    if (normalizedSubcommand === 'create') {
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
            const task = normalizeTaskForCreateApply(
                loaded.payload?.task_full || loaded.payload?.task
            );

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
                validateTaskGovernancePrechecks(board, task);
            } catch (error) {
                governanceOk = false;
                errors.push(String(error.message || error));
            }

            let blockingConflicts = [];
            if (errors.length === 0 && ACTIVE_STATUSES.has(task.status)) {
                const handoffData = parseHandoffs();
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
                        projected_blocking_conflicts_count:
                            conflictItems.length,
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
                        console.log(
                            JSON.stringify(compactJsonPayload, null, 2)
                        );
                        return;
                    }
                    console.log(
                        JSON.stringify(
                            { ...diffPayload, json_format: 'full' },
                            null,
                            2
                        )
                    );
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
                    diffPayload.apply_projection
                        .projected_blocking_conflicts_error
                ) {
                    console.log(
                        `- projected_conflict_detail: ${diffPayload.apply_projection.projected_blocking_conflicts_error}`
                    );
                }
                return;
            }

            if (wantsJson) {
                console.log(JSON.stringify(basePreviewCheckPayload, null, 2));
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
        const validateOnly = isFlagEnabled(
            flags,
            'validate-only',
            'validate_only'
        );
        const previewMode = isFlagEnabled(
            flags,
            'preview',
            'dry-run',
            'dry_run'
        );
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
            const task = normalizeTaskForCreateApply(
                sourcePayload.task_full || sourcePayload.task
            );
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

            validateTaskGovernancePrechecks(board, task);
            board.tasks.push(task);

            if (ACTIVE_STATUSES.has(task.status)) {
                const handoffData = parseHandoffs();
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

            writeBoardAndSync(board, { silentSync: wantsJson });

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
                executor_source: String(
                    sourcePayload.executor_source || 'apply'
                ),
                scope_source: String(sourcePayload.scope_source || 'apply'),
                risk_source: String(sourcePayload.risk_source || 'apply'),
                preview: false,
                dry_run: false,
                validate_only: false,
                persisted: true,
                task: toTaskJson(task),
                task_full: toTaskFullJson(task),
            };
            if (
                explainInference &&
                Array.isArray(sourcePayload.inference_explanation)
            ) {
                applyPayload.inference_explanation =
                    sourcePayload.inference_explanation;
            }

            if (wantsJson) {
                console.log(JSON.stringify(applyPayload, null, 2));
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

        const status = String(
            flags.status || template?.status || 'backlog'
        ).trim();
        if (!ALLOWED_STATUSES.has(status)) {
            throw new Error(`task create: status invalido (${status})`);
        }

        const files = parseCsvList(flags.files || '');
        if (files.length === 0) {
            throw new Error(
                'task create requiere --files con lista CSV no vacia'
            );
        }

        const fromFilesEnabled = isFlagEnabled(
            flags,
            'from-files',
            'from_files'
        );
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
        if (
            template?.requireCriticalScope &&
            !findCriticalScopeKeyword(scope)
        ) {
            throw new Error(
                `task create: template ${template.name} requiere --scope critico (${CRITICAL_SCOPE_KEYWORDS.join(
                    '|'
                )})`
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
            files,
            acceptance,
            acceptance_ref: acceptanceRef,
            depends_on: dependsOn,
            prompt,
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

        validateTaskGovernancePrechecks(board, task);

        board.tasks.push(task);

        if (ACTIVE_STATUSES.has(status)) {
            const handoffData = parseHandoffs();
            const blockingConflicts = getBlockingConflictsForTask(
                board.tasks,
                newId,
                handoffData.handoffs
            );
            if (blockingConflicts.length > 0) {
                const details = blockingConflicts
                    .map((item) => {
                        const other =
                            String(item.left.id) === newId
                                ? item.right
                                : item.left;
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
            writeBoardAndSync(board, { silentSync: wantsJson });
        }

        if (wantsJson) {
            console.log(JSON.stringify(createPayload, null, 2));
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
        return;
    }

    if (!taskId) {
        throw new Error('Task command requiere task_id');
    }

    assertNonCodexTaskForTaskCommand(taskId);

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    if (normalizedSubcommand === 'claim') {
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
                throw new Error(
                    'task claim --files requiere lista CSV no vacia'
                );
            }
            task.files = files;
        }

        validateTaskGovernancePrechecks(board, task, { allowSelf: true });

        if (ACTIVE_STATUSES.has(String(task.status || '').trim())) {
            const handoffData = parseHandoffs();
            const blockingConflicts = getBlockingConflictsForTask(
                board.tasks,
                taskId,
                handoffData.handoffs
            );
            if (blockingConflicts.length > 0) {
                const details = blockingConflicts
                    .map((item) => {
                        const other =
                            String(item.left.id) === taskId
                                ? item.right
                                : item.left;
                        const files = item.overlap_files.length
                            ? item.overlap_files.join(', ')
                            : '(wildcard ambiguo)';
                        return `${taskId} <-> ${other.id} :: ${files}`;
                    })
                    .join(' | ');
                throw new Error(
                    `task claim bloqueado por conflicto activo: ${details}`
                );
            }
        }

        task.updated_at = currentDate();
        writeBoardAndSync(board, { silentSync: wantsJson });
        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        command: 'task',
                        action: 'claim',
                        task: toTaskJson(task),
                    },
                    null,
                    2
                )
            );
            return;
        }
        console.log(
            `Task claim OK: ${taskId} owner=${task.owner} status=${task.status}`
        );
        return;
    }

    if (normalizedSubcommand === 'start') {
        const nextStatus = String(flags.status || 'in_progress').trim();
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
            task.executor = nextExecutor;
        }
        if (flags.scope) {
            task.scope = String(flags.scope).trim();
        }
        if (flags.files) {
            const files = parseCsvList(flags.files);
            if (files.length === 0) {
                throw new Error(
                    'task start --files requiere lista CSV no vacia'
                );
            }
            task.files = files;
        }

        task.status = nextStatus;
        task.updated_at = currentDate();

        validateTaskGovernancePrechecks(board, task, { allowSelf: true });

        const handoffData = parseHandoffs();
        const blockingConflicts = getBlockingConflictsForTask(
            board.tasks,
            taskId,
            handoffData.handoffs
        );
        if (blockingConflicts.length > 0) {
            const details = blockingConflicts
                .map((item) => {
                    const other =
                        String(item.left.id) === taskId
                            ? item.right
                            : item.left;
                    const files = item.overlap_files.length
                        ? item.overlap_files.join(', ')
                        : '(wildcard ambiguo)';
                    return `${taskId} <-> ${other.id} :: ${files}`;
                })
                .join(' | ');
            throw new Error(
                `task start bloqueado por conflicto activo: ${details}`
            );
        }

        writeBoardAndSync(board, { silentSync: wantsJson });
        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        command: 'task',
                        action: 'start',
                        task: toTaskJson(task),
                    },
                    null,
                    2
                )
            );
            return;
        }
        console.log(`Task start OK: ${taskId} -> ${nextStatus}`);
        return;
    }

    if (normalizedSubcommand === 'finish') {
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
                throw new Error(
                    `No existe evidencia requerida: ${evidencePath}`
                );
            }
            task.acceptance_ref = toRelativeRepoPath(evidencePath);
        }

        task.status = nextStatus;
        task.updated_at = currentDate();
        writeBoardAndSync(board, { silentSync: wantsJson });

        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        command: 'task',
                        action: 'finish',
                        task: toTaskJson(task),
                        evidence_path: evidencePath
                            ? toRelativeRepoPath(evidencePath)
                            : null,
                    },
                    null,
                    2
                )
            );
            return;
        }

        if (nextStatus === 'done') {
            console.log(`Task finish OK: ${taskId} -> done`);
        } else {
            console.log(`Task finish OK: ${taskId} -> failed`);
        }
        return;
    }
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
