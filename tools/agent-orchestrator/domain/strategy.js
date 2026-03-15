'use strict';

const domainFocus = require('./focus');

const ACTIVE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const ALLOWED_STRATEGY_STATUSES = new Set(['active', 'closed']);
const ALLOWED_STRATEGY_ROLES = new Set(['primary', 'support', 'exception']);
const DEFAULT_CODEX_INSTANCES = [
    'codex_backend_ops',
    'codex_frontend',
    'codex_transversal',
];

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function normalizeArray(values, options = {}) {
    const { lowerCase = false } = options;
    const list = Array.isArray(values) ? values : values ? [values] : [];
    return list
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => (lowerCase ? value.toLowerCase() : value));
}

function normalizeStrategySubfront(subfront) {
    if (!subfront || typeof subfront !== 'object') return null;
    return {
        codex_instance: normalizeOptionalToken(subfront.codex_instance),
        subfront_id: String(subfront.subfront_id || '').trim(),
        title: String(subfront.title || '').trim(),
        allowed_scopes: normalizeArray(subfront.allowed_scopes, {
            lowerCase: true,
        }),
        support_only_scopes: normalizeArray(subfront.support_only_scopes, {
            lowerCase: true,
        }),
        blocked_scopes: normalizeArray(subfront.blocked_scopes, {
            lowerCase: true,
        }),
    };
}

function normalizeStrategyActive(strategy) {
    if (!strategy || typeof strategy !== 'object') return null;
    const focusSeed = domainFocus.normalizeStrategyFocus(strategy) || {};
    return {
        id: String(strategy.id || '').trim(),
        title: String(strategy.title || '').trim(),
        objective: String(strategy.objective || '').trim(),
        owner: String(strategy.owner || '').trim(),
        owner_policy: String(strategy.owner_policy || '').trim(),
        status: normalizeOptionalToken(strategy.status),
        started_at: String(strategy.started_at || '').trim(),
        review_due_at: String(strategy.review_due_at || '').trim(),
        closed_at: String(strategy.closed_at || '').trim(),
        close_reason: String(strategy.close_reason || '').trim(),
        exit_criteria: normalizeArray(strategy.exit_criteria),
        success_signal: String(strategy.success_signal || '').trim(),
        focus_id: String(focusSeed.id || strategy.focus_id || '').trim(),
        focus_title: String(
            focusSeed.title || strategy.focus_title || ''
        ).trim(),
        focus_summary: String(
            focusSeed.summary || strategy.focus_summary || ''
        ).trim(),
        focus_status: normalizeOptionalToken(
            focusSeed.status || strategy.focus_status
        ),
        focus_proof: String(
            focusSeed.proof || strategy.focus_proof || ''
        ).trim(),
        focus_steps: normalizeArray(focusSeed.steps || strategy.focus_steps),
        focus_next_step: String(
            focusSeed.next_step || strategy.focus_next_step || ''
        ).trim(),
        focus_required_checks: normalizeArray(
            focusSeed.required_checks || strategy.focus_required_checks,
            { lowerCase: true }
        ),
        focus_non_goals: normalizeArray(
            focusSeed.non_goals || strategy.focus_non_goals
        ),
        focus_owner: String(
            focusSeed.owner || strategy.focus_owner || ''
        ).trim(),
        focus_review_due_at: String(
            focusSeed.review_due_at || strategy.focus_review_due_at || ''
        ).trim(),
        focus_evidence_ref: String(
            focusSeed.evidence_ref || strategy.focus_evidence_ref || ''
        ).trim(),
        focus_max_active_slices:
            Number.parseInt(
                String(
                    focusSeed.max_active_slices ||
                        strategy.focus_max_active_slices ||
                        '3'
                ),
                10
            ) || 3,
        subfronts: (Array.isArray(strategy.subfronts) ? strategy.subfronts : [])
            .map((subfront) => normalizeStrategySubfront(subfront))
            .filter(Boolean),
    };
}

