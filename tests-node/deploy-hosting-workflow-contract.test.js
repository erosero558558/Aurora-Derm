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
        "const signal = `reason:${process.env.TRANSPORT_PREFLIGHT_REASON || 'unknown'}|target:${process.env.TRANSPORT_PREFLIGHT_TARGET || 'unknown'}`;",
        "`- transport_preflight_reason: ${process.env.TRANSPORT_PREFLIGHT_REASON || 'unknown'}`",
        "`- transport_preflight_target: ${process.env.TRANSPORT_PREFLIGHT_TARGET || 'unknown'}`",
        'Issue deploy-hosting transporte ya refleja la misma senal',
        'Issue deploy-hosting transporte creado',
        'Issue deploy-hosting transporte cerrado',
        'TRANSPORT_PREFLIGHT_REASON: ${{ env.TRANSPORT_PREFLIGHT_REASON }}',
        'TRANSPORT_PREFLIGHT_TARGET: ${{ env.TRANSPORT_PREFLIGHT_TARGET }}',
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
        "CONNECTIVITY_DIAGNOSE_RUN_STATUS: not_requested",
        "CONNECTIVITY_DIAGNOSE_RUN_URL: ''",
        "if: ${{ always() && env.FTP_DRY_RUN != 'true' && (env.FORCE_TRANSPORT_DEPLOY == 'true' || env.DEPLOY_METHOD != 'git-sync') && env.TRANSPORT_PREFLIGHT_REASON == 'runner_tcp_unreachable' }}",
        "const workflowId = 'diagnose-host-connectivity.yml';",
        'const dispatchStartedAtIso = new Date(dispatchStartedAt).toISOString();',
        "workflow_id: workflowId",
        "Workflow ${workflowId} disparado desde deploy-hosting (run_id=${observedRun.id}, status=${observedRun.status}, match=${observedRun.head_sha === headSha ? 'head_sha' : 'dispatch_window'}, url=${observedRun.html_url}).",
        "Workflow ${workflowId} disparado desde deploy-hosting (run no observado aun).",
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
        "CONNECTIVITY_DIAGNOSE_RUN_STATUS: ${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_status }}",
        "CONNECTIVITY_DIAGNOSE_RUN_URL: ${{ steps.connectivity_diagnose_status.outputs.connectivity_diagnose_run_url }}",
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
        "const connectivityDiagnoseDispatchReady = recommended;",
        "const connectivityDiagnoseDispatchMode = !recommended",
        "? 'not_required'",
        "? 'with_fallback'",
        ": 'diagnose_only';",
        "env:\n                  CONNECTIVITY_DIAGNOSE_DISPATCH_MODE: ${{ steps.transport_fallback.outputs.connectivity_diagnose_dispatch_mode }}",
        'Hydrate connectivity diagnose status (repair)',
        'const dispatchStartedAtIso = new Date(dispatchStartedAt).toISOString();',
        'CONNECTIVITY_DIAGNOSE_RUN_ID: \'\'',
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
        "printf '__REPAIR_META__ host_cron_wrapper_sync_state=%s\\n' \"$WRAPPER_SYNC_STATE\"",
        "printf '__REPAIR_META__ host_cron_wrapper_sync_reason=%s\\n' \"$WRAPPER_SYNC_REASON\"",
        "printf '__REPAIR_META__ host_cron_wrapper_path=%s\\n' \"$HOST_WRAPPER_PATH\"",
        "printf '__REPAIR_META__ host_cron_wrapper_source=%s\\n' \"$REPO_WRAPPER_PATH\"",
        "host_cron_wrapper_sync_reason='ssh_stdout_unavailable'",
        "host_cron_wrapper_sync_reason='not_reported'",
        'echo "host_cron_wrapper_sync_state=$host_cron_wrapper_sync_state"',
        'echo "host_cron_wrapper_sync_reason=$host_cron_wrapper_sync_reason"',
        'echo "host_cron_wrapper_path=$host_cron_wrapper_path"',
        'echo "host_cron_wrapper_source=$host_cron_wrapper_source"',
        'echo "HOST_CRON_WRAPPER_SYNC_STATE=$host_cron_wrapper_sync_state"',
        'echo "HOST_CRON_WRAPPER_SYNC_REASON=$host_cron_wrapper_sync_reason"',
        'echo "HOST_CRON_WRAPPER_PATH=$host_cron_wrapper_path"',
        'echo "HOST_CRON_WRAPPER_SOURCE=$host_cron_wrapper_source"',
        'host_cron_wrapper_sync_state: \\`${HOST_CRON_WRAPPER_SYNC_STATE}\\`',
        'host_cron_wrapper_sync_reason: \\`${HOST_CRON_WRAPPER_SYNC_REASON}\\`',
        'host_cron_wrapper_path: \\`${HOST_CRON_WRAPPER_PATH}\\`',
        'host_cron_wrapper_source: \\`${HOST_CRON_WRAPPER_SOURCE}\\`',
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
        "const signal = `state:${process.env.SELF_HOSTED_FALLBACK_STATE || 'unknown'}|run_status:${process.env.SELF_HOSTED_FALLBACK_RUN_STATUS || 'unknown'}|reason:${process.env.TRANSPORT_FALLBACK_REASON || 'unknown'}`;",
        "`- self_hosted_fallback_state: ${process.env.SELF_HOSTED_FALLBACK_STATE || 'unknown'}`",
        "`- self_hosted_fallback_run_status: ${process.env.SELF_HOSTED_FALLBACK_RUN_STATUS || 'unknown'}`",
        "`- self_hosted_fallback_run_url: ${process.env.SELF_HOSTED_FALLBACK_RUN_URL || ''}`",
        "`- transport_fallback_reason: ${process.env.TRANSPORT_FALLBACK_REASON || 'unknown'}`",
        "const baseLabels = ['production-alert', 'repair-git-sync', 'self-hosted-runner', 'severity:warning'];",
        'Issue repair-git-sync self-hosted fallback ya refleja la misma senal',
        'Issue repair-git-sync self-hosted fallback creado',
        'Issue repair-git-sync self-hosted fallback cerrado',
        'TRANSPORT_FALLBACK_RECOMMENDED: ${{ steps.transport_fallback.outputs.transport_fallback_recommended }}',
        'SELF_HOSTED_FALLBACK_STATE: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_state }}',
        'SELF_HOSTED_FALLBACK_RUN_STATUS: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_run_status }}',
        'SELF_HOSTED_FALLBACK_RUN_URL: ${{ steps.self_hosted_fallback_dispatch.outputs.self_hosted_fallback_run_url }}',
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

    assert.equal(
        permissions.issues,
        'write',
        'diagnose-host-connectivity debe tener issues: write para incidentes automaticos'
    );

    for (const expectedStepName of [
        'Diagnosticar puertos por origen de host',
        'Consolidar reporte de conectividad',
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
        "GITHUB_TOKEN: ${{ github.token }}",
        "const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';",
        "authorization: `Bearer ${token}`",
        "'user-agent': 'diagnose-host-connectivity'",
        "append(outputPath, 'connectivity_status', status);",
        "append(outputPath, 'reachable_any', payload.reachable_any ? 'true' : 'false');",
        "append(outputPath, 'issue_ready', payload.issue_ready ? 'true' : 'false');",
        "append(outputPath, 'open_targets', openTargets.join(','));",
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
});
