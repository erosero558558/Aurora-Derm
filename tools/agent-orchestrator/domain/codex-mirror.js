'use strict';

function serializeBlock(block, deps = {}) {
    const {
        serializeArrayInline = (values) =>
            JSON.stringify(Array.isArray(values) ? values : []),
        currentDate = () => '',
    } = deps;
    if (!block) return '';
    const lines = [];
    lines.push('<!-- CODEX_ACTIVE');
    lines.push(
        `codex_instance: ${block.codex_instance || 'codex_backend_ops'}`
    );
    lines.push(`block: ${block.block || 'C1'}`);
    lines.push(`task_id: ${block.task_id}`);
    lines.push(`status: ${block.status}`);
    lines.push(`files: ${serializeArrayInline(block.files || [])}`);
    lines.push(`updated_at: ${block.updated_at || currentDate()}`);
    lines.push('-->');
    return lines.join('\n');
}

function parseBlocks(raw = '') {
    const regex = /<!--\s*CODEX_ACTIVE\s*\n([\s\S]*?)-->\s*/g;
    const blocks = [];
    let match;
    while ((match = regex.exec(String(raw || ''))) !== null) {
        const block = {};
        for (const line of String(match[1] || '').split('\n')) {
            const prop = line.trim().match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (!prop) continue;
            const key = prop[1];
            const value = String(prop[2] || '').trim();
            if (key === 'files') {
                try {
                    block.files = JSON.parse(value);
                } catch {
                    block.files = value ? [value] : [];
                }
            } else {
                block[key] = value;
            }
        }
        if (!Array.isArray(block.files)) {
            block.files = block.files ? [String(block.files)] : [];
        }
        block.codex_instance = String(
            block.codex_instance || 'codex_backend_ops'
        )
            .trim()
            .toLowerCase();
        blocks.push(block);
    }
    return blocks;
}

