'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

async function loadAdoptionCloudModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-service-excellence-adoption-cloud.js'
    );
}

async function loadQualityMetricsModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-service-quality-metrics.js'
    );
}

async function loadAdoptionCohortLabModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-adoption-cohort-lab.js'
    );
}

async function loadChangeSaturationIndexModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-change-saturation-index.js'
    );
}

async function loadClinicMaturityLadderModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-clinic-maturity-ladder.js'
    );
}

async function loadServiceExcellenceScoreModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-service-excellence-score.js'
    );
}

async function loadTrainingRegistryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-training-readiness-registry.js'
    );
}

async function loadFieldFeedbackExchangeModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-field-feedback-exchange.js'
    );
}

class StubElement {
    constructor(tagName = 'div') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.dataset = {};
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this._innerHTML = '';
        this.parentNode = null;
        this.download = '';
        this.href = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
        this.nodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    replaceChildren(...nodes) {
        this.children = [];
        nodes.forEach((node) => {
            this.children.push(node);
            node.parentNode = this;
        });
        return nodes[0] || null;
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new StubElement('span');
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=')) {
                node.textContent = '';
            }
            this.nodes.set(key, node);
        }
        return this.nodes.get(key);
    }
}

function withGlobals(setup, callback) {
    const previous = {};

    for (const key of Object.keys(setup)) {
        previous[key] = global[key];
        try {
            global[key] = setup[key];
        } catch (_error) {
            Object.defineProperty(global, key, {
                configurable: true,
                writable: true,
                value: setup[key],
            });
        }
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const key of Object.keys(setup)) {
                const value = previous[key];
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

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(downloadClicks) {
    return {
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new StubElement('a');
                anchor.click = () => {
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                    });
                };
                return anchor;
            }

            return new StubElement(tag);
        },
    };
}

function buildServiceExcellenceFixture() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinic-a',
        region: 'north',
        regionalClinics: [
            {
                clinicId: 'clinic-a',
                adoptionRate: 80,
                queueFlowScore: 80,
                callAccuracyScore: 80,
                deskReadinessScore: 80,
                patientSignalScore: 80,
                trainingReadiness: 80,
                status: 'active',
            },
        ],
    });

    return {
        clinicProfile,
        releaseIncidents: [{ id: 'incident-1', clinicId: 'clinic-a' }],
        trainingRows: [
            {
                clinicId: 'clinic-a',
                owner: 'ops',
                readiness: 80,
                label: 'Training readiness',
                state: 'recorded',
            },
        ],
        feedbackRows: [
            {
                clinicId: 'clinic-a',
                owner: 'field',
                sentiment: 'positive',
                note: 'Sin fricción.',
                channel: 'onsite',
            },
            {
                clinicId: 'clinic-a',
                owner: 'field',
                sentiment: 'neutral',
                note: 'Seguimiento.',
                channel: 'onsite',
            },
        ],
    };
}

test('service excellence builders synthesize quality, cohorts, saturation, maturity and score', async () => {
    const [
        qualityModule,
        cohortModule,
        saturationModule,
        maturityModule,
        scoreModule,
    ] = await Promise.all([
        loadQualityMetricsModule(),
        loadAdoptionCohortLabModule(),
        loadChangeSaturationIndexModule(),
        loadClinicMaturityLadderModule(),
        loadServiceExcellenceScoreModule(),
    ]);
    const fixture = buildServiceExcellenceFixture();
    const clinics = fixture.clinicProfile.regionalClinics;

    const quality = qualityModule.buildTurneroReleaseServiceQualityMetrics({
        clinics,
    });
    const cohorts = cohortModule.buildTurneroReleaseAdoptionCohortLab({
        clinics: [
            {
                clinicId: 'clinic-a',
                adoptionRate: 80,
                trainingReadiness: 80,
                qualityScore: 80,
            },
        ],
    });
    const saturation =
        saturationModule.buildTurneroReleaseChangeSaturationIndex({
            clinics,
            incidents: fixture.releaseIncidents,
            feedback: fixture.feedbackRows,
            training: fixture.trainingRows,
        });
    const maturity = maturityModule.buildTurneroReleaseClinicMaturityLadder({
        qualityRows: quality.rows,
        cohortRows: cohorts.rows,
        saturationRows: saturation.rows,
    });
    const excellence = scoreModule.buildTurneroReleaseServiceExcellenceScore({
        quality,
        cohorts: cohorts.rows,
        maturity: maturity.rows,
        saturation,
    });

    assert.equal(quality.avgScore, 80);
    assert.equal(quality.rows[0].band, 'stable');
    assert.equal(cohorts.rows[0].cohort, 'steady');
    assert.equal(cohorts.rows[0].combined, 80);
    assert.equal(saturation.avgLoad, 26);
    assert.equal(saturation.rows[0].state, 'healthy');
    assert.equal(maturity.rows[0].maturityScore, 78.8);
    assert.equal(maturity.rows[0].level, 'L3-operational');
    assert.equal(excellence.score, 88.4);
    assert.equal(excellence.band, 'strong');
});

