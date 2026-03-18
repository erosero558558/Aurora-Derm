# Runbooks Operacionales - Piel en Armonia

Este documento detalla los procedimientos estandar para la operacion,
despliegue y respuesta a incidentes del sistema Piel en Armonia.

## 1. Despliegue (Deployment)

Para detalles tecnicos profundos, ver `docs/DEPLOY_HOSTING_PLAYBOOK.md`.
Para publicar un `main` ya validado, ver `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md`.
Para el cron host-side de `public_main_sync`, ver `docs/PUBLIC_V3_CRON_INSTALL.md`.

### 1.1 Despliegue Automatico (Recomendado)

El repositorio cuenta con un flujo de GitHub Actions
(`.github/workflows/deploy-hosting.yml`) que se dispara al hacer push a la rama
`main`.

**Pasos:**

1.  Realizar cambios en una rama de `feature`.
2.  Crear Pull Request y fusionar a `main`.
3.  Verificar la ejecucion del Action en la pestana "Actions" de GitHub.
4.  Una vez completado (verde), ejecutar la validacion post-despliegue.

### 1.2 Despliegue Manual (FTP)

Si el despliegue automatico falla, se puede subir manualmente.

**Pasos:**

1.  Ejecutar `npm run bundle:deploy` para generar el paquete ZIP en
    `_deploy_bundle/`.
    El ZIP preserva los wrappers raiz junto con `scripts/ops/prod`,
    `scripts/ops/setup` y `bin/powershell` para que el tooling incluido siga
    funcionando fuera del repo.
    Tambien incluye la shell publica V6 (`es/**`, `en/**`, `_astro/**`,
    `js/public-v6-shell.js`), el runtime admin V3 (`admin.js`,
    `js/admin-chunks/**`, `js/admin-preboot-shortcuts.js`) y las superficies de
    turnero (`operador-turnos.html`, `kiosco-turnos.html`, `sala-turnos.html`).
2.  Conectarse al servidor FTP (credenciales en gestor de contrasenas del equipo).
3.  Subir el contenido del ZIP a `public_html/`.
4.  **Importante:** No sobrescribir la carpeta `data/` si ya contiene datos de
    produccion.
5.  Si el bundle y los reportes locales ya no se necesitan, ejecutar
    `npm run clean:local:artifacts` para limpiar `_deploy_bundle/`,
    `.lighthouseci/`, `lhci_reports/`, `playwright-report/`,
    `test-results/`, `php_server.log`, `.php-cs-fixer.cache`,
    `.phpunit.cache/`, `coverage.xml`, `cookies.txt`,
    `.tmp-calendar-write-report.json`, `.codex-public-paths.txt`,
    `build_analysis.txt` y `conflict_branches.txt`, `stats.html`, `styles.min.css`,
    `styles.optimized.css`, `styles-critical.min.css` y
    `styles-deferred.min.css`.

### 1.3 Validacion Post-Despliegue

Despues de cualquier despliegue, ejecutar el script de verificacion:

```powershell
.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com"
```

Implementacion canonica: `scripts/ops/prod/GATE-POSTDEPLOY.ps1`.

Esto verificara:

- Estado HTTP 200 en paginas clave.
- Respuesta de la API (`/health`).
- Configuracion de seguridad (Headers).

### 1.4 Cierre de Hardening (Fase 5)

Para cerrar formalmente hardening y reactivar el gate estricto:

1.  Verificar que CI este en verde para el commit objetivo.
2.  Ejecutar validacion strict de hashes:

```powershell
.\scripts\ops\prod\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -ForceAssetHashChecks
```

3.  Repetir hasta tener 3 corridas consecutivas en verde.
4.  Si una corrida falla solo por p95 puntual (con hash + smoke en verde),
    tratar como pico transitorio y recomenzar el conteo de corridas
    consecutivas desde el siguiente OK.
5.  Registrar evidencia (fecha/hora, p95 por endpoint y resultado) en
    `PLAN_MAESTRO_2026_STATUS.md`.
6.  Actualizar el estado de fase en `PLAN_MAESTRO_OPERATIVO_2026.md`.

