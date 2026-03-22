'use strict';

const { readFileSync, existsSync } = require('fs');
const readline = require('readline');
const { resolve } = require('path');

function nextAgentTaskId(tasks) {
    let max = 0;
    for (const task of tasks || []) {
        const match = String(task?.id || '').match(/^AG-(\d+)$/);
        if (!match) continue;
        max = Math.max(max, Number(match[1]));
    }
    return `AG-${String(max + 1).padStart(3, '0')}`;
}

function resolveTaskCreateTemplate(templateNameRaw, options = {}) {
    const templates = options.templates || {};
    const templateName = String(templateNameRaw || '')
        .trim()
        .toLowerCase();
    if (!templateName) return null;
    const template = templates[templateName];
    if (!template) {
        throw new Error(
            `task create: template invalido (${templateName}); disponibles: ${Object.keys(
                templates
            ).join(', ')}`
        );
    }
    return { name: templateName, ...template };
}

function inferTaskCreateFromFiles(files, options = {}) {
    const normalizePathToken =
        options.normalizePathToken || ((v) => String(v || ''));
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : [];
    const inferTaskDomain = options.inferTaskDomain || (() => 'other');
    const findCriticalScopeKeyword =
        options.findCriticalScopeKeyword || (() => null);
    const criticalScopeAllowedExecutors =
        options.criticalScopeAllowedExecutors || new Set();

    const normalizedFiles = Array.isArray(files)
        ? files.map((item) => normalizePathToken(item)).filter(Boolean)
        : [];
    if (normalizedFiles.length === 0) return null;

    const criticalMatches = [];
    for (const keyword of criticalScopeKeywords) {
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
            ? Array.from(criticalScopeAllowedExecutors)
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

function createPromptInterface(wantsJson = false, deps = {}) {
    const stdin = deps.stdin || process.stdin;
    const stdout = deps.stdout || process.stdout;
    const stderr = deps.stderr || process.stderr;
    const rlLib = deps.readline || readline;
    return rlLib.createInterface({
        input: stdin,
        output: wantsJson ? stderr : stdout,
    });
}

function askLine(rl, promptText) {
    return new Promise((resolveAnswer) => {
        rl.question(promptText, (answer) =>
            resolveAnswer(String(answer || ''))
        );
    });
}

async function collectTaskCreateInteractiveFlags(
    flags = {},
    wantsJson = false,
    deps = {}
) {
    const merged = { ...(flags || {}) };
    const proc = deps.processObj || process;
    const readStdin = deps.readFileSync || readFileSync;
    const promptWriter = wantsJson
        ? deps.stderr || process.stderr
        : deps.stdout || process.stdout;
    const createPrompt =
        deps.createPromptInterface || ((wj) => createPromptInterface(wj, deps));
    const ask = deps.askLine || askLine;

    const promptSteps = async (askFn) => {
        if (!String(merged.title || '').trim()) {
            merged.title = (await askFn('Titulo: ')).trim();
        }

        if (!String(merged.template || '').trim()) {
            const answer = (
                await askFn(
                    'Template (docs|bugfix|critical|runtime, enter=none): '
                )
            ).trim();
            if (answer) merged.template = answer;
        }

        if (!String(merged.files || '').trim()) {
            merged.files = (await askFn('Files CSV: ')).trim();
        }

        if (
            !Object.prototype.hasOwnProperty.call(merged, 'from-files') &&
            !Object.prototype.hasOwnProperty.call(merged, 'from_files')
        ) {
            const answer = (
                await askFn('Inferir scope/risk desde files? (y/N): ')
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
            const answer = (await askFn(label)).trim();
            if (answer) merged[key] = answer;
        }
    };

    if (!proc.stdin.isTTY) {
        const bufferedInput = readStdin(0, 'utf8');
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

    const rl = createPrompt(wantsJson);
    try {
        await promptSteps((label) => ask(rl, label));
    } finally {
        rl.close();
    }
    return merged;
}

function normalizeTaskForCreateApply(rawTask, options = {}) {
    const currentDate =
        options.currentDate || (() => new Date().toISOString().slice(0, 10));
    const allowedTaskExecutors = options.allowedTaskExecutors || new Set();
    const allowedStatuses = options.allowedStatuses || new Set();
    const allowedCodexInstances = options.allowedCodexInstances || new Set();
    const allowedDomainLanes = options.allowedDomainLanes || new Set();
    const allowedLaneLocks = options.allowedLaneLocks || new Set();
    const allowedProviderModes = options.allowedProviderModes || new Set();
    const allowedRuntimeSurfaces = options.allowedRuntimeSurfaces || new Set();
    const allowedRuntimeTransports =
        options.allowedRuntimeTransports || new Set();

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
        codex_instance: String(rawTask.codex_instance || '')
            .trim()
            .toLowerCase(),
        domain_lane: String(rawTask.domain_lane || '')
            .trim()
            .toLowerCase(),
        lane_lock: String(rawTask.lane_lock || '')
            .trim()
            .toLowerCase(),
        cross_domain: Boolean(rawTask.cross_domain),
        provider_mode: String(rawTask.provider_mode || '')
            .trim()
            .toLowerCase(),
        runtime_surface: String(rawTask.runtime_surface || '')
            .trim()
            .toLowerCase(),
        runtime_transport: String(rawTask.runtime_transport || '')
            .trim()
            .toLowerCase(),
        runtime_last_transport: String(rawTask.runtime_last_transport || '')
            .trim()
            .toLowerCase(),
        model_tier_default: String(rawTask.model_tier_default || '').trim(),
        premium_budget: Number.parseInt(
            String(rawTask.premium_budget ?? ''),
            10
        ),
        premium_calls_used: Number.parseInt(
            String(rawTask.premium_calls_used ?? ''),
            10
        ),
        premium_gate_state: String(rawTask.premium_gate_state || '')
            .trim()
            .toLowerCase(),
        decision_packet_ref: String(rawTask.decision_packet_ref || '').trim(),
        model_policy_version: String(rawTask.model_policy_version || '').trim(),
        strategy_id: String(rawTask.strategy_id || '').trim(),
        subfront_id: String(rawTask.subfront_id || '').trim(),
        strategy_role: String(rawTask.strategy_role || '')
            .trim()
            .toLowerCase(),
        strategy_reason: String(rawTask.strategy_reason || '').trim(),
        focus_id: String(rawTask.focus_id || '').trim(),
        focus_step: String(rawTask.focus_step || '').trim(),
        integration_slice: String(rawTask.integration_slice || '')
            .trim()
            .toLowerCase(),
        work_type: String(rawTask.work_type || '')
            .trim()
            .toLowerCase(),
        expected_outcome: String(rawTask.expected_outcome || '').trim(),
        decision_ref: String(rawTask.decision_ref || '').trim(),
        rework_parent: String(rawTask.rework_parent || '').trim(),
        rework_reason: String(rawTask.rework_reason || '').trim(),
        workspace_machine_id: String(
            rawTask.workspace_machine_id || ''
        ).trim(),
        workspace_branch: String(rawTask.workspace_branch || '').trim(),
        workspace_head: String(rawTask.workspace_head || '').trim(),
        workspace_origin_main_head: String(
            rawTask.workspace_origin_main_head || ''
        ).trim(),
        workspace_sync_state: String(rawTask.workspace_sync_state || '').trim(),
        workspace_sync_checked_at: String(
            rawTask.workspace_sync_checked_at || ''
        ).trim(),
        files: Array.isArray(rawTask.files)
            ? rawTask.files.map((v) => String(v || '').trim()).filter(Boolean)
            : [],
        source_signal: String(rawTask.source_signal || 'manual')
            .trim()
            .toLowerCase(),
        source_ref: String(rawTask.source_ref || '').trim(),
        priority_score: Number.parseInt(
            String(rawTask.priority_score ?? 0),
            10
        ),
        sla_due_at: String(rawTask.sla_due_at || '').trim(),
        last_attempt_at: String(rawTask.last_attempt_at || '').trim(),
        attempts: Number.parseInt(String(rawTask.attempts ?? 0), 10),
        blocked_reason: String(rawTask.blocked_reason || '').trim(),
        runtime_impact: String(rawTask.runtime_impact || 'low')
            .trim()
            .toLowerCase(),
        critical_zone: Boolean(rawTask.critical_zone),
        acceptance: String(rawTask.acceptance || rawTask.title || '').trim(),
        acceptance_ref: String(rawTask.acceptance_ref || '').trim(),
        evidence_ref: String(rawTask.evidence_ref || '').trim(),
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

    if (!task.domain_lane) {
        task.domain_lane = 'backend_ops';
    }
    if (!task.codex_instance) {
        task.codex_instance =
            task.domain_lane === 'frontend_content'
                ? 'codex_frontend'
                : task.domain_lane === 'transversal_runtime'
                  ? 'codex_transversal'
                  : 'codex_backend_ops';
    }
    if (!task.lane_lock) {
        task.lane_lock = task.cross_domain ? 'handoff_allowed' : 'strict';
    }
    if (
        !task.provider_mode &&
        (task.runtime_surface ||
            task.runtime_transport ||
            task.runtime_last_transport)
    ) {
        task.provider_mode =
            String(task.runtime_surface || '').trim().toLowerCase() ===
            'operator_auth'
                ? 'google_oauth'
                : 'openclaw_chatgpt';
    }

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
    if (
        allowedTaskExecutors.size > 0 &&
        !allowedTaskExecutors.has(task.executor)
    ) {
        throw new Error(
            `task create --apply: executor invalido (${task.executor})`
        );
    }
    if (allowedStatuses.size > 0 && !allowedStatuses.has(task.status)) {
        throw new Error(
            `task create --apply: status invalido (${task.status})`
        );
    }
    if (
        allowedCodexInstances.size > 0 &&
        !allowedCodexInstances.has(task.codex_instance)
    ) {
        throw new Error(
            `task create --apply: codex_instance invalido (${task.codex_instance})`
        );
    }
    if (
        allowedDomainLanes.size > 0 &&
        !allowedDomainLanes.has(task.domain_lane)
    ) {
        throw new Error(
            `task create --apply: domain_lane invalido (${task.domain_lane})`
        );
    }
    if (allowedLaneLocks.size > 0 && !allowedLaneLocks.has(task.lane_lock)) {
        throw new Error(
            `task create --apply: lane_lock invalido (${task.lane_lock})`
        );
    }
    if (
        task.provider_mode &&
        allowedProviderModes.size > 0 &&
        !allowedProviderModes.has(task.provider_mode)
    ) {
        throw new Error(
            `task create --apply: provider_mode invalido (${task.provider_mode})`
        );
    }
    if (
        task.runtime_surface &&
        allowedRuntimeSurfaces.size > 0 &&
        !allowedRuntimeSurfaces.has(task.runtime_surface)
    ) {
        throw new Error(
            `task create --apply: runtime_surface invalido (${task.runtime_surface})`
        );
    }
    if (
        task.runtime_transport &&
        allowedRuntimeTransports.size > 0 &&
        !allowedRuntimeTransports.has(task.runtime_transport)
    ) {
        throw new Error(
            `task create --apply: runtime_transport invalido (${task.runtime_transport})`
        );
    }
    if (
        task.runtime_last_transport &&
        allowedRuntimeTransports.size > 0 &&
        !allowedRuntimeTransports.has(task.runtime_last_transport)
    ) {
        throw new Error(
            `task create --apply: runtime_last_transport invalido (${task.runtime_last_transport})`
        );
    }
    if (!['low', 'medium', 'high'].includes(task.risk)) {
        throw new Error(`task create --apply: risk invalido (${task.risk})`);
    }
    if (!['none', 'low', 'high'].includes(task.runtime_impact)) {
        throw new Error(
            `task create --apply: runtime_impact invalido (${task.runtime_impact})`
        );
    }
    if (!Number.isFinite(task.priority_score)) {
        task.priority_score = 0;
    }
    if (task.priority_score < 0) task.priority_score = 0;
    if (task.priority_score > 100) task.priority_score = 100;
    if (!Number.isFinite(task.attempts) || task.attempts < 0) {
        task.attempts = 0;
    }
    if (!Number.isFinite(task.premium_budget) || task.premium_budget < 0) {
        task.premium_budget = 0;
    }
    if (
        !Number.isFinite(task.premium_calls_used) ||
        task.premium_calls_used < 0
    ) {
        task.premium_calls_used = 0;
    }
    if (task.files.length === 0) {
        throw new Error('task create --apply requiere task.files no vacio');
    }

    return task;
}

function loadTaskCreateApplyPayload(applyPathRaw, options = {}) {
    const modeLabel = String(options.modeLabel || 'task create --apply');
    const rootPath = options.rootPath || process.cwd();
    const readFile = options.readFileSync || readFileSync;
    const fileExists = options.existsSync || existsSync;

    const applyPath = String(applyPathRaw || '').trim();
    if (!applyPath || applyPath === 'true') {
        throw new Error(
            `${modeLabel} requiere ruta al JSON de preview (ej: --apply verification/task-preview.json o - para stdin)`
        );
    }

    let rawJson = '';
    let resolvedPath = null;
    if (applyPath === '-') {
        rawJson = readFile(0, 'utf8');
    } else {
        resolvedPath = resolve(rootPath, applyPath);
        if (!fileExists(resolvedPath)) {
            throw new Error(`No existe archivo de apply: ${resolvedPath}`);
        }
        rawJson = readFile(resolvedPath, 'utf8');
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

function buildTaskCreatePreviewDiff(existingTask, previewTask, options = {}) {
    const toTaskFullJson = options.toTaskFullJson || ((v) => v);
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
        'codex_instance',
        'domain_lane',
        'lane_lock',
        'cross_domain',
        'files',
        'source_signal',
        'source_ref',
        'priority_score',
        'sla_due_at',
        'last_attempt_at',
        'attempts',
        'blocked_reason',
        'runtime_impact',
        'critical_zone',
        'model_tier_default',
        'premium_budget',
        'premium_calls_used',
        'premium_gate_state',
        'decision_packet_ref',
        'model_policy_version',
        'acceptance',
        'acceptance_ref',
        'evidence_ref',
        'strategy_id',
        'subfront_id',
        'strategy_role',
        'strategy_reason',
        'focus_id',
        'focus_step',
        'integration_slice',
        'work_type',
        'expected_outcome',
        'decision_ref',
        'rework_parent',
        'rework_reason',
        'depends_on',
        'prompt',
    ];
    const diffs = [];
    for (const key of keys) {
        const left = before[key];
        const right = after[key];
        if (JSON.stringify(left) === JSON.stringify(right)) continue;
        diffs.push({ field: key, before: left, after: right });
    }
    return diffs;
}

module.exports = {
    nextAgentTaskId,
    resolveTaskCreateTemplate,
    inferTaskCreateFromFiles,
    buildTaskCreateInferenceExplainLines,
    createPromptInterface,
    askLine,
    collectTaskCreateInteractiveFlags,
    normalizeTaskForCreateApply,
    loadTaskCreateApplyPayload,
    summarizeBlockingConflictsForTask,
    formatBlockingConflictSummary,
    buildTaskCreatePreviewDiff,
};
