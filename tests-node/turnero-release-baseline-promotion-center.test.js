'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
    buildEvidenceSnapshot,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadSuiteModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-baseline-promotion-center.js'
    );
}

async function loadRegistryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-baseline-registry.js'
    );
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.innerHTML = '';
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        const value = this.attributes.get(String(name));
        return value === undefined ? null : value;
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener() {}
}

function withGlobals(setup, callback) {
    const previous = {
        localStorage: global.localStorage,
        document: global.document,
        HTMLElement: global.HTMLElement,
        HTMLButtonElement: global.HTMLButtonElement,
    };

    Object.assign(global, setup);

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            if (previous.localStorage === undefined) {
                delete global.localStorage;
            } else {
                global.localStorage = previous.localStorage;
            }

            if (previous.document === undefined) {
                delete global.document;
            } else {
                global.document = previous.document;
            }

            if (previous.HTMLElement === undefined) {
                delete global.HTMLElement;
            } else {
                global.HTMLElement = previous.HTMLElement;
            }

            if (previous.HTMLButtonElement === undefined) {
                delete global.HTMLButtonElement;
            } else {
                global.HTMLButtonElement = previous.HTMLButtonElement;
            }
        });
}

function buildHealthySnapshot() {
    return buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
}

function buildDegradedSnapshot() {
    const snapshot = buildHealthySnapshot();

    snapshot.pilotReadiness = {
        ...snapshot.pilotReadiness,
        readinessState: 'warning',
        readinessSummary: 'Readiness con pendientes.',
        readinessSupport: 'Faltan validaciones.',
        readinessBlockingCount: 2,
    };
    snapshot.localReadinessModel = {
        ...snapshot.localReadinessModel,
        state: 'warning',
        openingPackageState: 'warning',
        openingPackageStatus: 'warning',
        blockers: ['readiness'],
    };
    snapshot.remoteReleaseReadiness = {
        ...snapshot.remoteReleaseReadiness,
        state: 'warning',
        tone: 'warning',
        ready: false,
        summary: 'Remoto degradado.',
        supportCopy: 'Turnero remoto con alertas.',
        blockerCount: 1,
        warningCount: 2,
        diagnosticsPayload: {
            ...snapshot.remoteReleaseReadiness.diagnosticsPayload,
            figoConfigured: false,
            figoRecursiveConfig: true,
            checks: {
                ...snapshot.remoteReleaseReadiness.diagnosticsPayload.checks,
                publicSync: {
                    ...snapshot.remoteReleaseReadiness.diagnosticsPayload.checks
                        .publicSync,
                    healthy: false,
                    state: 'warning',
                    headDrift: true,
                    failureReason: 'Drift público',
                },
            },
        },
        checks: {
            ...snapshot.remoteReleaseReadiness.checks,
            turneroPilot: {
                ...snapshot.remoteReleaseReadiness.checks.turneroPilot,
                ready: false,
                profileSource: 'file',
            },
            publicSync: {
                ...snapshot.remoteReleaseReadiness.checks.publicSync,
                healthy: false,
                state: 'warning',
                headDrift: true,
                failureReason: 'Drift público',
            },
        },
    };
    snapshot.remoteReleaseModel = {
        ...snapshot.remoteReleaseModel,
        status: 'warning',
        releaseStatus: 'warning',
        finalState: 'warning',
        blockers: ['remote'],
    };
    snapshot.publicShellDrift = {
        ...snapshot.publicShellDrift,
        pageOk: false,
        driftStatus: 'warning',
        driftLabel: 'Atención',
        blockers: ['public shell drift'],
        signalSummary: 'GET / no alineado · shell drift visible',
        supportCopy: 'Shell público con drift.',
    };
    snapshot.publicShellDriftModel = {
        ...snapshot.publicShellDriftModel,
        pageOk: false,
        driftStatus: 'warning',
        driftLabel: 'Atención',
        blockers: ['public shell drift'],
        signalSummary: 'GET / no alineado · shell drift visible',
        supportCopy: 'Shell público con drift.',
    };
    snapshot.releaseEvidenceBundle = {
        ...snapshot.releaseEvidenceBundle,
        localReadinessModel: snapshot.localReadinessModel,
        remoteReleaseModel: snapshot.remoteReleaseModel,
        publicShellDriftModel: snapshot.publicShellDriftModel,
    };

    return snapshot;
}

