# Deploy por GitHub Actions (sin subir manual)

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

Si tu hosting hace `git pull` automatico, usa este workflow para validar cada push:

- `Actions` -> `Post-Deploy Gate (Git Sync)`
- O simplemente push a `main` y se ejecuta solo.
- Adicionalmente corre cada 6 horas como monitoreo continuo.
- Puedes ajustar tolerancia de propagacion de cache con:
    - `asset_hash_retry_count`
    - `asset_hash_retry_delay_sec`

Este gate corre:

- verificacion de despliegue
- smoke de endpoints
- benchmark API

en modo estricto (`RequireStableDataDir`, `RequireBackupHealthy`, `RequireBackupReceiverReady`, `RequireCronReady`).
Si falla (push/schedule), crea o actualiza un issue de incidente automaticamente.
Si luego recupera en una corrida exitosa, cierra ese issue automaticamente.

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
