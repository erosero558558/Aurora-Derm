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
const REPAIR_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'repair-git-sync.yml'
);
const DIAGNOSE_WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'diagnose-host-connectivity.yml'
);

function loadWorkflow(filePath = WORKFLOW_PATH) {
    const raw = readFileSync(filePath, 'utf8');
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
        'admin_rollout_require_openclaw_auth_fast',
        'admin_rollout_require_openclaw_live_smoke_fast',
        'admin_rollout_skip_runtime_smoke_gate',
        'admin_rollout_allow_feature_api_failure_gate',
        'admin_rollout_allow_missing_flag_gate',
        'admin_rollout_require_openclaw_auth_gate',
        'admin_rollout_require_openclaw_live_smoke_gate',
    ];

    for (const inputName of requiredInputs) {
        assert.equal(
            typeof inputs[inputName] === 'object',
            true,
            `falta input workflow_dispatch: ${inputName}`
        );
    }
});

test('deploy-hosting exporta credenciales diagnostics al deploy y verify-remote', () => {
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
            `falta wiring de diagnostics en deploy-hosting: ${snippet}`
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
    assert.equal(
        permissions.issues,
        'write',
        'deploy-hosting debe tener issues: write para incidentes automaticos'
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
    assert.equal(
        raw.includes(
            'verification/last-admin-ui-rollout-gate-deploy-hosting.json'
        ),
        true,
        'falta reporte canonico admin rollout para deploy-hosting'
    );
    assert.equal(
        raw.includes('deploy-hosting-admin-rollout-report'),
        true,
        'falta publicacion de artefacto admin rollout en deploy-hosting'
    );
});

test('deploy-hosting resuelve y resume el clinic-profile del piloto web antes del publish', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    assert.equal(
        stepNames.includes(
            'Resolver clinic-profile del piloto web (deploy-hosting)'
        ),
        true,
        'falta step de preflight clinic-profile en deploy-hosting'
    );
    assert.equal(
        stepNames.includes('Verificar turneroPilot remoto deploy-hosting'),
        true,
        'falta step de verify-remote turneroPilot en deploy-hosting'
    );
    assert.equal(
        stepNames.includes(
            'Fail deploy-hosting when turneroPilot remoto bloquea release'
        ),
        true,
        'falta step de fail final cuando verify-remote bloquea el piloto'
    );

    for (const snippet of [
        'TURNERO_PILOT_DEPLOY_STATUS: unknown',
        'TURNERO_PILOT_REMOTE_STATUS: unknown',
        'TURNERO_PILOT_RECOVERY_TARGETS: none',
        'node bin/turnero-clinic-profile.js status --json',
        'node bin/turnero-clinic-profile.js verify-remote --base-url "${PROD_URL}" --json',
        'turnero_pilot_deploy_status: \\`${TURNERO_PILOT_DEPLOY_STATUS}\\`',
        'turnero_pilot_clinic_id: \\`${TURNERO_PILOT_CLINIC_ID}\\`',
        'turnero_pilot_profile_fingerprint: \\`${TURNERO_PILOT_PROFILE_FINGERPRINT}\\`',
        'turnero_pilot_remote_status: \\`${TURNERO_PILOT_REMOTE_STATUS}\\`',
        'turnero_pilot_remote_deployed_commit: \\`${TURNERO_PILOT_REMOTE_DEPLOYED_COMMIT}\\`',
        'turnero_pilot_recovery_targets: \\`${TURNERO_PILOT_RECOVERY_TARGETS}\\`',
        'turnero_pilot_postdeploy_allowed: \\`${TURNERO_PILOT_POSTDEPLOY_ALLOWED}\\`',
        'turnero_pilot_status_manifest: \\`.public-cutover/turnero-pilot-status.json\\`',
        'turnero_pilot_remote_manifest: \\`.public-cutover/turnero-pilot-remote.json\\`',
        'node bin/write-turnero-pilot-remote-status.js',
        'const turneroPilotRecoveryTargets = String(',
        'turnero_pilot: {',
        "status: process.env.TURNERO_PILOT_DEPLOY_STATUS || 'unknown'",
        'recovery_targets: turneroPilotRecoveryTargets',
        'remote: {',
        "status: process.env.TURNERO_PILOT_REMOTE_STATUS || 'unknown'",
        'Turnero pilot deploy blocked (',
        'Turnero pilot remote verify blocked deploy-hosting (',
        "steps.resolve_postdeploy.outputs.run_fast == 'true' && env.TURNERO_PILOT_POSTDEPLOY_ALLOWED != 'false'",
        "steps.resolve_postdeploy.outputs.run_gate == 'true' && env.TURNERO_PILOT_POSTDEPLOY_ALLOWED != 'false'",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring turneroPilot en deploy-hosting: ${snippet}`
        );
    }
});

test('deploy-hosting clasifica bloqueos de conectividad del runner en el preflight de transporte', () => {
    const { raw } = loadWorkflow();

    for (const snippet of [
        'TRANSPORT_PREFLIGHT_REASON: not_evaluated',
        'TRANSPORT_PREFLIGHT_TARGET: not_evaluated',
        'mkdir -p .public-cutover',
        'echo "TRANSPORT_PREFLIGHT_REASON=ok" >> "$GITHUB_ENV"',
        'echo "TRANSPORT_PREFLIGHT_REASON=runner_tcp_unreachable" >> "$GITHUB_ENV"',
        'node bin/write-transport-preflight.js',
        '--reason "runner_tcp_unreachable"',
        '--reason "ok"',
        '--reachable "false"',
        '--reachable "true"',
        '--turnero-clinic-id "${TURNERO_PILOT_CLINIC_ID}"',
        '--turnero-profile-fingerprint "${TURNERO_PILOT_PROFILE_FINGERPRINT}"',
        '--turnero-release-mode "${TURNERO_PILOT_RELEASE_MODE}"',
        '--turnero-recovery-targets "${TURNERO_PILOT_RECOVERY_TARGETS}"',
        '.public-cutover/transport-preflight.json',
        'Hydrate transport preflight status',
        'PREFLIGHT_OUTCOME: ${{ steps.preflight_prod.outcome }}',
        'TRANSPORT_PREFLIGHT_TARGET=${target}',
        'bin/write-admin-rollout-placeholder-report.js',
        'Hydrate admin rollout report placeholder (deploy-hosting)',
        "hashFiles('verification/last-admin-ui-rollout-gate-deploy-hosting.json') == ''",
        'include-hidden-files: true',
        'transport_preflight_reason: \\`${TRANSPORT_PREFLIGHT_REASON}\\`',
        'transport_preflight_target: \\`${TRANSPORT_PREFLIGHT_TARGET}\\`',
        'transport_preflight_artifact: \\`.public-cutover/transport-preflight.json\\`',
        '::error::No se puede abrir ${HOST}:${PORT} desde GitHub Runner.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta clasificacion de bloqueo de red en deploy-hosting: ${snippet}`
        );
    }
});

