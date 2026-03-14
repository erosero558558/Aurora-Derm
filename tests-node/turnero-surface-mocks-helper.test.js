#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
    buildTurneroQueueStatePayload,
    installTurneroClinicProfileFailure,
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('../tests/helpers/turnero-surface-mocks');
const QUEUE_DISPLAY_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-display.spec.js'
);
const QUEUE_KIOSK_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-kiosk.spec.js'
);
const QUEUE_OPERATOR_SPEC_PATH = resolve(
    __dirname,
    '..',
    'tests',
    'queue-operator.spec.js'
);

function createRouteHarness() {
    const handlers = [];

    return {
        target: {
            async route(pattern, handler) {
                handlers.push({ pattern, handler });
            },
        },
        async dispatch(url, method = 'GET') {
            const entry = handlers.find(({ pattern }) =>
                pattern instanceof RegExp
                    ? pattern.test(url)
                    : String(pattern) === String(url)
            );
            assert.ok(entry, `No se encontro route handler para ${url}`);

            let fulfilled = null;
            let aborted = null;
            await entry.handler({
                request() {
                    return {
                        url() {
                            return url;
                        },
                        method() {
                            return method;
                        },
                        postDataJSON() {
                            return {};
                        },
                        postData() {
                            return '';
                        },
                    };
                },
                fulfill(payload) {
                    fulfilled = payload;
                    return payload;
                },
                abort(reason) {
                    aborted = reason;
                    return reason;
                },
            });

            return {
                fulfilled,
                aborted,
                payload: fulfilled
                    ? JSON.parse(String(fulfilled.body || '{}'))
                    : null,
            };
        },
    };
}

test('buildTurneroQueueStatePayload expone defaults canonicos para sala turnos', () => {
    const payload = buildTurneroQueueStatePayload({
        waitingCount: 2,
        nextTickets: [{ id: 1, ticketCode: 'A-001' }],
    });

    assert.ok(Number.isFinite(Date.parse(payload.updatedAt)));
    assert.equal(payload.waitingCount, 2);
    assert.equal(payload.calledCount, 0);
    assert.deepEqual(payload.callingNow, []);
    assert.deepEqual(payload.nextTickets, [{ id: 1, ticketCode: 'A-001' }]);
});

test('installTurneroClinicProfileMock e installTurneroClinicProfileFailure responden clinic-profile canonico', async () => {
    const successHarness = createRouteHarness();
    await installTurneroClinicProfileMock(successHarness.target, {
        clinic_id: 'clinica-norte-demo',
    });

    const success = await successHarness.dispatch(
        'https://example.test/content/turnero/clinic-profile.json'
    );
    assert.equal(success.fulfilled.status, 200);
    assert.equal(success.payload.clinic_id, 'clinica-norte-demo');

    const failureHarness = createRouteHarness();
    await installTurneroClinicProfileFailure(failureHarness.target);
    const failure = await failureHarness.dispatch(
        'https://example.test/content/turnero/clinic-profile.json'
    );
    assert.equal(failure.fulfilled.status, 404);
    assert.deepEqual(failure.payload, { ok: false });
});

test('installTurneroQueueStateMock responde queue-state, cuenta llamadas y deja fallback neutro para otros resources', async () => {
    const harness = createRouteHarness();
    const session = await installTurneroQueueStateMock(harness.target, {
        queueState: ({ callCount }) => ({
            updatedAt: `2026-03-14T00:00:0${callCount}.000Z`,
            nextTickets: [{ id: callCount, ticketCode: `A-00${callCount}` }],
        }),
    });

    const features = await harness.dispatch(
        'https://example.test/api.php?resource=features'
    );
    assert.deepEqual(features.payload, { ok: true, data: {} });

    const firstQueueState = await harness.dispatch(
        'https://example.test/api.php?resource=queue-state'
    );
    assert.equal(firstQueueState.payload.ok, true);
    assert.equal(
        firstQueueState.payload.data.nextTickets[0].ticketCode,
        'A-001'
    );
    assert.equal(session.getQueueStateCalls(), 1);

    const secondQueueState = await harness.dispatch(
        'https://example.test/api.php?resource=queue-state'
    );
    assert.equal(
        secondQueueState.payload.data.updatedAt,
        '2026-03-14T00:00:02.000Z'
    );
    assert.equal(session.getQueueStateCalls(), 2);
});

test('installTurneroQueueStateMock soporta abort controlado del backend', async () => {
    const harness = createRouteHarness();
    const session = await installTurneroQueueStateMock(harness.target, {
        queueStateAbortReason: 'failed',
    });

    const aborted = await harness.dispatch(
        'https://example.test/api.php?resource=queue-state'
    );
    assert.equal(aborted.aborted, 'failed');
    assert.equal(aborted.fulfilled, null);
    assert.equal(session.getQueueStateCalls(), 1);
});