### 1.5 Politica warning -> blocking y fallback operativo

Objetivo: mantener deploy diurno rapido sin perder control de riesgo.

Reglas:

1.  Fast lane (`post-deploy-fast.yml`) bloquea solo por fallas de
    health/smoke/contrato critico.
2.  Full gate (`post-deploy-gate.yml`) se usa para regression completa y
    decision final en casos de duda.
    - En modo automatico por `push`, se activa solo si
      `RUN_POSTDEPLOY_GATE_ON_PUSH=true` (default recomendado `false`).
    - La politica de stage/flags de admin rollout se resuelve en
      `bin/resolve-admin-rollout-policy.js` para mantener consistencia entre
      precheck (`deploy-hosting`) y gates (`post-deploy-fast`/`post-deploy-gate`).
3.  Nightly (`nightly-stability.yml`) valida dominios `platform`, `agenda`,
    `funnel` y publica semaforos por dominio.
4.  Si hay warning no critico aislado (pico transitorio), se permite continuar
    solo si:
    - smoke y health estan en verde;
    - no hay warning critico;
    - existe rerun de confirmacion o evidencia de recuperacion.
5.  Si hay warning critico (`calendar_unreachable`,
    `calendar_token_unhealthy`, errores de seguridad o contrato critico), la
    decision es `block`.

Fallback operativo ante pico transitorio:

1.  Ejecutar `npm run gate:prod:fast` para confirmar estado base.
2.  Ejecutar `npm run gate:prod:strict` para confirmar si el warning persiste.
3.  Si persiste, abrir incidente `[ALERTA PROD]` y detener release hasta
    resolver causa raiz.
4.  Si desaparece, registrar evento como transitorio con timestamp y metrica
    afectada.

### 1.6 Weekly KPI thresholds (operacion sin cambios de codigo)

Objetivo: ajustar sensibilidad de alertas semanales sin editar workflows.

Orden de precedencia:

1. `workflow_dispatch` input manual (si se especifica en la corrida).
2. Repository Variables `WEEKLY_KPI_*`.
3. Defaults del workflow `weekly-kpi-report.yml`.

Variables soportadas (Repository -> Settings -> Secrets and variables -> Actions -> Variables):

- `WEEKLY_KPI_RETENTION_DAYS` (default `30`)
- `WEEKLY_KPI_NO_SHOW_WARN_PCT` (default `20`)
- `WEEKLY_KPI_RECURRENCE_MIN_WARN_PCT` (default `30`)
- `WEEKLY_KPI_RECURRENCE_DROP_WARN_PCT` (default `15`)
- `WEEKLY_KPI_RECURRENCE_MIN_UNIQUE_PATIENTS` (default `5`)
- `WEEKLY_KPI_IDEMPOTENCY_CONFLICT_WARN_PCT` (default `5`)
- `WEEKLY_KPI_CONVERSION_MIN_WARN_PCT` (default `25`)
- `WEEKLY_KPI_CONVERSION_DROP_WARN_PCT` (default `15`)
- `WEEKLY_KPI_CONVERSION_MIN_START_CHECKOUT` (default `10`)
- `WEEKLY_KPI_START_CHECKOUT_MIN_WARN_PCT` (default `0.25`)
- `WEEKLY_KPI_START_CHECKOUT_DROP_WARN_PCT` (default `0.2`)
- `WEEKLY_KPI_START_CHECKOUT_MIN_VIEW_BOOKING` (default `100`)
- `WEEKLY_KPI_CORE_P95_MAX_MS` (default `800`)
- `WEEKLY_KPI_FIGO_POST_P95_MAX_MS` (default `2500`)

Runbook rapido para ajuste:

1. Cambiar variables `WEEKLY_KPI_*` en GitHub.
2. Ejecutar manualmente `Actions -> Weekly KPI Report -> Run workflow`.
3. Verificar bloque `Thresholds efectivos` en `GITHUB_STEP_SUMMARY`.
4. Confirmar que el comportamiento de incidentes semanales coincide con los
   nuevos umbrales.
5. Si el cambio no es el esperado, volver a defaults y re-ejecutar.

