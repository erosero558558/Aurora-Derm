#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const statusEngine = require('../../tools/agent-orchestrator/domain/status');

test('status-engine buildStatusReport y renderStatusText conservan campos clave', () => {
    const data = statusEngine.buildStatusReport({
        board: {
            version: 1,
            policy: { updated_at: '2026-02-25' },
            tasks: [{ id: 'AG-001' }],
        },
        conflictAnalysis: {
            all: [{}],
            blocking: [{}],
            handoffCovered: [],
        },
        contribution: {
            top_executor: { executor: 'codex' },
            executors: [
                {
                    executor: 'codex',
                    weighted_done_points_pct: 100,
                    done_tasks_pct: 100,
                    active_tasks: 0,
                },
            ],
            ranking: [
                {
                    rank: 1,
                    executor: 'codex',
                    weighted_done_points_pct: 100,
                    done_tasks_pct: 100,
                },
            ],
        },
        contributionTrend: {
            baseline_source: 'metrics',
            rows: [
                {
                    executor: 'codex',
                    weighted_done_points_pct_delta: 10,
                },
            ],
        },
        domainHealth: {
            scoring: {
                priority_weighted_score_pct: 90,
                overall_weighted_score_pct: 85,
            },
            ranking: [
                {
                    domain: 'calendar',
                    signal: 'YELLOW',
                    tasks_total: 1,
                    active_tasks: 1,
                    blocking_conflicts: 0,
                    handoff_conflicts: 1,
                },
            ],
        },
        byStatus: { in_progress: 1 },
        byExecutor: { codex: 1 },
        redExplanation: {
            signal: 'NOT_RED',
            blockers: [],
            reasons: ['stable'],
            top_blocking_conflicts: [],
        },
    });

    assert.equal(data.conflicts, 1);
    assert.equal(data.conflicts_breakdown.blocking, 1);
    assert.equal(data.totals.byExecutor.codex, 1);

    const output = statusEngine.renderStatusText(data, {
        wantsExplainRed: true,
        getContributionSignal: () => 'GREEN',
        formatPpDelta: (v) => `+${v}pp`,
    });

    assert.match(output, /Agent Orchestrator Status/);
    assert.match(output, /Semaforo por dominio/);
    assert.match(output, /Aporte \(ranking por completado ponderado\)/);
    assert.match(output, /Explain RED \(status\)/);
    assert.match(output, /\[GREEN\] #1 codex/);
});
