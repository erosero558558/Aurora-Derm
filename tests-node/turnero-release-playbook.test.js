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

async function loadControlCenterModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-control-center.js'
    );
}

async function loadPlaybookModule() {
    return loadModule('src/apps/queue-shared/turnero-remediation-playbook.js');
}

test('turnero release console playbook queda ready cuando la evidencia coincide', async () => {
    const controlCenter = await loadControlCenterModule();
    const playbookModule = await loadPlaybookModule();
    const evidenceSnapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const controlModel =
        controlCenter.buildTurneroReleaseControlCenterModel(evidenceSnapshot);
    const playbook = playbookModule.buildTurneroReleaseConsolePlaybook(
        controlModel.snapshot
    );

    assert.equal(playbook.decision, 'ready');
    assert.equal(playbook.decisionReason, controlModel.decisionReason);
    assert.equal(playbook.summaryText, controlModel.summary);
    assert.equal(playbook.summary.blocker, 0);
    assert.equal(playbook.summary.warning, 0);
    assert.ok(Array.isArray(playbook.ownerBreakdown));
    assert.equal(
        playbook.summary.total,
        playbook.ownerBreakdownMap.totals.total
    );
    assert.ok(playbook.summary.total >= 0);
    assert.match(playbook.clipboardSummary, /Decision: ready/);
    assert.match(playbook.runbookMarkdown, /# Turnero Release Control Center/);
});

test('turnero release console playbook sube a review si solo queda una advertencia visible', async () => {
    const controlCenter = await loadControlCenterModule();
    const playbookModule = await loadPlaybookModule();
    const evidenceSnapshot = buildEvidenceSnapshot({
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
    const controlModel =
        controlCenter.buildTurneroReleaseControlCenterModel(evidenceSnapshot);
    const playbook = playbookModule.buildTurneroReleaseConsolePlaybook(
        controlModel.snapshot
    );

    assert.equal(playbook.decision, 'review');
    assert.equal(playbook.decisionReason, controlModel.decisionReason);
    assert.equal(playbook.summaryText, controlModel.summary);
    assert.ok(playbook.summary.total > 0);
    assert.equal(
        playbook.summary.total,
        playbook.ownerBreakdownMap.totals.total
    );
    assert.ok(playbook.ownerBreakdown.some((row) => row.total > 0));
    assert.equal(typeof playbook.decisionReason, 'string');
    assert.ok(playbook.decisionReason.length > 0);
});

test('turnero release console playbook se queda en hold si falta el perfil o la evidencia bloquea', async () => {
    const controlCenter = await loadControlCenterModule();
    const playbookModule = await loadPlaybookModule();
    const evidenceSnapshot = buildEvidenceSnapshot({
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
    const controlModel =
        controlCenter.buildTurneroReleaseControlCenterModel(evidenceSnapshot);
    const playbook = playbookModule.buildTurneroReleaseConsolePlaybook(
        controlModel.snapshot
    );

    assert.equal(playbook.decision, 'hold');
    assert.equal(playbook.decisionReason, controlModel.decisionReason);
    assert.equal(playbook.summaryText, controlModel.summary);
    assert.ok(playbook.summary.total > 0);
    assert.equal(
        playbook.summary.total,
        playbook.ownerBreakdownMap.totals.total
    );
    assert.ok(playbook.ownerBreakdown.some((row) => row.total > 0));
    assert.equal(typeof playbook.decisionReason, 'string');
    assert.ok(playbook.decisionReason.length > 0);
});
