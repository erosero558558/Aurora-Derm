import { buildTurneroSurfaceSuccessGate } from './turnero-surface-success-gate.js';
import { buildTurneroSurfaceSuccessReadout } from './turnero-surface-success-readout.js';
import { buildTurneroSurfaceSuccessSnapshot } from './turnero-surface-success-snapshot.js';

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
    const source = asObject(input);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => asObject(item));
    const defaults = resolveChecklistDefaults(surfaceKey);
    const allFromChecks = checks.length;
    const passFromChecks = checks.filter(
        (check) =>
            check.pass === true ||
            toString(check.state, '').toLowerCase() === 'pass'
    ).length;
    const failFromChecks = checks.filter(
        (check) =>
            check.pass !== true &&
            toString(check.state, '').toLowerCase() !== 'pass'
    ).length;

    return {
        all: Math.max(
            0,
            Number(
                summary.all ??
                    (allFromChecks > 0 ? allFromChecks : defaults.all)
            ) || 0
        ),
        pass: Math.max(
            0,
            Number(
                summary.pass ??
                    (allFromChecks > 0 ? passFromChecks : defaults.pass)
            ) || 0
        ),
        fail: Math.max(
            0,
            Number(
                summary.fail ??
                    (allFromChecks > 0 ? failFromChecks : defaults.fail)
            ) || 0
        ),
        checks,
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
        '# Surface Customer Success',
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
        `Decision: ${toString(gate.decision, 'hold-success-readiness')}`,
        `Summary: ${toString(readout.summary, gate.summary || '')}`,
        `Detail: ${toString(readout.detail, gate.detail || '')}`,
        '',
        '## Checklist',
    ];

    toArray(checklist.checks).forEach((check) => {
        lines.push(
            `- [${toString(check.state, check.pass === true ? 'pass' : 'warn')}] ${toString(
                check.label,
                check.key || 'check'
            )} · ${toString(check.detail, '')}`
        );
    });

    lines.push('', '## Evidence');
    if (ledger.length === 0) {
        lines.push('Sin evidencia registrada.');
    } else {
        ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'followup-note')} · ${toString(
                    entry.owner,
                    'success'
                )} · ${toString(entry.note, '')}`
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
                    'success'
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

    return buildTurneroSurfaceSuccessPack(input);
}

export function buildTurneroSurfaceSuccessPack(input = {}) {
    const snapshot = buildTurneroSurfaceSuccessSnapshot(input);
    const checklist = normalizeChecklist(input.checklist, snapshot.surfaceKey);
    const ledger = toArray(input.ledger);
    const owners = toArray(input.owners);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band, 'degraded'),
                  score: Number(input.gate.score || 0) || 0,
                  decision: toString(
                      input.gate.decision,
                      input.gate.band === 'ready'
                          ? 'customer-success-ready'
                          : input.gate.band === 'watch'
                            ? 'review-success-readiness'
                            : input.gate.band === 'degraded'
                              ? 'stabilize-success-readiness'
                              : 'hold-success-readiness'
                  ),
              }
            : buildTurneroSurfaceSuccessGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceSuccessReadout({
        snapshot,
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

export function formatTurneroSurfaceSuccessBrief(input = {}) {
    const pack = resolvePackInput(input);
    return toString(pack.brief, buildBriefLines(pack));
}
