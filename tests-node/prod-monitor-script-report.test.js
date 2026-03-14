#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const http = require('node:http');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'MONITOR-PRODUCCION.ps1'
);

function getPowerShellCommand() {
    return process.platform === 'win32' ? 'powershell' : 'pwsh';
}

function listen(server) {
    return new Promise((resolvePromise, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolvePromise(address.port);
        });
    });
}

function closeServer(server) {
    return new Promise((resolvePromise, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolvePromise();
        });
    });
}

test('MONITOR-PRODUCCION escribe JSON canonico aunque falle y mantiene exit code', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'prod-monitor-report-'));
    const reportPath = join(tempDir, 'prod-monitor-last.json');
    const server = http.createServer((request, response) => {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(
            JSON.stringify({
                ok: false,
                status: 'down',
                path: request.url,
            })
        );
    });

    try {
        const port = await listen(server);
        const result = spawnSync(
            getPowerShellCommand(),
            [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                SCRIPT_PATH,
                '-Domain',
                `http://127.0.0.1:${port}`,
                '-TimeoutSec',
                '1',
                '-ReportPath',
                reportPath,
            ],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                timeout: 90000,
            }
        );

        assert.equal(result.status, 1, result.stderr || result.stdout);
        assert.equal(
            existsSync(reportPath),
            true,
            'el monitor debe escribir prod-monitor-last.json incluso si falla'
        );

        const report = JSON.parse(
            readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '')
        );
        assert.equal(report.ok, false);
        assert.equal(report.status, 'failed');
        assert.equal(Array.isArray(report.failures), true);
        assert.ok(report.failures.length > 0, 'debe registrar failures');
        assert.equal(report.domain, `http://127.0.0.1:${port}`);
        assert.equal(
            report.reportPath.endsWith('prod-monitor-last.json'),
            true
        );
        assert.equal(
            report.checks && typeof report.checks === 'object',
            true,
            'el reporte debe incluir checks normalizados'
        );
    } finally {
        await closeServer(server);
        rmSync(tempDir, { recursive: true, force: true });
    }
});
