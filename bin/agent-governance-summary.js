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

function summarize(resultMap) {
    const status = resultMap.status?.json || {};
    const conflicts = resultMap.conflicts?.json || {};
    const handoffStatus = resultMap.handoffsStatus?.json || {};
    const handoffLint = resultMap.handoffsLint?.json || {};
    const codexCheck = resultMap.codexCheck?.json || {};
    const metrics = resultMap.metrics?.json || {};

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

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        root: ROOT,
        overall: {
            ok: blockers.length === 0,
            blockers,
        },
        status: status || null,
        conflicts: conflicts || null,
        handoffs: {
            status: handoffStatus || null,
            lint: handoffLint || null,
        },
        codex_check: codexCheck || null,
        metrics: metrics || null,
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

    lines.push('## Agent Governance Summary');
    lines.push('');
    lines.push(`- Generated: \`${report.generated_at}\``);
    lines.push(`- Overall: ${report.overall.ok ? 'OK' : 'BLOCKED'}`);
    lines.push(
        `- Blockers: ${
            report.overall.blockers.length > 0
                ? report.overall.blockers.map((b) => `\`${b}\``).join(', ')
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
