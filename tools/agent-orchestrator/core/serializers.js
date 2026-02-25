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
    lines.push(`  updated_at: ${board.policy.updated_at || getDate()}`);
    lines.push('');
    lines.push('tasks:');

    for (const task of board.tasks) {
        lines.push(`  - id: ${task.id}`);
        lines.push(`    title: ${quote(task.title || '')}`);
        lines.push(`    owner: ${task.owner || 'unassigned'}`);
        lines.push(`    executor: ${task.executor || 'codex'}`);
        lines.push(`    status: ${task.status || 'backlog'}`);
        lines.push(`    risk: ${task.risk || 'medium'}`);
        lines.push(`    scope: ${task.scope || 'general'}`);
        lines.push(`    files: ${serializeArrayInline(task.files || [])}`);
        lines.push(`    acceptance: ${quote(task.acceptance || '')}`);
        lines.push(`    acceptance_ref: ${quote(task.acceptance_ref || '')}`);
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

module.exports = {
    quote,
    serializeArrayInline,
    serializeHandoffs,
    serializeBoard,
};
