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
        '- allow_degraded_service_priorities: ``$($report.workflow.monitor.inputs.allowDegradedServicePriorities)``',
        '- min_service_priorities_services: ``$($report.workflow.monitor.inputs.minServicePrioritiesServices)``',
        '- min_service_priorities_categories: ``$($report.workflow.monitor.inputs.minServicePrioritiesCategories)``',
        '- min_service_priorities_featured: ``$($report.workflow.monitor.inputs.minServicePrioritiesFeatured)``',
        '- require_service_priorities_funnel: ``$($report.workflow.monitor.inputs.requireServicePrioritiesFunnel)``',
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
        '- telemedicine_monitor_status: ``$($report.workflow.telemedicine.status)``',
        '- telemedicine_monitor_reason: ``$($report.workflow.telemedicine.reason)``',
        '- telemedicine_monitor_non_tele_failures: ``$($report.workflow.telemedicine.nonTeleFailures)``',
        '- telemedicine_monitor_step_outcome: ``$($report.workflow.telemedicine.stepOutcome)``',
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
        "'[ALERTA PROD] Deploy Frontend Self-Hosted ruta bloqueada'",
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

test('prod-monitor workflow cierra incidente turneroPilot cuando verify-remote se recupera', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Evaluar recuperacion turneroPilot para alertas stale de deploy',
        'Cerrar incidente turneroPilot al recuperar (solo schedule/default prod)',
        'Cerrar incidente turneroPilot self-hosted al recuperar (solo schedule/default prod)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step turneroPilot recovery en prod-monitor: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'TURNERO_PILOT_RECOVERY_STATUS: not_evaluated',
        'TURNERO_PILOT_RECOVERY_REASON: not_evaluated',
        "TURNERO_PILOT_RECOVERY_CLINIC_ID: ''",
        "TURNERO_PILOT_RECOVERY_PROFILE_FINGERPRINT: ''",
        "TURNERO_PILOT_RECOVERY_DEPLOYED_COMMIT: ''",
        "TURNERO_PILOT_RECOVERY_TARGETS: ''",
        'TURNERO_PILOT_RECOVERY_MANIFEST_PATH: .public-cutover-monitor/turnero-pilot-recovery.json',
        "if: ${{ always() && (github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && env.TARGET_DOMAIN == 'https://pielarmonia.com')) }}",
        '& node $scriptPath status --json 2>&1',
        '& node $scriptPath verify-remote --base-url $env:TARGET_DOMAIN --json 2>&1',
        'New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null',
        'Set-Content -Path $manifestPath -Encoding utf8',
        'recoveryTargets = @($recoveryTargets)',
        'recovery_targets=$($recoveryTargets -join',
        'turnero pilot recovery => status=$status reason=$reason clinic_id=$clinicId deployed_commit=$deployedCommit recovery_targets=',
        'prod-monitor-turnero-pilot-recovery',
        '- turnero_pilot_recovery_status: ``$($report.workflow.turneroPilotRecovery.status)``',
        '- turnero_pilot_recovery_reason: ``$($report.workflow.turneroPilotRecovery.reason)``',
        '- turnero_pilot_recovery_deployed_commit: ``$($report.workflow.turneroPilotRecovery.deployedCommit)``',
        '- turnero_pilot_recovery_targets: ``$($report.workflow.turneroPilotRecovery.recoveryTargets)``',
        '- turnero_pilot_recovery_manifest: ``$($report.workflow.turneroPilotRecovery.manifestPath)``',
        "'[ALERTA PROD] Deploy Hosting turneroPilot bloqueado'",
        "'[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'",
        'Cerrado automaticamente por prod-monitor al confirmar `verify-remote` saludable.',
        'Issue turneroPilot cerrado',
        'Issue turneroPilot self-hosted cerrado',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring turneroPilot recovery en prod-monitor: ${snippet}`
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
        '- enable_public_cutover_monitor: ``$($report.workflow.publicCutover.enabled)``',
        '- public_cutover_started_at: ``$($report.workflow.publicCutover.startedAt)``',
        '- public_cutover_window_hours: ``$($report.workflow.publicCutover.windowHours)``',
        '- public_cutover_window_active: ``$($report.workflow.publicCutover.windowActive)`` (reason ``$($report.workflow.publicCutover.windowReason)``)',
        '- public_cutover_elapsed_hours: ``$($report.workflow.publicCutover.elapsedHours)``',
        '- public_cutover_step_outcome: ``$($report.workflow.publicCutover.stepOutcome)``',
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
        '- enable_public_v4_rollout_monitor: ``$($report.workflow.publicV4Rollout.enabled)``',
        '- public_v4_rollout_stage: ``$($report.workflow.publicV4Rollout.stage)``',
        '- public_v4_rollout_surface_test: ``$($report.workflow.publicV4Rollout.surfaceTest)``',
        '- public_v4_rollout_surface_control: ``$($report.workflow.publicV4Rollout.surfaceControl)``',
        '- public_v4_rollout_min_view_booking: ``$($report.workflow.publicV4Rollout.minViewBooking)``',
        '- public_v4_rollout_min_start_checkout: ``$($report.workflow.publicV4Rollout.minStartCheckout)``',
        '- public_v4_rollout_max_confirmed_drop_pp: ``$($report.workflow.publicV4Rollout.maxConfirmedDropPp)``',
        '- public_v4_rollout_min_confirmed_rate_pct: ``$($report.workflow.publicV4Rollout.minConfirmedRatePct)``',
        '- public_v4_rollout_allow_missing_control: ``$($report.workflow.publicV4Rollout.allowMissingControl)``',
        '- enable_public_v4_rollout_monitor_effective: ``$($report.workflow.publicV4Rollout.enabledEffective)``',
        '- public_v4_rollout_stage_effective: ``$($report.workflow.publicV4Rollout.stageEffective)``',
        '- public_v4_rollout_stage_profile_effective: ``$($report.workflow.publicV4Rollout.stageProfileEffective)``',
        '- public_v4_rollout_policy_source_effective: ``$($report.workflow.publicV4Rollout.policySourceEffective)``',
        '- public_v4_rollout_surface_test_effective: ``$($report.workflow.publicV4Rollout.surfaceTestEffective)``',
        '- public_v4_rollout_surface_control_effective: ``$($report.workflow.publicV4Rollout.surfaceControlEffective)``',
        '- public_v4_rollout_min_view_booking_effective: ``$($report.workflow.publicV4Rollout.minViewBookingEffective)``',
        '- public_v4_rollout_min_start_checkout_effective: ``$($report.workflow.publicV4Rollout.minStartCheckoutEffective)``',
        '- public_v4_rollout_max_confirmed_drop_pp_effective: ``$($report.workflow.publicV4Rollout.maxConfirmedDropPpEffective)``',
        '- public_v4_rollout_min_confirmed_rate_pct_effective: ``$($report.workflow.publicV4Rollout.minConfirmedRatePctEffective)``',
        '- public_v4_rollout_allow_missing_control_effective: ``$($report.workflow.publicV4Rollout.allowMissingControlEffective)``',
        '- public_v4_rollout_step_outcome: ``$($report.workflow.publicV4Rollout.stepOutcome)``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary rollout V4: ${snippet}`
        );
    }
});

