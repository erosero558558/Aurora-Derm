#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coreQueues = require('../../tools/agent-orchestrator/core/queues');

test('core-queues parseTaskMetaMap parsea bloques TASK y metadatos', () => {
    const raw = `
# Cola fixture

<!-- TASK
status: pending
task_id: AG-001
risk: low
scope: docs
files: docs/a.md
acceptance_ref: verification/agent-runs/AG-001.md
dispatched_by: agent-orchestrator
session: abc
dispatched: 2026-02-25T10:00:00Z
-->
### Tarea 1

Prompt 1

<!-- /TASK -->

<!-- TASK
status: running
task_id: AG-002
risk: medium
scope: backend
files: api.php
acceptance_ref: verification/agent-runs/AG-002.md
dispatched_by: agent-orchestrator
-->
### Tarea 2

Prompt 2

<!-- /TASK -->
`.trim();

    const map = coreQueues.parseTaskMetaMap('QUEUE.md', {
        exists: () => true,
        readFile: () => raw,
        normalize: (value) => value,
    });

    assert.equal(map.size, 2);
    assert.equal(map.get('AG-001').status, 'pending');
    assert.equal(map.get('AG-001').session, 'abc');
    assert.equal(map.get('AG-002').scope, 'backend');
});

test('core-queues boardToQueueStatus mapea estados segun executor', () => {
    assert.equal(coreQueues.boardToQueueStatus('done', 'jules'), 'done');
    assert.equal(coreQueues.boardToQueueStatus('failed', 'jules'), 'failed');
    assert.equal(coreQueues.boardToQueueStatus('blocked', 'kimi'), 'failed');
    assert.equal(
        coreQueues.boardToQueueStatus('in_progress', 'jules'),
        'dispatched'
    );
    assert.equal(coreQueues.boardToQueueStatus('review', 'kimi'), 'running');
    assert.equal(coreQueues.boardToQueueStatus('ready', 'kimi'), 'pending');
});

test('core-queues renderQueueFile incluye metadata de Jules y fallbacks', () => {
    const content = coreQueues.renderQueueFile(
        'jules',
        [
            {
                id: 'AG-001',
                title: 'Fix docs',
                status: 'in_progress',
                risk: 'low',
                scope: 'docs',
                files: ['docs/a.md', 'docs/b.md'],
                prompt: 'Actualizar docs',
            },
        ],
        new Map([
            ['AG-001', { session: 'sess-1', dispatched: '2026-02-25T10:00Z' }],
        ])
    );

    assert.match(content, /JULES_TASKS\.md/);
    assert.match(content, /Cola derivada desde AGENT_BOARD\.yaml/);
    assert.match(content, /status: dispatched/);
    assert.match(content, /task_id: AG-001/);
    assert.match(content, /files: docs\/a\.md,docs\/b\.md/);
    assert.match(
        content,
        /acceptance_ref: verification\/agent-runs\/AG-001\.md/
    );
    assert.match(content, /session: sess-1/);
    assert.match(content, /dispatched: 2026-02-25T10:00Z/);
    assert.match(content, /### Fix docs/);
    assert.match(content, /Actualizar docs/);
});

test('core-queues renderQueueFile para Kimi usa running y no agrega campos de Jules', () => {
    const content = coreQueues.renderQueueFile(
        'kimi',
        [
            {
                id: 'AG-002',
                title: 'Refactor local',
                status: 'review',
                risk: 'medium',
                scope: 'backend',
                files: ['api.php'],
                acceptance_ref: 'verification/agent-runs/AG-002.md',
            },
        ],
        new Map([['AG-002', { session: 'should-not-render' }]])
    );

    assert.match(content, /KIMI_TASKS\.md/);
    assert.match(content, /node kimi-run\.js --dispatch/);
    assert.match(content, /status: running/);
    assert.match(content, /### Refactor local/);
    assert.doesNotMatch(content, /session:/);
    assert.doesNotMatch(content, /dispatched:/);
});
