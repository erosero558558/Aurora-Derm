#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('path');

const { resolveAdminRolloutPolicy } = require(
    resolve(__dirname, '..', 'bin', 'resolve-admin-rollout-policy.js')
);

test('resolver aplica guardrail interno cuando flags vienen en false', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'internal',
        defaultStage: 'general',
        skipRuntimeSmoke: 'true',
        allowFeatureApiFailure: 'false',
        allowMissingFlag: 'false',
    });

    assert.equal(result.stage_effective, 'internal');
    assert.equal(result.stage_profile, 'tolerant');
    assert.equal(result.skip_runtime_smoke_effective, true);
    assert.equal(result.require_openclaw_auth_effective, false);
    assert.equal(result.require_openclaw_live_smoke_effective, false);
    assert.equal(result.allow_feature_api_failure_effective, true);
    assert.equal(result.allow_missing_flag_effective, true);
    assert.equal(result.policy_source, 'internal_stage_guardrail');
});

test('resolver aplica fallback de stage invalido y conserva trazabilidad', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'unknown-stage',
        defaultStage: 'canary',
        skipRuntimeSmoke: 'false',
        allowFeatureApiFailure: 'false',
        allowMissingFlag: 'false',
    });

    assert.equal(result.stage_effective, 'canary');
    assert.equal(result.stage_profile, 'progressive');
    assert.equal(result.require_openclaw_auth_effective, true);
    assert.equal(result.require_openclaw_live_smoke_effective, true);
    assert.equal(result.policy_source, 'invalid_stage_fallback');
});

test('resolver combina fallback e internal guardrail cuando default-stage=internal', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'bad-value',
        defaultStage: 'internal',
        skipRuntimeSmoke: 'false',
        allowFeatureApiFailure: 'false',
        allowMissingFlag: 'false',
    });

    assert.equal(result.stage_effective, 'internal');
    assert.equal(result.require_openclaw_auth_effective, false);
    assert.equal(result.require_openclaw_live_smoke_effective, false);
    assert.equal(result.allow_feature_api_failure_effective, true);
    assert.equal(result.allow_missing_flag_effective, true);
    assert.equal(
        result.policy_source,
        'invalid_stage_fallback+internal_stage_guardrail'
    );
});

test('resolver conserva values explicitos en stage general', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'general',
        defaultStage: 'general',
        skipRuntimeSmoke: 'false',
        requireOpenClawAuth: 'false',
        requireOpenClawLiveSmoke: 'false',
        allowFeatureApiFailure: 'true',
        allowMissingFlag: 'true',
    });

    assert.equal(result.stage_effective, 'general');
    assert.equal(result.stage_profile, 'strict');
    assert.equal(result.skip_runtime_smoke_effective, false);
    assert.equal(result.require_openclaw_auth_effective, false);
    assert.equal(result.require_openclaw_live_smoke_effective, false);
    assert.equal(result.allow_feature_api_failure_effective, true);
    assert.equal(result.allow_missing_flag_effective, true);
    assert.equal(result.policy_source, 'input_or_var');
});

test('resolver conserva stage stable cuando deploy-hosting lo propaga', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'stable',
        defaultStage: 'general',
        skipRuntimeSmoke: 'false',
        allowFeatureApiFailure: 'false',
        allowMissingFlag: 'false',
    });

    assert.equal(result.stage_effective, 'stable');
    assert.equal(result.stage_profile, 'strict');
    assert.equal(result.skip_runtime_smoke_effective, false);
    assert.equal(result.require_openclaw_auth_effective, true);
    assert.equal(result.require_openclaw_live_smoke_effective, true);
    assert.equal(result.allow_feature_api_failure_effective, false);
    assert.equal(result.allow_missing_flag_effective, false);
    assert.equal(result.policy_source, 'input_or_var');
});

test('resolver permite override explicito del smoke live sin afectar el requisito auth', () => {
    const result = resolveAdminRolloutPolicy({
        stage: 'canary',
        defaultStage: 'general',
        requireOpenClawAuth: 'true',
        requireOpenClawLiveSmoke: 'false',
    });

    assert.equal(result.stage_effective, 'canary');
    assert.equal(result.require_openclaw_auth_effective, true);
    assert.equal(result.require_openclaw_live_smoke_effective, false);
});
