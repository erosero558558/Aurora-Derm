# Runbook 24/7 de Orquestación de Agentes

Fecha base: 2026-02-25
Fuente canónica: `AGENTS.md`

## Objetivo
Operar el sistema `Codex + Kimi + Jules + CI` sin ciclos vacíos, con intake automático de señales reales y cierre trazable de tareas.

## Flujos automáticos
- `agent-intake.yml`: cada 15 min.
  - Ejecuta `intake -> score -> stale --strict -> conflicts --strict -> budget --strict --agent jules -> dispatch jules -> reconcile`.
- `agent-autopilot.yml` (Jules): cada 15 min.
  - Ejecuta sync + gobernanza y despacho Jules.
- `agent-kimi-autopilot.yml` (Kimi): cada 10 min.
  - Ejecuta sync + gobernanza y despacho Kimi.
- `agent-governance.yml`: push/PR/manual.
  - Valida contratos y bloquea incoherencias críticas.

## Presupuesto operativo
- Jules: `80` despachos/día (buffer bajo tope 100/día).
- Kimi: `180` despachos/día (modo normal).
- Kimi adaptativo: baja a `120`/día cuando se detecta 429/rate-limit.
- Codex: sin límite duro (`999`), reservado a críticos/escalados.

## Variables mínimas
- Secrets:
  - `GITHUB_TOKEN` (Actions)
  - `JULES_API_KEY`
- Vars:
  - `ENABLE_KIMI_AUTOPILOT=true`
  - `KIMI_BIN`
  - `KIMI_MAX_DISPATCH_PER_RUN` (default 2)
  - `JULES_MAX_DISPATCH_PER_RUN` (default 2)
  - `JULES_MAX_ACTIVE_SESSIONS` (default 6)

## SLA y escalamiento
1. Si `stale --strict` falla por `critical_signals_without_ready_or_in_progress_tasks`:
   - Acción inmediata: `node agent-orchestrator.js intake --strict && node agent-orchestrator.js score`
   - Si persiste: crear tarea `codex` crítica con `runtime_impact=high`.
2. Si `conflicts --strict` falla:
   - Mantener `blocked_reason=file_overlap`.
   - Resolver con `handoffs create/close` o replanificar archivos.
3. Si `budget --strict` falla:
   - Pausar dispatch del agente afectado.
   - Priorizar backlog por `priority_score` y SLA vencido.
4. Si una tarea falla 2 veces:
   - Escalado automático a `executor=codex`.

## Comandos de guardia (manual)
```bash
node agent-orchestrator.js status --explain-red
node agent-orchestrator.js intake --strict
node agent-orchestrator.js score
node agent-orchestrator.js stale --strict
node agent-orchestrator.js conflicts --strict
node agent-orchestrator.js budget --strict
node agent-orchestrator.js reconcile --strict
php bin/validate-agent-governance.php
```

## Criterios de salud diaria
- No hay señales críticas activas con board vacío en `ready|in_progress`.
- `conflicts` blocking = 0.
- 100% de tareas `done` con `acceptance_ref` y `evidence_ref`.
- Workflows `agent-intake` y `agent-governance` en verde.

## Auditoría
- Evidencias por tarea: `verification/agent-runs/<task_id>.md`
- Métricas: `verification/agent-metrics.json`
- Señales: `AGENT_SIGNALS.yaml`
- Board canónico: `AGENT_BOARD.yaml`
