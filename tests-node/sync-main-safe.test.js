#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildWorkspaceBlockingMessage,
    classifyDirtyStatus,
    parseArgs,
    parseLines,
    parseDirtyFiles,
    hasEphemeralDirtyEntries,
    shouldDiscardDerivedQueueNoise,
    normalizePath,
    isOnlyBoardConflict,
    isRetryablePushFailure,
    run,
} = require('../bin/sync-main-safe');

test('sync-main-safe parseArgs aplica defaults', () => {
    const opts = parseArgs([]);
    assert.equal(opts.remote, 'origin');
    assert.equal(opts.branch, 'main');
    assert.equal(opts.sourceRef, '');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, true);
    assert.equal(opts.autoDiscardDerivedQueueNoise, true);
    assert.equal(opts.autoFixWorkspaceHygiene, true);
    assert.equal(opts.push, true);
    assert.equal(opts.maxSyncAttempts, 3);
    assert.equal(opts.dryRun, false);
    assert.equal(opts.json, false);
});

test('sync-main-safe parseArgs reconoce flags principales', () => {
    const opts = parseArgs([
        '--remote',
        'upstream',
        '--branch',
        'release',
        '--board',
        'AGENT_BOARD.yaml',
        '--source-ref',
        'HEAD',
        '--no-stash',
        '--no-auto-discard-derived-queue-noise',
        '--no-workspace-hygiene-fix',
        '--no-push',
        '--max-sync-attempts',
        '5',
        '--dry-run',
        '--json',
    ]);
    assert.equal(opts.remote, 'upstream');
    assert.equal(opts.branch, 'release');
    assert.equal(opts.sourceRef, 'HEAD');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, false);
    assert.equal(opts.autoDiscardDerivedQueueNoise, false);
    assert.equal(opts.autoFixWorkspaceHygiene, false);
    assert.equal(opts.push, false);
    assert.equal(opts.maxSyncAttempts, 5);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.json, true);
});

test('sync-main-safe parseLines limpia salida vacia de git', () => {
    assert.deepEqual(parseLines('\r\n \n'), []);
    assert.deepEqual(parseLines('A\nB\r\nC'), ['A', 'B', 'C']);
});

test('sync-main-safe detecta conflicto exclusivo de AGENT_BOARD', () => {
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml']), true);
    assert.equal(isOnlyBoardConflict(['agent_board.yaml']), true);
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml', 'README.md']), false);
    assert.equal(isOnlyBoardConflict(['README.md']), false);
});

test('sync-main-safe normaliza paths en formato cross-platform', () => {
    assert.equal(normalizePath('AGENT_BOARD.yaml'), 'agent_board.yaml');
    assert.equal(normalizePath('a\\b\\C.md'), 'a/b/c.md');
});

test('sync-main-safe parsea archivos sucios desde git status --porcelain', () => {
    assert.deepEqual(parseDirtyFiles(' M JULES_TASKS.md\n'), [
        'jules_tasks.md',
    ]);
    assert.deepEqual(parseDirtyFiles('R  old.md -> KIMI_TASKS.md\n'), [
        'kimi_tasks.md',
    ]);
});

test('sync-main-safe detecta ruido derivado en colas jules/kimi', () => {
    assert.equal(shouldDiscardDerivedQueueNoise(' M JULES_TASKS.md\n'), true);
    assert.equal(
        shouldDiscardDerivedQueueNoise(' M JULES_TASKS.md\n M foo.txt\n'),
        false
    );
});

test('sync-main-safe clasifica ruido efimero por categoria de higiene', () => {
    const dirtyEntries = classifyDirtyStatus(
        ' M docs/readme.md\n M script.js\n?? .generated/site-root/es/index.html\n?? _deploy_bundle/out.zip\n'
    );
    assert.deepEqual(
        dirtyEntries.map((entry) => ({
            path: entry.path,
            category: entry.category,
        })),
        [
            { path: 'docs/readme.md', category: 'authored' },
            { path: 'script.js', category: 'legacy_generated_root' },
            {
                path: '.generated/site-root/es/index.html',
                category: 'generated_stage',
            },
            {
                path: '_deploy_bundle/out.zip',
                category: 'deploy_bundle',
            },
        ]
    );
    assert.equal(hasEphemeralDirtyEntries(dirtyEntries), true);
    assert.equal(
        hasEphemeralDirtyEntries([
            { path: 'script.js', category: 'legacy_generated_root' },
        ]),
        false
    );
});

