#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const metrics = require('../../tools/agent-orchestrator/domain/metrics');

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('metrics-engine buildExecutorContribution pondera por riesgo y rankea ejecutores', () => {
    const contribution = metrics.buildExecutorContribution(
        [
            { executor: 'jules', status: 'done', risk: 'high' },
            { executor: 'jules', status: 'ready', risk: 'medium' },
            { executor: 'kimi', status: 'done', risk: 'low' },
            { executor: 'codex', status: 'backlog', risk: 'high' },
        ],
        { activeStatuses: ACTIVE_STATUSES }
    );

    assert.equal(contribution.totals.tasks, 4);
    assert.equal(contribution.totals.done_tasks, 2);
    assert.equal(contribution.totals.active_tasks, 1);
    assert.equal(contribution.top_executor.executor, 'jules');
    assert.equal(contribution.top_executor.weighted_done_points, 3);

    const jules = contribution.executors.find((r) => r.executor === 'jules');
    const kimi = contribution.executors.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct, 75);
    assert.equal(kimi.weighted_done_points_pct, 25);
});

test('metrics-engine normalizeContributionBaseline y buildContributionTrend generan delta estable', () => {
    const current = {
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 60,
                done_tasks_pct: 50,
            },
            {
                executor: 'kimi',
                weighted_done_points_pct: 40,
                done_tasks_pct: 50,
            },
        ],
    };
    const metricsSnapshot = {
        baseline_contribution: {
            executors: [
                {
                    executor: 'jules',
                    weighted_done_points_pct: 50,
                    done_tasks_pct: 40,
                },
                {
                    executor: 'kimi',
                    weighted_done_points_pct: 50,
                    done_tasks_pct: 60,
                },
            ],
        },
    };

    const baseline = metrics.normalizeContributionBaseline(metricsSnapshot);
    const trend = metrics.buildContributionTrend(current, baseline);
    assert.equal(trend.baseline_source, 'metrics');

    const jules = trend.rows.find((r) => r.executor === 'jules');
    const kimi = trend.rows.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct_delta, 10);
    assert.equal(jules.done_tasks_pct_delta, 10);
    assert.equal(kimi.weighted_done_points_pct_delta, -10);
    assert.equal(kimi.done_tasks_pct_delta, -10);
});

test('metrics-engine upsertContributionHistory y buildContributionHistorySummary resumen ventana', () => {
    const c1 = {
        top_executor: { executor: 'jules' },
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 55,
                done_tasks_pct: 60,
                active_tasks_pct: 20,
            },
        ],
    };
    const c2 = {
        top_executor: { executor: 'kimi' },
        executors: [
            {
                executor: 'jules',
                weighted_done_points_pct: 45,
                done_tasks_pct: 40,
                active_tasks_pct: 10,
            },
            {
                executor: 'kimi',
                weighted_done_points_pct: 55,
                done_tasks_pct: 60,
                active_tasks_pct: 30,
            },
        ],
    };

    let history = metrics.upsertContributionHistory(null, c1, {
        nowIso: '2026-02-24T10:00:00.000Z',
    });
    history = metrics.upsertContributionHistory(history, c2, {
        nowIso: '2026-02-25T10:00:00.000Z',
    });

    const summary = metrics.buildContributionHistorySummary(history, 7);
    assert.equal(summary.snapshots_total, 2);
    assert.deepEqual(summary.executors, ['jules', 'kimi']);
    assert.equal(summary.weekly_delta.available, true);
    assert.equal(summary.weekly_delta.from_date, '2026-02-24');
    assert.equal(summary.weekly_delta.to_date, '2026-02-25');

    const jules = summary.weekly_delta.rows.find((r) => r.executor === 'jules');
    const kimi = summary.weekly_delta.rows.find((r) => r.executor === 'kimi');
    assert.equal(jules.weighted_done_points_pct_delta, -10);
    assert.equal(kimi.weighted_done_points_pct_delta, 55);
});

