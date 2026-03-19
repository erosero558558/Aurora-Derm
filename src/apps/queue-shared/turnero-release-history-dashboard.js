import { copyToClipboardSafe } from './turnero-release-control-center.js';
import {
    createReleaseHistoryStore,
    normalizeReleaseSnapshot,
} from './turnero-release-history-store.js';
import {
    buildMultiRunComparisonPack,
    copyFriendlyHistorySummary,
    downloadHistoryPackJson,
} from './turnero-release-multi-run-pack.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';
import { toText } from './turnero-release-control-center.js';

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function getClinicId(input = {}, fallback = 'default-clinic') {
    return (
        toText(
            input.clinicId ||
                input.currentSnapshot?.clinicId ||
                input.snapshot?.clinicId ||
                input.baselineSnapshot?.clinicId ||
                input.selectedSnapshotA?.clinicId ||
                input.selectedSnapshotB?.clinicId ||
                fallback,
            fallback
        ) || fallback
    );
}

function getStorage(storageOverride) {
    if (
        storageOverride &&
        typeof storageOverride.getItem === 'function' &&
        typeof storageOverride.setItem === 'function'
    ) {
        return storageOverride;
    }

    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (_error) {
        return null;
    }
}

function isViewModel(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.pack &&
        value.summaryText &&
        Array.isArray(value.comparisonOptions)
    );
}

function buildComparisonOptionLabel(snapshot) {
    const normalized = normalizeReleaseSnapshot(snapshot || {});
    const parts = [
        normalized.label || normalized.clinicShortName || normalized.snapshotId,
        normalized.decision,
        normalized.severity,
    ]
        .map((entry) => toText(entry))
        .filter(Boolean);

    return parts.join(' · ') || normalized.snapshotId;
}

function buildComparisonOptionMeta(snapshot) {
    const normalized = normalizeReleaseSnapshot(snapshot || {});
    return [
        formatDateTime(normalized.savedAt || normalized.generatedAt || ''),
        `${Number(normalized.incidentCount || 0)} incidente(s)`,
        `${Number(normalized.surfaceCount || 0)} superficie(s)`,
    ]
        .map((entry) => toText(entry))
        .filter(Boolean)
        .join(' · ');
}

function buildComparisonOptions(
    snapshots,
    selectedSnapshotAId,
    selectedSnapshotBId
) {
    return (Array.isArray(snapshots) ? snapshots : [])
        .slice()
        .sort((left, right) => {
            const leftTime = new Date(
                left?.savedAt || left?.generatedAt || 0
            ).getTime();
            const rightTime = new Date(
                right?.savedAt || right?.generatedAt || 0
            ).getTime();

            if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
                return 0;
            }
            if (Number.isNaN(leftTime)) {
                return 1;
            }
            if (Number.isNaN(rightTime)) {
                return -1;
            }
            return rightTime - leftTime;
        })
        .map((snapshot) => {
            const normalized = normalizeReleaseSnapshot(snapshot || {});
            return {
                value: normalized.snapshotId,
                label: buildComparisonOptionLabel(normalized),
                meta: buildComparisonOptionMeta(normalized),
                isSelectedA:
                    normalized.snapshotId === toText(selectedSnapshotAId),
                isSelectedB:
                    normalized.snapshotId === toText(selectedSnapshotBId),
                isBaseline: Boolean(normalized.isBaseline),
                isCurrent: Boolean(normalized.isCurrent),
            };
        });
}

function buildSummaryHeadline(pack) {
    const baselineCompare = pack.baselineCompare || {};
    const pairDiff = pack.pairDiff || {};

    if (baselineCompare.reason === 'baseline_missing') {
        return 'Guarda un snapshot y fija un baseline para empezar a comparar.';
    }

    if (baselineCompare.reason === 'current_missing') {
        return 'No hay snapshot actual para comparar.';
    }

    const baselineText = baselineCompare.ok
        ? 'Current alineado con baseline'
        : baselineCompare.diff
          ? `${baselineCompare.diff.totalChanges} cambio(s) vs baseline`
          : 'Comparación baseline pendiente';
    const pairText =
        pairDiff.reason === 'pair_missing'
            ? 'elige A y B'
            : pairDiff.ok
              ? 'A/B alineados'
              : pairDiff.diff
                ? `${pairDiff.diff.totalChanges} cambio(s) entre A y B`
                : 'Comparación A/B pendiente';

    return `${baselineText} · ${pairText}`;
}

