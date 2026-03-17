#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    LEGACY_GENERATED_ROOT_IGNORE_PATTERNS,
} = require('../bin/lib/generated-site-root.js');
const {
    LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
    applyCleanup,
    collectStatus,
    parseArgs,
} = require('../bin/legacy-generated-root-cleanup.js');
const {
    DOCTOR_STATE_ATTENTION,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_FIXABLE,
    collectWorkspaceDoctor,
    fixWorkspace,
} = require('../bin/lib/workspace-hygiene.js');
const { parseArgs: parseDoctorArgs } = require('../bin/workspace-hygiene.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(
    REPO_ROOT,
    'bin',
    'legacy-generated-root-cleanup.js'
);
const WORKSPACE_HYGIENE_SCRIPT = path.join(
    REPO_ROOT,
    'bin',
    'workspace-hygiene.js'
);

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

function createFixtureRepo() {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), 'legacy-generated-root-')
    );
    fs.mkdirSync(path.join(root, 'es'), { recursive: true });
    fs.mkdirSync(path.join(root, 'js', 'chunks'), { recursive: true });
    fs.mkdirSync(path.join(root, 'js', 'engines'), { recursive: true });
    fs.writeFileSync(
        path.join(root, '.gitignore'),
        `${LEGACY_GENERATED_ROOT_IGNORE_PATTERNS.join('\n')}\n`,
        'utf8'
    );
    fs.writeFileSync(path.join(root, 'README.md'), '# fixture\n', 'utf8');
    fs.writeFileSync(
        path.join(root, 'script.js'),
        'console.log("root");\n',
        'utf8'
    );
    fs.writeFileSync(
        path.join(root, 'admin.js'),
        'console.log("admin");\n',
        'utf8'
    );
    fs.writeFileSync(
        path.join(root, 'es', 'index.html'),
        '<html>es</html>\n',
        'utf8'
    );
    fs.writeFileSync(
        path.join(root, 'js', 'chunks', 'shell-fixture.js'),
        'console.log("chunk");\n',
        'utf8'
    );
    fs.writeFileSync(
        path.join(root, 'js', 'engines', 'ui-bundle.js'),
        'console.log("engine");\n',
        'utf8'
    );

    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.gitignore', 'README.md']);
    runGit(root, [
        'add',
        '-f',
        'script.js',
        'admin.js',
        'es/index.html',
        'js/chunks/shell-fixture.js',
        'js/engines/ui-bundle.js',
    ]);
    runGit(root, ['commit', '-m', 'fixture init']);

    return root;
}

function cleanupFixtureRepo(root) {
    fs.rmSync(root, { recursive: true, force: true });
}

function inferStrategySubfront(codexInstance) {
    const normalized = String(codexInstance || '').trim();
    if (normalized === 'codex_backend_ops') {
        return 'SF-backend-turnero-web-pilot';
    }
    if (normalized === 'codex_transversal') {
        return 'SF-transversal-turnero-web-pilot';
    }
    return 'SF-frontend-turnero-web-pilot';
}

function renderStrategyBlock(withActiveStrategy) {
    if (!withActiveStrategy) {
        return [
            'strategy:',
            '  active: null',
            '  next: null',
            '  updated_at: "2026-03-16"',
        ];
    }

    return [
        'strategy:',
        '  active:',
        '    id: STRAT-2026-03-turnero-web-pilot',
        '    title: "Turnero web por clinica"',
        '    status: active',
        '    owner: Ernesto',
        '    subfronts:',
        '      - codex_instance: codex_frontend',
        '        subfront_id: SF-frontend-turnero-web-pilot',
        '        title: "Frontend turnero web"',
        '        allowed_scopes: ["frontend-admin", "queue", "turnero"]',
        '        support_only_scopes: ["docs", "frontend-qa"]',
        '        blocked_scopes: ["frontend-public", "payments", "calendar"]',
        '      - codex_instance: codex_backend_ops',
        '        subfront_id: SF-backend-turnero-web-pilot',
        '        title: "Backend turnero web"',
        '        allowed_scopes: ["backend", "readiness", "gates", "deploy", "ops"]',
        '        support_only_scopes: ["monitoring", "tests"]',
        '        blocked_scopes: ["frontend-public", "frontend-admin", "payments", "calendar", "auth"]',
        '      - codex_instance: codex_transversal',
        '        subfront_id: SF-transversal-turnero-web-pilot',
        '        title: "Transversal tooling"',
        '        allowed_scopes: []',
        '        support_only_scopes: ["openclaw_runtime", "codex-governance", "tooling"]',
        '        blocked_scopes: ["frontend-public", "frontend-admin", "backend", "deploy", "auth", "queue", "turnero"]',
        '  next: null',
        '  updated_at: "2026-03-16"',
    ];
}