test('training and feedback registries persist per scope without key collisions', async () => {
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const [trainingModule, feedbackModule] = await Promise.all([
            loadTrainingRegistryModule(),
            loadFieldFeedbackExchangeModule(),
        ]);
        const trainingA =
            trainingModule.createTurneroReleaseTrainingReadinessRegistry(
                'clinic-a'
            );
        const trainingB =
            trainingModule.createTurneroReleaseTrainingReadinessRegistry(
                'clinic-b'
            );
        const feedbackA =
            feedbackModule.createTurneroReleaseFieldFeedbackExchange(
                'clinic-a'
            );

        trainingA.add({
            clinicId: 'clinic-a',
            owner: 'ops',
            readiness: 72,
        });
        trainingB.add({
            clinicId: 'clinic-b',
            owner: 'ops',
            readiness: 64,
        });
        feedbackA.add({
            clinicId: 'clinic-a',
            owner: 'field',
            sentiment: 'positive',
            note: 'Sin fricción.',
        });

        assert.equal(trainingA.list().length, 1);
        assert.equal(trainingB.list().length, 1);
        assert.equal(feedbackA.list().length, 1);

        const dump = storage.dump();
        assert.deepEqual(Object.keys(dump).sort(), [
            'turnero-release-field-feedback-exchange:v1',
            'turnero-release-training-readiness-registry:v1',
        ]);

        const trainingStore = JSON.parse(
            dump['turnero-release-training-readiness-registry:v1']
        );
        const feedbackStore = JSON.parse(
            dump['turnero-release-field-feedback-exchange:v1']
        );

        assert.equal(trainingStore['clinic-a'].length, 1);
        assert.equal(trainingStore['clinic-b'].length, 1);
        assert.equal(feedbackStore['clinic-a'].length, 1);
    });
});

