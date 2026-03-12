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

test('prod-monitor workflow expone inputs de guardrails telemedicina', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const requiredInputs = [
        'allow_degraded_telemedicine_diagnostics',
        'require_telemedicine_configured',
        'max_telemedicine_review_queue',
        'max_telemedicine_staged_uploads',
        'max_telemedicine_unlinked_intakes',
    ];

    for (const inputKey of requiredInputs) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputKey),
            true,
            `falta input workflow_dispatch: ${inputKey}`
        );
    }
});

test('prod-monitor workflow propaga env de telemedicina a monitor script', () => {
    const { raw } = loadWorkflow();
    const requiredEnvRefs = [
        'ALLOW_DEGRADED_TELEMEDICINE_DIAGNOSTICS',
        'REQUIRE_TELEMEDICINE_CONFIGURED',
        'MAX_TELEMEDICINE_REVIEW_QUEUE',
        'MAX_TELEMEDICINE_STAGED_UPLOADS',
        'MAX_TELEMEDICINE_UNLINKED_INTAKES',
        '$monitorArgs.AllowDegradedTelemedicineDiagnostics = $true',
        '$monitorArgs.RequireTelemedicineConfigured = $false',
        '$monitorArgs.MaxTelemedicineReviewQueue = $maxTelemedicineReviewQueue',
        '$monitorArgs.MaxTelemedicineStagedUploads = $maxTelemedicineStagedUploads',
        '$monitorArgs.MaxTelemedicineUnlinkedIntakes = $maxTelemedicineUnlinkedIntakes',
    ];

    for (const snippet of requiredEnvRefs) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de telemedicina en workflow: ${snippet}`
        );
    }
});

test('prod-monitor workflow publica parametros de telemedicina en summary', () => {
    const { raw } = loadWorkflow();
    const requiredSummaryLines = [
        '- allow_degraded_telemedicine_diagnostics: ``$env:ALLOW_DEGRADED_TELEMEDICINE_DIAGNOSTICS``',
        '- require_telemedicine_configured: ``$env:REQUIRE_TELEMEDICINE_CONFIGURED``',
        '- max_telemedicine_review_queue: ``$env:MAX_TELEMEDICINE_REVIEW_QUEUE``',
        '- max_telemedicine_staged_uploads: ``$env:MAX_TELEMEDICINE_STAGED_UPLOADS``',
        '- max_telemedicine_unlinked_intakes: ``$env:MAX_TELEMEDICINE_UNLINKED_INTAKES``',
        '- telemedicine_monitor_status: ``$env:TELEMEDICINE_MONITOR_STATUS``',
        '- telemedicine_monitor_reason: ``$env:TELEMEDICINE_MONITOR_REASON``',
        '- telemedicine_monitor_non_tele_failures: ``$env:TELEMEDICINE_MONITOR_NON_TELE_FAILURES``',
        '- telemedicine_monitor_step_outcome: ``${{ steps.telemedicine_monitor.outcome }}``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary telemedicina: ${snippet}`
        );
    }
});

