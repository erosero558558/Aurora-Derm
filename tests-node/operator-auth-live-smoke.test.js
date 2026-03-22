#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { runSmoke } = require('../bin/operator-auth-live-smoke');

function listen(server) {
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server.address()));
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            raw += chunk;
        });
        request.on('end', () => {
            if (raw === '') {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(error);
            }
        });
        request.on('error', reject);
    });
}

function buildChallenge(counter) {
    const suffix = counter.toString(16).padStart(2, '0');
    return {
        challengeId: `${'a'.repeat(30)}${suffix}`,
        nonce: `${'b'.repeat(30)}${suffix}`,
        manualCode: `AAAAAA-AAAA${suffix.toUpperCase()}`,
    };
}

function createStubPair(mode = 'success') {
    const sessions = new Map();
    const challengeToSession = new Map();
    let helperBaseUrl = '';
    let serverBaseUrl = '';
    let counter = 0;

    function parseSessionId(request) {
        const cookieHeader = String(request.headers.cookie || '');
        const match = cookieHeader.match(/SMOKE_SESSION=([^;]+)/);
        return match ? match[1] : '';
    }

    function getSession(sessionId) {
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                status: 'anonymous',
                challenge: null,
                operator: null,
            });
        }
        return sessions.get(sessionId);
    }

    const backend = http.createServer(async (request, response) => {
        const url = new URL(
            request.url || '/',
            serverBaseUrl || 'http://127.0.0.1'
        );
        const action = url.searchParams.get('action');
        const sessionId = parseSessionId(request);
        const session = sessionId !== '' ? getSession(sessionId) : null;

        if (request.method === 'GET' && action === 'status') {
            if (!session || session.status === 'anonymous') {
                response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                });
                response.end(
                    JSON.stringify({
                        ok: true,
                        authenticated: false,
                        status: 'anonymous',
                        mode: 'google_oauth',
                    })
                );
                return;
            }

            if (session.status === 'pending') {
                response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                });
                response.end(
                    JSON.stringify({
                        ok: true,
                        authenticated: false,
                        status: 'pending',
                        mode: 'google_oauth',
                        challenge: {
                            ...session.challenge,
                            status: 'pending',
                            helperUrl: `${helperBaseUrl}/resolve?challengeId=${session.challenge.challengeId}&nonce=${session.challenge.nonce}&serverBaseUrl=${encodeURIComponent(serverBaseUrl)}`,
                            pollAfterMs: 5,
                        },
                    })
                );
                return;
            }

            if (session.status === 'autenticado') {
                response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                });
                response.end(
                    JSON.stringify({
                        ok: true,
                        authenticated: true,
                        status: 'autenticado',
                        mode: 'google_oauth',
                        csrfToken: 'csrf-test-token',
                        operator: session.operator,
                    })
                );
                return;
            }

            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: session.status,
                    mode: 'google_oauth',
                    error:
                        session.status === 'openclaw_no_logueado'
                            ? 'Operator auth no devolvio una sesion OAuth util.'
                            : 'Error terminal',
                    challenge: {
                        ...session.challenge,
                        status: session.status,
                        helperUrl: `${helperBaseUrl}/resolve?challengeId=${session.challenge.challengeId}&nonce=${session.challenge.nonce}&serverBaseUrl=${encodeURIComponent(serverBaseUrl)}`,
                        pollAfterMs: 5,
                    },
                })
            );
            return;
        }

        if (request.method === 'POST' && action === 'start') {
            const nextSessionId =
                sessionId || `session-${Date.now()}-${counter + 1}`;
            const activeSession = getSession(nextSessionId);
            counter += 1;
            const challenge = buildChallenge(counter);
            challengeToSession.set(challenge.challengeId, nextSessionId);
            activeSession.status = 'pending';
            activeSession.challenge = challenge;
            activeSession.operator = null;
            await readJsonBody(request);

            response.writeHead(202, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': `SMOKE_SESSION=${nextSessionId}; Path=/; HttpOnly`,
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'pending',
                    mode: 'google_oauth',
                    challenge: {
                        ...challenge,
                        status: 'pending',
                        helperUrl: `${helperBaseUrl}/resolve?challengeId=${challenge.challengeId}&nonce=${challenge.nonce}&serverBaseUrl=${encodeURIComponent(serverBaseUrl)}`,
                        pollAfterMs: 5,
                    },
                })
            );
            return;
        }

        if (request.method === 'POST' && action === 'logout') {
            if (session) {
                session.status = 'anonymous';
                session.operator = null;
            }
            await readJsonBody(request);

            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'logout',
                    mode: 'google_oauth',
                })
            );
            return;
        }

        response.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({ ok: false, error: 'Not found' }));
    });

    const helper = http.createServer((request, response) => {
        const url = new URL(
            request.url || '/',
            helperBaseUrl || 'http://127.0.0.1'
        );
        if (request.method === 'GET' && url.pathname === '/health') {
            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    service: 'operator-auth-bridge',
                    helperBaseUrl,
                    serverBaseUrlConfigured: true,
                })
            );
            return;
        }

        if (request.method === 'GET' && url.pathname === '/resolve') {
            const challengeId = url.searchParams.get('challengeId') || '';
            const sessionId = challengeToSession.get(challengeId) || '';
            const session = sessionId !== '' ? sessions.get(sessionId) : null;
            if (session) {
                if (mode === 'success') {
                    session.status = 'autenticado';
                    session.operator = {
                        email: 'operator@example.com',
                        profileId: 'openai-codex:operator@example.com',
                        accountId: 'acct-test-operator',
                        source: 'google_oauth',
                    };
                } else {
                    session.status = 'openclaw_no_logueado';
                }
            }

            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(
                JSON.stringify(
                    mode === 'success'
                        ? {
                              ok: true,
                              accepted: true,
                              status: 'completed',
                              identity: {
                                  email: 'operator@example.com',
                                  profileId:
                                      'openai-codex:operator@example.com',
                                  accountId: 'acct-test-operator',
                              },
                          }
                        : {
                              ok: true,
                              accepted: true,
                              status: 'openclaw_no_logueado',
                          }
                )
            );
            return;
        }

        response.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({ ok: false, error: 'Not found' }));
    });

    return {
        backend,
        helper,
        setBaseUrls(nextServerBaseUrl, nextHelperBaseUrl) {
            serverBaseUrl = nextServerBaseUrl;
            helperBaseUrl = nextHelperBaseUrl;
        },
    };
}

