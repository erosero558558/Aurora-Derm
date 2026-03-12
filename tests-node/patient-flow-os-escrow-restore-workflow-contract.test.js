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
    'patient-flow-os-escrow-restore.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-escrow-restore expone inputs para source artifact, environment y budget de RTO', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'source_run_id',
        'backup_escrow_packet_path',
        'source_artifact_name',
        'target_environment',
        'max_rto_seconds',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.backup_escrow_packet_path.default, 'backup-escrow-packet.json');
    assert.equal(
        inputs.source_artifact_name.default,
        'patient-flow-os-backup-drill-artifacts'
    );
    assert.equal(inputs.target_environment.default, 'production');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
    assert.equal(inputs.max_rto_seconds.default, '900');
});

test('patient-flow-os-escrow-restore usa permissions read-only, environment gate y concurrency serializada', () => {
    const { parsed } = loadWorkflow();
    const job = parsed?.jobs?.['patient-flow-os-escrow-restore'];

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(parsed?.permissions?.actions, 'read');
    assert.equal(typeof job, 'object', 'falta job patient-flow-os-escrow-restore');
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-escrow-restore-${{ github.ref }}-${{ github.event.inputs.target_environment || 'production' }}"
    );
    assert.equal(
        job?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'production') }}"
    );
    assert.equal(job?.defaults?.run?.['working-directory'], 'src/apps/patient-flow-os');
});

test('patient-flow-os-escrow-restore descarga artifacts cross-run, restaura desde S3 y verifica el restore packet con evidencia trazable', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'PATIENT_FLOW_OS_DRILL_DATABASE_URL',
        'PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION',
        'verification/patient-flow-os-escrow-restore-source',
        'actions/download-artifact@v4',
        'run-id: ${{ github.event.inputs.source_run_id }}',
        'github-token: ${{ github.token }}',
        'npm run cutover -- verify-backup-escrow',
        '--source-environment "${TARGET_ENVIRONMENT_INPUT}"',
        'aws s3api get-object',
        'gpg',
        '--decrypt',
        'sha256sum',
        'DROP SCHEMA IF EXISTS public CASCADE;',
        'pg_restore',
        'restore-smoke.json',
        'restore-inspect.json',
        'backup-escrow-restore-manifest.json',
        'npm run cutover -- backup-escrow-restore-packet',
        'patient-flow-os-${TARGET_ENVIRONMENT_INPUT}-backup-escrow-restore',
        'npm run cutover -- verify-backup-escrow-restore',
        'backup-escrow-restore-packet.json',
        'backup-escrow-restore-checklist.json',
        'backup-escrow-restore-verification.json',
        'source-backup-escrow-packet.json',
        'source-backup-drill-packet.json',
        'source-backup-escrow-checklist.json',
        'patient-flow-os-escrow-restore-artifacts',
        '## Patient Flow OS Escrow Restore',
        'Measured RTO',
        'Downloaded dump checksum matches escrow',
        'Decrypted dump checksum matches source',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-escrow-restore: ${snippet}`
        );
    }
});
