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
const {
    LEGACY_GENERATED_ROOT_IGNORE_PATTERNS,
} = require('../bin/lib/generated-site-root.js');

const { parseFlags } = require('../tools/agent-orchestrator/core/flags');
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
        join(root, '.gitignore'),
        `${LEGACY_GENERATED_ROOT_IGNORE_PATTERNS.join('\n')}\n`,
        'utf8'
    );
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
    writeFileSync(join(root, 'script.js'), 'console.log("fixture");\n', 'utf8');
    writeFileSync(join(root, 'docs', 'in-scope.md'), '# scope\n', 'utf8');
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-900.md'),
        '# CDX-900\n',
        'utf8'
    );
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'AG-900.md'),
        '# AG-900\n',
        'utf8'
    );

    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, [
        'add',
        '.gitignore',
        'agent-orchestrator.js',
        'bin/sync-main-safe.js',
        'README.md',
        'docs/in-scope.md',
        'verification/agent-runs/CDX-900.md',
        'verification/agent-runs/AG-900.md',
    ]);
    runGit(root, ['add', '-f', 'script.js']);
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
    const taskId = String(overrides.taskId || 'CDX-900');
    const task = {
        id: taskId,
        executor: 'codex',
        status: 'in_progress',
        codex_instance: 'codex_backend_ops',
        files: ['docs/in-scope.md'],
        ...(overrides.task && typeof overrides.task === 'object'
            ? overrides.task
            : {}),
    };
    const board = {
        policy: { revision: 7 },
        tasks: [task],
    };
    let printed = null;
    return {
        args: [
            'checkpoint',
            taskId,
            '--summary',
            String(overrides.summary || 'fixture publish'),
            '--expect-rev',
            '7',
            '--json',
        ],
        parseFlags,
        parseBoard: () => board,
        ensureTask: (currentBoard, taskId) =>
            currentBoard.tasks.find((task) => task.id === taskId),
        printJson(value) {
            printed = value;
        },
        getPrinted() {
            return printed;
        },
        rootPath: root,
        publishEventsPath: join(
            root,
            'verification',
            'agent-publish-events.jsonl'
        ),
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
        'agent-test',
        'agent-validate',
        'lint-php',
        'test-php',
        'lint-js',
        'public-v6-artifacts-check',
        'smoke-public-routing',
    ]);
});