test('mount renders adoption cloud actions and rerenders without duplicating the host', async () => {
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloadClicks = [];
    const blobs = [];

    class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    }

    const documentStub = createDocumentStub(downloadClicks);
    const navigatorStub = {
        clipboard: {
            writeText: async (text) => {
                clipboard.push(text);
            },
        },
    };
    const URLStub = {
        createObjectURL(blob) {
            blobs.push(blob);
            return 'blob:turnero-service-excellence';
        },
        revokeObjectURL() {},
    };
    const target = new StubElement('div');

    await withGlobals(
        {
            localStorage: storage,
            navigator: navigatorStub,
            document: documentStub,
            Blob: BlobStub,
            URL: URLStub,
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            HTMLInputElement: StubElement,
            HTMLTextAreaElement: StubElement,
        },
        async () => {
            const [adoptionCloudModule, trainingModule, feedbackModule] =
                await Promise.all([
                    loadAdoptionCloudModule(),
                    loadTrainingRegistryModule(),
                    loadFieldFeedbackExchangeModule(),
                ]);
            const fixture = buildServiceExcellenceFixture();
            const trainingRegistry =
                trainingModule.createTurneroReleaseTrainingReadinessRegistry(
                    'clinic-a'
                );
            const feedbackExchange =
                feedbackModule.createTurneroReleaseFieldFeedbackExchange(
                    'clinic-a'
                );

            fixture.trainingRows.forEach((row) => trainingRegistry.add(row));
            fixture.feedbackRows.forEach((row) => feedbackExchange.add(row));

            const result =
                adoptionCloudModule.mountTurneroReleaseServiceExcellenceAdoptionCloud(
                    target,
                    {
                        scope: 'clinic-a',
                        clinicProfile: fixture.clinicProfile,
                        releaseIncidents: fixture.releaseIncidents,
                    }
                );

            assert.ok(result);
            assert.equal(target.children.length, 1);
            assert.equal(target.children[0], result.root);
            assert.equal(
                result.root.className,
                'turnero-release-service-excellence-adoption-cloud'
            );
            const scoreNode = result.root.nodes.get('[data-role="score"]');
            const changeLoadNode = result.root.nodes.get(
                '[data-role="change-load"]'
            );
            const briefNode = result.root.nodes.get(
                '[data-role="adoption-brief"]'
            );

            assert.equal(scoreNode?.textContent, '88.4');
            assert.equal(changeLoadNode?.textContent, '26');
            assert.match(briefNode?.textContent || '', /Training entries: 1/);
            assert.match(briefNode?.textContent || '', /Feedback entries: 2/);

            await result.root.listeners.get('click')({
                target: createActionTarget('copy-adoption-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /Service excellence score: 88.4/);

            await result.root.listeners.get('click')({
                target: createActionTarget('download-adoption-pack'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-service-excellence-pack.json'
            );
            assert.equal(blobs.length, 1);
            const parsedPack = JSON.parse(blobs[0].parts[0]);
            assert.equal(parsedPack.excellence.score, 88.4);
            assert.equal(parsedPack.excellence.band, 'strong');

            result.root.querySelector('[data-field="training-clinic"]').value =
                'clinic-a';
            result.root.querySelector('[data-field="training-owner"]').value =
                'ops';
            result.root.querySelector(
                '[data-field="training-readiness"]'
            ).value = '80';
            await result.root.listeners.get('click')({
                target: createActionTarget('add-training'),
            });
            assert.equal(result.pack.training.length, 2);
            assert.match(briefNode?.textContent || '', /Training entries: 2/);

            result.root.querySelector('[data-field="feedback-clinic"]').value =
                'clinic-a';
            result.root.querySelector('[data-field="feedback-owner"]').value =
                'field';
            result.root.querySelector(
                '[data-field="feedback-sentiment"]'
            ).value = 'neutral';
            result.root.querySelector('[data-field="feedback-note"]').value =
                'Seguimiento adicional.';
            await result.root.listeners.get('click')({
                target: createActionTarget('add-feedback'),
            });
            assert.equal(result.pack.feedback.length, 3);
            assert.equal(changeLoadNode?.textContent, '33');
            assert.match(briefNode?.textContent || '', /Feedback entries: 3/);

            const second =
                adoptionCloudModule.mountTurneroReleaseServiceExcellenceAdoptionCloud(
                    target,
                    {
                        scope: 'clinic-a',
                        clinicProfile: fixture.clinicProfile,
                        releaseIncidents: fixture.releaseIncidents,
                    }
                );

            assert.ok(second);
            assert.equal(target.children.length, 1);
            assert.equal(target.children[0], second.root);
        }
    );
});

test('queue surface wiring includes the service excellence adoption cloud host and render hook', () => {
    const headerSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
        ),
        'utf8'
    );
    const installHubSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
        ),
        'utf8'
    );

    assert.match(
        headerSource,
        /id="queueReleaseServiceExcellenceAdoptionCloudHost"/
    );
    assert.match(
        headerSource,
        /data-turnero-release-service-excellence-adoption-cloud/
    );
    assert.match(
        installHubSource,
        /mountTurneroReleaseServiceExcellenceAdoptionCloud/
    );
    assert.match(
        installHubSource,
        /queueReleaseServiceExcellenceAdoptionCloudHost/
    );
    assert.match(
        installHubSource,
        /renderQueueReleaseServiceExcellenceAdoptionCloud\(manifest, detectedPlatform\);/
    );
});