test('deploy-hosting gestiona incidente dedicado de transporte runner-host', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    const requiredStepNames = [
        'Crear/actualizar incidente de transporte deploy-hosting',
        'Cerrar incidente de transporte deploy-hosting al recuperar',
    ];
    for (const expectedStepName of requiredStepNames) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de incidente de transporte en deploy-hosting: ${expectedStepName}`
        );
    }

    const requiredSnippets = [
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && (env.FORCE_TRANSPORT_DEPLOY == 'true' || env.DEPLOY_METHOD != 'git-sync') && env.TRANSPORT_PREFLIGHT_REASON == 'runner_tcp_unreachable' }}",
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && (env.FORCE_TRANSPORT_DEPLOY == 'true' || env.DEPLOY_METHOD != 'git-sync') && env.TRANSPORT_PREFLIGHT_REASON == 'ok' }}",
        "const title = '[ALERTA PROD] Deploy Hosting transporte bloqueado desde GitHub Runner';",
        'deploy-hosting-transport-signal:',
        "const signal = `reason:${process.env.TRANSPORT_PREFLIGHT_REASON || 'unknown'}|target:${process.env.TRANSPORT_PREFLIGHT_TARGET || 'unknown'}|clinic:${process.env.TURNERO_PILOT_CLINIC_ID || 'unknown'}|fp:${process.env.TURNERO_PILOT_PROFILE_FINGERPRINT || 'unknown'}|release:${process.env.TURNERO_PILOT_RELEASE_MODE || 'unknown'}`;",
        "`- transport_preflight_reason: ${process.env.TRANSPORT_PREFLIGHT_REASON || 'unknown'}`",
        "`- transport_preflight_target: ${process.env.TRANSPORT_PREFLIGHT_TARGET || 'unknown'}`",
        "`- turnero_pilot_clinic_id: ${process.env.TURNERO_PILOT_CLINIC_ID || 'unknown'}`",
        "`- turnero_pilot_profile_fingerprint: ${process.env.TURNERO_PILOT_PROFILE_FINGERPRINT || 'unknown'}`",
        "`- turnero_pilot_release_mode: ${process.env.TURNERO_PILOT_RELEASE_MODE || 'unknown'}`",
        "`- turnero_pilot_recovery_targets: ${process.env.TURNERO_PILOT_RECOVERY_TARGETS || 'none'}`",
        'Issue deploy-hosting transporte ya refleja la misma senal',
        'Issue deploy-hosting transporte creado',
        'Issue deploy-hosting transporte cerrado',
        'TRANSPORT_PREFLIGHT_REASON: ${{ env.TRANSPORT_PREFLIGHT_REASON }}',
        'TRANSPORT_PREFLIGHT_TARGET: ${{ env.TRANSPORT_PREFLIGHT_TARGET }}',
        'TURNERO_PILOT_CLINIC_ID: ${{ env.TURNERO_PILOT_CLINIC_ID }}',
        'TURNERO_PILOT_PROFILE_FINGERPRINT: ${{ env.TURNERO_PILOT_PROFILE_FINGERPRINT }}',
        'TURNERO_PILOT_RELEASE_MODE: ${{ env.TURNERO_PILOT_RELEASE_MODE }}',
        'TURNERO_PILOT_RECOVERY_TARGETS: ${{ env.TURNERO_PILOT_RECOVERY_TARGETS }}',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de incidente de transporte en deploy-hosting: ${snippet}`
        );
    }
});

