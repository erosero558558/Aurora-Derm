const { currentDate } = require('./time');

function quote(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
}

function serializeArrayInline(values) {
    if (!Array.isArray(values) || values.length === 0) return '[]';
    return `[${values.map((v) => quote(v)).join(', ')}]`;
}

function serializeHandoffs(data) {
    const safe = data || { version: 1, handoffs: [] };
    const lines = [];
    lines.push(`version: ${safe.version || 1}`);
    lines.push('handoffs:');

    const handoffs = Array.isArray(safe.handoffs) ? safe.handoffs : [];
    for (const handoff of handoffs) {
        lines.push(`  - id: ${handoff.id}`);
        lines.push(`    status: ${handoff.status || 'active'}`);
        lines.push(`    from_task: ${handoff.from_task || ''}`);
        lines.push(`    to_task: ${handoff.to_task || ''}`);
        lines.push(`    reason: ${handoff.reason || ''}`);
        lines.push(`    files: ${serializeArrayInline(handoff.files || [])}`);
        lines.push(`    approved_by: ${handoff.approved_by || ''}`);
        lines.push(`    created_at: ${handoff.created_at || ''}`);
        lines.push(`    expires_at: ${handoff.expires_at || ''}`);
        if (handoff.closed_at) {
            lines.push(`    closed_at: ${handoff.closed_at}`);
        }
        if (handoff.close_reason) {
            lines.push(`    close_reason: ${quote(handoff.close_reason)}`);
        }
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function normalizeTaskInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTaskScore(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < 0) return 0;
    if (parsed > 100) return 100;
    return Math.round(parsed);
}

function serializeStrategyRecord(lines, label, strategy, options = {}) {
    const safe = strategy && typeof strategy === 'object' ? strategy : null;
    if (!safe) {
        lines.push(`  ${label}: null`);
        return;
    }
    const defaultStatus = label === 'next' ? 'draft' : 'active';
    lines.push(`  ${label}:`);
    lines.push(`    id: ${safe.id || ''}`);
    lines.push(`    title: ${quote(safe.title || '')}`);
    lines.push(`    objective: ${quote(safe.objective || '')}`);
    lines.push(`    owner: ${safe.owner || ''}`);
    lines.push(`    owner_policy: ${quote(safe.owner_policy || '')}`);
    lines.push(`    status: ${safe.status || defaultStatus}`);
    lines.push(`    started_at: ${quote(safe.started_at || '')}`);
    lines.push(`    review_due_at: ${quote(safe.review_due_at || '')}`);
    lines.push(`    closed_at: ${quote(safe.closed_at || '')}`);
    lines.push(`    close_reason: ${quote(safe.close_reason || '')}`);
    lines.push(
        `    exit_criteria: ${serializeArrayInline(safe.exit_criteria || [])}`
    );
    lines.push(`    success_signal: ${quote(safe.success_signal || '')}`);
    const shouldEmitFocus =
        Boolean(String(safe.focus_id || '').trim()) ||
        Boolean(String(safe.focus_title || '').trim()) ||
        Boolean(String(safe.focus_proof || '').trim()) ||
        Boolean(String(safe.focus_next_step || '').trim()) ||
        Boolean(String(safe.focus_status || '').trim());
    if (shouldEmitFocus) {
        lines.push(`    focus_id: ${quote(safe.focus_id || '')}`);
        lines.push(`    focus_title: ${quote(safe.focus_title || '')}`);
        lines.push(`    focus_summary: ${quote(safe.focus_summary || '')}`);
        lines.push(`    focus_status: ${safe.focus_status || 'active'}`);
        lines.push(`    focus_proof: ${quote(safe.focus_proof || '')}`);
        lines.push(
            `    focus_steps: ${serializeArrayInline(safe.focus_steps || [])}`
        );
        lines.push(`    focus_next_step: ${quote(safe.focus_next_step || '')}`);
        lines.push(
            `    focus_required_checks: ${serializeArrayInline(
                safe.focus_required_checks || []
            )}`
        );
        lines.push(
            `    focus_non_goals: ${serializeArrayInline(
                safe.focus_non_goals || []
            )}`
        );
        lines.push(`    focus_owner: ${quote(safe.focus_owner || '')}`);
        lines.push(
            `    focus_review_due_at: ${quote(safe.focus_review_due_at || '')}`
        );
        lines.push(
            `    focus_evidence_ref: ${quote(safe.focus_evidence_ref || '')}`
        );
        lines.push(
            `    focus_max_active_slices: ${normalizeTaskInt(
                safe.focus_max_active_slices,
                3
            )}`
        );
    }
    lines.push('    subfronts:');
    const subfronts = Array.isArray(safe.subfronts) ? safe.subfronts : [];
    for (const subfront of subfronts) {
        lines.push(`      - codex_instance: ${subfront.codex_instance || ''}`);
        lines.push(`        subfront_id: ${subfront.subfront_id || ''}`);
        lines.push(`        title: ${quote(subfront.title || '')}`);
        lines.push(
            `        allowed_scopes: ${serializeArrayInline(
                subfront.allowed_scopes || []
            )}`
        );
        lines.push(
            `        support_only_scopes: ${serializeArrayInline(
                subfront.support_only_scopes || []
            )}`
        );
        lines.push(
            `        blocked_scopes: ${serializeArrayInline(
                subfront.blocked_scopes || []
            )}`
        );
        lines.push(
            `        wip_limit: ${normalizeTaskInt(subfront.wip_limit, 1)}`
        );
        lines.push(
            `        default_acceptance_profile: ${quote(
                subfront.default_acceptance_profile || ''
            )}`
        );
        lines.push(
            `        exception_ttl_hours: ${normalizeTaskInt(
                subfront.exception_ttl_hours,
                0
            )}`
        );
    }
}

function serializeStrategy(board, lines) {
    const strategy =
        board?.strategy && typeof board.strategy === 'object'
            ? board.strategy
            : null;
    if (!strategy) {
        return;
    }
    lines.push('');
    lines.push('strategy:');
    serializeStrategyRecord(lines, 'active', strategy.active);
    serializeStrategyRecord(lines, 'next', strategy.next);
    lines.push(`  updated_at: ${quote(strategy.updated_at || '')}`);
}

function serializeBoard(board, options = {}) {
    const getDate = options.currentDate || currentDate;
    const lines = [];
    lines.push(`version: ${board.version}`);
    lines.push('policy:');
    lines.push(`  canonical: ${board.policy.canonical || 'AGENTS.md'}`);
    lines.push(
        `  autonomy: ${board.policy.autonomy || 'semi_autonomous_guardrails'}`
    );
    lines.push(`  kpi: ${board.policy.kpi || 'reduce_rework'}`);
    lines.push(
        `  codex_partition_model: ${board.policy.codex_partition_model || 'tri_lane_runtime'}`
    );
    lines.push(
        `  codex_backend_instance: ${board.policy.codex_backend_instance || 'codex_backend_ops'}`
    );
    lines.push(
        `  codex_frontend_instance: ${board.policy.codex_frontend_instance || 'codex_frontend'}`
    );
    lines.push(
        `  codex_transversal_instance: ${board.policy.codex_transversal_instance || 'codex_transversal'}`
    );
    lines.push(`  revision: ${normalizeTaskInt(board.policy.revision, 0)}`);
    lines.push(`  updated_at: ${board.policy.updated_at || getDate()}`);
    serializeStrategy(board, lines);
    lines.push('');
    lines.push('tasks:');

    for (const task of board.tasks) {
        lines.push(`  - id: ${task.id}`);
        lines.push(`    title: ${quote(task.title || '')}`);
        lines.push(`    owner: ${task.owner || 'unassigned'}`);
        lines.push(`    executor: ${task.executor || 'codex'}`);
        lines.push(`    status: ${task.status || 'backlog'}`);
        lines.push(`    status_since_at: ${quote(task.status_since_at || '')}`);
        lines.push(`    risk: ${task.risk || 'medium'}`);
        lines.push(`    scope: ${task.scope || 'general'}`);
        lines.push(
            `    codex_instance: ${task.codex_instance || 'codex_backend_ops'}`
        );
        lines.push(`    domain_lane: ${task.domain_lane || 'backend_ops'}`);
        lines.push(`    lane_lock: ${task.lane_lock || 'strict'}`);
        lines.push(`    cross_domain: ${task.cross_domain ? 'true' : 'false'}`);
        lines.push(`    provider_mode: ${task.provider_mode || ''}`);
        lines.push(`    runtime_surface: ${task.runtime_surface || ''}`);
        lines.push(`    runtime_transport: ${task.runtime_transport || ''}`);
        lines.push(
            `    runtime_last_transport: ${task.runtime_last_transport || ''}`
        );
        const shouldEmitModelRoutingFields =
            /^CDX-\d+$/i.test(String(task.id || '').trim()) &&
            (['ready', 'in_progress', 'review', 'blocked'].includes(
                String(task.status || '').trim()
            ) ||
                Boolean(
                    String(task.model_tier_default || '').trim() ||
                    String(task.decision_packet_ref || '').trim() ||
                    String(task.model_policy_version || '').trim() ||
                    Number.isFinite(Number(task.premium_budget)) ||
                    Number.isFinite(Number(task.premium_calls_used))
                ));
        if (shouldEmitModelRoutingFields) {
            lines.push(
                `    model_tier_default: ${quote(task.model_tier_default || 'gpt-5.4-mini')}`
            );
            lines.push(
                `    premium_budget: ${normalizeTaskInt(task.premium_budget, 0)}`
            );
            lines.push(
                `    premium_calls_used: ${normalizeTaskInt(task.premium_calls_used, 0)}`
            );
            lines.push(
                `    premium_gate_state: ${quote(task.premium_gate_state || 'closed')}`
            );
            lines.push(
                `    decision_packet_ref: ${quote(task.decision_packet_ref || '')}`
            );
            lines.push(
                `    model_policy_version: ${quote(task.model_policy_version || '')}`
            );
        }
        lines.push(`    files: ${serializeArrayInline(task.files || [])}`);
        lines.push(`    source_signal: ${task.source_signal || 'manual'}`);
        lines.push(`    source_ref: ${quote(task.source_ref || '')}`);
        lines.push(
            `    priority_score: ${normalizeTaskScore(task.priority_score, 0)}`
        );
        lines.push(`    sla_due_at: ${quote(task.sla_due_at || '')}`);
        lines.push(`    last_attempt_at: ${quote(task.last_attempt_at || '')}`);
        lines.push(`    attempts: ${normalizeTaskInt(task.attempts, 0)}`);
        lines.push(`    blocked_reason: ${quote(task.blocked_reason || '')}`);
        lines.push(`    lease_id: ${quote(task.lease_id || '')}`);
        lines.push(`    lease_owner: ${quote(task.lease_owner || '')}`);
        lines.push(
            `    lease_created_at: ${quote(task.lease_created_at || '')}`
        );
        lines.push(`    heartbeat_at: ${quote(task.heartbeat_at || '')}`);
        lines.push(
            `    lease_expires_at: ${quote(task.lease_expires_at || '')}`
        );
        lines.push(`    lease_reason: ${quote(task.lease_reason || '')}`);
        lines.push(
            `    lease_cleared_at: ${quote(task.lease_cleared_at || '')}`
        );
        lines.push(
            `    lease_cleared_reason: ${quote(task.lease_cleared_reason || '')}`
        );
        lines.push(`    runtime_impact: ${task.runtime_impact || 'low'}`);
        lines.push(
            `    critical_zone: ${task.critical_zone ? 'true' : 'false'}`
        );
        lines.push(`    acceptance: ${quote(task.acceptance || '')}`);
        lines.push(`    acceptance_ref: ${quote(task.acceptance_ref || '')}`);
        lines.push(
            `    evidence_ref: ${quote(task.evidence_ref || task.acceptance_ref || '')}`
        );
        const shouldEmitWorkspaceFields =
            ['ready', 'in_progress', 'review', 'blocked'].includes(
                String(task.status || '').trim()
            ) ||
            Boolean(
                String(task.workspace_machine_id || '').trim() ||
                    String(task.workspace_branch || '').trim() ||
                    String(task.workspace_head || '').trim() ||
                    String(task.workspace_origin_main_head || '').trim() ||
                    String(task.workspace_sync_state || '').trim() ||
                    String(task.workspace_sync_checked_at || '').trim()
            );
        if (shouldEmitWorkspaceFields) {
            lines.push(
                `    workspace_machine_id: ${quote(
                    String(task.workspace_machine_id || '').trim()
                )}`
            );
            lines.push(
                `    workspace_branch: ${quote(
                    String(task.workspace_branch || '').trim()
                )}`
            );
            lines.push(
                `    workspace_head: ${quote(
                    String(task.workspace_head || '').trim()
                )}`
            );
            lines.push(
                `    workspace_origin_main_head: ${quote(
                    String(task.workspace_origin_main_head || '').trim()
                )}`
            );
            lines.push(
                `    workspace_sync_state: ${quote(
                    String(task.workspace_sync_state || '').trim()
                )}`
            );
            lines.push(
                `    workspace_sync_checked_at: ${quote(
                    String(task.workspace_sync_checked_at || '').trim()
                )}`
            );
        }
        const shouldEmitStrategyFields =
            ['ready', 'in_progress', 'review', 'blocked'].includes(
                String(task.status || '').trim()
            ) ||
            Boolean(
                String(task.strategy_id || '').trim() ||
                String(task.subfront_id || '').trim() ||
                String(task.strategy_role || '').trim() ||
                String(task.strategy_reason || '').trim()
            );
        if (shouldEmitStrategyFields) {
            lines.push(
                `    strategy_id: ${quote(String(task.strategy_id || '').trim())}`
            );
            lines.push(
                `    subfront_id: ${quote(String(task.subfront_id || '').trim())}`
            );
            lines.push(
                `    strategy_role: ${quote(String(task.strategy_role || '').trim())}`
            );
            if (String(task.strategy_reason || '').trim()) {
                lines.push(
                    `    strategy_reason: ${quote(String(task.strategy_reason || '').trim())}`
                );
            }
            const shouldEmitExceptionFields =
                String(task.strategy_role || '').trim() === 'exception' ||
                Boolean(
                    String(task.exception_opened_at || '').trim() ||
                    String(task.exception_expires_at || '').trim() ||
                    String(task.exception_state || '').trim()
                );
            if (shouldEmitExceptionFields) {
                if (String(task.exception_opened_at || '').trim()) {
                    lines.push(
                        `    exception_opened_at: ${quote(
                            String(task.exception_opened_at || '').trim()
                        )}`
                    );
                }
                if (String(task.exception_expires_at || '').trim()) {
                    lines.push(
                        `    exception_expires_at: ${quote(
                            String(task.exception_expires_at || '').trim()
                        )}`
                    );
                }
                if (String(task.exception_state || '').trim()) {
                    lines.push(
                        `    exception_state: ${quote(
                            String(task.exception_state || '').trim()
                        )}`
                    );
                }
            }
        }
        const shouldEmitFocusFields =
            ['ready', 'in_progress', 'review', 'blocked'].includes(
                String(task.status || '').trim()
            ) ||
            Boolean(
                String(task.focus_id || '').trim() ||
                String(task.focus_step || '').trim() ||
                String(task.integration_slice || '').trim() ||
                String(task.work_type || '').trim() ||
                String(task.expected_outcome || '').trim() ||
                String(task.decision_ref || '').trim() ||
                String(task.rework_parent || '').trim() ||
                String(task.rework_reason || '').trim()
            );
        if (shouldEmitFocusFields) {
            lines.push(
                `    focus_id: ${quote(String(task.focus_id || '').trim())}`
            );
            lines.push(
                `    focus_step: ${quote(String(task.focus_step || '').trim())}`
            );
            lines.push(
                `    integration_slice: ${quote(
                    String(task.integration_slice || '').trim()
                )}`
            );
            lines.push(
                `    work_type: ${quote(String(task.work_type || '').trim())}`
            );
            lines.push(
                `    expected_outcome: ${quote(
                    String(task.expected_outcome || '').trim()
                )}`
            );
            lines.push(
                `    decision_ref: ${quote(
                    String(task.decision_ref || '').trim()
                )}`
            );
            lines.push(
                `    rework_parent: ${quote(
                    String(task.rework_parent || '').trim()
                )}`
            );
            lines.push(
                `    rework_reason: ${quote(
                    String(task.rework_reason || '').trim()
                )}`
            );
        }
        lines.push(
            `    depends_on: ${serializeArrayInline(task.depends_on || [])}`
        );
        lines.push(`    prompt: ${quote(task.prompt || task.title || '')}`);
        lines.push(`    created_at: ${task.created_at || getDate()}`);
        lines.push(`    updated_at: ${task.updated_at || getDate()}`);
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function serializeSignals(data, options = {}) {
    const getDate = options.currentDate || currentDate;
    const safe = data || { version: 1, updated_at: getDate(), signals: [] };
    const lines = [];
    lines.push(`version: ${safe.version || 1}`);
    lines.push(`updated_at: ${safe.updated_at || getDate()}`);
    lines.push('signals:');

    const signals = Array.isArray(safe.signals) ? safe.signals : [];
    for (const signal of signals) {
        lines.push(`  - id: ${signal.id}`);
        lines.push(`    fingerprint: ${quote(signal.fingerprint || '')}`);
        lines.push(`    source: ${signal.source || 'manual'}`);
        lines.push(`    source_ref: ${quote(signal.source_ref || '')}`);
        lines.push(`    title: ${quote(signal.title || '')}`);
        lines.push(`    severity: ${signal.severity || 'medium'}`);
        lines.push(`    critical: ${signal.critical ? 'true' : 'false'}`);
        lines.push(`    status: ${signal.status || 'open'}`);
        lines.push(`    runtime_impact: ${signal.runtime_impact || 'low'}`);
        lines.push(`    url: ${quote(signal.url || '')}`);
        lines.push(`    detected_at: ${quote(signal.detected_at || '')}`);
        lines.push(`    updated_at: ${quote(signal.updated_at || '')}`);
        lines.push(`    labels: ${serializeArrayInline(signal.labels || [])}`);
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function serializeJobs(data, options = {}) {
    const getDate = options.currentDate || currentDate;
    const safe = data || { version: 1, updated_at: getDate(), jobs: [] };
    const lines = [];
    lines.push(`version: ${safe.version || 1}`);
    lines.push(`updated_at: ${quote(safe.updated_at || getDate())}`);
    lines.push('jobs:');

    const jobs = Array.isArray(safe.jobs) ? safe.jobs : [];
    for (const job of jobs) {
        lines.push(`  - key: ${job.key || ''}`);
        lines.push(`    job_id: ${quote(job.job_id || '')}`);
        lines.push(`    enabled: ${job.enabled === false ? 'false' : 'true'}`);
        lines.push(`    type: ${job.type || 'external_cron'}`);
        lines.push(`    owner: ${job.owner || 'codex_backend_ops'}`);
        lines.push(`    environment: ${job.environment || 'production'}`);
        lines.push(`    repo_path: ${job.repo_path || ''}`);
        lines.push(`    branch: ${job.branch || 'main'}`);
        lines.push(`    schedule: ${quote(job.schedule || '')}`);
        lines.push(`    command: ${job.command || ''}`);
        lines.push(`    wrapper_fallback: ${job.wrapper_fallback || ''}`);
        lines.push(`    lock_file: ${job.lock_file || ''}`);
        lines.push(`    log_path: ${job.log_path || ''}`);
        lines.push(`    status_path: ${job.status_path || ''}`);
        lines.push(`    health_url: ${job.health_url || ''}`);
        lines.push(
            `    expected_max_lag_seconds: ${Number.isFinite(Number(job.expected_max_lag_seconds)) ? Number(job.expected_max_lag_seconds) : 0}`
        );
        lines.push(
            `    source_of_truth: ${job.source_of_truth || 'host_cron'}`
        );
        lines.push(
            `    publish_strategy: ${job.publish_strategy || 'main_auto_guarded'}`
        );
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function serializeDecisions(data, options = {}) {
    const getDate = options.currentDate || currentDate;
    const safe = data || { version: 1, policy: {}, decisions: [] };
    const policy =
        safe.policy && typeof safe.policy === 'object' ? safe.policy : {};
    const lines = [];
    lines.push(`version: ${safe.version || 1}`);
    lines.push('policy:');
    lines.push(`  owner_model: ${policy.owner_model || 'human_supervisor'}`);
    lines.push(`  revision: ${normalizeTaskInt(policy.revision, 0)}`);
    lines.push(`  updated_at: ${quote(policy.updated_at || getDate())}`);
    lines.push('decisions:');
    for (const decision of Array.isArray(safe.decisions)
        ? safe.decisions
        : []) {
        lines.push(`  - id: ${decision.id || ''}`);
        lines.push(`    strategy_id: ${quote(decision.strategy_id || '')}`);
        lines.push(`    focus_id: ${quote(decision.focus_id || '')}`);
        lines.push(`    focus_step: ${quote(decision.focus_step || '')}`);
        lines.push(`    title: ${quote(decision.title || '')}`);
        lines.push(`    owner: ${quote(decision.owner || '')}`);
        lines.push(`    status: ${decision.status || 'open'}`);
        lines.push(`    due_at: ${quote(decision.due_at || '')}`);
        lines.push(
            `    recommended_option: ${quote(decision.recommended_option || '')}`
        );
        lines.push(
            `    selected_option: ${quote(decision.selected_option || '')}`
        );
        lines.push(`    rationale: ${quote(decision.rationale || '')}`);
        lines.push(
            `    related_tasks: ${serializeArrayInline(
                decision.related_tasks || []
            )}`
        );
        lines.push(`    opened_at: ${quote(decision.opened_at || '')}`);
        lines.push(`    resolved_at: ${quote(decision.resolved_at || '')}`);
    }
    return `${lines.join('\n').trimEnd()}\n`;
}

module.exports = {
    quote,
    serializeArrayInline,
    serializeHandoffs,
    serializeBoard,
    serializeSignals,
    serializeJobs,
    serializeDecisions,
};
