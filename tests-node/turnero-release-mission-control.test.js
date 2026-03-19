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

async function loadMissionControlModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-mission-control.js'
    );
}

async function loadFreezeRegistryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-freeze-window-registry.js'
    );
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

    getAttribute(name) {
        const value = this.attributes.get(String(name));
        return value === undefined ? null : value;
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener() {}
}

test('mountTurneroReleaseMissionControlCard imprime el panel principal y los CTAs', async () => {
    const module = await loadMissionControlModule();
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;
    const host = new HTMLElementStub('missionControlHost');
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
        const mounted = module.mountTurneroReleaseMissionControlCard(host, {
            snapshot,
            releaseWarRoomSnapshot: {
                decision: 'ready',
                summary: 'War room listo.',
                boardMarkdown: '# War room',
            },
            clinicId: snapshot.clinicId,
            storage: createLocalStorageStub(),
        });

        assert.equal(mounted, host);
        assert.ok(host.dataset.turneroReleaseMissionControlRequestId);
        assert.match(host.innerHTML, /queueReleaseMissionControl/);
        assert.match(host.innerHTML, /Progressive Delivery Mission Control/);
        assert.match(host.innerHTML, /queueReleaseMissionControlCopyBriefBtn/);
        assert.match(
            host.innerHTML,
            /queueReleaseMissionControlSaveFreezeWindowsBtn/
        );
        assert.match(host.innerHTML, /queueReleaseMissionControlWave_wave-0/);
        assert.match(host.innerHTML, /queueReleaseMissionControlPackJson/);
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

test('createReleaseMissionControlActions guarda y actualiza freeze windows en localStorage', async () => {
    const module = await loadMissionControlModule();
    const registryModule = await loadFreezeRegistryModule();
    const storage = createLocalStorageStub();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile(),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });

    const actions = module.createReleaseMissionControlActions({
        snapshot,
        releaseWarRoomSnapshot: {
            decision: 'review',
            summary: 'War room en revisión.',
        },
        storage,
    });

    const saved = actions.saveFreezeWindows([
        {
            id: 'freeze-night',
            waveId: 'wave-2',
            label: 'Bloqueo nocturno',
            startAt: '2026-03-18T20:00:00.000Z',
            endAt: '2026-03-18T22:00:00.000Z',
            owner: 'deploy',
            reason: 'Ventana de despliegue',
            status: 'active',
            notes: 'QA listo.',
        },
    ]);

    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].id, 'freeze-night');
    assert.equal(saved.items[0].status, 'active');

    const registry = registryModule.readTurneroReleaseFreezeWindowRegistry(
        snapshot.clinicId,
        { storage }
    );

    assert.equal(registry.items.length, 1);
    assert.equal(registry.items[0].label, 'Bloqueo nocturno');
    assert.equal(registry.items[0].waveId, 'wave-2');
    assert.match(registry.markdown, /Bloqueo nocturno/);
});