function writeActiveCodexBoard(root, tasks = [], options = {}) {
    const withActiveStrategy = Boolean(options.withActiveStrategy);
    const renderedTasks = tasks
        .map((task) => {
            const files = Array.isArray(task.files)
                ? task.files.map((file) => `"${file}"`).join(', ')
                : '';
            const codexInstance = task.codex_instance || 'codex_frontend';
            const subfrontId =
                task.subfront_id ||
                (withActiveStrategy
                    ? inferStrategySubfront(codexInstance)
                    : '');
            return [
                `  - id: ${task.id}`,
                `    title: "${task.title || task.id}"`,
                `    owner: ernesto`,
                `    executor: codex`,
                `    status: ${task.status || 'in_progress'}`,
                `    risk: low`,
                `    scope: ${task.scope || 'docs'}`,
                `    codex_instance: ${codexInstance}`,
                `    domain_lane: ${task.domain_lane || 'frontend_content'}`,
                `    lane_lock: strict`,
                `    cross_domain: false`,
                `    subfront_id: ${subfrontId || '""'}`,
                `    strategy_id: ${withActiveStrategy ? 'STRAT-2026-03-turnero-web-pilot' : '""'}`,
                `    strategy_role: ${withActiveStrategy ? task.strategy_role || 'primary' : '""'}`,
                `    provider_mode: ""`,
                `    runtime_surface: ""`,
                `    runtime_transport: ""`,
                `    runtime_last_transport: ""`,
                `    files: [${files}]`,
                `    source_signal: manual`,
                `    source_ref: ""`,
                `    priority_score: 1`,
                `    sla_due_at: ""`,
                `    last_attempt_at: ""`,
                `    attempts: 0`,
                `    blocked_reason: ""`,
                `    runtime_impact: low`,
                `    critical_zone: false`,
                `    acceptance: ""`,
                `    acceptance_ref: ""`,
                `    evidence_ref: ""`,
                `    depends_on: []`,
                `    created_at: 2026-03-16`,
                `    updated_at: 2026-03-16`,
            ].join('\n');
        })
        .join('\n');

    fs.writeFileSync(
        path.join(root, 'AGENT_BOARD.yaml'),
        [
            'version: 1',
            'policy:',
            '  canonical: AGENTS.md',
            '  autonomy: semi_autonomous_guardrails',
            '  kpi: reduce_rework',
            '  revision: 1',
            ...renderStrategyBlock(withActiveStrategy),
            'tasks:',
            renderedTasks || '  []',
            '',
        ].join('\n'),
        'utf8'
    );
}

test('legacy generated root cleanup parseArgs reconoce flags principales', () => {
    const options = parseArgs([
        'apply',
        '--json',
        '--quiet',
        '--repo-root',
        'C:/repo',
        '--chunk-size',
        '12',
    ]);

    assert.equal(options.command, 'apply');
    assert.equal(options.json, true);
    assert.equal(options.quiet, true);
    assert.equal(options.repoRoot, 'C:/repo');
    assert.equal(options.chunkSize, 12);
});

