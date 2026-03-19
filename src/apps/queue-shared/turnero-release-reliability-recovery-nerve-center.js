import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import { buildTurneroReleaseDependencyImpactMap } from './turnero-release-dependency-impact-map.js';
import { createTurneroReleaseFailoverDrillRegistry } from './turnero-release-failover-drill-registry.js';
import { createTurneroReleasePostmortemWorkspace } from './turnero-release-postmortem-workspace.js';
import { createTurneroReleaseRecoveryCheckpointJournal } from './turnero-release-recovery-checkpoint-journal.js';
import { buildTurneroReleaseResilienceScore } from './turnero-release-resilience-score.js';
import {
    buildTurneroReleaseRollbackCommandPack,
    rollbackCommandPackToMarkdown,
} from './turnero-release-rollback-command-pack.js';
import { buildTurneroReleaseOutageTaxonomy } from './turnero-release-outage-taxonomy.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const DEFAULT_DEPENDENCIES = Object.freeze([
    { key: 'health', label: 'Remote health', owner: 'infra', baseRisk: 35 },
    { key: 'publicSync', label: 'Public sync', owner: 'web', baseRisk: 28 },
    { key: 'figo', label: 'Clinical backend', owner: 'backend', baseRisk: 32 },
    { key: 'shell', label: 'Public shell', owner: 'frontend', baseRisk: 22 },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.getElementById(target) || document.querySelector(target)
        );
    }

    return target;
}

function cloneDependencies(dependencies) {
    return dependencies.map((item) => ({ ...item }));
}

function getClinicProfile(input = {}) {
    return (
        asObject(input.clinicProfile) ||
        asObject(input.assurancePack?.clinicProfile) ||
        {}
    );
}

function resolveScope(input = {}) {
    const clinicProfile = getClinicProfile(input);
    return (
        toText(
            input.scope ||
                input.region ||
                clinicProfile.region ||
                input.assurancePack?.region ||
                'regional',
            'regional'
        ) || 'regional'
    );
}

function resolveRegion(input = {}) {
    const clinicProfile = getClinicProfile(input);
    return (
        toText(
            input.region || clinicProfile.region || resolveScope(input),
            resolveScope(input)
        ) || 'regional'
    );
}

function resolveIncidents(input = {}) {
    return toArray(
        input.incidents ||
            input.releaseIncidents ||
            input.assurancePack?.incidents
    );
}

function resolveDependencies(input = {}) {
    const dependencies = toArray(
        input.dependencies || input.assurancePack?.dependencies
    );
    return dependencies.length
        ? cloneDependencies(dependencies)
        : cloneDependencies(DEFAULT_DEPENDENCIES);
}

function resolveClinicLabel(input = {}) {
    const clinicProfile = getClinicProfile(input);
    return (
        toText(
            input.clinicLabel ||
                clinicProfile.branding?.name ||
                clinicProfile.clinic_name ||
                clinicProfile.clinicName ||
                clinicProfile.clinic_id ||
                clinicProfile.clinicId ||
                resolveRegion(input),
            resolveRegion(input)
        ) || resolveRegion(input)
    );
}

function resolveClinicShortName(input = {}) {
    const clinicProfile = getClinicProfile(input);
    return (
        toText(
            input.clinicShortName ||
                clinicProfile.branding?.short_name ||
                clinicProfile.short_name ||
                clinicProfile.clinicShortName ||
                clinicProfile.clinic_id ||
                clinicProfile.clinicId ||
                resolveScope(input),
            resolveScope(input)
        ) || resolveScope(input)
    );
}

function renderTag(label, value, tone = 'ready') {
    return `<span class="queue-app-card__tag" data-state="${escapeHtml(
        tone
    )}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function renderStatCard(label, value, detail, tone = 'ready', role = '') {
    return `
        <article class="turnero-release-reliability-recovery-nerve-center__stat" data-state="${escapeHtml(
            tone
        )}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${role ? ` data-role="${escapeHtml(role)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <span>${escapeHtml(detail)}</span>
        </article>
    `;
}

function renderEmptyMessage(message) {
    return `<li class="turnero-release-reliability-recovery-nerve-center__empty">${escapeHtml(
        message
    )}</li>`;
}

function renderTaxonomyRow(row) {
    return `
        <li class="turnero-release-reliability-recovery-nerve-center__row" data-state="${escapeHtml(
            row.severity
        )}">
            <div>
                <strong>${escapeHtml(row.title)}</strong>
                <p>${escapeHtml(row.kind)} · ${escapeHtml(row.recoveryMode)}</p>
            </div>
            <div class="turnero-release-reliability-recovery-nerve-center__row-meta">
                <span>${escapeHtml(row.taxonomy)}</span>
                <span>${escapeHtml(row.owner)}</span>
            </div>
        </li>
    `;
}

