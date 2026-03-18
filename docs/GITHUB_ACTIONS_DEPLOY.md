# Deploy por GitHub Actions (sin subir manual)

Fuente canonica detallada para deploy via GitHub Actions.
`GITHUB-ACTIONS-DEPLOY.md` en la raiz queda solo como shim compatible.

Runbooks relacionados:

- `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`
- `docs/PUBLIC_V3_CRON_INSTALL.md`

## 1) Configura secretos del repo

En GitHub:

- `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Crea:

- `FTP_SERVER` (ejemplo: `ftp.tudominio.com` o IP del hosting)
- `FTP_USERNAME`
- `FTP_PASSWORD`

## 2) Configura variables opcionales

En:

- `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`

Crea:

- `FTP_PROTOCOL`: `ftps`, `ftp` o `sftp`
- `FTP_SERVER_PORT`: `21` (FTP/FTPS) o `22` (SFTP)
- `FTP_SECURITY`: `strict` (o `loose` si tu FTPS usa certificado no valido)
- `FTP_SERVER_DIR`: `/public_html/`
- `PROD_URL`: `https://pielarmonia.com`

## 3) Ejecuta deploy

Opciones:

- Push a `main` para deploy automatico.
- Manual: `Actions` -> `Deploy Hosting (Canary Pipeline)` -> `Run workflow`.

Parametros manuales recomendados (SFTP si tu hosting no abre puerto 21):

- `protocol`: `sftp`
- `server_port`: `22`
- `security`: `strict` (solo aplica a FTPS)
- `server_dir`: `/public_html/`
- `dry_run`: `false`
- `clean_slate`: `false`

## 4) Verifica

Despues del deploy:

- `https://pielarmonia.com/api.php?resource=health`
- `https://pielarmonia.com/figo-chat.php`
- `https://pielarmonia.com/`

El workflow publica el mismo paquete canonico que debe contener la shell V6
(`es/**`, `en/**`, `_astro/**`, `js/public-v6-shell.js`), el runtime admin V3
(`admin.js`, `js/admin-chunks/**`) y los scripts operativos incluidos en el
bundle de deploy.

Si falla conexion FTP:

- Revisa host, usuario, clave y puerto en tu proveedor.
- Usa el host FTP del proveedor, no una URL proxied por Cloudflare.
- Si ves `Timeout (control socket)`, el runner no llega al puerto remoto:
    - cambia `protocol/port` (ej. `ftp:21`)
    - pide al hosting habilitar acceso desde IPs de GitHub Actions

Si usas SFTP:

- Usa `protocol=sftp` y `server_port=22`.
- El workflow prepara un bundle `_deploy_bundle/` y lo sube por `lftp` sobre SFTP.

## 5) Si usas sincronizacion Git en servidor (sin FTP)

Si tu hosting hace `git pull` automatico, ahora se usa esquema de 2 carriles:

- Diurno (push a `main`): `Actions` -> `Post-Deploy Fast Lane`
    - verify + smoke
    - sin benchmark pesado
    - objetivo de feedback: ciclo rapido
- Nocturno (23:00 America/Guayaquil): `Actions` -> `Nightly Stability`
    - gate completo (`verify + smoke + benchmark`)
    - `test:critical:agenda`
    - `test:critical:funnel`
    - `test:critical:payments`
- Full regression/manual: `Actions` -> `Post-Deploy Gate (Full Regression)`

El modo estricto de hardening se mantiene (`RequireStableDataDir`, `RequireBackupHealthy`, `RequireBackupReceiverReady`, `RequireCronReady`).
Si falla un workflow de salud programado, crea/actualiza issue de incidente automaticamente; al recuperar, lo cierra.

Para la publicacion rapida desde el orquestador, el camino operativo es:

1. `node agent-orchestrator.js task start <AG-ID|CDX-ID> --release-publish --expect-rev <rev> --json` cuando se trate de una promocion formal de release
2. `node agent-orchestrator.js publish checkpoint <AG-ID|CDX-ID> --summary "release-publish ..." --expect-rev <rev> --json`
3. el comando crea el checkpoint y sincroniza `main` via `sync-main-safe`
4. esperar confirmacion por `https://pielarmonia.com/api.php?resource=health`
5. validar `checks.publicSync.deployedCommit == SHA publicado`

Si el push salio pero `public_main_sync` todavia no confirma deploy, el
checkpoint devuelve `live_status=pending` y deja warning no bloqueante para
seguir la verificacion live despues.

Variable recomendada para fase de agenda real:

- `REQUIRE_GOOGLE_CALENDAR` (repo variable)
    - `false`: permite rollout con agenda `store` sin romper contrato.
    - `true`: exige `health.calendarSource=google` en `test:calendar-contract`.

## 6) Monitoreo continuo de produccion

Workflow:

- `Actions` -> `Production Monitor`
- Corre cada 30 minutos y valida:
    - home
    - health
    - reviews
    - availability
    - figo GET
    - latencia maxima por endpoint
    - backup saludable y `dataDir` persistente

Se puede correr manual con overrides:

- `domain`
- `max_latency_ms`
- `allow_degraded_figo`
- `allow_store_calendar`
- `skip_backup_check`

Comportamiento de corte:

- Si `REQUIRE_GOOGLE_CALENDAR=true`, el monitor fuerza modo estricto y deja de permitir `store`
  aunque `allow_store_calendar` venga habilitado por defecto.

Si falla en ejecucion programada, crea/actualiza un issue de incidente automaticamente.
Cuando recupera en una corrida programada exitosa, cierra el issue automaticamente.
