# Runbooks Operacionales - Piel en ArmonÃ­a

Este documento detalla los procedimientos estÃ¡ndar para la operaciÃ³n, despliegue y respuesta a incidentes del sistema Piel en ArmonÃ­a.

## 1. Despliegue (Deployment)

Para detalles tÃ©cnicos profundos, ver `DESPLIEGUE-PIELARMONIA.md`.

### 1.1 Despliegue AutomÃ¡tico (Recomendado)

El repositorio cuenta con un flujo de GitHub Actions (`.github/workflows/deploy-hosting.yml`) que se dispara al hacer push a la rama `main`.

**Pasos:**

1.  Realizar cambios en una rama de `feature`.
2.  Crear Pull Request y fusionar a `main`.
3.  Verificar la ejecuciÃ³n del Action en la pestaÃ±a "Actions" de GitHub.
4.  Una vez completado (verde), ejecutar la validaciÃ³n post-despliegue.

### 1.2 Despliegue Manual (FTP)

Si el despliegue automÃ¡tico falla, se puede subir manualmente.

**Pasos:**

1.  Ejecutar `npm run bundle:deploy` para generar el paquete ZIP en `_deploy_bundle/`.
2.  Conectarse al servidor FTP (credenciales en gestor de contraseÃ±as del equipo).
3.  Subir el contenido del ZIP a `public_html/`.
4.  **Importante:** No sobrescribir la carpeta `data/` si ya contiene datos de producciÃ³n.

### 1.3 ValidaciÃ³n Post-Despliegue

DespuÃ©s de cualquier despliegue, ejecutar el script de verificaciÃ³n:

```powershell
.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com"
```

Esto verificarÃ¡:

- Estado HTTP 200 en pÃ¡ginas clave.
- Respuesta de la API (`/health`).
- ConfiguraciÃ³n de seguridad (Headers).

### 1.4 Cierre de Hardening (Fase 5)

Para cerrar formalmente hardening y reactivar el gate estricto:

1.  Verificar que CI este en verde para el commit objetivo.
2.  Ejecutar validacion strict de hashes:

```powershell
.\GATE-POSTDEPLOY.ps1 -Domain "https://pielarmonia.com" -ForceAssetHashChecks
```

3.  Repetir hasta tener 3 corridas consecutivas en verde.
4.  Si una corrida falla solo por p95 puntual (con hash + smoke en verde), tratar como pico transitorio y recomenzar el conteo de corridas consecutivas desde el siguiente OK.
5.  Registrar evidencia (fecha/hora, p95 por endpoint y resultado) en `PLAN_MAESTRO_2026_STATUS.md`.
6.  Actualizar el estado de fase en `PLAN_MAESTRO_OPERATIVO_2026.md`.

### 1.5 Politica warning -> blocking y fallback operativo

Objetivo: mantener deploy diurno rapido sin perder control de riesgo.

Reglas:

1.  Fast lane (`post-deploy-fast.yml`) bloquea solo por fallas de health/smoke/contrato critico.
2.  Full gate (`post-deploy-gate.yml`) se usa para regression completa y decision final en casos de duda.
    - En modo automatico por `push`, se activa solo si `RUN_POSTDEPLOY_GATE_ON_PUSH=true` (default recomendado `false`).
    - La politica de stage/flags de admin rollout se resuelve en `bin/resolve-admin-rollout-policy.js` para mantener consistencia entre precheck (`deploy-hosting`) y gates (`post-deploy-fast`/`post-deploy-gate`).
3.  Nightly (`nightly-stability.yml`) valida dominios `platform`, `agenda`, `funnel` y publica semaforos por dominio.
4.  Si hay warning no critico aislado (pico transitorio), se permite continuar solo si:
    - smoke y health estan en verde;
    - no hay warning critico;
    - existe rerun de confirmacion o evidencia de recuperacion.
5.  Si hay warning critico (`calendar_unreachable`, `calendar_token_unhealthy`, errores de seguridad o contrato critico), la decision es `block`.

Fallback operativo ante pico transitorio:

1.  Ejecutar `npm run gate:prod:fast` para confirmar estado base.
2.  Ejecutar `npm run gate:prod:strict` para confirmar si el warning persiste.
3.  Si persiste, abrir incidente `[ALERTA PROD]` y detener release hasta resolver causa raiz.
4.  Si desaparece, registrar evento como transitorio con timestamp y metrica afectada.

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
4. Confirmar que el comportamiento de incidentes semanales coincide con los nuevos umbrales.
5. Si el cambio no es el esperado, volver a defaults y re-ejecutar.

### 1.7 Admin UI sony_v2/sony_v3 rollout y rollback

Para el despliegue del admin Sony-like `sony_v2/sony_v3` usar el runbook dedicado:

- `docs/ADMIN-UI-ROLLOUT.md`

Comando operativo rapido:

```powershell
npm run admin:ui:contingency
```

