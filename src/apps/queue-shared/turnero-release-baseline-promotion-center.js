import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import {
    archiveReleaseBaseline,
    buildReleaseBaselineRegistryPack,
    clearActiveReleaseBaseline,
    promoteReleaseBaseline,
    renameReleaseBaseline,
    restoreReleaseBaseline,
    setActiveReleaseBaseline,
} from './turnero-release-baseline-registry.js';
import { buildReleasePortfolioDashboard } from './turnero-release-portfolio-dashboard.js';
import { computeReleaseScorecard } from './turnero-release-scorecard.js';
import { analyzeReleaseTrend } from './turnero-release-trend-analyzer.js';
import { buildReleaseRegressionRadar } from './turnero-release-regression-radar.js';
import { buildTurneroReleaseControlCenterModel } from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (_error) {
            // Fall through to JSON cloning.
        }
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value && typeof value === 'object' ? { ...value } : value;
    }
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRegistryPack(input, clinicId) {
    const source = asObject(input);
    const items = toArray(source.items);
    const activeBaselineId = toText(
        source.activeBaselineId || source.active?.baselineId || ''
    );
    const active = isPlainObject(source.active)
        ? source.active
        : items.find((item) => item.baselineId === activeBaselineId) || null;
    const history = toArray(source.history).length
        ? toArray(source.history)
        : buildHistoryFromRegistryItems(items);
    return {
        clinicId: toText(
            source.clinicId || clinicId || 'default-clinic',
            'default-clinic'
        ),
        generatedAt: toText(source.generatedAt || new Date().toISOString()),
        total: safeNumber(source.total, items.length),
        archivedTotal: safeNumber(source.archivedTotal, 0),
        activeBaselineId: activeBaselineId || active?.baselineId || null,
        active,
        items,
        history,
    };
}

function decisionToTone(decision) {
    if (decision === 'hold') {
        return 'alert';
    }
    if (decision === 'review') {
        return 'warning';
    }
    return 'ready';
}

function decisionToStage(decision) {
    if (decision === 'hold') {
        return 'escalate-now';
    }
    if (decision === 'review') {
        return 'watch';
    }
    return 'stable';
}

function trendToStage(trend) {
    if (!trend || trend.insufficientHistory === true) {
        return 'watch';
    }
    if (trend.direction === 'regressing') {
        return 'active-incident';
    }
    return 'stable';
}

function radarToStage(radar) {
    return radar && radar.total > 0 ? 'active-incident' : 'stable';
}

function portfolioToStage(portfolio) {
    if (!portfolio || portfolio.totals?.hold > 0) {
        return 'watch';
    }
    return 'stable';
}

function formatSignedNumber(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return '0';
    }

    return numberValue > 0 ? `+${numberValue}` : `${numberValue}`;
}

function buildSnapshotFileName(clinicId, clinicLabel) {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const clinicPart =
        toText(clinicLabel || clinicId, 'default-clinic')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'default-clinic';

    return `turnero-release-intelligence-suite-${clinicPart}-${datePart}.json`;
}

function promptForText(message, fallback = '') {
    if (typeof prompt !== 'function') {
        return toText(fallback, '');
    }

    return toText(prompt(message, fallback), fallback);
}

function isReleaseIntelligenceSuiteModel(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.pack &&
        value.scorecard &&
        value.trend &&
        value.radar &&
        value.portfolio
    );
}

function buildCurrentEvidence(controlCenter, parts, clinicId, snapshotId) {
    const source = cloneValue(
        asObject(
            parts.currentEvidence ||
                controlCenter.releaseEvidenceBundle ||
                parts.releaseEvidenceBundle ||
                controlCenter.snapshot ||
                parts.snapshot ||
                controlCenter
        )
    );

    return normalizeReleaseSnapshot({
        ...source,
        clinicId,
        snapshotId: toText(
            snapshotId ||
                source.snapshotId ||
                controlCenter.snapshot?.snapshotId ||
                `live-${clinicId}`
        ),
        clinicProfile: parts.clinicProfile || parts.turneroClinicProfile,
        turneroClinicProfile: parts.turneroClinicProfile || parts.clinicProfile,
        pilotReadiness: parts.pilotReadiness || parts.turneroPilotReadiness,
        turneroPilotReadiness:
            parts.turneroPilotReadiness || parts.pilotReadiness,
        remoteReleaseReadiness:
            parts.remoteReleaseReadiness || parts.turneroRemoteReleaseReadiness,
        turneroRemoteReleaseReadiness:
            parts.turneroRemoteReleaseReadiness || parts.remoteReleaseReadiness,
        publicShellDrift:
            parts.publicShellDrift || parts.turneroPublicShellDrift,
        turneroPublicShellDrift:
            parts.turneroPublicShellDrift || parts.publicShellDrift,
        releaseEvidenceBundle:
            parts.releaseEvidenceBundle ||
            parts.turneroReleaseEvidenceBundle ||
            controlCenter.releaseEvidenceBundle,
        turneroReleaseEvidenceBundle:
            parts.turneroReleaseEvidenceBundle ||
            parts.releaseEvidenceBundle ||
            controlCenter.releaseEvidenceBundle,
        generatedAt: toText(
            controlCenter.generatedAt ||
                parts.generatedAt ||
                source.generatedAt ||
                new Date().toISOString()
        ),
        savedAt: toText(
            controlCenter.generatedAt ||
                parts.generatedAt ||
                source.savedAt ||
                new Date().toISOString()
        ),
    });
}

