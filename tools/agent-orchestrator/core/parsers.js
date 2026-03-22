function normalizeEol(value) {
    return String(value).replace(/\r\n/g, '\n');
}

function unquote(value) {
    const trimmed = String(value).trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
    return trimmed;
}

function parseInlineArray(value) {
    const trimmed = String(value).trim();
    if (trimmed === '[]') return [];
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        return [unquote(trimmed)];
    }
    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];
    return body
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((entry) => unquote(entry))
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseScalar(value) {
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === '[]') return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']'))
        return parseInlineArray(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"'))
        return unquote(trimmed);
    return trimmed;
}

function parseBooleanLike(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'y', 'si', 's', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function normalizeStrategySubfront(subfront) {
    if (!subfront || typeof subfront !== 'object') return null;
    const safe = { ...subfront };
    safe.codex_instance = String(safe.codex_instance || '')
        .trim()
        .toLowerCase();
    safe.subfront_id = String(safe.subfront_id || '').trim();
    safe.title = String(safe.title || '').trim();
    if (!Array.isArray(safe.allowed_scopes)) {
        safe.allowed_scopes = safe.allowed_scopes
            ? [String(safe.allowed_scopes)]
            : [];
    }
    if (!Array.isArray(safe.support_only_scopes)) {
        safe.support_only_scopes = safe.support_only_scopes
            ? [String(safe.support_only_scopes)]
            : [];
    }
    if (!Array.isArray(safe.blocked_scopes)) {
        safe.blocked_scopes = safe.blocked_scopes
            ? [String(safe.blocked_scopes)]
            : [];
    }
    safe.allowed_scopes = safe.allowed_scopes
        .map((value) =>
            String(value || '')
                .trim()
                .toLowerCase()
        )
        .filter(Boolean);
    safe.support_only_scopes = safe.support_only_scopes
        .map((value) =>
            String(value || '')
                .trim()
                .toLowerCase()
        )
        .filter(Boolean);
    safe.blocked_scopes = safe.blocked_scopes
        .map((value) =>
            String(value || '')
                .trim()
                .toLowerCase()
        )
        .filter(Boolean);
    safe.wip_limit = String(safe.wip_limit || '').trim();
    safe.default_acceptance_profile = String(
        safe.default_acceptance_profile || ''
    ).trim();
    safe.exception_ttl_hours = String(safe.exception_ttl_hours || '').trim();
    return safe;
}

function normalizeStrategyRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const safe = { ...record };
    safe.id = String(safe.id || '').trim();
    safe.title = String(safe.title || '').trim();
    safe.objective = String(safe.objective || '').trim();
    safe.owner = String(safe.owner || '').trim();
    safe.owner_policy = String(safe.owner_policy || '').trim();
    safe.status = String(safe.status || '')
        .trim()
        .toLowerCase();
    safe.started_at = String(safe.started_at || '').trim();
    safe.review_due_at = String(safe.review_due_at || '').trim();
    safe.closed_at = String(safe.closed_at || '').trim();
    safe.close_reason = String(safe.close_reason || '').trim();
    safe.success_signal = String(safe.success_signal || '').trim();
    safe.focus_id = String(safe.focus_id || '').trim();
    safe.focus_title = String(safe.focus_title || '').trim();
    safe.focus_summary = String(safe.focus_summary || '').trim();
    safe.focus_status = String(safe.focus_status || '')
        .trim()
        .toLowerCase();
    safe.focus_proof = String(safe.focus_proof || '').trim();
    safe.focus_next_step = String(safe.focus_next_step || '').trim();
    safe.focus_owner = String(safe.focus_owner || '').trim();
    safe.focus_review_due_at = String(safe.focus_review_due_at || '').trim();
    safe.focus_evidence_ref = String(safe.focus_evidence_ref || '').trim();
    safe.focus_max_active_slices = String(
        safe.focus_max_active_slices || ''
    ).trim();
    if (!Array.isArray(safe.exit_criteria)) {
        safe.exit_criteria = safe.exit_criteria
            ? [String(safe.exit_criteria)]
            : [];
    }
    safe.exit_criteria = safe.exit_criteria
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    if (!Array.isArray(safe.focus_steps)) {
        safe.focus_steps = safe.focus_steps ? [String(safe.focus_steps)] : [];
    }
    if (!Array.isArray(safe.focus_required_checks)) {
        safe.focus_required_checks = safe.focus_required_checks
            ? [String(safe.focus_required_checks)]
            : [];
    }
    if (!Array.isArray(safe.focus_non_goals)) {
        safe.focus_non_goals = safe.focus_non_goals
            ? [String(safe.focus_non_goals)]
            : [];
    }
    safe.focus_steps = safe.focus_steps
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    safe.focus_required_checks = safe.focus_required_checks
        .map((value) =>
            String(value || '')
                .trim()
                .toLowerCase()
        )
        .filter(Boolean);
    safe.focus_non_goals = safe.focus_non_goals
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    safe.subfronts = Array.isArray(safe.subfronts)
        ? safe.subfronts
              .map((subfront) => normalizeStrategySubfront(subfront))
              .filter(Boolean)
        : [];
    return safe;
}

