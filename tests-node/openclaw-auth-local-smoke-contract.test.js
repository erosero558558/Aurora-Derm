#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const BIN_PATH = resolve(REPO_ROOT, 'bin', 'openclaw-auth-local-smoke.js');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'SMOKE-OPENCLAW-AUTH-LOCAL.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'admin', 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const LEADOPS_DOC_PATH = resolve(REPO_ROOT, 'docs', 'LEADOPS_OPENCLAW.md');
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('smoke local OpenClaw reutiliza fachada admin-auth y helper canonico', () => {
    const raw = load(BIN_PATH);
    const requiredSnippets = [
        'openclaw-auth-preflight.js',
        'openclaw-auth-helper.js',
        '/admin-auth.php?action=start',
        '/admin-auth.php?action=status',
        '/admin-auth.php?action=logout',
        'resolveOperatorChallenge',
        'readyForLogin',
        "stage: 'preflight'",
        "stage = 'completed'",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo en openclaw-auth-local-smoke.js: ${snippet}`
        );
    }
});

test('package y docs exponen el smoke local de Operator Auth con alias legacy', () => {
    const pkg = JSON.parse(load(PACKAGE_JSON_PATH));
    const script = load(SCRIPT_PATH);
    const readme = load(README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const leadopsDoc = load(LEADOPS_DOC_PATH);

    assert.equal(
        String(pkg.scripts?.['smoke:admin:auth:local'] || '').includes(
            './scripts/ops/admin/SMOKE-OPENCLAW-AUTH-LOCAL.ps1'
        ),
        true,
        'package.json debe exponer smoke:admin:auth:local'
    );
    assert.equal(
        String(pkg.scripts?.['smoke:admin:openclaw-auth:local'] || '').trim(),
        'npm run smoke:admin:auth:local',
        'package.json debe mantener smoke:admin:openclaw-auth:local como alias legacy'
    );
    assert.equal(
        script.includes('bin/openclaw-auth-local-smoke.js'),
        true,
        'wrapper PowerShell debe delegar al bin canonico del smoke'
    );

    for (const snippet of [
        'SMOKE-OPENCLAW-AUTH-LOCAL.ps1',
        'smoke:admin:auth:local',
    ]) {
        assert.equal(
            readme.includes(snippet),
            true,
            `README admin ops debe documentar el smoke local: ${snippet}`
        );
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `OPERATIONS_INDEX debe documentar el smoke local: ${snippet}`
        );
        assert.equal(
            leadopsDoc.includes(snippet),
            true,
            `docs/LEADOPS_OPENCLAW.md debe documentar el smoke local: ${snippet}`
        );
    }
});
