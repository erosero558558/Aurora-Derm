import { buildTurneroSurfaceOnboardingSnapshot } from './turnero-surface-onboarding-snapshot.js';
import { buildTurneroSurfaceOnboardingGate } from './turnero-surface-onboarding-gate.js';
import { buildTurneroSurfaceOnboardingReadout } from './turnero-surface-onboarding-readout.js';

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

const DEFAULT_CHECKLIST_SUMMARIES = Object.freeze({
    'operator-turnos': { all: 4, pass: 3, fail: 1 },
    'kiosco-turnos': { all: 4, pass: 2, fail: 2 },
    'sala-turnos': { all: 4, pass: 4, fail: 0 },
});

function resolveChecklistDefaults(surfaceKey) {
    return (
        DEFAULT_CHECKLIST_SUMMARIES[toString(surfaceKey, '')] || {
            all: 0,
            pass: 0,
            fail: 0,
        }
    );
}

function normalizeChecklist(input = {}, surfaceKey = '') {
    const source = asObject(input);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => ({ ...asObject(item) }));
    const defaults = resolveChecklistDefaults(surfaceKey);

    const allFromChecks = checks.length;
    const passFromChecks = checks.filter((check) => check.pass === true).length;
    const failFromChecks = checks.filter((check) => check.pass !== true).length;

    return {
        all: Math.max(
            0,
            Number(summary.all || (allFromChecks > 0 ? allFromChecks : defaults.all)) || 0
        ),
        pass: Math.max(
            0,
            Number(
                summary.pass ||
                    (allFromChecks > 0 ? passFromChecks : defaults.pass)
            ) || 0
        ),
        fail: Math.max(
            0,
            Number(
                summary.fail ||
                    (allFromChecks > 0 ? failFromChecks : defaults.fail)
            ) || 0
        ),
        checks,
    };
}

export function buildTurneroSurfaceOnboardingPack(input = {}) {
    const snapshot = buildTurneroSurfaceOnboardingSnapshot(input);
    const checklist = normalizeChecklist(input.checklist, snapshot.surfaceKey);
    const ledger = toArray(input.ledger).map((item) => ({ ...asObject(item) }));
    const owners = toArray(input.owners).map((item) => ({ ...asObject(item) }));
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band, 'blocked'),
                  score: Number(input.gate.score || 0) || 0,
                  decision: toString(
                      input.gate.decision,
                      input.gate.band === 'ready'
                          ? 'onboarding-ready'
                          : input.gate.band === 'watch' ||
                              input.gate.band === 'degraded'
                            ? 'review-onboarding'
                            : 'hold-onboarding'
                  ),
              }
            : buildTurneroSurfaceOnboardingGate({
                  snapshot,
                  snapshots: input.snapshots,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceOnboardingReadout({
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
