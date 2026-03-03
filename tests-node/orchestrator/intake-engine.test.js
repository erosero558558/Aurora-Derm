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

test('intake buildTaskFromSignal asigna codex para señal crítica con lane backend', () => {
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
    assert.equal(task.codex_instance, 'codex_backend_ops');
    assert.equal(task.domain_lane, 'backend_ops');
    assert.equal(task.lane_lock, 'strict');
    assert.equal(task.cross_domain, false);
    assert.equal(task.critical_zone, true);
    assert.equal(task.runtime_impact, 'high');
    assert.equal(task.source_ref, 'issue#279');
    assert.ok(Array.isArray(task.files));
    assert.ok(task.files.length > 0);
});

test('intake buildTaskFromSignal asigna codex_frontend para señales puramente frontend', () => {
    const task = intake.buildTaskFromSignal(
        {
            source: 'issue',
            source_ref: 'issue#301',
            title: 'Landing page copy regression',
            severity: 'medium',
            critical: false,
            runtime_impact: 'low',
        },
        {
            nowIso: '2026-02-25T10:00:00Z',
            owner: 'ernesto',
            files: ['templates/index.template.html', 'content/home/hero.md'],
        }
    );

    assert.equal(task.executor, 'codex');
    assert.equal(task.codex_instance, 'codex_frontend');
    assert.equal(task.domain_lane, 'frontend_content');
    assert.equal(task.lane_lock, 'strict');
    assert.equal(task.cross_domain, false);
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

test('intake inferWorkflowFileFromSignal mapea slugs extendidos de post-deploy y repair', () => {
    const postDeploy = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:post-deploy-gate-git-sync:main',
    });
    const repair = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:repair-git-sync-self-heal:main',
    });

    assert.equal(postDeploy, '.github/workflows/post-deploy-gate.yml');
    assert.equal(repair, '.github/workflows/repair-git-sync.yml');
});

test('intake inferWorkflowFileFromSignal mapea workflows activos codex-only', () => {
    const deployHosting = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:deploy-hosting:main',
    });
    const premiumQa = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:frontend-premium-qa:main',
    });
    const weeklyKpi = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:weekly-kpi-report:main',
    });

    assert.equal(deployHosting, '.github/workflows/deploy-hosting.yml');
    assert.equal(premiumQa, '.github/workflows/frontend-premium-qa.yml');
    assert.equal(weeklyKpi, '.github/workflows/weekly-kpi-report.yml');
});

test('intake inferWorkflowFileFromSignal ignora workflows retirados', () => {
    const legacyAutopilot = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:agent-kimi-autopilot:main',
    });
    const legacyJulesPr = intake.inferWorkflowFileFromSignal({
        source_ref: 'workflow:jules-pr:main',
    });

    assert.equal(legacyAutopilot, '');
    assert.equal(legacyJulesPr, '');
});

test('intake inferFilesFromSignal prioriza post-deploy sobre token generico git sync', () => {
    const files = intake.inferFilesFromSignal(
        {
            source: 'workflow',
            title: 'Post-Deploy Gate (Git Sync): failing run',
            labels: [],
        },
        'ops'
    );

    assert.deepEqual(files, ['.github/workflows/post-deploy-gate.yml']);
});

test('intake inferFilesFromSignal usa heuristicas de corpus para workflows activos', () => {
    const deployHostingFiles = intake.inferFilesFromSignal(
        {
            source: 'workflow',
            title: 'Deploy Hosting: production failed',
            labels: [],
        },
        'ops'
    );
    const premiumQaFiles = intake.inferFilesFromSignal(
        {
            source: 'workflow',
            title: 'Frontend Premium QA regression detected',
            labels: [],
        },
        'ops'
    );

    assert.deepEqual(deployHostingFiles, ['.github/workflows/deploy-hosting.yml']);
    assert.deepEqual(premiumQaFiles, ['.github/workflows/frontend-premium-qa.yml']);
});
