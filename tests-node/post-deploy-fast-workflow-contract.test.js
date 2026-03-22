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
    'post-deploy-fast.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('post-deploy-fast habilita permisos para incidentes', () => {
    const { parsed } = loadWorkflow();
    const permissions = parsed?.permissions || {};

    assert.equal(
        permissions.issues,
        'write',
        'post-deploy-fast debe tener issues: write para incidentes automaticos'
    );
});

test('post-deploy-fast exporta credenciales diagnostics al gate rapido', () => {
    const { raw } = loadWorkflow();
    for (const snippet of [
        'PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN',
        'PIELARMONIA_CRON_SECRET',
        'PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER',
        'PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX',
        'secrets.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN',
        'secrets.CRON_SECRET',
        "vars.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER || 'Authorization'",
        "vars.PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX || 'Bearer'",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de diagnostics en post-deploy-fast: ${snippet}`
        );
    }
});

test('post-deploy-fast incluye cierre de ciclo de incidente', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['gate-fast']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Crear/actualizar incidente fast lane'),
        true,
        'falta step de crear/actualizar incidente fast lane'
    );
    assert.equal(
        stepNames.includes('Cerrar incidente fast lane al recuperar'),
        true,
        'falta step de cierre de incidente fast lane'
    );
    assert.equal(
        stepNames.includes('Crear/actualizar incidente telemedicina fast lane'),
        true,
        'falta step de incidente dedicado telemedicina fast lane'
    );
    assert.equal(
        stepNames.includes(
            'Cerrar incidente telemedicina fast lane al recuperar'
        ),
        true,
        'falta step de cierre de incidente dedicado telemedicina fast lane'
    );
    assert.equal(
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura de incidente en fallo no manual'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre de incidente en recuperacion no manual'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && ((env.TELEMEDICINE_FAST_STATUS != 'degraded_only' && env.TELEMEDICINE_FAST_STATUS != 'unknown') || env.TELEMEDICINE_FAST_NON_TELE_FAILURES != '0')"
        ),
        true,
        'falta condicion de incidente generico fast lane excluyendo tele-only unknown/degraded_only'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_FAST_STATUS == 'degraded_only' || env.TELEMEDICINE_FAST_STATUS == 'degraded_mixed' || env.TELEMEDICINE_FAST_STATUS == 'unknown')"
        ),
        true,
        'falta condicion de incidente telemedicina dedicada/mixta/unknown en fast lane'
    );
    assert.equal(
        raw.includes('Post-Deploy Fast Lane fallando'),
        true,
        'falta titulo canonico de incidente fast lane'
    );
    assert.equal(
        raw.includes('Post-Deploy Fast Lane telemedicina degradado'),
        true,
        'falta titulo canonico de incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes('post-deploy-fast-telemedicine-signal'),
        true,
        'falta marker de senal para dedupe en incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes(
            "non_tele:${process.env.TELEMEDICINE_FAST_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta non_tele en signal de dedupe para incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes(
            "telemedicine_fast_non_tele_failures: ${process.env.TELEMEDICINE_FAST_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta trazabilidad de non_tele_failures en updates de incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes(
            "const baseLabels = ['production-alert', 'fast-lane', 'telemedicine', severity];"
        ),
        true,
        'falta set canonico de labels base con severidad en incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes('severity:critical'),
        true,
        'falta label de severidad critica en incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes('severity:warning'),
        true,
        'falta label de severidad warning en incidente telemedicina fast lane'
    );
    assert.equal(
        raw.includes('Issue telemedicina fast ya refleja la misma senal'),
        true,
        'falta deduplicacion idempotente cuando la senal no cambia en fast lane'
    );
    assert.equal(
        raw.includes(
            'Incidente telemedicina fast actualizado por cambio de senal.'
        ),
        true,
        'falta comentario de auditoria por cambio de senal en incidente telemedicina fast lane'
    );
});

test('post-deploy-fast espera el commit publicado en public sync antes del gate', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['gate-fast']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Esperar commit sincronizado en public sync'),
        true,
        'falta step para esperar el commit publicado en public sync'
    );
    assert.equal(
        raw.includes('PUBLIC_SYNC_WAIT_TIMEOUT_FAST'),
        true,
        'falta env de timeout para esperar public sync en fast lane'
    );
    assert.equal(
        raw.includes('PUBLIC_SYNC_POLL_INTERVAL_FAST'),
        true,
        'falta env de polling para esperar public sync en fast lane'
    );
    assert.equal(
        raw.includes('api.php?resource=health'),
        true,
        'fast lane debe consultar health para esperar el commit publicado'
    );
    assert.equal(
        raw.includes('$env:GITHUB_SHA'),
        true,
        'fast lane debe comparar public sync contra el sha del workflow'
    );
    assert.equal(
        raw.includes('PUBLIC_SYNC_FAST_MATCHED'),
        true,
        'falta estado exportado de commit match en fast lane'
    );
    assert.equal(
        raw.includes('PUBLIC_SYNC_FAST_CURRENT_HEAD'),
        true,
        'falta current head exportado de public sync en fast lane'
    );
    assert.equal(
        raw.includes('PUBLIC_SYNC_FAST_DEPLOYED_COMMIT'),
        true,
        'falta deployed commit exportado de public sync en fast lane'
    );
    assert.equal(
        raw.includes('Public sync commit matched:'),
        true,
        'falta trazabilidad del match de public sync en el summary fast lane'
    );
    assert.equal(
        raw.includes('public_sync_commit_matched:'),
        true,
        'falta trazabilidad del match de public sync en el incidente fast lane'
    );
});

test('post-deploy-fast integra gate admin rollout con resumen operativo', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['gate-fast']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Ejecutar gate admin UI rollout (fast)'),
        true,
        'falta step de gate admin UI rollout en fast lane'
    );
    assert.equal(
        stepNames.includes('Evaluar estado telemedicina fast lane'),
        true,
        'falta step de evaluacion telemedicina en fast lane'
    );
    assert.equal(
        stepNames.includes('Evaluar estado turneroPilot fast lane'),
        true,
        'falta step de evaluacion turneroPilot en fast lane'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_STAGE_FAST'),
        true,
        'falta variable de etapa para gate admin UI en fast lane'
    );
    assert.equal(
        raw.includes('Semaforo admin rollout (fast)'),
        true,
        'falta linea de semaforo admin rollout en resumen fast lane'
    );
    assert.equal(
        raw.includes('Admin rollout policy source (fast):'),
        true,
        'falta linea de policy source en resumen fast lane'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_POLICY_SOURCE_FAST_EFFECTIVE'),
        true,
        'falta variable efectiva de policy source para fast lane'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_STAGE_PROFILE_FAST_EFFECTIVE'),
        true,
        'falta variable efectiva de stage profile para fast lane'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST_EFFECTIVE'),
        true,
        'falta variable efectiva de require Operator Auth para fast lane'
    );
    assert.equal(
        raw.includes(
            'ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_LIVE_SMOKE_FAST_EFFECTIVE'
        ),
        true,
        'falta variable efectiva de require Operator Auth live smoke para fast lane'
    );
    assert.equal(
        raw.includes('Admin rollout stage profile (fast):'),
        true,
        'falta linea de stage profile en resumen fast lane'
    );
    assert.equal(
        raw.includes('Admin rollout require Operator Auth (fast):'),
        true,
        'falta linea require Operator Auth en resumen fast lane'
    );
    assert.equal(
        raw.includes('Admin rollout require Operator Auth live smoke (fast):'),
        true,
        'falta linea require Operator Auth live smoke en resumen fast lane'
    );
    assert.equal(
        raw.includes('Public V4 rollout stage (effective):'),
        true,
        'falta linea de stage efectivo public_v4 en resumen fast lane'
    );
    assert.equal(
        raw.includes('Public V4 rollout policy source (effective):'),
        true,
        'falta linea de policy source efectivo public_v4 en resumen fast lane'
    );
    assert.equal(
        raw.includes('Telemedicine fast status:'),
        true,
        'falta linea de estado telemedicina en resumen fast lane'
    );
    assert.equal(
        raw.includes('Telemedicine fast step outcome:'),
        true,
        'falta linea de outcome telemedicina en resumen fast lane'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_FAST_STATUS'),
        true,
        'falta env TURNERO_PILOT_FAST_STATUS en fast lane'
    );
    assert.equal(
        raw.includes('Turnero pilot fast status:'),
        true,
        'falta linea de estado turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('Turnero pilot fast verify-remote required:'),
        true,
        'falta linea verify-remote required turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('Turnero pilot fast release mode:'),
        true,
        'falta linea release mode turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('Turnero pilot fast deployed commit:'),
        true,
        'falta linea de deployed commit turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('Turnero pilot fast recovery targets:'),
        true,
        'falta linea de recovery targets turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('Reporte turnero pilot fast:'),
        true,
        'falta linea de reporte turneroPilot en resumen fast lane'
    );
    assert.equal(
        raw.includes('turnero_pilot_fast_status:'),
        true,
        'falta trazabilidad de estado turneroPilot en incidente fast lane'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_FAST_VERIFY_REMOTE_REQUIRED'),
        true,
        'falta env TURNERO_PILOT_FAST_VERIFY_REMOTE_REQUIRED en fast lane'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_FAST_RELEASE_MODE'),
        true,
        'falta env TURNERO_PILOT_FAST_RELEASE_MODE en fast lane'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_FAST_RECOVERY_TARGETS'),
        true,
        'falta env TURNERO_PILOT_FAST_RECOVERY_TARGETS en fast lane'
    );
    assert.equal(
        raw.includes('turnero_pilot_fast_verify_remote_required:'),
        true,
        'falta trazabilidad verify_remote_required de turneroPilot en incidente fast lane'
    );
    assert.equal(
        raw.includes('turnero_pilot_fast_release_mode:'),
        true,
        'falta trazabilidad release_mode de turneroPilot en incidente fast lane'
    );
    assert.equal(
        raw.includes('turnero_pilot_fast_recovery_targets:'),
        true,
        'falta trazabilidad recovery_targets de turneroPilot en incidente fast lane'
    );
    assert.equal(
        raw.includes('recoveryTargets = @('),
        true,
        'falta recoveryTargets en reporte turneroPilot fast'
    );
    assert.equal(
        raw.includes(
            '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
        ),
        true,
        'falta target self-hosted en recoveryTargets del fast lane'
    );
    assert.equal(
        raw.includes('TELEMEDICINE_FAST_NON_TELE_FAILURES'),
        true,
        'falta trazabilidad de non-tele failures en fast lane'
    );
    assert.equal(
        raw.includes('health-telemedicine-*'),
        true,
        'falta clasificacion de fallas telemedicina por prefijo de asset en fast lane'
    );
    assert.equal(
        stepNames.includes('Publicar reporte gate admin rollout (fast)'),
        true,
        'falta publicacion de artefacto de reporte admin rollout en fast lane'
    );
    assert.equal(
        stepNames.includes('Escribir reporte rollout publico V4 (fast)'),
        true,
        'falta step de escritura de reporte public_v4 rollout en fast lane'
    );
    assert.equal(
        stepNames.includes('Publicar reporte rollout publico V4 (fast)'),
        true,
        'falta step de publicacion de reporte public_v4 rollout en fast lane'
    );
    assert.equal(
        stepNames.includes('Escribir reporte turneroPilot fast'),
        true,
        'falta step de escritura de reporte turneroPilot en fast lane'
    );
    assert.equal(
        stepNames.includes('Publicar reporte turneroPilot fast'),
        true,
        'falta step de publicacion de reporte turneroPilot en fast lane'
    );
    assert.equal(
        raw.includes('verification/last-admin-ui-rollout-gate-fast.json'),
        true,
        'falta ruta canonica del reporte admin rollout fast'
    );
    assert.equal(
        raw.includes('verification/last-public-v4-rollout-fast.json'),
        true,
        'falta ruta canonica del reporte public_v4 rollout fast'
    );
    assert.equal(
        raw.includes('verification/last-turnero-pilot-fast.json'),
        true,
        'falta ruta canonica del reporte turneroPilot fast'
    );
    assert.equal(
        raw.includes('post-deploy-turnero-pilot-fast-report'),
        true,
        'falta publicacion del artefacto turneroPilot fast'
    );
    assert.equal(
        raw.includes('-Stage $env:ADMIN_ROLLOUT_STAGE_FAST_EFFECTIVE'),
        true,
        'falta propagacion de stage efectivo al gate admin rollout fast'
    );
    assert.equal(
        raw.includes('-SkipRuntimeSmoke:$skipRuntimeSmoke'),
        true,
        'falta propagacion de skip runtime smoke al gate admin rollout fast'
    );
    assert.equal(
        raw.includes('-AllowFeatureApiFailure:$allowFeatureApiFailure'),
        true,
        'falta propagacion de allow feature api failure al gate admin rollout fast'
    );
    assert.equal(
        raw.includes('-AllowMissingAdminFlag:$allowMissingFlag'),
        true,
        'falta propagacion de allow missing admin flag al gate admin rollout fast'
    );
    assert.equal(
        raw.includes('-RequireOperatorAuth:$requireOperatorAuth'),
        true,
        'falta propagacion de RequireOperatorAuth al gate admin rollout fast'
    );
    assert.equal(
        stepNames.includes('Ejecutar smoke live Operator Auth web broker (fast)'),
        true,
        'falta step de smoke live Operator Auth en fast lane'
    );
    assert.equal(
        raw.includes('post-deploy-fast-operator-auth-live-smoke-report'),
        true,
        'falta artefacto del smoke live Operator Auth en fast lane'
    );
});

test('post-deploy-fast usa resolver central de politica admin rollout', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes('node ./bin/resolve-admin-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica en fast lane'
    );
    assert.equal(
        raw.includes('--default-stage canary'),
        true,
        'falta default-stage canary al resolver politica en fast lane'
    );
    assert.equal(
        raw.includes('--default-skip-runtime-smoke true'),
        true,
        'falta default-skip-runtime-smoke true en fast lane'
    );
    assert.equal(
        raw.includes(
            '--allow-feature-api-failure "$env:ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE_FAST"'
        ),
        true,
        'falta propagacion de allow_feature_api_failure al resolver politica en fast lane'
    );
    assert.equal(
        raw.includes(
            '--allow-missing-flag "$env:ADMIN_ROLLOUT_ALLOW_MISSING_FLAG_FAST"'
        ),
        true,
        'falta propagacion de allow_missing_flag al resolver politica en fast lane'
    );
    assert.equal(
        raw.includes(
            '--require-operator-auth "$env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST"'
        ),
        true,
        'falta propagacion de require_operator_auth al resolver politica en fast lane'
    );
    assert.equal(
        raw.includes(
            '--require-operator-auth-live-smoke "$env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_LIVE_SMOKE_FAST"'
        ),
        true,
        'falta propagacion de require_operator_auth_live_smoke al resolver politica en fast lane'
    );
    assert.equal(
        raw.includes('admin_rollout_stage_profile'),
        true,
        'falta trazabilidad de stage profile en incidente fast lane'
    );
    assert.equal(
        raw.includes('admin_rollout_policy_source'),
        true,
        'falta trazabilidad de policy source en incidente fast lane'
    );
    assert.equal(
        raw.includes('node ./bin/resolve-public-v4-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica public_v4 en fast lane'
    );
    assert.equal(
        raw.includes(
            '--enable-monitor "$env:ENABLE_PUBLIC_V4_ROLLOUT_MONITOR_FAST"'
        ),
        true,
        'falta propagacion de enable_monitor al resolver politica public_v4 en fast lane'
    );
    assert.equal(
        raw.includes('public_v4_stage_profile'),
        true,
        'falta trazabilidad de stage profile public_v4 en incidente fast lane'
    );
    assert.equal(
        raw.includes('public_v4_policy_source'),
        true,
        'falta trazabilidad de policy source public_v4 en incidente fast lane'
    );
});

test('post-deploy-fast expone inputs para propagacion de admin rollout y public_v4 rollout', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    const requiredInputs = [
        'admin_rollout_stage',
        'admin_rollout_skip_runtime_smoke',
        'admin_rollout_allow_feature_api_failure',
        'admin_rollout_allow_missing_flag',
        'admin_rollout_require_operator_auth',
        'admin_rollout_require_operator_auth_live_smoke',
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

    for (const inputName of requiredInputs) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }
});
