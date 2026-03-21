'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const storage = createLocalStorageStub();
global.localStorage = storage;

test.beforeEach(() => {
    storage.clear();
});

const CLINIC_PROFILE = buildClinicProfile({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clinica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    region: 'sierra',
    surfaces: {
        operator: {
            label: 'Turnero Operador',
            route: '/operador-turnos.html',
        },
        kiosk: {
            label: 'Turnero Kiosco',
            route: '/kiosco-turnos.html',
        },
        display: {
            label: 'Turnero Sala TV',
            route: '/sala-turnos.html',
        },
    },
});

test('onboarding snapshot normalizes clinic fields and routes', async () => {
    const snapshotModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-snapshot.js'
    );
    const packModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-pack.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceOnboardingSnapshot({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
    });
    const pack = packModule.buildTurneroSurfaceOnboardingPack({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.surfaceRoute, '/operador-turnos.html');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clinica Demo');
    assert.equal(snapshot.kickoffState, 'ready');
    assert.equal(pack.readout.chips.length, 3);
    assert.match(pack.readout.summary, /Onboarding/);
    assert.match(pack.readout.detail, /Runtime ready/);
});

test('onboarding ledger and owner store persist by clinic scope', async () => {
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-owner-store.js'
    );

    const ledger = ledgerModule.createTurneroSurfaceOnboardingLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicLedger =
        ledgerModule.createTurneroSurfaceOnboardingLedger(
            'regional',
            CLINIC_PROFILE
        );
    const otherClinicLedger =
        ledgerModule.createTurneroSurfaceOnboardingLedger('regional', {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        });
    const owners = ownerModule.createTurneroSurfaceOnboardingOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicOwners =
        ownerModule.createTurneroSurfaceOnboardingOwnerStore(
            'regional',
            CLINIC_PROFILE
        );
    const otherClinicOwners =
        ownerModule.createTurneroSurfaceOnboardingOwnerStore('regional', {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        });

    ledger.add({
        surfaceKey: 'operator-turnos',
        title: 'Checklist operator',
        owner: 'ops-lead',
        status: 'ready',
        note: 'Brief listo.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'onboarding',
        status: 'active',
        note: 'Owner principal.',
    });

    assert.equal(sameClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(sameClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 0);
});

test('onboarding gate resolves ready watch and blocked bands', async () => {
    const gateModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-gate.js'
    );

    const ready = gateModule.buildTurneroSurfaceOnboardingGate({
        snapshots: [
            {
                surfaceKey: 'sala-turnos',
                runtimeState: 'ready',
                truth: 'aligned',
                kickoffState: 'ready',
                dataIntakeState: 'ready',
                accessState: 'ready',
                onboardingOwner: 'ops-display',
                trainingWindow: 'miercoles 08:00',
            },
        ],
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        owners: [{ surfaceKey: 'sala-turnos', actor: 'ops-display', status: 'active' }],
    });

    const watch = gateModule.buildTurneroSurfaceOnboardingGate({
        snapshots: [
            {
                surfaceKey: 'operator-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                kickoffState: 'ready',
                dataIntakeState: 'ready',
                accessState: 'watch',
                onboardingOwner: 'ops-lead',
                trainingWindow: 'martes 09:00',
            },
        ],
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        owners: [{ surfaceKey: 'operator-turnos', actor: 'ops-lead', status: 'active' }],
    });

    const blocked = gateModule.buildTurneroSurfaceOnboardingGate({
        snapshots: [
            {
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                kickoffState: 'watch',
                dataIntakeState: 'pending',
                accessState: 'pending',
                onboardingOwner: '',
                trainingWindow: '',
            },
        ],
        checklist: { summary: { all: 4, pass: 2, fail: 2 } },
    });

    assert.equal(ready.band, 'ready');
    assert.equal(ready.decision, 'onboarding-ready');
    assert.equal(watch.band, 'watch');
    assert.equal(watch.decision, 'review-onboarding');
    assert.equal(blocked.band, 'blocked');
    assert.equal(blocked.decision, 'hold-onboarding');
});

test('banner hides when ready and html exposes the onboarding contract', async () => {
    const bannerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-onboarding-banner.js'
    );
    const consoleModule = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-onboarding-console.js'
    );

    const readyBanner = bannerModule.buildTurneroSurfaceOnboardingBannerHtml({
        pack: {
            readout: {
                surfaceKey: 'sala-turnos',
                gateBand: 'ready',
            },
        },
    });
    const watchBanner = bannerModule.buildTurneroSurfaceOnboardingBannerHtml({
        pack: {
            readout: {
                surfaceKey: 'operator-turnos',
                state: 'watch',
                gateBand: 'watch',
                gateDecision: 'review-onboarding',
                gateScore: 82,
                badge: 'watch · 82',
                title: 'Onboarding en observacion',
                summary: 'Onboarding en observacion para Turnero Operador.',
                detail: 'Runtime ready · access watch',
            },
        },
    });
    const html =
        consoleModule.buildTurneroAdminQueueSurfaceOnboardingConsoleHtml({
            scope: 'regional',
            clinicProfile: CLINIC_PROFILE,
            snapshots: [
                { surfaceKey: 'operator-turnos' },
                { surfaceKey: 'kiosco-turnos' },
                { surfaceKey: 'sala-turnos' },
            ],
            checklist: { summary: { all: 6, pass: 4, fail: 2 } },
        });

    assert.equal(readyBanner, '');
    assert.match(watchBanner, /data-role="banner"/);
    assert.match(html, /Surface Customer Onboarding/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add onboarding item/);
    assert.match(html, /Add owner/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-role="brief"/);
});
