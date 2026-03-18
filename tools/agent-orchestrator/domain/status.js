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
        strategy: input.strategy || null,
        focus: input.focus || null,
        codex_instances: input.codex_instances || null,
        provider_modes: input.provider_modes || null,
        runtime_surfaces: input.runtime_surfaces || null,
        model_usage_summary: input.model_usage_summary || null,
        premium_budget_remaining: input.premium_budget_remaining || null,
        premium_gate_blockers: input.premium_gate_blockers || [],
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
    if (data?.strategy?.active) {
        lines.push(
            `Estrategia activa: ${data.strategy.active.id} (${data.strategy.active.title || 'sin titulo'})`
        );
        lines.push(
            `Cobertura estrategia: aligned=${data.strategy.aligned_tasks ?? 0}, support=${data.strategy.support_tasks ?? 0}, exception=${data.strategy.exception_tasks ?? 0}, orphan=${data.strategy.orphan_tasks ?? 0}, dispersion=${data.strategy.dispersion_score ?? 0}, slot_tasks=${data.strategy.slot_tasks ?? 0}`
        );
    }
    if (data?.focus?.configured) {
        lines.push(
            `Foco: ${data.focus.configured.id || 'sin id'} (${data.focus.configured.title || 'sin titulo'})`
        );
        lines.push(
            `Foco activo: ${data.focus.active ? 'si' : 'no'} | next_step=${data.focus.configured.next_step || 'n/a'} | active_tasks=${data.focus.active_tasks_total ?? 0} | aligned=${data.focus.aligned_tasks ?? 0} | slices=${data.focus.distinct_active_slices ?? 0}`
        );
    }
    if (data?.jobs) {
        lines.push(
            `Jobs: tracked=${data.jobs.tracked ?? 0}, healthy=${data.jobs.healthy ?? 0}, failing=${data.jobs.failing ?? 0}`
        );
    }
    if (data?.model_usage_summary) {
        lines.push(
            `Model routing: default=${data.model_usage_summary.default_model_tier || 'n/a'}, premium=${data.model_usage_summary.premium_model_tier || 'n/a'}, active_budget_remaining=${data.model_usage_summary.premium_budget_remaining_active ?? 0}, premium_calls=${data.model_usage_summary.premium_calls_total ?? 0}`
        );
        lines.push(
            `Premium mix: zero=${data.model_usage_summary.tasks_zero_premium_pct ?? 0}%, one=${data.model_usage_summary.tasks_one_premium_pct ?? 0}%, two_plus=${data.model_usage_summary.tasks_two_premium_pct ?? 0}%`
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
    if (Array.isArray(data?.model_usage_summary?.by_lane)) {
        lines.push('');
        lines.push('Model routing por lane:');
        for (const row of data.model_usage_summary.by_lane) {
            lines.push(
                `- ${row.codex_instance}: tasks=${row.tasks_total}, active=${row.active_tasks}, closed=${row.closed_tasks}, premium_calls=${row.premium_calls_total}, budget_remaining=${row.premium_budget_remaining}, zero_premium=${row.tasks_zero_premium_pct}%`
            );
        }
    }
    if (Array.isArray(data?.strategy?.rows) && data.strategy.rows.length > 0) {
        lines.push('');
        lines.push('Por subfrente:');
        for (const row of data.strategy.rows) {
            lines.push(
                `- ${row.subfront_id}: active=${row.active_tasks}, slot=${row.slot_tasks ?? 0}, aligned=${row.aligned_tasks}, primary=${row.primary_tasks}, support=${row.support_tasks}, exception=${row.exception_tasks}, orphan=${row.orphan_tasks}`
            );
        }
    }
    if (
        Array.isArray(data?.strategy?.lane_rows) &&
        data.strategy.lane_rows.length > 0
    ) {
        lines.push('');
        lines.push('Por lane:');
        for (const row of data.strategy.lane_rows) {
            lines.push(
                `- ${row.codex_instance}: subfronts=${row.subfront_count}, slot=${row.slot_tasks}/${row.lane_capacity}, available=${row.available_slots}, active=${row.active_tasks}, orphan=${row.orphan_tasks}`
            );
        }
    }
    if (data?.focus?.configured) {
        lines.push('');
        lines.push('Foco compartido:');
        lines.push(`- proof: ${data.focus.configured.proof || 'n/a'}`);
        lines.push(`- next_step: ${data.focus.configured.next_step || 'n/a'}`);
        lines.push(
            `- active_slices: ${
                Array.isArray(data.focus.active_slices) &&
                data.focus.active_slices.length > 0
                    ? data.focus.active_slices.join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- decisions: open=${data.focus.decisions?.open ?? 0}, overdue=${data.focus.decisions?.overdue ?? 0}`
        );
        lines.push(
            `- required_checks: ${
                Array.isArray(data.focus.required_checks) &&
                data.focus.required_checks.length > 0
                    ? data.focus.required_checks
                          .map((item) => `${item.id}=${item.state}`)
                          .join(', ')
                    : 'none'
            }`
        );
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
    if (Array.isArray(data?.premium_gate_blockers)) {
        lines.push('');
        lines.push('Premium gate blockers:');
        if (data.premium_gate_blockers.length === 0) {
            lines.push('- none');
        } else {
            for (const row of data.premium_gate_blockers) {
                lines.push(
                    `- ${row.task_id}: ${Array.isArray(row.blockers) ? row.blockers.join(' | ') : 'unknown blocker'}`
                );
            }
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