function upsertCodexActiveBlock(planRaw, block, deps = {}) {
    const {
        buildComment = (value) => serializeBlock(value, deps),
        anchorText = 'Relacion con Operativo 2026:',
        codexInstance = block?.codex_instance || null,
    } = deps;
    const withoutBlocks = String(planRaw || '').replace(
        /<!--\s*CODEX_ACTIVE\s*\n[\s\S]*?-->\s*/g,
        ''
    );
    const existingBlocks = parseBlocks(planRaw).filter((item) => {
        if (!codexInstance) return false;
        return (
            String(item.codex_instance || 'codex_backend_ops') !==
            String(codexInstance || 'codex_backend_ops')
        );
    });
    const nextBlocks = block ? [...existingBlocks, block] : existingBlocks;
    nextBlocks.sort((left, right) =>
        String(left.codex_instance || '').localeCompare(
            String(right.codex_instance || '')
        )
    );
    const comments = nextBlocks.map((item) => buildComment(item)).join('\n\n');
    if (!comments) {
        return withoutBlocks.replace(/\n{3,}/g, '\n\n');
    }

    const comment = `${comments}\n\n`;
    const anchorIndex = withoutBlocks.indexOf(anchorText);
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

function buildCodexCheckReport(input = {}, deps = {}) {
    const {
        board,
        blocks,
        handoffs,
        codexPlanPath = 'PLAN_MAESTRO_CODEX_2026.md',
    } = input;
    const { normalizePathToken, activeStatuses, isExpired } = deps;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const codexBlocks = Array.isArray(blocks) ? blocks : [];
    const safeHandoffs = Array.isArray(handoffs) ? handoffs : [];
    const isExpiredFn =
        typeof isExpired === 'function'
            ? isExpired
            : (value) => {
                  const parsed = Date.parse(String(value || ''));
                  if (!Number.isFinite(parsed)) return true;
                  return parsed <= Date.now();
              };
    const errors = [];
    const codexTasks = tasks.filter((task) =>
        /^CDX-\d+$/.test(String(task.id || ''))
    );
    const codexInProgress = codexTasks.filter(
        (task) => task.status === 'in_progress'
    );
    const activeCodexTasks = codexTasks.filter((task) =>
        activeStatuses.has(task.status)
    );
    const codexExecutionTasks = tasks.filter(
        (task) =>
            String(task?.executor || '')
                .trim()
                .toLowerCase() === 'codex'
    );
    const codexInProgressByInstance = codexExecutionTasks
        .filter((task) => String(task?.status || '') === 'in_progress')
        .reduce((acc, task) => {
            const key = String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

    for (const [instance, count] of Object.entries(codexInProgressByInstance)) {
        if (count > 1) {
            errors.push(
                `Mas de una tarea in_progress para ${instance} (${count})`
            );
        }
    }

    const seenBlockInstances = new Map();
    for (const block of codexBlocks) {
        const instance = String(block?.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        seenBlockInstances.set(instance, (seenBlockInstances.get(instance) || 0) + 1);
    }
    for (const [instance, count] of seenBlockInstances.entries()) {
        if (count > 1) {
            errors.push(
                `Mas de un bloque CODEX_ACTIVE para ${instance} en ${codexPlanPath}`
            );
        }
    }
    if (codexBlocks.length > 2) {
        errors.push(`Mas de dos bloques CODEX_ACTIVE en ${codexPlanPath}`);
    }

    for (const task of tasks) {
        const taskId = String(task?.id || '');
        const runtimeImpact = String(task?.runtime_impact || '')
            .trim()
            .toLowerCase();
        const isCritical =
            Boolean(task?.critical_zone) || runtimeImpact === 'high';
        if (
            isCritical &&
            String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase() !== 'codex_backend_ops'
        ) {
            errors.push(
                `${taskId || '(sin id)'}: critical_zone/runtime high requiere codex_instance=codex_backend_ops`
            );
        }
    }

    const activeCrossDomainTasks = tasks.filter(
        (task) =>
            Boolean(task?.cross_domain) &&
            activeStatuses.has(String(task?.status || '').trim())
    );
    for (const task of activeCrossDomainTasks) {
        const taskId = String(task?.id || '');
        const hasActiveHandoff = safeHandoffs.some((handoff) => {
            if (String(handoff?.status || '').toLowerCase() !== 'active')
                return false;
            if (isExpiredFn(handoff?.expires_at)) return false;
            return (
                String(handoff?.from_task || '') === taskId ||
                String(handoff?.to_task || '') === taskId
            );
        });
        if (!hasActiveHandoff) {
            errors.push(
                `${taskId || '(sin id)'}: cross_domain activo requiere handoff activo`
            );
        }
    }

    const blockByInstance = new Map(
        codexBlocks.map((block) => [
            String(block.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase(),
            block,
        ])
    );

    for (const task of activeCodexTasks) {
        const instance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const block = blockByInstance.get(instance);
        if (!block) {
            errors.push(
                `Hay tarea CDX activa sin bloque CODEX_ACTIVE para ${instance}: ${task.id}`
            );
            continue;
        }
        if (String(block.task_id || '').trim() !== String(task.id || '').trim()) {
            errors.push(
                `${instance}: task_id desalineado plan(${String(block.task_id || '')}) != board(${task.id})`
            );
            continue;
        }
        if (String(block.status || '').trim() !== String(task.status || '').trim()) {
            errors.push(
                `${task.id}: status desalineado plan(${String(block.status || '')}) != board(${task.status})`
            );
        }
        const blockFiles = Array.isArray(block.files)
            ? block.files.map(normalizePathToken)
            : [];
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

    for (const block of codexBlocks) {
        const taskId = String(block.task_id || '').trim();
        const instance = String(block.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const task = tasks.find((item) => String(item.id || '') === taskId);
        if (!taskId) {
            errors.push(`CODEX_ACTIVE.task_id vacio para ${instance}`);
            continue;
        }
        if (!/^CDX-\d+$/.test(taskId)) {
            errors.push(`CODEX_ACTIVE.task_id invalido (${taskId || 'vacio'})`);
            continue;
        }
        if (!task) {
            errors.push(`CODEX_ACTIVE.task_id no existe en board: ${taskId}`);
            continue;
        }
        if (String(task.executor || '') !== 'codex') {
            errors.push(
                `${task.id}: executor debe ser codex (actual: ${task.executor})`
            );
        }
        if (
            String(task.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase() !== instance
        ) {
            errors.push(
                `${task.id}: codex_instance desalineado plan(${instance}) != board(${task.codex_instance || 'codex_backend_ops'})`
            );
        }
    }

    return {
        version: 1,
        ok: errors.length === 0,
        error_count: errors.length,
        errors,
        summary: {
            codex_tasks_total: codexTasks.length,
            codex_executor_tasks_total: codexExecutionTasks.length,
            codex_in_progress: codexInProgress.length,
            codex_active: activeCodexTasks.length,
            plan_blocks: codexBlocks.length,
            codex_in_progress_by_instance: codexInProgressByInstance,
        },
        codex_task_ids: codexTasks.map((task) => String(task.id)),
        codex_in_progress_ids: codexInProgress.map((task) => String(task.id)),
        codex_active_ids: activeCodexTasks.map((task) => String(task.id)),
        plan_blocks: codexBlocks.map((block) => ({
            codex_instance: String(block.codex_instance || ''),
            block: String(block.block || ''),
            task_id: String(block.task_id || ''),
            status: String(block.status || ''),
            files: Array.isArray(block.files) ? block.files : [],
            updated_at: String(block.updated_at || ''),
        })),
    };
}

module.exports = {
    buildCodexActiveComment: serializeBlock,
    upsertCodexActiveBlock,
    buildCodexCheckReport,
};
