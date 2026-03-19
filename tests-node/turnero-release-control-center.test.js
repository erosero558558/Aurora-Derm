'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

let modulePromise = null;

async function loadControlCenterModule() {
    if (!modulePromise) {
        const modulePath = resolve(
            REPO_ROOT,
            'src/apps/queue-shared/turnero-release-control-center.js'
        );
        modulePromise = import(pathToFileURL(modulePath).href);
    }

    return modulePromise;
}

function buildClinicProfile(overrides = {}) {
    const clinicId = String(overrides.clinic_id || 'clinica-demo').trim();
    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: clinicId,
        branding: {
            name: 'Clínica Demo',
            short_name: 'Demo',
            base_url: 'https://demo.example',
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
        },
        runtime_meta: {
            source: 'remote',
            profileFingerprint: '1234abcd',
        },
        ...overrides,
    };
}

function buildPilotReadiness(overrides = {}) {
    return {
        clinicId: 'clinica-demo',
        profileFingerprint: '1234abcd',
        readinessState: 'ready',
        readinessSummary: 'Readiness local lista.',
        readinessSupport: 'Listo para liberar.',
        readinessBlockingCount: 0,
        readinessCriticalCount: 0,
        canonicalSupport: 'Canon listo.',
        goLiveIssueState: 'ready',
        goLiveSummary: 'Go-live sin bloqueos.',
        goLiveSupport: 'Sin pendientes.',
        readinessItems: [],
        goLiveIssues: [],
        ...overrides,
    };
}

function buildRemoteReadiness(overrides = {}) {
    const turneroPilot = {
        available: true,
        configured: true,
        ready: true,
        profileSource: 'file',
        clinicId: 'clinica-demo',
        profileFingerprint: '1234abcd',
        catalogAvailable: true,
        catalogMatched: true,
        catalogReady: true,
        releaseMode: 'suite_v2',
        adminModeDefault: 'basic',
        separateDeploy: true,
        nativeAppsBlocking: true,
        ...overrides.turneroPilot,
    };
    const publicSync = {
        available: true,
        configured: true,
        healthy: true,
        operationallyHealthy: true,
        state: 'ok',
        deployedCommit: '75a8d7c5e18a9f4c2b3d4e5f60718293a4b5c6d7',
        headDrift: false,
        ...overrides.publicSync,
    };
    const diagnosticsPayload = {
        figoConfigured: true,
        figoRecursiveConfig: false,
        checks: {
            turneroPilot,
            publicSync,
        },
        ...overrides.diagnosticsPayload,
    };
    const items = overrides.items || [
        {
            id: 'diagnostics',
            label: 'Diagnósticos',
            detail: 'OK',
            state: 'ready',
        },
        { id: 'identity', label: 'Identidad', detail: 'OK', state: 'ready' },
        {
            id: 'public_sync',
            label: 'Public sync',
            detail: 'OK',
            state: 'ready',
        },
        { id: 'figo', label: 'Figo', detail: 'OK', state: 'ready' },
    ];

    return {
        state: 'ready',
        tone: 'ready',
        ready: true,
        summary: 'Remoto listo.',
        supportCopy: 'Turnero remoto listo.',
        blockerCount: 0,
        warningCount: 0,
        clinicId: 'clinica-demo',
        profileFingerprint: '1234abcd',
        items,
        health: {
            payload: {
                checks: {
                    publicSync,
                },
            },
        },
        diagnostics: {
            kind: 'ok',
            payload: diagnosticsPayload,
        },
        availability: {},
        bookedSlots: {},
        checks: {
            turneroPilot,
            publicSync,
        },
        diagnosticsPayload,
        ...overrides,
    };
}

function buildShellDrift(overrides = {}) {
    return {
        pageOk: true,
        pageStatus: 200,
        stylesheetHref: '/styles.css',
        shellScriptSrc: '/script.js',
        inlineExecutableScripts: 0,
        ga4Found: ['googletagmanager.com', 'gtag(', 'dataLayer'],
        ga4Required: ['googletagmanager.com', 'gtag(', 'dataLayer'],
        signalSummary:
            'GET / OK · stylesheet /styles.css · shell script /script.js · inline 0 · GA4 googletagmanager.com, gtag(, dataLayer',
        supportCopy: 'Shell público alineado.',
        driftStatus: 'ready',
        driftLabel: 'Listo',
        blockers: [],
        ...overrides,
    };
}

