'use strict';

function buildStatusReport(input = {}) {
    const {
        board,
        conflictAnalysis,
        contribution,
        contributionTrend,
        domainHealth,
        evidenceSummary = null,
        redExplanation = null,
    } = input;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const byStatus = input.byStatus || {};
    const byExecutor = input.byExecutor || {};
    const legacyTerminalExecutorTasks = tasks.filter((task) => {
        const executor = String(task?.executor || '')
            .trim()
            .toLowerCase();
        const status = String(task?.status || '')
            .trim()
            .toLowerCase();
        return (
            ['claude', 'jules', 'kimi'].includes(executor) &&
            ['done', 'failed'].includes(status)
        );
    });

    const data = {
        version: board?.version ?? 1,
        policy: board?.policy || null,
        totals: {
            tasks: tasks.length,
            byStatus,
            byExecutor,
        },
        codex_instances: input.codex_instances || null,
        provider_modes: input.provider_modes || null,
        runtime_surfaces: input.runtime_surfaces || null,
        legacy_terminal_executor_tasks: {
            total: legacyTerminalExecutorTasks.length,
            by_executor: legacyTerminalExecutorTasks.reduce((acc, task) => {
                const executor = String(task?.executor || '')
                    .trim()
                    .toLowerCase();
                acc[executor] = Number(acc[executor] || 0) + 1;
                return acc;
            }, {}),
        },
        contribution: contribution || null,
        contribution_trend: contributionTrend || null,
        domain_health: domainHealth || null,
        conflicts: Number(conflictAnalysis?.blocking?.length || 0),
        conflicts_breakdown: {
            blocking: Number(conflictAnalysis?.blocking?.length || 0),
            handoff: Number(conflictAnalysis?.handoffCovered?.length || 0),
            total_pairs: Number(conflictAnalysis?.all?.length || 0),
        },
        evidence_summary: evidenceSummary || null,
    };
    if (redExplanation) {
        data.red_explanation = redExplanation;
    }
    return data;
}

