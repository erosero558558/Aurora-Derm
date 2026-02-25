#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const intake = require('../../tools/agent-orchestrator/domain/intake');

test('intake mergeSignals deduplica por fingerprint', () => {
    const existing = [
        {
            id: 'SIG-001',
            fingerprint: 'issue:issue#1',
            source: 'issue',
            source_ref: 'issue#1',
            title: 'Old title',
            severity: 'medium',
            critical: false,
            status: 'open',
            runtime_impact: 'low',
            url: '',
            detected_at: '2026-02-25T00:00:00Z',
            updated_at: '2026-02-25T00:00:00Z',
            labels: ['ops'],
        },
    ];

    const incoming = [
        {
            source: 'issue',
            source_ref: 'issue#1',
            title: 'New title',
            status: 'open',
            labels: ['prod-alert'],
        },
    ];

    const merged = intake.mergeSignals(existing, incoming, {
        nowIso: '2026-02-25T10:00:00Z',
    });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, 'New title');
    assert.ok(merged[0].labels.includes('ops'));
    assert.ok(merged[0].labels.includes('prod-alert'));
});

test('intake buildTaskFromSignal asigna codex para señal crítica', () => {
    const task = intake.buildTaskFromSignal(
        {
            source: 'issue',
            source_ref: 'issue#279',
            title: '[ALERTA PROD] Monitor de produccion fallando',
            severity: 'critical',
            critical: true,
            runtime_impact: 'high',
        },
        { nowIso: '2026-02-25T10:00:00Z', owner: 'ernesto' }
    );

    assert.equal(task.executor, 'codex');
    assert.equal(task.critical_zone, true);
    assert.equal(task.runtime_impact, 'high');
    assert.equal(task.source_ref, 'issue#279');
    assert.ok(Array.isArray(task.files));
    assert.ok(task.files.length > 0);
});

test('intake normalizeTaskForScoring escala a codex tras 2 intentos', () => {
    const task = intake.normalizeTaskForScoring(
        {
            id: 'AG-200',
            executor: 'kimi',
            status: 'failed',
            attempts: 2,
            risk: 'medium',
            runtime_impact: 'low',
            critical_zone: false,
            updated_at: '2026-02-24',
        },
        { nowTs: Date.parse('2026-02-25T10:00:00Z') }
    );

    assert.equal(task.executor, 'codex');
    assert.equal(task.blocked_reason, 'auto_escalated_after_retries');
    assert.equal(typeof task.priority_score, 'number');
    assert.ok(task.priority_score >= 0 && task.priority_score <= 100);
});

test('intake inferWorkflowFileFromSignal mapea agent-governance al workflow correcto', () => {
    const files = intake.inferFilesFromSignal(
        {
            source: 'workflow',
            source_ref: 'workflow:agent-governance:main',
            title: 'Agent Governance: failing run',
            labels: ['workflow:Agent Governance'],
        },
        'ops'
    );

    assert.deepEqual(files, ['.github/workflows/agent-governance.yml']);
});
