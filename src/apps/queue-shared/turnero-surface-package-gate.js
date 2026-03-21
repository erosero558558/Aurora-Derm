function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChecklist(input = {}) {
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : input;
    const summary =
        checklist.summary && typeof checklist.summary === 'object'
            ? checklist.summary
            : {};

    return {
        summary: {
            all: Math.max(0, toNumber(summary.all || summary.total || 0)),
            pass: Math.max(0, toNumber(summary.pass || summary.ready || 0)),
            fail: Math.max(0, toNumber(summary.fail || summary.blocked || 0)),
        },
    };
}

function normalizeArtifactKind(value) {
    const normalized = toString(value, 'note')
        .toLowerCase()
        .replace(/[\s_]+/g, '-');

    if (
        ['bundle', 'provisioning', 'onboarding-kit', 'note'].includes(
            normalized
        )
    ) {
        return normalized;
    }

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

function resolveLatestArtifactMap(ledger = []) {
    const latest = {
        bundle: null,
        provisioning: null,
        onboardingKit: null,
        note: null,
    };

    asArray(ledger).forEach((entry) => {
        const kind = normalizeArtifactKind(entry?.kind);
        if (kind === 'bundle' && latest.bundle === null) {
            latest.bundle = { ...entry, kind };
        } else if (kind === 'provisioning' && latest.provisioning === null) {
            latest.provisioning = { ...entry, kind };
        } else if (
            kind === 'onboarding-kit' &&
            latest.onboardingKit === null
        ) {
            latest.onboardingKit = { ...entry, kind };
        } else if (kind === 'note' && latest.note === null) {
            latest.note = { ...entry, kind };
        }
    });

    return latest;
}

function isArtifactReady(entry) {
    return normalizeArtifactStatus(entry?.status) === 'ready';
}

function getArtifactSummary(entry, fallbackLabel) {
    if (!entry) {
        return null;
    }

    return {
        kind: normalizeArtifactKind(entry.kind),
        label: toString(
            entry.title || entry.label || fallbackLabel,
            fallbackLabel
        ),
        status: normalizeArtifactStatus(entry.status),
        owner: toString(entry.owner || entry.actor, ''),
        note: toString(entry.note || entry.detail, ''),
        updatedAt: toString(entry.updatedAt || entry.createdAt, ''),
        raw: { ...entry },
    };
}

function resolveSummaryText(band) {
    if (band === 'ready') {
        return 'Paquete estandarizado y listo.';
    }

    if (band === 'watch') {
        return 'Paquete estandarizado con seguimiento.';
    }

    if (band === 'degraded') {
        return 'Paquete necesita estabilizacion.';
    }

    return 'Paquete en espera.';
}

function resolveDecision(band) {
    switch (band) {
        case 'ready':
            return 'package-ready';
        case 'watch':
            return 'review-package-standardization';
        case 'degraded':
            return 'stabilize-package-standardization';
        default:
            return 'hold-package-standardization';
    }
}

function resolveOwnerCoverage(owners = []) {
    const activeOwners = asArray(owners).filter(
        (entry) => normalizeOwnerStatus(entry?.status) === 'active'
    );
    return {
        activeOwners,
        activeOwnerCount: activeOwners.length,
    };
}

export function buildTurneroSurfacePackageGate(input = {}) {
    const checklist = normalizeChecklist(input);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const latestArtifacts =
        input.latestArtifacts && typeof input.latestArtifacts === 'object'
            ? {
                  bundle: input.latestArtifacts.bundle || null,
                  provisioning: input.latestArtifacts.provisioning || null,
                  onboardingKit:
                      input.latestArtifacts.onboardingKit || null,
                  note: input.latestArtifacts.note || null,
              }
            : resolveLatestArtifactMap(ledger);
    const requiredArtifactKinds = ['bundle', 'provisioning', 'onboarding-kit'];
    const readyArtifactCount = requiredArtifactKinds.filter((kind) => {
        if (kind === 'bundle') {
            return isArtifactReady(latestArtifacts.bundle);
        }
        if (kind === 'provisioning') {
            return isArtifactReady(latestArtifacts.provisioning);
        }
        return isArtifactReady(latestArtifacts.onboardingKit);
    }).length;
    const missingArtifactKinds = requiredArtifactKinds.filter((kind) => {
        if (kind === 'bundle') {
            return !isArtifactReady(latestArtifacts.bundle);
        }
        if (kind === 'provisioning') {
            return !isArtifactReady(latestArtifacts.provisioning);
        }
        return !isArtifactReady(latestArtifacts.onboardingKit);
    });
    const checklistPct =
        checklist.summary.all > 0
            ? (checklist.summary.pass / checklist.summary.all) * 100
            : 0;
    const artifactPct =
        requiredArtifactKinds.length > 0
            ? (readyArtifactCount / requiredArtifactKinds.length) * 100
            : 0;
    const { activeOwners, activeOwnerCount } = resolveOwnerCoverage(owners);
    const ownerPct = activeOwnerCount > 0 ? 100 : 0;

    let score = checklistPct * 0.5 + artifactPct * 0.35 + ownerPct * 0.15;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const band =
        checklist.summary.fail >= 2 ||
        activeOwnerCount === 0 ||
        readyArtifactCount === 0
            ? 'blocked'
            : readyArtifactCount === requiredArtifactKinds.length &&
                checklist.summary.fail === 0 &&
                checklist.summary.all > 0 &&
                checklist.summary.pass >= checklist.summary.all &&
                score >= 90
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    const snapshot = asObject(input.snapshot);

    return {
        scope: toString(snapshot.scope || input.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey || input.surfaceKey, 'surface'),
        score,
        band,
        decision: resolveDecision(band),
        checklistSummary: {
            all: checklist.summary.all,
            pass: checklist.summary.pass,
            fail: checklist.summary.fail,
        },
        checklistCoverage: Number(checklistPct.toFixed(1)),
        artifactCoverage: Number(artifactPct.toFixed(1)),
        ownerCoverage: Number(ownerPct.toFixed(1)),
        requiredArtifactCount: requiredArtifactKinds.length,
        readyArtifactCount,
        activeOwnerCount,
        activeOwners,
        missingArtifactKinds,
        latestArtifacts,
        summary: resolveSummaryText(band),
        detail: [
            `Checklist ${checklist.summary.pass}/${checklist.summary.all}`,
            `Artefactos ${readyArtifactCount}/${requiredArtifactKinds.length}`,
            `Owners activos ${activeOwnerCount}`,
        ].join(' · '),
        generatedAt: new Date().toISOString(),
    };
}

export {
    resolveDecision as resolveTurneroSurfacePackageDecision,
    resolveSummaryText as resolveTurneroSurfacePackageSummary,
};