### 1.7 Admin UI sony_v3

Para el despliegue del admin `sony_v3` usar el runbook dedicado:

- `docs/ADMIN-UI-ROLLOUT.md`

Comando operativo rapido:

```powershell
npm run admin:ui:contingency
```

Este comando muestra el estado operativo del admin y recuerda el flujo de
rollback por deploy revert.

Gate recomendado por etapa:

```powershell
npm run gate:admin:rollout
```

Atajos por etapa:

- `npm run gate:admin:rollout:internal`
- `npm run gate:admin:rollout:canary`
- `npm run gate:admin:rollout:general`
- `npm run gate:admin:rollout:rollback`

Contrato actual del gate:

1. `GATE-ADMIN-ROLLOUT.ps1` acepta `internal|canary|general|rollback`.
2. `internal` mantiene guardrail tolerante: si no se pasan flags explicitas,
   se permite `Features API` degradada y ausencia temporal de
   `data.admin_sony_ui` / `data.admin_sony_ui_v3`.
3. `canary`, `general` y `rollback` validan el contrato de flags backend contra
   `/api.php?resource=features`, ademas del shell canonico `sony_v3`.
4. El smoke runtime sigue ejecutandose contra el `-Domain` solicitado usando
   `TEST_BASE_URL`, sin reusar servidores locales heredados.

Reglas operativas:

1. `admin.html` siempre debe resolver a `sony_v3`.
2. El gate corre `admin-ui-runtime-smoke` y `admin-v3-runtime`.
3. Si el admin falla, no se reactiva `legacy` ni `sony_v2`; se hace
   `revert + deploy`.

Higiene de bundles admin (post-build / troubleshooting):

```powershell
npm run chunks:admin:prune
node bin/clean-admin-chunks.js --dry-run
```

Propagacion automatizada desde deploy:

1. En `Deploy Hosting (Canary Pipeline)` manual, usar:
    - `run_postdeploy_fast`
    - `run_postdeploy_gate`
    - `admin_rollout_stage`
    - flags `admin_rollout_*_fast` y `admin_rollout_*_gate`
    - `post-deploy-fast.yml` usa perfil `progressive` y default
      `skip_runtime_smoke=true`
    - `post-deploy-gate.yml` usa perfil `strict` y default
      `skip_runtime_smoke=false`
2. Para ejecucion automatica, controlar con variables:
    - `RUN_POSTDEPLOY_FAST_FROM_DEPLOY_WORKFLOW_RUN` (preferido; recomendado
      `false`)
    - `RUN_POSTDEPLOY_GATE_FROM_DEPLOY_WORKFLOW_RUN` (preferido; recomendado
      `false`)
    - fallback legacy: `RUN_POSTDEPLOY_FAST_FROM_DEPLOY` y
      `RUN_POSTDEPLOY_GATE_FROM_DEPLOY`

---

## 2. Respuesta a Incidentes (Emergency Response)

### 2.1 Sitio Caido (HTTP 500 / Timeout)

**Sintoma:** El sitio no carga o muestra error de servidor.

**Acciones:**

1.  **Verificar Logs:** Acceder por FTP y revisar `php.log` o `error_log` en la
    raiz.
2.  **Health Check:** Consultar `https://pielarmonia.com/api.php?resource=health`
    para ver si la API responde JSON.
3.  **Revertir:** Si fue tras un despliegue, volver a desplegar la version
    anterior (revert commit en Git y push).
4.  **Infraestructura:** Verificar estado del proveedor de hosting.

### 2.2 Corrupcion de Datos

**Sintoma:** Datos faltantes, citas erroneas, JSON invalido en `store.json`.

**Acciones:**

1.  **Detener Escrituras:** Renombrar `api.php` temporalmente o poner el sitio
    en mantenimiento para evitar nuevas escrituras.
2.  **Evaluar Dano:** Descargar `data/store.json` y validar su sintaxis JSON.
3.  **Restaurar:** Seguir el procedimiento de **Disaster Recovery**
    (ver `docs/DISASTER_RECOVERY.md`).

### 2.3 Fallo en Pagos (Stripe)