function normalizeTaskStrategyFields(task) {
    if (!task || typeof task !== 'object') return task;
    task.strategy_id = String(task.strategy_id || '').trim();
    task.subfront_id = String(task.subfront_id || '').trim();
    task.strategy_role = normalizeOptionalToken(task.strategy_role);
    task.strategy_reason = String(task.strategy_reason || '').trim();
    return task;
}

function getConfiguredStrategy(board) {
    return normalizeStrategyActive(board?.strategy?.active || null);
}

function getNextStrategy(board) {
    return normalizeStrategyActive(board?.strategy?.next || null);
}

function getActiveStrategy(board) {
    const strategy = getConfiguredStrategy(board);
    if (!strategy || strategy.status !== 'active') return null;
    return strategy;
}

function getSubfrontById(strategy, subfrontId) {
    const safeStrategy = strategy || {};
    const safeSubfrontId = String(subfrontId || '').trim();
    if (!safeSubfrontId) return null;
    return (
        (Array.isArray(safeStrategy.subfronts)
            ? safeStrategy.subfronts
            : []
        ).find(
            (subfront) =>
                String(subfront?.subfront_id || '').trim() === safeSubfrontId
        ) || null
    );
}

function getSubfrontByCodexInstance(strategy, codexInstance) {
    const safeStrategy = strategy || {};
    const safeCodexInstance = normalizeOptionalToken(codexInstance);
    if (!safeCodexInstance) return null;
    const matches = (
        Array.isArray(safeStrategy.subfronts) ? safeStrategy.subfronts : []
    ).filter(
        (subfront) =>
            normalizeOptionalToken(subfront?.codex_instance) ===
            safeCodexInstance
    );
    return matches.length === 1 ? matches[0] : null;
}

function getTaskSubfront(strategy, task) {
    const byId = getSubfrontById(strategy, task?.subfront_id);
    if (byId) return byId;
    return getSubfrontByCodexInstance(strategy, task?.codex_instance);
}

function isCriticalExceptionTask(task, options = {}) {
    const findCriticalScopeKeyword =
        options.findCriticalScopeKeyword || (() => null);
    const runtimeImpact = normalizeOptionalToken(task?.runtime_impact);
    if (Boolean(task?.critical_zone) || runtimeImpact === 'high') return true;
    return Boolean(findCriticalScopeKeyword(task?.scope || ''));
}

function isAllowedExceptionReason(task) {
    const corpus = [
        String(task?.strategy_reason || ''),
        String(task?.scope || ''),
        String(task?.title || ''),
        String(task?.blocked_reason || ''),
    ]
        .join(' ')
        .toLowerCase();
    if (
        [
            'hotfix',
            'incident',
            'incidente',
            'support',
            'soporte',
            'unlock',
            'desbloque',
            'desbloquear',
            'unblock',
            'frente activo',
            'active front',
        ].some((token) => corpus.includes(token))
    ) {
        return true;
    }
    return false;
}

function ensureTaskStrategyDefaults(board, task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    normalizeTaskStrategyFields(task);
    const activeStrategy = getActiveStrategy(board);
    if (!activeStrategy) return task;
    const status = String(task.status || '').trim();
    if (!activeStatuses.has(status)) return task;

    if (!task.strategy_id) {
        task.strategy_id = activeStrategy.id;
    }

    const subfront =
        getSubfrontById(activeStrategy, task.subfront_id) ||
        getSubfrontByCodexInstance(activeStrategy, task.codex_instance);
    if (!task.subfront_id && subfront) {
        task.subfront_id = subfront.subfront_id;
    }

    const resolvedSubfront =
        subfront ||
        getSubfrontById(activeStrategy, task.subfront_id) ||
        getSubfrontByCodexInstance(activeStrategy, task.codex_instance);
    const scope = normalizeOptionalToken(task.scope);
    if (!task.strategy_role && resolvedSubfront) {
        if (task.strategy_reason) {
            task.strategy_role = 'exception';
        } else if (resolvedSubfront.support_only_scopes.includes(scope)) {
            task.strategy_role = 'support';
        } else if (resolvedSubfront.allowed_scopes.includes(scope)) {
            task.strategy_role = 'primary';
        }
    }
    return task;
}

