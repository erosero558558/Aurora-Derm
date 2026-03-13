# Runbook Tri-Lane Runtime

Este runbook define el flujo operativo diario para ejecutar tres instancias
Codex sin solapes y con OpenClaw integrado como runtime transversal nativo.

## Lanes canonicas

- `codex_backend_ops`:
  `controllers/**`, `lib/**`, `api.php`, `figo-*.php`,
  `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`
- `codex_frontend`:
  `src/apps/**`, `js/**`, `styles*.css`, `templates/**`, `content/**`,
  `*.html`
- `codex_transversal`:
  `agent-orchestrator.js`, `AGENTS.md`, `AGENT_BOARD.yaml`,
  `AGENT_HANDOFFS.yaml`, `AGENT_JOBS.yaml`, `AGENT_SIGNALS.yaml`,
  `governance-policy.json`, `tools/agent-orchestrator/**`,
  `bin/validate-agent-governance.php`, `figo-ai-bridge.php`,
  `lib/figo_queue.php`, `lib/auth.php`, `controllers/OperatorAuthController.php`,
  `controllers/LeadAiController.php`, `bin/lead-ai-worker.js`,
  `bin/lib/lead-ai-worker.js`

## Runtime OpenClaw

Provider canonico:

- `provider_mode=openclaw_chatgpt`

Surfaces soportadas:

- `runtime_surface=figo_queue`
- `runtime_surface=leadops_worker`
- `runtime_surface=operator_auth`

Transportes soportados:

- `runtime_transport=hybrid_http_cli`
- `runtime_transport=http_bridge`
- `runtime_transport=cli_helper`

Reglas:

- `operator_auth` es verificable, no invocable.
- Las tareas runtime OpenClaw viven en
  `domain_lane=transversal_runtime` y `codex_instance=codex_transversal`.
- `codex-check` debe bloquear si una tarea runtime activa apunta a una
  surface no saludable.

## Branch slicing

- Lane ownership y branch slicing resuelven problemas distintos.
- Antes de abrir una rama mixta, usar `docs/BRANCH_SLICING_GUARDRAILS.md`.
- Mantener, por defecto, slices separados para `ops/deploy`, `queue runtime`,
  `desktop shells`, `tests` y `governance evidence`.
- Si una rama cruza slices y lanes a la vez, el handoff debe explicar por que
  la mezcla es necesaria.

## Flujo diario

1. Revisar estado:
   `node agent-orchestrator.js task ls --active --json`
   `node agent-orchestrator.js conflicts --json`
   `node agent-orchestrator.js codex-check --json`
2. Verificar runtime OpenClaw si la tarea es transversal:
   `node agent-orchestrator.js runtime verify openclaw_chatgpt --json`
3. Tomar tarea con lane fija:
   backend: `codex_instance=codex_backend_ops`, `domain_lane=backend_ops`
   frontend: `codex_instance=codex_frontend`, `domain_lane=frontend_content`
   transversal: `codex_instance=codex_transversal`, `domain_lane=transversal_runtime`
4. Trabajar y validar.
5. Si hay cruce de dominio:
   crear handoff `active` con archivos acotados y `expires_at`
   cerrar handoff al terminar
6. Antes de merge:
   `node agent-orchestrator.js handoffs lint --json`
   `npm run agent:test`
   `npm run agent:gate`

## Ejemplos

### Crear tarea backend

```bash
node agent-orchestrator.js task create \
  --title "Fix calendar slot lock" \
  --executor codex \
  --status ready \
  --risk high \
  --scope calendar \
  --files controllers/AppointmentController.php,lib/calendar/CalendarBookingService.php \
  --codex-instance codex_backend_ops \
  --domain-lane backend_ops \
  --lane-lock strict \
  --cross-domain false \
  --json
```

### Crear tarea frontend

```bash
node agent-orchestrator.js task create \
  --title "Refactor booking CTA copy" \
  --executor codex \
  --status ready \
  --risk low \
  --scope ui \
  --files src/apps/booking/engine.js,styles-deferred.css \
  --codex-instance codex_frontend \
  --domain-lane frontend_content \
  --lane-lock strict \
  --cross-domain false \
  --json
```

### Crear tarea runtime transversal

Via corta recomendada:

```bash
node agent-orchestrator.js task create \
  --title "Verificar OpenClaw Figo bridge" \
  --template runtime \
  --files figo-ai-bridge.php,lib/figo_queue.php \
  --json
```

Esto auto-completa:

- `scope=openclaw_runtime`
- `domain_lane=transversal_runtime`
- `codex_instance=codex_transversal`
- `provider_mode=openclaw_chatgpt`
- `runtime_transport=hybrid_http_cli`

La `runtime_surface` se infiere desde `files`. Si necesitas forzarla porque la
superficie no es evidente, agrega `--runtime-surface figo_queue|leadops_worker|operator_auth`.

### Invocar runtime transversal

```bash
node agent-orchestrator.js runtime invoke AG-900 --expect-rev 12 --json
```

### Handoff cross-domain

```bash
node agent-orchestrator.js handoffs create \
  --from AG-101 \
  --to AG-102 \
  --files src/apps/chat/engine.js,figo-chat.php \
  --reason "ajuste contrato request/response" \
  --approved-by ernesto
```
