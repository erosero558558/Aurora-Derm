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

function resolvePowerShellCommand() {
    const candidates =
        process.platform === 'win32'
            ? ['powershell', 'powershell.exe', 'pwsh']
            : ['pwsh', 'powershell'];

    for (const candidate of candidates) {
        const result = spawnSync(
            candidate,
            ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
            {
                encoding: 'utf8',
            }
        );
        if (result.status === 0) {
            return candidate;
        }
    }

    return '';
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

test('MONITOR-PRODUCCION escribe JSON canonico aunque falle y mantiene exit code', async (t) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'prod-monitor-report-'));
    const reportPath = join(tempDir, 'prod-monitor-last.json');
    const powerShellCommand = resolvePowerShellCommand();
    let serverStarted = false;
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
        if (!powerShellCommand) {
            t.skip('PowerShell no disponible para validar MONITOR-PRODUCCION');
            return;
        }
        const port = await listen(server);
        serverStarted = true;
        const result = spawnSync(
            powerShellCommand,
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
        if (serverStarted) {
            await closeServer(server);
        }
        rmSync(tempDir, { recursive: true, force: true });
    }
});
