#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const diagnostics = require('../../tools/agent-orchestrator/domain/diagnostics');

const POLICY = {
    enforcement: {
        warning_policies: {
            active_broad_glob: { enabled: true, severity: 'warning' },
            handoff_expiring_soon: {
                enabled: true,
                severity: 'warning',
                hours_threshold: 4,
            },
            metrics_baseline_missing: { enabled: true, severity: 'warning' },
            policy_unknown_keys: { enabled: true, severity: 'warning' },
        },
    },
};

const JOB_POLICY = {
    enforcement: {
        warning_policies: {
            public_main_sync_unconfigured: {
                enabled: true,
                severity: 'warning',
            },
            public_main_sync_failed: {
                enabled: true,
                severity: 'warning',
            },
            public_main_sync_stale: {
                enabled: true,
                severity: 'warning',
            },
            public_main_sync_head_drift: {
                enabled: true,
                severity: 'warning',
            },
            public_main_sync_telemetry_gap: {
                enabled: true,
                severity: 'warning',
            },
        },
    },
};

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('diagnostics buildWarnFirstDiagnostics genera warnings policy-driven', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: POLICY,
        board: {
            tasks: [
                {
                    id: 'AG-001',
                    status: 'in_progress',
                    files: ['src/**'],
                },
            ],
        },
        handoffData: {
            handoffs: [
                {
                    id: 'HO-001',
                    status: 'active',
                    expires_at: '2026-02-25T03:00:00.000Z',
                },
            ],
        },
        metricsSnapshot: null,
        policyReport: {
            warnings: ['root.foo unknown key'],
        },
        activeStatuses: ACTIVE_STATUSES,
        now: new Date('2026-02-25T00:00:00.000Z'),
    });

    const codes = list.map((d) => d.code).sort();
    assert.deepEqual(codes, [
        'warn.board.active_broad_glob',
        'warn.handoff.expiring_soon',
        'warn.metrics.baseline_missing',
        'warn.policy.unknown_keys',
    ]);
});

test('diagnostics attachDiagnostics agrega counts aditivos', () => {
    const report = diagnostics.attachDiagnostics({ version: 1, ok: true }, [
        { code: 'warn.x', severity: 'warning', source: 'status', message: 'x' },
        { code: 'err.y', severity: 'error', source: 'status', message: 'y' },
    ]);
    assert.equal(report.warnings_count, 1);
    assert.equal(report.errors_count, 1);
    assert.equal(Array.isArray(report.diagnostics), true);
    assert.equal(report.diagnostics.length, 2);
});

test('diagnostics no marca public_main_sync como unconfigured cuando no se cargo snapshot', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'conflicts',
        policy: JOB_POLICY,
    });
    assert.deepEqual(list, []);
});

test('diagnostics prioriza failed sobre unconfigured cuando existe snapshot verificado', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'codex-check',
        policy: JOB_POLICY,
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: false,
                state: 'failed',
                verification_source: 'health_url',
                age_seconds: 45,
                expected_max_lag_seconds: 120,
            },
        ],
    });

    const codes = list.map((item) => item.code).sort();
    assert.deepEqual(codes, ['warn.jobs.public_main_sync_failed']);
});

test('diagnostics agrega señales canonicas de head drift y telemetry gap', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: JOB_POLICY,
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: false,
                state: 'failed',
                verification_source: 'health_url',
                age_seconds: 45,
                expected_max_lag_seconds: 120,
                last_error_message: 'working_tree_dirty',
                failure_reason: 'working_tree_dirty',
                current_head: 'abc1234',
                remote_head: 'def5678',
                head_drift: true,
                telemetry_gap: true,
                dirty_paths_count: 0,
                dirty_paths_sample: [],
            },
        ],
    });

    const codes = list.map((item) => item.code).sort();
    assert.deepEqual(codes, [
        'warn.jobs.public_main_sync_failed',
        'warn.jobs.public_main_sync_head_drift',
        'warn.jobs.public_main_sync_telemetry_gap',
    ]);
    const failed = list.find(
        (item) => item.code === 'warn.jobs.public_main_sync_failed'
    );
    assert.match(failed.message, /reason=working_tree_dirty/);
    assert.match(failed.message, /head_drift=true/);
    assert.match(failed.message, /telemetry_gap=true/);
    assert.equal(failed.meta.failure_reason, 'working_tree_dirty');
    assert.equal(failed.meta.head_drift, true);
    assert.equal(failed.meta.telemetry_gap, true);
});
