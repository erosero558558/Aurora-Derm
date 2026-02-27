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
        '$monitorArgs.AllowDegradedServicePriorities = $true',
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
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary: ${snippet}`
        );
    }
});
