#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    runOpenClawAuthLocalSmoke,
} = require('../bin/openclaw-auth-local-smoke.js');

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

function json(res, status, payload, headers = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...headers,
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

test('smoke local completa start helper status logout cuando OpenClaw ya tiene sesion', async (t) => {
    const state = {
        bridgeCompleted: false,
        authenticated: false,
    };
    const backend = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const cookie = String(req.headers.cookie || '');
        const hasSession = cookie.includes('admin_session=smoke-test');

        if (
            req.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'operator-auth-status'
        ) {
            return json(res, 200, {
                ok: true,
                mode: 'openclaw_chatgpt',
                status: 'anonymous',
                configured: true,
            });
        }

        if (
            req.method === 'POST' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'operator-auth-complete'
        ) {
            const body = await parseJsonBody(req);
            state.bridgeCompleted = body.status === 'completed';
            state.authenticated = state.bridgeCompleted;
            return json(res, 202, {
                ok: true,
                accepted: true,
                status: state.bridgeCompleted
                    ? 'completed'
                    : 'openclaw_no_logueado',
            });
        }

        if (
            req.method === 'POST' &&
            url.pathname === '/admin-auth.php' &&
            url.searchParams.get('action') === 'start'
        ) {
            return json(
                res,
                202,
                {
                    ok: true,
                    mode: 'openclaw_chatgpt',
                    status: 'pending',
                    challenge: {
                        challengeId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                        nonce: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                        manualCode: 'AAAAAA-BBBBBB',
                        expiresAt: new Date(Date.now() + 300000).toISOString(),
                        helperUrl: 'http://127.0.0.1:4173/resolve',
                    },
                },
                {
                    'Set-Cookie': 'admin_session=smoke-test; Path=/; HttpOnly',
                }
            );
        }

        if (
            req.method === 'GET' &&
            url.pathname === '/admin-auth.php' &&
            url.searchParams.get('action') === 'status'
        ) {
            return json(res, 200, {
                ok: true,
                authenticated: hasSession && state.authenticated,
                mode: 'openclaw_chatgpt',
                status:
                    hasSession && state.authenticated
                        ? 'autenticado'
                        : 'pending',
                operator:
                    hasSession && state.authenticated
                        ? { email: 'operator@example.com' }
                        : null,
            });
        }

        if (
            req.method === 'POST' &&
            url.pathname === '/admin-auth.php' &&
            url.searchParams.get('action') === 'logout'
        ) {
            state.authenticated = false;
            return json(res, 200, {
                ok: true,
                authenticated: false,
                mode: 'openclaw_chatgpt',
                status: 'logout',
            });
        }

        return json(res, 404, { ok: false });
    });
    t.after(async () => closeServer(backend));
    const serverBaseUrl = await listen(backend);

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
            PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL: serverBaseUrl,
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: 'http://127.0.0.1:4173',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_RUNTIME_BASE_URL: runtimeBaseUrl,
            OPENCLAW_HELPER_DEVICE_ID: 'smoke-device-test',
        },
        async () => {
            const report = await runOpenClawAuthLocalSmoke({
                timeoutMs: 2000,
                pollIntervalMs: 10,
            });

            assert.equal(report.ok, true);
            assert.equal(report.stage, 'completed');
            assert.equal(report.start.httpStatus, 202);
            assert.equal(report.helper.status, 'completed');
            assert.equal(report.finalStatus.status, 'autenticado');
            assert.equal(report.logout.authenticated, false);
        }
    );
});

test('smoke local corta en preflight cuando falta sesion OpenClaw activa', async () => {
    await withEnv(
        {
            PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL:
                'https://pielarmonia.com',
            PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: 'http://127.0.0.1:4173',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: 'bridge-token-test',
            PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: 'bridge-secret-test',
            OPENCLAW_RUNTIME_BASE_URL: 'http://127.0.0.1:59999',
        },
        async () => {
            const report = await runOpenClawAuthLocalSmoke();

            assert.equal(report.ok, false);
            assert.equal(report.stage, 'preflight');
            assert.match(report.nextAction, /Configura|Inicia|runtime/i);
        }
    );
});
