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

function parseBoardContent(content, options = {}) {
    const allowedStatuses = options.allowedStatuses || new Set();
    const lines = normalizeEol(content).split('\n');
    const board = { version: 1, policy: {}, tasks: [] };
    let inPolicy = false;
    let inTasks = false;
    let task = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === 'policy:') {
            inPolicy = true;
            inTasks = false;
            continue;
        }
        if (trimmed === 'tasks:') {
            inTasks = true;
            inPolicy = false;
            if (task) {
                board.tasks.push(task);
                task = null;
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
        item.status = String(item.status || '').trim();
        if (allowedStatuses.size > 0 && !allowedStatuses.has(item.status)) {
            throw new Error(
                `Estado no permitido en ${item.id}: ${item.status}`
            );
        }
    }

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
    const raw = normalizeEol(content);
    const regex = /<!--\s*CODEX_ACTIVE\s*\n([\s\S]*?)-->/g;
    const blocks = [];
    let match;

    while ((match = regex.exec(raw)) !== null) {
        const block = {};
        for (const line of match[1].split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const prop = trimmed.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (!prop) continue;
            block[prop[1]] = parseScalar(prop[2]);
        }
        if (!Array.isArray(block.files)) {
            block.files = block.files ? [String(block.files)] : [];
        }
        blocks.push(block);
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
    parseSignalsContent,
    parseJobsContent,
};
