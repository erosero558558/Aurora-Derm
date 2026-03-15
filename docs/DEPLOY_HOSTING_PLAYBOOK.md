# Despliegue en pielarmonia.com

Fuente canonica detallada para despliegue manual, hosting self-hosted y
verificacion operativa. `DESPLIEGUE-PIELARMONIA.md` en la raiz queda solo como
shim de compatibilidad.

## Deploy automatico sin subir manual

Si desde tu PC no puedes subir por FTP/SFTP, usa el workflow:

- `.github/workflows/deploy-hosting.yml`
- `docs/GITHUB_ACTIONS_DEPLOY.md` (paso a paso)

Si tu hosting ya tiene sincronizacion por Git (pull automatico), ese metodo es el recomendado y mas seguro.
En ese caso ejecuta el gate automatico con:

- `.github/workflows/post-deploy-fast.yml` (se dispara en push a `main`, valida `verify+smoke` en modo rapido).
- `.github/workflows/nightly-stability.yml` (23:00 America/Guayaquil, corre gate completo + suites criticas).
- `.github/workflows/post-deploy-gate.yml` (modo manual/full regression).
- `.github/workflows/repair-git-sync.yml` (si el gate falla en `main`, intenta reparar sync por SSH con `git fetch/reset` en servidor).
  Para monitoreo continuo, habilita:
- `.github/workflows/prod-monitor.yml` (salud + latencia cada 30 minutos).

Configura en GitHub (repo -> Settings -> Secrets and variables -> Actions):

- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variables opcionales: `FTP_PROTOCOL`, `FTP_SERVER_PORT`, `FTP_SECURITY`, `FTP_SERVER_DIR` (`/public_html/`), `PROD_URL`, `SSH_HOST`, `SSH_PORT`, `SSH_REPO_DIR`
- Secrets opcionales para SSH dedicado: `SSH_USERNAME`, `SSH_PASSWORD` (fallback a `FTP_USERNAME/FTP_PASSWORD`)

Uso:

- Push a `main`: deploy automatico.
- Manual: Actions -> `Deploy Hosting (Canary Pipeline)` -> `Run workflow`.
- Prueba sin cambios: `dry_run = true`.
- Si falla `Timeout (control socket)`: prueba `protocol=sftp`, `server_port=22` (o `protocol=ftp`, `server_port=21`).

## Cutover rapido en Windows con este workspace

Si el hosting viejo va a desaparecer y necesitas servir `pielarmonia.com` desde
`C:\dev\pielarmonia-workspace`, la ruta canonica en Windows es:

- `ops/caddy/Caddyfile` para edge local y redirects canonicos.
- `php-cgi.exe` en `127.0.0.1:9000` como backend FastCGI.
- `cloudflared` para exponer el mismo dominio sin depender de NAT/router.
- `scripts/ops/setup/CONFIGURAR-HOSTING-WINDOWS.ps1` para autoarranque y cutover.

Secuencia recomendada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\setup\CONFIGURAR-HOSTING-WINDOWS.ps1 -RouteDns -OverwriteDns -StartNow
```

Notas:

- El cutover reusa el tunnel `pielarmonia-local-host` si ya existe en esta
  maquina.
- `PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL` debe quedar en
  `https://pielarmonia.com`.
- El entrypoint publico sale por Cloudflare Tunnel; no hace falta publicar
  `8011`, `4173` ni `9000`.
- El configurador deja dos capas de arranque:
  `Startup` + `HKCU\Run` para la sesion del operador, y una tarea `ONSTART`
  para el stack publico solo cuando se ejecuta con PowerShell elevada.
- Para evitar el limite de 261 caracteres de `schtasks /TR`, el configurador
  genera launchers cortos en `data/runtime/hosting/login-stack.cmd` y
  `data/runtime/hosting/boot-stack.cmd`.
- El perfil productivo canonico de auth es `web_broker`; el helper local en
  `127.0.0.1:4173` queda solo para soporte manual/laptop cuando se habilita
  explicitamente `PIELARMONIA_OPERATOR_AUTH_TRANSPORT=local_helper`.

## Archivos a subir

Sube a la raiz del hosting (`public_html` o equivalente) el paquete completo
que genera `npm run bundle:deploy`. El set minimo actual debe contener:

- `index.php`
- `.htaccess`
- `styles.css`
- `styles-deferred.css`
- `es/`
- `en/`
- `_astro/`
- `script.js`
- `js/chunks/`
- `js/engines/`
- `js/public-v6-shell.js`
- `fonts/`
- `images/optimized/`
- `images/icon-192.png`
- `images/icon-512.png`
- `manifest.json`
- `sw.js`
- `favicon.ico`
- `robots.txt`
- `sitemap.xml`
- `admin.html`
- `admin-v3.css`
- `queue-ops.css`
- `admin.js`
- `js/admin-chunks/`
- `js/admin-preboot-shortcuts.js`
- `js/admin-runtime.js`
- `js/monitoring-loader.js`
- `operador-turnos.html`
- `kiosco-turnos.html`
- `sala-turnos.html`
- `queue-kiosk.css`
- `queue-display.css`
- `js/queue-operator.js`
- `js/queue-kiosk.js`
- `js/queue-display.js`
- `api.php`
- `api-lib.php`
- `payment-lib.php`
- `admin-auth.php`
- `figo-chat.php`
- `figo-backend.php`
- carpeta `vendor/` (dependencias instaladas)
- carpeta `data/` (con permisos de escritura)
- `scripts/ops/prod/SMOKE-PRODUCCION.ps1`
- `scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1`
- `scripts/ops/prod/BENCH-API-PRODUCCION.ps1`
- `scripts/ops/prod/GATE-POSTDEPLOY.ps1`
- `CONFIGURAR-TELEGRAM-WEBHOOK.ps1`

Atajo recomendado para preparar un paquete listo para subir:

- `npm run bundle:deploy`
- Esto genera un `.zip` en `_deploy_bundle/` con `manifest-sha256.txt`.
- El ZIP conserva los wrappers raiz junto con `scripts/ops/prod`,
  `scripts/ops/setup` y `bin/powershell`, para que `GATE-POSTDEPLOY.ps1`,
  `VERIFICAR-DESPLIEGUE.ps1` y `CONFIGURAR-TELEGRAM-WEBHOOK.ps1` sigan
  funcionando fuera del repo.

Notas:

- La home publica ya no depende de `index.html` en raiz. El gateway entra por
  `index.php` y la shell publica V6 vive en `es/**`, `en/**`, `_astro/**` y
  `js/public-v6-shell.js`.
- `styles.css` y `styles-deferred.css` forman parte de la capa de soporte del
  gateway publico raiz. `script.js` y `js/chunks/**` forman el runtime
  versionado principal, y `js/engines/**` contiene los engines cargados en
  diferido por ese gateway.
- `script.js` y `js/chunks/**` forman parte del runtime versionado del gateway
  publico raiz. Deben publicarse si `/` depende de ese gateway y se validan con
  `npm run check:public:runtime:artifacts`.
- `js/engines/**` tambien debe publicarse si `/` depende del gateway publico;
  el bundle canonico ya no depende de `*-engine.js` legacy en raiz.
- Los residuos root `booking-engine.js` y `utils.js` quedaron archivados en
  `js/archive/root-legacy/**`; verify/smoke ya no deben usarlos como fallback.
- El admin canonico despliega `admin-v3.css` + `queue-ops.css` junto con
  `admin.js`, `js/admin-chunks/**` y `js/admin-preboot-shortcuts.js`;
  `admin.css` queda archivado como legacy.
- El turnero publicado depende de `operador-turnos.html`,
  `kiosco-turnos.html`, `sala-turnos.html` y sus assets `queue-*`.
- `node bin/check-public-routing-smoke.js --base-url https://pielarmonia.com --label production`
  ya debe fallar si cualquiera de esas tres superficies responde con redirect o `404`.
- Las rutas HTML legacy en raiz pueden seguir publicadas por compatibilidad,
  pero no sustituyen ni definen la shell V6 canonica.
- El frontend consume `figo-chat.php` para el chatbot IA.
- `.htaccess` ahora aplica Brotli/gzip y politicas de cache: estaticos con `max-age`, API critica con `no-store`.
- `index.php` ahora entrega la home con cabeceras de seguridad (incluye CSP) cuando el servidor enruta `/` a PHP.
- Las rutas legacy como `/index.html`, `/telemedicina.html`,
  `/terminos.html` o `servicios/*.html` dependen del contrato de redirects en
  `.htaccess` o Nginx; no son la fuente de authoring activa.

## Requisitos de servidor