test('sync-main-safe detecta push retryable por fetch first/non-fast-forward', () => {
    assert.equal(
        isRetryablePushFailure({
            stderr: 'Updates were rejected because the remote contains work that you do not have locally (fetch first).',
        }),
        true
    );
    assert.equal(
        isRetryablePushFailure({
            stderr: '! [rejected] main -> main (non-fast-forward)',
        }),
        true
    );
    assert.equal(
        isRetryablePushFailure({ stderr: 'permission denied' }),
        false
    );
});

test('sync-main-safe reintenta fetch/rebase/push tras rechazo retryable', () => {
    const calls = [];
    let pushCount = 0;

    const fakeRunner = (program, args) => {
        const command = `${program} ${args.join(' ')}`;
        calls.push(command);

        if (program !== 'git') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        if (args[0] === 'status') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'fetch') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'rebase') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'push') {
            pushCount += 1;
            if (pushCount === 1) {
                return {
                    ok: false,
                    code: 1,
                    stdout: '',
                    stderr: 'Updates were rejected (fetch first).',
                    command,
                };
            }
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'stash') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        return { ok: true, code: 0, stdout: '', stderr: '', command };
    };

    const code = run(['--max-sync-attempts', '3', '--json'], {
        runner: fakeRunner,
        workspaceDoctor() {
            return {
                overall_state: 'clean',
                dirtyEntries: [],
                issue_counts: {},
                issues: [],
                remediation_plan: [],
                next_command: '',
            };
        },
    });
    assert.equal(code, 0);
    assert.equal(pushCount, 2);
    assert.equal(
        calls.filter((entry) => entry.startsWith('git fetch ')).length >= 2,
        true
    );
});

test('sync-main-safe limpia ruido efimero con workspace hygiene antes de sincronizar', () => {
    const calls = [];
    let statusCount = 0;
    const workspaceFixCalls = [];

    const fakeRunner = (program, args) => {
        const command = `${program} ${args.join(' ')}`;
        calls.push(command);

        if (program !== 'git') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        if (args[0] === 'status') {
            statusCount += 1;
            return {
                ok: true,
                code: 0,
                stdout:
                    statusCount === 1
                        ? '?? .generated/site-root/es/index.html\n'
                        : '',
                stderr: '',
                command,
            };
        }
        if (args[0] === 'fetch') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'rebase') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'push') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'stash') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        return { ok: true, code: 0, stdout: '', stderr: '', command };
    };

    const code = run(['--json'], {
        runner: fakeRunner,
        workspaceDoctor: (() => {
            let callCount = 0;
            return () => {
                callCount += 1;
                if (callCount === 1) {
                    return {
                        overall_state: 'fixable',
                        dirtyEntries: [
                            {
                                path: '.generated/site-root/es/index.html',
                                rawPath: '.generated/site-root/es/index.html',
                                status: '??',
                                category: 'generated_stage',
                            },
                        ],
                        issue_counts: { generated_stage: 1 },
                        issues: [
                            {
                                category: 'generated_stage',
                                severity: 'fixable',
                                count: 1,
                                paths_sample: [
                                    '.generated/site-root/es/index.html',
                                ],
                                remaining_count: 0,
                                blocks_publish: false,
                                blocks_sync: false,
                                blocks_ci: false,
                                suggested_command:
                                    'npm run workspace:hygiene:fix',
                                summary:
                                    'Hay 1 output(s) generados bajo `.generated/site-root/` listos para limpieza segura.',
                            },
                        ],
                        remediation_plan: [
                            {
                                id: 'apply_safe',
                                summary:
                                    'Limpia `.generated/site-root/`, `_deploy_bundle/`, artefactos locales y colas derivadas sin tocar source authored.',
                                command: 'npm run workspace:hygiene:fix',
                            },
                            {
                                id: 'rerun_doctor',
                                summary:
                                    'Vuelve a correr el doctor para confirmar el estado final del workspace.',
                                command: 'npm run workspace:hygiene:doctor',
                            },
                        ],
                        next_command: 'npm run workspace:hygiene:fix',
                    };
                }
                return {
                    overall_state: 'clean',
                    dirtyEntries: [],
                    issue_counts: {},
                    issues: [],
                    remediation_plan: [],
                    next_command: '',
                };
            };
        })(),
        workspaceFix(_repoRoot, options) {
            workspaceFixCalls.push(options);
            return {
                path: process.cwd(),
                removed: ['.generated/site-root'],
                dirtyEntries: [],
                authoredEntries: [],
                overall_state: 'clean',
                issue_counts: {},
                issues: [],
                remediation_plan: [],
                next_command: '',
                ok: true,
            };
        },
    });
    assert.equal(code, 0);
    assert.equal(workspaceFixCalls.length, 1);
    assert.equal(
        calls.some((entry) => entry.startsWith('git stash push')),
        false
    );
    assert.deepEqual(workspaceFixCalls, [{ includeDerivedQueue: true }]);
});

