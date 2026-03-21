function normalizeText(value, fallback = '') {
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

function normalizeChecklistSummary(checklist) {
    const summary =
        checklist && typeof checklist === 'object' ? checklist.summary : null;
    return {
        all: Math.max(0, toNumber(summary?.all)),
        pass: Math.max(0, toNumber(summary?.pass)),
        fail: Math.max(0, toNumber(summary?.fail)),
    };
}

function normalizeStatus(value) {
    return normalizeText(value, '').toLowerCase();
}

function scoreTemplateState(snapshot, templates) {
    if (templates.length > 0) {
        const readyTemplates = templates.filter((entry) =>
            ['ready', 'approved', 'published', 'active', 'done', 'closed'].includes(
                normalizeStatus(entry?.status)
            )
        ).length;
        return (readyTemplates / templates.length) * 100;
    }

    const templateState = normalizeStatus(snapshot?.templateState);
    if (['ready', 'approved', 'published', 'active'].includes(templateState)) {
        return 100;
    }
    if (['watch', 'review', 'pending'].includes(templateState)) {
        return 70;
    }
    if (['draft', 'planned', 'queued'].includes(templateState)) {
        return 50;
    }
    if (['degraded', 'blocked', 'hold'].includes(templateState)) {
        return 0;
    }
    return 50;
}

function scoreOwnerState(snapshot, owners) {
    if (owners.length > 0) {
        const activeOwners = owners.filter((entry) =>
            ['active', 'ready', 'standby'].includes(normalizeStatus(entry?.status))
        ).length;
        return (activeOwners / owners.length) * 100;
    }

    return normalizeText(snapshot?.replicationOwner) ? 100 : 0;
}

function countReadyTemplates(templates) {
    return templates.filter((entry) =>
        ['ready', 'approved', 'published', 'active', 'done', 'closed'].includes(
            normalizeStatus(entry?.status)
        )
    ).length;
}

function countActiveOwners(owners) {
    return owners.filter((entry) =>
        ['active', 'ready', 'standby'].includes(normalizeStatus(entry?.status))
    ).length;
}

export function buildTurneroSurfaceReplicationGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklistSummary(input.checklist);
    const templates = Array.isArray(input.templates)
        ? input.templates.filter(Boolean)
        : [];
    const owners = Array.isArray(input.owners) ? input.owners.filter(Boolean) : [];
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const templateScore = scoreTemplateState(snapshot, templates);
    const ownerScore = scoreOwnerState(snapshot, owners);
    const readyTemplateCount = countReadyTemplates(templates);
    const activeOwnerCount = countActiveOwners(owners);

    let score = checklistPct * 0.55 + templateScore * 0.25 + ownerScore * 0.2;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const band =
        checklist.fail >= 3 || score < 40
            ? 'blocked'
            : score >= 95
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'replication-ready'
                : band === 'watch'
                  ? 'review-scaleout'
                  : 'hold-scaleout',
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        templateCount: templates.length,
        readyTemplateCount,
        ownerCount: owners.length,
        activeOwnerCount,
        generatedAt: new Date().toISOString(),
    };
}
