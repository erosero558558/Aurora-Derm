#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const repoRoot = resolve(__dirname, '..');

function read(relativePath) {
    return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

test('Public V3 approval contract queda declarado en staging, hosting y premium QA', () => {
    const deployStaging = read('.github/workflows/deploy-staging.yml');
    const deployHosting = read('.github/workflows/deploy-hosting.yml');
    const premiumQa = read('.github/workflows/frontend-premium-qa.yml');

    assert.equal(
        deployStaging.includes(
            'echo "- approval_contract: \\`routing_smoke + conversion_smoke + staging_acceptance_gate + artifact:staging-acceptance-evidence\\`";'
        ),
        true,
        'deploy-staging no declara el contrato de aprobacion esperado'
    );

    assert.equal(
        deployHosting.includes(
            'echo "- approval_contract: \\`routing_smoke + conversion_smoke + staging_acceptance_gate + artifact:canary-staging-acceptance-evidence\\`";'
        ),
        true,
        'deploy-hosting no declara el contrato canary esperado'
    );

    assert.equal(
        deployHosting.includes(
            'echo "- approval_contract_dependency: \\`deploy-canary + canary-staging-acceptance-evidence\\`";'
        ),
        true,
        'deploy-hosting no declara la dependencia de aprobacion entre canary y produccion'
    );

    assert.equal(
        deployHosting.includes(
            'echo "- production_cutover_contract: \\`routing_smoke + conversion_smoke + artifact:public-cutover-evidence\\`";'
        ),
        true,
        'deploy-hosting no declara el contrato de cutover en produccion'
    );

    assert.equal(
        premiumQa.includes(
            'echo "- approval_contract: \\`premium_frontend_qa + lighthouse + performance_gate + visual_baseline\\`";'
        ),
        true,
        'frontend-premium-qa no declara el contrato de aprobacion esperado'
    );
});
