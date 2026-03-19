import { buildTurneroReleaseDemandForecastStudio } from './turnero-release-demand-forecast-studio.js';
import { buildTurneroReleaseClinicDigitalTwin } from './turnero-release-clinic-digital-twin.js';
import { createTurneroReleaseScenarioWarGameRegistry } from './turnero-release-scenario-war-game-registry.js';
import { buildTurneroReleaseDecisionSimulator } from './turnero-release-decision-simulator.js';
import { buildTurneroReleaseResourceAllocationMatrix } from './turnero-release-resource-allocation-matrix.js';
import { buildTurneroReleaseStrategyRecommendationEngine } from './turnero-release-strategy-recommendation-engine.js';
import { buildTurneroReleaseRolloutStrategyScore } from './turnero-release-rollout-strategy-score.js';
import { buildTurneroReleaseServiceQualityMetrics } from './turnero-release-service-quality-metrics.js';
import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toText,
} from './turnero-release-control-center.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

    return isDomElement(target) ? target : null;
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min = 0, max = 100, fallback = 0) {
    return Math.max(min, Math.min(max, safeNumber(value, fallback)));
}

function toneForDecision(decision) {
    const normalized = String(decision || '')
        .trim()
        .toLowerCase();
    if (normalized === 'hold') {
        return 'alert';
    }
    if (normalized === 'review') {
        return 'warning';
    }
    return 'ready';
}

function stateLabelForDecision(decision) {
    const normalized = String(decision || '')
        .trim()
        .toLowerCase();
    if (normalized === 'hold') {
        return 'Hold';
    }
    if (normalized === 'review') {
        return 'Review';
    }
    return 'Ready';
}

