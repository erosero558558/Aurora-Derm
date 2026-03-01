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

test('post-deploy-gate expone inputs de admin rollout', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    assert.equal(
        typeof inputs.admin_rollout_stage === 'object',
        true,
        'falta input admin_rollout_stage'
    );
    assert.equal(
        typeof inputs.admin_rollout_skip_runtime_smoke === 'object',
        true,
        'falta input admin_rollout_skip_runtime_smoke'
    );
    assert.equal(
        typeof inputs.admin_rollout_allow_feature_api_failure === 'object',
        true,
        'falta input admin_rollout_allow_feature_api_failure'
    );
    assert.equal(
        typeof inputs.admin_rollout_allow_missing_flag === 'object',
        true,
        'falta input admin_rollout_allow_missing_flag'
    );
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
        raw.includes('verification/last-admin-ui-rollout-gate.json'),
        true,
        'falta ruta canonica de reporte admin rollout en post-deploy-gate'
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
        raw.includes('admin_rollout_stage_profile_effective'),
        true,
        'falta trazabilidad de stage profile en incidente de post-deploy-gate'
    );
    assert.equal(
        raw.includes('admin_rollout_policy_source_effective'),
        true,
        'falta trazabilidad de policy source en incidente de post-deploy-gate'
    );
});
