#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    classifyPathLane,
    inferDomainLaneFromFiles,
    findCriticalScopeKeyword,
    validateTaskExecutorScopeGuard,
    validateTaskDependsOn,
    validateTaskDualCodexGuard,
    validateTaskGovernancePrechecks,
} = require('../../tools/agent-orchestrator/domain/task-guards');

const CRITICAL_SCOPE_KEYWORDS = [
    'payments',
    'auth',
    'calendar',
    'deploy',
    'env',
    'security',
];
const ALLOWED_EXECUTORS = new Set(['codex']);
const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

test('task-guards detecta keyword critica en scope', () => {
    assert.equal(
        findCriticalScopeKeyword(
            'calendar-prod-hardening',
            CRITICAL_SCOPE_KEYWORDS
        ),
        'calendar'
    );
    assert.equal(
        findCriticalScopeKeyword('docs', CRITICAL_SCOPE_KEYWORDS),
        null
    );
});

test('task-guards bloquea executor no permitido para scope critico', () => {
    assert.throws(
        () =>
            validateTaskExecutorScopeGuard(
                { scope: 'payments-refactor', executor: 'jules' },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /task critica/
    );

    assert.doesNotThrow(() =>
        validateTaskExecutorScopeGuard(
            { scope: 'payments-refactor', executor: 'codex' },
            {
                criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                allowedExecutors: ALLOWED_EXECUTORS,
            }
        )
    );
});

test('task-guards valida depends_on (existencia, duplicados y formato)', () => {
    const board = {
        tasks: [{ id: 'AG-001' }, { id: 'CDX-001' }],
    };

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['AG-001', 'AG-001'],
            }),
        /duplicado/
    );

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['BAD-1'],
            }),
        /invalido/
    );

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['AG-999'],
            }),
        /no existe en board/
    );

    assert.doesNotThrow(() =>
        validateTaskDependsOn(board, {
            id: 'AG-010',
            depends_on: ['AG-001', 'CDX-001'],
        })
    );
});

test('task-guards prechecks combinan scope guard y depends_on', () => {
    const board = {
        tasks: [{ id: 'AG-001' }],
    };

    assert.throws(
        () =>
            validateTaskGovernancePrechecks(
                board,
                {
                    id: 'AG-010',
                    scope: 'calendar-hardening',
                    executor: 'jules',
                    depends_on: ['AG-001'],
                },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /task critica/
    );
});

test('task-guards infiere lane conservador por files', () => {
    assert.equal(
        classifyPathLane('src/apps/chat/engine.js').lane,
        'frontend_content'
    );
    assert.equal(
        classifyPathLane('controllers/AdminController.php').lane,
        'backend_ops'
    );
    assert.equal(classifyPathLane('docs/readme.md').lane, 'backend_ops');

    const inferredFrontend = inferDomainLaneFromFiles([
        'src/apps/chat/engine.js',
        'js/engines/chat-ui-engine.js',
    ]);
    assert.equal(inferredFrontend.lane, 'frontend_content');
    assert.equal(inferredFrontend.hasCrossDomainFiles, false);

    const inferredMixed = inferDomainLaneFromFiles([
        'src/apps/chat/engine.js',
        'controllers/AvailabilityController.php',
    ]);
    assert.equal(inferredMixed.lane, 'backend_ops');
    assert.equal(inferredMixed.hasCrossDomainFiles, true);
});

test('task-guards bloquea archivo fuera de lane sin cross_domain', () => {
    const board = {
        tasks: [{ id: 'AG-001' }],
    };

    assert.throws(
        () =>
            validateTaskDualCodexGuard(
                board,
                {
                    id: 'AG-010',
                    status: 'ready',
                    domain_lane: 'frontend_content',
                    codex_instance: 'codex_frontend',
                    lane_lock: 'strict',
                    cross_domain: false,
                    files: ['controllers/AdminController.php'],
                    depends_on: ['AG-001'],
                    runtime_impact: 'low',
                    critical_zone: false,
                },
                {
                    activeStatuses: ACTIVE_STATUSES,
                    handoffs: [],
                }
            ),
        /archivos fuera de lane frontend_content/i
    );
});

test('task-guards exige handoff activo para cross_domain en estado activo', () => {
    const board = {
        tasks: [{ id: 'AG-001' }, { id: 'CDX-001' }],
    };

    const task = {
        id: 'AG-010',
        status: 'in_progress',
        domain_lane: 'backend_ops',
        codex_instance: 'codex_backend_ops',
        lane_lock: 'handoff_allowed',
        cross_domain: true,
        files: ['src/apps/chat/engine.js', 'controllers/AdminController.php'],
        depends_on: ['AG-001'],
        runtime_impact: 'low',
        critical_zone: false,
    };

    assert.throws(
        () =>
            validateTaskDualCodexGuard(board, task, {
                activeStatuses: ACTIVE_STATUSES,
                handoffs: [],
            }),
        /handoff activo vinculado/i
    );

    assert.doesNotThrow(() =>
        validateTaskDualCodexGuard(board, task, {
            activeStatuses: ACTIVE_STATUSES,
            handoffs: [
                {
                    id: 'HO-001',
                    status: 'active',
                    from_task: 'AG-010',
                    to_task: 'AG-001',
                    files: ['src/apps/chat/engine.js'],
                    expires_at: '2099-01-01T00:00:00.000Z',
                },
            ],
            isExpired: () => false,
        })
    );
});
