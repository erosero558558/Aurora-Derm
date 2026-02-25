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
