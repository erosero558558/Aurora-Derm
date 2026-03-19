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
} = require('./turnero-release-test-fixtures.js');

async function loadGovernanceSuiteModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-governance-suite.js'
    );
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.innerHTML = '';
        this.onclick = null;
        this.rootNode = null;
    }

    querySelector(selector) {
        return selector === '#turneroReleaseGovernanceSuite'
            ? this.rootNode
            : null;
    }
}

function withGlobals(setup, callback) {
    const previous = {
        HTMLElement: global.HTMLElement,
        HTMLButtonElement: global.HTMLButtonElement,
        navigator: global.navigator,
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

function buildGovernanceFixture() {
    const clinicId = 'clinica-demo';
    const profileFingerprint = '1234abcd';
    const generatedAt = '2026-03-18T12:00:00.000Z';
    const turneroClinicProfile = buildClinicProfile({
        clinic_id: clinicId,
        branding: {
            name: 'Clínica Demo',
            short_name: 'Demo',
            base_url: 'https://demo.example',
        },
        runtime_meta: {
            source: 'file',
            profileFingerprint,
        },
    });
    const turneroV2Readiness = buildPilotReadiness({
        clinicId,
        profileFingerprint,
    });
    const turneroRemoteReleaseReadiness = buildRemoteReadiness({
        clinicId,
        profileFingerprint,
    });
    const turneroPublicShellDrift = buildShellDrift({
        pageOk: true,
        driftStatus: 'ready',
    });
    const regionalClinics = [
        {
            clinicId: 'clinica-norte',
            label: 'Clínica Norte',
            shortLabel: 'Norte',
            region: 'norte',
            plannedBudget: 35000,
            committedBudget: 24000,
            atRiskBudget: 2500,
            riskScore: 34,
            valueScore: 82,
        },
        {
            clinicId: 'clinica-sur',
            label: 'Clínica Sur',
            shortLabel: 'Sur',
            region: 'sur',
            plannedBudget: 25000,
            committedBudget: 18000,
            atRiskBudget: 3500,
            riskScore: 46,
            valueScore: 68,
        },
    ];
    const turneroReleaseEvidenceBundle = {
        ...buildEvidenceSnapshot({
            turneroClinicProfile,
            pilotReadiness: turneroV2Readiness,
            remoteReleaseReadiness: turneroRemoteReleaseReadiness,
            publicShellDrift: turneroPublicShellDrift,
            generatedAt,
        }),
        regionalClinics,
    };
    const historySnapshots = [
        {
            snapshotId: 'clinica-demo-20260317-090000',
            clinicId,
            clinicName: 'Clínica Demo',
            clinicShortName: 'Demo',
            label: 'Wave 1',
            decision: 'ready',
            severity: 'info',
            summary: 'Wave 1 estable',
            savedAt: '2026-03-17T09:00:00.000Z',
            generatedAt: '2026-03-17T09:00:00.000Z',
            incidentCount: 1,
            surfaceCount: 4,
            clinicCount: 2,
            baseCost: 22000,
            supportCost: 6000,
            incidentReserve: 1500,
        },
        {
            snapshotId: 'clinica-demo-20260318-090000',
            clinicId,
            clinicName: 'Clínica Demo',
            clinicShortName: 'Demo',
            label: 'Wave 2',
            decision: 'review',
            severity: 'warning',
            summary: 'Wave 2 lista para revisión',
            savedAt: '2026-03-18T09:00:00.000Z',
            generatedAt: '2026-03-18T09:00:00.000Z',
            incidentCount: 2,
            surfaceCount: 4,
            clinicCount: 2,
            baseCost: 21000,
            supportCost: 5800,
            incidentReserve: 1800,
        },
    ];

    return {
        clinicId,
        profileFingerprint,
        generatedAt,
        turneroClinicProfile,
        turneroV2Readiness,
        turneroRemoteReleaseReadiness,
        turneroPublicShellDrift,
        turneroReleaseEvidenceBundle,
        regionalClinics,
        historySnapshots,
    };
}

test('turnero governance suite builders synthesize budget, cost, risk, compliance and markdown', async () => {
    const module = await loadGovernanceSuiteModule();
    const fixture = buildGovernanceFixture();
    const budget = module.buildTurneroReleaseBudgetEnvelope({
        clinicId: fixture.clinicId,
        currentSnapshot: fixture.turneroReleaseEvidenceBundle,
        releaseEvidenceBundle: fixture.turneroReleaseEvidenceBundle,
        regionalClinics: fixture.regionalClinics,
        historySnapshots: fixture.historySnapshots,
    });
    const costs = module.buildTurneroReleaseCostModel({
        clinicId: fixture.clinicId,
        currentSnapshot: fixture.turneroReleaseEvidenceBundle,
        releaseEvidenceBundle: fixture.turneroReleaseEvidenceBundle,
        historySnapshots: fixture.historySnapshots,
    });
    const compliance = module.buildTurneroReleaseCompliancePack({
        clinicId: fixture.clinicId,
        currentSnapshot: fixture.turneroReleaseEvidenceBundle,
        releaseEvidenceBundle: fixture.turneroReleaseEvidenceBundle,
        historySnapshots: fixture.historySnapshots,
        regionalClinics: fixture.regionalClinics,
    });
    const heatmap = module.buildTurneroReleaseInvestmentHeatmap({
        clinicId: fixture.clinicId,
        currentSnapshot: fixture.turneroReleaseEvidenceBundle,
        releaseEvidenceBundle: fixture.turneroReleaseEvidenceBundle,
        regionalClinics: fixture.regionalClinics,
    });
    const risks = module.buildTurneroReleaseRiskLedger({
        incidents: [
            {
                id: 'critical-breach',
                owner: 'ops',
                severity: 'critical',
                likelihood: 5,
                impact: 5,
                title: 'Critical breach',
                mitigation:
                    'Block release expansion until the board reviews the breach.',
                source: 'manual',
            },
            {
                id: 'routing-gap',
                owner: 'ops',
                severity: 'high',
                likelihood: 4,
                impact: 3,
                title: 'Routing gap',
                mitigation: 'Patch the deployment lane before promotion.',
                source: 'manual',
            },
        ],
    });
    const board = module.buildTurneroReleaseBoardReport({
        clinicId: fixture.clinicId,
        clinicLabel: 'Clínica Demo',
        region: 'regional',
        generatedAt: fixture.generatedAt,
        budget,
        costs,
        risks,
        compliance,
        heatmap,
    });
    const markdown = module.boardReportToMarkdown(board);

    assert.equal(budget.clinicsCount, 2);
    assert.equal(budget.decision, 'ready');
    assert.equal(budget.totals.planned, 60000);
    assert.equal(budget.totals.committed, 42000);
    assert.equal(budget.totals.atRisk, 6000);
    assert.equal(budget.burnPct, 70);
    assert.equal(budget.riskPct, 10);
    assert.equal(costs.lines.length, 2);
    assert.equal(costs.totalCost, 58100);
    assert.equal(compliance.status, 'green');
    assert.equal(compliance.totals.all, 4);
    assert.equal(compliance.totals.passed, 4);
    assert.equal(heatmap.summary.protect, 0);
    assert.equal(heatmap.summary.accelerate, 1);
    assert.equal(heatmap.summary.watch, 1);
    assert.equal(risks.grade, 'D');
    assert.ok(risks.totalScore > 120);
    assert.match(board.headline, /Hold release expansion/i);
    assert.match(markdown, /# Turnero Release Board Report/);
    assert.match(markdown, /## Budget/);
    assert.match(markdown, /## Risk Ledger/);
    assert.match(markdown, /## Compliance/);
    assert.match(markdown, /## Investment Heatmap/);
});

test('turnero governance suite monta sin duplicar el host ni el panel al re-renderizar', async () => {
    const module = await loadGovernanceSuiteModule();
    const fixture = buildGovernanceFixture();
    const host = new HTMLElementStub('queueReleaseGovernanceSuiteHost');
    const rootNode = new HTMLElementStub('turneroReleaseGovernanceSuite');
    host.rootNode = rootNode;

    const input = {
        clinicId: fixture.clinicId,
        clinicLabel: 'Clínica Demo',
        clinicShortName: 'Demo',
        currentSnapshot: fixture.turneroReleaseEvidenceBundle,
        releaseEvidenceBundle: fixture.turneroReleaseEvidenceBundle,
        historySnapshots: fixture.historySnapshots,
        regionalClinics: fixture.regionalClinics,
        remoteReadiness: fixture.turneroRemoteReleaseReadiness,
        publicShellDrift: fixture.turneroPublicShellDrift,
        clinicProfile: fixture.turneroClinicProfile,
        generatedAt: fixture.generatedAt,
    };

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            navigator: {
                clipboard: {
                    async writeText() {
                        return undefined;
                    },
                },
            },
        },
        async () => {
            const firstMount = module.mountTurneroReleaseGovernanceSuite(
                host,
                input
            );
            const firstMarkup = host.innerHTML;
            const secondMount = module.mountTurneroReleaseGovernanceSuite(
                host,
                input
            );

            assert.equal(firstMount, rootNode);
            assert.equal(secondMount, rootNode);
            assert.equal(
                (firstMarkup.match(/id="turneroReleaseGovernanceSuite"/g) || [])
                    .length,
                1
            );
            assert.equal(host.innerHTML, firstMarkup);
            assert.equal(host.dataset.turneroReleaseGovernanceSuite, 'mounted');
            assert.equal(
                host.dataset.turneroReleaseGovernanceClinicId,
                fixture.clinicId
            );
            assert.equal(host.dataset.turneroReleaseGovernanceTone, 'ready');
            assert.equal(
                rootNode.__turneroReleaseGovernanceSuiteModel.title,
                'Financial / Risk Governance Suite'
            );
            assert.match(host.innerHTML, /Financial \/ Risk Governance Suite/);
        }
    );
});
