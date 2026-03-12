#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    copyFileSync,
    cpSync,
    existsSync,
    rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const DATE = '2026-02-24';

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-orchestrator-test-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    return dir;
}

function cleanupFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

function writeFixtureFiles(dir, { board, handoffs, plan }) {
    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), `${board.trim()}\n`, 'utf8');
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        `${handoffs.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `${plan.trim()}\n`,
        'utf8'
    );
}

function writePublicSyncJobsFixture(dir, options = {}) {
    const runtimeDir = join(dir, 'runtime');
    const statusPath = join(runtimeDir, 'public-sync-status.json');
    const checkedAt =
        String(options.checked_at || '').trim() || new Date().toISOString();
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: 'job-public-main-sync',
                job_key: 'public_main_sync',
                state: options.state || 'failed',
                checked_at: checkedAt,
                last_success_at: String(options.last_success_at || '').trim(),
                last_error_at:
                    String(options.last_error_at || '').trim() || checkedAt,
                last_error_message:
                    String(options.last_error_message || '').trim() ||
                    'working_tree_dirty',
                deployed_commit: String(options.deployed_commit || '').trim(),
                current_head: String(options.current_head || '').trim(),
                remote_head: String(options.remote_head || '').trim(),
                dirty_paths_count:
                    Number.parseInt(
                        String(options.dirty_paths_count ?? '0'),
                        10
                    ) || 0,
                dirty_paths_sample: Array.isArray(options.dirty_paths_sample)
                    ? options.dirty_paths_sample
                    : [],
                dirty_paths: Array.isArray(options.dirty_paths)
                    ? options.dirty_paths
                    : [],
            },
            null,
            2
        )}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-11T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "job-public-main-sync"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: /var/www/figo
    branch: main
    schedule: "* * * * *"
    command: /root/sync-pielarmonia.sh
    wrapper_fallback: /var/www/figo/bin/deploy-public-v3-cron-sync.sh
    lock_file: /tmp/sync-pielarmonia.lock
    log_path: /var/log/sync-pielarmonia.log
    status_path: "${statusPath.replace(/\\/g, '/')}"
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );
}

function runCli(dir, args, expectedStatus = 0) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs],
        {
            cwd: dir,
            encoding: 'utf8',
        }
    );

    if (result.error) {
        throw result.error;
    }

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    return result;
}

function runCliWithEnv(dir, args, envPatch, expectedStatus = 0) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs],
        {
            cwd: dir,
            encoding: 'utf8',
            env: { ...process.env, ...(envPatch || {}) },
        }
    );

    if (result.error) {
        throw result.error;
    }

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    return result;
}

function runCliWithInput(
    dir,
    args,
    input,
    expectedStatus = 0,
    envPatch = null
) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs],
        {
            cwd: dir,
            encoding: 'utf8',
            input: input == null ? '' : String(input),
            env: envPatch ? { ...process.env, ...envPatch } : process.env,
        }
    );

    if (result.error) {
        throw result.error;
    }

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    return result;
}

function readBoardRevisionFromFixture(dir) {
    const boardPath = join(dir, 'AGENT_BOARD.yaml');
    if (!existsSync(boardPath)) return 0;
    const raw = readFileSync(boardPath, 'utf8');
    const match = raw.match(/^\s*revision:\s*(\d+)\s*$/m);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isMutatingCommandArgs(args = []) {
    const command = String(args[0] || '')
        .trim()
        .toLowerCase();
    const subcommand = String(args[1] || '')
        .trim()
        .toLowerCase();

    if (command === 'close') return true;
    if (command === 'codex') {
        return ['start', 'stop'].includes(subcommand);
    }
    if (command === 'leases') {
        return ['heartbeat', 'clear'].includes(subcommand);
    }
    if (command === 'handoffs') {
        return ['create', 'close'].includes(subcommand);
    }
    if (command === 'task') {
        if (['claim', 'start', 'finish'].includes(subcommand)) return true;
        if (subcommand !== 'create') return false;
        if (args.includes('--preview') || args.includes('--dry-run')) {
            return false;
        }
        if (args.includes('--validate-only')) return false;
        return true;
    }
    return false;
}

function withExpectedRevisionArgIfNeeded(dir, args = []) {
    const hasExplicitExpectRev =
        args.includes('--expect-rev') || args.includes('--expect_rev');
    if (hasExplicitExpectRev) return args;
    if (!isMutatingCommandArgs(args)) return args;
    const revision = readBoardRevisionFromFixture(dir);
    return [...args, '--expect-rev', String(revision)];
}

function parseJsonStdout(result) {
    try {
        return JSON.parse(result.stdout);
    } catch (error) {
        throw new Error(
            `No se pudo parsear JSON de stdout.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}\nError: ${error.message}`
        );
    }
}

function readBoard(dir) {
    return readFileSync(join(dir, 'AGENT_BOARD.yaml'), 'utf8');
}

function readPlan(dir) {
    return readFileSync(join(dir, 'PLAN_MAESTRO_CODEX_2026.md'), 'utf8');
}

function readMetrics(dir) {
    return JSON.parse(
        readFileSync(join(dir, 'verification', 'agent-metrics.json'), 'utf8')
    );
}

function readContributionHistory(dir) {
    return JSON.parse(
        readFileSync(
            join(dir, 'verification', 'agent-contribution-history.json'),
            'utf8'
        )
    );
}

function readDomainHealthHistory(dir) {
    return JSON.parse(
        readFileSync(
            join(dir, 'verification', 'agent-domain-health-history.json'),
            'utf8'
        )
    );
}

function readBoardEvents(dir) {
    const path = join(dir, 'verification', 'agent-board-events.jsonl');
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function writeGovernancePolicy(dir, policy) {
    writeFileSync(
        join(dir, 'governance-policy.json'),
        `${JSON.stringify(policy, null, 2)}\n`,
        'utf8'
    );
}

function baseHandoffs() {
    return `
version: 1
handoffs: []
`;
}

function basePlanWithoutCodexBlock() {
    return `
# Plan Maestro Codex 2026 (Fixture)

Relacion con Operativo 2026:
- Fixture de pruebas para CLI del orquestador.
`;
}

function basePlanWithCodexBlock({ status = 'in_progress' } = {}) {
    return `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
