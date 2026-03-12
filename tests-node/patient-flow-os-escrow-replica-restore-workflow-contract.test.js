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
    'patient-flow-os-escrow-replica-restore.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-escrow-replica-restore expone inputs para source artifact, environment y budget de RTO', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'source_run_id',
        'backup_escrow_replica_packet_path',
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

    assert.equal(
        inputs.backup_escrow_replica_packet_path.default,
        'backup-escrow-replica-packet.json'
    );
    assert.equal(
        inputs.source_artifact_name.default,
        'patient-flow-os-backup-drill-artifacts'
    );
    assert.equal(inputs.target_environment.default, 'production');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
    assert.equal(inputs.max_rto_seconds.default, '900');
});

test('patient-flow-os-escrow-replica-restore usa permissions read-only, environment gate y concurrency serializada', () => {
    const { parsed } = loadWorkflow();
    const job = parsed?.jobs?.['patient-flow-os-escrow-replica-restore'];

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(parsed?.permissions?.actions, 'read');
    assert.equal(typeof job, 'object', 'falta job patient-flow-os-escrow-replica-restore');
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-escrow-replica-restore-${{ github.ref }}-${{ github.event.inputs.target_environment || 'production' }}"
    );
    assert.equal(
        job?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'production') }}"
    );
    assert.equal(job?.defaults?.run?.['working-directory'], 'src/apps/patient-flow-os');
});

test('patient-flow-os-escrow-replica-restore descarga artifacts cross-run, restaura desde la réplica S3 y verifica el restore packet con evidencia trazable', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'PATIENT_FLOW_OS_DRILL_DATABASE_URL',
        'PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION',
        'verification/patient-flow-os-escrow-replica-restore-source',
        'actions/download-artifact@v4',
        'run-id: ${{ github.event.inputs.source_run_id }}',
        'github-token: ${{ github.token }}',
        'npm run cutover -- verify-backup-escrow-replica',
        '--source-environment "${TARGET_ENVIRONMENT_INPUT}"',
        'packet?.replicaEscrowObject?.bucket',
        'packet?.replicaEscrowObject?.key',
        'aws s3api get-object',
        'gpg',
        '--decrypt',
        'sha256sum',
        'DROP SCHEMA IF EXISTS public CASCADE;',
        'pg_restore',
        'restoreSource: \'replica\'',
        'restore-smoke.json',
        'restore-inspect.json',
        'backup-escrow-restore-manifest.json',
        'npm run cutover -- backup-escrow-restore-packet',
        'patient-flow-os-${TARGET_ENVIRONMENT_INPUT}-backup-escrow-replica-restore',
        'npm run cutover -- verify-backup-escrow-restore',
        'backup-escrow-restore-packet.json',
        'backup-escrow-restore-checklist.json',
        'backup-escrow-restore-verification.json',
        'source-backup-escrow-replica-packet.json',
        'source-backup-drill-packet.json',
        'source-backup-escrow-replica-checklist.json',
        'source-backup-escrow-replica-verification.json',
        'patient-flow-os-escrow-replica-restore-artifacts',
        '## Patient Flow OS Escrow Replica Restore',
        'Restore source: `replica`',
        'Replica escrow bucket',
        'Decrypted dump checksum matches source',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-escrow-replica-restore: ${snippet}`
        );
    }
});
