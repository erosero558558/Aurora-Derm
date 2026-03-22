# Runbook 24/7 de Orquestacion de Agentes

Fecha base: 2026-03-03
Fuente canonica: `AGENTS.md`

## Objetivo

Operar el sistema en modo `codex-only` con tres lanes Codex activos:

- `codex_backend_ops`
- `codex_frontend`
- `codex_transversal`

`ci` queda como validador. `jules`, `kimi` y `claude` quedan retirados para trabajo activo.

## Flujos automaticos

- `agent-intake.yml`: cada 15 min.
    - Ejecuta `intake -> score -> stale --strict -> conflicts --strict -> board doctor -> codex-check -> jobs status`.
- `agent-governance.yml`: push/PR/manual.
    - Valida contratos, policy, mirror Codex y jobs tracked.
    - Corre `board sync check` como guardrail bloqueante del foco activo.
- `public_main_sync`:
    - Cron externo productivo `* * * * *`
    - `job_id=8d31e299-7e57-4959-80b5-aaa2d73e9674`
    - status runtime: `/var/lib/pielarmonia/public-sync-status.json`

## Operacion diaria

1. Revisar salud:
    - `node agent-orchestrator.js workspace status --json`
    - `node agent-orchestrator.js strategy status --json`
    - `node agent-orchestrator.js status --json --explain-red`
    - `node agent-orchestrator.js board reconcile --json`
    - `node agent-orchestrator.js board sync check --json`
    - `node agent-orchestrator.js board doctor --json`
    - `node agent-orchestrator.js jobs verify public_main_sync --json`
2. Reservar trabajo:
    - Si la maquina todavia no esta bootstrappeada: `node agent-orchestrator.js workspace bootstrap --json`
    - `node agent-orchestrator.js codex start <CDX-ID> --block <BLOCK> --expect-rev <n>`
    - `codex start` y `task start` para `executor=codex` crean o reutilizan `.codex-worktrees/<task_id>` desde `origin/main` y actualizan el snapshot `workspace_*` del board.
3. Implementar y validar gates por superficie.
4. Confirmar evidencia y cerrar:
    - `node agent-orchestrator.js close <AG-ID|CDX-ID> --evidence verification/agent-runs/<task_id>.md --expect-rev <n> --json` es el closeout canonico para tareas `executor=codex`
    - el comando materializa board + evidencia + cambios in-scope en un unico commit, publica a `origin/main`, refresca `origin/main` local y exige rama actual `0 ahead / 0 behind`
    - la salida JSON incluye `published_commit`, `publish_transport`, `branch_alignment`, `live_status` y `verification_pending`
5. Ruta manual/de excepcion:
    - `node agent-orchestrator.js task start <AG-ID|CDX-ID> --release-publish --expect-rev <n> --json` cuando sea promocion formal de release
    - `node agent-orchestrator.js publish checkpoint <AG-ID|CDX-ID> --summary "..." --expect-rev <n> --json`
    - `publish checkpoint` conserva el publish manual, ignora ruido efimero de `.generated/site-root` y `_deploy_bundle`, y deja la verificacion live delegada a deploy/post-deploy
6. Confirmar producción:
    - `curl -s https://pielarmonia.com/api.php?resource=health`
    - revisar `checks.publicSync.failureReason`, `checks.publicSync.currentHead`, `checks.publicSync.remoteHead`, `checks.publicSync.headDrift`, `checks.publicSync.telemetryGap`, `checks.publicSync.lastErrorMessage` y `checks.publicSync.dirtyPathsSample` cuando el cron quede `failed`
    - si `node agent-orchestrator.js jobs verify public_main_sync --json` responde con `verification_source=health_url` y `failure_reason=health_missing_public_sync`, asumir primero rollout stale del `health` publico; confirmar `/api.php?resource=health` y desplegar `controllers/HealthController.php` actualizado antes de tratarlo como drift de repo
    - si responde con `verification_source=registry_only` y `failure_reason=unverified`, asumir primero falta de telemetria viva o `health_url` inalcanzable; confirmar `/api.php?resource=health`, `/api.php?resource=health-diagnostics` y `/var/lib/pielarmonia/public-sync-status.json` antes de tratarlo como drift de repo

