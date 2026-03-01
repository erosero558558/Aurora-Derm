#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const yaml = require('yaml');

const STAGING_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'deploy-staging.yml'
);
const HOSTING_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'deploy-hosting.yml'
);

function loadWorkflow(filePath) {
    const raw = readFileSync(filePath, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

function stepNames(steps) {
    return (steps || []).map((step) => String(step?.name || ''));
}

test('deploy-staging incluye validacion de routing y conversion ES/EN post-deploy', () => {
    const { raw, parsed } = loadWorkflow(STAGING_WORKFLOW_PATH);
    const steps = parsed?.jobs?.deploy?.steps || [];
    const names = stepNames(steps);

    assert.equal(
        names.includes('Validar routing publico ES/EN + redirects (staging)'),
        true,
        'falta step de validacion de routing publico en deploy-staging'
    );
    assert.equal(
        names.includes('Validar conversion publica ES/EN (staging)'),
        true,
        'falta step de validacion de conversion publica en deploy-staging'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-routing-smoke.js --base-url "${PROD_URL}" --label "staging" --output ".staging-acceptance/routing-smoke.json"'
        ),
        true,
        'falta comando smoke de routing en deploy-staging'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-conversion-smoke.js --base-url "${PROD_URL}" --label "staging-conversion" --output ".staging-acceptance/conversion-smoke.json"'
        ),
        true,
        'falta comando smoke de conversion en deploy-staging'
    );
    assert.equal(
        names.includes(
            'Gate de aceptacion publica staging (visual + funcional + performance)'
        ),
        true,
        'falta gate de aceptacion staging en deploy-staging'
    );
    assert.equal(
        names.includes('Upload staging acceptance evidence'),
        true,
        'falta upload de evidencia de aceptacion staging en deploy-staging'
    );
    assert.equal(
        names.includes('Staging summary'),
        true,
        'falta summary de staging con checklist/evidencia'
    );
    assert.equal(
        raw.includes(
            'node bin/run-staging-acceptance-gate.js --base-url "${PROD_URL}" --label "staging" --out-dir ".staging-acceptance"'
        ),
        true,
        'falta comando de gate de aceptacion staging en deploy-staging'
    );
});

test('deploy-hosting valida routing y conversion publica en canary y produccion', () => {
    const { raw, parsed } = loadWorkflow(HOSTING_WORKFLOW_PATH);
    const canarySteps = parsed?.jobs?.['deploy-canary']?.steps || [];
    const prodSteps = parsed?.jobs?.['deploy-prod']?.steps || [];

    assert.equal(
        stepNames(canarySteps).includes(
            'Validate public routing ES/EN + redirects (Staging)'
        ),
        true,
        'falta step de routing en deploy-canary'
    );
    assert.equal(
        stepNames(canarySteps).includes(
            'Validate public conversion hooks ES/EN (Staging)'
        ),
        true,
        'falta step de conversion en deploy-canary'
    );
    assert.equal(
        stepNames(prodSteps).includes(
            'Validate public routing ES/EN + redirects (Prod)'
        ),
        true,
        'falta step de routing en deploy-prod'
    );
    assert.equal(
        stepNames(prodSteps).includes(
            'Validate public conversion hooks ES/EN (Prod)'
        ),
        true,
        'falta step de conversion en deploy-prod'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-routing-smoke.js --base-url "${STAGING_URL}" --label "staging-canary" --output ".staging-acceptance/routing-smoke.json"'
        ),
        true,
        'falta comando smoke de routing para staging-canary'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-conversion-smoke.js --base-url "${STAGING_URL}" --label "staging-canary-conversion" --output ".staging-acceptance/conversion-smoke.json"'
        ),
        true,
        'falta comando smoke de conversion para staging-canary'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-routing-smoke.js --base-url "${PROD_URL}" --label "production" --output ".public-cutover/routing-smoke.json"'
        ),
        true,
        'falta comando smoke de routing para produccion'
    );
    assert.equal(
        raw.includes(
            'node bin/check-public-conversion-smoke.js --base-url "${PROD_URL}" --label "production-conversion" --output ".public-cutover/conversion-smoke.json"'
        ),
        true,
        'falta comando smoke de conversion para produccion'
    );
    assert.equal(
        stepNames(canarySteps).includes(
            'Run staging acceptance gate (visual + funcional + performance)'
        ),
        true,
        'falta step de gate de aceptacion en deploy-canary'
    );
    assert.equal(
        stepNames(canarySteps).includes('Upload staging acceptance evidence'),
        true,
        'falta upload de evidencia de aceptacion en deploy-canary'
    );
    assert.equal(
        raw.includes(
            'node bin/run-staging-acceptance-gate.js --base-url "${STAGING_URL}" --label "staging-canary" --out-dir ".staging-acceptance"'
        ),
        true,
        'falta comando de gate de aceptacion para staging-canary'
    );
    assert.equal(
        raw.includes('npx playwright install --with-deps chromium'),
        true,
        'falta instalacion de Playwright para acceptance gate'
    );
    for (const expectedStepName of [
        'Stamp public cutover start',
        'Write public cutover manifest',
        'Upload public cutover evidence',
        'Persist public cutover monitor window',
        'Bootstrap prod-monitor post-cutover',
    ]) {
        assert.equal(
            stepNames(prodSteps).includes(expectedStepName),
            true,
            `falta step de cutover en produccion: ${expectedStepName}`
        );
    }
    for (const snippet of [
        'node bin/write-public-cutover-manifest.js',
        'public-cutover-evidence',
        'PROD_MONITOR_ENABLE_PUBLIC_CUTOVER',
        'PUBLIC_CUTOVER_STARTED_AT',
        'PUBLIC_CUTOVER_WINDOW_HOURS',
        "workflow_id: 'prod-monitor.yml'",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de cutover/monitor: ${snippet}`
        );
    }
});

test('deploy-hosting aplica politica bloqueante de staging antes de produccion', () => {
    const { raw, parsed } = loadWorkflow(HOSTING_WORKFLOW_PATH);
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};
    const canarySteps = parsed?.jobs?.['deploy-canary']?.steps || [];
    const prodSteps = parsed?.jobs?.['deploy-prod']?.steps || [];

    for (const inputName of [
        'require_staging_canary',
        'allow_prod_without_staging',
        'enable_public_cutover_monitor',
        'public_cutover_window_hours',
        'dispatch_public_cutover_monitor',
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(inputs, inputName),
            true,
            `falta input de politica canary: ${inputName}`
        );
    }

    const canaryNames = stepNames(canarySteps);
    const prodNames = stepNames(prodSteps);
    for (const stepName of [
        'Enforce staging canary gate policy',
        'Canary summary',
    ]) {
        assert.equal(
            canaryNames.includes(stepName),
            true,
            `falta step canary policy: ${stepName}`
        );
    }
    assert.equal(
        prodNames.includes('Production summary'),
        true,
        'falta summary de produccion con estado de gate'
    );

    for (const snippet of [
        'REQUIRE_STAGING_CANARY',
        'ALLOW_PROD_WITHOUT_STAGING',
        'ENABLE_PUBLIC_CUTOVER_MONITOR',
        'PUBLIC_CUTOVER_WINDOW_HOURS',
        'DISPATCH_PUBLIC_CUTOVER_MONITOR',
        'Politica bloqueante: require_staging_canary=true y faltan secretos STAGING_FTP_*.',
        'allow_prod_without_staging=true',
        'needs.deploy-canary.result',
        'PUBLIC_CUTOVER_STARTED_AT',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de politica staging/prod: ${snippet}`
        );
    }
});

