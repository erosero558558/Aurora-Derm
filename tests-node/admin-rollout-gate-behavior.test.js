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
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'admin-rollout-gate.js');

function adminShellHtml() {
    return [
        '<!doctype html>',
        '<html lang="es">',
        '<head>',
        '<meta charset="utf-8">',
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'\">",
        '<link rel="stylesheet" href="admin-v3.css?v=test-gate">',
        '</head>',
        '<body>',
        '<div id="app"></div>',
        '<script src="admin.js?v=test-gate"></script>',
        '</body>',
        '</html>',
    ].join('');
}

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

function runGate(baseUrl, reportPath, options = {}) {
    const stage = String(options.stage || 'stable');
    const extraArgs = [];
    if (options.allowFeatureApiFailure) {
        extraArgs.push('--allow-feature-api-failure');
    }
    if (options.allowMissingAdminFlag) {
        extraArgs.push('--allow-missing-admin-flag');
    }

    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
            process.execPath,
            [
                SCRIPT_PATH,
                '--domain',
                baseUrl,
                '--stage',
                stage,
                '--require-openclaw-auth',
                '--skip-runtime-smoke',
                ...extraArgs,
                '--report-path',
                reportPath,
            ],
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

test('admin rollout gate acepta stage general y switches de tolerancia usados por deploy-hosting', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'admin-rollout-gate-general-'));
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (url.pathname === '/admin.html') {
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(adminShellHtml());
                    return;
                }

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
                            helperBaseUrl: 'http://127.0.0.1:4173',
                            bridgeTokenConfigured: true,
                            bridgeSecretConfigured: true,
                            allowlistConfigured: true,
                            missing: [],
                        },
                    });
                    return;
                }

                res.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8',
                });
                res.end('not-found');
            },
            async (baseUrl) => {
                const result = await runGate(baseUrl, reportPath, {
                    stage: 'general',
                    allowFeatureApiFailure: true,
                    allowMissingAdminFlag: true,
                });

                assert.equal(result.status, 0, result.stderr || result.stdout);

                const report = readJson(reportPath);
                assert.equal(report.ok, true);
                assert.equal(report.stage, 'general');
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

test('admin rollout gate marca la fachada como legacy cuando operator-auth-status cae y admin-auth sigue sin contrato OpenClaw', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'admin-rollout-gate-legacy-'));
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (url.pathname === '/admin.html') {
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(adminShellHtml());
                    return;
                }

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
                    sendJson(res, 200, {
                        ok: true,
                        authenticated: false,
                        capabilities: {
                            adminAgent: false,
                        },
                    });
                    return;
                }

                res.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8',
                });
                res.end('not-found');
            },
            async (baseUrl) => {
                const result = await runGate(baseUrl, reportPath);

                assert.equal(result.status, 1, result.stderr || result.stdout);
                assert.match(
                    result.stdout,
                    /admin-auth facade respondio, pero sigue en contrato legacy/i
                );

                const report = readJson(reportPath);
                assert.equal(report.ok, false);
                assert.equal(report.failures, 1);
                assert.equal(report.operator_auth.http_status, 503);
                assert.equal(report.operator_auth.facade_http_status, 200);
                assert.equal(
                    report.operator_auth.source,
                    'admin-auth-facade-legacy'
                );
                assert.equal(report.operator_auth.contract_valid, false);
                assert.equal(report.operator_auth.mode, '');
                assert.equal(report.operator_auth.status, '');
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('admin rollout gate acepta operator-auth-status cuando ya expone contrato OpenClaw valido', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'admin-rollout-gate-openclaw-'));
    const reportPath = join(tempDir, 'report.json');
    let facadeHits = 0;

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (url.pathname === '/admin.html') {
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(adminShellHtml());
                    return;
                }

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
                            helperBaseUrl: 'http://127.0.0.1:4173',
                            bridgeTokenConfigured: true,
                            bridgeSecretConfigured: true,
                            allowlistConfigured: true,
                            missing: [],
                        },
                    });
                    return;
                }

                if (
                    url.pathname === '/admin-auth.php' &&
                    url.searchParams.get('action') === 'status'
                ) {
                    facadeHits += 1;
                    sendJson(res, 500, {
                        ok: false,
                        error: 'should_not_be_called',
                    });
                    return;
                }

                res.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8',
                });
                res.end('not-found');
            },
            async (baseUrl) => {
                const result = await runGate(baseUrl, reportPath);

                assert.equal(result.status, 0, result.stderr || result.stdout);
                assert.equal(facadeHits, 0, 'no deberia consultar la fachada');

                const report = readJson(reportPath);
                assert.equal(report.ok, true);
                assert.equal(report.failures, 0);
                assert.equal(report.operator_auth.http_status, 200);
                assert.equal(report.operator_auth.facade_http_status, 0);
                assert.equal(
                    report.operator_auth.source,
                    'operator-auth-status'
                );
                assert.equal(report.operator_auth.contract_valid, true);
                assert.equal(report.operator_auth.mode, 'openclaw_chatgpt');
                assert.equal(report.operator_auth.status, 'anonymous');
                assert.equal(report.operator_auth.configured, true);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});

test('admin rollout gate acepta web_broker configurado sin exigir helper local', async () => {
    const tempDir = mkdtempSync(
        join(tmpdir(), 'admin-rollout-gate-web-broker-')
    );
    const reportPath = join(tempDir, 'report.json');

    try {
        await withMockServer(
            (req, res) => {
                const url = new URL(req.url, 'http://127.0.0.1');

                if (url.pathname === '/admin.html') {
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(adminShellHtml());
                    return;
                }

                if (
                    url.pathname === '/api.php' &&
                    url.searchParams.get('resource') === 'operator-auth-status'
                ) {
                    sendJson(res, 200, {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        transport: 'web_broker',
                        status: 'pending',
                        configured: true,
                        configuration: {
                            helperBaseUrl: '',
                            bridgeTokenConfigured: false,
                            bridgeSecretConfigured: false,
                            allowlistConfigured: false,
                            brokerAuthorizeUrlConfigured: true,
                            brokerTokenUrlConfigured: true,
                            brokerUserinfoUrlConfigured: true,
                            brokerClientIdConfigured: true,
                            missing: [],
                        },
                    });
                    return;
                }

                res.writeHead(404, {
                    'Content-Type': 'text/plain; charset=utf-8',
                });
                res.end('not-found');
            },
            async (baseUrl) => {
                const result = await runGate(baseUrl, reportPath);

                assert.equal(result.status, 0, result.stderr || result.stdout);

                const report = readJson(reportPath);
                assert.equal(report.ok, true);
                assert.equal(report.failures, 0);
                assert.equal(
                    report.operator_auth.source,
                    'operator-auth-status'
                );
                assert.equal(report.operator_auth.transport, 'web_broker');
                assert.equal(report.operator_auth.status, 'pending');
                assert.equal(report.operator_auth.configured, true);
            }
        );
    } finally {
        rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});