Este comando consulta los flags actuales (`admin_sony_ui`, `admin_sony_ui_v3`) y muestra URLs de canary/rollback:

- limpiar variante local: `admin_ui_reset=1`
- sony_v2 session-only: `admin_ui=sony_v2&admin_ui_reset=1`
- sony_v3 session-only: `admin_ui=sony_v3&admin_ui_reset=1`
- legacy session-only: `admin_ui=legacy&admin_ui_reset=1`

Gate recomendado por etapa:

```powershell
npm run gate:admin:rollout
npm run gate:admin:rollout:general
npm run gate:admin:rollout:rollback
```

Reglas operativas por etapa:

1. `internal`
    - permite QA con `admin_ui=sony_v3`.
    - el gate puede tolerar `features API`/flags faltantes segun la politica efectiva del stage.
2. `canary`
    - requiere `admin_sony_ui=true` y `admin_sony_ui_v3=true`.
    - el gate corre `admin-ui-runtime-smoke` y `admin-v3-canary-runtime`.
    - en `post-deploy-fast`, el runtime smoke puede seguir omitido por default para mantener SLA corto.
3. `general`
    - requiere `admin_sony_ui=true` y `admin_sony_ui_v3=true`.
    - el gate completo corre `admin-ui-runtime-smoke` y `admin-v3-canary-runtime`.
4. `rollback`
    - requiere `admin_sony_ui=false` y `admin_sony_ui_v3=false`.
    - el gate vuelve al smoke base de variantes/CSP sin exigir shell `sony_v3`.

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
    - `post-deploy-fast.yml` usa perfil `progressive` y default `skip_runtime_smoke=true`
    - `post-deploy-gate.yml` usa perfil `strict` y default `skip_runtime_smoke=false`
2. Para ejecucion automatica, controlar con variables:
    - `RUN_POSTDEPLOY_FAST_FROM_DEPLOY_WORKFLOW_RUN` (preferido; recomendado `false`)
    - `RUN_POSTDEPLOY_GATE_FROM_DEPLOY_WORKFLOW_RUN` (preferido; recomendado `false`)
    - fallback legacy: `RUN_POSTDEPLOY_FAST_FROM_DEPLOY` y `RUN_POSTDEPLOY_GATE_FROM_DEPLOY`

---

## 2. Respuesta a Incidentes (Emergency Response)

### 2.1 Sitio CaÃ­do (HTTP 500 / Timeout)

**SÃ­ntoma:** El sitio no carga o muestra error de servidor.

**Acciones:**

1.  **Verificar Logs:** Acceder por FTP y revisar `php.log` o `error_log` en la raÃ­z.
2.  **Health Check:** Consultar `https://pielarmonia.com/api.php?resource=health` para ver si la API responde JSON.
3.  **Revertir:** Si fue tras un despliegue, volver a desplegar la versiÃ³n anterior (revert commit en Git y push).
4.  **Infraestructura:** Verificar estado del proveedor de hosting.

### 2.2 CorrupciÃ³n de Datos

**SÃ­ntoma:** Datos faltantes, citas errÃ³neas, JSON invÃ¡lido en `store.json`.

**Acciones:**

1.  **Detener Escrituras:** Renombrar `api.php` temporalmente o poner el sitio en mantenimiento para evitar nuevas escrituras.
2.  **Evaluar DaÃ±o:** Descargar `data/store.json` y validar su sintaxis JSON.
3.  **Restaurar:** Seguir el procedimiento de **Disaster Recovery** (ver `docs/DISASTER_RECOVERY.md`).

### 2.3 Fallo en Pagos (Stripe)

**SÃ­ntoma:** Usuarios reportan que no pueden pagar o citas no se confirman.

**Acciones:**

1.  **Verificar Config:** `GET /payment-config` debe devolver `enabled: true`.
2.  **Stripe Dashboard:** Verificar si hay errores en los logs de Stripe (API keys expiradas, webhooks fallidos).
3.  **Logs de AuditorÃ­a:** Revisar `data/audit.log` buscando eventos `stripe.webhook_failed`.

### 2.4 Chatbot No Responde

**SÃ­ntoma:** El chat se queda cargando o da error.

**Acciones:**

1.  **Verificar Figo:** Consultar `https://pielarmonia.com/figo-chat.php`. Debe devolver diagnÃ³stico.
2.  **Reiniciar:** No aplica (PHP stateless), pero revisar si la variable de entorno `FIGO_CHAT_ENDPOINT` es correcta.

### 2.5 Falso Negativo de Gate por Latencia p95

**Sintoma:** `GATE-POSTDEPLOY.ps1 -ForceAssetHashChecks` falla por p95 alto en un endpoint (ej: `availability`), pero headers, hashes y smoke estan en verde.

**Acciones:**

