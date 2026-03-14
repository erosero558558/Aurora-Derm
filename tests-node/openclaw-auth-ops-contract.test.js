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
const ROOT_README_PATH = resolve(REPO_ROOT, 'README.md');
const LOCAL_SERVER_DOC_PATH = resolve(REPO_ROOT, 'docs', 'LOCAL_SERVER.md');
const LEADOPS_DOC_PATH = resolve(REPO_ROOT, 'docs', 'LEADOPS_OPENCLAW.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const ADMIN_ROLLOUT_DOC_PATH = resolve(
    REPO_ROOT,
    'docs',
    'ADMIN-UI-ROLLOUT.md'
);
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json');
const LEGACY_ALIAS_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'admin',
    'OPENCLAW-OPERATOR-AUTH-BRIDGE.ps1'
);

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
    const rootReadme = load(ROOT_README_PATH);
    const localServerDoc = load(LOCAL_SERVER_DOC_PATH);
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
        assert.equal(
            rootReadme.includes(snippet),
            true,
            `README raiz debe documentar el launcher local: ${snippet}`
        );
        assert.equal(
            localServerDoc.includes(snippet),
            true,
            `docs/LOCAL_SERVER.md debe documentar el launcher local: ${snippet}`
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

test('alias legacy del bridge delega al launcher canonico con warning deprecado', () => {
    const raw = load(LEGACY_ALIAS_SCRIPT_PATH);

    assert.equal(
        raw.includes('INICIAR-OPENCLAW-AUTH-HELPER.ps1'),
        true,
        'el alias legacy debe delegar al launcher canonico'
    );
    assert.equal(
        raw.toLowerCase().includes('deprecated'),
        true,
        'el alias legacy debe emitir warning deprecado'
    );
});

test('docs y scripts del auth OpenClaw no reintroducen el runtime legacy y documentan la contingencia', () => {
    const adminReadme = load(ADMIN_README_PATH);
    const rootReadme = load(ROOT_README_PATH);
    const localServerDoc = load(LOCAL_SERVER_DOC_PATH);
    const leadopsDoc = load(LEADOPS_DOC_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const adminRolloutDoc = load(ADMIN_ROLLOUT_DOC_PATH);
    const aliasScript = load(LEGACY_ALIAS_SCRIPT_PATH);
    const canonicalLauncher = load(SCRIPT_PATH);

    for (const surface of [
        adminReadme,
        rootReadme,
        localServerDoc,
        leadopsDoc,
        operationsIndex,
        adminRolloutDoc,
        aliasScript,
        canonicalLauncher,
    ]) {
        assert.equal(
            surface.includes('openclaw models status --json'),
            false,
            'ninguna surface operativa debe volver a documentar el chequeo legacy por models status'
        );
    }

    for (const snippet of [
        'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK',
        'PIELARMONIA_ADMIN_2FA_SECRET',
        'fallbacks.legacy_password.available=true',
    ]) {
        assert.equal(
            adminRolloutDoc.includes(snippet),
            true,
            `ADMIN-UI-ROLLOUT debe documentar la contingencia web: ${snippet}`
        );
    }

    for (const [label, surface] of [
        ['README admin ops', adminReadme],
        ['docs/LEADOPS_OPENCLAW.md', leadopsDoc],
    ]) {
        for (const snippet of [
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK',
            'PIELARMONIA_ADMIN_2FA_SECRET',
            'fallbacks.legacy_password.available=true',
        ]) {
            assert.equal(
                surface.includes(snippet),
                true,
                `${label} debe documentar la contingencia web: ${snippet}`
            );
        }
    }
});
