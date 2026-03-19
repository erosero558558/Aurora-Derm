import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import {
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

function snapshotKey(snapshot, fallbackValue = '') {
    return toText(snapshot?.snapshotId || fallbackValue);
}

function normalizeIncidentForDiff(incident, index = 0) {
    const item = incident && typeof incident === 'object' ? incident : {};
    const kind = toText(item.kind || item.type || item.source || 'incident');
    const owner = toText(item.owner || 'unknown', 'unknown').toLowerCase();
    const label = toText(
        item.label || item.title || item.summary || item.detail || kind,
        `${kind}-${index + 1}`
    );
    const severity = normalizeSeverity(item.severity || item.state || 'info');

    return {
        kind,
        owner,
        label,
        severity,
        incidentId: toText(item.incidentId || item.id || ''),
        detail: toText(item.detail || item.description || ''),
        source: toText(item.source || 'history', 'history'),
    };
}

function normalizeSurfaceForDiff(surface, index = 0) {
    const item = surface && typeof surface === 'object' ? surface : {};
    const key = toText(item.key || item.id || `surface-${index + 1}`);
    const status = normalizeSeverity(item.status || item.state || 'info');
    const releaseMode = toText(item.releaseMode || item.mode || '');

    return {
        key,
        label: toText(
            item.label || item.title || key || `surface-${index + 1}`
        ),
        status,
        releaseMode,
        detail: toText(item.detail || item.summary || ''),
        source: toText(item.source || 'history', 'history'),
    };
}

function buildIncidentKey(incident) {
    return [incident.kind, incident.owner, incident.label]
        .map((entry) => toText(entry).toLowerCase())
        .join('|');
}

function buildSurfaceKey(surface) {
    return toText(surface.key).toLowerCase();
}

function compareStrings(left, right) {
    const leftValue = toText(left);
    const rightValue = toText(right);
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
    return 0;
}

function changePriority(change) {
    if (
        change.kind === 'scalar-decision' ||
        change.kind === 'scalar-severity' ||
        change.kind === 'scalar-profileFingerprint'
    ) {
        return 5;
    }

    if (change.kind === 'incident-severity') {
        return 4;
    }

    if (
        change.kind === 'incident-added' ||
        change.kind === 'incident-removed'
    ) {
        return 3;
    }

    if (change.kind === 'surface-status') {
        return 2;
    }

    return 1;
}

function buildChangeSummary(change) {
    if (change.kind === 'scalar-decision') {
        return `Decision ${change.before} → ${change.after}`;
    }

    if (change.kind === 'scalar-severity') {
        return `Severity ${change.before} → ${change.after}`;
    }

    if (change.kind === 'scalar-profileFingerprint') {
        return `Fingerprint ${change.before} → ${change.after}`;
    }

    if (change.kind === 'incident-added') {
        return `Incidente añadido: ${change.label}`;
    }

    if (change.kind === 'incident-removed') {
        return `Incidente retirado: ${change.label}`;
    }

    if (change.kind === 'incident-severity') {
        return `Incidente ${change.label}: ${change.beforeSeverity} → ${change.afterSeverity}`;
    }

    if (change.kind === 'surface-added') {
        return `Superficie añadida: ${change.label}`;
    }

    if (change.kind === 'surface-removed') {
        return `Superficie retirada: ${change.label}`;
    }

    if (change.kind === 'surface-status') {
        return `Superficie ${change.label}: ${change.beforeStatus} → ${change.afterStatus}`;
    }

    return change.label || change.kind;
}

function buildNormalizedIncidents(snapshot) {
    return toArray(snapshot.incidents)
        .map((incident, index) => normalizeIncidentForDiff(incident, index))
        .sort((left, right) =>
            compareStrings(buildIncidentKey(left), buildIncidentKey(right))
        );
}

function buildNormalizedSurfaces(snapshot) {
    return toArray(snapshot.surfaces)
        .map((surface, index) => normalizeSurfaceForDiff(surface, index))
        .sort((left, right) =>
            compareStrings(buildSurfaceKey(left), buildSurfaceKey(right))
        );
}

export function buildReleaseSnapshotDiff(beforeSnapshot, afterSnapshot) {
    const before = normalizeReleaseSnapshot(beforeSnapshot || {});
    const after = normalizeReleaseSnapshot(afterSnapshot || {});
    const beforeIncidents = buildNormalizedIncidents(before);
    const afterIncidents = buildNormalizedIncidents(after);
    const beforeSurfaces = buildNormalizedSurfaces(before);
    const afterSurfaces = buildNormalizedSurfaces(after);
    const beforeIncidentMap = new Map(
        beforeIncidents.map((incident) => [
            buildIncidentKey(incident),
            incident,
        ])
    );
    const afterIncidentMap = new Map(
        afterIncidents.map((incident) => [buildIncidentKey(incident), incident])
    );
    const beforeSurfaceMap = new Map(
        beforeSurfaces.map((surface) => [buildSurfaceKey(surface), surface])
    );
    const afterSurfaceMap = new Map(
        afterSurfaces.map((surface) => [buildSurfaceKey(surface), surface])
    );

    const incidentsAdded = [];
    const incidentsRemoved = [];
    const incidentSeverityChanges = [];
    const surfacesAdded = [];
    const surfacesRemoved = [];
    const surfaceStatusChanges = [];
    const scalarChanges = [];
    const changes = [];

    afterIncidentMap.forEach((afterIncident, key) => {
        const beforeIncident = beforeIncidentMap.get(key);
        if (!beforeIncident) {
            const change = {
                kind: 'incident-added',
                key,
                label: afterIncident.label,
                owner: afterIncident.owner,
                severity: afterIncident.severity,
                before: null,
                after: afterIncident,
            };
            incidentsAdded.push(afterIncident);
            changes.push(change);
            return;
        }

        if (beforeIncident.severity !== afterIncident.severity) {
            const change = {
                kind: 'incident-severity',
                key,
                label: afterIncident.label,
                owner: afterIncident.owner,
                beforeSeverity: beforeIncident.severity,
                afterSeverity: afterIncident.severity,
                before: beforeIncident,
                after: afterIncident,
            };
            incidentSeverityChanges.push(change);
            changes.push(change);
        }
    });

    beforeIncidentMap.forEach((beforeIncident, key) => {
        if (afterIncidentMap.has(key)) {
            return;
        }

        const change = {
            kind: 'incident-removed',
            key,
            label: beforeIncident.label,
            owner: beforeIncident.owner,
            severity: beforeIncident.severity,
            before: beforeIncident,
            after: null,
        };
        incidentsRemoved.push(beforeIncident);
        changes.push(change);
    });

    afterSurfaceMap.forEach((afterSurface, key) => {
        const beforeSurface = beforeSurfaceMap.get(key);
        if (!beforeSurface) {
            const change = {
                kind: 'surface-added',
                key,
                label: afterSurface.label,
                status: afterSurface.status,
                releaseMode: afterSurface.releaseMode,
                before: null,
                after: afterSurface,
            };
            surfacesAdded.push(afterSurface);
            changes.push(change);
            return;
        }

        if (
            beforeSurface.status !== afterSurface.status ||
            beforeSurface.releaseMode !== afterSurface.releaseMode
        ) {
            const change = {
                kind: 'surface-status',
                key,
                label: afterSurface.label,
                beforeStatus: beforeSurface.status,
                afterStatus: afterSurface.status,
                beforeReleaseMode: beforeSurface.releaseMode,
                afterReleaseMode: afterSurface.releaseMode,
                before: beforeSurface,
                after: afterSurface,
            };
            surfaceStatusChanges.push(change);
            changes.push(change);
        }
    });

    beforeSurfaceMap.forEach((beforeSurface, key) => {
        if (afterSurfaceMap.has(key)) {
            return;
        }

        const change = {
            kind: 'surface-removed',
            key,
            label: beforeSurface.label,
            status: beforeSurface.status,
            releaseMode: beforeSurface.releaseMode,
            before: beforeSurface,
            after: null,
        };
        surfacesRemoved.push(beforeSurface);
        changes.push(change);
    });

    ['decision', 'severity', 'profileFingerprint'].forEach((field) => {
        if (toText(before[field]) === toText(after[field])) {
            return;
        }

        const change = {
            kind: `scalar-${field}`,
            field,
            label: field,
            before: toText(before[field]),
            after: toText(after[field]),
        };
        scalarChanges.push(change);
        changes.push(change);
    });

    const orderedChanges = changes
        .map((change) => ({
            ...change,
            summary: buildChangeSummary(change),
            priority: changePriority(change),
        }))
        .sort((left, right) => right.priority - left.priority);

    return {
        beforeSnapshotId: snapshotKey(before, 'before-snapshot'),
        afterSnapshotId: snapshotKey(after, 'after-snapshot'),
        beforeClinicId: toText(before.clinicId || ''),
        afterClinicId: toText(after.clinicId || ''),
        incidents: {
            added: incidentsAdded,
            removed: incidentsRemoved,
            severityChanges: incidentSeverityChanges,
        },
        surfaces: {
            added: surfacesAdded,
            removed: surfacesRemoved,
            statusChanges: surfaceStatusChanges,
        },
        scalarChanges,
        changes: orderedChanges,
        totalChanges: orderedChanges.length,
        hasChanges: orderedChanges.length > 0,
    };
}

export default buildReleaseSnapshotDiff;
