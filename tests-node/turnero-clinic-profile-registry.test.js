'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    PROFILE_SCHEMA,
    getActiveTurneroClinicProfileStatus,
    listTurneroClinicProfiles,
    stageTurneroClinicProfile,
    validateTurneroClinicProfile,
} = require('../lib/turnero-clinic-profile-registry.js');

test('lista perfiles turnero catalogados para despliegues separados', () => {
    const items = listTurneroClinicProfiles({
        root: path.resolve(__dirname, '..'),
    });

    assert.ok(items.length >= 2);
    assert.ok(items.some((entry) => entry.id === 'piel-armonia-quito'));
    assert.ok(items.some((entry) => entry.id === 'clinica-norte-demo'));
    assert.equal(
        items.every((entry) => entry.ok),
        true
    );
});

test('valida perfil turnero y exige separate_deploy para el piloto', () => {
    const validation = validateTurneroClinicProfile({
        schema: PROFILE_SCHEMA,
        clinic_id: 'clinica-demo',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
            city: 'Quito',
            base_url: 'https://demo.example.com',
        },
        consultorios: {
            c1: { label: 'Uno', short_label: 'U1' },
            c2: { label: 'Dos', short_label: 'D2' },
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: true,
                label: 'Operador',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: true,
                label: 'Sala',
                route: '/sala-turnos.html',
            },
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: false,
            native_apps_blocking: false,
            notes: [],
        },
    });

    assert.equal(validation.ok, false);
    assert.match(
        validation.errors.join('\n'),
        /separate_deploy debe quedar en true/i
    );
});

test('stagea un perfil catalogado al clinic-profile activo', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-clinic-profile-stage-')
    );
    const outputPath = path.join(
        tempRoot,
        'content',
        'turnero',
        'clinic-profile.json'
    );

    const result = stageTurneroClinicProfile('clinica-norte-demo', {
        root: path.resolve(__dirname, '..'),
        outputPath,
    });

    assert.equal(result.ok, true);
    assert.equal(result.profile.clinic_id, 'clinica-norte-demo');
    assert.equal(fs.existsSync(outputPath), true);

    const stagedRaw = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(stagedRaw.clinic_id, 'clinica-norte-demo');
    assert.equal(stagedRaw.release.separate_deploy, true);
});

test('status detecta cuando el clinic-profile activo coincide con un catalogo', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-clinic-profile-status-')
    );
    const profilesDir = path.join(
        tempRoot,
        'content',
        'turnero',
        'clinic-profiles'
    );
    const outputPath = path.join(
        tempRoot,
        'content',
        'turnero',
        'clinic-profile.json'
    );

    fs.mkdirSync(profilesDir, { recursive: true });
    const profile = {
        schema: PROFILE_SCHEMA,
        clinic_id: 'clinica-demo',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
            city: 'Quito',
            base_url: 'https://demo.example.com',
        },
        consultorios: {
            c1: { label: 'Uno', short_label: 'U1' },
            c2: { label: 'Dos', short_label: 'D2' },
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: true,
                label: 'Operador',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: true,
                label: 'Sala',
                route: '/sala-turnos.html',
            },
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: false,
            notes: [],
        },
    };

    fs.writeFileSync(
        path.join(profilesDir, 'clinica-demo.json'),
        `${JSON.stringify(profile, null, 4)}\n`
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(profile, null, 4)}\n`);

    const status = getActiveTurneroClinicProfileStatus({
        profilesDir,
        outputPath,
    });

    assert.equal(status.ok, true);
    assert.equal(status.matchingProfileId, 'clinica-demo');
    assert.equal(status.matchesCatalog, true);
    assert.equal(status.catalogReady, true);
    assert.match(String(status.profileFingerprint || ''), /^[a-f0-9]{8}$/);
});
