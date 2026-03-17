#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

test('AdminDataController expone turneroClinicProfile y readiness de Turnero V2 por clinica', () => {
    const phpScript = `
        $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'admin-data-turnero-profile-' . bin2hex(random_bytes(6));
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
    const profile = payload?.data?.turneroClinicProfile;
    const catalogStatus = payload?.data?.turneroClinicProfileCatalogStatus;
    const operatorAccess = payload?.data?.turneroOperatorAccessMeta;
    const readiness = payload?.data?.turneroV2Readiness;

    assert.equal(payload.ok, true);
    assert.equal(profile?.schema, 'turnero-clinic-profile/v1');
    assert.equal(profile?.clinic_id, 'piel-armonia-quito');
    assert.equal(profile?.branding?.name, 'Aurora Derm');
    assert.equal(profile?.branding?.short_name, 'Aurora Derm');
    assert.equal(profile?.release?.mode, 'suite_v2');
    assert.equal(profile?.release?.admin_mode_default, 'basic');
    assert.equal(profile?.release?.separate_deploy, true);
    assert.equal(profile?.release?.native_apps_blocking, true);
    assert.equal(profile?.surfaces?.operator?.route, '/operador-turnos.html');
    assert.equal(profile?.surfaces?.kiosk?.route, '/kiosco-turnos.html');
    assert.equal(profile?.surfaces?.display?.route, '/sala-turnos.html');
    assert.equal(catalogStatus?.catalogAvailable, true);
    assert.equal(catalogStatus?.clinicId, 'piel-armonia-quito');
    assert.equal(catalogStatus?.matchingProfileId, 'piel-armonia-quito');
    assert.equal(catalogStatus?.matchesCatalog, true);
    assert.equal(catalogStatus?.ready, true);
    assert.equal(operatorAccess?.mode, 'operator_pin');
    assert.equal(operatorAccess?.clinicId, 'piel-armonia-quito');
    assert.equal(operatorAccess?.configured, false);
    assert.equal(operatorAccess?.pinSet, false);
    assert.equal(operatorAccess?.maskedPinLabel, '');
    assert.equal(operatorAccess?.sessionTtlHours, 8);
    assert.equal(readiness?.enabled, true);
    assert.equal(readiness?.releaseMode, 'suite_v2');
    assert.equal(readiness?.nativeAppsBlocking, true);
    assert.equal(readiness?.ready, false);
    assert.equal(readiness?.operatorAccess?.configured, false);
    assert.equal(readiness?.surfaces?.admin?.ready, true);
    assert.equal(readiness?.hardware?.assistant?.ready, false);
    assert.equal(readiness?.hardware?.printer?.ready, false);
    assert.equal(readiness?.blockingCount > 0, true);
});
