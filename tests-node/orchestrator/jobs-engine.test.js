#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const parsers = require('../../tools/agent-orchestrator/core/parsers');
const serializers = require('../../tools/agent-orchestrator/core/serializers');
const jobs = require('../../tools/agent-orchestrator/domain/jobs');

function createTempDir() {
    return mkdtempSync(join(tmpdir(), 'jobs-engine-test-'));
}

test('jobs-engine parseJobsContent y serializeJobs conservan contrato AGENT_JOBS', () => {
    const raw = `
version: 1
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
    status_path: /var/lib/pielarmonia/public-sync-status.json
    health_url: https://pielarmonia.com/api.php?resource=health
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`;

    const parsed = parsers.parseJobsContent(raw);
    assert.equal(parsed.version, '1');
    assert.equal(parsed.updated_at, '2026-03-03T00:00:00Z');
    assert.equal(parsed.jobs.length, 1);
    assert.equal(parsed.jobs[0].key, 'public_main_sync');
    assert.equal(parsed.jobs[0].job_id, '8d31e299-7e57-4959-80b5-aaa2d73e9674');
    assert.equal(parsed.jobs[0].enabled, true);
    assert.equal(parsed.jobs[0].expected_max_lag_seconds, 120);

    const serialized = serializers.serializeJobs(parsed, {
        currentDate: () => '2026-03-03T00:00:00Z',
    });
    assert.match(serialized, /key: public_main_sync/);
    assert.match(serialized, /job_id: "8d31e299-7e57-4959-80b5-aaa2d73e9674"/);
    assert.match(serialized, /status_path: \/var\/lib\/pielarmonia\/public-sync-status\.json/);

    const roundtrip = parsers.parseJobsContent(serialized);
    assert.equal(roundtrip.jobs.length, 1);
    assert.equal(roundtrip.jobs[0].health_url, 'https://pielarmonia.com/api.php?resource=health');
});

test('jobs-engine resolveJobSnapshot usa status file local como fuente primaria', async (t) => {
    const dir = createTempDir();
    const statusPath = join(dir, 'public-sync-status.json');
    const checkedAt = new Date().toISOString();
    t.after(() => rmSync(dir, { recursive: true, force: true }));

    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                job_key: 'public_main_sync',
                state: 'ok',
                checked_at: checkedAt,
                last_success_at: checkedAt,
                deployed_commit: 'abc1234',
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const snapshot = await jobs.resolveJobSnapshot(
        {
            key: 'public_main_sync',
            job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
            status_path: statusPath,
            expected_max_lag_seconds: 120,
        },
        {
            existsSync: (path) => path === statusPath,
            readFileSync,
            fetchImpl: null,
        }
    );

    assert.equal(snapshot.verification_source, 'local_status_file');
    assert.equal(snapshot.verified, true);
    assert.equal(snapshot.healthy, true);
    assert.equal(snapshot.state, 'ok');
    assert.equal(snapshot.deployed_commit, 'abc1234');
    assert.equal(typeof snapshot.age_seconds, 'number');
});

test('jobs-engine resolveJobSnapshot usa health_url cuando no existe status local', async () => {
    const fetchImpl = async () => ({
        ok: true,
        async json() {
            return {
                checks: {
                    publicSync: {
                        configured: true,
                        jobId: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
                        state: 'ok',
                        healthy: true,
                        ageSeconds: 41,
                        expectedMaxLagSeconds: 120,
                        deployedCommit: 'def5678',
                        lastCheckedAt: '2026-03-03T12:00:32Z',
                        lastSuccessAt: '2026-03-03T12:00:32Z',
                    },
                },
            };
        },
    });

    const snapshot = await jobs.resolveJobSnapshot(
        {
            key: 'public_main_sync',
            job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
            health_url: 'https://pielarmonia.com/api.php?resource=health',
            expected_max_lag_seconds: 120,
        },
        {
            existsSync: () => false,
            readFileSync: () => '',
            fetchImpl,
        }
    );

    assert.equal(snapshot.verification_source, 'health_url');
    assert.equal(snapshot.verified, true);
    assert.equal(snapshot.healthy, true);
    assert.equal(snapshot.age_seconds, 41);
    assert.equal(snapshot.deployed_commit, 'def5678');
});

test('jobs-engine registry_only fallback y summary mantienen contrato estable', async () => {
    const snapshot = await jobs.resolveJobSnapshot(
        {
            key: 'public_main_sync',
            job_id: '8d31e299-7e57-4959-80b5-aaa2d73e9674',
            expected_max_lag_seconds: 120,
        },
        {
            existsSync: () => false,
            readFileSync: () => '',
            fetchImpl: null,
        }
    );

    assert.equal(snapshot.verification_source, 'registry_only');
    assert.equal(snapshot.verified, false);
    assert.equal(snapshot.healthy, false);

    const summary = jobs.summarizeJobsSnapshot([snapshot]);
    assert.deepEqual(summary, {
        tracked: 1,
        healthy: 0,
        failing: 1,
        public_main_sync: {
            healthy: false,
            age_seconds: null,
            deployed_commit: '',
        },
    });
    assert.equal(jobs.findJobSnapshot([snapshot], 'public_main_sync').job_id, snapshot.job_id);
});