- PHP 7.4 o superior
- Sesiones PHP habilitadas (para `admin-auth.php`)
- Permisos de escritura para la carpeta `data/`
- Dependencias de PHP instaladas (subir carpeta `vendor/` o ejecutar `composer install`)

## Variables de entorno (produccion)

Configura estas variables en tu hosting:

- `PIELARMONIA_OPERATOR_AUTH_MODE=openclaw_chatgpt`
- `PIELARMONIA_OPERATOR_AUTH_TRANSPORT=web_broker`
- `PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=true`
- `PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL=https://pielarmonia.com`
- `OPENCLAW_AUTH_BROKER_AUTHORIZE_URL`
- `OPENCLAW_AUTH_BROKER_TOKEN_URL`
- `OPENCLAW_AUTH_BROKER_USERINFO_URL`
- `OPENCLAW_AUTH_BROKER_CLIENT_ID`
- opcional: `OPENCLAW_AUTH_BROKER_CLIENT_SECRET`
- opcional para smoke live sandbox:
  `OPENCLAW_AUTH_BROKER_SMOKE_ENABLED=true`,
  `OPENCLAW_AUTH_BROKER_SMOKE_USERNAME`,
  `OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD`,
  `OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET`,
  `OPENCLAW_AUTH_BROKER_SMOKE_EXPECTED_EMAIL`
- `PIELARMONIA_ADMIN_PASSWORD` y/o `PIELARMONIA_ADMIN_PASSWORD_HASH` solo si habilitas contingencia legacy
- `PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=false` por defecto; subirlo a `true` solo en incidente
- `PIELARMONIA_OPERATOR_AUTH_ALLOWLIST`, `PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN`,
  `PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET` y `PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL`
  solo aplican cuando se habilita `local_helper` para soporte local/manual
- `PIELARMONIA_ADMIN_EMAIL` (recomendada para recibir aviso de nuevas citas)
- `PIELARMONIA_EMAIL_FROM` (opcional, para correos de confirmacion)
- `PIELARMONIA_DATA_DIR` (opcional, para forzar ruta de datos si `public_html/data` no tiene permisos)
- `PIELARMONIA_DATA_ENCRYPTION_KEY` (opcional, recomendado para cifrado en reposo de `store.json`)
- `FIGO_CHAT_ENDPOINT` (obligatoria para conectar el chatbot real)
- `FIGO_CHAT_TOKEN` (opcional, token Bearer para backend Figo)
- `FIGO_CHAT_APIKEY_HEADER` y `FIGO_CHAT_APIKEY` (opcionales, si tu backend usa API key custom)
- `FIGO_CHAT_TIMEOUT_SECONDS` (opcional, default 20)
- `FIGO_CHAT_DEGRADED_MODE` (opcional: `true` para forzar fallback; por defecto es auto y prioriza `live` cuando upstream esta sano)
- `FIGO_TELEGRAM_BOT_TOKEN` (opcional, para puente/notificacion Telegram en `figo-backend.php`)
- `FIGO_TELEGRAM_CHAT_ID` (opcional, chat destino para notificaciones Telegram)
- `FIGO_TELEGRAM_WEBHOOK_SECRET` (recomendado, valida peticiones webhook de Telegram)
- `PIELARMONIA_CRON_SECRET` (obligatoria para `cron.php`)
- `PIELARMONIA_BACKUP_MAX_AGE_HOURS` (opcional, default 24)
- `PIELARMONIA_BACKUP_AUTO_REFRESH` (opcional, default `true`, refresca backup stale de forma automatica)
- `PIELARMONIA_BACKUP_AUTO_REFRESH_INTERVAL_SECONDS` (opcional, default `600`, cooldown de auto-refresh)
- `PIELARMONIA_BACKUP_OFFSITE_URL` (opcional, endpoint externo para snapshots)
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional, default `Authorization`)
- `PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS` (opcional, default 20)
- `PIELARMONIA_BACKUP_LOCAL_REPLICA` (opcional, default `true`, replica local en `data/backups/offsite-local/`)
- `PIELARMONIA_BACKUP_RECEIVER_TOKEN` (solo cuando este servidor actua como destino de `backup-receiver.php`)
- `PIELARMONIA_BACKUP_RECEIVER_MAX_MB` (opcional, limite de subida en MB del receiver)
- `PIELARMONIA_STORAGE_JSON_FALLBACK` (opcional, default `true`, usa `store.json` si SQLite falla)
- `PIELARMONIA_DEFAULT_REVIEWS_ENABLED` (opcional, default `true`, fallback de reseñas cuando store esta vacio)
- `PIELARMONIA_DEFAULT_AVAILABILITY_ENABLED` (opcional, default `false`; en `true` genera agenda base cuando store esta vacio)

