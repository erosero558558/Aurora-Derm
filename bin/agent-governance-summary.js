#!/usr/bin/env node
'use strict';

const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { resolve, dirname } = require('path');
const { spawnSync } = require('child_process');

function parseFlags(argv) {
    const flags = {};
    const positionals = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = String(argv[i]);
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next === undefined || String(next).startsWith('--')) {
            flags[key] = true;
            continue;
        }
        flags[key] = String(next);
        i += 1;
    }
    return { flags, positionals };
}

const { flags } = parseFlags(process.argv.slice(2));
const ROOT = resolve(flags.root || resolve(__dirname, '..'));
const ORCHESTRATOR = resolve(ROOT, 'agent-orchestrator.js');

function ensureDirForFile(path) {
    mkdirSync(dirname(path), { recursive: true });
}

function runOrchestratorJson(args) {
    const result = spawnSync(process.execPath, [ORCHESTRATOR, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');

    let parsed = null;
    let parseError = null;
    try {
        parsed = JSON.parse(stdout);
    } catch (error) {
        parseError = error.message;
    }

    return {
        command: `node agent-orchestrator.js ${args.join(' ')}`,
        args,
        exit_code: typeof result.status === 'number' ? result.status : 1,
        ok: result.status === 0,
        stdout,
        stderr,
        json: parsed,
        json_parse_error: parseError,
    };
}

function computeHealthSignal({
    blockers,
    deltaSummary,
    handoffStatus,
    conflicts,
}) {
    const reasons = [];
    const blockingConflicts = Number(conflicts?.totals?.blocking ?? 0);
    const blockingDelta = Number(deltaSummary?.conflicts_blocking?.delta ?? 0);
    const handoffConflicts = Number(
        deltaSummary?.conflicts_handoff?.current ?? 0
    );
    const handoffDelta = Number(deltaSummary?.conflicts_handoff?.delta ?? 0);
    const activeExpiredHandoffs = Number(
        handoffStatus?.summary?.active_expired ?? 0
    );

    if (Array.isArray(blockers) && blockers.length > 0) {
        reasons.push(`blockers:${blockers.join(',')}`);
    }
    if (blockingConflicts > 0) {
        reasons.push(`blocking_conflicts:${blockingConflicts}`);
    }
    if (blockingDelta > 0) {
        reasons.push(`blocking_conflicts_delta:+${blockingDelta}`);
    }

    if (reasons.length > 0) {
        return { signal: 'RED', reasons };
    }

    if (activeExpiredHandoffs > 0) {
        reasons.push(`handoffs_active_expired:${activeExpiredHandoffs}`);
    }
    if (handoffConflicts > 0) {
        reasons.push(`handoff_conflicts:${handoffConflicts}`);
    }
    if (handoffDelta > 0) {
        reasons.push(`handoff_conflicts_delta:+${handoffDelta}`);
    }

    if (reasons.length > 0) {
        return { signal: 'YELLOW', reasons };
    }

    return { signal: 'GREEN', reasons: ['stable'] };
}

function getContributionSignal(row) {
    const rank = Number(row?.rank ?? 999);
    const weightedDone = Number(row?.weighted_done_points_pct ?? 0);
    const activeTasks = Number(row?.active_tasks ?? 0);

    if (rank === 1 && weightedDone > 0) return 'GREEN';
    if (weightedDone > 0 || activeTasks > 0) return 'YELLOW';
    return 'RED';
}

function formatPpDelta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    if (n > 0) return `+${n}pp`;
    return `${n}pp`;
}

function buildContributionDeltaMap(metrics) {
    if (!metrics || !Array.isArray(metrics?.contribution_delta?.rows))
        return new Map();
    return new Map(
        metrics.contribution_delta.rows.map((row) => [
            String(row.executor || ''),
            row,
        ])
    );
}

function formatPct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    return `${n}%`;
}

