# Production Ops Scripts

Implementaciones canonicas de los scripts operativos de produccion.

Entrypoints estables:

- `BENCH-API-PRODUCCION.ps1`
- `CHECKLIST-HOST-PUBLIC-SYNC.ps1`
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

- `MONITOR-PRODUCCION.ps1` hace triage rapido de `checks.publicSync`; trata `healthy=false`, `headDrift`, `telemetryGap` y `jobId` invalido como fallo operativo, pero deja `repoHygieneIssue=true` como warning visible cuando el unico problema es `working_tree_dirty` con telemetria suficiente. `-AllowDegradedPublicSync` deja la corrida en modo observacion sin tapar el diagnostico.
- `MONITOR-PRODUCCION.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` consumen `health-diagnostics` para triage operativo detallado; `health` queda como surface publica para smoke, headers y checks anonimos.
- Si el `clinic-profile` activo esta en `release.mode=web_pilot`, `MONITOR-PRODUCCION.ps1`, `SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` ejecutan `bin/turnero-clinic-profile.js verify-remote --base-url <dominio>` y bloquean cuando el host publicado no coincide en `clinic_id`, `profileFingerprint`, catalogo o canon del piloto.
- `SMOKE-PRODUCCION.ps1 -RequireCronReady` valida `checks.publicSync` con `jobId`, `healthy`, `ageSeconds` y telemetria runtime (`state`, `lastErrorMessage`, `currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`); tambien resuelve `github.deployAlerts` y falla si quedan incidentes GitHub abiertos de transporte/conectividad, salvo `-AllowOpenGitHubDeployAlerts`.
- `SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` separan `health` (headers/contrato publico) de `health-diagnostics` (backup/publicSync/telemedicina), para no depender de que el endpoint publico siga exponiendo telemetria interna.
- `VERIFICAR-DESPLIEGUE.ps1 -RequireCronReady` propaga fallas como assets `health-public-sync-*`, incluyendo `working-tree-dirty`, `head-drift` y `telemetry-gap`; ademas agrega assets `github-deploy-*`, `turnero-pilot-profile-status` y `turnero-pilot-remote-verify` para incidentes o drift del piloto.
- `VERIFICAR-DESPLIEGUE.ps1` persiste ese estado tambien como bloque `turneroPilot` dentro de `verification/last-deploy-verify.json`, y los workflows `post-deploy-fast.yml` / `post-deploy-gate.yml` lo convierten en un semáforo visible del piloto por clínica junto con `statusResolved`, `verifyRemoteRequired` y `releaseMode`.
- `post-deploy-fast.yml` y `post-deploy-gate.yml` escriben `verification/last-turnero-pilot-fast.json` y `verification/last-turnero-pilot-gate.json`, y los suben como `post-deploy-turnero-pilot-fast-report` / `post-deploy-turnero-pilot-gate-report`.
- `repair-git-sync.yml` reevalua ese mismo bloque despues del self-heal, escribe `verification/last-turnero-pilot-repair.json`, lo sube como `repair-turnero-pilot-report` y abre/cierra el incidente `Repair git sync turneroPilot bloqueado` cuando el host sigue fuera del `clinic-profile` esperado.
- `deploy-frontend-selfhosted.yml` aplica el mismo contrato del piloto web por clínica: resuelve el `clinic-profile` activo antes del publish, escribe `.selfhosted-cutover/turnero-pilot-status.json`, corre `verify-remote` post-deploy, escribe `.selfhosted-cutover/turnero-pilot-remote.json`, sube `verification/last-turnero-pilot-selfhosted.json` como `deploy-frontend-selfhosted-turnero-pilot-report` y abre/cierra `Deploy Frontend Self-Hosted turneroPilot bloqueado` si el host publicado no coincide con la clínica/firma esperada.
- Ese mismo workflow manual clasifica la propia ruta del fallback (`build`, `deploy`, `validate`) como `selfhosted_route_status`, y abre/cierra `[ALERTA PROD] Deploy Frontend Self-Hosted ruta bloqueada` con el mismo `clinic_id/profileFingerprint/releaseMode` del piloto cuando el fallback falla antes de cerrar el publish.
- `GATE-POSTDEPLOY.ps1` hace preflight local del `clinic-profile` antes de correr `verify + smoke + bench`: si el perfil activo no resuelve, no coincide con catálogo o no está listo para `verify-remote`, el gate cae antes de gastar la corrida completa.
- `REPORTE-SEMANAL-PRODUCCION.ps1` publica los bloques `Auth Posture`, `Operator Auth Rollout`, `Storage Posture`, `Public Sync Ops` y `Turnero Pilot` en markdown/JSON; clasifica warnings `auth_*`, `storage_*`, `public_sync_*`, `github_deploy_*` y `turnero_pilot_*` con `runbookRef`, `remediation` y `suggestedCommand`.
- En el mismo triage de `github.deployAlerts`, la categoria verbal exacta `turnero pilot blocked` queda reservada para el mismatch remoto del `clinic-profile` publicado.
- `MONITOR-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `REPORTE-SEMANAL-PRODUCCION.ps1` consumen `checks.auth` para exponer `mode`, `status`, `configured`, `hardeningCompliant`, `recommendedMode`, `twoFactorEnabled`, `operatorAuthEnabled` y `legacyPasswordConfigured`.
- `MONITOR-PRODUCCION.ps1` deja la postura de auth visible por default y permite endurecer con `-RequireAuthConfigured`, `-RequireOperatorAuth` y `-RequireAdminTwoFactor`. Cuando se activa `-RequireOperatorAuth`, tanto `MONITOR-PRODUCCION.ps1` como `VERIFICAR-DESPLIEGUE.ps1` corren `scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1`.
- `VERIFICAR-DESPLIEGUE.ps1` traduce esos guardrails a assets `health-auth-*` cuando el deploy no cumple la postura requerida.
- `MONITOR-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` tambien consumen `checks.storage` para exponer `backend`, `source`, `encrypted`, `encryptionConfigured`, `encryptionRequired`, `encryptionStatus` y `encryptionCompliant`.
- `MONITOR-PRODUCCION.ps1` deja el cifrado en reposo visible por default y permite endurecer con `-RequireStoreEncryption`; aun sin ese flag, si el runtime ya marca `encryptionRequired=true`, el monitor falla cuando `encryptionCompliant=false`. `VERIFICAR-DESPLIEGUE.ps1` traduce ese guardrail a `health-store-encryption-*`.
- `SMOKE-PRODUCCION.ps1`, `VERIFICAR-DESPLIEGUE.ps1` y `GATE-POSTDEPLOY.ps1` aceptan `-RequireTurneroWebSurfaces` para bloquear si faltan `/operador-turnos.html`, `/kiosco-turnos.html` o `/sala-turnos.html`.
- Los mismos entrypoints aceptan `-RequireTurneroOperatorPilot` para bloquear si el piloto Windows del operador no publica `app-downloads`, `latest.yml` e instalador en `pilot`.
- `check-public-routing-smoke.js` trata `/operador-turnos.html`, `/kiosco-turnos.html` y `/sala-turnos.html` como rutas publicas obligatorias; si una cae en redirect o 404, staging/prod no deben pasar.
- `CHECKLIST-HOST-PUBLIC-SYNC.ps1` imprime un checklist host-side reutilizable para comparar `/root/sync-pielarmonia.sh` contra el wrapper canonico, capturar `public-sync-status.json`, revisar `health-diagnostics` y validar `storeEncryptionCompliant`.

Los entrypoints de triage `MONITOR-PRODUCCION.ps1`, `REPORTE-SEMANAL-PRODUCCION.ps1`,
`SMOKE-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` consumen
`checks.publicSync` para diagnosticar degradaciones del cron
`public_main_sync` con `state`, `failureReason`, `lastErrorMessage`,
`currentHead`, `remoteHead`, `dirtyPathsCount`, `dirtyPathsSample`,
`headDrift`, `telemetryGap`, `operationallyHealthy`, `repoHygieneIssue`
y la salida permisiva `AllowDegradedPublicSync`.

Para auth, `MONITOR-PRODUCCION.ps1` y `VERIFICAR-DESPLIEGUE.ps1` leen
`checks.auth`; por defecto muestran warnings si el runtime sigue en
`legacy_password` o sin 2FA, y solo escalan a fallo si se activa
`RequireOperatorAuth`, `RequireAdminTwoFactor` o `RequireAuthConfigured`.

Para storage, ambos entrypoints leen `checks.storage`; por defecto muestran
warnings si `storeEncryptionStatus` sigue en `plaintext`, y escalan a fallo con
`RequireStoreEncryption` o cuando el runtime ya declara
`storeEncryptionRequired=true` y `storeEncryptionCompliant=false`.

Cuando necesites intervenir el VPS sin improvisar comandos, usa:

- `npm run checklist:prod:public-sync:host`
- `npm run verify:prod:turnero:operator:pilot`
- `npm run smoke:prod:turnero:operator:pilot`
- `npm run gate:prod:turnero:operator:pilot`
- `node bin/check-public-routing-smoke.js --base-url https://pielarmonia.com --label production`
- `pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1`

