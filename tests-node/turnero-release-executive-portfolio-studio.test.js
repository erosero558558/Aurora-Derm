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

async function loadStudioModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-executive-portfolio-studio.js'
    );
}

async function loadControlCenterModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-control-center.js'
    );
}

async function loadRolloutModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-rollout-command-center.js'
    );
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
        return selector === '#queueExecutivePortfolioStudio' ? this : null;
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

function createButtonTarget(action) {
    return {
        dataset: {},
        getAttribute(name) {
            return name === 'data-action' ? action : null;
        },
        closest(selector) {
            return selector === '[data-action]' ? this : null;
        },
    };
}

test('turnero executive portfolio studio calcula el pack consolidado con señales reales', async () => {
    const studioModule = await loadStudioModule();
    const controlCenterModule = await loadControlCenterModule();
    const rolloutModule = await loadRolloutModule();
    const storage = createLocalStorageStub();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const controlCenterModel =
        controlCenterModule.buildTurneroReleaseControlCenterModel(snapshot);
    const governancePack = rolloutModule.buildReleaseRolloutCommandCenter({
        clinicId: 'clinica-demo',
        clinicLabel: 'Clínica Demo',
        snapshot,
        storage,
    });
    const regionalClinics = [
        {
            clinicId: 'clinica-norte',
            clinicName: 'Clínica Norte',
            region: 'norte',
            expectedBenefit: 100,
            realizedBenefit: 92,
            adoptionRate: 84,
            capex: 1400,
            monthlyOpex: 310,
            procurementReadiness: 88,
            valueScore: 81,
            status: 'active',
        },
        {
            clinicId: 'clinica-sur',
            clinicName: 'Clínica Sur',
            region: 'sur',
            expectedBenefit: 80,
            realizedBenefit: 56,
            adoptionRate: 64,
            capex: 1000,
            monthlyOpex: 250,
            procurementReadiness: 72,
            valueScore: 70,
            status: 'active',
        },
    ];

    const model = studioModule.buildTurneroReleaseExecutivePortfolioStudioModel(
        {
            controlCenterModel,
            governancePack,
            regionalClinics,
            region: 'andina',
            runwayBudget: 12000,
            complianceStatus: 'amber',
        }
    );

    assert.equal(model.regionalClinics.length, 2);
    assert.ok(model.benefits.realizationPct > 0);
    assert.ok(model.finance.runwayMonths > 0);
    assert.ok(model.procurement.avgReadiness > 0);
    assert.equal(model.funding.rows.length, 3);
    assert.ok(Array.isArray(model.scenarios.scenarios));
    assert.match(model.executiveBrief, /Funding gates/);
    assert.match(model.executiveBrief, /Scenario lab/);
    assert.match(model.snapshotFileName, /\.json$/);
    assert.ok(model.pack.executiveBrief);
    assert.equal(model.pack.portfolioDecision, model.portfolioDecision);
});

