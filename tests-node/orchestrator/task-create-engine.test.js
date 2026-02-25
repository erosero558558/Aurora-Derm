#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const taskCreate = require('../../tools/agent-orchestrator/domain/task-create');

const TEMPLATES = {
    docs: { executor: 'kimi', status: 'ready', risk: 'low', scope: 'docs' },
    bugfix: {
        executor: 'codex',
        status: 'ready',
        risk: 'medium',
        scope: 'backend',
    },
};

test('task-create engine resuelve template valido e invalido', () => {
    const docs = taskCreate.resolveTaskCreateTemplate('docs', {
        templates: TEMPLATES,
    });
    assert.equal(docs.name, 'docs');
    assert.equal(docs.executor, 'kimi');

    assert.throws(
        () =>
            taskCreate.resolveTaskCreateTemplate('nope', {
                templates: TEMPLATES,
            }),
        /template invalido/
    );
});

test('task-create engine nextAgentTaskId calcula siguiente correlativo', () => {
    assert.equal(
        taskCreate.nextAgentTaskId([
            { id: 'AG-001' },
            { id: 'AG-010' },
            { id: 'CDX-001' },
        ]),
        'AG-011'
    );
    assert.equal(taskCreate.nextAgentTaskId([]), 'AG-001');
});

test('task-create engine infiere scope/risk y suggested_executor desde files', () => {
    const inferred = taskCreate.inferTaskCreateFromFiles(
        ['lib/calendar/CalendarBookingService.php'],
        {
            normalizePathToken: (v) =>
                String(v).replace(/\\/g, '/').toLowerCase(),
            criticalScopeKeywords: [
                'payments',
                'auth',
                'calendar',
                'deploy',
                'env',
                'security',
            ],
            inferTaskDomain: () => 'calendar',
            findCriticalScopeKeyword: (scope) =>
                String(scope).includes('calendar') ? 'calendar' : null,
            criticalScopeAllowedExecutors: new Set(['codex', 'claude']),
        }
    );

    assert.equal(inferred.scope, 'calendar');
    assert.equal(inferred.risk, 'high');
    assert.equal(inferred.critical_scope, 'calendar');
    assert.equal(inferred.suggested_executor, 'codex');
    assert.deepEqual(inferred.allowed_executors_for_scope, ['codex', 'claude']);
});

test('task-create engine normaliza task apply y valida campos', () => {
    const task = taskCreate.normalizeTaskForCreateApply(
        {
            id: 'AG-123',
            title: 'Task',
            owner: 'ernesto',
            executor: 'CODEX',
            status: 'ready',
            risk: 'HIGH',
            scope: 'calendar',
            files: ['a.php'],
            depends_on: ['AG-001'],
        },
        {
            currentDate: () => '2026-02-24',
            allowedTaskExecutors: new Set(['codex', 'kimi']),
            allowedStatuses: new Set(['backlog', 'ready', 'in_progress']),
        }
    );

    assert.equal(task.executor, 'codex');
    assert.equal(task.risk, 'high');
    assert.equal(task.created_at, '2026-02-24');

    assert.throws(
        () =>
            taskCreate.normalizeTaskForCreateApply(
                {
                    id: 'AG-124',
                    title: 'Task',
                    executor: 'jules',
                    status: 'ready',
                    risk: 'medium',
                    scope: 'docs',
                    files: ['a.md'],
                },
                {
                    currentDate: () => '2026-02-24',
                    allowedTaskExecutors: new Set(['codex']),
                    allowedStatuses: new Set(['ready']),
                }
            ),
        /executor invalido/
    );
});

test('task-create engine carga preview JSON desde archivo y valida contrato', () => {
    const dir = mkdtempSync(join(tmpdir(), 'task-create-engine-'));
    try {
        const previewPath = join(dir, 'preview.json');
        writeFileSync(
            previewPath,
            JSON.stringify(
                {
                    command: 'task',
                    action: 'create',
                    preview: true,
                    persisted: false,
                    task_full: { id: 'AG-100' },
                },
                null,
                2
            ),
            'utf8'
        );

        const loaded = taskCreate.loadTaskCreateApplyPayload('preview.json', {
            rootPath: dir,
        });

        assert.equal(loaded.path, 'preview.json');
        assert.equal(loaded.resolved_path, previewPath);
        assert.equal(loaded.payload.action, 'create');

        assert.throws(
            () =>
                taskCreate.loadTaskCreateApplyPayload('missing.json', {
                    rootPath: dir,
                }),
            /No existe archivo de apply/
        );
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('task-create engine construye diff de preview con campos cambiados', () => {
    const existing = {
        id: 'AG-001',
        title: 'A',
        owner: 'x',
        executor: 'kimi',
        status: 'backlog',
        risk: 'low',
        scope: 'docs',
        files: ['docs/a.md'],
        acceptance: '',
        acceptance_ref: '',
        depends_on: [],
        prompt: 'A',
    };
    const preview = {
        ...existing,
        title: 'B',
        status: 'ready',
    };

    const diffs = taskCreate.buildTaskCreatePreviewDiff(existing, preview, {
        toTaskFullJson: (v) => v,
    });
    const fields = diffs.map((d) => d.field).sort();
    assert.deepEqual(fields, ['status', 'title']);
});
