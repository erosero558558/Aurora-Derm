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
        evidenceSummary: {
            terminal_tasks: 2,
            aligned_count: 1,
            missing_expected_count: 1,
            debt_count: 1,
            sample_task_ids: ['AG-152'],
        },
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo',
            },
            aligned_tasks: 1,
            support_tasks: 0,
            exception_tasks: 0,
            orphan_tasks: 0,
            rows: [
                {
                    subfront_id: 'SF-frontend-admin-operativo',
                    active_tasks: 1,
                    aligned_tasks: 1,
                    primary_tasks: 1,
                    support_tasks: 0,
                    exception_tasks: 0,
                    orphan_tasks: 0,
                },
            ],
        },
        byStatus: { in_progress: 1 },
        byExecutor: { codex: 1 },
        codex_instances: {
            total_instances: 1,
            rows: [
                {
                    codex_instance: 'codex_transversal',
                    tasks: 1,
                    active_tasks: 1,
                    in_progress_tasks: 1,
                    done_tasks: 0,
                },
            ],
        },
        provider_modes: {
            total_provider_modes: 1,
            rows: [
                {
                    provider_mode: 'openclaw_chatgpt',
                    tasks: 1,
                    active_tasks: 1,
                    in_progress_tasks: 1,
                    done_tasks: 0,
                },
            ],
        },
        runtime_surfaces: {
            total_runtime_surfaces: 1,
            rows: [
                {
                    runtime_surface: 'figo_queue',
                    tasks: 1,
                    active_tasks: 1,
                    in_progress_tasks: 1,
                    done_tasks: 0,
                },
            ],
        },
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
    assert.equal(data.evidence_summary.debt_count, 1);
    assert.equal(data.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(
        data.codex_instances.rows[0].codex_instance,
        'codex_transversal'
    );
    assert.equal(data.provider_modes.rows[0].provider_mode, 'openclaw_chatgpt');
    assert.equal(data.runtime_surfaces.rows[0].runtime_surface, 'figo_queue');

    const output = statusEngine.renderStatusText(data, {
        wantsExplainRed: true,
        getContributionSignal: () => 'GREEN',
        formatPpDelta: (v) => `+${v}pp`,
    });

    assert.match(output, /Agent Orchestrator Status/);
    assert.match(output, /Estrategia activa: STRAT-2026-03-admin-operativo/);
    assert.match(
        output,
        /Cobertura estrategia: aligned=1, support=0, exception=0, orphan=0/
    );
    assert.match(output, /Semaforo por dominio/);
    assert.match(output, /Aporte \(ranking por completado ponderado\)/);
    assert.match(output, /Evidence terminal:/);
    assert.match(output, /Por subfrente:/);
    assert.match(
        output,
        /SF-frontend-admin-operativo: active=1, aligned=1, primary=1, support=0, exception=0, orphan=0/
    );
    assert.match(output, /Por codex_instance:/);
    assert.match(
        output,
        /codex_transversal: tasks=1, active=1, in_progress=1, done=0/
    );
    assert.match(output, /Por provider_mode:/);
    assert.match(
        output,
        /openclaw_chatgpt: tasks=1, active=1, in_progress=1, done=0/
    );
    assert.match(output, /Por runtime_surface:/);
    assert.match(
        output,
        /figo_queue: tasks=1, active=1, in_progress=1, done=0/
    );
    assert.match(output, /Explain RED \(status\)/);
    assert.match(output, /\[GREEN\] #1 codex/);
});