function summarize(resultMap) {
    const status = resultMap.status?.json || {};
    const conflicts = resultMap.conflicts?.json || {};
    const handoffStatus = resultMap.handoffsStatus?.json || {};
    const handoffLint = resultMap.handoffsLint?.json || {};
    const codexCheck = resultMap.codexCheck?.json || {};
    const metrics = resultMap.metrics?.json || {};
    const contribution = status?.contribution ||
        metrics?.contribution || { executors: [], ranking: [] };
    const domainHealth =
        status?.domain_health || metrics?.domain_health || null;
    const contributionHistory = metrics?.contribution_history || null;
    const domainHealthHistory = metrics?.domain_health_history || null;

    const blockers = [];
    if (conflicts?.totals?.blocking > 0) blockers.push('conflicts');
    if (handoffLint && handoffLint.ok === false) blockers.push('handoffs_lint');
    if (codexCheck && codexCheck.ok === false) blockers.push('codex_check');
    if (resultMap.status?.json_parse_error) blockers.push('status_parse');
    if (resultMap.conflicts?.json_parse_error) blockers.push('conflicts_parse');
    if (resultMap.handoffsStatus?.json_parse_error)
        blockers.push('handoffs_status_parse');
    if (resultMap.handoffsLint?.json_parse_error)
        blockers.push('handoffs_lint_parse');
    if (resultMap.codexCheck?.json_parse_error)
        blockers.push('codex_check_parse');
    if (resultMap.metrics?.json_parse_error) blockers.push('metrics_parse');

    const topBlocking = Array.isArray(conflicts.conflicts)
        ? conflicts.conflicts
              .filter((item) => !item.exempted_by_handoff)
              .slice(0, 5)
              .map((item) => ({
                  left: item.left?.id || '',
                  right: item.right?.id || '',
                  overlap_files: Array.isArray(item.overlap_files)
                      ? item.overlap_files
                      : [],
                  ambiguous_wildcard_overlap: Boolean(
                      item.ambiguous_wildcard_overlap
                  ),
              }))
        : [];

    const baselineConflicts = Number(metrics?.baseline?.file_conflicts ?? 0);
    const baselineHandoffConflicts = Number(
        metrics?.baseline?.file_conflicts_handoff ?? 0
    );
    const currentConflicts = Number(metrics?.current?.file_conflicts ?? 0);
    const currentHandoffConflicts = Number(
        metrics?.current?.file_conflicts_handoff ?? 0
    );
    const deltaSummary = {
        conflicts_blocking: {
            baseline: baselineConflicts,
            current: currentConflicts,
            delta:
                typeof metrics?.delta?.file_conflicts === 'number'
                    ? metrics.delta.file_conflicts
                    : currentConflicts - baselineConflicts,
        },
        conflicts_handoff: {
            baseline: baselineHandoffConflicts,
            current: currentHandoffConflicts,
            delta:
                typeof metrics?.delta?.file_conflicts_handoff === 'number'
                    ? metrics.delta.file_conflicts_handoff
                    : currentHandoffConflicts - baselineHandoffConflicts,
        },
    };

    const health = computeHealthSignal({
        blockers,
        deltaSummary,
        handoffStatus,
        conflicts,
    });

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        root: ROOT,
        overall: {
            ok: blockers.length === 0,
            blockers,
            signal: health.signal,
            reasons: health.reasons,
        },
        status: status || null,
        conflicts: conflicts || null,
        handoffs: {
            status: handoffStatus || null,
            lint: handoffLint || null,
        },
        codex_check: codexCheck || null,
        metrics: metrics || null,
        contribution: contribution || null,
        contribution_history: contributionHistory || null,
        domain_health: domainHealth || null,
        domain_health_history: domainHealthHistory || null,
        delta_summary: deltaSummary,
        top_blocking_conflicts: topBlocking,
        commands: resultMap,
    };
}

function fmtDelta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    if (n > 0) return `+${n}`;
    return `${n}`;
}