Importante:

- Ya no existe fallback `admin123`, incluso en local.
- En produccion, el login admin/turnero debe entrar por OpenClaw `web_broker`.
- `PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH` solo son obligatorios si vas a exponer la contingencia legacy.
- `PIELARMONIA_OPERATOR_AUTH_ALLOWLIST` no es requisito del corte cuando `PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=true`.
- Para notificaciones por email al administrador, configura `PIELARMONIA_ADMIN_EMAIL`.
- Para cifrado de datos en reposo, configura `PIELARMONIA_DATA_ENCRYPTION_KEY` (32 bytes o texto que se deriva a SHA-256).
- Si no puedes usar variables de entorno, tambien puedes crear `data/figo-config.json`.
- `FIGO_CHAT_ENDPOINT` NO debe ser `https://pielarmonia.com/figo-chat.php` ni ninguna URL que apunte al mismo proxy.
  Debe apuntar al backend real de Clawbot/Figo (upstream).

Ejemplo recomendado de `data/figo-config.json`:

```json
{
    "endpoint": "https://TU_DOMINIO/figo-backend.php",
    "token": "TOKEN_OPCIONAL",
    "apiKeyHeader": "X-API-Key",
    "apiKey": "APIKEY_OPCIONAL",
    "timeout": 20,
    "ai": {
        "endpoint": "https://openrouter.ai/api/v1/chat/completions",
        "apiKey": "sk-or-v1-REEMPLAZAR",
        "model": "arcee-ai/trinity-large-preview:free"
    },
    "allowLocalFallback": true
}
```

## Verificaciones rapidas

1. Salud API:

- `https://pielarmonia.com/api.php?resource=health`
- Validar campos nuevos: `timingMs`, `version`, `dataDirWritable`, `storeEncrypted`, `figoConfigured`, `figoRecursiveConfig`.
- Revisar `checks.backup`: `enabled`, `ok`, `latestAgeHours`, `offsiteConfigured`.

2. Admin auth status:

- `https://pielarmonia.com/admin-auth.php?action=status`
- `https://pielarmonia.com/api.php?resource=operator-auth-status`
- Esperado en perfil productivo: `mode=openclaw_chatgpt`, `transport=web_broker`,
  `configured=true` y diagnostico remoto `openclaw_ready`.

    2.1 Smoke live OpenClaw web broker:

- `npm run smoke:admin:openclaw-auth:live:node`
- o `node bin/operator-auth-live-smoke.js --transport web_broker --server-base-url https://pielarmonia.com`
- Esperado: `callback_ok=true`, `shared_session_ok=true`, `logout_ok=true`.

3. Bot Figo:

- `https://pielarmonia.com/figo-chat.php`
- Validar diagnostico: `mode`, `recursiveConfigDetected`, `upstreamReachable`.

    3.1 Backend Figo local (opcional):

- `https://pielarmonia.com/figo-backend.php`
- Debe responder JSON con `ok: true` en GET.

    3.2 Configurar webhook Telegram (si quieres que @figo64_bot responda con el mismo motor):

- `.\CONFIGURAR-TELEGRAM-WEBHOOK.ps1 -BotToken "TOKEN_ROTADO" -WebhookUrl "https://pielarmonia.com/figo-backend.php"`
- Guarda el secret mostrado por el script en `FIGO_TELEGRAM_WEBHOOK_SECRET`.
- Implementacion canonica: `scripts/ops/setup/CONFIGURAR-TELEGRAM-WEBHOOK.ps1`.

4. Sitio:

- `https://pielarmonia.com/`
- `https://pielarmonia.com/es/`
- `https://pielarmonia.com/en/`
- Validar en `/` header `Content-Security-Policy` presente.
- Si tu servidor mantiene redirects legacy, verificar adicionalmente:
  `https://pielarmonia.com/index.html` y
  `https://pielarmonia.com/telemedicina.html`.

5. Panel:

- `https://pielarmonia.com/admin.html`

