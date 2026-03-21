'use strict';

const ACTIVE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const ALLOWED_FOCUS_STATUSES = new Set(['active', 'closed']);
const ALLOWED_WORK_TYPES = new Set([
    'forward',
    'support',
    'fix',
    'refactor',
    'decision',
    'evidence',
]);
const ALLOWED_INTEGRATION_SLICES = new Set([
    'frontend_runtime',
    'backend_readiness',
    'runtime_support',
    'ops_deploy',
    'desktop_shells',
    'tests_quality',
    'governance_evidence',
]);
const LANE_ALLOWED_SLICES = {
    codex_frontend: new Set([
        'frontend_runtime',
        'desktop_shells',
        'tests_quality',
        'governance_evidence',
    ]),
    codex_backend_ops: new Set([
        'backend_readiness',
        'ops_deploy',
        'tests_quality',
        'governance_evidence',
    ]),
    codex_transversal: new Set([
        'runtime_support',
        'tests_quality',
        'governance_evidence',
    ]),
};

const ACKNOWLEDGED_EXTERNAL_BLOCKED_REASON_PATTERNS = [
    /no_host_access/i,
    /host_.*502/i,
    /host_.*unreachable/i,
    /host_side_runtime_mismatch/i,
    /operator_auth.*502/i,
    /publicsync.*no_host_access/i,
    /remote_verification_pending/i,
];

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function isAcknowledgedExternalBlockedTask(task = {}) {
    if (normalizeOptionalToken(task?.status) !== 'blocked') {
        return false;
    }
    const blockedReason = String(task?.blocked_reason || '').trim();
    if (!blockedReason) return false;
    return ACKNOWLEDGED_EXTERNAL_BLOCKED_REASON_PATTERNS.some((pattern) =>
        pattern.test(blockedReason)
    );
}

function normalizeArray(values, options = {}) {
    const { lowerCase = false } = options;
    const list = Array.isArray(values) ? values : values ? [values] : [];
    return list
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => (lowerCase ? value.toLowerCase() : value));
}

function normalizeFocusStatus(value) {
    const status = normalizeOptionalToken(value);
    if (!status) return '';
    return ALLOWED_FOCUS_STATUSES.has(status) ? status : status;
}

function normalizeFocusMaxActiveSlices(value, fallback = 3) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStrategyFocus(strategy) {
    if (!strategy || typeof strategy !== 'object') return null;
    const focusId = String(strategy.focus_id || '').trim();
    const focusStatus = normalizeFocusStatus(strategy.focus_status);
    if (
        !focusId &&
        !focusStatus &&
        !String(strategy.focus_proof || '').trim() &&
        !String(strategy.focus_next_step || '').trim()
    ) {
        return null;
    }
    return {
        id: focusId,
        title: String(strategy.focus_title || '').trim(),
        summary: String(strategy.focus_summary || '').trim(),
        status: focusStatus || 'active',
        proof: String(strategy.focus_proof || '').trim(),
        steps: normalizeArray(strategy.focus_steps),
        next_step: String(strategy.focus_next_step || '').trim(),
        required_checks: normalizeArray(strategy.focus_required_checks, {
            lowerCase: true,
        }),
        non_goals: normalizeArray(strategy.focus_non_goals),
        owner: String(strategy.focus_owner || '').trim(),
        review_due_at: String(strategy.focus_review_due_at || '').trim(),
        evidence_ref: String(strategy.focus_evidence_ref || '').trim(),
        max_active_slices: normalizeFocusMaxActiveSlices(
            strategy.focus_max_active_slices,
            3
        ),
    };
}

function getConfiguredFocus(board) {
    return normalizeStrategyFocus(board?.strategy?.active || null);
}

function getActiveFocus(board) {
    const focus = getConfiguredFocus(board);
    if (!focus || focus.status !== 'active') return null;
    return focus;
}

