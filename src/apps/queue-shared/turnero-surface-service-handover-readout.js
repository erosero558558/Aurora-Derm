import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function toneFromState(value) {
    const normalized = toString(value, 'unknown').toLowerCase();
    if (normalized === 'ready' || normalized === 'active') {
        return 'ready';
    }
    if (
        ['watch', 'warning', 'review', 'backup', 'standby', 'guided'].includes(
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
        all: Number(summary.all || 0) || 0,
        pass: Number(summary.pass || 0) || 0,
        fail: Number(summary.fail || 0) || 0,
        checks: toArray(source.checks).map((item) => asObject(item)),
    };
}

function buildSummary(state) {
    if (state.gateBand === 'ready') {
        return `Service handover listo para ${toString(
            state.surfaceLabel,
            state.surfaceKey
        )}.`;
    }

    if (state.gateBand === 'watch') {
        return `Service handover en observacion para ${toString(
            state.surfaceLabel,
            state.surfaceKey
        )}.`;
    }

    return `Service handover bloqueado para ${toString(
        state.surfaceLabel,
        state.surfaceKey
    )}.`;
}

function buildDetail(snapshot, state) {
    const parts = [
        `Runtime ${toString(snapshot.runtimeState, 'unknown')}`,
        `truth ${toString(snapshot.truth, 'unknown')}`,
        `playbook ${toString(snapshot.playbookState, 'missing')}`,
        `support ${toString(snapshot.supportChannel, 'n/a')}`,
        `handover ${toString(snapshot.handoverMode, 'manual')}`,
    ];

    if (snapshot.primaryOwner || snapshot.backupOwner) {
        parts.push(
            `owners ${toString(snapshot.primaryOwner || 'none')} / ${toString(
                snapshot.backupOwner || 'none'
            )}`
        );
    }

    if (state.playbookCount > 0) {
        parts.push(`playbook ${state.readyPlaybookCount}/${state.playbookCount}`);
    }

    if (state.rosterCount > 0) {
        parts.push(`roster ${state.activeOwnerCount}/${state.rosterCount}`);
    }

    return parts.join(' · ');
}

function buildBrief(state) {
    const lines = [
        '# Surface Service Handover',
        '',
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey)}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'global')}`,
        `Gate: ${toString(state.gateBand, 'unknown')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'review')}`,
        '',
        '## Snapshot',
        `- Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `- Truth: ${toString(state.truth, 'unknown')}`,
        `- Primary owner: ${toString(state.primaryOwner || 'none')}`,
        `- Backup owner: ${toString(state.backupOwner || 'none')}`,
        `- Playbook state: ${toString(state.playbookState, 'missing')}`,
        `- Support channel: ${toString(state.supportChannel, 'n/a')}`,
        `- Handover mode: ${toString(state.handoverMode, 'manual')}`,
        '',
        '## Checklist',
    ];

    if (state.checklist.checks.length === 0) {
        lines.push('- Sin checks.');
    } else {
        state.checklist.checks.forEach((check) => {
            lines.push(
                `- [${check.pass ? 'x' : ' '}] ${toString(check.label, check.key || 'check')}`
            );
        });
    }

    lines.push('', '## Playbook');
    if (state.playbook.length === 0) {
        lines.push('- Sin playbook.');
    } else {
        state.playbook.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.title, 'Service playbook item')} · ${toString(
                    entry.note,
                    ''
                )}`
            );
        });
    }

    lines.push('', '## Owners');
    if (state.roster.length === 0) {
        lines.push('- Sin owners.');
    } else {
        state.roster.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.actor, 'owner')} · ${toString(
                    entry.role,
                    'primary'
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceServiceHandoverReadout(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const checklist = checklistSummary(input.checklist);
    const playbook = toArray(input.playbook).map((entry) => asObject(entry));
    const roster = toArray(input.roster).map((entry) => asObject(entry));
    const gate = asObject(input.gate);

    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const readyPlaybookCount = Number(gate.readyPlaybookCount || 0) || 0;
    const activeOwnerCount = Number(gate.activeOwnerCount || 0) || 0;

    const ownerValue = [
        toString(snapshot.primaryOwner, ''),
        toString(snapshot.backupOwner, ''),
    ]
        .filter(Boolean)
        .join(' / ');

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'surface'
        ),
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'global'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        primaryOwner: toString(snapshot.primaryOwner, ''),
        backupOwner: toString(snapshot.backupOwner, ''),
        playbookState: toString(snapshot.playbookState, 'missing'),
        supportChannel: toString(snapshot.supportChannel, ''),
        handoverMode: toString(snapshot.handoverMode, 'manual'),
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        playbookCount: playbook.length,
        readyPlaybookCount,
        rosterCount: roster.length,
        activeOwnerCount,
        snapshotCount: Number(gate.snapshotCount || 1) || 1,
        readySnapshotCount: Number(gate.readySnapshotCount || 0) || 0,
        watchSnapshotCount: Number(gate.watchSnapshotCount || 0) || 0,
        blockedSnapshotCount: Number(gate.blockedSnapshotCount || 0) || 0,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'review'),
        title:
            gateBand === 'ready'
                ? 'Service handover listo'
                : gateBand === 'watch'
                  ? 'Service handover en observacion'
                  : 'Service handover bloqueado',
        summary: buildSummary({
            ...snapshot,
            gateBand,
        }),
        detail: buildDetail(snapshot, {
            playbookCount: playbook.length,
            readyPlaybookCount,
            rosterCount: roster.length,
            activeOwnerCount,
        }),
        badge: `${gateBand} · ${gateScore}`,
        tone:
            gateBand === 'ready'
                ? 'ready'
                : gateBand === 'watch'
                  ? 'warning'
                  : 'alert',
        state: gateBand,
        chips: [
            {
                label: 'Owner',
                value: ownerValue || 'none',
                state:
                    snapshot.primaryOwner && snapshot.backupOwner
                        ? 'ready'
                        : snapshot.primaryOwner || snapshot.backupOwner
                          ? 'warning'
                          : 'alert',
            },
            {
                label: 'Handover',
                value: toString(snapshot.handoverMode, 'manual'),
                state:
                    snapshot.handoverMode === 'broadcast'
                        ? 'ready'
                        : snapshot.handoverMode === 'guided'
                          ? 'warning'
                          : 'alert',
            },
            {
                label: 'Gate',
                value: `${gateBand} · ${gateScore}`,
                state:
                    gateBand === 'ready'
                        ? 'ready'
                        : gateBand === 'watch'
                          ? 'warning'
                          : 'alert',
            },
        ],
        brief: buildBrief({
            ...snapshot,
            gateBand,
            gateScore,
            gateDecision: toString(gate.decision, 'review'),
            checklist,
            playbook,
            roster,
        }),
        generatedAt: new Date().toISOString(),
    };
}