test('deploy-hosting dispara diagnostico de conectividad cuando falla el preflight de transporte', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Disparar diagnostico de conectividad desde deploy-hosting',
        'Hydrate connectivity diagnose status (deploy-hosting)',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de diagnostico de conectividad en deploy-hosting: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'CONNECTIVITY_DIAGNOSE_RUN_STATUS: not_requested',
        "CONNECTIVITY_DIAGNOSE_RUN_URL: ''",
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && (env.FORCE_TRANSPORT_DEPLOY == 'true' || env.DEPLOY_METHOD != 'git-sync') && env.TRANSPORT_PREFLIGHT_REASON == 'runner_tcp_unreachable' }}",
        "const workflowId = 'diagnose-host-connectivity.yml';",
        'const dispatchStartedAtIso = new Date(dispatchStartedAt).toISOString();',
        'workflow_id: workflowId',
        "turnero_clinic_id: String(process.env.TURNERO_PILOT_CLINIC_ID || '')",
        'turnero_profile_fingerprint: String(',
        "turnero_release_mode: String(process.env.TURNERO_PILOT_RELEASE_MODE || '')",
        "Workflow ${workflowId} disparado desde deploy-hosting (run_id=${observedRun.id}, status=${observedRun.status}, match=${observedRun.head_sha === headSha ? 'head_sha' : 'dispatch_window'}, url=${observedRun.html_url}).",
        'Workflow ${workflowId} disparado desde deploy-hosting (run no observado aun).',
        'CONNECTIVITY_DIAGNOSE_RUN_ID_INPUT',
        "core.setOutput(\n                        'connectivity_diagnose_dispatched_at',\n                        dispatchStartedAtIso\n                      );",
        'const lowerBoundMs = Number.isFinite(dispatchStartedAtMs)',
        'const upperBoundMs = Date.now() + 5_000;',
        'exactHeadSha: Boolean(headSha && run.head_sha && run.head_sha === headSha)',
        'createdAfterDispatch: Number.isFinite(dispatchStartedAtMs)',
        'CONNECTIVITY_DIAGNOSE_DISPATCHED_AT_INPUT',
        'async function listRecentRuns() {',
        "'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs'",
        'response.data?.workflow_runs',
        'response.data.workflow_runs',
        'function formatRecentRuns(runs) {',
        'for (let attempt = 0; attempt < 12; attempt += 1)',
        'const dispatchTimestamp = normalizeRun(',
        'Hydrated late ${workflowId} run from deploy-hosting',
        "match=${observedRun.head_sha === headSha ? 'head_sha' : 'dispatch_window'}",
        'Hydrate connectivity diagnose status (deploy-hosting) still unresolved after retry window',
        'recent_runs=${recentSnapshot}',
        "core.setOutput('connectivity_diagnose_run_status', runStatus);",
        "core.setOutput('connectivity_diagnose_run_url', runUrl);",
        "core.exportVariable('CONNECTIVITY_DIAGNOSE_RUN_STATUS', runStatus);",
        "core.exportVariable('CONNECTIVITY_DIAGNOSE_RUN_URL', runUrl);",
        'CONNECTIVITY_DIAGNOSE_RUN_STATUS: ${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_status }}',
        'CONNECTIVITY_DIAGNOSE_RUN_URL: ${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_url }}',
        "`- connectivity_diagnose_run_status: ${process.env.CONNECTIVITY_DIAGNOSE_RUN_STATUS || 'not_requested'}`",
        "`- connectivity_diagnose_run_url: ${process.env.CONNECTIVITY_DIAGNOSE_RUN_URL || ''}`",
        'connectivity_diagnose_run_status: \\`${CONNECTIVITY_DIAGNOSE_RUN_STATUS}\\`',
        'connectivity_diagnose_run_url: \\`${CONNECTIVITY_DIAGNOSE_RUN_URL}\\`',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de diagnostico de conectividad en deploy-hosting: ${snippet}`
        );
    }
});

test('deploy-hosting evalua y gestiona incidente dedicado de telemedicina post-cutover', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    const requiredStepNames = [
        'Evaluar estado telemedicina deploy-hosting',
        'Crear/actualizar incidente telemedicina deploy-hosting',
        'Cerrar incidente telemedicina deploy-hosting al recuperar',
    ];
    for (const expectedStepName of requiredStepNames) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de telemedicina en deploy-hosting: ${expectedStepName}`
        );
    }

    const requiredSnippets = [
        'TELEMEDICINE_DEPLOY_STATUS: unknown',
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' }}",
        'VALIDATE_SECRETS_OUTCOME: ${{ steps.validate_secrets_prod.outcome }}',
        'PREFLIGHT_OUTCOME: ${{ steps.preflight_prod.outcome }}',
        'SMOKE_PROD_OUTCOME: ${{ steps.smoke_prod.outcome }}',
        'countNonTeleFailures',
        'process.env.SMOKE_PROD_OUTCOME,',
        "non_tele:${process.env.TELEMEDICINE_DEPLOY_NON_TELE_FAILURES || '-1'}",
        "const title = '[ALERTA PROD] Deploy Hosting telemedicina degradada';",
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_DEPLOY_STATUS == 'degraded' || env.TELEMEDICINE_DEPLOY_STATUS == 'unknown') }}",
        "if: ${{ success() && env.FTP_DRY_RUN != 'true' && github.event_name != 'workflow_dispatch' && env.TELEMEDICINE_DEPLOY_STATUS == 'healthy' }}",
        'deploy-hosting-telemedicine-signal:',
        'telemedicine_deploy_status: \\`${TELEMEDICINE_DEPLOY_STATUS}\\`',
        'telemedicine_deploy_reason: \\`${TELEMEDICINE_DEPLOY_REASON}\\`',
        'telemedicine_deploy_non_tele_failures: \\`${TELEMEDICINE_DEPLOY_NON_TELE_FAILURES}\\`',
        'telemedicine_deploy_step_outcome: \\`${{ steps.telemedicine_deploy.outcome }}\\`',
        "reason.includes('diagnostics_critical')",
        "reason.includes('hard_failures:')",
        "reason.includes('hard_failures_invalid')",
        "reason.includes('health_unavailable')",
        "reason.includes('health_parse_error')",
        "reason.includes('telemedicine_missing')",
        "reason.includes('not_configured')",
        ": 'severity:warning';",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de telemedicina deploy-hosting: ${snippet}`
        );
    }
});

test('deploy-hosting gestiona incidente dedicado de turneroPilot remoto post-cutover', () => {
    const { raw, parsed } = loadWorkflow();
    const steps = parsed?.jobs?.['deploy-prod']?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Crear/actualizar incidente turneroPilot deploy-hosting',
        'Cerrar incidente turneroPilot deploy-hosting al recuperar',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de incidente turneroPilot en deploy-hosting: ${expectedStepName}`
        );
    }

    for (const snippet of [
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && github.event_name != 'workflow_dispatch' && env.TURNERO_PILOT_RELEASE_MODE == 'web_pilot' && env.TURNERO_PILOT_REMOTE_STATUS == 'blocked' }}",
        "if: ${{ success() && env.FTP_DRY_RUN != 'true' && github.event_name != 'workflow_dispatch' && env.TURNERO_PILOT_RELEASE_MODE == 'web_pilot' && (env.TURNERO_PILOT_REMOTE_STATUS == 'ready' || env.TURNERO_PILOT_REMOTE_STATUS == 'not_required') }}",
        "const title = '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado';",
        'deploy-hosting-turnero-pilot-signal:',
        "const baseLabels = ['production-alert', 'deploy-hosting', 'turnero-pilot', 'severity:warning'];",
        'Issue deploy-hosting turneroPilot ya refleja la misma senal',
        'Issue deploy-hosting turneroPilot creado',
        'Issue deploy-hosting turneroPilot cerrado',
        'Recuperado automaticamente por verify-remote de deploy-hosting.',
        'turnero_pilot_recovery_targets:',
        'TURNERO_PILOT_REMOTE_CLINIC_ID: ${{ env.TURNERO_PILOT_REMOTE_CLINIC_ID }}',
        'TURNERO_PILOT_REMOTE_PROFILE_FINGERPRINT: ${{ env.TURNERO_PILOT_REMOTE_PROFILE_FINGERPRINT }}',
        'TURNERO_PILOT_REMOTE_DEPLOYED_COMMIT: ${{ env.TURNERO_PILOT_REMOTE_DEPLOYED_COMMIT }}',
        'TURNERO_PILOT_RECOVERY_TARGETS: ${{ env.TURNERO_PILOT_RECOVERY_TARGETS }}',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de incidente turneroPilot en deploy-hosting: ${snippet}`
        );
    }
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
    assert.equal(
        raw.includes(
            'admin_rollout_skip_runtime_smoke: process.env.ADMIN_ROLLOUT_SKIP_RUNTIME_SMOKE_FAST_EFFECTIVE'
        ),
        true,
        'falta propagacion de skip runtime smoke al dispatch fast'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_allow_feature_api_failure: process.env.ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE_FAST_EFFECTIVE'
        ),
        true,
        'falta propagacion de allow feature api failure al dispatch fast'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_allow_missing_flag: process.env.ADMIN_ROLLOUT_ALLOW_MISSING_FLAG_FAST_EFFECTIVE'
        ),
        true,
        'falta propagacion de allow missing flag al dispatch fast'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_require_openclaw_auth: process.env.ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_FAST_EFFECTIVE'
        ),
        true,
        'falta propagacion de require_openclaw_auth al dispatch fast'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_require_openclaw_live_smoke: process.env.ADMIN_ROLLOUT_REQUIRE_OPENCLAW_LIVE_SMOKE_FAST_EFFECTIVE'
        ),
        true,
        'falta propagacion de require_openclaw_live_smoke al dispatch fast'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_skip_runtime_smoke: process.env.ADMIN_ROLLOUT_SKIP_RUNTIME_SMOKE_GATE_EFFECTIVE'
        ),
        true,
        'falta propagacion de skip runtime smoke al dispatch gate'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_allow_feature_api_failure: process.env.ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE_GATE_EFFECTIVE'
        ),
        true,
        'falta propagacion de allow feature api failure al dispatch gate'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_allow_missing_flag: process.env.ADMIN_ROLLOUT_ALLOW_MISSING_FLAG_GATE_EFFECTIVE'
        ),
        true,
        'falta propagacion de allow missing flag al dispatch gate'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_require_openclaw_auth: process.env.ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_GATE_EFFECTIVE'
        ),
        true,
        'falta propagacion de require_openclaw_auth al dispatch gate'
    );
    assert.equal(
        raw.includes(
            'admin_rollout_require_openclaw_live_smoke: process.env.ADMIN_ROLLOUT_REQUIRE_OPENCLAW_LIVE_SMOKE_GATE_EFFECTIVE'
        ),
        true,
        'falta propagacion de require_openclaw_live_smoke al dispatch gate'
    );
});

test('repair-git-sync evalua y gestiona incidente dedicado de telemedicina post-repair', () => {
    const { raw, parsed } = loadWorkflow(REPAIR_WORKFLOW_PATH);
    const steps = parsed?.jobs?.repair?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));
    const permissions = parsed?.permissions || {};
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    assert.equal(
        permissions.issues,
        'write',
        'repair-git-sync debe mantener issues: write para incidentes automaticos'
    );
    assert.equal(
        permissions.actions,
        'write',
        'repair-git-sync debe tener actions: write para disparar deploy-hosting'
    );
    assert.equal(
        typeof inputs.dispatch_transport_fallback === 'object',
        true,
        'repair-git-sync debe exponer input dispatch_transport_fallback'
    );
    assert.equal(
        typeof inputs.dispatch_self_hosted_fallback === 'object',
        true,
        'repair-git-sync debe exponer input dispatch_self_hosted_fallback'
    );

    for (const expectedStepName of [
        'Evaluar estado telemedicina post-repair',
        'Evaluar fallback de transporte post-repair',
        'Disparar diagnostico de conectividad desde repair',
        'Disparar transport fallback desde repair',
        'Disparar self-hosted fallback desde repair',
        'Crear/actualizar incidente telemedicina de repair',
        'Cerrar incidente telemedicina de repair al recuperar',
        'Repair summary',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de telemedicina en repair-git-sync: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'TELEMEDICINE_REPAIR_STATUS: unknown',
        'TELEMEDICINE_REPAIR_NON_TELE_FAILURES: -1',
        'countNonTeleFailures',
        "non_tele:${process.env.TELEMEDICINE_REPAIR_NON_TELE_FAILURES || '-1'}",
        "const title = '[ALERTA PROD] Repair git sync telemedicina degradado';",
        "if: ${{ always() && github.event_name != 'workflow_dispatch' && (env.TELEMEDICINE_REPAIR_STATUS == 'degraded' || env.TELEMEDICINE_REPAIR_STATUS == 'unknown') }}",
        "if: ${{ success() && github.event_name != 'workflow_dispatch' && env.TELEMEDICINE_REPAIR_STATUS == 'healthy' }}",
        "if: ${{ failure() && github.event_name != 'workflow_dispatch' && ((env.TELEMEDICINE_REPAIR_STATUS != 'degraded' && env.TELEMEDICINE_REPAIR_STATUS != 'unknown') || env.TELEMEDICINE_REPAIR_NON_TELE_FAILURES != '0') }}",
        'repair-git-sync-telemedicine-signal:',
        'telemedicine_repair_status: \\`${TELEMEDICINE_REPAIR_STATUS}\\`',
        'telemedicine_repair_reason: \\`${TELEMEDICINE_REPAIR_REASON}\\`',
        'telemedicine_repair_non_tele_failures: \\`${TELEMEDICINE_REPAIR_NON_TELE_FAILURES}\\`',
        "telemedicine_repair_non_tele_failures: ${process.env.TELEMEDICINE_REPAIR_NON_TELE_FAILURES || '-1'}",
        'telemedicine_repair_step_outcome: \\`${{ steps.telemedicine_repair.outcome }}\\`',
        'AUTO_TRANSPORT_FALLBACK_AUTOMATION',
        'AUTO_SELF_HOSTED_FALLBACK_AUTOMATION',
        'DISPATCH_TRANSPORT_FALLBACK_INPUT',
        'DISPATCH_SELF_HOSTED_FALLBACK_INPUT',
        "const workflowId = 'diagnose-host-connectivity.yml';",
        "workflow_id: 'deploy-hosting.yml'",
        "const workflowId = 'deploy-frontend-selfhosted.yml';",
        "force_transport_deploy: 'true'",
        "allow_prod_without_staging: 'true'",
        "run_postdeploy_fast: 'false'",
        "run_postdeploy_gate: 'false'",
        "skip_public_conversion_smoke: 'true'",
        "protocol: 'auto'",
        "remote_dir: '/public_html/'",
        "run_build: 'true'",
        'connectivity_diagnose_dispatch_ready',
        'connectivity_diagnose_dispatch_mode',
        'connectivity_diagnose_run_status',
        'connectivity_diagnose_run_url',
        'self_hosted_fallback_dispatch_requested',
        'self_hosted_fallback_dispatch_ready',
        'self_hosted_fallback_state',
        'self_hosted_fallback_run_url',
        'transport_fallback_dispatch_ready',
        'transport_fallback_recommended',
        'transport_fallback_reason',
        'transport_fallback_failure_assets',
        'deploy-freshness',
        'health-public-sync-working-tree-dirty',
        'health-public-sync-telemetry-gap',
        'index-ref:script-entry',
        'index-asset-refs:style-entry',
        'const connectivityDiagnoseDispatchReady = recommended;',
        'const connectivityDiagnoseDispatchMode = !recommended',
        "? 'not_required'",
        "? 'with_fallback'",
        ": 'diagnose_only';",
        'env:\n                  CONNECTIVITY_DIAGNOSE_DISPATCH_MODE: ${{ steps.transport_fallback.outputs.connectivity_diagnose_dispatch_mode }}',
        'Hydrate connectivity diagnose status (repair)',
        'const dispatchStartedAtIso = new Date(dispatchStartedAt).toISOString();',
        "CONNECTIVITY_DIAGNOSE_RUN_ID: ''",
        'CONNECTIVITY_DIAGNOSE_RUN_STATUS: not_requested',
        'CONNECTIVITY_DIAGNOSE_DISPATCH_READY: ${{ steps.transport_fallback.outputs.connectivity_diagnose_dispatch_ready }}',
        "core.setOutput(\n                        'connectivity_diagnose_dispatched_at',\n                        dispatchStartedAtIso\n                      );",
        'const lowerBoundMs = Number.isFinite(dispatchStartedAtMs)',
        'const upperBoundMs = Date.now() + 5_000;',
        'exactHeadSha: Boolean(headSha && run.head_sha && run.head_sha === headSha)',
        'createdAfterDispatch: Number.isFinite(dispatchStartedAtMs)',
        'CONNECTIVITY_DIAGNOSE_DISPATCHED_AT_INPUT',
        'async function listRecentRuns() {',
        "'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs'",
        'response.data?.workflow_runs',
        'response.data.workflow_runs',
        'function formatRecentRuns(runs) {',
        'for (let attempt = 0; attempt < 12; attempt += 1)',
        'const dispatchTimestamp = normalizeRun(',
        'Hydrated late ${workflowId} run from repair',
        "match=${observedRun.head_sha === headSha ? 'head_sha' : 'dispatch_window'}",
        'Hydrate connectivity diagnose status (repair) still unresolved after retry window',
        'recent_runs=${recentSnapshot}',
        'connectivity_diagnose_dispatched: \\`${{ steps.transport_fallback.outputs.connectivity_diagnose_dispatch_ready }}\\`',
        'connectivity_diagnose_dispatch_mode: \\`${{ steps.transport_fallback.outputs.connectivity_diagnose_dispatch_mode }}\\`',
        'connectivity_diagnose_run_status: \\`${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_status }}\\`',
        'connectivity_diagnose_run_url: \\`${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_url }}\\`',
        'transport_fallback_dispatched: \\`${{ steps.transport_fallback.outputs.transport_fallback_dispatch_ready }}\\`',
        'self_hosted_fallback_dispatched: \\`${{ steps.transport_fallback.outputs.self_hosted_fallback_dispatch_ready }}\\`',
        'self_hosted_fallback_state: \\`${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state }}\\`',
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
            `falta wiring de telemedicina en repair-git-sync: ${snippet}`
        );
    }
});

test('repair-git-sync evalua y gestiona incidente dedicado de turneroPilot post-repair', () => {
    const { raw, parsed } = loadWorkflow(REPAIR_WORKFLOW_PATH);
    const steps = parsed?.jobs?.repair?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Evaluar estado turneroPilot post-repair',
        'Crear/actualizar incidente turneroPilot de repair',
        'Cerrar incidente turneroPilot de repair al recuperar',
        'Escribir reporte turneroPilot repair',
        'Publicar reporte turneroPilot repair',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de turneroPilot en repair-git-sync: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'TURNERO_PILOT_REPAIR_STATUS: unknown',
        'TURNERO_PILOT_REPAIR_REASON: not_evaluated',
        "TURNERO_PILOT_REPAIR_STATUS_RESOLVED: 'false'",
        "TURNERO_PILOT_REPAIR_VERIFY_REMOTE_REQUIRED: 'false'",
        'TURNERO_PILOT_REPAIR_RELEASE_MODE: unknown',
        "if: ${{ always() && github.event_name != 'workflow_dispatch' && env.TURNERO_PILOT_REPAIR_RELEASE_MODE == 'web_pilot' && env.TURNERO_PILOT_REPAIR_STATUS == 'blocked' }}",
        "if: ${{ success() && github.event_name != 'workflow_dispatch' && env.TURNERO_PILOT_REPAIR_RELEASE_MODE == 'web_pilot' && (env.TURNERO_PILOT_REPAIR_STATUS == 'ready' || env.TURNERO_PILOT_REPAIR_STATUS == 'not_required') }}",
        "const title = '[ALERTA PROD] Repair git sync turneroPilot bloqueado';",
        'repair-git-sync-turnero-pilot-signal:',
        "const baseLabels = ['production-alert', 'repair-git-sync', 'turnero-pilot', 'severity:warning'];",
        'Issue repair-git-sync turneroPilot ya refleja la misma senal',
        'Issue repair-git-sync turneroPilot creado',
        'Issue repair-git-sync turneroPilot cerrado',
        'Recuperado automaticamente por workflow de repair git sync (turneroPilot).',
        'statusResolved = [bool]$turneroPilot.statusResolved',
        'verifyRemoteRequired = [bool]$turneroPilot.verifyRemoteRequired',
        "@($failures | Where-Object { [string]$_.Asset -eq 'turnero-pilot-profile-status' }).Count -gt 0",
        "@($failures | Where-Object { [string]$_.Asset -eq 'turnero-pilot-remote-verify' }).Count -gt 0",
        "$status = 'not_required'",
        "$status = 'blocked'",
        "$status = 'ready'",
        'TURNERO_PILOT_REPAIR_CLINIC_ID=$clinicId',
        'TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT=$profileFingerprint',
        'TURNERO_PILOT_REPAIR_STATUS_RESOLVED=$statusResolvedText',
        'TURNERO_PILOT_REPAIR_VERIFY_REMOTE_REQUIRED=$verifyRemoteRequiredText',
        'TURNERO_PILOT_REPAIR_RELEASE_MODE=$releaseMode',
        'TURNERO_PILOT_REPAIR_CATALOG_READY=$catalogReadyText',
        'TURNERO_PILOT_REPAIR_REMOTE_VERIFIED=$remoteVerifiedText',
        'TURNERO_PILOT_REPAIR_DEPLOYED_COMMIT=$deployedCommit',
        'TURNERO_PILOT_REPAIR_RECOVERY_TARGETS=$recoveryTargetsLabel',
        'verification/last-turnero-pilot-repair.json',
        'repair-turnero-pilot-report',
        'turnero_pilot_repair_status: \\`${TURNERO_PILOT_REPAIR_STATUS}\\`',
        'turnero_pilot_repair_reason: \\`${TURNERO_PILOT_REPAIR_REASON}\\`',
        'turnero_pilot_repair_clinic_id: \\`${TURNERO_PILOT_REPAIR_CLINIC_ID}\\`',
        'turnero_pilot_repair_profile_fingerprint: \\`${TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT}\\`',
        'turnero_pilot_repair_status_resolved: \\`${TURNERO_PILOT_REPAIR_STATUS_RESOLVED}\\`',
        'turnero_pilot_repair_verify_remote_required: \\`${TURNERO_PILOT_REPAIR_VERIFY_REMOTE_REQUIRED}\\`',
        'turnero_pilot_repair_release_mode: \\`${TURNERO_PILOT_REPAIR_RELEASE_MODE}\\`',
        'turnero_pilot_repair_catalog_ready: \\`${TURNERO_PILOT_REPAIR_CATALOG_READY}\\`',
        'turnero_pilot_repair_remote_verified: \\`${TURNERO_PILOT_REPAIR_REMOTE_VERIFIED}\\`',
        'turnero_pilot_repair_deployed_commit: \\`${TURNERO_PILOT_REPAIR_DEPLOYED_COMMIT}\\`',
        'turnero_pilot_repair_recovery_targets: \\`${TURNERO_PILOT_REPAIR_RECOVERY_TARGETS}\\`',
        'turnero_pilot_repair_step_outcome: \\`${{ steps.turnero_pilot_repair.outcome }}\\`',
        'Reporte turnero pilot repair: \\`verification/last-turnero-pilot-repair.json\\`',
        'recoveryTargets = @($recoveryTargets)',
        "'[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'",
        "turnero_pilot_repair_recovery_targets: ${process.env.TURNERO_PILOT_REPAIR_RECOVERY_TARGETS || 'none'}",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de turneroPilot en repair-git-sync: ${snippet}`
        );
    }
});

