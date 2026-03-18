'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadFlowOsManifest,
} = require('../src/domain/flow-os/load-manifest.js');
const {
    buildDelegationPlan,
    canTransition,
    resolveNextActions,
    summarizeJourney,
} = require('../src/domain/flow-os/patient-journey.js');

test('flow os manifest loads with version and stages', () => {
    const manifest = loadFlowOsManifest();

    assert.equal(manifest.product, 'flow-os');
    assert.equal(manifest.version, 1);
    assert.ok(Array.isArray(manifest.journeyStages));
    assert.ok(manifest.journeyStages.length >= 10);
});

test('journey transitions are explicit', () => {
    assert.equal(canTransition('registered', 'intake_pending'), true);
    assert.equal(canTransition('registered', 'resolved'), false);
});

test('intake completed delegates triage worker', () => {
    const delegation = buildDelegationPlan('intake_completed');

    assert.equal(delegation.length, 1);
    assert.equal(delegation[0].worker, 'intake-triage-worker');
});

test('red flags override default actions', () => {
    const actions = resolveNextActions('scheduled', { redFlagDetected: true });

    assert.equal(actions.length, 1);
    assert.equal(actions[0].id, 'manual_review_required');
    assert.equal(actions[0].priority, 'critical');
});

test('journey summary includes actions and delegation', () => {
    const summary = summarizeJourney('care_plan_ready');

    assert.equal(summary.stage, 'care_plan_ready');
    assert.ok(summary.actions.length >= 1);
    assert.ok(summary.delegation.length >= 1);
});