function buildSummaryTitle(clinicId, currentSnapshot) {
    const normalized = currentSnapshot
        ? normalizeReleaseSnapshot(currentSnapshot)
        : null;
    return `Historial de releases · ${
        normalized?.clinicShortName ||
        normalized?.clinicName ||
        toText(clinicId, 'default-clinic')
    }`;
}

function buildDiffTone(compare) {
    if (!compare) {
        return 'warning';
    }
    if (
        compare.reason === 'baseline_missing' ||
        compare.reason === 'pair_missing'
    ) {
        return 'warning';
    }
    if (compare.reason === 'current_missing') {
        return 'alert';
    }
    return compare.ok ? 'ready' : 'alert';
}

function renderCountTags(countMap, label) {
    const entries = Object.entries(toObject(countMap));
    if (!entries.length) {
        return `<span class="queue-app-card__tag" data-state="ready">${escapeHtml(
            `${label}: 0`
        )}</span>`;
    }

    return entries
        .slice(0, 5)
        .map(
            ([key, value]) =>
                `<span class="queue-app-card__tag" data-state="info">${escapeHtml(
                    `${key}: ${value}`
                )}</span>`
        )
        .join('');
}

function renderChangeList(changes, emptyLabel) {
    const items = Array.isArray(changes) ? changes.filter(Boolean) : [];
    if (!items.length) {
        return `<p class="queue-release-history-dashboard__muted">${escapeHtml(
            emptyLabel
        )}</p>`;
    }

    return `
        <ul class="queue-release-history-dashboard__delta-list">
            ${items
                .slice(0, 5)
                .map(
                    (change) => `
                        <li>
                            <strong>${escapeHtml(change.summary || change.label || change.kind || '')}</strong>
                            ${
                                change.before || change.after
                                    ? `<small>${escapeHtml(
                                          [
                                              change.before?.label ||
                                                  change.before?.title ||
                                                  change.before ||
                                                  '',
                                              change.after?.label ||
                                                  change.after?.title ||
                                                  change.after ||
                                                  '',
                                          ]
                                              .map((entry) => toText(entry))
                                              .filter(Boolean)
                                              .join(' → ')
                                      )}</small>`
                                    : ''
                            }
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function renderComparisonCard(title, compare, countsLabel) {
    const tone = buildDiffTone(compare);
    const diff = compare?.diff || null;
    const totalChanges = diff ? diff.totalChanges : 0;
    return `
        <article class="queue-release-history-dashboard__compare-card" data-state="${escapeHtml(
            tone
        )}">
            <header class="queue-release-history-dashboard__compare-head">
                <div>
                    <p class="queue-app-card__eyebrow">${escapeHtml(title)}</p>
                    <h6>${escapeHtml(
                        compare?.reason === 'baseline_missing'
                            ? 'Baseline pendiente'
                            : compare?.reason === 'current_missing'
                              ? 'Current pendiente'
                              : compare?.ok
                                ? 'Sin cambios'
                                : 'Cambios detectados'
                    )}</h6>
                </div>
                <span class="queue-app-card__tag" data-state="${escapeHtml(
                    tone
                )}">${escapeHtml(
                    compare?.reason === 'baseline_missing'
                        ? 'Sin baseline'
                        : compare?.reason === 'current_missing'
                          ? 'Sin current'
                          : compare?.ok
                            ? 'OK'
                            : `${totalChanges} cambio(s)`
                )}</span>
            </header>
            <p class="queue-release-history-dashboard__summary">
                ${escapeHtml(
                    compare?.reason === 'baseline_missing'
                        ? 'Configura un baseline para comparar el estado actual.'
                        : compare?.reason === 'current_missing'
                          ? 'No hay snapshot actual disponible para esta comparación.'
                          : compare?.ok
                            ? 'No se detectan cambios relevantes en esta comparación.'
                            : `Se detectaron ${totalChanges} cambio(s) en el corte comparado.`
                )}
            </p>
            ${renderChangeList(compare?.topDeltas || [], 'Sin deltas relevantes.')}
            <div class="queue-release-history-dashboard__counts">
                ${renderCountTags(compare?.ownerDeltaCounts, `${countsLabel} owners`)}
                ${renderCountTags(
                    compare?.severityDeltaCounts,
                    `${countsLabel} severity`
                )}
            </div>
        </article>
    `;
}

function renderOptionMarkup(option, selectedValue) {
    const isSelected = option.value === toText(selectedValue);
    const optionLabel = option.meta
        ? `${option.label} · ${option.meta}`
        : option.label;
    return `
        <option value="${escapeHtml(option.value)}"${
            isSelected ? ' selected' : ''
        }>${escapeHtml(optionLabel)}</option>
    `;
}

function renderSnapshotRow(snapshot) {
    return `
        <article
            class="queue-release-history-dashboard__timeline-item"
            data-snapshot-id="${escapeHtml(snapshot.snapshotId)}"
            data-state="${escapeHtml(
                snapshot.isCurrent
                    ? 'ready'
                    : snapshot.isBaseline
                      ? 'warning'
                      : snapshot.severity || 'info'
            )}"
        >
            <div class="queue-release-history-dashboard__timeline-copy">
                <div class="queue-release-history-dashboard__timeline-head">
                    <strong>${escapeHtml(snapshot.label || snapshot.snapshotId)}</strong>
                    <span class="queue-app-card__tag" data-state="${escapeHtml(
                        snapshot.isCurrent
                            ? 'ready'
                            : snapshot.severity || 'info'
                    )}">${escapeHtml(snapshot.decision || snapshot.severity || '')}</span>
                </div>
                <p>${escapeHtml(snapshot.summary || 'Sin resumen')}</p>
                <small>${escapeHtml(
                    [
                        formatDateTime(
                            snapshot.savedAt || snapshot.generatedAt || ''
                        ),
                        `${Number(snapshot.incidentCount || 0)} incidentes`,
                        `${Number(snapshot.surfaceCount || 0)} superficies`,
                    ]
                        .map((entry) => toText(entry))
                        .filter(Boolean)
                        .join(' · ')
                )}</small>
            </div>
            <div class="queue-release-history-dashboard__timeline-actions">
                <button
                    type="button"
                    data-history-action="select-a"
                    data-history-snapshot-id="${escapeHtml(snapshot.snapshotId)}"
                >
                    A
                </button>
                <button
                    type="button"
                    data-history-action="select-b"
                    data-history-snapshot-id="${escapeHtml(snapshot.snapshotId)}"
                >
                    B
                </button>
                <button
                    type="button"
                    data-history-action="set-baseline"
                    data-history-snapshot-id="${escapeHtml(snapshot.snapshotId)}"
                >
                    Baseline
                </button>
            </div>
        </article>
    `;
}

function buildFilename(clinicId) {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const clinicPart =
        toText(clinicId, 'default-clinic')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'default-clinic';
    return `turnero-release-history-${clinicPart}-${datePart}.json`;
}

export function createReleaseHistoryDashboard(options = {}) {
    const storage = getStorage(options.storage);
    const store = createReleaseHistoryStore({
        namespace: options.namespace,
        storage,
        maxItems: options.maxItems,
    });

    function readSelection(clinicId) {
        return store.getComparisonSelection(clinicId);
    }

    function writeSelection(clinicId, selectionInput = {}) {
        return store.setComparisonSelection(clinicId, selectionInput);
    }

    function buildState(input = {}) {
        const clinicId = getClinicId(
            input,
            options.clinicId || 'default-clinic'
        );
        const snapshots = Array.isArray(input.snapshots)
            ? input.snapshots.map((snapshot) =>
                  normalizeReleaseSnapshot({
                      ...toObject(snapshot),
                      clinicId: snapshot?.clinicId || clinicId,
                  })
              )
            : store.list(clinicId);
        const selection = toObject(input.selection || readSelection(clinicId));
        const currentSnapshot = input.currentSnapshot
            ? normalizeReleaseSnapshot({
                  ...toObject(input.currentSnapshot),
                  clinicId,
              })
            : null;

        return {
            clinicId,
            currentSnapshot,
            snapshots,
            baselineSnapshotId: toText(
                input.baselineSnapshotId || store.getBaselineId(clinicId) || ''
            ),
            baselineSnapshot: input.baselineSnapshot
                ? normalizeReleaseSnapshot({
                      ...toObject(input.baselineSnapshot),
                      clinicId,
                  })
                : store.getBaseline(clinicId),
            selectedSnapshotAId: toText(
                input.selectedSnapshotAId || selection.snapshotAId || ''
            ),
            selectedSnapshotBId: toText(
                input.selectedSnapshotBId || selection.snapshotBId || ''
            ),
            selection,
        };
    }

    function buildViewModel(input = {}) {
        const state = buildState(input);
        const pack = buildMultiRunComparisonPack({
            clinicId: state.clinicId,
            currentSnapshot: state.currentSnapshot,
            snapshots: state.snapshots,
            baselineSnapshotId: state.baselineSnapshotId,
            baselineSnapshot: state.baselineSnapshot,
            selectedSnapshotAId: state.selectedSnapshotAId,
            selectedSnapshotBId: state.selectedSnapshotBId,
            selection: state.selection,
            storage,
            namespace: options.namespace,
            maxItems: options.maxItems,
        });
        const summaryText = copyFriendlyHistorySummary(pack);
        const currentSnapshot =
            pack.currentSnapshot || state.currentSnapshot || null;
        const baselineSnapshot =
            pack.baselineSnapshot || state.baselineSnapshot || null;
        const comparisonOptions = buildComparisonOptions(
            pack.snapshots,
            pack.selectedSnapshotAId,
            pack.selectedSnapshotBId
        );

        return {
            title: buildSummaryTitle(state.clinicId, currentSnapshot),
            headline: buildSummaryHeadline(pack),
            clinicId: state.clinicId,
            snapshotCount: pack.snapshotCount,
            baselineSnapshotId: pack.baselineSnapshotId,
            currentSnapshotId: pack.currentSnapshotId,
            selectedSnapshotAId: pack.selectedSnapshotAId,
            selectedSnapshotBId: pack.selectedSnapshotBId,
            comparisonOptions,
            pack,
            summaryText,
            currentSnapshot,
            baselineSnapshot,
            selectedSnapshotA: pack.selectedSnapshotA,
            selectedSnapshotB: pack.selectedSnapshotB,
            selection: pack.comparisonSelection,
        };
    }

    async function copySummary(input = {}) {
        const viewModel = buildViewModel(input);
        const copied = await copyToClipboardSafe(viewModel.summaryText);
        return {
            copied,
            summaryText: viewModel.summaryText,
            viewModel,
        };
    }

    function exportPack(input = {}) {
        const viewModel = buildViewModel(input);
        const downloaded = downloadHistoryPackJson(
            viewModel.pack,
            buildFilename(viewModel.clinicId)
        );
        return {
            downloaded,
            filename: buildFilename(viewModel.clinicId),
            pack: viewModel.pack,
            viewModel,
        };
    }

    function saveCurrentSnapshot(input = {}) {
        const state = buildState(input);
        if (!state.currentSnapshot) {
            return {
                saved: false,
                savedSnapshot: null,
                viewModel: buildViewModel(input),
            };
        }

        const savedSnapshot = store.save(state.clinicId, state.currentSnapshot);
        return {
            saved: true,
            savedSnapshot,
            viewModel: buildViewModel({
                ...input,
                currentSnapshot: savedSnapshot,
                clinicId: state.clinicId,
            }),
        };
    }

    function setBaseline(inputOrClinicId, snapshotIdMaybe) {
        const input =
            inputOrClinicId && typeof inputOrClinicId === 'object'
                ? inputOrClinicId
                : {
                      clinicId: inputOrClinicId,
                      snapshotId: snapshotIdMaybe,
                  };
        const state = buildState(input);
        let targetSnapshotId = toText(
            input.snapshotId ||
                input.baselineSnapshotId ||
                state.selectedSnapshotAId ||
                state.selectedSnapshotBId ||
                ''
        );
        let targetSnapshot = targetSnapshotId
            ? store.find(state.clinicId, targetSnapshotId)
            : null;

        if (!targetSnapshot && input.currentSnapshot) {
            const savedSnapshot = store.save(
                state.clinicId,
                input.currentSnapshot
            );
            targetSnapshotId = savedSnapshot.snapshotId;
            targetSnapshot = savedSnapshot;
        }

        if (!targetSnapshotId || !targetSnapshot) {
            return null;
        }

        store.setBaseline(state.clinicId, targetSnapshotId);
        return targetSnapshot;
    }

    function setComparisonSelection(inputOrClinicId, selectionMaybe) {
        const input =
            inputOrClinicId && typeof inputOrClinicId === 'object'
                ? inputOrClinicId
                : {
                      clinicId: inputOrClinicId,
                      ...(selectionMaybe || {}),
                  };
        const clinicId = getClinicId(
            input,
            options.clinicId || 'default-clinic'
        );
        return writeSelection(clinicId, {
            snapshotAId: input.snapshotAId || input.selectedSnapshotAId || '',
            snapshotBId: input.snapshotBId || input.selectedSnapshotBId || '',
        });
    }

    function renderTextCard(input = {}) {
        const viewModel = isViewModel(input) ? input : buildViewModel(input);
        const baselineState = buildDiffTone(viewModel.pack.baselineCompare);
        const pairState = buildDiffTone(viewModel.pack.pairDiff);
        const selectA = toText(viewModel.selectedSnapshotAId);
        const selectB = toText(viewModel.selectedSnapshotBId);
        const snapshotRows = Array.isArray(viewModel.pack.timeline)
            ? viewModel.pack.timeline
                  .map((snapshot) => renderSnapshotRow(snapshot))
                  .join('')
            : '';

        return `
            <section
                id="queueReleaseHistoryDashboardPanel"
                class="queue-app-card queue-release-history-dashboard"
                data-state="${escapeHtml(baselineState)}"
                data-history-clinic-id="${escapeHtml(viewModel.clinicId)}"
                data-history-baseline-id="${escapeHtml(viewModel.baselineSnapshotId || '')}"
                data-history-current-id="${escapeHtml(viewModel.currentSnapshotId || '')}"
                data-history-count="${escapeHtml(String(viewModel.snapshotCount || 0))}"
            >
                <header class="queue-release-history-dashboard__head">
                    <div>
                        <p class="queue-app-card__eyebrow">Release history</p>
                        <h5 class="queue-app-card__title">${escapeHtml(viewModel.title)}</h5>
                        <p class="queue-release-history-dashboard__headline">${escapeHtml(
                            viewModel.headline
                        )}</p>
                    </div>
                    <div class="queue-release-history-dashboard__meta">
                        <span class="queue-app-card__tag" data-state="${escapeHtml(
                            baselineState
                        )}">Snapshots ${escapeHtml(String(viewModel.snapshotCount || 0))}</span>
                        <span class="queue-app-card__tag" data-state="${escapeHtml(
                            baselineState
                        )}">Baseline ${escapeHtml(
                            viewModel.baselineSnapshotId || 'sin baseline'
                        )}</span>
                        <span class="queue-app-card__tag" data-state="${escapeHtml(
                            pairState
                        )}">A ${escapeHtml(selectA || 'n/a')} · B ${escapeHtml(selectB || 'n/a')}</span>
                    </div>
                </header>

                <p class="queue-release-history-dashboard__summary">${escapeHtml(
                    viewModel.currentSnapshot?.summary ||
                        viewModel.pack.baselineCompare?.diff?.summary ||
                        'Memoria histórica por clínica para snapshots de release.'
                )}</p>

                <div class="queue-release-history-dashboard__actions">
                    <button type="button" data-history-action="save-current">Guardar snapshot</button>
                    <button type="button" data-history-action="set-baseline-current">Fijar baseline</button>
                    <button type="button" data-history-action="copy-summary">Copiar resumen</button>
                    <button type="button" data-history-action="download-json">Descargar JSON</button>
                </div>

                <div class="queue-release-history-dashboard__selection">
                    <label>
                        Snapshot A
                        <select data-history-select="snapshot-a">
                            <option value="">Selecciona A</option>
                            ${viewModel.comparisonOptions
                                .map((option) =>
                                    renderOptionMarkup(option, selectA)
                                )
                                .join('')}
                        </select>
                    </label>
                    <label>
                        Snapshot B
                        <select data-history-select="snapshot-b">
                            <option value="">Selecciona B</option>
                            ${viewModel.comparisonOptions
                                .map((option) =>
                                    renderOptionMarkup(option, selectB)
                                )
                                .join('')}
                        </select>
                    </label>
                </div>

                <div class="queue-release-history-dashboard__compare-grid">
                    ${renderComparisonCard(
                        'Current vs baseline',
                        viewModel.pack.baselineCompare,
                        'baseline'
                    )}
                    ${renderComparisonCard('Snapshot A vs B', viewModel.pack.pairDiff, 'pair')}
                </div>

                <section class="queue-release-history-dashboard__timeline">
                    <header class="queue-release-history-dashboard__timeline-head">
                        <div>
                            <p class="queue-app-card__eyebrow">Timeline</p>
                            <h6>Historial por clínica</h6>
                        </div>
                        <span class="queue-app-card__tag" data-state="info">${escapeHtml(
                            `${viewModel.pack.timeline.length} snapshot(s)`
                        )}</span>
                    </header>
                    <div class="queue-release-history-dashboard__timeline-list">
                        ${
                            snapshotRows ||
                            `<p class="queue-release-history-dashboard__muted">Todavía no hay snapshots guardados.</p>`
                        }
                    </div>
                </section>

                <details class="queue-release-history-dashboard__copy-details">
                    <summary>Resumen copiable</summary>
                    <pre>${escapeHtml(viewModel.summaryText)}</pre>
                </details>
            </section>
        `;
    }

    return {
        store,
        buildState,
        buildViewModel,
        saveCurrentSnapshot,
        setBaseline,
        setComparisonSelection,
        copySummary,
        exportPack,
        renderTextCard,
    };
}

export default createReleaseHistoryDashboard;
