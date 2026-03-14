'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');
const PROD_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'README.md'
);
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'RUNBOOK_TURNERO_APPS_RELEASE.md'
);
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');

function loadText(filePath) {
    return readFileSync(filePath, 'utf8');
}

function loadPackageScripts() {
    const raw = loadText(PACKAGE_PATH);
    return JSON.parse(raw).scripts || {};
}

test('package.json expone un carril web-pilot sin dependencia obligatoria del lane nativo', () => {
    const scripts = loadPackageScripts();

    const requiredScripts = [
        'test:turnero:web-pilot:contracts',
        'test:turnero:web-pilot:php-contract',
        'test:turnero:web-pilot:ui',
        'gate:turnero:web-pilot',
        'verify:prod:turnero:web-pilot',
        'smoke:prod:turnero:web-pilot',
        'gate:prod:turnero:web-pilot',
    ];

    for (const scriptName of requiredScripts) {
        assert.equal(
            typeof scripts[scriptName] === 'string' &&
                scripts[scriptName].trim() !== '',
            true,
            `falta script canonico del carril web-pilot: ${scriptName}`
        );
    }

    for (const scriptName of [
        'verify:prod:turnero:web-pilot',
        'smoke:prod:turnero:web-pilot',
        'gate:prod:turnero:web-pilot',
    ]) {
        const command = String(scripts[scriptName] || '');
        assert.equal(
            command.includes('-RequireTurneroWebSurfaces'),
            true,
            `${scriptName} debe exigir las superficies web del piloto`
        );
        assert.equal(
            command.includes('-RequireTurneroOperatorPilot'),
            false,
            `${scriptName} no debe depender del carril nativo/operator pilot`
        );
    }
});

test('gate:turnero:web-pilot limita los contratos al frente web por clinica', () => {
    const scripts = loadPackageScripts();
    const command = String(scripts['test:turnero:web-pilot:contracts'] || '');

    for (const snippet of [
        'admin-data-turnero-clinic-profile-contract.test.js',
        'health-turnero-pilot-contract.test.js',
        'turnero-clinic-profile-registry.test.js',
        'turnero-clinic-profile-cli.test.js',
        'turnero-surface-registry.test.js',
        'turnero-runtime-contract.test.js',
        'queue-pilot-smoke-signal-contract.test.js',
        'queue-operator-shell-state.test.js',
        'queue-operator-heartbeat-payload.test.js',
        'turnero-web-pilot-gate-contract.test.js',
    ]) {
        assert.equal(
            command.includes(snippet),
            true,
            `test:turnero:web-pilot:contracts debe cubrir ${snippet}`
        );
    }

    for (const forbidden of [
        'stage-turnero-app-release-script.test.js',
        'verify-turnero-release-bundle-script.test.js',
        'turnero-operator-pilot-publish-contract.test.js',
        'desktop-shell-support.test.js',
        'turnero-desktop-boot-view-state.test.js',
        'public-v6-software-native-apps-contract.test.js',
    ]) {
        assert.equal(
            command.includes(forbidden),
            false,
            `test:turnero:web-pilot:contracts no debe arrastrar scope nativo: ${forbidden}`
        );
    }

    assert.match(
        String(scripts['gate:turnero:web-pilot'] || ''),
        /test:turnero:web-pilot:contracts/
    );
    assert.match(
        String(scripts['gate:turnero:web-pilot'] || ''),
        /test:turnero:web-pilot:php-contract/
    );
    assert.match(
        String(scripts['gate:turnero:web-pilot'] || ''),
        /test:turnero:web-pilot:ui/
    );
});

test('runbooks promueven el carril web-pilot como gate canonico del piloto web', () => {
    for (const [filePath, requiredSnippets] of [
        [
            PROD_README_PATH,
            [
                'verify:prod:turnero:web-pilot',
                'smoke:prod:turnero:web-pilot',
                'gate:prod:turnero:web-pilot',
                'carril canonico del piloto web por clinica',
                'turnero:operator:pilot',
            ],
        ],
        [
            RUNBOOK_PATH,
            [
                'gate:turnero:web-pilot',
                'verify:prod:turnero:web-pilot',
                'smoke:prod:turnero:web-pilot',
                'gate:prod:turnero:web-pilot',
                'release ampliado que tambien incluye el carril nativo',
            ],
        ],
        [
            OPERATIONS_INDEX_PATH,
            [
                'Operar Turnero web pilot',
                'gate:turnero:web-pilot',
                'verify:prod:turnero:web-pilot',
                'smoke:prod:turnero:web-pilot',
                'Operar Turnero nativo',
                'verify:prod:turnero:operator:pilot',
            ],
        ],
    ]) {
        const raw = loadText(filePath);
        for (const snippet of requiredSnippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta documentacion del carril web-pilot en ${filePath}: ${snippet}`
            );
        }
    }
});
