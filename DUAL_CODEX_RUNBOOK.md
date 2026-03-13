# Runbook Dual Codex (Migracion)

Este documento se conserva por compatibilidad historica.

El modelo canonico ya no es dual-lane. La operacion vigente usa
`tri_lane_runtime` con tres instancias:

- `codex_backend_ops`
- `codex_frontend`
- `codex_transversal`

Fuente actual:

- `TRI_LANE_RUNTIME_RUNBOOK.md`

Reglas de migracion:

- Mantener `executor=codex`, `CDX-*` y `CODEX_ACTIVE`.
- Tratar `openclaw_chatgpt` como runtime interno transversal, no como plugin externo.
- Toda tarea runtime OpenClaw nueva debe vivir en
  `domain_lane=transversal_runtime` y `codex_instance=codex_transversal`.
