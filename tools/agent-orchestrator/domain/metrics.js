'use strict';

function percent(part, total) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((Number(part || 0) / total) * 1000) / 10;
}

function riskWeight(task) {
    const risk = String(task?.risk || '').toLowerCase();
    if (risk === 'high') return 3;
    if (risk === 'medium') return 2;
    return 1;
}

function buildExecutorContribution(tasks, options = {}) {
    const activeStatuses =
        options.activeStatuses instanceof Set
            ? options.activeStatuses
            : new Set(options.activeStatuses || []);
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const totals = {
        tasks: safeTasks.length,
        done_tasks: 0,
        active_tasks: 0,
        weighted_points_total: 0,
        weighted_done_points_total: 0,
        weighted_active_points_total: 0,
    };

    const map = new Map();
    for (const task of safeTasks) {
        const executor = String(task.executor || 'unknown');
        const status = String(task.status || '');
        const weight = riskWeight(task);
        const isDone = status === 'done';
        const isActive = activeStatuses.has(status);

        totals.weighted_points_total += weight;
        if (isDone) totals.done_tasks += 1;
        if (isActive) totals.active_tasks += 1;
        if (isDone) totals.weighted_done_points_total += weight;
        if (isActive) totals.weighted_active_points_total += weight;

        if (!map.has(executor)) {
            map.set(executor, {
                executor,
                tasks: 0,
                done_tasks: 0,
                active_tasks: 0,
                weighted_points: 0,
                weighted_done_points: 0,
                weighted_active_points: 0,
            });
        }

        const row = map.get(executor);
        row.tasks += 1;
        row.weighted_points += weight;
        if (isDone) {
            row.done_tasks += 1;
            row.weighted_done_points += weight;
        }
        if (isActive) {
            row.active_tasks += 1;
            row.weighted_active_points += weight;
        }
    }

    const executors = Array.from(map.values())
        .map((row) => ({
            ...row,
            tasks_pct: percent(row.tasks, totals.tasks),
            done_tasks_pct: percent(row.done_tasks, totals.done_tasks),
            active_tasks_pct: percent(row.active_tasks, totals.active_tasks),
            weighted_points_pct: percent(
                row.weighted_points,
                totals.weighted_points_total
            ),
            weighted_done_points_pct: percent(
                row.weighted_done_points,
                totals.weighted_done_points_total
            ),
            weighted_active_points_pct: percent(
                row.weighted_active_points,
                totals.weighted_active_points_total
            ),
        }))
        .sort((a, b) => {
            return (
                b.weighted_done_points - a.weighted_done_points ||
                b.done_tasks - a.done_tasks ||
                b.weighted_active_points - a.weighted_active_points ||
                b.tasks - a.tasks ||
                String(a.executor).localeCompare(String(b.executor))
            );
        });

    const ranking = executors.map((row, idx) => ({
        rank: idx + 1,
        executor: row.executor,
        weighted_done_points: row.weighted_done_points,
        weighted_done_points_pct: row.weighted_done_points_pct,
        done_tasks: row.done_tasks,
        done_tasks_pct: row.done_tasks_pct,
    }));

    return {
        scoring: {
            primary_metric: 'weighted_done_points_pct',
            risk_weights: { low: 1, medium: 2, high: 3 },
        },
        totals,
        executors,
        ranking,
        top_executor: ranking[0] || null,
    };
}

function sanitizeContributionSnapshotExecutors(contribution) {
    const rows = Array.isArray(contribution?.executors)
        ? contribution.executors
        : [];
    return rows
        .map((row) => ({
            executor: String(row.executor || ''),
            weighted_done_points_pct: Number(row.weighted_done_points_pct || 0),
            done_tasks_pct: Number(row.done_tasks_pct || 0),
            active_tasks_pct: Number(row.active_tasks_pct || 0),
            weighted_active_points_pct: Number(
                row.weighted_active_points_pct || 0
            ),
        }))
        .sort((a, b) => String(a.executor).localeCompare(String(b.executor)));
}

