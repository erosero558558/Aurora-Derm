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
    'patient-flow-os-rollback.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-rollback expone inputs de source artifact, target environment y modo de operación', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'source_run_id',
        'rollback_packet_path',
        'source_artifact_name',
        'target_environment',
        'operation_mode',
        'confirm_restore',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.rollback_packet_path.default, 'rollback-packet.json');
    assert.equal(
        inputs.source_artifact_name.default,
        'patient-flow-os-production-promotion-artifacts'
    );
    assert.equal(inputs.target_environment.default, 'production');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
    assert.equal(inputs.operation_mode.default, 'rehearsal');
    assert.deepEqual(inputs.operation_mode.options, ['rehearsal', 'restore']);
});

test('patient-flow-os-rollback usa permisos read-only, concurrency serializada y jobs de preparación y ejecución', () => {
    const { parsed } = loadWorkflow();
    const jobs = parsed?.jobs || {};

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(parsed?.permissions?.actions, 'read');
    assert.equal(typeof jobs['prepare-rollback'], 'object');
    assert.equal(typeof jobs['execute-rollback'], 'object');
    assert.equal(
        jobs['execute-rollback']?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'production') }}"
    );
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-rollback-${{ github.ref }}-${{ github.event.inputs.target_environment || 'production' }}"
    );
});

test('patient-flow-os-rollback descarga artifacts cross-run, verifica el packet y ejecuta replace-state con evidencia de rehearsal o restore', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'actions/download-artifact@v4',
        'run-id: ${{ github.event.inputs.source_run_id }}',
        'github-token: ${{ github.token }}',
        'npm run cutover -- verify-rollback-packet',
        'patient-flow-os-rollback-source',
        'rollback-source-manifest.json',
        'source-rollback-packet.json',
        'source-rollback-checklist.json',
        'source-rollback-verification.json',
        'source-before-state.json',
        'operation_mode',
        'confirm_restore=true es obligatorio',
        'patient-flow-os-production-promotion-artifacts',
        'npm run cutover -- replace-state',
        '--allow-destructive',
        'rollback-result.json',
        'post-rollback-smoke.json',
        'post-rollback-inspect.json',
        'rollback-manifest.json',
        'patient-flow-os-rollback-artifacts',
        '## Patient Flow OS Rollback',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-rollback: ${snippet}`
        );
    }
});
