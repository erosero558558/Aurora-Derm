#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const parsers = require('../../tools/agent-orchestrator/core/parsers');

test('core-parsers parseBoardContent parsea policy/tasks y arrays inline', () => {
    const raw = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: 2026-02-25
strategy:
  active:
    id: STRAT-2026-03-admin-operativo
    title: "Admin operativo"
    objective: "Cerrar admin operativo"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: active
    started_at: "2026-03-14"
    review_due_at: "2026-03-21"
    exit_criteria: ["uno", "dos"]
    success_signal: "demo"
    focus_id: "FOCUS-2026-03-admin-operativo-cut-1"
    focus_title: "Admin operativo demostrable"
    focus_summary: "Corte comun"
    focus_status: active
    focus_proof: "Demo comun"
    focus_steps: ["admin_queue_pilot_cut", "pilot_readiness_evidence"]
    focus_next_step: "admin_queue_pilot_cut"
    focus_required_checks: ["job:public_main_sync", "runtime:openclaw_chatgpt"]
    focus_non_goals: ["rediseno_publico"]
    focus_owner: "ernesto"
    focus_review_due_at: "2026-03-21"
    focus_evidence_ref: ""
    focus_max_active_slices: 3
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin-operativo
        title: "Admin UX"
        allowed_scopes: ["frontend-admin", "queue"]
        support_only_scopes: ["docs"]
        blocked_scopes: ["payments"]
        wip_limit: 2
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
  next:
    id: STRAT-2026-04-admin-operativo
    title: "Admin operativo siguiente"
    objective: "Cerrar admin operativo"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: draft
    started_at: "2026-03-15"
    review_due_at: "2026-03-22"
    exit_criteria: ["tres"]
    success_signal: "next-demo"
    subfronts:
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend-admin-operativo
        title: "Backend soporte"
        allowed_scopes: ["backend"]
        support_only_scopes: ["ops"]
        blocked_scopes: ["frontend-public"]
        wip_limit: 2
        default_acceptance_profile: "backend_gate_checkpoint"
        exception_ttl_hours: 6
  updated_at: "2026-03-14"

tasks:
  - id: AG-001
    title: "Task uno"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: high
    scope: calendar
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: exception
    strategy_reason: "hotfix critico"
    focus_id: "FOCUS-2026-03-admin-operativo-cut-1"
    focus_step: "admin_queue_pilot_cut"
    integration_slice: backend_readiness
    work_type: fix
    expected_outcome: "Cerrar drift de readiness"
    decision_ref: "DEC-001"
    model_tier_default: "gpt-5.4-mini"
    premium_budget: 1
    premium_calls_used: 0
    premium_gate_state: "closed"
    decision_packet_ref: ""
    model_policy_version: "2026-03-17-codex-model-routing-v2"
    rework_parent: "CDX-001"
    rework_reason: "hotfix readiness"
    files: ["lib/calendar/A.php", "lib/calendar/B.php"]
    acceptance: "ok"
    acceptance_ref: "verification/agent-runs/AG-001.md"
    depends_on: ["AG-000"]
    prompt: "do it"
    created_at: 2026-02-25
    updated_at: 2026-02-25
`;

    const board = parsers.parseBoardContent(raw, {
        allowedStatuses: new Set(['in_progress', 'done']),
    });

    assert.equal(board.version, '1');
    assert.equal(board.policy.canonical, 'AGENTS.md');
    assert.equal(board.tasks.length, 1);
    assert.equal(board.strategy.updated_at, '2026-03-14');
    assert.equal(board.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(board.strategy.active.owner_policy, 'detected_default_owner');
    assert.equal(
        board.strategy.active.focus_id,
        'FOCUS-2026-03-admin-operativo-cut-1'
    );
    assert.deepEqual(board.strategy.active.focus_steps, [
        'admin_queue_pilot_cut',
        'pilot_readiness_evidence',
    ]);
    assert.equal(board.strategy.active.subfronts.length, 1);
    assert.equal(
        board.strategy.active.subfronts[0].subfront_id,
        'SF-frontend-admin-operativo'
    );
    assert.equal(
        board.strategy.active.subfronts[0].default_acceptance_profile,
        'frontend_delivery_checkpoint'
    );
    assert.equal(board.strategy.next.id, 'STRAT-2026-04-admin-operativo');
    assert.equal(board.strategy.next.status, 'draft');
    assert.equal(
        board.strategy.next.subfronts[0].subfront_id,
        'SF-backend-admin-operativo'
    );
    assert.deepEqual(board.tasks[0].files, [
        'lib/calendar/A.php',
        'lib/calendar/B.php',
    ]);
    assert.deepEqual(board.tasks[0].depends_on, ['AG-000']);
    assert.equal(board.tasks[0].status, 'in_progress');
    assert.equal(board.tasks[0].codex_instance, 'codex_backend_ops');
    assert.equal(board.tasks[0].domain_lane, 'backend_ops');
    assert.equal(board.tasks[0].lane_lock, 'strict');
    assert.equal(board.tasks[0].cross_domain, false);
    assert.equal(board.tasks[0].strategy_id, 'STRAT-2026-03-admin-operativo');
    assert.equal(board.tasks[0].subfront_id, 'SF-backend-admin-operativo');
    assert.equal(board.tasks[0].strategy_role, 'exception');
    assert.equal(board.tasks[0].strategy_reason, 'hotfix critico');
    assert.equal(
        board.tasks[0].focus_id,
        'FOCUS-2026-03-admin-operativo-cut-1'
    );
    assert.equal(board.tasks[0].focus_step, 'admin_queue_pilot_cut');
    assert.equal(board.tasks[0].integration_slice, 'backend_readiness');
    assert.equal(board.tasks[0].work_type, 'fix');
    assert.equal(board.tasks[0].decision_ref, 'DEC-001');
    assert.equal(board.tasks[0].model_tier_default, 'gpt-5.4-mini');
    assert.equal(board.tasks[0].premium_budget, 1);
    assert.equal(board.tasks[0].premium_calls_used, 0);
    assert.equal(board.tasks[0].premium_gate_state, 'closed');
    assert.equal(board.tasks[0].decision_packet_ref, '');
    assert.equal(
        board.tasks[0].model_policy_version,
        '2026-03-17-codex-model-routing-v2'
    );
    assert.equal(board.tasks[0].rework_parent, 'CDX-001');
    assert.equal(board.tasks[0].rework_reason, 'hotfix readiness');
});

test('core-parsers parseBoardContent valida status permitido', () => {
    const raw = `
version: 1
policy:
  canonical: AGENTS.md
tasks:
  - id: AG-001
    status: weird
    files: []
    depends_on: []
`;

    assert.throws(
        () =>
            parsers.parseBoardContent(raw, {
                allowedStatuses: new Set(['backlog', 'done']),
            }),
        /Estado no permitido/i
    );
});

test('core-parsers parseHandoffsContent normaliza status y files', () => {
    const raw = `
version: 1
handoffs:
  - id: HO-001
    status: ACTIVE
    from_task: AG-001
    to_task: CDX-001
    reason: soporte
    files: ["docs/a.md"]
    approved_by: ernesto
    created_at: 2026-02-25T00:00:00Z
    expires_at: 2026-02-25T03:00:00Z
`;

    const data = parsers.parseHandoffsContent(raw);
    assert.equal(data.version, '1');
    assert.equal(data.handoffs.length, 1);
    assert.equal(data.handoffs[0].status, 'active');
    assert.deepEqual(data.handoffs[0].files, ['docs/a.md']);
});

test('core-parsers parseCodexActiveBlocksContent parsea multiples bloques', () => {
    const raw = `
<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: in_progress
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: 2026-02-25
-->

Texto

<!-- CODEX_ACTIVE
block: C2
task_id: CDX-002
status: review
files: []
updated_at: 2026-02-26
-->
`;

    const blocks = parsers.parseCodexActiveBlocksContent(raw);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].task_id, 'CDX-001');
    assert.deepEqual(blocks[0].files, ['AGENTS.md', 'agent-orchestrator.js']);
    assert.equal(blocks[1].status, 'review');
});

test('core-parsers parseCodexActiveBlocksContent normaliza codex_instance y subfront_id', () => {
    const raw = `
<!-- CODEX_ACTIVE
codex_instance: CODEX_FRONTEND
block: C1
task_id: CDX-044
subfront_id: SF-frontend-turnero-web-pilot
status: review
files: ["admin.html"]
updated_at: 2026-03-14
-->
`;

    const blocks = parsers.parseCodexActiveBlocksContent(raw);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].codex_instance, 'codex_frontend');
    assert.equal(blocks[0].subfront_id, 'SF-frontend-turnero-web-pilot');
    assert.deepEqual(blocks[0].files, ['admin.html']);
});

test('core-parsers parseCodexStrategyActiveBlocksContent parsea bloque de estrategia', () => {
    const raw = `
<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: ACTIVE
owner: ernesto
subfront_ids: ["SF-frontend-admin-operativo", "SF-backend-admin-operativo"]
updated_at: "2026-03-14"
-->
`;

    const blocks = parsers.parseCodexStrategyActiveBlocksContent(raw);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].id, 'STRAT-2026-03-admin-operativo');
    assert.equal(blocks[0].status, 'active');
    assert.deepEqual(blocks[0].subfront_ids, [
        'SF-frontend-admin-operativo',
        'SF-backend-admin-operativo',
    ]);
});

test('core-parsers parseDecisionsContent normaliza decisiones y arrays', () => {
    const raw = `
version: 1
policy:
  owner_model: human_supervisor
  revision: 2
  updated_at: "2026-03-14"
decisions:
  - id: DEC-001
    strategy_id: STRAT-2026-03-admin-operativo
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: admin_queue_pilot_cut
    title: "Resolver gate de pilot"
    owner: ernesto
    status: OPEN
    due_at: "2026-03-15"
    recommended_option: "repair_sync"
    selected_option: ""
    rationale: "public_main_sync esta rojo"
    related_tasks: ["CDX-001", "AG-010"]
    opened_at: "2026-03-14"
    resolved_at: ""
`;

    const data = parsers.parseDecisionsContent(raw);
    assert.equal(data.version, '1');
    assert.equal(data.policy.owner_model, 'human_supervisor');
    assert.equal(data.decisions.length, 1);
    assert.equal(data.decisions[0].status, 'open');
    assert.deepEqual(data.decisions[0].related_tasks, ['CDX-001', 'AG-010']);
});
