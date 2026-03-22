#!/usr/bin/env node
'use strict';

const { writeFileSync, mkdirSync, existsSync, readFileSync } = require('fs');
const { resolve, dirname } = require('path');
const { spawnSync } = require('child_process');
const coreFlags = require('../tools/agent-orchestrator/core/flags');
const corePolicy = require('../tools/agent-orchestrator/core/policy');
const domainDiagnostics = require('../tools/agent-orchestrator/domain/diagnostics');
const domainMetrics = require('../tools/agent-orchestrator/domain/metrics');
const { flags } = coreFlags.parseFlags(process.argv.slice(2));
const ROOT = resolve(flags.root || resolve(__dirname, '..'));
const ORCHESTRATOR = resolve(ROOT, 'agent-orchestrator.js');
const GOVERNANCE_POLICY_PATH = resolve(ROOT, 'governance-policy.json');
const DEFAULT_GOVERNANCE_POLICY = {
    version: 1,
    agents: {
        active_executors: ['codex', 'ci'],
        retired_executors: ['claude', 'jules', 'kimi'],
        allow_legacy_terminal_executors: true,
    },
    publishing: {
        enabled: true,
        mode: 'main_auto_guarded',
        trigger: 'validated_checkpoint',
        branch: 'main',
        gate_profile: 'fast_targeted',
        checkpoint_cooldown_seconds: 90,
        max_live_wait_seconds: 180,
        health_url: 'https://pielarmonia.com/api.php?resource=health',
        required_job_key: 'public_main_sync',
    },
    domain_health: {
        priority_domains: ['calendar', 'chat', 'payments'],
        domain_weights: {
            calendar: 5,
            chat: 3,
            payments: 2,
            default: 1,
        },
        signal_scores: {
            GREEN: 100,
            YELLOW: 60,
            RED: 0,
        },
    },
    summary: {
        thresholds: {
            domain_score_priority_yellow_below: 80,
        },
    },
    enforcement: {
        branch_profiles: {
            pull_request: { fail_on_red: 'error' },
            main: { fail_on_red: 'error' },
            staging: { fail_on_red: 'error' },
            workflow_dispatch: { fail_on_red: 'error' },
        },
        warning_policies: {
            active_broad_glob: { severity: 'warning', enabled: true },
            handoff_expiring_soon: {
                severity: 'warning',
                enabled: true,
                hours_threshold: 4,
            },
            workspace_board_fork: { severity: 'error', enabled: true },
            workspace_mixed_lane_authored: {
                severity: 'error',
                enabled: true,
            },
            workspace_out_of_scope_authored: {
                severity: 'error',
                enabled: true,
            },
            metrics_baseline_missing: { severity: 'warning', enabled: true },
            from_files_fallback_default_scope: {
                severity: 'warning',
                enabled: true,
            },
            policy_unknown_keys: { severity: 'warning', enabled: true },
            lease_missing_active: { severity: 'warning', enabled: true },
            lease_expired_active: { severity: 'error', enabled: true },
            heartbeat_stale: { severity: 'warning', enabled: true },
            task_in_progress_stale: { severity: 'warning', enabled: true },
            task_blocked_stale: { severity: 'warning', enabled: true },
            done_without_evidence: { severity: 'error', enabled: true },
            retired_executor_active: { severity: 'warning', enabled: true },
            public_main_sync_unconfigured: {
                severity: 'warning',
                enabled: true,
            },
            public_main_sync_stale: { severity: 'warning', enabled: true },
            public_main_sync_failed: { severity: 'warning', enabled: true },
            strategy_without_focus: { severity: 'warning', enabled: true },
            focus_without_active_tasks: {
                severity: 'warning',
                enabled: true,
            },
            missing_next_step: { severity: 'warning', enabled: true },
            task_missing_focus_fields: {
                severity: 'warning',
                enabled: true,
            },
            task_outside_next_step: { severity: 'warning', enabled: true },
            slice_not_allowed_for_lane: {
                severity: 'warning',
                enabled: true,
            },
            too_many_active_slices: {
                severity: 'warning',
                enabled: true,
            },
            required_check_unverified: {
                severity: 'warning',
                enabled: true,
            },
            support_only_active: { severity: 'warning', enabled: true },
            decision_overdue: { severity: 'warning', enabled: true },
            rework_without_reason: {
                severity: 'warning',
                enabled: true,
            },
            wip_limit_executor: { severity: 'warning', enabled: true },
            wip_limit_scope: { severity: 'warning', enabled: true },
            codex_active_without_cdx_mirror: {
                severity: 'error',
                enabled: true,
            },
            codex_support_without_active_cdx: {
                severity: 'error',
                enabled: true,
            },
        },
        workspace_hygiene: {
            enabled: true,
            default_scope: 'all-worktrees',
            mutation_scope: 'all-worktrees',
            block_states: ['blocked', 'error'],
            allow_unavailable: true,
        },
        board_leases: {
            enabled: true,
            required_statuses: ['in_progress', 'review'],
            tracked_statuses: ['in_progress', 'review', 'blocked'],
            ttl_hours_default: 4,
            ttl_hours_max: 24,
            heartbeat_stale_minutes: 30,
            auto_clear_on_terminal: true,
        },
        board_doctor: {
            enabled: true,
            strict_default: false,
            thresholds: {
                in_progress_stale_hours: 24,
                blocked_stale_hours: 24,
                review_stale_hours: 48,
                done_without_evidence_max_hours: 1,
            },
        },
        wip_limits: {
            enabled: true,
            mode: 'warn',
            count_statuses: ['in_progress', 'review', 'blocked'],
            by_executor: {
                codex: 3,
                ci: 2,
            },
            by_scope: {
                calendar: 2,
                payments: 2,
                auth: 2,
                default: 4,
            },
        },
    },
};
const GOVERNANCE_POLICY_CACHE_REF = { current: null };

