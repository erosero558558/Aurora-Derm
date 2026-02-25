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
            updated_at: '2026-02-25',
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
    assert.match(yaml, /title:\s+"Task \\"uno\\""/);
    assert.match(yaml, /files:\s+\["agent-orchestrator\.js"\]/);

    const parsed = parsers.parseBoardContent(yaml, {
        allowedStatuses: new Set(['ready']),
    });
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.tasks[0].title, 'Task "uno"');
    assert.deepEqual(parsed.tasks[0].files, ['agent-orchestrator.js']);
});
