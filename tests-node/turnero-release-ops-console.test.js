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

async function loadPilotRenderModule() {
    return loadModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/pilot/render.js'
    );
}

async function loadConsoleModule() {
    return loadModule('src/apps/queue-shared/turnero-release-ops-console.js');
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

test('queueOpsPilot expone los hosts del control center y la consola de operaciones', async () => {
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
        assert.match(capturedHtml, /queueReleaseOpsConsoleHost/);
        assert.match(capturedHtml, /queueOpsPilotRemoteReleaseHost/);
        assert.match(capturedHtml, /queueOpsPilotRolloutGovernorHost/);
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
