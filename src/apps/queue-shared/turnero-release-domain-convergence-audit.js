import { asObject, toArray, toText } from './turnero-release-control-center.js';

function normalizeRows(value, fallbackPrefix = 'row') {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item, index) => {
            const row = asObject(item);
            const fallbackId = `${fallbackPrefix}-${index + 1}`;
            const id = toText(row.id || row.key, fallbackId);

            return {
                ...row,
                id,
                key: toText(row.key, id),
            };
        });
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry], index) => {
                const row = asObject(entry);
                const fallbackId = `${fallbackPrefix}-${index + 1}`;
                const id = toText(row.id || row.key || key, fallbackId);

                return {
                    ...row,
                    id,
                    key: toText(row.key, id),
                };
            });
    }

    return [];
}

function normalizeRegistryRows(value, manifestRows) {
    const rows = normalizeRows(value, 'registry');
    if (rows.length > 0) {
        return rows.map((row) => ({
            ...row,
            mounted: row.mounted === true,
            state: toText(
                row.state,
                row.mounted === true ? 'present' : 'missing'
            ),
            label: toText(row.label, row.key),
        }));
    }

    return manifestRows.map((row, index) => ({
        id: `registry-${index + 1}`,
        key: row.domain || row.key || `registry-${index + 1}`,
        label: row.label,
        mounted: false,
        state: 'missing',
    }));
}

function normalizeInventoryRows(value, manifestRows) {
    const rows = normalizeRows(value, 'inventory');
    if (rows.length > 0) {
        return rows.map((row) => ({
            ...row,
            readiness: toText(
                row.readiness || row.state,
                row.mounted === true ? 'present' : 'missing'
            ),
            state: toText(row.state, row.readiness || 'missing'),
            label: toText(row.label, row.key),
        }));
    }

    return manifestRows.map((row, index) => ({
        id: `inventory-${index + 1}`,
        key: row.domain || row.key || `inventory-${index + 1}`,
        label: row.label,
        readiness: 'missing',
        state: 'missing',
    }));
}

function normalizeState(value) {
    return toText(value, 'missing').trim().toLowerCase();
}

export function buildTurneroReleaseDomainConvergenceAudit(input = {}) {
    const manifestRows = normalizeRows(input.manifestRows, 'step');
    const registryRows = normalizeRegistryRows(
        input.registryRows,
        manifestRows
    );
    const inventoryRows = normalizeInventoryRows(
        input.inventoryRows,
        manifestRows
    );

    const rows = manifestRows.map((manifest) => {
        const registry =
            registryRows.find((item) => {
                const key = toText(item.key);
                return (
                    key === manifest.domain ||
                    key === manifest.key ||
                    key === manifest.id
                );
            }) || {};
        const inventory =
            inventoryRows.find((item) => {
                const key = toText(item.key);
                return (
                    key === manifest.domain ||
                    key === manifest.key ||
                    key === manifest.id
                );
            }) || {};
        const registryMounted =
            registry.mounted === true ||
            ['present', 'ready', 'pass'].includes(
                normalizeState(registry.state)
            );
        const inventoryState = normalizeState(
            inventory.readiness || inventory.state
        );
        const inventoryReady = ['present', 'ready', 'pass'].includes(
            inventoryState
        );
        const inventoryPartial = ['partial', 'warning', 'watch'].includes(
            inventoryState
        );
        let score = 0;

        if (registryMounted) {
            score += 45;
        } else if (normalizeState(registry.state) === 'partial') {
            score += 25;
        } else if (normalizeState(registry.state) === 'watch') {
            score += 15;
        }

        if (inventoryReady) {
            score += 40;
        } else if (inventoryPartial) {
            score += 20;
        }

        if (toArray(manifest.requiredSurfaces).length > 0) {
            score += 15;
        }

        score = Number(score.toFixed(1));
        const state =
            score >= 85 ? 'converged' : score >= 55 ? 'partial' : 'fragmented';

        return {
            key: manifest.key,
            domain: manifest.domain,
            label: manifest.label,
            owner: manifest.owner,
            requiredSurfaces: manifest.requiredSurfaces,
            registryKey: toText(registry.key, ''),
            registryMounted,
            registryState: toText(
                registry.state,
                registryMounted ? 'ready' : 'missing'
            ),
            inventoryKey: toText(inventory.key, ''),
            inventoryReadiness: inventoryState,
            score,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            converged: rows.filter((row) => row.state === 'converged').length,
            partial: rows.filter((row) => row.state === 'partial').length,
            fragmented: rows.filter((row) => row.state === 'fragmented').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseDomainConvergenceAudit;
