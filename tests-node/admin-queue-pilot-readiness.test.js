#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function buildPilotProfile(overrides = {}) {
    const clinicId = String(overrides.clinic_id || 'clinica-norte-demo').trim();
    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: clinicId,
        branding: {
            name: 'Clínica Norte',
            short_name: 'Norte',
            base_url: 'https://norte.example',
        },
        consultorios: {
            c1: {
                label: 'Consultorio 1',
                short_label: 'C1',
            },
            c2: {
                label: 'Consultorio 2',
                short_label: 'C2',
            },
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin web',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: '/sala-turnos.html',
            },
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
            notes: [],
        },
        runtime_meta: {
            source: 'remote',
            profileFingerprint: '1234abcd',
        },
        ...overrides,
    };
}

function createMemoryStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        getItem(key) {
            const normalizedKey = String(key);
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
        entries() {
            return Array.from(store.entries());
        },
    };
}

test('clinic-profile expone aliases compatibles con el ZIP y el opening package nuevo', async () => {
    const clinicProfile = await importRepoModule(
        'src/apps/queue-shared/clinic-profile.js'
    );

    const profile = buildPilotProfile();
    const currentRoute = '/admin.html#queue';

    assert.equal(
        clinicProfile.getTurneroReleaseMode(profile),
        clinicProfile.getTurneroClinicReleaseMode(profile)
    );
    assert.strictEqual(
        clinicProfile.buildTurneroPilotOpeningPackage,
        clinicProfile.getTurneroClinicOpeningPackage
    );

    const readiness = clinicProfile.getTurneroPilotSurfaceReadiness(profile, {
        currentSurface: 'admin',
        currentRoute,
    });
    const blockers = clinicProfile.getTurneroPilotBlockers(profile, {
        currentSurface: 'admin',
        currentRoute,
        trustedProfileFingerprint: '1234abcd',
    });
    const openingPackage = clinicProfile.getTurneroPilotOpeningPackage(
        profile,
        {
            currentSurface: 'admin',
            currentRoute,
            trustedProfileFingerprint: '1234abcd',
        }
    );

    assert.equal(readiness.summaryLabel, '4/4 superficies listas');
    assert.equal(readiness.readyCount, 4);
    assert.equal(readiness.totalCount, 4);
    assert.equal(readiness.blockedCount, 0);
    assert.equal(openingPackage.finalStatus, 'ready');
    assert.equal(openingPackage.blocked, false);
    assert.equal(openingPackage.profileFingerprint, '1234abcd');
    assert.equal(openingPackage.releaseMode, 'suite_v2');
    assert.equal(blockers.length, 0);
});

test('fallback profile bloquea el opening package y reporta blockers de clinic', async () => {
    const clinicProfile = await importRepoModule(
        'src/apps/queue-shared/clinic-profile.js'
    );

    const profile = buildPilotProfile({
        runtime_meta: {
            source: 'fallback_default',
            profileFingerprint: '1234abcd',
        },
    });

    const openingPackage = clinicProfile.getTurneroPilotOpeningPackage(
        profile,
        {
            currentSurface: 'admin',
            currentRoute: '/admin.html#queue',
            trustedProfileFingerprint: 'deadbeef',
        }
    );
    const blockers = clinicProfile.getTurneroPilotBlockers(profile, {
        currentSurface: 'admin',
        currentRoute: '/admin.html#queue',
        trustedProfileFingerprint: 'deadbeef',
    });

    assert.equal(openingPackage.finalStatus, 'blocked');
    assert.equal(openingPackage.blocked, true);
    assert.ok(
        blockers.some((blocker) => blocker.reason === 'profile_missing'),
        'debe exponer el bloqueo por profile_missing'
    );
    assert.ok(
        blockers.some((blocker) => blocker.reason === 'fingerprint_untrusted'),
        'debe exponer el bloqueo por fingerprint_untrusted'
    );
});

test('admin queue readiness helper migra storage legado y renderiza los datos canonicos', async () => {
    const readinessModule = await importRepoModule(
        'src/apps/queue-shared/admin-queue-pilot-readiness.js'
    );

    const profile = buildPilotProfile({
        clinic_id: 'clinica-sur-demo',
        runtime_meta: {
            source: 'remote',
            profileFingerprint: 'beadfeed',
        },
    });
    const storage = createMemoryStorage({
        adminQueueStationMode: 'locked',
        adminQueuePracticeMode: 'basic',
        adminQueueFilter: 'all',
    });

    const migrationResults =
        readinessModule.migrateAdminQueueClinicScopedStorage(profile, storage);
    const scopedPrefix = 'adminQueueClinicScopedV1:clinica-sur-demo:';
    const rendered = readinessModule.renderAdminQueuePilotReadinessCard(
        profile,
        {
            currentRoute: '/admin.html#queue',
            trustedProfileFingerprint: 'beadfeed',
            storage,
        }
    );

    assert.equal(migrationResults.length, 3);
    assert.equal(storage.getItem(`${scopedPrefix}stationMode`), 'locked');
    assert.equal(storage.getItem(`${scopedPrefix}practiceMode`), 'basic');
    assert.equal(storage.getItem(`${scopedPrefix}filter`), 'all');
    assert.match(rendered, /clinic_id/i);
    assert.match(rendered, /profileFingerprint/i);
    assert.match(rendered, /releaseMode/i);
    assert.match(rendered, /runtime/i);
    assert.match(rendered, /finalStatus/i);
    assert.match(rendered, /queue-app-card/);
});
