'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadStudioModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-strategy-digital-twin-studio.js'
    );
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.innerHTML = '';
        this.listeners = new Map();
        this.children = [];
        this.__queries = new Map();
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

    appendChild(node) {
        this.children.push(node);
        this.lastChild = node;
        if (node && typeof node.innerHTML === 'string') {
            this.innerHTML = node.innerHTML;
        }
        return node;
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.__queries.has(key)) {
            if (key === '#queueStrategyDigitalTwinStudio') {
                this.__queries.set(key, this);
                return this;
            }

            this.__queries.set(key, {
                value: '',
                textContent: '',
                getAttribute(name) {
                    return name === 'data-action' ? null : null;
                },
                setAttribute() {},
                removeAttribute() {},
                closest() {
                    return null;
                },
            });
        }

        return this.__queries.get(key);
    }
}

function setGlobalValue(name, value) {
    Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
}

async function withGlobals(setup, callback) {
    const previous = {};

    for (const [key, value] of Object.entries(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        setGlobalValue(key, value);
    }

    try {
        return await callback();
    } finally {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (!descriptor) {
                delete global[key];
                continue;
            }

            Object.defineProperty(global, key, descriptor);
        }
    }
}

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
        closest(selector) {
            return selector === '[data-action]' ? this : null;
        },
    };
}

function buildStudioClinicProfile(region, shortName) {
    const profile = buildClinicProfile({
        clinic_id: `clinica-${region}`,
        region,
        branding: {
            name: `Clínica ${shortName}`,
            short_name: shortName,
            region,
            base_url: `https://${region}.example`,
        },
    });

    profile.regionalClinics = [
        {
            clinicId: `${region}-alpha`,
            clinicName: `Clínica ${shortName} Alpha`,
            region,
            baseDemand: 24,
            growthFactor: 1.08,
            seasonality: 1.03,
            adoptionRate: 81,
            qualityScore: 84,
            resilienceScore: 82,
        },
        {
            clinicId: `${region}-beta`,
            clinicName: `Clínica ${shortName} Beta`,
            region,
            baseDemand: 18,
            growthFactor: 1.04,
            seasonality: 0.98,
            adoptionRate: 68,
            qualityScore: 73,
            resilienceScore: 71,
        },
    ];

    return profile;
}

test('strategy digital twin studio calcula forecast, twin, decisiones y rollout score', async () => {
    const studioModule = await loadStudioModule();
    const clinicProfile = buildStudioClinicProfile('norte', 'Norte');

    const model = studioModule.buildStrategyDigitalTwinStudioPack({
        clinicProfile,
        scope: 'norte',
        region: 'norte',
    });

    assert.equal(model.scope, 'norte');
    assert.equal(model.region, 'norte');
    assert.equal(model.clinics.length, 2);
    assert.equal(model.quality.rows.length, 2);
    assert.equal(model.qualityRows.length, 2);
    assert.equal(model.reliabilityRows.length, 2);
    assert.ok(model.forecast.regional30d > 0);
    assert.equal(model.twins.rows.length, 2);
    assert.equal(model.decisions.rows.length, 3);
    assert.ok(model.resources.totals.totalUnits > 0);
    assert.ok(
        [
            'execute_controlled_plan',
            'stage_gate_review',
            'stabilize_before_scale',
        ].includes(model.recommendation.recommendation)
    );
    assert.ok(Number.isFinite(model.strategyScore.score));
    assert.match(model.strategyBrief, /Strategy Digital Twin Studio/);
    assert.match(model.strategyBrief, /Regional forecast 30d:/);
    assert.equal(model.snapshotFileName, 'turnero-release-strategy-pack.json');
    assert.equal(model.warGames.length, 0);
});

