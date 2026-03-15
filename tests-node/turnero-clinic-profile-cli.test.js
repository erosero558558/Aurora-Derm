'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const {
    getActiveTurneroClinicProfileStatus,
    getTurneroClinicProfileFingerprint,
} = require('../lib/turnero-clinic-profile-registry.js');

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections?.();
        server.closeAllConnections?.();
    });
}

function runCli(args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [cliPath, ...args], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...options,
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            resolve({
                status: code,
                signal,
                stdout,
                stderr,
            });
        });
    });
}

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'bin', 'turnero-clinic-profile.js');

test('CLI lista perfiles catalogados en JSON', () => {
    const result = spawnSync('node', [cliPath, 'list', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.ok(Array.isArray(payload.items));
    assert.ok(
        payload.items.some((item) => item.id === 'piel-armonia-quito'),
        result.stdout
    );
});

test('CLI reporta status del perfil activo actual', () => {
    const result = spawnSync('node', [cliPath, 'status', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.profile.clinic_id, 'piel-armonia-quito');
    assert.equal(payload.matchingProfileId, 'piel-armonia-quito');
    assert.equal(payload.catalogReady, true);
    assert.match(String(payload.profileFingerprint || ''), /^[a-f0-9]{8}$/);
});

test('CLI permite preview de stage sin escribir el perfil activo', () => {
    const result = spawnSync(
        'node',
        [cliPath, 'stage', '--id', 'clinica-norte-demo', '--dry-run', '--json'],
        {
            cwd: projectRoot,
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.id, 'clinica-norte-demo');
    assert.equal(payload.dryRun, true);
    assert.equal(payload.profile.clinic_id, 'clinica-norte-demo');
});

test('CLI verify-remote confirma cuando /health coincide con el perfil activo', async () => {
    const active = getActiveTurneroClinicProfileStatus({
        root: projectRoot,
    });
    const fingerprint = getTurneroClinicProfileFingerprint(active.profile);

    const server = http.createServer((request, response) => {
        if (request.url !== '/api.php?resource=health') {
            response.writeHead(404, {
                'Content-Type': 'application/json',
                Connection: 'close',
            });
            response.end(JSON.stringify({ ok: false }));
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'application/json',
            Connection: 'close',
        });
        response.end(
            JSON.stringify({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync: {
                        configured: true,
                        healthy: true,
                        state: 'ok',
                        deployedCommit:
                            'eb7d68da2077126a8e1f1874423cf6c08968e46b',
                        headDrift: false,
                    },
                    turneroPilot: {
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId: active.profile.clinic_id,
                        profileFingerprint: fingerprint,
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        catalogEntryId: active.matchingProfileId,
                        releaseMode: active.profile.release.mode,
                        adminModeDefault:
                            active.profile.release.admin_mode_default,
                        separateDeploy: active.profile.release.separate_deploy,
                        nativeAppsBlocking:
                            active.profile.release.native_apps_blocking,
                        surfaces: active.profile.surfaces,
                    },
                },
            })
        );
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
        const result = await runCli([
            'verify-remote',
            '--base-url',
            `http://127.0.0.1:${port}`,
            '--json',
        ]);

        assert.equal(result.signal, null);
        assert.equal(result.status, 0, result.stderr);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.ok, true);
        assert.equal(payload.turneroPilot.clinicId, active.profile.clinic_id);
        assert.equal(payload.turneroPilot.profileFingerprint, fingerprint);
    } finally {
        await closeServer(server);
    }
});

test('CLI verify-remote falla cuando /health expone otra clínica', async () => {
    const server = http.createServer((request, response) => {
        if (request.url !== '/api.php?resource=health') {
            response.writeHead(404, {
                'Content-Type': 'application/json',
                Connection: 'close',
            });
            response.end(JSON.stringify({ ok: false }));
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'application/json',
            Connection: 'close',
        });
        response.end(
            JSON.stringify({
                ok: true,
                status: 'ok',
                checks: {
                    publicSync: {
                        configured: true,
                        healthy: true,
                        state: 'ok',
                        deployedCommit:
                            'eb7d68da2077126a8e1f1874423cf6c08968e46b',
                        headDrift: false,
                    },
                    turneroPilot: {
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId: 'clinica-distinta',
                        profileFingerprint: 'deadbeef',
                        catalogAvailable: true,
                        catalogMatched: true,
                        catalogReady: true,
                        catalogEntryId: 'clinica-distinta',
                        releaseMode: 'web_pilot',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: false,
                        surfaces: {
                            admin: {
                                enabled: true,
                                route: '/admin.html#queue',
                            },
                            operator: {
                                enabled: true,
                                route: '/operador-turnos.html',
                            },
                            kiosk: {
                                enabled: true,
                                route: '/kiosco-turnos.html',
                            },
                            display: {
                                enabled: true,
                                route: '/sala-turnos.html',
                            },
                        },
                    },
                },
            })
        );
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
        const result = await runCli([
            'verify-remote',
            '--base-url',
            `http://127.0.0.1:${port}`,
            '--json',
        ]);

        assert.equal(result.signal, null);
        assert.equal(result.status, 1, result.stdout);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.ok, false);
        assert.match(
            payload.errors.join('\n'),
            /checks\.turneroPilot\.clinicId=clinica-distinta/i
        );
    } finally {
        await closeServer(server);
    }
});

test('CLI verify-remote tolera health publico redactado y lo deja como warning', async () => {
    const server = http.createServer((request, response) => {
        if (request.url !== '/api.php?resource=health') {
            response.writeHead(404, {
                'Content-Type': 'application/json',
                Connection: 'close',
            });
            response.end(JSON.stringify({ ok: false }));
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'application/json',
            Connection: 'close',
        });
        response.end(
            JSON.stringify({
                ok: true,
                status: 'ok',
                version: '20260314',
            })
        );
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
        const result = await runCli([
            'verify-remote',
            '--base-url',
            `http://127.0.0.1:${port}`,
            '--json',
        ]);

        assert.equal(result.signal, null);
        assert.equal(result.status, 0, result.stdout);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.ok, true);
        assert.equal(payload.publicHealthRedacted, true);
        assert.equal(payload.remoteResource, 'health');
        assert.match(
            payload.warnings.join('\n'),
            /health remoto redactado sin diagnostics token/i
        );
    } finally {
        await closeServer(server);
    }
});
