'use strict';

function buildStatusReport(input = {}) {
    const {
        board,
        conflictAnalysis,
        contribution,
        contributionTrend,
        domainHealth,
        redExplanation = null,
    } = input;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const byStatus = input.byStatus || {};
    const byExecutor = input.byExecutor || {};

    const data = {
        version: board?.version ?? 1,
        policy: board?.policy || null,
        totals: {
            tasks: tasks.length,
            byStatus,
            byExecutor,
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
