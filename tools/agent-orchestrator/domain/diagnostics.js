'use strict';

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

function buildWarnFirstDiagnostics(input = {}) {
    const {
        source = 'status',
        policy = null,
        board = null,
        handoffData = null,
        metricsSnapshot = null,
        policyReport = null,
        activeStatuses = new Set(),
        now = new Date(),
    } = input;
    const diagnostics = [];
    const warnPolicyMap = getWarnPolicyMap(policy);
    const nowMs = now instanceof Date ? now.getTime() : Date.now();

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
};