El script no toca el host: solo imprime el bloque canonico de comandos y
criterios de cierre para `public_main_sync`, auth y cifrado en reposo.

El reporte semanal reutiliza ese mismo comando (`npm run checklist:prod:public-sync:host`)
como `suggestedCommand` cuando un warning afecta `public_sync`, `github_deploy`,
`auth` o `storage`, para que la remediacion no dependa de memoria operativa.

Cuando el bloqueo real vive en la ruta GitHub runner -> VPS y no solo dentro del
host, el mismo triage operativo agrega `github.deployAlerts` para mostrar si ya
estan abiertos `Deploy Hosting transporte bloqueado desde GitHub Runner`,
`Diagnose host connectivity sin ruta de deploy` o
`Repair git sync self-hosted fallback sin runner`,
`Deploy Frontend Self-Hosted ruta bloqueada` o
`Deploy Hosting turneroPilot bloqueado`.
`MONITOR-PRODUCCION.ps1` deja ese diagnostico en modo fail-fast. `SMOKE-PRODUCCION.ps1`
y `VERIFICAR-DESPLIEGUE.ps1` ahora lo tratan tambien como gate operativo, con
la misma excepcion explicita `-AllowOpenGitHubDeployAlerts` cuando solo se
necesita una corrida de observacion manual.
