# Production Ops Scripts

Implementaciones canonicas de los scripts operativos de produccion.

Entrypoints estables:

- `BENCH-API-PRODUCCION.ps1`
- `GATE-POSTDEPLOY.ps1`
- `MONITOR-PRODUCCION.ps1`
- `REPORTE-SEMANAL-PRODUCCION.ps1`
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`

Los archivos de raiz se mantienen como wrappers compatibles para no romper
`package.json`, workflows ni uso manual existente.

Los checks canonicos de runtime publico resuelven engines solo desde
`js/engines/**`. Los residuos JS legacy de raiz (`booking-engine.js`,
`utils.js`, `*-engine.js`) deben quedar archivados fuera del carril activo.

Adopcion operativa de `public_main_sync`:

- `MONITOR-PRODUCCION.ps1` hace triage rapido de `checks.publicSync` y falla si detecta `jobId` invalido, `healthy=false`, `failureReason`, `headDrift` o `telemetryGap`; `-AllowDegradedPublicSync` deja la corrida en modo observacion sin tapar el diagnostico.
- `SMOKE-PRODUCCION.ps1 -RequireCronReady` valida `checks.publicSync` con `jobId`, `healthy`, `ageSeconds` y telemetria runtime (`state`, `lastErrorMessage`, `currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`); ahora tambien resuelve `github.deployAlerts` y falla si quedan incidentes GitHub abiertos de transporte/conectividad, salvo `-AllowOpenGitHubDeployAlerts`.
- `VERIFICAR-DESPLIEGUE.ps1 -RequireCronReady` propaga fallas como assets `health-public-sync-*`, incluyendo `working-tree-dirty`, `head-drift` y `telemetry-gap`; ademas agrega assets `github-deploy-*` para incidentes abiertos de deploy y forwardea `-AllowOpenGitHubDeployAlerts` al smoke integrado.
- `REPORTE-SEMANAL-PRODUCCION.ps1` publica el bloque `Public Sync Ops` en markdown/JSON y clasifica warnings `public_sync_*` contra [docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md](C:/Users/Ernesto/Documents/GitHub/Aurora-Derm/docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md).
- `MONITOR-PRODUCCION.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` ahora tambien consultan los incidentes GitHub `production-alert` para `deploy-hosting`, `diagnose-host-connectivity`, `repair-git-sync` y `self-hosted-runner`, exponiendo `github.deployAlerts`, `github_deploy_*`, conteos por categoria e issue numbers activos.

Los entrypoints de triage `MONITOR-PRODUCCION.ps1`, `REPORTE-SEMANAL-PRODUCCION.ps1`,
`SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` consumen
`checks.publicSync` para diagnosticar degradaciones del cron
`public_main_sync` con `state`, `failureReason`, `lastErrorMessage`,
`currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`,
`headDrift`, `telemetryGap` y la salida permisiva `AllowDegradedPublicSync`.

Cuando el bloqueo real vive en la ruta GitHub runner -> VPS y no solo dentro del
host, el mismo triage operativo agrega `github.deployAlerts` para mostrar si ya
estan abiertos `Deploy Hosting transporte bloqueado desde GitHub Runner`,
`Diagnose host connectivity sin ruta de deploy` o
`Repair git sync self-hosted fallback sin runner`.

`MONITOR-PRODUCCION.ps1` deja ese diagnostico en modo fail-fast. `SMOKE-PRODUCCION.ps1`
y `VERIFICAR-DESPLIEGUE.ps1` ahora lo tratan tambien como gate operativo, con
la misma excepcion explicita `-AllowOpenGitHubDeployAlerts` cuando solo se
necesita una corrida de observacion manual.
