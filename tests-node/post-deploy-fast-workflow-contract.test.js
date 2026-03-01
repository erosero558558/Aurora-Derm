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
        raw.includes('Post-Deploy Fast Lane fallando'),
        true,
        'falta titulo canonico de incidente fast lane'
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
        raw.includes('Admin rollout stage profile (fast):'),
        true,
        'falta linea de stage profile en resumen fast lane'
    );
    assert.equal(
        stepNames.includes('Publicar reporte gate admin rollout (fast)'),
        true,
        'falta publicacion de artefacto de reporte admin rollout en fast lane'
    );
    assert.equal(
        raw.includes('verification/last-admin-ui-rollout-gate-fast.json'),
        true,
        'falta ruta canonica del reporte admin rollout fast'
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
        raw.includes('admin_rollout_stage_profile'),
        true,
        'falta trazabilidad de stage profile en incidente fast lane'
    );
    assert.equal(
        raw.includes('admin_rollout_policy_source'),
        true,
        'falta trazabilidad de policy source en incidente fast lane'
    );
});

test('post-deploy-fast expone inputs para propagacion de admin rollout', () => {
    const { parsed } = loadWorkflow();
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    const requiredInputs = [
        'admin_rollout_stage',
        'admin_rollout_skip_runtime_smoke',
        'admin_rollout_allow_feature_api_failure',
        'admin_rollout_allow_missing_flag',
    ];

    for (const inputName of requiredInputs) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }
});
