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
    'deploy-frontend-selfhosted.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return {
        raw,
        parsed: yaml.parse(raw),
    };
}

test('deploy-frontend-selfhosted no depende de label kimi y mantiene runner windows self-hosted', () => {
    const { raw } = loadWorkflow();
    assert.equal(raw.includes('runs-on: [self-hosted, Windows]'), true);
    assert.equal(raw.includes('runs-on: [self-hosted, Windows, kimi]'), false);
});

test('deploy-frontend-selfhosted evalua y gestiona incidente dedicado de telemedicina', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.deploy?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        parsed?.permissions?.issues,
        'write',
        'falta permiso issues: write en deploy-frontend-selfhosted'
    );

    for (const expectedStep of [
        'Evaluate telemedicine health after frontend deploy',
        'Create or update telemedicine incident (self-hosted deploy)',
        'Close telemedicine incident when recovered (self-hosted deploy)',
        'Deployment summary',
    ]) {
        assert.equal(
            stepNames.includes(expectedStep),
            true,
            `falta step telemedicina en deploy-frontend-selfhosted: ${expectedStep}`
        );
    }

    for (const snippet of [
        'TELEMEDICINE_SELFHOSTED_STATUS',
        'TELEMEDICINE_SELFHOSTED_REASON',
        'TELEMEDICINE_SELFHOSTED_FAILURES',
        'TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES',
        'id: build_astro_routes',
        'id: deploy_frontend_bundle',
        'id: validate_public_frontend',
        'BUILD_ASTRO_OUTCOME: ${{ steps.build_astro_routes.outcome }}',
        'DEPLOY_BUNDLE_OUTCOME: ${{ steps.deploy_frontend_bundle.outcome }}',
        'VALIDATE_PUBLIC_FRONTEND_OUTCOME: ${{ steps.validate_public_frontend.outcome }}',
        'function Count-NonTeleFailures',
        '$nonTeleFailures = Count-NonTeleFailures @(',
        "non_tele:${process.env.TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES || '-1'}",
        '[ALERTA PROD] Deploy Frontend Self-Hosted telemedicina degradada',
        'deploy-frontend-selfhosted-telemedicine-signal:',
        "(env.TELEMEDICINE_SELFHOSTED_STATUS == 'degraded' || env.TELEMEDICINE_SELFHOSTED_STATUS == 'unknown')",
        "env.TELEMEDICINE_SELFHOSTED_STATUS == 'healthy'",
        'telemedicine_selfhosted_non_tele_failures: ``$env:TELEMEDICINE_SELFHOSTED_NON_TELE_FAILURES``',
        'telemedicine_selfhosted_step_outcome',
        "reason.includes('diagnostics_critical')",
        "reason.includes('hard_failures:')",
        "reason.includes('hard_failures_invalid')",
        "reason.includes('health_unavailable')",
        "reason.includes('health_parse_error')",
        "reason.includes('telemedicine_missing')",
        "reason.includes('not_configured')",
        ": 'severity:warning';",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring telemedicina self-hosted: ${snippet}`
        );
    }
});

test('deploy-frontend-selfhosted resuelve y verifica turneroPilot con reporte dedicado', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.deploy?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStep of [
        'Resolve turneroPilot clinic profile (self-hosted deploy)',
        'Verify turneroPilot remote after self-hosted deploy',
        'Write turneroPilot report (self-hosted deploy)',
        'Upload turneroPilot report (self-hosted deploy)',
        'Fail self-hosted deploy when turneroPilot blocks release',
    ]) {
        assert.equal(
            stepNames.includes(expectedStep),
            true,
            `falta step turneroPilot en deploy-frontend-selfhosted: ${expectedStep}`
        );
    }

    for (const snippet of [
        'TURNERO_PILOT_SELFHOSTED_STATUS: unknown',
        'TURNERO_PILOT_SELFHOSTED_REASON: not_evaluated',
        'TURNERO_PILOT_REMOTE_STATUS: unknown',
        'TURNERO_PILOT_REMOTE_REASON: not_evaluated',
        'TURNERO_PILOT_RECOVERY_TARGETS: none',
        'node bin/turnero-clinic-profile.js status --json',
        'node bin/turnero-clinic-profile.js verify-remote --base-url $env:TARGET_DOMAIN --json',
        "TURNERO_PILOT_RELEASE_MODE == 'web_pilot' && env.TURNERO_PILOT_REMOTE_STATUS == 'blocked'",
        'verification/last-turnero-pilot-selfhosted.json',
        'deploy-frontend-selfhosted-turnero-pilot-report',
        'turnero_pilot_local_status: ``$env:TURNERO_PILOT_SELFHOSTED_STATUS``',
        'turnero_pilot_remote_status: ``$env:TURNERO_PILOT_REMOTE_STATUS``',
        'turnero_pilot_remote_deployed_commit: ``$env:TURNERO_PILOT_REMOTE_DEPLOYED_COMMIT``',
        'turnero_pilot_recovery_targets: ``$env:TURNERO_PILOT_RECOVERY_TARGETS``',
        'TURNERO_PILOT_RECOVERY_TARGETS=$recoveryTargetsLabel',
        'recoveryTargets = @($recoveryTargets)',
        'turnero_pilot_report: ``verification/last-turnero-pilot-selfhosted.json``',
        'turnero_pilot_status_manifest: ``.selfhosted-cutover/turnero-pilot-status.json``',
        'turnero_pilot_remote_manifest: ``.selfhosted-cutover/turnero-pilot-remote.json``',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de verificacion turneroPilot self-hosted: ${snippet}`
        );
    }
});