## Guardrails

- No crear tareas activas con `executor=jules|kimi|claude`.
- No usar `dispatch --agent jules` ni `dispatch --agent kimi`.
- `JULES_TASKS.md` y `KIMI_TASKS.md` quedan como tombstones historicos.
- `public_main_sync` debe permanecer `healthy=true` y `ageSeconds <= 120`.
- `AGENT_BOARD.yaml` del worktree canonico es la unica verdad operativa para mutaciones.
- El checkout raiz debe permanecer en `main` como espejo limpio de `origin/main`; el authoring de Codex vive en ramas `codex/<task_id>` dentro de `.codex-worktrees/`.
- `workspace sync --once` corre como watcher local cada 60s y marca `workspace_main_behind`, `workspace_branch_invalid`, `workspace_root_dirty` o `workspace_task_mixed_lane` antes de permitir nuevos heartbeats/cierres.
- `main` no puede quedarse con authored `mixed_lane`, authored fuera de scope ni boards paralelos activos.
- Si `status`, `board doctor`, `conflicts` o `codex-check` exponen `workspace_truth.ok=false`, no se debe seguir con `task start`, `strategy intake`, `codex start`, `publish checkpoint` ni `close`.
- Si `status`, `board doctor` o `codex-check` exponen `workspace_sync_*` en error, primero ejecutar `node agent-orchestrator.js workspace sync --once --json` o `node agent-orchestrator.js workspace repair --json`.
- `board reconcile --apply-safe` solo se usa para drift de metadata; si el preview muestra tareas activas divergentes, la reconciliacion es manual.

## SLA y escalamiento

1. Si `stale --strict` falla por señales criticas sin tarea activa:
    - correr `intake --strict`
    - crear/escalar a `codex`
2. Si `conflicts --strict` falla:
    - resolver con `handoffs create/close` o replanificar archivos
3. Si `board doctor` reporta lease expirado o heartbeat stale:
    - refrescar con `leases heartbeat <task_id> --ttl-hours 4 --expect-rev <n> --json`
      Si `board sync check` reporta `normalized_candidates`:
    - aplicar `node agent-orchestrator.js board sync apply --json`
    - el comando solo baja a `backlog` tareas `ready` en pasos futuros; no auto-demueve trabajo ambiguo.
4. Si `jobs verify public_main_sync --json` falla:
    - revisar cron VPS, status file y `health`
    - si `verification_source=health_url` y `failure_reason=health_missing_public_sync`, el host respondio pero sigue sin exponer `checks.publicSync`; tratarlo como rollout stale del contrato publico antes de culpar al cron o al repo
    - si `verification_source=registry_only` y `failure_reason=unverified`, el orquestador solo pudo usar el registro de `AGENT_JOBS.yaml`; tratarlo como telemetria host ausente o `health_url` inalcanzable hasta confirmar `health`, `health-diagnostics` y el status file local del VPS
    - comparar `checks.publicSync.currentHead` vs `checks.publicSync.remoteHead`; si `headDrift=true`, el host no coincide con el remoto aunque el cron ya tenga telemetría completa
    - si `telemetryGap=true`, tratarlo como runtime host desactualizado o incompleto: el cron falló sin exponer `currentHead`, `remoteHead` ni `dirtyPaths`
    - si `failureReason=working_tree_dirty` y `telemetryGap=false`, usar `dirtyPathsCount` y `dirtyPathsSample` para ubicar el drift real antes de intervenir el host

## Evidencia

- Board canonico: `AGENT_BOARD.yaml`
- Handoffs: `AGENT_HANDOFFS.yaml`
- Jobs tracked: `AGENT_JOBS.yaml`
- Evidencias por tarea: `verification/agent-runs/<task_id>.md`
- Eventos de publish: `verification/agent-publish-events.jsonl`
- `close` en tareas Codex y `publish checkpoint` pueden devolver `live_status=pending` con `warning_code=publish_live_verification_pending` cuando el push a `main` ya salio pero la verificacion live todavia no confirma deploy.
