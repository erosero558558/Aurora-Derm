'use strict';

const domainFocus = require('./focus');
const boardLeases = require('./board-leases');

const DEFAULT_ACTIVE_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const DEFAULT_SLOT_STATUSES = new Set(['in_progress', 'review', 'blocked']);

function normalizeStringSet(values, fallback) {
    const source =
        values instanceof Set
            ? Array.from(values)
            : Array.isArray(values)
              ? values
              : fallback;
    return new Set(
        source
            .map((value) =>
                String(value || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
    );
}

function buildMessage(taskId, text) {
    return `Task ${taskId} ${text}`;
}

function buildWarning(code, message, extra = {}) {
    return {
        code,
        message,
        ...extra,
    };
}

function buildCandidate(code, task, focus, message, extra = {}) {
    return {
        task_id: String(task?.id || ''),
        code,
        status: String(task?.status || '')
            .trim()
            .toLowerCase(),
        focus_id: String(task?.focus_id || '').trim(),
        focus_step: String(task?.focus_step || '').trim(),
        next_step: String(focus?.next_step || '').trim(),
        from_status: String(task?.status || '')
            .trim()
            .toLowerCase(),
        to_status: 'backlog',
        message,
        ...extra,
    };
}

function buildBlockingFinding(code, task, message, extra = {}) {
    return {
        task_id: String(task?.id || ''),
        code,
        status: String(task?.status || '')
            .trim()
            .toLowerCase(),
        focus_id: String(task?.focus_id || '').trim(),
        focus_step: String(task?.focus_step || '').trim(),
        integration_slice: String(task?.integration_slice || '')
            .trim()
            .toLowerCase(),
        message,
        blocks_write: Boolean(extra.blocks_write),
        ...extra,
    };
}

function collectLeaseFindings(task, options = {}) {
    const {
        nowIso = new Date().toISOString(),
        policy = null,
        slotStatuses = DEFAULT_SLOT_STATUSES,
    } = options;
    const findings = [];
    const status = String(task?.status || '')
        .trim()
        .toLowerCase();
    if (!slotStatuses.has(status)) {
        return findings;
    }

    const leasePolicy = boardLeases.normalizeBoardLeasesPolicy(policy);
    const lease = boardLeases.getTaskLeaseSummary(task, { nowIso });
    const taskId = String(task?.id || '');
    if (
        leasePolicy.required_statuses.includes(status) &&
        lease.has_lease !== true
    ) {
        findings.push(
            buildBlockingFinding(
                'lease_missing_active',
                task,
                buildMessage(taskId, `(${status}) no tiene lease activo`),
                {
                    blocks_write: false,
                    lease_required: true,
                }
            )
        );
        return findings;
    }

    if (lease.has_lease !== true) {
        return findings;
    }

    if (lease.expired) {
        findings.push(
            buildBlockingFinding(
                'lease_expired_active',
                task,
                buildMessage(taskId, `(${status}) tiene lease expirado`),
                {
                    blocks_write: false,
                    lease_id: lease.lease_id,
                    lease_expires_at: lease.lease_expires_at,
                }
            )
        );
    }

    if (
        lease.heartbeat_age_minutes !== null &&
        lease.heartbeat_age_minutes > leasePolicy.heartbeat_stale_minutes
    ) {
        findings.push(
            buildBlockingFinding(
                'heartbeat_stale',
                task,
                buildMessage(
                    taskId,
                    `(${status}) tiene heartbeat stale (${lease.heartbeat_age_minutes}m > ${leasePolicy.heartbeat_stale_minutes}m)`
                ),
                {
                    blocks_write: false,
                    lease_id: lease.lease_id,
                    heartbeat_age_minutes: lease.heartbeat_age_minutes,
                    heartbeat_threshold_minutes:
                        leasePolicy.heartbeat_stale_minutes,
                }
            )
        );
    }

    return findings;
}

function buildBoardSyncReport(board, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString()).trim();
    const activeStatuses = normalizeStringSet(
        options.activeStatuses,
        Array.from(DEFAULT_ACTIVE_STATUSES)
    );
    const slotStatuses = normalizeStringSet(
        options.slotStatuses,
        Array.from(DEFAULT_SLOT_STATUSES)
    );
    const focus = domainFocus.getActiveFocus(board);
    const warnings = [];
    const normalizedCandidates = [];
    const blockingFindings = [];

    if (!focus) {
        warnings.push(
            buildWarning(
                'focus_not_configured',
                'board sync sin foco activo; no hay cola de frente que alinear'
            )
        );
    }

    const focusSteps = Array.isArray(focus?.steps) ? focus.steps : [];
    const nextStep = String(focus?.next_step || '').trim();
    const focusId = String(focus?.id || '').trim();
    const nextStepIndex =
        focusSteps.length > 0 ? focusSteps.indexOf(nextStep) : -1;

    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        const status = String(task?.status || '')
            .trim()
            .toLowerCase();
        if (!activeStatuses.has(status)) {
            continue;
        }

        const taskId = String(task?.id || '');
        const taskFocusId = String(task?.focus_id || '').trim();
        const taskFocusStep = String(task?.focus_step || '').trim();
        const integrationSlice = String(task?.integration_slice || '')
            .trim()
            .toLowerCase();

        if (focus) {
            if (!taskFocusId || !taskFocusStep || !integrationSlice) {
                blockingFindings.push(
                    buildBlockingFinding(
                        'task_missing_focus_fields',
                        task,
                        buildMessage(
                            taskId,
                            'activo sin focus_id, focus_step o integration_slice completos'
                        ),
                        {
                            blocks_write: true,
                        }
                    )
                );
            } else if (taskFocusId !== focusId) {
                blockingFindings.push(
                    buildBlockingFinding(
                        'focus_id_mismatch',
                        task,
                        buildMessage(
                            taskId,
                            `apunta a focus_id=${taskFocusId} en lugar de ${focusId}`
                        ),
                        {
                            blocks_write: true,
                            next_step: nextStep,
                        }
                    )
                );
            } else if (
                focusSteps.length > 0 &&
                !focusSteps.includes(taskFocusStep)
            ) {
                blockingFindings.push(
                    buildBlockingFinding(
                        'focus_step_unknown',
                        task,
                        buildMessage(
                            taskId,
                            `declara focus_step=${taskFocusStep} fuera de focus_steps`
                        ),
                        {
                            blocks_write: true,
                            next_step: nextStep,
                        }
                    )
                );
            } else if (taskFocusStep !== nextStep) {
                const taskStepIndex =
                    focusSteps.length > 0
                        ? focusSteps.indexOf(taskFocusStep)
                        : -1;
                const isFutureStep =
                    nextStepIndex >= 0 &&
                    taskStepIndex >= 0 &&
                    taskStepIndex > nextStepIndex;
                if (status === 'ready' && isFutureStep) {
                    normalizedCandidates.push(
                        buildCandidate(
                            'ready_future_focus_step',
                            task,
                            focus,
                            buildMessage(
                                taskId,
                                `esta ready en ${taskFocusStep}; se puede mover a backlog mientras next_step=${nextStep}`
                            )
                        )
                    );
                } else {
                    blockingFindings.push(
                        buildBlockingFinding(
                            'task_outside_next_step',
                            task,
                            buildMessage(
                                taskId,
                                `sigue activo en ${taskFocusStep} fuera de focus_next_step=${nextStep}`
                            ),
                            {
                                blocks_write: slotStatuses.has(status),
                                next_step: nextStep,
                            }
                        )
                    );
                }
            }
        }

        blockingFindings.push(
            ...collectLeaseFindings(task, {
                nowIso,
                policy: options.policy || null,
                slotStatuses,
            })
        );
    }

    const writeBlockingFindings = blockingFindings.filter(
        (item) => item.blocks_write === true
    );
    return {
        version: 1,
        focus_id: focusId || null,
        focus_next_step: nextStep || null,
        ok: normalizedCandidates.length === 0 && blockingFindings.length === 0,
        check_ok:
            normalizedCandidates.length === 0 && blockingFindings.length === 0,
        write_blocked: writeBlockingFindings.length > 0,
        normalized_candidates: normalizedCandidates,
        blocking_findings: blockingFindings,
        write_blocking_findings: writeBlockingFindings,
        warnings,
        summary: {
            active_tasks_considered: Array.isArray(board?.tasks)
                ? board.tasks.filter((task) =>
                      activeStatuses.has(
                          String(task?.status || '')
                              .trim()
                              .toLowerCase()
                      )
                  ).length
                : 0,
            normalized_total: normalizedCandidates.length,
            blocking_total: blockingFindings.length,
            write_blocking_total: writeBlockingFindings.length,
            warning_total: warnings.length,
        },
    };
}

