import {
    compareSnapshotAgainstBaseline,
    buildHistoryTimeline,
} from './turnero-release-baseline-compare.js';
import {
    createReleaseHistoryStore,
    normalizeReleaseSnapshot,
} from './turnero-release-history-store.js';
import {
    downloadJsonSnapshot,
    toText,
} from './turnero-release-control-center.js';

function buildSnapshotLabel(snapshot) {
    const normalized = snapshot ? normalizeReleaseSnapshot(snapshot) : null;
    if (!normalized) {
        return 'snapshot';
    }

    const parts = [
        normalized.label || normalized.clinicShortName || normalized.clinicName,
        normalized.decision,
        normalized.severity,
    ]
        .map((entry) => toText(entry))
        .filter(Boolean);

    return parts.join(' · ') || normalized.snapshotId;
}

function resolveSnapshotById(snapshots, snapshotId) {
    const targetId = toText(snapshotId);
    if (!targetId) {
        return null;
    }

    return (
        snapshots.find((snapshot) => snapshot.snapshotId === targetId) || null
    );
}

function buildSelectionFromStore(store, clinicId) {
    const selection = store.getComparisonSelection(clinicId);
    return {
        snapshotAId: toText(selection?.snapshotAId || ''),
        snapshotBId: toText(selection?.snapshotBId || ''),
    };
}