function validateStrategyConfiguration(board, options = {}) {
    const strategy = getConfiguredStrategy(board);
    if (!strategy) return [];

    const allowedCodexInstances = Array.isArray(options.allowedCodexInstances)
        ? options.allowedCodexInstances
        : DEFAULT_CODEX_INSTANCES;
    const errors = [];

    if (!strategy.id) errors.push('strategy.active requiere id');
    if (!strategy.title) errors.push('strategy.active requiere title');
    if (!strategy.objective) errors.push('strategy.active requiere objective');
    if (!strategy.owner) errors.push('strategy.active requiere owner');
    if (!ALLOWED_STRATEGY_STATUSES.has(strategy.status)) {
        errors.push(
            `strategy.active tiene status invalido (${strategy.status || 'vacio'})`
        );
    }
    if (!strategy.started_at) {
        errors.push('strategy.active requiere started_at');
    }
    if (!strategy.review_due_at) {
        errors.push('strategy.active requiere review_due_at');
    }
    if (strategy.exit_criteria.length === 0) {
        errors.push('strategy.active requiere exit_criteria no vacio');
    }
    if (!strategy.success_signal) {
        errors.push('strategy.active requiere success_signal');
    }
    errors.push(
        ...domainFocus
            .validateFocusConfiguration({ strategy: { active: strategy } })
            .filter(Boolean)
    );

    const seenSubfrontIds = new Set();
    const instanceCounts = {};
    for (const subfront of strategy.subfronts) {
        if (!subfront.subfront_id) {
            errors.push('strategy.active.subfronts requiere subfront_id');
        }
        if (!subfront.codex_instance) {
            errors.push(
                `strategy.active.subfront ${subfront.subfront_id || '(sin id)'} requiere codex_instance`
            );
        } else if (!allowedCodexInstances.includes(subfront.codex_instance)) {
            errors.push(
                `strategy.active.subfront ${subfront.subfront_id || '(sin id)'} tiene codex_instance invalido (${subfront.codex_instance})`
            );
        }
        if (!subfront.title) {
            errors.push(
                `strategy.active.subfront ${subfront.subfront_id || '(sin id)'} requiere title`
            );
        }
        if (subfront.subfront_id) {
            if (seenSubfrontIds.has(subfront.subfront_id)) {
                errors.push(
                    `strategy.active duplica subfront_id (${subfront.subfront_id})`
                );
            }
            seenSubfrontIds.add(subfront.subfront_id);
        }
        if (subfront.codex_instance) {
            instanceCounts[subfront.codex_instance] =
                Number(instanceCounts[subfront.codex_instance] || 0) + 1;
        }
    }

    if (strategy.status === 'active') {
        for (const codexInstance of allowedCodexInstances) {
            const count = Number(instanceCounts[codexInstance] || 0);
            if (count !== 1) {
                errors.push(
                    `strategy.active requiere exactamente un subfront para ${codexInstance} (actual: ${count})`
                );
            }
        }
    }

    return errors;
}

