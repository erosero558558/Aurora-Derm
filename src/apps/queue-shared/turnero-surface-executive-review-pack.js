import { buildTurneroSurfaceExecutiveReviewGate } from './turnero-surface-executive-review-gate.js';
import { buildTurneroSurfaceExecutiveReviewReadout } from './turnero-surface-executive-review-readout.js';
import {
    buildTurneroSurfaceExecutiveReviewSnapshot,
    normalizeTurneroSurfaceExecutiveReviewSurfaceKey,
} from './turnero-surface-executive-review-snapshot.js';
import { createTurneroSurfaceExecutiveReviewLedger } from './turnero-surface-executive-review-ledger.js';
import { createTurneroSurfaceExecutiveReviewOwnerStore } from './turnero-surface-executive-review-owner-store.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeChecklist(input = {}) {
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : {};
    const summary =
        checklist.summary && typeof checklist.summary === 'object'
            ? checklist.summary
            : null;

    if (summary) {
        return checklist;
    }

    return {
        summary: {
            all: 4,
            pass: 2,
            fail: 2,
        },
    };
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();

    if (['active', 'ready', 'primary'].includes(normalized)) {
        return 'active';
    }

    if (
        ['paused', 'hold', 'suspended', 'standby', 'pending', 'watch'].includes(
            normalized
        )
    ) {
        return 'paused';
    }

    if (['inactive', 'retired', 'closed', 'done'].includes(normalized)) {
        return 'inactive';
    }

    return normalized || 'active';
}

function resolveActiveReviewOwner(owners = []) {
    const activeOwners = asArray(owners).filter(
        (owner) => normalizeOwnerStatus(owner?.status) === 'active'
    );
    const preferred = activeOwners[0] || asArray(owners)[0] || null;
    return toString(
        preferred?.actor || preferred?.owner || preferred?.name,
        ''
    );
}

function normalizeSeedSnapshot(seed, clinicProfile, scope, fallbackSurfaceKey) {
    const source = asObject(seed);
    const snapshotSource = asObject(
        source.snapshot || source.pack?.snapshot || source
    );
    const normalizedSurfaceKey = toString(
        snapshotSource.surfaceKey || source.surfaceKey || fallbackSurfaceKey,
        fallbackSurfaceKey
    );

    return buildTurneroSurfaceExecutiveReviewSnapshot({
        ...snapshotSource,
        scope,
        surfaceKey: normalizedSurfaceKey,
        clinicProfile,
        runtimeState: toString(
            snapshotSource.runtimeState || source.runtimeState,
            'ready'
        ),
        truth: toString(
            snapshotSource.truth || source.truth,
            normalizedSurfaceKey === 'sala-turnos' ? 'aligned' : 'watch'
        ),
        portfolioBand: toString(
            snapshotSource.portfolioBand || source.portfolioBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'watch' : 'core'
        ),
        priorityBand: toString(
            snapshotSource.priorityBand || source.priorityBand,
            normalizedSurfaceKey === 'kiosco-turnos' ? 'p2' : 'p1'
        ),
        decisionState: toString(
            snapshotSource.decisionState || source.decisionState,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? 'pending'
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'approved'
                  : 'watch'
        ),
        reviewWindow: toString(
            snapshotSource.reviewWindow || source.reviewWindow,
            normalizedSurfaceKey === 'kiosco-turnos' ? '' : 'mensual'
        ),
        reviewOwner: toString(
            snapshotSource.reviewOwner || source.reviewOwner,
            normalizedSurfaceKey === 'kiosco-turnos'
                ? ''
                : normalizedSurfaceKey === 'sala-turnos'
                  ? 'ops-display'
                  : 'ops-lead'
        ),
        checklist:
            source.checklist ||
            snapshotSource.checklist ||
            (normalizedSurfaceKey === 'kiosco-turnos'
                ? { summary: { all: 4, pass: 2, fail: 2 } }
                : { summary: { all: 4, pass: 3, fail: 1 } }),
        updatedAt: toString(
            snapshotSource.updatedAt || source.updatedAt,
            new Date().toISOString()
        ),
    });
}

function buildSurfacePack(seed, ledgerRows, ownerRows, clinicProfile, scope) {
    const normalizedSeed = normalizeSeedSnapshot(
        seed,
        clinicProfile,
        scope,
        seed?.surfaceKey || 'operator-turnos'
    );
    const surfaceKey = normalizedSeed.surfaceKey;
    const normalizedSurfaceKey = normalizeTurneroSurfaceExecutiveReviewSurfaceKey(
        surfaceKey
    );
    const ledger = asArray(ledgerRows).filter(
        (entry) =>
            normalizeTurneroSurfaceExecutiveReviewSurfaceKey(
                entry?.surfaceKey
            ) === normalizedSurfaceKey
    );
    const owners = asArray(ownerRows).filter(
        (entry) =>
            normalizeTurneroSurfaceExecutiveReviewSurfaceKey(
                entry?.surfaceKey
            ) === normalizedSurfaceKey
    );
    const pack = buildTurneroSurfaceExecutiveReviewPack({
        ...normalizedSeed,
        clinicProfile,
        scope,
        ledger,
        owners,
    });

    return {
        ...pack,
        surfaceKey: pack.snapshot.surfaceKey,
        label: pack.readout.surfaceLabel,
        ledger,
        owners,
    };
}

export function buildTurneroSurfaceExecutiveReviewPack(input = {}) {
    const snapshotBase = buildTurneroSurfaceExecutiveReviewSnapshot(input);
    const scope = snapshotBase.scope;
    const ledgerStore =
        input.ledgerStore &&
        typeof input.ledgerStore.list === 'function' &&
        typeof input.ledgerStore.add === 'function'
            ? input.ledgerStore
            : createTurneroSurfaceExecutiveReviewLedger(
                  scope,
                  input.clinicProfile
              );
    const ownerStore =
        input.ownerStore &&
        typeof input.ownerStore.list === 'function' &&
        typeof input.ownerStore.add === 'function'
            ? input.ownerStore
            : createTurneroSurfaceExecutiveReviewOwnerStore(
                  scope,
                  input.clinicProfile
              );
    const ledger = asArray(
        Array.isArray(input.ledger)
            ? input.ledger
            : ledgerStore.list({ surfaceKey: snapshotBase.surfaceKey })
    );
    const owners = asArray(
        Array.isArray(input.owners)
            ? input.owners
            : ownerStore.list({ surfaceKey: snapshotBase.surfaceKey })
    );
    const checklist = normalizeChecklist(input);
    const snapshot = {
        ...snapshotBase,
        reviewOwner:
            toString(input.reviewOwner, '') ||
            resolveActiveReviewOwner(owners) ||
            snapshotBase.reviewOwner,
        reviewWindow: toString(input.reviewWindow, snapshotBase.reviewWindow),
        decisionState: toString(input.decisionState, snapshotBase.decisionState),
        updatedAt: toString(input.updatedAt, snapshotBase.updatedAt),
    };
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceExecutiveReviewGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceExecutiveReviewReadout({
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
    });

    return {
        scope,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        generatedAt: new Date().toISOString(),
    };
}

export {
    buildSurfacePack as buildTurneroSurfaceExecutiveReviewSurfacePack,
    normalizeChecklist as normalizeTurneroSurfaceExecutiveReviewPackChecklist,
};

export default buildTurneroSurfaceExecutiveReviewPack;