function renderStatusText(data, options = {}) {
    const {
        wantsExplainRed = false,
        getContributionSignal = () => 'YELLOW',
        formatPpDelta = (v) => String(v),
    } = options;
    const lines = [];
    lines.push('== Agent Orchestrator Status ==');
    lines.push(`Version board: ${data.version}`);
    lines.push(`Total tasks: ${data?.totals?.tasks ?? 0}`);
    lines.push(`Conflicts activos (blocking): ${data?.conflicts ?? 0}`);
    lines.push(
        `Conflicts eximidos por handoff: ${data?.conflicts_breakdown?.handoff ?? 0}`
    );
    if (data?.jobs) {
        lines.push(
            `Jobs: tracked=${data.jobs.tracked ?? 0}, healthy=${data.jobs.healthy ?? 0}, failing=${data.jobs.failing ?? 0}`
        );
    }
    if (data?.evidence_summary) {
        lines.push(
            `Evidence terminal: aligned=${data.evidence_summary.aligned_count ?? 0}/${data.evidence_summary.terminal_tasks ?? 0}, missing_expected=${data.evidence_summary.missing_expected_count ?? 0}, debt=${data.evidence_summary.debt_count ?? 0}`
        );
    }
    if (data?.legacy_terminal_executor_tasks) {
        lines.push(
            `Legacy terminal executors: ${data.legacy_terminal_executor_tasks.total ?? 0}`
        );
    }
    lines.push('');
    lines.push('Por estado:');
    for (const [status, count] of Object.entries(
        data?.totals?.byStatus || {}
    )) {
        lines.push(`- ${status}: ${count}`);
    }
    lines.push('');
    lines.push('Por ejecutor:');
    for (const [executor, count] of Object.entries(
        data?.totals?.byExecutor || {}
    )) {
        lines.push(`- ${executor}: ${count}`);
    }
    if (Array.isArray(data?.codex_instances?.rows)) {
        lines.push('');
        lines.push('Por codex_instance:');
        for (const row of data.codex_instances.rows) {
            lines.push(
                `- ${row.codex_instance}: tasks=${row.tasks}, active=${row.active_tasks}, in_progress=${row.in_progress_tasks}, done=${row.done_tasks}`
            );
        }
    }
    if (Array.isArray(data?.provider_modes?.rows)) {
        lines.push('');
        lines.push('Por provider_mode:');
        for (const row of data.provider_modes.rows) {
            lines.push(
                `- ${row.provider_mode}: tasks=${row.tasks}, active=${row.active_tasks}, in_progress=${row.in_progress_tasks}, done=${row.done_tasks}`
            );
        }
    }
    if (Array.isArray(data?.runtime_surfaces?.rows)) {
        lines.push('');
        lines.push('Por runtime_surface:');
        for (const row of data.runtime_surfaces.rows) {
            lines.push(
                `- ${row.runtime_surface}: tasks=${row.tasks}, active=${row.active_tasks}, in_progress=${row.in_progress_tasks}, done=${row.done_tasks}`
            );
        }
    }

    if (Array.isArray(data?.domain_health?.ranking)) {
        lines.push('');
        lines.push('Semaforo por dominio:');
        if (data?.domain_health?.scoring) {
            lines.push(
                `- Score dominios (ponderado priority): ${data.domain_health.scoring.priority_weighted_score_pct}%`
            );
            lines.push(
                `- Score dominios (ponderado global): ${data.domain_health.scoring.overall_weighted_score_pct}%`
            );
        }
        for (const row of data.domain_health.ranking) {
            lines.push(
                `- [${row.signal}] ${row.domain}: tasks=${row.tasks_total}, active=${row.active_tasks}, blocking=${row.blocking_conflicts}, handoff=${row.handoff_conflicts}`
            );
        }
    }

    if (data?.contribution?.top_executor) {
        const executorsByName = new Map(
            (data.contribution.executors || []).map((row) => [
                row.executor,
                row,
            ])
        );
        const trendByExecutor = new Map(
            Array.isArray(data?.contribution_trend?.rows)
                ? data.contribution_trend.rows.map((row) => [row.executor, row])
                : []
        );
        lines.push('');
        lines.push('Aporte (ranking por completado ponderado):');
        if (data.contribution_trend) {
            lines.push(
                `- Baseline de comparacion: ${data.contribution_trend.baseline_source}`
            );
        } else {
            lines.push(
                '- Baseline de comparacion: n/a (ejecuta `node agent-orchestrator.js metrics` para fijarlo)'
            );
        }
        for (const row of data.contribution.ranking || []) {
            const fullRow = executorsByName.get(row.executor) || row;
            const trendRow = trendByExecutor.get(row.executor);
            const signal = getContributionSignal({
                ...fullRow,
                rank: row.rank,
            });
            const weightedDoneDelta = trendRow
                ? formatPpDelta(trendRow.weighted_done_points_pct_delta)
                : 'n/a';
            lines.push(
                `- [${signal}] #${row.rank} ${row.executor}: ${row.weighted_done_points_pct}% (done ponderado, delta ${weightedDoneDelta} vs baseline), ${row.done_tasks_pct}% (tareas done)`
            );
        }
    }

    if (wantsExplainRed) {
        const explain = data.red_explanation || {};
        lines.push('');
        lines.push('Explain RED (status):');
        lines.push(`- Signal: ${explain.signal || 'n/a'}`);
        lines.push(
            `- Blockers: ${
                Array.isArray(explain.blockers) && explain.blockers.length > 0
                    ? explain.blockers.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- Reasons: ${
                Array.isArray(explain.reasons) && explain.reasons.length > 0
                    ? explain.reasons.join(', ')
                    : 'none'
            }`
        );
        if (
            Array.isArray(explain.top_blocking_conflicts) &&
            explain.top_blocking_conflicts.length > 0
        ) {
            lines.push('- Top blocking conflicts:');
            for (const item of explain.top_blocking_conflicts) {
                const files = Array.isArray(item.overlap_files)
                    ? item.overlap_files.join(', ')
                    : '';
                lines.push(
                    `  - ${item.left?.id || 'n/a'} <-> ${item.right?.id || 'n/a'} :: ${files || '(wildcard ambiguo)'}`
                );
            }
        }
    }

    return `${lines.join('\n')}\n`;
}

module.exports = {
    buildStatusReport,
    renderStatusText,
};