function renderDependencyRow(row) {
    return `
        <li class="turnero-release-reliability-recovery-nerve-center__row" data-state="${escapeHtml(
            row.state
        )}">
            <div>
                <strong>${escapeHtml(row.label)}</strong>
                <p>${escapeHtml(row.owner)} · ${escapeHtml(
                    String(row.affectedCount)
                )} impacted</p>
            </div>
            <div class="turnero-release-reliability-recovery-nerve-center__row-meta">
                <span>${escapeHtml(String(row.impactScore))} / 100</span>
                <span>${escapeHtml(row.state)}</span>
            </div>
        </li>
    `;
}

function renderDrillRow(row) {
    return `
        <li class="turnero-release-reliability-recovery-nerve-center__artifact" data-state="${escapeHtml(
            row.result
        )}">
            <div>
                <strong>${escapeHtml(row.title)}</strong>
                <p>${escapeHtml(row.owner)} · ${escapeHtml(row.mode)}</p>
            </div>
            <span>${escapeHtml(formatDateTime(row.at))}</span>
        </li>
    `;
}

function renderCheckpointRow(row) {
    return `
        <li class="turnero-release-reliability-recovery-nerve-center__artifact" data-state="${escapeHtml(
            row.state
        )}">
            <div>
                <strong>${escapeHtml(row.label)}</strong>
                <p>${escapeHtml(row.owner)} · ${escapeHtml(row.note || '')}</p>
            </div>
            <span>${escapeHtml(formatDateTime(row.at))}</span>
        </li>
    `;
}

function renderPostmortemRow(row) {
    return `
        <li class="turnero-release-reliability-recovery-nerve-center__artifact" data-state="${escapeHtml(
            row.status
        )}">
            <div>
                <strong>${escapeHtml(row.incidentTitle)}</strong>
                <p>${escapeHtml(row.owner)} · ${escapeHtml(row.rootCause || '')}</p>
            </div>
            <span>${escapeHtml(formatDateTime(row.createdAt))}</span>
        </li>
    `;
}

function recoveryBriefToMarkdown(pack = {}) {
    const lines = [
        '# Reliability Recovery Nerve Center',
        '',
        `Scope: ${pack.scope || 'global'}`,
        `Region: ${pack.region || 'regional'}`,
        `Clinic: ${pack.clinicLabel || pack.clinicShortName || 'unknown'}`,
        `Resilience score: ${pack.resilience?.score ?? 0} (${
            pack.resilience?.band || 'n/a'
        })`,
        `Incidents: ${pack.summary?.incidentCount ?? toArray(pack.incidents).length}`,
        `Dependencies: ${
            pack.summary?.dependencyCount ?? toArray(pack.dependencies).length
        }`,
        `Drills: ${pack.summary?.drillCount ?? toArray(pack.drills).length}`,
        `Checkpoints: ${
            pack.summary?.checkpointCount ?? toArray(pack.checkpoints).length
        }`,
        `Postmortems: ${
            pack.summary?.postmortemCount ?? toArray(pack.postmortems).length
        }`,
        '',
        'Rollback mode:',
        `- ${pack.rollbackPack?.mode || 'observe'}`,
        '',
        'Commands:',
        ...(pack.rollbackPack?.commands || []).map((command) => `- ${command}`),
        '',
        'Top outage taxonomy:',
        ...(pack.taxonomy?.rows || [])
            .slice(0, 5)
            .map(
                (row) =>
                    `- ${row.severity} · ${row.title} · ${row.recoveryMode}`
            ),
        '',
        'Top dependencies:',
        ...(pack.dependencyMap?.rows || [])
            .slice(0, 5)
            .map((row) => `- ${row.label} · ${row.state} · ${row.impactScore}`),
    ];
    return lines.join('\n');
}