test('installTurneroQueueStateMock soporta respuestas custom y defaultPayload dinamico', async () => {
    const harness = createRouteHarness();

    await installTurneroQueueStateMock(harness.target, {
        defaultPayload({ resource }) {
            return {
                ok: true,
                data: { resource },
            };
        },
        queueStateResponse({ callCount }) {
            return {
                ok: callCount < 2,
                error: callCount < 2 ? '' : 'queue_state_unavailable',
                data: callCount < 2 ? { waitingCount: callCount } : undefined,
            };
        },
        queueStateStatus({ callCount }) {
            return callCount < 2 ? 200 : 503;
        },
    });

    const features = await harness.dispatch(
        'https://example.test/api.php?resource=features'
    );
    assert.deepEqual(features.payload, {
        ok: true,
        data: { resource: 'features' },
    });

    const firstQueueState = await harness.dispatch(
        'https://example.test/api.php?resource=queue-state'
    );
    assert.equal(firstQueueState.fulfilled.status, 200);
    assert.equal(firstQueueState.payload.ok, true);
    assert.equal(firstQueueState.payload.data.waitingCount, 1);

    const secondQueueState = await harness.dispatch(
        'https://example.test/api.php?resource=queue-state'
    );
    assert.equal(secondQueueState.fulfilled.status, 503);
    assert.equal(secondQueueState.payload.ok, false);
    assert.equal(secondQueueState.payload.error, 'queue_state_unavailable');
});

test('installTurneroQueueStateMock permite side effects en resources no queue-state via handleApiRoute', async () => {
    const harness = createRouteHarness();
    let ticketRequests = 0;

    await installTurneroQueueStateMock(harness.target, {
        handleApiRoute({ resource }) {
            if (resource === 'queue-ticket') {
                ticketRequests += 1;
            }
            return false;
        },
    });

    const ticket = await harness.dispatch(
        'https://example.test/api.php?resource=queue-ticket'
    );
    assert.equal(ticketRequests, 1);
    assert.deepEqual(ticket.payload, { ok: true, data: {} });
});

test('queue-display, queue-kiosk y queue-operator consumen el helper compartido de superficies turnero', () => {
    const queueDisplaySpec = readFileSync(QUEUE_DISPLAY_SPEC_PATH, 'utf8');
    const queueKioskSpec = readFileSync(QUEUE_KIOSK_SPEC_PATH, 'utf8');
    const queueOperatorSpec = readFileSync(QUEUE_OPERATOR_SPEC_PATH, 'utf8');

    assert.match(
        queueDisplaySpec,
        /const \{\s+installTurneroClinicProfileFailure,\s+installTurneroClinicProfileMock,\s+installTurneroQueueStateMock,\s+\} = require\('\.\/helpers\/turnero-surface-mocks'\);/m
    );
    assert.match(
        queueDisplaySpec,
        /await installTurneroClinicProfileMock\(page, \{/m
    );
    assert.match(
        queueDisplaySpec,
        /await installTurneroClinicProfileFailure\(page\);/m
    );
    assert.match(
        queueDisplaySpec,
        /await installTurneroQueueStateMock\(page, \{/m
    );

    assert.match(
        queueKioskSpec,
        /const \{\s+installTurneroClinicProfileFailure,\s+installTurneroClinicProfileMock,\s+installTurneroQueueStateMock,\s+\} = require\('\.\/helpers\/turnero-surface-mocks'\);/m
    );
    assert.match(
        queueKioskSpec,
        /await installTurneroClinicProfileMock\(page, \{/m
    );
    assert.match(
        queueKioskSpec,
        /await installTurneroClinicProfileFailure\(page\);/m
    );
    assert.match(queueKioskSpec, /await installTurneroQueueStateMock\(page,/m);

    assert.match(
        queueOperatorSpec,
        /const \{\s+installTurneroClinicProfileFailure,\s+installTurneroClinicProfileMock,\s+installTurneroQueueStateMock,\s+\} = require\('\.\/helpers\/turnero-surface-mocks'\);/m
    );
    assert.match(
        queueOperatorSpec,
        /await installTurneroClinicProfileMock\(page, \{/m
    );
    assert.match(
        queueOperatorSpec,
        /await installTurneroClinicProfileFailure\(page\);/m
    );
    assert.match(
        queueOperatorSpec,
        /await installTurneroQueueStateMock\(page, \{/m
    );
});
