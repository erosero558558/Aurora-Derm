'use strict';

const DEFAULT_BOARD_LEASES_POLICY = {
    enabled: true,
    required_statuses: ['in_progress', 'review'],
    tracked_statuses: ['in_progress', 'review', 'blocked'],
    ttl_hours_default: 4,
    ttl_hours_max: 24,
    heartbeat_stale_minutes: 30,
    auto_clear_on_terminal: true,
};

function normalizeStringList(values, fallback = []) {
    const source = Array.isArray(values) ? values : fallback;
    const out = [];
    const seen = new Set();
    for (const raw of source) {
        const value = String(raw || '')
            .trim()
            .toLowerCase();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function normalizeBoardLeasesPolicy(policy = null) {
    const cfg = policy?.enforcement?.board_leases;
    const merged =
        cfg && typeof cfg === 'object' && !Array.isArray(cfg)
            ? { ...DEFAULT_BOARD_LEASES_POLICY, ...cfg }
            : { ...DEFAULT_BOARD_LEASES_POLICY };
    merged.required_statuses = normalizeStringList(
        merged.required_statuses,
        DEFAULT_BOARD_LEASES_POLICY.required_statuses
    );
    merged.tracked_statuses = normalizeStringList(
        merged.tracked_statuses,
        DEFAULT_BOARD_LEASES_POLICY.tracked_statuses
    );
    merged.ttl_hours_default = Math.max(
        1,
        Number(merged.ttl_hours_default) ||
            DEFAULT_BOARD_LEASES_POLICY.ttl_hours_default
    );
    merged.ttl_hours_max = Math.max(
        merged.ttl_hours_default,
        Number(merged.ttl_hours_max) ||
            DEFAULT_BOARD_LEASES_POLICY.ttl_hours_max
    );
    merged.heartbeat_stale_minutes = Math.max(
        1,
        Number(merged.heartbeat_stale_minutes) ||
            DEFAULT_BOARD_LEASES_POLICY.heartbeat_stale_minutes
    );
    merged.enabled = merged.enabled !== false;
    merged.auto_clear_on_terminal = merged.auto_clear_on_terminal !== false;
    return merged;
}

function normalizeTaskStatus(statusRaw) {
    return String(statusRaw || '')
        .trim()
        .toLowerCase();
}

function isTrackedStatus(statusRaw, leasePolicy) {
    const status = normalizeTaskStatus(statusRaw);
    return normalizeBoardLeasesPolicy({
        enforcement: { board_leases: leasePolicy },
    }).tracked_statuses.includes(status);
}

function isRequiredLeaseStatus(statusRaw, leasePolicy) {
    const status = normalizeTaskStatus(statusRaw);
    return normalizeBoardLeasesPolicy({
        enforcement: { board_leases: leasePolicy },
    }).required_statuses.includes(status);
}

function parseDateMs(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : null;
}

function formatLeaseId(taskId, nowIso, random = Math.random) {
    const stamp = String(nowIso || new Date().toISOString()).replace(
        /[-:.TZ]/g,
        ''
    );
    const suffix = Math.floor(random() * 0xffffff)
        .toString(16)
        .padStart(6, '0');
    return `lease_${String(taskId || 'task').replace(/[^\w-]/g, '_')}_${stamp}_${suffix}`;
}

function applyStatusSince(task, prevTask, nowIso, currentDate) {
    const prevStatus = normalizeTaskStatus(prevTask?.status);
    const nextStatus = normalizeTaskStatus(task?.status);
    if (!task || !nextStatus)
        return { changed: false, value: task?.status_since_at || '' };
    const fallback = String(
        prevTask?.status_since_at ||
            task.status_since_at ||
            task.created_at ||
            task.updated_at ||
            nowIso ||
            currentDate ||
            ''
    ).trim();
    const statusChanged = !prevTask || prevStatus !== nextStatus;
    if (statusChanged) {
        task.status_since_at = String(nowIso || currentDate || fallback);
        return { changed: true, value: task.status_since_at };
    }
    if (!String(task.status_since_at || '').trim()) {
        task.status_since_at = fallback;
        return { changed: true, value: task.status_since_at };
    }
    return { changed: false, value: task.status_since_at };
}

function clearTaskLease(task, options = {}) {
    const { nowIso = new Date().toISOString(), reason = 'lease_clear' } =
        options;
    const hadLease = Boolean(String(task?.lease_id || '').trim());
    if (!task) return { action: 'none', lease: null };
    task.lease_cleared_at = String(nowIso);
    task.lease_cleared_reason = String(reason || 'lease_clear');
    task.lease_id = '';
    task.lease_owner = '';
    task.lease_created_at = '';
    task.heartbeat_at = '';
    task.lease_expires_at = '';
    task.lease_reason = '';
    return {
        action: hadLease ? 'cleared' : 'none',
        lease: getTaskLeaseSummary(task, { nowIso }),
    };
}

function renewTaskLease(task, options = {}) {
    const {
        nowIso = new Date().toISOString(),
        ttlHours,
        leasePolicy = DEFAULT_BOARD_LEASES_POLICY,
        leaseOwner = '',
        reason = 'lease_renew',
        random = Math.random,
    } = options;
    if (!task) return { action: 'none', lease: null };
    const policy = normalizeBoardLeasesPolicy({
        enforcement: { board_leases: leasePolicy },
    });
    const ttl = Math.min(
        policy.ttl_hours_max,
        Math.max(1, Number(ttlHours) || policy.ttl_hours_default)
    );
    const createdAt =
        String(task.lease_created_at || nowIso || '').trim() || String(nowIso);
    const existingId = String(task.lease_id || '').trim();
    task.lease_id = existingId || formatLeaseId(task.id, nowIso, random);
    task.lease_owner =
        String(leaseOwner || task.owner || '').trim() || 'unassigned';
    task.lease_created_at = createdAt;
    task.heartbeat_at = String(nowIso);
    task.lease_expires_at = new Date(
        Date.parse(String(nowIso)) + ttl * 60 * 60 * 1000
    ).toISOString();
    task.lease_reason = String(reason || 'lease_renew');
    task.lease_cleared_at = '';
    task.lease_cleared_reason = '';
    return {
        action: existingId ? 'renewed' : 'created',
        lease: getTaskLeaseSummary(task, { nowIso }),
    };
}

function getTaskLeaseSummary(task, options = {}) {
    const nowMs =
        parseDateMs(options.nowIso || new Date().toISOString()) ?? Date.now();
    const expiresMs = parseDateMs(task?.lease_expires_at);
    const heartbeatMs = parseDateMs(task?.heartbeat_at);
    return {
        has_lease: Boolean(String(task?.lease_id || '').trim()),
        lease_id: String(task?.lease_id || ''),
        lease_owner: String(task?.lease_owner || ''),
        lease_created_at: String(task?.lease_created_at || ''),
        heartbeat_at: String(task?.heartbeat_at || ''),
        lease_expires_at: String(task?.lease_expires_at || ''),
        lease_reason: String(task?.lease_reason || ''),
        lease_cleared_at: String(task?.lease_cleared_at || ''),
        lease_cleared_reason: String(task?.lease_cleared_reason || ''),
        expired: expiresMs !== null ? expiresMs < nowMs : false,
        heartbeat_age_minutes:
            heartbeatMs !== null
                ? Math.max(0, Math.round((nowMs - heartbeatMs) / 60000))
                : null,
    };
}

function applyTaskLeaseLifecycle(task, prevTask, options = {}) {
    const {
        policy = null,
        nowIso = new Date().toISOString(),
        currentDate = String(nowIso).slice(0, 10),
        forceRenew = false,
        leaseReason = 'board_write',
        leaseOwner = '',
        terminalStatuses = new Set(['done', 'failed']),
    } = options;
    if (!task || typeof task !== 'object') {
        return { lease_action: 'none', lease: null, status_since_at: null };
    }
    const leasePolicy = normalizeBoardLeasesPolicy(policy);
    const statusResult = applyStatusSince(task, prevTask, nowIso, currentDate);
    const status = normalizeTaskStatus(task.status);
    const prevStatus = normalizeTaskStatus(prevTask?.status);
    const statusChanged = !prevTask || status !== prevStatus;

    let leaseAction = 'none';
    if (!leasePolicy.enabled) {
        return {
            lease_action: leaseAction,
            lease: getTaskLeaseSummary(task, { nowIso }),
            status_since_at: statusResult.value || null,
            status_since_changed: statusResult.changed,
        };
    }

    if (terminalStatuses.has(status) && leasePolicy.auto_clear_on_terminal) {
        const hadLease = Boolean(String(task.lease_id || '').trim());
        const hasClearedMark = Boolean(
            String(task.lease_cleared_at || '').trim()
        );
        if (statusChanged || hadLease || !hasClearedMark) {
            const clearResult = clearTaskLease(task, {
                nowIso,
                reason: `terminal:${status}`,
            });
            leaseAction = clearResult.action;
        }
    } else if (leasePolicy.tracked_statuses.includes(status)) {
        const missingLease = !String(task.lease_id || '').trim();
        if (statusChanged || forceRenew || missingLease) {
            const renewResult = renewTaskLease(task, {
                nowIso,
                leasePolicy,
                leaseOwner: leaseOwner || task.owner || prevTask?.owner || '',
                reason: leaseReason,
            });
            leaseAction = renewResult.action;
        }
    }

    return {
        lease_action: leaseAction,
        lease: getTaskLeaseSummary(task, { nowIso }),
        status_since_at: String(task.status_since_at || ''),
        status_since_changed: statusResult.changed,
    };
}

function applyBoardLeasesBeforeWrite(nextBoard, options = {}) {
    const {
        prevBoard = null,
        policy = null,
        nowIso = new Date().toISOString(),
        currentDate = String(nowIso).slice(0, 10),
        terminalStatuses = new Set(['done', 'failed']),
    } = options;
    const previousTasks = new Map(
        Array.isArray(prevBoard?.tasks)
            ? prevBoard.tasks.map((task) => [String(task.id || ''), task])
            : []
    );
    const taskResults = [];
    for (const task of Array.isArray(nextBoard?.tasks) ? nextBoard.tasks : []) {
        const result = applyTaskLeaseLifecycle(
            task,
            previousTasks.get(String(task.id || '')),
            {
                policy,
                nowIso,
                currentDate,
                terminalStatuses,
                leaseReason: 'board_write',
            }
        );
        taskResults.push({
            task_id: String(task.id || ''),
            ...result,
        });
    }
    return {
        board: nextBoard,
        task_results: taskResults,
    };
}

function listBoardLeases(board, options = {}) {
    const {
        policy = null,
        nowIso = new Date().toISOString(),
        activeOnly = false,
        expiredOnly = false,
    } = options;
    const leasePolicy = normalizeBoardLeasesPolicy(policy);
    const rows = [];
    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        const status = normalizeTaskStatus(task.status);
        const lease = getTaskLeaseSummary(task, { nowIso });
        const required = leasePolicy.required_statuses.includes(status);
        const tracked = leasePolicy.tracked_statuses.includes(status);
        const row = {
            task_id: String(task.id || ''),
            status,
            owner: String(task.owner || ''),
            executor: String(task.executor || ''),
            required,
            tracked,
            ...lease,
        };
        if (activeOnly && !tracked) continue;
        if (expiredOnly && !row.expired) continue;
        rows.push(row);
    }
    rows.sort((a, b) => a.task_id.localeCompare(b.task_id));
    const summary = {
        total_tasks: Array.isArray(board?.tasks) ? board.tasks.length : 0,
        returned: rows.length,
        active_tracked: rows.filter((r) => r.tracked).length,
        active_required_missing: rows.filter((r) => r.required && !r.has_lease)
            .length,
        active_expired: rows.filter((r) => r.tracked && r.expired).length,
    };
    return { rows, summary, lease_policy: leasePolicy };
}

module.exports = {
    DEFAULT_BOARD_LEASES_POLICY,
    normalizeBoardLeasesPolicy,
    normalizeTaskStatus,
    isTrackedStatus,
    isRequiredLeaseStatus,
    parseDateMs,
    getTaskLeaseSummary,
    renewTaskLease,
    clearTaskLease,
    applyTaskLeaseLifecycle,
    applyBoardLeasesBeforeWrite,
    listBoardLeases,
};