function normalizeBoardStrategy(strategy) {
    if (!strategy || typeof strategy !== 'object') {
        return { active: null, next: null, updated_at: '' };
    }
    return {
        active: normalizeStrategyRecord(strategy.active),
        next: normalizeStrategyRecord(strategy.next),
        updated_at: String(strategy.updated_at || '').trim(),
    };
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCommentBlocksContent(content, marker) {
    const regex = new RegExp(
        `<!--\\s*${escapeRegExp(marker)}\\s*\\n([\\s\\S]*?)-->`,
        'g'
    );
    const blocks = [];
    let match;
    while ((match = regex.exec(normalizeEol(content))) !== null) {
        const block = {};
        for (const line of match[1].split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const prop = trimmed.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (!prop) continue;
            block[prop[1]] = parseScalar(prop[2]);
        }
        blocks.push(block);
    }
    return blocks;
}

function parseBoardContent(content, options = {}) {
    const allowedStatuses = options.allowedStatuses || new Set();
    const lines = normalizeEol(content).split('\n');
    const board = {
        version: 1,
        policy: {},
        strategy: { active: null, next: null, updated_at: '' },
        tasks: [],
    };
    let inPolicy = false;
    let inStrategy = false;
    let inStrategyRecord = false;
    let inStrategySubfronts = false;
    let inTasks = false;
    let strategyTargetKey = null;
    let strategySubfront = null;
    let task = null;

    function flushStrategySubfront() {
        if (
            strategySubfront &&
            strategyTargetKey &&
            board.strategy &&
            board.strategy[strategyTargetKey] &&
            Array.isArray(board.strategy[strategyTargetKey].subfronts)
        ) {
            board.strategy[strategyTargetKey].subfronts.push(strategySubfront);
        }
        strategySubfront = null;
    }

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === 'policy:') {
            flushStrategySubfront();
            inPolicy = true;
            inStrategy = false;
            inStrategyRecord = false;
            inStrategySubfronts = false;
            strategyTargetKey = null;
            inTasks = false;
            continue;
        }
        if (trimmed === 'strategy:') {
            inStrategy = true;
            inStrategyRecord = false;
            inStrategySubfronts = false;
            strategyTargetKey = null;
            inPolicy = false;
            inTasks = false;
            if (!board.strategy || typeof board.strategy !== 'object') {
                board.strategy = { active: null, next: null, updated_at: '' };
            }
            continue;
        }
        if (trimmed === 'tasks:') {
            flushStrategySubfront();
            inTasks = true;
            inPolicy = false;
            inStrategy = false;
            inStrategyRecord = false;
            inStrategySubfronts = false;
            strategyTargetKey = null;
            if (task) {
                board.tasks.push(task);
                task = null;
            }
            continue;
        }

        if (inStrategy) {
            const strategyProp = line.match(/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (strategyProp) {
                const key = String(strategyProp[1] || '').trim();
                const value = String(strategyProp[2] || '').trim();
                if (key === 'active' || key === 'next') {
                    flushStrategySubfront();
                    inStrategyRecord = true;
                    strategyTargetKey = key;
                    inStrategySubfronts = false;
                    board.strategy[key] =
                        value === 'null' ? null : { subfronts: [] };
                    continue;
                }
                if (key === 'updated_at') {
                    board.strategy.updated_at = parseScalar(value);
                    continue;
                }
            }

            if (
                inStrategyRecord &&
                strategyTargetKey &&
                board.strategy[strategyTargetKey] &&
                trimmed === 'subfronts:'
            ) {
                inStrategySubfronts = true;
                if (
                    !Array.isArray(board.strategy[strategyTargetKey].subfronts)
                ) {
                    board.strategy[strategyTargetKey].subfronts = [];
                }
                continue;
            }

            if (
                inStrategySubfronts &&
                strategyTargetKey &&
                board.strategy[strategyTargetKey]
            ) {
                const subfrontStart = line.match(
                    /^\s{6}-\s+([a-zA-Z_][\w-]*):\s*(.*)$/
                );
                if (subfrontStart) {
                    flushStrategySubfront();
                    strategySubfront = {
                        [subfrontStart[1]]: parseScalar(subfrontStart[2]),
                    };
                    continue;
                }
                const subfrontProp = line.match(
                    /^\s{8}([a-zA-Z_][\w-]*):\s*(.*)$/
                );
                if (strategySubfront && subfrontProp) {
                    strategySubfront[subfrontProp[1]] = parseScalar(
                        subfrontProp[2]
                    );
                    continue;
                }
            }

            if (
                inStrategyRecord &&
                strategyTargetKey &&
                board.strategy[strategyTargetKey]
            ) {
                const recordProp = line.match(
                    /^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/
                );
                if (recordProp) {
                    board.strategy[strategyTargetKey][recordProp[1]] =
                        parseScalar(recordProp[2]);
                    continue;
                }
            }
            continue;
        }

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inPolicy && !inTasks) {
            board.version = parseScalar(versionMatch[1]);
            continue;
        }

        if (inPolicy) {
            const policyMatch = line.match(/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (policyMatch) {
                board.policy[policyMatch[1]] = parseScalar(policyMatch[2]);
            }
            continue;
        }

        if (inTasks) {
            const taskStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
            if (taskStart) {
                if (task) board.tasks.push(task);
                task = { id: parseScalar(taskStart[1]) };
                continue;
            }
            const taskProp = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (task && taskProp) {
                task[taskProp[1]] = parseScalar(taskProp[2]);
            }
        }
    }

    flushStrategySubfront();
    if (task) board.tasks.push(task);

    for (const item of board.tasks) {
        if (!Array.isArray(item.files))
            item.files = item.files ? [String(item.files)] : [];
        if (!Array.isArray(item.depends_on))
            item.depends_on = item.depends_on ? [String(item.depends_on)] : [];
        item.codex_instance = String(item.codex_instance || '')
            .trim()
            .toLowerCase();
        item.domain_lane = String(item.domain_lane || '')
            .trim()
            .toLowerCase();
        item.lane_lock = String(item.lane_lock || '')
            .trim()
            .toLowerCase();
        item.cross_domain = parseBooleanLike(item.cross_domain, false);
        item.provider_mode = String(item.provider_mode || '')
            .trim()
            .toLowerCase();
        item.runtime_surface = String(item.runtime_surface || '')
            .trim()
            .toLowerCase();
        item.runtime_transport = String(item.runtime_transport || '')
            .trim()
            .toLowerCase();
        item.runtime_last_transport = String(item.runtime_last_transport || '')
            .trim()
            .toLowerCase();
        item.model_tier_default = String(item.model_tier_default || '').trim();
        item.premium_budget = Number.parseInt(
            String(item.premium_budget || ''),
            10
        );
        if (!Number.isInteger(item.premium_budget) || item.premium_budget < 0) {
            item.premium_budget = 0;
        }
        item.premium_calls_used = Number.parseInt(
            String(item.premium_calls_used || ''),
            10
        );
        if (
            !Number.isInteger(item.premium_calls_used) ||
            item.premium_calls_used < 0
        ) {
            item.premium_calls_used = 0;
        }
        item.premium_gate_state = String(item.premium_gate_state || '')
            .trim()
            .toLowerCase();
        item.decision_packet_ref = String(
            item.decision_packet_ref || ''
        ).trim();
        item.model_policy_version = String(
            item.model_policy_version || ''
        ).trim();
        item.strategy_id = String(item.strategy_id || '').trim();
        item.subfront_id = String(item.subfront_id || '').trim();
        item.strategy_role = String(item.strategy_role || '')
            .trim()
            .toLowerCase();
        item.strategy_reason = String(item.strategy_reason || '').trim();
        item.exception_opened_at = String(
            item.exception_opened_at || ''
        ).trim();
        item.exception_expires_at = String(
            item.exception_expires_at || ''
        ).trim();
        item.exception_state = String(item.exception_state || '')
            .trim()
            .toLowerCase();
        item.focus_id = String(item.focus_id || '').trim();
        item.focus_step = String(item.focus_step || '').trim();
        item.integration_slice = String(item.integration_slice || '')
            .trim()
            .toLowerCase();
        item.work_type = String(item.work_type || '')
            .trim()
            .toLowerCase();
        item.expected_outcome = String(item.expected_outcome || '').trim();
        item.decision_ref = String(item.decision_ref || '').trim();
        item.rework_parent = String(item.rework_parent || '').trim();
        item.rework_reason = String(item.rework_reason || '').trim();
        item.workspace_machine_id = String(
            item.workspace_machine_id || ''
        ).trim();
        item.workspace_branch = String(item.workspace_branch || '').trim();
        item.workspace_head = String(item.workspace_head || '').trim();
        item.workspace_origin_main_head = String(
            item.workspace_origin_main_head || ''
        ).trim();
        item.workspace_sync_state = String(
            item.workspace_sync_state || ''
        ).trim();
        item.workspace_sync_checked_at = String(
            item.workspace_sync_checked_at || ''
        ).trim();
        item.status = String(item.status || '').trim();
        if (allowedStatuses.size > 0 && !allowedStatuses.has(item.status)) {
            throw new Error(
                `Estado no permitido en ${item.id}: ${item.status}`
            );
        }
    }

    board.strategy = normalizeBoardStrategy(board.strategy);
    return board;
}