**Sintoma:** Usuarios reportan que no pueden pagar o citas no se confirman.

**Acciones:**

1.  **Verificar Config:** `GET /payment-config` debe devolver `enabled: true`.
2.  **Stripe Dashboard:** Verificar si hay errores en los logs de Stripe
    (API keys expiradas, webhooks fallidos).
3.  **Logs de Auditoria:** Revisar `data/audit.log` buscando eventos
    `stripe.webhook_failed`.

### 2.4 Chatbot No Responde

**Sintoma:** El chat se queda cargando o da error.

**Acciones:**

1.  **Verificar Figo:** Consultar `https://pielarmonia.com/figo-chat.php`.
    Debe devolver diagnostico.
2.  **Revisar Config:** Confirmar que la variable de entorno
    `FIGO_CHAT_ENDPOINT` es correcta.

### 2.5 Falso Negativo de Gate por Latencia p95

**Sintoma:** `GATE-POSTDEPLOY.ps1 -ForceAssetHashChecks` falla por p95 alto en
un endpoint (ej: `availability`), pero headers, hashes y smoke estan en verde.

**Acciones:**

1.  Re-ejecutar el gate strict inmediatamente para confirmar si es pico
    transitorio.
2.  Si el segundo intento pasa, registrar el incidente como transitorio y
    continuar con corridas consecutivas.
3.  Si falla de nuevo en el mismo endpoint:
    - ejecutar benchmark dedicado para aislar el endpoint
      (`npm run benchmark:local`; usar `TEST_BASE_URL` si necesitas otro host);
    - verificar estado de infraestructura/hosting y saturacion de red;
    - abrir incidente operativo y no cerrar fase.

---

## 3. Tareas Rutinarias (Routine Tasks)

### 3.1 Monitoreo Diario

- Visitar el sitio y verificar carga rapida.
- Verificar que `https://pielarmonia.com/api.php?resource=health` este OK.

### 3.2 Backups y Verificacion

El sistema mantiene backups rotativos en `data/backups/` al escribir
`store.json`. Adicionalmente, se recomienda ejecutar verificaciones y
replicacion offsite por cron.

**Cron recomendado (America/Guayaquil):**

```bash
10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"

# Alternativa recomendada (sin token en URL):
curl -s "https://pielarmonia.com/cron.php?action=backup-health" -H "Authorization: Bearer YOUR_CRON_SECRET"
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite" -H "X-Cron-Token: YOUR_CRON_SECRET"
```

**Prueba manual (dry run offsite):**

```bash
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1&token=YOUR_CRON_SECRET"
curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&dryRun=1" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Variables requeridas para offsite real:**

- `PIELARMONIA_BACKUP_OFFSITE_URL`
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN` (opcional)
- `PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER` (opcional)
- `PIELARMONIA_BACKUP_MAX_AGE_HOURS` (opcional)
- `PIELARMONIA_BACKUP_LOCAL_REPLICA` (opcional, default `true`)

Si no configuras endpoint remoto, `backup-offsite` replica localmente en
`data/backups/offsite-local/`.

Para replica remota real:

- Publica `backup-receiver.php` en el servidor destino.
- Configura `PIELARMONIA_BACKUP_RECEIVER_TOKEN` en destino.
- Configura en destino:
    - `PIELARMONIA_BACKUP_RECEIVER_REQUIRE_CHECKSUM=true`
    - `PIELARMONIA_BACKUP_RECEIVER_ENCRYPTION_KEY=<clave_rotada>`
    - `PIELARMONIA_BACKUP_RECEIVER_RETENTION_DAYS=30`
- Configura en origen:
  `PIELARMONIA_BACKUP_OFFSITE_URL=https://DESTINO/backup-receiver.php`
  `PIELARMONIA_BACKUP_OFFSITE_TOKEN=<mismo_token>`
- Usa `CONFIGURAR-BACKUP-OFFSITE.ps1` para generar token y comandos.
  Implementacion canonica:
  `scripts/ops/setup/CONFIGURAR-BACKUP-OFFSITE.ps1`.

Validacion manual del ultimo backup cifrado en destino:

