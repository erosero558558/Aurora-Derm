import { buildTurneroSurfaceRoadmapGate } from './turnero-surface-roadmap-gate.js';
import { buildTurneroSurfaceRoadmapReadout } from './turnero-surface-roadmap-readout.js';
import { buildTurneroSurfaceRoadmapSnapshot } from './turnero-surface-roadmap-snapshot.js';
import { createTurneroSurfaceRoadmapLedger } from './turnero-surface-roadmap-ledger.js';
import { createTurneroSurfaceRoadmapOwnerStore } from './turnero-surface-roadmap-owner-store.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChecklist(input = {}, surfaceKey = '') {
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : input;
    const summary =
        checklist.summary && typeof checklist.summary === 'object'
            ? checklist.summary
            : null;

    if (summary) {
        return {
            ...checklist,
            summary: {
                all: Math.max(0, Number(summary.all || 0) || 0),
                pass: Math.max(0, Number(summary.pass || 0) || 0),
                fail: Math.max(0, Number(summary.fail || 0) || 0),
            },
        };
    }

    const defaults =
        {
            'operator-turnos': { all: 4, pass: 3, fail: 1 },
            'kiosco-turnos': { all: 4, pass: 2, fail: 2 },
            'sala-turnos': { all: 4, pass: 3, fail: 1 },
        }[toString(surfaceKey, '')] || { all: 4, pass: 2, fail: 2 };

    return {
        summary: defaults,
    };
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'ready', 'primary'].includes(normalized)) {
        return 'active';
    }
    if (['paused', 'hold', 'standby', 'pending'].includes(normalized)) {
        return 'paused';
    }
    if (['inactive', 'retired', 'closed', 'done'].includes(normalized)) {
        return 'inactive';
    }
    return normalized || 'active';
}

function resolveActiveRoadmapOwner(owners = []) {
    const activeOwner = asArray(owners).find(
        (owner) => normalizeOwnerStatus(owner?.status) === 'active'
    );
    const preferredOwner = activeOwner || asArray(owners)[0] || null;
    return toString(
        preferredOwner?.actor || preferredOwner?.owner || preferredOwner?.name,
        ''
    );
}

function resolvePriorityBand(snapshot, ledger) {
    const explicit = toString(snapshot.priorityBand, '');
    if (explicit) {
        return explicit;
    }

    const ledgerEntry = asArray(ledger)[0];
    return toString(ledgerEntry?.priorityBand, 'p3');
}

function resolveNextAction(snapshot, ledger) {
    const explicit = toString(snapshot.nextAction, '');
    if (explicit) {
        return explicit;
    }

    const ledgerEntry = asArray(ledger)[0];
    return toString(ledgerEntry?.nextAction || ledgerEntry?.title, '');
}

function resolveBacklogState(snapshot, ledger) {
    const explicit = toString(snapshot.backlogState, '');
    if (explicit) {
        return explicit;
    }

    return asArray(ledger).length > 0 ? 'curated' : 'draft';
}

export function buildTurneroSurfaceRoadmapPack(input = {}) {
    const snapshotBase = buildTurneroSurfaceRoadmapSnapshot(input);
    const scope = snapshotBase.scope;
    const ledgerStore =
        input.ledgerStore &&
        typeof input.ledgerStore.list === 'function' &&
        typeof input.ledgerStore.add === 'function'
            ? input.ledgerStore
            : createTurneroSurfaceRoadmapLedger(scope, input.clinicProfile);
    const ownerStore =
        input.ownerStore &&
        typeof input.ownerStore.list === 'function' &&
        typeof input.ownerStore.add === 'function'
            ? input.ownerStore
            : createTurneroSurfaceRoadmapOwnerStore(scope, input.clinicProfile);
    const ledger = Array.isArray(input.ledger)
        ? input.ledger.filter(Boolean).map((entry) => ({ ...entry }))
        : ledgerStore.list({ surfaceKey: snapshotBase.surfaceKey });
    const owners = Array.isArray(input.owners)
        ? input.owners.filter(Boolean).map((entry) => ({ ...entry }))
        : ownerStore.list({ surfaceKey: snapshotBase.surfaceKey });
    const snapshot = {
        ...snapshotBase,
        backlogState: resolveBacklogState(snapshotBase, ledger),
        nextAction: resolveNextAction(snapshotBase, ledger),
        priorityBand: resolvePriorityBand(snapshotBase, ledger),
        roadmapOwner: toString(
            input.roadmapOwner || snapshotBase.roadmapOwner,
            resolveActiveRoadmapOwner(owners)
        ),
    };
    const checklist = normalizeChecklist(input, snapshot.surfaceKey);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band, 'blocked'),
                  score: Number(input.gate.score || 0) || 0,
                  decision: toString(
                      input.gate.decision,
                      input.gate.band === 'ready'
                          ? 'roadmap-ready'
                          : input.gate.band === 'watch'
                            ? 'review-next-investment'
                            : 'stabilize-before-roadmap'
                  ),
              }
            : buildTurneroSurfaceRoadmapGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceRoadmapReadout({
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}