function normalizeTaskFocusFields(task) {
    if (!task || typeof task !== 'object') return task;
    task.focus_id = String(task.focus_id || '').trim();
    task.focus_step = String(task.focus_step || '').trim();
    task.integration_slice = normalizeOptionalToken(task.integration_slice);
    task.work_type = normalizeOptionalToken(task.work_type);
    task.expected_outcome = String(task.expected_outcome || '').trim();
    task.decision_ref = String(task.decision_ref || '').trim();
    task.rework_parent = String(task.rework_parent || '').trim();
    task.rework_reason = String(task.rework_reason || '').trim();
    return task;
}

function getAllowedSlicesForLane(task = {}) {
    const codexInstance = normalizeOptionalToken(task.codex_instance);
    if (LANE_ALLOWED_SLICES[codexInstance]) {
        return LANE_ALLOWED_SLICES[codexInstance];
    }
    const domainLane = normalizeOptionalToken(task.domain_lane);
    if (domainLane === 'frontend_content') {
        return LANE_ALLOWED_SLICES.codex_frontend;
    }
    if (domainLane === 'transversal_runtime') {
        return LANE_ALLOWED_SLICES.codex_transversal;
    }
    return LANE_ALLOWED_SLICES.codex_backend_ops;
}

function ensureTaskFocusDefaults(board, task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    normalizeTaskFocusFields(task);
    const focus = getActiveFocus(board);
    const status = String(task.status || '').trim();
    if (!focus || !activeStatuses.has(status)) return task;
    if (!task.focus_id) {
        task.focus_id = focus.id;
    }
    if (!task.focus_step) {
        task.focus_step = focus.next_step;
    }
    if (!task.work_type) {
        task.work_type = 'forward';
    }
    return task;
}

function validateFocusConfiguration(board) {
    const focus = getConfiguredFocus(board);
    if (!focus) {
        return [];
    }
    const errors = [];
    if (!focus.id) errors.push('strategy.active requiere focus_id');
    if (!focus.title) errors.push('strategy.active requiere focus_title');
    if (!ALLOWED_FOCUS_STATUSES.has(focus.status)) {
        errors.push(
            `strategy.active tiene focus_status invalido (${focus.status || 'vacio'})`
        );
    }
    if (!focus.proof) errors.push('strategy.active requiere focus_proof');
    if (focus.steps.length === 0) {
        errors.push('strategy.active requiere focus_steps no vacio');
    }
    if (!focus.next_step) {
        errors.push('strategy.active requiere focus_next_step');
    }
    if (
        focus.next_step &&
        focus.steps.length > 0 &&
        !focus.steps.includes(focus.next_step)
    ) {
        errors.push(
            `strategy.active.focus_next_step fuera de focus_steps (${focus.next_step})`
        );
    }
    if (focus.required_checks.length === 0) {
        errors.push('strategy.active requiere focus_required_checks no vacio');
    }
    if (!focus.owner) errors.push('strategy.active requiere focus_owner');
    if (!focus.review_due_at) {
        errors.push('strategy.active requiere focus_review_due_at');
    }
    return errors;
}

