# KIMI_TASKS.md - Cola derivada desde AGENT_BOARD.yaml

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
status: done
task_id: AG-008
risk: low
scope: ops
files: KIMI_TASKS.md
acceptance_ref: KIMI_TASKS.md
dispatched_by: agent-orchestrator
-->
### Kimi autopilot smoke task (no-op)

Smoke test: no hagas cambios de codigo. Solo confirma ejecucion y finaliza sin modificar archivos.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-009
risk: medium
scope: mobile-ux
files: index.html,styles-deferred.css,src/apps/chat/ui-engine.js,src/apps/chat/widget-engine.js
acceptance_ref: verification/agent-runs/AG-009.md
dispatched_by: agent-orchestrator
-->
### Mobile UX phase 4: fix chat/header overlap and spacing consistency

Corregir solapes y espaciado en mobile-first sin romper desktop.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-011
risk: medium
scope: performance
files: js/main.js,rollup.config.mjs,src/bundles/ui.js,src/bundles/engagement.js
acceptance_ref: verification/agent-runs/AG-011.md
dispatched_by: agent-orchestrator
-->
### Performance phase 4: split non-critical JS and lazy-init below-the-fold modules

Aplicar particion adicional de JS no critico y verificar que no rompa interacciones clave.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-023
risk: low
scope: tooling
files: templates/partials/tele-head-links.html,telemedicina.html,styles.css,styles-critical.css
acceptance_ref: templates/partials/tele-head-links.html
dispatched_by: agent-orchestrator
-->
### Tech debt: unify telemedicina.html CSS to use canonical styles.css (extracted 2026-02-24)

En templates/partials/tele-head-links.html reemplaza <link rel='stylesheet' href='styles-critical.css' /> y <link rel='stylesheet' href='styles-telemedicina.css' /> por <link rel='stylesheet' href='styles.css?v=inline-20260224-extracted1' />. El archivo styles.css es ahora el CSS critico canonico (extraido del monolito index.html el 2026-02-24, 1760 lineas). Ejecuta npm run build:html para regenerar telemedicina.html. Verifica que la pagina carga sin regresion visual (colores, fuentes, layout). styles-critical.css queda como archivo legacy no enlazado.

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-031
risk: medium
scope: ci orchestration
files: tools/agent-orchestrator/domain/github-signals.js,tools/agent-orchestrator/commands/runtime-intake.js,tools/agent-orchestrator/domain/signals.js
acceptance_ref: signal_resolved:auto
dispatched_by: agent-orchestrator
-->
### Stabilize CI signal intake for transient branch failures

Stabilize CI signal intake for transient branch failures

<!-- /TASK -->

<!-- TASK
status: done
task_id: AG-033
risk: medium
scope: gate reliability
files: .github/workflows/post-deploy-gate.yml,GATE-POSTDEPLOY.ps1,bin/verify-gate.php
acceptance_ref: signal_resolved:auto
dispatched_by: agent-orchestrator
-->
### Reduce post-deploy gate false failures from transient network delays

Reduce post-deploy gate false failures from transient network delays

<!-- /TASK -->
