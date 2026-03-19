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

async function loadTowerModule() {
    return loadModule('src/apps/queue-shared/turnero-release-control-tower.js');
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.innerHTML = '';
        this.listeners = new Map();
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        return this.attributes.get(String(name));
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        return selector === '#queueReleaseMultiClinicControlTower'
            ? this
            : null;
    }
}

function withGlobals(setup, callback) {
    const previous = {
        document: global.document,
        HTMLElement: global.HTMLElement,
        HTMLButtonElement: global.HTMLButtonElement,
        navigator: global.navigator,
        Blob: global.Blob,
        URL: global.URL,
        setTimeout: global.setTimeout,
    };

    for (const [key, value] of Object.entries(setup)) {
        try {
            global[key] = value;
        } catch (_error) {
            Object.defineProperty(global, key, {
                configurable: true,
                writable: true,
                value,
            });
        }
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const [key, value] of Object.entries(previous)) {
                try {
                    if (value === undefined) {
                        delete global[key];
                    } else {
                        global[key] = value;
                    }
                } catch (_error) {
                    Object.defineProperty(global, key, {
                        configurable: true,
                        writable: true,
                        value,
                    });
                }
            }
        });
}

function buildClinicProfiles() {
    return [
        buildClinicProfile({
            clinic_id: 'clinica-norte',
            branding: {
                name: 'Clínica Norte',
                short_name: 'Norte',
                base_url: 'https://norte.example',
            },
            region: 'norte',
            ownerTeam: 'frontend',
            consultorios: [{ id: 'n1' }, { id: 'n2' }],
            surfaces: [{ id: 'admin' }, { id: 'operator' }],
            release: {
                mode: 'suite_v2',
                separate_deploy: true,
                native_apps_blocking: false,
                readinessScore: 86,
            },
            runtime_meta: {
                source: 'file',
                profileFingerprint: 'norte-1111',
            },
        }),
        buildClinicProfile({
            clinic_id: 'clinica-sur',
            branding: {
                name: 'Clínica Sur',
                short_name: 'Sur',
                base_url: 'https://sur.example',
            },
            region: 'sur',
            ownerTeam: 'ops',
            consultorios: [{ id: 's1' }],
            surfaces: [{ id: 'admin' }],
            blockingCount: 1,
            warningCount: 1,
            release: {
                mode: 'suite_v2',
                separate_deploy: true,
                native_apps_blocking: true,
                readinessScore: 58,
            },
            runtime_meta: {
                source: 'file',
                profileFingerprint: 'sur-2222',
            },
        }),
        buildClinicProfile({
            clinic_id: 'clinica-centro',
            branding: {
                name: 'Clínica Centro',
                short_name: 'Centro',
                base_url: 'https://centro.example',
            },
            region: 'centro',
            ownerTeam: 'backend',
            consultorios: [{ id: 'c1' }],
            surfaces: [{ id: 'admin' }, { id: 'display' }],
            release: {
                mode: 'suite_v2',
                separate_deploy: false,
                native_apps_blocking: false,
                readinessScore: 74,
            },
            runtime_meta: {
                source: 'file',
                profileFingerprint: 'centro-3333',
            },
        }),
    ];
}

test('multi-clinic control tower normaliza registro, cohortes, scoreboard, simulador y pack JSON', async () => {
    const towerModule = await loadTowerModule();
    const storageKey = 'turnero-release-regional-registry:turnero';
    const storage = createLocalStorageStub({
        [storageKey]: JSON.stringify({
            'clinica-sur': {
                clinicLabel: 'Clínica Sur Renovada',
                region: 'costa',
                ownerTeam: 'ops',
                priorityTier: 2,
                tags: ['override'],
            },
        }),
    });
    const clinicProfiles = buildClinicProfiles();
    const model = towerModule.buildMultiClinicRollout({
        scope: 'turnero',
        clinicProfiles,
        storage,
    });

    assert.equal(model.registry.clinics.length, 3);
    assert.equal(
        model.registry.getClinic('clinica-sur').clinicLabel,
        'Clínica Sur Renovada'
    );
    assert.equal(model.registry.getClinic('clinica-sur').region, 'costa');
    assert.match(model.registry.summary, /3 clínica/);
    assert.ok(model.cohortPlanner.plans.length === 3);
    assert.ok(
        model.cohortPlanner.cohorts.some((cohort) => cohort.cohort === 'pilot')
    );
    assert.ok(
        ['promote', 'review', 'hold'].includes(model.portfolioDecision.decision)
    );
    assert.ok(model.scoreboard.bestToWorst.length === 3);
    assert.ok(model.scoreboard.highestRisk);
    assert.ok(model.simulator.scenarios.length === 3);
    assert.ok(
        ['safe-expand', 'review-expand', 'hold-expand'].includes(
            model.simulator.recommendedScenario
        )
    );
    assert.ok(model.coverage.coverage.length === 3);
    assert.ok(model.topRegionalRisks.length >= 1);
    assert.ok(
        model.copyableExecutiveBrief.includes(
            'Turnero Multi-Clinic Control Tower'
        )
    );
    assert.ok(model.copyableCohortPlan.includes('Cohort planner'));
    assert.ok(model.copyableScoreboard.includes('Scoreboard regional'));
    assert.ok(model.copyableHotspots.includes('Heatmap multi-clinic'));
    assert.ok(model.copyableSimulator.includes('Simulador multi-clinic'));
    assert.ok(model.copyableCoverage.includes('Cobertura regional'));
    assert.equal(
        model.jsonPack.portfolioDecision.decision,
        model.portfolioDecision.decision
    );
    assert.doesNotThrow(() => JSON.stringify(model.jsonPack));

    model.registry.saveOverride('clinica-centro', {
        province: 'Pichincha',
        ownerTeam: 'frontend',
    });

    const updatedModel = towerModule.buildMultiClinicRollout({
        scope: 'turnero',
        clinicProfiles,
        storage,
    });

    assert.equal(
        updatedModel.registry.getClinic('clinica-centro').province,
        'Pichincha'
    );
    assert.equal(
        updatedModel.registry.getClinic('clinica-centro').ownerTeam,
        'frontend'
    );
});

