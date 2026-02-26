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
    copyFileSync,
    cpSync,
    rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const DATE = '2026-02-25';

function createFixtureDir() {
    const dir = mkdtempSync(
        join(tmpdir(), 'agent-orchestrator-json-contract-')
    );
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    return dir;
}

function cleanupFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

function writeFixtureFiles(dir) {
    const board = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Fixture task"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: CDX-001
    title: "Codex fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: medium
    scope: codex-governance
    files: ["AGENTS.md", "agent-orchestrator.js"]
    acceptance: "Fixture"
    acceptance_ref: "PLAN_MAESTRO_CODEX_2026.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`;

    const handoffs = `
version: 1
handoffs: []
`;

    const plan = `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: in_progress
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture.
`;

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

function runJson(dir, args) {
    return runJsonExpectStatus(dir, args, 0);
}

function runJsonExpectStatus(dir, args, expectedStatus) {
    return runJsonExpectStatusWithOptions(dir, args, expectedStatus);
}

function runJsonExpectStatusWithOptions(
    dir,
    args,
    expectedStatus,
    options = {}
) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs, '--json'],
        {
            cwd: dir,
            encoding: 'utf8',
            env: options.env ? { ...process.env, ...options.env } : undefined,
        }
    );

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')} --json (expected ${expectedStatus})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(String(result.stdout || ''));
    });
    return parsed;
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

function assertTaskJsonShape(task) {
    assert.equal(typeof task, 'object');
    assert.equal(typeof task.id, 'string');
    assert.equal(typeof task.title, 'string');
    assert.equal(typeof task.owner, 'string');
    assert.equal(typeof task.executor, 'string');
    assert.equal(typeof task.status, 'string');
    assert.equal(typeof task.risk, 'string');
    assert.equal(typeof task.scope, 'string');
    assert.equal(Array.isArray(task.files), true);
}

function assertTaskFullJsonShape(task) {
    assertTaskJsonShape(task);
    assert.equal(typeof task.acceptance, 'string');
    assert.equal(typeof task.acceptance_ref, 'string');
    assert.equal(Array.isArray(task.depends_on), true);
    assert.equal(typeof task.prompt, 'string');
    assert.equal(typeof task.created_at, 'string');
    assert.equal(typeof task.updated_at, 'string');
}

function assertVersionLike(value) {
    const t = typeof value;
    assert.equal(t === 'number' || t === 'string', true);
}

