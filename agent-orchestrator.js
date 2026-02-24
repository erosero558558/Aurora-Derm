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
 *   node agent-orchestrator.js codex-check
 *   node agent-orchestrator.js codex <start|stop> <CDX-ID> [--block C1] [--to done]
 *   node agent-orchestrator.js task <claim|start|finish> <AG-ID> [...]
 *   node agent-orchestrator.js sync
 *   node agent-orchestrator.js close <task_id> [--evidence path]
 *   node agent-orchestrator.js metrics [--json] [--profile local|ci] [--write|--no-write] [--dry-run]
 */

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { resolve, dirname } = require('path');

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
let GOVERNANCE_POLICY_CACHE = null;

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

function normalizeEol(value) {
    return value.replace(/\r\n/g, '\n');
}

function shallowMerge(target, source) {
    const out = { ...(target || {}) };
    for (const [key, value] of Object.entries(source || {})) {
        const existing = out[key];
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            existing &&
            typeof existing === 'object' &&
            !Array.isArray(existing)
        ) {
            out[key] = shallowMerge(existing, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function getGovernancePolicy() {
    if (GOVERNANCE_POLICY_CACHE) return GOVERNANCE_POLICY_CACHE;
    let loaded = null;
    if (existsSync(GOVERNANCE_POLICY_PATH)) {
        try {
            loaded = JSON.parse(readFileSync(GOVERNANCE_POLICY_PATH, 'utf8'));
        } catch {
            loaded = null;
        }
    }
    GOVERNANCE_POLICY_CACHE = shallowMerge(DEFAULT_GOVERNANCE_POLICY, loaded);
    return GOVERNANCE_POLICY_CACHE;
}

function unquote(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
    return trimmed;
}

function parseInlineArray(value) {
    const trimmed = value.trim();
    if (trimmed === '[]') return [];
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        return [unquote(trimmed)];
    }

    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];

    return body
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((entry) => unquote(entry))
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseScalar(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === '[]') return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']'))
        return parseInlineArray(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"'))
        return unquote(trimmed);
    return trimmed;
}

function parseBoard() {
    if (!existsSync(BOARD_PATH)) {
        throw new Error(`No existe ${BOARD_PATH}`);
    }

    const lines = normalizeEol(readFileSync(BOARD_PATH, 'utf8')).split('\n');
    const board = {
        version: 1,
        policy: {},
        tasks: [],
    };

    let inPolicy = false;
    let inTasks = false;
    let task = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === 'policy:') {
            inPolicy = true;
            inTasks = false;
            continue;
        }

        if (trimmed === 'tasks:') {
            inTasks = true;
            inPolicy = false;
            if (task) {
                board.tasks.push(task);
                task = null;
            }
            continue;
        }

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inPolicy && !inTasks) {
            board.version = parseScalar(versionMatch[1]);
            continue;
        }

        if (inPolicy) {
            const policyMatch = line.match(/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (policyMatch) {
                board.policy[policyMatch[1]] = parseScalar(policyMatch[2]);
            }
            continue;
        }

        if (inTasks) {
            const taskStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
            if (taskStart) {
                if (task) board.tasks.push(task);
                task = { id: parseScalar(taskStart[1]) };
                continue;
            }

            const taskProp = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (task && taskProp) {
                task[taskProp[1]] = parseScalar(taskProp[2]);
            }
        }
    }

    if (task) board.tasks.push(task);

    for (const item of board.tasks) {
        if (!Array.isArray(item.files))
            item.files = item.files ? [String(item.files)] : [];
        if (!Array.isArray(item.depends_on)) {
            item.depends_on = item.depends_on ? [String(item.depends_on)] : [];
        }
        item.status = String(item.status || '').trim();
        if (!ALLOWED_STATUSES.has(item.status)) {
            throw new Error(
                `Estado no permitido en ${item.id}: ${item.status}`
            );
        }
    }

    return board;
}

function parseHandoffs() {
    if (!existsSync(HANDOFFS_PATH)) {
        return { version: 1, handoffs: [] };
    }

    const lines = normalizeEol(readFileSync(HANDOFFS_PATH, 'utf8')).split('\n');
    const data = {
        version: 1,
        handoffs: [],
    };

    let inHandoffs = false;
    let handoff = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inHandoffs) {
            data.version = parseScalar(versionMatch[1]);
            continue;
        }

        if (trimmed === 'handoffs:') {
            inHandoffs = true;
            if (handoff) {
                data.handoffs.push(handoff);
                handoff = null;
            }
            continue;
        }

        if (!inHandoffs) continue;

        const handoffStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
        if (handoffStart) {
            if (handoff) data.handoffs.push(handoff);
            handoff = { id: parseScalar(handoffStart[1]) };
            continue;
        }

        const prop = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (handoff && prop) {
            handoff[prop[1]] = parseScalar(prop[2]);
        }
    }

    if (handoff) data.handoffs.push(handoff);

    for (const item of data.handoffs) {
        if (!Array.isArray(item.files))
            item.files = item.files ? [String(item.files)] : [];
        item.status = String(item.status || '')
            .trim()
            .toLowerCase();
    }

    return data;
}

function parseCodexActiveBlocks() {
    if (!existsSync(CODEX_PLAN_PATH)) {
        return [];
    }

    const raw = normalizeEol(readFileSync(CODEX_PLAN_PATH, 'utf8'));
    const regex = /<!--\s*CODEX_ACTIVE\s*\n([\s\S]*?)-->/g;
    const blocks = [];
    let match;

    while ((match = regex.exec(raw)) !== null) {
        const block = {};
        for (const line of match[1].split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const prop = trimmed.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (!prop) continue;
            block[prop[1]] = parseScalar(prop[2]);
        }
        if (!Array.isArray(block.files)) {
            block.files = block.files ? [String(block.files)] : [];
        }
        blocks.push(block);
    }

    return blocks;
}

