const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    createOpenClawAuthHelperServer,
    signBridgePayload,
} = require('../bin/openclaw-auth-helper.js');

function withEnv(overrides, callback) {
    const previous = new Map();

    Object.entries(overrides).forEach(([key, value]) => {
        previous.set(key, process.env[key]);
        if (value === undefined || value === null) {
            delete process.env[key];
            return;
        }
        process.env[key] = String(value);
    });

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            previous.forEach((value, key) => {
                if (value === undefined) {
                    delete process.env[key];
                    return;
                }
                process.env[key] = value;
            });
        });
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function json(res, status, payload) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(payload));
}

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve(`http://127.0.0.1:${address.port}`);
        });
    });
}

function closeServer(server) {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

test('helper local completa el challenge cuando OpenClaw ya tiene sesion', async (t) => {
    const bridgeRequests = [];
    const backend = http.createServer(async (req, res) => {
        if (
            req.method === 'POST' &&
            req.url === '/api.php?resource=operator-auth-complete'
        ) {
            bridgeRequests.push({
                headers: req.headers,
                body: await parseJsonBody(req),
            });
            return json(res, 202, {
                ok: true,
                accepted: true,
                status: 'completed',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(backend));
    const backendBaseUrl = await listen(backend);

    const runtime = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/v1/session') {
            return json(res, 200, {
                loggedIn: true,
                email: 'operator@example.com',
                profileId: 'profile-test',
                accountId: 'acct-test',
                provider: 'openclaw_chatgpt',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(runtime));
    const runtimeBaseUrl = await listen(runtime);

    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_HELPER_DEVICE_ID: 'helper-device-test',
        },
        async () => {
            const helper = createOpenClawAuthHelperServer({
                helperBaseUrl: 'http://127.0.0.1:4173',
                hostname: '127.0.0.1',
                port: 0,
                runtimeBaseUrl,
            });
            t.after(async () => closeServer(helper.server));
            await new Promise((resolve) => {
                helper.server.listen(0, '127.0.0.1', resolve);
            });

            const response = await fetch(
                `${helper.listeningBaseUrl()}/resolve?challengeId=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&nonce=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb&serverBaseUrl=${encodeURIComponent(
                    backendBaseUrl
                )}&manualCode=AAAAAA-BBBBBB&format=json`
            );
            const payload = await response.json();

            assert.equal(response.status, 200);
            assert.equal(payload.status, 'completed');
            assert.equal(bridgeRequests.length, 1);

            const bridgeRequest = bridgeRequests[0];
            assert.equal(
                bridgeRequest.headers.authorization,
                'Bearer bridge-token-test'
            );
            assert.equal(bridgeRequest.body.status, 'completed');
            assert.equal(bridgeRequest.body.email, 'operator@example.com');
            assert.equal(bridgeRequest.body.deviceId, 'helper-device-test');

            const { signature, ...unsignedPayload } = bridgeRequest.body;
            assert.equal(signature, signBridgePayload(unsignedPayload));
        }
    );
});

test('helper local normaliza openclaw_not_logged_in y dispara login web', async (t) => {
    const bridgeRequests = [];
    const backend = http.createServer(async (req, res) => {
        if (
            req.method === 'POST' &&
            req.url === '/api.php?resource=operator-auth-complete'
        ) {
            bridgeRequests.push(await parseJsonBody(req));
            return json(res, 202, {
                ok: true,
                accepted: true,
                status: 'openclaw_no_logueado',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(backend));
    const backendBaseUrl = await listen(backend);

    const runtime = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/v1/session') {
            return json(res, 200, {
                loggedIn: false,
                errorCode: 'openclaw_not_logged_in',
            });
        }

        if (req.method === 'POST' && req.url === '/v1/session/login') {
            const body = await parseJsonBody(req);
            assert.equal(body.challengeId, 'cccccccccccccccccccccccccccccccc');
            return json(res, 200, {
                ok: true,
                loginUrl: 'https://openclaw.local/login',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(runtime));
    const runtimeBaseUrl = await listen(runtime);

    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_HELPER_DEVICE_ID: 'helper-device-test',
        },
        async () => {
            const helper = createOpenClawAuthHelperServer({
                helperBaseUrl: 'http://127.0.0.1:4173',
                hostname: '127.0.0.1',
                port: 0,
                runtimeBaseUrl,
            });
            t.after(async () => closeServer(helper.server));
            await new Promise((resolve) => {
                helper.server.listen(0, '127.0.0.1', resolve);
            });

            const response = await fetch(
                `${helper.listeningBaseUrl()}/resolve?challengeId=cccccccccccccccccccccccccccccccc&nonce=dddddddddddddddddddddddddddddddd&serverBaseUrl=${encodeURIComponent(
                    backendBaseUrl
                )}&manualCode=CCCCCC-DDDDDD&format=json`
            );
            const payload = await response.json();

            assert.equal(response.status, 202);
            assert.equal(payload.status, 'openclaw_no_logueado');
            assert.equal(payload.errorCode, 'openclaw_login_required');
            assert.equal(payload.loginUrl, 'https://openclaw.local/login');
            assert.equal(bridgeRequests.length, 1);
            assert.equal(bridgeRequests[0].status, 'error');
            assert.equal(
                bridgeRequests[0].errorCode,
                'openclaw_login_required'
            );
        }
    );
});

test('helper local preserva openclaw_oauth_missing como error normalizado', async (t) => {
    const bridgeRequests = [];
    const backend = http.createServer(async (req, res) => {
        if (
            req.method === 'POST' &&
            req.url === '/api.php?resource=operator-auth-complete'
        ) {
            bridgeRequests.push(await parseJsonBody(req));
            return json(res, 202, {
                ok: true,
                accepted: true,
                status: 'openclaw_no_logueado',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(backend));
    const backendBaseUrl = await listen(backend);

    const runtime = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/v1/session') {
            return json(res, 200, {
                loggedIn: false,
                errorCode: 'openclaw_oauth_missing',
            });
        }

        if (req.method === 'POST' && req.url === '/v1/session/login') {
            return json(res, 503, {
                ok: false,
                errorCode: 'openclaw_oauth_missing',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(runtime));
    const runtimeBaseUrl = await listen(runtime);

    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_HELPER_DEVICE_ID: 'helper-device-test',
        },
        async () => {
            const helper = createOpenClawAuthHelperServer({
                helperBaseUrl: 'http://127.0.0.1:4173',
                hostname: '127.0.0.1',
                port: 0,
                runtimeBaseUrl,
            });
            t.after(async () => closeServer(helper.server));
            await new Promise((resolve) => {
                helper.server.listen(0, '127.0.0.1', resolve);
            });

            const response = await fetch(
                `${helper.listeningBaseUrl()}/resolve?challengeId=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&nonce=ffffffffffffffffffffffffffffffff&serverBaseUrl=${encodeURIComponent(
                    backendBaseUrl
                )}&manualCode=EEEEEE-FFFFFF&format=json`
            );
            const payload = await response.json();

            assert.equal(response.status, 202);
            assert.equal(payload.status, 'openclaw_no_logueado');
            assert.equal(payload.errorCode, 'openclaw_oauth_missing');
            assert.equal(bridgeRequests.length, 1);
            assert.equal(bridgeRequests[0].errorCode, 'openclaw_oauth_missing');
        }
    );
});

test('helper local responde helper_no_disponible cuando el gateway no esta disponible', async (t) => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_HELPER_DEVICE_ID: 'helper-device-test',
        },
        async () => {
            const helper = createOpenClawAuthHelperServer({
                helperBaseUrl: 'http://127.0.0.1:4173',
                hostname: '127.0.0.1',
                port: 0,
                runtimeBaseUrl: 'http://127.0.0.1:59999',
            });
            t.after(async () => closeServer(helper.server));
            await new Promise((resolve) => {
                helper.server.listen(0, '127.0.0.1', resolve);
            });

            const response = await fetch(
                `${helper.listeningBaseUrl()}/resolve?challengeId=99999999999999999999999999999999&nonce=88888888888888888888888888888888&serverBaseUrl=http%3A%2F%2F127.0.0.1%3A7000&manualCode=999999-888888&format=json`
            );
            const payload = await response.json();

            assert.equal(response.status, 500);
            assert.equal(payload.status, 'helper_no_disponible');
            assert.equal(payload.errorCode, 'helper_no_disponible');
        }
    );
});
