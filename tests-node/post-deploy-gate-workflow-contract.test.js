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

test('post-deploy-gate expone inputs de admin rollout y public_v4 rollout', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    for (const inputName of [
        'admin_rollout_stage',
        'admin_rollout_skip_runtime_smoke',
        'admin_rollout_allow_feature_api_failure',
        'admin_rollout_allow_missing_flag',
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
        raw.includes("failure() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de apertura de incidente para modo no-manual'
    );
    assert.equal(
        raw.includes("success() && github.event_name != 'workflow_dispatch'"),
        true,
        'falta condicion de cierre de incidente para modo no-manual'
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

