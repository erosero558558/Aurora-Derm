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
                await askFn('Template (docs|bugfix|critical, enter=none): ')
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
