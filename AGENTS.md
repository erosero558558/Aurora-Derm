# AGENTS.md — Politica Canonica de Orquestacion de Agentes

AGENT_POLICY_VERSION: 2026-orchestration-v1
CANONICAL_AGENT_POLICY: AGENTS.md
AUTONOMY_MODEL: semi_autonomous_guardrails
PRIMARY_KPI: reduce_rework

Este documento es la fuente de verdad operativa del modo `codex-only` del
repositorio: `codex_backend_ops`, `codex_frontend`, `codex_transversal` y
`CI` (GitHub Actions).
`Claude`, `Kimi` y `Jules` quedan solo como referencias historicas de tareas
terminales ya cerradas.

## Reglas de precedencia

1. Si hay conflicto entre documentos, prevalece `AGENTS.md`.
2. `CLAUDE.md` es guia de rol para Claude; no puede contradecir este archivo.
3. `JULES_TASKS.md` y `KIMI_TASKS.md` quedan preservados solo como tombstones historicos.
4. El backlog canonico es `AGENT_BOARD.yaml`.
5. En caso de duda operativa, se aplica la opcion mas conservadora.

## Objetivo operativo

Reducir retrabajo, conflictos y bucles de implementacion entre agentes,
manteniendo trazabilidad de tareas y gates de calidad en verde.

Metas de operacion:

- Retrabajo semanal: -40% en 4 semanas.
- Conflictos por solape de archivos: < 5% de tareas.
- Lead time en tareas no criticas: < 1 dia.
- Gate rojo por coordinacion: < 10% semanal.

## Estrategia madre activa

Cuando `AGENT_BOARD.yaml.strategy.active.status=active`, esa estrategia pasa a
ser el marco obligatorio de direccion para toda ejecucion nueva.

Reglas:

- Solo se permite una `strategy.active` a la vez.
- La estrategia activa define exactamente un subfrente por
  `codex_instance` (`codex_backend_ops`, `codex_frontend`,
  `codex_transversal`).
- Todo hilo nuevo de Codex debe leer `strategy.active`, tomar un
  `subfront_id` valido para su lane y rechazar trabajo fuera de ese frente.
- Las tareas en `ready`, `in_progress`, `review` o `blocked` deben declarar
  `strategy_id`, `subfront_id`, `strategy_role` y, si aplica,
  `strategy_reason`.
- `strategy_role=exception` solo se permite para hotfix critico o soporte
  directo al frente activo, y siempre requiere `strategy_reason` explicito.
- Las tareas historicas terminales (`done`, `failed`) no requieren backfill
  obligatorio de estrategia.

## Arbol de decision oficial (v2)

```text
La tarea toca zona critica? (pagos/auth/calendar prod/deploy/env/seguridad)
  Si -> codex_backend_ops lidera con plan + checklist + tests + gate backend.
  No -> continuar.

La tarea toca orquestador, gobernanza o runtime OpenClaw transversal?
  Si -> codex_transversal lidera con verificacion de surface + tests + gate runtime.
  No -> continuar.

La tarea es puramente frontend/publica?
  Si -> codex_frontend.
  No -> codex_backend_ops.

Hay solape de archivos con tarea activa?
  Si -> bloquear dispatch y replanificar.
  No -> ejecutar.

La tarea cambia comportamiento runtime?
  Si -> tests + smoke + gate.
  No -> lint/tests minimos por tipo de cambio.
```

## Politica de velocidad operativa (Directo vs Orquestador)

Objetivo: evitar sobrecosto de coordinacion en tareas pequenas y urgentes.

Usar ejecucion directa (sin ciclo completo de orquestacion) cuando:

- Hay incidente de produccion activo (`[ALERTA PROD]`) y el fix es acotado (1-3 archivos).
- Existe causa raiz clara en logs y un solo executor puede cerrar end-to-end.
- El tiempo estimado de fix+validacion es menor que correr `intake+score+dispatch+reconcile`.

Usar orquestacion completa cuando:

