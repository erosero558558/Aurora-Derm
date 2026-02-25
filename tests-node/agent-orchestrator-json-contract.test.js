#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
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
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...args, '--json'],
        {
            cwd: dir,
            encoding: 'utf8',
        }
    );

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${args.join(' ')} --json (expected ${expectedStatus})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(String(result.stdout || ''));
    });
    return parsed;
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

test('JSON contract minimo estable para status/conflicts/handoffs/codex-check', () => {
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
