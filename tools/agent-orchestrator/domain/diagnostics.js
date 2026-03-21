'use strict';

const domainFocus = require('./focus');

function buildStatusRedExplanation(input = {}, deps = {}) {
    const {
        conflictAnalysis,
        handoffData,
        handoffLintErrors,
        codexCheckReport,
        domainHealth,
        domainHealthHistory,
    } = input;
    const { isExpired = () => true, toConflictJsonRecord = (item) => item } =
        deps;

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

function hoursUntil(dateValue, nowMs = Date.now()) {
    const expiresMs = Date.parse(String(dateValue || ''));
    if (!Number.isFinite(expiresMs)) return null;
    return (expiresMs - nowMs) / (1000 * 60 * 60);
}

function getWarnPolicyMap(policy) {
    const warningPolicies = policy?.enforcement?.warning_policies;
    return warningPolicies && typeof warningPolicies === 'object'
        ? warningPolicies
        : {};
}

function warnPolicyEnabled(warnPolicyMap, key) {
    const cfg = warnPolicyMap?.[key];
    return cfg && typeof cfg === 'object' ? cfg.enabled !== false : false;
}

function warnPolicySeverity(warnPolicyMap, key) {
    const severity = String(warnPolicyMap?.[key]?.severity || 'warning')
        .trim()
        .toLowerCase();
    return severity === 'error' ? 'error' : 'warning';
}

function isBroadGlobPath(file) {
    const value = String(file || '').trim();
    if (!value) return false;
    return (
        value === '*' ||
        value === '**' ||
        value === './*' ||
        value === './**' ||
        value.endsWith('/**') ||
        value.endsWith('\\**')
    );
}

function makeDiagnostic(input = {}) {
    return {
        code: String(input.code || 'warn.unknown'),
        severity: String(input.severity || 'warning'),
        source: String(input.source || 'governance'),
        message: String(input.message || ''),
        ...(Array.isArray(input.task_ids) ? { task_ids: input.task_ids } : {}),
        ...(Array.isArray(input.handoff_ids)
            ? { handoff_ids: input.handoff_ids }
            : {}),
        ...(Array.isArray(input.files) ? { files: input.files } : {}),
        ...(input.meta && typeof input.meta === 'object'
            ? { meta: input.meta }
            : {}),
    };
}

function summarizeDiagnostics(diagnostics = []) {
    const list = Array.isArray(diagnostics) ? diagnostics : [];
    let warnings = 0;
    let errors = 0;
    for (const item of list) {
        if (String(item?.severity || '').toLowerCase() === 'error') errors += 1;
        else warnings += 1;
    }
    return {
        diagnostics: list,
        warnings_count: warnings,
        errors_count: errors,
    };
}

function attachDiagnostics(report, diagnostics = []) {
    const base = report && typeof report === 'object' ? report : {};
    return {
        ...base,
        ...summarizeDiagnostics(diagnostics),
    };
}

function getPublicSyncWarnState(
    warnPolicyMap = {},
    key = '',
    fallbackKey = ''
) {
    if (warnPolicyEnabled(warnPolicyMap, key)) {
        return {
            enabled: true,
            severity: warnPolicySeverity(warnPolicyMap, key),
        };
    }
    if (fallbackKey && warnPolicyEnabled(warnPolicyMap, fallbackKey)) {
        return {
            enabled: true,
            severity: warnPolicySeverity(warnPolicyMap, fallbackKey),
        };
    }
    return { enabled: false, severity: 'warning' };
}

function buildPublicSyncDiagnosticMeta(job = {}) {
    return {
        failure_reason: String(job.failure_reason || ''),
        last_error_message: String(job.last_error_message || ''),
        verification_source: String(job.verification_source || ''),
        state: String(job.state || ''),
        operationally_healthy: Boolean(job.operationally_healthy),
        repo_hygiene_issue: Boolean(job.repo_hygiene_issue),
        head_drift: Boolean(job.head_drift),
        telemetry_gap: Boolean(job.telemetry_gap),
        current_head: String(job.current_head || ''),
        remote_head: String(job.remote_head || ''),
        dirty_paths_count: Number.isFinite(Number(job.dirty_paths_count))
            ? Number(job.dirty_paths_count)
            : 0,
        dirty_paths_sample: Array.isArray(job.dirty_paths_sample)
            ? job.dirty_paths_sample
            : [],
    };
}

function buildPublicSyncFailureMessage(job = {}) {
    const parts = [
        `public_main_sync unhealthy: state=${job.state || 'unknown'}`,
        `source=${job.verification_source || 'unknown'}`,
    ];
    const failureReason = String(job.failure_reason || '').trim();
    if (failureReason) {
        parts.push(`reason=${failureReason}`);
        if (failureReason === 'health_missing_public_sync') {
            parts.push('action=deploy_health_public_sync_rollout');
        }
    }
    if (job.head_drift) {
        parts.push('head_drift=true');
        if (job.current_head || job.remote_head) {
            parts.push(
                `current=${job.current_head || 'n/a'}`,
                `remote=${job.remote_head || 'n/a'}`
            );
        }
    }
    if (job.telemetry_gap) {
        parts.push('telemetry_gap=true');
    }
    if (Number(job.dirty_paths_count || 0) > 0) {
        parts.push(`dirty_paths=${Number(job.dirty_paths_count || 0)}`);
    }
    return parts.join(' ');
}

function buildPublicSyncRepoHygieneMessage(job = {}) {
    const parts = [
        `public_main_sync repo hygiene issue: reason=${job.failure_reason || job.last_error_message || 'working_tree_dirty'}`,
        `source=${job.verification_source || 'unknown'}`,
        `dirty_paths=${Number(job.dirty_paths_count || 0)}`,
    ];
    if (
        Array.isArray(job.dirty_paths_sample) &&
        job.dirty_paths_sample.length
    ) {
        parts.push(
            `sample=${job.dirty_paths_sample
                .slice(0, 5)
                .map((item) => String(item || '').trim())
                .filter(Boolean)
                .join(',')}`
        );
    }
    return parts.join(' ');
}

function isPublishVerificationPending(event = {}) {
    return (
        String(event.live_status || '')
            .trim()
            .toLowerCase() === 'pending' ||
        Boolean(event.verification_pending) ||
        String(event.warning_code || '').trim() ===
            'publish_live_verification_pending'
    );
}

function collectLatestPendingPublishEvents(publishEvents = []) {
    const latestByLane = new Map();
    for (const event of Array.isArray(publishEvents) ? publishEvents : []) {
        const lane = String(event?.codex_instance || '').trim();
        if (!lane) continue;
        const previous = latestByLane.get(lane);
        const previousMs = Date.parse(String(previous?.published_at || ''));
        const currentMs = Date.parse(String(event?.published_at || ''));
        if (
            previous &&
            Number.isFinite(previousMs) &&
            Number.isFinite(currentMs) &&
            currentMs < previousMs
        ) {
            continue;
        }
        latestByLane.set(lane, event);
    }
    return Array.from(latestByLane.values()).filter((event) =>
        isPublishVerificationPending(event)
    );
}

function buildPendingPublishMessage(events = []) {
    return `Publish con verificacion live pendiente: ${events
        .map((event) => {
            const lane = String(event.codex_instance || '').trim() || 'unknown';
            const taskId = String(event.task_id || '').trim() || 'n/a';
            const commit = String(event.commit || '').trim();
            return commit ? `${lane}/${taskId}@${commit}` : `${lane}/${taskId}`;
        })
        .join(', ')}`;
}

function buildWarnFirstDiagnostics(input = {}) {
    const {
        source = 'status',
        policy = null,
        board = null,
        handoffData = null,
        decisionsData = null,
        focusSummary = null,
        metricsSnapshot = null,
        policyReport = null,
        jobsSnapshot = null,
        publishEvents = null,
        activeStatuses = new Set(),
        now = new Date(),
    } = input;
    const diagnostics = [];
    const warnPolicyMap = getWarnPolicyMap(policy);
    const nowMs = now instanceof Date ? now.getTime() : Date.now();
    const resolvedFocusSummary =
        focusSummary && typeof focusSummary === 'object'
            ? focusSummary
            : domainFocus.buildFocusSummary(board, {
                  activeStatuses,
                  decisionsData,
                  jobsSnapshot,
                  now,
              });

    if (warnPolicyEnabled(warnPolicyMap, 'active_broad_glob')) {
        const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
        const activeWithBroadGlobs = tasks
            .filter((task) => activeStatuses.has(String(task.status || '')))
            .map((task) => {
                const broadFiles = (
                    Array.isArray(task.files) ? task.files : []
                ).filter(isBroadGlobPath);
                return broadFiles.length > 0
                    ? { taskId: String(task.id || ''), broadFiles }
                    : null;
            })
            .filter(Boolean);
        if (activeWithBroadGlobs.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.board.active_broad_glob',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'active_broad_glob'
                    ),
                    source,
                    message: `Tareas activas con globs amplios: ${activeWithBroadGlobs
                        .map((r) => r.taskId)
                        .join(', ')}`,
                    task_ids: activeWithBroadGlobs.map((r) => r.taskId),
                    files: Array.from(
                        new Set(
                            activeWithBroadGlobs.flatMap((r) => r.broadFiles)
                        )
                    ),
                })
            );
        }
    }

    if (warnPolicyEnabled(warnPolicyMap, 'handoff_expiring_soon')) {
        const thresholdHours = Number(
            warnPolicyMap?.handoff_expiring_soon?.hours_threshold ?? 4
        );
        const handoffs = Array.isArray(handoffData?.handoffs)
            ? handoffData.handoffs
            : [];
        const expiringSoon = handoffs
            .filter(
                (handoff) =>
                    String(handoff.status || '').toLowerCase() === 'active'
            )
            .map((handoff) => ({
                id: String(handoff.id || ''),
                hours_left: hoursUntil(handoff.expires_at, nowMs),
                expires_at: String(handoff.expires_at || ''),
            }))
            .filter(
                (row) =>
                    Number.isFinite(row.hours_left) &&
                    row.hours_left > 0 &&
                    row.hours_left <= thresholdHours
            )
            .sort((a, b) => a.hours_left - b.hours_left);

        if (expiringSoon.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.handoff.expiring_soon',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'handoff_expiring_soon'
                    ),
                    source,
                    message: `Handoffs activos expiran pronto (<=${thresholdHours}h): ${expiringSoon
                        .map((h) => h.id)
                        .join(', ')}`,
                    handoff_ids: expiringSoon.map((h) => h.id),
                    meta: { hours_threshold: thresholdHours },
                })
            );
        }
    }

    if (warnPolicyEnabled(warnPolicyMap, 'metrics_baseline_missing')) {
        const baselineMissing =
            !metricsSnapshot ||
            typeof metricsSnapshot !== 'object' ||
            !metricsSnapshot.baseline;
        if (baselineMissing) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.metrics.baseline_missing',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'metrics_baseline_missing'
                    ),
                    source,
                    message:
                        'No hay baseline explicito en verification/agent-metrics.json',
                })
            );
        }
    }

    if (warnPolicyEnabled(warnPolicyMap, 'policy_unknown_keys')) {
        const unknownKeyWarnings = Array.isArray(policyReport?.warnings)
            ? policyReport.warnings.filter((w) =>
                  /unknown key/i.test(String(w || ''))
              )
            : [];
        if (unknownKeyWarnings.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.policy.unknown_keys',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'policy_unknown_keys'
                    ),
                    source,
                    message: `governance-policy.json contiene keys desconocidas (${unknownKeyWarnings.length})`,
                    meta: { warnings: unknownKeyWarnings.slice(0, 10) },
                })
            );
        }
    }

    if (warnPolicyEnabled(warnPolicyMap, 'retired_executor_active')) {
        const retiredExecutors = Array.isArray(
            policy?.agents?.retired_executors
        )
            ? policy.agents.retired_executors.map((value) =>
                  String(value || '')
                      .trim()
                      .toLowerCase()
              )
            : [];
        const retiredSet = new Set(retiredExecutors);
        const activeRetiredTasks = (
            Array.isArray(board?.tasks) ? board.tasks : []
        )
            .filter((task) =>
                activeStatuses.has(String(task?.status || '').trim())
            )
            .filter((task) =>
                retiredSet.has(
                    String(task?.executor || '')
                        .trim()
                        .toLowerCase()
                )
            );
        if (activeRetiredTasks.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.board.retired_executor_active',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'retired_executor_active'
                    ),
                    source,
                    message: `Tareas activas usan executors retirados: ${activeRetiredTasks
                        .map((task) => String(task.id || ''))
                        .join(', ')}`,
                    task_ids: activeRetiredTasks.map((task) =>
                        String(task.id || '')
                    ),
                })
            );
        }
    }

    if (
        warnPolicyEnabled(warnPolicyMap, 'strategy_without_focus') &&
        board?.strategy?.active &&
        !resolvedFocusSummary.configured
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.strategy_without_focus',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'strategy_without_focus'
                ),
                source,
                message: 'strategy.active no tiene foco compartido configurado',
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'focus_without_active_tasks') &&
        resolvedFocusSummary.idle
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.focus_without_active_tasks',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'focus_without_active_tasks'
                ),
                source,
                message: `focus ${resolvedFocusSummary.configured?.id || 'n/a'} activo sin tareas activas`,
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'missing_next_step') &&
        resolvedFocusSummary.configured &&
        !resolvedFocusSummary.configured.next_step
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.missing_next_step',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'missing_next_step'
                ),
                source,
                message: 'focus configurado sin focus_next_step',
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'task_missing_focus_fields') &&
        resolvedFocusSummary.missing_focus_task_ids.length > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.task_missing_focus_fields',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'task_missing_focus_fields'
                ),
                source,
                message: `Tareas activas sin foco completo: ${resolvedFocusSummary.missing_focus_task_ids.join(', ')}`,
                task_ids: resolvedFocusSummary.missing_focus_task_ids,
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'task_outside_next_step') &&
        resolvedFocusSummary.outside_next_step_task_ids.length > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.task_outside_next_step',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'task_outside_next_step'
                ),
                source,
                message: `Tareas activas fuera de focus_next_step: ${resolvedFocusSummary.outside_next_step_task_ids.join(', ')}`,
                task_ids: resolvedFocusSummary.outside_next_step_task_ids,
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'slice_not_allowed_for_lane') &&
        resolvedFocusSummary.invalid_slice_task_ids.length > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.slice_not_allowed_for_lane',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'slice_not_allowed_for_lane'
                ),
                source,
                message: `Tareas con integration_slice invalido para su lane: ${resolvedFocusSummary.invalid_slice_task_ids.join(', ')}`,
                task_ids: resolvedFocusSummary.invalid_slice_task_ids,
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'too_many_active_slices') &&
        resolvedFocusSummary.too_many_active_slices
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.too_many_active_slices',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'too_many_active_slices'
                ),
                source,
                message: `Focus excede max_active_slices (${resolvedFocusSummary.distinct_active_slices}/${resolvedFocusSummary.configured?.max_active_slices || 3})`,
                meta: {
                    distinct_active_slices:
                        resolvedFocusSummary.distinct_active_slices,
                    max_active_slices:
                        resolvedFocusSummary.configured?.max_active_slices || 3,
                },
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'required_check_unverified') &&
        Array.isArray(resolvedFocusSummary.required_checks)
    ) {
        const pendingChecks = resolvedFocusSummary.required_checks.filter(
            (item) => item.state === 'unverified' || item.state === 'red'
        );
        if (pendingChecks.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.focus.required_check_unverified',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'required_check_unverified'
                    ),
                    source,
                    message: `Required checks del foco no estan verdes: ${pendingChecks
                        .map((item) => {
                            const reason = String(item.reason || '').trim();
                            return reason
                                ? `${item.id}=${item.state}(${reason})`
                                : `${item.id}=${item.state}`;
                        })
                        .join(', ')}`,
                    meta: {
                        checks: pendingChecks,
                    },
                })
            );
        }
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'decision_overdue') &&
        resolvedFocusSummary.decisions.overdue > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.decision_overdue',
                severity: warnPolicySeverity(warnPolicyMap, 'decision_overdue'),
                source,
                message: `Decisiones abiertas vencidas para el foco: ${resolvedFocusSummary.decisions.overdue_ids.join(', ')}`,
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'rework_without_reason') &&
        resolvedFocusSummary.rework_without_reason_task_ids.length > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.focus.rework_without_reason',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'rework_without_reason'
                ),
                source,
                message: `Tareas fix/refactor sin causa de retrabajo: ${resolvedFocusSummary.rework_without_reason_task_ids.join(', ')}`,
                task_ids: resolvedFocusSummary.rework_without_reason_task_ids,
            })
        );
    }

    const hasJobsSnapshot = Array.isArray(jobsSnapshot);
    const publicSyncJob = hasJobsSnapshot
        ? jobsSnapshot.find(
              (job) => String(job?.key || '') === 'public_main_sync'
          )
        : null;
    if (warnPolicyEnabled(warnPolicyMap, 'public_main_sync_unconfigured')) {
        if (
            hasJobsSnapshot &&
            (!publicSyncJob || publicSyncJob.configured === false)
        ) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.jobs.public_main_sync_unconfigured',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'public_main_sync_unconfigured'
                    ),
                    source,
                    message:
                        'public_main_sync no esta configurado o no pudo verificarse',
                })
            );
        }
    }
    if (
        hasJobsSnapshot &&
        publicSyncJob &&
        warnPolicyEnabled(warnPolicyMap, 'public_main_sync_stale') &&
        publicSyncJob.verified !== false &&
        publicSyncJob.age_seconds !== null &&
        publicSyncJob.age_seconds >
            Number(publicSyncJob.expected_max_lag_seconds || 0)
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.jobs.public_main_sync_stale',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'public_main_sync_stale'
                ),
                source,
                message: `public_main_sync stale: age=${publicSyncJob.age_seconds}s max=${publicSyncJob.expected_max_lag_seconds}s`,
            })
        );
    }
    if (
        hasJobsSnapshot &&
        publicSyncJob &&
        warnPolicyEnabled(warnPolicyMap, 'public_main_sync_failed') &&
        publicSyncJob.verified !== false &&
        !publicSyncJob.healthy
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.jobs.public_main_sync_failed',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'public_main_sync_failed'
                ),
                source,
                message: buildPublicSyncFailureMessage(publicSyncJob),
                meta: buildPublicSyncDiagnosticMeta(publicSyncJob),
            })
        );
    }
    const repoHygieneWarning = getPublicSyncWarnState(
        warnPolicyMap,
        'public_main_sync_repo_hygiene',
        'public_main_sync_failed'
    );
    if (
        hasJobsSnapshot &&
        publicSyncJob &&
        repoHygieneWarning.enabled &&
        publicSyncJob.verified !== false &&
        publicSyncJob.repo_hygiene_issue
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.jobs.public_main_sync_repo_hygiene',
                severity: repoHygieneWarning.severity,
                source,
                message: buildPublicSyncRepoHygieneMessage(publicSyncJob),
                meta: buildPublicSyncDiagnosticMeta(publicSyncJob),
            })
        );
    }
    const headDriftWarning = getPublicSyncWarnState(
        warnPolicyMap,
        'public_main_sync_head_drift',
        'public_main_sync_failed'
    );
    if (
        hasJobsSnapshot &&
        publicSyncJob &&
        headDriftWarning.enabled &&
        publicSyncJob.verified !== false &&
        !publicSyncJob.healthy &&
        publicSyncJob.head_drift
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.jobs.public_main_sync_head_drift',
                severity: headDriftWarning.severity,
                source,
                message: `public_main_sync head drift: current=${publicSyncJob.current_head || 'missing'} remote=${publicSyncJob.remote_head || 'missing'}`,
                meta: buildPublicSyncDiagnosticMeta(publicSyncJob),
            })
        );
    }
    const telemetryGapWarning = getPublicSyncWarnState(
        warnPolicyMap,
        'public_main_sync_telemetry_gap',
        'public_main_sync_failed'
    );
    if (
        hasJobsSnapshot &&
        publicSyncJob &&
        telemetryGapWarning.enabled &&
        publicSyncJob.verified !== false &&
        !publicSyncJob.healthy &&
        publicSyncJob.telemetry_gap
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.jobs.public_main_sync_telemetry_gap',
                severity: telemetryGapWarning.severity,
                source,
                message: `public_main_sync telemetry gap: reason=${publicSyncJob.failure_reason || publicSyncJob.last_error_message || 'unknown'} source=${publicSyncJob.verification_source || 'unknown'}`,
                meta: buildPublicSyncDiagnosticMeta(publicSyncJob),
            })
        );
    }
    if (warnPolicyEnabled(warnPolicyMap, 'publish_live_verification_pending')) {
        const pendingPublishEvents =
            collectLatestPendingPublishEvents(publishEvents);
        if (pendingPublishEvents.length > 0) {
            diagnostics.push(
                makeDiagnostic({
                    code: 'warn.publish.live_verification_pending',
                    severity: warnPolicySeverity(
                        warnPolicyMap,
                        'publish_live_verification_pending'
                    ),
                    source,
                    message: buildPendingPublishMessage(pendingPublishEvents),
                    task_ids: pendingPublishEvents.map((event) =>
                        String(event.task_id || '')
                    ),
                    meta: {
                        entries: pendingPublishEvents.map((event) => ({
                            task_id: String(event.task_id || ''),
                            task_family: String(event.task_family || ''),
                            codex_instance: String(event.codex_instance || ''),
                            commit: String(event.commit || ''),
                            published_at: String(event.published_at || ''),
                            live_status: String(event.live_status || ''),
                            verification_pending: Boolean(
                                event.verification_pending
                            ),
                        })),
                    },
                })
            );
        }
    }

    return diagnostics;
}