function parseHandoffsContent(content) {
    const lines = normalizeEol(content).split('\n');
    const data = { version: 1, handoffs: [] };
    let inHandoffs = false;
    let handoff = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inHandoffs) {
            data.version = parseScalar(versionMatch[1]);
            continue;
        }
        if (trimmed === 'handoffs:') {
            inHandoffs = true;
            if (handoff) {
                data.handoffs.push(handoff);
                handoff = null;
            }
            continue;
        }
        if (!inHandoffs) continue;

        const handoffStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
        if (handoffStart) {
            if (handoff) data.handoffs.push(handoff);
            handoff = { id: parseScalar(handoffStart[1]) };
            continue;
        }

        const prop = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (handoff && prop) {
            handoff[prop[1]] = parseScalar(prop[2]);
        }
    }

    if (handoff) data.handoffs.push(handoff);

    for (const item of data.handoffs) {
        if (!Array.isArray(item.files))
            item.files = item.files ? [String(item.files)] : [];
        item.status = String(item.status || '')
            .trim()
            .toLowerCase();
    }

    return data;
}

function parseCodexActiveBlocksContent(content) {
    const blocks = parseCommentBlocksContent(content, 'CODEX_ACTIVE');
    for (const block of blocks) {
        if (!Array.isArray(block.files)) {
            block.files = block.files ? [String(block.files)] : [];
        }
        block.codex_instance = String(
            block.codex_instance || 'codex_backend_ops'
        )
            .trim()
            .toLowerCase();
        block.subfront_id = String(block.subfront_id || '').trim();
    }
    return blocks;
}

