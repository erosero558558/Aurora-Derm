#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'sentry-events-verify.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('sentry workflow publica artefacto runtime normalizado', () => {
    const { raw, parsed } = loadWorkflow();
    const steps =
        parsed?.jobs?.['verify-sentry-events']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Publicar artefacto Sentry'),
        true,
        'falta step de upload de artefacto Sentry'
    );
    assert.equal(
        raw.includes('verification/runtime/sentry-events-last.json'),
        true,
        'falta path canonico del artefacto runtime'
    );
    assert.equal(
        raw.includes('name: sentry-events-report'),
        true,
        'falta nombre canonico del artefacto sentry-events-report'
    );
});

test('sentry workflow delega el diagnostico al script en vez de bloquear antes', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes('npm run verify:sentry:events -- "${args[@]}"'),
        true,
        'falta invocacion canonica del script verify:sentry:events'
    );
    assert.equal(
        raw.includes('Validar configuracion minima'),
        false,
        'el workflow no debe fallar antes de generar el artefacto JSON'
    );
});