test('prod-monitor workflow maneja incidente dedicado de telemedicina', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Evaluar estado telemedicina para incidente dedicado',
        'Crear/actualizar incidente telemedicina (solo schedule)',
        'Cerrar incidente telemedicina al recuperar (solo schedule)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step telemedicina: ${expectedStepName}`
        );
    }

    const requiredSnippets = [
        'TELEMEDICINE_MONITOR_STATUS',
        'TELEMEDICINE_MONITOR_REASON',
        'TELEMEDICINE_MONITOR_NON_TELE_FAILURES',
        "((env.TELEMEDICINE_MONITOR_STATUS != 'failed' && env.TELEMEDICINE_MONITOR_STATUS != 'unknown') || env.TELEMEDICINE_MONITOR_NON_TELE_FAILURES != '0')",
        "(env.TELEMEDICINE_MONITOR_STATUS == 'failed' || env.TELEMEDICINE_MONITOR_STATUS == 'unknown')",
        "'[ALERTA PROD] Monitor telemedicina degradado'",
        'prod-monitor-telemedicine-signal:',
        "non_tele:${process.env.TELEMEDICINE_MONITOR_NON_TELE_FAILURES || '0'}",
        "telemedicine_monitor_non_tele_failures: ${process.env.TELEMEDICINE_MONITOR_NON_TELE_FAILURES || '0'}",
        "baseLabels = ['production-alert', 'telemedicine', 'prod-monitor', severity]",
        'severity:critical',
        'severity:warning',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de incidente telemedicina en workflow: ${snippet}`
        );
    }
});

test('prod-monitor workflow cierra alertas stale de deploy cuando public sync se recupera', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Evaluar recuperacion public sync para alertas stale de deploy',
        'Cerrar alertas stale de deploy al recuperar public sync',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de recuperacion public sync en prod-monitor: ${expectedStepName}`
        );
    }

    const requiredSnippets = [
        'PUBLIC_SYNC_RECOVERY_STATUS: not_evaluated',
        'PUBLIC_SYNC_RECOVERY_REASON: not_evaluated',
        "PUBLIC_SYNC_CURRENT_HEAD: ''",
        "PUBLIC_SYNC_REMOTE_HEAD: ''",
        "PUBLIC_SYNC_DIRTY_PATHS_COUNT: '0'",
        'PielArmoniaPublicSyncRecovery/1.0',
        "if: ${{ always() && (github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && env.TARGET_DOMAIN == 'https://pielarmonia.com')) && steps.public_sync_recovery.outputs.status == 'healthy' }}",
        "'[ALERTA PROD] Deploy Hosting transporte bloqueado desde GitHub Runner'",
        "'[ALERTA PROD] Diagnose host connectivity sin ruta de deploy'",
        "'[ALERTA PROD] Repair git sync self-hosted fallback sin runner'",
        'Cerrado automaticamente por monitor programado al confirmar `public_main_sync` saludable.',
        'Issue stale de deploy cerrado',
        'public sync recovery => status=$status reason=$reason current_head=$currentHead remote_head=$remoteHead dirty_paths_count=$dirtyPathsCount',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de recuperacion public sync en prod-monitor: ${snippet}`
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

    const requiredStepNames = [
        'Evaluar ventana post-cutover publico',
        'Validar routing + conversion publica post-cutover (ES/EN)',
        'Upload public cutover monitor evidence',
        'Crear/actualizar incidente post-cutover publico (solo schedule)',
        'Cerrar incidente post-cutover al recuperar (solo schedule)',
    ];

    for (const expectedStepName of requiredStepNames) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step post-cutover: ${expectedStepName}`
        );
    }

    assert.equal(
        stepNames.some(
            (name) =>
                name === 'Setup Node para smoke publico post-cutover' ||
                name === 'Setup Node para smoke/gates publicos'
        ),
        true,
        'falta step de setup node para checks publicos'
    );

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

test('prod-monitor workflow expone inputs de gate rollout V4', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const requiredInputs = [
        'enable_public_v4_rollout_monitor',
        'public_v4_rollout_stage',
        'public_v4_rollout_surface_test',
        'public_v4_rollout_surface_control',
        'public_v4_rollout_min_view_booking',
        'public_v4_rollout_min_start_checkout',
        'public_v4_rollout_max_confirmed_drop_pp',
        'public_v4_rollout_min_confirmed_rate_pct',
        'public_v4_rollout_allow_missing_control',
    ];

    for (const inputKey of requiredInputs) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputKey),
            true,
            `falta input workflow_dispatch: ${inputKey}`
        );
    }
});

test('prod-monitor workflow cablea script y artefacto de gate rollout V4', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));
    const requiredSnippets = [
        'ENABLE_PUBLIC_V4_ROLLOUT_MONITOR',
        'ENABLE_PUBLIC_V4_ROLLOUT_MONITOR_EFFECTIVE',
        'PUBLIC_V4_ROLLOUT_STAGE',
        'PUBLIC_V4_ROLLOUT_STAGE_EFFECTIVE',
        'PUBLIC_V4_ROLLOUT_STAGE_PROFILE_EFFECTIVE',
        'PUBLIC_V4_ROLLOUT_POLICY_SOURCE_EFFECTIVE',
        'PUBLIC_V4_ROLLOUT_SURFACE_TEST',
        'PUBLIC_V4_ROLLOUT_SURFACE_CONTROL',
        'PUBLIC_V4_ROLLOUT_MIN_VIEW_BOOKING',
        'PUBLIC_V4_ROLLOUT_MIN_START_CHECKOUT',
        'PUBLIC_V4_ROLLOUT_MAX_CONFIRMED_DROP_PP',
        'PUBLIC_V4_ROLLOUT_MIN_CONFIRMED_RATE_PCT',
        'PUBLIC_V4_ROLLOUT_ALLOW_MISSING_CONTROL',
        'node ./bin/resolve-public-v4-rollout-policy.js',
        '--stage "$env:PUBLIC_V4_ROLLOUT_STAGE"',
        '--default-stage canary',
        'node bin/run-public-v4-rollout-gate.js',
        '--surface-test "${PUBLIC_V4_ROLLOUT_SURFACE_TEST_EFFECTIVE}"',
        '--surface-control "${PUBLIC_V4_ROLLOUT_SURFACE_CONTROL_EFFECTIVE}"',
        'public-v4-rollout-monitor-evidence',
        'rollout-gate.json',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring rollout V4 en workflow: ${snippet}`
        );
    }

    for (const expectedStepName of [
        'Resolver politica rollout publico V4',
        'Validar rollout publico V4 (A/B + kill-switch readiness)',
        'Upload public V4 rollout evidence',
        'Crear/actualizar incidente rollout publico V4 (solo schedule)',
        'Cerrar incidente rollout V4 al recuperar (solo schedule)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step rollout V4: ${expectedStepName}`
        );
    }

    assert.equal(
        raw.includes("'[ALERTA PROD] Monitor rollout publico V4 degradado'"),
        true,
        'falta titulo de incidente rollout V4'
    );
});

