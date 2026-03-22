# LeadOps OpenClaw

Guia operativa del piloto de triage interno de leads sobre `callbacks`.

## Alcance

- V1 trabaja solo sobre `callbacks`.
- La IA se usa solo de forma interna en admin.
- No se envia automaticamente nada al paciente.
- El orden del panel depende del scoring heuristico local, no del worker IA.
- El gateway OpenClaw y el OAuth de ChatGPT/OpenAI viven en el laptop del operador, no en el servidor.

## Contrato funcional

- `GET /api.php?resource=data` devuelve `callbacks` enriquecidos con `leadOps` y `leadOpsMeta`.
- `PATCH /api.php?resource=callbacks` permite actualizar `status` y campos parciales de `leadOps`.
- `POST /api.php?resource=lead-ai-request` marca un callback como `requested`.
- `GET /api.php?resource=lead-ai-queue` entrega trabajos pendientes al worker pull-based.
- `POST /api.php?resource=lead-ai-result` persiste el resultado estructurado del worker.

Objetivos IA permitidos:

- `service_match`
- `call_opening`
- `whatsapp_draft`

## Topologia

1. El operador abre `admin.html` y revisa la bandeja de callbacks priorizada por heuristica.
2. Desde admin solicita un borrador IA para un callback puntual.
3. El servidor marca `leadOps.aiStatus=requested`.
4. El laptop del operador corre `npm run leadops:worker` y hace polling a `lead-ai-queue`.
5. El worker llama al gateway local OpenClaw (`OPENCLAW_GATEWAY_ENDPOINT`).
6. El worker publica `summary` y `draft` en `lead-ai-result`.
7. Admin muestra el resumen, el borrador y el estado comercial final (`contactado`, `cita_cerrada`, `sin_respuesta`, `descartado`).

## Integracion con el orquestador

- El orquestador ya no trata OpenClaw como plugin externo: lo modela como `provider_mode=openclaw_chatgpt`.
- Las tareas operativas del runtime viven en `domain_lane=transversal_runtime` con `codex_instance=codex_transversal`.
- Las superficies canónicas son:
    - `figo_queue`
    - `leadops_worker`
    - `operator_auth`
- `operator_auth` es superficie verificable, no invocable.

Comandos utiles:

- `node agent-orchestrator.js runtime verify pilot_runtime --json`
- `node agent-orchestrator.js runtime invoke <AG-ID> --expect-rev <n> --json`

Chequeos por surface:

- `figo_queue`: `GET /figo-ai-bridge.php`
- `leadops_worker`: `GET /api.php?resource=health`
- `operator_auth`: `GET /api.php?resource=operator-auth-status`

## Configuracion del servidor

Variables minimas en `env.php`:

- `AURORADERM_LEADOPS_MACHINE_TOKEN`
- `PIELARMONIA_LEADOPS_MACHINE_TOKEN` (alias transitorio aceptado mientras se termina la migracion de env vars)
- `AURORADERM_LEADOPS_MACHINE_TOKEN_HEADER` (default `Authorization`)
- `AURORADERM_LEADOPS_MACHINE_TOKEN_PREFIX` (default `Bearer`)
- `AURORADERM_LEADOPS_WORKER_STALE_AFTER_SECONDS` (default `900`)

Notas:

- El mismo token de maquina se configura en el servidor y en el laptop.
- Si el token no existe, el modo del worker queda `disabled`.
- El snapshot operativo del worker se guarda en `data/leadops-worker-status.json`.

## Configuracion del laptop operador

Variables minimas para el worker:

- `AURORADERM_LEADOPS_SERVER_BASE_URL`
- `PIELARMONIA_LEADOPS_SERVER_BASE_URL` (alias transitorio aceptado mientras se termina la migracion de env vars)
- `AURORADERM_LEADOPS_MACHINE_TOKEN`
- `AURORADERM_LEADOPS_WORKER_INTERVAL_MS`
- `OPENCLAW_GATEWAY_ENDPOINT`
- `OPENCLAW_GATEWAY_MODEL`

Variables opcionales:

- `OPENCLAW_GATEWAY_API_KEY`
- `OPENCLAW_GATEWAY_KEY_HEADER`
- `OPENCLAW_GATEWAY_KEY_PREFIX`
- `OPENCLAW_WORKER_MAX_JOBS`

Ejemplo PowerShell:

```powershell
$env:AURORADERM_LEADOPS_SERVER_BASE_URL = "https://pielarmonia.com"
$env:AURORADERM_LEADOPS_MACHINE_TOKEN = "token_largo_rotado"
$env:AURORADERM_LEADOPS_WORKER_INTERVAL_MS = "5000"
$env:OPENCLAW_GATEWAY_ENDPOINT = "http://127.0.0.1:4141/v1/responses"
$env:OPENCLAW_GATEWAY_MODEL = "openclaw:main"
$env:OPENCLAW_GATEWAY_API_KEY = "token_gateway"
npm run leadops:worker
```

Para una corrida unica sin loop:

```powershell
node bin/lead-ai-worker.js
```

