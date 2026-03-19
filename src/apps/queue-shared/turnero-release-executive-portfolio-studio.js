import { buildTurneroReleaseBenefitsTracker } from './turnero-release-benefits-tracker.js';
import { buildTurneroReleaseCapexOpexPlanner } from './turnero-release-capex-opex-planner.js';
import { buildTurneroReleaseFundingGates } from './turnero-release-funding-gates.js';
import { buildTurneroReleaseProcurementReadiness } from './turnero-release-procurement-readiness.js';
import { buildTurneroReleaseScenarioLab } from './turnero-release-scenario-lab.js';
import { buildTurneroReleaseProgramKpiPack } from './turnero-release-program-kpi-pack.js';
import { buildTurneroReleaseQuarterlyRoadmap } from './turnero-release-quarterly-roadmap.js';
import { buildTurneroReleaseValueRealization } from './turnero-release-value-realization.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const DEFAULT_CLINIC_VALUES = {
    expectedBenefit: 80,
    realizedBenefit: 50,
    adoptionRate: 70,
    capex: 1200,
    monthlyOpex: 280,
    supportCost: 180,
    hardwareCost: 700,
    procurementReadiness: 82,
    valueScore: 75,
};

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, digits = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return '0';
    }

    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits > 0 ? digits : 0,
    }).format(parsed);
}

function formatCurrency(value, digits = 0) {
    return `$${formatNumber(value, digits)}`;
}

function safeFilePart(
    value,
    fallback = 'turnero-release-executive-portfolio-studio'
) {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

    return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement
        ? target
        : null;
}

function resolveClinicProfile(
    input = {},
    controlCenterModel = {},
    governancePack = {}
) {
    const candidates = [
        input.clinicProfile,
        input.turneroClinicProfile,
        controlCenterModel.turneroClinicProfile,
        controlCenterModel.clinicProfile,
        controlCenterModel.snapshot?.parts?.clinicProfile,
        governancePack.turneroClinicProfile,
        governancePack.clinicProfile,
        governancePack.currentSnapshot?.turneroClinicProfile,
        governancePack.snapshot?.turneroClinicProfile,
        governancePack.snapshot?.parts?.clinicProfile,
        input.snapshot?.turneroClinicProfile,
        input.snapshot?.parts?.clinicProfile,
    ];

    return (
        candidates.find(
            (candidate) => candidate && typeof candidate === 'object'
        ) || {}
    );
}

function resolveRegion(input = {}, clinicProfile = {}, governancePack = {}) {
    return toText(
        input.region ||
            clinicProfile.region ||
            clinicProfile.branding?.region ||
            governancePack.region ||
            'regional',
        'regional'
    );
}

