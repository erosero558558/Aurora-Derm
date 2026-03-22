'use strict';

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'board command' } = options;
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

function printBoardJsonError(printJson, error, action = null) {
    const payload = {
        version: 1,
        ok: false,
        command: 'board sync',
        ...(action ? { action } : {}),
        error: String(error?.message || error || 'board_sync_failed'),
        error_code: String(
            error?.error_code || error?.code || 'board_sync_failed'
        ),
    };
    if (payload.error_code === 'board_revision_mismatch') {
        payload.expected_revision = Number(error?.expected_revision);
        payload.actual_revision = Number(error?.actual_revision);
    }
    printJson(payload);
    process.exitCode = 1;
    return payload;
}

function resolveWorkspaceOptions(args = [], flags = {}) {
    if (
        args.includes('--current-only') ||
        Boolean(flags['current-only']) ||
        Boolean(flags.current_only)
    ) {
        return { currentOnly: true, allWorktrees: false };
    }
    return { allWorktrees: true, currentOnly: false };
}

async function handleBoardCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        getGovernancePolicy,
        buildBoardDoctorReport,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        buildFocusSummary,
        buildLiveFocusSummary,
        parseDecisions,
        loadMetricsSnapshot,
        summarizeDiagnostics,
        listBoardLeases,
        buildStrategyCoverageSummary,
        getTaskLeaseSummary,
        makeDiagnostic,
        getWarnPolicyMap,
        warnPolicyEnabled,
        warnPolicySeverity,
        isBroadGlobPath,
        normalizeBoardLeasesPolicy,
        EVENTS_PATH,
        tailBoardEvents,
        statsBoardEvents,
        readJsonlFile,
        printJson = (v) => console.log(JSON.stringify(v, null, 2)),
        loadJobsSnapshot,
        loadPublishEvents,
        buildBoardSyncReport,
        applyBoardSync,
        writeBoardAndSync,
        parseExpectedBoardRevisionFlag,
        collectWorkspaceComplianceFindings,
        buildWorkspaceComplianceDiagnostics,
        collectWorkspaceTruth,
        buildWorkspaceTruthDiagnostics,
        buildBoardReconcileReport,
        applySafeBoardReconcile,
    } = ctx;
    const subcommand = String(args[0] || 'doctor')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { flags, positionals } = parseFlags(args.slice(1));

    if (subcommand === 'sync') {
        const action = String(positionals[0] || 'check')
            .trim()
            .toLowerCase();
        if (!['check', 'apply'].includes(action)) {
            throw new Error(
                'Uso: node agent-orchestrator.js board sync <check|apply> [--expect-rev N] [--json]'
            );
        }

        const board = parseBoard();
        const nowIso = new Date().toISOString();

        if (action === 'check') {
            const report =
                typeof buildBoardSyncReport === 'function'
                    ? buildBoardSyncReport(board, { nowIso })
                    : {
                          version: 1,
                          ok: true,
                          check_ok: true,
                          normalized_candidates: [],
                          blocking_findings: [],
                          warnings: [],
                          summary: {
                              normalized_total: 0,
                              blocking_total: 0,
                              warning_total: 0,
                          },
                      };
            const payload = {
                version: 1,
                ok: Boolean(report.check_ok),
                command: 'board sync',
                action: 'check',
                normalized_candidates: report.normalized_candidates || [],
                blocking_findings: report.blocking_findings || [],
                warnings: report.warnings || [],
                summary: report.summary || {},
            };
            if (wantsJson) {
                printJson(payload);
                if (!payload.ok) process.exitCode = 1;
                return payload;
            }
            console.log('== Board Sync Check ==');
            console.log(
                `ok=${payload.ok} normalized=${payload.summary.normalized_total || 0} blocking=${payload.summary.blocking_total || 0} warnings=${payload.summary.warning_total || 0}`
            );
            for (const item of payload.normalized_candidates) {
                console.log(`- NORMALIZE ${item.task_id}: ${item.message}`);
            }
            for (const item of payload.blocking_findings) {
                console.log(`- BLOCK ${item.task_id}: ${item.message}`);
            }
            for (const item of payload.warnings) {
                console.log(`- WARN ${item.code}: ${item.message}`);
            }
            if (!payload.ok) {
                throw new Error(
                    `board sync check fallo: normalized=${payload.summary.normalized_total || 0}, blocking=${payload.summary.blocking_total || 0}`
                );
            }
            return payload;
        }

        const syncResult =
            typeof applyBoardSync === 'function'
                ? applyBoardSync(board, { nowIso })
                : {
                      ok: true,
                      applied_total: 0,
                      applied_task_ids: [],
                      normalized_candidates: [],
                      blocking_findings: [],
                      warnings: [],
                      summary: {},
                      write_blocked: false,
                      write_blocking_findings: [],
                      check_ok_after_apply: true,
                  };

        if (syncResult.applied_total > 0 && !syncResult.write_blocked) {
            const expectRevision = parseExpectedRevisionFromFlags(
                flags,
                parseExpectedBoardRevisionFlag,
                { required: false, commandLabel: 'board sync apply' }
            );
            try {
                writeBoardAndSync(board, {
                    silentSync: wantsJson,
                    command: 'board sync apply',
                    actor: 'orchestrator',
                    expectRevision,
                });
            } catch (error) {
                if (wantsJson) {
                    return printBoardJsonError(printJson, error, 'apply');
                }
                throw error;
            }
        }

        const payload = {
            version: 1,
            ok: Boolean(syncResult.ok),
            command: 'board sync',
            action: 'apply',
            normalized_candidates: syncResult.normalized_candidates || [],
            applied_total: Number(syncResult.applied_total || 0),
            applied_task_ids: syncResult.applied_task_ids || [],
            blocking_findings: syncResult.blocking_findings || [],
            warnings: syncResult.warnings || [],
            summary: syncResult.summary || {},
            write_blocked: Boolean(syncResult.write_blocked),
            write_blocking_findings: syncResult.write_blocking_findings || [],
            check_ok_after_apply: Boolean(syncResult.check_ok_after_apply),
        };
        if (wantsJson) {
            printJson(payload);
            if (!payload.ok) process.exitCode = 1;
            return payload;
        }
        console.log('== Board Sync Apply ==');
        console.log(
            `ok=${payload.ok} applied=${payload.applied_total} remaining_blocking=${payload.summary.blocking_total || 0} check_ok_after_apply=${payload.check_ok_after_apply}`
        );
        for (const taskId of payload.applied_task_ids) {
            console.log(`- APPLY ${taskId}: moved to backlog`);
        }
        for (const item of payload.blocking_findings) {
            console.log(`- BLOCK ${item.task_id}: ${item.message}`);
        }
        for (const item of payload.warnings) {
            console.log(`- WARN ${item.code}: ${item.message}`);
        }
        if (!payload.ok) {
            throw new Error(
                `board sync apply bloqueado: ${payload.write_blocking_findings
                    .map((item) => item.task_id)
                    .join(', ')}`
            );
        }
        return payload;
    }

    if (subcommand === 'doctor') {
        const board = parseBoard();
        const handoffData = parseHandoffs();
        const conflictAnalysis = analyzeConflicts(
            board.tasks,
            handoffData.handoffs
        );
        const now = new Date();
        const policy = getGovernancePolicy();
        const leasePolicy = normalizeBoardLeasesPolicy(policy);
        const focusData =
            typeof buildLiveFocusSummary === 'function'
                ? await buildLiveFocusSummary(board, { now })
                : {
                      decisionsData:
                          typeof parseDecisions === 'function'
                              ? parseDecisions()
                              : { decisions: [] },
                      jobs:
                          typeof loadJobsSnapshot === 'function'
                              ? await loadJobsSnapshot()
                              : [],
                      runtimeVerification: null,
                      summary:
                          typeof buildFocusSummary === 'function'
                              ? buildFocusSummary(board, {
                                    decisionsData:
                                        typeof parseDecisions === 'function'
                                            ? parseDecisions()
                                            : { decisions: [] },
                                    jobsSnapshot:
                                        typeof loadJobsSnapshot === 'function'
                                            ? await loadJobsSnapshot()
                                            : [],
                                    now,
                                })
                              : null,
                  };
        const jobs = Array.isArray(focusData.jobs) ? focusData.jobs : [];
        const decisionsData =
            focusData.decisionsData &&
            typeof focusData.decisionsData === 'object'
                ? focusData.decisionsData
                : { decisions: [] };
        const baseReport = buildBoardDoctorReport(
            {
                board,
                policy,
                leasePolicy,
                handoffData,
                conflictAnalysis,
                now,
            },
            {
                getTaskLeaseSummary,
                makeDiagnostic,
                getWarnPolicyMap,
                warnPolicyEnabled,
                warnPolicySeverity,
                isBroadGlobPath,
            }
        );
        const strategySummary =
            typeof buildStrategyCoverageSummary === 'function'
                ? buildStrategyCoverageSummary(board)
                : null;
        const focusSummary = focusData.summary;
        const publishEvents =
            typeof loadPublishEvents === 'function' ? loadPublishEvents() : [];
        const workspaceReport =
            typeof collectWorkspaceTruth === 'function'
                ? collectWorkspaceTruth(resolveWorkspaceOptions(args, flags))
                : null;
        const workspaceSyncFindings =
            typeof collectWorkspaceComplianceFindings === 'function'
                ? collectWorkspaceComplianceFindings(board.tasks)
                : [];
        const strategyDiagnostics =
            strategySummary?.active && strategySummary.orphan_tasks > 0
                ? [
                      makeDiagnostic({
                          code: 'warn.board.strategy_orphan_active_task',
                          severity: 'warning',
                          source: 'board doctor',
                          message: `Estrategia activa con ${strategySummary.orphan_tasks} tarea(s) huerfana(s)`,
                          task_ids: strategySummary.orphan_task_ids,
                          meta: {
                              strategy_id: strategySummary.active.id,
                              validation_errors:
                                  strategySummary.validation_errors,
                          },
                      }),
                  ]
                : [];
        const warnFirstDiagnostics = buildWarnFirstDiagnostics({
            source: 'board doctor',
            board,
            handoffData,
            decisionsData,
            focusSummary,
            conflictAnalysis,
            metricsSnapshot:
                typeof loadMetricsSnapshot === 'function'
                    ? loadMetricsSnapshot()
                    : null,
            jobsSnapshot: jobs,
            publishEvents,
        });
        const mergedDiagnostics = [
            ...(Array.isArray(baseReport.diagnostics)
                ? baseReport.diagnostics
                : []),
            ...strategyDiagnostics,
            ...warnFirstDiagnostics,
            ...(
                typeof buildWorkspaceComplianceDiagnostics === 'function'
                    ? buildWorkspaceComplianceDiagnostics(board.tasks, {
                          source: 'board doctor',
                          makeDiagnostic,
                      })
                    : []
            ),
            ...(
                typeof buildWorkspaceTruthDiagnostics === 'function'
                    ? buildWorkspaceTruthDiagnostics(workspaceReport, {
                          source: 'board doctor',
                          makeDiagnostic,
                          getWarnPolicyMap,
                          warnPolicyEnabled,
                          warnPolicySeverity,
                      })
                    : []
            ),
        ];
        const report = attachDiagnostics(
            {
                ...baseReport,
                strategy_summary: strategySummary,
                focus_summary: focusSummary,
                workspace_sync_findings: workspaceSyncFindings,
                leases: listBoardLeases(board, {
                    policy,
                    nowIso: now.toISOString(),
                    activeOnly: true,
                }),
                workspace_hygiene: workspaceReport?.workspace_hygiene || null,
                workspace_truth: workspaceReport?.workspace_truth || null,
            },
            mergedDiagnostics
        );
        report.ok = report.errors_count === 0;
        const strict = args.includes('--strict') || Boolean(flags.strict);
        if (wantsJson) {
            printJson(report);
            if (strict && report.errors_count > 0) {
                process.exitCode = 1;
            }
            return report;
        }
        console.log('== Board Doctor ==');
        console.log(
            `Findings: ${report.diagnostics.length} (warnings=${report.warnings_count}, errors=${report.errors_count})`
        );
        for (const diag of report.diagnostics.slice(0, 20)) {
            console.log(`- ${diag.code}: ${diag.message}`);
        }
        if (strict && report.errors_count > 0) {
            throw new Error(
                `board doctor strict: errors=${report.errors_count}`
            );
        }
        return report;
    }

    if (subcommand === 'reconcile') {
        const canonicalRoot = String(
            flags['canonical-root'] || flags.canonical_root || ''
        ).trim();
        const applySafe =
            args.includes('--apply-safe') || Boolean(flags['apply-safe']) || Boolean(flags.apply_safe);
        const report =
            typeof (applySafe ? applySafeBoardReconcile : buildBoardReconcileReport) ===
            'function'
                ? (applySafe ? applySafeBoardReconcile : buildBoardReconcileReport)({
                      canonicalRoot,
                  })
                : {
                      version: 1,
                      ok: true,
                      command: 'board reconcile',
                      summary: {
                          total_worktrees: 0,
                          metadata_only_candidates: 0,
                          blocking_candidates: 0,
                      },
                  };
        if (wantsJson) {
            printJson(report);
            if (!report.ok) process.exitCode = 1;
            return report;
        }
        console.log('== Board Reconcile ==');
        console.log(
            `ok=${report.ok} canonical=${report.canonical_root || 'n/a'} metadata_only=${report.summary?.metadata_only_candidates || 0} blocking=${report.summary?.blocking_candidates || 0}${applySafe ? ` applied=${report.applied_total || 0}` : ''}`
        );
        for (const row of Array.isArray(report.metadata_only_candidates)
            ? report.metadata_only_candidates
            : []) {
            console.log(`- META ${row.path}: revision=${row.board_revision}`);
        }
        for (const row of Array.isArray(report.blocking_candidates)
            ? report.blocking_candidates
            : []) {
            console.log(
                `- BLOCK ${row.path}: missing=${(row.missing_task_ids || []).join(', ') || 'none'} extra=${(row.extra_task_ids || []).join(', ') || 'none'} divergent=${(row.divergent_task_ids || []).join(', ') || 'none'}`
            );
        }
        if (!report.ok) {
            throw new Error(
                `board reconcile bloqueado: ${report.summary?.blocking_candidates || 0} worktree(s) con drift funcional`
            );
        }
        return report;
    }

    if (subcommand === 'events') {
        const nested = String(positionals[0] || '')
            .trim()
            .toLowerCase();
        if (!['tail', 'stats'].includes(nested)) {
            throw new Error(
                'Uso: node agent-orchestrator.js board events <tail|stats> [--limit N|--days N] [--json]'
            );
        }
        if (nested === 'tail') {
            const limit = Number(flags.limit || 20);
            if (!Number.isFinite(limit) || limit <= 0) {
                throw new Error(
                    'board events tail --limit debe ser numero > 0'
                );
            }
            const events = tailBoardEvents({
                eventsPath: EVENTS_PATH,
                readJsonlFile,
                limit,
            });
            const report = {
                version: 1,
                ok: true,
                command: 'board events tail',
                limit,
                total: events.length,
                events,
                ...summarizeDiagnostics([]),
            };
            if (wantsJson) {
                printJson(report);
                return report;
            }
            console.log(`== Board Events Tail (${events.length}) ==`);
            for (const row of events) {
                console.log(
                    `- ${row.occurred_at || ''} ${row.event_type || ''} ${row.task_id || ''} ${row.actor || ''}`
                );
            }
            return report;
        }
        const days = Number(flags.days || 7);
        if (!Number.isFinite(days) || days <= 0) {
            throw new Error('board events stats --days debe ser numero > 0');
        }
        const report = statsBoardEvents({
            eventsPath: EVENTS_PATH,
            readJsonlFile,
            days,
            nowIso: new Date().toISOString(),
        });
        if (wantsJson) {
            printJson(report);
            return report;
        }
        console.log('== Board Events Stats ==');
        console.log(`Days: ${report.days} total=${report.total}`);
        for (const [name, count] of Object.entries(
            report.by_event_type || {}
        )) {
            console.log(`- ${name}: ${count}`);
        }
        return report;
    }

    throw new Error(
        'Uso: node agent-orchestrator.js board <doctor|events|sync|reconcile>'
    );
}

module.exports = {
    handleBoardCommand,
};
