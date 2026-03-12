#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const WRAPPER_PATH = resolve(__dirname, '..', 'REPORTE-SEMANAL-PRODUCCION.ps1');
const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'prod',
    'REPORTE-SEMANAL-PRODUCCION.ps1'
);

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

function loadWrapper() {
    return readFileSync(WRAPPER_PATH, 'utf8');
}

test('weekly report root wrapper delega a la implementacion canonica de prod ops', () => {
    const raw = loadWrapper();

    assert.equal(
        raw.includes('scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1'),
        true,
        'wrapper root debe apuntar a scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1'
    );
    assert.equal(
        raw.includes('Push-Location $PSScriptRoot'),
        true,
        'wrapper root debe fijar cwd al repo root'
    );
});

test('weekly report script expone parametros de ciclo semanal', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '[int]$CriticalFreeCycleTarget = 2',
        '[switch]$FailOnCycleNotReady',
        '$CriticalFreeCycleTarget -lt 1',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de parametro/guardrail: ${snippet}`
        );
    }
});

test('weekly report script publica weeklyCycle en markdown y JSON', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '## Weekly Cycle Guardrail',
        '$weeklyCycleHistoryBlock',
        '$weeklyCyclePayload = [ordered]@{}',
        '$weeklyCyclePayload.targetConsecutiveNoCritical = $weeklyCycleTarget',
        '$weeklyCyclePayload.consecutiveNoCritical = $weeklyCycleConsecutiveNoCritical',
        '$weeklyCyclePayload.ready = [bool]$weeklyCycleReady',
        '$reportPayload.weeklyCycle = $weeklyCyclePayload',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de salida weeklyCycle: ${snippet}`
        );
    }
});

test('weekly report script soporta fail opcional por ciclo no listo', () => {
    const raw = loadScript();
    const requiredSnippets = [
        'if ($FailOnCycleNotReady -and -not $weeklyCycleReady)',
        'FailOnCycleNotReady activo: ciclo semanal no listo',
        'Get-WeeklyCycleEvaluation',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de fail/gobernanza ciclo: ${snippet}`
        );
    }
});

test('weekly report script integra bloque telemedicina operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        '[int]$TelemedicineReviewQueueWarnCount = 12',
        '[int]$TelemedicineStagedUploadsWarnCount = 1',
        '[int]$TelemedicineUnlinkedIntakesWarnCount = 5',
        'telemedicine_diagnostics_status',
        'telemedicine_diagnostics_critical_',
        'telemedicine_case_photos_missing_private_path_',
    ];
    const requiredWarningsSnippets = [
        '## Telemedicine Ops',
        'telemedicine = [ordered]@{',
        "if ($WarningCode.StartsWith('telemedicine_')) {",
        'telemedicine = @()',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet telemedicina en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet telemedicina en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque public sync operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "$publicSyncCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'publicSync' -DefaultValue $null",
        '$publicSyncExpectedMaxLagSeconds',
        '$publicSyncLastCheckedAt',
        '$publicSyncTelemetryGap',
        'public_sync_unconfigured',
        'public_sync_working_tree_dirty_${publicSyncDirtyPathsCount}',
        'public_sync_telemetry_gap',
        'public_sync_last_error_message=$publicSyncLastErrorMessage',
        'public_sync_current_head=$publicSyncCurrentHead',
        'public_sync_dirty_paths_sample=$publicSyncDirtyPathsSampleLabel',
    ];
    const requiredWarningsSnippets = [
        '## Public Sync Ops',
        'publicSync = [ordered]@{',
        'expectedMaxLagSeconds = $publicSyncExpectedMaxLagSeconds',
        'lastErrorMessage = $publicSyncLastErrorMessage',
        'dirtyPathsSample = @($publicSyncDirtyPathsSample)',
        'telemetryGap = [bool]$publicSyncTelemetryGap',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet publicSync en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet publicSync en Common.Warnings.ps1: ${snippet}`
        );
    }

    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('public_sync_'\)\) \{\s+return 'observability'/,
        'publicSync debe mapearse a impacto observability'
    );
    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('public_sync_'\)\) \{\s+return 'docs\/PUBLIC_MAIN_UPDATE_RUNBOOK\.md'/,
        'publicSync debe apuntar al runbook canonico'
    );
});

test('weekly report script integra bloque lead ops comercial', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        '[int]$LeadOpsPendingWarnCount = 20',
        '[int]$LeadOpsHotWarnCount = 8',
        '[int]$LeadOpsFirstContactWarnMinSamples = 3',
        '[double]$LeadOpsAiAcceptanceMinWarnPct = 25',
        "$leadOpsCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'leadOps' -DefaultValue $null",
        "$leadOpsFirstContactAvgMinutes = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'firstContactAvgMinutes' -DefaultValue 0)",
        'leadops_worker_${leadOpsMode}',
        'leadops_pending_queue_alta_${leadOpsPendingCallbacks}',
        'leadops_hot_queue_alta_${leadOpsPriorityHot}',
        'leadops_ai_backlog_${leadOpsAiRequested}',
        'leadops_first_contact_promedio_alto_${leadOpsFirstContactAvgMinutes}min',
        'leadops_close_rate_baja_${leadOpsCloseFromContactedRatePct}pct',
        'leadops_ai_acceptance_baja_${leadOpsAiAcceptanceRatePct}pct',
        'leadops_configured=$leadOpsConfigured',
    ];
    const requiredWarningsSnippets = [
        '## LeadOps',
        "if ($WarningCode.StartsWith('leadops_')) {",
        'leadOps = [ordered]@{',
        'pendingWarnCount = $LeadOpsPendingWarnCount',
        'hotWarnCount = $LeadOpsHotWarnCount',
        'firstContactWarnMinSamples = $LeadOpsFirstContactWarnMinSamples',
        'closeRateMinWarnPct = [Math]::Round([double]$LeadOpsCloseRateMinWarnPct, 2)',
        'aiAcceptanceMinWarnPct = [Math]::Round([double]$LeadOpsAiAcceptanceMinWarnPct, 2)',
        '- leadops_first_contact_avg_minutes: $leadOpsFirstContactAvgMinutes',
        '- leadops_close_from_contacted_rate_pct: $leadOpsCloseFromContactedRatePct',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet leadOps en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet leadOps en Common.Warnings.ps1: ${snippet}`
        );
    }
});
