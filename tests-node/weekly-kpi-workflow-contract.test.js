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
    'weekly-kpi-report.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('weekly-kpi workflow expone inputs de umbrales esperados', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    const requiredInputs = [
        'retention_days',
        'no_show_warn_pct',
        'recurrence_min_warn_pct',
        'recurrence_drop_warn_pct',
        'recurrence_min_unique_patients',
        'idempotency_conflict_warn_pct',
        'conversion_min_warn_pct',
        'conversion_drop_warn_pct',
        'conversion_min_start_checkout',
        'start_checkout_min_warn_pct',
        'start_checkout_drop_warn_pct',
        'start_checkout_min_view_booking',
        'core_p95_max_ms',
        'figo_post_p95_max_ms',
    ];

    for (const inputKey of requiredInputs) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputKey),
            true,
            `falta input workflow_dispatch: ${inputKey}`
        );
    }
});

test('weekly-kpi workflow mantiene fallback por vars WEEKLY_KPI_*', () => {
    const { raw } = loadWorkflow();
    const requiredVars = [
        'WEEKLY_KPI_RETENTION_DAYS',
        'WEEKLY_KPI_NO_SHOW_WARN_PCT',
        'WEEKLY_KPI_RECURRENCE_MIN_WARN_PCT',
        'WEEKLY_KPI_RECURRENCE_DROP_WARN_PCT',
        'WEEKLY_KPI_RECURRENCE_MIN_UNIQUE_PATIENTS',
        'WEEKLY_KPI_IDEMPOTENCY_CONFLICT_WARN_PCT',
        'WEEKLY_KPI_CONVERSION_MIN_WARN_PCT',
        'WEEKLY_KPI_CONVERSION_DROP_WARN_PCT',
        'WEEKLY_KPI_CONVERSION_MIN_START_CHECKOUT',
        'WEEKLY_KPI_START_CHECKOUT_MIN_WARN_PCT',
        'WEEKLY_KPI_START_CHECKOUT_DROP_WARN_PCT',
        'WEEKLY_KPI_START_CHECKOUT_MIN_VIEW_BOOKING',
        'WEEKLY_KPI_CORE_P95_MAX_MS',
        'WEEKLY_KPI_FIGO_POST_P95_MAX_MS',
    ];

    for (const envKey of requiredVars) {
        assert.equal(
            raw.includes(`vars.${envKey}`),
            true,
            `falta fallback por variable: ${envKey}`
        );
    }
});

test('weekly-kpi workflow publica thresholds efectivos en resumen', () => {
    const { raw } = loadWorkflow();
    const requiredOutputs = [
        'effective_retention_days',
        'effective_core_p95_max_ms',
        'effective_figo_post_p95_max_ms',
        'effective_no_show_warn_pct',
        'effective_recurrence_min_warn_pct',
        'effective_recurrence_drop_warn_pct',
        'effective_recurrence_min_unique_patients',
        'effective_idempotency_conflict_warn_pct',
        'effective_conversion_min_warn_pct',
        'effective_conversion_drop_warn_pct',
        'effective_conversion_min_start_checkout',
        'effective_start_checkout_min_warn_pct',
        'effective_start_checkout_drop_warn_pct',
        'effective_start_checkout_min_view_booking',
    ];

    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`steps.run_report.outputs.${outputKey}`),
            true,
            `falta output efectivo en summary/incidente: ${outputKey}`
        );
    }
});
