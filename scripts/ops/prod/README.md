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
- `SMOKE-PRODUCCION.ps1 -RequireCronReady` valida `checks.publicSync` con `jobId`, `healthy`, `ageSeconds` y telemetria runtime (`state`, `lastErrorMessage`, `currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`).
- `VERIFICAR-DESPLIEGUE.ps1 -RequireCronReady` propaga fallas como assets `health-public-sync-*`, incluyendo `working-tree-dirty`, `head-drift` y `telemetry-gap`.
- `REPORTE-SEMANAL-PRODUCCION.ps1` publica el bloque `Public Sync Ops` en markdown/JSON y clasifica warnings `public_sync_*` contra [docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md](C:/Users/Ernesto/Documents/GitHub/piel-en-armonia/docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md).

Los entrypoints de triage `MONITOR-PRODUCCION.ps1`, `REPORTE-SEMANAL-PRODUCCION.ps1`,
`SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` consumen
`checks.publicSync` para diagnosticar degradaciones del cron
`public_main_sync` con `state`, `failureReason`, `lastErrorMessage`,
`currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`,
`headDrift`, `telemetryGap` y la salida permisiva `AllowDegradedPublicSync`.