function createReliabilityRecoveryState(input = {}) {
    const scope = resolveScope(input);
    const region = resolveRegion(input);
    const clinicProfile = getClinicProfile(input);
    const incidents = resolveIncidents(input);
    const dependencies = resolveDependencies(input);
    const drillStore = createTurneroReleaseFailoverDrillRegistry(scope);
    const checkpointStore =
        createTurneroReleaseRecoveryCheckpointJournal(scope);
    const postmortemStore = createTurneroReleasePostmortemWorkspace(scope);
    const pack = {
        scope,
        region,
        clinicProfile,
        clinicLabel: resolveClinicLabel(input),
        clinicShortName: resolveClinicShortName(input),
        incidents,
        dependencies,
        taxonomy: buildTurneroReleaseOutageTaxonomy({
            incidents,
            releaseIncidents: incidents,
            assurancePack: input.assurancePack,
        }),
        dependencyMap: buildTurneroReleaseDependencyImpactMap({
            incidents,
            releaseIncidents: incidents,
            dependencies,
            assurancePack: input.assurancePack,
        }),
        rollbackPack: buildTurneroReleaseRollbackCommandPack({
            region,
            incidents,
            releaseIncidents: incidents,
            assurancePack: input.assurancePack,
        }),
        drills: [],
        checkpoints: [],
        postmortems: [],
        resilience: {
            score: 0,
            band: 'fragile',
            generatedAt: new Date().toISOString(),
            factors: {},
        },
        summary: {
            incidentCount: incidents.length,
            dependencyCount: dependencies.length,
            drillCount: 0,
            checkpointCount: 0,
            postmortemCount: 0,
            criticalDependencies: 0,
            watchDependencies: 0,
        },
        generatedAt: new Date().toISOString(),
    };

    const recompute = () => {
        pack.drills = drillStore.list();
        pack.checkpoints = checkpointStore.list();
        pack.postmortems = postmortemStore.list();
        pack.taxonomy = buildTurneroReleaseOutageTaxonomy({
            incidents: pack.incidents,
            releaseIncidents: pack.incidents,
            assurancePack: input.assurancePack,
        });
        pack.dependencyMap = buildTurneroReleaseDependencyImpactMap({
            incidents: pack.incidents,
            releaseIncidents: pack.incidents,
            dependencies: pack.dependencies,
            assurancePack: input.assurancePack,
        });
        pack.rollbackPack = buildTurneroReleaseRollbackCommandPack({
            region: pack.region,
            incidents: pack.incidents,
            releaseIncidents: pack.incidents,
            assurancePack: input.assurancePack,
        });
        pack.resilience = buildTurneroReleaseResilienceScore({
            dependencyRows: pack.dependencyMap.rows,
            drills: pack.drills,
            checkpoints: pack.checkpoints,
            incidents: pack.incidents,
        });
        pack.summary = {
            incidentCount: pack.taxonomy.rows.length,
            dependencyCount: pack.dependencyMap.rows.length,
            drillCount: pack.drills.length,
            checkpointCount: pack.checkpoints.length,
            postmortemCount: pack.postmortems.length,
            criticalDependencies: pack.dependencyMap.summary.critical,
            watchDependencies: pack.dependencyMap.summary.watch,
            rollbackMode: pack.rollbackPack.mode,
        };
        pack.generatedAt = new Date().toISOString();
        return pack;
    };

    recompute();

    return {
        pack,
        recompute,
        drillStore,
        checkpointStore,
        postmortemStore,
    };
}