test('deploy-hosting publica fallback manual cuando git-sync no materializa Public V3', () => {
    const { raw, parsed } = loadWorkflow(HOSTING_WORKFLOW_PATH);
    const prodSteps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const prodNames = stepNames(prodSteps);

    assert.equal(
        prodNames.includes('Manual fallback notes for git-sync'),
        true,
        'falta step de fallback manual para git-sync en produccion'
    );

    for (const snippet of [
        'bash ./bin/deploy-public-v3-live.sh',
        'El script recompone \\`es/\\`, \\`en/\\`, \\`_astro/\\`, valida \\`/usr/sbin/nginx -t\\` y recarga Nginx.',
        'Tambien corrige redirects canonicos para evitar \\`:8080\\` detras de Cloudflare.',
        'Compat temporal: \\`deploy-public-v2-live.sh\\` existe como shim y delega a V3.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta detalle de fallback manual en workflow: ${snippet}`
        );
    }
});

test('deploy staging y hosting publican el contrato de aprobacion Public V3 en sus summaries', () => {
    const { raw: stagingRaw, parsed: stagingParsed } = loadWorkflow(
        STAGING_WORKFLOW_PATH
    );
    const { raw: hostingRaw, parsed: hostingParsed } = loadWorkflow(
        HOSTING_WORKFLOW_PATH
    );
    const stagingSteps = stagingParsed?.jobs?.deploy?.steps || [];
    const canarySteps = hostingParsed?.jobs?.['deploy-canary']?.steps || [];
    const prodSteps = hostingParsed?.jobs?.['deploy-prod']?.steps || [];

    assert.equal(
        stepNames(stagingSteps).includes('Staging summary'),
        true,
        'falta Staging summary en deploy-staging'
    );
    assert.equal(
        stepNames(canarySteps).includes('Canary summary'),
        true,
        'falta Canary summary en deploy-hosting'
    );
    assert.equal(
        stepNames(prodSteps).includes('Production summary'),
        true,
        'falta Production summary en deploy-hosting'
    );

    for (const [workflowName, raw, snippet] of [
        [
            'deploy-staging',
            stagingRaw,
            'echo "- approval_contract: \\`routing_smoke + conversion_smoke + staging_acceptance_gate + artifact:staging-acceptance-evidence\\`";',
        ],
        [
            'deploy-hosting canary',
            hostingRaw,
            'echo "- approval_contract: \\`routing_smoke + conversion_smoke + staging_acceptance_gate + artifact:canary-staging-acceptance-evidence\\`";',
        ],
        [
            'deploy-hosting production dependency',
            hostingRaw,
            'echo "- approval_contract_dependency: \\`deploy-canary + canary-staging-acceptance-evidence\\`";',
        ],
        [
            'deploy-hosting production cutover',
            hostingRaw,
            'echo "- production_cutover_contract: \\`routing_smoke + conversion_smoke + artifact:public-cutover-evidence\\`";',
        ],
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta contrato de aprobacion Public V3 en ${workflowName}`
        );
    }
});
