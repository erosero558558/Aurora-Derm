'use strict';

const {
    findAlignedActiveCodexMirrorTasks,
    isAgentCodexTaskId,
    isActiveTaskStatus,
    isCodexMirrorTaskId,
    isOpenClawRuntimeTask,
    mapLaneToCodexInstance,
} = require('./task-guards');
const domainStrategy = require('./strategy');

const DEFAULT_SLOT_STATUSES = new Set(['in_progress', 'review', 'blocked']);

function normalizeStatusesSet(statuses, fallbackStatuses) {
    const safeFallback = Array.from(
        fallbackStatuses || DEFAULT_SLOT_STATUSES
    ).map((value) => String(value || '').trim());
    const safeStatuses = Array.isArray(statuses)
        ? statuses
        : statuses instanceof Set
          ? Array.from(statuses)
          : [];
    const normalized = safeStatuses
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    return new Set(normalized.length > 0 ? normalized : safeFallback);
}

function normalizeCodexParallelism(parallelism = {}) {
    const defaultCapacities = {
        codex_backend_ops: 2,
        codex_frontend: 2,
        codex_transversal: 2,
    };
    const slotStatuses = normalizeStatusesSet(
        parallelism?.slot_statuses,
        DEFAULT_SLOT_STATUSES
    );
    const byCodexInstance = {};
    for (const codexInstance of domainStrategy.DEFAULT_CODEX_INSTANCES) {
        const rawValue = Number.parseInt(
            String(parallelism?.by_codex_instance?.[codexInstance] ?? ''),
            10
        );
        byCodexInstance[codexInstance] =
            Number.isInteger(rawValue) && rawValue > 0
                ? rawValue
                : defaultCapacities[codexInstance];
    }
    return {
        slot_statuses: Array.from(slotStatuses),
        by_codex_instance: byCodexInstance,
        total_capacity: Object.values(byCodexInstance).reduce(
            (acc, value) => acc + Number(value || 0),
            0
        ),
    };
}

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
    if (String(block.subfront_id || '').trim()) {
        lines.push(`subfront_id: ${block.subfront_id}`);
    }
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
        block.subfront_id = String(block.subfront_id || '').trim();
        blocks.push(block);
    }
    return blocks;
}