function renderReliabilityRecoveryHtml(pack) {
    const incidentRows = pack.taxonomy.rows.slice(0, 6);
    const dependencyRows = pack.dependencyMap.rows.slice(0, 6);
    const drillRows = pack.drills.slice(0, 5);
    const checkpointRows = pack.checkpoints.slice(0, 5);
    const postmortemRows = pack.postmortems.slice(0, 5);

    return `
        <section
            id="turneroReliabilityRecoveryNerveCenter"
            class="queue-app-card turnero-release-reliability-recovery-nerve-center"
            data-scope="${escapeHtml(pack.scope)}"
            data-region="${escapeHtml(pack.region)}"
            data-state="${escapeHtml(pack.resilience.band)}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Reliability recovery</p>
                    <h6>Turnero Nerve Center</h6>
                    <p>
                        ${escapeHtml(pack.clinicLabel)} · ${escapeHtml(
                            pack.region
                        )} · ${escapeHtml(pack.rollbackPack.mode)}
                    </p>
                </div>
                <div class="queue-app-card__meta">
                    ${renderTag(
                        'Resilience',
                        `${pack.resilience.score}/100`,
                        pack.resilience.band
                    )}
                    ${renderTag(
                        'Incidents',
                        String(pack.summary.incidentCount),
                        pack.summary.incidentCount > 0 ? 'warning' : 'ready'
                    )}
                </div>
            </header>
            <p class="queue-app-card__description">
                Outage taxonomy, dependency impact, drills, checkpoints, rollback
                and postmortem in one place.
            </p>
            <div class="turnero-release-reliability-recovery-nerve-center__stats">
                ${renderStatCard(
                    'Resilience score',
                    `${pack.resilience.score} / 100`,
                    `${pack.resilience.band} band`,
                    pack.resilience.band,
                    'resilience-score'
                )}
                ${renderStatCard(
                    'Outage taxonomy',
                    String(pack.summary.incidentCount),
                    'Incidents clasificados',
                    pack.summary.incidentCount > 0 ? 'warning' : 'ready',
                    'taxonomy-count'
                )}
                ${renderStatCard(
                    'Dependency impact',
                    String(pack.summary.dependencyCount),
                    `${pack.summary.criticalDependencies} critical · ${pack.summary.watchDependencies} watch`,
                    pack.summary.criticalDependencies > 0
                        ? 'alert'
                        : pack.summary.watchDependencies > 0
                          ? 'warning'
                          : 'ready',
                    'dependency-count'
                )}
                ${renderStatCard(
                    'Recovery artifacts',
                    String(
                        pack.summary.drillCount +
                            pack.summary.checkpointCount +
                            pack.summary.postmortemCount
                    ),
                    'Drills, checkpoints y postmortems',
                    'ready',
                    'artifact-count'
                )}
            </div>
            <div class="turnero-release-reliability-recovery-nerve-center__actions">
                <button type="button" data-action="copy-recovery-brief">
                    Copy recovery brief
                </button>
                <button type="button" data-action="copy-rollback-pack">
                    Copy rollback pack
                </button>
                <button type="button" data-action="download-reliability-pack">
                    Download reliability JSON
                </button>
            </div>
            <div class="turnero-release-reliability-recovery-nerve-center__grid">
                <section class="turnero-release-reliability-recovery-nerve-center__panel">
                    <header class="turnero-release-reliability-recovery-nerve-center__panel-head">
                        <p class="queue-app-card__eyebrow">Outage taxonomy</p>
                        <h6>Incidentes y modos de recuperación</h6>
                    </header>
                    <ul class="turnero-release-reliability-recovery-nerve-center__list">
                        ${
                            incidentRows.length
                                ? incidentRows.map(renderTaxonomyRow).join('')
                                : renderEmptyMessage(
                                      'Sin incidentes reportados.'
                                  )
                        }
                    </ul>
                </section>
                <section class="turnero-release-reliability-recovery-nerve-center__panel">
                    <header class="turnero-release-reliability-recovery-nerve-center__panel-head">
                        <p class="queue-app-card__eyebrow">Dependency impact</p>
                        <h6>Mapa de dependencias</h6>
                    </header>
                    <ul class="turnero-release-reliability-recovery-nerve-center__list">
                        ${
                            dependencyRows.length
                                ? dependencyRows
                                      .map(renderDependencyRow)
                                      .join('')
                                : renderEmptyMessage(
                                      'Sin dependencias registradas.'
                                  )
                        }
                    </ul>
                </section>
            </div>
            <div class="turnero-release-reliability-recovery-nerve-center__workspace">
                <section class="turnero-release-reliability-recovery-nerve-center__panel">
                    <header class="turnero-release-reliability-recovery-nerve-center__panel-head">
                        <p class="queue-app-card__eyebrow">Failover drills</p>
                        <h6>Ensayos de recuperación</h6>
                    </header>
                    <div class="turnero-release-reliability-recovery-nerve-center__form">
                        <input data-field="drill-title" placeholder="Drill title" />
                        <input data-field="drill-owner" placeholder="Owner" />
                        <input data-field="drill-result" placeholder="Result" />
                        <button type="button" data-action="add-drill">Add drill</button>
                    </div>
                    <ul class="turnero-release-reliability-recovery-nerve-center__list">
                        ${
                            drillRows.length
                                ? drillRows.map(renderDrillRow).join('')
                                : renderEmptyMessage('Sin drills registrados.')
                        }
                    </ul>
                    <strong
                        class="turnero-release-reliability-recovery-nerve-center__count"
                        data-role="drill-count"
                    >${escapeHtml(String(pack.summary.drillCount))}</strong>
                </section>
                <section class="turnero-release-reliability-recovery-nerve-center__panel">
                    <header class="turnero-release-reliability-recovery-nerve-center__panel-head">
                        <p class="queue-app-card__eyebrow">Recovery checkpoints</p>
                        <h6>Hitos de recuperación</h6>
                    </header>
                    <div class="turnero-release-reliability-recovery-nerve-center__form">
                        <input data-field="checkpoint-label" placeholder="Checkpoint label" />
                        <input data-field="checkpoint-owner" placeholder="Owner" />
                        <textarea data-field="checkpoint-note" placeholder="Note"></textarea>
                        <button type="button" data-action="add-checkpoint">
                            Add checkpoint
                        </button>
                    </div>
                    <ul class="turnero-release-reliability-recovery-nerve-center__list">
                        ${
                            checkpointRows.length
                                ? checkpointRows
                                      .map(renderCheckpointRow)
                                      .join('')
                                : renderEmptyMessage(
                                      'Sin checkpoints registrados.'
                                  )
                        }
                    </ul>
                    <strong
                        class="turnero-release-reliability-recovery-nerve-center__count"
                        data-role="checkpoint-count"
                    >${escapeHtml(String(pack.summary.checkpointCount))}</strong>
                </section>
                <section class="turnero-release-reliability-recovery-nerve-center__panel">
                    <header class="turnero-release-reliability-recovery-nerve-center__panel-head">
                        <p class="queue-app-card__eyebrow">Postmortem workspace</p>
                        <h6>Acciones correctivas</h6>
                    </header>
                    <div class="turnero-release-reliability-recovery-nerve-center__form">
                        <input data-field="postmortem-title" placeholder="Incident title" />
                        <input data-field="postmortem-owner" placeholder="Owner" />
                        <textarea data-field="postmortem-root" placeholder="Root cause"></textarea>
                        <textarea
                            data-field="postmortem-action"
                            placeholder="Corrective action"
                        ></textarea>
                        <button type="button" data-action="add-postmortem">
                            Add postmortem
                        </button>
                    </div>
                    <ul class="turnero-release-reliability-recovery-nerve-center__list">
                        ${
                            postmortemRows.length
                                ? postmortemRows
                                      .map(renderPostmortemRow)
                                      .join('')
                                : renderEmptyMessage(
                                      'Sin postmortems registrados.'
                                  )
                        }
                    </ul>
                    <strong
                        class="turnero-release-reliability-recovery-nerve-center__count"
                        data-role="postmortem-count"
                    >${escapeHtml(String(pack.summary.postmortemCount))}</strong>
                </section>
            </div>
            <details class="turnero-release-reliability-recovery-nerve-center__copy">
                <summary>Resumen copiable</summary>
                <pre data-role="recovery-brief">${escapeHtml(
                    recoveryBriefToMarkdown(pack)
                )}</pre>
                <pre class="turnero-release-reliability-recovery-nerve-center__rollback">
${escapeHtml(rollbackCommandPackToMarkdown(pack.rollbackPack))}
                </pre>
            </details>
        </section>
    `;
}

