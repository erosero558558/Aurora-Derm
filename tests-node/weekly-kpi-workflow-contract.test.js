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
        'fail_on_cycle_not_ready',
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
        'cycle_target_weeks',
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
        'WEEKLY_KPI_FAIL_ON_CYCLE_NOT_READY',
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
        'WEEKLY_KPI_CYCLE_TARGET_WEEKS',
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
        'effective_fail_on_cycle_not_ready',
        'effective_fail_on_invalid_thresholds',
        'effective_retention_days',
        'effective_core_p95_max_ms',
        'effective_figo_post_p95_max_ms',
        'effective_max_report_age_hours',
        'effective_cycle_target_weeks',
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

test('weekly-kpi workflow separa incidentes general, SLA, retencion y telemedicina', () => {
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
        'Crear/actualizar incidente semanal de service funnel',
        "steps.report.outputs.service_funnel_incident_required == 'true'",
        '[ALERTA PROD] Weekly KPI service funnel degradado',
        'service-funnel-signal:',
        'Issue de service funnel ya refleja la misma senal',
        "steps.report.outputs.service_funnel_incident_recovered == 'true'",
        'Crear/actualizar incidente semanal de services catalog',
        "steps.report.outputs.services_catalog_incident_required == 'true'",
        '[ALERTA PROD] Weekly KPI services catalog degradado',
        'services-catalog-signal:',
        'Issue de services catalog ya refleja la misma senal',
        "steps.report.outputs.services_catalog_incident_recovered == 'true'",
        'Crear/actualizar incidente semanal de service priorities',
        "steps.report.outputs.service_priorities_incident_required == 'true'",
        '[ALERTA PROD] Weekly KPI service priorities degradado',
        'service-priorities-signal:',
        'Issue de service priorities ya refleja la misma senal',
        "steps.report.outputs.service_priorities_incident_recovered == 'true'",
        'Crear/actualizar incidente semanal de telemedicina',
        "steps.report.outputs.telemedicine_incident_required == 'true'",
        "steps.report.outputs.telemedicine_weekly_status == 'degraded_only' || steps.report.outputs.telemedicine_weekly_status == 'degraded_mixed' || steps.report.outputs.telemedicine_weekly_status == 'unknown'",
        '[ALERTA PROD] Weekly KPI telemedicina degradada',
        'weekly-telemedicine-signal:',
        'Issue de telemedicina semanal ya refleja la misma senal',
        "steps.report.outputs.telemedicine_incident_recovered == 'true'",
        "((steps.report.outputs.telemedicine_weekly_status != 'degraded_only' && steps.report.outputs.telemedicine_weekly_status != 'unknown') || steps.report.outputs.telemedicine_weekly_non_tele_failures != '0')",
        'telemedicine_signal_key=status:unknown|reason:report_missing|failures:-1|non_tele:-1|reasons:report_missing,telemedicine_warning_invalid|stale:true',
        'status:$telemedicineWeeklyStatus|reason:$telemedicineWeeklyReason|failures:$telemedicineWarningCountInt|non_tele:$telemedicineNonTeleWarningCountInt|reasons:$telemedicineIncidentReasonCodes|stale:$reportStale',
        'telemedicine_weekly_non_tele_failures: ${{ steps.report.outputs.telemedicine_weekly_non_tele_failures }}',
        'general_incident_reason_codes',
        'general_incident_severity',
        'retention_incident_reason_codes',
        'retention_incident_severity',
        'service_funnel_incident_reason_codes',
        'service_funnel_incident_severity',
        'services_catalog_incident_reason_codes',
        'services_catalog_incident_severity',
        'service_priorities_incident_reason_codes',
        'service_priorities_incident_severity',
        'telemedicine_incident_reason_codes',
        'telemedicine_incident_severity',
        'ops_sla_failure_axes',
        'ops_sla_severity',
        'severity:critical',
        'severity:warning',
        'actualizo labels de severidad',
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
        'weekly_cycle_target',
        'weekly_cycle_consecutive_no_critical',
        'weekly_cycle_ready',
        'weekly_cycle_status',
        'weekly_cycle_reason',
        'weekly_cycle_last_critical_generated_at',
        'recovery_cycle_id',
        'recovery_cycle_status',
        'recovery_cycle_freeze_active',
        'recovery_cycle_allowed_slice',
        'recovery_cycle_weekly_ready',
        'recovery_cycle_pilot_recommendation_eligible',
        'report_generated_at_utc',
        'report_age_hours',
        'report_stale',
        'general_incident_required',
        'general_incident_recovered',
        'general_incident_reason_codes',
        'general_incident_severity',
        'general_signal_key',
        'ops_sla_degraded',
        'ops_sla_recovered',
        'ops_sla_failure_axes',
        'ops_sla_severity',
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

test('weekly-kpi workflow publica recovery cycle en el step summary', () => {
    const { raw } = loadWorkflow();
    const requiredSnippets = [
        'steps.report.outputs.recovery_cycle_id',
        'steps.report.outputs.recovery_cycle_status',
        'steps.report.outputs.recovery_cycle_freeze_active',
        'steps.report.outputs.recovery_cycle_allowed_slice',
        'steps.report.outputs.recovery_cycle_weekly_ready',
        'steps.report.outputs.recovery_cycle_pilot_recommendation_eligible',
        'recovery_cycle_id: ',
        'recovery_cycle_status: ',
        'recovery_cycle_allowed_slice: ',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de recovery cycle en weekly-kpi-report.yml: ${snippet}`
        );
    }
});

test('weekly-kpi workflow expone outputs normalizados para semaforo semanal de telemedicina', () => {
    const { raw } = loadWorkflow();
    const requiredOutputs = [
        'telemedicine_warning_codes',
        'telemedicine_warning_count_int',
        'telemedicine_warning_critical_count_int',
        'telemedicine_warning_non_critical_count_int',
        'telemedicine_warning_data_valid',
        'telemedicine_incident_required',
        'telemedicine_incident_recovered',
        'telemedicine_incident_reason_codes',
        'telemedicine_incident_severity',
        'telemedicine_signal_key',
        'telemedicine_weekly_status',
        'telemedicine_weekly_reason',
        'telemedicine_weekly_failures',
        'telemedicine_weekly_non_tele_failures',
    ];
    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`"${outputKey}=`),
            true,
            `falta output normalizado de telemedicina semanal: ${outputKey}`
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
        'retention_incident_severity',
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

test('weekly-kpi workflow expone outputs normalizados para service funnel y services catalog', () => {
    const { raw } = loadWorkflow();
    const requiredOutputs = [
        'service_funnel_alert_count_int',
        'service_funnel_alert_data_valid',
        'service_funnel_incident_required',
        'service_funnel_incident_recovered',
        'service_funnel_incident_reason_codes',
        'service_funnel_incident_severity',
        'service_funnel_signal_key',
        'services_catalog_count_int',
        'services_catalog_data_valid',
        'services_catalog_incident_required',
        'services_catalog_incident_recovered',
        'services_catalog_incident_reason_codes',
        'services_catalog_incident_severity',
        'services_catalog_signal_key',
        'service_priorities_services_count_int',
        'service_priorities_categories_count_int',
        'service_priorities_featured_count_int',
        'service_priorities_data_valid',
        'service_priorities_incident_required',
        'service_priorities_incident_recovered',
        'service_priorities_incident_reason_codes',
        'service_priorities_incident_severity',
        'service_priorities_signal_key',
    ];
    for (const outputKey of requiredOutputs) {
        assert.equal(
            raw.includes(`"${outputKey}=`),
            true,
            `falta output normalizado de service funnel/services catalog: ${outputKey}`
        );
    }
});
