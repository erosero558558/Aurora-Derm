#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'frontend-premium-qa.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

function getStepNames(steps) {
    return (steps || []).map((step) => String(step?.name || ''));
}

test('frontend premium QA incluye baseline visual en ejecucion y artefactos', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Capture visual baseline (desktop + mobile)'),
        true,
        'falta step de captura baseline visual'
    );
    assert.equal(
        stepNames.includes('Upload Visual baseline'),
        true,
        'falta step de upload de baseline visual'
    );

    assert.equal(
        raw.includes(
            'node bin/capture-public-baseline.js --out-dir .visual-baseline --label ci'
        ),
        true,
        'falta comando baseline visual en workflow'
    );
    assert.equal(
        raw.includes('name: premium-visual-baseline'),
        true,
        'falta artefacto premium-visual-baseline'
    );
    assert.equal(
        raw.includes('path: .visual-baseline/'),
        true,
        'falta path de artefacto visual baseline'
    );
});

test('frontend premium QA incluye gate de performance con evidencia', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Run public performance gate (CWV + budgets)'),
        true,
        'falta step de gate de performance'
    );
    assert.equal(
        stepNames.includes('Upload Performance gate evidence'),
        true,
        'falta upload de evidencia de performance gate'
    );
    assert.equal(
        raw.includes('run: npm run test:frontend:performance:gate'),
        true,
        'falta comando de performance gate en workflow'
    );
    assert.equal(
        raw.includes('name: premium-performance-gate'),
        true,
        'falta artefacto premium-performance-gate'
    );
    assert.equal(
        raw.includes('path: verification/performance-gate/'),
        true,
        'falta path de artefacto de performance gate'
    );
});

test('frontend premium QA publica contrato de aprobacion Public V3 en el summary', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['premium-qa']?.steps || [];
    const stepNames = getStepNames(steps);

    assert.equal(
        stepNames.includes('Summary'),
        true,
        'falta step Summary en frontend premium QA'
    );
    assert.equal(
        raw.includes(
            'echo "- approval_contract: \\`premium_frontend_qa + lighthouse + performance_gate + visual_baseline\\`";'
        ),
        true,
        'falta contrato de aprobacion Public V3 en summary de frontend premium QA'
    );
});
