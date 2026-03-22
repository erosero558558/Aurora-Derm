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

function normalizeReviewStatus(value) {
    const normalized = toString(value, 'watch').toLowerCase();

    if (
        ['ready', 'approved', 'aligned', 'done', 'closed', 'active'].includes(
            normalized
        )
    ) {
        return 'ready';
    }

    if (
        ['watch', 'review', 'pending', 'queued', 'draft'].includes(normalized)
    ) {
        return 'watch';
    }

    if (['degraded', 'warning', 'partial'].includes(normalized)) {
        return 'degraded';
    }

    if (['blocked', 'hold', 'failed'].includes(normalized)) {
        return 'blocked';
    }

    return normalized || 'watch';
}

function resolveRecentReviewItems(ledger = []) {
    return asArray(ledger)
        .map((entry) => ({
            id: toString(entry.id, ''),
            scope: toString(entry.scope, 'regional'),
            surfaceKey: toString(entry.surfaceKey, 'surface'),
            kind: toString(entry.kind, 'review-item'),
            status: normalizeReviewStatus(entry.status),
            title: toString(entry.title || entry.label, 'Executive review item'),
            owner: toString(entry.owner || entry.actor, 'ops'),
            note: toString(entry.note || entry.detail, ''),
            createdAt: toString(entry.createdAt, ''),
            updatedAt: toString(entry.updatedAt || entry.createdAt, ''),
            meta:
                entry.meta && typeof entry.meta === 'object'
                    ? { ...entry.meta }
                    : {},
        }))
        .sort((left, right) =>
            String(right.updatedAt || right.createdAt || '').localeCompare(
                String(left.updatedAt || left.createdAt || '')
            )
        );
}

function resolveActiveOwners(owners = []) {
    return asArray(owners)
        .map((owner) => ({
            id: toString(owner.id, ''),
            scope: toString(owner.scope, 'regional'),
            surfaceKey: toString(owner.surfaceKey, 'surface'),
            actor: toString(owner.actor || owner.owner || owner.name, 'owner'),
            role: toString(owner.role, 'executive-review'),
            status: normalizeOwnerStatus(owner.status),
            note: toString(owner.note, ''),
            createdAt: toString(owner.createdAt, ''),
            updatedAt: toString(owner.updatedAt || owner.createdAt, ''),
            meta:
                owner.meta && typeof owner.meta === 'object'
                    ? { ...owner.meta }
                    : {},
        }))
        .filter((owner) => owner.status === 'active');
}

function mapPriorityState(priorityBand) {
    const normalized = toString(priorityBand, 'watch').toLowerCase();
    if (['p1', 'core', 'critical', 'aligned'].includes(normalized)) {
        return 'ready';
    }
    if (['p2', 'watch', 'p3', 'pending'].includes(normalized)) {
        return 'warning';
    }
    return 'alert';
}

function mapReviewState(decisionState) {
    const normalized = toString(decisionState, 'pending').toLowerCase();
    if (['approved', 'ready', 'aligned', 'done', 'closed'].includes(normalized)) {
        return 'ready';
    }
    if (
        ['watch', 'pending', 'review', 'draft', 'queued'].includes(normalized)
    ) {
        return 'warning';
    }
    return 'alert';
}

