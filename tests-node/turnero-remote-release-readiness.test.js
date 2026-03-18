const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modulePromise = null;

async function loadRemoteReleaseModule() {
    if (!modulePromise) {
        const modulePath = path.resolve(
            __dirname,
            '../src/apps/queue-shared/turnero-remote-release-readiness.js'
        );
        modulePromise = import(pathToFileURL(modulePath).href);
    }

    return modulePromise;
}

function createResponse(payload, status = 200) {
    const body =
        typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return body;
        },
    };
}

function createFetchMock(resolver, requests) {
    return async (url) => {
        const parsedUrl = new URL(url, 'http://example.test');
        const resource = parsedUrl.searchParams.get('resource') || '';
        requests.push({
            resource,
            url: parsedUrl.toString(),
        });
        return resolver(parsedUrl, resource);
    };
}

test('turnero remote release readiness queda listo cuando health, diagnostics y agenda coinciden', async () => {
    const module = await loadRemoteReleaseModule();
    const requests = [];
    const clinicId = 'clinica-remota-demo';
    const profileFingerprint = 'b16b00b5';
    const date = '2026-03-18';
    const publicSync = {
        configured: true,
        healthy: true,
        operationallyHealthy: true,
        repoHygieneIssue: false,
        state: 'ok',
        deployedCommit: '75a8d7c5e18a9f4c2b3d4e5f60718293a4b5c6d7',
        headDrift: false,
        ageSeconds: 12,
        expectedMaxLagSeconds: 120,
        failureReason: '',
    };

    const fetchImpl = createFetchMock((parsedUrl, resource) => {
        if (resource === 'health') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync,
                },
            });
        }

        if (resource === 'health-diagnostics') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync,
                    turneroPilot: {
                        available: true,
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId,
                        profileFingerprint,
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        releaseMode: 'suite_v2',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: true,
                    },
                },
                figoConfigured: true,
                figoRecursiveConfig: false,
                calendarConfigured: true,
                calendarReachable: true,
                calendarRequirementMet: true,
                calendarMode: 'google',
                calendarSource: 'primary',
            });
        }

        if (resource === 'availability') {
            assert.equal(parsedUrl.searchParams.get('dateFrom'), date);
            return createResponse({
                ok: true,
                data: {
                    [date]: ['09:00', '09:30'],
                },
                meta: {
                    source: 'store',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: false,
                },
            });
        }

        if (resource === 'booked-slots') {
            assert.equal(parsedUrl.searchParams.get('date'), date);
            return createResponse({
                ok: true,
                data: ['09:00'],
                meta: {
                    source: 'store',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: false,
                },
            });
        }

        return createResponse({ ok: false, error: 'unexpected resource' }, 500);
    }, requests);

    const remoteState = await module.loadTurneroRemoteReleaseHealth({
        clinicId,
        profileFingerprint,
        date,
        fetchImpl,
    });
    const model = module.createTurneroRemoteReleaseReadinessModel(remoteState);
    const markup = module.renderTurneroRemoteReleaseReadinessCard(model, {
        escapeHtml: (value) => String(value ?? ''),
    });

    assert.deepEqual(
        new Set(requests.map((entry) => entry.resource)),
        new Set([
            'health',
            'health-diagnostics',
            'availability',
            'booked-slots',
        ])
    );
    assert.equal(model.state, 'ready');
    assert.equal(model.tone, 'ready');
    assert.equal(model.blockerCount, 0);
    assert.equal(model.warningCount, 0);
    assert.equal(model.statusLabel, 'Listo');
    assert.equal(
        model.items.every((item) => item.state === 'ready'),
        true
    );
    assert.match(markup, /queueOpsPilotRemoteReleaseReadiness/);
    assert.match(markup, /Salida remota lista/);
});