function resolvePortfolioSources(context, currentModel) {
    const provided = toArray(context.portfolioClinics || context.clinics);
    const currentClinicId = toText(currentModel.clinicId || '');
    const hasCurrent = provided.some((entry) => {
        const candidateId = toText(
            entry?.clinicId ||
                entry?.clinicLabel ||
                entry?.clinicName ||
                entry?.currentEvidence?.clinicId ||
                entry?.currentSnapshot?.clinicId ||
                ''
        );
        return candidateId === currentClinicId;
    });

    const entries = provided.slice();
    if (!hasCurrent) {
        entries.unshift({
            clinicId: currentModel.clinicId,
            clinicLabel: currentModel.clinicLabel,
            currentEvidence: currentModel.currentEvidence,
            scorecard: currentModel.scorecard,
            trend: currentModel.trend,
            baseline: currentModel.baseline,
            baselineRegistry: currentModel.baselineRegistry,
            releaseDecision: currentModel.scorecard.decisionHint,
            updatedAt:
                currentModel.currentEvidence.savedAt ||
                currentModel.currentEvidence.generatedAt,
            history: currentModel.historySource,
        });
    }

    return entries;
}

function buildExecutiveSummary(model) {
    const baselineLabel = model.baseline
        ? model.baseline.label ||
          model.baseline.baselineId ||
          'Sin baseline activo'
        : 'Sin baseline activo';
    return [
        'Release Intelligence Suite',
        `Clinic: ${model.clinicLabel || model.clinicName || model.clinicId}`,
        `Score: ${model.scorecard.score}/100 (${model.scorecard.grade}) · ${model.scorecard.decisionHint}`,
        `Baseline: ${baselineLabel}`,
        `Trend: ${model.trend.summary}`,
        `Radar: ${model.radar.summary}`,
        `Portfolio: ${model.portfolio.summary}`,
        `Control center: ${model.controlCenter.summary || model.currentEvidence.summary || model.scorecard.summary}`,
    ].join('\n');
}

function buildRegistrySummary(registry, baseline) {
    const activeLabel = baseline
        ? baseline.label || baseline.baselineId || 'active baseline'
        : 'Sin baseline activo';
    return `Baselines ${registry.total} · archived ${registry.archivedTotal} · ${activeLabel}`;
}

function renderPill(label, value) {
    return `<span class="turnero-release-war-room__pill">${escapeHtml(
        `${label} ${value}`
    )}</span>`;
}

function renderLaneCard(config) {
    const meta = toArray(config.meta)
        .map((entry) => `<span>${escapeHtml(entry)}</span>`)
        .join('');
    const pills = toArray(config.pills).join('');
    const blocks = toArray(config.blocks).join('');
    const actions = toArray(config.actions).join('');

    return `
        <article class="turnero-release-war-room__lane" data-stage="${escapeHtml(
            config.stage || 'stable'
        )}" data-status="${escapeHtml(config.status || 'done')}">
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">${escapeHtml(
                        config.owner
                    )}</span>
                    <h4 class="turnero-release-war-room__lane-stage">${escapeHtml(
                        config.title
                    )}</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">${meta}</div>
            </header>
            ${pills ? `<div class="turnero-release-war-room__lane-summary">${pills}</div>` : ''}
            <p class="turnero-release-war-room__lane-note">${escapeHtml(
                config.summary || ''
            )}</p>
            ${actions ? `<div class="turnero-release-war-room__lane-actions">${actions}</div>` : ''}
            ${blocks}
        </article>
    `;
}

