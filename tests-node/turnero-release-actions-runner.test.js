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
    createFetchMock,
    createResponse,
} = require('./turnero-release-test-fixtures.js');

async function loadRunnerModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-actions-runner.js'
    );
}

async function loadPlaybookModule() {
    return loadModule('src/apps/queue-shared/turnero-remediation-playbook.js');
}

test('turnero release actions runner refresca todo con providers inyectados y produce pack/handoff coherentes', async () => {
    const runnerModule = await loadRunnerModule();
    const playbookModule = await loadPlaybookModule();
    const initialJournal = [
        {
            id: 'journal-1',
            title: 'Nota local',
            detail: 'Lista para descarga.',
            owner: 'ops',
            severity: 'info',
            source: 'manual',
            state: 'info',
            updatedAt: '2026-03-18T12:05:00.000Z',
        },
    ];
    const initialSnapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });
    const calls = [];
    let clipboardText = '';
    let downloadedSnapshot = null;

    const runner = runnerModule.createTurneroReleaseActionsRunner({
        snapshot: initialSnapshot,
        incidentJournal: initialJournal,
        refreshPilotReadiness: async ({ snapshot }) => {
            calls.push(['pilot', snapshot.clinicId]);
            return {
                clinicProfile: buildClinicProfile(),
                clinicId: 'clinica-demo',
                profileFingerprint: '1234abcd',
                readinessState: 'ready',
                readinessSummary: 'Readiness local lista.',
                readinessSupport: 'Listo para liberar.',
                goLiveIssues: [],
            };
        },
        refreshRemoteRelease: async ({ snapshot }) => {
            calls.push(['remote', snapshot.clinicId]);
            return {
                state: 'ready',
                tone: 'ready',
                clinicId: 'clinica-demo',
                profileFingerprint: '1234abcd',
                items: [
                    {
                        id: 'public_sync',
                        label: 'Public sync',
                        detail: 'OK',
                        state: 'ready',
                    },
                    {
                        id: 'diagnostics',
                        label: 'Diagnósticos',
                        detail: 'OK',
                        state: 'ready',
                    },
                ],
                summary: 'Remoto listo.',
                supportCopy: 'Turnero remoto listo.',
            };
        },
        refreshPublicShellDrift: async ({ snapshot }) => {
            calls.push(['shell', snapshot.clinicId]);
            return {
                pageOk: true,
                pageStatus: 200,
                html: '<html><head><link rel="stylesheet" href="/styles.css"></head></html>',
                blockers: [],
            };
        },
        refreshEvidenceBundle: async ({ snapshot }) => {
            calls.push(['evidence', snapshot.clinicId]);
            return {
                releaseEvidenceBundle: {
                    generatedAt: '2026-03-18T12:34:56.000Z',
                    turneroClinicProfile: buildClinicProfile(),
                    clinicProfile: buildClinicProfile(),
                    pilotReadiness: buildPilotReadiness(),
                    remoteReleaseReadiness: buildRemoteReadiness(),
                    publicShellDrift: buildShellDrift(),
                },
                snapshot: {
                    generatedAt: '2026-03-18T12:34:56.000Z',
                },
            };
        },
        recalculateDecision: async ({ snapshot }) => {
            calls.push(['playbook', snapshot.clinicId]);
            const playbook =
                playbookModule.buildTurneroReleaseConsolePlaybook(
                    initialSnapshot
                );

            return {
                playbook: {
                    ...playbook,
                    decision: 'ready',
                    decisionReason:
                        'Sin bloqueos visibles; la clínica queda lista para corte.',
                    summary: {
                        blocker: 0,
                        warning: 0,
                        info: 0,
                        total: 0,
                        score: 0,
                    },
                    summaryText:
                        'Sin bloqueos visibles; la clínica queda lista para corte.',
                    clipboardSummary:
                        'Turnero release control center\nDecision: ready\nClinic: Clínica Demo (clinica-demo)',
                    runbookMarkdown: '# Turnero Release Control Center',
                    ownerBreakdown: [],
                    ownerBreakdownRows: [],
                    ownerBreakdownMap: {
                        totals: {
                            owner: 'totals',
                            label: 'Total',
                            focus: '',
                            total: 0,
                            blocker: 0,
                            warning: 0,
                            info: 0,
                            score: 0,
                            sources: [],
                            topTitles: [],
                        },
                    },
                    incidents: [],
                },
            };
        },
        buildHandoff: async ({ playbook }) => {
            calls.push(['handoff', playbook.decision]);
            return `HANDOFF :: ${playbook.decision}`;
        },
        copyToClipboard: async (text) => {
            clipboardText = text;
            return true;
        },
        buildPack: async ({ snapshot, playbook, journalEntries }) => {
            calls.push(['pack', playbook.decision]);
            return {
                filename: 'turnero-release-ops-pack-demo.json',
                pack: {
                    surface: 'admin_queue',
                    generatedAt: '2026-03-18T12:34:56.000Z',
                    clinicProfile:
                        snapshot.parts?.clinicProfile ||
                        snapshot.clinicProfile ||
                        {},
                    turneroClinicProfile:
                        snapshot.parts?.clinicProfile ||
                        snapshot.turneroClinicProfile ||
                        {},
                    clinicId: snapshot.clinicId,
                    profileFingerprint: snapshot.profileFingerprint,
                    pilotReadiness:
                        snapshot.parts?.pilotReadiness ||
                        snapshot.pilotReadiness ||
                        {},
                    remoteReleaseReadiness:
                        snapshot.parts?.remoteReleaseReadiness ||
                        snapshot.remoteReleaseReadiness ||
                        {},
                    publicShellDrift:
                        snapshot.parts?.publicShellDrift ||
                        snapshot.publicShellDrift ||
                        {},
                    releaseEvidenceBundle:
                        snapshot.parts?.releaseEvidenceBundle ||
                        snapshot.releaseEvidenceBundle ||
                        {},
                    playbook,
                    incidentJournal: journalEntries,
                },
            };
        },
        downloadJsonSnapshot: async (filename, payload) => {
            downloadedSnapshot = { filename, payload };
            return true;
        },
    });

    const refreshAllResult = await runner.refreshAll();
    assert.equal(refreshAllResult.ok, true);
    assert.equal(runner.state.inFlight, false);
    assert.equal(runner.state.lastAction, 'refreshAll');
    assert.equal(runner.state.lastError, null);
    assert.equal(typeof runner.state.lastRunAt, 'string');
    assert.equal(
        runner.state.results.pilotReadiness.clinicProfile.clinic_id,
        'clinica-demo'
    );
    assert.equal(runner.state.results.remoteReleaseReadiness.state, 'ready');
    assert.equal(runner.state.results.publicShellDrift.pageOk, true);
    assert.equal(
        runner.state.results.releaseEvidenceBundle.generatedAt,
        '2026-03-18T12:34:56.000Z'
    );
    assert.equal(runner.state.results.playbook.decision, 'ready');
    assert.ok(
        calls.some(([name]) => name === 'pilot') &&
            calls.some(([name]) => name === 'remote') &&
            calls.some(([name]) => name === 'shell') &&
            calls.some(([name]) => name === 'evidence') &&
            calls.some(([name]) => name === 'playbook')
    );

    const handoffResult = await runner.copyHandoff();
    assert.equal(handoffResult.ok, true);
    assert.match(handoffResult.text, /HANDOFF :: ready/);
    assert.equal(clipboardText, handoffResult.text);
    assert.equal(runner.state.lastAction, 'copyHandoff');
    assert.equal(runner.state.lastError, null);

    const downloadResult = await runner.downloadPack();
    assert.equal(downloadResult.ok, true);
    assert.equal(downloadResult.filename, 'turnero-release-ops-pack-demo.json');
    assert.equal(downloadResult.pack.surface, 'admin_queue');
    assert.equal(downloadResult.pack.incidentJournal.length, 1);
    assert.equal(runner.state.lastAction, 'downloadPack');
    assert.equal(runner.state.lastError, null);
    assert.equal(
        downloadedSnapshot.filename,
        'turnero-release-ops-pack-demo.json'
    );
    assert.equal(downloadedSnapshot.payload.surface, 'admin_queue');
    assert.equal(downloadedSnapshot.payload.incidentJournal.length, 1);
});

