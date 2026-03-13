#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const VERIFY_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);
const MONITOR_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'MONITOR-PRODUCCION.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod verify reutiliza el diagnostico OpenClaw del admin cuando RequireOperatorAuth esta activo', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1',
        'function Invoke-OpenClawAuthRolloutDiagnostic',
        '& powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Domain $BaseUrl -AllowNotReady -ReportPath $reportPath',
        "diagnosis = 'diagnostic_script_missing'",
        "diagnosis = 'diagnostic_script_failed'",
        'if ($RequireOperatorAuth) {',
        '$operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath',
        '[INFO] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured)',
        "Asset = 'operator-auth-rollout'",
        'RemoteHash = "diagnosis=$($operatorAuthRollout.diagnosis);mode=$($operatorAuthRollout.mode);configured=$($operatorAuthRollout.configured)"',
        'Detail = [string]$operatorAuthRollout.nextAction',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring OpenClaw rollout en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod monitor reutiliza el diagnostico OpenClaw del admin cuando RequireOperatorAuth esta activo', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1',
        'function Invoke-OpenClawAuthRolloutDiagnostic',
        '& powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Domain $BaseUrl -AllowNotReady -ReportPath $reportPath',
        "diagnosis = 'diagnostic_script_missing'",
        "diagnosis = 'diagnostic_script_failed'",
        'if ($RequireOperatorAuth) {',
        '$operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath',
        '[INFO] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured)',
        'Add-MonitorFailure -Message "[FAIL] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured) nextAction=$($operatorAuthRollout.nextAction)" -AllowDegraded:$false',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring OpenClaw rollout en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod ops readme documenta el diagnostico OpenClaw embebido en verify y monitor', () => {
    const raw = load(README_PATH);
    const requiredSnippets = [
        'DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1',
        'operator auth rollout diagnosis',
        'openclaw_mode_disabled',
        'admin_auth_legacy_facade',
        'facade_only_rollout',
        'openclaw_not_configured',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta documentacion OpenClaw rollout en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});
