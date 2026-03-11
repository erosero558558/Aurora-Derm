#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');
const CI_WORKFLOW_PATH = resolve(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const NIGHTLY_WORKFLOW_PATH = resolve(
    REPO_ROOT,
    '.github',
    'workflows',
    'nightly-stability.yml'
);
const DEPLOY_DOC_PATH = resolve(REPO_ROOT, 'docs', 'GITHUB_ACTIONS_DEPLOY.md');
const STABILITY_PLAN_PATH = resolve(
    REPO_ROOT,
    'docs',
    'STABILITY_14_DAYS_PLAN.md'
);

function loadPackage() {
    return JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
}

function loadWorkflow(workflowPath) {
    const raw = readFileSync(workflowPath, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('package.json declara gate critico de pagos y lo integra al nightly', () => {
    const pkg = loadPackage();
    const paymentsGate = pkg?.scripts?.['test:critical:payments'] || '';
    const nightly = pkg?.scripts?.['nightly:stability'] || '';

    assert.equal(
        typeof paymentsGate,
        'string',
        'falta script test:critical:payments en package.json'
    );

    for (const snippet of [
        'php tests/StripeServiceIntegrationTest.php',
        'php tests/BookingPaymentsContractTest.php',
        'tests/payments-card-booking.spec.js',
        'tests/Unit/payment-engine.spec.js',
    ]) {
        assert.equal(
            paymentsGate.includes(snippet),
            true,
            `falta snippet del gate critico de pagos: ${snippet}`
        );
    }

    assert.equal(
        nightly.includes('npm run test:critical:payments'),
        true,
        'nightly:stability debe incluir test:critical:payments'
    );
});

test('ci ejecuta el critical payments gate dentro del carril e2e', () => {
    const { raw, parsed } = loadWorkflow(CI_WORKFLOW_PATH);
    const steps = parsed?.jobs?.['e2e-tests']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Run Critical Payments Gate'),
        true,
        'falta step Run Critical Payments Gate en CI'
    );
    assert.equal(
        raw.includes('run: npm run test:critical:payments'),
        true,
        'CI debe ejecutar npm run test:critical:payments'
    );
});

test('nightly-stability ejecuta y resume el critical payments gate', () => {
    const { raw, parsed } = loadWorkflow(NIGHTLY_WORKFLOW_PATH);
    const steps = parsed?.jobs?.nightly?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Setup PHP'),
        true,
        'nightly-stability debe preparar PHP para el gate de pagos'
    );
    assert.equal(
        stepNames.includes('Suite critica pagos'),
        true,
        'falta step Suite critica pagos en nightly-stability'
    );
    assert.equal(
        raw.includes('run: npm run test:critical:payments'),
        true,
        'nightly-stability debe ejecutar npm run test:critical:payments'
    );
    assert.equal(
        raw.includes(
            '- Flujo: ``gate:prod`` + ``test:critical:agenda`` + ``test:critical:funnel`` + ``test:critical:payments``'
        ),
        true,
        'falta trazabilidad del gate de pagos en el summary nightly'
    );
    assert.equal(
        raw.includes(
            '- Semaforo pagos: ``${{ steps.payments_critical.outcome }}``'
        ),
        true,
        'falta outcome del gate de pagos en el summary nightly'
    );
    assert.equal(
        raw.includes(
            'PAYMENTS_CRITICAL_OUTCOME: ${{ steps.payments_critical.outcome }}'
        ),
        true,
        'falta wiring del outcome de pagos para incidentes nightly'
    );
});

test('docs operativas mencionan el carril critico de pagos', () => {
    const deployDoc = readFileSync(DEPLOY_DOC_PATH, 'utf8');
    const stabilityPlan = readFileSync(STABILITY_PLAN_PATH, 'utf8');

    assert.equal(
        deployDoc.includes('`test:critical:payments`'),
        true,
        'docs/GITHUB_ACTIONS_DEPLOY.md debe documentar test:critical:payments'
    );
    assert.equal(
        stabilityPlan.includes('`npm run test:critical:payments`'),
        true,
        'docs/STABILITY_14_DAYS_PLAN.md debe incluir npm run test:critical:payments'
    );
});