```bash
curl -s "https://DESTINO/verify-backup.php" -H "Authorization: Bearer BACKUP_RECEIVER_TOKEN"
```

### 3.3 Revision de Auditoria

Revisar `data/audit.log` semanalmente en busca de:

- Accesos no autorizados (`api.unauthorized`).
- Intentos de fuerza bruta.
- Errores recurrentes de la API.

---

## 4. Monitoreo y Rendimiento

Utilizar los scripts de PowerShell incluidos en el repositorio para metricas.

- **Latencia:** `.\scripts\ops\prod\BENCH-API-PRODUCCION.ps1` mide el tiempo de respuesta de la
  API.
- **Disponibilidad:** `.\scripts\ops\prod\SMOKE-PRODUCCION.ps1` realiza un recorrido rapido por
  las URLs principales.
- **Benchmark local o dirigido:** `npm run benchmark:local` reutiliza
  `TEST_BASE_URL` o levanta `127.0.0.1:8011`.
- **Gate web local:** `npm run test:frontend:performance:gate` usa
  `TEST_BASE_URL` o el host local canonico si no se le pasa uno.
- Implementaciones canonicas: `scripts/ops/prod/BENCH-API-PRODUCCION.ps1` y
  `scripts/ops/prod/SMOKE-PRODUCCION.ps1`.

---

## 5. Procedimiento de Rollback

### 5.1 Revertir Codigo (Deploy Fallido)

Si un despliegue introduce errores criticos (pantalla blanca, errores 500
generalizados), se debe revertir el codigo a la version estable anterior.

**Metodo A: Revertir via GitHub (Recomendado)**

1.  Identificar el commit problematico en la historia de `main`.
2.  Crear un revert commit:

    ```bash
    git revert <commit-hash>
    git push origin main
    ```

3.  Esto disparara automaticamente el workflow de despliegue
    (`deploy-hosting.yml`).
4.  Monitorear la pestana "Actions" en GitHub hasta que el deploy finalice
    (verde).

**Metodo B: Revertir Manual (Emergencia)**

Si GitHub Actions no funciona:

1.  Localizar el backup local o checkout del commit anterior.
2.  Subir manualmente los archivos PHP/JS/HTML via FTP/SFTP
    (ver seccion 1.2).
    - **NO** sobrescribir la carpeta `data/`.
    - **NO** subir `env.php` si no ha cambiado.

### 5.2 Restauracion de Base de Datos (Rollback de Datos)

Si el despliegue corrompio `store.json` o borro datos:

**Punto de Restauracion:**

El sistema genera backups automaticos en `data/backups/` antes de cada
escritura.

**Pasos:**

1.  Acceder por SFTP a `data/backups/`.
2.  Localizar el archivo `store-YYYYMMDD-HHMMSS-XXXXXX.json` con fecha/hora
    justo antes del incidente.
3.  Descargar y verificar que el JSON es valido.
4.  Renombrar `data/store.json` a `data/store.json.corrupt` (como evidencia).
5.  Subir el backup seleccionado como `data/store.json`.
6.  Verificar permisos (664 o 644).

### 5.3 Contactos de Emergencia

En caso de incidentes criticos que no se pueden resolver con rollback:

- **Lider Tecnico:** [Nombre/Telefono - Ver Gestor de Contrasenas]
- **Hosting Support:** [Link/Ticket]
- **Stripe Support:** [Link]

### 5.4 Checklist de Validacion Post-Rollback

Una vez revertido el cambio, ejecutar las siguientes validaciones:

1.  **Smoke Test:**
    - [ ] La pagina de inicio carga sin errores visuales.
    - [ ] `/api.php?resource=health` devuelve `{"status":"ok", ...}`.
    - [ ] `/api.php?resource=features` devuelve la configuracion correcta.
2.  **Flujos Criticos:**
    - [ ] El widget de reserva muestra horarios disponibles.
    - [ ] El formulario de "Telemedicina" carga correctamente.
    - [ ] Iniciar sesion en `/admin.html` (si aplica).
3.  **Logs:**
    - [ ] Verificar que no hay nuevos errores fatales en `php.log` o
          `error_log`.
