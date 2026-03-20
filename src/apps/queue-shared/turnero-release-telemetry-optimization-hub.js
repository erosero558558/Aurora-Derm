import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const EXPERIMENT_REGISTRY_STORAGE_KEY =
    'turnero-release-experiment-registry:v1';
const OPTIMIZATION_BACKLOG_STORAGE_KEY =
    'turnero-release-optimization-backlog:v1';
const DEFAULT_SCOPE = 'global';
const SAMPLE_FUNNEL_METRICS = Object.freeze({
    issued: 220,
    announced: 206,
    attended: 190,
    completed: 182,
});
const SAMPLE_PERFORMANCE_METRICS = Object.freeze({
    averageWaitMinutes: 11,
    p95WaitMinutes: 24,
    abandonmentRate: 4,
    displayLatencyMs: 420,
});
const SAMPLE_BASE_ARRIVALS_PER_HOUR = 14;

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

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeJsonParse(value, fallback = {}) {
    if (!value) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : fallback;
    } catch (_error) {
        return fallback;
    }
}

function safeJsonStringify(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(
            value,
            (_key, entry) => {
                if (typeof entry === 'function') {
                    return undefined;
                }

                if (entry && typeof entry === 'object') {
                    if (seen.has(entry)) {
                        return '[Circular]';
                    }
                    seen.add(entry);
                }

                return entry;
            },
            2
        );
    } catch (_error) {
        return JSON.stringify({ error: 'json_stringify_failed' }, null, 2);
    }
}

function normalizeScope(scope) {
    return toText(scope, DEFAULT_SCOPE);
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function roundTo(value, precision = 1, fallback = 0) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return fallback;
    }

    const factor = 10 ** precision;
    return Math.round(numberValue * factor) / factor;
}

function readRegistry(storageKey) {
    const storage = getStorage();
    if (!storage) {
        return {};
    }

    try {
        return safeJsonParse(storage.getItem(storageKey) || '', {});
    } catch (_error) {
        return {};
    }
}

function writeRegistry(storageKey, data) {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(storageKey, safeJsonStringify(data));
    } catch (_error) {
        // localStorage is best-effort here.
    }
}

function getScopedRows(storageKey, scope) {
    const data = readRegistry(storageKey);
    const rows = data && Array.isArray(data[scope]) ? data[scope] : [];
    return rows.map((row) => ({ ...row }));
}

function setScopedRows(storageKey, scope, rows) {
    const data = readRegistry(storageKey);
    data[scope] = rows.map((row) => ({ ...row }));
    writeRegistry(storageKey, data);
}

function deleteScopedRows(storageKey, scope) {
    const data = readRegistry(storageKey);
    if (data && Object.prototype.hasOwnProperty.call(data, scope)) {
        delete data[scope];
        writeRegistry(storageKey, data);
    }
}

