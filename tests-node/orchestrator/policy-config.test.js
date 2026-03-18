#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validateGovernancePolicy,
} = require('../../tools/agent-orchestrator/core/policy');

const DEFAULT_POLICY = {
    version: 1,
    domain_health: {
        priority_domains: ['calendar', 'chat', 'payments'],
        domain_weights: { calendar: 5, chat: 3, payments: 2, default: 1 },
        signal_scores: { GREEN: 100, YELLOW: 60, RED: 0 },
    },
    summary: {
        thresholds: { domain_score_priority_yellow_below: 80 },
    },
    enforcement: {
        branch_profiles: {
            pull_request: { fail_on_red: 'warn' },
            main: { fail_on_red: 'warn' },
        },
        warning_policies: {
            active_broad_glob: { enabled: true, severity: 'warning' },
        },
    },
};

test('policy-config valida enforcement y advierte unknown keys', () => {
    const report = validateGovernancePolicy(
        {
            version: 1,
            enforcement: {
                branch_profiles: {
                    pull_request: { fail_on_red: 'warn', extra: true },
                },
                warning_policies: {
                    active_broad_glob: {
                        enabled: true,
                        severity: 'warning',
                        unknown: 1,
                    },
                },
                unknown_enforcement_key: true,
            },
            unknown_root_key: 1,
        },
        { defaultPolicy: DEFAULT_POLICY, policyExists: true }
    );

    assert.equal(report.ok, true);
    assert.equal(report.error_count, 0);
    assert.equal(report.warning_count >= 1, true);
    assert.equal(
        report.warnings.some((w) => /unknown key/i.test(String(w))),
        true
    );
    assert.equal(
        report.effective.enforcement.branch_profiles.pull_request.fail_on_red,
        'warn'
    );
});

test('policy-config falla enforcement invalido', () => {
    const report = validateGovernancePolicy(
        {
            version: 1,
            enforcement: {
                branch_profiles: {
                    main: { fail_on_red: 'boom' },
                },
                warning_policies: {
                    active_broad_glob: { enabled: 'yes', severity: 'warning' },
                },
            },
        },
        { defaultPolicy: DEFAULT_POLICY, policyExists: true }
    );

    assert.equal(report.ok, false);
    assert.equal(report.error_count >= 1, true);
    assert.equal(
        report.errors.some((e) => /fail_on_red invalido/i.test(String(e))),
        true
    );
});

test('policy-config acepta sections agents y publishing sin marcarlas como unknown keys', () => {
    const report = validateGovernancePolicy(
        {
            version: 1,
            agents: {
                active_executors: ['codex', 'ci'],
                retired_executors: ['claude', 'jules', 'kimi'],
                allow_legacy_terminal_executors: true,
            },
            publishing: {
                enabled: true,
                mode: 'main_auto_guarded',
                trigger: 'validated_checkpoint',
                branch: 'main',
                gate_profile: 'fast_targeted',
                checkpoint_cooldown_seconds: 90,
                max_live_wait_seconds: 180,
                health_url: 'https://pielarmonia.com/api.php?resource=health',
                required_job_key: 'public_main_sync',
            },
        },
        { defaultPolicy: DEFAULT_POLICY, policyExists: true }
    );

    assert.equal(report.ok, true);
    assert.equal(
        report.warnings.some((warning) =>
            /root\.agents unknown key|root\.publishing unknown key/i.test(
                String(warning)
            )
        ),
        false
    );
    assert.deepEqual(report.effective.agents.active_executors, ['codex', 'ci']);
    assert.equal(
        report.effective.publishing.required_job_key,
        'public_main_sync'
    );
});

test('policy-config valida codex_parallelism y expone el payload efectivo', () => {
    const report = validateGovernancePolicy(
        {
            version: 1,
            enforcement: {
                codex_parallelism: {
                    slot_statuses: ['in_progress', 'review', 'blocked'],
                    by_codex_instance: {
                        codex_backend_ops: 2,
                        codex_frontend: 2,
                        codex_transversal: 2,
                    },
                },
            },
        },
        { defaultPolicy: DEFAULT_POLICY, policyExists: true }
    );

    assert.equal(report.ok, true);
    assert.deepEqual(
        report.effective.enforcement.codex_parallelism.slot_statuses,
        ['in_progress', 'review', 'blocked']
    );
    assert.equal(
        report.effective.enforcement.codex_parallelism.by_codex_instance
            .codex_frontend,
        2
    );
});

test('policy-config acepta codex_model_routing y expone el payload efectivo', () => {
    const report = validateGovernancePolicy(
        {
            version: 1,
            codex_model_routing: {
                version: '2026-03-17-codex-model-routing-v2',
                scope: 'codex_only',
                default_model_tier: 'gpt-5.4-mini',
                premium_model_tier: 'gpt-5.4',
                root_thread_model_tier: 'gpt-5.4-mini',
                premium_budget_unit: 'premium_session',
                ledger_path: 'verification/codex-model-usage.jsonl',
                decision_packets_dir: 'verification/codex-decisions',
                allowed_gate_states: [
                    'closed',
                    'approved',
                    'consumed',
                    'blocked',
                ],
                allowed_execution_modes: ['subagent', 'main_thread_exception'],
                premium_reasons: ['critical_zone', 'critical_review'],
                prohibited_premium_uses: ['repo_exploration', 'status_update'],
                decision_packet_fields: [
                    'task_id',
                    'execution_mode',
                    'premium_reason',
                    'problem',
                    'why_mini_or_local_failed',
                ],
                target_mix: {
                    zero_premium_pct: 80,
                    one_premium_pct: 15,
                    two_premium_pct: 5,
                    throughput_drop_guardrail_pct: 10,
                },
                fallback_order: ['tools/local', 'gpt-5.4-mini', 'gpt-5.4'],
                gate_open_conditions: ['critical_zone', 'cross_lane_high_risk'],
                notes: 'fixture',
            },
        },
        { defaultPolicy: DEFAULT_POLICY, policyExists: true }
    );

    assert.equal(report.ok, true);
    assert.equal(
        report.warnings.some((warning) =>
            /root\.codex_model_routing unknown key/i.test(String(warning))
        ),
        false
    );
    assert.equal(
        report.effective.codex_model_routing.default_model_tier,
        'gpt-5.4-mini'
    );
    assert.equal(
        report.effective.codex_model_routing.target_mix.zero_premium_pct,
        80
    );
});