function buildTaskCreateWarnDiagnostics(input = {}) {
    const {
        source = 'task.create',
        policy = null,
        fromFilesEnabled = false,
        fileInference = null,
        scopeSource = 'default',
        task = null,
    } = input;
    const diagnostics = [];
    const warnPolicyMap = getWarnPolicyMap(policy);

    if (
        warnPolicyEnabled(warnPolicyMap, 'from_files_fallback_default_scope') &&
        fromFilesEnabled &&
        fileInference &&
        String(fileInference.scope || '')
            .trim()
            .toLowerCase() === 'general' &&
        scopeSource === 'from_files'
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.task.from_files_fallback_default_scope',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'from_files_fallback_default_scope'
                ),
                source,
                message:
                    'task create --from-files cayo en scope general (fallback heuristico)',
                task_ids: task?.id ? [String(task.id)] : undefined,
                files: Array.isArray(task?.files) ? task.files : undefined,
                meta: {
                    inferred_scope: String(fileInference.scope || ''),
                    reasons:
                        fileInference?.reasons &&
                        typeof fileInference.reasons === 'object'
                            ? fileInference.reasons
                            : null,
                },
            })
        );
    }

    return diagnostics;
}

module.exports = {
    buildStatusRedExplanation,
    buildWarnFirstDiagnostics,
    buildTaskCreateWarnDiagnostics,
    summarizeDiagnostics,
    attachDiagnostics,
    buildPublicSyncDiagnosticMeta,
    buildPublicSyncFailureMessage,
    buildPublicSyncRepoHygieneMessage,
    makeDiagnostic,
    getWarnPolicyMap,
    warnPolicyEnabled,
    warnPolicySeverity,
    isBroadGlobPath,
};
