#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');
const CHECKER_PATH = resolve(
    REPO_ROOT,
    'bin',
    'check-turnero-runtime-artifacts.js'
);

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function ensureParentDir(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function writeSandboxFile(filePath, content) {
    ensureParentDir(filePath);
    writeFileSync(filePath, content, 'utf8');
}

function createSandbox(prefix = 'turnero-runtime-artifacts-') {
    const base = mkdtempSync(resolve(tmpdir(), prefix));
    return {
        base,
        sourceRoot: resolve(base, 'source-root'),
        buildRoot: resolve(base, '.generated', 'site-root'),
        publishedRoot: resolve(base, 'published-root'),
        reportPath: resolve(base, 'report.json'),
    };
}

function removeSandbox(base) {
    rmSync(base, { recursive: true, force: true });
}

function runChecker(
    scriptPath,
    root,
    sourceRoot,
    publishedRoot,
    outputPath,
    selfSourcePath = ''
) {
    const args = [
        scriptPath,
        '--root',
        root,
        '--source-root',
        sourceRoot,
        '--published-root',
        publishedRoot,
        '--output',
        outputPath,
    ];

    if (selfSourcePath) {
        args.push('--script-path', selfSourcePath);
    }

    return spawnSync('node', args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
}

function seedRuntimeSourceTree(sourceRoot) {
    const files = new Map([
        [
            'src/apps/queue-shared/turnero-runtime-contract.mjs',
            [
                'export function buildTurneroSurfaceRuntimeStatus() {}',
                'export function getTurneroActiveClinicId() {}',
                'export function getTurneroActiveClinicProfile() {}',
                'export function getTurneroActiveClinicProfileMeta() {}',
                'export function hasRecentQueueSmokeSignalForState() {}',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-operator/index.js',
            [
                "import { buildTurneroSurfaceRuntimeStatus } from '../queue-shared/turnero-runtime-contract.mjs';",
                'export const operatorRuntime = buildTurneroSurfaceRuntimeStatus;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-kiosk/index.js',
            [
                "import { buildTurneroSurfaceRuntimeStatus } from '../queue-shared/turnero-runtime-contract.mjs';",
                'export const kioskRuntime = buildTurneroSurfaceRuntimeStatus;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-display/index.js',
            [
                "import { buildTurneroSurfaceRuntimeStatus } from '../queue-shared/turnero-runtime-contract.mjs';",
                'export const displayRuntime = buildTurneroSurfaceRuntimeStatus;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/admin-v3/shared/modules/queue/pilot-guard.js',
            [
                "import { getTurneroSurfaceContract } from '../../../../queue-shared/turnero-runtime-contract.mjs';",
                'export const pilotGuard = getTurneroSurfaceContract;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/admin-v3/shared/modules/queue/persistence.js',
            [
                "import { getTurneroActiveClinicId } from '../../../../queue-shared/turnero-runtime-contract.mjs';",
                'export const queueClinicId = getTurneroActiveClinicId;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js',
            [
                "import { getTurneroClinicBrandName } from '../../../../../../queue-shared/turnero-runtime-contract.mjs';",
                'export const installHubClinicBrandName = getTurneroClinicBrandName;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/smoke-signal.js',
            [
                "import { hasRecentQueueSmokeSignalForState as hasRecentQueueSmokeSignalForStateShared } from '../../../../../../../queue-shared/turnero-runtime-contract.mjs';",
                'export const hasRecentQueueSmokeSignalForState = hasRecentQueueSmokeSignalForStateShared;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-shared/admin-queue-pilot-readiness.js',
            [
                "import { getTurneroClinicReadiness } from './turnero-runtime-contract.mjs';",
                'export const adminReadiness = getTurneroClinicReadiness;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-shared/turnero-surface-contract-snapshot.js',
            [
                "import { getTurneroSurfaceContract } from './turnero-runtime-contract.mjs';",
                'export const contractSnapshot = getTurneroSurfaceContract;',
                '',
            ].join('\n'),
        ],
        [
            'src/apps/queue-shared/turnero-surface-runtime-watch.js',
            [
                "import { getTurneroClinicProfileFingerprint } from './turnero-runtime-contract.mjs';",
                'export const runtimeWatch = getTurneroClinicProfileFingerprint;',
                '',
            ].join('\n'),
        ],
    ]);

    for (const [relativePath, content] of files.entries()) {
        writeSandboxFile(resolve(sourceRoot, relativePath), content);
    }
}

function seedRuntimeBundles(buildRoot, { omitDisplayRoute = false } = {}) {
    const bundles = [
        [
            'js/queue-operator.js',
            [
                "const schema = 'turnero-clinic-profile/v1';",
                "const profile = '/content/turnero/clinic-profile.json';",
                "const route = '/operador-turnos.html';",
                '',
            ].join('\n'),
        ],
        [
            'js/queue-kiosk.js',
            [
                "const schema = 'turnero-clinic-profile/v1';",
                "const profile = '/content/turnero/clinic-profile.json';",
                "const route = '/kiosco-turnos.html';",
                '',
            ].join('\n'),
        ],
        [
            'js/queue-display.js',
            [
                "const schema = 'turnero-clinic-profile/v1';",
                "const profile = '/content/turnero/clinic-profile.json';",
                omitDisplayRoute
                    ? "const route = '/pantalla-desconocida.html';"
                    : "const route = '/sala-turnos.html';",
                '',
            ].join('\n'),
        ],
    ];

    for (const [relativePath, content] of bundles) {
        writeSandboxFile(resolve(buildRoot, relativePath), content);
    }
}

test('shared turnero runtime contract exposes the shared facade for surface status and smoke signals', async () => {
    const contract = await importRepoModule(
        'src/apps/queue-shared/turnero-runtime-contract.mjs'
    );

    const profile = {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: 'clinic-123',
        branding: {
            name: 'Clinica Aurora Derm',
            short_name: 'Aurora Derm',
            city: 'Quito',
            base_url: 'https://pielarmonia.com',
        },
        consultorios: {
            c1: { label: 'Consultorio 1', short_label: 'C1' },
            c2: { label: 'Consultorio 2', short_label: 'C2' },
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
    };

    const runtimeStatus = contract.buildTurneroSurfaceRuntimeStatus(
        profile,
        'operator',
        {
            currentRoute: '/operador-turnos.html',
        }
    );
    const routeMismatch = contract.buildTurneroSurfaceRuntimeStatus(
        profile,
        'kiosk',
        {
            currentRoute: '/kiosko-salud.html',
        }
    );
    const state = {
        data: {
            turneroClinicProfile: profile,
            turneroClinicProfileMeta: {
                source: 'remote',
                profileFingerprint: '1234abcd',
            },
            turneroClinicProfileCatalogStatus: {
                state: 'ready',
            },
            queueMeta: {
                calledCount: 0,
            },
            queueTickets: [
                {
                    status: 'waiting',
                },
            ],
        },
        queue: {
            activity: [
                {
                    message: 'Llamado C1 ejecutado',
                    clinicId: 'clinic-123',
                    at: new Date().toISOString(),
                },
            ],
        },
    };

    assert.equal(contract.getTurneroActiveClinicId(state), 'clinic-123');
    assert.equal(contract.getTurneroActiveClinicProfile(state).clinic_id, 'clinic-123');
    assert.equal(
        contract.getTurneroActiveClinicProfileMeta(state).source,
        'remote'
    );
    assert.equal(runtimeStatus.uiState, 'ready');
    assert.match(runtimeStatus.text, /Perfil remoto verificado/);
    assert.match(runtimeStatus.text, /canon \/operador-turnos\.html/);
    assert.equal(runtimeStatus.surfaceContract.reason, 'ready');
    assert.equal(routeMismatch.uiState, 'alert');
    assert.match(routeMismatch.text, /ruta fuera de canon/);
    assert.equal(routeMismatch.surfaceContract.reason, 'route_mismatch');
    assert.equal(contract.hasRecentQueueSmokeSignalForState(state, 'clinic-123'), true);
    assert.equal(
        contract.hasRecentQueueSmokeSignalForState(
            {
                data: {
                    queueMeta: {
                        calledCount: 1,
                    },
                },
            },
            'clinic-123'
        ),
        true
    );
});

test('shared turnero runtime contract normalizes operator shell state and query params', async () => {
    const contract = await importRepoModule(
        'src/apps/queue-shared/turnero-runtime-contract.mjs'
    );

    assert.equal(contract.normalizeLaunchMode('windowed'), 'windowed');
    assert.equal(contract.normalizeLaunchMode('anything'), 'fullscreen');
    assert.equal(contract.normalizeStationMode('locked'), 'locked');
    assert.equal(contract.normalizeStationMode('random'), 'free');
    assert.equal(contract.normalizeStationConsultorio(2), 2);
    assert.equal(contract.normalizeStationConsultorio(7), 1);
    assert.equal(contract.normalizeOneTap('yes', false), true);
    assert.equal(contract.normalizeAutoStart('off', true), false);
    assert.equal(contract.normalizeUpdateChannel('', 'beta'), 'stable');
    assert.equal(contract.normalizeUpdateChannel('', 'pilot'), 'pilot');
    assert.equal(contract.normalizeUpdateChannel('legacy', 'pilot'), 'pilot');
    assert.equal(contract.normalizeUpdateChannel('', ''), 'stable');

    const surfaceState = contract.buildOperatorSurfaceState({
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: 'yes',
    });

    assert.deepEqual(surfaceState, {
        stationConsultorio: 2,
        stationMode: 'locked',
        oneTap: true,
        locked: true,
        stationKey: 'c2',
        instance: 'c2',
    });

    const params = contract.applyOperatorSurfaceSearchParams(
        new URLSearchParams('surface=operator'),
        surfaceState
    );

    assert.equal(
        params.toString(),
        'surface=operator&station=c2&lock=1&one_tap=1'
    );
});

test('turnero runtime checker validates source wiring and bundle signatures', () => {
    const sandbox = createSandbox('turnero-runtime-checker-');

    try {
        seedRuntimeSourceTree(sandbox.sourceRoot);
        seedRuntimeBundles(sandbox.buildRoot);
        seedRuntimeBundles(sandbox.publishedRoot);

        const result = runChecker(
            CHECKER_PATH,
            sandbox.buildRoot,
            sandbox.sourceRoot,
            sandbox.publishedRoot,
            sandbox.reportPath
        );

        assert.equal(
            result.status,
            0,
            `checker sano fallo: ${result.stderr || result.stdout}`
        );
        const report = JSON.parse(readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.passed, true);
        assert.equal(report.selfCheck.proxyDetected, false);
        assert.deepEqual(report.diagnostics, []);
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('turnero runtime checker fails when a bundle loses its shared surface signature', () => {
    const sandbox = createSandbox('turnero-runtime-checker-bundle-drift-');

    try {
        seedRuntimeSourceTree(sandbox.sourceRoot);
        seedRuntimeBundles(sandbox.buildRoot, { omitDisplayRoute: true });
        seedRuntimeBundles(sandbox.publishedRoot, { omitDisplayRoute: true });

        const result = runChecker(
            CHECKER_PATH,
            sandbox.buildRoot,
            sandbox.sourceRoot,
            sandbox.publishedRoot,
            sandbox.reportPath
        );

        assert.notEqual(result.status, 0);
        const report = JSON.parse(readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.passed, false);
        assert.equal(
            report.diagnostics.some(
                (entry) =>
                    entry.code === 'turnero_runtime_bundle_signature_missing' &&
                    entry.file === 'js/queue-display.js'
            ),
            true
        );
        assert.equal(
            report.diagnostics.some(
                (entry) => entry.code === 'turnero_runtime_bundle_missing'
            ),
            false
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('turnero runtime checker fails if the checker source proxies the public runtime checker', () => {
    const sandbox = createSandbox('turnero-runtime-checker-proxy-');
    const proxyCheckerPath = resolve(sandbox.base, 'check-turnero-runtime-artifacts.proxy.js');

    try {
        seedRuntimeSourceTree(sandbox.sourceRoot);
        seedRuntimeBundles(sandbox.buildRoot);
        seedRuntimeBundles(sandbox.publishedRoot);
        writeFileSync(
            proxyCheckerPath,
            "// require('./check-public-runtime-artifacts.js')\n",
            'utf8'
        );

        const result = runChecker(
            CHECKER_PATH,
            sandbox.buildRoot,
            sandbox.sourceRoot,
            sandbox.publishedRoot,
            sandbox.reportPath,
            proxyCheckerPath
        );

        assert.notEqual(result.status, 0);
        const report = JSON.parse(readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.selfCheck.proxyDetected, true);
        assert.equal(
            report.diagnostics.some(
                (entry) =>
                    entry.code ===
                    'turnero_runtime_proxy_public_checker_detected'
            ),
            true
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('turnero runtime checker fails when published root drifts from generated operator bundle', () => {
    const sandbox = createSandbox('turnero-runtime-checker-published-drift-');

    try {
        seedRuntimeSourceTree(sandbox.sourceRoot);
        seedRuntimeBundles(sandbox.buildRoot);
        seedRuntimeBundles(sandbox.publishedRoot);
        writeSandboxFile(
            resolve(sandbox.publishedRoot, 'js/queue-operator.js'),
            [
                "const schema = 'turnero-clinic-profile/v1';",
                "const profile = '/content/turnero/clinic-profile.json';",
                "const route = '/operador-turnos.html';",
                "const stale = 'legacy-runtime';",
                '',
            ].join('\n')
        );

        const result = runChecker(
            CHECKER_PATH,
            sandbox.buildRoot,
            sandbox.sourceRoot,
            sandbox.publishedRoot,
            sandbox.reportPath
        );

        assert.notEqual(result.status, 0);
        const report = JSON.parse(readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.passed, false);
        assert.equal(
            report.diagnostics.some(
                (entry) =>
                    entry.code === 'turnero_published_bundle_drift' &&
                    entry.file === 'js/queue-operator.js'
            ),
            true
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('desktop turnero contracts reuse the shared operator query serialization', async () => {
    const contracts = await importRepoModule(
        'src/apps/turnero-desktop/src/config/contracts.mjs'
    );

    const config = contracts.createBuildConfig({
        surface: 'operator',
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: true,
    });

    assert.equal(
        contracts.createSurfaceUrl(config),
        'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    assert.equal(
        contracts.buildSupportGuideUrl(config, 'win32'),
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.equal(config.updateChannel, 'pilot');
});
