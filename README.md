# Piel ArmonÃ­a - ClÃ­nica DermatolÃ³gica y EstÃ©tica

Bienvenido al repositorio de Piel ArmonÃ­a, el sitio web y sistema de gestiÃ³n para la clÃ­nica dermatolÃ³gica. Este proyecto incluye un sistema de reservas, un panel administrativo, integraciÃ³n con chatbot IA y mÃ¡s.

## ðŸ“‹ CaracterÃ­sticas

- **Sitio Web Moderno**: DiseÃ±o responsive con carga diferida de recursos (CSS/JS) para optimizar el rendimiento.
- **Sistema de Reservas**: Motor de reservas (`booking-engine.js`) integrado.
- **Panel Administrativo**: Interfaz para gestionar citas, configuraciones y ver mÃ©tricas (`admin.html`, `admin.js`).
- **Chatbot IA**: IntegraciÃ³n con Figo/Clawbot para asistencia automatizada (`chat-engine.js`, `figo-chat.php`).
- **API Backend**: Endpoints RESTful en PHP para manejar la lÃ³gica de negocio (`api.php`).
- **AutenticaciÃ³n**: Sistema de login seguro para administradores (`admin-auth.php`).
- **Test E2E**: Pruebas automatizadas con Playwright.

## ðŸš€ Requisitos

- **PHP 7.4** o superior.
- **Node.js** (para ejecutar las pruebas con Playwright).
- **Composer** (para dependencias de PHP, si aplica).

## ðŸ› ï¸ InstalaciÃ³n y Desarrollo Local

Para ejecutar el proyecto en tu entorno local:

1. **Clonar el repositorio**:

    ```bash
    git clone <url-del-repositorio>
    cd pielarmonia
    ```

2. **Configurar Variables de Entorno**:
   Para el funcionamiento del panel administrativo y otras caracterÃ­sticas, necesitas configurar algunas variables de entorno. Puedes ver los detalles en [SERVIDOR-LOCAL.md](SERVIDOR-LOCAL.md).

    Ejemplo bÃ¡sico en PowerShell:

    ```powershell
    $env:PIELARMONIA_ADMIN_PASSWORD = "tu-clave-segura"
    ```

3. **Iniciar el Servidor PHP**:
   Utiliza el servidor integrado de PHP:

    ```bash
    php -S localhost:8000
    ```