function mapScoreState(gateBand) {
    const normalized = toString(gateBand, 'blocked').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function buildBriefLines(state = {}) {
    const lines = [
        '# Surface Executive Review',
        '',
        `Scope: ${toString(state.scope, 'regional')}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey || 'surface')}`,
        `Priority: ${toString(state.priorityBand, 'unknown')}`,
        `Review: ${toString(state.decisionState, 'pending')}`,
        `Owner: ${toString(state.reviewOwner, 'ops')}`,
        `Window: ${toString(state.reviewWindow, 'sin ventana')}`,
        `Gate: ${toString(state.gateBand, 'blocked')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'hold-executive-review')}`,
        `Checklist: ${Number(state.checklistPass || 0)}/${Number(
            state.checklistAll || 0
        )} pass`,
        `Review items: ${Number(state.reviewItemCount || 0)}`,
        `Owners activos: ${Number(state.activeOwnerCount || 0)}`,
        '',
        '## Recent items',
    ];

    if (!state.reviewItems.length) {
        lines.push('- Sin items registrados.');
    } else {
        state.reviewItems.forEach((item) => {
            lines.push(
                `- [${toString(item.status, 'watch')}] ${toString(
                    item.surfaceKey,
                    'surface'
                )} · ${toString(item.kind, 'review-item')} · ${toString(
                    item.title,
                    ''
                )}`
            );
        });
    }

    lines.push('', '## Owners');

    if (!state.activeOwners.length) {
        lines.push('- Sin owners activos.');
    } else {
        state.activeOwners.forEach((owner) => {
            lines.push(
                `- [${toString(owner.status, 'active')}] ${toString(
                    owner.actor,
                    'owner'
                )} · ${toString(owner.role, 'executive-review')} · ${toString(
                    owner.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceExecutiveReviewReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = asObject(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const reviewItems = resolveRecentReviewItems(
        ledger.length > 0 ? ledger : input.reviewItems
    );
    const activeOwners = resolveActiveOwners(
        owners.length > 0 ? owners : input.activeOwners
    );

    const checklistSummary =
        gate.checklistSummary && typeof gate.checklistSummary === 'object'
            ? gate.checklistSummary
            : checklist.summary && typeof checklist.summary === 'object'
              ? checklist.summary
              : {
                    all: 0,
                    pass: 0,
                    fail: 0,
                };

    const checklistAll = Number(checklistSummary.all || 0) || 0;
    const checklistPass = Number(checklistSummary.pass || 0) || 0;
    const checklistFail = Number(checklistSummary.fail || 0) || 0;
    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const gateDecision = toString(
        gate.decision,
        'hold-executive-review'
    );
    const surfaceLabel = toString(
        snapshot.surfaceLabel,
        snapshot.surfaceKey || 'surface'
    );
    const clinicId = toString(snapshot.clinicId, '');
    const clinicLabel = toString(snapshot.clinicLabel, clinicId);
    const scope = toString(snapshot.scope, 'regional');
    const runtimeState = toString(snapshot.runtimeState, 'unknown');
    const truth = toString(snapshot.truth, 'unknown');
    const portfolioBand = toString(snapshot.portfolioBand, 'unknown');
    const priorityBand = toString(snapshot.priorityBand, 'unknown');
    const decisionState = toString(
        snapshot.decisionState,
        gateBand === 'ready' ? 'approved' : 'watch'
    );
    const reviewWindow = toString(snapshot.reviewWindow, '');
    const reviewOwner = toString(
        snapshot.reviewOwner ||
            activeOwners[0]?.actor ||
            activeOwners[0]?.owner ||
            'ops',
        'ops'
    );
    const summary =
        gateBand === 'ready'
            ? 'Revisión ejecutiva alineada y lista.'
            : gateBand === 'watch'
              ? 'Revisión ejecutiva visible con seguimiento.'
              : gateBand === 'degraded'
                ? 'Revisión ejecutiva necesita estabilización.'
                : 'Revisión ejecutiva en espera.';
    const detail =
        gate.detail ||
        [
            `Checklist ${checklistPass}/${checklistAll}`,
            `Items ${reviewItems.length}`,
            `Owners activos ${activeOwners.length}`,
        ].join(' · ');

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceProfileKey: toString(snapshot.surfaceProfileKey, ''),
        surfaceLabel,
        clinicId,
        clinicLabel,
        scope,
        runtimeState,
        truth,
        portfolioBand,
        priorityBand,
        decisionState,
        reviewWindow,
        reviewOwner,
        gateBand,
        gateScore,
        gateDecision,
        checklistAll,
        checklistPass,
        checklistFail,
        reviewItemCount: reviewItems.length,
        ownerCount: asArray(owners).length,
        activeOwnerCount: activeOwners.length,
        reviewItems,
        activeOwners,
        latestReviewItem: reviewItems[0] || null,
        summary,
        detail,
        title:
            gateBand === 'ready'
                ? 'Executive review aligned'
                : 'Executive review visible',
        checkpoints: [
            {
                label: 'priority',
                value: priorityBand,
                state: mapPriorityState(priorityBand),
            },
            {
                label: 'review',
                value: decisionState,
                state: mapReviewState(decisionState),
            },
            {
                label: 'score',
                value: String(gateScore),
                state: mapScoreState(gateBand),
            },
        ],
        brief: buildBriefLines({
            surfaceKey: toString(snapshot.surfaceKey, 'surface'),
            surfaceLabel,
            clinicId,
            clinicLabel,
            scope,
            runtimeState,
            truth,
            portfolioBand,
            priorityBand,
            decisionState,
            reviewWindow,
            reviewOwner,
            gateBand,
            gateScore,
            gateDecision,
            checklistAll,
            checklistPass,
            reviewItemCount: reviewItems.length,
            activeOwnerCount: activeOwners.length,
            reviewItems,
            activeOwners,
        }),
        generatedAt: new Date().toISOString(),
    };
}

export {
    buildBriefLines as formatTurneroSurfaceExecutiveReviewBrief,
    mapPriorityState as resolveTurneroSurfaceExecutiveReviewPriorityState,
    mapReviewState as resolveTurneroSurfaceExecutiveReviewReviewState,
    mapScoreState as resolveTurneroSurfaceExecutiveReviewScoreState,
};

export default buildTurneroSurfaceExecutiveReviewReadout;