function normalizeCodexStrategyBlocks(blocks = []) {
    for (const block of blocks) {
        if (!Array.isArray(block.subfront_ids)) {
            block.subfront_ids = block.subfront_ids
                ? [String(block.subfront_ids)]
                : [];
        }
        block.subfront_ids = block.subfront_ids
            .map((value) => String(value || '').trim())
            .filter(Boolean);
        block.status = String(block.status || '')
            .trim()
            .toLowerCase();
    }
    return blocks;
}

function parseCodexStrategyActiveBlocksContent(content) {
    return normalizeCodexStrategyBlocks(
        parseCommentBlocksContent(content, 'CODEX_STRATEGY_ACTIVE')
    );
}

function parseCodexStrategyNextBlocksContent(content) {
    return normalizeCodexStrategyBlocks(
        parseCommentBlocksContent(content, 'CODEX_STRATEGY_NEXT')
    );
}

function parseCodexStrategyBlocksContent(content) {
    return {
        active: parseCodexStrategyActiveBlocksContent(content),
        next: parseCodexStrategyNextBlocksContent(content),
    };
}

function parseSignalsContent(content) {
    const lines = normalizeEol(content).split('\n');
    const data = { version: 1, updated_at: '', signals: [] };
    let inSignals = false;
    let signal = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inSignals) {
            data.version = parseScalar(versionMatch[1]);
            continue;
        }
        const updatedAtMatch = line.match(/^updated_at:\s*(.+)$/);
        if (updatedAtMatch && !inSignals) {
            data.updated_at = String(parseScalar(updatedAtMatch[1]) || '');
            continue;
        }
        if (trimmed === 'signals:') {
            inSignals = true;
            if (signal) {
                data.signals.push(signal);
                signal = null;
            }
            continue;
        }
        if (!inSignals) continue;

        const signalStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
        if (signalStart) {
            if (signal) data.signals.push(signal);
            signal = { id: parseScalar(signalStart[1]) };
            continue;
        }

        const prop = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (signal && prop) {
            signal[prop[1]] = parseScalar(prop[2]);
        }
    }

    if (signal) data.signals.push(signal);
    return data;
}