test('release baseline registry persists CRUD y estado activo en localStorage', async () => {
    const suiteModule = await loadSuiteModule();
    const registryModule = await loadRegistryModule();
    const storage = createLocalStorageStub();

    await withGlobals(
        {
            localStorage: storage,
            document: {},
            HTMLElement: HTMLElementStub,
        },
        async () => {
            const suite = suiteModule.buildReleaseIntelligenceSuite({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                parts: buildHealthySnapshot(),
                storage,
            });

            assert.equal(suite.baseline, null);
            assert.equal(suite.baselineRegistry.total, 0);
            assert.equal(suite.trend.sampleSize, 0);
            assert.equal(suite.trend.insufficientHistory, true);
            assert.equal(suite.portfolio.totals.total, 1);

            const actions = suiteModule.createReleaseIntelligenceActions({
                ...suite,
                storage,
            });

            const promoted = actions.promote(
                'Baseline inicial',
                'Promoción inicial'
            );
            assert.ok(promoted.baselineId);
            assert.equal(promoted.label, 'Baseline inicial');

            let registry = registryModule.buildReleaseBaselineRegistryPack(
                'clinica-demo',
                { storage }
            );
            assert.equal(registry.total, 1);
            assert.equal(registry.activeBaselineId, promoted.baselineId);
            assert.equal(registry.active.label, 'Baseline inicial');
            assert.equal(registry.history.length, 1);

            const renamed = actions.rename(
                promoted.baselineId,
                'Baseline renombrada'
            );
            assert.equal(renamed.label, 'Baseline renombrada');

            const archived = actions.archive(promoted.baselineId);
            assert.equal(archived.isArchived, true);

            registry = registryModule.buildReleaseBaselineRegistryPack(
                'clinica-demo',
                { storage }
            );
            assert.equal(registry.activeBaselineId, null);
            assert.equal(registry.archivedTotal, 1);

            const restored = actions.restore(promoted.baselineId);
            assert.equal(restored.isArchived, false);

            const active = actions.setActive(promoted.baselineId);
            assert.equal(active.baselineId, promoted.baselineId);
            assert.equal(actions.clearActive(), true);

            registry = registryModule.buildReleaseBaselineRegistryPack(
                'clinica-demo',
                { storage }
            );
            assert.equal(registry.activeBaselineId, null);
            assert.equal(registry.items[0].label, 'Baseline renombrada');
        }
    );
});

test('release intelligence suite degrada limpio sin baseline y exporta pack completo', async () => {
    const suiteModule = await loadSuiteModule();
    const storage = createLocalStorageStub();

    await withGlobals(
        {
            localStorage: storage,
            document: {},
            HTMLElement: HTMLElementStub,
        },
        async () => {
            const suite = suiteModule.buildReleaseIntelligenceSuite({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                parts: buildHealthySnapshot(),
                storage,
            });

            assert.equal(suite.baseline, null);
            assert.equal(suite.baselineRegistry.total, 0);
            assert.equal(suite.scorecard.grade, 'A');
            assert.equal(suite.scorecard.decisionHint, 'ready');
            assert.match(suite.scorecard.summary, /Score \d+\/100/);
            assert.match(suite.executiveSummary, /Sin baseline activo/);
            assert.match(suite.trend.summary, /Historial insuficiente/);
            assert.equal(suite.radar.total, 0);
            assert.equal(suite.portfolio.totals.total, 1);
            assert.equal(suite.pack.baseline, null);
            assert.ok(
                Object.prototype.hasOwnProperty.call(suite.pack, 'scorecard')
            );
            assert.ok(
                Object.prototype.hasOwnProperty.call(suite.pack, 'trend')
            );
            assert.ok(
                Object.prototype.hasOwnProperty.call(suite.pack, 'radar')
            );
            assert.ok(
                Object.prototype.hasOwnProperty.call(suite.pack, 'portfolio')
            );
        }
    );
});