- Hay trabajo paralelo multiagente o backlog con dependencias.
- Hay probabilidad de solape de archivos entre tareas activas.
- Se requiere coordinacion explicita entre `codex_backend_ops` y `codex_frontend`.

Regla de SLA:

- Incidente urgente: priorizar camino directo para reducir MTTR.
- Tareas no urgentes: priorizar orquestacion para reducir retrabajo.

## Zonas criticas con guardrails

Las siguientes zonas no se ejecutan en modo ciego:

- Flujo de pagos Stripe.
- Autenticacion y sesion admin.
- Booking/reprogramacion contra Google Calendar en produccion.
- Cron/backup/restore.
- Workflows de deploy, gate y monitoreo.
- Configuracion sensible (`env.php`, secrets, tokens).

Para zona critica es obligatorio:

1. Plan aprobado en markdown.
2. Checklist de pruebas.
3. Evidencia de gate/smoke.
4. Handoff estructurado.

## Modelo de asignacion por agente

- `codex_backend_ops`: backend, cron, deploy, workflows, seguridad, runtime critico.
- `codex_frontend`: `src/apps/**`, `templates/**`, `content/**`, `*.html`, `js/**`, `styles*.css`.
- `codex_transversal`: orquestador, board/policy, CI de gobernanza y superficies OpenClaw/ChatGPT transversales.
- `ci`: arbitro de consistencia, conflictos y calidad minima.
- `claude`, `kimi`, `jules`: retirados para trabajo activo; solo tolerados en tareas terminales historicas.

## Tri-Lane Codex Matrix (Runtime Transversal)

Particion operativa obligatoria entre tres instancias de Codex:

- `codex_backend_ops`: `controllers/**`, `lib/**`, `api.php`, `figo-*.php`,
  `.github/workflows/**`, `cron.php`, `env*.php`, `bin/**`.
- `codex_frontend`: `src/apps/**`, `js/**`, `styles*.css`, `templates/**`,
  `content/**`, `*.html`.
- `codex_transversal`: `agent-orchestrator.js`, `AGENTS.md`,
  `AGENT_BOARD.yaml`, `AGENT_HANDOFFS.yaml`, `AGENT_JOBS.yaml`,
  `AGENT_SIGNALS.yaml`, `governance-policy.json`,
  `TRI_LANE_RUNTIME_RUNBOOK.md`, `PLAN_MAESTRO_CODEX_2026.md`,
  `tools/agent-orchestrator/**`, `bin/validate-agent-governance.php`,
  `figo-ai-bridge.php`, `lib/figo_queue.php`, `lib/auth.php`,
  `controllers/OperatorAuthController.php`, `controllers/LeadAiController.php`,
  `bin/lead-ai-worker.js`, `bin/lib/lead-ai-worker.js`.

Reglas:

- Si hay duda de ownership de archivo, gana criterio conservador:
  `codex_backend_ops`.
- `critical_zone=true` solo puede ejecutarse en `codex_backend_ops`, salvo
  tareas runtime OpenClaw con `provider_mode=openclaw_chatgpt`, que viven en
  `codex_transversal`.
- Cruces de dominio solo con handoff activo (`AGENT_HANDOFFS.yaml`) y
  expiracion definida.
- No se permite solape cross-lane sin handoff activo.

## Contrato canonico de tareas

El tablero unico vive en `AGENT_BOARD.yaml`.

Campos obligatorios por tarea:

- `id`, `title`, `owner`, `executor`, `status`, `risk`, `scope`, `files`,
  `codex_instance`, `domain_lane`, `lane_lock`, `cross_domain`,
  `strategy_id`, `subfront_id`, `strategy_role`, `strategy_reason`,
  `provider_mode`, `runtime_surface`, `runtime_transport`,
  `runtime_last_transport`,
  `source_signal`, `source_ref`, `priority_score`, `sla_due_at`,
  `last_attempt_at`, `attempts`, `blocked_reason`, `runtime_impact`,
  `critical_zone`, `acceptance`, `acceptance_ref`, `evidence_ref`,
  `depends_on`, `created_at`, `updated_at`.