function normalizeClinicRecord(source = {}, index = 0, region = 'regional') {
    const clinic = source && typeof source === 'object' ? source : {};
    const clinicId = toText(
        clinic.clinicId ||
            clinic.clinic_id ||
            clinic.id ||
            clinic.code ||
            clinic.branding?.short_name ||
            clinic.branding?.name ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const clinicName = toText(
        clinic.clinicName ||
            clinic.name ||
            clinic.label ||
            clinic.branding?.short_name ||
            clinic.branding?.name ||
            clinicId,
        clinicId
    );
    const baseDemand = safeNumber(
        clinic.baseDemand ??
            clinic.expectedBenefit ??
            clinic.demand ??
            clinic.monthlyDemand ??
            clinic.forecastDemand ??
            clinic.valueScore,
        22 + index * 3
    );
    const growthFactor = safeNumber(
        clinic.growthFactor ?? clinic.growth ?? clinic.demandGrowth,
        1.06
    );
    const seasonality = safeNumber(
        clinic.seasonality ?? clinic.seasonalityFactor,
        1
    );
    const adoptionRate = clampNumber(
        clinic.adoptionRate ??
            clinic.adoptionPct ??
            clinic.adoption ??
            clinic.procurementReadiness ??
            clinic.valueScore,
        0,
        100,
        72
    );
    const qualityScore = clampNumber(
        clinic.qualityScore ??
            clinic.serviceQualityScore ??
            clinic.valueScore ??
            adoptionRate,
        0,
        100,
        76
    );
    const resilienceScore = clampNumber(
        clinic.resilienceScore ??
            clinic.reliabilityScore ??
            Math.max(0, qualityScore - 4),
        0,
        100,
        74
    );

    return {
        clinicId,
        clinicName,
        label: clinicName,
        region: toText(clinic.region || clinic.area || region, region),
        baseDemand,
        growthFactor,
        seasonality,
        adoptionRate,
        qualityScore,
        resilienceScore,
        queueFlowScore: clampNumber(
            clinic.queueFlowScore ?? qualityScore * 0.75 + adoptionRate * 0.25,
            0,
            100,
            qualityScore
        ),
        callAccuracyScore: clampNumber(
            clinic.callAccuracyScore ??
                qualityScore * 0.85 + resilienceScore * 0.15,
            0,
            100,
            qualityScore
        ),
        deskReadinessScore: clampNumber(
            clinic.deskReadinessScore ?? resilienceScore,
            0,
            100,
            resilienceScore
        ),
        patientSignalScore: clampNumber(
            clinic.patientSignalScore ??
                adoptionRate * 0.6 + qualityScore * 0.4,
            0,
            100,
            adoptionRate
        ),
        status: toText(
            clinic.status ||
                (qualityScore >= 75
                    ? 'active'
                    : qualityScore >= 60
                      ? 'watch'
                      : 'stabilize'),
            'watch'
        ),
    };
}

function resolveClinics(input = {}) {
    const clinicProfile =
        input.clinicProfile || input.turneroClinicProfile || null;
    const region =
        input.region ||
        input.scope ||
        clinicProfile?.region ||
        clinicProfile?.branding?.region ||
        'regional';
    const sourceLists = [
        input.clinics,
        input.regionalClinics,
        clinicProfile?.regionalClinics,
        clinicProfile?.clinics,
        input.turneroRegionalClinics,
        input.turneroClinicProfiles,
        clinicProfile ? [clinicProfile] : [],
    ];
    const explicitClinics =
        sourceLists.find((items) => Array.isArray(items) && items.length > 0) ||
        [];

    if (explicitClinics.length > 0) {
        return explicitClinics.map((clinic, index) =>
            normalizeClinicRecord(clinic, index, region)
        );
    }

    return [
        normalizeClinicRecord(
            {
                clinicId:
                    clinicProfile?.clinicId ||
                    clinicProfile?.clinic_id ||
                    input.clinicId ||
                    input.scope ||
                    'regional',
                clinicName:
                    clinicProfile?.branding?.short_name ||
                    clinicProfile?.branding?.name ||
                    clinicProfile?.clinicName ||
                    clinicProfile?.clinic_name ||
                    'Piel en Armonia',
                region,
            },
            0,
            region
        ),
    ];
}

function buildStrategyReliabilityRows(clinics = []) {
    return clinics.map((clinic) => ({
        clinicId: clinic.clinicId,
        resilienceScore: Number(
            clampNumber(clinic.resilienceScore, 0, 100, 74).toFixed(1)
        ),
    }));
}

function normalizeQualityRow(source = {}, index = 0, clinic = {}) {
    const row = source && typeof source === 'object' ? source : {};
    return {
        clinicId: toText(
            row.clinicId ||
                row.clinic_id ||
                row.id ||
                clinic.clinicId ||
                clinic.id ||
                `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        score: Number(
            clampNumber(
                row.score ?? row.qualityScore ?? clinic.qualityScore,
                0,
                100,
                76
            ).toFixed(1)
        ),
    };
}

function buildStrategyDigitalTwinStudioPack(input = {}) {
    const scope = toText(input.scope || input.region || 'global', 'global');
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );
    const clinicProfile =
        input.clinicProfile || input.turneroClinicProfile || null;
    const clinics = resolveClinics({
        ...input,
        region,
    });
    const quality = buildTurneroReleaseServiceQualityMetrics({
        ...input,
        clinics,
    });
    const qualityRows =
        Array.isArray(input.qualityRows) && input.qualityRows.length > 0
            ? input.qualityRows.map((row, index) =>
                  normalizeQualityRow(row, index, clinics[index] || {})
              )
            : quality.rows.map((row, index) =>
                  normalizeQualityRow(row, index, clinics[index] || {})
              );
    const reliabilityRows =
        Array.isArray(input.reliabilityRows) && input.reliabilityRows.length > 0
            ? input.reliabilityRows.map((row, index) => ({
                  clinicId: toText(
                      row.clinicId ||
                          row.clinic_id ||
                          row.id ||
                          clinics[index]?.clinicId ||
                          `clinic-${index + 1}`,
                      `clinic-${index + 1}`
                  ),
                  resilienceScore: Number(
                      clampNumber(
                          row.resilienceScore ??
                              row.reliabilityScore ??
                              clinics[index]?.resilienceScore,
                          0,
                          100,
                          74
                      ).toFixed(1)
                  ),
              }))
            : buildStrategyReliabilityRows(clinics);
    const demandForecast = buildTurneroReleaseDemandForecastStudio({
        clinics,
    });
    const twins = buildTurneroReleaseClinicDigitalTwin({
        clinics,
        demandRows: demandForecast.rows,
        qualityRows,
        reliabilityRows,
    });
    const decisions = buildTurneroReleaseDecisionSimulator({
        twins: twins.rows,
        forecastRegional: demandForecast.regional30d,
    });
    const resources = buildTurneroReleaseResourceAllocationMatrix({
        twins: twins.rows,
    });
    const recommendation = buildTurneroReleaseStrategyRecommendationEngine({
        decisions: decisions.rows,
        resources,
    });
    const strategyScore = buildTurneroReleaseRolloutStrategyScore({
        forecast: demandForecast,
        decisions: decisions.rows,
        recommendation,
        resources,
    });
    const warGames = createTurneroReleaseScenarioWarGameRegistry(scope).list();
    const pack = {
        scope,
        region,
        clinicProfile,
        clinics,
        quality,
        qualityRows,
        reliabilityRows,
        forecast: demandForecast,
        twins,
        decisions,
        resources,
        recommendation,
        warGames,
        strategyScore,
    };

    return {
        scope,
        region,
        clinicProfile,
        clinics,
        quality,
        qualityRows,
        reliabilityRows,
        forecast: demandForecast,
        twins,
        decisions,
        resources,
        recommendation,
        warGames,
        strategyScore,
        pack,
        strategyBrief: strategyBriefToMarkdown(pack),
        summary:
            'Forecast, digital twin, war games y simulación estratégica para el rollout multi-clínica.',
        supportCopy: `Top recommendation: ${recommendation.topStrategy?.label || 'review'} · score ${strategyScore.score}`,
        generatedAt: strategyScore.generatedAt,
        snapshotFileName: 'turnero-release-strategy-pack.json',
    };
}

function strategyBriefToMarkdown(pack = {}) {
    const topStrategy = pack.recommendation?.topStrategy || {};
    const lines = [
        '# Strategy Digital Twin Studio',
        '',
        `Scope: ${pack.scope || 'global'}`,
        `Region: ${pack.region || 'regional'}`,
        `Strategy score: ${pack.strategyScore?.score ?? 0} (${
            pack.strategyScore?.band || 'n/a'
        })`,
        `Decision: ${pack.strategyScore?.decision || 'review'}`,
        `Regional forecast 30d: ${pack.forecast?.regional30d ?? 0}`,
        `Top recommendation: ${pack.recommendation?.recommendation || 'review'}`,
        `Top strategy: ${topStrategy.label || topStrategy.key || 'n/a'}`,
        `War games: ${(pack.warGames || []).length}`,
        `Resource units: ${pack.resources?.totals?.totalUnits ?? 0}`,
    ];

    return lines.join('\n');
}

function renderMetricCard(label, value, detail, tone = 'ready', dataRole = '') {
    return `
        <article class="queue-app-card turnero-release-strategy-digital-twin-studio__metric" data-state="${escapeHtml(
            tone
        )}">
            <p class="queue-app-card__eyebrow">${escapeHtml(label)}</p>
            <strong${dataRole ? ` data-role="${escapeHtml(dataRole)}"` : ''}>${escapeHtml(
                value
            )}</strong>
            <p class="queue-app-card__meta">${escapeHtml(detail)}</p>
        </article>
    `.trim();
}

function renderListCard({
    id,
    eyebrow,
    title,
    summary,
    support,
    state = 'ready',
    itemsHtml = '',
    footerHtml = '',
}) {
    return `
        <article id="${escapeHtml(id)}" class="queue-app-card turnero-release-strategy-digital-twin-studio__panel" data-state="${escapeHtml(
            state
        )}">
            <div class="turnero-release-strategy-digital-twin-studio__panel-head">
                <div>
                    <p class="queue-app-card__eyebrow">${escapeHtml(eyebrow)}</p>
                    <h6 class="queue-app-card__title">${escapeHtml(title)}</h6>
                </div>
                <span class="queue-app-card__tag" data-state="${escapeHtml(
                    state
                )}">${escapeHtml(stateLabelForDecision(state))}</span>
            </div>
            <p class="queue-app-card__description">${escapeHtml(summary)}</p>
            <div class="turnero-release-strategy-digital-twin-studio__items">
                ${itemsHtml}
            </div>
            ${
                footerHtml
                    ? `<p class="queue-app-card__notes">${footerHtml}</p>`
                    : ''
            }
            ${
                support
                    ? `<p class="queue-app-card__meta">${escapeHtml(support)}</p>`
                    : ''
            }
        </article>
    `.trim();
}

function renderStudioMarkup(model) {
    const strategyState = toneForDecision(model.strategyScore?.decision);
    const forecastRows = model.forecast?.rows || [];
    const twinRows = model.twins?.rows || [];
    const decisionRows = model.decisions?.rows || [];
    const resourceRows = model.resources?.rows || [];
    const warGames = model.warGames || [];

    const forecastItems = forecastRows.length
        ? forecastRows
              .map(
                  (row) => `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="${escapeHtml(
                            row.pressureBand || 'stable'
                        )}">
                            <strong>${escapeHtml(row.clinicId)}</strong>
                            <p>${escapeHtml(
                                `7d ${row.forecast7d} · 30d ${row.forecast30d} · ${row.pressureBand}`
                            )}</p>
                        </article>
                    `
              )
              .join('')
        : '<p class="queue-app-card__meta">Sin forecast todavía.</p>';
    const twinItems = twinRows.length
        ? twinRows
              .map(
                  (row) => `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="${escapeHtml(
                            row.state
                        )}">
                            <strong>${escapeHtml(row.clinicId)}</strong>
                            <p>${escapeHtml(
                                `Twin ${row.twinScore} · Quality ${row.qualityScore} · Reliability ${row.resilienceScore}`
                            )}</p>
                        </article>
                    `
              )
              .join('')
        : '<p class="queue-app-card__meta">Sin digital twin todavía.</p>';
    const decisionItems = decisionRows.length
        ? decisionRows
              .map(
                  (row) => `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="${escapeHtml(
                            row.decision
                        )}">
                            <strong>${escapeHtml(row.label)}</strong>
                            <p>${escapeHtml(
                                `Confidence ${row.confidence} · ${row.readyClinics}/${twinRows.length} ready`
                            )}</p>
                        </article>
                    `
              )
              .join('')
        : '<p class="queue-app-card__meta">Sin decisiones simuladas todavía.</p>';
    const resourceItems = resourceRows.length
        ? resourceRows
              .map(
                  (row) => `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="ready">
                            <strong>${escapeHtml(row.clinicId)}</strong>
                            <p>${escapeHtml(
                                `Ops ${row.opsUnits} · Field ${row.fieldUnits} · Support ${row.supportUnits} · Total ${row.totalUnits}`
                            )}</p>
                        </article>
                    `
              )
              .join('')
        : '<p class="queue-app-card__meta">Sin asignación de recursos todavía.</p>';
    const warGameItems = warGames.length
        ? warGames
              .map(
                  (row) => `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="warning">
                            <strong>${escapeHtml(row.title)}</strong>
                            <p>${escapeHtml(`${row.owner} · ${row.mode} · ${row.strategy}`)}</p>
                        </article>
                    `
              )
              .join('')
        : '<p class="queue-app-card__meta">Sin war games aún.</p>';
    const metrics = [
        renderMetricCard(
            'Score',
            String(model.strategyScore?.score ?? 0),
            `${model.strategyScore?.band || 'n/a'} · ${model.strategyScore?.decision || 'review'}`,
            strategyState,
            'score'
        ),
        renderMetricCard(
            'Decision',
            stateLabelForDecision(model.strategyScore?.decision),
            model.recommendation?.narrative || 'Sin narrativa.',
            strategyState
        ),
        renderMetricCard(
            'Forecast 30d',
            String(model.forecast?.regional30d ?? 0),
            `${model.clinics.length} clinic(s) evaluadas`,
            'warning'
        ),
        renderMetricCard(
            'Resource units',
            String(model.resources?.totals?.totalUnits ?? 0),
            'Capacidad total del rollout',
            'ready'
        ),
    ].join('');

    return `
        <section
            id="queueStrategyDigitalTwinStudio"
            class="queue-app-card turnero-release-strategy-digital-twin-studio"
            data-state="${escapeHtml(strategyState)}"
            data-scope="${escapeHtml(model.scope)}"
            data-region="${escapeHtml(model.region)}"
            aria-labelledby="queueStrategyDigitalTwinStudioTitle"
            aria-live="polite"
        >
            <header class="turnero-release-strategy-digital-twin-studio__header">
                <div class="turnero-release-strategy-digital-twin-studio__copy">
                    <p class="queue-app-card__eyebrow">Strategy digital twin</p>
                    <h6 id="queueStrategyDigitalTwinStudioTitle" class="queue-app-card__title">
                        Strategy Digital Twin Studio
                    </h6>
                    <p id="queueStrategyDigitalTwinStudioSummary" class="queue-app-card__description">
                        ${escapeHtml(model.summary)}
                    </p>
                    <p id="queueStrategyDigitalTwinStudioSupport" class="queue-app-card__meta">
                        ${escapeHtml(model.supportCopy)}
                    </p>
                </div>
                <div class="turnero-release-strategy-digital-twin-studio__meta">
                    <span class="queue-app-card__tag" data-state="${escapeHtml(
                        strategyState
                    )}">Score ${escapeHtml(String(model.strategyScore?.score ?? 0))}</span>
                    <span class="queue-app-card__tag" data-state="${escapeHtml(
                        strategyState
                    )}">${escapeHtml(model.strategyScore?.band || 'n/a')}</span>
                    <span class="queue-app-card__tag">${escapeHtml(
                        `${model.region} · ${model.clinics.length} clinic(s)`
                    )}</span>
                    <span class="queue-app-card__tag">${escapeHtml(
                        model.generatedAt
                    )}</span>
                </div>
            </header>

            <div class="queue-app-card__actions turnero-release-strategy-digital-twin-studio__actions">
                <button
                    id="queueStrategyDigitalTwinStudioCopyBriefBtn"
                    type="button"
                    class="queue-app-card__cta-primary"
                    data-action="copy-strategy-brief"
                >
                    Copy strategy brief
                </button>
                <button
                    id="queueStrategyDigitalTwinStudioDownloadJsonBtn"
                    type="button"
                    data-action="download-strategy-pack"
                >
                    Download strategy JSON
                </button>
                <button
                    id="queueStrategyDigitalTwinStudioAddWarGameBtn"
                    type="button"
                    data-action="add-war-game"
                >
                    Add war game
                </button>
            </div>

            <div
                id="queueStrategyDigitalTwinStudioMetrics"
                class="turnero-release-strategy-digital-twin-studio__metrics"
                style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));"
            >
                ${metrics}
            </div>

            <div
                class="turnero-release-strategy-digital-twin-studio__grid"
                style="display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));"
            >
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioForecastPanel',
                    eyebrow: 'Demand forecast',
                    title: 'Forecast lab',
                    summary:
                        'Regional demand forecast for the next 7 and 30 days.',
                    support: `Regional 30d forecast: ${model.forecast?.regional30d ?? 0}`,
                    state: 'warning',
                    itemsHtml: forecastItems,
                })}
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioTwinPanel',
                    eyebrow: 'Digital twin',
                    title: 'Clinic twin matrix',
                    summary:
                        'Synthetic twin score by clinic with quality and reliability signals.',
                    support: `Twin rows: ${twinRows.length}`,
                    state: strategyState,
                    itemsHtml: twinItems,
                })}
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioDecisionPanel',
                    eyebrow: 'Decision simulator',
                    title: 'Strategy simulator',
                    summary:
                        'Compare rollout decisions across the modeled strategies.',
                    support: `Decision rows: ${decisionRows.length}`,
                    state: strategyState,
                    itemsHtml: decisionItems,
                })}
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioResourcesPanel',
                    eyebrow: 'Resource allocation',
                    title: 'Resource matrix',
                    summary:
                        'Operational units by clinic to support the selected plan.',
                    support: `Resource rows: ${resourceRows.length}`,
                    state: 'ready',
                    itemsHtml: resourceItems,
                })}
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioRecommendationPanel',
                    eyebrow: 'Recommendation engine',
                    title: 'Rollout recommendation',
                    summary: `Top recommendation: ${model.recommendation?.recommendation || 'review'}`,
                    support:
                        model.recommendation?.narrative || 'Sin narrativa.',
                    state: strategyState,
                    itemsHtml: `
                        <article class="turnero-release-strategy-digital-twin-studio__item" data-state="${escapeHtml(
                            strategyState
                        )}">
                            <strong>${escapeHtml(
                                model.recommendation?.topStrategy?.label ||
                                    model.recommendation?.topStrategy?.key ||
                                    'n/a'
                            )}</strong>
                            <p>${escapeHtml(
                                `Decision ${model.strategyScore?.decision || 'review'} · Score ${model.strategyScore?.score ?? 0}`
                            )}</p>
                        </article>
                    `,
                })}
                ${renderListCard({
                    id: 'queueStrategyDigitalTwinStudioWarGamePanel',
                    eyebrow: 'War games',
                    title: 'Scenario war game registry',
                    summary:
                        'Persisted scenarios by scope for the strategy studio.',
                    support: `War games stored for scope ${model.scope}`,
                    state: warGames.length > 0 ? 'warning' : 'ready',
                    itemsHtml: `
                        <div class="turnero-release-strategy-digital-twin-studio__form" style="display:grid;gap:0.55rem;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:0.75rem;">
                            <input data-field="wg-title" placeholder="Scenario title" aria-label="Scenario title" />
                            <input data-field="wg-owner" placeholder="Owner" aria-label="Owner" />
                            <input data-field="wg-mode" placeholder="Mode" aria-label="Mode" />
                        </div>
                        ${warGameItems}
                    `,
                    footerHtml: `
                        <span class="queue-app-card__tag" data-state="${escapeHtml(
                            strategyState
                        )}">War games: ${warGames.length}</span>
                    `,
                })}
            </div>

            <pre
                id="queueStrategyDigitalTwinStudioBrief"
                class="turnero-release-strategy-digital-twin-studio__brief"
                data-role="strategy-brief"
            >${escapeHtml(model.strategyBrief)}</pre>

            <details id="queueStrategyDigitalTwinStudioPackDetails" class="turnero-release-strategy-digital-twin-studio__pack">
                <summary>Consolidated pack JSON</summary>
                <pre id="queueStrategyDigitalTwinStudioPackJson">${escapeHtml(
                    JSON.stringify(model.pack || model, null, 2)
                )}</pre>
            </details>
        </section>
    `.trim();
}

function mountTurneroReleaseStrategyDigitalTwinStudio(target, input = {}) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const requestId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)
        .slice(0, 8)}`;
    const scope = toText(input.scope || input.region || 'global', 'global');
    host.dataset.turneroReleaseStrategyDigitalTwinStudioRequestId = requestId;
    host.dataset.turneroReleaseStrategyDigitalTwinStudioScope = scope;

    let model = buildStrategyDigitalTwinStudioPack({
        ...input,
        scope,
    });

    const render = () => {
        if (
            host.dataset.turneroReleaseStrategyDigitalTwinStudioRequestId !==
            requestId
        ) {
            return null;
        }

        model = buildStrategyDigitalTwinStudioPack({
            ...input,
            scope,
        });

        host.__turneroReleaseStrategyDigitalTwinStudioModel = model;
        host.__turneroReleaseStrategyDigitalTwinStudioPack = model.pack;
        host.dataset.turneroReleaseStrategyDigitalTwinStudioScore = String(
            model.strategyScore?.score ?? 0
        );
        host.dataset.turneroReleaseStrategyDigitalTwinStudioDecision = String(
            model.strategyScore?.decision || 'review'
        );
        host.dataset.turneroReleaseStrategyDigitalTwinStudioRegion =
            model.region;
        host.dataset.turneroReleaseStrategyDigitalTwinStudioState =
            toneForDecision(model.strategyScore?.decision);
        host.root = host;
        host.pack = model.pack;
        host.recompute = render;
        host.innerHTML = renderStudioMarkup(model);
        return model;
    };

    const handler = async (event) => {
        const targetNode = event?.target;
        const button =
            targetNode && typeof targetNode.closest === 'function'
                ? targetNode.closest('[data-action]')
                : targetNode;

        if (!button || typeof button.getAttribute !== 'function') {
            return;
        }

        const action = button.getAttribute('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-strategy-brief') {
            await copyToClipboardSafe(model.strategyBrief);
            return;
        }

        if (action === 'download-strategy-pack') {
            downloadJsonSnapshot(
                model.snapshotFileName || 'turnero-release-strategy-pack.json',
                model.pack || model
            );
            return;
        }

        if (action === 'add-war-game') {
            const title = toText(
                host.querySelector?.('[data-field="wg-title"]')?.value || '',
                ''
            );
            if (!title) {
                return;
            }

            const owner = toText(
                host.querySelector?.('[data-field="wg-owner"]')?.value || '',
                'program'
            );
            const mode = toText(
                host.querySelector?.('[data-field="wg-mode"]')?.value || '',
                'base'
            );
            const registry = createTurneroReleaseScenarioWarGameRegistry(
                model.scope
            );
            registry.add({
                title,
                owner,
                mode,
                strategy:
                    model.recommendation?.topStrategy?.key ||
                    'controlled_rollout',
                outcome: 'pending',
            });
            render();
        }
    };

    if (host.__turneroReleaseStrategyDigitalTwinStudioClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseStrategyDigitalTwinStudioClickHandler
        );
    }

    host.__turneroReleaseStrategyDigitalTwinStudioClickHandler = handler;
    host.addEventListener('click', handler);

    render();
    host.__turneroReleaseStrategyDigitalTwinStudioRoot = host;
    host.__turneroReleaseStrategyDigitalTwinStudioPack = model.pack;
    host.__turneroReleaseStrategyDigitalTwinStudioModel = model;
    host.__turneroReleaseStrategyDigitalTwinStudioRecompute = render;
    host.root = host;
    host.pack = model.pack;
    host.recompute = render;
    return host;
}

export { buildStrategyDigitalTwinStudioPack, strategyBriefToMarkdown };

export { mountTurneroReleaseStrategyDigitalTwinStudio };