codex_instance: codex_backend_ops
block: C1
task_id: CDX-001
status: ${status}
files: ["tests/agenda.spec.js"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture de pruebas para CLI del orquestador.
`;
}

function boardForCodexLifecycle() {
    return `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    executor: ci
    status: in_progress
    files: ["controllers/AppointmentController.php"]
  - id: CDX-001
    executor: codex
    status: done
    files: ["tests/chat-booking-calendar-errors.spec.js", "tests/cookie-consent.spec.js"]
`;
}

function boardForConflictFixture({ codexStatus = 'in_progress' } = {}) {
    return `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    executor: codex
    status: in_progress
    files: ["tests/agenda.spec.js", "lib/booking.php"]
  - id: CDX-001
    executor: codex
    status: ${codexStatus}
    files: ["tests/agenda.spec.js", "docs/notes.md"]
`;
}

function boardForTaskOpsFixture() {
    return `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-010
    title: Task fixture
    owner: unassigned
    executor: codex
    status: ready
    risk: low
    scope: docs
    files: ["docs/task-fixture.md"]
    acceptance: "Fixture acceptance"
    acceptance_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`;
}

function boardForTaskStartConflictFixture() {
    return `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-020
    title: Active task
    owner: ernesto
    executor: codex
    status: in_progress
    risk: medium
    scope: backend
    files: ["lib/mailer.php", "tests/MailerTest.php"]
    acceptance: "A"
    acceptance_ref: ""
    depends_on: []
    prompt: "A"
    created_at: ${DATE}
    updated_at: ${DATE}
  - id: AG-021
    title: Candidate task
    owner: unassigned
    executor: codex
    status: done
    risk: low
    scope: audit
    files: ["tests/MailerTest.php", "docs/mailer-audit.md"]
    acceptance: "B"
    acceptance_ref: "docs/mailer-audit.md"
    depends_on: []
    prompt: "B"
    created_at: ${DATE}
    updated_at: ${DATE}
`;
}

test('codex start/stop lifecycle mantiene espejo valido y actualiza CODEX_ACTIVE', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForCodexLifecycle(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    runCli(dir, ['codex-check']);

    runCli(dir, ['codex', 'start', 'CDX-001', '--block', 'C1']);
    runCli(dir, ['codex-check']);
    let plan = readPlan(dir);
    assert.match(plan, /<!-- CODEX_ACTIVE/);
    assert.match(plan, /status: in_progress/);
    assert.match(plan, /task_id: CDX-001/);

    runCli(dir, ['codex', 'stop', 'CDX-001', '--to', 'review']);
    runCli(dir, ['codex-check']);
    plan = readPlan(dir);
    assert.match(plan, /status: review/);

    runCli(dir, ['codex', 'stop', 'CDX-001', '--to', 'done']);
    runCli(dir, ['codex-check']);
    plan = readPlan(dir);
    assert.doesNotMatch(plan, /<!-- CODEX_ACTIVE/);

    const board = readBoard(dir);
    assert.match(board, /- id: CDX-001/);
    assert.match(board, /status: done/);
});

test('conflicts --strict se exime por handoff valido y vuelve a bloquear tras close', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock(),
    });

    let result = runCli(dir, ['conflicts', '--strict'], 1);
    assert.match(result.stdout, /Blocking:\s+1/);

    result = runCli(dir, [
        'handoffs',
        'create',
        '--from',
        'AG-001',
        '--to',
        'CDX-001',
        '--files',
        'tests/agenda.spec.js',
        '--reason',
        'test_guardrail_support',
        '--approved-by',
        'ernesto',
        '--ttl-hours',
        '2',
    ]);
    assert.match(result.stdout, /Handoff creado:\s+HO-001/);

    runCli(dir, ['handoffs', 'lint']);

    result = runCli(dir, ['conflicts', '--strict']);
    assert.match(result.stdout, /Blocking:\s+0/);
    assert.match(result.stdout, /Eximidos por handoff:\s+1/);

    result = runCli(dir, [
        'handoffs',
        'close',
        'HO-001',
        '--reason',
        'fixture_done',
    ]);
    assert.match(result.stdout, /Handoff cerrado:\s+HO-001/);

    result = runCli(dir, ['conflicts', '--strict'], 1);
    assert.match(result.stdout, /Blocking:\s+1/);
});

test('codex-check falla si hay drift entre CODEX_ACTIVE y el board', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'review' }),
    });

    const result = runCli(dir, ['codex-check'], 1);
    assert.match(result.stderr, /ERROR: Codex mirror invalido/);
    assert.match(result.stderr, /status desalineado/i);
});

test('handoffs create rechaza files fuera del solape real (incluye wildcard amplio)', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock(),
    });

    const result = runCli(
        dir,
        [
            'handoffs',
            'create',
            '--from',
            'AG-001',
            '--to',
            'CDX-001',
            '--files',
            '*',
            '--reason',
            'bad_handoff',
            '--approved-by',
            'ernesto',
        ],
        1
    );

    assert.match(
        result.stderr,
        /File fuera del solape real|No se puede crear handoff/i
    );
});

test('task claim/start/finish actualiza board y evidencia sin editar YAML manualmente', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(dir, [
        'task',
        'claim',
        'AG-010',
        '--owner',
        'ernesto',
        '--executor',
        'codex',
    ]);
    assert.match(result.stdout, /Task claim OK: AG-010/);

    result = runCli(dir, [
        'task',
        'start',
        'AG-010',
        '--status',
        'in_progress',
    ]);
    assert.match(result.stdout, /Task start OK: AG-010 -> in_progress/);

    const evidenceDir = join(dir, 'verification', 'agent-runs');
    require('fs').mkdirSync(evidenceDir, { recursive: true });
    const evidenceFile = join(evidenceDir, 'AG-010.md');
    writeFileSync(evidenceFile, '# evidence\n', 'utf8');

    result = runCli(dir, ['task', 'finish', 'AG-010']);
    assert.match(result.stdout, /Task finish OK: AG-010 -> done/);

    const board = readBoard(dir);
    assert.match(board, /owner: ernesto/);
    assert.match(board, /status: done/);
    assert.match(
        board,
        /acceptance_ref: "verification\/agent-runs\/AG-010\.md"/
    );
    assert.match(board, /evidence_ref: "verification\/agent-runs\/AG-010\.md"/);

    // `task` ops should also keep derived queues in sync for non-codex executors.
    assert.match(
        readFileSync(join(dir, 'JULES_TASKS.md'), 'utf8'),
        /Retired Derived Queue/
    );
    assert.match(
        readFileSync(join(dir, 'KIMI_TASKS.md'), 'utf8'),
        /Retired Derived Queue/
    );
});

test('task start bloquea activar una tarea si genera conflicto blocking', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, ['task', 'start', 'AG-021'], 1);
    assert.match(result.stderr, /task start bloqueado por conflicto activo/i);
    assert.match(result.stderr, /AG-021 <-> AG-020/i);
});

test('task soporta --json en claim/start/finish con payload estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(dir, [
        'task',
        'claim',
        'AG-010',
        '--owner',
        'ernesto',
        '--json',
    ]);
    let json = parseJsonStdout(result);
    assert.equal(json.command, 'task');
    assert.equal(json.action, 'claim');
    assert.equal(json.ok, true);
    assert.equal(json.task.id, 'AG-010');
    assert.equal(json.task.owner, 'ernesto');

    result = runCli(dir, ['task', 'start', 'AG-010', '--json']);
    json = parseJsonStdout(result);
    assert.equal(json.action, 'start');
    assert.equal(json.task.status, 'in_progress');

    const evidenceDir = join(dir, 'verification', 'agent-runs');
    require('fs').mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'AG-010.md'), '# evidence\n', 'utf8');

    result = runCli(dir, ['task', 'finish', 'AG-010', '--json']);
    json = parseJsonStdout(result);
    assert.equal(json.action, 'finish');
    assert.equal(json.task.status, 'done');
    assert.equal(json.evidence_path, 'verification/agent-runs/AG-010.md');
});

test('task ls soporta filtros y --json con summary estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(dir, ['task', 'ls', '--json']);
    let json = parseJsonStdout(result);
    assert.equal(json.command, 'task');
    assert.equal(json.action, 'ls');
    assert.equal(json.ok, true);
    assert.equal(json.summary.total, 2);
    assert.equal(json.summary.matched, 2);
    assert.equal(json.summary.returned, 2);
    assert.equal(Array.isArray(json.tasks), true);

    result = runCli(dir, [
        'task',
        'ls',
        '--json',
        '--active',
        '--executor',
        'codex',
    ]);
    json = parseJsonStdout(result);
    assert.equal(json.filters.active, true);
    assert.equal(json.filters.executor, 'codex');
    assert.equal(json.summary.matched, 1);
    assert.equal(json.summary.returned, 1);
    assert.equal(json.summary.matched_active, 1);
    assert.equal(json.tasks[0].id, 'AG-020');
    assert.equal(json.tasks[0].status, 'in_progress');

    result = runCli(dir, [
        'task',
        'ls',
        '--json',
        '--status',
        'done',
        '--executor',
        'codex',
        '--limit',
        '1',
    ]);
    json = parseJsonStdout(result);
    assert.deepEqual(json.filters.status, ['done']);
    assert.equal(json.filters.executor, 'codex');
    assert.equal(json.filters.limit, 1);
    assert.equal(json.summary.matched, 1);
    assert.equal(json.summary.returned, 1);
    assert.equal(json.tasks[0].id, 'AG-021');
    assert.equal(json.tasks[0].executor, 'codex');
});

test('task ls texto imprime matched y filtros', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, ['task', 'ls', '--active', '--status', 'ready']);
    assert.match(result.stdout, /== Task List ==/);
    assert.match(result.stdout, /Matched:\s+1\/1/);
    assert.match(result.stdout, /Filters: .*active=true/);
    assert.match(result.stdout, /status=ready/);
    assert.match(result.stdout, /AG-010 \[ready\]/);
});

test('task ls --mine usa owner detectado por entorno', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCliWithEnv(dir, ['task', 'ls', '--json', '--mine'], {
        AGENT_OWNER: 'ernesto',
    });
    const json = parseJsonStdout(result);

    assert.equal(json.filters.mine, true);
    assert.equal(json.filters.owner, 'ernesto');
    assert.equal(json.summary.matched, 1);
    assert.equal(json.tasks[0].id, 'AG-020');
});

test('task create crea AG siguiente y sincroniza colas derivadas', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCliWithEnv(
        dir,
        [
            'task',
            'create',
            '--title',
            'Nueva tarea fixture',
            '--executor',
            'codex',
            '--status',
            'ready',
            '--risk',
            'low',
            '--scope',
            'docs',
            '--files',
            'docs/nueva-tarea.md,docs/otra.md',
            '--depends-on',
            'AG-010',
            '--json',
        ],
        { AGENT_OWNER: 'ernesto' }
    );
    const json = parseJsonStdout(result);

    assert.equal(json.command, 'task');
    assert.equal(json.action, 'create');
    assert.equal(json.ok, true);
    assert.equal(json.task.id, 'AG-011');
    assert.equal(json.task.owner, 'ernesto');
    assert.equal(json.task.executor, 'codex');
    assert.equal(json.task.status, 'ready');

    const board = readBoard(dir);
    assert.match(board, /- id: AG-011/);
    assert.match(board, /title: "Nueva tarea fixture"/);
    assert.match(board, /executor: codex/);
    assert.match(board, /status: ready/);
    assert.match(board, /files: \["docs\/nueva-tarea\.md", "docs\/otra\.md"\]/);
    assert.match(board, /depends_on: \["AG-010"\]/);

    assert.match(
        readFileSync(join(dir, 'JULES_TASKS.md'), 'utf8'),
        /Retired Derived Queue/
    );
    assert.match(
        readFileSync(join(dir, 'KIMI_TASKS.md'), 'utf8'),
        /Retired Derived Queue/
    );
});

test('task create soporta --template docs y permite override de defaults', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCliWithEnv(
        dir,
        [
            'task',
            'create',
            '--title',
            'Docs template task',
            '--template',
            'docs',
            '--executor',
            'ci',
            '--files',
            'docs/template.md',
            '--json',
        ],
        { AGENT_OWNER: 'ernesto' }
    );
    const json = parseJsonStdout(result);

    assert.equal(json.template, 'docs');
    assert.equal(json.task.id, 'AG-011');
    assert.equal(json.task.owner, 'ernesto');
    assert.equal(json.task.status, 'ready');
    assert.equal(json.task.risk, 'low');
    assert.equal(json.task.scope, 'docs');
    assert.equal(json.task.executor, 'ci'); // explicit flag overrides template
    assert.equal(json.executor_source, 'flag');

    const board = readBoard(dir);
    assert.match(board, /executor: ci/);
    assert.match(board, /risk: low/);
    assert.match(board, /scope: docs/);
});

test('task create --from-files infiere scope/risk y puede sobreescribir template', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Calendar hardening',
        '--template',
        'docs',
        '--executor',
        'codex',
        '--from-files',
        '--files',
        'lib/calendar/CalendarBookingService.php',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.template, 'docs');
    assert.equal(json.from_files, true);
    assert.equal(json.file_inference.scope, 'calendar');
    assert.equal(json.file_inference.risk, 'high');
    assert.equal(json.file_inference.suggested_executor, 'codex');
    assert.equal(json.task.scope, 'calendar');
    assert.equal(json.task.risk, 'high');
    assert.equal(json.task.executor, 'codex');
    assert.equal(json.executor_source, 'flag');
});

test('task create --from-files autoajusta executor para scope critico si no se pasa --executor', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Calendar task auto executor',
        '--template',
        'docs',
        '--from-files',
        '--files',
        'lib/calendar/GoogleCalendarClient.php',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.template, 'docs');
    assert.equal(json.from_files, true);
    assert.equal(json.file_inference.scope, 'calendar');
    assert.equal(json.file_inference.critical_scope, 'calendar');
    assert.equal(json.file_inference.suggested_executor, 'codex');
    assert.deepEqual(json.file_inference.allowed_executors_for_scope, [
        'codex',
    ]);
    assert.equal(json.task.scope, 'calendar');
    assert.equal(json.task.risk, 'high');
    assert.equal(json.task.executor, 'codex');
    assert.equal(json.executor_source, 'template');
});

test('task create --from-files agrega diagnostics cuando cae en scope general por fallback', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Fallback scope task',
        '--from-files',
        '--preview',
        '--files',
        '/',
        '--executor',
        'codex',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.from_files, true);
    assert.equal(json.file_inference.scope, 'general');
    assert.equal(json.scope_source, 'from_files');
    assert.equal(Array.isArray(json.diagnostics), true);
    assert.equal(json.warnings_count >= 1, true);
    assert.equal(
        json.diagnostics.some(
            (d) => d.code === 'warn.task.from_files_fallback_default_scope'
        ),
        true
    );
});

test('task create --preview/--dry-run no escribe board ni colas derivadas', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const beforeBoard = readBoard(dir);
    const result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Preview only task',
        '--template',
        'docs',
        '--dry-run',
        '--files',
        'docs/preview.md',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.preview, true);
    assert.equal(json.dry_run, true);
    assert.equal(json.persisted, false);
    assert.equal(json.validate_only, false);
    assert.equal(json.task.id, 'AG-011');
    assert.equal(json.task.scope, 'docs');
    assert.ok(json.task_full);
    assert.equal(json.task_full.id, 'AG-011');
    assert.equal(json.task_full.title, 'Preview only task');

    const afterBoard = readBoard(dir);
    assert.equal(afterBoard, beforeBoard);
    assert.equal(existsSync(join(dir, 'JULES_TASKS.md')), false);
    assert.equal(existsSync(join(dir, 'KIMI_TASKS.md')), false);
});

test('task create --validate-only valida sin escribir board y devuelve diagnostico', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const beforeBoard = readBoard(dir);
    const result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Validate only task',
        '--template',
        'bugfix',
        '--from-files',
        '--validate-only',
        '--files',
        'tests/unit/foo.spec.js',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.validate_only, true);
    assert.equal(json.preview, false);
    assert.equal(json.persisted, false);
    assert.equal(json.task.id, 'AG-011');
    assert.equal(json.validation.governance_prechecks, 'passed');
    assert.equal(json.validation.conflict_check, 'passed');
    assert.equal(json.task_full, undefined);

    const afterBoard = readBoard(dir);
    assert.equal(afterBoard, beforeBoard);
});

test('task create bloquea crear tarea activa con conflicto blocking', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(
        dir,
        [
            'task',
            'create',
            '--title',
            'Conflicting task',
            '--executor',
            'codex',
            '--status',
            'in_progress',
            '--risk',
            'medium',
            '--scope',
            'backend',
            '--files',
            'tests/MailerTest.php,docs/notes.md',
        ],
        1
    );

    assert.match(result.stderr, /task create bloqueado por conflicto activo/i);
    assert.match(result.stderr, /tests\/MailerTest\.php/i);
});

test('task create valida depends_on existente y bloquea referencias invalidas', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(
        dir,
        [
            'task',
            'create',
            '--title',
            'Deps invalidas',
            '--executor',
            'codex',
            '--files',
            'docs/deps.md',
            '--depends-on',
            'AG-999',
        ],
        1
    );
    assert.match(result.stderr, /depends_on no existe en board/i);
    assert.match(result.stderr, /AG-999/);

    result = runCli(
        dir,
        [
            'task',
            'create',
            '--title',
            'Deps duplicadas',
            '--executor',
            'codex',
            '--files',
            'docs/deps-dup.md',
            '--depends-on',
            'AG-010,AG-010',
        ],
        1
    );
    assert.match(result.stderr, /depends_on duplicado/i);
});

test('task create bloquea scope critico para executor no permitido', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(
        dir,
        [
            'task',
            'create',
            '--title',
            'Cambio deploy',
            '--executor',
            'ci',
            '--scope',
            'deploy-hotfix',
            '--files',
            '.github/workflows/deploy.yml',
        ],
        1
    );

    assert.match(result.stderr, /task critica/i);
    assert.match(result.stderr, /executor ci/i);
});

test('task create template critical exige scope critico explicito', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(
        dir,
        [
            'task',
            'create',
            '--title',
            'Critical but wrong scope',
            '--template',
            'critical',
            '--scope',
            'backend',
            '--files',
            'lib/critical.php',
        ],
        1
    );
    assert.match(result.stderr, /template critical requiere --scope critico/i);

    result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Critical auth task',
        '--template',
        'critical',
        '--scope',
        'auth-prod',
        '--files',
        'controllers/AuthController.php',
        '--json',
    ]);
    const json = parseJsonStdout(result);
    assert.equal(json.template, 'critical');
    assert.equal(json.task.executor, 'codex');
    assert.equal(json.task.risk, 'high');
    assert.equal(json.task.status, 'ready');
    assert.equal(json.task.scope, 'auth-prod');
});

test('task create --interactive solicita campos minimos y mantiene JSON limpio', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const input = [
        'Interactive docs task', // title
        'docs', // template
        'docs/interactive.md', // files
        'y', // from-files
        '', // executor
        '', // status
        '', // risk
        '', // scope
        '', // depends-on
        '',
    ].join('\n');

    const result = runCliWithInput(
        dir,
        ['task', 'create', '--interactive', '--json'],
        input,
        0,
        { AGENT_OWNER: 'ernesto' }
    );
    const json = parseJsonStdout(result);

    assert.equal(json.task.id, 'AG-011');
    assert.equal(json.task.owner, 'ernesto');
    assert.equal(json.task.executor, 'codex');
    assert.equal(json.task.scope, 'docs');
    assert.equal(json.task.risk, 'low');
    assert.equal(json.template, 'docs');
    assert.equal(json.from_files, true);
    assert.equal(json.file_inference.scope, 'docs');
    assert.equal(json.file_inference.risk, 'low');
    assert.equal(json.executor_source, 'template');
    assert.equal(result.stdout.trim().startsWith('{'), true);
    assert.match(result.stderr, /Titulo:/);
    assert.match(result.stderr, /Inferir scope\/risk/);
});

test('task create --explain imprime razon de inferencia y soporta JSON estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    let result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Explain text mode',
        '--template',
        'docs',
        '--from-files',
        '--explain',
        '--preview',
        '--files',
        'lib/calendar/CalendarAvailabilityService.php',
    ]);
    assert.match(result.stdout, /Task create explain:/);
    assert.match(result.stdout, /inference\.scope=calendar/);
    assert.match(result.stdout, /inference\.suggested_executor=codex/);
    assert.match(result.stdout, /Task create PREVIEW:/);

    result = runCli(dir, [
        'task',
        'create',
        '--title',
        'Explain json mode',
        '--from-files',
        '--explain',
        '--preview',
        '--files',
        'docs/explain.md',
        '--executor',
        'codex',
        '--json',
    ]);
    const json = parseJsonStdout(result);
    assert.equal(json.preview, true);
    assert.equal(Array.isArray(json.inference_explanation), true);
    assert.match(json.inference_explanation.join('\n'), /from-files=enabled/i);
    assert.equal(json.scope_source, 'from_files');
    assert.equal(json.risk_source, 'from_files');
});

test('task create --apply persiste un preview JSON sin recalcular task', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Apply preview task',
        '--template',
        'docs',
        '--from-files',
        '--preview',
        '--explain',
        '--files',
        'lib/calendar/GoogleTokenProvider.php',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    assert.equal(previewJson.preview, true);
    assert.ok(previewJson.task_full);

    const previewPath = join(dir, 'task-preview.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    const applyResult = runCli(dir, [
        'task',
        'create',
        '--apply',
        'task-preview.json',
        '--explain',
        '--json',
    ]);
    const applyJson = parseJsonStdout(applyResult);

    assert.equal(applyJson.applied, true);
    assert.equal(applyJson.preview, false);
    assert.equal(applyJson.persisted, true);
    assert.equal(applyJson.task.id, 'AG-011');
    assert.equal(applyJson.task.executor, 'codex');
    assert.equal(applyJson.task.scope, 'calendar');
    assert.equal(applyJson.task_full.title, 'Apply preview task');
    assert.equal(Array.isArray(applyJson.inference_explanation), true);
    assert.match(String(applyJson.applied_from || ''), /task-preview\.json$/);

    const board = readBoard(dir);
    assert.match(board, /- id: AG-011/);
    assert.match(board, /title: "Apply preview task"/);
    assert.match(board, /executor: codex/);
});

test('task create --apply - lee preview JSON desde stdin', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Apply stdin task',
        '--template',
        'docs',
        '--preview',
        '--files',
        'docs/stdin-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);

    const applyResult = runCliWithInput(
        dir,
        ['task', 'create', '--apply', '-', '--json'],
        JSON.stringify(previewJson)
    );
    const applyJson = parseJsonStdout(applyResult);

    assert.equal(applyJson.applied, true);
    assert.equal(applyJson.applied_from, '-');
    assert.equal(applyJson.applied_from_resolved, null);
    assert.equal(applyJson.task.id, 'AG-011');
    assert.equal(applyJson.task.title, 'Apply stdin task');

    const board = readBoard(dir);
    assert.match(board, /- id: AG-011/);
    assert.match(board, /title: "Apply stdin task"/);
});

test('task create --apply --force-id-remap remapea AG duplicado al siguiente ID', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Remap preview task',
        '--template',
        'docs',
        '--status',
        'backlog',
        '--preview',
        '--files',
        'docs/remap-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    const previewPath = join(dir, 'preview-remap.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    runCli(dir, ['task', 'create', '--apply', 'preview-remap.json', '--json']);

    const remapApply = runCli(dir, [
        'task',
        'create',
        '--apply',
        'preview-remap.json',
        '--force-id-remap',
        '--json',
    ]);
    const json = parseJsonStdout(remapApply);

    assert.equal(json.applied, true);
    assert.equal(json.force_id_remap, true);
    assert.equal(json.id_remapped, true);
    assert.equal(json.original_task_id, 'AG-011');
    assert.equal(json.task.id, 'AG-012');
    assert.equal(json.task_full.id, 'AG-012');

    const board = readBoard(dir);
    assert.match(board, /- id: AG-011/);
    assert.match(board, /- id: AG-012/);
    assert.match(board, /title: "Remap preview task"/);
});

test('task create --apply --force-id-remap --to backlog evita conflicto activo al reaplicar preview activo', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Active remap preview task',
        '--template',
        'docs', // ready (activo) por template
        '--preview',
        '--files',
        'docs/remap-active-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    const previewOwner = String(previewJson.task.owner || '');
    const previewPath = join(dir, 'preview-remap-active.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    runCli(dir, [
        'task',
        'create',
        '--apply',
        'preview-remap-active.json',
        '--json',
    ]);

    const remapApply = runCli(dir, [
        'task',
        'create',
        '--apply',
        'preview-remap-active.json',
        '--force-id-remap',
        '--to',
        'backlog',
        '--claim-owner',
        'ernesto',
        '--json',
    ]);
    const json = parseJsonStdout(remapApply);

    assert.equal(json.applied, true);
    assert.equal(json.force_id_remap, true);
    assert.equal(json.id_remapped, true);
    assert.equal(json.status_override_applied, true);
    assert.equal(json.status_override_to, 'backlog');
    assert.equal(json.original_task_status, 'ready');
    assert.equal(json.owner_claim_applied, true);
    assert.equal(json.owner_claim_to, 'ernesto');
    assert.equal(json.original_task_owner, previewOwner);
    assert.equal(json.task.id, 'AG-012');
    assert.equal(json.task.status, 'backlog');
    assert.equal(json.task.owner, 'ernesto');

    const board = readBoard(dir);
    assert.match(board, /- id: AG-011/);
    assert.match(board, /- id: AG-012/);
    assert.match(board, /owner: ernesto/);
    assert.match(board, /status: backlog/);
});

test('task create preview-file lint valida preview contra board actual', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Lint preview task',
        '--template',
        'docs',
        '--preview',
        '--files',
        'docs/lint-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    const previewPath = join(dir, 'preview-lint.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    const result = runCli(dir, [
        'task',
        'create',
        'preview-file',
        'lint',
        'preview-lint.json',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.ok, true);
    assert.equal(json.action, 'create-preview-lint');
    assert.equal(json.preview_file, 'preview-lint.json');
    assert.equal(json.checks.preview_payload_schema, 'passed');
    assert.equal(json.checks.task_normalization, 'passed');
    assert.equal(json.checks.duplicate_id, 'passed');
    assert.equal(json.checks.governance_prechecks, 'passed');
    assert.equal(json.checks.conflict_check, 'passed');
    assert.equal(json.task.id, 'AG-011');

    // lint should not persist the task
    const board = readBoard(dir);
    assert.doesNotMatch(board, /- id: AG-011/);
});

test('task create preview-file diff compara preview con task existente y sugiere remap', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Diff preview original',
        '--template',
        'docs',
        '--preview',
        '--files',
        'docs/diff-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);

    previewJson.task.id = 'AG-010';
    previewJson.task_full.id = 'AG-010';
    previewJson.task.title = 'Task fixture changed';
    previewJson.task_full.title = 'Task fixture changed';

    const previewPath = join(dir, 'preview-diff.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    const result = runCli(dir, [
        'task',
        'create',
        'preview-file',
        'diff',
        'preview-diff.json',
        '--json',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.ok, true);
    assert.equal(json.action, 'create-preview-diff');
    assert.equal(json.id_collision, true);
    assert.equal(json.suggested_id_remap, 'AG-011');
    assert.ok(json.board_task_same_id);
    assert.equal(json.board_task_same_id.id, 'AG-010');
    assert.equal(Array.isArray(json.field_diff_same_id), true);
    assert.equal(
        json.field_diff_same_id.some((row) => row.field === 'title'),
        true
    );
    assert.equal(json.apply_projection.basis, 'remap_candidate');
    assert.equal(json.apply_projection.projected_task_id, 'AG-011');

    const board = readBoard(dir);
    assert.doesNotMatch(board, /- id: AG-011/);
});

test('task create preview-file diff --json --format compact reduce payload y conserva resumen', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Diff compact preview',
        '--template',
        'docs',
        '--preview',
        '--files',
        'docs/diff-compact-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    previewJson.task.id = 'AG-010';
    previewJson.task_full.id = 'AG-010';
    previewJson.task.scope = 'docs-v3';
    previewJson.task_full.scope = 'docs-v3';

    const previewPath = join(dir, 'preview-diff-compact.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    const result = runCli(dir, [
        'task',
        'create',
        'preview-file',
        'diff',
        'preview-diff-compact.json',
        '--json',
        '--format',
        'compact',
    ]);
    const json = parseJsonStdout(result);

    assert.equal(json.ok, true);
    assert.equal(json.action, 'create-preview-diff');
    assert.equal(json.diff_format, 'compact');
    assert.equal(json.json_format, 'compact');
    assert.equal(json.id_collision, true);
    assert.equal(json.suggested_id_remap, 'AG-011');
    assert.equal(json.task_full, undefined);
    assert.ok(json.board_task_same_id);
    assert.equal(json.board_task_same_id.id, 'AG-010');
    assert.equal(Array.isArray(json.field_diff_same_id), true);
    assert.equal(json.field_diff_same_id_count >= 1, true);
    assert.equal(json.field_diff_same_id[0].before, undefined);
    assert.equal(
        json.field_diff_same_id.some((row) => row.field === 'scope'),
        true
    );
});

test('task create preview-file diff --format full expone diff detallado en texto', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const preview = runCli(dir, [
        'task',
        'create',
        '--title',
        'Diff full preview original',
        '--template',
        'docs',
        '--preview',
        '--files',
        'docs/diff-full-preview.md',
        '--json',
    ]);
    const previewJson = parseJsonStdout(preview);
    previewJson.task.id = 'AG-010';
    previewJson.task_full.id = 'AG-010';
    previewJson.task.scope = 'docs-v2';
    previewJson.task_full.scope = 'docs-v2';

    const previewPath = join(dir, 'preview-diff-full.json');
    writeFileSync(
        previewPath,
        `${JSON.stringify(previewJson, null, 2)}\n`,
        'utf8'
    );

    const result = runCli(dir, [
        'task',
        'create',
        'preview-file',
        'diff',
        'preview-diff-full.json',
        '--format',
        'full',
    ]);

    assert.match(result.stdout, /format: full/i);
    assert.match(result.stdout, /field_diff_same_id:/i);
    assert.match(result.stdout, /scope: "docs" -> "docs-v2"/i);
});

test('task claim bloquea pasar a estado activo si genera conflicto blocking', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(
        dir,
        ['task', 'claim', 'AG-021', '--status', 'in_progress'],
        1
    );

    assert.match(result.stderr, /task claim bloqueado por conflicto activo/i);
    assert.match(result.stderr, /AG-021 <-> AG-020/i);
});

test('task start bloquea scope critico para executor no permitido', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(
        dir,
        [
            'task',
            'start',
            'AG-010',
            '--scope',
            'payments-prod',
            '--executor',
            'ci',
        ],
        1
    );

    assert.match(result.stderr, /task critica/i);
    assert.match(result.stderr, /executor ci/i);
});

test('leases lifecycle: task start crea lease, heartbeat renueva y clear limpia', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const started = parseJsonStdout(
        runCli(dir, ['task', 'start', 'AG-010', '--owner', 'ernesto', '--json'])
    );
    assert.equal(started.ok, true);
    assert.equal(started.action, 'start');
    assert.equal(typeof started.status_since_at, 'string');
    assert.equal(started.status_since_at.length > 0, true);
    assert.equal(
        ['created', 'renewed', 'none'].includes(started.lease_action),
        true
    );
    assert.equal(typeof started.lease, 'object');

    const boardAfterStart = readBoard(dir);
    assert.match(boardAfterStart, /status_since_at:/);
    assert.match(boardAfterStart, /lease_id:/);
    assert.match(boardAfterStart, /heartbeat_at:/);

    const heartbeat = parseJsonStdout(
        runCli(dir, ['leases', 'heartbeat', 'AG-010', '--json'])
    );
    assert.equal(heartbeat.ok, true);
    assert.equal(heartbeat.action, 'heartbeat');
    assert.equal(
        ['created', 'renewed'].includes(String(heartbeat.lease_action)),
        true
    );
    assert.equal(typeof heartbeat.lease.lease_expires_at, 'string');

    const leasesStatus = parseJsonStdout(
        runCli(dir, ['leases', 'status', '--active', '--json'])
    );
    assert.equal(leasesStatus.ok, true);
    assert.equal(Array.isArray(leasesStatus.leases), true);
    assert.equal(
        leasesStatus.leases.some((row) => row.task_id === 'AG-010'),
        true
    );

    const cleared = parseJsonStdout(
        runCli(dir, [
            'leases',
            'clear',
            'AG-010',
            '--reason',
            'manual_test',
            '--json',
        ])
    );
    assert.equal(cleared.ok, true);
    assert.equal(cleared.action, 'clear');
    assert.equal(
        ['cleared', 'none'].includes(String(cleared.lease_action)),
        true
    );
});

test('close soporta --json y devuelve task + evidence_path', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const evidenceDir = join(dir, 'verification', 'agent-runs');
    require('fs').mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'AG-010.md'), '# evidence\n', 'utf8');

    const result = runCli(dir, ['close', 'AG-010', '--json']);
    const json = parseJsonStdout(result);

    assert.equal(json.command, 'close');
    assert.equal(json.action, 'close');
    assert.equal(json.ok, true);
    assert.equal(json.task.id, 'AG-010');
    assert.equal(json.task.status, 'done');
    assert.equal(json.evidence_path, 'verification/agent-runs/AG-010.md');

    const board = readBoard(dir);
    assert.match(
        board,
        /acceptance_ref: "verification\/agent-runs\/AG-010\.md"/
    );
    assert.match(board, /evidence_ref: "verification\/agent-runs\/AG-010\.md"/);
});

test('metrics soporta --json, escribe archivo y expone delta/baseline handoff', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    const result = runCli(dir, ['metrics', '--json']);
    const json = parseJsonStdout(result);

    assert.equal(json.version, 1);
    assert.ok(json.io);
    assert.equal(json.io.profile, 'default');
    assert.equal(json.io.write_mode, 'write');
    assert.equal(json.io.persisted, true);
    assert.equal(json.current.file_conflicts, 1);
    assert.equal(json.current.file_conflicts_handoff, 0);
    assert.equal(typeof json.baseline.file_conflicts_handoff, 'number');
    assert.equal(typeof json.delta.file_conflicts, 'number');
    assert.equal(typeof json.delta.file_conflicts_handoff, 'number');
    assert.ok(json.contribution);
    assert.ok(json.baseline_contribution);
    assert.ok(json.contribution_delta);
    assert.ok(json.domain_health);
    assert.ok(json.contribution_history);
    assert.ok(json.domain_health_history);
    assert.equal(Array.isArray(json.domain_health.ranking), true);
    assert.ok(json.domain_health.scoring);
    assert.equal(
        typeof json.domain_health.scoring.priority_weighted_score_pct,
        'number'
    );
    assert.equal(Array.isArray(json.contribution_history.daily), true);
    assert.equal(Array.isArray(json.domain_health_history.daily), true);
    assert.ok(json.domain_health_history.regressions);
    assert.equal(
        Array.isArray(json.domain_health_history.regressions.green_to_red),
        true
    );
    assert.equal(Array.isArray(json.baseline_contribution.executors), true);
    assert.equal(Array.isArray(json.contribution_delta.rows), true);

    const written = readMetrics(dir);
    assert.equal(written.current.file_conflicts, 1);
    assert.equal(written.current.file_conflicts_handoff, 0);
    assert.ok(written.contribution_history);

    const history = readContributionHistory(dir);
    assert.equal(history.version, 1);
    assert.equal(Array.isArray(history.snapshots), true);
    assert.equal(history.snapshots.length, 1);
    assert.equal(typeof history.snapshots[0].date, 'string');

    const domainHistory = readDomainHealthHistory(dir);
    assert.equal(domainHistory.version, 1);
    assert.equal(Array.isArray(domainHistory.snapshots), true);
    assert.equal(domainHistory.snapshots.length, 1);
    assert.equal(typeof domainHistory.snapshots[0].date, 'string');
});

test('metrics soporta --no-write y no persiste archivos runtime', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    const result = runCli(dir, ['metrics', '--json', '--no-write']);
    const json = parseJsonStdout(result);

    assert.equal(json.version, 1);
    assert.ok(json.contribution_history);
    assert.ok(json.domain_health_history);
    assert.ok(json.io);
    assert.equal(json.io.profile, 'default');
    assert.equal(json.io.no_write, true);
    assert.equal(json.io.write_mode, 'no-write');
    assert.equal(json.io.persisted, false);
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-metrics.json')
        ),
        false
    );
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-contribution-history.json')
        ),
        false
    );
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-domain-health-history.json')
        ),
        false
    );
});

test('metrics soporta --profile local|ci y override --write', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    let result = runCli(dir, ['metrics', '--json', '--profile', 'local']);
    let json = parseJsonStdout(result);
    assert.equal(json.io.profile, 'local');
    assert.equal(json.io.no_write, true);
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-metrics.json')
        ),
        false
    );

    result = runCli(dir, ['metrics', '--json', '--profile', 'ci']);
    json = parseJsonStdout(result);
    assert.equal(json.io.profile, 'ci');
    assert.equal(json.io.no_write, false);
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-metrics.json')
        ),
        true
    );

    require('fs').rmSync(join(dir, 'verification'), {
        recursive: true,
        force: true,
    });
    result = runCli(dir, [
        'metrics',
        '--json',
        '--profile',
        'local',
        '--write',
    ]);
    json = parseJsonStdout(result);
    assert.equal(json.io.profile, 'local');
    assert.equal(json.io.no_write, false);
    assert.equal(json.io.write_mode, 'write');
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-metrics.json')
        ),
        true
    );
});

test('metrics --dry-run muestra preview de archivos y no persiste runtime', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    const result = runCli(dir, ['metrics', '--dry-run']);
    assert.match(result.stdout, /Metricas calculadas \(dry-run/);
    assert.match(result.stdout, /Archivos de salida \(preview\):/);
    assert.match(result.stdout, /verification\/agent-metrics\.json/);
    assert.match(
        result.stdout,
        /verification\/agent-contribution-history\.json/
    );
    assert.match(
        result.stdout,
        /verification\/agent-domain-health-history\.json/
    );
    assert.equal(
        require('fs').existsSync(
            join(dir, 'verification', 'agent-metrics.json')
        ),
        false
    );
});

test('metrics baseline show/set/reset controla baseline explicito en agent-metrics.json', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    runCli(dir, ['metrics', '--json']); // crea snapshot inicial con baseline implicito

    let show = runCli(dir, ['metrics', 'baseline', 'show', '--json']);
    let showJson = parseJsonStdout(show);
    assert.equal(showJson.ok, true);
    assert.equal(showJson.action, 'show');
    assert.equal(showJson.baseline.tasks_total, 2);
    assert.equal(showJson.baseline.file_conflicts, 1);

    // Simula drift del baseline para verificar set/reset.
    const metrics = readMetrics(dir);
    metrics.baseline.tasks_total = 999;
    metrics.baseline.file_conflicts = 999;
    metrics.baseline.traceability_pct = 0;
    metrics.baseline_contribution = {
        executors: [
            {
                executor: 'codex',
                weighted_done_points_pct: 100,
                done_tasks_pct: 100,
            },
        ],
    };
    writeFileSync(
        join(dir, 'verification', 'agent-metrics.json'),
        `${JSON.stringify(metrics, null, 4)}\n`,
        'utf8'
    );

    let setResult = runCli(dir, [
        'metrics',
        'baseline',
        'set',
        '--from',
        'current',
        '--json',
    ]);
    let setJson = parseJsonStdout(setResult);
    assert.equal(setJson.ok, true);
    assert.equal(setJson.action, 'set');
    assert.equal(setJson.source, 'current');
    assert.equal(setJson.baseline.tasks_total, 2);
    assert.equal(setJson.baseline.file_conflicts, 1);
    assert.equal(setJson.delta.tasks_total, 0);
    assert.equal(setJson.delta.file_conflicts, 0);
    assert.ok(setJson.baseline_meta);
    assert.equal(setJson.baseline_meta.source, 'current');

    let written = readMetrics(dir);
    assert.equal(written.baseline.tasks_total, written.current.tasks_total);
    assert.equal(
        written.baseline.file_conflicts,
        written.current.file_conflicts
    );
    assert.equal(written.delta.tasks_total, 0);
    assert.equal(written.delta.file_conflicts, 0);
    assert.ok(written.baseline_meta);
    assert.equal(written.baseline_meta.action, 'set');

    const resetResult = runCli(dir, ['metrics', 'baseline', 'reset', '--json']);
    const resetJson = parseJsonStdout(resetResult);
    assert.equal(resetJson.ok, true);
    assert.equal(resetJson.action, 'reset');
    assert.equal(resetJson.source, 'current');

    written = readMetrics(dir);
    assert.equal(written.baseline.tasks_total, written.current.tasks_total);
    assert.equal(written.delta.tasks_total, 0);
    assert.equal(written.baseline_meta.action, 'reset');
});

test('status --json expone porcentajes de aporte por agente y ranking', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    const result = runCli(dir, ['status', '--json']);
    const json = parseJsonStdout(result);

    assert.equal(json.version, '1');
    assert.ok(json.contribution);
    assert.equal(
        json.contribution.scoring.primary_metric,
        'weighted_done_points_pct'
    );
    assert.ok(Array.isArray(json.contribution.executors));
    assert.ok(Array.isArray(json.contribution.ranking));
    assert.equal(json.contribution.ranking.length >= 1, true);
    assert.equal(Object.hasOwn(json, 'contribution_trend'), true);
    assert.ok(json.domain_health);
    assert.equal(Array.isArray(json.domain_health.ranking), true);
    assert.ok(json.domain_health.scoring);
    assert.equal(
        json.domain_health.ranking.some((row) => row.domain === 'payments'),
        true
    );
    assert.equal(typeof json.contribution.executors[0].tasks_pct, 'number');
    assert.equal(
        typeof json.contribution.executors[0].done_tasks_pct,
        'number'
    );
    assert.equal(
        typeof json.contribution.executors[0].weighted_done_points_pct,
        'number'
    );
});

test('status texto muestra leaderboard con semaforo y delta vs baseline cuando hay metrics', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskStartConflictFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    require('fs').mkdirSync(join(dir, 'verification'), { recursive: true });
    writeFileSync(
        join(dir, 'verification', 'agent-metrics.json'),
        `${JSON.stringify(
            {
                version: 1,
                baseline_contribution: {
                    executors: [
                        {
                            executor: 'codex',
                            weighted_done_points_pct: 0,
                            done_tasks_pct: 0,
                        },
                        {
                            executor: 'ci',
                            weighted_done_points_pct: 100,
                            done_tasks_pct: 100,
                        },
                    ],
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const result = runCli(dir, ['status']);
    assert.match(result.stdout, /Semaforo por dominio:/);
    assert.match(result.stdout, /Score dominios \(ponderado priority\):/);
    assert.match(result.stdout, /\[GREEN\]\s+payments:/);
    assert.match(result.stdout, /Aporte \(ranking por completado ponderado\)/);
    assert.match(result.stdout, /Baseline de comparacion:\s+metrics/);
    assert.match(result.stdout, /\[GREEN\]\s+#1 codex/);
    assert.match(result.stdout, /delta \+100pp vs baseline/);
});

test('status --json --explain-red expone causas de rojo por conflictos activos', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    const result = runCli(dir, ['status', '--json', '--explain-red']);
    const json = parseJsonStdout(result);

    assert.ok(json.red_explanation);
    assert.equal(json.red_explanation.signal, 'RED');
    assert.ok(Array.isArray(json.red_explanation.blockers));
    assert.ok(json.red_explanation.blockers.includes('conflicts'));
    assert.equal(json.red_explanation.counts.blocking_conflicts, 1);
    assert.equal(
        Array.isArray(json.red_explanation.top_blocking_conflicts),
        true
    );
    assert.equal(json.red_explanation.top_blocking_conflicts.length >= 1, true);
});

test('policy lint valida governance-policy.json y falla con schema invalido', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForTaskOpsFixture(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    writeGovernancePolicy(dir, {
        version: 1,
        domain_health: {
            priority_domains: ['calendar', 'chat', 'payments'],
            domain_weights: {
                calendar: 5,
                chat: 3,
                payments: 2,
                default: 1,
            },
            signal_scores: {
                GREEN: 100,
                YELLOW: 60,
                RED: 0,
            },
        },
        summary: {
            thresholds: {
                domain_score_priority_yellow_below: 80,
            },
        },
    });

    let result = runCli(dir, ['policy', 'lint', '--json']);
    let json = parseJsonStdout(result);
    assert.equal(json.ok, true);
    assert.equal(json.error_count, 0);
    assert.equal(json.source.path, 'governance-policy.json');

    writeGovernancePolicy(dir, {
        version: 1,
        domain_health: {
            priority_domains: ['calendar', 'calendar'],
            domain_weights: {
                default: 0,
            },
            signal_scores: {
                GREEN: 10,
                YELLOW: 20,
                RED: 0,
            },
        },
        summary: {
            thresholds: {
                domain_score_priority_yellow_below: 'bad',
            },
        },
    });

    result = runCli(dir, ['policy', 'lint', '--json'], 1);
    json = parseJsonStdout(result);
    assert.equal(json.ok, false);
    assert.ok(json.error_count >= 1);
    assert.match(
        json.errors.join(' | '),
        /priority_domains duplicado|domain_weights\.default invalido|signal_scores debe cumplir|domain_score_priority_yellow_below invalido/i
    );
});

test('conflicts, handoffs y codex-check soportan --json con salida estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'review' }), // drift para codex-check
    });

    let result = runCli(dir, ['conflicts', '--strict', '--json'], 1);
    let json = parseJsonStdout(result);
    assert.equal(json.version, 1);
    assert.equal(json.strict, true);
    assert.equal(json.totals.blocking, 1);
    assert.equal(json.totals.handoff, 0);
    assert.equal(Array.isArray(json.conflicts), true);
    assert.equal(json.conflicts[0].exempted_by_handoff, false);

    result = runCli(dir, ['handoffs', '--json']);
    json = parseJsonStdout(result);
    assert.equal(json.summary.total, 0);
    assert.equal(json.summary.active, 0);
    assert.equal(Array.isArray(json.handoffs), true);

    result = runCli(dir, ['handoffs', 'lint', '--json']);
    json = parseJsonStdout(result);
    assert.equal(json.ok, true);
    assert.equal(json.error_count, 0);

    result = runCli(dir, ['codex-check', '--json'], 1);
    json = parseJsonStdout(result);
    assert.equal(json.ok, false);
    assert.ok(json.error_count >= 1);
    assert.match(json.errors.join(' | '), /status desalineado/i);
    assert.equal(Array.isArray(json.plan_blocks), true);
    assert.equal(json.plan_blocks[0].task_id, 'CDX-001');
    assert.equal(json.codex_active_ids.includes('CDX-001'), true);
});

