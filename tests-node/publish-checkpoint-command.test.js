#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const { parseFlags } = require('../tools/agent-orchestrator/core/flags');
const { findJobSnapshot } = require('../tools/agent-orchestrator/domain/jobs');
const {
    classifyPublishSurface,
    buildGateCommands,
    handlePublishCommand,
} = require('../tools/agent-orchestrator/commands/publish');

function createRepoFixture() {
    const root = mkdtempSync(join(tmpdir(), 'publish-checkpoint-test-'));
    mkdirSync(join(root, 'bin'), { recursive: true });
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });

    writeFileSync(
        join(root, 'agent-orchestrator.js'),
        `#!/usr/bin/env node
'use strict';
const args = process.argv.slice(2);
if (args.includes('--json')) {
  console.log(JSON.stringify({ version: 1, ok: true, command: args.join(' ') }));
} else {
  console.log('OK');
}
`,
        'utf8'
    );
    writeFileSync(
        join(root, 'bin', 'sync-main-safe.js'),
        `#!/usr/bin/env node
'use strict';
console.log(JSON.stringify({ version: 1, ok: true, message: 'fixture sync ok' }));
`,
        'utf8'
    );
    writeFileSync(join(root, 'README.md'), '# fixture\n', 'utf8');
    writeFileSync(join(root, 'docs', 'in-scope.md'), '# scope\n', 'utf8');
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-900.md'),
        '# CDX-900\n',
        'utf8'
    );

    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'fixture init']);

    return root;
}

function cleanupRepoFixture(root) {
    rmSync(root, { recursive: true, force: true });
}

function runGit(root, args) {
    const result = spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
    });
    assert.equal(
        result.status,
        0,
        `git ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return result;
}

function buildPublishContext(root, overrides = {}) {
    const board = {
        policy: { revision: 7 },
        tasks: [
            {
                id: 'CDX-900',
                executor: 'codex',
                status: 'in_progress',
                codex_instance: 'codex_backend_ops',
                files: ['docs/in-scope.md'],
            },
        ],
    };
    const registry = {
        jobs: [
            {
                key: 'public_main_sync',
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                enabled: true,
                type: 'external_cron',
                expected_max_lag_seconds: 120,
            },
        ],
    };
    let printed = null;
    return {
        args: [
            'checkpoint',
            'CDX-900',
            '--summary',
            'fixture publish',
            '--expect-rev',
            '7',
            '--json',
        ],
        parseFlags,
        parseBoard: () => board,
        ensureTask: (currentBoard, taskId) =>
            currentBoard.tasks.find((task) => task.id === taskId),
        parseJobs: () => registry,
        buildJobsSnapshot: async () => [
            {
                key: 'public_main_sync',
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                enabled: true,
                verified: true,
                healthy: false,
                type: 'external_cron',
                state: 'unknown',
                age_seconds: null,
                expected_max_lag_seconds: 120,
                deployed_commit: '',
                verification_source: 'health_url',
                source_of_truth: 'host_cron',
            },
        ],
        findJobSnapshot,
        printJson(value) {
            printed = value;
        },
        getPrinted() {
            return printed;
        },
        rootPath: root,
        publishEventsPath: join(root, 'verification', 'publish-events.jsonl'),
        ...overrides,
    };
}

test('publish checkpoint classifyPublishSurface y buildGateCommands cubren union de superficies', () => {
    const surface = classifyPublishSurface([
        'agent-orchestrator.js',
        'controllers/HealthController.php',
        'templates/index.template.html',
    ]);
    assert.deepEqual(surface, {
        orchestrator: true,
        backend: true,
        frontend: true,
    });

    const gates = buildGateCommands(surface).map((item) => item.id);
    assert.deepEqual(gates, [
        'board-doctor',
        'conflicts',
        'codex-check',
        'focus-check',
        'agent-test',
        'agent-validate',
        'lint-php',
        'test-php',
        'lint-js',
        'public-v6-artifacts-check',
        'smoke-public-routing',
    ]);
});

test('publish checkpoint falla si hay cambios fuera de scope', async () => {
    const root = createRepoFixture();
    try {
        writeFileSync(
            join(root, 'README.md'),
            '# dirty outside scope\n',
            'utf8'
        );
        const ctx = buildPublishContext(root);

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(error.error_code, 'publish_dirty_outside_scope');
                assert.match(error.message, /readme\.md/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint devuelve publish_not_live_in_window si el cron no refleja el commit', async () => {
    const root = createRepoFixture();
    const evidencePath = join(root, 'verification', 'agent-runs', 'CDX-900.md');
    const originalNow = Date.now;
    const originalSetTimeout = global.setTimeout;
    const originalExitCode = process.exitCode;
    let fakeNow = 1_000_000_000_000;

    try {
        writeFileSync(evidencePath, '# CDX-900 updated\n', 'utf8');

        Date.now = () => {
            const current = fakeNow;
            fakeNow += 16_000;
            return current;
        };
        global.setTimeout = (callback, _ms, ...args) => {
            callback(...args);
            return 0;
        };

        const ctx = buildPublishContext(root, {
            parseBoard: () => ({
                policy: { revision: 7 },
                tasks: [
                    {
                        id: 'CDX-900',
                        executor: 'codex',
                        status: 'in_progress',
                        codex_instance: 'codex_backend_ops',
                        files: ['verification/agent-runs/CDX-900.md'],
                    },
                ],
            }),
        });

        const report = await handlePublishCommand(ctx);
        assert.equal(report.ok, false);
        assert.equal(report.error_code, 'publish_not_live_in_window');
        assert.equal(report.command, 'publish checkpoint');
        assert.equal(report.task_id, 'CDX-900');
        assert.equal(report.codex_instance, 'codex_backend_ops');
        assert.equal(
            report.staged_files.includes('verification/agent-runs/cdx-900.md'),
            true
        );
        assert.equal(existsSync(ctx.publishEventsPath), true);
        assert.match(
            readFileSync(ctx.publishEventsPath, 'utf8'),
            /"live_ok":false/
        );
    } finally {
        Date.now = originalNow;
        global.setTimeout = originalSetTimeout;
        process.exitCode = originalExitCode;
        cleanupRepoFixture(root);
    }
});
