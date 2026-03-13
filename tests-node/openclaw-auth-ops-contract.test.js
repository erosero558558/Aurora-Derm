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
    'INICIAR-OPENCLAW-AUTH-HELPER.ps1'
);
const ADMIN_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'README.md'
);
const LEADOPS_DOC_PATH = resolve(REPO_ROOT, 'docs', 'LEADOPS_OPENCLAW.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const ADMIN_ROLLOUT_DOC_PATH = resolve(
    REPO_ROOT,
    'docs',
    'ADMIN-UI-ROLLOUT.md'
);
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('launcher local de OpenClaw auth ejecuta preflight antes de iniciar el helper', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        'bin/openclaw-auth-preflight.js',
        'bin/openclaw-auth-helper.js',
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN',
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET',
        'OPENCLAW_RUNTIME_BASE_URL',
        'readyForLogin',
        'nextAction',
        'SkipPreflight',
        'El preflight OpenClaw no cumplio los requisitos minimos',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet operativo en launcher local OpenClaw: ${snippet}`
        );
    }
});

test('package y docs exponen el launcher local como surface canonica del auth OpenClaw', () => {
    const pkg = JSON.parse(load(PACKAGE_JSON_PATH));
    const adminReadme = load(ADMIN_README_PATH);
    const leadopsDoc = load(LEADOPS_DOC_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const adminRolloutDoc = load(ADMIN_ROLLOUT_DOC_PATH);

    assert.equal(
        String(pkg.scripts?.['openclaw:auth:start'] || '').includes(
            './scripts/ops/admin/INICIAR-OPENCLAW-AUTH-HELPER.ps1'
        ),
        true,
        'package.json debe exponer openclaw:auth:start con el entrypoint canonico'
    );

    for (const snippet of [
        'INICIAR-OPENCLAW-AUTH-HELPER.ps1',
        'openclaw:auth:start',
    ]) {
        assert.equal(
            adminReadme.includes(snippet),
            true,
            `README de admin ops debe documentar el launcher local: ${snippet}`
        );
    }

    for (const snippet of [
        'npm run openclaw:auth:start',
        'scripts/ops/admin/INICIAR-OPENCLAW-AUTH-HELPER.ps1',
    ]) {
        assert.equal(
            leadopsDoc.includes(snippet),
            true,
            `docs/LEADOPS_OPENCLAW.md debe documentar el launcher local: ${snippet}`
        );
    }

    assert.equal(
        operationsIndex.includes('npm run openclaw:auth:start'),
        true,
        'OPERATIONS_INDEX debe documentar el launcher local'
    );

    assert.equal(
        adminRolloutDoc.includes('npm run openclaw:auth:start'),
        true,
        'ADMIN-UI-ROLLOUT debe documentar el launcher local'
    );
});
