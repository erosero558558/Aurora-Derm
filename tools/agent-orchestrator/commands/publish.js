'use strict';

const { appendFileSync, mkdirSync } = require('fs');
const { dirname, resolve } = require('path');
const { spawnSync } = require('child_process');

function normalizePathToken(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function wildcardToRegex(pattern) {
    const escaped = String(pattern || '')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function parseGitStatusPorcelain(raw = '') {
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const status = line.slice(0, 2);
            const pathRaw = line.slice(3).trim();
            const normalizedPath = normalizePathToken(
                pathRaw.includes(' -> ')
                    ? pathRaw.split(' -> ').pop()
                    : pathRaw
            );
            return {
                status,
                raw_path: pathRaw.includes(' -> ')
                    ? pathRaw.split(' -> ').pop()
                    : pathRaw,
                path: normalizedPath,
            };
        })
        .filter((entry) => entry.path);
}

function isPathAllowedByPatterns(path, patterns = []) {
    const safePath = normalizePathToken(path);
    return (Array.isArray(patterns) ? patterns : []).some((pattern) => {
        const safePattern = normalizePathToken(pattern);
        if (!safePattern) return false;
        if (safePattern === safePath) return true;
        return wildcardToRegex(safePattern).test(safePath);
    });
}

function classifyPublishSurface(files = []) {
    const normalizedFiles = Array.isArray(files)
        ? files.map((file) => normalizePathToken(file)).filter(Boolean)
        : [];
    const isOrchestrator = normalizedFiles.some((file) => {
        return (
            file === 'agent-orchestrator.js' ||
            file === 'agents.md' ||
            file === 'claude.md' ||
            file === 'governance-policy.json' ||
            file === 'agent_jobs.yaml' ||
            file.startsWith('tools/agent-orchestrator/') ||
            file.startsWith('.github/workflows/') ||
            file.startsWith('bin/validate-agent-governance') ||
            file.startsWith('bin/retire-executors-codex-only') ||
            file.startsWith('plan_maestro_codex_2026.md') ||
            file.startsWith('jules_tasks.md') ||
            file.startsWith('kimi_tasks.md')
        );
    });
    const isBackend = normalizedFiles.some((file) => {
        return (
            file.endsWith('.php') ||
            file === 'cron.php' ||
            file.startsWith('controllers/') ||
            file.startsWith('lib/') ||
            file.startsWith('bin/')
        );
    });
    const isFrontend = normalizedFiles.some((file) => {
        return (
            file.endsWith('.html') ||
            file.endsWith('.css') ||
            file.endsWith('.js') ||
            file.startsWith('src/apps/') ||
            file.startsWith('templates/') ||
            file.startsWith('content/') ||
            file.startsWith('js/')
        );
    });
    return {
        orchestrator: isOrchestrator,
        backend: isBackend,
        frontend: isFrontend,
    };
}

function buildGateCommands(surface = {}) {
    const commands = [];
    const add = (id, program, args) => {
        if (commands.some((item) => item.id === id)) return;
        commands.push({ id, program, args });
    };

    add('board-doctor', process.execPath, [
        'agent-orchestrator.js',
        'board',
        'doctor',
        '--json',
    ]);
    add('conflicts', process.execPath, [
        'agent-orchestrator.js',
        'conflicts',
        '--json',
    ]);
    add('codex-check', process.execPath, [
        'agent-orchestrator.js',
        'codex-check',
        '--json',
    ]);

    if (surface.orchestrator) {
        add('agent-test', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'agent:test',
        ]);
        add(
            'agent-validate',
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', 'agent:validate']
        );
    }
    if (surface.backend) {
        add('lint-php', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'lint:php',
        ]);
        add('test-php', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'test:php',
        ]);
    }
    if (surface.frontend) {
        add('lint-js', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'lint:js',
        ]);
        add(
            'services-check',
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', 'services:check']
        );
        add(
            'smoke-public-routing',
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', 'smoke:public:routing']
        );
    }

    return commands;
}