function upsertContributionHistory(history, contribution, options = {}) {
    const base = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(base.snapshots)
        ? base.snapshots.slice()
        : [];
    const nowIso =
        typeof options.nowIso === 'string' && options.nowIso
            ? options.nowIso
            : new Date().toISOString();
    const date = nowIso.slice(0, 10);
    const snapshot = {
        date,
        captured_at: nowIso,
        top_executor: contribution?.top_executor
            ? String(contribution.top_executor.executor || '')
            : null,
        executors: sanitizeContributionSnapshotExecutors(contribution),
    };

    const next = snapshots.filter((item) => String(item.date || '') !== date);
    next.push(snapshot);
    next.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
    );

    return {
        version: 1,
        updated_at: nowIso,
        snapshots: next.slice(-365),
    };
}

function buildContributionHistorySummary(history, days = 7) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const ordered = snapshots
        .filter((item) => item && typeof item === 'object' && item.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const windowDays = Math.max(1, Number(days) || 7);
    const recent = ordered.slice(-windowDays);

    const executorSet = new Set();
    for (const item of recent) {
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            executorSet.add(String(row.executor || ''));
        }
    }
    const executors = Array.from(executorSet).filter(Boolean).sort();

    const daily = recent.map((item) => {
        const byExecutor = {};
        for (const row of Array.isArray(item.executors) ? item.executors : []) {
            byExecutor[String(row.executor || '')] = {
                weighted_done_points_pct: Number(
                    row.weighted_done_points_pct || 0
                ),
                done_tasks_pct: Number(row.done_tasks_pct || 0),
                active_tasks_pct: Number(row.active_tasks_pct || 0),
            };
        }
        return {
            date: String(item.date),
            captured_at: String(item.captured_at || ''),
            top_executor: item.top_executor ? String(item.top_executor) : null,
            executors: byExecutor,
        };
    });

    let weeklyDelta = { available: false, rows: [] };
    if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];
        const union = Array.from(
            new Set([
                ...Object.keys(first.executors),
                ...Object.keys(last.executors),
            ])
        ).sort();
        weeklyDelta = {
            available: true,
            from_date: first.date,
            to_date: last.date,
            rows: union.map((executor) => {
                const firstVal = Number(
                    first.executors[executor]?.weighted_done_points_pct || 0
                );
                const lastVal = Number(
                    last.executors[executor]?.weighted_done_points_pct || 0
                );
                return {
                    executor,
                    weighted_done_points_pct_from: firstVal,
                    weighted_done_points_pct_to: lastVal,
                    weighted_done_points_pct_delta:
                        Math.round((lastVal - firstVal) * 10) / 10,
                };
            }),
        };
    }

    return {
        version: 1,
        source_file: 'verification/agent-contribution-history.json',
        window_days: windowDays,
        snapshots_total: ordered.length,
        daily,
        executors,
        weekly_delta: weeklyDelta,
    };
}

function normalizeContributionBaseline(metricsSnapshot) {
    if (!metricsSnapshot || typeof metricsSnapshot !== 'object') return null;
    if (
        metricsSnapshot.baseline_contribution &&
        Array.isArray(metricsSnapshot.baseline_contribution.executors)
    ) {
        return metricsSnapshot.baseline_contribution;
    }
    if (
        metricsSnapshot.contribution &&
        Array.isArray(metricsSnapshot.contribution.executors)
    ) {
        return metricsSnapshot.contribution;
    }
    return null;
}

function buildContributionTrend(currentContribution, baselineContribution) {
    if (
        !currentContribution ||
        !Array.isArray(currentContribution.executors) ||
        !baselineContribution ||
        !Array.isArray(baselineContribution.executors)
    ) {
        return null;
    }

    const baselineByExecutor = new Map(
        baselineContribution.executors.map((row) => [
            String(row.executor || ''),
            row,
        ])
    );

    const rows = currentContribution.executors.map((row) => {
        const baseline =
            baselineByExecutor.get(String(row.executor || '')) || {};
        const weightedDonePctCurrent = Number(
            row.weighted_done_points_pct || 0
        );
        const weightedDonePctBaseline = Number(
            baseline.weighted_done_points_pct || 0
        );
        const donePctCurrent = Number(row.done_tasks_pct || 0);
        const donePctBaseline = Number(baseline.done_tasks_pct || 0);

        return {
            executor: String(row.executor || ''),
            weighted_done_points_pct_current: weightedDonePctCurrent,
            weighted_done_points_pct_baseline: weightedDonePctBaseline,
            weighted_done_points_pct_delta:
                Math.round(
                    (weightedDonePctCurrent - weightedDonePctBaseline) * 10
                ) / 10,
            done_tasks_pct_current: donePctCurrent,
            done_tasks_pct_baseline: donePctBaseline,
            done_tasks_pct_delta:
                Math.round((donePctCurrent - donePctBaseline) * 10) / 10,
        };
    });

    return {
        baseline_source: 'metrics',
        rows,
    };
}

