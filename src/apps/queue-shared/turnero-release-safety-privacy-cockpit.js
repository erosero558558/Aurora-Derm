import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import {
    buildTurneroReleaseDataClassificationMatrix,
    normalizeTurneroReleaseSafetyPrivacySurface,
} from './turnero-release-data-classification-matrix.js';
import { createTurneroReleaseAccessReviewWorkbench } from './turnero-release-access-review-workbench.js';
import { buildTurneroReleaseSensitiveSurfaceMap } from './turnero-release-sensitive-surface-map.js';
import { buildTurneroReleaseClinicalSafetyGuardrails } from './turnero-release-clinical-safety-guardrails.js';
import { createTurneroReleasePrivacyObligationRegistry } from './turnero-release-privacy-obligation-registry.js';
import { createTurneroReleaseRetentionDisposalLedger } from './turnero-release-retention-disposal-ledger.js';
import { buildTurneroReleaseSafetyPrivacyScore } from './turnero-release-safety-privacy-score.js';

const DEFAULT_SURFACE_CATALOG = Object.freeze([
    {
        id: 'admin-queue',
        label: 'Admin Queue',
        flow: 'admin-queue',
        containsPII: true,
        containsClinicalSignals: false,
        containsQueueOps: true,
    },
    {
        id: 'operator-turnos',
        label: 'Operator Turnos',
        flow: 'operator-turnos',
        containsPII: true,
        containsClinicalSignals: false,
        containsQueueOps: true,
    },
    {
        id: 'kiosco-turnos',
        label: 'Kiosco Turnos',
        flow: 'kiosco-turnos',
        containsPII: false,
        containsClinicalSignals: false,
        containsQueueOps: true,
    },
    {
        id: 'sala-turnos',
        label: 'Sala Turnos',
        flow: 'sala-turnos',
        containsPII: false,
        containsClinicalSignals: false,
        containsQueueOps: true,
    },
    {
        id: 'figo-bridge',
        label: 'Figo Bridge',
        flow: 'figo-bridge',
        containsPII: true,
        containsClinicalSignals: true,
        containsQueueOps: true,
    },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof document === 'undefined') {
        return null;
    }

    if (typeof target === 'string') {
        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return isDomElement(target) ? target : null;
}

function normalizeScope(value) {
    return toText(value, 'regional');
}

function normalizeRegion(value) {
    return toText(value, 'regional');
}

function buildTurneroReleaseSafetyPrivacySurfaceCatalog(input = {}) {
    const surfaces = toArray(input.surfaces);
    const source = surfaces.length ? surfaces : DEFAULT_SURFACE_CATALOG;

    return source.map((surface, index) =>
        normalizeTurneroReleaseSafetyPrivacySurface(
            {
                id: surface.id || `surface-${index + 1}`,
                label: surface.label || `Surface ${index + 1}`,
                flow: surface.flow || surface.route || surface.channel,
                containsPII: surface.containsPII === true,
                containsClinicalSignals:
                    surface.containsClinicalSignals === true,
                containsQueueOps: surface.containsQueueOps !== false,
                note: surface.note || '',
            },
            index
        )
    );
}

function summarizeIncidents(incidents = []) {
    const rows = toArray(incidents).map((incident, index) => {
        const severity = String(
            incident?.severity ||
                incident?.state ||
                incident?.tone ||
                incident?.status ||
                'info'
        )
            .trim()
            .toLowerCase();

        return {
            id: toText(incident?.id || `incident-${index + 1}`),
            title: toText(
                incident?.title ||
                    incident?.label ||
                    incident?.name ||
                    incident?.summary ||
                    `Incident ${index + 1}`
            ),
            detail: toText(
                incident?.detail ||
                    incident?.note ||
                    incident?.reason ||
                    incident?.description ||
                    ''
            ),
            owner: toText(incident?.owner || 'ops', 'ops'),
            severity,
            state: severity,
            source: toText(incident?.source || 'journal', 'journal'),
            updatedAt: toText(
                incident?.updatedAt ||
                    incident?.createdAt ||
                    new Date().toISOString()
            ),
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            blocker: rows.filter((row) =>
                ['blocker', 'critical', 'alert', 'error'].includes(row.severity)
            ).length,
            warning: rows.filter((row) =>
                ['warning', 'watch', 'high', 'pending'].includes(row.severity)
            ).length,
            info: rows.filter(
                (row) =>
                    ![
                        'blocker',
                        'critical',
                        'alert',
                        'error',
                        'warning',
                        'watch',
                        'high',
                        'pending',
                    ].includes(row.severity)
            ).length,
        },
    };
}

function renderCountChip(label, value, tone = 'ready', id = '') {
    return `
        <span class="queue-app-card__tag" data-state="${escapeHtml(tone)}"${
            id ? ` id="${escapeHtml(id)}"` : ''
        }>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
        </span>
    `;
}

function renderSurfaceList(rows = []) {
    if (!rows.length) {
        return '<li data-state="normal">Sin superficies clasificadas todavía.</li>';
    }

    return rows
        .map(
            (row) => `
                <li data-state="${escapeHtml(row.exposure)}">
                    <strong>${escapeHtml(row.label)}</strong>
                    <span>${escapeHtml(row.classification)} · ${escapeHtml(
                        row.exposure
                    )} · ${escapeHtml(row.flow || row.id)}</span>
                </li>
            `
        )
        .join('');
}

function renderGuardrailList(rows = []) {
    if (!rows.length) {
        return '<li data-state="pass">Sin guardrails definidos.</li>';
    }

    return rows
        .map(
            (row) => `
                <li data-state="${escapeHtml(row.state)}">
                    <strong>${escapeHtml(row.label)}</strong>
                    <span>${escapeHtml(row.detail || '')}</span>
                </li>
            `
        )
        .join('');
}

function renderIncidentList(rows = []) {
    if (!rows.length) {
        return '<li data-state="info">Sin incidentes en el journal de esta clínica.</li>';
    }

    return rows
        .slice(0, 5)
        .map(
            (row) => `
                <li data-state="${escapeHtml(row.severity)}">
                    <strong>${escapeHtml(row.title)}</strong>
                    <span>${escapeHtml(row.detail || row.source)} · ${escapeHtml(
                        row.severity
                    )} · ${escapeHtml(row.owner)}</span>
                </li>
            `
        )
        .join('');
}

export function privacyBriefToMarkdown(pack = {}) {
    const lines = [
        '# Safety Privacy Cockpit',
        '',
        `Scope: ${pack.scope || 'regional'}`,
        `Region: ${pack.region || pack.scope || 'regional'}`,
        `Clinic: ${pack.clinicId || 'default-clinic'}`,
        `Generated: ${pack.generatedAt || ''}`,
        `Score: ${pack.score?.score ?? 0} (${pack.score?.band || 'n/a'})`,
        `Decision: ${pack.score?.decision || 'review'}`,
        `Restricted surfaces: ${pack.matrix?.summary?.restricted ?? 0}`,
        `Controlled surfaces: ${pack.matrix?.summary?.controlled ?? 0}`,
        `Internal surfaces: ${pack.matrix?.summary?.internal ?? 0}`,
        `Public surfaces: ${pack.matrix?.summary?.public ?? 0}`,
        `Open privacy obligations: ${
            toArray(pack.obligations).filter(
                (item) =>
                    String(item?.status || '')
                        .trim()
                        .toLowerCase() !== 'closed'
            ).length
        }`,
        `Pending access reviews: ${
            toArray(pack.accessReviews).filter(
                (item) =>
                    String(item?.status || '')
                        .trim()
                        .toLowerCase() !== 'approved'
            ).length
        }`,
        `Tracked retention items: ${
            toArray(pack.retention).filter(
                (item) =>
                    String(item?.state || '')
                        .trim()
                        .toLowerCase() === 'tracked'
            ).length
        }`,
        `Incidents: ${pack.incidentSummary?.summary?.blocker || 0} blocker / ${pack.incidentSummary?.summary?.warning || 0} warning / ${pack.incidentSummary?.summary?.info || 0} info`,
        '',
        '## Guardrails',
        ...toArray(pack.guardrails?.guardrails).map(
            (item) => `- [${item.state}] ${item.label} — ${item.detail || ''}`
        ),
        '',
        '## Sensitive surfaces',
        ...toArray(pack.sensitiveMap?.rows).map(
            (item) =>
                `- [${item.state}] ${item.label} — ${item.classification} (${item.exposure})`
        ),
    ];

    return lines.join('\n').trim();
}

export function buildTurneroReleaseSafetyPrivacyCockpitPack(input = {}) {
    const scope = normalizeScope(input.scope || input.region || 'regional');
    const region = normalizeRegion(input.region || scope || 'regional');
    const clinicId = toText(
        input.clinicId ||
            input.clinicProfile?.clinic_id ||
            input.clinicProfile?.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const surfaces = buildTurneroReleaseSafetyPrivacySurfaceCatalog(input);
    const incidentSummaryInput = summarizeIncidents(input.incidents);
    const incidents = incidentSummaryInput.rows;
    const obligationRegistry =
        createTurneroReleasePrivacyObligationRegistry(scope);
    const accessWorkbench = createTurneroReleaseAccessReviewWorkbench(scope);
    const retentionLedger = createTurneroReleaseRetentionDisposalLedger(scope);
    const matrix = buildTurneroReleaseDataClassificationMatrix({ surfaces });
    const sensitiveMap = buildTurneroReleaseSensitiveSurfaceMap({
        matrixRows: matrix.rows,
    });
    const obligations = obligationRegistry.list();
    const accessReviews = accessWorkbench.list();
    const retention = retentionLedger.list();
    const guardrails = buildTurneroReleaseClinicalSafetyGuardrails({
        incidents,
        sensitiveSurfaces: sensitiveMap.rows,
        obligations,
        accessReviews,
        retention,
    });
    const score = buildTurneroReleaseSafetyPrivacyScore({
        matrixSummary: matrix.summary,
        obligations,
        accessReviews,
        guardrailSummary: guardrails.summary,
        retention,
    });
    const incidentSummary = summarizeIncidents(incidents);
    const generatedAt = new Date().toISOString();

    return {
        scope,
        region,
        clinicId,
        clinicProfile: input.clinicProfile || null,
        surfaces,
        incidents,
        incidentSummary,
        matrix,
        sensitiveMap,
        obligations,
        accessReviews,
        retention,
        guardrails,
        score,
        generatedAt,
        snapshotFileName: 'turnero-release-safety-privacy-pack.json',
        briefMarkdown: privacyBriefToMarkdown({
            scope,
            region,
            clinicId,
            generatedAt,
            matrix,
            sensitiveMap,
            obligations,
            accessReviews,
            retention,
            guardrails,
            score,
            incidentSummary,
        }),
    };
}

export function renderTurneroReleaseSafetyPrivacyCockpitHtml(pack = {}) {
    const summaryText = [
        `Scope ${pack.scope || 'regional'}`,
        `Clinic ${pack.clinicId || 'default-clinic'}`,
        `${pack.surfaces?.length || 0} surface(s)`,
        `${pack.incidentSummary?.summary?.all || 0} incident(s)`,
    ].join(' · ');
    const generatedAtLabel = pack.generatedAt
        ? formatDateTime(pack.generatedAt)
        : 'sin fecha';

    return `
        <p class="queue-app-card__eyebrow">Safety / Privacy</p>
        <h3 class="queue-app-card__title" id="turneroReleaseSafetyPrivacyCockpitTitle">
            Safety Privacy Cockpit
        </h3>
        <p class="queue-app-card__description" id="turneroReleaseSafetyPrivacyCockpitSummary">
            Custodia de datos, privacidad y guardrails clínicos para sostener el rollout multi-clínica.
        </p>
        <p class="queue-app-card__meta" id="turneroReleaseSafetyPrivacyCockpitMeta">
            ${escapeHtml(summaryText)} · Actualizado ${escapeHtml(generatedAtLabel)}
        </p>
        <div class="queue-app-card__targets" id="turneroReleaseSafetyPrivacyCockpitStats">
            ${renderCountChip('Score', String(pack.score?.score ?? 0), pack.score?.band || 'ready', 'turneroReleaseSafetyPrivacyCockpitScoreChip')}
            ${renderCountChip('Band', pack.score?.band || 'n/a', pack.score?.band || 'ready', 'turneroReleaseSafetyPrivacyCockpitBandChip')}
            ${renderCountChip('Decision', pack.score?.decision || 'review', pack.score?.decision || 'ready', 'turneroReleaseSafetyPrivacyCockpitDecisionChip')}
            ${renderCountChip('Restricted', String(pack.matrix?.summary?.restricted ?? 0), 'alert', 'turneroReleaseSafetyPrivacyCockpitRestrictedChip')}
            ${renderCountChip(
                'Open obligations',
                String(
                    toArray(pack.obligations).filter(
                        (item) =>
                            String(item?.status || '')
                                .trim()
                                .toLowerCase() !== 'closed'
                    ).length
                ),
                'warning',
                'turneroReleaseSafetyPrivacyCockpitObligationChip'
            )}
            ${renderCountChip(
                'Pending reviews',
                String(
                    toArray(pack.accessReviews).filter(
                        (item) =>
                            String(item?.status || '')
                                .trim()
                                .toLowerCase() !== 'approved'
                    ).length
                ),
                'warning',
                'turneroReleaseSafetyPrivacyCockpitAccessReviewChip'
            )}
            ${renderCountChip(
                'Retention',
                String(
                    toArray(pack.retention).filter(
                        (item) =>
                            String(item?.state || '')
                                .trim()
                                .toLowerCase() === 'tracked'
                    ).length
                ),
                'ready',
                'turneroReleaseSafetyPrivacyCockpitRetentionChip'
            )}
            ${renderCountChip('Incidents', String(pack.incidentSummary?.summary?.all || 0), pack.incidentSummary?.summary?.blocker ? 'alert' : 'ready', 'turneroReleaseSafetyPrivacyCockpitIncidentChip')}
        </div>
        <div class="queue-app-card__actions" id="turneroReleaseSafetyPrivacyCockpitActions">
            <button
                type="button"
                id="turneroReleaseSafetyPrivacyCockpitCopyPrivacyBriefBtn"
                data-action="copy-privacy-brief"
                class="queue-app-card__cta-primary"
            >
                Copy privacy brief
            </button>
            <button
                type="button"
                id="turneroReleaseSafetyPrivacyCockpitDownloadJsonBtn"
                data-action="download-safety-privacy-pack"
            >
                Download safety/privacy JSON
            </button>
        </div>
        <div class="turnero-release-safety-privacy-cockpit__workbench">
            <div class="turnero-release-safety-privacy-cockpit__panel">
                <p class="queue-app-card__eyebrow">Privacy obligation registry</p>
                <div class="turnero-release-safety-privacy-cockpit__fields">
                    <label>
                        <span>Title</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitObligationTitle" data-field="privacy-obligation-title" type="text" placeholder="Obligation title" />
                    </label>
                    <label>
                        <span>Owner</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitObligationOwner" data-field="privacy-obligation-owner" type="text" placeholder="governance" />
                    </label>
                    <label>
                        <span>Due date</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitObligationDueDate" data-field="privacy-obligation-due-date" type="text" placeholder="2026-03-20" />
                    </label>
                </div>
                <button type="button" id="turneroReleaseSafetyPrivacyCockpitAddObligationBtn" data-action="add-obligation">
                    Add obligation
                </button>
            </div>
            <div class="turnero-release-safety-privacy-cockpit__panel">
                <p class="queue-app-card__eyebrow">Access review workbench</p>
                <div class="turnero-release-safety-privacy-cockpit__fields">
                    <label>
                        <span>Subject</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitAccessSubject" data-field="access-review-subject" type="text" placeholder="Access review subject" />
                    </label>
                    <label>
                        <span>Owner</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitAccessOwner" data-field="access-review-owner" type="text" placeholder="security" />
                    </label>
                    <label>
                        <span>Clinic</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitAccessClinicId" data-field="access-review-clinic-id" type="text" placeholder="regional" />
                    </label>
                </div>
                <button type="button" id="turneroReleaseSafetyPrivacyCockpitAddAccessReviewBtn" data-action="add-access-review">
                    Add access review
                </button>
            </div>
            <div class="turnero-release-safety-privacy-cockpit__panel">
                <p class="queue-app-card__eyebrow">Retention ledger</p>
                <div class="turnero-release-safety-privacy-cockpit__fields">
                    <label>
                        <span>Label</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitRetentionLabel" data-field="retention-label" type="text" placeholder="Retention item" />
                    </label>
                    <label>
                        <span>Owner</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitRetentionOwner" data-field="retention-owner" type="text" placeholder="governance" />
                    </label>
                    <label>
                        <span>Rule</span>
                        <input id="turneroReleaseSafetyPrivacyCockpitRetentionRule" data-field="retention-rule" type="text" placeholder="90 days" />
                    </label>
                </div>
                <button type="button" id="turneroReleaseSafetyPrivacyCockpitAddRetentionItemBtn" data-action="add-retention-item">
                    Add retention item
                </button>
            </div>
        </div>
        <div class="turnero-release-safety-privacy-cockpit__lists">
            <section class="turnero-release-safety-privacy-cockpit__list">
                <p class="queue-app-card__eyebrow">Data classification</p>
                <ul id="turneroReleaseSafetyPrivacyCockpitMatrix" class="queue-app-card__notes">
                    ${renderSurfaceList(pack.matrix?.rows)}
                </ul>
            </section>
            <section class="turnero-release-safety-privacy-cockpit__list">
                <p class="queue-app-card__eyebrow">Sensitive surface map</p>
                <ul id="turneroReleaseSafetyPrivacyCockpitSensitiveMap" class="queue-app-card__notes">
                    ${(pack.sensitiveMap?.rows || [])
                        .map(
                            (row) => `
                                <li data-state="${escapeHtml(row.state)}">
                                    <strong>${escapeHtml(row.label)}</strong>
                                    <span>${escapeHtml(row.sensitivity)} · ${escapeHtml(
                                        row.state
                                    )} · ${escapeHtml(row.classification)}</span>
                                </li>
                            `
                        )
                        .join('')}
                </ul>
            </section>
            <section class="turnero-release-safety-privacy-cockpit__list">
                <p class="queue-app-card__eyebrow">Clinical guardrails</p>
                <ul id="turneroReleaseSafetyPrivacyCockpitGuardrails" class="queue-app-card__notes">
                    ${renderGuardrailList(pack.guardrails?.guardrails)}
                </ul>
            </section>
            <section class="turnero-release-safety-privacy-cockpit__list">
                <p class="queue-app-card__eyebrow">Incident journal</p>
                <ul id="turneroReleaseSafetyPrivacyCockpitIncidents" class="queue-app-card__notes">
                    ${renderIncidentList(pack.incidentSummary?.rows)}
                </ul>
            </section>
        </div>
        <pre class="queue-app-card__notes" id="turneroReleaseSafetyPrivacyCockpitPrivacyBrief">${escapeHtml(
            pack.briefMarkdown || privacyBriefToMarkdown(pack)
        )}</pre>
    `;
}

function readFieldValue(root, selector) {
    return toText(root.querySelector(selector)?.value || '');
}

function syncPack(pack, nextPack) {
    Object.keys(pack).forEach((key) => {
        delete pack[key];
    });
    Object.assign(pack, nextPack);
    return pack;
}

function syncRootDataset(root, pack) {
    root.dataset.scope = pack.scope || 'regional';
    root.dataset.region = pack.region || pack.scope || 'regional';
    root.dataset.clinicId = pack.clinicId || 'default-clinic';
    root.dataset.score = String(pack.score?.score ?? 0);
    root.dataset.band = String(pack.score?.band || 'n/a');
    root.dataset.decision = String(pack.score?.decision || 'review');
    root.dataset.obligations = String(
        toArray(pack.obligations).filter(
            (item) =>
                String(item?.status || '')
                    .trim()
                    .toLowerCase() !== 'closed'
        ).length
    );
    root.dataset.accessReviews = String(
        toArray(pack.accessReviews).filter(
            (item) =>
                String(item?.status || '')
                    .trim()
                    .toLowerCase() !== 'approved'
        ).length
    );
    root.dataset.retention = String(
        toArray(pack.retention).filter(
            (item) =>
                String(item?.state || '')
                    .trim()
                    .toLowerCase() === 'tracked'
        ).length
    );
    root.dataset.incidents = String(pack.incidentSummary?.summary?.all || 0);
}

function updateRenderedRoot(root, pack) {
    root.innerHTML = renderTurneroReleaseSafetyPrivacyCockpitHtml(pack);
    syncRootDataset(root, pack);
}

export function mountTurneroReleaseSafetyPrivacyCockpit(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const pack = buildTurneroReleaseSafetyPrivacyCockpitPack(input);
    const root = document.createElement('section');
    root.id = 'turneroReleaseSafetyPrivacyCockpit';
    root.className = 'queue-app-card turnero-release-safety-privacy-cockpit';
    updateRenderedRoot(root, pack);
    host.innerHTML = '';
    host.appendChild(root);
    host.dataset.turneroReleaseSafetyPrivacyCockpit = 'mounted';
    host.dataset.turneroReleaseSafetyPrivacyClinicId =
        pack.clinicId || 'default-clinic';
    host.dataset.turneroReleaseSafetyPrivacyScope = pack.scope || 'regional';
    host.dataset.turneroReleaseSafetyPrivacyRegion =
        pack.region || pack.scope || 'regional';
    host.dataset.turneroReleaseSafetyPrivacyScore = String(
        pack.score?.score ?? 0
    );
    host.dataset.turneroReleaseSafetyPrivacyDecision = String(
        pack.score?.decision || 'review'
    );
    root.__turneroReleaseSafetyPrivacyCockpitPack = pack;

    const refresh = () => {
        const nextPack = buildTurneroReleaseSafetyPrivacyCockpitPack(input);
        syncPack(pack, nextPack);
        updateRenderedRoot(root, pack);
        root.__turneroReleaseSafetyPrivacyCockpitPack = pack;
        host.dataset.turneroReleaseSafetyPrivacyScore = String(
            pack.score?.score ?? 0
        );
        host.dataset.turneroReleaseSafetyPrivacyDecision = String(
            pack.score?.decision || 'review'
        );
        host.dataset.turneroReleaseSafetyPrivacyScope =
            pack.scope || 'regional';
        host.dataset.turneroReleaseSafetyPrivacyRegion =
            pack.region || pack.scope || 'regional';
        host.dataset.turneroReleaseSafetyPrivacyClinicId =
            pack.clinicId || 'default-clinic';
        return pack;
    };

    root.addEventListener('click', async (event) => {
        const actionNode = event?.target?.closest?.('[data-action]');
        if (!actionNode) {
            return;
        }

        const action = String(
            actionNode.getAttribute('data-action') || ''
        ).trim();
        if (!action) {
            return;
        }

        if (action === 'copy-privacy-brief') {
            await copyToClipboardSafe(
                pack.briefMarkdown || privacyBriefToMarkdown(pack)
            );
            return;
        }

        if (action === 'download-safety-privacy-pack') {
            downloadJsonSnapshot(pack.snapshotFileName, pack);
            return;
        }

        if (action === 'add-obligation') {
            const title = readFieldValue(
                root,
                '[data-field="privacy-obligation-title"]'
            );
            if (!title) {
                return;
            }
            createTurneroReleasePrivacyObligationRegistry(pack.scope).add({
                title,
                owner:
                    readFieldValue(
                        root,
                        '[data-field="privacy-obligation-owner"]'
                    ) || 'governance',
                dueDate: readFieldValue(
                    root,
                    '[data-field="privacy-obligation-due-date"]'
                ),
                clinicId: pack.clinicId,
                status: 'open',
            });
            refresh();
            return;
        }

        if (action === 'add-access-review') {
            const subject = readFieldValue(
                root,
                '[data-field="access-review-subject"]'
            );
            if (!subject) {
                return;
            }
            createTurneroReleaseAccessReviewWorkbench(pack.scope).add({
                subject,
                owner:
                    readFieldValue(
                        root,
                        '[data-field="access-review-owner"]'
                    ) || 'security',
                clinicId:
                    readFieldValue(
                        root,
                        '[data-field="access-review-clinic-id"]'
                    ) ||
                    pack.region ||
                    pack.scope,
                role: 'operator',
                status: 'pending',
            });
            refresh();
            return;
        }

        if (action === 'add-retention-item') {
            const label = readFieldValue(
                root,
                '[data-field="retention-label"]'
            );
            if (!label) {
                return;
            }
            createTurneroReleaseRetentionDisposalLedger(pack.scope).add({
                label,
                owner:
                    readFieldValue(root, '[data-field="retention-owner"]') ||
                    'governance',
                retentionRule: readFieldValue(
                    root,
                    '[data-field="retention-rule"]'
                ),
                clinicId: pack.clinicId,
                category: 'operational',
                state: 'tracked',
            });
            refresh();
        }
    });

    return {
        root,
        pack,
        recompute: refresh,
    };
}

export {
    buildTurneroReleaseClinicalSafetyGuardrails,
    buildTurneroReleaseDataClassificationMatrix,
    buildTurneroReleaseSafetyPrivacySurfaceCatalog,
    buildTurneroReleaseSensitiveSurfaceMap,
    buildTurneroReleaseSafetyPrivacyScore,
    createTurneroReleaseAccessReviewWorkbench,
    createTurneroReleasePrivacyObligationRegistry,
    createTurneroReleaseRetentionDisposalLedger,
};

export default mountTurneroReleaseSafetyPrivacyCockpit;
