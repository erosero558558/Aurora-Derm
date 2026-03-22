#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'admin',
    'DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1'
);
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json');
const ADMIN_OPS_README_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'admin',
    'README.md'
);
const OPERATIONS_INDEX_PATH = resolve(
    __dirname,
    '..',
    'docs',
    'OPERATIONS_INDEX.md'
);
const ADMIN_ROLLOUT_DOC_PATH = resolve(
    __dirname,
    '..',
    'docs',
    'ADMIN-UI-ROLLOUT.md'
);

function loadFile(path) {
    return readFileSync(path, 'utf8');
}

test('diagnostico Operator Auth del rollout admin publica contrato y clasificaciones canonicas', () => {
    const raw = loadFile(SCRIPT_PATH);

    assert.equal(
        raw.includes(
            "[string]$ReportPath = 'verification/last-admin-openclaw-auth-diagnostic.json'"
        ),
        true,
        'falta ReportPath canonico para el diagnostico OpenClaw'
    );
    assert.equal(
        raw.includes('operator_auth_status = [ordered]@{'),
        true,
        'falta snapshot de operator_auth_status'
    );
    assert.equal(
        raw.includes('admin_auth_facade = [ordered]@{'),
        true,
        'falta snapshot de admin_auth_facade'
    );
    assert.equal(
        raw.includes('resolved = [ordered]@{'),
        true,
        'falta bloque resolved en el diagnostico'
    );
    assert.equal(
        raw.includes("diagnosis = 'facade_only_rollout'"),
        true,
        'falta diagnostico facade_only_rollout'
    );
    assert.equal(
        raw.includes("diagnosis = 'operator_auth_ready'"),
        true,
        'falta diagnostico operator_auth_ready'
    );
    assert.equal(
        raw.includes("diagnosis = 'operator_auth_not_configured'"),
        true,
        'falta diagnostico operator_auth_not_configured'
    );
    assert.equal(
        raw.includes("diagnosis = 'admin_auth_legacy_facade'"),
        true,
        'falta diagnostico admin_auth_legacy_facade'
    );
    assert.equal(
        raw.includes("diagnosis = 'operator_auth_edge_failure'"),
        true,
        'falta diagnostico operator_auth_edge_failure'
    );
    assert.equal(
        raw.includes('[INFO] nextAction='),
        true,
        'falta salida nextAction en el diagnostico'
    );
});

test('package y docs publican el diagnostico de rollout Operator Auth del admin', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);
    const adminOpsReadme = loadFile(ADMIN_OPS_README_PATH);
    const operationsIndex = loadFile(OPERATIONS_INDEX_PATH);
    const adminRolloutDoc = loadFile(ADMIN_ROLLOUT_DOC_PATH);

    assert.equal(
        packageJson.includes(
            '"diagnose:admin:auth:rollout": "powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1 -Domain https://pielarmonia.com"'
        ),
        true,
        'package.json debe exponer diagnose:admin:auth:rollout'
    );
    assert.equal(
        adminOpsReadme.includes('npm run diagnose:admin:auth:rollout'),
        true,
        'README de admin ops debe documentar el diagnostico Operator Auth'
    );
    assert.equal(
        operationsIndex.includes('npm run diagnose:admin:auth:rollout'),
        true,
        'Operations Index debe incluir el diagnostico Operator Auth del admin'
    );
    assert.equal(
        adminRolloutDoc.includes('diagnose:admin:auth:rollout'),
        true,
        'ADMIN-UI-ROLLOUT debe incluir el diagnostico Operator Auth del rollout'
    );
});