function buildSnapshot({
    turneroClinicProfile,
    pilotReadiness,
    remoteReleaseReadiness,
    publicShellDrift,
}) {
    const generatedAt = '2026-03-18T12:00:00.000Z';
    return {
        generatedAt,
        turneroClinicProfile,
        pilotReadiness,
        remoteReleaseReadiness,
        publicShellDrift,
        localReadinessModel: {
            readySurfaceCount: 4,
            totalSurfaceCount: 4,
            openingPackageState: pilotReadiness.readinessState,
            openingPackageStatus: pilotReadiness.readinessState,
            state: pilotReadiness.readinessState,
            clinicName: 'Clínica Demo',
            brandName: 'Clínica Demo',
            clinicId: 'clinica-demo',
            profileFingerprint: '1234abcd',
            releaseMode: 'suite_v2',
            runtimeSource: 'remote',
            blockers: [],
        },
        remoteReleaseModel: {
            releaseStatus: remoteReleaseReadiness.tone,
            status: remoteReleaseReadiness.tone,
            finalState: remoteReleaseReadiness.tone,
            expectedClinicId: remoteReleaseReadiness.clinicId,
            expectedProfileFingerprint:
                remoteReleaseReadiness.profileFingerprint,
            deployedCommit: String(
                remoteReleaseReadiness.checks?.publicSync?.deployedCommit || ''
            ).trim(),
            publicSyncLabel: 'Public sync',
            diagnosticsLabel: 'Diagnósticos',
            figoLabel: 'Figo',
            sourceHealthLabel: 'Health público listo',
            blockers: [],
        },
        publicShellDriftModel: publicShellDrift,
        releaseEvidenceBundle: {
            generatedAt,
            turneroClinicProfile,
            pilotReadiness,
            remoteReleaseReadiness,
            publicShellDrift,
            localReadinessModel: {
                readySurfaceCount: 4,
                totalSurfaceCount: 4,
                openingPackageState: pilotReadiness.readinessState,
                openingPackageStatus: pilotReadiness.readinessState,
                state: pilotReadiness.readinessState,
                clinicName: 'Clínica Demo',
                brandName: 'Clínica Demo',
                clinicId: 'clinica-demo',
                profileFingerprint: '1234abcd',
                releaseMode: 'suite_v2',
                runtimeSource: 'remote',
                blockers: [],
            },
            remoteReleaseModel: {
                releaseStatus: remoteReleaseReadiness.tone,
                status: remoteReleaseReadiness.tone,
                finalState: remoteReleaseReadiness.tone,
                expectedClinicId: remoteReleaseReadiness.clinicId,
                expectedProfileFingerprint:
                    remoteReleaseReadiness.profileFingerprint,
                deployedCommit: String(
                    remoteReleaseReadiness.checks?.publicSync?.deployedCommit ||
                        ''
                ).trim(),
                publicSyncLabel: 'Public sync',
                diagnosticsLabel: 'Diagnósticos',
                figoLabel: 'Figo',
                sourceHealthLabel: 'Health público listo',
                blockers: [],
            },
            publicShellDriftModel: publicShellDrift,
        },
    };
}

test('turnero release control center queda en hold si falta el perfil o la evidencia no cierra', async () => {
    const module = await loadControlCenterModule();
    const model = module.buildTurneroReleaseControlCenterModel({
        turneroClinicProfile: null,
        pilotReadiness: buildPilotReadiness({
            readinessState: 'alert',
            readinessSummary: 'Readiness local bloqueada.',
            goLiveIssueState: 'alert',
            goLiveSummary: 'Go-live bloqueado.',
            readinessItems: [
                {
                    id: 'profile',
                    label: 'Perfil por clínica',
                    detail: 'Falta perfil clínico.',
                    ready: false,
                    blocker: true,
                },
            ],
        }),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });

    assert.equal(model.decision, 'hold');
    assert.equal(model.tone, 'alert');
    assert.ok(model.alertCount > 0);
    assert.ok(
        model.incidents.some(
            (incident) => incident.code === 'clinic_profile_missing'
        )
    );
    assert.match(model.runbookMarkdown, /# Turnero Release Control Center/);
});

test('turnero release control center queda en review si solo falta verificar public sync', async () => {
    const module = await loadControlCenterModule();
    const model = module.buildTurneroReleaseControlCenterModel({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness({
            tone: 'warning',
            state: 'warning',
            ready: false,
            summary: 'Public sync todavía no está verificado.',
            supportCopy: 'Esperando verificación.',
            warningCount: 1,
            publicSync: {
                available: true,
                configured: true,
                healthy: true,
                operationallyHealthy: true,
                state: 'ok',
                deployedCommit: '',
                headDrift: false,
            },
        }),
        publicShellDrift: buildShellDrift(),
    });

    assert.equal(model.decision, 'review');
    assert.equal(model.tone, 'warning');
    assert.equal(model.alertCount, 0);
    assert.ok(model.warningCount > 0);
    assert.ok(
        model.incidents.some(
            (incident) => incident.code === 'remote_public_sync_unverified'
        )
    );
    assert.match(model.summary, /Review:/);
});

test('turnero release control center queda ready cuando la evidencia local, remota y pública coincide', async () => {
    const module = await loadControlCenterModule();
    const snapshot = buildSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const model = module.buildTurneroReleaseControlCenterModel(snapshot);
    const markup = module.renderTurneroReleaseControlCenterCard(model);

    assert.equal(model.decision, 'ready');
    assert.equal(model.tone, 'ready');
    assert.equal(model.incidents.length, 0);
    assert.match(model.summary, /Ready:/);
    assert.match(markup, /queueReleaseControlCenter/);
    assert.match(markup, /Copiar resumen/);
    assert.equal(
        model.snapshot.releaseEvidenceBundle.turneroClinicProfile.clinic_id,
        'clinica-demo'
    );
});