test('conflicts y codex-check reportan public_main_sync failed sin degradar a unconfigured', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'review' }),
    });
    writeGovernancePolicy(dir, {
        version: 1,
        enforcement: {
            warning_policies: {
                public_main_sync_unconfigured: {
                    enabled: true,
                    severity: 'warning',
                },
                public_main_sync_failed: {
                    enabled: true,
                    severity: 'warning',
                },
                public_main_sync_head_drift: {
                    enabled: true,
                    severity: 'warning',
                },
                public_main_sync_telemetry_gap: {
                    enabled: true,
                    severity: 'warning',
                },
            },
        },
    });
    writePublicSyncJobsFixture(dir, {
        state: 'failed',
        last_error_message: 'working_tree_dirty',
    });

    let json = parseJsonStdout(runCli(dir, ['conflicts', '--json']));
    let codes = json.diagnostics.map((item) => item.code);
    assert.equal(codes.includes('warn.jobs.public_main_sync_failed'), true);
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_telemetry_gap'),
        true
    );
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_unconfigured'),
        false
    );

    json = parseJsonStdout(runCli(dir, ['codex-check', '--json'], 1));
    codes = json.diagnostics.map((item) => item.code);
    assert.equal(codes.includes('warn.jobs.public_main_sync_failed'), true);
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_telemetry_gap'),
        true
    );
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_unconfigured'),
        false
    );
});

