# Runbook 24/7 de Orquestación de Agentes

Fecha base: 2026-03-03
Fuente canónica: `AGENTS.md`

## Objetivo

Operar el sistema `codex_backend_ops + codex_frontend + CI` sin solapes y con publicación rápida a `main` mediante checkpoints validados.

## Flujos operativos

- `agent-intake.yml`
    - workflow manual de mantenimiento `codex-only`
    - ejecuta `intake`, `score`, `stale --strict`, `conflicts --strict`, `board doctor`, `codex-check`, `jobs status`, `validate-agent-governance`
- `agent-governance.yml`
    - valida contratos y bloquea incoherencias críticas

## Publicación rápida

1. `node agent-orchestrator.js codex start <CDX-ID> --block <Cx|Fx> --expect-rev <rev>`
2. implementar cambios dentro del scope reservado
3. `node agent-orchestrator.js publish checkpoint <CDX-ID> --summary "..." --expect-rev <rev> --json`
4. confirmar que `jobs verify public_main_sync --json` y `api.php?resource=health` reflejan el commit desplegado
5. cerrar tarea con evidencia

## Comandos de guardia

```bash
node agent-orchestrator.js status --explain-red
node agent-orchestrator.js conflicts --strict
node agent-orchestrator.js board doctor --json
node agent-orchestrator.js codex-check --json
node agent-orchestrator.js jobs status --json
node agent-orchestrator.js jobs verify public_main_sync --json
php bin/validate-agent-governance.php
```

## Criterios de salud diaria

- No hay conflictos `blocking`.
- No hay tareas activas con executor retirado.
- `public_main_sync` está configurado y verificable en producción.
- Cada checkpoint publicado queda confirmado por `health.checks.publicSync.deployedCommit`.