function upsertCodexActiveBlock(planRaw, block, deps = {}) {
    const {
        buildComment = (value) => serializeBlock(value, deps),
        anchorText = 'Relacion con Operativo 2026:',
        codexInstance = block?.codex_instance ||
            deps.codex_instance ||
            deps.codexInstance ||
            null,
        taskId = block?.task_id || deps.task_id || deps.taskId || null,
    } = deps;
    const withoutBlocks = String(planRaw || '').replace(
        /<!--\s*CODEX_ACTIVE\s*\n[\s\S]*?-->\s*/g,
        ''
    );
    const existingBlocks = parseBlocks(planRaw).filter((item) => {
        if (!block && !taskId && !codexInstance) {
            return false;
        }
        const sameTask =
            taskId &&
            String(item.task_id || '').trim() === String(taskId || '').trim();
        if (sameTask) {
            return false;
        }
        if (!taskId && codexInstance) {
            return (
                String(item.codex_instance || 'codex_backend_ops') !==
                String(codexInstance || 'codex_backend_ops')
            );
        }
        return true;
    });
    const nextBlocks = block ? [...existingBlocks, block] : existingBlocks;
    nextBlocks.sort((left, right) => {
        const byInstance = String(left.codex_instance || '').localeCompare(
            String(right.codex_instance || '')
        );
        if (byInstance !== 0) return byInstance;
        const byTaskId = String(left.task_id || '').localeCompare(
            String(right.task_id || '')
        );
        if (byTaskId !== 0) return byTaskId;
        return String(left.block || '').localeCompare(
            String(right.block || '')
        );
    });
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

function collectActiveCodexSupportCoverage(board, options = {}) {
    const activeStatuses = normalizeStatusesSet(
        options.activeStatuses,
        DEFAULT_SLOT_STATUSES
    );
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const rows = [];

    for (const task of tasks) {
        if (!isAgentCodexTaskId(task?.id)) continue;
        if (
            String(task?.executor || '')
                .trim()
                .toLowerCase() !== 'codex'
        ) {
            continue;
        }
        if (!isActiveTaskStatus(task, activeStatuses)) continue;

        const taskId = String(task?.id || '').trim();
        const dependsOn = Array.isArray(task?.depends_on) ? task.depends_on : [];
        const declaredCdxIds = dependsOn
            .map((value) => String(value || '').trim())
            .filter((value) => isCodexMirrorTaskId(value));
        const alignedActiveMirrorTasks = findAlignedActiveCodexMirrorTasks(
            board,
            task,
            {
                activeStatuses,
            }
        );
        const alignedActiveMirrorIds = alignedActiveMirrorTasks.map(
            (candidate) => String(candidate?.id || '').trim()
        );
        const matchedMirrorIds = alignedActiveMirrorIds.filter((candidateId) =>
            declaredCdxIds.includes(candidateId)
        );

        if (matchedMirrorIds.length > 0) {
            continue;
        }

        const strategyRole = String(task?.strategy_role || '')
            .trim()
            .toLowerCase();
        let code = 'codex_active_without_cdx_mirror';
        let message = `${taskId}: AG activa con executor=codex requiere depends_on a CDX-* activa alineada`;
        if (alignedActiveMirrorIds.length > 0) {
            if (declaredCdxIds.length > 0) {
                message = `${taskId}: depends_on debe apuntar a CDX-* activa alineada (${alignedActiveMirrorIds.join(', ')})`;
            } else {
                message = `${taskId}: AG activa con executor=codex requiere depends_on a CDX-* activa alineada (${alignedActiveMirrorIds.join(', ')})`;
            }
        } else if (strategyRole === 'support') {
            code = 'codex_support_without_active_cdx';
            message = `${taskId}: soporte Codex activo requiere al menos una CDX-* activa alineada por lane/subfront`;
        } else {
            message = `${taskId}: AG activa con executor=codex requiere CDX-* activa alineada por lane/subfront`;
        }

        rows.push({
            task_id: taskId,
            code,
            message,
            strategy_role: strategyRole,
            codex_instance: String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase(),
            domain_lane: String(task?.domain_lane || 'backend_ops')
                .trim()
                .toLowerCase(),
            strategy_id: String(task?.strategy_id || '').trim(),
            subfront_id: String(task?.subfront_id || '').trim(),
            declared_cdx_ids: declaredCdxIds,
            aligned_active_cdx_ids: alignedActiveMirrorIds,
        });
    }

    const byCode = rows.reduce((acc, row) => {
        const key = String(row?.code || 'unknown');
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
    }, {});

    return {
        rows,
        total: rows.length,
        by_code: byCode,
        active_ag_codex_tasks_total: tasks.filter(
            (task) =>
                isAgentCodexTaskId(task?.id) &&
                String(task?.executor || '')
                    .trim()
                    .toLowerCase() === 'codex' &&
                isActiveTaskStatus(task, activeStatuses)
        ).length,
        active_cdx_tasks_total: tasks.filter(
            (task) =>
                isCodexMirrorTaskId(task?.id) &&
                String(task?.executor || '')
                    .trim()
                    .toLowerCase() === 'codex' &&
                isActiveTaskStatus(task, activeStatuses)
        ).length,
    };
}

function buildCodexCheckReport(input = {}, deps = {}) {
    const {
        board,
        blocks,
        strategyBlocks,
        handoffs,
        codexPlanPath = 'PLAN_MAESTRO_CODEX_2026.md',
    } = input;
    const {
        normalizePathToken,
        activeStatuses,
        slotStatuses,
        isExpired,
        findCriticalScopeKeyword = () => null,
        codexParallelism,
    } = deps;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const codexBlocks = (Array.isArray(blocks) ? blocks : []).map((block) => ({
        ...block,
        codex_instance: String(block?.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase(),
        subfront_id: String(block?.subfront_id || '').trim(),
        files: Array.isArray(block?.files) ? block.files : [],
    }));
    const codexStrategyBlocks = strategyBlocks || {};
    const codexStrategyActiveBlocks = Array.isArray(codexStrategyBlocks.active)
        ? codexStrategyBlocks.active
        : Array.isArray(strategyBlocks)
          ? strategyBlocks
          : [];
    const codexStrategyNextBlocks = Array.isArray(codexStrategyBlocks.next)
        ? codexStrategyBlocks.next
        : [];
    const safeHandoffs = Array.isArray(handoffs) ? handoffs : [];
    const normalizedParallelism = normalizeCodexParallelism(codexParallelism);
    const slotStatusesSet = normalizeStatusesSet(
        slotStatuses,
        normalizedParallelism.slot_statuses
    );
    const isExpiredFn =
        typeof isExpired === 'function'
            ? isExpired
            : (value) => {
                  const parsed = Date.parse(String(value || ''));
                  if (!Number.isFinite(parsed)) return true;
                  return parsed <= Date.now();
              };
    const errors = [];
    const strategyConfigErrors = domainStrategy.validateStrategyConfiguration(
        board,
        {
            allowedCodexInstances: domainStrategy.DEFAULT_CODEX_INSTANCES,
        }
    );
    errors.push(...strategyConfigErrors);
    const codexTasks = tasks.filter((task) =>
        /^CDX-\d+$/.test(String(task.id || ''))
    );
    const codexInProgress = codexTasks.filter(
        (task) => task.status === 'in_progress'
    );
    const activeCodexTasks = codexTasks.filter((task) =>
        activeStatuses.has(task.status)
    );
    const slotCodexTasks = codexTasks.filter((task) =>
        slotStatusesSet.has(String(task?.status || '').trim())
    );
    const codexExecutionTasks = tasks.filter(
        (task) =>
            String(task?.executor || '')
                .trim()
                .toLowerCase() === 'codex'
    );
    const supportCoverage = collectActiveCodexSupportCoverage(board, {
        activeStatuses,
    });
    const codexSlotTasksByInstance = codexExecutionTasks
        .filter((task) =>
            slotStatusesSet.has(String(task?.status || '').trim())
        )
        .reduce((acc, task) => {
            const key = String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase();
            acc[key] = [
                ...(Array.isArray(acc[key]) ? acc[key] : []),
                String(task?.id || ''),
            ];
            return acc;
        }, {});

    const codexInProgressByInstance = codexExecutionTasks
        .filter((task) => String(task?.status || '').trim() === 'in_progress')
        .reduce((acc, task) => {
            const key = String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

    for (const [instance, taskIds] of Object.entries(
        codexSlotTasksByInstance
    )) {
        const laneCapacity = Number(
            normalizedParallelism.by_codex_instance?.[instance] || 0
        );
        if (taskIds.length > laneCapacity) {
            errors.push(
                `Mas de ${laneCapacity} slot(s) ocupados para ${instance} (${taskIds.length}): ${taskIds.join(', ')}`
            );
        }
    }

    const seenBlockTaskIds = new Map();
    const blockCountsByInstance = new Map();
    for (const block of codexBlocks) {
        const taskId = String(block?.task_id || '').trim();
        const instance = String(block?.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        if (taskId) {
            seenBlockTaskIds.set(
                taskId,
                (seenBlockTaskIds.get(taskId) || 0) + 1
            );
        }
        blockCountsByInstance.set(
            instance,
            (blockCountsByInstance.get(instance) || 0) + 1
        );
    }
    for (const [taskId, count] of seenBlockTaskIds.entries()) {
        if (count > 1) {
            errors.push(
                `Mas de un bloque CODEX_ACTIVE para ${taskId} en ${codexPlanPath}`
            );
        }
    }
    for (const [instance, count] of blockCountsByInstance.entries()) {
        const laneCapacity = Number(
            normalizedParallelism.by_codex_instance?.[instance] || 0
        );
        if (count > laneCapacity) {
            errors.push(
                `Mas de ${laneCapacity} bloques CODEX_ACTIVE para ${instance} en ${codexPlanPath}`
            );
        }
    }
    if (codexBlocks.length > normalizedParallelism.total_capacity) {
        errors.push(
            `Mas de ${normalizedParallelism.total_capacity} bloques CODEX_ACTIVE en ${codexPlanPath}`
        );
    }

    for (const task of tasks) {
        const taskId = String(task?.id || '');
        const runtimeImpact = String(task?.runtime_impact || '')
            .trim()
            .toLowerCase();
        const isCritical =
            Boolean(task?.critical_zone) || runtimeImpact === 'high';
        const isRuntimeTask = isOpenClawRuntimeTask(task);
        if (
            isCritical &&
            !isRuntimeTask &&
            String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase() !== 'codex_backend_ops'
        ) {
            errors.push(
                `${taskId || '(sin id)'}: critical_zone/runtime high requiere codex_instance=codex_backend_ops`
            );
        }
        if (
            isRuntimeTask &&
            String(task?.codex_instance || '')
                .trim()
                .toLowerCase() !== 'codex_transversal'
        ) {
            errors.push(
                `${taskId || '(sin id)'}: runtime OpenClaw requiere codex_instance=codex_transversal`
            );
        }
        const expectedInstance = mapLaneToCodexInstance(
            task?.domain_lane || ''
        );
        const actualInstance = String(
            task?.codex_instance || 'codex_backend_ops'
        )
            .trim()
            .toLowerCase();
        if (
            String(task?.domain_lane || '').trim() &&
            actualInstance !== expectedInstance
        ) {
            errors.push(
                `${taskId || '(sin id)'}: domain_lane=${String(task?.domain_lane || '')} requiere codex_instance=${expectedInstance}`
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

    for (const row of supportCoverage.rows) {
        errors.push(row.message);
    }

    const blockByTaskId = new Map(
        codexBlocks.map((block) => [String(block.task_id || '').trim(), block])
    );

    for (const task of slotCodexTasks) {
        const instance = String(task.codex_instance || 'codex_backend_ops')
            .trim()
            .toLowerCase();
        const block = blockByTaskId.get(String(task.id || '').trim());
        if (!block) {
            errors.push(
                `Hay tarea CDX consumiendo slot sin bloque CODEX_ACTIVE para ${task.id}`
            );
            continue;
        }
        if (
            String(block.status || '').trim() !==
            String(task.status || '').trim()
        ) {
            errors.push(
                `${task.id}: status desalineado plan(${String(block.status || '')}) != board(${task.status})`
            );
        }
        const blockFiles = Array.isArray(block.files)
            ? block.files.map(normalizePathToken)
            : [];
        const boardFiles = new Set((task.files || []).map(normalizePathToken));
        if (
            String(block.codex_instance || '')
                .trim()
                .toLowerCase() !== instance
        ) {
            errors.push(
                `${task.id}: codex_instance desalineado plan(${String(block.codex_instance || '')}) != board(${instance})`
            );
        }
        const blockSubfrontId = String(block.subfront_id || '').trim();
        const taskSubfrontId = String(task.subfront_id || '').trim();
        if (blockSubfrontId && blockSubfrontId !== taskSubfrontId) {
            errors.push(
                `${task.id}: subfront_id desalineado plan(${blockSubfrontId}) != board(${taskSubfrontId || 'vacio'})`
            );
        }
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
        const blockSubfrontId = String(block.subfront_id || '').trim();
        const taskSubfrontId = String(task.subfront_id || '').trim();
        if (blockSubfrontId && blockSubfrontId !== taskSubfrontId) {
            errors.push(
                `${task.id}: subfront_id desalineado plan(${blockSubfrontId}) != board(${taskSubfrontId || 'vacio'})`
            );
        }
        if (!slotStatusesSet.has(String(task.status || '').trim())) {
            errors.push(
                `${task.id}: CODEX_ACTIVE solo aplica a estados con slot (${String(task.status || '').trim() || 'vacio'})`
            );
        }
    }

    const strategySummary = domainStrategy.buildStrategyCoverageSummary(board, {
        activeStatuses,
        slotStatuses: slotStatusesSet,
        laneCapacities: normalizedParallelism.by_codex_instance,
        findCriticalScopeKeyword,
    });
    const configuredStrategy = strategySummary.configured;
    const activeStrategy = strategySummary.active;
    const nextStrategy = strategySummary.next;
    if (codexStrategyActiveBlocks.length > 1) {
        errors.push(
            `Mas de un bloque CODEX_STRATEGY_ACTIVE en ${codexPlanPath}`
        );
    }
    if (codexStrategyNextBlocks.length > 1) {
        errors.push(`Mas de un bloque CODEX_STRATEGY_NEXT en ${codexPlanPath}`);
    }
    const planStrategyBlock =
        codexStrategyActiveBlocks.length > 0
            ? codexStrategyActiveBlocks[0]
            : null;
    const planStrategyNextBlock =
        codexStrategyNextBlocks.length > 0 ? codexStrategyNextBlocks[0] : null;
    if (configuredStrategy) {
        if (!planStrategyBlock) {
            errors.push(
                `Falta bloque CODEX_STRATEGY_ACTIVE para ${configuredStrategy.id} en ${codexPlanPath}`
            );
        } else {
            const boardSubfrontIds = configuredStrategy.subfronts
                .map((subfront) => String(subfront.subfront_id || '').trim())
                .filter(Boolean)
                .sort();
            const planSubfrontIds = (
                Array.isArray(planStrategyBlock.subfront_ids)
                    ? planStrategyBlock.subfront_ids
                    : []
            )
                .map((value) => String(value || '').trim())
                .filter(Boolean)
                .sort();
            if (String(planStrategyBlock.id || '') !== configuredStrategy.id) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.id desalineado plan(${String(planStrategyBlock.id || '')}) != board(${configuredStrategy.id})`
                );
            }
            if (
                String(planStrategyBlock.title || '') !==
                configuredStrategy.title
            ) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.title desalineado plan(${String(planStrategyBlock.title || '')}) != board(${configuredStrategy.title})`
                );
            }
            if (
                String(planStrategyBlock.status || '') !==
                String(configuredStrategy.status || '')
            ) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.status desalineado plan(${String(planStrategyBlock.status || '')}) != board(${String(configuredStrategy.status || '')})`
                );
            }
            if (
                String(planStrategyBlock.owner || '') !==
                configuredStrategy.owner
            ) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.owner desalineado plan(${String(planStrategyBlock.owner || '')}) != board(${configuredStrategy.owner})`
                );
            }
            if (
                String(planStrategyBlock.owner_policy || '') !==
                String(configuredStrategy.owner_policy || '')
            ) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.owner_policy desalineado plan(${String(planStrategyBlock.owner_policy || '')}) != board(${String(configuredStrategy.owner_policy || '')})`
                );
            }
            if (
                JSON.stringify(planSubfrontIds) !==
                JSON.stringify(boardSubfrontIds)
            ) {
                errors.push(
                    `CODEX_STRATEGY_ACTIVE.subfront_ids desalineado plan(${planSubfrontIds.join(',') || 'vacio'}) != board(${boardSubfrontIds.join(',') || 'vacio'})`
                );
            }
        }
        if (activeStrategy && strategySummary.orphan_tasks > 0) {
            errors.push(
                `Estrategia activa con tareas huerfanas (${strategySummary.orphan_task_ids.join(', ')})`
            );
        }
    } else if (planStrategyBlock) {
        errors.push(
            `CODEX_STRATEGY_ACTIVE presente en ${codexPlanPath} pero AGENT_BOARD.yaml no tiene strategy.active configurada`
        );
    }
    if (nextStrategy) {
        if (!planStrategyNextBlock) {
            errors.push(
                `Falta bloque CODEX_STRATEGY_NEXT para ${nextStrategy.id} en ${codexPlanPath}`
            );
        } else {
            const boardSubfrontIds = nextStrategy.subfronts
                .map((subfront) => String(subfront.subfront_id || '').trim())
                .filter(Boolean)
                .sort();
            const planSubfrontIds = (
                Array.isArray(planStrategyNextBlock.subfront_ids)
                    ? planStrategyNextBlock.subfront_ids
                    : []
            )
                .map((value) => String(value || '').trim())
                .filter(Boolean)
                .sort();
            if (String(planStrategyNextBlock.id || '') !== nextStrategy.id) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.id desalineado plan(${String(planStrategyNextBlock.id || '')}) != board(${nextStrategy.id})`
                );
            }
            if (
                String(planStrategyNextBlock.title || '') !== nextStrategy.title
            ) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.title desalineado plan(${String(planStrategyNextBlock.title || '')}) != board(${nextStrategy.title})`
                );
            }
            if (
                String(planStrategyNextBlock.status || '') !==
                String(nextStrategy.status || '')
            ) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.status desalineado plan(${String(planStrategyNextBlock.status || '')}) != board(${String(nextStrategy.status || '')})`
                );
            }
            if (
                String(planStrategyNextBlock.owner || '') !== nextStrategy.owner
            ) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.owner desalineado plan(${String(planStrategyNextBlock.owner || '')}) != board(${nextStrategy.owner})`
                );
            }
            if (
                String(planStrategyNextBlock.owner_policy || '') !==
                String(nextStrategy.owner_policy || '')
            ) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.owner_policy desalineado plan(${String(planStrategyNextBlock.owner_policy || '')}) != board(${String(nextStrategy.owner_policy || '')})`
                );
            }
            if (
                JSON.stringify(planSubfrontIds) !==
                JSON.stringify(boardSubfrontIds)
            ) {
                errors.push(
                    `CODEX_STRATEGY_NEXT.subfront_ids desalineado plan(${planSubfrontIds.join(',') || 'vacio'}) != board(${boardSubfrontIds.join(',') || 'vacio'})`
                );
            }
        }
    } else if (planStrategyNextBlock) {
        errors.push(
            `CODEX_STRATEGY_NEXT presente en ${codexPlanPath} pero AGENT_BOARD.yaml no tiene strategy.next`
        );
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
            codex_slot_tasks: slotCodexTasks.length,
            plan_blocks: codexBlocks.length,
            codex_in_progress_by_instance: codexInProgressByInstance,
            codex_slot_tasks_by_instance: Object.fromEntries(
                Object.entries(codexSlotTasksByInstance).map(
                    ([instance, taskIds]) => [instance, taskIds.length]
                )
            ),
            codex_active_by_instance: activeCodexTasks.reduce((acc, task) => {
                const instance = String(
                    task?.codex_instance || 'codex_backend_ops'
                )
                    .trim()
                    .toLowerCase();
                acc[instance] = (acc[instance] || 0) + 1;
                return acc;
            }, {}),
            lane_capacity: normalizedParallelism.by_codex_instance,
            available_slots: Object.fromEntries(
                domainStrategy.DEFAULT_CODEX_INSTANCES.map((codexInstance) => {
                    const capacity = Number(
                        normalizedParallelism.by_codex_instance?.[
                            codexInstance
                        ] || 0
                    );
                    const used = Number(
                        Object.prototype.hasOwnProperty.call(
                            codexSlotTasksByInstance,
                            codexInstance
                        )
                            ? codexSlotTasksByInstance[codexInstance].length
                            : 0
                    );
                    return [codexInstance, Math.max(0, capacity - used)];
                })
            ),
            slot_statuses: normalizedParallelism.slot_statuses,
            active_ag_codex_tasks: supportCoverage.active_ag_codex_tasks_total,
            active_cdx_tasks: supportCoverage.active_cdx_tasks_total,
            codex_support_without_active_cdx:
                Number(
                    supportCoverage.by_code?.codex_support_without_active_cdx ||
                        0
                ),
            codex_active_without_cdx_mirror:
                Number(
                    supportCoverage.by_code?.codex_active_without_cdx_mirror ||
                        0
                ),
        },
        strategy: {
            configured: strategySummary.configured,
            active: strategySummary.active,
            next: strategySummary.next,
            updated_at: strategySummary.updated_at,
            active_tasks_total: strategySummary.active_tasks_total,
            slot_tasks: strategySummary.slot_tasks,
            aligned_tasks: strategySummary.aligned_tasks,
            primary_tasks: strategySummary.primary_tasks,
            support_tasks: strategySummary.support_tasks,
            exception_tasks: strategySummary.exception_tasks,
            exception_open_tasks: strategySummary.exception_open_tasks,
            exception_expired_tasks: strategySummary.exception_expired_tasks,
            orphan_tasks: strategySummary.orphan_tasks,
            orphan_task_ids: strategySummary.orphan_task_ids,
            exception_expired_task_ids:
                strategySummary.exception_expired_task_ids,
            dispersion_score: strategySummary.dispersion_score,
            validation_errors: strategySummary.validation_errors,
            plan_block: planStrategyBlock
                ? {
                      id: String(planStrategyBlock.id || ''),
                      title: String(planStrategyBlock.title || ''),
                      status: String(planStrategyBlock.status || ''),
                      owner: String(planStrategyBlock.owner || ''),
                      subfront_ids: Array.isArray(
                          planStrategyBlock.subfront_ids
                      )
                          ? planStrategyBlock.subfront_ids
                          : [],
                  }
                : null,
            plan_next_block: planStrategyNextBlock
                ? {
                      id: String(planStrategyNextBlock.id || ''),
                      title: String(planStrategyNextBlock.title || ''),
                      status: String(planStrategyNextBlock.status || ''),
                      owner: String(planStrategyNextBlock.owner || ''),
                      subfront_ids: Array.isArray(
                          planStrategyNextBlock.subfront_ids
                      )
                          ? planStrategyNextBlock.subfront_ids
                          : [],
                  }
                : null,
            lane_capacity: strategySummary.lane_capacity,
            available_slots: strategySummary.available_slots,
            subfront_count: strategySummary.subfront_count,
            lane_rows: strategySummary.lane_rows,
            rows: strategySummary.rows,
        },
        codex_task_ids: codexTasks.map((task) => String(task.id)),
        codex_in_progress_ids: codexInProgress.map((task) => String(task.id)),
        codex_active_ids: activeCodexTasks.map((task) => String(task.id)),
        codex_slot_task_ids: slotCodexTasks.map((task) => String(task.id)),
        codex_support_rows: supportCoverage.rows,
        plan_blocks: codexBlocks.map((block) => ({
            codex_instance: String(block.codex_instance || ''),
            block: String(block.block || ''),
            task_id: String(block.task_id || ''),
            subfront_id: String(block.subfront_id || ''),
            status: String(block.status || ''),
            files: Array.isArray(block.files) ? block.files : [],
            updated_at: String(block.updated_at || ''),
        })),
        plan_strategy_blocks: {
            active: codexStrategyActiveBlocks.map((block) => ({
                id: String(block.id || ''),
                title: String(block.title || ''),
                status: String(block.status || ''),
                owner: String(block.owner || ''),
                owner_policy: String(block.owner_policy || ''),
                subfront_ids: Array.isArray(block.subfront_ids)
                    ? block.subfront_ids
                    : [],
            })),
            next: codexStrategyNextBlocks.map((block) => ({
                id: String(block.id || ''),
                title: String(block.title || ''),
                status: String(block.status || ''),
                owner: String(block.owner || ''),
                owner_policy: String(block.owner_policy || ''),
                subfront_ids: Array.isArray(block.subfront_ids)
                    ? block.subfront_ids
                    : [],
            })),
        },
    };
}

module.exports = {
    buildCodexActiveComment: serializeBlock,
    upsertCodexActiveBlock,
    collectActiveCodexSupportCoverage,
    buildCodexCheckReport,
};