function validateTaskFocusAlignment(board, task, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const decisionsData =
        options.decisionsData && typeof options.decisionsData === 'object'
            ? options.decisionsData
            : { decisions: [] };
    const focus = getActiveFocus(board);
    const status = String(task?.status || '').trim();
    if (!focus || !activeStatuses.has(status)) {
        return { focus };
    }

    ensureTaskFocusDefaults(board, task, { activeStatuses });
    const taskId = String(task?.id || '(sin id)').trim();
    if (!task.focus_id) {
        throw new Error(`task ${taskId}: foco activo requiere focus_id`);
    }
    if (task.focus_id !== focus.id) {
        throw new Error(
            `task ${taskId}: focus_id desalineado (${task.focus_id} != ${focus.id})`
        );
    }
    if (!task.focus_step) {
        throw new Error(`task ${taskId}: foco activo requiere focus_step`);
    }
    if (task.focus_step !== focus.next_step) {
        throw new Error(
            `task ${taskId}: focus_step fuera de focus_next_step (${task.focus_step} != ${focus.next_step})`
        );
    }
    if (!task.work_type) {
        throw new Error(`task ${taskId}: foco activo requiere work_type`);
    }
    if (!ALLOWED_WORK_TYPES.has(task.work_type)) {
        throw new Error(
            `task ${taskId}: work_type invalido (${task.work_type || 'vacio'})`
        );
    }
    if (!task.integration_slice) {
        throw new Error(
            `task ${taskId}: foco activo requiere integration_slice`
        );
    }
    if (!ALLOWED_INTEGRATION_SLICES.has(task.integration_slice)) {
        throw new Error(
            `task ${taskId}: integration_slice invalido (${task.integration_slice})`
        );
    }
    const allowedSlices = getAllowedSlicesForLane(task);
    if (!allowedSlices.has(task.integration_slice)) {
        throw new Error(
            `task ${taskId}: integration_slice ${task.integration_slice} fuera del lane`
        );
    }
    if (
        ['fix', 'refactor'].includes(task.work_type) &&
        !String(task.rework_parent || '').trim() &&
        !String(task.rework_reason || '').trim()
    ) {
        throw new Error(
            `task ${taskId}: work_type=${task.work_type} requiere rework_parent o rework_reason`
        );
    }
    if (task.decision_ref) {
        const decision = (
            Array.isArray(decisionsData.decisions)
                ? decisionsData.decisions
                : []
        ).find(
            (item) =>
                String(item?.id || '').trim() === String(task.decision_ref)
        );
        if (!decision) {
            throw new Error(
                `task ${taskId}: decision_ref no existe (${task.decision_ref})`
            );
        }
        if (
            String(decision.focus_id || '').trim() &&
            String(decision.focus_id || '').trim() !== focus.id
        ) {
            throw new Error(
                `task ${taskId}: decision_ref fuera del foco activo (${task.decision_ref})`
            );
        }
    }
    return { focus };
}

function parseRequiredCheckToken(token) {
    const safe = String(token || '')
        .trim()
        .toLowerCase();
    if (!safe) return null;
    const [type, ...rest] = safe.split(':');
    const target = rest.join(':').trim();
    if (!type || !target) return null;
    return { id: safe, type, target };
}

function findRuntimeSurfaceVerification(runtimeVerification, target) {
    const safeTarget = normalizeOptionalToken(target);
    if (!safeTarget) return null;
    const surfaces = Array.isArray(runtimeVerification?.surfaces)
        ? runtimeVerification.surfaces
        : [];
    return (
        surfaces.find(
            (surface) => normalizeOptionalToken(surface?.surface) === safeTarget
        ) || null
    );
}

function findRuntimeSurfaceDiagnostic(runtimeVerification, target) {
    const safeTarget = normalizeOptionalToken(target);
    if (!safeTarget) return null;
    const diagnostics = Array.isArray(runtimeVerification?.summary?.diagnostics)
        ? runtimeVerification.summary.diagnostics
        : [];
    return (
        diagnostics.find(
            (item) => normalizeOptionalToken(item?.surface) === safeTarget
        ) || null
    );
}

function isOperatorAuthRecommendedModeHealthy(surface = {}) {
    const target = normalizeOptionalToken(surface?.surface);
    if (target !== 'operator_auth') {
        return false;
    }
    if (Number(surface?.http_status || 0) >= 400) {
        return false;
    }
    const status = normalizeOptionalToken(surface?.status);
    if (!status || status === 'operator_auth_not_configured') {
        return false;
    }
    const mode = normalizeOptionalToken(surface?.mode);
    const details =
        surface?.details && typeof surface.details === 'object'
            ? surface.details
            : {};
    const recommendedMode = normalizeOptionalToken(
        details.recommendedMode || details.recommended_mode
    );
    if (!mode || !recommendedMode || mode !== recommendedMode) {
        return false;
    }
    if (details.configured === false || surface.configured === false) {
        return false;
    }
    return true;
}

