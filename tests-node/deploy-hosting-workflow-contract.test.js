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
    'deploy-hosting.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('deploy-hosting expone inputs de dispatch post-deploy', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    const requiredInputs = [
        'run_postdeploy_fast',
        'run_postdeploy_gate',
        'postdeploy_fast_wait_seconds',
        'enable_public_v4_rollout_monitor',
        'public_v4_rollout_stage',
        'admin_rollout_stage',
        'admin_rollout_skip_runtime_smoke_fast',
        'admin_rollout_allow_feature_api_failure_fast',
        'admin_rollout_allow_missing_flag_fast',
        'admin_rollout_skip_runtime_smoke_gate',
        'admin_rollout_allow_feature_api_failure_gate',
        'admin_rollout_allow_missing_flag_gate',
    ];

    for (const inputName of requiredInputs) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }
});

test('deploy-hosting habilita permisos para dispatch de workflows', () => {
    const { parsed } = loadWorkflow();
    const permissions = parsed?.permissions || {};

    assert.equal(
        permissions.actions,
        'write',
        'deploy-hosting debe tener actions: write para createWorkflowDispatch'
    );
    assert.equal(
        permissions.contents,
        'read',
        'deploy-hosting debe mantener contents: read'
    );
});

test('deploy-hosting contiene pasos de dispatch hacia post-deploy', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes('Disparar Post-Deploy Fast Lane'),
        true,
        'falta step para disparar post-deploy-fast'
    );
    assert.equal(
        stepNames.includes('Disparar Post-Deploy Gate (Full Regression)'),
        true,
        'falta step para disparar post-deploy-gate'
    );
    assert.equal(
        raw.includes("workflow_id: 'post-deploy-fast.yml'"),
        true,
        'falta dispatch explicito a post-deploy-fast.yml'
    );
    assert.equal(
        raw.includes("workflow_id: 'post-deploy-gate.yml'"),
        true,
        'falta dispatch explicito a post-deploy-gate.yml'
    );
    assert.equal(
        raw.includes('./GATE-ADMIN-ROLLOUT.ps1'),
        true,
        'falta gate admin rollout reutilizado en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            'public_v4_rollout_stage: process.env.PUBLIC_V4_ROLLOUT_STAGE_EFFECTIVE'
        ),
        true,
        'falta propagacion de stage public_v4 al dispatch de post-deploy-fast'
    );
    assert.equal(
        raw.includes(
            'Workflow post-deploy-gate.yml disparado (domain=${process.env.PROD_URL}, admin_stage=${process.env.ADMIN_ROLLOUT_STAGE_EFFECTIVE}, public_v4_stage=${process.env.PUBLIC_V4_ROLLOUT_STAGE_EFFECTIVE}, public_v4_monitor=${process.env.PUBLIC_V4_ENABLE_MONITOR_EFFECTIVE}).'
        ),
        true,
        'falta propagacion de stage public_v4 al dispatch de post-deploy-gate'
    );
});