test('prod-monitor workflow publica parametros y outcome de rollout V4 en summary', () => {
    const { raw } = loadWorkflow();
    const requiredSummaryLines = [
        '- enable_public_v4_rollout_monitor: ``$env:ENABLE_PUBLIC_V4_ROLLOUT_MONITOR``',
        '- public_v4_rollout_stage: ``$env:PUBLIC_V4_ROLLOUT_STAGE``',
        '- public_v4_rollout_surface_test: ``$env:PUBLIC_V4_ROLLOUT_SURFACE_TEST``',
        '- public_v4_rollout_surface_control: ``$env:PUBLIC_V4_ROLLOUT_SURFACE_CONTROL``',
        '- public_v4_rollout_min_view_booking: ``$env:PUBLIC_V4_ROLLOUT_MIN_VIEW_BOOKING``',
        '- public_v4_rollout_min_start_checkout: ``$env:PUBLIC_V4_ROLLOUT_MIN_START_CHECKOUT``',
        '- public_v4_rollout_max_confirmed_drop_pp: ``$env:PUBLIC_V4_ROLLOUT_MAX_CONFIRMED_DROP_PP``',
        '- public_v4_rollout_min_confirmed_rate_pct: ``$env:PUBLIC_V4_ROLLOUT_MIN_CONFIRMED_RATE_PCT``',
        '- public_v4_rollout_allow_missing_control: ``$env:PUBLIC_V4_ROLLOUT_ALLOW_MISSING_CONTROL``',
        '- enable_public_v4_rollout_monitor_effective: ``$env:ENABLE_PUBLIC_V4_ROLLOUT_MONITOR_EFFECTIVE``',
        '- public_v4_rollout_stage_effective: ``$env:PUBLIC_V4_ROLLOUT_STAGE_EFFECTIVE``',
        '- public_v4_rollout_stage_profile_effective: ``$env:PUBLIC_V4_ROLLOUT_STAGE_PROFILE_EFFECTIVE``',
        '- public_v4_rollout_policy_source_effective: ``$env:PUBLIC_V4_ROLLOUT_POLICY_SOURCE_EFFECTIVE``',
        '- public_v4_rollout_surface_test_effective: ``$env:PUBLIC_V4_ROLLOUT_SURFACE_TEST_EFFECTIVE``',
        '- public_v4_rollout_surface_control_effective: ``$env:PUBLIC_V4_ROLLOUT_SURFACE_CONTROL_EFFECTIVE``',
        '- public_v4_rollout_min_view_booking_effective: ``$env:PUBLIC_V4_ROLLOUT_MIN_VIEW_BOOKING_EFFECTIVE``',
        '- public_v4_rollout_min_start_checkout_effective: ``$env:PUBLIC_V4_ROLLOUT_MIN_START_CHECKOUT_EFFECTIVE``',
        '- public_v4_rollout_max_confirmed_drop_pp_effective: ``$env:PUBLIC_V4_ROLLOUT_MAX_CONFIRMED_DROP_PP_EFFECTIVE``',
        '- public_v4_rollout_min_confirmed_rate_pct_effective: ``$env:PUBLIC_V4_ROLLOUT_MIN_CONFIRMED_RATE_PCT_EFFECTIVE``',
        '- public_v4_rollout_allow_missing_control_effective: ``$env:PUBLIC_V4_ROLLOUT_ALLOW_MISSING_CONTROL_EFFECTIVE``',
        '- public_v4_rollout_step_outcome: ``${{ steps.public_v4_rollout.outcome }}``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary rollout V4: ${snippet}`
        );
    }
});

test('prod-monitor workflow publica recuperacion public sync en summary', () => {
    const { raw } = loadWorkflow();
    const requiredSummaryLines = [
        '- public_sync_recovery_status: ``$env:PUBLIC_SYNC_RECOVERY_STATUS``',
        '- public_sync_recovery_reason: ``$env:PUBLIC_SYNC_RECOVERY_REASON``',
        '- public_sync_current_head: ``$env:PUBLIC_SYNC_CURRENT_HEAD``',
        '- public_sync_remote_head: ``$env:PUBLIC_SYNC_REMOTE_HEAD``',
        '- public_sync_dirty_paths_count: ``$env:PUBLIC_SYNC_DIRTY_PATHS_COUNT``',
        '- public_sync_recovery_step_outcome: ``${{ steps.public_sync_recovery.outcome }}``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary de recuperacion public sync: ${snippet}`
        );
    }
});
