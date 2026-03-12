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
        'confirm_drill_reset=true es obligatorio',
        'retention_days debe ser entero positivo',
        'sudo apt-get install -y postgresql-client gnupg',
        'sudo apt-get install -y postgresql-client',
        'pg_dump',
        'sha256sum',
        'DROP SCHEMA IF EXISTS public CASCADE;',
        'pg_restore',
        'gpg',
        '--symmetric',
        'patient-flow-os.dump.gpg',
        'patient-flow-os.dump.gpg.sha256',
        'github_artifact_encrypted',
        'gpg_symmetric',
        'npm run cutover -- smoke --json',
        'npm run cutover -- inspect --json',
        'npm run cutover -- backup-drill-packet',
        'npm run cutover -- verify-backup-drill',
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
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-backup-drill: ${snippet}`
        );
    }
});