function validateTaskStrategyAlignment(board, task, options = {}) {
    ensureTaskStrategyDefaults(board, task, options);
    const activeStrategy = getActiveStrategy(board);
    if (!activeStrategy) return null;

    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const findCriticalScopeKeyword =
        options.findCriticalScopeKeyword || (() => null);
    const status = String(task?.status || '').trim();
    if (!activeStatuses.has(status)) return null;

    const taskId = String(task?.id || '(sin id)').trim();
    const scope = normalizeOptionalToken(task?.scope);
    const role = normalizeOptionalToken(task?.strategy_role);

    if (!task.strategy_id) {
        throw new Error(
            `task ${taskId}: estrategia activa requiere strategy_id=${activeStrategy.id}`
        );
    }
    if (task.strategy_id !== activeStrategy.id) {
        throw new Error(
            `task ${taskId}: strategy_id desalineado (${task.strategy_id} != ${activeStrategy.id})`
        );
    }
    if (!task.subfront_id) {
        throw new Error(
            `task ${taskId}: estrategia activa requiere subfront_id`
        );
    }

    const subfront = getSubfrontById(activeStrategy, task.subfront_id);
    if (!subfront) {
        throw new Error(
            `task ${taskId}: subfront_id invalido para estrategia activa (${task.subfront_id})`
        );
    }

    if (
        normalizeOptionalToken(task?.codex_instance) !== subfront.codex_instance
    ) {
        throw new Error(
            `task ${taskId}: subfront ${subfront.subfront_id} requiere codex_instance=${subfront.codex_instance}`
        );
    }

    if (!ALLOWED_STRATEGY_ROLES.has(role)) {
        throw new Error(
            `task ${taskId}: strategy_role invalido (${role || 'vacio'})`
        );
    }

    if (subfront.blocked_scopes.includes(scope)) {
        throw new Error(
            `task ${taskId}: scope bloqueado por subfrente (${scope || 'vacio'})`
        );
    }

    const inAllowedScopes = subfront.allowed_scopes.includes(scope);
    const inSupportOnlyScopes = subfront.support_only_scopes.includes(scope);
    const isCriticalException = isCriticalExceptionTask(task, {
        findCriticalScopeKeyword,
    });

    if (role === 'exception') {
        if (!String(task.strategy_reason || '').trim()) {
            throw new Error(
                `task ${taskId}: strategy_role=exception requiere strategy_reason`
            );
        }
        if (!isCriticalException && !isAllowedExceptionReason(task)) {
            throw new Error(
                `task ${taskId}: exception solo permitido para hotfix critico o soporte directo al frente activo`
            );
        }
        return { strategy: activeStrategy, subfront };
    }

    if (inSupportOnlyScopes && role !== 'support') {
        throw new Error(
            `task ${taskId}: scope ${scope || 'vacio'} requiere strategy_role=support`
        );
    }
    if (!inAllowedScopes && !inSupportOnlyScopes) {
        throw new Error(
            `task ${taskId}: scope ${scope || 'vacio'} fuera del subfrente ${subfront.subfront_id}`
        );
    }

    return { strategy: activeStrategy, subfront };
}

function buildStrategyCoverageSummary(board, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const findCriticalScopeKeyword =
        options.findCriticalScopeKeyword || (() => null);
    const strategy = getConfiguredStrategy(board);
    const nextStrategy = getNextStrategy(board);
    const activeStrategy = getActiveStrategy(board);
    const activeTasks = Array.isArray(board?.tasks)
        ? board.tasks.filter((task) =>
              activeStatuses.has(String(task?.status || '').trim())
          )
        : [];
    const rows = new Map();
    for (const subfront of activeStrategy?.subfronts || []) {
        rows.set(subfront.subfront_id, {
            codex_instance: subfront.codex_instance,
            subfront_id: subfront.subfront_id,
            title: subfront.title,
            active_tasks: 0,
            aligned_tasks: 0,
            primary_tasks: 0,
            support_tasks: 0,
            exception_tasks: 0,
            orphan_tasks: 0,
        });
    }

    const summary = {
        configured: strategy,
        active: activeStrategy,
        next: nextStrategy,
        active_tasks_total: activeTasks.length,
        aligned_tasks: 0,
        primary_tasks: 0,
        support_tasks: 0,
        exception_tasks: 0,
        orphan_tasks: 0,
        orphan_task_ids: [],
        exception_task_ids: [],
        aligned_task_ids: [],
        validation_errors: [],
        rows: Array.from(rows.values()),
    };

    if (!activeStrategy) {
        return summary;
    }

    for (const originalTask of activeTasks) {
        const task = {
            ...originalTask,
            files: Array.isArray(originalTask?.files)
                ? [...originalTask.files]
                : [],
            depends_on: Array.isArray(originalTask?.depends_on)
                ? [...originalTask.depends_on]
                : [],
        };
        ensureTaskStrategyDefaults(board, task, {
            activeStatuses,
            findCriticalScopeKeyword,
        });
        const row =
            rows.get(String(task.subfront_id || '').trim()) ||
            Array.from(rows.values()).find(
                (candidate) =>
                    candidate.codex_instance ===
                    normalizeOptionalToken(task.codex_instance)
            ) ||
            null;
        if (row) {
            row.active_tasks += 1;
        }
        try {
            validateTaskStrategyAlignment(board, task, {
                activeStatuses,
                findCriticalScopeKeyword,
            });
            summary.aligned_tasks += 1;
            summary.aligned_task_ids.push(String(task.id || ''));
            if (row) {
                row.aligned_tasks += 1;
            }
            if (task.strategy_role === 'exception') {
                summary.exception_tasks += 1;
                summary.exception_task_ids.push(String(task.id || ''));
                if (row) row.exception_tasks += 1;
            } else if (task.strategy_role === 'support') {
                summary.support_tasks += 1;
                if (row) row.support_tasks += 1;
            } else {
                summary.primary_tasks += 1;
                if (row) row.primary_tasks += 1;
            }
        } catch (error) {
            summary.orphan_tasks += 1;
            summary.orphan_task_ids.push(String(task.id || ''));
            summary.validation_errors.push(String(error.message || error));
            if (row) {
                row.orphan_tasks += 1;
            }
        }
    }

    summary.rows = Array.from(rows.values());
    return summary;
}

