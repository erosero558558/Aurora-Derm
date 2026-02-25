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

module.exports = {
    normalizeEol,
    unquote,
    parseInlineArray,
    parseScalar,
    parseBoardContent,
    parseHandoffsContent,
    parseCodexActiveBlocksContent,
};
