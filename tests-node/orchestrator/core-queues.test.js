#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coreQueues = require('../../tools/agent-orchestrator/core/queues');

test('core-queues parseTaskMetaMap parsea bloques TASK y metadatos legacy', () => {
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
`.trim();

    const map = coreQueues.parseTaskMetaMap('QUEUE.md', {
        exists: () => true,
        readFile: () => raw,
        normalize: (value) => value,
    });

    assert.equal(map.size, 1);
    assert.equal(map.get('AG-001').status, 'pending');
    assert.equal(map.get('AG-001').session, 'abc');
});

test('core-queues boardToQueueStatus conserva compatibilidad legacy', () => {
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

test('core-queues renderRetiredQueueTombstone devuelve tombstone estable codex-only', () => {
    const content = coreQueues.renderRetiredQueueTombstone();

    assert.match(content, /# Retired Derived Queue/);
    assert.match(content, /codex-only/);
    assert.doesNotMatch(content, /jules-dispatch/i);
    assert.doesNotMatch(content, /kimi-run/i);
});

test('core-queues renderQueueFile siempre preserva tombstone historico', () => {
    const julesContent = coreQueues.renderQueueFile(
        'jules',
        [
            {
                id: 'AG-001',
                title: 'Should not render',
                status: 'in_progress',
            },
        ],
        new Map([['AG-001', { session: 'sess-1' }]])
    );
    const kimiContent = coreQueues.renderQueueFile(
        'kimi',
        [
            {
                id: 'AG-002',
                title: 'Should not render either',
                status: 'review',
            },
        ],
        new Map()
    );

    assert.equal(julesContent, coreQueues.renderRetiredQueueTombstone());
    assert.equal(kimiContent, coreQueues.renderRetiredQueueTombstone());
    assert.doesNotMatch(julesContent, /AG-001/);
    assert.doesNotMatch(kimiContent, /AG-002/);
});
