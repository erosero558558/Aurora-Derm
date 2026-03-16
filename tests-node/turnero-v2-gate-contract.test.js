'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');

function loadPackageScripts() {
    const raw = readFileSync(PACKAGE_PATH, 'utf8');
    return JSON.parse(raw).scripts || {};
}

test('package.json expone scripts canonicos para Turnero V2', () => {
    const scripts = loadPackageScripts();

    for (const scriptName of [
        'test:turnero:v2:contracts',
        'test:turnero:v2:php-contract',
        'test:turnero:v2:ui',
        'gate:turnero:v2',
        'verify:prod:turnero:v2',
        'smoke:prod:turnero:v2',
        'gate:prod:turnero:v2',
    ]) {
        assert.equal(
            typeof scripts[scriptName] === 'string' &&
                scripts[scriptName].trim() !== '',
            true,
            `falta script canonico de Turnero V2: ${scriptName}`
        );
    }
});

test('gate:turnero promueve Turnero V2 como carril canonico actual', () => {
    const scripts = loadPackageScripts();

    assert.match(String(scripts['gate:turnero'] || ''), /gate:turnero:v2/);
    assert.match(
        String(scripts['test:turnero:v2:contracts'] || ''),
        /test:turnero:contracts/
    );
    assert.match(
        String(scripts['test:turnero:v2:php-contract'] || ''),
        /test:turnero:php-contract/
    );
    assert.match(
        String(scripts['test:turnero:v2:ui'] || ''),
        /test:turnero:ui/
    );
});

test('los contratos y verificaciones V2 cubren PIN operativo y lane nativo', () => {
    const scripts = loadPackageScripts();

    assert.match(
        String(scripts['test:turnero:contracts'] || ''),
        /turnero-v2-gate-contract\.test\.js/
    );
    assert.match(
        String(scripts['test:turnero:php-contract'] || ''),
        /test_turnero_operator_pin\.php/
    );
    assert.match(
        String(scripts['verify:prod:turnero:v2'] || ''),
        /verify:prod:turnero:operator:pilot/
    );
    assert.match(
        String(scripts['smoke:prod:turnero:v2'] || ''),
        /smoke:prod:turnero:operator:pilot/
    );
    assert.match(
        String(scripts['gate:prod:turnero:v2'] || ''),
        /gate:prod:turnero:operator:pilot/
    );
});