test('conflicts y codex-check reportan public_main_sync head drift cuando los heads divergen', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'review' }),
    });
    writeGovernancePolicy(dir, {
        version: 1,
        enforcement: {
            warning_policies: {
                public_main_sync_unconfigured: {
                    enabled: true,
                    severity: 'warning',
                },
                public_main_sync_failed: {
                    enabled: true,
                    severity: 'warning',
                },
                public_main_sync_head_drift: {
                    enabled: true,
                    severity: 'warning',
                },
            },
        },
    });
    writePublicSyncJobsFixture(dir, {
        state: 'failed',
        last_error_message: 'working_tree_dirty',
        current_head: 'abc1234',
        remote_head: 'def5678',
    });

    let json = parseJsonStdout(runCli(dir, ['conflicts', '--json']));
    let codes = json.diagnostics.map((item) => item.code);
    assert.equal(codes.includes('warn.jobs.public_main_sync_failed'), true);
    assert.equal(codes.includes('warn.jobs.public_main_sync_head_drift'), true);
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_unconfigured'),
        false
    );

    json = parseJsonStdout(runCli(dir, ['codex-check', '--json'], 1));
    codes = json.diagnostics.map((item) => item.code);
    assert.equal(codes.includes('warn.jobs.public_main_sync_failed'), true);
    assert.equal(codes.includes('warn.jobs.public_main_sync_head_drift'), true);
    assert.equal(
        codes.includes('warn.jobs.public_main_sync_unconfigured'),
        false
    );
});