test('turnero release actions runner cae a fetch cuando no hay provider para la readiness local', async () => {
    const runnerModule = await loadRunnerModule();
    const requests = [];
    const fetchImpl = createFetchMock((parsedUrl, resource) => {
        if (resource === 'turnero-pilot-readiness') {
            return createResponse({
                clinicId: 'clinica-fetch-demo',
                profileFingerprint: 'feedcafe',
                readinessState: 'ready',
                readinessSummary: 'Readiness lista por fetch.',
                readinessSupport: 'Fetch OK.',
                clinicProfile: buildClinicProfile({
                    clinic_id: 'clinica-fetch-demo',
                }),
                goLiveIssues: [],
            });
        }

        return createResponse(
            { ok: false, error: `unexpected ${resource}` },
            500
        );
    }, requests);

    const runner = runnerModule.createTurneroReleaseActionsRunner({
        snapshot: buildEvidenceSnapshot({
            turneroClinicProfile: buildClinicProfile({
                clinic_id: 'clinica-fetch-demo',
            }),
            pilotReadiness: buildPilotReadiness({
                clinicId: 'clinica-fetch-demo',
                profileFingerprint: 'feedcafe',
            }),
            remoteReleaseReadiness: buildRemoteReadiness({
                clinicId: 'clinica-fetch-demo',
                profileFingerprint: 'feedcafe',
            }),
            publicShellDrift: buildShellDrift(),
        }),
        fetchImpl,
    });

    const result = await runner.refreshPilotReadiness();

    assert.equal(result.ok, true);
    assert.equal(
        runner.state.results.pilotReadiness.clinicId,
        'clinica-fetch-demo'
    );
    assert.equal(
        runner.state.results.pilotReadiness.profileFingerprint,
        'feedcafe'
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].resource, 'turnero-pilot-readiness');
    assert.match(requests[0].url, /resource=turnero-pilot-readiness/);
    assert.equal(runner.state.lastAction, 'refreshPilotReadiness');
    assert.equal(runner.state.lastError, null);
});
