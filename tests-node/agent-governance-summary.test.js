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
    existsSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const SUMMARY_SCRIPT = join(REPO_ROOT, 'bin', 'agent-governance-summary.js');
const DATE = '2026-02-24';

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-governance-summary-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
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
    assert.equal(parsed.status.totals.tasks, 2);
    assert.equal(parsed.conflicts.totals.blocking, 0);
    assert.equal(parsed.handoffs.lint.ok, true);
    assert.equal(parsed.codex_check.ok, true);
    assert.equal(parsed.metrics.version, 1);
    assert.ok(parsed.contribution);
    assert.ok(Array.isArray(parsed.contribution.ranking));
    assert.ok(parsed.contribution.top_executor);
    assert.equal(
        typeof parsed.delta_summary.conflicts_blocking.delta,
        'number'
    );
    assert.equal(typeof parsed.delta_summary.conflicts_handoff.delta, 'number');
    assert.equal(parsed.commands.status.exit_code, 0);
    assert.equal(parsed.commands.metrics.exit_code, 0);

    const jsonPath = join(dir, outJson);
    const mdPath = join(dir, outMd);
    assert.equal(existsSync(jsonPath), true);
    assert.equal(existsSync(mdPath), true);

    const writtenJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const writtenMd = readFileSync(mdPath, 'utf8');
    assert.equal(writtenJson.version, 1);
    assert.match(writtenMd, /^## Agent Governance Summary/m);
    assert.match(writtenMd, /Overall:\s+OK/);
    assert.match(writtenMd, /Semaforo:\s+`GREEN`/);
    assert.match(writtenMd, /Razones:\s+`stable`/);
    assert.match(writtenMd, /Delta vs Baseline \(Conflicts\/Handoffs\)/);
    assert.match(writtenMd, /Aporte Por Agente/);
    assert.match(writtenMd, /\[GREEN\].*jules|\[GREEN\].*codex/);
});