test('repair-git-sync resincroniza el wrapper canonico del cron host y publica su estado', () => {
    const { raw, parsed } = loadWorkflow(REPAIR_WORKFLOW_PATH);
    const steps = parsed?.jobs?.repair?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Instalar sshpass para repair SSH',
        'Forzar sincronizacion git remota',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step para resincronizar el wrapper canonico del cron host: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'PUBLIC_SYNC_HOST_WRAPPER_PATH: /root/sync-pielarmonia.sh',
        'PUBLIC_SYNC_REPO_WRAPPER_RELATIVE_PATH: bin/deploy-public-v3-cron-sync.sh',
        'HOST_CRON_WRAPPER_SYNC_STATE: not_evaluated',
        'HOST_CRON_WRAPPER_SYNC_REASON: not_evaluated',
        'HOST_PUBLIC_DEPLOY_STATE: not_evaluated',
        'HOST_PUBLIC_DEPLOY_REASON: not_evaluated',
        'if command -v sshpass >/dev/null 2>&1; then',
        'sudo apt-get install -y sshpass',
        'sshpass -p "$SSH_PASSWORD" ssh',
        '-o PreferredAuthentications=password',
        '-o PubkeyAuthentication=no',
        'HOST_WRAPPER_PATH="${PUBLIC_SYNC_HOST_WRAPPER_PATH:-/root/sync-pielarmonia.sh}"',
        'REPO_WRAPPER_RELATIVE_PATH="${PUBLIC_SYNC_REPO_WRAPPER_RELATIVE_PATH:-bin/deploy-public-v3-cron-sync.sh}"',
        'WRAPPER_SYNC_STATE="already_aligned"',
        'WRAPPER_SYNC_REASON="host_wrapper_matches_repo"',
        'WRAPPER_SYNC_REASON="host_wrapper_replaced_from_repo"',
        'WRAPPER_SYNC_REASON="host_wrapper_created_from_repo"',
        'WRAPPER_SYNC_REASON="repo_wrapper_missing"',
        'install -m 0755 "$REPO_WRAPPER_PATH" "$HOST_WRAPPER_PATH"',
        'Wrapper cron host sincronizado: $HOST_WRAPPER_PATH <- $REPO_WRAPPER_PATH ($WRAPPER_SYNC_STATE)',
        'PUBLIC_DEPLOY_STATE="not_evaluated"',
        'PUBLIC_DEPLOY_REASON="not_evaluated"',
        'PUBLIC_DEPLOY_SCRIPT=""',
        'PUBLIC_DEPLOY_TARGET_COMMIT=""',
        'PUBLIC_DEPLOY_SCRIPT="$TARGET_REPO/bin/deploy-public-v3-live.sh"',
        'PUBLIC_DEPLOY_SCRIPT="$TARGET_REPO/bin/deploy-public-v2-live.sh"',
        'PUBLIC_DEPLOY_REASON="deploy_script_missing"',
        'Ejecutando deploy publico remoto: $PUBLIC_DEPLOY_SCRIPT (commit $PUBLIC_DEPLOY_TARGET_COMMIT)',
        'REPO="$TARGET_REPO"',
        'TARGET_COMMIT="$PUBLIC_DEPLOY_TARGET_COMMIT"',
        'PUBLIC_DEPLOY_STATE="executed"',
        'PUBLIC_DEPLOY_REASON="deploy_script_completed"',
        'PUBLIC_DEPLOY_STATE="failed"',
        'PUBLIC_DEPLOY_REASON="deploy_script_failed"',
        'printf \'__REPAIR_META__ host_cron_wrapper_sync_state=%s\\n\' "$WRAPPER_SYNC_STATE"',
        'printf \'__REPAIR_META__ host_cron_wrapper_sync_reason=%s\\n\' "$WRAPPER_SYNC_REASON"',
        'printf \'__REPAIR_META__ host_cron_wrapper_path=%s\\n\' "$HOST_WRAPPER_PATH"',
        'printf \'__REPAIR_META__ host_cron_wrapper_source=%s\\n\' "$REPO_WRAPPER_PATH"',
        'printf \'__REPAIR_META__ host_public_deploy_state=%s\\n\' "$PUBLIC_DEPLOY_STATE"',
        'printf \'__REPAIR_META__ host_public_deploy_reason=%s\\n\' "$PUBLIC_DEPLOY_REASON"',
        'printf \'__REPAIR_META__ host_public_deploy_script=%s\\n\' "$PUBLIC_DEPLOY_SCRIPT"',
        'printf \'__REPAIR_META__ host_public_deploy_target_commit=%s\\n\' "$PUBLIC_DEPLOY_TARGET_COMMIT"',
        "host_cron_wrapper_sync_reason='ssh_stdout_unavailable'",
        "host_cron_wrapper_sync_reason='not_reported'",
        "host_public_deploy_reason='ssh_stdout_unavailable'",
        "host_public_deploy_reason='not_reported'",
        'echo "host_cron_wrapper_sync_state=$host_cron_wrapper_sync_state"',
        'echo "host_cron_wrapper_sync_reason=$host_cron_wrapper_sync_reason"',
        'echo "host_cron_wrapper_path=$host_cron_wrapper_path"',
        'echo "host_cron_wrapper_source=$host_cron_wrapper_source"',
        'echo "host_public_deploy_state=$host_public_deploy_state"',
        'echo "host_public_deploy_reason=$host_public_deploy_reason"',
        'echo "host_public_deploy_script=$host_public_deploy_script"',
        'echo "host_public_deploy_target_commit=$host_public_deploy_target_commit"',
        'echo "HOST_CRON_WRAPPER_SYNC_STATE=$host_cron_wrapper_sync_state"',
        'echo "HOST_CRON_WRAPPER_SYNC_REASON=$host_cron_wrapper_sync_reason"',
        'echo "HOST_CRON_WRAPPER_PATH=$host_cron_wrapper_path"',
        'echo "HOST_CRON_WRAPPER_SOURCE=$host_cron_wrapper_source"',
        'echo "HOST_PUBLIC_DEPLOY_STATE=$host_public_deploy_state"',
        'echo "HOST_PUBLIC_DEPLOY_REASON=$host_public_deploy_reason"',
        'echo "HOST_PUBLIC_DEPLOY_SCRIPT=$host_public_deploy_script"',
        'echo "HOST_PUBLIC_DEPLOY_TARGET_COMMIT=$host_public_deploy_target_commit"',
        'host_cron_wrapper_sync_state: \\`${HOST_CRON_WRAPPER_SYNC_STATE}\\`',
        'host_cron_wrapper_sync_reason: \\`${HOST_CRON_WRAPPER_SYNC_REASON}\\`',
        'host_cron_wrapper_path: \\`${HOST_CRON_WRAPPER_PATH}\\`',
        'host_cron_wrapper_source: \\`${HOST_CRON_WRAPPER_SOURCE}\\`',
        'host_public_deploy_state: \\`${HOST_PUBLIC_DEPLOY_STATE}\\`',
        'host_public_deploy_reason: \\`${HOST_PUBLIC_DEPLOY_REASON}\\`',
        'host_public_deploy_script: \\`${HOST_PUBLIC_DEPLOY_SCRIPT}\\`',
        'host_public_deploy_target_commit: \\`${HOST_PUBLIC_DEPLOY_TARGET_COMMIT}\\`',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta resincronizacion canonica del wrapper host en repair-git-sync: ${snippet}`
        );
    }

    assert.equal(
        raw.includes('uses: appleboy/ssh-action@v1.2.0'),
        false,
        'repair-git-sync ya no debe depender de appleboy/ssh-action para capturar el estado del wrapper'
    );
});

test('repair-git-sync gestiona incidente dedicado cuando el fallback self-hosted queda sin runner', () => {
    const { raw, parsed } = loadWorkflow(REPAIR_WORKFLOW_PATH);
    const steps = parsed?.jobs?.repair?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));

    for (const expectedStepName of [
        'Crear/actualizar incidente self-hosted fallback de repair',
        'Cerrar incidente self-hosted fallback de repair al recuperar',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step de self-hosted fallback en repair-git-sync: ${expectedStepName}`
        );
    }

    for (const snippet of [
        "if: ${{ always() && steps.transport_fallback.outputs.self_hosted_fallback_dispatch_ready == 'true' && (steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state == 'queued' || steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state == 'dispatched_not_observed') }}",
        "if: ${{ always() && (steps.transport_fallback.outputs.transport_fallback_recommended != 'true' || (steps.transport_fallback.outputs.self_hosted_fallback_dispatch_ready == 'true' && steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state != 'queued' && steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state != 'dispatched_not_observed')) }}",
        "const title = '[ALERTA PROD] Repair git sync self-hosted fallback sin runner';",
        'repair-git-sync-self-hosted-runner-signal:',
        "const signal = `state:${process.env.SELF_HOSTED_FALLBACK_STATE || 'unknown'}|run_status:${process.env.SELF_HOSTED_FALLBACK_RUN_STATUS || 'unknown'}|reason:${process.env.TRANSPORT_FALLBACK_REASON || 'unknown'}|clinic:${process.env.TURNERO_PILOT_REPAIR_CLINIC_ID || 'unknown'}|fp:${process.env.TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT || 'unknown'}|release:${process.env.TURNERO_PILOT_REPAIR_RELEASE_MODE || 'unknown'}`;",
        "`- self_hosted_fallback_state: ${process.env.SELF_HOSTED_FALLBACK_STATE || 'unknown'}`",
        "`- self_hosted_fallback_run_status: ${process.env.SELF_HOSTED_FALLBACK_RUN_STATUS || 'unknown'}`",
        "`- self_hosted_fallback_run_url: ${process.env.SELF_HOSTED_FALLBACK_RUN_URL || ''}`",
        "`- transport_fallback_reason: ${process.env.TRANSPORT_FALLBACK_REASON || 'unknown'}`",
        "`- turnero_pilot_repair_clinic_id: ${process.env.TURNERO_PILOT_REPAIR_CLINIC_ID || 'unknown'}`",
        "`- turnero_pilot_repair_profile_fingerprint: ${process.env.TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT || 'unknown'}`",
        "`- turnero_pilot_repair_release_mode: ${process.env.TURNERO_PILOT_REPAIR_RELEASE_MODE || 'unknown'}`",
        "const baseLabels = ['production-alert', 'repair-git-sync', 'self-hosted-runner', 'severity:warning'];",
        'Issue repair-git-sync self-hosted fallback ya refleja la misma senal',
        'Issue repair-git-sync self-hosted fallback creado',
        'Issue repair-git-sync self-hosted fallback cerrado',
        'TRANSPORT_FALLBACK_RECOMMENDED: ${{ steps.transport_fallback.outputs.transport_fallback_recommended }}',
        'SELF_HOSTED_FALLBACK_STATE: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state }}',
        'SELF_HOSTED_FALLBACK_RUN_STATUS: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_run_status }}',
        'SELF_HOSTED_FALLBACK_RUN_URL: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_run_url }}',
        'TURNERO_PILOT_REPAIR_CLINIC_ID: ${{ env.TURNERO_PILOT_REPAIR_CLINIC_ID }}',
        'TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT: ${{ env.TURNERO_PILOT_REPAIR_PROFILE_FINGERPRINT }}',
        'TURNERO_PILOT_REPAIR_RELEASE_MODE: ${{ env.TURNERO_PILOT_REPAIR_RELEASE_MODE }}',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring de incidente self-hosted fallback en repair-git-sync: ${snippet}`
        );
    }
});

test('diagnose-host-connectivity publica reporte estructurado y gestiona incidente dedicado', () => {
    const { raw, parsed } = loadWorkflow(DIAGNOSE_WORKFLOW_PATH);
    const permissions = parsed?.permissions || {};
    const steps = parsed?.jobs?.diagnose?.steps || [];
    const stepNames = steps.map((step) => String(step?.name || ''));
    const inputs = parsed?.on?.workflow_dispatch?.inputs || {};

    assert.equal(
        permissions.issues,
        'write',
        'diagnose-host-connectivity debe tener issues: write para incidentes automaticos'
    );

    assert.equal(
        typeof inputs.turnero_clinic_id === 'object',
        true,
        'diagnose-host-connectivity debe exponer input turnero_clinic_id'
    );
    assert.equal(
        typeof inputs.turnero_profile_fingerprint === 'object',
        true,
        'diagnose-host-connectivity debe exponer input turnero_profile_fingerprint'
    );
    assert.equal(
        typeof inputs.turnero_release_mode === 'object',
        true,
        'diagnose-host-connectivity debe exponer input turnero_release_mode'
    );

    for (const expectedStepName of [
        'Diagnosticar puertos por origen de host',
        'Consolidar reporte de conectividad',
        'Resolver turneroPilot local para diagnose',
        'Connectivity summary',
        'Crear/actualizar incidente de conectividad deploy host',
        'Cerrar incidente de conectividad deploy host al recuperar',
        'Publicar reporte',
    ]) {
        assert.equal(
            stepNames.includes(expectedStepName),
            true,
            `falta step en diagnose-host-connectivity: ${expectedStepName}`
        );
    }

    for (const snippet of [
        'connectivity-report.json',
        'connectivity-report.txt',
        'connectivity-report.tsv',
        'GITHUB_TOKEN: ${{ github.token }}',
        "const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';",
        'authorization: `Bearer ${token}`',
        "'user-agent': 'diagnose-host-connectivity'",
        "append(outputPath, 'connectivity_status', status);",
        "append(outputPath, 'reachable_any', payload.reachable_any ? 'true' : 'false');",
        "append(outputPath, 'issue_ready', payload.issue_ready ? 'true' : 'false');",
        "append(outputPath, 'open_targets', openTargets.join(','));",
        'TURNERO_PILOT_DIAGNOSE_STATUS: unknown',
        'TURNERO_PILOT_DIAGNOSE_RECOVERY_TARGETS: none',
        "TURNERO_PILOT_EXPECTED_CLINIC_ID: ${{ github.event.inputs.turnero_clinic_id || '' }}",
        "TURNERO_PILOT_EXPECTED_PROFILE_FINGERPRINT: ${{ github.event.inputs.turnero_profile_fingerprint || '' }}",
        "TURNERO_PILOT_EXPECTED_RELEASE_MODE: ${{ github.event.inputs.turnero_release_mode || '' }}",
        'set +e',
        'status_path="turnero-pilot-diagnose.json"',
        'raw_path="turnero-pilot-diagnose.raw.txt"',
        'node bin/turnero-clinic-profile.js status --json > "${status_path}" 2>"${raw_path}"',
        'status_exit=$?',
        'set -e',
        'node bin/turnero-clinic-profile.js status --json',
        "const reportPath = 'connectivity-report.json';",
        'report.turneroPilot = {',
        'expectedClinicId,',
        'expectedProfileFingerprint,',
        'expectedReleaseMode,',
        'expectedMatch,',
        'expectedReason,',
        'recoveryTargets,',
        "append(outputPath, 'turnero_pilot_status', status);",
        "append(outputPath, 'turnero_pilot_reason', reason);",
        "append(outputPath, 'turnero_pilot_clinic_id', clinicId);",
        "append(outputPath, 'turnero_pilot_profile_fingerprint', profileFingerprint);",
        "append(outputPath, 'turnero_pilot_catalog_ready', catalogReadyText);",
        "append(outputPath, 'turnero_pilot_release_mode', releaseMode);",
        "append(outputPath, 'turnero_pilot_expected_match', expectedMatchText);",
        "append(outputPath, 'turnero_pilot_expected_reason', expectedReason);",
        "append(outputPath, 'turnero_pilot_recovery_targets', recoveryTargetsText);",
        "if: ${{ always() && steps.connectivity_summary.outputs.issue_ready == 'true' }}",
        "if: ${{ always() && steps.connectivity_summary.outputs.reachable_any == 'true' }}",
        "const title = '[ALERTA PROD] Diagnose host connectivity sin ruta de deploy';",
        'diagnose-host-connectivity-signal:',
        "const baseLabels = ['production-alert', 'diagnose-host-connectivity', 'deploy-connectivity', 'severity:warning'];",
        'Issue diagnose-host-connectivity ya refleja la misma senal',
        'Issue diagnose-host-connectivity creado',
        'Issue diagnose-host-connectivity cerrado',
        'connectivity_status: \\`${{ steps.connectivity_summary.outputs.connectivity_status }}\\`',
        'configured_host_count: \\`${{ steps.connectivity_summary.outputs.configured_host_count }}\\`',
        'reachable_any: \\`${{ steps.connectivity_summary.outputs.reachable_any }}\\`',
        'open_targets: \\`${{ steps.connectivity_summary.outputs.open_targets }}\\`',
        'turnero_pilot_status: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_status }}\\`',
        'turnero_pilot_reason: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_reason }}\\`',
        'turnero_pilot_clinic_id: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_clinic_id }}\\`',
        'turnero_pilot_profile_fingerprint: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_profile_fingerprint }}\\`',
        'turnero_pilot_catalog_ready: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_catalog_ready }}\\`',
        'turnero_pilot_release_mode: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_release_mode }}\\`',
        'turnero_pilot_expected_match: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_expected_match }}\\`',
        'turnero_pilot_expected_reason: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_expected_reason }}\\`',
        'turnero_pilot_recovery_targets: \\`${{ steps.turnero_pilot_diagnose.outputs.turnero_pilot_recovery_targets }}\\`',
        "`- turnero_pilot_status: ${process.env.TURNERO_PILOT_DIAGNOSE_STATUS || 'unknown'}`",
        "`- turnero_pilot_reason: ${process.env.TURNERO_PILOT_DIAGNOSE_REASON || 'unknown'}`",
        "`- turnero_pilot_clinic_id: ${process.env.TURNERO_PILOT_DIAGNOSE_CLINIC_ID || 'n/a'}`",
        "`- turnero_pilot_profile_fingerprint: ${process.env.TURNERO_PILOT_DIAGNOSE_PROFILE_FINGERPRINT || 'n/a'}`",
        "`- turnero_pilot_expected_match: ${process.env.TURNERO_PILOT_DIAGNOSE_EXPECTED_MATCH || 'false'}`",
        "`- turnero_pilot_expected_reason: ${process.env.TURNERO_PILOT_DIAGNOSE_EXPECTED_REASON || 'not_evaluated'}`",
        "`- turnero_pilot_recovery_targets: ${process.env.TURNERO_PILOT_DIAGNOSE_RECOVERY_TARGETS || 'none'}`",
        'artifact_json: connectivity-report.json',
        'artifact_text: connectivity-report.txt',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring en diagnose-host-connectivity: ${snippet}`
        );
    }

    assert.equal(
        raw.includes('uses: actions/github-script@v7'),
        false,
        'diagnose-host-connectivity ya no debe depender de actions/github-script@v7'
    );
    assert.equal(
        raw.includes(
            'if ! node bin/turnero-clinic-profile.js status --json > "${status_path}" 2>"${raw_path}"; then'
        ),
        false,
        'diagnose-host-connectivity no debe invertir el exit code del status local de turneroPilot'
    );
});