Valores validos para coordinacion tri-lane:

- `codex_instance`: `codex_backend_ops | codex_frontend | codex_transversal`
- `domain_lane`: `backend_ops | frontend_content | transversal_runtime`
- `lane_lock`: `strict | handoff_allowed`
- `cross_domain`: `true | false`
- `provider_mode`: `openclaw_chatgpt | ""`
- `runtime_surface`: `figo_queue | leadops_worker | operator_auth | ""`
- `runtime_transport`: `hybrid_http_cli | http_bridge | cli_helper | ""`

Regla adicional:

- Si una tarea depende del runtime OpenClaw, debe usar
  `domain_lane=transversal_runtime`,
  `codex_instance=codex_transversal`,
  `provider_mode=openclaw_chatgpt` y surface/transport validos.
- Si existe `strategy.active` y la tarea esta en estado activo
  (`ready|in_progress|review|blocked`), debe alinearse con la estrategia
  activa y con el `subfront_id` correspondiente a su `codex_instance`.

Estados permitidos:

- `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`, `failed`.

Los cierres requieren evidencia:

- `verification/agent-runs/<task_id>.md`
- `acceptance_ref` en el task board.

## Operacion diaria

Comandos canonicos:

```bash
node agent-orchestrator.js status
node agent-orchestrator.js status --explain-red
node agent-orchestrator.js status --json --explain-red
node agent-orchestrator.js strategy status
node agent-orchestrator.js strategy status --json
node agent-orchestrator.js strategy set-active --seed admin-operativo --expect-rev 12 --json
node agent-orchestrator.js strategy close --reason review_complete --expect-rev 12 --json
node agent-orchestrator.js intake --strict
node agent-orchestrator.js score
node agent-orchestrator.js stale --strict
node agent-orchestrator.js budget --json
node agent-orchestrator.js conflicts
node agent-orchestrator.js conflicts --json
node agent-orchestrator.js handoffs status
node agent-orchestrator.js handoffs lint
node agent-orchestrator.js handoffs status --json
node agent-orchestrator.js handoffs lint --json
node agent-orchestrator.js policy lint
node agent-orchestrator.js policy lint --json
node agent-orchestrator.js handoffs create --from AG-001 --to CDX-001 --files path/a,path/b --reason soporte --approved-by ernesto
node agent-orchestrator.js handoffs close HO-001 --reason handoff_done
node agent-orchestrator.js handoffs close HO-001 --reason handoff_done --expect-rev 12 --json
node agent-orchestrator.js leases status
node agent-orchestrator.js leases status --json
node agent-orchestrator.js leases heartbeat AG-003 --ttl-hours 4 --json
node agent-orchestrator.js leases heartbeat AG-003 --ttl-hours 4 --expect-rev 12 --json
node agent-orchestrator.js leases clear AG-003 --reason manual_release --json
node agent-orchestrator.js codex-check
node agent-orchestrator.js codex-check --json
node agent-orchestrator.js jobs status --json
node agent-orchestrator.js jobs verify public_main_sync --json
node agent-orchestrator.js runtime verify openclaw_chatgpt --json
node agent-orchestrator.js runtime invoke AG-900 --expect-rev 12 --json
node agent-orchestrator.js codex start CDX-001 --block C1
node agent-orchestrator.js codex start CDX-001 --block C1 --expect-rev 12
node agent-orchestrator.js codex stop CDX-001 --to review
node agent-orchestrator.js board doctor
node agent-orchestrator.js board doctor --json --profile ci
node agent-orchestrator.js board events tail --json
node agent-orchestrator.js board events stats --days 7 --json
node agent-orchestrator.js task claim AG-003 --owner ernesto
node agent-orchestrator.js task claim AG-003 --owner ernesto --expect-rev 12 --json
node agent-orchestrator.js task ls --active --json
node agent-orchestrator.js task ls --mine --active --json
node agent-orchestrator.js task ls --executor codex --status in_progress --json
node agent-orchestrator.js task create --title "..." --executor codex --files path/a,path/b --status ready --risk low --scope docs --json
node agent-orchestrator.js task create --title "..." --template docs --files docs/a.md --json
node agent-orchestrator.js task create --title "..." --template bugfix --from-files --files lib/calendar/CalendarBookingService.php --executor codex --json
node agent-orchestrator.js task create --interactive --json
node agent-orchestrator.js task create --title "..." --template docs --from-files --explain --preview --files lib/calendar/CalendarAvailabilityService.php
node agent-orchestrator.js task create --title "..." --template bugfix --from-files --validate-only --files controllers/FooController.php --json
node agent-orchestrator.js task create --apply verification/task-create-preview.json --json
node agent-orchestrator.js task create --apply - --json < verification/task-create-preview.json
node agent-orchestrator.js task create preview-file lint verification/task-create-preview.json --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --json
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --format full
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --to backlog --json
node agent-orchestrator.js task create preview-file diff verification/task-create-preview.json --json --format compact
node agent-orchestrator.js task create --apply verification/task-create-preview.json --force-id-remap --to backlog --claim-owner ernesto --json
node agent-orchestrator.js task start AG-003 --status in_progress
node agent-orchestrator.js task start AG-003 --status in_progress --expect-rev 12 --json
node agent-orchestrator.js task finish AG-003 --evidence verification/agent-runs/AG-003.md
node agent-orchestrator.js task start AG-003 --json
node agent-orchestrator.js sync
node agent-orchestrator.js publish checkpoint CDX-001 --summary "..." --expect-rev 12 --json
node agent-orchestrator.js close <task_id>
node agent-orchestrator.js close AG-003 --json
node agent-orchestrator.js close AG-003 --evidence verification/agent-runs/AG-003.md --expect-rev 12 --json
node agent-orchestrator.js metrics
node agent-orchestrator.js metrics --json
node agent-orchestrator.js metrics baseline show
node agent-orchestrator.js metrics baseline show --json
node agent-orchestrator.js metrics baseline set --from current --json
node agent-orchestrator.js metrics baseline reset --json
php bin/validate-agent-governance.php
npm run agent:test
npm run agent:summary
npm run agent:policy:lint
npm run agent:metrics:baseline -- show --json
npm run agent:leases
npm run agent:board:doctor
npm run agent:board:legacy:check
npm run agent:board:legacy:normalize
npm run agent:board:resolve-revision
npm run agent:gate
```

