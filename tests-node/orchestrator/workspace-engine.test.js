#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const workspaceDomain = require('../../tools/agent-orchestrator/domain/workspace');

const DATE = '2026-03-22';

function runGit(cwd, args) {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(
        result.status,
        0,
        `git ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return result;
}

function writeBoard(root, tasks) {
    const lines = [
        'version: 1',
        'policy:',
        '  canonical: AGENTS.md',
        '  autonomy: semi_autonomous_guardrails',
        '  kpi: reduce_rework',
        '  revision: 0',
        `  updated_at: ${DATE}`,
        'tasks:',
    ];
    for (const task of tasks) {
        lines.push(`  - id: ${task.id}`);
        lines.push(`    title: "${task.title}"`);
        lines.push('    owner: ernesto');
        lines.push('    executor: codex');
        lines.push(`    status: ${task.status || 'in_progress'}`);
        lines.push('    risk: low');
        lines.push(`    scope: ${task.scope || 'docs'}`);
        lines.push('    codex_instance: codex_backend_ops');
        lines.push('    domain_lane: backend_ops');
        lines.push('    lane_lock: strict');
        lines.push('    cross_domain: false');
        lines.push('    provider_mode: ""');
        lines.push('    runtime_surface: ""');
        lines.push('    runtime_transport: ""');
        lines.push('    runtime_last_transport: ""');
        lines.push('    model_tier_default: "gpt-5.4-mini"');
        lines.push('    premium_budget: 0');
        lines.push('    premium_calls_used: 0');
        lines.push('    premium_gate_state: "closed"');
        lines.push('    decision_packet_ref: ""');
        lines.push('    model_policy_version: "2026-03-17-codex-model-routing-v2"');
        lines.push(`    files: ["${task.file}"]`);
        lines.push(`    acceptance: "${task.title}"`);
        lines.push('    acceptance_ref: ""');
        lines.push('    evidence_ref: ""');
        lines.push('    depends_on: []');
        lines.push(`    prompt: "${task.title}"`);
        lines.push(`    created_at: ${DATE}`);
        lines.push(`    updated_at: ${DATE}`);
    }
    writeFileSync(join(root, 'AGENT_BOARD.yaml'), `${lines.join('\n')}\n`, 'utf8');
}

function createWorkspaceRepoFixture() {
    const root = mkdtempSync(join(tmpdir(), 'workspace-engine-'));
    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
        join(root, '.gitignore'),
        '.codex-local/\n.codex-worktrees/\n.origin.git/\n',
        'utf8'
    );
    writeBoard(root, [
        {
            id: 'CDX-001',
            title: 'Workspace fixture',
            file: 'docs/task-one.md',
        },
    ]);
    writeFileSync(
        join(root, 'PLAN_MAESTRO_CODEX_2026.md'),
        '# Fixture plan\n',
        'utf8'
    );
    writeFileSync(join(root, 'AGENT_HANDOFFS.yaml'), 'version: 1\nhandoffs:\n', 'utf8');
    writeFileSync(join(root, 'docs', 'task-one.md'), '# task one\n', 'utf8');
    writeFileSync(join(root, 'src', 'other.js'), 'console.log("other");\n', 'utf8');

    runGit(root, ['init']);
    runGit(root, ['branch', '-M', 'main']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'fixture init']);
    runGit(root, ['init', '--bare', '.origin.git']);
    runGit(root, ['remote', 'add', 'origin', join(root, '.origin.git')]);
    runGit(root, ['push', '-u', 'origin', 'main']);

    return root;
}

test('workspace bootstrap crea directorios locales y machine id estable', () => {
    const root = createWorkspaceRepoFixture();
    try {
        const report = workspaceDomain.buildBootstrapReport({
            cwd: root,
            governancePolicy: null,
        });
        assert.equal(report.command, 'workspace bootstrap');
        assert.equal(existsSync(join(root, '.codex-local')), true);
        assert.equal(existsSync(join(root, '.codex-worktrees')), true);
        assert.equal(
            existsSync(join(root, '.codex-local', 'machine-id')),
            true
        );
        assert.equal(
            existsSync(join(root, '.codex-local', 'workspace-sync.json')),
            true
        );
        assert.equal(report.snapshot.root.sync_state, 'ready');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('workspace ensureTaskWorktree crea worktree codex por tarea y sync lo mantiene alineado', () => {
    const root = createWorkspaceRepoFixture();
    try {
        const capture = workspaceDomain.ensureTaskWorktree('CDX-001', {
            cwd: root,
            governancePolicy: null,
        });
        assert.equal(existsSync(resolve(capture.worktree_path)), true);
        assert.equal(capture.task_row.branch, 'codex/CDX-001');
        assert.equal(capture.task_row.sync_state, 'ready');

        writeFileSync(
            join(root, 'docs', 'task-one.md'),
            '# mainline change\n',
            'utf8'
        );
        runGit(root, ['add', 'docs/task-one.md']);
        runGit(root, ['commit', '-m', 'mainline change']);
        runGit(root, ['push', 'origin', 'main']);

        const synced = workspaceDomain.runWorkspaceSync({
            cwd: capture.worktree_path,
            governancePolicy: null,
        });
        const taskRow = synced.tasks.find((row) => row.task_id === 'CDX-001');
        assert.equal(taskRow.sync_state, 'ready');
        assert.equal(taskRow.behind, 0);
        assert.equal(taskRow.origin_main_head, synced.root.origin_main_head);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('workspace sync marca root_dirty y blocked_mixed_lane cuando corresponde', () => {
    const root = createWorkspaceRepoFixture();
    try {
        const capture = workspaceDomain.ensureTaskWorktree('CDX-001', {
            cwd: root,
            governancePolicy: null,
        });
        writeFileSync(join(root, 'docs', 'task-one.md'), '# dirty root\n', 'utf8');
        writeFileSync(
            join(capture.worktree_path, 'src', 'other.js'),
            'console.log("out of scope");\n',
            'utf8'
        );

        const snapshot = workspaceDomain.runWorkspaceSync({
            cwd: capture.worktree_path,
            governancePolicy: null,
        });
        const taskRow = snapshot.tasks.find((row) => row.task_id === 'CDX-001');
        assert.equal(snapshot.root.sync_state, 'root_dirty');
        assert.equal(taskRow.sync_state, 'blocked_mixed_lane');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
