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
    'post-deploy-gate.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('post-deploy-gate soporta modo dual (push + manual) con guardrail de activacion', () => {
    const { raw, parsed } = loadWorkflow();
    const pushBranches = parsed?.on?.push?.branches || [];
    const jobIf = String(parsed?.jobs?.gate?.if || '');

    assert.equal(
        Array.isArray(pushBranches),
        true,
        'post-deploy-gate debe declarar trigger push'
    );
    assert.equal(
        pushBranches.includes('main'),
        true,
        'post-deploy-gate debe escuchar push en main'
    );
    assert.equal(
        jobIf.includes("github.event_name != 'push'"),
        true,
        'post-deploy-gate debe permitir manual incluso si push esta deshabilitado'
    );
    assert.equal(
        jobIf.includes("vars.RUN_POSTDEPLOY_GATE_ON_PUSH == 'true'"),
        true,
        'post-deploy-gate debe proteger ejecucion en push por variable'
    );
    assert.equal(
        raw.includes('RUN_POSTDEPLOY_GATE_ON_PUSH'),
        true,
        'falta variable RUN_POSTDEPLOY_GATE_ON_PUSH en el workflow'
    );
});

test('post-deploy-gate exporta credenciales diagnostics al gate estricto', () => {
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
            `falta wiring de diagnostics en post-deploy-gate: ${snippet}`
        );
    }
});

