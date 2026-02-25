#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    writeFileSync,
    readFileSync,
    copyFileSync,
    cpSync,
    rmSync,
    existsSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const SUMMARY_SCRIPT = join(REPO_ROOT, 'bin', 'agent-governance-summary.js');
const DATE = '2026-02-24';

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-governance-summary-'));
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

function writeFixtureFilesWithChatFailure(dir) {
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

  - id: AG-002
    title: "Chat failure fixture"
    owner: ernesto
    executor: kimi
    status: failed
    risk: high
    scope: chat
    files: ["src/apps/chat/engine.js"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-002.md"
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

function runSummary(dir, args = []) {
    const result = spawnSync(
        process.execPath,
        [SUMMARY_SCRIPT, '--root', dir, ...args],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    if (result.error) throw result.error;
    return result;
}

function assertSummaryJsonContractShape(parsed) {
    assert.equal(typeof parsed, 'object');
    assert.equal(parsed.version, 1);

    assert.equal(typeof parsed.overall, 'object');
    assert.equal(typeof parsed.overall.ok, 'boolean');
    assert.equal(typeof parsed.overall.signal, 'string');
    assert.equal(Array.isArray(parsed.overall.reasons), true);
    assert.equal(Array.isArray(parsed.overall.blockers), true);

    assert.equal(typeof parsed.policies, 'object');
    assert.equal(typeof parsed.policies.strict, 'object');
    assert.equal(typeof parsed.policies.strict.pass, 'boolean');
    assert.equal(typeof parsed.policies.strict.reason, 'string');
    assert.equal(typeof parsed.policies.fail_on_red, 'object');
    assert.equal(typeof parsed.policies.fail_on_red.pass, 'boolean');
    assert.equal(typeof parsed.policies.fail_on_red.reason, 'string');

    assert.equal(typeof parsed.delta_summary, 'object');
    assert.equal(typeof parsed.delta_summary.conflicts_blocking, 'object');
    assert.equal(
        typeof parsed.delta_summary.conflicts_blocking.delta,
        'number'
    );
    assert.equal(typeof parsed.delta_summary.conflicts_handoff, 'object');
    assert.equal(typeof parsed.delta_summary.conflicts_handoff.delta, 'number');

    assert.equal(Array.isArray(parsed.diagnostics), true);
    assert.equal(typeof parsed.warnings_count, 'number');
    assert.equal(typeof parsed.errors_count, 'number');

    assert.equal(typeof parsed.commands, 'object');
    for (const key of [
        'status',
        'conflicts',
        'handoffsStatus',
        'handoffsLint',
        'policy',
        'codexCheck',
        'metrics',
    ]) {
        assert.equal(typeof parsed.commands[key], 'object');
        assert.equal(typeof parsed.commands[key].exit_code, 'number');
        assert.equal(typeof parsed.commands[key].command, 'string');
    }

    assert.equal(typeof parsed.status, 'object');
    assert.equal(typeof parsed.conflicts, 'object');
    assert.equal(typeof parsed.handoffs, 'object');
    assert.equal(typeof parsed.handoffs.status, 'object');
    assert.equal(typeof parsed.handoffs.lint, 'object');
    assert.equal(typeof parsed.policy, 'object');
    assert.equal(typeof parsed.codex_check, 'object');
    assert.equal(typeof parsed.metrics, 'object');
    assert.equal(typeof parsed.domain_health, 'object');
    assert.equal(typeof parsed.contribution, 'object');
}

test('agent-governance-summary genera JSON/Markdown y escribe artefactos', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const outJson = 'verification/agent-governance-summary.json';
    const outMd = 'verification/agent-governance-summary.md';
    const result = runSummary(dir, [
        '--format',
        'json',
        '--write-json',
        outJson,
        '--write-md',
        outMd,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'GREEN');
    assert.equal(Array.isArray(parsed.overall.reasons), true);
    assert.match(parsed.overall.reasons.join(' | '), /stable/i);
    assert.equal(typeof parsed.overall.domain_weighted_score_pct, 'number');
    assert.equal(
        typeof parsed.overall.domain_weighted_score_global_pct,
        'number'
    );
    assert.equal(
        typeof parsed.overall.domain_regression_green_to_red,
        'number'
    );
    assert.ok(parsed.policies);
    assert.equal(parsed.policies.strict.pass, true);
    assert.equal(parsed.policies.fail_on_red.pass, true);
    assert.equal(parsed.status.totals.tasks, 2);
    assert.equal(parsed.conflicts.totals.blocking, 0);
    assert.equal(parsed.handoffs.lint.ok, true);
    assert.equal(parsed.policy.ok, true);
    assert.equal(parsed.codex_check.ok, true);
    assert.equal(parsed.metrics.version, 1);
    assert.ok(parsed.contribution);
    assert.ok(parsed.domain_health);
    assert.ok(parsed.contribution_history);
    assert.ok(parsed.domain_health_history);
    assert.equal(Array.isArray(parsed.domain_health.ranking), true);
    assert.equal(Array.isArray(parsed.contribution_history.daily), true);
    assert.equal(Array.isArray(parsed.domain_health_history.daily), true);
    assert.ok(Array.isArray(parsed.contribution.ranking));
    assert.ok(parsed.contribution.top_executor);
    assert.equal(
        typeof parsed.delta_summary.conflicts_blocking.delta,
        'number'
    );
    assert.equal(typeof parsed.delta_summary.conflicts_handoff.delta, 'number');
    assert.equal(Array.isArray(parsed.diagnostics), true);
    assert.equal(typeof parsed.warnings_count, 'number');
    assert.equal(typeof parsed.errors_count, 'number');
    assert.equal(parsed.commands.status.exit_code, 0);
    assert.equal(parsed.commands.policy.exit_code, 0);
    assert.equal(parsed.commands.metrics.exit_code, 0);
    assert.match(
        parsed.commands.metrics.command,
        /metrics --json --profile local/
    );

    const jsonPath = join(dir, outJson);
    const mdPath = join(dir, outMd);
    const metricsPath = join(dir, 'verification', 'agent-metrics.json');
    assert.equal(existsSync(jsonPath), true);
    assert.equal(existsSync(mdPath), true);
    assert.equal(existsSync(metricsPath), false);

    const writtenJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const writtenMd = readFileSync(mdPath, 'utf8');
    assert.equal(writtenJson.version, 1);
    assert.match(writtenMd, /^## Agent Governance Summary/m);
    assert.match(writtenMd, /Overall:\s+OK/);
    assert.match(writtenMd, /Semaforo:\s+`GREEN`/);
    assert.match(writtenMd, /Score salud dominios \(priority\):/);
    assert.match(writtenMd, /Regresiones dominio GREEN->RED:/);
    assert.match(writtenMd, /Razones:\s+`stable`/);
    assert.match(writtenMd, /Politicas:\s+strict=PASS/);
    assert.match(writtenMd, /Diagnostics warn-first:/);
    assert.match(writtenMd, /Delta vs Baseline \(Conflicts\/Handoffs\)/);
    assert.match(writtenMd, /Semaforo Por Dominio/);
    assert.match(writtenMd, /Historico Salud por Dominio/);
    assert.match(writtenMd, /Aporte Por Agente/);
    assert.match(writtenMd, /Historico Aporte/);
    assert.match(writtenMd, /Warn-first Diagnostics/);
    assert.match(writtenMd, /\[GREEN\].*jules|\[GREEN\].*codex/);
});

test('agent-governance-summary mantiene contrato JSON minimo estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const parsed = JSON.parse(result.stdout);
    assertSummaryJsonContractShape(parsed);
});

test('agent-governance-summary alerta regresion de dominio GREEN->RED en PR summary', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            {
                                domain: 'calendar',
                                signal: 'GREEN',
                                tasks_total: 0,
                                active_tasks: 0,
                                done_tasks: 0,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                            {
                                domain: 'chat',
                                signal: 'GREEN',
                                tasks_total: 1,
                                active_tasks: 0,
                                done_tasks: 1,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                            {
                                domain: 'payments',
                                signal: 'GREEN',
                                tasks_total: 0,
                                active_tasks: 0,
                                done_tasks: 0,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'RED');
    assert.ok(parsed.overall.domain_regression_green_to_red >= 1);
    assert.equal(parsed.policies.strict.pass, true);
    assert.equal(parsed.policies.fail_on_red.pass, false);
    assert.ok(parsed.domain_health_history);
    assert.ok(parsed.domain_health_history.regressions);
    assert.ok(
        parsed.domain_health_history.regressions.green_to_red.some(
            (row) => row.domain === 'chat'
        )
    );

    const md = runSummary(dir, ['--format', 'markdown']).stdout;
    assert.match(md, /Alertas de Regresion de Dominio/);
    assert.match(md, /`chat`: `GREEN` -> `RED`/);
});

test('agent-governance-summary soporta --explain-red en JSON y Markdown', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    let result = runSummary(dir, ['--format', 'json', '--explain-red']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.ok(parsed.red_explanation);
    assert.equal(parsed.red_explanation.signal, 'RED');
    assert.ok(Array.isArray(parsed.red_explanation.blockers));
    assert.ok(
        Array.isArray(parsed.red_explanation.domain_regression_green_to_red)
    );
    assert.equal(
        parsed.red_explanation.domain_regression_green_to_red.length >= 1,
        true
    );

    result = runSummary(dir, ['--format', 'markdown', '--explain-red']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /### Explain RED/);
    assert.match(result.stdout, /Signal:\s+`RED`/);
    assert.match(result.stdout, /Regresiones GREEN->RED:/);
});

test('agent-governance-summary lee governance-policy.json para umbral de semaforo', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    writeFileSync(
        join(dir, 'governance-policy.json'),
        `${JSON.stringify(
            {
                version: 1,
                summary: {
                    thresholds: {
                        domain_score_priority_yellow_below: 101,
                    },
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.overall.signal, 'YELLOW');
    assert.ok(
        parsed.overall.reasons.some((reason) =>
            String(reason).startsWith('domain_score_priority:')
        )
    );
});

test('agent-governance-summary soporta --profile ci y persiste metrics runtime', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const result = runSummary(dir, ['--format', 'json', '--profile', 'ci']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.match(
        parsed.commands.metrics.command,
        /metrics --json --profile ci/
    );
    assert.equal(parsed.metrics?.io?.profile, 'ci');
    assert.equal(parsed.metrics?.io?.persisted, true);
    assert.equal(
        existsSync(join(dir, 'verification', 'agent-metrics.json')),
        true
    );
});

test('agent-governance-summary soporta --strict y --fail-on-red con politicas distintas', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    let result = runSummary(dir, ['--format', 'json', '--strict']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'RED');

    result = runSummary(dir, ['--format', 'json', '--fail-on-red']);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    parsed = JSON.parse(result.stdout);
    assert.equal(parsed.overall.signal, 'RED');
});

test('agent-governance-summary soporta --from-json y --policy-check', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const outJson = 'verification/agent-governance-summary.json';
    const build = runSummary(dir, [
        '--format',
        'json',
        '--write-json',
        outJson,
    ]);
    assert.equal(build.status, 0, build.stderr || build.stdout);

    let result = runSummary(dir, [
        '--from-json',
        outJson,
        '--format',
        'json',
        '--policy-check',
        'strict',
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.ok(parsed.policies);
    assert.equal(parsed.policies.strict.pass, true);

    result = runSummary(dir, [
        '--from-json',
        outJson,
        '--format',
        'json',
        '--policy-check',
        'fail_on_red',
    ]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    parsed = JSON.parse(result.stdout);
    assert.equal(parsed.policies.fail_on_red.pass, false);
});
