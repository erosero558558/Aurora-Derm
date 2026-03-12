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
    'patient-flow-os-backup-drill.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-backup-drill expone inputs para environment y budgets de RTO/RPO', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'target_environment',
        'max_rto_seconds',
        'max_rpo_seconds',
        'retention_days',
        'max_escrow_age_hours',
        'confirm_drill_reset',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.target_environment.default, 'production');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
    assert.equal(inputs.max_rto_seconds.default, '900');
    assert.equal(inputs.max_rpo_seconds.default, '3600');
    assert.equal(inputs.retention_days.default, '30');
    assert.equal(inputs.max_escrow_age_hours.default, '24');
});

test('patient-flow-os-backup-drill usa permissions mínimos, environment gate y concurrency serializada', () => {
    const { parsed } = loadWorkflow();
    const job = parsed?.jobs?.['patient-flow-os-backup-drill'];

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(typeof job, 'object', 'falta job patient-flow-os-backup-drill');
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-backup-drill-${{ github.ref }}-${{ github.event.inputs.target_environment || 'production' }}"
    );
    assert.equal(
        job?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'production') }}"
    );
    assert.equal(job?.defaults?.run?.['working-directory'], 'src/apps/patient-flow-os');
});

test('patient-flow-os-backup-drill ejecuta pg_dump, pg_restore y verifica el packet de drill con artifacts trazables', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'PATIENT_FLOW_OS_DATABASE_URL',
        'PATIENT_FLOW_OS_DRILL_DATABASE_URL',
        'PATIENT_FLOW_OS_BACKUP_ENCRYPTION_PASSPHRASE',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_ACCESS_KEY_ID',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_SECRET_ACCESS_KEY',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_AWS_REGION',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_BUCKET',
        'PATIENT_FLOW_OS_BACKUP_ESCROW_REPLICA_BUCKET',
        'BACKUP_ESCROW_REPLICA_REGION',
        'confirm_drill_reset=true es obligatorio',
        'retention_days debe ser entero positivo',
        'max_escrow_age_hours debe ser entero positivo',
        'sudo apt-get install -y postgresql-client gnupg awscli',
        'pg_dump',
        'sha256sum',
        'DROP SCHEMA IF EXISTS public CASCADE;',
        'pg_restore',
        'gpg',
        '--symmetric',
        'aws s3api put-object',
        'aws s3api head-object',
        'aws s3api get-object-tagging',
        'patient-flow-os.dump.gpg',
        'patient-flow-os.dump.gpg.sha256',
        'github_artifact_encrypted',
        'gpg_symmetric',
        'aws_s3_encrypted',
        'backup-escrow-manifest.json',
        'backup-escrow-packet.json',
        'backup-escrow-checklist.json',
        'backup-escrow-verification.json',
        'replication_mode=escrow_replica_copy',
        'backup-escrow-replica-manifest.json',
        'replica-escrow-put-object-response.json',
        'replica-escrow-head-object.json',
        'replica-escrow-object-tagging.json',
        'backup-escrow-replica-packet.json',
        'backup-escrow-replica-checklist.json',
        'backup-escrow-replica-verification.json',
        'npm run cutover -- smoke --json',
        'npm run cutover -- inspect --json',
        'npm run cutover -- backup-drill-packet',
        'npm run cutover -- verify-backup-drill',
        'npm run cutover -- backup-escrow-packet',
        'npm run cutover -- verify-backup-escrow',
        'npm run cutover -- backup-escrow-replica-packet',
        'npm run cutover -- verify-backup-escrow-replica',
        'backup-drill-manifest.json',
        'patient-flow-os.dump.sha256',
        'source-smoke.json',
        'source-inspect.json',
        'restore-smoke.json',
        'restore-inspect.json',
        'backup-drill-packet.json',
        'backup-drill-checklist.json',
        'backup-drill-verification.json',
        'patient-flow-os-backup-drill-artifacts',
        '## Patient Flow OS Backup Drill',
        'Retention days',
        'Encrypted dump sha256',
        'External escrow ready',
        'Escrow bucket',
        'Replica escrow ready',
        'Replica target distinct',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-backup-drill: ${snippet}`
        );
    }
});