test('multi-clinic control tower monta el card y expone las acciones de copia y descarga', async () => {
    const towerModule = await loadTowerModule();
    const clinicProfiles = buildClinicProfiles();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: clinicProfiles[0],
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const host = new HTMLElementStub('queueMultiClinicControlTowerHost');
    const copiedTexts = [];
    const downloadEvents = [];
    let downloadedFileName = '';

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            navigator: {
                clipboard: {
                    async writeText(text) {
                        copiedTexts.push(String(text));
                    },
                },
            },
            setTimeout: undefined,
            document: {
                body: {
                    appendChild(node) {
                        downloadEvents.push({ kind: 'append', node });
                    },
                },
                createElement(tag) {
                    if (tag === 'a') {
                        return {
                            style: {},
                            set href(value) {
                                this._href = value;
                            },
                            get href() {
                                return this._href;
                            },
                            set download(value) {
                                downloadedFileName = String(value);
                                this._download = value;
                            },
                            get download() {
                                return this._download;
                            },
                            rel: '',
                            click() {
                                downloadEvents.push({
                                    kind: 'click',
                                    href: this._href,
                                });
                            },
                            remove() {
                                downloadEvents.push({
                                    kind: 'remove',
                                    href: this._href,
                                });
                            },
                        };
                    }

                    return {};
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                    downloadEvents.push({ kind: 'blob', parts, options });
                }
            },
            URL: {
                createObjectURL(blob) {
                    downloadEvents.push({ kind: 'url', blob });
                    return 'blob:turnero-control-tower';
                },
                revokeObjectURL(href) {
                    downloadEvents.push({ kind: 'revoke', href });
                },
            },
        },
        async () => {
            const mounted = towerModule.mountMultiClinicControlTowerCard(host, {
                scope: 'turnero',
                clinicProfiles,
                clinicProfile: clinicProfiles[0],
                snapshot,
                storage: createLocalStorageStub(),
            });

            assert.equal(mounted, host);
            assert.ok(
                host.dataset.turneroReleaseMultiClinicControlTowerRequestId
            );
            assert.match(host.innerHTML, /queueReleaseMultiClinicControlTower/);
            assert.match(
                host.innerHTML,
                /queueReleaseMultiClinicControlTowerCopyBriefBtn/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseMultiClinicControlTowerCopyScoreboardBtn/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseMultiClinicControlTowerCopyCoverageBtn/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseMultiClinicControlTowerDownloadJsonBtn/
            );
            assert.match(host.innerHTML, /Multi-Clinic Control Tower/);
            assert.match(host.innerHTML, /Clínica Norte/);
            assert.match(host.innerHTML, /queueReleaseMultiClinicControlTower/);

            const actions = towerModule.createMultiClinicControlTowerActions(
                towerModule.buildMultiClinicRollout({
                    scope: 'turnero',
                    clinicProfiles,
                    storage: createLocalStorageStub(),
                })
            );

            assert.equal(typeof actions['copy-brief'], 'function');
            assert.equal(typeof actions['download-json'], 'function');

            await actions['copy-brief']();
            assert.ok(
                copiedTexts.some((text) =>
                    text.includes('Turnero Multi-Clinic Control Tower')
                )
            );

            await actions['download-json']();
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'url'));
            assert.match(
                downloadedFileName,
                /turnero-multi-clinic-control-tower/
            );
            assert.ok(
                downloadEvents.some((entry) => {
                    if (entry.kind !== 'blob') {
                        return false;
                    }

                    return String(entry.parts[0] || '').includes(
                        'portfolioDecision'
                    );
                })
            );
        }
    );
});
