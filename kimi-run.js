#!/usr/bin/env node
/**
 * Kimi Code — Local task dispatcher
 *
 * Runs Kimi Code CLI in non-interactive mode against this repo,
 * then shows the git diff so you can review before committing.
 *
 * Usage:
 *   node kimi-run.js "Fix the bug in lib/ratelimit.php"
 *   node kimi-run.js --file KIMI_TASK.md
 *   node kimi-run.js --list               # show pending tasks in KIMI_TASKS.md
 *   node kimi-run.js --dispatch            # run all pending tasks in KIMI_TASKS.md
 *
 * Flags:
 *   --no-diff      skip showing git diff after task
 *   --commit       auto-commit after task (uses kimi output as message)
 *   --thinking     enable kimi thinking mode (slower, better)
 *   --model <id>   override model (default: kimi-for-coding)
 */

const { execSync, spawnSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve, join } = require('path');

const KIMI_BIN =
    process.env.KIMI_BIN ||
    resolve(
        process.env.APPDATA ||
            join(process.env.HOME || '', 'AppData', 'Roaming'),
        'Code/User/globalStorage/moonshot-ai.kimi-code/bin/kimi/kimi.exe'
    );
const WORK_DIR = resolve(__dirname);
const TASKS_FILE = join(WORK_DIR, 'KIMI_TASKS.md');

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
    noDiff: args.includes('--no-diff'),
    commit: args.includes('--commit'),
    thinking: args.includes('--thinking'),
    list: args.includes('--list'),
    dispatch: args.includes('--dispatch'),
    file: null,
    model: null,
    prompt: null,
};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') flags.file = args[i + 1];
    if (args[i] === '--model') flags.model = args[i + 1];
    if (!args[i].startsWith('--')) flags.prompt = args[i];
}

// ── KIMI_TASKS.md parser (same format as JULES_TASKS.md) ─────────────────────

