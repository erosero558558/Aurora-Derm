#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const SCRIPT_PATH = resolve(__dirname, '..', 'GATE-ADMIN-ROLLOUT.ps1');

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

test('admin rollout gate expone stages canonicos y contrato v3', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes(
            "[ValidateSet('internal', 'canary', 'general', 'rollback')]"
        ),
        true,
        'falta validate set canonico de stages'
    );
    assert.equal(
        raw.includes('has_admin_sony_ui_v3 = $false'),
        true,
        'falta contrato de flag admin_sony_ui_v3 en el reporte'
    );
    assert.equal(
        raw.includes('expected_admin_sony_ui_v3 = $null'),
        true,
        'falta expectativa stage-aware para admin_sony_ui_v3'
    );
});

test('admin rollout gate registra suites runtime stage-aware', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('runtime_smoke = [ordered]@{'),
        true,
        'falta bloque runtime_smoke en el reporte'
    );
    assert.equal(
        raw.includes('suites = @()'),
        true,
        'falta coleccion de suites runtime en el reporte'
    );
    assert.equal(
        raw.includes("Name = 'admin-ui-runtime'"),
        true,
        'falta suite base admin-ui-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-ui-runtime-smoke.spec.js')"),
        true,
        'falta spec base admin-ui-runtime-smoke'
    );
    assert.equal(
        raw.includes("Name = 'admin-v3-canary-runtime'"),
        true,
        'falta suite admin-v3-canary-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-v3-canary-runtime.spec.js')"),
        true,
        'falta spec admin-v3-canary-runtime'
    );
    assert.equal(
        raw.includes("$Stage -eq 'canary' -or"),
        true,
        'falta condicion stage-aware para canary/general'
    );
    assert.equal(
        raw.includes("($Stage -eq 'internal' -and $featureValueV3 -eq $true)"),
        true,
        'falta condicion interna dependiente de admin_sony_ui_v3'
    );
});

test('admin rollout gate persiste resultados suite por suite', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('$suiteResult = Invoke-PlaywrightSmokeSuite'),
        true,
        'falta ejecucion de suites runtime via helper reusable'
    );
    assert.equal(
        raw.includes('$report.runtime_smoke.suites += [ordered]@{'),
        true,
        'falta persistencia de resultado por suite'
    );
    assert.equal(
        raw.includes('exit_code = [int]$suiteResult.exit_code'),
        true,
        'falta exit_code por suite en el reporte'
    );
    assert.equal(
        raw.includes('specs = @($suiteResult.specs)'),
        true,
        'falta lista de specs por suite en el reporte'
    );
});
