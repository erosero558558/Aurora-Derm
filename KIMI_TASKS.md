# KIMI_TASKS.md — Cola derivada desde AGENT_BOARD.yaml

> Archivo generado por `node agent-orchestrator.js sync`.
> No editar manualmente; los cambios se sobrescriben.
> Ejecutar cola: `node kimi-run.js --dispatch`

---

## Formato de tarea

```
<!-- TASK
status: pending | running | done | failed
task_id: AG-XXX
risk: low|medium|high
scope: docs|frontend|backend|platform|security|ops
files: path1,path2
acceptance_ref: verification/agent-runs/AG-XXX.md
dispatched_by: agent-orchestrator
-->
### Titulo

Prompt...

<!-- /TASK -->
```

---

## Tareas

<!-- TASK
status: done
task_id: AG-005
risk: low
scope: audit
files: js/engines,docs/dead-code-audit.md
acceptance_ref: docs/dead-code-audit.md
dispatched_by: agent-orchestrator
-->
### Audit dead code in js engines

Auditar js/engines y generar docs/dead-code-audit.md sin tocar logica de JS.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-006
risk: low
scope: tooling
files: .editorconfig,.gitattributes
acceptance_ref: .editorconfig,.gitattributes
dispatched_by: agent-orchestrator
-->
### Add editorconfig and normalize line-end policy

Crear/ajustar .editorconfig y .gitattributes para estandarizar indentacion y finales de linea.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-007
risk: low
scope: docs
files: lib/audit.php,lib/ratelimit.php,lib/email.php
acceptance_ref: lib/audit.php,lib/ratelimit.php,lib/email.php
dispatched_by: agent-orchestrator
-->
### Add missing PHPDoc in core lib files

Agregar PHPDoc faltantes en librerias core sin modificar comportamiento funcional.

<!-- /TASK -->

<!-- TASK
status: pending
task_id: AG-008
risk: low
scope: ops
files: KIMI_TASKS.md
acceptance_ref: verification/agent-runs/AG-008.md
dispatched_by: agent-orchestrator
-->
### Kimi autopilot smoke task (no-op)

Smoke test: no hagas cambios de codigo. Solo confirma ejecucion y finaliza sin modificar archivos.

<!-- /TASK -->
