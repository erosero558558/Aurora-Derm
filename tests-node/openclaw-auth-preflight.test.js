const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    buildOpenClawAuthPreflight,
} = require('../bin/openclaw-auth-preflight.js');

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

test('preflight reports readyForLogin when env is complete and runtime session is active', async (t) => {
    const runtime = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/v1/session') {
            return json(res, 200, {
                loggedIn: true,
                email: 'operator@example.com',
                provider: 'openclaw_chatgpt',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(runtime));
    const runtimeBaseUrl = await listen(runtime);

    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: 'http://127.0.0.1:4173',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_RUNTIME_BASE_URL: runtimeBaseUrl,
        },
        async () => {
            const report = await buildOpenClawAuthPreflight();

            assert.equal(report.ok, true);
            assert.equal(report.readyForLogin, true);
            assert.equal(report.runtime.reachable, true);
            assert.equal(report.runtime.loggedIn, true);
            assert.equal(report.runtime.email, 'operator@example.com');
            assert.equal(
                report.nextAction,
                'Listo para abrir admin.html y continuar con OpenClaw.'
            );
        }
    );
});

test('preflight reports configuration gaps when bridge token is missing', async () => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: 'http://127.0.0.1:4173',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: '',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: '',
            OPENCLAW_RUNTIME_BASE_URL: 'http://127.0.0.1:59999',
        },
        async () => {
            const report = await buildOpenClawAuthPreflight();

            assert.equal(report.ok, false);
            assert.equal(report.readyForLogin, false);
            assert.equal(report.bridge.tokenConfigured, false);
            assert.equal(report.bridge.secretConfigured, false);
            assert.match(
                report.nextAction,
                /PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN/
            );
        }
    );
});

test('preflight reports login step when runtime is reachable but session is missing', async (t) => {
    const runtime = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/v1/session') {
            return json(res, 200, {
                loggedIn: false,
                provider: 'openclaw_chatgpt',
                errorCode: 'openclaw_not_logged_in',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(runtime));
    const runtimeBaseUrl = await listen(runtime);

    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: 'http://127.0.0.1:4173',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_RUNTIME_BASE_URL: runtimeBaseUrl,
        },
        async () => {
            const report = await buildOpenClawAuthPreflight();

            assert.equal(report.ok, true);
            assert.equal(report.readyForLogin, false);
            assert.equal(report.runtime.reachable, true);
            assert.equal(report.runtime.loggedIn, false);
            assert.equal(report.runtime.errorCode, 'openclaw_not_logged_in');
            assert.equal(
                report.nextAction,
                'Inicia sesion en OpenClaw y vuelve a ejecutar el preflight.'
            );
        }
    );
});

test('preflight accepts web_broker without helper local when broker env is complete', async () => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_TRANSPORT: 'web_broker',
            OPENCLAW_AUTH_BROKER_AUTHORIZE_URL:
                'https://broker.example.test/authorize',
            OPENCLAW_AUTH_BROKER_TOKEN_URL: 'https://broker.example.test/token',
            OPENCLAW_AUTH_BROKER_USERINFO_URL:
                'https://broker.example.test/userinfo',
            OPENCLAW_AUTH_BROKER_CLIENT_ID: 'broker-client-id',
            OPENCLAW_AUTH_BROKER_JWKS_URL:
                'https://broker.example.test/jwks',
            OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER:
                'https://broker.example.test',
            OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE: 'broker-client-id',
            OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED: 'true',
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: '',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: '',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: '',
            OPENCLAW_RUNTIME_BASE_URL: '',
        },
        async () => {
            const report = await buildOpenClawAuthPreflight();

            assert.equal(report.transport, 'web_broker');
            assert.equal(report.ok, true);
            assert.equal(report.readyForLogin, true);
            assert.equal(report.broker.authorizeUrlConfigured, true);
            assert.equal(report.runtime.reachable, false);
            assert.match(report.nextAction, /continuar con OpenClaw web/i);
        }
    );
});
