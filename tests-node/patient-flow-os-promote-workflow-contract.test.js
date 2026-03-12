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
    'patient-flow-os-promote.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-promote expone inputs de promotion source y confirmacion productiva', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'source_run_id',
        'promotion_packet_path',
        'source_cutover_artifact_name',
        'source_post_cutover_artifact_name',
        'confirm_production_cutover',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.promotion_packet_path.default, 'promotion-packet.json');
    assert.equal(
        inputs.source_cutover_artifact_name.default,
        'patient-flow-os-cutover-artifacts'
    );
    assert.equal(
        inputs.source_post_cutover_artifact_name.default,
        'patient-flow-os-post-cutover-artifacts'
    );
});

test('patient-flow-os-promote usa permisos read-only y separa preparación de ejecución en producción', () => {
    const { parsed } = loadWorkflow();
    const jobs = parsed?.jobs || {};

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(parsed?.permissions?.actions, 'read');
    assert.equal(typeof jobs['prepare-promotion'], 'object');
    assert.equal(typeof jobs['promote-production'], 'object');
    assert.equal(
        jobs['promote-production']?.environment?.name,
        'patient-flow-os-production'
    );
    assert.equal(
        parsed?.concurrency?.group,
        'patient-flow-os-production-promotion-${{ github.ref }}'
    );
});

test('patient-flow-os-promote descarga artifacts cross-run, verifica el packet y ejecuta el cutover productivo con evidencia final', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'actions/download-artifact@v4',
        'run-id: ${{ github.event.inputs.source_run_id }}',
        'github-token: ${{ github.token }}',
        'npm run cutover -- verify-promotion-packet',
        'patient-flow-os-promotion-source',
        'promotion-source-manifest.json',
        'input-openclaw-bundle.json',
        'confirm_production_cutover=true es obligatorio',
        'patient-flow-os-production',
        'npm run cutover -- cutover-openclaw',
        'npm run cutover -- verify-report',
        'npm run cutover -- promotion-packet',
        'npm run cutover -- verify-promotion-packet',
        'npm run cutover -- rollback-packet',
        'npm run cutover -- verify-rollback-packet',
        'patient-flow-os-production-promotion-artifacts',
        'source-promotion-packet.json',
        'source-promotion-verification.json',
        'promotion-packet.json',
        'promotion-checklist.json',
        'promotion-verification.json',
        'rollback-packet.json',
        'rollback-checklist.json',
        'rollback-verification.json',
        '## Patient Flow OS Promote',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-promote: ${snippet}`
        );
    }
});
