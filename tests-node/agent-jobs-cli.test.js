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
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-jobs-cli-test-'));
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
    const statusDir = join(dir, 'runtime');
    mkdirSync(statusDir, { recursive: true });
    const statusPath = join(statusDir, 'public-sync-status.json');
    const nowIso = new Date().toISOString();

    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                job_key: 'public_main_sync',
                state: 'ok',
                checked_at: nowIso,
                last_success_at: nowIso,
                deployed_commit: 'abc1234',
                repo_path: '/var/www/figo',
                branch: 'main',
                current_head: 'abc1234',
                remote_head: 'abc1234',
                dirty_paths_count: 2,
                dirty_paths_sample: ['vendor/autoload.php', '_astro/app.js'],
                dirty_paths: ['vendor/autoload.php', '_astro/app.js'],
                duration_ms: 912,
                lock_file: '/tmp/sync-pielarmonia.lock',
                log_path: '/var/log/sync-pielarmonia.log',
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    writeFileSync(
        join(dir, 'AGENT_BOARD.yaml'),
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: 2026-03-03
tasks: []
`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        'version: 1\nhandoffs: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        '# Fixture\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-03T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"
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
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
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
    return JSON.parse(String(result.stdout || ''));
}

test('jobs status/verify CLI expone snapshot estable para public_main_sync', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const status = runCli(dir, ['jobs', 'status', '--json']);
    assert.equal(status.ok, true);
    assert.equal(status.command, 'jobs status');
    assert.equal(Array.isArray(status.jobs), true);
    assert.equal(status.jobs.length, 1);
    assert.equal(status.jobs[0].key, 'public_main_sync');
    assert.equal(status.jobs[0].verification_source, 'local_status_file');
    assert.equal(status.jobs[0].healthy, true);
    assert.equal(status.jobs[0].current_head, 'abc1234');
    assert.equal(status.jobs[0].remote_head, 'abc1234');
    assert.equal(status.jobs[0].dirty_paths_count, 2);
    assert.equal(status.jobs[0].head_drift, false);
    assert.equal(status.jobs[0].telemetry_gap, false);
    assert.equal(status.jobs[0].failure_reason, '');
    assert.deepEqual(status.jobs[0].dirty_paths_sample, [
        'vendor/autoload.php',
        '_astro/app.js',
    ]);
    assert.equal(status.jobs[0].duration_ms, 912);

    const verify = runCli(dir, [
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]);
    assert.equal(verify.ok, true);
    assert.equal(verify.command, 'jobs verify');
    assert.equal(verify.job.job_id, '8d31e299-7e57-4959-80b5-aaa2d73e9674');
    assert.equal(verify.job.healthy, true);
    assert.equal(typeof verify.job.age_seconds, 'number');
    assert.equal(verify.job.repo_path, '/var/www/figo');
    assert.equal(verify.job.branch, 'main');
    assert.equal(verify.job.current_head, 'abc1234');
    assert.equal(verify.job.remote_head, 'abc1234');
    assert.equal(verify.job.dirty_paths_count, 2);
    assert.equal(verify.job.head_drift, false);
    assert.equal(verify.job.telemetry_gap, false);
    assert.equal(verify.job.failure_reason, '');
    assert.deepEqual(verify.job.dirty_paths, [
        'vendor/autoload.php',
        '_astro/app.js',
    ]);
});
