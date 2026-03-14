#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    classifyPathLane,
    inferDomainLaneFromFiles,
    findCriticalScopeKeyword,
    ensureTaskDualCodexDefaults,
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

function boardWithActiveStrategy() {
    return {
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo',
                objective: 'Cerrar admin operativo',
                owner: 'ernesto',
                status: 'active',
                started_at: '2026-03-14',
                review_due_at: '2026-03-21',
                exit_criteria: ['uno'],
                success_signal: 'demo',
                subfronts: [
                    {
                        codex_instance: 'codex_frontend',
                        subfront_id: 'SF-frontend-admin-operativo',
                        title: 'Admin UX',
                        allowed_scopes: ['frontend-admin', 'queue'],
                        support_only_scopes: ['docs'],
                        blocked_scopes: ['payments'],
                    },
                    {
                        codex_instance: 'codex_backend_ops',
                        subfront_id: 'SF-backend-admin-operativo',
                        title: 'Backend soporte',
                        allowed_scopes: [
                            'auth',
                            'backend',
                            'readiness',
                            'gates',
                        ],
                        support_only_scopes: ['tests'],
                        blocked_scopes: ['frontend-public'],
                    },
                    {
                        codex_instance: 'codex_transversal',
                        subfront_id: 'SF-transversal-admin-operativo',
                        title: 'Runtime soporte',
                        allowed_scopes: [],
                        support_only_scopes: ['openclaw_runtime', 'tooling'],
                        blocked_scopes: ['backend', 'auth'],
                    },
                ],
            },
        },
        tasks: [{ id: 'AG-001' }],
    };
}

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

    const inferredTransversal = inferDomainLaneFromFiles([
        'figo-ai-bridge.php',
        'lib/figo_queue/JobProcessor.php',
    ]);
    assert.equal(inferredTransversal.lane, 'transversal_runtime');
    assert.equal(inferredTransversal.hasCrossDomainFiles, false);
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

test('task-guards valida tareas runtime OpenClaw en lane transversal', () => {
    const board = {
        tasks: [{ id: 'AG-001' }],
    };

    assert.throws(
        () =>
            validateTaskDualCodexGuard(
                board,
                {
                    id: 'AG-200',
                    status: 'ready',
                    domain_lane: 'backend_ops',
                    codex_instance: 'codex_backend_ops',
                    lane_lock: 'strict',
                    cross_domain: false,
                    provider_mode: 'openclaw_chatgpt',
                    runtime_surface: 'figo_queue',
                    runtime_transport: 'hybrid_http_cli',
                    files: ['controllers/AdminController.php'],
                    depends_on: [],
                    runtime_impact: 'high',
                    critical_zone: true,
                },
                {
                    activeStatuses: ACTIVE_STATUSES,
                    handoffs: [],
                }
            ),
        /archivos fuera de lane transversal_runtime/i
    );

    assert.doesNotThrow(() =>
        validateTaskDualCodexGuard(
            board,
            {
                id: 'AG-201',
                status: 'ready',
                domain_lane: 'transversal_runtime',
                codex_instance: 'codex_transversal',
                lane_lock: 'strict',
                cross_domain: false,
                provider_mode: 'openclaw_chatgpt',
                runtime_surface: 'leadops_worker',
                runtime_transport: 'hybrid_http_cli',
                files: ['bin/lead-ai-worker.js'],
                depends_on: [],
                runtime_impact: 'high',
                critical_zone: true,
            },
            {
                activeStatuses: ACTIVE_STATUSES,
                handoffs: [],
            }
        )
    );
});

test('task-guards completa defaults OpenClaw cuando scope es openclaw_runtime', () => {
    const task = {
        id: 'AG-300',
        scope: 'openclaw_runtime',
        files: ['bin/lead-ai-worker.js'],
        provider_mode: '',
        runtime_surface: '',
        runtime_transport: '',
        runtime_last_transport: '',
        domain_lane: '',
        codex_instance: '',
        lane_lock: '',
        cross_domain: false,
    };

    ensureTaskDualCodexDefaults(task);

    assert.equal(task.domain_lane, 'transversal_runtime');
    assert.equal(task.codex_instance, 'codex_transversal');
    assert.equal(task.lane_lock, 'strict');
    assert.equal(task.provider_mode, 'openclaw_chatgpt');
    assert.equal(task.runtime_transport, 'hybrid_http_cli');
    assert.equal(task.runtime_surface, 'leadops_worker');
});

test('task-guards exige campos explicitos de estrategia para tareas activas', () => {
    const board = boardWithActiveStrategy();

    assert.throws(
        () =>
            validateTaskGovernancePrechecks(
                board,
                {
                    id: 'AG-400',
                    status: 'ready',
                    executor: 'codex',
                    scope: 'frontend-admin',
                    files: ['src/apps/admin-v3/app.js'],
                    depends_on: [],
                    runtime_impact: 'low',
                    critical_zone: false,
                },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /requiere strategy_id=STRAT-2026-03-admin-operativo/i
    );
});

test('task-guards bloquea subfrente ajeno al codex_instance de la tarea', () => {
    const board = boardWithActiveStrategy();

    assert.throws(
        () =>
            validateTaskGovernancePrechecks(
                board,
                {
                    id: 'AG-401',
                    status: 'ready',
                    executor: 'codex',
                    scope: 'frontend-admin',
                    strategy_id: 'STRAT-2026-03-admin-operativo',
                    subfront_id: 'SF-backend-admin-operativo',
                    strategy_role: 'primary',
                    files: ['src/apps/admin-v3/app.js'],
                    depends_on: [],
                    runtime_impact: 'low',
                    critical_zone: false,
                },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /requiere codex_instance=codex_backend_ops/i
    );
});

test('task-guards exige strategy_reason para exception activa', () => {
    const board = boardWithActiveStrategy();

    assert.throws(
        () =>
            validateTaskGovernancePrechecks(
                board,
                {
                    id: 'AG-402',
                    status: 'ready',
                    executor: 'codex',
                    scope: 'frontend-admin',
                    strategy_id: 'STRAT-2026-03-admin-operativo',
                    subfront_id: 'SF-frontend-admin-operativo',
                    strategy_role: 'exception',
                    files: ['src/apps/admin-v3/app.js'],
                    depends_on: [],
                    runtime_impact: 'low',
                    critical_zone: false,
                },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /strategy_role=exception requiere strategy_reason/i
    );
});

test('task-guards tolera tareas terminales historicas sin backfill de estrategia', () => {
    const board = boardWithActiveStrategy();

    assert.doesNotThrow(() =>
        validateTaskGovernancePrechecks(
            board,
            {
                id: 'AG-403',
                status: 'done',
                executor: 'codex',
                scope: 'docs',
                files: ['docs/strategy.md'],
                depends_on: [],
                runtime_impact: 'low',
                critical_zone: false,
            },
            {
                criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                allowedExecutors: ALLOWED_EXECUTORS,
            }
        )
    );
});