test('post-deploy-gate expone inputs de admin rollout y public_v4 rollout', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'require_telemedicine_ready',
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
    ]) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input ${inputName}`
        );
    }
});

test('post-deploy-gate ejecuta gate admin rollout y lo reporta en summary', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.gate?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Ejecutar gate admin UI rollout'),
        true,
        'falta step de gate admin UI rollout en post-deploy-gate'
    );
    assert.equal(
        raw.includes('Semaforo admin rollout:'),
        true,
        'falta semaforo admin rollout en resumen del gate'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_STAGE_EFFECTIVE'),
        true,
        'falta variable efectiva de etapa para admin rollout gate'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_POLICY_SOURCE_EFFECTIVE'),
        true,
        'falta variable efectiva de policy source para admin rollout gate'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_STAGE_PROFILE_EFFECTIVE'),
        true,
        'falta variable efectiva de stage profile para admin rollout gate'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_EFFECTIVE'),
        true,
        'falta variable efectiva de require Operator Auth para admin rollout gate'
    );
    assert.equal(
        raw.includes('ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_LIVE_SMOKE_EFFECTIVE'),
        true,
        'falta variable efectiva de require Operator Auth live smoke para admin rollout gate'
    );
    assert.equal(
        raw.includes('Admin rollout policy source (effective):'),
        true,
        'falta linea de policy source en summary del gate'
    );
    assert.equal(
        raw.includes('Admin rollout stage profile (effective):'),
        true,
        'falta linea de stage profile en summary del gate'
    );
    assert.equal(
        raw.includes('Admin rollout require Operator Auth (effective):'),
        true,
        'falta linea require Operator Auth en summary del gate'
    );
    assert.equal(
        raw.includes('Admin rollout require Operator Auth live smoke (effective):'),
        true,
        'falta linea require Operator Auth live smoke en summary del gate'
    );
    assert.equal(
        raw.includes('Public V4 rollout stage (effective):'),
        true,
        'falta linea de stage efectivo public_v4 en summary del gate'
    );
    assert.equal(
        raw.includes('Public V4 rollout policy source (effective):'),
        true,
        'falta linea de policy source efectivo public_v4 en summary del gate'
    );
    assert.equal(
        raw.includes('Require telemedicine ready (input/vars):'),
        true,
        'falta linea de require telemedicine input en summary del gate'
    );
    assert.equal(
        raw.includes('Require telemedicine ready (effective):'),
        true,
        'falta linea de require telemedicine effective en summary del gate'
    );
    assert.equal(
        raw.includes('Trigger mode:'),
        true,
        'falta linea de trigger mode en summary del gate'
    );
    assert.equal(
        stepNames.includes('Publicar reporte gate admin rollout'),
        true,
        'falta step para publicar reporte admin rollout en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Publicar reporte smoke live Operator Auth'),
        true,
        'falta step para publicar reporte smoke live Operator Auth en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Escribir reporte rollout publico V4'),
        true,
        'falta step para escribir reporte public_v4 rollout en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Publicar reporte rollout publico V4'),
        true,
        'falta step para publicar reporte public_v4 rollout en post-deploy-gate'
    );
    assert.equal(
        raw.includes('verification/last-admin-ui-rollout-gate.json'),
        true,
        'falta ruta canonica de reporte admin rollout en post-deploy-gate'
    );
    assert.equal(
        raw.includes('verification/last-public-v4-rollout-gate.json'),
        true,
        'falta ruta canonica de reporte public_v4 rollout en post-deploy-gate'
    );
    assert.equal(
        raw.includes('-Stage $env:ADMIN_ROLLOUT_STAGE_EFFECTIVE'),
        true,
        'falta propagacion de stage efectivo al gate admin rollout'
    );
    assert.equal(
        raw.includes('-SkipRuntimeSmoke:$skipRuntimeSmoke'),
        true,
        'falta propagacion de skip runtime smoke al gate admin rollout'
    );
    assert.equal(
        raw.includes('-AllowFeatureApiFailure:$allowFeatureApiFailure'),
        true,
        'falta propagacion de allow feature api failure al gate admin rollout'
    );
    assert.equal(
        raw.includes('-AllowMissingAdminFlag:$allowMissingFlag'),
        true,
        'falta propagacion de allow missing admin flag al gate admin rollout'
    );
    assert.equal(
        raw.includes('-RequireOperatorAuth:$requireOperatorAuth'),
        true,
        'falta propagacion de RequireOperatorAuth al gate admin rollout'
    );
    assert.equal(
        stepNames.includes('Ejecutar smoke live Operator Auth web broker'),
        true,
        'falta step de smoke live Operator Auth en post-deploy-gate'
    );
    assert.equal(
        raw.includes('REQUIRE_TELEMEDICINE_READY_INPUT'),
        true,
        'falta input env REQUIRE_TELEMEDICINE_READY_INPUT en post-deploy-gate'
    );
    assert.equal(
        raw.includes('REQUIRE_TELEMEDICINE_READY_EFFECTIVE'),
        true,
        'falta env REQUIRE_TELEMEDICINE_READY_EFFECTIVE en post-deploy-gate'
    );
    assert.equal(
        raw.includes('-RequireTelemedicineReady:$requireTelemedicineReady'),
        true,
        'falta propagacion de RequireTelemedicineReady al gate post-deploy'
    );
    assert.equal(
        stepNames.includes('Evaluar estado telemedicina del gate'),
        true,
        'falta step de evaluacion telemedicina en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Evaluar estado turneroPilot del gate'),
        true,
        'falta step de evaluacion turneroPilot en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Resumen telemedicina gate'),
        true,
        'falta step de resumen telemedicina en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Resumen turneroPilot gate'),
        true,
        'falta step de resumen turneroPilot en post-deploy-gate'
    );
    assert.equal(
        raw.includes('health-telemedicine-*'),
        true,
        'falta clasificacion de fallas telemedicina por prefijo de asset'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && ((env.TELEMEDICINE_GATE_STATUS != 'degraded_only' && env.TELEMEDICINE_GATE_STATUS != 'unknown') || env.TELEMEDICINE_GATE_NON_TELE_FAILURES != '0')"
        ),
        true,
        'falta condicion del incidente general excluyendo tele-only unknown/degraded_only'
    );
    assert.equal(
        raw.includes('Gate post-deploy telemedicina degradado'),
        true,
        'falta titulo dedicado para incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes('TELEMEDICINE_GATE_NON_TELE_FAILURES'),
        true,
        'falta trazabilidad de non-tele failures en gate telemedicina'
    );
    assert.equal(
        raw.includes('post-deploy-gate-telemedicine-signal'),
        true,
        'falta marker de senal para dedupe en incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_GATE_STATUS'),
        true,
        'falta env TURNERO_PILOT_GATE_STATUS en post-deploy-gate'
    );
    assert.equal(
        raw.includes('Turnero pilot gate status:'),
        true,
        'falta linea de estado turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('Turnero pilot gate verify-remote required:'),
        true,
        'falta linea verify-remote required turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('Turnero pilot gate release mode:'),
        true,
        'falta linea release mode turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('Turnero pilot gate deployed commit:'),
        true,
        'falta linea de deployed commit turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('Turnero pilot gate recovery targets:'),
        true,
        'falta linea de recovery targets turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('Reporte turnero pilot gate:'),
        true,
        'falta linea de reporte turneroPilot en summary del gate'
    );
    assert.equal(
        raw.includes('turnero_pilot_gate_status:'),
        true,
        'falta trazabilidad de estado turneroPilot en incidente de gate'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_GATE_VERIFY_REMOTE_REQUIRED'),
        true,
        'falta env TURNERO_PILOT_GATE_VERIFY_REMOTE_REQUIRED en post-deploy-gate'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_GATE_RELEASE_MODE'),
        true,
        'falta env TURNERO_PILOT_GATE_RELEASE_MODE en post-deploy-gate'
    );
    assert.equal(
        raw.includes('TURNERO_PILOT_GATE_RECOVERY_TARGETS'),
        true,
        'falta env TURNERO_PILOT_GATE_RECOVERY_TARGETS en post-deploy-gate'
    );
    assert.equal(
        raw.includes('turnero_pilot_gate_verify_remote_required:'),
        true,
        'falta trazabilidad verify_remote_required de turneroPilot en incidente de gate'
    );
    assert.equal(
        raw.includes('turnero_pilot_gate_release_mode:'),
        true,
        'falta trazabilidad release_mode de turneroPilot en incidente de gate'
    );
    assert.equal(
        raw.includes('turnero_pilot_gate_recovery_targets:'),
        true,
        'falta trazabilidad recovery_targets de turneroPilot en incidente de gate'
    );
    assert.equal(
        raw.includes('recoveryTargets = @('),
        true,
        'falta recoveryTargets en reporte turneroPilot gate'
    );
    assert.equal(
        raw.includes(
            '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
        ),
        true,
        'falta target self-hosted en recoveryTargets del gate'
    );
    assert.equal(
        raw.includes(
            "non_tele:${process.env.TELEMEDICINE_GATE_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta non_tele en signal de dedupe para incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes(
            "telemedicine_gate_non_tele_failures: ${process.env.TELEMEDICINE_GATE_NON_TELE_FAILURES || '0'}"
        ),
        true,
        'falta trazabilidad de non_tele_failures en updates de incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes(
            "const baseLabels = ['production-alert', 'telemedicine', 'post-deploy-gate', severity];"
        ),
        true,
        'falta set canonico de labels base con severidad en incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes('severity:critical'),
        true,
        'falta label de severidad critica en incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes('severity:warning'),
        true,
        'falta label de severidad warning en incidente telemedicina de gate'
    );
    assert.equal(
        stepNames.includes('Escribir reporte turneroPilot gate'),
        true,
        'falta step de escritura de reporte turneroPilot en post-deploy-gate'
    );
    assert.equal(
        stepNames.includes('Publicar reporte turneroPilot gate'),
        true,
        'falta step de publicacion de reporte turneroPilot en post-deploy-gate'
    );
    assert.equal(
        raw.includes('verification/last-turnero-pilot-gate.json'),
        true,
        'falta ruta canonica de reporte turneroPilot en post-deploy-gate'
    );
    assert.equal(
        raw.includes('post-deploy-turnero-pilot-gate-report'),
        true,
        'falta publicacion del artefacto turneroPilot gate'
    );
    assert.equal(
        raw.includes('Issue telemedicina gate ya refleja la misma senal'),
        true,
        'falta deduplicacion idempotente cuando la senal no cambia en gate telemedicina'
    );
    assert.equal(
        raw.includes(
            'Incidente telemedicina gate actualizado por cambio de senal.'
        ),
        true,
        'falta comentario de auditoria por cambio de senal en incidente telemedicina de gate'
    );
});

test('post-deploy-gate mantiene ciclo de incidentes solo en modo no-manual', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.gate?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Crear/actualizar incidente de gate'),
        true,
        'falta step de crear/actualizar incidente de gate'
    );
    assert.equal(
        stepNames.includes('Cerrar incidente de gate al recuperar'),
        true,
        'falta step de cierre de incidente de gate'
    );
    assert.equal(
        stepNames.includes('Crear/actualizar incidente telemedicina de gate'),
        true,
        'falta step dedicado para incidente telemedicina de gate'
    );
    assert.equal(
        stepNames.includes(
            'Cerrar incidente telemedicina de gate al recuperar'
        ),
        true,
        'falta step de cierre de incidente telemedicina de gate'
    );
    assert.equal(
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura de incidente para modo no-manual'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre de incidente para modo no-manual'
    );
    assert.equal(
        raw.includes(
            "failure() && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_GATE_STATUS == 'degraded_only' || env.TELEMEDICINE_GATE_STATUS == 'degraded_mixed' || env.TELEMEDICINE_GATE_STATUS == 'unknown')"
        ),
        true,
        'falta condicion de incidente telemedicina por degradacion dedicada/mixta/unknown'
    );
});

test('post-deploy-gate usa resolver central de politica admin rollout con trazabilidad', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes('node ./bin/resolve-admin-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes('--default-stage general'),
        true,
        'falta default-stage general al resolver politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes('--default-skip-runtime-smoke false'),
        true,
        'falta default-skip-runtime-smoke false en post-deploy-gate'
    );
    assert.equal(
        raw.includes(
            '--allow-feature-api-failure "$env:ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE_INPUT"'
        ),
        true,
        'falta propagacion de allow_feature_api_failure al resolver politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes(
            '--allow-missing-flag "$env:ADMIN_ROLLOUT_ALLOW_MISSING_FLAG_INPUT"'
        ),
        true,
        'falta propagacion de allow_missing_flag al resolver politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes(
            '--require-operator-auth "$env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_INPUT"'
        ),
        true,
        'falta propagacion de require_operator_auth al resolver politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes(
            '--require-operator-auth-live-smoke "$env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_LIVE_SMOKE_INPUT"'
        ),
        true,
        'falta propagacion de require_operator_auth_live_smoke al resolver politica en post-deploy-gate'
    );
    assert.equal(
        raw.includes('node ./bin/resolve-public-v4-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica public_v4 en post-deploy-gate'
    );
    assert.equal(
        raw.includes(
            '--enable-monitor "$env:ENABLE_PUBLIC_V4_ROLLOUT_MONITOR_INPUT"'
        ),
        true,
        'falta propagacion de enable_monitor al resolver politica public_v4 en post-deploy-gate'
    );
    assert.equal(
        raw.includes('admin_rollout_stage_profile_effective'),
        true,
        'falta trazabilidad de stage profile en incidente de post-deploy-gate'
    );
    assert.equal(
        raw.includes('admin_rollout_policy_source_effective'),
        true,
        'falta trazabilidad de policy source en incidente de post-deploy-gate'
    );
    assert.equal(
        raw.includes('public_v4_rollout_stage_profile_effective'),
        true,
        'falta trazabilidad de stage profile public_v4 en incidente de post-deploy-gate'
    );
    assert.equal(
        raw.includes('public_v4_rollout_policy_source_effective'),
        true,
        'falta trazabilidad de policy source public_v4 en incidente de post-deploy-gate'
    );
});
