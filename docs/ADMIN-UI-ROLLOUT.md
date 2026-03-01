# Runbook Admin UI Sony v2

## Objetivo

Operar rollout/cutover/rollback del admin v2 (`sony_v2`) con fallback inmediato a `legacy` y sin cambios de contrato externo.

## Contrato operativo

1. Entrada unica: `admin.html`.
2. Precedencia de variante:
    - query `admin_ui=sony_v2|legacy`
    - `localStorage.adminUiVariant`
    - flag backend `admin_sony_ui` (`/api.php?resource=features`)
    - fallback `legacy`
3. Kill-switch:
    - si `admin_sony_ui=false`, cualquier `sony_v2` (query/storage) se degrada a `legacy`.
4. Contingencia local:
    - `admin_ui_reset=1` limpia `localStorage.adminUiVariant` antes de resolver variante.
5. Hardening de resolucion:
    - `admin_ui=legacy` y storage `legacy` no esperan llamada a `/api.php?resource=features`;
      el loader solo consulta features cuando necesita validar `sony_v2` o resolver default sin override.

## URLs de operacion

- Forzar v2 para QA: `/admin.html?admin_ui=sony_v2`
- Forzar legacy para QA: `/admin.html?admin_ui=legacy`
- Limpiar variante local: `/admin.html?admin_ui_reset=1`
- Legacy session-only + limpiar storage: `/admin.html?admin_ui=legacy&admin_ui_reset=1`

## Etapas de rollout

1. Etapa interna
    - usar `admin_ui=sony_v2` y validar suites admin.
2. Canary
    - habilitar `admin_sony_ui` de forma gradual por entorno.
3. Produccion general
    - `admin_sony_ui=true` como default.

## Rollback inmediato

1. Apagar flag global:
    - `FEATURE_ADMIN_SONY_UI=false` (env) o `admin_sony_ui=false` en storage de flags.
2. Ejecutar script de contingencia:
    - `npm run admin:ui:contingency`
3. En cada estacion abierta de admin:
    - abrir `/admin.html?admin_ui_reset=1`
    - si se necesita forzar legacy en esa sesion, abrir `/admin.html?admin_ui=legacy&admin_ui_reset=1`
4. Confirmar en navegador:
    - `html[data-admin-ui="legacy"]`
    - login/admin funcional

## Validacion recomendada por cambio

```bash
npx playwright test tests/admin-ui-variant.spec.js
npx playwright test tests/admin-ui-runtime-smoke.spec.js --workers=1
npm run test:frontend:qa:admin
npm run lint
npm run test:php
```

## Gate automatizado de rollout

Script: `GATE-ADMIN-ROLLOUT.ps1`

Valida:

1. `admin_sony_ui` en `/api.php?resource=features` segun etapa.
2. Disponibilidad de URLs clave de admin (`admin.html`, `admin_ui`, `admin_ui_reset`).
3. Presencia de CSP en admin.
4. Smoke runtime Playwright sin mocks (`tests/admin-ui-runtime-smoke.spec.js`), salvo que se omita con `-SkipRuntimeSmoke`.

Notas:

- En `stage=internal`, si `admin_sony_ui` aun no esta expuesto en `features`, el gate lo reporta como warning.
- En `canary/general/rollback` la presencia de `admin_sony_ui` es bloqueante.

Ejemplos:

```powershell
.\GATE-ADMIN-ROLLOUT.ps1 -Domain "https://pielarmonia.com" -Stage canary
.\GATE-ADMIN-ROLLOUT.ps1 -Domain "https://pielarmonia.com" -Stage general
.\GATE-ADMIN-ROLLOUT.ps1 -Domain "https://pielarmonia.com" -Stage rollback
.\GATE-ADMIN-ROLLOUT.ps1 -Domain "https://pielarmonia.com" -Stage canary -ReportPath "verification/last-admin-ui-rollout-gate.json"
```

Scripts npm:

```bash
npm run gate:admin:rollout
npm run gate:admin:rollout:general
npm run gate:admin:rollout:rollback
```

## Higiene de bundles admin

- `admin.js` ahora carga `legacy` y `sony_v2` por import dinamico (lazy por variante).
- El build ejecuta limpieza automatica de chunks huerfanos:
    - `npm run chunks:admin:prune`
    - incluido automaticamente dentro de `npm run build`
- Verificacion sin borrar archivos:

```bash
node bin/clean-admin-chunks.js --dry-run
```

## Integracion CI/CD (post-deploy)

El gate admin UI rollout ya esta integrado en:

