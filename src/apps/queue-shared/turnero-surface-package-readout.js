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

function resolveLatestArtifactMap(ledger = [], fallback = {}) {
    const latest = {
        bundle: null,
        provisioning: null,
        onboardingKit: null,
        note: null,
        ...asObject(fallback),
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
        } else if (kind === 'onboarding-kit' && latest.onboardingKit === null) {
            latest.onboardingKit = summary;
        } else if (kind === 'note' && latest.note === null) {
            latest.note = summary;
        }
    });

    return latest;
}

function resolveOwnerLabel(owner) {
    return toString(owner?.actor || owner?.owner || owner?.name, 'owner');
}

function resolveOwnerRole(owner) {
    return toString(owner?.role, 'package');
}

function resolveOwnerState(owner) {
    return normalizeOwnerStatus(owner?.status);
}

function resolveSurfaceLabel(snapshot = {}) {
    return toString(snapshot.surfaceLabel, snapshot.surfaceKey || 'surface');
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

function buildArtifactSummaryLine(label, artifact) {
    if (!artifact) {
        return `${label}: pendiente`;
    }

    const parts = [
        `${label}: ${artifact.status}`,
        artifact.label ? `\"${artifact.label}\"` : '',
        artifact.owner ? `owner ${artifact.owner}` : '',
        artifact.note ? artifact.note : '',
        artifact.updatedAt ? formatTimestamp(artifact.updatedAt) : '',
    ].filter(Boolean);

    return parts.join(' · ');
}

function buildBriefLines(state = {}) {
    const lines = [
        '# Surface Package Standardization',
        '',
        `Scope: ${toString(state.scope, 'regional')}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey || 'surface')}`,
        `Package tier: ${toString(state.packageTier, 'pilot')}`,
        `Package owner: ${toString(state.packageOwner, 'sin owner')}`,
        `Runtime: ${toString(state.runtimeState, 'unknown')}`,
        `Truth: ${toString(state.truth, 'unknown')}`,
        `Gate: ${toString(state.gateBand, 'blocked')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(
            state.gateDecision,
            'hold-package-standardization'
        )}`,
        `Checklist: ${Number(state.checklistPass || 0)}/${Number(
            state.checklistAll || 0
        )} pass`,
        `Artifacts ready: ${Number(state.readyArtifactCount || 0)}/${Number(
            state.requiredArtifactCount || 3
        )}`,
        '',
        '## Artifacts',
        buildArtifactSummaryLine('Bundle', state.latestArtifacts?.bundle),
        buildArtifactSummaryLine(
            'Provisioning',
            state.latestArtifacts?.provisioning
        ),
        buildArtifactSummaryLine(
            'Onboarding kit',
            state.latestArtifacts?.onboardingKit
        ),
    ];

    if (state.latestArtifacts?.note) {
        lines.push(
            buildArtifactSummaryLine('Note', state.latestArtifacts.note)
        );
    }

    lines.push('', '## Owners');

    if (state.owners.length === 0) {
        lines.push('- Sin owners registrados.');
    } else {
        state.owners.forEach((owner) => {
            lines.push(
                `- [${resolveOwnerState(owner)}] ${resolveOwnerLabel(
                    owner
                )} · ${resolveOwnerRole(owner)} · ${toString(
                    owner.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

export function buildTurneroSurfacePackageReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const checklist = asObject(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const latestArtifacts = resolveLatestArtifactMap(
        ledger,
        input.latestArtifacts
    );
    const packageTier = toString(snapshot.packageTier, 'pilot');
    const packageOwner = toString(snapshot.packageOwner, '');
    const bundleState = toString(
        snapshot.bundleState,
        latestArtifacts.bundle?.status || 'draft'
    );
    const provisioningState = toString(
        snapshot.provisioningState,
        latestArtifacts.provisioning?.status || 'draft'
    );
    const onboardingKitState = toString(
        snapshot.onboardingKitState,
        latestArtifacts.onboardingKit?.status || 'draft'
    );
    const gateBand = toString(gate.band, 'blocked');
    const gateScore = Number(gate.score || 0) || 0;
    const gateDecision = toString(
        gate.decision,
        'hold-package-standardization'
    );
    const surfaceLabel = resolveSurfaceLabel(snapshot);
    const activeOwners = owners.filter(
        (owner) => resolveOwnerState(owner) === 'active'
    );
    const readyArtifactCount = Number(gate.readyArtifactCount || 0) || 0;
    const requiredArtifactCount = Number(gate.requiredArtifactCount || 3) || 3;
    const checklistAll =
        Number(gate.checklistSummary?.all || checklist.summary?.all || 0) || 0;
    const checklistPass =
        Number(
            gate.checklistSummary?.pass || checklist.summary?.pass || 0
        ) || 0;
    const checklistFail =
        Number(
            gate.checklistSummary?.fail || checklist.summary?.fail || 0
        ) || 0;
    const resolvedLatestArtifacts = {
        bundle: latestArtifacts.bundle,
        provisioning: latestArtifacts.provisioning,
        onboardingKit: latestArtifacts.onboardingKit,
        note: latestArtifacts.note,
    };
    const artifacts = [
        resolvedLatestArtifacts.bundle,
        resolvedLatestArtifacts.provisioning,
        resolvedLatestArtifacts.onboardingKit,
        resolvedLatestArtifacts.note,
    ].filter(Boolean);

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel,
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'regional'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        packageTier,
        packageOwner,
        bundleState,
        provisioningState,
        onboardingKitState,
        gateBand,
        gateScore,
        gateDecision,
        checklistAll,
        checklistPass,
        checklistFail,
        requiredArtifactCount,
        readyArtifactCount,
        ownerCount: owners.length,
        activeOwnerCount: activeOwners.length,
        latestArtifacts: resolvedLatestArtifacts,
        artifacts,
        owners: owners.map((owner) => ({
            id: toString(owner.id, ''),
            surfaceKey: toString(owner.surfaceKey, ''),
            actor: resolveOwnerLabel(owner),
            role: resolveOwnerRole(owner),
            status: resolveOwnerState(owner),
            note: toString(owner.note, ''),
            updatedAt: toString(owner.updatedAt || owner.createdAt, ''),
        })),
        summary:
            gateBand === 'ready'
                ? 'Paquete estandarizado y listo.'
                : gateBand === 'watch'
                  ? 'Paquete estandarizado con seguimiento.'
                  : gateBand === 'degraded'
                    ? 'Paquete necesita estabilizacion.'
                    : 'Paquete en espera.',
        detail:
            gate.detail ||
            [
                `Checklist ${checklistPass}/${checklistAll}`,
                `Artefactos ${readyArtifactCount}/${requiredArtifactCount}`,
                `Owners activos ${activeOwners.length}`,
            ].join(' · '),
        title:
            gateBand === 'ready'
                ? 'Package standardization aligned'
                : 'Package standardization visible',
        checkpoints: [
            {
                label: 'tier',
                value: packageTier,
                state: packageTier ? 'ready' : 'warning',
            },
            {
                label: 'package',
                value: gateBand,
                state: mapGateBandToChipState(gateBand),
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
            packageTier,
            packageOwner,
            bundleState,
            provisioningState,
            onboardingKitState,
            gateBand,
            gateScore,
            gateDecision,
            checklistAll,
            checklistPass,
            readyArtifactCount,
            requiredArtifactCount,
            latestArtifacts: resolvedLatestArtifacts,
            owners,
        }),
        generatedAt: new Date().toISOString(),
    };
}

export {
    buildBriefLines as formatTurneroSurfacePackageBrief,
    mapGateBandToChipState as resolveTurneroSurfacePackageCheckpointState,
};
