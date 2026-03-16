#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { mkdtempSync, readFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawn } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'bin',
    'admin-openclaw-rollout-diagnostic.js'
);

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(payload));
}

function startMockServer(handler) {
    return new Promise((resolvePromise, rejectPromise) => {
        const server = http.createServer(handler);
        server.on('error', rejectPromise);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolvePromise({
                server,
                baseUrl: `http://127.0.0.1:${address.port}`,
            });
        });
    });
}

async function withMockServer(handler, callback) {
    const { server, baseUrl } = await startMockServer(handler);
    try {
        return await callback(baseUrl);
    } finally {
        await new Promise((resolvePromise, rejectPromise) => {
            server.close((error) => {
                if (error) {
                    rejectPromise(error);
                    return;
                }

                resolvePromise();
            });
        });
    }
}

function runDiagnostic(baseUrl, reportPath) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
            process.execPath,
            [SCRIPT_PATH, '--domain', baseUrl, '--report-path', reportPath],
            {
                cwd: REPO_ROOT,
                stdio: ['ignore', 'pipe', 'pipe'],
            }
        );

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += String(chunk);
        });

        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });

        child.on('error', (error) => {
            rejectPromise(error);
        });

        child.on('close', (code, signal) => {
            resolvePromise({
                status: code,
                signal,
                stdout,
                stderr,
            });
        });
    });
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function operatorAuthConfiguredPayload(overrides = {}) {
    return {
        ok: true,
        authenticated: false,
        mode: 'openclaw_chatgpt',
        transport: 'web_broker',
        status: 'anonymous',
        configured: true,
        configuration: {
            helperBaseUrl: 'http://127.0.0.1:4173',
            bridgeTokenConfigured: true,
            bridgeSecretConfigured: true,
            allowlistConfigured: true,
            brokerAuthorizeUrlConfigured: true,
            brokerTokenUrlConfigured: true,
            brokerUserinfoUrlConfigured: true,
            brokerClientIdConfigured: true,
            brokerTrustConfigured: true,
            brokerIssuerPinned: true,
            brokerAudiencePinned: true,
            brokerJwksConfigured: true,
            brokerEmailVerifiedRequired: true,
            missing: [],
        },
        ...overrides,
    };
}

function adminAuthLegacyPayload() {
    return {
        ok: true,
        authenticated: false,
        capabilities: {
            adminAgent: false,
        },
    };
}