function getContributionSignal(row) {
    const weightedDone = Number(row?.weighted_done_points_pct || 0);
    const active = Number(row?.active_tasks || 0);
    const rank = Number(row?.rank || 999);

    if (rank === 1 && weightedDone > 0) return 'GREEN';
    if (weightedDone > 0 || active > 0) return 'YELLOW';
    return 'RED';
}

function formatPpDelta(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'n/a';
    if (n > 0) return `+${n}pp`;
    return `${n}pp`;
}

function inferTaskDomain(task, options = {}) {
    const normalizePathToken =
        typeof options.normalizePathToken === 'function'
            ? options.normalizePathToken
            : (value) =>
                  String(value || '')
                      .replace(/\\/g, '/')
                      .toLowerCase()
                      .trim();
    const scope = normalizePathToken(task?.scope || '');
    const files = Array.isArray(task?.files)
        ? task.files.map((item) => normalizePathToken(item))
        : [];
    const corpus = [scope, ...files].join(' ');

    if (
        corpus.includes('calendar') ||
        corpus.includes('availability') ||
        corpus.includes('booked-slots')
    ) {
        return 'calendar';
    }
    if (
        corpus.includes('chat') ||
        corpus.includes('figo') ||
        corpus.includes('telegram')
    ) {
        return 'chat';
    }
    if (
        corpus.includes('payment') ||
        corpus.includes('payments') ||
        corpus.includes('stripe')
    ) {
        return 'payments';
    }

    if (scope) {
        const first = scope.split(/[/:]/)[0].trim();
        if (first) return first;
    }
    return 'other';
}

