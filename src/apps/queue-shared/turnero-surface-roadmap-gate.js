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
        all: Math.max(0, toNumber(summary.all || summary.total || 0)),
        pass: Math.max(0, toNumber(summary.pass || summary.ready || 0)),
        fail: Math.max(0, toNumber(summary.fail || summary.blocked || 0)),
    };
}

function normalizeLedgerStatus(value) {
    const normalized = toString(value, 'planned').toLowerCase();

    if (['ready', 'done', 'approved', 'planned'].includes(normalized)) {
        return normalized;
    }

    if (['closed', 'complete', 'completed'].includes(normalized)) {
        return 'done';
    }

    if (['aligned', 'accepted'].includes(normalized)) {
        return 'approved';
    }

    if (['plan', 'proposed'].includes(normalized)) {
        return 'planned';
    }

    if (['watch', 'review', 'pending', 'queued'].includes(normalized)) {
        return 'watch';
    }

    if (['degraded', 'warning', 'partial'].includes(normalized)) {
        return 'degraded';
    }

    if (['blocked', 'hold', 'failed'].includes(normalized)) {
        return 'blocked';
    }

    if (['draft', 'note'].includes(normalized)) {
        return 'draft';
    }

    return normalized || 'planned';
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

export function buildTurneroSurfaceRoadmapGate(input = {}) {
    const checklist = normalizeChecklist(input.checklist);
    const ledger = Array.isArray(input.ledger)
        ? input.ledger.filter(Boolean)
        : [];
    const owners = Array.isArray(input.owners)
        ? input.owners.filter(Boolean)
        : [];
    const readyLedgerCount = ledger.filter((entry) =>
        ['planned', 'ready', 'done', 'approved'].includes(
            normalizeLedgerStatus(entry?.status)
        )
    ).length;
    const activeOwnerCount = owners.filter(
        (entry) => normalizeOwnerStatus(entry?.status) === 'active'
    ).length;
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const ledgerPct =
        ledger.length > 0 ? (readyLedgerCount / ledger.length) * 100 : 0;
    const ownerPct =
        owners.length > 0 ? (activeOwnerCount / owners.length) * 100 : 0;

    let score = checklistPct * 0.55 + ledgerPct * 0.25 + ownerPct * 0.2;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const band =
        checklist.fail >= 2
            ? 'blocked'
            : score >= 90
              ? 'ready'
              : score >= 70
                ? 'watch'
                : 'degraded';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'roadmap-ready'
                : band === 'watch'
                  ? 'review-next-investment'
                  : 'stabilize-before-roadmap',
        checklistSummary: checklist,
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        checklistPct: Number(checklistPct.toFixed(1)),
        ledgerPct: Number(ledgerPct.toFixed(1)),
        ownerPct: Number(ownerPct.toFixed(1)),
        detail: [
            `Checklist ${checklist.pass}/${checklist.all}`,
            `Backlog listo ${readyLedgerCount}/${ledger.length}`,
            `Owners activos ${activeOwnerCount}/${owners.length}`,
        ].join(' · '),
        generatedAt: new Date().toISOString(),
    };
}