export function mountTurneroReleaseReliabilityRecoveryNerveCenter(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    host.innerHTML = '';
    const state = createReliabilityRecoveryState(input);
    const { pack } = state;
    const root = document.createElement('section');
    root.innerHTML = renderReliabilityRecoveryHtml(pack);
    root.className =
        'queue-app-card turnero-release-reliability-recovery-nerve-center';
    root.dataset.turneroReliabilityRecoveryMounted = 'true';
    root.dataset.turneroReliabilityRecoveryScope = pack.scope;
    root.dataset.turneroReliabilityRecoveryRegion = pack.region;
    root.dataset.turneroReliabilityRecoveryClinic = pack.clinicLabel;
    root.dataset.turneroReliabilityRecoveryResilience = String(
        pack.resilience.score
    );

    const syncHostDataset = () => {
        host.dataset.turneroReliabilityRecoveryMounted = 'true';
        host.dataset.turneroReliabilityRecoveryScope = pack.scope;
        host.dataset.turneroReliabilityRecoveryRegion = pack.region;
        host.dataset.turneroReliabilityRecoveryClinic = pack.clinicLabel;
        host.dataset.turneroReliabilityRecoveryResilience = String(
            pack.resilience.score
        );
        host.dataset.turneroReliabilityRecoveryBand = pack.resilience.band;
        host.dataset.turneroReliabilityRecoveryRollbackMode =
            pack.rollbackPack.mode;
    };

    let nodes = {};
    const collectNodes = () => ({
        resilienceNode: root.querySelector('[data-role="resilience-score"]'),
        taxonomyCountNode: root.querySelector('[data-role="taxonomy-count"]'),
        dependencyCountNode: root.querySelector(
            '[data-role="dependency-count"]'
        ),
        artifactCountNode: root.querySelector('[data-role="artifact-count"]'),
        drillCountNode: root.querySelector('[data-role="drill-count"]'),
        checkpointCountNode: root.querySelector(
            '[data-role="checkpoint-count"]'
        ),
        postmortemCountNode: root.querySelector(
            '[data-role="postmortem-count"]'
        ),
        briefNode: root.querySelector('[data-role="recovery-brief"]'),
    });

    const syncNodes = () => {
        if (nodes.resilienceNode) {
            nodes.resilienceNode.textContent = `${pack.resilience.score} / 100`;
        }
        if (nodes.taxonomyCountNode) {
            nodes.taxonomyCountNode.textContent = String(
                pack.summary.incidentCount
            );
        }
        if (nodes.dependencyCountNode) {
            nodes.dependencyCountNode.textContent = String(
                pack.summary.dependencyCount
            );
        }
        if (nodes.artifactCountNode) {
            nodes.artifactCountNode.textContent = String(
                pack.summary.drillCount +
                    pack.summary.checkpointCount +
                    pack.summary.postmortemCount
            );
        }
        if (nodes.drillCountNode) {
            nodes.drillCountNode.textContent = String(pack.summary.drillCount);
        }
        if (nodes.checkpointCountNode) {
            nodes.checkpointCountNode.textContent = String(
                pack.summary.checkpointCount
            );
        }
        if (nodes.postmortemCountNode) {
            nodes.postmortemCountNode.textContent = String(
                pack.summary.postmortemCount
            );
        }
        if (nodes.briefNode) {
            nodes.briefNode.textContent = recoveryBriefToMarkdown(pack);
        }
        root.dataset.turneroReliabilityRecoveryResilience = String(
            pack.resilience.score
        );
        root.dataset.turneroReliabilityRecoveryBand = pack.resilience.band;
        root.dataset.turneroReliabilityRecoveryRollbackMode =
            pack.rollbackPack.mode;
        syncHostDataset();
    };

    const rerender = () => {
        state.recompute();
        root.innerHTML = renderReliabilityRecoveryHtml(pack);
        nodes = collectNodes();
        syncNodes();
        return pack;
    };

    nodes = collectNodes();
    syncNodes();
    syncHostDataset();

    root.addEventListener('click', async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-recovery-brief') {
            await copyToClipboardSafe(recoveryBriefToMarkdown(pack));
            return;
        }

        if (action === 'copy-rollback-pack') {
            await copyToClipboardSafe(
                rollbackCommandPackToMarkdown(pack.rollbackPack)
            );
            return;
        }

        if (action === 'download-reliability-pack') {
            downloadJsonSnapshot('turnero-release-reliability-pack.json', pack);
            return;
        }

        if (action === 'add-drill') {
            const title =
                root.querySelector('[data-field="drill-title"]')?.value || '';
            const owner =
                root.querySelector('[data-field="drill-owner"]')?.value || '';
            const result =
                root.querySelector('[data-field="drill-result"]')?.value || '';
            if (!title.trim()) {
                return;
            }
            state.drillStore.add({
                title,
                owner,
                result: result || 'planned',
                mode: 'fallback',
            });
            rerender();
            return;
        }

        if (action === 'add-checkpoint') {
            const label =
                root.querySelector('[data-field="checkpoint-label"]')?.value ||
                '';
            const owner =
                root.querySelector('[data-field="checkpoint-owner"]')?.value ||
                '';
            const note =
                root.querySelector('[data-field="checkpoint-note"]')?.value ||
                '';
            if (!label.trim()) {
                return;
            }
            state.checkpointStore.add({
                label,
                owner,
                note,
                state: 'closed',
            });
            rerender();
            return;
        }

        if (action === 'add-postmortem') {
            const incidentTitle =
                root.querySelector('[data-field="postmortem-title"]')?.value ||
                '';
            const owner =
                root.querySelector('[data-field="postmortem-owner"]')?.value ||
                '';
            const rootCause =
                root.querySelector('[data-field="postmortem-root"]')?.value ||
                '';
            const correctiveAction =
                root.querySelector('[data-field="postmortem-action"]')?.value ||
                '';
            if (!incidentTitle.trim()) {
                return;
            }
            state.postmortemStore.add({
                incidentTitle,
                owner,
                rootCause,
                correctiveAction,
                status: 'open',
            });
            rerender();
        }
    });

    host.appendChild(root);
    syncHostDataset();
    return {
        root,
        pack,
        refresh: rerender,
    };
}
