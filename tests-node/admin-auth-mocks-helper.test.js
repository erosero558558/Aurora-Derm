#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const vm = require('vm');

const {
    buildOperatorAuthChallenge,
    buildOperatorQueueState,
    buildOperatorQueueTicket,
    installOperatorOpenClawAuthMock,
    installWindowOpenRecorder,
} = require('../tests/helpers/admin-auth-mocks');

const QUEUE_OPERATOR_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-operator.spec.js'
);
const ADMIN_QUEUE_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'admin-queue.spec.js'
);
const SHARED_SESSION_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'operator-auth-shared-session.spec.js'
);
const QUEUE_INTEGRATED_FLOW_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-integrated-flow.spec.js'
);

function createRouteHarness() {
    let routeHandler = null;

    return {
        target: {
            async route(_pattern, handler) {
                routeHandler = handler;
            },
        },
        async dispatch(action, method = 'GET') {
            let fulfilled = null;
            await routeHandler({
                request() {
                    return {
                        url() {
                            return `https://example.test/admin-auth.php?action=${action}`;
                        },
                        method() {
                            return method;
                        },
                    };
                },
                fulfill(payload) {
                    fulfilled = payload;
                    return payload;
                },
            });

            return {
                ...fulfilled,
                payload: JSON.parse(String(fulfilled.body || '{}')),
            };
        },
    };
}

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