1. `.github/workflows/post-deploy-fast.yml` (modo rapido, default `stage=canary` y smoke runtime omitido).
2. `.github/workflows/post-deploy-gate.yml` (full regression, default `stage=general`).
3. Ambos publican artefacto JSON de trazabilidad:
    - `verification/last-admin-ui-rollout-gate-fast.json`
    - `verification/last-admin-ui-rollout-gate.json`
4. `deploy-hosting.yml` puede propagar etapa/flags por `workflow_dispatch` a ambos workflows post-deploy.
5. `deploy-hosting.yml` ejecuta precheck de contrato admin UI con `GATE-ADMIN-ROLLOUT.ps1` (sin runtime smoke) antes del dispatch.
6. Politica efectiva del precheck en deploy-hosting:
    - si `run_postdeploy_gate=true`, usa flags `*_gate`;
    - si no hay gate pero `run_postdeploy_fast=true`, usa flags `*_fast`;
    - si no hay dispatch, usa `stage-default` (estricto salvo `internal`).
7. En `stage=internal`, el precheck permite `admin_sony_ui` ausente aunque `allow_missing_flag` no venga en `true`.
8. `post-deploy-fast.yml` y `post-deploy-gate.yml` fuerzan `allow_feature_api_failure=true` y `allow_missing_flag=true` cuando `stage=internal` para evitar falso negativo en rollout temprano, y registran `policy_source` en summary/incidentes.
9. `post-deploy-gate.yml` soporta modo dual:
    - `workflow_dispatch`: siempre habilitado.
    - `push` a `main`: solo corre si `RUN_POSTDEPLOY_GATE_ON_PUSH=true`.
10. `deploy-hosting.yml` (precheck), `post-deploy-fast.yml` y `post-deploy-gate.yml` resuelven politica con `bin/resolve-admin-rollout-policy.js` para evitar drift entre workflows.
11. Perfiles por etapa (salida `stage_profile`):

- `internal` -> `tolerant`
- `canary` -> `progressive`
- `general` -> `strict`
- `rollback` -> `rollback_strict`

Variables de repositorio soportadas:

- `ADMIN_ROLLOUT_STAGE_FAST` (`internal|canary|general|rollback`, default `canary`)
- `ADMIN_ROLLOUT_SKIP_RUNTIME_SMOKE_FAST` (`true|false`, default `true`)
- `ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE_FAST` (`true|false`, default `false`)
- `ADMIN_ROLLOUT_ALLOW_MISSING_FLAG_FAST` (`true|false`, default `false`)
- `ADMIN_ROLLOUT_STAGE` (`internal|canary|general|rollback`, default `general`)
- `ADMIN_ROLLOUT_SKIP_RUNTIME_SMOKE` (`true|false`, default `false`)
- `ADMIN_ROLLOUT_ALLOW_FEATURE_API_FAILURE` (`true|false`, default `false`)
- `ADMIN_ROLLOUT_ALLOW_MISSING_FLAG` (`true|false`, default `false`)

`post-deploy-gate.yml` tambien expone estos mismos parametros como `workflow_dispatch` inputs.

Inputs de `deploy-hosting.yml` para propagacion (manual):

- `run_postdeploy_fast` (default `true`)
- `run_postdeploy_gate` (default `false`)
- `postdeploy_fast_wait_seconds` (default `45`)
- `admin_rollout_stage` (`internal|canary|general|rollback`, default `general`)
- `admin_rollout_skip_runtime_smoke_fast`
- `admin_rollout_allow_feature_api_failure_fast`
- `admin_rollout_allow_missing_flag_fast`
- `admin_rollout_skip_runtime_smoke_gate`
- `admin_rollout_allow_feature_api_failure_gate`
- `admin_rollout_allow_missing_flag_gate`

Para ejecucion automatica (`workflow_run`), el dispatch se controla con variables:

- `RUN_POSTDEPLOY_FAST_FROM_DEPLOY_WORKFLOW_RUN` (preferido, default operativo `false`)
- `RUN_POSTDEPLOY_GATE_FROM_DEPLOY_WORKFLOW_RUN` (preferido, default operativo `false`)
- Compat legacy (fallback): `RUN_POSTDEPLOY_FAST_FROM_DEPLOY` y `RUN_POSTDEPLOY_GATE_FROM_DEPLOY`

Activacion de full gate por push directo a `main`:

- `RUN_POSTDEPLOY_GATE_ON_PUSH` (`true|false`, default recomendado `false`)

## Script de contingencia

Archivo: `ADMIN-UI-CONTINGENCIA.ps1`

Ejemplo:

```powershell
.\ADMIN-UI-CONTINGENCIA.ps1 -Domain "https://pielarmonia.com"
.\ADMIN-UI-CONTINGENCIA.ps1 -Domain "https://pielarmonia.com" -OpenCleanupUrl
```