test('deploy-frontend-selfhosted publica las superficies canonicas del turnero y el bundle desktop oficial', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        "'fonts'",
        "'images'",
        "'content'",
        "'js'",
        "'app-downloads'",
        "'desktop-updates'",
        "'admin-v3.css'",
        "'operador-turnos.html'",
        "'kiosco-turnos.html'",
        "'sala-turnos.html'",
        "'queue-ops.css'",
        "'queue-kiosk.css'",
        "'queue-display.css'",
        "'styles.css'",
        "'styles-deferred.css'",
        "'script.js'",
        "'sw.js'",
        "'manifest.json'",
        "'favicon.ico'",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta artefacto publico canonico en deploy-frontend-selfhosted: ${snippet}`
        );
    }
});

test('deploy-frontend-selfhosted gestiona incidente dedicado de turneroPilot', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.deploy?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStep of [
        'Create or update turneroPilot incident (self-hosted deploy)',
        'Close turneroPilot incident when recovered (self-hosted deploy)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStep),
            true,
            `falta step de incidente turneroPilot en deploy-frontend-selfhosted: ${expectedStep}`
        );
    }

    for (const snippet of [
        '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado',
        'deploy-frontend-selfhosted-turnero-pilot-signal:',
        'turnero_pilot_local_status:',
        'turnero_pilot_remote_clinic_id:',
        'turnero_pilot_remote_profile_fingerprint:',
        'turnero_pilot_remote_deployed_commit:',
        'turnero_pilot_recovery_targets:',
        'Recuperado automaticamente por deploy-frontend-selfhosted.',
        "env.TURNERO_PILOT_RELEASE_MODE == 'web_pilot' && env.TURNERO_PILOT_REMOTE_STATUS == 'blocked'",
        "env.TURNERO_PILOT_RELEASE_MODE == 'web_pilot' && (env.TURNERO_PILOT_REMOTE_STATUS == 'ready' || env.TURNERO_PILOT_REMOTE_STATUS == 'not_required')",
        'TURNERO_PILOT_RECOVERY_TARGETS: ${{ env.TURNERO_PILOT_RECOVERY_TARGETS }}',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de incidente turneroPilot self-hosted: ${snippet}`
        );
    }
});

test('deploy-frontend-selfhosted gestiona incidente de ruta bloqueada con contexto del piloto', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.deploy?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStep of [
        'Evaluate self-hosted deploy route',
        'Create or update self-hosted route incident',
        'Close self-hosted route incident when recovered',
    ]) {
        assert.equal(
            stepNames.includes(expectedStep),
            true,
            `falta step de ruta self-hosted en deploy-frontend-selfhosted: ${expectedStep}`
        );
    }

    for (const snippet of [
        'SELFHOSTED_ROUTE_STATUS: unknown',
        'SELFHOSTED_ROUTE_REASON: not_evaluated',
        '[ALERTA PROD] Deploy Frontend Self-Hosted ruta bloqueada',
        'deploy-frontend-selfhosted-route-signal:',
        'selfhosted_route_status:',
        'selfhosted_route_reason:',
        'turnero_pilot_clinic_id:',
        'turnero_pilot_profile_fingerprint:',
        'turnero_pilot_release_mode:',
        'turnero_pilot_recovery_targets:',
        "env.SELFHOSTED_ROUTE_STATUS == 'blocked'",
        "env.SELFHOSTED_ROUTE_STATUS == 'ready'",
        'selfhosted_route_status: ``$env:SELFHOSTED_ROUTE_STATUS``',
        'selfhosted_route_reason: ``$env:SELFHOSTED_ROUTE_REASON``',
        'TURNERO_PILOT_RECOVERY_TARGETS: ${{ env.TURNERO_PILOT_RECOVERY_TARGETS }}',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de ruta self-hosted: ${snippet}`
        );
    }
});