test('buildOperatorQueueTicket y buildOperatorQueueState generan defaults canonicos del operador', () => {
    const ticket = buildOperatorQueueTicket({
        ticketCode: 'C-2201',
        patientInitials: 'EA',
    });
    const queueState = buildOperatorQueueState(ticket);

    assert.equal(ticket.ticketCode, 'C-2201');
    assert.equal(ticket.patientInitials, 'EA');
    assert.equal(ticket.status, 'waiting');
    assert.equal(queueState.waitingCount, 1);
    assert.equal(queueState.calledCount, 0);
    assert.deepEqual(queueState.callingNow, []);
    assert.equal(queueState.nextTickets.length, 1);
    assert.equal(queueState.nextTickets[0].ticketCode, 'C-2201');
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

test('installOperatorOpenClawAuthMock modela start/status/logout reutilizable', async () => {
    const harness = createRouteHarness();
    const session = await installOperatorOpenClawAuthMock(harness.target, {
        autoAuthenticateOnPendingStatus: true,
        authenticatedPayload: {
            csrfToken: 'csrf_shared_operator_auth',
        },
        startResponseFactory(startCount) {
            return {
                ok: true,
                authenticated: false,
                mode: 'openclaw_chatgpt',
                status: 'pending',
                challenge: buildOperatorAuthChallenge({
                    challengeId: `shared-openclaw-${startCount}`,
                    manualCode: `SHARED-${String(startCount).padStart(3, '0')}`,
                }),
            };
        },
    });

    const anonymous = await harness.dispatch('status');
    assert.equal(anonymous.status, 200);
    assert.equal(anonymous.payload.authenticated, false);
    assert.equal(anonymous.payload.status, 'anonymous');

    const pending = await harness.dispatch('start', 'POST');
    assert.equal(pending.status, 202);
    assert.equal(pending.payload.status, 'pending');
    assert.equal(pending.payload.challenge.challengeId, 'shared-openclaw-1');
    assert.equal(session.getStartCount(), 1);
    assert.equal(session.startRequests.length, 1);
    assert.equal(session.getLastIssuedChallenge().manualCode, 'SHARED-001');

    const authenticated = await harness.dispatch('status');
    assert.equal(authenticated.status, 200);
    assert.equal(authenticated.payload.authenticated, true);
    assert.equal(authenticated.payload.csrfToken, 'csrf_shared_operator_auth');
    assert.equal(session.getStatusCalls(), 2);

    const logout = await harness.dispatch('logout', 'POST');
    assert.equal(logout.status, 200);
    assert.equal(logout.payload.authenticated, false);
    assert.equal(logout.payload.status, 'anonymous');
    assert.equal(session.getLastIssuedChallenge(), null);
});

test('admin queue, queue-integrated-flow, queue-operator y shared-session consumen el helper compartido sin duplicar utilidades', () => {
    const adminQueueSpec = readFileSync(ADMIN_QUEUE_SPEC_PATH, 'utf8');
    const queueIntegratedFlowSpec = readFileSync(
        QUEUE_INTEGRATED_FLOW_SPEC_PATH,
        'utf8'
    );
    const queueOperatorSpec = readFileSync(QUEUE_OPERATOR_SPEC_PATH, 'utf8');
    const sharedSessionSpec = readFileSync(SHARED_SESSION_SPEC_PATH, 'utf8');

    assert.match(
        adminQueueSpec,
        /const \{ installLegacyAdminAuthMock \} = require\('\.\/helpers\/admin-auth-mocks'\);/
    );
    assert.match(
        adminQueueSpec,
        /function installQueueAdminAuthMock\(page, csrfToken\)[\s\S]*?installLegacyAdminAuthMock\(page, \{ csrfToken \}\);/m
    );
    assert.match(
        adminQueueSpec,
        /await installQueueAdminAuthMock\(page, 'csrf_queue_desk_recheck'\);/
    );
    assert.doesNotMatch(adminQueueSpec, /page\.route\(\/\\\/admin-auth\\\.php/);

    assert.match(
        queueIntegratedFlowSpec,
        /const \{ installLegacyAdminAuthMock \} = require\('\.\/helpers\/admin-auth-mocks'\);/
    );
    assert.match(
        queueIntegratedFlowSpec,
        /async function installSharedQueueMocks[\s\S]*?installLegacyAdminAuthMock\(context, \{\s*csrfToken: 'csrf_queue_integrated',\s*\}\);/m
    );
    assert.doesNotMatch(
        queueIntegratedFlowSpec,
        /async function installSharedQueueMocks[\s\S]*?context\.route\(\/\\\/admin-auth\\\.php/m
    );

    assert.match(
        queueOperatorSpec,
        /buildOperatorAuthChallenge,\s+buildOperatorQueueState,\s+buildOperatorQueueTicket,\s+installLegacyAdminAuthMock,\s+installOperatorOpenClawAuthMock,\s+installWindowOpenRecorder/
    );
    assert.doesNotMatch(
        queueOperatorSpec,
        /function buildOperatorAuthChallenge\(/
    );
    assert.match(
        queueOperatorSpec,
        /async function setupOperatorAuthOperatorMocks[\s\S]*?installOperatorOpenClawAuthMock\(page,/m
    );
    assert.doesNotMatch(
        queueOperatorSpec,
        /async function installWindowOpenRecorder\(/
    );
    assert.doesNotMatch(
        queueOperatorSpec,
        /async function setupOperatorAuthOperatorMocks[\s\S]*?page\.route\(\/\\\/admin-auth\\\.php/m
    );

    assert.match(
        sharedSessionSpec,
        /buildOperatorAuthChallenge,\s+buildOperatorQueueState,\s+buildOperatorQueueTicket,\s+installOperatorOpenClawAuthMock,\s+installWindowOpenRecorder/
    );
    assert.match(
        sharedSessionSpec,
        /async function installSharedOperatorAuthMocks[\s\S]*?installOperatorOpenClawAuthMock\(context,/m
    );
    assert.doesNotMatch(
        sharedSessionSpec,
        /function buildOperatorAuthChallenge\(/
    );
    assert.doesNotMatch(sharedSessionSpec, /function buildQueueState\(/);
    assert.doesNotMatch(
        sharedSessionSpec,
        /async function installWindowOpenRecorder\(/
    );
    assert.doesNotMatch(
        sharedSessionSpec,
        /async function installSharedOperatorAuthMocks[\s\S]*?context\.route\(\/\\\/admin-auth\\\.php/m
    );
});