test('legacy generated root cleanup reporta tracked paths y dirty legacy root', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'script.js'),
            'console.log("root dirty");\n',
            'utf8'
        );

        const status = collectStatus(root);
        assert.equal(status.trackedPaths.includes('script.js'), true);
        assert.equal(status.trackedPaths.includes('admin.js'), true);
        assert.equal(status.trackedPaths.includes('es/index.html'), true);
        assert.equal(
            status.trackedPaths.includes('js/chunks/shell-fixture.js'),
            true
        );
        assert.equal(
            status.trackedPaths.includes('js/engines/ui-bundle.js'),
            true
        );
        assert.equal(
            status.trackedSummary.directoriesPresent.includes('es'),
            true
        );
        assert.equal(
            status.trackedSummary.directoriesPresent.includes('js/chunks'),
            true
        );
        assert.equal(
            status.trackedSummary.filesPresent.includes('script.js'),
            true
        );
        assert.equal(status.ignoreCoverage.ok, true);
        assert.deepEqual(
            status.dirtyEntries.map((entry) => ({
                path: entry.path,
                category: entry.category,
            })),
            [{ path: 'script.js', category: 'legacy_generated_root' }]
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('legacy generated root cleanup check falla mientras sigan trackeados', () => {
    const root = createFixtureRepo();
    try {
        const result = spawnSync(
            process.execPath,
            [SCRIPT_PATH, 'check', '--json'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );
        assert.equal(result.status, 1, result.stderr || result.stdout);
        assert.match(result.stdout, /"trackedPaths"/);
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene fix deja legacy_generated_root como bloqueo honesto', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'script.js'),
            'console.log("root dirty");\n',
            'utf8'
        );
        const result = fixWorkspace(root);
        assert.equal(result.ok, false);
        assert.equal(Array.isArray(result.blockingEntries), true);
        assert.equal(result.blockingEntries.length >= 1, true);
        assert.equal(
            result.blockingEntries.every(
                (entry) =>
                    entry.category === 'legacy_generated_root' ||
                    entry.category === 'authored'
            ),
            true
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('legacy generated root cleanup apply saca del indice sin borrar el worktree local', () => {
    const root = createFixtureRepo();
    try {
        const result = applyCleanup(root, { chunkSize: 2 });

        assert.equal(result.command, 'apply');
        assert.equal(result.ok, true);
        assert.equal(result.removedCount >= 5, true);
        assert.deepEqual(result.trackedPaths, []);
        assert.equal(
            result.preservedWorkingTreePaths.includes('script.js'),
            true
        );
        assert.equal(
            result.preservedWorkingTreePaths.includes('es/index.html'),
            true
        );
        assert.equal(fs.existsSync(path.join(root, 'script.js')), true);
        assert.equal(fs.existsSync(path.join(root, 'es', 'index.html')), true);
        assert.equal(
            runGit(root, [
                'ls-files',
                '--',
                ...LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
            ]).stdout.trim(),
            ''
        );

        const checkResult = spawnSync(
            process.execPath,
            [SCRIPT_PATH, 'check', '--json'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );
        assert.equal(
            checkResult.status,
            0,
            checkResult.stderr || checkResult.stdout
        );
        assert.match(checkResult.stdout, /"trackedPaths": \[\]/);
        assert.match(
            checkResult.stdout,
            /"legacy_generated_root_deindexed"/,
            'despues del apply el helper debe distinguir el deindexado pendiente de commit'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor marca fixable cuando solo hay ruido efimero', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'jules_tasks.md'),
            '# queue snapshot\n',
            'utf8'
        );
        runGit(root, ['add', 'jules_tasks.md']);
        runGit(root, ['commit', '-m', 'track derived queue fixture']);
        fs.writeFileSync(
            path.join(root, 'jules_tasks.md'),
            '# queue dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows.length, 1);
        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_FIXABLE);
        assert.equal(diagnosis.rows[0].issue_counts.derived_queue >= 1, true);
        assert.equal(diagnosis.summary.fixable_worktrees, 1);
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor marca blocked cuando hay legacy generated root trackeado', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'script.js'),
            'console.log("root dirty");\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows.length, 1);
        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_BLOCKED);
        assert.deepEqual(
            diagnosis.rows[0].issues.map((issue) => issue.category),
            ['legacy_generated_root']
        );
        assert.equal(
            diagnosis.rows[0].next_command,
            'npm run legacy:generated-root:apply'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor deja visible el issue de deindexado legacy staged', () => {
    const root = createFixtureRepo();
    try {
        const applyResult = applyCleanup(root, { chunkSize: 2 });
        assert.equal(applyResult.ok, true);

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows.length, 1);
        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_BLOCKED);
        assert.deepEqual(
            diagnosis.rows[0].issues.map((issue) => issue.category),
            ['legacy_generated_root_deindexed']
        );
        assert.match(diagnosis.rows[0].next_command, /git commit -m/);
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene aliases status y fix delegan al doctor', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'jules_tasks.md'),
            '# queue snapshot\n',
            'utf8'
        );
        runGit(root, ['add', 'jules_tasks.md']);
        runGit(root, ['commit', '-m', 'track queue alias fixture']);
        fs.writeFileSync(
            path.join(root, 'jules_tasks.md'),
            '# queue dirty\n',
            'utf8'
        );

        const statusResult = spawnSync(
            process.execPath,
            [WORKSPACE_HYGIENE_SCRIPT, 'status', '--json'],
            {
                cwd: root,
                encoding: 'utf8',
                env: { ...process.env },
            }
        );
        const fixResult = spawnSync(
            process.execPath,
            [WORKSPACE_HYGIENE_SCRIPT, 'fix', '--json'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        assert.equal(
            statusResult.status,
            0,
            statusResult.stderr || statusResult.stdout
        );
        assert.equal(fixResult.status, 0, fixResult.stderr || fixResult.stdout);

        const statusPayload = JSON.parse(statusResult.stdout);
        const fixPayload = JSON.parse(fixResult.stdout);

        assert.equal(statusPayload.command, 'workspace-hygiene doctor');
        assert.equal(statusPayload.version, 5);
        assert.equal(statusPayload.rows[0].overall_state, DOCTOR_STATE_FIXABLE);
        assert.equal(fixPayload.command, 'workspace-hygiene doctor');
        assert.equal(fixPayload.rows[0].overall_state, 'clean');
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor omite dirty_entries por defecto y los expone con --include-entries', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'script.js'),
            'console.log("root dirty");\n',
            'utf8'
        );

        const compactResult = spawnSync(
            process.execPath,
            [WORKSPACE_HYGIENE_SCRIPT, 'doctor', '--current-only', '--json'],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );
        const expandedResult = spawnSync(
            process.execPath,
            [
                WORKSPACE_HYGIENE_SCRIPT,
                'doctor',
                '--current-only',
                '--json',
                '--include-entries',
            ],
            {
                cwd: root,
                encoding: 'utf8',
            }
        );

        assert.equal(
            compactResult.status,
            0,
            compactResult.stderr || compactResult.stdout
        );
        assert.equal(
            expandedResult.status,
            0,
            expandedResult.stderr || expandedResult.stdout
        );

        const compactPayload = JSON.parse(compactResult.stdout);
        const expandedPayload = JSON.parse(expandedResult.stdout);

        assert.equal(
            Object.hasOwn(compactPayload.rows[0], 'dirty_entries'),
            false
        );
        assert.equal(
            Array.isArray(expandedPayload.rows[0].dirty_entries),
            true
        );
        assert.equal(expandedPayload.rows[0].dirty_entries.length >= 1, true);
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor marca attention cuando los authored quedan in_scope', () => {
    const root = createFixtureRepo();
    try {
        fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'docs', 'in-scope.md'),
            '# docs\n',
            'utf8'
        );
        runGit(root, ['add', 'docs/in-scope.md']);
        runGit(root, ['commit', '-m', 'track in-scope doc fixture']);
        writeActiveCodexBoard(root, [
            {
                id: 'CDX-900',
                files: ['docs/in-scope.md'],
                scope: 'docs',
            },
        ]);
        runGit(root, ['add', 'AGENT_BOARD.yaml']);
        runGit(root, ['commit', '-m', 'track board fixture']);
        fs.writeFileSync(
            path.join(root, 'docs', 'in-scope.md'),
            '# docs dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_ATTENTION);
        assert.equal(diagnosis.rows[0].scope_context.resolution, 'matched');
        assert.equal(diagnosis.rows[0].scope_context.task_id, 'CDX-900');
        assert.deepEqual(diagnosis.rows[0].scope_counts, { in_scope: 1 });
        assert.equal(diagnosis.rows[0].issues[0].scope_disposition, 'in_scope');
        assert.equal(diagnosis.rows[0].issues[0].blocks_sync, false);
        assert.equal(
            diagnosis.rows[0].remediation_plan[0].id,
            'continue_in_scope_task'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor bloquea authored fuera del scope activo', () => {
    const root = createFixtureRepo();
    try {
        fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'docs', 'in-scope.md'),
            '# docs\n',
            'utf8'
        );
        runGit(root, ['add', 'docs/in-scope.md']);
        runGit(root, ['commit', '-m', 'track out-of-scope doc fixture']);
        writeActiveCodexBoard(root, [
            {
                id: 'CDX-900',
                files: ['docs/in-scope.md'],
                scope: 'docs',
            },
        ]);
        runGit(root, ['add', 'AGENT_BOARD.yaml']);
        runGit(root, ['commit', '-m', 'track board out-of-scope fixture']);
        fs.writeFileSync(
            path.join(root, 'docs', 'in-scope.md'),
            '# docs dirty\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'README.md'),
            '# out of scope dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_BLOCKED);
        assert.equal(diagnosis.rows[0].scope_context.resolution, 'matched');
        assert.deepEqual(diagnosis.rows[0].scope_counts, {
            out_of_scope: 1,
            in_scope: 1,
        });
        assert.equal(
            diagnosis.rows[0].issues.some(
                (issue) =>
                    issue.category === 'authored' &&
                    issue.scope_disposition === 'out_of_scope' &&
                    issue.blocks_publish === true
            ),
            true
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor deja authored en unknown_scope cuando no encuentra tarea activa', () => {
    const root = createFixtureRepo();
    try {
        fs.writeFileSync(
            path.join(root, 'README.md'),
            '# unknown scope dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_ATTENTION);
        assert.equal(diagnosis.rows[0].scope_context.resolution, 'unknown');
        assert.deepEqual(diagnosis.rows[0].scope_counts, { unknown_scope: 1 });
        assert.equal(
            diagnosis.rows[0].issues[0].scope_disposition,
            'unknown_scope'
        );
        assert.equal(diagnosis.rows[0].issues[0].blocks_sync, true);
        assert.equal(
            diagnosis.rows[0].remediation_plan[0].id,
            'clarify_scope_context'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor parseArgs reconoce task-id, scope-pattern y show-candidates', () => {
    const options = parseDoctorArgs([
        'doctor',
        '--current-only',
        '--task-id',
        'CDX-044',
        '--scope-pattern',
        'queue-ops.css',
        '--scope-pattern=README.md',
        '--show-candidates',
    ]);

    assert.equal(options.command, 'doctor');
    assert.equal(options.currentOnly, true);
    assert.equal(options.taskId, 'CDX-044');
    assert.deepEqual(options.scopePatterns, ['queue-ops.css', 'README.md']);
    assert.equal(options.showCandidates, true);
});

test('workspace hygiene doctor no crea split extra por README.md de soporte si el corte es de una sola lane', () => {
    const root = createFixtureRepo();
    try {
        fs.mkdirSync(path.join(root, 'src', 'apps', 'admin-v3'), {
            recursive: true,
        });
        fs.writeFileSync(
            path.join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 1;\n',
            'utf8'
        );
        runGit(root, ['add', 'src/apps/admin-v3/app.js']);
        runGit(root, ['commit', '-m', 'track queue fixture']);
        writeActiveCodexBoard(root, [], { withActiveStrategy: true });
        runGit(root, ['add', 'AGENT_BOARD.yaml']);
        runGit(root, ['commit', '-m', 'track strategy fixture']);

        fs.writeFileSync(
            path.join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 2;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'README.md'),
            '# support doc dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, {
            currentOnly: true,
            scopePatterns: ['src/apps/admin-v3/app.js', 'README.md'],
        });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_ATTENTION);
        assert.equal(diagnosis.rows[0].lane_context.resolution, 'single_lane');
        assert.equal(diagnosis.rows[0].split_plan.length, 0);
        assert.equal(
            diagnosis.rows[0].issues.some(
                (issue) =>
                    issue.category === 'authored' &&
                    issue.scope_disposition === 'in_scope'
            ),
            true
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor bloquea arbol mixto cross-lane con split_plan accionable', () => {
    const root = createFixtureRepo();
    try {
        fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
        fs.mkdirSync(
            path.join(root, 'tools', 'agent-orchestrator', 'commands'),
            {
                recursive: true,
            }
        );
        fs.mkdirSync(path.join(root, 'src', 'apps', 'admin-v3'), {
            recursive: true,
        });
        fs.writeFileSync(
            path.join(root, 'bin', 'doctor-fixture.js'),
            'module.exports = 1;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(
                root,
                'tools',
                'agent-orchestrator',
                'commands',
                'doctor-fixture.js'
            ),
            'module.exports = 2;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 1;\n',
            'utf8'
        );
        runGit(root, [
            'add',
            'bin/doctor-fixture.js',
            'tools/agent-orchestrator/commands/doctor-fixture.js',
            'src/apps/admin-v3/app.js',
        ]);
        runGit(root, ['commit', '-m', 'track mixed lane fixtures']);
        writeActiveCodexBoard(root, [], { withActiveStrategy: true });
        runGit(root, ['add', 'AGENT_BOARD.yaml']);
        runGit(root, ['commit', '-m', 'track mixed lane strategy fixture']);

        fs.writeFileSync(
            path.join(root, 'bin', 'doctor-fixture.js'),
            'module.exports = 11;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(
                root,
                'tools',
                'agent-orchestrator',
                'commands',
                'doctor-fixture.js'
            ),
            'module.exports = 22;\n',
            'utf8'
        );
        fs.writeFileSync(
            path.join(root, 'src', 'apps', 'admin-v3', 'app.js'),
            'export const adminFixture = 2;\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_BLOCKED);
        assert.equal(diagnosis.rows[0].lane_context.resolution, 'mixed_lane');
        assert.equal(
            diagnosis.rows[0].issues.some(
                (issue) =>
                    issue.category === 'authored' &&
                    issue.lane_disposition === 'mixed_lane' &&
                    issue.blocks_publish === true
            ),
            true
        );
        assert.equal(diagnosis.rows[0].split_plan.length >= 2, true);
        assert.equal(
            diagnosis.rows[0].remediation_plan[0].id,
            'split_mixed_lane_worktree'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});

test('workspace hygiene doctor sugiere tareas historicas como candidates sin autoclasicar in_scope', () => {
    const root = createFixtureRepo();
    try {
        fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'docs', 'historical.md'),
            '# historical\n',
            'utf8'
        );
        runGit(root, ['add', 'docs/historical.md']);
        runGit(root, ['commit', '-m', 'track historical doc fixture']);
        writeActiveCodexBoard(
            root,
            [
                {
                    id: 'CDX-901',
                    title: 'Historical docs task',
                    status: 'done',
                    files: ['docs/historical.md'],
                    scope: 'docs',
                },
            ],
            { withActiveStrategy: true }
        );
        runGit(root, ['add', 'AGENT_BOARD.yaml']);
        runGit(root, ['commit', '-m', 'track historical board fixture']);
        fs.writeFileSync(
            path.join(root, 'docs', 'historical.md'),
            '# historical dirty\n',
            'utf8'
        );

        const diagnosis = collectWorkspaceDoctor(root, { currentOnly: true });

        assert.equal(diagnosis.rows[0].overall_state, DOCTOR_STATE_ATTENTION);
        assert.equal(diagnosis.rows[0].scope_context.resolution, 'unknown');
        assert.equal(
            diagnosis.rows[0].issues[0].scope_disposition,
            'unknown_scope'
        );
        assert.equal(
            diagnosis.rows[0].candidate_tasks.some(
                (candidate) =>
                    candidate.task_id === 'CDX-901' &&
                    candidate.source === 'historical'
            ),
            true
        );
        assert.equal(
            diagnosis.rows[0].remediation_plan[0].id,
            'inspect_candidate_tasks'
        );
    } finally {
        cleanupFixtureRepo(root);
    }
});