function renderBaselineRow(baseline, model) {
    const isActive = baseline.baselineId === model.baseline?.baselineId;
    const isArchived = baseline.isArchived === true;
    const actionLabel = isArchived ? 'Restore' : 'Archive';
    const actionName = isArchived ? 'restore' : 'archive';

    return `
        <article
            class="turnero-release-war-room__lane-block"
            data-baseline-id="${escapeHtml(baseline.baselineId)}"
            data-state="${escapeHtml(
                isArchived ? 'warning' : isActive ? 'ready' : 'info'
            )}"
        >
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">${escapeHtml(
                        isActive ? 'Active baseline' : 'Baseline'
                    )}</span>
                    <h4 class="turnero-release-war-room__lane-stage">${escapeHtml(
                        baseline.label || baseline.baselineId
                    )}</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>${escapeHtml(
                        baseline.promotedAt
                            ? `Promoted ${formatDateTime(baseline.promotedAt)}`
                            : 'Promoted pending'
                    )}</span>
                    <span>${escapeHtml(
                        baseline.releaseDecision || 'decision pending'
                    )}</span>
                    <span>${escapeHtml(
                        isArchived ? 'Archived' : isActive ? 'Active' : 'Stored'
                    )}</span>
                </div>
            </header>
            <p class="turnero-release-war-room__lane-note">
                ${escapeHtml(
                    baseline.summary || 'Sin resumen de baseline disponible.'
                )}
            </p>
            <div class="turnero-release-war-room__lane-actions">
                <button type="button" data-suite-action="rename" data-baseline-id="${escapeHtml(
                    baseline.baselineId
                )}">Rename</button>
                <button type="button" data-suite-action="set-active" data-baseline-id="${escapeHtml(
                    baseline.baselineId
                )}" ${isActive || isArchived ? 'disabled' : ''}>Set active</button>
                <button type="button" data-suite-action="${escapeHtml(
                    actionName
                )}" data-baseline-id="${escapeHtml(baseline.baselineId)}">${escapeHtml(
                    actionLabel
                )}</button>
            </div>
            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Snapshot</span>
                <ul>
                    <li>Source: ${escapeHtml(
                        baseline.sourceSnapshotId ||
                            baseline.snapshot?.snapshotId ||
                            'n/a'
                    )}</li>
                    <li>Fingerprint: ${escapeHtml(
                        baseline.sourceFingerprint ||
                            baseline.snapshot?.profileFingerprint ||
                            'n/a'
                    )}</li>
                    <li>Decision: ${escapeHtml(
                        baseline.releaseDecision ||
                            baseline.snapshot?.decision ||
                            'n/a'
                    )}</li>
                </ul>
            </div>
        </article>
    `;
}

function renderSimpleList(items, emptyText, itemRenderer) {
    const list = toArray(items);
    if (!list.length) {
        return `<p>${escapeHtml(emptyText)}</p>`;
    }

    return `<ul>${list.map((item) => `<li>${itemRenderer(item)}</li>`).join('')}</ul>`;
}

function buildHistoryFromRegistryItems(items) {
    return toArray(items)
        .filter((item) => item && item.snapshot)
        .map((item) => ({
            ...cloneValue(item.snapshot),
            baselineId: item.baselineId,
            baselineLabel: item.label,
            baselineReason: item.reason,
            baselineSummary: item.summary,
            promotedAt: item.promotedAt,
            archivedAt: item.archivedAt,
            isArchived: item.isArchived === true,
            releaseDecision: item.releaseDecision,
            source: 'baseline-registry',
            savedAt:
                item.promotedAt || item.createdAt || new Date().toISOString(),
        }));
}

function renderSuiteSection(id, label, body, note = '') {
    return `
        <div class="turnero-release-war-room__lane-block" id="${escapeHtml(id)}">
            <span class="turnero-release-war-room__section-label">${escapeHtml(
                label
            )}</span>
            ${body}
            ${note ? `<p class="turnero-release-war-room__lane-note">${escapeHtml(note)}</p>` : ''}
        </div>
    `;
}

function renderSuiteActionButton(action, label, options = {}) {
    const attrs = [
        `type="button"`,
        `data-suite-action="${escapeHtml(action)}"`,
    ];
    if (options.baselineId) {
        attrs.push(`data-baseline-id="${escapeHtml(options.baselineId)}"`);
    }
    if (options.disabled === true) {
        attrs.push('disabled');
    }
    if (options.title) {
        attrs.push(`title="${escapeHtml(options.title)}"`);
    }

    return `<button ${attrs.join(' ')}>${escapeHtml(label)}</button>`;
}

