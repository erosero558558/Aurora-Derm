#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

test('HealthController expone checks.turneroPilot para el piloto web por clínica', () => {
    const phpScript = `
        $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'health-turnero-pilot-' . bin2hex(random_bytes(6));
        mkdir($tempDir, 0777, true);
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');
        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }
        require 'api-lib.php';
        require 'controllers/HealthController.php';
        ensure_data_file();
        try {
            HealthController::check([
                'store' => read_store(),
                'requestStartedAt' => microtime(true),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => false,
            ]);
        } catch (TestingExitException $e) {
            echo json_encode($e->payload);
        }
    `;

    const result = spawnSync('php', ['-r', phpScript], {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);

    const payload = JSON.parse(result.stdout);
    const snapshot = payload?.checks?.turneroPilot;
    const publicSync = payload?.checks?.publicSync;

    assert.equal(payload.ok, true);
    assert.equal(payload.status, 'ok');
    assert.equal(typeof payload.storageBackend, 'undefined');
    assert.equal(typeof payload?.checks?.storage, 'undefined');
    assert.equal(snapshot?.configured, true);
    assert.equal(snapshot?.ready, true);
    assert.equal(snapshot?.profileSource, 'file');
    assert.equal(snapshot?.clinicId, 'piel-armonia-quito');
    assert.equal(snapshot?.catalogAvailable, true);
    assert.equal(snapshot?.catalogMatched, true);
    assert.equal(snapshot?.catalogReady, true);
    assert.equal(snapshot?.catalogEntryId, 'piel-armonia-quito');
    assert.equal(snapshot?.releaseMode, 'web_pilot');
    assert.equal(snapshot?.adminModeDefault, 'basic');
    assert.equal(snapshot?.separateDeploy, true);
    assert.equal(snapshot?.nativeAppsBlocking, false);
    assert.equal(snapshot?.surfaces?.admin?.route, '/admin.html#queue');
    assert.equal(snapshot?.surfaces?.operator?.route, '/operador-turnos.html');
    assert.equal(snapshot?.surfaces?.kiosk?.route, '/kiosco-turnos.html');
    assert.equal(snapshot?.surfaces?.display?.route, '/sala-turnos.html');
    assert.match(String(snapshot?.profileFingerprint || ''), /^[0-9a-f]{8}$/);
    assert.equal(publicSync?.configured, true);
    assert.equal(typeof publicSync?.jobKey, 'string');
    assert.equal(typeof publicSync?.healthy, 'boolean');
    assert.equal(typeof publicSync?.state, 'string');
    assert.equal(typeof publicSync?.deployedCommit, 'string');
    assert.equal(typeof publicSync?.headDrift, 'boolean');
    assert.equal(typeof publicSync?.repoPath, 'undefined');
    assert.equal(typeof publicSync?.statusPath, 'undefined');
    assert.equal(typeof publicSync?.logPath, 'undefined');
    assert.equal(typeof publicSync?.lockFile, 'undefined');
    assert.equal(typeof publicSync?.currentHead, 'undefined');
    assert.equal(typeof publicSync?.remoteHead, 'undefined');
    assert.equal(typeof publicSync?.dirtyPaths, 'undefined');
    assert.equal(typeof publicSync?.dirtyPathsCount, 'undefined');
    assert.equal(typeof publicSync?.lastErrorMessage, 'undefined');
});