Flujo recomendado:

1. Reservar trabajo en board (`AGENT_BOARD.yaml`) o usar `codex start` / `handoffs create`.
   Para tareas no-Codex, preferir `task claim/start/finish` en lugar de editar `status/owner` a mano.
   Para inspeccionar backlog/activos sin abrir YAML, usar `task ls` con filtros (`--active`, `--mine`, `--status`, `--executor`, `--scope`).
   Para crear tareas AG nuevas sin editar YAML, usar `task create` (auto-asigna `AG-###` siguiente salvo `--id`).
2. Ejecutar `npm run agent:test` si cambiaste el orquestador/validadores.
3. Ejecutar `npm run agent:gate` (o al menos `conflicts`, `handoffs lint`, `codex-check`).
   Para diagnostico semantico del board (leases, stale, WIP, evidencia), ejecutar `node agent-orchestrator.js board doctor --json` (warn-first, no bloqueante por defecto).
4. Si el cambio debe salir rapido a `main`, ejecutar `node agent-orchestrator.js publish checkpoint <CDX-ID> --summary "..." --expect-rev <rev> --json`.
5. Ejecutar `node agent-orchestrator.js sync` cuando haga falta refrescar tombstones/estado derivado.
6. Ejecutar validaciones del cambio (`npm run lint`, tests aplicables).
7. Confirmar evidencia y cerrar (`close`, `codex stop`, `handoffs close`) cuando aplique.

