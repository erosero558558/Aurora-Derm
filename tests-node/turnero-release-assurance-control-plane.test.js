'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadAssuranceModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-assurance-control-plane.js'
    );
}

async function loadAuditStoreModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-audit-trail-store.js'
    );
}

async function loadPolicyRegistryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-policy-exception-registry.js'
    );
}

class StubElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.queryNodes = new Map();
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.className = '';
        this._innerHTML = '';
        this.parentNode = null;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.queryNodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const key = String(name);
        const normalized = String(value);
        this.attributes.set(key, normalized);
        if (key.startsWith('data-')) {
            const datasetKey = key
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalized;
        }
    }

    getAttribute(name) {
        const key = String(name);
        if (this.attributes.has(key)) {
            return this.attributes.get(key);
        }
        return null;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
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
        const key = String(selector);
        if (!this.queryNodes.has(key)) {
            const node = new StubElement('span');
            if (key.includes('[data-field=')) {
                node.value = '';
            } else if (key.includes('[data-role=') || key.startsWith('#')) {
                node.textContent = '';
            }
            this.queryNodes.set(key, node);
        }
        return this.queryNodes.get(key);
    }

    querySelectorAll() {
        return [];
    }

    focus() {}

    select() {}

    click() {
        if (typeof this.onclick === 'function') {
            this.onclick();
        }
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
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

function createDocumentStub(downloadClicks) {
    const body = new StubElement('body');
    body.appendChild = (node) => {
        body.children.push(node);
        node.parentNode = body;
        return node;
    };

    return {
        body,
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
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
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

test('assurance builders resumen evidencia, gates, certificacion y scorecard', async () => {
    const module = await loadAssuranceModule();

    const evidence = module.buildTurneroReleaseEvidenceLedger({
        clinicId: 'clinica-demo',
        evidence: [
            {
                id: 'ev-profile',
                label: 'Clinic profile',
                owner: 'frontend',
                kind: 'profile',
                status: 'captured',
            },
            {
                id: 'ev-governance',
                label: 'Governance pack',
                owner: 'deploy',
                kind: 'governance',
                status: 'missing',
            },
            {
                id: 'ev-board',
                label: 'Board ops',
                owner: 'program',
                kind: 'board-ops',
                status: 'stale',
            },
        ],
    });

    assert.equal(evidence.rows.length, 3);
    assert.equal(evidence.totals.captured, 1);
    assert.equal(evidence.totals.missing, 1);
    assert.equal(evidence.totals.stale, 1);

    const controls = module.buildTurneroReleaseControlLibrary({
        controls: [
            { key: 'canon', label: 'Canon', owner: 'frontend', state: 'pass' },
            { key: 'risk', label: 'Risk', owner: 'ops', state: 'watch' },
            { key: 'review', label: 'Review', owner: 'deploy', state: 'fail' },
        ],
    });

    assert.equal(controls.summary.all, 3);
    assert.equal(controls.summary.pass, 1);
    assert.equal(controls.summary.watch, 1);
    assert.equal(controls.summary.fail, 1);

    const gates = module.buildTurneroReleaseStageGateAuditor({
        incidents: [{ severity: 'critical' }],
        complianceStatus: 'red',
        riskGrade: 'D',
        controlSummary: controls.summary,
        evidenceTotals: evidence.totals,
    });

    assert.equal(gates.gates.length, 3);
    assert.ok(gates.gates.every((gate) => gate.state === 'fail'));

    const certification = module.buildTurneroReleaseReadinessCertification({
        stageGates: gates.gates,
        evidenceTotals: evidence.totals,
        exceptions: [{ status: 'open' }],
    });

    assert.equal(certification.status, 'not_certified');
    assert.match(
        module.readinessCertificationToMarkdown(certification),
        /# Readiness Certification/
    );

    const scorecard = module.buildTurneroReleaseAssuranceScorecard({
        controlSummary: {
            pass: 2,
            watch: 1,
            fail: 1,
            all: 4,
        },
        evidenceTotals: evidence.totals,
        exceptions: [{ status: 'open' }],
    });

    assert.equal(scorecard.score, 53);
    assert.equal(scorecard.grade, 'D');
    assert.equal(scorecard.decision, 'review');
});

test('audit trail y policy exceptions persisten por scope en localStorage', async () => {
    const auditModule = await loadAuditStoreModule();
    const policyModule = await loadPolicyRegistryModule();
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const auditStore =
            auditModule.createTurneroReleaseAuditTrailStore('regional');
        auditStore.clear();
        assert.equal(auditStore.list().length, 0);

        const auditEntry = auditStore.add({
            action: 'review',
            actor: 'qa',
            note: 'Initial audit',
        });

        assert.equal(auditEntry.action, 'review');
        assert.equal(auditStore.list().length, 1);

        const policyStore =
            policyModule.createTurneroReleasePolicyExceptionRegistry(
                'regional'
            );
        policyStore.clear();
        assert.equal(policyStore.list().length, 0);

        const policyEntry = policyStore.add({
            title: 'Temporary exception',
            owner: 'program',
            rationale: 'Waiting for signoff',
            expiresAt: '2026-03-19',
        });

        assert.equal(policyEntry.title, 'Temporary exception');
        assert.equal(policyStore.list().length, 1);

        auditStore.clear();
        policyStore.clear();
        assert.equal(auditStore.list().length, 0);
        assert.equal(policyStore.list().length, 0);
    });
});

test('mountTurneroReleaseAssuranceControlPlane monta el host, copia brief y descarga JSON', async () => {
    const module = await loadAssuranceModule();
    const clipboardTexts = [];
    const downloadClicks = [];
    const downloadEvents = [];
    const storage = createLocalStorageStub();
    const host = new StubElement(
        'div',
        'queueReleaseAssuranceControlPlaneHost'
    );
    const documentStub = createDocumentStub(downloadClicks);

    await withGlobals(
        {
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            localStorage: storage,
            navigator: {
                clipboard: {
                    async writeText(text) {
                        clipboardTexts.push(String(text));
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
                    return 'blob:turnero-assurance';
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
            document: documentStub,
        },
        async () => {
            const result = module.mountTurneroReleaseAssuranceControlPlane(
                host,
                {
                    scope: 'regional',
                    region: 'regional',
                    clinicId: 'clinica-demo',
                    clinicLabel: 'Clínica Demo',
                    clinicProfile: buildClinicProfile({
                        clinic_id: 'clinica-demo',
                    }),
                    incidents: [
                        {
                            id: 'incident-1',
                            label: 'Public sync drift',
                            severity: 'warning',
                            state: 'warning',
                            owner: 'deploy',
                        },
                    ],
                    governancePack: {
                        compliance: {
                            status: 'amber',
                        },
                        risks: {
                            grade: 'B',
                        },
                    },
                    boardOpsPack: {
                        title: 'Board ops brief',
                    },
                    evidence: [
                        {
                            id: 'ev-profile',
                            label: 'Clinic profile snapshot',
                            owner: 'frontend',
                            kind: 'profile',
                            status: 'captured',
                            clinicId: 'clinica-demo',
                        },
                        {
                            id: 'ev-governance',
                            label: 'Governance pack',
                            owner: 'deploy',
                            kind: 'governance',
                            status: 'stale',
                            clinicId: 'clinica-demo',
                        },
                    ],
                    controls: [
                        {
                            key: 'clinic-profile-canon',
                            label: 'Clinic profile canon',
                            owner: 'frontend',
                            state: 'pass',
                        },
                        {
                            key: 'governance-pack',
                            label: 'Governance pack',
                            owner: 'deploy',
                            state: 'watch',
                        },
                    ],
                    complianceStatus: 'amber',
                    riskGrade: 'B',
                }
            );

            assert.ok(result);
            assert.equal(host.children.length, 1);
            assert.equal(result.root.id, 'queueReleaseAssuranceControlPlane');
            assert.equal(result.pack.evidence.totals.all, 2);
            assert.equal(result.pack.controls.summary.watch, 1);
            assert.equal(result.pack.stageGates.gates.length, 3);
            assert.equal(result.pack.certification.status, 'conditional');
            assert.match(result.root.innerHTML, /Assurance Control Plane/);
            assert.match(result.root.innerHTML, /Copy certification brief/);
            assert.match(result.root.innerHTML, /Download assurance JSON/);

            const clickHandler = result.root.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: createActionTarget('copy-certification-brief'),
            });
            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Readiness Certification/);

            await clickHandler({
                target: createActionTarget('download-assurance-json'),
            });
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-assurance-pack.json'
            );
            assert.ok(downloadEvents.some((entry) => entry.kind === 'blob'));
            assert.ok(downloadEvents.some((entry) => entry.kind === 'url'));

            const auditActionNode = result.root.querySelector(
                '[data-field="audit-action"]'
            );
            const auditActorNode = result.root.querySelector(
                '[data-field="audit-actor"]'
            );
            const auditNoteNode = result.root.querySelector(
                '[data-field="audit-note"]'
            );
            auditActionNode.value = 'manual-review';
            auditActorNode.value = 'qa';
            auditNoteNode.value = 'Initial audit note';

            await clickHandler({
                target: createActionTarget('add-audit-entry'),
            });

            assert.ok(result.pack.auditTrail.length >= 1);

            const exceptionTitleNode = result.root.querySelector(
                '[data-field="exception-title"]'
            );
            const exceptionOwnerNode = result.root.querySelector(
                '[data-field="exception-owner"]'
            );
            const exceptionExpiryNode = result.root.querySelector(
                '[data-field="exception-expiry"]'
            );
            const exceptionRationaleNode = result.root.querySelector(
                '[data-field="exception-rationale"]'
            );
            exceptionTitleNode.value = 'Temporary exception';
            exceptionOwnerNode.value = 'program';
            exceptionExpiryNode.value = '2026-03-19';
            exceptionRationaleNode.value = 'Waiting for signoff';

            await clickHandler({
                target: createActionTarget('add-policy-exception'),
            });

            assert.ok(result.pack.exceptions.length >= 1);
            assert.equal(
                result.root.querySelector('[data-role="open-exceptions"]')
                    .textContent,
                '1'
            );
            assert.equal(
                result.root.querySelector('[data-role="audit-entries"]')
                    .textContent,
                '1'
            );
            assert.match(
                result.root.querySelector('[data-role="assurance-brief"]')
                    .textContent,
                /Assurance Control Plane/
            );
        }
    );
});
