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

## Configuracion del servidor

Variables minimas en `env.php`:

- `PIELARMONIA_LEADOPS_MACHINE_TOKEN`
- `PIELARMONIA_LEADOPS_MACHINE_TOKEN_HEADER` (default `Authorization`)
- `PIELARMONIA_LEADOPS_MACHINE_TOKEN_PREFIX` (default `Bearer`)
- `PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS` (default `900`)

Notas:

- El mismo token de maquina se configura en el servidor y en el laptop.
- Si el token no existe, el modo del worker queda `disabled`.
- El snapshot operativo del worker se guarda en `data/leadops-worker-status.json`.

## Configuracion del laptop operador

Variables minimas para el worker:

- `PIELARMONIA_LEADOPS_SERVER_BASE_URL`
- `PIELARMONIA_LEADOPS_MACHINE_TOKEN`
- `PIELARMONIA_LEADOPS_WORKER_INTERVAL_MS`
- `OPENCLAW_GATEWAY_ENDPOINT`
- `OPENCLAW_GATEWAY_MODEL`

Variables opcionales:

- `OPENCLAW_GATEWAY_API_KEY`
- `OPENCLAW_GATEWAY_KEY_HEADER`
- `OPENCLAW_GATEWAY_KEY_PREFIX`
- `OPENCLAW_WORKER_MAX_JOBS`

Ejemplo PowerShell:

```powershell
$env:PIELARMONIA_LEADOPS_SERVER_BASE_URL = "https://pielarmonia.com"
$env:PIELARMONIA_LEADOPS_MACHINE_TOKEN = "token_largo_rotado"
$env:PIELARMONIA_LEADOPS_WORKER_INTERVAL_MS = "5000"
$env:OPENCLAW_GATEWAY_ENDPOINT = "http://127.0.0.1:4141/v1/responses"
$env:OPENCLAW_GATEWAY_MODEL = "openclaw:main"
$env:OPENCLAW_GATEWAY_API_KEY = "token_gateway"
npm run leadops:worker
```

Para una corrida unica sin loop:

```powershell
node bin/lead-ai-worker.js
```

## Modo degradado

Estados operativos del worker:

- `disabled`: no hay token de maquina configurado.
- `pending`: hay configuracion pero aun no existe heartbeat util.
- `online`: el ultimo heartbeat/success esta fresco.
- `degraded`: hubo error mas reciente que el ultimo success.
- `offline`: el heartbeat supera `PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS`.

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