test('release intelligence suite marca regresion contra un baseline promovido', async () => {
    const suiteModule = await loadSuiteModule();
    const storage = createLocalStorageStub();

    await withGlobals(
        {
            localStorage: storage,
            document: {},
            HTMLElement: HTMLElementStub,
        },
        async () => {
            const healthy = suiteModule.buildReleaseIntelligenceSuite({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                parts: buildHealthySnapshot(),
                storage,
            });
            suiteModule
                .createReleaseIntelligenceActions({
                    ...healthy,
                    storage,
                })
                .promote('Baseline sana', 'Snapshot saludable');

            const degradedSnapshot = buildDegradedSnapshot();
            const degraded = suiteModule.buildReleaseIntelligenceSuite({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                parts: degradedSnapshot,
                storage,
            });

            assert.equal(degraded.baselineRegistry.total, 1);
            assert.equal(
                degraded.baselineRegistry.activeBaselineId,
                degraded.baseline.baselineId
            );
            assert.equal(degraded.trend.direction, 'regressing');
            assert.equal(degraded.trend.sampleSize, 1);
            assert.ok(degraded.trend.delta < 0);
            assert.ok(degraded.scorecard.score < 80);
            assert.notEqual(degraded.scorecard.decisionHint, 'ready');
            assert.ok(degraded.radar.total > 0);
            assert.ok(
                degraded.radar.regressions.some((entry) =>
                    [
                        'remote-health',
                        'public-sync',
                        'public-shell-drift',
                        'surface-readiness',
                    ].includes(entry.kind)
                )
            );
        }
    );
});

test('release intelligence suite renderiza y monta el host del queue deployment', async () => {
    const suiteModule = await loadSuiteModule();
    const storage = createLocalStorageStub();
    const host = new HTMLElementStub('queueReleaseIntelligenceSuiteHost');
    const snapshot = buildHealthySnapshot();

    await withGlobals(
        {
            localStorage: storage,
            document: {
                getElementById(id) {
                    return id === 'queueReleaseIntelligenceSuiteHost'
                        ? host
                        : null;
                },
                querySelector() {
                    return null;
                },
            },
            HTMLElement: HTMLElementStub,
        },
        async () => {
            const html = suiteModule.renderReleaseIntelligenceSuiteCard({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                parts: snapshot,
                storage,
            });

            assert.match(html, /queueReleaseIntelligenceSuite/);
            assert.match(html, /queueReleaseIntelligenceSuiteSummary/);
            assert.match(html, /queueReleaseIntelligenceSuiteEvidence/);
            assert.match(html, /data-suite-action="promote"/);
            assert.match(html, /data-suite-action="download-json-export"/);

            const mounted = suiteModule.mountReleaseIntelligenceSuiteCard(
                host,
                {
                    clinicId: 'clinica-demo',
                    clinicLabel: 'Clínica Demo',
                    parts: snapshot,
                    storage,
                }
            );

            assert.equal(mounted, host);
            assert.match(host.innerHTML, /queueReleaseIntelligenceSuite/);
            assert.match(host.innerHTML, /Copy executive summary/);
            assert.match(host.innerHTML, /Sin baseline activo/);
            assert.equal(
                host.dataset.turneroReleaseIntelligenceSuiteClinicId,
                'clinica-demo'
            );
            assert.match(
                host.dataset.turneroReleaseIntelligenceSuiteRequestId,
                /T/
            );
        }
    );
});