function buildStrategySeed(seedNameRaw, options = {}) {
    const currentDate = options.currentDate || (() => '');
    const owner =
        String(options.owner || '').trim() ||
        String(options.detectDefaultOwner?.() || '').trim() ||
        'ernesto';
    const today = String(currentDate()).trim();
    const seedName = normalizeOptionalToken(seedNameRaw);
    if (seedName !== 'admin-operativo') {
        throw new Error(
            `strategy set-active: seed invalido (${seedNameRaw || 'vacio'})`
        );
    }
    return {
        ...domainFocus.buildFocusSeed(
            {
                id: 'STRAT-2026-03-admin-operativo',
                owner,
                review_due_at: '2026-03-21',
            },
            { owner }
        ),
        id: 'STRAT-2026-03-admin-operativo',
        title: 'Admin operativo',
        objective:
            'Convertir el frente admin clinico, queue/turnero y OpenClaw UX en una entrega operable y visible, con soporte backend y runtime estrictamente alineado.',
        owner,
        status: 'active',
        started_at: today || '2026-03-14',
        review_due_at: '2026-03-21',
        exit_criteria: [
            'Admin clinico y queue/turnero navegables sin flujos rotos',
            'Auth/readiness/gates en verde para el frente activo',
            'Runtime OpenClaw solo usado como desbloqueo directo del mismo objetivo',
        ],
        success_signal:
            'Un mismo corte operativo puede demostrarse de punta a punta sin abrir trabajo fuera del frente admin operativo.',
        subfronts: [
            {
                codex_instance: 'codex_frontend',
                subfront_id: 'SF-frontend-admin-operativo',
                title: 'Admin clinico, queue/turnero y OpenClaw UX',
                allowed_scopes: ['frontend-admin', 'queue', 'turnero'],
                support_only_scopes: ['docs', 'tests', 'frontend-qa'],
                blocked_scopes: ['frontend-public', 'payments', 'calendar'],
            },
            {
                codex_instance: 'codex_backend_ops',
                subfront_id: 'SF-backend-admin-operativo',
                title: 'Auth, readiness, gates y backend de soporte directo',
                allowed_scopes: ['auth', 'backend', 'readiness', 'gates'],
                support_only_scopes: ['deploy', 'ops', 'monitoring', 'tests'],
                blocked_scopes: [
                    'frontend-public',
                    'frontend-admin',
                    'payments',
                    'calendar',
                ],
            },
            {
                codex_instance: 'codex_transversal',
                subfront_id: 'SF-transversal-admin-operativo',
                title: 'Runtime/orquestacion solo como desbloqueo del frente',
                allowed_scopes: [],
                support_only_scopes: [
                    'openclaw_runtime',
                    'codex-governance',
                    'tooling',
                ],
                blocked_scopes: [
                    'frontend-public',
                    'frontend-admin',
                    'backend',
                    'deploy',
                    'auth',
                ],
            },
        ],
    };
}

