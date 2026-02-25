'use strict';

function handleMetricsBaselineCommand(ctx) {
    const {
        args = [],
        parseFlags,
        loadMetricsSnapshotStrict,
        normalizeContributionBaseline,
        baselineFromCurrentMetricsSnapshot,
        recalcMetricsDeltaWithBaseline,
        writeMetricsSnapshotFile,
    } = ctx;
    const { positionals, flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const subcommand = String(positionals[0] || '').trim() || 'show';

    if (!['show', 'set', 'reset'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js metrics baseline <show|set|reset> [--from current] [--json]'
        );
    }

    if (subcommand === 'show') {
        const metrics = loadMetricsSnapshotStrict();
        const report = {
            version: 1,
            ok: true,
            action: 'show',
            metrics_path: 'verification/agent-metrics.json',
            baseline: metrics.baseline || null,
            baseline_contribution: normalizeContributionBaseline(metrics),
            baseline_meta: metrics.baseline_meta || null,
        };
        if (wantsJson) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log('Metrics baseline (agent-metrics.json):');
        console.log(`- tasks_total: ${report.baseline?.tasks_total ?? 'n/a'}`);
        console.log(
            `- file_conflicts: ${report.baseline?.file_conflicts ?? 'n/a'}`
        );
        console.log(
            `- file_conflicts_handoff: ${report.baseline?.file_conflicts_handoff ?? 'n/a'}`
        );
        console.log(
            `- traceability_pct: ${report.baseline?.traceability_pct ?? 'n/a'}`
        );
        console.log(
            `- baseline_meta: ${
                report.baseline_meta
                    ? `${report.baseline_meta.source || 'n/a'} @ ${report.baseline_meta.updated_at || 'n/a'}`
                    : 'n/a'
            }`
        );
        return;
    }

    let source = String(flags.from || 'current').trim() || 'current';
    source = source.toLowerCase();
    if (source !== 'current') {
        throw new Error(
            `metrics baseline ${subcommand}: --from invalido (${source}). Use current`
        );
    }

    const metrics = loadMetricsSnapshotStrict();
    const next = { ...metrics };
    const normalized = baselineFromCurrentMetricsSnapshot(metrics);
    next.baseline = normalized.baseline;
    if (normalized.baseline_contribution) {
        next.baseline_contribution = normalized.baseline_contribution;
    }
    next.baseline_meta = {
        source: 'current',
        action: subcommand,
        updated_at: new Date().toISOString(),
    };

    const finalMetrics = recalcMetricsDeltaWithBaseline(next);
    writeMetricsSnapshotFile(finalMetrics);

    const report = {
        version: 1,
        ok: true,
        action: subcommand,
        source: 'current',
        metrics_path: 'verification/agent-metrics.json',
        baseline: finalMetrics.baseline,
        baseline_contribution: normalizeContributionBaseline(finalMetrics),
        baseline_meta: finalMetrics.baseline_meta || null,
        delta: finalMetrics.delta || null,
    };

    if (wantsJson) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    console.log(
        `Metrics baseline ${subcommand} OK (source=current) en verification/agent-metrics.json`
    );
}

function handleMetricsCommand(ctx) {
    const {
        args = [],
        handleMetricsBaselineCommand,
        parseFlags,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        buildExecutorContribution,
        buildDomainHealth,
        existsSync,
        readFileSync,
        METRICS_PATH,
        normalizeContributionBaseline,
        buildContributionTrend,
        loadContributionHistory,
        upsertContributionHistory,
        buildContributionHistorySummary,
        loadDomainHealthHistory,
        upsertDomainHealthHistory,
        buildDomainHealthHistorySummary,
        safeNumber,
        mkdirSync,
        dirname,
        writeFileSync,
        CONTRIBUTION_HISTORY_PATH,
        DOMAIN_HEALTH_HISTORY_PATH,
    } = ctx;
    if (String(args[0] || '').trim() === 'baseline') {
        handleMetricsBaselineCommand({
            ...ctx,
            args: args.slice(1),
        });
        return;
    }
    const { flags } = parseFlags(args);
    const wantsJson = args.includes('--json');
    const profile = String(flags.profile || '')
        .trim()
        .toLowerCase();
    const hasNoWriteFlag = args.includes('--no-write');
    const hasWriteFlag = args.includes('--write');
    const hasDryRunFlag = args.includes('--dry-run');

    if (profile && !['local', 'ci'].includes(profile)) {
        throw new Error(
            `metrics: --profile invalido (${profile}). Use local|ci`
        );
    }
    if (hasNoWriteFlag && hasWriteFlag) {
        throw new Error(
            'metrics: no usar --write y --no-write al mismo tiempo'
        );
    }
    if (hasDryRunFlag && hasWriteFlag) {
        throw new Error('metrics: --dry-run no se puede combinar con --write');
    }

    let noWrite = false;
    if (profile === 'local') noWrite = true;
    if (profile === 'ci') noWrite = false;
    if (hasNoWriteFlag) noWrite = true;
    if (hasWriteFlag) noWrite = false;
    if (hasDryRunFlag) noWrite = true;
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const conflictAnalysis = analyzeConflicts(
        board.tasks,
        handoffData.handoffs
    );
    const blockingConflicts = conflictAnalysis.blocking.length;
    const handoffConflicts = conflictAnalysis.handoffCovered.length;
    const total = board.tasks.length;
    const done = board.tasks.filter((task) => task.status === 'done').length;
    const inProgress = board.tasks.filter(
        (task) => task.status === 'in_progress'
    ).length;
    const contribution = buildExecutorContribution(board.tasks);
    const domainHealth = buildDomainHealth(
        board.tasks,
        conflictAnalysis,
        handoffData.handoffs
    );

    let existing = null;
    if (existsSync(METRICS_PATH)) {
        try {
            existing = JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
        } catch {
            existing = null;
        }
    }

    const baselineContribution =
        normalizeContributionBaseline(existing) || contribution;
    const contributionDelta = buildContributionTrend(
        contribution,
        baselineContribution
    );
    const existingHistory = loadContributionHistory();
    const nextContributionHistory = upsertContributionHistory(
        existingHistory,
        contribution
    );
    const contributionHistorySummary = buildContributionHistorySummary(
        nextContributionHistory,
        7
    );
    const existingDomainHistory = loadDomainHealthHistory();
    const nextDomainHealthHistory = upsertDomainHealthHistory(
        existingDomainHistory,
        domainHealth
    );
    const domainHealthHistorySummary = buildDomainHealthHistorySummary(
        nextDomainHealthHistory,
        7
    );

    const baseline =
        existing && existing.baseline
            ? existing.baseline
            : {
                  tasks_total: total,
                  tasks_with_rework: 0,
                  file_conflicts: blockingConflicts,
                  file_conflicts_handoff: handoffConflicts,
                  non_critical_lead_time_hours_avg: null,
                  coordination_gate_red_rate_pct: null,
                  traceability_pct: 0,
              };

    const traceability =
        total === 0
            ? 100
            : Math.round(
                  (board.tasks.filter(
                      (task) => String(task.acceptance_ref || '').trim() !== ''
                  ).length /
                      total) *
                      100
              );

    const outputFiles = [
        'verification/agent-metrics.json',
        'verification/agent-contribution-history.json',
        'verification/agent-domain-health-history.json',
    ];

    const metrics = {
        version: 1,
        period: {
            timezone: 'America/Guayaquil',
            window_days: 7,
            updated_at: new Date().toISOString(),
        },
        targets:
            existing && existing.targets
                ? existing.targets
                : {
                      rework_reduction_pct: 40,
                      file_conflict_rate_pct_max: 5,
                      non_critical_lead_time_hours_max: 24,
                      coordination_gate_red_rate_pct_max: 10,
                      traceability_pct: 100,
                  },
        baseline: {
            tasks_total: safeNumber(baseline.tasks_total, total),
            tasks_with_rework: safeNumber(baseline.tasks_with_rework, 0),
            file_conflicts: safeNumber(
                baseline.file_conflicts,
                blockingConflicts
            ),
            file_conflicts_handoff: safeNumber(
                baseline.file_conflicts_handoff,
                handoffConflicts
            ),
            non_critical_lead_time_hours_avg:
                baseline.non_critical_lead_time_hours_avg === null
                    ? null
                    : safeNumber(baseline.non_critical_lead_time_hours_avg, 0),
            coordination_gate_red_rate_pct:
                baseline.coordination_gate_red_rate_pct === null
                    ? null
                    : safeNumber(baseline.coordination_gate_red_rate_pct, 0),
            traceability_pct: safeNumber(baseline.traceability_pct, 0),
        },
        current: {
            tasks_total: total,
            tasks_in_progress: inProgress,
            tasks_done: done,
            tasks_with_rework: 0,
            file_conflicts: blockingConflicts,
            file_conflicts_handoff: handoffConflicts,
            non_critical_lead_time_hours_avg: null,
            coordination_gate_red_rate_pct: null,
            traceability_pct: traceability,
        },
        contribution,
        baseline_contribution: baselineContribution,
        contribution_delta: contributionDelta,
        contribution_history: contributionHistorySummary,
        domain_health: domainHealth,
        domain_health_history: domainHealthHistorySummary,
        io: {
            profile: profile || 'default',
            no_write: noWrite,
            dry_run: hasDryRunFlag,
            write_mode: hasDryRunFlag
                ? 'dry-run'
                : noWrite
                  ? 'no-write'
                  : 'write',
            persisted: !noWrite && !hasDryRunFlag,
            output_files: outputFiles,
        },
        delta: {
            tasks_total: total - safeNumber(baseline.tasks_total, total),
            file_conflicts:
                blockingConflicts -
                safeNumber(baseline.file_conflicts, blockingConflicts),
            file_conflicts_handoff:
                handoffConflicts -
                safeNumber(baseline.file_conflicts_handoff, handoffConflicts),
            traceability_pct:
                traceability -
                safeNumber(baseline.traceability_pct, traceability),
        },
    };

    if (!noWrite) {
        mkdirSync(dirname(METRICS_PATH), { recursive: true });
        writeFileSync(
            METRICS_PATH,
            `${JSON.stringify(metrics, null, 4)}\n`,
            'utf8'
        );
        writeFileSync(
            CONTRIBUTION_HISTORY_PATH,
            `${JSON.stringify(nextContributionHistory, null, 4)}\n`,
            'utf8'
        );
        writeFileSync(
            DOMAIN_HEALTH_HISTORY_PATH,
            `${JSON.stringify(nextDomainHealthHistory, null, 4)}\n`,
            'utf8'
        );
    }
    if (wantsJson) {
        console.log(JSON.stringify(metrics, null, 2));
        return;
    }
    if (hasDryRunFlag) {
        console.log(
            `Metricas calculadas (dry-run, profile=${profile || 'default'}).`
        );
        console.log('Archivos de salida (preview):');
        for (const file of outputFiles) {
            console.log(`- ${file}`);
        }
        return;
    }
    if (noWrite) {
        console.log(
            `Metricas calculadas (no-write, profile=${profile || 'default'}).`
        );
        return;
    }
    console.log(
        `Metricas actualizadas en ${METRICS_PATH} (profile=${profile || 'default'})`
    );
}

module.exports = {
    handleMetricsCommand,
    handleMetricsBaselineCommand,
};