function ensureDirForFile(path) {
    mkdirSync(dirname(path), { recursive: true });
}

function getGovernancePolicy() {
    return corePolicy.getGovernancePolicy({
        cacheRef: GOVERNANCE_POLICY_CACHE_REF,
        existsSync,
        readFileSync,
        policyPath: GOVERNANCE_POLICY_PATH,
        defaultPolicy: DEFAULT_GOVERNANCE_POLICY,
    });
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

function computeDomainSignal({ domainHealth, domainHealthHistory }) {
    const governancePolicy = getGovernancePolicy();
    const domainPriorityYellowThreshold = Number(
        governancePolicy?.summary?.thresholds
            ?.domain_score_priority_yellow_below ?? 80
    );
    const reasons = [];
    const priorityDomainScore = Number(
        domainHealth?.scoring?.priority_weighted_score_pct ?? NaN
    );
    const overallDomainScore = Number(
        domainHealth?.scoring?.overall_weighted_score_pct ?? NaN
    );
    const greenToRedRegressions = Array.isArray(
        domainHealthHistory?.regressions?.green_to_red
    )
        ? domainHealthHistory.regressions.green_to_red
        : [];
    const redDomains = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking.filter(
              (row) => String(row.signal || '') === 'RED'
          )
        : [];

    if (greenToRedRegressions.length > 0) {
        reasons.push(
            `domain_regression_green_to_red:${greenToRedRegressions.length}`
        );
    }
    if (redDomains.length > 0) {
        reasons.push(
            `domain_red:${redDomains.map((row) => String(row.domain)).join(',')}`
        );
    }
    if (reasons.length > 0) {
        return {
            signal: 'RED',
            reasons,
            domain_weighted_score_pct: Number.isFinite(priorityDomainScore)
                ? priorityDomainScore
                : null,
            domain_weighted_score_global_pct: Number.isFinite(
                overallDomainScore
            )
                ? overallDomainScore
                : null,
            domain_regression_green_to_red: greenToRedRegressions.length,
        };
    }
    if (
        Number.isFinite(priorityDomainScore) &&
        priorityDomainScore < domainPriorityYellowThreshold
    ) {
        reasons.push(`domain_score_priority:${priorityDomainScore}%`);
    }

    if (reasons.length > 0) {
        return {
            signal: 'YELLOW',
            reasons,
            domain_weighted_score_pct: Number.isFinite(priorityDomainScore)
                ? priorityDomainScore
                : null,
            domain_weighted_score_global_pct: Number.isFinite(
                overallDomainScore
            )
                ? overallDomainScore
                : null,
            domain_regression_green_to_red: greenToRedRegressions.length,
        };
    }

    return {
        signal: 'GREEN',
        reasons: ['stable'],
        domain_weighted_score_pct: Number.isFinite(priorityDomainScore)
            ? priorityDomainScore
            : null,
        domain_weighted_score_global_pct: Number.isFinite(overallDomainScore)
            ? overallDomainScore
            : null,
        domain_regression_green_to_red: greenToRedRegressions.length,
    };
}

function computeExecutionState({
    blockers = [],
    diagnosticsSummary = { warnings_count: 0, errors_count: 0 },
    status = {},
}) {
    const blockedTasks = Number(status?.totals?.byStatus?.blocked ?? 0);
    const focus = status?.focus || {};
    const structuralFocusErrors = Array.isArray(focus.blocking_errors)
        ? focus.blocking_errors
        : [];
    const externalBlockerTaskIds = Array.isArray(focus.external_blocker_task_ids)
        ? focus.external_blocker_task_ids
        : [];
    const acknowledgedExternalBlocker =
        Boolean(focus.acknowledged_external_blocker) ||
        externalBlockerTaskIds.length > 0;
    const pendingRequiredChecks = Boolean(
        Array.isArray(focus.required_checks) &&
            focus.required_checks.length > 0 &&
            focus.required_checks_ok === false
    );
    const reasons = [];

    if (Array.isArray(blockers) && blockers.length > 0) {
        reasons.push(`blockers:${blockers.join(',')}`);
    }
    if (diagnosticsSummary.errors_count > 0) {
        reasons.push(`diagnostics_error:${diagnosticsSummary.errors_count}`);
    }
    if (structuralFocusErrors.length > 0) {
        reasons.push(`focus_blocking_errors:${structuralFocusErrors.join(',')}`);
    }
    if (acknowledgedExternalBlocker) {
        reasons.push(
            `acknowledged_external_blocker:${externalBlockerTaskIds.join(',')}`
        );
    } else if (blockedTasks > 0) {
        reasons.push(`blocked_tasks:${blockedTasks}`);
    }

    let state = 'READY';
    if (reasons.length > 0) {
        state = 'BLOCKED';
    } else if (
        diagnosticsSummary.warnings_count > 0 ||
        pendingRequiredChecks ||
        focus.support_only === true
    ) {
        state = 'DEGRADED';
        if (pendingRequiredChecks) {
            reasons.push('required_checks_pending');
        }
        if (focus.support_only === true) {
            reasons.push('support_only_active');
        }
        if (diagnosticsSummary.warnings_count > 0) {
            reasons.push(`warnings:${diagnosticsSummary.warnings_count}`);
        }
    } else {
        reasons.push('ready');
    }

    return {
        state,
        reasons,
        blocked_tasks: blockedTasks,
        acknowledged_external_blocker: acknowledgedExternalBlocker,
        external_blocker_task_ids: externalBlockerTaskIds,
    };
}

function getContributionSignal(row) {
    return domainMetrics.getContributionSignal(row);
}

function formatPpDelta(value) {
    return domainMetrics.formatPpDelta(value);
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

function collectDiagnostics(sources) {
    const grouped = new Map();
    for (const source of sources) {
        const list = Array.isArray(source?.diagnostics)
            ? source.diagnostics
            : [];
        for (const item of list) {
            const code = String(item?.code || '').trim();
            const message = String(item?.message || '').trim();
            const severity = String(item?.severity || 'warning')
                .trim()
                .toLowerCase();
            const scope = String(item?.scope || 'structural')
                .trim()
                .toLowerCase();
            const key = [code, message, severity, scope].join('\u0000');
            const nextSources = Array.isArray(item?.sources)
                ? item.sources
                : [String(item?.source || '').trim()].filter(Boolean);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    ...item,
                    scope,
                    severity,
                    source: String(item?.source || '').trim(),
                    sources: Array.from(new Set(nextSources)),
                });
                continue;
            }
            const existing = grouped.get(key);
            existing.sources = Array.from(
                new Set([...(existing.sources || []), ...nextSources])
            );
            if (Array.isArray(item?.task_ids) && item.task_ids.length > 0) {
                existing.task_ids = Array.from(
                    new Set([
                        ...(existing.task_ids || []),
                        ...item.task_ids.map((value) => String(value || '')),
                    ])
                );
            }
            if (
                Array.isArray(item?.handoff_ids) &&
                item.handoff_ids.length > 0
            ) {
                existing.handoff_ids = Array.from(
                    new Set([
                        ...(existing.handoff_ids || []),
                        ...item.handoff_ids.map((value) =>
                            String(value || '')
                        ),
                    ])
                );
            }
            if (Array.isArray(item?.files) && item.files.length > 0) {
                existing.files = Array.from(
                    new Set([
                        ...(existing.files || []),
                        ...item.files.map((value) => String(value || '')),
                    ])
                );
            }
        }
    }
    const out = Array.from(grouped.values());
    let warnings = 0;
    let errors = 0;
    for (const item of out) {
        if (String(item?.severity || '').toLowerCase() === 'error') errors += 1;
        else warnings += 1;
    }
    return { diagnostics: out, warnings_count: warnings, errors_count: errors };
}