test('diagnostico detecta fachada legacy cuando operator-auth-status no esta disponible', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-legacy-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(res, 503, {
                        ok: false,
                        error: 'operator_auth_not_configured',
                    });
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(res, 200, adminAuthLegacyPayload());
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'admin_auth_legacy_facade');
                assert.equal(report.operator_auth_status.http_status, 503);
                assert.equal(report.admin_auth_facade.http_status, 200);
                assert.match(
                    report.next_action,
                    /admin-auth\.php.*contrato OpenClaw/i
                );
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico marca facade_only_rollout cuando solo la fachada ya habla OpenClaw', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-facade-only-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(res, 503, {
                        ok: false,
                        error: 'operator_auth_not_configured',
                    });
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(res, 200, operatorAuthConfiguredPayload());
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'facade_only_rollout');
                assert.equal(report.resolved.source, 'admin-auth-facade');
                assert.match(report.next_action, /operator-auth-status/i);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico queda en verde cuando operator-auth-status ya publica contrato OpenClaw configurado', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-ready-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(res, 200, operatorAuthConfiguredPayload());
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(res, 200, operatorAuthConfiguredPayload());
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 0, result.stderr || result.stdout);
                assert.equal(report.ok, true);
                assert.equal(report.diagnosis, 'openclaw_ready');
                assert.equal(report.resolved.source, 'operator-auth-status');
                assert.equal(report.resolved.mode, 'openclaw_chatgpt');
                assert.equal(report.resolved.configured, true);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico marca transport_misconfigured cuando la surface OpenClaw omite transport', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-missing-transport-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(res, 200, {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        status: 'anonymous',
                        configured: true,
                        configuration: {
                            brokerTrustConfigured: true,
                            brokerIssuerPinned: true,
                            brokerAudiencePinned: true,
                            brokerJwksConfigured: true,
                            brokerEmailVerifiedRequired: true,
                            missing: [],
                        },
                    });
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(res, 200, {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        status: 'anonymous',
                        configured: true,
                        configuration: {
                            brokerTrustConfigured: true,
                            brokerIssuerPinned: true,
                            brokerAudiencePinned: true,
                            brokerJwksConfigured: true,
                            brokerEmailVerifiedRequired: true,
                            missing: [],
                        },
                    });
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'transport_misconfigured');
                assert.match(report.next_action, /transport=web_broker/i);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico no marca openclaw_ready cuando web_broker sigue sin trust OIDC completo', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-trust-missing-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(
                        res,
                        200,
                        operatorAuthConfiguredPayload({
                            configuration: {
                                helperBaseUrl: 'http://127.0.0.1:4173',
                                bridgeTokenConfigured: true,
                                bridgeSecretConfigured: true,
                                allowlistConfigured: true,
                                brokerAuthorizeUrlConfigured: true,
                                brokerTokenUrlConfigured: true,
                                brokerUserinfoUrlConfigured: true,
                                brokerClientIdConfigured: true,
                                brokerTrustConfigured: false,
                                brokerIssuerPinned: false,
                                brokerAudiencePinned: false,
                                brokerJwksConfigured: false,
                                brokerEmailVerifiedRequired: false,
                                missing: [],
                            },
                        })
                    );
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(
                        res,
                        200,
                        operatorAuthConfiguredPayload({
                            configuration: {
                                helperBaseUrl: 'http://127.0.0.1:4173',
                                bridgeTokenConfigured: true,
                                bridgeSecretConfigured: true,
                                allowlistConfigured: true,
                                brokerAuthorizeUrlConfigured: true,
                                brokerTokenUrlConfigured: true,
                                brokerUserinfoUrlConfigured: true,
                                brokerClientIdConfigured: true,
                                brokerTrustConfigured: false,
                                brokerIssuerPinned: false,
                                brokerAudiencePinned: false,
                                brokerJwksConfigured: false,
                                brokerEmailVerifiedRequired: false,
                                missing: [],
                            },
                        })
                    );
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'openclaw_not_configured');
                assert.match(report.next_action, /trust OIDC/i);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico enumera env faltantes cuando OpenClaw esta activo pero incompleto', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-missing-env-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(
                        res,
                        200,
                        operatorAuthConfiguredPayload({
                            configured: false,
                            configuration: {
                                helperBaseUrl: 'http://127.0.0.1:4173',
                                bridgeTokenConfigured: false,
                                bridgeSecretConfigured: true,
                                allowlistConfigured: false,
                                missing: ['bridge_token', 'allowlist'],
                            },
                        })
                    );
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    sendJson(
                        res,
                        200,
                        operatorAuthConfiguredPayload({
                            configured: false,
                            configuration: {
                                helperBaseUrl: 'http://127.0.0.1:4173',
                                bridgeTokenConfigured: false,
                                bridgeSecretConfigured: true,
                                allowlistConfigured: false,
                                missing: ['bridge_token', 'allowlist'],
                            },
                        })
                    );
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'openclaw_not_configured');
                assert.deepEqual(report.resolved.missing, [
                    'bridge_token',
                    'allowlist',
                ]);
                assert.match(
                    report.next_action,
                    /PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN/
                );
                assert.match(
                    report.next_action,
                    /PIELARMONIA_OPERATOR_AUTH_ALLOWLIST/
                );
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico separa fallo de edge/origen cuando operator auth devuelve 530/1033', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-edge-failure-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    (url.pathname === '/api.php' &&
                        url.searchParams.get('resource') ===
                            'operator-auth-status') ||
                    (url.pathname === '/admin-auth.php' &&
                        url.searchParams.get('action') === 'status')
                ) {
                    res.writeHead(530, {
                        'Content-Type': 'text/plain; charset=utf-8',
                    });
                    res.end('error code: 1033');
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.equal(report.ok, false);
                assert.equal(report.diagnosis, 'operator_auth_edge_failure');
                assert.equal(report.operator_auth_status.http_status, 530);
                assert.equal(report.admin_auth_facade.http_status, 530);
                assert.match(report.next_action, /Cloudflare\/origen/i);
                assert.match(report.next_action, /1033/);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('diagnostico acepta web_broker listo sin exigir helper local', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'openclaw-auth-diagnostic-web-broker-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (
                    (url.pathname === '/api.php' &&
                        url.searchParams.get('resource') ===
                            'operator-auth-status') ||
                    (url.pathname === '/admin-auth.php' &&
                        url.searchParams.get('action') === 'status')
                ) {
                    sendJson(
                        res,
                        200,
                        operatorAuthConfiguredPayload({
                            transport: 'web_broker',
                            configuration: {
                                helperBaseUrl: '',
                                bridgeTokenConfigured: false,
                                bridgeSecretConfigured: false,
                                allowlistConfigured: false,
                                brokerAuthorizeUrlConfigured: true,
                                brokerTokenUrlConfigured: true,
                                brokerUserinfoUrlConfigured: true,
                                brokerClientIdConfigured: true,
                                brokerTrustConfigured: true,
                                brokerIssuerPinned: true,
                                brokerAudiencePinned: true,
                                brokerJwksConfigured: true,
                                brokerEmailVerifiedRequired: true,
                                missing: [],
                            },
                        })
                    );
                    return;
                }

                res.writeHead(404);
                res.end();
            },
            async (baseUrl) => {
                const result = await runDiagnostic(baseUrl, reportPath);
                const report = readJson(reportPath);

                assert.equal(result.status, 0, result.stderr || result.stdout);
                assert.equal(report.ok, true);
                assert.equal(report.diagnosis, 'openclaw_ready');
                assert.equal(report.resolved.transport, 'web_broker');
                assert.equal(report.resolved.source, 'operator-auth-status');
                assert.match(report.next_action, /web_broker/i);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});