Candado de concurrencia:

- Toda mutacion de board/handoffs por CLI requiere `--expect-rev <n>` (claim/start/create/apply/finish/close/codex start-stop/leases/handoffs create-close).
- Si no se envia `--expect-rev`, el comando debe fallar con `error_code=expect_rev_required`.
- Obtener revision actual desde `AGENT_BOARD.yaml.policy.revision` o `node agent-orchestrator.js status --json`.
- Si un `rebase` deja conflicto textual **solo** en `policy.revision`, resolver rapido con `npm run agent:board:resolve-revision` y continuar (`git add AGENT_BOARD.yaml && git rebase --continue`).

Runbook operativo tri-lane runtime:

- `TRI_LANE_RUNTIME_RUNBOOK.md` define flujo diario, ownership por lane,
  surfaces OpenClaw y comandos de handoff/runtime.
- `DUAL_CODEX_RUNBOOK.md` queda como nota de migracion/redirect.

Nota:

- Preferir `--json` para dashboards, comentarios automáticos en PR y tooling externo; usar salida texto para operación manual.
- `npm run agent:summary` genera resumen consolidado (Markdown/JSON) para CI/PR usando los comandos `--json`.
- `agent-governance-summary --explain-red` agrega una seccion de explicacion del estado rojo (conflicts/handoffs/codex/regresiones) en Markdown y JSON.
- Scripts utiles: `npm run agent:summary:local` (read-only) y `npm run agent:summary:ci` (persiste snapshots runtime).
- El summary soporta `--profile local|ci` (default `local`); en `local` usa metrics read-only para no ensuciar el arbol local.
- El summary soporta `--strict` (falla por blockers) y `--fail-on-red` (falla si el semaforo global queda en `RED`).
- El JSON/Markdown del summary incluye evaluacion de politicas (`strict`, `fail_on_red`) para dashboards/PR review.
- Para CI/automatizacion, preferir `agent-governance-summary --from-json <artifact> --policy-check <strict|fail_on_red>` en lugar de parseo inline.
- `metrics` acepta `--profile local|ci` (por defecto escribe; `local` implica read-only salvo `--write`).
- `metrics --dry-run` muestra preview de archivos runtime que escribiria y no persiste cambios.
- `metrics baseline <show|set|reset>` permite gestionar baseline explicito en `verification/agent-metrics.json` (recomendado usar `set --from current` tras cambios estructurales del board/politica).
- `task create`, `task claim` (si cambia `status` a activo) y `task start` aplican guardrails locales de gobernanza: validan `depends_on` (IDs existentes, sin duplicados) y bloquean scopes criticos asignados a ejecutores no permitidos (`codex`).
- `task create`, `task claim` (si activa trabajo), `task start` y `codex start`
  bloquean tareas fuera de `strategy.active`, subfrentes ajenos a su lane y
  excepciones sin `strategy_reason`.
