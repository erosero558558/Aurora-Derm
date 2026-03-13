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

module.exports = {
    quote,
    serializeArrayInline,
    serializeHandoffs,
    serializeBoard,
    serializeSignals,
    serializeJobs,
};
