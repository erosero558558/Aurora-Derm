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

async function loadRolloutModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-rollout-command-center.js'
    );
}

async function loadHistoryModule() {
    return loadModule('src/apps/queue-shared/turnero-release-history-store.js');
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

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    querySelector() {
        return null;
    }
}

function withGlobals(setup, callback) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;

    Object.assign(global, setup);

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            if (previousWindow === undefined) {
                delete global.window;
            } else {
                global.window = previousWindow;
            }

            if (previousDocument === undefined) {
                delete global.document;
            } else {
                global.document = previousDocument;
            }

            if (previousHTMLElement === undefined) {
                delete global.HTMLElement;
            } else {
                global.HTMLElement = previousHTMLElement;
            }

            if (previousHTMLButtonElement === undefined) {
                delete global.HTMLButtonElement;
            } else {
                global.HTMLButtonElement = previousHTMLButtonElement;
            }
        });
}

test('turnero rollout governor combina historial, approvals y canary registry en un modelo utilizable', async () => {
    const rolloutModule = await loadRolloutModule();
    const historyModule = await loadHistoryModule();
    const storage = createLocalStorageStub();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });

    await withGlobals(
        {
            window: {
                localStorage: storage,
                location: { origin: 'https://demo.example' },
            },
        },
        async () => {
            const store = historyModule.createReleaseHistoryStore({
                storage,
            });
            const firstSnapshot = store.save('clinica-demo', snapshot);
            store.setBaseline('clinica-demo', firstSnapshot.snapshotId);
            store.save('clinica-demo', {
                ...snapshot,
                alertCount: 1,
                warningCount: 2,
                decision: 'review',
                severity: 'warning',
                summary: 'Corrida con señales amarillas.',
            });

            const actions = rolloutModule.createReleaseRolloutActions({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                snapshot,
                storage,
            });

            actions.requestApproval({
                reason: 'Aprobación requerida para canary',
                suggestedApprover: 'product-owner',
                severity: 'high',
            });
            actions.createCanary({
                label: 'Demo canary',
                owner: 'deploy',
                budget: 80,
            });

            const model = rolloutModule.buildReleaseRolloutCommandCenter({
                clinicId: 'clinica-demo',
                clinicLabel: 'Clínica Demo',
                snapshot,
                storage,
            });

            assert.match(model.summary, /Clínica Demo/);
            assert.ok(
                ['promote', 'review', 'hold', 'rollback'].includes(
                    model.decision
                )
            );
            assert.ok(model.approvalHandoff.pendingCount >= 1);
            assert.ok(model.canary.campaigns.length >= 1);
            assert.match(model.riskBudget.summary, /Risk budget/);
            assert.match(model.sla.summary, /SLA/);
            assert.ok(model.pipeline.stages.length >= 5);
            assert.match(model.exports.executiveSummary, /Rollout governor/);
        }
    );
});

test('turnero rollout governor renderiza el panel y expone hosts y acciones principales', async () => {
    const rolloutModule = await loadRolloutModule();
    const storage = createLocalStorageStub();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const host = new HTMLElementStub('queueOpsPilotRolloutGovernorHost');

    await withGlobals(
        {
            window: {
                localStorage: storage,
                location: { origin: 'https://demo.example' },
            },
            document: {
                querySelector() {
                    return null;
                },
                getElementById() {
                    return null;
                },
            },
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
        },
        async () => {
            const mounted =
                rolloutModule.mountTurneroReleaseRolloutCommandCenterCard(
                    host,
                    {
                        clinicId: 'clinica-demo',
                        clinicLabel: 'Clínica Demo',
                        snapshot,
                        storage,
                    }
                );

            assert.equal(mounted, host);
            assert.ok(host.dataset.turneroReleaseRolloutCommandCenterRequestId);
            assert.match(host.innerHTML, /queueReleaseRolloutCommandCenter/);
            assert.match(host.innerHTML, /Rollout Governor/);
            assert.match(host.innerHTML, /Copiar resumen ejecutivo/);
            assert.match(
                host.innerHTML,
                /queueReleaseRolloutCommandCenterRiskBudget/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseRolloutCommandCenterApprovalQueue/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseRolloutCommandCenterCanaryRegistry/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseRolloutCommandCenterSlaMonitor/
            );
            assert.match(
                host.innerHTML,
                /queueReleaseRolloutCommandCenterPipeline/
            );
        }
    );
});