function runCommand(program, args, options = {}) {
    const result = spawnSync(program, args, {
        cwd: options.cwd || process.cwd(),
        encoding: 'utf8',
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    return {
        ok: result.status === 0,
        code: result.status === null ? 1 : result.status,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        command: [program, ...args].join(' '),
    };
}

function appendPublishEvent(path, event) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
}

function readLatestLanePublish(path, lane) {
    try {
        const { existsSync, readFileSync } = require('fs');
        if (!existsSync(path)) return null;
        const lines = String(readFileSync(path, 'utf8') || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .reverse();
        for (const line of lines) {
            const parsed = JSON.parse(line);
            if (String(parsed.codex_instance || '') === String(lane || '')) {
                return parsed;
            }
        }
    } catch {
        return null;
    }
    return null;
}

async function sleep(ms) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForPublishedCommit(ctx, expectedCommit, maxWaitSeconds) {
    const {
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot,
    } = ctx;
    const deadline = Date.now() + maxWaitSeconds * 1000;
    let lastJob = null;
    while (Date.now() <= deadline) {
        const jobs = await buildJobsSnapshot(parseJobs());
        lastJob = findJobSnapshot(jobs, 'public_main_sync') || null;
        if (
            lastJob &&
            lastJob.healthy &&
            String(lastJob.job_id || '') ===
                '8d31e299-7e57-4959-80b5-aaa2d73e9674' &&
            String(lastJob.deployed_commit || '') === String(expectedCommit || '')
        ) {
            return { ok: true, job: lastJob };
        }
        await sleep(15000);
    }
    return { ok: false, job: lastJob };
}

async function handlePublishCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
        rootPath,
        publishEventsPath,
    } = ctx;
    const subcommand = String(args[0] || '').trim().toLowerCase();
    const wantsJson = args.includes('--json');
    if (subcommand !== 'checkpoint') {
        throw new Error(
            'Uso: node agent-orchestrator.js publish checkpoint <CDX-###> --summary "..." --expect-rev <n> [--force] [--json]'
        );
    }

    const { flags, positionals } = parseFlags(args.slice(1));
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!/^CDX-\d+$/.test(taskId)) {
        const error = new Error('publish checkpoint requiere task_id CDX-###');
        error.code = 'invalid_task_id';
        error.error_code = 'invalid_task_id';
        throw error;
    }
    const summary = String(flags.summary || '').trim();
    if (!summary) {
        const error = new Error('publish checkpoint requiere --summary');
        error.code = 'missing_summary';
        error.error_code = 'missing_summary';
        throw error;
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const currentRevision = Number.parseInt(
        String(board?.policy?.revision || '0'),
        10
    );
    const expectedRevision = Number.parseInt(
        String(flags['expect-rev'] ?? flags.expect_rev ?? ''),
        10
    );
    if (!Number.isFinite(expectedRevision)) {
        const error = new Error(
            'publish checkpoint requiere --expect-rev <revision_actual>'
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    if (expectedRevision !== currentRevision) {
        const error = new Error(
            `publish checkpoint revision mismatch: expected ${expectedRevision}, actual ${currentRevision}`
        );
        error.code = 'board_revision_mismatch';
        error.error_code = 'board_revision_mismatch';
        error.expected_revision = expectedRevision;
        error.actual_revision = currentRevision;
        throw error;
    }

    if (String(task.executor || '').trim().toLowerCase() !== 'codex') {
        const error = new Error(`publish checkpoint requiere executor=codex en ${taskId}`);
        error.code = 'invalid_executor';
        error.error_code = 'invalid_executor';
        throw error;
    }
    const status = String(task.status || '').trim();
    if (!['in_progress', 'review'].includes(status)) {
        const error = new Error(
            `publish checkpoint requiere status in_progress|review en ${taskId}`
        );
        error.code = 'invalid_status';
        error.error_code = 'invalid_status';
        throw error;
    }

    const codexInstance = String(task.codex_instance || 'codex_backend_ops').trim();
    const latestPublish = readLatestLanePublish(publishEventsPath, codexInstance);
    if (!flags.force && latestPublish && latestPublish.published_at) {
        const lastPublishedMs = Date.parse(String(latestPublish.published_at || ''));
        if (Number.isFinite(lastPublishedMs)) {
            const deltaSeconds = Math.floor((Date.now() - lastPublishedMs) / 1000);
            if (deltaSeconds < 90) {
                const error = new Error(
                    `publish checkpoint cooldown activo para ${codexInstance}: ${deltaSeconds}s`
                );
                error.code = 'publish_cooldown_active';
                error.error_code = 'publish_cooldown_active';
                throw error;
            }
        }
    }

    const statusResult = runCommand(
        'git',
        ['status', '--porcelain', '--untracked-files=all'],
        { cwd: rootPath, capture: true }
    );
    if (!statusResult.ok) {
        throw new Error(statusResult.stderr || statusResult.stdout || 'git status fallo');
    }
    const dirtyEntries = parseGitStatusPorcelain(statusResult.stdout);
    if (dirtyEntries.length === 0) {
        const error = new Error('publish checkpoint no encontro cambios para publicar');
        error.code = 'no_changes_to_publish';
        error.error_code = 'no_changes_to_publish';
        throw error;
    }

    const allowedPatterns = [
        ...(Array.isArray(task.files) ? task.files : []),
        'agent_board.yaml',
        'agent_handoffs.yaml',
        'plan_maestro_codex_2026.md',
        `verification/agent-runs/${normalizePathToken(taskId)}.md`,
    ].map((value) => normalizePathToken(value));
    const outsideScope = dirtyEntries.filter(
        (entry) => !isPathAllowedByPatterns(entry.path, allowedPatterns)
    );
    if (outsideScope.length > 0) {
        const error = new Error(
            `publish checkpoint encontro cambios fuera de scope: ${outsideScope.map((item) => item.path).join(', ')}`
        );
        error.code = 'publish_dirty_outside_scope';
        error.error_code = 'publish_dirty_outside_scope';
        throw error;
    }

    const dirtyFiles = dirtyEntries.map((entry) => entry.raw_path);
    const surface = classifyPublishSurface(dirtyFiles);
    const gateCommands = buildGateCommands(surface);
    for (const gate of gateCommands) {
        const gateResult = runCommand(gate.program, gate.args, {
            cwd: rootPath,
            capture: false,
        });
        if (!gateResult.ok) {
            const error = new Error(
                `publish checkpoint gate fallo: ${gate.id}`
            );
            error.code = 'publish_gate_failed';
            error.error_code = 'publish_gate_failed';
            throw error;
        }
    }

    const addResult = runCommand('git', ['add', '--', ...dirtyFiles], {
        cwd: rootPath,
        capture: true,
    });
    if (!addResult.ok) {
        throw new Error(addResult.stderr || addResult.stdout || 'git add fallo');
    }

    const diffCachedResult = runCommand('git', ['diff', '--cached', '--name-only'], {
        cwd: rootPath,
        capture: true,
    });
    if (!diffCachedResult.ok) {
        throw new Error(
            diffCachedResult.stderr || diffCachedResult.stdout || 'git diff --cached fallo'
        );
    }
    const stagedFiles = diffCachedResult.stdout
        .split(/\r?\n/)
        .map((line) => normalizePathToken(line))
        .filter(Boolean);
    if (stagedFiles.length === 0) {
        const error = new Error('publish checkpoint no encontro cambios staged');
        error.code = 'no_changes_to_publish';
        error.error_code = 'no_changes_to_publish';
        throw error;
    }

    const commitMessage = `chore(codex-publish): checkpoint ${taskId} [lane:${codexInstance}] - ${summary}`;
    const commitResult = runCommand('git', ['commit', '-m', commitMessage], {
        cwd: rootPath,
        capture: true,
    });
    if (!commitResult.ok) {
        throw new Error(commitResult.stderr || commitResult.stdout || 'git commit fallo');
    }

    const headResult = runCommand('git', ['rev-parse', 'HEAD'], {
        cwd: rootPath,
        capture: true,
    });
    if (!headResult.ok) {
        throw new Error(headResult.stderr || headResult.stdout || 'git rev-parse HEAD fallo');
    }
    const headSha = String(headResult.stdout || '').trim();

    const syncResult = runCommand(
        process.execPath,
        [
            resolve(rootPath, 'bin', 'sync-main-safe.js'),
            '--remote',
            'origin',
            '--branch',
            'main',
            '--source-ref',
            'HEAD',
            '--max-sync-attempts',
            '3',
            '--json',
        ],
        { cwd: rootPath, capture: true }
    );
    if (!syncResult.ok) {
        throw new Error(syncResult.stderr || syncResult.stdout || 'sync-main-safe fallo');
    }

    const jobsRegistry = parseJobs();
    const publicSyncJob = findJobSnapshot(
        await buildJobsSnapshot(jobsRegistry),
        'public_main_sync'
    );
    if (!publicSyncJob) {
        const error = new Error('publish checkpoint requiere job public_main_sync');
        error.code = 'job_not_found';
        error.error_code = 'job_not_found';
        throw error;
    }

    const liveCheck = await waitForPublishedCommit(ctx, headSha, 180);
    appendPublishEvent(publishEventsPath, {
        version: 1,
        task_id: taskId,
        codex_instance: codexInstance,
        published_at: new Date().toISOString(),
        commit: headSha,
        summary,
        live_ok: Boolean(liveCheck.ok),
        deployed_commit: String(liveCheck.job?.deployed_commit || ''),
    });

    const report = {
        version: 1,
        ok: Boolean(liveCheck.ok),
        command: 'publish checkpoint',
        task_id: taskId,
        codex_instance: codexInstance,
        commit: headSha,
        staged_files: stagedFiles,
        gates_run: gateCommands.map((item) => item.id),
        public_sync: liveCheck.job,
    };
    if (!liveCheck.ok) {
        report.error_code = 'publish_not_live_in_window';
        report.message =
            'push completado pero public_main_sync no reflejo el commit en <=180s';
    }

    if (wantsJson) {
        printJson(report);
        if (!report.ok) process.exitCode = 1;
        return report;
    }

    if (!report.ok) {
        const error = new Error(
            'publish checkpoint completo push pero no confirmo deploy live en la ventana'
        );
        error.code = 'publish_not_live_in_window';
        error.error_code = 'publish_not_live_in_window';
        throw error;
    }

    console.log(`Publish checkpoint OK: ${taskId} -> ${headSha}`);
    return report;
}

module.exports = {
    parseGitStatusPorcelain,
    isPathAllowedByPatterns,
    classifyPublishSurface,
    buildGateCommands,
    handlePublishCommand,
};