test('metrics-engine contribution signal y pp delta mantienen semantica', () => {
    assert.equal(
        metrics.getContributionSignal({
            rank: 1,
            weighted_done_points_pct: 10,
            active_tasks: 0,
        }),
        'GREEN'
    );
    assert.equal(
        metrics.getContributionSignal({
            rank: 2,
            weighted_done_points_pct: 0,
            active_tasks: 1,
        }),
        'YELLOW'
    );
    assert.equal(
        metrics.getContributionSignal({
            rank: 3,
            weighted_done_points_pct: 0,
            active_tasks: 0,
        }),
        'RED'
    );
    assert.equal(metrics.formatPpDelta(3.2), '+3.2pp');
    assert.equal(metrics.formatPpDelta(-1), '-1pp');
    assert.equal(metrics.formatPpDelta('x'), 'n/a');
});

test('metrics-engine buildDomainHealth calcula semaforo y score por dominio', () => {
    const tasks = [
        {
            id: 'AG-001',
            scope: 'calendar',
            files: ['lib/calendar/CalendarBookingService.php'],
            status: 'in_progress',
        },
        {
            id: 'AG-002',
            scope: 'chat',
            files: ['tests/chat-flow-errors.spec.js'],
            status: 'done',
        },
        {
            id: 'AG-003',
            scope: 'payments',
            files: ['payments/stripe.php'],
            status: 'failed',
        },
    ];
    const conflicts = {
        all: [
            {
                left: tasks[0],
                right: tasks[1],
                exempted_by_handoff: true,
            },
            {
                left: tasks[0],
                right: tasks[2],
                exempted_by_handoff: false,
            },
        ],
    };
    const handoffs = [
        {
            id: 'HO-001',
            status: 'active',
            from_task: 'AG-001',
            to_task: 'AG-002',
            expires_at: '2026-02-24T00:00:00.000Z',
        },
    ];

    const report = metrics.buildDomainHealth(tasks, conflicts, handoffs, {
        getGovernancePolicy: () => ({
            domain_health: {
                priority_domains: ['calendar', 'chat', 'payments'],
                domain_weights: {
                    calendar: 5,
                    chat: 3,
                    payments: 2,
                    default: 1,
                },
                signal_scores: { GREEN: 100, YELLOW: 60, RED: 0 },
            },
        }),
        shallowMerge: (a, b) => ({ ...(a || {}), ...(b || {}) }),
        defaultPriorityDomains: ['calendar', 'chat', 'payments'],
        defaultDomainHealthWeights: {
            calendar: 5,
            chat: 3,
            payments: 2,
            default: 1,
        },
        defaultDomainSignalScores: { GREEN: 100, YELLOW: 60, RED: 0 },
        activeStatuses: ACTIVE_STATUSES,
        isExpired: () => true,
        normalizePathToken: (v) =>
            String(v || '')
                .replace(/\\/g, '/')
                .toLowerCase(),
        policyExists: true,
    });

    assert.equal(report.scoring.policy_source, 'governance-policy.json');
    assert.equal(report.domains.calendar.signal, 'RED');
    assert.equal(report.domains.chat.signal, 'YELLOW');
    assert.equal(report.domains.payments.signal, 'RED');
    assert.equal(report.totals.by_signal.RED >= 2, true);
    assert.equal(
        report.ranking
            .slice(0, 3)
            .map((r) => r.domain)
            .join(','),
        'calendar,chat,payments'
    );
});

test('metrics-engine domain health history summary detecta regresion GREEN->RED', () => {
    let history = metrics.upsertDomainHealthHistory(
        null,
        {
            ranking: [
                {
                    domain: 'calendar',
                    signal: 'GREEN',
                    tasks_total: 1,
                    active_tasks: 0,
                    done_tasks: 1,
                    blocking_conflicts: 0,
                    handoff_conflicts: 0,
                    active_expired_handoffs: 0,
                },
            ],
        },
        { nowIso: '2026-02-24T10:00:00.000Z' }
    );
    history = metrics.upsertDomainHealthHistory(
        history,
        {
            ranking: [
                {
                    domain: 'calendar',
                    signal: 'RED',
                    tasks_total: 1,
                    active_tasks: 1,
                    done_tasks: 0,
                    blocking_conflicts: 1,
                    handoff_conflicts: 0,
                    active_expired_handoffs: 0,
                },
            ],
        },
        { nowIso: '2026-02-25T10:00:00.000Z' }
    );

    const summary = metrics.buildDomainHealthHistorySummary(history, 7);
    assert.equal(summary.window_delta.available, true);
    assert.equal(summary.regressions.green_to_red.length, 1);
    assert.equal(summary.regressions.green_to_red[0].domain, 'calendar');
});