function buildReleaseIntelligenceHtmlSections(model) {
    const baselineLabel =
        model.baseline?.label ||
        model.baseline?.baselineId ||
        'Sin baseline activo';
    const baselineState = model.baseline
        ? model.baseline.isArchived === true
            ? 'Archivado'
            : 'Activo'
        : 'Sin baseline';
    const activeBaselineId = model.baseline?.baselineId || '';
    const scoreSummary = [
        `Score ${model.scorecard.score}/100`,
        `Grade ${model.scorecard.grade}`,
        `Decision ${model.decision}`,
        `Trend ${model.trend.direction || 'stable'}`,
    ].join(' · ');
    const summaryMeta = [
        `Clinic ${model.clinicLabel || model.clinicId}`,
        `Snapshot ${model.currentEvidence.snapshotId || model.currentEvidence.snapshotFileName || 'live'}`,
        `Baseline ${baselineLabel}`,
    ];
    const summaryCard = renderLaneCard({
        owner: 'Executive',
        title: `Release intelligence · ${model.clinicLabel || model.clinicId}`,
        stage: decisionToStage(model.decision),
        status:
            model.decision === 'hold'
                ? 'blocked'
                : model.decision === 'review'
                  ? 'working'
                  : 'done',
        meta: summaryMeta,
        pills: [
            renderPill('Score', `${model.scorecard.score}/100`),
            renderPill('Grade', model.scorecard.grade),
            renderPill('Decision', model.decision),
            renderPill('Trend', model.trend.direction || 'stable'),
        ],
        summary: model.scorecard.summary,
        actions: [
            renderSuiteActionButton('promote', 'Promote baseline'),
            renderSuiteActionButton('clear-active', 'Clear active'),
            renderSuiteActionButton('copy-executive-summary', 'Copy summary'),
            renderSuiteActionButton('download-json-export', 'Download JSON'),
        ],
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteSummary',
                'Decision summary',
                `
                    <p class="turnero-release-war-room__lane-note">${escapeHtml(
                        scoreSummary
                    )}</p>
                    <p class="turnero-release-war-room__lane-note">${escapeHtml(
                        model.executiveSummary
                    )}</p>
                `
            ),
            renderSuiteSection(
                'queueReleaseIntelligenceSuitePack',
                'Pack export',
                `
                    <ul>
                        <li>JSON file: <code>${escapeHtml(model.snapshotFileName)}</code></li>
                        <li>Fields: baseline, baselineRegistry, scorecard, trend, radar, portfolio</li>
                        <li>Current decision: ${escapeHtml(model.decision)}</li>
                    </ul>
                `
            ),
        ],
    });

    const evidenceCard = renderLaneCard({
        owner: 'Evidence',
        title: 'Baseline y evidencia',
        stage: model.baseline ? 'stable' : 'watch',
        status: model.baseline ? 'done' : 'working',
        meta: [
            `Baseline ${baselineState}`,
            `History source ${model.historySource.length ? 'promoted baselines' : 'no history yet'}`,
            `Fingerprint ${model.profileFingerprint || 'sin fingerprint'}`,
        ],
        pills: [
            renderPill('Baselines', model.baselineRegistry.total),
            renderPill('Archived', model.baselineRegistry.archivedTotal),
            renderPill('History', model.historySource.length),
            renderPill(
                'Current',
                model.currentEvidence.decision || model.decision
            ),
        ],
        summary:
            model.registrySummary ||
            buildRegistrySummary(model.baselineRegistry, model.baseline),
        actions: [
            renderSuiteActionButton('rename', 'Rename active', {
                baselineId: activeBaselineId,
                disabled: !activeBaselineId,
            }),
            renderSuiteActionButton('set-active', 'Set active', {
                baselineId: activeBaselineId,
                disabled: !activeBaselineId,
            }),
            renderSuiteActionButton('archive', 'Archive active', {
                baselineId: activeBaselineId,
                disabled: !activeBaselineId,
            }),
            renderSuiteActionButton('restore', 'Restore active', {
                baselineId: activeBaselineId,
                disabled: !activeBaselineId,
            }),
        ],
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteEvidence',
                'Current evidence',
                `
                    <ul>
                        <li>Clinic: ${escapeHtml(
                            model.currentEvidence.clinicName ||
                                model.clinicLabel ||
                                model.clinicId
                        )}</li>
                        <li>Decision: ${escapeHtml(model.currentEvidence.decision || model.decision)}</li>
                        <li>Generated: ${escapeHtml(
                            formatDateTime(
                                model.currentEvidence.generatedAt ||
                                    model.currentEvidence.savedAt ||
                                    ''
                            )
                        )}</li>
                        <li>Saved: ${escapeHtml(
                            formatDateTime(
                                model.currentEvidence.savedAt ||
                                    model.currentEvidence.generatedAt ||
                                    ''
                            )
                        )}</li>
                        <li>Baseline: ${escapeHtml(baselineLabel)}</li>
                        <li>Source: ${escapeHtml(model.historySource.length ? 'promoted baselines' : 'no baseline history yet')}</li>
                    </ul>
                `,
                model.baseline
                    ? `Active baseline ${model.baseline.label || model.baseline.baselineId || 'sin etiqueta'}`
                    : 'Sin baseline activo'
            ),
        ],
    });

    const trendCard = renderLaneCard({
        owner: 'Trend',
        title: 'Trend y regresiones',
        stage: trendToStage(model.trend),
        status:
            model.trend.direction === 'regressing'
                ? 'blocked'
                : model.trend.direction === 'improving'
                  ? 'done'
                  : 'working',
        meta: [
            `Samples ${model.trend.sampleSize}`,
            `Stability ${model.trend.stabilityIndex}`,
            `Delta ${formatSignedNumber(model.trend.delta)}`,
        ],
        pills: [
            renderPill('Direction', model.trend.direction || 'stable'),
            renderPill('Regressions', model.trend.regressionCount || 0),
            renderPill('Improvements', model.trend.improvementCount || 0),
        ],
        summary: model.trend.summary,
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteTrend',
                'Trend breakdown',
                `
                    <ul>
                        <li>Stability index: ${escapeHtml(model.trend.stabilityIndex)}</li>
                        <li>Direction: ${escapeHtml(model.trend.direction || 'stable')}</li>
                        <li>Delta vs reference: ${escapeHtml(formatSignedNumber(model.trend.delta))}</li>
                        <li>Regressions: ${escapeHtml(model.trend.regressionCount || 0)}</li>
                        <li>Improvements: ${escapeHtml(model.trend.improvementCount || 0)}</li>
                    </ul>
                `
            ),
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteTrendSignals',
                'Noisy signals',
                renderSimpleList(
                    model.trend.noisySignals,
                    'Sin señales ruidosas.',
                    (signal) => escapeHtml(signal)
                )
            ),
        ],
    });

    const radarCard = renderLaneCard({
        owner: 'Radar',
        title: 'Radar de regresiones',
        stage: radarToStage(model.radar),
        status: model.radar.total > 0 ? 'blocked' : 'done',
        meta: [
            `Regressions ${model.radar.total}`,
            `Reference ${model.radar.referenceSource || 'none'}`,
            `Hot kinds ${model.radar.hotKinds.length}`,
        ],
        pills: [
            renderPill('Total', model.radar.total),
            renderPill('Reference', model.radar.referenceSource || 'none'),
            renderPill(
                'Current',
                model.radar.currentSnapshot.snapshotId || 'live'
            ),
        ],
        summary: model.radar.summary,
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteRadar',
                'Regressions visibles',
                renderSimpleList(
                    model.radar.regressions,
                    'Sin regresiones visibles.',
                    (regression) =>
                        `${escapeHtml(regression.kind)} · ${escapeHtml(
                            regression.title
                        )} · ${escapeHtml(regression.detail || regression.currentValue || '')}`
                )
            ),
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteRadarHotKinds',
                'Hot kinds',
                renderSimpleList(
                    model.radar.hotKinds,
                    'Sin kinds dominantes.',
                    (entry) =>
                        `${escapeHtml(entry.kind)} (${escapeHtml(entry.count)})`
                )
            ),
        ],
    });

    const portfolioCard = renderLaneCard({
        owner: 'Portfolio',
        title: 'Portfolio de clínicas',
        stage: portfolioToStage(model.portfolio),
        status: model.portfolio.totals.hold > 0 ? 'working' : 'done',
        meta: [
            `Clinics ${model.portfolio.totals.total}`,
            `Ready ${model.portfolio.totals.ready}`,
            `Hold ${model.portfolio.totals.hold}`,
        ],
        pills: [
            renderPill('Average', model.portfolio.totals.averageScore),
            renderPill('Ready', model.portfolio.totals.ready),
            renderPill('Review', model.portfolio.totals.review),
            renderPill('Hold', model.portfolio.totals.hold),
        ],
        summary: model.portfolio.summary,
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuitePortfolio',
                'Clinics',
                renderSimpleList(
                    model.portfolio.clinics,
                    'Sin clínicas en portfolio.',
                    (clinic) =>
                        `${escapeHtml(clinic.clinicLabel || clinic.clinicId)} · ${escapeHtml(
                            clinic.score
                        )}/100 · ${escapeHtml(clinic.decisionHint)} · ${escapeHtml(
                            clinic.trend || 'stable'
                        )}`
                )
            ),
        ],
    });

    const registryCard = renderLaneCard({
        owner: 'Registry',
        title: 'Registro de baselines',
        stage: 'stable',
        status: model.baselineRegistry.total > 0 ? 'done' : 'working',
        meta: [
            `Total ${model.baselineRegistry.total}`,
            `Archived ${model.baselineRegistry.archivedTotal}`,
            `Active ${baselineLabel}`,
        ],
        pills: [
            renderPill('Total', model.baselineRegistry.total),
            renderPill('Archived', model.baselineRegistry.archivedTotal),
            renderPill(
                'Active',
                model.baselineRegistry.activeBaselineId || 'none'
            ),
        ],
        summary: buildRegistrySummary(model.baselineRegistry, model.baseline),
        blocks: [
            renderSuiteSection(
                'queueReleaseIntelligenceSuiteRegistry',
                'Baseline rows',
                toArray(model.baselineRegistry.items).length
                    ? toArray(model.baselineRegistry.items)
                          .map((baseline) => renderBaselineRow(baseline, model))
                          .join('')
                    : '<p>Sin baselines promovidos todavía.</p>'
            ),
        ],
    });

    return `
        <section
            id="queueReleaseIntelligenceSuite"
            class="turnero-release-war-room turnero-release-intelligence-suite"
            data-decision="${escapeHtml(model.decision)}"
            data-tone="${escapeHtml(model.tone)}"
            data-clinic-id="${escapeHtml(model.clinicId)}"
            data-clinic-label="${escapeHtml(model.clinicLabel || model.clinicName || model.clinicId)}"
            data-active-baseline="${escapeHtml(model.baseline?.baselineId || '')}"
        >
            <header class="turnero-release-war-room__header">
                <div>
                    <span class="turnero-release-war-room__kicker">Release Intelligence Suite</span>
                    <h3 class="turnero-release-war-room__title">${escapeHtml(
                        model.clinicLabel || model.clinicName || model.clinicId
                    )}</h3>
                    <p class="turnero-release-war-room__subtitle">${escapeHtml(
                        model.scorecard.summary ||
                            model.summary ||
                            model.executiveSummary
                    )}</p>
                </div>
                <div class="turnero-release-war-room__meta">
                    <span>Baseline: ${escapeHtml(baselineLabel)}</span>
                    <span>Registry: ${escapeHtml(buildRegistrySummary(model.baselineRegistry, model.baseline))}</span>
                    <span>Generated: ${escapeHtml(formatDateTime(model.pack.generatedAt))}</span>
                </div>
            </header>

            <div class="turnero-release-war-room__global-summary">
                ${renderPill('Score', `${model.scorecard.score}/100`)}
                ${renderPill('Grade', model.scorecard.grade)}
                ${renderPill('Decision', model.decision)}
                ${renderPill('Trend', model.trend.direction || 'stable')}
                ${renderPill('Baseline', baselineState)}
            </div>

            <div class="turnero-release-war-room__global-actions">
                ${renderSuiteActionButton('promote', 'Promote baseline')}
                ${renderSuiteActionButton('clear-active', 'Clear active')}
                ${renderSuiteActionButton('copy-executive-summary', 'Copy executive summary')}
                ${renderSuiteActionButton('download-json-export', 'Download JSON export')}
            </div>

            <div class="turnero-release-war-room__lanes">
                ${summaryCard}
                ${evidenceCard}
                ${trendCard}
                ${radarCard}
                ${portfolioCard}
                ${registryCard}
            </div>
        </section>
    `.trim();
}