test('strategy digital twin studio monta acciones y mantiene war games aislados por scope', async () => {
    const studioModule = await loadStudioModule();
    const storage = createLocalStorageStub();
    const copiedTexts = [];
    const downloadEvents = [];
    const northProfile = buildStudioClinicProfile('norte', 'Norte');
    const southProfile = buildStudioClinicProfile('sur', 'Sur');
    const northHost = new HTMLElementStub('queueStrategyNorthHost');
    const southHost = new HTMLElementStub('queueStrategySouthHost');

    await withGlobals(
        {
            localStorage: storage,
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
                    return 'blob:turnero-release-strategy-pack';
                },
                revokeObjectURL(href) {
                    downloadEvents.push({ kind: 'revoke', href });
                },
            },
            setTimeout(fn) {
                downloadEvents.push({ kind: 'timeout' });
                fn();
                return 0;
            },
            document: {
                body: {
                    appendChild(node) {
                        downloadEvents.push({ kind: 'append', node });
                        return node;
                    },
                },
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

                    return new HTMLElementStub(tag);
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
            const mountedNorth =
                studioModule.mountTurneroReleaseStrategyDigitalTwinStudio(
                    northHost,
                    {
                        clinicProfile: northProfile,
                        scope: 'norte',
                        region: 'norte',
                    }
                );

            const northRoot = mountedNorth.root || mountedNorth;
            assert.equal(northRoot, northHost);
            assert.equal(
                northHost.dataset.turneroReleaseStrategyDigitalTwinStudioScope,
                'norte'
            );
            assert.match(northHost.innerHTML, /Strategy Digital Twin Studio/);
            assert.match(
                northHost.innerHTML,
                /data-action="copy-strategy-brief"/
            );
            assert.match(
                northHost.innerHTML,
                /data-action="download-strategy-pack"/
            );
            assert.match(northHost.innerHTML, /data-action="add-war-game"/);
            assert.match(northHost.innerHTML, /data-role="score"/);
            assert.match(northHost.innerHTML, /data-role="strategy-brief"/);
            assert.match(
                northHost.innerHTML,
                /queueStrategyDigitalTwinStudioPackJson/
            );

            const clickHandler = northHost.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: createActionTarget('copy-strategy-brief'),
            });
            assert.ok(
                copiedTexts.some((text) =>
                    text.includes('Strategy Digital Twin Studio')
                )
            );

            await clickHandler({
                target: createActionTarget('download-strategy-pack'),
            });
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'click'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'revoke'));
            assert.equal(
                downloadEvents.find((entry) => entry.kind === 'click').download,
                'turnero-release-strategy-pack.json'
            );

            northHost.querySelector('[data-field="wg-title"]').value =
                'Escenario norte';
            northHost.querySelector('[data-field="wg-owner"]').value =
                'program';
            northHost.querySelector('[data-field="wg-mode"]').value = 'stress';
            await clickHandler({
                target: createActionTarget('add-war-game'),
            });

            assert.equal(
                northHost.__turneroReleaseStrategyDigitalTwinStudioPack.warGames
                    .length,
                1
            );
            assert.match(northHost.innerHTML, /Escenario norte/);
            assert.equal(
                (
                    northHost.innerHTML.match(
                        /id="queueStrategyDigitalTwinStudio"/g
                    ) || []
                ).length,
                1
            );

            const remountedNorth =
                studioModule.mountTurneroReleaseStrategyDigitalTwinStudio(
                    northHost,
                    {
                        clinicProfile: northProfile,
                        scope: 'norte',
                        region: 'norte',
                    }
                );
            assert.equal(
                (
                    remountedNorth.pack ||
                    remountedNorth.__turneroReleaseStrategyDigitalTwinStudioPack
                ).warGames.length,
                1
            );

            const mountedSouth =
                studioModule.mountTurneroReleaseStrategyDigitalTwinStudio(
                    southHost,
                    {
                        clinicProfile: southProfile,
                        scope: 'sur',
                        region: 'sur',
                    }
                );
            assert.equal(
                (
                    mountedSouth.pack ||
                    mountedSouth.__turneroReleaseStrategyDigitalTwinStudioPack
                ).warGames.length,
                0
            );
            assert.equal(
                southHost.dataset.turneroReleaseStrategyDigitalTwinStudioScope,
                'sur'
            );
            assert.match(southHost.innerHTML, /Strategy Digital Twin Studio/);
            assert.match(
                southHost.innerHTML,
                /Forecast, digital twin, war games/
            );
        }
    );
});
