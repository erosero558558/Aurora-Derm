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

async function loadPilotRenderModule() {
    return loadModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/pilot/render.js'
    );
}

async function loadConsoleModule() {
    return loadModule('src/apps/queue-shared/turnero-release-ops-console.js');
}

async function loadBoardOpsHubModule() {
    return loadModule('src/apps/queue-shared/turnero-release-board-ops-hub.js');
}

async function loadDecisionLogModule() {
    return loadModule('src/apps/queue-shared/turnero-release-decision-log.js');
}

async function loadActionRegisterModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-action-register.js'
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

    contains(node) {
        return node === this;
    }

    querySelector(selector) {
        return selector === '#queueReleaseOpsConsole' ? this : null;
    }
}

test('queueOpsPilot expone los hosts del control center, board ops y la consola de operaciones', async () => {
    const renderModule = await loadPilotRenderModule();
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;
    const root = new HTMLElementStub('queueOpsPilot');
    let capturedHtml = '';

    global.HTMLElement = HTMLElementStub;
    global.HTMLButtonElement = HTMLElementStub;
    global.document = {
        getElementById(id) {
            return id === 'queueOpsPilot' ? root : {};
        },
    };

    try {
        renderModule.renderQueueOpsPilotView(
            {
                turneroClinicProfile: buildClinicProfile(),
            },
            {
                name: 'desktop',
            },
            {
                buildQueueOpsPilot() {
                    return {
                        tone: 'ready',
                        eyebrow: 'Turnero V2',
                        title: 'Queue Ops Pilot',
                        summary: 'Pilot lista para montar hosts.',
                        supportCopy: 'Soporte listo.',
                        rolloutStations: [],
                        canonicalSurfaces: [
                            {
                                id: 'admin',
                                label: 'Admin basic',
                                route: '/admin.html#queue',
                                ready: true,
                                state: 'ready',
                                badge: 'Verificada',
                                detail: 'Ruta canónica verificada.',
                                url: '/admin.html#queue',
                            },
                            {
                                id: 'operator',
                                label: 'Operador web',
                                route: '/operador.html',
                                ready: true,
                                state: 'ready',
                                badge: 'Verificada',
                                detail: 'Ruta canónica verificada.',
                                url: '/operador.html',
                            },
                        ],
                        canonicalSupport: 'Fallback web listo.',
                        smokeSteps: [
                            {
                                id: 'admin',
                                label: 'Abrir admin basic',
                                state: 'ready',
                                ready: true,
                                detail: 'Admin abierto.',
                                href: '/admin.html#queue',
                                actionLabel: 'Abrir admin',
                            },
                            {
                                id: 'operator',
                                label: 'Operador web',
                                state: 'ready',
                                ready: true,
                                detail: 'Operador listo.',
                                href: '/operador.html',
                                actionLabel: 'Abrir operador',
                            },
                        ],
                        smokeState: 'ready',
                        smokeSummary: 'Secuencia repetible lista.',
                        smokeSupport: 'Usa la secuencia de apertura.',
                        smokeReadyCount: 2,
                        primaryAction: {
                            label: 'Abrir',
                            href: '#open',
                        },
                        secondaryAction: {
                            label: 'Ver',
                            href: '#view',
                        },
                        readinessState: 'ready',
                        readinessTitle: 'Readiness',
                        readinessSummary: 'Todo listo.',
                        readinessItems: [],
                        readinessSupport: 'Sin pendientes.',
                        readinessBlockingCount: 0,
                        goLiveIssueState: 'ready',
                        goLiveSummary: 'Sin bloqueos.',
                        goLiveIssues: [],
                        goLiveBlockingCount: 0,
                        handoffItems: [],
                        handoffSupport: 'Handoff listo.',
                        handoffSummary: 'Paquete listo.',
                        confirmedCount: 4,
                        suggestedCount: 0,
                        readyEquipmentCount: 3,
                        issueCount: 0,
                        totalSteps: 4,
                        progressPct: 100,
                    };
                },
                setHtml(_selector, html) {
                    capturedHtml = html;
                    root.innerHTML = html;
                },
                escapeHtml(value) {
                    return String(value ?? '');
                },
            }
        );

        assert.match(capturedHtml, /queueReleaseControlCenterHost/);
        assert.match(capturedHtml, /queueReleaseBoardOpsHubHost/);
        assert.match(capturedHtml, /queueReleaseOpsConsoleHost/);
        assert.match(capturedHtml, /queueReleaseMissionControlHost/);
        assert.match(capturedHtml, /queueOpsPilotRemoteReleaseHost/);
        assert.match(capturedHtml, /queueOpsPilotRolloutGovernorHost/);
        assert.match(
            capturedHtml,
            /queueOpsPilotStrategyDigitalTwinStudioHost/
        );
        assert.match(capturedHtml, /queueMultiClinicControlTowerHost/);
        assert.ok(
            capturedHtml.indexOf('queueOpsPilotRolloutGovernorHost') <
                capturedHtml.indexOf(
                    'queueOpsPilotExecutivePortfolioStudioHost'
                ) &&
                capturedHtml.indexOf(
                    'queueOpsPilotExecutivePortfolioStudioHost'
                ) <
                    capturedHtml.indexOf(
                        'queueOpsPilotStrategyDigitalTwinStudioHost'
                    ) &&
                capturedHtml.indexOf(
                    'queueOpsPilotStrategyDigitalTwinStudioHost'
                ) < capturedHtml.indexOf('queueMultiClinicControlTowerHost') &&
                capturedHtml.indexOf('queueMultiClinicControlTowerHost') <
                    capturedHtml.indexOf('queueReleaseBoardOpsHubHost') &&
                capturedHtml.indexOf('queueReleaseBoardOpsHubHost') <
                    capturedHtml.indexOf('queueReleaseOpsConsoleHost'),
            'el host strategy digital twin debe quedar entre executive portfolio y multi-clinic'
        );
    } finally {
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
    }
});

