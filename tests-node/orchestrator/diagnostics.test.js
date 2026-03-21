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
            strategy_without_focus: { enabled: true, severity: 'warning' },
            focus_without_active_tasks: { enabled: true, severity: 'warning' },
            missing_next_step: { enabled: true, severity: 'warning' },
            task_missing_focus_fields: {
                enabled: true,
                severity: 'warning',
            },
            task_outside_next_step: { enabled: true, severity: 'warning' },
            slice_not_allowed_for_lane: {
                enabled: true,
                severity: 'warning',
            },
            too_many_active_slices: { enabled: true, severity: 'warning' },
            required_check_unverified: {
                enabled: true,
                severity: 'warning',
            },
            support_only_active: { enabled: true, severity: 'warning' },
            decision_overdue: { enabled: true, severity: 'warning' },
            rework_without_reason: { enabled: true, severity: 'warning' },
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
            public_main_sync_repo_hygiene: {
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
            publish_live_verification_pending: {
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
    assert.equal(list.every((item) => typeof item.scope === 'string'), true);
});

test('diagnostics buildWarnFirstDiagnostics agrega señales de foco compartido', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: POLICY,
        board: {
            strategy: {
                active: {
                    id: 'STRAT-2026-03-admin-operativo',
                    title: 'Admin operativo',
                    status: 'active',
                    owner: 'ernesto',
                    started_at: '2026-03-14',
                    review_due_at: '2026-03-21',
                    exit_criteria: ['uno'],
                    success_signal: 'demo',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_title: 'Admin operativo demostrable',
                    focus_summary: 'Corte comun',
                    focus_status: 'active',
                    focus_proof: 'Demo comun',
                    focus_steps: ['admin_queue_pilot_cut'],
                    focus_next_step: 'admin_queue_pilot_cut',
                    focus_required_checks: [
                        'job:public_main_sync',
                        'runtime:openclaw_chatgpt',
                    ],
                    focus_non_goals: ['rediseno_publico'],
                    focus_owner: 'ernesto',
                    focus_review_due_at: '2026-03-21',
                    focus_evidence_ref: '',
                    focus_max_active_slices: 1,
                    subfronts: [],
                },
            },
            tasks: [
                {
                    id: 'CDX-001',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'admin_queue_pilot_cut',
                    integration_slice: 'frontend_runtime',
                    work_type: 'forward',
                    rework_parent: '',
                    rework_reason: '',
                },
                {
                    id: 'CDX-002',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'admin_queue_pilot_cut',
                    integration_slice: 'governance_evidence',
                    work_type: 'forward',
                    rework_parent: '',
                    rework_reason: '',
                },
                {
                    id: 'CDX-003',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'otro_step',
                    integration_slice: 'frontend_runtime',
                    work_type: 'forward',
                    rework_parent: '',
                    rework_reason: '',
                },
                {
                    id: 'CDX-004',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'admin_queue_pilot_cut',
                    integration_slice: 'backend_readiness',
                    work_type: 'forward',
                    rework_parent: '',
                    rework_reason: '',
                },
                {
                    id: 'CDX-005',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'admin_queue_pilot_cut',
                    integration_slice: 'tests_quality',
                    work_type: 'fix',
                    rework_parent: '',
                    rework_reason: '',
                },
            ],
        },
        decisionsData: {
            decisions: [
                {
                    id: 'DEC-001',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    status: 'open',
                    due_at: '2026-03-01',
                },
            ],
        },
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: false,
            },
        ],
        activeStatuses: ACTIVE_STATUSES,
        now: new Date('2026-03-14T00:00:00.000Z'),
    });

    const codes = list.map((item) => item.code).sort();
    assert.deepEqual(codes, [
        'warn.focus.decision_overdue',
        'warn.focus.required_check_unverified',
        'warn.focus.rework_without_reason',
        'warn.focus.slice_not_allowed_for_lane',
        'warn.focus.task_outside_next_step',
        'warn.focus.too_many_active_slices',
        'warn.metrics.baseline_missing',
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

test('diagnostics preserva required_check runtime por surface en warnings del foco', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: POLICY,
        board: {
            strategy: {
                active: {
                    id: 'STRAT-2026-03-admin-operativo',
                    title: 'Admin operativo',
                    status: 'active',
                    owner: 'ernesto',
                    started_at: '2026-03-14',
                    review_due_at: '2026-03-21',
                    exit_criteria: ['uno'],
                    success_signal: 'demo',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_title: 'Admin operativo demostrable',
                    focus_summary: 'Corte comun',
                    focus_status: 'active',
                    focus_proof: 'Demo comun',
                    focus_steps: ['feedback_trim'],
                    focus_next_step: 'feedback_trim',
                    focus_required_checks: [
                        'job:public_main_sync',
                        'runtime:operator_auth',
                    ],
                    focus_non_goals: ['rediseno_publico'],
                    focus_owner: 'ernesto',
                    focus_review_due_at: '2026-03-21',
                    focus_evidence_ref: '',
                    focus_max_active_slices: 3,
                    subfronts: [],
                },
            },
            tasks: [
                {
                    id: 'CDX-001',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'feedback_trim',
                    integration_slice: 'frontend_runtime',
                    work_type: 'forward',
                    rework_parent: '',
                    rework_reason: '',
                },
            ],
        },
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: true,
            },
        ],
        activeStatuses: ACTIVE_STATUSES,
    });

    const diag = list.find(
        (item) => item.code === 'warn.focus.required_check_unverified'
    );
    assert.ok(diag);
    assert.match(diag.message, /runtime:operator_auth=unverified/);
    assert.equal(diag.meta.checks[0].id, 'runtime:operator_auth');
    assert.equal(diag.scope, 'release');
});

