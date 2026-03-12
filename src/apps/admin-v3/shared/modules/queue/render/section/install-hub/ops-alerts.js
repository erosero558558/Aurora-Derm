let opsAlertsState = null;
let opsFocusMode = null;

function createOpsAlertsState(date) {
    return {
        date,
        reviewed: {},
    };
}

function normalizeOpsAlertsState(rawState, today) {
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const reviewedSource =
        source.reviewed && typeof source.reviewed === 'object'
            ? source.reviewed
            : {};
    const reviewed = Object.entries(reviewedSource).reduce(
        (acc, [alertId, value]) => {
            if (!alertId) {
                return acc;
            }
            const reviewedAt = String(value?.reviewedAt || '').trim();
            acc[String(alertId)] = {
                reviewedAt: reviewedAt || new Date().toISOString(),
            };
            return acc;
        },
        {}
    );

    return {
        date: String(source.date || '').trim() === today ? today : today,
        reviewed,
    };
}

function loadOpsAlertsState(storageKey, getTodayLocalIsoDate) {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return createOpsAlertsState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsAlertsState(today);
        }
        return normalizeOpsAlertsState(parsed, today);
    } catch (_error) {
        return createOpsAlertsState(today);
    }
}

function persistOpsAlertsState(storageKey, getTodayLocalIsoDate, nextState) {
    opsAlertsState = normalizeOpsAlertsState(nextState, getTodayLocalIsoDate());
    try {
        localStorage.setItem(storageKey, JSON.stringify(opsAlertsState));
    } catch (_error) {
        // ignore storage write failures
    }
    return opsAlertsState;
}

export function ensureOpsAlertsState(storageKey, getTodayLocalIsoDate) {
    const today = getTodayLocalIsoDate();
    if (!opsAlertsState || opsAlertsState.date !== today) {
        opsAlertsState = loadOpsAlertsState(storageKey, getTodayLocalIsoDate);
    }
    return opsAlertsState;
}

export function setOpsAlertReviewed(
    storageKey,
    getTodayLocalIsoDate,
    alertId,
    reviewed
) {
    const current = ensureOpsAlertsState(storageKey, getTodayLocalIsoDate);
    const nextReviewed = {
        ...current.reviewed,
    };
    if (reviewed) {
        nextReviewed[String(alertId)] = {
            reviewedAt: new Date().toISOString(),
        };
    } else {
        delete nextReviewed[String(alertId)];
    }
    return persistOpsAlertsState(storageKey, getTodayLocalIsoDate, {
        ...current,
        reviewed: nextReviewed,
    });
}

export function markOpsAlertsReviewed(
    storageKey,
    getTodayLocalIsoDate,
    alertIds
) {
    const validIds = Array.isArray(alertIds)
        ? alertIds
              .map((alertId) => String(alertId || '').trim())
              .filter(Boolean)
        : [];
    if (!validIds.length) {
        return ensureOpsAlertsState(storageKey, getTodayLocalIsoDate);
    }

    const current = ensureOpsAlertsState(storageKey, getTodayLocalIsoDate);
    const nextReviewed = { ...current.reviewed };
    const reviewedAt = new Date().toISOString();
    validIds.forEach((alertId) => {
        nextReviewed[alertId] = { reviewedAt };
    });

    return persistOpsAlertsState(storageKey, getTodayLocalIsoDate, {
        ...current,
        reviewed: nextReviewed,
    });
}

function normalizeOpsFocusMode(rawValue) {
    const value = String(rawValue || 'auto')
        .trim()
        .toLowerCase();
    return value === 'opening' ||
        value === 'operations' ||
        value === 'incidents' ||
        value === 'closing'
        ? value
        : 'auto';
}

function loadOpsFocusMode(storageKey) {
    try {
        return normalizeOpsFocusMode(localStorage.getItem(storageKey));
    } catch (_error) {
        return 'auto';
    }
}

export function ensureOpsFocusMode(storageKey) {
    if (!opsFocusMode) {
        opsFocusMode = loadOpsFocusMode(storageKey);
    }
    return opsFocusMode;
}

export function persistOpsFocusMode(storageKey, nextMode) {
    opsFocusMode = normalizeOpsFocusMode(nextMode);
    try {
        localStorage.setItem(storageKey, opsFocusMode);
    } catch (_error) {
        // ignore storage write failures
    }
    return opsFocusMode;
}
