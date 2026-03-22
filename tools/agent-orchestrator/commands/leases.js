'use strict';

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'comando mutante' } = options;
    if (typeof parseExpectedBoardRevisionFlag !== 'function') return null;
    const parsed = parseExpectedBoardRevisionFlag(flags);
    if (parsed instanceof Error) throw parsed;
    if (required && (parsed === null || parsed === undefined)) {
        const error = new Error(
            `${commandLabel} requiere --expect-rev para evitar carreras de AGENT_BOARD.yaml`
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    return parsed;
}

function printLeasesJsonError(printJson, error, action = null) {
    const payload = {
        version: 1,
        ok: false,
        command: 'leases',
        ...(action ? { action } : {}),
        error: String(error?.message || error || 'leases_failed'),
        error_code: String(error?.error_code || error?.code || 'leases_failed'),
    };
    if (payload.error_code === 'board_revision_mismatch') {
        payload.expected_revision = Number(error?.expected_revision);
        payload.actual_revision = Number(error?.actual_revision);
    }
    printJson(payload);
    process.exitCode = 1;
    return payload;
}

function createBoardRevisionMismatchError(expectedRevision, actualRevision) {
    const error = new Error(
        `board revision mismatch: expected ${expectedRevision}, actual ${actualRevision}`
    );
    error.code = 'board_revision_mismatch';
    error.error_code = 'board_revision_mismatch';
    error.expected_revision = expectedRevision;
    error.actual_revision = actualRevision;
    return error;
}

function handleLeasesCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        currentDate,
        isoNow,
        writeBoardAndSync,
        toTaskJson,
        getGovernancePolicy,
        listBoardLeases,
        renewTaskLease,
        clearTaskLease,
        normalizeBoardLeasesPolicy,
        parseExpectedBoardRevisionFlag,
        summarizeDiagnostics,
        makeDiagnostic,
        ensureTaskWorktree,
        captureTaskWorkspace,
        applyWorkspaceTaskSnapshot,
        mirrorWorkspaceBoard,
        printJson = (v) => console.log(JSON.stringify(v, null, 2)),
    } = ctx;
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { positionals, flags } = parseFlags(args.slice(1));

    if (!['status', 'heartbeat', 'clear'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js leases <status|heartbeat|clear> [...]'
        );
    }

    const policy = getGovernancePolicy ? getGovernancePolicy() : null;
    const leasePolicy = normalizeBoardLeasesPolicy
        ? normalizeBoardLeasesPolicy(policy)
        : null;

    if (subcommand === 'status') {
        const board = parseBoard();
        const activeOnly = args.includes('--active');
        const expiredOnly = args.includes('--expired');
        const { rows, summary } = listBoardLeases(board, {
            policy,
            activeOnly,
            expiredOnly,
            nowIso: isoNow(),
        });
        const diagnostics = [];
        for (const row of rows) {
            if (row.required && !row.has_lease) {
                diagnostics.push(
                    makeDiagnostic({
                        code: 'warn.board.lease_missing_active',
                        severity: 'warning',
                        source: 'leases status',
                        message: `Task ${row.task_id} (${row.status}) sin lease`,
                        task_ids: [row.task_id],
                    })
                );
            }
            if (row.tracked && row.expired) {
                diagnostics.push(
                    makeDiagnostic({
                        code: 'warn.board.lease_expired_active',
                        severity: 'warning',
                        source: 'leases status',
                        message: `Task ${row.task_id} con lease expirado`,
                        task_ids: [row.task_id],
                    })
                );
            }
        }
        const report = {
            version: 1,
            ok: true,
            command: 'leases',
            action: 'status',
            filters: {
                active: activeOnly,
                expired: expiredOnly,
            },
            summary,
            leases: rows,
            ...summarizeDiagnostics(diagnostics),
        };
        if (wantsJson) {
            printJson(report);
            return report;
        }
        console.log('== Leases Status ==');
        console.log(
            `Tasks tracked: ${summary.lease_tracked_tasks || summary.active_tracked || 0}, missing=${summary.active_required_missing || 0}, expired=${summary.active_expired || 0}`
        );
        for (const row of rows) {
            console.log(
                `- ${row.task_id} [${row.status}] lease=${row.has_lease ? row.lease_id : 'none'} owner=${row.lease_owner || 'n/a'} expired=${row.expired ? 'yes' : 'no'}`
            );
        }
        return report;
    }

    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!taskId) {
        throw new Error(`leases ${subcommand} requiere <task_id>`);
    }
    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const nowIso = isoNow();

    if (subcommand === 'heartbeat') {
        const trackedStatuses = new Set(
            Array.isArray(leasePolicy?.tracked_statuses)
                ? leasePolicy.tracked_statuses
                : ['in_progress', 'review', 'blocked']
        );
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        if (!trackedStatuses.has(status)) {
            throw new Error(
                `leases heartbeat requiere task en tracked_statuses (${Array.from(trackedStatuses).join(', ')})`
            );
        }
        const ttlRaw = flags['ttl-hours'] ?? flags.ttl_hours;
        const ttlHours = ttlRaw === undefined ? undefined : Number(ttlRaw);
        if (
            ttlRaw !== undefined &&
            (!Number.isFinite(ttlHours) || ttlHours <= 0)
        ) {
            throw new Error('leases heartbeat --ttl-hours debe ser numero > 0');
        }
        const leaseOwner = String(task.owner || task.lease_owner || '').trim();
        const leaseResult = renewTaskLease(task, {
            nowIso,
            ttlHours,
            leasePolicy,
            leaseOwner,
            reason: 'leases_heartbeat',
        });
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'leases heartbeat' }
        );
        const currentRevisionRaw = Number(board?.policy?.revision);
        const currentRevision =
            Number.isInteger(currentRevisionRaw) && currentRevisionRaw >= 0
                ? currentRevisionRaw
                : 0;
        if (
            expectRevision !== null &&
            expectRevision !== undefined &&
            Number(expectRevision) !== currentRevision
        ) {
            const error = createBoardRevisionMismatchError(
                Number(expectRevision),
                currentRevision
            );
            if (wantsJson) {
                return printLeasesJsonError(printJson, error, 'heartbeat');
            }
            throw error;
        }
        let workspaceCapture = null;
        if (
            String(task.executor || '')
                .trim()
                .toLowerCase() === 'codex' &&
            typeof captureTaskWorkspace === 'function'
        ) {
            try {
                workspaceCapture = captureTaskWorkspace(taskId);
            } catch (error) {
                if (
                    String(error?.error_code || error?.code || '') ===
                        'workspace_task_worktree_missing' &&
                    typeof ensureTaskWorktree === 'function'
                ) {
                    workspaceCapture = ensureTaskWorktree(taskId);
                } else {
                    throw error;
                }
            }
            if (typeof applyWorkspaceTaskSnapshot === 'function') {
                applyWorkspaceTaskSnapshot(task, workspaceCapture);
            }
        }
        task.updated_at = currentDate();
        try {
            writeBoardAndSync(board, { silentSync: wantsJson, expectRevision });
            if (
                String(task.executor || '')
                    .trim()
                    .toLowerCase() === 'codex' &&
                typeof mirrorWorkspaceBoard === 'function'
            ) {
                mirrorWorkspaceBoard();
            }
        } catch (error) {
            if (wantsJson) {
                return printLeasesJsonError(printJson, error, 'heartbeat');
            }
            throw error;
        }
        const report = {
            version: 1,
            ok: true,
            command: 'leases',
            action: 'heartbeat',
            task: toTaskJson(task),
            workspace: workspaceCapture
                ? {
                      snapshot_checked_at:
                          workspaceCapture.snapshot?.checked_at || null,
                      sync_state:
                          workspaceCapture.task_row?.sync_state || null,
                  }
                : null,
            lease_action: leaseResult.action,
            lease: leaseResult.lease,
        };
        if (wantsJson) {
            printJson(report);
            return report;
        }
        console.log(
            `Lease heartbeat OK: ${taskId} (${leaseResult.action}) expires=${leaseResult.lease.lease_expires_at}`
        );
        return report;
    }

    const reason = String(flags.reason || '').trim();
    if (!reason) {
        throw new Error('leases clear requiere --reason');
    }
    const leaseResult = clearTaskLease(task, {
        nowIso,
        reason,
    });
    task.updated_at = currentDate();
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'leases clear' }
    );
    try {
        writeBoardAndSync(board, { silentSync: wantsJson, expectRevision });
    } catch (error) {
        if (wantsJson) {
            return printLeasesJsonError(printJson, error, 'clear');
        }
        throw error;
    }
    const report = {
        version: 1,
        ok: true,
        command: 'leases',
        action: 'clear',
        task: toTaskJson(task),
        lease_action: leaseResult.action,
        lease: leaseResult.lease,
    };
    if (wantsJson) {
        printJson(report);
        return report;
    }
    console.log(`Lease clear OK: ${taskId} (${leaseResult.action})`);
    return report;
}

module.exports = {
    handleLeasesCommand,
};
