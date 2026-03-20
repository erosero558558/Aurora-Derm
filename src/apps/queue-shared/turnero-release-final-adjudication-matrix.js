import { asObject, toText } from './turnero-release-control-center.js';

function collectRows(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry]) => ({
                key,
                ...asObject(entry),
            }));
    }

    return [];
}

function normalizeBundleStatus(value) {
    const status = toText(value, 'missing').toLowerCase();
    if (['ready', 'supported', 'pass', 'ok'].includes(status)) {
        return 'ready';
    }

    if (['blocked', 'hold', 'fail', 'error'].includes(status)) {
        return 'blocked';
    }

    if (['partial', 'pending', 'review', 'watch'].includes(status)) {
        return 'pending';
    }

    return 'missing';
}

function findBundleForRow(row, bundleRows) {
    const key = toText(row.key || row.id, '');
    const owner = toText(row.owner, '');
    const label = toText(row.label, '');

    return (
        bundleRows.find((item) => toText(item.key || item.id, '') === key) ||
        bundleRows.find((item) => owner && toText(item.owner, '') === owner) ||
        bundleRows.find((item) => label && toText(item.label, '') === label) ||
        null
    );
}

function findOpenBlockers(row, blockers) {
    const owner = toText(row.owner, '');
    const key = toText(row.key || row.id, '');

    return blockers.filter((item) => {
        const status = toText(item.status || item.state, 'open').toLowerCase();
        const blockerOwner = toText(item.owner, '');
        const blockerKey = toText(item.key || item.id, '');

        return (
            status !== 'closed' &&
            (blockerOwner === owner || blockerKey === key || !blockerOwner)
        );
    });
}

export function buildTurneroReleaseFinalAdjudicationMatrix(input = {}) {
    const manifestRows = collectRows(input.manifestRows);
    const bundleRows = collectRows(input.bundleRows);
    const blockers = collectRows(input.blockers);

    const rows = manifestRows.map((row, index) => {
        const bundle = findBundleForRow(row, bundleRows) || {};
        const openBlockers = findOpenBlockers(row, blockers);
        const bundleStatus = normalizeBundleStatus(bundle.status);
        const state =
            openBlockers.length > 0 || bundleStatus === 'blocked'
                ? 'blocked'
                : bundleStatus === 'ready'
                  ? 'supported'
                  : bundleStatus === 'missing'
                    ? 'missing'
                    : 'partial';

        return {
            key: toText(row.key || row.id, `adjudication-${index + 1}`),
            id: toText(row.id, row.key || `adjudication-${index + 1}`),
            label: toText(row.label, `Adjudication Item ${index + 1}`),
            owner: toText(row.owner, 'program'),
            criticality: toText(row.criticality, 'high'),
            bundleId: toText(bundle.id, ''),
            bundleKey: toText(bundle.key, ''),
            bundleLabel: toText(bundle.label, ''),
            bundleStatus,
            bundleArtifactCount: Number(bundle.artifactCount || 0),
            blockerCount: openBlockers.length,
            blockerKeys: openBlockers.map((item, blockerIndex) =>
                toText(item.key || item.id, `blocker-${blockerIndex + 1}`)
            ),
            state,
            supported: state === 'supported',
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            supported: rows.filter((row) => row.state === 'supported').length,
            partial: rows.filter((row) => row.state === 'partial').length,
            blocked: rows.filter((row) => row.state === 'blocked').length,
            missing: rows.filter((row) => row.state === 'missing').length,
            blockers: rows.reduce((count, row) => count + row.blockerCount, 0),
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalAdjudicationMatrix;