test('turnero executive portfolio studio monta acciones, copia brief y exporta JSON de forma idempotente', async () => {
    const studioModule = await loadStudioModule();
    const controlCenterModule = await loadControlCenterModule();
    const rolloutModule = await loadRolloutModule();
    const copiedTexts = [];
    const downloadEvents = [];
    const body = new HTMLElementStub('body');
    body.appendChild = (node) => {
        body.lastAppended = node;
    };
    const previousBody = body;
    const host = new HTMLElementStub(
        'queueOpsPilotExecutivePortfolioStudioHost'
    );
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const controlCenterModel =
        controlCenterModule.buildTurneroReleaseControlCenterModel(snapshot);
    const governancePack = rolloutModule.buildReleaseRolloutCommandCenter({
        clinicId: 'clinica-demo',
        clinicLabel: 'Clínica Demo',
        snapshot,
        storage: createLocalStorageStub(),
    });

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
                    return 'blob:turnero-executive-portfolio';
                },
                revokeObjectURL(href) {
                    downloadEvents.push({ kind: 'revoke', href });
                },
            },
            setTimeout: (fn) => {
                downloadEvents.push({ kind: 'timeout' });
                fn();
                return 0;
            },
            document: {
                body: previousBody,
                createElement(tag) {
                    if (tag === 'a') {
                        return {
                            href: '',
                            download: '',
                            rel: '',
                            style: {},
                            click() {
                                downloadEvents.push({
                                    kind: 'click',
                                    download: this.download,
                                    href: this.href,
                                });
                            },
                            remove() {
                                downloadEvents.push({
                                    kind: 'remove',
                                    download: this.download,
                                    href: this.href,
                                });
                            },
                        };
                    }

                    return {};
                },
                querySelector() {
                    return null;
                },
                getElementById() {
                    return null;
                },
            },
        },
        async () => {
            const mounted =
                studioModule.mountTurneroReleaseExecutivePortfolioStudio(host, {
                    controlCenterModel,
                    governancePack,
                    regionalClinics: [
                        {
                            clinicId: 'clinica-norte',
                            clinicName: 'Clínica Norte',
                            region: 'norte',
                            expectedBenefit: 100,
                            realizedBenefit: 92,
                            adoptionRate: 84,
                            capex: 1400,
                            monthlyOpex: 310,
                            procurementReadiness: 88,
                            valueScore: 81,
                            status: 'active',
                        },
                        {
                            clinicId: 'clinica-sur',
                            clinicName: 'Clínica Sur',
                            region: 'sur',
                            expectedBenefit: 80,
                            realizedBenefit: 56,
                            adoptionRate: 64,
                            capex: 1000,
                            monthlyOpex: 250,
                            procurementReadiness: 72,
                            valueScore: 70,
                            status: 'active',
                        },
                    ],
                    region: 'andina',
                    runwayBudget: 12000,
                    complianceStatus: 'amber',
                });

            assert.equal(mounted, host);
            assert.ok(
                host.dataset.turneroReleaseExecutivePortfolioStudioRequestId
            );
            assert.equal(
                host.__turneroReleaseExecutivePortfolioStudioModel
                    .regionalClinics.length,
                2
            );
            assert.match(host.innerHTML, /queueExecutivePortfolioStudio/);
            assert.match(host.innerHTML, /Copy executive brief/);
            assert.match(host.innerHTML, /Download executive JSON/);
            assert.match(host.innerHTML, /Benefits realization/);
            assert.match(host.innerHTML, /Capex \/ Opex planner/);
            assert.match(host.innerHTML, /Funding gates/);
            assert.match(host.innerHTML, /Procurement readiness/);
            assert.match(host.innerHTML, /Scenario lab/);
            assert.match(host.innerHTML, /KPI pack/);
            assert.match(host.innerHTML, /Quarterly roadmap/);
            assert.match(host.innerHTML, /Value realization/);
            assert.match(host.innerHTML, /Consolidated pack JSON/);

            assert.ok(
                host.innerHTML.includes('id="queueExecutivePortfolioStudio"')
            );

            const copyHandler = host.listeners.get('click');
            assert.equal(typeof copyHandler, 'function');
            await copyHandler({
                target: createButtonTarget('copy-executive-brief'),
            });
            assert.ok(
                copiedTexts.some((text) =>
                    text.includes('Executive Portfolio Studio')
                )
            );

            await copyHandler({
                target: createButtonTarget('download-executive-json'),
            });
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'url'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'click'));
            assert.match(
                host.__turneroReleaseExecutivePortfolioStudioModel
                    .snapshotFileName,
                /\.json$/
            );

            const secondMounted =
                studioModule.mountTurneroReleaseExecutivePortfolioStudio(host, {
                    controlCenterModel,
                    governancePack,
                    regionalClinics: [
                        {
                            clinicId: 'clinica-norte',
                            clinicName: 'Clínica Norte',
                            region: 'norte',
                            expectedBenefit: 100,
                            realizedBenefit: 92,
                            adoptionRate: 84,
                            capex: 1400,
                            monthlyOpex: 310,
                            procurementReadiness: 88,
                            valueScore: 81,
                            status: 'active',
                        },
                    ],
                    region: 'andina',
                    runwayBudget: 12000,
                    complianceStatus: 'amber',
                });

            assert.equal(secondMounted, host);
            assert.equal(
                (
                    host.innerHTML.match(
                        /id="queueExecutivePortfolioStudio"/g
                    ) || []
                ).length,
                1
            );
            assert.ok(host.listeners.has('click'));
        }
    );
});
