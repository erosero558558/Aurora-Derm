#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const modelRouting = require('../../tools/agent-orchestrator/domain/model-routing');

function createFixtureRoot() {
    return mkdtempSync(join(tmpdir(), 'model-routing-engine-'));
}

function createDecisionPacket(root, taskId, index, overrides = {}) {
    const packetsDir = join(root, 'verification', 'codex-decisions');
    mkdirSync(packetsDir, { recursive: true });
    const relativePath = `verification/codex-decisions/${taskId}-${index}.md`;
    const content = [
        `task_id: ${overrides.task_id || taskId}`,
        `execution_mode: ${overrides.execution_mode || 'subagent'}`,
        `premium_reason: ${overrides.premium_reason || 'critical_review'}`,
        `problem: ${overrides.problem || 'resolver gate premium'}`,
        `why_mini_or_local_failed: ${
            overrides.why_mini_or_local_failed || 'mini no destrabo'
        }`,
        `exact_decision_requested: ${
            overrides.exact_decision_requested || 'decidir siguiente accion'
        }`,
        `acceptable_output: ${
            overrides.acceptable_output || 'respuesta estructurada'
        }`,
        `risk_if_wrong: ${overrides.risk_if_wrong || 'alto retrabajo'}`,
        `action_taken: ${overrides.action_taken || 'abrir gate premium'}`,
    ].join('\n');
    writeFileSync(join(root, relativePath), `${content}\n`, 'utf8');
    return relativePath;
}

test('model-routing derivePremiumBudget aplica prioridad critical > high/cross_domain', () => {
    assert.equal(
        modelRouting.derivePremiumBudget({
            risk: 'low',
            cross_domain: false,
            critical_zone: false,
        }),
        0
    );
    assert.equal(
        modelRouting.derivePremiumBudget({
            risk: 'high',
            cross_domain: false,
            critical_zone: false,
        }),
        1
    );
    assert.equal(
        modelRouting.derivePremiumBudget({
            risk: 'medium',
            cross_domain: true,
            critical_zone: false,
        }),
        1
    );
    assert.equal(
        modelRouting.derivePremiumBudget({
            risk: 'high',
            cross_domain: true,
            critical_zone: true,
        }),
        2
    );
});

test('model-routing syncTaskModelRoutingState deriva campos desde ledger premium', () => {
    const task = {
        id: 'CDX-101',
        title: 'Codex tracked task',
        status: 'in_progress',
        risk: 'high',
        codex_instance: 'codex_backend_ops',
    };

    modelRouting.syncTaskModelRoutingState(task, {
        ledgerEntries: [
            {
                task_id: 'CDX-101',
                model_tier: 'gpt-5.4',
                reason: 'critical_review',
                decision_packet_ref:
                    'verification/codex-decisions/CDX-101-1.md',
                execution_mode: 'subagent',
                budget_unit: 'premium_session',
                premium_session_id: 'sess-101-1',
                root_thread_model_tier: 'gpt-5.4-mini',
            },
        ],
    });
    const summary = modelRouting.buildTaskModelUsageSummary(task, {
        ledgerEntries: [
            {
                task_id: 'CDX-101',
                model_tier: 'gpt-5.4',
                reason: 'critical_review',
                decision_packet_ref:
                    'verification/codex-decisions/CDX-101-1.md',
                execution_mode: 'subagent',
                budget_unit: 'premium_session',
                premium_session_id: 'sess-101-1',
                root_thread_model_tier: 'gpt-5.4-mini',
            },
        ],
    });

    assert.equal(task.model_tier_default, 'gpt-5.4-mini');
    assert.equal(task.premium_budget, 1);
    assert.equal(task.premium_calls_used, 1);
    assert.equal(task.premium_gate_state, 'consumed');
    assert.equal(
        task.decision_packet_ref,
        'verification/codex-decisions/CDX-101-1.md'
    );
    assert.equal(
        task.model_policy_version,
        '2026-03-17-codex-model-routing-v2'
    );
    assert.equal(summary.premium_subagent_sessions_total, 1);
    assert.equal(summary.premium_root_exceptions_total, 0);
    assert.equal(summary.mini_root_compliance_pct, 100);
});

test('model-routing collectTaskModelRoutingErrors detecta drift en task CDX activa', () => {
    const errors = modelRouting.collectTaskModelRoutingErrors({
        id: 'CDX-102',
        title: 'Tracked active task',
        status: 'in_progress',
        risk: 'high',
        codex_instance: 'codex_backend_ops',
    });

    assert.equal(
        errors.some((error) =>
            /model_tier_default debe ser gpt-5\.4-mini/i.test(error)
        ),
        true
    );
    assert.equal(
        errors.some((error) => /premium_budget debe ser 1/i.test(error)),
        true
    );
    assert.equal(
        errors.some((error) =>
            /model_policy_version debe ser 2026-03-17-codex-model-routing-v2/i.test(
                error
            )
        ),
        true
    );
});

