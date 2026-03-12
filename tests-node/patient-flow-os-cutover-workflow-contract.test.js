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
    'patient-flow-os-cutover.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-cutover expone inputs manuales para bundle y modo de cutover', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'openclaw_bundle_path',
        'cutover_mode',
        'target_environment',
        'run_post_cutover_smoke',
        'confirm_replace',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.cutover_mode.default, 'merge');
    assert.deepEqual(inputs.cutover_mode.options, ['merge', 'replace']);
    assert.equal(inputs.target_environment.default, 'staging');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
});

test('patient-flow-os-cutover usa permisos minimos, environment gate y jobs canonicos', () => {
    const { parsed } = loadWorkflow();
    const cutoverJob = parsed?.jobs?.['patient-flow-os-cutover'];
    const postCutoverJob = parsed?.jobs?.['patient-flow-os-post-cutover-smoke'];

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(typeof cutoverJob, 'object', 'falta job patient-flow-os-cutover');
    assert.equal(
        typeof postCutoverJob,
        'object',
        'falta job patient-flow-os-post-cutover-smoke'
    );
    assert.equal(
        cutoverJob?.defaults?.run?.['working-directory'],
        'src/apps/patient-flow-os'
    );
    assert.equal(
        postCutoverJob?.defaults?.run?.['working-directory'],
        'src/apps/patient-flow-os'
    );
    assert.equal(cutoverJob?.['timeout-minutes'], 30);
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-cutover-${{ github.ref }}-${{ github.event.inputs.target_environment || 'staging' }}"
    );
    assert.equal(
        cutoverJob?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'staging') }}"
    );
});

test('patient-flow-os-cutover ejecuta approval contract, manifest y post-cutover smoke con artifacts trazables', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'PATIENT_FLOW_OS_DATABASE_URL',
        'npm run build',
        'npm run cutover -- smoke --json',
        'npm run cutover -- cutover-openclaw',
        'npm run cutover -- verify-report',
        'npm run cutover -- promotion-packet',
        'actions/upload-artifact@v4',
        'actions/download-artifact@v4',
        'patient-flow-os-cutover-artifacts',
        'patient-flow-os-post-cutover-artifacts',
        'preflight-smoke.json',
        'approval-contract.json',
        'workflow-manifest.json',
        'post-cutover-smoke.json',
        'post-cutover-inspect.json',
        'promotion-packet.json',
        'promotion-packet.md',
        'promotion-checklist.json',
        'promotion-checklist.md',
        'promotion-packet-command.json',
        'cutover-result.json',
        'report.json',
        'before-state.json',
        'after-state.json',
        'patient-flow-os-post-cutover-smoke',
        "patient-flow-os-${manifest.targetEnvironment || 'staging'}",
        'cutover_mode=replace exige confirm_replace=true.',
        '--allow-destructive',
        '## Patient Flow OS Cutover',
        '## Patient Flow OS Post-Cutover Smoke',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-cutover: ${snippet}`
        );
    }
});