export function buildReleaseIntelligenceSuite(context = {}) {
    const parts = asObject(context.parts || context);
    const rawControlCenter = asObject(context.controlCenter);
    const controlCenter =
        rawControlCenter && rawControlCenter.snapshot
            ? rawControlCenter
            : buildTurneroReleaseControlCenterModel(parts);
    const clinicId = toText(
        context.clinicId ||
            controlCenter.clinicId ||
            parts.clinicId ||
            parts.turneroClinicProfile?.clinic_id ||
            'default-clinic',
        'default-clinic'
    );
    const clinicLabel = toText(
        context.clinicLabel ||
            controlCenter.clinicShortName ||
            controlCenter.clinicName ||
            parts.turneroClinicProfile?.branding?.short_name ||
            parts.turneroClinicProfile?.branding?.name ||
            clinicId,
        clinicId
    );
    const currentEvidence = buildCurrentEvidence(
        controlCenter,
        {
            ...parts,
            currentEvidence:
                context.currentEvidence ||
                context.snapshot ||
                parts.currentEvidence,
        },
        clinicId,
        context.snapshotId || context.currentSnapshotId
    );
    const baselineRegistryInput = asObject(
        context.baselineRegistry || context.baselineRegistryPack || {}
    );
    const baselineRegistry = normalizeRegistryPack(
        baselineRegistryInput.items || baselineRegistryInput.history
            ? baselineRegistryInput
            : buildReleaseBaselineRegistryPack(clinicId, {
                  storage: context.storage,
              }),
        clinicId
    );
    const baseline =
        baselineRegistry.active && typeof baselineRegistry.active === 'object'
            ? cloneValue(baselineRegistry.active)
            : null;
    const historySource = toArray(context.history).length
        ? toArray(context.history)
        : toArray(baselineRegistry.history);
    const trend = analyzeReleaseTrend(historySource, {
        currentSnapshot: currentEvidence,
    });
    const scorecard = computeReleaseScorecard(currentEvidence, { trend });
    const radar = buildReleaseRegressionRadar({
        currentSnapshot: currentEvidence,
        activeBaseline: baseline,
        recentHistory: historySource,
    });
    const portfolioSources = resolvePortfolioSources(context, {
        clinicId,
        clinicLabel,
        clinicName: currentEvidence.clinicName,
        currentEvidence,
        scorecard,
        trend,
        baseline,
        baselineRegistry,
        releaseDecision: scorecard.decisionHint,
        updatedAt: currentEvidence.savedAt || currentEvidence.generatedAt,
        history: historySource,
    });
    const portfolio = buildReleasePortfolioDashboard(portfolioSources);
    const registrySummary = buildRegistrySummary(baselineRegistry, baseline);
    const controlSummary =
        controlCenter.summary ||
        currentEvidence.summary ||
        scorecard.summary ||
        'Sin resumen de control center.';
    const supportCopy =
        controlCenter.supportCopy || scorecard.summary || controlSummary;
    const decision = scorecard.decisionHint;
    const tone = decisionToTone(decision);
    const snapshotFileName = buildSnapshotFileName(
        clinicId,
        clinicLabel || currentEvidence.clinicName || clinicId
    );
    const executiveSummary = buildExecutiveSummary({
        clinicLabel,
        clinicName: currentEvidence.clinicName || clinicLabel,
        clinicId,
        scorecard,
        baseline: baseline || null,
        trend,
        radar,
        portfolio,
        controlCenter,
        currentEvidence,
    });
    const pack = {
        generatedAt: new Date().toISOString(),
        clinicId,
        clinicLabel,
        clinicName: currentEvidence.clinicName || clinicLabel,
        clinicShortName: currentEvidence.clinicShortName || clinicLabel,
        profileFingerprint:
            currentEvidence.profileFingerprint ||
            controlCenter.profileFingerprint ||
            '',
        decision,
        tone,
        currentEvidence,
        controlCenter,
        baseline: baseline || null,
        baselineRegistry,
        registrySummary,
        scorecard,
        trend,
        radar,
        portfolio,
        history: historySource,
        executiveSummary,
        summary: scorecard.summary,
        supportCopy,
    };

    return {
        clinicId,
        clinicLabel,
        clinicName: currentEvidence.clinicName || clinicLabel,
        clinicShortName: currentEvidence.clinicShortName || clinicLabel,
        profileFingerprint:
            currentEvidence.profileFingerprint ||
            controlCenter.profileFingerprint ||
            '',
        currentEvidence,
        controlCenter,
        baseline: baseline || null,
        baselineRegistry,
        registrySummary,
        scorecard,
        trend,
        radar,
        portfolio,
        decision,
        tone,
        summary: scorecard.summary,
        supportCopy,
        executiveSummary,
        clipboardSummary: executiveSummary,
        snapshotFileName,
        historySource,
        pack,
        json: pack,
        exports: {
            executiveSummary,
            json: pack,
        },
    };
}