function serializeHandoffs(data) {
    const safe = data || { version: 1, handoffs: [] };
    const lines = [];
    lines.push(`version: ${safe.version || 1}`);
    lines.push('handoffs:');

    const handoffs = Array.isArray(safe.handoffs) ? safe.handoffs : [];
    for (const handoff of handoffs) {
        lines.push(`  - id: ${handoff.id}`);
        lines.push(`    status: ${handoff.status || 'active'}`);
        lines.push(`    from_task: ${handoff.from_task || ''}`);
        lines.push(`    to_task: ${handoff.to_task || ''}`);
        lines.push(`    reason: ${handoff.reason || ''}`);
        lines.push(`    files: ${serializeArrayInline(handoff.files || [])}`);
        lines.push(`    approved_by: ${handoff.approved_by || ''}`);
        lines.push(`    created_at: ${handoff.created_at || ''}`);
        lines.push(`    expires_at: ${handoff.expires_at || ''}`);
        if (handoff.closed_at) {
            lines.push(`    closed_at: ${handoff.closed_at}`);
        }
        if (handoff.close_reason) {
            lines.push(`    close_reason: ${quote(handoff.close_reason)}`);
        }
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function parseFlags(args) {
    const positionals = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = String(args[i]);
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next === undefined || String(next).startsWith('--')) {
            flags[key] = true;
            continue;
        }
        flags[key] = String(next);
        i += 1;
    }
    return { positionals, flags };
}

function parseCsvList(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function isoNow() {
    return new Date().toISOString();
}

function plusHoursIso(hours) {
    const safeHours = Number.isFinite(Number(hours)) ? Number(hours) : 24;
    return new Date(Date.now() + safeHours * 60 * 60 * 1000).toISOString();
}

function ensureTask(board, taskId) {
    const task = board.tasks.find((item) => String(item.id) === String(taskId));
    if (!task) {
        throw new Error(`No existe task_id ${taskId} en AGENT_BOARD.yaml`);
    }
    return task;
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

function quote(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
}

function serializeArrayInline(values) {
    if (!Array.isArray(values) || values.length === 0) return '[]';
    return `[${values.map((v) => quote(v)).join(', ')}]`;
}

function serializeBoard(board) {
    const lines = [];
    lines.push(`version: ${board.version}`);
    lines.push('policy:');
    lines.push(`  canonical: ${board.policy.canonical || 'AGENTS.md'}`);
    lines.push(
        `  autonomy: ${board.policy.autonomy || 'semi_autonomous_guardrails'}`
    );
    lines.push(`  kpi: ${board.policy.kpi || 'reduce_rework'}`);
    lines.push(`  updated_at: ${board.policy.updated_at || currentDate()}`);
    lines.push('');
    lines.push('tasks:');

    for (const task of board.tasks) {
        lines.push(`  - id: ${task.id}`);
        lines.push(`    title: ${quote(task.title || '')}`);
        lines.push(`    owner: ${task.owner || 'unassigned'}`);
        lines.push(`    executor: ${task.executor || 'codex'}`);
        lines.push(`    status: ${task.status || 'backlog'}`);
        lines.push(`    risk: ${task.risk || 'medium'}`);
        lines.push(`    scope: ${task.scope || 'general'}`);
        lines.push(`    files: ${serializeArrayInline(task.files || [])}`);
        lines.push(`    acceptance: ${quote(task.acceptance || '')}`);
        lines.push(`    acceptance_ref: ${quote(task.acceptance_ref || '')}`);
        lines.push(
            `    depends_on: ${serializeArrayInline(task.depends_on || [])}`
        );
        lines.push(`    prompt: ${quote(task.prompt || task.title || '')}`);
        lines.push(`    created_at: ${task.created_at || currentDate()}`);
        lines.push(`    updated_at: ${task.updated_at || currentDate()}`);
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function currentDate() {
    return new Date().toISOString().slice(0, 10);
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

function filesOverlap(filesA, filesB) {
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

function detectConflicts(tasks, handoffs = []) {
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

function cmdStatus(args) {
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

    if (args.includes('--json')) {
        console.log(JSON.stringify(data, null, 2));
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
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function cmdMetrics(args = []) {
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

function cmdTask(args) {
    const subcommand = args[0];
    const { positionals, flags } = parseFlags(args.slice(1));
    const wantsJson = args.includes('--json');
    const taskId = String(positionals[0] || flags.id || '').trim();

    if (!subcommand || !['claim', 'start', 'finish'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js task <claim|start|finish> <AG-001> [--owner x] [--executor y] [--status z] [--files a,b] [--evidence path]'
        );
    }

    if (!taskId) {
        throw new Error('Task command requiere task_id');
    }

    assertNonCodexTaskForTaskCommand(taskId);

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    if (subcommand === 'claim') {
        const owner = detectDefaultOwner(task.owner);
        const ownerOverride = flags.owner ? String(flags.owner).trim() : owner;
        if (!ownerOverride) {
            throw new Error(
                'task claim requiere --owner o variable AGENT_OWNER/USERNAME/USER'
            );
        }
        task.owner = ownerOverride;

        if (flags.executor) {
            task.executor = String(flags.executor).trim();
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

    if (subcommand === 'start') {
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
            task.executor = String(flags.executor).trim();
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

    if (subcommand === 'finish') {
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

function main() {
    const [command = 'status', ...args] = process.argv.slice(2);
    const commands = {
        status: () => cmdStatus(args),
        conflicts: () => cmdConflicts(args),
        handoffs: () => cmdHandoffs(args),
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
    commands[command]();
}

try {
    main();
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
}
