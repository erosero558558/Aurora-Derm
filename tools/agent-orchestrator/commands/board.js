'use strict';

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
    } = ctx;
    const subcommand = String(args[0] || 'doctor')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { flags, positionals } = parseFlags(args.slice(1));

    if (subcommand === 'doctor') {
        const board = parseBoard();
        const handoffData = parseHandoffs();
        const conflictAnalysis = analyzeConflicts(
            board.tasks,
            handoffData.handoffs
        );
        const policy = getGovernancePolicy();
        const leasePolicy = normalizeBoardLeasesPolicy(policy);
        const jobs =
            typeof loadJobsSnapshot === 'function'
                ? await loadJobsSnapshot()
                : [];
        const baseReport = buildBoardDoctorReport(
            {
                board,
                policy,
                leasePolicy,
                handoffData,
                conflictAnalysis,
                now: new Date(),
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
            conflictAnalysis,
            metricsSnapshot:
                typeof loadMetricsSnapshot === 'function'
                    ? loadMetricsSnapshot()
                    : null,
            jobsSnapshot: jobs,
        });
        const mergedDiagnostics = [
            ...(Array.isArray(baseReport.diagnostics)
                ? baseReport.diagnostics
                : []),
            ...strategyDiagnostics,
            ...warnFirstDiagnostics,
        ];
        const report = attachDiagnostics(
            {
                ...baseReport,
                strategy_summary: strategySummary,
                leases: listBoardLeases(board, {
                    policy,
                    nowIso: new Date().toISOString(),
                    activeOnly: true,
                }),
            },
            mergedDiagnostics
        );
        const strict = args.includes('--strict') || Boolean(flags.strict);
        if (wantsJson) {
            printJson(report);
            if (strict && report.diagnostics.length > 0) {
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
        if (strict && report.diagnostics.length > 0) {
            throw new Error(
                `board doctor strict: findings=${report.diagnostics.length}`
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

    throw new Error('Uso: node agent-orchestrator.js board <doctor|events>');
}

module.exports = {
    handleBoardCommand,
};
