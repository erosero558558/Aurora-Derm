import { buildTurneroSurfaceRenewalGate } from './turnero-surface-renewal-gate.js';
import { buildTurneroSurfaceRenewalReadout } from './turnero-surface-renewal-readout.js';
import { buildTurneroSurfaceRenewalSnapshot } from './turnero-surface-renewal-snapshot.js';
import { createTurneroSurfaceRenewalLedger } from './turnero-surface-renewal-ledger.js';
import { createTurneroSurfaceRenewalOwnerStore } from './turnero-surface-renewal-owner-store.js';

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

function normalizeChecklistDefaults(surfaceKey) {
    const normalizedSurfaceKey = toString(surfaceKey, 'surface');
    if (normalizedSurfaceKey === 'kiosco-turnos') {
        return { all: 4, pass: 2, fail: 2 };
    }
    if (
        normalizedSurfaceKey === 'operator-turnos' ||
        normalizedSurfaceKey === 'sala-turnos'
    ) {
        return { all: 4, pass: 3, fail: 1 };
    }
    return { all: 0, pass: 0, fail: 0 };
}

function normalizeChecklist(input = {}, surfaceKey = '') {
    const checklist = asObject(input.checklist);
    const summary = asObject(checklist.summary);
    const defaults = normalizeChecklistDefaults(surfaceKey);
    return {
        ...checklist,
        summary: {
            all: Math.max(0, Number(summary.all ?? defaults.all) || 0),
            pass: Math.max(0, Number(summary.pass ?? defaults.pass) || 0),
            fail: Math.max(0, Number(summary.fail ?? defaults.fail) || 0),
        },
    };
}

function resolveLatestUpdatedAt(ledger = [], fallback = '') {
    const latest = asArray(ledger)
        .map((entry) => toString(entry.updatedAt || entry.createdAt, ''))
        .find(Boolean);
    return latest || toString(fallback, new Date().toISOString());
}

function resolveOwnerByRole(owners = [], role = '', fallback = '') {
    const normalizedRole = toString(role).toLowerCase();
    const match =
        asArray(owners).find(
            (entry) =>
                toString(entry.role, '').toLowerCase() === normalizedRole &&
                ['active', 'ready', 'primary'].includes(
                    toString(entry.status, 'active').toLowerCase()
                )
        ) ||
        asArray(owners).find(
            (entry) => toString(entry.role, '').toLowerCase() === normalizedRole
        ) ||
        null;
    return toString(match?.actor || match?.owner || match?.name, fallback);
}

function resolvePendingCorrections(ledger = [], fallback = null) {
    const explicit = Number(fallback);
    if (Number.isFinite(explicit) && explicit >= 0) {
        return explicit;
    }

    return asArray(ledger).filter((entry) => {
        const signal = toString(entry.signal, '').toLowerCase();
        const kind = toString(entry.kind, '').toLowerCase();
        const status = toString(entry.status, 'ready').toLowerCase();
        const isCorrection =
            signal === 'correction' || kind.includes('correction');
        if (!isCorrection) {
            return false;
        }
        return !['ready', 'done', 'closed'].includes(status);
    }).length;
}

function buildBriefLines(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const checklist = asObject(pack.checklist);
    const gate = asObject(pack.gate);
    const readout = asObject(pack.readout);
    const ledger = asArray(pack.ledger);
    const owners = asArray(pack.owners);

    const lines = [
        '# Surface Renewal Retention',
        '',
        `Scope: ${toString(snapshot.scope, 'regional')}`,
        `Clinic: ${toString(
            snapshot.clinicLabel,
            snapshot.clinicId || 'default-clinic'
        )}`,
        `Surface: ${toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'surface'
        )}`,
        `Gate: ${Number(gate.score || 0) || 0} (${toString(gate.band, 'watch')})`,
        `Decision: ${toString(gate.decision, 'hold-renewal-readiness')}`,
        `Summary: ${toString(readout.summary, gate.summary || '')}`,
        `Detail: ${toString(readout.detail, gate.detail || '')}`,
        '',
        '## Checklist',
        `- pass ${Number(checklist.summary?.pass || 0) || 0}/${Number(checklist.summary?.all || 0) || 0}`,
        '',
        '## Evidence',
    ];

    if (ledger.length === 0) {
        lines.push('Sin evidencia registrada.');
    } else {
        ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'renewal-note')} · ${toString(
                    entry.signal,
                    'renewal'
                )} · ${toString(entry.owner, 'renewal')} · ${toString(entry.note, '')}`
            );
        });
    }

    lines.push('', '## Owners');
    if (owners.length === 0) {
        lines.push('Sin owners registrados.');
    } else {
        owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.actor, 'owner')} · ${toString(
                    entry.role,
                    'renewal'
                )} · ${toString(entry.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceRenewalPack(input = {}) {
    const snapshotSeed = buildTurneroSurfaceRenewalSnapshot(input);
    const scope = snapshotSeed.scope;
    const ledgerStore =
        input.ledgerStore &&
        typeof input.ledgerStore.list === 'function' &&
        typeof input.ledgerStore.add === 'function'
            ? input.ledgerStore
            : createTurneroSurfaceRenewalLedger(scope, input.clinicProfile);
    const ownerStore =
        input.ownerStore &&
        typeof input.ownerStore.list === 'function' &&
        typeof input.ownerStore.add === 'function'
            ? input.ownerStore
            : createTurneroSurfaceRenewalOwnerStore(scope, input.clinicProfile);
    const ledger = asArray(
        Array.isArray(input.ledger)
            ? input.ledger
            : ledgerStore.list({ surfaceKey: snapshotSeed.surfaceKey })
    );
    const owners = asArray(
        Array.isArray(input.owners)
            ? input.owners
            : ownerStore.list({ surfaceKey: snapshotSeed.surfaceKey })
    );
    const checklist = normalizeChecklist(input, snapshotSeed.surfaceKey);
    const snapshot = buildTurneroSurfaceRenewalSnapshot({
        ...input,
        scope,
        renewalOwner:
            toString(input.renewalOwner, '') ||
            resolveOwnerByRole(owners, 'renewal', snapshotSeed.renewalOwner),
        commercialOwner:
            toString(input.commercialOwner, '') ||
            resolveOwnerByRole(
                owners,
                'commercial',
                snapshotSeed.commercialOwner
            ),
        successOwner:
            toString(input.successOwner, '') ||
            resolveOwnerByRole(owners, 'success', snapshotSeed.successOwner),
        pendingCorrections: resolvePendingCorrections(
            ledger,
            input.pendingCorrections
        ),
        updatedAt: toString(
            input.updatedAt,
            resolveLatestUpdatedAt(ledger, snapshotSeed.updatedAt)
        ),
    });
    const gate =
        input.gate && typeof input.gate === 'object'
            ? input.gate
            : buildTurneroSurfaceRenewalGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceRenewalReadout({
        snapshot,
        gate,
    });

    return {
        scope,
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        brief: buildBriefLines({
            snapshot,
            checklist,
            ledger,
            owners,
            gate,
            readout,
        }),
        generatedAt: new Date().toISOString(),
    };
}
