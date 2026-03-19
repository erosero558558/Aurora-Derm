import {
    buildTurneroIncidentEvidenceMarkdown,
    buildTurneroOwnerEvidenceMarkdown,
    buildTurneroReleaseEvidenceMarkdown,
} from './turnero-release-evidence-pack-factory.js';
import { buildTurneroOwnerAutomationMarkdown } from './turnero-release-owner-automation.js';
import {
    buildTurneroReleaseRecheckQueueMarkdown,
    buildTurneroReleaseRecheckStats,
} from './turnero-release-recheck-queue.js';
import {
    normalizeOwner,
    toArray,
    toText,
} from './turnero-release-control-center.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeSelection(selection = {}) {
    return {
        owner: normalizeOwner(selection.owner || 'all'),
        severity: String(selection.severity || 'all')
            .trim()
            .toLowerCase(),
        kind: String(selection.kind || 'all')
            .trim()
            .toLowerCase(),
    };
}

function buildLookup(values, key) {
    return toArray(values).reduce((acc, item) => {
        const value = toText(item?.[key] || 'unknown');
        acc[value] = acc[value] || [];
        acc[value].push(item);
        return acc;
    }, {});
}

export function buildTurneroBulkOperationBundle({
    board = {},
    evidencePack = {},
    queueSnapshot = {},
} = {}) {
    const owners = toArray(board.owners || board.ownerPacks || []);
    const incidents = toArray(evidencePack.incidentPacks || []);
    const tasks = toArray(queueSnapshot.tasks || queueSnapshot.items || []);
    const summary = {
        owners: owners.length,
        incidents: incidents.length,
        tasks: tasks.length,
        staleOwners: toArray(board.staleOwners).length,
        queue: buildTurneroReleaseRecheckStats(tasks),
    };

    return {
        generatedAt:
            evidencePack.generatedAt ||
            queueSnapshot.generatedAt ||
            new Date().toISOString(),
        board,
        evidencePack,
        queueSnapshot,
        owners,
        incidents,
        tasks,
        summary,
        selectionOptions: {
            owners: [
                'all',
                ...owners.map(
                    (owner) => owner.owner || owner.label || 'unknown'
                ),
            ],
            severities: ['all', 'alert', 'warning', 'info'],
            kinds: [
                'all',
                'remote-health',
                'public-shell',
                'surface-heartbeat',
                'evidence-refresh',
                'manual-verify',
            ],
        },
    };
}

export function filterTurneroBulkSelection(bundle = {}, selection = {}) {
    const normalized = normalizeSelection(selection);
    const tasks = toArray(bundle.tasks).filter((task) => {
        if (
            normalized.owner !== 'all' &&
            normalizeOwner(task.owner) !== normalized.owner
        ) {
            return false;
        }
        if (
            normalized.severity !== 'all' &&
            String(task.severity || '').toLowerCase() !== normalized.severity
        ) {
            return false;
        }
        if (
            normalized.kind !== 'all' &&
            String(task.kind || '').toLowerCase() !== normalized.kind
        ) {
            return false;
        }
        return true;
    });
    const owners = toArray(bundle.owners).filter((owner) => {
        if (
            normalized.owner !== 'all' &&
            normalizeOwner(owner.owner || owner.label) !== normalized.owner
        ) {
            return false;
        }
        return true;
    });
    const incidents = toArray(bundle.incidents).filter((incident) => {
        if (
            normalized.owner !== 'all' &&
            normalizeOwner(incident.owner || 'unknown') !== normalized.owner
        ) {
            return false;
        }
        if (
            normalized.severity !== 'all' &&
            String(incident.severity || '').toLowerCase() !==
                normalized.severity
        ) {
            return false;
        }
        return true;
    });

    return {
        ...bundle,
        selection: normalized,
        queueSnapshot: {
            ...asObject(bundle.queueSnapshot),
            tasks,
        },
        tasks,
        owners,
        incidents,
        summary: {
            ...asObject(bundle.summary),
            selectedTasks: tasks.length,
            selectedOwners: owners.length,
            selectedIncidents: incidents.length,
        },
    };
}

export function buildTurneroBulkClipboardText(bundle = {}, selection = {}) {
    const filtered = filterTurneroBulkSelection(bundle, selection);
    const queueMarkdown = buildTurneroReleaseRecheckQueueMarkdown(
        filtered.queueSnapshot || {}
    );
    const boardMarkdown = buildTurneroOwnerAutomationMarkdown(
        filtered.board || {}
    );
    const evidenceMarkdown = buildTurneroReleaseEvidenceMarkdown(
        filtered.evidencePack || {}
    );
    const ownerEvidence = toArray(filtered.owners)
        .map((owner) => buildTurneroOwnerEvidenceMarkdown(owner))
        .join('\n\n');
    const incidentEvidence = toArray(filtered.incidents)
        .map((incident) => buildTurneroIncidentEvidenceMarkdown(incident))
        .join('\n\n');

    return [
        '# Turnero bulk selection',
        '',
        `- owner: ${filtered.selection.owner}`,
        `- severity: ${filtered.selection.severity}`,
        `- kind: ${filtered.selection.kind}`,
        `- selectedTasks: ${filtered.summary?.selectedTasks || 0}`,
        `- selectedOwners: ${filtered.summary?.selectedOwners || 0}`,
        `- selectedIncidents: ${filtered.summary?.selectedIncidents || 0}`,
        '',
        '## Board',
        boardMarkdown,
        '',
        '## Queue',
        queueMarkdown,
        '',
        '## Evidence',
        evidenceMarkdown,
        '',
        '## Owner evidence',
        ownerEvidence || '- sin owners seleccionados',
        '',
        '## Incident evidence',
        incidentEvidence || '- sin incidentes seleccionados',
    ]
        .filter(Boolean)
        .join('\n')
        .trim();
}

export default buildTurneroBulkOperationBundle;