test('turnero remote release readiness bloquea si diagnostics llega redactado y availability cae a fallback', async () => {
    const module = await loadRemoteReleaseModule();
    const requests = [];
    const clinicId = 'clinica-redactada-demo';
    const profileFingerprint = 'd1c70bad';
    const date = '2026-03-18';
    const publicSync = {
        configured: true,
        healthy: true,
        operationallyHealthy: true,
        repoHygieneIssue: false,
        state: 'ok',
        deployedCommit: '75a8d7c5e18a9f4c2b3d4e5f60718293a4b5c6d7',
        headDrift: false,
        ageSeconds: 14,
        expectedMaxLagSeconds: 120,
        failureReason: '',
    };

    const fetchImpl = createFetchMock((parsedUrl, resource) => {
        if (resource === 'health') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync,
                },
            });
        }

        if (resource === 'health-diagnostics') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {},
                figoConfigured: true,
                figoRecursiveConfig: false,
            });
        }

        if (resource === 'availability') {
            assert.equal(parsedUrl.searchParams.get('dateFrom'), date);
            return createResponse({
                ok: true,
                data: {
                    [date]: ['10:00'],
                },
                meta: {
                    source: 'fallback',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: true,
                },
            });
        }

        if (resource === 'booked-slots') {
            assert.equal(parsedUrl.searchParams.get('date'), date);
            return createResponse({
                ok: true,
                data: ['10:00'],
                meta: {
                    source: 'fallback',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: true,
                },
            });
        }

        return createResponse({ ok: false, error: 'unexpected resource' }, 500);
    }, requests);

    const remoteState = await module.loadTurneroRemoteReleaseHealth({
        clinicId,
        profileFingerprint,
        date,
        fetchImpl,
    });
    const model = module.createTurneroRemoteReleaseReadinessModel(remoteState);

    assert.deepEqual(
        new Set(requests.map((entry) => entry.resource)),
        new Set([
            'health',
            'health-diagnostics',
            'availability',
            'booked-slots',
        ])
    );
    assert.equal(model.state, 'blocked');
    assert.equal(model.blockerCount, 4);
    assert.equal(
        model.items.find((item) => item.id === 'diagnostics')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'identity')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'availability')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'booked_slots')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'figo')?.state,
        'ready'
    );
});

test('turnero remote release readiness bloquea si clinicId o fingerprint remoto no coinciden', async () => {
    const module = await loadRemoteReleaseModule();
    const requests = [];
    const clinicId = 'clinica-identidad-demo';
    const profileFingerprint = '00c0ffee';
    const date = '2026-03-18';
    const publicSync = {
        configured: true,
        healthy: true,
        operationallyHealthy: true,
        repoHygieneIssue: false,
        state: 'ok',
        deployedCommit: '75a8d7c5e18a9f4c2b3d4e5f60718293a4b5c6d7',
        headDrift: false,
        ageSeconds: 9,
        expectedMaxLagSeconds: 120,
        failureReason: '',
    };

    const fetchImpl = createFetchMock((parsedUrl, resource) => {
        if (resource === 'health') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync,
                },
            });
        }

        if (resource === 'health-diagnostics') {
            return createResponse({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync,
                    turneroPilot: {
                        available: true,
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId: 'clinica-otra-demo',
                        profileFingerprint: 'deadbeef',
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        releaseMode: 'suite_v2',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: true,
                    },
                },
                figoConfigured: true,
                figoRecursiveConfig: true,
                calendarConfigured: true,
                calendarReachable: true,
                calendarRequirementMet: true,
                calendarMode: 'google',
                calendarSource: 'primary',
            });
        }

        if (resource === 'availability') {
            assert.equal(parsedUrl.searchParams.get('dateFrom'), date);
            return createResponse({
                ok: true,
                data: {
                    [date]: ['11:00'],
                },
                meta: {
                    source: 'store',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: false,
                },
            });
        }

        if (resource === 'booked-slots') {
            assert.equal(parsedUrl.searchParams.get('date'), date);
            return createResponse({
                ok: true,
                data: ['11:00'],
                meta: {
                    source: 'store',
                    mode: 'live',
                    generatedAt: new Date().toISOString(),
                    degraded: false,
                },
            });
        }

        return createResponse({ ok: false, error: 'unexpected resource' }, 500);
    }, requests);

    const remoteState = await module.loadTurneroRemoteReleaseHealth({
        clinicId,
        profileFingerprint,
        date,
        fetchImpl,
    });
    const model = module.createTurneroRemoteReleaseReadinessModel(remoteState);

    assert.deepEqual(
        new Set(requests.map((entry) => entry.resource)),
        new Set([
            'health',
            'health-diagnostics',
            'availability',
            'booked-slots',
        ])
    );
    assert.equal(model.state, 'blocked');
    assert.equal(model.blockerCount, 2);
    assert.equal(
        model.items.find((item) => item.id === 'identity')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'figo')?.state,
        'alert'
    );
    assert.equal(
        model.items.find((item) => item.id === 'public_sync')?.state,
        'ready'
    );
    assert.equal(
        model.items.find((item) => item.id === 'availability')?.state,
        'ready'
    );
    assert.equal(
        model.items.find((item) => item.id === 'booked_slots')?.state,
        'ready'
    );
});