function evaluateRuntimeRequiredCheck(check, runtimeVerification) {
    if (!runtimeVerification) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `runtime ${check.target} no verificado`,
        };
    }

    const provider = normalizeOptionalToken(runtimeVerification.provider);
    if (check.target === provider) {
        if (!runtimeVerification.ok) {
            return {
                ...check,
                state: 'red',
                ok: false,
                message: `runtime ${check.target} unhealthy`,
            };
        }
        return {
            ...check,
            state: 'green',
            ok: true,
            message: `runtime ${check.target} healthy`,
        };
    }

    const surface = findRuntimeSurfaceVerification(
        runtimeVerification,
        check.target
    );
    const diagnostic = findRuntimeSurfaceDiagnostic(
        runtimeVerification,
        check.target
    );
    if (!surface) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `runtime ${check.target} no verificado`,
        };
    }

    if (isOperatorAuthRecommendedModeHealthy(surface)) {
        return {
            ...check,
            state: 'green',
            ok: true,
            message: `runtime ${check.target} healthy`,
        };
    }

    if (!surface.healthy) {
        return {
            ...check,
            state: 'red',
            ok: false,
            reason: String(diagnostic?.reason || '').trim(),
            next_action: String(diagnostic?.next_action || '').trim(),
            message:
                String(diagnostic?.message || '').trim() ||
                `runtime ${check.target} ${String(surface.state || 'unhealthy').trim() || 'unhealthy'}`,
        };
    }

    return {
        ...check,
        state: 'green',
        ok: true,
        message: `runtime ${check.target} healthy`,
    };
}

function hasActionableJobRequiredCheck(job = {}) {
    if (!job || typeof job !== 'object') {
        return false;
    }
    if (job.verified !== false) {
        return true;
    }
    if (job.configured === false) {
        return false;
    }
    return Boolean(
        String(job.failure_reason || job.last_error_message || '').trim() ||
        String(job.state || '').trim() === 'failed'
    );
}

function getJobRequiredCheckNextAction(job = {}) {
    const failureReason = String(
        job.failure_reason || job.last_error_message || ''
    ).trim();
    if (/^health_http_\d+$/i.test(failureReason)) {
        return 'revisar /api.php?resource=health y recuperar backend/origen del host publico';
    }
    if (failureReason === 'health_missing_public_sync') {
        return 'desplegar el contrato actualizado de /api.php?resource=health con checks.publicSync';
    }
    if (
        failureReason === 'unverified' &&
        String(job.verification_source || '')
            .trim()
            .toLowerCase() === 'registry_only'
    ) {
        return 'restaurar evidencia host-side de public_main_sync desde health_url antes de seguir cerrando el corte';
    }
    return '';
}

function evaluateRequiredChecks(focus, options = {}) {
    const checks = normalizeArray(focus?.required_checks, { lowerCase: true })
        .map((token) => parseRequiredCheckToken(token))
        .filter(Boolean);
    const jobsSnapshot = Array.isArray(options.jobsSnapshot)
        ? options.jobsSnapshot
        : [];
    const runtimeVerification =
        options.runtimeVerification &&
        typeof options.runtimeVerification === 'object'
            ? options.runtimeVerification
            : null;
    return checks.map((check) => {
        if (check.type === 'job') {
            const job = jobsSnapshot.find(
                (item) =>
                    String(item?.key || '')
                        .trim()
                        .toLowerCase() === check.target
            );
            if (!job || !hasActionableJobRequiredCheck(job)) {
                return {
                    ...check,
                    state: 'unverified',
                    ok: false,
                    message: `job ${check.target} no verificado`,
                };
            }
            if (!job.healthy) {
                const failureReason = String(
                    job.failure_reason || job.last_error_message || ''
                ).trim();
                const nextAction = getJobRequiredCheckNextAction(job);
                return {
                    ...check,
                    state: 'red',
                    ok: false,
                    ...(failureReason ? { reason: failureReason } : {}),
                    ...(nextAction ? { next_action: nextAction } : {}),
                    message: failureReason
                        ? `job ${check.target} unhealthy: ${failureReason}`
                        : `job ${check.target} unhealthy`,
                };
            }
            return {
                ...check,
                state: 'green',
                ok: true,
                message: `job ${check.target} healthy`,
            };
        }
        if (check.type === 'runtime') {
            return evaluateRuntimeRequiredCheck(check, runtimeVerification);
        }
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `required_check no soportado (${check.id})`,
        };
    });
}