function buildActionsModel(context = {}) {
    return isReleaseIntelligenceSuiteModel(context)
        ? context
        : buildReleaseIntelligenceSuite(context);
}

export function createReleaseIntelligenceActions(context = {}) {
    const model = buildActionsModel(context);
    const storage = context.storage || null;

    return {
        promote(label = '', reason = '') {
            const nextLabel =
                toText(label, '') ||
                promptForText(
                    'Baseline label',
                    model.baseline?.label ||
                        `${model.clinicLabel || model.clinicId} baseline`
                );
            const nextReason =
                toText(reason, '') ||
                promptForText('Baseline reason', model.scorecard.summary);
            return promoteReleaseBaseline(
                model.clinicId,
                cloneValue(model.currentEvidence),
                {
                    label:
                        nextLabel ||
                        model.baseline?.label ||
                        'Baseline promoted',
                    reason: nextReason || model.scorecard.summary,
                    summary: model.executiveSummary,
                    storage,
                }
            );
        },
        archive(baselineId = '') {
            return archiveReleaseBaseline(
                model.clinicId,
                baselineId || model.baseline?.baselineId || '',
                {
                    storage,
                }
            );
        },
        restore(baselineId = '') {
            return restoreReleaseBaseline(
                model.clinicId,
                baselineId || model.baseline?.baselineId || '',
                {
                    storage,
                }
            );
        },
        rename(baselineId = '', label = '') {
            const nextLabel =
                toText(label, '') ||
                promptForText(
                    'Baseline label',
                    model.baseline?.label || 'Baseline renamed'
                );
            return renameReleaseBaseline(
                model.clinicId,
                baselineId || model.baseline?.baselineId || '',
                nextLabel || model.baseline?.label || 'Baseline renamed',
                {
                    storage,
                }
            );
        },
        setActive(baselineId = '') {
            return setActiveReleaseBaseline(
                model.clinicId,
                baselineId || model.baseline?.baselineId || '',
                {
                    storage,
                }
            );
        },
        clearActive() {
            return clearActiveReleaseBaseline(model.clinicId, {
                storage,
            });
        },
        copyExecutiveSummary(summary = model.executiveSummary) {
            return copyToClipboardSafe(toText(summary, model.executiveSummary));
        },
        downloadJsonExport(
            filename = model.snapshotFileName,
            payload = model.pack
        ) {
            return downloadJsonSnapshot(filename, payload);
        },
    };
}

