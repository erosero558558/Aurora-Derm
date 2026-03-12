#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

test('AdminDataController expone appDownloads con catalog y surfaces canonicos', () => {
    const phpScript = `
        $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'admin-data-app-downloads-' . bin2hex(random_bytes(6));
        mkdir($tempDir, 0777, true);
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');
        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }
        require 'api-lib.php';
        require 'controllers/AdminDataController.php';
        ensure_data_file();
        try {
            AdminDataController::index([
                'store' => read_store(),
                'isAdmin' => true,
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

    assert.equal(payload.ok, true);
    assert.equal(
        payload.data.appDownloads.catalog.operator.targets.win.url,
        '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe'
    );
    assert.equal(
        payload.data.appDownloads.surfaces.operator.ops.installHub
            .recommendedFor,
        'PC operador'
    );
    assert.equal(
        payload.data.appDownloads.surfaces.sala_tv.ops.telemetry.title,
        'Sala TV'
    );
});