function hasRuntimeRequiredCheck(value = {}) {
    const focus = value?.configured ? value.configured : value;
    const checks = normalizeArray(focus?.required_checks, { lowerCase: true });
    return checks.some((item) => item.startsWith('runtime:'));
}

function listPendingRequiredChecks(summary = {}) {
    return Array.isArray(summary?.required_checks)
        ? summary.required_checks.filter(
              (item) => item?.state === 'unverified' || item?.state === 'red'
          )
        : [];
}

function hasPendingRequiredChecks(summary = {}) {
    return listPendingRequiredChecks(summary).length > 0;
}

function buildFocusSummary(board, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const decisionsData =
        options.decisionsData && typeof options.decisionsData === 'object'
            ? options.decisionsData
            : { decisions: [] };
    const focus = getConfiguredFocus(board);
    const activeFocus = getActiveFocus(board);
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const activeTasks = tasks
        .filter((task) => activeStatuses.has(String(task?.status || '').trim()))
        .map((task) => {
            const clone = {
                ...task,
                files: Array.isArray(task?.files) ? [...task.files] : [],
                depends_on: Array.isArray(task?.depends_on)
                    ? [...task.depends_on]
                    : [],
            };
            normalizeTaskFocusFields(clone);
            ensureTaskFocusDefaults(board, clone, { activeStatuses });
            return clone;
        });

    const summary = {
        configured: focus,
        active: activeFocus,
        active_tasks_total: activeTasks.length,
        aligned_tasks: 0,
        forward_tasks_total: 0,
        support_tasks_total: 0,
        blocked_tasks_total: 0,
        blocked_task_ids: [],
        acknowledged_external_blocker: false,
        external_blocker_task_ids: [],
        support_only: false,
        idle: Boolean(activeFocus) && activeTasks.length === 0,
        active_slices: [],
        active_steps: [],
        distinct_active_slices: 0,
        distinct_active_steps: 0,
        too_many_active_slices: false,
        missing_focus_task_ids: [],
        outside_next_step_task_ids: [],
        invalid_slice_task_ids: [],
        rework_without_reason_task_ids: [],
        work_type_counts: {},
        decisions: {
            total: 0,
            open: 0,
            overdue: 0,
            open_ids: [],
            overdue_ids: [],
        },
        required_checks: [],
        required_checks_ok: false,
        release_ready: false,
        blocking_errors: [],
        release_blocking_errors: [],
        warnings: [],
    };

    if (!focus) {
        return summary;
    }

    for (const task of activeTasks) {
        const taskId = String(task.id || '');
        const taskStatus = String(task.status || '').trim().toLowerCase();
        const workType = String(task.work_type || '')
            .trim()
            .toLowerCase();
        if (workType) {
            summary.work_type_counts[workType] =
                Number(summary.work_type_counts[workType] || 0) + 1;
        }
        if (workType === 'forward') {
            summary.forward_tasks_total += 1;
        }
        if (workType === 'support') {
            summary.support_tasks_total += 1;
        }
        if (taskStatus === 'blocked') {
            summary.blocked_tasks_total += 1;
            summary.blocked_task_ids.push(taskId);
            if (isAcknowledgedExternalBlockedTask(task)) {
                summary.external_blocker_task_ids.push(taskId);
            }
        }
        if (!task.focus_id || !task.focus_step || !task.integration_slice) {
            summary.missing_focus_task_ids.push(taskId);
            continue;
        }
        if (task.focus_id !== focus.id) {
            summary.missing_focus_task_ids.push(taskId);
            continue;
        }
        if (task.focus_step !== focus.next_step) {
            summary.outside_next_step_task_ids.push(taskId);
            continue;
        }
        const allowedSlices = getAllowedSlicesForLane(task);
        if (
            !ALLOWED_INTEGRATION_SLICES.has(task.integration_slice) ||
            !allowedSlices.has(task.integration_slice)
        ) {
            summary.invalid_slice_task_ids.push(taskId);
            continue;
        }
        if (
            ['fix', 'refactor'].includes(workType) &&
            !String(task.rework_parent || '').trim() &&
            !String(task.rework_reason || '').trim()
        ) {
            summary.rework_without_reason_task_ids.push(taskId);
            continue;
        }
        summary.aligned_tasks += 1;
        summary.active_slices.push(task.integration_slice);
        summary.active_steps.push(task.focus_step);
    }

    const uniqueSlices = Array.from(new Set(summary.active_slices)).sort();
    const uniqueSteps = Array.from(new Set(summary.active_steps)).sort();
    summary.active_slices = uniqueSlices;
    summary.active_steps = uniqueSteps;
    summary.distinct_active_slices = uniqueSlices.length;
    summary.distinct_active_steps = uniqueSteps.length;
    summary.support_only =
        activeTasks.length > 0 &&
        summary.support_tasks_total === activeTasks.length &&
        summary.forward_tasks_total === 0;
    summary.acknowledged_external_blocker =
        summary.external_blocker_task_ids.length > 0;
    summary.too_many_active_slices =
        uniqueSlices.length >
        normalizeFocusMaxActiveSlices(focus.max_active_slices);

    const nowMs =
        options.now instanceof Date ? options.now.getTime() : Date.now();
    const decisions = (
        Array.isArray(decisionsData.decisions) ? decisionsData.decisions : []
    ).filter(
        (item) =>
            String(item?.focus_id || '').trim() ===
            String(focus.id || '').trim()
    );
    summary.decisions.total = decisions.length;
    for (const decision of decisions) {
        const status = normalizeOptionalToken(decision?.status);
        const id = String(decision?.id || '').trim();
        const dueMs = Date.parse(String(decision?.due_at || ''));
        const overdue =
            status === 'open' && Number.isFinite(dueMs) && dueMs < nowMs;
        if (status === 'open') {
            summary.decisions.open += 1;
            if (id) summary.decisions.open_ids.push(id);
        }
        if (overdue) {
            summary.decisions.overdue += 1;
            if (id) summary.decisions.overdue_ids.push(id);
        }
    }

    summary.required_checks = evaluateRequiredChecks(focus, {
        jobsSnapshot: options.jobsSnapshot,
        runtimeVerification: options.runtimeVerification,
    });
    summary.required_checks_ok =
        summary.required_checks.length > 0 &&
        summary.required_checks.every((item) => item.ok === true);

    if (!activeFocus) {
        summary.warnings.push('strategy_has_no_active_focus');
    }
    if (summary.idle) {
        summary.warnings.push('focus_without_active_tasks');
    }
    if (summary.missing_focus_task_ids.length > 0) {
        summary.blocking_errors.push('task_missing_focus_fields');
    }
    if (summary.outside_next_step_task_ids.length > 0) {
        summary.blocking_errors.push('task_outside_next_step');
    }
    if (summary.invalid_slice_task_ids.length > 0) {
        summary.blocking_errors.push('slice_not_allowed_for_lane');
    }
    if (summary.rework_without_reason_task_ids.length > 0) {
        summary.blocking_errors.push('rework_without_reason');
    }
    if (summary.too_many_active_slices) {
        summary.blocking_errors.push('too_many_active_slices');
    }
    if (
        summary.required_checks.some(
            (item) => item.state === 'unverified' || item.state === 'red'
        )
    ) {
        summary.release_blocking_errors.push('required_check_unverified');
        summary.warnings.push('required_check_unverified');
    }
    if (summary.support_only) {
        summary.warnings.push('support_only_active');
    }
    if (summary.decisions.overdue > 0) {
        summary.warnings.push('decision_overdue');
    }
    summary.release_ready =
        summary.active_tasks_total > 0 &&
        summary.aligned_tasks === summary.active_tasks_total &&
        summary.required_checks_ok &&
        !summary.support_only &&
        summary.blocking_errors.length === 0;

    return summary;
}

