function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
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

    let all = Number(summary.all || summary.total || summary.count || 0);
    let pass = Number(summary.pass || summary.ready || summary.ok || 0);
    let fail = Number(summary.fail || summary.blocked || summary.failed || 0);

    all = Number.isFinite(all) ? Math.max(0, Math.round(all)) : 0;
    pass = Number.isFinite(pass) ? Math.max(0, Math.round(pass)) : 0;
    fail = Number.isFinite(fail) ? Math.max(0, Math.round(fail)) : 0;

    if (all <= 0) {
        all = pass + fail;
    }

    if (pass > all) {
        pass = all;
    }

    if (fail > all) {
        fail = all;
    }

    if (pass + fail > all) {
        fail = Math.max(0, all - pass);
    }

    return {
        summary: {
            all,
            pass,
            fail,
        },
    };
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

function resolveDecision(band) {
    switch (band) {
        case 'ready':
            return 'approve-executive-review';
        case 'watch':
            return 'review-executive-feedback';
        case 'degraded':
            return 'stabilize-executive-review';
        default:
            return 'hold-executive-review';
    }
}

function resolveSummary(band) {
    switch (band) {
        case 'ready':
            return 'Revisión ejecutiva alineada y lista.';
        case 'watch':
            return 'Revisión ejecutiva visible con seguimiento.';
        case 'degraded':
            return 'Revisión ejecutiva necesita estabilización.';
        default:
            return 'Revisión ejecutiva en espera.';
    }
}

function resolveScoring(checklist, reviewItemCount, activeOwnerCount) {
    const checklistPct =
        checklist.summary.all > 0
            ? (checklist.summary.pass / checklist.summary.all) * 100
            : 0;
    const reviewPct =
        reviewItemCount > 0
            ? clamp((Math.min(reviewItemCount, 3) / 3) * 100, 0, 100)
            : 0;
    const ownerPct = activeOwnerCount > 0 ? 100 : 0;

    const score = checklistPct * 0.55 + reviewPct * 0.25 + ownerPct * 0.2;
    return clamp(Number(score.toFixed(1)), 0, 100);
}

function resolveBand(checklist, reviewItemCount, activeOwnerCount, score) {
    if (
        checklist.summary.fail >= 2 ||
        reviewItemCount <= 0 ||
        activeOwnerCount <= 0
    ) {
        return 'blocked';
    }

    if (
        checklist.summary.fail === 0 &&
        checklist.summary.all > 0 &&
        checklist.summary.pass >= checklist.summary.all &&
        reviewItemCount >= 3 &&
        score >= 90
    ) {
        return 'ready';
    }

    if (score >= 70) {
        return 'watch';
    }

    if (score >= 50) {
        return 'degraded';
    }

    return 'blocked';
}

export function buildTurneroSurfaceExecutiveReviewGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklist(input);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const activeOwners = owners.filter(
        (owner) => normalizeOwnerStatus(owner?.status) === 'active'
    );
    const activeOwnerCount = activeOwners.length;
    const reviewItemCount = ledger.length;
    const score = resolveScoring(checklist, reviewItemCount, activeOwnerCount);
    const band = resolveBand(
        checklist,
        reviewItemCount,
        activeOwnerCount,
        score
    );

    return {
        scope: toString(snapshot.scope || input.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey || input.surfaceKey, 'surface'),
        score,
        band,
        decision: resolveDecision(band),
        summary: resolveSummary(band),
        detail:
            input.detail ||
            [
                `Checklist ${checklist.summary.pass}/${checklist.summary.all}`,
                `Items ${reviewItemCount}`,
                `Owners activos ${activeOwnerCount}`,
            ].join(' · '),
        checklistSummary: {
            all: checklist.summary.all,
            pass: checklist.summary.pass,
            fail: checklist.summary.fail,
        },
        reviewItemCount,
        activeOwnerCount,
        activeOwners: activeOwners.map((owner) => ({
            id: toString(owner.id, ''),
            surfaceKey: toString(owner.surfaceKey, ''),
            actor: toString(owner.actor || owner.owner || owner.name, 'owner'),
            role: toString(owner.role, 'executive-review'),
            status: normalizeOwnerStatus(owner.status),
            note: toString(owner.note, ''),
            updatedAt: toString(owner.updatedAt || owner.createdAt, ''),
        })),
        generatedAt: new Date().toISOString(),
    };
}

export {
    resolveDecision as resolveTurneroSurfaceExecutiveReviewDecision,
    resolveSummary as resolveTurneroSurfaceExecutiveReviewSummary,
};

export default buildTurneroSurfaceExecutiveReviewGate;