test('sync-main-safe buildWorkspaceBlockingMessage explica issues blocking legacy', () => {
    const message = buildWorkspaceBlockingMessage({
        overall_state: 'blocked',
        issue_counts: { legacy_generated_root_deindexed: 2, authored: 1 },
        issues: [
            {
                category: 'legacy_generated_root_deindexed',
                severity: 'blocking',
                count: 2,
                paths_sample: ['script.js'],
                remaining_count: 1,
                blocks_publish: true,
                blocks_sync: true,
                blocks_ci: true,
                suggested_command:
                    'git commit -m "chore(frontend): deindex legacy generated root outputs"',
                summary:
                    'Hay 2 eliminacion(es) staged del deindexado legacy pendientes de commit o stash.',
            },
            {
                category: 'authored',
                severity: 'blocking',
                count: 1,
                paths_sample: ['README.md'],
                remaining_count: 0,
                blocks_publish: true,
                blocks_sync: true,
                blocks_ci: true,
                suggested_command: 'git status --short',
                summary:
                    'Hay 1 cambio(s) authored fuera del ruido efimero permitido.',
            },
        ],
        remediation_plan: [
            {
                id: 'commit_or_stash_legacy_deindex',
                summary:
                    'Confirma o aparta las eliminaciones staged del deindexado legacy antes de publicar o sincronizar.',
                command:
                    'git commit -m "chore(frontend): deindex legacy generated root outputs"',
            },
            {
                id: 'review_authored_changes',
                summary:
                    'Revisa o mueve los cambios authored antes de intentar publish o sync.',
                command: 'git status --short',
            },
        ],
        next_command:
            'git commit -m "chore(frontend): deindex legacy generated root outputs"',
    });

    assert.match(message, /legacy_generated_root_deindexed/);
    assert.match(message, /authored/);
    assert.match(message, /Primer paso/);
});

test('sync-main-safe no bloquea authored in_scope aunque el doctor quede en attention', () => {
    const message = buildWorkspaceBlockingMessage({
        overall_state: 'attention',
        issue_counts: { authored: 1 },
        scope_counts: { in_scope: 1 },
        issues: [
            {
                category: 'authored',
                severity: 'warn',
                count: 1,
                paths_sample: ['docs/in-scope.md'],
                remaining_count: 0,
                blocks_publish: false,
                blocks_sync: false,
                blocks_ci: false,
                suggested_command: 'git status --short',
                summary:
                    'Hay 1 cambio(s) authored alineados al scope activo de CDX-900.',
                scope_disposition: 'in_scope',
                task_id: 'CDX-900',
            },
        ],
        remediation_plan: [
            {
                id: 'continue_in_scope_task',
                summary:
                    'Los cambios authored actuales coinciden con la tarea activa; continua validando o publica por el flujo correcto.',
                command: 'git status --short',
            },
        ],
        next_command: 'git status --short',
    });

    assert.equal(message, '');
});