function isMutationAction(action) {
    return new Set([
        'promote',
        'archive',
        'restore',
        'rename',
        'set-active',
        'clear-active',
    ]).has(toText(action, '').toLowerCase());
}

export async function handleActionFromModel(
    action,
    baselineId,
    model,
    context = {}
) {
    const actions = createReleaseIntelligenceActions({
        ...context,
        ...model,
        storage: context.storage || model?.storage || null,
    });
    const normalizedAction = toText(action, '').toLowerCase();

    if (normalizedAction === 'promote') {
        return actions.promote();
    }
    if (normalizedAction === 'archive') {
        return actions.archive(baselineId);
    }
    if (normalizedAction === 'restore') {
        return actions.restore(baselineId);
    }
    if (normalizedAction === 'rename') {
        return actions.rename(baselineId);
    }
    if (normalizedAction === 'set-active') {
        return actions.setActive(baselineId);
    }
    if (normalizedAction === 'clear-active') {
        return actions.clearActive();
    }
    if (
        normalizedAction === 'copy-executive-summary' ||
        normalizedAction === 'copy-summary'
    ) {
        return actions.copyExecutiveSummary();
    }
    if (
        normalizedAction === 'download-json-export' ||
        normalizedAction === 'download-json'
    ) {
        return actions.downloadJsonExport();
    }

    return false;
}

