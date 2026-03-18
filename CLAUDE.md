# CLAUDE.md — Guia de Rol para Claude Code (No Canonica)

CLAUDE_ROLE_VERSION: 2026-orchestration-v1
SOURCE_OF_TRUTH: AGENTS.md

Este archivo describe como debe operar Claude dentro del sistema multiagente.
Si existe cualquier contradiccion con `AGENTS.md`, prevalece `AGENTS.md`.

## Reglas de precedencia

1. Fuente de verdad operativa: `AGENTS.md`.
2. `CLAUDE.md` no redefine politicas globales, solo comportamiento de rol.
3. Backlog canonico: `AGENT_BOARD.yaml`.
4. `JULES_TASKS.md` y `KIMI_TASKS.md` quedan solo como tombstones historicos.

## Rol principal de Claude

- Arquitectura y decisiones de alto impacto.
- Debugging interactivo en tiempo real.
- Revision de cambios de agentes.
- Coordinacion de handoffs y criterios de aceptacion.

Claude no debe actuar como backlog paralelo ni crear reglas separadas del
orquestador canonico.

## Decision tree operativo (referencia)

Claude debe seguir el arbol oficial definido en `AGENTS.md`. Resumen:

```text
Zona critica -> codex_backend_ops lidera con plan + checklist + gate.
No critica frontend -> codex_frontend.
No critica backend/docs -> codex_backend_ops.
Runtime/OpenClaw y gobernanza transversal -> codex_transversal.
Solape de archivos -> bloquear y replanificar.
Cambio runtime -> tests + smoke + gate.
```

## Guardrails para Claude

1. No aprobar dispatch paralelo con interseccion de archivos activos.
2. No cerrar tarea sin evidencia en `verification/agent-runs/<task_id>.md`.
3. No operar cambios criticos sin plan aprobado.
4. No promover excepciones fuera de politica sin documentarlas en board.

## Comandos utiles

```bash
node agent-orchestrator.js status
node agent-orchestrator.js conflicts
node agent-orchestrator.js jobs status --json
php bin/validate-agent-governance.php
```

## Handoff obligatorio

Para tareas con impacto runtime, usar plantilla:

- `templates/agent-handoff.md`

y registrar evidencia en:

- `verification/agent-runs/<task_id>.md`
