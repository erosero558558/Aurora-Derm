#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    writeFileSync,
    readFileSync,
    copyFileSync,
    rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const DATE = '2026-02-24';

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-orchestrator-test-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
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

function runCli(dir, args, expectedStatus = 0) {
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...args],
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
        `Unexpected exit for ${args.join(' ')}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    return result;
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
    executor: jules
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
    executor: jules
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
    executor: jules
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
    executor: jules
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
    executor: kimi
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
        'jules',
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

    // `task` ops should also keep derived queues in sync for non-codex executors.
    assert.equal(
        typeof readFileSync(join(dir, 'JULES_TASKS.md'), 'utf8'),
        'string'
    );
    assert.equal(
        typeof readFileSync(join(dir, 'KIMI_TASKS.md'), 'utf8'),
        'string'
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
    assert.equal(json.current.file_conflicts, 1);
    assert.equal(json.current.file_conflicts_handoff, 0);
    assert.equal(typeof json.baseline.file_conflicts_handoff, 'number');
    assert.equal(typeof json.delta.file_conflicts, 'number');
    assert.equal(typeof json.delta.file_conflicts_handoff, 'number');

    const written = readMetrics(dir);
    assert.equal(written.current.file_conflicts, 1);
    assert.equal(written.current.file_conflicts_handoff, 0);
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
    assert.equal(json.plan_block.task_id, 'CDX-001');
    assert.equal(json.board_task_for_plan_block.id, 'CDX-001');
});