function bindReleaseIntelligenceSuiteActions(host, model, rerender, context) {
    const buttons =
        typeof host.querySelectorAll === 'function'
            ? Array.from(host.querySelectorAll('[data-suite-action]') || [])
            : [];

    buttons.forEach((button) => {
        if (!button || typeof button.addEventListener !== 'function') {
            return;
        }

        button.addEventListener('click', async () => {
            const action = toText(button.getAttribute('data-suite-action'), '');
            const baselineId = toText(
                button.getAttribute('data-baseline-id'),
                ''
            );
            const result = await handleActionFromModel(
                action,
                baselineId,
                model,
                context
            );
            button.dataset.state =
                result === false || result == null ? 'error' : 'done';
            if (
                isMutationAction(action) &&
                result !== false &&
                result != null
            ) {
                rerender();
            }
        });
    });
}

export function renderReleaseIntelligenceSuiteCard(input = {}, options = {}) {
    const model = buildActionsModel({
        ...input,
        storage: options.storage || input.storage || null,
    });

    return buildReleaseIntelligenceHtmlSections(model);
}

export function mountReleaseIntelligenceSuiteCard(
    target,
    context = {},
    options = {}
) {
    if (!isDomElement(target)) {
        return null;
    }

    const renderContext = {
        ...context,
        storage: options.storage || context.storage || null,
    };
    const rerender = () => {
        const nextModel = buildActionsModel(renderContext);
        target.innerHTML = buildReleaseIntelligenceHtmlSections(nextModel);
        bindReleaseIntelligenceSuiteActions(
            target,
            nextModel,
            rerender,
            renderContext
        );
        target.dataset.turneroReleaseIntelligenceSuiteClinicId =
            nextModel.clinicId || 'default-clinic';
        target.dataset.turneroReleaseIntelligenceSuiteRequestId =
            nextModel.pack?.generatedAt || new Date().toISOString();
        return nextModel;
    };

    const model = buildActionsModel(renderContext);
    target.innerHTML = buildReleaseIntelligenceHtmlSections(model);
    bindReleaseIntelligenceSuiteActions(target, model, rerender, renderContext);
    target.dataset.turneroReleaseIntelligenceSuiteClinicId =
        model.clinicId || 'default-clinic';
    target.dataset.turneroReleaseIntelligenceSuiteRequestId =
        model.pack?.generatedAt || new Date().toISOString();
    return target.querySelector('#queueReleaseIntelligenceSuite') || target;
}

export default buildReleaseIntelligenceSuite;