test('status expone failure_reason y telemetry_gap para public_main_sync legacy', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'review' }),
    });
    writeGovernancePolicy(dir, {
        version: 1,
        enforcement: {
            warning_policies: {
                public_main_sync_failed: {
                    enabled: true,
                    severity: 'warning',
                },
            },
        },
    });
    writePublicSyncJobsFixture(dir, {
        state: 'failed',
        last_error_message: 'working_tree_dirty',
    });

    const json = parseJsonStdout(runCli(dir, ['status', '--json']));
    assert.equal(
        json.jobs.public_main_sync.failure_reason,
        'working_tree_dirty'
    );
    assert.equal(json.jobs.public_main_sync.telemetry_gap, true);
    assert.equal(json.jobs.public_main_sync.head_drift, false);

    const failed = json.diagnostics.find(
        (item) => item.code === 'warn.jobs.public_main_sync_failed'
    );
    assert.ok(failed);
    assert.match(failed.message, /reason=working_tree_dirty/);
    assert.match(failed.message, /telemetry_gap=true/);

    const telemetryGap = json.diagnostics.find(
        (item) => item.code === 'warn.jobs.public_main_sync_telemetry_gap'
    );
    assert.ok(telemetryGap);
    assert.equal(telemetryGap.meta.failure_reason, 'working_tree_dirty');
    assert.equal(telemetryGap.meta.telemetry_gap, true);
});

