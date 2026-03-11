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

## Archivos a subir

Sube a la raiz del hosting (`public_html` o equivalente) el paquete completo
que genera `npm run bundle:deploy`. El set minimo actual debe contener:

- `index.php`
- `.htaccess`
- `es/`
- `en/`
- `_astro/`
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
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`
- `BENCH-API-PRODUCCION.ps1`
- `GATE-POSTDEPLOY.ps1`
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
- El admin canonico despliega `admin-v3.css` + `queue-ops.css` junto con
  `admin.js`, `js/admin-chunks/**` y `js/admin-preboot-shortcuts.js`;
  `admin.css` queda archivado como legacy.
- El turnero publicado depende de `operador-turnos.html`,
  `kiosco-turnos.html`, `sala-turnos.html` y sus assets `queue-*`.
- `styles.css`, `styles-deferred.css`, `script.js` y las rutas HTML legacy en
  raiz quedan solo como compatibilidad si siguen publicadas; no son la shell
  V6 canonica.
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

- `PIELARMONIA_ADMIN_PASSWORD` (obligatoria para login admin)
- `PIELARMONIA_ADMIN_PASSWORD_HASH` (opcional, tiene prioridad)
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
- Debes configurar `PIELARMONIA_ADMIN_PASSWORD` o `PIELARMONIA_ADMIN_PASSWORD_HASH`.
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

- `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke`
- Si estas en ventana de mantenimiento y aceptas modo degradado temporal:
    - `.\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://pielarmonia.com" -RunSmoke -AllowDegradedFigo -AllowRecursiveFigo`

7. Bench de latencia (p95):

- `.\BENCH-API-PRODUCCION.ps1 -Domain "https://pielarmonia.com" -Runs 25 -IncludeFigoPost`

8. Gate completo post-deploy (recomendado):

- `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireWebhookSecret`
- (Temporal, solo mientras corriges headers en edge/servidor) `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -AllowMetaCspFallback`
- Para exigir backups sanos en el gate: `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireBackupHealthy`
- Para exigir almacenamiento persistente (no /tmp): `.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireStableDataDir`

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