function toMarkdown(report) {
    const lines = [];
    const status = report.status || {};
    const conflicts = report.conflicts || {};
    const handoffStatus = report.handoffs?.status || {};
    const handoffLint = report.handoffs?.lint || {};
    const codexCheck = report.codex_check || {};
    const delta = report.delta_summary || {};
    const contribution = report.contribution || {};
    const contributionHistory = report.contribution_history || {};
    const domainHealth = report.domain_health || {};
    const domainHealthHistory = report.domain_health_history || {};
    const contributionDeltaMap = buildContributionDeltaMap(
        report.metrics || {}
    );
    const contributionRowsByExecutor = new Map(
        Array.isArray(contribution.executors)
            ? contribution.executors.map((row) => [
                  String(row.executor || ''),
                  row,
              ])
            : []
    );

    lines.push('## Agent Governance Summary');
    lines.push('');
    lines.push(`- Generated: \`${report.generated_at}\``);
    lines.push(`- Overall: ${report.overall.ok ? 'OK' : 'BLOCKED'}`);
    lines.push(`- Semaforo: \`${report.overall.signal || 'n/a'}\``);
    lines.push(
        `- Blockers: ${
            report.overall.blockers.length > 0
                ? report.overall.blockers.map((b) => `\`${b}\``).join(', ')
                : 'none'
        }`
    );
    lines.push(
        `- Razones: ${
            Array.isArray(report.overall.reasons) &&
            report.overall.reasons.length > 0
                ? report.overall.reasons.map((r) => `\`${r}\``).join(', ')
                : 'none'
        }`
    );
    lines.push('');

    lines.push('### Delta vs Baseline (Conflicts/Handoffs)');
    lines.push(
        `- Blocking conflicts: baseline=\`${delta.conflicts_blocking?.baseline ?? 'n/a'}\` -> current=\`${delta.conflicts_blocking?.current ?? 'n/a'}\` (delta \`${fmtDelta(delta.conflicts_blocking?.delta)}\`)`
    );
    lines.push(
        `- Handoff conflicts: baseline=\`${delta.conflicts_handoff?.baseline ?? 'n/a'}\` -> current=\`${delta.conflicts_handoff?.current ?? 'n/a'}\` (delta \`${fmtDelta(delta.conflicts_handoff?.delta)}\`)`
    );
    lines.push('');

    if (
        Array.isArray(domainHealth.ranking) &&
        domainHealth.ranking.length > 0
    ) {
        lines.push('### Semaforo Por Dominio');
        for (const row of domainHealth.ranking) {
            const reasons = Array.isArray(row.reasons)
                ? row.reasons.join(', ')
                : 'n/a';
            lines.push(
                `- [${row.signal}] \`${row.domain}\`: tasks=\`${row.tasks_total}\`, active=\`${row.active_tasks}\`, done=\`${row.done_tasks}\`, blocking=\`${row.blocking_conflicts}\`, handoff=\`${row.handoff_conflicts}\` (${reasons})`
            );
        }
        lines.push('');
    }

    if (
        Array.isArray(domainHealthHistory.daily) &&
        domainHealthHistory.daily.length > 0 &&
        Array.isArray(domainHealthHistory.domains)
    ) {
        const preferredDomains = ['calendar', 'chat', 'payments'];
        const histDomains = [
            ...preferredDomains.filter((name) =>
                domainHealthHistory.domains.includes(name)
            ),
            ...domainHealthHistory.domains.filter(
                (name) => !preferredDomains.includes(name)
            ),
        ].slice(0, 6);

        lines.push(
            `### Historico Salud por Dominio (${domainHealthHistory.window_days || 7}d)`
        );
        lines.push(
            `- Snapshots: \`${domainHealthHistory.snapshots_total ?? 'n/a'}\` | Dias en ventana: \`${domainHealthHistory.daily.length}\``
        );
        lines.push('');
        lines.push(
            `| Fecha | G/Y/R | ${histDomains.map((d) => `${d} signal`).join(' | ')} |`
        );
        lines.push(
            `| --- | --- | ${histDomains.map(() => '---').join(' | ')} |`
        );
        for (const day of domainHealthHistory.daily) {
            const counts = day.counts_by_signal || {};
            const gyr = `${Number(counts.GREEN || 0)}/${Number(counts.YELLOW || 0)}/${Number(counts.RED || 0)}`;
            const cols = histDomains.map(
                (domain) => day.domains?.[domain]?.signal || 'n/a'
            );
            lines.push(`| ${day.date} | ${gyr} | ${cols.join(' | ')} |`);
        }
        const windowDelta = domainHealthHistory.window_delta || {};
        if (windowDelta.available && Array.isArray(windowDelta.rows)) {
            lines.push('');
            lines.push(
                `- Delta ventana (${windowDelta.from_date} -> ${windowDelta.to_date}):`
            );
            for (const row of windowDelta.rows) {
                lines.push(
                    `  - \`${row.domain}\`: signal \`${row.signal_from}\` -> \`${row.signal_to}\`, blocking delta \`${fmtDelta(row.blocking_conflicts_delta)}\``
                );
            }
        }
        lines.push('');
    }

    if (contribution.top_executor) {
        lines.push('### Aporte Por Agente');
        lines.push(
            `- Top contributor: \`${contribution.top_executor.executor}\` con \`${contribution.top_executor.weighted_done_points_pct}%\` del completado ponderado`
        );
        const rows = Array.isArray(contribution.ranking)
            ? contribution.ranking.slice(0, 10)
            : [];
        for (const row of rows) {
            const detail =
                contributionRowsByExecutor.get(String(row.executor || '')) ||
                {};
            const deltaRow = contributionDeltaMap.get(
                String(row.executor || '')
            );
            const deltaWeightedDone = deltaRow
                ? formatPpDelta(deltaRow.weighted_done_points_pct_delta)
                : 'n/a';
            const signal = getContributionSignal({
                ...row,
                active_tasks: detail.active_tasks,
            });
            lines.push(
                `- [${signal}] #${row.rank} \`${row.executor}\`: done ponderado=\`${row.weighted_done_points_pct}%\` (delta \`${deltaWeightedDone}\`), tareas done=\`${row.done_tasks_pct}%\``
            );
        }
        lines.push('');
    }

    if (
        Array.isArray(contributionHistory.daily) &&
        contributionHistory.daily.length > 0 &&
        Array.isArray(contributionHistory.executors)
    ) {
        const histExecutors = contributionHistory.executors.slice(0, 6);
        lines.push(
            `### Historico Aporte (${contributionHistory.window_days || 7}d)`
        );
        lines.push(
            `- Snapshots: \`${contributionHistory.snapshots_total ?? 'n/a'}\` | Dias en ventana: \`${contributionHistory.daily.length}\``
        );
        lines.push('');
        lines.push(
            `| Fecha | Top | ${histExecutors.map((name) => `${name} done%`).join(' | ')} |`
        );
        lines.push(
            `| --- | --- | ${histExecutors.map(() => '---').join(' | ')} |`
        );
        for (const day of contributionHistory.daily) {
            const cols = histExecutors.map((executor) =>
                formatPct(day.executors?.[executor]?.weighted_done_points_pct)
            );
            lines.push(
                `| ${day.date} | ${day.top_executor || '-'} | ${cols.join(' | ')} |`
            );
        }
        const weeklyDelta = contributionHistory.weekly_delta || {};
        if (weeklyDelta.available && Array.isArray(weeklyDelta.rows)) {
            lines.push('');
            lines.push(
                `- Delta ventana (${weeklyDelta.from_date} -> ${weeklyDelta.to_date}):`
            );
            for (const row of weeklyDelta.rows) {
                lines.push(
                    `  - \`${row.executor}\`: ${formatPpDelta(
                        row.weighted_done_points_pct_delta
                    )}`
                );
            }
        }
        lines.push('');
    }

    lines.push('### Status');
    lines.push(
        `- Tasks total: \`${status.totals?.tasks ?? 'n/a'}\` | Conflicts blocking: \`${status.conflicts ?? 'n/a'}\` | Handoff conflicts: \`${status.conflicts_breakdown?.handoff ?? 'n/a'}\``
    );
    const byStatus = status.totals?.byStatus || {};
    const byExecutor = status.totals?.byExecutor || {};
    lines.push(
        `- By status: ${
            Object.keys(byStatus).length
                ? Object.entries(byStatus)
                      .map(([k, v]) => `\`${k}\`=${v}`)
                      .join(', ')
                : 'n/a'
        }`
    );
    lines.push(
        `- By executor: ${
            Object.keys(byExecutor).length
                ? Object.entries(byExecutor)
                      .map(([k, v]) => `\`${k}\`=${v}`)
                      .join(', ')
                : 'n/a'
        }`
    );
    lines.push('');

    lines.push('### Gates');
    lines.push(
        `- Conflicts: blocking=\`${conflicts.totals?.blocking ?? 'n/a'}\`, handoff=\`${conflicts.totals?.handoff ?? 'n/a'}\`, pairs=\`${conflicts.totals?.pairs ?? 'n/a'}\``
    );
    lines.push(
        `- Handoffs lint: ${handoffLint.ok === true ? 'OK' : handoffLint.ok === false ? `FAIL (${handoffLint.error_count || 0})` : 'n/a'}`
    );
    lines.push(
        `- Codex mirror: ${codexCheck.ok === true ? 'OK' : codexCheck.ok === false ? `FAIL (${codexCheck.error_count || 0})` : 'n/a'}`
    );
    lines.push(
        `- Handoffs summary: total=\`${handoffStatus.summary?.total ?? 'n/a'}\`, active=\`${handoffStatus.summary?.active ?? 'n/a'}\`, closed=\`${handoffStatus.summary?.closed ?? 'n/a'}\`, active_expired=\`${handoffStatus.summary?.active_expired ?? 'n/a'}\``
    );
    lines.push('');

    if (
        Array.isArray(report.top_blocking_conflicts) &&
        report.top_blocking_conflicts.length > 0
    ) {
        lines.push('### Blocking Conflicts (Top)');
        for (const item of report.top_blocking_conflicts) {
            const files = item.overlap_files.length
                ? item.overlap_files.join(', ')
                : '(wildcard ambiguo)';
            lines.push(`- \`${item.left}\` <-> \`${item.right}\` :: ${files}`);
        }
        lines.push('');
    }

    if (Array.isArray(codexCheck.errors) && codexCheck.errors.length > 0) {
        lines.push('### Codex Check Errors');
        for (const error of codexCheck.errors.slice(0, 10)) {
            lines.push(`- ${error}`);
        }
        lines.push('');
    }

    if (Array.isArray(handoffLint.errors) && handoffLint.errors.length > 0) {
        lines.push('### Handoff Lint Errors');
        for (const error of handoffLint.errors.slice(0, 10)) {
            lines.push(`- ${error}`);
        }
        lines.push('');
    }

    lines.push('### Command Exit Codes');
    for (const [key, data] of Object.entries(report.commands || {})) {
        lines.push(`- \`${key}\`: exit=\`${data.exit_code}\``);
    }
    lines.push('');

    return `${lines.join('\n').trimEnd()}\n`;
}

