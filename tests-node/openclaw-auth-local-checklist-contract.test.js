#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1'
);
const ADMIN_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'README.md'
);
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const LEADOPS_DOC_PATH = resolve(REPO_ROOT, 'docs', 'LEADOPS_OPENCLAW.md');
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('checklist local de OpenClaw auth expone comandos canonicos de smoke operador', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$ServerBaseUrl = 'https://pielarmonia.com'",
        "[string]$HelperBaseUrl = 'http://127.0.0.1:4173'",
        "[string]$RuntimeBaseUrl = 'http://127.0.0.1:4141'",
        'npm run openclaw:auth-preflight -- --json',
        'npm run openclaw:auth:start',
        '/api.php?resource=operator-auth-status',
        '/admin-auth.php?action=status',
        'node agent-orchestrator.js runtime verify pilot_runtime --json',
        'admin.html no muestra password ni 2FA',
        'status=autenticado',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo en CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1: ${snippet}`
        );
    }
});

test('package y docs publican el checklist local de Operator Auth con alias legacy', () => {
    const pkg = JSON.parse(load(PACKAGE_JSON_PATH));
    const adminReadme = load(ADMIN_README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const leadopsDoc = load(LEADOPS_DOC_PATH);

    assert.equal(
        String(pkg.scripts?.['checklist:admin:auth:local'] || '').includes(
            './scripts/ops/admin/CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1'
        ),
        true,
        'package.json debe exponer checklist:admin:auth:local'
    );
    assert.equal(
        String(pkg.scripts?.['checklist:admin:openclaw-auth:local'] || '').trim(),
        'npm run checklist:admin:auth:local',
        'package.json debe mantener checklist:admin:openclaw-auth:local como alias legacy'
    );

    for (const snippet of [
        'CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1',
        'checklist:admin:auth:local',
    ]) {
        assert.equal(
            adminReadme.includes(snippet),
            true,
            `README admin ops debe documentar el checklist local: ${snippet}`
        );
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `OPERATIONS_INDEX debe documentar el checklist local: ${snippet}`
        );
        assert.equal(
            leadopsDoc.includes(snippet),
            true,
            `docs/LEADOPS_OPENCLAW.md debe documentar el checklist local: ${snippet}`
        );
    }
});