- `task create --template <docs|bugfix|critical>` aplica defaults de `executor/status/risk/scope`; los flags explicitos sobreescriben la plantilla. `critical` exige `--scope` con keyword critica (`payments|auth|calendar|deploy|env|security`).
- `task create --template <docs|bugfix|critical|runtime>` aplica defaults de `executor/status/risk/scope`; la plantilla `runtime` fija `scope=openclaw_runtime`, `domain_lane=transversal_runtime`, `codex_instance=codex_transversal`, `provider_mode=openclaw_chatgpt` y `runtime_transport=hybrid_http_cli`. Los flags explicitos sobreescriben la plantilla. `critical` exige `--scope` con keyword critica (`payments|auth|calendar|deploy|env|security`).
- `task create --from-files` infiere `scope` y `risk` desde rutas de `files` (precedencia: flags explicitos > inferencia por files > template > defaults). Si detecta scope critico y no se paso `--executor`, puede autoajustar `executor` a `codex` para evitar fallo por guardrail.
- `task create --interactive` solicita por prompt los campos minimos (incluye opcion de activar `--from-files`); con `--json` los prompts salen por `stderr` para no romper el payload.
- `task create --preview` / `--dry-run` valida y calcula la tarea (incluyendo conflictos/inferencia) pero no escribe `AGENT_BOARD.yaml` ni colas derivadas.
- `task create --explain` imprime (o adjunta en JSON) una explicacion corta de como se resolvieron `scope/risk/executor` al usar plantilla/inferencia por files.
- `task create --validate-only` ejecuta validaciones/gates locales y devuelve diagnostico (sin escribir board ni construir preview completo).
- `task create --apply <preview.json>` persiste un payload previo de `task create --preview --json` (reutiliza `task_full` validado y vuelve a verificar conflictos/guardrails contra el board actual).
- `task create --apply -` permite aplicar preview JSON desde `stdin` (util para pipes y automatizacion).
- `task create preview-file lint <preview.json|->` valida un preview guardado contra el board actual (schema + normalizacion + guardrails + conflicto activo) sin persistir cambios.
- `task create preview-file diff <preview.json|->` compara el preview con el board actual (colision de ID, diff de campos del mismo ID y proyeccion de conflictos si se aplicara).
- `task create --apply --force-id-remap` permite aplicar un preview aunque el `AG-###` ya exista; remapea al siguiente `AG-###` disponible y lo reporta en JSON (`original_task_id`, `id_remapped`).
- `task create preview-file diff --format compact|full` controla el detalle de la salida texto (`compact` por defecto; `full` imprime `before -> after` por campo).
- `task create preview-file diff --json --format compact` reduce el payload JSON (omite detalles pesados y deja resumen por campo); `full` conserva detalle completo.
- `task create --apply --to <status>` permite override del `status` del preview al aplicar (util con `--force-id-remap` para bajar a `backlog` y evitar conflicto por tarea activa duplicada).
- `task create --apply --claim-owner <user>` permite asignar `owner` al aplicar (tambien soporta `--claim-owner` sin valor si existe `AGENT_OWNER/USERNAME/USER`).
- El summary/PR comment incluye delta corto de conflictos (`blocking`/`handoff`) vs baseline usando `metrics --json`.
- El summary/PR comment incluye semaforo (`GREEN/YELLOW/RED`) y razones de estado para lectura rapida.
- La politica de pesos/umbrales de gobernanza vive en `governance-policy.json` (p. ej. pesos por dominio y threshold de score para `YELLOW` en summary).
- Validar cambios de politica con `node agent-orchestrator.js policy lint` (incluido en `npm run agent:gate` y CI de gobernanza).
- `status --json` y `metrics --json` incluyen `contribution` por ejecutor (porcentaje de tareas `done` y porcentaje ponderado por riesgo) para identificar quien aporta mas.
- `metrics --json` persiste historico diario de aporte en `verification/agent-contribution-history.json` y el summary muestra tabla de tendencia (ventana 7d).
- `status --json` y el summary exponen `domain_health` con semaforo por dominio (incluye `calendar`, `chat`, `payments`).
- `metrics --json` persiste historico de salud por dominio en `verification/agent-domain-health-history.json` y el summary muestra tendencia (ventana 7d).
- El summary/PR comment muestra score de salud por dominio ponderado (`calendar > chat > payments`) y alerta regresiones `GREEN->RED`.
- `status/conflicts/handoffs lint/policy lint/codex-check` en `--json` incluyen `diagnostics` + `warnings_count/errors_count` (warn-first, aditivo, sin cambiar hard blockers actuales).
- `leases status --json` y `board doctor --json` incluyen `diagnostics` + `warnings_count/errors_count`; `board doctor` agrega `checks` y `leases` para diagnostico semantico del board (warn-first).
- `task claim/start --json` y `dispatch --json` pueden incluir warnings WIP (`warn.board.wip_limit_*`) en `diagnostics` sin cambiar exit code.
- Operaciones mutantes del board generan trazabilidad append-only en `verification/agent-board-events.jsonl` (consultable con `board events tail/stats`).
- Operaciones mutantes del board aceptan `--expect-rev <n>` (optimistic concurrency) en `task`, `codex`, `handoffs`, `leases` y `close`; si el board cambio desde la lectura, el comando falla con `error_code=board_revision_mismatch` en `--json`.
- `AGENT_BOARD.yaml` mantiene `policy.revision` como contador aditivo de escrituras del board (incrementa en cada write mutante exitoso).
- `task create --json` incluye `diagnostics` + `warnings_count/errors_count` (p. ej. `warn.task.from_files_fallback_default_scope` cuando `--from-files` cae en `scope=general`).
- El summary/PR comment agrega seccion `Warn-first Diagnostics` consolidando warnings de gobernanza (globs amplios activos, handoffs por expirar, baseline faltante, keys desconocidas de policy).
- La seccion `enforcement` en `governance-policy.json` gobierna severidad/enable de warnings y perfiles de rama (`fail_on_red`), con validacion en Node y contrato PHP.
- Precedencia H6: checks algorítmicos detallados (solapes/handoffs/Codex mirror file-level) son canónicos en Node; `php bin/validate-agent-governance.php` queda como contrato estructural/complementario.