test('sync-main-safe bloquea authored unknown_scope hasta aclarar el contexto', () => {
    const message = buildWorkspaceBlockingMessage({
        overall_state: 'attention',
        issue_counts: { authored: 2 },
        scope_counts: { unknown_scope: 2 },
        issues: [
            {
                category: 'authored',
                severity: 'warn',
                count: 2,
                paths_sample: ['README.md'],
                remaining_count: 1,
                blocks_publish: false,
                blocks_sync: true,
                blocks_ci: false,
                suggested_command:
                    'node agent-orchestrator.js task ls --active --json',
                summary:
                    'Hay 2 cambio(s) authored con scope sin aclarar. Ninguna tarea Codex activa coincide con los paths authored detectados.',
                scope_disposition: 'unknown_scope',
            },
        ],
        remediation_plan: [
            {
                id: 'clarify_scope_context',
                summary:
                    'Aclara que tarea activa debe gobernar estos cambios authored antes de sincronizar o publicar.',
                command: 'node agent-orchestrator.js task ls --active --json',
            },
        ],
        next_command: 'node agent-orchestrator.js task ls --active --json',
    });

    assert.match(message, /unknown_scope/);
    assert.match(message, /task ls --active/);
});

test('sync-main-safe bloquea mixed_lane con split accionable', () => {
    const message = buildWorkspaceBlockingMessage({
        overall_state: 'blocked',
        issue_counts: { authored: 3 },
        scope_counts: { unknown_scope: 3 },
        lane_counts: { mixed_lane: 3 },
        issues: [
            {
                category: 'authored',
                severity: 'blocking',
                count: 3,
                paths_sample: ['bin/doctor-fixture.js'],
                remaining_count: 2,
                blocks_publish: true,
                blocks_sync: true,
                blocks_ci: true,
                suggested_command: 'git status --short',
                summary:
                    'Hay 3 cambio(s) authored mezclando lanes o subfrentes; separa el corte antes de publicar o sincronizar.',
                scope_disposition: 'unknown_scope',
                strategy_disposition: 'outside_strategy',
                lane_disposition: 'mixed_lane',
            },
        ],
        remediation_plan: [
            {
                id: 'split_mixed_lane_worktree',
                summary:
                    'Separa el worktree por lane o subfrente antes de sincronizar o publicar.',
                command: 'git status --short',
            },
        ],
        next_command: 'git status --short',
    });

    assert.match(message, /mixed_lane/);
    assert.match(message, /split_mixed_lane_worktree/);
    assert.match(message, /Primer paso/);
});

test('sync-main-safe bloquea legacy_generated_root_deindexed antes de stash', () => {
    const calls = [];
    const fakeRunner = (program, args) => {
        const command = `${program} ${args.join(' ')}`;
        calls.push(command);
        if (program === 'git' && args[0] === 'status') {
            return {
                ok: true,
                code: 0,
                stdout: 'D  script.js\n',
                stderr: '',
                command,
            };
        }
        return { ok: true, code: 0, stdout: '', stderr: '', command };
    };

    const code = run(['--json'], {
        runner: fakeRunner,
        workspaceDoctor() {
            return {
                overall_state: 'blocked',
                dirtyEntries: [
                    {
                        path: 'script.js',
                        rawPath: 'script.js',
                        status: 'D ',
                        category: 'legacy_generated_root_deindexed',
                    },
                ],
                issue_counts: { legacy_generated_root_deindexed: 1 },
                issues: [
                    {
                        category: 'legacy_generated_root_deindexed',
                        severity: 'blocking',
                        count: 1,
                        paths_sample: ['script.js'],
                        remaining_count: 0,
                        blocks_publish: true,
                        blocks_sync: true,
                        blocks_ci: true,
                        suggested_command:
                            'git commit -m "chore(frontend): deindex legacy generated root outputs"',
                        summary:
                            'Hay 1 eliminacion(es) staged del deindexado legacy pendientes de commit o stash.',
                    },
                ],
                remediation_plan: [
                    {
                        id: 'commit_or_stash_legacy_deindex',
                        summary:
                            'Confirma o aparta las eliminaciones staged del deindexado legacy antes de publicar o sincronizar.',
                        command:
                            'git commit -m "chore(frontend): deindex legacy generated root outputs"',
                    },
                ],
                next_command:
                    'git commit -m "chore(frontend): deindex legacy generated root outputs"',
            };
        },
    });

    assert.equal(code, 1);
    assert.equal(
        calls.some((entry) => entry.startsWith('git stash push')),
        false
    );
});