function formatPct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    return `${n}%`;
}

function evaluatePolicyResults(report) {
    const overallOk = report?.overall?.ok === true;
    const signal = String(report?.overall?.signal || '');
    return {
        strict: {
            pass: overallOk,
            reason: overallOk ? 'no_blockers' : 'blockers_present',
        },
        fail_on_red: {
            pass: signal !== 'RED',
            reason: signal !== 'RED' ? 'signal_not_red' : 'signal_red',
        },
    };
}

function ensurePolicies(report) {
    if (!report || typeof report !== 'object') return report;
    if (
        report.policies &&
        report.policies.strict &&
        report.policies.fail_on_red
    ) {
        return report;
    }
    return {
        ...report,
        policies: evaluatePolicyResults(report),
    };
}

function buildRedExplanation(report) {
    const conflicts = report?.conflicts || {};
    const handoffLint = report?.handoffs?.lint || {};
    const handoffStatus = report?.handoffs?.status || {};
    const codexCheck = report?.codex_check || {};
    const domainHealth = report?.domain_health || {};
    const domainHealthHistory = report?.domain_health_history || {};
    const topBlocking = Array.isArray(report?.top_blocking_conflicts)
        ? report.top_blocking_conflicts
        : [];
    const regressions = Array.isArray(
        domainHealthHistory?.regressions?.green_to_red
    )
        ? domainHealthHistory.regressions.green_to_red
        : [];
    const redDomains = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking
              .filter((row) => String(row.signal || '') === 'RED')
              .map((row) => ({
                  domain: String(row.domain || ''),
                  signal: String(row.signal || ''),
                  blocking_conflicts: Number(row.blocking_conflicts || 0),
                  handoff_conflicts: Number(row.handoff_conflicts || 0),
                  reasons: Array.isArray(row.reasons) ? row.reasons : [],
              }))
        : [];

    return {
        version: 1,
        signal: String(
            report?.overall?.domain_signal || report?.overall?.signal || 'n/a'
        ),
        blockers: Array.isArray(report?.overall?.blockers)
            ? report.overall.blockers
            : [],
        reasons: Array.isArray(report?.overall?.reasons)
            ? report.overall.reasons
            : [],
        counts: {
            blocking_conflicts: Number(conflicts?.totals?.blocking ?? 0),
            handoff_conflicts: Number(conflicts?.totals?.handoff ?? 0),
            handoff_lint_errors: Number(handoffLint?.error_count ?? 0),
            codex_check_errors: Number(codexCheck?.error_count ?? 0),
            active_expired_handoffs: Number(
                handoffStatus?.summary?.active_expired ?? 0
            ),
            red_domains: redDomains.length,
            domain_regression_green_to_red: regressions.length,
        },
        top_blocking_conflicts: topBlocking.slice(0, 5),
        handoff_lint_errors: Array.isArray(handoffLint?.errors)
            ? handoffLint.errors.slice(0, 10)
            : [],
        codex_check_errors: Array.isArray(codexCheck?.errors)
            ? codexCheck.errors.slice(0, 10)
            : [],
        red_domains: redDomains.slice(0, 10),
        domain_regression_green_to_red: regressions.slice(0, 10),
    };
}

