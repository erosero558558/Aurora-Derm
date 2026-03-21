import { buildTurneroSurfaceReplicationGate } from './turnero-surface-replication-gate.js';
import { buildTurneroSurfaceReplicationReadout } from './turnero-surface-replication-readout.js';
import { buildTurneroSurfaceReplicationSnapshot } from './turnero-surface-replication-snapshot.js';

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasChecklistSummary(checklist) {
    return Boolean(
        checklist &&
            typeof checklist === 'object' &&
            checklist.summary &&
            typeof checklist.summary === 'object'
    );
}

function defaultChecklistForSurface(surfaceKey) {
    return surfaceKey === 'kiosco-turnos'
        ? { summary: { all: 4, pass: 2, fail: 2 } }
        : { summary: { all: 4, pass: 3, fail: 1 } };
}

export function buildTurneroSurfaceReplicationPack(input = {}) {
    const snapshot = buildTurneroSurfaceReplicationSnapshot(input);
    const checklist = hasChecklistSummary(input.checklist)
        ? input.checklist
        : defaultChecklistForSurface(snapshot.surfaceKey);
    const templates = asArray(input.templates);
    const owners = asArray(input.owners);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceReplicationGate({
                  snapshot,
                  checklist,
                  templates,
                  owners,
              });
    const readout = buildTurneroSurfaceReplicationReadout({
        snapshot,
        checklist,
        gate,
        templates,
        owners,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        templates,
        owners,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