test('publish checkpoint no trata JS de gobernanza como frontend visible', () => {
    const surface = classifyPublishSurface([
        'agent-orchestrator.js',
        'tests-node/publish-checkpoint-command.test.js',
        'AGENTS.md',
    ]);
    assert.deepEqual(surface, {
        orchestrator: true,
        backend: false,
        frontend: false,
    });

    const gates = buildGateCommands(surface).map((item) => item.id);
    assert.deepEqual(gates, [
        'board-doctor',
        'conflicts',
        'codex-check',
        'agent-test',
        'agent-validate',
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
                assert.equal(
                    error.error_code,
                    'publish_workspace_hygiene_blocked'
                );
                assert.match(error.message, /authored\[out_of_scope\]/i);
                assert.match(error.message, /cdx-900/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint bloquea cortes mixed_lane aunque exista tarea explicita', async () => {
    const root = createRepoFixture();
    try {
        mkdirSync(join(root, 'bin'), { recursive: true });
        mkdirSync(join(root, 'src', 'apps', 'admin-v3'), { recursive: true });
        writeFileSync(
            join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 1;\n',
            'utf8'
        );
        writeFileSync(
            join(root, 'bin', 'doctor-fixture.js'),
            'module.exports = 1;\n',
            'utf8'
        );
        runGit(root, [
            'add',
            'bin/doctor-fixture.js',
            'src/apps/admin-v3/app.js',
        ]);
        runGit(root, ['commit', '-m', 'track mixed lane fixture']);

        writeFileSync(
            join(root, 'docs', 'in-scope.md'),
            '# updated scope\n',
            'utf8'
        );
        writeFileSync(
            join(root, 'bin', 'doctor-fixture.js'),
            'module.exports = 2;\n',
            'utf8'
        );
        writeFileSync(
            join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 2;\n',
            'utf8'
        );

        const ctx = buildPublishContext(root);

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(
                    error.error_code,
                    'publish_workspace_hygiene_blocked'
                );
                assert.match(error.message, /mixed_lane/i);
                assert.match(error.message, /Primer paso/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint ignora stage root y bundle y delega la verificacion live al deploy', async () => {
    const root = createRepoFixture();
    try {
        writeFileSync(
            join(root, 'docs', 'in-scope.md'),
            '# updated scope\n',
            'utf8'
        );
        writeFileSync(join(root, 'jules_tasks.md'), '# queue dirty\n', 'utf8');
        mkdirSync(join(root, '.generated', 'site-root', 'es'), {
            recursive: true,
        });
        mkdirSync(join(root, '_deploy_bundle', 'snapshot'), {
            recursive: true,
        });
        writeFileSync(
            join(root, '.generated', 'site-root', 'es', 'index.html'),
            '<html>generated</html>\n',
            'utf8'
        );
        writeFileSync(
            join(root, '_deploy_bundle', 'snapshot', 'manifest.txt'),
            'bundle noise\n',
            'utf8'
        );

        const ctx = buildPublishContext(root);
        const report = await handlePublishCommand(ctx);

        assert.equal(report.ok, true);
        assert.equal(report.command, 'publish checkpoint');
        assert.equal(report.task_id, 'CDX-900');
        assert.equal(report.task_family, 'cdx');
        assert.equal(report.codex_instance, 'codex_backend_ops');
        assert.equal(report.release_exception, false);
        assert.equal(report.live_status, 'pending');
        assert.equal(report.verification_pending, true);
        assert.equal(report.warning_code, 'publish_live_verification_pending');
        assert.equal(report.live_verification.mode, 'delegated_to_deploy');
        assert.equal(report.live_verification.transport, 'sync-main-safe');
        assert.deepEqual(report.gates_run, [
            'board-doctor',
            'conflicts',
            'codex-check',
        ]);
        assert.equal(report.staged_files.includes('docs/in-scope.md'), true);
        assert.deepEqual(
            report.ignored_dirty_entries.map((entry) => entry.category).sort(),
            ['deploy_bundle', 'derived_queue']
        );
        assert.deepEqual(ctx.getPrinted(), report);
        assert.equal(existsSync(ctx.publishEventsPath), true);

        const eventsRaw = readFileSync(ctx.publishEventsPath, 'utf8');
        assert.match(eventsRaw, /"deploy_verification":"delegated_to_deploy"/);
        assert.match(eventsRaw, /"task_family":"cdx"/);
        assert.match(eventsRaw, /"live_status":"pending"/);
        assert.match(eventsRaw, /"verification_pending":true/);
        assert.match(eventsRaw, /"live_ok":true/);
        assert.match(eventsRaw, /"sync_transport":"sync-main-safe"/);
        assert.equal(
            runGit(root, [
                'show',
                '--stat',
                '--format=%s',
                'HEAD',
            ]).stdout.includes('chore(codex-publish): checkpoint CDX-900'),
            true
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint acepta AG-* release-publish y devuelve pending sin fallar', async () => {
    const root = createRepoFixture();
    try {
        writeFileSync(
            join(root, 'docs', 'in-scope.md'),
            '# updated scope\n',
            'utf8'
        );
        const ctx = buildPublishContext(root, {
            taskId: 'AG-900',
            summary: 'release-publish AG-900 aurora-derm-trust-conversion',
            task: {
                status: 'review',
                codex_instance: 'codex_frontend',
                scope: 'frontend-public',
                strategy_role: 'exception',
                strategy_reason: 'validated_release_promotion',
                integration_slice: 'governance_evidence',
                work_type: 'evidence',
            },
        });

        const report = await handlePublishCommand(ctx);

        assert.equal(report.ok, true);
        assert.equal(report.task_id, 'AG-900');
        assert.equal(report.task_family, 'ag');
        assert.equal(report.release_exception, true);
        assert.equal(report.live_status, 'pending');
        assert.equal(report.verification_pending, true);
        assert.equal(report.warning_code, 'publish_live_verification_pending');
        assert.equal(
            runGit(root, [
                'show',
                '--stat',
                '--format=%s',
                'HEAD',
            ]).stdout.includes('chore(codex-publish): checkpoint AG-900'),
            true
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint release-publish exige marcador explicito en summary', async () => {
    const root = createRepoFixture();
    try {
        writeFileSync(
            join(root, 'docs', 'in-scope.md'),
            '# updated scope\n',
            'utf8'
        );
        const ctx = buildPublishContext(root, {
            taskId: 'AG-900',
            summary: 'aurora derm trust conversion',
            task: {
                status: 'review',
                codex_instance: 'codex_frontend',
                scope: 'frontend-public',
                strategy_role: 'exception',
                strategy_reason: 'validated_release_promotion',
                integration_slice: 'governance_evidence',
                work_type: 'evidence',
            },
        });

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(error.error_code, 'invalid_summary');
                assert.match(error.message, /release-publish/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint bloquea legacy generated root trackeado fuera de scope', async () => {
    const root = createRepoFixture();
    try {
        writeFileSync(
            join(root, 'script.js'),
            'console.log("fixture dirty");\n',
            'utf8'
        );
        const ctx = buildPublishContext(root);

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(
                    error.error_code,
                    'publish_workspace_hygiene_blocked'
                );
                assert.match(error.message, /legacy_generated_root/i);
                assert.match(error.message, /legacy:generated-root:apply/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint bloquea legacy_generated_root_deindexed con mensaje accionable', async () => {
    const root = createRepoFixture();
    try {
        runGit(root, ['rm', '--cached', '-f', '--', 'script.js']);
        const ctx = buildPublishContext(root);

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(
                    error.error_code,
                    'publish_workspace_hygiene_blocked'
                );
                assert.match(error.message, /legacy_generated_root_deindexed/i);
                assert.match(error.message, /git commit -m/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});

test('publish checkpoint menciona authored y deindexado legacy cuando ambos bloquean', async () => {
    const root = createRepoFixture();
    try {
        runGit(root, ['rm', '--cached', '-f', '--', 'script.js']);
        writeFileSync(
            join(root, 'README.md'),
            '# dirty outside scope\n',
            'utf8'
        );
        const ctx = buildPublishContext(root);

        await assert.rejects(
            () => handlePublishCommand(ctx),
            (error) => {
                assert.equal(
                    error.error_code,
                    'publish_workspace_hygiene_blocked'
                );
                assert.match(error.message, /legacy_generated_root_deindexed/i);
                assert.match(error.message, /authored/i);
                assert.match(error.message, /Primer paso/i);
                assert.match(error.message, /git commit -m/i);
                return true;
            }
        );
    } finally {
        cleanupRepoFixture(root);
    }
});