4. **Acceder a la AplicaciÃ³n**:
    - Sitio Web: [http://localhost:8000](http://localhost:8000)
    - Panel Admin: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)
    - Health Check: [http://localhost:8000/api.php?resource=health](http://localhost:8000/api.php?resource=health)

## âš™ï¸ ConfiguraciÃ³n

Las variables de entorno principales son:

- `PIELARMONIA_ADMIN_PASSWORD`: ContraseÃ±a para el acceso administrativo.
- `PIELARMONIA_ADMIN_EMAIL`: Email para notificaciones administrativas.
- `FIGO_CHAT_ENDPOINT`: URL del backend del chatbot (si se usa).
- `PIELARMONIA_CRON_SECRET`: Token para ejecutar `cron.php` de forma segura.
- `PIELARMONIA_BACKUP_OFFSITE_URL`: Endpoint opcional para replicar backups offsite.

Para una lista completa y detalles sobre la configuraciÃ³n, consulta [SERVIDOR-LOCAL.md](SERVIDOR-LOCAL.md) y [DESPLIEGUE-PIELARMONIA.md](DESPLIEGUE-PIELARMONIA.md).
Para el cutover de agenda local a Google real, usa [CALENDAR-CUTOVER.md](CALENDAR-CUTOVER.md).

## ðŸ§ª Pruebas

El proyecto utiliza Playwright para pruebas de extremo a extremo (E2E).

1. **Instalar dependencias**:

    ```bash
    npm install
    npx playwright install
    ```

2. **Ejecutar pruebas**:

    ```bash
    npm test
    ```

    Contrato Google Calendar (solo lectura):

    ```bash
    TEST_BASE_URL=https://pielarmonia.com npm run test:calendar-contract
    ```

    Escritura Google Calendar (reserva + reprogramacion + limpieza segura):

    ```bash
    TEST_BASE_URL=https://pielarmonia.com TEST_ENABLE_CALENDAR_WRITE=true TEST_ADMIN_PASSWORD="tu-clave-admin" npm run test:calendar-write
    ```

    En GitHub Actions tambien puedes usar el workflow manual:
    `Actions -> Calendar Write Smoke (Manual)` con `enable_write=true`
    y secret `PIELARMONIA_ADMIN_PASSWORD`.

    Pruebas PHP (unitarias/integracion ligera):

    ```bash
    npm run test:php
    ```

    Para ver la interfaz grÃ¡fica de las pruebas:

    ```bash
    npm run test:ui
    ```

## Despliegue

La web publica canónica se genera desde Astro V6 y `content/public-v6/**`.

Flujo oficial:

1. `npm run build:public:v6`
2. `npm run check:public:v6:artifacts`
3. `git push` a `main`
4. el cron git-sync del servidor publica `/var/www/figo`

Documentacion operativa:

- [docs/public-v6-canonical-source.md](docs/public-v6-canonical-source.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md](docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md)
- [CALENDAR-CUTOVER.md](CALENDAR-CUTOVER.md)
- [PLAN_ESTABILIDAD_14DIAS.md](PLAN_ESTABILIDAD_14DIAS.md)
- [ESTADO_PRODUCTO_OPERATIVO.md](ESTADO_PRODUCTO_OPERATIVO.md)

Comandos rÃ¡pidos post-deploy:

**Windows (PowerShell):**

- `npm run verify:prod`
- `npm run verify:prod:fast`
- `npm run smoke:prod`
- `npm run gate:prod`
- `npm run gate:prod:fast`
- `npm run gate:prod:strict`
- `npm run nightly:stability`
- `npm run monitor:prod`
- `npm run git:sync:main:safe` (sincroniza con `origin/main` y auto-resuelve conflicto de `revision` en `AGENT_BOARD.yaml`)
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -RequireBackupHealthy`

**Linux/Mac:**

- `php bin/verify-gate.php`

Para probar otro dominio:

- powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://tu-dominio.com"
- powershell -NoProfile -ExecutionPolicy Bypass -File .\VERIFICAR-DESPLIEGUE.ps1 -Domain "https://tu-dominio.com" -AssetHashRetryCount 3 -AssetHashRetryDelaySec 5

Modo transicion (solo temporal): si el servidor aun no envia header CSP pero tu HTML incluye meta-CSP:

- powershell -NoProfile -ExecutionPolicy Bypass -File .\GATE-POSTDEPLOY.ps1 -Domain "https://tu-dominio.com" -AllowMetaCspFallback

## Estructura del Proyecto

- `api.php`: Punto de entrada principal para la API.
- `admin.html` / `admin.js`: Frontend del panel administrativo.
- `src/apps/astro/src/pages/**`: Fuente canónica de rutas publicas V6.
- `src/apps/astro/src/components/public-v6/**`: Componentes publicos V6.
- `content/public-v6/**`: Copy y modelo de contenido publico V6.
- `es/**`, `en/**`, `_astro/**`: Artefactos generados para deploy por git-sync.
- `booking-engine.js`: LÃ³gica del sistema de reservas.
- `chat-engine.js`: LÃ³gica del cliente del chatbot.
- `data/`: Directorio para almacenamiento de datos (JSON, logs).
- `tests/`: Scripts de prueba adicionales.

## ðŸ“„ Licencia

Este proyecto es privado y propiedad de Piel ArmonÃ­a.

## Deploy automatico por GitHub Actions

GitHub Actions queda como validacion y fallback de transporte. No reemplaza `main` ni el cron git-sync como fuente de verdad operativa.

Si necesitas fallback manual de transporte, usa:

- `.github/workflows/deploy-hosting.yml`
- `.github/workflows/post-deploy-fast.yml` (carril rapido bloqueante en `push/main`, verify+smoke)
- `.github/workflows/nightly-stability.yml` (suite pesada diaria, 23:00 America/Guayaquil)
- `.github/workflows/post-deploy-gate.yml` (full regression/manual)
- `.github/workflows/repair-git-sync.yml` (autocura: forzar `git fetch/reset` por SSH cuando falla el gate)
- `.github/workflows/prod-monitor.yml` (monitorea salud/latencia cada 30 min)
- `GITHUB-ACTIONS-DEPLOY.md` (paso a paso)

Nota: `post-deploy-fast`, `post-deploy-gate` y `prod-monitor` crean/actualizan un issue de incidente cuando fallan y lo cierran automaticamente cuando recuperan.

Nota: si tu servidor ya hace `git pull`/sync automatico, ese flujo es el principal y estos workflows quedan como respaldo manual.

Configura en GitHub (repo -> Settings -> Secrets and variables -> Actions):

- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Variables opcionales: `FTP_PROTOCOL`, `FTP_SERVER_PORT`, `FTP_SECURITY`, `FTP_SERVER_DIR`, `PROD_URL`, `SSH_HOST`, `SSH_PORT`, `SSH_REPO_DIR`
- Secrets opcionales para SSH dedicado: `SSH_USERNAME`, `SSH_PASSWORD` (si no se definen, usa `FTP_USERNAME/FTP_PASSWORD`)
- Variable de corte a agenda real: `REQUIRE_GOOGLE_CALENDAR`
    - `false` (default actual): contrato de calendario permite entorno `store` durante rollout.
    - `true` (cutover): el gate falla si `health.calendarSource != google`.

Variables opcionales para ajustar sensibilidad del reporte semanal KPI (sin tocar YAML):

- `WEEKLY_KPI_RETENTION_DAYS`
- `WEEKLY_KPI_NO_SHOW_WARN_PCT`
- `WEEKLY_KPI_RECURRENCE_MIN_WARN_PCT`
- `WEEKLY_KPI_RECURRENCE_DROP_WARN_PCT`
- `WEEKLY_KPI_RECURRENCE_MIN_UNIQUE_PATIENTS`
- `WEEKLY_KPI_IDEMPOTENCY_CONFLICT_WARN_PCT`
- `WEEKLY_KPI_CONVERSION_MIN_WARN_PCT`
- `WEEKLY_KPI_CONVERSION_DROP_WARN_PCT`
- `WEEKLY_KPI_CONVERSION_MIN_START_CHECKOUT`
- `WEEKLY_KPI_START_CHECKOUT_MIN_WARN_PCT`
- `WEEKLY_KPI_START_CHECKOUT_DROP_WARN_PCT`
- `WEEKLY_KPI_START_CHECKOUT_MIN_VIEW_BOOKING`
- `WEEKLY_KPI_CORE_P95_MAX_MS`
- `WEEKLY_KPI_FIGO_POST_P95_MAX_MS`

Referencia operativa: `docs/RUNBOOKS.md` seccion `1.6 Weekly KPI thresholds`.

Ejecucion:

- `git push` a `main` para deploy automatico.
- O `Actions -> Deploy Hosting (FTP/FTPS) -> Run workflow`.
- Usa `dry_run = true` para validar sin subir.
- Si falla `Timeout (control socket)`, prueba `protocol=ftp`, `server_port=21`.

## Orquestacion de agentes (2026)

Fuente de verdad operativa:

- `AGENTS.md` (canonico)
- `CLAUDE.md` (guia de rol, no canonica)
- `AGENT_BOARD.yaml` (backlog unico)

Tombstones historicos:

- `JULES_TASKS.md`
- `KIMI_TASKS.md`

Comandos:

- `npm run agent:status`
- `npm run agent:conflicts`
- `npm run agent:sync`
- `npm run agent:metrics`
- `npm run agent:validate`
- `npm run agent:jobs:status`
- `npm run agent:jobs:verify`
- `npm run agent:publish:checkpoint -- CDX-001 --summary "..." --expect-rev <rev>`

24/7 con GitHub Actions:

- `.github/workflows/agent-intake.yml`
    - workflow manual de saneamiento/intake `codex-only`
    - valida gobernanza, `board doctor`, `codex-check` y `jobs status`

Configuracion requerida:

1. Secret:
    - `GITHUB_TOKEN`
2. Variables (Repository Variables):
    - `CODEX_DAILY_LIMIT=999`
    - `CI_DAILY_LIMIT=999`

## OpenAPI preview local

El contrato API vive en `docs/openapi.yaml` (OpenAPI 3.1).

Opciones rapidas para previsualizar:

1. Swagger Editor online:
    - abre https://editor.swagger.io/
    - importa `docs/openapi.yaml`
2. Redoc local con Docker:
    - `docker run --rm -p 8081:80 -v ${PWD}/docs:/usr/share/nginx/html redocly/redoc`
    - abre `http://localhost:8081/redoc.html`
