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

function formatTimestamp(value) {
    const raw = toString(value);
    if (!raw) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat('es-EC', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(raw));
    } catch (_error) {
        return raw;
    }
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

function normalizePriorityBand(value) {
    const normalized = toString(value, 'p3').toLowerCase();
    return ['p1', 'p2', 'p3'].includes(normalized) ? normalized : 'p3';
}

function mapPriorityBandToChipState(priorityBand) {
    if (priorityBand === 'p1') {
        return 'ready';
    }
    if (priorityBand === 'p2') {
        return 'warning';
    }
    return 'alert';
}

function mapRoadmapBandToChipState(roadmapBand) {
    const normalized = toString(roadmapBand, 'watch').toLowerCase();
    if (['core', 'ready', 'aligned'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'followup', 'observe'].includes(normalized)) {
        return 'warning';
    }
    return 'alert';
}

function mapBacklogStateToChipState(backlogState) {
    const normalized = toString(backlogState, 'draft').toLowerCase();
    if (['curated', 'ready', 'prioritized', 'aligned'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'review', 'queued'].includes(normalized)) {
        return 'warning';
    }
    return 'alert';
}

function mapGateBandToChipState(gateBand) {
    if (gateBand === 'ready') {
        return 'ready';
    }
    if (gateBand === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function buildBriefLines(state = {}) {
    const lines = [
        '# Surface Roadmap Prioritization',
        '',
        `Scope: ${toString(state.scope, 'queue-roadmap')}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey || 'surface')}`,
        `Route: ${toString(state.surfaceRoute, 'n/a')}`,
        `Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `Truth: ${toString(state.truth, 'unknown')}`,
        `Roadmap band: ${toString(state.roadmapBand, 'watch')}`,
        `Backlog: ${toString(state.backlogState, 'draft')}`,
        `Priority: ${toString(state.priorityBand, 'p3')}`,
        `Roadmap owner: ${toString(state.roadmapOwner, 'sin owner')}`,
        `Next action: ${toString(state.nextAction, 'sin siguiente accion')}`,
        `Gate: ${toString(state.gateBand, 'blocked')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(
            state.gateDecision,
            'stabilize-before-roadmap'
        )}`,
        `Checklist: ${Number(state.checklistPass || 0)}/${Number(
            state.checklistAll || 0
        )} pass`,
        `Backlog ready: ${Number(state.readyLedgerCount || 0)}/${Number(
            state.ledgerCount || 0
        )}`,
        '',
        '## Roadmap Items',
    ];

    if (state.ledger.length === 0) {
        lines.push('- Sin roadmap items registrados.');
    } else {
        state.ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'planned')}] ${toString(
                    entry.title,
                    'Roadmap item'
                )} · ${toString(entry.priorityBand, 'p3')} · owner ${toString(
                    entry.owner,
                    'ops'
                )} · ${toString(
                    entry.nextAction || entry.note,
                    ''
                )}`.trim()
            );
        });
    }

    lines.push('', '## Owners');

    if (state.owners.length === 0) {
        lines.push('- Sin owners registrados.');
    } else {
        state.owners.forEach((owner) => {
            lines.push(
                `- [${toString(owner.status, 'active')}] ${toString(
                    owner.actor,
                    'owner'
                )} · ${toString(owner.role, 'roadmap')} · ${toString(
                    owner.note,
                    ''
                )}`.trim()
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceRoadmapReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = asObject(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const surfaceLabel = toString(
        snapshot.surfaceLabel,
        snapshot.surfaceKey || 'surface'
    );
    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const gateDecision = toString(
        gate.decision,
        'stabilize-before-roadmap'
    );
    const priorityBand = normalizePriorityBand(snapshot.priorityBand);
    const roadmapBand = toString(snapshot.roadmapBand, 'watch');
    const backlogState = toString(snapshot.backlogState, 'draft');
    const nextAction = toString(snapshot.nextAction, '');
    const roadmapOwner = toString(snapshot.roadmapOwner, '');
    const checklistAll =
        Number(
            gate.checklistAll ||
                gate.checklistSummary?.all ||
                checklist.summary?.all ||
                0
        ) || 0;
    const checklistPass =
        Number(
            gate.checklistPass ||
                gate.checklistSummary?.pass ||
                checklist.summary?.pass ||
                0
        ) || 0;
    const checklistFail =
        Number(
            gate.checklistFail ||
                gate.checklistSummary?.fail ||
                checklist.summary?.fail ||
                0
        ) || 0;
    const ledgerCount = Number(gate.ledgerCount || ledger.length) || 0;
    const readyLedgerCount = Number(gate.readyLedgerCount || 0) || 0;
    const ownerCount = Number(gate.ownerCount || owners.length) || 0;
    const activeOwnerCount =
        Number(gate.activeOwnerCount || 0) ||
        owners.filter((owner) => normalizeOwnerStatus(owner?.status) === 'active')
            .length;
    const normalizedLedger = ledger.map((entry) => ({
        id: toString(entry.id, ''),
        surfaceKey: toString(entry.surfaceKey, ''),
        title: toString(entry.title, 'Roadmap item'),
        status: toString(entry.status, 'planned'),
        owner: toString(entry.owner, 'ops'),
        priorityBand: normalizePriorityBand(entry.priorityBand),
        nextAction: toString(entry.nextAction, ''),
        note: toString(entry.note, ''),
        updatedAt: toString(entry.updatedAt || entry.createdAt, ''),
    }));
    const normalizedOwners = owners.map((owner) => ({
        id: toString(owner.id, ''),
        surfaceKey: toString(owner.surfaceKey, ''),
        actor: toString(owner.actor || owner.owner, 'owner'),
        role: toString(owner.role, 'roadmap'),
        status: normalizeOwnerStatus(owner.status),
        note: toString(owner.note, ''),
        updatedAt: toString(owner.updatedAt || owner.createdAt, ''),
    }));

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel,
        surfaceRoute: toString(snapshot.surfaceRoute, ''),
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'queue-roadmap'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        roadmapBand,
        backlogState,
        nextAction,
        priorityBand,
        roadmapOwner,
        gateBand,
        gateScore,
        gateDecision,
        checklistAll,
        checklistPass,
        checklistFail,
        ledgerCount,
        readyLedgerCount,
        ownerCount,
        activeOwnerCount,
        ledger: normalizedLedger,
        owners: normalizedOwners,
        summary:
            gateBand === 'ready'
                ? 'Roadmap priorizado y listo para la siguiente inversion.'
                : gateBand === 'watch'
                  ? 'Roadmap visible con seguimiento antes de invertir.'
                  : gateBand === 'degraded'
                    ? 'Roadmap necesita mas claridad antes de la siguiente inversion.'
                    : 'Roadmap bloqueado hasta estabilizar la superficie.',
        detail:
            toString(gate.detail) ||
            [
                `Checklist ${checklistPass}/${checklistAll}`,
                `Backlog listo ${readyLedgerCount}/${ledgerCount}`,
                `Owners activos ${activeOwnerCount}/${ownerCount}`,
                nextAction ? `Next ${nextAction}` : '',
            ]
                .filter(Boolean)
                .join(' · '),
        badge: `${gateBand} · ${gateScore}`,
        checkpoints: [
            {
                label: 'priority',
                value: priorityBand,
                state: mapPriorityBandToChipState(priorityBand),
            },
            {
                label: 'roadmap',
                value: roadmapBand,
                state: mapRoadmapBandToChipState(roadmapBand),
            },
            {
                label: 'backlog',
                value: backlogState,
                state: mapBacklogStateToChipState(backlogState),
            },
            {
                label: 'score',
                value: String(gateScore),
                state: mapGateBandToChipState(gateBand),
            },
        ],
        brief: buildBriefLines({
            ...snapshot,
            surfaceLabel,
            gateBand,
            gateScore,
            gateDecision,
            checklistAll,
            checklistPass,
            ledgerCount,
            readyLedgerCount,
            ledger: normalizedLedger.map((entry) => ({
                ...entry,
                nextAction: entry.nextAction || entry.note,
            })),
            owners: normalizedOwners,
        }),
        updatedAtLabel: formatTimestamp(snapshot.updatedAt),
        generatedAt: new Date().toISOString(),
    };
}

export {
    buildBriefLines as formatTurneroSurfaceRoadmapBrief,
    mapGateBandToChipState as resolveTurneroSurfaceRoadmapCheckpointState,
};
