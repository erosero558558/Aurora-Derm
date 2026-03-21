#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const boardSync = require('../../tools/agent-orchestrator/domain/board-sync');

function buildBoard(tasks = []) {
    return {
        version: 1,
        policy: {
            revision: 0,
        },
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo',
                status: 'active',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_title: 'Admin operativo demostrable',
                focus_summary: 'Corte comun',
                focus_status: 'active',
                focus_proof: 'Demo comun',
                focus_steps: [
                    'admin_queue_pilot_cut',
                    'pilot_readiness_evidence',
                    'feedback_trim',
                ],
                focus_next_step: 'admin_queue_pilot_cut',
                focus_required_checks: [
                    'job:public_main_sync',
                    'runtime:operator_auth',
                ],
                focus_owner: 'ernesto',
                focus_review_due_at: '2026-03-21',
            },
        },
        tasks,
    };
}

function baseTask(overrides = {}) {
    return {
        id: 'AG-001',
        status: 'ready',
        focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
        focus_step: 'feedback_trim',
        integration_slice: 'backend_readiness',
        ...overrides,
    };
}

test('board-sync detecta ready future step como candidato normalizable', () => {
    const report = boardSync.buildBoardSyncReport(
        buildBoard([baseTask({ id: 'AG-254' })]),
        {
            nowIso: '2026-03-21T06:00:00.000Z',
        }
    );

    assert.equal(report.check_ok, false);
    assert.deepEqual(
        report.normalized_candidates.map((item) => item.task_id),
        ['AG-254']
    );
    assert.deepEqual(report.blocking_findings, []);
});

test('board-sync marca slot active fuera del next step como write blocker', () => {
    const report = boardSync.buildBoardSyncReport(
        buildBoard([
            baseTask({
                id: 'AG-258',
                status: 'in_progress',
                focus_step: 'feedback_trim',
                integration_slice: 'ops_deploy',
            }),
        ]),
        {
            nowIso: '2026-03-21T06:00:00.000Z',
        }
    );

    assert.equal(report.write_blocked, true);
    assert.equal(
        report.blocking_findings.some(
            (item) =>
                item.task_id === 'AG-258' &&
                item.code === 'task_outside_next_step' &&
                item.blocks_write === true
        ),
        true
    );
});

test('board-sync apply mueve future-ready a backlog y preserva blockers de lease', () => {
    const board = buildBoard([
        baseTask({ id: 'AG-254' }),
        baseTask({
            id: 'AG-258',
            status: 'in_progress',
            focus_step: 'admin_queue_pilot_cut',
            integration_slice: 'ops_deploy',
            lease_id: 'lease_AG_258_fixture',
            lease_owner: 'deck',
            lease_created_at: '2026-03-17T04:34:43.402Z',
            heartbeat_at: '2026-03-17T08:42:06.323Z',
            lease_expires_at: '2026-03-17T12:42:06.323Z',
        }),
    ]);

    const result = boardSync.applyBoardSync(board, {
        nowIso: '2026-03-21T06:00:00.000Z',
        currentDate: '2026-03-21',
    });

    assert.equal(result.ok, true);
    assert.equal(result.applied_total, 1);
    assert.deepEqual(result.applied_task_ids, ['AG-254']);
    assert.equal(board.tasks[0].status, 'backlog');
    assert.equal(
        result.blocking_findings.some(
            (item) =>
                item.task_id === 'AG-258' &&
                item.code === 'lease_expired_active'
        ),
        true
    );
});
