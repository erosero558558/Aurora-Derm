function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const source =
        checklist && typeof checklist === 'object'
            ? checklist.summary && typeof checklist.summary === 'object'
                ? checklist.summary
                : checklist
            : null;
    return {
        all: Math.max(0, toNumber(source?.all)),
        pass: Math.max(0, toNumber(source?.pass)),
        fail: Math.max(0, toNumber(source?.fail)),
    };
}

function normalizeLedgerStatus(value) {
    const normalized = toString(value, 'open').toLowerCase();
    if (
        ['ready', 'done', 'closed', 'approved', 'resolved', 'clear', 'complete'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    if (['blocked', 'hold', 'failed', 'alert'].includes(normalized)) {
        return 'blocked';
    }
    if (['draft', 'note'].includes(normalized)) {
        return 'draft';
    }
    return 'open';
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'ready', 'primary', 'assigned'].includes(normalized)) {
        return 'active';
    }
    if (['paused', 'hold', 'suspended', 'standby', 'pending'].includes(normalized)) {
        return 'partial';
    }
    if (['blocked', 'inactive', 'retired', 'closed', 'done'].includes(normalized)) {
        return 'inactive';
    }
    return 'active';
}

function normalizeTruth(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (['aligned', 'ready', 'watch', 'draft', 'degraded', 'blocked'].includes(normalized)) {
        return normalized;
    }
    return 'watch';
}

function normalizePlanningState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (['ready', 'clear'].includes(normalized)) {
        return 'ready';
    }
    if (['blocked', 'hold', 'failed'].includes(normalized)) {
        return 'blocked';
    }
    return 'watch';
}

const REQUIRED_ROLES = Object.freeze(['delivery', 'release', 'ops']);

function getSnapshotOwner(snapshot, role) {
    if (role === 'delivery') {
        return toString(snapshot.deliveryOwner);
    }
    if (role === 'release') {
        return toString(snapshot.releaseOwner);
    }
    if (role === 'ops') {
        return toString(snapshot.opsOwner);
    }
    return '';
}

function resolveRoleCoverage(snapshot, owners) {
    const coverage = {};

    REQUIRED_ROLES.forEach((role) => {
        const matchingOwners = owners.filter(
            (entry) => toString(entry.role, '').toLowerCase() === role
        );
        const activeOwner = matchingOwners.find(
            (entry) => normalizeOwnerStatus(entry.status) === 'active'
        );
        const partialOwner = matchingOwners.find(
            (entry) => normalizeOwnerStatus(entry.status) === 'partial'
        );
        const snapshotActor = getSnapshotOwner(snapshot, role);

        if (activeOwner) {
            coverage[role] = {
                role,
                actor: toString(activeOwner.actor || activeOwner.owner),
                state: 'active',
                source: 'store',
            };
            return;
        }

        if (snapshotActor) {
            coverage[role] = {
                role,
                actor: snapshotActor,
                state: 'active',
                source: 'snapshot',
            };
            return;
        }

        if (partialOwner) {
            coverage[role] = {
                role,
                actor: toString(partialOwner.actor || partialOwner.owner, role),
                state: 'partial',
                source: 'store',
            };
            return;
        }

        coverage[role] = {
            role,
            actor: '',
            state: 'missing',
            source: 'none',
        };
    });

    return coverage;
}

function countOpenDependencies(snapshot, ledger) {
    const dependencyEntries = ledger.filter(
        (entry) => toString(entry.kind, '').toLowerCase() === 'dependency'
    );
    const openCount = dependencyEntries.filter(
        (entry) => normalizeLedgerStatus(entry.status) !== 'ready'
    ).length;

    if (openCount > 0) {
        return openCount;
    }

    return normalizePlanningState(snapshot.dependencyState) === 'ready' ? 0 : 1;
}

function countOpenBlockers(snapshot, ledger) {
    const blockerEntries = ledger.filter(
        (entry) => toString(entry.kind, '').toLowerCase() === 'blocker'
    );
    const openCount = blockerEntries.filter(
        (entry) => normalizeLedgerStatus(entry.status) !== 'ready'
    ).length;

    if (openCount > 0) {
        return openCount;
    }

    return normalizePlanningState(snapshot.blockerState) === 'blocked' ? 1 : 0;
}

function buildDecision(band) {
    if (band === 'ready') {
        return 'ready-for-delivery-window';
    }
    if (band === 'watch') {
        return 'watch-delivery-dependencies';
    }
    return 'hold-delivery-plan';
}

function buildSummary(band) {
    if (band === 'ready') {
        return 'Delivery plan lista para ejecutar la ventana objetivo.';
    }
    if (band === 'watch') {
        return 'Delivery plan visible con seguimiento de dependencias u owners.';
    }
    return 'Delivery plan bloqueada hasta limpiar blockers y owners faltantes.';
}

function buildDetail(snapshot, coverage, openDependencyCount, openBlockerCount) {
    const coverageSummary = REQUIRED_ROLES.map((role) => {
        const item = coverage[role] || { actor: '', state: 'missing' };
        return `${role} ${item.actor || 'sin-owner'} (${item.state})`;
    }).join(' · ');

    return [
        `window ${toString(snapshot.targetWindow, 'sin-ventana')}`,
        `deps ${openDependencyCount}`,
        `blockers ${openBlockerCount}`,
        coverageSummary,
    ].join(' · ');
}

export function buildTurneroSurfaceDeliveryGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const coverage = resolveRoleCoverage(snapshot, owners);
    const missingRoles = REQUIRED_ROLES.filter(
        (role) => coverage[role]?.state === 'missing'
    );
    const partialRoles = REQUIRED_ROLES.filter(
        (role) => coverage[role]?.state === 'partial'
    );
    const openDependencyCount = countOpenDependencies(snapshot, ledger);
    const openBlockerCount = countOpenBlockers(snapshot, ledger);
    const truth = normalizeTruth(snapshot.truth);
    const runtimeState = toString(snapshot.runtimeState, 'unknown').toLowerCase();

    const score = clamp(
        100 -
            openBlockerCount * 35 -
            openDependencyCount * 12 -
            missingRoles.length * 20 -
            partialRoles.length * 10 -
            checklist.fail * 14 -
            (truth === 'watch' || truth === 'draft'
                ? 8
                : truth === 'degraded'
                  ? 20
                  : truth === 'blocked'
                    ? 34
                    : 0) -
            (runtimeState === 'blocked' || runtimeState === 'offline' ? 12 : 0),
        0,
        100
    );

    let band = 'ready';
    if (
        openBlockerCount > 0 ||
        missingRoles.length > 0 ||
        checklist.fail >= 2 ||
        truth === 'blocked'
    ) {
        band = 'blocked';
    } else if (
        openDependencyCount > 0 ||
        partialRoles.length > 0 ||
        checklist.fail > 0 ||
        truth === 'watch' ||
        truth === 'draft' ||
        truth === 'degraded' ||
        runtimeState === 'watch' ||
        runtimeState === 'degraded'
    ) {
        band = 'watch';
    }

    return {
        score,
        band,
        decision: buildDecision(band),
        summary: buildSummary(band),
        detail: buildDetail(
            snapshot,
            coverage,
            openDependencyCount,
            openBlockerCount
        ),
        checklist,
        openDependencyCount,
        openBlockerCount,
        ownerCoverage: coverage,
        missingRoles,
        partialRoles,
        generatedAt: new Date().toISOString(),
    };
}