function parseJobsContent(content) {
    const lines = normalizeEol(content).split('\n');
    const data = { version: 1, updated_at: '', jobs: [] };
    let inJobs = false;
    let job = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inJobs) {
            data.version = parseScalar(versionMatch[1]);
            continue;
        }
        const updatedAtMatch = line.match(/^updated_at:\s*(.+)$/);
        if (updatedAtMatch && !inJobs) {
            data.updated_at = String(parseScalar(updatedAtMatch[1]) || '');
            continue;
        }
        if (trimmed === 'jobs:') {
            inJobs = true;
            if (job) {
                data.jobs.push(job);
                job = null;
            }
            continue;
        }
        if (!inJobs) continue;

        const jobStart = line.match(/^\s{2}-\s+key:\s*(.+)$/);
        if (jobStart) {
            if (job) data.jobs.push(job);
            job = { key: parseScalar(jobStart[1]) };
            continue;
        }

        const prop = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (job && prop) {
            job[prop[1]] = parseScalar(prop[2]);
        }
    }

    if (job) data.jobs.push(job);

    for (const item of data.jobs) {
        item.key = String(item.key || '').trim();
        item.enabled = parseBooleanLike(item.enabled, true);
        item.expected_max_lag_seconds = Number.parseInt(
            String(item.expected_max_lag_seconds || '0'),
            10
        );
        if (!Number.isFinite(item.expected_max_lag_seconds)) {
            item.expected_max_lag_seconds = 0;
        }
    }

    return data;
}

function parseDecisionsContent(content) {
    const lines = normalizeEol(content).split('\n');
    const data = { version: 1, policy: {}, decisions: [] };
    let inPolicy = false;
    let inDecisions = false;
    let decision = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inPolicy && !inDecisions) {
            data.version = parseScalar(versionMatch[1]);
            continue;
        }
        if (trimmed === 'policy:') {
            inPolicy = true;
            inDecisions = false;
            if (decision) {
                data.decisions.push(decision);
                decision = null;
            }
            continue;
        }
        if (trimmed === 'decisions:') {
            inPolicy = false;
            inDecisions = true;
            if (decision) {
                data.decisions.push(decision);
                decision = null;
            }
            continue;
        }
        if (inPolicy) {
            const policyMatch = line.match(/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (policyMatch) {
                data.policy[policyMatch[1]] = parseScalar(policyMatch[2]);
            }
            continue;
        }
        if (!inDecisions) continue;

        const decisionStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
        if (decisionStart) {
            if (decision) data.decisions.push(decision);
            decision = { id: parseScalar(decisionStart[1]) };
            continue;
        }

        const prop = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
        if (decision && prop) {
            decision[prop[1]] = parseScalar(prop[2]);
        }
    }

    if (decision) data.decisions.push(decision);

    for (const item of data.decisions) {
        item.id = String(item.id || '').trim();
        item.strategy_id = String(item.strategy_id || '').trim();
        item.focus_id = String(item.focus_id || '').trim();
        item.focus_step = String(item.focus_step || '').trim();
        item.title = String(item.title || '').trim();
        item.owner = String(item.owner || '').trim();
        item.status = String(item.status || '')
            .trim()
            .toLowerCase();
        item.due_at = String(item.due_at || '').trim();
        item.recommended_option = String(item.recommended_option || '').trim();
        item.selected_option = String(item.selected_option || '').trim();
        item.rationale = String(item.rationale || '').trim();
        item.opened_at = String(item.opened_at || '').trim();
        item.resolved_at = String(item.resolved_at || '').trim();
        if (!Array.isArray(item.related_tasks)) {
            item.related_tasks = item.related_tasks
                ? [String(item.related_tasks)]
                : [];
        }
        item.related_tasks = item.related_tasks
            .map((value) => String(value || '').trim())
            .filter(Boolean);
    }

    return data;
}

module.exports = {
    normalizeEol,
    unquote,
    parseInlineArray,
    parseScalar,
    parseBoardContent,
    parseHandoffsContent,
    parseCodexActiveBlocksContent,
    parseCodexStrategyActiveBlocksContent,
    parseCodexStrategyNextBlocksContent,
    parseCodexStrategyBlocksContent,
    parseSignalsContent,
    parseJobsContent,
    parseDecisionsContent,
};
