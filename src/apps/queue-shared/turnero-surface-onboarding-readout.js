import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function toneFromState(value) {
    const normalized = toString(value, 'unknown').toLowerCase();
    if (normalized === 'ready' || normalized === 'active') {
        return 'ready';
    }
    if (
        ['watch', 'warning', 'review', 'pending', 'degraded'].includes(
            normalized
        )
    ) {
        return 'warning';
    }
    return 'alert';
}

function checklistSummary(checklist) {
    const source = asObject(checklist);
    const summary = asObject(source.summary);
    return {
        all: Number(summary.all || source.all || 0) || 0,
        pass: Number(summary.pass || source.pass || 0) || 0,
        fail: Number(summary.fail || source.fail || 0) || 0,
        checks: toArray(source.checks).map((item) => asObject(item)),
    };
}

function buildSummary(state) {
    if (state.gateBand === 'ready') {
        return `Onboarding listo para ${toString(
            state.surfaceLabel,
            state.surfaceKey
        )}.`;
    }
    if (state.gateBand === 'watch') {
        return `Onboarding en observacion para ${toString(
            state.surfaceLabel,
            state.surfaceKey
        )}.`;
    }
    if (state.gateBand === 'degraded') {
        return `Onboarding con brechas para ${toString(
            state.surfaceLabel,
            state.surfaceKey
        )}.`;
    }
    return `Onboarding bloqueado para ${toString(
        state.surfaceLabel,
        state.surfaceKey
    )}.`;
}

function buildDetail(snapshot, state) {
    const parts = [
        `Runtime ${toString(snapshot.runtimeState, 'unknown')}`,
        `truth ${toString(snapshot.truth, 'unknown')}`,
        `kickoff ${toString(snapshot.kickoffState, 'pending')}`,
        `data ${toString(snapshot.dataIntakeState, 'pending')}`,
        `access ${toString(snapshot.accessState, 'pending')}`,
        `training ${toString(snapshot.trainingWindow, 'sin definir')}`,
    ];

    if (snapshot.onboardingOwner) {
        parts.push(`owner ${snapshot.onboardingOwner}`);
    }
    if (state.ledgerCount > 0) {
        parts.push(`items ${state.readyLedgerCount}/${state.ledgerCount}`);
    }
    if (state.ownerCount > 0) {
        parts.push(`owners ${state.activeOwnerCount}/${state.ownerCount}`);
    }

    return parts.join(' · ');
}

function buildBrief(state) {
    const lines = [
        '# Surface Customer Onboarding',
        '',
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey)}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'regional')}`,
        `Gate: ${toString(state.gateBand, 'unknown')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'review-onboarding')}`,
        '',
        '## Snapshot',
        `- Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `- Truth: ${toString(state.truth, 'unknown')}`,
        `- Kickoff: ${toString(state.kickoffState, 'pending')}`,
        `- Data intake: ${toString(state.dataIntakeState, 'pending')}`,
        `- Access: ${toString(state.accessState, 'pending')}`,
        `- Owner: ${toString(state.onboardingOwner, 'none')}`,
        `- Training window: ${toString(state.trainingWindow, 'sin definir')}`,
        '',
        `Checklist: ${state.checklistPass}/${state.checklistAll} · fail ${state.checklistFail}`,
        `Onboarding items: ${state.readyLedgerCount}/${state.ledgerCount}`,
        `Owners: ${state.activeOwnerCount}/${state.ownerCount}`,
        '',
        '## Checklist',
    ];

    if (state.checklist.checks.length === 0) {
        lines.push('- Sin checks.');
    } else {
        state.checklist.checks.forEach((check) => {
            lines.push(
                `- [${check.pass ? 'x' : ' '}] ${toString(
                    check.label,
                    check.key || 'check'
                )}`
            );
        });
    }

    lines.push('', '## Onboarding items');
    if (state.ledger.length === 0) {
        lines.push('- Sin items persistidos.');
    } else {
        state.ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.title, 'Onboarding item')} · ${toString(
                    entry.note,
                    ''
                )}`
            );
        });
    }

    lines.push('', '## Owners');
    if (state.owners.length === 0) {
        lines.push('- Sin owners persistidos.');
    } else {
        state.owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.actor, 'owner')} · ${toString(
                    entry.role,
                    'onboarding'
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceOnboardingReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = checklistSummary(input.checklist);
    const ledger = toArray(input.ledger).map((entry) => asObject(entry));
    const owners = toArray(input.owners).map((entry) => asObject(entry));
    const gate = asObject(input.gate);

    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const readyLedgerCount = Number(gate.readyLedgerCount || 0) || 0;
    const activeOwnerCount = Number(gate.activeOwnerCount || 0) || 0;

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'surface'
        ),
        surfaceRoute: toString(snapshot.surfaceRoute, ''),
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'regional'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        kickoffState: toString(snapshot.kickoffState, 'pending'),
        dataIntakeState: toString(snapshot.dataIntakeState, 'pending'),
        accessState: toString(snapshot.accessState, 'pending'),
        onboardingOwner: toString(snapshot.onboardingOwner, ''),
        trainingWindow: toString(snapshot.trainingWindow, ''),
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'review-onboarding'),
        title:
            gateBand === 'ready'
                ? 'Onboarding listo'
                : gateBand === 'watch'
                  ? 'Onboarding en observacion'
                  : gateBand === 'degraded'
                    ? 'Onboarding con brechas'
                    : 'Onboarding bloqueado',
        summary: buildSummary({
            ...snapshot,
            gateBand,
        }),
        detail: buildDetail(snapshot, {
            ledgerCount: ledger.length,
            readyLedgerCount,
            ownerCount: owners.length,
            activeOwnerCount,
        }),
        badge: `${gateBand} · ${gateScore}`,
        tone:
            gateBand === 'ready'
                ? 'ready'
                : gateBand === 'watch' || gateBand === 'degraded'
                  ? 'warning'
                  : 'alert',
        state: gateBand,
        chips: [
            {
                label: 'kickoff',
                value: toString(snapshot.kickoffState, 'pending'),
                state: toneFromState(snapshot.kickoffState),
            },
            {
                label: 'onboarding',
                value: gateBand,
                state:
                    gateBand === 'ready'
                        ? 'ready'
                        : gateBand === 'watch' || gateBand === 'degraded'
                          ? 'warning'
                          : 'alert',
            },
            {
                label: 'score',
                value: String(gateScore),
                state:
                    gateBand === 'ready'
                        ? 'ready'
                        : gateBand === 'watch' || gateBand === 'degraded'
                          ? 'warning'
                          : 'alert',
            },
        ],
        brief: buildBrief({
            ...snapshot,
            gateBand,
            gateScore,
            gateDecision: toString(gate.decision, 'review-onboarding'),
            checklist,
            ledger,
            owners,
            readyLedgerCount,
            activeOwnerCount,
            checklistAll: checklist.all,
            checklistPass: checklist.pass,
            checklistFail: checklist.fail,
            ownerCount: owners.length,
            ledgerCount: ledger.length,
        }),
        generatedAt: new Date().toISOString(),
    };
}