async function buildLiveFocusSummary(board, deps = {}) {
    const now = deps.now instanceof Date ? deps.now : new Date();
    const summaryBuilder =
        typeof deps.buildFocusSummary === 'function'
            ? deps.buildFocusSummary
            : buildFocusSummary;
    const decisionsDataRaw =
        typeof deps.parseDecisions === 'function'
            ? deps.parseDecisions()
            : { decisions: [] };
    const decisionsData =
        decisionsDataRaw && typeof decisionsDataRaw === 'object'
            ? decisionsDataRaw
            : { decisions: [] };
    const jobsRaw =
        typeof deps.loadJobsSnapshot === 'function'
            ? await deps.loadJobsSnapshot()
            : [];
    const jobs = Array.isArray(jobsRaw) ? jobsRaw : [];
    const initialSummary = summaryBuilder(board, {
        decisionsData,
        jobsSnapshot: jobs,
        now,
    });
    const runtimeVerification =
        hasRuntimeRequiredCheck(initialSummary) &&
        typeof deps.verifyOpenClawRuntime === 'function'
            ? await deps.verifyOpenClawRuntime()
            : null;
    const summary = summaryBuilder(board, {
        decisionsData,
        jobsSnapshot: jobs,
        runtimeVerification,
        now,
    });

    return {
        decisionsData,
        jobs,
        runtimeVerification,
        summary,
    };
}