function createWebBrokerBackend() {
    const sessions = new Map();
    let serverBaseUrl = '';
    let counter = 0;

    function parseSessionId(request) {
        const cookieHeader = String(request.headers.cookie || '');
        const match = cookieHeader.match(/SMOKE_SESSION=([^;]+)/);
        return match ? match[1] : '';
    }

    function getSession(sessionId) {
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                status: 'anonymous',
                pendingState: '',
                redirectUrl: '',
                operator: null,
            });
        }
        return sessions.get(sessionId);
    }

    return http.createServer(async (request, response) => {
        const url = new URL(
            request.url || '/',
            serverBaseUrl || 'http://127.0.0.1'
        );
        const sessionId = parseSessionId(request);
        const activeSessionId =
            sessionId || `web-broker-session-${Date.now()}-${counter + 1}`;
        const session = getSession(activeSessionId);

        if (
            request.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'operator-auth-status'
        ) {
            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: session.status === 'autenticado',
                    status:
                        session.status === 'autenticado'
                            ? 'autenticado'
                            : 'anonymous',
                    mode: 'google_oauth',
                    transport: 'web_broker',
                    operator: session.operator,
                })
            );
            return;
        }

        if (
            request.method === 'GET' &&
            url.searchParams.get('action') === 'status'
        ) {
            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
            });
            response.end(
                JSON.stringify(
                    session.status === 'pending'
                        ? {
                              ok: true,
                              authenticated: false,
                              status: 'pending',
                              mode: 'google_oauth',
                              transport: 'web_broker',
                              redirectUrl: session.redirectUrl,
                              expiresAt: new Date(
                                  Date.now() + 60000
                              ).toISOString(),
                          }
                        : session.status === 'autenticado'
                          ? {
                                ok: true,
                                authenticated: true,
                                status: 'autenticado',
                                mode: 'google_oauth',
                                transport: 'web_broker',
                                csrfToken: 'csrf-web-broker',
                                operator: session.operator,
                            }
                          : {
                                ok: true,
                                authenticated: false,
                                status: 'anonymous',
                                mode: 'google_oauth',
                                transport: 'web_broker',
                            }
                )
            );
            return;
        }

        if (
            request.method === 'POST' &&
            url.searchParams.get('action') === 'start'
        ) {
            counter += 1;
            const body = await readJsonBody(request);
            session.status = 'pending';
            session.pendingState = `state-${counter}`;
            session.redirectUrl =
                'https://broker.example.test/authorize?state=' +
                encodeURIComponent(session.pendingState) +
                '&returnTo=' +
                encodeURIComponent(
                    String(body.returnTo || '/operador-turnos.html')
                );
            session.operator = null;

            response.writeHead(202, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'pending',
                    mode: 'google_oauth',
                    transport: 'web_broker',
                    redirectUrl: session.redirectUrl,
                    expiresAt: new Date(Date.now() + 60000).toISOString(),
                })
            );
            return;
        }

        if (
            request.method === 'GET' &&
            url.searchParams.get('action') === 'callback'
        ) {
            const state = String(url.searchParams.get('state') || '');
            const code = String(url.searchParams.get('code') || '');
            if (state === session.pendingState && code !== '') {
                session.status = 'autenticado';
                session.operator = {
                    email: 'operator@example.com',
                    profileId: 'openclaw-web-broker:operator@example.com',
                    accountId: 'acct-test-web-broker',
                    source: 'google_oauth',
                };
                response.writeHead(302, {
                    Location:
                        '/operador-turnos.html?station=smoke&lock=1&one_tap=1',
                    'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
                });
                response.end('');
                return;
            }

            response.writeHead(302, {
                Location: '/admin.html?callback=failed',
                'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
            });
            response.end('');
            return;
        }

        if (
            request.method === 'POST' &&
            url.searchParams.get('action') === 'logout'
        ) {
            session.status = 'anonymous';
            session.operator = null;
            await readJsonBody(request);
            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Set-Cookie': `SMOKE_SESSION=${activeSessionId}; Path=/; HttpOnly`,
            });
            response.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'logout',
                    mode: 'google_oauth',
                    transport: 'web_broker',
                })
            );
            return;
        }

        response.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({ ok: false, error: 'Not found' }));
    });
}

