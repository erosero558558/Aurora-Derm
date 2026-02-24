#!/usr/bin/env node
/**
 * Jules Dispatch & Monitor
 *
 * Reads tasks from JULES_TASKS.md and manages Jules sessions.
 *
 * Usage:
 *   JULES_API_KEY=xxx node jules-dispatch.js status
 *   JULES_API_KEY=xxx node jules-dispatch.js dispatch
 *   JULES_API_KEY=xxx node jules-dispatch.js watch
 *   JULES_API_KEY=xxx node jules-dispatch.js add "Task title" "Prompt text"
 */

const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const SOURCE_ID = 'github/erosero558558/piel-en-armonia';
const TASKS_FILE = resolve(__dirname, 'JULES_TASKS.md');

const API_KEY = process.env.JULES_API_KEY;
if (!API_KEY) {
    console.error('ERROR: Set JULES_API_KEY env var before running.');
    process.exit(1);
}

// ── JULES_TASKS.md parser ─────────────────────────────────────────────────────

/**
 * Parse tasks from JULES_TASKS.md.
 * Each task is delimited by <!-- TASK ... --> ... <!-- /TASK -->
 * @returns {{ title: string, prompt: string, status: string, session: string, dispatched: string, raw: string, start: number, end: number }[]}
 */
function parseTasks(rawContent) {
    // Normalize line endings so the regex works on both CRLF and LF files.
    const content = rawContent.replace(/\r\n/g, '\n');
    const tasks = [];
    const taskRegex = /<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/g;
    let match;

    while ((match = taskRegex.exec(content)) !== null) {
        const metaBlock = match[1];
        const body = match[2];

        const meta = {};
        for (const line of metaBlock.split('\n')) {
            const m = line.match(/^(\w+):\s*(.*)/);
            if (m) {
                meta[m[1].trim()] = m[2].trim();
            }
        }

        // Extract title from first H3 heading in body
        const titleMatch = body.match(/###\s+(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : '(untitled)';

        // Prompt is everything after the H3 heading, trimmed
        const prompt = body
            .replace(/###\s+.+\n?/, '')
            .trim();

        const status = (meta.status || 'pending').toLowerCase();
        // Skip format examples (status contains spaces/pipes, not a real task).
        const VALID = new Set(['pending', 'dispatched', 'done', 'failed']);
        if (!VALID.has(status)) continue;

        tasks.push({
            title,
            prompt,
            status,
            session: meta.session || '',
            dispatched: meta.dispatched || '',
            _raw: match[0],
            _start: match.index,
            _end: match.index + match[0].length,
        });
    }

    return tasks;
}

/**
 * Update a task's metadata in JULES_TASKS.md in-place.
 */
function updateTaskInFile(title, updates) {
    const raw = readFileSync(TASKS_FILE, 'utf8');
    // Normalize for parsing; write back with original line endings.
    const useCrlf = raw.includes('\r\n');
    const content = raw.replace(/\r\n/g, '\n');
    const tasks = parseTasks(content);
    const task = tasks.find((t) => t.title.toLowerCase() === title.toLowerCase());
    if (!task) return;

    const metaBlock = task._raw.match(/<!-- TASK\n([\s\S]*?)-->/)[1];
    const newMeta = {};
    for (const line of metaBlock.split('\n')) {
        const m = line.match(/^(\w+):\s*(.*)/);
        if (m) newMeta[m[1].trim()] = m[2].trim();
    }

    Object.assign(newMeta, updates);

    const newMetaBlock = Object.entries(newMeta)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    const newTaskOpenTag = `<!-- TASK\n${newMetaBlock}\n-->`;

    const newRaw = task._raw.replace(/<!-- TASK[\s\S]*?-->/, newTaskOpenTag);
    let updated = content.slice(0, task._start) + newRaw + content.slice(task._end);
    if (useCrlf) updated = updated.replace(/\n/g, '\r\n');
    writeFileSync(TASKS_FILE, updated, 'utf8');
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'X-Goog-Api-Key': API_KEY,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jules API ${res.status}: ${text}`);
    }
    return res.json();
}

async function getSessions(pageSize = 50) {
    const data = await apiFetch(`/sessions?pageSize=${pageSize}`);
    return data.sessions || [];
}

async function createSession(task) {
    return apiFetch('/sessions', {
        method: 'POST',
        body: JSON.stringify({
            title: task.title,
            prompt: task.prompt,
            sourceContext: {
                source: `sources/${SOURCE_ID}`,
                githubRepoContext: { startingBranch: 'main' },
            },
            requirePlanApproval: false,
        }),
    });
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdStatus() {
    const [sessions, localTasks] = await Promise.all([
        getSessions(),
        Promise.resolve(parseTasks(readFileSync(TASKS_FILE, 'utf8'))),
    ]);

    const byState = {};
    for (const s of sessions) {
        (byState[s.state] = byState[s.state] || []).push(s);
    }

    const stateLabel = {
        IN_PROGRESS: 'WORKING',
        COMPLETED: 'DONE   ',
        FAILED: 'FAILED ',
        AWAITING_PLAN_APPROVAL: 'WAITING',
    };

    console.log(`\n== Jules Sessions (${sessions.length} total) ==\n`);
    for (const [state, list] of Object.entries(byState)) {
        const label = stateLabel[state] || state;
        for (const s of list) {
            const title = (s.title || '').slice(0, 65).padEnd(65);
            const updated = (s.updateTime || '').slice(0, 19);
            console.log(`[${label}] ${title} | ${updated}`);
            if (s.url) console.log(`         ${s.url}`);
        }
        console.log();
    }

    const pendingLocal = localTasks.filter((t) => t.status === 'pending');
    if (pendingLocal.length > 0) {
        console.log(`== Pending in JULES_TASKS.md (${pendingLocal.length}) ==\n`);
        for (const t of pendingLocal) {
            console.log(`  [ ] ${t.title}`);
        }
        console.log();
    }
}

async function cmdDispatch() {
    const content = readFileSync(TASKS_FILE, 'utf8');
    const localTasks = parseTasks(content);
    const pending = localTasks.filter((t) => t.status === 'pending');

    if (pending.length === 0) {
        console.log('No pending tasks in JULES_TASKS.md.');
        return;
    }

    const existing = await getSessions();
    const existingTitles = new Set(existing.map((s) => (s.title || '').toLowerCase()));

    for (const task of pending) {
        if (existingTitles.has(task.title.toLowerCase())) {
            console.log(`SKIP (already exists): ${task.title}`);
            updateTaskInFile(task.title, { status: 'dispatched' });
            continue;
        }
        try {
            const session = await createSession(task);
            const today = new Date().toISOString().slice(0, 10);
            updateTaskInFile(task.title, {
                status: 'dispatched',
                session: session.name || task.title,
                dispatched: today,
            });
            console.log(`DISPATCHED: ${task.title}`);
            if (session.url) console.log(`  URL: ${session.url}`);
            if (session.name) console.log(`  ID:  ${session.name}`);
        } catch (err) {
            console.error(`FAILED to dispatch "${task.title}": ${err.message}`);
            updateTaskInFile(task.title, { status: 'failed' });
        }
        console.log();
    }
}

async function cmdWatch(intervalSec = 60) {
    console.log(`Watching Jules sessions every ${intervalSec}s. Ctrl+C to stop.\n`);
    const seen = new Set();

    const poll = async () => {
        const sessions = await getSessions();
        const content = readFileSync(TASKS_FILE, 'utf8');
        const localTasks = parseTasks(content);

        for (const s of sessions) {
            const key = `${s.name}:${s.state}`;
            if (!seen.has(key)) {
                seen.add(key);
                const ts = new Date().toLocaleTimeString();
                if (s.state === 'COMPLETED') {
                    console.log(`[${ts}] DONE: ${s.title}`);
                    if (s.url) console.log(`        PR ready -> ${s.url}`);
                    // Mark as done in JULES_TASKS.md
                    const local = localTasks.find(
                        (t) => t.title.toLowerCase() === (s.title || '').toLowerCase()
                    );
                    if (local && local.status !== 'done') {
                        updateTaskInFile(s.title, { status: 'done' });
                    }
                } else if (s.state === 'FAILED') {
                    console.log(`[${ts}] FAIL: ${s.title}`);
                    if (s.url) console.log(`        Check -> ${s.url}`);
                } else if (s.state === 'IN_PROGRESS') {
                    console.log(`[${ts}] WORKING: ${s.title}`);
                }
            }
        }
    };

    await poll();
    setInterval(poll, intervalSec * 1000);
}

async function cmdAdd(title, prompt) {
    if (!title || !prompt) {
        console.error('Usage: node jules-dispatch.js add "Title" "Prompt"');
        process.exit(1);
    }

    const today = new Date().toISOString().slice(0, 10);
    const newTask = `
<!-- TASK
status: pending
session:
dispatched:
-->
### ${title}

${prompt}

<!-- /TASK -->
`;

    const content = readFileSync(TASKS_FILE, 'utf8');
    writeFileSync(TASKS_FILE, content.trimEnd() + '\n' + newTask + '\n', 'utf8');
    console.log(`Added task: ${title}`);
    console.log(`Run "node jules-dispatch.js dispatch" to send it to Jules.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || 'status';
const cmds = {
    status: cmdStatus,
    dispatch: cmdDispatch,
    watch: cmdWatch,
    add: () => cmdAdd(process.argv[3], process.argv[4]),
};

if (!cmds[cmd]) {
    console.error(`Unknown command: ${cmd}. Use: status | dispatch | watch | add`);
    process.exit(1);
}

cmds[cmd]().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