6. Verificacion de paridad de despliegue:

- `.\scripts\ops\prod\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke`
- Si estas en ventana de mantenimiento y aceptas modo degradado temporal:
    - `.\scripts\ops\prod\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke -AllowDegradedFigo -AllowRecursiveFigo`

7. Bench de latencia (p95):

- `.\scripts\ops\prod\BENCH-API-PRODUCCION.ps1 -Domain "https://pielarmonia.com" -Runs 25 -IncludeFigoPost`

8. Gate completo post-deploy (recomendado):

- `.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireWebhookSecret`
- (Temporal, solo mientras corriges headers en edge/servidor) `.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -AllowMetaCspFallback`
- Para exigir backups sanos en el gate: `.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireBackupHealthy`
- Para exigir almacenamiento persistente (no /tmp): `.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireStableDataDir`

9. Verificacion de cron de backup:

- `https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET`
- `https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET`
- (Recomendado) `curl -s "https://pielarmonia.com/cron.php?action=backup-health" -H "Authorization: Bearer YOUR_CRON_SECRET"`
- (Recomendado) `curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1" -H "X-Cron-Token: YOUR_CRON_SECRET"`

11. Cron de sync Git (evitar borrar `vendor/`):

- Si usas sync por cron en servidor, evita `git clean -fd` sin exclusiones.
- Comando recomendado:

```bash
* * * * * flock -n /tmp/pielarmonia-sync.lock bash -lc '
cd /var/www/figo &&
git fetch --prune origin &&
git checkout -f main &&
git reset --hard origin/main &&
git clean -fd -e vendor/ -e data/ -e uploads/ -e env.php -e .env -e "*.log" &&
if [ ! -f vendor/autoload.php ]; then
  composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
fi
' >> /var/log/pielarmonia-gitsync.log 2>&1
```

10. Replica remota real (opcional):

- Publica `backup-receiver.php` en servidor destino.
- Configura token en destino (`PIELARMONIA_BACKUP_RECEIVER_TOKEN`).
- En origen configura:
  `PIELARMONIA_BACKUP_OFFSITE_URL=https://DESTINO/backup-receiver.php`
  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<TOKEN>`
- Script de ayuda: `.\CONFIGURAR-BACKUP-OFFSITE.ps1`
- Implementacion canonica: `scripts/ops/setup/CONFIGURAR-BACKUP-OFFSITE.ps1`

## Despliegue con Docker y Kubernetes (Fase 4)

### Docker (Local)

Para desarrollo o pruebas locales con el stack completo (App, Redis, Prometheus, Grafana):

1.  Copia `env.example.php` a `env.php` y configura tus variables.
2.  Ejecuta:
    ```bash
    docker-compose up -d --build
    ```
3.  Accede a:
    - App: http://localhost:8080
    - Grafana: http://localhost:3000 (admin/admin)
    - Prometheus: http://localhost:9090

Nota:

- `localhost:8080` aqui pertenece solo al stack Docker (`docker-compose.yml`).
- El servidor PHP local canonico para QA, Playwright y audits fuera de Docker
  sigue siendo `http://127.0.0.1:8011`, reusable via `TEST_BASE_URL`.

### Kubernetes (Produccion)

Archivos de manifiesto en carpeta `k8s/`:

1.  **Secretos**: Copia `k8s/secret.yaml.example` a `k8s/secret.yaml`, rellena los valores Base64 y aplica:

    ```bash
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/secret.yaml
    ```

2.  **Configuracion**: Revisa `k8s/configmap.yaml` y aplica:

    ```bash
    kubectl apply -f k8s/configmap.yaml
    ```

3.  **Volumenes y Servicios**:

    ```bash
    kubectl apply -f k8s/pvc.yaml
    kubectl apply -f k8s/redis.yaml
    ```

4.  **Despliegue App**:
    - Construye y sube tu imagen Docker (`docker build -t tu-repo/app:latest . && docker push ...`).
    - Actualiza la imagen en `k8s/deployment.yaml`.
    - Aplica:
        ```bash
        kubectl apply -f k8s/deployment.yaml
        kubectl apply -f k8s/service.yaml
        ```

5.  **Ingress**:
    - Asegurate de tener un Ingress Controller (nginx) y Cert-Manager.
    - Aplica:
        ```bash
        kubectl apply -f k8s/ingress.yaml
        ```