function writeMaybe(path, content) {
    if (!path) return;
    const resolved = resolve(ROOT, path);
    ensureDirForFile(resolved);
    writeFileSync(resolved, content, 'utf8');
}

function main() {
    if (!existsSync(ORCHESTRATOR)) {
        throw new Error(`No existe orchestrator: ${ORCHESTRATOR}`);
    }

    const commands = {
        status: ['status', '--json'],
        conflicts: ['conflicts', '--json'],
        handoffsStatus: ['handoffs', 'status', '--json'],
        handoffsLint: ['handoffs', 'lint', '--json'],
        codexCheck: ['codex-check', '--json'],
        metrics: ['metrics', '--json'],
    };

    const results = {};
    for (const [key, args] of Object.entries(commands)) {
        results[key] = runOrchestratorJson(args);
    }

    const report = summarize(results);
    const markdown = toMarkdown(report);
    const jsonText = `${JSON.stringify(report, null, 2)}\n`;

    writeMaybe(flags['write-json'], jsonText);
    writeMaybe(flags['write-md'], markdown);

    const format = String(flags.format || 'markdown').toLowerCase();
    if (format === 'json') {
        process.stdout.write(jsonText);
        return;
    }
    if (format === 'markdown' || format === 'md') {
        process.stdout.write(markdown);
        return;
    }

    throw new Error(`Formato no soportado: ${format}`);
}

try {
    main();
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
}
