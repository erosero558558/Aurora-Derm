#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
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
        0,
        `Unexpected exit for ${args.join(' ')} --json\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(String(result.stdout || ''));
    });
    return parsed;
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
