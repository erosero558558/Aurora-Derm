#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const MONITOR_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'MONITOR-PRODUCCION.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'PUBLIC_MAIN_UPDATE_RUNBOOK.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod monitor clasifica incidentes publicSync con telemetria canonica', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        '[switch]$AllowDegradedPublicSync',
        'function Add-MonitorFailure',
        '$publicSyncNode = $null',
        "$publicSyncFailureReason = ''",
        "$publicSyncLastErrorMessage = ''",
        "$publicSyncCurrentHead = ''",
        "$publicSyncRemoteHead = ''",
        '$publicSyncDirtyPathsCount = 0',
        '$publicSyncDirtyPathsSample = @()',
        '$publicSyncHeadDrift = (',
        '$publicSyncTelemetryGap = (',
        '[INFO] health.publicSync configured=$publicSyncConfigured healthy=$publicSyncHealthy jobId=$publicSyncJobId state=$publicSyncState ageSeconds=$publicSyncAgeSeconds expectedMaxLagSeconds=$publicSyncExpectedMaxLagSeconds failureReason=$publicSyncFailureReason',
        'lastErrorMessage=$publicSyncLastErrorMessage',
        'dirtyPathsSample=$publicSyncDirtyPathsSampleLabel',
        "Add-MonitorFailure -Message '[FAIL] health.checks.publicSync ausente' -AllowDegraded:$AllowDegradedPublicSync",
        "Add-MonitorFailure -Message '[FAIL] health.publicSync.configured=false' -AllowDegraded:$AllowDegradedPublicSync",
        'Add-MonitorFailure -Message "[FAIL] health.publicSync unhealthy (state=$publicSyncState, failureReason=$publicSyncFailureReason, headDrift=$publicSyncHeadDrift, telemetryGap=$publicSyncTelemetryGap, dirtyPathsCount=$publicSyncDirtyPathsCount)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] health.publicSync head drift (currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] health.publicSync telemetry gap (failureReason=$publicSyncFailureReason lastErrorMessage=$publicSyncLastErrorMessage)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] health.publicSync working tree dirty (dirtyPathsCount=$publicSyncDirtyPathsCount dirtyPathsSample=$publicSyncDirtyPathsSampleLabel)" -AllowDegraded:$AllowDegradedPublicSync',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod ops readme documenta el monitor como consumidor de publicSync', () => {
    const raw = load(README_PATH);
    const requiredSnippets = [
        'MONITOR-PRODUCCION.ps1',
        'AllowDegradedPublicSync',
        'failureReason',
        'headDrift',
        'telemetryGap',
        'dirtyPathsCount',
        'dirtyPathsSample',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de documentacion del monitor en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});

test('runbook enlaza el monitor con el triage canonico de public sync', () => {
    const raw = load(RUNBOOK_PATH);
    const requiredSnippets = [
        'MONITOR-PRODUCCION.ps1',
        'AllowDegradedPublicSync',
        'failureReason',
        'headDrift',
        'telemetryGap',
        'dirtyPathsSample',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del runbook para MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});
