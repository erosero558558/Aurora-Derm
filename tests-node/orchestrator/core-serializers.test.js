#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const parsers = require('../../tools/agent-orchestrator/core/parsers');
const serializers = require('../../tools/agent-orchestrator/core/serializers');

test('core-serializers quote y serializeArrayInline escapan comillas', () => {
    assert.equal(serializers.quote('a"b'), '"a\\"b"');
    assert.equal(
        serializers.serializeArrayInline(['a', 'b"c']),
        '["a", "b\\"c"]'
    );
    assert.equal(serializers.serializeArrayInline([]), '[]');
});

test('core-serializers serializeHandoffs incluye campos opcionales de cierre', () => {
    const yaml = serializers.serializeHandoffs({
        version: 1,
        handoffs: [
            {
                id: 'HO-001',
                status: 'closed',
                from_task: 'AG-001',
                to_task: 'CDX-001',
                reason: 'soporte',
                files: ['docs/a.md'],
                approved_by: 'ernesto',
                created_at: '2026-02-25T00:00:00Z',
                expires_at: '2026-02-25T03:00:00Z',
                closed_at: '2026-02-25T02:00:00Z',
                close_reason: 'handoff_done',
            },
        ],
    });

    assert.match(yaml, /^version: 1/m);
    assert.match(yaml, /closed_at:\s+2026-02-25T02:00:00Z/);
    assert.match(yaml, /close_reason:\s+"handoff_done"/);

    const parsed = parsers.parseHandoffsContent(yaml);
    assert.equal(parsed.handoffs[0].status, 'closed');
    assert.deepEqual(parsed.handoffs[0].files, ['docs/a.md']);
});

test('core-serializers serializeBoard roundtrip basico con currentDate inyectado', () => {
    const board = {
        version: 1,
        policy: {
            canonical: 'AGENTS.md',
            autonomy: 'semi_autonomous_guardrails',
            kpi: 'reduce_rework',
            revision: 7,
            updated_at: '2026-02-25',
        },
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo',
                objective: 'Cerrar admin operativo',
                owner: 'ernesto',
                status: 'active',
                started_at: '2026-03-14',
                review_due_at: '2026-03-21',
                exit_criteria: ['uno', 'dos'],
                success_signal: 'demo',
                subfronts: [
                    {
                        codex_instance: 'codex_frontend',
                        subfront_id: 'SF-frontend-admin-operativo',
                        title: 'Admin UX',
                        allowed_scopes: ['frontend-admin'],
                        support_only_scopes: ['docs'],
                        blocked_scopes: ['payments'],
                    },
                ],
            },
        },
        tasks: [
            {
                id: 'AG-001',
                title: 'Task "uno"',
                owner: 'ernesto',
                executor: 'codex',
                status: 'ready',
                risk: 'medium',
                scope: 'governance',
                strategy_id: 'STRAT-2026-03-admin-operativo',
                subfront_id: 'SF-frontend-admin-operativo',
                strategy_role: 'support',
                strategy_reason: 'soporte directo al frente activo',
                files: ['agent-orchestrator.js'],
                acceptance: 'ok',
                acceptance_ref: 'verification/agent-runs/AG-001.md',
                depends_on: [],
                prompt: 'Task "uno"',
                created_at: '2026-02-25',
                updated_at: '2026-02-25',
            },
        ],
    };

    const yaml = serializers.serializeBoard(board, {
        currentDate: () => '2099-01-01',
    });

    assert.match(yaml, /^version: 1/m);
    assert.match(yaml, /revision:\s+7/);
    assert.match(yaml, /strategy:/);
    assert.match(yaml, /subfront_id:\s+SF-frontend-admin-operativo/);
    assert.match(yaml, /title:\s+"Task \\"uno\\""/);
    assert.match(yaml, /files:\s+\["agent-orchestrator\.js"\]/);

    const parsed = parsers.parseBoardContent(yaml, {
        allowedStatuses: new Set(['ready']),
    });
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.policy.revision, '7');
    assert.equal(parsed.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.tasks[0].title, 'Task "uno"');
    assert.deepEqual(parsed.tasks[0].files, ['agent-orchestrator.js']);
    assert.equal(parsed.tasks[0].codex_instance, 'codex_backend_ops');
    assert.equal(parsed.tasks[0].domain_lane, 'backend_ops');
    assert.equal(parsed.tasks[0].lane_lock, 'strict');
    assert.equal(parsed.tasks[0].cross_domain, false);
    assert.equal(parsed.tasks[0].strategy_id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.tasks[0].subfront_id, 'SF-frontend-admin-operativo');
    assert.equal(parsed.tasks[0].strategy_role, 'support');
    assert.equal(
        parsed.tasks[0].strategy_reason,
        'soporte directo al frente activo'
    );
});