test('diagnostics agrega support_only_active como warning operacional', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: POLICY,
        focusSummary: {
            configured: {
                id: 'FOCUS-2026-03-admin-operativo-cut-1',
                required_checks: ['job:public_main_sync'],
            },
            active_tasks_total: 2,
            support_tasks_total: 2,
            forward_tasks_total: 0,
            support_only: true,
            idle: false,
            missing_focus_task_ids: [],
            outside_next_step_task_ids: [],
            invalid_slice_task_ids: [],
            too_many_active_slices: false,
            required_checks: [
                {
                    id: 'job:public_main_sync',
                    state: 'green',
                    ok: true,
                },
            ],
            decisions: {
                overdue: 0,
                overdue_ids: [],
            },
            rework_without_reason_task_ids: [],
        },
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: true,
            },
        ],
        activeStatuses: ACTIVE_STATUSES,
    });

    const diag = list.find(
        (item) => item.code === 'warn.focus.support_only_active'
    );
    assert.ok(diag);
    assert.equal(diag.scope, 'operational');
    assert.match(diag.message, /solo tiene trabajo support/i);
});

test('diagnostics reutiliza focusSummary live cuando se provee explicitamente', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: POLICY,
        focusSummary: {
            configured: {
                id: 'FOCUS-2026-03-admin-operativo-cut-1',
                required_checks: [
                    'job:public_main_sync',
                    'runtime:operator_auth',
                ],
            },
            idle: false,
            missing_focus_task_ids: [],
            outside_next_step_task_ids: [],
            invalid_slice_task_ids: [],
            too_many_active_slices: false,
            required_checks: [
                {
                    id: 'job:public_main_sync',
                    state: 'green',
                    ok: true,
                },
                {
                    id: 'runtime:operator_auth',
                    state: 'green',
                    ok: true,
                },
            ],
            decisions: {
                overdue: 0,
                overdue_ids: [],
            },
            rework_without_reason_task_ids: [],
        },
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: true,
            },
        ],
        activeStatuses: ACTIVE_STATUSES,
    });

    assert.equal(
        list.some(
            (item) => item.code === 'warn.focus.required_check_unverified'
        ),
        false
    );
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

test('diagnostics clasifica health_http_502 de public_main_sync con accion y metadatos accionables', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: JOB_POLICY,
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: false,
                healthy: false,
                state: 'failed',
                verification_source: 'health_url',
                age_seconds: 45,
                expected_max_lag_seconds: 120,
                last_error_message: 'health_http_502',
                failure_reason: 'health_http_502',
                details: {
                    http_status: 502,
                    response_detail: 'Bad Gateway',
                },
            },
        ],
    });

    assert.deepEqual(list.map((item) => item.code).sort(), [
        'warn.jobs.public_main_sync_failed',
    ]);

    const failed = list[0];
    assert.match(failed.message, /reason=health_http_502/);
    assert.match(failed.message, /action=recover_public_health_route/);
    assert.match(failed.message, /http_status=502/);
    assert.equal(failed.meta.failure_reason, 'health_http_502');
    assert.equal(failed.meta.http_status, 502);
    assert.equal(failed.meta.response_detail, 'Bad Gateway');
    assert.equal(failed.meta.recovery_action, 'recover_public_health_route');
});

test('diagnostics agrega warning de publish live pendiente por lane', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: JOB_POLICY,
        publishEvents: [
            {
                task_id: 'CDX-001',
                task_family: 'cdx',
                codex_instance: 'codex_frontend',
                commit: 'abc1234',
                live_status: 'pending',
                verification_pending: true,
                published_at: '2026-03-16T00:00:00Z',
            },
            {
                task_id: 'CDX-000',
                task_family: 'cdx',
                codex_instance: 'codex_frontend',
                commit: 'old1111',
                live_status: 'confirmed',
                verification_pending: false,
                published_at: '2026-03-15T00:00:00Z',
            },
        ],
        activeStatuses: ACTIVE_STATUSES,
    });

    const warning = list.find(
        (item) => item.code === 'warn.publish.live_verification_pending'
    );
    assert.ok(warning);
    assert.match(warning.message, /codex_frontend\/CDX-001@abc1234/i);
    assert.deepEqual(warning.task_ids, ['CDX-001']);
    assert.equal(warning.meta.entries[0].verification_pending, true);
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

test('diagnostics reclasifica working_tree_dirty con evidencia como repo hygiene', () => {
    const list = diagnostics.buildWarnFirstDiagnostics({
        source: 'status',
        policy: JOB_POLICY,
        jobsSnapshot: [
            {
                key: 'public_main_sync',
                configured: true,
                verified: true,
                healthy: true,
                operationally_healthy: true,
                repo_hygiene_issue: true,
                state: 'failed',
                verification_source: 'health_url',
                age_seconds: 45,
                expected_max_lag_seconds: 120,
                last_error_message: 'working_tree_dirty',
                failure_reason: 'working_tree_dirty',
                current_head: 'abc1234',
                remote_head: 'abc1234',
                head_drift: false,
                telemetry_gap: false,
                dirty_paths_count: 2,
                dirty_paths_sample: ['styles.css'],
            },
        ],
    });

    const codes = list.map((item) => item.code).sort();
    assert.deepEqual(codes, ['warn.jobs.public_main_sync_repo_hygiene']);
    const repoHygiene = list[0];
    assert.match(repoHygiene.message, /repo hygiene issue/);
    assert.match(repoHygiene.message, /dirty_paths=2/);
    assert.equal(repoHygiene.meta.repo_hygiene_issue, true);
    assert.equal(repoHygiene.meta.operationally_healthy, true);
});