test('board ops hub monta secciones visibles y persiste decision log y action register por scope', async () => {
    const boardOpsHubModule = await loadBoardOpsHubModule();
    const decisionLogModule = await loadDecisionLogModule();
    const actionRegisterModule = await loadActionRegisterModule();
    const storage = createLocalStorageStub();
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;
    const host = new HTMLElementStub('queueReleaseBoardOpsHubHost');
    const pilot = {
        clinicId: 'clinica-demo',
        clinicName: 'Clínica Demo',
        region: 'regional',
        progressPct: 84,
        totalSteps: 4,
        confirmedCount: 3,
        valueScore: 81,
        readinessState: 'review',
        goLiveIssues: [
            {
                id: 'issue-1',
                title: 'Ajustar handoff',
                detail: 'Revisar el handoff regional antes de liberar.',
                owner: 'ops',
                severity: 'warning',
                source: 'pilot',
            },
        ],
        readinessItems: [
            {
                id: 'ready-1',
                title: 'Firmar validación',
                detail: 'Validación lista para cerrar.',
                owner: 'board',
                ready: true,
                state: 'ready',
                source: 'pilot',
            },
        ],
        handoffItems: [
            {
                id: 'handoff-1',
                label: 'Escalar a board',
                value: 'Aprobación requerida para el siguiente paso.',
                owner: 'board',
                status: 'requested',
                source: 'pilot',
            },
        ],
        clinicProfiles: [
            {
                clinicId: 'c1',
                label: 'Clínica 1',
                adoptionRate: 88,
                valueScore: 84,
                status: 'active',
            },
        ],
    };

    global.HTMLElement = HTMLElementStub;
    global.HTMLButtonElement = HTMLElementStub;
    global.document = {};

    const decisionStore =
        decisionLogModule.createTurneroReleaseDecisionLogStore('regional', {
            storage,
        });
    decisionStore.add({
        id: 'decision-1',
        title: 'Aprobar comité regional',
        owner: 'board',
        status: 'open',
        note: 'Decision persistida por scope.',
    });

    const actionStore = actionRegisterModule.createTurneroReleaseActionRegister(
        'regional',
        {
            storage,
        }
    );
    actionStore.add({
        id: 'action-1',
        title: 'Cerrar checklist regional',
        owner: 'ops',
        dueDate: '2026-04-01',
        status: 'open',
        severity: 'medium',
        note: 'Action persistida por scope.',
    });

    const mounted = boardOpsHubModule.mountTurneroReleaseBoardOpsHub(host, {
        pilot,
        clinicProfile: buildClinicProfile(),
        storage,
        scope: 'regional',
        region: 'regional',
        programName: 'Turnero Web por Clínica',
        clinics: pilot.clinicProfiles,
        incidents: pilot.goLiveIssues,
        approvals: pilot.handoffItems,
        kpis: {
            avgAdoption: 88,
            avgValue: 84,
            blockedIncidents: 1,
            pendingApprovals: 1,
        },
        value: {
            realizationPct: 84,
            valueScore: 84,
        },
        governance: {
            mode: 'review',
            decision: 'review',
        },
    });

    try {
        assert.equal(mounted, host);
        assert.equal(host.dataset.turneroReleaseBoardOpsHubScope, 'regional');
        assert.match(host.innerHTML, /queueReleaseBoardOpsHub/);
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubCopyAgendaBtn/);
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubCopyBriefBtn/);
        assert.match(
            host.innerHTML,
            /queueReleaseBoardOpsHubCopyActionPackBtn/
        );
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubDownloadJsonBtn/);
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubSteering/);
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubOkrCascade/);
        assert.match(
            host.innerHTML,
            /queueReleaseBoardOpsHubQuarterlyBusinessReview/
        );
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubProgramCharter/);
        assert.match(
            host.innerHTML,
            /queueReleaseBoardOpsHubGovernanceCalendar/
        );
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubDecisionLog/);
        assert.match(host.innerHTML, /queueReleaseBoardOpsHubActionRegister/);
        assert.match(host.innerHTML, /Aprobar comité regional/);
        assert.match(host.innerHTML, /Cerrar checklist regional/);
        assert.match(host.innerHTML, /Copiar agenda/);
        assert.match(host.innerHTML, /Copiar brief/);
        assert.match(host.innerHTML, /Copiar action pack/);

        const decisionStoreReloaded =
            decisionLogModule.createTurneroReleaseDecisionLogStore('regional', {
                storage,
            });
        const actionStoreReloaded =
            actionRegisterModule.createTurneroReleaseActionRegister(
                'regional',
                { storage }
            );

        assert.ok(
            decisionStoreReloaded
                .list()
                .some((entry) => entry.title === 'Aprobar comité regional')
        );
        assert.ok(
            actionStoreReloaded
                .list()
                .some((entry) => entry.title === 'Cerrar checklist regional')
        );
    } finally {
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

        delete host.__turneroReleaseBoardOpsHubRefresh;
        delete host.__turneroReleaseBoardOpsHubModel;
    }
});