function buildFocusSeed(strategy, options = {}) {
    const strategyId = String(strategy?.id || '').trim();
    if (strategyId !== 'STRAT-2026-03-admin-operativo') {
        throw new Error(
            `focus set-active: seed no soportado para estrategia ${strategyId || 'vacia'}`
        );
    }
    const reviewDueAt =
        String(strategy?.review_due_at || '').trim() || '2026-03-21';
    const owner =
        String(strategy?.owner || options.owner || '').trim() || 'ernesto';
    return {
        focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
        focus_title: 'Admin operativo demostrable',
        focus_summary:
            'Unificar admin clinico, quick-nav, queue/turnero piloto y readiness operacional en un solo corte legible.',
        focus_status: 'active',
        focus_proof:
            'Operador inicia sesion, entra al admin, usa quick-nav, revisa queue/turnero piloto y el corte queda respaldado por runtime/deploy verificables',
        focus_steps: [
            'admin_queue_pilot_cut',
            'pilot_readiness_evidence',
            'feedback_trim',
        ],
        focus_next_step: 'admin_queue_pilot_cut',
        focus_required_checks: [
            'job:public_main_sync',
            'runtime:operator_auth',
        ],
        focus_non_goals: [
            'rediseno_publico',
            'expansion_payments',
            'refactor_orchestrator_no_bloqueante',
            'modularizacion_fuera_del_corte',
        ],
        focus_owner: owner,
        focus_review_due_at: reviewDueAt,
        focus_evidence_ref: '',
        focus_max_active_slices: 3,
    };
}

module.exports = {
    ACTIVE_TASK_STATUSES,
    ALLOWED_FOCUS_STATUSES,
    ALLOWED_WORK_TYPES,
    ALLOWED_INTEGRATION_SLICES,
    LANE_ALLOWED_SLICES,
    normalizeFocusStatus,
    normalizeStrategyFocus,
    getConfiguredFocus,
    getActiveFocus,
    normalizeTaskFocusFields,
    getAllowedSlicesForLane,
    ensureTaskFocusDefaults,
    validateFocusConfiguration,
    validateTaskFocusAlignment,
    evaluateRequiredChecks,
    hasRuntimeRequiredCheck,
    listPendingRequiredChecks,
    hasPendingRequiredChecks,
    buildFocusSummary,
    buildLiveFocusSummary,
    buildFocusSeed,
    isAcknowledgedExternalBlockedTask,
};