function normalizeClinicRecord(source = {}, index = 0, region = 'regional') {
    const clinicId = toText(
        source.clinicId ||
            source.clinic_id ||
            source.id ||
            source.code ||
            source.branding?.short_name ||
            source.branding?.name ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const clinicName = toText(
        source.clinicName ||
            source.name ||
            source.label ||
            source.branding?.short_name ||
            source.branding?.name ||
            clinicId,
        clinicId
    );
    const expectedBenefit = safeNumber(
        source.expectedBenefit ?? source.valueScore ?? source.benefitTarget,
        DEFAULT_CLINIC_VALUES.expectedBenefit
    );
    const realizedBenefit = safeNumber(
        source.realizedBenefit ??
            source.benefitRealized ??
            source.realized ??
            Math.max(0, expectedBenefit * 0.6),
        Math.max(0, expectedBenefit * 0.6)
    );
    const adoptionRate = safeNumber(
        source.adoptionRate ?? source.adoption ?? source.usageRate,
        DEFAULT_CLINIC_VALUES.adoptionRate
    );
    const capex = safeNumber(
        source.capex ?? source.hardwareCost,
        DEFAULT_CLINIC_VALUES.capex
    );
    const monthlyOpex = safeNumber(
        source.monthlyOpex ?? source.supportCost,
        DEFAULT_CLINIC_VALUES.monthlyOpex
    );
    const supportCost = safeNumber(
        source.supportCost,
        DEFAULT_CLINIC_VALUES.supportCost
    );
    const hardwareCost = safeNumber(
        source.hardwareCost,
        DEFAULT_CLINIC_VALUES.hardwareCost
    );
    const procurementReadiness = safeNumber(
        source.procurementReadiness ??
            source.readiness ??
            source.valueScore ??
            adoptionRate,
        DEFAULT_CLINIC_VALUES.procurementReadiness
    );
    const valueScore = safeNumber(
        source.valueScore ?? source.score ?? expectedBenefit * 0.9,
        DEFAULT_CLINIC_VALUES.valueScore
    );

    return {
        clinicId,
        clinicName,
        label: clinicName,
        region: toText(source.region || source.area || region, region),
        expectedBenefit,
        realizedBenefit,
        adoptionRate,
        capex,
        monthlyOpex,
        supportCost,
        hardwareCost,
        procurementReadiness,
        valueScore,
        status: toText(
            source.status ||
                (realizedBenefit >= expectedBenefit * 0.9
                    ? 'on_track'
                    : realizedBenefit >= expectedBenefit * 0.65
                      ? 'watch'
                      : 'recovery'),
            'watch'
        ),
    };
}

function resolveRegionalClinics(
    input = {},
    clinicProfile = {},
    governancePack = {},
    region = 'regional'
) {
    const sourceLists = [
        toArray(input.regionalClinics),
        toArray(clinicProfile.regionalClinics),
        toArray(clinicProfile.clinics),
        toArray(input.clinicProfiles),
        toArray(governancePack.regionalClinics),
        toArray(governancePack.clinicProfiles),
    ];
    const explicitClinics = sourceLists.find((items) => items.length > 0) || [];

    if (explicitClinics.length > 0) {
        return explicitClinics.map((clinic, index) =>
            normalizeClinicRecord(asObject(clinic), index, region)
        );
    }

    return [
        normalizeClinicRecord(
            {
                clinicId:
                    clinicProfile.clinic_id ||
                    clinicProfile.clinicId ||
                    input.clinicId ||
                    'default-clinic',
                clinicName:
                    clinicProfile.branding?.short_name ||
                    clinicProfile.branding?.name ||
                    clinicProfile.clinicName ||
                    clinicProfile.clinic_name ||
                    'Piel en Armonia',
                region,
                expectedBenefit: 80,
                realizedBenefit: 50,
                adoptionRate: 70,
                capex: 1200,
                monthlyOpex: 280,
                supportCost: 180,
                hardwareCost: 700,
                procurementReadiness: 82,
                valueScore: 75,
                status: 'active',
            },
            0,
            region
        ),
    ];
}

function buildProcurementItems(input = {}, regionalClinics = []) {
    const explicitItems = toArray(input.procurementItems);
    if (explicitItems.length > 0) {
        return explicitItems.map((item, index) => ({
            id: toText(item.id || item.key || `proc-${index + 1}`),
            label: toText(
                item.label ||
                    item.name ||
                    item.title ||
                    item.clinicName ||
                    item.clinicId ||
                    `Procurement ${index + 1}`,
                `Procurement ${index + 1}`
            ),
            readiness: safeNumber(
                item.readiness ?? item.score ?? item.procurementReadiness,
                0
            ),
            owner: toText(item.owner || 'ops', 'ops'),
        }));
    }

    if (regionalClinics.length > 0) {
        return regionalClinics.map((clinic) => ({
            id: `${clinic.clinicId}-procurement`,
            label: `${clinic.clinicName} procurement`,
            readiness: safeNumber(
                clinic.procurementReadiness ??
                    clinic.valueScore ??
                    clinic.adoptionRate,
                82
            ),
            owner: clinic.owner || 'ops',
        }));
    }

    return [];
}

function buildPortfolioDecision(
    controlCenterModel,
    governancePack,
    finance,
    procurement,
    funding,
    value
) {
    const controlDecision = toText(controlCenterModel?.decision || 'review');
    const governanceDecision = toText(
        governancePack?.pipeline?.decision ||
            governancePack?.decision ||
            'review'
    );
    const hardBlock =
        controlDecision === 'hold' ||
        governanceDecision === 'rollback' ||
        funding.holdCount > 0 ||
        procurement.avgReadiness < 60 ||
        value.mode === 'negative';
    const watch =
        controlDecision === 'review' ||
        governanceDecision === 'review' ||
        funding.reviewCount > 0 ||
        procurement.avgReadiness < 85 ||
        value.mode === 'slow' ||
        finance.mode === 'watch' ||
        finance.mode === 'constrained';

    return hardBlock ? 'alert' : watch ? 'warning' : 'ready';
}

function buildExecutiveBrief(model) {
    const fundingLines = (model.funding?.rows || [])
        .map((row) => `- ${row.label}: ${row.state}`)
        .join('\n');
    const scenarioLines = (model.scenarios?.scenarios || [])
        .map(
            (scenario) =>
                `- ${scenario.label}: ${scenario.decision} · risk ${scenario.risk} · opex ${scenario.opex}`
        )
        .join('\n');

    return [
        '# Executive Portfolio Studio',
        '',
        `Region: ${model.regionLabel}`,
        `Clinic count: ${model.regionalClinics.length}`,
        `Control center: ${model.controlCenterDecision}`,
        `Governance: ${model.governanceDecision}`,
        `Portfolio state: ${model.portfolioDecision}`,
        `Benefits realization: ${model.benefits.realizationPct}%`,
        `Capex / Opex: ${model.finance.capex} capex · ${model.finance.monthlyOpex}/mo opex`,
        `Runway: ${model.finance.runwayMonths} months`,
        `Procurement readiness: ${model.procurement.avgReadiness}%`,
        `Delivery mode: ${model.kpis.deliveryMode}`,
        `Value realization: ${model.value.mode} · monthly payback ${model.value.monthlyPayback}`,
        '',
        'Funding gates:',
        fundingLines || '- No gates available.',
        '',
        'Scenario lab:',
        scenarioLines || '- No scenarios available.',
        '',
        `Next action: ${model.supportCopy}`,
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildTurneroReleaseExecutivePortfolioStudioPack(input = {}) {
    const controlCenterModel = asObject(
        input.controlCenterModel ||
            input.releaseControlCenterModel ||
            input.controlCenter ||
            {}
    );
    const governancePack = asObject(
        input.governancePack ||
            input.rolloutGovernorModel ||
            input.rolloutGovernor ||
            {}
    );
    const clinicProfile = resolveClinicProfile(
        input,
        controlCenterModel,
        governancePack
    );
    const region = resolveRegion(input, clinicProfile, governancePack);
    const regionalClinics = resolveRegionalClinics(
        input,
        clinicProfile,
        governancePack,
        region
    );
    const releaseIncidents = toArray(
        input.releaseIncidents ||
            controlCenterModel.incidents ||
            governancePack.radar?.regressions ||
            []
    );
    const finance = buildTurneroReleaseCapexOpexPlanner({
        clinics: regionalClinics,
        runwayBudget:
            input.runwayBudget ??
            governancePack.riskBudget?.remainingBudget ??
            governancePack.riskBudget?.budgetMax,
    });
    const benefits = buildTurneroReleaseBenefitsTracker({
        clinics: regionalClinics,
    });
    const procurementItems = buildProcurementItems(input, regionalClinics);
    const procurement = buildTurneroReleaseProcurementReadiness({
        clinics: regionalClinics,
        procurementItems,
    });
    const scorecardScore = safeNumber(governancePack.scorecard?.score, NaN);
    const baseRiskScore = safeNumber(
        input.baseRiskScore,
        Number.isFinite(scorecardScore) ? Math.max(0, 100 - scorecardScore) : 42
    );
    const scenarios = buildTurneroReleaseScenarioLab({
        clinicsCount: regionalClinics.length || 1,
        clinics: regionalClinics,
        baseMonthlyOpex: finance.monthlyOpex,
        baseRiskScore,
        baseInvestment: finance.runwayBudget,
    });
    const kpis = buildTurneroReleaseProgramKpiPack({
        clinics: regionalClinics,
        incidents: releaseIncidents,
    });
    const roadmap = buildTurneroReleaseQuarterlyRoadmap({
        region,
        clinicsTarget: regionalClinics.length || 1,
        baseInvestment: finance.runwayBudget,
        clinics: regionalClinics,
    });
    const governanceDecision = toText(
        input.governanceDecision ||
            governancePack.pipeline?.decision ||
            governancePack.decision ||
            'review'
    );
    const budgetMode =
        toText(input.budgetMode || '')
            .trim()
            .toLowerCase() ||
        (governanceDecision === 'promote'
            ? 'ready'
            : governanceDecision === 'review'
              ? 'review'
              : governanceDecision === 'rollback'
                ? 'hold'
                : finance.mode === 'stable'
                  ? 'ready'
                  : finance.mode === 'watch'
                    ? 'review'
                    : 'hold');
    const riskGrade = toText(
        input.riskGrade || governancePack.scorecard?.grade || 'B'
    )
        .trim()
        .toUpperCase();
    const complianceStatus =
        toText(input.complianceStatus || '')
            .trim()
            .toLowerCase() ||
        (controlCenterModel.decision === 'hold'
            ? 'red'
            : controlCenterModel.decision === 'review'
              ? 'amber'
              : 'green');
    const funding = buildTurneroReleaseFundingGates({
        budgetMode,
        riskGrade,
        complianceStatus,
        runwayMonths: finance.runwayMonths,
        gates: input.fundingGates,
    });
    const value = buildTurneroReleaseValueRealization({
        benefits,
        opex: finance,
    });
    const controlCenterDecision = toText(
        controlCenterModel.decision || 'review'
    );
    const portfolioDecision = buildPortfolioDecision(
        controlCenterModel,
        governancePack,
        finance,
        procurement,
        funding,
        value
    );
    const generatedAt = toText(
        input.generatedAt ||
            governancePack.generatedAt ||
            new Date().toISOString(),
        new Date().toISOString()
    );
    const clinicName = toText(
        clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicProfile.clinicName ||
            'Piel en Armonia',
        'Piel en Armonia'
    );
    const clinicId = toText(
        clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            controlCenterModel.clinicId ||
            governancePack.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const summary = [
        `Executive portfolio for ${region}.`,
        `${regionalClinics.length} clinic(s).`,
        `Benefits ${benefits.realizationPct}%.`,
        `Runway ${finance.runwayMonths} months.`,
        `Procurement ${procurement.avgReadiness}%.`,
        `Delivery ${kpis.deliveryMode}.`,
    ].join(' ');
    const supportCopy =
        portfolioDecision === 'ready'
            ? `Portfolio ready for expansion in ${region}.`
            : portfolioDecision === 'warning'
              ? `Watch signals remain in funding, procurement or payback for ${region}.`
              : `Hold until control center, funding or value realization return to green in ${region}.`;
    const snapshotFileName = `${safeFilePart(
        clinicName || clinicId || region
    )}-${generatedAt.slice(0, 10).replaceAll('-', '')}.json`;
    const model = {
        generatedAt,
        region,
        regionLabel: region,
        clinicId,
        clinicName,
        clinicShortName: clinicName,
        clinicProfile,
        controlCenterModel,
        governancePack,
        releaseIncidents,
        regionalClinics,
        benefits,
        finance,
        procurement,
        scenarios,
        kpis,
        roadmap,
        funding,
        value,
        controlCenterDecision,
        governanceDecision,
        budgetMode,
        riskGrade,
        complianceStatus,
        portfolioDecision,
        summary,
        supportCopy,
        snapshotFileName,
    };
    const executiveBrief = buildExecutiveBrief(model);
    const pack = {
        ...model,
        executiveBrief,
    };

    return {
        ...model,
        executiveBrief,
        pack,
        snapshot: pack,
        state: portfolioDecision,
    };
}

function ensureStudioModel(input = {}, options = {}) {
    if (
        input &&
        input.pack &&
        input.benefits &&
        input.finance &&
        input.procurement &&
        input.funding &&
        input.scenarios &&
        input.kpis &&
        input.roadmap &&
        input.value
    ) {
        return input;
    }

    return buildTurneroReleaseExecutivePortfolioStudioPack({
        ...input,
        ...options,
    });
}

export function renderTurneroReleaseExecutivePortfolioStudioCard(
    input = {},
    options = {}
) {
    return renderTurneroReleaseExecutivePortfolioStudioMarkup(
        ensureStudioModel(input, options)
    );
}

function renderMetricCard(label, value, detail = '', state = 'ready') {
    return `
        <article class="turnero-release-executive-portfolio-studio__metric" data-state="${escapeHtml(
            state
        )}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(detail)}</small>
        </article>
    `.trim();
}

function renderRowItem(title, detail, state = 'ready', meta = '') {
    return `
        <article class="turnero-release-executive-portfolio-studio__row" data-state="${escapeHtml(
            state
        )}">
            <div class="turnero-release-executive-portfolio-studio__row-head">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(state)}</span>
            </div>
            <p>${escapeHtml(detail)}</p>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
        </article>
    `.trim();
}

function renderRowList(items, renderer, emptyMessage) {
    const rows =
        Array.isArray(items) && items.length > 0
            ? items.map(renderer).join('')
            : renderRowItem('Sin datos', emptyMessage, 'ready');

    return `
        <div class="turnero-release-executive-portfolio-studio__rows">
            ${rows}
        </div>
    `.trim();
}

function renderPanel(id, eyebrow, title, state, summary, body) {
    return `
        <article id="${escapeHtml(id)}" class="turnero-release-executive-portfolio-studio__panel" data-state="${escapeHtml(
            state
        )}">
            <header class="turnero-release-executive-portfolio-studio__panel-header">
                <div>
                    <p class="turnero-release-executive-portfolio-studio__eyebrow">${escapeHtml(
                        eyebrow
                    )}</p>
                    <h4>${escapeHtml(title)}</h4>
                </div>
                <span>${escapeHtml(state)}</span>
            </header>
            <p class="turnero-release-executive-portfolio-studio__panel-summary">${escapeHtml(
                summary
            )}</p>
            ${body}
        </article>
    `.trim();
}

function renderTurneroReleaseExecutivePortfolioStudioMarkup(model) {
    const stats = [
        renderMetricCard(
            'Benefits realization',
            `${model.benefits.realizationPct}%`,
            `${model.benefits.rows.length} clinic(s)`,
            model.benefits.status
        ),
        renderMetricCard(
            'Runway months',
            `${model.finance.runwayMonths}`,
            `${formatCurrency(model.finance.runwayBudget)} budget`,
            model.finance.mode
        ),
        renderMetricCard(
            'Procurement readiness',
            `${model.procurement.avgReadiness}%`,
            `${model.procurement.readyCount}/${model.procurement.rows.length} ready`,
            model.procurement.state
        ),
        renderMetricCard(
            'Delivery mode',
            model.kpis.deliveryMode,
            `${model.kpis.blockedIncidents} blocked incident(s)`,
            model.kpis.state
        ),
    ].join('');

    const benefitsPanel = renderPanel(
        'queueExecutivePortfolioStudioBenefitsPanel',
        'Benefits realization',
        'Benefits realization',
        model.benefits.status,
        model.benefits.summary,
        renderRowList(
            model.benefits.rows,
            (row) =>
                renderRowItem(
                    row.label,
                    `Expected ${row.expected} · Realized ${row.realized} · Gap ${row.gap} · Adoption ${row.adoption}%`,
                    row.status,
                    row.region
                ),
            'No benefits rows available.'
        )
    );

    const financePanel = renderPanel(
        'queueExecutivePortfolioStudioFinancePanel',
        'Capex / Opex planner',
        'Capex / Opex planner',
        model.finance.mode,
        model.finance.summary,
        `
            <div class="turnero-release-executive-portfolio-studio__mini-grid">
                ${renderMetricCard('Capex', formatCurrency(model.finance.capex), 'Portfolio capex', model.finance.mode)}
                ${renderMetricCard('Monthly Opex', `${formatCurrency(model.finance.monthlyOpex)}/mo`, 'Recurring burn', model.finance.mode)}
                ${renderMetricCard('Annual Opex', formatCurrency(model.finance.annualOpex), '12 month run rate', model.finance.mode)}
                ${renderMetricCard('Runway budget', formatCurrency(model.finance.runwayBudget), 'Budget envelope', model.finance.mode)}
            </div>
            ${renderRowList(
                model.finance.rows,
                (row) =>
                    renderRowItem(
                        row.label,
                        `Capex ${formatCurrency(row.capex)} · Opex ${formatCurrency(row.monthlyOpex)}/mo · Runway contribution ${formatCurrency(row.runwayContribution)}`,
                        row.state,
                        row.clinicId
                    ),
                'No capex / opex rows available.'
            )}
        `.trim()
    );

    const fundingPanel = renderPanel(
        'queueExecutivePortfolioStudioFundingPanel',
        'Funding gates',
        'Funding gates',
        model.funding.state,
        model.funding.summary,
        renderRowList(
            model.funding.rows,
            (row) =>
                renderRowItem(
                    row.label,
                    row.detail,
                    row.state,
                    `Gate ${row.key}`
                ),
            'No funding gates available.'
        )
    );

    const procurementPanel = renderPanel(
        'queueExecutivePortfolioStudioProcurementPanel',
        'Procurement readiness',
        'Procurement readiness',
        model.procurement.state,
        model.procurement.summary,
        renderRowList(
            model.procurement.rows,
            (row) =>
                renderRowItem(
                    row.label,
                    `Readiness ${row.readiness}% · Owner ${row.owner}`,
                    row.status,
                    row.id
                ),
            'No procurement rows available.'
        )
    );

    const scenariosPanel = renderPanel(
        'queueExecutivePortfolioStudioScenariosPanel',
        'Scenario lab',
        'Scenario lab',
        model.scenarios.state,
        model.scenarios.summary,
        renderRowList(
            model.scenarios.scenarios,
            (scenario) =>
                renderRowItem(
                    scenario.label,
                    `Opex ${formatCurrency(scenario.opex)} · Risk ${scenario.risk} · Support load ${scenario.supportLoad} · Investment ${formatCurrency(scenario.investment)}`,
                    scenario.decision,
                    scenario.key
                ),
            'No scenario rows available.'
        )
    );

    const kpiPanel = renderPanel(
        'queueExecutivePortfolioStudioKpiPanel',
        'KPI pack',
        'KPI pack',
        model.kpis.state,
        model.kpis.summary,
        `
            <div class="turnero-release-executive-portfolio-studio__mini-grid">
                ${renderMetricCard('Active clinics', String(model.kpis.activeClinics), 'Active vs paused', model.kpis.state)}
                ${renderMetricCard('Ready clinics', String(model.kpis.readyClinics), 'Clinics ready to scale', model.kpis.state)}
                ${renderMetricCard('Blocked incidents', String(model.kpis.blockedIncidents), 'Hard blockers', model.kpis.state)}
                ${renderMetricCard('Avg adoption', `${model.kpis.avgAdoption}%`, 'Portfolio adoption', model.kpis.state)}
                ${renderMetricCard('Avg value', `${model.kpis.avgValue}`, 'Portfolio value', model.kpis.state)}
                ${renderMetricCard('Delivery mode', model.kpis.deliveryMode, 'Program health', model.kpis.state)}
            </div>
        `.trim()
    );

    const roadmapPanel = renderPanel(
        'queueExecutivePortfolioStudioRoadmapPanel',
        'Quarterly roadmap',
        'Quarterly roadmap',
        model.roadmap.state,
        model.roadmap.summary,
        renderRowList(
            model.roadmap.quarters,
            (quarter) =>
                renderRowItem(
                    quarter.quarter,
                    `${quarter.theme} · Clinics target ${quarter.clinicsTarget} · Investment band ${quarter.investmentBand}`,
                    quarter.state,
                    model.regionLabel
                ),
            'No roadmap rows available.'
        )
    );

    const valuePanel = renderPanel(
        'queueExecutivePortfolioStudioValuePanel',
        'Value realization',
        'Value realization',
        model.value.state,
        model.value.summary,
        `
            <div class="turnero-release-executive-portfolio-studio__mini-grid">
                ${renderMetricCard('Monthly payback', formatCurrency(model.value.monthlyPayback, 2), 'Realized minus opex', model.value.state)}
                ${renderMetricCard('Annualized value', formatCurrency(model.value.annualizedValue, 2), 'Monthly payback × 12', model.value.state)}
                ${renderMetricCard('Payback months', model.value.paybackMonths === null ? 'n/a' : `${model.value.paybackMonths}`, 'Capex / monthly payback', model.value.state)}
                ${renderMetricCard('Realization %', `${model.value.realizationPct}%`, 'Benefits realization', model.value.state)}
            </div>
        `.trim()
    );

    return `
        <section
            id="queueExecutivePortfolioStudio"
            class="turnero-release-executive-portfolio-studio"
            data-state="${escapeHtml(model.portfolioDecision)}"
            data-region="${escapeHtml(model.region)}"
            aria-labelledby="queueExecutivePortfolioStudioTitle"
            aria-live="polite"
        >
            <header class="turnero-release-executive-portfolio-studio__header">
                <div class="turnero-release-executive-portfolio-studio__copy">
                    <p class="queue-app-card__eyebrow">Executive portfolio</p>
                    <h6 id="queueExecutivePortfolioStudioTitle">Executive Portfolio Studio</h6>
                    <p id="queueExecutivePortfolioStudioSummary" class="turnero-release-executive-portfolio-studio__summary">${escapeHtml(
                        model.summary
                    )}</p>
                    <p id="queueExecutivePortfolioStudioSupport" class="turnero-release-executive-portfolio-studio__support">${escapeHtml(
                        model.supportCopy
                    )}</p>
                </div>
                <div class="turnero-release-executive-portfolio-studio__meta">
                    <span data-state="${escapeHtml(model.portfolioDecision)}">${escapeHtml(
                        model.portfolioDecision
                    )}</span>
                    <span>${escapeHtml(model.regionLabel)}</span>
                    <span>${escapeHtml(`${model.regionalClinics.length} clinic(s)`)}</span>
                    <span>${escapeHtml(model.generatedAt)}</span>
                </div>
            </header>
            <div class="turnero-release-executive-portfolio-studio__actions queue-ops-pilot__actions">
                <button
                    id="queueExecutivePortfolioStudioCopyBriefBtn"
                    type="button"
                    class="queue-ops-pilot__action queue-ops-pilot__action--primary"
                    data-action="copy-executive-brief"
                >
                    Copy executive brief
                </button>
                <button
                    id="queueExecutivePortfolioStudioDownloadJsonBtn"
                    type="button"
                    class="queue-ops-pilot__action"
                    data-action="download-executive-json"
                >
                    Download executive JSON
                </button>
            </div>
            <div id="queueExecutivePortfolioStudioStats" class="turnero-release-executive-portfolio-studio__stats" aria-label="Executive portfolio summary metrics">
                ${stats}
            </div>
            <div class="turnero-release-executive-portfolio-studio__grid">
                ${benefitsPanel}
                ${financePanel}
                ${fundingPanel}
                ${procurementPanel}
                ${scenariosPanel}
                ${kpiPanel}
                ${roadmapPanel}
                ${valuePanel}
            </div>
            <details id="queueExecutivePortfolioStudioPackDetails" class="turnero-release-executive-portfolio-studio__pack">
                <summary>Consolidated pack JSON</summary>
                <pre id="queueExecutivePortfolioStudioPackJson">${escapeHtml(
                    JSON.stringify(
                        model.pack || model.snapshot || model,
                        null,
                        2
                    )
                )}</pre>
            </details>
        </section>
    `.trim();
}

function bindStudioActions(host, model, requestId) {
    const handler = async (event) => {
        const target = event?.target;
        const button =
            target && typeof target.closest === 'function'
                ? target.closest('[data-action]')
                : target;

        if (!button || typeof button.getAttribute !== 'function') {
            return;
        }

        const action = button.getAttribute('data-action');
        if (!action) {
            return;
        }

        host.setAttribute('aria-busy', 'true');
        try {
            let ok = false;
            if (action === 'copy-executive-brief') {
                ok = await copyToClipboardSafe(model.executiveBrief);
            } else if (action === 'download-executive-json') {
                ok = downloadJsonSnapshot(
                    model.snapshotFileName,
                    model.snapshot || model.pack || model
                );
            }

            if (button.dataset) {
                button.dataset.state = ok === false ? 'error' : 'done';
            }
        } finally {
            if (
                host.dataset.turneroReleaseExecutivePortfolioStudioRequestId ===
                requestId
            ) {
                host.removeAttribute('aria-busy');
            }
        }
    };

    if (host.__turneroReleaseExecutivePortfolioStudioClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseExecutivePortfolioStudioClickHandler
        );
    }

    host.__turneroReleaseExecutivePortfolioStudioClickHandler = handler;
    host.addEventListener('click', handler);
}

export function mountTurneroReleaseExecutivePortfolioStudio(
    target,
    input = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const requestId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)
        .slice(0, 8)}`;
    host.dataset.turneroReleaseExecutivePortfolioStudioRequestId = requestId;

    const model = ensureStudioModel(input);
    host.__turneroReleaseExecutivePortfolioStudioModel = model;
    host.__turneroReleaseExecutivePortfolioStudioPack = model.pack;
    host.innerHTML = renderTurneroReleaseExecutivePortfolioStudioMarkup(model);
    const section =
        host.querySelector?.('#queueExecutivePortfolioStudio') || host;
    if (section && typeof section === 'object') {
        section.__turneroReleaseExecutivePortfolioStudioModel = model;
        section.__turneroReleaseExecutivePortfolioStudioPack = model.pack;
    }

    bindStudioActions(host, model, requestId);
    host.__turneroReleaseExecutivePortfolioStudioRender = () => {
        if (
            host.dataset.turneroReleaseExecutivePortfolioStudioRequestId !==
            requestId
        ) {
            return null;
        }

        const nextModel = ensureStudioModel({
            ...input,
            ...model,
        });
        host.__turneroReleaseExecutivePortfolioStudioModel = nextModel;
        host.__turneroReleaseExecutivePortfolioStudioPack = nextModel.pack;
        host.innerHTML =
            renderTurneroReleaseExecutivePortfolioStudioMarkup(nextModel);
        const nextSection =
            host.querySelector?.('#queueExecutivePortfolioStudio') || host;
        if (nextSection && typeof nextSection === 'object') {
            nextSection.__turneroReleaseExecutivePortfolioStudioModel =
                nextModel;
            nextSection.__turneroReleaseExecutivePortfolioStudioPack =
                nextModel.pack;
        }
        return nextModel;
    };
    host.__turneroReleaseExecutivePortfolioStudioActions = {
        copyExecutiveBrief() {
            return copyToClipboardSafe(model.executiveBrief);
        },
        downloadExecutiveJson() {
            return downloadJsonSnapshot(
                model.snapshotFileName,
                model.snapshot || model.pack || model
            );
        },
    };

    return section;
}

export { buildTurneroReleaseExecutivePortfolioStudioPack as buildTurneroReleaseExecutivePortfolioStudioModel };
