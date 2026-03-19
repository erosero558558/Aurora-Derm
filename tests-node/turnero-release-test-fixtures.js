'use strict';

const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function loadModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
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

function buildEvidenceSnapshot({
    turneroClinicProfile,
    pilotReadiness,
    remoteReleaseReadiness,
    publicShellDrift,
    generatedAt = '2026-03-18T12:00:00.000Z',
}) {
    const clinicId = String(
        turneroClinicProfile?.clinic_id ||
            pilotReadiness?.clinicId ||
            remoteReleaseReadiness?.clinicId ||
            'clinica-demo'
    ).trim();
    const clinicName = String(
        turneroClinicProfile?.branding?.name || 'Clínica Demo'
    ).trim();
    const clinicShortName = String(
        turneroClinicProfile?.branding?.short_name || 'Demo'
    ).trim();
    const profileFingerprint = String(
        turneroClinicProfile?.runtime_meta?.profileFingerprint ||
            pilotReadiness?.profileFingerprint ||
            remoteReleaseReadiness?.profileFingerprint ||
            '1234abcd'
    ).trim();
    const releaseMode = String(
        turneroClinicProfile?.release?.mode ||
            pilotReadiness?.releaseMode ||
            'suite_v2'
    ).trim();
    const localReadinessModel = {
        readySurfaceCount: 4,
        totalSurfaceCount: 4,
        openingPackageState: pilotReadiness?.readinessState,
        openingPackageStatus: pilotReadiness?.readinessState,
        state: pilotReadiness?.readinessState,
        clinicName,
        brandName: clinicName,
        clinicId,
        profileFingerprint,
        releaseMode,
        runtimeSource: turneroClinicProfile?.runtime_meta?.source || 'remote',
        blockers: [],
    };
    const remoteReleaseModel = {
        releaseStatus: remoteReleaseReadiness?.tone,
        status: remoteReleaseReadiness?.tone,
        finalState: remoteReleaseReadiness?.tone,
        expectedClinicId: remoteReleaseReadiness?.clinicId || clinicId,
        expectedProfileFingerprint:
            remoteReleaseReadiness?.profileFingerprint || profileFingerprint,
        deployedCommit: String(
            remoteReleaseReadiness?.checks?.publicSync?.deployedCommit || ''
        ).trim(),
        publicSyncLabel: 'Public sync',
        diagnosticsLabel: 'Diagnósticos',
        figoLabel: 'Figo',
        sourceHealthLabel: 'Health público listo',
        blockers: [],
    };

    return {
        generatedAt,
        turneroClinicProfile,
        clinicProfile: turneroClinicProfile,
        clinicId,
        clinicName,
        clinicShortName,
        profileFingerprint,
        releaseMode,
        pilotReadiness,
        remoteReleaseReadiness,
        publicShellDrift,
        localReadinessModel,
        remoteReleaseModel,
        publicShellDriftModel: publicShellDrift,
        releaseEvidenceBundle: {
            generatedAt,
            turneroClinicProfile,
            clinicProfile: turneroClinicProfile,
            clinicId,
            clinicName,
            clinicShortName,
            profileFingerprint,
            releaseMode,
            pilotReadiness,
            remoteReleaseReadiness,
            publicShellDrift,
            localReadinessModel,
            remoteReleaseModel,
            publicShellDriftModel: publicShellDrift,
        },
    };
}

function createResponse(payload, status = 200) {
    const body =
        typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return body;
        },
    };
}

function createFetchMock(resolver, requests) {
    return async (url, init = {}) => {
        const parsedUrl = new URL(url, 'http://example.test');
        const resource = parsedUrl.searchParams.get('resource') || '';
        requests.push({
            resource,
            method: String(init.method || 'GET').toUpperCase(),
            url: parsedUrl.toString(),
        });
        return resolver(parsedUrl, resource, init);
    };
}

function createLocalStorageStub(seed = {}) {
    const store = new Map(Object.entries(seed));

    return {
        getItem(key) {
            const value = store.get(String(key));
            return value === undefined ? null : value;
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
        key(index) {
            return Array.from(store.keys())[index] || null;
        },
        get length() {
            return store.size;
        },
        dump() {
            return Object.fromEntries(store.entries());
        },
    };
}

module.exports = {
    loadModule,
    buildClinicProfile,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
    buildEvidenceSnapshot,
    createResponse,
    createFetchMock,
    createLocalStorageStub,
};
