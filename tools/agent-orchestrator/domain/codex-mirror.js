'use strict';

function buildCodexCheckReport(input = {}, deps = {}) {
    const {
        board,
        blocks,
        codexPlanPath = 'PLAN_MAESTRO_CODEX_2026.md',
    } = input;
    const { normalizePathToken, activeStatuses } = deps;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const codexBlocks = Array.isArray(blocks) ? blocks : [];
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

    if (codexInProgress.length > 1) {
        errors.push(
            `Mas de un CDX in_progress (${codexInProgress.map((t) => t.id).join(', ')})`
        );
    }

    if (codexBlocks.length > 1) {
        errors.push(`Mas de un bloque CODEX_ACTIVE en ${codexPlanPath}`);
    }

    if (codexBlocks.length === 0) {
        if (activeCodexTasks.length > 0) {
            errors.push(
                `Hay tareas CDX activas sin bloque CODEX_ACTIVE: ${activeCodexTasks
                    .map((task) => task.id)
                    .join(', ')}`
            );
        }
    } else {
        const block = codexBlocks[0];
        const taskId = String(block.task_id || '').trim();
        const blockStatus = String(block.status || '').trim();
        const blockFiles = Array.isArray(block.files)
            ? block.files.map(normalizePathToken)
            : [];
        const task = tasks.find((item) => String(item.id) === taskId);

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

        if (activeCodexTasks.length === 0 && activeStatuses.has(blockStatus)) {
            errors.push(
                'CODEX_ACTIVE indica tarea activa pero no hay CDX activo en board'
            );
        }
    }

    const activeBlock = codexBlocks[0] || null;
    const activeBlockTaskId = activeBlock
        ? String(activeBlock.task_id || '').trim()
        : '';
    const activeBlockTask = activeBlockTaskId
        ? tasks.find((item) => String(item.id) === activeBlockTaskId) || null
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
            plan_blocks: codexBlocks.length,
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

module.exports = {
    buildCodexCheckReport,
};
