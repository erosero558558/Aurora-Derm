#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
    DOCTOR_STATE_CLEAN,
    DOCTOR_STATE_ERROR,
    buildDoctorPayload,
    collectWorkspaceDoctor,
    formatIssueSummary,
    getFirstRemediationStep,
} = require('./lib/workspace-hygiene.js');

function parseArgs(argv) {
    const args = {
        command: 'doctor',
        json: false,
        quiet: false,
        allWorktrees: true,
        currentOnly: false,
        applySafe: false,
        includeEntries: false,
        strict: false,
        taskId: '',
        scopePatterns: [],
        showCandidates: false,
    };

    const positionals = [];
    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) continue;

        if (token === '--json') {
            args.json = true;
            continue;
        }
        if (token === '--quiet') {
            args.quiet = true;
            continue;
        }
        if (token === '--all-worktrees') {
            args.allWorktrees = true;
            args.currentOnly = false;
            continue;
        }
        if (token === '--current-only') {
            args.currentOnly = true;
            args.allWorktrees = false;
            continue;
        }
        if (token === '--apply-safe') {
            args.applySafe = true;
            continue;
        }
        if (token === '--include-entries') {
            args.includeEntries = true;
            continue;
        }
        if (token === '--strict') {
            args.strict = true;
            continue;
        }
        if (token === '--show-candidates') {
            args.showCandidates = true;
            continue;
        }
        if (token === '--task-id') {
            args.taskId = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token.startsWith('--task-id=')) {
            args.taskId = token.slice('--task-id='.length).trim();
            continue;
        }
        if (token === '--scope-pattern') {
            const nextPattern = String(argv[index + 1] || '').trim();
            if (nextPattern) {
                args.scopePatterns.push(nextPattern);
            }
            index += 1;
            continue;
        }
        if (token.startsWith('--scope-pattern=')) {
            const nextPattern = token.slice('--scope-pattern='.length).trim();
            if (nextPattern) {
                args.scopePatterns.push(nextPattern);
            }
            continue;
        }

        positionals.push(token);
    }

    if (positionals.length > 0) {
        args.command = positionals[0];
    }

    if (args.command === 'status') {
        args.command = 'doctor';
        args.allWorktrees = true;
        args.currentOnly = false;
    }

    if (args.command === 'fix') {
        args.command = 'doctor';
        args.applySafe = true;
        args.currentOnly = true;
        args.allWorktrees = false;
    }

    return args;
}

function buildPayload(args, cwd) {
    const doctorOptions = {
        allWorktrees: args.allWorktrees,
        currentOnly: args.currentOnly,
        applySafe: args.applySafe,
    };
    if (args.taskId) {
        doctorOptions.scopeTaskId = args.taskId;
    }
    if (Array.isArray(args.scopePatterns) && args.scopePatterns.length > 0) {
        doctorOptions.scopePatterns = args.scopePatterns;
    }
    const diagnosis = collectWorkspaceDoctor(cwd, doctorOptions);
    return buildDoctorPayload(diagnosis, {
        command: 'workspace-hygiene doctor',
        includeEntries: args.includeEntries,
    });
}

function renderSummary(summary) {
    const issueTotals = formatIssueSummary(
        Object.entries(summary.issue_totals?.byCategory || {}).map(
            ([category, count]) => ({ category, count })
        )
    );
    return [
        `worktrees=${summary.total_worktrees}`,
        `dirty=${summary.dirty_worktrees}`,
        `blocked=${summary.blocked_worktrees}`,
        `attention=${summary.attention_worktrees}`,
        `fixable=${summary.fixable_worktrees}`,
        `clean=${summary.clean_worktrees}`,
        `error=${summary.error_worktrees}`,
        issueTotals ? `issues=${issueTotals}` : '',
    ]
        .filter(Boolean)
        .join(' ');
}

function renderScopeContext(scopeContext = {}) {
    const resolution = String(scopeContext.resolution || '').trim() || 'none';
    if (resolution === 'none') {
        return 'none';
    }

    const parts = [resolution];
    if (scopeContext.task_id) {
        parts.push(scopeContext.task_id);
    }
    if (scopeContext.codex_instance) {
        parts.push(scopeContext.codex_instance);
    }
    if (scopeContext.scope) {
        parts.push(`scope=${scopeContext.scope}`);
    }
    if (scopeContext.match_reason) {
        parts.push(scopeContext.match_reason);
    }
    return parts.join(' | ');
}

function renderStrategyContext(strategyContext = {}) {
    const resolution =
        String(strategyContext.resolution || '').trim() || 'none';
    if (resolution === 'none') {
        return 'none';
    }

    const parts = [resolution];
    if (strategyContext.strategy_id) {
        parts.push(strategyContext.strategy_id);
    }
    if (strategyContext.primary_subfront_id) {
        parts.push(strategyContext.primary_subfront_id);
    }
    const scopes = Array.isArray(strategyContext.affected_scopes)
        ? strategyContext.affected_scopes.filter(Boolean)
        : [];
    if (scopes.length > 0) {
        parts.push(`scopes=${scopes.join(',')}`);
    }
    if (strategyContext.match_reason) {
        parts.push(strategyContext.match_reason);
    }
    return parts.join(' | ');
}