function serializeStrategyActiveComment(strategy, deps = {}) {
    const {
        quote = (value) => JSON.stringify(String(value || '')),
        serializeArrayInline = (values) => JSON.stringify(values || []),
        currentDate = () => '',
    } = deps;
    if (!strategy) return '';
    const safe = normalizeStrategyActive(strategy);
    if (!safe) return '';
    const lines = [];
    lines.push('<!-- CODEX_STRATEGY_ACTIVE');
    lines.push(`id: ${safe.id || ''}`);
    lines.push(`title: ${quote(safe.title || '')}`);
    lines.push(`status: ${safe.status || 'active'}`);
    lines.push(`owner: ${safe.owner || ''}`);
    lines.push(`objective: ${quote(safe.objective || '')}`);
    lines.push(`started_at: ${quote(safe.started_at || '')}`);
    lines.push(`review_due_at: ${quote(safe.review_due_at || '')}`);
    lines.push(`success_signal: ${quote(safe.success_signal || '')}`);
    if (safe.focus_id) {
        lines.push(`focus_id: ${quote(safe.focus_id || '')}`);
        lines.push(`focus_title: ${quote(safe.focus_title || '')}`);
        lines.push(`focus_status: ${safe.focus_status || 'active'}`);
        lines.push(`focus_next_step: ${quote(safe.focus_next_step || '')}`);
        lines.push(
            `focus_required_checks: ${serializeArrayInline(
                safe.focus_required_checks || []
            )}`
        );
    }
    lines.push(
        `subfront_ids: ${serializeArrayInline(
            safe.subfronts.map((subfront) => subfront.subfront_id)
        )}`
    );
    lines.push(`updated_at: ${quote(currentDate())}`);
    lines.push('-->');
    return lines.join('\n');
}

function upsertStrategyActiveBlock(planRaw, strategy, deps = {}) {
    const {
        buildComment = (value) => serializeStrategyActiveComment(value, deps),
        anchorText = 'Relacion con Operativo 2026:',
    } = deps;
    const withoutStrategy = String(planRaw || '').replace(
        /<!--\s*CODEX_STRATEGY_ACTIVE\s*\n[\s\S]*?-->\s*/g,
        ''
    );
    if (!strategy) {
        return withoutStrategy.replace(/\n{3,}/g, '\n\n');
    }
    const comment = `${buildComment(strategy)}\n\n`;
    const anchorIndex = withoutStrategy.indexOf(anchorText);
    if (anchorIndex === -1) {
        return `${comment}${withoutStrategy}`.replace(/\n{3,}/g, '\n\n');
    }
    const lineEnd = withoutStrategy.indexOf('\n', anchorIndex);
    if (lineEnd === -1) {
        return `${withoutStrategy}\n\n${comment}`.replace(/\n{3,}/g, '\n\n');
    }
    return (
        withoutStrategy.slice(0, lineEnd + 1) +
        '\n' +
        comment +
        withoutStrategy.slice(lineEnd + 1)
    ).replace(/\n{3,}/g, '\n\n');
}

module.exports = {
    ACTIVE_TASK_STATUSES,
    ALLOWED_STRATEGY_STATUSES,
    ALLOWED_STRATEGY_ROLES,
    DEFAULT_CODEX_INSTANCES,
    normalizeStrategySubfront,
    normalizeStrategyActive,
    normalizeTaskStrategyFields,
    getConfiguredStrategy,
    getNextStrategy,
    getActiveStrategy,
    getSubfrontById,
    getSubfrontByCodexInstance,
    getTaskSubfront,
    ensureTaskStrategyDefaults,
    validateStrategyConfiguration,
    validateTaskStrategyAlignment,
    buildStrategyCoverageSummary,
    buildStrategySeed,
    buildStrategyActiveComment: serializeStrategyActiveComment,
    upsertStrategyActiveBlock,
};
