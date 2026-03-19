import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { buildMultiClinicRollout } from './turnero-release-multi-clinic-rollout.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.querySelector(target) || document.getElementById(target)
        );
    }

    return isDomElement(target) ? target : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function canUseClipboard() {
    return Boolean(
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
    );
}

async function copyText(text) {
    return copyToClipboardSafe(text);
}

function downloadJson(filename, payload) {
    return downloadJsonSnapshot(filename, payload);
}

function toneForDecision(decision) {
    if (decision === 'promote') {
        return 'ready';
    }

    if (decision === 'review') {
        return 'warning';
    }

    return 'alert';
}

function toneForCoverage(status) {
    if (status === 'green') {
        return 'ready';
    }

    if (status === 'yellow') {
        return 'warning';
    }

    return 'alert';
}

function toneForScenario(recommendation) {
    if (recommendation === 'safe-expand') {
        return 'ready';
    }

    if (recommendation === 'review-expand') {
        return 'warning';
    }

    return 'alert';
}

function renderChip(label, value, state = 'info') {
    return `<span class="queue-ops-pilot__chip" data-state="${escapeHtml(
        state
    )}">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function renderListItem(title, detail, meta, state = 'info') {
    return `<article class="queue-ops-pilot__issues-item" role="listitem" data-state="${escapeHtml(
        state
    )}"><div class="queue-ops-pilot__issues-item-head"><strong>${escapeHtml(
        title
    )}</strong><span class="queue-ops-pilot__issues-item-badge">${escapeHtml(
        meta
    )}</span></div><p>${escapeHtml(detail)}</p></article>`;
}

function renderSection(title, eyebrow, body) {
    return `
        <section class="queue-ops-pilot__issues">
            <div class="queue-ops-pilot__issues-head">
                <div><p class="queue-app-card__eyebrow">${escapeHtml(
                    eyebrow
                )}</p><h6>${escapeHtml(title)}</h6></div>
            </div>
            ${body}
        </section>
    `.trim();
}

function renderCohorts(model) {
    const cohorts = toArray(model.cohortPlanner?.cohorts);
    if (!cohorts.length) {
        return renderSection(
            'Cohorts',
            'Cohort planner',
            '<p class="queue-ops-pilot__issues-summary">Sin cohortes disponibles.</p>'
        );
    }

    return renderSection(
        'Cohorts',
        'Cohort planner',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.cohortPlanner?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${cohorts
                    .map((cohort) =>
                        renderListItem(
                            cohort.label,
                            `${cohort.summary} · traffic ${cohort.targetTrafficPercent}% · avg score ${cohort.averageScore}`,
                            `${cohort.count} clínica(s)`,
                            cohort.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderScoreboard(model) {
    const regions = toArray(model.scoreboard?.regions);
    if (!regions.length) {
        return renderSection(
            'Scoreboard',
            'Regional scoreboard',
            '<p class="queue-ops-pilot__issues-summary">Sin scoreboard regional.</p>'
        );
    }

    return renderSection(
        'Scoreboard',
        'Regional scoreboard',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.scoreboard?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${regions
                    .map((region) =>
                        renderListItem(
                            region.region,
                            `avg score ${region.averageScore} · avg risk ${region.averageRisk} · ready ${region.readyCount} · review ${region.reviewCount} · hold ${region.holdCount}`,
                            `${region.clinicCount} clínica(s)`,
                            region.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderHotspots(model) {
    const hotspots = toArray(model.heatmap?.hotspots);
    if (!hotspots.length) {
        return renderSection(
            'Hotspots',
            'Portfolio heatmap',
            '<p class="queue-ops-pilot__issues-summary">Sin hotspots destacados.</p>'
        );
    }

    return renderSection(
        'Hotspots',
        'Portfolio heatmap',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.heatmap?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${hotspots
                    .map((hotspot) =>
                        renderListItem(
                            hotspot.clinicLabel,
                            `${hotspot.region} · ${hotspot.reason} · risk ${hotspot.riskScore} · decision ${hotspot.decision}`,
                            hotspot.ownerTeam,
                            hotspot.tone
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderSimulator(model) {
    const scenarios = toArray(model.simulator?.scenarios);
    if (!scenarios.length) {
        return renderSection(
            'Simulator',
            'Expansion simulator',
            '<p class="queue-ops-pilot__issues-summary">Sin escenarios de simulación.</p>'
        );
    }

    return renderSection(
        'Simulator',
        'Expansion simulator',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.simulator?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${scenarios
                    .map((scenario) =>
                        renderListItem(
                            scenario.name,
                            `cohort ${scenario.targetCohort} · gain ${scenario.expectedGain} · risk ${scenario.riskDelta} · rollback ${scenario.rollbackExposure} · coverage ${scenario.coverageNeed}`,
                            `${scenario.trafficPercent}%`,
                            toneForScenario(scenario.recommendation)
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderCoverage(model) {
    const coverage = toArray(model.coverage?.coverage);
    if (!coverage.length) {
        return renderSection(
            'Coverage',
            'Regional coverage',
            '<p class="queue-ops-pilot__issues-summary">Sin cobertura regional.</p>'
        );
    }

    return renderSection(
        'Coverage',
        'Regional coverage',
        `
            <p class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.coverage?.summary || ''
            )}</p>
            <div class="queue-ops-pilot__issues-items" role="list">
                ${coverage
                    .map((entry) =>
                        renderListItem(
                            entry.region,
                            `${entry.notes} · clinics ${entry.clinicCount} · avg risk ${entry.averageRisk} · avg score ${entry.averageScore}`,
                            `${entry.status}`,
                            toneForCoverage(model.coverage?.overallStatus)
                        )
                    )
                    .join('')}
            </div>
        `
    );
}

function renderDecision(model) {
    const decision = model.portfolioDecision || {};
    const registry = model.registry || {};
    const planner = model.cohortPlanner || {};

    return `
        <div class="queue-ops-pilot__chips" aria-label="Multi-clinic metrics">
            ${renderChip('Decision', decision.decision || 'hold', toneForDecision(decision.decision))}
            ${renderChip('Cohort', model.recommendedNextCohort || 'holdouts', 'info')}
            ${renderChip('Registry', `${toArray(registry.clinics).length} clinics`, 'info')}
            ${renderChip('Coverage', model.coverage?.overallStatus || 'unknown', toneForCoverage(model.coverage?.overallStatus))}
            ${renderChip('Risk', model.scoreboard?.highestRisk?.clinicLabel || 'n/a', 'warning')}
            ${renderChip('Planner', planner.counts?.total || 0, 'info')}
        </div>
        <p class="queue-ops-pilot__issues-summary">${escapeHtml(
            model.summary || ''
        )}</p>
        <p class="queue-ops-pilot__issues-support">${escapeHtml(
            decision.reason || ''
        )}</p>
    `;
}

function renderActions(model) {
    const clipboardState = canUseClipboard() ? 'ready' : 'warning';

    return `
        <div class="queue-ops-pilot__actions" aria-label="Acciones del tower">
            <button id="queueReleaseMultiClinicControlTowerCopyBriefBtn" type="button" class="queue-ops-pilot__action queue-ops-pilot__action--primary" data-control-tower-action="copy-brief" data-state="${clipboardState}">Copiar brief ejecutivo</button>
            <button id="queueReleaseMultiClinicControlTowerCopyCohortPlanBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-cohort-plan" data-state="${clipboardState}">Copiar cohortes</button>
            <button id="queueReleaseMultiClinicControlTowerCopyScoreboardBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-scoreboard" data-state="${clipboardState}">Copiar scoreboard</button>
            <button id="queueReleaseMultiClinicControlTowerCopyHotspotsBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-hotspots" data-state="${clipboardState}">Copiar hotspots</button>
            <button id="queueReleaseMultiClinicControlTowerCopySimulatorBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-simulator" data-state="${clipboardState}">Copiar simulador</button>
            <button id="queueReleaseMultiClinicControlTowerCopyCoverageBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="copy-coverage" data-state="${clipboardState}">Copiar cobertura</button>
            <button id="queueReleaseMultiClinicControlTowerDownloadJsonBtn" type="button" class="queue-ops-pilot__action" data-control-tower-action="download-json">Descargar JSON</button>
        </div>
        <p class="queue-ops-pilot__issues-support">Archivo: ${escapeHtml(
            model.jsonPackFileName || 'turnero-multi-clinic-control-tower.json'
        )}</p>
    `;
}

function bindButtons(host, model, actions) {
    if (!isDomElement(host)) {
        return;
    }

    if (host.__turneroReleaseMultiClinicControlTowerClickHandler) {
        host.removeEventListener(
            'click',
            host.__turneroReleaseMultiClinicControlTowerClickHandler
        );
    }

    host.__turneroReleaseMultiClinicControlTowerClickHandler = async (
        event
    ) => {
        const button =
            typeof Element !== 'undefined' && event.target instanceof Element
                ? event.target.closest('button[data-control-tower-action]')
                : null;

        if (
            typeof HTMLElement === 'undefined' ||
            !(button instanceof HTMLElement)
        ) {
            return;
        }

        const action = button.getAttribute('data-control-tower-action');
        if (!action || typeof actions[action] !== 'function') {
            return;
        }

        await actions[action]();
    };

    host.addEventListener(
        'click',
        host.__turneroReleaseMultiClinicControlTowerClickHandler
    );
}

export function createMultiClinicControlTowerActions(model = {}) {
    const pack = model.jsonPack || {};

    return {
        async ['copy-brief']() {
            await copyText(model.copyableExecutiveBrief || '');
        },
        async ['copy-cohort-plan']() {
            await copyText(model.copyableCohortPlan || '');
        },
        async ['copy-scoreboard']() {
            await copyText(model.copyableScoreboard || '');
        },
        async ['copy-hotspots']() {
            await copyText(model.copyableHotspots || '');
        },
        async ['copy-simulator']() {
            await copyText(model.copyableSimulator || '');
        },
        async ['copy-coverage']() {
            await copyText(model.copyableCoverage || '');
        },
        async ['download-json']() {
            downloadJson(
                model.jsonPackFileName ||
                    'turnero-multi-clinic-control-tower.json',
                pack
            );
        },
    };
}

export function renderMultiClinicControlTowerCard(input = {}, options = {}) {
    const model = input.model || buildMultiClinicRollout(input);

    return `
        <section id="queueReleaseMultiClinicControlTower" class="queue-ops-pilot__card turnero-release-control-tower" data-state="${escapeHtml(
            toneForDecision(model.portfolioDecision?.decision)
        )}">
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Multi-Clinic Control Tower</p>
                    <h6>Control tower multi-clinic</h6>
                </div>
            </div>
            ${renderDecision(model)}
            ${renderActions(model, options)}
            ${renderCohorts(model)}
            ${renderScoreboard(model)}
            ${renderHotspots(model)}
            ${renderSimulator(model)}
            ${renderCoverage(model)}
        </section>
    `.trim();
}

export function mountMultiClinicControlTowerCard(
    target,
    input = {},
    options = {}
) {
    const host = resolveTarget(target);
    if (!host) {
        return null;
    }

    const model = input.model || buildMultiClinicRollout(input);
    const requestId =
        toText(
            options.requestId ||
                input.requestId ||
                `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        ) || `tower-${Date.now().toString(36)}`;

    host.dataset.turneroReleaseMultiClinicControlTowerRequestId = requestId;
    host.innerHTML = renderMultiClinicControlTowerCard(
        {
            ...input,
            model,
        },
        options
    );
    host.__turneroReleaseMultiClinicControlTowerModel = model;

    const section = host.querySelector('#queueReleaseMultiClinicControlTower');
    if (section instanceof HTMLElement) {
        section.__turneroReleaseMultiClinicControlTowerModel = model;
        section.dataset.turneroReleaseMultiClinicControlTowerRequestId =
            requestId;
    }

    const actions = createMultiClinicControlTowerActions(model);
    bindButtons(host, model, actions);

    return host;
}

export { canUseClipboard, copyText, downloadJson };

export const buildMultiClinicControlTower = buildMultiClinicRollout;

export { buildMultiClinicRollout };

export default buildMultiClinicRollout;
