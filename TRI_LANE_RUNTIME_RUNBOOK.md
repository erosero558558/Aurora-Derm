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

## Capacidad y slots

- Cada `codex_instance` dispone de `2` slots de ejecucion.
- Solo consumen slot los estados `in_progress`, `review` y `blocked`.
- `ready` funciona como cola alineada del lane: no consume slot y no exige
  bloque `CODEX_ACTIVE`.
- Una misma `strategy.active` puede tener varios `subfronts` por lane; el
  fallback `codex_instance -> subfront_id` solo es valido cuando el lane tiene
  un unico subfrente.
- Si un `scope` del lane coincide con mas de un subfrente candidato,
  `strategy intake` debe recibir `--subfront-id`.
- `CODEX_ACTIVE` se espeja por `task_id`, puede incluir `subfront_id` y puede
  coexistir varias veces para el mismo lane hasta el cap de `2`.

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
   `node agent-orchestrator.js status --json`
   `node agent-orchestrator.js conflicts --json`
   `node agent-orchestrator.js codex-check --json`
   `node agent-orchestrator.js board reconcile --json`
2. Verificar runtime OpenClaw si la tarea es transversal:
   `node agent-orchestrator.js runtime verify openclaw_chatgpt --json`
3. Tomar tarea con lane fija y `subfront_id` valido:
   backend: `codex_instance=codex_backend_ops`, `domain_lane=backend_ops`
   frontend: `codex_instance=codex_frontend`, `domain_lane=frontend_content`
   transversal: `codex_instance=codex_transversal`, `domain_lane=transversal_runtime`
4. Si la estrategia activa tiene varios subfrentes en ese lane, abrir la tarea
   con `strategy intake --subfront-id ...`; si solo hay uno, el fallback sigue
   permitido.
5. Trabajar y validar.
6. Al pasar una tarea a `in_progress`, `review` o `blocked`, confirmar que el
   lane no excede `2` slots y que el mirror `CODEX_ACTIVE` queda alineado.
7. Si hay cruce de dominio:
   crear handoff `active` con archivos acotados y `expires_at`
   cerrar handoff al terminar
8. Antes de merge:
   `node agent-orchestrator.js handoffs lint --json`
   `npm run agent:test`
   `npm run agent:gate`

## Verdad canonica entre worktrees

- El board canonico vive en el worktree canonico; cualquier fork de `AGENT_BOARD.yaml` entre worktrees bloquea mutaciones y publish.
- `main` no puede conservar authored `mixed_lane`, authored fuera de scope ni boards paralelos activos.
- `status`, `board doctor`, `conflicts` y `codex-check` corren en `all-worktrees` por defecto y deben tratar `workspace_truth.ok=false` como bloqueo fuerte.
- `board reconcile --apply-safe` solo alinea revision, heartbeats, leases y metadata equivalente; nunca auto-mergea tareas activas divergentes.
- Las `AG-*` activas con `executor=codex` solo pueden existir como soporte de una `CDX-*` activa alineada por lane/subfront.

## Ejemplos

### Intake canonico con scope ambiguo

```bash
node agent-orchestrator.js strategy intake \
  --title "Hardening del shell admin operativo" \
  --scope frontend-admin \
  --subfront-id SF-frontend-admin-operativo \
  --files src/apps/admin-v3/app.js,src/apps/admin-v3/ui/frame/frame-shell.js \
  --expect-rev 12 \
  --json
```

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
