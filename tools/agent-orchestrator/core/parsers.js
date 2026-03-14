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
    return safe;
}

function normalizeBoardStrategy(strategy) {
    if (!strategy || typeof strategy !== 'object') {
        return { active: null };
    }
    const active =
        strategy.active && typeof strategy.active === 'object'
            ? { ...strategy.active }
            : null;
    if (!active) {
        return { active: null };
    }
    active.id = String(active.id || '').trim();
    active.title = String(active.title || '').trim();
    active.objective = String(active.objective || '').trim();
    active.owner = String(active.owner || '').trim();
    active.status = String(active.status || '')
        .trim()
        .toLowerCase();
    active.started_at = String(active.started_at || '').trim();
    active.review_due_at = String(active.review_due_at || '').trim();
    active.closed_at = String(active.closed_at || '').trim();
    active.close_reason = String(active.close_reason || '').trim();
    active.success_signal = String(active.success_signal || '').trim();
    if (!Array.isArray(active.exit_criteria)) {
        active.exit_criteria = active.exit_criteria
            ? [String(active.exit_criteria)]
            : [];
    }
    active.exit_criteria = active.exit_criteria
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    active.subfronts = Array.isArray(active.subfronts)
        ? active.subfronts
              .map((subfront) => normalizeStrategySubfront(subfront))
              .filter(Boolean)
        : [];
    return { active };
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
        strategy: { active: null },
        tasks: [],
    };
    let inPolicy = false;
    let inStrategy = false;
    let inStrategyActive = false;
    let inStrategySubfronts = false;
    let inTasks = false;
    let strategySubfront = null;
    let task = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === 'policy:') {
            if (
                strategySubfront &&
                board.strategy &&
                board.strategy.active &&
                Array.isArray(board.strategy.active.subfronts)
            ) {
                board.strategy.active.subfronts.push(strategySubfront);
                strategySubfront = null;
            }
            inPolicy = true;
            inStrategy = false;
            inStrategyActive = false;
            inStrategySubfronts = false;
            inTasks = false;
            continue;
        }
        if (trimmed === 'strategy:') {
            inStrategy = true;
            inStrategyActive = false;
            inStrategySubfronts = false;
            inPolicy = false;
            inTasks = false;
            if (!board.strategy || typeof board.strategy !== 'object') {
                board.strategy = { active: null };
            }
            continue;
        }
        if (trimmed === 'tasks:') {
            if (
                strategySubfront &&
                board.strategy &&
                board.strategy.active &&
                Array.isArray(board.strategy.active.subfronts)
            ) {
                board.strategy.active.subfronts.push(strategySubfront);
                strategySubfront = null;
            }
            inTasks = true;
            inPolicy = false;
            inStrategy = false;
            inStrategyActive = false;
            inStrategySubfronts = false;
            if (task) {
                board.tasks.push(task);
                task = null;
            }
            continue;
        }

        if (inStrategy) {
            const activeMatch = line.match(/^\s{2}active:\s*(.*)$/);
            if (activeMatch) {
                const value = String(activeMatch[1] || '').trim();
                inStrategyActive = true;
                inStrategySubfronts = false;
                strategySubfront = null;
                board.strategy.active =
                    value === 'null' ? null : { subfronts: [] };
                continue;
            }

            if (
                inStrategyActive &&
                board.strategy.active &&
                trimmed === 'subfronts:'
            ) {
                inStrategySubfronts = true;
                if (!Array.isArray(board.strategy.active.subfronts)) {
                    board.strategy.active.subfronts = [];
                }
                continue;
            }

            if (inStrategySubfronts && board.strategy.active) {
                const subfrontStart = line.match(
                    /^\s{6}-\s+([a-zA-Z_][\w-]*):\s*(.*)$/
                );
                if (subfrontStart) {
                    if (strategySubfront) {
                        board.strategy.active.subfronts.push(strategySubfront);
                    }
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

            if (inStrategyActive && board.strategy.active) {
                const activeProp = line.match(
                    /^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/
                );
                if (activeProp) {
                    board.strategy.active[activeProp[1]] = parseScalar(
                        activeProp[2]
                    );
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

    if (
        strategySubfront &&
        board.strategy &&
        board.strategy.active &&
        Array.isArray(board.strategy.active.subfronts)
    ) {
        board.strategy.active.subfronts.push(strategySubfront);
    }
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
        item.strategy_id = String(item.strategy_id || '').trim();
        item.subfront_id = String(item.subfront_id || '').trim();
        item.strategy_role = String(item.strategy_role || '')
            .trim()
            .toLowerCase();
        item.strategy_reason = String(item.strategy_reason || '').trim();
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
    }
    return blocks;
}

function parseCodexStrategyActiveBlocksContent(content) {
    const blocks = parseCommentBlocksContent(content, 'CODEX_STRATEGY_ACTIVE');
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

module.exports = {
    normalizeEol,
    unquote,
    parseInlineArray,
    parseScalar,
    parseBoardContent,
    parseHandoffsContent,
    parseCodexActiveBlocksContent,
    parseCodexStrategyActiveBlocksContent,
    parseSignalsContent,
    parseJobsContent,
};
