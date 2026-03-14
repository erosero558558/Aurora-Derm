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
                owner_policy: 'detected_default_owner',
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
                        wip_limit: 2,
                        default_acceptance_profile:
                            'frontend_delivery_checkpoint',
                        exception_ttl_hours: 8,
                    },
                ],
            },
            next: {
                id: 'STRAT-2026-04-admin-operativo',
                title: 'Admin operativo next',
                objective: 'Cerrar admin operativo next',
                owner: 'ernesto',
                owner_policy: 'detected_default_owner',
                status: 'draft',
                started_at: '2026-03-20',
                review_due_at: '2026-03-28',
                exit_criteria: ['tres'],
                success_signal: 'demo next',
                subfronts: [
                    {
                        codex_instance: 'codex_backend_ops',
                        subfront_id: 'SF-backend-admin-operativo',
                        title: 'Backend soporte',
                        allowed_scopes: ['backend'],
                        support_only_scopes: ['tests'],
                        blocked_scopes: ['frontend-public'],
                        wip_limit: 1,
                        default_acceptance_profile: 'backend_gate_checkpoint',
                        exception_ttl_hours: 6,
                    },
                ],
            },
            updated_at: '2026-03-14',
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
                exception_opened_at: '2026-03-14T00:00:00.000Z',
                exception_expires_at: '2026-03-14T08:00:00.000Z',
                exception_state: 'regularized',
                files: ['agent-orchestrator.js'],
                provider_mode: '',
                runtime_surface: '',
                runtime_transport: '',
                runtime_last_transport: '',
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
    assert.match(yaml, /owner_policy:\s+"detected_default_owner"/);
    assert.match(
        yaml,
        /default_acceptance_profile:\s+"frontend_delivery_checkpoint"/
    );
    assert.match(yaml, /exception_ttl_hours:\s+8/);
    assert.match(yaml, /next:\s*\n/);
    assert.match(yaml, /subfront_id:\s+SF-frontend-admin-operativo/);
    assert.match(yaml, /title:\s+"Task \\"uno\\""/);
    assert.match(yaml, /exception_state:\s+"regularized"/);
    assert.match(yaml, /files:\s+\["agent-orchestrator\.js"\]/);
    assert.match(yaml, /provider_mode:\s+""/);
    assert.match(yaml, /runtime_surface:\s+""/);
    assert.match(yaml, /runtime_transport:\s+""/);
    assert.match(yaml, /runtime_last_transport:\s+""/);
    assert.equal(
        yaml.split(/\r?\n/).some((line) => /\s+$/.test(line)),
        false
    );

    const parsed = parsers.parseBoardContent(yaml, {
        allowedStatuses: new Set(['ready']),
    });
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.policy.revision, '7');
    assert.equal(parsed.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.strategy.active.owner_policy, 'detected_default_owner');
    assert.equal(parsed.strategy.next.id, 'STRAT-2026-04-admin-operativo');
    assert.equal(parsed.strategy.updated_at, '2026-03-14');
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
    assert.equal(
        parsed.tasks[0].exception_opened_at,
        '2026-03-14T00:00:00.000Z'
    );
    assert.equal(
        parsed.tasks[0].exception_expires_at,
        '2026-03-14T08:00:00.000Z'
    );
    assert.equal(parsed.tasks[0].exception_state, 'regularized');
});
