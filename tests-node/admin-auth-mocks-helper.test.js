#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const vm = require('vm');

const {
    buildOperatorAuthChallenge,
    installWindowOpenRecorder,
} = require('../tests/helpers/admin-auth-mocks');

const QUEUE_OPERATOR_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-operator.spec.js'
);
const SHARED_SESSION_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'operator-auth-shared-session.spec.js'
);

test('buildOperatorAuthChallenge expone defaults canonicos del operador', () => {
    const challenge = buildOperatorAuthChallenge();

    assert.equal(challenge.challengeId, 'challenge-operator-openclaw');
    assert.equal(challenge.manualCode, 'OPR123-456XYZ');
    assert.equal(challenge.pollAfterMs, 50);
    assert.equal(challenge.status, 'pending');
    assert.match(
        challenge.helperUrl,
        /resolve\?challenge=challenge-operator-openclaw$/
    );
    assert.ok(
        Number.isFinite(Date.parse(challenge.expiresAt)),
        'expiresAt debe ser una fecha ISO valida'
    );
});

test('buildOperatorAuthChallenge respeta defaults externos y overrides explicitos', () => {
    const challenge = buildOperatorAuthChallenge(
        {
            manualCode: 'SHARED-007',
            status: 'ready',
        },
        {
            challengeId: 'shared-openclaw-7',
            pollAfterMs: 75,
        }
    );

    assert.equal(challenge.challengeId, 'shared-openclaw-7');
    assert.equal(challenge.manualCode, 'SHARED-007');
    assert.equal(challenge.pollAfterMs, 75);
    assert.equal(challenge.status, 'ready');
    assert.match(challenge.helperUrl, /shared-openclaw-7$/);
});

test('installWindowOpenRecorder registra popup recorder reutilizable', async () => {
    let initScript = null;
    let initPayload = null;
    const page = {
        async addInitScript(fn, payload) {
            initScript = fn;
            initPayload = payload;
        },
    };

    await installWindowOpenRecorder(page);

    assert.equal(typeof initScript, 'function');
    assert.deepEqual(initPayload, { popupBlocked: false });

    const sandbox = {
        payload: initPayload,
        window: {},
    };
    vm.createContext(sandbox);
    vm.runInContext(`(${initScript.toString()})(payload);`, sandbox);

    assert.deepEqual(Array.from(sandbox.window.__openedUrls), []);
    const popup = sandbox.window.open('https://example.com/openclaw');
    assert.equal(typeof popup.focus, 'function');
    assert.deepEqual(Array.from(sandbox.window.__openedUrls), [
        'https://example.com/openclaw',
    ]);
});

test('installWindowOpenRecorder soporta popup bloqueado', async () => {
    let initScript = null;
    let initPayload = null;
    const page = {
        async addInitScript(fn, payload) {
            initScript = fn;
            initPayload = payload;
        },
    };

    await installWindowOpenRecorder(page, { blocked: true });

    const sandbox = {
        payload: initPayload,
        window: {},
    };
    vm.createContext(sandbox);
    vm.runInContext(`(${initScript.toString()})(payload);`, sandbox);

    const popup = sandbox.window.open('https://example.com/openclaw');
    assert.equal(popup, null);
    assert.deepEqual(Array.from(sandbox.window.__openedUrls), [
        'https://example.com/openclaw',
    ]);
});

test('queue-operator y shared-session consumen el helper compartido sin duplicar utilidades', () => {
    const queueOperatorSpec = readFileSync(QUEUE_OPERATOR_SPEC_PATH, 'utf8');
    const sharedSessionSpec = readFileSync(SHARED_SESSION_SPEC_PATH, 'utf8');

    assert.match(
        queueOperatorSpec,
        /buildOperatorAuthChallenge,\s+installLegacyAdminAuthMock,\s+installWindowOpenRecorder/
    );
    assert.doesNotMatch(
        queueOperatorSpec,
        /function buildOperatorAuthChallenge\(/
    );
    assert.doesNotMatch(
        queueOperatorSpec,
        /async function installWindowOpenRecorder\(/
    );

    assert.match(
        sharedSessionSpec,
        /buildOperatorAuthChallenge,\s+installWindowOpenRecorder/
    );
    assert.doesNotMatch(
        sharedSessionSpec,
        /function buildOperatorAuthChallenge\(/
    );
    assert.doesNotMatch(
        sharedSessionSpec,
        /async function installWindowOpenRecorder\(/
    );
});