function normalizeMetricValue(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function collectSurfaceSnapshots(queueSurfaceStatus = {}) {
    return ['operator', 'kiosk', 'display'].map((surfaceKey) => {
        const surface = asObject(queueSurfaceStatus[surfaceKey]);
        const latest = asObject(surface.latest);
        const ageSeconds = normalizeMetricValue(
            latest.ageSec ?? surface.ageSec,
            0
        );
        const state = toText(surface.status, 'unknown');

        return {
            key: surfaceKey,
            label: toText(surface.label, surfaceKey),
            state,
            summary: toText(surface.summary, 'Sin señal'),
            deviceLabel: toText(latest.deviceLabel, 'Sin equipo reportando'),
            ageLabel:
                Number.isFinite(ageSeconds) && ageSeconds > 0
                    ? `${Math.round(ageSeconds)}s`
                    : 'sin señal',
            badge:
                state === 'ready'
                    ? 'ready'
                    : state === 'warning'
                      ? 'warning'
                      : state === 'alert'
                        ? 'alert'
                        : 'unknown',
        };
    });
}

function deriveClinicsFromEvidence(clinicProfile, releaseEvidenceBundle) {
    const fallbackClinics = Array.isArray(
        releaseEvidenceBundle?.regionalClinics
    )
        ? releaseEvidenceBundle.regionalClinics
        : Array.isArray(clinicProfile?.regionalClinics)
          ? clinicProfile.regionalClinics
          : clinicProfile
            ? [clinicProfile]
            : [];

    return fallbackClinics.map((clinic, index) => ({
        clinicId: toText(
            clinic?.clinicId || clinic?.clinic_id || clinic?.id,
            `clinic-${index + 1}`
        ),
        label: toText(
            clinic?.label ||
                clinic?.branding?.name ||
                clinic?.branding?.short_name ||
                clinic?.clinicName ||
                `Clinic ${index + 1}`,
            `Clinic ${index + 1}`
        ),
        stations: Math.max(
            1,
            Math.round(
                normalizeMetricValue(
                    clinic?.stations ?? clinic?.stationCount,
                    2
                )
            )
        ),
        avgServiceMinutes: roundTo(
            normalizeMetricValue(
                clinic?.avgServiceMinutes ?? clinic?.serviceMinutes,
                12
            ),
            1,
            12
        ),
    }));
}

function deriveCatalogSurfaces(input = {}) {
    const clinicProfile = asObject(
        input.clinicProfile || input.turneroClinicProfile || {}
    );
    const operatorLabel = toText(
        clinicProfile?.surfaces?.operator?.label,
        'Operador web'
    );
    const kioskLabel = toText(clinicProfile?.surfaces?.kiosk?.label, 'Kiosco');
    const displayLabel = toText(
        clinicProfile?.surfaces?.display?.label,
        'Sala'
    );

    return [
        {
            id: 'admin-queue',
            label: 'Admin Queue',
            owner: 'ops',
            events: ['open', 'ready', 'queue_sync', 'refresh'],
        },
        {
            id: 'operator-turnos',
            label: operatorLabel,
            owner: 'ops',
            events: ['queue_sync', 'handoff', 'announce'],
        },
        {
            id: 'kiosco-turnos',
            label: kioskLabel,
            owner: 'frontdesk',
            events: ['ticket_issue', 'queue_sync', 'refresh'],
        },
        {
            id: 'sala-turnos',
            label: displayLabel,
            owner: 'display',
            events: ['announce', 'display_sync', 'refresh'],
        },
    ];
}

function deriveFunnelMetrics(queueMeta = {}) {
    const counts = asObject(queueMeta.counts);
    const waitingCount = normalizeMetricValue(queueMeta.waitingCount, 0);
    const calledCount = normalizeMetricValue(queueMeta.calledCount, 0);
    const completedCount = normalizeMetricValue(counts.completed, 0);
    const noShowCount = normalizeMetricValue(counts.no_show, 0);
    const cancelledCount = normalizeMetricValue(counts.cancelled, 0);
    const observedTotal =
        waitingCount +
        calledCount +
        completedCount +
        noShowCount +
        cancelledCount;

    if (
        observedTotal > 0 ||
        normalizeMetricValue(queueMeta.estimatedWaitMin, 0) > 0 ||
        normalizeMetricValue(queueMeta.assistancePendingCount, 0) > 0
    ) {
        return {
            issued: observedTotal,
            announced: calledCount + completedCount,
            attended: completedCount,
            completed: completedCount,
        };
    }

    return { ...SAMPLE_FUNNEL_METRICS };
}

function derivePerformanceMetrics(queueMeta = {}, queueSurfaceStatus = {}) {
    const counts = asObject(queueMeta.counts);
    const waitingCount = normalizeMetricValue(queueMeta.waitingCount, 0);
    const calledCount = normalizeMetricValue(queueMeta.calledCount, 0);
    const completedCount = normalizeMetricValue(counts.completed, 0);
    const noShowCount = normalizeMetricValue(counts.no_show, 0);
    const cancelledCount = normalizeMetricValue(counts.cancelled, 0);
    const observedTotal =
        waitingCount +
        calledCount +
        completedCount +
        noShowCount +
        cancelledCount;
    const averageWaitMinutes = normalizeMetricValue(
        queueMeta.estimatedWaitMin,
        SAMPLE_PERFORMANCE_METRICS.averageWaitMinutes
    );
    const hasQueueSignals =
        observedTotal > 0 ||
        averageWaitMinutes > 0 ||
        normalizeMetricValue(queueMeta.assistancePendingCount, 0) > 0;
    const displayLatencyMs = normalizeMetricValue(
        queueSurfaceStatus?.display?.latest?.details?.displayLatencyMs ||
            queueSurfaceStatus?.display?.latest?.details?.latencyMs,
        SAMPLE_PERFORMANCE_METRICS.displayLatencyMs
    );

    if (!hasQueueSignals) {
        return { ...SAMPLE_PERFORMANCE_METRICS };
    }

    return {
        averageWaitMinutes: averageWaitMinutes || 0,
        p95WaitMinutes:
            averageWaitMinutes > 0
                ? Math.max(roundTo(averageWaitMinutes * 1.8, 1, 24), 24)
                : SAMPLE_PERFORMANCE_METRICS.p95WaitMinutes,
        abandonmentRate:
            observedTotal > 0
                ? roundTo((noShowCount / observedTotal) * 100, 1, 4)
                : SAMPLE_PERFORMANCE_METRICS.abandonmentRate,
        displayLatencyMs,
    };
}

function deriveBaseArrivalsPerHour(queueMeta = {}) {
    const counts = asObject(queueMeta.counts);
    const waitingCount = normalizeMetricValue(queueMeta.waitingCount, 0);
    const calledCount = normalizeMetricValue(queueMeta.calledCount, 0);
    const completedCount = normalizeMetricValue(counts.completed, 0);
    const estimatedWaitMin = normalizeMetricValue(
        queueMeta.estimatedWaitMin,
        0
    );
    const derived = waitingCount + calledCount + completedCount;

    if (derived > 0) {
        return Math.max(12, derived);
    }

    if (estimatedWaitMin > 0) {
        return Math.max(12, Math.round(estimatedWaitMin + 3));
    }

    return SAMPLE_BASE_ARRIVALS_PER_HOUR;
}

function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function buildTurneroReleaseTelemetryOptimizationHubPack(
    input = {},
    experimentRows = [],
    backlogRows = []
) {
    const clinicProfile = asObject(
        input.clinicProfile || input.turneroClinicProfile || {}
    );
    const queueMeta = asObject(input.queueMeta || {});
    const queueSurfaceStatus = asObject(input.queueSurfaceStatus || {});
    const releaseEvidenceBundle = asObject(
        input.releaseEvidenceBundle ||
            input.turneroReleaseEvidenceBundle ||
            clinicProfile.releaseEvidenceBundle ||
            {}
    );
    const scope = normalizeScope(
        clinicProfile.region || input.scope || input.region || DEFAULT_SCOPE
    );
    const region = normalizeScope(
        input.region || clinicProfile.region || DEFAULT_SCOPE
    );
    const surfaces =
        Array.isArray(input.surfaces) && input.surfaces.length
            ? input.surfaces
            : deriveCatalogSurfaces({ clinicProfile });
    const clinics = deriveClinicsFromEvidence(
        clinicProfile,
        releaseEvidenceBundle
    );
    const catalog = buildTurneroReleaseTelemetryEventCatalog({ surfaces });
    const funnel = buildTurneroReleaseFunnelObservatory({
        metrics:
            input.metrics && Object.keys(asObject(input.metrics)).length > 0
                ? input.metrics
                : deriveFunnelMetrics(queueMeta),
    });
    const simulation = buildTurneroReleaseCapacitySimulationLab({
        clinics,
        baseArrivalsPerHour: normalizeMetricValue(
            input.baseArrivalsPerHour,
            deriveBaseArrivalsPerHour(queueMeta)
        ),
    });
    const bench = buildTurneroReleaseQueuePerformanceBench({
        performanceMetrics:
            input.performanceMetrics &&
            Object.keys(asObject(input.performanceMetrics)).length > 0
                ? input.performanceMetrics
                : derivePerformanceMetrics(queueMeta, queueSurfaceStatus),
    });
    const surfaceSnapshots = collectSurfaceSnapshots(queueSurfaceStatus);
    const experiments = cloneRows(experimentRows);
    const backlog = cloneRows(backlogRows);
    const score = buildTurneroReleaseOptimizationReadinessScore({
        funnel,
        bench,
        experiments,
        backlog,
        simulation,
    });

    return {
        scope,
        region,
        clinicProfile,
        queueMeta,
        queueSurfaceStatus,
        releaseEvidenceBundle,
        surfaces,
        clinics,
        surfaceSnapshots,
        catalog,
        funnel,
        simulation,
        bench,
        experiments,
        backlog,
        score,
        generatedAt: new Date().toISOString(),
    };
}

function createScopedRegistry(storageKey, scope = DEFAULT_SCOPE) {
    const normalizedScope = normalizeScope(scope);

    return {
        scope: normalizedScope,
        list() {
            return getScopedRows(storageKey, normalizedScope);
        },
        add(entry = {}) {
            const rows = getScopedRows(storageKey, normalizedScope);
            const next =
                storageKey === EXPERIMENT_REGISTRY_STORAGE_KEY
                    ? {
                          id: toText(entry.id, `exp-${Date.now()}`),
                          title: toText(entry.title, 'Experiment'),
                          owner: toText(entry.owner, 'product'),
                          hypothesis: toText(entry.hypothesis, ''),
                          status: toText(entry.status, 'planned'),
                          expectedGain: normalizeMetricValue(
                              entry.expectedGain,
                              0
                          ),
                          createdAt: toText(
                              entry.createdAt,
                              new Date().toISOString()
                          ),
                      }
                    : {
                          id: toText(entry.id, `opt-${Date.now()}`),
                          title: toText(entry.title, 'Optimization item'),
                          owner: toText(entry.owner, 'ops'),
                          impact: toText(entry.impact, 'medium'),
                          effort: toText(entry.effort, 'medium'),
                          status: toText(entry.status, 'open'),
                          createdAt: toText(
                              entry.createdAt,
                              new Date().toISOString()
                          ),
                      };

            setScopedRows(
                storageKey,
                normalizedScope,
                [next, ...rows].slice(
                    0,
                    storageKey === EXPERIMENT_REGISTRY_STORAGE_KEY ? 200 : 250
                )
            );
            return next;
        },
        clear() {
            deleteScopedRows(storageKey, normalizedScope);
        },
    };
}

function renderSurfaceSnapshots(surfaceSnapshots = []) {
    const items = surfaceSnapshots
        .map(
            (surface) => `
                <li>
                    <strong>${escapeHtml(surface.label)}</strong>
                    <span>${escapeHtml(surface.deviceLabel)}</span>
                    <span>${escapeHtml(surface.state)}</span>
                    <span>${escapeHtml(surface.summary)}</span>
                    <span>${escapeHtml(surface.ageLabel)}</span>
                </li>
            `
        )
        .join('');

    return items
        ? `<ul class="queue-app-card__notes">${items}</ul>`
        : '<p class="queue-app-card__description">Sin superficies reportando.</p>';
}

function groupCatalogRows(rows = []) {
    const grouped = new Map();

    rows.forEach((row) => {
        const key = toText(row.surfaceId, 'surface');
        const entry = grouped.get(key) || {
            surfaceId: key,
            surfaceLabel: toText(row.surfaceLabel, key),
            owner: toText(row.owner, 'ops'),
            rows: [],
            high: 0,
            medium: 0,
        };
        entry.rows.push(row);
        entry.high += row.criticality === 'high' ? 1 : 0;
        entry.medium += row.criticality === 'medium' ? 1 : 0;
        grouped.set(key, entry);
    });

    return Array.from(grouped.values()).map((entry) => ({
        ...entry,
        eventSummary: entry.rows
            .slice(0, 3)
            .map((row) => row.eventKey)
            .join(', '),
        extraEvents: Math.max(0, entry.rows.length - 3),
    }));
}

function renderList(items, renderItem, emptyLabel) {
    if (!items.length) {
        return `<p class="queue-app-card__description">${escapeHtml(
            emptyLabel
        )}</p>`;
    }

    return `<ul class="queue-app-card__notes">${items
        .map(renderItem)
        .join('')}</ul>`;
}

function buildTurneroReleaseTelemetryOptimizationHubBrief(pack) {
    const surfaceSummary = pack.surfaceSnapshots
        .map(
            (surface) =>
                `${surface.label}: ${surface.deviceLabel} · ${surface.state} · ${surface.summary}`
        )
        .join(' | ');

    return [
        '# Telemetry Optimization Hub',
        '',
        `Scope: ${pack.scope}`,
        `Region: ${pack.region}`,
        `Clinic: ${
            toText(
                pack.clinicProfile?.branding?.short_name ||
                    pack.clinicProfile?.branding?.name ||
                    pack.clinicProfile?.clinic_id,
                'n/a'
            ) || 'n/a'
        } (${toText(pack.clinicProfile?.clinic_id, 'n/a')})`,
        `Decision: ${pack.score.decision}`,
        `Score: ${pack.score.score.toFixed(1)} (${pack.score.band})`,
        `Catalog rows: ${pack.catalog.summary.all}`,
        `Funnel final conversion: ${pack.funnel.finalConversion.toFixed(1)}%`,
        `Performance bench: ${pack.bench.score.toFixed(1)} (${pack.bench.band})`,
        `Open backlog: ${pack.score.openBacklog}`,
        `Active experiments: ${pack.score.activeExperiments}`,
        `Surface snapshot: ${surfaceSummary || 'Sin señal'}`,
        `Generated: ${pack.generatedAt}`,
    ].join('\n');
}

function normalizeActionTarget(target) {
    if (!target || typeof target.getAttribute !== 'function') {
        return null;
    }

    if (typeof target.closest === 'function') {
        const closest = target.closest('[data-action]');
        if (closest && typeof closest.getAttribute === 'function') {
            return closest;
        }
    }

    return target.getAttribute('data-action') ? target : null;
}

function readInputValue(root, selector, fallback = '') {
    const node = root.querySelector(selector);
    return node && typeof node.value !== 'undefined'
        ? String(node.value || '').trim()
        : fallback;
}

function renderOptimizationHubMarkup(pack) {
    const statusState =
        pack.score.decision === 'hold'
            ? 'alert'
            : pack.score.decision === 'review'
              ? 'warning'
              : 'ready';
    const catalogRows = groupCatalogRows(pack.catalog.rows);
    const surfaceCount = pack.surfaces.length;
    const clinicCount = pack.clinics.length;
    const experimentCount = pack.experiments.length;
    const backlogCount = pack.backlog.length;
    const brief = pack.briefMarkdown || '';

    return `
        <section
            id="turneroReleaseTelemetryOptimizationHub"
            class="queue-app-card queue-telemetry-band turnero-release-telemetry-optimization-hub"
            data-state="${escapeHtml(pack.score.decision)}"
            data-band="${escapeHtml(pack.score.band)}"
            data-scope="${escapeHtml(pack.scope)}"
            data-region="${escapeHtml(pack.region)}"
            aria-labelledby="turneroReleaseTelemetryOptimizationHubTitle"
        >
            <div class="queue-premium-band__header">
                <div>
                    <p class="queue-premium-band__eyebrow">Telemetry optimization</p>
                    <h5 id="turneroReleaseTelemetryOptimizationHubTitle" class="queue-app-card__title">Telemetry Optimization Hub</h5>
                    <p class="queue-app-card__description">
                        Resumen compacto del catalogo, el funnel, la simulacion,
                        el bench y la evidencia viva para iterar el rollout sin
                        perder contexto operativo.
                    </p>
                    <p class="turnero-release-telemetry-optimization-hub__meta">
                        Scope ${escapeHtml(pack.scope)} · Region ${escapeHtml(
                            pack.region
                        )} · Clinics ${clinicCount} · Surfaces ${surfaceCount}
                    </p>
                </div>
                <div class="turnero-release-telemetry-optimization-hub__score">
                    <span
                        class="queue-surface-telemetry__status"
                        data-state="${escapeHtml(statusState)}"
                    >
                        ${escapeHtml(pack.score.decision)}
                    </span>
                    <strong data-role="hub-score">${escapeHtml(
                        pack.score.score.toFixed(1)
                    )}</strong>
                    <span data-role="hub-band">${escapeHtml(pack.score.band)}</span>
                </div>
            </div>

            <div class="turnero-release-telemetry-optimization-hub__stack" style="display:grid;gap:12px;">
                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Live surfaces</p>
                    <h6 class="queue-app-card__title">Señal viva del admin</h6>
                    <p class="queue-app-card__description">
                        La vista aprovecha el estado de operador, kiosco y sala
                        para mantener el criterio del hub alineado con la cola
                        actual.
                    </p>
                    ${renderSurfaceSnapshots(pack.surfaceSnapshots)}
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Readiness</p>
                    <h6 class="queue-app-card__title">Score de preparación</h6>
                    <p class="queue-app-card__description">
                        Decisión ${escapeHtml(pack.score.decision)} · band
                        ${escapeHtml(pack.score.band)} · Experimentos activos
                        ${experimentCount} · Backlog abierto ${backlogCount}
                    </p>
                    <ul class="queue-app-card__notes">
                        <li><strong>Readiness score</strong> ${escapeHtml(
                            pack.score.score.toFixed(1)
                        )}</li>
                        <li><strong>Funnel final</strong> ${escapeHtml(
                            `${pack.funnel.finalConversion.toFixed(1)}%`
                        )}</li>
                        <li><strong>Bench</strong> ${escapeHtml(
                            `${pack.bench.score.toFixed(1)} (${pack.bench.band})`
                        )}</li>
                        <li><strong>Simulation</strong> ${escapeHtml(
                            `${pack.simulation.totalStations} estaciones · ${pack.simulation.avgServiceMinutes.toFixed(1)} min`
                        )}</li>
                    </ul>
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Event catalog</p>
                    <h6 class="queue-app-card__title">Catálogo de eventos</h6>
                    <p class="queue-app-card__description">
                        ${escapeHtml(
                            `${pack.catalog.summary.all} eventos normalizados · ${pack.catalog.summary.high} altos · ${pack.catalog.summary.medium} medios`
                        )}
                    </p>
                    ${renderList(
                        catalogRows,
                        (row) => `
                            <li>
                                <strong>${escapeHtml(row.surfaceLabel)}</strong>
                                <span>${escapeHtml(
                                    `${row.rows.length} eventos`
                                )}</span>
                                <span>${escapeHtml(row.eventSummary)}</span>
                                <span>${escapeHtml(
                                    row.extraEvents > 0
                                        ? `+${row.extraEvents} más`
                                        : 'completo'
                                )}</span>
                            </li>
                        `,
                        'Sin eventos catalogados.'
                    )}
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Funnel</p>
                    <h6 class="queue-app-card__title">Observatorio del funnel</h6>
                    <p class="queue-app-card__description">
                        Conversión final ${escapeHtml(
                            `${pack.funnel.finalConversion.toFixed(1)}%`
                        )} · decaimiento revisado por turno.
                    </p>
                    ${renderList(
                        pack.funnel.rows,
                        (stage) => `
                            <li>
                                <strong>${escapeHtml(stage.label)}</strong>
                                <span>${escapeHtml(String(stage.value))}</span>
                                <span>${escapeHtml(
                                    `${stage.conversionFromPrevious.toFixed(1)}% prev`
                                )}</span>
                                <span>${escapeHtml(
                                    `${stage.conversionFromStart.toFixed(1)}% base`
                                )}</span>
                            </li>
                        `,
                        'Sin funnel disponible.'
                    )}
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Simulation</p>
                    <h6 class="queue-app-card__title">Laboratorio de capacidad</h6>
                    <p class="queue-app-card__description">
                        ${escapeHtml(
                            `${pack.simulation.totalStations} estaciones · ${pack.simulation.avgServiceMinutes.toFixed(1)} min promedio`
                        )}
                    </p>
                    ${renderList(
                        pack.simulation.scenarios,
                        (scenario) => `
                            <li>
                                <strong>${escapeHtml(scenario.key)}</strong>
                                <span>${escapeHtml(
                                    `${scenario.arrivalsPerHour} llegadas/h`
                                )}</span>
                                <span>${escapeHtml(
                                    `${scenario.throughputPerHour} throughput/h`
                                )}</span>
                                <span>${escapeHtml(
                                    `${scenario.utilization}% ${scenario.state}`
                                )}</span>
                            </li>
                        `,
                        'Sin escenarios de simulacion.'
                    )}
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Bench</p>
                    <h6 class="queue-app-card__title">Rendimiento operativo</h6>
                    <p class="queue-app-card__description">
                        ${escapeHtml(
                            `Score ${pack.bench.score.toFixed(1)} (${pack.bench.band}) · latencia visual ${pack.bench.displayLatencyMs} ms`
                        )}
                    </p>
                    <ul class="queue-app-card__notes">
                        <li><strong>Espera media</strong> ${escapeHtml(
                            `${pack.bench.averageWaitMinutes.toFixed(1)} min`
                        )}</li>
                        <li><strong>P95</strong> ${escapeHtml(
                            `${pack.bench.p95WaitMinutes.toFixed(1)} min`
                        )}</li>
                        <li><strong>Abandono</strong> ${escapeHtml(
                            `${pack.bench.abandonmentRate.toFixed(1)}%`
                        )}</li>
                        <li><strong>Latencia display</strong> ${escapeHtml(
                            `${Math.round(pack.bench.displayLatencyMs)} ms`
                        )}</li>
                    </ul>
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Experiments</p>
                    <h6 class="queue-app-card__title">Registro de experimentos</h6>
                    <p class="queue-app-card__description">
                        ${escapeHtml(
                            `${experimentCount} experimento(s) activos en este scope.`
                        )}
                    </p>
                    ${renderList(
                        pack.experiments.slice(0, 5),
                        (entry) => `
                            <li>
                                <strong>${escapeHtml(entry.title)}</strong>
                                <span>${escapeHtml(entry.owner)}</span>
                                <span>${escapeHtml(entry.status)}</span>
                                <span>${escapeHtml(
                                    `${entry.expectedGain} gain`
                                )}</span>
                            </li>
                        `,
                        'Sin experimentos guardados.'
                    )}
                    <div
                        class="turnero-release-telemetry-optimization-hub__form"
                        style="display:grid;gap:8px;margin-top:12px;"
                    >
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Titulo</span>
                            <input
                                type="text"
                                data-field="experiment-title"
                                placeholder="Optimization idea"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Owner</span>
                            <input
                                type="text"
                                data-field="experiment-owner"
                                placeholder="product"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Hipotesis</span>
                            <input
                                type="text"
                                data-field="experiment-hypothesis"
                                placeholder="Improves throughput"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Expected gain</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                data-field="experiment-gain"
                                placeholder="5"
                            />
                        </label>
                        <button
                            type="button"
                            class="queue-app-card__cta-primary"
                            data-action="add-experiment"
                        >
                            Add experiment
                        </button>
                    </div>
                </article>

                <article class="queue-app-card turnero-release-telemetry-optimization-hub__section">
                    <p class="queue-app-card__eyebrow">Backlog</p>
                    <h6 class="queue-app-card__title">Backlog de optimizacion</h6>
                    <p class="queue-app-card__description">
                        ${escapeHtml(`${backlogCount} item(s) pendientes.`)}
                    </p>
                    ${renderList(
                        pack.backlog.slice(0, 5),
                        (entry) => `
                            <li>
                                <strong>${escapeHtml(entry.title)}</strong>
                                <span>${escapeHtml(entry.owner)}</span>
                                <span>${escapeHtml(entry.impact)}</span>
                                <span>${escapeHtml(entry.effort)}</span>
                                <span>${escapeHtml(entry.status)}</span>
                            </li>
                        `,
                        'Sin backlog guardado.'
                    )}
                    <div
                        class="turnero-release-telemetry-optimization-hub__form"
                        style="display:grid;gap:8px;margin-top:12px;"
                    >
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Titulo</span>
                            <input
                                type="text"
                                data-field="backlog-title"
                                placeholder="Optimization item"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Owner</span>
                            <input
                                type="text"
                                data-field="backlog-owner"
                                placeholder="ops"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Impacto</span>
                            <input
                                type="text"
                                data-field="backlog-impact"
                                placeholder="medium"
                            />
                        </label>
                        <label class="turnero-release-telemetry-optimization-hub__field">
                            <span>Esfuerzo</span>
                            <input
                                type="text"
                                data-field="backlog-effort"
                                placeholder="medium"
                            />
                        </label>
                        <button
                            type="button"
                            class="queue-app-card__cta-primary"
                            data-action="add-backlog-item"
                        >
                            Add backlog item
                        </button>
                    </div>
                </article>
            </div>

            <div class="queue-app-card__actions">
                <button type="button" data-action="copy-optimization-brief">
                    Copy brief
                </button>
                <button type="button" data-action="copy-optimization-json">
                    Copy JSON
                </button>
                <button
                    type="button"
                    class="queue-app-card__cta-primary"
                    data-action="download-optimization-json"
                >
                    Download JSON
                </button>
            </div>

            <pre
                data-role="hub-brief"
                class="turnero-release-telemetry-optimization-hub__brief"
            >${escapeHtml(brief)}</pre>
        </section>
    `;
}

function renderHubIntoTarget(target, pack) {
    target.innerHTML = renderOptimizationHubMarkup(pack);
    return target.querySelector('#turneroReleaseTelemetryOptimizationHub');
}

export function buildTurneroReleaseTelemetryEventCatalog(input = {}) {
    const surfaces = Array.isArray(input.surfaces) ? input.surfaces : [];
    const rows = surfaces.flatMap((surface, index) => {
        const surfaceId = toText(surface.id, `surface-${index + 1}`);
        const surfaceLabel = toText(surface.label, `Surface ${index + 1}`);
        const events =
            Array.isArray(surface.events) && surface.events.length > 0
                ? surface.events
                : ['open', 'ready', 'queue_sync', 'handoff', 'refresh'];

        return events.map((eventKey, eventIndex) => ({
            id: `${surfaceId}:${eventIndex + 1}`,
            surfaceId,
            surfaceLabel,
            eventKey: toText(eventKey, 'event'),
            owner: toText(surface.owner, 'ops'),
            criticality: ['queue_sync', 'handoff'].includes(eventKey)
                ? 'high'
                : 'medium',
        }));
    });

    return {
        rows,
        summary: {
            all: rows.length,
            high: rows.filter((row) => row.criticality === 'high').length,
            medium: rows.filter((row) => row.criticality === 'medium').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseFunnelObservatory(input = {}) {
    const metrics = asObject(input.metrics);
    const stages = [
        {
            key: 'issued',
            label: 'Turnos emitidos',
            value: normalizeMetricValue(
                metrics.issued,
                SAMPLE_FUNNEL_METRICS.issued
            ),
        },
        {
            key: 'announced',
            label: 'Turnos anunciados',
            value: normalizeMetricValue(
                metrics.announced,
                SAMPLE_FUNNEL_METRICS.announced
            ),
        },
        {
            key: 'attended',
            label: 'Turnos atendidos',
            value: normalizeMetricValue(
                metrics.attended,
                SAMPLE_FUNNEL_METRICS.attended
            ),
        },
        {
            key: 'completed',
            label: 'Atenciones completadas',
            value: normalizeMetricValue(
                metrics.completed,
                SAMPLE_FUNNEL_METRICS.completed
            ),
        },
    ];

    const first = stages[0]?.value || 0;
    const rows = stages.map((stage, index) => {
        const previous =
            index === 0 ? stage.value : stages[index - 1].value || 0;
        const conversionFromPrevious =
            previous > 0 ? roundTo((stage.value / previous) * 100, 1, 0) : 0;
        const conversionFromStart =
            first > 0 ? roundTo((stage.value / first) * 100, 1, 0) : 0;

        return {
            ...stage,
            conversionFromPrevious,
            conversionFromStart,
        };
    });

    return {
        rows,
        finalConversion: rows.length
            ? rows[rows.length - 1].conversionFromStart
            : 0,
        generatedAt: new Date().toISOString(),
    };
}

export function createTurneroReleaseExperimentRegistry(scope = DEFAULT_SCOPE) {
    return createScopedRegistry(EXPERIMENT_REGISTRY_STORAGE_KEY, scope);
}

export function buildTurneroReleaseCapacitySimulationLab(input = {}) {
    const clinics = Array.isArray(input.clinics)
        ? input.clinics.map((clinic, index) => ({
              clinicId: toText(
                  clinic?.clinicId || clinic?.clinic_id || clinic?.id,
                  `clinic-${index + 1}`
              ),
              stations: Math.max(
                  1,
                  Math.round(normalizeMetricValue(clinic?.stations ?? 1, 1))
              ),
              avgServiceMinutes: roundTo(
                  normalizeMetricValue(clinic?.avgServiceMinutes ?? 12, 12),
                  1,
                  12
              ),
          }))
        : [];
    const totalStations = clinics.reduce(
        (sum, clinic) => sum + normalizeMetricValue(clinic.stations, 1),
        0
    );
    const avgServiceMinutes = clinics.length
        ? clinics.reduce(
              (sum, clinic) =>
                  sum + normalizeMetricValue(clinic.avgServiceMinutes, 12),
              0
          ) / clinics.length
        : 12;

    const scenarios = [
        { key: 'base', multiplier: 1 },
        { key: 'peak', multiplier: 1.25 },
        { key: 'stress', multiplier: 1.5 },
    ].map((scenario) => {
        const arrivalsPerHour = roundTo(
            normalizeMetricValue(
                input.baseArrivalsPerHour,
                SAMPLE_BASE_ARRIVALS_PER_HOUR
            ) * scenario.multiplier,
            1,
            SAMPLE_BASE_ARRIVALS_PER_HOUR
        );
        const throughputPerHour =
            avgServiceMinutes > 0
                ? roundTo(
                      (60 / avgServiceMinutes) * Math.max(1, totalStations),
                      1,
                      0
                  )
                : 0;
        const utilization =
            throughputPerHour > 0
                ? roundTo((arrivalsPerHour / throughputPerHour) * 100, 1, 0)
                : 0;
        const state =
            utilization >= 95
                ? 'overloaded'
                : utilization >= 75
                  ? 'watch'
                  : 'healthy';

        return {
            ...scenario,
            arrivalsPerHour,
            throughputPerHour,
            utilization,
            state,
        };
    });

    return {
        totalStations,
        avgServiceMinutes: roundTo(avgServiceMinutes, 1, 12),
        scenarios,
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroReleaseQueuePerformanceBench(input = {}) {
    const metrics = asObject(input.performanceMetrics);
    const averageWaitMinutes = normalizeMetricValue(
        metrics.averageWaitMinutes,
        SAMPLE_PERFORMANCE_METRICS.averageWaitMinutes
    );
    const p95WaitMinutes = normalizeMetricValue(
        metrics.p95WaitMinutes,
        SAMPLE_PERFORMANCE_METRICS.p95WaitMinutes
    );
    const abandonmentRate = normalizeMetricValue(
        metrics.abandonmentRate,
        SAMPLE_PERFORMANCE_METRICS.abandonmentRate
    );
    const displayLatencyMs = normalizeMetricValue(
        metrics.displayLatencyMs,
        SAMPLE_PERFORMANCE_METRICS.displayLatencyMs
    );

    let score = 100;
    score -= averageWaitMinutes * 1.5;
    score -= p95WaitMinutes * 0.7;
    score -= abandonmentRate * 2.5;
    score -= displayLatencyMs / 120;
    score = Math.max(0, Math.min(100, roundTo(score, 1, 0)));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'recovery';

    return {
        averageWaitMinutes,
        p95WaitMinutes,
        abandonmentRate,
        displayLatencyMs,
        score,
        band,
        generatedAt: new Date().toISOString(),
    };
}

export function createTurneroReleaseOptimizationBacklog(scope = DEFAULT_SCOPE) {
    return createScopedRegistry(OPTIMIZATION_BACKLOG_STORAGE_KEY, scope);
}

export function buildTurneroReleaseOptimizationReadinessScore(input = {}) {
    const funnel = asObject(input.funnel);
    const bench = asObject(input.bench);
    const experiments = Array.isArray(input.experiments)
        ? input.experiments
        : [];
    const backlog = Array.isArray(input.backlog) ? input.backlog : [];
    const simulation = asObject(input.simulation);

    const activeExperiments = experiments.filter(
        (item) => toText(item?.status, 'planned') !== 'closed'
    ).length;
    const openBacklog = backlog.filter(
        (item) => toText(item?.status, 'open') !== 'closed'
    ).length;
    const stressedScenarios = Array.isArray(simulation.scenarios)
        ? simulation.scenarios.filter((item) => item.state === 'overloaded')
              .length
        : 0;

    let score = 0;
    score += normalizeMetricValue(funnel.finalConversion, 0) * 0.3;
    score += normalizeMetricValue(bench.score, 0) * 0.4;
    score += Math.max(0, 100 - openBacklog * 6) * 0.15;
    score +=
        Math.max(0, 100 - activeExperiments * 4 - stressedScenarios * 12) *
        0.15;
    score = Math.max(0, Math.min(100, roundTo(score, 1, 0)));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'recovery';

    return {
        score,
        band,
        decision: score < 55 ? 'hold' : score < 75 ? 'review' : 'ready',
        activeExperiments,
        openBacklog,
        stressedScenarios,
        generatedAt: new Date().toISOString(),
    };
}

export function mountTurneroReleaseTelemetryOptimizationHub(
    target,
    input = {}
) {
    const resolvedTarget = resolveTarget(target);
    if (!resolvedTarget) {
        return null;
    }

    const scope = normalizeScope(
        input.scope ||
            input.region ||
            input.clinicProfile?.region ||
            input.turneroClinicProfile?.region
    );
    const experimentRegistry = createTurneroReleaseExperimentRegistry(scope);
    const backlogRegistry = createTurneroReleaseOptimizationBacklog(scope);
    const pack = buildTurneroReleaseTelemetryOptimizationHubPack(
        {
            ...input,
            scope,
            region: input.region || scope,
        },
        experimentRegistry.list(),
        backlogRegistry.list()
    );

    pack.briefMarkdown = buildTurneroReleaseTelemetryOptimizationHubBrief(pack);
    pack.clipboardSummary = pack.briefMarkdown;
    pack.snapshotFileName = 'turnero-release-telemetry-optimization-pack.json';
    pack.snapshot = {
        ...pack,
        catalog: pack.catalog,
        funnel: pack.funnel,
        simulation: pack.simulation,
        bench: pack.bench,
        score: pack.score,
        experiments: pack.experiments,
        backlog: pack.backlog,
        surfaceSnapshots: pack.surfaceSnapshots,
        briefMarkdown: pack.briefMarkdown,
    };

    const root = document.createElement('section');
    root.className = 'turnero-release-telemetry-optimization-hub-root';
    root.innerHTML = renderOptimizationHubMarkup(pack);

    resolvedTarget.innerHTML = '';
    resolvedTarget.appendChild(root);

    const section = root.querySelector(
        '#turneroReleaseTelemetryOptimizationHub'
    );
    if (section instanceof HTMLElement) {
        section.dataset.turneroScope = pack.scope;
        section.dataset.turneroRegion = pack.region;
    }

    const recompute = () => {
        const nextPack = buildTurneroReleaseTelemetryOptimizationHubPack(
            {
                ...input,
                scope,
                region: input.region || scope,
            },
            experimentRegistry.list(),
            backlogRegistry.list()
        );
        nextPack.briefMarkdown =
            buildTurneroReleaseTelemetryOptimizationHubBrief(nextPack);
        nextPack.clipboardSummary = nextPack.briefMarkdown;
        nextPack.snapshotFileName =
            'turnero-release-telemetry-optimization-pack.json';
        nextPack.snapshot = {
            ...nextPack,
            catalog: nextPack.catalog,
            funnel: nextPack.funnel,
            simulation: nextPack.simulation,
            bench: nextPack.bench,
            score: nextPack.score,
            experiments: nextPack.experiments,
            backlog: nextPack.backlog,
            surfaceSnapshots: nextPack.surfaceSnapshots,
            briefMarkdown: nextPack.briefMarkdown,
        };
        pack.catalog = nextPack.catalog;
        pack.funnel = nextPack.funnel;
        pack.simulation = nextPack.simulation;
        pack.bench = nextPack.bench;
        pack.experiments = nextPack.experiments;
        pack.backlog = nextPack.backlog;
        pack.score = nextPack.score;
        pack.surfaceSnapshots = nextPack.surfaceSnapshots;
        pack.generatedAt = nextPack.generatedAt;
        pack.briefMarkdown = nextPack.briefMarkdown;
        pack.clipboardSummary = nextPack.clipboardSummary;
        pack.snapshot = nextPack.snapshot;
        root.innerHTML = renderOptimizationHubMarkup(pack);
    };

    root.addEventListener('click', async (event) => {
        const actionNode = normalizeActionTarget(event.target);
        const action = actionNode?.getAttribute('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-optimization-brief') {
            await copyToClipboardSafe(pack.briefMarkdown);
            return;
        }

        if (action === 'copy-optimization-json') {
            await copyToClipboardSafe(safeJsonStringify(pack.snapshot));
            return;
        }

        if (action === 'download-optimization-json') {
            downloadJsonSnapshot(pack.snapshotFileName, pack.snapshot);
            return;
        }

        if (action === 'add-experiment') {
            const title = readInputValue(
                root,
                '[data-field="experiment-title"]'
            );
            if (!title) {
                return;
            }

            const owner = readInputValue(
                root,
                '[data-field="experiment-owner"]',
                'product'
            );
            const hypothesis = readInputValue(
                root,
                '[data-field="experiment-hypothesis"]'
            );
            const expectedGain = readInputValue(
                root,
                '[data-field="experiment-gain"]'
            );

            experimentRegistry.add({
                title,
                owner,
                hypothesis,
                expectedGain: normalizeMetricValue(expectedGain, 0),
                status: 'planned',
            });
            recompute();
            return;
        }

        if (action === 'add-backlog-item') {
            const title = readInputValue(root, '[data-field="backlog-title"]');
            if (!title) {
                return;
            }

            const owner = readInputValue(
                root,
                '[data-field="backlog-owner"]',
                'ops'
            );
            const impact = readInputValue(
                root,
                '[data-field="backlog-impact"]',
                'medium'
            );
            const effort = readInputValue(
                root,
                '[data-field="backlog-effort"]',
                'medium'
            );

            backlogRegistry.add({
                title,
                owner,
                impact,
                effort,
                status: 'open',
            });
            recompute();
        }
    });

    return { root, pack, recompute };
}
