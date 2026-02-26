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
        'fail_on_invalid_thresholds',
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
        'max_report_age_hours',
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
        'WEEKLY_KPI_FAIL_ON_INVALID_THRESHOLDS',
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
        'WEEKLY_KPI_MAX_REPORT_AGE_HOURS',
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
        'effective_fail_on_invalid_thresholds',
        'effective_retention_days',
        'effective_core_p95_max_ms',
        'effective_figo_post_p95_max_ms',
        'effective_max_report_age_hours',
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
        'threshold_warnings_count',
        'threshold_warnings_list',
    ];

    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`steps.run_report.outputs.${outputKey}`),
            true,
            `falta output efectivo en summary/incidente: ${outputKey}`
        );
    }
});

test('weekly-kpi workflow separa incidentes general, SLA y retencion', () => {
    const { raw } = loadWorkflow();

    const requiredSnippets = [
        'Crear/actualizar incidente semanal general',
        "steps.report.outputs.general_incident_required == 'true'",
        '[ALERTA PROD] Weekly KPI report con warnings',
        'weekly-general-signal:',
        'Issue general ya refleja la misma senal',
        "steps.report.outputs.general_incident_recovered == 'true'",
        'Crear/actualizar incidente semanal de SLA operativo',
        "steps.ops_sla.outputs.ops_sla_degraded == 'true'",
        '[ALERTA PROD] Weekly KPI SLA operativo degradado',
        'weekly-sla-signal:',
        'Issue de SLA operativo ya refleja la misma senal',
        "steps.ops_sla.outputs.ops_sla_recovered == 'true'",
        'Crear/actualizar incidente semanal de retencion',
        "steps.report.outputs.retention_incident_required == 'true'",
        '[ALERTA PROD] Weekly KPI retencion degradada',
        'retention-signal:',
        'Issue de retencion ya refleja la misma senal',
        "steps.report.outputs.retention_incident_recovered == 'true'",
        'general_incident_reason_codes',
        'retention_incident_reason_codes',
        'ops_sla_failure_axes',
        "retentionIncidentRecovered = if ($retentionAlertCountInt -eq 0 -and $reportStale -ne 'true')",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta evidencia de separacion de incidente: ${snippet}`
        );
    }
});

test('weekly-kpi workflow expone outputs normalizados para semaforo general y SLA', () => {
    const { raw } = loadWorkflow();
    const requiredOutputs = [
        'warnings_critical_count_int',
        'warnings_alert_data_valid',
        'report_generated_at_utc',
        'report_age_hours',
        'report_stale',
        'general_incident_required',
        'general_incident_recovered',
        'general_incident_reason_codes',
        'general_signal_key',
        'ops_sla_degraded',
        'ops_sla_recovered',
        'ops_sla_failure_axes',
        'ops_sla_signal_key',
    ];
    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`"${outputKey}=`) ||
                raw.includes(`core.setOutput('${outputKey}'`),
            true,
            `falta output normalizado general/SLA: ${outputKey}`
        );
    }
});

test('weekly-kpi workflow expone outputs normalizados para semaforo de retencion', () => {
    const { raw } = loadWorkflow();
    const requiredOutputs = [
        'retention_report_alert_count_int',
        'retention_alert_data_valid',
        'retention_incident_required',
        'retention_incident_recovered',
        'retention_incident_reason_codes',
        'retention_signal_key',
    ];
    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`"${outputKey}=`),
            true,
            `falta output normalizado de retencion: ${outputKey}`
        );
    }
});