function parseTasks(rawContent) {
    const content = rawContent.replace(/\r\n/g, '\n');
    const tasks = [];
    const taskRegex = /<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/g;
    const VALID = new Set(['pending', 'running', 'done', 'failed']);
    let match;

    while ((match = taskRegex.exec(content)) !== null) {
        const metaBlock = match[1];
        const body = match[2];
        const meta = {};
        for (const line of metaBlock.split('\n')) {
            const m = line.match(/^(\w+):\s*(.*)/);
            if (m) meta[m[1].trim()] = m[2].trim();
        }
        const status = (meta.status || 'pending').toLowerCase();
        if (!VALID.has(status)) continue;

        const titleMatch = body.match(/###\s+(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : '(untitled)';
        const prompt = body.replace(/###\s+.+\n?/, '').trim();

        tasks.push({
            title,
            prompt,
            status,
            _raw: match[0],
            _start: match.index,
            _end: match.index + match[0].length,
        });
    }
    return tasks;
}

function updateTaskStatus(title, status) {
    if (!existsSync(TASKS_FILE)) return;
    const raw = readFileSync(TASKS_FILE, 'utf8');
    const useCrlf = raw.includes('\r\n');
    const content = raw.replace(/\r\n/g, '\n');
    const tasks = parseTasks(content);
    const task = tasks.find((t) => t.title.toLowerCase() === title.toLowerCase());
    if (!task) return;

    const newRaw = task._raw.replace(
        /<!-- TASK\n([\s\S]*?)-->/,
        (_, meta) => {
            const newMeta = meta.replace(/^status:\s*.+/m, `status: ${status}`);
            return `<!-- TASK\n${newMeta}-->`;
        }
    );
    let updated = content.slice(0, task._start) + newRaw + content.slice(task._end);
    if (useCrlf) updated = updated.replace(/\n/g, '\r\n');
    writeFileSync(TASKS_FILE, updated, 'utf8');
}

// ── Kimi runner ───────────────────────────────────────────────────────────────

function runKimi(prompt) {
    if (!existsSync(KIMI_BIN)) {
        console.error(`ERROR: Kimi binary not found at:\n  ${KIMI_BIN}`);
        console.error('Update KIMI_BIN in kimi-run.js or set KIMI_BIN env var.');
        process.exit(1);
    }

    const kimiArgs = [
        '--quiet',
        '--yolo',
        '--work-dir', WORK_DIR,
        '--prompt', prompt,
    ];

    if (flags.thinking) kimiArgs.push('--thinking');
    if (flags.model) kimiArgs.push('--model', flags.model);

    console.log('\n── Running Kimi Code ─────────────────────────────────────────\n');
    console.log(`Prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}\n`);

    const result = spawnSync(KIMI_BIN, kimiArgs, {
        cwd: WORK_DIR,
        stdio: 'inherit',
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        console.error(`\nKimi exited with code ${result.status}`);
        return false;
    }
    return true;
}

function showDiff() {
    console.log('\n── Git diff (changes by Kimi) ────────────────────────────────\n');
    const diff = execSync('git diff --stat HEAD', {
        cwd: WORK_DIR,
        encoding: 'utf8',
    });
    if (diff.trim()) {
        console.log(diff);
        const fullDiff = execSync('git diff HEAD', { cwd: WORK_DIR, encoding: 'utf8' });
        // Print first 100 lines of diff for review
        const lines = fullDiff.split('\n').slice(0, 100);
        console.log(lines.join('\n'));
        if (fullDiff.split('\n').length > 100) {
            console.log('\n... (truncated — run `git diff HEAD` to see all changes)');
        }
    } else {
        console.log('(no changes detected)');
    }
}

function autoCommit(taskTitle) {
    const status = execSync('git status --porcelain', {
        cwd: WORK_DIR,
        encoding: 'utf8',
    });
    if (!status.trim()) {
        console.log('Nothing to commit.');
        return;
    }

    execSync('git add -A', { cwd: WORK_DIR });
    const msg = `feat(kimi): ${taskTitle}\n\nCo-Authored-By: Kimi Code CLI <noreply@moonshot.ai>\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`;
    execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: WORK_DIR, stdio: 'inherit' });
    console.log('\nCommit created.');
}

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdList() {
    if (!existsSync(TASKS_FILE)) {
        console.log('KIMI_TASKS.md not found. Create it first.');
        return;
    }
    const tasks = parseTasks(readFileSync(TASKS_FILE, 'utf8'));
    console.log(`\n== KIMI_TASKS.md (${tasks.length} total) ==\n`);
    for (const t of tasks) {
        const icon = { pending: '[ ]', running: '[~]', done: '[x]', failed: '[!]' }[t.status] || '[ ]';
        console.log(`${icon} ${t.title}`);
    }
    const pending = tasks.filter((t) => t.status === 'pending').length;
    console.log(`\nPending: ${pending}`);
}

function cmdDispatch() {
    if (!existsSync(TASKS_FILE)) {
        console.log('KIMI_TASKS.md not found. Create it first.');
        return;
    }
    const tasks = parseTasks(readFileSync(TASKS_FILE, 'utf8'));
    const pending = tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) {
        console.log('No pending tasks in KIMI_TASKS.md.');
        return;
    }

    for (const task of pending) {
        console.log(`\n== Task: ${task.title} ==`);
        updateTaskStatus(task.title, 'running');
        const ok = runKimi(task.prompt);
        if (ok) {
            if (!flags.noDiff) showDiff();
            if (flags.commit) autoCommit(task.title);
            updateTaskStatus(task.title, 'done');
        } else {
            updateTaskStatus(task.title, 'failed');
        }
    }
}

function cmdPrompt(prompt) {
    const ok = runKimi(prompt);
    if (ok) {
        if (!flags.noDiff) showDiff();
        if (flags.commit) autoCommit(prompt.slice(0, 72));
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (flags.list) {
    cmdList();
} else if (flags.dispatch) {
    cmdDispatch();
} else if (flags.file) {
    const prompt = readFileSync(flags.file, 'utf8').trim();
    cmdPrompt(prompt);
} else if (flags.prompt) {
    cmdPrompt(flags.prompt);
} else {
    console.log(`
Kimi Code — Local task runner

Usage:
  node kimi-run.js "Fix the rate limiter bug"
  node kimi-run.js --file task.md
  node kimi-run.js --list
  node kimi-run.js --dispatch

Flags:
  --no-diff      Skip git diff after task
  --commit       Auto-commit after task
  --thinking     Enable thinking mode
  --model <id>   Override model
`);
}
