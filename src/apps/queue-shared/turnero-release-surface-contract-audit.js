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

function normalizeSurfaceRows(value) {
    return normalizeRows(value, 'surface').map((surface, index) => ({
        ...surface,
        id: toText(surface.id, surface.key || `surface-${index + 1}`),
        key: toText(surface.key, surface.id || `surface-${index + 1}`),
        label: toText(surface.label, `Surface ${index + 1}`),
        owner: toText(surface.owner, 'ops'),
        route: toText(surface.route, ''),
        enabled: surface.enabled !== false,
    }));
}

function normalizeContracts(value) {
    return normalizeRows(value, 'contract').map((contract, index) => ({
        ...contract,
        id: toText(contract.id, contract.key || `contract-${index + 1}`),
        key: toText(contract.key, contract.id || `contract-${index + 1}`),
        label: toText(contract.label, `Contract ${index + 1}`),
        source: toText(contract.source, ''),
        target: toText(contract.target, ''),
        surfaceId: toText(
            contract.surfaceId || contract.surface || contract.source,
            ''
        ),
        owner: toText(contract.owner, 'ops'),
        version: toText(contract.version, 'v1'),
        criticality: toText(contract.criticality, 'medium'),
        state: toText(contract.state, 'active'),
    }));
}

function contractTouchesSurface(contract, surfaceId) {
    const values = [
        contract.surfaceId,
        contract.surface,
        contract.source,
        contract.target,
        contract.domain,
        contract.key,
    ]
        .map((entry) => toText(entry))
        .filter(Boolean);

    return values.includes(surfaceId);
}

export function buildTurneroReleaseSurfaceContractAudit(input = {}) {
    const surfaces = normalizeSurfaceRows(input.surfaces);
    const contracts = normalizeContracts(input.contracts);

    const rows = surfaces.map((surface, index) => {
        const surfaceId = surface.id || surface.key || `surface-${index + 1}`;
        const mapped = contracts.filter(
            (contract) =>
                contractTouchesSurface(contract, surfaceId) ||
                contractTouchesSurface(contract, surface.key)
        );
        const critical = mapped.filter(
            (contract) => contract.criticality === 'critical'
        ).length;
        const degraded = mapped.filter((contract) =>
            ['degraded', 'watch', 'warning'].includes(contract.state)
        ).length;
        const missing = mapped.filter((contract) =>
            ['missing', 'absent', 'inactive'].includes(contract.state)
        ).length;
        const state =
            mapped.length === 0 || missing > 0
                ? 'missing'
                : degraded > 0
                  ? 'watch'
                  : 'pass';

        return {
            surfaceId,
            label: surface.label || `Surface ${index + 1}`,
            contractCount: mapped.length,
            critical,
            degraded,
            missing,
            state,
        };
    });

    return {
        rows,
        summary: {
            all: rows.length,
            pass: rows.filter((row) => row.state === 'pass').length,
            watch: rows.filter((row) => row.state === 'watch').length,
            missing: rows.filter((row) => row.state === 'missing').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseSurfaceContractAudit;
