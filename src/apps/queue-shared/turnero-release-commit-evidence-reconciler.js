import { asObject, toArray, toText } from './turnero-release-control-center.js';

function resolveRowKey(entry) {
    const item = asObject(entry);
    return toText(item.key || item.moduleKey || item.id || item.name);
}

function resolveCommitRef(entry) {
    const item = asObject(entry);
    return toText(
        item.commitRef ||
            item.commit ||
            item.sha ||
            item.hash ||
            item.fingerprint ||
            item.evidenceRef ||
            item.ref ||
            ''
    );
}

function isMounted(entry) {
    const item = asObject(entry);
    const state = toText(item.state || item.status || item.readiness || '')
        .trim()
        .toLowerCase();

    if (item.mounted === true || item.present === true) {
        return true;
    }

    return [
        'mounted',
        'present',
        'ready',
        'pass',
        'reconciled',
        'strong',
    ].includes(state);
}

export function buildTurneroReleaseCommitEvidenceReconciler(input = {}) {
    const manifestRows = toArray(
        input.manifestRows || input.manifest?.rows
    ).map(asObject);
    const actualRows = toArray(
        input.actualRows ||
            input.actual ||
            input.commitRows ||
            input.evidenceRows
    ).map(asObject);
    const provenance = toArray(
        input.provenance ||
            input.commitEvidence ||
            input.evidence ||
            input.records
    ).map(asObject);

    const rows = manifestRows.map((row, index) => {
        const key = toText(row.key || row.id, `mainline-item-${index + 1}`);
        const actual = actualRows.find((entry) => resolveRowKey(entry) === key);
        const prov = provenance.find((entry) => resolveRowKey(entry) === key);
        const commitRef = resolveCommitRef(actual) || resolveCommitRef(prov);
        const mounted =
            isMounted(actual) || isMounted(prov) || row.mounted !== false;
        const state =
            commitRef && mounted
                ? 'reconciled'
                : mounted
                  ? 'mounted-no-evidence'
                  : commitRef
                    ? 'evidence-no-mount'
                    : 'missing';

        return {
            key,
            label: toText(row.label, `Mainline item ${index + 1}`),
            owner: toText(row.owner, 'ops'),
            surface: toText(row.surface, 'admin-queue'),
            commitRef,
            mounted,
            state,
            actualId: toText(
                actual?.id || actual?.key || actual?.moduleKey || ''
            ),
            provenanceId: toText(
                prov?.id || prov?.key || prov?.moduleKey || ''
            ),
            sourceCommitRef: toText(row.commitRef || ''),
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            reconciled: rows.filter((row) => row.state === 'reconciled').length,
            mountedNoEvidence: rows.filter(
                (row) => row.state === 'mounted-no-evidence'
            ).length,
            evidenceNoMount: rows.filter(
                (row) => row.state === 'evidence-no-mount'
            ).length,
            missing: rows.filter((row) => row.state === 'missing').length,
        },
        generatedAt: new Date().toISOString(),
    };
}