test('model-routing validateDecisionPacketFile valida packet completo y detecta campos faltantes', () => {
    const root = createFixtureRoot();
    try {
        const okRef = createDecisionPacket(root, 'CDX-200', 1);
        const okResult = modelRouting.validateDecisionPacketFile(okRef, {
            rootPath: root,
            taskId: 'CDX-200',
            existsSync,
            readFileSync,
        });

        assert.equal(okResult.ok, true);
        assert.deepEqual(okResult.errors, []);

        const incompleteRef = 'verification/codex-decisions/CDX-200-2.md';
        writeFileSync(
            join(root, incompleteRef),
            'problem: falta el resto\n',
            'utf8'
        );

        const incompleteResult = modelRouting.validateDecisionPacketFile(
            incompleteRef,
            {
                rootPath: root,
                taskId: 'CDX-200',
                existsSync,
                readFileSync,
            }
        );

        assert.equal(incompleteResult.ok, false);
        assert.equal(
            incompleteResult.missing_fields.includes('execution_mode'),
            true
        );
        assert.equal(
            incompleteResult.errors.some((error) =>
                /decision_packet incompleto/i.test(error)
            ),
            true
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('model-routing collectTaskModelRoutingErrors bloquea subagent sin root mini', () => {
    const root = createFixtureRoot();
    try {
        const decisionPacketRef = createDecisionPacket(root, 'CDX-250', 1);
        const errors = modelRouting.collectTaskModelRoutingErrors(
            {
                id: 'CDX-250',
                title: 'Task con root invalida',
                status: 'in_progress',
                risk: 'high',
                codex_instance: 'codex_backend_ops',
                model_tier_default: 'gpt-5.4-mini',
                premium_budget: 1,
                premium_calls_used: 1,
                premium_gate_state: 'consumed',
                decision_packet_ref: decisionPacketRef,
                model_policy_version: '2026-03-17-codex-model-routing-v2',
            },
            {
                ledgerEntries: [
                    {
                        task_id: 'CDX-250',
                        model_tier: 'gpt-5.4',
                        reason: 'critical_review',
                        decision_packet_ref: decisionPacketRef,
                        execution_mode: 'subagent',
                        budget_unit: 'premium_session',
                        premium_session_id: 'sess-250-1',
                        root_thread_model_tier: 'gpt-5.4',
                    },
                ],
                rootPath: root,
                existsSync,
                readFileSync,
            }
        );

        assert.equal(
            errors.some((error) =>
                /subagent requiere root_thread_model_tier=gpt-5\.4-mini/i.test(
                    error
                )
            ),
            true
        );
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('model-routing buildModelUsageSummary y buildPremiumRoi resumen ROI y blockers', () => {
    const root = createFixtureRoot();
    try {
        const decisionPacketRef = createDecisionPacket(root, 'CDX-301', 1);
        const tasks = [
            {
                id: 'CDX-301',
                title: 'High-risk tracked task',
                status: 'in_progress',
                risk: 'high',
                codex_instance: 'codex_backend_ops',
            },
            {
                id: 'CDX-302',
                title: 'Done tracked task',
                status: 'done',
                risk: 'low',
                codex_instance: 'codex_frontend',
            },
            {
                id: 'AG-001',
                title: 'Ignored AG task',
                status: 'in_progress',
                risk: 'high',
                codex_instance: 'codex_backend_ops',
            },
        ];
        const ledgerEntries = [
            {
                task_id: 'CDX-301',
                model_tier: 'gpt-5.4',
                reason: 'critical_review',
                decision_packet_ref: decisionPacketRef,
                execution_mode: 'subagent',
                budget_unit: 'premium_session',
                premium_session_id: 'sess-301-1',
                root_thread_model_tier: 'gpt-5.4-mini',
                avoided_rework: true,
            },
        ];
        modelRouting.syncTaskModelRoutingState(tasks[0], {
            ledgerEntries,
        });
        modelRouting.syncTaskModelRoutingState(tasks[1], {
            ledgerEntries,
        });

        const summary = modelRouting.buildModelUsageSummary(tasks, {
            ledgerEntries,
            rootPath: root,
            existsSync,
            readFileSync,
        });
        const roi = modelRouting.buildPremiumRoi(tasks, {
            ledgerEntries,
        });

        assert.equal(summary.codex_tasks_total, 2);
        assert.equal(summary.active_codex_tasks, 1);
        assert.equal(summary.premium_calls_total, 1);
        assert.equal(summary.premium_subagent_sessions_total, 1);
        assert.equal(summary.premium_root_exceptions_total, 0);
        assert.deepEqual(summary.premium_by_execution_mode, {
            subagent: 1,
            main_thread_exception: 0,
        });
        assert.equal(summary.mini_root_compliance_pct, 100);
        assert.equal(summary.tasks_zero_premium_pct, 50);
        assert.equal(summary.premium_budget_total_active, 1);
        assert.equal(summary.premium_budget_remaining_active, 0);
        assert.equal(summary.tasks_with_blockers, 0);
        assert.deepEqual(
            summary.by_lane.map((row) => row.codex_instance),
            ['codex_backend_ops', 'codex_frontend']
        );

        assert.equal(roi.premium_calls_total, 1);
        assert.equal(roi.premium_subagent_sessions_total, 1);
        assert.equal(roi.premium_root_exceptions_total, 0);
        assert.equal(roi.avoided_rework_calls, 1);
        assert.equal(roi.avoided_rework_rate_pct, 100);
        assert.equal(roi.mini_root_compliance_pct, 100);
        assert.equal(roi.tasks_zero_premium_pct, 50);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
