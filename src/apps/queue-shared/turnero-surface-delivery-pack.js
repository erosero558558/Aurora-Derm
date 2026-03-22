import { buildTurneroSurfaceDeliveryGate } from './turnero-surface-delivery-gate.js';
import { buildTurneroSurfaceDeliveryReadout } from './turnero-surface-delivery-readout.js';
import { buildTurneroSurfaceDeliverySnapshot } from './turnero-surface-delivery-snapshot.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function resolveChecklistDefaults(surfaceKey) {
    const normalizedSurfaceKey = toString(surfaceKey, 'surface');
    if (normalizedSurfaceKey === 'kiosk') {
        return { all: 5, pass: 2, fail: 3 };
    }
    if (normalizedSurfaceKey === 'display') {
        return { all: 5, pass: 5, fail: 0 };
    }
    if (normalizedSurfaceKey === 'admin') {
        return { all: 6, pass: 4, fail: 2 };
    }
    return { all: 5, pass: 4, fail: 1 };
}

function normalizeChecklist(input = {}, surfaceKey = '') {
    const source = asObject(input);
    const summary = asObject(source.summary);
    const defaults = resolveChecklistDefaults(surfaceKey);

    return {
        all: Math.max(0, Number(summary.all ?? defaults.all) || 0),
        pass: Math.max(0, Number(summary.pass ?? defaults.pass) || 0),
        fail: Math.max(0, Number(summary.fail ?? defaults.fail) || 0),
        checks: Array.isArray(source.checks)
            ? source.checks.filter(Boolean)
            : [],
    };
}

function buildBriefLines(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const checklist = asObject(pack.checklist);
    const gate = asObject(pack.gate);
    const readout = asObject(pack.readout);
    const ledger = Array.isArray(pack.ledger) ? pack.ledger : [];
    const owners = Array.isArray(pack.owners) ? pack.owners : [];

    const lines = [
        '# Surface Delivery Planning Console',
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
        `Decision: ${toString(gate.decision, 'hold-delivery-plan')}`,
        `Summary: ${toString(readout.summary, gate.summary || '')}`,
        `Detail: ${toString(readout.detail, gate.detail || '')}`,
        '',
        `Checklist: ${Number(checklist.pass || 0)}/${Number(
            checklist.all || 0
        )} pass`,
        `Target window: ${toString(snapshot.targetWindow, 'sin-ventana')}`,
        `Truth: ${toString(snapshot.truth, 'watch')}`,
        `Open deps: ${Number(gate.openDependencyCount || 0) || 0}`,
        `Open blockers: ${Number(gate.openBlockerCount || 0) || 0}`,
        `Delivery owner: ${toString(snapshot.deliveryOwner, 'sin-owner') || 'sin-owner'}`,
        `Release owner: ${toString(snapshot.releaseOwner, 'sin-owner') || 'sin-owner'}`,
        `Ops owner: ${toString(snapshot.opsOwner, 'sin-owner') || 'sin-owner'}`,
        '',
        '## Ledger',
    ];

    if (ledger.length === 0) {
        lines.push('Sin delivery items registrados.');
    } else {
        ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'open')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'plan')} · ${toString(
                    entry.owner,
                    'ops'
                )} · ${toString(entry.title, 'Delivery item')} · ${toString(entry.targetWindow, 'sin-ventana')} · ${toString(entry.dependencyRef, 'sin-ref')} · ${toString(entry.note, '')}`
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
                    'delivery'
                )} · ${toString(entry.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

function resolvePackInput(input = {}) {
    if (
        input &&
        typeof input === 'object' &&
        input.snapshot &&
        input.checklist &&
        input.gate &&
        input.readout
    ) {
        return input;
    }

    return buildTurneroSurfaceDeliveryPack(input);
}

export function buildTurneroSurfaceDeliveryPack(input = {}) {
    const snapshot = buildTurneroSurfaceDeliverySnapshot(input);
    const checklist = normalizeChecklist(input.checklist, snapshot.surfaceKey);
    const ledger = toArray(input.ledger);
    const owners = toArray(input.owners);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band, 'watch'),
                  score: Number(input.gate.score || 0) || 0,
                  decision: toString(
                      input.gate.decision,
                      input.gate.band === 'ready'
                          ? 'ready-for-delivery-window'
                          : input.gate.band === 'watch'
                            ? 'watch-delivery-dependencies'
                            : 'hold-delivery-plan'
                  ),
              }
            : buildTurneroSurfaceDeliveryGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceDeliveryReadout({
        snapshot,
        gate,
        checklist,
        ledger,
        owners,
    });

    return {
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

export function formatTurneroSurfaceDeliveryBrief(input = {}) {
    const pack = resolvePackInput(input);
    return toString(pack.brief, buildBriefLines(pack));
}
