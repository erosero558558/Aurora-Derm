'use strict';

const evidenceDiagnostics = require('../domain/evidence');
const domainDiagnostics = require('../domain/diagnostics');

async function handleStatusCommand(ctx) {
    const {
        args,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        buildExecutorContribution,
        buildCodexInstanceSummary,
        buildProviderModeSummary,
        buildRuntimeSurfaceSummary,
        buildStrategyCoverageSummary,
        buildFocusSummary,
        buildLiveFocusSummary,
        parseDecisions,
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
        getGovernancePolicy,
        loadPublishEvents,
        loadModelUsageLedger,
        buildModelUsageSummary,
        collectPremiumGateBlockers,
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
    const codexInstances = buildCodexInstanceSummary(board.tasks);
    const providerModes = buildProviderModeSummary(board.tasks);
    const runtimeSurfaces = buildRuntimeSurfaceSummary(board.tasks);
    const metricsSnapshot = loadMetricsSnapshot();
    const contributionBaseline = normalizeContributionBaseline(metricsSnapshot);
    const contributionTrend = buildContributionTrend(
        contribution,
        contributionBaseline
    );
    const strategy = buildStrategyCoverageSummary(board);
    const now = new Date();
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
    const jobs = Array.isArray(focusData.jobs) ? focusData.jobs : [];
    const decisionsData =
        focusData.decisionsData && typeof focusData.decisionsData === 'object'
            ? focusData.decisionsData
            : { decisions: [] };
    const policy =
        typeof getGovernancePolicy === 'function'
            ? getGovernancePolicy()
            : null;
    const modelUsageLedger =
        typeof loadModelUsageLedger === 'function'
            ? loadModelUsageLedger()
            : [];
    const premiumGateBlockers =
        typeof collectPremiumGateBlockers === 'function'
            ? collectPremiumGateBlockers(board.tasks, {
                  governancePolicy: policy,
                  ledgerEntries: modelUsageLedger,
              })
            : [];
    const modelUsageSummary =
        typeof buildModelUsageSummary === 'function'
            ? buildModelUsageSummary(board.tasks, {
                  governancePolicy: policy,
                  ledgerEntries: modelUsageLedger,
                  blockers: premiumGateBlockers,
              })
            : null;
    const publishEvents =
        typeof loadPublishEvents === 'function' ? loadPublishEvents() : [];
    const evidenceReport = evidenceDiagnostics.buildTerminalEvidenceReport(
        board.tasks
    );
    const data = {
        version: board.version,
        policy: board.policy,
        totals: {
            tasks: board.tasks.length,
            byStatus: getStatusCounts(board.tasks),
            byExecutor: getExecutorCounts(board.tasks),
        },
        strategy,
        focus: focusData.summary,
        codex_instances: codexInstances,
        provider_modes: providerModes,
        runtime_surfaces: runtimeSurfaces,
        contribution,
        contribution_trend: contributionTrend,
        domain_health: domainHealth,
        conflicts: conflictAnalysis.blocking.length,
        conflicts_breakdown: {
            blocking: conflictAnalysis.blocking.length,
            handoff: conflictAnalysis.handoffCovered.length,
            total_pairs: conflictAnalysis.all.length,
        },
        evidence_summary: evidenceReport.summary,
        jobs:
            typeof summarizeJobsSnapshot === 'function'
                ? summarizeJobsSnapshot(jobs)
                : null,
        model_usage_summary: modelUsageSummary,
        premium_subagent_sessions_total:
            modelUsageSummary?.premium_subagent_sessions_total || 0,
        premium_root_exceptions_total:
            modelUsageSummary?.premium_root_exceptions_total || 0,
        premium_by_execution_mode:
            modelUsageSummary?.premium_by_execution_mode || {
                subagent: 0,
                main_thread_exception: 0,
            },
        mini_root_compliance_pct:
            modelUsageSummary?.mini_root_compliance_pct ?? 100,
        premium_budget_remaining: modelUsageSummary
            ? {
                  total_active: modelUsageSummary.active_codex_tasks || 0,
                  premium_budget_total:
                      modelUsageSummary.premium_budget_total_active || 0,
                  premium_budget_remaining:
                      modelUsageSummary.premium_budget_remaining_active || 0,
                  by_task: Array.isArray(modelUsageSummary.active_rows)
                      ? modelUsageSummary.active_rows.map((row) => ({
                            task_id: row.task_id,
                            codex_instance: row.codex_instance,
                            premium_budget: row.premium_budget,
                            premium_calls_used: row.premium_calls_used,
                            premium_budget_remaining:
                                row.premium_budget_remaining,
                            premium_gate_state: row.premium_gate_state,
                        }))
                      : [],
              }
            : null,
        premium_gate_blockers: premiumGateBlockers,
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

    const warnPolicyMap = domainDiagnostics.getWarnPolicyMap(policy);
    const terminalEvidenceDiagnostics =
        domainDiagnostics.warnPolicyEnabled(
            warnPolicyMap,
            'done_without_evidence'
        ) && evidenceReport.summary.debt_count > 0
            ? [
                  domainDiagnostics.makeDiagnostic({
                      code: 'warn.board.done_without_evidence',
                      severity: domainDiagnostics.warnPolicySeverity(
                          warnPolicyMap,
                          'done_without_evidence'
                      ),
                      source: 'status',
                      message: `Deuda de evidencia terminal canónica: ${evidenceReport.summary.debt_count} task(s) con drift`,
                      task_ids: evidenceReport.summary.sample_task_ids,
                      meta: {
                          ...evidenceReport.summary,
                          reasons: evidenceReport.rows
                              .filter((row) => row.debt)
                              .reduce((acc, row) => {
                                  const key = String(row.reason || 'unknown');
                                  acc[key] = Number(acc[key] || 0) + 1;
                                  return acc;
                              }, {}),
                      },
                  }),
              ]
            : [];

    Object.assign(
        data,
        summarizeDiagnostics([
            ...buildWarnFirstDiagnostics({
                source: 'status',
                board,
                handoffData,
                decisionsData,
                focusSummary: focusData.summary,
                conflictAnalysis,
                metricsSnapshot,
                jobsSnapshot: jobs,
                publishEvents,
            }),
            ...terminalEvidenceDiagnostics,
        ])
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