test('handoffs create/close escriben eventos append-only en board events', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: boardForConflictFixture({ codexStatus: 'in_progress' }),
        handoffs: baseHandoffs(),
        plan: basePlanWithCodexBlock({ status: 'in_progress' }),
    });

    runCli(dir, [
        'handoffs',
        'create',
        '--from',
        'AG-001',
        '--to',
        'CDX-001',
        '--files',
        'tests/agenda.spec.js',
        '--reason',
        'soporte',
        '--approved-by',
        'ernesto',
    ]);

    let events = readBoardEvents(dir);
    assert.equal(
        events.some((e) => e.event_type === 'handoff_created'),
        true
    );
    assert.equal(
        events.some((e) => e.handoff_id === 'HO-001'),
        true
    );

    runCli(dir, ['handoffs', 'close', 'HO-001', '--reason', 'done']);
    events = readBoardEvents(dir);
    assert.equal(
        events.some((e) => e.event_type === 'handoff_closed'),
        true
    );

    const tail = parseJsonStdout(
        runCli(dir, ['board', 'events', 'tail', '--json'])
    );
    assert.equal(tail.ok, true);
    assert.equal(Array.isArray(tail.events), true);
    assert.equal(
        tail.events.some((e) =>
            /^handoff_(created|closed)$/.test(String(e.event_type || ''))
        ),
        true
    );
});