## Reglas de edicion

1. No editar scripts generados directamente salvo tarea explicita de build.
2. No hacer cambios destructivos de git.
3. No commitear secretos.
4. No cerrar tareas sin evidencia.

## Convivencia de lineas (Orquestador + Codex)

- `AGENT_BOARD.yaml` sigue siendo el tablero canonico de locks/ejecucion para todos los agentes, incluida la linea Codex.
- `PLAN_MAESTRO_CODEX_2026.md` sigue siendo la fuente de estrategia/evidencia de la linea Codex.
- El bloque `CODEX_STRATEGY_ACTIVE` del plan debe espejar exactamente la
  `strategy.active` vigente del board.
- Toda ejecucion activa de Codex debe tener tarea espejo `CDX-*` en `AGENT_BOARD.yaml` con `executor: codex`.
- Maximo una tarea `CDX-*` activa por `codex_instance`.
- Maximo tres tareas `CDX-*` activas en total, una por lane.
- El bloqueo por solape se decide por `files` en tareas activas del board (`ready`, `in_progress`, `review`, `blocked`).
- Excepcion permitida: handoff temporal y explicito en `AGENT_HANDOFFS.yaml` (TTL + archivos acotados).
- Si hay drift entre el bloque `CODEX_ACTIVE` del plan Codex y el task `CDX-*` espejo, CI debe fallar.
- Si hay drift entre `CODEX_STRATEGY_ACTIVE` y `AGENT_BOARD.yaml.strategy.active`,
  CI debe fallar.
- `codex-check` debe bloquear si una tarea activa en `codex_transversal`
  depende de una `runtime_surface` no saludable.

## CI y gobernanza

CI valida automaticamente:

- Consistencia `AGENTS.md` vs `CLAUDE.md`.
- Integridad de `AGENT_BOARD.yaml`.
- Integridad de `AGENT_HANDOFFS.yaml`.
- Duplicados entre colas derivadas.
- Asignacion de tareas criticas a ejecutor permitido.
- Solape de archivos entre tareas activas.
- Integridad del espejo Codex (`PLAN_MAESTRO_CODEX_2026.md` <-> `AGENT_BOARD.yaml`).
- Integridad del espejo de estrategia madre (`CODEX_STRATEGY_ACTIVE` <->
  `AGENT_BOARD.yaml.strategy.active`).
- Push directo a `main/staging` con cambio en `AGENT_BOARD.yaml` sin PR asociado (bloqueante).
- Drift legacy de dual-lane/tri-lane en `AGENT_BOARD.yaml` (detector/normalizador en gobernanza).

Si falla la gobernanza, el pipeline debe bloquear merge.