1.  Re-ejecutar el gate strict inmediatamente para confirmar si es pico transitorio.
2.  Si el segundo intento pasa, registrar el incidente como transitorio y continuar con corridas consecutivas.
3.  Si falla de nuevo en el mismo endpoint:
    - ejecutar benchmark dedicado para aislar el endpoint;
    - verificar estado de infraestructura/hosting y saturacion de red;
    - abrir incidente operativo y no cerrar fase.

---

## 3. Tareas Rutinarias (Routine Tasks)

### 3.1 Monitoreo Diario

- Visitar el sitio y verificar carga rÃ¡pida.
- Verificar que `https://pielarmonia.com/api.php?resource=health` estÃ© OK.

### 3.2 Backups y Verificacion

El sistema mantiene backups rotativos en `data/backups/` al escribir `store.json`. Adicionalmente, se recomienda ejecutar verificaciones y replicacion offsite por cron.

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

Si no configuras endpoint remoto, `backup-offsite` replica localmente en `data/backups/offsite-local/`.

Para rÃ©plica remota real:

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

Validacion manual del ultimo backup cifrado en destino:

```bash
curl -s "https://DESTINO/verify-backup.php" -H "Authorization: Bearer BACKUP_RECEIVER_TOKEN"
```

### 3.3 RevisiÃ³n de AuditorÃ­a

Revisar `data/audit.log` semanalmente en busca de:

- Accesos no autorizados (`api.unauthorized`).
- Intentos de fuerza bruta.
- Errores recurrentes de la API.

---

## 4. Monitoreo y Rendimiento

Utilizar los scripts de PowerShell incluidos en el repositorio para mÃ©tricas.

- **Latencia:** `.\BENCH-API-PRODUCCION.ps1` mide el tiempo de respuesta de la API.
- **Disponibilidad:** `.\SMOKE-PRODUCCION.ps1` realiza un recorrido rÃ¡pido por las URLs principales.

---

## 5. Procedimiento de Rollback

### 5.1 Revertir CÃ³digo (Deploy Fallido)

Si un despliegue introduce errores crÃ­ticos (pantalla blanca, errores 500 generalizados), se debe revertir el cÃ³digo a la versiÃ³n estable anterior.

**MÃ©todo A: Revertir vÃ­a GitHub (Recomendado)**

1.  Identificar el commit problemÃ¡tico en la historia de `main`.
2.  Crear un revert commit:
    ```bash
    git revert <commit-hash>
    git push origin main
    ```
3.  Esto dispararÃ¡ automÃ¡ticamente el workflow de despliegue (`deploy-hosting.yml`).
4.  Monitorear la pestaÃ±a "Actions" en GitHub hasta que el deploy finalice (verde).

**MÃ©todo B: Revertir Manual (Emergencia)**
Si GitHub Actions no funciona:

1.  Localizar el backup local o checkout del commit anterior.
2.  Subir manualmente los archivos PHP/JS/HTML vÃ­a FTP/SFTP (ver secciÃ³n 1.2).
    - **NO** sobrescribir la carpeta `data/`.
    - **NO** subir `env.php` si no ha cambiado.

### 5.2 RestauraciÃ³n de Base de Datos (Rollback de Datos)

Si el despliegue corrompiÃ³ `store.json` o borrÃ³ datos:

**Punto de RestauraciÃ³n:**
El sistema genera backups automÃ¡ticos en `data/backups/` antes de cada escritura.

**Pasos:**

1.  Acceder por SFTP a `data/backups/`.
2.  Localizar el archivo `store-YYYYMMDD-HHMMSS-XXXXXX.json` con fecha/hora justo antes del incidente.
3.  Descargar y verificar que el JSON es vÃ¡lido.
4.  Renombrar `data/store.json` a `data/store.json.corrupt` (como evidencia).
5.  Subir el backup seleccionado como `data/store.json`.
6.  Verificar permisos (664 o 644).

### 5.3 Contactos de Emergencia

En caso de incidentes crÃ­ticos que no se pueden resolver con rollback:

- **LÃ­der TÃ©cnico:** [Nombre/TelÃ©fono - Ver Gestor de ContraseÃ±as]
- **Hosting Support:** [Link/Ticket]
- **Stripe Support:** [Link]

### 5.4 Checklist de ValidaciÃ³n Post-Rollback

Una vez revertido el cambio, ejecutar las siguientes validaciones:

1.  **Smoke Test:**
    - [ ] La pÃ¡gina de inicio carga sin errores visuales.
    - [ ] `/api.php?resource=health` devuelve `{"status":"ok", ...}`.
    - [ ] `/api.php?resource=features` devuelve la configuraciÃ³n correcta.

2.  **Flujos CrÃ­ticos:**
    - [ ] El widget de reserva muestra horarios disponibles.
    - [ ] El formulario de "Telemedicina" carga correctamente.
    - [ ] Iniciar sesiÃ³n en `/admin.html` (si aplica).

3.  **Logs:**
    - [ ] Verificar que no hay nuevos errores fatales en `php.log` o `error_log`.
