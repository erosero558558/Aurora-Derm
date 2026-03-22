#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    copyFileSync,
    readFileSync,
    cpSync,
    existsSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const GITIGNORE_SOURCE = join(REPO_ROOT, '.gitignore');
const WORKSPACE_HYGIENE_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'workspace-hygiene.js'
);
const GENERATED_SITE_ROOT_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'generated-site-root.js'
);
const CLEAN_LOCAL_ARTIFACTS_SOURCE = join(
    REPO_ROOT,
    'bin',
    'clean-local-artifacts.js'
);
const WORKSPACE_WATCHER_SCRIPT_SOURCE = join(
    REPO_ROOT,
    'scripts',
    'ops',
    'codex',
    'RUN-CODEX-WORKSPACE-SYNC.ps1'
);

function runGit(dir, args) {
    const result = spawnSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
    });
    assert.equal(
        result.status,
        0,
        `git ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return result;
}

function createCliFixture() {
    const dir = mkdtempSync(join(tmpdir(), 'workspace-command-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    copyFileSync(GITIGNORE_SOURCE, join(dir, '.gitignore'));
    writeFileSync(
        join(dir, '.gitignore'),
        `${readFileSync(join(dir, '.gitignore'), 'utf8').trimEnd()}\n.origin.git/\n`,
        'utf8'
    );
    mkdirSync(join(dir, 'bin', 'lib'), { recursive: true });
    mkdirSync(join(dir, 'scripts', 'ops', 'codex'), { recursive: true });
    copyFileSync(
        WORKSPACE_HYGIENE_SOURCE,
        join(dir, 'bin', 'lib', 'workspace-hygiene.js')
    );
    copyFileSync(
        GENERATED_SITE_ROOT_SOURCE,
        join(dir, 'bin', 'lib', 'generated-site-root.js')
    );
    copyFileSync(
        CLEAN_LOCAL_ARTIFACTS_SOURCE,
        join(dir, 'bin', 'clean-local-artifacts.js')
    );
    copyFileSync(
        WORKSPACE_WATCHER_SCRIPT_SOURCE,
        join(dir, 'scripts', 'ops', 'codex', 'RUN-CODEX-WORKSPACE-SYNC.ps1')
    );

    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
        join(dir, 'AGENT_BOARD.yaml'),
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: 0
  updated_at: "2026-03-22"
tasks:
  - id: CDX-001
    title: "Workspace CLI fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: low
    scope: docs
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    provider_mode: ""
    runtime_surface: ""
    runtime_transport: ""
    runtime_last_transport: ""
    model_tier_default: "gpt-5.4-mini"
    premium_budget: 0
    premium_calls_used: 0
    premium_gate_state: "closed"
    decision_packet_ref: ""
    model_policy_version: "2026-03-17-codex-model-routing-v2"
    files: ["docs/task.md"]
    acceptance: "Workspace CLI fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Workspace CLI fixture"
    created_at: "2026-03-22"
    updated_at: "2026-03-22"
`,
        'utf8'
    );
    writeFileSync(join(dir, 'AGENT_HANDOFFS.yaml'), 'version: 1\nhandoffs:\n', 'utf8');
    writeFileSync(join(dir, 'PLAN_MAESTRO_CODEX_2026.md'), '# fixture\n', 'utf8');
    writeFileSync(join(dir, 'docs', 'task.md'), '# fixture\n', 'utf8');

    runGit(dir, ['init']);
    runGit(dir, ['branch', '-M', 'main']);
    runGit(dir, ['config', 'user.email', 'fixture@example.com']);
    runGit(dir, ['config', 'user.name', 'Fixture']);
    runGit(dir, ['add', '.']);
    runGit(dir, ['commit', '-m', 'fixture init']);
    runGit(dir, ['init', '--bare', '.origin.git']);
    runGit(dir, ['remote', 'add', 'origin', join(dir, '.origin.git')]);
    runGit(dir, ['push', '-u', 'origin', 'main']);
    return dir;
}

function runWorkspaceCli(dir, args) {
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), 'workspace', ...args, '--json'],
        {
            cwd: dir,
            encoding: 'utf8',
        }
    );
    assert.notEqual(
        result.stdout.trim(),
        '',
        `workspace ${args.join(' ')} no produjo JSON`
    );
    return {
        status: result.status,
        json: JSON.parse(String(result.stdout || '{}')),
        stderr: result.stderr,
    };
}

test('workspace CLI bootstrap y status exponen snapshot local', () => {
    const dir = createCliFixture();
    try {
        const bootstrap = runWorkspaceCli(dir, [
            'bootstrap',
            '--no-install-watcher',
        ]);
        assert.equal(bootstrap.status, 0);
        assert.equal(bootstrap.json.command, 'workspace bootstrap');
        assert.equal(bootstrap.json.snapshot.root.sync_state, 'ready');
        assert.equal(existsSync(join(dir, '.codex-local', 'machine-id')), true);

        const status = runWorkspaceCli(dir, ['status']);
        assert.equal(status.status, 0);
        assert.equal(status.json.command, 'workspace status');
        assert.equal(status.json.snapshot.root.sync_state, 'ready');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('workspace CLI sync limpia casos fixable seguros y repair expone contrato JSON', () => {
    const dir = createCliFixture();
    try {
        runWorkspaceCli(dir, ['bootstrap', '--no-install-watcher']);
        mkdirSync(join(dir, '_deploy_bundle'), { recursive: true });
        writeFileSync(join(dir, '_deploy_bundle', 'tmp.txt'), 'noise\n', 'utf8');

        const sync = runWorkspaceCli(dir, ['sync', '--once']);
        assert.equal(sync.status, 0);
        assert.equal(sync.json.command, 'workspace sync');
        assert.equal(typeof sync.json.snapshot.root.sync_state, 'string');

        const repair = runWorkspaceCli(dir, ['repair']);
        assert.equal(repair.json.command, 'workspace repair');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
