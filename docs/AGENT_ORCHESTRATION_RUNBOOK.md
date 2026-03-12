# Runbook 24/7 de Orquestacion de Agentes

Fecha base: 2026-03-03
Fuente canonica: `AGENTS.md`

## Objetivo

Operar el sistema en modo `codex-only` con dos lanes humanos activos:

- `codex_backend_ops`
- `codex_frontend`

`ci` queda como validador. `jules`, `kimi` y `claude` quedan retirados para trabajo activo.

## Flujos automaticos

- `agent-intake.yml`: cada 15 min.
    - Ejecuta `intake -> score -> stale --strict -> conflicts --strict -> board doctor -> codex-check -> jobs status`.
- `agent-governance.yml`: push/PR/manual.
    - Valida contratos, policy, mirror Codex y jobs tracked.
- `public_main_sync`:
    - Cron externo productivo `* * * * *`
    - `job_id=8d31e299-7e57-4959-80b5-aaa2d73e9674`
    - status runtime: `/var/lib/pielarmonia/public-sync-status.json`

## Operacion diaria

1. Revisar salud:
    - `node agent-orchestrator.js status --json --explain-red`
    - `node agent-orchestrator.js board doctor --json`
    - `node agent-orchestrator.js jobs verify public_main_sync --json`
2. Reservar trabajo:
    - `node agent-orchestrator.js codex start <CDX-ID> --block <BLOCK> --expect-rev <n>`
3. Implementar y validar gates por superficie.
4. Publicar checkpoint:
    - `node agent-orchestrator.js publish checkpoint <CDX-ID> --summary "..." --expect-rev <n> --json`
5. Confirmar producción:
    - `curl -s https://pielarmonia.com/api.php?resource=health`
    - revisar `checks.publicSync.failureReason`, `checks.publicSync.currentHead`, `checks.publicSync.remoteHead`, `checks.publicSync.headDrift`, `checks.publicSync.telemetryGap`, `checks.publicSync.lastErrorMessage` y `checks.publicSync.dirtyPathsSample` cuando el cron quede `failed`

## Guardrails

- No crear tareas activas con `executor=jules|kimi|claude`.
- No usar `dispatch --agent jules` ni `dispatch --agent kimi`.
- `JULES_TASKS.md` y `KIMI_TASKS.md` quedan como tombstones historicos.
- `public_main_sync` debe permanecer `healthy=true` y `ageSeconds <= 120`.

## SLA y escalamiento

1. Si `stale --strict` falla por señales criticas sin tarea activa:
    - correr `intake --strict`
    - crear/escalar a `codex`
2. Si `conflicts --strict` falla:
    - resolver con `handoffs create/close` o replanificar archivos
3. Si `board doctor` reporta lease expirado o heartbeat stale:
    - refrescar con `leases heartbeat <task_id> --ttl-hours 4 --expect-rev <n> --json`
4. Si `jobs verify public_main_sync --json` falla:
    - revisar cron VPS, status file y `health`
    - comparar `checks.publicSync.currentHead` vs `checks.publicSync.remoteHead`; si `headDrift=true`, el host no coincide con el remoto aunque el cron ya tenga telemetría completa
    - si `telemetryGap=true`, tratarlo como runtime host desactualizado o incompleto: el cron falló sin exponer `currentHead`, `remoteHead` ni `dirtyPaths`
    - si `failureReason=working_tree_dirty` y `telemetryGap=false`, usar `dirtyPathsCount` y `dirtyPathsSample` para ubicar el drift real antes de intervenir el host

## Evidencia

- Board canonico: `AGENT_BOARD.yaml`
- Handoffs: `AGENT_HANDOFFS.yaml`
- Jobs tracked: `AGENT_JOBS.yaml`
- Evidencias por tarea: `verification/agent-runs/<task_id>.md`
- Eventos de publish: `verification/agent-publish-events.jsonl`