function runPolicyCheck(report, policyName, { annotate = false } = {}) {
    const key = String(policyName || '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    if (!key) return { checked: false, pass: true, policy: null, reason: null };

    const policies = report?.policies || {};
    const policy = policies[key];
    if (!policy || typeof policy.pass !== 'boolean') {
        throw new Error(
            `policy-check invalido (${policyName}). Use strict|fail_on_red`
        );
    }

    const reason = String(policy.reason || 'n/a');
    const msg = `Governance policy ${key} ${policy.pass ? 'PASS' : 'FAIL'} (${reason})`;
    if (annotate) {
        if (policy.pass) {
            console.error(`::notice::${msg}`);
        } else {
            console.warn(`::warning::${msg}`);
        }
    } else {
        console.error(msg);
    }

    return { checked: true, pass: policy.pass, policy: key, reason };
}

function summarize(resultMap) {
    const status = resultMap.status?.json || {};
    const conflicts = resultMap.conflicts?.json || {};
    const handoffStatus = resultMap.handoffsStatus?.json || {};
    const handoffLint = resultMap.handoffsLint?.json || {};
    const policyLint = resultMap.policy?.json || {};
    const codexCheck = resultMap.codexCheck?.json || {};
    const metrics = resultMap.metrics?.json || {};
    const boardDoctor = resultMap.boardDoctor?.json || {};
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
    if (resultMap.policy?.json_parse_error) blockers.push('policy_parse');
    if (resultMap.metrics?.json_parse_error) blockers.push('metrics_parse');
    if (resultMap.boardDoctor?.json_parse_error)
        blockers.push('board_doctor_parse');
    if (policyLint && policyLint.ok === false) blockers.push('policy_lint');

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

    const diagnosticsSummary = collectDiagnostics([
        status,
        conflicts,
        handoffStatus,
        handoffLint,
        policyLint,
        codexCheck,
        boardDoctor,
    ]);
    const errorDiagnostics = domainDiagnostics.getErrorDiagnostics(
        diagnosticsSummary.diagnostics
    );
    if (errorDiagnostics.length > 0) blockers.push('diagnostics_error');
    const execution = computeExecutionState({
        blockers,
        diagnosticsSummary,
        status,
    });
    if (
        execution.acknowledged_external_blocker &&
        !blockers.includes('acknowledged_external_blocker')
    ) {
        blockers.push('acknowledged_external_blocker');
    } else if (
        execution.blocked_tasks > 0 &&
        !blockers.includes('blocked_active_task')
    ) {
        blockers.push('blocked_active_task');
    }
    const health = computeDomainSignal({
        domainHealth,
        domainHealthHistory,
    });
    const workspaceHygiene =
        status?.workspace_hygiene ||
        boardDoctor?.workspace_hygiene ||
        conflicts?.workspace_hygiene ||
        codexCheck?.workspace_hygiene ||
        null;
    const workspaceTruth =
        status?.workspace_truth ||
        boardDoctor?.workspace_truth ||
        conflicts?.workspace_truth ||
        codexCheck?.workspace_truth ||
        null;

    const baseReport = {
        version: 1,
        generated_at: new Date().toISOString(),
        root: ROOT,
        overall: {
            ok: execution.state !== 'BLOCKED',
            blockers,
            signal: health.signal,
            domain_signal: health.signal,
            domain_reasons: health.reasons,
            execution_state: execution.state,
            reasons: execution.reasons,
            acknowledged_external_blocker:
                execution.acknowledged_external_blocker,
            external_blocker_task_ids: execution.external_blocker_task_ids,
            domain_weighted_score_pct: health.domain_weighted_score_pct,
            domain_weighted_score_global_pct:
                health.domain_weighted_score_global_pct,
            domain_regression_green_to_red:
                health.domain_regression_green_to_red,
        },
        status: status || null,
        conflicts: conflicts || null,
        handoffs: {
            status: handoffStatus || null,
            lint: handoffLint || null,
        },
        policy: policyLint || null,
        codex_check: codexCheck || null,
        board_doctor: boardDoctor || null,
        workspace_hygiene: workspaceHygiene,
        workspace_truth: workspaceTruth,
        metrics: metrics || null,
        contribution: contribution || null,
        contribution_history: contributionHistory || null,
        domain_health: domainHealth || null,
        domain_health_history: domainHealthHistory || null,
        delta_summary: deltaSummary,
        top_blocking_conflicts: topBlocking,
        diagnostics: diagnosticsSummary.diagnostics,
        warnings_count: diagnosticsSummary.warnings_count,
        errors_count: diagnosticsSummary.errors_count,
        error_diagnostics: errorDiagnostics.slice(0, 10),
        commands: resultMap,
    };
    return {
        ...baseReport,
        policies: evaluatePolicyResults(baseReport),
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
    const policyLint = report.policy || {};
    const codexCheck = report.codex_check || {};
    const boardDoctor = report.board_doctor || {};
    const delta = report.delta_summary || {};
    const metrics = report.metrics || {};
    const contribution = report.contribution || {};
    const contributionHistory = report.contribution_history || {};
    const domainHealth = report.domain_health || {};
    const domainHealthHistory = report.domain_health_history || {};
    const contributionDeltaMap = buildContributionDeltaMap(metrics);
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
    lines.push(
        `- Overall: ${report.overall.execution_state || (report.overall.ok ? 'READY' : 'BLOCKED')}`
    );
    lines.push(
        `- Execution state: \`${report.overall.execution_state || 'n/a'}\``
    );
    lines.push(
        `- Domain signal: \`${report.overall.domain_signal || report.overall.signal || 'n/a'}\``
    );
    lines.push(
        `- Diagnostics warn-first: warnings=\`${report.warnings_count ?? 0}\`, errors=\`${report.errors_count ?? 0}\``
    );
    lines.push(
        `- Score salud dominios (priority): \`${report.overall.domain_weighted_score_pct ?? 'n/a'}\``
    );
    lines.push(
        `- Score salud dominios (global): \`${report.overall.domain_weighted_score_global_pct ?? 'n/a'}\``
    );
    lines.push(
        `- Regresiones dominio GREEN->RED: \`${report.overall.domain_regression_green_to_red ?? 0}\``
    );
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
    lines.push(
        `- Razones dominio: ${
            Array.isArray(report.overall.domain_reasons) &&
            report.overall.domain_reasons.length > 0
                ? report.overall.domain_reasons
                      .map((r) => `\`${r}\``)
                      .join(', ')
                : 'none'
        }`
    );
    if (report.workspace_truth) {
        lines.push(
            `- Workspace truth: \`${report.workspace_truth.overall_state || 'n/a'}\` | canon=\`${report.workspace_truth.canonical_root || 'n/a'}\` | forks=\`${report.workspace_truth.board_forks_total ?? 'n/a'}\``
        );
    }
    if (report.overall.acknowledged_external_blocker) {
        lines.push(
            `- Acknowledged external blocker: \`${report.overall.acknowledged_external_blocker}\`${Array.isArray(report.overall.external_blocker_task_ids) && report.overall.external_blocker_task_ids.length > 0 ? ` (${report.overall.external_blocker_task_ids.map((id) => `\`${id}\``).join(', ')})` : ''}`
        );
    }
    if (report.policies) {
        lines.push(
            `- Politicas: strict=${report.policies.strict?.pass ? 'PASS' : 'FAIL'} (${report.policies.strict?.reason || 'n/a'}), fail_on_red=${report.policies.fail_on_red?.pass ? 'PASS' : 'FAIL'} (${report.policies.fail_on_red?.reason || 'n/a'})`
        );
    }
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
        const preferredDomains = Array.isArray(
            getGovernancePolicy()?.domain_health?.priority_domains
        )
            ? getGovernancePolicy().domain_health.priority_domains.map((v) =>
                  String(v)
              )
            : ['calendar', 'chat', 'payments'];
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

    if (
        Array.isArray(domainHealthHistory?.regressions?.green_to_red) &&
        domainHealthHistory.regressions.green_to_red.length > 0
    ) {
        lines.push('### Alertas de Regresion de Dominio');
        for (const row of domainHealthHistory.regressions.green_to_red) {
            lines.push(
                `- \`${row.domain}\`: \`${row.signal_from}\` -> \`${row.signal_to}\` (${row.from_date} -> ${row.to_date}), blocking delta \`${fmtDelta(row.blocking_conflicts_delta)}\``
            );
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
    if (status.strategy?.active) {
        lines.push(
            `- Strategy: \`${status.strategy.active.id}\` (${status.strategy.active.title || 'sin titulo'}) | aligned=\`${status.strategy.aligned_tasks ?? 'n/a'}\` | support=\`${status.strategy.support_tasks ?? 'n/a'}\` | exception=\`${status.strategy.exception_tasks ?? 'n/a'}\` | orphan=\`${status.strategy.orphan_tasks ?? 'n/a'}\``
        );
    }
    if (status.focus?.configured) {
        lines.push(
            `- Focus: \`${status.focus.configured.id}\` (${status.focus.configured.title || 'sin titulo'}) | next_step=\`${status.focus.configured.next_step || 'n/a'}\` | aligned=\`${status.focus.aligned_tasks ?? 0}\`/\`${status.focus.active_tasks_total ?? 0}\` | slices=\`${status.focus.distinct_active_slices ?? 0}\``
        );
        lines.push(
            `- Focus progress: forward=\`${status.focus.forward_tasks_total ?? 0}\`, support=\`${status.focus.support_tasks_total ?? 0}\`, support_only=\`${status.focus.support_only === true}\`, release_ready=\`${status.focus.release_ready === true}\``
        );
        lines.push(
            `- Focus checks: ${
                Array.isArray(status.focus.required_checks) &&
                status.focus.required_checks.length > 0
                    ? status.focus.required_checks
                          .map((item) => `\`${item.id}\`=${item.state}`)
                          .join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- Focus decisions: open=\`${status.focus.decisions?.open ?? 0}\`, overdue=\`${status.focus.decisions?.overdue ?? 0}\`, rework_ratio=\`${metrics.focus?.rework_tasks_pct ?? 'n/a'}%\``
        );
    }
    if (status.evidence_summary) {
        lines.push(
            `- Terminal evidence: aligned=\`${status.evidence_summary.aligned_count ?? 'n/a'}\`/\`${status.evidence_summary.terminal_tasks ?? 'n/a'}\`, missing_expected=\`${status.evidence_summary.missing_expected_count ?? 'n/a'}\`, debt=\`${status.evidence_summary.debt_count ?? 'n/a'}\`, sample=${Array.isArray(status.evidence_summary.sample_task_ids) && status.evidence_summary.sample_task_ids.length > 0 ? status.evidence_summary.sample_task_ids.map((id) => `\`${id}\``).join(', ') : 'none'}`
        );
    }
    lines.push('');

    lines.push('### Gates');
    lines.push(
        `- Conflicts: blocking=\`${conflicts.totals?.blocking ?? 'n/a'}\`, handoff=\`${conflicts.totals?.handoff ?? 'n/a'}\`, pairs=\`${conflicts.totals?.pairs ?? 'n/a'}\``
    );
    lines.push(
        `- Handoffs lint: ${handoffLint.ok === true ? 'OK' : handoffLint.ok === false ? `FAIL (${handoffLint.error_count || 0})` : 'n/a'}`
    );
    lines.push(
        `- Policy lint: ${policyLint.ok === true ? 'OK' : policyLint.ok === false ? `FAIL (${policyLint.error_count || 0})` : 'n/a'}`
    );
    lines.push(
        `- Codex mirror: ${codexCheck.ok === true ? 'OK' : codexCheck.ok === false ? `FAIL (${codexCheck.error_count || 0})` : 'n/a'}`
    );
    lines.push(
        `- Handoffs summary: total=\`${handoffStatus.summary?.total ?? 'n/a'}\`, active=\`${handoffStatus.summary?.active ?? 'n/a'}\`, closed=\`${handoffStatus.summary?.closed ?? 'n/a'}\`, active_expired=\`${handoffStatus.summary?.active_expired ?? 'n/a'}\``
    );
    lines.push(
        `- Board doctor: findings=\`${Array.isArray(boardDoctor.diagnostics) ? boardDoctor.diagnostics.length : 'n/a'}\`, warnings=\`${boardDoctor.warnings_count ?? 'n/a'}\`, errors=\`${boardDoctor.errors_count ?? 'n/a'}\``
    );
    lines.push('');

    if (boardDoctor.summary || Array.isArray(boardDoctor.checks)) {
        lines.push('### Board Doctor');
        lines.push(
            `- Tasks: \`${boardDoctor.summary?.total_tasks ?? 'n/a'}\` | Checks: \`${boardDoctor.summary?.checks ?? 'n/a'}\` | Findings: \`${boardDoctor.summary?.findings ?? 'n/a'}\` | Lease tracked: \`${boardDoctor.summary?.lease_tracked_tasks ?? 'n/a'}\``
        );
        if (boardDoctor.strategy_summary?.active) {
            lines.push(
                `- Strategy doctor: \`${boardDoctor.strategy_summary.active.id}\` | aligned=\`${boardDoctor.strategy_summary.aligned_tasks ?? 'n/a'}\` | orphan=\`${boardDoctor.strategy_summary.orphan_tasks ?? 'n/a'}\` | exception=\`${boardDoctor.strategy_summary.exception_tasks ?? 'n/a'}\``
            );
        }
        if (boardDoctor.focus_summary?.configured) {
            lines.push(
                `- Focus doctor: \`${boardDoctor.focus_summary.configured.id}\` | next_step=\`${boardDoctor.focus_summary.configured.next_step || 'n/a'}\` | aligned=\`${boardDoctor.focus_summary.aligned_tasks ?? 0}\`/\`${boardDoctor.focus_summary.active_tasks_total ?? 0}\` | slices=\`${boardDoctor.focus_summary.distinct_active_slices ?? 0}\` | decisions_overdue=\`${boardDoctor.focus_summary.decisions?.overdue ?? 0}\``
            );
            lines.push(
                `- Focus doctor progress: forward=\`${boardDoctor.focus_summary.forward_tasks_total ?? 0}\`, support=\`${boardDoctor.focus_summary.support_tasks_total ?? 0}\`, support_only=\`${boardDoctor.focus_summary.support_only === true}\`, release_ready=\`${boardDoctor.focus_summary.release_ready === true}\``
            );
        }
        if (boardDoctor.evidence_summary) {
            lines.push(
                `- Evidence: aligned=\`${boardDoctor.evidence_summary.aligned_count ?? 'n/a'}\`/\`${boardDoctor.evidence_summary.terminal_tasks ?? 'n/a'}\`, missing_expected=\`${boardDoctor.evidence_summary.missing_expected_count ?? 'n/a'}\`, debt=\`${boardDoctor.evidence_summary.debt_count ?? 'n/a'}\`, sample=${Array.isArray(boardDoctor.evidence_summary.sample_task_ids) && boardDoctor.evidence_summary.sample_task_ids.length > 0 ? boardDoctor.evidence_summary.sample_task_ids.map((id) => `\`${id}\``).join(', ') : 'none'}`
            );
        }
        if (boardDoctor.leases?.summary) {
            lines.push(
                `- Leases: tracked=\`${boardDoctor.leases.summary.active_tracked ?? boardDoctor.leases.summary.lease_tracked_tasks ?? 'n/a'}\`, missing_required=\`${boardDoctor.leases.summary.active_required_missing ?? 'n/a'}\`, expired=\`${boardDoctor.leases.summary.active_expired ?? 'n/a'}\``
            );
        }
        lines.push('');
    }

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

    if (Array.isArray(policyLint.errors) && policyLint.errors.length > 0) {
        lines.push('### Policy Lint Errors');
        for (const error of policyLint.errors.slice(0, 10)) {
            lines.push(`- ${error}`);
        }
        lines.push('');
    }

    if (Array.isArray(report.diagnostics) && report.diagnostics.length > 0) {
        lines.push('### Warn-first Diagnostics');
        for (const diag of report.diagnostics.slice(0, 20)) {
            const diagSources =
                Array.isArray(diag.sources) && diag.sources.length > 0
                    ? diag.sources.join(', ')
                    : diag.source || 'n/a';
            lines.push(
                `- [${String(diag.severity || 'warning').toUpperCase()}][${String(diag.scope || 'structural').toUpperCase()}] \`${diag.code || 'unknown'}\` (${diagSources}): ${diag.message || ''}`
            );
        }
        lines.push('');
    }

    if (report.red_explanation) {
        const explain = report.red_explanation;
        lines.push('### Explain RED');
        lines.push(`- Signal: \`${explain.signal || 'n/a'}\``);
        lines.push(
            `- Blockers: ${
                Array.isArray(explain.blockers) && explain.blockers.length > 0
                    ? explain.blockers.map((b) => `\`${b}\``).join(', ')
                    : 'none'
            }`
        );
        lines.push(
            `- Reasons: ${
                Array.isArray(explain.reasons) && explain.reasons.length > 0
                    ? explain.reasons.map((r) => `\`${r}\``).join(', ')
                    : 'none'
            }`
        );
        if (
            Array.isArray(explain.red_domains) &&
            explain.red_domains.length > 0
        ) {
            lines.push('- Dominios en rojo:');
            for (const row of explain.red_domains) {
                lines.push(
                    `  - \`${row.domain}\`: blocking=\`${row.blocking_conflicts}\`, handoff=\`${row.handoff_conflicts}\`, reasons=${Array.isArray(row.reasons) && row.reasons.length > 0 ? row.reasons.join(', ') : 'n/a'}`
                );
            }
        }
        if (
            Array.isArray(explain.domain_regression_green_to_red) &&
            explain.domain_regression_green_to_red.length > 0
        ) {
            lines.push('- Regresiones GREEN->RED:');
            for (const row of explain.domain_regression_green_to_red) {
                lines.push(
                    `  - \`${row.domain}\`: ${row.from_date} -> ${row.to_date}`
                );
            }
        }
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
                    `  - \`${item.left}\` <-> \`${item.right}\` :: ${files || '(wildcard ambiguo)'}`
                );
            }
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
    const metricsProfile = String(flags.profile || 'local')
        .trim()
        .toLowerCase();
    if (!['local', 'ci'].includes(metricsProfile)) {
        throw new Error(`--profile invalido (${metricsProfile}). Use local|ci`);
    }
    const fromJsonPath = flags['from-json']
        ? resolve(ROOT, String(flags['from-json']))
        : null;

    let report;
    if (fromJsonPath) {
        if (!existsSync(fromJsonPath)) {
            throw new Error(`No existe --from-json: ${fromJsonPath}`);
        }
        report = JSON.parse(readFileSync(fromJsonPath, 'utf8'));
        report = ensurePolicies(report);
    } else {
        if (!existsSync(ORCHESTRATOR)) {
            throw new Error(`No existe orchestrator: ${ORCHESTRATOR}`);
        }
        const commands = {
            status: ['status', '--json'],
            conflicts: ['conflicts', '--json'],
            handoffsStatus: ['handoffs', 'status', '--json'],
            handoffsLint: ['handoffs', 'lint', '--json'],
            policy: ['policy', 'lint', '--json'],
            codexCheck: ['codex-check', '--json'],
            boardDoctor: ['board', 'doctor', '--json'],
            metrics: ['metrics', '--json', '--profile', metricsProfile],
        };

        const results = {};
        for (const [key, args] of Object.entries(commands)) {
            results[key] = runOrchestratorJson(args);
        }
        report = summarize(results);
    }
    if (flags['explain-red']) {
        report = {
            ...report,
            red_explanation: buildRedExplanation(report),
        };
    }
    const markdown = toMarkdown(report);
    const jsonText = `${JSON.stringify(report, null, 2)}\n`;

    writeMaybe(flags['write-json'], jsonText);
    writeMaybe(flags['write-md'], markdown);

    const format = String(flags.format || 'markdown').toLowerCase();
    if (format === 'markdown' || format === 'md') {
        process.stdout.write(markdown);
    } else if (format === 'json') {
        process.stdout.write(jsonText);
    } else {
        throw new Error(`Formato no soportado: ${format}`);
    }

    if (flags['policy-check']) {
        const check = runPolicyCheck(report, flags['policy-check'], {
            annotate: Boolean(flags['annotate-policy']),
        });
        if (check.checked && !check.pass) {
            process.exitCode = 1;
        }
    }
    if (flags.strict && report.policies?.strict?.pass === false) {
        process.exitCode = 1;
    }
    if (flags['fail-on-red'] && report.policies?.fail_on_red?.pass === false) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
}