function buildDomainHealth(
    tasks,
    conflictAnalysis,
    handoffs = [],
    options = {}
) {
    const {
        getGovernancePolicy = () => ({}),
        shallowMerge = (a, b) => ({ ...(a || {}), ...(b || {}) }),
        defaultPriorityDomains = ['calendar', 'chat', 'payments'],
        defaultDomainHealthWeights = {
            calendar: 5,
            chat: 3,
            payments: 2,
            default: 1,
        },
        defaultDomainSignalScores = { GREEN: 100, YELLOW: 60, RED: 0 },
        activeStatuses = new Set(),
        isExpired = () => false,
        policyExists = false,
    } = options;
    const inferDomain = (task) =>
        inferTaskDomain(task, {
            normalizePathToken: options.normalizePathToken,
        });

    const governancePolicy = getGovernancePolicy() || {};
    const domainHealthPolicy = governancePolicy?.domain_health || {};
    const priorityDomains = Array.isArray(domainHealthPolicy.priority_domains)
        ? domainHealthPolicy.priority_domains.map((d) => String(d))
        : defaultPriorityDomains.slice();
    const domainWeights = shallowMerge(
        defaultDomainHealthWeights,
        domainHealthPolicy.domain_weights || {}
    );
    const signalScores = shallowMerge(
        defaultDomainSignalScores,
        domainHealthPolicy.signal_scores || {}
    );
    const domainMap = new Map();
    const taskById = new Map();

    function ensureDomain(domain) {
        const key = String(domain || 'other').trim() || 'other';
        if (!domainMap.has(key)) {
            domainMap.set(key, {
                domain: key,
                tasks_total: 0,
                active_tasks: 0,
                done_tasks: 0,
                blocked_tasks: 0,
                failed_tasks: 0,
                ready_tasks: 0,
                review_tasks: 0,
                in_progress_tasks: 0,
                blocking_conflicts: 0,
                handoff_conflicts: 0,
                active_expired_handoffs: 0,
                reasons: [],
                signal: 'GREEN',
            });
        }
        return domainMap.get(key);
    }

    for (const domain of priorityDomains) ensureDomain(domain);

    for (const task of tasks || []) {
        const domain = inferDomain(task);
        const row = ensureDomain(domain);
        const status = String(task.status || '');
        row.tasks_total += 1;
        if (activeStatuses.has(status)) row.active_tasks += 1;
        if (status === 'done') row.done_tasks += 1;
        if (status === 'blocked') row.blocked_tasks += 1;
        if (status === 'failed') row.failed_tasks += 1;
        if (status === 'ready') row.ready_tasks += 1;
        if (status === 'review') row.review_tasks += 1;
        if (status === 'in_progress') row.in_progress_tasks += 1;
        taskById.set(String(task.id || ''), { task, domain });
    }

    for (const conflict of conflictAnalysis?.all || []) {
        const leftDomain = inferDomain(conflict.left);
        const rightDomain = inferDomain(conflict.right);
        const domains = new Set([leftDomain, rightDomain]);
        for (const domain of domains) {
            const row = ensureDomain(domain);
            if (conflict.exempted_by_handoff) row.handoff_conflicts += 1;
            else row.blocking_conflicts += 1;
        }
    }

    for (const handoff of handoffs || []) {
        if (String(handoff.status || '').toLowerCase() !== 'active') continue;
        if (!isExpired(handoff.expires_at)) continue;
        const from = taskById.get(String(handoff.from_task || ''));
        const to = taskById.get(String(handoff.to_task || ''));
        const domains = new Set([
            from?.domain || 'other',
            to?.domain || 'other',
        ]);
        for (const domain of domains) {
            ensureDomain(domain).active_expired_handoffs += 1;
        }
    }

    const rows = Array.from(domainMap.values()).map((row) => {
        const reasons = [];
        let signal = 'GREEN';

        if (row.blocking_conflicts > 0) {
            signal = 'RED';
            reasons.push(`blocking_conflicts:${row.blocking_conflicts}`);
        }
        if (row.failed_tasks > 0) {
            signal = 'RED';
            reasons.push(`failed_tasks:${row.failed_tasks}`);
        }
        if (row.blocked_tasks > 0 && signal !== 'RED') {
            signal = 'YELLOW';
            reasons.push(`blocked_tasks:${row.blocked_tasks}`);
        } else if (row.blocked_tasks > 0) {
            reasons.push(`blocked_tasks:${row.blocked_tasks}`);
        }
        if (row.active_expired_handoffs > 0 && signal !== 'RED') {
            signal = 'YELLOW';
            reasons.push(
                `active_expired_handoffs:${row.active_expired_handoffs}`
            );
        } else if (row.active_expired_handoffs > 0) {
            reasons.push(
                `active_expired_handoffs:${row.active_expired_handoffs}`
            );
        }
        if (row.handoff_conflicts > 0 && signal === 'GREEN') {
            signal = 'YELLOW';
            reasons.push(`handoff_conflicts:${row.handoff_conflicts}`);
        } else if (row.handoff_conflicts > 0) {
            reasons.push(`handoff_conflicts:${row.handoff_conflicts}`);
        }
        if (signal === 'GREEN' && row.active_tasks > 0 && row.tasks_total > 0) {
            signal = 'YELLOW';
            reasons.push(`active_tasks:${row.active_tasks}`);
        }
        if (row.tasks_total === 0) reasons.push('no_tasks');
        if (reasons.length === 0) reasons.push('stable');

        return {
            ...row,
            weight: domainWeights[row.domain] ?? domainWeights.default,
            signal_score_pct: 0,
            weighted_score_points: 0,
            signal,
            reasons,
        };
    });

    for (const row of rows) {
        row.signal_score_pct = signalScores[row.signal] ?? signalScores.GREEN;
        row.weighted_score_points = Math.round(
            row.signal_score_pct * row.weight
        );
    }

    const priorityIndex = new Map(priorityDomains.map((d, i) => [d, i]));
    rows.sort((a, b) => {
        const aPri = priorityIndex.has(a.domain)
            ? priorityIndex.get(a.domain)
            : 999;
        const bPri = priorityIndex.has(b.domain)
            ? priorityIndex.get(b.domain)
            : 999;
        return (
            aPri - bPri ||
            b.tasks_total - a.tasks_total ||
            String(a.domain).localeCompare(String(b.domain))
        );
    });

    const bySignal = rows.reduce(
        (acc, row) => {
            acc[row.signal] = (acc[row.signal] || 0) + 1;
            return acc;
        },
        { GREEN: 0, YELLOW: 0, RED: 0 }
    );

    const totalWeight = rows.reduce(
        (acc, row) => acc + Number(row.weight || 0),
        0
    );
    const totalWeightedPoints = rows.reduce(
        (acc, row) => acc + Number(row.weighted_score_points || 0),
        0
    );
    const priorityRows = rows.filter((row) =>
        priorityDomains.includes(row.domain)
    );
    const priorityWeight = priorityRows.reduce(
        (acc, row) => acc + Number(row.weight || 0),
        0
    );
    const priorityWeightedPoints = priorityRows.reduce(
        (acc, row) => acc + Number(row.weighted_score_points || 0),
        0
    );
    const overallWeightedScorePct =
        totalWeight > 0
            ? Math.round((totalWeightedPoints / totalWeight) * 10) / 10
            : 100;
    const priorityWeightedScorePct =
        priorityWeight > 0
            ? Math.round((priorityWeightedPoints / priorityWeight) * 10) / 10
            : 100;

    return {
        version: 1,
        priority_domains: priorityDomains.slice(),
        scoring: {
            signal_scores: { ...signalScores },
            domain_weights: { ...domainWeights },
            total_weight: totalWeight,
            total_weighted_points: totalWeightedPoints,
            overall_weighted_score_pct: overallWeightedScorePct,
            priority_weight: priorityWeight,
            priority_weighted_points: priorityWeightedPoints,
            priority_weighted_score_pct: priorityWeightedScorePct,
            primary_metric: 'priority_weighted_score_pct',
            policy_source: policyExists ? 'governance-policy.json' : 'defaults',
        },
        totals: {
            domains: rows.length,
            by_signal: bySignal,
        },
        domains: Object.fromEntries(rows.map((row) => [row.domain, row])),
        ranking: rows,
    };
}

