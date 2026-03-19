import { buildTurneroReleaseDomainRegistry } from './turnero-release-domain-registry.js';
import { buildTurneroReleaseIntegrationInventory } from './turnero-release-integration-inventory.js';
import { buildTurneroReleaseWireCoverageMatrix } from './turnero-release-wire-coverage-matrix.js';
import { buildTurneroReleaseDuplicateSignalDetector } from './turnero-release-duplicate-signal-detector.js';
import { createTurneroReleaseGapLedger } from './turnero-release-gap-ledger.js';
import { buildTurneroReleaseConvergenceScore } from './turnero-release-convergence-score.js';
import { buildTurneroReleaseDiagnosticBrief } from './turnero-release-diagnostic-brief-builder.js';
import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

const DEFAULT_REPO_DOMAINS = Object.freeze([
    {
        key: 'governance',
        label: 'Governance',
        owner: 'program',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'assurance',
        label: 'Assurance',
        owner: 'program',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'reliability',
        label: 'Reliability',
        owner: 'infra',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'service',
        label: 'Service Excellence',
        owner: 'ops',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'privacy',
        label: 'Safety Privacy',
        owner: 'governance',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'integration',
        label: 'Integration',
        owner: 'infra',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'telemetry',
        label: 'Telemetry',
        owner: 'ops',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'strategy',
        label: 'Strategy',
        owner: 'program',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
    {
        key: 'orchestration',
        label: 'Orchestration',
        owner: 'ops',
        mounted: true,
        surface: 'admin-queue',
        maturity: 'active',
    },
]);

const DEFAULT_REPO_SURFACES = Object.freeze([
    {
        id: 'admin-queue',
        label: 'Admin Queue',
        domains: [
            'governance',
            'assurance',
            'reliability',
            'service',
            'privacy',
            'integration',
            'telemetry',
            'strategy',
            'orchestration',
        ],
    },
    {
        id: 'operator-turnos',
        label: 'Operator Turnos',
        domains: ['service', 'integration', 'reliability'],
    },
    {
        id: 'kiosco-turnos',
        label: 'Kiosco Turnos',
        domains: ['service', 'integration'],
    },
    {
        id: 'sala-turnos',
        label: 'Sala Turnos',
        domains: ['service', 'integration'],
    },
]);

const DEFAULT_REPO_SIGNALS = Object.freeze([
    {
        id: 'sig-1',
        domain: 'integration',
        owner: 'infra',
        label: 'Public sync freshness drift',
        route: 'owner-workbench',
    },
    {
        id: 'sig-2',
        domain: 'integration',
        owner: 'infra',
        label: 'Public sync freshness drift',
        route: 'war-room',
    },
    {
        id: 'sig-3',
        domain: 'service',
        owner: 'ops',
        label: 'Change saturation in cohort B',
        route: 'owner-workbench',
    },
    {
        id: 'sig-4',
        domain: 'governance',
        owner: 'program',
        label: 'Board actions overdue',
        route: 'backlog',
    },
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

function asClinicProfile(input = {}) {
    return asObject(input.clinicProfile || input.turneroClinicProfile || {});
}

function resolveClinicId(input = {}, clinicProfile = {}) {
    return toText(
        input.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
}

function resolveRegion(input = {}, clinicProfile = {}) {
    return toText(input.region || clinicProfile.region || '', '');
}

function resolveScope(input = {}, clinicProfile = {}) {
    const clinicId = resolveClinicId(input, clinicProfile);
    if (clinicId) {
        return clinicId;
    }

    const region = resolveRegion(input, clinicProfile);
    if (region) {
        return region;
    }

    return toText(input.scope, 'global');
}

function resolveClinicLabel(input = {}, clinicProfile = {}, scope = 'global') {
    return toText(
        clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicProfile.clinic_name ||
            clinicProfile.clinicName ||
            input.clinicLabel ||
            input.clinicShortName ||
            resolveClinicId(input, clinicProfile) ||
            scope,
        scope
    );
}

function buildRepoDiagnosticPack(input = {}, gapStore = null) {
    const clinicProfile = asClinicProfile(input);
    const scope = resolveScope(input, clinicProfile);
    const region = resolveRegion(input, clinicProfile);
    const clinicId = resolveClinicId(input, clinicProfile);
    const clinicLabel = resolveClinicLabel(input, clinicProfile, scope);
    const domains = Array.isArray(input.domains)
        ? input.domains
        : DEFAULT_REPO_DOMAINS;
    const surfaces = Array.isArray(input.surfaces)
        ? input.surfaces
        : DEFAULT_REPO_SURFACES;
    const signals = Array.isArray(input.signals)
        ? input.signals
        : DEFAULT_REPO_SIGNALS;

    const registry = buildTurneroReleaseDomainRegistry({
        domains,
    });
    const inventory = buildTurneroReleaseIntegrationInventory({
        registryRows: registry.rows,
        surfaces,
    });
    const coverage = buildTurneroReleaseWireCoverageMatrix({
        surfaces,
        inventoryRows: inventory.rows,
    });
    const duplicates = buildTurneroReleaseDuplicateSignalDetector({
        signals,
    });
    const gaps = gapStore
        ? gapStore.list()
        : createTurneroReleaseGapLedger(scope).list();
    const convergence = buildTurneroReleaseConvergenceScore({
        scope,
        region,
        clinicId,
        clinicProfile,
        registrySummary: registry.summary,
        inventorySummary: inventory.summary,
        coverageRows: coverage.rows,
        duplicateSummary: duplicates.summary,
        gaps,
    });
    const diagnosticBrief = buildTurneroReleaseDiagnosticBrief({
        clinicLabel,
        clinicShortName: clinicProfile.branding?.short_name || clinicLabel,
        clinicId,
        region,
        scope,
        convergence,
        inventorySummary: inventory.summary,
        duplicateSummary: duplicates.summary,
        gaps,
        coverageRows: coverage.rows,
    });
    const generatedAt = new Date().toISOString();

    const pack = {
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicProfile,
        registry,
        inventory,
        coverage,
        duplicates,
        gaps,
        convergence,
        diagnosticBrief,
        generatedAt,
        snapshotFileName: 'turnero-release-repo-diagnostic-pack.json',
    };

    pack.clipboardSummary = diagnosticBrief.markdown;
    pack.snapshot = {
        scope: pack.scope,
        region: pack.region,
        clinicId: pack.clinicId,
        clinicLabel: pack.clinicLabel,
        clinicProfile: pack.clinicProfile,
        registry: pack.registry,
        inventory: pack.inventory,
        coverage: pack.coverage,
        duplicates: pack.duplicates,
        gaps: pack.gaps,
        convergence: pack.convergence,
        diagnosticBrief: pack.diagnosticBrief,
        generatedAt: pack.generatedAt,
    };

    return pack;
}

function renderPreviewRows(rows = [], options = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const emptyLabel = toText(options.emptyLabel || 'Sin elementos');
    const limit = Number(options.limit || 3);
    const tone = toText(options.tone || 'ready');
    const formatter =
        typeof options.formatter === 'function'
            ? options.formatter
            : (row) => toText(row.label || row.key || row.surfaceId || row.id);

    if (!list.length) {
        return `<li data-state="${escapeHtml(tone)}">${escapeHtml(emptyLabel)}</li>`;
    }

    return list
        .slice(0, limit)
        .map((row) => {
            const label = formatter(row);
            const detail = toText(options.detail ? options.detail(row) : '');
            const state = toText(
                options.state ? options.state(row) : row.state || tone,
                tone
            );
            return `
                <li data-state="${escapeHtml(state)}">
                    <strong>${escapeHtml(label)}</strong>
                    ${
                        detail
                            ? `<span>${escapeHtml(detail)}</span>`
                            : '<span>&nbsp;</span>'
                    }
                </li>
            `;
        })
        .join('');
}

function stateFromBand(band = 'stable') {
    if (band === 'fragmented') {
        return 'alert';
    }

    if (band === 'watch') {
        return 'warning';
    }

    return 'ready';
}

function renderRepoDiagnosticMarkup(pack) {
    const openGaps = pack.gaps.filter((item) => item.status !== 'closed');
    const coveragePreview = [...pack.coverage.rows]
        .sort((a, b) => Number(a.coveragePct || 0) - Number(b.coveragePct || 0))
        .slice(0, 4);
    const duplicatePreview = pack.duplicates.rows.slice(0, 4);
    const registryPreview = pack.registry.rows.slice(0, 5);

    return `
        <section
            id="turneroReleaseRepoDiagnosticPrepHub"
            class="turnero-release-repo-diagnostic-prep-hub"
            data-turnero-scope="${escapeHtml(pack.scope)}"
            data-turnero-region="${escapeHtml(pack.region)}"
            data-turnero-clinic-id="${escapeHtml(pack.clinicId)}"
            data-state="${escapeHtml(stateFromBand(pack.convergence.band))}"
            data-band="${escapeHtml(pack.convergence.band)}"
            data-decision="${escapeHtml(pack.convergence.decision)}"
        >
            <div class="card">
                <h3>Repo Diagnostic Prep Hub</h3>
                <p>Inventario, cobertura, duplicados, gaps y convergencia para preparar el diagnóstico final del repo/panel.</p>

                <div class="grid">
                    <div>
                        <strong>Convergence</strong><br>
                        <span data-role="score">${escapeHtml(String(pack.convergence.score))}</span> / ${escapeHtml(pack.convergence.band)}
                    </div>
                    <div>
                        <strong>Decision</strong><br>
                        ${escapeHtml(pack.convergence.decision)}
                    </div>
                    <div>
                        <strong>Registry</strong><br>
                        ${escapeHtml(String(pack.registry.summary.mounted))} / ${escapeHtml(String(pack.registry.summary.all))}
                    </div>
                    <div>
                        <strong>Open gaps</strong><br>
                        <span data-role="gap-count">${escapeHtml(String(openGaps.length))}</span>
                    </div>
                </div>

                <div class="grid" style="margin-top:12px;">
                    <div>
                        <strong>Inventory</strong><br>
                        ${escapeHtml(String(pack.inventory.summary.present))} present · ${escapeHtml(String(pack.inventory.summary.partial))} partial · ${escapeHtml(String(pack.inventory.summary.missing))} missing
                    </div>
                    <div>
                        <strong>Clinic</strong><br>
                        ${escapeHtml(pack.clinicLabel)}
                    </div>
                    <div>
                        <strong>Generated</strong><br>
                        ${escapeHtml(formatDateTime(pack.generatedAt))}
                    </div>
                    <div>
                        <strong>Duplicates</strong><br>
                        ${escapeHtml(String(pack.duplicates.summary.all))} groups
                    </div>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
                    <button type="button" data-action="copy-diagnostic-brief">Copy diagnostic brief</button>
                    <button type="button" data-action="download-diagnostic-json" class="queue-app-card__cta-primary">
                        Download diagnostic JSON
                    </button>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:16px;">
                    <section class="queue-app-card__panel">
                        <header class="queue-app-card__panel-head">
                            <p class="queue-app-card__eyebrow">Domain registry</p>
                            <h6>${escapeHtml(String(pack.registry.summary.all))} domain(s)</h6>
                        </header>
                        <ul class="queue-app-card__list">
                            ${renderPreviewRows(registryPreview, {
                                emptyLabel: 'Sin dominios',
                                formatter: (row) => row.label,
                                detail: (row) =>
                                    `${row.owner} · ${row.maturity}`,
                            })}
                        </ul>
                    </section>

                    <section class="queue-app-card__panel">
                        <header class="queue-app-card__panel-head">
                            <p class="queue-app-card__eyebrow">Wire coverage</p>
                            <h6>${escapeHtml(String(pack.coverage.rows.length))} surface(s)</h6>
                        </header>
                        <ul class="queue-app-card__list">
                            ${renderPreviewRows(coveragePreview, {
                                emptyLabel: 'Sin cobertura',
                                formatter: (row) => row.label,
                                detail: (row) =>
                                    `${row.coveragePct}% · ${row.state}`,
                            })}
                        </ul>
                    </section>

                    <section class="queue-app-card__panel">
                        <header class="queue-app-card__panel-head">
                            <p class="queue-app-card__eyebrow">Duplicate signals</p>
                            <h6>${escapeHtml(String(pack.duplicates.summary.all))} group(s)</h6>
                        </header>
                        <ul class="queue-app-card__list">
                            ${renderPreviewRows(duplicatePreview, {
                                emptyLabel: 'Sin duplicados',
                                formatter: (row) => row.id,
                                detail: (row) =>
                                    `${row.count} items · ${row.state}`,
                            })}
                        </ul>
                    </section>

                    <section class="queue-app-card__panel">
                        <header class="queue-app-card__panel-head">
                            <p class="queue-app-card__eyebrow">Gap ledger</p>
                            <h6>${escapeHtml(String(openGaps.length))} open gap(s)</h6>
                        </header>
                        <div style="display:grid;gap:8px;">
                            <ul class="queue-app-card__list">
                                ${renderPreviewRows(openGaps, {
                                    emptyLabel: 'Sin gaps abiertos',
                                    formatter: (row) => row.title,
                                    detail: (row) =>
                                        `${row.domain} · ${row.owner} · ${row.surface}`,
                                })}
                            </ul>
                            <input data-field="gap-title" placeholder="Gap title" style="width:100%;" />
                            <input data-field="gap-domain" placeholder="Domain" style="width:100%;" />
                            <input data-field="gap-owner" placeholder="Owner" style="width:100%;" />
                            <input data-field="gap-surface" placeholder="Surface" style="width:100%;" />
                            <button type="button" data-action="add-gap">Add gap</button>
                        </div>
                    </section>
                </div>

                <pre data-role="diagnostic-brief" style="white-space:pre-wrap;margin-top:16px;">${escapeHtml(pack.diagnosticBrief.markdown)}</pre>
            </div>
        </section>
    `;
}

export function mountTurneroReleaseRepoDiagnosticPrepHub(target, input = {}) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const scope = resolveScope(input, asClinicProfile(input));
    const gapStore = createTurneroReleaseGapLedger(scope);
    let pack = buildRepoDiagnosticPack(input, gapStore);
    let rootElement = null;

    const result = {
        root: null,
        pack,
        recompute: () => {},
    };

    const render = () => {
        const nextPack = buildRepoDiagnosticPack(input, gapStore);
        pack = nextPack;
        result.pack = nextPack;

        if (!rootElement) {
            rootElement = document.createElement('section');
            rootElement.className =
                'turnero-release-repo-diagnostic-prep-hub-root';
            rootElement.addEventListener('click', async (event) => {
                const action = event.target?.getAttribute?.('data-action');
                if (!action) {
                    return;
                }

                if (action === 'copy-diagnostic-brief') {
                    await copyToClipboardSafe(
                        pack.diagnosticBrief.markdown || ''
                    );
                    return;
                }

                if (action === 'download-diagnostic-json') {
                    downloadJsonSnapshot(pack.snapshotFileName, pack.snapshot);
                    return;
                }

                if (action === 'add-gap') {
                    const title =
                        rootElement.querySelector('[data-field="gap-title"]')
                            ?.value || '';
                    const domain =
                        rootElement.querySelector('[data-field="gap-domain"]')
                            ?.value || '';
                    const owner =
                        rootElement.querySelector('[data-field="gap-owner"]')
                            ?.value || '';
                    const surface =
                        rootElement.querySelector('[data-field="gap-surface"]')
                            ?.value || '';

                    if (!title.trim()) {
                        return;
                    }

                    gapStore.add({
                        title,
                        domain: domain || 'general',
                        owner: owner || 'ops',
                        surface: surface || 'admin-queue',
                        severity: 'medium',
                        status: 'open',
                    });
                    render();
                }
            });
        }

        rootElement.innerHTML = renderRepoDiagnosticMarkup(pack);

        if (typeof host.replaceChildren === 'function') {
            host.replaceChildren(rootElement);
        } else {
            host.innerHTML = '';
            host.appendChild(rootElement);
        }

        result.root = rootElement;
        return result;
    };

    result.recompute = render;

    return render();
}

export {
    buildTurneroReleaseDomainRegistry,
    buildTurneroReleaseIntegrationInventory,
    buildTurneroReleaseWireCoverageMatrix,
    buildTurneroReleaseDuplicateSignalDetector,
    createTurneroReleaseGapLedger,
    buildTurneroReleaseConvergenceScore,
    buildTurneroReleaseDiagnosticBrief,
    buildRepoDiagnosticPack,
};
