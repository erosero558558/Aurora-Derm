#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'prod-monitor.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('prod-monitor workflow expone inputs de service priorities', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const requiredInputs = [
        'allow_degraded_service_priorities',
        'min_service_priorities_services',
        'min_service_priorities_categories',
        'min_service_priorities_featured',
        'require_service_priorities_funnel',
    ];

    for (const inputKey of requiredInputs) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputKey),
            true,
            `falta input workflow_dispatch: ${inputKey}`
        );
    }
});

test('prod-monitor workflow propaga env de service priorities a monitor script', () => {
    const { raw } = loadWorkflow();
    const requiredEnvRefs = [
        'ALLOW_DEGRADED_SERVICE_PRIORITIES',
        'MIN_SERVICE_PRIORITIES_SERVICES',
        'MIN_SERVICE_PRIORITIES_CATEGORIES',
        'MIN_SERVICE_PRIORITIES_FEATURED',
        'REQUIRE_SERVICE_PRIORITIES_FUNNEL',
        '$monitorArgs.AllowDegradedServicePriorities = $true',
        '$monitorArgs.RequireServicePrioritiesFunnel = $true',
        '$monitorArgs.MinServicePrioritiesServices = $minServices',
        '$monitorArgs.MinServicePrioritiesCategories = $minCategories',
        '$monitorArgs.MinServicePrioritiesFeatured = $minFeatured',
    ];

    for (const snippet of requiredEnvRefs) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de service priorities en workflow: ${snippet}`
        );
    }
});

test('prod-monitor workflow publica parametros de service priorities en summary', () => {
    const { raw } = loadWorkflow();
    const requiredSummaryLines = [
        '- allow_degraded_service_priorities: ``$env:ALLOW_DEGRADED_SERVICE_PRIORITIES``',
        '- min_service_priorities_services: ``$env:MIN_SERVICE_PRIORITIES_SERVICES``',
        '- min_service_priorities_categories: ``$env:MIN_SERVICE_PRIORITIES_CATEGORIES``',
        '- min_service_priorities_featured: ``$env:MIN_SERVICE_PRIORITIES_FEATURED``',
        '- require_service_priorities_funnel: ``$env:REQUIRE_SERVICE_PRIORITIES_FUNNEL``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary: ${snippet}`
        );
    }
});

test('prod-monitor workflow expone inputs de monitoreo post-cutover publico', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const requiredInputs = [
        'enable_public_cutover_monitor',
        'public_cutover_started_at',
        'public_cutover_window_hours',
    ];

    for (const inputKey of requiredInputs) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputKey),
            true,
            `falta input workflow_dispatch: ${inputKey}`
        );
    }
});

test('prod-monitor workflow cablea ventana y smoke post-cutover publico', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));
    const requiredSnippets = [
        'ENABLE_PUBLIC_CUTOVER_MONITOR',
        'PUBLIC_CUTOVER_STARTED_AT',
        'PUBLIC_CUTOVER_WINDOW_HOURS',
        'PUBLIC_CUTOVER_WINDOW_ACTIVE',
        'PUBLIC_CUTOVER_WINDOW_REASON',
        'PUBLIC_CUTOVER_ELAPSED_HOURS',
        'node bin/check-public-routing-smoke.js --base-url "${TARGET_DOMAIN}" --label "prod-monitor-cutover-routing" --output ".public-cutover-monitor/routing-smoke.json"',
        'node bin/check-public-conversion-smoke.js --base-url "${TARGET_DOMAIN}" --label "prod-monitor-cutover-conversion" --output ".public-cutover-monitor/conversion-smoke.json"',
        'public-cutover-monitor-evidence',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring post-cutover en workflow: ${snippet}`
        );
    }

    for (const expectedStepName of [
        'Evaluar ventana post-cutover publico',
        'Setup Node para smoke publico post-cutover',
        'Validar routing + conversion publica post-cutover (ES/EN)',
        'Upload public cutover monitor evidence',
        'Crear/actualizar incidente post-cutover publico (solo schedule)',
        'Cerrar incidente post-cutover al recuperar (solo schedule)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step post-cutover: ${expectedStepName}`
        );
    }

    assert.equal(
        raw.includes("'[ALERTA PROD] Monitor post-cutover publico degradado'"),
        true,
        'falta titulo de incidente post-cutover'
    );
});

test('prod-monitor workflow publica estado de cutover en summary', () => {
    const { raw } = loadWorkflow();
    const requiredSummaryLines = [
        '- enable_public_cutover_monitor: ``$env:ENABLE_PUBLIC_CUTOVER_MONITOR``',
        '- public_cutover_started_at: ``$env:PUBLIC_CUTOVER_STARTED_AT``',
        '- public_cutover_window_hours: ``$env:PUBLIC_CUTOVER_WINDOW_HOURS``',
        '- public_cutover_window_active: ``$env:PUBLIC_CUTOVER_WINDOW_ACTIVE`` (reason ``$env:PUBLIC_CUTOVER_WINDOW_REASON``)',
        '- public_cutover_elapsed_hours: ``$env:PUBLIC_CUTOVER_ELAPSED_HOURS``',
        '- public_cutover_step_outcome: ``${{ steps.public_cutover.outcome }}``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary post-cutover: ${snippet}`
        );
    }
});