function sanitizeDomainHealthSnapshot(domainHealth) {
    const rows = Array.isArray(domainHealth?.ranking)
        ? domainHealth.ranking
        : [];
    return rows
        .map((row) => ({
            domain: String(row.domain || ''),
            signal: String(row.signal || 'GREEN'),
            tasks_total: Number(row.tasks_total || 0),
            active_tasks: Number(row.active_tasks || 0),
            done_tasks: Number(row.done_tasks || 0),
            blocking_conflicts: Number(row.blocking_conflicts || 0),
            handoff_conflicts: Number(row.handoff_conflicts || 0),
            active_expired_handoffs: Number(row.active_expired_handoffs || 0),
        }))
        .sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
}

function upsertDomainHealthHistory(history, domainHealth, options = {}) {
    const base = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(base.snapshots)
        ? base.snapshots.slice()
        : [];
    const nowIso =
        typeof options.nowIso === 'string' && options.nowIso
            ? options.nowIso
            : new Date().toISOString();
    const date = nowIso.slice(0, 10);
    const snapshotRows = sanitizeDomainHealthSnapshot(domainHealth);
    const countsBySignal = snapshotRows.reduce(
        (acc, row) => {
            acc[row.signal] = (acc[row.signal] || 0) + 1;
            return acc;
        },
        { GREEN: 0, YELLOW: 0, RED: 0 }
    );
    const snapshot = {
        date,
        captured_at: nowIso,
        counts_by_signal: countsBySignal,
        domains: snapshotRows,
    };
    const next = snapshots.filter((item) => String(item.date || '') !== date);
    next.push(snapshot);
    next.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
    );
    return {
        version: 1,
        updated_at: nowIso,
        snapshots: next.slice(-365),
    };
}