test('task start y dispatch --json incluyen diagnostics WIP warn-first', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));

    writeFixtureFiles(dir, {
        board: `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Task 1"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: low
    scope: docs
    files: ["docs/a.md"]
    acceptance: "a"
    depends_on: []
    prompt: "a"
    created_at: ${DATE}
    updated_at: ${DATE}
  - id: AG-002
    title: "Task 2"
    owner: ernesto
    executor: codex
    status: ready
    risk: low
    scope: docs
    files: ["docs/b.md"]
    acceptance: "b"
    depends_on: []
    prompt: "b"
    created_at: ${DATE}
    updated_at: ${DATE}
  - id: AG-003
    title: "Task 3"
    owner: ernesto
    executor: codex
    status: ready
    risk: low
    scope: docs
    files: ["docs/c.md"]
    acceptance: "c"
    depends_on: []
    prompt: "c"
    created_at: ${DATE}
    updated_at: ${DATE}
`.trim(),
        handoffs: baseHandoffs(),
        plan: basePlanWithoutCodexBlock(),
    });

    writeGovernancePolicy(dir, {
        version: 1,
        domain_health: {
            priority_domains: ['calendar', 'chat', 'payments'],
            domain_weights: { calendar: 5, chat: 3, payments: 2, default: 1 },
            signal_scores: { GREEN: 100, YELLOW: 60, RED: 0 },
        },
        summary: { thresholds: { domain_score_priority_yellow_below: 80 } },
        enforcement: {
            branch_profiles: { main: { fail_on_red: 'warn' } },
            warning_policies: {
                active_broad_glob: { enabled: true, severity: 'warning' },
                lease_missing_active: { enabled: true, severity: 'warning' },
                lease_expired_active: { enabled: true, severity: 'warning' },
                heartbeat_stale: { enabled: true, severity: 'warning' },
                task_in_progress_stale: { enabled: true, severity: 'warning' },
                task_blocked_stale: { enabled: true, severity: 'warning' },
                done_without_evidence: { enabled: true, severity: 'warning' },
                wip_limit_executor: { enabled: true, severity: 'warning' },
                wip_limit_scope: { enabled: true, severity: 'warning' },
            },
            board_leases: {
                enabled: true,
                required_statuses: ['in_progress', 'review'],
                tracked_statuses: ['in_progress', 'review', 'blocked'],
                ttl_hours_default: 4,
                ttl_hours_max: 24,
                heartbeat_stale_minutes: 30,
                auto_clear_on_terminal: true,
            },
            board_doctor: {
                enabled: true,
                strict_default: false,
                thresholds: {
                    in_progress_stale_hours: 24,
                    blocked_stale_hours: 24,
                    review_stale_hours: 48,
                    done_without_evidence_max_hours: 1,
                },
            },
            wip_limits: {
                enabled: true,
                mode: 'warn',
                count_statuses: ['in_progress', 'review', 'blocked'],
                by_executor: { codex: 1, ci: 2 },
                by_scope: { docs: 1, default: 4 },
            },
        },
    });

    const startJson = parseJsonStdout(
        runCli(dir, ['task', 'start', 'AG-002', '--json'])
    );
    assert.equal(Array.isArray(startJson.diagnostics), true);
    assert.equal(
        startJson.diagnostics.some(
            (d) => d.code === 'warn.board.wip_limit_executor'
        ),
        true
    );

    const dispatchJson = parseJsonStdout(
        runCli(dir, ['dispatch', '--agent', 'codex', '--json'])
    );
    assert.equal(Array.isArray(dispatchJson.diagnostics), true);
    assert.equal(
        dispatchJson.diagnostics.some(
            (d) =>
                d.code === 'warn.board.wip_limit_executor' ||
                d.code === 'warn.board.wip_limit_scope'
        ),
        true
    );
});
