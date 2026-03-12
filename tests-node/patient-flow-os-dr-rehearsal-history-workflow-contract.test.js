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
    'patient-flow-os-dr-rehearsal-history.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('patient-flow-os-dr-rehearsal-history expone inputs de ventana, mínimos y budgets, además de cron semanal', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const schedule = parsed?.on?.schedule || [];

    for (const inputName of [
        'target_environment',
        'window_days',
        'min_backup_drill_runs',
        'min_replica_restore_runs',
        'max_backup_drill_rto_seconds',
        'max_backup_drill_rpo_seconds',
        'max_replica_restore_rto_seconds',
        'max_gap_hours',
        'max_rto_regression_percent',
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }

    assert.equal(inputs.target_environment.default, 'production');
    assert.deepEqual(inputs.target_environment.options, ['staging', 'production']);
    assert.equal(inputs.window_days.default, '14');
    assert.equal(inputs.min_backup_drill_runs.default, '2');
    assert.equal(inputs.min_replica_restore_runs.default, '1');
    assert.equal(inputs.max_backup_drill_rto_seconds.default, '900');
    assert.equal(inputs.max_backup_drill_rpo_seconds.default, '3600');
    assert.equal(inputs.max_replica_restore_rto_seconds.default, '900');
    assert.equal(inputs.max_gap_hours.default, '168');
    assert.equal(inputs.max_rto_regression_percent.default, '25');
    assert.equal(Array.isArray(schedule), true);
    assert.equal(schedule.some((entry) => entry.cron === '0 10 * * 1'), true);
});

test('patient-flow-os-dr-rehearsal-history usa permissions read-only, environment gate y concurrency serializada', () => {
    const { parsed } = loadWorkflow();
    const job = parsed?.jobs?.['patient-flow-os-dr-rehearsal-history'];

    assert.equal(parsed?.permissions?.contents, 'read');
    assert.equal(parsed?.permissions?.actions, 'read');
    assert.equal(typeof job, 'object', 'falta job patient-flow-os-dr-rehearsal-history');
    assert.equal(
        parsed?.concurrency?.group,
        "patient-flow-os-dr-rehearsal-history-${{ github.ref }}-${{ github.event.inputs.target_environment || 'production' }}"
    );
    assert.equal(
        job?.environment?.name,
        "${{ format('patient-flow-os-{0}', github.event.inputs.target_environment || 'production') }}"
    );
    assert.equal(job?.defaults?.run?.['working-directory'], 'src/apps/patient-flow-os');
});

test('patient-flow-os-dr-rehearsal-history recolecta artifacts vía GitHub API, arma el packet histórico y publica alertas de tendencia', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'GITHUB_TOKEN: ${{ github.token }}',
        'window_days',
        'min_backup_drill_runs',
        'min_replica_restore_runs',
        'max_backup_drill_rto_seconds',
        'max_backup_drill_rpo_seconds',
        'max_replica_restore_rto_seconds',
        'max_gap_hours',
        'max_rto_regression_percent',
        "workflow: 'patient-flow-os-backup-drill.yml'",
        "workflow: 'patient-flow-os-escrow-replica-restore.yml'",
        '/actions/workflows/${collector.workflow}/runs?status=completed&per_page=50',
        '/actions/runs/${run.id}/artifacts?per_page=100',
        'artifact.archive_download_url',
        'execFileSync(\'unzip\'',
        'packet-download-manifest.json',
        'dr-rehearsal-history-manifest.json',
        'npm run cutover -- dr-rehearsal-history-packet',
        'npm run cutover -- verify-dr-rehearsal-history',
        'patient-flow-os-${TARGET_ENVIRONMENT_INPUT}-dr-rehearsal-history',
        'patient-flow-os-dr-rehearsal-history-artifacts',
        '## Patient Flow OS DR Rehearsal History',
        'Latest backup drill RTO/RPO',
        'Latest replica restore RTO',
        'dr-rehearsal-history-verification.json',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring esperado en patient-flow-os-dr-rehearsal-history: ${snippet}`
        );
    }
});