test('runSmoke completa preflight, resolve y logout con backend/helper vivos', async () => {
    const pair = createStubPair('success');
    const backendAddress = await listen(pair.backend);
    const helperAddress = await listen(pair.helper);
    const serverBaseUrl = `http://${backendAddress.address}:${backendAddress.port}`;
    const helperBaseUrl = `http://${helperAddress.address}:${helperAddress.port}`;
    pair.setBaseUrls(serverBaseUrl, helperBaseUrl);

    try {
        const report = await runSmoke({
            serverBaseUrl,
            helperBaseUrl,
            requestTimeoutMs: 1000,
            pollTimeoutMs: 1000,
        });

        assert.equal(report.ok, true);
        assert.equal(report.initialStatus.payload.status, 'anonymous');
        assert.equal(
            report.helperHealth.payload.service,
            'operator-auth-bridge'
        );
        assert.equal(report.start.payload.status, 'pending');
        assert.equal(report.resolve.payload.status, 'completed');
        assert.equal(report.finalStatus.status, 'autenticado');
        assert.equal(report.finalStatus.csrfTokenPresent, true);
        assert.equal(report.finalStatus.operator.email, 'operator@example.com');
        assert.equal(report.logout.payload.status, 'logout');
    } finally {
        await closeServer(pair.backend);
        await closeServer(pair.helper);
    }
});

test('runSmoke propaga estado terminal cuando operator auth no queda logueado', async () => {
    const pair = createStubPair('terminal_error');
    const backendAddress = await listen(pair.backend);
    const helperAddress = await listen(pair.helper);
    const serverBaseUrl = `http://${backendAddress.address}:${backendAddress.port}`;
    const helperBaseUrl = `http://${helperAddress.address}:${helperAddress.port}`;
    pair.setBaseUrls(serverBaseUrl, helperBaseUrl);

    try {
        const report = await runSmoke({
            serverBaseUrl,
            helperBaseUrl,
            requestTimeoutMs: 1000,
            pollTimeoutMs: 1000,
        });

        assert.equal(report.ok, false);
        assert.equal(report.stage, 'poll');
        assert.equal(report.resolve.payload.status, 'openclaw_no_logueado');
        assert.equal(report.finalStatus.status, 'openclaw_no_logueado');
        assert.match(report.error.message, /oauth|sesion|estado final/i);
    } finally {
        await closeServer(pair.backend);
        await closeServer(pair.helper);
    }
});

test('runSmoke soporta web_broker y valida callback, sesion compartida y logout', async () => {
    const backend = createWebBrokerBackend();
    const address = await listen(backend);
    const serverBaseUrl = `http://${address.address}:${address.port}`;

    try {
        const report = await runSmoke({
            transport: 'web_broker',
            serverBaseUrl,
            requestTimeoutMs: 1000,
            pollTimeoutMs: 1000,
            expectedEmail: 'operator@example.com',
            performWebBrokerLogin: async ({ cookieHeader, redirectUrl }) => {
                const redirect = new URL(redirectUrl);
                const state = String(redirect.searchParams.get('state') || '');
                const response = await fetch(
                    `${serverBaseUrl}/admin-auth.php?action=callback&state=${encodeURIComponent(
                        state
                    )}&code=smoke-code`,
                    {
                        headers: {
                            Cookie: cookieHeader,
                        },
                        redirect: 'manual',
                    }
                );

                return {
                    ok: response.status === 302,
                    callbackOk: response.status === 302,
                    finalUrl: String(response.headers.get('location') || ''),
                    cookieHeader,
                };
            },
        });

        assert.equal(report.ok, true);
        assert.equal(report.transport, 'web_broker');
        assert.equal(report.start.payload.transport, 'web_broker');
        assert.match(report.redirect_url, /broker\.example\.test\/authorize/);
        assert.equal(report.callback_ok, true);
        assert.equal(report.shared_session_ok, true);
        assert.equal(report.finalStatus.status, 'autenticado');
        assert.equal(report.finalStatus.operator.email, 'operator@example.com');
        assert.equal(report.logout.payload.status, 'logout');
        assert.equal(report.logout_ok, true);
    } finally {
        await closeServer(backend);
    }
});