## Helper local para login admin

El login admin por OpenClaw usa un helper HTTP local separado del worker LeadOps.

Variables minimas del helper:

- `AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL`
- `AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN`
- `AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET`
- `OPENCLAW_RUNTIME_BASE_URL`

Variables opcionales:

- `OPENCLAW_GATEWAY_API_KEY`
- `OPENCLAW_GATEWAY_KEY_HEADER`
- `OPENCLAW_GATEWAY_KEY_PREFIX`
- `OPENCLAW_HELPER_DEVICE_ID`

Ejemplo PowerShell:

```powershell
$env:AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL = "http://127.0.0.1:4173"
$env:AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN = "token_bridge_largo_rotado"
$env:AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET = "secret_hmac_rotado"
$env:OPENCLAW_RUNTIME_BASE_URL = "http://127.0.0.1:4141"
npm run checklist:admin:auth:local
npm run smoke:admin:auth:local
npm run openclaw:auth:start
```

Interpretacion rapida del preflight:

- `ok=false`: falta configuracion local o el runtime OpenClaw no responde.
- `ok=true` y `readyForLogin=false`: la maquina ya puede completar el bridge, pero el operador aun no inicio sesion en OpenClaw.
- `readyForLogin=true`: el laptop ya esta listo para abrir `admin.html`.
- El reporte incluye `nextAction` para indicar el siguiente paso recomendado.
- `checklist:admin:auth:local` imprime el smoke manual canonico para el laptop del operador.
- Implementacion canonica del checklist local: `scripts/ops/admin/CHECKLIST-OPENCLAW-AUTH-LOCAL.ps1`.
- `smoke:admin:auth:local` ejecuta el smoke no interactivo `start -> helper -> status -> logout`.
- Implementacion canonica del smoke local: `scripts/ops/admin/SMOKE-OPENCLAW-AUTH-LOCAL.ps1`.
- `npm run openclaw:auth:start` usa la implementacion canonica en `scripts/ops/admin/INICIAR-OPENCLAW-AUTH-HELPER.ps1`, corre `openclaw:auth-preflight` y solo despues levanta `openclaw:auth-helper`.
- OpenClaw sigue siendo el acceso primario del operador local.
- Si hace falta contingencia web desde cualquier PC, habilitar `AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true` (alias: `PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK`) junto con `AURORADERM_ADMIN_PASSWORD` o `AURORADERM_ADMIN_PASSWORD_HASH` y `AURORADERM_ADMIN_2FA_SECRET` (alias: `PIELARMONIA_ADMIN_2FA_SECRET`).
- La UI solo debe mostrar `Clave + 2FA de contingencia` cuando el backend anuncie `fallbacks.legacy_password.available=true`.

Flujo esperado:

1. Admin llama `POST /admin-auth.php?action=start`.
2. El panel abre `helperUrl` en una ventana local.
3. El helper consulta `GET /v1/session` y, si falta sesion, dispara `POST /v1/session/login`.
4. El helper firma el resultado y publica `POST /api.php?resource=operator-auth-complete`.
5. El panel sigue haciendo polling a `GET /admin-auth.php?action=status` hasta `autenticado` o estado terminal.

## Modo degradado

Estados operativos del worker:

- `disabled`: no hay token de maquina configurado.
- `pending`: hay configuracion pero aun no existe heartbeat util.
- `online`: el ultimo heartbeat/success esta fresco.
- `degraded`: hubo error mas reciente que el ultimo success.
- `offline`: el heartbeat supera `AURORADERM_LEADOPS_WORKER_STALE_AFTER_SECONDS`.

Comportamiento esperado:

- Admin sigue funcionando aunque OpenClaw o el laptop no esten disponibles.
- Los callbacks siguen ordenados por `heuristicScore`.
- El panel solo refleja `IA pendiente`, `IA degradada` o `IA offline`; no bloquea reservas, pagos ni auth.
- `lead-ai-queue` ya enmascara telefono (`telefonoMasked`) y envia contexto minimo.

## Validacion

Backend y worker:

- `php tests/lead_ops_service_test.php`
- `php vendor/bin/phpunit tests/Integration/LeadOpsEndpointsTest.php`
- `node --test tests-node/lead-ai-worker.test.js`

Admin y reporte:

- `npx playwright test tests/admin-callbacks-triage.spec.js`
- `node --test tests-node/weekly-report-script-contract.test.js`
- `npm run report:weekly:prod`

## Checklist de operacion

1. Verificar que `GET /api.php?resource=data` devuelve `leadOpsMeta`.
2. Confirmar que el panel de callbacks muestra prioridad `hot/warm/cold`.
3. Solicitar un borrador manual desde admin.
4. Confirmar que `lead-ai-queue` expone el callback como `requested`.
5. Ejecutar el worker local y revisar que `lead-ai-result` cierre el job.
6. Validar que `health` y metricas reflejan el modo `online`, `degraded` u `offline`.
7. Registrar el outcome comercial en admin para alimentar el reporte semanal.
