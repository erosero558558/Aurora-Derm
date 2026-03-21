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

function installLocalStorageMock() {
    const store = new Map();
    global.localStorage = {
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
    };
}

installLocalStorageMock();

test.beforeEach(() => {
    global.localStorage.clear();
});

const CLINIC_PROFILE = Object.freeze({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clínica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    region: 'sierra',
    surfaces: {
        operator: {
            label: 'Turnero Operador',
        },
        kiosk: {
            label: 'Turnero Kiosco',
        },
        display: {
            label: 'Turnero Sala TV',
        },
    },
});

test('success snapshot normalizes clinic data', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-success-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceSuccessSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        adoptionState: 'watch',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-lead',
        followupWindow: 'mensual',
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clínica Demo');
    assert.equal(snapshot.adoptionState, 'watch');
});

test('success ledger and owner store are clinic-scoped', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-success-ledger.js'
    );
    const ownerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-success-owner-store.js'
    );

    const ledger = ledgerModule.createTurneroSurfaceSuccessLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicLedger = ledgerModule.createTurneroSurfaceSuccessLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherClinicLedger = ledgerModule.createTurneroSurfaceSuccessLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );
    const owners = ownerModule.createTurneroSurfaceSuccessOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicOwners = ownerModule.createTurneroSurfaceSuccessOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherClinicOwners = ownerModule.createTurneroSurfaceSuccessOwnerStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const ledgerEntry = ledger.add({
        surfaceKey: 'operator-turnos',
        kind: 'followup-note',
        status: 'ready',
        owner: 'success',
        note: 'Lista para seguimiento.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'success',
        status: 'active',
        note: 'Owner principal.',
    });

    assert.equal(ledgerEntry.surfaceKey, 'operator-turnos');
    assert.equal(sameClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicLedger.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(sameClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicOwners.list({ surfaceKey: 'operator-turnos' }).length, 0);
});

test('success pack and console html expose customer success metadata', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-success-pack.js'
    );
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-success-console.js'
    );
    const { buildTurneroAdminQueueSurfaceSuccessConsoleHtml } = consoleModule;

    const pack = packModule.buildTurneroSurfaceSuccessPack({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
        adoptionState: 'ready',
        incidentRateBand: 'low',
        feedbackState: 'good',
        successOwner: 'ops-display',
        followupWindow: 'mensual',
        checklist: {
            summary: {
                all: 4,
                pass: 4,
                fail: 0,
            },
        },
        ledger: [
            {
                surfaceKey: 'sala-turnos',
                kind: 'followup-note',
                status: 'ready',
                owner: 'success',
                note: 'Seguimiento listo.',
            },
        ],
        owners: [
            {
                surfaceKey: 'sala-turnos',
                actor: 'ops-display',
                role: 'success',
                status: 'active',
                note: 'Owner operativo.',
            },
        ],
    });

    assert.equal(
        typeof buildTurneroAdminQueueSurfaceSuccessConsoleHtml,
        'function'
    );

    const html = buildTurneroAdminQueueSurfaceSuccessConsoleHtml({
        scope: 'regional',
        clinicProfile: CLINIC_PROFILE,
        snapshots: [
            {
                label: 'Turnero Operador',
                surfaceKey: 'operator-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                adoptionState: 'watch',
                incidentRateBand: 'low',
                feedbackState: 'good',
                successOwner: 'ops-lead',
                followupWindow: 'mensual',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
            {
                label: 'Turnero Kiosco',
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                adoptionState: 'watch',
                incidentRateBand: 'medium',
                feedbackState: 'mixed',
                successOwner: '',
                followupWindow: '',
                checklist: { summary: { all: 4, pass: 2, fail: 2 } },
            },
            {
                label: 'Turnero Sala TV',
                surfaceKey: 'sala-turnos',
                runtimeState: 'ready',
                truth: 'aligned',
                adoptionState: 'ready',
                incidentRateBand: 'low',
                feedbackState: 'good',
                successOwner: 'ops-display',
                followupWindow: 'mensual',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
        ],
        checklist: {
            summary: {
                all: 6,
                pass: 4,
                fail: 2,
            },
        },
    });

    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.readout.chips.length, 3);
    assert.equal(pack.readout.gateDecision, 'customer-success-ready');
    assert.match(pack.brief, /Surface Customer Success/);
    assert.match(html, /Surface Customer Success Console/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Sala TV/);
});