test('deploy-hosting aplica guardrail de dispatch por tipo de evento', () => {
    const { raw } = loadWorkflow();

    assert.equal(
        raw.includes('DISPATCH_EVENT_NAME: ${{ github.event_name }}'),
        true,
        'falta variable de evento para resolver dispatch mode'
    );
    assert.equal(
        raw.includes(
            "RUN_POSTDEPLOY_FAST_AUTOMATION: ${{ vars.RUN_POSTDEPLOY_FAST_FROM_DEPLOY_WORKFLOW_RUN || vars.RUN_POSTDEPLOY_FAST_FROM_DEPLOY || 'false' }}"
        ),
        true,
        'falta default automation de fast (false por defecto)'
    );
    assert.equal(
        raw.includes(
            "RUN_POSTDEPLOY_GATE_AUTOMATION: ${{ vars.RUN_POSTDEPLOY_GATE_FROM_DEPLOY_WORKFLOW_RUN || vars.RUN_POSTDEPLOY_GATE_FROM_DEPLOY || 'false' }}"
        ),
        true,
        'falta default automation de gate (false por defecto)'
    );
    assert.equal(
        raw.includes(
            'if [ "${DISPATCH_EVENT_NAME}" = "workflow_dispatch" ]; then'
        ),
        true,
        'falta branch explicito para modo manual'
    );
    assert.equal(
        raw.includes(
            'run_fast="$(normalize_bool "${RUN_POSTDEPLOY_FAST_INPUT}")"'
        ),
        true,
        'falta resolucion manual de run_fast'
    );
    assert.equal(
        raw.includes(
            'run_fast="$(normalize_bool "${RUN_POSTDEPLOY_FAST_AUTOMATION}")"'
        ),
        true,
        'falta resolucion automatica de run_fast'
    );
    assert.equal(
        raw.includes('node ./bin/resolve-admin-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica en deploy-hosting'
    );
    assert.equal(
        raw.includes('node ./bin/resolve-public-v4-rollout-policy.js'),
        true,
        'falta uso del resolver central de politica public V4 en deploy-hosting'
    );
    assert.equal(
        raw.includes('--default-stage general'),
        true,
        'falta default-stage general al resolver politica en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            'public_v4_stage_profile="$(json_field "$public_v4_policy_json" stage_profile)"'
        ),
        true,
        'falta salida public_v4 stage_profile efectiva en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            'public_v4_policy_source="$(json_field "$public_v4_policy_json" policy_source)"'
        ),
        true,
        'falta captura de public_v4 policy_source desde resolver central'
    );
    assert.equal(
        raw.includes(
            'public_v4_allow_missing_control="$(json_field "$public_v4_policy_json" allow_missing_control_effective)"'
        ),
        true,
        'falta captura de allow_missing_control efectivo para public_v4 en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            'stage_profile="$(json_field "$base_policy_json" stage_profile)"'
        ),
        true,
        'falta salida stage_profile efectiva en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            'policy_source_fast="$(json_field "$fast_policy_json" policy_source)"'
        ),
        true,
        'falta captura de policy_source_fast desde resolver central'
    );
    assert.equal(
        raw.includes(
            'policy_source_gate="$(json_field "$gate_policy_json" policy_source)"'
        ),
        true,
        'falta captura de policy_source_gate desde resolver central'
    );
    assert.equal(
        raw.includes('precheck_policy_source="gate:${policy_source_gate}"'),
        true,
        'falta policy source de precheck cuando gate esta habilitado'
    );
    assert.equal(
        raw.includes('precheck_policy_source="fast:${policy_source_fast}"'),
        true,
        'falta policy source de precheck cuando fast esta habilitado'
    );
    assert.equal(
        raw.includes(
            'precheck_policy_source="stage-default:${policy_source_base}"'
        ),
        true,
        'falta policy source de precheck cuando no hay dispatch'
    );
    assert.equal(
        raw.includes('admin rollout stage profile (effective)'),
        true,
        'falta stage profile en resumen de deploy-hosting'
    );
    assert.equal(
        raw.includes('admin rollout policy source fast (effective)'),
        true,
        'falta policy source fast en resumen de deploy-hosting'
    );
    assert.equal(
        raw.includes('admin rollout policy source gate (effective)'),
        true,
        'falta policy source gate en resumen de deploy-hosting'
    );
    assert.equal(
        raw.includes('Write post-deploy rollout dispatch manifest'),
        true,
        'falta step para generar manifest de dispatch de rollout en deploy-hosting'
    );
    assert.equal(
        raw.includes('.public-cutover/postdeploy-rollout-dispatch.json'),
        true,
        'falta ruta canonica del manifest de dispatch de rollout en deploy-hosting'
    );
    assert.equal(
        raw.includes('public_v4_rollout_stage (effective)'),
        true,
        'falta stage efectivo de public_v4 en resumen de deploy-hosting'
    );
    assert.equal(
        raw.includes('public_v4_rollout_policy_source (effective)'),
        true,
        'falta policy source efectivo de public_v4 en resumen de deploy-hosting'
    );
    assert.equal(
        raw.includes('PROD_MONITOR_ENABLE_PUBLIC_V4_ROLLOUT'),
        true,
        'falta persistencia de variable de monitor public_v4 en deploy-hosting'
    );
    assert.equal(
        raw.includes(
            "enable_public_v4_rollout_monitor: process.env.PUBLIC_V4_ENABLE_MONITOR_EFFECTIVE || 'false'"
        ),
        true,
        'falta propagacion de monitor public_v4 al dispatch de prod-monitor'
    );
});
