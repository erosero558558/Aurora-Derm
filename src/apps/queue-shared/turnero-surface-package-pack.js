import { buildTurneroSurfacePackageGate } from './turnero-surface-package-gate.js';
import { buildTurneroSurfacePackageReadout } from './turnero-surface-package-readout.js';
import { buildTurneroSurfacePackageSnapshot } from './turnero-surface-package-snapshot.js';
import { createTurneroSurfacePackageLedger } from './turnero-surface-package-ledger.js';
import { createTurneroSurfacePackageOwnerStore } from './turnero-surface-package-owner-store.js';

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

    if (Array.isArray(checklist.checks)) {
        const counts = checklist.checks.reduce(
            (accumulator, check) => {
                const state = toString(check?.state, 'warn').toLowerCase();
                accumulator.all += 1;
                if (state === 'pass') {
                    accumulator.pass += 1;
                } else if (state === 'warn') {
                    accumulator.fail += 1;
                } else {
                    accumulator.fail += 1;
                }
                return accumulator;
            },
            { all: 0, pass: 0, fail: 0 }
        );

        return {
            ...checklist,
            summary: counts,
        };
    }

    return {
        summary: {
            all: 4,
            pass: 2,
            fail: 2,
        },
    };
}

function normalizeArtifactKind(value) {
    const normalized = toString(value, 'note')
        .toLowerCase()
        .replace(/[\s_]+/g, '-');

    if (normalized === 'onboardingkit') {
        return 'onboarding-kit';
    }

    if (normalized === 'package-note') {
        return 'note';
    }

    return normalized || 'note';
}

function normalizeArtifactStatus(value) {
    const normalized = toString(value, 'draft').toLowerCase();

    if (
        ['ready', 'done', 'closed', 'approved', 'aligned', 'complete'].includes(
            normalized
        )
    ) {
        return 'ready';
    }

    if (['watch', 'review', 'pending', 'queued', 'draft'].includes(normalized)) {
        return 'watch';
    }

    if (['degraded', 'warning', 'partial'].includes(normalized)) {
        return 'degraded';
    }

    if (['blocked', 'hold', 'failed'].includes(normalized)) {
        return 'blocked';
    }

    if (normalized === 'active') {
        return 'active';
    }

    return normalized || 'draft';
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();

    if (['active', 'ready', 'primary'].includes(normalized)) {
        return 'active';
    }

    if (
        ['paused', 'hold', 'suspended', 'standby', 'pending'].includes(
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

function resolveLatestArtifactMap(ledger = []) {
    const latest = {
        bundle: null,
        provisioning: null,
        onboardingKit: null,
        note: null,
    };

    asArray(ledger).forEach((entry) => {
        const kind = normalizeArtifactKind(entry?.kind);
        const summary = {
            kind,
            label: toString(entry.title || entry.label, ''),
            status: normalizeArtifactStatus(entry.status),
            owner: toString(entry.owner || entry.actor, ''),
            note: toString(entry.note || entry.detail, ''),
            updatedAt: toString(entry.updatedAt || entry.createdAt, ''),
            raw: { ...entry },
        };

        if (kind === 'bundle' && latest.bundle === null) {
            latest.bundle = summary;
        } else if (kind === 'provisioning' && latest.provisioning === null) {
            latest.provisioning = summary;
        } else if (
            kind === 'onboarding-kit' &&
            latest.onboardingKit === null
        ) {
            latest.onboardingKit = summary;
        } else if (kind === 'note' && latest.note === null) {
            latest.note = summary;
        }
    });

    return latest;
}

function resolveActivePackageOwner(owners = []) {
    const activeOwners = asArray(owners).filter(
        (owner) => normalizeOwnerStatus(owner?.status) === 'active'
    );

    const preferredOwner = activeOwners[0] || asArray(owners)[0] || null;
    return toString(
        preferredOwner?.actor || preferredOwner?.owner || preferredOwner?.name,
        ''
    );
}

function resolveArtifactState(value, fallback = 'draft') {
    const normalized = normalizeArtifactStatus(value || fallback);
    return normalized === 'active' ? 'ready' : normalized;
}

function summarizeArtifact(entry) {
    if (!entry) {
        return null;
    }

    return {
        kind: normalizeArtifactKind(entry.kind),
        label: toString(entry.label || entry.title, ''),
        status: normalizeArtifactStatus(entry.status),
        owner: toString(entry.owner, ''),
        note: toString(entry.note, ''),
        updatedAt: toString(entry.updatedAt, ''),
        raw: { ...entry },
    };
}

export function buildTurneroSurfacePackagePack(input = {}) {
    const snapshotBase = buildTurneroSurfacePackageSnapshot(input);
    const scope = snapshotBase.scope;
    const ledgerStore =
        input.ledgerStore &&
        typeof input.ledgerStore.list === 'function' &&
        typeof input.ledgerStore.add === 'function'
            ? input.ledgerStore
            : createTurneroSurfacePackageLedger(scope, input.clinicProfile);
    const ownerStore =
        input.ownerStore &&
        typeof input.ownerStore.list === 'function' &&
        typeof input.ownerStore.add === 'function'
            ? input.ownerStore
            : createTurneroSurfacePackageOwnerStore(scope, input.clinicProfile);
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
    const latestArtifacts = resolveLatestArtifactMap(ledger);
    const snapshot = {
        ...snapshotBase,
        packageOwner:
            toString(input.packageOwner, '') || resolveActivePackageOwner(owners),
        bundleState: resolveArtifactState(
            input.bundleState || latestArtifacts.bundle?.status,
            snapshotBase.bundleState
        ),
        provisioningState: resolveArtifactState(
            input.provisioningState || latestArtifacts.provisioning?.status,
            snapshotBase.provisioningState
        ),
        onboardingKitState: resolveArtifactState(
            input.onboardingKitState ||
                latestArtifacts.onboardingKit?.status,
            snapshotBase.onboardingKitState
        ),
        slaBand: toString(input.slaBand, snapshotBase.slaBand || 'watch'),
        updatedAt: toString(
            input.updatedAt,
            latestArtifacts.bundle?.updatedAt ||
                latestArtifacts.provisioning?.updatedAt ||
                latestArtifacts.onboardingKit?.updatedAt ||
                snapshotBase.updatedAt
        ),
    };
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfacePackageGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
                  latestArtifacts,
              });
    const readout = buildTurneroSurfacePackageReadout({
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        latestArtifacts: {
            bundle: summarizeArtifact(latestArtifacts.bundle),
            provisioning: summarizeArtifact(latestArtifacts.provisioning),
            onboardingKit: summarizeArtifact(latestArtifacts.onboardingKit),
            note: summarizeArtifact(latestArtifacts.note),
        },
    });

    return {
        scope,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        latestArtifacts: {
            bundle: summarizeArtifact(latestArtifacts.bundle),
            provisioning: summarizeArtifact(latestArtifacts.provisioning),
            onboardingKit: summarizeArtifact(latestArtifacts.onboardingKit),
            note: summarizeArtifact(latestArtifacts.note),
        },
        generatedAt: new Date().toISOString(),
    };
}
