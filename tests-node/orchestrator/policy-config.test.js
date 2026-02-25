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
