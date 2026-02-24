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
        'jules',
    ]);
    json = parseJsonStdout(result);
    assert.equal(json.filters.active, true);
    assert.equal(json.filters.executor, 'jules');
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
        'kimi',
        '--limit',
        '1',
    ]);
    json = parseJsonStdout(result);
    assert.deepEqual(json.filters.status, ['done']);
    assert.equal(json.filters.executor, 'kimi');
    assert.equal(json.filters.limit, 1);
    assert.equal(json.summary.matched, 1);
    assert.equal(json.summary.returned, 1);
    assert.equal(json.tasks[0].id, 'AG-021');
    assert.equal(json.tasks[0].executor, 'kimi');
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
                            executor: 'jules',
                            weighted_done_points_pct: 100,
                            done_tasks_pct: 100,
                        },
                        {
                            executor: 'kimi',
                            weighted_done_points_pct: 0,
                            done_tasks_pct: 0,
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
    assert.match(result.stdout, /\[GREEN\]\s+#1 kimi/);
    assert.match(result.stdout, /delta \+100pp vs baseline/);
    assert.match(result.stdout, /\[YELLOW\]\s+#2 jules/);
    assert.match(result.stdout, /delta -100pp vs baseline/);
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
    assert.equal(json.plan_block.task_id, 'CDX-001');
    assert.equal(json.board_task_for_plan_block.id, 'CDX-001');
});