function applyBoardSync(board, options = {}) {
    const nowIso = String(options.nowIso || new Date().toISOString()).trim();
    const currentDate =
        String(options.currentDate || '').trim() || nowIso.slice(0, 10);
    const preflight = buildBoardSyncReport(board, {
        ...options,
        nowIso,
    });
    const appliedTaskIds = [];

    if (!preflight.write_blocked) {
        const candidateIds = new Set(
            preflight.normalized_candidates.map((item) => item.task_id)
        );
        for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
            const taskId = String(task?.id || '');
            if (!candidateIds.has(taskId)) {
                continue;
            }
            task.status = 'backlog';
            task.updated_at = currentDate;
            appliedTaskIds.push(taskId);
        }
    }

    const postflight = preflight.write_blocked
        ? preflight
        : buildBoardSyncReport(board, {
              ...options,
              nowIso,
          });

    return {
        version: 1,
        ok: preflight.write_blocked !== true,
        applied_total: appliedTaskIds.length,
        applied_task_ids: appliedTaskIds,
        normalized_candidates: preflight.normalized_candidates,
        blocking_findings: postflight.blocking_findings,
        warnings: postflight.warnings,
        summary: postflight.summary,
        write_blocked: preflight.write_blocked,
        write_blocking_findings: preflight.write_blocking_findings,
        check_ok_after_apply: postflight.check_ok,
        preflight,
        postflight,
    };
}

module.exports = {
    DEFAULT_ACTIVE_STATUSES,
    DEFAULT_SLOT_STATUSES,
    buildBoardSyncReport,
    applyBoardSync,
};
