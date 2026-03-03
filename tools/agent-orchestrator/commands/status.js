'use strict';

async function handleStatusCommand(ctx) {
    const {
        args,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        buildExecutorContribution,
        loadMetricsSnapshot,
        normalizeContributionBaseline,
        buildContributionTrend,
        buildDomainHealth,
        getHandoffLintErrors,
        buildCodexCheckReport,
        buildDomainHealthHistorySummary,
        loadDomainHealthHistory,
        getStatusCounts,
        getExecutorCounts,
        buildStatusRedExplanation,
        printJson,
        renderStatusText,
        getContributionSignal,
        formatPpDelta,
        summarizeDiagnostics,
        buildWarnFirstDiagnostics,
        loadJobsSnapshot,
        summarizeJobsSnapshot,
    } = ctx;
    const wantsJson = args.includes('--json');
    const wantsExplainRed = args.includes('--explain-red');
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const conflictAnalysis = analyzeConflicts(
        board.tasks,
        handoffData.handoffs
    );
    const contribution = buildExecutorContribution(board.tasks);
    const metricsSnapshot = loadMetricsSnapshot();
    const contributionBaseline = normalizeContributionBaseline(metricsSnapshot);
    const contributionTrend = buildContributionTrend(
        contribution,
        contributionBaseline
    );
    const domainHealth = buildDomainHealth(
        board.tasks,
        conflictAnalysis,
        handoffData.handoffs
    );
    const handoffLintErrors = wantsExplainRed ? getHandoffLintErrors() : [];
    const codexCheckReport = wantsExplainRed ? buildCodexCheckReport() : null;
    const domainHealthHistory = wantsExplainRed
        ? buildDomainHealthHistorySummary(loadDomainHealthHistory(), 7)
        : null;
    const jobs = typeof loadJobsSnapshot === 'function'
        ? await loadJobsSnapshot()
        : [];
    const data = {
        version: board.version,
        policy: board.policy,
        totals: {
            tasks: board.tasks.length,
            byStatus: getStatusCounts(board.tasks),
            byExecutor: getExecutorCounts(board.tasks),
        },
        contribution,
        contribution_trend: contributionTrend,
        domain_health: domainHealth,
        conflicts: conflictAnalysis.blocking.length,
        conflicts_breakdown: {
            blocking: conflictAnalysis.blocking.length,
            handoff: conflictAnalysis.handoffCovered.length,
            total_pairs: conflictAnalysis.all.length,
        },
        jobs:
            typeof summarizeJobsSnapshot === 'function'
                ? summarizeJobsSnapshot(jobs)
                : null,
    };

    if (wantsExplainRed) {
        data.red_explanation = buildStatusRedExplanation({
            conflictAnalysis,
            handoffData,
            handoffLintErrors,
            codexCheckReport,
            domainHealth,
            domainHealthHistory,
        });
    }

    Object.assign(
        data,
        summarizeDiagnostics(
            buildWarnFirstDiagnostics({
                source: 'status',
                board,
                handoffData,
                conflictAnalysis,
                metricsSnapshot,
                jobsSnapshot: jobs,
            })
        )
    );

    if (wantsJson) {
        printJson(data);
        return;
    }

    process.stdout.write(
        renderStatusText(data, {
            wantsExplainRed,
            getContributionSignal,
            formatPpDelta,
        })
    );
}

module.exports = {
    handleStatusCommand,
};