export function buildMultiRunComparisonPack(options = {}) {
    const store = createReleaseHistoryStore({
        namespace: options.namespace,
        storage: options.storage,
        maxItems: options.maxItems,
    });
    const clinicId = toText(
        options.clinicId ||
            options.currentSnapshot?.clinicId ||
            options.baselineSnapshot?.clinicId ||
            options.snapshot?.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const snapshots = toArrayOfSnapshots(options.snapshots, clinicId, store);
    const storedSelection = buildSelectionFromStore(store, clinicId);
    const currentSnapshot = options.currentSnapshot
        ? normalizeReleaseSnapshot({
              ...options.currentSnapshot,
              clinicId,
          })
        : snapshots[snapshots.length - 1] ||
          (options.snapshot
              ? normalizeReleaseSnapshot({
                    ...options.snapshot,
                    clinicId,
                })
              : null);
    const baselineSnapshotId = toText(
        options.baselineSnapshotId || store.getBaselineId(clinicId) || ''
    );
    const baselineSnapshot = options.baselineSnapshot
        ? normalizeReleaseSnapshot({
              ...options.baselineSnapshot,
              clinicId,
          })
        : store.getBaseline(clinicId) ||
          resolveSnapshotById(snapshots, baselineSnapshotId) ||
          null;
    const selectedSnapshotAId = toText(
        options.selectedSnapshotAId ||
            options.selection?.snapshotAId ||
            storedSelection.snapshotAId ||
            snapshots[0]?.snapshotId ||
            ''
    );
    const selectedSnapshotBId = toText(
        options.selectedSnapshotBId ||
            options.selection?.snapshotBId ||
            storedSelection.snapshotBId ||
            snapshots[1]?.snapshotId ||
            ''
    );
    const selectedSnapshotA =
        options.selectedSnapshotA ||
        resolveSnapshotById(snapshots, selectedSnapshotAId) ||
        null;
    const selectedSnapshotB =
        options.selectedSnapshotB ||
        resolveSnapshotById(snapshots, selectedSnapshotBId) ||
        null;
    const timeline = buildHistoryTimeline(snapshots, {
        baselineSnapshotId,
        selectedSnapshotAId,
        selectedSnapshotBId,
        currentSnapshotId: currentSnapshot?.snapshotId || '',
    });
    const baselineCompare = compareSnapshotAgainstBaseline(
        currentSnapshot,
        baselineSnapshot
    );
    const pairDiff =
        selectedSnapshotA && selectedSnapshotB
            ? compareSnapshotAgainstBaseline(
                  selectedSnapshotB,
                  selectedSnapshotA
              )
            : {
                  ok: false,
                  reason: 'pair_missing',
                  diff: null,
                  topDeltas: [],
                  ownerDeltaCounts: {},
                  severityDeltaCounts: {},
              };

    return {
        clinicId,
        generatedAt: new Date().toISOString(),
        baselineSnapshotId,
        currentSnapshotId: currentSnapshot?.snapshotId || '',
        selectedSnapshotAId,
        selectedSnapshotBId,
        snapshotCount: snapshots.length,
        baselineCompare,
        pairDiff,
        timeline,
        snapshots,
        currentSnapshot,
        baselineSnapshot,
        selectedSnapshotA,
        selectedSnapshotB,
        comparisonSelection: {
            snapshotAId: selectedSnapshotAId,
            snapshotBId: selectedSnapshotBId,
        },
        storeNamespace: store.namespace,
    };
}

export function copyFriendlyHistorySummary(pack) {
    const safePack = pack && typeof pack === 'object' ? pack : {};
    const baselineCompare = safePack.baselineCompare || {};
    const pairDiff = safePack.pairDiff || {};
    const currentSnapshot = safePack.currentSnapshot
        ? normalizeReleaseSnapshot(safePack.currentSnapshot)
        : null;
    const baselineSnapshot = safePack.baselineSnapshot
        ? normalizeReleaseSnapshot(safePack.baselineSnapshot)
        : null;
    const selectedSnapshotA = safePack.selectedSnapshotA
        ? normalizeReleaseSnapshot(safePack.selectedSnapshotA)
        : null;
    const selectedSnapshotB = safePack.selectedSnapshotB
        ? normalizeReleaseSnapshot(safePack.selectedSnapshotB)
        : null;

    const lines = [
        '# Turnero Release History',
        '',
        `- Clinic: ${toText(safePack.clinicId || 'default-clinic')}`,
        `- Snapshots: ${Number(safePack.snapshotCount || 0)}`,
        `- Baseline: ${baselineSnapshot ? buildSnapshotLabel(baselineSnapshot) : 'sin baseline'}`,
        `- Current: ${currentSnapshot ? buildSnapshotLabel(currentSnapshot) : 'sin current snapshot'}`,
        '',
        '## Current vs Baseline',
        baselineCompare.reason === 'baseline_missing'
            ? '- Baseline no configurada.'
            : baselineCompare.reason === 'current_missing'
              ? '- Snapshot actual no disponible.'
              : baselineCompare.ok
                ? '- Sin cambios relevantes respecto al baseline.'
                : baselineCompare.diff
                  ? `- ${baselineCompare.diff.totalChanges} cambio(s) detectado(s).`
                  : '- No se pudo comparar.',
    ];

    toArrayOfEntries(baselineCompare.topDeltas).forEach((delta) => {
        lines.push(`- ${toText(delta.summary || delta.label || delta.kind)}`);
    });

    lines.push('', '## Pair A/B');
    if (selectedSnapshotA && selectedSnapshotB) {
        lines.push(
            `- A: ${buildSnapshotLabel(selectedSnapshotA)}`,
            `- B: ${buildSnapshotLabel(selectedSnapshotB)}`
        );
        if (pairDiff.ok) {
            lines.push('- Sin cambios entre A y B.');
        } else if (pairDiff.reason === 'pair_missing') {
            lines.push('- Falta seleccionar dos snapshots.');
        } else if (pairDiff.diff) {
            lines.push(
                `- ${pairDiff.diff.totalChanges} cambio(s) entre A y B.`
            );
        }
        toArrayOfEntries(pairDiff.topDeltas).forEach((delta) => {
            lines.push(
                `- ${toText(delta.summary || delta.label || delta.kind)}`
            );
        });
    } else {
        lines.push('- Falta seleccionar dos snapshots para comparar.');
    }

    lines.push('', '## Timeline');
    const timelineRows = toArrayOfEntries(safePack.timeline);
    if (!timelineRows.length) {
        lines.push('- Sin snapshots guardados.');
    } else {
        timelineRows.slice(0, 10).forEach((row) => {
            lines.push(
                `- ${row.snapshotId} · ${row.decision} · ${Number(row.incidentCount || 0)} incidentes · ${Number(row.surfaceCount || 0)} superficies`
            );
        });
    }

    return lines.join('\n');
}

export function downloadHistoryPackJson(
    pack,
    filename = 'turnero-release-history-pack.json'
) {
    return downloadJsonSnapshot(filename, pack);
}

function toArrayOfSnapshots(value, clinicId, store) {
    const explicit = Array.isArray(value) ? value : [];
    if (explicit.length) {
        return explicit.map((snapshot) =>
            normalizeReleaseSnapshot({
                ...snapshot,
                clinicId: snapshot?.clinicId || clinicId,
            })
        );
    }

    return store.list(clinicId);
}

function toArrayOfEntries(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

export default buildMultiRunComparisonPack;
