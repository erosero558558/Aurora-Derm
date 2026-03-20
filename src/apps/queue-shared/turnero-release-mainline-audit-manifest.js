import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_MAINLINE_AUDIT_ROWS = Object.freeze([
    {
        id: 'mainline-admin-queue-core',
        key: 'admin-queue-core',
        label: 'Admin Queue Core',
        owner: 'ops',
        surface: 'admin-queue',
        criticality: 'critical',
    },
    {
        id: 'mainline-remote-health',
        key: 'remote-health',
        label: 'Remote Health',
        owner: 'infra',
        surface: 'admin-queue',
        criticality: 'critical',
    },
    {
        id: 'mainline-public-sync',
        key: 'public-sync',
        label: 'Public Sync',
        owner: 'web',
        surface: 'admin-queue',
        criticality: 'critical',
    },
    {
        id: 'mainline-operator-surface',
        key: 'operator-surface',
        label: 'Operator Surface',
        owner: 'ops',
        surface: 'operator-turnos',
        criticality: 'high',
    },
    {
        id: 'mainline-kiosk-surface',
        key: 'kiosk-surface',
        label: 'Kiosk Surface',
        owner: 'frontdesk',
        surface: 'kiosco-turnos',
        criticality: 'high',
    },
    {
        id: 'mainline-display-surface',
        key: 'display-surface',
        label: 'Display Surface',
        owner: 'display',
        surface: 'sala-turnos',
        criticality: 'high',
    },
    {
        id: 'mainline-figo-bridge',
        key: 'figo-bridge',
        label: 'Figo Bridge',
        owner: 'backend',
        surface: 'admin-queue',
        criticality: 'critical',
    },
    {
        id: 'mainline-repo-truth',
        key: 'repo-truth',
        label: 'Repo Truth',
        owner: 'program',
        surface: 'admin-queue',
        criticality: 'high',
    },
]);

function normalizeManifestRow(entry, index) {
    const item = asObject(entry);
    const fallbackKey = `mainline-item-${index + 1}`;
    const key = toText(item.key || item.moduleKey || item.id, fallbackKey);
    const surface = toText(
        item.surface || item.surfaceId || item.domain || 'admin-queue',
        'admin-queue'
    );
    const criticality = toText(
        item.criticality || item.priority || (index < 4 ? 'critical' : 'high'),
        index < 4 ? 'critical' : 'high'
    ).toLowerCase();

    return {
        id: toText(item.id, key),
        key,
        label: toText(item.label || item.name, `Mainline item ${index + 1}`),
        owner: toText(item.owner, 'ops'),
        surface,
        criticality,
        commitRef: toText(
            item.commitRef || item.commit || item.sha || item.hash || ''
        ),
        path: toText(item.path || item.route || ''),
        status: toText(item.status || item.state || 'active'),
        mounted: item.mounted !== false,
        source: toText(item.source || 'static'),
    };
}

export function buildTurneroReleaseMainlineAuditManifest(input = {}) {
    const sourceRows = toArray(
        input.items ||
            input.rows ||
            input.manifestRows ||
            input.sourceManifest?.rows
    );
    const rows = (
        sourceRows.length > 0 ? sourceRows : DEFAULT_MAINLINE_AUDIT_ROWS
    ).map((entry, index) => normalizeManifestRow(entry, index));
    const surfaces = [
        ...new Set(rows.map((row) => toText(row.surface))),
    ].filter(Boolean);

    return {
        rows,
        summary: {
            all: rows.length,
            critical: rows.filter((row) => row.criticality === 'critical')
                .length,
            high: rows.filter((row) => row.criticality === 'high').length,
            mounted: rows.filter((row) => row.mounted).length,
            surfaces: surfaces.length,
            bySurface: rows.reduce((accumulator, row) => {
                const surface = toText(row.surface, 'admin-queue');
                accumulator[surface] = (accumulator[surface] || 0) + 1;
                return accumulator;
            }, {}),
        },
        generatedAt: new Date().toISOString(),
    };
}

export { DEFAULT_MAINLINE_AUDIT_ROWS };