test('la consola de operaciones imprime botones, handoff y bitácora dentro de queueOpsPilot', async () => {
    const consoleModule = await loadConsoleModule();
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;
    const host = new HTMLElementStub('releaseOpsConsoleHost');
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });

    global.HTMLElement = HTMLElementStub;
    global.HTMLButtonElement = HTMLElementStub;
    global.document = {};

    try {
        const mounted = consoleModule.mountTurneroReleaseOpsConsoleCard(host, {
            snapshot,
            clinicProfile: snapshot.turneroClinicProfile,
        });

        assert.equal(mounted, host);
        assert.ok(host.dataset.turneroReleaseOpsConsoleRequestId);
        assert.match(host.innerHTML, /queueReleaseOpsConsoleRefreshAllBtn/);
        assert.match(host.innerHTML, /queueReleaseOpsConsoleCopyHandoffBtn/);
        assert.match(host.innerHTML, /queueReleaseOpsConsoleJournal/);
        assert.match(host.innerHTML, /queueReleaseOpsConsoleJournalMarkdown/);
        assert.match(host.innerHTML, /queueReleaseOpsConsolePackJson/);
        assert.match(host.innerHTML, /admin_queue/);
        assert.match(host.innerHTML, /queueReleaseOpsConsoleOwnerBreakdown/);
    } finally {
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
    }
});