test('JSON contract minimo estable para status/conflicts/handoffs/codex-check/leases/board doctor', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const status = runJson(dir, ['status']);
        assertVersionLike(status.version);
        assert.equal(typeof status.totals, 'object');
        assert.equal(typeof status.contribution, 'object');
        assert.equal(typeof status.domain_health, 'object');
        assert.equal(typeof status.conflicts, 'number');
        assert.equal(Array.isArray(status.diagnostics), true);
        assert.equal(typeof status.warnings_count, 'number');
        assert.equal(typeof status.errors_count, 'number');

        const conflicts = runJson(dir, ['conflicts', '--strict']);
        assertVersionLike(conflicts.version);
        assert.equal(typeof conflicts.strict, 'boolean');
        assert.equal(typeof conflicts.totals, 'object');
        assert.equal(Array.isArray(conflicts.conflicts), true);
        assert.equal(Array.isArray(conflicts.diagnostics), true);

        const handoffsStatus = runJson(dir, ['handoffs', 'status']);
        assertVersionLike(handoffsStatus.version);
        assert.equal(typeof handoffsStatus.summary, 'object');
        assert.equal(Array.isArray(handoffsStatus.handoffs), true);
        assert.equal(Array.isArray(handoffsStatus.diagnostics), true);

        const handoffsLint = runJson(dir, ['handoffs', 'lint']);
        assert.equal(typeof handoffsLint.ok, 'boolean');
        assert.equal(typeof handoffsLint.error_count, 'number');
        assert.equal(Array.isArray(handoffsLint.errors), true);
        assert.equal(Array.isArray(handoffsLint.diagnostics), true);

        const codexCheck = runJson(dir, ['codex-check']);
        assertVersionLike(codexCheck.version);
        assert.equal(typeof codexCheck.ok, 'boolean');
        assert.equal(typeof codexCheck.error_count, 'number');
        assert.equal(Array.isArray(codexCheck.errors), true);
        assert.equal(typeof codexCheck.summary, 'object');
        assert.equal(Array.isArray(codexCheck.codex_task_ids), true);
        assert.equal(Array.isArray(codexCheck.diagnostics), true);

        const leasesStatus = runJson(dir, ['leases', 'status']);
        assertVersionLike(leasesStatus.version);
        assert.equal(typeof leasesStatus.summary, 'object');
        assert.equal(Array.isArray(leasesStatus.leases), true);
        assert.equal(Array.isArray(leasesStatus.diagnostics), true);
        assert.equal(typeof leasesStatus.warnings_count, 'number');
        assert.equal(typeof leasesStatus.errors_count, 'number');

        const boardDoctor = runJson(dir, ['board', 'doctor']);
        assertVersionLike(boardDoctor.version);
        assert.equal(typeof boardDoctor.command, 'string');
        assert.equal(boardDoctor.command, 'board doctor');
        assert.equal(typeof boardDoctor.summary, 'object');
        assert.equal(Array.isArray(boardDoctor.checks), true);
        assert.equal(Array.isArray(boardDoctor.diagnostics), true);
        assert.equal(typeof boardDoctor.warnings_count, 'number');
        assert.equal(typeof boardDoctor.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de handoffs lint y policy lint', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_HANDOFFS.yaml'),
            `version: 1
handoffs:
  - id: HO-001
    status: active
    from_task: AG-001
    to_task: CDX-001
    reason: fixture_invalid
    files: ["*"]
    approved_by: ernesto
    created_at: 2026-02-25T10:00:00.000Z
    expires_at: 2026-02-25T14:00:00.000Z
`,
            'utf8'
        );

        const handoffsLint = runJsonExpectStatus(dir, ['handoffs', 'lint'], 1);
        assertVersionLike(handoffsLint.version);
        assert.equal(handoffsLint.ok, false);
        assert.equal(typeof handoffsLint.error_count, 'number');
        assert.equal(handoffsLint.error_count > 0, true);
        assert.equal(Array.isArray(handoffsLint.errors), true);
        assert.equal(Array.isArray(handoffsLint.diagnostics), true);
        assert.equal(typeof handoffsLint.warnings_count, 'number');
        assert.equal(typeof handoffsLint.errors_count, 'number');

        writeFileSync(
            join(dir, 'governance-policy.json'),
            JSON.stringify(
                {
                    version: 1,
                    domain_health: {
                        priority_domains: ['calendar'],
                        domain_weights: { default: -1 },
                        signal_scores: { GREEN: 100, YELLOW: 60, RED: 0 },
                    },
                    summary: {
                        thresholds: { domain_score_priority_yellow_below: 80 },
                    },
                },
                null,
                2
            ),
            'utf8'
        );

        const policyLint = runJsonExpectStatus(dir, ['policy', 'lint'], 1);
        assertVersionLike(policyLint.version);
        assert.equal(policyLint.ok, false);
        assert.equal(typeof policyLint.error_count, 'number');
        assert.equal(policyLint.error_count > 0, true);
        assert.equal(Array.isArray(policyLint.errors), true);
        assert.equal(Array.isArray(policyLint.warnings), true);
        assert.equal(Array.isArray(policyLint.diagnostics), true);
        assert.equal(typeof policyLint.source, 'object');
        assert.equal(typeof policyLint.source.path, 'string');
        assert.equal(typeof policyLint.source.exists, 'boolean');
        assert.equal(typeof policyLint.warnings_count, 'number');
        assert.equal(typeof policyLint.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de conflicts --strict y codex-check', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Conflict fixture"
    owner: ernesto
    executor: jules
    status: in_progress
    risk: low
    scope: docs
    files: ["AGENTS.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: CDX-001
    title: "Codex fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: medium
    scope: codex-governance
    files: ["AGENTS.md", "agent-orchestrator.js"]
    acceptance: "Fixture"
    acceptance_ref: "PLAN_MAESTRO_CODEX_2026.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );

        const conflicts = runJsonExpectStatus(
            dir,
            ['conflicts', '--strict'],
            1
        );
        assertVersionLike(conflicts.version);
        assert.equal(conflicts.strict, true);
        assert.equal(typeof conflicts.totals, 'object');
        assert.equal(Array.isArray(conflicts.conflicts), true);
        assert.equal(conflicts.conflicts.length > 0, true);
        assert.equal(Array.isArray(conflicts.diagnostics), true);
        assert.equal(typeof conflicts.warnings_count, 'number');
        assert.equal(typeof conflicts.errors_count, 'number');

        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: review
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: ${DATE}
-->

Fixture con drift.
`,
            'utf8'
        );

        const codexCheck = runJsonExpectStatus(dir, ['codex-check'], 1);
        assertVersionLike(codexCheck.version);
        assert.equal(codexCheck.ok, false);
        assert.equal(typeof codexCheck.error_count, 'number');
        assert.equal(codexCheck.error_count > 0, true);
        assert.equal(Array.isArray(codexCheck.errors), true);
        assert.equal(typeof codexCheck.summary, 'object');
        assert.equal(Array.isArray(codexCheck.codex_task_ids), true);
        assert.equal(Array.isArray(codexCheck.diagnostics), true);
        assert.equal(typeof codexCheck.warnings_count, 'number');
        assert.equal(typeof codexCheck.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de intake/dispatch/reconcile', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const intake = runJsonExpectStatus(
            dir,
            ['intake', '--strict', '--no-write', '--repo', 'invalid'],
            1
        );
        assertVersionLike(intake.version);
        assert.equal(intake.command, 'intake');
        assert.equal(intake.ok, false);
        assert.equal(typeof intake.error, 'string');
        assert.equal(intake.error_code, 'invalid_repository');
        assert.equal(intake.repository, 'invalid');

        const dispatch = runJsonExpectStatus(dir, ['dispatch'], 1);
        assertVersionLike(dispatch.version);
        assert.equal(dispatch.command, 'dispatch');
        assert.equal(dispatch.ok, false);
        assert.equal(typeof dispatch.error, 'string');
        assert.equal(dispatch.error_code, 'invalid_agent');

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Done without evidence"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals: []
`,
            'utf8'
        );

        const reconcile = runJsonExpectStatus(
            dir,
            ['reconcile', '--strict'],
            1
        );
        assertVersionLike(reconcile.version);
        assert.equal(reconcile.command, 'reconcile');
        assert.equal(reconcile.ok, false);
        assert.equal(typeof reconcile.error, 'string');
        assert.equal(reconcile.error_code, 'done_without_evidence');
        assert.equal(Array.isArray(reconcile.done_without_evidence), true);
        assert.equal(reconcile.done_without_evidence.includes('AG-001'), true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de stale/budget/score', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Dormant fixture"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals:
  - id: SIG-001
    fingerprint: "fixture-critical-stale"
    source: manual
    source_ref: "fixture"
    title: "Critical fixture signal"
    severity: high
    critical: true
    status: open
    runtime_impact: high
    url: ""
    detected_at: "${DATE}T00:00:00.000Z"
    updated_at: "${DATE}T00:00:00.000Z"
    labels: ["fixture"]
`,
            'utf8'
        );

        const stale = runJsonExpectStatus(dir, ['stale', '--strict'], 1);
        assertVersionLike(stale.version);
        assert.equal(stale.command, 'stale');
        assert.equal(stale.ok, false);
        assert.equal(typeof stale.counts, 'object');
        assert.equal(Array.isArray(stale.invalid_reasons), true);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Budget fixture"
    owner: ernesto
    executor: jules
    status: in_progress
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    attempts: 3
    last_attempt_at: "${DATE}T10:00:00.000Z"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals: []
`,
            'utf8'
        );

        const budget = runJsonExpectStatusWithOptions(
            dir,
            ['budget', '--strict', '--agent', 'jules'],
            0,
            { env: { JULES_DAILY_LIMIT: '0' } }
        );
        assertVersionLike(budget.version);
        assert.equal(budget.command, 'budget');
        assert.equal(budget.ok, true);
        assert.equal(Array.isArray(budget.exceeded), true);
        assert.equal(budget.exceeded.includes('jules'), false);
        assert.equal(typeof budget.usage, 'object');
        assert.equal(typeof budget.remaining, 'object');
        assert.equal(budget.remaining.jules, 0);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Score invalid fixture"
    owner: ernesto
    executor: jules
    status: invalid_status
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        const score = runJsonExpectStatus(dir, ['score'], 1);
        assertVersionLike(score.version);
        assert.equal(score.command, 'score');
        assert.equal(score.ok, false);
        assert.equal(typeof score.error, 'string');
        assert.equal(score.error_code, 'score_failed');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para board_revision_mismatch (--expect-rev)', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const taskClaim = runJsonExpectStatus(
            dir,
            ['task', 'claim', 'AG-001', '--owner', 'otro', '--expect-rev', '9'],
            1
        );
        assertVersionLike(taskClaim.version);
        assert.equal(taskClaim.ok, false);
        assert.equal(taskClaim.command, 'task');
        assert.equal(taskClaim.action, 'claim');
        assert.equal(taskClaim.error_code, 'board_revision_mismatch');
        assert.equal(typeof taskClaim.expected_revision, 'number');
        assert.equal(typeof taskClaim.actual_revision, 'number');

        const leasesHeartbeat = runJsonExpectStatus(
            dir,
            [
                'leases',
                'heartbeat',
                'CDX-001',
                '--ttl-hours',
                '1',
                '--expect-rev',
                '9',
            ],
            1
        );
        assertVersionLike(leasesHeartbeat.version);
        assert.equal(leasesHeartbeat.ok, false);
        assert.equal(leasesHeartbeat.command, 'leases');
        assert.equal(leasesHeartbeat.action, 'heartbeat');
        assert.equal(leasesHeartbeat.error_code, 'board_revision_mismatch');
        assert.equal(typeof leasesHeartbeat.expected_revision, 'number');
        assert.equal(typeof leasesHeartbeat.actual_revision, 'number');

        const handoffClose = runJsonExpectStatus(
            dir,
            ['handoffs', 'close', 'HO-999', '--expect-rev', '9'],
            1
        );
        assertVersionLike(handoffClose.version);
        assert.equal(handoffClose.ok, false);
        assert.equal(handoffClose.command, 'handoffs');
        assert.equal(handoffClose.error_code, 'board_revision_mismatch');
        assert.equal(typeof handoffClose.expected_revision, 'number');
        assert.equal(typeof handoffClose.actual_revision, 'number');

        const evidenceDir = join(dir, 'verification', 'agent-runs');
        mkdirSync(evidenceDir, { recursive: true });
        writeFileSync(
            join(evidenceDir, 'AG-001.md'),
            '# AG-001 fixture evidence\n',
            'utf8'
        );
        const closeCmd = runJsonExpectStatus(
            dir,
            [
                'close',
                'AG-001',
                '--evidence',
                'verification/agent-runs/AG-001.md',
                '--expect-rev',
                '9',
            ],
            1
        );
        assertVersionLike(closeCmd.version);
        assert.equal(closeCmd.ok, false);
        assert.equal(closeCmd.command, 'close');
        assert.equal(closeCmd.error_code, 'board_revision_mismatch');
        assert.equal(typeof closeCmd.expected_revision, 'number');
        assert.equal(typeof closeCmd.actual_revision, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para board doctor --strict (falla con payload JSON)', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const boardDoctor = runJsonExpectStatus(
            dir,
            ['board', 'doctor', '--strict'],
            1
        );
        assertVersionLike(boardDoctor.version);
        assert.equal(boardDoctor.command, 'board doctor');
        assert.equal(Array.isArray(boardDoctor.checks), true);
        assert.equal(Array.isArray(boardDoctor.diagnostics), true);
        assert.equal(boardDoctor.diagnostics.length > 0, true);
        assert.equal(typeof boardDoctor.warnings_count, 'number');
        assert.equal(typeof boardDoctor.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para metrics --json', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const metrics = runJson(dir, ['metrics', '--profile', 'local']);
        assertVersionLike(metrics.version);
        assert.equal(typeof metrics.period, 'object');
        assert.equal(typeof metrics.targets, 'object');
        assert.equal(typeof metrics.baseline, 'object');
        assert.equal(typeof metrics.current, 'object');
        assert.equal(typeof metrics.delta, 'object');
        assert.equal(typeof metrics.contribution, 'object');
        assert.equal(typeof metrics.baseline_contribution, 'object');
        assert.equal(typeof metrics.contribution_delta, 'object');
        assert.equal(typeof metrics.domain_health, 'object');
        assert.equal(typeof metrics.domain_health_history, 'object');
        assert.equal(typeof metrics.io, 'object');
        assert.equal(typeof metrics.io.profile, 'string');
        assert.equal(typeof metrics.io.write_mode, 'string');
        assert.equal(typeof metrics.io.persisted, 'boolean');
        assert.equal(Array.isArray(metrics.io.output_files), true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para metrics baseline show/set/reset', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const seeded = runJson(dir, ['metrics', '--profile', 'ci']);
        assertVersionLike(seeded.version);

        const show = runJson(dir, ['metrics', 'baseline', 'show']);
        assertVersionLike(show.version);
        assert.equal(show.ok, true);
        assert.equal(show.action, 'show');
        assert.equal(typeof show.metrics_path, 'string');
        assert.equal(typeof show.baseline, 'object');
        assert.equal(typeof show.baseline_contribution, 'object');

        const set = runJson(dir, [
            'metrics',
            'baseline',
            'set',
            '--from',
            'current',
        ]);
        assertVersionLike(set.version);
        assert.equal(set.ok, true);
        assert.equal(set.action, 'set');
        assert.equal(set.source, 'current');
        assert.equal(typeof set.baseline, 'object');
        assert.equal(typeof set.baseline_meta, 'object');
        assert.equal(typeof set.delta, 'object');

        const reset = runJson(dir, [
            'metrics',
            'baseline',
            'reset',
            '--from',
            'current',
        ]);
        assertVersionLike(reset.version);
        assert.equal(reset.ok, true);
        assert.equal(reset.action, 'reset');
        assert.equal(reset.source, 'current');
        assert.equal(typeof reset.baseline, 'object');
        assert.equal(typeof reset.baseline_meta, 'object');
        assert.equal(typeof reset.delta, 'object');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para task ls/create/claim/start/finish', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const listBefore = runJson(dir, ['task', 'ls']);
        assertVersionLike(listBefore.version);
        assert.equal(typeof listBefore.command, 'string');
        assert.equal(typeof listBefore.action, 'string');
        assert.equal(typeof listBefore.summary, 'object');
        assert.equal(Array.isArray(listBefore.tasks), true);

        const created = runJson(dir, [
            'task',
            'create',
            '--title',
            'Task contrato JSON',
            '--executor',
            'kimi',
            '--files',
            'docs/contract-json.md',
            '--scope',
            'docs',
            '--risk',
            'low',
            '--status',
            'backlog',
        ]);
        assertVersionLike(created.version);
        assert.equal(created.action, 'create');
        assert.equal(typeof created.persisted, 'boolean');
        assert.equal(created.persisted, true);
        assertTaskJsonShape(created.task);
        assertTaskFullJsonShape(created.task_full);
        const taskId = created.task.id;
        assert.match(taskId, /^AG-\d+$/);

        const claimed = runJson(dir, [
            'task',
            'claim',
            taskId,
            '--owner',
            'ernesto',
        ]);
        assertVersionLike(claimed.version);
        assert.equal(claimed.action, 'claim');
        assertTaskJsonShape(claimed.task);
        assert.equal(claimed.task.id, taskId);

        const started = runJson(dir, [
            'task',
            'start',
            taskId,
            '--status',
            'in_progress',
        ]);
        assertVersionLike(started.version);
        assert.equal(started.action, 'start');
        assertTaskJsonShape(started.task);
        assert.equal(started.task.id, taskId);

        const evidenceDir = join(dir, 'verification', 'agent-runs');
        mkdirSync(evidenceDir, { recursive: true });
        const evidenceRel = `verification/agent-runs/${taskId}.md`;
        writeFileSync(join(dir, evidenceRel), `# ${taskId}\n`, 'utf8');

        const finished = runJson(dir, [
            'task',
            'finish',
            taskId,
            '--evidence',
            evidenceRel,
        ]);
        assertVersionLike(finished.version);
        assert.equal(finished.action, 'finish');
        assertTaskJsonShape(finished.task);
        assert.equal(typeof finished.evidence_path, 'string');
        assert.match(finished.evidence_path, new RegExp(`${taskId}\\.md$`));

        const listAfter = runJson(dir, ['task', 'ls', '--id', taskId]);
        assertVersionLike(listAfter.version);
        assert.equal(Array.isArray(listAfter.tasks), true);
        assert.equal(listAfter.tasks.length, 1);
        assertTaskJsonShape(listAfter.tasks[0]);
        assert.equal(listAfter.tasks[0].id, taskId);
    } finally {
        cleanupFixtureDir(dir);
    }
});