function renderLaneContext(laneContext = {}) {
    const resolution = String(laneContext.resolution || '').trim() || 'none';
    if (resolution === 'none') {
        return 'none';
    }

    const parts = [resolution];
    if (laneContext.primary_lane) {
        parts.push(laneContext.primary_lane);
    }
    const lanes = Array.isArray(laneContext.lanes)
        ? laneContext.lanes.filter(Boolean)
        : [];
    if (lanes.length > 0) {
        parts.push(`touched=${lanes.join(',')}`);
    }
    if (laneContext.match_reason) {
        parts.push(laneContext.match_reason);
    }
    return parts.join(' | ');
}

function renderCandidateTasks(candidateTasks = [], showCandidates = false) {
    const safeCandidates = Array.isArray(candidateTasks) ? candidateTasks : [];
    if (safeCandidates.length === 0) {
        return '';
    }
    const labels = safeCandidates.map((candidate) => {
        const parts = [candidate.task_id || '(sin task)'];
        if (showCandidates && candidate.source) {
            parts.push(candidate.source);
        }
        if (showCandidates && candidate.match_count) {
            parts.push(`match=${candidate.match_count}`);
        }
        return parts.join(':');
    });
    return labels.join(', ');
}

function renderRow(row, options = {}) {
    const branch = row.branch || '(unknown)';
    const issues = formatIssueSummary(row.issues || []);
    const firstStep = getFirstRemediationStep(row);
    const parts = [
        path.resolve(row.path),
        `  branch=${branch}`,
        `  overall_state=${row.overall_state}`,
        `  dirty=${row.dirty_total}`,
        `  scope=${renderScopeContext(row.scope_context)}`,
        `  strategy=${renderStrategyContext(row.strategy_context)}`,
        `  lanes=${renderLaneContext(row.lane_context)}`,
    ];

    if (issues) {
        parts.push(`  issues=${issues}`);
    }

    const scopeCounts = formatIssueSummary(
        Object.entries(row.scope_counts || {}).map(([category, count]) => ({
            category,
            count,
        }))
    );
    if (scopeCounts) {
        parts.push(`  scope_counts=${scopeCounts}`);
    }

    const candidateTasks = renderCandidateTasks(
        row.candidate_tasks,
        options.showCandidates
    );
    if (candidateTasks) {
        parts.push(`  candidates=${candidateTasks}`);
    }

    if (Array.isArray(row.split_plan) && row.split_plan.length > 0) {
        parts.push(
            `  split_plan=${row.split_plan.length} :: ${row.split_plan[0].summary}`
        );
    }

    if (firstStep) {
        parts.push(`  first_step=${firstStep.id} -> ${firstStep.command}`);
    }

    if (row.error) {
        parts.push(`  error=${row.error}`);
    }

    if (Array.isArray(row.removed) && row.removed.length > 0) {
        parts.push(`  removed=${row.removed.join(', ')}`);
    }

    return parts.join('\n');
}

function shouldFailStrict(payload) {
    return payload.rows.some((row) => row.overall_state !== DOCTOR_STATE_CLEAN);
}

function shouldFailAliasFix(payload) {
    return payload.rows.some((row) => row.overall_state !== DOCTOR_STATE_CLEAN);
}

function main() {
    const argv = process.argv.slice(2);
    const rawArgs = parseArgs(argv);
    const cwd = process.cwd();

    if (rawArgs.command !== 'doctor') {
        throw new Error(
            'Uso: node bin/workspace-hygiene.js <doctor|status|fix> [--all-worktrees|--current-only] [--apply-safe] [--include-entries] [--task-id <ID>] [--scope-pattern <glob>] [--show-candidates] [--json] [--strict]'
        );
    }

    const payload = buildPayload(rawArgs, cwd);

    if (rawArgs.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else if (!rawArgs.quiet) {
        process.stdout.write(`${renderSummary(payload.summary)}\n`);
        for (const row of payload.rows) {
            process.stdout.write(
                `${renderRow(row, {
                    showCandidates: rawArgs.showCandidates,
                })}\n`
            );
        }
    }

    const invokedAsFix = argv.some(
        (token) => String(token || '').trim() === 'fix'
    );
    if (invokedAsFix && shouldFailAliasFix(payload)) {
        process.exitCode = 1;
        return;
    }

    if (rawArgs.strict && shouldFailStrict(payload)) {
        process.exitCode = 1;
        return;
    }

    const hasErrorState = payload.rows.some(
        (row) => row.overall_state === DOCTOR_STATE_ERROR
    );
    if (hasErrorState) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(
            `${error && error.message ? error.message : 'workspace hygiene failed'}\n`
        );
        process.exit(1);
    }
}

module.exports = {
    buildPayload,
    parseArgs,
    renderCandidateTasks,
    renderLaneContext,
    renderRow,
    renderScopeContext,
    renderStrategyContext,
    renderSummary,
    shouldFailAliasFix,
    shouldFailStrict,
};