function buildDomainHealthHistorySummary(history, days = 7) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const ordered = snapshots
        .filter((item) => item && typeof item === 'object' && item.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const windowDays = Math.max(1, Number(days) || 7);
    const recent = ordered.slice(-windowDays);

    const domainSet = new Set();
    for (const item of recent) {
        for (const row of Array.isArray(item.domains) ? item.domains : []) {
            domainSet.add(String(row.domain || ''));
        }
    }
    const domains = Array.from(domainSet).filter(Boolean).sort();

    const daily = recent.map((item) => {
        const byDomain = {};
        for (const row of Array.isArray(item.domains) ? item.domains : []) {
            byDomain[String(row.domain || '')] = {
                signal: String(row.signal || 'GREEN'),
                tasks_total: Number(row.tasks_total || 0),
                active_tasks: Number(row.active_tasks || 0),
                done_tasks: Number(row.done_tasks || 0),
                blocking_conflicts: Number(row.blocking_conflicts || 0),
                handoff_conflicts: Number(row.handoff_conflicts || 0),
                active_expired_handoffs: Number(
                    row.active_expired_handoffs || 0
                ),
            };
        }
        return {
            date: String(item.date),
            captured_at: String(item.captured_at || ''),
            counts_by_signal: item.counts_by_signal || {
                GREEN: 0,
                YELLOW: 0,
                RED: 0,
            },
            domains: byDomain,
        };
    });

    let windowDelta = { available: false, rows: [] };
    let regressions = { green_to_red: [], worsened_signal: [] };
    if (daily.length >= 2) {
        const first = daily[0];
        const last = daily[daily.length - 1];
        const union = Array.from(
            new Set([
                ...Object.keys(first.domains),
                ...Object.keys(last.domains),
            ])
        ).sort();
        windowDelta = {
            available: true,
            from_date: first.date,
            to_date: last.date,
            rows: union.map((domain) => {
                const firstBlocking = Number(
                    first.domains[domain]?.blocking_conflicts || 0
                );
                const lastBlocking = Number(
                    last.domains[domain]?.blocking_conflicts || 0
                );
                const firstSignal = String(
                    first.domains[domain]?.signal || 'GREEN'
                );
                const lastSignal = String(
                    last.domains[domain]?.signal || 'GREEN'
                );
                return {
                    domain,
                    signal_from: firstSignal,
                    signal_to: lastSignal,
                    blocking_conflicts_from: firstBlocking,
                    blocking_conflicts_to: lastBlocking,
                    blocking_conflicts_delta: lastBlocking - firstBlocking,
                };
            }),
        };

        const severity = { GREEN: 0, YELLOW: 1, RED: 2 };
        regressions = {
            green_to_red: windowDelta.rows
                .filter(
                    (row) =>
                        row.signal_from === 'GREEN' && row.signal_to === 'RED'
                )
                .map((row) => ({
                    domain: row.domain,
                    from_date: first.date,
                    to_date: last.date,
                    signal_from: row.signal_from,
                    signal_to: row.signal_to,
                    blocking_conflicts_delta: row.blocking_conflicts_delta,
                })),
            worsened_signal: windowDelta.rows
                .filter((row) => {
                    const from = severity[row.signal_from] ?? 0;
                    const to = severity[row.signal_to] ?? 0;
                    return to > from;
                })
                .map((row) => ({
                    domain: row.domain,
                    from_date: first.date,
                    to_date: last.date,
                    signal_from: row.signal_from,
                    signal_to: row.signal_to,
                })),
        };
    }

    return {
        version: 1,
        source_file: 'verification/agent-domain-health-history.json',
        window_days: windowDays,
        snapshots_total: ordered.length,
        domains,
        daily,
        window_delta: windowDelta,
        regressions,
    };
}

module.exports = {
    percent,
    riskWeight,
    buildExecutorContribution,
    sanitizeContributionSnapshotExecutors,
    upsertContributionHistory,
    buildContributionHistorySummary,
    normalizeContributionBaseline,
    buildContributionTrend,
    getContributionSignal,
    formatPpDelta,
    inferTaskDomain,
    buildDomainHealth,
    sanitizeDomainHealthSnapshot,
    upsertDomainHealthHistory,
    buildDomainHealthHistorySummary,
};
