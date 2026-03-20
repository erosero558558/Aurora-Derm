import { asObject, toArray, toText } from './turnero-release-control-center.js';

function resolveRuntimePresent(entry) {
    const item = asObject(entry);

    if (item.present === false || item.mounted === false) {
        return false;
    }

    return true;
}

function resolveRuntimeFingerprint(entry) {
    const item = asObject(entry);
    return toText(
        item.fingerprint ||
            item.commitRef ||
            item.digest ||
            item.sha ||
            item.hash ||
            item.version ||
            ''
    );
}

export function buildTurneroReleaseRuntimeVsSourceDiff(input = {}) {
    const manifestRows = toArray(
        input.manifestRows || input.manifest?.rows
    ).map(asObject);
    const reconciledRows = toArray(
        input.reconciledRows || input.reconciled?.rows
    ).map(asObject);
    const runtimeRows = toArray(input.runtimeRows || input.runtime?.rows).map(
        asObject
    );

    const rows = manifestRows.map((row, index) => {
        const key = toText(row.key || row.id, `mainline-item-${index + 1}`);
        const reconciled = reconciledRows.find((entry) => {
            const candidateKey = toText(
                entry.key || entry.id || entry.moduleKey
            );
            return (
                candidateKey === key ||
                toText(entry.surface) === toText(row.surface)
            );
        });
        const runtime = runtimeRows.find((entry) => {
            const candidateKey = toText(
                entry.key || entry.id || entry.surfaceId
            );
            return (
                candidateKey === key ||
                toText(entry.surface) === toText(row.surface) ||
                toText(entry.surfaceId) === toText(row.surface)
            );
        });
        const sourceState = toText(reconciled?.state, 'missing');
        const runtimePresent = resolveRuntimePresent(runtime);
        const runtimeFingerprint = resolveRuntimeFingerprint(runtime);
        const state =
            sourceState === 'reconciled' && runtimePresent
                ? 'aligned'
                : sourceState !== 'missing' && runtimePresent
                  ? 'watch'
                  : 'drift';

        return {
            key,
            label: toText(row.label, `Mainline item ${index + 1}`),
            surface: toText(row.surface, 'admin-queue'),
            sourceState,
            runtimePresent,
            runtimeFingerprint,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            aligned: rows.filter((row) => row.state === 'aligned').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            drift: rows.filter((row) => row.state === 'drift').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