test('prod-monitor workflow auto-cierra alertas stale de deploy cuando public sync se recupera', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));
    const requiredEnvRefs = [
        'STALE_DEPLOY_ALERT_AUTOCLOSE_STATUS',
        'STALE_DEPLOY_ALERT_AUTOCLOSE_REASON',
        'STALE_DEPLOY_ALERT_AUTOCLOSE_PUBLIC_SYNC_HEALTHY',
        'STALE_DEPLOY_ALERT_AUTOCLOSE_OPEN_RELEVANT_COUNT',
        'STALE_DEPLOY_ALERT_AUTOCLOSE_CLOSED_COUNT',
        'STALE_DEPLOY_ALERT_AUTOCLOSE_CLOSED_ISSUES',
        "public_sync_job_id: ${jobId || 'n/a'}",
        "public_sync_deployed_commit: ${String(publicSync?.deployedCommit || 'n/a')}",
        "labels.includes('deploy-hosting')",
        "labels.includes('diagnose-host-connectivity')",
        "labels.includes('repair-git-sync')",
        "labels.includes('self-hosted-runner')",
        "labels.includes('telemedicine')",
        "'Recuperado automaticamente por monitor programado despues de verificar `checks.publicSync` sano.'",
    ];

    for (const snippet of requiredEnvRefs) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de autocierre stale deploy alerts: ${snippet}`
        );
    }

    for (const expectedStepName of [
        'Auto-close stale deploy alerts when public sync recovers',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de autocierre stale deploy alerts: ${expectedStepName}`
        );
    }

    const requiredSummaryLines = [
        '- stale_deploy_alert_autoclose_status: ``$($report.workflow.staleDeployAlertAutoclose.status)``',
        '- stale_deploy_alert_autoclose_reason: ``$($report.workflow.staleDeployAlertAutoclose.reason)``',
        '- stale_deploy_alert_autoclose_public_sync_healthy: ``$($report.workflow.staleDeployAlertAutoclose.publicSyncHealthy)``',
        '- stale_deploy_alert_autoclose_open_relevant_count: ``$($report.workflow.staleDeployAlertAutoclose.openRelevantCount)``',
        '- stale_deploy_alert_autoclose_closed_count: ``$($report.workflow.staleDeployAlertAutoclose.closedCount)``',
        '- stale_deploy_alert_autoclose_closed_issues: ``$($report.workflow.staleDeployAlertAutoclose.closedIssues)``',
    ];

    for (const snippet of requiredSummaryLines) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta linea de summary para autocierre stale deploy alerts: ${snippet}`
        );
    }
});

test('prod-monitor workflow normaliza y publica artefacto canonico del reporte', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.monitor?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const snippet of [
        'PROD_MONITOR_REPORT_PATH',
        'ReportPath = $env:PROD_MONITOR_REPORT_PATH',
        'name: prod-monitor-report',
        'path: ${{ env.PROD_MONITOR_REPORT_PATH }}',
        'artifact_name: ``$($report.artifact.name)``',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring del artefacto canonico prod-monitor: ${snippet}`
        );
    }

    for (const expectedStepName of [
        'Normalizar reporte canonico prod-monitor',
        'Upload canonical prod-monitor report',
        'Resumen',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de reporte canonico prod-monitor: ${expectedStepName}`
        );
    }
});
